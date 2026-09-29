"use client";

import { useEffect, useState } from "react";
import { Form, useFetcher } from "react-router";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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

type CategoriaActionData = {
	ok: boolean;
	message: string;
	operacao: string;
};

type AcaoCategoria = { tipo: "excluir" | "editar"; categoria: string };

export function CategoriaFormDialog({
	open,
	onOpenChange,
	isSubmitting,
	categorias,
	triggerClassName,
}: CategoriaFormDialogProps) {
	const fetcher = useFetcher<CategoriaActionData>();
	const [acao, setAcao] = useState<AcaoCategoria | null>(null);
	const [novoNome, setNovoNome] = useState("");
	const [atualizarDespesas, setAtualizarDespesas] = useState(true);
	const categoriaProcessando =
		fetcher.state !== "idle"
			? String(fetcher.formData?.get("nomeCategoria") ?? "")
			: null;

	useEffect(() => {
		if (!open) {
			setAcao(null);
		}
	}, [open]);

	useEffect(() => {
		const data = fetcher.data;
		if (!data || fetcher.state !== "idle") {
			return;
		}

		if (data.ok) {
			setAcao(null);
			toast.success(data.message);
			return;
		}

		const titulo =
			data.operacao === "editar-categoria"
				? "Falha ao editar categoria"
				: "Falha ao apagar categoria";
		toast.error(titulo, { description: data.message });
	}, [fetcher.data, fetcher.state]);

	function iniciarEdicao(categoria: string) {
		setNovoNome(categoria);
		setAtualizarDespesas(true);
		setAcao({ tipo: "editar", categoria });
	}

	function excluirCategoria(nome: string) {
		fetcher.submit(
			{ intent: "excluir-categoria", nomeCategoria: nome },
			{ method: "post" },
		);
	}

	function renomearCategoria(nome: string) {
		fetcher.submit(
			{
				intent: "editar-categoria",
				nomeCategoria: nome,
				novoNomeCategoria: novoNome,
				...(atualizarDespesas ? { atualizarDespesas: "on" } : {}),
			},
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
							const processando = categoriaProcessando === categoria;

							if (acao?.categoria === categoria && acao.tipo === "editar") {
								return (
									<li key={categoria} className='grid gap-2 px-3 py-2 text-sm'>
										<form
											className='flex items-center gap-1'
											onSubmit={(e) => {
												e.preventDefault();
												renomearCategoria(categoria);
											}}>
											<Input
												type='text'
												value={novoNome}
												onChange={(e) => setNovoNome(e.target.value)}
												required
												maxLength={40}
												autoComplete='off'
												autoFocus
												aria-label={`Novo nome para ${categoria}`}
												className='h-8'
											/>
											<Button
												type='button'
												size='xs'
												variant='ghost'
												disabled={processando}
												onClick={() => setAcao(null)}>
												Cancelar
											</Button>
											<Button
												type='submit'
												size='xs'
												variant='outline'
												disabled={processando || !novoNome.trim()}>
												{processando ? "Salvando..." : "Salvar"}
											</Button>
										</form>
										<label className='text-muted-foreground flex items-center gap-2 text-xs'>
											<input
												type='checkbox'
												className='size-3.5'
												checked={atualizarDespesas}
												onChange={(e) => setAtualizarDespesas(e.target.checked)}
											/>
											Renomear tambem nas despesas que usam essa categoria
										</label>
									</li>
								);
							}

							const confirmandoExclusao =
								acao?.categoria === categoria && acao.tipo === "excluir";

							return (
								<li
									key={categoria}
									className='flex items-center justify-between gap-2 px-3 py-1.5 text-sm'>
									<span className='truncate'>{categoria}</span>
									{confirmandoExclusao ? (
										<div className='flex shrink-0 items-center gap-1'>
											<Button
												type='button'
												size='xs'
												variant='ghost'
												disabled={processando}
												onClick={() => setAcao(null)}>
												Cancelar
											</Button>
											<Button
												type='button'
												size='xs'
												variant='destructive'
												disabled={processando}
												onClick={() => excluirCategoria(categoria)}>
												{processando ? "Apagando..." : "Apagar"}
											</Button>
										</div>
									) : (
										<div className='flex shrink-0 items-center'>
											<Button
												type='button'
												size='icon-sm'
												variant='ghost'
												aria-label={`Editar categoria ${categoria}`}
												disabled={categoriaProcessando !== null}
												onClick={() => iniciarEdicao(categoria)}>
												<Pencil size={14} className='text-muted-foreground' />
											</Button>
											<Button
												type='button'
												size='icon-sm'
												variant='ghost'
												aria-label={`Apagar categoria ${categoria}`}
												disabled={categoriaProcessando !== null}
												onClick={() => setAcao({ tipo: "excluir", categoria })}>
												<Trash2 size={14} className='text-muted-foreground' />
											</Button>
										</div>
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
