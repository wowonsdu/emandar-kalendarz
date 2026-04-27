import { readConfig, type ApiConfig } from "./config.js";
import { MemoryStoreRepository } from "./store/memory-store.js";
import { PgStoreRepository } from "./store/pg-store.js";
import { readProductionSeedStore, readSeedStore } from "./store/seed.js";
import type { StoreRepository } from "./store/types.js";

export async function createStoreFromConfig(config: ApiConfig = readConfig()): Promise<StoreRepository> {
  const seedStore = config.useMemoryStore
    ? await readSeedStore(config.seedStorePath)
    : await readProductionSeedStore(config.seedStorePath);

  if (config.useMemoryStore) {
    return new MemoryStoreRepository(seedStore);
  }

  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required when EMANDAR_USE_MEMORY_STORE is not enabled.");
  }

  const store = PgStoreRepository.fromDatabaseUrl(config.databaseUrl);
  await store.migrate();
  await store.seedFromStore(seedStore);
  return store;
}
