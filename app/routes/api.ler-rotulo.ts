import Anthropic from '@anthropic-ai/sdk'
import { exigirTokenTreino } from '~/lib/token-treino.server'
import type { Route } from './+types/api.ler-rotulo'

// POST /api/ler-rotulo — lê a foto do rótulo de um vinho e devolve os campos para o app WinRun (win&run/ios).
// Autenticação: header `Authorization: Bearer <TREINO_API_TOKEN>`.
// Corpo: { "imagem": "<JPEG em base64>", "mediaType"?: "image/jpeg" | "image/png" | "image/webp" }

const client = new Anthropic()

const SEM_CACHE = { 'Cache-Control': 'no-store' }
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'] as const
type TipoImagem = (typeof TIPOS_IMAGEM)[number]
const LIMITE_BASE64 = 7_000_000 // ~5 MB de imagem; o app manda a foto já reduzida

export type RotuloLido = {
	ehVinho: boolean
	nome: string
	produtor: string
	safra: number | null
	tipo: 'tinto' | 'branco' | 'rose' | 'espumante' | 'sobremesa' | 'fortificado'
	uva: string
	pais: string
	regiao: string
	observacoes: string
}

const SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['ehVinho', 'nome', 'produtor', 'safra', 'tipo', 'uva', 'pais', 'regiao', 'observacoes'],
	properties: {
		ehVinho: { type: 'boolean', description: 'true se a foto mostra o rótulo ou a garrafa de um vinho' },
		nome: { type: 'string', description: 'nome do vinho, sem o produtor e sem a safra' },
		produtor: { type: 'string', description: 'vinícola / produtor' },
		safra: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'ano da safra; null se não aparece (ex.: NV)' },
		tipo: { type: 'string', enum: ['tinto', 'branco', 'rose', 'espumante', 'sobremesa', 'fortificado'] },
		uva: { type: 'string', description: 'uva(s) separadas por vírgula' },
		pais: { type: 'string', description: 'país, em português' },
		regiao: { type: 'string', description: 'região / denominação de origem' },
		observacoes: { type: 'string', description: 'uma frase curta útil (estilo, classificação, teor alcoólico); vazio se nada a dizer' },
	},
}

const PROMPT = `Leia o rótulo de vinho desta foto e preencha os campos.

- Use o que está escrito no rótulo. Quando um campo não aparece, você pode completar com o que é claramente conhecido sobre esse vinho (ex.: a uva de um Chianti Classico é Sangiovese, o país de um Rioja é Espanha). Se não tiver certeza, deixe o campo vazio — campo vazio é melhor que palpite errado.
- País em português (Itália, França, Portugal, Argentina, Chile…).
- Se a foto não for de um vinho, marque ehVinho como false e deixe os outros campos vazios (tipo "tinto", safra null).`

function erro(mensagem: string, status: number) {
	return Response.json({ error: mensagem }, { status, headers: SEM_CACHE })
}

export async function action({ request }: Route.ActionArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	if (request.method !== 'POST') return erro('Método não permitido.', 405)

	let corpo: { imagem?: unknown; mediaType?: unknown }
	try {
		corpo = await request.json()
	} catch {
		return erro('JSON inválido.', 400)
	}
	const imagem = typeof corpo?.imagem === 'string' ? corpo.imagem.replace(/^data:[^,]+,/, '').replace(/\s/g, '') : ''
	if (!imagem) return erro('Envie a foto em "imagem" (base64).', 400)
	if (imagem.length > LIMITE_BASE64) return erro('Foto grande demais.', 413)
	const mediaType: TipoImagem = TIPOS_IMAGEM.includes(corpo.mediaType as TipoImagem)
		? (corpo.mediaType as TipoImagem)
		: 'image/jpeg'

	try {
		const resposta = await client.beta.messages.create({
			model: 'claude-opus-5-5',
			max_tokens: 16000,
			// se o modelo recusar por engano, a própria API refaz o pedido no modelo reserva
			betas: ['server-side-fallback-2026-07-01'],
			fallbacks: [{ model: 'claude-opus-4-8' }],
			output_config: {
				effort: 'low', // tarefa simples de leitura: mais rápido e barato
				format: { type: 'json_schema', schema: SCHEMA },
			},
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'image', source: { type: 'base64', media_type: mediaType, data: imagem } },
						{ type: 'text', text: PROMPT },
					],
				},
			],
		})

		if (resposta.stop_reason === 'refusal') return erro('A IA não conseguiu ler essa foto.', 422)
		if (resposta.stop_reason === 'max_tokens') return erro('Resposta incompleta da IA, tente de novo.', 502)

		const texto = resposta.content.find(b => b.type === 'text')
		if (!texto || texto.type !== 'text') return erro('Resposta inesperada da IA.', 502)
		const rotulo = JSON.parse(texto.text) as RotuloLido
		return Response.json(rotulo, { headers: SEM_CACHE })
	} catch (e) {
		if (e instanceof Anthropic.RateLimitError) return erro('Muitos pedidos seguidos; tente em instantes.', 429)
		if (e instanceof Anthropic.APIError) {
			console.error('[ler-rotulo] erro da API Anthropic', e.status, e.message)
			return erro('Falha ao falar com a IA.', 502)
		}
		console.error('[ler-rotulo]', e)
		return erro('Erro ao ler o rótulo.', 500)
	}
}
