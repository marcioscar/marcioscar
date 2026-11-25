// Zonas de ritmo do atleta, em pace absoluto, derivadas do VPONTO de Jack Daniels (app/lib/vdot.ts).
// Usar em análises de treino.

import { VPONTO_ATUAL, formatarPace, limitesDasZonas, ritmosChave } from "~/lib/vdot";

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

const NOMES_ZONAS: { id: ZonaRitmo["id"]; nome: string }[] = [
	{ id: "Z1", nome: "Recuperação" },
	{ id: "Z2", nome: "Fácil / Longão" },
	{ id: "Z3", nome: "Maratona" },
	{ id: "Z4", nome: "Limiar" },
	{ id: "Z5", nome: "VO2 máx" },
	{ id: "Z6", nome: "Velocidade" },
];

const kmhDoPace = (seg: number) => Math.round((3600 / seg) * 100) / 100;

function montarZonas(vponto: number): ZonaRitmo[] {
	const limites = limitesDasZonas(vponto);
	const k = ritmosChave(vponto);
	const p = formatarPace;
	const usos = [
		"Trote no dia seguinte a treino forte, aquecimento",
		`Maior parte do volume. Ritmo F do livro: ${p(k.F)}. Ritmo da ultra: 5:55–6:10`,
		`Blocos em ritmo de maratona (M do livro: ${p(k.M)})`,
		`Limiar (L do livro: ${p(k.L)}). Cruise intervals e corridas ritmadas. O ritmo de meia fica aqui`,
		`Intervalados de 3 a 5 min (I do livro: ${p(k.I)}). Tiros de 800 m a 1.200 m`,
		`Repetições curtas de 200–400 m e strides (R do livro: ${p(k.R)} por km, ${Math.round(k.R400)} s por 400 m)`,
	];
	return NOMES_ZONAS.map((z, i) => ({
		id: z.id,
		nome: z.nome,
		lentoSeg: limites[i].lento,
		rapidoSeg: limites[i].rapido,
		kmh: [kmhDoPace(limites[i].lento), kmhDoPace(limites[i].rapido)],
		uso: usos[i],
	}));
}

/** Zonas derivadas do VPONTO em uso (ver app/lib/vdot.ts). */
export const ZONAS_RITMO: ZonaRitmo[] = montarZonas(VPONTO_ATUAL);

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
