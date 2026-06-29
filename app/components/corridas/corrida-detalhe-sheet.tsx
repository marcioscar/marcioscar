"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Button } from '~/components/ui/button'
import type { AnaliseResult, SplitMetric } from '~/types/analise'
import type { CorridaDataTableRow } from './corridas-columns'

type Props = {
	open: boolean
	onClose: () => void
	corrida: CorridaDataTableRow | null
	splits: SplitMetric[] | null
	analise: AnaliseResult | null
	loading: boolean
	error: string | null
	onAnalisar: () => void
	onReanalisar: () => void
	onBuscarSplits: () => void
}

const AVALIACAO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
	excelente: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', label: 'Excelente' },
	bom:       { bg: 'bg-blue-500/10',    text: 'text-blue-700 dark:text-blue-400',       label: 'Bom' },
	regular:   { bg: 'bg-amber-500/10',   text: 'text-amber-700 dark:text-amber-400',      label: 'Regular' },
	ruim:      { bg: 'bg-red-500/10',     text: 'text-red-700 dark:text-red-400',          label: 'Ruim' },
}

function formatarDistancia(m: number) { return `${(m / 1000).toFixed(2)} km` }
function formatarTempo(seg: number) {
	const h = Math.floor(seg / 3600); const m = Math.floor((seg % 3600) / 60); const s = seg % 60
	return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}min${String(s).padStart(2, '0')}s`
}
function formatarPace(segPorKm: number | null) {
	if (!segPorKm || segPorKm <= 0) return '—'
	return `${Math.floor(segPorKm / 60)}:${String(Math.round(segPorKm % 60)).padStart(2, '0')} /km`
}
function mpsParaPace(mps: number) {
	if (!mps || mps <= 0) return '—'
	const spk = 1000 / mps
	return `${Math.floor(spk / 60)}:${String(Math.round(spk % 60)).padStart(2, '0')}`
}
function categoria(m: number) {
	const km = m / 1000
	if (km > 40) return 'Maratona'
	if (km >= 20 && km <= 23) return 'Meia Maratona'
	if (km >= 10 && km < 20) return '10–20 km'
	if (km < 10) return 'Curta'
	return null
}

export function CorridaDetalheSheet({ open, onClose, corrida, splits, analise, loading, error, onAnalisar, onReanalisar, onBuscarSplits }: Props) {
	const style = analise ? (AVALIACAO_STYLE[analise.avaliacao] ?? AVALIACAO_STYLE.regular) : null
	const analisadaEm = corrida?.analisadaEm
		? new Date(corrida.analisadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
		: null
	const cat = corrida ? categoria(corrida.distanciaMetros) : null

	return (
		<Sheet open={open} onOpenChange={v => !v && onClose()}>
			<SheetContent className='w-full sm:max-w-xl overflow-y-auto flex flex-col gap-6 pb-10'>

				{/* ── CABEÇALHO ── */}
				<SheetHeader className='gap-1'>
					<SheetTitle className='text-base font-semibold leading-tight pr-6'>
						{corrida?.nome ?? '—'}
					</SheetTitle>
					<p className='text-xs text-muted-foreground'>
						{corrida ? new Date(corrida.dataInicio).toLocaleString('pt-BR') : ''}
					</p>
				</SheetHeader>

				{corrida && (
					<>
						{/* ── MÉTRICAS ── */}
						<div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
							{[
								{ label: 'Distância', val: formatarDistancia(corrida.distanciaMetros) },
								{ label: 'Tempo', val: formatarTempo(corrida.tempoMovimentoSeg) },
								{ label: 'Pace médio', val: formatarPace(corrida.paceMedioSegPorKm) },
								{ label: 'Elevação', val: `${corrida.elevacaoGanhoMetros.toFixed(0)} m↑` },
								...(cat ? [{ label: 'Categoria', val: cat }] : []),
							].map(({ label, val }) => (
								<div key={label} className='rounded-xl border border-border bg-muted/30 px-3 py-2'>
									<p className='text-[10px] font-medium text-muted-foreground uppercase tracking-wide'>{label}</p>
									<p className='text-sm font-semibold mt-0.5'>{val}</p>
								</div>
							))}
						</div>

						{/* ── SPLITS ── */}
						{!splits && !loading && (
							<div className='flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3'>
								<p className='text-sm text-muted-foreground'>Splits por km não carregados</p>
								<Button variant='outline' size='sm' className='text-xs h-7' onClick={onBuscarSplits}>
									Buscar splits
								</Button>
							</div>
						)}

						{splits && splits.length > 0 && (
							<div className='flex flex-col gap-2'>
								<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
									Splits por km
								</p>
								<div className='overflow-x-auto rounded-xl border border-border'>
									<table className='w-full text-xs'>
										<thead>
											<tr className='border-b border-border bg-muted/30'>
												<th className='text-left px-3 py-2 font-medium text-muted-foreground'>Km</th>
												<th className='text-left px-3 py-2 font-medium text-muted-foreground'>Pace</th>
												<th className='text-left px-3 py-2 font-medium text-muted-foreground'>FC</th>
												<th className='text-left px-3 py-2 font-medium text-muted-foreground'>Elev.</th>
											</tr>
										</thead>
										<tbody className='divide-y divide-border'>
											{splits.map((s) => {
												const paceStr = mpsParaPace(s.average_speed)
												const elevStr = s.elevation_difference >= 0
													? `+${s.elevation_difference.toFixed(0)}m`
													: `${s.elevation_difference.toFixed(0)}m`
												const elevColor = s.elevation_difference > 10
													? 'text-orange-600 dark:text-orange-400'
													: s.elevation_difference < -10
													? 'text-emerald-600 dark:text-emerald-400'
													: 'text-muted-foreground'
												return (
													<tr key={s.split} className='hover:bg-muted/20 transition-colors'>
														<td className='px-3 py-1.5 font-medium'>{s.split}</td>
														<td className='px-3 py-1.5 font-mono tabular-nums'>{paceStr}</td>
														<td className='px-3 py-1.5 text-muted-foreground'>
															{s.average_heartrate ? Math.round(s.average_heartrate) : '—'}
														</td>
														<td className={`px-3 py-1.5 ${elevColor}`}>{elevStr}</td>
													</tr>
												)
											})}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{/* ── ANÁLISE CANOVA ── */}
						<div className='flex flex-col gap-4'>
							<div className='flex items-center justify-between'>
								<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
									Análise Canova
								</p>
								{!analise && !loading && (
									<Button size='sm' onClick={onAnalisar} className='text-xs h-7'>
										✦ Analisar com IA
									</Button>
								)}
							</div>

							{loading && (
								<div className='flex items-center gap-3 py-6 text-muted-foreground'>
									<div className='size-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin shrink-0' />
									<p className='text-sm'>Buscando splits e analisando com Claude...</p>
								</div>
							)}

							{error && !loading && (
								<div className='rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400'>
									{error}
								</div>
							)}

							{analise && !loading && style && (
								<div className='flex flex-col gap-4'>
									<div className='flex items-start gap-3'>
										<div className='flex flex-col gap-1'>
											<span className='text-xs text-muted-foreground'>Tipo de sessão</span>
											<span className='font-semibold'>{analise.tipoSessao}</span>
										</div>
										<div className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${style.bg} ${style.text}`}>
											{style.label}
										</div>
									</div>

									<div className='rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed'>
										{analise.resumo}
									</div>

									{analise.pontosPositivos.length > 0 && (
										<ul className='flex flex-col gap-1.5'>
											{analise.pontosPositivos.map((p, i) => (
												<li key={i} className='flex gap-2 text-sm text-emerald-700 dark:text-emerald-400'>
													<span className='mt-0.5 shrink-0'>✓</span><span>{p}</span>
												</li>
											))}
										</ul>
									)}

									{analise.pontosAtencao.length > 0 && (
										<ul className='flex flex-col gap-1.5'>
											{analise.pontosAtencao.map((p, i) => (
												<li key={i} className='flex gap-2 text-sm text-amber-700 dark:text-amber-400'>
													<span className='mt-0.5 shrink-0'>⚠</span><span>{p}</span>
												</li>
											))}
										</ul>
									)}

									<div className='flex flex-col gap-1'>
										<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Metodologia Canova</p>
										<p className='text-sm leading-relaxed'>{analise.alinhamentoCanova}</p>
									</div>

									<div className='rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3'>
										<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1'>Próximo treino</p>
										<p className='text-sm leading-relaxed'>{analise.recomendacao}</p>
									</div>

									<div className='flex items-center justify-between pt-1 border-t border-border'>
										{analisadaEm && (
											<p className='text-xs text-muted-foreground'>Analisado em {analisadaEm}</p>
										)}
										<Button variant='outline' size='sm' onClick={onReanalisar} className='ml-auto text-xs h-7'>
											Re-analisar
										</Button>
									</div>
								</div>
							)}
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	)
}
