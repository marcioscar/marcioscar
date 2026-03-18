"use client";

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
	DialogTrigger,
} from "~/components/ui/dialog";

type PagamentoBrassacoDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isSubmitting: boolean;
	totalPagamentosBrassaco: number;
	defaultDataPagamento: string;
	triggerClassName?: string;
};

export function PagamentoBrassacoDialog({
	open,
	onOpenChange,
	isSubmitting,
	totalPagamentosBrassaco,
	defaultDataPagamento,
	triggerClassName,
}: PagamentoBrassacoDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger
				render={<Button variant='outline' className={triggerClassName} />}>
				Pagar Brassaco
			</DialogTrigger>
			<DialogContent className='max-w-lg'>
				<Form method='post' className='grid gap-4'>
					<input type='hidden' name='intent' value='pagar-brassaco' />

					<DialogHeader>
						<DialogTitle>Registrar pagamento da Brassaco</DialogTitle>
					</DialogHeader>

					<p className='text-sm text-muted-foreground'>
						{totalPagamentosBrassaco} pagamento(s) registrado(s)
					</p>

					<div className='grid gap-3'>
						<label className='grid gap-1 text-sm'>
							Data do pagamento
							<Input
								type='date'
								name='dataPagamentoBrassaco'
								required
								defaultValue={defaultDataPagamento}
							/>
						</label>

						<label className='grid gap-1 text-sm'>
							Valor pago (R$)
							<Input
								type='number'
								name='valorPagamentoBrassaco'
								step='0.01'
								min='0.01'
								required
								placeholder='0,00'
							/>
						</label>

						<label className='grid gap-1 text-sm'>
							Observacao (opcional)
							<Textarea
								name='obsPagamentoBrassaco'
								rows={3}
								placeholder='Ex: PIX de acerto semanal'
							/>
						</label>
					</div>

					<DialogFooter>
						<DialogClose render={<Button type='button' variant='outline' />}>
							Cancelar
						</DialogClose>
						<Button type='submit' variant='outline' disabled={isSubmitting}>
							{isSubmitting ? "Registrando..." : "Registrar pagamento"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

