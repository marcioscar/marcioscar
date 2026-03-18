"use client";

import * as React from "react";
import {
	type RowSelectionState,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
	type SortingState,
} from "@tanstack/react-table";

import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { corridasColumns, type CorridaDataTableRow } from "./corridas-columns";

const CorridasMap = React.lazy(async () => {
	const mod = await import("./corridas-map");
	return { default: mod.CorridasMap };
});

const CorridasGlobo = React.lazy(async () => {
	const mod = await import("./corridas-globo");
	return { default: mod.CorridasGlobo };
});

type CorridasDataTableProps = {
	data: CorridaDataTableRow[];
	mapboxToken: string | null;
};

type DistanciaFaixa = {
	id: number;
	label: string;
	minKm: number | null;
	maxKm: number | null;
};

const FAIXAS_DISTANCIA: DistanciaFaixa[] = [
	{ id: 0, label: "Todas as corridas", minKm: null, maxKm: null },
	{ id: 1, label: "Ate 10km", minKm: 0, maxKm: 10 },
	{ id: 2, label: "10 a 20km", minKm: 10, maxKm: 20 },
	{ id: 3, label: "21 a 22km (meia)", minKm: 21, maxKm: 22 },
	{ id: 4, label: "22 a 40km", minKm: 22, maxKm: 40 },
	{ id: 5, label: "40km+", minKm: 40, maxKm: null },
];

function extrairPolylinesSelecionadas(
	linhas: CorridaDataTableRow[],
	rowSelection: RowSelectionState,
): string[] {
	return linhas
		.filter((linha) => rowSelection[String(linha.stravaId)])
		.map((linha) => linha.summaryPolyline)
		.filter((polyline): polyline is string => Boolean(polyline));
}

function filtrarPorFaixaDistancia(
	linhas: CorridaDataTableRow[],
	faixa: DistanciaFaixa,
): CorridaDataTableRow[] {
	if (faixa.minKm === null && faixa.maxKm === null) {
		return linhas;
	}

	return linhas.filter((linha) => {
		const distanciaKm = linha.distanciaMetros / 1000;
		const dentroDoMinimo =
			faixa.minKm === null ? true : distanciaKm >= faixa.minKm;
		const dentroDoMaximo =
			faixa.maxKm === null ? true : distanciaKm < faixa.maxKm;
		return dentroDoMinimo && dentroDoMaximo;
	});
}

function filtrarCorridasParaGlobo(
	linhas: CorridaDataTableRow[],
): CorridaDataTableRow[] {
	return linhas.filter((linha) => {
		const distanciaKm = linha.distanciaMetros / 1000;
		const isMaratona = distanciaKm > 40;
		return isMaratona;
	});
}

function normalizarValorSlider(value: number | readonly number[]): number {
	if (typeof value === "number") {
		return value;
	}

	return value[0] ?? 0;
}

function normalizarTextoBusca(value: string): string {
	return value.trim().toLocaleLowerCase("pt-BR");
}

function formatarDataParaInput(dataIso: string): string {
	const data = new Date(dataIso);
	if (Number.isNaN(data.getTime())) {
		return "";
	}

	return data.toISOString().slice(0, 10);
}

function filtrarPorNomeOuData(
	linhas: CorridaDataTableRow[],
	nomeBusca: string,
	dataBusca: string,
): CorridaDataTableRow[] {
	const nomeBuscaNormalizado = normalizarTextoBusca(nomeBusca);
	const dataBuscaNormalizada = dataBusca.trim();

	if (!nomeBuscaNormalizado && !dataBuscaNormalizada) {
		return linhas;
	}

	return linhas.filter((linha) => {
		const nomeLinhaNormalizado = normalizarTextoBusca(linha.nome);
		const dataLinha = formatarDataParaInput(linha.dataInicio);
		const correspondeNome = nomeBuscaNormalizado
			? nomeLinhaNormalizado.includes(nomeBuscaNormalizado)
			: true;
		const correspondeData = dataBuscaNormalizada
			? dataLinha === dataBuscaNormalizada
			: true;

		return correspondeNome && correspondeData;
	});
}

export function CorridasDataTable({ data, mapboxToken }: CorridasDataTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: "dataInicio", desc: true },
	]);
	const [faixaSelecionadaId, setFaixaSelecionadaId] = React.useState(0);
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
	const [nomeBusca, setNomeBusca] = React.useState("");
	const [dataBusca, setDataBusca] = React.useState("");
	const faixaSelecionada = FAIXAS_DISTANCIA[faixaSelecionadaId];
	const dadosFiltradosFaixa = React.useMemo(
		() => filtrarPorFaixaDistancia(data, faixaSelecionada),
		[data, faixaSelecionada],
	);
	const dadosFiltrados = React.useMemo(
		() => filtrarPorNomeOuData(dadosFiltradosFaixa, nomeBusca, dataBusca),
		[dadosFiltradosFaixa, nomeBusca, dataBusca],
	);

	const table = useReactTable({
		data: dadosFiltrados,
		columns: corridasColumns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		onRowSelectionChange: setRowSelection,
		getRowId: (row) => String(row.stravaId),
		state: { sorting, rowSelection },
		initialState: {
			pagination: {
				pageSize: 10,
			},
		},
	});

	const polylinesSelecionadas = React.useMemo(
		() => extrairPolylinesSelecionadas(dadosFiltrados, rowSelection),
		[dadosFiltrados, rowSelection],
	);
	const corridasParaGlobo = React.useMemo(() => filtrarCorridasParaGlobo(data), [data]);

	return (
		<div className='flex w-full min-w-0 flex-col gap-4'>
			<div className='rounded-md border p-3'>
				<div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
					<p className='text-sm font-medium'>Filtro de distancia</p>
					<p className='text-sm text-muted-foreground'>{faixaSelecionada.label}</p>
				</div>
				<Slider
					value={[faixaSelecionadaId]}
					onValueChange={(value) => {
						const proximaFaixaId = normalizarValorSlider(value);
						setFaixaSelecionadaId(proximaFaixaId);
						setRowSelection({});
						table.setPageIndex(0);
					}}
					min={0}
					max={FAIXAS_DISTANCIA.length - 1}
					step={1}
				/>
				<div className='mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground'>
					{FAIXAS_DISTANCIA.map((faixa) => (
						<span key={faixa.id}>{faixa.label}</span>
					))}
				</div>
			</div>

			<div className='grid gap-2 rounded-md border p-3 sm:grid-cols-2'>
				<label className='grid gap-1 text-sm'>
					Procurar por nome
					<input
						type='text'
						value={nomeBusca}
						onChange={(event) => {
							setNomeBusca(event.target.value);
							setRowSelection({});
							table.setPageIndex(0);
						}}
						placeholder='Ex.: longao, treino, maratona...'
						className='border-input bg-background rounded-md border px-3 py-2'
					/>
				</label>

				<label className='grid gap-1 text-sm'>
					Procurar por data
					<input
						type='date'
						value={dataBusca}
						onChange={(event) => {
							setDataBusca(event.target.value);
							setRowSelection({});
							table.setPageIndex(0);
						}}
						className='border-input bg-background rounded-md border px-3 py-2'
					/>
				</label>
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
								<TableRow key={row.id}>
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
								<TableCell colSpan={corridasColumns.length}>
									Nenhuma corrida sincronizada ainda.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
				<p className='text-sm text-muted-foreground'>
					{table.getRowModel().rows.length} linha(s) nesta pagina,{" "}
					{dadosFiltrados.length} apos busca, {dadosFiltradosFaixa.length} na faixa selecionada,{" "}
					{data.length} no total.{" "}
					{Object.keys(rowSelection).length} selecionada(s).
				</p>
				<div className='flex items-center gap-2 self-start sm:self-auto'>
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

			<React.Suspense
				fallback={
					<div className='rounded-md border p-3 text-sm text-muted-foreground'>
						Carregando mapa...
					</div>
				}>
				<div className='w-full min-w-0'>
					<CorridasMap mapboxToken={mapboxToken} polylines={polylinesSelecionadas} />
				</div>
			</React.Suspense>

			<React.Suspense
				fallback={
					<div className='rounded-md border p-3 text-sm text-muted-foreground'>
						Carregando globo...
					</div>
				}>
				<div className='w-full min-w-0'>
					<CorridasGlobo corridasFiltradas={corridasParaGlobo} />
				</div>
			</React.Suspense>
		</div>
	);
}
