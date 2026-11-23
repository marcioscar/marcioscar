import { halfMarathonPlan } from '~/data/halfMarathonPlan'
import { marathonPlan } from '~/data/marathonPlan'
import type { Phase } from '~/data/halfMarathonPlan'
import { planWeek, type DayOfWeek, type PlannedSession } from '~/lib/canovaPlanner'
import { computeCurrentWeek, computeDaysUntilRace } from '~/lib/provaUtils'
import { resolveWeeklyKm } from '~/lib/trainingPaceUtils'
import { obterTreinoTreinador } from '~/models/treino-treinador.server'
import { listarProvas } from '~/models/provas.server'

const PLANS: Record<string, typeof halfMarathonPlan> = {
	meia: halfMarathonPlan,
	maratona: marathonPlan,
}

export type Prova = Awaited<ReturnType<typeof listarProvas>>[number]

export type PlanoSemanaAtual = {
	numero: number
	totalSemanas: number
	fase: Phase
	sessions: PlannedSession[]
	volumeFraction: number
} | null

/**
 * Plano Canova da semana corrente para a prova ativa, já encaixado nos dias do atleta
 * e com os treinos do treinador fixados (mesma regra do painel).
 */
export async function montarPlanoSemanaAtual(provaAtiva: Prova): Promise<{
	plano: PlanoSemanaAtual
	daysUntilRace: number
	distanciaKm: number
}> {
	const plan = PLANS[provaAtiva.plano] ?? halfMarathonPlan
	const distanciaKm = plan.distance === '42.2km' ? 42.2 : 21.1
	const daysUntilRace = computeDaysUntilRace(new Date(provaAtiva.dataProva))
	const numero = computeCurrentWeek(daysUntilRace, plan.totalWeeks)
	const weekPlan = numero ? plan.weeks.find(w => w.number === numero) : null

	if (!numero || !weekPlan) return { plano: null, daysUntilRace, distanciaKm }

	// O plano-base é um template Canova em dias fixos. Reescrevemos a semana exatamente
	// nos dias que o atleta escolheu, preservando longão e trabalho específico e
	// redistribuindo o volume entre as sessões que sobram. Treinos que o treinador
	// prescreveu para esta semana ficam fixos; o Canova completa os dias restantes.
	const doTreinador = await obterTreinoTreinador(provaAtiva.id, numero)
	const sessions = planWeek(
		weekPlan,
		provaAtiva.diasTreino as DayOfWeek[],
		resolveWeeklyKm(weekPlan.volumeFraction, provaAtiva.kmSemanais),
		provaAtiva.plano,
		{ coachSessions: doTreinador, targetPace: provaAtiva.paceAlvo },
	)

	return {
		plano: {
			numero,
			totalSemanas: plan.totalWeeks,
			fase: weekPlan.phase,
			sessions,
			volumeFraction: weekPlan.volumeFraction,
		},
		daysUntilRace,
		distanciaKm,
	}
}
