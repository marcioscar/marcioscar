// Onde cada maratona aconteceu. As mais antigas vieram do Strava sem coordenadas,
// então a cidade fica cadastrada aqui, por id da atividade. paisId é o código
// numérico ISO 3166-1 usado pelo world-atlas (para pintar o país no mapa).

export type RotuloPosicao = {
	/** deslocamento do rótulo em relação ao ponto, em unidades do mapa */
	dx: number;
	dy: number;
	ancora: "start" | "middle" | "end";
};

export type LocalMaratona = {
	cidade: string;
	pais: string;
	paisId: string;
	lat: number;
	lng: number;
	rotulo?: RotuloPosicao;
};

const DIREITA: RotuloPosicao = { dx: 9, dy: 4, ancora: "start" };
export const ROTULO_PADRAO = DIREITA;

export const LOCAIS_MARATONAS: Record<number, LocalMaratona> = {
	// Europa
	16741002383: { cidade: "Málaga", pais: "Espanha", paisId: "724", lat: 36.72, lng: -4.42 },
	7901140095: { cidade: "Londres", pais: "Reino Unido", paisId: "826", lat: 51.47, lng: 0.01, rotulo: { dx: -9, dy: 4, ancora: "end" } },
	724592921: { cidade: "Berlim", pais: "Alemanha", paisId: "276", lat: 52.52, lng: 13.36 },
	// América do Norte
	12593135025: { cidade: "Portland", pais: "EUA", paisId: "840", lat: 45.52, lng: -122.67, rotulo: { dx: -9, dy: 4, ancora: "end" } },
	[-1440355763]: { cidade: "Sacramento", pais: "EUA", paisId: "840", lat: 38.58, lng: -121.49, rotulo: { dx: -9, dy: 4, ancora: "end" } },
	1221599720: { cidade: "Chicago", pais: "EUA", paisId: "840", lat: 41.88, lng: -87.62, rotulo: { dx: 0, dy: -10, ancora: "middle" } },
	1932951784: { cidade: "Washington", pais: "EUA", paisId: "840", lat: 38.88, lng: -77.06 },
	230573669: { cidade: "Cancún", pais: "México", paisId: "484", lat: 21.15, lng: -86.82 },
	// América do Sul (grupo apertado: rótulos no oceano, com linha até o ponto)
	[-78766787]: { cidade: "Rio de Janeiro", pais: "Brasil", paisId: "076", lat: -22.91, lng: -43.17, rotulo: { dx: 48, dy: -6, ancora: "start" } },
	[-1587195746]: { cidade: "São Paulo", pais: "Brasil", paisId: "076", lat: -23.55, lng: -46.63, rotulo: { dx: 58, dy: 9, ancora: "start" } },
	[-341799223]: { cidade: "Porto Alegre", pais: "Brasil", paisId: "076", lat: -30.03, lng: -51.22, rotulo: { dx: 58, dy: 8, ancora: "start" } },
	386319952: { cidade: "Punta del Este", pais: "Uruguai", paisId: "858", lat: -34.96, lng: -54.94, rotulo: { dx: 52, dy: 12, ancora: "start" } },
	2731350003: { cidade: "Buenos Aires", pais: "Argentina", paisId: "032", lat: -34.55, lng: -58.44, rotulo: { dx: -22, dy: 36, ancora: "end" } },
	571316441: { cidade: "Mendoza", pais: "Argentina", paisId: "032", lat: -32.89, lng: -68.84, rotulo: { dx: -36, dy: -16, ancora: "end" } },
	[-238274067]: { cidade: "Santiago", pais: "Chile", paisId: "152", lat: -33.45, lng: -70.67, rotulo: { dx: -36, dy: 16, ancora: "end" } },
};
