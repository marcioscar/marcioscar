import { db } from "../../db.server";
import { getInicioSemana } from "~/lib/provaUtils";

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
