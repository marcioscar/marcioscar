import { db } from '../../db.server'

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
	const polyline = typeof r.polyline === 'string' && r.polyline.length <= 20000 ? r.polyline : null

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
		const { healthId, splits, voltas, eventos, ...resto } = t
		const dados = {
			...resto,
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
