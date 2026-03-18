"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
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

const DEFAULT_PALETTE = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
] as const;

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

	return (
		<Card className='bg-linear-to-br from-card via-card to-muted/40 shadow-sm'>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className='grid gap-4'>
				{itensPizza.length > 0 ? (
					<>
						<ChartContainer config={chartConfig} className='min-h-[260px] w-full'>
							<PieChart accessibilityLayer>
								<Pie
									data={itensPizza}
									dataKey='valor'
									nameKey='key'
									innerRadius={52}
									outerRadius={90}
									strokeWidth={2}>
									{itensPizza.map((item) => (
										<Cell key={item.key} fill={`var(--color-${item.key})`} />
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
								<ChartLegend content={<ChartLegendContent nameKey='key' />} />
							</PieChart>
						</ChartContainer>

						<div className='grid gap-1.5 text-sm'>
							{itensPizza.map((item) => (
								<div key={item.key} className='flex items-center justify-between gap-2'>
									<span className='truncate'>{item.label}</span>
									<span className='text-muted-foreground'>
										{formatarMoeda(item.valor)}
									</span>
								</div>
							))}
						</div>
					</>
				) : (
					<p className='text-sm text-muted-foreground'>
						Nenhuma despesa encontrada para o periodo selecionado.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

