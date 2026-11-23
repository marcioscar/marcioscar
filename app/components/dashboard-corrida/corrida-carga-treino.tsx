import { Card, CardContent } from "~/components/ui/card";
import {
	COR_ZONA,
	LIMITES_ZONA,
	ROTULO_ZONA,
	TEXTO_ZONA,
	type CargaTreino,
	type ZonaCarga,
} from "~/lib/carga-treino";

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function dataCurta(chave: string): string {
	return new Date(`${chave}T12:00:00Z`).toLocaleDateString("pt-BR", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

// Gráfico: 7 dias, faixas de zona ao fundo, rótulo do valor em cada ponto.
const L = 360;
const A = 200;
const X0 = 22;
const X1 = 300;
const Y_TOPO = 14;
const Y_BASE = 160;

function GraficoRelacao({ dados }: { dados: CargaTreino["dias"] }) {
	const maxDado = Math.max(1.7, ...dados.map((d) => d.relacao ?? 0));
	const teto = Math.ceil(maxDado * 1.1 * 10) / 10;
	const y = (v: number) => Y_BASE - (v / teto) * (Y_BASE - Y_TOPO);
	const x = (i: number) => X0 + (i * (X1 - X0)) / (dados.length - 1);

	const faixas: { zona: ZonaCarga; de: number; ate: number }[] = [
		{ zona: "destreino", de: 0, ate: LIMITES_ZONA.destreino },
		{ zona: "ideal", de: LIMITES_ZONA.destreino, ate: LIMITES_ZONA.ideal },
		{ zona: "medio", de: LIMITES_ZONA.ideal, ate: LIMITES_ZONA.medio },
		{ zona: "alto", de: LIMITES_ZONA.medio, ate: teto },
	];

	// quebra a linha onde não há valor
	const trechos: string[] = [];
	let atual = "";
	dados.forEach((d, i) => {
		if (d.relacao === null) {
			if (atual) trechos.push(atual);
			atual = "";
			return;
		}
		atual += `${atual ? "L" : "M"}${x(i).toFixed(1)} ${y(d.relacao).toFixed(1)}`;
	});
	if (atual) trechos.push(atual);

	return (
		<svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label="Relação de carga nos últimos 7 dias">
			{faixas.map((f) => (
				<rect
					key={f.zona}
					x={0}
					width={X1 + 6}
					y={y(f.ate)}
					height={y(f.de) - y(f.ate)}
					fill={COR_ZONA[f.zona]}
					opacity={f.zona === "ideal" ? 0.2 : 0.1}
				/>
			))}
			{[LIMITES_ZONA.destreino, LIMITES_ZONA.ideal, LIMITES_ZONA.medio].map((v) => (
				<g key={v}>
					<line x1={0} x2={X1 + 6} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={0.6} />
					<text x={X1 + 12} y={y(v) + 3} className="fill-muted-foreground" fontSize={9}>
						{v.toFixed(2).replace(".", ",")}
					</text>
				</g>
			))}
			{faixas.map((f) => (
				<text
					key={`t-${f.zona}`}
					x={4}
					y={Math.min(y(f.de) - 4, Y_BASE - 3)}
					fontSize={8}
					className="fill-muted-foreground"
					opacity={0.9}>
					{ROTULO_ZONA[f.zona]}
				</text>
			))}
			{trechos.map((d, i) => (
				<path key={i} d={d} fill="none" className="stroke-foreground/45" strokeWidth={1.6} strokeLinejoin="round" />
			))}
			{dados.map((d, i) => {
				if (d.relacao === null || d.zona === null) return null;
				const ultimo = i === dados.length - 1;
				const cx = x(i);
				const cy = y(d.relacao);
				return (
					<g key={d.chave}>
						<circle
							cx={cx}
							cy={cy}
							r={ultimo ? 5 : 3}
							fill={ultimo ? COR_ZONA[d.zona] : "var(--card)"}
							stroke={ultimo ? "var(--card)" : "var(--foreground)"}
							strokeWidth={ultimo ? 1.5 : 1.3}
						/>
						<text
							x={cx}
							y={cy - 9}
							textAnchor="middle"
							fontSize={9}
							fontWeight={ultimo ? 700 : 500}
							className="fill-foreground tabular-nums">
							{fmt(d.relacao)}
						</text>
					</g>
				);
			})}
			{dados.map((d, i) => (
				<text
					key={`x-${d.chave}`}
					x={x(i)}
					textAnchor="middle"
					fontSize={9}
					className={i === dados.length - 1 ? "fill-foreground font-semibold" : "fill-muted-foreground"}>
					<tspan x={x(i)} y={Y_BASE + 16}>
						{d.diaSemana}
					</tspan>
					<tspan x={x(i)} y={Y_BASE + 28}>
						{d.diaMes}
					</tspan>
				</text>
			))}
		</svg>
	);
}

export function CorridaCargaTreino({ carga }: { carga: CargaTreino }) {
	const { atual } = carga;
	const zona = atual?.zona ?? null;
	const cor = zona ? COR_ZONA[zona] : "var(--muted-foreground)";
	const algumDado = carga.dias.some((d) => d.relacao !== null);

	return (
		<Card className="overflow-hidden p-0">
			<div
				className="px-5 pt-5 pb-4"
				style={{ background: `linear-gradient(to bottom, color-mix(in oklab, ${cor} 22%, transparent), transparent)` }}>
				<p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: cor }}>
					<span aria-hidden>⚡</span> Relação de carga de treino
				</p>
				<p className="mt-2 text-5xl font-bold tabular-nums">
					{atual?.relacao != null ? fmt(atual.relacao) : "—"}
				</p>
				<p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
					{atual && dataCurta(atual.chave)}
					{zona && (
						<span
							className="rounded-full px-2 py-0.5 text-xs font-medium"
							style={{ color: cor, background: `color-mix(in oklab, ${cor} 15%, transparent)` }}>
							{ROTULO_ZONA[zona]}
						</span>
					)}
				</p>
				<p className="mt-3 text-sm leading-relaxed">
					{zona
						? TEXTO_ZONA[zona]
						: "Ainda não há corridas suficientes nas últimas semanas para calcular a relação."}
				</p>
			</div>

			<CardContent className="grid gap-5 pb-5">
				{algumDado && <GraficoRelacao dados={carga.dias} />}

				{carga.media !== null && (
					<div>
						<p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Visão geral de 7 dias
						</p>
						<div className="grid grid-cols-3 gap-2">
							{[
								{ rotulo: "Média", valor: carga.media, nota: "7 dias" },
								{ rotulo: "Máx", valor: carga.maximo?.relacao, nota: carga.maximo && dataCurta(carga.maximo.chave) },
								{ rotulo: "Mín", valor: carga.minimo?.relacao, nota: carga.minimo && dataCurta(carga.minimo.chave) },
							].map((t) => (
								<div key={t.rotulo} className="rounded-xl bg-muted/60 px-3 py-2.5">
									<p className="text-xs text-muted-foreground">{t.rotulo}</p>
									<p className="text-xl font-bold tabular-nums">{t.valor != null ? fmt(t.valor) : "—"}</p>
									<p className="truncate text-xs text-muted-foreground">{t.nota}</p>
								</div>
							))}
						</div>

						<div className="mt-4 grid gap-2">
							{carga.distribuicao.map((d) => (
								<div key={d.zona} className="grid grid-cols-[6.5rem_1fr_2.5rem_2rem] items-center gap-2 text-sm">
									<span>{ROTULO_ZONA[d.zona]}</span>
									<div className="h-3 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full"
											style={{ width: `${d.pct}%`, background: COR_ZONA[d.zona] }}
										/>
									</div>
									<span className="text-right tabular-nums">{d.pct}%</span>
									<span className="text-right text-xs text-muted-foreground tabular-nums">{d.dias}×</span>
								</div>
							))}
						</div>
					</div>
				)}

				<p className="text-xs text-muted-foreground">
					Estimativa a partir das suas corridas no Strava: carga = tempo × intensidade pela frequência
					cardíaca; relação = carga dos últimos 7 dias ÷ média semanal dos últimos 28. Não é orientação médica.
				</p>
			</CardContent>
		</Card>
	);
}
