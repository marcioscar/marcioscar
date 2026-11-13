import { useMemo } from "react";
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
import { formatarData, formatarPace, formatarTempo } from "~/lib/formatar-corrida";
import {
	LOCAIS_MARATONAS,
	ROTULO_PADRAO,
	type LocalMaratona,
} from "~/lib/maratonas-locais";
import type { MaratonaDetalhada } from "~/types/maratonas";

export type MaratonaNoMapa = Pick<
	MaratonaDetalhada,
	| "stravaId"
	| "nome"
	| "dataInicioIso"
	| "distanciaMetros"
	| "tempoTotalSeg"
	| "paceMedioSegPorKm"
	| "localLat"
	| "localLng"
>;

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

const caminhoTerra =
	gerarCaminho(
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

const COR_PAIS = "color-mix(in oklab, var(--paleta-1) 32%, var(--card))";

// ---- cada maratona com seu lugar (tabela primeiro, coordenadas do Strava depois) ----
export type PontoMapa = {
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

export function montarPontos(maratonas: MaratonaNoMapa[]): {
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

/** Pontos em ordem cronológica: a sequência da "viagem no tempo" */
export function ordenarParaViagem(pontos: PontoMapa[]): PontoMapa[] {
	return [...pontos].sort((a, b) =>
		a.maratona.dataInicioIso.localeCompare(b.maratona.dataInicioIso),
	);
}

type Props = {
	maratonas: MaratonaNoMapa[];
	selecionadaId?: number | null;
	onSelecionar?: (id: number) => void;
	/** Reprodução da viagem: aparece até este índice cronológico (−1 = nada). null = tudo */
	passoViagem?: number | null;
};

export function MapaMundiMaratonas({
	maratonas,
	selecionadaId = null,
	onSelecionar,
	passoViagem = null,
}: Props) {
	const { pontos, semLocal } = useMemo(() => montarPontos(maratonas), [maratonas]);
	const ordenados = useMemo(() => ordenarParaViagem(pontos), [pontos]);
	const arcos = useMemo(
		() =>
			ordenados.slice(1).map((destino, i) => {
				const origem = ordenados[i];
				return (
					gerarCaminho({
						type: "LineString",
						coordinates: [
							[origem.local.lng, origem.local.lat],
							[destino.local.lng, destino.local.lat],
						],
					}) ?? ""
				);
			}),
		[ordenados],
	);

	const emViagem = passoViagem !== null;
	const visiveis = emViagem
		? new Set(ordenados.slice(0, passoViagem + 1).map((p) => p.maratona.stravaId))
		: null;
	const pontosVisiveis = visiveis
		? pontos.filter((p) => visiveis.has(p.maratona.stravaId))
		: pontos;
	const ultimoDaViagem = emViagem ? (ordenados[passoViagem] ?? null) : null;

	const idsVisitados = new Set(
		pontosVisiveis.map((p) => p.paisId).filter((id): id is string => id !== null),
	);
	const chaveVisitados = [...idsVisitados].sort().join(",");
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const caminhoVisitados = useMemo(() => caminhoDosPaises(idsVisitados), [chaveVisitados]);

	if (pontos.length === 0) {
		return (
			<p className='rounded-md border p-3 text-sm text-muted-foreground'>
				Nenhuma maratona com local cadastrado para mostrar no mapa.
			</p>
		);
	}

	// a escala de cor usa todas as provas, para a cor não mudar durante a viagem
	const tempos = pontos.map((p) => p.maratona.tempoTotalSeg);
	const melhorTempo = Math.min(...tempos);
	const piorTempo = Math.max(...tempos);
	const amplitude = piorTempo - melhorTempo;
	const interativo = Boolean(onSelecionar);

	function selecionar(id: number) {
		onSelecionar?.(id);
	}

	return (
		<div className='flex min-w-0 flex-col gap-2'>
			<div className='overflow-x-auto rounded-xl border border-border bg-card'>
				<svg
					viewBox={`0 0 ${LARGURA} ${ALTURA}`}
					role='group'
					aria-label={`Mapa-múndi com ${pontos.length} maratonas em ${new Set(pontos.map((p) => p.paisId).filter(Boolean)).size} países`}
					className='block h-auto w-full min-w-[760px]'>
					<path d={caminhoTerra} style={{ fill: "var(--muted)" }} />
					<path d={caminhoVisitados} style={{ fill: COR_PAIS }} />
					<path
						d={caminhoFronteiras}
						style={{ fill: "none", stroke: "var(--card)", strokeWidth: 0.5 }}
					/>

					{/* arcos da viagem: uma maratona até a próxima */}
					{emViagem &&
						arcos.slice(0, Math.max(0, passoViagem)).map((d, i) => (
							<path
								key={`arco-${ordenados[i + 1].maratona.stravaId}`}
								d={d}
								pathLength={1}
								className='maratona-arco'
								style={{
									fill: "none",
									stroke: "var(--paleta-4)",
									strokeWidth: 1.3,
									strokeLinecap: "round",
									opacity: 0.75,
								}}
							/>
						))}

					{/* linhas até os rótulos deslocados */}
					{pontosVisiveis.map((p) => {
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

					{pontosVisiveis.map((p) => {
						const t = amplitude > 0 ? (p.maratona.tempoTotalSeg - melhorTempo) / amplitude : 0;
						const melhor = p.maratona.tempoTotalSeg === melhorTempo;
						const selecionada = p.maratona.stravaId === selecionadaId;
						const rotulo = `${p.local.cidade}, ${formatarTempo(p.maratona.tempoTotalSeg)}`;
						return (
							<g
								key={p.maratona.stravaId}
								className={`group ${emViagem ? "maratona-ponto-entra" : ""} ${interativo ? "cursor-pointer" : ""}`}
								{...(interativo
									? {
											role: "button",
											tabIndex: 0,
											"aria-label": `${rotulo}. Ver detalhes da prova`,
											"aria-pressed": selecionada,
											onClick: () => selecionar(p.maratona.stravaId),
											onKeyDown: (e: React.KeyboardEvent) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													selecionar(p.maratona.stravaId);
												}
											},
										}
									: {})}>
								<title>
									{`${p.maratona.nome} · ${formatarData(p.maratona.dataInicioIso)} · ${formatarTempo(p.maratona.tempoTotalSeg)} · ${formatarPace(p.maratona.paceMedioSegPorKm, "/km")}`}
								</title>
								{/* área de clique maior que o ponto */}
								<circle cx={p.x} cy={p.y} r={RAIO_PONTO + 8} style={{ fill: "transparent" }} />
								{p === ultimoDaViagem && (
									<circle
										cx={p.x}
										cy={p.y}
										r={RAIO_PONTO + 1}
										className='maratona-pulso'
										style={{ fill: "var(--paleta-4)" }}
									/>
								)}
								{selecionada && (
									<circle
										cx={p.x}
										cy={p.y}
										r={RAIO_PONTO + 8}
										style={{
											fill: "color-mix(in oklab, var(--foreground) 10%, transparent)",
											stroke: "var(--foreground)",
											strokeWidth: 1.3,
										}}
									/>
								)}
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
									className='origin-center transition-transform [transform-box:fill-box] group-hover:scale-125'
									style={{ fill: corDoRitmo(t), stroke: "var(--card)", strokeWidth: 1.5 }}
								/>
							</g>
						);
					})}

					{pontosVisiveis.map((p) => {
						const r = p.local.rotulo ?? ROTULO_PADRAO;
						const selecionada = p.maratona.stravaId === selecionadaId;
						return (
							<text
								key={`rotulo-${p.maratona.stravaId}`}
								x={p.x + r.dx}
								y={p.y + r.dy}
								textAnchor={r.ancora}
								onClick={interativo ? () => selecionar(p.maratona.stravaId) : undefined}
								className={emViagem ? "maratona-ponto-entra" : ""}
								style={{
									fontSize: 11,
									fill: "var(--foreground)",
									fontWeight: selecionada ? 700 : 400,
									cursor: interativo ? "pointer" : undefined,
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
						style={{ background: COR_PAIS }}
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
