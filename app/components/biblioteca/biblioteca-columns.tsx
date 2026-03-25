"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type LivroDataTableRow = {
	id: string;
	nome: string;
	data: string;
	capa: string;
	citacao: string;
	nota: string;
	autor: string;
	paginas: number | null;
};

function celulaTextoFlexivel(texto: string) {
	const t = texto.trim();
	if (!t) {
		return <span className="text-muted-foreground">—</span>;
	}
	return (
		<span
			className="inline-block max-w-[10rem] truncate align-middle sm:max-w-[14rem] md:max-w-[18rem] lg:max-w-[22rem] xl:max-w-xs 2xl:max-w-sm"
			title={t}>
			{t}
		</span>
	);
}

function formatarData(dataIso: string): string {
	const d = new Date(dataIso);
	if (Number.isNaN(d.getTime())) {
		return "--";
	}
	return d.toLocaleDateString("pt-BR");
}

function encurtarTexto(texto: string, max: number): string {
	const t = texto.trim();
	if (t.length <= max) {
		return t;
	}
	return `${t.slice(0, max - 1)}…`;
}

function ehUrlHttp(texto: string): boolean {
	return /^https?:\/\//i.test(texto.trim());
}

function renderLinkExterno(href: string, ariaLabel: string) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className={cn(
				buttonVariants({ variant: "ghost", size: "icon-sm" }),
				"inline-flex shrink-0",
			)}
			aria-label={ariaLabel}>
			<HugeiconsIcon icon={LinkSquare02Icon} data-icon="inline-start" />
		</a>
	);
}

function renderTextoOuLinkUrl(
	valor: string,
	rotuloLink: string,
	maxTexto: number,
	larguraMax: string,
) {
	const v = valor.trim();
	if (!v) {
		return <span className="text-muted-foreground">—</span>;
	}
	if (ehUrlHttp(v)) {
		return renderLinkExterno(v, `Abrir ${rotuloLink} em nova aba`);
	}
	return (
		<span className={cn("truncate", larguraMax)} title={v}>
			{encurtarTexto(v, maxTexto)}
		</span>
	);
}

function renderCapa(capa: string) {
	const valor = capa.trim();
	if (!valor) {
		return <span className="text-muted-foreground">—</span>;
	}
	const urlSegura = /^https?:\/\//i.test(valor);
	if (urlSegura) {
		return (
			<img
				src={valor}
				alt=""
				className="h-10 max-w-[48px] rounded-md object-cover"
				loading="lazy"
			/>
		);
	}
	return (
		<span className="max-w-[100px] truncate" title={valor}>
			{encurtarTexto(valor, 24)}
		</span>
	);
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
		<Button variant="ghost" size="sm" onClick={onToggle}>
			{titulo} {getSortIndicator(sortState)}
		</Button>
	);
}

export function criarBibliotecaColumns(
	onEditar: (livro: LivroDataTableRow) => void,
): ColumnDef<LivroDataTableRow>[] {
	return [
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
			cell: ({ row }) => celulaTextoFlexivel(row.original.nome),
		},
		{
			accessorKey: "autor",
			header: ({ column }) =>
				sortableHeader("Autor", column.getIsSorted(), () =>
					column.toggleSorting(column.getIsSorted() === "asc"),
				),
			cell: ({ row }) => celulaTextoFlexivel(row.original.autor),
		},
		{
			accessorKey: "paginas",
			header: ({ column }) =>
				sortableHeader("Pág.", column.getIsSorted(), () =>
					column.toggleSorting(column.getIsSorted() === "asc"),
				),
			cell: ({ row }) => {
				const p = row.original.paginas;
				if (p == null) {
					return <span className="text-muted-foreground">—</span>;
				}
				return (
					<span className="tabular-nums">{p.toLocaleString("pt-BR")}</span>
				);
			},
			sortingFn: (rowA, rowB, columnId) => {
				const a = rowA.getValue<number | null>(columnId);
				const b = rowB.getValue<number | null>(columnId);
				const na = a ?? -1;
				const nb = b ?? -1;
				return na === nb ? 0 : na < nb ? -1 : 1;
			},
		},
		{
			accessorKey: "capa",
			header: "Capa",
			cell: ({ row }) => renderCapa(row.original.capa),
			enableSorting: false,
		},
		{
			accessorKey: "citacao",
			header: "Citação",
			cell: ({ row }) =>
				renderTextoOuLinkUrl(row.original.citacao, "citação", 80, "max-w-[200px]"),
			enableSorting: false,
		},
		{
			accessorKey: "nota",
			header: "Nota",
			cell: ({ row }) =>
				renderTextoOuLinkUrl(row.original.nota, "nota", 60, "max-w-[160px]"),
			enableSorting: false,
		},
		{
			id: "acoes",
			header: "",
			cell: ({ row }) => (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={`Editar ${row.original.nome}`}
					onClick={() => onEditar(row.original)}>
					<HugeiconsIcon icon={PencilEdit02Icon} data-icon="inline-start" />
				</Button>
			),
			enableSorting: false,
		},
	];
}
