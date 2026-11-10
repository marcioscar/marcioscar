"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { CORES_RITMO, montarRota, type SplitRota } from "~/lib/rota";

type CorridaRotaMapProps = {
	mapboxToken: string | null;
	polyline: string;
	distanciaMetros: number;
	splits: SplitRota[] | null;
};

const SOURCE_ID = "rota-source";
const MAP_STYLE = "mapbox://styles/mapbox/outdoors-v12";

function formatarPace(segPorKm: number): string {
	const min = Math.floor(segPorKm / 60);
	const seg = Math.round(segPorKm % 60);
	return `${min}:${String(seg).padStart(2, "0")}/km`;
}

function criarMarcador(texto: string, classe: string): HTMLDivElement {
	const el = document.createElement("div");
	el.className = classe;
	el.textContent = texto;
	return el;
}

const CLASSE_KM =
	"flex size-5 items-center justify-center rounded-full border border-white bg-neutral-800 text-[10px] font-semibold leading-none text-white shadow";
const CLASSE_PONTA =
	"flex h-5 items-center justify-center rounded-full border border-white px-1.5 text-[10px] font-semibold leading-none text-white shadow";

export function CorridaRotaMap({
	mapboxToken,
	polyline,
	distanciaMetros,
	splits,
}: CorridaRotaMapProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const rota = useMemo(
		() => montarRota(polyline, distanciaMetros, splits),
		[polyline, distanciaMetros, splits],
	);

	useEffect(() => {
		const container = containerRef.current;
		if (!mapboxToken || !container || !rota) {
			return;
		}

		mapboxgl.accessToken = mapboxToken;
		const map = new mapboxgl.Map({
			container,
			style: MAP_STYLE,
			center: rota.largada,
			zoom: 13,
		});
		map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

		const marcadores: mapboxgl.Marker[] = [];
		const popup = new mapboxgl.Popup({
			closeButton: false,
			closeOnClick: false,
			offset: 12,
		});

		map.on("load", () => {
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
			// contorno branco para a rota destacar do mapa
			map.addLayer({
				id: "rota-contorno",
				type: "line",
				source: SOURCE_ID,
				layout: { "line-cap": "round", "line-join": "round" },
				paint: { "line-color": "#ffffff", "line-width": 7 },
			});
			map.addLayer({
				id: "rota-linha",
				type: "line",
				source: SOURCE_ID,
				layout: { "line-cap": "round", "line-join": "round" },
				paint: { "line-color": ["get", "cor"], "line-width": 4 },
			});

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
				marcadores.push(
					new mapboxgl.Marker({ element: el }).setLngLat(marco.coordenada).addTo(map),
				);
			}

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
		};
	}, [mapboxToken, rota]);

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

	return (
		<div className='flex flex-col gap-2'>
			<div
				ref={containerRef}
				className='h-[280px] w-full rounded-md border sm:h-[360px] lg:h-[420px]'
			/>
			{rota.escala ? (
				<div className='flex items-center gap-2 text-xs text-muted-foreground'>
					<span className='tabular-nums'>
						Mais rápido · {formatarPace(rota.escala.paceRapido)}
					</span>
					<span
						aria-hidden
						className='h-1.5 w-24 rounded-full'
						style={{
							background: `linear-gradient(to right, ${CORES_RITMO.join(", ")})`,
						}}
					/>
					<span className='tabular-nums'>
						Mais lento · {formatarPace(rota.escala.paceLento)}
					</span>
					<span className='ml-auto hidden sm:inline'>
						Cor por km · passe o mouse nos marcadores
					</span>
				</div>
			) : (
				<p className='text-xs text-muted-foreground'>
					Sem splits carregados: a rota aparece em uma cor só. Use "Buscar do
					Strava" para colorir por ritmo.
				</p>
			)}
		</div>
	);
}
