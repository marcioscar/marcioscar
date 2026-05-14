import type { Route } from "./+types/robots";

const ROBOTS_TXT_CONTENT = "User-agent: *\nAllow: /\n";

export function loader(_: Route.LoaderArgs) {
  return new Response(ROBOTS_TXT_CONTENT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
