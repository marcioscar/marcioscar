import { db } from "../../db.server";
import { RELOGIO_DESDE_DATA } from "~/lib/fonte-dados";
import { semDuplicadasDoStrava } from "~/models/corridas-unificadas.server";
import { listarCorridasRelogio } from "~/models/treino-saude.server";
import { obterVpontoConfigurado } from "~/models/vdot-config.server";
import { vpontoEmUso } from "~/lib/zonas-pace";
import {
	fracaoVo2PelaFc,
	vo2DoPace,
	vpontoDaProva,
} from "~/lib/vdot";

export type EstimativaProva = {
	data: string;
	nome: string;
	distanciaKm: number;
	tempoSeg: number;
	fcMedia: number | null;
	vponto: number;
	/** dias desde a prova */
	idadeDias: number;
};

export type MelhorEsforco = {
	km: number;
	data: string;
	nome: string;
	paceSeg: number;
	fcMedia: number | null;
	vponto: number;
};

export type EstimativaFc = {
	data: string;
	km: number;
	paceSeg: number;
	fcMedia: number;
	vponto: number;
};

export type PainelVponto = {
	atual: number;
	desde: string;
	origem: string;
	/** quantas corridas entraram nas estimativas (Strava + relógio) */
	corridasAnalisadas: number;
	fcMaxima: number;
	provas: EstimativaProva[];
	/** todas as provas de 12 meses (para o gráfico de evolução) */
	evolucao: EstimativaProva[];
	esforcos: MelhorEsforco[];
	porFc: EstimativaFc[];
	medianaFc: number | null;
	/** maior VPONTO entre as provas dos últimos 120 dias */
	melhorProvaRecente: number | null;
	diasDesdeMudanca: number;
	sugestao: { vponto: number; texto: string } | null;
};

type Split = { distance: number; moving_time: number; average_heartrate?: number };

const DIA = 24 * 3600 * 1000;

/**
 * Distância oficial da prova: o relógio costuma medir um pouco a mais (zigue-zague, GPS).
 * Dentro de 1,5% de uma distância padrão, usa a oficial; fora disso, vale a do relógio
 * (ex.: a 15k de 01/11 teve 14,65 km e foi mantida assim).
 */
const DISTANCIAS_OFICIAIS = [5000, 10000, 15000, 21097.5, 30000, 42195];
function distanciaDaProva(medidaM: number): number {
	const oficial = DISTANCIAS_OFICIAIS.find((d) => Math.abs(medidaM - d) / d <= 0.015);
	return oficial ?? medidaM;
}
// corrida sem nome próprio (Strava dá "Corrida matinal", "Corrida da tarde"...) não é prova
const NOME_DE_TREINO = /^(corrida|run)\s+(matinal|da tarde|da noite|noturna|de manhã|morning|afternoon|evening|night)/i;

function percentil(valores: number[], p: number): number {
	const o = [...valores].sort((a, b) => a - b);
	return o[Math.min(o.length - 1, Math.max(0, Math.round(p * (o.length - 1))))];
}

export type CorridaAnalise = {
	nome: string;
	dataInicio: Date;
	distanciaMetros: number;
	tempoMovimentoSeg: number;
	tempoTotalSeg: number | null;
	elevacaoGanhoMetros: number;
	frequenciaMedia: number | null;
	frequenciaMaxima: number | null;
	splits: unknown;
};

export type CorridasCarregadas = {
	corridas: CorridaAnalise[];
	config: Awaited<ReturnType<typeof obterVpontoConfigurado>>;
};

/** Corridas dos últimos 12 meses (Strava + relógio) para as estimativas e a evolução. */
export async function carregarCorridas(): Promise<CorridasCarregadas> {
	const agora = Date.now();
	const desde365 = new Date(agora - 365 * DIA);
	const [doStrava, doRelogio, config] = await Promise.all([
		db.corrida.findMany({
			where: { dataInicio: { gte: desde365 } },
			orderBy: { dataInicio: "asc" },
			select: {
				nome: true,
				dataInicio: true,
				distanciaMetros: true,
				tempoMovimentoSeg: true,
				tempoTotalSeg: true,
				elevacaoGanhoMetros: true,
				frequenciaMedia: true,
				frequenciaMaxima: true,
				splits: true,
			},
		}),
		listarCorridasRelogio(RELOGIO_DESDE_DATA, desde365),
		obterVpontoConfigurado(),
	]);
	// de 23/11 em diante a fonte é o relógio; o Strava só entra se o relógio não tiver a mesma corrida
	const corridas: CorridaAnalise[] = [
		...semDuplicadasDoStrava(doStrava, doRelogio),
		...doRelogio.map((r) => ({
			nome: r.nome,
			dataInicio: new Date(r.dataInicio),
			distanciaMetros: r.distanciaMetros,
			tempoMovimentoSeg: r.tempoMovimentoSeg,
			tempoTotalSeg: r.tempoMovimentoSeg,
			elevacaoGanhoMetros: r.elevacaoGanhoMetros,
			frequenciaMedia: r.fcMedia,
			frequenciaMaxima: null as number | null,
			splits: r.splits as unknown,
		})),
	].sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime());
	return { corridas, config };
}

export async function montarPainelVponto(carregadas?: CorridasCarregadas): Promise<PainelVponto> {
	const agora = Date.now();
	const { corridas, config } = carregadas ?? (await carregarCorridas());
	const atual = vpontoEmUso();

	// FC máxima de referência: percentil 95 dos picos por corrida (um pico isolado de sensor não conta)
	const picos = corridas.map((c) => c.frequenciaMaxima).filter((v): v is number => !!v && v > 120);
	const fcMaxima = picos.length ? Math.round(percentil(picos, 0.95)) : 190;

	const ehProva = (c: (typeof corridas)[number]) => c.distanciaMetros >= 5000 && !NOME_DE_TREINO.test(c.nome ?? "");

	// provas: distância oficial (ou a do relógio) e tempo total
	const evolucao: EstimativaProva[] = corridas
		.filter((c) => ehProva(c))
		.map((c) => ({
			data: c.dataInicio.toISOString().slice(0, 10),
			nome: c.nome,
			distanciaKm: distanciaDaProva(c.distanciaMetros) / 1000,
			tempoSeg: c.tempoTotalSeg ?? c.tempoMovimentoSeg,
			fcMedia: c.frequenciaMedia,
			vponto: vpontoDaProva(distanciaDaProva(c.distanciaMetros), c.tempoTotalSeg ?? c.tempoMovimentoSeg),
			idadeDias: Math.round((agora - c.dataInicio.getTime()) / DIA),
		}));
	const provas = evolucao.filter((p) => p.idadeDias <= 180).reverse();

	// melhores esforços sustentados em treino (km seguidos, últimas 12 semanas): piso do VPONTO
	const corte = agora - 84 * DIA;
	const esforcos: MelhorEsforco[] = [];
	for (const k of [5, 8, 10]) {
		let melhor: (MelhorEsforco & { dist: number }) | null = null;
		for (const c of corridas) {
			if (c.dataInicio.getTime() < corte || ehProva(c) || !Array.isArray(c.splits)) continue;
			const s = (c.splits as unknown as Split[]).filter((x) => x.distance > 900);
			for (let i = 0; i + k <= s.length; i++) {
				const janela = s.slice(i, i + k);
				const dist = janela.reduce((a, x) => a + x.distance, 0);
				const tempo = janela.reduce((a, x) => a + x.moving_time, 0);
				const pace = tempo / (dist / 1000);
				if (!melhor || pace < melhor.paceSeg) {
					const fcs = janela.map((x) => x.average_heartrate).filter((v): v is number => !!v);
					melhor = {
						km: k,
						data: c.dataInicio.toISOString().slice(0, 10),
						nome: c.nome,
						paceSeg: pace,
						fcMedia: fcs.length ? fcs.reduce((a, v) => a + v, 0) / fcs.length : null,
						vponto: vpontoDaProva(dist, tempo),
						dist,
					};
				}
			}
		}
		if (melhor) esforcos.push(melhor);
	}

	// estimativa pela FC (corridas estáveis: ≥ 8 km, pouca subida, FC média ≥ 75% da máxima)
	const porFc: EstimativaFc[] = [];
	for (const c of corridas) {
		if (c.dataInicio.getTime() < corte || ehProva(c) || !c.frequenciaMedia || c.distanciaMetros < 8000) continue;
		if (c.elevacaoGanhoMetros / (c.distanciaMetros / 1000) > 13) continue;
		const fracaoFc = c.frequenciaMedia / fcMaxima;
		if (fracaoFc < 0.75) continue;
		const pace = c.tempoMovimentoSeg / (c.distanciaMetros / 1000);
		const vo2Maximo = vo2DoPace(pace) / fracaoVo2PelaFc(fracaoFc);
		porFc.push({
			data: c.dataInicio.toISOString().slice(0, 10),
			km: c.distanciaMetros / 1000,
			paceSeg: pace,
			fcMedia: c.frequenciaMedia,
			vponto: vo2Maximo,
		});
	}
	const medianaFc = porFc.length ? percentil(porFc.map((e) => e.vponto), 0.5) : null;

	const recentes = provas.filter((p) => p.idadeDias <= 120);
	const melhorProvaRecente = recentes.length ? Math.max(...recentes.map((p) => p.vponto)) : null;
	const diasDesdeMudanca = Math.max(0, Math.floor((agora - new Date(`${config.desde}T12:00:00`).getTime()) / DIA));

	// regra do livro: mantém o valor por 3 a 6 semanas; só sugere mudar com prova melhor ou treino consistentemente acima
	let sugestao: PainelVponto["sugestao"] = null;
	if (melhorProvaRecente !== null && Math.round(melhorProvaRecente) > atual) {
		sugestao = {
			vponto: Math.round(melhorProvaRecente),
			texto: `Uma prova recente indica VPONTO ${melhorProvaRecente.toFixed(1).replace(".", ",")}, acima do atual.`,
		};
	} else if (diasDesdeMudanca >= 28 && medianaFc !== null && medianaFc >= atual + 1.5) {
		sugestao = {
			vponto: atual + 1,
			texto: `Há ${diasDesdeMudanca} dias no mesmo VPONTO e a estimativa pela FC dos treinos está em ${medianaFc.toFixed(1).replace(".", ",")}. Dá para subir 1 ponto.`,
		};
	}

	return {
		atual,
		desde: config.desde,
		origem: config.origem,
		corridasAnalisadas: corridas.length,
		fcMaxima,
		provas,
		evolucao,
		esforcos,
		porFc: porFc.reverse(),
		medianaFc,
		melhorProvaRecente,
		diasDesdeMudanca,
		sugestao,
	};
}

