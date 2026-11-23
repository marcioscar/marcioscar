// Zonas de ritmo do atleta (Canova + Jack Daniels), em pace absoluto.
// Fonte: tabela combinada com o Marcio; usar em análises de treino.

export type ZonaRitmo = {
	id: "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | "Z6";
	nome: string;
	/** pace mais lento da faixa, em seg/km */
	lentoSeg: number;
	/** pace mais rápido da faixa, em seg/km */
	rapidoSeg: number;
	/** velocidade em km/h nos dois extremos da faixa (lenta, rápida) */
	kmh: [number, number];
	uso: string;
};

export const ZONAS_RITMO: ZonaRitmo[] = [
	{ id: "Z1", nome: "Recuperação", lentoSeg: 435, rapidoSeg: 390, kmh: [8.28, 9.23], uso: "Trote no dia seguinte a treino forte, aquecimento" },
	{ id: "Z2", nome: "Fácil / Longão", lentoSeg: 390, rapidoSeg: 345, kmh: [9.23, 10.43], uso: "Maior parte do volume. Ritmo da ultra: 5:55–6:10" },
	{ id: "Z3", nome: "Maratona", lentoSeg: 345, rapidoSeg: 305, kmh: [10.43, 11.8], uso: "Blocos em ritmo M: 5:15–5:20" },
	{ id: "Z4", nome: "Limiar", lentoSeg: 305, rapidoSeg: 280, kmh: [11.8, 12.86], uso: "Intervalos de limiar (cruise intervals): 4:45–4:50. O ritmo de meia fica aqui" },
	{ id: "Z5", nome: "VO2 máx", lentoSeg: 280, rapidoSeg: 255, kmh: [12.86, 14.12], uso: "Tiros de 800 m a 1.200 m: ~4:25" },
	{ id: "Z6", nome: "Velocidade", lentoSeg: 255, rapidoSeg: 230, kmh: [14.12, 15.65], uso: "Tiros curtos de 200–400 m e strides" },
];

function paceStr(seg: number): string {
	return `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
}

/** Zona de um pace (seg/km). Mais lento que Z1 → Z1; mais rápido que Z6 → Z6. */
export function zonaDoPace(paceSegPorKm: number): ZonaRitmo {
	for (const z of ZONAS_RITMO) {
		if (paceSegPorKm > z.rapidoSeg) return z;
	}
	return ZONAS_RITMO[ZONAS_RITMO.length - 1];
}

/** Bloco de texto para os prompts de análise. */
export function tabelaZonasParaPrompt(): string {
	return ZONAS_RITMO.map(
		(z) => `- ${z.id} ${z.nome}: ${paceStr(z.lentoSeg)}–${paceStr(z.rapidoSeg)} /km (${z.kmh[0]}–${z.kmh[1]} km/h). ${z.uso}`,
	).join("\n");
}
