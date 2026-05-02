import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest, type RouteHandlerMethod } from "fastify";
import {
  appSettingsMutationSchema,
  booleanMutationSchema,
  commandRequestSchema,
  communityEventReviewMutationSchema,
  eventParticipantStatusMutationSchema,
  participantRegistrationRequestSchema,
  publicEnrollmentRequestSchema,
  signedAttendanceRequestSchema,
  signedCommunityEventReviewRequestSchema,
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
import { InMemoryAuthStore, type SecurityStore, type UploadPurpose } from "./store/session.js";
import type { StoreRepository } from "./store/types.js";

export type AppOptions = {
  config?: ApiConfig;
  store: StoreRepository;
  authStore?: SecurityStore;
};

const csrfCookieName = "emandar_csrf";
const registrationTokenTtlSeconds = 15 * 60;
const signedActionTokenTtlSeconds = 14 * 24 * 60 * 60;

function routePaths(config: ApiConfig, routePath: string) {
  const normalized = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const basePath = config.basePath || "";
  return Array.from(new Set([normalized, `${basePath}${normalized}`]));
}

function registerAll(
  app: FastifyInstance,
  method: "get" | "post",
  config: ApiConfig,
  routePath: string,
  handler: RouteHandlerMethod,
) {
  for (const pathName of routePaths(config, routePath)) {
    app[method](pathName, handler);
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

function getCsrfCookieOptions(config: ApiConfig) {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: config.publicAppUrl.startsWith("https://"),
    path: config.basePath || "/",
  };
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function requireCsrf(request: FastifyRequest, reply: FastifyReply) {
  const cookieToken = request.cookies[csrfCookieName];
  const headerToken = request.headers["x-emandar-csrf"];
  const normalizedHeader = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  if (!cookieToken || !normalizedHeader || normalizedHeader !== cookieToken) {
    reply.status(403).send({ error: "csrf-required" });
    return false;
  }
  return true;
}

function getRequestIp(request: FastifyRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim();
  }
  return request.ip;
}

function isAllowedCorsOrigin(origin: string | undefined, allowedOrigins: string[]) {
  return !origin || allowedOrigins.includes(origin);
}

function hasMagicHeader(buffer: Buffer, contentType: string) {
  if (contentType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

function readImageDimensions(buffer: Buffer, contentType: string) {
  if (contentType === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (contentType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }

  if (contentType === "image/webp" && buffer.length >= 30 && buffer.toString("ascii", 12, 16) === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  return { width: 0, height: 0 };
}

async function assertOwnedUpload(
  authStore: SecurityStore,
  userId: string,
  value: string | undefined | null,
  purpose: UploadPurpose,
) {
  if (!value) return;
  const upload = await authStore.getUploadByIdOrUrl(value);
  if (!upload || upload.ownerUserId !== userId || upload.purpose !== purpose) {
    throw new Error("Ten plik nie należy do bieżącego użytkownika albo ma nieprawidłowe przeznaczenie.");
  }
}

async function assertCommandUploads(authStore: SecurityStore, commandName: string, args: unknown[], userId: string) {
  const input = (args[0] ?? {}) as Record<string, unknown>;
  if (commandName === "updateParticipantProfile") {
    await assertOwnedUpload(authStore, userId, typeof input.avatarUrl === "string" ? input.avatarUrl : null, "avatar");
  }
  if (commandName === "submitEnrollment") {
    await assertOwnedUpload(authStore, userId, typeof input.photoPath === "string" ? input.photoPath : null, "enrollment-photo");
  }
  if (["createTrainingEvent", "updateTrainingEventManagement"].includes(commandName) && Array.isArray(input.eventImages)) {
    for (const image of input.eventImages) {
      if (image && typeof image === "object") {
        await assertOwnedUpload(authStore, userId, String((image as { id?: unknown }).id ?? ""), "event-image");
      }
    }
  }
}

function auditEntity(commandName: string, result: unknown, args: unknown[]) {
  if (result && typeof result === "object") {
    const record = result as { userId?: unknown; groupId?: unknown; eventId?: unknown };
    if (typeof record.userId === "string") return { entityType: "user", entityId: record.userId };
    if (typeof record.groupId === "string") return { entityType: "group", entityId: record.groupId };
    if (typeof record.eventId === "string") return { entityType: "training_event", entityId: record.eventId };
  }
  const first = args[0];
  if (typeof first === "string") {
    return { entityType: commandName, entityId: first };
  }
  if (first && typeof first === "object" && typeof (first as { eventId?: unknown }).eventId === "string") {
    return { entityType: "training_event", entityId: String((first as { eventId: unknown }).eventId) };
  }
  return { entityType: "command", entityId: commandName };
}

function buildPublicRouteUrl(config: ApiConfig, routePath: string) {
  const base = config.publicAppUrl.replace(/\/+$/g, "");
  const pathName = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${base}${pathName}`;
}

async function requireSessionUser(request: FastifyRequest, reply: FastifyReply, authStore: SecurityStore) {
  const session = await authStore.getSession(request.cookies.emandar_session);
  if (!session) {
    reply.status(401).send({ error: "unauthorized" });
    return null;
  }
  return session.userId;
}

async function runAuthedCommand(
  reply: FastifyReply,
  authStore: SecurityStore,
  domain: DomainService,
  actorUserId: string,
  commandName: string,
  args: unknown[],
  auditPayload: Record<string, unknown> = {},
) {
  try {
    await assertCommandUploads(authStore, commandName, args, actorUserId);
    const result = await domain.runCommand(commandName, args, actorUserId);
    const entity = auditEntity(commandName, result, args);
    await authStore.recordAudit({
      actorUserId,
      action: commandName,
      entityType: entity.entityType,
      entityId: entity.entityId,
      payload: auditPayload,
    });
    return reply.send({ ok: true, result });
  } catch (error) {
    return reply.status(400).send({
      error: "command-failed",
      message: error instanceof Error ? error.message : "Nie udało się wykonać operacji.",
    });
  }
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
    origin(origin, callback) {
      callback(null, isAllowedCorsOrigin(origin, config.corsAllowedOrigins));
    },
  });
  await authStore.cleanupExpiredSessions();

  registerAll(app, "get", config, "/api/health", async () => ({
    ok: true,
    service: "emandar-api",
  }));

  registerAll(app, "get", config, "/api/auth/csrf", async (_request, reply) => {
    const token = createCsrfToken();
    reply.setCookie(csrfCookieName, token, getCsrfCookieOptions(config));
    return { token };
  });

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
    if (!requireCsrf(request, reply)) return reply;
    const parsed = publicEnrollmentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-enrollment" });
    }

    const session = await authStore.getSession(request.cookies.emandar_session);
    await domain.runCommand("submitEnrollment", [parsed.data], session?.userId ?? null);
    await authStore.recordAudit({
      actorUserId: session?.userId ?? null,
      action: "submitEnrollment",
      entityType: "training_event",
      entityId: parsed.data.eventId,
      payload: { source: "public-enrollment" },
    });
    return { ok: true };
  });

  registerAll(app, "post", config, "/api/auth/sms/request", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const parsed = smsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-phone" });
    }

    const normalizedPhone = parsed.data.phone.trim();
    const code = generateSmsCode();
    await authStore.createSmsChallenge(normalizedPhone, code, config.smsCodeTtlSeconds, getRequestIp(request));
    const delivery = await smsProvider.sendLoginCode(normalizedPhone, code);
    await authStore.recordNotificationDelivery({
      channel: "sms",
      recipient: normalizedPhone,
      provider: delivery.provider,
      providerMessageId: delivery.providerMessageId,
      status: delivery.status,
      error: delivery.error,
      payload: { kind: "login-code", testMode: config.smsapiTestMode },
    });
    return {
      normalizedPhone,
      code: config.smsapiTestMode ? code : undefined,
    };
  });

  registerAll(app, "post", config, "/api/auth/sms/confirm", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const parsed = smsConfirmSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-code" });
    }

    const phone = parsed.data.phone.trim();
    const challenge = await authStore.consumeSmsChallenge(phone);
    if (!challenge) {
      return reply.status(400).send({ error: "sms-challenge-required" });
    }

    if (parsed.data.code.trim() !== challenge.code) {
      return reply.status(401).send({ error: "invalid-code" });
    }

    const snapshot = await options.store.readSnapshot();
    const existingUser = findUserByPhone(snapshot.store, phone);
    if (!existingUser || typeof existingUser !== "object") {
      const registrationToken = await authStore.createRegistrationToken(phone, registrationTokenTtlSeconds);
      return {
        status: "missing-account",
        phone,
        registrationToken,
        verifiedAt: new Date().toISOString(),
      };
    }

    const userId = String((existingUser as { id: string }).id);
    const session = await authStore.createSession(userId, config.sessionTtlSeconds);
    reply.setCookie("emandar_session", session.id, getSessionCookieOptions(config));

    return {
      status: "existing-account",
      userId,
      phone,
    };
  });

  registerAll(app, "post", config, "/api/auth/register-participant", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const parsed = participantRegistrationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-registration" });
    }
    const input = parsed.data.input as Record<string, unknown>;
    const phone = String(input.phone ?? "").trim();
    const tokenValid = await authStore.consumeRegistrationToken(parsed.data.registrationToken, phone);
    if (!tokenValid) {
      return reply.status(403).send({ error: "registration-token-required" });
    }

    const result = await domain.runCommand("registerParticipant", [input], null);
    if (result && typeof result === "object" && "userId" in result && typeof result.userId === "string") {
      const nextSession = await authStore.createSession(result.userId, config.sessionTtlSeconds);
      reply.setCookie("emandar_session", nextSession.id, getSessionCookieOptions(config));
      await authStore.recordAudit({
        actorUserId: result.userId,
        action: "registerParticipant",
        entityType: "user",
        entityId: result.userId,
        payload: { accountCreated: Boolean((result as { accountCreated?: unknown }).accountCreated) },
      });
    }

    return { ok: true, result };
  });

  if (config.allowLegacyStoreApi) {
    registerAll(app, "post", config, "/api/auth/dev-login", async (request, reply) => {
      if (!requireCsrf(request, reply)) return reply;
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

      const session = await authStore.createSession(user.id, config.sessionTtlSeconds);
      reply.setCookie("emandar_session", session.id, getSessionCookieOptions(config));
      return { userId: user.id };
    });
  }

  registerAll(app, "get", config, "/api/auth/session", async (request) => {
    const session = await authStore.getSession(request.cookies.emandar_session);
    return {
      userId: session?.userId ?? null,
    };
  });

  registerAll(app, "get", config, "/api/me", async (request, reply) => {
    const session = await authStore.getSession(request.cookies.emandar_session);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    return { user: await domain.user(session.userId) };
  });

  registerAll(app, "get", config, "/api/panel/bootstrap", async (request, reply) => {
    const session = await authStore.getSession(request.cookies.emandar_session);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    return domain.privateStore(session.userId);
  });

  registerAll(app, "post", config, "/api/public/signed-actions/attendance", async (request, reply) => {
    const parsed = signedAttendanceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-signed-action" });
    }

    const action = parsed.data.decision === "decline" ? "attendance.decline" : "attendance.confirm";
    const token = await authStore.consumeSignedActionToken(parsed.data.token, { action });
    if (!token) {
      return reply.status(403).send({ error: "signed-token-invalid" });
    }

    try {
      const result = await domain.confirmEnrollmentAttendanceByEntity(
        token.entityId,
        parsed.data.decision,
      );
      await authStore.recordAudit({
        actorUserId: null,
        action,
        entityType: token.entityType,
        entityId: token.entityId,
        payload: { source: "signed-token", result },
      });
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({
        error: "signed-action-failed",
        message: error instanceof Error ? error.message : "Nie udało się użyć linku.",
      });
    }
  });

  registerAll(app, "get", config, "/api/public/signed-actions/community-event-review/:token", async (request, reply) => {
    const tokenValue = String((request.params as { token?: string }).token ?? "");
    const token = await authStore.getSignedActionToken(tokenValue);
    if (!token || token.action !== "community-event.review" || token.entityType !== "training_event") {
      return reply.status(403).send({ error: "signed-token-invalid" });
    }

    try {
      return await domain.getCommunityEventReviewByEntity(token.entityId);
    } catch (error) {
      return reply.status(400).send({
        error: "signed-action-failed",
        message: error instanceof Error ? error.message : "Nie udało się wczytać moderacji.",
      });
    }
  });

  registerAll(app, "post", config, "/api/public/signed-actions/community-event-review", async (request, reply) => {
    const parsed = signedCommunityEventReviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-signed-action" });
    }

    const token = await authStore.consumeSignedActionToken(parsed.data.token, {
      action: "community-event.review",
      entityType: "training_event",
    });
    if (!token) {
      return reply.status(403).send({ error: "signed-token-invalid" });
    }

    try {
      const result = await domain.reviewCommunityEventByEntity(
        token.entityId,
        { decision: parsed.data.decision, message: parsed.data.message },
        null,
      );
      await authStore.recordAudit({
        actorUserId: null,
        action: "community-event.review",
        entityType: token.entityType,
        entityId: token.entityId,
        payload: { source: "signed-token", decision: parsed.data.decision },
      });
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({
        error: "signed-action-failed",
        message: error instanceof Error ? error.message : "Nie udało się zapisać moderacji.",
      });
    }
  });

  registerAll(app, "post", config, "/api/panel/signed-actions/attendance", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const actorUserId = await requireSessionUser(request, reply, authStore);
    if (!actorUserId) return reply;
    const body = request.body as { entityId?: string; entityType?: string } | undefined;
    const entityId = String(body?.entityId ?? "").trim();
    const entityType = String(body?.entityType ?? "event_participant").trim();
    if (!entityId || !["event_participant", "enrollment_request"].includes(entityType)) {
      return reply.status(400).send({ error: "invalid-signed-action" });
    }

    const confirmToken = await authStore.createSignedActionToken({
      action: "attendance.confirm",
      entityType,
      entityId,
      ttlSeconds: signedActionTokenTtlSeconds,
    });
    const declineToken = await authStore.createSignedActionToken({
      action: "attendance.decline",
      entityType,
      entityId,
      ttlSeconds: signedActionTokenTtlSeconds,
    });
    await authStore.recordAudit({
      actorUserId,
      action: "signed-action.create.attendance",
      entityType,
      entityId,
      payload: { ttlSeconds: signedActionTokenTtlSeconds },
    });
    return {
      confirmToken,
      declineToken,
      confirmUrl: buildPublicRouteUrl(config, `/potwierdzenie-udzialu/${confirmToken}/confirm`),
      declineUrl: buildPublicRouteUrl(config, `/potwierdzenie-udzialu/${declineToken}/decline`),
    };
  });

  registerAll(app, "post", config, "/api/panel/signed-actions/community-event-review", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const actorUserId = await requireSessionUser(request, reply, authStore);
    if (!actorUserId) return reply;
    const body = request.body as { eventId?: string } | undefined;
    const eventId = String(body?.eventId ?? "").trim();
    if (!eventId) {
      return reply.status(400).send({ error: "invalid-signed-action" });
    }

    const token = await authStore.createSignedActionToken({
      action: "community-event.review",
      entityType: "training_event",
      entityId: eventId,
      ttlSeconds: signedActionTokenTtlSeconds,
    });
    await authStore.recordAudit({
      actorUserId,
      action: "signed-action.create.community-event-review",
      entityType: "training_event",
      entityId: eventId,
      payload: { ttlSeconds: signedActionTokenTtlSeconds },
    });
    return {
      token,
      reviewUrl: buildPublicRouteUrl(config, `/moderacja-wydarzenia/${token}`),
    };
  });

  registerAll(app, "post", config, "/api/panel/users/:userId/moderator-role", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const actorUserId = await requireSessionUser(request, reply, authStore);
    if (!actorUserId) return reply;
    const parsed = booleanMutationSchema.safeParse(request.body);
    if (!parsed.success || typeof parsed.data.enabled !== "boolean") {
      return reply.status(400).send({ error: "invalid-user-role" });
    }
    return runAuthedCommand(
      reply,
      authStore,
      domain,
      actorUserId,
      "updateUserModeratorRole",
      [String((request.params as { userId?: string }).userId ?? ""), parsed.data.enabled],
      { source: "explicit-endpoint" },
    );
  });

  registerAll(app, "post", config, "/api/panel/users/:userId/organizer-functions-block", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const actorUserId = await requireSessionUser(request, reply, authStore);
    if (!actorUserId) return reply;
    const parsed = booleanMutationSchema.safeParse(request.body);
    if (!parsed.success || typeof parsed.data.blocked !== "boolean") {
      return reply.status(400).send({ error: "invalid-user-block" });
    }
    return runAuthedCommand(
      reply,
      authStore,
      domain,
      actorUserId,
      "updateUserOrganizerFunctionsBlocked",
      [String((request.params as { userId?: string }).userId ?? ""), parsed.data.blocked],
      { source: "explicit-endpoint" },
    );
  });

  registerAll(app, "post", config, "/api/panel/settings", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const actorUserId = await requireSessionUser(request, reply, authStore);
    if (!actorUserId) return reply;
    const parsed = appSettingsMutationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-settings" });
    }
    return runAuthedCommand(reply, authStore, domain, actorUserId, "updateAppSettings", [parsed.data.input], {
      source: "explicit-endpoint",
    });
  });

  registerAll(app, "post", config, "/api/panel/events/:eventId/roster/finalize", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const actorUserId = await requireSessionUser(request, reply, authStore);
    if (!actorUserId) return reply;
    return runAuthedCommand(
      reply,
      authStore,
      domain,
      actorUserId,
      "finalizeEventRoster",
      [String((request.params as { eventId?: string }).eventId ?? "")],
      { source: "explicit-endpoint" },
    );
  });

  registerAll(app, "post", config, "/api/panel/events/:eventId/participants/status", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const actorUserId = await requireSessionUser(request, reply, authStore);
    if (!actorUserId) return reply;
    const parsed = eventParticipantStatusMutationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-participant-status" });
    }
    return runAuthedCommand(
      reply,
      authStore,
      domain,
      actorUserId,
      "updateEventParticipantStatus",
      [parsed.data],
      { source: "explicit-endpoint", eventId: String((request.params as { eventId?: string }).eventId ?? "") },
    );
  });

  for (const action of ["publish", "unpublish", "delete"] as const) {
    registerAll(app, "post", config, `/api/panel/events/:eventId/${action}`, async (request, reply) => {
      if (!requireCsrf(request, reply)) return reply;
      const actorUserId = await requireSessionUser(request, reply, authStore);
      if (!actorUserId) return reply;
      const commandName =
        action === "publish"
          ? "publishTrainingEvent"
          : action === "unpublish"
            ? "unpublishTrainingEvent"
            : "deleteTrainingEvent";
      return runAuthedCommand(
        reply,
        authStore,
        domain,
        actorUserId,
        commandName,
        [String((request.params as { eventId?: string }).eventId ?? "")],
        { source: "explicit-endpoint" },
      );
    });
  }

  registerAll(app, "post", config, "/api/panel/community-events/:eventId/review", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const actorUserId = await requireSessionUser(request, reply, authStore);
    if (!actorUserId) return reply;
    const parsed = communityEventReviewMutationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-community-review" });
    }
    try {
      const eventId = String((request.params as { eventId?: string }).eventId ?? "");
      const result = await domain.reviewCommunityEventByEntity(eventId, parsed.data, actorUserId);
      await authStore.recordAudit({
        actorUserId,
        action: "community-event.review",
        entityType: "training_event",
        entityId: eventId,
        payload: { source: "explicit-endpoint", decision: parsed.data.decision },
      });
      return { ok: true, result };
    } catch (error) {
      return reply.status(400).send({
        error: "command-failed",
        message: error instanceof Error ? error.message : "Nie udało się zapisać moderacji.",
      });
    }
  });

  registerAll(app, "post", config, "/api/panel/command/:name", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    const session = await authStore.getSession(request.cookies.emandar_session);
    if (!session) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const commandName = (request.params as { name?: string }).name ?? "";
    const parsed = commandRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid-command" });
    }

    try {
      if (commandName === "registerParticipant") {
        return reply.status(403).send({ error: "use-registration-endpoint" });
      }
      await assertCommandUploads(authStore, commandName, parsed.data.args, session.userId);
      const result = await domain.runCommand(commandName, parsed.data.args, session.userId);
      const entity = auditEntity(commandName, result, parsed.data.args);
      await authStore.recordAudit({
        actorUserId: session.userId,
        action: commandName,
        entityType: entity.entityType,
        entityId: entity.entityId,
        payload: { argCount: parsed.data.args.length },
      });

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
    if (!requireCsrf(request, reply)) return reply;
    const session = await authStore.getSession(request.cookies.emandar_session);
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
    if (!hasMagicHeader(buffer, parsed.data.contentType)) {
      return reply.status(415).send({ error: "invalid-image-content" });
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
    const dimensions = readImageDimensions(buffer, parsed.data.contentType);
    await authStore.createUpload({
      id,
      ownerUserId: session.userId,
      purpose: parsed.data.purpose,
      originalFilename: parsed.data.filename,
      contentType: parsed.data.contentType,
      byteSize: buffer.byteLength,
      storagePath,
      publicUrl,
      ...dimensions,
    });
    await authStore.recordAudit({
      actorUserId: session.userId,
      action: "upload.create",
      entityType: "upload",
      entityId: id,
      payload: {
        purpose: parsed.data.purpose,
        contentType: parsed.data.contentType,
        byteSize: buffer.byteLength,
      },
    });

    return {
      id,
      url: publicUrl,
      width: dimensions.width,
      height: dimensions.height,
    };
  });

  registerAll(app, "post", config, "/api/auth/logout", async (request, reply) => {
    if (!requireCsrf(request, reply)) return reply;
    await authStore.deleteSession(request.cookies.emandar_session);
    reply.clearCookie("emandar_session", getSessionCookieOptions(config));
    return {
      ok: true,
    };
  });

  app.addHook("onClose", async () => {
    await options.store.close();
    await authStore.close();
  });

  return app;
}
