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
import { Pencil } from "lucide-react";
import { cn } from "~/lib/utils";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { despesasColumns, type DespesaDataTableRow } from "./despesas-columns";
import { COR_PESSOA, PESSOAS_DESPESA } from "./despesa-options";

type DespesasDataTableProps = {
	data: DespesaDataTableRow[];
	onEditDespesa: (id: string) => void;
};

export function DespesasDataTable({
	data,
	onEditDespesa,
}: DespesasDataTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "data", desc: true },
	]);
	const [filtroNome, setFiltroNome] = React.useState("");
	const [filtroPessoa, setFiltroPessoa] = React.useState<string | null>(null);
	const dataFiltrada = React.useMemo(
		() =>
			filtroPessoa ? data.filter((d) => d.pessoa === filtroPessoa) : data,
		[data, filtroPessoa],
	);
	const columns = React.useMemo<ColumnDef<DespesaDataTableRow>[]>(
		() => [
			...despesasColumns,
			{
				id: "acoes",
				header: "",
				cell: ({ row }) => (
					<Button
						type='button'
						variant='ghost'
						size='icon-sm'
						aria-label={`Editar ${row.original.nome}`}
						onClick={(event) => {
							event.stopPropagation();
							onEditDespesa(row.original.id);
						}}>
						<Pencil size={14} className='text-muted-foreground' />
					</Button>
				),
				enableSorting: false,
			},
		],
		[onEditDespesa],
	);

	const table = useReactTable({
		data: dataFiltrada,
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
			const pessoa = String(row.original.pessoa ?? "").toLowerCase();
			return (
				nome.includes(termo) ||
				categoria.includes(termo) ||
				pessoa.includes(termo)
			);
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
		<div className='grid min-w-0 gap-3'>
			<div
				role='group'
				aria-label='Filtrar por pessoa'
				className='flex flex-wrap items-center gap-1.5'>
				{[null, ...PESSOAS_DESPESA].map((pessoa) => {
					const ativa = filtroPessoa === pessoa;
					const cor = pessoa ? COR_PESSOA[pessoa] : "var(--foreground)";
					return (
						<button
							key={pessoa ?? "todos"}
							type='button'
							aria-pressed={ativa}
							onClick={() => setFiltroPessoa(pessoa)}
							className={cn(
								"inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors hover:bg-accent",
							)}
							style={
								ativa
									? {
											color: cor,
											borderColor: cor,
											background: `color-mix(in oklch, ${cor} 12%, transparent)`,
											fontWeight: 500,
										}
									: undefined
							}>
							{pessoa ?? "Todos"}
						</button>
					);
				})}
			</div>

			<div className='flex flex-wrap items-center justify-between gap-2'>
				<Input
					value={filtroNome}
					onChange={(event) => setFiltroNome(event.target.value)}
					placeholder='Procurar por nome, categoria ou pessoa...'
					className='w-full sm:max-w-sm'
				/>
				<p className='text-sm text-muted-foreground'>
					{table.getFilteredRowModel().rows.length} despesa(s)
				</p>
			</div>

			<div className='min-w-0 overflow-hidden rounded-md border'>
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
									onClick={() => onEditDespesa(row.original.id)}>
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
					Próxima
				</Button>
			</div>
		</div>
	);
}
