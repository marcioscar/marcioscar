"use client";

import { Link, useLocation } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Home01Icon,
	WorkoutRunIcon,
	BitcoinWalletIcon,
	ChartAverageIcon,
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

type NavItem = {
	title: string;
	href: string;
	icon: typeof Home01Icon;
	color?: string;
};

const navItems: NavItem[] = [
	{ title: "Dashboard", href: "/", icon: ChartAverageIcon, color: "orange" },
	{ title: "Corridas", href: "/corridas", icon: WorkoutRunIcon, color: "blue" },
	{ title: "Contas", href: "/contas", icon: BitcoinWalletIcon, color: "green" },
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
					<img
						src='/logo.png'
						alt='Logo Marcioscar'
						className='size-20 w-full object-scale-down group-data-[collapsible=icon]:hidden'
					/>
					<img
						src='/icone.png'
						alt='Icone Marcioscar'
						className='hidden w-full size-8 rounded-full object-cover group-data-[collapsible=icon]:block'
					/>
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
