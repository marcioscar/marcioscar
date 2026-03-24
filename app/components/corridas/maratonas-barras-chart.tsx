"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import type { MaratonaBarrasDado } from "~/types/maratonas-barras";

const COR_PACE_MARATONA = "#022859";
const COR_TEMPO_MARATONA = "#F2CA50";

const chartConfig = {
	tempoTerminoSeg: {
		label: "Tempo de término (prova)",
		color: COR_TEMPO_MARATONA,
	},
	paceMedioGrafico: {
		label: "Pace médio",
		color: COR_PACE_MARATONA,
	},
} satisfies ChartConfig;

type LinhaBarras = MaratonaBarrasDado & {
	/** Valor numérico para a barra (0 se pace ausente) */
	paceMedioGrafico: number;
};

function formatarDuracaoSegundos(totalSeg: number): string {
	const seg = Math.max(0, Math.round(totalSeg));
	const h = Math.floor(seg / 3600);
	const m = Math.floor((seg % 3600) / 60);
	const s = seg % 60;
	if (h > 0) {
		return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
	}
	return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatarDuracaoEixoCompacto(seg: number): string {
	const s = Math.max(0, Math.round(seg));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	if (h > 0) {
		return `${h}h${m.toString().padStart(2, "0")}`;
	}
	return `${m}m`;
}

function formatarPaceSegParaExibicao(segundosPorKm: number): string {
	const segundos = Math.round(segundosPorKm);
	const minutos = Math.floor(segundos / 60);
	const seg = segundos % 60;
	return `${minutos}:${seg.toString().padStart(2, "0")}`;
}

function montarLinhasParaBarras(
	maratonas: MaratonaBarrasDado[],
): LinhaBarras[] {
	return maratonas.map((m) => ({
		...m,
		paceMedioGrafico: m.paceMedioSegPorKm ?? 0,
	}));
}

function formatarTooltipValorBarras(
	value: unknown,
	name: unknown,
	item: { payload?: unknown } | undefined,
): React.ReactNode {
	if (name === "tempoTerminoSeg" && typeof value === "number") {
		return (
			<span className='font-mono tabular-nums'>
				{formatarDuracaoSegundos(value)}
			</span>
		);
	}

	if (name === "paceMedioGrafico") {
		const linha = item?.payload as LinhaBarras | undefined;
		const original = linha?.paceMedioSegPorKm;
		if (original == null) {
			return <span className='text-muted-foreground'>—</span>;
		}
		return (
			<span className='font-mono tabular-nums'>
				{formatarPaceSegParaExibicao(original)} /km
			</span>
		);
	}

	return <span>{String(value)}</span>;
}

type MaratonasBarrasChartProps = {
	maratonas: MaratonaBarrasDado[];
};

export function MaratonasBarrasChart({ maratonas }: MaratonasBarrasChartProps) {
	const dados = React.useMemo(
		() => montarLinhasParaBarras(maratonas),
		[maratonas],
	);

	if (maratonas.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Maratonas — tempo e pace</CardTitle>
					<CardDescription>
						Nenhuma maratona (mais de 40 km) encontrada para montar o gráfico.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Maratonas — tempo de término e pace médio</CardTitle>
				<CardDescription>
					Até 15 maratonas mais recentes. Eixo Y esquerdo: tempo total da prova
					(elapsed). Eixo Y direito: pace médio (tempo em movimento ÷
					distância).
				</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-2'>
				<div className='w-full min-w-0 overflow-x-auto'>
					<ChartContainer
						config={chartConfig}
						className='aspect-auto h-[min(440px,75vh)] w-full min-h-[300px] min-w-[640px]'>
						<BarChart
							accessibilityLayer
							data={dados}
							margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey='label'
								tickLine={false}
								tickMargin={10}
								axisLine={false}
								interval={0}
								tick={{ fontSize: 10 }}
								angle={-32}
								textAnchor='end'
								height={88}
							/>
							<YAxis
								yAxisId='tempo'
								orientation='left'
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								tickFormatter={(v) => formatarDuracaoEixoCompacto(Number(v))}
							/>
							<YAxis
								yAxisId='pace'
								orientation='right'
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								tickFormatter={(v) => formatarPaceSegParaExibicao(Number(v))}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(_, payload) => {
											const nome = payload?.[0]?.payload?.nome;
											return typeof nome === "string" ? nome : "";
										}}
										formatter={(value, name, item) =>
											formatarTooltipValorBarras(value, name, item)
										}
									/>
								}
							/>
							<ChartLegend content={<ChartLegendContent className='pt-3' />} />
							<Bar
								yAxisId='tempo'
								dataKey='tempoTerminoSeg'
								fill='var(--color-tempoTerminoSeg)'
								radius={[4, 4, 0, 0]}
								name='tempoTerminoSeg'
							/>
							<Bar
								yAxisId='pace'
								dataKey='paceMedioGrafico'
								fill={COR_PACE_MARATONA}
								radius={[4, 4, 0, 0]}
								name='paceMedioGrafico'
							/>
						</BarChart>
					</ChartContainer>
				</div>
			</CardContent>
		</Card>
	);
}
