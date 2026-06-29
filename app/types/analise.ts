export type SplitMetric = {
	split: number
	distance: number
	elapsed_time: number
	moving_time: number
	elevation_difference: number
	average_speed: number
	average_heartrate?: number
	pace_zone?: number
}

export type LapData = {
	lap_index: number
	name: string
	distance: number
	elapsed_time: number
	moving_time: number
	average_speed: number
	max_speed?: number
	average_heartrate?: number
	max_heartrate?: number
	total_elevation_gain?: number
	pace_zone?: number
}

export type AnalyzeApiResponse = {
	analise: AnaliseResult
	splits: SplitMetric[]
	laps: LapData[]
}

export type BuscarDetalhesResponse = {
	splits: SplitMetric[]
	laps: LapData[]
}

export type AnaliseResult = {
	tipoSessao: string
	avaliacao: 'excelente' | 'bom' | 'regular' | 'ruim'
	resumo: string
	pontosPositivos: string[]
	pontosAtencao: string[]
	alinhamentoCanova: string
	recomendacao: string
}

export type AnaliseInput = {
	stravaId: number
	corrida: {
		nome: string
		distanciaKm: number
		paceSegPorKm: number
		tempoSeg: number
		elevacaoMetros: number
		dataInicio: string
	}
	provaAlvo?: {
		plano: string
		paceAlvo: string
		kmSemanais: number
		dataProva: string
	} | null
}
