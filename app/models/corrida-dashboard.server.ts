import { db } from "../../db.server";
import { getInicioSemana } from "~/lib/provaUtils";
import { calcularCargaTreino, DIAS_HISTORICO, type CargaTreino } from "~/lib/carga-treino";
import { RELOGIO_DESDE_DATA } from "~/lib/fonte-dados";
import { semDuplicadasDoStrava } from "~/models/corridas-unificadas.server";
import { listarCorridasRelogio } from "~/models/treino-saude.server";

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

	const [corridasStrava, corridasRelogio] = await Promise.all([
		db.corrida.findMany({
			where: { dataInicio: { gte: primeiraSemana } },
			select: { dataInicio: true, distanciaMetros: true },
		}),
		listarCorridasRelogio(RELOGIO_DESDE_DATA, primeiraSemana),
	]);
	// de 23/11 em diante a fonte é o relógio; o Strava só entra se o relógio não tiver a mesma corrida
	const corridas = [
		...semDuplicadasDoStrava(corridasStrava, corridasRelogio),
		...corridasRelogio.map((r) => ({ dataInicio: new Date(r.dataInicio), distanciaMetros: r.distanciaMetros })),
	];

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
	/** só nas corridas do relógio: chave única e página de detalhe */
	chave?: string;
	href?: string;
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

	const [doStrava, doRelogio] = await Promise.all([
		db.corrida.findMany({
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
		}),
		listarCorridasRelogio(RELOGIO_DESDE_DATA, inicioSemana),
	]);

	const corridas: CorridaSemanaAtual[] = [
		...semDuplicadasDoStrava(doStrava, doRelogio),
		...doRelogio.map((r) => ({
			stravaId: 0,
			chave: `relogio-${r.healthId}`,
			href: `/corridas/relogio/${r.healthId}`,
			nome: r.nome,
			dataInicio: new Date(r.dataInicio),
			distanciaMetros: r.distanciaMetros,
			tempoMovimentoSeg: r.tempoMovimentoSeg,
			frequenciaMedia: r.fcMedia,
		})),
	].sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime());

	const kmSemana = corridas.reduce((soma, c) => soma + c.distanciaMetros / 1000, 0);

	return {
		kmSemana: Math.round(kmSemana * 10) / 10,
		sessoes: corridas,
	};
}

/** Carga de treino e relação aguda:crônica dos últimos 7 dias (a média exponencial usa ~120 dias de histórico). */
export async function obterCargaTreino(): Promise<CargaTreino> {
	const dia = 24 * 3600 * 1000;
	const desde = new Date(Date.now() - DIAS_HISTORICO * dia);
	const [corridasStrava, corridasRelogio, fcMax] = await Promise.all([
		db.corrida.findMany({
			where: { dataInicio: { gte: desde } },
			select: {
				dataInicio: true,
				tempoMovimentoSeg: true,
				frequenciaMedia: true,
				distanciaMetros: true,
				elevacaoGanhoMetros: true,
			},
		}),
		listarCorridasRelogio(RELOGIO_DESDE_DATA, desde),
		db.corrida.aggregate({
			where: { dataInicio: { gte: new Date(Date.now() - 365 * dia) } },
			_max: { frequenciaMaxima: true },
		}),
	]);

	const corridas = [
		...semDuplicadasDoStrava(corridasStrava, corridasRelogio),
		...corridasRelogio.map((r) => ({
			dataInicio: new Date(r.dataInicio),
			tempoMovimentoSeg: r.tempoMovimentoSeg,
			frequenciaMedia: r.fcMedia,
			distanciaMetros: r.distanciaMetros,
			elevacaoGanhoMetros: r.elevacaoGanhoMetros,
		})),
	];

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
