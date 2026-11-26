import Anthropic from '@anthropic-ai/sdk'
import { exigirTokenTreino } from '~/lib/token-treino.server'
import type { Route } from './+types/api.ler-rotulo'

// POST /api/ler-rotulo — lê a foto do rótulo de um vinho, pesquisa o vinho na web e devolve a ficha
// completa para o app WinRun (win&run/ios).
// Autenticação: header `Authorization: Bearer <TREINO_API_TOKEN>`.
// Corpo: { "imagem": "<JPEG em base64>", "mediaType"?: "image/jpeg" | "image/png" | "image/webp", "pesquisar"?: boolean }
// `pesquisar: false` só lê o rótulo (mais rápido, sem web).

const client = new Anthropic()

const SEM_CACHE = { 'Cache-Control': 'no-store' }
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'] as const
type TipoImagem = (typeof TIPOS_IMAGEM)[number]
const LIMITE_BASE64 = 7_000_000 // ~5 MB de imagem; o app manda a foto já reduzida
const MAX_CONTINUACOES = 4 // a busca na web pode pausar o turno (pause_turn); retomamos até este limite

export type RotuloLido = {
	ehVinho: boolean
	nome: string
	produtor: string
	safra: number | null
	tipo: 'tinto' | 'branco' | 'rose' | 'espumante' | 'sobremesa' | 'fortificado'
	uva: string
	pais: string
	regiao: string
	classificacao: string
	teorAlcoolico: string
	amadurecimento: string
	notasDegustacao: string
	harmonizacao: string
	temperaturaServico: string
	potencialGuarda: string
	pontuacoes: string
	sobre: string
	fontes: string[]
}

const texto = (description: string) => ({ type: 'string', description })

const SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: [
		'ehVinho', 'nome', 'produtor', 'safra', 'tipo', 'uva', 'pais', 'regiao', 'classificacao', 'teorAlcoolico',
		'amadurecimento', 'notasDegustacao', 'harmonizacao', 'temperaturaServico', 'potencialGuarda', 'pontuacoes',
		'sobre', 'fontes',
	],
	properties: {
		ehVinho: { type: 'boolean', description: 'true se a foto mostra o rótulo ou a garrafa de um vinho' },
		nome: texto('nome do vinho, sem o produtor e sem a safra (ex.: "Royal Gran Reserva")'),
		produtor: texto('vinícola / bodega / produtor (ex.: "Bodegas Franco-Españolas")'),
		safra: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'ano da safra; null se não há (NV)' },
		tipo: { type: 'string', enum: ['tinto', 'branco', 'rose', 'espumante', 'sobremesa', 'fortificado'] },
		uva: texto('uva(s) e, se souber, a proporção (ex.: "Tempranillo 90%, Graciano 10%")'),
		pais: texto('país, em português'),
		regiao: texto('região e denominação de origem (ex.: "Rioja (D.O.Ca.)")'),
		classificacao: texto('classificação oficial ou de envelhecimento (Crianza, Reserva, Gran Reserva, DOCG, Grand Cru…); vazio se não houver'),
		teorAlcoolico: texto('ex.: "14% vol"'),
		amadurecimento: texto('tempo e tipo de barrica / garrafa (ex.: "36 meses em carvalho francês e americano + 24 meses em garrafa")'),
		notasDegustacao: texto('visual, aroma e boca em 1–3 frases'),
		harmonizacao: texto('pratos que combinam, em poucas palavras'),
		temperaturaServico: texto('ex.: "16–18 °C"'),
		potencialGuarda: texto('até quando beber (ex.: "beber até 2035")'),
		pontuacoes: texto('notas de críticos, se houver (ex.: "93 pts Wine Enthusiast; 92 pts James Suckling")'),
		sobre: texto('2 a 4 frases sobre o produtor e este vinho: história, estilo, o que o torna especial'),
		fontes: { type: 'array', items: { type: 'string' }, description: 'URLs das páginas usadas na pesquisa (no máximo 4)' },
	},
}

const PROMPT_LEITURA = `Leia o rótulo de vinho desta foto e preencha a ficha.

- Use o que está escrito no rótulo. Quando um campo não aparece, complete só com o que é claramente conhecido sobre esse vinho; se não tiver certeza, deixe vazio — campo vazio é melhor que palpite errado.
- Escreva tudo em português do Brasil.
- Se a foto não for de um vinho, marque ehVinho como false e deixe os outros campos vazios (tipo "tinto", safra null, fontes []).`

const PROMPT_PESQUISA = `Leia o rótulo de vinho desta foto e depois pesquise esse vinho na web para montar uma ficha completa.

Como fazer:
1. Identifique no rótulo o nome, o produtor e a safra. O produtor às vezes aparece pequeno ou só no contrarrótulo — a pesquisa resolve isso.
2. Pesquise o vinho (nome + produtor + safra). Prefira o site do produtor, fichas técnicas, importadoras e críticos (Wine Enthusiast, James Suckling, Decanter, Robert Parker, Vivino). Se a safra exata não tiver informação, use a do vinho em geral e não invente números da safra.
3. Preencha todos os campos que encontrar. Campo sem informação confiável fica vazio — vazio é melhor que palpite errado. Pontuações só se você viu na pesquisa.
4. Escreva tudo em português do Brasil, de forma curta e útil para quem vai abrir a garrafa.
5. Em "fontes", coloque as URLs que você realmente usou.

Se a foto não for de um vinho, não pesquise: marque ehVinho como false e deixe os outros campos vazios (tipo "tinto", safra null, fontes []).`

function erro(mensagem: string, status: number) {
	return Response.json({ error: mensagem }, { status, headers: SEM_CACHE })
}

export async function action({ request }: Route.ActionArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	if (request.method !== 'POST') return erro('Método não permitido.', 405)

	let corpo: { imagem?: unknown; mediaType?: unknown; pesquisar?: unknown }
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
	const pesquisar = corpo.pesquisar !== false

	const messages: Anthropic.Beta.BetaMessageParam[] = [
		{
			role: 'user',
			content: [
				{ type: 'image', source: { type: 'base64', media_type: mediaType, data: imagem } },
				{ type: 'text', text: pesquisar ? PROMPT_PESQUISA : PROMPT_LEITURA },
			],
		},
	]

	try {
		let resposta: Anthropic.Beta.BetaMessage | undefined
		for (let i = 0; i <= MAX_CONTINUACOES; i++) {
			resposta = await client.beta.messages.create({
				model: 'claude-opus-5-5',
				max_tokens: 16000,
				// se o modelo recusar por engano, a própria API refaz o pedido no modelo reserva
				betas: ['server-side-fallback-2026-07-01'],
				fallbacks: [{ model: 'claude-opus-4-8' }],
				output_config: {
					// só leitura: tarefa simples. Com pesquisa: precisa decidir o que buscar e cruzar fontes.
					effort: pesquisar ? 'medium' : 'low',
					format: { type: 'json_schema', schema: SCHEMA },
				},
				...(pesquisar ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 }] } : {}),
				messages,
			})
			if (resposta.stop_reason !== 'pause_turn') break
			// a busca pausou o turno: devolve o que já veio e pede para continuar
			messages.push({ role: 'assistant', content: resposta.content })
		}
		if (!resposta) return erro('Resposta inesperada da IA.', 502)

		if (resposta.stop_reason === 'refusal') return erro('A IA não conseguiu ler essa foto.', 422)
		if (resposta.stop_reason === 'max_tokens') return erro('Resposta incompleta da IA, tente de novo.', 502)
		if (resposta.stop_reason === 'pause_turn') return erro('A pesquisa demorou demais, tente de novo.', 504)

		// com saída estruturada, o JSON é o último bloco de texto (depois das buscas)
		const textos = resposta.content.filter(b => b.type === 'text')
		const ultimo = textos[textos.length - 1]
		if (!ultimo || ultimo.type !== 'text') return erro('Resposta inesperada da IA.', 502)
		const rotulo = JSON.parse(ultimo.text) as RotuloLido
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
