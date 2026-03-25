"use client";

import { Input } from "~/components/ui/input";
import type { LivroDataTableRow } from "./biblioteca-columns";

function formatarDataParaInput(dataIso: string): string {
	const d = new Date(dataIso);
	if (Number.isNaN(d.getTime())) {
		return "";
	}
	return d.toISOString().slice(0, 10);
}

type BibliotecaLivroFormFieldsProps = {
	desabilitado: boolean;
	livro?: LivroDataTableRow | null;
};

export function BibliotecaLivroFormFields({
	desabilitado,
	livro,
}: BibliotecaLivroFormFieldsProps) {
	const vazio = !livro;

	return (
		<>
			<label className="grid gap-1 text-sm">
				Nome
				<Input
					name="nome"
					defaultValue={vazio ? "" : livro.nome}
					required
					disabled={desabilitado}
				/>
			</label>

			<label className="grid gap-1 text-sm">
				Data
				<Input
					type="date"
					name="data"
					defaultValue={vazio ? "" : formatarDataParaInput(livro.data)}
					required
					disabled={desabilitado}
				/>
			</label>

			<label className="grid gap-1 text-sm">
				Autor
				<Input
					name="autor"
					defaultValue={vazio ? "" : livro.autor}
					required
					disabled={desabilitado}
				/>
			</label>

			<label className="grid gap-1 text-sm">
				Páginas
				<Input
					name="paginas"
					type="number"
					min={0}
					step={1}
					inputMode="numeric"
					placeholder="Opcional — usado nas estatísticas"
					defaultValue={
						vazio || livro.paginas == null ? "" : String(livro.paginas)
					}
					disabled={desabilitado}
				/>
			</label>

			<label className="grid gap-1 text-sm">
				URL da capa
				<Input
					name="capa"
					defaultValue={vazio ? "" : livro.capa}
					placeholder="https://..."
					disabled={desabilitado}
				/>
			</label>

			<div className="grid gap-2 rounded-md border p-3">
				<p className="text-muted-foreground text-xs">
					Citação: guarde o link do arquivo. Cole uma URL ou envie um arquivo
					(substitui a URL ao salvar).
				</p>
				<label className="grid gap-1 text-sm">
					Link da citação
					<Input
						name="citacao"
						type="text"
						inputMode="url"
						autoComplete="off"
						placeholder="https://..."
						defaultValue={vazio ? "" : livro.citacao}
						disabled={desabilitado}
					/>
				</label>
				<label className="grid gap-1 text-sm">
					Arquivo da citação (opcional)
					<Input
						type="file"
						name="arquivoCitacao"
						disabled={desabilitado}
						className="cursor-pointer text-sm file:mr-2"
					/>
				</label>
			</div>

			<div className="grid gap-2 rounded-md border p-3">
				<p className="text-muted-foreground text-xs">
					Nota: guarde o link do arquivo. Cole uma URL ou envie um arquivo
					(substitui a URL ao salvar).
				</p>
				<label className="grid gap-1 text-sm">
					Link da nota
					<Input
						name="nota"
						type="text"
						inputMode="url"
						autoComplete="off"
						placeholder="https://..."
						defaultValue={vazio ? "" : livro.nota}
						disabled={desabilitado}
					/>
				</label>
				<label className="grid gap-1 text-sm">
					Arquivo da nota (opcional)
					<Input
						type="file"
						name="arquivoNota"
						disabled={desabilitado}
						className="cursor-pointer text-sm file:mr-2"
					/>
				</label>
			</div>
		</>
	);
}
