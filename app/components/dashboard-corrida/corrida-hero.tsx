import { HugeiconsIcon } from "@hugeicons/react";
import { Flag01Icon, Target01Icon, Calendar01Icon } from "@hugeicons/core-free-icons";
import { cn } from "~/lib/utils";
import { parsePace, formatPace } from "~/lib/paceZone";

type Props = {
	provaNome: string;
	dataProva: string;
	diasRestantes: number;
	paceAlvo: string;
	distanciaKm: number;
	faseAtual: string | null;
	semanaAtual: number | null;
	totalSemanas: number;
};

function formatarTempoAlvo(paceAlvo: string, distanciaKm: number): string {
	const paceSeg = parsePace(paceAlvo);
	const totalSeg = Math.round(paceSeg * distanciaKm);
	const h = Math.floor(totalSeg / 3600);
	const m = Math.floor((totalSeg % 3600) / 60);
	return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

export function CorridaHero({
	provaNome,
	dataProva,
	diasRestantes,
	paceAlvo,
	distanciaKm,
	faseAtual,
	semanaAtual,
	totalSemanas,
}: Props) {
	const corDestaque =
		diasRestantes <= 7
			? "border-red-500/40 bg-red-500/5"
			: diasRestantes <= 21
				? "border-amber-500/40 bg-amber-500/5"
				: "border-foreground/15 bg-foreground/[0.03]";

	return (
		<div className={cn("rounded-2xl border px-5 py-5 sm:px-6 sm:py-6", corDestaque)}>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<div className="flex flex-col leading-none">
						<span className="text-4xl font-bold tabular-nums sm:text-5xl">
							{diasRestantes >= 0 ? diasRestantes : 0}
						</span>
						<span className="mt-1 text-xs text-muted-foreground">
							dia{diasRestantes === 1 ? "" : "s"} até a prova
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<p className="flex items-center gap-1.5 font-semibold">
							<HugeiconsIcon icon={Flag01Icon} className="size-4 text-muted-foreground" />
							{provaNome}
						</p>
						<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<HugeiconsIcon icon={Calendar01Icon} className="size-3.5" />
							{new Date(dataProva).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })}
						</p>
						{semanaAtual !== null && (
							<p className="text-xs text-muted-foreground">
								Semana {semanaAtual} de {totalSemanas} · fase {faseAtual}
							</p>
						)}
					</div>
				</div>

				<div className="flex gap-2">
					<div className="min-w-[120px] rounded-xl border border-border bg-card px-3.5 py-2.5">
						<p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
							<HugeiconsIcon icon={Target01Icon} className="size-3" />
							Meta
						</p>
						<p className="mt-0.5 text-lg font-bold tabular-nums">
							Sub-{formatarTempoAlvo(paceAlvo, distanciaKm)}
						</p>
						<p className="text-[11px] text-muted-foreground">{formatPace(parsePace(paceAlvo))}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
