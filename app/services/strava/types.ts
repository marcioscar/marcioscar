export type CorridaStrava = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  sport_type: string;
  start_date: string;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  [key: string]: unknown;
};

export type BuscarCorridasStravaOptions = {
  perPage?: number;
  maxPaginas?: number;
  after?: number;
  before?: number;
  modoSync?: "incremental" | "full";
};

export type CorridaDTO = {
  stravaId: number;
  nome: string;
  tipoEsporte: string;
  distanciaMetros: number;
  tempoMovimentoSeg: number;
  tempoTotalSeg: number;
  elevacaoGanhoMetros: number;
  dataInicio: Date;
  velocidadeMedia?: number;
  velocidadeMaxima?: number;
  frequenciaMedia?: number;
  frequenciaMaxima?: number;
  dadosBrutos: Record<string, unknown>;
};

export type SyncCorridasResult = {
  totalRecebidas: number;
  totalSincronizadas: number;
  modo: "incremental" | "full";
  afterUsado?: number;
};
