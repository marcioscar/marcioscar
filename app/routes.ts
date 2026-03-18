import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("corridas", "routes/corridas.tsx"),
  route("contas", "routes/contas.tsx"),
] satisfies RouteConfig;