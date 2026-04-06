import { describe, expect, it } from "vitest";
import {
  getDashboardPerspectives,
  getParticipantDashboardModel,
  getParticipantPendingEnrollmentRequestRecords,
} from "./dashboard";
import type {
  AppUser,
  DemoStore,
  EnrollmentRequest,
  EventParticipant,
  Group,
  OrganizerProfile,
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
    participantProfileId: "participant-1",
    ...overrides,
  };
}

function createTrainer(overrides: Partial<TrainerProfile> = {}): TrainerProfile {
  return {
    id: "trainer-1",
    userId: "trainer-user-1",
    slug: "trainer",
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

function createOrganizer(overrides: Partial<OrganizerProfile> = {}): OrganizerProfile {
  return {
    id: "organizer-1",
    userId: "organizer-user-1",
    displayName: "Organizer",
    description: "Description",
    isVisible: true,
    ...overrides,
  };
}

function createGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: "group-1",
    name: "Grupa Poranna",
    organizerId: "organizer-1",
    trainerId: "trainer-1",
    status: "active",
    defaultEventType: "training",
    defaultConfirmationLeadTimeDays: 7,
    defaultJoinAudience: "new-people",
    createdAt: "2026-04-01T08:00:00.000Z",
    ...overrides,
  };
}

function createEvent(overrides: Partial<TrainingEvent> = {}): TrainingEvent {
  return {
    id: "event-1",
    trainerId: "trainer-1",
    organizerId: "organizer-1",
    groupId: null,
    groupName: null,
    title: "Szkolenie",
    summary: "Opis",
    description: "Opis",
    type: "Szkolenie",
    startsAt: "2026-04-10T10:00:00.000Z",
    endsAt: "2026-04-10T14:00:00.000Z",
    scheduleDays: [
      {
        startsAt: "2026-04-10T10:00:00.000Z",
        endsAt: "2026-04-10T14:00:00.000Z",
      },
    ],
    location: "Warszawa",
    capacity: 12,
    enrolledCount: 5,
    isPublished: true,
    imageHint: "hint",
    brandStatus: "official",
    publicationApprovalStatus: "accepted",
    status: "active",
    ...overrides,
  };
}

function createEventParticipant(overrides: Partial<EventParticipant> = {}): EventParticipant {
  return {
    id: "participant-event-1",
    eventId: "event-2",
    eventTitle: "Grupowe szkolenie",
    groupId: "group-1",
    groupName: "Grupa Poranna",
    organizerId: "organizer-1",
    organizerUserId: "organizer-user-1",
    trainerId: "trainer-1",
    trainerUserId: "trainer-user-1",
    participantProfileId: "participant-1",
    participantDisplayName: "Jan Test",
    participantPhone: "500600700",
    priority: "stali",
    status: "invited",
    source: "organizer",
    invitedAt: "2026-04-01T10:00:00.000Z",
    attendanceConfirmationStatus: "pending",
    ...overrides,
  };
}

function createEnrollmentRequest(overrides: Partial<EnrollmentRequest> = {}): EnrollmentRequest {
  return {
    id: "request-1",
    eventId: "event-1",
    submitterUid: "user-1",
    participantProfileId: "participant-1",
    trainerId: "trainer-1",
    organizerId: "organizer-1",
    imieNazwisko: "Jan Test",
    telefon: "500600700",
    polecenieOdKogo: "",
    wiadomosc: "",
    photoStatus: "pending",
    finalStatus: "pending",
    participantStatus: "active",
    createdAt: "2026-04-01T09:00:00.000Z",
    ...overrides,
  };
}

function createStore(overrides: Partial<DemoStore> = {}): DemoStore {
  return {
    users: [],
    trainers: [createTrainer()],
    organizers: [createOrganizer()],
    participantProfiles: [],
    groups: [createGroup()],
    groupMembers: [],
    eventParticipants: [],
    relations: [],
    trainingEvents: [],
    publicTrainingEvents: [],
    availabilitySlots: [],
    trainerSharedSlots: [],
    trainerCalendarFeeds: [],
    organizerCalendarFeeds: [],
    trainerOrganizerCalendarFeeds: [],
    trainerExternalBusyMonths: [],
    organizerExternalBusyMonths: [],
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
        reminderSmsTemplate: "Reminder",
        confirmationSmsTemplate: "Confirm",
      },
    },
    ...overrides,
  };
}

describe("dashboard helpers", () => {
  it("builds dashboard perspectives by highest hierarchical role", () => {
    expect(getDashboardPerspectives(createUser())).toEqual(["participant"]);
    expect(
      getDashboardPerspectives(
        createUser({
          role: "organizer",
          roles: ["participant", "moderator", "organizer"],
          primaryRole: "organizer",
        }),
      ),
    ).toEqual(["organizer", "participant"]);
    expect(
      getDashboardPerspectives(
        createUser({
          role: "trainer",
          roles: ["participant", "moderator", "organizer", "trainer"],
          primaryRole: "trainer",
        }),
      ),
    ).toEqual(["trainer", "organizer", "participant"]);
  });

  it("builds participant dashboard data only from group roster records", () => {
    const pendingEvent = createEvent({
      id: "event-1",
      title: "Pierwsze szkolenie",
      groupId: "group-1",
      groupName: "Grupa Poranna",
      startsAt: "2026-04-10T10:00:00.000Z",
      endsAt: "2026-04-10T14:00:00.000Z",
      scheduleDays: [
        {
          startsAt: "2026-04-10T10:00:00.000Z",
          endsAt: "2026-04-10T14:00:00.000Z",
        },
      ],
    });
    const groupEvent = createEvent({
      id: "event-2",
      title: "Drugie szkolenie",
      groupId: "group-1",
      groupName: "Grupa Poranna",
      startsAt: "2026-04-11T10:00:00.000Z",
      endsAt: "2026-04-11T14:00:00.000Z",
      scheduleDays: [
        {
          startsAt: "2026-04-11T10:00:00.000Z",
          endsAt: "2026-04-11T14:00:00.000Z",
        },
      ],
    });
    const archivedEvent = createEvent({
      id: "event-3",
      title: "Archiwalne szkolenie",
      startsAt: "2026-04-02T10:00:00.000Z",
      endsAt: "2026-04-02T14:00:00.000Z",
      scheduleDays: [
        {
          startsAt: "2026-04-02T10:00:00.000Z",
          endsAt: "2026-04-02T14:00:00.000Z",
        },
      ],
    });
    const store = createStore({
      trainingEvents: [pendingEvent, groupEvent, archivedEvent],
      enrollmentRequests: [
        createEnrollmentRequest({
          id: "request-pending",
          eventId: "event-1",
          createdAt: "2026-04-01T09:00:00.000Z",
        }),
        createEnrollmentRequest({
          id: "request-synced",
          eventId: "event-2",
          eventParticipantId: "participant-event-1",
          finalStatus: "accepted",
          createdAt: "2026-04-01T10:00:00.000Z",
        }),
      ],
      eventParticipants: [
        createEventParticipant({
          id: "participant-event-1",
          eventId: "event-2",
          attendanceConfirmationStatus: "pending",
        }),
        createEventParticipant({
          id: "participant-event-2",
          eventId: "event-3",
          status: "confirmed",
          attendanceConfirmationStatus: "confirmed",
        }),
      ],
    });

    const model = getParticipantDashboardModel({
      userId: "user-1",
      participantProfileId: "participant-1",
      store,
      now: new Date("2026-04-06T08:00:00.000Z"),
    });

    expect(model.activeEnrollmentCount).toBe(2);
    expect(model.archivedEnrollmentCount).toBe(1);
    expect(model.pendingJoinRequestCount).toBe(1);
    expect(model.upcomingItems).toEqual([
      expect.objectContaining({
        id: "request-pending",
        groupName: "Grupa Poranna",
        daysUntil: 4,
        kind: "request",
        statusLabel: "Oczekujace",
      }),
      expect.objectContaining({
        id: "participant-event-1",
        groupName: "Grupa Poranna",
        daysUntil: 5,
        kind: "roster",
        statusLabel: "Zaproszenie",
      }),
    ]);
    expect(model.pendingConfirmationItems.map((item) => item.token)).toEqual(["participant-event-1"]);
  });

  it("returns only unsynced active request-backed participant enrollments", () => {
    const communityEvent = createEvent({
      id: "event-community",
      brandStatus: "supported",
      title: "Wieczor community",
      groupId: "group-1",
      groupName: "Grupa Poranna",
    });
    const groupedEvent = createEvent({
      id: "event-grouped",
      groupId: "group-1",
      groupName: "Grupa Poranna",
    });
    const store = createStore({
      trainingEvents: [communityEvent, groupedEvent],
      enrollmentRequests: [
        createEnrollmentRequest({
          id: "request-community",
          eventId: "event-community",
        }),
        createEnrollmentRequest({
          id: "request-grouped",
          eventId: "event-grouped",
          eventParticipantId: "participant-event-1",
          finalStatus: "accepted",
        }),
        createEnrollmentRequest({
          id: "request-cancelled",
          eventId: "event-community",
          participantStatus: "cancelled",
        }),
      ],
      eventParticipants: [
        createEventParticipant({
          id: "participant-event-1",
          eventId: "event-grouped",
        }),
      ],
    });

    const records = getParticipantPendingEnrollmentRequestRecords({
      userId: "user-1",
      participantProfileId: "participant-1",
      store,
      now: new Date("2026-04-06T08:00:00.000Z"),
    });

    expect(records.map((record) => record.request.id)).toEqual(["request-community"]);
    expect(records[0]?.kind).toBe("request");
  });
});
