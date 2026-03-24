export { buscarCorridasStrava as buscarCorridasDoStrava } from "~/services/strava/client.server";
export { sincronizarCorridasDoStrava } from "~/services/strava/sync.server";
import { db } from "../../db.server";
import type { MaratonaBarrasDado } from "~/types/maratonas-barras";

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
  intervaloData?: {
    inicio?: Date;
    fim?: Date;
  },
): Promise<CorridaResumo[]> {
  const where = montarFiltroDataInicio(intervaloData);

  const corridas = await db.corrida.findMany({
    ...(where ? { where } : {}),
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

function montarFiltroDataInicio(intervaloData?: {
  inicio?: Date;
  fim?: Date;
}) {
  const inicio = intervaloData?.inicio;
  const fim = intervaloData?.fim;

  if (!inicio && !fim) {
    return undefined;
  }

  if (inicio && fim) {
    return { dataInicio: { gte: inicio, lte: fim } };
  }

  if (inicio) {
    return { dataInicio: { gte: inicio } };
  }

  return { dataInicio: { lte: fim } };
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

const METROS_MARATONA_MIN = 40_000;

function encurtarNomeParaLegenda(nome: string): string {
  const trimmed = nome.trim();
  if (trimmed.length <= 22) {
    return trimmed;
  }
  return `${trimmed.slice(0, 19)}...`;
}

function montarLabelEixoX(dataInicio: Date, nome: string): string {
  const data = dataInicio.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const curto = encurtarNomeParaLegenda(nome);
  return `${data} · ${curto}`;
}

export async function listarMaratonasParaGraficoBarras(
  limite: number,
): Promise<MaratonaBarrasDado[]> {
  const corridas = await db.corrida.findMany({
    where: {
      distanciaMetros: { gt: METROS_MARATONA_MIN },
    },
    orderBy: { dataInicio: "desc" },
    take: limite,
    select: {
      stravaId: true,
      nome: true,
      distanciaMetros: true,
      tempoMovimentoSeg: true,
      tempoTotalSeg: true,
      dataInicio: true,
    },
  });

  return corridas.map((corrida) => {
    const distanciaKm = corrida.distanciaMetros / 1000;
    const paceMedioSegPorKm =
      distanciaKm > 0
        ? Math.round(corrida.tempoMovimentoSeg / distanciaKm)
        : null;

    return {
      stravaId: corrida.stravaId,
      nome: corrida.nome,
      nomeCurto: encurtarNomeParaLegenda(corrida.nome),
      dataInicioIso: corrida.dataInicio.toISOString(),
      label: montarLabelEixoX(corrida.dataInicio, corrida.nome),
      tempoTerminoSeg: corrida.tempoTotalSeg,
      paceMedioSegPorKm,
    };
  });
}

export type { MaratonaBarrasDado };