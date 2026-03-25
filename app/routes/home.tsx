import { useMemo } from "react";
import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	obterResumoDashboardBrassaco,
	obterResumoDespesasPorCategoriaNoPeriodo,
	obterResumoDespesasPorContaNoPeriodo,
	obterResumoDespesasPorPeriodo,
} from "~/models/dashboard.server";
import { CONTAS_DESPESA } from "~/components/despesas/despesa-options";
import { DespesasPieChart } from "~/components/dashboard/despesas-pie-chart";
import {
	statCardCaptionClass,
	statCardLabelClass,
	statCardMetricLgClass,
	statCardSurfaceClass,
	statCardTitleClass,
} from "~/lib/stat-card-gradient";

type LoaderData = {
	filtroMes: number;
	filtroAno: number;
	totalDespesasPeriodo: number;
	totalValorDespesasPeriodo: number;
	saldoBrassaco: number;
	totalDespesasBrassaco: number;
	totalPagoBrassaco: number;
	saldosPorConta: {
		conta: string;
		totalDespesas: number;
		totalValorDespesas: number;
	}[];
	saldosPorCategoria: {
		categoria: string;
		totalDespesas: number;
		totalValorDespesas: number;
	}[];
};

const PALETA_CONTA = [
	"#0ea5e9",
	"#f97316",
	"#a855f7",
	"#14b8a6",
	"#22c55e",
	"#06b6d4",
] as const;

const PALETA_CATEGORIA = [
	"#f97316",
	"#ef4444",
	"#eab308",
	"#a855f7",
	"#ec4899",
	"#84cc16",
	"#f59e0b",
] as const;

function formatarMoeda(valor: number): string {
	return valor.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}

function getMesAnoAtual(): { mes: number; ano: number } {
	const hoje = new Date();
	return {
		mes: hoje.getUTCMonth() + 1,
		ano: hoje.getUTCFullYear(),
	};
}

function parseMes(valor: string | null, fallback: number): number {
	const parsed = Number(valor);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
		return fallback;
	}
	return parsed;
}

function parseAno(valor: string | null, fallback: number): number {
	const parsed = Number(valor);
	if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
		return fallback;
	}
	return parsed;
}

function getOpcoesAno(anoBase: number): number[] {
	return [anoBase - 3, anoBase - 2, anoBase - 1, anoBase, anoBase + 1];
}

function getNomeMes(mes: number): string {
	const data = new Date(Date.UTC(2025, mes - 1, 1));
	return data.toLocaleString("pt-BR", {
		month: "long",
		timeZone: "UTC",
	});
}

function montarSaldosPorContaComPadrao(
	saldosPorConta: LoaderData["saldosPorConta"],
): LoaderData["saldosPorConta"] {
	const contasPadrao: readonly string[] = CONTAS_DESPESA;
	const mapaSaldos = new Map(
		saldosPorConta.map((item) => [item.conta, item] as const),
	);

	const contasBase = contasPadrao.map((conta) => {
		const saldoConta = mapaSaldos.get(conta);
		if (saldoConta) {
			return saldoConta;
		}

		return {
			conta,
			totalDespesas: 0,
			totalValorDespesas: 0,
		};
	});

	const extras = saldosPorConta.filter(
		(item) => !contasPadrao.includes(item.conta),
	);

	return [...contasBase, ...extras];
}

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Home | Marcioscar" },
		{ name: "description", content: "Dashboard financeiro do Marcioscar" },
	];
}

export async function loader({
	request,
}: Route.LoaderArgs): Promise<LoaderData> {
	const url = new URL(request.url);
	const mesAnoAtual = getMesAnoAtual();
	const filtroMes = parseMes(url.searchParams.get("mes"), mesAnoAtual.mes);
	const filtroAno = parseAno(url.searchParams.get("ano"), mesAnoAtual.ano);

	const [
		resumoBrassaco,
		resumoDespesasPeriodo,
		saldosPorConta,
		saldosPorCategoria,
	] = await Promise.all([
		obterResumoDashboardBrassaco(6),
		obterResumoDespesasPorPeriodo(filtroAno, filtroMes),
		obterResumoDespesasPorContaNoPeriodo(filtroAno, filtroMes),
		obterResumoDespesasPorCategoriaNoPeriodo(filtroAno, filtroMes),
	]);

	return {
		filtroMes,
		filtroAno,
		totalDespesasPeriodo: resumoDespesasPeriodo.totalDespesas,
		totalValorDespesasPeriodo: resumoDespesasPeriodo.totalValorDespesas,
		saldoBrassaco: resumoBrassaco.saldoBrassaco,
		totalDespesasBrassaco: resumoBrassaco.totalDespesasBrassaco,
		totalPagoBrassaco: resumoBrassaco.totalPagoBrassaco,
		saldosPorConta,
		saldosPorCategoria,
	};
}

export default function Home() {
	const {
		filtroMes,
		filtroAno,
		totalDespesasPeriodo,
		totalValorDespesasPeriodo,
		saldosPorConta,
		saldosPorCategoria,
	} = useLoaderData<typeof loader>();
	const opcoesAno = useMemo(() => getOpcoesAno(getMesAnoAtual().ano), []);
	const saldosPorContaExibicao = useMemo(
		() => montarSaldosPorContaComPadrao(saldosPorConta),
		[saldosPorConta],
	);

	return (
		<main className='grid gap-4 md:gap-6'>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<div className='flex flex-col gap-1'>
					<h1 className='text-2xl font-bold'>Dashboard</h1>
				</div>
				<Form method='get' className='flex flex-wrap items-end gap-2'>
					<label className='grid gap-1 text-sm'>
						Mes
						<select
							name='mes'
							defaultValue={String(filtroMes)}
							className='border-input bg-background rounded-md border px-3 py-2 capitalize'>
							{Array.from({ length: 12 }, (_, index) => index + 1).map(
								(mes) => (
									<option key={mes} value={mes}>
										{getNomeMes(mes)}
									</option>
								),
							)}
						</select>
					</label>
					<label className='grid gap-1 text-sm'>
						Ano
						<select
							name='ano'
							defaultValue={String(filtroAno)}
							className='border-input bg-background rounded-md border px-3 py-2'>
							{opcoesAno.map((ano) => (
								<option key={ano} value={ano}>
									{ano}
								</option>
							))}
						</select>
					</label>
					<Button type='submit' variant='outline'>
						Aplicar
					</Button>
				</Form>
			</div>

			<section className='grid min-w-0 gap-4 md:grid-cols-2'>
				<Card className={statCardSurfaceClass}>
					<CardHeader>
						<CardTitle className={statCardTitleClass}>
							Total de despesas no periodo
						</CardTitle>
						<CardDescription className={statCardLabelClass}>
							{getNomeMes(filtroMes)} / {filtroAno}
						</CardDescription>
					</CardHeader>
					<CardContent className='flex flex-col gap-1'>
						<p className={statCardMetricLgClass}>
							{formatarMoeda(totalValorDespesasPeriodo)}
						</p>
						<p className={statCardCaptionClass}>
							{totalDespesasPeriodo} despesa(s) no periodo
						</p>
					</CardContent>
				</Card>

				{saldosPorContaExibicao.length > 0 ? (
					saldosPorContaExibicao.map((saldoConta) => (
						<Card key={saldoConta.conta} className={statCardSurfaceClass}>
							<CardHeader>
								<CardTitle className={statCardTitleClass}>
									{saldoConta.conta}
								</CardTitle>
							</CardHeader>
							<CardContent className='flex flex-col gap-1'>
								<p className={statCardMetricLgClass}>
									{formatarMoeda(saldoConta.totalValorDespesas)}
								</p>
								<p className={statCardCaptionClass}>
									{saldoConta.totalDespesas} despesa(s)
								</p>
							</CardContent>
						</Card>
					))
				) : (
					<Card className={statCardSurfaceClass}>
						<CardHeader>
							<CardTitle className={statCardTitleClass}>
								Despesas por conta
							</CardTitle>
							<CardDescription className={statCardLabelClass}>
								{getNomeMes(filtroMes)} / {filtroAno}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className={statCardCaptionClass}>
								Nenhuma despesa encontrada para o periodo selecionado.
							</p>
						</CardContent>
					</Card>
				)}
			</section>

			<section className='grid gap-4 md:grid-cols-2'>
				<DespesasPieChart
					title='Despesas por conta'
					description={`${getNomeMes(filtroMes)} / ${filtroAno}`}
					palette={PALETA_CONTA}
					items={saldosPorContaExibicao.map((item) => ({
						label: item.conta,
						valor: item.totalValorDespesas,
						quantidade: item.totalDespesas,
					}))}
				/>
				<DespesasPieChart
					title='Despesas por categoria'
					description={`${getNomeMes(filtroMes)} / ${filtroAno}`}
					palette={PALETA_CATEGORIA}
					items={saldosPorCategoria.map((item) => ({
						label: item.categoria,
						valor: item.totalValorDespesas,
						quantidade: item.totalDespesas,
					}))}
				/>
			</section>
		</main>
	);
}
