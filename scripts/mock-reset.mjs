import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const seedStorePath = path.join(projectRoot, "public/mock-data/seed-store.json");
const runtimeStorePath =
  process.env.EMANDAR_RUNTIME_STORE_PATH?.trim() ||
  path.join(projectRoot, ".local-state/emandar/runtime-store.json");

const seedStore = await readFile(seedStorePath, "utf8");
await mkdir(path.dirname(runtimeStorePath), { recursive: true });
await writeFile(runtimeStorePath, seedStore.endsWith("\n") ? seedStore : `${seedStore}\n`, "utf8");

process.stdout.write(`Mock runtime store reset from seed.\nSeed: ${seedStorePath}\nRuntime: ${runtimeStorePath}\n`);
