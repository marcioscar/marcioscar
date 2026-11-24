import type { Route } from "./+types/corridas.relogio.$healthId";
import * as React from "react";
import { Link } from "react-router";
import { getMapboxToken } from "~/lib/mapbox.server";
import { buscarTreinoSaudePorId, paraCorridaRelogio, planejadoDoDia } from "~/models/treino-saude.server";
import { compararKmComPlano, compararPlanoExecutado, resumirComparacao, textoPrescrito } from "~/lib/treino-manual";
import { ComparacaoPace } from "~/components/corridas/comparacao-pace";
import { GraficosCorrida } from "~/components/corridas/graficos-corrida";
import { TempoPorZona } from "~/components/corridas/tempo-por-zona";
import { obterFcMaximaReferencia } from "~/models/corrida-dashboard.server";
import { Button } from "~/components/ui/button";
import { CorridaMetricasRelogio } from "~/components/corridas/corrida-metricas-relogio";
import { AnaliseIaRelogio } from "~/components/corridas/analise-ia-relogio";
import type { AnaliseResult } from "~/types/analise";
import type { RotaDetalhada } from "~/types/rota";
import { formatarPace, formatarTempo } from "~/lib/formatar-corrida";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

// mapbox-gl só roda no navegador: carrega sob demanda, depois da hidratação
const CorridaRotaMap = React.lazy(async () => {
	const mod = await import("~/components/corridas/corrida-rota-map");
	return { default: mod.CorridaRotaMap };
});

export function meta({ data }: Route.MetaArgs) {
	return [{ title: data ? `${data.corrida.nome} — Marcioscar` : "Corrida" }];
}

export async function loader({ params }: Route.LoaderArgs) {
	const t = await buscarTreinoSaudePorId(params.healthId);
	if (!t) throw new Response("Corrida não encontrada", { status: 404 });

	const fcMaximaReferencia = Math.max(await obterFcMaximaReferencia(), t.fcMaxima ?? 0);
	const plano = await planejadoDoDia(t.inicio);
	const corrida = paraCorridaRelogio(t, plano);
	// comparação planejado × executado: por etapa (treino estruturado) ou por km (corrida contínua)
	const voltasDoRelogio = corrida.laps.map((l) => ({ distanciaM: l.distance, tempoSeg: l.moving_time }));
	const splitsDoRelogio = corrida.splits.map((s) => ({ km: s.split, distanciaM: s.distance, tempoSeg: s.moving_time }));
	let comparacao: {
		base: "etapa" | "km";
		linhas: NonNullable<ReturnType<typeof compararPlanoExecutado>>;
		resumo: ReturnType<typeof resumirComparacao>;
	} | null = null;
	if (plano) {
		const porEtapa = voltasDoRelogio.length > 1 ? compararPlanoExecutado(plano, voltasDoRelogio) : null;
		const linhas = porEtapa ?? compararKmComPlano(plano, splitsDoRelogio);
		if (linhas) comparacao = { base: porEtapa ? "etapa" : "km", linhas, resumo: resumirComparacao(linhas) };
	}

	return {
		corrida,
		comparacao,
		saude: {
			fcMedia: t.fcMedia,
			fcMaxima: t.fcMaxima,
			caloriasKcal: t.caloriasKcal,
			cadenciaMedia: t.cadenciaMedia,
			potenciaMediaW: t.potenciaMediaW,
			passadaM: t.passadaM,
			oscilacaoVerticalCm: t.oscilacaoVerticalCm,
			contatoSoloMs: t.contatoSoloMs,
			elevacaoGanhoM: t.elevacaoGanhoM,
			splits: corrida.splits.map((s) => ({
				km: s.split,
				distanciaM: s.distance,
				tempoSeg: s.moving_time,
				fcMedia: s.average_heartrate ?? null,
			})),
			voltas: corrida.laps.length > 1
				? corrida.laps.map((l) => ({
						indice: l.lap_index + 1,
						tipo: "etapa",
						rotulo: l.name,
						distanciaM: l.distance,
						tempoSeg: l.moving_time,
						fcMedia: l.average_heartrate ?? null,
						potenciaW: l.potenciaW ?? null,
						cadencia: l.cadencia ?? null,
						oscilacaoCm: l.oscilacaoCm ?? null,
						contatoMs: l.contatoMs ?? null,
					}))
				: null,
		},
		analise: (t.analise as AnaliseResult | null) ?? null,
		analisadaEm: t.analisadaEm ? t.analisadaEm.toISOString() : null,
		healthId: t.healthId,
		fcMaximaReferencia,
		detalhe: t.polyline
			? ({ polyline: t.polyline, ...((t.rota as Record<string, number[]> | null) ?? {}) } as RotaDetalhada)
			: null,
		planejado: plano ? { titulo: plano.titulo, texto: textoPrescrito(plano) } : null,
		mapboxToken: getMapboxToken(),
	};
}

export default function CorridaRelogioDetalhe({ loaderData }: Route.ComponentProps) {
	const { corrida, saude, mapboxToken, analise, analisadaEm, healthId, planejado, detalhe, comparacao, fcMaximaReferencia } = loaderData;
	const [montado, setMontado] = React.useState(false);
	React.useEffect(() => setMontado(true), []);

	const pace =
		corrida.distanciaMetros > 0 ? corrida.tempoMovimentoSeg / (corrida.distanciaMetros / 1000) : null;
	const tiles = [
		{ label: "Distância", val: `${(corrida.distanciaMetros / 1000).toFixed(2)} km` },
		{ label: "Tempo", val: formatarTempo(corrida.tempoMovimentoSeg) },
		{ label: "Pace médio", val: formatarPace(pace) },
		{ label: "Elevação", val: `${corrida.elevacaoGanhoMetros.toFixed(0)} m↑` },
	];
	const placeholder =
		"flex h-[280px] items-center justify-center rounded-md border text-sm text-muted-foreground sm:h-[360px] lg:h-[420px]";

	return (
		<main className="grid w-full min-w-0 gap-6 pb-12">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" className="gap-1.5 -ml-2" render={<Link to="/corridas" />}>
					<HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
					Atividades
				</Button>
			</div>

			<div>
				<h1 className="text-xl font-semibold leading-tight">{corrida.nome}</h1>
				<p className="mt-0.5 text-sm text-muted-foreground">
					{new Date(corrida.dataInicio).toLocaleString("pt-BR")} · dados do Apple Watch
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{tiles.map(({ label, val }) => (
					<div key={label} className="rounded-xl border border-border bg-muted/30 px-3 py-2">
						<p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
						<p className="mt-0.5 text-sm font-semibold">{val}</p>
					</div>
				))}
			</div>

			{planejado && (
				<div className="rounded-2xl border border-paleta-6/20 bg-paleta-6/5 px-4 py-3">
					<p className="mb-1 text-xs font-medium tracking-wide text-paleta-6 uppercase">Treino planejado · {planejado.titulo}</p>
					<pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{planejado.texto}</pre>
				</div>
			)}

			{comparacao && planejado && (
				<ComparacaoPace
					titulo={planejado.titulo}
					linhas={comparacao.linhas}
					resumo={comparacao.resumo}
					base={comparacao.base}
				/>
			)}

			<CorridaMetricasRelogio metricas={saude} detalhe={detalhe} distanciaMetros={corrida.distanciaMetros} />

			{corrida.summaryPolyline && (
				<div className="min-w-0">
					{montado ? (
						<React.Suspense fallback={<div className={placeholder}>Carregando mapa...</div>}>
							<CorridaRotaMap
								mapboxToken={mapboxToken}
								polyline={corrida.summaryPolyline}
								distanciaMetros={corrida.distanciaMetros}
								splits={corrida.splits}
								detalhe={detalhe}
							/>
						</React.Suspense>
					) : (
						<div className={placeholder}>Carregando mapa...</div>
					)}
				</div>
			)}

			{detalhe && (
				<TempoPorZona detalhe={detalhe} tempoTotalSeg={corrida.tempoMovimentoSeg} fcMaxima={fcMaximaReferencia} />
			)}

			{detalhe && <GraficosCorrida detalhe={detalhe} distanciaMetros={corrida.distanciaMetros} />}

			<div className="border-t border-border" />

			<AnaliseIaRelogio healthId={healthId} analiseInicial={analise} analisadaEmInicial={analisadaEm} />
		</main>
	);
}
