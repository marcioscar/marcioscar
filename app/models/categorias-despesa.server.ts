import { db } from "../../db.server";
import { CATEGORIAS_DESPESA } from "~/components/despesas/despesa-options";

function chaveCategoria(nome: string): string {
	return nome
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.trim()
		.toLowerCase();
}

export async function listarCategoriasDespesa(): Promise<string[]> {
	const cadastradas = await db.categoriasDespesa.findMany({
		select: { nome: true },
	});

	const mapa = new Map<string, string>();
	for (const nome of [...CATEGORIAS_DESPESA, ...cadastradas.map((c) => c.nome)]) {
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
