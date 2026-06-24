import type { Route } from "./+types/home";
import {
	Form,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	buscarUltimaAtualizacaoCorridas,
	contarCorridasSalvas,
	listarUltimasCorridas,
	listarMaratonasParaGraficoBarras,
	sincronizarCorridasDoStrava,
	type CorridaResumo,
} from "~/models/corridas.server";
import type { MaratonaBarrasDado } from "~/types/maratonas-barras";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	FilterHorizontalIcon,
	ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CorridasDataTable } from "~/components/corridas/corridas-data-table";
import type { CorridaDataTableRow } from "~/components/corridas/corridas-columns";
import { CorridasGraficosChart } from "~/components/corridas/corridas-graficos-chart";
import { CorridasHojeCards } from "~/components/corridas/corridas-hoje-cards";
import { CorridasSemanaChart } from "~/components/corridas/corridas-semana-chart";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Marcioscar" },
		{ name: "description", content: "Marcioscar" },
	];
}

type ActionData = {
	ok: boolean;
	message: string;
	totalRecebidas?: number;
	totalSincronizadas?: number;
	modo?: "incremental" | "full";
	afterUsado?: number;
};

type LoaderData = {
	totalCorridas: number;
	totalCorridasFiltradas: number;
	ultimaAtualizacao: string | null;
	mapboxToken: string | null;
	ultimasCorridas: CorridaResumo[];
	maratonasGraficoBarras: MaratonaBarrasDado[];
	filtroDataInicio: string;
	filtroDataFim: string;
};

function parseNumberFromFormData(
	formData: FormData,
	fieldName: string,
	defaultValue: number,
): number {
	const raw = formData.get(fieldName);
	const parsed = Number(raw);

	if (!Number.isFinite(parsed) || parsed <= 0) {
		return defaultValue;
	}

	return Math.floor(parsed);
}

function parseModoSync(formData: FormData): "incremental" | "full" {
	const modo = formData.get("modoSync");
	return modo === "full" ? "full" : "incremental";
}

function formatarDataIso(data: Date | null): string | null {
	return data ? data.toISOString() : null;
}

function parseDateFromSearchParam(
	value: string | null,
	type: "inicio" | "fim",
): Date | undefined {
	if (!value) {
		return undefined;
	}

	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		return undefined;
	}

	const [, year, month, day] = match;
	const parsedDate = new Date(
		Date.UTC(
			Number(year),
			Number(month) - 1,
			Number(day),
			type === "fim" ? 23 : 0,
			type === "fim" ? 59 : 0,
			type === "fim" ? 59 : 0,
			type === "fim" ? 999 : 0,
		),
	);

	return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function normalizarIntervaloDatas(inicio?: Date, fim?: Date) {
	if (!inicio || !fim || inicio <= fim) {
		return { inicio, fim };
	}

	return { inicio: fim, fim: inicio };
}

function formatarEpoch(segundos?: number): string {
	if (!segundos) {
		return "nao aplicado";
	}
	return new Date(segundos * 1000).toLocaleString("pt-BR");
}

function getMapboxToken(): string | null {
	return (
		process.env.MAPBOX_ACCESS_TOKEN ??
		process.env.MAPBOX_TOKEN ??
		process.env.VITE_MAPBOX_TOKEN ??
		null
	);
}

function mapCorridaResumoParaDataTableRow(
	corrida: CorridaResumo,
): CorridaDataTableRow {
	const distanciaKm = corrida.distanciaMetros / 1000;
	const paceMedioSegPorKm =
		distanciaKm > 0
			? Math.round(corrida.tempoMovimentoSeg / distanciaKm)
			: null;

	return {
		stravaId: corrida.stravaId,
		summaryPolyline: corrida.summaryPolyline,
		localLat: corrida.localLat,
		localLng: corrida.localLng,
		nome: corrida.nome,
		distanciaMetros: corrida.distanciaMetros,
		elevacaoGanhoMetros: corrida.elevacaoGanhoMetros,
		tempoMovimentoSeg: corrida.tempoMovimentoSeg,
		paceMedioSegPorKm,
		dataInicio: new Date(corrida.dataInicio).toISOString(),
	};
}

async function getHomeStats(request: Request): Promise<LoaderData> {
	const url = new URL(request.url);
	const filtroDataInicio = url.searchParams.get("dataInicio") ?? "";
	const filtroDataFim = url.searchParams.get("dataFim") ?? "";
	const dataInicio = parseDateFromSearchParam(filtroDataInicio, "inicio");
	const dataFim = parseDateFromSearchParam(filtroDataFim, "fim");
	const intervaloData = normalizarIntervaloDatas(dataInicio, dataFim);

	const [totalCorridas, ultimaAtualizacaoDate, ultimasCorridas, maratonasGraficoBarras] =
		await Promise.all([
			contarCorridasSalvas(),
			buscarUltimaAtualizacaoCorridas(),
			listarUltimasCorridas(undefined, intervaloData),
			listarMaratonasParaGraficoBarras(15),
		]);

	return {
		totalCorridas,
		totalCorridasFiltradas: ultimasCorridas.length,
		ultimaAtualizacao: formatarDataIso(ultimaAtualizacaoDate),
		mapboxToken: getMapboxToken(),
		ultimasCorridas,
		maratonasGraficoBarras,
		filtroDataInicio,
		filtroDataFim,
	};
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	if (url.searchParams.get("limpar") === "1") {
		return redirect(url.pathname);
	}

	return await getHomeStats(request);
}

export async function action({
	request,
}: Route.ActionArgs): Promise<ActionData> {
	const formData = await request.formData();
	const perPage = parseNumberFromFormData(formData, "perPage", 200);
	const maxPaginas = parseNumberFromFormData(formData, "maxPaginas", 200);
	const modoSync = parseModoSync(formData);

	try {
		const resultado = await sincronizarCorridasDoStrava({
			perPage,
			maxPaginas,
			modoSync,
		});

		return {
			ok: true,
			message: "Sincronizacao concluida com sucesso.",
			totalRecebidas: resultado.totalRecebidas,
			totalSincronizadas: resultado.totalSincronizadas,
			modo: resultado.modo,
			afterUsado: resultado.afterUsado,
		};
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Erro inesperado na sincronizacao.";

		return {
			ok: false,
			message,
		};
	}
}

export default function Corridas() {
	const actionData = useActionData<typeof action>();
	const loaderData = useLoaderData<typeof loader>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const {
		totalCorridas,
		totalCorridasFiltradas,
		ultimaAtualizacao,
		ultimasCorridas,
		mapboxToken,
		maratonasGraficoBarras,
		filtroDataInicio,
		filtroDataFim,
	} = loaderData;
	const corridasDataTable = ultimasCorridas.map(
		mapCorridaResumoParaDataTableRow,
	);
	const filtroFormKey = `${filtroDataInicio}-${filtroDataFim}`;
	const filtroAtivo = filtroDataInicio !== "" || filtroDataFim !== "";
	const [filtroAberto, setFiltroAberto] = useState(false);
	const syncIncrementalRef = useRef<HTMLFormElement>(null);
	const syncFullRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (!actionData) return;
		if (actionData.ok) {
			toast.success("Sincronizacao concluida com sucesso.", {
				description: `Recebidas: ${actionData.totalRecebidas ?? 0} | Upserts: ${actionData.totalSincronizadas ?? 0} | Modo: ${actionData.modo} | After: ${formatarEpoch(actionData.afterUsado)}`,
			});
		} else {
			toast.error("Falha na sincronizacao", { description: actionData.message });
		}
	}, [actionData]);

	useEffect(() => {
		if (navigation.state === "idle") setFiltroAberto(false);
	}, [navigation.state]);

	return (
		<main className='grid w-full min-w-0 gap-3'>
			{/* Formulários ocultos para sync */}
			<Form ref={syncIncrementalRef} method='post' className='hidden'>
				<input type='hidden' name='modoSync' value='incremental' />
			</Form>
			<Form ref={syncFullRef} method='post' className='hidden'>
				<input type='hidden' name='modoSync' value='full' />
			</Form>

			<div className='flex items-start justify-between gap-2'>
				<div className='flex flex-wrap items-center gap-2'>
					<h1 className='text-2xl font-bold'>Corridas</h1>
					<Badge className='text-primary bg-green-600/20' variant='outline'>
						Total: {totalCorridas ?? 0}
					</Badge>
					<Badge className='text-primary bg-blue-600/20' variant='outline'>
						Exibindo: {totalCorridasFiltradas ?? 0}
					</Badge>
				</div>

				<div className='flex shrink-0 items-center gap-2'>
					<Sheet open={filtroAberto} onOpenChange={setFiltroAberto}>
						<SheetTrigger
							render={
								<Button
									variant={filtroAtivo ? "default" : "outline"}
									size='sm'
									className='gap-1.5'
								/>
							}>
							<HugeiconsIcon icon={FilterHorizontalIcon} size={15} />
							Filtrar
						</SheetTrigger>
						<SheetContent
							side='bottom'
							className='rounded-2xl'
							style={{ left: 16, right: 16, bottom: 16 }}>
							<SheetHeader>
								<SheetTitle>Filtrar corridas</SheetTitle>
							</SheetHeader>
							<Form
								key={filtroFormKey}
								method='get'
								className='grid gap-4 py-4'>
								<label className='grid gap-1 text-sm'>
									Data inicial
									<input
										type='date'
										name='dataInicio'
										defaultValue={filtroDataInicio}
										className='border-input bg-background rounded-md border px-3 py-2'
									/>
								</label>
								<label className='grid gap-1 text-sm'>
									Data final
									<input
										type='date'
										name='dataFim'
										defaultValue={filtroDataFim}
										className='border-input bg-background rounded-md border px-3 py-2'
									/>
								</label>
								<Button type='submit'>Aplicar filtro</Button>
							</Form>
							{filtroAtivo && (
								<Form method='get' action='.'>
									<input type='hidden' name='limpar' value='1' />
									<Button
										type='submit'
										variant='ghost'
										className='w-full'>
										Limpar filtro
									</Button>
								</Form>
							)}
						</SheetContent>
					</Sheet>

					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									variant='outline'
									size='sm'
									className='gap-1.5'
									disabled={isSubmitting}
								/>
							}>
							<HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} />
							{isSubmitting ? "Sincronizando..." : "Sincronizar"}
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem
								onClick={() =>
									syncIncrementalRef.current?.requestSubmit()
								}
								disabled={isSubmitting}>
								Incremental
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => syncFullRef.current?.requestSubmit()}
								disabled={isSubmitting}>
								Completo (desde o início)
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<p className='text-muted-foreground text-xs'>
				{ultimaAtualizacao
					? `Última sync: ${new Date(ultimaAtualizacao).toLocaleString("pt-BR")}`
					: "Nunca sincronizado"}
			</p>

			<CorridasHojeCards corridas={corridasDataTable} />

			<section className='grid gap-2'>
				<CorridasSemanaChart corridas={corridasDataTable} />
			</section>

			<section className='grid gap-2'>
				<CorridasGraficosChart corridas={corridasDataTable} />
			</section>

			<section className='grid gap-2'>
				<h2 className='text-lg font-semibold'>Ultimas corridas sincronizadas</h2>
				<CorridasDataTable
					data={corridasDataTable}
					mapboxToken={mapboxToken}
					maratonasGraficoBarras={maratonasGraficoBarras}
				/>
			</section>
		</main>
	);
}
