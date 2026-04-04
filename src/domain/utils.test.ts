import { describe, expect, it } from "vitest";
import {
  aggregateEventCapacityStats,
  buildGoogleCalendarSubscribeUrl,
  buildSharedAvailabilityWindows,
  buildTrainerFreeDaySlices,
  canPublishTrainingEvent,
  canDecideTrainingEventCollaboration,
  canManageTrainingEvent,
  canOrganizerAccessTrainer,
  doesTrainingEventOverlapRange,
  doIntervalsOverlap,
  deriveEnrollmentFinalStatus,
  getEnrollmentIntentLabel,
  getEventCollaborationStatusLabel,
  getAvailablePlaces,
  getEventFillRate,
  getParticipantEnrollmentStatusLabel,
  getTrainingEventScheduleBounds,
  getTrainingEventScheduleDays,
  getTrainingEventWorkflowStatusLabel,
  isPhotoModeEnabled,
  isPhotoModeRequired,
  isParticipantEnrollmentActive,
  isOrganizerTrainingDraftEditable,
  isOrganizerTrainingDraftWithdrawable,
  isTrainerSharedSlotActive,
  isTrainingEventArchived,
  isTrainingEventCollaborationAccepted,
  isTrainingEventPubliclyVisible,
  resolveEnrollmentPhotoModeForEvent,
  resolveEnrollmentIntent,
  resolvePhotoMode,
  resolveOrganizerCollaborationStatus,
  resolveParticipantEnrollmentStatus,
  resolveTrainingEventWorkflowStatus,
  sortEventsByFillRate,
  sortEventsByDate,
} from "./utils";

describe("deriveEnrollmentFinalStatus", () => {
  it("returns accepted only after both approvals", () => {
    expect(deriveEnrollmentFinalStatus("accepted", "accepted")).toBe(
      "accepted",
    );
  });

  it("returns rejected when any side rejects", () => {
    expect(deriveEnrollmentFinalStatus("rejected", "accepted")).toBe(
      "rejected",
    );
  });

  it("returns partial when only one side accepted", () => {
    expect(deriveEnrollmentFinalStatus("accepted", "pending")).toBe("partial");
  });

  it("returns trainer decision only for community events", () => {
    expect(deriveEnrollmentFinalStatus("accepted", "pending", false)).toBe(
      "accepted",
    );
  });
});

describe("participant enrollment status", () => {
  it("defaults missing participant status to active", () => {
    expect(resolveParticipantEnrollmentStatus(undefined)).toBe("active");
  });

  it("treats cancelled enrollment as inactive regardless of review status", () => {
    expect(
      isParticipantEnrollmentActive({
        participantStatus: "cancelled",
        finalStatus: "accepted",
      }),
    ).toBe(false);
    expect(
      getParticipantEnrollmentStatusLabel({
        participantStatus: "cancelled",
        finalStatus: "accepted",
      }),
    ).toBe("zrezygnowano");
  });

  it("treats rejected enrollment as archived even without participant cancellation", () => {
    expect(
      isParticipantEnrollmentActive({
        participantStatus: "active",
        finalStatus: "rejected",
      }),
    ).toBe(false);
    expect(
      getParticipantEnrollmentStatusLabel({
        participantStatus: "active",
        finalStatus: "rejected",
      }),
    ).toBe("odrzucone");
  });
});

describe("enrollment intent", () => {
  it("defaults missing intent to contact", () => {
    expect(resolveEnrollmentIntent(undefined)).toBe("contact");
    expect(getEnrollmentIntentLabel(undefined)).toBe("Proszą o kontakt");
  });

  it("keeps participating intent explicit", () => {
    expect(resolveEnrollmentIntent("participating")).toBe("participating");
    expect(getEnrollmentIntentLabel("participating")).toBe("Biorą udział");
  });
});

describe("photo mode resolution", () => {
  it("normalizes unsupported values to optional by default", () => {
    expect(resolvePhotoMode("required")).toBe("required");
    expect(resolvePhotoMode("disabled")).toBe("disabled");
    expect(resolvePhotoMode("bogus")).toBe("optional");
    expect(resolvePhotoMode(undefined, "disabled")).toBe("disabled");
  });

  it("uses event override before global enrollment setting", () => {
    expect(
      resolveEnrollmentPhotoModeForEvent(
        {
          enrollmentPhotoRequirement: "required",
        },
        {
          enrollmentPhotoMode: "disabled",
        },
      ),
    ).toBe("required");

    expect(
      resolveEnrollmentPhotoModeForEvent(
        {
          enrollmentPhotoRequirement: "optional",
        },
        {
          enrollmentPhotoMode: "required",
        },
      ),
    ).toBe("optional");
  });

  it("falls back to the global enrollment mode when event inherits defaults", () => {
    expect(
      resolveEnrollmentPhotoModeForEvent(
        {
          enrollmentPhotoRequirement: "default",
        },
        {
          enrollmentPhotoMode: "disabled",
        },
      ),
    ).toBe("disabled");
  });

  it("exposes helper booleans for required and enabled states", () => {
    expect(isPhotoModeRequired("required")).toBe(true);
    expect(isPhotoModeRequired("optional")).toBe(false);
    expect(isPhotoModeEnabled("disabled")).toBe(false);
    expect(isPhotoModeEnabled("optional")).toBe(true);
  });
});

describe("permissions and sorting", () => {
  it("allows publishing official trainings without moderation approval", () => {
    expect(
      canPublishTrainingEvent({
        isPublished: false,
        archivedAt: undefined,
        brandStatus: "official",
        publicationApprovalStatus: undefined,
      }),
    ).toBe(true);
  });

  it("keeps moderation approval requirement for community events", () => {
    expect(
      canPublishTrainingEvent({
        isPublished: false,
        archivedAt: undefined,
        brandStatus: "supported",
        publicationApprovalStatus: "pending",
      }),
    ).toBe(false);
    expect(
      canPublishTrainingEvent({
        isPublished: false,
        archivedAt: undefined,
        brandStatus: "supported",
        publicationApprovalStatus: "accepted",
      }),
    ).toBe(true);
  });

  it("allows organizer only with approved relation", () => {
    expect(
      canOrganizerAccessTrainer("organizer-1", "trainer-1", [
        {
          id: "relation-1",
          trainerId: "trainer-1",
          organizerId: "organizer-1",
          status: "approved",
          requestedBy: "organizer",
          createdAt: "2026-03-01T10:00:00.000Z",
        },
      ]),
    ).toBe(true);
  });

  it("sorts events from nearest to latest", () => {
    const sorted = sortEventsByDate([
      {
        id: "2",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        title: "",
        summary: "",
        description: "",
        type: "",
        startsAt: "2026-05-01T10:00:00.000Z",
        endsAt: "2026-05-01T12:00:00.000Z",
        location: "",
        capacity: 10,
        enrolledCount: 0,
        isPublished: true,
        imageHint: "",
        brandStatus: "official",
      },
      {
        id: "1",
        trainerId: "trainer-1",
        organizerId: "organizer-1",
        title: "",
        summary: "",
        description: "",
        type: "",
        startsAt: "2026-04-01T10:00:00.000Z",
        endsAt: "2026-04-01T12:00:00.000Z",
        location: "",
        capacity: 10,
        enrolledCount: 0,
        isPublished: true,
        imageHint: "",
        brandStatus: "official",
      },
    ]);

    expect(sorted[0]?.id).toBe("1");
  });

  it("counts free places and fill rate for community KPI", () => {
    expect(
      getAvailablePlaces({
        capacity: 12,
        enrolledCount: 7,
      }),
    ).toBe(5);

    expect(
      getEventFillRate({
        capacity: 12,
        enrolledCount: 7,
      }),
    ).toBe(58.3);
  });

  it("aggregates capacities for dashboard KPI", () => {
    expect(
      aggregateEventCapacityStats([
        {
          id: "1",
          trainerId: "trainer-1",
          organizerId: null,
          title: "",
          summary: "",
          description: "",
          type: "",
          startsAt: "2026-04-01T10:00:00.000Z",
          endsAt: "2026-04-01T12:00:00.000Z",
          location: "",
          capacity: 10,
          enrolledCount: 10,
          isPublished: true,
          imageHint: "",
          brandStatus: "supported",
          status: "active",
        },
        {
          id: "2",
          trainerId: "trainer-1",
          organizerId: null,
          title: "",
          summary: "",
          description: "",
          type: "",
          startsAt: "2026-05-01T10:00:00.000Z",
          endsAt: "2026-05-01T12:00:00.000Z",
          location: "",
          capacity: 20,
          enrolledCount: 5,
          isPublished: true,
          imageHint: "",
          brandStatus: "supported",
          status: "confirmed",
        },
      ]),
    ).toEqual({
      eventCount: 2,
      totalCapacity: 30,
      totalRemainingPlaces: 15,
    });
  });

  it("sorts by fill rate and then by start date", () => {
    const sorted = sortEventsByFillRate([
      {
        id: "later",
        trainerId: "trainer-1",
        organizerId: null,
        title: "",
        summary: "",
        description: "",
        type: "",
        startsAt: "2026-05-01T10:00:00.000Z",
        endsAt: "2026-05-01T12:00:00.000Z",
        location: "",
        capacity: 10,
        enrolledCount: 5,
        isPublished: true,
        imageHint: "",
        brandStatus: "supported",
        status: "active",
      },
      {
        id: "earlier",
        trainerId: "trainer-1",
        organizerId: null,
        title: "",
        summary: "",
        description: "",
        type: "",
        startsAt: "2026-04-01T10:00:00.000Z",
        endsAt: "2026-04-01T12:00:00.000Z",
        location: "",
        capacity: 20,
        enrolledCount: 10,
        isPublished: true,
        imageHint: "",
        brandStatus: "supported",
        status: "confirmed",
      },
      {
        id: "best",
        trainerId: "trainer-1",
        organizerId: null,
        title: "",
        summary: "",
        description: "",
        type: "",
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T12:00:00.000Z",
        location: "",
        capacity: 10,
        enrolledCount: 9,
        isPublished: true,
        imageHint: "",
        brandStatus: "supported",
        status: "active",
      },
    ]);

    expect(sorted.map((event) => event.id)).toEqual(["best", "earlier", "later"]);
  });

  it("treats self-managed official event as fully accepted", () => {
    expect(
      isTrainingEventCollaborationAccepted({
        trainerId: "trainer-1",
        organizerId: null,
        brandStatus: "official",
        selfManagedByTrainer: true,
      }),
    ).toBe(true);

    expect(
      resolveOrganizerCollaborationStatus({
        organizerId: null,
        brandStatus: "official",
        selfManagedByTrainer: true,
      }),
    ).toBe("not-required");
  });

  it("shows admin-approved community event publicly even when legacy collaboration is pending", () => {
    expect(
      isTrainingEventPubliclyVisible({
        archivedAt: null,
        brandStatus: "supported",
        isPublished: true,
        organizerId: null,
        organizerCollaborationStatus: "not-required",
        publicationApprovalStatus: "accepted",
        selfManagedByTrainer: true,
        trainerCollaborationStatus: "pending",
      }),
    ).toBe(true);
  });

  it("hides community event until admin approval is accepted", () => {
    expect(
      isTrainingEventPubliclyVisible({
        archivedAt: null,
        brandStatus: "supported",
        isPublished: true,
        organizerId: null,
        organizerCollaborationStatus: "not-required",
        publicationApprovalStatus: "pending",
        selfManagedByTrainer: true,
        trainerCollaborationStatus: "accepted",
      }),
    ).toBe(false);
  });

  it("allows creator to manage pending shared event and invited side only to decide", () => {
    const event = {
      trainerId: "trainer-1",
      organizerId: "organizer-1",
      brandStatus: "official" as const,
      trainerCollaborationStatus: "accepted" as const,
      organizerCollaborationStatus: "pending" as const,
      createdByRole: "trainer" as const,
    };

    expect(
      canManageTrainingEvent(event, {
        role: "trainer",
        trainerProfileId: "trainer-1",
      }),
    ).toBe(true);

    expect(
      canManageTrainingEvent(event, {
        role: "organizer",
        organizerProfileId: "organizer-1",
      }),
    ).toBe(false);

    expect(
      canDecideTrainingEventCollaboration(event, {
        role: "organizer",
        organizerProfileId: "organizer-1",
      }),
    ).toBe(true);
  });

  it("blocks organizer from archived training while trainer keeps access", () => {
    const event = {
      trainerId: "trainer-1",
      organizerId: "organizer-1",
      brandStatus: "official" as const,
      trainerCollaborationStatus: "accepted" as const,
      organizerCollaborationStatus: "accepted" as const,
      createdByRole: "trainer" as const,
      archivedAt: "2026-03-10T10:00:00.000Z",
    };

    expect(isTrainingEventArchived(event)).toBe(true);
    expect(
      canManageTrainingEvent(event, {
        role: "organizer",
        organizerProfileId: "organizer-1",
      }),
    ).toBe(false);
    expect(
      canManageTrainingEvent(event, {
        role: "trainer",
        trainerProfileId: "trainer-1",
      }),
    ).toBe(true);
    expect(
      canDecideTrainingEventCollaboration(event, {
        role: "organizer",
        organizerProfileId: "organizer-1",
      }),
    ).toBe(false);
  });

  it("keeps organizer permissions on official trainings for higher roles with organizer profile", () => {
    const event = {
      trainerId: "trainer-2",
      organizerId: "organizer-1",
      brandStatus: "official" as const,
      trainerCollaborationStatus: "accepted" as const,
      organizerCollaborationStatus: "accepted" as const,
      createdByRole: "organizer" as const,
    };

    expect(
      canManageTrainingEvent(event, {
        role: "trainer",
        trainerProfileId: "trainer-1",
        organizerProfileId: "organizer-1",
      }),
    ).toBe(true);
  });

  it("lets higher roles decide organizer-side collaboration when they still own organizer profile", () => {
    const event = {
      trainerId: "trainer-2",
      organizerId: "organizer-1",
      organizerCollaborationStatus: "pending" as const,
      trainerCollaborationStatus: "accepted" as const,
    };

    expect(
      canDecideTrainingEventCollaboration(event, {
        role: "trainer",
        organizerProfileId: "organizer-1",
      }),
    ).toBe(true);
  });

  it("returns readable collaboration labels", () => {
    expect(getEventCollaborationStatusLabel("pending")).toBe("oczekuje");
    expect(getEventCollaborationStatusLabel("accepted")).toBe("zaakceptowana");
  });

  it("reads multi-day schedule from new scheduleDays field", () => {
    const event = {
      startsAt: "2026-06-01T13:00:00.000Z",
      endsAt: "2026-06-03T12:00:00.000Z",
      scheduleDays: [
        {
          startsAt: "2026-06-01T13:00:00.000Z",
          endsAt: "2026-06-01T19:00:00.000Z",
        },
        {
          startsAt: "2026-06-02T07:00:00.000Z",
          endsAt: "2026-06-02T12:00:00.000Z",
        },
        {
          startsAt: "2026-06-03T07:00:00.000Z",
          endsAt: "2026-06-03T12:00:00.000Z",
        },
      ],
    };

    expect(getTrainingEventScheduleDays(event)).toHaveLength(3);
    expect(getTrainingEventScheduleBounds(event)).toEqual({
      startsAt: "2026-06-01T13:00:00.000Z",
      endsAt: "2026-06-03T12:00:00.000Z",
      dayCount: 3,
    });
  });

  it("reads schedule days in chronological order", () => {
    const event = {
      startsAt: "2026-05-01T13:00:00.000Z",
      endsAt: "2026-05-02T12:00:00.000Z",
      scheduleDays: [
        {
          startsAt: "2026-05-02T07:00:00.000Z",
          endsAt: "2026-05-02T12:00:00.000Z",
        },
        {
          startsAt: "2026-05-01T13:00:00.000Z",
          endsAt: "2026-05-01T19:00:00.000Z",
        },
      ],
    };

    expect(getTrainingEventScheduleDays(event)).toEqual([
      {
        startsAt: "2026-05-01T13:00:00.000Z",
        endsAt: "2026-05-01T19:00:00.000Z",
      },
      {
        startsAt: "2026-05-02T07:00:00.000Z",
        endsAt: "2026-05-02T12:00:00.000Z",
      },
    ]);
  });

  it("builds shared availability windows for fully shared and partial gaps", () => {
    const windows = buildSharedAvailabilityWindows({
      trainerIds: ["trainer-1", "trainer-2"],
      rangeStart: "2026-03-10T08:00:00.000Z",
      rangeEnd: "2026-03-11T18:00:00.000Z",
      minimumDurationHours: 1,
      busyIntervalsByTrainer: {
        "trainer-1": [
          {
            startsAt: "2026-03-10T09:00:00.000Z",
            endsAt: "2026-03-10T12:00:00.000Z",
            source: "emandar",
          },
          {
            startsAt: "2026-03-10T21:00:00.000Z",
            endsAt: "2026-03-11T15:00:00.000Z",
            source: "ical",
          },
        ],
        "trainer-2": [
          {
            startsAt: "2026-03-10T15:00:00.000Z",
            endsAt: "2026-03-10T18:00:00.000Z",
            source: "emandar",
          },
        ],
      },
    });

    expect(windows[0]).toEqual({
      startsAt: "2026-03-10T12:00:00.000Z",
      endsAt: "2026-03-10T15:00:00.000Z",
      durationHours: 3,
      availableTrainerIds: ["trainer-1", "trainer-2"],
      missingTrainerIds: [],
      availableCount: 2,
      isFullMatch: true,
    });

    expect(windows.some((window) => window.availableCount === 1)).toBe(true);
  });

  it("builds future free day slices grouped by span length", () => {
    const slices = buildTrainerFreeDaySlices({
      rangeStart: "2026-03-10T08:20:00.000Z",
      rangeEnd: "2026-03-16T20:00:00.000Z",
      minimumDurationHours: 1,
      busyIntervals: [
        {
          startsAt: "2026-03-10T09:00:00.000Z",
          endsAt: "2026-03-10T12:00:00.000Z",
          source: "ical",
        },
        {
          startsAt: "2026-03-12T10:00:00.000Z",
          endsAt: "2026-03-12T13:00:00.000Z",
          source: "emandar",
        },
      ],
    });

    expect(slices[0]).toEqual({
      startsAt: "2026-03-10T12:00:00.000Z",
      endsAt: "2026-03-11T00:00:00.000Z",
      dayKey: "2026-03-10",
      durationHours: 12,
      spanStartsAt: "2026-03-10T12:00:00.000Z",
      spanEndsAt: "2026-03-12T10:00:00.000Z",
      spanDays: 3,
      spanBucket: "3-days",
    });

    expect(slices[1]).toMatchObject({
      startsAt: "2026-03-11T00:00:00.000Z",
      endsAt: "2026-03-12T00:00:00.000Z",
      spanDays: 3,
      spanBucket: "3-days",
    });
    expect(slices.some((slice) => slice.spanBucket === "more-than-7-days")).toBe(false);
    expect(
      buildTrainerFreeDaySlices({
        rangeStart: "2026-03-10T00:00:00.000Z",
        rangeEnd: "2026-03-25T00:00:00.000Z",
        minimumDurationHours: 1,
        busyIntervals: [
          {
            startsAt: "2026-03-18T00:00:00.000Z",
            endsAt: "2026-03-18T02:00:00.000Z",
            source: "ical",
          },
        ],
      }).some((slice) => slice.spanBucket === "more-than-7-days"),
    ).toBe(true);
  });
});

describe("draft workflow helpers", () => {
  it("resolves workflow fallback from published and rejected states", () => {
    expect(
      resolveTrainingEventWorkflowStatus({
        isPublished: true,
      }),
    ).toBe("published");

    expect(
      resolveTrainingEventWorkflowStatus({
        isPublished: false,
        trainerDecisionReason: "conflict",
      }),
    ).toBe("trainer-rejected");
  });

  it("allows organizer to edit and withdraw only pending own draft", () => {
    const event = {
      organizerId: "organizer-1",
      workflowStatus: "draft-requested" as const,
    };

    expect(
      isOrganizerTrainingDraftEditable(event, {
        role: "organizer",
        organizerProfileId: "organizer-1",
      }),
    ).toBe(true);

    expect(
      isOrganizerTrainingDraftWithdrawable(event, {
        role: "organizer",
        organizerProfileId: "organizer-1",
      }),
    ).toBe(true);

    expect(
      isOrganizerTrainingDraftEditable(event, {
        role: "trainer",
        organizerProfileId: "organizer-1",
      }),
    ).toBe(true);

    expect(getTrainingEventWorkflowStatusLabel("trainer-accepted")).toBe(
      "zaakceptowany przez trenera",
    );
  });
});

describe("slot and overlap helpers", () => {
  it("marks archived shared slot as inactive", () => {
    expect(
      isTrainerSharedSlotActive({
        status: "active",
      }),
    ).toBe(true);

    expect(
      isTrainerSharedSlotActive({
        status: "archived",
      }),
    ).toBe(false);
  });

  it("detects overlap for interval and event schedule ranges", () => {
    expect(
      doIntervalsOverlap(
        {
          startsAt: "2026-06-01T08:00:00.000Z",
          endsAt: "2026-06-01T12:00:00.000Z",
        },
        {
          startsAt: "2026-06-01T11:00:00.000Z",
          endsAt: "2026-06-01T14:00:00.000Z",
        },
      ),
    ).toBe(true);

    expect(
      doesTrainingEventOverlapRange(
        {
          startsAt: "2026-06-01T08:00:00.000Z",
          endsAt: "2026-06-02T14:00:00.000Z",
          scheduleDays: [
            {
              startsAt: "2026-06-01T08:00:00.000Z",
              endsAt: "2026-06-01T12:00:00.000Z",
            },
            {
              startsAt: "2026-06-02T09:00:00.000Z",
              endsAt: "2026-06-02T14:00:00.000Z",
            },
          ],
        },
        "2026-06-02T10:00:00.000Z",
        "2026-06-02T11:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("builds a Google Calendar subscribe URL", () => {
    expect(
      buildGoogleCalendarSubscribeUrl("https://panel.ceo/emandar/feed.ics"),
    ).toContain(encodeURIComponent("https://panel.ceo/emandar/feed.ics"));
  });
});
