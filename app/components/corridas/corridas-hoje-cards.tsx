"use client";

import { WorkoutRunIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "~/components/ui/badge";
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

function formatarDistancia(metros: number): string {
	return `${(metros / 1000).toFixed(2)} km`;
}

function getInicioSemana(): Date {
	const agora = new Date();
	agora.setUTCHours(0, 0, 0, 0);
	agora.setUTCDate(agora.getUTCDate() - agora.getUTCDay());
	return agora;
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
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
