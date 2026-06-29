import Anthropic from '@anthropic-ai/sdk'
import { db } from '../../db.server'
import { buscarAtividadeDetalhada } from '~/services/strava/client.server'
import type { AnaliseInput, AnaliseResult, SplitMetric, AnalyzeApiResponse } from '~/types/analise'

export type { AnaliseInput, AnaliseResult, SplitMetric, AnalyzeApiResponse }

const client = new Anthropic()

function mpsParaPaceStr(mps: number): string {
	if (!mps || mps <= 0) return '—'
	const segPorKm = 1000 / mps
	const min = Math.floor(segPorKm / 60)
	const seg = Math.round(segPorKm % 60)
	return `${min}:${String(seg).padStart(2, '0')}/km`
}

function formatarPace(segPorKm: number): string {
	if (!segPorKm || segPorKm <= 0) return '—'
	const min = Math.floor(segPorKm / 60)
	const seg = Math.round(segPorKm % 60)
	return `${min}:${String(seg).padStart(2, '0')} /km`
}

function formatarTempo(seg: number): string {
	const h = Math.floor(seg / 3600)
	const m = Math.floor((seg % 3600) / 60)
	const s = seg % 60
	return h > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${m}min${String(s).padStart(2, '0')}s`
}

function buildSplitsBlock(splits: SplitMetric[]): string {
	if (!splits.length) return ''

	const rows = splits.map(s => {
		const pace = mpsParaPaceStr(s.average_speed)
		const fc = s.average_heartrate ? `FC ${Math.round(s.average_heartrate)}` : '—'
		const elev = s.elevation_difference >= 0 ? `+${s.elevation_difference.toFixed(0)}m` : `${s.elevation_difference.toFixed(0)}m`
		return `  Km ${String(s.split).padStart(2)}: ${pace.padEnd(9)} ${fc.padEnd(8)} ${elev}`
	})

	const paces = splits.map(s => 1000 / s.average_speed)
	const paceMin = Math.min(...paces)
	const paceMax = Math.max(...paces)
	const variacaoStr = `Variação de pace: ${formatarPace(paceMin)} → ${formatarPace(paceMax)} (${formatarPace(paceMax - paceMin)} de amplitude)`

	const firstPace = formatarPace(1000 / splits[0].average_speed)
	const lastPace = formatarPace(1000 / splits[splits.length - 1].average_speed)
	const tendencia = paces[0] > paces[paces.length - 1] ? 'PROGRESSIVO (acelerou)' : paces[0] < paces[paces.length - 1] ? 'REGRESSIVO (desacelerou)' : 'UNIFORME'

	return `
## Splits por quilômetro (dados detalhados do Strava)
${rows.join('\n')}

Análise dos splits:
- Tendência: ${tendencia}
- Pace inicial: ${firstPace} | Pace final: ${lastPace}
- ${variacaoStr}`
}

function buildPrompt(input: AnaliseInput, splits: SplitMetric[]): string {
	const { corrida, provaAlvo } = input

	const diffPace = provaAlvo
		? (() => {
				const [min, seg] = provaAlvo.paceAlvo.split(':').map(Number)
				const paceAlvoSeg = min * 60 + seg
				const diff = corrida.paceSegPorKm - paceAlvoSeg
				const absDiff = Math.abs(diff)
				const diffMin = Math.floor(absDiff / 60)
				const diffSeg = Math.round(absDiff % 60)
				const diffStr = diffMin > 0 ? `${diffMin}min${String(diffSeg).padStart(2, '0')}s` : `${diffSeg}s`
				return diff > 0 ? `+${diffStr} acima do pace alvo` : `-${diffStr} abaixo do pace alvo`
			})()
		: null

	const provaCtx = provaAlvo
		? `
## Prova alvo
- Modalidade: ${provaAlvo.plano === 'meia' ? 'Meia Maratona' : 'Maratona'}
- Pace alvo: ${provaAlvo.paceAlvo} /km
- Volume semanal: ${provaAlvo.kmSemanais} km
- Data da prova: ${provaAlvo.dataProva}
- Diferença de pace médio vs alvo: ${diffPace}`
		: '\n## Prova alvo\nSem prova alvo cadastrada.'

	return `Você é um treinador especialista na metodologia de Renato Canova para maratonistas e meio-maratonistas.

Analise esta sessão de treino e avalie se está alinhada com a metodologia Canova.

## Referência Canova — tipos de sessão
- **Recuperação**: pace muito lento (+90s acima do alvo), até 10 km, FC baixa
- **Rodagem Leve (Aeróbico Fácil)**: pace +60-90s acima do alvo, 10-20 km
- **Rodagem Moderada (Steady State)**: pace +20-45s acima do alvo
- **Limiar (Threshold)**: pace +5-20s acima do alvo, corrida contínua uniforme
- **Longão**: ritmo fácil a moderado, muito longa (25-38 km maratona, 18-28 km meia)
- **Progressivo**: começa lento e termina em ritmo forte — splits revelam isso claramente
- **Bloco Especial / Fartlek**: variações de pace identificáveis nos splits
- **Repetições / Tiro**: pace próximo ou abaixo do alvo com recuperação (difícil de ver em pace médio mas visível nos splits)
- **Corrida de Prova**: pace de corrida

Princípios-chave de Canova:
- Todo treino deve ter objetivo claro; evitar "zona cinza"
- Recuperação é MUITO mais lenta do que o atleta imagina
- Longões chegam a 35-38 km para maratona no pico
- Usar os splits para identificar a estrutura real do treino

## Sessão realizada
- Nome: ${corrida.nome}
- Data: ${corrida.dataInicio}
- Distância: ${corrida.distanciaKm.toFixed(2)} km
- Tempo: ${formatarTempo(corrida.tempoSeg)}
- Pace médio: ${formatarPace(corrida.paceSegPorKm)}
- Ganho de elevação: ${corrida.elevacaoMetros.toFixed(0)} m
${provaCtx}
${buildSplitsBlock(splits)}

Responda APENAS com um objeto JSON válido (sem markdown, sem \`\`\`), com exatamente esta estrutura:
{
  "tipoSessao": "nome do tipo de sessão em português",
  "avaliacao": "excelente" | "bom" | "regular" | "ruim",
  "resumo": "2-3 frases avaliando a sessão com base nos splits",
  "pontosPositivos": ["ponto 1", "ponto 2"],
  "pontosAtencao": ["ponto 1"],
  "alinhamentoCanova": "como esta sessão se alinha ou não com Canova, usando os splits como evidência",
  "recomendacao": "o que focar no próximo treino"
}`
}

export async function action({ request }: { request: Request }) {
	if (request.method !== 'POST') {
		return Response.json({ error: 'Method not allowed' }, { status: 405 })
	}

	let input: AnaliseInput
	try {
		input = await request.json()
	} catch {
		return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
	}

	try {
		// 1. Fetch detailed activity from Strava to get splits_metric
		const detailed = await buscarAtividadeDetalhada(input.stravaId)
		const splits = (detailed.splits_metric ?? []) as SplitMetric[]

		// 2. Call Claude with enriched prompt (splits included)
		const message = await client.messages.create({
			model: 'claude-sonnet-4-6',
			max_tokens: 1024,
			messages: [{ role: 'user', content: buildPrompt(input, splits) }],
		})

		const text = message.content.find(b => b.type === 'text')?.text ?? ''
		const analise: AnaliseResult = JSON.parse(text)

		// 3. Persist both splits and analysis
		await db.corrida.update({
			where: { stravaId: input.stravaId },
			data: { splits, analise, analisadaEm: new Date() },
		})

		const response: AnalyzeApiResponse = { analise, splits }
		return Response.json(response)
	} catch (err) {
		console.error('Erro na análise Claude:', err)
		return Response.json({ error: 'Falha na análise' }, { status: 500 })
	}
}
