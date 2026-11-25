// VPONTO (VDOT) de Jack Daniels: fórmulas de Daniels e Gilbert e a Tabela 3.2 do livro
// "Fórmula de corrida de Daniels" (2ª ed.), para derivar as zonas de ritmo de um número só.

/**
 * VPONTO inicial (aprovado em 25/11/2026). O valor em uso fica no banco (modelo ConfigVponto) e é
 * trocado na página /vpontos; este número só vale enquanto nada tiver sido gravado.
 */
export const VPONTO_PADRAO = 42;
export const VPONTO_PADRAO_DESDE = "2026-11-25";
export const VPONTO_PADRAO_ORIGEM = "15k de 01/11, meias de 2026 e treinos recentes";

// ── Fórmulas ──────────────────────────────────────────────────────────────

/** Consumo de O2 (ml/kg/min) para correr a `v` metros por minuto. */
function vo2NaVelocidade(v: number): number {
	return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

/** Velocidade (m/min) que pede um dado consumo de O2. */
function velocidadeDoVo2(vo2: number): number {
	const a = 0.000104;
	const b = 0.182258;
	const c = -4.6 - vo2;
	return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** VPONTO de um desempenho em prova (distância em m, tempo em s). */
export function vpontoDaProva(distanciaM: number, tempoSeg: number): number {
	const t = tempoSeg / 60;
	const v = distanciaM / t;
	const fracao = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
	return vo2NaVelocidade(v) / fracao;
}

/** Pace (seg/km) correspondente a uma fração do VPONTO (1 = 100% do VO2 máx). */
export function paceNaFracao(vponto: number, fracao: number): number {
	return 60000 / velocidadeDoVo2(vponto * fracao);
}

/** Pace (seg/km) em que o VO2 equivale a `vo2` (usado na estimativa pela FC). */
export function paceDoVo2(vo2: number): number {
	return 60000 / velocidadeDoVo2(vo2);
}

/** Consumo de O2 (ml/kg/min) de um pace em seg/km. */
export function vo2DoPace(paceSegKm: number): number {
	return vo2NaVelocidade(60000 / paceSegKm);
}

/**
 * %VO2 máx a partir da %FC máx, ajustado pelos pares da Tabela 2.1 do livro
 * (65→59, 79→74, 88→83, 92→88, 100→98).
 */
export function fracaoVo2PelaFc(fracaoFcMax: number): number {
	return (1.07 * fracaoFcMax * 100 - 10.6) / 100;
}

// ── Tabela 3.2 (seg): F e M por km, L e I por 1.000 m, R por 400 m ─────────

const TABELA_32: Record<number, { F: number; M: number; L: number; I: number; R400: number }> = {
	36: { F: 412, M: 356, L: 333, I: 307, R400: 115 },
	37: { F: 403, M: 348, L: 325, I: 300, R400: 113 },
	38: { F: 395, M: 341, L: 319, I: 294, R400: 110 },
	39: { F: 387, M: 333, L: 312, I: 288, R400: 108 },
	40: { F: 379, M: 327, L: 306, I: 282, R400: 106 },
	41: { F: 372, M: 320, L: 300, I: 276, R400: 104 },
	42: { F: 365, M: 314, L: 294, I: 271, R400: 102 },
	43: { F: 358, M: 308, L: 289, I: 266, R400: 100 },
	44: { F: 352, M: 302, L: 283, I: 261, R400: 98 },
	45: { F: 346, M: 296, L: 278, I: 256, R400: 96 },
	46: { F: 340, M: 291, L: 273, I: 252, R400: 94 },
	47: { F: 334, M: 286, L: 269, I: 247, R400: 92 },
	48: { F: 328, M: 281, L: 264, I: 243, R400: 90 },
	49: { F: 323, M: 276, L: 260, I: 239, R400: 89 },
	50: { F: 318, M: 271, L: 255, I: 235, R400: 87 },
	51: { F: 313, M: 267, L: 251, I: 231, R400: 86 },
	52: { F: 308, M: 262, L: 247, I: 228, R400: 85 },
};

export type RitmosChave = {
	/** fácil / longão, por km */
	F: number;
	/** ritmo de maratona, por km */
	M: number;
	/** limiar, por km */
	L: number;
	/** intervalado (VO2 máx), por km */
	I: number;
	/** repetição, por km (o livro dá por 400 m) */
	R: number;
	/** repetição por 400 m, em segundos */
	R400: number;
};

/** Ritmos-chave do livro para um VPONTO (interpola entre valores inteiros). */
export function ritmosChave(vponto: number): RitmosChave {
	const min = 36;
	const max = 52;
	const v = Math.min(Math.max(vponto, min), max);
	const baixo = Math.floor(v);
	const alto = Math.min(baixo + 1, max);
	const t = v - baixo;
	const lin = (k: "F" | "M" | "L" | "I" | "R400") => TABELA_32[baixo][k] + (TABELA_32[alto][k] - TABELA_32[baixo][k]) * t;
	const r400 = lin("R400");
	return { F: lin("F"), M: lin("M"), L: lin("L"), I: lin("I"), R: r400 * 2.5, R400: r400 };
}

// ── Zonas Z1–Z6 derivadas do VPONTO ───────────────────────────────────────

const arredondar5 = (s: number) => Math.round(s / 5) * 5;

/**
 * Limites das 6 zonas (pace seg/km, lento → rápido), pelas faixas de %VO2 máx de Daniels:
 * Z1/Z2 fácil (65% separa recuperação de rodagem), Z3 M (74–84%), Z4 L (84–92%),
 * Z5 I (92–100%), Z6 R (acima de 100%). Arredondados a 5 s.
 */
export function limitesDasZonas(vponto: number): { lento: number; rapido: number }[] {
	const f65 = arredondar5(paceNaFracao(vponto, 0.65));
	const f74 = arredondar5(paceNaFracao(vponto, 0.74));
	const f84 = arredondar5(paceNaFracao(vponto, 0.84));
	const f92 = arredondar5(paceNaFracao(vponto, 0.92));
	const f100 = arredondar5(paceNaFracao(vponto, 1.0));
	return [
		{ lento: f65 + 60, rapido: f65 },
		{ lento: f65, rapido: f74 },
		{ lento: f74, rapido: f84 },
		{ lento: f84, rapido: f92 },
		{ lento: f92, rapido: f100 },
		{ lento: f100, rapido: f100 - 35 },
	];
}

export function formatarPace(seg: number): string {
	const t = Math.round(seg);
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
