// Treinos de musculação: catálogo da academia, escolha do dia e conversão para o relógio.
import type { SessaoRelogio } from '~/lib/treino-para-relogio'

export type ExercicioAcademia = { nome: string; Repeticoes?: string; obs?: string }

export type GrupoAcademia = { grupo: string; exercicios: ExercicioAcademia[] }

/** Um movimento de um bi/tri/quadri set (ou o próprio exercício, quando é simples). */
export type ItemExercicio = {
	nome: string
	repeticoes: number | null
	/** para exercícios por tempo (prancha 1 min, isometria) */
	duracaoSeg: number | null
	nota: string | null
}

export type ExercicioPlanejado = {
	/** nome do exercício, como na academia (ex.: "Bi Set Supino Inclinado") */
	nome: string
	series: number
	repeticoes: number | null
	/** ex.: "cada lado" */
	nota: string | null
	/** presente nos bi/tri/quadri sets: os movimentos feitos em sequência a cada série */
	itens?: ItemExercicio[]
}

export type TreinoMusculacaoDados = {
	data: string
	grupo: string
	descansoSeg: number
	exercicios: ExercicioPlanejado[]
	observacao: string | null
}

/** Semana ISO (ano e número) de uma data yyyy-MM-dd, como o sistema da academia grava. */
export function semanaIso(dataYmd: string): { ano: number; semana: number } {
	const d = new Date(`${dataYmd}T12:00:00Z`)
	const dia = (d.getUTCDay() + 6) % 7 // segunda = 0
	d.setUTCDate(d.getUTCDate() - dia + 3) // quinta da semana: define o ano ISO
	const ano = d.getUTCFullYear()
	const primeiraQuinta = new Date(Date.UTC(ano, 0, 4, 12))
	const semana =
		1 +
		Math.round(
			((d.getTime() - primeiraQuinta.getTime()) / 86400000 - 3 + ((primeiraQuinta.getUTCDay() + 6) % 7)) / 7,
		)
	return { ano, semana }
}

// ── Interpretação do texto da academia ──────────────────────────────────────
// Os treinos vêm em texto livre: "4 x 10", "4X10 PARA CADA LADO", "4X10 + FLYING INCLINADO 4X10",
// "3X 1MIN", "4X MÁXIMAS REPETIÇÕES", às vezes com erros de digitação ("X10", "4X0", "†" no lugar do "+").

function tituloCase(texto: string): string {
	return texto
		.toLowerCase()
		.replace(/(^|\s)(\S)/g, (_, esp, c) => esp + c.toUpperCase())
		.replace(/\s+/g, ' ')
		.trim()
}

type Parte = {
	nome: string
	series: number | null
	repeticoes: number | null
	duracaoSeg: number | null
	nota: string | null
}

function interpretarParte(parte: string): Parte {
	// "4X10", "3X 1MIN", "4X30 SEG": exige dígitos colados no X para não confundir com o "x" de "FLEXÃO"
	const m = parte.match(/(\d+)\s*[xX×]\s*(\d*)\s*(MIN|SEG)?/i)
	if (m) {
		const nome = parte.slice(0, m.index).trim()
		const resto = parte.slice((m.index ?? 0) + m[0].length).trim()
		const valor = m[2] ? Number(m[2]) : null
		const unidade = m[3]?.toUpperCase()
		const duracaoSeg = valor && unidade ? valor * (unidade === 'MIN' ? 60 : 1) : null
		return {
			nome,
			series: Number(m[1]) || null,
			repeticoes: !unidade && valor ? valor : null,
			duracaoSeg,
			nota: resto || null,
		}
	}
	// "X10 + ...": a série ficou sem número; guarda só as repetições
	const sem = parte.match(/(^|\s)[xX]\s*(\d+)/)
	if (sem) {
		return { nome: parte.slice(0, sem.index).trim(), series: null, repeticoes: Number(sem[2]) || null, duracaoSeg: null, nota: null }
	}
	return { nome: parte.trim(), series: null, repeticoes: null, duracaoSeg: null, nota: null }
}

/** Converte um exercício do catálogo (nome + "Repeticoes" em texto) no formato do planejamento. */
export function paraPlanejado(e: ExercicioAcademia): ExercicioPlanejado {
	const partes = (e.Repeticoes ?? '').split(/\s*[+†]\s*/).map(p => p.trim()).filter(Boolean)
	const lidas = partes.map(interpretarParte)
	const primeiro = lidas[0] ?? { nome: '', series: null, repeticoes: null, duracaoSeg: null, nota: null }

	// séries do conjunto: a mais comum entre as partes que têm número (padrão 4)
	const contagem = new Map<number, number>()
	for (const l of lidas) if (l.series) contagem.set(l.series, (contagem.get(l.series) ?? 0) + 1)
	const series = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 4

	if (lidas.length <= 1) {
		return { nome: e.nome, series, repeticoes: primeiro.repeticoes, nota: primeiro.nota }
	}

	// bi/tri/quadri set: o 1º movimento leva o nome do exercício sem o prefixo; os demais vêm no próprio texto
	const nomeBase = e.nome.replace(/^(bi|tri|quadri)\s+set\s+/i, '').trim()
	const itens: ItemExercicio[] = lidas.map((l, i) => ({
		nome: i === 0 ? nomeBase : tituloCase(l.nome) || nomeBase,
		repeticoes: l.repeticoes,
		duracaoSeg: l.duracaoSeg,
		nota: l.nota ? tituloCase(l.nota).replace(/^Para Cada Lado$/i, 'cada lado').toLowerCase() : null,
	}))
	return { nome: e.nome, series, repeticoes: primeiro.repeticoes, nota: itens[0].nota, itens }
}

const SEG_POR_REPETICAO = 3
const SEG_BASE_SERIE = 15

/** Estimativa de duração: cada movimento ~15 s + 3 s por repetição (ou o tempo dele), e o descanso após cada série. */
export function estimarMinutosMusculacao(t: Pick<TreinoMusculacaoDados, 'exercicios' | 'descansoSeg'>): number {
	let seg = 0
	for (const e of t.exercicios) {
		const itens = e.itens ?? [{ repeticoes: e.repeticoes, duracaoSeg: null }]
		const porSerie = itens.reduce(
			(acc, i) => acc + (i.duracaoSeg ?? SEG_BASE_SERIE + (i.repeticoes ?? 10) * SEG_POR_REPETICAO),
			0,
		)
		seg += e.series * (porSerie + t.descansoSeg)
	}
	return Math.round(seg / 60)
}

// ── Para o relógio ──────────────────────────────────────────────────────────

const etapaVazia = {
	distanciaM: null,
	zona: null,
	paceRapidoSeg: null,
	paceLentoSeg: null,
} as const

function nomeDaEtapa(i: { nome: string; repeticoes: number | null; duracaoSeg: number | null; nota: string | null }): string {
	const detalhe = i.duracaoSeg
		? i.duracaoSeg >= 60 && i.duracaoSeg % 60 === 0
			? `${i.duracaoSeg / 60} min`
			: `${i.duracaoSeg} s`
		: i.repeticoes
			? `${i.repeticoes} reps`
			: ''
	return [i.nome, [detalhe, i.nota].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
}

/**
 * Cada exercício vira um bloco repetido pelas séries. Num bi/tri/quadri set, o bloco tem um passo por
 * movimento e o descanso só no fim da rodada. Séries por repetição têm meta aberta (você toca no relógio
 * ao terminar); as por tempo (prancha, isometria) têm meta de tempo. O nome aparece no iOS 18 ou mais.
 */
export function musculacaoParaSessao(t: TreinoMusculacaoDados): SessaoRelogio {
	return {
		id: `musculacao-${t.data}`,
		data: t.data,
		titulo: `Musculação · ${tituloCase(t.grupo)}`,
		tipo: 'musculacao',
		atividade: 'musculacao',
		origem: 'manual',
		observacao: t.observacao,
		aquecimento: null,
		blocos: t.exercicios.map(e => {
			const itens = e.itens ?? [{ nome: e.nome, repeticoes: e.repeticoes, duracaoSeg: null, nota: e.nota }]
			return {
				repeticoes: e.series,
				etapas: [
					...itens.map(i => ({
						...etapaVazia,
						papel: 'trabalho' as const,
						tempoSeg: i.duracaoSeg,
						nome: nomeDaEtapa(i),
					})),
					{ ...etapaVazia, papel: 'recuperacao' as const, tempoSeg: t.descansoSeg, nome: 'Descanso' },
				],
			}
		}),
		desaquecimento: null,
	}
}

// ── Validação do que vem do formulário ──────────────────────────────────────

function sanearItem(bruto: unknown): ItemExercicio | null {
	const x = (bruto ?? {}) as Record<string, unknown>
	const nome = String(x.nome ?? '').trim().slice(0, 80)
	if (!nome) return null
	const rep = Number(x.repeticoes)
	const dur = Number(x.duracaoSeg)
	return {
		nome,
		repeticoes: Number.isFinite(rep) && rep > 0 ? Math.min(Math.round(rep), 100) : null,
		duracaoSeg: Number.isFinite(dur) && dur > 0 ? Math.min(Math.round(dur), 1800) : null,
		nota: typeof x.nota === 'string' && x.nota.trim() ? x.nota.trim().slice(0, 60) : null,
	}
}

export function sanearMusculacao(bruto: unknown): TreinoMusculacaoDados | null {
	if (!bruto || typeof bruto !== 'object') return null
	const r = bruto as Record<string, unknown>
	if (typeof r.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.data)) return null
	const grupo = String(r.grupo ?? '').trim().slice(0, 80)
	if (!grupo) return null
	const descanso = Math.min(Math.max(Math.round(Number(r.descansoSeg) || 60), 15), 600)
	const exercicios = (Array.isArray(r.exercicios) ? r.exercicios : [])
		.slice(0, 30)
		.map(e => {
			const x = (e ?? {}) as Record<string, unknown>
			const nome = String(x.nome ?? '').trim().slice(0, 80)
			if (!nome) return null
			const rep = Number(x.repeticoes)
			const itens = Array.isArray(x.itens)
				? x.itens.slice(0, 8).map(sanearItem).filter((i): i is ItemExercicio => i !== null)
				: []
			return {
				nome,
				series: Math.min(Math.max(Math.round(Number(x.series) || 0), 1), 12),
				repeticoes: Number.isFinite(rep) && rep > 0 ? Math.min(Math.round(rep), 100) : null,
				nota: typeof x.nota === 'string' && x.nota.trim() ? x.nota.trim().slice(0, 60) : null,
				...(itens.length > 1 ? { itens } : {}),
			}
		})
		.filter((e): e is ExercicioPlanejado => e !== null)
	if (exercicios.length === 0) return null
	return {
		data: r.data,
		grupo,
		descansoSeg: descanso,
		exercicios,
		observacao: typeof r.observacao === 'string' && r.observacao.trim() ? r.observacao.trim().slice(0, 300) : null,
	}
}
