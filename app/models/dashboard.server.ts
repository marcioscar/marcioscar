import { db } from "../../db.server";
import { obterResumoSaldoBrassaco } from "./pagamentos-brassaco.server";

export type SerieMensalDashboard = {
	mes: string;
	label: string;
	valor: number;
	quantidade: number;
};

export type ResumoDashboardBrassaco = {
	saldoBrassaco: number;
	totalPagoBrassaco: number;
	totalDespesasBrassaco: number;
	serieMensal: SerieMensalDashboard[];
};

export type ResumoDespesasPeriodo = {
	totalDespesas: number;
	totalValorDespesas: number;
	totalDespesasBrassaco: number;
	totalValorDespesasBrassaco: number;
};

export type ResumoContaPeriodo = {
	conta: string;
	totalDespesas: number;
	totalValorDespesas: number;
};

export type ResumoCategoriaPeriodo = {
	categoria: string;
	totalDespesas: number;
	totalValorDespesas: number;
};

function getInicioMesUtc(data: Date): Date {
	return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1, 0, 0, 0, 0));
}

function getFimMesUtc(data: Date): Date {
	return new Date(
		Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0, 23, 59, 59, 999),
	);
}

function getChaveMes(ano: number, mesIndexadoEmUm: number): string {
	return `${ano}-${String(mesIndexadoEmUm).padStart(2, "0")}`;
}

function montarJanelaMensal(meses: number): SerieMensalDashboard[] {
	const agora = new Date();
	const mesesNormalizados = Math.max(1, meses);
	const inicio = new Date(
		Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (mesesNormalizados - 1), 1),
	);

	const serie: SerieMensalDashboard[] = [];
	for (let i = 0; i < mesesNormalizados; i++) {
		const dataBase = new Date(
			Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + i, 1),
		);
		serie.push({
			mes: getChaveMes(dataBase.getUTCFullYear(), dataBase.getUTCMonth() + 1),
			label: dataBase.toLocaleString("pt-BR", {
				month: "short",
				year: "2-digit",
				timeZone: "UTC",
			}),
			valor: 0,
			quantidade: 0,
		});
	}

	return serie;
}

function getInicioJanelaMensal(meses: number): Date {
	const agora = new Date();
	return getInicioMesUtc(
		new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (meses - 1), 1)),
	);
}

function getFiltroBrassacoPorPeriodo(inicioJanela: Date) {
	return {
		brassaco: true,
		data: {
			gte: inicioJanela,
		},
	};
}

function getNumeroSeguro(valor: number | null | undefined): number {
	return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function getIntervaloMesAno(ano: number, mes: number): { inicio: Date; fim: Date } {
	const dataBase = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0, 0));
	return {
		inicio: getInicioMesUtc(dataBase),
		fim: getFimMesUtc(dataBase),
	};
}

function getChaveConta(conta: string): string {
	return conta.trim();
}

function acumularDespesasPorConta(
	registros: { conta: string; valor: number }[],
): ResumoContaPeriodo[] {
	const mapaContas = new Map<string, ResumoContaPeriodo>();

	for (const registro of registros) {
		const conta = getChaveConta(registro.conta) || "Sem conta";
		const itemAtual = mapaContas.get(conta);
		if (itemAtual) {
			itemAtual.totalDespesas += 1;
			itemAtual.totalValorDespesas += registro.valor;
			continue;
		}

		mapaContas.set(conta, {
			conta,
			totalDespesas: 1,
			totalValorDespesas: registro.valor,
		});
	}

	return Array.from(mapaContas.values()).sort(
		(a, b) => b.totalValorDespesas - a.totalValorDespesas,
	);
}

function getChaveCategoria(categoria: string): string {
	return categoria.trim();
}

function acumularDespesasPorCategoria(
	registros: { categoria: string; valor: number }[],
): ResumoCategoriaPeriodo[] {
	const mapaCategorias = new Map<string, ResumoCategoriaPeriodo>();

	for (const registro of registros) {
		const categoria = getChaveCategoria(registro.categoria) || "Sem categoria";
		const itemAtual = mapaCategorias.get(categoria);
		if (itemAtual) {
			itemAtual.totalDespesas += 1;
			itemAtual.totalValorDespesas += registro.valor;
			continue;
		}

		mapaCategorias.set(categoria, {
			categoria,
			totalDespesas: 1,
			totalValorDespesas: registro.valor,
		});
	}

	return Array.from(mapaCategorias.values()).sort(
		(a, b) => b.totalValorDespesas - a.totalValorDespesas,
	);
}

function acumularSerieMensal(
	janela: SerieMensalDashboard[],
	registros: { data: Date; valor: number }[],
): SerieMensalDashboard[] {
	const acumulado = new Map<string, { valor: number; quantidade: number }>();

	for (const registro of registros) {
		const ano = registro.data.getUTCFullYear();
		const mes = registro.data.getUTCMonth() + 1;
		const chave = getChaveMes(ano, mes);
		const atual = acumulado.get(chave);

		if (atual) {
			atual.valor += registro.valor;
			atual.quantidade += 1;
			continue;
		}

		acumulado.set(chave, { valor: registro.valor, quantidade: 1 });
	}

	return janela.map((item) => {
		const valorMes = acumulado.get(item.mes);
		if (!valorMes) {
			return item;
		}

		return {
			...item,
			valor: valorMes.valor,
			quantidade: valorMes.quantidade,
		};
	});
}

export async function obterResumoDashboardBrassaco(
	meses = 6,
): Promise<ResumoDashboardBrassaco> {
	const mesesNormalizados = Math.max(1, meses);
	const inicioJanela = getInicioJanelaMensal(mesesNormalizados);
	const where = getFiltroBrassacoPorPeriodo(inicioJanela);

	const [totalDespesasBrassaco, despesasBrassaco, resumoSaldoBrassaco] =
		await Promise.all([
		db.despesas.count({ where }),
		db.despesas.findMany({
			where,
			select: {
				data: true,
				valor: true,
			},
		}),
		obterResumoSaldoBrassaco(),
	]);

	const janelaBase = montarJanelaMensal(mesesNormalizados);
	const serieMensal = acumularSerieMensal(janelaBase, despesasBrassaco);

	return {
		saldoBrassaco: resumoSaldoBrassaco.saldoBrassaco,
		totalPagoBrassaco: resumoSaldoBrassaco.totalPagoBrassaco,
		totalDespesasBrassaco,
		serieMensal,
	};
}

export async function obterResumoDespesasPorPeriodo(
	ano: number,
	mes: number,
): Promise<ResumoDespesasPeriodo> {
	const intervalo = getIntervaloMesAno(ano, mes);
	const filtroPeriodo = {
		data: {
			gte: intervalo.inicio,
			lte: intervalo.fim,
		},
	};

	const [totalDespesas, agregadoTotalDespesas, totalDespesasBrassaco, agregadoBrassaco] =
		await Promise.all([
			db.despesas.count({
				where: filtroPeriodo,
			}),
			db.despesas.aggregate({
				where: filtroPeriodo,
				_sum: {
					valor: true,
				},
			}),
			db.despesas.count({
				where: {
					...filtroPeriodo,
					brassaco: true,
				},
			}),
			db.despesas.aggregate({
				where: {
					...filtroPeriodo,
					brassaco: true,
				},
				_sum: {
					valor: true,
				},
			}),
		]);

	return {
		totalDespesas,
		totalValorDespesas: getNumeroSeguro(agregadoTotalDespesas._sum.valor),
		totalDespesasBrassaco,
		totalValorDespesasBrassaco: getNumeroSeguro(agregadoBrassaco._sum.valor),
	};
}

export async function obterResumoDespesasPorContaNoPeriodo(
	ano: number,
	mes: number,
): Promise<ResumoContaPeriodo[]> {
	const intervalo = getIntervaloMesAno(ano, mes);
	const despesas = await db.despesas.findMany({
		where: {
			data: {
				gte: intervalo.inicio,
				lte: intervalo.fim,
			},
		},
		select: {
			conta: true,
			valor: true,
		},
	});

	return acumularDespesasPorConta(despesas);
}

export async function obterResumoDespesasPorCategoriaNoPeriodo(
	ano: number,
	mes: number,
): Promise<ResumoCategoriaPeriodo[]> {
	const intervalo = getIntervaloMesAno(ano, mes);
	const despesas = await db.despesas.findMany({
		where: {
			data: {
				gte: intervalo.inicio,
				lte: intervalo.fim,
			},
		},
		select: {
			categoria: true,
			valor: true,
		},
	});

	return acumularDespesasPorCategoria(despesas);
}
