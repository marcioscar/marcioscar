import { buscarCorridasStrava } from "./client.server";
import { mapListaStravaParaDTO } from "./mapper";
import {
  PrismaCorridasRepository,
  type CorridasRepository,
} from "./repository";
import type {
  BuscarCorridasStravaOptions,
  CorridaStrava,
  SyncCorridasResult,
} from "./types";

const OVERLAP_SEGUNDOS_INCREMENTAL = 60;

function toUnixSeconds(data: Date): number {
  return Math.floor(data.getTime() / 1000);
}

function calcularAfterIncremental(dataInicio: Date): number {
  const unix = toUnixSeconds(dataInicio);
  return Math.max(0, unix - OVERLAP_SEGUNDOS_INCREMENTAL);
}

async function resolverAfterParaSync(
  options: BuscarCorridasStravaOptions,
  repository: CorridasRepository,
): Promise<{
  after?: number;
  modo: "incremental" | "full";
}> {
  if (options.modoSync === "full") {
    return { after: undefined, modo: "full" };
  }

  if (options.after) {
    return { after: options.after, modo: "incremental" };
  }

  const ultimaDataInicio = await repository.buscarUltimaDataInicioSalva();
  if (!ultimaDataInicio) {
    return { after: undefined, modo: "full" };
  }

  return {
    after: calcularAfterIncremental(ultimaDataInicio),
    modo: "incremental",
  };
}

function ehCorridaRun(atividade: CorridaStrava): boolean {
  const sportType = atividade.sport_type;
  const typeLegado =
    typeof atividade.type === "string" ? atividade.type : undefined;

  return sportType === "Run" || typeLegado === "Run";
}

function filtrarApenasRuns(atividades: CorridaStrava[]): CorridaStrava[] {
  return atividades.filter(ehCorridaRun);
}

export async function sincronizarCorridasDoStrava(
  options: BuscarCorridasStravaOptions = {},
  repository: CorridasRepository = new PrismaCorridasRepository(),
): Promise<SyncCorridasResult> {
  const resolucaoAfter = await resolverAfterParaSync(options, repository);
  const atividades = await buscarCorridasStrava({
    ...options,
    after: resolucaoAfter.after,
  });
  const atividadesRun = filtrarApenasRuns(atividades);
  const corridasDTO = mapListaStravaParaDTO(atividadesRun);
  const totalSincronizadas = await repository.upsertEmLote(corridasDTO);

  return {
    totalRecebidas: atividadesRun.length,
    totalSincronizadas,
    modo: resolucaoAfter.modo,
    afterUsado: resolucaoAfter.after,
  };
}
