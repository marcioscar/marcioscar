import { exigirTokenTreino } from '~/lib/token-treino.server'
import type { Route } from './+types/api.treino-semana'
import { DAYS_OF_WEEK } from '~/lib/canovaPlanner'
import { chaveDia } from '~/lib/carga-treino'
import { converterSessao, type SessaoRelogio } from '~/lib/treino-para-relogio'
import { listarTreinosManuais } from '~/models/treino-manual.server'
import { musculacaoParaSessao } from '~/lib/musculacao'
import { listarMusculacao } from '~/models/musculacao.server'
import { montarPlanoSemanaAtual } from '~/models/plano-semana.server'
import { listarProvas } from '~/models/provas.server'

// GET /api/treino-semana — treinos da semana atual no formato do app do Apple Watch (ios/).
// Autenticação: header `Authorization: Bearer <TREINO_API_TOKEN>`.

function somarDias(chave: string, dias: number): string {
	const d = new Date(`${chave}T12:00:00Z`)
	d.setUTCDate(d.getUTCDate() + dias)
	return d.toISOString().slice(0, 10)
}

const SEM_CACHE = { 'Cache-Control': 'no-store' }

export async function loader({ request }: Route.LoaderArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado

	// segunda-feira da semana corrente, no fuso de São Paulo
	const hoje = chaveDia(new Date())
	const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay() // 0=Dom
	const segunda = somarDias(hoje, -((dow + 6) % 7))
	const fim = somarDias(segunda, 6)

	// Treinos montados à mão têm prioridade; "descanso" manual também tira o treino do plano da prova.
	const [manuais, musculacao] = await Promise.all([listarTreinosManuais(segunda, fim), listarMusculacao(segunda, fim)])
	const musculacaoPorDia = new Map(musculacao.map(m => [m.data, m]))
	const manualPorDia = new Map(manuais.map(t => [t.data, t]))

	const provas = await listarProvas()
	const prova = provas.find(p => p.ativa)
	const montado = prova ? await montarPlanoSemanaAtual(prova) : null
	const plano = montado?.plano ?? null

	const sessoes: SessaoRelogio[] = []
	for (let i = 0; i < 7; i++) {
		const data = somarDias(segunda, i)
		const manual = manualPorDia.get(data)
		if (manual) {
			if (manual.tipo !== 'descanso') {
				sessoes.push({
					id: `manual-${data}`,
					data,
					titulo: manual.titulo,
					tipo: manual.tipo,
					origem: 'manual',
					observacao: manual.observacao,
					aquecimento: manual.aquecimento,
					blocos: manual.blocos,
					desaquecimento: manual.desaquecimento,
				})
			}
			continue
		}
		const doPlano = plano?.sessions.find(s => DAYS_OF_WEEK.indexOf(s.day) === i)
		if (doPlano && prova) sessoes.push(converterSessao(doPlano, prova.paceAlvo, data))
	}

	// musculação escolhida para cada dia (pode coexistir com a corrida do mesmo dia)
	for (const m of musculacaoPorDia.values()) sessoes.push(musculacaoParaSessao(m))
	sessoes.sort((a, b) => a.data.localeCompare(b.data) || (a.atividade === 'musculacao' ? 1 : 0) - (b.atividade === 'musculacao' ? 1 : 0))

	return Response.json(
		{
			semana: {
				inicio: segunda,
				fim,
				numero: plano?.numero ?? 0,
				totalSemanas: plano?.totalSemanas ?? 0,
				fase: plano?.fase ?? 'Manual',
			},
			prova: prova ? { nome: prova.nome, paceAlvo: prova.paceAlvo } : null,
			sessoes,
			aviso: sessoes.length === 0 ? 'Nenhum treino nesta semana. Monte em Treinos no site.' : null,
		},
		{ headers: SEM_CACHE },
	)
}
