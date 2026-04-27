import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function normalizeBasePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

const configuredBasePath = normalizeBasePath(
  process.env.BASE_PATH?.trim() || process.env.EMANDAR_BASE_PATH?.trim() || "/emandar/",
);
const apiProxyTarget = process.env.EMANDAR_API_PROXY_TARGET || "http://127.0.0.1:4174";

export default defineConfig({
  base: configuredBasePath,
  server: {
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      [`${configuredBasePath.replace(/\/$/, "")}/api`]: {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
  test: {
    environment: "node",
    globals: true,
  },
});
