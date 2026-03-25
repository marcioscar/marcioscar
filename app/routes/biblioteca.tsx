import type { Route } from "./+types/biblioteca";
import { useLoaderData } from "react-router";
import { BibliotecaDataTable } from "~/components/biblioteca/biblioteca-data-table";
import type { LivroDataTableRow } from "~/components/biblioteca/biblioteca-columns";
import { BibliotecaEstatisticas } from "~/components/biblioteca/biblioteca-estatisticas";
import {
	atualizarLivro,
	criarLivro,
	listarLivros,
	obterEstatisticasBiblioteca,
	type LivroAtualizavel,
} from "~/models/biblioteca.server";
import { uploadReciboAndGetUrl } from "~/models/pocketbase.server";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Biblioteca | Marcioscar" },
		{ name: "description", content: "Livros da biblioteca" },
	];
}

type LoaderData = {
	livros: LivroDataTableRow[];
	stats: Awaited<ReturnType<typeof obterEstatisticasBiblioteca>>;
};

function mapearLivrosParaTabela(
	livros: Awaited<ReturnType<typeof listarLivros>>,
): LivroDataTableRow[] {
	return livros.map((l) => ({
		id: l.id,
		nome: l.nome,
		data: l.data.toISOString(),
		capa: l.capa,
		citacao: l.citacao,
		nota: l.nota,
		autor: l.autor,
		paginas: l.paginas ?? null,
	}));
}

export async function loader({}: Route.LoaderArgs): Promise<LoaderData> {
	const [livros, stats] = await Promise.all([
		listarLivros(),
		obterEstatisticasBiblioteca(),
	]);
	return { livros: mapearLivrosParaTabela(livros), stats };
}

function parseStringOpcional(raw: FormDataEntryValue | null): string {
	return typeof raw === "string" ? raw.trim() : "";
}

function parseStringObrigatorio(
	raw: FormDataEntryValue | null,
	campo: string,
): string {
	const s = parseStringOpcional(raw);
	if (!s) {
		throw new Error(`${campo} é obrigatório.`);
	}
	return s;
}

function parseDataLivro(raw: FormDataEntryValue | null): Date {
	if (typeof raw !== "string" || !raw) {
		throw new Error("Informe a data.");
	}
	const data = new Date(`${raw}T00:00:00.000Z`);
	if (Number.isNaN(data.getTime())) {
		throw new Error("Data inválida.");
	}
	return data;
}

function parsePaginasOpcional(raw: FormDataEntryValue | null): number | null {
	if (typeof raw !== "string" || !raw.trim()) {
		return null;
	}
	const n = Number.parseInt(raw.trim(), 10);
	if (!Number.isFinite(n) || n < 0) {
		throw new Error("Páginas deve ser um número inteiro maior ou igual a zero.");
	}
	return n;
}

type ActionData = {
	ok: boolean;
	message: string;
};

async function uploadArquivoPocketBaseSeExiste(
	arquivo: FormDataEntryValue | null,
): Promise<string | null> {
	if (!(arquivo instanceof File) || arquivo.size === 0) {
		return null;
	}
	const bytes = await arquivo.arrayBuffer();
	return uploadReciboAndGetUrl(Buffer.from(bytes), arquivo.name);
}

function resolverLinkCampo(
	urlDigitada: string,
	urlDoUpload: string | null,
): string {
	if (urlDoUpload) {
		return urlDoUpload;
	}
	return urlDigitada.trim();
}

async function montarDadosLivroDoForm(formData: FormData): Promise<LivroAtualizavel> {
	const citacaoUpload = await uploadArquivoPocketBaseSeExiste(
		formData.get("arquivoCitacao"),
	);
	const notaUpload = await uploadArquivoPocketBaseSeExiste(
		formData.get("arquivoNota"),
	);

	return {
		nome: parseStringObrigatorio(formData.get("nome"), "Nome"),
		data: parseDataLivro(formData.get("data")),
		autor: parseStringObrigatorio(formData.get("autor"), "Autor"),
		paginas: parsePaginasOpcional(formData.get("paginas")),
		capa: parseStringOpcional(formData.get("capa")),
		citacao: resolverLinkCampo(
			parseStringOpcional(formData.get("citacao")),
			citacaoUpload,
		),
		nota: resolverLinkCampo(
			parseStringOpcional(formData.get("nota")),
			notaUpload,
		),
	};
}

async function processarAtualizar(
	formData: FormData,
): Promise<ActionData> {
	const idRaw = formData.get("id");
	if (typeof idRaw !== "string" || !idRaw.trim()) {
		return { ok: false, message: "Identificador do livro inválido." };
	}

	const dados = await montarDadosLivroDoForm(formData);
	await atualizarLivro(idRaw.trim(), dados);
	return { ok: true, message: "Livro atualizado com sucesso." };
}

async function processarCriar(formData: FormData): Promise<ActionData> {
	const dados = await montarDadosLivroDoForm(formData);
	await criarLivro(dados);
	return { ok: true, message: "Livro criado com sucesso." };
}

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
	const formData = await request.formData();
	const intent = formData.get("intent");

	try {
		if (intent === "atualizar") {
			return await processarAtualizar(formData);
		}
		if (intent === "criar") {
			return await processarCriar(formData);
		}
		return { ok: false, message: "Ação inválida." };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Erro ao salvar o livro.";
		return { ok: false, message };
	}
}

export default function Biblioteca() {
	const { livros, stats } = useLoaderData<typeof loader>();

	return (
		<main className="grid w-full min-w-0 max-w-full gap-4">
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<h1 className="text-2xl font-bold">Biblioteca</h1>
			</div>

			<BibliotecaEstatisticas stats={stats} />

			<section className="min-w-0 max-w-full rounded-md border">
				<div className="border-b px-4 py-3">
					<h2 className="text-lg font-semibold">Livros</h2>
					<p className="text-muted-foreground break-words text-sm">
						Pesquise na tabela, adicione livros ou use o ícone de edição. Citação
						e nota ficam como links (URL ou arquivo enviado ao PocketBase).
					</p>
				</div>
				<div className="min-w-0 p-4">
					<BibliotecaDataTable livros={livros} />
				</div>
			</section>
		</main>
	);
}
