"use client";

import * as React from "react";
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	XAxis,
	YAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "~/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import type { CorridaDataTableRow } from "./corridas-columns";

type Periodo = "semana" | "mes";

const JANELA_SEMANAS = 8;
const JANELA_MESES = 6;

type GraficoPeriodoDado = {
	key: string;
	label: string;
	distanciaKm: number;
	paceMedioSegPorKm: number | null;
	quantidadeCorridas: number;
};

const chartConfig = {
	distanciaKm: {
		label: "Distância (km)",
		color: "#3b82f6",
	},
	paceMedioSegPorKm: {
		label: "Pace médio",
		color: "#f97316",
	},
} satisfies ChartConfig;

function isoWeekKey(date: Date): string {
	const d = new Date(date);
	d.setUTCHours(0, 0, 0, 0);
	const day = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(
		((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
	);
	return `${d.getUTCFullYear()}-W${week.toString().padStart(2, "0")}`;
}

function weekStartLabel(date: Date): string {
	const d = new Date(date);
	const day = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() - day + 1);
	return d.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		timeZone: "UTC",
	});
}

function monthKey(date: Date): string {
	const d = new Date(date);
	return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
	return new Date(date).toLocaleDateString("pt-BR", {
		month: "short",
		year: "2-digit",
		timeZone: "UTC",
	});
}

function agruparPorPeriodo(
	corridas: CorridaDataTableRow[],
	periodo: Periodo,
): GraficoPeriodoDado[] {
	const grupos = new Map<
		string,
		{
			label: string;
			totalDistanciaMetros: number;
			totalTempoSeg: number;
			count: number;
		}
	>();

	for (const corrida of corridas) {
		const data = new Date(corrida.dataInicio);
		const key = periodo === "semana" ? isoWeekKey(data) : monthKey(data);
		const label =
			periodo === "semana" ? weekStartLabel(data) : monthLabel(data);

		const existente = grupos.get(key);
		if (existente) {
			existente.totalDistanciaMetros += corrida.distanciaMetros;
			existente.totalTempoSeg += corrida.tempoMovimentoSeg;
			existente.count += 1;
		} else {
			grupos.set(key, {
				label,
				totalDistanciaMetros: corrida.distanciaMetros,
				totalTempoSeg: corrida.tempoMovimentoSeg,
				count: 1,
			});
		}
	}

	const ordenados = [...grupos.entries()].sort((a, b) =>
		a[0].localeCompare(b[0]),
	);

	return ordenados.map(([key, g]) => {
		const distanciaKm = g.totalDistanciaMetros / 1000;
		const paceMedioSegPorKm =
			distanciaKm > 0 ? Math.round(g.totalTempoSeg / distanciaKm) : null;
		return {
			key,
			label: g.label,
			distanciaKm: Math.round(distanciaKm * 10) / 10,
			paceMedioSegPorKm,
			quantidadeCorridas: g.count,
		};
	});
}

function formatarPace(seg: number): string {
	const min = Math.floor(seg / 60);
	const s = seg % 60;
	return `${min}:${s.toString().padStart(2, "0")}`;
}

type Props = {
	corridas: CorridaDataTableRow[];
};

export function CorridasGraficosChart({ corridas }: Props) {
	const [periodo, setPeriodo] = React.useState<Periodo>("semana");
	const [pagina, setPagina] = React.useState(0);

	const todosDados = React.useMemo(
		() => agruparPorPeriodo(corridas, periodo),
		[corridas, periodo],
	);

	const janela = periodo === "semana" ? JANELA_SEMANAS : JANELA_MESES;
	const totalPaginas = Math.ceil(todosDados.length / janela);

	// pagina 0 = mais recente
	const dadosPagina = React.useMemo(() => {
		const fim = todosDados.length - pagina * janela;
		const inicio = Math.max(0, fim - janela);
		return todosDados.slice(inicio, fim);
	}, [todosDados, pagina, janela]);

	const pacesValidos = dadosPagina
		.map((d) => d.paceMedioSegPorKm)
		.filter((p): p is number => p !== null);

	const paceMin = pacesValidos.length > 0 ? Math.min(...pacesValidos) : 240;
	const paceMax = pacesValidos.length > 0 ? Math.max(...pacesValidos) : 480;
	const pacePadding = Math.round((paceMax - paceMin) * 0.25) || 30;

	function trocarPeriodo(novo: Periodo) {
		setPeriodo(novo);
		setPagina(0);
	}

	if (corridas.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Volume e pace por período</CardTitle>
					<CardDescription>Sem dados para exibir.</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	const podeVoltar = pagina < totalPaginas - 1;
	const podeAvancar = pagina > 0;

	return (
		<Card>
			<CardHeader>
				<div className='flex flex-wrap items-start justify-between gap-3'>
					<div>
						<CardTitle>Volume e pace por período</CardTitle>
						<CardDescription>
							Distância total (km) e pace médio por{" "}
							{periodo === "semana" ? "semana" : "mês"}.
						</CardDescription>
					</div>
					<Tabs
						value={periodo}
						onValueChange={(v) => trocarPeriodo(v as Periodo)}>
						<TabsList>
							<TabsTrigger value='semana'>Semanal</TabsTrigger>
							<TabsTrigger value='mes'>Mensal</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				<div className='w-full min-w-0 overflow-x-auto'>
					<ChartContainer
						config={chartConfig}
						className='aspect-auto h-[min(360px,60vh)] w-full min-h-[240px] min-w-[480px]'>
						<ComposedChart
							data={dadosPagina}
							margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey='label'
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								tick={{ fontSize: 11 }}
							/>
							<YAxis
								yAxisId='distancia'
								orientation='left'
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								tickFormatter={(v) => `${v}km`}
							/>
							<YAxis
								yAxisId='pace'
								orientation='right'
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								domain={[paceMin - pacePadding, paceMax + pacePadding]}
								tickFormatter={(v) => formatarPace(Number(v))}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(label, payload) => {
											const item = payload?.[0]?.payload as
												| GraficoPeriodoDado
												| undefined;
											const qtd = item?.quantidadeCorridas ?? 0;
											return `${label} · ${qtd} corrida${qtd !== 1 ? "s" : ""}`;
										}}
										formatter={(value, name) => {
											if (name === "distanciaKm") {
												return (
													<span className='font-mono tabular-nums'>
														{value} km
													</span>
												);
											}
											if (
												name === "paceMedioSegPorKm" &&
												typeof value === "number"
											) {
												return (
													<span className='font-mono tabular-nums'>
														{formatarPace(value)} /km
													</span>
												);
											}
											return <span>{String(value)}</span>;
										}}
									/>
								}
							/>
							<ChartLegend content={<ChartLegendContent className='pt-3' />} />
							<Bar
								yAxisId='distancia'
								dataKey='distanciaKm'
								fill='var(--color-distanciaKm)'
								radius={[4, 4, 0, 0]}
								maxBarSize={56}
							/>
							<Line
								yAxisId='pace'
								dataKey='paceMedioSegPorKm'
								stroke='var(--color-paceMedioSegPorKm)'
								strokeWidth={2}
								dot={{ r: 3, fill: "var(--color-paceMedioSegPorKm)" }}
								activeDot={{ r: 5 }}
								connectNulls={false}
							/>
						</ComposedChart>
					</ChartContainer>
				</div>

				<div className='flex items-center justify-between gap-2'>
					<Button
						variant='outline'
						size='sm'
						onClick={() => setPagina((p) => p + 1)}
						disabled={!podeVoltar}>
						← Anterior
					</Button>
					<span className='text-muted-foreground text-xs'>
						{totalPaginas > 1
							? `${periodo === "semana" ? "semanas" : "meses"} ${todosDados.length - (pagina + 1) * janela + 1}–${Math.min(todosDados.length - pagina * janela, todosDados.length)} de ${todosDados.length}`
							: `${todosDados.length} ${periodo === "semana" ? "semana" + (todosDados.length !== 1 ? "s" : "") : "mes" + (todosDados.length !== 1 ? "es" : "")}`}
					</span>
					<Button
						variant='outline'
						size='sm'
						onClick={() => setPagina((p) => p - 1)}
						disabled={!podeAvancar}>
						Próximo →
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
