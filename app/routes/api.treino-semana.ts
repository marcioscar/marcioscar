import { timingSafeEqual } from 'node:crypto'
import type { Route } from './+types/api.treino-semana'
import { DAYS_OF_WEEK } from '~/lib/canovaPlanner'
import { chaveDia } from '~/lib/carga-treino'
import { converterSessao } from '~/lib/treino-para-relogio'
import { montarPlanoSemanaAtual } from '~/models/plano-semana.server'
import { listarProvas } from '~/models/provas.server'

// GET /api/treino-semana — treinos da semana atual no formato do app do Apple Watch (ios/).
// Autenticação: header `Authorization: Bearer <TREINO_API_TOKEN>`.

function tokenValido(request: Request, esperado: string): boolean {
	const enviado = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
	const a = Buffer.from(enviado)
	const b = Buffer.from(esperado)
	return a.length === b.length && timingSafeEqual(a, b)
}

function somarDias(chave: string, dias: number): string {
	const d = new Date(`${chave}T12:00:00Z`)
	d.setUTCDate(d.getUTCDate() + dias)
	return d.toISOString().slice(0, 10)
}

const SEM_CACHE = { 'Cache-Control': 'no-store' }

export async function loader({ request }: Route.LoaderArgs) {
	const esperado = process.env.TREINO_API_TOKEN
	if (!esperado) {
		return Response.json(
			{ error: 'TREINO_API_TOKEN não configurado no servidor.' },
			{ status: 503, headers: SEM_CACHE },
		)
	}
	if (!tokenValido(request, esperado)) {
		return Response.json({ error: 'Token inválido.' }, { status: 401, headers: SEM_CACHE })
	}

	const provas = await listarProvas()
	const prova = provas.find(p => p.ativa)
	if (!prova) {
		return Response.json({ sessoes: [], aviso: 'Nenhuma prova ativa cadastrada.' }, { headers: SEM_CACHE })
	}

	const { plano } = await montarPlanoSemanaAtual(prova)
	if (!plano) {
		return Response.json(
			{ sessoes: [], aviso: 'Sem plano para a semana atual (fora do período do plano).' },
			{ headers: SEM_CACHE },
		)
	}

	// segunda-feira da semana corrente, no fuso de São Paulo
	const hoje = chaveDia(new Date())
	const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay() // 0=Dom
	const segunda = somarDias(hoje, -((dow + 6) % 7))

	const sessoes = plano.sessions.map(s =>
		converterSessao(s, prova.paceAlvo, somarDias(segunda, DAYS_OF_WEEK.indexOf(s.day))),
	)

	return Response.json(
		{
			semana: {
				inicio: segunda,
				fim: somarDias(segunda, 6),
				numero: plano.numero,
				totalSemanas: plano.totalSemanas,
				fase: plano.fase,
			},
			prova: { nome: prova.nome, paceAlvo: prova.paceAlvo },
			sessoes,
		},
		{ headers: SEM_CACHE },
	)
}
