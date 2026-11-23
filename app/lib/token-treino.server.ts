import { timingSafeEqual } from 'node:crypto'

const SEM_CACHE = { 'Cache-Control': 'no-store' }

/**
 * Confere o `Authorization: Bearer <TREINO_API_TOKEN>` das rotas usadas pelo app do iPhone.
 * Devolve uma Response de erro (401/503) ou null quando o token está certo.
 */
export function exigirTokenTreino(request: Request): Response | null {
	const esperado = process.env.TREINO_API_TOKEN
	if (!esperado) {
		return Response.json(
			{ error: 'TREINO_API_TOKEN não configurado no servidor.' },
			{ status: 503, headers: SEM_CACHE },
		)
	}
	const enviado = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
	const a = Buffer.from(enviado)
	const b = Buffer.from(esperado)
	if (a.length !== b.length || !timingSafeEqual(a, b)) {
		return Response.json({ error: 'Token inválido.' }, { status: 401, headers: SEM_CACHE })
	}
	return null
}
