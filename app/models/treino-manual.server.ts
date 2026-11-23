import { db } from '../../db.server'
import type { TreinoManualDados, TipoTreino } from '~/lib/treino-manual'
import type { EtapaRelogio } from '~/lib/treino-para-relogio'

type Linha = Awaited<ReturnType<typeof db.treinoManual.findMany>>[number]

function paraDados(l: Linha): TreinoManualDados {
	return {
		data: l.data,
		titulo: l.titulo,
		tipo: l.tipo as TipoTreino,
		observacao: l.observacao,
		aquecimento: (l.aquecimento as EtapaRelogio | null) ?? null,
		blocos: (l.blocos as TreinoManualDados['blocos']) ?? [],
		desaquecimento: (l.desaquecimento as EtapaRelogio | null) ?? null,
	}
}

/** Treinos manuais entre duas datas (yyyy-MM-dd, inclusive). Datas são texto, então a ordem lexical funciona. */
export async function listarTreinosManuais(de: string, ate: string): Promise<TreinoManualDados[]> {
	const linhas = await db.treinoManual.findMany({
		where: { data: { gte: de, lte: ate } },
		orderBy: { data: 'asc' },
	})
	return linhas.map(paraDados)
}

/** Um treino por dia: substitui o que já existir na data. */
export async function salvarTreinoManual(t: TreinoManualDados): Promise<void> {
	const dados = {
		titulo: t.titulo,
		tipo: t.tipo,
		observacao: t.observacao,
		aquecimento: t.aquecimento ?? null,
		blocos: t.blocos,
		desaquecimento: t.desaquecimento ?? null,
	}
	const existente = await db.treinoManual.findFirst({ where: { data: t.data } })
	if (existente) {
		await db.treinoManual.update({ where: { id: existente.id }, data: dados })
		return
	}
	await db.treinoManual.create({ data: { data: t.data, ...dados } })
}

export async function removerTreinoManual(data: string): Promise<void> {
	await db.treinoManual.deleteMany({ where: { data } })
}
