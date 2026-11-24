"use client";

import { useMemo, useState } from "react";
import { formatarPace, formatarTempo } from "~/lib/formatar-corrida";
import { montarDadosGrafico } from "~/lib/dados-grafico-rota";
import type { RotaDetalhada } from "~/types/rota";

export type SplitRelogio = { km: number; distanciaM: number; tempoSeg: number; fcMedia: number | null };
export type VoltaRelogio = {
	indice: number;
	tipo: string;
	rotulo?: string | null;
	potenciaW?: number | null;
	cadencia?: number | null;
	passadaM?: number | null;
	oscilacaoCm?: number | null;
	contatoMs?: number | null;
	distanciaM: number;
	tempoSeg: number;
	fcMedia: number | null;
};

type Trecho = {
	chave: string;
	rotulo: string;
	distanciaM: number;
	tempoSeg: number;
	fcMedia: number | null;
	potenciaW?: number | null;
	cadencia?: number | null;
	contatoMs?: number | null;
	oscilacaoCm?: number | null;
	/** variação de altitude no trecho, em metros */
	deltaAlt: number | null;
};

type Aba = "intervalos" | "1km" | "5km";

type Props = {
	voltas: VoltaRelogio[];
	splits: SplitRelogio[];
	/** rota de alta resolução, para calcular a variação de altitude de cada trecho */
	detalhe?: RotaDetalhada | null;
	distanciaMetros?: number;
};

/** Altitude interpolada em uma distância (m) da corrida, a partir da rota de alta resolução. */
function criarAltitudeEm(detalhe: RotaDetalhada | null | undefined, distanciaMetros: number): ((m: number) => number | null) | null {
	if (!detalhe?.alt || distanciaMetros <= 0) return null;
	const pontos = montarDadosGrafico(detalhe, distanciaMetros).filter((p) => p.alt !== null);
	if (pontos.length < 2) return null;
	return (m: number) => {
		const km = m / 1000;
		if (km <= pontos[0].km) return pontos[0].alt;
		if (km >= pontos[pontos.length - 1].km) return pontos[pontos.length - 1].alt;
		let i = 1;
		while (i < pontos.length - 1 && pontos[i].km < km) i++;
		const a = pontos[i - 1];
		const b = pontos[i];
		const t = b.km > a.km ? (km - a.km) / (b.km - a.km) : 0;
		return a.alt! + (b.alt! - a.alt!) * t;
	};
}

function mediaPonderada(trechos: { fcMedia: number | null; tempoSeg: number }[]): number | null {
	const com = trechos.filter((t) => t.fcMedia);
	const peso = com.reduce((a, t) => a + t.tempoSeg, 0);
	return peso > 0 ? com.reduce((a, t) => a + t.fcMedia! * t.tempoSeg, 0) / peso : null;
}

function agrupar(splits: SplitRelogio[], tamanho: number, altEm: ((m: number) => number | null) | null): Trecho[] {
	const grupos: Trecho[] = [];
	let acumulado = 0;
	for (let i = 0; i < splits.length; i += tamanho) {
		const parte = splits.slice(i, i + tamanho);
		const distanciaM = parte.reduce((a, s) => a + s.distanciaM, 0);
		const inicio = acumulado;
		acumulado += distanciaM;
		const a = altEm?.(inicio) ?? null;
		const b = altEm?.(acumulado) ?? null;
		const primeiro = parte[0].km;
		const ultimo = parte[parte.length - 1].km;
		grupos.push({
			chave: `g${primeiro}`,
			rotulo: tamanho === 1 ? String(primeiro) : primeiro === ultimo ? String(primeiro) : `${primeiro}–${ultimo}`,
			distanciaM,
			tempoSeg: parte.reduce((a2, s) => a2 + s.tempoSeg, 0),
			fcMedia: mediaPonderada(parte),
			deltaAlt: a !== null && b !== null ? b - a : null,
		});
	}
	return grupos;
}

function mostrarDistancia(m: number): string {
	return m >= 1000 ? `${(m / 1000).toFixed(2).replace(".", ",")} km` : `${Math.round(m)} m`;
}

function mostrarDelta(v: number | null): string {
	if (v === null) return "—";
	const r = Math.round(v);
	return r > 0 ? `+${r}` : String(r);
}

/** Tabela com seletor Intervalos / 1 km / 5 km, como no app Fitness. */
export function DetalhamentoRelogio({ voltas, splits, detalhe, distanciaMetros }: Props) {
	const abas = [
		...(voltas.length > 1 ? [{ id: "intervalos" as const, rotulo: "Intervalos" }] : []),
		...(splits.length > 0 ? [{ id: "1km" as const, rotulo: "1 km" }] : []),
		...(splits.length >= 5 ? [{ id: "5km" as const, rotulo: "5 km" }] : []),
	];
	const [aba, setAba] = useState<Aba>(abas[0]?.id ?? "1km");

	const dados = useMemo(() => {
		const total = distanciaMetros ?? splits.reduce((a, s) => a + s.distanciaM, 0);
		const altEm = criarAltitudeEm(detalhe, total);

		// intervalos: a distância acumulada de cada etapa dá o ponto de início na rota
		let acumulado = 0;
		const intervalos: Trecho[] = voltas.map((v) => {
			const inicio = acumulado;
			acumulado += v.distanciaM;
			const a = altEm?.(inicio) ?? null;
			const b = altEm?.(acumulado) ?? null;
			return {
				chave: `v${v.indice}`,
				rotulo: v.rotulo || String(v.indice),
				distanciaM: v.distanciaM,
				tempoSeg: v.tempoSeg,
				fcMedia: v.fcMedia,
				potenciaW: v.potenciaW,
				cadencia: v.cadencia,
				contatoMs: v.contatoMs,
				oscilacaoCm: v.oscilacaoCm,
				deltaAlt: a !== null && b !== null ? b - a : null,
			};
		});

		return { intervalos, km1: agrupar(splits, 1, altEm), km5: agrupar(splits, 5, altEm) };
	}, [voltas, splits, detalhe, distanciaMetros]);

	if (abas.length === 0) return null;
	const linhas = aba === "intervalos" ? dados.intervalos : aba === "1km" ? dados.km1 : dados.km5;
	const mostra = {
		pot: linhas.some((l) => l.potenciaW),
		cad: linhas.some((l) => l.cadencia),
		cont: linhas.some((l) => l.contatoMs),
		osc: linhas.some((l) => l.oscilacaoCm),
		alt: linhas.some((l) => l.deltaAlt !== null),
	};

	return (
		<div className="mt-5 grid gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-sm font-semibold">Detalhamento</h3>
				{abas.length > 1 && (
					<div role="tablist" aria-label="Agrupar por" className="flex rounded-md border p-0.5">
						{abas.map((a) => (
							<button
								key={a.id}
								type="button"
								role="tab"
								aria-selected={aba === a.id}
								onClick={() => setAba(a.id)}
								className={
									"rounded px-3 py-1 text-xs font-medium transition-colors " +
									(aba === a.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
								}>
								{a.rotulo}
							</button>
						))}
					</div>
				)}
			</div>

			<div className="overflow-x-auto rounded-xl border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/40 text-xs text-muted-foreground">
							<th className="px-3 py-2 text-left font-medium">{aba === "intervalos" ? "Etapa" : "Km"}</th>
							<th className="px-3 py-2 text-right font-medium">Dist.</th>
							<th className="px-3 py-2 text-right font-medium">Tempo</th>
							<th className="px-3 py-2 text-right font-medium">Pace</th>
							<th className="px-3 py-2 text-right font-medium">FC</th>
							{mostra.alt && <th className="px-3 py-2 text-right font-medium">Δ alt.</th>}
							{mostra.pot && <th className="px-3 py-2 text-right font-medium">Pot.</th>}
							{mostra.cad && <th className="px-3 py-2 text-right font-medium">Cad.</th>}
							{mostra.cont && <th className="px-3 py-2 text-right font-medium">Contato</th>}
							{mostra.osc && <th className="px-3 py-2 text-right font-medium">Osc.</th>}
						</tr>
					</thead>
					<tbody className="divide-y">
						{linhas.map((l) => (
							<tr key={l.chave}>
								<td className="px-3 py-1.5 font-medium whitespace-nowrap">{l.rotulo}</td>
								<td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{mostrarDistancia(l.distanciaM)}</td>
								<td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{formatarTempo(Math.round(l.tempoSeg))}</td>
								<td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
									{/* descansos (poucos metros em 1:30) dão um pace sem sentido: o Fitness também mostra "—" */}
									{l.distanciaM >= 150 ? formatarPace(l.tempoSeg / (l.distanciaM / 1000)) : "—"}
								</td>
								<td className="px-3 py-1.5 text-right tabular-nums">{l.fcMedia ? Math.round(l.fcMedia) : "—"}</td>
								{mostra.alt && <td className="px-3 py-1.5 text-right tabular-nums">{mostrarDelta(l.deltaAlt)} m</td>}
								{mostra.pot && <td className="px-3 py-1.5 text-right tabular-nums">{l.potenciaW ? `${Math.round(l.potenciaW)} W` : "—"}</td>}
								{mostra.cad && <td className="px-3 py-1.5 text-right tabular-nums">{l.cadencia ? Math.round(l.cadencia) : "—"}</td>}
								{mostra.cont && <td className="px-3 py-1.5 text-right tabular-nums">{l.contatoMs ? `${Math.round(l.contatoMs)} ms` : "—"}</td>}
								{mostra.osc && <td className="px-3 py-1.5 text-right tabular-nums">{l.oscilacaoCm ? `${l.oscilacaoCm.toFixed(1)} cm` : "—"}</td>}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
