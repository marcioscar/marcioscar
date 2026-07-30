import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { cn } from "~/lib/utils";
import { resolvePace } from "~/lib/trainingPaceUtils";
import type { Session } from "~/data/halfMarathonPlan";
import type { CorridaSemanaAtual } from "~/models/corrida-dashboard.server";

const DIAS_ORDEM: Session["day"][] = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function diaDaSemanaLabel(data: Date): Session["day"] {
	// getUTCDay: 0=Dom .. 6=Sáb
	return DIAS_ORDEM[(data.getUTCDay() + 6) % 7];
}

function formatarDistPace(corrida: CorridaSemanaAtual): string {
	const distKm = corrida.distanciaMetros / 1000;
	const paceSeg = distKm > 0 ? corrida.tempoMovimentoSeg / distKm : 0;
	const min = Math.floor(paceSeg / 60);
	const seg = Math.round(paceSeg % 60);
	return `${distKm.toFixed(1)}km · ${min}:${String(seg).padStart(2, "0")}/km`;
}

type Props = {
	sessions: Session[];
	targetPace: string;
	corridasSemana: CorridaSemanaAtual[];
	hojeLabel: Session["day"];
};

export function CorridaSessoesSemana({ sessions, targetPace, corridasSemana, hojeLabel }: Props) {
	const corridasPorDia = new Map<Session["day"], CorridaSemanaAtual[]>();
	for (const corrida of corridasSemana) {
		const dia = diaDaSemanaLabel(new Date(corrida.dataInicio));
		const lista = corridasPorDia.get(dia) ?? [];
		lista.push(corrida);
		corridasPorDia.set(dia, lista);
	}

	const hojeIdx = DIAS_ORDEM.indexOf(hojeLabel);
	const proximaPendenteIdx = sessions.findIndex(
		(s) => !corridasPorDia.has(s.day) && DIAS_ORDEM.indexOf(s.day) >= hojeIdx,
	);

	return (
		<div className="grid gap-2.5 sm:grid-cols-3">
			{sessions.map((session, i) => {
				const corridasDoDia = corridasPorDia.get(session.day) ?? [];
				const feito = corridasDoDia.length > 0;
				const isProxima = i === proximaPendenteIdx;
				const pace = resolvePace(targetPace, session.paceOffset);

				return (
					<div
						key={i}
						className={cn(
							"relative rounded-xl border px-3.5 py-3",
							feito ? "border-border bg-muted/30 opacity-70" : "border-border bg-card",
							isProxima && "border-blue-500/50 ring-1 ring-blue-500/20",
						)}
					>
						{isProxima && (
							<span className="absolute -top-2 right-3 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
								PRÓXIMA
							</span>
						)}
						<p className="text-xs text-muted-foreground">{session.day}</p>
						<p className={cn("flex items-center gap-1 text-sm font-semibold", feito && "line-through")}>
							{session.type}
							{feito && <HugeiconsIcon icon={Tick01Icon} className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />}
						</p>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							{feito
								? corridasDoDia.map((c) => formatarDistPace(c)).join(" + ")
								: `${session.detail} (${pace})`}
						</p>
					</div>
				);
			})}
		</div>
	);
}
