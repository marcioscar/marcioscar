import { useState } from "react";
import { cn } from "~/lib/utils";

const TONS = [
	"var(--paleta-1)",
	"var(--paleta-2)",
	"var(--paleta-4)",
	"var(--paleta-5)",
	"var(--paleta-6)",
	"var(--paleta-8)",
];

function tomDoLivro(nome: string): string {
	let h = 0;
	for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	return TONS[h % TONS.length];
}

type CapaLivroProps = {
	nome: string;
	autor: string;
	capa: string;
	className?: string;
	// tamanho do texto da capa substituta
	grande?: boolean;
};

/** Capa 2:3. Sem imagem (ou se falhar ao carregar), mostra uma capa de cor com o título. */
export function CapaLivro({ nome, autor, capa, className, grande }: CapaLivroProps) {
	const [falhou, setFalhou] = useState(false);
	const url = capa.trim();
	const temImagem = /^https?:\/\//i.test(url) && !falhou;
	const tom = tomDoLivro(nome);

	return (
		<div
			className={cn(
				"relative aspect-[2/3] w-full overflow-hidden rounded-md bg-muted shadow-md",
				className,
			)}>
			{temImagem ? (
				<img
					src={url}
					alt={`Capa de ${nome}`}
					loading='lazy'
					referrerPolicy='no-referrer'
					onError={() => setFalhou(true)}
					className='size-full object-cover'
				/>
			) : (
				<div
					className='flex size-full flex-col justify-between p-3 text-white'
					style={{
						background: `linear-gradient(160deg, color-mix(in oklab, ${tom} 90%, white), color-mix(in oklab, ${tom} 70%, black))`,
					}}>
					<p
						className={cn(
							"line-clamp-6 font-serif font-semibold leading-snug",
							grande ? "text-xl" : "text-sm",
						)}>
						{nome}
					</p>
					<p className={cn("line-clamp-2 opacity-85", grande ? "text-sm" : "text-xs")}>{autor}</p>
				</div>
			)}
			{/* lombada: sombra fina à esquerda, dá cara de livro */}
			<div
				aria-hidden
				className='pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/25 to-transparent'
			/>
		</div>
	);
}
