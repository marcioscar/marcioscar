import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatarPace, formatarTempo } from "~/lib/formatar-corrida";

type SplitRelogio = { km: number; distanciaM: number; tempoSeg: number; fcMedia: number | null };
type VoltaRelogio = {
	indice: number;
	tipo: string;
	rotulo?: string | null;
	distanciaM: number;
	tempoSeg: number;
	fcMedia: number | null;
};

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

function paceDe(distanciaM: number, tempoSeg: number): string {
	return distanciaM > 0 ? formatarPace(tempoSeg / (distanciaM / 1000)) : "—";
}

function Tabela({
	titulo,
	linhas,
}: {
	titulo: string;
	linhas: { chave: string; rotulo: string; distanciaM: number; tempoSeg: number; fcMedia: number | null }[];
}) {
	return (
		<div className="min-w-0">
			<h3 className="mb-2 text-sm font-semibold">{titulo}</h3>
			<div className="overflow-x-auto rounded-xl border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/40 text-xs text-muted-foreground">
							<th className="px-3 py-2 text-left font-medium">#</th>
							<th className="px-3 py-2 text-right font-medium">Dist.</th>
							<th className="px-3 py-2 text-right font-medium">Tempo</th>
							<th className="px-3 py-2 text-right font-medium">Pace</th>
							<th className="px-3 py-2 text-right font-medium">FC</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{linhas.map((l) => (
							<tr key={l.chave}>
								<td className="px-3 py-1.5 font-medium">{l.rotulo}</td>
								<td className="px-3 py-1.5 text-right tabular-nums">
									{l.distanciaM >= 1000
										? `${(l.distanciaM / 1000).toFixed(2).replace(".", ",")} km`
										: `${Math.round(l.distanciaM)} m`}
								</td>
								<td className="px-3 py-1.5 text-right tabular-nums">{formatarTempo(l.tempoSeg)}</td>
								<td className="px-3 py-1.5 text-right tabular-nums">{paceDe(l.distanciaM, l.tempoSeg)}</td>
								<td className="px-3 py-1.5 text-right tabular-nums">{l.fcMedia ? Math.round(l.fcMedia) : "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

/** Métricas gravadas pelo Apple Watch e lidas do app Saúde (não vêm do Strava). */
export function CorridaMetricasRelogio({ metricas }: { metricas: MetricasRelogio }) {
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

				{(voltas.length > 0 || splits.length > 0) && (
					<div className="mt-5 grid gap-5 lg:grid-cols-2">
						{voltas.length > 0 && (
							<Tabela
								titulo="Voltas do relógio"
								linhas={voltas.map((v) => ({ chave: `v${v.indice}`, ...v, rotulo: v.rotulo || String(v.indice) }))}
							/>
						)}
						{splits.length > 0 && (
							<Tabela
								titulo="Splits por km do relógio"
								linhas={splits.map((s) => ({ chave: `s${s.km}`, rotulo: String(s.km), ...s }))}
							/>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
