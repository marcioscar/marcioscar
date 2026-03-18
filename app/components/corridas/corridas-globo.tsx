"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { decodePolyline } from "../../lib/polyline";
import type { CorridaDataTableRow } from "./corridas-columns";

type CorridasGloboProps = {
  corridasFiltradas: CorridaDataTableRow[];
};

type GloboComponentProps = {
  globeImageUrl: string;
  backgroundColor: string;
  pathsData: Array<{ nome: string; color: string; coords: Array<{ lat: number; lng: number }> }>;
  pathPoints: string;
  pathPointLat: string;
  pathPointLng: string;
  pathColor: string;
  pathStroke: number;
  pathDashLength: number;
  pathDashGap: number;
  pathDashAnimateTime: number;
  pointsData: Array<{
    nome: string;
    tempoMovimentoSeg: number;
    lat: number;
    lng: number;
    color: string;
    altitude: number;
  }>;
  pointLat: string;
  pointLng: string;
  pointColor: string;
  pointAltitude: string;
  pointRadius: number;
  labelsData: Array<{ nome: string; lat: number; lng: number; color: string; label: string }>;
  labelText: string;
  labelLat: string;
  labelLng: string;
  labelColor: string;
  labelSize: number;
  width: number;
  height: number;
  initialViewpoint?: { lat: number; lng: number; altitude: number };
};

type Coordenada = { lat: number; lng: number };
type CorredorPath = { nome: string; color: string; coords: Array<{ lat: number; lng: number }> };
type CorredorPoint = {
  nome: string;
  tempoMovimentoSeg: number;
  lat: number;
  lng: number;
  color: string;
  altitude: number;
};
type CorredorLabel = {
  nome: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
};

const PALETA_CORRIDAS = [
  "#38bdf8",
  "#f97316",
  "#a78bfa",
  "#22c55e",
  "#f43f5e",
  "#facc15",
  "#06b6d4",
];

const GLOBO_LARGURA_PADRAO = 320;

function getColorById(id: number): string {
  const normalized = Math.abs(id) % PALETA_CORRIDAS.length;
  return PALETA_CORRIDAS[normalized];
}

function getGloboHeight(width: number): number {
  if (width < 480) {
    return 260;
  }

  if (width < 768) {
    return 320;
  }

  return 420;
}

function getAltitudeByTempo(
  tempoMovimentoSeg: number,
  minTempo: number,
  maxTempo: number,
): number {
  if (maxTempo === minTempo) {
    return 0.12;
  }

  const normalizado = (tempoMovimentoSeg - minTempo) / (maxTempo - minTempo);
  return 0.05 + normalizado * 0.23;
}

function formatarTempoConclusao(segundosTotais: number): string {
  const horas = Math.floor(segundosTotais / 3600);
  const minutos = Math.floor((segundosTotais % 3600) / 60);
  const segundos = segundosTotais % 60;

  const hh = String(horas).padStart(2, "0");
  const mm = String(minutos).padStart(2, "0");
  const ss = String(segundos).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function buildPathsData(corridasFiltradas: CorridaDataTableRow[]) {
  return corridasFiltradas
    .filter((corrida) => Boolean(corrida.summaryPolyline))
    .map((corrida) => {
      const coords = decodePolyline(corrida.summaryPolyline as string).map(
        ([lng, lat]) => ({ lat, lng }),
      );

      return {
        nome: corrida.nome,
        color: getColorById(corrida.stravaId),
        coords,
      };
    })
    .filter((corrida) => corrida.coords.length > 1);
}

function buildPointsData(corridasFiltradas: CorridaDataTableRow[]): CorredorPoint[] {
  const tempos = corridasFiltradas.map((corrida) => corrida.tempoMovimentoSeg);
  const minTempo = Math.min(...tempos);
  const maxTempo = Math.max(...tempos);

  return corridasFiltradas
    .map((corrida) => {
      const ponto = getPointFromCorrida(corrida);
      if (!ponto) {
        return null;
      }

      return {
        nome: corrida.nome,
        tempoMovimentoSeg: corrida.tempoMovimentoSeg,
        lat: ponto.lat,
        lng: ponto.lng,
        color: getColorById(corrida.stravaId),
        altitude: getAltitudeByTempo(corrida.tempoMovimentoSeg, minTempo, maxTempo),
      };
    })
    .filter((item): item is CorredorPoint => Boolean(item));
}

function buildLabelsData(pointsData: CorredorPoint[]): CorredorLabel[] {
  return pointsData.map((point) => ({
    nome: point.nome,
    lat: point.lat,
    lng: point.lng,
    color: point.color,
    label: `${point.nome} • ${formatarTempoConclusao(point.tempoMovimentoSeg)}`,
  }));
}

function getPointFromCorrida(corrida: CorridaDataTableRow): Coordenada | null {
  if (typeof corrida.localLat === "number" && typeof corrida.localLng === "number") {
    return { lat: corrida.localLat, lng: corrida.localLng };
  }

  if (corrida.summaryPolyline) {
    const decoded = decodePolyline(corrida.summaryPolyline);
    const first = decoded[0];
    if (first) {
      return { lat: first[1], lng: first[0] };
    }
  }

  return null;
}

function getCenter(
  pathsData: CorredorPath[],
  pointsData: CorredorPoint[],
): Coordenada | null {
  const firstPathPoint = pathsData[0]?.coords[0];
  if (firstPathPoint) {
    return { lat: firstPathPoint.lat, lng: firstPathPoint.lng };
  }

  const firstPoint = pointsData[0];
  if (firstPoint) {
    return { lat: firstPoint.lat, lng: firstPoint.lng };
  }

  return null;
}

export function CorridasGlobo({ corridasFiltradas }: CorridasGloboProps) {
  const [Globe, setGlobe] = useState<React.ComponentType<GloboComponentProps> | null>(
    null,
  );
  const [width, setWidth] = useState(0);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  const pathsData = useMemo(
    () => buildPathsData(corridasFiltradas),
    [corridasFiltradas],
  );
  const pointsData = useMemo(
    () => buildPointsData(corridasFiltradas),
    [corridasFiltradas],
  );
  const labelsData = useMemo(() => buildLabelsData(pointsData), [pointsData]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let mounted = true;
    import("react-globe.gl").then((mod) => {
      if (mounted) {
        setGlobe(() => mod.default as React.ComponentType<GloboComponentProps>);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!canvasWrapperRef.current) {
      return;
    }

    const updateWidth = () => {
      setWidth(canvasWrapperRef.current?.clientWidth ?? 0);
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(canvasWrapperRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  const center = getCenter(pathsData, pointsData);
  const larguraGlobo = width > 0 ? width : GLOBO_LARGURA_PADRAO;
  const alturaGlobo = getGloboHeight(larguraGlobo);

  if (corridasFiltradas.length === 0) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">
        Nenhuma corrida na faixa selecionada para visualizar no globo.
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 overflow-hidden rounded-md border p-3">
      <p className="text-sm text-muted-foreground">
        Globo das maratonas ({corridasFiltradas.length}).
      </p>
      <div ref={canvasWrapperRef} className="w-full overflow-hidden">
        {Globe ? (
          <Globe
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            backgroundColor="#020617"
            pathsData={pathsData}
            pathPoints="coords"
            pathPointLat="lat"
            pathPointLng="lng"
            pathColor="color"
            pathStroke={1.4}
            pathDashLength={0.55}
            pathDashGap={0.18}
            pathDashAnimateTime={1600}
            pointsData={pointsData}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointAltitude="altitude"
            pointRadius={0.3}
            labelsData={labelsData}
            labelText="label"
            labelLat="lat"
            labelLng="lng"
            labelColor="color"
            labelSize={0.95}
            width={larguraGlobo}
            height={alturaGlobo}
            {...(center
              ? {
                  initialViewpoint: {
                    lat: center.lat,
                    lng: center.lng,
                    altitude: 1.7,
                  },
                }
              : {})}
          />
        ) : (
          <div className="h-[280px] rounded-md border text-sm text-muted-foreground grid place-items-center sm:h-[320px] lg:h-[420px]">
            Carregando globo...
          </div>
        )}
      </div>
    </div>
  );
}
