import type { Route } from './+types/api.musculacao-grupos'
import { semanaIso } from '~/lib/musculacao'
import { listarGruposDaSemana } from '~/models/musculacao.server'

// GET /api/musculacao-grupos?data=yyyy-MM-dd  (ou ?ano=2026&semana=48)
// Grupos de treino da semana, do catálogo da academia Quattor.
export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const data = url.searchParams.get('data')
	let ano = Number(url.searchParams.get('ano'))
	let semana = Number(url.searchParams.get('semana'))

	if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
		;({ ano, semana } = semanaIso(data))
	}
	if (!Number.isInteger(ano) || !Number.isInteger(semana) || ano < 2020 || ano > 2100 || semana < 1 || semana > 53) {
		return Response.json({ error: 'Informe data=yyyy-MM-dd ou ano e semana.' }, { status: 400 })
	}

	const { fonte, grupos } = await listarGruposDaSemana(ano, semana)
	return Response.json({ ano, semana, fonte, grupos })
}
