import { db } from '../../db.server'
import { analisarProva } from '~/lib/maratona-analise'
import { LOCAIS_MARATONAS } from '~/lib/maratonas-locais'
import { RELOGIO_DESDE_DATA } from '~/lib/fonte-dados'
import { vpontoDaProva } from '~/lib/vdot'
import { listarMaratonas } from '~/models/corridas.server'
import { semDuplicadasDoStrava } from '~/models/corridas-unificadas.server'
import { listarCorridasRelogio } from '~/models/treino-saude.server'
import type { SplitMetric } from '~/types/analise'

// Dados da aba Maratonas do app do iPhone (ios/), servidos por GET /api/maratonas.

export const DISTANCIA_MARATONA_M = 42195
const MARATONA_MIN_M = 40000
/** acima disso o GPS mediu errado (Chicago: 45,3 km entre os prédios) e as parciais por km não são confiáveis */
const GPS_IMPRECISO = 1.04
const SEMANAS_PREPARO = 16
const DIA_MS = 86_400_000

// código numérico ISO 3166-1 (o mesmo de LOCAIS_MARATONAS) → alfa-2, para a bandeira
const ISO2: Record<string, string> = {
	'724': 'ES', '826': 'GB', '276': 'DE', '840': 'US', '484': 'MX', '076': 'BR', '858': 'UY', '032': 'AR', '152': 'CL',
}

type Ponto = { m: number; t: number; alt: number }

/** Tempo e altitude acumulados nas marcas de 1 a 42 km, com a distância do GPS esticada/encolhida para 42,195 km. */
function acumuladosPorKm(splits: SplitMetric[], tempoTotalSeg: number) {
	const validos = splits.filter(s => s.distance > 0 && s.elapsed_time > 0)
	const distancia = validos.reduce((a, s) => a + s.distance, 0)
	const tempo = validos.reduce((a, s) => a + s.elapsed_time, 0)
	if (validos.length < 10 || distancia < MARATONA_MIN_M) return null

	const escalaM = DISTANCIA_MARATONA_M / distancia
	const escalaT = tempoTotalSeg / tempo
	const pontos: Ponto[] = [{ m: 0, t: 0, alt: 0 }]
	for (const s of validos) {
		const ant = pontos[pontos.length - 1]
		pontos.push({
			m: ant.m + s.distance * escalaM,
			t: ant.t + s.elapsed_time * escalaT,
			alt: ant.alt + (s.elevation_difference ?? 0),
		})
	}

	const tempoKm: number[] = []
	const altitudeKm: number[] = []
	let i = 1
	for (let km = 1; km <= 42; km++) {
		const alvo = km * 1000
		while (i < pontos.length - 1 && pontos[i].m < alvo) i++
		const a = pontos[i - 1]
		const b = pontos[i]
		const f = b.m > a.m ? (alvo - a.m) / (b.m - a.m) : 0
		tempoKm.push(Math.round((a.t + (b.t - a.t) * f) * 10) / 10)
		altitudeKm.push(Math.round((a.alt + (b.alt - a.alt) * f) * 10) / 10)
	}
	const fcKm = Array.from({ length: 42 }, (_, k) => {
		const v = validos[k]?.average_heartrate
		return typeof v === 'number' && v > 0 ? Math.round(v) : null
	})
	return { tempoKm, altitudeKm, fcKm: fcKm.some(v => v !== null) ? fcKm : null }
}

type CorridaVolume = { dataInicio: Date; distanciaMetros: number }

function preparacao(inicio: Date, corridas: CorridaVolume[], primeiraCorrida: number) {
	// o dia da prova não conta
	const fim = inicio.getTime() - 12 * 3600 * 1000
	const comeco = inicio.getTime() - SEMANAS_PREPARO * 7 * DIA_MS
	if (primeiraCorrida > comeco) return null // o histórico começa depois do início do bloco
	const bloco = corridas.filter(c => c.dataInicio.getTime() >= comeco && c.dataInicio.getTime() < fim)
	if (bloco.length < 8) return null

	const semanasKm = Array.from({ length: SEMANAS_PREPARO }, () => 0)
	for (const c of bloco) {
		const s = Math.min(SEMANAS_PREPARO - 1, Math.floor((c.dataInicio.getTime() - comeco) / (7 * DIA_MS)))
		semanasKm[s] += c.distanciaMetros / 1000
	}
	const km = semanasKm.reduce((a, b) => a + b, 0)
	return {
		km: Math.round(km),
		corridas: bloco.length,
		longaoKm: Math.round(Math.max(...bloco.map(c => c.distanciaMetros)) / 100) / 10,
		longoes30: bloco.filter(c => c.distanciaMetros >= 29_500).length,
		semanasKm: semanasKm.map(v => Math.round(v * 10) / 10),
	}
}

export async function montarMaratonasApp() {
	const [strava, relogioTodas, volumeStrava, brutos, provaAlvo] = await Promise.all([
		listarMaratonas(),
		listarCorridasRelogio(RELOGIO_DESDE_DATA),
		db.corrida.findMany({ select: { dataInicio: true, distanciaMetros: true } }),
		db.corrida.findMany({ where: { distanciaMetros: { gt: MARATONA_MIN_M } }, select: { stravaId: true, dadosBrutos: true } }),
		db.provaAlvo.findFirst({ where: { dataProva: { gte: new Date() }, plano: 'maratona' }, orderBy: { dataProva: 'asc' } }),
	])
	const dataLocal = new Map(
		brutos.map(b => [b.stravaId, (b.dadosBrutos as { start_date_local?: string } | null)?.start_date_local?.slice(0, 10)]),
	)
	const volume: CorridaVolume[] = [
		...semDuplicadasDoStrava(volumeStrava, relogioTodas),
		...relogioTodas.map(r => ({ dataInicio: new Date(r.dataInicio), distanciaMetros: r.distanciaMetros })),
	]
	// as maratonas lançadas à mão não contam como começo do histórico de treinos
	const primeiraCorrida = Math.min(
		...volume.filter(v => v.distanciaMetros < MARATONA_MIN_M).map(v => v.dataInicio.getTime()),
		Date.now(),
	)

	const doStrava = semDuplicadasDoStrava(
		strava.map(m => ({ ...m, dataInicio: new Date(m.dataInicioIso) })),
		relogioTodas,
	).map(m => ({ ...m, id: String(m.stravaId), data: dataLocal.get(m.stravaId) ?? m.dataInicioIso.slice(0, 10) }))

	const doRelogio = relogioTodas
		.filter(r => r.distanciaMetros > MARATONA_MIN_M)
		.map(r => ({
			id: r.healthId,
			data: new Date(new Date(r.dataInicio).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10),
			stravaId: 0,
			nome: r.nome,
			dataInicio: new Date(r.dataInicio),
			distanciaMetros: r.distanciaMetros,
			elevacaoGanhoMetros: r.elevacaoGanhoMetros,
			tempoMovimentoSeg: r.tempoMovimentoSeg,
			tempoTotalSeg: r.tempoMovimentoSeg,
			summaryPolyline: r.summaryPolyline,
			localLat: null as number | null,
			localLng: null as number | null,
			frequenciaMedia: r.fcMedia,
			frequenciaMaxima: null as number | null,
			calorias: null as number | null,
			temperaturaMedia: null as number | null,
			elevMinima: null as number | null,
			elevMaxima: null as number | null,
			totalFotos: 0,
			splits: r.splits.length > 1 ? (r.splits as SplitMetric[]) : null,
		}))

	const maratonas = [...doStrava, ...doRelogio]
		.sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime())
		.map((m, i) => {
			const local = LOCAIS_MARATONAS[m.stravaId]
			const gpsImpreciso = m.distanciaMetros / DISTANCIA_MARATONA_M > GPS_IMPRECISO
			const km = m.splits ? acumuladosPorKm(m.splits, m.tempoTotalSeg) : null
			// a leitura usa o tempo corrido (com paradas), o mesmo do tempo final
			const leitura =
				m.splits && km && !gpsImpreciso
					? analisarProva(m.splits.map(s => ({ ...s, moving_time: s.elapsed_time })))
					: null
			// algumas atividades vieram com a data no nome ("12/06/2014 Cancún, Quintana Roo, Mexico")
			const nome = /^\d{2}\/\d{2}\/\d{4}/.test(m.nome) && local ? `Maratona de ${local.cidade}` : m.nome
			return {
				id: m.id,
				stravaId: m.stravaId,
				numero: i + 1,
				nome,
				data: m.data,
				cidade: local?.cidade ?? null,
				pais: local?.pais ?? null,
				codigoPais: local ? (ISO2[local.paisId] ?? null) : null,
				lat: local?.lat ?? m.localLat,
				lng: local?.lng ?? m.localLng,
				tempoSeg: m.tempoTotalSeg,
				paceSeg: m.tempoTotalSeg / (DISTANCIA_MARATONA_M / 1000),
				distanciaGpsM: m.splits ? m.distanciaMetros : null,
				gpsImpreciso,
				// as provas lançadas à mão vieram com 0 m: é ausência de dado, não percurso plano
				elevacaoM: m.splits ? Math.round(m.elevacaoGanhoMetros) : null,
				fcMedia: m.frequenciaMedia,
				fcMaxima: m.frequenciaMaxima,
				calorias: m.calorias,
				temperatura: m.temperaturaMedia,
				polyline: m.summaryPolyline,
				totalFotos: m.totalFotos,
				vponto: Math.round(vpontoDaProva(DISTANCIA_MARATONA_M, m.tempoTotalSeg) * 10) / 10,
				tempoKm: km?.tempoKm ?? null,
				altitudeKm: km?.altitudeKm ?? null,
				fcKm: km?.fcKm ?? null,
				leitura,
				preparo: preparacao(m.dataInicio, volume, primeiraCorrida),
			}
		})

	return {
		maratonas,
		proxima: provaAlvo ? { nome: provaAlvo.nome, data: provaAlvo.dataProva.toISOString().slice(0, 10) } : null,
	}
}
