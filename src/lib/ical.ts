import ICAL from "ical.js";
import type { ExternalBusyInterval, TrainerCalendarFeedProvider } from "@/domain/types";

const PROXY_BASE_URL = "https://api.allorigins.win/raw?url=";

function normalizeFeedUrl(url: string) {
  const trimmedUrl = url.trim();

  if (trimmedUrl.startsWith("webcal://")) {
    return `https://${trimmedUrl.slice("webcal://".length)}`;
  }

  return trimmedUrl;
}

function padIcalNumber(value: number) {
  return String(value).padStart(2, "0");
}

function formatUtcTimestamp(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Nie udało się sformatować daty iCal.");
  }

  return [
    date.getUTCFullYear(),
    padIcalNumber(date.getUTCMonth() + 1),
    padIcalNumber(date.getUTCDate()),
    "T",
    padIcalNumber(date.getUTCHours()),
    padIcalNumber(date.getUTCMinutes()),
    padIcalNumber(date.getUTCSeconds()),
    "Z",
  ].join("");
}

function escapeIcalText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

async function fetchCalendarResponse(url: string) {
  const normalizedUrl = normalizeFeedUrl(url);

  try {
    const response = await fetch(normalizedUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (response.ok) {
      return response;
    }
  } catch {
    // Fallback below.
  }

  const proxiedResponse = await fetch(
    `${PROXY_BASE_URL}${encodeURIComponent(normalizedUrl)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!proxiedResponse.ok) {
    throw new Error("Nie udało się pobrać feedu iCal.");
  }

  return proxiedResponse;
}

function clampIntervalToRange(
  startsAt: Date,
  endsAt: Date,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const boundedStart = Math.max(startsAt.getTime(), rangeStart.getTime());
  const boundedEnd = Math.min(endsAt.getTime(), rangeEnd.getTime());

  if (boundedEnd <= boundedStart) {
    return null;
  }

  return {
    startsAt: new Date(boundedStart).toISOString(),
    endsAt: new Date(boundedEnd).toISOString(),
  };
}

function toJsDate(value: ICAL.Time | null) {
  if (!value) {
    return null;
  }

  return value.toJSDate();
}

function getNormalizedPropertyValue(
  vevent: ICAL.Component,
  propertyName: string,
) {
  const value = vevent.getFirstPropertyValue(propertyName);

  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function shouldTreatEventAsBusy(vevent: ICAL.Component) {
  const transparency = getNormalizedPropertyValue(vevent, "transp");
  const status = getNormalizedPropertyValue(vevent, "status");

  return transparency !== "TRANSPARENT" && status !== "CANCELLED";
}

export function parseIcalBusyIntervals({
  provider,
  sourceLabel,
  rawCalendar,
  rangeStart,
  rangeEnd,
}: {
  provider: TrainerCalendarFeedProvider;
  sourceLabel: string;
  rawCalendar: string;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const jcalData = ICAL.parse(rawCalendar);
  const component = new ICAL.Component(jcalData);
  const vevents = component.getAllSubcomponents("vevent");
  const busyIntervals: ExternalBusyInterval[] = [];

  vevents.forEach((vevent) => {
    if (!shouldTreatEventAsBusy(vevent)) {
      return;
    }

    const event = new ICAL.Event(vevent);

    if (!event.startDate) {
      return;
    }

    if (event.isRecurring()) {
      const iterator = event.iterator();
      let occurrence = iterator.next();
      let guard = 0;

      while (occurrence && guard < 5000) {
        guard += 1;
        const details = event.getOccurrenceDetails(occurrence);
        const occurrenceStart = toJsDate(details.startDate);
        const occurrenceEnd = toJsDate(details.endDate);

        if (!occurrenceStart || !occurrenceEnd) {
          occurrence = iterator.next();
          continue;
        }

        if (occurrenceStart > rangeEnd) {
          break;
        }

        const boundedInterval = clampIntervalToRange(
          occurrenceStart,
          occurrenceEnd,
          rangeStart,
          rangeEnd,
        );

        if (boundedInterval) {
          busyIntervals.push({
            ...boundedInterval,
            source: "ical",
            sourceLabel: `${provider}:${sourceLabel}`,
          });
        }

        occurrence = iterator.next();
      }

      return;
    }

    const startsAt = toJsDate(event.startDate);
    const endsAt = toJsDate(event.endDate);

    if (!startsAt || !endsAt) {
      return;
    }

    const boundedInterval = clampIntervalToRange(
      startsAt,
      endsAt,
      rangeStart,
      rangeEnd,
    );

    if (!boundedInterval) {
      return;
    }

    busyIntervals.push({
      ...boundedInterval,
      source: "ical",
      sourceLabel: `${provider}:${sourceLabel}`,
    });
  });

  return busyIntervals;
}

export async function fetchIcalBusyIntervals({
  provider,
  sourceLabel,
  url,
  rangeStart,
  rangeEnd,
}: {
  provider: TrainerCalendarFeedProvider;
  sourceLabel: string;
  url: string;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const response = await fetchCalendarResponse(url);
  const rawCalendar = await response.text();
  return parseIcalBusyIntervals({
    provider,
    sourceLabel,
    rawCalendar,
    rangeStart,
    rangeEnd,
  });
}

export function serializeBusyIntervalsToIcal({
  intervals,
  calendarName,
  prodId = "-//Emandar//Parsed Busy Export//PL",
}: {
  intervals: ExternalBusyInterval[];
  calendarName: string;
  prodId?: string;
}) {
  const dtStamp = formatUtcTimestamp(new Date());
  const sortedIntervals = [...intervals]
    .filter((interval) => new Date(interval.endsAt).getTime() > new Date(interval.startsAt).getTime())
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(calendarName)}`,
    "X-WR-TIMEZONE:UTC",
  ];

  sortedIntervals.forEach((interval, index) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:parsed-busy-${index + 1}-${formatUtcTimestamp(interval.startsAt)}@panel.ceo`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${formatUtcTimestamp(interval.startsAt)}`,
      `DTEND:${formatUtcTimestamp(interval.endsAt)}`,
      `SUMMARY:${escapeIcalText(`Parsed busy block ${index + 1}`)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");

  return `${lines.join("\r\n")}\r\n`;
}
