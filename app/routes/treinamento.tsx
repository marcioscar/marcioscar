import { useState, useMemo, useEffect, useRef } from 'react'
import { useLoaderData, useFetcher, useSubmit, Form } from 'react-router'
import type { Route } from './+types/treinamento'
import { halfMarathonPlan } from '~/data/halfMarathonPlan'
import { marathonPlan } from '~/data/marathonPlan'
import type { TrainingPlan, Week, Phase, Session } from '~/data/halfMarathonPlan'
import { resolvePace, resolveWeeklyKm, phaseStyle } from '~/lib/trainingPaceUtils'
import { cn } from '~/lib/utils'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import {
	listarProvas,
	criarProva,
	selecionarProva,
	atualizarConfigs,
	toggleSemanaCompleta,
	editarProva,
	deletarProva,
	type ProvaAlvo,
} from '~/models/provas.server'
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
	Add01Icon,
	Delete02Icon,
	Edit01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export function meta() {
	return [
		{ title: 'Treinamento | Marcioscar' },
		{ name: 'description', content: 'Planos de treino Canova' },
	]
}

const PLANS: Record<string, TrainingPlan> = {
	meia: halfMarathonPlan,
	maratona: marathonPlan,
}

const ALL_PHASES: Array<Phase | 'all'> = ['all', 'Geral', 'Fundamental', 'Específica', 'Taper']
const DAYS_OF_WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const
type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

const DEFAULT_PACE: Record<string, string> = { meia: '5:00', maratona: '5:12' }
const DEFAULT_KM: Record<string, number> = { meia: 60, maratona: 70 }
const DEFAULT_DAYS: DayOfWeek[] = ['Seg', 'Ter', 'Qui', 'Sex', 'Sáb']

function parseDateInput(str: string): Date {
	const [y, m, d] = str.split('-').map(Number)
	return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader() {
	const provas = await listarProvas()
	return { provas }
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
	const form = await request.formData()
	const intent = form.get('_intent') as string

	if (intent === 'criarProva') {
		const nome = form.get('nome') as string
		const plano = form.get('plano') as string
		const dataProva = parseDateInput(form.get('dataProva') as string)
		const paceAlvo = form.get('paceAlvo') as string
		const kmSemanais = parseInt(form.get('kmSemanais') as string)
		const diasTreino = form.getAll('diasTreino') as string[]
		await criarProva({ nome, plano, dataProva, paceAlvo, kmSemanais, diasTreino })
		return { ok: true }
	}

	if (intent === 'selecionarProva') {
		await selecionarProva(form.get('id') as string)
		return { ok: true }
	}

	if (intent === 'atualizarConfigs') {
		const id = form.get('id') as string
		const paceAlvo = form.get('paceAlvo') as string
		const kmSemanais = parseInt(form.get('kmSemanais') as string)
		const diasTreino = form.getAll('diasTreino') as string[]
		await atualizarConfigs(id, { paceAlvo, kmSemanais, diasTreino })
		return { ok: true }
	}

	if (intent === 'toggleSemana') {
		const id = form.get('id') as string
		const semana = parseInt(form.get('semana') as string)
		const result = await toggleSemanaCompleta(id, semana)
		return result
	}

	if (intent === 'editarProva') {
		const id = form.get('id') as string
		const nome = form.get('nome') as string
		const plano = form.get('plano') as string
		const dataProva = parseDateInput(form.get('dataProva') as string)
		const paceAlvo = form.get('paceAlvo') as string
		const kmSemanais = parseInt(form.get('kmSemanais') as string)
		const diasTreino = form.getAll('diasTreino') as string[]
		await editarProva(id, { nome, plano, dataProva, paceAlvo, kmSemanais, diasTreino })
		return { ok: true }
	}

	if (intent === 'deletarProva') {
		await deletarProva(form.get('id') as string)
		return { ok: true }
	}

	return { ok: false }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeDaysUntilRace(dataProva: Date): number {
	const r = new Date(dataProva)
	const raceDay = Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate())
	const t = new Date()
	const todayDay = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())
	return Math.round((raceDay - todayDay) / 86_400_000)
}

function computeCurrentWeek(daysUntilRace: number, totalWeeks: number): number | null {
	if (daysUntilRace < 0) return null
	const week = totalWeeks - Math.ceil(daysUntilRace / 7) + 1
	return week >= 1 && week <= totalWeeks ? week : null
}

function formatDate(date: Date): string {
	return new Date(date).toLocaleDateString('pt-BR', {
		day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
	})
}

function toDateInput(date: Date): string {
	const d = new Date(date)
	const y = d.getUTCFullYear()
	const m = String(d.getUTCMonth() + 1).padStart(2, '0')
	const day = String(d.getUTCDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

// ── Route component ───────────────────────────────────────────────────────────

export default function TreinamentoRoute() {
	const { provas } = useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const submit = useSubmit()

	const activeProva = provas.find(p => p.ativa) ?? null

	// Settings state — syncs with active prova
	const [planKey, setPlanKey] = useState<'meia' | 'maratona'>(
		(activeProva?.plano as 'meia' | 'maratona') ?? 'meia',
	)
	const [targetPace, setTargetPace] = useState(activeProva?.paceAlvo ?? '')
	const [weeklyKm, setWeeklyKm] = useState(activeProva ? String(activeProva.kmSemanais) : '')
	const [trainingDays, setTrainingDays] = useState<Set<DayOfWeek>>(
		new Set((activeProva?.diasTreino ?? DEFAULT_DAYS) as DayOfWeek[]),
	)
	const [phaseFilter, setPhaseFilter] = useState<Phase | 'all'>('all')
	const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())
	const [showNewForm, setShowNewForm] = useState(false)
	const [editingProvaId, setEditingProvaId] = useState<string | null>(null)
	const [settingsDirty, setSettingsDirty] = useState(false)

	// Sync state when active prova changes
	useEffect(() => {
		if (activeProva) {
			setPlanKey(activeProva.plano as 'meia' | 'maratona')
			setTargetPace(activeProva.paceAlvo)
			setWeeklyKm(String(activeProva.kmSemanais))
			setTrainingDays(new Set(activeProva.diasTreino as DayOfWeek[]))
			setSettingsDirty(false)
		}
	}, [activeProva?.id])

	const plan = PLANS[planKey]
	const effectivePace = targetPace.trim() || DEFAULT_PACE[planKey]
	const effectiveKm = parseInt(weeklyKm) > 0 ? parseInt(weeklyKm) : DEFAULT_KM[planKey]

	// Optimistic completed weeks — merge DB state with in-flight toggle
	const completedWeeks = useMemo<Set<number>>(() => {
		const base = new Set<number>(activeProva?.semanasCompletas ?? [])
		if (fetcher.state !== 'idle' && fetcher.formData?.get('_intent') === 'toggleSemana') {
			const semana = parseInt(fetcher.formData.get('semana') as string)
			base.has(semana) ? base.delete(semana) : base.add(semana)
		}
		return base
	}, [activeProva?.semanasCompletas, fetcher.state, fetcher.formData])

	const daysUntilRace = activeProva ? computeDaysUntilRace(new Date(activeProva.dataProva)) : null
	const currentWeekNumber = daysUntilRace !== null ? computeCurrentWeek(daysUntilRace, plan.totalWeeks) : null

	const currentWeekRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (currentWeekNumber !== null) {
			setExpandedWeeks(prev => new Set([...prev, currentWeekNumber]))
			setTimeout(() => currentWeekRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
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

	function toggleDay(day: DayOfWeek) {
		setTrainingDays(prev => {
			const next = new Set(prev)
			next.has(day) ? next.delete(day) : next.add(day)
			return next
		})
		setSettingsDirty(true)
	}

	function handleToggleSemana(semana: number) {
		if (!activeProva) return
		fetcher.submit(
			{ _intent: 'toggleSemana', id: activeProva.id, semana: String(semana) },
			{ method: 'post' },
		)
	}

	function handleSelecionarProva(id: string) {
		submit({ _intent: 'selecionarProva', id }, { method: 'post' })
	}

	function handleSalvarConfigs() {
		if (!activeProva) return
		const formData = new FormData()
		formData.append('_intent', 'atualizarConfigs')
		formData.append('id', activeProva.id)
		formData.append('paceAlvo', effectivePace)
		formData.append('kmSemanais', String(effectiveKm))
		trainingDays.forEach(d => formData.append('diasTreino', d))
		submit(formData, { method: 'post' })
		setSettingsDirty(false)
	}

	function handleEditarProva(id: string) {
		setEditingProvaId(id)
		setShowNewForm(false)
	}

	function handleDeletarProva(id: string) {
		if (!confirm('Remover esta prova?')) return
		submit({ _intent: 'deletarProva', id }, { method: 'post' })
	}

	const countdownColor =
		daysUntilRace === null ? ''
		: daysUntilRace <= 7 ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
		: daysUntilRace <= 21 ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
		: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'

	return (
		<div className='flex flex-col gap-6 p-4 md:p-6'>

			{/* Header */}
			<div className='flex items-start justify-between'>
				<div>
					<h1 className='text-2xl font-semibold tracking-tight'>Plano de Treinamento</h1>
					<p className='text-sm text-muted-foreground mt-1'>Metodologia Canova — {plan.totalWeeks} semanas</p>
				</div>
			</div>

			{/* ── PROVAS CADASTRADAS ── */}
			<div className='flex flex-col gap-3'>
				<div className='flex items-center justify-between'>
					<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Suas provas</p>
					<button
						onClick={() => setShowNewForm(v => !v)}
						className='inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors'
					>
						<HugeiconsIcon icon={Add01Icon} className='size-3' />
						Nova prova
					</button>
				</div>

				{/* Race cards */}
				{provas.length > 0 && (
					<div className='flex gap-2 flex-wrap'>
						{provas.map(prova => (
							<ProvaCard
								key={prova.id}
								prova={prova}
								isActive={prova.ativa}
								isEditing={editingProvaId === prova.id}
								onSelect={() => handleSelecionarProva(prova.id)}
								onEdit={() => handleEditarProva(prova.id)}
								onDelete={() => handleDeletarProva(prova.id)}
							/>
						))}
					</div>
				)}

				{/* Edit race form */}
				{editingProvaId && (() => {
					const prova = provas.find(p => p.id === editingProvaId)
					if (!prova) return null
					return (
						<Card size='sm'>
							<CardContent className='pt-4'>
								<p className='text-xs font-medium text-muted-foreground mb-3'>Editar prova</p>
								<Form
									method='post'
									onSubmit={() => setEditingProvaId(null)}
									className='flex flex-col gap-3'
								>
									<input type='hidden' name='_intent' value='editarProva' />
									<input type='hidden' name='id' value={prova.id} />
									<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
										<div>
											<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Nome da prova</label>
											<Input name='nome' defaultValue={prova.nome} required />
										</div>
										<div>
											<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Data da prova</label>
											<Input type='date' name='dataProva' defaultValue={toDateInput(new Date(prova.dataProva))} required />
										</div>
										<div>
											<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Modalidade</label>
											<div className='flex gap-2'>
												{(['meia', 'maratona'] as const).map(k => (
													<label key={k} className='flex items-center gap-1.5 cursor-pointer'>
														<input type='radio' name='plano' value={k} defaultChecked={prova.plano === k} className='accent-foreground' />
														<span className='text-sm'>{k === 'meia' ? 'Meia' : 'Maratona'}</span>
													</label>
												))}
											</div>
										</div>
										<div>
											<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Pace alvo</label>
											<Input name='paceAlvo' defaultValue={prova.paceAlvo} placeholder='5:00' />
										</div>
										<div>
											<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Volume semanal (km)</label>
											<Input type='number' name='kmSemanais' defaultValue={prova.kmSemanais} min={20} max={150} />
										</div>
										<div>
											<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Dias de treino</label>
											<div className='flex gap-1 flex-wrap'>
												{DAYS_OF_WEEK.map(day => (
													<label key={day} className='flex items-center gap-1 cursor-pointer'>
														<input
															type='checkbox'
															name='diasTreino'
															value={day}
															defaultChecked={prova.diasTreino.includes(day)}
															className='accent-foreground'
														/>
														<span className='text-xs'>{day}</span>
													</label>
												))}
											</div>
										</div>
									</div>
									<div className='flex gap-2 pt-1'>
										<Button type='submit' size='sm'>Salvar alterações</Button>
										<Button type='button' variant='outline' size='sm' onClick={() => setEditingProvaId(null)}>
											Cancelar
										</Button>
									</div>
								</Form>
							</CardContent>
						</Card>
					)
				})()}

				{provas.length === 0 && !showNewForm && (
					<div className='rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground'>
						Nenhuma prova cadastrada. Adicione sua primeira prova alvo.
					</div>
				)}

				{/* New race form */}
				{showNewForm && (
					<Card size='sm'>
						<CardContent className='pt-4'>
							<Form
								method='post'
								onSubmit={() => setShowNewForm(false)}
								className='flex flex-col gap-3'
							>
								<input type='hidden' name='_intent' value='criarProva' />
								<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
									<div>
										<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Nome da prova</label>
										<Input name='nome' placeholder='Ex: São Paulo City Marathon 2026' required />
									</div>
									<div>
										<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Data da prova</label>
										<Input type='date' name='dataProva' required />
									</div>
									<div>
										<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Modalidade</label>
										<div className='flex gap-2'>
											{(['meia', 'maratona'] as const).map(k => (
												<label key={k} className='flex items-center gap-1.5 cursor-pointer'>
													<input type='radio' name='plano' value={k} defaultChecked={k === 'meia'} className='accent-foreground' />
													<span className='text-sm'>{k === 'meia' ? 'Meia' : 'Maratona'}</span>
												</label>
											))}
										</div>
									</div>
									<div>
										<label className='text-xs font-medium text-muted-foreground block mb-1.5'>
											Pace alvo
										</label>
										<Input name='paceAlvo' placeholder='5:00' defaultValue={DEFAULT_PACE[planKey]} />
									</div>
									<div>
										<label className='text-xs font-medium text-muted-foreground block mb-1.5'>
											Volume semanal (km)
										</label>
										<Input type='number' name='kmSemanais' placeholder='60' defaultValue={DEFAULT_KM[planKey]} min={20} max={150} />
									</div>
									<div>
										<label className='text-xs font-medium text-muted-foreground block mb-1.5'>
											Dias de treino
										</label>
										<div className='flex gap-1 flex-wrap'>
											{DAYS_OF_WEEK.map(day => (
												<label key={day} className='flex items-center gap-1 cursor-pointer'>
													<input
														type='checkbox'
														name='diasTreino'
														value={day}
														defaultChecked={DEFAULT_DAYS.includes(day as DayOfWeek)}
														className='accent-foreground'
													/>
													<span className='text-xs'>{day}</span>
												</label>
											))}
										</div>
									</div>
								</div>
								<div className='flex gap-2 pt-1'>
									<Button type='submit' size='sm'>Criar prova</Button>
									<Button type='button' variant='outline' size='sm' onClick={() => setShowNewForm(false)}>
										Cancelar
									</Button>
								</div>
							</Form>
						</CardContent>
					</Card>
				)}
			</div>

			{/* ── CONFIGURAÇÕES ── (only when there's an active prova) */}
			{activeProva && (
				<Card size='sm'>
					<CardContent className='flex flex-col gap-4 pt-4'>
						<div className='flex items-center justify-between'>
							<p className='text-xs font-medium text-muted-foreground'>
								Configurações · {activeProva.nome}
							</p>
							{settingsDirty && (
								<Button size='sm' onClick={handleSalvarConfigs}>
									Salvar
								</Button>
							)}
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
							<div>
								<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Pace alvo</label>
								<div className='relative'>
									<HugeiconsIcon icon={Timer01Icon} className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
									<Input
										value={targetPace}
										onChange={e => { setTargetPace(e.target.value); setSettingsDirty(true) }}
										placeholder={DEFAULT_PACE[planKey]}
										className='pl-9'
									/>
								</div>
							</div>
							<div>
								<label className='text-xs font-medium text-muted-foreground block mb-1.5'>Volume semanal (km)</label>
								<div className='relative'>
									<HugeiconsIcon icon={RunningShoesIcon} className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
									<Input
										type='number'
										value={weeklyKm}
										onChange={e => { setWeeklyKm(e.target.value); setSettingsDirty(true) }}
										placeholder={String(DEFAULT_KM[planKey])}
										min={20} max={150}
										className='pl-9'
									/>
								</div>
							</div>
						</div>

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
			)}

			{/* ── PLAN SELECTOR (sem prova ativa) ── */}
			{!activeProva && (
				<div className='flex gap-2'>
					{(['meia', 'maratona'] as const).map(key => (
						<button
							key={key}
							onClick={() => setPlanKey(key)}
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
			)}

			{/* ── COUNTDOWN ── */}
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
					<span className='text-sm'>Prova já realizada. Cadastre uma nova prova para continuar.</span>
				</div>
			)}

			{/* ── PROGRESSO ── */}
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

			{/* ── FILTRO DE FASES ── */}
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

			{/* ── SEMANAS ── */}
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
								onToggleComplete={() => handleToggleSemana(week.number)}
							/>
						</div>
					)
				})}
			</div>
		</div>
	)
}

// ── ProvaCard ─────────────────────────────────────────────────────────────────

function ProvaCard({
	prova, isActive, isEditing, onSelect, onEdit, onDelete,
}: {
	prova: ProvaAlvo
	isActive: boolean
	isEditing: boolean
	onSelect: () => void
	onEdit: () => void
	onDelete: () => void
}) {
	const days = computeDaysUntilRace(new Date(prova.dataProva))
	return (
		<div
			className={cn(
				'group relative rounded-2xl border px-4 py-3 cursor-pointer transition-colors min-w-[160px]',
				isActive && !isEditing && 'border-foreground bg-foreground/5 ring-1 ring-foreground/20',
				isEditing && 'border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/20',
				!isActive && !isEditing && 'border-border bg-card hover:border-foreground/40',
			)}
			onClick={onSelect}
		>
			<div className='absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
				<button
					onClick={e => { e.stopPropagation(); onEdit() }}
					className='text-muted-foreground hover:text-foreground p-0.5 rounded'
					aria-label='Editar prova'
				>
					<HugeiconsIcon icon={Edit01Icon} className='size-3.5' />
				</button>
				<button
					onClick={e => { e.stopPropagation(); onDelete() }}
					className='text-muted-foreground hover:text-destructive p-0.5 rounded'
					aria-label='Remover prova'
				>
					<HugeiconsIcon icon={Delete02Icon} className='size-3.5' />
				</button>
			</div>
			<p className='text-xs font-medium text-muted-foreground capitalize'>
				{prova.plano === 'meia' ? 'Meia Maratona' : 'Maratona'}
			</p>
			<p className='text-sm font-semibold mt-0.5 pr-10 leading-tight'>{prova.nome}</p>
			<p className='text-xs text-muted-foreground mt-1'>{formatDate(prova.dataProva)}</p>
			{isActive && days >= 0 && (
				<p className='text-xs font-medium text-foreground mt-1'>{days}d restantes</p>
			)}
		</div>
	)
}

// ── WeekCard ──────────────────────────────────────────────────────────────────

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
				isCurrentWeek && !isCompleted && 'border-blue-500/60 ring-1 ring-blue-500/20 bg-blue-500/5',
				isCompleted ? 'border-foreground/20 bg-muted/30' : !isCurrentWeek && 'border-border bg-card',
				week.isWarning && !isCompleted && !isCurrentWeek && 'border-orange-500/40',
			)}
		>
			<div className='flex items-center gap-3 px-4 py-3'>
				<button
					onClick={onToggleComplete}
					aria-label={`Marcar semana ${week.number}`}
					className={cn(
						'flex-shrink-0 size-5 rounded-full border-2 flex items-center justify-center transition-colors',
						isCompleted ? 'bg-foreground border-foreground text-background' : 'border-border hover:border-foreground/50',
					)}
				>
					{isCompleted && <HugeiconsIcon icon={Tick01Icon} className='size-3' strokeWidth={3} />}
				</button>

				<button onClick={onToggleExpand} className='flex flex-1 items-center gap-3 min-w-0 text-left'>
					<div className='flex flex-col min-w-0 gap-1'>
						<div className='flex items-center gap-2 flex-wrap'>
							<span className={cn('text-xs font-medium', isCompleted && 'text-muted-foreground')}>
								Semana {week.number}
							</span>
							<span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border', style.bg, style.text, style.border)}>
								{week.phase}
							</span>
							{isCurrentWeek && !isCompleted && (
								<span className='inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'>
									<span className='size-1.5 rounded-full bg-blue-500 animate-pulse inline-block' />
									{daysUntilRace !== null ? `Você está aqui · ${daysUntilRace}d` : 'Você está aqui'}
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

						<span className={cn('text-sm font-medium truncate', isCompleted && 'text-muted-foreground line-through')}>
							{week.title}
						</span>

						<div className='flex items-center gap-1 flex-wrap'>
							{sessionDays.map((day, i) => {
								const isUserDay = trainingDays.has(day as DayOfWeek)
								const isRaceDay = week.sessions[i]?.type?.startsWith('PROVA')
								return (
									<span
										key={i}
										className={cn(
											'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border',
											isRaceDay ? 'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400'
											: isUserDay ? 'border-foreground/30 bg-foreground/10 text-foreground'
											: 'border-border bg-transparent text-muted-foreground',
										)}
									>
										{day}
									</span>
								)
							})}
							<span className='text-[10px] text-muted-foreground ml-1'>{sessionDays.length} sessões</span>
						</div>
					</div>

					<div className='ml-auto flex items-center gap-3 flex-shrink-0'>
						<span className='text-sm tabular-nums text-muted-foreground hidden sm:block'>{km} km</span>
						<HugeiconsIcon icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon} className='size-4 text-muted-foreground' />
					</div>
				</button>
			</div>

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
						<div className={cn(
							'rounded-xl px-4 py-3 text-sm border',
							week.isWarning
								? 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300'
								: 'bg-muted/50 border-border text-muted-foreground',
						)}>
							{week.tip}
						</div>
					)}

					<div className='text-xs text-muted-foreground sm:hidden'>
						Volume: <span className='font-medium text-foreground'>{km} km</span>
					</div>
				</div>
			)}
		</div>
	)
}

function SessionRow({ session, targetPace, isUserDay }: { session: Session; targetPace: string; isUserDay: boolean }) {
	const pace = resolvePace(targetPace, session.paceOffset)
	const isRace = session.type.startsWith('PROVA')
	return (
		<tr className={cn(isRace && 'font-medium', !isUserDay && !isRace && 'opacity-50')}>
			<td className='py-2 pr-4'>
				<span className={cn('text-xs font-medium rounded px-1 py-0.5',
					isRace ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
					: isUserDay ? 'text-foreground' : 'text-muted-foreground',
				)}>
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
