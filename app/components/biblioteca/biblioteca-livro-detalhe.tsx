"use client";

import { FileText, Quote, Pencil } from "lucide-react";
import { Button, buttonVariants } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import type { LivroDataTableRow } from "./biblioteca-columns";
import { CapaLivro } from "./capa-livro";

type Props = {
	livro: LivroDataTableRow | null;
	onOpenChange: (aberto: boolean) => void;
	onEditar: (livro: LivroDataTableRow) => void;
};

const ehUrl = (t: string) => /^https?:\/\//i.test(t.trim());

export function BibliotecaLivroDetalhe({ livro, onOpenChange, onEditar }: Props) {
	const data = livro
		? new Date(livro.data).toLocaleDateString("pt-BR", {
				timeZone: "UTC",
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: "";

	return (
		<Dialog open={livro !== null} onOpenChange={onOpenChange}>
			<DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
				{livro && (
					<div className='grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr]'>
						<div className='mx-auto w-40 sm:w-full'>
							<CapaLivro nome={livro.nome} autor={livro.autor} capa={livro.capa} grande />
						</div>
						<div className='flex min-w-0 flex-col gap-3'>
							<div>
								<DialogTitle className='font-serif text-xl leading-snug'>
									{livro.nome}
								</DialogTitle>
								<DialogDescription className='mt-1 text-base'>
									{livro.autor}
								</DialogDescription>
							</div>
							<dl className='grid grid-cols-2 gap-3 text-sm'>
								<div>
									<dt className='text-xs text-muted-foreground'>Terminado em</dt>
									<dd className='font-medium'>{data}</dd>
								</div>
								<div>
									<dt className='text-xs text-muted-foreground'>Páginas</dt>
									<dd className='font-medium tabular-nums'>
										{livro.paginas != null ? livro.paginas.toLocaleString("pt-BR") : "—"}
									</dd>
								</div>
							</dl>
							<div className='mt-auto flex flex-wrap gap-2 pt-2'>
								{ehUrl(livro.nota) && (
									<a
										href={livro.nota}
										target='_blank'
										rel='noreferrer'
										className={buttonVariants({ variant: "default", size: "sm" })}>
										<FileText size={14} /> Caderno / notas
									</a>
								)}
								{ehUrl(livro.citacao) && (
									<a
										href={livro.citacao}
										target='_blank'
										rel='noreferrer'
										className={buttonVariants({ variant: "outline", size: "sm" })}>
										<Quote size={14} /> Citações
									</a>
								)}
								{!ehUrl(livro.citacao) && livro.citacao.trim() && (
									<p className='w-full rounded-md border-l-2 pl-3 text-sm italic text-muted-foreground'>
										{livro.citacao}
									</p>
								)}
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className={cn("ml-auto")}
									onClick={() => onEditar(livro)}>
									<Pencil size={14} /> Editar
								</Button>
							</div>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
