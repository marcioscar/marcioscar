import { cn } from "~/lib/utils";

/** Superfície do card: gradiente vertical claro → oliva escura */
export const statCardSurfaceClass = cn(
	"min-w-0 overflow-hidden  shadow-md",
	"bg-olive-900/10",
	"dark:bg-olive-200/30",
);

/** Rótulo secundário (ex.: CardDescription na biblioteca) */
export const statCardLabelClass =
	"text-olive-900/80 dark:text-olive-400/85";

/** Título / destaque no topo do card (ex.: CardTitle na home) */
export const statCardTitleClass =
	"font-semibold text-olive-950 dark:text-white";

/** Valor numérico grande — tamanho médio (biblioteca) */
export const statCardMetricClass =
	"text-2xl font-semibold tabular-nums text-olive-950 dark:text-white";

/** Valor numérico grande — tamanho maior (home / moeda) */
export const statCardMetricLgClass =
	"text-3xl font-semibold tabular-nums text-olive-950 dark:text-white";

/** Texto na zona inferior escura do gradiente */
export const statCardCaptionClass =
	"break-words text-xs text-olive-900 dark:text-olive-200";
