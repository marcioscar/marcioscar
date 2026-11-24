"use client";

import * as React from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DialogFooter } from "~/components/ui/dialog";
import {
	estimarMinutosMusculacao,
	paraPlanejado,
	semanaIso,
	type ExercicioPlanejado,
	type GrupoAcademia,
	type TreinoMusculacaoDados,
} from "~/lib/musculacao";

type Catalogo = { ano: number; semana: number; fonte: "quattor" | "copia-local"; grupos: GrupoAcademia[] };
type ExercicioForm = ExercicioPlanejado & { incluido: boolean };

type Props = {
	data: string;
	inicial: TreinoMusculacaoDados | null;
	onClose: () => void;
};

function paraForm(exercicios: ExercicioPlanejado[]): ExercicioForm[] {
	return exercicios.map((e) => ({ ...e, incluido: true }));
}

/** Escolhe um dos treinos da academia (por semana e grupo) e a data; os exercícios podem ser ajustados. */
export function MusculacaoEditor({ data, inicial, onClose }: Props) {
	const carregador = useFetcher<Catalogo & { error?: string }>();
	const gravador = useFetcher<{ ok: boolean; message?: string }>();
	const salvando = gravador.state !== "idle";
	const esperando = React.useRef(false);

	const inicio = semanaIso(data);
	const [semana, setSemana] = React.useState(inicio);
	const [grupo, setGrupo] = React.useState<string | null>(inicial?.grupo ?? null);
	const [exercicios, setExercicios] = React.useState<ExercicioForm[]>(inicial ? paraForm(inicial.exercicios) : []);
	const [descanso, setDescanso] = React.useState(String(inicial?.descansoSeg ?? 60));
	const [observacao, setObservacao] = React.useState(inicial?.observacao ?? "");

	React.useEffect(() => {
		carregador.load(`/api/musculacao-grupos?ano=${semana.ano}&semana=${semana.semana}`);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [semana.ano, semana.semana]);

	React.useEffect(() => {
		if (gravador.state !== "idle" || !gravador.data || !esperando.current) return;
		esperando.current = false;
		if (gravador.data.ok) {
			toast.success(gravador.data.message ?? "Musculação salva.");
			onClose();
		} else {
			toast.error(gravador.data.message ?? "Não foi possível salvar.");
		}
	}, [gravador.state, gravador.data, onClose]);

	const catalogo = carregador.data && !carregador.data.error ? carregador.data : null;

	function escolher(g: GrupoAcademia) {
		setGrupo(g.grupo);
		setExercicios(paraForm(g.exercicios.map(paraPlanejado)));
	}

	function mudarSemana(delta: number) {
		// anda semana a semana, virando o ano pelo calendário ISO
		const base = new Date(`${data}T12:00:00Z`);
		const atual = semana;
		const alvo = new Date(base);
		const diff = (atual.ano - inicio.ano) * 53 + (atual.semana - inicio.semana) + delta;
		alvo.setUTCDate(base.getUTCDate() + diff * 7);
		setSemana(semanaIso(alvo.toISOString().slice(0, 10)));
	}

	const escolhidos = exercicios.filter((e) => e.incluido);
	const previa: TreinoMusculacaoDados = {
		data,
		grupo: grupo ?? "",
		descansoSeg: Math.max(parseInt(descanso, 10) || 60, 15),
		exercicios: escolhidos,
		observacao: null,
	};

	function salvar() {
		if (!grupo || escolhidos.length === 0) {
			toast.error("Escolha um treino e deixe ao menos um exercício marcado.");
			return;
		}
		esperando.current = true;
		gravador.submit(
			{
				intent: "salvarMusculacao",
				treino: JSON.stringify({
					data,
					grupo,
					descansoSeg: previa.descansoSeg,
					exercicios: escolhidos.map(({ incluido: _i, ...e }) => e),
					observacao: observacao.trim() || null,
				}),
			},
			{ method: "post", action: "/treinos" },
		);
	}

	function remover() {
		esperando.current = true;
		gravador.submit({ intent: "removerMusculacao", data }, { method: "post", action: "/treinos" });
	}

	const atualizar = (i: number, parcial: Partial<ExercicioForm>) =>
		setExercicios((lista) => lista.map((e, j) => (j === i ? { ...e, ...parcial } : e)));

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2">
				<p className="text-sm">
					Treinos da academia · <span className="font-medium">semana {semana.semana}/{semana.ano}</span>
				</p>
				<div className="flex items-center gap-1">
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Semana anterior" onClick={() => mudarSemana(-1)}>
						<ChevronLeft size={16} />
					</Button>
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Próxima semana" onClick={() => mudarSemana(1)}>
						<ChevronRight size={16} />
					</Button>
				</div>
			</div>

			{carregador.state !== "idle" && <p className="text-sm text-muted-foreground">Carregando treinos da semana…</p>}
			{carregador.data?.error && <p className="text-sm text-perigo">{carregador.data.error}</p>}

			{catalogo && catalogo.grupos.length === 0 && carregador.state === "idle" && (
				<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
					Nenhum treino da academia encontrado para a semana {catalogo.semana}/{catalogo.ano}
					{catalogo.fonte === "copia-local"
						? ". O site está usando uma cópia local, que só tem as semanas importadas; para ler direto da academia falta configurar QUATTOR_DATABASE_URL."
						: "."}
				</p>
			)}

			{catalogo && catalogo.grupos.length > 0 && (
				<div className="flex flex-wrap gap-1.5" role="group" aria-label="Treinos da semana">
					{catalogo.grupos.map((g) => (
						<button
							key={g.grupo}
							type="button"
							aria-pressed={grupo === g.grupo}
							onClick={() => escolher(g)}
							className={
								"rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors " +
								(grupo === g.grupo ? "border-foreground bg-foreground text-background" : "hover:bg-accent")
							}>
							{g.grupo.toLowerCase()}
							<span className={grupo === g.grupo ? "ml-1 opacity-70" : "ml-1 text-muted-foreground"}>{g.exercicios.length}</span>
						</button>
					))}
				</div>
			)}

			{grupo && exercicios.length > 0 && (
				<div className="grid gap-3 rounded-2xl border p-3">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<p className="flex items-center gap-2 font-semibold capitalize">
							<Dumbbell size={16} className="text-muted-foreground" />
							{grupo.toLowerCase()}
						</p>
						<p className="text-sm text-muted-foreground tabular-nums">
							{escolhidos.length} exercícios · ~{estimarMinutosMusculacao(previa)} min
						</p>
					</div>

					<ul className="grid gap-1.5">
						{exercicios.map((e, i) => (
							<li key={`${e.nome}-${i}`} className="grid gap-1 rounded-lg border px-2.5 py-1.5">
								<div className="flex flex-wrap items-center gap-2">
									<input
										type="checkbox"
										className="size-4"
										checked={e.incluido}
										onChange={(ev) => atualizar(i, { incluido: ev.target.checked })}
										aria-label={`Incluir ${e.nome}`}
									/>
									<span className={"min-w-0 flex-1 text-sm font-medium " + (e.incluido ? "" : "text-muted-foreground line-through")}>
										{e.nome}
									</span>
									<div className="flex items-center gap-1 text-xs text-muted-foreground">
										<Input
											inputMode="numeric"
											className="h-8 w-12 px-2 text-center"
											value={e.series}
											onChange={(ev) => atualizar(i, { series: Math.min(Math.max(parseInt(ev.target.value, 10) || 1, 1), 12) })}
											aria-label={`${e.nome}: séries`}
										/>
										séries
										{!e.itens && (
											<>
												×
												<Input
													inputMode="numeric"
													className="h-8 w-12 px-2 text-center"
													value={e.repeticoes ?? ""}
													onChange={(ev) => atualizar(i, { repeticoes: parseInt(ev.target.value, 10) || null })}
													aria-label={`${e.nome}: repetições`}
												/>
												{e.nota && <span className="ml-1">{e.nota}</span>}
											</>
										)}
									</div>
								</div>
								{e.itens && (
									<ol className="ml-6 grid list-decimal gap-0.5 pl-3 text-xs text-muted-foreground">
										{e.itens.map((it) => (
											<li key={it.nome}>
												{it.nome}
												{it.duracaoSeg ? ` · ${it.duracaoSeg >= 60 && it.duracaoSeg % 60 === 0 ? `${it.duracaoSeg / 60} min` : `${it.duracaoSeg} s`}` : it.repeticoes ? ` · ${it.repeticoes} reps` : ""}
												{it.nota ? ` ${it.nota}` : ""}
											</li>
										))}
									</ol>
								)}
							</li>
						))}
					</ul>

					<div className="flex flex-wrap items-center gap-3">
						<label className="flex items-center gap-2 text-sm">
							Descanso entre séries
							<Input
								inputMode="numeric"
								className="h-8 w-16 px-2 text-center"
								value={descanso}
								onChange={(ev) => setDescanso(ev.target.value)}
								aria-label="Descanso entre séries em segundos"
							/>
							s
						</label>
					</div>
					<label className="grid gap-1 text-sm">
						Observação (opcional)
						<Input value={observacao} maxLength={300} onChange={(ev) => setObservacao(ev.target.value)} />
					</label>
				</div>
			)}

			<DialogFooter className="gap-2 sm:justify-between">
				{inicial ? (
					<Button type="button" variant="ghost" disabled={salvando} onClick={remover}>
						Excluir musculação
					</Button>
				) : (
					<span />
				)}
				<div className="flex gap-2">
					<Button type="button" variant="outline" disabled={salvando} onClick={onClose}>
						Cancelar
					</Button>
					<Button type="button" disabled={salvando || !grupo} onClick={salvar}>
						{salvando ? "Salvando..." : "Salvar"}
					</Button>
				</div>
			</DialogFooter>
		</div>
	);
}
