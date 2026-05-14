import type { Route } from "./+types/sitemap";

type SitemapEntry = {
  loc: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
};

const ROUTE_PATHS = ["/", "/kiosk", "/corridas", "/contas", "/biblioteca"] as const;

function toSitemapEntries(origin: string): SitemapEntry[] {
  return ROUTE_PATHS.map((path) => ({
    loc: `${origin}${path}`,
    changefreq: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? "1.0" : "0.8",
  }));
}

function toSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      ({ loc, changefreq, priority }) => `
  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;
}

export function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const entries = toSitemapEntries(origin);
  const xml = toSitemapXml(entries);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
