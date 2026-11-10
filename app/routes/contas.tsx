import type { Route } from "./+types/contas";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
	useSubmit,
} from "react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
	criarCategoriaDespesa,
	excluirCategoriaDespesa,
	listarCategoriasDespesa,
	renomearCategoriaDespesa,
} from "~/models/categorias-despesa.server";
import {
	extrairTransacoesDePdf,
	type TransacaoImportada,
} from "~/models/importar-pdf.server";
import { DespesaFormDialog } from "~/components/despesas/despesa-form-dialog";
import { type DespesaDataTableRow } from "~/components/despesas/despesas-columns";
import { DespesasDataTable } from "~/components/despesas/despesas-data-table";
import {
	DespesaEditDialog,
	type DespesaEditavel,
} from "~/components/despesas/despesa-edit-dialog";
import { PagamentoBrassacoDialog } from "~/components/despesas/pagamento-brassaco-dialog";
import { ImportarPdfDialog } from "~/components/despesas/importar-pdf-dialog";
import { CategoriaFormDialog } from "~/components/despesas/categoria-form-dialog";

type LoaderData = {
	despesas: Awaited<ReturnType<typeof listarDespesas>>;
	categorias: string[];
	totalDespesas: number;
	totalValor: number;
	totalPagoBrassaco: number;
	saldoBrassacoAberto: number;
	totalPagamentosBrassaco: number;
	filtroDataInicio: string;
	filtroDataFim: string;
	filtroMes: number;
	filtroAno: number;
};

type ActionData = {
	ok: boolean;
	message: string;
	operacao:
		| "criar"
		| "editar"
		| "excluir"
		| "pagar-brassaco"
		| "importar-pdf"
		| "criar-categoria"
		| "excluir-categoria"
		| "editar-categoria";
	transacoes?: TransacaoImportada[];
};

const NAV_BTN =
	"inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors";
const SELECT_CLASS =
	"border-input bg-background rounded-md border px-3 py-2 text-sm capitalize";

function getNomeMes(mes: number): string {
	return new Date(Date.UTC(2025, mes - 1, 1)).toLocaleString("pt-BR", {
		month: "long",
		timeZone: "UTC",
	});
}

function obterIntervaloMes(ano: number, mes: number): { inicio: Date; fim: Date } {
	return {
		inicio: new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0, 0)),
		fim: new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)),
	};
}

function parseMesAno(
	mesRaw: string | null,
	anoRaw: string | null,
): { mes: number; ano: number } | null {
	const mes = Number(mesRaw);
	const ano = Number(anoRaw);
	if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null;
	if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return null;
	return { mes, ano };
}

// O intervalo filtrado é exatamente um mês cheio?
function isMesCheio(inicio: string, fim: string): boolean {
	const [ano, mes, dia] = inicio.split("-").map(Number);
	if (dia !== 1) return false;
	return fim === formatarDataInput(obterIntervaloMes(ano, mes).fim);
}

function parseValor(raw: FormDataEntryValue | null): number {
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error("Informe um valor válido maior que zero.");
	}
	return parsed;
}

function parseData(raw: FormDataEntryValue | null): Date {
	if (typeof raw !== "string" || !raw) {
		throw new Error("Informe a data da despesa.");
	}

	const data = new Date(`${raw}T00:00:00.000Z`);
	if (Number.isNaN(data.getTime())) {
		throw new Error("Data inválida.");
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

	if (operacao === "importar-pdf") {
		return "Falha ao importar PDF";
	}

	if (operacao === "criar-categoria") {
		return "Falha ao cadastrar categoria";
	}

	if (operacao === "excluir-categoria") {
		return "Falha ao apagar categoria";
	}

	if (operacao === "editar-categoria") {
		return "Falha ao editar categoria";
	}

	return "Falha ao cadastrar despesa";
}

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Despesas | Marcioscar" },
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

	// ?mes=&ano= (navegação por mês) tem prioridade sobre o período personalizado
	const mesAno = parseMesAno(
		url.searchParams.get("mes"),
		url.searchParams.get("ano"),
	);
	const intervaloMes = mesAno
		? obterIntervaloMes(mesAno.ano, mesAno.mes)
		: null;

	const dataInicio =
		intervaloMes?.inicio ??
		parseDateFromSearchParam(filtroDataInicioRaw, "inicio") ??
		intervaloMesAtual.inicio;
	const dataFim =
		intervaloMes?.fim ??
		parseDateFromSearchParam(filtroDataFimRaw, "fim") ??
		intervaloMesAtual.fim;
	const intervaloData = normalizarIntervaloDatas(dataInicio, dataFim);
	const inicioEfetivo = intervaloData.inicio ?? intervaloMesAtual.inicio;

	const [despesas, resumoSaldoBrassaco, categorias] = await Promise.all([
		listarDespesas(intervaloData),
		obterResumoSaldoBrassaco(),
		listarCategoriasDespesa(),
	]);
	const totalValor = despesas.reduce((acc, item) => acc + item.valor, 0);

	return {
		despesas,
		categorias,
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
		filtroMes: inicioEfetivo.getUTCMonth() + 1,
		filtroAno: inicioEfetivo.getUTCFullYear(),
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

		if (intent === "criar-categoria") {
			const nome = await criarCategoriaDespesa(
				parseString(formData.get("nomeCategoria")),
			);
			return {
				ok: true,
				message: `Categoria "${nome}" cadastrada com sucesso.`,
				operacao: "criar-categoria",
			};
		}

		if (intent === "editar-categoria") {
			const { nome, despesasAtualizadas } = await renomearCategoriaDespesa({
				nomeAtual: parseString(formData.get("nomeCategoria")),
				nomeNovo: parseString(formData.get("novoNomeCategoria")),
				atualizarDespesas: parseBooleanCheckbox(formData.get("atualizarDespesas")),
			});
			const sufixo =
				despesasAtualizadas > 0
					? ` ${despesasAtualizadas} despesa(s) atualizada(s).`
					: "";
			return {
				ok: true,
				message: `Categoria renomeada para "${nome}".${sufixo}`,
				operacao: "editar-categoria",
			};
		}

		if (intent === "excluir-categoria") {
			const nome = await excluirCategoriaDespesa(
				parseString(formData.get("nomeCategoria")),
			);
			return {
				ok: true,
				message: `Categoria "${nome}" apagada.`,
				operacao: "excluir-categoria",
			};
		}

		if (intent === "importar-pdf") {
			const pdfFile = formData.get("pdfFile");
			if (!(pdfFile instanceof File) || pdfFile.size === 0) {
				throw new Error("Selecione um arquivo PDF válido.");
			}
			const bytes = await pdfFile.arrayBuffer();
			const conta = parseString(formData.get("contaPadrao")) || "Nubank";
			const dataInicio = parseString(formData.get("dataInicio")) || undefined;
			const apenasDebitos = formData.get("apenasDebitos") === "on";
			const categorias = await listarCategoriasDespesa();
			const transacoes = await extrairTransacoesDePdf(
				Buffer.from(bytes),
				conta,
				categorias,
				dataInicio,
				apenasDebitos,
			);
			return {
				ok: true,
				message: `${transacoes.length} transações extraídas do PDF.`,
				operacao: "importar-pdf",
				transacoes,
			};
		}

		if (intent === "excluir") {
			const despesaId = parseString(formData.get("id"));
			if (!despesaId) {
				throw new Error("Despesa inválida para exclusão.");
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
			pessoa: parseString(formData.get("pessoa")),
			obs: parseString(formData.get("obs")),
		};

		if (intent === "editar") {
			const despesaId = parseString(formData.get("id"));
			if (!despesaId) {
				throw new Error("Despesa inválida para edição.");
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
		categorias,
		totalDespesas,
		totalValor,
		totalPagoBrassaco,
		saldoBrassacoAberto,
		totalPagamentosBrassaco,
		filtroDataInicio,
		filtroDataFim,
		filtroMes,
		filtroAno,
	} = useLoaderData<typeof loader>();
	const submit = useSubmit();
	const periodoPersonalizado = !isMesCheio(filtroDataInicio, filtroDataFim);
	const mesAnterior =
		filtroMes === 1
			? { mes: 12, ano: filtroAno - 1 }
			: { mes: filtroMes - 1, ano: filtroAno };
	const mesSeguinte =
		filtroMes === 12
			? { mes: 1, ano: filtroAno + 1 }
			: { mes: filtroMes + 1, ano: filtroAno };
	const anoAtual = new Date().getUTCFullYear();
	const opcoesAno = Array.from(
		new Set([anoAtual - 3, anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1, filtroAno]),
	).sort((a, b) => a - b);
	const abrirEdicao = useCallback((id: string) => {
		setSelectedDespesaId(id);
		setDialogEdicaoOpen(true);
	}, []);
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const submittingIntent = parseString(
		navigation.formData?.get("intent") ?? null,
	);
	const isSubmittingCategoria =
		isSubmitting && submittingIntent === "criar-categoria";
	const isSubmittingPagamentoBrassaco =
		isSubmitting && submittingIntent === "pagar-brassaco";
	const [dialogNovoOpen, setDialogNovoOpen] = useState(false);
	const [dialogCategoriaOpen, setDialogCategoriaOpen] = useState(false);
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
			setDialogCategoriaOpen(false);
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
				<h1 className='text-2xl font-bold'>Despesas</h1>
				<div className='flex flex-wrap items-center gap-2'>
					<PagamentoBrassacoDialog
						open={dialogPagamentoBrassacoOpen}
						onOpenChange={setDialogPagamentoBrassacoOpen}
						isSubmitting={isSubmittingPagamentoBrassaco}
						totalPagamentosBrassaco={totalPagamentosBrassaco}
						defaultDataPagamento={formatarDataInput(new Date())}
					/>
					<CategoriaFormDialog
						open={dialogCategoriaOpen}
						onOpenChange={setDialogCategoriaOpen}
						isSubmitting={isSubmittingCategoria}
						categorias={categorias}
					/>
					<ImportarPdfDialog categorias={categorias} />
					<DespesaFormDialog
						open={dialogNovoOpen}
						onOpenChange={setDialogNovoOpen}
						isSubmitting={isSubmitting}
						categorias={categorias}
					/>
				</div>
			</div>

			<section className='grid gap-3 sm:grid-cols-3'>
				<div className='rounded-2xl border border-border bg-card px-4 py-3.5'>
					<p className='text-xs text-muted-foreground'>Total do período</p>
					<p className='mt-1 text-2xl font-bold tabular-nums'>
						{formatarMoeda(totalValor)}
					</p>
					<p className='mt-0.5 text-xs text-muted-foreground'>
						{totalDespesas} despesa(s)
					</p>
				</div>
				<div className='rounded-2xl border border-border bg-card px-4 py-3.5'>
					<p className='text-xs text-muted-foreground'>Saldo Brassaco em aberto</p>
					<p className='mt-1 text-2xl font-bold tabular-nums'>
						{formatarMoeda(saldoBrassacoAberto)}
					</p>
					<p className='mt-0.5 text-xs text-muted-foreground'>
						todas as despesas Brassaco menos os pagamentos
					</p>
				</div>
				<div className='rounded-2xl border border-border bg-card px-4 py-3.5'>
					<p className='text-xs text-muted-foreground'>Pago pela Brassaco</p>
					<p className='mt-1 text-2xl font-bold tabular-nums'>
						{formatarMoeda(totalPagoBrassaco)}
					</p>
					<p className='mt-0.5 text-xs text-muted-foreground'>
						{totalPagamentosBrassaco} pagamento(s) desde o início
					</p>
				</div>
			</section>

			<section className='min-w-0 rounded-md border'>
				<div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3'>
					<h2 className='text-lg font-semibold'>
						{periodoPersonalizado
							? "Período personalizado"
							: `Despesas de ${getNomeMes(filtroMes)} de ${filtroAno}`}
					</h2>
					<div className='flex items-center gap-2'>
						<Link
							to={`?mes=${mesAnterior.mes}&ano=${mesAnterior.ano}`}
							className={NAV_BTN}
							aria-label='Mês anterior'>
							←
						</Link>
						<Form method='get' className='flex items-center gap-2'>
							<select
								name='mes'
								aria-label='Mês'
								value={String(filtroMes)}
								onChange={(e) => submit(e.currentTarget.form)}
								className={SELECT_CLASS}>
								{Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
									<option key={mes} value={mes}>
										{getNomeMes(mes)}
									</option>
								))}
							</select>
							<select
								name='ano'
								aria-label='Ano'
								value={String(filtroAno)}
								onChange={(e) => submit(e.currentTarget.form)}
								className={SELECT_CLASS}>
								{opcoesAno.map((ano) => (
									<option key={ano} value={ano}>
										{ano}
									</option>
								))}
							</select>
						</Form>
						<Link
							to={`?mes=${mesSeguinte.mes}&ano=${mesSeguinte.ano}`}
							className={NAV_BTN}
							aria-label='Próximo mês'>
							→
						</Link>
					</div>
				</div>
				<details className='border-b px-4 py-2' open={periodoPersonalizado}>
					<summary className='cursor-pointer text-sm text-muted-foreground'>
						Período personalizado
					</summary>
					<Form
						key={`${filtroDataInicio}-${filtroDataFim}`}
						method='get'
						className='flex flex-wrap items-end gap-3 pt-3 pb-2'>
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
							Aplicar
						</Button>
					</Form>
				</details>
				<div className='p-4'>
					<DespesasDataTable
						data={despesasDataTable}
						onEditDespesa={abrirEdicao}
					/>
				</div>
			</section>

			<DespesaEditDialog
				open={dialogEdicaoOpen}
				onOpenChange={setDialogEdicaoOpen}
				isSubmitting={isSubmitting}
				submittingIntent={submittingIntent}
				despesa={despesaSelecionada}
				categorias={categorias}
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
		pessoa: despesa.pessoa,
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
		pessoa: despesa.pessoa,
		brassaco: despesa.brassaco,
		comprovante: despesa.comprovante,
		obs: despesa.obs,
	};
}
