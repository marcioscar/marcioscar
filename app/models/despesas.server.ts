import { db } from "../../db.server";
import type { Prisma } from "@prisma/client";

export type DespesaResumo = {
	id: string;
	nome: string;
	categoria: string;
	valor: number;
	data: Date;
	brassaco: boolean;
	comprovante: string;
	conta: string;
	fatura: string | null;
	obs: string;
	createdAt: Date;
};

type CriarDespesaInput = {
	nome: string;
	categoria: string;
	valor: number;
	data: Date;
	brassaco: boolean;
	comprovante: string;
	conta: string;
	fatura?: string;
	obs?: string;
};

type AtualizarDespesaInput = {
	id: string;
	nome: string;
	categoria: string;
	valor: number;
	data: Date;
	brassaco: boolean;
	comprovante: string;
	conta: string;
	fatura?: string;
	obs?: string;
};

type IntervaloData = {
	inicio?: Date;
	fim?: Date;
};

function normalizarTextoObrigatorio(valor: string, campo: string): string {
	const texto = valor.trim();
	if (!texto) {
		throw new Error(`O campo "${campo}" e obrigatorio.`);
	}
	return texto;
}

function normalizarTextoOpcional(valor?: string): string {
	return valor?.trim() ?? "";
}

function parseObjectId(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (
		value &&
		typeof value === "object" &&
		"toHexString" in value &&
		typeof (value as { toHexString?: unknown }).toHexString === "function"
	) {
		const hex = (value as { toHexString: () => string }).toHexString();
		if (hex) {
			return hex;
		}
	}

	if (
		value &&
		typeof value === "object" &&
		"$oid" in value &&
		typeof (value as { $oid?: unknown }).$oid === "string"
	) {
		return (value as { $oid: string }).$oid;
	}

	if (value && typeof value === "object" && "toString" in value) {
		const text = String(value);
		if (text && text !== "[object Object]") {
			return text;
		}
	}

	return "";
}

function parseNumero(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseBoolean(value: unknown): boolean {
	return value === true;
}

function parseString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function parseStringOrNull(value: unknown): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "string") {
		return value;
	}

	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}

	if (
		value &&
		typeof value === "object" &&
		"$date" in value &&
		typeof (value as { $date?: unknown }).$date === "string"
	) {
		return (value as { $date: string }).$date;
	}

	return null;
}

function parseDate(value: unknown): Date {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	if (
		value &&
		typeof value === "object" &&
		"$date" in value &&
		typeof (value as { $date?: unknown }).$date === "string"
	) {
		const parsed = new Date((value as { $date: string }).$date);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	return new Date(0);
}

function mapRawDespesaToResumo(raw: unknown): DespesaResumo {
	const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

	return {
		id: parseObjectId(obj._id) || parseObjectId(obj.id),
		nome: parseString(obj.nome),
		categoria: parseString(obj.categoria),
		valor: parseNumero(obj.valor),
		data: parseDate(obj.data),
		brassaco: parseBoolean(obj.brassaco),
		comprovante: parseString(obj.comprovante),
		conta: parseString(obj.conta),
		fatura: parseStringOrNull(obj.fatura),
		obs: parseString(obj.obs),
		createdAt: parseDate(obj.createdAt),
	};
}

function toMongoDateJson(data: Date): Prisma.InputJsonObject {
	return { $date: data.toISOString() };
}

function montarFiltroData(
	intervaloData?: IntervaloData,
): Prisma.InputJsonObject {
	const inicio = intervaloData?.inicio;
	const fim = intervaloData?.fim;

	if (!inicio && !fim) {
		return {};
	}

	const filtroData: Record<string, Prisma.InputJsonObject> = {};
	if (inicio) {
		filtroData.$gte = toMongoDateJson(inicio);
	}
	if (fim) {
		filtroData.$lte = toMongoDateJson(fim);
	}

	return { data: filtroData } as Prisma.InputJsonObject;
}

export async function listarDespesas(
	intervaloData?: IntervaloData,
): Promise<DespesaResumo[]> {
	const resultado = (await db.$runCommandRaw({
		find: "despesas",
		filter: montarFiltroData(intervaloData),
		sort: { data: -1, createdAt: -1 },
	})) as {
		cursor?: {
			firstBatch?: unknown[];
		};
	};

	const firstBatch = resultado.cursor?.firstBatch ?? [];
	return firstBatch.map(mapRawDespesaToResumo);
}

export async function criarDespesa(input: CriarDespesaInput): Promise<void> {
	const nome = normalizarTextoObrigatorio(input.nome, "nome");
	const categoria = normalizarTextoObrigatorio(input.categoria, "categoria");
	const conta = normalizarTextoObrigatorio(input.conta, "conta");
	const comprovante = normalizarTextoOpcional(input.comprovante);
	const fatura = normalizarTextoOpcional(input.fatura);
	const obs = normalizarTextoOpcional(input.obs);

	await db.despesas.create({
		data: {
			nome,
			categoria,
			valor: input.valor,
			data: input.data,
			brassaco: input.brassaco,
			comprovante,
			conta,
			fatura: fatura || null,
			obs,
		},
	});
}

export async function atualizarDespesa(input: AtualizarDespesaInput): Promise<void> {
	const nome = normalizarTextoObrigatorio(input.nome, "nome");
	const categoria = normalizarTextoObrigatorio(input.categoria, "categoria");
	const conta = normalizarTextoObrigatorio(input.conta, "conta");
	const comprovante = normalizarTextoOpcional(input.comprovante);
	const fatura = normalizarTextoOpcional(input.fatura);
	const obs = normalizarTextoOpcional(input.obs);

	const resultado = await db.despesas.updateMany({
		where: { id: input.id },
		data: {
			nome,
			categoria,
			valor: input.valor,
			data: input.data,
			brassaco: input.brassaco,
			comprovante,
			conta,
			fatura: fatura || null,
			obs,
		},
	});

	if (resultado.count === 0) {
		throw new Error("Despesa nao encontrada para edicao.");
	}
}

export async function excluirDespesa(id: string): Promise<void> {
	const despesaId = normalizarTextoObrigatorio(id, "id");
	const resultado = await db.despesas.deleteMany({
		where: { id: despesaId },
	});

	if (resultado.count === 0) {
		throw new Error("Despesa nao encontrada para exclusao.");
	}
}
