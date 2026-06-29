import { db } from "../../db.server";

export type ProvaAlvo = {
	id: string;
	nome: string;
	plano: string;
	dataProva: Date;
	paceAlvo: string;
	kmSemanais: number;
	diasTreino: string[];
	semanasCompletas: number[];
	ativa: boolean;
	createdAt: Date;
};

export async function listarProvas(): Promise<ProvaAlvo[]> {
	return db.provaAlvo.findMany({ orderBy: { dataProva: "asc" } });
}

export async function obterProvaAtiva(): Promise<ProvaAlvo | null> {
	return db.provaAlvo.findFirst({ where: { ativa: true } });
}

export async function criarProva(data: {
	nome: string;
	plano: string;
	dataProva: Date;
	paceAlvo: string;
	kmSemanais: number;
	diasTreino: string[];
}): Promise<ProvaAlvo> {
	await db.provaAlvo.updateMany({ where: { ativa: true }, data: { ativa: false } });
	return db.provaAlvo.create({
		data: { ...data, semanasCompletas: [], ativa: true },
	});
}

export async function selecionarProva(id: string): Promise<void> {
	await db.provaAlvo.updateMany({ data: { ativa: false } });
	await db.provaAlvo.update({ where: { id }, data: { ativa: true } });
}

export async function atualizarConfigs(
	id: string,
	data: { paceAlvo: string; kmSemanais: number; diasTreino: string[] },
): Promise<void> {
	await db.provaAlvo.update({ where: { id }, data });
}

export async function toggleSemanaCompleta(
	id: string,
	semana: number,
): Promise<{ semanasCompletas: number[] }> {
	const prova = await db.provaAlvo.findUnique({
		where: { id },
		select: { semanasCompletas: true },
	});
	if (!prova) throw new Error("Prova não encontrada");

	const atual = prova.semanasCompletas;
	const novas = atual.includes(semana)
		? atual.filter((s) => s !== semana)
		: [...atual, semana];

	await db.provaAlvo.update({ where: { id }, data: { semanasCompletas: novas } });
	return { semanasCompletas: novas };
}

export async function editarProva(
	id: string,
	data: {
		nome: string;
		plano: string;
		dataProva: Date;
		paceAlvo: string;
		kmSemanais: number;
		diasTreino: string[];
	},
): Promise<void> {
	await db.provaAlvo.update({ where: { id }, data });
}

export async function deletarProva(id: string): Promise<void> {
	await db.provaAlvo.delete({ where: { id } });
}
