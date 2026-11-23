import { db } from '../../db.server'

export type TipoSaude = 'corrida' | 'caminhada' | 'musculacao' | 'outro'

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
	}
}

export async function gravarTreinosSaude(lista: TreinoSaudeEntrada[]): Promise<{ criados: number; atualizados: number }> {
	let criados = 0
	let atualizados = 0
	for (const t of lista) {
		const existente = await db.treinoSaude.findUnique({ where: { healthId: t.healthId }, select: { id: true } })
		const { healthId, ...dados } = t
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
