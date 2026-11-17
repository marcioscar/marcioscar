import { useMemo } from "react";
import type { LivroDataTableRow } from "./biblioteca-columns";
import { CapaLivro } from "./capa-livro";

type BibliotecaEstanteProps = {
	livros: LivroDataTableRow[];
	onAbrir: (livro: LivroDataTableRow) => void;
};

function anoDe(livro: LivroDataTableRow): number {
	return new Date(livro.data).getUTCFullYear();
}

export function BibliotecaEstante({ livros, onAbrir }: BibliotecaEstanteProps) {
	const grupos = useMemo(() => {
		const ordenados = [...livros].sort(
			(a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
		);
		const mapa = new Map<number, LivroDataTableRow[]>();
		for (const l of ordenados) {
			const ano = anoDe(l);
			mapa.set(ano, [...(mapa.get(ano) ?? []), l]);
		}
		return [...mapa.entries()];
	}, [livros]);

	if (livros.length === 0) {
		return (
			<p className='rounded-md border p-6 text-center text-sm text-muted-foreground'>
				Nenhum livro cadastrado ou nenhum resultado para a pesquisa.
			</p>
		);
	}

	return (
		<div className='grid gap-8'>
			{grupos.map(([ano, lista]) => {
				const paginas = lista.reduce((acc, l) => acc + (l.paginas ?? 0), 0);
				return (
					<section key={ano} aria-label={`Livros de ${ano}`}>
						<div className='mb-3 flex items-baseline gap-3'>
							<h3 className='font-serif text-2xl font-semibold'>{ano}</h3>
							<p className='text-sm text-muted-foreground'>
								{lista.length} {lista.length === 1 ? "livro" : "livros"}
								{paginas > 0 && ` · ${paginas.toLocaleString("pt-BR")} páginas`}
							</p>
						</div>
						<ul className='grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8'>
							{lista.map((livro) => (
								<li key={livro.id} className='min-w-0'>
									<button
										type='button'
										onClick={() => onAbrir(livro)}
										aria-label={`${livro.nome}, de ${livro.autor}`}
										className='group block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
										<div className='transition duration-200 group-hover:-translate-y-1.5 group-hover:shadow-xl group-focus-visible:-translate-y-1.5'>
											<CapaLivro nome={livro.nome} autor={livro.autor} capa={livro.capa} />
										</div>
										<p className='mt-2 line-clamp-2 text-xs font-medium leading-snug'>
											{livro.nome.split(":")[0]}
										</p>
										<p className='truncate text-xs text-muted-foreground'>{livro.autor}</p>
									</button>
								</li>
							))}
						</ul>
						{/* prateleira */}
						<div
							aria-hidden
							className='mt-1 h-1.5 rounded-full bg-gradient-to-b from-border to-transparent'
						/>
					</section>
				);
			})}
		</div>
	);
}
