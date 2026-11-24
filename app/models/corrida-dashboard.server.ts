import { db } from "../../db.server";
import { getInicioSemana } from "~/lib/provaUtils";
import { calcularCargaTreino, DIAS_HISTORICO, type CargaTreino } from "~/lib/carga-treino";

export type VolumeSemanaItem = {
	inicioSemana: string;
	label: string;
	km: number;
	emAndamento: boolean;
};

function formatarLabelSemana(inicio: Date): string {
	return inicio.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		timeZone: "UTC",
	});
}

export async function obterTendenciaVolumeSemanal(
	semanas = 8,
): Promise<VolumeSemanaItem[]> {
	const hojeInicioSemana = getInicioSemana();
	const primeiraSemana = new Date(hojeInicioSemana);
	primeiraSemana.setUTCDate(primeiraSemana.getUTCDate() - (semanas - 1) * 7);

	const corridas = await db.corrida.findMany({
		where: { dataInicio: { gte: primeiraSemana } },
		select: { dataInicio: true, distanciaMetros: true },
	});

	const acumuladoPorSemana = new Map<string, number>();
	for (const corrida of corridas) {
		const chave = getInicioSemana(corrida.dataInicio).toISOString();
		acumuladoPorSemana.set(
			chave,
			(acumuladoPorSemana.get(chave) ?? 0) + corrida.distanciaMetros / 1000,
		);
	}

	const serie: VolumeSemanaItem[] = [];
	for (let i = 0; i < semanas; i++) {
		const inicio = new Date(primeiraSemana);
		inicio.setUTCDate(inicio.getUTCDate() + i * 7);
		const km = acumuladoPorSemana.get(inicio.toISOString()) ?? 0;

		serie.push({
			inicioSemana: inicio.toISOString(),
			label: formatarLabelSemana(inicio),
			km: Math.round(km * 10) / 10,
			emAndamento: inicio.getTime() === hojeInicioSemana.getTime(),
		});
	}

	return serie;
}

export type CorridaSemanaAtual = {
	stravaId: number;
	nome: string;
	dataInicio: Date;
	distanciaMetros: number;
	tempoMovimentoSeg: number;
	frequenciaMedia: number | null;
};

export type ResumoSemanaAtual = {
	kmSemana: number;
	sessoes: CorridaSemanaAtual[];
};

export async function obterResumoSemanaAtual(): Promise<ResumoSemanaAtual> {
	const inicioSemana = getInicioSemana();

	const corridas = await db.corrida.findMany({
		where: { dataInicio: { gte: inicioSemana } },
		orderBy: { dataInicio: "asc" },
		select: {
			stravaId: true,
			nome: true,
			dataInicio: true,
			distanciaMetros: true,
			tempoMovimentoSeg: true,
			frequenciaMedia: true,
		},
	});

	const kmSemana = corridas.reduce((soma, c) => soma + c.distanciaMetros / 1000, 0);

	return {
		kmSemana: Math.round(kmSemana * 10) / 10,
		sessoes: corridas,
	};
}

/** Carga de treino e relação aguda:crônica dos últimos 7 dias (a média exponencial usa ~120 dias de histórico). */
export async function obterCargaTreino(): Promise<CargaTreino> {
	const dia = 24 * 3600 * 1000;
	const [corridas, fcMax] = await Promise.all([
		db.corrida.findMany({
			where: { dataInicio: { gte: new Date(Date.now() - DIAS_HISTORICO * dia) } },
			select: {
				dataInicio: true,
				tempoMovimentoSeg: true,
				frequenciaMedia: true,
				distanciaMetros: true,
				elevacaoGanhoMetros: true,
			},
		}),
		db.corrida.aggregate({
			where: { dataInicio: { gte: new Date(Date.now() - 365 * dia) } },
			_max: { frequenciaMaxima: true },
		}),
	]);

	// sem FC registrada em nenhuma corrida, a referência não importa (usa fração padrão)
	return calcularCargaTreino(corridas, fcMax._max.frequenciaMaxima ?? 185);
}

/** FC máxima de referência: o maior pico registrado nos últimos 12 meses (190 se não houver). */
export async function obterFcMaximaReferencia(): Promise<number> {
	const r = await db.corrida.aggregate({
		where: { dataInicio: { gte: new Date(Date.now() - 365 * 24 * 3600 * 1000) } },
		_max: { frequenciaMaxima: true },
	});
	return r._max.frequenciaMaxima ?? 190;
}
