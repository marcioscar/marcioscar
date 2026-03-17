import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          typeof warning.message === "string" &&
          warning.message.includes(
            "Error when using sourcemap for reporting an error",
          )
        ) {
          return;
        }

        warn(warning);
      },
    },
  },
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
