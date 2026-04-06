import {
  getHighestRole,
  isTrainingEventArchived,
  resolveEnrollmentIntent,
  resolveParticipantEnrollmentStatus,
} from "@/domain/utils";
import type {
  AppUser,
  DemoStore,
  EnrollmentRequest,
  EnrollmentFinalStatus,
  EventParticipant,
  Group,
  OrganizerProfile,
  TrainerProfile,
  TrainingEvent,
} from "@/domain/types";

export type DashboardPerspective = "participant" | "organizer" | "trainer";

export type ParticipantGroupEventRecord = {
  kind: "roster";
  eventParticipant: EventParticipant;
  event: TrainingEvent;
  trainer?: TrainerProfile;
  organizer?: OrganizerProfile | null;
  group?: Group | null;
  isArchived: boolean;
};

export type ParticipantPendingEnrollmentRequestRecord = {
  kind: "request";
  request: EnrollmentRequest;
  event: TrainingEvent;
  trainer?: TrainerProfile;
  organizer?: OrganizerProfile | null;
  group?: Group | null;
  isArchived: boolean;
  displayStatus: EnrollmentFinalStatus;
};

export type ParticipantEnrollmentViewRecord =
  | ParticipantGroupEventRecord
  | ParticipantPendingEnrollmentRequestRecord;

export type ParticipantDashboardUpcomingItem = {
  id: string;
  event: TrainingEvent;
  groupName: string;
  daysUntil: number;
  kind: ParticipantEnrollmentViewRecord["kind"];
  statusLabel: string;
};

export type ParticipantDashboardConfirmationItem = {
  id: string;
  token: string;
  event: TrainingEvent;
  groupName: string;
};

export type ParticipantDashboardModel = {
  activeEnrollmentCount: number;
  archivedEnrollmentCount: number;
  pendingJoinRequestCount: number;
  upcomingItems: ParticipantDashboardUpcomingItem[];
  pendingConfirmationItems: ParticipantDashboardConfirmationItem[];
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export function getDashboardPerspectives(
  user: Pick<AppUser, "role" | "roles" | "primaryRole"> | null | undefined,
): DashboardPerspective[] {
  const highestRole = getHighestRole(user);

  if (highestRole === "trainer") {
    return ["trainer", "organizer", "participant"];
  }

  if (highestRole === "organizer") {
    return ["organizer", "participant"];
  }

  return ["participant"];
}
export function getParticipantDashboardGroupLabel(
  event: Pick<TrainingEvent, "groupName">,
  group?: Pick<Group, "name"> | null,
) {
  return group?.name ?? event.groupName ?? "Bez przypisanej grupy";
}

function isEventFinished(event: Pick<TrainingEvent, "startsAt" | "endsAt" | "scheduleDays">, now: Date) {
  const lastScheduleDay = [...event.scheduleDays]
    .sort((left, right) => new Date(right.endsAt).getTime() - new Date(left.endsAt).getTime())[0];
  const endsAt = lastScheduleDay?.endsAt ?? event.endsAt;
  return new Date(endsAt).getTime() < now.getTime();
}

function isParticipantGroupEventArchived(
  eventParticipant: EventParticipant,
  event: TrainingEvent,
  now: Date,
) {
  return (
    eventParticipant.status === "declined" ||
    eventParticipant.status === "removed" ||
    isTrainingEventArchived(event) ||
    isEventFinished(event, now)
  );
}

function isParticipantPendingEnrollmentArchived(
  request: Pick<EnrollmentRequest, "participantStatus" | "finalStatus">,
  event: TrainingEvent,
  now: Date,
) {
  return (
    resolveParticipantEnrollmentStatus(request.participantStatus) === "cancelled" ||
    request.finalStatus === "rejected" ||
    isTrainingEventArchived(event) ||
    isEventFinished(event, now)
  );
}

function getParticipantEnrollmentRecordGroup(
  event: TrainingEvent,
  store: DemoStore,
) {
  return event.groupId ? store.groups?.find((item) => item.id === event.groupId) ?? null : null;
}

function getParticipantRequestRecordStatusLabel(status: EnrollmentFinalStatus) {
  switch (status) {
    case "accepted":
      return "Przyjete";
    case "partial":
      return "Czesciowe";
    case "rejected":
      return "Odrzucone";
    default:
      return "Oczekujace";
  }
}

function getParticipantRosterRecordStatusLabel(status: EventParticipant["status"]) {
  switch (status) {
    case "confirmed":
      return "Potwierdzone";
    case "declined":
      return "Odrzucone";
    case "removed":
      return "Usuniete";
    default:
      return "Zaproszenie";
  }
}

function hasParticipantRosterRecord(
  request: Pick<EnrollmentRequest, "eventId" | "eventParticipantId" | "participantProfileId">,
  store: DemoStore,
) {
  if (request.eventParticipantId) {
    return store.eventParticipants.some((item) => item.id === request.eventParticipantId);
  }

  if (!request.participantProfileId) {
    return false;
  }

  return store.eventParticipants.some(
    (item) =>
      item.eventId === request.eventId &&
      item.participantProfileId === request.participantProfileId,
  );
}

export function getParticipantGroupEventRecords(
  participantProfileId: string,
  store: DemoStore,
  now: Date = new Date(),
): ParticipantGroupEventRecord[] {
  return [...(store.eventParticipants ?? [])]
    .filter((eventParticipant) => eventParticipant.participantProfileId === participantProfileId)
    .map((eventParticipant) => {
      const event = store.trainingEvents.find((item) => item.id === eventParticipant.eventId);
      if (!event) {
        return null;
      }

      return {
        kind: "roster",
        eventParticipant,
        event,
        trainer: store.trainers.find((item) => item.id === event.trainerId),
        organizer: event.organizerId
          ? store.organizers.find((item) => item.id === event.organizerId) ?? null
          : null,
        group: event.groupId ? store.groups?.find((item) => item.id === event.groupId) ?? null : null,
        isArchived: isParticipantGroupEventArchived(eventParticipant, event, now),
      };
    })
    .filter((item): item is ParticipantGroupEventRecord => Boolean(item))
    .sort(
      (left, right) =>
        new Date(left.event.startsAt).getTime() - new Date(right.event.startsAt).getTime(),
    );
}

export function getParticipantPendingEnrollmentRequestRecords(
  {
    participantProfileId,
    userId,
    store,
    now = new Date(),
  }: {
    participantProfileId?: string | null;
    userId?: string | null;
    store: DemoStore;
    now?: Date;
  },
): ParticipantPendingEnrollmentRequestRecord[] {
  if (!participantProfileId && !userId) {
    return [];
  }

  return [...(store.enrollmentRequests ?? [])]
    .filter((request) => {
      const matchesParticipant =
        (participantProfileId && request.participantProfileId === participantProfileId) ||
        (userId && request.submitterUid === userId);
      if (!matchesParticipant) {
        return false;
      }

      if (resolveEnrollmentIntent(request.intent) !== "participating") {
        return false;
      }

      if (resolveParticipantEnrollmentStatus(request.participantStatus) === "cancelled") {
        return false;
      }

      if (request.finalStatus === "rejected") {
        return false;
      }

      if (hasParticipantRosterRecord(request, store)) {
        return false;
      }

      return true;
    })
    .map((request) => {
      const event = store.trainingEvents.find((item) => item.id === request.eventId);
      if (!event) {
        return null;
      }

      return {
        kind: "request",
        request,
        event,
        trainer: store.trainers.find((item) => item.id === event.trainerId),
        organizer: event.organizerId
          ? store.organizers.find((item) => item.id === event.organizerId) ?? null
          : null,
        group: getParticipantEnrollmentRecordGroup(event, store),
        isArchived: isParticipantPendingEnrollmentArchived(request, event, now),
        displayStatus: request.finalStatus,
      };
    })
    .filter((item): item is ParticipantPendingEnrollmentRequestRecord => Boolean(item))
    .sort(
      (left, right) =>
        new Date(left.event.startsAt).getTime() - new Date(right.event.startsAt).getTime(),
    );
}

export function getParticipantEnrollmentViewRecords({
  participantProfileId,
  userId,
  store,
  now = new Date(),
}: {
  participantProfileId?: string | null;
  userId?: string | null;
  store: DemoStore;
  now?: Date;
}) {
  const participantGroupRecords = participantProfileId
    ? getParticipantGroupEventRecords(participantProfileId, store, now)
    : [];
  const participantPendingRequestRecords = getParticipantPendingEnrollmentRequestRecords({
    participantProfileId,
    userId,
    store,
    now,
  });

  return [...participantPendingRequestRecords, ...participantGroupRecords].sort(
    (left, right) =>
      new Date(left.event.startsAt).getTime() - new Date(right.event.startsAt).getTime(),
  );
}

function getDaysUntil(startsAt: string, now: Date) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const eventDay = new Date(startsAt);
  eventDay.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((eventDay.getTime() - today.getTime()) / DAY_IN_MS));
}

export function getParticipantDashboardModel({
  userId,
  participantProfileId,
  store,
  now = new Date(),
}: {
  userId?: string | null;
  participantProfileId?: string | null;
  store: DemoStore;
  now?: Date;
}): ParticipantDashboardModel {
  const participantEnrollmentRecords = getParticipantEnrollmentViewRecords({
    participantProfileId,
    userId,
    store,
    now,
  });
  const activeParticipantRecords = participantEnrollmentRecords.filter((record) => !record.isArchived);
  const archivedParticipantRecords = participantEnrollmentRecords.filter((record) => record.isArchived);
  const participantGroupRecords = participantProfileId
    ? getParticipantGroupEventRecords(participantProfileId, store, now)
    : [];
  const activeGroupRecords = participantGroupRecords.filter((record) => !record.isArchived);
  const sortedActiveGroupRecords = [...activeGroupRecords].sort(
    (left, right) =>
      new Date(left.event.startsAt).getTime() - new Date(right.event.startsAt).getTime(),
  );
  const sortedActiveParticipantRecords = [...activeParticipantRecords].sort(
    (left, right) =>
      new Date(left.event.startsAt).getTime() - new Date(right.event.startsAt).getTime(),
  );
  const pendingJoinRequestCount = activeParticipantRecords.filter(
    (record) => record.kind === "request" && record.displayStatus === "pending",
  ).length;

  return {
    activeEnrollmentCount: activeParticipantRecords.length,
    archivedEnrollmentCount: archivedParticipantRecords.length,
    pendingJoinRequestCount,
    upcomingItems: sortedActiveParticipantRecords.slice(0, 2).map((record) => ({
      id: record.kind === "request" ? record.request.id : record.eventParticipant.id,
      event: record.event,
      groupName: getParticipantDashboardGroupLabel(record.event, record.group),
      daysUntil: getDaysUntil(record.event.startsAt, now),
      kind: record.kind,
      statusLabel:
        record.kind === "request"
          ? getParticipantRequestRecordStatusLabel(record.displayStatus)
          : getParticipantRosterRecordStatusLabel(record.eventParticipant.status),
    })),
    pendingConfirmationItems: sortedActiveGroupRecords
      .filter((record) => record.eventParticipant.attendanceConfirmationStatus === "pending")
      .map((record) => ({
        id: record.eventParticipant.id,
        token: record.eventParticipant.id,
        event: record.event,
        groupName: getParticipantDashboardGroupLabel(record.event, record.group),
      })),
  };
}
