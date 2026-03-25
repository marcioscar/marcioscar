"use client";

import * as React from "react";
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { criarBibliotecaColumns, type LivroDataTableRow } from "./biblioteca-columns";
import { BibliotecaEditDialog } from "./biblioteca-edit-dialog";
import { BibliotecaNovoDialog } from "./biblioteca-novo-dialog";

type BibliotecaDataTableProps = {
	livros: LivroDataTableRow[];
};

function textoBuscaLivro(livro: LivroDataTableRow): string {
	return [
		livro.nome,
		livro.autor,
		livro.paginas != null ? String(livro.paginas) : "",
		livro.citacao,
		livro.nota,
		livro.capa,
	]
		.join(" ")
		.toLowerCase();
}

export function BibliotecaDataTable({ livros }: BibliotecaDataTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "data", desc: true },
	]);
	const [filtroBusca, setFiltroBusca] = React.useState("");
	const [idEdicao, setIdEdicao] = React.useState<string | null>(null);
	const [novoAberto, setNovoAberto] = React.useState(false);

	const livroEmEdicao = React.useMemo(() => {
		if (!idEdicao) {
			return null;
		}
		return livros.find((l) => l.id === idEdicao) ?? null;
	}, [livros, idEdicao]);

	React.useEffect(() => {
		if (idEdicao && !livros.some((l) => l.id === idEdicao)) {
			setIdEdicao(null);
		}
	}, [livros, idEdicao]);

	const columns = React.useMemo(
		() => criarBibliotecaColumns((livro) => setIdEdicao(livro.id)),
		[],
	);

	const table = useReactTable({
		data: livros,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		globalFilterFn: (row, _columnId, filterValue: string) => {
			const termo = filterValue.trim().toLowerCase();
			if (!termo) {
				return true;
			}
			return textoBuscaLivro(row.original).includes(termo);
		},
		state: {
			sorting,
			globalFilter: filtroBusca,
		},
		onGlobalFilterChange: setFiltroBusca,
		getRowId: (row) => row.id,
		initialState: {
			pagination: { pageSize: 10 },
		},
	});

	const dialogAberto = livroEmEdicao !== null;

	return (
		<div className="flex w-full min-w-0 flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:flex-1">
					<Input
						value={filtroBusca}
						onChange={(e) => setFiltroBusca(e.target.value)}
						placeholder="Pesquisar por nome, autor, citação, nota ou capa…"
						className="min-w-0 flex-1 sm:max-w-md"
					/>
					<Button type="button" size="sm" onClick={() => setNovoAberto(true)}>
						<HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
						Novo livro
					</Button>
				</div>
				<p className="text-sm text-muted-foreground">
					{table.getFilteredRowModel().rows.length} livro(s)
				</p>
			</div>

			<div className="overflow-hidden rounded-md border">
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
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="text-muted-foreground h-24 text-center">
									Nenhum livro cadastrado ou nenhum resultado para a pesquisa.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm text-muted-foreground">
					Página {table.getState().pagination.pageIndex + 1} de{" "}
					{table.getPageCount() || 1}
				</p>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						type="button"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}>
						Anterior
					</Button>
					<Button
						variant="outline"
						size="sm"
						type="button"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}>
						Próxima
					</Button>
				</div>
			</div>

			<BibliotecaEditDialog
				livro={livroEmEdicao}
				open={dialogAberto}
				onOpenChange={(aberto) => {
					if (!aberto) {
						setIdEdicao(null);
					}
				}}
			/>

			<BibliotecaNovoDialog open={novoAberto} onOpenChange={setNovoAberto} />
		</div>
	);
}
