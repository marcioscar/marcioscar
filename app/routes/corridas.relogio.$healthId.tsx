import type { Route } from "./+types/corridas.relogio.$healthId";
import * as React from "react";
import { Link } from "react-router";
import { getMapboxToken } from "~/lib/mapbox.server";
import { buscarTreinoSaudePorId, paraCorridaRelogio } from "~/models/treino-saude.server";
import { Button } from "~/components/ui/button";
import { CorridaMetricasRelogio } from "~/components/corridas/corrida-metricas-relogio";
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

	const corrida = paraCorridaRelogio(t);
	return {
		corrida,
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
					}))
				: null,
		},
		mapboxToken: getMapboxToken(),
	};
}

export default function CorridaRelogioDetalhe({ loaderData }: Route.ComponentProps) {
	const { corrida, saude, mapboxToken } = loaderData;
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

			<CorridaMetricasRelogio metricas={saude} />

			{corrida.summaryPolyline && (
				<div className="min-w-0">
					{montado ? (
						<React.Suspense fallback={<div className={placeholder}>Carregando mapa...</div>}>
							<CorridaRotaMap
								mapboxToken={mapboxToken}
								polyline={corrida.summaryPolyline}
								distanciaMetros={corrida.distanciaMetros}
								splits={corrida.splits}
							/>
						</React.Suspense>
					) : (
						<div className={placeholder}>Carregando mapa...</div>
					)}
				</div>
			)}
		</main>
	);
}
