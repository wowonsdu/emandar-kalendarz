import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type ApiConfig = {
  basePath: string;
  databaseUrl?: string;
  demoSmsCode: string;
  host: string;
  port: number;
  publicAppUrl: string;
  seedStorePath: string;
  sessionSecret: string;
  useMemoryStore: boolean;
};

export function normalizeBasePath(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export function readConfig(): ApiConfig {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const basePath = normalizeBasePath(process.env.BASE_PATH || "/emandar");
  const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;

  return {
    basePath,
    databaseUrl,
    demoSmsCode: process.env.DEMO_SMS_CODE || "123456",
    host: process.env.HOST || "127.0.0.1",
    port: numberFromEnv(process.env.PORT, 4174),
    publicAppUrl: process.env.PUBLIC_APP_URL || "https://panel.ceo/emandar",
    seedStorePath:
      process.env.SEED_STORE_PATH ||
      path.resolve(moduleDir, "../../web/public/mock-data/seed-store.json"),
    sessionSecret: process.env.SESSION_SECRET || "dev-only-change-me",
    useMemoryStore: process.env.EMANDAR_USE_MEMORY_STORE === "true" || !databaseUrl,
  };
}
