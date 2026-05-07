import { performance } from "node:perf_hooks";
import {
	listarUltimasCorridas,
	type CorridaResumo,
} from "~/models/corridas.server";

const DEFAULT_LATITUDE = -23.55052;
const DEFAULT_LONGITUDE = -46.633308;
const DEFAULT_CIDADE = "Sao Paulo";
const CONNECTIVITY_TIMEOUT_MS = 3_500;

type WeatherCodeMap = {
	[key: number]: string;
};

const WEATHER_CODE_PT_BR: WeatherCodeMap = {
	0: "Ceo limpo",
	1: "Predominantemente limpo",
	2: "Parcialmente nublado",
	3: "Nublado",
	45: "Neblina",
	48: "Neblina com geada",
	51: "Garoa leve",
	53: "Garoa moderada",
	55: "Garoa forte",
	56: "Garoa congelante leve",
	57: "Garoa congelante forte",
	61: "Chuva fraca",
	63: "Chuva moderada",
	65: "Chuva forte",
	66: "Chuva congelante leve",
	67: "Chuva congelante forte",
	71: "Neve fraca",
	73: "Neve moderada",
	75: "Neve forte",
	77: "Graos de neve",
	80: "Pancadas fracas",
	81: "Pancadas moderadas",
	82: "Pancadas fortes",
	85: "Neve em pancadas fracas",
	86: "Neve em pancadas fortes",
	95: "Trovoada",
	96: "Trovoada com granizo leve",
	99: "Trovoada com granizo forte",
};

export type KioskWeatherSnapshot = {
	cidade: string;
	temperaturaC: number | null;
	umidade: number | null;
	descricao: string;
	atualizadoEmIso: string;
};

export type KioskConnectivityStatus =
	| "online"
	| "offline"
	| "nao-configurado";

export type KioskEndpointMonitor = {
	nome: string;
	url: string;
	status: KioskConnectivityStatus;
	latenciaMs: number | null;
	httpStatus: number | null;
	detalhe: string;
};

export type KioskConnectivitySnapshot = {
	internet: KioskEndpointMonitor;
	coolify: KioskEndpointMonitor;
	atualizadoEmIso: string;
};

export type KioskDashboardData = {
	weather: KioskWeatherSnapshot;
	connectivity: KioskConnectivitySnapshot;
	ultimasCorridas: CorridaResumo[];
};

type Coordenadas = {
	latitude: number;
	longitude: number;
	cidade: string;
};

function parseCoordinate(rawValue: string | undefined): number | null {
	if (!rawValue) {
		return null;
	}

	const parsed = Number(rawValue);
	return Number.isFinite(parsed) ? parsed : null;
}

function getCoordenadasPadrao(): Coordenadas {
	const latitude = parseCoordinate(process.env.KIOSK_LATITUDE);
	const longitude = parseCoordinate(process.env.KIOSK_LONGITUDE);
	const cidade = process.env.KIOSK_CIDADE?.trim() || DEFAULT_CIDADE;

	if (latitude === null || longitude === null) {
		return {
			latitude: DEFAULT_LATITUDE,
			longitude: DEFAULT_LONGITUDE,
			cidade,
		};
	}

	return { latitude, longitude, cidade };
}

function getDescricaoClima(weatherCode: number | null | undefined): string {
	if (typeof weatherCode !== "number") {
		return "Sem dados";
	}

	return WEATHER_CODE_PT_BR[weatherCode] ?? "Condicao desconhecida";
}

async function fetchWeatherSnapshot(
	coordenadas: Coordenadas,
): Promise<KioskWeatherSnapshot> {
	const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
	endpoint.searchParams.set("latitude", String(coordenadas.latitude));
	endpoint.searchParams.set("longitude", String(coordenadas.longitude));
	endpoint.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code");
	endpoint.searchParams.set("timezone", "auto");

	try {
		const response = await fetch(endpoint, {
			signal: AbortSignal.timeout(CONNECTIVITY_TIMEOUT_MS),
		});

		if (!response.ok) {
			return criarWeatherFallback(
				coordenadas.cidade,
				`Erro ao consultar clima (${response.status})`,
			);
		}

		const payload = (await response.json()) as {
			current?: {
				temperature_2m?: number;
				relative_humidity_2m?: number;
				weather_code?: number;
			};
		};

		return {
			cidade: coordenadas.cidade,
			temperaturaC: payload.current?.temperature_2m ?? null,
			umidade: payload.current?.relative_humidity_2m ?? null,
			descricao: getDescricaoClima(payload.current?.weather_code),
			atualizadoEmIso: new Date().toISOString(),
		};
	} catch {
		return criarWeatherFallback(coordenadas.cidade, "Sem conexao com API do clima");
	}
}

function criarWeatherFallback(
	cidade: string,
	descricao: string,
): KioskWeatherSnapshot {
	return {
		cidade,
		temperaturaC: null,
		umidade: null,
		descricao,
		atualizadoEmIso: new Date().toISOString(),
	};
}

function getConnectivityStatusCode(response: Response): KioskConnectivityStatus {
	if (response.ok) {
		return "online";
	}

	return response.status >= 500 ? "offline" : "online";
}

async function monitorarEndpoint(
	nome: string,
	url: string,
): Promise<KioskEndpointMonitor> {
	const inicio = performance.now();

	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(CONNECTIVITY_TIMEOUT_MS),
			method: "GET",
			headers: { "Cache-Control": "no-cache" },
		});
		const latenciaMs = Math.round(performance.now() - inicio);
		const status = getConnectivityStatusCode(response);

		return {
			nome,
			url,
			status,
			latenciaMs,
			httpStatus: response.status,
			detalhe: status === "online" ? "Resposta recebida" : "Falha no endpoint",
		};
	} catch {
		return {
			nome,
			url,
			status: "offline",
			latenciaMs: null,
			httpStatus: null,
			detalhe: "Timeout ou sem resposta",
		};
	}
}

async function monitorarInternet(): Promise<KioskEndpointMonitor> {
	return monitorarEndpoint(
		"Internet",
		"https://www.cloudflare.com/cdn-cgi/trace",
	);
}

async function monitorarCoolify(): Promise<KioskEndpointMonitor> {
	const coolifyUrl = process.env.COOLIFY_MONITOR_URL?.trim();

	if (!coolifyUrl) {
		return {
			nome: "Coolify",
			url: "COOLIFY_MONITOR_URL",
			status: "nao-configurado",
			latenciaMs: null,
			httpStatus: null,
			detalhe: "Defina COOLIFY_MONITOR_URL para monitorar o servico",
		};
	}

	return monitorarEndpoint("Coolify", coolifyUrl);
}

async function obterConnectivitySnapshot(): Promise<KioskConnectivitySnapshot> {
	const [internet, coolify] = await Promise.all([
		monitorarInternet(),
		monitorarCoolify(),
	]);

	return {
		internet,
		coolify,
		atualizadoEmIso: new Date().toISOString(),
	};
}

export async function obterDadosKiosk(): Promise<KioskDashboardData> {
	const coordenadas = getCoordenadasPadrao();
	const [weather, connectivity, ultimasCorridas] = await Promise.all([
		fetchWeatherSnapshot(coordenadas),
		obterConnectivitySnapshot(),
		listarUltimasCorridas(3),
	]);

	return {
		weather,
		connectivity,
		ultimasCorridas,
	};
}
