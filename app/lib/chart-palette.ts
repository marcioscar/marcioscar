/**
 * Paleta categórica dos gráficos.
 *
 * Família terrosa ancorada no oliva do tema: os tons dividem a mesma
 * saturação contida das CSS variables do shadcn, então continuam
 * distinguíveis entre si sem destoar do resto da interface.
 *
 * Os valores são tokens (`--paleta-N`, definidos em app/app.css) e não hex,
 * porque o modo escuro usa versões mais claras dos mesmos tons.
 */
export const PALETA_GRAFICOS = [
	"var(--paleta-1)", // oliva
	"var(--paleta-2)", // terracota
	"var(--paleta-3)", // mostarda
	"var(--paleta-4)", // petróleo
	"var(--paleta-5)", // bordô
	"var(--paleta-6)", // ameixa
	"var(--paleta-7)", // sálvia
	"var(--paleta-8)", // taupe
] as const;

export function getCorGrafico(
	indice: number,
	paleta: readonly string[] = PALETA_GRAFICOS,
): string {
	return paleta[indice % paleta.length];
}
