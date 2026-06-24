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
import type { CorridaDataTableRow } from "./corridas-columns";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const chartConfig = {
	estaSemanaDist: {
		label: "Esta semana",
		color: "#3b82f6",
	},
	semanaPassadaDist: {
		label: "Semana passada",
		color: "#94a3b8",
	},
	estaSemanaCum: {
		label: "Acum. esta semana",
		color: "#3b82f6",
	},
	semanaPassadaCum: {
		label: "Acum. semana passada",
		color: "#94a3b8",
	},
} satisfies ChartConfig;

type DadosDia = {
	nome: string;
	estaSemanaDist: number;
	semanaPassadaDist: number;
	estaSemanaCum: number | null;
	semanaPassadaCum: number;
	isHoje: boolean;
};

function getInicioSemana(date: Date): Date {
	const d = new Date(date);
	d.setUTCHours(0, 0, 0, 0);
	d.setUTCDate(d.getUTCDate() - d.getUTCDay());
	return d;
}

function calcularDadosSemana(corridas: CorridaDataTableRow[]): DadosDia[] {
	const agora = new Date();
	const inicioEsta = getInicioSemana(agora);
	const inicioAnterior = new Date(inicioEsta);
	inicioAnterior.setUTCDate(inicioAnterior.getUTCDate() - 7);

	const diaHoje = agora.getUTCDay();

	const estaSemana = new Array(7).fill(0) as number[];
	const semanaPassada = new Array(7).fill(0) as number[];

	for (const corrida of corridas) {
		const data = new Date(corrida.dataInicio);
		const distKm = corrida.distanciaMetros / 1000;
		const diaSemana = data.getUTCDay();

		if (data >= inicioEsta) {
			estaSemana[diaSemana] += distKm;
		} else if (data >= inicioAnterior) {
			semanaPassada[diaSemana] += distKm;
		}
	}

	let cumEsta = 0;
	let cumAnterior = 0;

	return DIAS_SEMANA.map((nome, i) => {
		cumAnterior += semanaPassada[i];

		const isFuturo = i > diaHoje;
		if (!isFuturo) {
			cumEsta += estaSemana[i];
		}

		return {
			nome,
			estaSemanaDist: Math.round(estaSemana[i] * 10) / 10,
			semanaPassadaDist: Math.round(semanaPassada[i] * 10) / 10,
			estaSemanaCum: isFuturo ? null : Math.round(cumEsta * 10) / 10,
			semanaPassadaCum: Math.round(cumAnterior * 10) / 10,
			isHoje: i === diaHoje,
		};
	});
}

function resumoSemana(dados: DadosDia[]) {
	const totalEsta = dados.reduce((s, d) => s + d.estaSemanaDist, 0);
	const totalAnterior = dados.reduce((s, d) => s + d.semanaPassadaDist, 0);
	return { totalEsta, totalAnterior };
}

type Props = {
	corridas: CorridaDataTableRow[];
};

export function CorridasSemanaChart({ corridas }: Props) {
	const dados = React.useMemo(() => calcularDadosSemana(corridas), [corridas]);
	const { totalEsta, totalAnterior } = resumoSemana(dados);

	const delta = totalEsta - totalAnterior;
	const deltaStr =
		delta >= 0
			? `+${delta.toFixed(1)} km`
			: `${delta.toFixed(1)} km`;

	return (
		<Card>
			<CardHeader>
				<div className='flex flex-wrap items-start justify-between gap-2'>
					<div>
						<CardTitle>Esta semana × semana passada</CardTitle>
						<CardDescription>
							Distância por dia e total acumulado.
						</CardDescription>
					</div>
					<div className='flex gap-4 text-sm'>
						<div className='text-right'>
							<p className='text-muted-foreground text-xs'>Esta semana</p>
							<p className='font-mono font-semibold text-blue-500'>
								{totalEsta.toFixed(1)} km
							</p>
						</div>
						<div className='text-right'>
							<p className='text-muted-foreground text-xs'>Semana passada</p>
							<p className='text-muted-foreground font-mono font-semibold'>
								{totalAnterior.toFixed(1)} km
							</p>
						</div>
						<div className='text-right'>
							<p className='text-muted-foreground text-xs'>Diferença</p>
							<p
								className={`font-mono font-semibold ${delta >= 0 ? "text-green-500" : "text-red-500"}`}>
								{deltaStr}
							</p>
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<ChartContainer
					config={chartConfig}
					className='h-[min(320px,55vh)] w-full min-h-[220px]'>
					<ComposedChart
						data={dados}
						margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey='nome'
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tick={({ x, y, payload, index }) => {
								const isHoje = dados[index]?.isHoje;
								return (
									<text
										x={x}
										y={y + 12}
										textAnchor='middle'
										fontSize={12}
										fontWeight={isHoje ? 700 : 400}
										fill={isHoje ? "#3b82f6" : "currentColor"}>
										{isHoje ? "Hoje" : payload.value}
									</text>
								);
							}}
						/>
						<YAxis
							yAxisId='dist'
							orientation='left'
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(v) => `${v}km`}
						/>
						<YAxis
							yAxisId='cum'
							orientation='right'
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(v) => `${v}km`}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={(value, name) => {
										const labels: Record<string, string> = {
											estaSemanaDist: "Esta semana",
											semanaPassadaDist: "Semana passada",
											estaSemanaCum: "Acum. esta semana",
											semanaPassadaCum: "Acum. semana passada",
										};
										return (
											<span className='font-mono tabular-nums'>
												{labels[name as string] ?? name}:{" "}
												{typeof value === "number" ? `${value} km` : "—"}
											</span>
										);
									}}
								/>
							}
						/>
						<ChartLegend
							content={
								<ChartLegendContent
									className='pt-3'
									payload={[
										{
											value: "estaSemanaDist",
											type: "square",
											color: "#3b82f6",
										},
										{
											value: "semanaPassadaDist",
											type: "square",
											color: "#94a3b8",
										},
									]}
								/>
							}
						/>
						<Bar
							yAxisId='dist'
							dataKey='semanaPassadaDist'
							fill='#94a3b8'
							radius={[3, 3, 0, 0]}
							maxBarSize={28}
							opacity={0.6}
						/>
						<Bar
							yAxisId='dist'
							dataKey='estaSemanaDist'
							fill='var(--color-estaSemanaDist)'
							radius={[3, 3, 0, 0]}
							maxBarSize={28}
						/>
						<Line
							yAxisId='cum'
							dataKey='semanaPassadaCum'
							stroke='#94a3b8'
							strokeWidth={2}
							strokeDasharray='4 2'
							dot={false}
							connectNulls
						/>
						<Line
							yAxisId='cum'
							dataKey='estaSemanaCum'
							stroke='var(--color-estaSemanaCum)'
							strokeWidth={2}
							dot={{ r: 3, fill: "#3b82f6" }}
							activeDot={{ r: 5 }}
							connectNulls={false}
						/>
					</ComposedChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
