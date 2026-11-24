import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("kiosk", "routes/kiosk.tsx"),
  route("financeiro", "routes/financeiro.tsx"),
  route("corridas", "routes/corridas.tsx"),
  route("corridas/relogio/:healthId", "routes/corridas.relogio.$healthId.tsx"),
  route("corridas/:stravaId", "routes/corridas.$stravaId.tsx"),
  route("maratonas", "routes/maratonas.tsx"),
  route("contas", "routes/contas.tsx"),
  route("biblioteca", "routes/biblioteca.tsx"),
  route("treinamento", "routes/treinamento.tsx"),
  route("treinos", "routes/treinos.tsx"),
  route("api/analisar-corrida", "routes/api.analisar-corrida.ts"),
  route("api/interpretar-treino", "routes/api.interpretar-treino.ts"),
  route("api/buscar-splits", "routes/api.buscar-splits.ts"),
  route("api/fotos-corrida", "routes/api.fotos-corrida.ts"),
  route("api/rota-completa", "routes/api.rota-completa.ts"),
  route("api/treino-semana", "routes/api.treino-semana.ts"),
  route("api/saude-treinos", "routes/api.saude-treinos.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
] satisfies RouteConfig;