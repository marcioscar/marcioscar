export function parseDateInput(str: string): Date {
	const [y, m, d] = str.split('-').map(Number)
	return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

export function toDateInput(date: Date): string {
	const d = new Date(date)
	const y = d.getUTCFullYear()
	const m = String(d.getUTCMonth() + 1).padStart(2, '0')
	const day = String(d.getUTCDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

export function formatDate(date: Date): string {
	return new Date(date).toLocaleDateString('pt-BR', {
		day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
	})
}

export function computeDaysUntilRace(dataProva: Date): number {
	const r = new Date(dataProva)
	const raceDay = Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate())
	const t = new Date()
	const todayDay = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())
	return Math.round((raceDay - todayDay) / 86_400_000)
}

export function computeCurrentWeek(daysUntilRace: number, totalWeeks: number): number | null {
	if (daysUntilRace < 0) return null
	const week = totalWeeks - Math.ceil(daysUntilRace / 7) + 1
	return week >= 1 && week <= totalWeeks ? week : null
}

/** Início (segunda-feira) da semana que contém `date`, em UTC 00:00. */
export function getInicioSemana(date: Date = new Date()): Date {
	const d = new Date(date)
	d.setUTCHours(0, 0, 0, 0)
	const dow = d.getUTCDay() // 0=Dom .. 6=Sáb
	const diffParaSegunda = dow === 0 ? 6 : dow - 1
	d.setUTCDate(d.getUTCDate() - diffParaSegunda)
	return d
}

/** Chave estável (segunda-feira em ISO date) para identificar a semana atual, usada como cache key. */
export function getChaveSemanaAtual(): string {
	return toDateInput(getInicioSemana())
}
