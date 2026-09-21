"use client";

import { Link, useLocation } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Home01Icon,
	WorkoutRunIcon,
	BitcoinWalletIcon,
	MoneyBag01Icon,
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
	color?: string;
};

const navItems: NavItem[] = [
	{ title: "Início", href: "/", icon: Home01Icon, color: "var(--paleta-2)" },
	{ title: "Corridas", href: "/corridas", icon: WorkoutRunIcon, color: "var(--paleta-4)" },
	{
		title: "Treinamento",
		href: "/treinamento",
		icon: Target01Icon,
		color: "var(--paleta-5)",
	},
	{
		title: "Financeiro",
		href: "/financeiro",
		icon: MoneyBag01Icon,
		color: "var(--paleta-3)",
	},
	{ title: "Contas", href: "/contas", icon: BitcoinWalletIcon, color: "var(--paleta-1)" },
	{
		title: "Biblioteca",
		href: "/biblioteca",
		icon: Books02Icon,
		color: "var(--paleta-6)",
	},
];

function isActivePath(currentPath: string, href: string): boolean {
	if (href === "/") {
		return currentPath === "/";
	}
	return currentPath.startsWith(href);
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
				<SidebarGroup>
					<SidebarGroupLabel>Navegacao</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										render={<Link to={item.href} />}
										isActive={isActivePath(location.pathname, item.href)}
										tooltip={item.title}>
										<HugeiconsIcon
											icon={item.icon}
											strokeWidth={2}
											color={item.color}
										/>
										<span>{item.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
