"use client";

import * as React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	MapaMundiMaratonas,
	montarPontos,
	ordenarParaViagem,
} from "./mapa-mundi";
import { PainelMaratona } from "./painel-maratona";
import { formatarTempo } from "~/lib/formatar-corrida";
import type { MaratonaDetalhada } from "~/types/maratonas";

type Props = {
	maratonas: MaratonaDetalhada[];
	mapboxToken: string | null;
};

const ATRASO_PRIMEIRO_PASSO_MS = 500;
const ATRASO_ENTRE_PASSOS_MS = 1400;

export function ExploradorMaratonas({ maratonas, mapboxToken }: Props) {
	const [detalhes, setDetalhes] = React.useState<Record<number, Partial<MaratonaDetalhada>>>({});
	const [selecionadaId, setSelecionadaId] = React.useState<number | null>(null);
	/** índice cronológico da viagem: null = mapa completo, −1 = recém-iniciada */
	const [passo, setPasso] = React.useState<number | null>(null);
	const [tocando, setTocando] = React.useState(false);
	const painelRef = React.useRef<HTMLDivElement | null>(null);

	// detalhes buscados no Strava durante a visita se somam aos que vieram do servidor
	const lista = React.useMemo(
		() => maratonas.map((m) => ({ ...m, ...detalhes[m.stravaId] })),
		[maratonas, detalhes],
	);
	const cronologica = React.useMemo(
		() => [...lista].sort((a, b) => a.dataInicioIso.localeCompare(b.dataInicioIso)),
		[lista],
	);
	const numeroPorId = React.useMemo(
		() => new Map(cronologica.map((m, i) => [m.stravaId, i + 1])),
		[cronologica],
	);
	const melhor = React.useMemo(
		() => lista.reduce((a, b) => (b.tempoTotalSeg < a.tempoTotalSeg ? b : a)),
		[lista],
	);
	const viagem = React.useMemo(
		() => ordenarParaViagem(montarPontos(lista).pontos),
		[lista],
	);
	const ultimoPasso = viagem.length - 1;
	const selecionada = lista.find((m) => m.stravaId === selecionadaId) ?? null;

	// reprodução: um passo por vez, parando no fim
	React.useEffect(() => {
		if (!tocando || passo === null) return;
		const atraso = passo < 0 ? ATRASO_PRIMEIRO_PASSO_MS : ATRASO_ENTRE_PASSOS_MS;
		const id = window.setTimeout(() => {
			if (passo >= ultimoPasso) {
				setTocando(false);
				return;
			}
			setPasso(passo + 1);
		}, atraso);
		return () => window.clearTimeout(id);
	}, [tocando, passo, ultimoPasso]);

	// o painel abre embaixo do mapa: traz para a tela quando for escolhido
	React.useEffect(() => {
		if (selecionadaId !== null) {
			painelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}, [selecionadaId]);

	const selecionar = React.useCallback((id: number) => {
		setTocando(false);
		setPasso(null);
		setSelecionadaId(id);
	}, []);

	const fecharPainel = React.useCallback(() => setSelecionadaId(null), []);

	const registrarDetalhes = React.useCallback(
		(stravaId: number, novos: Partial<MaratonaDetalhada>) =>
			setDetalhes((atual) => ({ ...atual, [stravaId]: { ...atual[stravaId], ...novos } })),
		[],
	);

	function iniciarViagem() {
		setSelecionadaId(null);
		setPasso(-1);
		setTocando(true);
	}

	function alternarReproducao() {
		if (tocando) {
			setTocando(false);
		} else if (passo === null || passo >= ultimoPasso) {
			iniciarViagem();
		} else {
			setTocando(true);
		}
	}

	function sairDaViagem() {
		setTocando(false);
		setPasso(null);
	}

	const emViagem = passo !== null;
	const noFim = emViagem && passo >= ultimoPasso && !tocando;
	const atual = emViagem && passo >= 0 ? viagem[passo] : null;
	const kmAcumulados = emViagem
		? viagem.slice(0, passo + 1).reduce((acc, p) => acc + p.maratona.distanciaMetros, 0) / 1000
		: 0;
	const paisesAteAqui = emViagem
		? new Set(
				viagem
					.slice(0, passo + 1)
					.map((p) => p.paisId)
					.filter(Boolean),
			).size
		: 0;

	const rotuloBotao = tocando
		? "Pausar"
		: noFim
			? "Rever a viagem"
			: emViagem
				? "Continuar"
				: "Reproduzir viagem";
	const IconeBotao = tocando ? Pause : noFim ? RotateCcw : Play;

	return (
		<div className='flex min-w-0 flex-col gap-3'>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<p className='text-sm text-muted-foreground'>
					{emViagem
						? "Viagem no tempo: as provas aparecem na ordem em que foram corridas."
						: "Clique numa cidade para ver o percurso, o ritmo km a km e as fotos da prova."}
				</p>
				<div className='flex flex-wrap items-center gap-2'>
					{emViagem && (
						<>
							<input
								type='range'
								min={0}
								max={Math.max(ultimoPasso, 0)}
								value={Math.max(passo, 0)}
								aria-label='Ponto da viagem'
								onChange={(e) => {
									setTocando(false);
									setPasso(Number(e.target.value));
								}}
								className='w-32 accent-[var(--paleta-4)]'
							/>
							<Button variant='ghost' size='sm' onClick={sairDaViagem}>
								Mostrar tudo
							</Button>
						</>
					)}
					<Button variant='outline' size='sm' onClick={alternarReproducao}>
						<IconeBotao size={14} />
						{rotuloBotao}
					</Button>
				</div>
			</div>

			<MapaMundiMaratonas
				maratonas={lista}
				selecionadaId={selecionadaId}
				onSelecionar={selecionar}
				passoViagem={passo}
			/>

			<div aria-live='polite' className='min-h-5 text-sm'>
				{atual ? (
					<p className='flex flex-wrap items-baseline gap-x-3 gap-y-0.5'>
						<strong className='tabular-nums'>
							{new Date(atual.maratona.dataInicioIso).getUTCFullYear()}
						</strong>
						<span>
							{atual.local.cidade} · {formatarTempo(atual.maratona.tempoTotalSeg)}
						</span>
						<span className='text-muted-foreground'>
							{numeroPorId.get(atual.maratona.stravaId)}ª maratona · {Math.round(kmAcumulados)} km
							em provas · {paisesAteAqui} {paisesAteAqui === 1 ? "país" : "países"}
						</span>
					</p>
				) : null}
			</div>

			{selecionada && (
				<div ref={painelRef} className='scroll-mt-4'>
					<PainelMaratona
						maratona={selecionada}
						numero={numeroPorId.get(selecionada.stravaId) ?? 0}
						totalMaratonas={lista.length}
						melhor={melhor}
						todas={lista}
						mapboxToken={mapboxToken}
						onFechar={fecharPainel}
						onDetalhes={registrarDetalhes}
					/>
				</div>
			)}
		</div>
	);
}
