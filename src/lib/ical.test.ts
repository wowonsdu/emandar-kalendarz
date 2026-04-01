import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTrainerFreeDaySlices } from "@/domain/utils";
import { parseIcalBusyIntervals, serializeBusyIntervalsToIcal } from "./ical";

const DEMO_ICAL_PATH = resolve(process.cwd(), "public/demo-ical/marcin-free-slots-demo.ics");

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

  it("round-trips the demo calendar through parser and exporter without changing busy intervals", () => {
    const rawCalendar = readFileSync(DEMO_ICAL_PATH, "utf8");
    const rangeStart = new Date("2026-03-29T00:00:00.000Z");
    const rangeEnd = new Date("2028-01-01T00:00:00.000Z");
    const parsed = parseIcalBusyIntervals({
      provider: "ical",
      sourceLabel: "demo-feed",
      rawCalendar,
      rangeStart,
      rangeEnd,
    });
    const exported = serializeBusyIntervalsToIcal({
      intervals: parsed,
      calendarName: "Roundtrip Demo Export",
    });
    const reparsed = parseIcalBusyIntervals({
      provider: "ical",
      sourceLabel: "roundtrip-export",
      rawCalendar: exported,
      rangeStart,
      rangeEnd,
    });

    expect(
      reparsed.map(({ startsAt, endsAt, source }) => ({
        startsAt,
        endsAt,
        source,
      })),
    ).toEqual(
      parsed.map(({ startsAt, endsAt, source }) => ({
        startsAt,
        endsAt,
        source,
      })),
    );
  });

  it("keeps only the planned 1-7 day and >7 day free windows in the demo calendar", () => {
    const rawCalendar = readFileSync(DEMO_ICAL_PATH, "utf8");
    const intervals = parseIcalBusyIntervals({
      provider: "ical",
      sourceLabel: "demo-feed",
      rawCalendar,
      rangeStart: new Date("2026-03-29T00:00:00.000Z"),
      rangeEnd: new Date("2028-01-01T00:00:00.000Z"),
    });
    const slices = buildTrainerFreeDaySlices({
      busyIntervals: intervals,
      rangeStart: "2026-03-29T00:00:00.000Z",
      rangeEnd: "2028-01-01T00:00:00.000Z",
      minimumDurationHours: 1,
    });

    expect(
      slices.map((slice) => ({
        dayKey: slice.dayKey,
        spanBucket: slice.spanBucket,
        durationHours: slice.durationHours,
      })),
    ).toEqual([
      { dayKey: "2026-04-14", spanBucket: "1-day", durationHours: 24 },
      { dayKey: "2026-05-09", spanBucket: "2-days", durationHours: 24 },
      { dayKey: "2026-05-10", spanBucket: "2-days", durationHours: 24 },
      { dayKey: "2026-06-27", spanBucket: "3-days", durationHours: 24 },
      { dayKey: "2026-06-28", spanBucket: "3-days", durationHours: 24 },
      { dayKey: "2026-06-29", spanBucket: "3-days", durationHours: 24 },
      { dayKey: "2026-08-01", spanBucket: "4-days", durationHours: 24 },
      { dayKey: "2026-08-02", spanBucket: "4-days", durationHours: 24 },
      { dayKey: "2026-08-03", spanBucket: "4-days", durationHours: 24 },
      { dayKey: "2026-08-04", spanBucket: "4-days", durationHours: 24 },
      { dayKey: "2026-09-10", spanBucket: "5-days", durationHours: 24 },
      { dayKey: "2026-09-11", spanBucket: "5-days", durationHours: 24 },
      { dayKey: "2026-09-12", spanBucket: "5-days", durationHours: 24 },
      { dayKey: "2026-09-13", spanBucket: "5-days", durationHours: 24 },
      { dayKey: "2026-09-14", spanBucket: "5-days", durationHours: 24 },
      { dayKey: "2026-10-20", spanBucket: "6-days", durationHours: 24 },
      { dayKey: "2026-10-21", spanBucket: "6-days", durationHours: 24 },
      { dayKey: "2026-10-22", spanBucket: "6-days", durationHours: 24 },
      { dayKey: "2026-10-23", spanBucket: "6-days", durationHours: 24 },
      { dayKey: "2026-10-24", spanBucket: "6-days", durationHours: 24 },
      { dayKey: "2026-10-25", spanBucket: "6-days", durationHours: 24 },
      { dayKey: "2026-12-01", spanBucket: "7-days", durationHours: 24 },
      { dayKey: "2026-12-02", spanBucket: "7-days", durationHours: 24 },
      { dayKey: "2026-12-03", spanBucket: "7-days", durationHours: 24 },
      { dayKey: "2026-12-04", spanBucket: "7-days", durationHours: 24 },
      { dayKey: "2026-12-05", spanBucket: "7-days", durationHours: 24 },
      { dayKey: "2026-12-06", spanBucket: "7-days", durationHours: 24 },
      { dayKey: "2026-12-07", spanBucket: "7-days", durationHours: 24 },
      { dayKey: "2027-03-01", spanBucket: "more-than-7-days", durationHours: 24 },
      { dayKey: "2027-03-02", spanBucket: "more-than-7-days", durationHours: 24 },
      { dayKey: "2027-03-03", spanBucket: "more-than-7-days", durationHours: 24 },
      { dayKey: "2027-03-04", spanBucket: "more-than-7-days", durationHours: 24 },
      { dayKey: "2027-03-05", spanBucket: "more-than-7-days", durationHours: 24 },
      { dayKey: "2027-03-06", spanBucket: "more-than-7-days", durationHours: 24 },
      { dayKey: "2027-03-07", spanBucket: "more-than-7-days", durationHours: 24 },
      { dayKey: "2027-03-08", spanBucket: "more-than-7-days", durationHours: 24 },
      { dayKey: "2027-03-09", spanBucket: "more-than-7-days", durationHours: 24 },
    ]);
  });
});
