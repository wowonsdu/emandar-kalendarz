import type {
  AppRole,
  DecisionStatus,
  EmandarBrandStatus,
  EnrollmentFinalStatus,
  TrainerOrganizerRelation,
  TrainingEventStatus,
  TrainingEvent,
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

export function sortEventsByDate(events: TrainingEvent[]) {
  return [...events].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
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
    default:
      return role;
  }
}
