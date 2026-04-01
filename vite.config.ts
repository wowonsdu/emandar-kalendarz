import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const mockDataDir = path.resolve(__dirname, "public/mock-data");
const mockSeedStorePath = path.join(mockDataDir, "seed-store.json");
const mockRuntimeStorePath = path.join(mockDataDir, "runtime-store.json");

async function writeMockStorePayload(store: unknown) {
  await mkdir(mockDataDir, { recursive: true });
  await writeFile(mockRuntimeStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  return {
    store,
    version: Date.now(),
  };
}

function mockStoreApiPlugin() {
  const runtimeStoreRoutes = new Set([
    "/emandar/api/mock/runtime-store",
    "/api/mock/runtime-store",
  ]);
  const resetRoutes = new Set([
    "/emandar/api/mock/reset",
    "/api/mock/reset",
  ]);

  return {
    name: "mock-store-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestPath = req.url?.split("?")[0] ?? "";

        if (!runtimeStoreRoutes.has(requestPath) && !resetRoutes.has(requestPath)) {
          next();
          return;
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "method-not-allowed" }));
          return;
        }

        if (resetRoutes.has(requestPath)) {
          const seedStore = JSON.parse(await readFile(mockSeedStorePath, "utf8"));
          const payload = await writeMockStorePayload(seedStore);
          res.statusCode = 200;
          res.end(JSON.stringify(payload));
          return;
        }

        const body = await new Promise<string>((resolve, reject) => {
          let raw = "";
          req.on("data", (chunk) => {
            raw += chunk;
          });
          req.on("end", () => resolve(raw));
          req.on("error", reject);
        });

        const parsed = body ? JSON.parse(body) : {};
        const store = parsed?.store;
        if (!store || typeof store !== "object") {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "invalid-store" }));
          return;
        }

        const payload = await writeMockStorePayload(store);
        res.statusCode = 200;
        res.end(JSON.stringify(payload));
      });
    },
  };
}

export default defineConfig({
  base: "/emandar/",
  plugins: [
    mockStoreApiPlugin(),
    react(),
    tailwindcss(),
  ],
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
