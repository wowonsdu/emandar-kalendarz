import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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

const configuredBasePath = normalizeBasePath(process.env.EMANDAR_BASE_PATH?.trim() || "/emandar/");
const mockDataDir = path.resolve(__dirname, "public/mock-data");
const mockSeedStorePath = path.join(mockDataDir, "seed-store.json");
const mockRuntimeStorePath =
  process.env.EMANDAR_RUNTIME_STORE_PATH?.trim() ||
  path.resolve(__dirname, ".local-state/emandar/runtime-store.json");
const mockRuntimeShardsDir = path.join(
  path.dirname(mockRuntimeStorePath),
  path.basename(mockRuntimeStorePath, path.extname(mockRuntimeStorePath)) || "runtime-store",
);
const persistedCollectionKeys = [
  "users",
  "trainers",
  "organizers",
  "participantProfiles",
  "groups",
  "groupMembers",
  "eventParticipants",
  "relations",
  "trainingEvents",
  "availabilitySlots",
  "trainerSharedSlots",
  "trainerCalendarFeeds",
  "organizerCalendarFeeds",
  "trainerOrganizerCalendarFeeds",
  "trainerExternalBusyMonths",
  "organizerExternalBusyMonths",
  "enrollmentRequests",
  "notifications",
  "accountRequests",
  "trainerAccountApprovals",
  "appSettings",
] as const;

type PersistedCollectionKey = (typeof persistedCollectionKeys)[number];
type MockRuntimeMeta = {
  version: number;
  updatedAt: string;
};

async function readMockJsonFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

async function hasPath(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function getDefaultNotificationSettings() {
  return {
    reminderLeadDays: 7,
    sendToTrainer: true,
    sendToOrganizer: true,
    sendToParticipants: true,
    requireParticipantSmsConfirmation: false,
    reminderSmsTemplate:
      "Przypomnienie o szkoleniu {{event_title}} dnia {{event_date}} w {{event_location}}.",
    confirmationSmsTemplate:
      "Czy bierzesz udział w szkoleniu {{event_title}} dnia {{event_date}}? Tak: {{confirm_url}} Nie: {{decline_url}}",
  };
}

function createDefaultMockStore() {
  return {
    users: [],
    trainers: [],
    organizers: [],
    participantProfiles: [],
    groups: [],
    groupMembers: [],
    eventParticipants: [],
    relations: [],
    trainingEvents: [],
    publicTrainingEvents: [],
    availabilitySlots: [],
    trainerSharedSlots: [],
    trainerCalendarFeeds: [],
    organizerCalendarFeeds: [],
    trainerOrganizerCalendarFeeds: [],
    trainerExternalBusyMonths: [],
    organizerExternalBusyMonths: [],
    enrollmentRequests: [],
    notifications: [],
    accountRequests: [],
    trainerAccountApprovals: [],
    appSettings: {
      signupPhotoMode: "optional",
      enrollmentPhotoMode: "optional",
      defaultNotificationSettings: getDefaultNotificationSettings(),
    },
  };
}

function toPersistedCollections(store: Record<string, unknown>) {
  const defaults = createDefaultMockStore();

  return Object.fromEntries(
    persistedCollectionKeys.map((collectionKey) => {
      const value = store[collectionKey];
      return [collectionKey, typeof value === "object" && value !== null ? value : defaults[collectionKey]];
    }),
  ) as Record<PersistedCollectionKey, unknown>;
}

function fromPersistedCollections(collections: Record<string, unknown>) {
  const defaults = createDefaultMockStore();
  const store = { ...defaults } as Record<string, unknown>;

  persistedCollectionKeys.forEach((collectionKey) => {
    const value = collections[collectionKey];
    store[collectionKey] =
      typeof value === "object" && value !== null ? value : defaults[collectionKey];
  });

  store.publicTrainingEvents = [];
  return store;
}

function getCollectionPath(collectionKey: PersistedCollectionKey) {
  return path.join(mockRuntimeShardsDir, `${collectionKey}.json`);
}

async function readRuntimeMeta(): Promise<MockRuntimeMeta> {
  const meta = await readMockJsonFile(path.join(mockRuntimeShardsDir, "meta.json"));
  if (meta && typeof meta === "object") {
    const version = Number((meta as { version?: number }).version ?? 1);
    const updatedAt =
      typeof (meta as { updatedAt?: string }).updatedAt === "string"
        ? (meta as { updatedAt?: string }).updatedAt
        : new Date().toISOString();

    return {
      version,
      updatedAt,
    };
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

async function writeRuntimeMeta(version: number) {
  const payload: MockRuntimeMeta = {
    version,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(mockRuntimeShardsDir, "meta.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

async function writeRuntimeCollections(
  collections: Partial<Record<PersistedCollectionKey, unknown>>,
  version: number,
) {
  await mkdir(mockRuntimeShardsDir, { recursive: true });

  await Promise.all(
    Object.entries(collections).map(async ([collectionKey, value]) => {
      await writeFile(
        getCollectionPath(collectionKey as PersistedCollectionKey),
        `${JSON.stringify(value, null, 2)}\n`,
        "utf8",
      );
    }),
  );

  await writeRuntimeMeta(version);
}

async function hasRuntimeShards() {
  if (!(await hasPath(path.join(mockRuntimeShardsDir, "meta.json")))) {
    return false;
  }

  const collectionChecks = await Promise.all(
    persistedCollectionKeys.map((collectionKey) => hasPath(getCollectionPath(collectionKey))),
  );
  return collectionChecks.every(Boolean);
}

async function readRuntimeCollections() {
  await ensureBootstrapRuntimeShards();
  const defaults = createDefaultMockStore();
  const entries = await Promise.all(
    persistedCollectionKeys.map(async (collectionKey) => {
      const value = await readMockJsonFile(getCollectionPath(collectionKey));
      return [
        collectionKey,
        value && typeof value === "object" ? value : defaults[collectionKey],
      ] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<PersistedCollectionKey, unknown>;
}

async function ensureBootstrapRuntimeShards() {
  if (await hasRuntimeShards()) {
    return;
  }

  const legacyRuntimeStore = await readMockJsonFile(mockRuntimeStorePath);
  if (legacyRuntimeStore && typeof legacyRuntimeStore === "object") {
    const collections = toPersistedCollections(legacyRuntimeStore as Record<string, unknown>);
    await writeRuntimeCollections(collections, 1);
    return;
  }

  const seedStore = JSON.parse(await readFile(mockSeedStorePath, "utf8")) as unknown;
  const collections = toPersistedCollections(seedStore as Record<string, unknown>);
  await writeRuntimeCollections(collections, 1);
}

async function readOrBootstrapMockStorePayload() {
  const collections = await readRuntimeCollections();
  const meta = await readRuntimeMeta();

  return {
    store: fromPersistedCollections(collections),
    version: meta.version,
  };
}

async function readMockVersionPayload() {
  await ensureBootstrapRuntimeShards();
  const meta = await readRuntimeMeta();
  return {
    version: meta.version,
  };
}

async function applyMockPatch(baseVersion: number, collections: Partial<Record<PersistedCollectionKey, unknown>>) {
  await ensureBootstrapRuntimeShards();
  const meta = await readRuntimeMeta();

  if (baseVersion !== meta.version) {
    return {
      status: 409,
      payload: {
        error: "version-conflict",
        currentVersion: meta.version,
      },
    };
  }

  const invalidCollectionKey = Object.keys(collections).find(
    (collectionKey) => !persistedCollectionKeys.includes(collectionKey as PersistedCollectionKey),
  );
  if (invalidCollectionKey) {
    return {
      status: 400,
      payload: {
        error: "invalid-collections",
      },
    };
  }

  const nextCollections = collections;

  if (Object.keys(nextCollections).length === 0) {
    return {
      status: 200,
      payload: {
        version: meta.version,
        writtenCollections: [],
      },
    };
  }

  await writeRuntimeCollections(nextCollections, meta.version + 1);
  return {
    status: 200,
    payload: {
      version: meta.version + 1,
      writtenCollections: Object.keys(nextCollections),
    },
  };
}

function mockStoreApiPlugin() {
  const configuredApiBase = `${configuredBasePath.replace(/\/$/, "")}/api/mock`;
  const stateRoutes = new Set([
    `${configuredApiBase}/state`,
    "/api/mock/state",
    `${configuredApiBase}/state.php`,
    "/api/mock/state.php",
  ]);
  const versionRoutes = new Set([
    `${configuredApiBase}/version`,
    "/api/mock/version",
    `${configuredApiBase}/version.php`,
    "/api/mock/version.php",
  ]);
  const patchRoutes = new Set([
    `${configuredApiBase}/patch`,
    "/api/mock/patch",
    `${configuredApiBase}/patch.php`,
    "/api/mock/patch.php",
  ]);

  return {
    name: "mock-store-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestPath = req.url?.split("?")[0] ?? "";

        if (!stateRoutes.has(requestPath) && !versionRoutes.has(requestPath) && !patchRoutes.has(requestPath)) {
          next();
          return;
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");

        if (stateRoutes.has(requestPath) && req.method === "GET") {
          const payload = await readOrBootstrapMockStorePayload();
          res.statusCode = 200;
          res.end(JSON.stringify(payload));
          return;
        }

        if (versionRoutes.has(requestPath) && req.method === "GET") {
          const payload = await readMockVersionPayload();
          res.statusCode = 200;
          res.end(JSON.stringify(payload));
          return;
        }

        if (patchRoutes.has(requestPath) && req.method === "POST") {
          const body = await new Promise<string>((resolve, reject) => {
            let raw = "";
            req.on("data", (chunk) => {
              raw += chunk;
            });
            req.on("end", () => resolve(raw));
            req.on("error", reject);
          });

          const parsed = body ? JSON.parse(body) : {};
          const baseVersion = Number(parsed?.baseVersion);
          const collections = parsed?.collections;
          if (
            !Number.isInteger(baseVersion) ||
            !collections ||
            typeof collections !== "object" ||
            Array.isArray(collections)
          ) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "invalid-patch" }));
            return;
          }

          const { status, payload } = await applyMockPatch(
            baseVersion,
            collections as Partial<Record<PersistedCollectionKey, unknown>>,
          );
          res.statusCode = status;
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
  base: configuredBasePath,
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
