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
