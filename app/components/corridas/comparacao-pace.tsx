"use client";

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	type ChartConfig,
} from "~/components/ui/chart";
import { formatarTempo } from "~/lib/formatar-corrida";
import type { LinhaComparacao, ResumoComparacao, StatusPace } from "~/lib/treino-manual";

type Props = {
	titulo: string;
	linhas: LinhaComparacao[];
	resumo: ResumoComparacao;
	/** "etapa" (treino estruturado) ou "km" (corrida contínua) */
	base: "etapa" | "km";
};

const COR_STATUS: Record<StatusPace, string> = {
	dentro: "var(--sucesso)",
	rapido: "var(--paleta-4)",
	lento: "var(--alerta)",
	sem: "var(--muted-foreground)",
};

const TEXTO_STATUS: Record<StatusPace, string> = {
	dentro: "Dentro da faixa",
	rapido: "Mais rápido que o plano",
	lento: "Mais lento que o plano",
	sem: "—",
};

const chartConfig = {
	faixa: { label: "Faixa planejada", color: "var(--paleta-6)" },
	exec: { label: "Executado", color: "var(--paleta-4)" },
} satisfies ChartConfig;

function pace(seg: number | null): string {
	if (seg === null) return "—";
	const t = Math.round(seg);
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function distancia(m: number): string {
	return m >= 1000 ? `${(m / 1000).toFixed(2).replace(".", ",")} km` : `${Math.round(m)} m`;
}

function rotuloCurto(l: LinhaComparacao, i: number): string {
	if (l.papel === "aquecimento") return "Aq.";
	if (l.papel === "desaquecimento") return "Des.";
	if (l.papel === "recuperacao") return "Rec.";
	if (l.papel === "km") return l.rotulo.replace("Km ", "");
	return l.rotulo.replace("Esforço ", "E") || String(i + 1);
}

function diffTexto(l: LinhaComparacao): string {
	if (l.diffSeg === null) return "—";
	if (l.status === "dentro") return "na faixa";
	const abs = Math.abs(l.diffSeg);
	return `${abs}s/km ${l.status === "rapido" ? "mais rápido" : "mais lento"}`;
}

export function ComparacaoPace({ titulo, linhas, resumo, base }: Props) {
	// o gráfico mostra o que tem pace: descansos curtos ficam de fora
	const dadosGrafico = linhas
		.map((l, i) => ({ l, i }))
		.filter(({ l }) => l.planRapidoSeg !== null && l.planLentoSeg !== null && l.execSeg !== null)
		.map(({ l, i }) => ({
			nome: rotuloCurto(l, i),
			rotulo: l.rotulo,
			faixa: [Math.round(l.planRapidoSeg!), Math.round(l.planLentoSeg!)] as [number, number],
			exec: Math.round(l.execSeg!),
			status: l.status,
		}));

	// barras de desvio por etapa: só etapas com pace (descansos curtos ficam de fora)
	const comDesvio = linhas.filter((l) => l.diffSeg !== null && l.execSeg !== null);
	const maiorDesvio = comDesvio.reduce((m, l) => Math.max(m, Math.abs(l.diffSeg ?? 0)), 0);
	// um aquecimento caminhado não pode esmagar a escala: limita o eixo e mantém o número real no rótulo
	const limiteDesvio = Math.min(Math.max(30, Math.ceil((maiorDesvio + 6) / 10) * 10), 90);
	const dadosDesvio = comDesvio.map((l) => {
		const real = l.diffSeg ?? 0;
		return {
			nome: l.rotulo,
			valor: Math.max(-limiteDesvio, Math.min(limiteDesvio, real)),
			status: l.status,
			planRapido: l.planRapidoSeg,
			planLento: l.planLentoSeg,
			exec: l.execSeg,
			texto: real === 0 ? "na faixa" : `${Math.abs(real)}s ${real < 0 ? "mais rápido" : "mais lento"}`,
		};
	});

	const valores = dadosGrafico.flatMap((d) => [d.faixa[0], d.faixa[1], d.exec]);
	const minimo = valores.length ? Math.floor((Math.min(...valores) - 15) / 5) * 5 : 0;
	const maximo = valores.length ? Math.ceil((Math.max(...valores) + 15) / 5) * 5 : 600;

	const desvio = resumo.desvioMedioSeg;
	const resumoTexto =
		resumo.avaliadas > 0
			? `${resumo.dentro} de ${resumo.avaliadas} ${base === "km" ? "km" : resumo.avaliadas === 1 ? "esforço" : "esforços"} dentro da faixa` +
				(resumo.rapidas ? ` · ${resumo.rapidas} mais ${resumo.rapidas === 1 ? "rápido" : "rápidos"}` : "") +
				(resumo.lentas ? ` · ${resumo.lentas} mais ${resumo.lentas === 1 ? "lento" : "lentos"}` : "")
			: "Sem trechos com pace para comparar";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Planejado × executado</CardTitle>
				<CardDescription>
					{titulo} · {resumoTexto}
					{desvio !== null && (
						<>
							{" "}
							· em média {Math.abs(Math.round(desvio))}s/km {desvio < 0 ? "mais rápido" : "mais lento"} que o centro da faixa
						</>
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				{base === "etapa" && dadosDesvio.length > 0 && (
					<div className="grid gap-1.5">
						<p className="text-xs text-muted-foreground">
							Diferença para a faixa planejada, em segundos por km. Zero é estar dentro da faixa.
						</p>
						<ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: 52 + dadosDesvio.length * 38 }}>
							<BarChart data={dadosDesvio} layout="vertical" margin={{ top: 4, right: 64, bottom: 0, left: 4 }}>
								<CartesianGrid horizontal={false} strokeDasharray="3 3" />
								<XAxis
									type="number"
									domain={[-limiteDesvio, limiteDesvio]}
									tickLine={false}
									axisLine={false}
									tick={{ fontSize: 11 }}
									tickFormatter={(v: number) => (v > 0 ? `+${v}s` : `${v}s`)}
								/>
								<YAxis
									type="category"
									dataKey="nome"
									width={104}
									tickLine={false}
									axisLine={false}
									tick={{ fontSize: 12 }}
								/>
								<ReferenceLine x={0} stroke="var(--foreground)" strokeOpacity={0.5} />
								<Bar dataKey="valor" barSize={16} radius={4} minPointSize={4} isAnimationActive={false}>
									{dadosDesvio.map((d) => (
										<Cell key={d.nome} fill={COR_STATUS[d.status]} />
									))}
									<LabelList
										dataKey="texto"
										position="right"
										fontSize={11}
										fill="var(--muted-foreground)"
									/>
								</Bar>
								<ChartTooltip
									cursor={false}
									content={({ active, payload }) => {
										const d = payload?.[0]?.payload as (typeof dadosDesvio)[number] | undefined;
										if (!active || !d) return null;
										return (
											<div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
												<p className="font-medium">{d.nome}</p>
												<p className="tabular-nums text-muted-foreground">
													Planejado {pace(d.planRapido)}–{pace(d.planLento)} /km
												</p>
												<p className="tabular-nums" style={{ color: COR_STATUS[d.status] }}>
													Executado {pace(d.exec)} /km
												</p>
											</div>
										);
									}}
								/>
							</BarChart>
						</ChartContainer>
						<div className="flex justify-between px-1 text-[11px] text-muted-foreground">
							<span>← mais rápido que o plano</span>
							<span>mais lento que o plano →</span>
						</div>
					</div>
				)}

				{base === "km" && dadosGrafico.length > 1 && (
					<div className="grid gap-1.5">
						<ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
							<ComposedChart data={dadosGrafico} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
								<CartesianGrid vertical={false} strokeDasharray="3 3" />
								<XAxis dataKey="nome" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
								<YAxis
									reversed
									domain={[minimo, maximo]}
									width={44}
									tickLine={false}
									axisLine={false}
									tick={{ fontSize: 11 }}
									tickFormatter={(v: number) => pace(v)}
								/>
								<ReferenceArea
									y1={dadosGrafico[0].faixa[0]}
									y2={dadosGrafico[0].faixa[1]}
									fill="var(--paleta-6)"
									fillOpacity={0.18}
									stroke="var(--paleta-6)"
									strokeOpacity={0.4}
									ifOverflow="extendDomain"
								/>
								<Line
									dataKey="exec"
									stroke="var(--paleta-4)"
									strokeWidth={2}
									isAnimationActive={false}
									dot={(props: { cx?: number; cy?: number; index?: number }) => {
										const { cx, cy, index } = props;
										if (cx === undefined || cy === undefined || index === undefined) return <g key={index} />;
										return (
											<circle
												key={index}
												cx={cx}
												cy={cy}
												r={4.5}
												fill={COR_STATUS[dadosGrafico[index].status]}
												stroke="var(--background)"
												strokeWidth={1.5}
											/>
										);
									}}
									activeDot={false}
								/>
								<ChartTooltip
									cursor={false}
									content={({ active, payload }) => {
										const d = payload?.[0]?.payload as (typeof dadosGrafico)[number] | undefined;
										if (!active || !d) return null;
										return (
											<div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
												<p className="font-medium">{d.rotulo}</p>
												<p className="tabular-nums" style={{ color: COR_STATUS[d.status] }}>
													{pace(d.exec)} /km
												</p>
											</div>
										);
									}}
								/>
							</ComposedChart>
						</ChartContainer>
						<p className="text-xs text-muted-foreground">
							A faixa em roxo é o pace planejado; mais para cima é mais rápido.
						</p>
					</div>
				)}

				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
					{(["dentro", "rapido", "lento"] as StatusPace[]).map((s) => (
						<span key={s} className="flex items-center gap-1.5">
							<span className="size-2.5 rounded-full" style={{ background: COR_STATUS[s] }} />
							{TEXTO_STATUS[s].toLowerCase()}
						</span>
					))}
				</div>

				<div className="overflow-x-auto rounded-xl border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/40 text-xs text-muted-foreground">
								<th className="px-3 py-2 text-left font-medium">{base === "km" ? "Km" : "Etapa"}</th>
								<th className="px-3 py-2 text-right font-medium">Meta</th>
								<th className="px-3 py-2 text-right font-medium">Planejado</th>
								<th className="px-3 py-2 text-right font-medium">Executado</th>
								<th className="px-3 py-2 text-right font-medium">Diferença</th>
								<th className="px-3 py-2 text-right font-medium">Tempo</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{linhas.map((l) => (
								<tr key={l.chave}>
									<td className="px-3 py-1.5 font-medium">
										{l.rotulo}
										{l.zona ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">Z{l.zona}</span> : null}
									</td>
									<td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{l.meta}</td>
									<td className="px-3 py-1.5 text-right tabular-nums">
										{l.planRapidoSeg !== null && l.planLentoSeg !== null
											? `${pace(l.planRapidoSeg)}–${pace(l.planLentoSeg)}`
											: "—"}
									</td>
									<td className="px-3 py-1.5 text-right font-medium tabular-nums">
										{l.execSeg !== null ? pace(l.execSeg) : <span className="font-normal text-muted-foreground">{distancia(l.distanciaM)}</span>}
									</td>
									<td className="px-3 py-1.5 text-right tabular-nums" style={{ color: COR_STATUS[l.status] }}>
										{diffTexto(l)}
									</td>
									<td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatarTempo(l.tempoSeg)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}
