export function getMapboxToken(): string | null {
	return (
		process.env.MAPBOX_ACCESS_TOKEN ??
		process.env.MAPBOX_TOKEN ??
		process.env.VITE_MAPBOX_TOKEN ??
		null
	);
}
