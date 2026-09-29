"use client";

import { useEffect, useState } from "react";
import { Form, useFetcher } from "react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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

type ExcluirActionData = {
	ok: boolean;
	message: string;
	operacao: string;
};

export function CategoriaFormDialog({
	open,
	onOpenChange,
	isSubmitting,
	categorias,
	triggerClassName,
}: CategoriaFormDialogProps) {
	const excluirFetcher = useFetcher<ExcluirActionData>();
	const [categoriaConfirmando, setCategoriaConfirmando] = useState<
		string | null
	>(null);
	const categoriaExcluindo =
		excluirFetcher.state !== "idle"
			? String(excluirFetcher.formData?.get("nomeCategoria") ?? "")
			: null;

	useEffect(() => {
		if (!open) {
			setCategoriaConfirmando(null);
		}
	}, [open]);

	useEffect(() => {
		const data = excluirFetcher.data;
		if (!data || excluirFetcher.state !== "idle") {
			return;
		}

		setCategoriaConfirmando(null);
		if (data.ok) {
			toast.success(data.message);
			return;
		}

		toast.error("Falha ao apagar categoria", { description: data.message });
	}, [excluirFetcher.data, excluirFetcher.state]);

	function excluirCategoria(nome: string) {
		excluirFetcher.submit(
			{ intent: "excluir-categoria", nomeCategoria: nome },
			{ method: "post" },
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger
				render={<Button variant='outline' className={triggerClassName} />}>
				Categorias
			</DialogTrigger>
			<DialogContent className='max-h-[90vh] max-w-lg overflow-y-auto'>
				<Form method='post' className='grid gap-4'>
					<input type='hidden' name='intent' value='criar-categoria' />

					<DialogHeader>
						<DialogTitle>Categorias de despesa</DialogTitle>
					</DialogHeader>

					<div className='flex items-end gap-2'>
						<label className='grid flex-1 gap-1 text-sm'>
							Nova categoria
							<Input
								type='text'
								name='nomeCategoria'
								required
								maxLength={40}
								autoComplete='off'
								placeholder='Ex: Pet'
							/>
						</label>
						<Button type='submit' variant='outline' disabled={isSubmitting}>
							{isSubmitting ? "Salvando..." : "Adicionar"}
						</Button>
					</div>
				</Form>

				<div className='grid gap-2'>
					<p className='text-muted-foreground text-sm'>
						{categorias.length} categorias cadastradas
					</p>
					<ul className='max-h-72 divide-y overflow-y-auto rounded-md border'>
						{categorias.map((categoria) => {
							const confirmando = categoriaConfirmando === categoria;
							const excluindo = categoriaExcluindo === categoria;
							return (
								<li
									key={categoria}
									className='flex items-center justify-between gap-2 px-3 py-1.5 text-sm'>
									<span className='truncate'>{categoria}</span>
									{confirmando ? (
										<div className='flex shrink-0 items-center gap-1'>
											<Button
												type='button'
												size='xs'
												variant='ghost'
												disabled={excluindo}
												onClick={() => setCategoriaConfirmando(null)}>
												Cancelar
											</Button>
											<Button
												type='button'
												size='xs'
												variant='destructive'
												disabled={excluindo}
												onClick={() => excluirCategoria(categoria)}>
												{excluindo ? "Apagando..." : "Apagar"}
											</Button>
										</div>
									) : (
										<Button
											type='button'
											size='icon-sm'
											variant='ghost'
											aria-label={`Apagar categoria ${categoria}`}
											disabled={categoriaExcluindo !== null}
											onClick={() => setCategoriaConfirmando(categoria)}>
											<Trash2 size={14} className='text-muted-foreground' />
										</Button>
									)}
								</li>
							);
						})}
					</ul>
					<p className='text-muted-foreground text-xs'>
						Apagar uma categoria so a remove das opcoes. As despesas que ja
						usam o nome continuam com ele.
					</p>
				</div>

				<DialogFooter>
					<DialogClose render={<Button type='button' variant='outline' />}>
						Fechar
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
