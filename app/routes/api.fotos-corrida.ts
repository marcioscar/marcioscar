import { buscarFotosAtividade } from '~/services/strava/client.server'

// GET /api/fotos-corrida?stravaId=123 — fotos da atividade no Strava (URLs públicas)
export async function loader({ request }: { request: Request }) {
	const stravaId = Number(new URL(request.url).searchParams.get('stravaId'))
	if (!Number.isInteger(stravaId) || stravaId <= 0) {
		return Response.json({ fotos: [] })
	}

	try {
		const fotos = await buscarFotosAtividade(stravaId)
		return Response.json({ fotos })
	} catch (err) {
		console.error('Erro ao buscar fotos:', err)
		return Response.json({ error: 'Falha ao buscar as fotos no Strava' }, { status: 502 })
	}
}
