import type { EtapaRelogio } from "~/lib/treino-para-relogio";
import { expandirEtapas, metrosDaEtapa, type DadosEstrutura } from "~/lib/treino-manual";

// Uma cor por zona (Z1 leve → Z6 velocidade), tiradas da paleta do app.
export const COR_ZONA: Record<number, string> = {
	1: "var(--paleta-7)",
	2: "var(--paleta-1)",
	3: "var(--paleta-3)",
	4: "var(--paleta-2)",
	5: "var(--paleta-5)",
	6: "var(--paleta-6)",
};

export function corDaEtapa(e: EtapaRelogio): string {
	return COR_ZONA[e.zona ?? 2];
}

/** Perfil do treino: uma barra por etapa, largura pela distância e altura pela zona. */
export function TreinoGrafico({ treino, altura = 64 }: { treino: DadosEstrutura; altura?: number }) {
	const etapas = expandirEtapas(treino);
	if (etapas.length === 0) return null;
	const total = Math.max(etapas.reduce((acc, e) => acc + metrosDaEtapa(e), 0), 1);

	return (
		<div
			className="flex w-full items-end gap-[3px]"
			style={{ height: altura }}
			role="img"
			aria-label={`Estrutura do treino: ${etapas.length} etapas`}>
			{etapas.map((e, i) => {
				const z = e.zona ?? 2;
				const cor = corDaEtapa(e);
				const h = e.papel === "recuperacao" ? 0.3 : 0.38 + z * 0.1;
				return (
					<div
						key={i}
						className="min-w-[4px] rounded-[5px]"
						style={{
							flexGrow: metrosDaEtapa(e) / total,
							flexBasis: 0,
							height: `${Math.min(h, 1) * 100}%`,
							background: `linear-gradient(to bottom, ${cor}, color-mix(in oklab, ${cor} 35%, transparent))`,
							borderTop: `2px solid ${cor}`,
						}}
					/>
				);
			})}
		</div>
	);
}
