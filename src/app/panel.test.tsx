import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { describe, expect, it } from "vitest";
import {
  EnrollmentRequestDecisionButtons,
  EnrollmentRequestSlimRow,
  splitGroupsByArchivedStatus,
  splitEnrollmentRequestsByIntent,
} from "./pages/panel";
import type { EnrollmentRequest, Group, TrainingEvent } from "@/domain/types";

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
