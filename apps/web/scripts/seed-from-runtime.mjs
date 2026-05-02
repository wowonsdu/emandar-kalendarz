import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readJsonFile,
  readRuntimeStore,
  resolveRuntimePaths,
} from "./seed-runtime-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const paths = resolveRuntimePaths(projectRoot);

const seedStore = await readJsonFile(paths.seedStorePath);
const runtimeStore = await readRuntimeStore(paths);

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
  ...seedStore,
  ...runtimeStore,
  users: Array.from(mergedUsersById.values()),
  trainers: seedStore.trainers ?? runtimeStore.trainers ?? [],
  publicTrainingEvents:
    Array.isArray(runtimeStore.publicTrainingEvents) && runtimeStore.publicTrainingEvents.length > 0
      ? runtimeStore.publicTrainingEvents
      : seedStore.publicTrainingEvents ?? [],
};

await writeFile(paths.seedStorePath, `${JSON.stringify(nextSeedStore, null, 2)}\n`, "utf8");

process.stdout.write(
  `Seed store overwritten from shard runtime while preserving trainer profiles.\nSeed: ${paths.seedStorePath}\nRuntime dir: ${paths.runtimeShardsDir}\n`,
);
