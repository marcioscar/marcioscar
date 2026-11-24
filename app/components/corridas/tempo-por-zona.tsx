"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatarTempo } from "~/lib/formatar-corrida";
import { tempoPorZona, type LinhaZona } from "~/lib/tempo-por-zona";
import type { RotaDetalhada } from "~/types/rota";
import { COR_ZONA } from "~/components/treinos/treino-grafico";

type Props = {
	detalhe: RotaDetalhada;
	tempoTotalSeg: number;
	fcMaxima: number;
};

// FC: do azul claro ao vermelho, uma cor por zona
const COR_FC: Record<number, string> = {
	1: "var(--paleta-4)",
	2: "var(--paleta-7)",
	3: "var(--paleta-3)",
	4: "var(--paleta-2)",
	5: "var(--paleta-5)",
};

function Linhas({ linhas, cor }: { linhas: LinhaZona[]; cor: (l: LinhaZona) => string }) {
	return (
		<div className="grid gap-2.5">
			<div className="grid grid-cols-[minmax(0,9.5rem)_1fr_3rem_4.5rem] items-center gap-3 text-xs text-muted-foreground">
				<span>Zona</span>
				<span />
				<span className="text-right">%</span>
				<span className="text-right">Duração</span>
			</div>
			{linhas.map((l) => (
				<div key={`${l.id}-${l.nome}`} className="grid grid-cols-[minmax(0,9.5rem)_1fr_3rem_4.5rem] items-center gap-3 text-sm">
					<div className="min-w-0">
						<p className="truncate font-medium">
							{l.id !== "—" && <span className="mr-1.5 text-xs text-muted-foreground">{l.id}</span>}
							{l.nome}
						</p>
						<p className="truncate text-[11px] text-muted-foreground tabular-nums">{l.faixa}</p>
					</div>
					<div className="h-3 overflow-hidden rounded-full bg-muted">
						<div className="h-full rounded-full" style={{ width: `${Math.max(l.pct, l.pct > 0 ? 1.5 : 0)}%`, background: cor(l) }} />
					</div>
					<span className="text-right tabular-nums">{Math.round(l.pct)}%</span>
					<span className="text-right text-xs text-muted-foreground tabular-nums">{formatarTempo(Math.round(l.seg))}</span>
				</div>
			))}
		</div>
	);
}

/** Tempo em cada zona de pace (Z1–Z6, tabela Canova + Daniels) e de FC (% da FC máxima). */
export function TempoPorZona({ detalhe, tempoTotalSeg, fcMaxima }: Props) {
	const dados = tempoPorZona(detalhe, tempoTotalSeg, fcMaxima);
	const [aba, setAba] = useState<"pace" | "fc">(dados.pace ? "pace" : "fc");
	if (!dados.pace && !dados.fc) return null;

	const abas = [
		...(dados.pace ? [{ id: "pace" as const, rotulo: "Pace" }] : []),
		...(dados.fc ? [{ id: "fc" as const, rotulo: "Freq. cardíaca" }] : []),
	];

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle>Tempo por zona</CardTitle>
						<CardDescription>
							{aba === "pace"
								? "Quanto da corrida ficou em cada zona de ritmo"
								: `Zonas por % da FC máxima (${Math.round(dados.fcMaxima)} bpm)`}
						</CardDescription>
					</div>
					{abas.length > 1 && (
						<div role="tablist" aria-label="Tipo de zona" className="flex rounded-md border p-0.5">
							{abas.map((a) => (
								<button
									key={a.id}
									type="button"
									role="tab"
									aria-selected={aba === a.id}
									onClick={() => setAba(a.id)}
									className={
										"rounded px-2.5 py-1 text-xs font-medium transition-colors " +
										(aba === a.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
									}>
									{a.rotulo}
								</button>
							))}
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{aba === "pace" && dados.pace && (
					<Linhas linhas={dados.pace} cor={(l) => (l.ordem === 0 ? "var(--muted-foreground)" : COR_ZONA[l.ordem])} />
				)}
				{aba === "fc" && dados.fc && <Linhas linhas={dados.fc} cor={(l) => COR_FC[l.ordem]} />}
			</CardContent>
		</Card>
	);
}
