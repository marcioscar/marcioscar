import * as React from "react";
import { Button } from "~/components/ui/button";
import type { AnaliseResult, AnalyzeApiResponse } from "~/types/analise";

const AVALIACAO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
	excelente: { bg: "bg-sucesso/10", text: "text-sucesso", label: "Excelente" },
	bom: { bg: "bg-paleta-4/10", text: "text-paleta-4", label: "Bom" },
	regular: { bg: "bg-alerta/10", text: "text-alerta", label: "Regular" },
	ruim: { bg: "bg-perigo/10", text: "text-perigo", label: "Ruim" },
};

type Props = {
	healthId: string;
	analiseInicial: AnaliseResult | null;
	analisadaEmInicial: string | null;
};

/** Análise por IA de uma corrida lida do Apple Watch (usa etapas, splits e métricas do relógio). */
export function AnaliseIaRelogio({ healthId, analiseInicial, analisadaEmInicial }: Props) {
	const [analise, setAnalise] = React.useState<AnaliseResult | null>(analiseInicial);
	const [analisadaEm, setAnalisadaEm] = React.useState<string | null>(analisadaEmInicial);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [treinusPlano, setTreinusPlano] = React.useState("");

	const style = analise ? (AVALIACAO_STYLE[analise.avaliacao] ?? AVALIACAO_STYLE.regular) : null;
	const dataTexto = analisadaEm
		? new Date(analisadaEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
		: null;

	async function chamarAnalise() {
		setError(null);
		setLoading(true);
		try {
			const res = await fetch("/api/analisar-corrida", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ healthId, treinusPlano: treinusPlano || null }),
			});
			if (!res.ok) {
				const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(corpo?.error ?? `Falha na análise (HTTP ${res.status}).`);
			}
			const result = (await res.json()) as AnalyzeApiResponse;
			setAnalise(result.analise);
			setAnalisadaEm(new Date().toISOString());
		} catch (err) {
			setError(`Não foi possível analisar. ${err instanceof Error ? err.message : "Erro desconhecido."}`);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex max-w-xl flex-col gap-4">
			<div className="flex items-center justify-between">
				<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Análise Canova</p>
				{!analise && !loading && (
					<Button size="sm" onClick={chamarAnalise} className="h-7 text-xs">
						✦ Analisar com IA
					</Button>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Treino planejado (opcional)</p>
				<textarea
					value={treinusPlano}
					onChange={(e) => setTreinusPlano(e.target.value)}
					placeholder="Cole aqui o treino prescrito, ex: 6x400m a 4:15/km · rec 90s"
					rows={2}
					className="w-full resize-none rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
				/>
			</div>

			{loading && (
				<div className="flex items-center gap-3 py-8 text-muted-foreground">
					<div className="size-5 shrink-0 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
					<p className="text-sm">Analisando com Claude os dados do relógio...</p>
				</div>
			)}

			{error && !loading && (
				<div className="rounded-xl border border-perigo/20 bg-perigo/10 px-4 py-3 text-sm text-perigo">{error}</div>
			)}

			{!analise && !loading && !error && (
				<p className="text-sm leading-relaxed text-muted-foreground">
					Clique em "Analisar com IA" para uma análise baseada na metodologia Canova, usando as etapas, os splits e as
					métricas do Apple Watch.
				</p>
			)}

			{analise && !loading && style && (
				<div className="flex flex-col gap-4">
					<div className="flex items-start justify-between gap-3">
						<div className="flex flex-col gap-0.5">
							<span className="text-[10px] tracking-wide text-muted-foreground uppercase">Tipo de sessão</span>
							<span className="text-base font-semibold">{analise.tipoSessao}</span>
						</div>
						<div className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${style.bg} ${style.text}`}>{style.label}</div>
					</div>

					<div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed">{analise.resumo}</div>

					{analise.pontosPositivos.length > 0 && (
						<ul className="flex flex-col gap-2">
							{analise.pontosPositivos.map((p, i) => (
								<li key={i} className="flex gap-2 text-sm text-sucesso">
									<span className="mt-0.5 shrink-0">✓</span>
									<span>{p}</span>
								</li>
							))}
						</ul>
					)}

					{analise.pontosAtencao.length > 0 && (
						<ul className="flex flex-col gap-2">
							{analise.pontosAtencao.map((p, i) => (
								<li key={i} className="flex gap-2 text-sm text-alerta">
									<span className="mt-0.5 shrink-0">⚠</span>
									<span>{p}</span>
								</li>
							))}
						</ul>
					)}

					<div className="flex flex-col gap-1">
						<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Metodologia Canova</p>
						<p className="text-sm leading-relaxed">{analise.alinhamentoCanova}</p>
					</div>

					{analise.metricasRelogio && (
						<div className="rounded-2xl border border-paleta-4/20 bg-paleta-4/5 px-4 py-3">
							<p className="mb-1 text-xs font-medium tracking-wide text-paleta-4 uppercase">Métricas do relógio</p>
							<p className="text-sm leading-relaxed">{analise.metricasRelogio}</p>
						</div>
					)}

					{analise.comparacaoTreinus && (
						<div className="rounded-2xl border border-paleta-6/20 bg-paleta-6/5 px-4 py-3">
							<p className="mb-1 text-xs font-medium tracking-wide text-paleta-6 uppercase">Planejado vs Executado</p>
							<p className="text-sm leading-relaxed">{analise.comparacaoTreinus}</p>
						</div>
					)}

					<div className="rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3">
						<p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Próximo treino</p>
						<p className="text-sm leading-relaxed">{analise.recomendacao}</p>
					</div>

					<div className="flex items-center justify-between border-t border-border pt-1">
						{dataTexto && <p className="text-xs text-muted-foreground">Analisado em {dataTexto}</p>}
						<Button variant="outline" size="sm" onClick={chamarAnalise} className="ml-auto h-7 text-xs">
							Re-analisar
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
