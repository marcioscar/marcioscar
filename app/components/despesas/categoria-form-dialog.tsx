"use client";

import { Form } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";

type CategoriaFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isSubmitting: boolean;
	categorias: string[];
	triggerClassName?: string;
};

export function CategoriaFormDialog({
	open,
	onOpenChange,
	isSubmitting,
	categorias,
	triggerClassName,
}: CategoriaFormDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger
				render={<Button variant='outline' className={triggerClassName} />}>
				Nova categoria
			</DialogTrigger>
			<DialogContent className='max-w-lg'>
				<Form method='post' className='grid gap-4'>
					<input type='hidden' name='intent' value='criar-categoria' />

					<DialogHeader>
						<DialogTitle>Cadastrar categoria</DialogTitle>
					</DialogHeader>

					<label className='grid gap-1 text-sm'>
						Nome
						<Input
							type='text'
							name='nomeCategoria'
							required
							maxLength={40}
							autoComplete='off'
							placeholder='Ex: Pet'
						/>
					</label>

					<div className='grid gap-1 text-sm'>
						<p className='text-muted-foreground'>
							{categorias.length} categorias existentes
						</p>
						<p className='text-muted-foreground max-h-32 overflow-y-auto text-xs'>
							{categorias.join(" · ")}
						</p>
					</div>

					<DialogFooter>
						<DialogClose render={<Button type='button' variant='outline' />}>
							Cancelar
						</DialogClose>
						<Button type='submit' variant='outline' disabled={isSubmitting}>
							{isSubmitting ? "Salvando..." : "Salvar categoria"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
