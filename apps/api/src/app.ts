import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type RouteHandlerMethod } from "fastify";
import {
  smsConfirmSchema,
  smsRequestSchema,
  storePatchRequestSchema,
  type PersistedCollectionKey,
} from "@emandar/shared";
import { findUserByPhone } from "./auth/phone.js";
import type { ApiConfig } from "./config.js";
import { readConfig } from "./config.js";
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

  registerAll(app, "post", config, "/api/auth/sms/request", async (request, reply) => {
    const parsed = smsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-phone" });
    }

    const normalizedPhone = parsed.data.phone.trim();
    authStore.createSmsChallenge(normalizedPhone);
    return {
      normalizedPhone,
      code: config.demoSmsCode,
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

    if (parsed.data.code.trim() !== config.demoSmsCode) {
      return reply.status(401).send({ error: "invalid-code" });
    }

    const snapshot = await options.store.readSnapshot();
    const existingUser = findUserByPhone(snapshot.store, phone);
    if (!existingUser || typeof existingUser !== "object") {
      return {
        status: "missing-account",
        phone,
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

  registerAll(app, "get", config, "/api/auth/session", async (request) => {
    const session = authStore.getSession(request.cookies.emandar_session);
    return {
      userId: session?.userId ?? null,
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
