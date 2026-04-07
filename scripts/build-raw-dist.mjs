import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const rawBasePath = "/emandar-raw/";
const outputDir = path.join(projectRoot, "dist-raw");
const seedStorePath = path.join(projectRoot, "public/mock-data/seed-store.json");

const rawArrayCollections = [
  "groups",
  "groupMembers",
  "eventParticipants",
  "trainingEvents",
  "publicTrainingEvents",
  "availabilitySlots",
  "trainerSharedSlots",
  "trainerCalendarFeeds",
  "organizerCalendarFeeds",
  "trainerOrganizerCalendarFeeds",
  "trainerExternalBusyMonths",
  "organizerExternalBusyMonths",
  "enrollmentRequests",
  "notifications",
];

function rewriteBasePathStrings(value) {
  if (typeof value === "string") {
    return value.replaceAll("/emandar/", rawBasePath);
  }

  if (Array.isArray(value)) {
    return value.map((item) => rewriteBasePathStrings(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, rewriteBasePathStrings(nestedValue)]),
    );
  }

  return value;
}

function createRawSeed(seedStore) {
  const nextStore = rewriteBasePathStrings(structuredClone(seedStore));

  for (const collectionKey of rawArrayCollections) {
    nextStore[collectionKey] = [];
  }

  return nextStore;
}

async function runBuild() {
  await rm(outputDir, { recursive: true, force: true });

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["./node_modules/vite/bin/vite.js", "build", "--outDir", "dist-raw"],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          EMANDAR_BASE_PATH: rawBasePath,
        },
        stdio: "inherit",
      },
    );

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Raw build failed with exit code ${code ?? "unknown"}.`));
    });
    child.on("error", reject);
  });
}

async function writeRawSeedFiles() {
  const seedStore = JSON.parse(await readFile(seedStorePath, "utf8"));
  const rawSeed = createRawSeed(seedStore);
  const rawSeedJson = `${JSON.stringify(rawSeed, null, 2)}\n`;

  await writeFile(path.join(outputDir, "mock-data/seed-store.json"), rawSeedJson, "utf8");
  await writeFile(path.join(outputDir, "mock-data/runtime-store.json"), rawSeedJson, "utf8");

  const summary = {
    users: rawSeed.users?.length ?? 0,
    trainers: rawSeed.trainers?.length ?? 0,
    organizers: rawSeed.organizers?.length ?? 0,
    participantProfiles: rawSeed.participantProfiles?.length ?? 0,
    relations: rawSeed.relations?.length ?? 0,
    trainingEvents: rawSeed.trainingEvents?.length ?? 0,
    groups: rawSeed.groups?.length ?? 0,
    enrollmentRequests: rawSeed.enrollmentRequests?.length ?? 0,
  };

  console.log(`Raw dist ready in ${outputDir}`);
  console.log(JSON.stringify(summary, null, 2));
}

await runBuild();
await writeRawSeedFiles();
