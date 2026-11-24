// Treinos montados à mão: tipos, modelos prontos (Jack Daniels) e sugestão de semana.
// Mesmo formato que o app do Apple Watch recebe (EtapaRelogio / SessaoRelogio).

import type { EtapaRelogio, SessaoRelogio } from '~/lib/treino-para-relogio'
import { ZONAS_RITMO } from '~/lib/zonas-pace'

export type TipoTreino = SessaoRelogio['tipo'] | 'descanso'

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

export type DiasPorSemana = 3 | 4 | 5 | 6

type Slot = {
	/** 0 = segunda … 6 = domingo */
	dia: number
	tipo: 'q1' | 'q2' | 'strides' | 'leve' | 'longao' | 'facil'
	peso: number
}

/**
 * Quais dias e que tipo de treino entram em cada quantidade de dias. Sempre preserva o longão e
 * a qualidade 1 (Canova: com poucos dias o volume fácil sai, nunca o trabalho específico) e
 * separa os dias fortes por pelo menos um dia leve ou de descanso.
 */
const SEMANAS: Record<DiasPorSemana, Slot[]> = {
	3: [
		{ dia: 1, tipo: 'q1', peso: 0.3 },
		{ dia: 3, tipo: 'strides', peso: 0.28 },
		{ dia: 5, tipo: 'longao', peso: 0.42 },
	],
	4: [
		{ dia: 1, tipo: 'q1', peso: 0.22 },
		{ dia: 3, tipo: 'q2', peso: 0.24 },
		{ dia: 5, tipo: 'longao', peso: 0.36 },
		{ dia: 6, tipo: 'facil', peso: 0.18 },
	],
	5: [
		{ dia: 1, tipo: 'q1', peso: 0.16 },
		{ dia: 2, tipo: 'strides', peso: 0.15 },
		{ dia: 3, tipo: 'q2', peso: 0.18 },
		{ dia: 5, tipo: 'longao', peso: 0.33 },
		{ dia: 6, tipo: 'facil', peso: 0.18 },
	],
	6: [
		{ dia: 1, tipo: 'q1', peso: 0.14 },
		{ dia: 2, tipo: 'strides', peso: 0.13 },
		{ dia: 3, tipo: 'q2', peso: 0.16 },
		{ dia: 4, tipo: 'leve', peso: 0.09 },
		{ dia: 5, tipo: 'longao', peso: 0.3 },
		{ dia: 6, tipo: 'facil', peso: 0.18 },
	],
}

/**
 * Semana-modelo (3 a 6 dias) a partir do volume e da fase. Os dias fora da escala viram descanso.
 * Qualidade 1 e 2 mudam com a fase; o volume restante vai para os treinos fáceis e o longão.
 */
export function sugerirSemana(
	segunda: string,
	opcoes: { dias: DiasPorSemana; volumeKm: number; fase: FaseSugestao },
): TreinoManualDados[] {
	const dia = (n: number) => {
		const d = new Date(`${segunda}T12:00:00Z`)
		d.setUTCDate(d.getUTCDate() + n)
		return d.toISOString().slice(0, 10)
	}
	const v = opcoes.fase === 'polimento' ? opcoes.volumeKm * 0.6 : opcoes.volumeKm
	const arredonda = (x: number) => Math.round(x)

	const qualidade1 = (data: string): TreinoManualDados =>
		opcoes.fase === 'base'
			? modeloPorId('tempo')!.criar(data)
			: opcoes.fase === 'especifico'
				? modeloPorId('intervalado')!.criar(data)
				: modeloPorId('cruise')!.criar(data)
	const qualidade2 = (data: string): TreinoManualDados =>
		opcoes.fase === 'base' ? modeloPorId('strides')!.criar(data) : modeloPorId('maratona')!.criar(data)

	// Qualidade tem tamanho fixo e o longão fica com a sua fatia do volume (nunca menor que 12 km);
	// o que sobra é dividido entre os treinos fáceis, na proporção dos pesos.
	const slots = SEMANAS[opcoes.dias]
	const ehQualidade = (sl: Slot) => sl.tipo === 'q1' || sl.tipo === 'q2'
	const fixos = slots
		.filter(ehQualidade)
		.reduce((acc, sl) => acc + estimarKm(sl.tipo === 'q1' ? qualidade1(dia(sl.dia)) : qualidade2(dia(sl.dia))), 0)
	const slotLongao = slots.find(sl => sl.tipo === 'longao')
	const longaoBase = slotLongao ? Math.min(Math.max(arredonda(v * slotLongao.peso), 12), 42) : 0
	const faceis = slots.filter(sl => !ehQualidade(sl) && sl.tipo !== 'longao')
	const somaPesos = faceis.reduce((acc, sl) => acc + sl.peso, 0) || 1
	const restante = Math.max(v - fixos - longaoBase, 3 * faceis.length)
	// treino fácil passa de 16 km? o excesso vai para o longão (até 42 km)
	const LIMITE_FACIL = 16
	const compartilhado = (sl: Slot) => Math.max(arredonda((restante * sl.peso) / somaPesos), 3)
	const excesso = faceis.reduce((acc, sl) => acc + Math.max(compartilhado(sl) - LIMITE_FACIL, 0), 0)
	const longaoKm = slotLongao ? Math.min(longaoBase + arredonda(excesso), 42) : 0

	const porDia = new Map<number, TreinoManualDados>()
	for (const slot of slots) {
		const data = dia(slot.dia)
		const kmSlot = Math.min(compartilhado(slot), LIMITE_FACIL)
		switch (slot.tipo) {
			case 'q1':
				porDia.set(slot.dia, qualidade1(data))
				break
			case 'q2':
				porDia.set(slot.dia, qualidade2(data))
				break
			case 'strides':
				porDia.set(slot.dia, {
					...modeloPorId('strides')!.criar(data),
					titulo: `Fácil ${Math.max(kmSlot, 4)} km + 6 strides`,
					blocos: [
						{ repeticoes: 1, etapas: [etapaZona('trabalho', km(Math.max(kmSlot, 4)), 2)] },
						{ repeticoes: 6, etapas: [etapaZona('trabalho', seg(20), 6), etapaZona('recuperacao', seg(40), 1)] },
					],
				})
				break
			case 'leve':
				porDia.set(slot.dia, rodagem(data, `Leve ${kmSlot} km`, kmSlot, 1))
				break
			case 'longao':
				porDia.set(slot.dia, rodagem(data, `Longão ${longaoKm} km`, longaoKm, 2, 'longao'))
				break
			case 'facil':
				porDia.set(slot.dia, rodagem(data, `Fácil ${kmSlot} km`, kmSlot, 2))
				break
		}
	}

	return Array.from({ length: 7 }, (_, i) => porDia.get(i) ?? modeloPorId('descanso')!.criar(dia(i)))
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
