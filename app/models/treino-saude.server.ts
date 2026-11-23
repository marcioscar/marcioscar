import { db } from '../../db.server'

export type TipoSaude = 'corrida' | 'caminhada' | 'musculacao' | 'outro'

export type SplitSaude = { km: number; distanciaM: number; tempoSeg: number; fcMedia: number | null }
export type VoltaSaude = {
	indice: number
	tipo: string
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
		voltas: lista(r.voltas, 300, i => {
			const indice = num(i.indice, 1000)
			const inicio = dataIso(i.inicio)
			const fim = dataIso(i.fim)
			const distanciaM = num(i.distanciaM, 1_000_000)
			const tempoSeg = num(i.tempoSeg, 7 * 24 * 3600)
			return indice !== null && inicio && fim && distanciaM !== null && tempoSeg !== null
				? { indice, tipo: String(i.tipo ?? 'volta').slice(0, 20), inicio, fim, distanciaM, tempoSeg, fcMedia: num(i.fcMedia, 260) }
				: null
		}),
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
			voltas: voltas ?? undefined,
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
