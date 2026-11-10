"use client";

import { Link, useLocation } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Home01Icon,
	WorkoutRunIcon,
	Analytics01Icon,
	Invoice01Icon,
	Books02Icon,
	Target01Icon,
} from "@hugeicons/core-free-icons";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "~/components/ui/sidebar";
import { MarcaHorizontal, MarcaIcone } from "~/components/marca";

type NavItem = {
	title: string;
	href: string;
	icon: typeof Home01Icon;
};

type NavGroup = {
	label: string;
	// cor do ícone do item ativo; os demais ficam neutros
	color: string;
	items: NavItem[];
};

export const navGroups: NavGroup[] = [
	{
		label: "Corrida",
		color: "var(--paleta-4)",
		items: [
			{ title: "Painel", href: "/", icon: Home01Icon },
			{ title: "Atividades", href: "/corridas", icon: WorkoutRunIcon },
			{ title: "Treinamento", href: "/treinamento", icon: Target01Icon },
		],
	},
	{
		label: "Finanças",
		color: "var(--paleta-1)",
		items: [
			{ title: "Resumo", href: "/financeiro", icon: Analytics01Icon },
			{ title: "Despesas", href: "/contas", icon: Invoice01Icon },
		],
	},
	{
		label: "Leitura",
		color: "var(--paleta-6)",
		items: [{ title: "Biblioteca", href: "/biblioteca", icon: Books02Icon }],
	},
];

function isActivePath(currentPath: string, href: string): boolean {
	if (href === "/") {
		return currentPath === "/";
	}
	return currentPath.startsWith(href);
}

export function getNavAtual(
	currentPath: string,
): { grupo: string; titulo: string } | null {
	for (const grupo of navGroups) {
		const item = grupo.items.find((i) => isActivePath(currentPath, i.href));
		if (item) {
			return { grupo: grupo.label, titulo: item.title };
		}
	}
	return null;
}

export function AppSidebar() {
	const location = useLocation();

	return (
		<Sidebar collapsible='icon'>
			<SidebarHeader>
				<div className='flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center'>
					<MarcaHorizontal className='h-9 w-auto group-data-[collapsible=icon]:hidden' />
					<MarcaIcone className='hidden size-8 group-data-[collapsible=icon]:block' />
				</div>
			</SidebarHeader>

			<SidebarContent>
				{navGroups.map((grupo) => (
					<SidebarGroup key={grupo.label}>
						<SidebarGroupLabel>{grupo.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{grupo.items.map((item) => {
									const ativo = isActivePath(location.pathname, item.href);
									return (
										<SidebarMenuItem key={item.href}>
											<SidebarMenuButton
												render={<Link to={item.href} />}
												isActive={ativo}
												tooltip={item.title}>
												<HugeiconsIcon
													icon={item.icon}
													strokeWidth={2}
													color={ativo ? grupo.color : "currentColor"}
													className={ativo ? undefined : "opacity-60"}
												/>
												<span>{item.title}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
