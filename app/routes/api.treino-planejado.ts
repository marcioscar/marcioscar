import type { Route } from './+types/api.treino-planejado'
import { exigirTokenTreino } from '~/lib/token-treino.server'
import { MODELOS, sanearTreino, type TreinoManualDados } from '~/lib/treino-manual'
import { listarTreinosManuais, removerTreinoManual, salvarTreinoManual } from '~/models/treino-manual.server'
import { obterProvaAtiva } from '~/models/provas.server'
import { garantirVponto } from '~/models/vdot-config.server'

// Criar, editar, mudar de dia e excluir corridas planejadas pelo app do iPhone (ios/).
// Autenticação: `Authorization: Bearer <TREINO_API_TOKEN>`.
//   GET  → { modelos: [{ id, nome, daniels, descricao, treino }] }, com os paces das zonas em uso
//   POST { intent: 'salvar', treino, substituir? }  (409 se o dia já tem treino e substituir não veio)
//   POST { intent: 'mover', de, para }              (se o destino tem treino, troca os dois de dia)
//   POST { intent: 'excluir', data }

const SEM_CACHE = { 'Cache-Control': 'no-store' }
const erro = (mensagem: string, status: number) => Response.json({ error: mensagem }, { status, headers: SEM_CACHE })
const ok = () => Response.json({ ok: true }, { headers: SEM_CACHE })

function dataValida(v: unknown): v is string {
	if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
	const d = new Date(`${v}T12:00:00Z`)
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

async function noDia(data: string): Promise<TreinoManualDados | null> {
	return (await listarTreinosManuais(data, data))[0] ?? null
}

/** Deixa o dia sem corrida. Com um plano de prova em andamento, precisa ser descanso: senão o treino do plano voltaria. */
async function esvaziarDia(data: string) {
	const prova = await obterProvaAtiva()
	if (prova && prova.dataProva.toISOString().slice(0, 10) >= data) {
		await salvarTreinoManual({
			data, titulo: 'Descanso', tipo: 'descanso', observacao: null, aquecimento: null, blocos: [], desaquecimento: null,
		})
	} else {
		await removerTreinoManual(data)
	}
}

export async function loader({ request }: Route.LoaderArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	await garantirVponto()
	const modelos = MODELOS.filter(m => m.id !== 'descanso').map(m => ({
		id: m.id,
		nome: m.nome,
		daniels: m.daniels,
		descricao: m.descricao,
		treino: { id: `modelo-${m.id}`, origem: 'manual', ...m.criar('2000-01-01') },
	}))
	return Response.json({ modelos }, { headers: SEM_CACHE })
}

export async function action({ request }: Route.ActionArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	if (request.method !== 'POST') return erro('Método não permitido.', 405)

	let c: Record<string, unknown>
	try {
		c = await request.json()
	} catch {
		return erro('JSON inválido.', 400)
	}
	if (!c || typeof c !== 'object') return erro('JSON inválido.', 400)

	if (c.intent === 'salvar') {
		const treino = sanearTreino(c.treino)
		if (!treino || !dataValida(treino.data) || treino.tipo === 'descanso') return erro('Treino inválido.', 400)
		const existente = await noDia(treino.data)
		if (existente && existente.tipo !== 'descanso' && c.substituir !== true) return erro('Esse dia já tem um treino.', 409)
		await salvarTreinoManual(treino)
		return ok()
	}

	if (c.intent === 'mover') {
		if (!dataValida(c.de) || !dataValida(c.para) || c.de === c.para) return erro('Datas inválidas.', 400)
		const [origem, destino] = await Promise.all([noDia(c.de), noDia(c.para)])
		if (!origem || origem.tipo === 'descanso') return erro('Treino não encontrado.', 404)
		// o destino primeiro: se algo falhar no meio, sobra treino repetido em vez de perdido
		await salvarTreinoManual({ ...origem, data: c.para })
		if (destino && destino.tipo !== 'descanso') await salvarTreinoManual({ ...destino, data: c.de })
		else await esvaziarDia(c.de)
		return ok()
	}

	if (c.intent === 'excluir') {
		if (!dataValida(c.data)) return erro('Data inválida.', 400)
		const t = await noDia(c.data)
		if (!t || t.tipo === 'descanso') return erro('Treino não encontrado.', 404)
		await esvaziarDia(c.data)
		return ok()
	}

	return erro('Ação inválida.', 400)
}
