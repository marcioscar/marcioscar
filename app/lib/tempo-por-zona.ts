import { VELOCIDADE_MINIMA_MPS } from "~/lib/rota";
import { ZONAS_RITMO, zonaDoPace } from "~/lib/zonas-pace";
import type { RotaDetalhada } from "~/types/rota";

export type LinhaZona = {
	id: string;
	nome: string;
	/** faixa em texto: pace (ex.: "5:45–5:05 /km") ou bpm (ex.: "114–133 bpm") */
	faixa: string;
	pct: number;
	seg: number;
	/** índice 1..6 (pace) ou 1..5 (FC), para escolher a cor */
	ordem: number;
};

export type TempoPorZona = {
	pace: LinhaZona[] | null;
	fc: LinhaZona[] | null;
	fcMaxima: number;
};

/** Zonas de FC por % da FC máxima (esquema comum de 5 zonas). */
const ZONAS_FC = [
	{ id: "Z1", nome: "Recuperação", de: 0, ate: 0.6 },
	{ id: "Z2", nome: "Aeróbico leve", de: 0.6, ate: 0.7 },
	{ id: "Z3", nome: "Aeróbico", de: 0.7, ate: 0.8 },
	{ id: "Z4", nome: "Limiar", de: 0.8, ate: 0.9 },
	{ id: "Z5", nome: "Máximo", de: 0.9, ate: 2 },
] as const;

function paceTexto(seg: number): string {
	return `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, "0")}`;
}

function suavizar(v: number[], janela: number): number[] {
	return v.map((_, i) => {
		let soma = 0;
		let n = 0;
		for (let k = Math.max(0, i - janela); k <= Math.min(v.length - 1, i + janela); k++) {
			soma += v[k];
			n++;
		}
		return soma / n;
	});
}

/**
 * Tempo em cada zona. Os pontos da rota são igualmente espaçados no tempo (o GPS grava um por segundo
 * e escolhemos índices uniformes), então a fatia de pontos de cada zona aproxima a fatia do tempo.
 */
export function tempoPorZona(detalhe: RotaDetalhada, tempoTotalSeg: number, fcMaxima: number): TempoPorZona {
	const n = detalhe.vel?.length ?? detalhe.fc?.length ?? 0;
	let pace: LinhaZona[] | null = null;
	let fc: LinhaZona[] | null = null;

	if (detalhe.vel && detalhe.vel.length > 10) {
		const vel = suavizar(detalhe.vel, 2);
		const contagem = new Array(ZONAS_RITMO.length).fill(0) as number[];
		let parado = 0;
		for (const v of vel) {
			if (v < VELOCIDADE_MINIMA_MPS) parado++;
			else contagem[ZONAS_RITMO.findIndex((z) => z.id === zonaDoPace(1000 / v).id)]++;
		}
		const total = vel.length;
		pace = ZONAS_RITMO.map((z, i) => ({
			id: z.id,
			nome: z.nome,
			faixa: `${paceTexto(z.lentoSeg)}–${paceTexto(z.rapidoSeg)} /km`,
			pct: (contagem[i] / total) * 100,
			seg: (contagem[i] / total) * tempoTotalSeg,
			ordem: i + 1,
		}));
		if (parado / total >= 0.01) {
			pace.unshift({
				id: "—",
				nome: "Parado ou caminhando",
				faixa: "mais lento que 11:55 /km",
				pct: (parado / total) * 100,
				seg: (parado / total) * tempoTotalSeg,
				ordem: 0,
			});
		}
	}

	if (detalhe.fc && detalhe.fc.length > 10 && fcMaxima > 0) {
		const contagem = new Array(ZONAS_FC.length).fill(0) as number[];
		let validos = 0;
		for (const bpm of detalhe.fc) {
			if (bpm <= 0) continue;
			const frac = bpm / fcMaxima;
			contagem[ZONAS_FC.findIndex((z) => frac >= z.de && frac < z.ate)]++;
			validos++;
		}
		if (validos > 0) {
			fc = ZONAS_FC.map((z, i) => ({
				id: z.id,
				nome: z.nome,
				faixa:
					z.id === "Z1"
						? `abaixo de ${Math.round(fcMaxima * z.ate)} bpm`
						: z.id === "Z5"
							? `acima de ${Math.round(fcMaxima * z.de)} bpm`
							: `${Math.round(fcMaxima * z.de)}–${Math.round(fcMaxima * z.ate)} bpm`,
				pct: (contagem[i] / validos) * 100,
				seg: (contagem[i] / validos) * tempoTotalSeg,
				ordem: i + 1,
			}));
		}
	}

	void n;
	return { pace, fc, fcMaxima };
}
