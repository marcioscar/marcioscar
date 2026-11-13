import { useMemo } from "react";
import { decodePolyline } from "~/lib/polyline";

const LARGURA = 320;
const ALTURA = 240;
const MARGEM = 18;

type Props = {
	polyline: string;
	titulo: string;
};

/** A rota como "arte": só o traçado, sem mapa de fundo, sem token. */
export function RotaDesenho({ polyline, titulo }: Props) {
	const desenho = useMemo(() => {
		const pontos = decodePolyline(polyline);
		if (pontos.length < 2) return null;

		// longitude encolhe com a latitude: corrige para o traçado não ficar achatado
		const latMedia = pontos.reduce((acc, p) => acc + p[1], 0) / pontos.length;
		const k = Math.cos((latMedia * Math.PI) / 180);
		const xy = pontos.map(([lng, lat]) => [lng * k, -lat] as const);

		const xs = xy.map((p) => p[0]);
		const ys = xy.map((p) => p[1]);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const larguraGeo = Math.max(...xs) - minX || 1e-6;
		const alturaGeo = Math.max(...ys) - minY || 1e-6;
		const escala = Math.min(
			(LARGURA - 2 * MARGEM) / larguraGeo,
			(ALTURA - 2 * MARGEM) / alturaGeo,
		);
		const origemX = (LARGURA - larguraGeo * escala) / 2;
		const origemY = (ALTURA - alturaGeo * escala) / 2;

		const projetados = xy.map(
			(p) => [origemX + (p[0] - minX) * escala, origemY + (p[1] - minY) * escala] as const,
		);
		return {
			d: projetados
				.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
				.join(""),
			inicio: projetados[0],
			fim: projetados[projetados.length - 1],
		};
	}, [polyline]);

	if (!desenho) return null;

	return (
		<svg
			viewBox={`0 0 ${LARGURA} ${ALTURA}`}
			role='img'
			aria-label={`Traçado do percurso: ${titulo}`}
			className='block h-auto w-full rounded-xl border border-border bg-muted/40'>
			<path
				d={desenho.d}
				style={{
					fill: "none",
					stroke: "var(--paleta-4)",
					strokeWidth: 9,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					opacity: 0.16,
				}}
			/>
			<path
				d={desenho.d}
				style={{
					fill: "none",
					stroke: "var(--paleta-4)",
					strokeWidth: 2.6,
					strokeLinecap: "round",
					strokeLinejoin: "round",
				}}
			/>
			<circle
				cx={desenho.inicio[0]}
				cy={desenho.inicio[1]}
				r={5}
				style={{ fill: "var(--paleta-1)", stroke: "var(--card)", strokeWidth: 2 }}
			/>
			<circle
				cx={desenho.fim[0]}
				cy={desenho.fim[1]}
				r={5}
				style={{ fill: "var(--foreground)", stroke: "var(--card)", strokeWidth: 2 }}
			/>
			<text x={10} y={ALTURA - 10} style={{ fontSize: 10, fill: "var(--muted-foreground)" }}>
				● largada &nbsp; ● chegada
			</text>
		</svg>
	);
}
