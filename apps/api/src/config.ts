import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type ApiConfig = {
  allowLegacyStoreApi: boolean;
  basePath: string;
  corsAllowedOrigins: string[];
  databaseUrl?: string;
  host: string;
  port: number;
  publicAppUrl: string;
  seedStorePath: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  smsapiFrom?: string;
  smsapiTestMode: boolean;
  smsapiToken?: string;
  smsCodeTtlSeconds: number;
  storagePublicPath: string;
  uploadStoragePath: string;
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
  const useMemoryStore = process.env.EMANDAR_USE_MEMORY_STORE === "true" || !databaseUrl;
  const smsapiTestMode = process.env.SMSAPI_TEST_MODE !== "false";

  const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "https://panel.ceo")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    allowLegacyStoreApi: process.env.ALLOW_LEGACY_STORE_API === "true" || useMemoryStore,
    basePath,
    corsAllowedOrigins,
    databaseUrl,
    host: process.env.HOST || "127.0.0.1",
    port: numberFromEnv(process.env.PORT, 4174),
    publicAppUrl: process.env.PUBLIC_APP_URL || "https://panel.ceo/emandar",
    seedStorePath:
      process.env.SEED_STORE_PATH ||
      path.resolve(moduleDir, "../../../seed-data/seed-store.json"),
    sessionSecret: process.env.SESSION_SECRET || "dev-only-change-me",
    sessionTtlSeconds: numberFromEnv(process.env.SESSION_TTL_SECONDS, 60 * 60 * 24 * 30),
    smsapiFrom: process.env.SMSAPI_FROM?.trim() || undefined,
    smsapiTestMode,
    smsapiToken: process.env.SMSAPI_TOKEN?.trim() || undefined,
    smsCodeTtlSeconds: numberFromEnv(process.env.SMS_CODE_TTL_SECONDS, 300),
    storagePublicPath: normalizeBasePath(process.env.UPLOADS_PUBLIC_PATH || "/emandar/uploads"),
    uploadStoragePath: process.env.UPLOAD_STORAGE_PATH || "/opt/panel.ceo/emandar-data/uploads",
    useMemoryStore,
  };
}
