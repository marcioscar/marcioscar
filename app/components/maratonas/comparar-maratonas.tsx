"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "~/components/ui/chart";
import { analisarProva } from "~/lib/maratona-analise";
import { formatarDiferenca, formatarPace, formatarTempo } from "~/lib/formatar-corrida";
import { VELOCIDADE_MINIMA_MPS } from "~/lib/rota";
import type { SplitMetric } from "~/types/analise";
import type { MaratonaDetalhada } from "~/types/maratonas";

type Props = {
	a: MaratonaDetalhada;
	b: MaratonaDetalhada;
	rotuloA: string;
	rotuloB: string;
};

const KM_MAX = 42;

function pacesPorKm(splits: SplitMetric[]): Map<number, number> {
	const mapa = new Map<number, number>();
	for (const s of splits) {
		if (s.distance >= 900 && s.split <= KM_MAX && s.average_speed >= VELOCIDADE_MINIMA_MPS) {
			mapa.set(s.split, Math.round((s.moving_time / s.distance) * 1000));
		}
	}
	return mapa;
}

function Linha({
	rotulo,
	a,
	b,
}: {
	rotulo: string;
	a: string;
	b: string;
}) {
	return (
		<tr className='border-t border-border'>
			<th scope='row' className='py-1.5 pr-3 text-left text-xs font-normal text-muted-foreground'>
				{rotulo}
			</th>
			<td className='py-1.5 pr-3 text-right tabular-nums'>{a}</td>
			<td className='py-1.5 text-right tabular-nums'>{b}</td>
		</tr>
	);
}

export function CompararMaratonas({ a, b, rotuloA, rotuloB }: Props) {
	const splitsA = a.splits ?? [];
	const splitsB = b.splits ?? [];
	const pacesA = pacesPorKm(splitsA);
	const pacesB = pacesPorKm(splitsB);
	const leituraA = analisarProva(splitsA);
	const leituraB = analisarProva(splitsB);

	const dados = Array.from({ length: KM_MAX }, (_, i) => ({
		km: i + 1,
		a: pacesA.get(i + 1) ?? null,
		b: pacesB.get(i + 1) ?? null,
	}));

	const todos = [...pacesA.values(), ...pacesB.values()];
	const passo = (() => {
		const amplitude = Math.max(...todos) - Math.min(...todos);
		return [10, 15, 20, 30, 60, 120].find((p) => amplitude / p <= 5) ?? 120;
	})();
	const dominio: [number, number] = [
		Math.floor(Math.min(...todos) / passo) * passo,
		Math.ceil(Math.max(...todos) / passo) * passo,
	];
	const marcas: number[] = [];
	for (let v = dominio[0]; v <= dominio[1]; v += passo) marcas.push(v);

	const config = {
		a: { label: rotuloA, color: "var(--paleta-4)" },
		b: { label: rotuloB, color: "var(--paleta-2)" },
	} satisfies ChartConfig;

	const queda = (km: number | null | undefined) => (km ? `km ${km}` : "sem queda");

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
				<span className='flex items-center gap-1.5'>
					<span aria-hidden className='h-0.5 w-4 rounded bg-paleta-4' />
					{rotuloA}
				</span>
				<span className='flex items-center gap-1.5'>
					<span aria-hidden className='h-0.5 w-4 rounded bg-paleta-2' />
					{rotuloB}
				</span>
				<span className='text-muted-foreground'>
					Eixo invertido: mais para cima é mais rápido.
				</span>
			</div>

			<ChartContainer config={config} className='aspect-auto h-60 w-full'>
				<LineChart data={dados} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey='km'
						ticks={[1, 5, 10, 15, 20, 25, 30, 35, 40]}
						tickLine={false}
						axisLine={false}
						tickMargin={6}
						tickFormatter={(v) => `km ${v}`}
						tick={{ fontSize: 11 }}
					/>
					<YAxis
						reversed
						width={48}
						domain={dominio}
						ticks={marcas}
						tickLine={false}
						axisLine={false}
						tickMargin={6}
						tickFormatter={(v) => formatarPace(Number(v), "")}
					/>
					<ReferenceLine
						x={21}
						stroke='var(--border)'
						strokeDasharray='4 4'
						label={{ value: "meia", position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }}
					/>
					<ChartTooltip
						content={
							<ChartTooltipContent
								labelFormatter={(label) => `Km ${label}`}
								formatter={(value, name) => (
									<div className='flex min-w-[170px] items-center justify-between gap-3'>
										<span className='text-muted-foreground'>
											{name === "a" ? rotuloA : rotuloB}
										</span>
										<span className='font-medium tabular-nums'>
											{formatarPace(Number(value))}
										</span>
									</div>
								)}
							/>
						}
					/>
					<Line
						dataKey='a'
						stroke='var(--color-a)'
						strokeWidth={2}
						dot={false}
						activeDot={{ r: 4 }}
						connectNulls={false}
						isAnimationActive={false}
					/>
					<Line
						dataKey='b'
						stroke='var(--color-b)'
						strokeWidth={2}
						dot={false}
						activeDot={{ r: 4 }}
						connectNulls={false}
						isAnimationActive={false}
					/>
				</LineChart>
			</ChartContainer>

			<div className='overflow-x-auto'>
				<table className='w-full text-sm'>
					<thead>
						<tr>
							<th scope='col' className='sr-only'>
								Medida
							</th>
							<th scope='col' className='pr-3 pb-1 text-right text-xs font-medium'>
								{rotuloA}
							</th>
							<th scope='col' className='pb-1 text-right text-xs font-medium'>
								{rotuloB}
							</th>
						</tr>
					</thead>
					<tbody>
						<Linha rotulo='Tempo' a={formatarTempo(a.tempoTotalSeg)} b={formatarTempo(b.tempoTotalSeg)} />
						<Linha
							rotulo='Pace médio'
							a={formatarPace(a.paceMedioSegPorKm)}
							b={formatarPace(b.paceMedioSegPorKm)}
						/>
						{leituraA && leituraB && (
							<>
								<Linha
									rotulo='1ª metade'
									a={formatarTempo(leituraA.primeiraMetadeSeg)}
									b={formatarTempo(leituraB.primeiraMetadeSeg)}
								/>
								<Linha
									rotulo='2ª metade'
									a={formatarTempo(leituraA.segundaMetadeSeg)}
									b={formatarTempo(leituraB.segundaMetadeSeg)}
								/>
								<Linha
									rotulo='2ª − 1ª metade'
									a={formatarDiferenca(leituraA.diferencaSeg)}
									b={formatarDiferenca(leituraB.diferencaSeg)}
								/>
								<Linha
									rotulo='Ritmo caiu a partir do'
									a={queda(leituraA.kmQueda)}
									b={queda(leituraB.kmQueda)}
								/>
							</>
						)}
						<Linha
							rotulo='FC média'
							a={a.frequenciaMedia ? `${Math.round(a.frequenciaMedia)} bpm` : "—"}
							b={b.frequenciaMedia ? `${Math.round(b.frequenciaMedia)} bpm` : "—"}
						/>
						<Linha
							rotulo='Temperatura'
							a={a.temperaturaMedia !== null ? `${Math.round(a.temperaturaMedia)} °C` : "—"}
							b={b.temperaturaMedia !== null ? `${Math.round(b.temperaturaMedia)} °C` : "—"}
						/>
					</tbody>
				</table>
			</div>
		</div>
	);
}
