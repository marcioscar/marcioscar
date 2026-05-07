import { db } from "../../db.server";

export type LivroAtualizavel = {
	nome: string;
	data: Date;
	capa: string;
	citacao: string;
	nota: string;
	autor: string;
	paginas: number | null;
};

export type EstatisticasBiblioteca = {
	livrosMesAtual: number;
	livrosAnoAtual: number;
	livrosTotal: number;
	paginasMesAtual: number;
	paginasAnoAtual: number;
	paginasTotal: number;
	rotuloMes: string;
	rotuloAno: string;
};

const CODIGOS_PRISMA_RETRYABLE = new Set([
	"P1001",
	"P1002",
	"P1008",
	"P1017",
	"P2010",
]);

export async function listarLivros() {
	return db.biblioteca.findMany({
		orderBy: { data: "desc" },
	});
}

export async function atualizarLivro(id: string, dados: LivroAtualizavel) {
	return db.biblioteca.update({
		where: { id },
		data: dados,
	});
}

export async function criarLivro(dados: LivroAtualizavel) {
	return db.biblioteca.create({
		data: dados,
	});
}

function limitesMesAtualUTC(referencia: Date): { inicio: Date; fim: Date } {
	const ano = referencia.getUTCFullYear();
	const mes = referencia.getUTCMonth();
	const inicio = new Date(Date.UTC(ano, mes, 1, 0, 0, 0, 0));
	const fim = new Date(Date.UTC(ano, mes + 1, 0, 23, 59, 59, 999));
	return { inicio, fim };
}

function limitesAnoAtualUTC(referencia: Date): { inicio: Date; fim: Date } {
	const ano = referencia.getUTCFullYear();
	const inicio = new Date(Date.UTC(ano, 0, 1, 0, 0, 0, 0));
	const fim = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999));
	return { inicio, fim };
}

function rotuloMesPt(referencia: Date): string {
	return referencia.toLocaleDateString("pt-BR", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

function rotuloAnoPt(referencia: Date): string {
	return String(referencia.getUTCFullYear());
}

function aguardar(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function extrairCodeErroPrisma(error: unknown): string | null {
	if (!error || typeof error !== "object") {
		return null;
	}
	const code = (error as { code?: unknown }).code;
	return typeof code === "string" ? code : null;
}

function extrairMensagemErroPrisma(error: unknown): string {
	if (!error || typeof error !== "object") {
		return "";
	}

	const message = (error as { message?: unknown }).message;
	const metaMessage = (error as { meta?: { message?: unknown } }).meta?.message;

	return [message, metaMessage]
		.filter((value): value is string => typeof value === "string")
		.join(" ")
		.toLowerCase();
}

function ehErroPrismaRetryable(error: unknown): boolean {
	const code = extrairCodeErroPrisma(error);
	if (code && CODIGOS_PRISMA_RETRYABLE.has(code)) {
		return true;
	}

	const mensagem = extrairMensagemErroPrisma(error);
	return (
		mensagem.includes("timed out") ||
		mensagem.includes("retryablewriteerror") ||
		mensagem.includes("i/o error")
	);
}

async function executarComRetry<T>(
	operacao: () => Promise<T>,
	maxTentativas = 3,
): Promise<T> {
	let erroAnterior: unknown;

	for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
		try {
			return await operacao();
		} catch (error) {
			erroAnterior = error;
			const podeTentarNovamente = ehErroPrismaRetryable(error);
			const ehUltimaTentativa = tentativa === maxTentativas;
			if (!podeTentarNovamente || ehUltimaTentativa) {
				throw error;
			}

			await aguardar(150 * tentativa);
		}
	}

	throw erroAnterior;
}

async function contarLivrosPorFiltro(where?: { data: { gte: Date; lte: Date } }) {
	return executarComRetry(() => db.biblioteca.count({ where }));
}

async function somarPaginasPorFiltro(where?: { data: { gte: Date; lte: Date } }) {
	const resultado = await executarComRetry(() =>
		db.biblioteca.aggregate({
			where,
			_sum: { paginas: true },
		}),
	);
	return resultado._sum.paginas ?? 0;
}

async function obterResumoPeriodo(where: { data: { gte: Date; lte: Date } }) {
	const [totalLivros, totalPaginas] = await Promise.all([
		contarLivrosPorFiltro(where),
		somarPaginasPorFiltro(where),
	]);
	return { totalLivros, totalPaginas };
}

async function obterResumoTotal() {
	const [totalLivros, totalPaginas] = await Promise.all([
		contarLivrosPorFiltro(),
		somarPaginasPorFiltro(),
	]);
	return { totalLivros, totalPaginas };
}

export async function obterEstatisticasBiblioteca(
	referencia: Date = new Date(),
): Promise<EstatisticasBiblioteca> {
	const { inicio: iniMes, fim: fimMes } = limitesMesAtualUTC(referencia);
	const { inicio: iniAno, fim: fimAno } = limitesAnoAtualUTC(referencia);

	const filtroMes = { data: { gte: iniMes, lte: fimMes } };
	const filtroAno = { data: { gte: iniAno, lte: fimAno } };

	const resumoMes = await obterResumoPeriodo(filtroMes);
	const resumoAno = await obterResumoPeriodo(filtroAno);
	const resumoTotal = await obterResumoTotal();

	return {
		livrosMesAtual: resumoMes.totalLivros,
		livrosAnoAtual: resumoAno.totalLivros,
		livrosTotal: resumoTotal.totalLivros,
		paginasMesAtual: resumoMes.totalPaginas,
		paginasAnoAtual: resumoAno.totalPaginas,
		paginasTotal: resumoTotal.totalPaginas,
		rotuloMes: rotuloMesPt(referencia),
		rotuloAno: rotuloAnoPt(referencia),
	};
}
