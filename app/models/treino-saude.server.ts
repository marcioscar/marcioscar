import { mapaDeMarcas } from '~/models/treino-marca.server'
import { db } from '../../db.server'
import { chaveDia } from '~/lib/carga-treino'
import { aplicarPlanoNasVoltas, type DadosEstrutura } from '~/lib/treino-manual'
import { listarTreinosManuais } from '~/models/treino-manual.server'

export type TipoSaude = 'corrida' | 'caminhada' | 'musculacao' | 'outro'

export type SplitSaude = { km: number; distanciaM: number; tempoSeg: number; fcMedia: number | null }
export type VoltaSaude = {
	indice: number
	tipo: string
	rotulo: string | null
	metadados: Record<string, string> | null
	inicio: string
	fim: string
	distanciaM: number
	tempoSeg: number
	fcMedia: number | null
	potenciaW?: number | null
	cadencia?: number | null
	passadaM?: number | null
	oscilacaoCm?: number | null
	contatoMs?: number | null
}
export type EventoSaude = { tipo: string; inicio: string; fim: string }

export type TreinoSaudeEntrada = {
	healthId: string
	tipo: TipoSaude
	tipoHealthKit: string
	inicio: Date
	fim: Date
	duracaoSeg: number
	distanciaM: number | null
	caloriasKcal: number | null
	fcMedia: number | null
	fcMaxima: number | null
	cadenciaMedia: number | null
	potenciaMediaW: number | null
	passadaM: number | null
	oscilacaoVerticalCm: number | null
	contatoSoloMs: number | null
	elevacaoGanhoM: number | null
	polyline: string | null
	rota: { alt?: number[]; vel?: number[]; fc?: number[] } | null
	splits: SplitSaude[] | null
	voltas: VoltaSaude[] | null
	eventos: EventoSaude[] | null
}

function lista<T>(v: unknown, max: number, mapa: (item: Record<string, unknown>) => T | null): T[] | null {
	if (!Array.isArray(v)) return null
	const r = v
		.slice(0, max)
		.map(i => (i && typeof i === 'object' ? mapa(i as Record<string, unknown>) : null))
		.filter((i): i is T => i !== null)
	return r.length > 0 ? r : null
}

/**
 * O Apple Watch grava segmentos automáticos a cada km e a cada milha (duas séries que se sobrepõem).
 * Eles não são voltas de treino: o km a km já aparece nos splits. Reconhece essa assinatura:
 * os segmentos formam séries de trechos emendados que se cruzam no tempo (um começa antes
 * de o outro terminar), o que voltas marcadas à mão nunca fazem.
 */
export function ehSegmentacaoAutomatica(voltas: { inicio?: string; fim?: string; distanciaM: number }[]): boolean {
	const ordenadas = voltas
		.filter(v => v.inicio && v.fim)
		.map(v => ({ ini: new Date(v.inicio!).getTime(), fim: new Date(v.fim!).getTime() }))
		.sort((a, b) => a.ini - b.ini)
	if (ordenadas.length < 3) return false
	let sobrepostos = 0
	for (let i = 1; i < ordenadas.length; i++) {
		if (ordenadas[i].ini < ordenadas[i - 1].fim - 1000) sobrepostos++
	}
	// duas séries paralelas geram muitos cruzamentos; voltas manuais, nenhum
	return sobrepostos >= Math.max(2, Math.floor(ordenadas.length / 4))
}

/**
 * O relógio não grava o nome das etapas ("Z5", "Descanso"), mas grava a posição de cada uma na
 * estrutura do treino (`WOIntervalStepKeyPath` = "bloco.repetição.passo"). Com isso e a distância,
 * dá para nomear: primeiro bloco de 1 passo = aquecimento, último = desaquecimento, passo 0 de
 * um bloco repetido = esforço, os demais = descanso (trecho curto) ou recuperação.
 */
export function rotularEtapas<T extends { tipo: string; metadados: Record<string, string> | null; distanciaM: number; rotulo: string | null }>(voltas: T[]): T[] {
	if (!voltas.every(v => v.tipo === 'etapa')) return voltas
	const caminhos = voltas.map(v => (v.metadados?.WOIntervalStepKeyPath ?? '').split('.').map(Number))
	if (caminhos.some(c => c.length !== 3 || c.some(Number.isNaN))) return voltas

	const passosPorBloco = new Map<number, number>()
	for (const [b, , passo] of caminhos) passosPorBloco.set(b, Math.max(passosPorBloco.get(b) ?? 0, passo + 1))
	const blocos = [...passosPorBloco.keys()].sort((a, b) => a - b)
	const primeiro = blocos[0]
	const ultimo = blocos[blocos.length - 1]

	return voltas.map((v, i) => {
		const [b, , passo] = caminhos[i]
		const passos = passosPorBloco.get(b) ?? 1
		let rotulo: string
		if (blocos.length > 1 && b === primeiro && passos === 1) rotulo = 'Aquecimento'
		else if (blocos.length > 1 && b === ultimo && passos === 1) rotulo = 'Desaquecimento'
		else if (passos > 1 && passo === 0) rotulo = 'Esforço'
		else if (passos > 1) rotulo = v.distanciaM < 150 ? 'Descanso' : 'Recuperação'
		else rotulo = `Etapa ${i + 1}`
		return { ...v, rotulo }
	})
}

function semAutomaticas<T extends { tipo: string; inicio?: string; fim?: string; distanciaM: number }>(v: T[] | null): T[] | null {
	// etapas gravadas pelo relógio num treino estruturado valem sempre (2 ou mais)
	if (v && v.length >= 2 && v.every(x => x.tipo === 'etapa')) return rotularEtapas(v as never) as unknown as T[]
	// menos de 3 trechos não forma volta de treino: é só o primeiro km e a sobra
	return v && v.length >= 3 && !ehSegmentacaoAutomatica(v) ? v : null
}

function vetor(v: unknown, max: number): number[] | undefined {
	if (!Array.isArray(v) || v.length === 0 || v.length > 3000) return undefined
	const r = v.map(Number)
	return r.every(n => Number.isFinite(n) && Math.abs(n) <= max) ? r : undefined
}

function rotaSegura(v: unknown): { alt?: number[]; vel?: number[]; fc?: number[] } | null {
	if (!v || typeof v !== 'object') return null
	const r = v as Record<string, unknown>
	const alt = vetor(r.alt, 9000)
	const vel = vetor(r.vel, 50)
	const fc = vetor(r.fc, 260)
	return alt || vel || fc ? { ...(alt ? { alt } : {}), ...(vel ? { vel } : {}), ...(fc ? { fc } : {}) } : null
}

function metadadosSeguros(v: unknown): Record<string, string> | null {
	if (!v || typeof v !== 'object' || Array.isArray(v)) return null
	const pares = Object.entries(v as Record<string, unknown>)
		.slice(0, 12)
		.map(([k, val]) => [k.slice(0, 60), String(val).slice(0, 80)] as const)
	return pares.length > 0 ? Object.fromEntries(pares) : null
}

function dataIso(v: unknown): string | null {
	const d = new Date(String(v))
	return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const TIPOS: TipoSaude[] = ['corrida', 'caminhada', 'musculacao', 'outro']

function num(v: unknown, max = 1e9): number | null {
	const n = typeof v === 'number' ? v : Number(v)
	return Number.isFinite(n) && n >= 0 && n <= max ? n : null
}

/** Valida um treino vindo do app; devolve null se faltar o essencial. */
export function sanearTreinoSaude(bruto: unknown): TreinoSaudeEntrada | null {
	if (!bruto || typeof bruto !== 'object') return null
	const r = bruto as Record<string, unknown>
	const healthId = typeof r.healthId === 'string' ? r.healthId.trim() : ''
	if (!/^[0-9A-Fa-f-]{36}$/.test(healthId)) return null
	const inicio = new Date(String(r.inicio))
	const fim = new Date(String(r.fim))
	if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) return null
	const duracao = num(r.duracaoSeg, 7 * 24 * 3600)
	if (duracao === null) return null
	const tipo = TIPOS.includes(r.tipo as TipoSaude) ? (r.tipo as TipoSaude) : 'outro'
	const polyline = typeof r.polyline === 'string' && r.polyline.length <= 60000 ? r.polyline : null

	return {
		healthId,
		tipo,
		tipoHealthKit: String(r.tipoHealthKit ?? 'other').slice(0, 60),
		inicio,
		fim,
		duracaoSeg: duracao,
		distanciaM: num(r.distanciaM, 1_000_000),
		caloriasKcal: num(r.caloriasKcal, 50000),
		fcMedia: num(r.fcMedia, 260),
		fcMaxima: num(r.fcMaxima, 260),
		cadenciaMedia: num(r.cadenciaMedia, 400),
		potenciaMediaW: num(r.potenciaMediaW, 2000),
		passadaM: num(r.passadaM, 5),
		oscilacaoVerticalCm: num(r.oscilacaoVerticalCm, 50),
		contatoSoloMs: num(r.contatoSoloMs, 1000),
		elevacaoGanhoM: num(r.elevacaoGanhoM, 20000),
		polyline,
		rota: rotaSegura(r.rota),
		splits: lista(r.splits, 300, i => {
			const km = num(i.km, 1000)
			const distanciaM = num(i.distanciaM, 1_000_000)
			const tempoSeg = num(i.tempoSeg, 7 * 24 * 3600)
			return km !== null && distanciaM !== null && tempoSeg !== null
				? { km, distanciaM, tempoSeg, fcMedia: num(i.fcMedia, 260) }
				: null
		}),
		voltas: semAutomaticas(lista(r.voltas, 300, i => {
			const indice = num(i.indice, 1000)
			const inicio = dataIso(i.inicio)
			const fim = dataIso(i.fim)
			const distanciaM = num(i.distanciaM, 1_000_000)
			const tempoSeg = num(i.tempoSeg, 7 * 24 * 3600)
			return indice !== null && inicio && fim && distanciaM !== null && tempoSeg !== null
				? {
						indice,
						tipo: String(i.tipo ?? 'volta').slice(0, 20),
						rotulo: typeof i.rotulo === 'string' && i.rotulo ? i.rotulo.slice(0, 40) : null,
						metadados: metadadosSeguros(i.metadados),
						inicio,
						fim,
						distanciaM,
						tempoSeg,
						fcMedia: num(i.fcMedia, 260),
						potenciaW: num(i.potenciaW, 2000),
						cadencia: num(i.cadencia, 400),
						passadaM: num(i.passadaM, 5),
						oscilacaoCm: num(i.oscilacaoCm, 50),
						contatoMs: num(i.contatoMs, 1000),
					}
				: null
		})),
		eventos: lista(r.eventos, 300, i => {
			const inicio = dataIso(i.inicio)
			const fim = dataIso(i.fim)
			return inicio && fim ? { tipo: String(i.tipo ?? 'other').slice(0, 40), inicio, fim } : null
		}),
	}
}

export async function gravarTreinosSaude(lista: TreinoSaudeEntrada[]): Promise<{ criados: number; atualizados: number }> {
	let criados = 0
	let atualizados = 0
	for (const t of lista) {
		const existente = await db.treinoSaude.findUnique({ where: { healthId: t.healthId }, select: { id: true } })
		const { healthId, splits, voltas, eventos, rota, ...resto } = t
		const dados = {
			...resto,
			rota: rota ?? undefined,
			splits: splits ?? undefined,
			// ao reenviar, voltas ausentes (ex.: eram só segmentos automáticos) limpam o valor antigo
			voltas: voltas ?? null,
			eventos: eventos ?? undefined,
		}
		if (existente) {
			await db.treinoSaude.update({ where: { healthId }, data: dados })
			atualizados++
		} else {
			await db.treinoSaude.create({ data: { healthId, ...dados } })
			criados++
		}
	}
	return { criados, atualizados }
}

export async function resumoTreinosSaude(): Promise<{ total: number; maisRecente: string | null }> {
	const [total, ultimo] = await Promise.all([
		db.treinoSaude.count(),
		db.treinoSaude.findFirst({ orderBy: { inicio: 'desc' }, select: { inicio: true } }),
	])
	return { total, maisRecente: ultimo?.inicio.toISOString() ?? null }
}

export async function listarTreinosSaude(de: Date, ate: Date) {
	return db.treinoSaude.findMany({
		where: { inicio: { gte: de, lte: ate } },
		orderBy: { inicio: 'asc' },
	})
}

/** Treino do app Saúde que corresponde a uma corrida do Strava (começo a até 15 min de diferença). */
export async function buscarTreinoSaudeParaCorrida(inicio: Date) {
	const folga = 15 * 60 * 1000
	const candidatos = await db.treinoSaude.findMany({
		where: {
			tipo: { in: ['corrida', 'caminhada'] },
			inicio: { gte: new Date(inicio.getTime() - folga), lte: new Date(inicio.getTime() + folga) },
		},
	})
	candidatos.sort(
		(a, b) => Math.abs(a.inicio.getTime() - inicio.getTime()) - Math.abs(b.inicio.getTime() - inicio.getTime()),
	)
	return candidatos[0] ?? null
}

// ── Corridas do relógio no formato das páginas de Atividades ────────────────

export type CorridaRelogio = {
	healthId: string
	nome: string
	/** marcado como prova pelo Marcio (o relógio não sabe) e a distância oficial escolhida */
	prova?: boolean
	distanciaOficialM?: number | null
	dataInicio: string
	distanciaMetros: number
	tempoMovimentoSeg: number
	elevacaoGanhoMetros: number
	summaryPolyline: string | null
	fcMedia: number | null
	analise: unknown
	analisadaEm: string | null
	splits: {
		split: number
		distance: number
		elapsed_time: number
		moving_time: number
		elevation_difference: number
		average_speed: number
		average_heartrate?: number
	}[]
	laps: {
		lap_index: number
		name: string
		distance: number
		elapsed_time: number
		moving_time: number
		average_speed: number
		average_heartrate?: number
		total_elevation_gain?: number
		potenciaW?: number
		cadencia?: number
		passadaM?: number
		oscilacaoCm?: number
		contatoMs?: number
	}[]
}

function nomeDaCorrida(inicio: Date): string {
	const hora = Number(inicio.toLocaleString('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }))
	return hora < 12 ? 'Corrida matinal' : hora < 18 ? 'Corrida da tarde' : 'Corrida noturna'
}

type LinhaSaude = Awaited<ReturnType<typeof listarTreinosSaude>>[number]

/** Ganho de elevação da etapa (metros), lido do metadado HKElevationAscended ("1158 cm"). */
function ganhoDaEtapa(v: VoltaSaude): number | null {
	const bruto = v.metadados?.HKElevationAscended
	const m = bruto?.match(/^([\d.,]+)\s*(cm|m)$/i)
	if (!m) return null
	const n = Number(m[1].replace(',', '.'))
	return Number.isFinite(n) ? (m[2].toLowerCase() === 'cm' ? n / 100 : n) : null
}

export function paraCorridaRelogio(
	t: LinhaSaude,
	plano: DadosEstrutura | null = null,
	marca: { nome: string | null; prova: boolean; distanciaOficialM: number | null } | null = null,
): CorridaRelogio {
	const splits = ((t.splits as SplitSaude[] | null) ?? []).map(s => ({
		split: s.km,
		distance: s.distanciaM,
		elapsed_time: s.tempoSeg,
		moving_time: s.tempoSeg,
		elevation_difference: 0,
		average_speed: s.tempoSeg > 0 ? s.distanciaM / s.tempoSeg : 0,
		...(s.fcMedia ? { average_heartrate: s.fcMedia } : {}),
	}))
	const laps = aplicarPlanoNasVoltas((t.voltas as VoltaSaude[] | null) ?? [], plano).map((v, i) => ({
		lap_index: i,
		name: v.rotulo ?? `Volta ${v.indice}`,
		distance: v.distanciaM,
		elapsed_time: v.tempoSeg,
		moving_time: v.tempoSeg,
		average_speed: v.tempoSeg > 0 ? v.distanciaM / v.tempoSeg : 0,
		...(v.fcMedia ? { average_heartrate: v.fcMedia } : {}),
		...(v.potenciaW ? { potenciaW: v.potenciaW } : {}),
		...(v.cadencia ? { cadencia: v.cadencia } : {}),
		...(v.passadaM ? { passadaM: v.passadaM } : {}),
		...(v.oscilacaoCm ? { oscilacaoCm: v.oscilacaoCm } : {}),
		...(v.contatoMs ? { contatoMs: v.contatoMs } : {}),
		...(ganhoDaEtapa(v) !== null ? { total_elevation_gain: ganhoDaEtapa(v)! } : {}),
	}))
	return {
		healthId: t.healthId,
		nome: marca?.nome || nomeDaCorrida(t.inicio),
		prova: marca?.prova ?? false,
		distanciaOficialM: marca?.distanciaOficialM ?? null,
		dataInicio: t.inicio.toISOString(),
		distanciaMetros: t.distanciaM ?? 0,
		tempoMovimentoSeg: Math.round(t.duracaoSeg),
		elevacaoGanhoMetros: t.elevacaoGanhoM ?? 0,
		summaryPolyline: t.polyline,
		fcMedia: t.fcMedia,
		analise: t.analise ?? null,
		analisadaEm: t.analisadaEm ? t.analisadaEm.toISOString() : null,
		splits,
		laps,
	}
}

/** Corridas (não caminhadas) lidas do relógio a partir de `de`, no formato usado nas listas. */
export async function listarCorridasRelogio(de: Date, inicio?: Date, fim?: Date): Promise<CorridaRelogio[]> {
	const piso = inicio && inicio > de ? inicio : de
	const teto = fim ?? new Date('2100-01-01')
	const linhas = await listarTreinosSaude(piso, teto)
	const marcas = await mapaDeMarcas()
	// treinos planejados no site, por dia: nomeiam as etapas gravadas pelo relógio
	const planos = new Map<string, DadosEstrutura>()
	if (linhas.length > 0) {
		const dias = linhas.map(t => chaveDia(t.inicio)).sort()
		for (const p of await listarTreinosManuais(dias[0], dias[dias.length - 1])) planos.set(p.data, p)
	}
	return linhas
		.filter(t => t.tipo === 'corrida')
		.filter(t => (t.distanciaM ?? 0) / 1000 === 0 || t.duracaoSeg / ((t.distanciaM ?? 0) / 1000) <= 570)
		.map(t => paraCorridaRelogio(t, planos.get(chaveDia(t.inicio)) ?? null, marcas.get(t.healthId) ?? null))
}

/**
 * Treino planejado no site para o dia da corrida (null se não houver ou se for descanso).
 * Só corridas têm plano: caminhada, musculação e outros treinos do mesmo dia não são comparados com ele.
 */
export async function planejadoDoDia(inicio: Date, tipo?: string) {
	if (tipo !== undefined && tipo !== 'corrida') return null
	const dia = chaveDia(inicio)
	const [plano] = await listarTreinosManuais(dia, dia)
	return plano && plano.tipo !== 'descanso' && plano.blocos.length > 0 ? plano : null
}

export async function buscarTreinoSaudePorId(healthId: string) {
	return db.treinoSaude.findUnique({ where: { healthId } })
}
