"use client";

import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { SearchableComboboxField } from "./searchable-combobox-field";
import { CATEGORIAS_DESPESA, CONTAS_DESPESA } from "./despesa-options";
import type { TransacaoImportada } from "~/models/importar-pdf.server";

type Fase = "upload" | "revisao" | "concluido";

type TransacaoLocal = TransacaoImportada & { _id: number };

type EstadoSalvo = {
	transacoes: TransacaoLocal[];
	indiceAtual: number;
	confirmadas: number;
	puladas: number;
};

const STORAGE_KEY = "importar-pdf-pendentes";

function salvarEstado(estado: EstadoSalvo) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
	} catch {}
}

function carregarEstado(): EstadoSalvo | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as EstadoSalvo;
		if (!Array.isArray(parsed.transacoes) || parsed.transacoes.length === 0) return null;
		return parsed;
	} catch {
		return null;
	}
}

function limparEstado() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {}
}

type ImportarPdfDialogProps = {
	triggerClassName?: string;
};

type ImportarActionData = {
	ok: boolean;
	message: string;
	operacao: string;
	transacoes?: TransacaoImportada[];
};

type CriarActionData = {
	ok: boolean;
	message: string;
	operacao: string;
};

export function ImportarPdfDialog({ triggerClassName }: ImportarPdfDialogProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [fase, setFase] = useState<Fase>("upload");
	const [contaSelecionada, setContaSelecionada] = useState("Nubank");
	const [dataInicio, setDataInicio] = useState("");
	const [apenasDebitos, setApenasDebitos] = useState(false);
	const [transacoes, setTransacoes] = useState<TransacaoLocal[]>([]);
	const [indiceAtual, setIndiceAtual] = useState(0);
	const [confirmadas, setConfirmadas] = useState(0);
	const [puladas, setPuladas] = useState(0);
	const [editAtual, setEditAtual] = useState<Partial<TransacaoImportada>>({});
	const [categoriaAtual, setCategoriaAtual] = useState("");
	const [contaAtual, setContaAtual] = useState("");
	const [temPendentes, setTemPendentes] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const parseFetcher = useFetcher<ImportarActionData>();
	const salvarFetcher = useFetcher<CriarActionData>();

	const isParseando = parseFetcher.state !== "idle";
	const isSalvando = salvarFetcher.state !== "idle";

	useEffect(() => {
		const salvo = carregarEstado();
		setTemPendentes(!!salvo && salvo.indiceAtual < salvo.transacoes.length);
	}, []);

	useEffect(() => {
		if (!dialogOpen) return;
		const salvo = carregarEstado();
		if (!salvo || salvo.indiceAtual >= salvo.transacoes.length) return;
		setTransacoes(salvo.transacoes);
		setIndiceAtual(salvo.indiceAtual);
		setConfirmadas(salvo.confirmadas);
		setPuladas(salvo.puladas);
		setFase("revisao");
		carregarTransacao(salvo.transacoes[salvo.indiceAtual]);
		toast.info(`Retomando análise — ${salvo.transacoes.length - salvo.indiceAtual} transações restantes`);
	}, [dialogOpen]);

	useEffect(() => {
		if (!parseFetcher.data) return;
		if (!parseFetcher.data.ok) {
			toast.error("Erro ao importar PDF", { description: parseFetcher.data.message });
			return;
		}
		if (parseFetcher.data.operacao !== "importar-pdf") return;

		const ts = (parseFetcher.data.transacoes ?? []).map((t, i) => ({ ...t, _id: i }));
		if (ts.length === 0) {
			toast.info("Nenhuma transação encontrada no PDF.");
			return;
		}

		const estadoInicial: EstadoSalvo = { transacoes: ts, indiceAtual: 0, confirmadas: 0, puladas: 0 };
		salvarEstado(estadoInicial);

		setTransacoes(ts);
		setIndiceAtual(0);
		setConfirmadas(0);
		setPuladas(0);
		setTemPendentes(true);
		setFase("revisao");
		carregarTransacao(ts[0]);
	}, [parseFetcher.data]);

	useEffect(() => {
		if (salvarFetcher.state !== "idle" || !salvarFetcher.data) return;
		if (!salvarFetcher.data.ok) {
			toast.error("Erro ao salvar", { description: salvarFetcher.data.message });
		}
	}, [salvarFetcher.state, salvarFetcher.data]);

	function carregarTransacao(t: TransacaoImportada) {
		setEditAtual({ nome: t.nome, valor: t.valor, data: t.data, brassaco: t.brassaco, obs: t.obs });
		setCategoriaAtual(t.categoria);
		setContaAtual(t.conta);
	}

	function transacaoAtual(): TransacaoLocal | null {
		return transacoes[indiceAtual] ?? null;
	}

	function avancar(novoIndice: number, novasConfirmadas: number, novasPuladas: number) {
		if (novoIndice >= transacoes.length) {
			limparEstado();
			setTemPendentes(false);
			setFase("concluido");
		} else {
			salvarEstado({ transacoes, indiceAtual: novoIndice, confirmadas: novasConfirmadas, puladas: novasPuladas });
			setIndiceAtual(novoIndice);
			carregarTransacao(transacoes[novoIndice]);
		}
	}

	function handlePular() {
		const novasPuladas = puladas + 1;
		setPuladas(novasPuladas);
		avancar(indiceAtual + 1, confirmadas, novasPuladas);
	}

	function handleConfirmar() {
		const t = transacaoAtual();
		if (!t) return;

		const form = new FormData();
		form.append("intent", "criar");
		form.append("nome", editAtual.nome ?? t.nome);
		form.append("categoria", categoriaAtual || t.categoria);
		form.append("valor", String(editAtual.valor ?? t.valor));
		form.append("data", editAtual.data ?? t.data);
		form.append("conta", contaAtual || t.conta);
		if (editAtual.brassaco ?? t.brassaco) form.append("brassaco", "on");
		form.append("obs", editAtual.obs ?? t.obs);
		form.append("fatura", "");

		salvarFetcher.submit(form, { method: "post", action: "/contas" });

		const novasConfirmadas = confirmadas + 1;
		setConfirmadas(novasConfirmadas);
		avancar(indiceAtual + 1, novasConfirmadas, puladas);
	}

	function handleDescartarPendentes() {
		limparEstado();
		setTemPendentes(false);
		setFase("upload");
	}

	function handleFechar() {
		setDialogOpen(false);
		setTimeout(() => {
			const salvo = carregarEstado();
			if (!salvo) {
				setFase("upload");
				setTransacoes([]);
				setIndiceAtual(0);
				setConfirmadas(0);
				setPuladas(0);
				setEditAtual({});
				setCategoriaAtual("");
				setContaAtual("");
			} else {
				setFase("upload");
			}
			if (fileInputRef.current) fileInputRef.current.value = "";
		}, 300);
	}

	function handleSubmitUpload(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const data = new FormData(e.currentTarget);
		data.set("intent", "importar-pdf");
		if (!apenasDebitos) data.delete("apenasDebitos");
		parseFetcher.submit(data, {
			method: "post",
			action: "/contas",
			encType: "multipart/form-data",
		});
	}

	const t = transacaoAtual();
	const totalTransacoes = transacoes.length;
	const analisadas = indiceAtual;
	const restantes = totalTransacoes - indiceAtual;
	const progresso = totalTransacoes > 0 ? (analisadas / totalTransacoes) * 100 : 0;

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogTrigger
				render={
					<Button type='button' variant='outline' className={triggerClassName} />
				}>
				{temPendentes ? "Importar PDF ●" : "Importar PDF"}
			</DialogTrigger>

			<DialogContent className='max-h-[90vh] max-w-xl overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>Importar fatura PDF</DialogTitle>
				</DialogHeader>

				{/* Fase: upload */}
				{fase === "upload" && (
					<form onSubmit={handleSubmitUpload} className='grid gap-4'>
						{temPendentes && (
							<div className='rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950'>
								<p className='font-medium text-amber-800 dark:text-amber-200'>
									Análise em andamento
								</p>
								<p className='mt-0.5 text-amber-700 dark:text-amber-300'>
									Você tem transações pendentes de uma análise anterior. Abra o dialog para retomá-la, ou descarte e importe um novo PDF.
								</p>
								<Button
									type='button'
									variant='outline'
									size='sm'
									className='mt-2 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300'
									onClick={handleDescartarPendentes}>
									Descartar e importar novo PDF
								</Button>
							</div>
						)}

						{!temPendentes && (
							<>
								<SearchableComboboxField
									label='Conta padrão'
									name='contaPadrao'
									placeholder='Selecione a conta'
									options={CONTAS_DESPESA}
									value={contaSelecionada}
									onValueChange={setContaSelecionada}
									required
								/>

								<label className='grid gap-1 text-sm'>
									Arquivo PDF
									<input
										ref={fileInputRef}
										type='file'
										name='pdfFile'
										accept='application/pdf'
										required
										className='text-sm file:mr-3 file:cursor-pointer file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm'
									/>
								</label>

								<div className='grid grid-cols-2 gap-3'>
									<label className='grid gap-1 text-sm'>
										A partir de
										<Input
											type='date'
											name='dataInicio'
											value={dataInicio}
											onChange={(e) => setDataInicio(e.target.value)}
										/>
										<span className='text-xs text-muted-foreground'>
											Opcional
										</span>
									</label>

									<div className='flex flex-col justify-end gap-2 pb-1'>
										<label className='flex cursor-pointer items-center gap-2 text-sm'>
											<Checkbox
												checked={apenasDebitos}
												onCheckedChange={(v) => setApenasDebitos(v === true)}
											/>
											Apenas saídas
										</label>
										<p className='text-xs text-muted-foreground'>
											Para extratos com entradas e saídas
										</p>
									</div>
								</div>

								<Button type='submit' disabled={isParseando} className='w-full'>
									{isParseando ? "Processando PDF…" : "Extrair transações"}
								</Button>
							</>
						)}
					</form>
				)}

				{/* Fase: revisao */}
				{fase === "revisao" && t && (
					<div className='grid gap-4'>
						<div className='grid gap-1'>
							<div className='flex items-center justify-between text-xs text-muted-foreground'>
								<span>
									{analisadas} de {totalTransacoes} analisadas
								</span>
								<span>
									{confirmadas} confirmadas · {puladas} puladas · {restantes} restantes
								</span>
							</div>
							<div className='h-1.5 w-full rounded-full bg-muted'>
								<div
									className='h-1.5 rounded-full bg-emerald-500 transition-all'
									style={{ width: `${progresso}%` }}
								/>
							</div>
						</div>

						<div className='rounded-lg border bg-muted/30 p-4'>
							<p className='mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
								Transação {indiceAtual + 1} de {totalTransacoes}
							</p>

							<div className='grid gap-3'>
								<label className='grid gap-1 text-sm'>
									Nome
									<Input
										value={editAtual.nome ?? t.nome}
										onChange={(e) =>
											setEditAtual((prev) => ({ ...prev, nome: e.target.value }))
										}
									/>
								</label>

								<div className='grid grid-cols-2 gap-3'>
									<label className='grid gap-1 text-sm'>
										Valor (R$)
										<Input
											type='number'
											step='0.01'
											min='0'
											value={editAtual.valor ?? t.valor}
											onChange={(e) =>
												setEditAtual((prev) => ({
													...prev,
													valor: Number(e.target.value),
												}))
											}
										/>
									</label>

									<label className='grid gap-1 text-sm'>
										Data
										<Input
											type='date'
											value={editAtual.data ?? t.data}
											onChange={(e) =>
												setEditAtual((prev) => ({ ...prev, data: e.target.value }))
											}
										/>
									</label>
								</div>

								<SearchableComboboxField
									label='Categoria'
									name='_categoria'
									placeholder='Selecione categoria'
									options={CATEGORIAS_DESPESA}
									value={categoriaAtual}
									onValueChange={setCategoriaAtual}
								/>

								<SearchableComboboxField
									label='Conta'
									name='_conta'
									placeholder='Selecione conta'
									options={CONTAS_DESPESA}
									value={contaAtual}
									onValueChange={setContaAtual}
								/>

								<label className='grid gap-1 text-sm'>
									Observação
									<Textarea
										rows={2}
										value={editAtual.obs ?? t.obs}
										onChange={(e) =>
											setEditAtual((prev) => ({ ...prev, obs: e.target.value }))
										}
									/>
								</label>

								<label className='flex cursor-pointer items-center gap-2 text-sm'>
									<Checkbox
										checked={editAtual.brassaco ?? t.brassaco}
										onCheckedChange={(checked) =>
											setEditAtual((prev) => ({
												...prev,
												brassaco: checked === true,
											}))
										}
									/>
									Brassaco (despesa compartilhada)
								</label>
							</div>
						</div>

						<div className='flex gap-2'>
							<Button
								type='button'
								variant='outline'
								className='flex-1'
								onClick={handlePular}
								disabled={isSalvando}>
								Pular
							</Button>
							<Button
								type='button'
								className='flex-1 bg-emerald-600 hover:bg-emerald-700'
								onClick={handleConfirmar}
								disabled={isSalvando}>
								{isSalvando ? "Salvando…" : "Confirmar"}
							</Button>
						</div>
					</div>
				)}

				{/* Fase: concluido */}
				{fase === "concluido" && (
					<div className='grid gap-4 py-4 text-center'>
						<div className='text-4xl'>✓</div>
						<div>
							<p className='text-lg font-semibold'>Revisão concluída!</p>
							<p className='mt-1 text-sm text-muted-foreground'>
								{confirmadas} transações confirmadas · {puladas} puladas
							</p>
						</div>
						<Button type='button' onClick={handleFechar}>
							Fechar
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
