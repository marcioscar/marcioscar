"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";

export type DespesaDataTableRow = {
	id: string;
	data: string;
	nome: string;
	categoria: string;
	conta: string;
	fatura: string | null;
	valor: number;
	brassaco: boolean;
	comprovante: string;
};

function formatarData(dataIso: string): string {
	const [ano, mes, dia] = dataIso.slice(0, 10).split("-");
	if (!ano || !mes || !dia) {
		return "--";
	}

	return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor: number): string {
	return valor.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}

function getSortIndicator(sortState: false | "asc" | "desc"): string {
	if (sortState === "asc") {
		return "↑";
	}

	if (sortState === "desc") {
		return "↓";
	}

	return "↕";
}

function sortableHeader(
	titulo: string,
	sortState: false | "asc" | "desc",
	onToggle: () => void,
) {
	return (
		<Button variant='ghost' size='sm' onClick={onToggle}>
			{titulo} {getSortIndicator(sortState)}
		</Button>
	);
}

export const despesasColumns: ColumnDef<DespesaDataTableRow>[] = [
	{
		accessorKey: "data",
		header: ({ column }) =>
			sortableHeader("Data", column.getIsSorted(), () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
		cell: ({ row }) => formatarData(row.original.data),
	},
	{
		accessorKey: "nome",
		header: ({ column }) =>
			sortableHeader("Nome", column.getIsSorted(), () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
	},
	{
		accessorKey: "categoria",
		header: ({ column }) =>
			sortableHeader("Categoria", column.getIsSorted(), () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
	},
	{
		accessorKey: "conta",
		header: ({ column }) =>
			sortableHeader("Conta", column.getIsSorted(), () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
	},
	{
		accessorKey: "valor",
		header: ({ column }) =>
			sortableHeader("Valor", column.getIsSorted(), () =>
				column.toggleSorting(column.getIsSorted() === "asc"),
			),
		cell: ({ row }) => formatarMoeda(row.original.valor),
	},
	{
		accessorKey: "comprovante",
		header: "Comprovante",
		cell: ({ row }) =>
			row.original.comprovante ? (
				<a
					href={row.original.comprovante}
					target='_blank'
					rel='noreferrer'
					className='text-primary underline'>
					Abrir
				</a>
			) : (
				<span className='text-muted-foreground'>--</span>
			),
	},
];
