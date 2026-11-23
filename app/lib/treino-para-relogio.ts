// Converte as sessões do planejador (texto livre) no formato estruturado que o app do
// Apple Watch (ios/) entende: aquecimento, blocos de repetição e desaquecimento, cada etapa
// com meta (distância ou tempo) e faixa de pace. Sessões que não conseguimos estruturar
// viram uma etapa contínua só, com a distância/tempo prescritos.

import type { PlannedSession } from '~/lib/canovaPlanner'
import { parsePace, resolvePace } from '~/lib/trainingPaceUtils'
import { zonaDoPace } from '~/lib/zonas-pace'

export type EtapaRelogio = {
	papel: 'aquecimento' | 'trabalho' | 'recuperacao' | 'desaquecimento'
	distanciaM: number | null
	tempoSeg: number | null
	/** 1–6, zona do pace médio da etapa (Canova + Daniels) */
	zona: number | null
	/** faixa de pace em seg/km: `paceRapidoSeg` ≤ `paceLentoSeg` */
	paceRapidoSeg: number | null
	paceLentoSeg: number | null
}

export type SessaoRelogio = {
	id: string
	data: string
	titulo: string
	tipo: 'leve' | 'limiar' | 'tiros' | 'longao' | 'prova'
	origem: 'canova' | 'treinador' | 'manual'
	observacao?: string | null
	aquecimento: EtapaRelogio | null
	blocos: { repeticoes: number; etapas: EtapaRelogio[] }[]
	desaquecimento: EtapaRelogio | null
}

/** Folga em torno de um pace único, para o alerta do relógio não ficar apitando à toa. */
const FOLGA_SEG = 12

function numero(txt: string): number {
	// "2.000" → 2000, "21,1" → 21.1
	return parseFloat(txt.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
}

/** Pace(s) em segundos encontrados num texto já resolvido ("5'20\"/km", "5'10\" a 5'30\"/km"). */
function pacesDoTexto(texto: string): number[] {
	return [...texto.matchAll(/(\d+)'(\d{2})"/g)].map(m => parseInt(m[1], 10) * 60 + parseInt(m[2], 10))
}

export function faixaDePace(
	paceAlvo: string,
	paceOffset: string,
): { rapido: number; lento: number } | null {
	let paces: number[] = []
	try {
		paces = pacesDoTexto(resolvePace(paceAlvo, paceOffset))
	} catch {
		return null
	}
	if (paces.length === 0) return null
	if (paces.length === 1) return { rapido: paces[0] - FOLGA_SEG, lento: paces[0] + FOLGA_SEG }
	return { rapido: Math.min(...paces), lento: Math.max(...paces) }
}

function etapa(
	papel: EtapaRelogio['papel'],
	meta: { distanciaM?: number; tempoSeg?: number },
	faixa: { rapido: number; lento: number } | null,
): EtapaRelogio {
	return {
		papel,
		distanciaM: meta.distanciaM ?? null,
		tempoSeg: meta.tempoSeg ?? null,
		zona: faixa ? parseInt(zonaDoPace((faixa.rapido + faixa.lento) / 2).id.slice(1), 10) : null,
		paceRapidoSeg: faixa?.rapido ?? null,
		paceLentoSeg: faixa?.lento ?? null,
	}
}

function medida(valor: string, unidade: string): { distanciaM?: number; tempoSeg?: number } {
	const v = numero(valor)
	if (unidade === 'km') return { distanciaM: v * 1000 }
	if (unidade === 'm') return { distanciaM: v }
	if (unidade === 'min') return { tempoSeg: v * 60 }
	return { tempoSeg: v }
}

const REC = /rec(?:\.|up\w*)?\s*(?:de\s*)?([\d.,]+)\s*(min|s|m|km)\b/i
const INTERVALO = /(\d+)\s*[×x]\s*([\d.,]+)\s*(km|m|min|s)\b/i
const CONTINUO = /([\d.,]+)(?:\s*[–-]\s*([\d.,]+))?\s*(km|min)\b/i

function tipoDe(s: PlannedSession, intervalado: boolean): SessaoRelogio['tipo'] {
	if (s.role === 'prova') return 'prova'
	if (s.role === 'longao') return 'longao'
	if (intervalado) {
		const t = s.type.toLowerCase()
		return /tempo|limiar|threshold/.test(t) ? 'limiar' : 'tiros'
	}
	return /tempo|limiar/i.test(s.type) ? 'limiar' : 'leve'
}

/** Aquecimento e desaquecimento padrão (10 min leves) para sessões de intervalo. */
const FAIXA_LEVE = { rapido: 390, lento: 435 } // Z1: 6:30–7:15

export function converterSessao(
	s: PlannedSession,
	paceAlvo: string,
	data: string,
): SessaoRelogio {
	const texto = s.detail
	const faixa = faixaDePace(paceAlvo, s.paceOffset)

	const inter = texto.match(INTERVALO)
	const rec = texto.match(REC)
	const ehIntervalado = !!(inter && rec)

	let aquecimento: EtapaRelogio | null = null
	let desaquecimento: EtapaRelogio | null = null
	let blocos: SessaoRelogio['blocos'] = []

	if (ehIntervalado && inter && rec) {
		aquecimento = etapa('aquecimento', { tempoSeg: 600 }, FAIXA_LEVE)
		desaquecimento = etapa('desaquecimento', { tempoSeg: 600 }, FAIXA_LEVE)
		blocos = [
			{
				repeticoes: Math.min(Math.max(parseInt(inter[1], 10), 1), 50),
				etapas: [
					etapa('trabalho', medida(inter[2], inter[3].toLowerCase()), faixa),
					etapa('recuperacao', medida(rec[1], rec[2].toLowerCase()), FAIXA_LEVE),
				],
			},
		]
	} else {
		const c = texto.match(CONTINUO)
		let meta: { distanciaM?: number; tempoSeg?: number }
		if (c) {
			const a = numero(c[1])
			const b = c[2] ? numero(c[2]) : a
			meta = medida(String((a + b) / 2), c[3].toLowerCase())
		} else if (s.km > 0) {
			meta = { distanciaM: s.km * 1000 }
		} else {
			meta = {}
		}
		blocos = [{ repeticoes: 1, etapas: [etapa('trabalho', meta, faixa)] }]
	}

	return {
		id: `plano-${data}`,
		data,
		titulo: `${s.type}${s.detail ? ` · ${s.detail}` : ''}`.slice(0, 80),
		tipo: tipoDe(s, ehIntervalado),
		origem: s.origem,
		aquecimento,
		blocos,
		desaquecimento,
	}
}

export { parsePace }
