import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { EstatisticasBiblioteca } from "~/models/biblioteca.server";

function formatarInteiro(n: number): string {
	return n.toLocaleString("pt-BR");
}

/** Gradiente vertical (cima → baixo): branco → verde escuro */
const cardEstatisticaClass = cn(
	"min-w-0 overflow-hidden border-0 shadow-sm ring-1 ring-olive-900/25",
	"bg-linear-to-b from-white  to-olive-600/35",
	"dark:from-zinc-900 dark:via-olive-800/50 dark:to-olive-900 dark:ring-olive-900/40",
);

const descClass = "text-olive-900/80 dark:text-olive-200/85";

const tituloValorClass =
	"text-2xl font-semibold tabular-nums text-olive-950 dark:text-white";

const rodapeClass =
	"break-words text-xs <text-olive-9></text-olive-9>00 dark:text-olive-600";

type BibliotecaEstatisticasProps = {
	stats: EstatisticasBiblioteca;
};

export function BibliotecaEstatisticas({ stats }: BibliotecaEstatisticasProps) {
	return (
		<section className='grid min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
			<Card className={cardEstatisticaClass}>
				<CardHeader className='pb-2'>
					<CardDescription className={descClass}>Livros no mês</CardDescription>
					<CardTitle className={tituloValorClass}>
						{formatarInteiro(stats.livrosMesAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className={cn(rodapeClass, "capitalize")}>
					{stats.rotuloMes}
				</CardContent>
			</Card>

			<Card className={cardEstatisticaClass}>
				<CardHeader className='pb-2'>
					<CardDescription className={descClass}>Livros no ano</CardDescription>
					<CardTitle className={tituloValorClass}>
						{formatarInteiro(stats.livrosAnoAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className={rodapeClass}>Ano {stats.rotuloAno}</CardContent>
			</Card>

			<Card className={cardEstatisticaClass}>
				<CardHeader className='pb-2'>
					<CardDescription className={descClass}>
						Total de livros
					</CardDescription>
					<CardTitle className={tituloValorClass}>
						{formatarInteiro(stats.livrosTotal)}
					</CardTitle>
				</CardHeader>
				<CardContent className={rodapeClass}>
					Todos os registros da biblioteca
				</CardContent>
			</Card>

			<Card className={cardEstatisticaClass}>
				<CardHeader className='pb-2'>
					<CardDescription className={descClass}>
						Páginas no mês
					</CardDescription>
					<CardTitle className={tituloValorClass}>
						{formatarInteiro(stats.paginasMesAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className={rodapeClass}>Páginas lidas no mês</CardContent>
			</Card>

			<Card className={cardEstatisticaClass}>
				<CardHeader className='pb-2'>
					<CardDescription className={descClass}>
						Páginas no ano
					</CardDescription>
					<CardTitle className={tituloValorClass}>
						{formatarInteiro(stats.paginasAnoAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className={rodapeClass}>Páginas lidas no ano</CardContent>
			</Card>

			<Card className={cardEstatisticaClass}>
				<CardHeader className='pb-2'>
					<CardDescription className={descClass}>
						Páginas no total
					</CardDescription>
					<CardTitle className={tituloValorClass}>
						{formatarInteiro(stats.paginasTotal)}
					</CardTitle>
				</CardHeader>
				<CardContent className={rodapeClass}>
					Páginas lidas no total
				</CardContent>
			</Card>
		</section>
	);
}
