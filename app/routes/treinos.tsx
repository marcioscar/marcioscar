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
import { obterConfigSugestao, salvarConfigSugestao } from "~/models/config-sugestao.server";
import { obterProvaAtiva } from "~/models/provas.server";
import { garantirVponto } from "~/models/vdot-config.server";
import { listarTreinosSaude } from "~/models/treino-saude.server";
import { RELOGIO_DESDE } from "~/lib/fonte-dados";
import { sanearMusculacao, estimarMinutosMusculacao, type TreinoMusculacaoDados } from "~/lib/musculacao";
import { listarMusculacao, removerMusculacao, salvarMusculacao } from "~/models/musculacao.server";
import { chaveDia } from "~/lib/carga-treino";
import {
	ROTULO_FASE,
	estimarKm,
	estimarSegundos,
	formatarDuracao,
	formatarPaceSeg,
	sanearTreino,
	sugerirSemana,
	sanearConfigSugestao,
	type ConfigSugestaoDados,
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
	/** página de detalhe da corrida (Strava ou relógio); null para musculação etc. */
	href: string | null;
	stravaId: number | null;
	/** início em ms (UTC), para casar Strava e relógio */
	dataMs: number;
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
	await garantirVponto();
	const hoje = chaveDia(new Date());
	const param = new URL(request.url).searchParams.get("mes");
	const mes = mesValido(param) ? param : hoje.slice(0, 7);

	// grade: da segunda da semana do dia 1 até o domingo da semana do último dia do mês
	const primeiro = `${mes}-01`;
	const ultimoDoMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0)).toISOString().slice(0, 10);
	const inicio = segundaDe(primeiro);
	const fim = somarDias(segundaDe(ultimoDoMes), 6);

	const [configSugestao, treinos, musculacaoLista, saude, corridas] = await Promise.all([
		obterConfigSugestao(),
		listarTreinosManuais(inicio, fim),
		listarMusculacao(inicio, fim),
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
		// a partir de RELOGIO_DESDE a fonte é o relógio: o Strava só entra se o relógio não tiver a mesma corrida
		inicioStrava.push(c.dataInicio.getTime());
		(atividades[dia] ??= []).push({
			href: `/corridas/${c.stravaId}`,
			stravaId: c.stravaId,
			dataMs: c.dataInicio.getTime(),
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
		const doRelogio = dia >= RELOGIO_DESDE;
		const duplicado =
			!doRelogio &&
			(t.tipo === "corrida" || t.tipo === "caminhada") &&
			inicioStrava.some((i) => Math.abs(i - t.inicio.getTime()) <= QUINZE_MIN);
		if (duplicado) continue;
		if (doRelogio && (t.tipo === "corrida" || t.tipo === "caminhada")) {
			// tira do dia a atividade do Strava equivalente (relógio manda daqui em diante)
			const lista = atividades[dia];
			if (lista) {
				const i = lista.findIndex(
					(a) => a.origem === "strava" && !a.musculacao && Math.abs(a.dataMs - t.inicio.getTime()) <= QUINZE_MIN,
				);
				if (i >= 0) lista.splice(i, 1);
			}
		}
		const km = (t.distanciaM ?? 0) / 1000;
		(atividades[dia] ??= []).push({
			href: t.tipo === "corrida" ? `/corridas/relogio/${t.healthId}` : null,
			stravaId: null,
			dataMs: t.inicio.getTime(),
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

	const musculacao: Record<string, TreinoMusculacaoDados> = {};
	for (const m of musculacaoLista) musculacao[m.data] = m;

	return { hoje, mes, inicio, fim, treinos, musculacao, atividades, configSugestao };
}

export async function action({ request }: Route.ActionArgs) {
	await garantirVponto();
	const form = await request.formData();
	const intent = form.get("intent");

	try {
		if (intent === "salvar") {
			const treino = sanearTreino(JSON.parse(String(form.get("treino") ?? "null")));
			if (!treino) return { ok: false, message: "Treino inválido." };
			await salvarTreinoManual(treino);
			return { ok: true, message: "Treino salvo." };
		}

		if (intent === "salvarMusculacao") {
			const treino = sanearMusculacao(JSON.parse(String(form.get("treino") ?? "null")));
			if (!treino) return { ok: false, message: "Treino de musculação inválido." };
			await salvarMusculacao(treino);
			return { ok: true, message: "Musculação salva." };
		}

		if (intent === "removerMusculacao") {
			const data = String(form.get("data") ?? "");
			if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, message: "Data inválida." };
			await removerMusculacao(data);
			return { ok: true, message: "Musculação excluída." };
		}

		if (intent === "remover") {
			const data = String(form.get("data") ?? "");
			if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, message: "Data inválida." };
			await removerTreinoManual(data);
			return { ok: true, message: "Treino excluído." };
		}

		if (intent === "sugerir") {
			const segunda = String(form.get("segunda") ?? "");
			const config = sanearConfigSugestao(JSON.parse(String(form.get("config") ?? "null")));
			if (!/^\d{4}-\d{2}-\d{2}$/.test(segunda) || segundaDe(segunda) !== segunda || !config) {
				return { ok: false, message: "Marque pelo menos um dia e confira o volume." };
			}
			await salvarConfigSugestao(config);
			const existentes = await listarTreinosManuais(segunda, somarDias(segunda, 6));
			const hoje = chaveDia(new Date());
			const sugestao = sugerirSemana(segunda, { ...config, existentes });
			const novos = sugestao.novos.filter((t) => t.data >= hoje);
			for (const t of novos) await salvarTreinoManual(t);

			// com um plano de prova em andamento, dia vazio receberia o treino do plano: marca descanso
			const prova = await obterProvaAtiva();
			if (novos.length > 0 && prova && prova.dataProva.toISOString().slice(0, 10) >= segunda) {
				const ocupados = new Set([...existentes, ...sugestao.novos].map((t) => t.data));
				for (let i = 0; i < 7; i++) {
					const data = somarDias(segunda, i);
					if (data < hoje || ocupados.has(data)) continue;
					await salvarTreinoManual({
						data,
						titulo: "Descanso",
						tipo: "descanso",
						observacao: null,
						aquecimento: null,
						blocos: [],
						desaquecimento: null,
					});
				}
			}
			return {
				ok: true,
				message:
					novos.length === 0
						? "Nada a preencher: os dias marcados já têm treino ou já passaram. A escolha ficou salva."
						: `${novos.length} treino(s) adicionados. A semana ficou com ${Math.round(sugestao.kmTotal)} km.`,
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
	const classe = "grid min-w-0 grid-cols-1 gap-0.5 rounded-lg border px-2 py-1.5 text-xs";
	const estilo = {
		borderColor: `color-mix(in oklab, ${COR_TIPO[t.tipo as TipoTreino]} 40%, transparent)`,
		background: feita
			? "color-mix(in oklab, var(--paleta-1) 14%, var(--card))"
			: `color-mix(in oklab, ${COR_TIPO[t.tipo as TipoTreino]} 8%, var(--card))`,
	};
	const conteudo = (
		<>
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
		</>
	);

	// treino feito: o cartão abre a corrida (detalhes); o resto da célula continua abrindo o editor do plano
	return feita?.href ? (
		<Link
			to={feita.href}
			onClick={(e) => e.stopPropagation()}
			className={`${classe} transition-opacity hover:opacity-80`}
			style={estilo}
			title="Ver detalhes da corrida">
			{conteudo}
		</Link>
	) : (
		<div className={classe} style={estilo}>
			{conteudo}
		</div>
	);
}

function CartaoMusculacao({
	m,
	feita,
	passado,
}: {
	m: TreinoMusculacaoDados;
	feita?: AtividadeDia;
	passado: boolean;
}) {
	const status = feita ? "feito" : passado ? "perdido" : "pendente";
	const minutos = feita ? Math.round(feita.tempoSeg / 60) : estimarMinutosMusculacao(m);
	return (
		<div
			className="grid min-w-0 grid-cols-1 gap-0.5 rounded-lg border px-2 py-1.5 text-xs"
			style={{
				borderColor: "color-mix(in oklab, var(--paleta-6) 40%, transparent)",
				background: feita
					? "color-mix(in oklab, var(--paleta-1) 14%, var(--card))"
					: "color-mix(in oklab, var(--paleta-6) 8%, var(--card))",
			}}>
			<div className="flex items-center gap-1.5">
				<Dumbbell size={13} className="shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate font-semibold capitalize">{m.grupo.toLowerCase()}</span>
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
				{m.exercicios.length} exercícios · {feita ? "" : "~"}
				{minutos} min
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
	return a.href !== null ? (
		<Link
			to={a.href}
			onClick={(e) => e.stopPropagation()}
			className={classe}
			style={a.caminhada ? { opacity: 0.7 } : undefined}>
			{conteudo}
		</Link>
	) : (
		<div className={classe} style={a.caminhada ? { opacity: 0.7 } : undefined} title="Dados do Apple Watch">
			{conteudo}
		</div>
	);
}

function SugestaoDialog({
	segunda,
	hoje,
	treinos,
	inicial,
	onClose,
}: {
	segunda: string;
	hoje: string;
	treinos: TreinoManualDados[];
	inicial: ConfigSugestaoDados;
	onClose: () => void;
}) {
	const fetcher = useFetcher<{ ok: boolean; message?: string }>();
	const [dias, setDias] = useState<number[]>(inicial.dias);
	const [longaoEscolhido, setLongao] = useState(inicial.diaLongao);
	const [volume, setVolume] = useState(String(inicial.volumeKm));
	const [fase, setFase] = useState<FaseSugestao>(inicial.fase);
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

	const datas = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
	const existentes = treinos.filter((t) => t.data >= datas[0] && t.data <= datas[6]);
	const ocupado = datas.map((d) => existentes.find((t) => t.data === d && t.tipo !== "descanso") ?? null);
	const longaoCadastrado = existentes.find((t) => t.tipo === "longao" || t.tipo === "prova");
	const marcadosLivres = dias.filter((i) => !ocupado[i]);
	// o longão só pode cair num dia marcado e livre
	const diaLongao = marcadosLivres.includes(longaoEscolhido)
		? longaoEscolhido
		: (marcadosLivres[marcadosLivres.length - 1] ?? longaoEscolhido);

	const config = sanearConfigSugestao({
		dias,
		diaLongao,
		volumeKm: Number(volume.replace(",", ".")) || Number.NaN,
		fase,
	});
	const sugestao = config ? sugerirSemana(segunda, { ...config, existentes }) : null;
	const novos = sugestao?.novos.filter((t) => t.data >= hoje) ?? [];
	const totalDias = ocupado.filter(Boolean).length + marcadosLivres.length;
	const acima = sugestao ? sugestao.kmTotal - sugestao.kmAlvo : 0;

	const seletor = "border-input bg-background h-9 rounded-md border px-2 text-sm";
	return (
		<Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						Sugestão para a semana de {formatarDia(segunda, { day: "numeric", month: "long" })}
					</DialogTitle>
					<DialogDescription>
						Marque os dias em que quer correr. O que já está cadastrado não muda: conta nos km da semana, e só os dias
						vazios são preenchidos.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3">
					<fieldset className="grid gap-1.5 text-sm">
						<legend className="mb-1.5">Dias de corrida ({totalDias})</legend>
						<div className="grid grid-cols-7 gap-1">
							{DIAS.map((nome, i) => {
								const fixo = ocupado[i];
								const passou = datas[i] < hoje;
								const marcado = !!fixo || dias.includes(i);
								return (
									<button
										key={nome}
										type="button"
										aria-pressed={marcado}
										disabled={!!fixo}
										title={fixo ? `Já cadastrado: ${fixo.titulo}` : passou ? "Dia que já passou: não é preenchido" : undefined}
										onClick={() =>
											setDias((ds) => (ds.includes(i) ? ds.filter((x) => x !== i) : [...ds, i].sort((a, b) => a - b)))
										}
										className={`flex h-11 flex-col items-center justify-center rounded-md border text-xs font-medium ${
											fixo
												? "border-border bg-muted text-muted-foreground"
												: marcado
													? "border-primary bg-primary text-primary-foreground"
													: "border-input bg-background"
										} ${passou && !fixo ? "opacity-50" : ""}`}>
										{nome}
										{fixo && <Check size={12} aria-hidden />}
									</button>
								);
							})}
						</div>
					</fieldset>
					<label className="grid gap-1 text-sm">
						Dia do longão
						{longaoCadastrado ? (
							<span className="text-muted-foreground text-xs">
								Já cadastrado: {longaoCadastrado.titulo} ({formatarDia(longaoCadastrado.data, { weekday: "long" })})
							</span>
						) : (
							<select
								className={seletor}
								value={diaLongao}
								disabled={marcadosLivres.length === 0}
								onChange={(e) => setLongao(Number(e.target.value))}>
								{marcadosLivres.map((i) => (
									<option key={i} value={i}>
										{formatarDia(datas[i], { weekday: "long" })}
									</option>
								))}
							</select>
						)}
					</label>
					<label className="grid gap-1 text-sm">
						Volume da semana inteira (km)
						<input className={seletor} inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} />
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

					<div className="bg-muted/40 grid gap-1 rounded-md border p-3 text-sm">
						<p className="font-medium">Como a semana fica</p>
						{datas.map((d, i) => {
							const novo = novos.find((t) => t.data === d);
							const t = ocupado[i] ?? novo;
							if (!t) return null;
							return (
								<p key={d} className="flex items-baseline gap-2">
									<span className="text-muted-foreground w-8 shrink-0">{DIAS[i]}</span>
									<span className={`min-w-0 flex-1 ${novo ? "font-semibold" : "text-muted-foreground"}`}>
										{novo ? "+ " : ""}
										{t.titulo}
									</span>
									<span className="text-muted-foreground tabular-nums">{Math.round(estimarKm(t))} km</span>
								</p>
							);
						})}
						{sugestao && (
							<p className="mt-1 border-t pt-1 tabular-nums">
								Total:{" "}
								<strong>
									{Math.round(sugestao.kmExistente + novos.reduce((acc, t) => acc + estimarKm(t), 0))} km
								</strong>{" "}
								<span className="text-muted-foreground">(alvo {Math.round(sugestao.kmAlvo)} km)</span>
							</p>
						)}
						{novos.length === 0 && (
							<p className="text-muted-foreground text-xs">Nenhum dia marcado está livre daqui para a frente.</p>
						)}
						{novos.length > 0 && acima > 3 && (
							<p className="text-muted-foreground text-xs">
								Passa do alvo porque os treinos fixos e os mínimos (fácil 4 km, longão 12 km) já somam mais.
							</p>
						)}
						{novos.length > 0 && acima < -3 && (
							<p className="text-muted-foreground text-xs">
								Fica abaixo do alvo: dia fácil vai até 16 km (ou 75% do longão já cadastrado). Marque mais dias ou aumente o longão para completar.
							</p>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						Cancelar
					</Button>
					<Button
						type="button"
						disabled={fetcher.state !== "idle" || !config || novos.length === 0}
						onClick={() => {
							setEsperando(true);
							fetcher.submit({ intent: "sugerir", segunda, config: JSON.stringify(config) }, { method: "post" });
						}}>
						{fetcher.state !== "idle" ? "Preenchendo..." : `Adicionar ${novos.length} treino(s)`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function Treinos() {
	const { hoje, mes, inicio, fim, treinos, musculacao, atividades, configSugestao } = useLoaderData<typeof loader>();
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
									const { feita, soltas: soltasBrutas } = parear(t, atividades[dia] ?? []);
									const m = musculacao[dia];
									const musculacaoFeita = m ? (atividades[dia] ?? []).find((a) => a.musculacao) : undefined;
									const soltas = soltasBrutas.filter((a) => a !== musculacaoFeita);
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
												{m && <CartaoMusculacao m={m} feita={musculacaoFeita} passado={passado} />}
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
				musculacaoInicial={editando ? (musculacao[editando] ?? null) : null}
				rotuloData={editando ? formatarDia(editando, { weekday: "long", day: "numeric", month: "long" }) : ""}
				onClose={() => setEditando(null)}
			/>
			{sugerindo && (
				<SugestaoDialog
					key={sugerindo}
					segunda={sugerindo}
					hoje={hoje}
					treinos={treinos as TreinoManualDados[]}
					inicial={configSugestao}
					onClose={() => setSugerindo(null)}
				/>
			)}
		</main>
	);
}
