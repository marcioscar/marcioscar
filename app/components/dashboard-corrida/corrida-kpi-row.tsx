import { HugeiconsIcon } from "@hugeicons/react";
import { RunningShoesIcon, Timer01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { cn } from "~/lib/utils";
import { diffParaAlvoStr } from "~/lib/paceZone";

type Props = {
	kmSemana: number;
	kmSemanaAlvo: number;
	melhorPaceRecenteSeg: number | null;
	paceAlvoSeg: number;
	sessoesFeitas: number;
	sessoesPlanejadas: number;
};

function Tile({ icon, label, valor, nota, notaClasse }: {
	icon: typeof RunningShoesIcon;
	label: string;
	valor: React.ReactNode;
	nota: string;
	notaClasse?: string;
}) {
	return (
		<div className="rounded-2xl border border-border bg-card px-4 py-3.5">
			<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<HugeiconsIcon icon={icon} className="size-3.5" />
				{label}
			</p>
			<p className="mt-1 text-2xl font-bold tabular-nums">{valor}</p>
			<p className={cn("mt-0.5 text-xs text-muted-foreground", notaClasse)}>{nota}</p>
		</div>
	);
}

export function CorridaKpiRow({
	kmSemana,
	kmSemanaAlvo,
	melhorPaceRecenteSeg,
	paceAlvoSeg,
	sessoesFeitas,
	sessoesPlanejadas,
}: Props) {
	const pctVolume = kmSemanaAlvo > 0 ? Math.round((kmSemana / kmSemanaAlvo) * 100) : null;

	return (
		<div className="grid gap-3 sm:grid-cols-3">
			<Tile
				icon={RunningShoesIcon}
				label="Volume desta semana"
				valor={`${kmSemana.toFixed(1)} km`}
				nota={pctVolume !== null ? `${pctVolume}% da meta de ${kmSemanaAlvo}km` : "sem meta de volume"}
			/>
			<Tile
				icon={Timer01Icon}
				label="Melhor pace recente vs. meta"
				valor={
					melhorPaceRecenteSeg !== null
						? `${Math.floor(melhorPaceRecenteSeg / 60)}:${String(Math.round(melhorPaceRecenteSeg % 60)).padStart(2, "0")}`
						: "—"
				}
				nota={melhorPaceRecenteSeg !== null ? diffParaAlvoStr(melhorPaceRecenteSeg, paceAlvoSeg) + " da meta" : "sem corridas recentes"}
				notaClasse={
					melhorPaceRecenteSeg !== null
						? melhorPaceRecenteSeg <= paceAlvoSeg
							? "text-emerald-600 dark:text-emerald-400"
							: "text-amber-600 dark:text-amber-400"
						: undefined
				}
			/>
			<Tile
				icon={Tick01Icon}
				label="Sessões desta semana"
				valor={`${sessoesFeitas} / ${sessoesPlanejadas}`}
				nota={sessoesFeitas >= sessoesPlanejadas ? "semana completa" : `faltam ${sessoesPlanejadas - sessoesFeitas}`}
			/>
		</div>
	);
}
