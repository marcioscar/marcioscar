"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import type { AnaliseResult, SplitMetric, LapData } from "~/types/analise";

export type CorridaDataTableRow = {
	stravaId: number;
	summaryPolyline: string | null;
	localLat: number | null;
	localLng: number | null;
	nome: string;
	distanciaMetros: number;
	elevacaoGanhoMetros: number;
	tempoMovimentoSeg: number;
	paceMedioSegPorKm: number | null;
	dataInicio: string;
	splits: SplitMetric[] | null;
	laps: LapData[] | null;
	analise: AnaliseResult | null;
	analisadaEm: string | null;
};

function formatarData(dataIso: string): string {
	return new Date(dataIso).toLocaleString("pt-BR");
}

function formatarDistanciaKm(distanciaMetros: number): string {
	return `${(distanciaMetros / 1000).toFixed(2)} km`;
}

function formatarElevacaoMetros(elevacaoMetros: number): string {
	return `${elevacaoMetros.toFixed(0)} m`;
}

function formatarTempo(segundosTotais: number): string {
	const horas = Math.floor(segundosTotais / 3600);
	const minutos = Math.floor((segundosTotais % 3600) / 60);
	const segundos = segundosTotais % 60;
	return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

function formatarPace(segundosPorKm: number | null): string {
	if (!segundosPorKm || segundosPorKm <= 0) return "--";
	const minutos = Math.floor(segundosPorKm / 60);
	const segundos = segundosPorKm % 60;
	return `${minutos}:${String(segundos).padStart(2, "0")} /km`;
}

function getSortIndicator(sortState: false | "asc" | "desc"): string {
	if (sortState === "asc") return "↑";
	if (sortState === "desc") return "↓";
	return "↕";
}

function sortableHeader(titulo: string, sortState: false | "asc" | "desc", onToggle: () => void): ReactNode {
	return (
		<Button variant='ghost' size='sm' onClick={onToggle}>
			{titulo} {getSortIndicator(sortState)}
		</Button>
	);
}

export const corridasColumns: ColumnDef<CorridaDataTableRow>[] = [
	{
		id: "select",
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
				aria-label='Selecionar todas as corridas da pagina'
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
				aria-label='Selecionar corrida'
				onClick={(e) => e.stopPropagation()}
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		accessorKey: "dataInicio",
		header: ({ column }) =>
			sortableHeader("Data", column.getIsSorted(), () => column.toggleSorting(column.getIsSorted() === "asc")),
		cell: ({ row }) => formatarData(row.original.dataInicio),
	},
	{
		id: "analise",
		header: () => <span className='text-xs font-medium text-muted-foreground'>Análise</span>,
		cell: ({ row }) => {
			const analise = row.original.analise
			if (!analise) return null
			const BADGE: Record<string, string> = {
				excelente: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
				bom:       'bg-blue-500/10 text-blue-700 dark:text-blue-400',
				regular:   'bg-amber-500/10 text-amber-700 dark:text-amber-400',
				ruim:      'bg-red-500/10 text-red-700 dark:text-red-400',
			}
			const cls = BADGE[analise.avaliacao] ?? BADGE.regular
			return (
				<div className='flex flex-col gap-0.5 min-w-[80px]'>
					<span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
						{analise.avaliacao}
					</span>
					<span className='text-[10px] text-muted-foreground leading-tight'>
						{analise.tipoSessao}
					</span>
				</div>
			)
		},
		enableSorting: false,
	},
	{
		accessorKey: "distanciaMetros",
		header: ({ column }) =>
			sortableHeader("Distancia", column.getIsSorted(), () => column.toggleSorting(column.getIsSorted() === "asc")),
		cell: ({ row }) => formatarDistanciaKm(row.original.distanciaMetros),
	},
	{
		accessorKey: "elevacaoGanhoMetros",
		header: ({ column }) =>
			sortableHeader("Elevacao", column.getIsSorted(), () => column.toggleSorting(column.getIsSorted() === "asc")),
		cell: ({ row }) => formatarElevacaoMetros(row.original.elevacaoGanhoMetros),
	},
	{
		accessorKey: "tempoMovimentoSeg",
		header: ({ column }) =>
			sortableHeader("Tempo", column.getIsSorted(), () => column.toggleSorting(column.getIsSorted() === "asc")),
		cell: ({ row }) => formatarTempo(row.original.tempoMovimentoSeg),
	},
	{
		accessorKey: "paceMedioSegPorKm",
		header: ({ column }) =>
			sortableHeader("Pace medio", column.getIsSorted(), () => column.toggleSorting(column.getIsSorted() === "asc")),
		cell: ({ row }) => formatarPace(row.original.paceMedioSegPorKm),
	},
];
