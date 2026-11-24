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

function suavizar(valores: (number | null)[], janela: number): (number | null)[] {
	return valores.map((v, i) => {
		if (v === null) return null;
		let soma = 0;
		let n = 0;
		for (let k = Math.max(0, i - janela); k <= Math.min(valores.length - 1, i + janela); k++) {
			const x = valores[k];
			if (x !== null) {
				soma += x;
				n++;
			}
		}
		return n > 0 ? soma / n : null;
	});
}

/**
 * Série pace / FC / altitude contra a distância, a partir da rota de alta resolução.
 * A distância é escalada para bater com a distância oficial da corrida.
 */
export function montarDadosGrafico(detalhe: RotaDetalhada, distanciaMetros: number): PontoGrafico[] {
	const coords = decodePolyline(detalhe.polyline);
	const n = coords.length;
	if (n < 2) return [];

	const acumulado = [0];
	for (let i = 1; i < n; i++) acumulado.push(acumulado[i - 1] + metrosEntre(coords[i - 1], coords[i]));
	const comprimento = acumulado[n - 1] || 1;
	const escala = distanciaMetros > 0 ? distanciaMetros / comprimento : 1;

	const ok = (v: number[] | undefined): v is number[] => !!v && v.length === n;
	const paces = suavizar(
		ok(detalhe.vel) ? detalhe.vel.map((v) => (v >= VELOCIDADE_MINIMA_MPS ? 1000 / v : null)) : Array(n).fill(null),
		5,
	);
	const fcs = suavizar(ok(detalhe.fc) ? detalhe.fc.map((v) => (v > 0 ? v : null)) : Array(n).fill(null), 3);
	const alts = suavizar(ok(detalhe.alt) ? detalhe.alt.map((v) => v) : Array(n).fill(null), 3);

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
