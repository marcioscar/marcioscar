import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("kiosk", "routes/kiosk.tsx"),
  route("corridas", "routes/corridas.tsx"),
  route("contas", "routes/contas.tsx"),
  route("biblioteca", "routes/biblioteca.tsx"),
  route("treinamento", "routes/treinamento.tsx"),
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
] satisfies RouteConfig;