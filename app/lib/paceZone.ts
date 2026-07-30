import { parsePace, formatPace } from '~/lib/trainingPaceUtils'

export type ZonaPace = {
	label: string
	corClasse: string
}

/**
 * Classifica um pace realizado contra o pace-alvo de prova, usando as mesmas
 * faixas de referência (Canova) já usadas em api.analisar-corrida.ts.
 */
export function classificarZonaPace(paceSegPorKm: number, paceAlvoSegPorKm: number): ZonaPace {
	const diff = paceSegPorKm - paceAlvoSegPorKm

	if (diff > 90) return { label: 'Recuperação', corClasse: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' }
	if (diff > 60) return { label: 'Fácil', corClasse: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' }
	if (diff > 20) return { label: 'Moderado', corClasse: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
	if (diff > 5) return { label: 'Limiar', corClasse: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
	if (diff >= -5) return { label: 'Ritmo de prova', corClasse: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' }
	return { label: 'Forte', corClasse: 'bg-red-500/10 text-red-600 dark:text-red-400' }
}

export function diffParaAlvoStr(paceSegPorKm: number, paceAlvoSegPorKm: number): string {
	const diff = paceSegPorKm - paceAlvoSegPorKm
	const sinal = diff > 0 ? '+' : diff < 0 ? '-' : ''
	return `${sinal}${formatPace(Math.abs(diff)).replace('/km', '')}/km`
}

export { parsePace, formatPace }
