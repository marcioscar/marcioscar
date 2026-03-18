"use client";

import * as React from "react";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";

import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { despesasColumns, type DespesaDataTableRow } from "./despesas-columns";

type DespesasDataTableProps = {
	data: DespesaDataTableRow[];
	selectedDespesaId: string | null;
	onSelectDespesaId: (id: string | null) => void;
};

export function DespesasDataTable({
	data,
	selectedDespesaId,
	onSelectDespesaId,
}: DespesasDataTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "data", desc: true },
	]);
	const [filtroNome, setFiltroNome] = React.useState("");
	const toggleSelecaoDespesa = React.useCallback(
		(id: string) => {
			onSelectDespesaId(selectedDespesaId === id ? null : id);
		},
		[onSelectDespesaId, selectedDespesaId],
	);
	const columns = React.useMemo<ColumnDef<DespesaDataTableRow>[]>(
		() => [
			{
				id: "select",
				header: "",
				cell: ({ row }) => (
					<Checkbox
						checked={row.original.id === selectedDespesaId}
						onClick={(event) => event.stopPropagation()}
						onCheckedChange={() => toggleSelecaoDespesa(row.original.id)}
						aria-label='Selecionar despesa'
					/>
				),
				enableSorting: false,
			},
			...despesasColumns,
		],
		[selectedDespesaId, toggleSelecaoDespesa],
	);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		onGlobalFilterChange: setFiltroNome,
		getRowId: (row) => row.id,
		globalFilterFn: (row, _columnId, filterValue: string) => {
			const termo = filterValue.trim().toLowerCase();
			if (!termo) {
				return true;
			}

			const nome = String(row.original.nome ?? "").toLowerCase();
			const categoria = String(row.original.categoria ?? "").toLowerCase();
			return nome.includes(termo) || categoria.includes(termo);
		},
		state: {
			sorting,
			globalFilter: filtroNome,
		},
		initialState: {
			pagination: {
				pageSize: 10,
			},
		},
	});

	return (
		<div className='grid gap-3'>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<Input
					value={filtroNome}
					onChange={(event) => setFiltroNome(event.target.value)}
					placeholder='Procurar por nome ou categoria...'
					className='w-full sm:max-w-sm'
				/>
				<p className='text-sm text-muted-foreground'>
					{table.getFilteredRowModel().rows.length} despesa(s)
				</p>
			</div>

			<div className='overflow-hidden rounded-md border'>
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length > 0 ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									className='cursor-pointer'
									data-state={
										row.original.id === selectedDespesaId
											? "selected"
											: undefined
									}
									onClick={() => toggleSelecaoDespesa(row.original.id)}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length}>
									Nenhuma despesa encontrada.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className='flex items-center justify-end gap-2'>
				<Button
					variant='outline'
					size='sm'
					onClick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}>
					Anterior
				</Button>
				<Button
					variant='outline'
					size='sm'
					onClick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}>
					Proxima
				</Button>
			</div>
		</div>
	);
}
