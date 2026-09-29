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

function normalizarNomeCategoria(nomeRaw: string): string {
	const nome = nomeRaw.trim().replace(/\s+/g, " ");
	if (!nome) {
		throw new Error("Informe o nome da categoria.");
	}
	if (nome.length > 40) {
		throw new Error("O nome da categoria deve ter no maximo 40 caracteres.");
	}
	return nome;
}

export async function criarCategoriaDespesa(nomeRaw: string): Promise<string> {
	const nome = normalizarNomeCategoria(nomeRaw);

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

export async function renomearCategoriaDespesa(input: {
	nomeAtual: string;
	nomeNovo: string;
	atualizarDespesas: boolean;
}): Promise<{ nome: string; despesasAtualizadas: number }> {
	const nomeAtual = input.nomeAtual.trim();
	const nome = normalizarNomeCategoria(input.nomeNovo);
	const chaveAtual = chaveCategoria(nomeAtual);
	const chaveNova = chaveCategoria(nome);

	const cadastradas = await db.categoriasDespesa.findMany({
		select: { id: true, nome: true },
	});
	const ids = cadastradas
		.filter((c) => chaveCategoria(c.nome) === chaveAtual)
		.map((c) => c.id);
	if (ids.length === 0) {
		throw new Error(`A categoria "${nomeAtual}" nao foi encontrada.`);
	}

	// A mesma categoria pode trocar só maiúsculas/acentos; outra com a mesma chave não
	const duplicada = cadastradas.find(
		(c) => chaveNova !== chaveAtual && chaveCategoria(c.nome) === chaveNova,
	);
	if (duplicada) {
		throw new Error(`A categoria "${duplicada.nome.trim()}" ja existe.`);
	}

	await db.categoriasDespesa.updateMany({
		where: { id: { in: ids } },
		data: { nome },
	});

	if (!input.atualizarDespesas) {
		return { nome, despesasAtualizadas: 0 };
	}

	const usadas = await db.despesas.groupBy({ by: ["categoria"] });
	const variantes = usadas
		.map((u) => u.categoria)
		.filter((c) => chaveCategoria(c) === chaveAtual && c !== nome);
	if (variantes.length === 0) {
		return { nome, despesasAtualizadas: 0 };
	}

	const resultado = await db.despesas.updateMany({
		where: { categoria: { in: variantes } },
		data: { categoria: nome },
	});
	return { nome, despesasAtualizadas: resultado.count };
}
