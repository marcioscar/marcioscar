import { useMemo } from "react";
import { Form, Link, useLoaderData, useSubmit } from "react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { CreditCard, HandCoins, Landmark, Receipt, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
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
	type CategoriaComDespesas,
} from "~/models/dashboard.server";
import { CONTAS_DESPESA } from "~/components/despesas/despesa-options";
import { DespesasPieChart } from "~/components/dashboard/despesas-pie-chart";
import { CategoriasBarChart } from "~/components/dashboard/categorias-bar-chart";
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
	saldosPorCategoria: CategoriaComDespesas[];
	categoriasTrend: CategoriasMesItem[];
};

type ContaConfig = { cor: string; Icone: LucideIcon };

const CONTA_CONFIG: Record<string, ContaConfig> = {
	Corrente: { cor: "#0ea5e9", Icone: Landmark },
	"Cartão Itau": { cor: "#f97316", Icone: CreditCard },
	Nubank: { cor: "#a855f7", Icone: CreditCard },
	"Cartão Camila": { cor: "#14b8a6", Icone: CreditCard },
};

function getContaConfig(conta: string): ContaConfig {
	return CONTA_CONFIG[conta] ?? { cor: "#6b7280", Icone: CreditCard };
}

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

			{/* --- Cards principais --- */}
			<section className='grid min-w-0 gap-4 sm:grid-cols-2'>
				{/* Total de despesas */}
				<Card className='min-w-0 overflow-hidden'>
					<CardHeader>
						<div className='flex items-start justify-between gap-3'>
							<div className='grid gap-0.5'>
								<CardDescription>Total de despesas</CardDescription>
								<CardTitle className='text-3xl font-bold tabular-nums'>
									{formatarMoeda(totalValorDespesasPeriodo)}
								</CardTitle>
							</div>
							<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40'>
								<Receipt size={18} className='text-blue-600 dark:text-blue-400' />
							</div>
						</div>
					</CardHeader>
					<CardContent className='flex items-end justify-between gap-4'>
						<div className='flex flex-col gap-1'>
							<p className='text-muted-foreground text-xs'>
								{totalDespesasPeriodo} despesas · {getNomeMes(filtroMes)} {filtroAno}
							</p>
							{(() => {
								const pct = calcPct(totalValorDespesasPeriodo, totalValorDespesasMesAnterior);
								if (pct === null) return null;
								const subindo = pct > 0;
								return (
									<p className={`flex items-center gap-1 text-xs font-medium ${subindo ? "text-red-500" : "text-emerald-600"}`}>
										{subindo ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
										{Math.abs(pct).toFixed(1)}% vs {labelAnterior}
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

				{/* Brassaco */}
				<Card className={`min-w-0 overflow-hidden ${saldoBrassaco > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"}`}>
					<CardHeader>
						<div className='flex items-start justify-between gap-3'>
							<div className='grid gap-0.5'>
								<CardDescription>Brassaco · {totalDespesasBrassaco} despesas</CardDescription>
								<CardTitle className={`text-3xl font-bold tabular-nums ${saldoBrassaco > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
									{formatarMoeda(saldoBrassaco)}
								</CardTitle>
							</div>
							<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${saldoBrassaco > 0 ? "bg-red-100 dark:bg-red-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"}`}>
								<HandCoins size={18} className={saldoBrassaco > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"} />
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<p className='text-muted-foreground text-xs'>
							{formatarMoeda(totalPagoBrassaco)} pago no total
						</p>
					</CardContent>
				</Card>
			</section>

			{/* --- Cards por conta --- */}
			<section className='grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
				{saldosPorContaExibicao.map((saldoConta) => {
					const { cor, Icone } = getContaConfig(saldoConta.conta);
					const anterior = mapaContaMesAnterior.get(saldoConta.conta) ?? 0;
					const pct = calcPct(saldoConta.totalValorDespesas, anterior);
					const subindo = (pct ?? 0) > 0;
					return (
						<Card
							key={saldoConta.conta}
							className='min-w-0 overflow-hidden'
							style={{ borderTop: `3px solid ${cor}` }}>
							<CardHeader className='pb-2'>
								<div className='flex items-center justify-between gap-2'>
									<CardDescription className='text-xs font-medium'>
										{saldoConta.conta}
									</CardDescription>
									<div
										className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full'
										style={{ background: `${cor}20` }}>
										<Icone size={13} style={{ color: cor }} />
									</div>
								</div>
							</CardHeader>
							<CardContent className='pt-0'>
								<p className='text-xl font-bold tabular-nums'>
									{formatarMoeda(saldoConta.totalValorDespesas)}
								</p>
								<div className='mt-1 flex items-center justify-between'>
									<p className='text-muted-foreground text-xs'>
										{saldoConta.totalDespesas} desp.
									</p>
									{pct !== null && (
										<p className={`flex items-center gap-0.5 text-xs font-medium ${subindo ? "text-red-500" : "text-emerald-600"}`}>
											{subindo ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
											{Math.abs(pct).toFixed(1)}%
										</p>
									)}
								</div>
							</CardContent>
						</Card>
					);
				})}
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
				<CategoriasBarChart
					title='Despesas por categoria'
					description={`${getNomeMes(filtroMes)} / ${filtroAno}`}
					items={saldosPorCategoria.map((item) => ({
						label: item.categoria,
						valor: item.totalValorDespesas,
						quantidade: item.totalDespesas,
						despesas: item.despesas,
					}))}
				/>
			</section>

			<CategoriasTrendChart dados={categoriasTrend} />
		</main>
	);
}
