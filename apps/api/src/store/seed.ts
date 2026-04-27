import { readFile } from "node:fs/promises";
import { createEmptyStore, normalizeStore } from "./default-store.js";
import type { DemoStoreRecord } from "./types.js";

export async function readSeedStore(seedStorePath: string): Promise<DemoStoreRecord> {
  const raw = JSON.parse(await readFile(seedStorePath, "utf8")) as Record<string, unknown>;
  return normalizeStore(raw);
}

export async function readProductionSeedStore(seedStorePath: string): Promise<DemoStoreRecord> {
  const seed = await readSeedStore(seedStorePath);
  const trainerRows = Array.isArray(seed.trainers) ? seed.trainers : [];
  const trainerUserIds = new Set(
    trainerRows
      .map((trainer) =>
        trainer && typeof trainer === "object" ? (trainer as { userId?: unknown }).userId : null,
      )
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0),
  );
  const users = Array.isArray(seed.users)
    ? seed.users.filter((user) => {
        if (!user || typeof user !== "object") {
          return false;
        }
        const typed = user as { id?: unknown; role?: unknown; roles?: unknown };
        return (
          (typeof typed.id === "string" && trainerUserIds.has(typed.id)) ||
          typed.role === "admin" ||
          (Array.isArray(typed.roles) && typed.roles.includes("admin"))
        );
      })
    : [];

  return {
    ...createEmptyStore(),
    users,
    trainers: trainerRows,
    appSettings: seed.appSettings,
  };
}
