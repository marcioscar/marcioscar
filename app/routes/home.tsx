import { Link } from "react-router";
import type { Route } from "./+types/home";
import { HugeiconsIcon } from "@hugeicons/react";
import { Target01Icon } from "@hugeicons/core-free-icons";
import { halfMarathonPlan } from "~/data/halfMarathonPlan";
import { marathonPlan } from "~/data/marathonPlan";
import type { Phase } from "~/data/halfMarathonPlan";
import { planWeek, type DayOfWeek, type PlannedSession } from "~/lib/canovaPlanner";
import { obterTreinoTreinador } from "~/models/treino-treinador.server";
import { listarProvas } from "~/models/provas.server";
import { listarUltimasCorridas, type CorridaResumo } from "~/models/corridas.server";
import {
	obterTendenciaVolumeSemanal,
	obterResumoSemanaAtual,
	type VolumeSemanaItem,
	type CorridaSemanaAtual,
} from "~/models/corrida-dashboard.server";
import {
	obterLeituraTreinadorCache,
	gerarLeituraTreinador,
	type CoachInsight,
} from "~/models/coach-insight.server";
import { computeDaysUntilRace, computeCurrentWeek } from "~/lib/provaUtils";
import { parsePace, resolveWeeklyKm } from "~/lib/trainingPaceUtils";
import { CorridaHero } from "~/components/dashboard-corrida/corrida-hero";
import { CorridaKpiRow } from "~/components/dashboard-corrida/corrida-kpi-row";
import { CorridaSessoesSemana } from "~/components/dashboard-corrida/corrida-sessoes-semana";
import { CorridaVolumeChart } from "~/components/dashboard-corrida/corrida-volume-chart";
import { CorridaPacesTable } from "~/components/dashboard-corrida/corrida-paces-table";
import { CorridaCoachPanel } from "~/components/dashboard-corrida/corrida-coach-panel";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Corrida | Marcioscar" },
		{ name: "description", content: "Painel de corrida do Marcioscar" },
	];
}

const PLANS: Record<string, typeof halfMarathonPlan> = {
	meia: halfMarathonPlan,
	maratona: marathonPlan,
};

const DIAS_ORDEM: DayOfWeek[] = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function hojeLabel(): DayOfWeek {
	return DIAS_ORDEM[(new Date().getUTCDay() + 6) % 7];
}

function melhorPaceRecente(corridas: CorridaResumo[]): number | null {
	const candidatas = corridas.filter((c) => c.distanciaMetros >= 10_000);
	const lista = candidatas.length > 0 ? candidatas : corridas;
	if (lista.length === 0) return null;
	const paces = lista.map((c) => c.tempoMovimentoSeg / (c.distanciaMetros / 1000));
	return Math.min(...paces);
}

function fcMaximaReferencia(corridas: CorridaResumo[]): number | null {
	const valores = corridas.map((c) => c.frequenciaMaxima ?? 0).filter((v) => v > 0);
	if (valores.length === 0) return null;
	return Math.max(...valores);
}

type PlanoSemanaAtual = {
	numero: number;
	totalSemanas: number;
	fase: Phase;
	sessions: PlannedSession[];
	volumeFraction: number;
} | null;

type LoaderData = {
	provaAtiva: Awaited<ReturnType<typeof listarProvas>>[number] | null;
	planoSemanaAtual: PlanoSemanaAtual;
	daysUntilRace: number | null;
	distanciaKm: number;
	tendenciaVolume: VolumeSemanaItem[];
	resumoSemanaAtual: { kmSemana: number; sessoes: CorridaSemanaAtual[] };
	ultimasCorridas: CorridaResumo[];
	coachInsight: CoachInsight | null;
};

export async function loader(): Promise<LoaderData> {
	const provas = await listarProvas();
	const provaAtiva = provas.find((p) => p.ativa) ?? null;

	const [tendenciaVolume, resumoSemanaAtual, ultimasCorridas] = await Promise.all([
		obterTendenciaVolumeSemanal(8),
		obterResumoSemanaAtual(),
		listarUltimasCorridas(8),
	]);

	let planoSemanaAtual: PlanoSemanaAtual = null;
	let daysUntilRace: number | null = null;
	let distanciaKm = 21.1;
	let coachInsight: CoachInsight | null = null;

	if (provaAtiva) {
		const plan = PLANS[provaAtiva.plano] ?? halfMarathonPlan;
		distanciaKm = plan.distance === "42.2km" ? 42.2 : 21.1;
		daysUntilRace = computeDaysUntilRace(new Date(provaAtiva.dataProva));
		const numero = computeCurrentWeek(daysUntilRace, plan.totalWeeks);
		const weekPlan = numero ? plan.weeks.find((w) => w.number === numero) : null;

		if (numero && weekPlan) {
			// O plano-base é um template Canova em dias fixos. Reescrevemos a semana
			// exatamente nos dias que o atleta escolheu, preservando longão e trabalho
			// específico e redistribuindo o volume entre as sessões que sobram.
			// Treinos que o treinador prescreveu para esta semana ficam fixos;
			// o Canova completa os dias restantes.
			const doTreinador = await obterTreinoTreinador(provaAtiva.id, numero);
			const sessionsDoAtleta = planWeek(
				weekPlan,
				provaAtiva.diasTreino as DayOfWeek[],
				resolveWeeklyKm(weekPlan.volumeFraction, provaAtiva.kmSemanais),
				provaAtiva.plano,
				{ coachSessions: doTreinador, targetPace: provaAtiva.paceAlvo },
			);

			planoSemanaAtual = {
				numero,
				totalSemanas: plan.totalWeeks,
				fase: weekPlan.phase,
				sessions: sessionsDoAtleta,
				volumeFraction: weekPlan.volumeFraction,
			};
		}

		coachInsight = await obterLeituraTreinadorCache(provaAtiva.id);
	}

	return {
		provaAtiva,
		planoSemanaAtual,
		daysUntilRace,
		distanciaKm,
		tendenciaVolume,
		resumoSemanaAtual,
		ultimasCorridas,
		coachInsight,
	};
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("_intent");

	if (intent === "gerarLeituraTreinador") {
		const provas = await listarProvas();
		const provaAtiva = provas.find((p) => p.ativa) ?? null;
		if (!provaAtiva) {
			return { ok: false, message: "Nenhuma prova ativa cadastrada." };
		}

		try {
			const insight = await gerarLeituraTreinador(provaAtiva);
			return { ok: true, insight };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Falha ao gerar leitura.";
			return { ok: false, message };
		}
	}

	return { ok: false };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const {
		provaAtiva,
		planoSemanaAtual,
		daysUntilRace,
		distanciaKm,
		tendenciaVolume,
		resumoSemanaAtual,
		ultimasCorridas,
		coachInsight,
	} = loaderData;

	const paceAlvoSeg = provaAtiva ? parsePace(provaAtiva.paceAlvo) : null;
	const kmSemanaAlvo = provaAtiva
		? planoSemanaAtual
			? resolveWeeklyKm(planoSemanaAtual.volumeFraction, provaAtiva.kmSemanais)
			: provaAtiva.kmSemanais
		: 0;

	return (
		<main className="grid gap-4 md:gap-6">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h1 className="text-2xl font-bold">Corrida</h1>
			</div>

			{provaAtiva && paceAlvoSeg !== null && daysUntilRace !== null ? (
				<>
					<CorridaHero
						provaNome={provaAtiva.nome}
						dataProva={new Date(provaAtiva.dataProva).toISOString()}
						diasRestantes={daysUntilRace}
						paceAlvo={provaAtiva.paceAlvo}
						distanciaKm={distanciaKm}
						faseAtual={planoSemanaAtual?.fase ?? null}
						semanaAtual={planoSemanaAtual?.numero ?? null}
						totalSemanas={planoSemanaAtual?.totalSemanas ?? 0}
					/>

					<CorridaKpiRow
						kmSemana={resumoSemanaAtual.kmSemana}
						kmSemanaAlvo={kmSemanaAlvo}
						melhorPaceRecenteSeg={melhorPaceRecente(ultimasCorridas)}
						paceAlvoSeg={paceAlvoSeg}
						sessoesFeitas={resumoSemanaAtual.sessoes.length}
						sessoesPlanejadas={planoSemanaAtual?.sessions.length ?? provaAtiva.diasTreino.length}
					/>

					{planoSemanaAtual && (
						<section className="grid gap-2">
							<h2 className="text-lg font-semibold">
								Treinos da semana · semana {planoSemanaAtual.numero} de {planoSemanaAtual.totalSemanas}
							</h2>
							<CorridaSessoesSemana
								sessions={planoSemanaAtual.sessions}
								targetPace={provaAtiva.paceAlvo}
								corridasSemana={resumoSemanaAtual.sessoes}
								hojeLabel={hojeLabel()}
							/>
						</section>
					)}
				</>
			) : (
				<div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-8 text-center">
					<HugeiconsIcon icon={Target01Icon} className="size-6 text-muted-foreground" />
					<p className="text-sm text-muted-foreground">
						Nenhuma prova ativa cadastrada. Cadastre uma em{" "}
						<Link to="/treinamento" className="font-medium text-foreground hover:underline">
							Treinamento
						</Link>{" "}
						para ver contagem regressiva, plano da semana e a leitura do treinador aqui.
					</p>
				</div>
			)}

			<CorridaVolumeChart dados={tendenciaVolume} />

			<CorridaPacesTable
				corridas={ultimasCorridas}
				paceAlvoSeg={paceAlvoSeg ?? parsePace("5:00")}
				fcMaximaReferencia={fcMaximaReferencia(ultimasCorridas)}
			/>

			{provaAtiva && <CorridaCoachPanel insight={coachInsight} />}
		</main>
	);
}
