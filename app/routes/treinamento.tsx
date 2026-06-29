import { useState, useMemo, useEffect, useRef } from 'react'
import { halfMarathonPlan } from '~/data/halfMarathonPlan'
import { marathonPlan } from '~/data/marathonPlan'
import type { TrainingPlan, Week, Phase, Session } from '~/data/halfMarathonPlan'
import { resolvePace, resolveWeeklyKm, phaseStyle } from '~/lib/trainingPaceUtils'
import { cn } from '~/lib/utils'
import { Input } from '~/components/ui/input'
import { Card, CardContent } from '~/components/ui/card'
import {
  Target01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Tick01Icon,
  Alert01Icon,
  Timer01Icon,
  RunningShoesIcon,
  Calendar01Icon,
  Flag01Icon,
  Medal01Icon,
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

const DAYS_OF_WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const
type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

function computeDaysUntilRace(raceDateStr: string): number | null {
  if (!raceDateStr) return null
  const [y, m, d] = raceDateStr.split('-').map(Number)
  const race = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function computeCurrentWeek(daysUntilRace: number | null, totalWeeks: number): number | null {
  if (daysUntilRace === null || daysUntilRace < 0) return null
  const weeksUntilRace = Math.ceil(daysUntilRace / 7)
  const week = totalWeeks - weeksUntilRace + 1
  return week >= 1 && week <= totalWeeks ? week : null
}

export default function TreinamentoRoute() {
  const [planKey, setPlanKey] = useState<'meia' | 'maratona'>('meia')
  const [targetPace, setTargetPace] = useState('')
  const [weeklyKm, setWeeklyKm] = useState('')
  const [raceDate, setRaceDate] = useState('')
  const [trainingDays, setTrainingDays] = useState<Set<DayOfWeek>>(
    new Set(['Seg', 'Ter', 'Qui', 'Sex', 'Sáb']),
  )
  const [phaseFilter, setPhaseFilter] = useState<Phase | 'all'>('all')
  const [completedWeeks, setCompletedWeeks] = useState<Set<number>>(new Set())
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())

  const plan = PLANS[planKey]
  const effectivePace = targetPace.trim() || plan.defaultTargetPace
  const effectiveKm = parseInt(weeklyKm) > 0 ? parseInt(weeklyKm) : plan.defaultWeeklyKm

  const daysUntilRace = useMemo(() => computeDaysUntilRace(raceDate), [raceDate])
  const currentWeekNumber = useMemo(
    () => computeCurrentWeek(daysUntilRace, plan.totalWeeks),
    [daysUntilRace, plan.totalWeeks],
  )

  const currentWeekRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentWeekNumber !== null) {
      setExpandedWeeks(prev => {
        const next = new Set(prev)
        next.add(currentWeekNumber)
        return next
      })
      setTimeout(() => currentWeekRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    }
  }, [currentWeekNumber])

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

  function toggleDay(day: DayOfWeek) {
    setTrainingDays(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  function handlePlanChange(key: 'meia' | 'maratona') {
    setPlanKey(key)
    setPhaseFilter('all')
    setExpandedWeeks(new Set())
    setTargetPace('')
    setWeeklyKm('')
    setRaceDate('')
  }

  const countdownColor =
    daysUntilRace === null ? ''
    : daysUntilRace <= 7 ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
    : daysUntilRace <= 21 ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'

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
        <CardContent className='flex flex-col gap-4 pt-4'>
          {/* Row 1: pace, km, race date */}
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <div>
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
            <div>
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
            <div>
              <label className='text-xs font-medium text-muted-foreground block mb-1.5'>
                Data da prova alvo
              </label>
              <div className='relative'>
                <HugeiconsIcon icon={Calendar01Icon} className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
                <Input
                  type='date'
                  value={raceDate}
                  onChange={e => setRaceDate(e.target.value)}
                  className='pl-9'
                />
              </div>
            </div>
          </div>

          {/* Row 2: training days */}
          <div>
            <p className='text-xs font-medium text-muted-foreground mb-2'>
              Dias de treino ({trainingDays.size} dias/semana)
            </p>
            <div className='flex gap-1.5 flex-wrap'>
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    trainingDays.has(day)
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-transparent text-muted-foreground border-border hover:text-foreground',
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Countdown banner */}
      {daysUntilRace !== null && daysUntilRace >= 0 && (
        <div className={cn('rounded-2xl border px-4 py-3 flex items-center justify-between gap-4', countdownColor)}>
          <div className='flex items-center gap-2'>
            <HugeiconsIcon icon={Flag01Icon} className='size-4 shrink-0' />
            <span className='text-sm font-medium'>
              {daysUntilRace === 0
                ? 'Dia da prova! 🏁'
                : `${daysUntilRace} dia${daysUntilRace !== 1 ? 's' : ''} para a prova`}
            </span>
          </div>
          {currentWeekNumber !== null ? (
            <span className='text-xs font-medium opacity-80 shrink-0'>
              Semana {currentWeekNumber} de {plan.totalWeeks}
            </span>
          ) : daysUntilRace > plan.totalWeeks * 7 ? (
            <span className='text-xs opacity-70 shrink-0'>Plano ainda não iniciado</span>
          ) : null}
        </div>
      )}
      {daysUntilRace !== null && daysUntilRace < 0 && (
        <div className='rounded-2xl border border-border bg-muted/30 px-4 py-3 flex items-center gap-2 text-muted-foreground'>
          <HugeiconsIcon icon={Medal01Icon} className='size-4 shrink-0' />
          <span className='text-sm'>Prova já realizada — configure uma nova data para continuar.</span>
        </div>
      )}

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
        {visibleWeeks.map(week => {
          const isCurrentWeek = week.number === currentWeekNumber
          return (
            <div key={week.number} ref={isCurrentWeek ? currentWeekRef : undefined}>
              <WeekCard
                week={week}
                targetPace={effectivePace}
                weeklyKm={effectiveKm}
                trainingDays={trainingDays}
                isCompleted={completedWeeks.has(week.number)}
                isExpanded={expandedWeeks.has(week.number)}
                isCurrentWeek={isCurrentWeek}
                daysUntilRace={isCurrentWeek ? daysUntilRace : null}
                onToggleExpand={() => toggleExpand(week.number)}
                onToggleComplete={() => toggleComplete(week.number)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface WeekCardProps {
  week: Week
  targetPace: string
  weeklyKm: number
  trainingDays: Set<DayOfWeek>
  isCompleted: boolean
  isExpanded: boolean
  isCurrentWeek: boolean
  daysUntilRace: number | null
  onToggleExpand: () => void
  onToggleComplete: () => void
}

function WeekCard({
  week, targetPace, weeklyKm, trainingDays,
  isCompleted, isExpanded, isCurrentWeek, daysUntilRace,
  onToggleExpand, onToggleComplete,
}: WeekCardProps) {
  const km = resolveWeeklyKm(week.volumeFraction, weeklyKm)
  const style = phaseStyle(week.phase)
  const sessionDays = week.sessions.map(s => s.day)

  return (
    <div
      className={cn(
        'rounded-2xl border transition-colors',
        isCurrentWeek && !isCompleted && 'border-blue-500/60 ring-1 ring-blue-500/20',
        isCompleted ? 'border-foreground/20 bg-muted/30' : !isCurrentWeek && 'border-border bg-card',
        !isCompleted && isCurrentWeek && 'bg-blue-500/5',
        week.isWarning && !isCompleted && !isCurrentWeek && 'border-orange-500/40',
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
          <div className='flex flex-col min-w-0 gap-1'>
            {/* Tags row */}
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
              {isCurrentWeek && !isCompleted && (
                <span className='inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'>
                  <span className='size-1.5 rounded-full bg-blue-500 animate-pulse inline-block' />
                  {daysUntilRace !== null
                    ? `Semana atual · ${daysUntilRace}d para a prova`
                    : 'Você está aqui'}
                </span>
              )}
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

            {/* Title */}
            <span className={cn('text-sm font-medium truncate', isCompleted && 'text-muted-foreground line-through')}>
              {week.title}
            </span>

            {/* Training days pills */}
            <div className='flex items-center gap-1 flex-wrap'>
              {sessionDays.map((day, i) => {
                const isUserDay = trainingDays.has(day as DayOfWeek)
                const isRaceDay = week.sessions[i]?.type?.startsWith('PROVA')
                return (
                  <span
                    key={i}
                    className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border',
                      isRaceDay
                        ? 'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400'
                        : isUserDay
                        ? 'border-foreground/30 bg-foreground/10 text-foreground'
                        : 'border-border bg-transparent text-muted-foreground',
                    )}
                  >
                    {day}
                  </span>
                )
              })}
              <span className='text-[10px] text-muted-foreground ml-1'>
                {sessionDays.length} sessões
              </span>
            </div>
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
                  <SessionRow
                    key={i}
                    session={session}
                    targetPace={targetPace}
                    isUserDay={trainingDays.has(session.day as DayOfWeek)}
                  />
                ))}
              </tbody>
            </table>
          </div>

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

function SessionRow({
  session, targetPace, isUserDay,
}: { session: Session; targetPace: string; isUserDay: boolean }) {
  const pace = resolvePace(targetPace, session.paceOffset)
  const isRace = session.type.startsWith('PROVA')

  return (
    <tr className={cn(isRace && 'font-medium', !isUserDay && !isRace && 'opacity-50')}>
      <td className='py-2 pr-4'>
        <span
          className={cn(
            'text-xs font-medium rounded px-1 py-0.5',
            isRace
              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
              : isUserDay
              ? 'text-foreground'
              : 'text-muted-foreground',
          )}
        >
          {session.day}
        </span>
      </td>
      <td className='py-2 pr-4 text-foreground text-sm'>{session.type}</td>
      <td className='py-2 pr-4 whitespace-nowrap'>
        <span className='text-xs font-mono tabular-nums text-foreground/70'>{pace}</span>
      </td>
      <td className='py-2 text-muted-foreground text-xs'>{session.detail}</td>
    </tr>
  )
}
