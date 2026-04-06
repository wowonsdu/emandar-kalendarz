import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { EnrollmentRequestSlimRow } from "./pages/panel";
import type { EnrollmentRequest, TrainingEvent } from "@/domain/types";

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
