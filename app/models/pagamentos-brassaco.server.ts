import { db } from "../../db.server";

type CriarPagamentoBrassacoInput = {
	valor: number;
	data: Date;
	obs?: string;
};

type ResumoSaldoBrassaco = {
	totalDespesasBrassaco: number;
	totalPagoBrassaco: number;
	saldoBrassaco: number;
	totalPagamentosBrassaco: number;
};

function normalizarTextoOpcional(valor?: string): string {
	return valor?.trim() ?? "";
}

function getNumeroSeguro(valor: number | null | undefined): number {
	return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function getSaldoBrassaco(totalDespesas: number, totalPago: number): number {
	return totalDespesas - totalPago;
}

async function obterTotalDespesasBrassaco(): Promise<number> {
	const agregado = await db.despesas.aggregate({
		where: { brassaco: true },
		_sum: {
			valor: true,
		},
	});

	return getNumeroSeguro(agregado._sum.valor);
}

async function obterTotaisPagamentoBrassaco(): Promise<{
	totalPagoBrassaco: number;
	totalPagamentosBrassaco: number;
}> {
	const [totalPagamentosBrassaco, agregadoPagamentos] = await Promise.all([
		db.pagamentosBrassaco.count(),
		db.pagamentosBrassaco.aggregate({
			_sum: {
				valor: true,
			},
		}),
	]);

	return {
		totalPagoBrassaco: getNumeroSeguro(agregadoPagamentos._sum.valor),
		totalPagamentosBrassaco,
	};
}

export async function criarPagamentoBrassaco(
	input: CriarPagamentoBrassacoInput,
): Promise<void> {
	const obs = normalizarTextoOpcional(input.obs);
	await db.pagamentosBrassaco.create({
		data: {
			valor: input.valor,
			data: input.data,
			obs,
		},
	});
}

export async function obterResumoSaldoBrassaco(): Promise<ResumoSaldoBrassaco> {
	const [totalDespesasBrassaco, totaisPagamento] = await Promise.all([
		obterTotalDespesasBrassaco(),
		obterTotaisPagamentoBrassaco(),
	]);

	return {
		totalDespesasBrassaco,
		totalPagoBrassaco: totaisPagamento.totalPagoBrassaco,
		saldoBrassaco: getSaldoBrassaco(
			totalDespesasBrassaco,
			totaisPagamento.totalPagoBrassaco,
		),
		totalPagamentosBrassaco: totaisPagamento.totalPagamentosBrassaco,
	};
}

