import { persistedCollectionKeys, type PersistedCollectionKey } from "@emandar/shared";
import { cloneValue, normalizeStore } from "./default-store.js";
import type { DemoStoreRecord, JsonRecord, StoreRepository, StoreSnapshot } from "./types.js";

export class MemoryStoreRepository implements StoreRepository {
  private store: DemoStoreRecord;
  private version: number;

  constructor(seed: Record<string, unknown> = {}, version = 1) {
    this.store = normalizeStore(seed);
    this.version = version;
  }

  async close() {
    return undefined;
  }

  async getVersion() {
    return this.version;
  }

  async patchCollections(
    baseVersion: number,
    collections: Partial<Record<PersistedCollectionKey, unknown[] | JsonRecord>>,
  ) {
    if (baseVersion !== this.version) {
      return { conflictVersion: this.version };
    }

    const writtenCollections = Object.keys(collections) as PersistedCollectionKey[];
    for (const key of writtenCollections) {
      this.store[key] = cloneValue(collections[key] ?? this.store[key]) as DemoStoreRecord[typeof key];
    }

    if (writtenCollections.length > 0) {
      this.version += 1;
    }

    return {
      version: this.version,
      writtenCollections,
    };
  }

  async readSnapshot(): Promise<StoreSnapshot> {
    return {
      store: normalizeStore(this.store),
      version: this.version,
    };
  }

  async seedFromStore(store: DemoStoreRecord, options: { reset?: boolean } = {}) {
    if (options.reset || persistedCollectionKeys.every((key) => {
      const value = this.store[key];
      return Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0;
    })) {
      this.store = normalizeStore(store);
      this.version += 1;
    }
  }
}
