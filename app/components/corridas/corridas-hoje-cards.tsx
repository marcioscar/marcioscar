"use client";

import { WorkoutRunIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "~/components/ui/badge";
import type { LapAnotado, LapData } from "~/types/analise";
import type { CorridaDataTableRow } from "./corridas-columns";

function formatarDuracao(seg: number): string {
	const h = Math.floor(seg / 3600);
	const m = Math.floor((seg % 3600) / 60);
	const s = seg % 60;
	if (h > 0) {
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	}
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatarPace(seg: number): string {
	const min = Math.floor(seg / 60);
	const s = seg % 60;
	return `${min}'${s.toString().padStart(2, "0")}" /km`;
}

function mpsParaPaceStr(mps: number): string {
	if (!mps || mps < 1.0) return '—';
	const spk = 1000 / mps;
	const min = Math.floor(spk / 60);
	const seg = Math.round(spk % 60);
	return `${min}:${seg.toString().padStart(2, '0')}`;
}

function formatarDistancia(metros: number): string {
	return `${(metros / 1000).toFixed(2)} km`;
}

function getInicioSemana(): Date {
	const agora = new Date();
	agora.setUTCHours(0, 0, 0, 0);
	agora.setUTCDate(agora.getUTCDate() - agora.getUTCDay());
	return agora;
}

const TIPO_BG: Record<string, string> = {
	estimulo:       'bg-blue-500/10',
	principal:      'bg-emerald-500/10',
	aquecimento:    'bg-amber-500/10',
	desaquecimento: 'bg-amber-500/10',
	recuperacao:    'bg-muted/30',
}
const TIPO_TEXT: Record<string, string> = {
	estimulo:       'font-semibold text-blue-700 dark:text-blue-400',
	principal:      'font-semibold text-emerald-700 dark:text-emerald-400',
	aquecimento:    'text-amber-700 dark:text-amber-400',
	desaquecimento: 'text-amber-700 dark:text-amber-400',
	recuperacao:    'text-muted-foreground',
}

function LapsSemana({ laps, anotacoes }: { laps: LapData[]; anotacoes?: LapAnotado[] | null }) {
	const temAnotacao = anotacoes && anotacoes.length > 0;
	const distances = laps.map(l => l.distance);
	const distMin = Math.min(...distances);
	const distMax = Math.max(...distances);
	const isIntervals = distMax - distMin > 200;
	const threshold = (distMin + distMax) / 2;

	return (
		<div className='mt-2 overflow-x-auto'>
			<div className='flex gap-1 w-max'>
				{laps.map((lap, i) => {
					const anot = temAnotacao ? anotacoes!.find(a => a.lap_index === (lap.lap_index ?? i)) : null;
					const bg = anot ? (TIPO_BG[anot.tipo] ?? 'bg-muted/30') : (isIntervals && lap.distance >= threshold ? 'bg-blue-500/10' : 'bg-muted/30');
					const text = anot ? (TIPO_TEXT[anot.tipo] ?? 'text-muted-foreground') : (isIntervals && lap.distance >= threshold ? 'font-semibold text-blue-700 dark:text-blue-400' : 'text-muted-foreground');
					const topLabel = anot?.label ?? (lap.distance >= 950 ? `${(lap.distance / 1000).toFixed(2)}km` : `${Math.round(lap.distance)}m`);
					return (
						<div key={lap.lap_index ?? i} className={`flex flex-col items-center rounded-lg px-2 py-1 min-w-[38px] ${bg}`}>
							<span className='text-[9px] text-muted-foreground leading-none'>{topLabel}</span>
							<span className={`text-[11px] font-mono leading-tight tabular-nums ${text}`}>
								{mpsParaPaceStr(lap.average_speed)}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

type Props = {
	corridas: CorridaDataTableRow[];
};

export function CorridasHojeCards({ corridas }: Props) {
	if (corridas.length === 0) return null;

	const inicioSemana = getInicioSemana();
	const corridasAlvo = corridas
		.filter((c) => new Date(c.dataInicio) >= inicioSemana)
		.sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));

	if (corridasAlvo.length === 0) return null;

	return (
		<section className='grid gap-2'>
			<h2 className='text-lg font-semibold'>Corridas desta semana</h2>
			<div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
				{corridasAlvo.map((corrida) => {
					const hojeIso = new Date().toISOString().slice(0, 10);
					const isHoje = corrida.dataInicio.slice(0, 10) === hojeIso;
					return (
						<div
							key={corrida.stravaId}
							className='bg-card ring-foreground/10 flex items-center gap-4 overflow-hidden rounded-2xl p-4 ring-1'>
							<div className='bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full'>
								<HugeiconsIcon icon={WorkoutRunIcon} size={22} />
							</div>
							<div className='min-w-0 flex-1'>
								<div className='flex items-center gap-2'>
									<p className='truncate font-semibold'>{corrida.nome}</p>
									{isHoje && (
										<Badge className='shrink-0 text-xs' variant='outline'>
											Hoje
										</Badge>
									)}
								</div>
								<p className='text-muted-foreground text-sm'>
									{new Date(corrida.dataInicio).toLocaleString("pt-BR", {
										weekday: "short",
										day: "numeric",
										month: "short",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</p>
								<div className='mt-2 flex flex-wrap gap-1'>
									<Badge variant='secondary' className='font-mono text-xs'>
										{formatarDuracao(corrida.tempoMovimentoSeg)}
									</Badge>
									{corrida.distanciaMetros > 0 && (
										<Badge variant='secondary' className='font-mono text-xs'>
											{formatarDistancia(corrida.distanciaMetros)}
										</Badge>
									)}
									{corrida.paceMedioSegPorKm != null && (
										<Badge variant='secondary' className='font-mono text-xs'>
											{formatarPace(corrida.paceMedioSegPorKm)}
										</Badge>
									)}
								</div>

								{corrida.laps && corrida.laps.length > 1 && (
									<LapsSemana laps={corrida.laps} anotacoes={corrida.analise?.lapsAnotados} />
								)}
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
