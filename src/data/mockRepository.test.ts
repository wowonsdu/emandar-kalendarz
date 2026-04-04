import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppUser, DemoStore, TrainingEvent } from "@/domain/types";
import { resolveMockApiUrls } from "./mockRepository";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function createActor(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-admin",
    role: "admin",
    roles: ["admin"],
    primaryRole: "admin",
    displayName: "Admin",
    email: "admin@emandar.test",
    phone: "+48 600 100 100",
    status: "active",
    ...overrides,
  };
}

function createEvent(overrides: Partial<TrainingEvent> = {}): TrainingEvent {
  return {
    id: "event-community",
    title: "Meditacja Online",
    summary: "Opis skrócony",
    description: "Opis pełny",
    type: "Wydarzenie społeczności",
    eventTypeSystem: "post",
    startsAt: "2026-04-24T13:00:00.000Z",
    endsAt: "2026-04-24T13:20:00.000Z",
    location: "Online, Zoom",
    tags: [],
    capacity: 20,
    enrolledCount: 0,
    isPublished: false,
    brandStatus: "supported",
    status: "active",
    workflowStatus: "published",
    minimumParticipants: 10,
    requiresOrganizerApproval: false,
    confirmationLeadTimeDays: 1,
    trainerCollaborationStatus: "accepted",
    organizerCollaborationStatus: "accepted",
    createdByRole: "participant",
    creatorUserId: "user-admin",
    creatorDisplayName: "Grzegorz Emanowicz",
    publicationApprovalStatus: "accepted",
    scheduleDays: [
      {
        startsAt: "2026-04-24T13:00:00.000Z",
        endsAt: "2026-04-24T13:20:00.000Z",
      },
    ],
    ...overrides,
  };
}

function createStore(eventOverrides: Partial<TrainingEvent> = {}): DemoStore {
  return {
    users: [createActor()],
    trainers: [],
    organizers: [],
    participantProfiles: [],
    groups: [],
    groupMembers: [],
    eventParticipants: [],
    relations: [],
    trainingEvents: [createEvent(eventOverrides)],
    publicTrainingEvents: [],
    availabilitySlots: [],
    trainerSharedSlots: [],
    trainerCalendarFeeds: [],
    organizerCalendarFeeds: [],
    organizerExternalBusyMonths: [],
    trainerOrganizerCalendarFeeds: [],
    trainerExternalBusyMonths: [],
    enrollmentRequests: [],
    notifications: [],
    accountRequests: [],
    trainerAccountApprovals: [],
    appSettings: {
      signupPhotoMode: "optional",
      enrollmentPhotoMode: "optional",
      defaultNotificationSettings: {
        reminderLeadDays: 7,
        sendToTrainer: true,
        sendToOrganizer: true,
        sendToParticipants: true,
        requireParticipantSmsConfirmation: false,
        reminderSmsTemplate: "",
        confirmationSmsTemplate: "",
      },
    },
  };
}

function mockStoreFetch(initialStore: DemoStore) {
  let currentStore = structuredClone(initialStore);

  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/mock/store") && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify({ store: currentStore, version: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/mock/save") && init?.method === "POST") {
      const parsed = JSON.parse(String(init.body)) as { store: DemoStore };
      currentStore = structuredClone(parsed.store);

      return new Response(JSON.stringify({ store: currentStore, version: 2 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "not-found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    fetchMock,
    getStore: () => structuredClone(currentStore),
  };
}

describe("resolveMockApiUrls", () => {
  it("prefers the emandar base path when dev routing is nested under /emandar", () => {
    const urls = resolveMockApiUrls("save.php", {
      baseUrl: "/",
      pathname: "/emandar/panel/wydarzenia-spolecznosci/event-anita-community-sierpien",
    });

    expect(urls[0]).toBe("/emandar/api/mock/save.php");
    expect(urls).toContain("/api/mock/save.php");
    expect(urls).toContain("/emandar/api/mock/save");
  });

  it("adds php and non-php variants without duplicates", () => {
    const urls = resolveMockApiUrls("store", {
      baseUrl: "/emandar/",
      pathname: "/emandar/panel/moderacja-wydarzen-spolecznosci",
    });

    expect(urls[0]).toBe("/emandar/api/mock/store");
    expect(urls).toContain("/emandar/api/mock/store.php");
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("publishTrainingEvent", () => {
  it("publishes an approved community event without runtime reference errors", async () => {
    const { publishTrainingEvent } = await import("./mockRepository");
    const actor = createActor();
    const mockedApi = mockStoreFetch(createStore());

    await expect(publishTrainingEvent("event-community", actor)).resolves.toBeUndefined();

    expect(mockedApi.fetchMock).toHaveBeenCalled();
    expect(mockedApi.getStore().trainingEvents[0]?.isPublished).toBe(true);
  });

  it("rejects archived events with a business error", async () => {
    const { publishTrainingEvent } = await import("./mockRepository");
    const actor = createActor();
    mockStoreFetch(
      createStore({
        id: "event-archived",
        archivedAt: "2026-04-23T12:00:00.000Z",
      }),
    );

    await expect(publishTrainingEvent("event-archived", actor)).rejects.toThrow(
      "Nie możesz opublikować zarchiwizowanego wydarzenia.",
    );
  });

  it("keeps moderation guard for community events awaiting approval", async () => {
    const { publishTrainingEvent } = await import("./mockRepository");
    const actor = createActor();
    mockStoreFetch(
      createStore({
        id: "event-pending-review",
        publicationApprovalStatus: "pending",
      }),
    );

    await expect(publishTrainingEvent("event-pending-review", actor)).rejects.toThrow(
      "To wydarzenie nie ma jeszcze akceptacji moderacji.",
    );
  });
});
