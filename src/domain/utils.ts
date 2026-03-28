import type {
  AppUser,
  AppRole,
  DecisionStatus,
  EmandarBrandStatus,
  ExternalBusyInterval,
  EventCollaborationStatus,
  EnrollmentFinalStatus,
  EnrollmentRequest,
  OrganizerProfile,
  ParticipantEnrollmentStatus,
  SharedAvailabilityWindow,
  TrainerFreeDaySlice,
  TrainerFreeDaySliceBucket,
  TrainingEventScheduleDay,
  TrainerOrganizerRelation,
  TrainingEventStatus,
  TrainingEvent,
  TrainerProfile,
} from "./types";

export function deriveEnrollmentFinalStatus(
  trainerDecision: DecisionStatus,
  organizerDecision: DecisionStatus,
  requiresOrganizerApproval = true,
): EnrollmentFinalStatus {
  if (!requiresOrganizerApproval) {
    if (trainerDecision === "rejected") {
      return "rejected";
    }

    if (trainerDecision === "accepted") {
      return "accepted";
    }

    return "pending";
  }

  if (trainerDecision === "rejected" || organizerDecision === "rejected") {
    return "rejected";
  }

  if (trainerDecision === "accepted" && organizerDecision === "accepted") {
    return "accepted";
  }

  if (trainerDecision === "accepted" || organizerDecision === "accepted") {
    return "partial";
  }

  return "pending";
}

export function resolveParticipantEnrollmentStatus(
  value: ParticipantEnrollmentStatus | null | undefined,
): ParticipantEnrollmentStatus {
  return value === "cancelled" ? "cancelled" : "active";
}

export function isParticipantEnrollmentActive(
  request: Pick<EnrollmentRequest, "participantStatus" | "finalStatus">,
) {
  return (
    resolveParticipantEnrollmentStatus(request.participantStatus) === "active" &&
    request.finalStatus !== "rejected"
  );
}

export function getParticipantEnrollmentStatusLabel(
  request: Pick<EnrollmentRequest, "participantStatus" | "finalStatus">,
) {
  if (resolveParticipantEnrollmentStatus(request.participantStatus) === "cancelled") {
    return "zrezygnowano";
  }

  switch (request.finalStatus) {
    case "accepted":
      return "przyjęte";
    case "partial":
      return "częściowo przyjęte";
    case "rejected":
      return "odrzucone";
    default:
      return "oczekuje";
  }
}

export function canOrganizerAccessTrainer(
  organizerId: string,
  trainerId: string,
  relations: TrainerOrganizerRelation[],
) {
  return relations.some(
    (relation) =>
      relation.organizerId === organizerId &&
      relation.trainerId === trainerId &&
      relation.status === "approved",
  );
}

export function isTrainingEventArchived(
  event: Pick<TrainingEvent, "archivedAt">,
) {
  return Boolean(event.archivedAt);
}

export function resolveTrainerCollaborationStatus(
  event: Pick<
    TrainingEvent,
    "brandStatus" | "trainerCollaborationStatus"
  >,
): EventCollaborationStatus {
  if (event.trainerCollaborationStatus) {
    return event.trainerCollaborationStatus;
  }

  return "accepted";
}

export function resolveOrganizerCollaborationStatus(
  event: Pick<
    TrainingEvent,
    "brandStatus" | "organizerId" | "organizerCollaborationStatus" | "selfManagedByTrainer"
  >,
): EventCollaborationStatus {
  if (event.organizerCollaborationStatus) {
    return event.organizerCollaborationStatus;
  }

  if (
    isCommunityBrandStatus(event.brandStatus) ||
    event.selfManagedByTrainer ||
    !event.organizerId
  ) {
    return "not-required";
  }

  return "accepted";
}

export function isSelfManagedTrainingEvent(
  event: Pick<TrainingEvent, "brandStatus" | "selfManagedByTrainer" | "organizerId">,
) {
  return isCommunityBrandStatus(event.brandStatus) || event.selfManagedByTrainer || !event.organizerId;
}

export function isTrainingEventCollaborationAccepted(
  event: Pick<
    TrainingEvent,
    | "brandStatus"
    | "organizerId"
    | "trainerCollaborationStatus"
    | "organizerCollaborationStatus"
    | "selfManagedByTrainer"
  >,
) {
  if (isSelfManagedTrainingEvent(event)) {
    return true;
  }

  return (
    resolveTrainerCollaborationStatus(event) === "accepted" &&
    resolveOrganizerCollaborationStatus(event) === "accepted"
  );
}

export function isTrainingEventPubliclyVisible(
  event: Pick<
    TrainingEvent,
    | "archivedAt"
    | "brandStatus"
    | "isPublished"
    | "organizerCollaborationStatus"
    | "organizerId"
    | "publicationApprovalStatus"
    | "selfManagedByTrainer"
    | "trainerCollaborationStatus"
  >,
) {
  if (!event.isPublished || isTrainingEventArchived(event)) {
    return false;
  }

  if (isCommunityBrandStatus(event.brandStatus)) {
    return event.publicationApprovalStatus === "accepted";
  }

  return isTrainingEventCollaborationAccepted(event);
}

export function canManageTrainingEvent(
  event: Pick<
    TrainingEvent,
    | "brandStatus"
    | "archivedAt"
    | "creatorUserId"
    | "createdByRole"
    | "organizerId"
    | "selfManagedByTrainer"
    | "trainerCollaborationStatus"
    | "organizerCollaborationStatus"
    | "trainerId"
  >,
  actor: Pick<AppUser, "id" | "role" | "trainerProfileId" | "organizerProfileId">,
) {
  if (actor.role === "admin") {
    return true;
  }

  if (actor.role === "organizer" && isTrainingEventArchived(event)) {
    return false;
  }

  if (actor.role === "trainer" && actor.trainerProfileId === event.trainerId) {
    return (
      isSelfManagedTrainingEvent(event) ||
      resolveTrainerCollaborationStatus(event) === "accepted" ||
      event.createdByRole === "trainer"
    );
  }

  if (
    actor.role === "organizer" &&
    actor.organizerProfileId === event.organizerId
  ) {
    return (
      resolveOrganizerCollaborationStatus(event) === "accepted" ||
      event.createdByRole === "organizer"
    );
  }

  if (actor.role === "participant" && actor.id === event.creatorUserId) {
    return true;
  }

  return false;
}

export function canDecideTrainingEventCollaboration(
  event: Pick<
    TrainingEvent,
    | "archivedAt"
    | "organizerId"
    | "organizerCollaborationStatus"
    | "trainerCollaborationStatus"
    | "trainerId"
  >,
  actor: Pick<AppUser, "role" | "trainerProfileId" | "organizerProfileId">,
) {
  if (isTrainingEventArchived(event)) {
    return false;
  }

  if (actor.role === "admin") {
    return true;
  }

  if (actor.role === "trainer" && actor.trainerProfileId === event.trainerId) {
    return resolveTrainerCollaborationStatus(event) === "pending";
  }

  if (
    actor.role === "organizer" &&
    actor.organizerProfileId === event.organizerId
  ) {
    return resolveOrganizerCollaborationStatus(event) === "pending";
  }

  return false;
}

export function getEventCollaborationStatusLabel(status: EventCollaborationStatus) {
  switch (status) {
    case "accepted":
      return "zaakceptowana";
    case "rejected":
      return "odrzucona";
    case "not-required":
      return "niepotrzebna";
    default:
      return "oczekuje";
  }
}

export function sortEventsByDate(events: TrainingEvent[]) {
  return [...events].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
}

export function sortTrainerProfiles(trainers: TrainerProfile[]) {
  return [...trainers].sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.displayName.localeCompare(right.displayName, "pl");
  });
}

export function getTrainingEventScheduleDays(
  event: Pick<TrainingEvent, "startsAt" | "endsAt" | "scheduleDays">,
) {
  const scheduleDays = Array.isArray(event.scheduleDays)
    ? event.scheduleDays
    : [{ startsAt: event.startsAt, endsAt: event.endsAt }];

  return [...scheduleDays]
    .filter((day) => Boolean(day.startsAt) && Boolean(day.endsAt))
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
}

export function getTrainingEventScheduleBounds(
  event: Pick<TrainingEvent, "startsAt" | "endsAt" | "scheduleDays">,
) {
  const days = getTrainingEventScheduleDays(event);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  return {
    startsAt: firstDay?.startsAt ?? event.startsAt,
    endsAt: lastDay?.endsAt ?? event.endsAt,
    dayCount: days.length,
  };
}

export function getAvailablePlaces(
  event: Pick<TrainingEvent, "capacity" | "enrolledCount">,
) {
  return Math.max(event.capacity - event.enrolledCount, 0);
}

export function getEventFillRate(
  event: Pick<TrainingEvent, "capacity" | "enrolledCount">,
) {
  if (event.capacity <= 0) {
    return 0;
  }

  return Math.round((Math.min(event.enrolledCount, event.capacity) / event.capacity) * 1000) / 10;
}

export function aggregateEventCapacityStats(events: TrainingEvent[]) {
  return events.reduce(
    (summary, event) => ({
      eventCount: summary.eventCount + 1,
      totalCapacity: summary.totalCapacity + event.capacity,
      totalRemainingPlaces: summary.totalRemainingPlaces + getAvailablePlaces(event),
    }),
    {
      eventCount: 0,
      totalCapacity: 0,
      totalRemainingPlaces: 0,
    },
  );
}

export function sortEventsByFillRate(events: TrainingEvent[]) {
  return [...events].sort((left, right) => {
    const fillRateDifference = getEventFillRate(right) - getEventFillRate(left);

    if (fillRateDifference !== 0) {
      return fillRateDifference;
    }

    return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
  });
}

export function resolveBrandStatus(
  status: EmandarBrandStatus | undefined | null,
): EmandarBrandStatus {
  return status === "supported" ? "supported" : "official";
}

export function isCommunityBrandStatus(
  status: EmandarBrandStatus | undefined | null,
) {
  return resolveBrandStatus(status) === "supported";
}

export function resolveTrainingEventStatus(
  status: TrainingEventStatus | undefined | null,
): TrainingEventStatus {
  if (status === "confirmed" || status === "cancelled") {
    return status;
  }

  return "active";
}

export function getTrainingEventStatusLabel(
  status: TrainingEventStatus | undefined | null,
) {
  switch (resolveTrainingEventStatus(status)) {
    case "confirmed":
      return "Potwierdzone zorganizowanie";
    case "cancelled":
      return "Anulowane";
    default:
      return "Aktywne";
  }
}

export function resolveMinimumParticipants(event: Pick<TrainingEvent, "minimumParticipants" | "capacity">) {
  const minimumParticipants = event.minimumParticipants ?? 0;
  return Math.max(1, Math.min(event.capacity, minimumParticipants || event.capacity));
}

export function getRoleLabel(role: AppRole) {
  switch (role) {
    case "admin":
      return "Admin";
    case "trainer":
      return "Przekazujący Wiedzę";
    case "organizer":
      return "Organizator";
    case "participant":
      return "Uczestnik";
    default:
      return role;
  }
}

export function isEnrollmentPhotoRequiredForEvent(
  event: Pick<TrainingEvent, "enrollmentPhotoRequirement" | "organizerId">,
  trainer: Pick<TrainerProfile, "defaultEnrollmentPhotoRequired"> | undefined,
  organizer: Pick<OrganizerProfile, "defaultEnrollmentPhotoRequired"> | undefined,
) {
  if (event.enrollmentPhotoRequirement === "required") {
    return true;
  }

  if (event.enrollmentPhotoRequirement === "optional") {
    return false;
  }

  if (event.organizerId) {
    return organizer?.defaultEnrollmentPhotoRequired === true;
  }

  return trainer?.defaultEnrollmentPhotoRequired === true;
}

export function hasRole(
  user: Pick<AppUser, "role" | "roles" | "primaryRole"> | null | undefined,
  role: AppRole,
) {
  if (!user) {
    return false;
  }

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles.includes(role);
  }

  return (user.primaryRole ?? user.role) === role || user.role === role;
}

export function requireTrainerProfileId(
  user: Pick<AppUser, "trainerProfileId"> | null | undefined,
) {
  const trainerProfileId = user?.trainerProfileId?.trim();

  if (!trainerProfileId) {
    throw new Error("Konto nie ma aktywnego profilu Przekazującego Wiedzę.");
  }

  return trainerProfileId;
}

export function requireOrganizerProfileId(
  user: Pick<AppUser, "organizerProfileId"> | null | undefined,
) {
  const organizerProfileId = user?.organizerProfileId?.trim();

  if (!organizerProfileId) {
    throw new Error("Konto nie ma aktywnego profilu organizatora.");
  }

  return organizerProfileId;
}

function toTimestamp(value: string) {
  return new Date(value).getTime();
}

function toIso(value: number) {
  return new Date(value).toISOString();
}

function roundUpToHour(timestamp: number) {
  const date = new Date(timestamp);
  date.setUTCMinutes(0, 0, 0);

  if (date.getTime() < timestamp) {
    date.setUTCHours(date.getUTCHours() + 1);
  }

  return date.getTime();
}

function roundDownToHour(timestamp: number) {
  const date = new Date(timestamp);
  date.setUTCMinutes(0, 0, 0);
  return date.getTime();
}

function getUtcDayStart(timestamp: number) {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function getNextUtcDayStart(timestamp: number) {
  const date = new Date(timestamp);
  date.setUTCHours(24, 0, 0, 0);
  return date.getTime();
}

function getTrainerFreeDaySliceBucket(spanDays: number): TrainerFreeDaySliceBucket {
  if (spanDays <= 1) {
    return "1-day";
  }

  if (spanDays === 2) {
    return "2-days";
  }

  if (spanDays === 3) {
    return "3-days";
  }

  return "4-plus-days";
}

export function mergeBusyIntervals(intervals: ExternalBusyInterval[]) {
  const sortedIntervals = [...intervals]
    .filter((interval) => toTimestamp(interval.endsAt) > toTimestamp(interval.startsAt))
    .sort((left, right) => toTimestamp(left.startsAt) - toTimestamp(right.startsAt));

  return sortedIntervals.reduce<ExternalBusyInterval[]>((merged, interval) => {
    const previous = merged[merged.length - 1];

    if (!previous) {
      merged.push({ ...interval });
      return merged;
    }

    if (toTimestamp(interval.startsAt) <= toTimestamp(previous.endsAt)) {
      previous.endsAt =
        toTimestamp(interval.endsAt) > toTimestamp(previous.endsAt)
          ? interval.endsAt
          : previous.endsAt;
      previous.sourceLabel = previous.sourceLabel ?? interval.sourceLabel;
      return merged;
    }

    merged.push({ ...interval });
    return merged;
  }, []);
}

export function buildSharedAvailabilityWindows({
  trainerIds,
  busyIntervalsByTrainer,
  rangeStart,
  rangeEnd,
  minimumDurationHours = 1,
}: {
  trainerIds: string[];
  busyIntervalsByTrainer: Record<string, ExternalBusyInterval[]>;
  rangeStart: string;
  rangeEnd: string;
  minimumDurationHours?: number;
}) {
  const uniqueTrainerIds = Array.from(new Set(trainerIds.filter(Boolean)));

  if (uniqueTrainerIds.length === 0) {
    return [] satisfies SharedAvailabilityWindow[];
  }

  const rangeStartTimestamp = roundUpToHour(toTimestamp(rangeStart));
  const rangeEndTimestamp = roundDownToHour(toTimestamp(rangeEnd));
  const minimumDurationMs = Math.max(1, minimumDurationHours) * 60 * 60 * 1000;

  if (rangeEndTimestamp <= rangeStartTimestamp) {
    return [] satisfies SharedAvailabilityWindow[];
  }

  const mergedBusyIntervalsByTrainer = Object.fromEntries(
    uniqueTrainerIds.map((trainerId) => {
      const clippedIntervals = (busyIntervalsByTrainer[trainerId] ?? [])
        .map((interval) => {
          const startsAt = Math.max(toTimestamp(interval.startsAt), rangeStartTimestamp);
          const endsAt = Math.min(toTimestamp(interval.endsAt), rangeEndTimestamp);

          return {
            ...interval,
            startsAt: toIso(startsAt),
            endsAt: toIso(endsAt),
          };
        })
        .filter((interval) => toTimestamp(interval.endsAt) > toTimestamp(interval.startsAt));

      return [trainerId, mergeBusyIntervals(clippedIntervals)];
    }),
  ) as Record<string, ExternalBusyInterval[]>;

  const boundaries = Array.from(
    new Set(
      [
        rangeStartTimestamp,
        rangeEndTimestamp,
        ...Object.values(mergedBusyIntervalsByTrainer).flatMap((intervals) =>
          intervals.flatMap((interval) => [
            toTimestamp(interval.startsAt),
            toTimestamp(interval.endsAt),
          ]),
        ),
      ]
        .filter((value) => value >= rangeStartTimestamp && value <= rangeEndTimestamp)
        .sort((left, right) => left - right),
    ),
  );

  const rawWindows: SharedAvailabilityWindow[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const segmentStart = boundaries[index];
    const segmentEnd = boundaries[index + 1];

    if (!segmentStart || !segmentEnd || segmentEnd <= segmentStart) {
      continue;
    }

    const roundedStart = roundUpToHour(segmentStart);
    const roundedEnd = roundDownToHour(segmentEnd);

    if (roundedEnd <= roundedStart || roundedEnd - roundedStart < minimumDurationMs) {
      continue;
    }

    const availableTrainerIds = uniqueTrainerIds.filter((trainerId) => {
      const busyIntervals = mergedBusyIntervalsByTrainer[trainerId] ?? [];

      return !busyIntervals.some(
        (interval) =>
          roundedStart < toTimestamp(interval.endsAt) &&
          roundedEnd > toTimestamp(interval.startsAt),
      );
    });

    if (availableTrainerIds.length === 0) {
      continue;
    }

    const missingTrainerIds = uniqueTrainerIds.filter(
      (trainerId) => !availableTrainerIds.includes(trainerId),
    );

    rawWindows.push({
      startsAt: toIso(roundedStart),
      endsAt: toIso(roundedEnd),
      durationHours: Math.round(((roundedEnd - roundedStart) / (60 * 60 * 1000)) * 10) / 10,
      availableTrainerIds,
      missingTrainerIds,
      availableCount: availableTrainerIds.length,
      isFullMatch: availableTrainerIds.length === uniqueTrainerIds.length,
    });
  }

  const mergedWindows = rawWindows.reduce<SharedAvailabilityWindow[]>((windows, window) => {
    const previous = windows[windows.length - 1];

    if (
      previous &&
      previous.endsAt === window.startsAt &&
      previous.availableTrainerIds.join("|") === window.availableTrainerIds.join("|") &&
      previous.missingTrainerIds.join("|") === window.missingTrainerIds.join("|")
    ) {
      previous.endsAt = window.endsAt;
      previous.durationHours =
        Math.round(
          ((toTimestamp(previous.endsAt) - toTimestamp(previous.startsAt)) /
            (60 * 60 * 1000)) *
            10,
        ) / 10;
      previous.availableCount = previous.availableTrainerIds.length;
      previous.isFullMatch = previous.availableCount === uniqueTrainerIds.length;
      return windows;
    }

    windows.push({ ...window });
    return windows;
  }, []);

  return mergedWindows.sort((left, right) => {
    if (right.availableCount !== left.availableCount) {
      return right.availableCount - left.availableCount;
    }

    if (right.durationHours !== left.durationHours) {
      return right.durationHours - left.durationHours;
    }

    return toTimestamp(left.startsAt) - toTimestamp(right.startsAt);
  });
}

export function buildTrainerFreeDaySlices({
  busyIntervals,
  rangeStart,
  rangeEnd,
  minimumDurationHours = 1,
}: {
  busyIntervals: ExternalBusyInterval[];
  rangeStart: string;
  rangeEnd: string;
  minimumDurationHours?: number;
}) {
  const rangeStartTimestamp = roundUpToHour(toTimestamp(rangeStart));
  const rangeEndTimestamp = roundDownToHour(toTimestamp(rangeEnd));
  const minimumDurationMs = Math.max(1, minimumDurationHours) * 60 * 60 * 1000;

  if (rangeEndTimestamp <= rangeStartTimestamp) {
    return [] satisfies TrainerFreeDaySlice[];
  }

  const mergedBusyIntervals = mergeBusyIntervals(
    busyIntervals
      .map((interval) => {
        const startsAt = Math.max(toTimestamp(interval.startsAt), rangeStartTimestamp);
        const endsAt = Math.min(toTimestamp(interval.endsAt), rangeEndTimestamp);

        return {
          ...interval,
          startsAt: toIso(startsAt),
          endsAt: toIso(endsAt),
        };
      })
      .filter((interval) => toTimestamp(interval.endsAt) > toTimestamp(interval.startsAt)),
  );

  const freeWindows: Array<{ startsAt: number; endsAt: number }> = [];
  let cursor = rangeStartTimestamp;

  mergedBusyIntervals.forEach((interval) => {
    const intervalStart = toTimestamp(interval.startsAt);
    const intervalEnd = toTimestamp(interval.endsAt);

    if (intervalStart > cursor) {
      freeWindows.push({
        startsAt: cursor,
        endsAt: intervalStart,
      });
    }

    if (intervalEnd > cursor) {
      cursor = intervalEnd;
    }
  });

  if (cursor < rangeEndTimestamp) {
    freeWindows.push({
      startsAt: cursor,
      endsAt: rangeEndTimestamp,
    });
  }

  return freeWindows.flatMap((window) => {
    if (window.endsAt - window.startsAt < minimumDurationMs) {
      return [];
    }

    const spanDays =
      Math.floor(
        (getUtcDayStart(window.endsAt - 1) - getUtcDayStart(window.startsAt)) /
          (24 * 60 * 60 * 1000),
      ) + 1;
    const spanBucket = getTrainerFreeDaySliceBucket(spanDays);
    const slices: TrainerFreeDaySlice[] = [];
    let sliceStart = window.startsAt;

    while (sliceStart < window.endsAt) {
      const sliceEnd = Math.min(window.endsAt, getNextUtcDayStart(sliceStart));

      if (sliceEnd - sliceStart >= minimumDurationMs) {
        slices.push({
          startsAt: toIso(sliceStart),
          endsAt: toIso(sliceEnd),
          dayKey: toIso(getUtcDayStart(sliceStart)).slice(0, 10),
          durationHours:
            Math.round(((sliceEnd - sliceStart) / (60 * 60 * 1000)) * 10) / 10,
          spanStartsAt: toIso(window.startsAt),
          spanEndsAt: toIso(window.endsAt),
          spanDays,
          spanBucket,
        });
      }

      sliceStart = sliceEnd;
    }

    return slices;
  });
}
