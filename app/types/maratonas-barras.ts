export type MaratonaBarrasDado = {
	stravaId: number;
	nome: string;
	nomeCurto: string;
	dataInicioIso: string;
	/** Rótulo curto para o eixo X (data + nome) */
	label: string;
	/** Tempo total da prova (elapsed), em segundos */
	tempoTerminoSeg: number;
	/** Pace médio em segundos por km (tempo em movimento / distância) */
	paceMedioSegPorKm: number | null;
};
