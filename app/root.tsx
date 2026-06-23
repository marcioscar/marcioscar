import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import { AppSidebar } from "./components/app-sidebar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import "./app.css";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
	{
		rel: "icon",
		href: "/icon-asfalto-1024.png",
		type: "image/png",
		media: "(prefers-color-scheme: dark)",
	},
	{
		rel: "icon",
		href: "/icon-claro-1024.png",
		type: "image/png",
		media: "(prefers-color-scheme: light)",
	},
	{ rel: "apple-touch-icon", href: "/icon-asfalto-1024.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<head>
				<meta charSet='utf-8' />
				<meta name='viewport' content='width=device-width, initial-scale=1' />
				<Meta />
				<Links />
			</head>
			<body>
				<TooltipProvider>{children}</TooltipProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	const location = useLocation();
	const isKioskRoute = location.pathname === "/kiosk";

	if (isKioskRoute) {
		return (
			<div className='min-h-screen bg-background'>
				<Outlet />
				<Toaster />
			</div>
		);
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className='flex h-14 items-center gap-2 border-b px-4'>
					<SidebarTrigger />
					<img
						src='/icon-asfalto-1024.png'
						alt='Icone Marcioscar'
						className='size-8 rounded-lg object-cover'
					/>
					<span className='text-sm font-medium'>Marcioscar</span>
				</header>
				<div className='flex min-h-0 min-w-0 flex-1 flex-col p-4'>
					<Outlet />
				</div>
				<Toaster />
			</SidebarInset>
		</SidebarProvider>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className='pt-16 p-4 container mx-auto'>
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className='w-full p-4 overflow-x-auto'>
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
