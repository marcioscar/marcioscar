import type { Route } from "./+types/corridas.$stravaId";
import * as React from "react";
import { Link } from "react-router";
import { buscarCorridaPorStravaId } from "~/models/corridas.server";
import { obterProvaAtiva } from "~/models/provas.server";
import { Button } from "~/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type {
	AnaliseResult,
	SplitMetric,
	LapData,
	AnaliseInput,
	AnalyzeApiResponse,
	BuscarDetalhesResponse,
} from "~/types/analise";

export function meta({ data }: Route.MetaArgs) {
	return [{ title: data ? `${data.corrida.nome} — Marcioscar` : "Corrida" }];
}

export async function loader({ params }: Route.LoaderArgs) {
	const stravaId = Number(params.stravaId);
	if (!Number.isFinite(stravaId)) {
		throw new Response("Corrida inválida", { status: 400 });
	}

	const [corrida, provaAtiva] = await Promise.all([
		buscarCorridaPorStravaId(stravaId),
		obterProvaAtiva(),
	]);

	if (!corrida) {
		throw new Response("Corrida não encontrada", { status: 404 });
	}

	const distanciaKm = corrida.distanciaMetros / 1000;
	const paceMedioSegPorKm =
		distanciaKm > 0 ? Math.round(corrida.tempoMovimentoSeg / distanciaKm) : null;

	return {
		corrida: {
			stravaId: corrida.stravaId,
			nome: corrida.nome,
			distanciaMetros: corrida.distanciaMetros,
			elevacaoGanhoMetros: corrida.elevacaoGanhoMetros,
			tempoMovimentoSeg: corrida.tempoMovimentoSeg,
			paceMedioSegPorKm,
			dataInicio: new Date(corrida.dataInicio).toISOString(),
			splits: (corrida.splits as SplitMetric[] | null) ?? null,
			laps: (corrida.laps as LapData[] | null) ?? null,
			analise: (corrida.analise as AnaliseResult | null) ?? null,
			analisadaEm: corrida.analisadaEm ? corrida.analisadaEm.toISOString() : null,
		},
		provaAtivaInfo: provaAtiva
			? {
					plano: provaAtiva.plano,
					paceAlvo: provaAtiva.paceAlvo,
					kmSemanais: provaAtiva.kmSemanais,
					dataProva: new Date(provaAtiva.dataProva).toLocaleDateString("pt-BR"),
				}
			: null,
	};
}

const AVALIACAO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
	excelente: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", label: "Excelente" },
	bom: { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", label: "Bom" },
	regular: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", label: "Regular" },
	ruim: { bg: "bg-red-500/10", text: "text-red-700 dark:text-red-400", label: "Ruim" },
};

function formatarDistancia(m: number) {
	return `${(m / 1000).toFixed(2)} km`;
}
function formatarTempo(seg: number) {
	const h = Math.floor(seg / 3600);
	const m = Math.floor((seg % 3600) / 60);
	const s = seg % 60;
	return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}min${String(s).padStart(2, "0")}s`;
}
function formatarPace(segPorKm: number | null) {
	if (!segPorKm || segPorKm <= 0) return "—";
	return `${Math.floor(segPorKm / 60)}:${String(Math.round(segPorKm % 60)).padStart(2, "0")} /km`;
}
function mpsParaPace(mps: number) {
	if (!mps || mps < 1.0) return "—";
	const spk = 1000 / mps;
	return `${Math.floor(spk / 60)}:${String(Math.round(spk % 60)).padStart(2, "0")}`;
}
function categoria(m: number) {
	const km = m / 1000;
	if (km > 40) return "Maratona";
	if (km >= 20 && km <= 23) return "Meia Maratona";
	if (km >= 10 && km < 20) return "10–20 km";
	if (km < 10) return "Curta";
	return null;
}

export default function CorridaDetalhe({ loaderData }: Route.ComponentProps) {
	const { corrida, provaAtivaInfo } = loaderData;

	const [analise, setAnalise] = React.useState<AnaliseResult | null>(corrida.analise);
	const [splits, setSplits] = React.useState<SplitMetric[] | null>(corrida.splits);
	const [laps, setLaps] = React.useState<LapData[] | null>(corrida.laps);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [treinusPlano, setTreinusPlano] = React.useState("");

	const style = analise ? (AVALIACAO_STYLE[analise.avaliacao] ?? AVALIACAO_STYLE.regular) : null;
	const analisadaEm = corrida.analisadaEm
		? new Date(corrida.analisadaEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
		: null;
	const cat = categoria(corrida.distanciaMetros);
	const hasData = splits || laps;

	const lapDistances = laps?.map((l) => l.distance) ?? [];
	const lapDistMin = lapDistances.length ? Math.min(...lapDistances) : 0;
	const lapDistMax = lapDistances.length ? Math.max(...lapDistances) : 0;
	const isIntervals = lapDistMax - lapDistMin > 200;

	async function chamarAnalise() {
		setError(null);
		setLoading(true);

		const paceSegPorKm = corrida.paceMedioSegPorKm ?? corrida.tempoMovimentoSeg / (corrida.distanciaMetros / 1000);

		const input: AnaliseInput = {
			stravaId: corrida.stravaId,
			corrida: {
				nome: corrida.nome,
				distanciaKm: corrida.distanciaMetros / 1000,
				paceSegPorKm,
				tempoSeg: corrida.tempoMovimentoSeg,
				elevacaoMetros: corrida.elevacaoGanhoMetros,
				dataInicio: new Date(corrida.dataInicio).toLocaleDateString("pt-BR"),
			},
			provaAlvo: provaAtivaInfo ?? null,
			treinusPlano: treinusPlano || null,
		};

		try {
			const res = await fetch("/api/analisar-corrida", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) throw new Error("Falha na análise");
			const result = (await res.json()) as AnalyzeApiResponse;
			setAnalise(result.analise);
			setSplits(result.splits);
			setLaps(result.laps);
		} catch {
			setError("Não foi possível analisar. Verifique se ANTHROPIC_API_KEY está configurado.");
		} finally {
			setLoading(false);
		}
	}

	async function handleBuscarSplits() {
		setError(null);
		setLoading(true);
		try {
			const res = await fetch("/api/buscar-splits", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stravaId: corrida.stravaId }),
			});
			if (!res.ok) throw new Error("Falha ao buscar splits");
			const data = (await res.json()) as BuscarDetalhesResponse;
			setSplits(data.splits);
			setLaps(data.laps);
		} catch {
			setError("Não foi possível buscar os splits do Strava.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="grid w-full min-w-0 gap-6 pb-12">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" className="gap-1.5 -ml-2" render={<Link to="/corridas" />}>
					<HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
					Corridas
				</Button>
			</div>

			<div>
				<h1 className="text-xl font-semibold leading-tight">{corrida.nome}</h1>
				<p className="text-sm text-muted-foreground mt-0.5">
					{new Date(corrida.dataInicio).toLocaleString("pt-BR")}
				</p>
			</div>

			{/* MÉTRICAS */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				{[
					{ label: "Distância", val: formatarDistancia(corrida.distanciaMetros) },
					{ label: "Tempo", val: formatarTempo(corrida.tempoMovimentoSeg) },
					{ label: "Pace médio", val: formatarPace(corrida.paceMedioSegPorKm) },
					{ label: "Elevação", val: `${corrida.elevacaoGanhoMetros.toFixed(0)} m↑` },
					...(cat ? [{ label: "Categoria", val: cat }] : []),
				].map(({ label, val }) => (
					<div key={label} className="rounded-xl border border-border bg-muted/30 px-3 py-2">
						<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
						<p className="text-sm font-semibold mt-0.5">{val}</p>
					</div>
				))}
			</div>

			{/* BUSCAR DO STRAVA */}
			{!hasData && !loading && (
				<div className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3">
					<p className="text-sm text-muted-foreground">Splits e voltas não carregados</p>
					<Button variant="outline" size="sm" className="text-xs h-7" onClick={handleBuscarSplits}>
						Buscar do Strava
					</Button>
				</div>
			)}

			{/* VOLTAS (LAPS) */}
			{laps && laps.length > 1 && (() => {
				const anotacoes = analise?.lapsAnotados;
				const temAnotacao = anotacoes && anotacoes.length > 0;
				const TIPO_STYLE: Record<string, { row: string; label: string }> = {
					estimulo: { row: "font-semibold", label: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
					aquecimento: { row: "text-muted-foreground", label: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
					desaquecimento: { row: "text-muted-foreground", label: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
					recuperacao: { row: "text-muted-foreground", label: "bg-muted/60 text-muted-foreground" },
					principal: { row: "font-semibold", label: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
				};
				return (
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Voltas registradas</p>
							{(temAnotacao || isIntervals) && (
								<span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-400">
									{temAnotacao ? "Anotado pelo plano" : "Tiros / Intervalos"}
								</span>
							)}
						</div>
						<div className="overflow-x-auto rounded-xl border border-border">
							<table className="w-full text-xs">
								<thead>
									<tr className="border-b border-border bg-muted/30">
										{temAnotacao && <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tipo</th>}
										<th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
										<th className="text-left px-3 py-2 font-medium text-muted-foreground">Dist.</th>
										<th className="text-left px-3 py-2 font-medium text-muted-foreground">Pace</th>
										{temAnotacao && <th className="text-left px-3 py-2 font-medium text-muted-foreground">Meta</th>}
										<th className="text-left px-3 py-2 font-medium text-muted-foreground">Tempo</th>
										<th className="text-left px-3 py-2 font-medium text-muted-foreground">FC</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{laps.map((lap, i) => {
										const anot = anotacoes?.find((a) => a.lap_index === (lap.lap_index ?? i));
										const tipoStyle = anot ? (TIPO_STYLE[anot.tipo] ?? TIPO_STYLE.recuperacao) : null;
										const isWork = !temAnotacao && isIntervals && lap.distance >= (lapDistMin + lapDistMax) / 2;
										const rowCls = tipoStyle?.row ?? (isWork ? "font-semibold" : "text-muted-foreground");
										const paceStr = mpsParaPace(lap.average_speed);
										const dist = lap.distance >= 950 ? `${(lap.distance / 1000).toFixed(2)} km` : `${Math.round(lap.distance)} m`;
										const mins = Math.floor(lap.moving_time / 60);
										const secs = lap.moving_time % 60;
										const tempo = `${mins}:${String(secs).padStart(2, "0")}`;

										const metaPaceStr = anot?.meta ?? null;
										const diffEl = (() => {
											if (!metaPaceStr || lap.average_speed < 1.0) return null;
											const parts = metaPaceStr.replace("/km", "").trim().split(":").map(Number);
											if (parts.length < 2 || parts.some(isNaN)) return null;
											const metaSeg = parts[0] * 60 + parts[1];
											const realSeg = 1000 / lap.average_speed;
											const diff = Math.round(realSeg - metaSeg);
											if (Math.abs(diff) < 3) return <span className="text-emerald-600 dark:text-emerald-400">✓</span>;
											return diff > 0 ? (
												<span className="text-amber-600 dark:text-amber-400">+{diff}s</span>
											) : (
												<span className="text-emerald-600 dark:text-emerald-400">{diff}s</span>
											);
										})();

										return (
											<tr key={lap.lap_index ?? i} className={`hover:bg-muted/20 transition-colors ${rowCls}`}>
												{temAnotacao && (
													<td className="px-3 py-1.5">
														{anot && (
															<span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tipoStyle?.label}`}>
																{anot.label}
															</span>
														)}
													</td>
												)}
												<td className="px-3 py-1.5">{i + 1}</td>
												<td className="px-3 py-1.5">{dist}</td>
												<td className="px-3 py-1.5 font-mono tabular-nums">{paceStr}</td>
												{temAnotacao && (
													<td className="px-3 py-1.5 font-mono tabular-nums text-muted-foreground">
														{metaPaceStr ? (
															<span className="flex items-center gap-1">
																{metaPaceStr} {diffEl}
															</span>
														) : (
															"—"
														)}
													</td>
												)}
												<td className="px-3 py-1.5 tabular-nums">{tempo}</td>
												<td className="px-3 py-1.5">{lap.average_heartrate ? Math.round(lap.average_heartrate) : "—"}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						{!temAnotacao && isIntervals && (
							<p className="text-[10px] text-muted-foreground">Negrito = estímulos · esmaecido = recuperações</p>
						)}
						{temAnotacao && (
							<p className="text-[10px] text-muted-foreground">Meta = pace alvo do plano · diff vs pace realizado</p>
						)}
					</div>
				);
			})()}

			{/* SPLITS POR KM */}
			{splits && splits.length > 0 && (
				<div className="flex flex-col gap-2">
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Splits por km</p>
					<div className="overflow-x-auto rounded-xl border border-border">
						<table className="w-full text-xs">
							<thead>
								<tr className="border-b border-border bg-muted/30">
									<th className="text-left px-3 py-2 font-medium text-muted-foreground">Km</th>
									<th className="text-left px-3 py-2 font-medium text-muted-foreground">Pace</th>
									<th className="text-left px-3 py-2 font-medium text-muted-foreground">FC</th>
									<th className="text-left px-3 py-2 font-medium text-muted-foreground">Elev.</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{splits.map((s) => {
									const paceStr = mpsParaPace(s.average_speed);
									const elevStr = s.elevation_difference >= 0 ? `+${s.elevation_difference.toFixed(0)}m` : `${s.elevation_difference.toFixed(0)}m`;
									const elevColor =
										s.elevation_difference > 10
											? "text-orange-600 dark:text-orange-400"
											: s.elevation_difference < -10
												? "text-emerald-600 dark:text-emerald-400"
												: "text-muted-foreground";
									return (
										<tr key={s.split} className="hover:bg-muted/20 transition-colors">
											<td className="px-3 py-1.5 font-medium">{s.split}</td>
											<td className="px-3 py-1.5 font-mono tabular-nums">{paceStr}</td>
											<td className="px-3 py-1.5 text-muted-foreground">{s.average_heartrate ? Math.round(s.average_heartrate) : "—"}</td>
											<td className={`px-3 py-1.5 ${elevColor}`}>{elevStr}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{hasData && <div className="border-t border-border" />}

			{/* ANÁLISE CANOVA */}
			<div className="flex flex-col gap-4 max-w-xl">
				<div className="flex items-center justify-between">
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Análise Canova</p>
					{!analise && !loading && (
						<Button size="sm" onClick={chamarAnalise} className="text-xs h-7">
							✦ Analisar com IA
						</Button>
					)}
				</div>

				<div className="flex flex-col gap-1.5">
					<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Treino planejado (Treinus)</p>
					<textarea
						value={treinusPlano}
						onChange={(e) => setTreinusPlano(e.target.value)}
						placeholder="Cole aqui o treino prescrito, ex: 6x800m a 4:15/km · rec 90s"
						rows={2}
						className="w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
					/>
				</div>

				{loading && (
					<div className="flex items-center gap-3 py-8 text-muted-foreground">
						<div className="size-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin shrink-0" />
						<p className="text-sm">Buscando dados e analisando com Claude...</p>
					</div>
				)}

				{error && !loading && (
					<div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
						{error}
					</div>
				)}

				{!analise && !loading && !error && (
					<p className="text-sm text-muted-foreground leading-relaxed">
						Clique em "Analisar com IA" para obter uma análise do treino baseada na metodologia Canova.
					</p>
				)}

				{analise && !loading && style && (
					<div className="flex flex-col gap-4">
						<div className="flex items-start justify-between gap-3">
							<div className="flex flex-col gap-0.5">
								<span className="text-[10px] text-muted-foreground uppercase tracking-wide">Tipo de sessão</span>
								<span className="text-base font-semibold">{analise.tipoSessao}</span>
							</div>
							<div className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${style.bg} ${style.text}`}>{style.label}</div>
						</div>

						<div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed">{analise.resumo}</div>

						{analise.pontosPositivos.length > 0 && (
							<ul className="flex flex-col gap-2">
								{analise.pontosPositivos.map((p, i) => (
									<li key={i} className="flex gap-2 text-sm text-emerald-700 dark:text-emerald-400">
										<span className="mt-0.5 shrink-0">✓</span>
										<span>{p}</span>
									</li>
								))}
							</ul>
						)}

						{analise.pontosAtencao.length > 0 && (
							<ul className="flex flex-col gap-2">
								{analise.pontosAtencao.map((p, i) => (
									<li key={i} className="flex gap-2 text-sm text-amber-700 dark:text-amber-400">
										<span className="mt-0.5 shrink-0">⚠</span>
										<span>{p}</span>
									</li>
								))}
							</ul>
						)}

						<div className="flex flex-col gap-1">
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Metodologia Canova</p>
							<p className="text-sm leading-relaxed">{analise.alinhamentoCanova}</p>
						</div>

						{analise.comparacaoTreinus && (
							<div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
								<p className="text-xs font-medium text-violet-700 dark:text-violet-400 uppercase tracking-wide mb-1">Planejado vs Executado</p>
								<p className="text-sm leading-relaxed">{analise.comparacaoTreinus}</p>
							</div>
						)}

						<div className="rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3">
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Próximo treino</p>
							<p className="text-sm leading-relaxed">{analise.recomendacao}</p>
						</div>

						<div className="flex items-center justify-between pt-1 border-t border-border">
							{analisadaEm && <p className="text-xs text-muted-foreground">Analisado em {analisadaEm}</p>}
							<Button variant="outline" size="sm" onClick={chamarAnalise} className="ml-auto text-xs h-7">
								Re-analisar
							</Button>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
