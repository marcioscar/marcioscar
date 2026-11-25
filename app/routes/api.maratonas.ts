import type { Route } from './+types/api.maratonas'
import { tempoPrevisto } from '~/lib/vdot'
import { exigirTokenTreino } from '~/lib/token-treino.server'
import { vpontoEmUso } from '~/lib/zonas-pace'
import { DISTANCIA_MARATONA_M, montarMaratonasApp } from '~/models/maratonas-app.server'
import { garantirVponto } from '~/models/vdot-config.server'

// GET /api/maratonas — todas as maratonas, para a aba do app do iPhone (ios/).
// Autenticação: header `Authorization: Bearer <TREINO_API_TOKEN>`.
export async function loader({ request }: Route.LoaderArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	await garantirVponto()

	const dados = await montarMaratonasApp()
	const vponto = vpontoEmUso()
	return Response.json(
		{ ...dados, vpontoAtual: vponto, previsaoSeg: tempoPrevisto(vponto, DISTANCIA_MARATONA_M) },
		{ headers: { 'Cache-Control': 'no-store' } },
	)
}
