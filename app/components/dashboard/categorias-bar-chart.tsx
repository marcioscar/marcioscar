"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, XAxis } from "recharts";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
	DropletIcon,
	AppStoreIcon,
	Baby01Icon,
	UserCircleIcon,
	WorkoutRunIcon,
	Mortarboard01Icon,
	ElectricityStackIcon,
	Film01Icon,
	PillIcon,
	ComputerIcon,
	Cash01Icon,
	Home01Icon,
	Apple01Icon,
	Package01Icon,
	Bread01Icon,
	Restaurant01Icon,
	Hospital01Icon,
	ShoppingCart01Icon,
	Car01Icon,
	Shirt01Icon,
	Airplane01Icon,
	DrinkIcon,
	GlassesIcon,
} from "@hugeicons/core-free-icons";
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
import { getCorGrafico } from "~/lib/chart-palette";
import type { DespesaResumida } from "~/models/dashboard.server";

const CATEGORIA_ICONES: Record<string, IconSvgElement> = {
	Agua: DropletIcon,
	Apps: AppStoreIcon,
	Arthur: Baby01Icon,
	Camila: UserCircleIcon,
	Corrida: WorkoutRunIcon,
	"Educação": Mortarboard01Icon,
	Energia: ElectricityStackIcon,
	Entretenimento: Film01Icon,
	Farmacia: PillIcon,
	Hardware: ComputerIcon,
	Mesada: Cash01Icon,
	Moradia: Home01Icon,
	"Nutrição": Apple01Icon,
	Outros: Package01Icon,
	Padaria: Bread01Icon,
	Refeicao: Restaurant01Icon,
	"Saúde": Hospital01Icon,
	Supermercado: ShoppingCart01Icon,
	Transporte: Car01Icon,
	Vestuario: Shirt01Icon,
	Viagem: Airplane01Icon,
	Vinho: DrinkIcon,
	"Óculos": GlassesIcon,
};

function formatarMoeda(valor: number): string {
	return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date | string): string {
	const d = typeof data === "string" ? new Date(data) : data;
	return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

type Item = {
	label: string;
	valor: number;
	quantidade: number;
	despesas: DespesaResumida[];
};

type Props = {
	title: string;
	description: string;
	items: Item[];
};

const LIMITE = 8;
const TODAS_CONTAS = "__todas__";

const barChartConfig = {
	valor: { label: "Total" },
} satisfies ChartConfig;

export function CategoriasBarChart({ title, description, items }: Props) {
	const [aberta, setAberta] = useState<string | null>(null);
	const [conta, setConta] = useState<string>(TODAS_CONTAS);

	const contas = useMemo(() => {
		const encontradas = new Set<string>();
		for (const item of items) {
			for (const d of item.despesas) {
				if (d.conta) encontradas.add(d.conta);
			}
		}
		return Array.from(encontradas).sort((a, b) =>
			a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
		);
	}, [items]);

	// ao trocar de mês a conta selecionada pode não existir mais
	const contaAtiva = contas.includes(conta) ? conta : TODAS_CONTAS;

	const filtrados = useMemo(() => {
		if (contaAtiva === TODAS_CONTAS) return items;
		return items
			.map((item) => {
				const despesas = item.despesas.filter((d) => d.conta === contaAtiva);
				return {
					...item,
					despesas,
					quantidade: despesas.length,
					valor: despesas.reduce((s, d) => s + d.valor, 0),
				};
			})
			.filter((item) => item.despesas.length > 0);
	}, [items, contaAtiva]);

	const ordenados = useMemo(
		() => [...filtrados].sort((a, b) => b.valor - a.valor).slice(0, LIMITE),
		[filtrados],
	);

	const total = useMemo(
		() => filtrados.reduce((s, i) => s + i.valor, 0),
		[filtrados],
	);

	const seletorConta =
		contas.length > 1 ? (
			<select
				value={contaAtiva}
				onChange={(e) => {
					setConta(e.target.value);
					setAberta(null);
				}}
				aria-label='Filtrar por conta'
				className='border-input bg-background rounded-md border px-2 py-1 text-xs'>
				<option value={TODAS_CONTAS}>Todas as contas</option>
				{contas.map((c) => (
					<option key={c} value={c}>
						{c}
					</option>
				))}
			</select>
		) : null;

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
				<div className='flex flex-wrap items-start justify-between gap-2'>
					<div className='grid gap-1'>
						<CardTitle>{title}</CardTitle>
						<CardDescription>{description}</CardDescription>
					</div>
					{seletorConta}
				</div>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				{filtrados.length === 0 ? (
					<p className='text-sm text-muted-foreground'>
						Nenhuma despesa nessa conta para o período selecionado.
					</p>
				) : (
					<>
						{/* Bar chart */}
						<ChartContainer
							config={barChartConfig}
							className='aspect-auto h-45 w-full'>
							<BarChart
								accessibilityLayer
								data={ordenados}
								barSize={28}
								margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
								<XAxis
									dataKey='label'
									axisLine={false}
									tickLine={false}
									tick={{ fontSize: 9 }}
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
										<Cell key={i} fill={getCorGrafico(i)} />
									))}
								</Bar>
								<ChartTooltip
									cursor={false}
									content={
										<ChartTooltipContent
											labelFormatter={(_, payload) =>
												payload?.[0]?.payload?.label ?? ""
											}
											formatter={(value) => {
												const pct =
													total > 0
														? ((Number(value) / total) * 100).toFixed(1)
														: "0";
												return (
													<div className='flex min-w-[140px] items-center justify-between gap-3'>
														<span className='font-medium tabular-nums'>
															{formatarMoeda(Number(value))}
														</span>
														<span className='text-muted-foreground'>
															{pct}% do total
														</span>
													</div>
												);
											}}
										/>
									}
								/>
							</BarChart>
						</ChartContainer>

						{/* Total */}
						<div className='flex items-baseline justify-between border-b border-border pb-3'>
							<div>
								<p className='text-sm font-semibold'>Todos os gastos</p>
								<p className='text-xs text-muted-foreground'>
									{filtrados.reduce((s, i) => s + i.quantidade, 0)} lançamentos
								</p>
							</div>
							<div className='text-right'>
								<p className='text-sm font-semibold tabular-nums'>
									{formatarMoeda(total)}
								</p>
								<p className='text-xs text-muted-foreground'>100%</p>
							</div>
						</div>

						{/* Category list with collapse */}
						<div className='flex flex-col'>
							{ordenados.map((item, i) => {
								const pct = total > 0 ? ((item.valor / total) * 100).toFixed(1) : "0";
								const estaAberta = aberta === item.label;
								const cor = getCorGrafico(i);

								return (
									<div key={item.label} className='border-b border-border last:border-0'>
										{/* Category row — clickable */}
										<button
											type='button'
											onClick={() => setAberta(estaAberta ? null : item.label)}
											className='flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40 rounded-sm px-1'>
											<span
												className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white'
												style={{ backgroundColor: cor }}>
												{CATEGORIA_ICONES[item.label] ? (
													<HugeiconsIcon
														icon={CATEGORIA_ICONES[item.label]}
														size={16}
														color='white'
														strokeWidth={1.5}
													/>
												) : (
													<span className='text-xs font-bold'>
														{item.label.slice(0, 1).toUpperCase()}
													</span>
												)}
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
											<span className='text-muted-foreground text-xs ml-1'>
												{estaAberta ? "▲" : "▼"}
											</span>
										</button>

										{/* Expanded expenses */}
										{estaAberta && (
											<div className='mb-2 ml-11 flex flex-col gap-1'>
												{item.despesas.map((d) => (
													<div
														key={d.id}
														className='flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs'>
														<span className='text-muted-foreground shrink-0'>
															{formatarData(d.data)}
														</span>
														<span className='flex-1 truncate font-medium'>
															{d.nome}
														</span>
														<span className='shrink-0 text-muted-foreground'>
															{d.conta}
														</span>
														<span className='shrink-0 font-semibold tabular-nums'>
															{formatarMoeda(d.valor)}
														</span>
													</div>
												))}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
