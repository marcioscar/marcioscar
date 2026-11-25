import { montarDadosGrafico } from '~/lib/dados-grafico-rota'
import { garantirVponto } from '~/models/vdot-config.server'
import { obterMarca } from '~/models/treino-marca.server'
import {
	compararKmComPlano,
	compararPlanoExecutado,
	resumirComparacao,
	textoPrescrito,
	type LinhaComparacao,
	type ResumoComparacao,
} from '~/lib/treino-manual'
import { tempoPorZona, type TempoPorZona } from '~/lib/tempo-por-zona'
import { obterFcMaximaReferencia } from '~/models/corrida-dashboard.server'
import {
	buscarTreinoSaudePorId,
	listarCorridasRelogio,
	paraCorridaRelogio,
	planejadoDoDia,
	type CorridaRelogio,
} from '~/models/treino-saude.server'
import type { RotaDetalhada } from '~/types/rota'

// ── Lista para o app do iPhone ──────────────────────────────────────────────

export type ResumoCorridaApp = {
	id: string
	nome: string
	dataInicio: string
	distanciaM: number
	tempoSeg: number
	paceSegKm: number | null
	fcMedia: number | null
	/** tipo de sessão da análise por IA, quando existe */
	tipoSessao: string | null
}

export async function listarResumosParaApp(limite: number): Promise<ResumoCorridaApp[]> {
	const corridas = await listarCorridasRelogio(new Date('2026-01-01T00:00:00Z'))
	return corridas
		.sort((a, b) => b.dataInicio.localeCompare(a.dataInicio))
		.slice(0, limite)
		.map((c: CorridaRelogio) => ({
			id: c.healthId,
			nome: c.nome,
			dataInicio: c.dataInicio,
			distanciaM: c.distanciaMetros,
			tempoSeg: c.tempoMovimentoSeg,
			paceSegKm: c.distanciaMetros > 0 ? c.tempoMovimentoSeg / (c.distanciaMetros / 1000) : null,
			fcMedia: c.fcMedia,
			tipoSessao: ((c.analise as { tipoSessao?: string } | null)?.tipoSessao) ?? null,
		}))
}

// ── Detalhe de uma corrida ──────────────────────────────────────────────────

export type ResultadoCorridaApp = {
	id: string
	nome: string
	dataInicio: string
	distanciaM: number
	tempoSeg: number
	duracaoTotalSeg: number
	elevacaoGanhoM: number | null
	paceSegKm: number | null
	metricas: {
		fcMedia: number | null
		fcMaxima: number | null
		caloriasKcal: number | null
		cadencia: number | null
		potenciaW: number | null
		passadaM: number | null
		oscilacaoCm: number | null
		contatoMs: number | null
	}
	/** rota para o mapa */
	polyline: string | null
	/** série ao longo da corrida (distância em km), já suavizada */
	serie: { km: number; pace: number | null; fc: number | null; alt: number | null }[]
	splits: { km: number; distanciaM: number; tempoSeg: number; fcMedia: number | null }[]
	voltas: {
		rotulo: string
		distanciaM: number
		tempoSeg: number
		fcMedia: number | null
		potenciaW: number | null
		cadencia: number | null
	}[]
	zonas: TempoPorZona
	planejado: { titulo: string; texto: string } | null
	comparacao: { base: 'etapa' | 'km'; linhas: LinhaComparacao[]; resumo: ResumoComparacao } | null
	analise: unknown
	analisadaEm: string | null
}

export async function montarResultadoParaApp(healthId: string): Promise<ResultadoCorridaApp | null> {
	await garantirVponto()
	const t = await buscarTreinoSaudePorId(healthId)
	if (!t) return null

	const plano = await planejadoDoDia(t.inicio, t.tipo)
	const corrida = paraCorridaRelogio(t, plano, await obterMarca(t.healthId))
	const fcMax = Math.max(await obterFcMaximaReferencia(), t.fcMaxima ?? 0)
	const detalhe: RotaDetalhada | null = t.polyline
		? ({ polyline: t.polyline, ...((t.rota as Record<string, number[]> | null) ?? {}) } as RotaDetalhada)
		: null

	const voltasCmp = corrida.laps.map(l => ({ distanciaM: l.distance, tempoSeg: l.moving_time }))
	const splitsCmp = corrida.splits.map(s => ({ km: s.split, distanciaM: s.distance, tempoSeg: s.moving_time }))
	let comparacao: ResultadoCorridaApp['comparacao'] = null
	if (plano) {
		const porEtapa = voltasCmp.length > 1 ? compararPlanoExecutado(plano, voltasCmp) : null
		const linhas = porEtapa ?? compararKmComPlano(plano, splitsCmp)
		if (linhas) comparacao = { base: porEtapa ? 'etapa' : 'km', linhas, resumo: resumirComparacao(linhas) }
	}

	return {
		id: t.healthId,
		nome: corrida.nome,
		dataInicio: corrida.dataInicio,
		distanciaM: corrida.distanciaMetros,
		tempoSeg: corrida.tempoMovimentoSeg,
		duracaoTotalSeg: Math.round((t.fim.getTime() - t.inicio.getTime()) / 1000),
		elevacaoGanhoM: t.elevacaoGanhoM,
		paceSegKm: corrida.distanciaMetros > 0 ? corrida.tempoMovimentoSeg / (corrida.distanciaMetros / 1000) : null,
		metricas: {
			fcMedia: t.fcMedia,
			fcMaxima: t.fcMaxima,
			caloriasKcal: t.caloriasKcal,
			cadencia: t.cadenciaMedia,
			potenciaW: t.potenciaMediaW,
			passadaM: t.passadaM,
			oscilacaoCm: t.oscilacaoVerticalCm,
			contatoMs: t.contatoSoloMs,
		},
		polyline: t.polyline,
		serie: detalhe ? montarDadosGrafico(detalhe, corrida.distanciaMetros, corrida.distanciaMetros < 12000 ? 'pouca' : 'media') : [],
		splits: corrida.splits.map(s => ({
			km: s.split,
			distanciaM: s.distance,
			tempoSeg: s.moving_time,
			fcMedia: s.average_heartrate ?? null,
		})),
		voltas: corrida.laps.map(l => ({
			rotulo: l.name,
			distanciaM: l.distance,
			tempoSeg: l.moving_time,
			fcMedia: l.average_heartrate ?? null,
			potenciaW: l.potenciaW ?? null,
			cadencia: l.cadencia ?? null,
		})),
		zonas: detalhe ? tempoPorZona(detalhe, corrida.tempoMovimentoSeg, fcMax) : { pace: null, fc: null, fcMaxima: fcMax },
		planejado: plano ? { titulo: plano.titulo, texto: textoPrescrito(plano) } : null,
		comparacao,
		analise: t.analise ?? null,
		analisadaEm: t.analisadaEm ? t.analisadaEm.toISOString() : null,
	}
}
