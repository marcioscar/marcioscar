import { exigirTokenTreino } from '~/lib/token-treino.server'
import type { Route } from './+types/api.vpontos'
import { ZONAS_RITMO, vpontoEmUso } from '~/lib/zonas-pace'
import { ritmosChave, tempoPrevisto } from '~/lib/vdot'
import { carregarCorridas, montarPainelVponto } from '~/models/vdot.server'
import { montarEvolucaoAtleta } from '~/models/evolucao-atleta.server'
import { garantirVponto, historicoVponto } from '~/models/vdot-config.server'

// GET /api/vpontos — VPONTO em uso, zonas, ritmos-chave, previsões e estimativas para a aba do app do iPhone (ios/).
// Autenticação: header `Authorization: Bearer <TREINO_API_TOKEN>`.

const PROVAS = [
	{ nome: '5 km', distanciaM: 5000 },
	{ nome: '10 km', distanciaM: 10000 },
	{ nome: '15 km', distanciaM: 15000 },
	{ nome: 'Meia maratona', distanciaM: 21097.5 },
	{ nome: 'Maratona', distanciaM: 42195 },
]

export async function loader({ request }: Route.LoaderArgs) {
	const negado = exigirTokenTreino(request)
	if (negado) return negado
	await garantirVponto()

	const [carregadas, historico] = await Promise.all([carregarCorridas(), historicoVponto()])
	const painel = await montarPainelVponto(carregadas)
	const evolucao = montarEvolucaoAtleta(carregadas)
	const atual = vpontoEmUso()
	const k = ritmosChave(atual)

	return Response.json(
		{
			vponto: atual,
			desde: painel.desde,
			origem: painel.origem,
			diasDesdeMudanca: painel.diasDesdeMudanca,
			fcMaxima: painel.fcMaxima,
			sugestao: painel.sugestao,
			zonas: ZONAS_RITMO.map(z => ({ id: z.id, nome: z.nome, lentoSeg: z.lentoSeg, rapidoSeg: z.rapidoSeg, uso: z.uso })),
			ritmosChave: [
				{ letra: 'F', nome: 'Fácil', paceSeg: k.F, uso: 'rodagens e longões' },
				{ letra: 'M', nome: 'Maratona', paceSeg: k.M, uso: 'blocos em ritmo de maratona' },
				{ letra: 'L', nome: 'Limiar', paceSeg: k.L, uso: 'corridas ritmadas e cruise intervals' },
				{ letra: 'I', nome: 'Intervalado', paceSeg: k.I, uso: 'tiros de 3 a 5 min (VO2 máx)' },
				{ letra: 'R', nome: 'Repetição', paceSeg: k.R, uso: 'tiros curtos e strides' },
			],
			previsoes: PROVAS.map(p => {
				const tempoSeg = tempoPrevisto(atual, p.distanciaM)
				return { nome: p.nome, distanciaM: p.distanciaM, tempoSeg, paceSeg: tempoSeg / (p.distanciaM / 1000) }
			}),
			provas: painel.evolucao.map(p => ({ data: p.data, nome: p.nome, distanciaKm: p.distanciaKm, tempoSeg: p.tempoSeg, vponto: p.vponto })),
			esforcos: painel.esforcos,
			porFc: painel.porFc.map(e => ({ data: e.data, km: e.km, paceSeg: e.paceSeg, vponto: e.vponto })),
			medianaFc: painel.medianaFc,
			historico,
			evolucao,
		},
		{ headers: { 'Cache-Control': 'no-store' } },
	)
}
