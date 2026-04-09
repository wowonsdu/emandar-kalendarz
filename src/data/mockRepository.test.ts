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

  it("can sync a newly added member into future open group events", async () => {
    const { addGroupMember } = await import("./mockRepository");
    const actor = createActor({
      id: "user-organizer-1",
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-1",
    });
    const store = createOrganizerStore(actor);
    store.trainingEvents = [
      createEvent({
        id: "event-future-open",
        title: "Przyszłe szkolenie",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: actor.id,
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "Grupa oddechowa",
        startsAt: "2099-04-24T13:00:00.000Z",
        endsAt: "2099-04-24T15:00:00.000Z",
      }),
      createEvent({
        id: "event-future-closed",
        title: "Zamknięte szkolenie",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: actor.id,
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "Grupa oddechowa",
        startsAt: "2099-04-25T13:00:00.000Z",
        endsAt: "2099-04-25T15:00:00.000Z",
        rosterFinalizedAt: "2099-04-20T10:00:00.000Z",
      }),
      createEvent({
        id: "event-past-open",
        title: "Przeszłe szkolenie",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: actor.id,
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "Grupa oddechowa",
        startsAt: "2025-04-24T13:00:00.000Z",
        endsAt: "2025-04-24T15:00:00.000Z",
      }),
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      addGroupMember(
        {
          groupId: "group-1",
          displayName: "Helena Koral",
          phone: "+48 600 444 555",
          priority: "regularni",
          syncFutureEvents: true,
        },
        actor,
      ),
    ).resolves.toEqual({
      ok: true,
      memberId: "group-1__participant-48600444555",
      participantProfileId: "participant-48600444555",
    });

    const updatedStore = mockedApi.getStore();
    expect(updatedStore.groupMembers[0]).toMatchObject({
      groupId: "group-1",
      participantProfileId: "participant-48600444555",
      priority: "regularni",
      membershipStatus: "active",
    });
    expect(updatedStore.participantProfiles[0]).toMatchObject({
      id: "participant-48600444555",
      activeGroupIds: ["group-1"],
      groupIds: ["group-1"],
    });
    expect(updatedStore.eventParticipants).toHaveLength(1);
    expect(updatedStore.eventParticipants[0]).toMatchObject({
      eventId: "event-future-open",
      participantProfileId: "participant-48600444555",
      priority: "regularni",
      status: "invited",
      source: "auto-core",
    });
    const futureOpenEvent = updatedStore.trainingEvents.find((item) => item.id === "event-future-open");
    expect(futureOpenEvent?.enrolledCount).toBe(0);
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
    expect(request?.finalStatus).toBe("pending");
  });

  it("defaults missing intent to participating for legacy submitters", async () => {
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
          groupId: "group-1",
          groupName: "Grupa testowa",
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
    expect(request?.intent).toBe("participating");
    expect(request?.finalStatus).toBe("pending");
  });
});

describe("ensurePhoneParticipantProfile", () => {
  it("updates an existing participant profile instead of duplicating it", async () => {
    const actorId = "user-participant-ensure";
    const actorPhone = "+48 700 200 300";
    const participantProfileId = "participant-48700200300";
    mockSession(actorId);
    const store = createStore(
      {},
      {
        id: actorId,
        role: "participant",
        roles: ["participant"],
        primaryRole: "participant",
        displayName: actorPhone,
        phone: actorPhone,
        status: "active",
      },
    );
    store.participantProfiles = [
      {
        id: participantProfileId,
        linkedUserId: null,
        displayName: "Anna Nowak",
        firstName: "Anna",
        lastName: "Nowak",
        phone: actorPhone,
        phoneLookupKey: "48700200300",
        confirmationStatus: "confirmed",
        status: "active",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);
    const { ensurePhoneParticipantProfile } = await import("./mockRepository");

    await expect(ensurePhoneParticipantProfile()).resolves.toMatchObject({
      ok: true,
      userId: actorId,
      accountCreated: true,
    });

    const updatedStore = mockedApi.getStore();
    const matchingProfiles = updatedStore.participantProfiles.filter(
      (item) => item.id === participantProfileId,
    );

    expect(matchingProfiles).toHaveLength(1);
    expect(matchingProfiles[0]).toMatchObject({
      id: participantProfileId,
      linkedUserId: actorId,
      displayName: "Anna Nowak",
      phone: actorPhone,
    });
    expect(updatedStore.users[0]).toMatchObject({
      id: actorId,
      participantProfileId,
    });
  });
});

describe("manageEnrollmentRequest", () => {
  it("links accepted grouped enrollments to an invited event participant", async () => {
    const { manageEnrollmentRequest } = await import("./mockRepository");
    const actor = createActor();
    const store = createStore(
      {
        id: "event-group",
        title: "Szkolenie EnergyTeam",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "EnergyTeam x1",
      },
      actor,
    );
    store.groups = [
      {
        id: "group-1",
        name: "EnergyTeam x1",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        status: "active",
        defaultEventType: "training",
        defaultConfirmationLeadTimeDays: 7,
        defaultJoinAudience: "new-people",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.organizers = [
      {
        id: "organizer-1",
        userId: "user-organizer-1",
        displayName: "Anita",
        description: "Opis",
        isVisible: true,
      },
    ];
    store.trainers = [
      {
        id: "trainer-1",
        userId: "user-trainer-1",
        slug: "jacek",
        displayName: "Jacek",
        bio: "Bio",
        specialties: [],
        locations: ["Łódź"],
        isVisible: true,
        heroNote: "Hero",
        brandStatus: "official",
      },
    ];
    store.participantProfiles = [
      {
        id: "participant-1",
        linkedUserId: null,
        displayName: "Anna Nowak",
        firstName: "Anna",
        lastName: "Nowak",
        phone: "+48 605 100 304",
        phoneLookupKey: "48605100304",
        confirmationStatus: "confirmed",
        status: "active",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.enrollmentRequests = [
      {
        id: "enrollment-1",
        eventId: "event-group",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        participantProfileId: "participant-1",
        trainerUserId: "user-trainer-1",
        organizerUserId: "user-organizer-1",
        intent: "participating",
        imieNazwisko: "Anna Nowak",
        telefon: "+48 605 100 304",
        polecenieOdKogo: "",
        wiadomosc: "Chcę dołączyć",
        photoStatus: "pending",
        finalStatus: "pending",
        participantStatus: "active",
        createdAt: "2026-04-02T12:00:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      manageEnrollmentRequest(
        {
          requestId: "enrollment-1",
          decision: "accepted",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();
    expect(updatedStore.enrollmentRequests[0]).toMatchObject({
      id: "enrollment-1",
      finalStatus: "accepted",
      eventParticipantId: "event-group__participant-1",
      participantStatus: "active",
    });
    expect(updatedStore.eventParticipants[0]).toMatchObject({
      id: "event-group__participant-1",
      eventId: "event-group",
      participantProfileId: "participant-1",
      status: "invited",
      source: "public-form",
    });
  });

  it("lets an organizer finalize grouped enrollments into the roster", async () => {
    const { manageEnrollmentRequest } = await import("./mockRepository");
    const actor = createActor({
      id: "user-organizer-1",
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-1",
    });
    const store = createStore(
      {
        id: "event-group-organizer",
        title: "Szkolenie grupowe",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "EnergyTeam x1",
      },
      actor,
    );
    store.groups = [
      {
        id: "group-1",
        name: "EnergyTeam x1",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        status: "active",
        defaultEventType: "training",
        defaultConfirmationLeadTimeDays: 7,
        defaultJoinAudience: "new-people",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.organizers = [
      {
        id: "organizer-1",
        userId: "user-organizer-1",
        displayName: "Anita",
        description: "Opis",
        isVisible: true,
      },
    ];
    store.trainers = [
      {
        id: "trainer-1",
        userId: "user-trainer-1",
        slug: "jacek",
        displayName: "Jacek",
        bio: "Bio",
        specialties: [],
        locations: ["Łódź"],
        isVisible: true,
        heroNote: "Hero",
        brandStatus: "official",
      },
    ];
    store.participantProfiles = [
      {
        id: "participant-1",
        linkedUserId: null,
        displayName: "Anna Nowak",
        firstName: "Anna",
        lastName: "Nowak",
        phone: "+48 605 100 304",
        phoneLookupKey: "48605100304",
        confirmationStatus: "confirmed",
        status: "active",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.enrollmentRequests = [
      {
        id: "enrollment-organizer-group",
        eventId: "event-group-organizer",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        participantProfileId: "participant-1",
        trainerUserId: "user-trainer-1",
        organizerUserId: "user-organizer-1",
        intent: "participating",
        imieNazwisko: "Anna Nowak",
        telefon: "+48 605 100 304",
        polecenieOdKogo: "",
        wiadomosc: "Chcę dołączyć",
        photoStatus: "pending",
        finalStatus: "pending",
        participantStatus: "active",
        createdAt: "2026-04-02T12:00:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      manageEnrollmentRequest(
        {
          requestId: "enrollment-organizer-group",
          decision: "accepted",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();
    expect(updatedStore.enrollmentRequests[0]).toMatchObject({
      id: "enrollment-organizer-group",
      finalStatus: "accepted",
      eventParticipantId: "event-group-organizer__participant-1",
      participantStatus: "active",
    });
    expect(updatedStore.eventParticipants[0]).toMatchObject({
      id: "event-group-organizer__participant-1",
      eventId: "event-group-organizer",
      participantProfileId: "participant-1",
      status: "invited",
      source: "public-form",
    });
  });

  it("lets an organizer move an accepted grouped enrollment to the reserve roster", async () => {
    const { manageEnrollmentRequest } = await import("./mockRepository");
    const actor = createActor({
      id: "user-organizer-1",
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-1",
    });
    const store = createStore(
      {
        id: "event-group-reserve",
        title: "Szkolenie grupowe",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "EnergyTeam x1",
      },
      actor,
    );
    store.groups = [
      {
        id: "group-1",
        name: "EnergyTeam x1",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        status: "active",
        defaultEventType: "training",
        defaultConfirmationLeadTimeDays: 7,
        defaultJoinAudience: "new-people",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.organizers = [
      {
        id: "organizer-1",
        userId: "user-organizer-1",
        displayName: "Anita",
        description: "Opis",
        isVisible: true,
      },
    ];
    store.trainers = [
      {
        id: "trainer-1",
        userId: "user-trainer-1",
        slug: "jacek",
        displayName: "Jacek",
        bio: "Bio",
        specialties: [],
        locations: ["Łódź"],
        isVisible: true,
        heroNote: "Hero",
        brandStatus: "official",
      },
    ];
    store.participantProfiles = [
      {
        id: "participant-1",
        linkedUserId: null,
        displayName: "Anna Nowak",
        firstName: "Anna",
        lastName: "Nowak",
        phone: "+48 605 100 304",
        phoneLookupKey: "48605100304",
        confirmationStatus: "confirmed",
        status: "active",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.enrollmentRequests = [
      {
        id: "enrollment-organizer-reserve",
        eventId: "event-group-reserve",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        participantProfileId: "participant-1",
        trainerUserId: "user-trainer-1",
        organizerUserId: "user-organizer-1",
        intent: "participating",
        imieNazwisko: "Anna Nowak",
        telefon: "+48 605 100 304",
        polecenieOdKogo: "",
        wiadomosc: "Chcę dołączyć",
        photoStatus: "pending",
        finalStatus: "pending",
        participantStatus: "active",
        createdAt: "2026-04-02T12:00:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      manageEnrollmentRequest(
        {
          requestId: "enrollment-organizer-reserve",
          decision: "accepted",
          acceptedParticipantStatus: "rezerwowy",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();
    expect(updatedStore.enrollmentRequests[0]).toMatchObject({
      id: "enrollment-organizer-reserve",
      finalStatus: "accepted",
      eventParticipantId: "event-group-reserve__participant-1",
      participantStatus: "active",
    });
    expect(updatedStore.eventParticipants[0]).toMatchObject({
      id: "event-group-reserve__participant-1",
      eventId: "event-group-reserve",
      participantProfileId: "participant-1",
      status: "rezerwowy",
      source: "public-form",
    });
    expect(updatedStore.trainingEvents[0]).toMatchObject({
      id: "event-group-reserve",
      enrolledCount: 0,
    });
  });

  it("syncs accepted community enrollments into event participants", async () => {
    const { manageEnrollmentRequest } = await import("./mockRepository");
    const actor = createActor();
    const store = createStore(
      {
        id: "event-community-accept",
        title: "Spotkanie społeczności",
        type: "Wydarzenie społeczności",
        eventTypeSystem: "post",
        brandStatus: "supported",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: null,
        groupName: null,
      },
      actor,
    );
    store.participantProfiles = [
      {
        id: "participant-community-1",
        linkedUserId: "user-participant-1",
        displayName: "Ola Chotnicka",
        firstName: "Ola",
        lastName: "Chotnicka",
        phone: "+48 605 100 302",
        phoneLookupKey: "48605100302",
        confirmationStatus: "confirmed",
        status: "active",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.enrollmentRequests = [
      {
        id: "enrollment-community-1",
        eventId: "event-community-accept",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        participantProfileId: "participant-community-1",
        submitterUid: "user-participant-1",
        trainerUserId: "user-trainer-1",
        organizerUserId: "user-organizer-1",
        intent: "participating",
        imieNazwisko: "Ola Chotnicka",
        telefon: "+48 605 100 302",
        polecenieOdKogo: "",
        wiadomosc: "Chcę dołączyć",
        photoStatus: "pending",
        finalStatus: "pending",
        participantStatus: "active",
        createdAt: "2026-04-02T12:00:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      manageEnrollmentRequest(
        {
          requestId: "enrollment-community-1",
          decision: "accepted",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();
    expect(updatedStore.enrollmentRequests[0]).toMatchObject({
      id: "enrollment-community-1",
      finalStatus: "accepted",
      eventParticipantId: "event-community-accept__participant-community-1",
      participantStatus: "active",
    });
    expect(updatedStore.eventParticipants[0]).toMatchObject({
      id: "event-community-accept__participant-community-1",
      eventId: "event-community-accept",
      participantProfileId: "participant-community-1",
      status: "confirmed",
      source: "public-form",
    });
    expect(updatedStore.trainingEvents[0]).toMatchObject({
      id: "event-community-accept",
      enrolledCount: 1,
    });
  });

  it("creates a transferred pending request on the target event", async () => {
    const { manageEnrollmentRequest } = await import("./mockRepository");
    const actor = createActor();
    const store = createStore(
      {
        id: "event-group-a",
        title: "Szkolenie A",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "EnergyTeam x1",
      },
      actor,
    );
    store.trainingEvents.push(
      createEvent({
        id: "event-group-b",
        title: "Szkolenie B",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "EnergyTeam x1",
      }),
    );
    store.groups = [
      {
        id: "group-1",
        name: "EnergyTeam x1",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        status: "active",
        defaultEventType: "training",
        defaultConfirmationLeadTimeDays: 7,
        defaultJoinAudience: "new-people",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.organizers = [
      {
        id: "organizer-1",
        userId: "user-organizer-1",
        displayName: "Anita",
        description: "Opis",
        isVisible: true,
      },
    ];
    store.trainers = [
      {
        id: "trainer-1",
        userId: "user-trainer-1",
        slug: "jacek",
        displayName: "Jacek",
        bio: "Bio",
        specialties: [],
        locations: ["Łódź"],
        isVisible: true,
        heroNote: "Hero",
        brandStatus: "official",
      },
    ];
    store.participantProfiles = [
      {
        id: "participant-2",
        linkedUserId: null,
        displayName: "Grzegorz Emanowicz",
        firstName: "Grzegorz",
        lastName: "Emanowicz",
        phone: "+48 605 100 301",
        phoneLookupKey: "48605100301",
        confirmationStatus: "confirmed",
        status: "active",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.enrollmentRequests = [
      {
        id: "enrollment-transfer",
        eventId: "event-group-a",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        participantProfileId: "participant-2",
        trainerUserId: "user-trainer-1",
        organizerUserId: "user-organizer-1",
        intent: "participating",
        imieNazwisko: "Grzegorz Emanowicz",
        telefon: "+48 605 100 301",
        polecenieOdKogo: "",
        wiadomosc: "Pasuje mi inny termin",
        photoStatus: "pending",
        finalStatus: "pending",
        participantStatus: "active",
        createdAt: "2026-04-02T12:00:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      manageEnrollmentRequest(
        {
          requestId: "enrollment-transfer",
          decision: "accepted",
          transferTargetEventId: "event-group-b",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();
    const transferredRequest = updatedStore.enrollmentRequests.find(
      (item) => item.id !== "enrollment-transfer",
    );

    expect(updatedStore.enrollmentRequests.find((item) => item.id === "enrollment-transfer"))
      .toMatchObject({
        participantStatus: "cancelled",
        participantActionSource: "staff",
      });
    expect(transferredRequest).toMatchObject({
      eventId: "event-group-b",
      finalStatus: "pending",
      participantStatus: "active",
      eventParticipantId: null,
    });
    expect(updatedStore.eventParticipants).toEqual([]);
  });

  it("moves a previously accepted grouped enrollment into rejected state and declines the roster entry", async () => {
    const { manageEnrollmentRequest } = await import("./mockRepository");
    const actor = createActor();
    const store = createStore(
      {
        id: "event-group-reject",
        title: "Szkolenie oddechowe",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "EnergyTeam x1",
        enrolledCount: 1,
      },
      actor,
    );
    store.groups = [
      {
        id: "group-1",
        name: "EnergyTeam x1",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        status: "active",
        defaultEventType: "training",
        defaultConfirmationLeadTimeDays: 7,
        defaultJoinAudience: "new-people",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.participantProfiles = [
      {
        id: "participant-1",
        linkedUserId: null,
        displayName: "Anna Nowak",
        firstName: "Anna",
        lastName: "Nowak",
        phone: "+48 605 100 304",
        phoneLookupKey: "48605100304",
        confirmationStatus: "confirmed",
        status: "active",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.enrollmentRequests = [
      {
        id: "enrollment-reject",
        eventId: "event-group-reject",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        participantProfileId: "participant-1",
        trainerUserId: "user-trainer-1",
        organizerUserId: "user-organizer-1",
        eventParticipantId: "event-group-reject__participant-1",
        intent: "participating",
        imieNazwisko: "Anna Nowak",
        telefon: "+48 605 100 304",
        polecenieOdKogo: "",
        wiadomosc: "Byłam chętna.",
        photoStatus: "pending",
        finalStatus: "accepted",
        participantStatus: "active",
        createdAt: "2026-04-02T12:00:00.000Z",
      },
    ];
    store.eventParticipants = [
      {
        id: "event-group-reject__participant-1",
        eventId: "event-group-reject",
        eventTitle: "Szkolenie oddechowe",
        groupId: "group-1",
        groupName: "EnergyTeam x1",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        participantProfileId: "participant-1",
        participantDisplayName: "Anna Nowak",
        participantPhone: "+48 605 100 304",
        participantUserId: null,
        priority: "regularni",
        status: "confirmed",
        source: "public-form",
        invitedAt: "2026-04-02T12:00:00.000Z",
        confirmedAt: "2026-04-02T12:10:00.000Z",
        updatedAt: "2026-04-02T12:10:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      manageEnrollmentRequest(
        {
          requestId: "enrollment-reject",
          decision: "rejected",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();

    expect(updatedStore.enrollmentRequests[0]).toMatchObject({
      id: "enrollment-reject",
      finalStatus: "rejected",
      participantStatus: "cancelled",
    });
    expect(updatedStore.eventParticipants[0]).toMatchObject({
      id: "event-group-reject__participant-1",
      status: "declined",
    });
    expect(updatedStore.eventParticipants[0]?.confirmedAt).toBeUndefined();
    expect(updatedStore.trainingEvents[0]?.enrolledCount).toBe(0);
  });

  it("moves a previously accepted community enrollment into rejected state and removes it from the count", async () => {
    const { manageEnrollmentRequest } = await import("./mockRepository");
    const actor = createActor();
    const store = createStore(
      {
        id: "event-community-reject",
        title: "Spotkanie oddechowe",
        type: "Wydarzenie społeczności",
        eventTypeSystem: "post",
        brandStatus: "supported",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: null,
        groupName: null,
        enrolledCount: 1,
      },
      actor,
    );
    store.participantProfiles = [
      {
        id: "participant-community-2",
        linkedUserId: "user-participant-2",
        displayName: "Dawid Wasyl",
        firstName: "Dawid",
        lastName: "Wasyl",
        phone: "+48 605 100 305",
        phoneLookupKey: "48605100305",
        confirmationStatus: "confirmed",
        status: "active",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.enrollmentRequests = [
      {
        id: "enrollment-community-reject",
        eventId: "event-community-reject",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        participantProfileId: "participant-community-2",
        submitterUid: "user-participant-2",
        trainerUserId: "user-trainer-1",
        organizerUserId: "user-organizer-1",
        eventParticipantId: "event-community-reject__participant-community-2",
        intent: "participating",
        imieNazwisko: "Dawid Wasyl",
        telefon: "+48 605 100 305",
        polecenieOdKogo: "",
        wiadomosc: "Już byłem zapisany.",
        photoStatus: "pending",
        finalStatus: "accepted",
        participantStatus: "active",
        createdAt: "2026-04-02T12:00:00.000Z",
      },
    ];
    store.eventParticipants = [
      {
        id: "event-community-reject__participant-community-2",
        eventId: "event-community-reject",
        eventTitle: "Spotkanie oddechowe",
        groupId: null,
        groupName: null,
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        participantProfileId: "participant-community-2",
        participantDisplayName: "Dawid Wasyl",
        participantPhone: "+48 605 100 305",
        participantUserId: "user-participant-2",
        priority: "regularni",
        status: "confirmed",
        source: "public-form",
        invitedAt: "2026-04-02T12:00:00.000Z",
        confirmedAt: "2026-04-02T12:10:00.000Z",
        updatedAt: "2026-04-02T12:10:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      manageEnrollmentRequest(
        {
          requestId: "enrollment-community-reject",
          decision: "rejected",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();

    expect(updatedStore.enrollmentRequests[0]).toMatchObject({
      id: "enrollment-community-reject",
      finalStatus: "rejected",
      participantStatus: "cancelled",
    });
    expect(updatedStore.eventParticipants[0]).toMatchObject({
      id: "event-community-reject__participant-community-2",
      status: "declined",
    });
    expect(updatedStore.eventParticipants[0]?.confirmedAt).toBeUndefined();
    expect(updatedStore.trainingEvents[0]?.enrolledCount).toBe(0);
  });

  it("allows a rejected grouped enrollment to be confirmed again", async () => {
    const { manageEnrollmentRequest } = await import("./mockRepository");
    const actor = createActor();
    const store = createStore(
      {
        id: "event-group-restore",
        title: "Szkolenie oddechowe",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "EnergyTeam x1",
      },
      actor,
    );
    store.groups = [
      {
        id: "group-1",
        name: "EnergyTeam x1",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        status: "active",
        defaultEventType: "training",
        defaultConfirmationLeadTimeDays: 7,
        defaultJoinAudience: "new-people",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.participantProfiles = [
      {
        id: "participant-1",
        linkedUserId: null,
        displayName: "Anna Nowak",
        firstName: "Anna",
        lastName: "Nowak",
        phone: "+48 605 100 304",
        phoneLookupKey: "48605100304",
        confirmationStatus: "confirmed",
        status: "active",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    store.enrollmentRequests = [
      {
        id: "enrollment-restore",
        eventId: "event-group-restore",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        participantProfileId: "participant-1",
        trainerUserId: "user-trainer-1",
        organizerUserId: "user-organizer-1",
        eventParticipantId: "event-group-restore__participant-1",
        intent: "participating",
        imieNazwisko: "Anna Nowak",
        telefon: "+48 605 100 304",
        polecenieOdKogo: "",
        wiadomosc: "Chcę wrócić.",
        photoStatus: "pending",
        finalStatus: "rejected",
        participantStatus: "cancelled",
        createdAt: "2026-04-02T12:00:00.000Z",
      },
    ];
    store.eventParticipants = [
      {
        id: "event-group-restore__participant-1",
        eventId: "event-group-restore",
        eventTitle: "Szkolenie oddechowe",
        groupId: "group-1",
        groupName: "EnergyTeam x1",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        participantProfileId: "participant-1",
        participantDisplayName: "Anna Nowak",
        participantPhone: "+48 605 100 304",
        participantUserId: null,
        priority: "regularni",
        status: "declined",
        source: "public-form",
        invitedAt: "2026-04-02T12:00:00.000Z",
        declinedAt: "2026-04-02T12:10:00.000Z",
        updatedAt: "2026-04-02T12:10:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      manageEnrollmentRequest(
        {
          requestId: "enrollment-restore",
          decision: "accepted",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();

    expect(updatedStore.enrollmentRequests[0]).toMatchObject({
      id: "enrollment-restore",
      finalStatus: "accepted",
      participantStatus: "active",
      eventParticipantId: "event-group-restore__participant-1",
    });
    expect(updatedStore.eventParticipants[0]).toMatchObject({
      id: "event-group-restore__participant-1",
      status: "invited",
    });
  });
});

describe("organizer profile updates", () => {
  it("connects an organizer to the selected trainer when the code matches that trainer", async () => {
    const { connectOrganizerToTrainerWithCode } = await import("./mockRepository");
    const actor = createActor({
      id: "user-participant-connect",
      role: "participant",
      roles: ["participant"],
      primaryRole: "participant",
      displayName: "Ola Chotnicka",
    });
    const store = createStore({}, actor);
    store.trainers = [
      {
        id: "trainer-1",
        userId: "user-trainer-1",
        slug: "jacek",
        displayName: "Jacek",
        bio: "Bio",
        specialties: [],
        locations: ["Warszawa"],
        isVisible: true,
        heroNote: "Hero",
        brandStatus: "official",
        authorizationCode: "JACEK123",
        authorizationCodeConfigured: true,
      },
    ];
    mockSession(actor.id);
    const mockedApi = mockStoreFetch(store);

    await expect(
      connectOrganizerToTrainerWithCode("JACEK123", "trainer-1"),
    ).resolves.toMatchObject({
      ok: true,
      trainerId: "trainer-1",
      organizerProfileCreated: true,
    });

    const updatedStore = mockedApi.getStore();
    expect(updatedStore.users[0].organizerProfileId).toBeTruthy();
    expect(updatedStore.relations[0]).toMatchObject({
      trainerId: "trainer-1",
      organizerUserId: actor.id,
      status: "approved",
      requestedBy: "organizer",
    });
  });

  it("rejects a code that belongs to a different trainer than the selected card", async () => {
    const { connectOrganizerToTrainerWithCode } = await import("./mockRepository");
    const actor = createActor({
      id: "user-participant-mismatch",
      role: "participant",
      roles: ["participant"],
      primaryRole: "participant",
      displayName: "Ola Chotnicka",
    });
    const store = createStore({}, actor);
    store.trainers = [
      {
        id: "trainer-1",
        userId: "user-trainer-1",
        slug: "jacek",
        displayName: "Jacek",
        bio: "Bio",
        specialties: [],
        locations: ["Warszawa"],
        isVisible: true,
        heroNote: "Hero",
        brandStatus: "official",
        authorizationCode: "JACEK123",
        authorizationCodeConfigured: true,
      },
      {
        id: "trainer-2",
        userId: "user-trainer-2",
        slug: "marcin",
        displayName: "Marcin",
        bio: "Bio",
        specialties: [],
        locations: ["Łódź"],
        isVisible: true,
        heroNote: "Hero",
        brandStatus: "official",
        authorizationCode: "MARCIN123",
        authorizationCodeConfigured: true,
      },
    ];
    mockSession(actor.id);
    const mockedApi = mockStoreFetch(store);

    await expect(
      connectOrganizerToTrainerWithCode("MARCIN123", "trainer-1"),
    ).rejects.toThrow("Ten kod należy do innego Przekazującego Wiedzę.");

    const updatedStore = mockedApi.getStore();
    expect(updatedStore.relations).toHaveLength(0);
    expect(updatedStore.users[0].organizerProfileId).toBeUndefined();
  });

  it("upserts an official organizer profile when the user does not have one yet", async () => {
    const { updateOrganizerProfile } = await import("./mockRepository");
    const actor = createActor({
      id: "user-participant-1",
      role: "participant",
      roles: ["participant"],
      primaryRole: "participant",
      displayName: "Ola Chotnicka",
      notes: "Opis bazowy",
    });
    const mockedApi = mockStoreFetch(createStore({}, actor));

    await expect(
      updateOrganizerProfile(
        {
          displayName: "Ola Organizer",
          contactName: "Ola",
          location: "Warszawa",
          description: "Oficjalny opis organizatora",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();
    expect(updatedStore.users[0].organizerProfileId).toBeTruthy();
    expect(updatedStore.organizers[0]).toMatchObject({
      userId: actor.id,
      displayName: "Ola Organizer",
      contactName: "Ola",
      location: "Warszawa",
      description: "Oficjalny opis organizatora",
    });
  });

  it("stores a separate community organizer variant and uses it for community event snapshots", async () => {
    const {
      createTrainingEvent,
      updateCommunityOrganizerProfile,
      updateOrganizerProfile,
    } = await import("./mockRepository");
    const actor = createActor({
      id: "user-participant-2",
      role: "participant",
      roles: ["participant"],
      primaryRole: "participant",
      displayName: "Marcin Młynek",
      notes: "Profil użytkownika",
    });
    const mockedApi = mockStoreFetch(createStore({}, actor));

    await updateOrganizerProfile(
      {
        displayName: "Marcin M",
        contactName: "Marcin",
        location: "Łódź",
        description: "Oficjalny profil",
      },
      actor,
    );
    const actorWithOrganizerProfile = mockedApi.getStore().users[0];
    await updateCommunityOrganizerProfile(
      {
        displayName: "Marcino",
        contactName: "Marcino",
        location: "Online",
        description: "Społecznościowy profil",
      },
      actorWithOrganizerProfile,
    );
    const actorForEventCreation = mockedApi.getStore().users[0];
    await createTrainingEvent(
      {
        title: "Krąg społeczności",
        summary: "Opis skrócony",
        description: "Opis pełny",
        type: "Wydarzenie społeczności",
        eventTypeSystem: "post",
        scheduleDays: [
          {
            startsAt: "2099-05-10T18:00:00.000Z",
            endsAt: "2099-05-10T20:00:00.000Z",
          },
        ],
        location: "Online",
        capacity: 20,
        isPublished: false,
        brandStatus: "supported",
      },
      actorForEventCreation,
    );

    const updatedStore = mockedApi.getStore();
    expect(updatedStore.organizers[0]).toMatchObject({
      displayName: "Marcin M",
      communityProfile: {
        displayName: "Marcino",
        contactName: "Marcino",
        location: "Online",
        description: "Społecznościowy profil",
      },
    });
    expect(updatedStore.trainingEvents[0]).toMatchObject({
      creatorDisplayName: "Marcino",
    });
  });
});

describe("group event roster defaults", () => {
  it("creates a full invited roster from the group when a grouped training event is created", async () => {
    const { createTrainingEvent } = await import("./mockRepository");
    const actor = createActor({
      id: "user-organizer-1",
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-1",
    });
    const store = createOrganizerStore(actor, {
      participantProfiles: [
        {
          id: "participant-1",
          linkedUserId: null,
          displayName: "Anna Nowak",
          firstName: "Anna",
          lastName: "Nowak",
          phone: "+48 605 100 304",
          phoneLookupKey: "48605100304",
          confirmationStatus: "confirmed",
          status: "active",
          createdAt: "2026-04-01T10:00:00.000Z",
        },
        {
          id: "participant-2",
          linkedUserId: null,
          displayName: "Grzegorz Emanowicz",
          firstName: "Grzegorz",
          lastName: "Emanowicz",
          phone: "+48 605 100 301",
          phoneLookupKey: "48605100301",
          confirmationStatus: "confirmed",
          status: "active",
          createdAt: "2026-04-01T10:00:00.000Z",
        },
      ],
      groupMembers: [
        {
          id: "group-1__participant-1",
          groupId: "group-1",
          organizerId: "organizer-1",
          organizerUserId: actor.id,
          trainerId: "trainer-1",
          trainerUserId: "user-trainer-1",
          participantProfileId: "participant-1",
          participantUserId: null,
          participantDisplayName: "Anna Nowak",
          participantPhone: "+48 605 100 304",
          priority: "stali",
          membershipStatus: "active",
          joinedAt: "2026-04-01T10:00:00.000Z",
        },
        {
          id: "group-1__participant-2",
          groupId: "group-1",
          organizerId: "organizer-1",
          organizerUserId: actor.id,
          trainerId: "trainer-1",
          trainerUserId: "user-trainer-1",
          participantProfileId: "participant-2",
          participantUserId: null,
          participantDisplayName: "Grzegorz Emanowicz",
          participantPhone: "+48 605 100 301",
          priority: "rezerwowi",
          membershipStatus: "active",
          joinedAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    });
    store.organizers = [
      {
        id: "organizer-1",
        userId: actor.id,
        displayName: "Anita",
        description: "Opis",
        isVisible: true,
      },
    ];
    store.trainers = [
      {
        id: "trainer-1",
        userId: "user-trainer-1",
        slug: "jacek",
        displayName: "Jacek",
        bio: "Bio",
        specialties: [],
        locations: ["Łódź"],
        isVisible: true,
        heroNote: "Hero",
        brandStatus: "official",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      createTrainingEvent(
        {
          trainerId: "trainer-1",
          groupId: "group-1",
          title: "Nowe szkolenie grupowe",
          summary: "Opis skrócony",
          description: "Opis pełny",
          type: "Szkolenie",
          eventTypeSystem: "training",
          scheduleDays: [
            {
              startsAt: "2099-05-10T08:00:00.000Z",
              endsAt: "2099-05-10T14:00:00.000Z",
            },
          ],
          location: "Łódź",
          capacity: 20,
          isPublished: true,
          brandStatus: "official",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    const updatedStore = mockedApi.getStore();
    const createdEvent = updatedStore.trainingEvents[0];
    expect(createdEvent).toMatchObject({
      groupId: "group-1",
      groupName: "Grupa oddechowa",
      enrolledCount: 0,
    });
    expect(updatedStore.eventParticipants).toHaveLength(2);
    expect(updatedStore.eventParticipants.map((item) => ({
      participantProfileId: item.participantProfileId,
      priority: item.priority,
      status: item.status,
      source: item.source,
    }))).toEqual(
      expect.arrayContaining([
        {
          participantProfileId: "participant-1",
          priority: "stali",
          status: "invited",
          source: "auto-core",
        },
        {
          participantProfileId: "participant-2",
          priority: "rezerwowi",
          status: "invited",
          source: "auto-core",
        },
      ]),
    );
  });

  it("counts only confirmed participants in enrolledCount for grouped events", async () => {
    const { updateEventParticipantStatus } = await import("./mockRepository");
    const actor = createActor();
    const store = createStore(
      {
        id: "event-group-count",
        title: "Szkolenie grupowe",
        type: "Szkolenie",
        eventTypeSystem: "training",
        brandStatus: "official",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        groupId: "group-1",
        groupName: "Grupa oddechowa",
      },
      actor,
    );
    store.eventParticipants = [
      {
        id: "event-group-count__participant-1",
        eventId: "event-group-count",
        eventTitle: "Szkolenie grupowe",
        groupId: "group-1",
        groupName: "Grupa oddechowa",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        participantProfileId: "participant-1",
        participantDisplayName: "Anna Nowak",
        participantPhone: "+48 605 100 304",
        participantUserId: null,
        priority: "stali",
        status: "invited",
        source: "auto-core",
        invitedAt: "2026-04-01T10:00:00.000Z",
      },
      {
        id: "event-group-count__participant-2",
        eventId: "event-group-count",
        eventTitle: "Szkolenie grupowe",
        groupId: "group-1",
        groupName: "Grupa oddechowa",
        organizerId: "organizer-1",
        organizerUserId: "user-organizer-1",
        trainerId: "trainer-1",
        trainerUserId: "user-trainer-1",
        participantProfileId: "participant-2",
        participantDisplayName: "Grzegorz Emanowicz",
        participantPhone: "+48 605 100 301",
        participantUserId: null,
        priority: "regularni",
        status: "invited",
        source: "auto-core",
        invitedAt: "2026-04-01T10:00:00.000Z",
      },
    ];
    const mockedApi = mockStoreFetch(store);

    await expect(
      updateEventParticipantStatus(
        {
          eventParticipantId: "event-group-count__participant-2",
          status: "rezerwowy",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    let updatedStore = mockedApi.getStore();
    expect(updatedStore.trainingEvents[0]?.enrolledCount).toBe(0);

    await expect(
      updateEventParticipantStatus(
        {
          eventParticipantId: "event-group-count__participant-1",
          status: "confirmed",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    updatedStore = mockedApi.getStore();
    expect(updatedStore.trainingEvents[0]?.enrolledCount).toBe(1);

    await expect(
      updateEventParticipantStatus(
        {
          eventParticipantId: "event-group-count__participant-2",
          status: "invited",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    updatedStore = mockedApi.getStore();
    expect(updatedStore.trainingEvents[0]?.enrolledCount).toBe(1);

    await expect(
      updateEventParticipantStatus(
        {
          eventParticipantId: "event-group-count__participant-1",
          status: "declined",
        },
        actor,
      ),
    ).resolves.toBeUndefined();

    updatedStore = mockedApi.getStore();
    expect(updatedStore.trainingEvents[0]?.enrolledCount).toBe(0);
  });

  it("does not restore the previous user profile after sign-out", async () => {
    mockSession("user-organizer");
    mockStoreFetch(
      createStore(
        {},
        {
          id: "user-organizer",
          role: "organizer",
          roles: ["participant", "organizer"],
          primaryRole: "organizer",
          email: "anita@emandar.test",
        },
      ),
    );

    const { signOut, subscribeAuthState, subscribeUserProfile } = await import("./mockRepository");
    let currentAuthUserId: string | null = "user-organizer";
    let currentUser: AppUser | null = null;

    const stopAuth = subscribeAuthState((userId) => {
      currentAuthUserId = userId;
      if (!userId) {
        currentUser = null;
      }
    });
    const stopUserProfile = subscribeUserProfile("user-organizer", (user) => {
      currentUser = user;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(currentUser?.id).toBe("user-organizer");

    await signOut();

    expect(currentAuthUserId).toBeNull();
    expect(currentUser).toBeNull();

    stopUserProfile();
    stopAuth();
  });
});
