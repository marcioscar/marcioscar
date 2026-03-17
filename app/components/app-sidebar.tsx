"use client";

import { Link, useLocation } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Home01Icon, RunningShoesIcon } from "@hugeicons/core-free-icons";

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
};

const navItems: NavItem[] = [
	{ title: "Home", href: "/", icon: Home01Icon },
	{ title: "Corridas", href: "/corridas", icon: RunningShoesIcon },
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
										<HugeiconsIcon icon={item.icon} strokeWidth={2} />
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
