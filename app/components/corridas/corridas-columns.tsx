"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

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
};

function formatarData(dataIso: string): string {
	return new Date(dataIso).toLocaleString("pt-BR");
}

function formatarDistanciaKm(distanciaMetros: number): string {
	return `${(distanciaMetros / 1000).toFixed(2)} km`;
}

type CategoriaDistancia = "Maratona" | "Meia" | null;

function obterCategoriaDistancia(distanciaMetros: number): CategoriaDistancia {
	const distanciaKm = distanciaMetros / 1000;

	if (distanciaKm > 40) {
		return "Maratona";
	}

	if (distanciaKm >= 20 && distanciaKm <= 23) {
		return "Meia";
	}

	return null;
}

function renderBadgeCategoria(distanciaMetros: number): ReactNode {
	const categoria = obterCategoriaDistancia(distanciaMetros);

	if (!categoria) {
		return "--";
	}

	return (
		<Badge variant='outline' className='bg-primary/10 text-primary'>
			{categoria}
		</Badge>
	);
}

function formatarElevacaoMetros(elevacaoMetros: number): string {
	return `${elevacaoMetros.toFixed(0)} m`;
}

function formatarTempo(segundosTotais: number): string {
	const horas = Math.floor(segundosTotais / 3600);
	const minutos = Math.floor((segundosTotais % 3600) / 60);
	const segundos = segundosTotais % 60;

	const hh = String(horas).padStart(2, "0");
	const mm = String(minutos).padStart(2, "0");
	const ss = String(segundos).padStart(2, "0");

	return `${hh}:${mm}:${ss}`;
}

function formatarPace(segundosPorKm: number | null): string {
	if (!segundosPorKm || segundosPorKm <= 0) {
		return "--";
	}

	const minutos = Math.floor(segundosPorKm / 60);
	const segundos = segundosPorKm % 60;
	const ss = String(segundos).padStart(2, "0");
	return `${minutos}:${ss} /km`;
}

function sortableHeader(titulo: string, onToggle: () => void): ReactNode {
	return (
		<Button variant='ghost' size='sm' onClick={onToggle}>
			{titulo}
		</Button>
	);
}

export const corridasColumns: ColumnDef<CorridaDataTableRow>[] = [
	{
		id: "select",
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				onCheckedChange={(value) =>
					table.toggleAllPageRowsSelected(Boolean(value))
				}
				aria-label='Selecionar todas as corridas da pagina'
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
				aria-label='Selecionar corrida'
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		accessorKey: "dataInicio",
		header: ({ column }) =>
			sortableHeader("Data", () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
		cell: ({ row }) => formatarData(row.original.dataInicio),
	},
	{
		accessorKey: "nome",
		header: ({ column }) =>
			sortableHeader("Nome", () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
	},
	{
		accessorKey: "distanciaMetros",
		header: ({ column }) =>
			sortableHeader("Distancia", () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
		cell: ({ row }) => formatarDistanciaKm(row.original.distanciaMetros),
	},
	{
		id: "categoriaDistancia",
		header: "Categoria",
		cell: ({ row }) => renderBadgeCategoria(row.original.distanciaMetros),
	},
	{
		accessorKey: "elevacaoGanhoMetros",
		header: ({ column }) =>
			sortableHeader("Ganho elevacao", () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
		cell: ({ row }) => formatarElevacaoMetros(row.original.elevacaoGanhoMetros),
	},
	{
		accessorKey: "tempoMovimentoSeg",
		header: ({ column }) =>
			sortableHeader("Tempo", () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
		cell: ({ row }) => formatarTempo(row.original.tempoMovimentoSeg),
	},
	{
		accessorKey: "paceMedioSegPorKm",
		header: ({ column }) =>
			sortableHeader("Pace medio", () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
		cell: ({ row }) => formatarPace(row.original.paceMedioSegPorKm),
	},
];
