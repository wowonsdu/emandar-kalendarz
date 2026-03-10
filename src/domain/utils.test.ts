import { describe, expect, it } from "vitest";
import {
  aggregateEventCapacityStats,
  canOrganizerAccessTrainer,
  deriveEnrollmentFinalStatus,
  getAvailablePlaces,
  getEventFillRate,
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

describe("permissions and sorting", () => {
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
});
