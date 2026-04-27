import { readConfig } from "../config.js";
import { PgStoreRepository } from "../store/pg-store.js";
import { readProductionSeedStore, readSeedStore } from "../store/seed.js";

const config = readConfig();
if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required for seed import.");
}

const reset = process.argv.includes("--reset");
const fullDemoSeed = process.argv.includes("--full-demo");
const store = PgStoreRepository.fromDatabaseUrl(config.databaseUrl);
await store.migrate();
await store.seedFromStore(
  fullDemoSeed
    ? await readSeedStore(config.seedStorePath)
    : await readProductionSeedStore(config.seedStorePath),
  { reset },
);
await store.close();
console.log(
  reset
    ? "Production seed imported with reset."
    : "Production seed imported when database was empty.",
);
