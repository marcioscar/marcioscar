import type { Session, Week, Phase } from '~/data/halfMarathonPlan'
import { parsePace, formatPace } from '~/lib/trainingPaceUtils'

export const DAYS_OF_WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

const DAY_INDEX: Record<DayOfWeek, number> = {
	Seg: 0, Ter: 1, Qua: 2, Qui: 3, Sex: 4, Sáb: 5, Dom: 6,
}

/**
 * Papéis de sessão na metodologia Canova. A ordem do array é a ordem de
 * prioridade: ao reduzir os dias de treino, cortamos do fim para o início,
 * preservando sempre o trabalho específico e o longão.
 */
export const ROLE_ORDER = ['prova', 'longao', 'qualidade', 'fundamental', 'regenerativo'] as const
export type SessionRole = (typeof ROLE_ORDER)[number]

const HARD_ROLES = new Set<SessionRole>(['prova', 'longao', 'qualidade'])

export const ROLE_LABEL: Record<SessionRole, string> = {
	prova: 'Prova',
	longao: 'Longão',
	qualidade: 'Específico',
	fundamental: 'Fundamental',
	regenerativo: 'Regenerativo',
}

export interface PlannedSession extends Session {
	role: SessionRole
	km: number
	/** Sessão criada pelo planner porque o atleta treina mais dias que o template. */
	isFiller: boolean
	/** 'treinador' = prescrita pelo treinador; 'canova' = gerada pelo plano. */
	origem: 'canova' | 'treinador'
}

/** Treino prescrito pelo treinador para um dia específico da semana. */
export interface CoachSession {
	dia: DayOfWeek
	tipo: string
	/** Distância em km; null quando o treinador não especificou. */
	km: number | null
	/** Pace absoluto no formato "4:40"; null quando não especificado. */
	pace: string | null
	detalhe: string
}

// ── Classificação ─────────────────────────────────────────────────────────────

/** Menor offset (em segundos) presente no paceOffset; null quando é literal. */
function fastestOffsetSeconds(paceOffset: string): number | null {
	if (/pace alvo/i.test(paceOffset) && !/[+-]\d+s/.test(paceOffset)) return 0
	const matches = [...paceOffset.matchAll(/([+-])(\d+)s/g)].map(
		m => (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10),
	)
	if (/pace alvo/i.test(paceOffset)) matches.push(0)
	if (matches.length === 0) return null
	return Math.min(...matches)
}

/**
 * Classifica um treino do treinador pelo texto e pelo pace, para que o
 * preenchimento Canova saiba o que já está coberto na semana.
 */
/**
 * Maior zona de treino citada no texto ("Z2", "zona 3", "Z2 + Z4" → 4).
 * A zona é o sinal mais confiável quando o treinador escreve em pace absoluto,
 * porque o pace sozinho depende de quão ambicioso é o pace alvo da prova.
 */
function maiorZona(texto: string): number | null {
	const zonas = [...texto.matchAll(/\b(?:z|zona|zone)\s*([1-5])\b/gi)].map(m =>
		parseInt(m[1], 10),
	)
	return zonas.length ? Math.max(...zonas) : null
}

export function classifyCoachSession(coach: CoachSession, targetPace: string): SessionRole {
	const texto = `${coach.tipo} ${coach.detalhe}`

	if (/prova|competi[çc][ãa]o/i.test(texto)) return 'prova'
	if (/long[ãa]o|longo|long run/i.test(texto)) return 'longao'

	// Zona explícita manda: Z1 é regeneração, Z2 é base aeróbica (fundamental),
	// Z3 pra cima já é trabalho de qualidade. Vem antes das palavras-chave porque
	// "8km Z2 leve" é base, não regeneração, por mais que diga "leve".
	const zona = maiorZona(texto)
	if (zona !== null) {
		if (zona >= 3) return 'qualidade'
		return zona === 2 ? 'fundamental' : 'regenerativo'
	}

	if (/tempo|intervalad|fartlek|colina|subida|tiro|s[ée]rie|limiar|threshold|progress|espec[íi]fic|vo2|repeti[çc]/i.test(texto))
		return 'qualidade'
	if (/regener|recupera|trotinho|descanso|caminhada|muito leve/i.test(texto)) return 'regenerativo'

	// Último recurso: pace absoluto contra o pace alvo. As faixas são largas de
	// propósito — o ritmo fácil de um amador fica bem acima do pace de prova.
	if (coach.pace) {
		try {
			const delta = parsePace(coach.pace) - parsePace(targetPace)
			if (delta <= 25) return 'qualidade'
			if (delta >= 100) return 'regenerativo'
		} catch {
			// pace ilegível — cai no padrão
		}
	}
	return 'fundamental'
}

export function classifySession(session: Session): SessionRole {
	const type = session.type

	if (/^PROVA/i.test(type)) return 'prova'
	if (/longão/i.test(type)) return 'longao'
	if (/tempo|intervalad|fartlek|colina|marathon pace|specific|qualidade|progress|ritmo/i.test(type))
		return 'qualidade'
	if (/recupera|descanso|caminhada|regener|ativação/i.test(type)) return 'regenerativo'

	const offset = fastestOffsetSeconds(session.paceOffset)
	if (offset !== null) {
		if (offset <= 30) return 'qualidade'
		if (offset >= 70) return 'regenerativo'
	}
	return 'fundamental'
}

// ── Quantos treinos fortes cabem na semana ────────────────────────────────────

/**
 * Canova separa cada sessão forte por pelo menos um dia de regeneração. Com
 * poucos dias na semana o atleta mantém o longão e o trabalho específico, e é
 * o volume fácil que sai — nunca o contrário.
 */
export function maxHardSessions(daysPerWeek: number, phase: Phase): number {
	const base =
		daysPerWeek <= 1 ? 1
		: daysPerWeek <= 3 ? 2
		: daysPerWeek <= 6 ? 3
		: phase === 'Específica' ? 4
		: 3
	if (phase === 'Taper') return Math.min(base, 2)
	return base
}

// ── Volume por sessão ─────────────────────────────────────────────────────────

const ROLE_WEIGHT: Record<SessionRole, number> = {
	prova: 0,
	longao: 2.4,
	qualidade: 1.25,
	fundamental: 1.0,
	regenerativo: 0.7,
}

const RACE_KM: Record<string, number> = { meia: 21.1, maratona: 42.2 }

/**
 * Teto de quilometragem por sessão. Canova nunca empilha volume numa sessão só:
 * quando o atleta treina poucos dias, o volume semanal cai — a sessão não incha.
 */
const ROLE_CAP: Record<string, Record<SessionRole, number>> = {
	meia:     { prova: Infinity, longao: 24, qualidade: 16, fundamental: 14, regenerativo: 10 },
	maratona: { prova: Infinity, longao: 34, qualidade: 22, fundamental: 18, regenerativo: 12 },
}

export interface WeekVolume {
	/** Volume que o plano pede para a semana. */
	meta: number
	/** Volume que realmente cabe nos dias escolhidos, respeitando os tetos por sessão. */
	realizado: number
}

/**
 * Distribui o volume semanal entre as sessões pelo peso do papel de cada uma.
 * Sessões que estouram o teto são fixadas no teto e o excedente é redistribuído
 * entre as demais; o que não couber em lugar nenhum reduz o volume da semana.
 */
function distributeKm(
	roles: SessionRole[],
	weeklyKm: number,
	planKey: string,
	fixedKm: Array<number | null> = [],
): number[] {
	const raceKm = roles.includes('prova') ? (RACE_KM[planKey] ?? 0) : 0
	const caps = ROLE_CAP[planKey] ?? ROLE_CAP.meia
	// Na semana da prova o volume do plano é o dos treinos leves; a prova entra por cima.
	// O que o treinador já prescreveu sai do orçamento antes da distribuição.
	const prescrito = roles.reduce(
		(a, r, i) => (r === 'prova' ? a : a + (fixedKm[i] ?? 0)),
		0,
	)
	const budget = Math.max(weeklyKm - prescrito, 0)

	const km = roles.map((r, i) =>
		r === 'prova' ? raceKm : (fixedKm[i] ?? 0),
	)
	// Sessões com km definido pelo treinador não entram no rateio.
	const capped = roles.map((r, i) => r === 'prova' || fixedKm[i] != null)

	// Redistribui iterativamente até que nenhuma sessão livre estoure seu teto.
	let remaining = budget
	for (let pass = 0; pass < roles.length + 1 && remaining > 0.01; pass++) {
		const free = roles.map((_, i) => i).filter(i => !capped[i])
		if (free.length === 0) break
		const totalWeight = free.reduce((a, i) => a + ROLE_WEIGHT[roles[i]], 0)
		if (totalWeight <= 0) break

		let overflow = 0
		const share = free.map(i => (remaining * ROLE_WEIGHT[roles[i]]) / totalWeight)
		free.forEach((i, k) => {
			const cap = caps[roles[i]]
			const want = km[i] + share[k]
			if (want >= cap) {
				overflow += want - cap
				km[i] = cap
				capped[i] = true
			} else {
				km[i] = want
			}
		})
		remaining = overflow
	}

	return km.map(v => Math.round(v * 2) / 2)
}

// ── Alocação nos dias ─────────────────────────────────────────────────────────

/** Distância cíclica entre dois dias da semana (a semana fecha em ciclo). */
function cyclicGap(a: number, b: number): number {
	const d = Math.abs(a - b)
	return Math.min(d, 7 - d)
}

/** Normaliza o pace do treinador ("4:40") para o formato exibido no plano. */
function formatCoachPace(pace: string): string {
	try {
		return formatPace(parsePace(pace))
	} catch {
		return pace
	}
}

function fillerSession(): Session {
	return {
		day: 'Seg',
		type: 'Regenerativo',
		paceOffset: '+75s',
		detail: 'Trote leve, respiração totalmente confortável',
	}
}

/**
 * Reescreve a semana do template nos dias escolhidos pelo atleta.
 *
 * - Treinos do treinador (`coachSessions`) são fixados no dia prescrito e nunca
 *   alterados; o Canova só completa os dias que sobram.
 * - Corta pelas prioridades Canova quando há menos dias que sessões.
 * - Cria trotes regenerativos quando há mais dias que sessões.
 * - Coloca o longão no fim de semana e espaça os treinos fortes.
 * - Redistribui o volume semanal entre as sessões que sobraram.
 */
export function planWeek(
	week: Week,
	trainingDays: DayOfWeek[],
	weeklyKm: number,
	planKey: string,
	options: { coachSessions?: CoachSession[]; targetPace?: string } = {},
): PlannedSession[] {
	const coachSessions = options.coachSessions ?? []
	const targetPace = options.targetPace ?? '5:00'

	// Os dias prescritos pelo treinador entram na semana mesmo que não estejam
	// entre os dias marcados nas configurações — o treinador manda.
	const days = [...new Set([...trainingDays, ...coachSessions.map(c => c.dia)])]
		.sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])
	if (days.length === 0) return []

	const coachByDay = new Map<DayOfWeek, CoachSession>()
	for (const c of coachSessions) coachByDay.set(c.dia, c)

	const pool = week.sessions.map(s => ({ session: s, role: classifySession(s) }))
	const raceEntry = pool.find(p => p.role === 'prova') ?? null
	const raceDay = raceEntry ? (raceEntry.session.day as DayOfWeek) : null

	// Dias que o Canova pode preencher: sem prova e sem treino do treinador.
	let availableDays = days.filter(d => d !== raceDay && !coachByDay.has(d))

	const coachRoles = coachSessions.map(c => classifyCoachSession(c, targetPace))
	const coachHard = coachRoles.filter(r => HARD_ROLES.has(r)).length
	const coachHasLongao = coachRoles.includes('longao')

	// Seleção Canova para os dias restantes.
	const byPriority = [...pool]
		.filter(p => p.role !== 'prova')
		// O treinador já cobriu o longão? Então o Canova não repete outro.
		.filter(p => !(coachHasLongao && p.role === 'longao'))
		.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))

	const hardBudget =
		maxHardSessions(days.length, week.phase) - (raceEntry ? 1 : 0) - coachHard
	const slots = availableDays.length

	const chosen: typeof byPriority = []
	let hardUsed = 0
	for (const entry of byPriority) {
		if (chosen.length >= slots) break
		if (HARD_ROLES.has(entry.role)) {
			if (hardUsed >= hardBudget) continue
			hardUsed++
		}
		chosen.push(entry)
	}
	// Se sobraram vagas por causa do teto de treinos fortes, completa com trote.
	while (chosen.length < slots) {
		chosen.push({ session: fillerSession(), role: 'regenerativo' })
	}

	// ── Alocação nos dias ──
	type Placed = {
		day: DayOfWeek
		session: Session
		role: SessionRole
		origem: 'canova' | 'treinador'
		fixedKm: number | null
	}
	const placed: Placed[] = []
	const hardDayIdx: number[] = []

	if (raceEntry && raceDay) {
		placed.push({ day: raceDay, session: raceEntry.session, role: 'prova', origem: 'canova', fixedKm: null })
		hardDayIdx.push(DAY_INDEX[raceDay])
	}

	// Treinos do treinador: dia e conteúdo fixos.
	coachSessions.forEach((coach, i) => {
		if (coach.dia === raceDay) return
		const role = coachRoles[i]
		placed.push({
			day: coach.dia,
			session: {
				day: coach.dia,
				type: coach.tipo,
				paceOffset: coach.pace ? formatCoachPace(coach.pace) : '—',
				detail: coach.detalhe,
			},
			role,
			origem: 'treinador',
			fixedKm: coach.km,
		})
		if (HARD_ROLES.has(role)) hardDayIdx.push(DAY_INDEX[coach.dia])
	})

	function take(day: DayOfWeek) {
		availableDays = availableDays.filter(d => d !== day)
	}

	// Longão: domingo, senão sábado, senão o último dia disponível.
	const longEntry = chosen.find(c => c.role === 'longao')
	if (longEntry && availableDays.length > 0) {
		const day =
			availableDays.includes('Dom') ? 'Dom'
			: availableDays.includes('Sáb') ? 'Sáb'
			: availableDays[availableDays.length - 1]
		placed.push({ day, session: longEntry.session, role: 'longao', origem: 'canova', fixedKm: null })
		hardDayIdx.push(DAY_INDEX[day])
		take(day)
	}

	// Qualidade: guloso, sempre no dia mais distante dos treinos fortes já marcados.
	// Se o único encaixe for colado num treino forte, a sessão não entra —
	// Canova exige pelo menos um dia fácil entre dois treinos fortes.
	const descartadosPorEspacamento: typeof chosen = []
	for (const entry of chosen.filter(c => c.role === 'qualidade')) {
		if (availableDays.length === 0) break
		let bestDay = availableDays[0]
		let bestGap = -1
		let bestSpread = -1
		for (const d of availableDays) {
			const gaps = hardDayIdx.map(h => cyclicGap(h, DAY_INDEX[d]))
			const gap = gaps.length ? Math.min(...gaps) : 99
			// Empate na folga mínima: fica com o dia mais afastado do conjunto.
			const spread = gaps.reduce((a, b) => a + b, 0)
			if (gap > bestGap || (gap === bestGap && spread > bestSpread)) {
				bestGap = gap
				bestSpread = spread
				bestDay = d
			}
		}
		if (bestGap < 2 && hardDayIdx.length > 0) {
			descartadosPorEspacamento.push(entry)
			continue
		}
		placed.push({ day: bestDay, session: entry.session, role: 'qualidade', origem: 'canova', fixedKm: null })
		hardDayIdx.push(DAY_INDEX[bestDay])
		take(bestDay)
	}

	// Resto: regenerativo logo depois de um treino forte, fundamental nos demais dias.
	const regen = chosen.filter(c => c.role === 'regenerativo')
	const fund = chosen.filter(c => c.role === 'fundamental')
	// Cada qualidade descartada por espaçamento vira um trote regenerativo.
	descartadosPorEspacamento.forEach(() =>
		regen.push({ session: fillerSession(), role: 'regenerativo' }),
	)
	for (const d of [...availableDays]) {
		const prevDay = (DAY_INDEX[d] + 6) % 7
		const afterHard = hardDayIdx.includes(prevDay)
		const entry = afterHard ? (regen.shift() ?? fund.shift()) : (fund.shift() ?? regen.shift())
		if (!entry) break
		placed.push({ day: d, session: entry.session, role: entry.role, origem: 'canova', fixedKm: null })
		take(d)
	}

	placed.sort((a, b) => DAY_INDEX[a.day] - DAY_INDEX[b.day])

	const kms = distributeKm(
		placed.map(p => p.role),
		weeklyKm,
		planKey,
		placed.map(p => p.fixedKm),
	)

	return placed.map((p, i) => ({
		...p.session,
		day: p.day,
		role: p.role,
		km: kms[i],
		isFiller: p.origem === 'canova' && !week.sessions.includes(p.session),
		origem: p.origem,
	}))
}
