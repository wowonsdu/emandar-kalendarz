import { readConfig } from "../config.js";
import { PgStoreRepository } from "../store/pg-store.js";
import { readSeedStore } from "../store/seed.js";

const config = readConfig();
if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required for seed import.");
}

const reset = process.argv.includes("--reset");
const store = PgStoreRepository.fromDatabaseUrl(config.databaseUrl);
await store.migrate();
await store.seedFromStore(await readSeedStore(config.seedStorePath), { reset });
await store.close();
console.log(reset ? "Seed imported with reset." : "Seed imported when database was empty.");
