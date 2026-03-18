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

const LISTA_CONTAS = ["Corrente", "Cartão Itau", "Nubank"] as const;

function ordenarAlfabetico(valores: readonly string[]): string[] {
	return [...valores].sort((a, b) =>
		a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
	);
}

export const CATEGORIAS_DESPESA = ordenarAlfabetico(LISTA_CATEGORIAS);
export const CONTAS_DESPESA = [...LISTA_CONTAS];
