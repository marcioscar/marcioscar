import { db } from '../../db.server'
import { rotaDosStreams } from '~/lib/rota-detalhada.server'
import { buscarStreamsAtividade } from '~/services/strava/client.server'

// POST { stravaId } — busca a rota em alta resolução no Strava, guarda em Corrida.rotaCompleta e devolve.
export async function action({ request }: { request: Request }) {
	if (request.method !== 'POST') {
		return Response.json({ error: 'Method not allowed' }, { status: 405 })
	}

	let stravaId: number
	try {
		stravaId = Number((await request.json()).stravaId)
	} catch {
		return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
	}
	if (!Number.isInteger(stravaId) || stravaId <= 0) {
		return Response.json({ error: 'stravaId inválido.' }, { status: 400 })
	}

	const existente = await db.corrida.findUnique({ where: { stravaId }, select: { rotaCompleta: true } })
	if (!existente) return Response.json({ error: 'Corrida não encontrada.' }, { status: 404 })
	if (existente.rotaCompleta) return Response.json({ rota: existente.rotaCompleta })

	try {
		const rota = rotaDosStreams(await buscarStreamsAtividade(stravaId))
		if (!rota) return Response.json({ rota: null })
		await db.corrida.update({ where: { stravaId }, data: { rotaCompleta: rota } })
		return Response.json({ rota })
	} catch (err) {
		console.error('Falha ao buscar a rota completa no Strava', err)
		return Response.json({ error: 'Não foi possível buscar a rota completa no Strava.' }, { status: 502 })
	}
}
