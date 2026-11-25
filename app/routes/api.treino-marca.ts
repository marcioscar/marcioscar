import type { Route } from './+types/api.treino-marca'
import { exigirTokenTreino } from '~/lib/token-treino.server'
import { listarMarcas, salvarMarca } from '~/models/treino-marca.server'

// Nome e "foi prova" de cada treino, escolhidos no app do iPhone.
// Autenticação: `Authorization: Bearer <TREINO_API_TOKEN>`.
//   GET  → { marcas: [{ chave, nome, prova, distanciaOficialM }] }
//   POST → { chave, nome?, prova?, distanciaOficialM? } grava; sem nome e sem prova, apaga a marca.

const SEM_CACHE = { 'Cache-Control': 'no-store' }

export async function loader({ request }: Route.LoaderArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	return Response.json({ marcas: await listarMarcas() }, { headers: SEM_CACHE })
}

export async function action({ request }: Route.ActionArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	if (request.method !== 'POST') {
		return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: SEM_CACHE })
	}
	let corpo: { chave?: unknown; nome?: unknown; prova?: unknown; distanciaOficialM?: unknown }
	try {
		corpo = await request.json()
	} catch {
		return Response.json({ error: 'JSON inválido.' }, { status: 400, headers: SEM_CACHE })
	}
	if (typeof corpo.chave !== 'string' || !corpo.chave.trim()) {
		return Response.json({ error: 'Envie { chave }.' }, { status: 400, headers: SEM_CACHE })
	}
	const marca = await salvarMarca({
		chave: corpo.chave,
		nome: typeof corpo.nome === 'string' ? corpo.nome : null,
		prova: corpo.prova === true,
		distanciaOficialM: typeof corpo.distanciaOficialM === 'number' ? corpo.distanciaOficialM : null,
	})
	return Response.json({ marca }, { headers: SEM_CACHE })
}
