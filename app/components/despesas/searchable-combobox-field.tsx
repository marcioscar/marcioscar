"use client";

import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "~/components/ui/combobox";

type SearchableComboboxFieldProps = {
	label: string;
	name: string;
	placeholder: string;
	options: string[];
	value: string;
	onValueChange: (value: string) => void;
	required?: boolean;
	disabled?: boolean;
};

export function SearchableComboboxField({
	label,
	name,
	placeholder,
	options,
	value,
	onValueChange,
	required = false,
	disabled = false,
}: SearchableComboboxFieldProps) {
	return (
		<label className='grid gap-1 text-sm'>
			{label}
			<input type='hidden' name={name} value={value} required={required} />
			<Combobox
				items={options}
				value={value}
				onValueChange={(nextValue) => onValueChange(nextValue ?? "")}>
				<ComboboxInput
					placeholder={placeholder}
					showClear
					disabled={disabled}
					autoComplete='off'
				/>
				<ComboboxContent>
					<ComboboxEmpty>Nenhum item encontrado.</ComboboxEmpty>
					<ComboboxList>
						{(item) => (
							<ComboboxItem key={item} value={item}>
								{item}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</label>
	);
}
