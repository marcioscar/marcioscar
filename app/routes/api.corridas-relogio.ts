import type { Route } from './+types/api.corridas-relogio'
import { exigirTokenTreino } from '~/lib/token-treino.server'
import { listarResumosParaApp, montarResultadoParaApp } from '~/models/resultado-corrida.server'

// Resultados das corridas lidas do Apple Watch, para o app do iPhone.
//   GET /api/corridas-relogio?limite=20  → lista resumida (mais recentes primeiro)
//   GET /api/corridas-relogio?id=<healthId> → resultado completo de uma corrida
// Autenticação: `Authorization: Bearer <TREINO_API_TOKEN>`.

const SEM_CACHE = { 'Cache-Control': 'no-store' }

export async function loader({ request }: Route.LoaderArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado

	const url = new URL(request.url)
	const id = url.searchParams.get('id')
	if (id) {
		if (!/^[0-9A-Fa-f-]{36}$/.test(id)) {
			return Response.json({ error: 'id inválido.' }, { status: 400, headers: SEM_CACHE })
		}
		const resultado = await montarResultadoParaApp(id)
		if (!resultado) return Response.json({ error: 'Corrida não encontrada.' }, { status: 404, headers: SEM_CACHE })
		return Response.json(resultado, { headers: SEM_CACHE })
	}

	const limite = Math.min(Math.max(Number(url.searchParams.get('limite')) || 20, 1), 60)
	return Response.json({ corridas: await listarResumosParaApp(limite) }, { headers: SEM_CACHE })
}
