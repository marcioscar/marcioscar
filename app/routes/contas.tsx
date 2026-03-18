import type { Route } from "./+types/contas";
import {
	Form,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	atualizarDespesa,
	criarDespesa,
	excluirDespesa,
	listarDespesas,
} from "~/models/despesas.server";
import {
	criarPagamentoBrassaco,
	obterResumoSaldoBrassaco,
} from "~/models/pagamentos-brassaco.server";
import { uploadReciboAndGetUrl } from "~/models/pocketbase.server";
import { DespesaFormDialog } from "~/components/despesas/despesa-form-dialog";
import { type DespesaDataTableRow } from "~/components/despesas/despesas-columns";
import { DespesasDataTable } from "~/components/despesas/despesas-data-table";
import {
	DespesaEditDialog,
	type DespesaEditavel,
} from "~/components/despesas/despesa-edit-dialog";
import { PagamentoBrassacoDialog } from "~/components/despesas/pagamento-brassaco-dialog";

type LoaderData = {
	despesas: Awaited<ReturnType<typeof listarDespesas>>;
	totalDespesas: number;
	totalValor: number;
	totalPagoBrassaco: number;
	saldoBrassacoAberto: number;
	totalPagamentosBrassaco: number;
	filtroDataInicio: string;
	filtroDataFim: string;
};

type ActionData = {
	ok: boolean;
	message: string;
	operacao: "criar" | "editar" | "excluir" | "pagar-brassaco";
};

const BOTAO_EDITAR_CLASS =
	"border-orange-200 bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 dark:border-orange-500/30 dark:text-orange-300";
const BOTAO_PAGAR_BRASSACO_CLASS =
	"border-blue-200 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:border-blue-500/30 dark:text-blue-300";
const BOTAO_NOVA_DESPESA_CLASS =
	"border-emerald-200 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-300";

function parseValor(raw: FormDataEntryValue | null): number {
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error("Informe um valor valido maior que zero.");
	}
	return parsed;
}

function parseData(raw: FormDataEntryValue | null): Date {
	if (typeof raw !== "string" || !raw) {
		throw new Error("Informe a data da despesa.");
	}

	const data = new Date(`${raw}T00:00:00.000Z`);
	if (Number.isNaN(data.getTime())) {
		throw new Error("Data invalida.");
	}

	return data;
}

function parseBooleanCheckbox(raw: FormDataEntryValue | null): boolean {
	return raw === "on";
}

function parseString(raw: FormDataEntryValue | null): string {
	return typeof raw === "string" ? raw.trim() : "";
}

async function uploadComprovanteSeExiste(
	file: FormDataEntryValue | null,
): Promise<string> {
	if (!(file instanceof File) || file.size === 0) {
		return "";
	}

	const bytes = await file.arrayBuffer();
	return uploadReciboAndGetUrl(Buffer.from(bytes), file.name);
}

function formatarMoeda(valor: number): string {
	return valor.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}

function formatarDataInput(data: Date): string {
	return data.toISOString().slice(0, 10);
}

function obterIntervaloMesAtual(): { inicio: Date; fim: Date } {
	const agora = new Date();
	const inicio = new Date(
		Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1, 0, 0, 0, 0),
	);
	const fim = new Date(
		Date.UTC(
			agora.getUTCFullYear(),
			agora.getUTCMonth() + 1,
			0,
			23,
			59,
			59,
			999,
		),
	);
	return { inicio, fim };
}

function parseDateFromSearchParam(
	value: string | null,
	tipo: "inicio" | "fim",
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
			tipo === "fim" ? 23 : 0,
			tipo === "fim" ? 59 : 0,
			tipo === "fim" ? 59 : 0,
			tipo === "fim" ? 999 : 0,
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

function getTituloErroOperacao(operacao: ActionData["operacao"]): string {
	if (operacao === "editar") {
		return "Falha ao atualizar despesa";
	}

	if (operacao === "excluir") {
		return "Falha ao apagar despesa";
	}

	if (operacao === "pagar-brassaco") {
		return "Falha ao registrar pagamento da Brassaco";
	}

	return "Falha ao cadastrar despesa";
}

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Contas | Marcioscar" },
		{ name: "description", content: "Cadastro e acompanhamento de despesas" },
	];
}

export async function loader({
	request,
}: Route.LoaderArgs): Promise<LoaderData> {
	const url = new URL(request.url);
	const intervaloMesAtual = obterIntervaloMesAtual();
	const filtroDataInicioRaw = url.searchParams.get("dataInicio");
	const filtroDataFimRaw = url.searchParams.get("dataFim");

	const dataInicio =
		parseDateFromSearchParam(filtroDataInicioRaw, "inicio") ??
		intervaloMesAtual.inicio;
	const dataFim =
		parseDateFromSearchParam(filtroDataFimRaw, "fim") ?? intervaloMesAtual.fim;
	const intervaloData = normalizarIntervaloDatas(dataInicio, dataFim);

	const [despesas, resumoSaldoBrassaco] = await Promise.all([
		listarDespesas(intervaloData),
		obterResumoSaldoBrassaco(),
	]);
	const totalValor = despesas.reduce((acc, item) => acc + item.valor, 0);

	return {
		despesas,
		totalDespesas: despesas.length,
		totalValor,
		totalPagoBrassaco: resumoSaldoBrassaco.totalPagoBrassaco,
		saldoBrassacoAberto: resumoSaldoBrassaco.saldoBrassaco,
		totalPagamentosBrassaco: resumoSaldoBrassaco.totalPagamentosBrassaco,
		filtroDataInicio: formatarDataInput(
			intervaloData.inicio ?? intervaloMesAtual.inicio,
		),
		filtroDataFim: formatarDataInput(
			intervaloData.fim ?? intervaloMesAtual.fim,
		),
	};
}

export async function action({
	request,
}: Route.ActionArgs): Promise<ActionData> {
	let intent: ActionData["operacao"] | "" = "";

	try {
		const formData = await request.formData();
		intent = parseString(formData.get("intent")) as ActionData["operacao"] | "";

		if (intent === "pagar-brassaco") {
			await criarPagamentoBrassaco({
				valor: parseValor(formData.get("valorPagamentoBrassaco")),
				data: parseData(formData.get("dataPagamentoBrassaco")),
				obs: parseString(formData.get("obsPagamentoBrassaco")),
			});

			return {
				ok: true,
				message: "Pagamento da Brassaco registrado com sucesso.",
				operacao: "pagar-brassaco",
			};
		}

		if (intent === "excluir") {
			const despesaId = parseString(formData.get("id"));
			if (!despesaId) {
				throw new Error("Despesa invalida para exclusao.");
			}

			await excluirDespesa(despesaId);
			return {
				ok: true,
				message: "Despesa apagada com sucesso.",
				operacao: "excluir",
			};
		}

		const comprovanteUrl = await uploadComprovanteSeExiste(
			formData.get("comprovanteArquivo"),
		);
		const payloadBase = {
			nome: parseString(formData.get("nome")),
			categoria: parseString(formData.get("categoria")),
			valor: parseValor(formData.get("valor")),
			data: parseData(formData.get("data")),
			brassaco: parseBooleanCheckbox(formData.get("brassaco")),
			conta: parseString(formData.get("conta")),
			fatura: parseString(formData.get("fatura")),
			obs: parseString(formData.get("obs")),
		};

		if (intent === "editar") {
			const despesaId = parseString(formData.get("id"));
			if (!despesaId) {
				throw new Error("Despesa invalida para edicao.");
			}

			const comprovanteAtual = parseString(formData.get("comprovanteAtual"));
			await atualizarDespesa({
				id: despesaId,
				...payloadBase,
				comprovante: comprovanteUrl || comprovanteAtual,
			});

			return {
				ok: true,
				message: "Despesa atualizada com sucesso.",
				operacao: "editar",
			};
		}

		await criarDespesa({
			...payloadBase,
			comprovante: comprovanteUrl,
		});

		return {
			ok: true,
			message: "Despesa cadastrada com sucesso.",
			operacao: "criar",
		};
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Erro inesperado ao cadastrar despesa.";

		return {
			ok: false,
			message,
			operacao: intent || "criar",
		};
	}
}

export default function Contas() {
	const {
		despesas,
		totalDespesas,
		totalValor,
		totalPagoBrassaco,
		saldoBrassacoAberto,
		totalPagamentosBrassaco,
		filtroDataInicio,
		filtroDataFim,
	} = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const submittingIntent = parseString(
		navigation.formData?.get("intent") ?? null,
	);
	const isSubmittingPagamentoBrassaco =
		isSubmitting && submittingIntent === "pagar-brassaco";
	const [dialogNovoOpen, setDialogNovoOpen] = useState(false);
	const [dialogEdicaoOpen, setDialogEdicaoOpen] = useState(false);
	const [dialogPagamentoBrassacoOpen, setDialogPagamentoBrassacoOpen] =
		useState(false);
	const [selectedDespesaId, setSelectedDespesaId] = useState<string | null>(
		null,
	);
	const despesasDataTable = despesas.map(mapDespesaParaDataTableRow);
	const despesaSelecionada = getDespesaSelecionada(despesas, selectedDespesaId);

	useEffect(() => {
		if (!actionData) {
			return;
		}

		if (actionData.ok) {
			toast.success(actionData.message);
			setDialogNovoOpen(false);
			setDialogEdicaoOpen(false);
			setDialogPagamentoBrassacoOpen(false);
			return;
		}

		toast.error(getTituloErroOperacao(actionData.operacao), {
			description: actionData.message,
		});
	}, [actionData]);

	useEffect(() => {
		if (!selectedDespesaId) {
			return;
		}

		const existeNaLista = despesas.some(
			(despesa) => despesa.id === selectedDespesaId,
		);
		if (!existeNaLista) {
			setSelectedDespesaId(null);
		}
	}, [despesas, selectedDespesaId]);

	return (
		<main className='grid w-full min-w-0 gap-4'>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<div className='flex flex-wrap items-center gap-2'>
					<h1 className='text-2xl font-bold'>Contas</h1>
					<Badge variant='outline'>Despesas: {totalDespesas}</Badge>
					<Badge variant='outline'>Total: {formatarMoeda(totalValor)}</Badge>
					<Badge variant='outline'>
						Pago Brassaco: {formatarMoeda(totalPagoBrassaco)}
					</Badge>
					<Badge variant='outline'>
						Saldo Brassaco: {formatarMoeda(saldoBrassacoAberto)}
					</Badge>
				</div>
				<div className='flex items-center gap-2'>
					<Button
						type='button'
						variant='outline'
						className={BOTAO_EDITAR_CLASS}
						disabled={!despesaSelecionada}
						onClick={() => setDialogEdicaoOpen(true)}>
						Editar despesa
					</Button>
					<PagamentoBrassacoDialog
						open={dialogPagamentoBrassacoOpen}
						onOpenChange={setDialogPagamentoBrassacoOpen}
						isSubmitting={isSubmittingPagamentoBrassaco}
						totalPagamentosBrassaco={totalPagamentosBrassaco}
						defaultDataPagamento={formatarDataInput(new Date())}
						triggerClassName={BOTAO_PAGAR_BRASSACO_CLASS}
					/>
					<DespesaFormDialog
						open={dialogNovoOpen}
						onOpenChange={setDialogNovoOpen}
						isSubmitting={isSubmitting}
						triggerClassName={BOTAO_NOVA_DESPESA_CLASS}
					/>
				</div>
			</div>

			<section className='rounded-md border'>
				<div className='border-b px-4 py-3'>
					<h2 className='text-lg font-semibold'>Despesas cadastradas</h2>
				</div>
				<div className='border-b p-4'>
					<Form method='get' className='flex flex-wrap items-end gap-3'>
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
					</Form>
				</div>
				<div className='p-4'>
					<DespesasDataTable
						data={despesasDataTable}
						selectedDespesaId={selectedDespesaId}
						onSelectDespesaId={setSelectedDespesaId}
					/>
				</div>
			</section>

			<DespesaEditDialog
				open={dialogEdicaoOpen}
				onOpenChange={setDialogEdicaoOpen}
				isSubmitting={isSubmitting}
				submittingIntent={submittingIntent}
				despesa={despesaSelecionada}
			/>
		</main>
	);
}

function mapDespesaParaDataTableRow(
	despesa: Awaited<ReturnType<typeof listarDespesas>>[number],
): DespesaDataTableRow {
	return {
		id: despesa.id,
		data: new Date(despesa.data).toISOString(),
		nome: despesa.nome,
		categoria: despesa.categoria,
		conta: despesa.conta,
		fatura: despesa.fatura,
		valor: despesa.valor,
		brassaco: despesa.brassaco,
		comprovante: despesa.comprovante,
	};
}

function getDespesaSelecionada(
	despesas: Awaited<ReturnType<typeof listarDespesas>>,
	despesaId: string | null,
): DespesaEditavel | null {
	if (despesaId === null) {
		return null;
	}

	const despesa = despesas.find((item) => item.id === despesaId);
	if (!despesa) {
		return null;
	}

	return {
		id: despesa.id,
		nome: despesa.nome,
		categoria: despesa.categoria,
		valor: despesa.valor,
		data: new Date(despesa.data).toISOString(),
		conta: despesa.conta,
		fatura: despesa.fatura,
		brassaco: despesa.brassaco,
		comprovante: despesa.comprovante,
		obs: despesa.obs,
	};
}
