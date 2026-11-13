import type { Route } from "./+types/maratonas";
import { Link, useLoaderData } from "react-router";
import {
	listarMaratonas,
	listarMaratonasParaGraficoBarras,
} from "~/models/corridas.server";
import { ExploradorMaratonas } from "~/components/maratonas/maratonas-explorador";
import { getMapboxToken } from "~/lib/mapbox.server";
import { formatarData, formatarPace, formatarTempo } from "~/lib/formatar-corrida";
import { LOCAIS_MARATONAS } from "~/lib/maratonas-locais";
import { MaratonasBarrasChart } from "~/components/corridas/maratonas-barras-chart";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Maratonas | Marcioscar" },
		{ name: "description", content: "Todas as maratonas corridas" },
	];
}

export async function loader({}: Route.LoaderArgs) {
	const [maratonas, maratonasGraficoBarras] = await Promise.all([
		listarMaratonas(),
		listarMaratonasParaGraficoBarras(15),
	]);

	return { maratonas, maratonasGraficoBarras, mapboxToken: getMapboxToken() };
}

function Tile({
	label,
	valor,
	nota,
}: {
	label: string;
	valor: string;
	nota: string;
}) {
	return (
		<div className='min-w-0 rounded-2xl border border-border bg-card px-4 py-3.5'>
			<p className='text-xs text-muted-foreground'>{label}</p>
			<p className='mt-1 text-2xl font-bold tabular-nums'>{valor}</p>
			<p className='mt-0.5 truncate text-xs text-muted-foreground'>{nota}</p>
		</div>
	);
}

export default function Maratonas() {
	const { maratonas, maratonasGraficoBarras, mapboxToken } = useLoaderData<typeof loader>();

	if (maratonas.length === 0) {
		return (
			<main className='grid w-full min-w-0 gap-4'>
				<h1 className='text-2xl font-bold'>Maratonas</h1>
				<p className='rounded-md border p-3 text-sm text-muted-foreground'>
					Nenhuma maratona (mais de 40 km) sincronizada ainda.
				</p>
			</main>
		);
	}

	const melhor = maratonas.reduce((a, b) =>
		b.tempoTotalSeg < a.tempoTotalSeg ? b : a,
	);
	const ultima = maratonas[0];
	const primeira = maratonas[maratonas.length - 1];
	const locais = maratonas.map((m) => LOCAIS_MARATONAS[m.stravaId]).filter(Boolean);
	const paises = new Set(locais.map((l) => l.paisId));
	const cidades = new Set(locais.map((l) => l.cidade));
	const kmTotais = maratonas.reduce((acc, m) => acc + m.distanciaMetros, 0) / 1000;

	return (
		<main className='grid w-full min-w-0 gap-4'>
			<h1 className='text-2xl font-bold'>Maratonas</h1>

			<section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
				<Tile
					label='Maratonas concluídas'
					valor={String(maratonas.length)}
					nota={`${Math.round(kmTotais).toLocaleString("pt-BR")} km em provas · desde ${new Date(primeira.dataInicioIso).getUTCFullYear()}`}
				/>
				<Tile
					label='Países'
					valor={String(paises.size)}
					nota={`${cidades.size} cidades diferentes`}
				/>
				<Tile
					label='Melhor tempo'
					valor={formatarTempo(melhor.tempoTotalSeg)}
					nota={`${melhor.nome} · ${formatarData(melhor.dataInicioIso)}`}
				/>
				<Tile
					label='Última maratona'
					valor={formatarTempo(ultima.tempoTotalSeg)}
					nota={`${ultima.nome} · ${formatarData(ultima.dataInicioIso)}`}
				/>
			</section>

			<section className='grid min-w-0 gap-2'>
				<h2 className='text-lg font-semibold'>Onde foram</h2>
				<ExploradorMaratonas maratonas={maratonas} mapboxToken={mapboxToken} />
			</section>

			<div className='w-full min-w-0'>
				<MaratonasBarrasChart maratonas={maratonasGraficoBarras} />
			</div>

			<section className='min-w-0 rounded-md border'>
				<div className='border-b px-4 py-3'>
					<h2 className='text-lg font-semibold'>Todas as maratonas</h2>
				</div>
				<div className='min-w-0 p-4'>
					<div className='min-w-0 overflow-hidden rounded-md border'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Data</TableHead>
									<TableHead>Prova</TableHead>
									<TableHead className='text-right'>Distância</TableHead>
									<TableHead className='text-right'>Tempo</TableHead>
									<TableHead className='text-right'>Pace médio</TableHead>
									<TableHead className='text-right'>Elevação</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{maratonas.map((m) => (
									<TableRow key={m.stravaId}>
										<TableCell className='tabular-nums'>
											{formatarData(m.dataInicioIso)}
										</TableCell>
										<TableCell>
											<Link
												to={`/corridas/${m.stravaId}`}
												className='font-medium underline-offset-4 hover:underline'>
												{m.nome}
											</Link>
											{m.stravaId === melhor.stravaId && (
												<span className='ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground'>
													Melhor tempo
												</span>
											)}
										</TableCell>
										<TableCell className='text-right tabular-nums'>
											{(m.distanciaMetros / 1000).toFixed(2)} km
										</TableCell>
										<TableCell className='text-right font-medium tabular-nums'>
											{formatarTempo(m.tempoTotalSeg)}
										</TableCell>
										<TableCell className='text-right tabular-nums'>
											{formatarPace(m.paceMedioSegPorKm)}
										</TableCell>
										<TableCell className='text-right tabular-nums'>
											{m.elevacaoGanhoMetros.toFixed(0)} m
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			</section>
		</main>
	);
}
