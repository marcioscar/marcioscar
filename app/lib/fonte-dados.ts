// A partir desta data, corridas e treinos vêm do Apple Watch (app Saúde) em vez do Strava,
// nas páginas de Atividades e Treinos. Antes dela continua valendo o Strava.
// (O Strava segue sincronizando; uma corrida só some da lista se o relógio tiver a mesma.)
export const RELOGIO_DESDE = '2026-11-23'

/** Meia-noite de São Paulo (UTC-3) do dia em que o relógio passa a ser a fonte. */
export const RELOGIO_DESDE_DATA = new Date(`${RELOGIO_DESDE}T03:00:00.000Z`)

/** Começo a até 15 minutos de diferença conta como a mesma atividade. */
export const FOLGA_MESMA_ATIVIDADE_MS = 15 * 60 * 1000
