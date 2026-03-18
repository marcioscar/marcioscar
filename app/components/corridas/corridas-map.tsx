"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { decodePolyline } from "../../lib/polyline";

type CorridasMapProps = {
	mapboxToken: string | null;
	polylines: string[];
};

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.LineString>;

const SOURCE_ID = "corridas-source";
const LAYER_ID = "corridas-layer";
const MAP_STYLE = "mapbox://styles/mapbox/outdoors-v12";
const DEFAULT_CENTER: [number, number] = [-48.0276695, -15.838452];

function buildFeatureCollection(polylines: string[]): FeatureCollection {
	const features = polylines
		.map((encoded, index) => createLineFeature(encoded, index))
		.filter((feature): feature is GeoJSON.Feature<GeoJSON.LineString> =>
			Boolean(feature),
		);

	return {
		type: "FeatureCollection",
		features,
	};
}

function createLineFeature(
	encoded: string,
	index: number,
): GeoJSON.Feature<GeoJSON.LineString> | null {
	const coordinates = decodePolyline(encoded);
	if (coordinates.length < 2) {
		return null;
	}

	return {
		type: "Feature",
		id: `corrida-${index}`,
		properties: {},
		geometry: {
			type: "LineString",
			coordinates,
		},
	};
}

function fitMapToFeatures(
	map: mapboxgl.Map,
	featureCollection: FeatureCollection,
): void {
	const bounds = new mapboxgl.LngLatBounds();
	let hasCoordinates = false;

	for (const feature of featureCollection.features) {
		for (const coordinate of feature.geometry.coordinates) {
			bounds.extend(coordinate as [number, number]);
			hasCoordinates = true;
		}
	}

	if (hasCoordinates) {
		map.fitBounds(bounds, { padding: 40, duration: 600 });
	}
}

function setOrUpdateSource(
	map: mapboxgl.Map,
	featureCollection: FeatureCollection,
): void {
	const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
	if (source) {
		source.setData(featureCollection);
		return;
	}

	map.addSource(SOURCE_ID, {
		type: "geojson",
		data: featureCollection,
	});

	map.addLayer({
		id: LAYER_ID,
		type: "line",
		source: SOURCE_ID,
		paint: {
			"line-color": "#1d4ed8",
			"line-width": 3,
			"line-opacity": 0.85,
		},
	});
}

export function CorridasMap({ mapboxToken, polylines }: CorridasMapProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const featureCollection = useMemo(
		() => buildFeatureCollection(polylines),
		[polylines],
	);

	useEffect(() => {
		if (!mapboxToken || !containerRef.current || mapRef.current) {
			return;
		}

		mapboxgl.accessToken = mapboxToken;
		mapRef.current = new mapboxgl.Map({
			container: containerRef.current,
			style: MAP_STYLE,
			center: DEFAULT_CENTER,
      zoom: 14,
		});

		return () => {
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, [mapboxToken]);

	useEffect(() => {
		const map = mapRef.current;
		const container = containerRef.current;
		if (!map || !container) {
			return;
		}

		const resizeObserver = new ResizeObserver(() => {
			map.resize();
		});
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) {
			return;
		}

		const updateMap = () => {
			setOrUpdateSource(map, featureCollection);
			fitMapToFeatures(map, featureCollection);
		};

		if (map.isStyleLoaded()) {
			updateMap();
			return;
		}

		map.once("load", updateMap);
	}, [featureCollection]);

	if (!mapboxToken) {
		return (
			<div className='rounded-md border p-3 text-sm text-muted-foreground'>
				Token do Mapbox nao encontrado. Defina `MAPBOX_ACCESS_TOKEN` no `.env`.
			</div>
		);
	}

	return (
		<div className='flex flex-col gap-2'>
			<p className='text-sm text-muted-foreground'>
				Selecione uma ou mais corridas para desenhar a rota no mapa.
			</p>
			<div
				ref={containerRef}
				className='h-[280px] w-full rounded-md border sm:h-[360px] lg:h-[420px]'
			/>
		</div>
	);
}
