import { useLoaderData } from "react-router";
import type { Route } from "./+types/vpontos";
import { montarPainelVponto } from "~/models/vdot.server";
import { ZONAS_RITMO } from "~/lib/zonas-pace";
import { formatarPace, ritmosChave } from "~/lib/vdot";
import { formatarData } from "~/lib/formatar-corrida";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "VPONTO e zonas | Marcioscar" },
		{ name: "description", content: "VPONTO (Jack Daniels) e as zonas de ritmo derivadas dele" },
	];
}

export async function loader({}: Route.LoaderArgs) {
	return montarPainelVponto();
}

const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");
const fmtTempo = (seg: number) => {
	const t = Math.round(seg);
	const h = Math.floor(t / 3600);
	const m = Math.floor((t % 3600) / 60);
	const s = t % 60;
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

function Cartao({ titulo, children, nota }: { titulo: string; children: React.ReactNode; nota?: string }) {
	return (
		<section className="rounded-xl border bg-card p-4 sm:p-5">
			<h2 className="text-base font-semibold">{titulo}</h2>
			{nota && <p className="mt-1 text-sm text-muted-foreground">{nota}</p>}
			<div className="mt-3 overflow-x-auto">{children}</div>
		</section>
	);
}

export default function VpontosPage() {
	const p = useLoaderData<typeof loader>();
	const k = ritmosChave(p.atual);
	const chave: { letra: string; nome: string; valor: string; uso: string }[] = [
		{ letra: "F", nome: "Fácil", valor: `${formatarPace(k.F)} /km`, uso: "rodagens e longões" },
		{ letra: "M", nome: "Maratona", valor: `${formatarPace(k.M)} /km`, uso: "blocos em ritmo de prova de maratona" },
		{ letra: "L", nome: "Limiar", valor: `${formatarPace(k.L)} /km`, uso: "corridas ritmadas e cruise intervals" },
		{ letra: "I", nome: "Intervalado", valor: `${formatarPace(k.I)} /km`, uso: "tiros de 3 a 5 min (VO2 máx)" },
		{ letra: "R", nome: "Repetição", valor: `${Math.round(k.R400)} s / 400 m`, uso: "tiros curtos e strides" },
	];

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
			<header>
				<h1 className="text-2xl font-bold">VPONTO e zonas de ritmo</h1>
				<p className="text-sm text-muted-foreground">
					Método de Jack Daniels: um número que resume a sua forma e de onde saem todas as zonas.
				</p>
			</header>

			<section className="grid gap-3 sm:grid-cols-3">
				<div className="rounded-xl border bg-card p-4">
					<div className="text-sm text-muted-foreground">VPONTO em uso</div>
					<div className="text-4xl font-extrabold">{p.atual}</div>
					<div className="text-xs text-muted-foreground">
						desde {formatarData(`${p.desde}T12:00:00`)} · há {p.diasDesdeMudanca} dias
					</div>
				</div>
				<div className="rounded-xl border bg-card p-4">
					<div className="text-sm text-muted-foreground">Melhor prova recente (120 dias)</div>
					<div className="text-4xl font-extrabold">{p.melhorProvaRecente ? fmt1(p.melhorProvaRecente) : "—"}</div>
					<div className="text-xs text-muted-foreground">pelo tempo total e pela distância (a oficial, se o relógio mediu até 1,5% a mais)</div>
				</div>
				<div className="rounded-xl border bg-card p-4">
					<div className="text-sm text-muted-foreground">Estimativa pela FC dos treinos</div>
					<div className="text-4xl font-extrabold">{p.medianaFc ? fmt1(p.medianaFc) : "—"}</div>
					<div className="text-xs text-muted-foreground">mediana de {p.porFc.length} corridas · FC máx. {p.fcMaxima}</div>
				</div>
			</section>

			<section
				className={`rounded-xl border p-4 text-sm ${p.sugestao ? "border-amber-500/50 bg-amber-500/10" : "bg-card text-muted-foreground"}`}
			>
				{p.sugestao ? (
					<>
						<strong>Sugestão: VPONTO {p.sugestao.vponto}.</strong> {p.sugestao.texto} Para aplicar, é só pedir: as zonas do site, do
						app e das análises mudam juntas.
					</>
				) : (
					<>
						Nenhuma mudança sugerida. O livro recomenda manter o mesmo VPONTO por 3 a 6 semanas e só mudar com uma prova melhor, ou
						com treinos ficando mais fáceis no mesmo ritmo.
					</>
				)}
			</section>

			<Cartao titulo="Zonas de ritmo (derivadas do VPONTO)" nota="Z2 e Z3 vêm do %VO2 máx de Daniels; os ritmos-chave abaixo são os valores exatos da tabela do livro.">
				<table className="w-full min-w-[34rem] text-sm">
					<thead className="text-left text-muted-foreground">
						<tr>
							<th className="py-1 pr-3">Zona</th>
							<th className="pr-3">Pace</th>
							<th className="pr-3">km/h</th>
							<th>Uso</th>
						</tr>
					</thead>
					<tbody>
						{ZONAS_RITMO.map((z) => (
							<tr key={z.id} className="border-t align-top">
								<td className="py-1.5 pr-3 font-medium">
									{z.id} {z.nome}
								</td>
								<td className="pr-3 tabular-nums">
									{formatarPace(z.lentoSeg)}–{formatarPace(z.rapidoSeg)}
								</td>
								<td className="pr-3 tabular-nums">
									{z.kmh[0].toFixed(1)}–{z.kmh[1].toFixed(1)}
								</td>
								<td className="text-muted-foreground">{z.uso}</td>
							</tr>
						))}
					</tbody>
				</table>
			</Cartao>

			<Cartao titulo="Ritmos-chave do livro" nota="O ritmo que define cada tipo de treino de Daniels (Tabela 3.2 do livro).">
				<table className="w-full min-w-[30rem] text-sm">
					<tbody>
						{chave.map((c) => (
							<tr key={c.letra} className="border-t first:border-0">
								<td className="w-8 py-1.5 font-bold">{c.letra}</td>
								<td className="pr-3">{c.nome}</td>
								<td className="pr-3 font-medium tabular-nums">{c.valor}</td>
								<td className="text-muted-foreground">{c.uso}</td>
							</tr>
						))}
					</tbody>
				</table>
			</Cartao>

			<Cartao titulo="Provas e corridas de rua (últimos 6 meses)" nota="VPONTO pelo tempo total. A distância é a oficial quando o relógio mediu até 1,5% a mais (meia e maratona); senão, vale a do relógio.">
				<table className="w-full min-w-[34rem] text-sm">
					<thead className="text-left text-muted-foreground">
						<tr>
							<th className="py-1 pr-3">Data</th>
							<th className="pr-3">Prova</th>
							<th className="pr-3">Distância</th>
							<th className="pr-3">Tempo</th>
							<th className="pr-3">FC média</th>
							<th>VPONTO</th>
						</tr>
					</thead>
					<tbody>
						{p.provas.map((r) => (
							<tr key={r.data + r.nome} className="border-t">
								<td className="py-1.5 pr-3 tabular-nums">{formatarData(`${r.data}T12:00:00`)}</td>
								<td className="pr-3">{r.nome}</td>
								<td className="pr-3 tabular-nums">{fmt1(r.distanciaKm)} km</td>
								<td className="pr-3 tabular-nums">{fmtTempo(r.tempoSeg)}</td>
								<td className="pr-3 tabular-nums">{r.fcMedia ? Math.round(r.fcMedia) : "—"}</td>
								<td className="font-semibold tabular-nums">{fmt1(r.vponto)}</td>
							</tr>
						))}
						{p.provas.length === 0 && (
							<tr>
								<td colSpan={6} className="py-2 text-muted-foreground">
									Nenhuma prova nos últimos 6 meses.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</Cartao>

			<Cartao
				titulo="Treinos: melhores esforços (12 semanas)"
				nota="Km seguidos mais rápidos em treino. É um piso: treino quase nunca é esforço máximo, então o VPONTO real é igual ou maior."
			>
				<table className="w-full min-w-[30rem] text-sm">
					<thead className="text-left text-muted-foreground">
						<tr>
							<th className="py-1 pr-3">Trecho</th>
							<th className="pr-3">Data</th>
							<th className="pr-3">Pace</th>
							<th className="pr-3">FC</th>
							<th>VPONTO</th>
						</tr>
					</thead>
					<tbody>
						{p.esforcos.map((e) => (
							<tr key={e.km} className="border-t">
								<td className="py-1.5 pr-3">{e.km} km seguidos</td>
								<td className="pr-3 tabular-nums">{formatarData(`${e.data}T12:00:00`)}</td>
								<td className="pr-3 tabular-nums">{formatarPace(e.paceSeg)} /km</td>
								<td className="pr-3 tabular-nums">{e.fcMedia ? Math.round(e.fcMedia) : "—"}</td>
								<td className="font-semibold tabular-nums">{fmt1(e.vponto)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</Cartao>

			<Cartao
				titulo="Treinos: estimativa pela FC"
				nota="Corridas estáveis (8 km ou mais, pouca subida, FC média acima de 75% da máxima). Cada corrida oscila bastante; vale a mediana."
			>
				<table className="w-full min-w-[30rem] text-sm">
					<thead className="text-left text-muted-foreground">
						<tr>
							<th className="py-1 pr-3">Data</th>
							<th className="pr-3">Distância</th>
							<th className="pr-3">Pace</th>
							<th className="pr-3">FC média</th>
							<th>VPONTO</th>
						</tr>
					</thead>
					<tbody>
						{p.porFc.map((e) => (
							<tr key={e.data} className="border-t">
								<td className="py-1.5 pr-3 tabular-nums">{formatarData(`${e.data}T12:00:00`)}</td>
								<td className="pr-3 tabular-nums">{fmt1(e.km)} km</td>
								<td className="pr-3 tabular-nums">{formatarPace(e.paceSeg)} /km</td>
								<td className="pr-3 tabular-nums">{Math.round(e.fcMedia)}</td>
								<td className="font-semibold tabular-nums">{fmt1(e.vponto)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</Cartao>
		</div>
	);
}
