"use client";

import { useMemo } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { CategoriasMesItem } from "~/models/dashboard.server";

const PALETA = [
	"#f97316",
	"#3b82f6",
	"#a855f7",
	"#14b8a6",
	"#ef4444",
	"#eab308",
	"#94a3b8",
] as const;

function formatarMoeda(valor: number): string {
	return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarMoedaCurta(valor: number): string {
	if (valor >= 1000) return `R$${(valor / 1000).toFixed(1)}k`;
	return `R$${valor.toFixed(0)}`;
}

type Props = {
	dados: CategoriasMesItem[];
};

export function CategoriasTrendChart({ dados }: Props) {
	const categorias = useMemo(() => {
		const keys = new Set<string>();
		for (const d of dados) {
			for (const k of Object.keys(d)) {
				if (k !== "mes") keys.add(k);
			}
		}
		return Array.from(keys);
	}, [dados]);

	if (dados.length === 0 || categorias.length === 0) return null;

	return (
		<Card className='bg-linear-to-br from-card via-card to-muted/40 shadow-sm'>
			<CardHeader>
				<CardTitle>Evolução por categoria</CardTitle>
				<CardDescription>Últimos 6 meses</CardDescription>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width='100%' height={280}>
					<LineChart
						data={dados}
						margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
						<CartesianGrid
							strokeDasharray='3 3'
							vertical={false}
							stroke='currentColor'
							strokeOpacity={0.08}
						/>
						<XAxis
							dataKey='mes'
							axisLine={false}
							tickLine={false}
							tick={{ fontSize: 11, fill: "#94a3b8" }}
						/>
						<YAxis
							axisLine={false}
							tickLine={false}
							tick={{ fontSize: 10, fill: "#94a3b8" }}
							tickFormatter={formatarMoedaCurta}
							width={52}
						/>
						<Tooltip
							cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 2" }}
							content={({ active, payload, label }) => {
								if (!active || !payload?.length) return null;
								const ordenado = [...payload].sort(
									(a, b) => Number(b.value ?? 0) - Number(a.value ?? 0),
								);
								return (
									<div className='rounded-lg border border-border bg-background p-3 text-xs shadow-md'>
										<p className='mb-2 font-semibold text-foreground'>{label}</p>
										<div className='flex flex-col gap-1'>
											{ordenado.map((p) => (
												<div
													key={p.dataKey as string}
													className='flex items-center justify-between gap-6'>
													<div className='flex items-center gap-1.5'>
														<span
															className='h-2 w-2 shrink-0 rounded-full'
															style={{ backgroundColor: p.stroke as string }}
														/>
														<span className='text-muted-foreground'>
															{p.dataKey as string}
														</span>
													</div>
													<span className='font-medium tabular-nums'>
														{formatarMoeda(Number(p.value ?? 0))}
													</span>
												</div>
											))}
										</div>
									</div>
								);
							}}
						/>
						{categorias.map((cat, i) => (
							<Line
								key={cat}
								dataKey={cat}
								stroke={PALETA[i % PALETA.length]}
								strokeWidth={2}
								dot={{ r: 3, fill: PALETA[i % PALETA.length], strokeWidth: 0 }}
								activeDot={{ r: 5, strokeWidth: 0 }}
								isAnimationActive={false}
							/>
						))}
					</LineChart>
				</ResponsiveContainer>

				<div className='mt-3 flex flex-wrap gap-x-4 gap-y-1.5'>
					{categorias.map((cat, i) => (
						<div key={cat} className='flex items-center gap-1.5 text-xs'>
							<span
								className='h-2 w-2 shrink-0 rounded-full'
								style={{ backgroundColor: PALETA[i % PALETA.length] }}
							/>
							<span className='text-muted-foreground'>{cat}</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
