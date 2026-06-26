import { useState, useMemo } from 'react'
import { halfMarathonPlan } from '~/data/halfMarathonPlan'
import { marathonPlan } from '~/data/marathonPlan'
import type { TrainingPlan, Week, Phase, Session } from '~/data/halfMarathonPlan'
import { resolvePace, resolveWeeklyKm, phaseStyle } from '~/lib/trainingPaceUtils'
import { cn } from '~/lib/utils'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import {
  Target01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Tick01Icon,
  Alert01Icon,
  Timer01Icon,
  RunningShoesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export function meta() {
  return [
    { title: 'Treinamento | Marcioscar' },
    { name: 'description', content: 'Planos de treino Canova para meia e maratona' },
  ]
}

const PLANS: Record<string, TrainingPlan> = {
  meia: halfMarathonPlan,
  maratona: marathonPlan,
}

const ALL_PHASES: Array<Phase | 'all'> = ['all', 'Geral', 'Fundamental', 'Específica', 'Taper']

export default function TreinamentoRoute() {
  const [planKey, setPlanKey] = useState<'meia' | 'maratona'>('meia')
  const [targetPace, setTargetPace] = useState('')
  const [weeklyKm, setWeeklyKm] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<Phase | 'all'>('all')
  const [completedWeeks, setCompletedWeeks] = useState<Set<number>>(new Set())
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())

  const plan = PLANS[planKey]
  const effectivePace = targetPace.trim() || plan.defaultTargetPace
  const effectiveKm = parseInt(weeklyKm) > 0 ? parseInt(weeklyKm) : plan.defaultWeeklyKm

  const visibleWeeks = useMemo(
    () => phaseFilter === 'all' ? plan.weeks : plan.weeks.filter(w => w.phase === phaseFilter),
    [plan, phaseFilter],
  )

  const completedCount = [...completedWeeks].filter(n => plan.weeks.some(w => w.number === n)).length
  const progressPct = Math.round((completedCount / plan.totalWeeks) * 100)

  function toggleExpand(n: number) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  function toggleComplete(n: number) {
    setCompletedWeeks(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  function handlePlanChange(key: 'meia' | 'maratona') {
    setPlanKey(key)
    setPhaseFilter('all')
    setExpandedWeeks(new Set())
    setTargetPace('')
    setWeeklyKm('')
  }

  return (
    <div className='flex flex-col gap-6 p-4 md:p-6'>

      {/* Header */}
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>Plano de Treinamento</h1>
        <p className='text-sm text-muted-foreground mt-1'>Metodologia Canova — {plan.totalWeeks} semanas</p>
      </div>

      {/* Plan selector */}
      <div className='flex gap-2'>
        {(['meia', 'maratona'] as const).map(key => (
          <button
            key={key}
            onClick={() => handlePlanChange(key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium border transition-colors',
              planKey === key
                ? 'bg-foreground text-background border-foreground'
                : 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/40',
            )}
          >
            {key === 'meia' ? 'Meia Maratona' : 'Maratona'}
          </button>
        ))}
      </div>

      {/* Settings */}
      <Card size='sm'>
        <CardContent className='flex flex-col sm:flex-row gap-4 pt-4'>
          <div className='flex-1'>
            <label className='text-xs font-medium text-muted-foreground block mb-1.5'>
              Pace alvo (ex: {plan.defaultTargetPace})
            </label>
            <div className='relative'>
              <HugeiconsIcon icon={Timer01Icon} className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
              <Input
                value={targetPace}
                onChange={e => setTargetPace(e.target.value)}
                placeholder={plan.defaultTargetPace}
                className='pl-9'
              />
            </div>
          </div>
          <div className='flex-1'>
            <label className='text-xs font-medium text-muted-foreground block mb-1.5'>
              Volume semanal base (km)
            </label>
            <div className='relative'>
              <HugeiconsIcon icon={RunningShoesIcon} className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
              <Input
                type='number'
                value={weeklyKm}
                onChange={e => setWeeklyKm(e.target.value)}
                placeholder={String(plan.defaultWeeklyKm)}
                min={20}
                max={150}
                className='pl-9'
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <div className='flex flex-col gap-2'>
        <div className='flex justify-between items-center text-sm'>
          <span className='text-muted-foreground'>
            {completedCount} de {plan.totalWeeks} semanas concluídas
          </span>
          <span className='font-medium tabular-nums'>{progressPct}%</span>
        </div>
        <div className='h-2 w-full rounded-full bg-muted overflow-hidden'>
          <div
            className='h-full rounded-full bg-foreground transition-all duration-500'
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Phase filter */}
      <div className='flex gap-1.5 flex-wrap'>
        {ALL_PHASES.map(ph => {
          const style = ph !== 'all' ? phaseStyle(ph) : null
          const isActive = phaseFilter === ph
          return (
            <button
              key={ph}
              onClick={() => setPhaseFilter(ph)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                isActive && ph === 'all' && 'bg-foreground text-background border-foreground',
                isActive && ph !== 'all' && style && `${style.bg} ${style.text} ${style.border}`,
                !isActive && 'bg-transparent text-muted-foreground border-border hover:text-foreground',
              )}
            >
              {ph === 'all' ? 'Todas as fases' : ph}
            </button>
          )
        })}
      </div>

      {/* Week list */}
      <div className='flex flex-col gap-2'>
        {visibleWeeks.map(week => (
          <WeekCard
            key={week.number}
            week={week}
            targetPace={effectivePace}
            weeklyKm={effectiveKm}
            isCompleted={completedWeeks.has(week.number)}
            isExpanded={expandedWeeks.has(week.number)}
            onToggleExpand={() => toggleExpand(week.number)}
            onToggleComplete={() => toggleComplete(week.number)}
          />
        ))}
      </div>
    </div>
  )
}

interface WeekCardProps {
  week: Week
  targetPace: string
  weeklyKm: number
  isCompleted: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleComplete: () => void
}

function WeekCard({ week, targetPace, weeklyKm, isCompleted, isExpanded, onToggleExpand, onToggleComplete }: WeekCardProps) {
  const km = resolveWeeklyKm(week.volumeFraction, weeklyKm)
  const style = phaseStyle(week.phase)

  return (
    <div
      className={cn(
        'rounded-2xl border transition-colors',
        isCompleted ? 'border-foreground/20 bg-muted/30' : 'border-border bg-card',
        week.isWarning && !isCompleted && 'border-orange-500/40',
      )}
    >
      {/* Header row */}
      <div className='flex items-center gap-3 px-4 py-3'>
        {/* Checkmark */}
        <button
          onClick={onToggleComplete}
          aria-label={`Marcar semana ${week.number} como concluída`}
          className={cn(
            'flex-shrink-0 size-5 rounded-full border-2 flex items-center justify-center transition-colors',
            isCompleted
              ? 'bg-foreground border-foreground text-background'
              : 'border-border hover:border-foreground/50',
          )}
        >
          {isCompleted && <HugeiconsIcon icon={Tick01Icon} className='size-3' strokeWidth={3} />}
        </button>

        {/* Expand button */}
        <button
          onClick={onToggleExpand}
          className='flex flex-1 items-center gap-3 min-w-0 text-left'
        >
          <div className='flex flex-col min-w-0'>
            <div className='flex items-center gap-2 flex-wrap'>
              <span className={cn('text-xs font-medium', isCompleted && 'text-muted-foreground')}>
                Semana {week.number}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
                  style.bg, style.text, style.border,
                )}
              >
                {week.phase}
              </span>
              {week.isWarning && (
                <span className='inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400'>
                  <HugeiconsIcon icon={Alert01Icon} className='size-3' />
                  Último longão
                </span>
              )}
              {week.isKeyWeek && !week.isWarning && (
                <span className='inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-foreground/20 bg-foreground/5 text-foreground'>
                  <HugeiconsIcon icon={Target01Icon} className='size-3' />
                  Semana-chave
                </span>
              )}
            </div>
            <span className={cn('text-sm font-medium truncate mt-0.5', isCompleted && 'text-muted-foreground line-through')}>
              {week.title}
            </span>
          </div>

          <div className='ml-auto flex items-center gap-3 flex-shrink-0'>
            <span className='text-sm tabular-nums text-muted-foreground hidden sm:block'>{km} km</span>
            <HugeiconsIcon
              icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
              className='size-4 text-muted-foreground'
            />
          </div>
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className='border-t border-border px-4 pb-4 pt-3 flex flex-col gap-4'>
          {/* Sessions */}
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-xs text-muted-foreground'>
                  <th className='text-left pb-2 pr-4 font-medium w-10'>Dia</th>
                  <th className='text-left pb-2 pr-4 font-medium'>Treino</th>
                  <th className='text-left pb-2 pr-4 font-medium whitespace-nowrap'>Pace</th>
                  <th className='text-left pb-2 font-medium'>Detalhe</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {week.sessions.map((session, i) => (
                  <SessionRow key={i} session={session} targetPace={targetPace} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Tip */}
          {week.tip && (
            <div
              className={cn(
                'rounded-xl px-4 py-3 text-sm border',
                week.isWarning
                  ? 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300'
                  : 'bg-muted/50 border-border text-muted-foreground',
              )}
            >
              {week.tip}
            </div>
          )}

          <div className='text-xs text-muted-foreground sm:hidden'>
            Volume estimado: <span className='font-medium text-foreground'>{km} km</span>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionRow({ session, targetPace }: { session: Session; targetPace: string }) {
  const pace = resolvePace(targetPace, session.paceOffset)
  const isRace = session.type.startsWith('PROVA')

  return (
    <tr className={cn(isRace && 'font-medium')}>
      <td className='py-2 pr-4 text-muted-foreground font-medium text-xs'>{session.day}</td>
      <td className='py-2 pr-4 text-foreground'>{session.type}</td>
      <td className='py-2 pr-4 whitespace-nowrap'>
        <span className='text-xs font-mono tabular-nums text-foreground/70'>{pace}</span>
      </td>
      <td className='py-2 text-muted-foreground text-xs'>{session.detail}</td>
    </tr>
  )
}
