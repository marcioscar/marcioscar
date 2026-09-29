import { db } from "../../db.server";
import { CATEGORIAS_DESPESA } from "~/components/despesas/despesa-options";

function chaveCategoria(nome: string): string {
	return nome
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.trim()
		.toLowerCase();
}

// Na primeira leitura a coleção vem vazia: grava as categorias padrão do código
// para que todas possam ser apagadas pela tela.
async function garantirCategoriasIniciais(): Promise<void> {
	const total = await db.categoriasDespesa.count();
	if (total > 0) {
		return;
	}

	await db.categoriasDespesa.createMany({
		data: CATEGORIAS_DESPESA.map((nome) => ({ nome })),
	});
}

export async function listarCategoriasDespesa(): Promise<string[]> {
	await garantirCategoriasIniciais();

	const cadastradas = await db.categoriasDespesa.findMany({
		select: { nome: true },
	});

	const mapa = new Map<string, string>();
	for (const { nome } of cadastradas) {
		const chave = chaveCategoria(nome);
		if (chave && !mapa.has(chave)) {
			mapa.set(chave, nome.trim());
		}
	}

	return Array.from(mapa.values()).sort((a, b) =>
		a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
	);
}

export async function criarCategoriaDespesa(nomeRaw: string): Promise<string> {
	const nome = nomeRaw.trim().replace(/\s+/g, " ");
	if (!nome) {
		throw new Error("Informe o nome da categoria.");
	}
	if (nome.length > 40) {
		throw new Error("O nome da categoria deve ter no maximo 40 caracteres.");
	}

	const existentes = await listarCategoriasDespesa();
	const chave = chaveCategoria(nome);
	const duplicada = existentes.find((c) => chaveCategoria(c) === chave);
	if (duplicada) {
		throw new Error(`A categoria "${duplicada}" ja existe.`);
	}

	await db.categoriasDespesa.create({ data: { nome } });
	return nome;
}

export async function excluirCategoriaDespesa(nomeRaw: string): Promise<string> {
	const nome = nomeRaw.trim();
	if (!nome) {
		throw new Error("Categoria invalida para exclusao.");
	}

	const chave = chaveCategoria(nome);
	const cadastradas = await db.categoriasDespesa.findMany({
		select: { id: true, nome: true },
	});
	const ids = cadastradas
		.filter((c) => chaveCategoria(c.nome) === chave)
		.map((c) => c.id);

	if (ids.length === 0) {
		throw new Error(`A categoria "${nome}" nao foi encontrada.`);
	}

	const total = await db.categoriasDespesa.count();
	if (total - ids.length === 0) {
		throw new Error("Mantenha pelo menos uma categoria cadastrada.");
	}

	await db.categoriasDespesa.deleteMany({ where: { id: { in: ids } } });
	return nome;
}
