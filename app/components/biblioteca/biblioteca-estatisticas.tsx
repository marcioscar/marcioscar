import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import type { EstatisticasBiblioteca } from "~/models/biblioteca.server";

function formatarInteiro(n: number): string {
	return n.toLocaleString("pt-BR");
}

type BibliotecaEstatisticasProps = {
	stats: EstatisticasBiblioteca;
};

export function BibliotecaEstatisticas({ stats }: BibliotecaEstatisticasProps) {
	return (
		<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<Card>
				<CardHeader className="pb-2">
					<CardDescription>Livros no mês</CardDescription>
					<CardTitle className="text-2xl tabular-nums">
						{formatarInteiro(stats.livrosMesAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-xs capitalize">
					{stats.rotuloMes} (data de leitura, UTC)
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardDescription>Livros no ano</CardDescription>
					<CardTitle className="text-2xl tabular-nums">
						{formatarInteiro(stats.livrosAnoAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-xs">
					Ano {stats.rotuloAno}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardDescription>Total de livros</CardDescription>
					<CardTitle className="text-2xl tabular-nums">
						{formatarInteiro(stats.livrosTotal)}
					</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-xs">
					Todos os registros da biblioteca
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardDescription>Páginas no mês</CardDescription>
					<CardTitle className="text-2xl tabular-nums">
						{formatarInteiro(stats.paginasMesAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-xs">
					Soma das páginas informadas nos livros do mês
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardDescription>Páginas no ano</CardDescription>
					<CardTitle className="text-2xl tabular-nums">
						{formatarInteiro(stats.paginasAnoAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-xs">
					Soma das páginas informadas nos livros do ano
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardDescription>Páginas no total</CardDescription>
					<CardTitle className="text-2xl tabular-nums">
						{formatarInteiro(stats.paginasTotal)}
					</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-xs">
					Soma de todas as páginas cadastradas
				</CardContent>
			</Card>
		</section>
	);
}
