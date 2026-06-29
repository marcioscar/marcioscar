import { db } from '../../db.server'
import { buscarAtividadeDetalhada } from '~/services/strava/client.server'
import type { SplitMetric } from '~/types/analise'

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

	try {
		const detailed = await buscarAtividadeDetalhada(stravaId)
		const splits = (detailed.splits_metric ?? []) as SplitMetric[]
		await db.corrida.update({ where: { stravaId }, data: { splits } })
		return Response.json({ splits })
	} catch (err) {
		console.error('Erro ao buscar splits:', err)
		return Response.json({ error: 'Falha ao buscar splits do Strava' }, { status: 500 })
	}
}
