"use client";

import { useEffect, useMemo, useState } from "react";
import { Form } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { SearchableComboboxField } from "./searchable-combobox-field";
import { CATEGORIAS_DESPESA, CONTAS_DESPESA } from "./despesa-options";

export type DespesaEditavel = {
	id: string;
	nome: string;
	categoria: string;
	valor: number;
	data: string;
	conta: string;
	fatura: string | null;
	brassaco: boolean;
	comprovante: string;
	obs: string;
};

type DespesaEditDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isSubmitting: boolean;
	submittingIntent?: string;
	despesa: DespesaEditavel | null;
};

function formatarDataParaInput(dataIso: string): string {
	return dataIso.slice(0, 10);
}

export function DespesaEditDialog({
	open,
	onOpenChange,
	isSubmitting,
	submittingIntent,
	despesa,
}: DespesaEditDialogProps) {
	const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
	const [contaSelecionada, setContaSelecionada] = useState("");

	const dataInput = useMemo(
		() => (despesa ? formatarDataParaInput(despesa.data) : ""),
		[despesa],
	);

	useEffect(() => {
		if (!open || !despesa) {
			return;
		}

		setCategoriaSelecionada(despesa.categoria);
		setContaSelecionada(despesa.conta);
	}, [open, despesa]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
				<Form method='post' encType='multipart/form-data' className='grid gap-4'>
					<input type='hidden' name='id' value={despesa?.id ?? ""} />
					<input
						type='hidden'
						name='comprovanteAtual'
						value={despesa?.comprovante ?? ""}
					/>

					<DialogHeader>
						<DialogTitle>Editar despesa</DialogTitle>
					</DialogHeader>

					<div className='grid gap-3 md:grid-cols-2'>
						<label className='grid gap-1 text-sm'>
							Nome
							<Input type='text' name='nome' required defaultValue={despesa?.nome} />
						</label>

						<SearchableComboboxField
							label='Categoria'
							name='categoria'
							placeholder='Selecione uma categoria'
							options={CATEGORIAS_DESPESA}
							value={categoriaSelecionada}
							onValueChange={setCategoriaSelecionada}
							required
							disabled={isSubmitting}
						/>

						<label className='grid gap-1 text-sm'>
							Valor (R$)
							<Input
								type='number'
								name='valor'
								step='0.01'
								min='0.01'
								required
								defaultValue={despesa?.valor}
							/>
						</label>

						<label className='grid gap-1 text-sm'>
							Data
							<Input type='date' name='data' required defaultValue={dataInput} />
						</label>

						<SearchableComboboxField
							label='Conta'
							name='conta'
							placeholder='Selecione uma conta'
							options={CONTAS_DESPESA}
							value={contaSelecionada}
							onValueChange={setContaSelecionada}
							required
							disabled={isSubmitting}
						/>

						<label className='grid gap-1 text-sm'>
							Fatura (opcional)
							<Input type='text' name='fatura' defaultValue={despesa?.fatura ?? ""} />
						</label>

						<label className='grid gap-1 text-sm md:col-span-2'>
							Novo comprovante (opcional)
							<Input
								type='file'
								name='comprovanteArquivo'
								accept='.pdf,.jpg,.jpeg,.png,.webp,.gif'
							/>
						</label>

						<label className='grid gap-1 text-sm md:col-span-2'>
							Observacao
							<Textarea name='obs' rows={3} defaultValue={despesa?.obs ?? ""} />
						</label>
					</div>

					<label className='flex items-center gap-2 text-sm'>
						<input
							type='checkbox'
							name='brassaco'
							className='size-4'
							defaultChecked={despesa?.brassaco}
						/>
						Despesa brassaco
					</label>

					<DialogFooter className='sm:justify-between'>
						<Button
							type='submit'
							name='intent'
							value='excluir'
							variant='destructive'
							formNoValidate
							disabled={isSubmitting || !despesa}>
							{isSubmitting && submittingIntent === "excluir"
								? "Apagando..."
								: "Apagar despesa"}
						</Button>
						<DialogClose render={<Button type='button' variant='outline' />}>
							Cancelar
						</DialogClose>
						<Button
							type='submit'
							name='intent'
							value='editar'
							variant='outline'
							disabled={isSubmitting || !despesa}>
							{isSubmitting && submittingIntent !== "excluir"
								? "Salvando..."
								: "Salvar alteracoes"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
