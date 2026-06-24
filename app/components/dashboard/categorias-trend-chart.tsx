"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import type { CategoriasMesItem } from "~/models/dashboard.server";

const PALETA = [
	"#f97316",
	"#3b82f6",
	"#a855f7",
	"#14b8a6",
	"#ef4444",
	"#eab308",
	"#22c55e",
	"#94a3b8",
] as const;

function formatarMoeda(valor: number): string {
	return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcPct(atual: number, anterior: number): number | null {
	if (anterior <= 0) return null;
	return ((atual - anterior) / anterior) * 100;
}

type Props = { dados: CategoriasMesItem[] };

export function CategoriasTrendChart({ dados }: Props) {
	const categorias = useMemo(() => {
		if (dados.length === 0) return [];

		const keys = Object.keys(dados[0]).filter((k) => k !== "mes");

		return keys
			.map((cat, idx) => {
				const valores = dados.map((d) => ({
					mes: d.mes as string,
					valor: (d[cat] as number) ?? 0,
				}));
				const atual = valores[valores.length - 1]?.valor ?? 0;
				const anterior = valores[valores.length - 2]?.valor ?? 0;
				return { cat, valores, atual, anterior, cor: PALETA[idx % PALETA.length] };
			})
			.filter((r) => r.atual > 0 || r.anterior > 0)
			.sort((a, b) => b.atual - a.atual);
	}, [dados]);

	if (categorias.length === 0) return null;

	return (
		<Card className='bg-linear-to-br from-card via-card to-muted/40 shadow-sm'>
			<CardHeader>
				<CardTitle>Evolução por categoria</CardTitle>
				<CardDescription>Comparativo com mês anterior · últimos 6 meses</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='grid grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-y-0 lg:gap-x-6'>
					{categorias.map(({ cat, valores, atual, anterior, cor }) => {
						const pct = calcPct(atual, anterior);
						const subindo = (pct ?? 0) > 0;

						return (
							<div key={cat} className='flex items-center gap-3 py-3 lg:border-b lg:border-border'>
								<span
									className='h-3 w-3 shrink-0 rounded-full'
									style={{ backgroundColor: cor }}
								/>

								<span className='w-28 shrink-0 truncate text-sm font-medium sm:w-36'>
									{cat}
								</span>

								<div className='min-w-0 flex-1'>
									<ResponsiveContainer width='100%' height={44}>
										<BarChart
											data={valores}
											barSize={14}
											margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
											<Bar
												dataKey='valor'
												radius={[3, 3, 0, 0]}
												isAnimationActive={false}
												activeBar={false}>
												{valores.map((_, i) => (
													<Cell
														key={i}
														fill={
															i === valores.length - 1
																? cor
																: `${cor}55`
														}
													/>
												))}
											</Bar>
											<Tooltip
												cursor={{ fill: "transparent" }}
												content={({ active, payload }) => {
													if (!active || !payload?.length) return null;
													const d = payload[0];
													return (
														<div className='rounded-md border border-border bg-background px-2.5 py-1.5 text-xs shadow-sm'>
															<p className='text-muted-foreground'>
																{d?.payload?.mes}
															</p>
															<p className='font-medium tabular-nums'>
																{formatarMoeda(Number(d?.value ?? 0))}
															</p>
														</div>
													);
												}}
											/>
										</BarChart>
									</ResponsiveContainer>
								</div>

								<div className='w-24 shrink-0 text-right sm:w-32'>
									<p className='text-sm font-semibold tabular-nums'>
										{formatarMoeda(atual)}
									</p>
									{pct !== null ? (
										<p
											className={`text-xs font-medium ${subindo ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
											{subindo ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
										</p>
									) : (
										<p className='text-xs text-muted-foreground'>—</p>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
