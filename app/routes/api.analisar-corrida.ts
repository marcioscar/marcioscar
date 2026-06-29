import Anthropic from '@anthropic-ai/sdk'
import { db } from '../../db.server'
import type { AnaliseInput, AnaliseResult } from '~/types/analise'

export type { AnaliseInput, AnaliseResult }

const client = new Anthropic()

function formatarPace(segPorKm: number): string {
	const min = Math.floor(segPorKm / 60)
	const seg = Math.round(segPorKm % 60)
	return `${min}:${String(seg).padStart(2, '0')} /km`
}

function formatarTempo(seg: number): string {
	const h = Math.floor(seg / 3600)
	const m = Math.floor((seg % 3600) / 60)
	const s = seg % 60
	return h > 0
		? `${h}h${String(m).padStart(2, '0')}min`
		: `${m}min${String(s).padStart(2, '0')}s`
}

function buildPrompt(input: AnaliseInput): string {
	const { corrida, provaAlvo } = input

	const diffPace = provaAlvo
		? (() => {
				const [min, seg] = provaAlvo.paceAlvo.split(':').map(Number)
				const paceAlvoSeg = min * 60 + seg
				const diff = corrida.paceSegPorKm - paceAlvoSeg
				const absDiff = Math.abs(diff)
				const diffMin = Math.floor(absDiff / 60)
				const diffSeg = Math.round(absDiff % 60)
				const diffStr = diffMin > 0
					? `${diffMin}min${String(diffSeg).padStart(2, '0')}s`
					: `${diffSeg}s`
				return diff > 0 ? `+${diffStr} acima do pace alvo` : `-${diffStr} abaixo do pace alvo`
			})()
		: null

	const provaCtx = provaAlvo
		? `
## Prova alvo do atleta
- Modalidade: ${provaAlvo.plano === 'meia' ? 'Meia Maratona' : 'Maratona'}
- Pace alvo: ${provaAlvo.paceAlvo} /km
- Volume semanal planejado: ${provaAlvo.kmSemanais} km
- Data da prova: ${provaAlvo.dataProva}
- Diferença de pace: ${diffPace}`
		: `
## Prova alvo
Sem prova alvo cadastrada. Analise com base em critérios gerais de corrida de fundo.`

	return `Você é um treinador especialista na metodologia de Renato Canova para maratonistas e meio-maratonistas.

Analise esta sessão de treino e avalie se está alinhada com a metodologia Canova.

## Referência Canova — tipos de sessão
- **Recuperação**: pace muito lento (+90s ou mais acima do pace alvo), até 10 km
- **Rodagem Leve (Aeróbico Fácil)**: pace + 60-90s acima do alvo, 10-20 km
- **Rodagem Moderada (Steady State)**: pace + 20-45s acima do alvo
- **Limiar (Threshold)**: pace + 5-20s acima do alvo, corrida contínua
- **Longão**: ritmo fácil a moderado, distância longa (25-38 km para maratona, 18-28 km para meia)
- **Bloco Especial / Progressivo**: sessão com variação de pace, terminando em ritmo forte
- **Repetições / Tiro**: pace próximo ou abaixo do alvo de prova, com recuperação
- **Corrida de Prova / Competição**: pace de corrida

Princípios-chave de Canova:
- Todo treino deve ter um objetivo claro (nunca "só correr")
- O ritmo de recuperação real é muito mais lento do que o atleta imagina
- Os longões de maratona chegam a 35-38 km no pico — de meia a 28-30 km
- Treinos duros (limiar, repetições) devem ser seguidos de 1-2 dias leves
- Volume e intensidade sobem juntos na fase específica — Canova diverge de Lydiard aqui
- Evitar a "zona cinza": ou fácil DE VERDADE, ou com intensidade real

## Sessão realizada
- Nome: ${corrida.nome}
- Data: ${corrida.dataInicio}
- Distância: ${corrida.distanciaKm.toFixed(2)} km
- Tempo: ${formatarTempo(corrida.tempoSeg)}
- Pace médio: ${formatarPace(corrida.paceSegPorKm)}
- Ganho de elevação: ${corrida.elevacaoMetros.toFixed(0)} m
${provaCtx}

Responda APENAS com um objeto JSON válido (sem markdown, sem \`\`\`), com exatamente esta estrutura:
{
  "tipoSessao": "nome do tipo de sessão em português",
  "avaliacao": "excelente" | "bom" | "regular" | "ruim",
  "resumo": "2-3 frases avaliando a sessão",
  "pontosPositivos": ["ponto 1", "ponto 2"],
  "pontosAtencao": ["ponto 1"],
  "alinhamentoCanova": "como esta sessão se alinha ou não com Canova",
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
		const message = await client.messages.create({
			model: 'claude-sonnet-4-6',
			max_tokens: 1024,
			messages: [{ role: 'user', content: buildPrompt(input) }],
		})

		const text = message.content.find(b => b.type === 'text')?.text ?? ''
		const analise: AnaliseResult = JSON.parse(text)

		// Persist analysis to the Corrida record
		await db.corrida.update({
			where: { stravaId: input.stravaId },
			data: { analise, analisadaEm: new Date() },
		})

		return Response.json(analise)
	} catch (err) {
		console.error('Erro na análise Claude:', err)
		return Response.json({ error: 'Falha na análise' }, { status: 500 })
	}
}
