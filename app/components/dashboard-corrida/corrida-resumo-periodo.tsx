import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { formatarPace } from "~/lib/formatar-corrida";
import type { TotaisPeriodo } from "~/lib/carga-treino";
import { cn } from "~/lib/utils";

const num = (n: number, casas = 0) =>
	n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function duracao(seg: number): string {
	const h = Math.floor(seg / 3600);
	const m = Math.round((seg % 3600) / 60);
	return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

type TileProps = {
	rotulo: string;
	valor: string;
	anterior: string;
	delta: number; // atual - anterior
	// "menor é melhor" (pace): inverte a cor da seta
	menorMelhor?: boolean;
	destaque?: boolean;
};

function Tile({ rotulo, valor, anterior, delta, menorMelhor, destaque }: TileProps) {
	const Seta = Math.abs(delta) < 1e-9 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
	const bom = menorMelhor ? delta < 0 : delta > 0;
	return (
		<div
			className={cn(
				"min-w-0 rounded-2xl px-4 py-3",
				destaque ? "text-white" : "border border-border bg-card",
			)}
			style={destaque ? { background: "var(--paleta-4)" } : undefined}>
			<p className={cn("text-xs", destaque ? "text-white/80" : "text-muted-foreground")}>{rotulo}</p>
			<div className="mt-1 flex items-center gap-2">
				<span
					aria-hidden
					className={cn(
						"flex size-6 shrink-0 items-center justify-center rounded-full",
						destaque ? "bg-white/20" : bom ? "bg-sucesso/15 text-sucesso" : "bg-muted text-muted-foreground",
					)}>
					<Seta size={14} />
				</span>
				<p className="truncate text-xl font-bold tabular-nums">{valor}</p>
			</div>
			<p className={cn("mt-1 truncate text-xs tabular-nums", destaque ? "text-white/75" : "text-muted-foreground")}>
				antes: {anterior}
			</p>
		</div>
	);
}

export function CorridaResumoPeriodo({ atual, anterior }: { atual: TotaisPeriodo; anterior: TotaisPeriodo }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Resumo</CardTitle>
				<CardDescription>Últimos 7 dias, comparado aos 7 anteriores</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-3">
					<Tile
						destaque
						rotulo="Carga"
						valor={num(atual.carga)}
						anterior={num(anterior.carga)}
						delta={atual.carga - anterior.carga}
					/>
					<Tile
						rotulo="Duração"
						valor={duracao(atual.duracaoSeg)}
						anterior={duracao(anterior.duracaoSeg)}
						delta={atual.duracaoSeg - anterior.duracaoSeg}
					/>
					<Tile
						rotulo="Distância"
						valor={`${num(atual.metros / 1000, 1)} km`}
						anterior={`${num(anterior.metros / 1000, 1)} km`}
						delta={atual.metros - anterior.metros}
					/>
					<Tile
						rotulo="Ganho de elevação"
						valor={`${num(atual.ganhoM)} m`}
						anterior={`${num(anterior.ganhoM)} m`}
						delta={atual.ganhoM - anterior.ganhoM}
					/>
					<Tile
						rotulo="Pace médio"
						valor={formatarPace(atual.paceSegPorKm, "")}
						anterior={formatarPace(anterior.paceSegPorKm, "")}
						delta={(atual.paceSegPorKm ?? 0) - (anterior.paceSegPorKm ?? 0)}
						menorMelhor
					/>
					<Tile
						rotulo="Sessões"
						valor={`${atual.sessoes}×`}
						anterior={`${anterior.sessoes}×`}
						delta={atual.sessoes - anterior.sessoes}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
