import { interpretarTextoTreinador } from '~/models/treino-treinador.server'

export async function action({ request }: { request: Request }) {
	if (request.method !== 'POST') {
		return Response.json({ error: 'Method not allowed' }, { status: 405 })
	}

	let texto: string
	try {
		texto = String((await request.json()).texto ?? '')
	} catch {
		return Response.json({ error: 'Invalid body' }, { status: 400 })
	}

	if (!texto.trim()) {
		return Response.json({ error: 'Cole o treino que o treinador enviou.' }, { status: 400 })
	}

	try {
		const sessoes = await interpretarTextoTreinador(texto)
		if (sessoes.length === 0) {
			return Response.json(
				{ error: 'Não consegui identificar treinos nesse texto. Tente incluir os dias da semana.' },
				{ status: 422 },
			)
		}
		return Response.json({ sessoes })
	} catch (erro) {
		console.error('Falha ao interpretar treino do treinador', erro)
		return Response.json({ error: 'Falha ao interpretar o texto. Tente de novo.' }, { status: 500 })
	}
}
