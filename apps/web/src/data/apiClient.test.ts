import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppUser, DemoStore } from "@/domain/types";

function createSessionStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function createUser(): AppUser {
  return {
    id: "user-new",
    role: "participant",
    roles: ["participant"],
    primaryRole: "participant",
    displayName: "Nowa Osoba",
    phone: "+48500100200",
    status: "active",
    participantOnboardingCompletedAt: "2026-04-28T00:00:00.000Z",
  };
}

function createPrivateStore(user: AppUser): DemoStore {
  return {
    users: [user],
    trainers: [],
    organizers: [],
    participantProfiles: [],
    groups: [],
    groupMembers: [],
    eventParticipants: [],
    relations: [],
    trainingEvents: [],
    publicTrainingEvents: [],
    enrollmentRequests: [],
    notifications: [],
    appSettings: {
      signupPhotoMode: "optional",
      enrollmentPhotoMode: "optional",
    },
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("apiClient registration uploads", () => {
  it("creates the account before uploading the avatar so the upload has a session", async () => {
    const user = createUser();
    const calls: string[] = [];
    const postCalls: string[] = [];
    const sessionStorage = createSessionStorage();
    sessionStorage.setItem(
      "emandar:verified-phone-preauth",
      JSON.stringify({
        phone: "+48500100200",
        registrationToken: "registration-token",
        verifiedAt: "2026-04-28T00:00:00.000Z",
      }),
    );

    vi.stubGlobal("window", {
      location: { pathname: "/emandar/rejestracja" },
      sessionStorage,
      setInterval: vi.fn(),
      clearInterval: vi.fn(),
    });
    vi.stubGlobal(
      "FileReader",
      class {
        result = "data:image/png;base64,YXZhdGFy";
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        readAsDataURL() {
          this.onload?.();
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const target = String(url);
        calls.push(target);
        if (init?.method === "POST") {
          postCalls.push(target);
        }
        if (target.endsWith("/api/auth/csrf")) {
          return jsonResponse({ token: "csrf-token" });
        }
        if (target.endsWith("/api/auth/register-participant")) {
          expect(init?.headers).toMatchObject({ "x-emandar-csrf": "csrf-token" });
          return jsonResponse({ ok: true, result: { ok: true, userId: user.id, accountCreated: true } });
        }
        if (target.endsWith("/api/uploads")) {
          return jsonResponse({
            id: "upload-avatar",
            url: "/emandar/uploads/upload-avatar.png",
            storagePath: "/tmp/upload-avatar.png",
            width: 0,
            height: 0,
          });
        }
        if (target.endsWith("/api/panel/command/updateParticipantProfile")) {
          return jsonResponse({ ok: true, result: { ok: true } });
        }
        if (target.endsWith("/api/public/bootstrap")) {
          return jsonResponse({ trainers: [], publicTrainingEvents: [], appSettings: {} });
        }
        if (target.endsWith("/api/auth/session")) {
          return jsonResponse({ userId: user.id });
        }
        if (target.endsWith("/api/me")) {
          return jsonResponse({ user });
        }
        if (target.endsWith("/api/panel/bootstrap")) {
          return jsonResponse(createPrivateStore(user));
        }
        return new Response("Not found", { status: 404 });
      }),
    );

    const { registerParticipant } = await import("./apiClient");

    await registerParticipant({
      displayName: "Nowa Osoba",
      phone: "+48500100200",
      notes: "Opis",
      avatarFile: { name: "avatar.png", type: "image/png" } as File,
      trainingDataConsentAccepted: true,
    });

    expect(postCalls[0]).toBe("/emandar/api/auth/register-participant");
    expect(postCalls[1]).toBe("/emandar/api/uploads");
    expect(postCalls[2]).toBe("/emandar/api/panel/command/updateParticipantProfile");
    expect(calls).toContain("/emandar/api/me");
  });

  it("refreshes the new session and retries avatar upload when the first upload is unauthorized", async () => {
    const user = createUser();
    const postCalls: string[] = [];
    let uploadAttempt = 0;
    const sessionStorage = createSessionStorage();
    sessionStorage.setItem(
      "emandar:verified-phone-preauth",
      JSON.stringify({
        phone: "+48500100201",
        registrationToken: "registration-token",
        verifiedAt: "2026-04-28T00:00:00.000Z",
      }),
    );

    vi.stubGlobal("window", {
      location: { pathname: "/emandar/rejestracja" },
      sessionStorage,
      setInterval: vi.fn(),
      clearInterval: vi.fn(),
    });
    vi.stubGlobal(
      "FileReader",
      class {
        result = "data:image/png;base64,YXZhdGFy";
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        readAsDataURL() {
          this.onload?.();
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const target = String(url);
        if (init?.method === "POST") {
          postCalls.push(target);
        }
        if (target.endsWith("/api/auth/csrf")) {
          return jsonResponse({ token: "csrf-token" });
        }
        if (target.endsWith("/api/auth/register-participant")) {
          return jsonResponse({ ok: true, result: { ok: true, userId: user.id, accountCreated: true } });
        }
        if (target.endsWith("/api/uploads")) {
          uploadAttempt += 1;
          if (uploadAttempt === 1) {
            return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
          }
          return jsonResponse({
            id: "upload-avatar",
            url: "/emandar/uploads/upload-avatar.png",
            storagePath: "/tmp/upload-avatar.png",
            width: 0,
            height: 0,
          });
        }
        if (target.endsWith("/api/panel/command/updateParticipantProfile")) {
          return jsonResponse({ ok: true, result: { ok: true } });
        }
        if (target.endsWith("/api/public/bootstrap")) {
          return jsonResponse({ trainers: [], publicTrainingEvents: [], appSettings: {} });
        }
        if (target.endsWith("/api/auth/session")) {
          return jsonResponse({ userId: user.id });
        }
        if (target.endsWith("/api/me")) {
          return jsonResponse({ user });
        }
        if (target.endsWith("/api/panel/bootstrap")) {
          return jsonResponse(createPrivateStore(user));
        }
        return new Response("Not found", { status: 404 });
      }),
    );

    const { registerParticipant } = await import("./apiClient");

    await registerParticipant({
      displayName: "Nowa Osoba",
      phone: "+48500100201",
      notes: "Opis",
      avatarFile: { name: "avatar.png", type: "image/png" } as File,
      trainingDataConsentAccepted: true,
    });

    expect(uploadAttempt).toBe(2);
    expect(postCalls).toEqual([
      "/emandar/api/auth/register-participant",
      "/emandar/api/uploads",
      "/emandar/api/uploads",
      "/emandar/api/panel/command/updateParticipantProfile",
    ]);
  });
});
