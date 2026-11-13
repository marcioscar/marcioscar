export function formatarTempo(seg: number): string {
	const h = Math.floor(seg / 3600);
	const m = Math.floor((seg % 3600) / 60);
	const s = Math.round(seg % 60);
	return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Diferença com sinal: "+0:35:31" / "−0:02:10" */
export function formatarDiferenca(seg: number): string {
	const sinal = seg < 0 ? "−" : "+";
	return `${sinal}${formatarTempo(Math.abs(seg))}`;
}

export function formatarPace(segPorKm: number | null, sufixo = " /km"): string {
	if (!segPorKm || segPorKm <= 0) return "—";
	const min = Math.floor(segPorKm / 60);
	const seg = Math.round(segPorKm % 60);
	return `${min}:${String(seg).padStart(2, "0")}${sufixo}`;
}

export function formatarData(iso: string): string {
	return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
