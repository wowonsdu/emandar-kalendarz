import type { PersistedCollectionKey } from "@emandar/shared";

export type JsonRecord = Record<string, unknown>;

export type DemoStoreRecord = Record<PersistedCollectionKey, unknown[] | JsonRecord>;

export type StoreSnapshot = {
  store: DemoStoreRecord;
  version: number;
};

export interface StoreRepository {
  close(): Promise<void>;
  getVersion(): Promise<number>;
  patchCollections(
    baseVersion: number,
    collections: Partial<Record<PersistedCollectionKey, unknown[] | JsonRecord>>,
  ): Promise<{ version: number; writtenCollections: PersistedCollectionKey[] } | { conflictVersion: number }>;
  readSnapshot(): Promise<StoreSnapshot>;
  seedFromStore(store: DemoStoreRecord, options?: { reset?: boolean }): Promise<void>;
}
