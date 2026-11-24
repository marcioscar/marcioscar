import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { RotaDetalhada } from "~/types/rota";
import { DetalhamentoRelogio, type SplitRelogio, type VoltaRelogio } from "./detalhamento-relogio";

export type MetricasRelogio = {
	fcMedia: number | null;
	fcMaxima: number | null;
	caloriasKcal: number | null;
	cadenciaMedia: number | null;
	potenciaMediaW: number | null;
	passadaM: number | null;
	oscilacaoVerticalCm: number | null;
	contatoSoloMs: number | null;
	elevacaoGanhoM: number | null;
	splits?: SplitRelogio[] | null;
	voltas?: VoltaRelogio[] | null;
};

type Item = { rotulo: string; valor: string; unidade: string; nota?: string };

const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
const n1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function montarItens(m: MetricasRelogio): Item[] {
	const itens: Item[] = [];
	if (m.potenciaMediaW) itens.push({ rotulo: "Potência", valor: n0(m.potenciaMediaW), unidade: "W" });
	if (m.cadenciaMedia) itens.push({ rotulo: "Cadência", valor: n0(m.cadenciaMedia), unidade: "passos/min" });
	if (m.passadaM) itens.push({ rotulo: "Passada", valor: n2(m.passadaM), unidade: "m" });
	if (m.oscilacaoVerticalCm) itens.push({ rotulo: "Oscilação vertical", valor: n1(m.oscilacaoVerticalCm), unidade: "cm" });
	if (m.contatoSoloMs) itens.push({ rotulo: "Contato com o solo", valor: n0(m.contatoSoloMs), unidade: "ms" });
	if (m.fcMedia) {
		itens.push({
			rotulo: "Freq. cardíaca",
			valor: n0(m.fcMedia),
			unidade: "bpm",
			nota: m.fcMaxima ? `máx ${n0(m.fcMaxima)} bpm` : undefined,
		});
	}
	if (m.caloriasKcal) itens.push({ rotulo: "Calorias ativas", valor: n0(m.caloriasKcal), unidade: "kcal" });
	if (m.elevacaoGanhoM) itens.push({ rotulo: "Subida (relógio)", valor: n0(m.elevacaoGanhoM), unidade: "m" });
	return itens;
}

/** Métricas gravadas pelo Apple Watch e lidas do app Saúde (não vêm do Strava). */
export function CorridaMetricasRelogio({
	metricas,
	detalhe,
	distanciaMetros,
}: {
	metricas: MetricasRelogio;
	detalhe?: RotaDetalhada | null;
	distanciaMetros?: number;
}) {
	const itens = montarItens(metricas);
	const voltas = metricas.voltas ?? [];
	const splits = metricas.splits ?? [];
	if (itens.length === 0 && voltas.length === 0 && splits.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Do Apple Watch</CardTitle>
				<CardDescription>Média da corrida inteira, lida do app Saúde</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{itens.map((i) => (
						<div key={i.rotulo} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
							<dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{i.rotulo}</dt>
							<dd className="mt-0.5 text-xl font-bold tabular-nums">
								{i.valor} <span className="text-xs font-medium text-muted-foreground">{i.unidade}</span>
							</dd>
							{i.nota && <p className="text-xs text-muted-foreground tabular-nums">{i.nota}</p>}
						</div>
					))}
				</dl>

				<DetalhamentoRelogio voltas={voltas} splits={splits} detalhe={detalhe} distanciaMetros={distanciaMetros} />
			</CardContent>
		</Card>
	);
}
