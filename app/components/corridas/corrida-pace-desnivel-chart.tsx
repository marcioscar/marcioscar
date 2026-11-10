"use client";

import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "~/components/ui/chart";
import { VELOCIDADE_MINIMA_MPS } from "~/lib/rota";
import type { SplitMetric } from "~/types/analise";

type Props = {
	splits: SplitMetric[];
};

type DadoKm = {
	km: string;
	pace: number | null;
	paceAjustado: number | null;
	desnivel: number;
};

const chartConfig = {
	pace: { label: "Pace real", color: "var(--paleta-4)" },
	paceAjustado: { label: "Pace ajustado à inclinação", color: "var(--paleta-2)" },
	desnivel: { label: "Desnível", color: "var(--paleta-8)" },
} satisfies ChartConfig;

const SYNC_ID = "pace-desnivel";
const MARGEM = { left: 4, right: 12, top: 8, bottom: 0 };
const LARGURA_EIXO_Y = 48;

function formatarPace(segPorKm: number): string {
	const min = Math.floor(segPorKm / 60);
	const seg = Math.round(segPorKm % 60);
	return `${min}:${String(seg).padStart(2, "0")}`;
}

function paraPace(mps: number | undefined): number | null {
	// caminhada/pausa distorce a escala: fica como falha na linha
	return mps && mps >= VELOCIDADE_MINIMA_MPS ? Math.round(1000 / mps) : null;
}

function montarDados(splits: SplitMetric[]): DadoKm[] {
	return splits.map((s, i) => {
		// o último split costuma ser um km parcial
		const parcial = i === splits.length - 1 && s.distance < 950;
		return {
			km: parcial ? `${(s.distance / 1000).toFixed(1)}*` : String(s.split),
			pace: paraPace(s.average_speed),
			paceAjustado: paraPace(s.average_grade_adjusted_speed),
			desnivel: Math.round(s.elevation_difference),
		};
	});
}

export function CorridaPaceDesnivelChart({ splits }: Props) {
	const dados = montarDados(splits);
	const temAjustado = dados.some((d) => d.paceAjustado !== null);
	const paces = dados.flatMap((d) =>
		[d.pace, d.paceAjustado].filter((p): p is number => p !== null),
	);
	if (dados.length < 2 || paces.length === 0) {
		return null;
	}

	// marcas do eixo em valores redondos de pace (ex.: 5:00, 5:30, 6:00)
	const amplitude = Math.max(...paces) - Math.min(...paces);
	const passo = [10, 15, 20, 30, 60, 120].find((p) => amplitude / p <= 5) ?? 120;
	const dominioPace: [number, number] = [
		Math.floor(Math.min(...paces) / passo) * passo,
		Math.ceil(Math.max(...paces) / passo) * passo,
	];
	const marcasPace: number[] = [];
	for (let v = dominioPace[0]; v <= dominioPace[1]; v += passo) marcasPace.push(v);
	const temParcial = dados.some((d) => d.km.endsWith("*"));

	return (
		<div className='flex flex-col gap-2'>
			<div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
				<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
					Pace × subida, por km
				</p>
				<div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
					<span className='flex items-center gap-1.5'>
						<span aria-hidden className='h-0.5 w-4 rounded bg-paleta-4' />
						Pace real
					</span>
					{temAjustado && (
						<span className='flex items-center gap-1.5'>
							<span
								aria-hidden
								className='h-0 w-4 border-t-2 border-dashed border-paleta-2'
							/>
							Pace ajustado à inclinação
						</span>
					)}
					<span className='flex items-center gap-1.5'>
						<span aria-hidden className='size-2.5 rounded-[2px] bg-paleta-8' />
						Desnível do km
					</span>
				</div>
			</div>

			<div className='rounded-xl border border-border bg-card px-2 pt-3 pb-2'>
				{/* Dois painéis com o mesmo eixo de km: pace em cima, desnível embaixo */}
				<ChartContainer config={chartConfig} className='aspect-auto h-44 w-full'>
					<LineChart data={dados} syncId={SYNC_ID} margin={MARGEM}>
						<CartesianGrid vertical={false} />
						<XAxis dataKey='km' hide />
						<YAxis
							reversed
							width={LARGURA_EIXO_Y}
							domain={dominioPace}
							ticks={marcasPace}
							tickLine={false}
							axisLine={false}
							tickMargin={6}
							tickFormatter={(v) => formatarPace(Number(v))}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									labelFormatter={(label) => `Km ${String(label).replace("*", "")}`}
									formatter={(value, name) => (
										<div className='flex min-w-[190px] items-center justify-between gap-3'>
											<span className='text-muted-foreground'>
												{chartConfig[name as keyof typeof chartConfig]?.label ?? name}
											</span>
											<span className='font-medium tabular-nums'>
												{formatarPace(Number(value))}/km
											</span>
										</div>
									)}
								/>
							}
						/>
						<Line
							dataKey='pace'
							stroke='var(--color-pace)'
							strokeWidth={2}
							dot={{ r: 3, fill: "var(--color-pace)", strokeWidth: 0 }}
							activeDot={{ r: 5 }}
							connectNulls={false}
							isAnimationActive={false}
						/>
						{temAjustado && (
							<Line
								dataKey='paceAjustado'
								stroke='var(--color-paceAjustado)'
								strokeWidth={2}
								strokeDasharray='5 4'
								dot={false}
								activeDot={{ r: 4 }}
								connectNulls={false}
								isAnimationActive={false}
							/>
						)}
					</LineChart>
				</ChartContainer>

				<ChartContainer config={chartConfig} className='aspect-auto h-28 w-full'>
					<BarChart data={dados} syncId={SYNC_ID} margin={MARGEM}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey='km'
							tickLine={false}
							axisLine={false}
							tickMargin={6}
							tick={{ fontSize: 11 }}
						/>
						<YAxis
							width={LARGURA_EIXO_Y}
							tickLine={false}
							axisLine={false}
							tickMargin={6}
							tickFormatter={(v) => `${v} m`}
						/>
						<ReferenceLine y={0} stroke='var(--border)' />
						<ChartTooltip
							cursor={{ fill: "var(--muted)", opacity: 0.5 }}
							content={
								<ChartTooltipContent
									labelFormatter={(label) => `Km ${String(label).replace("*", "")}`}
									formatter={(value) => {
										const v = Number(value);
										return (
											<div className='flex min-w-[190px] items-center justify-between gap-3'>
												<span className='text-muted-foreground'>
													{v > 0 ? "Subiu" : v < 0 ? "Desceu" : "Plano"}
												</span>
												<span className='font-medium tabular-nums'>
													{Math.abs(v)} m
												</span>
											</div>
										);
									}}
								/>
							}
						/>
						<Bar
							dataKey='desnivel'
							fill='var(--color-desnivel)'
							radius={[4, 4, 0, 0]}
							maxBarSize={28}
							isAnimationActive={false}
						/>
					</BarChart>
				</ChartContainer>
			</div>

			<p className='text-xs text-muted-foreground'>
				Eixo do pace invertido: mais para cima é mais rápido. Barras acima de zero
				são km de subida; abaixo, de descida.
				{temParcial ? " * km parcial." : ""}
			</p>
		</div>
	);
}
