import Anthropic from '@anthropic-ai/sdk'
import { db } from '../../db.server'
import { DAYS_OF_WEEK, type CoachSession, type DayOfWeek } from '~/lib/canovaPlanner'

const client = new Anthropic()

export type TreinoTreinador = {
	id: string
	provaId: string
	semana: number
	sessoes: CoachSession[]
	textoOrigem: string | null
	updatedAt: Date
}

// ── Persistência ──────────────────────────────────────────────────────────────

export async function listarTreinosTreinador(provaId: string): Promise<TreinoTreinador[]> {
	const registros = await db.treinoTreinador.findMany({
		where: { provaId },
		orderBy: { semana: 'asc' },
	})
	return registros.map(r => ({
		id: r.id,
		provaId: r.provaId,
		semana: r.semana,
		sessoes: r.sessoes as unknown as CoachSession[],
		textoOrigem: r.textoOrigem,
		updatedAt: r.updatedAt,
	}))
}

export async function salvarTreinoTreinador(
	provaId: string,
	semana: number,
	sessoes: CoachSession[],
	textoOrigem: string | null,
): Promise<void> {
	await db.treinoTreinador.upsert({
		where: { provaId_semana: { provaId, semana } },
		create: { provaId, semana, sessoes: sessoes as unknown as object[], textoOrigem },
		update: { sessoes: sessoes as unknown as object[], textoOrigem },
	})
}

export async function removerTreinoTreinador(provaId: string, semana: number): Promise<void> {
	await db.treinoTreinador.deleteMany({ where: { provaId, semana } })
}

// ── Interpretação do texto do treinador ───────────────────────────────────────

/** Normaliza o dia vindo da IA para uma das abreviações usadas no plano. */
function normalizarDia(valor: unknown): DayOfWeek | null {
	if (typeof valor !== 'string') return null
	const limpo = valor
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
	const mapa: Record<string, DayOfWeek> = {
		seg: 'Seg', segunda: 'Seg', 'segunda-feira': 'Seg', mon: 'Seg',
		ter: 'Ter', terca: 'Ter', 'terca-feira': 'Ter', tue: 'Ter',
		qua: 'Qua', quarta: 'Qua', 'quarta-feira': 'Qua', wed: 'Qua',
		qui: 'Qui', quinta: 'Qui', 'quinta-feira': 'Qui', thu: 'Qui',
		sex: 'Sex', sexta: 'Sex', 'sexta-feira': 'Sex', fri: 'Sex',
		sab: 'Sáb', sabado: 'Sáb', sat: 'Sáb',
		dom: 'Dom', domingo: 'Dom', sun: 'Dom',
	}
	return mapa[limpo] ?? (DAYS_OF_WEEK.find(d => d.toLowerCase() === limpo) ?? null)
}

/** Aceita "4:40", "4'40", "4.40", "4m40" e devolve sempre "4:40". */
function normalizarPace(valor: unknown): string | null {
	if (typeof valor !== 'string') return null
	const m = valor.trim().match(/(\d{1,2})\s*[:'.,m]\s*(\d{1,2})/)
	if (!m) return null
	return `${parseInt(m[1], 10)}:${m[2].padStart(2, '0')}`
}

function normalizarKm(valor: unknown): number | null {
	const n = typeof valor === 'number' ? valor : parseFloat(String(valor ?? '').replace(',', '.'))
	if (!Number.isFinite(n) || n <= 0 || n > 100) return null
	return Math.round(n * 10) / 10
}

/** Descarta o que a IA devolveu fora do formato e mantém um treino por dia. */
export function sanitizarSessoes(bruto: unknown): CoachSession[] {
	if (!Array.isArray(bruto)) return []
	const porDia = new Map<DayOfWeek, CoachSession>()
	for (const item of bruto) {
		if (!item || typeof item !== 'object') continue
		const registro = item as Record<string, unknown>
		const dia = normalizarDia(registro.dia)
		if (!dia || porDia.has(dia)) continue
		const tipo = String(registro.tipo ?? '').trim()
		const detalhe = String(registro.detalhe ?? '').trim()
		if (!tipo && !detalhe) continue
		porDia.set(dia, {
			dia,
			tipo: tipo || 'Treino',
			km: normalizarKm(registro.km),
			pace: normalizarPace(registro.pace),
			detalhe,
		})
	}
	return [...porDia.values()].sort(
		(a, b) => DAYS_OF_WEEK.indexOf(a.dia) - DAYS_OF_WEEK.indexOf(b.dia),
	)
}

const PROMPT = `Você extrai treinos de corrida de um texto escrito por um treinador em português do Brasil.

Leia o texto e devolva um treino por dia da semana mencionado. Regras:
- "dia": use exatamente uma destas abreviações: Seg, Ter, Qua, Qui, Sex, Sáb, Dom.
- "tipo": nome curto do treino (ex: "Intervalado", "Rodagem", "Longo", "Tempo run", "Regenerativo").
  Nomeie pelo que o treinador escreveu, não pela sua opinião sobre a intensidade.
  Rodagem em Z2 é "Rodagem", não "Regenerativo" — reserve "Regenerativo" para Z1,
  trote ou quando o treinador usar essa palavra.
- Preserve as zonas (Z1..Z5) no detalhe quando o treinador as mencionar: elas
  definem a intensidade da sessão no plano.
- "km": distância total em quilômetros, como número. Use null se o treinador não disser a distância.
  Se vier em minutos e não em km, deixe null e registre a duração no detalhe.
- "pace": o pace principal do treino no formato "m:ss" por km. Use null se não houver.
  Se houver mais de um pace (ex: tiro e trote), use o pace do trecho forte.
- "detalhe": a prescrição como o treinador escreveu, resumida em uma linha.
- Ignore aquecimento/desaquecimento como treinos separados: eles fazem parte do dia.
- Não invente treinos que não estão no texto. Se um dia não aparece, ele não entra na lista.

Responda APENAS com um array JSON válido, sem markdown e sem \`\`\`:
[{"dia":"Ter","tipo":"Intervalado","km":10,"pace":"4:40","detalhe":"3x2km em 4:40 com 1km de trote"}]`

export async function interpretarTextoTreinador(texto: string): Promise<CoachSession[]> {
	const limpo = texto.trim()
	if (!limpo) return []

	const message = await client.messages.create({
		model: 'claude-sonnet-4-6',
		max_tokens: 1024,
		messages: [{ role: 'user', content: `${PROMPT}\n\n--- TEXTO DO TREINADOR ---\n${limpo}` }],
	})

	const resposta = message.content.find(b => b.type === 'text')?.text ?? ''
	// A IA às vezes embrulha o JSON em prosa; pega o primeiro array da resposta.
	const inicio = resposta.indexOf('[')
	const fim = resposta.lastIndexOf(']')
	if (inicio === -1 || fim <= inicio) return []

	try {
		return sanitizarSessoes(JSON.parse(resposta.slice(inicio, fim + 1)))
	} catch {
		return []
	}
}

/** Sessões que o treinador prescreveu para uma semana; vazio quando não há. */
export async function obterTreinoTreinador(
	provaId: string,
	semana: number,
): Promise<CoachSession[]> {
	const registro = await db.treinoTreinador.findUnique({
		where: { provaId_semana: { provaId, semana } },
	})
	return registro ? (registro.sessoes as unknown as CoachSession[]) : []
}
