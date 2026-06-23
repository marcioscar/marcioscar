"use client";

import { useMemo } from "react";
import {
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";

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

type Item = {
	label: string;
	valor: number;
	quantidade: number;
};

type Props = {
	title: string;
	description: string;
	items: Item[];
};

const LIMITE = 8;

export function CategoriasBarChart({ title, description, items }: Props) {
	const ordenados = useMemo(
		() => [...items].sort((a, b) => b.valor - a.valor).slice(0, LIMITE),
		[items],
	);

	const total = useMemo(
		() => items.reduce((s, i) => s + i.valor, 0),
		[items],
	);

	if (items.length === 0) {
		return (
			<Card className='bg-linear-to-br from-card via-card to-muted/40 shadow-sm'>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardContent>
					<p className='text-sm text-muted-foreground'>
						Nenhuma despesa encontrada para o período selecionado.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className='bg-linear-to-br from-card via-card to-muted/40 shadow-sm'>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				{/* Bar chart */}
				<ResponsiveContainer width='100%' height={180}>
					<BarChart
						data={ordenados}
						barSize={28}
						margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
						<XAxis
							dataKey='label'
							axisLine={false}
							tickLine={false}
							tick={{ fontSize: 9, fill: "#94a3b8" }}
							interval={0}
							tickFormatter={(v: string) =>
								v.length > 6 ? v.slice(0, 5) + "…" : v
							}
						/>
						<Bar
							dataKey='valor'
							radius={[6, 6, 0, 0]}
							isAnimationActive={false}
							activeBar={false}>
							{ordenados.map((_, i) => (
								<Cell key={i} fill={PALETA[i % PALETA.length]} />
							))}
						</Bar>
						<Tooltip
							cursor={{ fill: "transparent" }}
							content={({ active, payload }) => {
								if (!active || !payload?.length) return null;
								const item = payload[0];
								const pct =
									total > 0
										? ((Number(item?.value ?? 0) / total) * 100).toFixed(1)
										: "0";
								return (
									<div className='rounded-lg border border-border bg-background p-2.5 text-xs shadow-md'>
										<p className='font-semibold text-foreground'>
											{item?.payload?.label}
										</p>
										<p className='tabular-nums text-foreground'>
											{formatarMoeda(Number(item?.value ?? 0))}
										</p>
										<p className='text-muted-foreground'>{pct}% do total</p>
									</div>
								);
							}}
						/>
					</BarChart>
				</ResponsiveContainer>

				{/* Total */}
				<div className='flex items-baseline justify-between border-b border-border pb-3'>
					<div>
						<p className='text-sm font-semibold'>Todos os gastos</p>
						<p className='text-xs text-muted-foreground'>
							{items.reduce((s, i) => s + i.quantidade, 0)} lançamentos
						</p>
					</div>
					<div className='text-right'>
						<p className='text-sm font-semibold tabular-nums'>
							{formatarMoeda(total)}
						</p>
						<p className='text-xs text-muted-foreground'>100%</p>
					</div>
				</div>

				{/* Category list */}
				<div className='flex flex-col gap-3'>
					{ordenados.map((item, i) => {
						const pct = total > 0 ? ((item.valor / total) * 100).toFixed(1) : "0";
						return (
							<div key={item.label} className='flex items-center gap-3'>
								<span
									className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold'
									style={{ backgroundColor: PALETA[i % PALETA.length] }}>
									{item.label.slice(0, 1).toUpperCase()}
								</span>
								<div className='flex min-w-0 flex-1 flex-col'>
									<span className='truncate text-sm font-medium'>
										{item.label}
									</span>
									<span className='text-xs text-muted-foreground'>
										{item.quantidade} lançamento(s)
									</span>
								</div>
								<div className='shrink-0 text-right'>
									<p className='text-sm font-semibold tabular-nums'>
										{formatarMoeda(item.valor)}
									</p>
									<p className='text-xs text-muted-foreground'>{pct}%</p>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
