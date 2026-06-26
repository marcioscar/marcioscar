import { BookOpen, BookMarked, Library, FileText, BookCopy, ScrollText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card";
import type { EstatisticasBiblioteca } from "~/models/biblioteca.server";

function formatarInteiro(n: number): string {
	return n.toLocaleString("pt-BR");
}

type BibliotecaEstatisticasProps = {
	stats: EstatisticasBiblioteca;
};

const COR_LIVROS = "#a855f7";
const COR_PAGINAS = "#6366f1";

type StatCardProps = {
	label: string;
	value: string;
	caption: string;
	icon: React.ElementType;
	cor: string;
};

function StatCard({ label, value, caption, icon: Icone, cor }: StatCardProps) {
	return (
		<Card
			className="min-w-0 overflow-hidden"
			style={{ borderTop: `3px solid ${cor}` }}>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<CardDescription className="text-xs font-medium">
						{label}
					</CardDescription>
					<div
						className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
						style={{ background: `${cor}20` }}>
						<Icone size={13} style={{ color: cor }} />
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				<p className="text-xl font-bold tabular-nums">{value}</p>
				<p className="mt-1 text-xs text-muted-foreground">{caption}</p>
			</CardContent>
		</Card>
	);
}

export function BibliotecaEstatisticas({ stats }: BibliotecaEstatisticasProps) {
	return (
		<section className="grid min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<StatCard
				label="Livros no mês"
				value={formatarInteiro(stats.livrosMesAtual)}
				caption={stats.rotuloMes}
				icon={BookOpen}
				cor={COR_LIVROS}
			/>
			<StatCard
				label="Livros no ano"
				value={formatarInteiro(stats.livrosAnoAtual)}
				caption={`Ano ${stats.rotuloAno}`}
				icon={BookMarked}
				cor={COR_LIVROS}
			/>
			<StatCard
				label="Total de livros"
				value={formatarInteiro(stats.livrosTotal)}
				caption="Todos os registros da biblioteca"
				icon={Library}
				cor={COR_LIVROS}
			/>
			<StatCard
				label="Páginas no mês"
				value={formatarInteiro(stats.paginasMesAtual)}
				caption="Páginas lidas no mês"
				icon={FileText}
				cor={COR_PAGINAS}
			/>
			<StatCard
				label="Páginas no ano"
				value={formatarInteiro(stats.paginasAnoAtual)}
				caption="Páginas lidas no ano"
				icon={BookCopy}
				cor={COR_PAGINAS}
			/>
			<StatCard
				label="Páginas no total"
				value={formatarInteiro(stats.paginasTotal)}
				caption="Páginas lidas no total"
				icon={ScrollText}
				cor={COR_PAGINAS}
			/>
		</section>
	);
}
