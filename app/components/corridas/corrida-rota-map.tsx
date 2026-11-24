"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { decodePolyline } from "~/lib/polyline";
import { CORES_RITMO, montarRota, type SplitRota } from "~/lib/rota";
import { montarGradiente, type Gradiente, type ModoCor } from "~/lib/rota-gradiente";
import type { RotaDetalhada } from "~/types/rota";

type CorridaRotaMapProps = {
	mapboxToken: string | null;
	polyline: string;
	distanciaMetros: number;
	splits: SplitRota[] | null;
	/** rota em alta resolução (com ritmo e FC por ponto), quando existir */
	detalhe?: RotaDetalhada | null;
};

type EstiloMapa = "mapa" | "satelite" | "relevo";

const SOURCE_ID = "rota-source";
const ESTILOS: Record<EstiloMapa, string> = {
	mapa: "mapbox://styles/mapbox/outdoors-v12",
	satelite: "mapbox://styles/mapbox/satellite-streets-v12",
	// o relevo 3D usa a imagem de satélite com o terreno por cima
	relevo: "mapbox://styles/mapbox/satellite-streets-v12",
};
const ROTULO_ESTILO: Record<EstiloMapa, string> = { mapa: "Mapa", satelite: "Satélite", relevo: "Relevo 3D" };

function formatarPace(segPorKm: number): string {
	const min = Math.floor(segPorKm / 60);
	const seg = Math.round(segPorKm % 60);
	return `${min}:${String(seg).padStart(2, "0")}/km`;
}

function formatarTempoKm(segPorKm: number): string {
	const total = Math.round(segPorKm);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function criarMarcador(texto: string, classe: string): HTMLDivElement {
	const el = document.createElement("div");
	el.className = classe;
	el.textContent = texto;
	return el;
}

const CLASSE_KM =
	"flex size-5 items-center justify-center rounded-full border border-white bg-neutral-800 text-[10px] font-semibold leading-none text-white shadow";
const CLASSE_KM_TEMPO =
	"flex h-5 items-center justify-center rounded-full border border-white bg-neutral-800 px-1.5 text-[10px] font-semibold leading-none tabular-nums text-white shadow";
const CLASSE_PONTA =
	"flex h-5 items-center justify-center rounded-full border border-white px-1.5 text-[10px] font-semibold leading-none text-white shadow";

function aplicarModo(
	marcos: { el: HTMLDivElement; km: number; pace: number | null }[],
	comTempo: boolean,
) {
	for (const { el, km, pace } of marcos) {
		const mostra = comTempo && pace !== null;
		el.textContent = mostra ? formatarTempoKm(pace) : String(km);
		// o Mapbox põe classes próprias no elemento (posição/âncora): preservar
		const doMapbox = Array.from(el.classList).filter((c) => c.startsWith("mapboxgl-"));
		el.className = [mostra ? CLASSE_KM_TEMPO : CLASSE_KM, ...doMapbox].join(" ");
	}
}

function BotaoSegmento<T extends string>({
	valor,
	atual,
	rotulo,
	onEscolher,
}: {
	valor: T;
	atual: T;
	rotulo: string;
	onEscolher: (v: T) => void;
}) {
	const ativo = valor === atual;
	return (
		<button
			type="button"
			aria-pressed={ativo}
			onClick={() => onEscolher(valor)}
			className={
				"rounded px-2.5 py-1 text-xs font-medium transition-colors " +
				(ativo ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
			}>
			{rotulo}
		</button>
	);
}

export function CorridaRotaMap({
	mapboxToken,
	polyline,
	distanciaMetros,
	splits,
	detalhe = null,
}: CorridaRotaMapProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const marcosRef = useRef<{ el: HTMLDivElement; km: number; pace: number | null }[]>([]);
	const temTempos = splits !== null && splits.length > 0;
	// em provas longas os 42 rótulos se atropelam: começa desligado
	const [mostrarTempos, setMostrarTempos] = useState(temTempos && distanciaMetros <= 15_000);
	const [estilo, setEstilo] = useState<EstiloMapa>("mapa");
	const [cor, setCor] = useState<ModoCor>("km");

	const polylineUsada = detalhe?.polyline ?? polyline;
	const rota = useMemo(
		() => montarRota(polylineUsada, distanciaMetros, splits),
		[polylineUsada, distanciaMetros, splits],
	);
	const coordenadas = useMemo(() => decodePolyline(polylineUsada), [polylineUsada]);
	const gradientes = useMemo(() => {
		const r: Partial<Record<"ritmo" | "fc", Gradiente>> = {};
		if (detalhe) {
			const ritmo = montarGradiente("ritmo", coordenadas, detalhe);
			const fc = montarGradiente("fc", coordenadas, detalhe);
			if (ritmo) r.ritmo = ritmo;
			if (fc) r.fc = fc;
		}
		return r;
	}, [detalhe, coordenadas]);

	// estado lido pelos callbacks do mapa sem recriá-lo
	const estiloRef = useRef(estilo);
	const corRef = useRef(cor);
	const modoRef = useRef(mostrarTempos);
	const desenharRef = useRef<(map: mapboxgl.Map) => void>(() => {});
	const aplicarRelevoRef = useRef<(map: mapboxgl.Map) => void>(() => {});
	const estiloAplicadoRef = useRef<EstiloMapa>("mapa");
	estiloRef.current = estilo;
	corRef.current = cor;
	modoRef.current = mostrarTempos;

	// se o modo de cor escolhido deixar de existir (ex.: trocou de corrida), volta ao padrão
	useEffect(() => {
		if (cor !== "km" && !gradientes[cor]) setCor("km");
	}, [cor, gradientes]);

	function desenharRota(map: mapboxgl.Map) {
		if (!rota) return;
		for (const id of ["rota-linha", "rota-contorno"]) if (map.getLayer(id)) map.removeLayer(id);
		if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

		const modo = corRef.current;
		const gradiente = modo === "km" ? null : gradientes[modo];

		if (gradiente) {
			map.addSource(SOURCE_ID, {
				type: "geojson",
				lineMetrics: true, // necessário para line-gradient
				data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coordenadas } },
			});
		} else {
			map.addSource(SOURCE_ID, {
				type: "geojson",
				data: {
					type: "FeatureCollection",
					features: rota.trechos.map((trecho) => ({
						type: "Feature",
						properties: { cor: trecho.cor },
						geometry: { type: "LineString", coordinates: trecho.coordenadas },
					})),
				},
			});
		}
		// contorno branco para a rota destacar do mapa
		map.addLayer({
			id: "rota-contorno",
			type: "line",
			source: SOURCE_ID,
			layout: { "line-cap": "round", "line-join": "round" },
			paint: { "line-color": "#ffffff", "line-width": 9 },
		});
		map.addLayer({
			id: "rota-linha",
			type: "line",
			source: SOURCE_ID,
			layout: { "line-cap": "round", "line-join": "round" },
			paint: gradiente
				? {
						"line-width": 5.5,
						"line-gradient": ["interpolate", ["linear"], ["line-progress"], ...gradiente.stops] as mapboxgl.ExpressionSpecification,
					}
				: { "line-color": ["get", "cor"], "line-width": 5.5 },
		});
	}

	function aplicarRelevo(map: mapboxgl.Map) {
		if (estiloRef.current === "relevo") {
			if (!map.getSource("mapbox-dem")) {
				map.addSource("mapbox-dem", {
					type: "raster-dem",
					url: "mapbox://mapbox.mapbox-terrain-dem-v1",
					tileSize: 512,
					maxzoom: 14,
				});
			}
			map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
		} else {
			map.setTerrain(null);
		}
	}

	desenharRef.current = desenharRota;
	aplicarRelevoRef.current = aplicarRelevo;

	useEffect(() => {
		const container = containerRef.current;
		if (!mapboxToken || !container || !rota) {
			return;
		}

		mapboxgl.accessToken = mapboxToken;
		estiloAplicadoRef.current = estiloRef.current;
		const map = new mapboxgl.Map({
			container,
			style: ESTILOS[estiloRef.current],
			center: rota.largada,
			zoom: 13,
		});
		mapRef.current = map;
		map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

		const marcadores: mapboxgl.Marker[] = [];
		marcosRef.current = [];
		const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
		let primeiraVez = true;

		// 'style.load' dispara no começo e a cada troca de estilo: redesenha a rota por cima
		map.on("style.load", () => {
			desenharRef.current(map);
			aplicarRelevoRef.current(map);

			if (!primeiraVez) return;
			primeiraVez = false;

			for (const marco of rota.marcos) {
				const el = criarMarcador(String(marco.km), CLASSE_KM);
				const detalhes = [
					`Km ${marco.km}`,
					marco.paceSegPorKm ? formatarPace(marco.paceSegPorKm) : null,
					marco.frequencia ? `FC ${Math.round(marco.frequencia)}` : null,
				].filter(Boolean);
				el.addEventListener("mouseenter", () => {
					popup.setLngLat(marco.coordenada).setText(detalhes.join(" · ")).addTo(map);
				});
				el.addEventListener("mouseleave", () => popup.remove());
				marcosRef.current.push({ el, km: marco.km, pace: marco.paceSegPorKm });
				marcadores.push(new mapboxgl.Marker({ element: el }).setLngLat(marco.coordenada).addTo(map));
			}
			aplicarModo(marcosRef.current, modoRef.current);

			marcadores.push(
				new mapboxgl.Marker({
					element: criarMarcador("Largada", `${CLASSE_PONTA} bg-emerald-700`),
					anchor: "bottom",
				})
					.setLngLat(rota.largada)
					.addTo(map),
				new mapboxgl.Marker({
					element: criarMarcador("Chegada", `${CLASSE_PONTA} bg-neutral-900`),
					anchor: "top",
				})
					.setLngLat(rota.chegada)
					.addTo(map),
			);

			const bounds = new mapboxgl.LngLatBounds();
			for (const trecho of rota.trechos) {
				for (const coordenada of trecho.coordenadas) bounds.extend(coordenada);
			}
			map.fitBounds(bounds, { padding: 48, duration: 0 });
		});

		const resizeObserver = new ResizeObserver(() => map.resize());
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
			popup.remove();
			for (const marcador of marcadores) marcador.remove();
			map.remove();
			mapRef.current = null;
		};
		// desenharRota/aplicarRelevo leem refs; recriar o mapa só quando a rota ou o token mudam
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mapboxToken, rota]);

	// troca de estilo (mapa / satélite / relevo 3D)
	useEffect(() => {
		const map = mapRef.current;
		if (!map || estiloAplicadoRef.current === estilo) return;
		const mudaImagem = ESTILOS[estiloAplicadoRef.current] !== ESTILOS[estilo];
		estiloAplicadoRef.current = estilo;
		if (mudaImagem) {
			map.setStyle(ESTILOS[estilo]); // dispara style.load, que redesenha a rota e o relevo
		} else {
			aplicarRelevoRef.current(map);
		}
		map.easeTo({ pitch: estilo === "relevo" ? 62 : 0, bearing: estilo === "relevo" ? -25 : 0, duration: 900 });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [estilo]);

	// troca do modo de cor da rota
	useEffect(() => {
		const map = mapRef.current;
		if (map && map.isStyleLoaded()) desenharRef.current(map);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cor, gradientes]);

	useEffect(() => {
		aplicarModo(marcosRef.current, mostrarTempos);
	}, [mostrarTempos]);

	if (!mapboxToken) {
		return (
			<div className='rounded-md border p-3 text-sm text-muted-foreground'>
				Token do Mapbox não encontrado. Defina `MAPBOX_ACCESS_TOKEN` no `.env`.
			</div>
		);
	}

	if (!rota) {
		return null;
	}

	const modosDeCor: { valor: ModoCor; rotulo: string }[] = [
		{ valor: "km", rotulo: "Por km" },
		...(gradientes.ritmo ? [{ valor: "ritmo" as const, rotulo: "Ritmo" }] : []),
		...(gradientes.fc ? [{ valor: "fc" as const, rotulo: "FC" }] : []),
	];
	const gradienteAtual = cor === "km" ? null : (gradientes[cor] ?? null);

	return (
		<div className='flex flex-col gap-2'>
			<div
				ref={containerRef}
				className='h-[320px] w-full rounded-md border sm:h-[420px] lg:h-[520px]'
			/>

			<div className='flex flex-wrap items-center justify-between gap-2'>
				<div role='group' aria-label='Tipo de mapa' className='flex rounded-md border p-0.5'>
					{(Object.keys(ESTILOS) as EstiloMapa[]).map((e) => (
						<BotaoSegmento key={e} valor={e} atual={estilo} rotulo={ROTULO_ESTILO[e]} onEscolher={setEstilo} />
					))}
				</div>
				{modosDeCor.length > 1 && (
					<div role='group' aria-label='Cor da rota' className='flex items-center gap-1.5'>
						<span className='text-xs text-muted-foreground'>Cor</span>
						<div className='flex rounded-md border p-0.5'>
							{modosDeCor.map((m) => (
								<BotaoSegmento key={m.valor} valor={m.valor} atual={cor} rotulo={m.rotulo} onEscolher={setCor} />
							))}
						</div>
					</div>
				)}
			</div>

			{temTempos && (
				<label className='flex w-fit cursor-pointer items-center gap-2 text-sm'>
					<input
						type='checkbox'
						className='size-4'
						checked={mostrarTempos}
						onChange={(e) => setMostrarTempos(e.target.checked)}
					/>
					Mostrar o tempo de cada km no mapa
				</label>
			)}

			{gradienteAtual ? (
				<div className='flex items-center gap-2 text-xs text-muted-foreground'>
					<span className='tabular-nums'>
						{gradienteAtual.legenda.de} · {gradienteAtual.legenda.deRotulo}
					</span>
					<span
						aria-hidden
						className='h-1.5 w-24 rounded-full'
						style={{ background: `linear-gradient(to right, ${gradienteAtual.legenda.cores.join(", ")})` }}
					/>
					<span className='tabular-nums'>
						{gradienteAtual.legenda.ate} · {gradienteAtual.legenda.ateRotulo}
					</span>
				</div>
			) : rota.escala ? (
				<div className='flex items-center gap-2 text-xs text-muted-foreground'>
					<span className='tabular-nums'>Mais rápido · {formatarPace(rota.escala.paceRapido)}</span>
					<span
						aria-hidden
						className='h-1.5 w-24 rounded-full'
						style={{ background: `linear-gradient(to right, ${CORES_RITMO.join(", ")})` }}
					/>
					<span className='tabular-nums'>Mais lento · {formatarPace(rota.escala.paceLento)}</span>
					<span className='ml-auto hidden sm:inline'>Cor por km · passe o mouse nos marcadores</span>
				</div>
			) : (
				<p className='text-xs text-muted-foreground'>
					Sem splits carregados: a rota aparece em uma cor só. Use "Buscar do Strava" para colorir por ritmo.
				</p>
			)}
		</div>
	);
}
