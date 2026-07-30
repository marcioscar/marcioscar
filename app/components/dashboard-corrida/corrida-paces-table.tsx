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

type Props = {
	corridas: CorridaResumo[];
	paceAlvoSeg: number;
	fcMaximaReferencia: number | null;
};

type ZonaExibida = { label: string; corClasse: string; daAnalise: boolean };

const COR_POR_AVALIACAO: Record<AnaliseResult["avaliacao"], string> = {
	excelente: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	bom: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	regular: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
	ruim: "bg-red-500/10 text-red-600 dark:text-red-400",
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
				<CardTitle>Paces recentes</CardTitle>
				<CardDescription>Últimas {corridas.length} corridas · tipo de sessão (análise quando disponível, senão zona por pace médio vs. pace-alvo)</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-xs text-muted-foreground">
							<th className="pb-2 pr-3 text-left font-medium">Data</th>
							<th className="pb-2 pr-3 text-left font-medium">Sessão</th>
							<th className="pb-2 pr-3 text-left font-medium whitespace-nowrap">Distância</th>
							<th className="pb-2 pr-3 text-left font-medium whitespace-nowrap">Pace</th>
							<th className="pb-2 text-left font-medium">Tipo de sessão</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{corridas.map((corrida) => {
							const distKm = corrida.distanciaMetros / 1000;
							const paceSeg = distKm > 0 ? corrida.tempoMovimentoSeg / distKm : 0;
							const zona = obterZonaExibida(corrida, paceSeg, paceAlvoSeg);
							const alerta = zona ? temAlertaFc(corrida, zona, fcMaximaReferencia) : false;
							const min = Math.floor(paceSeg / 60);
							const seg = Math.round(paceSeg % 60);

							return (
								<tr key={corrida.stravaId}>
									<td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
										{new Date(corrida.dataInicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
									</td>
									<td className="py-2 pr-3">
										<Link to={`/corridas/${corrida.stravaId}`} className="hover:underline">
											{corrida.nome}
										</Link>
									</td>
									<td className="py-2 pr-3 whitespace-nowrap tabular-nums">{distKm.toFixed(1)}km</td>
									<td className="py-2 pr-3 whitespace-nowrap font-mono tabular-nums">
										{min}:{String(seg).padStart(2, "0")}/km
									</td>
									<td className="py-2">
										{zona && (
											<span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${zona.corClasse}`}>
												{zona.daAnalise && <HugeiconsIcon icon={AiMagicIcon} className="size-3" />}
												{zona.label}
												{alerta && <HugeiconsIcon icon={Alert01Icon} className="size-3" />}
											</span>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</CardContent>
		</Card>
	);
}
