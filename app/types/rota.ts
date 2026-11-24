/**
 * Rota de uma corrida em alta resolução. `polyline` e os vetores têm o mesmo número de pontos,
 * na mesma ordem: alt[i], vel[i] e fc[i] pertencem ao ponto i da polyline.
 */
export type RotaDetalhada = {
	polyline: string
	/** altitude em metros */
	alt?: number[]
	/** velocidade em m/s */
	vel?: number[]
	/** frequência cardíaca em bpm */
	fc?: number[]
}

/** Quantos pontos guardamos por rota (as corridas longas chegam a 10 mil+ no GPS). */
export const MAX_PONTOS_ROTA = 1500
