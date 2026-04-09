import { describe, expect, it } from "vitest";
import {
  getDashboardPerspectives,
  getOrganizerOfficialDashboardModel,
  getParticipantDashboardModel,
  getParticipantEnrollmentViewRecords,
  getParticipantPendingEnrollmentRequestRecords,
} from "./dashboard";
import type {
  AppUser,
  DemoStore,
  EnrollmentRequest,
  EventParticipant,
  Group,
  GroupMember,
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

function createGroupMember(overrides: Partial<GroupMember> = {}): GroupMember {
  return {
    id: "group-member-1",
    groupId: "group-1",
    organizerId: "organizer-1",
    organizerUserId: "organizer-user-1",
    trainerId: "trainer-1",
    trainerUserId: "trainer-user-1",
    participantProfileId: "participant-1",
    participantUserId: "user-1",
    participantDisplayName: "Jan Test",
    participantPhone: "500600700",
    priority: "regularni",
    membershipStatus: "active",
    joinedAt: "2026-04-01T09:00:00.000Z",
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

  it("labels reserve roster entries as rezerwowy in participant dashboard", () => {
    const reserveEvent = createEvent({
      id: "event-reserve",
      title: "Rezerwa",
      groupId: "group-1",
      groupName: "Grupa Poranna",
      startsAt: "2026-04-20T10:00:00.000Z",
      endsAt: "2026-04-20T14:00:00.000Z",
      scheduleDays: [
        {
          startsAt: "2026-04-20T10:00:00.000Z",
          endsAt: "2026-04-20T14:00:00.000Z",
        },
      ],
    });
    const store = createStore({
      trainingEvents: [reserveEvent],
      eventParticipants: [
        createEventParticipant({
          id: "participant-event-reserve",
          eventId: "event-reserve",
          status: "rezerwowy",
          attendanceConfirmationStatus: "not-required",
        }),
      ],
    });

    const model = getParticipantDashboardModel({
      userId: "user-1",
      participantProfileId: "participant-1",
      store,
      now: new Date("2026-04-06T08:00:00.000Z"),
    });

    expect(model.upcomingItems).toEqual([
      expect.objectContaining({
        id: "participant-event-reserve",
        statusLabel: "Rezerwowy",
      }),
    ]);
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

  it("returns community enrollment view records for both request and roster participation", () => {
    const communityRequestEvent = createEvent({
      id: "event-community-request",
      brandStatus: "supported",
      title: "Wieczor community",
      groupId: null,
      groupName: null,
    });
    const communityRosterEvent = createEvent({
      id: "event-community-roster",
      brandStatus: "supported",
      title: "Poranek community",
      groupId: null,
      groupName: null,
    });
    const store = createStore({
      trainingEvents: [communityRequestEvent, communityRosterEvent],
      enrollmentRequests: [
        createEnrollmentRequest({
          id: "request-community-active",
          eventId: "event-community-request",
        }),
        createEnrollmentRequest({
          id: "request-community-synced",
          eventId: "event-community-roster",
          eventParticipantId: "participant-event-community",
          finalStatus: "accepted",
        }),
      ],
      eventParticipants: [
        createEventParticipant({
          id: "participant-event-community",
          eventId: "event-community-roster",
        }),
      ],
    });

    const records = getParticipantEnrollmentViewRecords({
      userId: "user-1",
      participantProfileId: "participant-1",
      store,
      now: new Date("2026-04-06T08:00:00.000Z"),
    });

    expect(
      records.filter((record) => record.event.brandStatus === "supported").map((record) => ({
        eventId: record.event.id,
        kind: record.kind,
      })),
    ).toEqual([
      { eventId: "event-community-request", kind: "request" },
      { eventId: "event-community-roster", kind: "roster" },
    ]);
  });

  it("builds organizer official dashboard from active groups and grouped official requests", () => {
    const organizerGroup = createGroup({
      id: "group-1",
      name: "EnergyTeam x1",
    });
    const secondOrganizerGroup = createGroup({
      id: "group-2",
      name: "Centralna",
    });
    const foreignGroup = createGroup({
      id: "group-foreign",
      organizerId: "organizer-foreign",
      name: "Obca grupa",
    });
    const groupedEventPending = createEvent({
      id: "event-group-1",
      title: "Spotkanie z Ola",
      groupId: "group-1",
      groupName: "EnergyTeam x1",
      startsAt: "2026-04-10T10:00:00.000Z",
      endsAt: "2026-04-10T14:00:00.000Z",
      scheduleDays: [
        {
          startsAt: "2026-04-10T10:00:00.000Z",
          endsAt: "2026-04-10T14:00:00.000Z",
        },
      ],
      capacity: 10,
      enrolledCount: 6,
    });
    const groupedEventAccepted = createEvent({
      id: "event-group-2",
      title: "Jacek Lodz",
      groupId: "group-2",
      groupName: "Centralna",
      startsAt: "2026-04-16T10:00:00.000Z",
      endsAt: "2026-04-16T14:00:00.000Z",
      scheduleDays: [
        {
          startsAt: "2026-04-16T10:00:00.000Z",
          endsAt: "2026-04-16T14:00:00.000Z",
        },
      ],
      capacity: 12,
      enrolledCount: 10,
      status: "confirmed",
    });
    const communityEvent = createEvent({
      id: "event-community",
      brandStatus: "supported",
      groupId: "group-1",
      groupName: "EnergyTeam x1",
      title: "Community night",
    });
    const store = createStore({
      groups: [organizerGroup, secondOrganizerGroup, foreignGroup],
      groupMembers: [
        createGroupMember({
          id: "member-1",
          groupId: "group-1",
          participantProfileId: "participant-1",
        }),
        createGroupMember({
          id: "member-2",
          groupId: "group-1",
          participantProfileId: "participant-2",
        }),
        createGroupMember({
          id: "member-3",
          groupId: "group-2",
          participantProfileId: "participant-3",
        }),
        createGroupMember({
          id: "member-removed",
          groupId: "group-2",
          participantProfileId: "participant-4",
          membershipStatus: "removed",
        }),
      ],
      trainingEvents: [groupedEventPending, groupedEventAccepted, communityEvent],
      enrollmentRequests: [
        createEnrollmentRequest({
          id: "request-pending",
          eventId: "event-group-1",
          createdAt: "2026-04-03T09:00:00.000Z",
        }),
        createEnrollmentRequest({
          id: "request-accepted",
          eventId: "event-group-2",
          finalStatus: "accepted",
          eventParticipantId: "participant-event-accepted",
          createdAt: "2026-04-04T09:00:00.000Z",
        }),
        createEnrollmentRequest({
          id: "request-transferred",
          eventId: "event-group-1",
          participantStatus: "cancelled",
          participantActionSource: "staff",
          createdAt: "2026-04-05T09:00:00.000Z",
        }),
        createEnrollmentRequest({
          id: "request-community",
          eventId: "event-community",
          createdAt: "2026-04-06T09:00:00.000Z",
        }),
      ],
      eventParticipants: [
        createEventParticipant({
          id: "participant-event-accepted",
          eventId: "event-group-2",
        }),
      ],
    });

    const model = getOrganizerOfficialDashboardModel({
      organizerProfileId: "organizer-1",
      store,
      now: new Date("2026-04-07T08:00:00.000Z"),
    });

    expect(model.groups.map((group) => group.id)).toEqual(["group-2", "group-1"]);
    expect(model.activeMemberCount).toBe(3);
    expect(model.pipelineEvents.map((event) => event.id)).toEqual(["event-group-1", "event-group-2"]);
    expect(model.actionablePendingRequests.map((record) => record.request.id)).toEqual(["request-pending"]);
    expect(model.requestHistoryRecords.map((record) => record.request.id)).toEqual([
      "request-pending",
      "request-accepted",
    ]);
    expect(model.groupSummaries).toEqual([
      expect.objectContaining({
        group: expect.objectContaining({ id: "group-1" }),
        activeMemberCount: 2,
        pendingRequestCount: 1,
        upcomingEventCount: 1,
        nextEvent: expect.objectContaining({ id: "event-group-1" }),
      }),
      expect.objectContaining({
        group: expect.objectContaining({ id: "group-2" }),
        activeMemberCount: 1,
        pendingRequestCount: 0,
        upcomingEventCount: 1,
        nextEvent: expect.objectContaining({ id: "event-group-2" }),
      }),
    ]);
    expect(model.eventsRequiringDecision).toEqual([
      expect.objectContaining({
        event: expect.objectContaining({ id: "event-group-1" }),
        pendingRequestCount: 1,
        missingPeople: 4,
      }),
    ]);
  });
});
