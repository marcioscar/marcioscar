import type { CorridaDTO, CorridaStrava } from "./types";

function toOptionalNumber(valor: unknown): number | undefined {
  return typeof valor === "number" ? valor : undefined;
}

function toSafeDate(valor: string): Date {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? new Date(0) : data;
}

export function mapStravaParaCorridaDTO(atividade: CorridaStrava): CorridaDTO {
  return {
    stravaId: atividade.id,
    nome: atividade.name,
    tipoEsporte: atividade.sport_type,
    distanciaMetros: atividade.distance,
    tempoMovimentoSeg: atividade.moving_time,
    tempoTotalSeg: atividade.elapsed_time,
    elevacaoGanhoMetros: atividade.total_elevation_gain,
    dataInicio: toSafeDate(atividade.start_date),
    velocidadeMedia: toOptionalNumber(atividade.average_speed),
    velocidadeMaxima: toOptionalNumber(atividade.max_speed),
    frequenciaMedia: toOptionalNumber(atividade.average_heartrate),
    frequenciaMaxima: toOptionalNumber(atividade.max_heartrate),
    dadosBrutos: atividade,
  };
}

export function mapListaStravaParaDTO(
  atividades: CorridaStrava[],
): CorridaDTO[] {
  return atividades.map(mapStravaParaCorridaDTO);
}
