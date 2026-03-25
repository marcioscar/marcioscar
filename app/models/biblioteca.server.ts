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

export async function obterEstatisticasBiblioteca(
	referencia: Date = new Date(),
): Promise<EstatisticasBiblioteca> {
	const { inicio: iniMes, fim: fimMes } = limitesMesAtualUTC(referencia);
	const { inicio: iniAno, fim: fimAno } = limitesAnoAtualUTC(referencia);

	const filtroMes = { data: { gte: iniMes, lte: fimMes } };
	const filtroAno = { data: { gte: iniAno, lte: fimAno } };

	const [
		livrosMesAtual,
		livrosAnoAtual,
		livrosTotal,
		aggMes,
		aggAno,
		aggTotal,
	] = await Promise.all([
		db.biblioteca.count({ where: filtroMes }),
		db.biblioteca.count({ where: filtroAno }),
		db.biblioteca.count(),
		db.biblioteca.aggregate({
			where: filtroMes,
			_sum: { paginas: true },
		}),
		db.biblioteca.aggregate({
			where: filtroAno,
			_sum: { paginas: true },
		}),
		db.biblioteca.aggregate({
			_sum: { paginas: true },
		}),
	]);

	return {
		livrosMesAtual,
		livrosAnoAtual,
		livrosTotal,
		paginasMesAtual: aggMes._sum.paginas ?? 0,
		paginasAnoAtual: aggAno._sum.paginas ?? 0,
		paginasTotal: aggTotal._sum.paginas ?? 0,
		rotuloMes: rotuloMesPt(referencia),
		rotuloAno: rotuloAnoPt(referencia),
	};
}
