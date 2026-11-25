import { chaveDia } from "~/lib/carga-treino";
import { vpontoDaProva } from "~/lib/vdot";
import { zonaDoPaceEmUso } from "~/lib/zonas-pace";
import type { CorridasCarregadas } from "~/models/vdot.server";

export type SemanaEvolucao = {
	/** segunda-feira (yyyy-MM-dd) */
	inicio: string;
	km: number;
	facilKm: number; // Z1 + Z2
	maratonaKm: number; // Z3
	limiarKm: number; // Z4
	intervaladoKm: number; // Z5
	repeticaoKm: number; // Z6
	longaoKm: number;
	corridas: number;
	/** semana ainda em andamento */
	emAndamento: boolean;
};

export type PontoMensal = { mes: string; valor: number; n: number };

export type Criterio = {
	id: string;
	titulo: string;
	valor: string;
	referencia: string;
	status: "ok" | "atencao" | "info";
	detalhe: string;
};

export type EvolucaoAtleta = {
	semanas: SemanaEvolucao[];
	/** pace médio (seg/km) em km corridos na faixa de FC, por mês */
	eficiencia: PontoMensal[];
	faixaFc: [number, number];
	/** melhor VPONTO sustentado em 8 km seguidos de treino, por mês (piso) */
	vpontoMensal: PontoMensal[];
	criteriosDaniels: Criterio[];
	indicadoresCanova: Criterio[];
};

type Split = { distance: number; moving_time: number; average_heartrate?: number };

const DIA = 24 * 3600 * 1000;
const NOME_DE_TREINO = /^(corrida|run)\s+(matinal|da tarde|da noite|noturna|de manhã|morning|afternoon|evening|night)/i;
const FAIXA_FC: [number, number] = [145, 155];
const SEMANAS = 26;
// mais lento que isto é caminhada, não corrida
const PACE_CAMINHADA = 570;

function inicioDaSemana(d: Date): string {
	const dia = chaveDia(d);
	const dow = new Date(`${dia}T12:00:00Z`).getUTCDay(); // 0 = domingo
	const x = new Date(`${dia}T12:00:00Z`);
	x.setUTCDate(x.getUTCDate() - ((dow + 6) % 7));
	return x.toISOString().slice(0, 10);
}

function mediana(v: number[]): number {
	const o = [...v].sort((a, b) => a - b);
	return o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2;
}

const pct = (parte: number, todo: number) => (todo > 0 ? (parte / todo) * 100 : 0);
const fmt = (n: number, casas = 0) => n.toFixed(casas).replace(".", ",");

export function montarEvolucaoAtleta({ corridas, config }: CorridasCarregadas): EvolucaoAtleta {
	const agora = new Date();
	const semanaAtual = inicioDaSemana(agora);

	// semanas (as últimas 26, da mais antiga para a atual)
	const mapa = new Map<string, SemanaEvolucao>();
	for (let i = SEMANAS - 1; i >= 0; i--) {
		const d = new Date(`${semanaAtual}T12:00:00Z`);
		d.setUTCDate(d.getUTCDate() - 7 * i);
		const inicio = d.toISOString().slice(0, 10);
		mapa.set(inicio, {
			inicio,
			km: 0,
			facilKm: 0,
			maratonaKm: 0,
			limiarKm: 0,
			intervaladoKm: 0,
			repeticaoKm: 0,
			longaoKm: 0,
			corridas: 0,
			emAndamento: inicio === semanaAtual,
		});
	}

	// critérios de Daniels olham só treino (provas ficam de fora) e a duração do maior longão
	const treinoPorSemana = new Map<string, { km: number; limiar: number; intervalado: number; repeticao: number; longaoMin: number; longaoKm: number }>();
	const eficienciaPorMes = new Map<string, number[]>();
	const melhorPorMes = new Map<string, { vponto: number }>();

	for (const c of corridas) {
		const semana = mapa.get(inicioDaSemana(c.dataInicio));
		const splitsBrutos = Array.isArray(c.splits) ? (c.splits as Split[]) : [];
		const splits: Split[] = splitsBrutos.length
			? splitsBrutos
			: [{ distance: c.distanciaMetros, moving_time: c.tempoMovimentoSeg, average_heartrate: c.frequenciaMedia ?? undefined }];
		const mes = chaveDia(c.dataInicio).slice(0, 7);

		const ehProvaCorrida = c.distanciaMetros >= 5000 && !NOME_DE_TREINO.test(c.nome ?? "");
		const chaveSemana = inicioDaSemana(c.dataInicio);
		const treino = treinoPorSemana.get(chaveSemana) ?? { km: 0, limiar: 0, intervalado: 0, repeticao: 0, longaoMin: 0, longaoKm: 0 };
		treinoPorSemana.set(chaveSemana, treino);
		if (semana) {
			semana.corridas += 1;
			semana.longaoKm = Math.max(semana.longaoKm, c.distanciaMetros / 1000);
		}
		if (!ehProvaCorrida && c.distanciaMetros / 1000 > treino.longaoKm) {
			treino.longaoKm = c.distanciaMetros / 1000;
			treino.longaoMin = c.tempoMovimentoSeg / 60;
		}
		for (const s of splits) {
			if (s.distance < 200 || s.moving_time <= 0) continue;
			const pace = s.moving_time / (s.distance / 1000);
			if (pace > PACE_CAMINHADA) continue;
			const km = s.distance / 1000;
			if (semana) {
				semana.km += km;
				const z = zonaDoPaceEmUso(pace).id;
				if (z === "Z1" || z === "Z2") semana.facilKm += km;
				else if (z === "Z3") semana.maratonaKm += km;
				else if (z === "Z4") semana.limiarKm += km;
				else if (z === "Z5") semana.intervaladoKm += km;
				else semana.repeticaoKm += km;
			}
			if (!ehProvaCorrida) {
				const z = zonaDoPaceEmUso(pace).id;
				treino.km += km;
				if (z === "Z4") treino.limiar += km;
				else if (z === "Z5") treino.intervalado += km;
				else if (z === "Z6") treino.repeticao += km;
			}
			const fc = s.average_heartrate;
			if (fc && fc >= FAIXA_FC[0] && fc <= FAIXA_FC[1] && pace <= 480 && s.distance >= 900) {
				const lista = eficienciaPorMes.get(mes) ?? [];
				lista.push(pace);
				eficienciaPorMes.set(mes, lista);
			}
		}

		// melhor esforço de 8 km seguidos em treino (provas ficam de fora)
		const ehProva = c.distanciaMetros >= 5000 && !NOME_DE_TREINO.test(c.nome ?? "");
		if (!ehProva && splitsBrutos.length >= 8) {
			const inteiros = splitsBrutos.filter((x) => x.distance > 900);
			for (let i = 0; i + 8 <= inteiros.length; i++) {
				const janela = inteiros.slice(i, i + 8);
				const dist = janela.reduce((a, x) => a + x.distance, 0);
				const tempo = janela.reduce((a, x) => a + x.moving_time, 0);
				const v = vpontoDaProva(dist, tempo);
				const atual = melhorPorMes.get(mes);
				if (!atual || v > atual.vponto) melhorPorMes.set(mes, { vponto: v });
			}
		}
	}

	const semanas = [...mapa.values()].map((s) => ({
		...s,
		km: Math.round(s.km * 10) / 10,
		facilKm: Math.round(s.facilKm * 10) / 10,
		maratonaKm: Math.round(s.maratonaKm * 10) / 10,
		limiarKm: Math.round(s.limiarKm * 10) / 10,
		intervaladoKm: Math.round(s.intervaladoKm * 10) / 10,
		repeticaoKm: Math.round(s.repeticaoKm * 10) / 10,
		longaoKm: Math.round(s.longaoKm * 10) / 10,
	}));

	const eficiencia: PontoMensal[] = [...eficienciaPorMes.entries()]
		.filter(([, v]) => v.length >= 3)
		.map(([mes, v]) => ({ mes, valor: Math.round(mediana(v)), n: v.length }))
		.sort((a, b) => a.mes.localeCompare(b.mes));

	const vpontoMensal: PontoMensal[] = [...melhorPorMes.entries()]
		.map(([mes, v]) => ({ mes, valor: Math.round(v.vponto * 10) / 10, n: 1 }))
		.sort((a, b) => a.mes.localeCompare(b.mes));

	// ── critérios ──────────────────────────────────────────────────────────
	const completas = semanas.filter((s) => !s.emAndamento);
	const ultimas4 = completas.slice(-4);
	const anteriores4 = completas.slice(-8, -4);
	const soma = (l: SemanaEvolucao[], f: (s: SemanaEvolucao) => number) => l.reduce((a, s) => a + f(s), 0);
	const km4 = soma(ultimas4, (s) => s.km);
	const media4 = km4 / Math.max(ultimas4.length, 1);
	const mediaAnt = soma(anteriores4, (s) => s.km) / Math.max(anteriores4.length, 1);

	const criterio = (id: string, titulo: string, valorPct: number, limite: number, detalhe: string): Criterio => ({
		id,
		titulo,
		valor: `${fmt(valorPct, 1)}%`,
		referencia: `até ${limite}% do volume`,
		status: valorPct <= limite ? "ok" : "atencao",
		detalhe,
	});

	const treino4 = ultimas4.map((s) => treinoPorSemana.get(s.inicio) ?? { km: 0, limiar: 0, intervalado: 0, repeticao: 0, longaoMin: 0, longaoKm: 0 });
	const kmTreino4 = treino4.reduce((a, t) => a + t.km, 0);
	const somaT = (f: (t: (typeof treino4)[number]) => number) => treino4.reduce((a, t) => a + f(t), 0);
	const comTreino = treino4.filter((t) => t.km > 0);
	const longaoPct = comTreino.length ? comTreino.reduce((a, t) => a + pct(t.longaoKm, t.km), 0) / comTreino.length : 0;
	const longaoMin = Math.max(0, ...treino4.map((t) => t.longaoMin));

	const criteriosDaniels: Criterio[] = [
		{
			id: "longao",
			titulo: "Longão",
			valor: `${fmt(longaoPct, 0)}% · ${fmt(longaoMin, 0)} min`,
			referencia: "até 25% do volume ou 150 min",
			// vale uma das duas regras de Daniels: com poucas corridas por semana o percentual sozinho engana
			status: longaoPct <= 25 || longaoMin <= 150 ? "ok" : "atencao",
			detalhe: "Daniels limita o maior treino da semana a 25% do volume ou 150 min, o que vier primeiro. Com 3 corridas por semana, o percentual passa fácil e vale a duração.",
		},
		criterio("limiar", "Limiar (Z4)", pct(somaT((t) => t.limiar), kmTreino4), 10, "Km de treino no ritmo de limiar: até 10% do volume (provas ficam de fora)."),
		criterio("intervalado", "Intervalado (Z5)", pct(somaT((t) => t.intervalado), kmTreino4), 8, "Intervalados de VO2 máx: até 8% do volume (e 10 km por sessão)."),
		criterio("repeticao", "Repetição (Z6)", pct(somaT((t) => t.repeticao), kmTreino4), 5, "Repetições rápidas: até 5% do volume."),
		{
			id: "facil",
			titulo: "Corrida fácil (Z1–Z2)",
			valor: `${fmt(pct(soma(ultimas4, (s) => s.facilKm), km4), 0)}%`,
			referencia: "a maior parte do volume",
			status: "info",
			detalhe: "Daniels: a corrida fácil forma a base e deve ser a maior parte da semana.",
		},
		{
			id: "vponto",
			titulo: "Tempo no mesmo VPONTO",
			valor: `${Math.max(0, Math.floor((Date.now() - new Date(`${config.desde}T12:00:00`).getTime()) / DIA))} dias`,
			referencia: "manter por 3 a 6 semanas",
			status: "info",
			detalhe: "Só mude o VPONTO com uma prova melhor, ou após 4 a 6 semanas com treinos mais fáceis no mesmo ritmo.",
		},
	];

	const variacao = mediaAnt > 0 ? ((media4 - mediaAnt) / mediaAnt) * 100 : 0;
	const ultimas12 = completas.slice(-12);
	const pico = ultimas12.reduce((m, s) => (s.km > m.km ? s : m), ultimas12[0] ?? semanas[0]);
	const especifico4 = soma(ultimas4, (s) => s.maratonaKm + s.limiarKm) / Math.max(ultimas4.length, 1);
	const maiorLongao = Math.max(0, ...ultimas4.map((s) => s.longaoKm));
	const corridasSemana = soma(ultimas4, (s) => s.corridas) / Math.max(ultimas4.length, 1);

	const indicadoresCanova: Criterio[] = [
		{
			id: "volume",
			titulo: "Volume semanal",
			valor: `${fmt(media4, 0)} km`,
			referencia: "média das últimas 4 semanas",
			status: variacao > 15 ? "atencao" : "info",
			detalhe: `${variacao >= 0 ? "+" : ""}${fmt(variacao, 0)}% sobre as 4 semanas anteriores (${fmt(mediaAnt, 0)} km). Subir mais de ~15% de uma vez cobra caro.`,
		},
		{
			id: "pico",
			titulo: "Pico de volume (12 semanas)",
			valor: `${fmt(pico?.km ?? 0, 0)} km`,
			referencia: "semana mais forte",
			status: "info",
			detalhe: "Canova constrói o volume por ciclos, com semanas de descarga entre os picos.",
		},
		{
			id: "especifico",
			titulo: "Trabalho específico (Z3 + Z4)",
			valor: `${fmt(especifico4, 1)} km/sem`,
			referencia: "no ritmo de maratona e de limiar",
			status: "info",
			detalhe: "Quilômetros perto do ritmo de prova: o que mais pesa na fase específica.",
		},
		{
			id: "longao",
			titulo: "Maior longão (4 semanas)",
			valor: `${fmt(maiorLongao, 1)} km`,
			referencia: "base da resistência específica",
			status: "info",
			detalhe: "O longão é a sessão central; vale ver se ele cresce de forma gradual entre os ciclos.",
		},
		{
			id: "frequencia",
			titulo: "Frequência",
			valor: `${fmt(corridasSemana, 1)} corridas/sem`,
			referencia: "média das últimas 4 semanas",
			status: "info",
			detalhe: "Regularidade pesa mais do que um treino isolado forte.",
		},
	];

	return { semanas, eficiencia, faixaFc: FAIXA_FC, vpontoMensal, criteriosDaniels, indicadoresCanova };
}
