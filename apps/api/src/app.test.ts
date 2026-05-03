import { buildApp } from "./app.js";
import { InMemoryAuthStore } from "./store/session.js";
import { MemoryStoreRepository } from "./store/memory-store.js";
import { readProductionSeedStore, readSeedStore } from "./store/seed.js";
import { describe, expect, it } from "vitest";

const config = {
  allowLegacyStoreApi: true,
  basePath: "/emandar",
  corsAllowedOrigins: ["https://panel.ceo"],
  host: "127.0.0.1",
  port: 0,
  publicAppUrl: "https://panel.ceo/emandar",
  seedStorePath: "../../seed-data/seed-store.json",
  sessionSecret: "test-secret",
  sessionTtlSeconds: 60 * 60,
  smsapiTestMode: true,
  smsCodeTtlSeconds: 300,
  storagePublicPath: "/emandar/uploads",
  uploadStoragePath: "/tmp/emandar-test-uploads",
  useMemoryStore: true,
};

async function csrf(app: Awaited<ReturnType<typeof buildApp>>) {
  const response = await app.inject("/emandar/api/auth/csrf");
  return {
    token: response.json().token as string,
    cookie: cookiePair(response.headers["set-cookie"]),
  };
}

function cookiePair(value: unknown) {
  const firstValue = Array.isArray(value) ? value[0] : String(value ?? "");
  return firstValue.split(";")[0] ?? "";
}

function mergeCookies(...cookies: string[]) {
  return cookies.filter(Boolean).join("; ");
}

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function testStoreForPermissions(role: string, roles = [role]) {
  return {
    users: [
      {
        id: "user-admin",
        role: "admin",
        roles: ["admin"],
        displayName: "Admin",
        phone: "+48 600 000 001",
        status: "active",
      },
      {
        id: "user-actor",
        role,
        roles,
        displayName: role,
        phone: `+48 600 000 00${roles.includes("moderator") ? "2" : "3"}`,
        status: "active",
      },
      {
        id: "user-target",
        role: "participant",
        roles: ["participant"],
        displayName: "Target",
        phone: "+48 600 000 004",
        status: "active",
      },
    ],
    trainers: [],
    organizers: [],
    participantProfiles: [
      {
        id: "participant-target",
        linkedUserId: "user-target",
        displayName: "Target",
        phone: "+48 600 000 004",
        confirmationStatus: "confirmed",
      },
    ],
    groups: [],
    groupMembers: [],
    eventParticipants: [
      {
        id: "event-participant-target",
        eventId: "event-official",
        participantProfileId: "participant-target",
        participantUserId: "user-target",
        participantDisplayName: "Target",
        participantPhone: "+48 600 000 004",
        status: "confirmed",
        attendanceConfirmationStatus: "pending",
      },
    ],
    relations: [],
    trainingEvents: [
      {
        id: "event-official",
        title: "Official",
        brandStatus: "official",
        status: "active",
        isPublished: true,
        creatorUserId: "user-owner",
        organizerUserId: "user-owner",
        trainerUserId: "user-owner",
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T12:00:00.000Z",
      },
      {
        id: "event-community",
        title: "Community",
        brandStatus: "supported",
        status: "active",
        isPublished: false,
        publicationApprovalStatus: "pending",
        creatorUserId: "user-target",
        creatorDisplayName: "Target",
        creatorPhone: "+48 600 000 004",
        startsAt: "2026-06-02T10:00:00.000Z",
        endsAt: "2026-06-02T12:00:00.000Z",
      },
    ],
    publicTrainingEvents: [],
    enrollmentRequests: [],
    notifications: [],
    appSettings: {},
  };
}

async function loginWithSms(
  app: Awaited<ReturnType<typeof buildApp>>,
  phone: string,
  csrfToken: Awaited<ReturnType<typeof csrf>>,
) {
  const request = await app.inject({
    method: "POST",
    url: "/emandar/api/auth/sms/request",
    headers: {
      cookie: csrfToken.cookie,
      "x-emandar-csrf": csrfToken.token,
    },
    payload: { phone },
  });
  const confirm = await app.inject({
    method: "POST",
    url: "/emandar/api/auth/sms/confirm",
    headers: {
      cookie: csrfToken.cookie,
      "x-emandar-csrf": csrfToken.token,
    },
    payload: { phone, code: request.json().code },
  });
  return cookiePair(confirm.headers["set-cookie"]);
}

describe("emandar api", () => {
  it("serves health under the production subpath", async () => {
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(),
    });

    const response = await app.inject("/emandar/api/health");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: "emandar-api" });
    await app.close();
  });

  it("serves the seeded store and accepts optimistic patches", async () => {
    const seed = await readSeedStore(config.seedStorePath);
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(seed),
    });

    const snapshot = await app.inject("/emandar/api/mock/state");
    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.json().store.users.length).toBe(seed.users.length);

    const patch = await app.inject({
      method: "POST",
      url: "/emandar/api/mock/patch",
      payload: {
        baseVersion: snapshot.json().version,
        collections: {
          notifications: [],
        },
      },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().writtenCollections).toEqual(["notifications"]);
    await app.close();
  });

  it("does not expose legacy bootstrap or command endpoints when the legacy flag is off", async () => {
    const app = await buildApp({
      config: {
        ...config,
        allowLegacyStoreApi: false,
      },
      store: new MemoryStoreRepository(testStoreForPermissions("admin", ["admin"])),
    });

    const publicBootstrap = await app.inject("/emandar/api/public/bootstrap");
    expect(publicBootstrap.statusCode).toBe(404);

    const panelBootstrap = await app.inject("/emandar/api/panel/bootstrap");
    expect(panelBootstrap.statusCode).toBe(404);

    const csrfToken = await csrf(app);
    const command = await app.inject({
      method: "POST",
      url: "/emandar/api/panel/command/updateParticipantProfile",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: { args: [{}] },
    });
    expect(command.statusCode).toBe(404);
    await app.close();
  });

  it("allows participant accounts to create community events but not official trainings", async () => {
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(testStoreForPermissions("participant")),
    });
    const csrfToken = await csrf(app);
    const participantSession = await loginWithSms(app, "+48 600 000 003", csrfToken);

    const official = await app.inject({
      method: "POST",
      url: "/emandar/api/panel/events",
      headers: {
        cookie: mergeCookies(participantSession, csrfToken.cookie),
        "x-emandar-csrf": csrfToken.token,
      },
      payload: {
        title: "Participant official",
        type: "Szkolenie Emandar",
        brandStatus: "official",
        scheduleDays: [{ startsAt: "2026-07-01T10:00:00.000Z", endsAt: "2026-07-01T12:00:00.000Z" }],
      },
    });
    expect(official.statusCode).toBe(400);

    const community = await app.inject({
      method: "POST",
      url: "/emandar/api/panel/events",
      headers: {
        cookie: mergeCookies(participantSession, csrfToken.cookie),
        "x-emandar-csrf": csrfToken.token,
      },
      payload: {
        title: "Participant community",
        type: "Wydarzenie społeczności",
        brandStatus: "supported",
        isPublished: false,
        scheduleDays: [{ startsAt: "2026-07-02T10:00:00.000Z", endsAt: "2026-07-02T12:00:00.000Z" }],
      },
    });
    expect(community.statusCode).toBe(200);

    const snapshot = await app.inject("/emandar/api/mock/state");
    const event = snapshot.json().store.trainingEvents.find((item: { title?: string }) => item.title === "Participant community");
    expect(event.creatorUserId).toBe("user-actor");
    expect(event.brandStatus).toBe("supported");
    await app.close();
  });

  it("confirms SMS code and creates an HTTP-only session cookie", async () => {
    const seed = await readSeedStore(config.seedStorePath);
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(seed),
    });
    const phone = ((seed.users as { phone: string }[])[0]).phone;
    const csrfToken = await csrf(app);

    const request = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/request",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: { phone },
    });
    expect(request.statusCode).toBe(200);
    expect(request.json().code).toMatch(/^\d{6}$/);

    const confirm = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/confirm",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: { phone, code: request.json().code },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().status).toBe("existing-account");
    expect(confirm.headers["set-cookie"]).toContain("emandar_session=");
    await app.close();
  });

  it("does not expose SMS code when SMSAPI test mode is disabled", async () => {
    const app = await buildApp({
      config: {
        ...config,
        smsapiTestMode: false,
      },
      store: new MemoryStoreRepository(),
    });
    const csrfToken = await csrf(app);

    const request = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/request",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: { phone: "+48 600 700 800" },
    });
    expect(request.statusCode).toBe(200);
    expect(request.json()).toEqual({ normalizedPhone: "+48 600 700 800" });
    await app.close();
  });

  it("rate limits SMS requests by phone and limits wrong code attempts", async () => {
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(),
      authStore,
    });
    const csrfToken = await csrf(app);
    const phone = "+48 600 700 801";

    for (let index = 0; index < 5; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/emandar/api/auth/sms/request",
        headers: {
          cookie: csrfToken.cookie,
          "x-emandar-csrf": csrfToken.token,
          "x-forwarded-for": `10.0.0.${index}`,
        },
        payload: { phone },
      });
      expect(response.statusCode).toBe(200);
    }

    const limited = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/request",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
        "x-forwarded-for": "10.0.0.99",
      },
      payload: { phone },
    });
    expect(limited.statusCode).toBe(429);

    const attemptsPhone = "+48 600 700 802";
    await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/request",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
        "x-forwarded-for": "10.0.1.1",
      },
      payload: { phone: attemptsPhone },
    });

    for (let index = 0; index < 4; index += 1) {
      const wrong = await app.inject({
        method: "POST",
        url: "/emandar/api/auth/sms/confirm",
        headers: {
          cookie: csrfToken.cookie,
          "x-emandar-csrf": csrfToken.token,
        },
        payload: { phone: attemptsPhone, code: "000000" },
      });
      expect(wrong.statusCode).toBe(401);
    }

    const tooMany = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/confirm",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: { phone: attemptsPhone, code: "000000" },
    });
    expect(tooMany.statusCode).toBe(429);
    expect(authStore.auditLog.some((item) => item.action === "sms.request.rate-limited")).toBe(true);
    expect(authStore.auditLog.some((item) => item.action === "sms.confirm.too-many-attempts")).toBe(true);
    await app.close();
  });

  it("rejects cookie-based mutations without CSRF", async () => {
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(),
    });

    const request = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/request",
      payload: { phone: "+48 600 700 800" },
    });

    expect(request.statusCode).toBe(403);
    expect(request.json()).toEqual({ error: "csrf-required" });
    await app.close();
  });

  it("persists auth sessions through the injected auth store and deletes them on logout", async () => {
    const seed = await readSeedStore(config.seedStorePath);
    const store = new MemoryStoreRepository(seed);
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({ config, store, authStore });
    const phone = ((seed.users as { phone: string }[])[0]).phone;
    const csrfToken = await csrf(app);
    const sessionCookie = await loginWithSms(app, phone, csrfToken);
    await app.close();

    const restarted = await buildApp({ config, store, authStore });
    const session = await restarted.inject({
      url: "/emandar/api/auth/session",
      headers: { cookie: sessionCookie },
    });
    expect(session.json().userId).toBe((seed.users as { id: string }[])[0].id);

    const logout = await restarted.inject({
      method: "POST",
      url: "/emandar/api/auth/logout",
      headers: {
        cookie: mergeCookies(sessionCookie, csrfToken.cookie),
        "x-emandar-csrf": csrfToken.token,
      },
      payload: {},
    });
    expect(logout.statusCode).toBe(200);
    const afterLogout = await restarted.inject({
      url: "/emandar/api/auth/session",
      headers: { cookie: sessionCookie },
    });
    expect(afterLogout.json().userId).toBeNull();
    await restarted.close();
  });

  it("requires a server-side registration token and binds it to the confirmed phone", async () => {
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(),
      authStore,
    });
    const csrfToken = await csrf(app);
    const phone = "+48 501 222 333";
    const request = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/request",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: { phone },
    });
    const confirm = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/confirm",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: { phone, code: request.json().code },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().registrationToken).toMatch(/^[a-f0-9]{64}$/);

    const wrongPhone = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/register-participant",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: {
        registrationToken: confirm.json().registrationToken,
        input: {
          phone: "+48 501 222 334",
          displayName: "Nowa Osoba",
          trainingDataConsentAccepted: true,
        },
      },
    });
    expect(wrongPhone.statusCode).toBe(403);

    const validToken = await authStore.createRegistrationToken(phone, 300);
    const registered = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/register-participant",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: {
        registrationToken: validToken,
        input: {
          phone,
          displayName: "Nowa Osoba",
          trainingDataConsentAccepted: true,
        },
      },
    });
    expect(registered.statusCode).toBe(200);
    expect(registered.headers["set-cookie"]).toContain("emandar_session=");
    expect(authStore.auditLog.some((item) => item.action === "registerParticipant")).toBe(true);
    await app.close();
  });

  it("records demo SMS deliveries", async () => {
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(),
      authStore,
    });
    const csrfToken = await csrf(app);

    await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/request",
      headers: {
        cookie: csrfToken.cookie,
        "x-emandar-csrf": csrfToken.token,
      },
      payload: { phone: "+48 600 700 800" },
    });

    expect(authStore.notificationDeliveries).toMatchObject([
      {
        channel: "sms",
        recipient: "+48 600 700 800",
        provider: "test",
        status: "sent",
      },
    ]);
    await app.close();
  });

  it("hardens uploads with magic-header validation, DB metadata, audit log, and owner checks", async () => {
    const seed = await readSeedStore(config.seedStorePath);
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(seed),
      authStore,
    });
    const users = seed.users as { id: string; phone: string }[];
    const firstCsrf = await csrf(app);
    const firstSession = await loginWithSms(app, users[0].phone, firstCsrf);

    const invalidUpload = await app.inject({
      method: "POST",
      url: "/emandar/api/uploads",
      headers: {
        cookie: mergeCookies(firstSession, firstCsrf.cookie),
        "x-emandar-csrf": firstCsrf.token,
      },
      payload: {
        filename: "avatar.png",
        contentType: "image/png",
        dataBase64: Buffer.from("not-a-png").toString("base64"),
        purpose: "avatar",
      },
    });
    expect(invalidUpload.statusCode).toBe(415);

    const uploaded = await app.inject({
      method: "POST",
      url: "/emandar/api/uploads",
      headers: {
        cookie: mergeCookies(firstSession, firstCsrf.cookie),
        "x-emandar-csrf": firstCsrf.token,
      },
      payload: {
        filename: "avatar.png",
        contentType: "image/png",
        dataBase64: tinyPngBase64,
        purpose: "avatar",
      },
    });
    expect(uploaded.statusCode).toBe(200);
    expect(uploaded.json()).not.toHaveProperty("storagePath");
    expect(await authStore.getUploadByIdOrUrl(uploaded.json().id)).toMatchObject({
      ownerUserId: users[0].id,
      purpose: "avatar",
      publicUrl: uploaded.json().url,
    });
    expect(authStore.auditLog.some((item) => item.action === "upload.create")).toBe(true);

    const secondCsrf = await csrf(app);
    const secondSession = await loginWithSms(app, users[1].phone, secondCsrf);
    const useForeignUpload = await app.inject({
      method: "POST",
      url: "/emandar/api/panel/command/updateParticipantProfile",
      headers: {
        cookie: mergeCookies(secondSession, secondCsrf.cookie),
        "x-emandar-csrf": secondCsrf.token,
      },
      payload: {
        args: [{ avatarUrl: uploaded.json().url }],
      },
    });
    expect(useForeignUpload.statusCode).toBe(400);
    expect(useForeignUpload.json().message).toContain("nie należy");
    await app.close();
  });

  it("gates legacy store endpoints when disabled", async () => {
    const app = await buildApp({
      config: {
        ...config,
        allowLegacyStoreApi: false,
      },
      store: new MemoryStoreRepository(),
    });

    const response = await app.inject("/emandar/api/mock/state");
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("paginates public and panel event read models with a capped page size", async () => {
    const trainingEvents = Array.from({ length: 130 }, (_, index) => ({
      id: `event-${index + 1}`,
      title: `Event ${index + 1}`,
      brandStatus: index % 2 === 0 ? "official" : "supported",
      status: "active",
      isPublished: true,
      startsAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      endsAt: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    }));
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository({
        ...testStoreForPermissions("admin", ["admin"]),
        trainingEvents,
        publicTrainingEvents: trainingEvents,
      }),
      authStore,
    });

    const publicPage = await app.inject("/emandar/api/public/events");
    expect(publicPage.statusCode).toBe(200);
    expect(publicPage.json()).toMatchObject({
      page: 1,
      pageSize: 25,
      totalItems: 65,
      totalPages: 3,
    });
    expect(publicPage.json().items).toHaveLength(25);

    const capped = await app.inject("/emandar/api/public/community-events?pageSize=500");
    expect(capped.json()).toMatchObject({
      pageSize: 100,
      totalItems: 65,
      totalPages: 1,
    });

    const csrfToken = await csrf(app);
    const adminSession = await loginWithSms(app, "+48 600 000 001", csrfToken);
    const panelPage = await app.inject({
      url: "/emandar/api/panel/read-models/events-page?kind=community&page=2&pageSize=10",
      headers: {
        cookie: mergeCookies(adminSession, csrfToken.cookie),
      },
    });
    expect(panelPage.statusCode).toBe(200);
    expect(panelPage.json()).toMatchObject({
      page: 2,
      pageSize: 10,
      totalItems: 65,
      totalPages: 7,
    });
    expect(panelPage.json().items).toHaveLength(10);
    await app.close();
  });

  it("filters public event pages before pagination and returns full-collection facets", async () => {
    const trainingEvents = [
      {
        id: "official-multiday",
        title: "Official Multiday",
        brandStatus: "official",
        status: "active",
        isPublished: true,
        trainerId: "trainer-1",
        tags: ["NOWE OSOBY", "Weekend"],
        startsAt: "2026-07-10T08:00:00.000Z",
        endsAt: "2026-07-11T10:00:00.000Z",
        scheduleDays: [
          { startsAt: "2026-07-10T08:00:00.000Z", endsAt: "2026-07-10T10:00:00.000Z" },
          { startsAt: "2026-07-11T08:00:00.000Z", endsAt: "2026-07-11T10:00:00.000Z" },
        ],
      },
      {
        id: "official-load",
        title: "Official Load",
        brandStatus: "official",
        status: "active",
        isPublished: true,
        trainerId: "trainer-2",
        tags: ["LOAD-TEST"],
        startsAt: "2026-07-20T08:00:00.000Z",
        endsAt: "2026-07-20T10:00:00.000Z",
      },
      {
        id: "official-new-trainer-2",
        title: "Official New Trainer 2",
        brandStatus: "official",
        status: "active",
        isPublished: true,
        trainerId: "trainer-2",
        tags: ["nowe osoby"],
        startsAt: "2026-08-01T08:00:00.000Z",
        endsAt: "2026-08-01T10:00:00.000Z",
      },
      {
        id: "community-trainer-1",
        title: "Community Trainer 1",
        brandStatus: "supported",
        status: "active",
        isPublished: true,
        trainerId: "trainer-1",
        tags: ["Krąg"],
        startsAt: "2026-07-15T08:00:00.000Z",
        endsAt: "2026-07-15T10:00:00.000Z",
      },
      {
        id: "community-trainer-3",
        title: "Community Trainer 3",
        brandStatus: "supported",
        status: "active",
        isPublished: true,
        trainerId: "trainer-3",
        tags: ["LOAD-TEST"],
        startsAt: "2026-07-16T08:00:00.000Z",
        endsAt: "2026-07-16T10:00:00.000Z",
      },
    ];
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository({
        ...testStoreForPermissions("admin", ["admin"]),
        trainers: [
          { id: "trainer-1", displayName: "Anna", isVisible: true },
          { id: "trainer-2", displayName: "Beata", isVisible: true },
          { id: "trainer-3", displayName: "Celina", isVisible: true },
        ],
        trainingEvents,
        publicTrainingEvents: trainingEvents,
      }),
    });

    const tagPage = await app.inject("/emandar/api/public/events?tag=nowe%20osoby&pageSize=1");
    expect(tagPage.statusCode).toBe(200);
    expect(tagPage.json()).toMatchObject({
      page: 1,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
    });
    expect(tagPage.json().items).toHaveLength(1);
    expect(tagPage.json().filters.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "NOWE OSOBY", label: "NOWE OSOBY", count: 2 }),
        expect.objectContaining({ value: "LOAD-TEST", label: "LOAD-TEST", count: 1 }),
      ]),
    );

    const combined = await app.inject("/emandar/api/public/events?tag=NOWE%20OSOBY&trainerId=trainer-2");
    expect(combined.json().totalItems).toBe(1);
    expect(combined.json().items[0].id).toBe("official-new-trainer-2");

    const dateOverlap = await app.inject("/emandar/api/public/events?dateFrom=2026-07-11&dateTo=2026-07-11");
    expect(dateOverlap.json().items.map((item: { id: string }) => item.id)).toContain("official-multiday");

    const community = await app.inject("/emandar/api/public/community-events?trainerId=trainer-3");
    expect(community.json().totalItems).toBe(1);
    expect(community.json().items[0].id).toBe("community-trainer-3");

    const invalidDate = await app.inject("/emandar/api/public/events?dateFrom=2026-02-31");
    expect(invalidDate.statusCode).toBe(400);
    expect(invalidDate.json()).toEqual({ error: "invalid-query" });

    const invalidRange = await app.inject("/emandar/api/public/community-events?dateFrom=2026-08-01&dateTo=2026-07-01");
    expect(invalidRange.statusCode).toBe(400);
    expect(invalidRange.json()).toEqual({ error: "invalid-query" });

    await app.close();
  });

  it("requires valid one-use signed tokens for public attendance links", async () => {
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(testStoreForPermissions("participant")),
      authStore,
    });
    const token = await authStore.createSignedActionToken({
      action: "attendance.confirm",
      entityType: "event_participant",
      entityId: "event-participant-target",
      ttlSeconds: 300,
    });

    const rawId = await app.inject({
      method: "POST",
      url: "/emandar/api/public/signed-actions/attendance",
      payload: { token: "event-participant-target", decision: "confirm" },
    });
    expect(rawId.statusCode).toBe(400);

    const used = await app.inject({
      method: "POST",
      url: "/emandar/api/public/signed-actions/attendance",
      payload: { token, decision: "confirm" },
    });
    expect(used.statusCode).toBe(200);
    expect(authStore.auditLog.some((item) => item.action === "attendance.confirm")).toBe(true);

    const secondUse = await app.inject({
      method: "POST",
      url: "/emandar/api/public/signed-actions/attendance",
      payload: { token, decision: "confirm" },
    });
    expect(secondUse.statusCode).toBe(403);

    const snapshot = await app.inject({
      url: "/emandar/api/mock/state",
    });
    expect(snapshot.json().store.eventParticipants[0].attendanceConfirmationStatus).toBe("confirmed");
    await app.close();
  });

  it("uses signed tokens for community event review without allowing token replay", async () => {
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(testStoreForPermissions("participant")),
      authStore,
    });
    const token = await authStore.createSignedActionToken({
      action: "community-event.review",
      entityType: "training_event",
      entityId: "event-community",
      ttlSeconds: 300,
    });

    const loaded = await app.inject(`/emandar/api/public/signed-actions/community-event-review/${token}`);
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json().event.id).toBe("event-community");

    const reviewed = await app.inject({
      method: "POST",
      url: "/emandar/api/public/signed-actions/community-event-review",
      payload: { token, decision: "accepted", message: "OK" },
    });
    expect(reviewed.statusCode).toBe(200);
    expect(authStore.auditLog.some((item) => item.action === "community-event.review")).toBe(true);

    const replay = await app.inject({
      method: "POST",
      url: "/emandar/api/public/signed-actions/community-event-review",
      payload: { token, decision: "rejected", message: "Replay" },
    });
    expect(replay.statusCode).toBe(403);
    await app.close();
  });

  it("keeps moderator outside the linear role hierarchy but allows moderation endpoints", async () => {
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(testStoreForPermissions("participant", ["participant", "moderator"])),
      authStore,
    });
    const csrfToken = await csrf(app);
    const moderatorSession = await loginWithSms(app, "+48 600 000 002", csrfToken);

    const cannotCreateGroup = await app.inject({
      method: "POST",
      url: "/emandar/api/panel/command/createGroup",
      headers: {
        cookie: mergeCookies(moderatorSession, csrfToken.cookie),
        "x-emandar-csrf": csrfToken.token,
      },
      payload: { args: [{ trainerId: "trainer-x" }] },
    });
    expect(cannotCreateGroup.statusCode).toBe(400);

    const unpublish = await app.inject({
      method: "POST",
      url: "/emandar/api/panel/events/event-official/unpublish",
      headers: {
        cookie: mergeCookies(moderatorSession, csrfToken.cookie),
        "x-emandar-csrf": csrfToken.token,
      },
      payload: {},
    });
    expect(unpublish.statusCode).toBe(200);
    expect(authStore.auditLog.some((item) => item.action === "unpublishTrainingEvent")).toBe(true);
    await app.close();
  });

  it("limits role, block, and settings endpoints to admins", async () => {
    const authStore = new InMemoryAuthStore();
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(testStoreForPermissions("participant")),
      authStore,
    });
    const participantCsrf = await csrf(app);
    const participantSession = await loginWithSms(app, "+48 600 000 003", participantCsrf);
    const forbidden = await app.inject({
      method: "POST",
      url: "/emandar/api/panel/users/user-target/moderator-role",
      headers: {
        cookie: mergeCookies(participantSession, participantCsrf.cookie),
        "x-emandar-csrf": participantCsrf.token,
      },
      payload: { enabled: true },
    });
    expect(forbidden.statusCode).toBe(400);

    const adminCsrf = await csrf(app);
    const adminSession = await loginWithSms(app, "+48 600 000 001", adminCsrf);
    const enabled = await app.inject({
      method: "POST",
      url: "/emandar/api/panel/users/user-target/moderator-role",
      headers: {
        cookie: mergeCookies(adminSession, adminCsrf.cookie),
        "x-emandar-csrf": adminCsrf.token,
      },
      payload: { enabled: true },
    });
    expect(enabled.statusCode).toBe(200);
    const settings = await app.inject({
      method: "POST",
      url: "/emandar/api/panel/settings",
      headers: {
        cookie: mergeCookies(adminSession, adminCsrf.cookie),
        "x-emandar-csrf": adminCsrf.token,
      },
      payload: { input: { signupPhotoMode: "required" } },
    });
    expect(settings.statusCode).toBe(200);
    expect(authStore.auditLog.some((item) => item.action === "updateAppSettings")).toBe(true);
    await app.close();
  });

  it("builds a production seed with only admin and trainer profiles", async () => {
    const seed = await readProductionSeedStore(config.seedStorePath);
    expect(seed.trainers).toHaveLength(8);
    expect(seed.organizers).toEqual([]);
    expect(seed.groups).toEqual([]);
    expect(seed.trainingEvents).toEqual([]);
    expect(seed.enrollmentRequests).toEqual([]);
    expect((seed.users as { role: string }[]).every((user) => user.role === "admin" || user.role === "trainer")).toBe(true);
  });
});
