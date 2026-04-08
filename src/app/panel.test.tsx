import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { describe, expect, it } from "vitest";
import {
  AcceptedRequestGroupDialogBody,
  buildEnrollmentRequestTransferOptions,
  createAcceptedRequestGroupDialogDraft,
  EnrollmentRequestManagementActions,
  EnrollmentRequestDecisionButtons,
  EnrollmentRequestSlimRow,
  OrganizerRelationsHubSection,
  splitGroupsByArchivedStatus,
  splitEnrollmentRequestsByIntent,
} from "./pages/panel";
import type {
  AppUser,
  DemoStore,
  EnrollmentRequest,
  Group,
  TrainerOrganizerRelation,
  TrainerProfile,
  TrainingEvent,
} from "@/domain/types";

function createEnrollmentRequest(
  overrides: Partial<EnrollmentRequest> = {},
): EnrollmentRequest {
  return {
    id: "request-1",
    eventId: "event-1",
    participantProfileId: "participant-1",
    imieNazwisko: "Jan Test",
    telefon: "500600700",
    polecenieOdKogo: "",
    wiadomosc: "",
    photoStatus: "pending",
    finalStatus: "pending",
    createdAt: "2026-04-01T09:00:00.000Z",
    ...overrides,
  };
}

function createTrainingEvent(overrides: Partial<TrainingEvent> = {}): TrainingEvent {
  return {
    id: "event-1",
    trainerId: "trainer-1",
    organizerId: "organizer-1",
    groupId: null,
    groupName: null,
    title: "Wydarzenie",
    summary: "Opis",
    description: "Opis",
    type: "Szkolenie",
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
    brandStatus: "official",
    publicationApprovalStatus: "accepted",
    status: "active",
    ...overrides,
  };
}

function createGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: "group-1",
    name: "Grupa testowa",
    organizerId: "organizer-1",
    trainerId: "trainer-1",
    status: "active",
    defaultEventType: "training",
    defaultConfirmationLeadTimeDays: 7,
    defaultJoinAudience: "new-people",
    createdAt: "2026-04-01T09:00:00.000Z",
    ...overrides,
  };
}

function createTrainer(overrides: Partial<TrainerProfile> = {}): TrainerProfile {
  return {
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
    ...overrides,
  };
}

function createRelation(
  overrides: Partial<TrainerOrganizerRelation> = {},
): TrainerOrganizerRelation {
  return {
    id: "relation-1",
    trainerId: "trainer-1",
    organizerId: "organizer-1",
    trainerUserId: "user-trainer-1",
    organizerUserId: "user-organizer-1",
    status: "approved",
    requestedBy: "organizer",
    createdAt: "2026-04-01T09:00:00.000Z",
    ...overrides,
  };
}

function createUser(overrides: Partial<AppUser> = {}): AppUser {
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

function createStore(overrides: Partial<DemoStore> = {}): DemoStore {
  return {
    users: [],
    trainers: [],
    organizers: [],
    participantProfiles: [],
    groups: [],
    groupMembers: [],
    eventParticipants: [],
    relations: [],
    trainingEvents: [],
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
    ...overrides,
  };
}

describe("EnrollmentRequestSlimRow", () => {
  it("links community events to the community management view", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/panel/zgloszenia">
        <EnrollmentRequestSlimRow
          request={createEnrollmentRequest()}
          event={createTrainingEvent({
            id: "event-community",
            title: "Wydarzenie społeczności",
            brandStatus: "supported",
          })}
          eventGroup={null}
          isExpanded={false}
          onExpandedChange={() => {}}
        >
          <div>Details</div>
        </EnrollmentRequestSlimRow>
      </StaticRouter>,
    );

    expect(markup).toContain('href="/panel/wydarzenia-spolecznosci/event-community"');
    expect(markup).toContain("Wydarzenie społeczności");
  });

  it("links official events to the training management view", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/panel/zgloszenia">
        <EnrollmentRequestSlimRow
          request={createEnrollmentRequest()}
          event={createTrainingEvent({
            id: "event-official",
            groupName: "Grupa Poranna",
            brandStatus: "official",
          })}
          eventGroup={null}
          isExpanded={false}
          onExpandedChange={() => {}}
        >
          <div>Details</div>
        </EnrollmentRequestSlimRow>
      </StaticRouter>,
    );

    expect(markup).toContain('href="/panel/szkolenia/event-official"');
    expect(markup).toContain("Grupa Poranna");
  });

  it("renders participant name on a full-width row", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/panel/zgloszenia">
        <EnrollmentRequestSlimRow
          request={createEnrollmentRequest({
            imieNazwisko: "Grzegorz Emanowicz Testowy",
          })}
          event={createTrainingEvent()}
          eventGroup={null}
          isExpanded={false}
          onExpandedChange={() => {}}
        >
          <div>Details</div>
        </EnrollmentRequestSlimRow>
      </StaticRouter>,
    );

    expect(markup).toContain("col-span-2");
    expect(markup).toContain("Grzegorz Emanowicz Testowy");
  });

  it("uses stacked edge rounding for the first item", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/panel/zgloszenia">
        <EnrollmentRequestSlimRow
          request={createEnrollmentRequest()}
          event={createTrainingEvent()}
          eventGroup={null}
          isExpanded={false}
          onExpandedChange={() => {}}
          itemPosition="first"
        >
          <div>Details</div>
        </EnrollmentRequestSlimRow>
      </StaticRouter>,
    );

    expect(markup).toContain("rounded-t-[1.75rem]");
  });

  it("uses full rounding for a single stacked item", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/panel/zgloszenia">
        <EnrollmentRequestSlimRow
          request={createEnrollmentRequest()}
          event={createTrainingEvent()}
          eventGroup={null}
          isExpanded={false}
          onExpandedChange={() => {}}
          itemPosition="single"
        >
          <div>Details</div>
        </EnrollmentRequestSlimRow>
      </StaticRouter>,
    );

    expect(markup).toContain("rounded-[1.75rem]");
  });
});

describe("accepted request group dialog", () => {
  it("starts with regular priority, empty notes and sync disabled", () => {
    expect(createAcceptedRequestGroupDialogDraft()).toEqual({
      priority: "regularni",
      notes: "",
      syncFutureEvents: false,
    });
  });

  it("renders rank dropdown, notes field and sync option when future events exist", () => {
    const markup = renderToStaticMarkup(
      <AcceptedRequestGroupDialogBody
        draft={createAcceptedRequestGroupDialogDraft()}
        futureOpenGroupEventsCount={3}
        onCancel={() => {}}
        onDraftChange={() => {}}
        onSubmit={(event) => event.preventDefault()}
      />,
    );

    expect(markup).toContain("Ranga w grupie");
    expect(markup).toContain("Notatki");
    expect(markup).toContain("Dodaj też automatycznie do 3 przyszłych otwartych");
    expect(markup).toContain('option value="regularni" selected');
  });

  it("hides sync option when there are no future group events", () => {
    const markup = renderToStaticMarkup(
      <AcceptedRequestGroupDialogBody
        draft={createAcceptedRequestGroupDialogDraft()}
        futureOpenGroupEventsCount={0}
        onCancel={() => {}}
        onDraftChange={() => {}}
        onSubmit={(event) => event.preventDefault()}
      />,
    );

    expect(markup).not.toContain("Dodaj też automatycznie");
  });
});

describe("splitEnrollmentRequestsByIntent", () => {
  it("splits requests into active, confirmed, and rejected sections", () => {
    const sections = splitEnrollmentRequestsByIntent([
      createEnrollmentRequest({
        id: "request-pending",
        createdAt: "2026-04-01T09:00:00.000Z",
        finalStatus: "pending",
      }),
      createEnrollmentRequest({
        id: "request-accepted",
        createdAt: "2026-04-01T10:00:00.000Z",
        finalStatus: "accepted",
      }),
      createEnrollmentRequest({
        id: "request-rejected",
        createdAt: "2026-04-01T11:00:00.000Z",
        finalStatus: "rejected",
      }),
    ]);

    expect(sections.map((section) => section.key)).toEqual(["active", "confirmed", "rejected"]);
    expect(sections.find((section) => section.key === "active")?.requests.map((item) => item.id)).toEqual([
      "request-pending",
    ]);
    expect(
      sections.find((section) => section.key === "confirmed")?.requests.map((item) => item.id),
    ).toEqual(["request-accepted"]);
    expect(
      sections.find((section) => section.key === "rejected")?.requests.map((item) => item.id),
    ).toEqual(["request-rejected"]);
  });

  it("omits the rejected section when there are no rejected requests", () => {
    const sections = splitEnrollmentRequestsByIntent([
      createEnrollmentRequest({
        id: "request-pending",
        finalStatus: "pending",
      }),
      createEnrollmentRequest({
        id: "request-accepted",
        finalStatus: "accepted",
      }),
    ]);

    expect(sections.some((section) => section.key === "rejected")).toBe(false);
  });

  it("omits requests transferred away by staff", () => {
    const sections = splitEnrollmentRequestsByIntent([
      createEnrollmentRequest({
        id: "request-transferred",
        finalStatus: "pending",
        participantStatus: "cancelled",
        participantActionSource: "staff",
      }),
      createEnrollmentRequest({
        id: "request-pending",
        finalStatus: "pending",
      }),
    ]);

    expect(sections.find((section) => section.key === "active")?.requests.map((item) => item.id)).toEqual([
      "request-pending",
    ]);
  });
});

describe("EnrollmentRequestDecisionButtons", () => {
  it("shows both actions for pending requests", () => {
    const markup = renderToStaticMarkup(
      <EnrollmentRequestDecisionButtons finalStatus="pending" onDecision={() => {}} />,
    );

    expect(markup).toContain("Odrzuć");
    expect(markup).toContain("Potwierdź");
  });

  it("shows only reject for confirmed requests", () => {
    const markup = renderToStaticMarkup(
      <EnrollmentRequestDecisionButtons finalStatus="accepted" onDecision={() => {}} />,
    );

    expect(markup).toContain("Odrzuć");
    expect(markup).not.toContain("Potwierdź");
  });

  it("shows only confirm for rejected requests", () => {
    const markup = renderToStaticMarkup(
      <EnrollmentRequestDecisionButtons finalStatus="rejected" onDecision={() => {}} />,
    );

    expect(markup).toContain("Potwierdź");
    expect(markup).not.toContain("Odrzuć");
  });
});

describe("EnrollmentRequestManagementActions", () => {
  it("replaces confirm with transfer when a target event is selected", () => {
    const markup = renderToStaticMarkup(
      <EnrollmentRequestManagementActions
        finalStatus="pending"
        transferTargetEventId="event-target"
        onDecision={() => {}}
        onTransfer={() => {}}
      />,
    );

    expect(markup).toContain("Odrzuć");
    expect(markup).toContain("Przenieś");
    expect(markup).not.toContain("Potwierdź");
  });
});

describe("buildEnrollmentRequestTransferOptions", () => {
  it("builds official options with group, date, and location and skips community targets", () => {
    const actor = createUser();
    const sourceEvent = createTrainingEvent({
      id: "event-source",
      groupId: "group-1",
      groupName: "EnergyTeam x1",
      organizerUserId: "user-organizer-1",
      trainerUserId: "user-trainer-1",
      startsAt: "2099-04-10T10:00:00.000Z",
      endsAt: "2099-04-10T12:00:00.000Z",
    });
    const store = createStore({
      trainingEvents: [
        sourceEvent,
        createTrainingEvent({
          id: "event-official-target",
          groupId: "group-2",
          groupName: "Centralna praktyka",
          location: "Łódź",
          startsAt: "2099-04-12T10:00:00.000Z",
          endsAt: "2099-04-12T12:00:00.000Z",
          enrolledCount: 3,
          capacity: 10,
          isPublished: true,
        }),
        createTrainingEvent({
          id: "event-community-target",
          title: "Wieczór społeczności",
          brandStatus: "supported",
          groupId: null,
          groupName: null,
          isPublished: true,
          organizerId: "organizer-1",
        }),
      ],
      groups: [
        createGroup({ id: "group-1", name: "EnergyTeam x1", organizerUserId: "user-organizer-1" }),
        createGroup({ id: "group-2", name: "Centralna praktyka", organizerUserId: "user-organizer-1" }),
      ],
    });

    const options = buildEnrollmentRequestTransferOptions({
      currentUser: actor,
      event: sourceEvent,
      store,
    });

    expect(options).toEqual([
      expect.objectContaining({
        id: "event-official-target",
        label: expect.stringContaining("Centralna praktyka"),
      }),
    ]);
    expect(options[0]?.label).toContain("Łódź");
  });

  it("limits community transfer options to future events of the same organizer", () => {
    const actor = createUser();
    const sourceEvent = createTrainingEvent({
      id: "event-community-source",
      title: "Spotkanie z Olą",
      brandStatus: "supported",
      groupId: null,
      groupName: null,
      organizerId: "organizer-1",
      organizerUserId: "user-organizer-1",
      isPublished: true,
      startsAt: "2099-04-10T10:00:00.000Z",
      endsAt: "2099-04-10T12:00:00.000Z",
    });
    const store = createStore({
      trainingEvents: [
        sourceEvent,
        createTrainingEvent({
          id: "event-community-target",
          title: "Kolejne spotkanie",
          brandStatus: "supported",
          groupId: null,
          groupName: null,
          organizerId: "organizer-1",
          organizerUserId: "user-organizer-1",
          isPublished: true,
          startsAt: "2099-04-12T10:00:00.000Z",
          endsAt: "2099-04-12T12:00:00.000Z",
          location: "Łosice",
        }),
        createTrainingEvent({
          id: "event-community-other-organizer",
          title: "Obce spotkanie",
          brandStatus: "supported",
          groupId: null,
          groupName: null,
          organizerId: "organizer-2",
          organizerUserId: "user-organizer-2",
          isPublished: true,
          startsAt: "2099-04-13T10:00:00.000Z",
          endsAt: "2099-04-13T12:00:00.000Z",
        }),
      ],
    });

    const options = buildEnrollmentRequestTransferOptions({
      currentUser: actor,
      event: sourceEvent,
      store,
    });

    expect(options).toEqual([
      expect.objectContaining({
        id: "event-community-target",
        label: expect.stringContaining("Kolejne spotkanie"),
      }),
    ]);
    expect(options[0]?.label).toContain("Łosice");
  });
});

describe("splitGroupsByArchivedStatus", () => {
  it("separates active groups from archived ones", () => {
    const result = splitGroupsByArchivedStatus([
      createGroup({ id: "group-active", status: "active" }),
      createGroup({ id: "group-archived", status: "archived" }),
    ]);

    expect(result.active.map((group) => group.id)).toEqual(["group-active"]);
    expect(result.archived.map((group) => group.id)).toEqual(["group-archived"]);
  });
});

describe("OrganizerRelationsHubSection", () => {
  it("renders one trainer section with connected and unconnected cards", () => {
    const activeRelation = createRelation({
      id: "relation-jacek",
      trainerId: "trainer-1",
      createdAt: "2026-04-01T09:00:00.000Z",
    });
    const markup = renderToStaticMarkup(
      <OrganizerRelationsHubSection
        activeRelations={[activeRelation]}
        availableTrainers={[
          createTrainer({ id: "trainer-1", displayName: "Jacek" }),
          createTrainer({
            id: "trainer-2",
            userId: "user-trainer-2",
            slug: "marcin",
            displayName: "Marcin",
          }),
        ]}
        organizerFunctionsAreBlocked={false}
        onConnectTrainer={async () => undefined}
        onDetachRelation={async () => undefined}
        trainerNamesById={
          new Map([
            ["trainer-1", "Jacek"],
            ["trainer-2", "Marcin"],
          ])
        }
      />,
    );

    expect(markup).toContain("Przekazujący wiedzę");
    expect(markup).toContain("od 1 kwietnia 2026");
    expect(markup).toContain("Kliknij, by połączyć");
    expect(markup).not.toContain(">Połącz<");
    expect(markup).not.toContain("Moi przekazujący wiedzę");
    expect(markup).not.toContain("Wybierz przekazującego wiedzę");
  });
});
