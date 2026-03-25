"use client";

import * as React from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { BibliotecaLivroFormFields } from "./biblioteca-livro-form-fields";

type ActionResponse = { ok?: boolean; message?: string } | undefined;

type BibliotecaNovoDialogProps = {
	open: boolean;
	onOpenChange: (aberto: boolean) => void;
};

export function BibliotecaNovoDialog({ open, onOpenChange }: BibliotecaNovoDialogProps) {
	const fetcher = useFetcher<ActionResponse>();
	const enviando = fetcher.state !== "idle";
	const aguardandoRespostaRef = React.useRef(false);
	const [formKey, setFormKey] = React.useState(0);

	React.useEffect(() => {
		if (!open) {
			aguardandoRespostaRef.current = false;
		}
	}, [open]);

	React.useEffect(() => {
		if (fetcher.state !== "idle" || !fetcher.data || !aguardandoRespostaRef.current) {
			return;
		}
		aguardandoRespostaRef.current = false;
		if (fetcher.data.ok) {
			toast.success(fetcher.data.message ?? "Livro criado.");
			setFormKey((k) => k + 1);
			onOpenChange(false);
			return;
		}
		toast.error(fetcher.data.message ?? "Não foi possível criar o livro.");
	}, [fetcher.state, fetcher.data, onOpenChange]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" showCloseButton={!enviando}>
				<DialogHeader>
					<DialogTitle>Novo livro</DialogTitle>
					<DialogDescription>
						Preencha os dados obrigatórios. Citação e nota podem ser URLs ou
						arquivos enviados ao PocketBase (o link público é salvo no banco).
					</DialogDescription>
				</DialogHeader>

				<fetcher.Form
					key={formKey}
					method="post"
					encType="multipart/form-data"
					className="grid gap-3"
					onSubmit={() => {
						aguardandoRespostaRef.current = true;
					}}>
					<input type="hidden" name="intent" value="criar" />

					<BibliotecaLivroFormFields desabilitado={enviando} />

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={enviando}
							onClick={() => onOpenChange(false)}>
							Cancelar
						</Button>
						<Button type="submit" disabled={enviando}>
							{enviando ? "Criando…" : "Criar livro"}
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
