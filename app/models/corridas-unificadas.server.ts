import { FOLGA_MESMA_ATIVIDADE_MS, RELOGIO_DESDE_DATA } from "~/lib/fonte-dados";
import { listarCorridasRelogio, type CorridaRelogio } from "~/models/treino-saude.server";
import { listarUltimasCorridas, type CorridaResumo } from "~/models/corridas.server";

/** Corridas do Strava de RELOGIO_DESDE em diante só ficam se o relógio não tiver a mesma. */
export function semDuplicadasDoStrava<T extends { dataInicio: Date }>(
	strava: T[],
	relogio: { dataInicio: string | Date }[],
): T[] {
	const iniciosRelogio = relogio.map((r) => new Date(r.dataInicio).getTime());
	return strava.filter((c) => {
		const t = c.dataInicio.getTime();
		if (t < RELOGIO_DESDE_DATA.getTime()) return true;
		return !iniciosRelogio.some((r) => Math.abs(r - t) <= FOLGA_MESMA_ATIVIDADE_MS);
	});
}

export function corridaRelogioParaResumo(c: CorridaRelogio): CorridaResumo {
	return {
		stravaId: 0,
		chave: `relogio-${c.healthId}`,
		href: `/corridas/relogio/${c.healthId}`,
		nome: c.nome,
		distanciaMetros: c.distanciaMetros,
		elevacaoGanhoMetros: c.elevacaoGanhoMetros,
		tempoMovimentoSeg: c.tempoMovimentoSeg,
		velocidadeMedia: c.tempoMovimentoSeg > 0 ? c.distanciaMetros / c.tempoMovimentoSeg : null,
		frequenciaMedia: c.fcMedia,
		frequenciaMaxima: null,
		summaryPolyline: c.summaryPolyline,
		localLat: null,
		localLng: null,
		dataInicio: new Date(c.dataInicio),
		splits: c.splits.length > 0 ? c.splits : null,
		laps: c.laps.length > 1 ? c.laps : null,
		analise: c.analise ?? null,
		analisadaEm: c.analisadaEm ? new Date(c.analisadaEm) : null,
	};
}

/** Últimas corridas: Strava até 22/11 e Apple Watch de 23/11 em diante. */
export async function listarUltimasCorridasUnificadas(limite: number): Promise<CorridaResumo[]> {
	const [strava, relogio] = await Promise.all([
		listarUltimasCorridas(limite + 5),
		listarCorridasRelogio(RELOGIO_DESDE_DATA),
	]);
	return [...semDuplicadasDoStrava(strava, relogio), ...relogio.map(corridaRelogioParaResumo)]
		.sort((a, b) => b.dataInicio.getTime() - a.dataInicio.getTime())
		.slice(0, limite);
}
