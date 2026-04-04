import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readJsonFile,
  resolveRuntimePaths,
  toPersistedCollections,
  writeRuntimeCollections,
} from "./mock-runtime-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const paths = resolveRuntimePaths(projectRoot);

const seedStore = await readJsonFile(paths.seedStorePath);
await writeRuntimeCollections(paths.runtimeShardsDir, toPersistedCollections(seedStore), 1);

process.stdout.write(
  `Mock runtime shards reset from seed.\nSeed: ${paths.seedStorePath}\nRuntime dir: ${paths.runtimeShardsDir}\n`,
);
