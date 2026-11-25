import { db } from '../../db.server'
import { ROTULO_FASE, type ConfigSugestaoDados, type FaseSugestao } from '~/lib/treino-manual'
import { obterProvaAtiva } from '~/models/provas.server'

const NOMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/** A última escolha salva; na primeira vez, os dias e os km da prova ativa. */
export async function obterConfigSugestao(): Promise<ConfigSugestaoDados> {
	const c = await db.configSugestao.findFirst({ orderBy: { updatedAt: 'desc' } })
	if (c) {
		return {
			dias: c.dias,
			diaLongao: c.diaLongao,
			volumeKm: c.volumeKm,
			fase: (c.fase in ROTULO_FASE ? c.fase : 'construcao') as FaseSugestao,
		}
	}
	const prova = await obterProvaAtiva()
	const daProva = (prova?.diasTreino ?? []).map(d => NOMES.indexOf(d)).filter(i => i >= 0).sort((a, b) => a - b)
	const dias = daProva.length >= 2 ? daProva : [1, 3, 5, 6]
	return {
		dias,
		diaLongao: dias.includes(5) ? 5 : dias[dias.length - 1],
		volumeKm: prova?.kmSemanais ?? 50,
		fase: 'construcao',
	}
}

export async function salvarConfigSugestao(d: ConfigSugestaoDados): Promise<void> {
	const existente = await db.configSugestao.findFirst()
	if (existente) await db.configSugestao.update({ where: { id: existente.id }, data: d })
	else await db.configSugestao.create({ data: d })
}
