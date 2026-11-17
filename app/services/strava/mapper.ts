import type { CorridaDTO, CorridaStrava } from "./types";

function toOptionalNumber(valor: unknown): number | undefined {
  return typeof valor === "number" ? valor : undefined;
}

function toSafeDate(valor: string): Date {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? new Date(0) : data;
}

// Strava vai passar a emitir ids de 64 bits (a partir de 01/06/2027). O campo `id`
// já chega arredondado pelo JSON.parse quando passa de 2^53; `id_str` é exato.
// O banco guarda o id como número, então se um id não couber com segurança
// o sync falha em voz alta em vez de gravar um id errado/duplicado.
export function obterStravaId(atividade: CorridaStrava): number {
  const texto =
    typeof atividade.id_str === "string" && atividade.id_str
      ? atividade.id_str
      : String(atividade.id);
  const id = Number(texto);
  if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== texto) {
    throw new Error(
      `Id de atividade do Strava (${texto}) não cabe em um número JS seguro; é preciso migrar stravaId para texto.`,
    );
  }
  return id;
}

export function mapStravaParaCorridaDTO(atividade: CorridaStrava): CorridaDTO {
  return {
    stravaId: obterStravaId(atividade),
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
