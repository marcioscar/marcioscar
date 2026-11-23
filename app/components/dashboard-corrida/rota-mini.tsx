import { useMemo } from "react";
import { decodePolyline } from "~/lib/polyline";

/** Miniatura do traçado da corrida (sem mapa de fundo). */
export function RotaMini({ polyline, className }: { polyline: string | null; className?: string }) {
	const d = useMemo(() => {
		if (!polyline) return null;
		const pts = decodePolyline(polyline);
		if (pts.length < 2) return null;
		const k = Math.cos((pts.reduce((a, p) => a + p[1], 0) / pts.length) * (Math.PI / 180));
		const xy = pts.map(([lng, lat]) => [lng * k, -lat] as const);
		const xs = xy.map((p) => p[0]);
		const ys = xy.map((p) => p[1]);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const w = Math.max(...xs) - minX || 1e-6;
		const h = Math.max(...ys) - minY || 1e-6;
		const s = Math.min(64 / w, 40 / h);
		const ox = (72 - w * s) / 2;
		const oy = (48 - h * s) / 2;
		return xy.map((p, i) => `${i ? "L" : "M"}${(ox + (p[0] - minX) * s).toFixed(1)} ${(oy + (p[1] - minY) * s).toFixed(1)}`).join("");
	}, [polyline]);

	if (!d) return <div className={className} aria-hidden />;
	return (
		<svg viewBox="0 0 72 48" className={className} aria-hidden>
			<path d={d} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}
