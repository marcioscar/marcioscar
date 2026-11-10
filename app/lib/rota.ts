import { decodePolyline } from "./polyline";

type Coordinate = [number, number]; // [lng, lat]

export type SplitRota = {
	distance: number;
	average_speed: number;
	average_heartrate?: number;
};

export type TrechoRota = {
	coordenadas: Coordinate[];
	cor: string;
};

export type MarcoKm = {
	km: number;
	coordenada: Coordinate;
	paceSegPorKm: number | null;
	frequencia: number | null;
};

export type RotaMontada = {
	trechos: TrechoRota[];
	marcos: MarcoKm[];
	largada: Coordinate;
	chegada: Coordinate;
	// null quando não há splits: a rota sai em uma cor só
	escala: { paceRapido: number; paceLento: number } | null;
};

export const COR_ROTA_PADRAO = "#3b7f86";
// rápido → médio → lento (petróleo, mostarda, terracota do tema)
export const CORES_RITMO = ["#2f7f86", "#d2a53f", "#c2602f"] as const;
const COR_PARADO = "#9a958c";
// abaixo disso o trecho é caminhada/pausa e não entra na escala de cores
const VELOCIDADE_MINIMA_MPS = 1.4;

function metrosEntre(a: Coordinate, b: Coordinate): number {
	const R = 6371000;
	const rad = Math.PI / 180;
	const dLat = (b[1] - a[1]) * rad;
	const dLng = (b[0] - a[0]) * rad;
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

function hexParaRgb(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function misturar(a: string, b: string, t: number): string {
	const [r1, g1, b1] = hexParaRgb(a);
	const [r2, g2, b2] = hexParaRgb(b);
	const canal = (x: number, y: number) =>
		Math.round(x + (y - x) * t)
			.toString(16)
			.padStart(2, "0");
	return `#${canal(r1, r2)}${canal(g1, g2)}${canal(b1, b2)}`;
}

// t = 0 (mais rápido) … 1 (mais lento)
export function corDoRitmo(t: number): string {
	const x = Math.min(1, Math.max(0, t));
	return x <= 0.5
		? misturar(CORES_RITMO[0], CORES_RITMO[1], x * 2)
		: misturar(CORES_RITMO[1], CORES_RITMO[2], (x - 0.5) * 2);
}

export function montarRota(
	polylineCodificada: string,
	distanciaMetros: number,
	splits: SplitRota[] | null,
): RotaMontada | null {
	const pontos = decodePolyline(polylineCodificada);
	if (pontos.length < 2) {
		return null;
	}

	// distância acumulada ao longo da linha
	const acumulado = [0];
	for (let i = 1; i < pontos.length; i++) {
		acumulado.push(acumulado[i - 1] + metrosEntre(pontos[i - 1], pontos[i]));
	}
	const comprimentoLinha = acumulado[acumulado.length - 1];
	if (comprimentoLinha <= 0) {
		return null;
	}

	const splitsValidos = (splits ?? []).filter((s) => s.distance > 0);
	const somaSplits = splitsValidos.reduce((acc, s) => acc + s.distance, 0);

	// A polyline resumida do Strava corta curvas e fica mais curta que a corrida:
	// converte "metros corridos" em "metros na linha" proporcionalmente. Com
	// splits, a soma deles é a referência (pode diferir da distância gravada),
	// para os marcos baterem com a tabela de splits.
	const distanciaReal =
		somaSplits > 0
			? somaSplits
			: distanciaMetros > 0
				? distanciaMetros
				: comprimentoLinha;
	const fator = comprimentoLinha / distanciaReal;

	function pontoEm(metrosNaLinha: number): { coordenada: Coordinate; indice: number } {
		const alvo = Math.min(Math.max(metrosNaLinha, 0), comprimentoLinha);
		let i = 1;
		while (i < acumulado.length - 1 && acumulado[i] < alvo) i++;
		const trecho = acumulado[i] - acumulado[i - 1];
		const t = trecho > 0 ? (alvo - acumulado[i - 1]) / trecho : 0;
		const a = pontos[i - 1];
		const b = pontos[i];
		return {
			coordenada: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
			indice: i,
		};
	}

	function fatiar(inicioReal: number, fimReal: number): Coordinate[] {
		const inicio = pontoEm(inicioReal * fator);
		const fim = pontoEm(fimReal * fator);
		const meio = pontos.slice(inicio.indice, fim.indice);
		return [inicio.coordenada, ...meio, fim.coordenada];
	}

	const trechos: TrechoRota[] = [];
	let escala: RotaMontada["escala"] = null;
	const marcos: MarcoKm[] = [];

	if (splitsValidos.length > 0) {
		const paces = splitsValidos
			.filter((s) => s.average_speed >= VELOCIDADE_MINIMA_MPS)
			.map((s) => 1000 / s.average_speed);
		const paceRapido = paces.length > 0 ? Math.min(...paces) : 0;
		const paceLento = paces.length > 0 ? Math.max(...paces) : 0;
		if (paces.length > 0) {
			escala = { paceRapido, paceLento };
		}

		let percorrido = 0;
		splitsValidos.forEach((split, indice) => {
			const fim = percorrido + split.distance;
			const correndo = split.average_speed >= VELOCIDADE_MINIMA_MPS;
			const pace = correndo ? 1000 / split.average_speed : null;
			const amplitude = paceLento - paceRapido;
			const cor =
				pace === null
					? COR_PARADO
					: corDoRitmo(amplitude > 0 ? (pace - paceRapido) / amplitude : 0);

			trechos.push({ coordenadas: fatiar(percorrido, fim), cor });
			// o marco fica no fim de cada km completo; o último split é parcial
			if (indice < splitsValidos.length - 1) {
				marcos.push({
					km: indice + 1,
					coordenada: pontoEm(fim * fator).coordenada,
					paceSegPorKm: pace,
					frequencia: split.average_heartrate ?? null,
				});
			}
			percorrido = fim;
		});
	} else {
		trechos.push({ coordenadas: pontos, cor: COR_ROTA_PADRAO });
		for (let km = 1; km * 1000 < distanciaReal; km++) {
			marcos.push({
				km,
				coordenada: pontoEm(km * 1000 * fator).coordenada,
				paceSegPorKm: null,
				frequencia: null,
			});
		}
	}

	return {
		trechos,
		marcos,
		largada: pontos[0],
		chegada: pontos[pontos.length - 1],
		escala,
	};
}
