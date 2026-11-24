import { PrismaClient } from '@prisma/client'
import { db } from '../../db.server'
import type { ExercicioAcademia, GrupoAcademia, TreinoMusculacaoDados } from '~/lib/musculacao'

// ── Catálogo de treinos da academia ──────────────────────────────────────────
// Fonte ao vivo: banco `quattor`, coleção `treinos`, do sistema da academia — lida com um segundo
// cliente Prisma apontado para QUATTOR_DATABASE_URL (idealmente um usuário só de leitura).
// Sem essa variável, usa a cópia local (AcademiaTreino), que só tem as semanas que foram importadas.

let clienteAcademia: PrismaClient | null = null

function clienteDaAcademia(): PrismaClient | null {
	const url = process.env.QUATTOR_DATABASE_URL
	if (!url) return null
	clienteAcademia ??= new PrismaClient({ datasourceUrl: url })
	return clienteAcademia
}

export type CatalogoSemana = {
	fonte: 'quattor' | 'copia-local'
	grupos: GrupoAcademia[]
}

function limparExercicios(lista: unknown): ExercicioAcademia[] {
	if (!Array.isArray(lista)) return []
	return lista
		.map(e => {
			const x = (e ?? {}) as Record<string, unknown>
			return {
				nome: String(x.nome ?? '').trim(),
				Repeticoes: typeof x.Repeticoes === 'string' ? x.Repeticoes : undefined,
				obs: typeof x.obs === 'string' ? x.obs : undefined,
			}
		})
		.filter(e => e.nome)
}

export async function listarGruposDaSemana(ano: number, semana: number): Promise<CatalogoSemana> {
	const academia = clienteDaAcademia()
	if (academia) {
		const r = (await academia.$runCommandRaw({
			find: 'treinos',
			filter: { ano: { $in: [ano, { $numberLong: String(ano) }] }, semana: { $in: [semana, { $numberLong: String(semana) }] } },
			projection: { grupo: 1, exercicios: 1 },
			sort: { grupo: 1 },
			limit: 60,
		})) as unknown as { cursor?: { firstBatch?: { grupo?: string; exercicios?: unknown }[] } }
		const grupos = (r.cursor?.firstBatch ?? [])
			.filter(d => d.grupo)
			.map(d => ({ grupo: String(d.grupo), exercicios: limparExercicios(d.exercicios) }))
		return { fonte: 'quattor', grupos }
	}

	const linhas = await db.academiaTreino.findMany({ where: { ano, semana }, orderBy: { grupo: 'asc' } })
	return {
		fonte: 'copia-local',
		grupos: linhas.map(l => ({ grupo: l.grupo, exercicios: limparExercicios(l.exercicios) })),
	}
}

// ── Treino de musculação de cada dia ────────────────────────────────────────

type Linha = Awaited<ReturnType<typeof db.treinoMusculacao.findMany>>[number]

function paraDados(l: Linha): TreinoMusculacaoDados {
	return {
		data: l.data,
		grupo: l.grupo,
		descansoSeg: l.descansoSeg,
		exercicios: (l.exercicios as TreinoMusculacaoDados['exercicios']) ?? [],
		observacao: l.observacao,
	}
}

export async function listarMusculacao(de: string, ate: string): Promise<TreinoMusculacaoDados[]> {
	const linhas = await db.treinoMusculacao.findMany({
		where: { data: { gte: de, lte: ate } },
		orderBy: { data: 'asc' },
	})
	return linhas.map(paraDados)
}

export async function salvarMusculacao(t: TreinoMusculacaoDados): Promise<void> {
	const dados = {
		grupo: t.grupo,
		descansoSeg: t.descansoSeg,
		exercicios: t.exercicios,
		observacao: t.observacao,
	}
	await db.treinoMusculacao.upsert({ where: { data: t.data }, create: { data: t.data, ...dados }, update: dados })
}

export async function removerMusculacao(data: string): Promise<void> {
	await db.treinoMusculacao.deleteMany({ where: { data } })
}
