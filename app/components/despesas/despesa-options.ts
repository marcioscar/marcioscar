const LISTA_CATEGORIAS = [
	"Agua",
	"Apps",
	"Corrida",
	"Camila",
	"Arthur",
	"Educação",
	"Energia",
	"Entretenimento",
	"Farmacia",
	"Hardware",
	"Mesada",
	"Nutrição",
	"Óculos",
	"Outros",
	"Padaria",
	"Refeicao",
	"Saúde",
	"Supermercado",
	"Transporte",
	"Vinho",
	"Viagem",
	"Vestuario",
	"Moradia",
] as const;

const LISTA_CONTAS = [
	"Corrente",
	"Cartão Itau",
	"Nubank",
	"Cartão Camila",
] as const;

function ordenarAlfabetico(valores: readonly string[]): string[] {
	return [...valores].sort((a, b) =>
		a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
	);
}

export const CATEGORIAS_DESPESA = ordenarAlfabetico(LISTA_CATEGORIAS);
export const CONTAS_DESPESA = [...LISTA_CONTAS];

export const PESSOAS_DESPESA = ["Marcio", "Janaina", "Arthur", "Camila"] as const;
export type PessoaDespesa = (typeof PESSOAS_DESPESA)[number];
export const PESSOA_PADRAO: PessoaDespesa = "Marcio";

export const COR_PESSOA: Record<PessoaDespesa, string> = {
	Marcio: "var(--paleta-4)",
	Janaina: "var(--paleta-6)",
	Arthur: "var(--paleta-2)",
	Camila: "var(--paleta-7)",
};

export function isPessoaDespesa(valor: string): valor is PessoaDespesa {
	return (PESSOAS_DESPESA as readonly string[]).includes(valor);
}
