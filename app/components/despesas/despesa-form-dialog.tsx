"use client";

import { useEffect, useState } from "react";
import { Form } from "react-router";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { SearchableComboboxField } from "./searchable-combobox-field";
import { CATEGORIAS_DESPESA, CONTAS_DESPESA } from "./despesa-options";

type DespesaFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isSubmitting: boolean;
	triggerClassName?: string;
};

export function DespesaFormDialog({
	open,
	onOpenChange,
	isSubmitting,
	triggerClassName,
}: DespesaFormDialogProps) {
	const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
	const [contaSelecionada, setContaSelecionada] = useState("");

	useEffect(() => {
		if (!open) {
			setCategoriaSelecionada("");
			setContaSelecionada("");
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger
				render={<Button variant='outline' className={triggerClassName} />}>
				Nova despesa
			</DialogTrigger>
			<DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
				<Form method='post' encType='multipart/form-data' className='grid gap-4'>
					<DialogHeader>
						<DialogTitle>Cadastrar despesa</DialogTitle>
					</DialogHeader>

					<div className='grid gap-3 md:grid-cols-2'>
						<label className='grid gap-1 text-sm'>
							Nome
							<Input type='text' name='nome' required />
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
							/>
						</label>

						<label className='grid gap-1 text-sm'>
							Data
							<Input type='date' name='data' required />
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
							<Input type='text' name='fatura' />
						</label>

						<label className='grid gap-1 text-sm md:col-span-2'>
							Comprovante (upload opcional)
							<Input
								type='file'
								name='comprovanteArquivo'
								accept='.pdf,.jpg,.jpeg,.png,.webp,.gif'
							/>
						</label>

						<label className='grid gap-1 text-sm md:col-span-2'>
							Observacao
							<Textarea name='obs' rows={3} />
						</label>
					</div>

					<label className='flex items-center gap-2 text-sm'>
						<Checkbox name='brassaco' />
						Despesa brassaco
					</label>

					<DialogFooter>
						<DialogClose render={<Button type='button' variant='outline' />}>
							Cancelar
						</DialogClose>
						<Button type='submit' variant='outline' disabled={isSubmitting}>
							{isSubmitting ? "Salvando..." : "Salvar despesa"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
