"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import type { VolumeSemanaItem } from "~/models/corrida-dashboard.server";

type Props = {
	dados: VolumeSemanaItem[];
};

export function CorridaVolumeChart({ dados }: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Tendência de volume semanal</CardTitle>
				<CardDescription>Últimas {dados.length} semanas, corrida (km)</CardDescription>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={200}>
					<BarChart data={dados} barSize={28} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
						<XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
						<YAxis hide domain={[0, (dataMax: number) => Math.ceil((dataMax || 10) * 1.15)]} />
						<Bar dataKey="km" radius={[5, 5, 0, 0]} isAnimationActive={false} activeBar={false}>
							{dados.map((item, i) => (
								<Cell
									key={i}
									fill="#3b82f6"
									opacity={item.emAndamento ? 0.4 : 1}
									stroke={item.emAndamento ? "#3b82f6" : undefined}
									strokeDasharray={item.emAndamento ? "3 2" : undefined}
								/>
							))}
						</Bar>
						<Tooltip
							cursor={{ fill: "transparent" }}
							content={({ active, payload }) => {
								if (!active || !payload?.length) return null;
								const item = payload[0]?.payload as VolumeSemanaItem | undefined;
								if (!item) return null;
								return (
									<div className="rounded-lg border border-border bg-background p-2.5 text-xs shadow-md">
										<p className="font-semibold text-foreground">Semana de {item.label}</p>
										<p className="tabular-nums text-foreground">
											{item.km} km{item.emAndamento ? " (em andamento)" : ""}
										</p>
									</div>
								);
							}}
						/>
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
