"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import type { AnaliseResult } from '~/routes/api.analisar-corrida'
import type { CorridaDataTableRow } from './corridas-columns'

type Props = {
	open: boolean
	onClose: () => void
	corrida: CorridaDataTableRow | null
	analise: AnaliseResult | null
	loading: boolean
	error: string | null
}

const AVALIACAO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
	excelente: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', label: 'Excelente' },
	bom:       { bg: 'bg-blue-500/10',    text: 'text-blue-700 dark:text-blue-400',       label: 'Bom' },
	regular:   { bg: 'bg-amber-500/10',   text: 'text-amber-700 dark:text-amber-400',      label: 'Regular' },
	ruim:      { bg: 'bg-red-500/10',     text: 'text-red-700 dark:text-red-400',          label: 'Ruim' },
}

function formatarDistancia(m: number): string {
	return `${(m / 1000).toFixed(2)} km`
}
function formatarPace(segPorKm: number | null): string {
	if (!segPorKm || segPorKm <= 0) return '—'
	const min = Math.floor(segPorKm / 60)
	const seg = Math.round(segPorKm % 60)
	return `${min}:${String(seg).padStart(2, '0')} /km`
}
function formatarTempo(seg: number): string {
	const h = Math.floor(seg / 3600)
	const m = Math.floor((seg % 3600) / 60)
	const s = seg % 60
	return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}min${String(s).padStart(2, '0')}s`
}

export function CorridaAnaliseSheet({ open, onClose, corrida, analise, loading, error }: Props) {
	const style = analise ? (AVALIACAO_STYLE[analise.avaliacao] ?? AVALIACAO_STYLE.regular) : null

	return (
		<Sheet open={open} onOpenChange={v => !v && onClose()}>
			<SheetContent className='w-full sm:max-w-lg overflow-y-auto flex flex-col gap-5'>
				<SheetHeader>
					<SheetTitle className='text-base font-semibold leading-tight pr-6'>
						{corrida?.nome ?? 'Análise Canova'}
					</SheetTitle>
					{corrida && (
						<div className='flex gap-3 text-xs text-muted-foreground flex-wrap'>
							<span>{formatarDistancia(corrida.distanciaMetros)}</span>
							<span>{formatarTempo(corrida.tempoMovimentoSeg)}</span>
							<span>{formatarPace(corrida.paceMedioSegPorKm)}</span>
							<span>{corrida.elevacaoGanhoMetros.toFixed(0)} m↑</span>
						</div>
					)}
				</SheetHeader>

				{loading && (
					<div className='flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground'>
						<div className='size-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin' />
						<p className='text-sm'>Analisando com Claude...</p>
					</div>
				)}

				{error && !loading && (
					<div className='rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400'>
						{error}
					</div>
				)}

				{analise && !loading && style && (
					<div className='flex flex-col gap-5'>
						{/* Tipo + avaliação */}
						<div className='flex items-start gap-3'>
							<div className='flex flex-col gap-1.5'>
								<span className='text-xs text-muted-foreground font-medium'>Tipo de sessão</span>
								<span className='text-lg font-semibold'>{analise.tipoSessao}</span>
							</div>
							<div className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${style.bg} ${style.text}`}>
								{style.label}
							</div>
						</div>

						{/* Resumo */}
						<div className='rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed'>
							{analise.resumo}
						</div>

						{/* Pontos positivos */}
						{analise.pontosPositivos.length > 0 && (
							<div className='flex flex-col gap-2'>
								<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Pontos positivos</p>
								<ul className='flex flex-col gap-1.5'>
									{analise.pontosPositivos.map((p, i) => (
										<li key={i} className='flex gap-2 text-sm text-emerald-700 dark:text-emerald-400'>
											<span className='mt-0.5 shrink-0'>✓</span>
											<span>{p}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Pontos de atenção */}
						{analise.pontosAtencao.length > 0 && (
							<div className='flex flex-col gap-2'>
								<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Pontos de atenção</p>
								<ul className='flex flex-col gap-1.5'>
									{analise.pontosAtencao.map((p, i) => (
										<li key={i} className='flex gap-2 text-sm text-amber-700 dark:text-amber-400'>
											<span className='mt-0.5 shrink-0'>⚠</span>
											<span>{p}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Alinhamento Canova */}
						<div className='flex flex-col gap-2'>
							<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Metodologia Canova</p>
							<p className='text-sm leading-relaxed'>{analise.alinhamentoCanova}</p>
						</div>

						{/* Recomendação */}
						<div className='rounded-2xl border border-foreground/10 bg-foreground/5 px-4 py-3 flex flex-col gap-1'>
							<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Próximo treino</p>
							<p className='text-sm leading-relaxed'>{analise.recomendacao}</p>
						</div>
					</div>
				)}
			</SheetContent>
		</Sheet>
	)
}
