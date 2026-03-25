import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";
import {
	statCardCaptionClass,
	statCardLabelClass,
	statCardMetricClass,
	statCardSurfaceClass,
} from "~/lib/stat-card-gradient";
import type { EstatisticasBiblioteca } from "~/models/biblioteca.server";

function formatarInteiro(n: number): string {
	return n.toLocaleString("pt-BR");
}

type BibliotecaEstatisticasProps = {
	stats: EstatisticasBiblioteca;
};

export function BibliotecaEstatisticas({ stats }: BibliotecaEstatisticasProps) {
	return (
		<section className="grid min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<Card className={statCardSurfaceClass}>
				<CardHeader className="pb-2">
					<CardDescription className={statCardLabelClass}>
						Livros no mês
					</CardDescription>
					<CardTitle className={statCardMetricClass}>
						{formatarInteiro(stats.livrosMesAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className={cn(statCardCaptionClass, "capitalize")}>
					{stats.rotuloMes}
				</CardContent>
			</Card>

			<Card className={statCardSurfaceClass}>
				<CardHeader className="pb-2">
					<CardDescription className={statCardLabelClass}>
						Livros no ano
					</CardDescription>
					<CardTitle className={statCardMetricClass}>
						{formatarInteiro(stats.livrosAnoAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className={statCardCaptionClass}>
					Ano {stats.rotuloAno}
				</CardContent>
			</Card>

			<Card className={statCardSurfaceClass}>
				<CardHeader className="pb-2">
					<CardDescription className={statCardLabelClass}>
						Total de livros
					</CardDescription>
					<CardTitle className={statCardMetricClass}>
						{formatarInteiro(stats.livrosTotal)}
					</CardTitle>
				</CardHeader>
				<CardContent className={statCardCaptionClass}>
					Todos os registros da biblioteca
				</CardContent>
			</Card>

			<Card className={statCardSurfaceClass}>
				<CardHeader className="pb-2">
					<CardDescription className={statCardLabelClass}>
						Páginas no mês
					</CardDescription>
					<CardTitle className={statCardMetricClass}>
						{formatarInteiro(stats.paginasMesAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className={statCardCaptionClass}>
					Páginas lidas no mês
				</CardContent>
			</Card>

			<Card className={statCardSurfaceClass}>
				<CardHeader className="pb-2">
					<CardDescription className={statCardLabelClass}>
						Páginas no ano
					</CardDescription>
					<CardTitle className={statCardMetricClass}>
						{formatarInteiro(stats.paginasAnoAtual)}
					</CardTitle>
				</CardHeader>
				<CardContent className={statCardCaptionClass}>
					Páginas lidas no ano
				</CardContent>
			</Card>

			<Card className={statCardSurfaceClass}>
				<CardHeader className="pb-2">
					<CardDescription className={statCardLabelClass}>
						Páginas no total
					</CardDescription>
					<CardTitle className={statCardMetricClass}>
						{formatarInteiro(stats.paginasTotal)}
					</CardTitle>
				</CardHeader>
				<CardContent className={statCardCaptionClass}>
					Páginas lidas no total
				</CardContent>
			</Card>
		</section>
	);
}
