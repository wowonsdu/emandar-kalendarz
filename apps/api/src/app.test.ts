import { buildApp } from "./app.js";
import { MemoryStoreRepository } from "./store/memory-store.js";
import { readSeedStore } from "./store/seed.js";
import { describe, expect, it } from "vitest";

const config = {
  basePath: "/emandar",
  demoSmsCode: "123456",
  host: "127.0.0.1",
  port: 0,
  publicAppUrl: "https://panel.ceo/emandar",
  seedStorePath: "../../apps/web/public/mock-data/seed-store.json",
  sessionSecret: "test-secret",
  useMemoryStore: true,
};

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

  it("confirms demo SMS code and creates an HTTP-only session cookie", async () => {
    const seed = await readSeedStore(config.seedStorePath);
    const app = await buildApp({
      config,
      store: new MemoryStoreRepository(seed),
    });
    const phone = ((seed.users as { phone: string }[])[0]).phone;

    const request = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/request",
      payload: { phone },
    });
    expect(request.statusCode).toBe(200);
    expect(request.json().code).toBe("123456");

    const confirm = await app.inject({
      method: "POST",
      url: "/emandar/api/auth/sms/confirm",
      payload: { phone, code: "123456" },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().status).toBe("existing-account");
    expect(confirm.headers["set-cookie"]).toContain("emandar_session=");
    await app.close();
  });
});
