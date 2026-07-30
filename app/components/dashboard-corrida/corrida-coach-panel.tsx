import { useFetcher } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon, Alert01Icon, ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { CoachInsight } from "~/models/coach-insight.server";

type Props = {
	insight: CoachInsight | null;
};

export function CorridaCoachPanel({ insight }: Props) {
	const fetcher = useFetcher();
	const gerando = fetcher.state !== "idle";

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-2">
					<div>
						<CardTitle className="flex items-center gap-1.5">
							<HugeiconsIcon icon={AiMagicIcon} className="size-4 text-blue-500" />
							Leitura do treinador
						</CardTitle>
						<CardDescription>
							{insight
								? `Gerada em ${new Date(insight.geradoEm).toLocaleString("pt-BR")}`
								: "Ainda não gerada para esta semana"}
						</CardDescription>
					</div>
					<fetcher.Form method="post">
						<input type="hidden" name="_intent" value="gerarLeituraTreinador" />
						<Button type="submit" size="sm" variant="outline" disabled={gerando} className="gap-1.5">
							<HugeiconsIcon
								icon={ArrowReloadHorizontalIcon}
								className={`size-3.5 ${gerando ? "animate-spin" : ""}`}
							/>
							{gerando ? "Gerando..." : insight ? "Atualizar" : "Gerar leitura"}
						</Button>
					</fetcher.Form>
				</div>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{!insight && !gerando && (
					<p className="text-sm text-muted-foreground">
						Clique em "Gerar leitura" para uma análise da semana atual cruzando o plano de treino com os
						dados reais do Strava.
					</p>
				)}

				{insight && (
					<>
						<p className="text-sm leading-relaxed text-muted-foreground">{insight.resumo}</p>

						<div className="grid gap-2.5 sm:grid-cols-2">
							{insight.insights.map((item, i) => (
								<div
									key={i}
									className={`rounded-xl border-l-2 bg-muted/30 px-3.5 py-2.5 ${item.flag ? "border-l-amber-500" : "border-l-blue-500"}`}
								>
									<p
										className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${item.flag ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}
									>
										{item.flag && <HugeiconsIcon icon={Alert01Icon} className="size-3" />}
										{item.framework}
									</p>
									<p className="mt-1 text-sm text-muted-foreground">{item.texto}</p>
								</div>
							))}
						</div>

						{insight.dicas.length > 0 && (
							<ul className="flex flex-col gap-0">
								{insight.dicas.map((dica, i) => (
									<li
										key={i}
										className="border-t border-border py-2.5 pl-5 text-sm text-muted-foreground first:border-t-0"
										style={{ position: "relative" }}
									>
										<span className="absolute left-0 font-bold text-blue-500">→</span>
										{dica}
									</li>
								))}
							</ul>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
