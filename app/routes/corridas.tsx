import type { Route } from "./+types/home";
import {
	Form,
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
	ultimaAtualizacao: string | null;
	mapboxToken: string | null;
	ultimasCorridas: CorridaResumo[];
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

async function getHomeStats(): Promise<LoaderData> {
	const [totalCorridas, ultimaAtualizacaoDate, ultimasCorridas] =
		await Promise.all([
			contarCorridasSalvas(),
			buscarUltimaAtualizacaoCorridas(),
			listarUltimasCorridas(),
		]);

	return {
		totalCorridas,
		ultimaAtualizacao: formatarDataIso(ultimaAtualizacaoDate),
		mapboxToken: getMapboxToken(),
		ultimasCorridas,
	};
}

export async function loader() {
	return await getHomeStats();
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
	const { totalCorridas, ultimaAtualizacao, ultimasCorridas, mapboxToken } =
		loaderData;
	const corridasDataTable = ultimasCorridas.map(
		mapCorridaResumoParaDataTableRow,
	);

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
		<main style={{ display: "grid", gap: 12, maxWidth: 900 }}>
			<div className='flex items-center gap-3'>
				<h1 className='text-2xl font-bold'>Corridas</h1>
				<Badge className='text-primary bg-green-600/20' variant='outline'>
					Total: {totalCorridas ?? 0}
				</Badge>
				<Badge className='text-primary bg-primary/10' variant='outline'>
					{ultimaAtualizacao
						? new Date(ultimaAtualizacao).toLocaleString("pt-BR")
						: "Nunca sincronizado"}
				</Badge>
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

			<section>
				<h2>Ultimas corridas sincronizadas</h2>
				<CorridasDataTable data={corridasDataTable} mapboxToken={mapboxToken} />
			</section>
		</main>
	);
}
