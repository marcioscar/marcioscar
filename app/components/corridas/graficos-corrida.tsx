"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "~/components/ui/chart";
import { JANELA_PACE_M, montarDadosGrafico, type PontoGrafico, type Suavizacao } from "~/lib/dados-grafico-rota";
import type { RotaDetalhada } from "~/types/rota";

type Props = {
	detalhe: RotaDetalhada;
	distanciaMetros: number;
};

const SYNC_ID = "graficos-corrida";
const MARGEM = { left: 4, right: 12, top: 8, bottom: 0 };
const LARGURA_EIXO_Y = 48;

const chartConfig = {
	pace: { label: "Pace", color: "var(--paleta-4)" },
	fc: { label: "Freq. cardíaca", color: "var(--paleta-5)" },
	alt: { label: "Altitude", color: "var(--paleta-8)" },
} satisfies ChartConfig;

function formatarPace(seg: number): string {
	return `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, "0")}`;
}

function percentil(valores: number[], p: number): number {
	const o = [...valores].sort((a, b) => a - b);
	return o[Math.min(o.length - 1, Math.max(0, Math.round(p * (o.length - 1))))];
}

function Titulo({ texto, detalhe }: { texto: string; detalhe?: string }) {
	return (
		<div className="mb-1 flex items-baseline justify-between px-1">
			<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{texto}</p>
			{detalhe && <p className="text-xs text-muted-foreground tabular-nums">{detalhe}</p>}
		</div>
	);
}

function Dica({ ativo, payload, rotulo, valor }: { ativo?: boolean; payload?: readonly { payload?: PontoGrafico }[]; rotulo: string; valor: (p: PontoGrafico) => string | null }) {
	const p = payload?.[0]?.payload;
	if (!ativo || !p) return null;
	const v = valor(p);
	return (
		<div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
			<p className="font-medium tabular-nums">Km {p.km.toFixed(2).replace(".", ",")}</p>
			<p className="tabular-nums text-muted-foreground">
				{rotulo}: {v ?? "—"}
			</p>
		</div>
	);
}

export function GraficosCorrida({ detalhe, distanciaMetros }: Props) {
	// corridas com tiros pedem pouca suavização; longas e contínuas ficam mais legíveis com média ou alta
	const [suavizacao, setSuavizacao] = useState<Suavizacao>(distanciaMetros > 0 && distanciaMetros < 12_000 ? "pouca" : "media");
	const dados = montarDadosGrafico(detalhe, distanciaMetros, suavizacao);
	if (dados.length < 10) return null;

	const paces = dados.map((d) => d.pace).filter((v): v is number => v !== null);
	const fcs = dados.map((d) => d.fc).filter((v): v is number => v !== null);
	const alts = dados.map((d) => d.alt).filter((v): v is number => v !== null);
	if (paces.length === 0 && fcs.length === 0 && alts.length === 0) return null;

	const kmTotal = dados[dados.length - 1].km;
	const ticksKm = Array.from({ length: Math.floor(kmTotal) + 1 }, (_, i) => i).filter(
		(k) => kmTotal <= 12 || k % (kmTotal <= 25 ? 2 : 5) === 0,
	);

	// pace: escala pelos percentis para um trecho caminhado ou um pico de GPS não esmagar a linha
	const paceMin = paces.length ? Math.floor(percentil(paces, 0.03) / 10) * 10 - 10 : 0;
	const paceMax = paces.length ? Math.ceil(percentil(paces, 0.97) / 10) * 10 + 10 : 0;
	const fcMin = fcs.length ? Math.floor((Math.min(...fcs) - 5) / 5) * 5 : 0;
	const fcMax = fcs.length ? Math.ceil((Math.max(...fcs) + 5) / 5) * 5 : 0;
	const altMin = alts.length ? Math.floor(Math.min(...alts) - 5) : 0;
	const altMax = alts.length ? Math.ceil(Math.max(...alts) + 5) : 0;

	const ultimoPainel = alts.length ? "alt" : fcs.length ? "fc" : "pace";
	const eixoX = (mostrar: boolean) => (
		<XAxis
			dataKey="km"
			type="number"
			domain={[0, kmTotal]}
			ticks={ticksKm}
			hide={!mostrar}
			tickLine={false}
			axisLine={false}
			tick={{ fontSize: 11 }}
			tickFormatter={(v: number) => `${v}`}
			unit=" km"
		/>
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Gráficos da corrida</CardTitle>
				<CardDescription>Pace, frequência cardíaca e altitude ao longo da distância</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				{paces.length > 0 && (
					<div>
						<div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
							<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Pace <span className="font-normal normal-case">· mais para cima é mais rápido</span>
							</p>
							<div role="group" aria-label="Suavização do pace" className="flex items-center gap-1.5">
								<span className="text-xs text-muted-foreground">Suavização</span>
								<div className="flex rounded-md border p-0.5">
									{(["pouca", "media", "alta"] as Suavizacao[]).map((s) => (
										<button
											key={s}
											type="button"
											aria-pressed={suavizacao === s}
											title={`Média de ${JANELA_PACE_M[s]} m`}
											onClick={() => setSuavizacao(s)}
											className={
												"rounded px-2 py-0.5 text-xs font-medium capitalize transition-colors " +
												(suavizacao === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
											}>
											{s === "media" ? "Média" : s === "pouca" ? "Pouca" : "Alta"}
										</button>
									))}
								</div>
							</div>
						</div>
						<ChartContainer config={chartConfig} className="aspect-auto h-40 w-full">
							<LineChart data={dados} syncId={SYNC_ID} margin={MARGEM}>
								<CartesianGrid vertical={false} />
								{eixoX(ultimoPainel === "pace")}
								<YAxis
									reversed
									width={LARGURA_EIXO_Y}
									domain={[paceMin, paceMax]}
									allowDataOverflow
									tickLine={false}
									axisLine={false}
									tickMargin={6}
									tickFormatter={(v: number) => formatarPace(v)}
								/>
								<ChartTooltip
									content={({ active, payload }) => (
										<Dica ativo={active} payload={payload} rotulo="Pace" valor={(p) => (p.pace ? `${formatarPace(p.pace)} /km` : null)} />
									)}
								/>
								<Line dataKey="pace" stroke="var(--color-pace)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
							</LineChart>
						</ChartContainer>
					</div>
				)}

				{fcs.length > 0 && (
					<div>
						<Titulo texto="Frequência cardíaca" detalhe={`${Math.round(Math.min(...fcs))}–${Math.round(Math.max(...fcs))} bpm`} />
						<ChartContainer config={chartConfig} className="aspect-auto h-36 w-full">
							<LineChart data={dados} syncId={SYNC_ID} margin={MARGEM}>
								<CartesianGrid vertical={false} />
								{eixoX(ultimoPainel === "fc")}
								<YAxis width={LARGURA_EIXO_Y} domain={[fcMin, fcMax]} tickLine={false} axisLine={false} tickMargin={6} />
								<ChartTooltip
									content={({ active, payload }) => (
										<Dica ativo={active} payload={payload} rotulo="FC" valor={(p) => (p.fc ? `${p.fc} bpm` : null)} />
									)}
								/>
								<Line dataKey="fc" stroke="var(--color-fc)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
							</LineChart>
						</ChartContainer>
					</div>
				)}

				{alts.length > 0 && (
					<div>
						<Titulo texto="Altitude" detalhe={`${Math.round(Math.min(...alts))}–${Math.round(Math.max(...alts))} m`} />
						<ChartContainer config={chartConfig} className="aspect-auto h-32 w-full">
							<AreaChart data={dados} syncId={SYNC_ID} margin={MARGEM}>
								<CartesianGrid vertical={false} />
								{eixoX(true)}
								<YAxis width={LARGURA_EIXO_Y} domain={[altMin, altMax]} tickLine={false} axisLine={false} tickMargin={6} />
								<ChartTooltip
									content={({ active, payload }) => (
										<Dica ativo={active} payload={payload} rotulo="Altitude" valor={(p) => (p.alt !== null ? `${Math.round(p.alt)} m` : null)} />
									)}
								/>
								<Area dataKey="alt" stroke="var(--color-alt)" strokeWidth={1.5} fill="var(--color-alt)" fillOpacity={0.25} isAnimationActive={false} />
							</AreaChart>
						</ChartContainer>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
