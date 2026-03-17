export { buscarCorridasStrava as buscarCorridasDoStrava } from "~/services/strava/client.server";
export { sincronizarCorridasDoStrava } from "~/services/strava/sync.server";
import { db } from "../../db.server";

export type CorridaResumo = {
  stravaId: number;
  nome: string;
  distanciaMetros: number;
  elevacaoGanhoMetros: number;
  tempoMovimentoSeg: number;
  velocidadeMedia: number | null;
  summaryPolyline: string | null;
  localLat: number | null;
  localLng: number | null;
  dataInicio: Date;
};

type CorridaDbSelecionada = {
  stravaId: number;
  nome: string;
  distanciaMetros: number;
  elevacaoGanhoMetros: number;
  tempoMovimentoSeg: number;
  velocidadeMedia: number | null;
  dataInicio: Date;
  dadosBrutos: unknown;
};

export async function contarCorridasSalvas(): Promise<number> {
  return db.corrida.count();
}

export async function buscarUltimaAtualizacaoCorridas(): Promise<Date | null> {
  const ultimaCorrida = await db.corrida.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  return ultimaCorrida?.updatedAt ?? null;
}

export async function listarUltimasCorridas(
  limite?: number,
): Promise<CorridaResumo[]> {
  const corridas = await db.corrida.findMany({
    orderBy: { dataInicio: "desc" },
    ...(typeof limite === "number" ? { take: limite } : {}),
    select: {
      stravaId: true,
      nome: true,
      distanciaMetros: true,
      elevacaoGanhoMetros: true,
      tempoMovimentoSeg: true,
      velocidadeMedia: true,
      dataInicio: true,
      dadosBrutos: true,
    },
  });

  return corridas.map(mapCorridaDbParaResumo);
}

function mapCorridaDbParaResumo(corrida: CorridaDbSelecionada): CorridaResumo {
  const localCoords = extrairLocalCoords(corrida.dadosBrutos);

  return {
    stravaId: corrida.stravaId,
    nome: corrida.nome,
    distanciaMetros: corrida.distanciaMetros,
    elevacaoGanhoMetros: corrida.elevacaoGanhoMetros,
    tempoMovimentoSeg: corrida.tempoMovimentoSeg,
    velocidadeMedia: corrida.velocidadeMedia,
    summaryPolyline: extrairSummaryPolyline(corrida.dadosBrutos),
    localLat: localCoords.localLat,
    localLng: localCoords.localLng,
    dataInicio: corrida.dataInicio,
  };
}

function extrairSummaryPolyline(dadosBrutos: unknown): string | null {
  if (!dadosBrutos || typeof dadosBrutos !== "object") {
    return null;
  }

  const dados = dadosBrutos as {
    map?: {
      summary_polyline?: unknown;
    };
  };

  const summaryPolyline = dados.map?.summary_polyline;
  return typeof summaryPolyline === "string" && summaryPolyline.length > 0
    ? summaryPolyline
    : null;
}

function extrairLocalCoords(dadosBrutos: unknown): {
  localLat: number | null;
  localLng: number | null;
} {
  if (!dadosBrutos || typeof dadosBrutos !== "object") {
    return { localLat: null, localLng: null };
  }

  const dados = dadosBrutos as {
    original?: { local?: unknown };
    start_latlng?: unknown;
  };

  const localManual = parseLocalString(dados.original?.local);
  if (localManual) {
    return localManual;
  }

  const localStartLatLng = parseStartLatLng(dados.start_latlng);
  if (localStartLatLng) {
    return localStartLatLng;
  }

  return { localLat: null, localLng: null };
}

function parseLocalString(
  local: unknown,
): { localLat: number; localLng: number } | null {
  if (typeof local !== "string") {
    return null;
  }

  const partes = local.split(",").map((parte) => Number(parte.trim()));
  if (partes.length !== 2 || partes.some((valor) => Number.isNaN(valor))) {
    return null;
  }

  const [localLat, localLng] = partes;
  return { localLat, localLng };
}

function parseStartLatLng(
  startLatLng: unknown,
): { localLat: number; localLng: number } | null {
  if (!Array.isArray(startLatLng) || startLatLng.length < 2) {
    return null;
  }

  const [lat, lng] = startLatLng;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  return { localLat: lat, localLng: lng };
}

export type {
  BuscarCorridasStravaOptions as BuscarCorridasOptions,
  CorridaDTO,
  CorridaStrava,
  SyncCorridasResult,
} from "~/services/strava/types";