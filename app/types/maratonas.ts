import type { SplitMetric } from "./analise";

export type MaratonaDetalhada = {
	stravaId: number;
	nome: string;
	dataInicioIso: string;
	distanciaMetros: number;
	elevacaoGanhoMetros: number;
	tempoMovimentoSeg: number;
	/** Tempo total da prova (elapsed), em segundos */
	tempoTotalSeg: number;
	paceMedioSegPorKm: number | null;
	summaryPolyline: string | null;
	localLat: number | null;
	localLng: number | null;
	frequenciaMedia: number | null;
	frequenciaMaxima: number | null;
	calorias: number | null;
	temperaturaMedia: number | null;
	elevMinima: number | null;
	elevMaxima: number | null;
	totalFotos: number;
	/** null = ainda não buscados no Strava */
	splits: SplitMetric[] | null;
};
