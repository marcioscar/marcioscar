import Anthropic from '@anthropic-ai/sdk'
import { db } from '../../db.server'
import { buscarAtividadeDetalhada } from '~/services/strava/client.server'
import { tabelaZonasParaPrompt } from '~/lib/zonas-pace'
import { garantirVponto } from '~/models/vdot-config.server'
import { obterProvaAtiva } from '~/models/provas.server'
import { buscarTreinoSaudePorId, paraCorridaRelogio, planejadoDoDia } from '~/models/treino-saude.server'
import { textoPrescrito } from '~/lib/treino-manual'
import type { AnaliseInput, AnaliseResult, SplitMetric, LapData, AnalyzeApiResponse } from '~/types/analise'

export type { AnaliseInput, AnaliseResult, SplitMetric, LapData, AnalyzeApiResponse }

const client = new Anthropic()

function mpsParaPaceStr(mps: number): string {
	if (!mps || mps < 1.0) return 'DESCANSO'
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

function extrasDaVolta(l: LapData): string {
	const partes: string[] = []
	if (l.potenciaW) partes.push(`${Math.round(l.potenciaW)}W`)
	if (l.cadencia) partes.push(`cad ${Math.round(l.cadencia)}`)
	if (l.passadaM) partes.push(`pas ${l.passadaM.toFixed(2)}m`)
	if (l.oscilacaoCm) partes.push(`osc ${l.oscilacaoCm.toFixed(1)}cm`)
	if (l.contatoMs) partes.push(`cont ${Math.round(l.contatoMs)}ms`)
	if (l.total_elevation_gain) partes.push(`+${Math.round(l.total_elevation_gain)}m`)
	return partes.join(' ')
}

function buildLapsBlock(laps: LapData[], comNomes = false): string {
	if (!laps.length || laps.length <= 1) return ''

	const rows = laps.map(l => {
		const dist = l.distance >= 1000
			? `${(l.distance / 1000).toFixed(2)} km`
			: `${Math.round(l.distance)} m`
		const pace = mpsParaPaceStr(l.average_speed)
		const tempo = formatarTempo(l.moving_time)
		const fc = l.average_heartrate ? `FC ${Math.round(l.average_heartrate)}` : '—'
		const nome = comNomes ? ` ${l.name.padEnd(14)}` : ''
		const extras = comNomes ? ` ${extrasDaVolta(l)}` : ''
		return `  Volta ${String(l.lap_index + 1).padStart(2)} [lap_index=${l.lap_index}]${nome}: ${dist.padEnd(8)} ${pace.padEnd(9)} ${tempo.padEnd(8)} ${fc}${extras}`
	})

	const distances = laps.map(l => l.distance)
	const distMin = Math.min(...distances)
	const distMax = Math.max(...distances)
	const isIntervals = distMax - distMin > 200
	const tipoStr = isIntervals
		? `ATENÇÃO: distâncias variáveis (${Math.round(distMin)}m a ${Math.round(distMax)}m) — provavelmente estímulos + recuperações passivas`
		: `Voltas uniformes (~${Math.round(distances[0])}m cada)`

	return `
## ${comNomes ? 'Etapas do treino estruturado gravadas pelo Apple Watch' : 'Voltas registradas pelo GPS (laps — pressão manual no dispositivo)'}
${rows.join('\n')}

Interpretação: ${tipoStr}
IMPORTANTE: voltas curtas com pace muito baixo (ex: >8:00/km) ou velocidade próxima de zero NÃO indicam recuperação em movimento — indicam DESCANSO PASSIVO (atleta parado ou caminhando). Trate essas voltas como intervalo de recuperação, não como parte do esforço.`
}

function buildSplitsBlock(splits: SplitMetric[], fonte = 'Strava'): string {
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
## Splits por quilômetro (${fonte === 'Strava' ? 'dados detalhados do Strava' : 'calculados das amostras do ' + fonte})
${rows.join('\n')}

Análise dos splits:
- Tendência: ${tendencia}
- Pace inicial: ${firstPace} | Pace final: ${lastPace}
- ${variacaoStr}`
}

function buildPromptComparacao(plano: string): string {
	return `

## Treino planejado (Treinus)
${plano}

Com base no plano acima e nas voltas registradas:
1. Inclua "comparacaoTreinus": análise de 2-3 frases sobre o que foi seguido, o que divergiu e se a execução foi adequada.
2. Inclua "lapsAnotados": array anotando CADA volta usando o valor numérico exato de [lap_index=X] mostrado ao lado de cada volta acima. Classifique cada volta em tipo "aquecimento", "estimulo", "recuperacao", "principal" ou "desaquecimento". Voltas marcadas como DESCANSO no pace são recuperações passivas. Inclua label curta (ex: "Aquec.", "Est 1", "Rec 1", "Est 2") e "meta" com o pace alvo do plano quando aplicável (ex: "4:15/km"), ou null.`
}

function buildPrompt(
	input: AnaliseInput,
	splits: SplitMetric[],
	laps: LapData[],
	relogio: { extras: string } | null = null,
): string {
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

## Zonas de ritmo do atleta (Canova + Jack Daniels) — pace absoluto
${tabelaZonasParaPrompt()}
Use ESTAS zonas (Z1–Z6) para classificar o ritmo de splits, voltas e do pace médio, citando a zona (ex: "Z4 Limiar"). Elas valem mais que as diferenças relativas ao pace alvo acima, que ficam só como apoio para identificar o tipo de sessão.

Princípios-chave de Canova:
- Todo treino deve ter objetivo claro; evitar "zona cinza"
- Recuperação é MUITO mais lenta do que o atleta imagina
- Longões chegam a 35-38 km para maratona no pico
- Usar os splits E as voltas (laps) para identificar a estrutura real do treino
- Para treinos de tiros/intervalados, as VOLTAS são mais importantes que os splits por km
- Splits ou voltas com pace muito baixo (>8:00/km) ou velocidade próxima de zero = DESCANSO PASSIVO (atleta parado ou caminhando), nunca interpretar como ritmo de corrida

## Sessão realizada
- Nome: ${corrida.nome}
- Data: ${corrida.dataInicio}
- Distância: ${corrida.distanciaKm.toFixed(2)} km
- Tempo: ${formatarTempo(corrida.tempoSeg)}
- Pace médio: ${formatarPace(corrida.paceSegPorKm)}
- Ganho de elevação: ${corrida.elevacaoMetros.toFixed(0)} m
${provaCtx}
${relogio?.extras ?? ''}
${buildLapsBlock(laps, relogio !== null)}
${buildSplitsBlock(splits, relogio ? 'Apple Watch' : 'Strava')}

Responda APENAS com um objeto JSON válido (sem markdown, sem \`\`\`), com exatamente esta estrutura:
{
  "tipoSessao": "nome do tipo de sessão em português",
  "avaliacao": "excelente" | "bom" | "regular" | "ruim",
  "resumo": "2-3 frases avaliando a sessão com base nos splits",
  "pontosPositivos": ["ponto 1", "ponto 2"],
  "pontosAtencao": ["ponto 1"],
  "alinhamentoCanova": "como esta sessão se alinha ou não com Canova, usando os splits como evidência",
  "recomendacao": "o que focar no próximo treino",
  "comparacaoTreinus": "inclua somente se o plano Treinus foi fornecido; caso contrário omita",${relogio ? `
  "metricasRelogio": "3-4 frases interpretando potência, cadência, passada, oscilação vertical, contato com o solo, FC (deriva e recuperação) e como mudaram entre esforços/ao longo do treino; cite números",` : ''}
  "lapsAnotados": [{ "lap_index": 0, "tipo": "aquecimento", "label": "Aquec.", "meta": null }]
}`
}

/** Aceita JSON puro ou embrulhado em ```json ... ``` / com texto antes e depois. */
function lerJsonDaResposta(texto: string): AnaliseResult {
	const limpo = texto.replace(/```(?:json)?/gi, '').trim()
	const ini = limpo.indexOf('{')
	const fim = limpo.lastIndexOf('}')
	try {
		return JSON.parse(ini >= 0 && fim > ini ? limpo.slice(ini, fim + 1) : limpo)
	} catch (err) {
		console.error('Resposta do Claude fora do formato JSON:', texto.slice(0, 1500))
		throw err
	}
}

type EtapaAnalise = 'strava' | 'relogio' | 'claude' | 'resposta' | 'banco'

function descreverErroAnalise(etapa: EtapaAnalise, err: unknown): string {
	const detalhe = err instanceof Error ? err.message : String(err)

	if (etapa === 'strava') {
		return `Erro ao buscar a atividade no Strava: ${detalhe}`
	}

	if (etapa === 'relogio') {
		return `Erro ao ler a corrida do relógio no banco: ${detalhe}`
	}

	if (etapa === 'claude') {
		if (err instanceof Anthropic.APIError) {
			if (err.status === 529) return 'O Claude está sobrecarregado no momento (erro 529). Tente novamente em alguns minutos.'
			if (err.status === 429) return 'Limite de uso da API do Claude atingido (erro 429). Tente novamente em alguns minutos.'
			if (err.status === 401) return 'ANTHROPIC_API_KEY inválida ou revogada (erro 401).'
			if (err.status === 403) return 'A ANTHROPIC_API_KEY não tem permissão para esse modelo (erro 403).'
			if (err.status && err.status >= 500) return `Instabilidade na API do Claude (erro ${err.status}). Tente novamente em alguns minutos.`
			if (/credit balance/i.test(detalhe)) return 'Sem créditos na conta da API do Claude.'
			if (err instanceof Anthropic.APIConnectionError) return 'Não foi possível conectar à API do Claude (rede ou timeout).'
			return `Erro da API do Claude${err.status ? ` (${err.status})` : ''}: ${detalhe}`
		}
		if (/api[_ ]?key/i.test(detalhe)) return 'ANTHROPIC_API_KEY não está configurada no servidor.'
		return `Erro ao chamar o Claude: ${detalhe}`
	}

	if (etapa === 'resposta') {
		return 'O Claude respondeu fora do formato JSON esperado. Tente analisar de novo.'
	}

	return `Análise gerada, mas falhou ao salvar no banco: ${detalhe}`
}

type TreinoSaudeLinha = NonNullable<Awaited<ReturnType<typeof buscarTreinoSaudePorId>>>

function mediaDe(valores: number[]): number | null {
	return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null
}

function textoExtrasRelogio(t: TreinoSaudeLinha, laps: LapData[], splits: SplitMetric[]): string {
	const linhas: string[] = []
	if (t.fcMedia) linhas.push(`- FC média: ${Math.round(t.fcMedia)} bpm${t.fcMaxima ? ` (máx ${Math.round(t.fcMaxima)})` : ''}`)
	if (t.cadenciaMedia) linhas.push(`- Cadência média: ${Math.round(t.cadenciaMedia)} passos/min`)
	if (t.potenciaMediaW) linhas.push(`- Potência média: ${Math.round(t.potenciaMediaW)} W`)
	if (t.passadaM) linhas.push(`- Comprimento da passada: ${t.passadaM.toFixed(2)} m`)
	if (t.oscilacaoVerticalCm) linhas.push(`- Oscilação vertical: ${t.oscilacaoVerticalCm.toFixed(1)} cm`)
	if (t.contatoSoloMs) linhas.push(`- Tempo de contato com o solo: ${Math.round(t.contatoSoloMs)} ms`)
	if (t.caloriasKcal) linhas.push(`- Calorias ativas: ${Math.round(t.caloriasKcal)} kcal`)
	if (t.elevacaoGanhoM) linhas.push(`- Subida medida pelo relógio: ${Math.round(t.elevacaoGanhoM)} m`)

	// pausas do treino (eventos pause/resume): tempo parado fora do tempo em movimento
	const eventos = ((t.eventos as { tipo: string; inicio: string; fim: string }[] | null) ?? [])
		.slice()
		.sort((a, b) => a.inicio.localeCompare(b.inicio))
	let pausaSeg = 0
	let nPausas = 0
	let aberta: number | null = null
	for (const e of eventos) {
		if (e.tipo === 'pause') {
			aberta = new Date(e.inicio).getTime()
		} else if (e.tipo === 'resume' && aberta !== null) {
			pausaSeg += (new Date(e.inicio).getTime() - aberta) / 1000
			nPausas++
			aberta = null
		}
	}
	const totalSeg = (t.fim.getTime() - t.inicio.getTime()) / 1000
	if (nPausas > 0) {
		linhas.push(
			`- Pausas manuais: ${nPausas} (${formatarTempo(Math.round(pausaSeg))} parado); tempo total ${formatarTempo(Math.round(totalSeg))} contra ${formatarTempo(Math.round(t.duracaoSeg))} em movimento`,
		)
	}

	// deriva cardíaca entre a 1ª e a 2ª metade dos splits (ritmo parecido, FC subindo = fadiga/calor/desidratação)
	const fcSplits = splits.filter(s => s.average_heartrate)
	if (fcSplits.length >= 4) {
		const meio = Math.floor(fcSplits.length / 2)
		const a = mediaDe(fcSplits.slice(0, meio).map(s => s.average_heartrate!))
		const b = mediaDe(fcSplits.slice(-meio).map(s => s.average_heartrate!))
		const pa = mediaDe(fcSplits.slice(0, meio).map(s => 1000 / s.average_speed))
		const pb = mediaDe(fcSplits.slice(-meio).map(s => 1000 / s.average_speed))
		if (a && b && pa && pb) {
			linhas.push(
				`- Deriva cardíaca (1ª vs 2ª metade dos km): FC ${Math.round(a)} → ${Math.round(b)} bpm com pace ${formatarPace(pa)} → ${formatarPace(pb)}`,
			)
		}
	}

	// recuperação cardíaca entre esforços (FC média nos descansos) e esforços: sobe ou desce ao longo da sessão
	const esforcos = laps.filter(l => /esfor/i.test(l.name) && l.average_heartrate)
	const descansos = laps.filter(l => /descanso|recupera/i.test(l.name) && l.average_heartrate)
	if (esforcos.length >= 2) {
		linhas.push(`- FC por esforço: ${esforcos.map(l => Math.round(l.average_heartrate!)).join(' → ')} bpm`)
		const paces = esforcos.map(l => formatarPace(1000 / l.average_speed).replace(' /km', ''))
		linhas.push(`- Pace por esforço: ${paces.join(' → ')}`)
	}
	if (descansos.length >= 2) {
		linhas.push(`- FC média nos descansos: ${descansos.map(l => Math.round(l.average_heartrate!)).join(' → ')} bpm (quanto mais cai entre esforços, melhor a recuperação)`)
	}

	if (linhas.length === 0) return ''
	return `
## Métricas medidas pelo Apple Watch (o Strava não tem a maioria destas)
${linhas.join('\n')}

Referências para interpretar (corredor recreativo avançado; são orientações, não diagnóstico):
- Cadência: 165–180 passos/min em ritmo fácil, 175–195 em tiros; passada cresce com a velocidade, mais pela amplitude que pela cadência.
- Tempo de contato com o solo: abaixo de ~250 ms é bom em ritmo moderado; tiros costumam ficar entre 180 e 220 ms.
- Oscilação vertical: abaixo de ~8–9 cm indica corrida econômica; acima de 10–11 cm, desperdício de energia.
- Potência: sobe com a velocidade e com a subida; compare esforços entre si (deve ser estável nos tiros do mesmo pace).
- Deriva cardíaca acima de ~5% entre as metades, com pace estável, sugere fadiga, calor ou hidratação insuficiente.
Use ativamente estas métricas na análise: compare esforços e descansos entre si, aponte o que mudou ao longo da sessão
(cadência, contato, oscilação, potência, FC) e relacione com o pace.`
}

async function analisarCorridaDoRelogio(healthId: string, treinusPlano: string | null): Promise<Response> {
	let etapa: EtapaAnalise = 'relogio'
	try {
		const t = await buscarTreinoSaudePorId(healthId)
		if (!t) return Response.json({ error: 'Corrida do relógio não encontrada.' }, { status: 404 })

		const planejado = await planejadoDoDia(t.inicio, t.tipo)
		const c = paraCorridaRelogio(t, planejado)
		// treino planejado no site vira o "planejado" da análise, salvo se você colou outro texto
		const planoTexto = treinusPlano ?? (planejado ? `${planejado.titulo}\n${textoPrescrito(planejado)}` : null)
		const splits = c.splits as SplitMetric[]
		const laps = c.laps as LapData[]
		const prova = await obterProvaAtiva()

		const input: AnaliseInput = {
			stravaId: 0,
			corrida: {
				nome: c.nome,
				distanciaKm: c.distanciaMetros / 1000,
				paceSegPorKm: c.distanciaMetros > 0 ? c.tempoMovimentoSeg / (c.distanciaMetros / 1000) : 0,
				tempoSeg: c.tempoMovimentoSeg,
				elevacaoMetros: c.elevacaoGanhoMetros,
				dataInicio: new Date(c.dataInicio).toLocaleDateString('pt-BR'),
			},
			provaAlvo: prova
				? {
						plano: prova.plano,
						paceAlvo: prova.paceAlvo,
						kmSemanais: prova.kmSemanais,
						dataProva: new Date(prova.dataProva).toLocaleDateString('pt-BR'),
					}
				: null,
			treinusPlano: planoTexto,
		}

		const promptText =
			buildPrompt(input, splits, laps, { extras: textoExtrasRelogio(t, laps, splits) }) +
			(planoTexto ? buildPromptComparacao(planoTexto) : '')

		etapa = 'claude'
		const message = await client.messages.create({
			model: 'claude-sonnet-4-6',
			max_tokens: 4096,
			messages: [{ role: 'user', content: promptText }],
		})

		etapa = 'resposta'
		const text = message.content.find(b => b.type === 'text')?.text ?? ''
		const analise: AnaliseResult = lerJsonDaResposta(text)

		etapa = 'banco'
		await db.treinoSaude.update({ where: { healthId }, data: { analise, analisadaEm: new Date() } })

		const response: AnalyzeApiResponse = { analise, splits, laps }
		return Response.json(response)
	} catch (err) {
		console.error(`Erro na análise Claude da corrida do relógio (etapa ${etapa}):`, err)
		return Response.json({ error: descreverErroAnalise(etapa, err) }, { status: 500 })
	}
}

export async function action({ request }: { request: Request }) {
	await garantirVponto()
	if (request.method !== 'POST') {
		return Response.json({ error: 'Method not allowed' }, { status: 405 })
	}

	let corpo: (AnaliseInput & { healthId?: string }) | { healthId: string; treinusPlano?: string | null }
	try {
		corpo = await request.json()
	} catch {
		return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
	}

	// corrida lida do relógio (app Saúde): os dados saem do nosso banco, não do Strava
	if ('healthId' in corpo && typeof corpo.healthId === 'string' && corpo.healthId) {
		return analisarCorridaDoRelogio(corpo.healthId, corpo.treinusPlano ?? null)
	}

	const input = corpo as AnaliseInput

	let etapa: EtapaAnalise = 'strava'
	try {
		// 1. Fetch detailed activity from Strava (splits + laps)
		const detailed = await buscarAtividadeDetalhada(input.stravaId)
		const splits = (detailed.splits_metric ?? []) as SplitMetric[]
		const laps = (detailed.laps ?? []) as LapData[]

		// 2. Build prompt
		const promptText = buildPrompt(input, splits, laps)
			+ (input.treinusPlano ? buildPromptComparacao(input.treinusPlano) : '')

		// 3. Call Claude
		etapa = 'claude'
		const message = await client.messages.create({
			model: 'claude-sonnet-4-6',
			max_tokens: 4096,
			messages: [{ role: 'user', content: promptText }],
		})

		etapa = 'resposta'
		const text = message.content.find(b => b.type === 'text')?.text ?? ''
		const analise: AnaliseResult = lerJsonDaResposta(text)

		// 4. Persist splits, laps and analysis
		etapa = 'banco'
		await db.corrida.update({
			where: { stravaId: input.stravaId },
			data: { splits, laps, analise, analisadaEm: new Date() },
		})

		const response: AnalyzeApiResponse = { analise, splits, laps }
		return Response.json(response)
	} catch (err) {
		console.error(`Erro na análise Claude (etapa ${etapa}):`, err)
		return Response.json({ error: descreverErroAnalise(etapa, err) }, { status: 500 })
	}
}
