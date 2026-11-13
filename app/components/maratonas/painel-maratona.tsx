"use client";

import * as React from "react";
import { Link } from "react-router";
import { ExternalLink, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CorridaPaceDesnivelChart } from "~/components/corridas/corrida-pace-desnivel-chart";
import { CompararMaratonas } from "./comparar-maratonas";
import { RotaDesenho } from "./rota-desenho";
import { analisarProva } from "~/lib/maratona-analise";
import {
	formatarData,
	formatarDiferenca,
	formatarPace,
	formatarTempo,
} from "~/lib/formatar-corrida";
import { LOCAIS_MARATONAS } from "~/lib/maratonas-locais";
import type { BuscarDetalhesResponse } from "~/types/analise";
import type { MaratonaDetalhada } from "~/types/maratonas";

// mapbox-gl só carrega quando a pessoa pede o mapa real
const CorridaRotaMap = React.lazy(async () => {
	const mod = await import("~/components/corridas/corrida-rota-map");
	return { default: mod.CorridaRotaMap };
});

type Foto = { url: string; legenda: string | null };
const cacheFotos = new Map<number, Foto[]>();

type Props = {
	maratona: MaratonaDetalhada;
	numero: number;
	totalMaratonas: number;
	melhor: MaratonaDetalhada;
	todas: MaratonaDetalhada[];
	mapboxToken: string | null;
	onFechar: () => void;
	onDetalhes: (stravaId: number, detalhes: Partial<MaratonaDetalhada>) => void;
};

function Metrica({
	rotulo,
	valor,
	nota,
}: {
	rotulo: string;
	valor: string;
	nota?: string | null;
}) {
	return (
		<div className='min-w-0 rounded-xl border border-border bg-card px-3 py-2.5'>
			<p className='text-[11px] text-muted-foreground'>{rotulo}</p>
			<p className='mt-0.5 text-lg font-bold tabular-nums leading-tight'>{valor}</p>
			{nota && <p className='mt-0.5 truncate text-xs text-muted-foreground'>{nota}</p>}
		</div>
	);
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
	return (
		<section className='flex flex-col gap-2'>
			<h3 className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
				{titulo}
			</h3>
			{children}
		</section>
	);
}

function LeituraDaProva({ maratona }: { maratona: MaratonaDetalhada }) {
	const leitura = maratona.splits ? analisarProva(maratona.splits) : null;
	if (!leitura) return null;

	const base = leitura.paceBaseSeg ? formatarPace(leitura.paceBaseSeg) : null;
	const texto =
		leitura.tipo === "negativo"
			? "Segunda metade mais rápida que a primeira: ritmo negativo."
			: leitura.tipo === "parelho"
				? "Ritmo bem distribuído: as duas metades ficaram a menos de 2,5% uma da outra."
				: leitura.kmQueda
					? `Perdeu ritmo na segunda metade. A queda se sustentou a partir do km ${leitura.kmQueda}${base ? ` (referência: ${base} nos km 5 a 20)` : ""}.`
					: "Perdeu ritmo na segunda metade, mas de forma gradual, sem uma quebra clara.";

	return (
		<div className='rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm'>
			<p className='flex flex-wrap items-baseline gap-x-4 gap-y-1 tabular-nums'>
				<span>
					<span className='text-muted-foreground'>1ª metade </span>
					<strong>{formatarTempo(leitura.primeiraMetadeSeg)}</strong>
				</span>
				<span>
					<span className='text-muted-foreground'>2ª metade </span>
					<strong>{formatarTempo(leitura.segundaMetadeSeg)}</strong>
				</span>
				<span className='text-muted-foreground'>
					({formatarDiferenca(leitura.diferencaSeg)})
				</span>
			</p>
			<p className='mt-1 text-muted-foreground'>{texto}</p>
			<p className='mt-1 text-xs text-muted-foreground'>Tempo em movimento, pelos splits do Strava.</p>
		</div>
	);
}

function FotosDaProva({ maratona }: { maratona: MaratonaDetalhada }) {
	const { stravaId, totalFotos, nome } = maratona;
	const [fotos, setFotos] = React.useState<Foto[] | null>(cacheFotos.get(stravaId) ?? null);
	const [erro, setErro] = React.useState(false);

	React.useEffect(() => {
		if (totalFotos === 0 || stravaId <= 0) return;
		const emCache = cacheFotos.get(stravaId);
		if (emCache) {
			setFotos(emCache);
			return;
		}

		let cancelado = false;
		setFotos(null);
		setErro(false);
		fetch(`/api/fotos-corrida?stravaId=${stravaId}`)
			.then(async (res) => {
				if (!res.ok) throw new Error(String(res.status));
				return (await res.json()) as { fotos: Foto[] };
			})
			.then(({ fotos: lista }) => {
				cacheFotos.set(stravaId, lista);
				if (!cancelado) setFotos(lista);
			})
			.catch(() => {
				if (!cancelado) setErro(true);
			});
		return () => {
			cancelado = true;
		};
	}, [stravaId, totalFotos]);

	if (totalFotos === 0 || stravaId <= 0) return null;

	return (
		<Secao titulo={`Fotos da prova (${totalFotos})`}>
			{erro ? (
				<p className='text-sm text-muted-foreground'>Não foi possível carregar as fotos do Strava.</p>
			) : fotos === null ? (
				<p className='text-sm text-muted-foreground'>Carregando fotos…</p>
			) : (
				<div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'>
					{fotos.map((foto) => (
						<a
							key={foto.url}
							href={foto.url}
							target='_blank'
							rel='noreferrer'
							className='block overflow-hidden rounded-lg border border-border'>
							<img
								src={foto.url}
								alt={foto.legenda ?? `Foto da ${nome}`}
								loading='lazy'
								className='aspect-[4/3] w-full object-cover transition-transform hover:scale-[1.03]'
							/>
						</a>
					))}
				</div>
			)}
		</Secao>
	);
}

export function PainelMaratona({
	maratona,
	numero,
	totalMaratonas,
	melhor,
	todas,
	mapboxToken,
	onFechar,
	onDetalhes,
}: Props) {
	const local = LOCAIS_MARATONAS[maratona.stravaId];
	const [mapaReal, setMapaReal] = React.useState(false);
	const [carregando, setCarregando] = React.useState(false);
	const [erroDetalhes, setErroDetalhes] = React.useState<string | null>(null);
	const [compararId, setCompararId] = React.useState<number | null>(null);

	// ao trocar de prova, o painel recomeça limpo
	React.useEffect(() => {
		setMapaReal(false);
		setCompararId(null);
		setErroDetalhes(null);
	}, [maratona.stravaId]);

	React.useEffect(() => {
		function aoTeclar(e: KeyboardEvent) {
			if (e.key === "Escape") onFechar();
		}
		window.addEventListener("keydown", aoTeclar);
		return () => window.removeEventListener("keydown", aoTeclar);
	}, [onFechar]);

	async function carregarDoStrava() {
		setCarregando(true);
		setErroDetalhes(null);
		try {
			const res = await fetch("/api/buscar-splits", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stravaId: maratona.stravaId }),
			});
			if (!res.ok) throw new Error(String(res.status));
			const dados = (await res.json()) as BuscarDetalhesResponse;
			onDetalhes(maratona.stravaId, {
				splits: dados.splits.length > 0 ? dados.splits : null,
				calorias: dados.calorias ?? null,
				temperaturaMedia: dados.temperaturaMedia ?? null,
			});
		} catch {
			setErroDetalhes("Não foi possível buscar os detalhes no Strava. Tente de novo.");
		} finally {
			setCarregando(false);
		}
	}

	const diferencaMelhor = maratona.tempoTotalSeg - melhor.tempoTotalSeg;
	const diasEmMovimento = maratona.tempoMovimentoSeg;
	const temSplits = Boolean(maratona.splits && maratona.splits.length > 1);
	const comparaveis = todas.filter(
		(m) => m.stravaId !== maratona.stravaId && m.splits && m.splits.length > 1,
	);
	const comparada = comparaveis.find((m) => m.stravaId === compararId) ?? null;
	const rotuloDe = (m: MaratonaDetalhada) => {
		const cidade = LOCAIS_MARATONAS[m.stravaId]?.cidade ?? m.nome;
		return `${cidade} ${new Date(m.dataInicioIso).getUTCFullYear()}`;
	};

	return (
		<section
			aria-label={`Detalhes: ${maratona.nome}`}
			className='flex flex-col gap-5 rounded-xl border border-border bg-card p-4 md:p-5'>
			<header className='flex flex-wrap items-start justify-between gap-3'>
				<div className='min-w-0'>
					<h2 className='text-xl font-bold leading-tight'>{maratona.nome}</h2>
					<p className='mt-0.5 text-sm text-muted-foreground'>
						{formatarData(maratona.dataInicioIso)} · {numero}ª de {totalMaratonas} maratonas
						{local ? ` · ${local.cidade}, ${local.pais}` : ""}
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<Button variant='outline' size='sm' render={<Link to={`/corridas/${maratona.stravaId}`} />}>
						<ExternalLink size={14} />
						Abrir corrida
					</Button>
					<Button variant='ghost' size='icon-sm' aria-label='Fechar detalhes' onClick={onFechar}>
						<X size={16} />
					</Button>
				</div>
			</header>

			<div className='grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]'>
				<div className='flex flex-col gap-2'>
					{maratona.summaryPolyline ? (
						<>
							<RotaDesenho polyline={maratona.summaryPolyline} titulo={maratona.nome} />
							<Button
								variant='outline'
								size='sm'
								disabled={!mapboxToken}
								title={mapboxToken ? undefined : "Token do Mapbox não configurado"}
								aria-expanded={mapaReal}
								onClick={() => setMapaReal((v) => !v)}>
								{mapaReal ? "Esconder o mapa real" : "Ver no mapa real, com os km"}
							</Button>
						</>
					) : (
						<p className='rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>
							Sem percurso guardado: esta prova foi importada só com nome e tempo.
						</p>
					)}
				</div>

				<div className='grid content-start grid-cols-2 gap-2 sm:grid-cols-3'>
					<Metrica
						rotulo='Tempo'
						valor={formatarTempo(maratona.tempoTotalSeg)}
						nota={
							Math.abs(maratona.tempoTotalSeg - diasEmMovimento) > 10
								? `${formatarTempo(diasEmMovimento)} em movimento`
								: null
						}
					/>
					<Metrica rotulo='Pace médio' valor={formatarPace(maratona.paceMedioSegPorKm)} />
					<Metrica
						rotulo='Contra o melhor tempo'
						valor={diferencaMelhor === 0 ? "Seu melhor" : formatarDiferenca(diferencaMelhor)}
						nota={diferencaMelhor === 0 ? null : `vs ${rotuloDe(melhor)}`}
					/>
					{maratona.frequenciaMedia ? (
						<Metrica
							rotulo='Frequência cardíaca'
							valor={`${Math.round(maratona.frequenciaMedia)} bpm`}
							nota={maratona.frequenciaMaxima ? `máx ${Math.round(maratona.frequenciaMaxima)} bpm` : null}
						/>
					) : null}
					{maratona.calorias ? (
						<Metrica rotulo='Calorias' valor={`${maratona.calorias.toLocaleString("pt-BR")} kcal`} />
					) : null}
					{maratona.temperaturaMedia !== null ? (
						<Metrica rotulo='Temperatura' valor={`${Math.round(maratona.temperaturaMedia)} °C`} />
					) : null}
					{maratona.elevMinima !== null && maratona.elevMaxima !== null ? (
						<Metrica
							rotulo='Altitude'
							valor={`${Math.round(maratona.elevMinima)}–${Math.round(maratona.elevMaxima)} m`}
						/>
					) : null}
					{maratona.elevacaoGanhoMetros > 0 ? (
						<Metrica rotulo='Subida acumulada' valor={`${Math.round(maratona.elevacaoGanhoMetros)} m`} />
					) : null}
				</div>
			</div>

			{mapaReal && maratona.summaryPolyline && (
				<React.Suspense
					fallback={
						<div className='flex h-[280px] items-center justify-center rounded-md border text-sm text-muted-foreground'>
							Carregando mapa…
						</div>
					}>
					<CorridaRotaMap
						mapboxToken={mapboxToken}
						polyline={maratona.summaryPolyline}
						distanciaMetros={maratona.distanciaMetros}
						splits={maratona.splits}
					/>
				</React.Suspense>
			)}

			<Secao titulo='Ritmo km a km'>
				{temSplits && maratona.splits ? (
					<div className='flex flex-col gap-3'>
						<LeituraDaProva maratona={maratona} />
						<CorridaPaceDesnivelChart splits={maratona.splits} />
					</div>
				) : maratona.stravaId > 0 ? (
					<div className='flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3'>
						<p className='text-sm text-muted-foreground'>
							Splits ainda não carregados para esta prova.
						</p>
						<Button variant='outline' size='sm' disabled={carregando} onClick={carregarDoStrava}>
							{carregando ? "Buscando…" : "Buscar do Strava"}
						</Button>
						{erroDetalhes && <p className='text-sm text-perigo'>{erroDetalhes}</p>}
					</div>
				) : (
					<p className='rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground'>
						Sem ritmo km a km: esta prova foi importada sem os detalhes do Strava.
					</p>
				)}
			</Secao>

			<FotosDaProva maratona={maratona} />

			{temSplits && comparaveis.length > 0 && (
				<Secao titulo='Comparar com outra maratona'>
					<select
						aria-label='Comparar com outra maratona'
						value={compararId ?? ""}
						onChange={(e) => setCompararId(e.target.value ? Number(e.target.value) : null)}
						className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm sm:w-72'>
						<option value=''>Escolha uma prova…</option>
						{comparaveis.map((m) => (
							<option key={m.stravaId} value={m.stravaId}>
								{rotuloDe(m)} · {formatarTempo(m.tempoTotalSeg)}
							</option>
						))}
					</select>
					{comparada && (
						<CompararMaratonas
							a={maratona}
							b={comparada}
							rotuloA={rotuloDe(maratona)}
							rotuloB={rotuloDe(comparada)}
						/>
					)}
				</Secao>
			)}
		</section>
	);
}
