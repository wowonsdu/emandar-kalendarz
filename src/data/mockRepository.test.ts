import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppUser, DemoStore, TrainingEvent } from "@/domain/types";
import { resolveMockApiUrls } from "./mockRepository";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

function createStore(
  eventOverrides: Partial<TrainingEvent> = {},
  userOverrides: Partial<AppUser> = {},
): DemoStore {
  return {
    users: [createActor(userOverrides)],
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

function createOrganizerStore(
  actor: AppUser,
  overrides: {
    participantProfiles?: DemoStore["participantProfiles"];
    groupMembers?: DemoStore["groupMembers"];
  } = {},
) {
  const store = createStore({}, actor);
  store.groups = [
    {
      id: "group-1",
      name: "Grupa oddechowa",
      organizerId: "organizer-1",
      organizerUserId: actor.id,
      trainerId: "trainer-1",
      status: "active",
      defaultEventType: "training",
      defaultConfirmationLeadTimeDays: 7,
      createdAt: "2026-04-01T10:00:00.000Z",
    },
  ];
  store.participantProfiles = overrides.participantProfiles ?? [];
  store.groupMembers = overrides.groupMembers ?? [];
  return store;
}

function mockSession(userId: string) {
  const storage = new Map<string, string>();
  storage.set("emandar:mock-auth-session", JSON.stringify({ userId }));

  vi.stubGlobal("window", {
    location: {
      pathname: "/emandar/kalendarz",
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
  });
}

function mockStoreFetch(initialStore: DemoStore) {
  let currentStore = structuredClone(initialStore);
  let currentVersion = 1;
  const patchBodies: Array<{ baseVersion: number; collections: Partial<DemoStore> }> = [];

  let conflictSnapshot:
    | {
        store: DemoStore;
        version: number;
      }
    | null = null;

  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/mock/state") && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify({ store: currentStore, version: currentVersion }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/mock/version") && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify({ version: currentVersion }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/mock/patch") && init?.method === "POST") {
      const parsed = JSON.parse(String(init.body)) as {
        baseVersion: number;
        collections: Partial<DemoStore>;
      };
      patchBodies.push(parsed);

      if (conflictSnapshot) {
        currentStore = structuredClone(conflictSnapshot.store);
        currentVersion = conflictSnapshot.version;
        const payload = {
          error: "version-conflict",
          currentVersion,
        };
        conflictSnapshot = null;

        return new Response(JSON.stringify(payload), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      for (const [collectionKey, value] of Object.entries(parsed.collections)) {
        currentStore = {
          ...currentStore,
          [collectionKey]: structuredClone(value),
        };
      }
      currentVersion += 1;

      return new Response(
        JSON.stringify({
          version: currentVersion,
          writtenCollections: Object.keys(parsed.collections),
        }),
        {
        status: 200,
        headers: { "Content-Type": "application/json" },
        },
      );
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
    getPatchBodies: () => structuredClone(patchBodies),
    queueVersionConflict: (store: DemoStore, version = currentVersion + 1) => {
      conflictSnapshot = {
        store: structuredClone(store),
        version,
      };
    },
  };
}

describe("resolveMockApiUrls", () => {
  it("prefers the emandar base path when dev routing is nested under /emandar", () => {
    const urls = resolveMockApiUrls("patch.php", {
      baseUrl: "/",
      pathname: "/emandar/panel/wydarzenia-spolecznosci/event-anita-community-sierpien",
    });

    expect(urls[0]).toBe("/emandar/api/mock/patch.php");
    expect(urls).toContain("/api/mock/patch.php");
    expect(urls).toContain("/emandar/api/mock/patch");
  });

  it("adds php and non-php variants without duplicates", () => {
    const urls = resolveMockApiUrls("state", {
      baseUrl: "/emandar/",
      pathname: "/emandar/panel/moderacja-wydarzen-spolecznosci",
    });

    expect(urls[0]).toBe("/emandar/api/mock/state");
    expect(urls).toContain("/emandar/api/mock/state.php");
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
    expect(mockedApi.getPatchBodies()[0]?.collections).toHaveProperty("trainingEvents");
    expect(mockedApi.getPatchBodies()[0]?.collections).not.toHaveProperty("publicTrainingEvents");
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

  it("lets an active organizer publish official training without moderation and confirms trainer collaboration", async () => {
    const { publishTrainingEvent } = await import("./mockRepository");
    const actor = createActor({
      id: "user-organizer-1",
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      displayName: "Anita",
      organizerProfileId: "organizer-1",
    });
    const store = createStore(
      {
        id: "event-official-pending",
        brandStatus: "official",
        publicationApprovalStatus: undefined,
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        createdByRole: "organizer",
        creatorUserId: "user-organizer-1",
        trainerCollaborationStatus: "pending",
        organizerCollaborationStatus: "accepted",
      },
      actor,
    );
    store.relations = [
      {
        id: "relation-1",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        trainerUserId: "user-trainer-1",
        organizerUserId: "user-organizer-1",
        status: "approved",
        requestedBy: "organizer",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(publishTrainingEvent("event-official-pending", actor)).resolves.toBeUndefined();

    const publishedEvent = mockedApi.getStore().trainingEvents[0];
    expect(publishedEvent?.isPublished).toBe(true);
    expect(publishedEvent?.trainerCollaborationStatus).toBe("accepted");
  });

  it("refreshes local cache after a version conflict before returning a retry error", async () => {
    const { publishTrainingEvent } = await import("./mockRepository");
    const actor = createActor();
    const mockedApi = mockStoreFetch(createStore());
    mockedApi.queueVersionConflict(
      createStore({
        id: "event-community",
        archivedAt: "2026-04-23T12:00:00.000Z",
      }),
      2,
    );

    await expect(publishTrainingEvent("event-community", actor)).rejects.toThrow(
      "Dane zostały zmienione w innym oknie. Widok został odświeżony, spróbuj ponownie.",
    );

    await expect(publishTrainingEvent("event-community", actor)).rejects.toThrow(
      "Nie możesz opublikować zarchiwizowanego wydarzenia.",
    );
  });
});

describe("addGroupMember", () => {
  it("reuses an existing participant profile found by phone without overwriting referral source", async () => {
    const { addGroupMember } = await import("./mockRepository");
    const actor = createActor({
      id: "user-organizer-1",
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-1",
    });
    const mockedApi = mockStoreFetch(
      createOrganizerStore(actor, {
        participantProfiles: [
          {
            id: "participant-48600111222",
            linkedUserId: null,
            displayName: "Alicja Wrona",
            firstName: "Alicja",
            lastName: "Wrona",
            phone: "+48 600 111 222",
            phoneLookupKey: "48600111222",
            referralSource: "Polecenie od Mai",
            confirmationStatus: "confirmed",
            status: "active",
            createdAt: "2026-04-01T10:00:00.000Z",
            createdByOrganizerId: "organizer-2",
            createdByUserId: "user-organizer-2",
          },
        ],
      }),
    );

    await expect(
      addGroupMember(
        {
          groupId: "group-1",
          displayName: "Inna nazwa",
          phone: "600 111 222",
          referralSource: "Nowe źródło",
          notes: "Nowa notatka grupowa",
          priority: "regularni",
        },
        actor,
      ),
    ).resolves.toEqual({
      ok: true,
      memberId: "group-1__participant-48600111222",
      participantProfileId: "participant-48600111222",
    });

    const store = mockedApi.getStore();
    expect(store.participantProfiles).toHaveLength(1);
    expect(store.participantProfiles?.[0]?.referralSource).toBe("Polecenie od Mai");
    expect(store.participantProfiles?.[0]?.managerOrganizerIds).toContain("organizer-1");
    expect(store.groupMembers?.[0]).toMatchObject({
      groupId: "group-1",
      participantProfileId: "participant-48600111222",
      participantDisplayName: "Alicja Wrona",
      participantPhone: "+48 600 111 222",
      priority: "regularni",
      notes: "Nowa notatka grupowa",
    });
  });

  it("creates a new participant profile with referral source when the phone is not in the store", async () => {
    const { addGroupMember } = await import("./mockRepository");
    const actor = createActor({
      id: "user-organizer-1",
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-1",
    });
    const mockedApi = mockStoreFetch(createOrganizerStore(actor));

    await expect(
      addGroupMember(
        {
          groupId: "group-1",
          displayName: "Karolina Zielinska",
          phone: "+48 600 333 444",
          referralSource: "Instagram",
          notes: "Lubi soboty",
          priority: "stali",
        },
        actor,
      ),
    ).resolves.toEqual({
      ok: true,
      memberId: "group-1__participant-48600333444",
      participantProfileId: "participant-48600333444",
    });

    const store = mockedApi.getStore();
    expect(store.participantProfiles?.[0]).toMatchObject({
      id: "participant-48600333444",
      displayName: "Karolina Zielinska",
      phone: "+48 600 333 444",
      referralSource: "Instagram",
      createdByOrganizerId: "organizer-1",
    });
    expect(store.groupMembers?.[0]).toMatchObject({
      participantProfileId: "participant-48600333444",
      priority: "stali",
      notes: "Lubi soboty",
    });
  });

  it("blocks an organizer from adding members to a group they do not own", async () => {
    const { addGroupMember } = await import("./mockRepository");
    const actor = createActor({
      id: "user-organizer-2",
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-2",
    });

    mockStoreFetch(createOrganizerStore(createActor({
      id: "user-organizer-1",
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-1",
    })));

    await expect(
      addGroupMember(
        {
          groupId: "group-1",
          displayName: "Karolina Zielinska",
          phone: "+48 600 333 444",
          priority: "stali",
        },
        actor,
      ),
    ).rejects.toThrow("Nie możesz dodawać członków do tej grupy.");
  });
});

describe("submitEnrollment", () => {
  it("stores participating intent and keeps community request pending until decision", async () => {
    const actorId = "user-participant";
    const actor = createActor({
      id: actorId,
      role: "participant",
      roles: ["participant"],
      primaryRole: "participant",
      displayName: "Grzegorz Emanowicz",
      phone: "+48 600 200 300",
    });
    mockSession(actorId);
    const mockedApi = mockStoreFetch(createStore({}, actor));
    const { submitEnrollment } = await import("./mockRepository");

    await expect(
      submitEnrollment({
        eventId: "event-community",
        intent: "participating",
        imieNazwisko: actor.displayName,
        telefon: actor.phone,
        polecenieOdKogo: "",
        wiadomosc: "Chcę dołączyć.",
        photoFile: null,
      }),
    ).resolves.toBeUndefined();

    const request = mockedApi.getStore().enrollmentRequests[0];
    expect(request?.intent).toBe("participating");
    expect(request?.trainerDecision).toBe("pending");
    expect(request?.organizerDecision).toBe("accepted");
    expect(request?.finalStatus).toBe("pending");
  });

  it("defaults missing intent to contact for legacy submitters", async () => {
    const actorId = "user-participant";
    mockSession(actorId);
    const mockedApi = mockStoreFetch(
      createStore(
        {
          id: "event-official",
          brandStatus: "official",
          organizerId: "organizer-1",
          organizerUserId: "user-organizer-1",
          trainerId: "trainer-1",
          trainerUserId: "user-trainer-1",
        },
        {
          id: actorId,
          role: "participant",
          roles: ["participant"],
          primaryRole: "participant",
          displayName: "Ola Chotnicka",
          phone: "+48 600 200 301",
        },
      ),
    );
    const { submitEnrollment } = await import("./mockRepository");

    await expect(
      submitEnrollment({
        eventId: "event-official",
        imieNazwisko: "Ola Chotnicka",
        telefon: "+48 600 200 301",
        polecenieOdKogo: "",
        wiadomosc: "Mam kilka pytań.",
        photoFile: null,
      }),
    ).resolves.toBeUndefined();

    const request = mockedApi.getStore().enrollmentRequests[0];
    expect(request?.intent).toBe("contact");
    expect(request?.finalStatus).toBe("pending");
  });
});
