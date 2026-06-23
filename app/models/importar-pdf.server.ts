import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIAS_DESPESA } from "~/components/despesas/despesa-options";

export type TransacaoImportada = {
	nome: string;
	categoria: string;
	valor: number;
	data: string; // YYYY-MM-DD
	conta: string;
	brassaco: boolean;
	obs: string;
};

const client = new Anthropic();

function buildPrompt(conta: string, dataInicio?: string, apenasDebitos?: boolean): string {
	const regrasExtrato = apenasDebitos
		? `- Este é um extrato bancário com entradas e saídas. Extraia SOMENTE as saídas (débitos, compras, pagamentos, transferências enviadas). Ignore completamente depósitos, salários, transferências recebidas, rendimentos e qualquer entrada de dinheiro.`
		: `- Ignore pagamentos recebidos e créditos (entradas de dinheiro)`;

	const regraData = dataInicio
		? `- Inclua apenas transações a partir de ${dataInicio} (ignore transações anteriores a esta data)`
		: "";

	return `Extraia todas as transações de compra/despesa deste extrato bancário ou fatura de cartão.

Retorne APENAS um JSON array válido (sem markdown, sem texto adicional) com objetos neste formato exato:
[{"nome":"descrição curta","categoria":"categoria","valor":99.90,"data":"YYYY-MM-DD","conta":"${conta}","brassaco":false,"obs":""}]

Categorias disponíveis (use exatamente uma delas): ${CATEGORIAS_DESPESA.join(", ")}

Regras:
${regrasExtrato}
- Ignore linhas de IOF separadas (já estão incluídas na compra correspondente)
- Para parcelas, inclua o número no nome (ex: "Rocketseat 12/12")
- Para estabelecimentos repetidos, use o nome real (ex: "Uber", "Amazon", "Shell")
- Nome máximo 45 caracteres
- Datas no formato YYYY-MM-DD
- Valores numéricos positivos (sem R$ ou símbolos)${regraData ? `\n${regraData}` : ""}`;
}

export async function extrairTransacoesDePdf(
	pdfBuffer: Buffer,
	contaPadrao: string,
	dataInicio?: string,
	apenasDebitos?: boolean,
): Promise<TransacaoImportada[]> {
	const response = await client.messages.create({
		model: "claude-sonnet-4-6",
		max_tokens: 8192,
		messages: [
			{
				role: "user",
				content: [
					{
						type: "document",
						source: {
							type: "base64",
							media_type: "application/pdf",
							data: pdfBuffer.toString("base64"),
						},
					},
					{
						type: "text",
						text: buildPrompt(contaPadrao, dataInicio, apenasDebitos),
					},
				],
			},
		],
	});

	const textBlock = response.content.find((c) => c.type === "text");
	if (!textBlock || textBlock.type !== "text") {
		throw new Error("Resposta inesperada da API.");
	}

	let json = textBlock.text.trim();
	// Remove markdown code block if present
	json = json.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

	const transacoes = JSON.parse(json);
	if (!Array.isArray(transacoes)) {
		throw new Error("Formato inválido retornado pela API.");
	}

	return transacoes as TransacaoImportada[];
}
