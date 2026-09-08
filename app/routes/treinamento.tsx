import { useState, useMemo, useEffect, useRef } from 'react'
import { useLoaderData, useFetcher, useSubmit, Form } from 'react-router'
import type { Route } from './+types/treinamento'
import { halfMarathonPlan } from '~/data/halfMarathonPlan'
import { marathonPlan } from '~/data/marathonPlan'
import type { TrainingPlan, Week, Phase } from '~/data/halfMarathonPlan'
import { resolvePace, resolveWeeklyKm, phaseStyle } from '~/lib/trainingPaceUtils'
import {
	planWeek,
	maxHardSessions,
	type CoachSession,
	DAYS_OF_WEEK,
	ROLE_LABEL,
	type DayOfWeek,
	type SessionRole,
	type PlannedSession,
} from '~/lib/canovaPlanner'
import {
	computeDaysUntilRace,
	computeCurrentWeek,
	formatDate,
	toDateInput,
	parseDateInput,
} from '~/lib/provaUtils'
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
	listarTreinosTreinador,
	salvarTreinoTreinador,
	removerTreinoTreinador,
	sanitizarSessoes,
} from '~/models/treino-treinador.server'
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
	WhistleIcon,
	MagicWand01Icon,
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
const DEFAULT_PACE: Record<string, string> = { meia: '5:00', maratona: '5:12' }
const DEFAULT_KM: Record<string, number> = { meia: 60, maratona: 70 }
const DEFAULT_DAYS: DayOfWeek[] = ['Seg', 'Ter', 'Qui', 'Sex', 'Sáb']
/** Referência estável para semanas sem treino do treinador. */
const SEM_TREINOS: CoachSession[] = []

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader() {
	const provas = await listarProvas()
	const ativa = provas.find(p => p.ativa)
	const treinosTreinador = ativa ? await listarTreinosTreinador(ativa.id) : []
	return { provas, treinosTreinador }
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

	if (intent === 'salvarTreinoTreinador') {
		const provaId = form.get('provaId') as string
		const semana = parseInt(form.get('semana') as string)
		const textoOrigem = (form.get('textoOrigem') as string) || null
		let sessoes: ReturnType<typeof sanitizarSessoes> = []
		try {
			sessoes = sanitizarSessoes(JSON.parse((form.get('sessoes') as string) || '[]'))
		} catch {
			return { ok: false, erro: 'Treinos inválidos.' }
		}
		if (sessoes.length === 0) {
			await removerTreinoTreinador(provaId, semana)
		} else {
			await salvarTreinoTreinador(provaId, semana, sessoes, textoOrigem)
		}
		return { ok: true }
	}

	if (intent === 'removerTreinoTreinador') {
		await removerTreinoTreinador(
			form.get('provaId') as string,
			parseInt(form.get('semana') as string),
		)
		return { ok: true }
	}

	if (intent === 'deletarProva') {
		await deletarProva(form.get('id') as string)
		return { ok: true }
	}

	return { ok: false }
}

// ── Route component ───────────────────────────────────────────────────────────

export default function TreinamentoRoute() {
	const { provas, treinosTreinador } = useLoaderData<typeof loader>()
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

	const coachPorSemana = useMemo(() => {
		const mapa = new Map<number, CoachSession[]>()
		for (const t of treinosTreinador) mapa.set(t.semana, t.sessoes)
		return mapa
	}, [treinosTreinador])

	// Quantos treinos fortes cabem na semana com os dias escolhidos (fase mais exigente do plano).
	const hardPerWeek = maxHardSessions(trainingDays.size, 'Específica')
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
		if (!activeProva || trainingDays.size === 0) return
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
								<Button size='sm' onClick={handleSalvarConfigs} disabled={trainingDays.size === 0}>
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
								Dias de treino ({trainingDays.size} {trainingDays.size === 1 ? 'dia' : 'dias'}/semana)
							</p>
							<div className='flex gap-1.5 flex-wrap'>
								{DAYS_OF_WEEK.map(day => (
									<button
										key={day}
										onClick={() => toggleDay(day)}
										aria-pressed={trainingDays.has(day)}
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

							{trainingDays.size === 0 ? (
								<p className='mt-2 text-xs text-red-600 dark:text-red-400'>
									Selecione pelo menos um dia de treino.
								</p>
							) : (
								<p className='mt-2 text-xs text-muted-foreground'>
									O plano é reescrito nos dias que você escolher:{' '}
									<span className='font-medium text-foreground'>
										{hardPerWeek} {hardPerWeek === 1 ? 'treino forte' : 'treinos fortes'}
									</span>{' '}
									(longão + trabalho específico) espaçados por dias fáceis, e o volume da semana
									redistribuído entre as sessões.
									{trainingDays.size < 3 && ' Com menos de 3 dias o volume semanal cai bastante.'}
								</p>
							)}
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
								planKey={planKey}
								provaId={activeProva?.id ?? null}
								coachSessions={coachPorSemana.get(week.number) ?? SEM_TREINOS}
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

const ROLE_STYLE: Record<SessionRole, string> = {
	prova:        'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400',
	longao:       'border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400',
	qualidade:    'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
	fundamental:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
	regenerativo: 'border-border bg-muted/60 text-muted-foreground',
}

interface WeekCardProps {
	week: Week
	planKey: string
	provaId: string | null
	coachSessions: CoachSession[]
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
	week, planKey, provaId, coachSessions, targetPace, weeklyKm, trainingDays,
	isCompleted, isExpanded, isCurrentWeek, daysUntilRace,
	onToggleExpand, onToggleComplete,
}: WeekCardProps) {
	const metaKm = resolveWeeklyKm(week.volumeFraction, weeklyKm)
	const style = phaseStyle(week.phase)

	const sessions = useMemo(
		() => planWeek(week, [...trainingDays], metaKm, planKey, { coachSessions, targetPace }),
		[week, trainingDays, metaKm, planKey, coachSessions, targetPace],
	)
	const km = Math.round(sessions.reduce((a, s) => a + s.km, 0))
	const hasRace = sessions.some(s => s.role === 'prova')
	const canovaDays = sessions.filter(s => s.origem === 'canova' && s.role !== 'prova').length
	// Na semana da prova o volume da prova entra por cima da meta de treino.
	// Se o treinador prescreveu todos os dias, o volume é decisão dele, não uma limitação.
	const shortOfTarget = !hasRace && km < metaKm - 1 && canovaDays > 0

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
							{coachSessions.length > 0 && (
								<span className='inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400'>
									<HugeiconsIcon icon={WhistleIcon} className='size-3' />
									Treinador
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
							{sessions.map((session, i) => (
								<span
									key={i}
									title={ROLE_LABEL[session.role]}
									className={cn(
										'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border',
										ROLE_STYLE[session.role],
									)}
								>
									{session.day}
								</span>
							))}
							<span className='text-[10px] text-muted-foreground ml-1'>
								{sessions.length} {sessions.length === 1 ? 'sessão' : 'sessões'}
							</span>
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
									<th className='text-right pb-2 pr-4 font-medium whitespace-nowrap'>Km</th>
									<th className='text-left pb-2 pr-4 font-medium whitespace-nowrap'>Pace</th>
									<th className='text-left pb-2 font-medium'>Detalhe</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-border'>
								{sessions.map((session, i) => (
									<SessionRow key={i} session={session} targetPace={targetPace} />
								))}
							</tbody>
						</table>
					</div>

					{shortOfTarget && (
						<div className='rounded-xl px-4 py-3 text-xs border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'>
							Com {trainingDays.size} {trainingDays.size === 1 ? 'dia' : 'dias'} por semana só cabem{' '}
							<span className='font-medium'>{km} km</span> desta semana sem estourar o limite por sessão
							(a meta do plano é {metaKm} km). Canova prefere reduzir o volume a inchar uma única sessão —
							adicione um dia de treino para chegar à meta.
						</div>
					)}

					{provaId && (
						<TreinoTreinadorEditor
							provaId={provaId}
							semana={week.number}
							sessoes={coachSessions}
						/>
					)}

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

function SessionRow({ session, targetPace }: { session: PlannedSession; targetPace: string }) {
	const pace = resolvePace(targetPace, session.paceOffset)
	const isRace = session.role === 'prova'
	return (
		<tr className={cn(isRace && 'font-medium')}>
			<td className='py-2 pr-4'>
				<span className={cn(
					'text-xs font-medium rounded px-1 py-0.5 border inline-block',
					ROLE_STYLE[session.role],
				)}>
					{session.day}
				</span>
			</td>
			<td className='py-2 pr-4 text-foreground text-sm'>
				<span className='flex items-center gap-1.5'>
					{session.type}
					{session.origem === 'treinador' && (
						<span className='inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400'>
							TREINADOR
						</span>
					)}
				</span>
				<span className='block text-[10px] text-muted-foreground'>{ROLE_LABEL[session.role]}</span>
			</td>
			<td className='py-2 pr-4 text-right whitespace-nowrap tabular-nums text-foreground/80 text-xs'>
				{session.km > 0 ? `${session.km} km` : '—'}
			</td>
			<td className='py-2 pr-4 whitespace-nowrap'>
				<span className='text-xs font-mono tabular-nums text-foreground/70'>{pace}</span>
			</td>
			<td className='py-2 text-muted-foreground text-xs'>{session.detail}</td>
		</tr>
	)
}

// ── TreinoTreinadorEditor ─────────────────────────────────────────────────────

/** Linha em edição: km e pace ficam como texto para não brigar com o input. */
type LinhaTreino = { dia: DayOfWeek; tipo: string; km: string; pace: string; detalhe: string }

function paraLinha(s: CoachSession): LinhaTreino {
	return {
		dia: s.dia,
		tipo: s.tipo,
		km: s.km != null ? String(s.km) : '',
		pace: s.pace ?? '',
		detalhe: s.detalhe,
	}
}

function paraSessao(l: LinhaTreino): CoachSession {
	const km = parseFloat(l.km.replace(',', '.'))
	return {
		dia: l.dia,
		tipo: l.tipo.trim() || 'Treino',
		km: Number.isFinite(km) && km > 0 ? km : null,
		pace: l.pace.trim() || null,
		detalhe: l.detalhe.trim(),
	}
}

function TreinoTreinadorEditor({
	provaId, semana, sessoes,
}: {
	provaId: string
	semana: number
	sessoes: CoachSession[]
}) {
	const submit = useSubmit()
	const [aberto, setAberto] = useState(false)
	const [texto, setTexto] = useState('')
	const [linhas, setLinhas] = useState<LinhaTreino[] | null>(null)
	const [interpretando, setInterpretando] = useState(false)
	const [erro, setErro] = useState<string | null>(null)

	// Fecha o editor quando o treino salvo muda de conteúdo (volta do loader).
	// Depende do valor, não da identidade do array — que muda a cada render.
	const chaveSessoes = JSON.stringify(sessoes)
	useEffect(() => {
		setLinhas(null)
		setAberto(false)
		setErro(null)
	}, [chaveSessoes])

	async function interpretar() {
		if (!texto.trim()) return
		setInterpretando(true)
		setErro(null)
		try {
			const resposta = await fetch('/api/interpretar-treino', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ texto }),
			})
			const dados = await resposta.json()
			if (!resposta.ok) {
				setErro(dados.error ?? 'Não consegui interpretar esse texto.')
				return
			}
			setLinhas((dados.sessoes as CoachSession[]).map(paraLinha))
		} catch {
			setErro('Falha de rede ao interpretar o texto.')
		} finally {
			setInterpretando(false)
		}
	}

	function atualizar(i: number, campo: keyof LinhaTreino, valor: string) {
		setLinhas(prev => prev && prev.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)))
	}

	function salvar() {
		if (!linhas) return
		submit(
			{
				_intent: 'salvarTreinoTreinador',
				provaId,
				semana: String(semana),
				textoOrigem: texto,
				sessoes: JSON.stringify(linhas.map(paraSessao)),
			},
			{ method: 'post' },
		)
	}

	function remover() {
		if (!confirm(`Remover o treino do treinador da semana ${semana}?`)) return
		submit(
			{ _intent: 'removerTreinoTreinador', provaId, semana: String(semana) },
			{ method: 'post' },
		)
	}

	// ── Já existe treino salvo e o editor está fechado ──
	if (sessoes.length > 0 && !aberto) {
		return (
			<div className='rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap'>
				<p className='text-xs text-sky-700 dark:text-sky-300'>
					<span className='font-medium'>
						{sessoes.length} {sessoes.length === 1 ? 'treino' : 'treinos'} do treinador
					</span>{' '}
					nesta semana ({sessoes.map(s => s.dia).join(', ')}). O Canova completou o resto.
				</p>
				<div className='flex gap-2'>
					<button
						onClick={() => { setLinhas(sessoes.map(paraLinha)); setAberto(true) }}
						className='inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground'
					>
						<HugeiconsIcon icon={Edit01Icon} className='size-3' />
						Editar
					</button>
					<button
						onClick={remover}
						className='inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:text-red-600'
					>
						<HugeiconsIcon icon={Delete02Icon} className='size-3' />
						Remover
					</button>
				</div>
			</div>
		)
	}

	// ── Editor fechado, sem treino salvo ──
	if (!aberto) {
		return (
			<button
				onClick={() => setAberto(true)}
				className='self-start inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors'
			>
				<HugeiconsIcon icon={WhistleIcon} className='size-3' />
				Lançar treino do treinador
			</button>
		)
	}

	// ── Editor aberto ──
	return (
		<div className='rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 flex flex-col gap-3'>
			<div className='flex items-center justify-between'>
				<p className='text-xs font-medium text-sky-700 dark:text-sky-300'>
					Treino do treinador · semana {semana}
				</p>
				<button
					onClick={() => { setAberto(false); setLinhas(null); setErro(null) }}
					className='text-xs text-muted-foreground hover:text-foreground'
				>
					Cancelar
				</button>
			</div>

			<div className='flex flex-col gap-2'>
				<textarea
					value={texto}
					onChange={e => setTexto(e.target.value)}
					rows={4}
					placeholder={'Cole aqui o treino como o treinador mandou. Ex:\nTer - 10km com 3x2km em 4:40\nQui - 8km leve\nSáb - 18km longo em 5:30'}
					className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/20'
				/>
				<Button
					size='sm'
					onClick={interpretar}
					disabled={interpretando || !texto.trim()}
					className='self-start'
				>
					<HugeiconsIcon icon={MagicWand01Icon} className='size-3.5' />
					{interpretando ? 'Interpretando…' : 'Interpretar'}
				</Button>
			</div>

			{erro && (
				<p className='text-xs text-red-600 dark:text-red-400'>{erro}</p>
			)}

			{linhas && (
				<div className='flex flex-col gap-2'>
					<p className='text-xs text-muted-foreground'>
						Confira e ajuste antes de salvar — o que ficar aqui é fixado no plano e o Canova
						preenche só os dias que sobrarem.
					</p>
					<div className='overflow-x-auto'>
						<table className='w-full text-sm'>
							<thead>
								<tr className='text-[10px] uppercase tracking-wide text-muted-foreground'>
									<th className='text-left pb-1 pr-2 font-medium'>Dia</th>
									<th className='text-left pb-1 pr-2 font-medium'>Tipo</th>
									<th className='text-left pb-1 pr-2 font-medium w-16'>Km</th>
									<th className='text-left pb-1 pr-2 font-medium w-20'>Pace</th>
									<th className='text-left pb-1 pr-2 font-medium'>Detalhe</th>
									<th className='pb-1 w-8' />
								</tr>
							</thead>
							<tbody>
								{linhas.map((linha, i) => (
									<tr key={i}>
										<td className='py-1 pr-2'>
											<select
												value={linha.dia}
												onChange={e => atualizar(i, 'dia', e.target.value)}
												className='rounded border border-border bg-background px-1.5 py-1 text-xs'
											>
												{DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
											</select>
										</td>
										<td className='py-1 pr-2'>
											<Input
												value={linha.tipo}
												onChange={e => atualizar(i, 'tipo', e.target.value)}
												className='h-8 text-xs'
											/>
										</td>
										<td className='py-1 pr-2'>
											<Input
												value={linha.km}
												onChange={e => atualizar(i, 'km', e.target.value)}
												placeholder='—'
												className='h-8 text-xs'
											/>
										</td>
										<td className='py-1 pr-2'>
											<Input
												value={linha.pace}
												onChange={e => atualizar(i, 'pace', e.target.value)}
												placeholder='4:40'
												className='h-8 text-xs'
											/>
										</td>
										<td className='py-1 pr-2'>
											<Input
												value={linha.detalhe}
												onChange={e => atualizar(i, 'detalhe', e.target.value)}
												className='h-8 text-xs'
											/>
										</td>
										<td className='py-1 text-center'>
											<button
												onClick={() => setLinhas(prev => prev && prev.filter((_, k) => k !== i))}
												aria-label={`Remover treino de ${linha.dia}`}
												className='text-muted-foreground hover:text-red-600'
											>
												<HugeiconsIcon icon={Delete02Icon} className='size-3.5' />
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className='flex items-center gap-2'>
						<button
							onClick={() => setLinhas(prev => [
								...(prev ?? []),
								{ dia: 'Seg', tipo: '', km: '', pace: '', detalhe: '' },
							])}
							className='inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground'
						>
							<HugeiconsIcon icon={Add01Icon} className='size-3' />
							Adicionar treino
						</button>
						<Button size='sm' onClick={salvar} disabled={linhas.length === 0}>
							Salvar no plano
						</Button>
					</div>
				</div>
			)}
		</div>
	)
}
