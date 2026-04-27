import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const persistedCollectionKeys = [
  "users",
  "trainers",
  "organizers",
  "participantProfiles",
  "groups",
  "groupMembers",
  "eventParticipants",
  "relations",
  "trainingEvents",
  "enrollmentRequests",
  "notifications",
  "appSettings",
];

export function getDefaultNotificationSettings() {
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

export function createDefaultStore() {
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
    enrollmentRequests: [],
    notifications: [],
    appSettings: {
      signupPhotoMode: "optional",
      enrollmentPhotoMode: "optional",
      defaultNotificationSettings: getDefaultNotificationSettings(),
    },
  };
}

export function resolveRuntimePaths(projectRoot) {
  const runtimeStorePath =
    process.env.EMANDAR_RUNTIME_STORE_PATH?.trim() ||
    path.join(projectRoot, ".local-state/emandar/runtime-store.json");

  return {
    seedStorePath: path.join(projectRoot, "public/mock-data/seed-store.json"),
    runtimeStorePath,
    runtimeShardsDir: path.join(
      path.dirname(runtimeStorePath),
      path.basename(runtimeStorePath, path.extname(runtimeStorePath)) || "runtime-store",
    ),
  };
}

export async function readJsonFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`JSON file is empty: ${filePath}`);
  }

  return JSON.parse(trimmed);
}

export async function readJsonFileOrNull(filePath) {
  try {
    return await readJsonFile(filePath);
  } catch {
    return null;
  }
}

export async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeJsonFile(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function toPersistedCollections(store) {
  const defaults = createDefaultStore();

  return Object.fromEntries(
    persistedCollectionKeys.map((collectionKey) => {
      const value = store?.[collectionKey];
      return [collectionKey, value && typeof value === "object" ? value : defaults[collectionKey]];
    }),
  );
}

export function fromPersistedCollections(collections) {
  const defaults = createDefaultStore();
  const store = { ...defaults };

  for (const collectionKey of persistedCollectionKeys) {
    const value = collections?.[collectionKey];
    store[collectionKey] =
      value && typeof value === "object" ? value : defaults[collectionKey];
  }

  store.publicTrainingEvents = [];
  return store;
}

export async function hasRuntimeShards(runtimeShardsDir) {
  if (!(await pathExists(path.join(runtimeShardsDir, "meta.json")))) {
    return false;
  }

  const collectionChecks = await Promise.all(
    persistedCollectionKeys.map((collectionKey) =>
      pathExists(path.join(runtimeShardsDir, `${collectionKey}.json`)),
    ),
  );

  return collectionChecks.every(Boolean);
}

export async function writeRuntimeCollections(runtimeShardsDir, collections, version = 1) {
  await mkdir(runtimeShardsDir, { recursive: true });

  for (const collectionKey of persistedCollectionKeys) {
    await writeJsonFile(
      path.join(runtimeShardsDir, `${collectionKey}.json`),
      collections[collectionKey],
    );
  }

  await writeJsonFile(path.join(runtimeShardsDir, "meta.json"), {
    version,
    updatedAt: new Date().toISOString(),
  });
}

export async function ensureRuntimeCollections(paths) {
  if (await hasRuntimeShards(paths.runtimeShardsDir)) {
    return;
  }

  const legacyRuntime = await readJsonFileOrNull(paths.runtimeStorePath);
  if (legacyRuntime && typeof legacyRuntime === "object") {
    await writeRuntimeCollections(
      paths.runtimeShardsDir,
      toPersistedCollections(legacyRuntime),
      1,
    );
    return;
  }

  const seedStore = await readJsonFile(paths.seedStorePath);
  await writeRuntimeCollections(paths.runtimeShardsDir, toPersistedCollections(seedStore), 1);
}

export async function readRuntimeCollections(paths) {
  await ensureRuntimeCollections(paths);

  const defaults = createDefaultStore();
  const entries = await Promise.all(
    persistedCollectionKeys.map(async (collectionKey) => {
      const collectionPath = path.join(paths.runtimeShardsDir, `${collectionKey}.json`);
      const value = await readJsonFileOrNull(collectionPath);
      return [
        collectionKey,
        value && typeof value === "object" ? value : defaults[collectionKey],
      ];
    }),
  );

  return Object.fromEntries(entries);
}

export async function readRuntimeStore(paths) {
  const collections = await readRuntimeCollections(paths);
  return fromPersistedCollections(collections);
}
