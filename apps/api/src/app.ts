import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import Fastify, { type FastifyInstance, type RouteHandlerMethod } from "fastify";
import {
  commandRequestSchema,
  publicEnrollmentRequestSchema,
  smsConfirmSchema,
  smsRequestSchema,
  storePatchRequestSchema,
  uploadRequestSchema,
  type PersistedCollectionKey,
} from "@emandar/shared";
import { findUserByPhone } from "./auth/phone.js";
import type { ApiConfig } from "./config.js";
import { readConfig } from "./config.js";
import { DomainService } from "./services/domain-service.js";
import { generateSmsCode, SmsProvider } from "./services/sms-provider.js";
import { InMemoryAuthStore } from "./store/session.js";
import type { StoreRepository } from "./store/types.js";

export type AppOptions = {
  config?: ApiConfig;
  store: StoreRepository;
  authStore?: InMemoryAuthStore;
};

function routePaths(config: ApiConfig, path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const basePath = config.basePath || "";
  return Array.from(new Set([normalized, `${basePath}${normalized}`]));
}

function registerAll(
  app: FastifyInstance,
  method: "get" | "post",
  config: ApiConfig,
  path: string,
  handler: RouteHandlerMethod,
) {
  for (const routePath of routePaths(config, path)) {
    app[method](routePath, handler);
  }
}

function getSessionCookieOptions(config: ApiConfig) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.publicAppUrl.startsWith("https://"),
    path: config.basePath || "/",
  };
}

export async function buildApp(options: AppOptions) {
  const config = options.config ?? readConfig();
  const authStore = options.authStore ?? new InMemoryAuthStore();
  const domain = new DomainService(options.store);
  const smsProvider = new SmsProvider(config);
  const app = Fastify({
    logger: false,
  });

  await app.register(cookie, {
    secret: config.sessionSecret,
  });
  await app.register(cors, {
    credentials: true,
    origin: true,
  });

  registerAll(app, "get", config, "/api/health", async () => ({
    ok: true,
    service: "emandar-api",
  }));

  if (config.allowLegacyStoreApi) {
    for (const statePath of ["/api/mock/state", "/api/mock/state.php", "/api/store/state"]) {
      registerAll(app, "get", config, statePath, async () => options.store.readSnapshot());
    }

    for (const versionPath of ["/api/mock/version", "/api/mock/version.php", "/api/store/version"]) {
      registerAll(app, "get", config, versionPath, async () => ({
        version: await options.store.getVersion(),
      }));
    }

    for (const patchPath of ["/api/mock/patch", "/api/mock/patch.php", "/api/store/patch"]) {
      registerAll(app, "post", config, patchPath, async (request, reply) => {
        const parsed = storePatchRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({ error: "invalid-patch" });
        }

        const result = await options.store.patchCollections(
          parsed.data.baseVersion,
          parsed.data.collections as Partial<Record<PersistedCollectionKey, Record<string, unknown> | unknown[]>>,
        );

        if ("conflictVersion" in result) {
          return reply.status(409).send({
            error: "version-conflict",
            currentVersion: result.conflictVersion,
          });
        }

        return result;
      });
    }
  }

  registerAll(app, "get", config, "/api/public/bootstrap", async () => domain.publicStore());
  registerAll(app, "get", config, "/api/public/trainers", async () => ({
    trainers: (await domain.publicStore()).trainers,
  }));
  registerAll(app, "get", config, "/api/public/events", async () => ({
    events: (await domain.publicStore()).publicTrainingEvents,
  }));
  registerAll(app, "post", config, "/api/public/enrollments", async (request, reply) => {
    const parsed = publicEnrollmentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-enrollment" });
    }

    await domain.runCommand("submitEnrollment", [parsed.data], authStore.getSession(request.cookies.emandar_session)?.userId ?? null);
    return { ok: true };
  });

  registerAll(app, "post", config, "/api/auth/sms/request", async (request, reply) => {
    const parsed = smsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-phone" });
    }

    const normalizedPhone = parsed.data.phone.trim();
    const code = generateSmsCode();
    authStore.createSmsChallenge(normalizedPhone, code, config.smsCodeTtlSeconds);
    await smsProvider.sendLoginCode(normalizedPhone, code);
    return {
      normalizedPhone,
      code: config.smsapiTestMode ? code : undefined,
    };
  });

  registerAll(app, "post", config, "/api/auth/sms/confirm", async (request, reply) => {
    const parsed = smsConfirmSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-code" });
    }

    const phone = parsed.data.phone.trim();
    const challenge = authStore.consumeSmsChallenge(phone);
    if (!challenge) {
      return reply.status(400).send({ error: "sms-challenge-required" });
    }

    if (parsed.data.code.trim() !== challenge.code) {
      return reply.status(401).send({ error: "invalid-code" });
    }

    const snapshot = await options.store.readSnapshot();
    const existingUser = findUserByPhone(snapshot.store, phone);
    if (!existingUser || typeof existingUser !== "object") {
      return {
        status: "missing-account",
        phone,
        verifiedAt: new Date().toISOString(),
      };
    }

    const userId = String((existingUser as { id: string }).id);
    const session = authStore.createSession(userId);
    reply.setCookie("emandar_session", session.id, getSessionCookieOptions(config));

    return {
      status: "existing-account",
      userId,
      phone,
    };
  });

  if (config.allowLegacyStoreApi) {
    registerAll(app, "post", config, "/api/auth/dev-login", async (request, reply) => {
      const body = request.body as { email?: string; password?: string } | undefined;
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "");
      const snapshot = await options.store.readSnapshot();
      const users = Array.isArray(snapshot.store.users) ? snapshot.store.users : [];
      const user = users.find(
        (item) =>
          item &&
          typeof item === "object" &&
          String((item as { email?: string }).email ?? "").toLowerCase() === email &&
          String((item as { password?: string }).password ?? "") === password,
      ) as { id: string } | undefined;

      if (!user) {
        return reply.status(401).send({ error: "invalid-login" });
      }

      const session = authStore.createSession(user.id);
      reply.setCookie("emandar_session", session.id, getSessionCookieOptions(config));
      return { userId: user.id };
    });
  }

  registerAll(app, "get", config, "/api/auth/session", async (request) => {
    const session = authStore.getSession(request.cookies.emandar_session);
    return {
      userId: session?.userId ?? null,
    };
  });

  registerAll(app, "get", config, "/api/me", async (request, reply) => {
    const session = authStore.getSession(request.cookies.emandar_session);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    return { user: await domain.user(session.userId) };
  });

  registerAll(app, "get", config, "/api/panel/bootstrap", async (request, reply) => {
    const session = authStore.getSession(request.cookies.emandar_session);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    return domain.privateStore(session.userId);
  });

  registerAll(app, "post", config, "/api/panel/command/:name", async (request, reply) => {
    const session = authStore.getSession(request.cookies.emandar_session);
    const commandName = (request.params as { name?: string }).name ?? "";
    const parsed = commandRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-command" });
    }

    try {
      const result = await domain.runCommand(commandName, parsed.data.args, session?.userId ?? null);
      if (
        (commandName === "registerParticipant" || commandName === "ensurePhoneParticipantProfileForFlow") &&
        result &&
        typeof result === "object" &&
        "userId" in result &&
        typeof result.userId === "string"
      ) {
        const nextSession = authStore.createSession(result.userId);
        reply.setCookie("emandar_session", nextSession.id, getSessionCookieOptions(config));
      }

      return {
        ok: true,
        result,
      };
    } catch (error) {
      return reply.status(400).send({
        error: "command-failed",
        message: error instanceof Error ? error.message : "Nie udało się wykonać operacji.",
      });
    }
  });

  registerAll(app, "post", config, "/api/uploads", async (request, reply) => {
    const session = authStore.getSession(request.cookies.emandar_session);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const parsed = uploadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-upload" });
    }

    const buffer = Buffer.from(parsed.data.dataBase64, "base64");
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return reply.status(413).send({ error: "file-too-large" });
    }

    const extension = parsed.data.contentType === "image/png"
      ? "png"
      : parsed.data.contentType === "image/webp"
        ? "webp"
        : "jpg";
    const id = `upload-${crypto.randomUUID()}`;
    const filename = `${id}.${extension}`;
    const storagePath = path.join(config.uploadStoragePath, filename);
    await mkdir(config.uploadStoragePath, { recursive: true });
    await writeFile(storagePath, buffer);
    const publicUrl = `${config.storagePublicPath}/${filename}`.replace(/([^:]\/)\/+/g, "$1");

    return {
      id,
      url: publicUrl,
      storagePath,
      width: 0,
      height: 0,
    };
  });

  registerAll(app, "post", config, "/api/auth/logout", async (request, reply) => {
    authStore.deleteSession(request.cookies.emandar_session);
    reply.clearCookie("emandar_session", getSessionCookieOptions(config));
    return {
      ok: true,
    };
  });

  app.addHook("onClose", async () => {
    await options.store.close();
  });

  return app;
}
