import type { SplitMetric } from "~/types/analise";

export type LeituraProva = {
	/** tempo em movimento até a metade da distância, em segundos */
	primeiraMetadeSeg: number;
	segundaMetadeSeg: number;
	/** segunda − primeira: positivo = perdeu ritmo, negativo = acelerou */
	diferencaSeg: number;
	tipo: "negativo" | "positivo" | "parelho";
	/** primeiro km (≥ 22) em que o ritmo caiu e não voltou, ou null */
	kmQueda: number | null;
	/** pace de referência (mediana dos km 5 a 20), em s/km */
	paceBaseSeg: number | null;
};

// diferença entre as metades até 2,5% da primeira conta como ritmo parelho
const TOLERANCIA_PARELHO = 0.025;
const LIMIAR_QUEDA_SEG = 20;

function paceDoSplit(s: SplitMetric): number {
	return (s.moving_time / s.distance) * 1000;
}

function mediana(valores: number[]): number {
	const ordenados = [...valores].sort((a, b) => a - b);
	const meio = Math.floor(ordenados.length / 2);
	return ordenados.length % 2 === 0
		? (ordenados[meio - 1] + ordenados[meio]) / 2
		: ordenados[meio];
}

export function analisarProva(splits: SplitMetric[]): LeituraProva | null {
	const validos = splits.filter((s) => s.distance > 0 && s.moving_time > 0);
	if (validos.length < 10) return null;

	const distanciaTotal = validos.reduce((acc, s) => acc + s.distance, 0);
	const meio = distanciaTotal / 2;

	let percorrido = 0;
	let primeira = 0;
	for (const s of validos) {
		if (percorrido + s.distance <= meio) {
			primeira += s.moving_time;
			percorrido += s.distance;
			continue;
		}
		// o split que cruza a metade entra proporcionalmente
		primeira += s.moving_time * ((meio - percorrido) / s.distance);
		break;
	}
	const tempoTotal = validos.reduce((acc, s) => acc + s.moving_time, 0);
	const segunda = tempoTotal - primeira;
	const diferenca = segunda - primeira;

	// só km cheios entram na leitura de queda (o último split costuma ser parcial)
	const kmCheios = validos.filter((s) => s.distance >= 900);
	const referencia = kmCheios.slice(4, 20).map(paceDoSplit);
	const paceBase = referencia.length >= 8 ? mediana(referencia) : null;

	let kmQueda: number | null = null;
	if (paceBase !== null) {
		const paces = kmCheios.map(paceDoSplit);
		for (let i = 21; i < paces.length - 2; i++) {
			const sustentado = [paces[i], paces[i + 1], paces[i + 2]].every(
				(p) => p > paceBase + LIMIAR_QUEDA_SEG,
			);
			if (sustentado) {
				kmQueda = i + 1;
				break;
			}
		}
	}

	return {
		primeiraMetadeSeg: Math.round(primeira),
		segundaMetadeSeg: Math.round(segunda),
		diferencaSeg: Math.round(diferenca),
		tipo:
			diferenca < -primeira * TOLERANCIA_PARELHO
				? "negativo"
				: diferenca > primeira * TOLERANCIA_PARELHO
					? "positivo"
					: "parelho",
		kmQueda,
		paceBaseSeg: paceBase !== null ? Math.round(paceBase) : null,
	};
}
