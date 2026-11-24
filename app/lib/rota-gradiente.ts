import { corDoRitmo, CORES_RITMO, VELOCIDADE_MINIMA_MPS } from "~/lib/rota";
import type { RotaDetalhada } from "~/types/rota";

export type ModoCor = "km" | "ritmo" | "fc";

type Coordenada = [number, number];

// FC: azul-claro (baixa) → amarelo → vermelho (alta), vivos como a escala de ritmo
export const CORES_FC = ["#1ab8ff", "#ffd60a", "#ff3b30"] as const;

function hexParaRgb(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function misturar(a: string, b: string, t: number): string {
	const [r1, g1, b1] = hexParaRgb(a);
	const [r2, g2, b2] = hexParaRgb(b);
	const c = (x: number, y: number) =>
		Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
	return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

function corDaFc(t: number): string {
	const x = Math.min(1, Math.max(0, t));
	return x <= 0.5
		? misturar(CORES_FC[0], CORES_FC[1], x * 2)
		: misturar(CORES_FC[1], CORES_FC[2], (x - 0.5) * 2);
}

function percentil(valores: number[], p: number): number {
	const ordenado = [...valores].sort((a, b) => a - b);
	return ordenado[Math.min(ordenado.length - 1, Math.max(0, Math.round(p * (ordenado.length - 1))))];
}

function metrosEntre(a: Coordenada, b: Coordenada): number {
	const R = 6371000;
	const rad = Math.PI / 180;
	const dLat = (b[1] - a[1]) * rad;
	const dLng = (b[0] - a[0]) * rad;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

/** Média móvel simples para tirar o serrilhado do GPS/sensor. */
function suavizar(valores: (number | null)[], janela: number): (number | null)[] {
	return valores.map((_, i) => {
		let soma = 0;
		let n = 0;
		for (let k = Math.max(0, i - janela); k <= Math.min(valores.length - 1, i + janela); k++) {
			const v = valores[k];
			if (v !== null) {
				soma += v;
				n++;
			}
		}
		return n > 0 ? soma / n : null;
	});
}

export type Gradiente = {
	/** [progresso, cor, progresso, cor, ...] para a expressão `line-progress` do Mapbox */
	stops: (number | string)[];
	legenda: { de: string; ate: string; cores: readonly string[]; deRotulo: string; ateRotulo: string };
};

function formatarPace(seg: number): string {
	return `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, "0")}`;
}

/** Cores contínuas ao longo da rota, por ritmo ou por FC. null se não houver dado suficiente. */
export function montarGradiente(
	modo: "ritmo" | "fc",
	coordenadas: Coordenada[],
	detalhe: RotaDetalhada,
): Gradiente | null {
	const n = coordenadas.length;
	if (n < 2) return null;

	const bruto = modo === "ritmo" ? detalhe.vel : detalhe.fc;
	if (!bruto || bruto.length !== n) return null;

	// ritmo: ignora trechos parados/caminhando (velocidade abaixo do mínimo)
	const valores: (number | null)[] = bruto.map((v) =>
		modo === "ritmo" ? (v >= VELOCIDADE_MINIMA_MPS ? 1000 / v : null) : v > 0 ? v : null,
	);
	const suaves = suavizar(valores, modo === "ritmo" ? 6 : 4);
	const validos = suaves.filter((v): v is number => v !== null);
	if (validos.length < 2) return null;

	const baixo = percentil(validos, 0.05);
	const alto = percentil(validos, 0.95);
	const amplitude = alto - baixo || 1;

	// distância acumulada → progresso (0..1) de cada ponto ao longo da linha
	const acumulado = [0];
	for (let i = 1; i < n; i++) acumulado.push(acumulado[i - 1] + metrosEntre(coordenadas[i - 1], coordenadas[i]));
	const total = acumulado[n - 1] || 1;

	const cor = (v: number | null): string => {
		if (v === null) return "#9a958c";
		const t = (v - baixo) / amplitude;
		// ritmo: pace menor = mais rápido = t 0 (verde-azulado); FC: maior = mais forte
		return modo === "ritmo" ? corDoRitmo(t) : corDaFc(t);
	};

	// no máximo ~180 paradas: mais que isso o Mapbox não ganha detalhe visível
	const passos = Math.min(180, n);
	const stops: (number | string)[] = [];
	let ultimo = -1;
	for (let k = 0; k < passos; k++) {
		const i = Math.round((k * (n - 1)) / (passos - 1));
		let progresso = acumulado[i] / total;
		if (progresso <= ultimo) progresso = ultimo + 1e-6; // precisa ser estritamente crescente
		if (progresso > 1) continue;
		stops.push(progresso, cor(suaves[i]));
		ultimo = progresso;
	}
	if (stops.length < 4) return null;

	return {
		stops,
		legenda:
			modo === "ritmo"
				? {
						de: "Mais rápido",
						ate: "Mais lento",
						cores: CORES_RITMO,
						deRotulo: formatarPace(baixo),
						ateRotulo: formatarPace(alto),
					}
				: {
						de: "FC baixa",
						ate: "FC alta",
						cores: CORES_FC,
						deRotulo: `${Math.round(baixo)} bpm`,
						ateRotulo: `${Math.round(alto)} bpm`,
					},
	};
}
