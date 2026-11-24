import { Link } from "react-router";
import { Alert01Icon, AiMagicIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { classificarZonaPace } from "~/lib/paceZone";
import type { CorridaResumo } from "~/models/corridas.server";
import type { AnaliseResult } from "~/types/analise";
import { ChevronRight } from "lucide-react";
import { formatarPace, formatarTempo } from "~/lib/formatar-corrida";
import { RotaMini } from "./rota-mini";

type Props = {
	corridas: CorridaResumo[];
	paceAlvoSeg: number;
	fcMaximaReferencia: number | null;
};

type ZonaExibida = { label: string; corClasse: string; daAnalise: boolean };

const COR_POR_AVALIACAO: Record<AnaliseResult["avaliacao"], string> = {
	excelente: "bg-sucesso/10 text-sucesso",
	bom: "bg-paleta-4/10 text-paleta-4",
	regular: "bg-alerta/10 text-alerta",
	ruim: "bg-perigo/10 text-perigo",
};

/**
 * A média de pace de uma sessão inteira (aquecimento + tiros + recuperação) engana em
 * treinos estruturados: um fartlek com tiros em Z5 pode ter pace médio de "Fácil".
 * Quando a corrida já foi analisada (splits/laps reais), usa o tipo de sessão real da
 * análise em vez da zona por pace médio.
 */
function obterZonaExibida(corrida: CorridaResumo, paceSeg: number, paceAlvoSeg: number): ZonaExibida | null {
	const analise = corrida.analise as AnaliseResult | null;
	if (analise?.tipoSessao) {
		return {
			label: analise.tipoSessao,
			corClasse: COR_POR_AVALIACAO[analise.avaliacao] ?? "bg-muted text-muted-foreground",
			daAnalise: true,
		};
	}

	if (paceSeg <= 0) return null;
	const zona = classificarZonaPace(paceSeg, paceAlvoSeg);
	return { ...zona, daAnalise: false };
}

/** Sinaliza custo fisiológico alto: FC perto do teto observado num ritmo que deveria ser fácil. */
function temAlertaFc(corrida: CorridaResumo, zona: ZonaExibida, fcMaximaReferencia: number | null): boolean {
	if (zona.daAnalise || !corrida.frequenciaMedia || !fcMaximaReferencia) return false;
	const zonaDeveriaSerFacil = zona.label === "Recuperação" || zona.label === "Fácil";
	return zonaDeveriaSerFacil && corrida.frequenciaMedia / fcMaximaReferencia > 0.82;
}

export function CorridaPacesTable({ corridas, paceAlvoSeg, fcMaximaReferencia }: Props) {
	if (corridas.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Paces recentes</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">Nenhuma corrida sincronizada ainda.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Histórico</CardTitle>
				<CardDescription>Últimas {corridas.length} corridas · tipo de sessão (análise quando disponível, senão zona por pace médio vs. pace-alvo)</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-2">
				{corridas.map((corrida) => {
					const distKm = corrida.distanciaMetros / 1000;
					const paceSeg = distKm > 0 ? corrida.tempoMovimentoSeg / distKm : 0;
					const zona = obterZonaExibida(corrida, paceSeg, paceAlvoSeg);
					const alerta = zona ? temAlertaFc(corrida, zona, fcMaximaReferencia) : false;

					return (
						<Link
							key={corrida.chave ?? corrida.stravaId}
							to={corrida.href ?? `/corridas/${corrida.stravaId}`}
							className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-accent/50">
							<RotaMini
								polyline={corrida.summaryPolyline}
								className="h-12 w-[72px] shrink-0 text-paleta-4"
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-semibold">
									{distKm.toFixed(2).replace(".", ",")} km · {corrida.nome}
								</p>
								<p className="text-xs text-muted-foreground">
									{new Date(corrida.dataInicio).toLocaleDateString("pt-BR", {
										weekday: "long",
										day: "numeric",
										month: "short",
										timeZone: "America/Sao_Paulo",
									})}
								</p>
								<div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
									<span className="rounded-md bg-muted px-1.5 py-0.5">{formatarTempo(corrida.tempoMovimentoSeg)}</span>
									<span className="rounded-md bg-muted px-1.5 py-0.5">{formatarPace(paceSeg)}</span>
									{zona && (
										<span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${zona.corClasse}`}>
											{zona.daAnalise && <HugeiconsIcon icon={AiMagicIcon} className="size-3" />}
											{zona.label}
											{alerta && <HugeiconsIcon icon={Alert01Icon} className="size-3" />}
										</span>
									)}
								</div>
							</div>
							<ChevronRight size={18} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
						</Link>
					);
				})}
			</CardContent>
		</Card>
	);
}
