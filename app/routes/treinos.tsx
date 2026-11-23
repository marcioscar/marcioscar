import { useEffect, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import { Check, Clock, Dumbbell, Footprints, Minus } from "lucide-react";
import { toast } from "sonner";
import type { Route } from "./+types/treinos";
import { TreinoEditorDialog } from "~/components/treinos/treino-editor-dialog";
import { Button, buttonVariants } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { db } from "../../db.server";
import { listarTreinosSaude } from "~/models/treino-saude.server";
import { chaveDia } from "~/lib/carga-treino";
import {
	ROTULO_FASE,
	estimarKm,
	estimarSegundos,
	formatarDuracao,
	formatarPaceSeg,
	sanearTreino,
	sugerirSemana,
	type DiasPorSemana,
	type FaseSugestao,
	type TipoTreino,
	type TreinoManualDados,
} from "~/lib/treino-manual";
import {
	listarTreinosManuais,
	removerTreinoManual,
	salvarTreinoManual,
} from "~/models/treino-manual.server";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Treinos | Marcioscar" }, { name: "description", content: "Monte os treinos da semana" }];
}

const COR_TIPO: Record<TipoTreino, string> = {
	descanso: "var(--paleta-8)",
	leve: "var(--paleta-7)",
	limiar: "var(--paleta-3)",
	tiros: "var(--paleta-2)",
	longao: "var(--paleta-6)",
	prova: "var(--paleta-5)",
};

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function somarDias(chave: string, dias: number): string {
	const d = new Date(`${chave}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + dias);
	return d.toISOString().slice(0, 10);
}

function segundaDe(chave: string): string {
	const dow = new Date(`${chave}T12:00:00Z`).getUTCDay();
	return somarDias(chave, -((dow + 6) % 7));
}

function formatarDia(chave: string, opcoes: Intl.DateTimeFormatOptions): string {
	return new Date(`${chave}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", ...opcoes });
}

/** Corrida só conta como corrida se o pace médio for de quem corre; mais lento que isso é caminhada. */
const PACE_CAMINHADA_SEG = 570; // 9:30/km
function ehCaminhada(distanciaM: number, tempoSeg: number): boolean {
	return distanciaM <= 0 || tempoSeg / (distanciaM / 1000) > PACE_CAMINHADA_SEG;
}

export type AtividadeDia = {
	/** Só atividades do Strava têm página de detalhe */
	stravaId: number | null;
	chave: string;
	nome: string;
	km: number;
	tempoSeg: number;
	caminhada: boolean;
	musculacao: boolean;
	origem: "strava" | "saude";
};

function mesValido(v: string | null): v is string {
	return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export async function loader({ request }: Route.LoaderArgs) {
	const hoje = chaveDia(new Date());
	const param = new URL(request.url).searchParams.get("mes");
	const mes = mesValido(param) ? param : hoje.slice(0, 7);

	// grade: da segunda da semana do dia 1 até o domingo da semana do último dia do mês
	const primeiro = `${mes}-01`;
	const ultimoDoMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0)).toISOString().slice(0, 10);
	const inicio = segundaDe(primeiro);
	const fim = somarDias(segundaDe(ultimoDoMes), 6);

	const [treinos, saude, corridas] = await Promise.all([
		listarTreinosManuais(inicio, fim),
		listarTreinosSaude(new Date(`${somarDias(inicio, -1)}T00:00:00Z`), new Date(`${somarDias(fim, 2)}T00:00:00Z`)),
		db.corrida.findMany({
			where: {
				dataInicio: {
					gte: new Date(`${somarDias(inicio, -1)}T00:00:00Z`),
					lte: new Date(`${somarDias(fim, 2)}T00:00:00Z`),
				},
			},
			orderBy: { dataInicio: "asc" },
			select: { stravaId: true, nome: true, dataInicio: true, distanciaMetros: true, tempoMovimentoSeg: true },
		}),
	]);

	const atividades: Record<string, AtividadeDia[]> = {};
	const inicioStrava: number[] = [];
	for (const c of corridas) {
		const dia = chaveDia(c.dataInicio);
		if (dia < inicio || dia > fim) continue;
		inicioStrava.push(c.dataInicio.getTime());
		(atividades[dia] ??= []).push({
			stravaId: c.stravaId,
			chave: `strava-${c.stravaId}`,
			nome: c.nome,
			km: c.distanciaMetros / 1000,
			tempoSeg: c.tempoMovimentoSeg,
			caminhada: ehCaminhada(c.distanciaMetros, c.tempoMovimentoSeg),
			musculacao: false,
			origem: "strava",
		});
	}

	// Treinos do app Saúde: o que já veio do Strava (começo a até 15 min de diferença) não entra de novo.
	const QUINZE_MIN = 15 * 60 * 1000;
	for (const t of saude) {
		const dia = chaveDia(t.inicio);
		if (dia < inicio || dia > fim) continue;
		const duplicado =
			(t.tipo === "corrida" || t.tipo === "caminhada") &&
			inicioStrava.some((i) => Math.abs(i - t.inicio.getTime()) <= QUINZE_MIN);
		if (duplicado) continue;
		const km = (t.distanciaM ?? 0) / 1000;
		(atividades[dia] ??= []).push({
			stravaId: null,
			chave: `saude-${t.healthId}`,
			nome: t.tipo === "musculacao" ? "Musculação" : t.tipo === "caminhada" ? "Caminhada" : t.tipo === "corrida" ? "Corrida" : "Treino",
			km,
			tempoSeg: t.duracaoSeg,
			caminhada: t.tipo === "caminhada" || (t.tipo === "corrida" && ehCaminhada(t.distanciaM ?? 0, t.duracaoSeg)),
			musculacao: t.tipo === "musculacao",
			origem: "saude",
		});
	}
	for (const lista of Object.values(atividades)) lista.sort((a, b) => a.chave.localeCompare(b.chave));

	return { hoje, mes, inicio, fim, treinos, atividades };
}

export async function action({ request }: Route.ActionArgs) {
	const form = await request.formData();
	const intent = form.get("intent");

	try {
		if (intent === "salvar") {
			const treino = sanearTreino(JSON.parse(String(form.get("treino") ?? "null")));
			if (!treino) return { ok: false, message: "Treino inválido." };
			await salvarTreinoManual(treino);
			return { ok: true, message: "Treino salvo." };
		}

		if (intent === "remover") {
			const data = String(form.get("data") ?? "");
			if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, message: "Data inválida." };
			await removerTreinoManual(data);
			return { ok: true, message: "Treino excluído." };
		}

		if (intent === "sugerir") {
			const segunda = String(form.get("segunda") ?? "");
			const dias = Math.min(Math.max(Math.round(Number(form.get("dias")) || 5), 3), 6) as DiasPorSemana;
			const volumeKm = Math.min(Math.max(Number(form.get("volumeKm")) || 0, 15), 200);
			const fase = String(form.get("fase")) as FaseSugestao;
			if (!/^\d{4}-\d{2}-\d{2}$/.test(segunda) || !(fase in ROTULO_FASE)) {
				return { ok: false, message: "Parâmetros inválidos." };
			}
			const existentes = new Set(
				(await listarTreinosManuais(segunda, somarDias(segunda, 6))).map((t) => t.data),
			);
			const novos = sugerirSemana(segunda, { dias, volumeKm, fase }).filter((t) => !existentes.has(t.data));
			for (const t of novos) await salvarTreinoManual(t);
			return {
				ok: true,
				message:
					novos.length === 0
						? "A semana já está toda preenchida. Exclua um dia para receber a sugestão dele."
						: `${novos.length} dia(s) preenchidos com a sugestão.`,
			};
		}

		return { ok: false, message: "Ação inválida." };
	} catch (erro) {
		console.error("Falha em /treinos", erro);
		return { ok: false, message: "Erro ao salvar. Tente de novo." };
	}
}

function formatarKm(km: number): string {
	return `${km.toFixed(1).replace(".", ",")}km`;
}

function somarMes(mes: string, delta: number): string {
	const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)) - 1 + delta, 1));
	return d.toISOString().slice(0, 7);
}

/** Pareia o treino planejado do dia com a corrida mais longa (sem contar caminhada) feita no mesmo dia. */
function parear(planejado: TreinoManualDados | undefined, atividades: AtividadeDia[]) {
	const corridas = atividades.filter((a) => !a.caminhada && !a.musculacao);
	const principal = planejado && planejado.tipo !== "descanso" ? [...corridas].sort((a, b) => b.km - a.km)[0] : undefined;
	return {
		feita: principal,
		soltas: atividades.filter((a) => a !== principal),
	};
}

function CartaoPlanejado({
	t,
	feita,
	passado,
}: {
	t: TreinoManualDados;
	feita?: AtividadeDia;
	passado: boolean;
}) {
	const km = feita ? feita.km : estimarKm(t);
	const seg = feita ? feita.tempoSeg : estimarSegundos(t);
	const pace = feita && feita.km > 0 ? feita.tempoSeg / feita.km : null;
	const status = feita ? "feito" : passado ? "perdido" : "pendente";
	return (
		<div
			className="grid min-w-0 grid-cols-1 gap-0.5 rounded-lg border px-2 py-1.5 text-xs"
			style={{
				borderColor: `color-mix(in oklab, ${COR_TIPO[t.tipo as TipoTreino]} 40%, transparent)`,
				background: feita
					? "color-mix(in oklab, var(--paleta-1) 14%, var(--card))"
					: `color-mix(in oklab, ${COR_TIPO[t.tipo as TipoTreino]} 8%, var(--card))`,
			}}>
			<div className="flex items-center gap-1.5">
				<Footprints size={13} className="shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate font-semibold">{t.titulo}</span>
				<span
					className="flex size-4 shrink-0 items-center justify-center rounded-full"
					style={
						status === "feito"
							? { background: "var(--paleta-1)", color: "white" }
							: { background: "var(--muted)", color: "var(--muted-foreground)" }
					}
					title={status === "feito" ? "Feito" : status === "perdido" ? "Não feito" : "Planejado"}>
					{status === "feito" ? <Check size={11} /> : status === "perdido" ? <Minus size={11} /> : <Clock size={11} />}
				</span>
			</div>
			<p className="truncate text-[11px] text-muted-foreground tabular-nums">
				{formatarKm(km)} · {formatarDuracao(seg)}
				{pace ? ` · ${formatarPaceSeg(pace)}` : ""}
			</p>
		</div>
	);
}

function CartaoAtividade({ a }: { a: AtividadeDia }) {
	const pace = a.km > 0 ? a.tempoSeg / a.km : null;
	const Icone = a.musculacao ? Dumbbell : Footprints;
	const conteudo = (
		<>
			<div className="flex items-center gap-1.5">
				<Icone size={13} className="shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate font-semibold">
					{a.caminhada ? "Caminhada" : a.musculacao ? "Musculação" : a.nome}
				</span>
				{!a.caminhada && (
					<span className="flex size-4 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--paleta-1)", color: "white" }}>
						<Check size={11} />
					</span>
				)}
			</div>
			<p className="truncate text-[11px] text-muted-foreground tabular-nums">
				{a.musculacao ? formatarDuracao(a.tempoSeg) : `${formatarKm(a.km)} · ${formatarDuracao(a.tempoSeg)}`}
				{pace && !a.caminhada && !a.musculacao ? ` · ${formatarPaceSeg(pace)}` : ""}
			</p>
		</>
	);
	const classe =
		"grid min-w-0 grid-cols-1 gap-0.5 rounded-lg border bg-card px-2 py-1.5 text-xs transition-colors hover:bg-accent/50";
	return a.stravaId !== null ? (
		<Link
			to={`/corridas/${a.stravaId}`}
			onClick={(e) => e.stopPropagation()}
			className={classe}
			style={a.caminhada ? { opacity: 0.7 } : undefined}>
			{conteudo}
		</Link>
	) : (
		<div className={classe} style={a.caminhada ? { opacity: 0.7 } : undefined} title="Lido do app Saúde">
			{conteudo}
		</div>
	);
}

function SugestaoDialog({ segunda, onClose }: { segunda: string | null; onClose: () => void }) {
	const fetcher = useFetcher<{ ok: boolean; message?: string }>();
	const [dias, setDias] = useState("5");
	const [volume, setVolume] = useState("60");
	const [fase, setFase] = useState<FaseSugestao>("construcao");
	const [esperando, setEsperando] = useState(false);

	useEffect(() => {
		if (fetcher.state !== "idle" || !fetcher.data || !esperando) return;
		setEsperando(false);
		if (fetcher.data.ok) {
			toast.success(fetcher.data.message);
			onClose();
		} else {
			toast.error(fetcher.data.message);
		}
	}, [fetcher.state, fetcher.data, esperando, onClose]);

	if (!segunda) return null;
	const seletor = "border-input bg-background h-9 rounded-md border px-2 text-sm";
	return (
		<Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>
						Sugestão para a semana de {formatarDia(segunda, { day: "numeric", month: "long" })}
					</DialogTitle>
					<DialogDescription>
						Preenche só os dias vazios com uma semana-modelo (Jack Daniels + Canova): qualidade, longão no fim de semana e o
						resto fácil. Não mexe no que você já preencheu.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3">
					<label className="grid gap-1 text-sm">
						Dias de treino por semana
						<select className={seletor} value={dias} onChange={(e) => setDias(e.target.value)}>
							{[3, 4, 5, 6].map((n) => (
								<option key={n} value={n}>
									{n} dias
								</option>
							))}
						</select>
					</label>
					<label className="grid gap-1 text-sm">
						Volume (km/semana)
						<input className={seletor} inputMode="numeric" value={volume} onChange={(e) => setVolume(e.target.value)} />
					</label>
					<label className="grid gap-1 text-sm">
						Fase
						<select className={seletor} value={fase} onChange={(e) => setFase(e.target.value as FaseSugestao)}>
							{(Object.keys(ROTULO_FASE) as FaseSugestao[]).map((f) => (
								<option key={f} value={f}>
									{ROTULO_FASE[f]}
								</option>
							))}
						</select>
					</label>
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						Cancelar
					</Button>
					<Button
						type="button"
						disabled={fetcher.state !== "idle"}
						onClick={() => {
							setEsperando(true);
							fetcher.submit({ intent: "sugerir", segunda, dias, volumeKm: volume, fase }, { method: "post" });
						}}>
						{fetcher.state !== "idle" ? "Preenchendo..." : "Preencher dias vazios"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function Treinos() {
	const { hoje, mes, inicio, fim, treinos, atividades } = useLoaderData<typeof loader>();
	const [editando, setEditando] = useState<string | null>(null);
	const [sugerindo, setSugerindo] = useState<string | null>(null);

	const porData = new Map(treinos.map((t) => [t.data, t as TreinoManualDados]));
	const semanas: string[][] = [];
	for (let d = inicio; d <= fim; d = somarDias(d, 7)) {
		semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(d, i)));
	}

	return (
		<main className="grid w-full min-w-0 gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-2xl font-bold">Treinos</h1>
					<p className="text-sm text-muted-foreground">
						Monte o calendário do seu jeito; o que você correu aparece com ✓. Os treinos vão para o app do Apple Watch.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Link to={`/treinos?mes=${somarMes(mes, -1)}`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label="Mês anterior">
						←
					</Link>
					<p className="min-w-36 text-center text-sm font-semibold capitalize">
						{formatarDia(`${mes}-01`, { month: "long", year: "numeric" })}
					</p>
					<Link to={`/treinos?mes=${somarMes(mes, 1)}`} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label="Próximo mês">
						→
					</Link>
					<Link to="/treinos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
						Hoje
					</Link>
				</div>
			</div>

			<div className="overflow-x-auto rounded-2xl border border-border bg-card">
				<div className="grid min-w-[960px] grid-cols-[repeat(7,minmax(0,1fr))_150px]">
					{[...DIAS, ""].map((d, i) => (
						<div key={i} className="border-b px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
							{d || "Semana"}
						</div>
					))}

					{semanas.map((dias) => {
						const doMes = (dia: string) => dia.startsWith(mes);
						let kmFeitos = 0;
						let segFeitos = 0;
						let segMusculacao = 0;
						let kmPlan = 0;
						let segPlan = 0;
						for (const dia of dias) {
							const t = porData.get(dia);
							if (t && t.tipo !== "descanso") {
								kmPlan += estimarKm(t);
								segPlan += estimarSegundos(t);
							}
							for (const a of atividades[dia] ?? []) {
								if (a.musculacao) {
									segMusculacao += a.tempoSeg;
									continue;
								}
								if (a.caminhada) continue;
								kmFeitos += a.km;
								segFeitos += a.tempoSeg;
							}
						}
						return (
							<div key={dias[0]} className="contents">
								{dias.map((dia) => {
									const t = porData.get(dia);
									const { feita, soltas } = parear(t, atividades[dia] ?? []);
									const ehHoje = dia === hoje;
									const passado = dia < hoje;
									return (
										<div
											key={dia}
											role="button"
											tabIndex={0}
											onClick={() => setEditando(dia)}
											onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setEditando(dia)}
											className="min-h-32 min-w-0 cursor-pointer overflow-hidden border-r border-b p-2 text-left transition-colors hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
											aria-label={`${formatarDia(dia, { weekday: "long", day: "numeric", month: "long" })}${t ? `, ${t.titulo}` : ""}`}>
											<span
												className={
													ehHoje
														? "flex size-7 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background"
														: `flex size-7 items-center justify-center text-sm font-semibold ${doMes(dia) ? "" : "text-muted-foreground/50"}`
												}>
												{formatarDia(dia, { day: "numeric" })}
											</span>
											<div className="mt-1.5 grid min-w-0 grid-cols-1 gap-1">
												{t && t.tipo !== "descanso" && <CartaoPlanejado t={t} feita={feita} passado={passado} />}
												{t && t.tipo === "descanso" && (
													<p className="px-1 text-[11px] text-muted-foreground">Descanso</p>
												)}
												{soltas.map((a) => (
													<CartaoAtividade key={a.chave} a={a} />
												))}
											</div>
										</div>
									);
								})}

								<div className="grid min-w-0 grid-cols-1 content-start gap-2 overflow-hidden border-b p-3 text-xs">
									<div>
										<p className="flex items-center gap-1.5 font-semibold">
											<Footprints size={13} className="text-muted-foreground" /> Corrida
										</p>
										<p className="mt-1 tabular-nums">
											{kmFeitos.toFixed(1).replace(".", ",")} / {kmPlan.toFixed(1).replace(".", ",")} km
										</p>
										<p className="text-muted-foreground tabular-nums">
											{formatarDuracao(segFeitos)} / {formatarDuracao(segPlan)}
										</p>
									</div>
									{segMusculacao > 0 && (
										<div>
											<p className="flex items-center gap-1.5 font-semibold">
												<Dumbbell size={13} className="text-muted-foreground" /> Musculação
											</p>
											<p className="mt-1 text-muted-foreground tabular-nums">{formatarDuracao(segMusculacao)}</p>
										</div>
									)}
									<Button type="button" variant="ghost" size="xs" className="w-fit" onClick={() => setSugerindo(dias[0])}>
										Sugerir semana
									</Button>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			<TreinoEditorDialog
				data={editando}
				inicial={editando ? ((porData.get(editando) as TreinoManualDados | undefined) ?? null) : null}
				rotuloData={editando ? formatarDia(editando, { weekday: "long", day: "numeric", month: "long" }) : ""}
				onClose={() => setEditando(null)}
			/>
			<SugestaoDialog segunda={sugerindo} onClose={() => setSugerindo(null)} />
		</main>
	);
}
