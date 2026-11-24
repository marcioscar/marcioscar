"use client";

import * as React from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Plus, Repeat, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	MODELOS,
	ROTULO_TIPO,
	estimarKm,
	estimarSegundos,
	etapaZona,
	formatarDuracao,
	formatarPaceSeg,
	textoPrescrito,
	type TipoTreino,
	type TreinoManualDados,
} from "~/lib/treino-manual";
import type { EtapaRelogio } from "~/lib/treino-para-relogio";
import { ZONAS_RITMO } from "~/lib/zonas-pace";
import { COR_ZONA, TreinoGrafico } from "./treino-grafico";
import { MusculacaoEditor } from "./musculacao-editor";
import type { TreinoMusculacaoDados } from "~/lib/musculacao";

type Unidade = "km" | "m" | "min" | "s";
type PapelEditavel = "trabalho" | "recuperacao";

type EtapaForm = { papel: PapelEditavel; valor: string; unidade: Unidade; zona: number; pace: string };
type SimplesForm = Omit<EtapaForm, "papel">;
type BlocoForm = { repeticoes: string; etapas: EtapaForm[] };
type Form = {
	titulo: string;
	tipo: TipoTreino;
	observacao: string;
	aquecimento: SimplesForm | null;
	blocos: BlocoForm[];
	desaquecimento: SimplesForm | null;
};

const SELECT = "border-input bg-background h-9 rounded-md border px-2 text-sm";

// ── conversões formulário ⇄ dados ─────────────────────────────────────────

function simplesDeEtapa(e: EtapaRelogio): SimplesForm {
	const zona = e.zona ?? 2;
	const z = ZONAS_RITMO[zona - 1];
	const custom =
		e.paceRapidoSeg != null &&
		e.paceLentoSeg != null &&
		(Math.round(e.paceRapidoSeg) !== z.rapidoSeg || Math.round(e.paceLentoSeg) !== z.lentoSeg);
	const pace = custom ? `${formatarPaceSeg(e.paceRapidoSeg!)}-${formatarPaceSeg(e.paceLentoSeg!)}` : "";

	if (e.distanciaM) {
		return e.distanciaM >= 1000 && e.distanciaM % 1000 === 0
			? { valor: String(e.distanciaM / 1000), unidade: "km", zona, pace }
			: { valor: String(e.distanciaM), unidade: "m", zona, pace };
	}
	if (e.tempoSeg) {
		return e.tempoSeg % 60 === 0
			? { valor: String(e.tempoSeg / 60), unidade: "min", zona, pace }
			: { valor: String(e.tempoSeg), unidade: "s", zona, pace };
	}
	return { valor: "", unidade: "km", zona, pace };
}

function formDeDados(t: TreinoManualDados): Form {
	return {
		titulo: t.titulo,
		tipo: t.tipo,
		observacao: t.observacao ?? "",
		aquecimento: t.aquecimento ? simplesDeEtapa(t.aquecimento) : null,
		blocos: t.blocos.map((b) => ({
			repeticoes: String(b.repeticoes),
			etapas: b.etapas.map((e) => ({
				...simplesDeEtapa(e),
				papel: (e.papel === "recuperacao" ? "recuperacao" : "trabalho") as PapelEditavel,
			})),
		})),
		desaquecimento: t.desaquecimento ? simplesDeEtapa(t.desaquecimento) : null,
	};
}

function parsePaceFaixa(txt: string): { rapido: number; lento: number } | null {
	const ps = [...txt.matchAll(/(\d{1,2})\s*[:'.]\s*(\d{2})/g)].map(
		(m) => parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
	);
	if (ps.length === 0) return null;
	if (ps.length === 1) return { rapido: ps[0] - 5, lento: ps[0] + 5 };
	return { rapido: Math.min(...ps), lento: Math.max(...ps) };
}

function etapaDeForm(papel: EtapaRelogio["papel"], f: SimplesForm): EtapaRelogio | null {
	const v = parseFloat(f.valor.replace(",", "."));
	if (!Number.isFinite(v) || v <= 0) return null;
	const meta =
		f.unidade === "km"
			? { distanciaM: v * 1000 }
			: f.unidade === "m"
				? { distanciaM: v }
				: f.unidade === "min"
					? { tempoSeg: v * 60 }
					: { tempoSeg: v };
	return etapaZona(papel, meta, f.zona, parsePaceFaixa(f.pace));
}

function dadosDeForm(data: string, f: Form): { dados: TreinoManualDados | null; erro?: string } {
	if (!f.titulo.trim()) return { dados: null, erro: "Dê um título ao treino." };
	const comum = { data, titulo: f.titulo.trim(), tipo: f.tipo, observacao: f.observacao.trim() || null };
	if (f.tipo === "descanso") {
		return { dados: { ...comum, aquecimento: null, blocos: [], desaquecimento: null } };
	}
	const blocos: TreinoManualDados["blocos"] = [];
	for (const [i, b] of f.blocos.entries()) {
		const etapas: EtapaRelogio[] = [];
		for (const [j, e] of b.etapas.entries()) {
			const et = etapaDeForm(e.papel, e);
			if (!et) return { dados: null, erro: `Bloco ${i + 1}, etapa ${j + 1}: informe a distância ou o tempo.` };
			etapas.push(et);
		}
		if (etapas.length === 0) return { dados: null, erro: `Bloco ${i + 1} está vazio.` };
		blocos.push({ repeticoes: Math.max(parseInt(b.repeticoes, 10) || 1, 1), etapas });
	}
	if (blocos.length === 0) return { dados: null, erro: "Adicione ao menos um bloco de treino." };

	const aq = f.aquecimento ? etapaDeForm("aquecimento", f.aquecimento) : null;
	const des = f.desaquecimento ? etapaDeForm("desaquecimento", f.desaquecimento) : null;
	if (f.aquecimento && !aq) return { dados: null, erro: "Aquecimento: informe a duração ou desligue-o." };
	if (f.desaquecimento && !des) return { dados: null, erro: "Desaquecimento: informe a duração ou desligue-o." };

	return { dados: { ...comum, aquecimento: aq, blocos, desaquecimento: des } };
}

// Para a prévia ao vivo: ignora etapas ainda incompletas em vez de acusar erro.
function previaDeForm(data: string, f: Form): TreinoManualDados | null {
	if (f.tipo === "descanso") return null;
	const blocos = f.blocos
		.map((b) => ({
			repeticoes: Math.max(parseInt(b.repeticoes, 10) || 1, 1),
			etapas: b.etapas.map((e) => etapaDeForm(e.papel, e)).filter((e): e is EtapaRelogio => e !== null),
		}))
		.filter((b) => b.etapas.length > 0);
	return {
		data,
		titulo: f.titulo,
		tipo: f.tipo,
		observacao: null,
		aquecimento: f.aquecimento ? etapaDeForm("aquecimento", f.aquecimento) : null,
		blocos,
		desaquecimento: f.desaquecimento ? etapaDeForm("desaquecimento", f.desaquecimento) : null,
	};
}

// ── campos ────────────────────────────────────────────────────────────────

const VAZIA = (zona: number, unidade: Unidade = "km"): SimplesForm => ({ valor: "", unidade, zona, pace: "" });

function CamposMeta({
	rotulo,
	valor,
	onChange,
}: {
	rotulo: string;
	valor: SimplesForm;
	onChange: (v: SimplesForm) => void;
}) {
	const z = ZONAS_RITMO[valor.zona - 1];
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Input
				inputMode="decimal"
				className="h-9 w-20"
				value={valor.valor}
				onChange={(e) => onChange({ ...valor, valor: e.target.value })}
				aria-label={`${rotulo}: quantidade`}
				placeholder="0"
			/>
			<select
				className={SELECT}
				value={valor.unidade}
				onChange={(e) => onChange({ ...valor, unidade: e.target.value as Unidade })}
				aria-label={`${rotulo}: unidade`}>
				<option value="km">km</option>
				<option value="m">m</option>
				<option value="min">min</option>
				<option value="s">s</option>
			</select>
			<select
				className={SELECT}
				value={valor.zona}
				onChange={(e) => onChange({ ...valor, zona: Number(e.target.value) })}
				aria-label={`${rotulo}: zona`}
				style={{ borderLeft: `4px solid ${COR_ZONA[valor.zona]}` }}>
				{ZONAS_RITMO.map((zz, i) => (
					<option key={zz.id} value={i + 1}>
						{zz.id} {zz.nome} · {formatarPaceSeg(zz.lentoSeg)}–{formatarPaceSeg(zz.rapidoSeg)}
					</option>
				))}
			</select>
			<Input
				className="h-9 w-32"
				value={valor.pace}
				onChange={(e) => onChange({ ...valor, pace: e.target.value })}
				aria-label={`${rotulo}: pace personalizado`}
				placeholder={`pace ${formatarPaceSeg(z.rapidoSeg)}-${formatarPaceSeg(z.lentoSeg)}`}
			/>
		</div>
	);
}

function Alternar({ rotulo, ligado, onChange }: { rotulo: string; ligado: boolean; onChange: (v: boolean) => void }) {
	return (
		<label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
			<input type="checkbox" className="size-4" checked={ligado} onChange={(e) => onChange(e.target.checked)} />
			{rotulo}
		</label>
	);
}

function mover<T>(lista: T[], de: number, para: number): T[] {
	if (para < 0 || para >= lista.length) return lista;
	const copia = [...lista];
	const [item] = copia.splice(de, 1);
	copia.splice(para, 0, item);
	return copia;
}

// ── diálogo ───────────────────────────────────────────────────────────────

type Props = {
	data: string | null;
	inicial: TreinoManualDados | null;
	musculacaoInicial?: TreinoMusculacaoDados | null;
	rotuloData: string;
	onClose: () => void;
};

export function TreinoEditorDialog({ data, inicial, musculacaoInicial = null, rotuloData, onClose }: Props) {
	const [modo, setModo] = React.useState<"corrida" | "musculacao">("corrida");
	React.useEffect(() => {
		// ao abrir um dia que só tem musculação planejada, já mostra a aba de musculação
		setModo(!inicial && musculacaoInicial ? "musculacao" : "corrida");
	}, [data, inicial, musculacaoInicial]);
	const fetcher = useFetcher<{ ok: boolean; message?: string }>();
	const salvando = fetcher.state !== "idle";
	const [form, setForm] = React.useState<Form | null>(null);
	const esperando = React.useRef(false);

	React.useEffect(() => {
		if (data) {
			setForm(inicial ? formDeDados(inicial) : formDeDados(MODELOS.find((m) => m.id === "facil")!.criar(data)));
		}
	}, [data, inicial]);

	React.useEffect(() => {
		if (fetcher.state !== "idle" || !fetcher.data || !esperando.current) return;
		esperando.current = false;
		if (fetcher.data.ok) {
			toast.success(fetcher.data.message ?? "Treino salvo.");
			onClose();
		} else {
			toast.error(fetcher.data.message ?? "Não foi possível salvar.");
		}
	}, [fetcher.state, fetcher.data, onClose]);

	if (!data || !form) return null;

	const previa = previaDeForm(data, form);
	const km = previa ? estimarKm(previa) : 0;
	const seg = previa ? estimarSegundos(previa) : 0;

	function salvar() {
		const { dados, erro } = dadosDeForm(data!, form!);
		if (!dados) {
			toast.error(erro ?? "Treino incompleto.");
			return;
		}
		esperando.current = true;
		fetcher.submit({ intent: "salvar", treino: JSON.stringify(dados) }, { method: "post" });
	}

	function remover() {
		esperando.current = true;
		fetcher.submit({ intent: "remover", data: data! }, { method: "post" });
	}

	async function copiar() {
		if (!previa) return;
		try {
			await navigator.clipboard.writeText(textoPrescrito(previa));
			toast.success("Treino copiado.");
		} catch {
			toast.error("Não consegui copiar.");
		}
	}

	const setBlocos = (blocos: BlocoForm[]) => setForm({ ...form, blocos });
	const atualizaBloco = (i: number, parcial: Partial<BlocoForm>) =>
		setBlocos(form.blocos.map((b, j) => (j === i ? { ...b, ...parcial } : b)));
	const atualizaEtapa = (i: number, k: number, nova: EtapaForm) =>
		atualizaBloco(i, { etapas: form.blocos[i].etapas.map((e, j) => (j === k ? nova : e)) });

	return (
		<Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
			<DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" showCloseButton={!salvando}>
				<DialogHeader>
					<DialogTitle>Treino de {rotuloData}</DialogTitle>
					<DialogDescription>
						{modo === "musculacao"
							? "Escolha um dos treinos da academia para este dia; depois ele vai para o app e para o relógio."
							: "Comece por um modelo (método Jack Daniels) e monte do seu jeito: blocos que se repetem, com quantas etapas quiser (ex.: fartlek 3× de 1,5 km Z2 + 1 km Z3 + 500 m Z3)."}
					</DialogDescription>
				</DialogHeader>

				<div role="tablist" aria-label="Tipo de treino" className="flex w-fit rounded-md border p-0.5">
					{(
						[
							["corrida", "Corrida"],
							["musculacao", "Musculação"],
						] as const
					).map(([id, rotulo]) => (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={modo === id}
							onClick={() => setModo(id)}
							className={
								"rounded px-3 py-1 text-sm font-medium transition-colors " +
								(modo === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
							}>
							{rotulo}
							{id === "musculacao" && musculacaoInicial && " ✓"}
							{id === "corrida" && inicial && " ✓"}
						</button>
					))}
				</div>

				{modo === "musculacao" ? (
					<MusculacaoEditor data={data} inicial={musculacaoInicial} onClose={onClose} />
				) : (
				<>
				<div className="grid gap-4">
					<div className="flex flex-wrap gap-1.5" role="group" aria-label="Modelos">
						{MODELOS.map((m) => (
							<button
								key={m.id}
								type="button"
								title={m.descricao}
								onClick={() => setForm(formDeDados(m.criar(data)))}
								className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent">
								{m.daniels !== "—" && <span className="mr-1 text-muted-foreground">{m.daniels}</span>}
								{m.nome}
							</button>
						))}
					</div>

					<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
						<label className="grid gap-1 text-sm">
							Título
							<Input value={form.titulo} maxLength={80} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
						</label>
						<label className="grid gap-1 text-sm">
							Tipo
							<select
								className={SELECT}
								value={form.tipo}
								onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoTreino })}>
								{(Object.keys(ROTULO_TIPO) as TipoTreino[]).map((t) => (
									<option key={t} value={t}>
										{ROTULO_TIPO[t]}
									</option>
								))}
							</select>
						</label>
					</div>

					{form.tipo !== "descanso" && (
						<>
							{previa && previa.blocos.length > 0 && (
								<div className="grid gap-3 rounded-2xl border bg-card p-4">
									<div className="flex flex-wrap items-baseline justify-between gap-2">
										<p className="font-semibold">{form.titulo || "Treino"}</p>
										<p className="text-sm text-muted-foreground tabular-nums">
											Distância total: <span className="font-medium text-foreground">{km.toFixed(1).replace(".", ",")} km</span>
											{" · "}Tempo total: <span className="font-medium text-foreground">{formatarDuracao(seg)}</span>
										</p>
									</div>
									<TreinoGrafico treino={previa} altura={56} />
								</div>
							)}

							<div className="grid gap-2 rounded-xl border p-3">
								<Alternar
									rotulo="Aquecimento"
									ligado={form.aquecimento !== null}
									onChange={(v) => setForm({ ...form, aquecimento: v ? VAZIA(1, "min") : null })}
								/>
								{form.aquecimento && (
									<CamposMeta
										rotulo="Aquecimento"
										valor={form.aquecimento}
										onChange={(v) => setForm({ ...form, aquecimento: v })}
									/>
								)}
							</div>

							{form.blocos.map((b, i) => (
								<div key={i} className="overflow-hidden rounded-xl border">
									<div className="flex flex-wrap items-center justify-between gap-2 bg-muted px-3 py-2">
										<label className="flex items-center gap-2 text-sm font-semibold">
											<Repeat size={16} className="text-muted-foreground" />
											Repetir
											<Input
												inputMode="numeric"
												className="h-8 w-16 bg-background"
												value={b.repeticoes}
												onChange={(e) => atualizaBloco(i, { repeticoes: e.target.value })}
												aria-label={`Bloco ${i + 1}: repetições`}
											/>
											×
										</label>
										<div className="flex items-center gap-1">
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												aria-label="Subir bloco"
												disabled={i === 0}
												onClick={() => setBlocos(mover(form.blocos, i, i - 1))}>
												<ArrowUp size={14} />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												aria-label="Descer bloco"
												disabled={i === form.blocos.length - 1}
												onClick={() => setBlocos(mover(form.blocos, i, i + 1))}>
												<ArrowDown size={14} />
											</Button>
											{form.blocos.length > 1 && (
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													aria-label="Remover bloco"
													onClick={() => setBlocos(form.blocos.filter((_, j) => j !== i))}>
													<Trash2 size={14} />
												</Button>
											)}
										</div>
									</div>

									<ul className="grid gap-2 p-3">
										{b.etapas.map((e, k) => (
											<li
												key={k}
												className="grid gap-2 rounded-lg border bg-background p-2.5"
												style={{ borderLeft: `4px solid ${COR_ZONA[e.zona]}` }}>
												<div className="flex flex-wrap items-center justify-between gap-2">
													<select
														className={SELECT}
														value={e.papel}
														onChange={(ev) => atualizaEtapa(i, k, { ...e, papel: ev.target.value as PapelEditavel })}
														aria-label={`Bloco ${i + 1}, etapa ${k + 1}: tipo`}>
														<option value="trabalho">Corrida</option>
														<option value="recuperacao">Recuperação</option>
													</select>
													<div className="flex items-center gap-1">
														<Button
															type="button"
															variant="ghost"
															size="icon-sm"
															aria-label="Subir etapa"
															disabled={k === 0}
															onClick={() => atualizaBloco(i, { etapas: mover(b.etapas, k, k - 1) })}>
															<ArrowUp size={14} />
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="icon-sm"
															aria-label="Descer etapa"
															disabled={k === b.etapas.length - 1}
															onClick={() => atualizaBloco(i, { etapas: mover(b.etapas, k, k + 1) })}>
															<ArrowDown size={14} />
														</Button>
														{b.etapas.length > 1 && (
															<Button
																type="button"
																variant="ghost"
																size="icon-sm"
																aria-label="Remover etapa"
																onClick={() => atualizaBloco(i, { etapas: b.etapas.filter((_, j) => j !== k) })}>
																<Trash2 size={14} />
															</Button>
														)}
													</div>
												</div>
												<CamposMeta
													rotulo={`Bloco ${i + 1}, etapa ${k + 1}`}
													valor={e}
													onChange={(v) => atualizaEtapa(i, k, { ...v, papel: e.papel })}
												/>
											</li>
										))}
									</ul>
									<div className="border-t px-3 py-2">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() =>
												atualizaBloco(i, {
													etapas: [...b.etapas, { ...VAZIA(b.etapas[b.etapas.length - 1]?.zona ?? 2), papel: "trabalho" }],
												})
											}>
											<Plus size={14} /> Adicionar etapa
										</Button>
									</div>
								</div>
							))}

							<Button
								type="button"
								variant="outline"
								size="sm"
								className="w-fit"
								onClick={() =>
									setBlocos([...form.blocos, { repeticoes: "1", etapas: [{ ...VAZIA(2), papel: "trabalho" }] }])
								}>
								<Plus size={14} /> Adicionar bloco
							</Button>

							<div className="grid gap-2 rounded-xl border p-3">
								<Alternar
									rotulo="Desaquecimento"
									ligado={form.desaquecimento !== null}
									onChange={(v) => setForm({ ...form, desaquecimento: v ? VAZIA(1, "min") : null })}
								/>
								{form.desaquecimento && (
									<CamposMeta
										rotulo="Desaquecimento"
										valor={form.desaquecimento}
										onChange={(v) => setForm({ ...form, desaquecimento: v })}
									/>
								)}
							</div>

							{previa && previa.blocos.length > 0 && (
								<div className="rounded-2xl border bg-muted/40 p-4">
									<div className="mb-2 flex items-center justify-between">
										<p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Treino prescrito</p>
										<Button type="button" variant="ghost" size="icon-sm" aria-label="Copiar treino" onClick={copiar}>
											<Copy size={14} />
										</Button>
									</div>
									<pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
										{textoPrescrito(previa)}
									</pre>
								</div>
							)}
						</>
					)}

					<label className="grid gap-1 text-sm">
						Observação (opcional)
						<Textarea
							rows={2}
							value={form.observacao}
							maxLength={500}
							onChange={(e) => setForm({ ...form, observacao: e.target.value })}
						/>
					</label>
				</div>

				<DialogFooter className="gap-2 sm:justify-between">
					{inicial ? (
						<Button type="button" variant="ghost" disabled={salvando} onClick={remover}>
							Excluir treino
						</Button>
					) : (
						<span />
					)}
					<div className="flex gap-2">
						<Button type="button" variant="outline" disabled={salvando} onClick={onClose}>
							Cancelar
						</Button>
						<Button type="button" disabled={salvando} onClick={salvar}>
							{salvando ? "Salvando..." : "Salvar"}
						</Button>
					</div>
				</DialogFooter>
				</>
				)}
			</DialogContent>
		</Dialog>
	);
}
