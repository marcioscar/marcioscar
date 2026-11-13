import { db } from '../../db.server'
import { buscarAtividadeDetalhada } from '~/services/strava/client.server'
import type { SplitMetric, LapData, BuscarDetalhesResponse } from '~/types/analise'

export async function action({ request }: { request: Request }) {
	if (request.method !== 'POST') {
		return Response.json({ error: 'Method not allowed' }, { status: 405 })
	}

	let stravaId: number
	try {
		const body = await request.json()
		stravaId = body.stravaId
	} catch {
		return Response.json({ error: 'Invalid body' }, { status: 400 })
	}
	if (!Number.isInteger(stravaId) || stravaId <= 0) {
		return Response.json({ error: 'Atividade sem id do Strava' }, { status: 400 })
	}
	try {
		const detailed = await buscarAtividadeDetalhada(stravaId)
		const splits = (detailed.splits_metric ?? []) as SplitMetric[]
		const laps = (detailed.laps ?? []) as LapData[]
		const calorias =
			typeof detailed.calories === 'number' ? Math.round(detailed.calories) : null
		const temperaturaMedia =
			typeof detailed.average_temp === 'number' ? detailed.average_temp : null

		await db.corrida.update({
			where: { stravaId },
			data: { splits, laps, calorias, temperaturaMedia },
		})

		const response: BuscarDetalhesResponse = { splits, laps, calorias, temperaturaMedia }
		return Response.json(response)
	} catch (err) {
		console.error('Erro ao buscar detalhes:', err)
		return Response.json({ error: 'Falha ao buscar dados do Strava' }, { status: 500 })
	}
}
