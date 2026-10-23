"use client";

import { cn } from "~/lib/utils";
import {
	COR_PESSOA,
	PESSOAS_DESPESA,
	isPessoaDespesa,
} from "./despesa-options";

export function PessoaBadge({ pessoa }: { pessoa: string | null }) {
	if (!pessoa) {
		return <span className='text-muted-foreground'>--</span>;
	}

	const cor = isPessoaDespesa(pessoa) ? COR_PESSOA[pessoa] : "var(--paleta-8)";
	return (
		<span
			className='inline-flex h-5 items-center rounded-4xl border px-2 text-xs font-medium whitespace-nowrap'
			style={{
				color: cor,
				borderColor: `color-mix(in oklch, ${cor} 35%, transparent)`,
				background: `color-mix(in oklch, ${cor} 12%, transparent)`,
			}}>
			{pessoa}
		</span>
	);
}

type PessoaSelectorProps = {
	value: string;
	onValueChange: (value: string) => void;
	name?: string;
	disabled?: boolean;
};

export function PessoaSelector({
	value,
	onValueChange,
	name,
	disabled = false,
}: PessoaSelectorProps) {
	return (
		<div className='grid gap-1 text-sm'>
			<span>Quem fez</span>
			{name && <input type='hidden' name={name} value={value} />}
			<div role='radiogroup' aria-label='Quem fez' className='flex flex-wrap gap-1.5'>
				{PESSOAS_DESPESA.map((pessoa) => {
					const selecionada = value === pessoa;
					const cor = COR_PESSOA[pessoa];
					return (
						<button
							key={pessoa}
							type='button'
							role='radio'
							aria-checked={selecionada}
							disabled={disabled}
							onClick={() => onValueChange(pessoa)}
							className={cn(
								"h-8 rounded-md border px-3 text-sm transition-colors disabled:opacity-50",
								!selecionada && "border-input bg-background hover:bg-accent",
							)}
							style={
								selecionada
									? {
											color: cor,
											borderColor: cor,
											background: `color-mix(in oklch, ${cor} 14%, transparent)`,
											fontWeight: 500,
										}
									: undefined
							}>
							{pessoa}
						</button>
					);
				})}
			</div>
		</div>
	);
}
