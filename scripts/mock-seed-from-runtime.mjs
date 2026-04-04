import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const seedStorePath = path.join(projectRoot, "public/mock-data/seed-store.json");
const runtimeStorePath =
  process.env.EMANDAR_RUNTIME_STORE_PATH?.trim() ||
  path.join(projectRoot, ".local-state/emandar/runtime-store.json");

async function readJsonFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`JSON file is empty: ${filePath}`);
  }

  return JSON.parse(trimmed);
}

const seedStore = await readJsonFile(seedStorePath);
const runtimeStore = await readJsonFile(runtimeStorePath);

const preservedTrainerUserIds = new Set(
  (seedStore.users ?? [])
    .filter((user) => user?.trainerProfileId || (Array.isArray(user?.roles) && user.roles.includes("trainer")))
    .map((user) => user.id),
);

const mergedUsersById = new Map((runtimeStore.users ?? []).map((user) => [user.id, user]));
for (const seedUser of seedStore.users ?? []) {
  if (preservedTrainerUserIds.has(seedUser.id)) {
    mergedUsersById.set(seedUser.id, seedUser);
  }
}

const nextSeedStore = {
  ...runtimeStore,
  users: Array.from(mergedUsersById.values()),
  trainers: seedStore.trainers ?? runtimeStore.trainers ?? [],
};

await writeFile(seedStorePath, `${JSON.stringify(nextSeedStore, null, 2)}\n`, "utf8");

process.stdout.write(
  `Seed store overwritten from runtime while preserving trainer profiles.\nSeed: ${seedStorePath}\nRuntime: ${runtimeStorePath}\n`,
);
