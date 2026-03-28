import { describe, expect, it } from "vitest";
import { parseIcalBusyIntervals } from "./ical";

describe("parseIcalBusyIntervals", () => {
  it("keeps only future blocking intervals and ignores event details", () => {
    const rawCalendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260310T080000Z
DTEND:20260310T090000Z
SUMMARY:Past event
END:VEVENT
BEGIN:VEVENT
DTSTART:20260310T090000Z
DTEND:20260310T110000Z
SUMMARY:Current event
END:VEVENT
BEGIN:VEVENT
DTSTART:20260310T120000Z
DTEND:20260310T130000Z
SUMMARY:Transparent event
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
DTSTART:20260310T140000Z
DTEND:20260310T150000Z
SUMMARY:Cancelled event
STATUS:CANCELLED
END:VEVENT
BEGIN:VEVENT
DTSTART:20260312T080000Z
DTEND:20260312T100000Z
SUMMARY:Recurring event
RRULE:FREQ=DAILY;COUNT=2
END:VEVENT
END:VCALENDAR`;

    const intervals = parseIcalBusyIntervals({
      provider: "google",
      sourceLabel: "feed-1",
      rawCalendar,
      rangeStart: new Date("2026-03-10T10:30:00.000Z"),
      rangeEnd: new Date("2026-03-13T18:00:00.000Z"),
    });

    expect(intervals).toEqual([
      {
        startsAt: "2026-03-10T10:30:00.000Z",
        endsAt: "2026-03-10T11:00:00.000Z",
        source: "ical",
        sourceLabel: "google:feed-1",
      },
      {
        startsAt: "2026-03-12T08:00:00.000Z",
        endsAt: "2026-03-12T10:00:00.000Z",
        source: "ical",
        sourceLabel: "google:feed-1",
      },
      {
        startsAt: "2026-03-13T08:00:00.000Z",
        endsAt: "2026-03-13T10:00:00.000Z",
        source: "ical",
        sourceLabel: "google:feed-1",
      },
    ]);
  });
});
