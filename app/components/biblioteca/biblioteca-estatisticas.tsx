import { BookOpen, FileText } from "lucide-react";
import type { EstatisticasBiblioteca } from "~/models/biblioteca.server";

function formatarInteiro(n: number): string {
	return n.toLocaleString("pt-BR");
}

type BibliotecaEstatisticasProps = {
	stats: EstatisticasBiblioteca;
};

const COR_LIVROS = "var(--paleta-6)";
const COR_PAGINAS = "var(--paleta-4)";

type FaixaProps = {
	titulo: string;
	icon: React.ElementType;
	cor: string;
	itens: { label: string; valor: number }[];
};

function Faixa({ titulo, icon: Icone, cor, itens }: FaixaProps) {
	return (
		<div className="min-w-0 rounded-2xl border border-border bg-card px-4 py-3.5">
			<p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
				<Icone size={13} style={{ color: cor }} />
				{titulo}
			</p>
			<dl className="mt-2 grid grid-cols-3 gap-3">
				{itens.map((item) => (
					<div key={item.label} className="min-w-0">
						<dd className="text-2xl font-bold tabular-nums">
							{formatarInteiro(item.valor)}
						</dd>
						<dt className="truncate text-xs text-muted-foreground">
							{item.label}
						</dt>
					</div>
				))}
			</dl>
		</div>
	);
}

export function BibliotecaEstatisticas({ stats }: BibliotecaEstatisticasProps) {
	return (
		<section className="grid min-w-0 max-w-full gap-3 md:grid-cols-2">
			<Faixa
				titulo="Livros lidos"
				icon={BookOpen}
				cor={COR_LIVROS}
				itens={[
					{ label: stats.rotuloMes, valor: stats.livrosMesAtual },
					{ label: `em ${stats.rotuloAno}`, valor: stats.livrosAnoAtual },
					{ label: "no total", valor: stats.livrosTotal },
				]}
			/>
			<Faixa
				titulo="Páginas lidas"
				icon={FileText}
				cor={COR_PAGINAS}
				itens={[
					{ label: stats.rotuloMes, valor: stats.paginasMesAtual },
					{ label: `em ${stats.rotuloAno}`, valor: stats.paginasAnoAtual },
					{ label: "no total", valor: stats.paginasTotal },
				]}
			/>
		</section>
	);
}
