import { decodePolyline } from "~/lib/polyline";
import { VELOCIDADE_MINIMA_MPS } from "~/lib/rota";
import type { RotaDetalhada } from "~/types/rota";

export type PontoGrafico = {
	km: number;
	/** seg/km; null quando parado ou caminhando */
	pace: number | null;
	fc: number | null;
	alt: number | null;
};

function metrosEntre(a: [number, number], b: [number, number]): number {
	const R = 6371000;
	const rad = Math.PI / 180;
	const dLat = (b[1] - a[1]) * rad;
	const dLng = (b[0] - a[0]) * rad;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Média de uma série dentro de uma janela em metros (centrada em cada ponto), usando a distância
 * acumulada de cada ponto. Janela por distância dá o mesmo grau de suavização em corridas curtas e longas,
 * coisa que uma janela fixa de "pontos" não faz.
 */
function suavizarPorDistancia(
	valores: (number | null)[],
	distancias: number[],
	janelaMetros: number,
): (number | null)[] {
	const metade = janelaMetros / 2;
	const saida: (number | null)[] = new Array(valores.length).fill(null);
	let ini = 0;
	let fim = 0;
	for (let i = 0; i < valores.length; i++) {
		if (valores[i] === null) continue;
		while (distancias[ini] < distancias[i] - metade) ini++;
		while (fim + 1 < distancias.length && distancias[fim + 1] <= distancias[i] + metade) fim++;
		let soma = 0;
		let n = 0;
		for (let k = ini; k <= fim; k++) {
			const v = valores[k];
			if (v !== null) {
				soma += v;
				n++;
			}
		}
		saida[i] = n > 0 ? soma / n : null;
	}
	return saida;
}

export type Suavizacao = "pouca" | "media" | "alta";
/** Janela de suavização do pace, em metros. */
export const JANELA_PACE_M: Record<Suavizacao, number> = { pouca: 100, media: 300, alta: 800 };

/**
 * Série pace / FC / altitude contra a distância, a partir da rota de alta resolução.
 * A distância é escalada para bater com a distância oficial da corrida.
 */
export function montarDadosGrafico(
	detalhe: RotaDetalhada,
	distanciaMetros: number,
	suavizacao: Suavizacao = "media",
): PontoGrafico[] {
	const coords = decodePolyline(detalhe.polyline);
	const n = coords.length;
	if (n < 2) return [];

	const acumulado = [0];
	for (let i = 1; i < n; i++) acumulado.push(acumulado[i - 1] + metrosEntre(coords[i - 1], coords[i]));
	const comprimento = acumulado[n - 1] || 1;
	const escala = distanciaMetros > 0 ? distanciaMetros / comprimento : 1;

	const ok = (v: number[] | undefined): v is number[] => !!v && v.length === n;
	// distância de cada ponto já na escala oficial da corrida (em metros)
	const dist = acumulado.map((m) => m * escala);

	// pace: média das VELOCIDADES na janela (média de paces distorce) e só depois vira pace
	const velocidades = ok(detalhe.vel)
		? detalhe.vel.map((v) => (v >= VELOCIDADE_MINIMA_MPS ? v : null))
		: new Array(n).fill(null);
	const velSuave = suavizarPorDistancia(velocidades, dist, JANELA_PACE_M[suavizacao]);
	const paces = velSuave.map((v) => (v !== null ? 1000 / v : null));
	const fcs = suavizarPorDistancia(ok(detalhe.fc) ? detalhe.fc.map((v) => (v > 0 ? v : null)) : new Array(n).fill(null), dist, 150);
	const alts = suavizarPorDistancia(ok(detalhe.alt) ? detalhe.alt.map((v) => v) : new Array(n).fill(null), dist, 100);

	// ~400 pontos bastam para o gráfico e deixam o navegador leve
	const passo = Math.max(1, Math.floor(n / 400));
	const saida: PontoGrafico[] = [];
	for (let i = 0; i < n; i += passo) {
		saida.push({
			km: (acumulado[i] * escala) / 1000,
			pace: paces[i] !== null ? Math.round(paces[i]!) : null,
			fc: fcs[i] !== null ? Math.round(fcs[i]!) : null,
			alt: alts[i] !== null ? Math.round(alts[i]! * 10) / 10 : null,
		});
	}
	return saida;
}
