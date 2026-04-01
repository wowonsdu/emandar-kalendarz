import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const mockDataDir = path.resolve(__dirname, "public/mock-data");
const mockSeedStorePath = path.join(mockDataDir, "seed-store.json");
const mockRuntimeStorePath = path.join(mockDataDir, "runtime-store.json");

async function readMockStorePayload() {
  const preferredPath = await readFile(mockRuntimeStorePath, "utf8")
    .then((contents) => ({ contents, runtime: true }))
    .catch(async () => ({
      contents: await readFile(mockSeedStorePath, "utf8"),
      runtime: false,
    }));

  return {
    store: JSON.parse(preferredPath.contents),
    version: Date.now(),
  };
}

async function writeMockStorePayload(store: unknown) {
  await mkdir(mockDataDir, { recursive: true });
  await writeFile(mockRuntimeStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  return {
    store,
    version: Date.now(),
  };
}

function mockStoreApiPlugin() {
  return {
    name: "mock-store-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestPath = req.url?.split("?")[0] ?? "";

        if (requestPath !== "/emandar/api/mock/store.php" && requestPath !== "/api/mock/store.php") {
          if (
            requestPath !== "/emandar/api/mock/save.php" &&
            requestPath !== "/api/mock/save.php" &&
            requestPath !== "/emandar/api/mock/reset.php" &&
            requestPath !== "/api/mock/reset.php"
          ) {
            next();
            return;
          }
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");

        if (requestPath.endsWith("/store.php")) {
          const payload = await readMockStorePayload();
          res.statusCode = 200;
          res.end(JSON.stringify(payload));
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "method-not-allowed" }));
          return;
        }

        if (requestPath.endsWith("/reset.php")) {
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
