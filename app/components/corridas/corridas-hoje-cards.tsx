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
	estimulo:       'bg-lime-500/10',
	principal:      'bg-lime-500/10',
	aquecimento:    'bg-muted/40',
	desaquecimento: 'bg-muted/40',
	recuperacao:    '',
}
const TIPO_TEXT: Record<string, string> = {
	estimulo:       'font-semibold text-lime-700 dark:text-lime-500',
	principal:      'font-semibold text-lime-700 dark:text-lime-500',
	aquecimento:    'text-muted-foreground',
	desaquecimento: 'text-muted-foreground',
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
		<div className='max-h-52 overflow-y-auto'>
			<table className='w-full text-xs'>
				<thead className='sticky top-0 bg-card border-b border-border'>
					<tr>
						<th className='text-left px-3 py-1.5 font-medium text-muted-foreground'>Volta</th>
						{temAnotacao && <th className='text-right px-3 py-1.5 font-medium text-muted-foreground'>Prescrito</th>}
						<th className='text-right px-3 py-1.5 font-medium text-muted-foreground'>Real</th>
					</tr>
				</thead>
				<tbody className='divide-y divide-border'>
					{laps.map((lap, i) => {
						const anot = temAnotacao ? anotacoes!.find(a => a.lap_index === (lap.lap_index ?? i)) : null;
						const isWork = !temAnotacao && isIntervals && lap.distance >= threshold;
						const tipo = anot?.tipo;
						const dist = lap.distance >= 950
							? `${(lap.distance / 1000).toFixed(1)}km`
							: `${Math.round(lap.distance)}m`;
						const label = anot?.label ?? dist;
						const subLabel = anot ? dist : null;
						const paceReal = mpsParaPaceStr(lap.average_speed);
						const labelCls = tipo
							? (TIPO_TEXT[tipo] ?? 'text-muted-foreground')
							: isWork ? 'font-semibold text-lime-700 dark:text-lime-500' : 'text-muted-foreground';
						const rowBg = tipo
							? (TIPO_BG[tipo] ?? '')
							: isWork ? 'bg-lime-500/10' : '';

						return (
							<tr key={lap.lap_index ?? i} className={`${rowBg} hover:bg-muted/20 transition-colors`}>
								<td className='px-3 py-1.5'>
									<span className={labelCls}>{label}</span>
									{subLabel && <span className='ml-1 text-muted-foreground font-normal'>({subLabel})</span>}
								</td>
								{temAnotacao && (
									<td className='px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground'>
										{anot?.meta ?? '—'}
									</td>
								)}
								<td className={`px-3 py-1.5 text-right font-mono tabular-nums ${paceReal === '—' ? 'text-muted-foreground' : labelCls}`}>
									{paceReal}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
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
					const temLaps = corrida.laps && corrida.laps.length > 1;
					return (
						<div
							key={corrida.stravaId}
							className='bg-card ring-foreground/10 overflow-hidden rounded-2xl ring-1'>

							{/* Cabeçalho do card */}
							<div className='flex items-start gap-4 p-4'>
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
								</div>
							</div>

							{/* Tabela de laps: largura total, separada por borda */}
							{temLaps && (
								<div className='border-t border-border'>
									<LapsSemana laps={corrida.laps!} anotacoes={corrida.analise?.lapsAnotados} />
								</div>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}
