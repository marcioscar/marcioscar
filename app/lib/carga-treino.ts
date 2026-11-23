// Carga de treino e relação aguda:crônica (ACWR), estimadas só com dados do Strava.
//
// Carga de uma corrida = minutos × (FC média / FC máxima de referência)², escalada
// para que 60 min na FC máxima valham 100 pontos. Sem FC, assume 75% da FC máxima.
// Relação do dia = carga dos últimos 7 dias ÷ (carga dos últimos 28 dias ÷ 4).

export const FUSO = "America/Sao_Paulo";
const FC_PADRAO_FRACAO = 0.75;

export type ZonaCarga = "destreino" | "ideal" | "medio" | "alto";

export const LIMITES_ZONA = { destreino: 0.8, ideal: 1.3, medio: 1.5 } as const;

export function classificarRelacao(r: number): ZonaCarga {
	if (r < LIMITES_ZONA.destreino) return "destreino";
	if (r <= LIMITES_ZONA.ideal) return "ideal";
	if (r <= LIMITES_ZONA.medio) return "medio";
	return "alto";
}

export const ROTULO_ZONA: Record<ZonaCarga, string> = {
	destreino: "Destreino",
	ideal: "Ideal",
	medio: "Risco médio",
	alto: "Alto risco",
};

export const COR_ZONA: Record<ZonaCarga, string> = {
	destreino: "var(--paleta-4)",
	ideal: "var(--sucesso)",
	medio: "var(--alerta)",
	alto: "var(--perigo)",
};

export const TEXTO_ZONA: Record<ZonaCarga, string> = {
	destreino:
		"A carga recente está abaixo do que seu corpo já tolera. Bom para recuperar; se durar muito, o condicionamento cai.",
	ideal:
		"A carga está no ponto ideal: bom equilíbrio entre estímulo e recuperação, com baixo risco de lesão.",
	medio:
		"A carga subiu mais rápido que o seu hábito das últimas semanas. Capriche no sono e prefira treinos leves nos próximos dias.",
	alto:
		"Salto grande de carga em relação às últimas 4 semanas, o que aumenta o risco de lesão. Considere um dia de descanso ou treino bem leve.",
};

export type CorridaParaCarga = {
	dataInicio: Date;
	tempoMovimentoSeg: number;
	frequenciaMedia: number | null;
	distanciaMetros: number;
	elevacaoGanhoMetros: number;
};

export function chaveDia(data: Date): string {
	return data.toLocaleDateString("en-CA", { timeZone: FUSO });
}

function somarDias(chave: string, dias: number): string {
	const d = new Date(`${chave}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + dias);
	return d.toISOString().slice(0, 10);
}

export function cargaDaCorrida(
	tempoMovimentoSeg: number,
	frequenciaMedia: number | null,
	fcReferencia: number,
): number {
	const fracao =
		frequenciaMedia && frequenciaMedia > 0 && fcReferencia > 0
			? Math.min(frequenciaMedia / fcReferencia, 1.05)
			: FC_PADRAO_FRACAO;
	return (tempoMovimentoSeg / 60) * fracao * fracao * (100 / 60);
}

export type DiaRelacao = {
	chave: string;
	diaSemana: string; // "ter."
	diaMes: number;
	relacao: number | null;
	zona: ZonaCarga | null;
};

export type TotaisPeriodo = {
	carga: number;
	duracaoSeg: number;
	metros: number;
	ganhoM: number;
	sessoes: number;
	paceSegPorKm: number | null;
};

export type CargaTreino = {
	dias: DiaRelacao[];
	atual: DiaRelacao | null;
	media: number | null;
	maximo: { relacao: number; chave: string } | null;
	minimo: { relacao: number; chave: string } | null;
	distribuicao: { zona: ZonaCarga; dias: number; pct: number }[];
	ultimos7: TotaisPeriodo;
	anteriores7: TotaisPeriodo;
};

function totais(
	corridas: { chave: string; carga: number; c: CorridaParaCarga }[],
	de: string,
	ate: string,
): TotaisPeriodo {
	const lista = corridas.filter((x) => x.chave >= de && x.chave <= ate);
	const duracaoSeg = lista.reduce((a, x) => a + x.c.tempoMovimentoSeg, 0);
	const metros = lista.reduce((a, x) => a + x.c.distanciaMetros, 0);
	return {
		carga: lista.reduce((a, x) => a + x.carga, 0),
		duracaoSeg,
		metros,
		ganhoM: lista.reduce((a, x) => a + x.c.elevacaoGanhoMetros, 0),
		sessoes: lista.length,
		paceSegPorKm: metros > 0 ? duracaoSeg / (metros / 1000) : null,
	};
}

export function calcularCargaTreino(
	corridas: CorridaParaCarga[],
	fcReferencia: number,
	hoje: Date = new Date(),
): CargaTreino {
	const hojeChave = chaveDia(hoje);
	const itens = corridas.map((c) => ({
		chave: chaveDia(c.dataInicio),
		carga: cargaDaCorrida(c.tempoMovimentoSeg, c.frequenciaMedia, fcReferencia),
		c,
	}));

	const cargaPorDia = new Map<string, number>();
	for (const i of itens) cargaPorDia.set(i.chave, (cargaPorDia.get(i.chave) ?? 0) + i.carga);
	const soma = (ate: string, janela: number) => {
		let total = 0;
		for (let k = 0; k < janela; k++) total += cargaPorDia.get(somarDias(ate, -k)) ?? 0;
		return total;
	};

	const dias: DiaRelacao[] = [];
	for (let k = 6; k >= 0; k--) {
		const chave = somarDias(hojeChave, -k);
		const cronica = soma(chave, 28) / 4;
		const relacao = cronica > 0 ? soma(chave, 7) / cronica : null;
		const data = new Date(`${chave}T12:00:00Z`);
		dias.push({
			chave,
			diaSemana: data.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }),
			diaMes: data.getUTCDate(),
			relacao,
			zona: relacao === null ? null : classificarRelacao(relacao),
		});
	}

	const validos = dias.filter((d) => d.relacao !== null) as (DiaRelacao & { relacao: number })[];
	const media = validos.length ? validos.reduce((a, d) => a + d.relacao, 0) / validos.length : null;
	const maior = validos.reduce<(typeof validos)[number] | null>(
		(m, d) => (!m || d.relacao > m.relacao ? d : m),
		null,
	);
	const menor = validos.reduce<(typeof validos)[number] | null>(
		(m, d) => (!m || d.relacao < m.relacao ? d : m),
		null,
	);

	const ordem: ZonaCarga[] = ["alto", "medio", "ideal", "destreino"];
	const distribuicao = ordem.map((zona) => {
		const n = validos.filter((d) => d.zona === zona).length;
		return { zona, dias: n, pct: validos.length ? Math.round((n / validos.length) * 100) : 0 };
	});

	return {
		dias,
		atual: dias[dias.length - 1],
		media,
		maximo: maior ? { relacao: maior.relacao, chave: maior.chave } : null,
		minimo: menor ? { relacao: menor.relacao, chave: menor.chave } : null,
		distribuicao,
		ultimos7: totais(itens, somarDias(hojeChave, -6), hojeChave),
		anteriores7: totais(itens, somarDias(hojeChave, -13), somarDias(hojeChave, -7)),
	};
}
