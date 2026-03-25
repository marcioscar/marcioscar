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
import type { LivroDataTableRow } from "./biblioteca-columns";
import { BibliotecaLivroFormFields } from "./biblioteca-livro-form-fields";

type ActionResponse = { ok?: boolean; message?: string } | undefined;

type BibliotecaEditDialogProps = {
	livro: LivroDataTableRow | null;
	open: boolean;
	onOpenChange: (aberto: boolean) => void;
};

export function BibliotecaEditDialog({
	livro,
	open,
	onOpenChange,
}: BibliotecaEditDialogProps) {
	const fetcher = useFetcher<ActionResponse>();
	const enviando = fetcher.state !== "idle";
	const aguardandoRespostaRef = React.useRef(false);

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
			toast.success(fetcher.data.message ?? "Livro atualizado.");
			onOpenChange(false);
			return;
		}
		toast.error(fetcher.data.message ?? "Não foi possível salvar.");
	}, [fetcher.state, fetcher.data, onOpenChange]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" showCloseButton={!enviando}>
				<DialogHeader>
					<DialogTitle>Editar livro</DialogTitle>
					<DialogDescription>
						Altere os campos e salve. A data usa meia-noite UTC do dia escolhido.
						Para citação ou nota, enviar um arquivo grava no PocketBase e substitui
						o link digitado.
					</DialogDescription>
				</DialogHeader>

				{livro ? (
					<fetcher.Form
						key={livro.id}
						method="post"
						encType="multipart/form-data"
						className="grid gap-3"
						onSubmit={() => {
							aguardandoRespostaRef.current = true;
						}}>
						<input type="hidden" name="intent" value="atualizar" />
						<input type="hidden" name="id" value={livro.id} />

						<BibliotecaLivroFormFields desabilitado={enviando} livro={livro} />

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={enviando}
								onClick={() => onOpenChange(false)}>
								Cancelar
							</Button>
							<Button type="submit" disabled={enviando}>
								{enviando ? "Salvando…" : "Salvar"}
							</Button>
						</DialogFooter>
					</fetcher.Form>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
