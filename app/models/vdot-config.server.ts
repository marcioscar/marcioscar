import { db } from "../../db.server";
import { VPONTO_PADRAO, VPONTO_PADRAO_DESDE, VPONTO_PADRAO_ORIGEM, limitesDasZonas } from "~/lib/vdot";
import { definirVponto, vpontoEmUso } from "~/lib/zonas-pace";

export type VpontoConfigurado = {
	vponto: number;
	desde: string;
	origem: string;
};

export type RegistroVponto = VpontoConfigurado & { treinosAjustados: number };

// leitura do banco no máximo a cada 30 s (e logo após aplicar um novo valor)
let ultimaLeitura = 0;
const VALIDADE_MS = 30_000;

/** Lê o VPONTO do banco e põe as zonas em uso. Chamar no início de loaders e actions que usam zonas. */
export async function garantirVponto(): Promise<void> {
	if (Date.now() - ultimaLeitura < VALIDADE_MS) return;
	try {
		const atual = await obterVpontoConfigurado();
		definirVponto(atual.vponto);
		ultimaLeitura = Date.now();
	} catch {
		// banco indisponível: segue com o valor que já estava em uso
	}
}

export async function obterVpontoConfigurado(): Promise<VpontoConfigurado> {
	const ultimo = await db.configVponto.findFirst({ orderBy: { createdAt: "desc" } });
	if (!ultimo) return { vponto: VPONTO_PADRAO, desde: VPONTO_PADRAO_DESDE, origem: VPONTO_PADRAO_ORIGEM };
	return { vponto: ultimo.vponto, desde: ultimo.createdAt.toISOString().slice(0, 10), origem: ultimo.origem };
}

export async function historicoVponto(): Promise<RegistroVponto[]> {
	const linhas = await db.configVponto.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
	const historico: RegistroVponto[] = linhas.map((l) => ({
		vponto: l.vponto,
		desde: l.createdAt.toISOString().slice(0, 10),
		origem: l.origem,
		treinosAjustados: l.treinosAjustados,
	}));
	// o valor inicial (antes de qualquer registro) também faz parte da história
	historico.push({ vponto: VPONTO_PADRAO, desde: VPONTO_PADRAO_DESDE, origem: VPONTO_PADRAO_ORIGEM, treinosAjustados: 0 });
	return historico;
}

type Etapa = { zona?: number | null; paceRapidoSeg?: number | null; paceLentoSeg?: number | null } & Record<string, unknown>;

/**
 * Treinos planejados guardam o pace da zona no dia em que foram montados. Ao mudar o VPONTO, os treinos
 * de hoje em diante que ainda usam o pace padrão da zona antiga passam para o da nova. Etapas com pace
 * escolhido à mão ficam como estão.
 */
async function ajustarTreinosFuturos(vpontoAntigo: number, vpontoNovo: number): Promise<number> {
	const antigas = limitesDasZonas(vpontoAntigo);
	const novas = limitesDasZonas(vpontoNovo);
	const hoje = new Date().toISOString().slice(0, 10);
	const treinos = await db.treinoManual.findMany({ where: { data: { gte: hoje } } });

	const ajustar = (e: Etapa | null): boolean => {
		if (!e || !e.zona || e.zona < 1 || e.zona > 6) return false;
		const velha = antigas[e.zona - 1];
		if (e.paceLentoSeg !== velha.lento || e.paceRapidoSeg !== velha.rapido) return false;
		const nova = novas[e.zona - 1];
		e.paceLentoSeg = nova.lento;
		e.paceRapidoSeg = nova.rapido;
		return true;
	};

	let alterados = 0;
	for (const t of treinos) {
		const aquecimento = t.aquecimento as Etapa | null;
		const desaquecimento = t.desaquecimento as Etapa | null;
		const blocos = t.blocos as { etapas: Etapa[] }[];
		let mudou = ajustar(aquecimento);
		mudou = ajustar(desaquecimento) || mudou;
		for (const b of blocos ?? []) for (const e of b.etapas) mudou = ajustar(e) || mudou;
		if (!mudou) continue;
		await db.treinoManual.update({
			where: { id: t.id },
			data: {
				aquecimento: (aquecimento ?? undefined) as never,
				desaquecimento: (desaquecimento ?? undefined) as never,
				blocos: blocos as never,
			},
		});
		alterados++;
	}
	return alterados;
}

/** Grava o novo VPONTO, troca as zonas em uso e atualiza os treinos futuros. */
export async function aplicarVponto(vponto: number, origem: string): Promise<{ vponto: number; treinosAjustados: number }> {
	if (!Number.isFinite(vponto) || vponto < 36 || vponto > 52) throw new Error("O VPONTO precisa estar entre 36 e 52.");
	const valor = Math.round(vponto * 10) / 10;
	const anterior = vpontoEmUso();
	const treinosAjustados = valor === anterior ? 0 : await ajustarTreinosFuturos(anterior, valor);
	await db.configVponto.create({ data: { vponto: valor, origem: origem.slice(0, 200), treinosAjustados } });
	definirVponto(valor);
	ultimaLeitura = Date.now();
	return { vponto: valor, treinosAjustados };
}
