import { useMemo } from "react";
import { Form, Link, useLoaderData, useSubmit } from "react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { Route } from "./+types/home";
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
	obterCategoriasPorUltimosMeses,
	type CategoriasMesItem,
} from "~/models/dashboard.server";
import { CONTAS_DESPESA } from "~/components/despesas/despesa-options";
import { DespesasPieChart } from "~/components/dashboard/despesas-pie-chart";
import { CategoriasTrendChart } from "~/components/dashboard/categorias-trend-chart";
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
	totalValorDespesasMesAnterior: number;
	saldoBrassaco: number;
	totalDespesasBrassaco: number;
	totalPagoBrassaco: number;
	saldosPorConta: {
		conta: string;
		totalDespesas: number;
		totalValorDespesas: number;
	}[];
	saldosPorContaMesAnterior: {
		conta: string;
		totalValorDespesas: number;
	}[];
	saldosPorCategoria: {
		categoria: string;
		totalDespesas: number;
		totalValorDespesas: number;
	}[];
	categoriasTrend: CategoriasMesItem[];
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

function getNomeMesAbreviado(mes: number): string {
	const data = new Date(Date.UTC(2025, mes - 1, 1));
	return data.toLocaleString("pt-BR", {
		month: "short",
		timeZone: "UTC",
	});
}

function getPrevMesAno(mes: number, ano: number) {
	if (mes === 1) return { mes: 12, ano: ano - 1 };
	return { mes: mes - 1, ano };
}

function getNextMesAno(mes: number, ano: number) {
	if (mes === 12) return { mes: 1, ano: ano + 1 };
	return { mes: mes + 1, ano };
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
		if (saldoConta) return saldoConta;
		return { conta, totalDespesas: 0, totalValorDespesas: 0 };
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
	const prev = getPrevMesAno(filtroMes, filtroAno);

	const [
		resumoBrassaco,
		resumoDespesasPeriodo,
		resumoDespesasMesAnterior,
		saldosPorConta,
		saldosPorContaMesAnterior,
		saldosPorCategoria,
		categoriasTrend,
	] = await Promise.all([
		obterResumoDashboardBrassaco(6),
		obterResumoDespesasPorPeriodo(filtroAno, filtroMes),
		obterResumoDespesasPorPeriodo(prev.ano, prev.mes),
		obterResumoDespesasPorContaNoPeriodo(filtroAno, filtroMes),
		obterResumoDespesasPorContaNoPeriodo(prev.ano, prev.mes),
		obterResumoDespesasPorCategoriaNoPeriodo(filtroAno, filtroMes),
		obterCategoriasPorUltimosMeses(6),
	]);

	return {
		filtroMes,
		filtroAno,
		totalDespesasPeriodo: resumoDespesasPeriodo.totalDespesas,
		totalValorDespesasPeriodo: resumoDespesasPeriodo.totalValorDespesas,
		totalValorDespesasMesAnterior: resumoDespesasMesAnterior.totalValorDespesas,
		saldoBrassaco: resumoBrassaco.saldoBrassaco,
		totalDespesasBrassaco: resumoBrassaco.totalDespesasBrassaco,
		totalPagoBrassaco: resumoBrassaco.totalPagoBrassaco,
		saldosPorConta,
		saldosPorContaMesAnterior,
		saldosPorCategoria,
		categoriasTrend,
	};
}

const NAV_BTN =
	"inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors";
const SELECT_CLASS =
	"border-input bg-background rounded-md border px-3 py-2 text-sm capitalize";

const COR_ANTERIOR = "#94a3b8";
const COR_ATUAL = "#3b82f6";

function calcPct(atual: number, anterior: number) {
	if (anterior <= 0) return null;
	return ((atual - anterior) / anterior) * 100;
}

type MiniBarChartProps = {
	atual: number;
	anterior: number;
	labelAnterior: string;
	labelAtual: string;
};

function MiniBarChart({ atual, anterior, labelAnterior, labelAtual }: MiniBarChartProps) {
	const data = [
		{ label: labelAnterior, valor: anterior, cor: COR_ANTERIOR },
		{ label: labelAtual, valor: atual, cor: COR_ATUAL },
	];

	return (
		<ResponsiveContainer width='100%' height={64}>
			<BarChart data={data} barSize={28} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
				<XAxis
					dataKey='label'
					axisLine={false}
					tickLine={false}
					tick={{ fontSize: 9, fill: "#94a3b8" }}
				/>
				<Bar dataKey='valor' radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={false}>
					{data.map((item, i) => (
						<Cell key={i} fill={item.cor} />
					))}
				</Bar>
				<Tooltip
					cursor={{ fill: "transparent" }}
					content={({ active, payload }) => {
						if (!active || !payload?.length) return null;
						const item = payload[0];
						return (
							<div className='rounded-md border border-border bg-background px-2.5 py-1.5 text-xs shadow-sm'>
								<p className='text-muted-foreground'>{item?.payload?.label}</p>
								<p className='font-medium tabular-nums'>
									{formatarMoeda(Number(item?.value ?? 0))}
								</p>
							</div>
						);
					}}
				/>
			</BarChart>
		</ResponsiveContainer>
	);
}

export default function Home() {
	const {
		filtroMes,
		filtroAno,
		totalDespesasPeriodo,
		totalValorDespesasPeriodo,
		totalValorDespesasMesAnterior,
		saldosPorConta,
		saldosPorContaMesAnterior,
		saldosPorCategoria,
		saldoBrassaco,
		totalDespesasBrassaco,
		totalPagoBrassaco,
		categoriasTrend,
	} = useLoaderData<typeof loader>();

	const submit = useSubmit();
	const opcoesAno = useMemo(() => getOpcoesAno(getMesAnoAtual().ano), []);
	const saldosPorContaExibicao = useMemo(
		() => montarSaldosPorContaComPadrao(saldosPorConta),
		[saldosPorConta],
	);
	const mapaContaMesAnterior = useMemo(
		() => new Map(saldosPorContaMesAnterior.map((c) => [c.conta, c.totalValorDespesas])),
		[saldosPorContaMesAnterior],
	);

	const prev = getPrevMesAno(filtroMes, filtroAno);
	const next = getNextMesAno(filtroMes, filtroAno);
	const labelAnterior = getNomeMesAbreviado(prev.mes);
	const labelAtual = getNomeMesAbreviado(filtroMes);

	return (
		<main className='grid gap-4 md:gap-6'>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<h1 className='text-2xl font-bold'>Dashboard</h1>
				<div className='flex items-center gap-2'>
					<Link
						to={`?mes=${prev.mes}&ano=${prev.ano}`}
						className={NAV_BTN}
						aria-label='Mês anterior'>
						←
					</Link>
					<Form method='get' className='flex items-center gap-2'>
						<select
							name='mes'
							value={String(filtroMes)}
							onChange={(e) => submit(e.currentTarget.form)}
							className={SELECT_CLASS}>
							{Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
								<option key={mes} value={mes}>
									{getNomeMes(mes)}
								</option>
							))}
						</select>
						<select
							name='ano'
							value={String(filtroAno)}
							onChange={(e) => submit(e.currentTarget.form)}
							className={SELECT_CLASS}>
							{opcoesAno.map((ano) => (
								<option key={ano} value={ano}>
									{ano}
								</option>
							))}
						</select>
					</Form>
					<Link
						to={`?mes=${next.mes}&ano=${next.ano}`}
						className={NAV_BTN}
						aria-label='Próximo mês'>
						→
					</Link>
				</div>
			</div>

			<section className='grid min-w-0 gap-4 sm:grid-cols-2'>
				<Card className={statCardSurfaceClass}>
					<CardHeader>
						<CardTitle className={statCardTitleClass}>
							Total de despesas no período
						</CardTitle>
						<CardDescription className={statCardLabelClass}>
							{getNomeMes(filtroMes)} / {filtroAno}
						</CardDescription>
					</CardHeader>
					<CardContent className='flex items-center justify-between gap-4'>
						<div className='flex min-w-0 flex-col gap-1'>
							<p className={statCardMetricLgClass}>
								{formatarMoeda(totalValorDespesasPeriodo)}
							</p>
							<p className={statCardCaptionClass}>
								{totalDespesasPeriodo} despesa(s)
							</p>
							{(() => {
								const pct = calcPct(totalValorDespesasPeriodo, totalValorDespesasMesAnterior);
								if (pct === null) return null;
								const subindo = pct > 0;
								return (
									<p className={`text-xs font-medium ${subindo ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
										{subindo ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
									</p>
								);
							})()}
						</div>
						<div className='w-28 shrink-0'>
							<MiniBarChart
								atual={totalValorDespesasPeriodo}
								anterior={totalValorDespesasMesAnterior}
								labelAnterior={labelAnterior}
								labelAtual={labelAtual}
							/>
						</div>
					</CardContent>
				</Card>

				<Card className={statCardSurfaceClass}>
					<CardHeader>
						<CardTitle className={statCardTitleClass}>Brassaco</CardTitle>
						<CardDescription className={statCardLabelClass}>
							Saldo acumulado · {totalDespesasBrassaco} despesa(s)
						</CardDescription>
					</CardHeader>
					<CardContent className='flex flex-col gap-1'>
						<p
							className={`${statCardMetricLgClass} ${
								saldoBrassaco > 0
									? "text-red-500 dark:text-red-400"
									: "text-emerald-600 dark:text-emerald-400"
							}`}>
							{formatarMoeda(saldoBrassaco)}
						</p>
						<p className={statCardCaptionClass}>
							{formatarMoeda(totalPagoBrassaco)} pago
						</p>
					</CardContent>
				</Card>
			</section>

			<section className='grid min-w-0 gap-4 sm:grid-cols-2'>
				{saldosPorContaExibicao.length > 0 ? (
					saldosPorContaExibicao.map((saldoConta) => {
						const anterior = mapaContaMesAnterior.get(saldoConta.conta) ?? 0;
						const pct = calcPct(saldoConta.totalValorDespesas, anterior);
						const subindo = (pct ?? 0) > 0;
						return (
							<Card key={saldoConta.conta} className={statCardSurfaceClass}>
								<CardHeader>
									<CardTitle className={statCardTitleClass}>
										{saldoConta.conta}
									</CardTitle>
								</CardHeader>
								<CardContent className='flex items-center justify-between gap-4'>
									<div className='flex min-w-0 flex-col gap-1'>
										<p className={statCardMetricLgClass}>
											{formatarMoeda(saldoConta.totalValorDespesas)}
										</p>
										<p className={statCardCaptionClass}>
											{saldoConta.totalDespesas} despesa(s)
										</p>
										{pct !== null && (
											<p className={`text-xs font-medium ${subindo ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
												{subindo ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
											</p>
										)}
									</div>
									<div className='w-28 shrink-0'>
										<MiniBarChart
											atual={saldoConta.totalValorDespesas}
											anterior={anterior}
											labelAnterior={labelAnterior}
											labelAtual={labelAtual}
										/>
									</div>
								</CardContent>
							</Card>
						);
					})
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
								Nenhuma despesa encontrada para o período selecionado.
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

			<CategoriasTrendChart dados={categoriasTrend} />
		</main>
	);
}
