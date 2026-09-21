"use client";

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "~/components/ui/chart";
import type { VolumeSemanaItem } from "~/models/corrida-dashboard.server";

type Props = {
	dados: VolumeSemanaItem[];
};

const chartConfig = {
	km: { label: "Volume", color: "var(--paleta-1)" },
} satisfies ChartConfig;

export function CorridaVolumeChart({ dados }: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Tendência de volume semanal</CardTitle>
				<CardDescription>Últimas {dados.length} semanas, corrida (km)</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig} className="aspect-auto h-50 w-full">
					<BarChart
						accessibilityLayer
						data={dados}
						barSize={28}
						margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
						<XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
						<YAxis hide domain={[0, (dataMax: number) => Math.ceil((dataMax || 10) * 1.15)]} />
						<Bar dataKey="km" radius={[5, 5, 0, 0]} isAnimationActive={false} activeBar={false}>
							{dados.map((item, i) => (
								<Cell
									key={i}
									fill="var(--color-km)"
									opacity={item.emAndamento ? 0.4 : 1}
									stroke={item.emAndamento ? "var(--color-km)" : undefined}
									strokeDasharray={item.emAndamento ? "3 2" : undefined}
								/>
							))}
						</Bar>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(_, payload) =>
										`Semana de ${payload?.[0]?.payload?.label ?? ""}`
									}
									formatter={(value, _name, item) => {
										const dado = item?.payload as VolumeSemanaItem | undefined;
										return (
											<span className="font-medium tabular-nums">
												{Number(value)} km
												{dado?.emAndamento ? " (em andamento)" : ""}
											</span>
										);
									}}
								/>
							}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
