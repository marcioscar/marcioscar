import { geoNaturalEarth1, geoPath } from "d3-geo";
import { merge, mesh } from "topojson-client";
import type {
	GeometryCollection,
	MultiPolygon,
	Polygon,
	Topology,
} from "topojson-specification";
import mundo from "world-atlas/countries-110m.json";

import { CORES_RITMO, corDoRitmo } from "~/lib/rota";
import {
	LOCAIS_MARATONAS,
	ROTULO_PADRAO,
	type LocalMaratona,
} from "~/lib/maratonas-locais";

export type MaratonaNoMapa = {
	stravaId: number;
	nome: string;
	dataInicioIso: string;
	tempoTotalSeg: number;
	paceMedioSegPorKm: number | null;
	localLat: number | null;
	localLng: number | null;
};

const LARGURA = 1000;
const ANTARTIDA = "010";
const RAIO_PONTO = 5;

// ---- geometria do mundo: calculada uma vez por processo ----
const topologia = mundo as unknown as Topology;
const paises = topologia.objects.countries as GeometryCollection;
const geometriasPaises = paises.geometries as (Polygon | MultiPolygon)[];
// recorte sem a Antártida; o ponto no equador garante a largura máxima do mapa
const recorte = {
	type: "MultiPoint" as const,
	coordinates: [
		[-180, 0],
		[180, 0],
		[0, 84],
		[0, -57],
	],
};
const projecao = geoNaturalEarth1().fitWidth(LARGURA, recorte);
const gerarCaminho = geoPath(projecao).digits(1);
const ALTURA = Math.ceil(gerarCaminho.bounds(recorte)[1][1]);

const caminhoTerra = gerarCaminho(
	merge(
		topologia,
		geometriasPaises.filter((g) => g.id !== ANTARTIDA),
	),
) ?? "";
const caminhoFronteiras =
	gerarCaminho(mesh(topologia, paises, (a, b) => a !== b)) ?? "";

function caminhoDosPaises(ids: Set<string>): string {
	const geometrias = geometriasPaises.filter((g) => ids.has(String(g.id)));
	return geometrias.length > 0
		? (gerarCaminho(merge(topologia, geometrias)) ?? "")
		: "";
}

// ---- formatação ----
function formatarTempo(seg: number): string {
	const h = Math.floor(seg / 3600);
	const m = Math.floor((seg % 3600) / 60);
	const s = seg % 60;
	return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatarPace(segPorKm: number | null): string {
	if (!segPorKm || segPorKm <= 0) return "—";
	return `${Math.floor(segPorKm / 60)}:${String(Math.round(segPorKm % 60)).padStart(2, "0")}/km`;
}

function formatarData(iso: string): string {
	return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// ---- cada maratona com seu lugar (tabela primeiro, coordenadas do Strava depois) ----
type PontoMapa = {
	maratona: MaratonaNoMapa;
	local: Pick<LocalMaratona, "cidade" | "lat" | "lng" | "rotulo">;
	paisId: string | null;
	x: number;
	y: number;
};

function nomeCurto(nome: string): string {
	return nome
		.replace(/^maratona (de |do |da )?/i, "")
		.replace(/ marathon$/i, "")
		.trim();
}

function montarPontos(maratonas: MaratonaNoMapa[]): {
	pontos: PontoMapa[];
	semLocal: MaratonaNoMapa[];
} {
	const pontos: PontoMapa[] = [];
	const semLocal: MaratonaNoMapa[] = [];

	for (const maratona of maratonas) {
		const cadastrado = LOCAIS_MARATONAS[maratona.stravaId];
		const local = cadastrado
			? cadastrado
			: maratona.localLat !== null && maratona.localLng !== null
				? {
						cidade: nomeCurto(maratona.nome),
						lat: maratona.localLat,
						lng: maratona.localLng,
						rotulo: undefined,
					}
				: null;
		const projetado = local ? projecao([local.lng, local.lat]) : null;
		if (!local || !projetado) {
			semLocal.push(maratona);
			continue;
		}
		pontos.push({
			maratona,
			local,
			paisId: cadastrado?.paisId ?? null,
			x: projetado[0],
			y: projetado[1],
		});
	}

	return { pontos, semLocal };
}

type Props = {
	maratonas: MaratonaNoMapa[];
};

export function MapaMundiMaratonas({ maratonas }: Props) {
	const { pontos, semLocal } = montarPontos(maratonas);
	if (pontos.length === 0) {
		return (
			<p className='rounded-md border p-3 text-sm text-muted-foreground'>
				Nenhuma maratona com local cadastrado para mostrar no mapa.
			</p>
		);
	}

	const tempos = pontos.map((p) => p.maratona.tempoTotalSeg);
	const melhorTempo = Math.min(...tempos);
	const piorTempo = Math.max(...tempos);
	const amplitude = piorTempo - melhorTempo;
	const idsVisitados = new Set(
		pontos.map((p) => p.paisId).filter((id): id is string => id !== null),
	);
	const caminhoVisitados = caminhoDosPaises(idsVisitados);

	return (
		<div className='flex min-w-0 flex-col gap-2'>
			<div className='overflow-x-auto rounded-xl border border-border bg-card'>
				<svg
					viewBox={`0 0 ${LARGURA} ${ALTURA}`}
					role='img'
					aria-label={`Mapa-múndi com ${pontos.length} maratonas em ${idsVisitados.size} países`}
					className='block h-auto w-full min-w-[760px]'>
					<path d={caminhoTerra} style={{ fill: "var(--muted)" }} />
					<path
						d={caminhoVisitados}
						style={{
							fill: "color-mix(in oklab, var(--paleta-1) 32%, var(--card))",
						}}
					/>
					<path
						d={caminhoFronteiras}
						style={{ fill: "none", stroke: "var(--card)", strokeWidth: 0.5 }}
					/>

					{/* linhas até os rótulos deslocados */}
					{pontos.map((p) => {
						const r = p.local.rotulo ?? ROTULO_PADRAO;
						if (Math.abs(r.dx) < 20 && Math.abs(r.dy) < 14) return null;
						return (
							<line
								key={`linha-${p.maratona.stravaId}`}
								x1={p.x}
								y1={p.y}
								x2={p.x + r.dx - (r.ancora === "end" ? -3 : r.ancora === "start" ? 3 : 0)}
								y2={p.y + r.dy - 4}
								style={{ stroke: "var(--muted-foreground)", strokeWidth: 0.7 }}
							/>
						);
					})}

					{pontos.map((p) => {
						const t = amplitude > 0 ? (p.maratona.tempoTotalSeg - melhorTempo) / amplitude : 0;
						const melhor = p.maratona.tempoTotalSeg === melhorTempo;
						return (
							<g key={p.maratona.stravaId}>
								<title>
									{`${p.maratona.nome} · ${formatarData(p.maratona.dataInicioIso)} · ${formatarTempo(p.maratona.tempoTotalSeg)} · ${formatarPace(p.maratona.paceMedioSegPorKm)}`}
								</title>
								{melhor && (
									<circle
										cx={p.x}
										cy={p.y}
										r={RAIO_PONTO + 4}
										style={{ fill: "none", stroke: "var(--foreground)", strokeWidth: 1.2 }}
									/>
								)}
								<circle
									cx={p.x}
									cy={p.y}
									r={RAIO_PONTO}
									style={{ fill: corDoRitmo(t), stroke: "var(--card)", strokeWidth: 1.5 }}
								/>
							</g>
						);
					})}

					{pontos.map((p) => {
						const r = p.local.rotulo ?? ROTULO_PADRAO;
						return (
							<text
								key={`rotulo-${p.maratona.stravaId}`}
								x={p.x + r.dx}
								y={p.y + r.dy}
								textAnchor={r.ancora}
								style={{
									fontSize: 11,
									fill: "var(--foreground)",
									paintOrder: "stroke",
									stroke: "var(--muted)",
									strokeWidth: 3,
									strokeLinejoin: "round",
								}}>
								{p.local.cidade}
								<tspan
									dx={5}
									style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
									{formatarTempo(p.maratona.tempoTotalSeg)}
								</tspan>
							</text>
						);
					})}
				</svg>
			</div>

			<div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
				<span className='flex items-center gap-1.5 tabular-nums'>
					Mais rápido · {formatarTempo(melhorTempo)}
					<span
						aria-hidden
						className='h-1.5 w-24 rounded-full'
						style={{ background: `linear-gradient(to right, ${CORES_RITMO.join(", ")})` }}
					/>
					Mais lento · {formatarTempo(piorTempo)}
				</span>
				<span className='flex items-center gap-1.5'>
					<span
						aria-hidden
						className='size-2.5 rounded-[2px]'
						style={{
							background: "color-mix(in oklab, var(--paleta-1) 32%, var(--card))",
						}}
					/>
					País com maratona
				</span>
				<span className='flex items-center gap-1.5'>
					<span
						aria-hidden
						className='size-3 rounded-full border'
						style={{ borderColor: "var(--foreground)" }}
					/>
					Melhor tempo
				</span>
			</div>

			{semLocal.length > 0 && (
				<p className='text-xs text-muted-foreground'>
					Sem local cadastrado: {semLocal.map((m) => m.nome).join(", ")}.
				</p>
			)}
		</div>
	);
}
