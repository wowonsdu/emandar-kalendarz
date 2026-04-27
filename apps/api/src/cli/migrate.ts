import { readConfig } from "../config.js";
import { PgStoreRepository } from "../store/pg-store.js";

const config = readConfig();
if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required for migrations.");
}

const store = PgStoreRepository.fromDatabaseUrl(config.databaseUrl);
await store.migrate();
await store.close();
console.log("Database migrations applied.");
