import { readFile } from "node:fs/promises";
import { normalizeStore } from "./default-store.js";
import type { DemoStoreRecord } from "./types.js";

export async function readSeedStore(seedStorePath: string): Promise<DemoStoreRecord> {
  const raw = JSON.parse(await readFile(seedStorePath, "utf8")) as Record<string, unknown>;
  return normalizeStore(raw);
}
