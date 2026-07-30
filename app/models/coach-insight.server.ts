import Anthropic from '@anthropic-ai/sdk'
import { db } from '../../db.server'
import { halfMarathonPlan } from '~/data/halfMarathonPlan'
import { marathonPlan } from '~/data/marathonPlan'
import type { ProvaAlvo } from '~/models/provas.server'
import {
	computeDaysUntilRace,
	computeCurrentWeek,
	getChaveSemanaAtual,
} from '~/lib/provaUtils'
import { resolveWeeklyKm } from '~/lib/trainingPaceUtils'
import { parsePace, formatPace, classificarZonaPace } from '~/lib/paceZone'
import { obterTendenciaVolumeSemanal, obterResumoSemanaAtual } from '~/models/corrida-dashboard.server'
import { listarUltimasCorridas } from '~/models/corridas.server'

const client = new Anthropic()

export type CoachInsightItem = {
	framework: string
	texto: string
	flag?: boolean
}

export type CoachInsight = {
	id: string
	provaId: string
	semana: string
	resumo: string
	insights: CoachInsightItem[]
	dicas: string[]
	geradoEm: Date
}

const PLANS: Record<string, typeof halfMarathonPlan> = {
	meia: halfMarathonPlan,
	maratona: marathonPlan,
}

export async function obterLeituraTreinadorCache(provaId: string): Promise<CoachInsight | null> {
	const semana = getChaveSemanaAtual()
	const registro = await db.coachInsight.findUnique({
		where: { provaId_semana: { provaId, semana } },
	})
	if (!registro) return null

	return {
		id: registro.id,
		provaId: registro.provaId,
		semana: registro.semana,
		resumo: registro.resumo,
		insights: registro.insights as unknown as CoachInsightItem[],
		dicas: registro.dicas,
		geradoEm: registro.geradoEm,
	}
}

function formatarTempo(seg: number): string {
	const h = Math.floor(seg / 3600)
	const m = Math.floor((seg % 3600) / 60)
	const s = Math.floor(seg % 60)
	return h > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${m}min${String(s).padStart(2, '0')}s`
}

async function montarContexto(prova: ProvaAlvo): Promise<string> {
	const plan = PLANS[prova.plano] ?? halfMarathonPlan
	const daysUntilRace = computeDaysUntilRace(new Date(prova.dataProva))
	const currentWeekNumber = computeCurrentWeek(daysUntilRace, plan.totalWeeks)
	const weekPlan = currentWeekNumber ? plan.weeks.find(w => w.number === currentWeekNumber) : null
	const paceAlvoSeg = parsePace(prova.paceAlvo)

	const [tendencia, semanaAtual, ultimasCorridas] = await Promise.all([
		obterTendenciaVolumeSemanal(6),
		obterResumoSemanaAtual(),
		listarUltimasCorridas(8),
	])

	const volumeAlvoSemana = weekPlan ? resolveWeeklyKm(weekPlan.volumeFraction, prova.kmSemanais) : prova.kmSemanais

	const tendenciaStr = tendencia
		.map(s => `${s.label}: ${s.km}km${s.emAndamento ? ' (semana em andamento)' : ''}`)
		.join(' | ')

	const sessoesPlanoStr = weekPlan
		? weekPlan.sessions
			.map(s => `${s.day}: ${s.type} — ${s.detail}`)
			.join('\n')
		: 'Sem semana de plano identificada para esta data (fora do calendário do plano).'

	const corridasStr = ultimasCorridas
		.map(c => {
			const distKm = c.distanciaMetros / 1000
			const paceSeg = distKm > 0 ? c.tempoMovimentoSeg / distKm : 0
			const zona = paceSeg > 0 ? classificarZonaPace(paceSeg, paceAlvoSeg).label : '—'
			const fc = c.frequenciaMedia ? `FC média ${Math.round(c.frequenciaMedia)}bpm` : 'sem FC'
			return `- ${new Date(c.dataInicio).toLocaleDateString('pt-BR')}: ${c.nome} — ${distKm.toFixed(1)}km em ${formatarTempo(c.tempoMovimentoSeg)} (${formatPace(paceSeg)}, zona: ${zona}, ${fc})`
		})
		.join('\n')

	return `## Prova alvo
- Nome: ${prova.nome}
- Modalidade: ${prova.plano === 'meia' ? 'Meia Maratona' : 'Maratona'}
- Data: ${new Date(prova.dataProva).toLocaleDateString('pt-BR')} (${daysUntilRace} dias restantes)
- Pace alvo: ${prova.paceAlvo}/km
- Volume semanal-base: ${prova.kmSemanais}km
- Dias de treino combinados: ${prova.diasTreino.join(', ')}

## Plano da semana atual (metodologia Canova)
${currentWeekNumber ? `Semana ${currentWeekNumber} de ${plan.totalWeeks} — fase ${weekPlan?.phase} — volume-alvo ~${volumeAlvoSemana}km` : 'Fora do calendário do plano'}
${sessoesPlanoStr}

## Execução real desta semana (${semanaAtual.kmSemana}km até agora, ${semanaAtual.sessoes.length} sessões)

## Tendência de volume semanal (últimas 6 semanas)
${tendenciaStr}

## Últimas corridas registradas
${corridasStr || 'Nenhuma corrida registrada ainda.'}`
}

function buildPrompt(contexto: string): string {
	return `Você é um treinador especialista na metodologia de Renato Canova para maratonistas e meio-maratonistas, escrevendo em português do Brasil.

Com base nos dados reais abaixo, escreva uma leitura curta e objetiva da semana atual de treino do atleta, ligando o dado real ao plano e à meta.

${contexto}

Responda APENAS com um objeto JSON válido (sem markdown, sem \`\`\`), com exatamente esta estrutura:
{
  "resumo": "2-3 frases sobre a situação atual do atleta rumo à prova — o que está indo bem e o que precisa de atenção",
  "insights": [
    { "framework": "nome curto do conceito ou princípio usado (ex: Extensão — Canova, 80/20 — Daniels, FC vs. pace)", "texto": "1-2 frases ligando esse conceito ao dado real do atleta", "flag": false }
  ],
  "dicas": ["recomendação acionável 1 para os próximos dias", "recomendação acionável 2"]
}

Gere entre 2 e 4 itens em "insights". Marque "flag": true apenas nos insights que sinalizam um alerta real (ex: FC muito acima do esperado para o pace, volume subindo rápido demais, sessão de qualidade sistematicamente saindo fácil demais). Gere entre 2 e 4 itens em "dicas", específicas e curtas.`
}

export async function gerarLeituraTreinador(prova: ProvaAlvo): Promise<CoachInsight> {
	const contexto = await montarContexto(prova)
	const promptText = buildPrompt(contexto)

	const message = await client.messages.create({
		model: 'claude-sonnet-4-6',
		max_tokens: 1024,
		messages: [{ role: 'user', content: promptText }],
	})

	const text = message.content.find(b => b.type === 'text')?.text ?? ''
	const parsed = JSON.parse(text) as { resumo: string; insights: CoachInsightItem[]; dicas: string[] }

	const semana = getChaveSemanaAtual()
	const registro = await db.coachInsight.upsert({
		where: { provaId_semana: { provaId: prova.id, semana } },
		create: {
			provaId: prova.id,
			semana,
			resumo: parsed.resumo,
			insights: parsed.insights as unknown as object[],
			dicas: parsed.dicas,
		},
		update: {
			resumo: parsed.resumo,
			insights: parsed.insights as unknown as object[],
			dicas: parsed.dicas,
			geradoEm: new Date(),
		},
	})

	return {
		id: registro.id,
		provaId: registro.provaId,
		semana: registro.semana,
		resumo: registro.resumo,
		insights: registro.insights as unknown as CoachInsightItem[],
		dicas: registro.dicas,
		geradoEm: registro.geradoEm,
	}
}
