import { encodePolyline } from '~/lib/polyline'
import { MAX_PONTOS_ROTA, type RotaDetalhada } from '~/types/rota'
import type { StreamsAtividade } from '~/services/strava/client.server'

/** Escolhe `max` índices igualmente espaçados (sempre inclui o primeiro e o último). */
function indicesAmostrados(total: number, max: number): number[] {
	if (total <= max) return Array.from({ length: total }, (_, i) => i)
	return Array.from({ length: max }, (_, i) => Math.round((i * (total - 1)) / (max - 1)))
}

/** Reduz os streams do Strava a no máximo MAX_PONTOS_ROTA pontos alinhados entre si. */
export function rotaDosStreams(s: StreamsAtividade): RotaDetalhada | null {
	if (s.latlng.length < 2) return null
	const idx = indicesAmostrados(s.latlng.length, MAX_PONTOS_ROTA)
	const pega = <T,>(serie: T[] | null) => (serie && serie.length === s.latlng.length ? idx.map(i => serie[i]) : undefined)

	const alt = pega(s.altitude)?.map(v => Math.round(v * 10) / 10)
	const vel = pega(s.velocity)?.map(v => Math.round(v * 100) / 100)
	const fc = pega(s.heartrate)?.map(v => Math.round(v))
	return {
		polyline: encodePolyline(idx.map(i => s.latlng[i])),
		...(alt ? { alt } : {}),
		...(vel ? { vel } : {}),
		...(fc ? { fc } : {}),
	}
}
