// Treinos montados à mão: tipos, modelos prontos (Jack Daniels) e sugestão de semana.
// Mesmo formato que o app do Apple Watch recebe (EtapaRelogio / SessaoRelogio).

import type { EtapaRelogio, SessaoRelogio } from '~/lib/treino-para-relogio'
import { ZONAS_RITMO } from '~/lib/zonas-pace'

// musculação tem tipo próprio no relógio, mas é montada em outro editor: aqui só entram corridas e descanso
export type TipoTreino = Exclude<SessaoRelogio['tipo'], 'musculacao'> | 'descanso'

export const ROTULO_TIPO: Record<TipoTreino, string> = {
	descanso: 'Descanso',
	leve: 'Rodagem',
	limiar: 'Limiar',
	tiros: 'Intervalado',
	longao: 'Longão',
	prova: 'Prova',
}

export type TreinoManualDados = {
	data: string
	titulo: string
	tipo: TipoTreino
	observacao: string | null
	aquecimento: EtapaRelogio | null
	blocos: { repeticoes: number; etapas: EtapaRelogio[] }[]
	desaquecimento: EtapaRelogio | null
}

// ── Etapas ────────────────────────────────────────────────────────────────

export function etapaZona(
	papel: EtapaRelogio['papel'],
	meta: { distanciaM?: number; tempoSeg?: number },
	zona: number,
	pace?: { rapido: number; lento: number } | null,
): EtapaRelogio {
	const z = ZONAS_RITMO[Math.min(Math.max(zona, 1), 6) - 1]
	const faixa = pace ?? { rapido: z.rapidoSeg, lento: z.lentoSeg }
	return {
		papel,
		distanciaM: meta.distanciaM ?? null,
		tempoSeg: meta.tempoSeg ?? null,
		zona,
		paceRapidoSeg: faixa.rapido,
		paceLentoSeg: faixa.lento,
	}
}

const km = (n: number) => ({ distanciaM: n * 1000 })
const m = (n: number) => ({ distanciaM: n })
const min = (n: number) => ({ tempoSeg: n * 60 })
const seg = (n: number) => ({ tempoSeg: n })

const aquec = (minutos = 10) => etapaZona('aquecimento', min(minutos), 1)
const desaq = (minutos = 10) => etapaZona('desaquecimento', min(minutos), 1)

// ── Modelos (Jack Daniels: E, M, T, I, R) ─────────────────────────────────

export type Modelo = {
	id: string
	nome: string
	/** Letra do método Daniels */
	daniels: 'E' | 'M' | 'T' | 'I' | 'R' | '—'
	descricao: string
	criar: (data: string) => TreinoManualDados
}

function base(data: string, titulo: string, tipo: TipoTreino, obs: string | null = null): TreinoManualDados {
	return { data, titulo, tipo, observacao: obs, aquecimento: null, blocos: [], desaquecimento: null }
}

export const MODELOS: Modelo[] = [
	{
		id: 'facil',
		nome: 'Rodagem fácil',
		daniels: 'E',
		descricao: 'Ritmo de conversa, a base do volume.',
		criar: data => ({
			...base(data, 'Rodagem fácil 8 km', 'leve'),
			blocos: [{ repeticoes: 1, etapas: [etapaZona('trabalho', km(8), 2)] }],
		}),
	},
	{
		id: 'regenerativo',
		nome: 'Regenerativo',
		daniels: 'E',
		descricao: 'Trote bem leve no dia seguinte a treino forte.',
		criar: data => ({
			...base(data, 'Regenerativo 5 km', 'leve'),
			blocos: [{ repeticoes: 1, etapas: [etapaZona('trabalho', km(5), 1)] }],
		}),
	},
	{
		id: 'strides',
		nome: 'Fácil + strides',
		daniels: 'R',
		descricao: 'Rodagem fácil e 6 tiros curtos de 20 s no fim.',
		criar: data => ({
			...base(data, 'Fácil 8 km + 6 strides', 'leve'),
			blocos: [
				{ repeticoes: 1, etapas: [etapaZona('trabalho', km(8), 2)] },
				{
					repeticoes: 6,
					etapas: [etapaZona('trabalho', seg(20), 6), etapaZona('recuperacao', seg(40), 1)],
				},
			],
		}),
	},
	{
		id: 'longao',
		nome: 'Longão',
		daniels: 'E',
		descricao: 'Longo em ritmo fácil (Daniels limita a 25% do volume ou 2 h 30).',
		criar: data => ({
			...base(data, 'Longão 24 km', 'longao'),
			blocos: [{ repeticoes: 1, etapas: [etapaZona('trabalho', km(24), 2)] }],
		}),
	},
	{
		id: 'tempo',
		nome: 'Limiar contínuo (tempo run)',
		daniels: 'T',
		descricao: '20 minutos contínuos no ritmo de limiar.',
		criar: data => ({
			...base(data, 'Tempo run 20 min', 'limiar'),
			aquecimento: aquec(15),
			blocos: [{ repeticoes: 1, etapas: [etapaZona('trabalho', min(20), 4)] }],
			desaquecimento: desaq(10),
		}),
	},
	{
		id: 'cruise',
		nome: 'Cruise intervals',
		daniels: 'T',
		descricao: 'Limiar em repetições, com 1 min de pausa para cada 5 min de esforço.',
		criar: data => ({
			...base(data, 'Cruise 4 × 1.600 m', 'limiar'),
			aquecimento: aquec(15),
			blocos: [
				{
					repeticoes: 4,
					etapas: [etapaZona('trabalho', m(1600), 4), etapaZona('recuperacao', min(1), 1)],
				},
			],
			desaquecimento: desaq(10),
		}),
	},
	{
		id: 'maratona',
		nome: 'Blocos em ritmo de maratona',
		daniels: 'M',
		descricao: 'Blocos longos no ritmo M, com 1 km moderado entre eles.',
		criar: data => ({
			...base(data, 'Ritmo M 3 × 5 km', 'limiar'),
			aquecimento: aquec(15),
			blocos: [
				{
					repeticoes: 3,
					etapas: [etapaZona('trabalho', km(5), 3), etapaZona('recuperacao', km(1), 2)],
				},
			],
			desaquecimento: desaq(10),
		}),
	},
	{
		id: 'intervalado',
		nome: 'Intervalado (VO2 máx)',
		daniels: 'I',
		descricao: 'Tiros de 3 a 5 min, pausa curta de trote. Máximo 8% do volume semanal.',
		criar: data => ({
			...base(data, 'Intervalado 5 × 1.000 m', 'tiros'),
			aquecimento: aquec(15),
			blocos: [
				{
					repeticoes: 5,
					etapas: [etapaZona('trabalho', m(1000), 5), etapaZona('recuperacao', min(3), 1)],
				},
			],
			desaquecimento: desaq(10),
		}),
	},
	{
		id: 'repeticoes',
		nome: 'Repetições (velocidade)',
		daniels: 'R',
		descricao: 'Tiros curtos e rápidos com recuperação quase completa.',
		criar: data => ({
			...base(data, 'Repetições 8 × 400 m', 'tiros'),
			aquecimento: aquec(15),
			blocos: [
				{
					repeticoes: 8,
					etapas: [etapaZona('trabalho', m(400), 6), etapaZona('recuperacao', min(2), 1)],
				},
			],
			desaquecimento: desaq(10),
		}),
	},
	{
		id: 'fartlek',
		nome: 'Fartlek (3 mudanças de ritmo)',
		daniels: '—',
		descricao: 'Repete 3×: 1,5 km em Z2, 1 km em Z3 e 500 m em Z3, sem pausa.',
		criar: data => ({
			...base(data, 'Fartlek 3 × (1,5 km + 1 km + 500 m)', 'limiar'),
			blocos: [
				{
					repeticoes: 3,
					etapas: [
						etapaZona('trabalho', km(1.5), 2),
						etapaZona('trabalho', km(1), 3),
						etapaZona('trabalho', m(500), 3),
					],
				},
			],
		}),
	},
	{
		id: 'descanso',
		nome: 'Descanso',
		daniels: '—',
		descricao: 'Dia livre (mobilidade ou força, se quiser).',
		criar: data => base(data, 'Descanso', 'descanso'),
	},
]

export function modeloPorId(id: string): Modelo | undefined {
	return MODELOS.find(x => x.id === id)
}

// ── Sugestão de semana ────────────────────────────────────────────────────

export type FaseSugestao = 'base' | 'construcao' | 'especifico' | 'polimento'

export const ROTULO_FASE: Record<FaseSugestao, string> = {
	base: 'Base (geral)',
	construcao: 'Construção (fundamental)',
	especifico: 'Específico (perto da prova)',
	polimento: 'Polimento',
}

function rodagem(data: string, titulo: string, kmTotal: number, zona: number, tipo: TipoTreino = 'leve'): TreinoManualDados {
	return {
		...base(data, titulo, tipo),
		blocos: [{ repeticoes: 1, etapas: [etapaZona('trabalho', km(Math.max(kmTotal, 3)), zona)] }],
	}
}

export type ConfigSugestaoDados = {
	/** dias de corrida marcados: 0 = segunda … 6 = domingo */
	dias: number[]
	diaLongao: number
	volumeKm: number
	fase: FaseSugestao
}

export type SemanaSugerida = {
	/** treinos a gravar: só os dias marcados que estavam vazios */
	novos: TreinoManualDados[]
	/** km dos treinos que já estavam na semana */
	kmExistente: number
	/** km da semana completa (existentes + novos) */
	kmTotal: number
	kmAlvo: number
}

/** Fração do volume que vai para o longão, conforme a quantidade de dias de corrida. */
const FRACAO_LONGAO: Record<number, number> = { 1: 0.42, 2: 0.42, 3: 0.42, 4: 0.36, 5: 0.33, 6: 0.3, 7: 0.28 }
const LIMITE_FACIL_KM = 16
const MIN_FACIL_KM = 4
const MIN_LONGAO_KM = 12

/**
 * Completa a semana a partir dos dias marcados, do volume e da fase, contando o que já está cadastrado:
 * os treinos existentes não mudam, descontam o volume e ocupam o lugar do longão e da qualidade.
 * "Descanso" não conta como treino: dia marcado com descanso é preenchido.
 */
export function sugerirSemana(
	segunda: string,
	opcoes: ConfigSugestaoDados & { existentes: TreinoManualDados[] },
): SemanaSugerida {
	const data = (n: number) => {
		const d = new Date(`${segunda}T12:00:00Z`)
		d.setUTCDate(d.getUTCDate() + n)
		return d.toISOString().slice(0, 10)
	}
	const alvo = opcoes.fase === 'polimento' ? opcoes.volumeKm * 0.6 : opcoes.volumeKm

	const existentes = new Map<number, TreinoManualDados>()
	for (const t of opcoes.existentes) {
		if (t.tipo === 'descanso') continue
		for (let n = 0; n < 7; n++) if (data(n) === t.data) existentes.set(n, t)
	}
	const jaTem = [...existentes.values()]
	const kmExistente = jaTem.reduce((acc, t) => acc + estimarKm(t), 0)
	const livres = [...new Set(opcoes.dias)].filter(n => n >= 0 && n <= 6 && !existentes.has(n)).sort((a, b) => a - b)
	const totalDias = existentes.size + livres.length

	const qualidade1 = (d: string) =>
		modeloPorId(opcoes.fase === 'base' ? 'tempo' : opcoes.fase === 'especifico' ? 'intervalado' : 'cruise')!.criar(d)
	const qualidade2 = (d: string) => modeloPorId(opcoes.fase === 'base' ? 'strides' : 'maratona')!.criar(d)

	const porDia = new Map<number, TreinoManualDados>()
	const fortes = new Set([...existentes].filter(([, t]) => t.tipo !== 'leve').map(([n]) => n))

	// 1. longão: um por semana (a prova ocupa o lugar dele)
	const temLongao = jaTem.some(t => t.tipo === 'longao' || t.tipo === 'prova')
	const diaLongao = !temLongao && livres.includes(opcoes.diaLongao) ? opcoes.diaLongao : null
	if (diaLongao !== null) fortes.add(diaLongao)

	// 2. qualidade: 1 com até 3 dias, 2 a partir de 4, nunca colada em outro dia forte
	// (no polimento, uma só); a 2ª também precisa caber no volume junto com o longão e os fáceis mínimos
	const metaQualidade = totalDias <= 3 || opcoes.fase === 'polimento' ? 1 : 2
	const longaoPrevisto =
		diaLongao === null ? 0 : Math.min(Math.max(Math.round(alvo * (FRACAO_LONGAO[totalDias] ?? 0.3)), MIN_LONGAO_KM), 42)
	let kmQualidadeNova = 0
	let qualidades = jaTem.filter(t => t.tipo === 'limiar' || t.tipo === 'tiros' || t.tipo === 'prova').length
	for (const n of [1, 3, 2, 4, 0, 6, 5]) {
		if (qualidades >= metaQualidade) break
		if (!livres.includes(n) || n === diaLongao || fortes.has(n - 1) || fortes.has(n + 1)) continue
		const treino = qualidades === 0 ? qualidade1(data(n)) : qualidade2(data(n))
		const outrosFaceis = livres.length - porDia.size - 1 - (diaLongao === null ? 0 : 1)
		const kmComEla = kmExistente + kmQualidadeNova + estimarKm(treino) + longaoPrevisto + outrosFaceis * MIN_FACIL_KM
		if (qualidades > 0 && kmComEla > alvo + 5) break
		qualidades++
		kmQualidadeNova += estimarKm(treino)
		if (treino.tipo === 'leve') continue // na base a 2ª "qualidade" são só strides: entra como dia fácil
		porDia.set(n, treino)
		fortes.add(n)
	}

	// 3. o que sobra do volume vai para o longão (a fatia dele) e os dias fáceis
	const faceis = livres.filter(n => n !== diaLongao && !porDia.has(n))
	const kmQualidade = [...porDia.values()].reduce((acc, t) => acc + estimarKm(t), 0)
	const disponivel = alvo - kmExistente - kmQualidade
	let longaoKm = longaoPrevisto

	// véspera do dia do longão: mais leve; depois de um forte: um dia de strides na semana
	const ehVespera = (n: number) => {
		const t = existentes.get(n + 1)
		return n + 1 === diaLongao || t?.tipo === 'longao' || t?.tipo === 'prova'
	}
	const temStrides = jaTem.some(t => /strides/i.test(t.titulo))
	const diaStrides = temStrides
		? undefined
		: faceis.find(n => !ehVespera(n) && n - 1 !== diaLongao && existentes.get(n - 1)?.tipo !== 'longao')
	const peso = (n: number) => (ehVespera(n) ? 0.55 : 1)
	const somaPesos = faceis.reduce((acc, n) => acc + peso(n), 0)
	const restante = Math.max(disponivel - longaoKm, 0)
	const bruto = (n: number) => (somaPesos > 0 ? Math.round((restante * peso(n)) / somaPesos) : 0)
	// fácil passa de 16 km? o excesso vai para o longão novo (até 42 km)
	if (diaLongao !== null) {
		const excesso = faceis.reduce((acc, n) => acc + Math.max(bruto(n) - LIMITE_FACIL_KM, 0), 0)
		longaoKm = Math.min(longaoKm + excesso, 42)
		porDia.set(diaLongao, rodagem(data(diaLongao), `Longão ${longaoKm} km`, longaoKm, 2, 'longao'))
	}
	// com o longão já cadastrado, dia fácil não passa de 75% dele
	const longaoFixo = jaTem.find(t => t.tipo === 'longao')
	const limiteFacil = longaoFixo ? Math.min(LIMITE_FACIL_KM, Math.round(estimarKm(longaoFixo) * 0.75)) : LIMITE_FACIL_KM
	for (const n of faceis) {
		const kmDia = Math.max(Math.min(bruto(n), limiteFacil), MIN_FACIL_KM)
		if (n === diaStrides) {
			porDia.set(n, {
				...modeloPorId('strides')!.criar(data(n)),
				titulo: `Fácil ${kmDia} km + 6 strides`,
				blocos: [
					{ repeticoes: 1, etapas: [etapaZona('trabalho', km(kmDia), 2)] },
					{ repeticoes: 6, etapas: [etapaZona('trabalho', seg(20), 6), etapaZona('recuperacao', seg(40), 1)] },
				],
			})
		} else if (ehVespera(n)) {
			porDia.set(n, rodagem(data(n), `Leve ${kmDia} km`, kmDia, 1))
		} else {
			porDia.set(n, rodagem(data(n), `Fácil ${kmDia} km`, kmDia, 2))
		}
	}

	const novos = [...porDia].sort((a, b) => a[0] - b[0]).map(([, t]) => t)
	return {
		novos,
		kmExistente,
		kmTotal: kmExistente + novos.reduce((acc, t) => acc + estimarKm(t), 0),
		kmAlvo: alvo,
	}
}

/** Valida o que veio do formulário (ou do banco). */
export function sanearConfigSugestao(bruto: unknown): ConfigSugestaoDados | null {
	const c = bruto as Partial<ConfigSugestaoDados> | null
	if (!c || !Array.isArray(c.dias) || typeof c.fase !== 'string' || !(c.fase in ROTULO_FASE)) return null
	const ehDia = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6
	const dias = [...new Set(c.dias.filter(ehDia))].sort((a, b) => a - b)
	const volumeKm = Number(c.volumeKm)
	if (dias.length === 0 || !ehDia(c.diaLongao) || !Number.isFinite(volumeKm)) return null
	return { dias, diaLongao: c.diaLongao, volumeKm: Math.min(Math.max(volumeKm, 10), 200), fase: c.fase }
}

// ── Utilidades ────────────────────────────────────────────────────────────

/** Distância estimada em km (tempo vira distância pelo pace médio da faixa da etapa). */
export function estimarKm(t: Pick<TreinoManualDados, 'aquecimento' | 'blocos' | 'desaquecimento'>): number {
	let total = 0
	const soma = (e: EtapaRelogio | null, vezes: number) => {
		if (!e) return
		if (e.distanciaM) total += e.distanciaM * vezes
		else if (e.tempoSeg) {
			const pace = e.paceRapidoSeg && e.paceLentoSeg ? (e.paceRapidoSeg + e.paceLentoSeg) / 2 : 360
			total += (e.tempoSeg / pace) * 1000 * vezes
		}
	}
	soma(t.aquecimento, 1)
	for (const b of t.blocos) for (const e of b.etapas) soma(e, b.repeticoes)
	soma(t.desaquecimento, 1)
	return total / 1000
}

export function descreverMeta(e: EtapaRelogio): string {
	if (e.distanciaM) {
		return e.distanciaM >= 1000
			? `${(e.distanciaM / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
			: `${Math.round(e.distanciaM)} m`
	}
	if (e.tempoSeg) {
		const mn = Math.floor(e.tempoSeg / 60)
		const s = Math.round(e.tempoSeg % 60)
		return mn === 0 ? `${s} s` : s === 0 ? `${mn} min` : `${mn} min ${s} s`
	}
	return 'livre'
}

export function formatarPaceSeg(segKm: number): string {
	const t = Math.round(segKm)
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

export function textoPace(e: EtapaRelogio): string | null {
	return e.paceRapidoSeg && e.paceLentoSeg
		? `${formatarPaceSeg(e.paceRapidoSeg)}–${formatarPaceSeg(e.paceLentoSeg)} /km`
		: null
}

export type DadosEstrutura = Pick<TreinoManualDados, 'aquecimento' | 'blocos' | 'desaquecimento'>

/** Etapas na ordem em que acontecem (blocos repetidos). */
export function expandirEtapas(t: DadosEstrutura): EtapaRelogio[] {
	const r: EtapaRelogio[] = []
	if (t.aquecimento) r.push(t.aquecimento)
	for (const b of t.blocos) for (let i = 0; i < b.repeticoes; i++) r.push(...b.etapas)
	if (t.desaquecimento) r.push(t.desaquecimento)
	return r
}

function paceMedio(e: EtapaRelogio): number {
	return e.paceRapidoSeg && e.paceLentoSeg ? (e.paceRapidoSeg + e.paceLentoSeg) / 2 : 360
}

export function metrosDaEtapa(e: EtapaRelogio): number {
	if (e.distanciaM) return e.distanciaM
	if (e.tempoSeg) return (e.tempoSeg / paceMedio(e)) * 1000
	return 0
}

export function segundosDaEtapa(e: EtapaRelogio): number {
	if (e.tempoSeg) return e.tempoSeg
	if (e.distanciaM) return (e.distanciaM / 1000) * paceMedio(e)
	return 0
}

export function estimarSegundos(t: DadosEstrutura): number {
	return expandirEtapas(t).reduce((acc, e) => acc + segundosDaEtapa(e), 0)
}

export function formatarDuracao(seg: number): string {
	const t = Math.round(seg)
	const h = Math.floor(t / 3600)
	const m = Math.floor((t % 3600) / 60)
	const s = t % 60
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** Faixa de velocidade (km/h) a partir da faixa de pace da etapa. */
export function textoKmh(e: EtapaRelogio): string | null {
	if (!e.paceRapidoSeg || !e.paceLentoSeg) return null
	const f = (s: number) => (3600 / s).toFixed(2)
	return `${f(e.paceLentoSeg)}–${f(e.paceRapidoSeg)} km/h`
}

export function rotuloEtapa(e: EtapaRelogio): string {
	const nome =
		e.papel === 'aquecimento' ? 'Aquecimento' : e.papel === 'desaquecimento' ? 'Desaquecimento' : e.papel === 'recuperacao' ? 'Recuperação' : 'Corrida'
	return `${nome} ${descreverMeta(e)}${e.zona ? ` (Z${e.zona})` : ''}`
}

/** Texto do "treino prescrito", como no mockup: numerado, com pace e km/h por etapa. */
export function textoPrescrito(t: DadosEstrutura): string {
	const linhas: string[] = []
	let n = 1
	const linhaEtapa = (e: EtapaRelogio, recuo: string) => {
		linhas.push(`${recuo}— ${rotuloEtapa(e)}`)
		const pace = textoPace(e)
		if (pace) linhas.push(`${recuo}  ${pace} · ${textoKmh(e) ?? ''}`.trimEnd())
	}
	if (t.aquecimento) {
		linhas.push(`${n++}. Aquecimento`)
		linhaEtapa(t.aquecimento, '   ')
	}
	for (const b of t.blocos) {
		if (b.repeticoes > 1) {
			linhas.push(`${n++}. Repetir ${b.repeticoes}x`)
			for (const e of b.etapas) linhaEtapa(e, '   ')
		} else {
			for (const e of b.etapas) {
				linhas.push(`${n++}. ${rotuloEtapa(e)}`)
				const pace = textoPace(e)
				if (pace) linhas.push(`   ${pace} · ${textoKmh(e) ?? ''}`.trimEnd())
			}
		}
	}
	if (t.desaquecimento) {
		linhas.push(`${n++}. Desaquecimento`)
		linhaEtapa(t.desaquecimento, '   ')
	}
	return linhas.join('\n')
}

/**
 * Quando o treino foi planejado no site e enviado ao relógio, as etapas gravadas seguem a mesma
 * ordem do plano. Se a quantidade bate, nomeia cada etapa pelo papel planejado (aquecimento,
 * esforço, recuperação, desaquecimento); senão devolve como está.
 */
export function aplicarPlanoNasVoltas<T extends { rotulo?: string | null; distanciaM: number }>(
	voltas: T[],
	plano: DadosEstrutura | null,
): T[] {
	if (!plano) return voltas
	const esperadas = expandirEtapas(plano)
	if (esperadas.length === 0 || esperadas.length !== voltas.length) return voltas
	return voltas.map((v, i) => {
		const papel = esperadas[i].papel
		const rotulo =
			papel === 'aquecimento'
				? 'Aquecimento'
				: papel === 'desaquecimento'
					? 'Desaquecimento'
					: papel === 'trabalho'
						? 'Esforço'
						: v.distanciaM < 150
							? 'Descanso'
							: 'Recuperação'
		return { ...v, rotulo }
	})
}

// ── Comparação planejado × executado ─────────────────────────────────────

export type StatusPace = 'dentro' | 'rapido' | 'lento' | 'sem'

export type LinhaComparacao = {
	chave: string
	rotulo: string
	papel: EtapaRelogio['papel'] | 'km'
	/** meta planejada, em texto (ex.: "400 m", "15 min") */
	meta: string
	distanciaM: number
	tempoSeg: number
	planRapidoSeg: number | null
	planLentoSeg: number | null
	zona: number | null
	/** pace executado em seg/km; null em trechos curtos/parados (descansos) */
	execSeg: number | null
	status: StatusPace
	/** diferença para a borda mais próxima da faixa (seg/km): 0 dentro; negativo = mais rápido que o plano */
	diffSeg: number | null
}

export type ResumoComparacao = {
	avaliadas: number
	dentro: number
	rapidas: number
	lentas: number
	/** pace médio do que foi avaliado menos o centro da faixa planejada (seg/km; negativo = mais rápido) */
	desvioMedioSeg: number | null
}

const DISTANCIA_MINIMA_PACE_M = 150

function classificar(exec: number | null, rapido: number | null, lento: number | null): { status: StatusPace; diff: number | null } {
	if (exec === null || rapido === null || lento === null) return { status: 'sem', diff: null }
	if (exec < rapido) return { status: 'rapido', diff: Math.round(exec - rapido) }
	if (exec > lento) return { status: 'lento', diff: Math.round(exec - lento) }
	return { status: 'dentro', diff: 0 }
}

function paceDe(distanciaM: number, tempoSeg: number): number | null {
	return distanciaM >= DISTANCIA_MINIMA_PACE_M && tempoSeg > 0 ? tempoSeg / (distanciaM / 1000) : null
}

const ROTULO_PAPEL: Record<EtapaRelogio['papel'], string> = {
	aquecimento: 'Aquecimento',
	trabalho: 'Esforço',
	recuperacao: 'Recuperação',
	desaquecimento: 'Desaquecimento',
}

/** Compara etapa a etapa; só quando o relógio gravou o mesmo número de etapas do plano. */
export function compararPlanoExecutado(
	plano: DadosEstrutura,
	voltas: { distanciaM: number; tempoSeg: number }[],
): LinhaComparacao[] | null {
	const planejadas = expandirEtapas(plano)
	if (planejadas.length === 0 || planejadas.length !== voltas.length) return null

	let contaEsforco = 0
	return planejadas.map((e, i) => {
		const v = voltas[i]
		// descansos e trechos curtos não têm pace com sentido
		const exec = e.papel === 'recuperacao' && v.distanciaM < DISTANCIA_MINIMA_PACE_M ? null : paceDe(v.distanciaM, v.tempoSeg)
		const { status, diff } = classificar(exec, e.paceRapidoSeg, e.paceLentoSeg)
		if (e.papel === 'trabalho') contaEsforco++
		return {
			chave: `etapa-${i}`,
			rotulo: e.papel === 'trabalho' ? `Esforço ${contaEsforco}` : ROTULO_PAPEL[e.papel],
			papel: e.papel,
			meta: descreverMeta(e),
			distanciaM: v.distanciaM,
			tempoSeg: v.tempoSeg,
			planRapidoSeg: e.paceRapidoSeg,
			planLentoSeg: e.paceLentoSeg,
			zona: e.zona,
			execSeg: exec,
			status,
			diffSeg: diff,
		}
	})
}

/**
 * Sem etapas gravadas (corrida contínua), compara cada km com a faixa do esforço planejado,
 * desde que o plano tenha uma só faixa de esforço.
 */
export function compararKmComPlano(
	plano: DadosEstrutura,
	splits: { km: number; distanciaM: number; tempoSeg: number }[],
): LinhaComparacao[] | null {
	const esforcos = plano.blocos.flatMap(b => b.etapas).filter(e => e.papel === 'trabalho' && e.paceRapidoSeg && e.paceLentoSeg)
	if (esforcos.length === 0 || splits.length === 0) return null
	const rapido = Math.min(...esforcos.map(e => e.paceRapidoSeg!))
	const lento = Math.max(...esforcos.map(e => e.paceLentoSeg!))
	// faixas muito diferentes entre si (ex.: tiros e trote) não servem de referência única
	if (lento - rapido > 90) return null
	const zona = esforcos[0].zona

	return splits.map((s, i) => {
		const exec = paceDe(s.distanciaM, s.tempoSeg)
		const { status, diff } = classificar(exec, rapido, lento)
		return {
			chave: `km-${s.km}`,
			rotulo: `Km ${s.km}`,
			papel: 'km' as const,
			meta: s.distanciaM >= 950 ? '1 km' : `${Math.round(s.distanciaM)} m`,
			distanciaM: s.distanciaM,
			tempoSeg: s.tempoSeg,
			planRapidoSeg: rapido,
			planLentoSeg: lento,
			zona,
			execSeg: exec,
			status: i === splits.length - 1 && s.distanciaM < 950 ? 'sem' : status,
			diffSeg: i === splits.length - 1 && s.distanciaM < 950 ? null : diff,
		}
	})
}

export function resumirComparacao(linhas: LinhaComparacao[]): ResumoComparacao {
	const avaliadas = linhas.filter(l => l.status !== 'sem' && (l.papel === 'trabalho' || l.papel === 'km'))
	const dentro = avaliadas.filter(l => l.status === 'dentro').length
	const desvios = avaliadas
		.filter(l => l.execSeg !== null && l.planRapidoSeg !== null && l.planLentoSeg !== null)
		.map(l => l.execSeg! - (l.planRapidoSeg! + l.planLentoSeg!) / 2)
	return {
		avaliadas: avaliadas.length,
		dentro,
		rapidas: avaliadas.filter(l => l.status === 'rapido').length,
		lentas: avaliadas.filter(l => l.status === 'lento').length,
		desvioMedioSeg: desvios.length ? desvios.reduce((a, b) => a + b, 0) / desvios.length : null,
	}
}

const TIPOS_VALIDOS = new Set(Object.keys(ROTULO_TIPO))

function numeroOuNull(v: unknown): number | null {
	const n = typeof v === 'number' ? v : Number(v)
	return Number.isFinite(n) && n > 0 ? n : null
}

function sanearEtapa(v: unknown): EtapaRelogio | null {
	if (!v || typeof v !== 'object') return null
	const r = v as Record<string, unknown>
	const papeis = ['aquecimento', 'trabalho', 'recuperacao', 'desaquecimento']
	if (!papeis.includes(String(r.papel))) return null
	const zona = numeroOuNull(r.zona)
	return {
		papel: r.papel as EtapaRelogio['papel'],
		distanciaM: numeroOuNull(r.distanciaM),
		tempoSeg: numeroOuNull(r.tempoSeg),
		zona: zona && zona >= 1 && zona <= 6 ? Math.round(zona) : null,
		paceRapidoSeg: numeroOuNull(r.paceRapidoSeg),
		paceLentoSeg: numeroOuNull(r.paceLentoSeg),
	}
}

/** Valida o JSON vindo do formulário; devolve null se não for um treino válido. */
export function sanearTreino(bruto: unknown): TreinoManualDados | null {
	if (!bruto || typeof bruto !== 'object') return null
	const r = bruto as Record<string, unknown>
	if (typeof r.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.data)) return null
	if (!TIPOS_VALIDOS.has(String(r.tipo))) return null
	const titulo = String(r.titulo ?? '').trim().slice(0, 80)
	if (!titulo) return null

	const blocos = (Array.isArray(r.blocos) ? r.blocos : [])
		.slice(0, 10)
		.map(b => {
			const bb = (b ?? {}) as Record<string, unknown>
			const etapas = (Array.isArray(bb.etapas) ? bb.etapas : [])
				.map(sanearEtapa)
				.filter((e): e is EtapaRelogio => e !== null)
				.slice(0, 12)
			const reps = Math.min(Math.max(Math.round(Number(bb.repeticoes) || 1), 1), 50)
			return { repeticoes: reps, etapas }
		})
		.filter(b => b.etapas.length > 0)

	const tipo = r.tipo as TipoTreino
	if (tipo !== 'descanso' && blocos.length === 0) return null

	return {
		data: r.data,
		titulo,
		tipo,
		observacao: typeof r.observacao === 'string' && r.observacao.trim() ? r.observacao.trim().slice(0, 500) : null,
		aquecimento: sanearEtapa(r.aquecimento),
		blocos: tipo === 'descanso' ? [] : blocos,
		desaquecimento: sanearEtapa(r.desaquecimento),
	}
}
