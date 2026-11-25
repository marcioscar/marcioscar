import PocketBase from 'pocketbase'
import { db } from '../../db.server'

// Fotos dos treinos e provas: metadados no Mongo, arquivo protegido no PocketBase (sem link público).

const COLECAO = 'fotos_treinos'
export const MAX_BYTES_FOTO = 3_000_000
const MAX_POR_TREINO = 40
const MINIATURA = '400x400'

let cliente: PocketBase | null = null
let tokenArquivo: { valor: string; ate: number } | null = null

async function pb(): Promise<PocketBase> {
	const url = process.env.POCKETBASE_URL?.replace(/\/$/, '')
	const email = process.env.POCKETBASE_ADMIN_EMAIL
	const senha = process.env.POCKETBASE_ADMIN_PASSWORD
	if (!url || !email || !senha) throw new Error('PocketBase não configurado.')
	if (!cliente) {
		cliente = new PocketBase(url)
		cliente.autoCancellation(false)
	}
	if (!cliente.authStore.isValid) {
		await cliente.collection('_superusers').authWithPassword(email, senha)
		tokenArquivo = null
	}
	return cliente
}

async function tokenDeArquivo(c: PocketBase): Promise<string> {
	// o token do PocketBase dura ~3 min
	if (!tokenArquivo || tokenArquivo.ate < Date.now()) {
		tokenArquivo = { valor: await c.files.getToken(), ate: Date.now() + 60_000 }
	}
	return tokenArquivo.valor
}

type Linha = { id: string; chave: string; tiradaEm: Date | null; createdAt: Date }
const publica = (f: Linha) => ({
	id: f.id,
	chave: f.chave,
	tiradaEm: f.tiradaEm?.toISOString() ?? null,
	criadaEm: f.createdAt.toISOString(),
})

export async function listarFotos() {
	const fotos = await db.treinoFoto.findMany({ orderBy: { createdAt: 'asc' } })
	return fotos.map(publica)
}

/** Só JPEG: é o que o app manda, já reduzido e sem EXIF. */
function ehJpeg(b: Uint8Array) {
	return b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
}

export async function salvarFoto(chave: string, bytes: Uint8Array, tiradaEm: Date | null) {
	if (!ehJpeg(bytes)) throw new ErroFoto('A foto precisa ser JPEG.')
	if (bytes.length > MAX_BYTES_FOTO) throw new ErroFoto('Foto grande demais.')
	if ((await db.treinoFoto.count({ where: { chave } })) >= MAX_POR_TREINO) {
		throw new ErroFoto(`Limite de ${MAX_POR_TREINO} fotos por treino.`)
	}
	const c = await pb()
	const form = new FormData()
	form.append('foto', new File([new Uint8Array(bytes)], 'foto.jpg', { type: 'image/jpeg' }))
	const registro = await c.collection(COLECAO).create(form)
	try {
		return publica(
			await db.treinoFoto.create({ data: { chave, pbId: registro.id, arquivo: String(registro.foto), tiradaEm } }),
		)
	} catch (err) {
		// não deixa arquivo órfão
		await c.collection(COLECAO).delete(registro.id).catch(() => {})
		throw err
	}
}

export async function apagarFoto(id: string): Promise<boolean> {
	const f = await db.treinoFoto.findUnique({ where: { id } })
	if (!f) return false
	const c = await pb()
	try {
		await c.collection(COLECAO).delete(f.pbId)
	} catch (err) {
		if ((err as { status?: number }).status !== 404) throw err
	}
	await db.treinoFoto.delete({ where: { id } })
	return true
}

/** Busca o arquivo no PocketBase (com token interno). null = não existe. */
export async function abrirFoto(id: string, miniatura: boolean): Promise<Response | null> {
	const f = await db.treinoFoto.findUnique({ where: { id } })
	if (!f) return null
	const c = await pb()
	const url = c.files.getURL({ id: f.pbId, collectionId: COLECAO, collectionName: COLECAO }, f.arquivo, {
		token: await tokenDeArquivo(c),
		...(miniatura ? { thumb: MINIATURA } : {}),
	})
	const r = await fetch(url)
	if (r.status === 404) return null
	if (!r.ok || !r.body) throw new Error(`PocketBase respondeu ${r.status}`)
	return r
}

export class ErroFoto extends Error {}
