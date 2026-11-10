"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "~/components/ui/chart";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { PALETA_GRAFICOS } from "~/lib/chart-palette";

type ItemPizza = {
	label: string;
	valor: number;
	quantidade: number;
};

type DespesasPieChartProps = {
	title: string;
	description: string;
	items: ItemPizza[];
	palette?: readonly string[];
};

type ItemPizzaInterno = ItemPizza & {
	key: string;
};

// --chart-1..5 do tema é uma rampa monocromática de oliva, que não separa
// categorias; a paleta dos gráficos é da mesma família, mas categórica.
const DEFAULT_PALETTE = PALETA_GRAFICOS;

function formatarMoeda(valor: number): string {
	return valor.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}

function normalizarItensPizza(itens: ItemPizza[], limite = 8): ItemPizzaInterno[] {
	if (itens.length <= limite) {
		return itens.map((item, index) => ({
			...item,
			key: `item${index}`,
		}));
	}

	const principais = itens.slice(0, limite);
	const restantes = itens.slice(limite);
	const outros = restantes.reduce(
		(acc, item) => ({
			valor: acc.valor + item.valor,
			quantidade: acc.quantidade + item.quantidade,
		}),
		{ valor: 0, quantidade: 0 },
	);

	return [
		...principais.map((item, index) => ({
			...item,
			key: `item${index}`,
		})),
		{
			key: "outros",
			label: "Outros",
			valor: outros.valor,
			quantidade: outros.quantidade,
		},
	];
}

function getCorPaleta(index: number, palette: readonly string[]): string {
	return palette[index % palette.length] ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
}

function criarChartConfig(
	itens: ItemPizzaInterno[],
	palette: readonly string[],
): ChartConfig {
	const config: ChartConfig = {};

	for (let index = 0; index < itens.length; index++) {
		const item = itens[index];
		config[item.key] = {
			label: item.label,
			color: getCorPaleta(index, palette),
		};
	}

	return config;
}

export function DespesasPieChart({
	title,
	description,
	items,
	palette = DEFAULT_PALETTE,
}: DespesasPieChartProps) {
	const itensPizza = normalizarItensPizza(items);
	const chartConfig = criarChartConfig(itensPizza, palette);
	const total = itensPizza.reduce((acc, item) => acc + item.valor, 0);

	return (
		<Card className='bg-linear-to-br from-card via-card to-muted/40'>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className='grid gap-4'>
				{itensPizza.length > 0 ? (
					<>
						<ChartContainer
							config={chartConfig}
							className='mx-auto min-h-[280px] w-full max-w-[320px] sm:min-h-[260px] sm:max-w-full'>
							<PieChart accessibilityLayer>
								<Pie
									data={itensPizza}
									dataKey='valor'
									nameKey='key'
									innerRadius={52}
									outerRadius={90}
									cx='50%'
									cy='50%'
									strokeWidth={2}>
									{itensPizza.map((item, index) => (
										<Cell
											key={item.key}
											fill={getCorPaleta(index, palette)}
										/>
									))}
								</Pie>
								<ChartTooltip
									content={
										<ChartTooltipContent
											nameKey='key'
											formatter={(value, _name, item) => {
												const nomeItem =
													typeof item?.payload?.label === "string"
														? item.payload.label
														: "Item";

												return (
													<div className='flex min-w-[180px] items-center justify-between gap-3'>
														<span className='text-muted-foreground'>{nomeItem}</span>
														<span className='font-medium tabular-nums'>
															{formatarMoeda(Number(value))}
														</span>
													</div>
												);
											}}
										/>
									}
								/>
							</PieChart>
						</ChartContainer>

						<ul className='grid gap-1.5 text-sm'>
							{itensPizza.map((item, index) => (
								<li
									key={item.key}
									className='flex min-w-0 items-center justify-between gap-2'>
									<span className='flex min-w-0 items-center gap-2'>
										<span
											aria-hidden
											className='h-2.5 w-2.5 shrink-0 rounded-[2px]'
											style={{ backgroundColor: getCorPaleta(index, palette) }}
										/>
										<span className='truncate'>{item.label}</span>
									</span>
									<span className='flex shrink-0 items-baseline gap-2 tabular-nums'>
										<span className='font-medium text-foreground'>
											{formatarMoeda(item.valor)}
										</span>
										<span className='w-10 text-right text-xs text-muted-foreground'>
											{total > 0 ? `${Math.round((item.valor / total) * 100)}%` : "–"}
										</span>
									</span>
								</li>
							))}
						</ul>
					</>
				) : (
					<p className='text-sm text-muted-foreground'>
						Nenhuma despesa encontrada para o período selecionado.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

