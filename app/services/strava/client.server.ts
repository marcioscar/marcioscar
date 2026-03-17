import type {
  BuscarCorridasStravaOptions,
  CorridaStrava,
} from "./types";

const STRAVA_AUTH_ENDPOINT = "https://www.strava.com/oauth/token";
const STRAVA_ACTIVITIES_ENDPOINT =
  "https://www.strava.com/api/v3/athlete/activities";

type TokenResponse = {
  access_token?: string;
  message?: string;
};

function readEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  }
  return valor;
}

function getClientId(): string {
  return process.env.STRAVA_CLIENT_ID ?? readEnv("CLIENT_ID");
}

function getClientSecret(): string {
  return process.env.STRAVA_CLIENT_SECRET ?? readEnv("CLIENT_SECRET");
}

function getRefreshToken(): string {
  return process.env.STRAVA_REFRESH_TOKEN ?? readEnv("REFRESH_TOKEN");
}

function buildAuthBody(): URLSearchParams {
  return new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: getRefreshToken(),
    grant_type: "refresh_token",
  });
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string> {
  const response = await fetch(STRAVA_AUTH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildAuthBody(),
  });

  const payload = await parseJsonSafely<TokenResponse>(response);
  if (!response.ok || !payload?.access_token) {
    const mensagem = payload?.message ?? "Falha ao autenticar no Strava";
    throw new Error(`Erro ao obter access token do Strava: ${mensagem}`);
  }

  return payload.access_token;
}

function buildActivitiesUrl(
  pagina: number,
  options: BuscarCorridasStravaOptions,
): URL {
  const url = new URL(STRAVA_ACTIVITIES_ENDPOINT);
  url.searchParams.set("per_page", String(options.perPage ?? 200));
  url.searchParams.set("page", String(pagina));

  if (options.after) {
    url.searchParams.set("after", String(options.after));
  }
  if (options.before) {
    url.searchParams.set("before", String(options.before));
  }

  return url;
}

async function buscarPagina(
  accessToken: string,
  pagina: number,
  options: BuscarCorridasStravaOptions,
): Promise<CorridaStrava[]> {
  const response = await fetch(buildActivitiesUrl(pagina, options), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await parseJsonSafely<unknown>(response);
  if (!response.ok) {
    throw new Error(
      `Erro ao buscar atividades do Strava na pagina ${pagina} (status ${response.status})`,
    );
  }

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload as CorridaStrava[];
}

export async function buscarCorridasStrava(
  options: BuscarCorridasStravaOptions = {},
): Promise<CorridaStrava[]> {
  const token = await getAccessToken();
  const maxPaginas = options.maxPaginas ?? 100;
  const corridas: CorridaStrava[] = [];

  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const atividades = await buscarPagina(token, pagina, options);
    if (atividades.length === 0) {
      break;
    }
    corridas.push(...atividades);
  }

  return corridas;
}
