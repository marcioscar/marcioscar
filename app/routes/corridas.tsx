import type { Route } from "./+types/home";
import {
	Form,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import {
	buscarUltimaAtualizacaoCorridas,
	contarCorridasSalvas,
	listarUltimasCorridas,
	sincronizarCorridasDoStrava,
	type CorridaResumo,
} from "~/models/corridas.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CorridasDataTable } from "~/components/corridas/corridas-data-table";
import type { CorridaDataTableRow } from "~/components/corridas/corridas-columns";

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

	const [totalCorridas, ultimaAtualizacaoDate, ultimasCorridas] =
		await Promise.all([
			contarCorridasSalvas(),
			buscarUltimaAtualizacaoCorridas(),
			listarUltimasCorridas(undefined, intervaloData),
		]);

	return {
		totalCorridas,
		totalCorridasFiltradas: ultimasCorridas.length,
		ultimaAtualizacao: formatarDataIso(ultimaAtualizacaoDate),
		mapboxToken: getMapboxToken(),
		ultimasCorridas,
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
		filtroDataInicio,
		filtroDataFim,
	} = loaderData;
	const corridasDataTable = ultimasCorridas.map(
		mapCorridaResumoParaDataTableRow,
	);
	const filtroFormKey = `${filtroDataInicio}-${filtroDataFim}`;

	useEffect(() => {
		if (!actionData) {
			return;
		}

		if (actionData.ok) {
			toast.success("Sincronizacao concluida com sucesso.", {
				description: `Recebidas: ${actionData.totalRecebidas ?? 0} | Upserts: ${actionData.totalSincronizadas ?? 0} | Modo: ${actionData.modo} | After: ${formatarEpoch(actionData.afterUsado)}`,
			});
			return;
		}

		toast.error("Falha na sincronizacao", {
			description: actionData.message,
		});
	}, [actionData]);

	return (
		<main className='grid w-full min-w-0 gap-3'>
			<div className='flex flex-wrap items-center gap-2'>
				<h1 className='text-2xl font-bold'>Corridas</h1>
				<Badge className='text-primary bg-green-600/20' variant='outline'>
					Total: {totalCorridas ?? 0}
				</Badge>
				<Badge className='text-primary bg-blue-600/20' variant='outline'>
					Exibindo: {totalCorridasFiltradas ?? 0}
				</Badge>
				<Badge className='text-primary bg-primary/10' variant='outline'>
					{ultimaAtualizacao
						? new Date(ultimaAtualizacao).toLocaleString("pt-BR")
						: "Nunca sincronizado"}
				</Badge>
			</div>

			<div className='flex flex-wrap items-end gap-2'>
				<Form key={filtroFormKey} method='get' className='grid gap-2'>
					<div className='flex flex-wrap items-end gap-3'>
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

						<Button type='submit' variant='outline'>
							Aplicar filtro
						</Button>
					</div>
				</Form>

				<Form method='get' action='.'>
					<input type='hidden' name='limpar' value='1' />
					<Button type='submit' variant='ghost'>
						Limpar
					</Button>
				</Form>
			</div>

			<Form method='post' style={{ display: "grid", gap: 8 }}>
				{/* <label>
					Per page
					<input type='number' name='perPage' defaultValue={200} min={1} />
				</label>

				<label>
					Max paginas
					<input type='number' name='maxPaginas' defaultValue={100} min={1} />
				</label> */}

				<div className='flex flex-wrap items-center gap-2'>
					<Button
						variant='outline'
						type='submit'
						name='modoSync'
						value='incremental'
						disabled={isSubmitting}>
						{isSubmitting ? "Sincronizando..." : "Sincronizar"}
					</Button>

					<Button
						type='submit'
						name='modoSync'
						value='full'
						variant='outline'
						disabled={isSubmitting}>
						{isSubmitting
							? "Sincronizando..."
							: "Sincronizar completo (desde o inicio)"}
					</Button>
				</div>
			</Form>

			<section className='grid gap-2'>
				<h2 className='text-lg font-semibold'>Ultimas corridas sincronizadas</h2>
				<CorridasDataTable data={corridasDataTable} mapboxToken={mapboxToken} />
			</section>
		</main>
	);
}
