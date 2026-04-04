import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const mockDataDir = path.resolve(__dirname, "public/mock-data");
const mockSeedStorePath = path.join(mockDataDir, "seed-store.json");
const mockRuntimeStorePath =
  process.env.EMANDAR_RUNTIME_STORE_PATH?.trim() ||
  path.resolve(__dirname, ".local-state/emandar/runtime-store.json");

async function readMockJsonFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

async function getMockStoreVersion(filePath: string) {
  try {
    const metadata = await stat(filePath);
    return Math.round(metadata.mtimeMs);
  } catch {
    return Date.now();
  }
}

async function writeMockStorePayload(store: unknown) {
  await mkdir(path.dirname(mockRuntimeStorePath), { recursive: true });
  await writeFile(mockRuntimeStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  return {
    store,
    version: await getMockStoreVersion(mockRuntimeStorePath),
  };
}

async function readOrBootstrapMockStorePayload() {
  const runtimeStore = await readMockJsonFile(mockRuntimeStorePath);
  if (runtimeStore && typeof runtimeStore === "object") {
    return {
      store: runtimeStore,
      version: await getMockStoreVersion(mockRuntimeStorePath),
    };
  }

  const seedStore = JSON.parse(await readFile(mockSeedStorePath, "utf8")) as unknown;
  return writeMockStorePayload(seedStore);
}

function mockStoreApiPlugin() {
  const storeRoutes = new Set([
    "/emandar/api/mock/store",
    "/api/mock/store",
    "/emandar/api/mock/store.php",
    "/api/mock/store.php",
  ]);
  const saveRoutes = new Set([
    "/emandar/api/mock/save",
    "/api/mock/save",
    "/emandar/api/mock/save.php",
    "/api/mock/save.php",
  ]);
  const resetRoutes = new Set([
    "/emandar/api/mock/reset",
    "/api/mock/reset",
    "/emandar/api/mock/reset.php",
    "/api/mock/reset.php",
  ]);
  const legacyRuntimeStoreRoutes = new Set([
    "/emandar/api/mock/runtime-store",
    "/api/mock/runtime-store",
  ]);

  return {
    name: "mock-store-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestPath = req.url?.split("?")[0] ?? "";

        if (
          !storeRoutes.has(requestPath) &&
          !saveRoutes.has(requestPath) &&
          !resetRoutes.has(requestPath) &&
          !legacyRuntimeStoreRoutes.has(requestPath)
        ) {
          next();
          return;
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");

        if (storeRoutes.has(requestPath) && req.method === "GET") {
          const payload = await readOrBootstrapMockStorePayload();
          res.statusCode = 200;
          res.end(JSON.stringify(payload));
          return;
        }

        if (resetRoutes.has(requestPath) && req.method === "POST") {
          const seedStore = JSON.parse(await readFile(mockSeedStorePath, "utf8")) as unknown;
          const payload = await writeMockStorePayload(seedStore);
          res.statusCode = 200;
          res.end(JSON.stringify(payload));
          return;
        }

        if ((saveRoutes.has(requestPath) || legacyRuntimeStoreRoutes.has(requestPath)) && req.method === "POST") {
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
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ error: "method-not-allowed" }));
      });
    },
  };
}

export default defineConfig({
  base: "/emandar/",
  server: {
    watch: {
      ignored: ["**/.local-state/**"],
    },
  },
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
