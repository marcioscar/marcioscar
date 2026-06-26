import type { Phase } from '~/data/halfMarathonPlan'

export function parsePace(pace: string): number {
  const clean = pace.replace(/['"]/g, '').trim()
  const parts = clean.includes(':') ? clean.split(':') : clean.split("'")
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] ?? '0', 10)
}

export function formatPace(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${m}'${String(s).padStart(2, '0')}"/km`
}

export function resolvePace(targetPace: string, paceOffset: string): string {
  const base = parsePace(targetPace)

  const literals = ['esforço', 'aceleração', '—', 'pace alvo!']
  if (literals.includes(paceOffset)) return paceOffset

  if (paceOffset === 'pace alvo' || paceOffset === 'pace alvo final') {
    return formatPace(base)
  }

  if (paceOffset.includes('→')) {
    const [left, right] = paceOffset.split('→').map(s => s.trim())
    return `${resolvePace(targetPace, left)} → ${resolvePace(targetPace, right)}`
  }

  if (paceOffset.includes(' a ')) {
    const [left, right] = paceOffset.split(' a ').map(s => s.trim())
    return `${resolvePace(targetPace, left)} a ${resolvePace(targetPace, right)}`
  }

  if (paceOffset.includes(' / ')) {
    const [left, right] = paceOffset.split(' / ').map(s => s.trim())
    return `${resolvePace(targetPace, left)} / ${resolvePace(targetPace, right)}`
  }

  const match = paceOffset.match(/^([+-])(\d+)s$/)
  if (match) {
    const delta = (match[1] === '-' ? -1 : 1) * parseInt(match[2], 10)
    return formatPace(base + delta)
  }

  return paceOffset
}

export function resolveWeeklyKm(volumeFraction: number, baseWeeklyKm: number): number {
  return Math.round(volumeFraction * baseWeeklyKm)
}

export type PhaseStyle = {
  label: string
  bg: string
  text: string
  border: string
}

const PHASE_STYLES: Record<Phase, PhaseStyle> = {
  Geral:        { label: 'Geral',        bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  Fundamental:  { label: 'Fundamental',  bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-500/20'   },
  Específica:   { label: 'Específica',   bg: 'bg-orange-500/10',  text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20'  },
  Taper:        { label: 'Taper',        bg: 'bg-blue-500/10',    text: 'text-blue-600 dark:text-blue-400',     border: 'border-blue-500/20'    },
}

export function phaseStyle(phase: Phase): PhaseStyle {
  return PHASE_STYLES[phase] ?? PHASE_STYLES['Geral']
}
