import type { Route } from './+types/api.saude-treinos'
import { exigirTokenTreino } from '~/lib/token-treino.server'
import {
	gravarTreinosSaude,
	resumoTreinosSaude,
	sanearTreinoSaude,
	type TreinoSaudeEntrada,
} from '~/models/treino-saude.server'

// Treinos lidos do app Saúde (Apple Watch) pelo app do iPhone.
// Autenticação: `Authorization: Bearer <TREINO_API_TOKEN>`.
//   GET  → { total, maisRecente }  (o app só envia o que for mais novo)
//   POST → { treinos: [...] } até 50 por vez; reenviar o mesmo healthId atualiza, não duplica.

const SEM_CACHE = { 'Cache-Control': 'no-store' }
const MAX_POR_ENVIO = 50

export async function loader({ request }: Route.LoaderArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	return Response.json(await resumoTreinosSaude(), { headers: SEM_CACHE })
}

export async function action({ request }: Route.ActionArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	if (request.method !== 'POST') {
		return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: SEM_CACHE })
	}

	let corpo: unknown
	try {
		corpo = await request.json()
	} catch {
		return Response.json({ error: 'JSON inválido.' }, { status: 400, headers: SEM_CACHE })
	}

	const bruto = (corpo as { treinos?: unknown })?.treinos
	if (!Array.isArray(bruto) || bruto.length === 0) {
		return Response.json({ error: 'Envie { treinos: [...] }.' }, { status: 400, headers: SEM_CACHE })
	}
	if (bruto.length > MAX_POR_ENVIO) {
		return Response.json({ error: `No máximo ${MAX_POR_ENVIO} treinos por envio.` }, { status: 413, headers: SEM_CACHE })
	}

	const validos = bruto.map(sanearTreinoSaude).filter((t): t is TreinoSaudeEntrada => t !== null)
	const resultado = await gravarTreinosSaude(validos)
	return Response.json(
		{ recebidos: bruto.length, validos: validos.length, descartados: bruto.length - validos.length, ...resultado },
		{ headers: SEM_CACHE },
	)
}
