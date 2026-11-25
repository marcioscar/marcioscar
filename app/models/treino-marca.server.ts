import { db } from "../../db.server";

export type MarcaTreino = {
	chave: string;
	nome: string | null;
	prova: boolean;
	distanciaOficialM: number | null;
};

const paraMarca = (m: { chave: string; nome: string | null; prova: boolean; distanciaOficialM: number | null }): MarcaTreino => ({
	chave: m.chave,
	nome: m.nome,
	prova: m.prova,
	distanciaOficialM: m.distanciaOficialM,
});

export async function listarMarcas(): Promise<MarcaTreino[]> {
	return (await db.treinoMarca.findMany()).map(paraMarca);
}

export async function mapaDeMarcas(): Promise<Map<string, MarcaTreino>> {
	return new Map((await listarMarcas()).map((m) => [m.chave, m]));
}

export async function obterMarca(chave: string): Promise<MarcaTreino | null> {
	const m = await db.treinoMarca.findUnique({ where: { chave } });
	return m ? paraMarca(m) : null;
}

/** Grava (ou apaga, se não sobrar nada a guardar) o nome e o "foi prova" de um treino. */
export async function salvarMarca(entrada: {
	chave: string;
	nome?: string | null;
	prova?: boolean;
	distanciaOficialM?: number | null;
}): Promise<MarcaTreino | null> {
	const chave = entrada.chave.trim().slice(0, 80);
	if (!chave) throw new Error("Treino sem identificação.");
	const nome = entrada.nome?.trim().slice(0, 80) || null;
	const prova = !!entrada.prova;
	const oficial = prova && entrada.distanciaOficialM && entrada.distanciaOficialM > 500 && entrada.distanciaOficialM < 200000 ? entrada.distanciaOficialM : null;

	if (!nome && !prova) {
		await db.treinoMarca.deleteMany({ where: { chave } });
		return null;
	}
	const m = await db.treinoMarca.upsert({
		where: { chave },
		create: { chave, nome, prova, distanciaOficialM: oficial },
		update: { nome, prova, distanciaOficialM: oficial },
	});
	return paraMarca(m);
}
