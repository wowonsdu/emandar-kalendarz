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
  const jcalData = ICAL.parse(rawCalendar);
  const component = new ICAL.Component(jcalData);
  const vevents = component.getAllSubcomponents("vevent");
  const busyIntervals: ExternalBusyInterval[] = [];

  vevents.forEach((vevent) => {
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
