import { db } from "../../../db.server";
import type { Prisma } from "@prisma/client";
import type { CorridaDTO } from "./types";

export interface CorridasRepository {
  upsertEmLote(corridas: CorridaDTO[]): Promise<number>;
  buscarUltimaDataInicioSalva(): Promise<Date | null>;
}

type CorridaPersistencia = Omit<Prisma.CorridaCreateInput, "stravaId">;
const TAMANHO_LOTE_UPSERT = 50;

function toPrismaJson(
  valor: Record<string, unknown>,
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

function splitForUpsert(corrida: CorridaDTO): {
  stravaId: number;
  payload: CorridaPersistencia;
} {
  const { stravaId } = corrida;

  const payload: CorridaPersistencia = {
    nome: corrida.nome,
    tipoEsporte: corrida.tipoEsporte,
    distanciaMetros: corrida.distanciaMetros,
    tempoMovimentoSeg: corrida.tempoMovimentoSeg,
    tempoTotalSeg: corrida.tempoTotalSeg,
    elevacaoGanhoMetros: corrida.elevacaoGanhoMetros,
    dataInicio: corrida.dataInicio,
    velocidadeMedia: corrida.velocidadeMedia,
    velocidadeMaxima: corrida.velocidadeMaxima,
    frequenciaMedia: corrida.frequenciaMedia,
    frequenciaMaxima: corrida.frequenciaMaxima,
    dadosBrutos: toPrismaJson(corrida.dadosBrutos),
  };

  return {
    stravaId,
    payload,
  };
}

function deduplicarPorStravaId(corridas: CorridaDTO[]): CorridaDTO[] {
  const mapa = new Map<number, CorridaDTO>();

  for (const corrida of corridas) {
    const existente = mapa.get(corrida.stravaId);
    if (!existente || corrida.dataInicio > existente.dataInicio) {
      mapa.set(corrida.stravaId, corrida);
    }
  }

  return [...mapa.values()];
}

function quebrarEmLotes<T>(itens: T[], tamanhoLote: number): T[][] {
  const lotes: T[][] = [];

  for (let i = 0; i < itens.length; i += tamanhoLote) {
    lotes.push(itens.slice(i, i + tamanhoLote));
  }

  return lotes;
}

async function upsertDeUmLote(corridas: CorridaDTO[]): Promise<void> {
  await Promise.all(
    corridas.map((corrida) => {
      const { stravaId, payload } = splitForUpsert(corrida);

      return db.corrida.upsert({
        where: { stravaId },
        update: payload,
        create: { stravaId, ...payload },
      });
    }),
  );
}

export class PrismaCorridasRepository implements CorridasRepository {
  async upsertEmLote(corridas: CorridaDTO[]): Promise<number> {
    if (corridas.length === 0) {
      return 0;
    }

    const corridasDeduplicadas = deduplicarPorStravaId(corridas);
    const lotes = quebrarEmLotes(corridasDeduplicadas, TAMANHO_LOTE_UPSERT);

    for (const lote of lotes) {
      await upsertDeUmLote(lote);
    }

    return corridasDeduplicadas.length;
  }

  async buscarUltimaDataInicioSalva(): Promise<Date | null> {
    const ultimaCorrida = await db.corrida.findFirst({
      orderBy: { dataInicio: "desc" },
      select: { dataInicio: true },
    });

    return ultimaCorrida?.dataInicio ?? null;
  }
}
