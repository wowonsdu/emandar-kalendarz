import { describe, expect, it } from "vitest";
import {
  buildAuthenticatedNavigationSections,
  buildPublicNavigationSections,
} from "./navigation";
import type {
  AppUser,
  DemoStore,
  EnrollmentRequest,
  TrainerProfile,
  TrainingEvent,
} from "@/domain/types";

function createUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    role: "participant",
    roles: ["participant"],
    primaryRole: "participant",
    displayName: "Test User",
    phone: "123456789",
    status: "active",
    ...overrides,
  };
}

function createStore(
  overrides: Partial<Pick<DemoStore, "enrollmentRequests" | "trainers" | "trainingEvents">> = {},
) {
  return {
    enrollmentRequests: [],
    trainers: [],
    trainingEvents: [],
    ...overrides,
  };
}

function createTrainerProfile(overrides: Partial<TrainerProfile> = {}): TrainerProfile {
  return {
    id: "trainer-1",
    userId: "user-1",
    slug: "test-trainer",
    displayName: "Trainer",
    bio: "Bio",
    specialties: [],
    locations: [],
    isVisible: true,
    heroNote: "Hero",
    brandStatus: "official",
    ...overrides,
  };
}

function createTrainingEvent(overrides: Partial<TrainingEvent> = {}): TrainingEvent {
  return {
    id: "event-1",
    title: "Wydarzenie",
    summary: "Opis",
    description: "Opis",
    type: "community",
    startsAt: "2026-04-10T10:00:00.000Z",
    endsAt: "2026-04-10T12:00:00.000Z",
    scheduleDays: [
      {
        startsAt: "2026-04-10T10:00:00.000Z",
        endsAt: "2026-04-10T12:00:00.000Z",
      },
    ],
    location: "Warszawa",
    capacity: 10,
    enrolledCount: 0,
    isPublished: false,
    imageHint: "hint",
    brandStatus: "supported",
    publicationApprovalStatus: "pending",
    ...overrides,
  };
}

function createEnrollmentRequest(
  overrides: Partial<EnrollmentRequest> = {},
): EnrollmentRequest {
  return {
    id: "request-1",
    eventId: "event-1",
    participantProfileId: "participant-1",
    imieNazwisko: "Anita",
    telefon: "123456789",
    polecenieOdKogo: "",
    wiadomosc: "",
    photoStatus: "pending",
    finalStatus: "pending",
    createdAt: "2026-04-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("navigation sections", () => {
  it("builds the public section with the three public destinations", () => {
    expect(buildPublicNavigationSections()).toEqual([
      {
        title: "Widok Publiczny",
        items: [
          expect.objectContaining({ to: "/kalendarz", label: "Kalendarz" }),
          expect.objectContaining({ to: "/trenerzy", label: "Przekazujący Wiedzę" }),
          expect.objectContaining({
            to: "/wydarzenia-spolecznosci",
            label: "Wydarzenia społeczności",
          }),
        ],
      },
    ]);
  });

  it("builds authenticated sections with a public shortcut first and panel links second", () => {
    const sections = buildAuthenticatedNavigationSections(createUser(), createStore());

    expect(sections.map((section) => section.title)).toEqual([
      "Widok Publiczny",
      "Moja Przestrzeń",
    ]);
    expect(sections[0].hideTitle).toBe(true);
    expect(sections[0].items).toEqual([
      expect.objectContaining({ to: "/kalendarz", label: "Widok Publiczny" }),
    ]);
    expect(sections[1].items.map((item) => item.to)).toEqual([
      "/panel/dashboard",
      "/panel/grupy",
      "/panel/szkolenia",
      "/panel/wydarzenia-spolecznosci",
      "/panel/zgloszenia",
      "/panel/ustawienia",
    ]);
    expect(sections[1].items[4]).toEqual(
      expect.objectContaining({
        to: "/panel/zgloszenia",
        label: "Chcą wziąć udział",
      }),
    );
  });

  it("shows pending request badge for manageable operational requests", () => {
    const user = createUser({
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-1",
    });
    const sections = buildAuthenticatedNavigationSections(
      user,
      createStore({
        trainingEvents: [
          createTrainingEvent({
            id: "event-1",
            brandStatus: "official",
            publicationApprovalStatus: "accepted",
            organizerId: "organizer-1",
          }),
          createTrainingEvent({
            id: "event-2",
            brandStatus: "official",
            publicationApprovalStatus: "accepted",
            organizerId: "organizer-2",
          }),
        ],
        enrollmentRequests: [
          createEnrollmentRequest(),
          createEnrollmentRequest({ id: "request-2", eventId: "event-1", finalStatus: "rejected" }),
          createEnrollmentRequest({ id: "request-3", eventId: "event-1", finalStatus: "accepted" }),
          createEnrollmentRequest({ id: "request-4", eventId: "event-2" }),
        ],
      }),
    );

    expect(sections[1].items[4]).toEqual(
      expect.objectContaining({
        to: "/panel/zgloszenia",
        badgeCount: 1,
      }),
    );
  });

  it("excludes synced group requests from the pending request badge", () => {
    const user = createUser({
      role: "organizer",
      roles: ["participant", "organizer"],
      primaryRole: "organizer",
      organizerProfileId: "organizer-1",
    });
    const sections = buildAuthenticatedNavigationSections(
      user,
      createStore({
        trainingEvents: [
          createTrainingEvent({
            id: "event-1",
            brandStatus: "official",
            publicationApprovalStatus: "accepted",
            organizerId: "organizer-1",
            groupId: "group-1",
          }),
        ],
        enrollmentRequests: [
          createEnrollmentRequest({
            eventParticipantId: "participant-link-1",
          }),
        ],
      }),
    );

    expect(sections[1].items[4]).toEqual(
      expect.objectContaining({
        to: "/panel/zgloszenia",
        badgeCount: undefined,
      }),
    );
  });

  it("keeps role sections after the base panel section and shows moderator badge count", () => {
    const user = createUser({
      role: "organizer",
      roles: ["participant", "moderator", "organizer"],
      primaryRole: "organizer",
    });
    const sections = buildAuthenticatedNavigationSections(user, createStore({
      trainingEvents: [createTrainingEvent(), createTrainingEvent({ id: "event-2" })],
    }));

    expect(sections.map((section) => section.title)).toEqual([
      "Widok Publiczny",
      "Moja Przestrzeń",
      "Moderator",
    ]);
    expect(sections[2].items[0]).toEqual(
      expect.objectContaining({
        to: "/panel/moderacja-wydarzen-spolecznosci",
        badgeCount: 2,
      }),
    );
  });

  it("hides the trainer section for supported community trainers", () => {
    const user = createUser({
      role: "trainer",
      roles: ["participant", "organizer", "trainer"],
      primaryRole: "trainer",
    });
    const sections = buildAuthenticatedNavigationSections(
      user,
      createStore({
        trainers: [createTrainerProfile({ brandStatus: "supported" })],
      }),
    );

    expect(sections.map((section) => section.title)).toEqual([
      "Widok Publiczny",
      "Moja Przestrzeń",
    ]);
  });

  it("includes all elevated role sections for admin users", () => {
    const user = createUser({
      role: "admin",
      roles: ["participant", "moderator", "organizer", "trainer", "admin"],
      primaryRole: "admin",
    });
    const sections = buildAuthenticatedNavigationSections(
      user,
      createStore({
        trainers: [createTrainerProfile()],
      }),
    );

    expect(sections.map((section) => section.title)).toEqual([
      "Widok Publiczny",
      "Moja Przestrzeń",
      "Moderator",
      "Trener",
      "Admin",
    ]);
  });
});
