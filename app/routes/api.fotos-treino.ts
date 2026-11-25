import type { Route } from './+types/api.fotos-treino'
import { exigirTokenTreino } from '~/lib/token-treino.server'
import { abrirFoto, apagarFoto, ErroFoto, listarFotos, MAX_BYTES_FOTO, salvarFoto } from '~/models/treino-foto.server'

// Fotos ligadas a treinos e provas pelo app do iPhone (ios/). Só com `Authorization: Bearer <TREINO_API_TOKEN>`.
//   GET                          → { fotos: [{ id, chave, tiradaEm, criadaEm }] }
//   GET    ?id=<id>[&mini=1]     → o JPEG (ou a miniatura)
//   POST   ?chave=<chave>[&tiradaEm=<ISO>]  corpo = JPEG → { foto }
//   DELETE ?id=<id>              → { ok: true }

const SEM_CACHE = { 'Cache-Control': 'no-store' }
const ID = /^[0-9a-f]{24}$/
const CHAVE = /^[A-Za-z0-9-]{3,80}$/

const erro = (mensagem: string, status: number) => Response.json({ error: mensagem }, { status, headers: SEM_CACHE })

export async function loader({ request }: Route.LoaderArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	const q = new URL(request.url).searchParams
	const id = q.get('id')
	if (id === null) return Response.json({ fotos: await listarFotos() }, { headers: SEM_CACHE })
	if (!ID.test(id)) return erro('id inválido.', 400)
	try {
		const r = await abrirFoto(id, q.get('mini') === '1')
		if (!r) return erro('Foto não encontrada.', 404)
		return new Response(r.body, {
			headers: { 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' },
		})
	} catch (err) {
		console.error('Falha ao abrir foto', err)
		return erro('Não foi possível abrir a foto.', 502)
	}
}

export async function action({ request }: Route.ActionArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	const q = new URL(request.url).searchParams

	if (request.method === 'DELETE') {
		const id = q.get('id') ?? ''
		if (!ID.test(id)) return erro('id inválido.', 400)
		try {
			return (await apagarFoto(id)) ? Response.json({ ok: true }, { headers: SEM_CACHE }) : erro('Foto não encontrada.', 404)
		} catch (err) {
			console.error('Falha ao apagar foto', err)
			return erro('Não foi possível apagar a foto.', 502)
		}
	}

	if (request.method !== 'POST') return erro('Método não permitido.', 405)
	const chave = q.get('chave') ?? ''
	if (!CHAVE.test(chave)) return erro('chave inválida.', 400)
	if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES_FOTO) return erro('Foto grande demais.', 413)
	const quando = q.get('tiradaEm') ? new Date(q.get('tiradaEm')!) : null
	try {
		const foto = await salvarFoto(
			chave,
			new Uint8Array(await request.arrayBuffer()),
			quando && !Number.isNaN(quando.getTime()) ? quando : null,
		)
		return Response.json({ foto }, { headers: SEM_CACHE })
	} catch (err) {
		if (err instanceof ErroFoto) return erro(err.message, 400)
		console.error('Falha ao salvar foto', err)
		return erro('Não foi possível salvar a foto.', 502)
	}
}
