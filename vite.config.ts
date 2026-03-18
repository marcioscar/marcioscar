import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

function isSourcemapReportingWarning(message: string): boolean {
  return message.includes("Error when using sourcemap for reporting an error");
}

function isHugeiconsPureAnnotationWarning(message: string): boolean {
  return (
    message.includes("contains an annotation that Rollup cannot interpret") &&
    message.includes("@hugeicons/core-free-icons")
  );
}

function shouldIgnoreRollupWarning(message?: string): boolean {
  if (typeof message !== "string") {
    return false;
  }

  return (
    isSourcemapReportingWarning(message) ||
    isHugeiconsPureAnnotationWarning(message)
  );
}

function resolveManualChunks(id: string): string | undefined {
  if (id.includes("node_modules/mapbox-gl")) {
    return "vendor-mapbox";
  }

  if (
    id.includes("node_modules/react-globe.gl") ||
    id.includes("node_modules/three") ||
    id.includes("node_modules/three-globe")
  ) {
    return "vendor-globe";
  }

  if (id.includes("node_modules/recharts")) {
    return "vendor-charts";
  }

  if (id.includes("node_modules/@tanstack/react-table")) {
    return "vendor-table";
  }

  return undefined;
}

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunks,
      },
      onwarn(warning, warn) {
        if (shouldIgnoreRollupWarning(warning.message)) {
          return;
        }

        warn(warning);
      },
    },
  },
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
