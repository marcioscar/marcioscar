import { useEffect, useMemo, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { Route } from "./+types/kiosk";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	obterDadosKiosk,
	type KioskConnectivityStatus,
} from "~/models/kiosk.server";

type LoaderData = Awaited<ReturnType<typeof obterDadosKiosk>>;

const REFRESH_INTERVAL_MS = 60_000;

function formatarHoraAgora(data: Date): string {
	return data.toLocaleTimeString("pt-BR", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function formatarDataAgora(data: Date): string {
	return data.toLocaleDateString("pt-BR", {
		weekday: "short",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function formatarDistancia(distanciaMetros: number): string {
	return `${(distanciaMetros / 1000).toFixed(2)} km`;
}

function formatarDuracao(segundos: number): string {
	const horas = Math.floor(segundos / 3600);
	const minutos = Math.floor((segundos % 3600) / 60);
	const restoSegundos = segundos % 60;

	return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(restoSegundos).padStart(2, "0")}`;
}

function classNameBadgeStatus(status: KioskConnectivityStatus): string {
	if (status === "online") {
		return "bg-green-500/20 text-green-300 ring-green-500/50";
	}

	if (status === "offline") {
		return "bg-red-500/20 text-red-300 ring-red-500/50";
	}

	return "bg-yellow-500/20 text-yellow-300 ring-yellow-500/50";
}

function textoStatus(status: KioskConnectivityStatus): string {
	if (status === "online") {
		return "Online";
	}

	if (status === "offline") {
		return "Offline";
	}

	return "Nao configurado";
}

function useClock() {
	const [agora, setAgora] = useState(() => new Date());

	useEffect(() => {
		const timer = window.setInterval(() => {
			setAgora(new Date());
		}, 1000);

		return () => window.clearInterval(timer);
	}, []);

	return agora;
}

function useKioskAutoRefresh() {
	const revalidator = useRevalidator();

	useEffect(() => {
		const timer = window.setInterval(() => {
			revalidator.revalidate();
		}, REFRESH_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, [revalidator]);
}

function ClockCard() {
	const agora = useClock();

	return (
		<Card className='bg-neutral-950/80 ring-neutral-800'>
			<CardHeader className='pb-2'>
				<CardTitle className='text-sm text-neutral-300'>Relogio</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-1'>
				<p className='text-4xl leading-none font-bold text-white tabular-nums'>
					{formatarHoraAgora(agora)}
				</p>
				<p className='text-xs text-neutral-400 capitalize'>
					{formatarDataAgora(agora)}
				</p>
			</CardContent>
		</Card>
	);
}

function WeatherCard({ data }: { data: LoaderData["weather"] }) {
	return (
		<Card className='bg-sky-950/35 ring-sky-900/80'>
			<CardHeader className='pb-2'>
				<CardTitle className='text-sm text-sky-200'>Previsao do tempo</CardTitle>
			</CardHeader>
			<CardContent className='space-y-1'>
				<p className='text-xs text-sky-100/90'>{data.cidade}</p>
				<p className='text-3xl leading-none font-semibold text-white'>
					{typeof data.temperaturaC === "number"
						? `${Math.round(data.temperaturaC)}°C`
						: "--"}
				</p>
				<p className='text-xs text-sky-100'>{data.descricao}</p>
				<p className='text-[11px] text-sky-300/80'>
					Umidade:{" "}
					{typeof data.umidade === "number" ? `${Math.round(data.umidade)}%` : "--"}
				</p>
			</CardContent>
		</Card>
	);
}

function ConnectivityCard({ data }: { data: LoaderData["connectivity"] }) {
	const endpoints = useMemo(
		() => [data.internet, data.coolify],
		[data.coolify, data.internet],
	);

	return (
		<Card className='bg-violet-950/30 ring-violet-900/70'>
			<CardHeader className='pb-2'>
				<CardTitle className='text-sm text-violet-200'>
					Monitoramento de internet
				</CardTitle>
			</CardHeader>
			<CardContent className='space-y-2'>
				{endpoints.map((endpoint) => (
					<div
						key={endpoint.nome}
						className='rounded-xl bg-black/20 p-2 ring-1 ring-white/10'>
						<div className='flex items-center justify-between gap-2'>
							<p className='text-xs text-violet-100'>{endpoint.nome}</p>
							<span
								className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${classNameBadgeStatus(endpoint.status)}`}>
								{textoStatus(endpoint.status)}
							</span>
						</div>
						<p className='mt-1 text-[11px] text-violet-200/90'>
							{endpoint.latenciaMs !== null
								? `${endpoint.latenciaMs} ms`
								: "Latencia indisponivel"}
						</p>
						<p className='text-[11px] text-violet-300/80 truncate'>
							{endpoint.detalhe}
						</p>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function LatestRacesCard({ data }: { data: LoaderData["ultimasCorridas"] }) {
	return (
		<Card className='bg-emerald-950/25 ring-emerald-900/70'>
			<CardHeader className='pb-2'>
				<CardTitle className='text-sm text-emerald-200'>Ultimas corridas</CardTitle>
			</CardHeader>
			<CardContent className='space-y-2'>
				{data.length === 0 ? (
					<p className='text-xs text-emerald-100/80'>Nenhuma corrida encontrada.</p>
				) : (
					data.map((corrida) => (
						<div
							key={corrida.stravaId}
							className='rounded-xl bg-black/20 p-2 ring-1 ring-white/10'>
							<p className='truncate text-xs font-medium text-emerald-100'>
								{corrida.nome}
							</p>
							<div className='mt-1 flex items-center justify-between gap-2 text-[11px] text-emerald-300/90'>
								<span>{formatarDistancia(corrida.distanciaMetros)}</span>
								<span>{formatarDuracao(corrida.tempoMovimentoSeg)}</span>
								<span>
									{new Date(corrida.dataInicio).toLocaleDateString("pt-BR")}
								</span>
							</div>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Kiosk | Marcioscar" },
		{
			name: "description",
			content:
				"Painel kiosk para Raspberry com relogio, clima, corridas e conectividade",
		},
		{ name: "theme-color", content: "#0a0a0a" },
	];
}

export async function loader(): Promise<LoaderData> {
	return obterDadosKiosk();
}

export default function KioskRoute() {
	useKioskAutoRefresh();
	const data = useLoaderData<typeof loader>();

	return (
		<main className='mx-auto grid min-h-screen max-w-[520px] grid-cols-1 gap-2 bg-neutral-950 p-2 text-white sm:grid-cols-2 sm:p-3'>
			<div className='sm:col-span-2'>
				<ClockCard />
			</div>
			<WeatherCard data={data.weather} />
			<ConnectivityCard data={data.connectivity} />
			<div className='sm:col-span-2'>
				<LatestRacesCard data={data.ultimasCorridas} />
			</div>
		</main>
	);
}
