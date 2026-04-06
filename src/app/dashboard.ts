import {
  getHighestRole,
  isParticipantEnrollmentActive,
  isTrainingEventArchived,
} from "@/domain/utils";
import type {
  AppUser,
  DemoStore,
  EnrollmentRequest,
  EventParticipant,
  Group,
  OrganizerProfile,
  TrainerProfile,
  TrainingEvent,
} from "@/domain/types";

export type DashboardPerspective = "participant" | "organizer" | "trainer";

export type ParticipantEnrollmentRecord = {
  request: EnrollmentRequest;
  event: TrainingEvent;
  trainer?: TrainerProfile;
  organizer?: OrganizerProfile | null;
  isArchived: boolean;
};

export type ParticipantGroupEventRecord = {
  eventParticipant: EventParticipant;
  event: TrainingEvent;
  trainer?: TrainerProfile;
  organizer?: OrganizerProfile | null;
  group?: Group | null;
  isArchived: boolean;
};

export type ParticipantDashboardUpcomingItem = {
  id: string;
  event: TrainingEvent;
  groupName: string;
  daysUntil: number;
  source: "request" | "group";
};

export type ParticipantDashboardConfirmationItem = {
  id: string;
  token: string;
  event: TrainingEvent;
  groupName: string;
  source: "request" | "group";
};

export type ParticipantDashboardModel = {
  activeEnrollmentCount: number;
  archivedEnrollmentCount: number;
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

export function isSyncedGroupEnrollmentRecord(record: ParticipantEnrollmentRecord) {
  return Boolean(record.event.groupId && record.request.eventParticipantId);
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

function isParticipantEnrollmentArchived(
  request: EnrollmentRequest,
  event: TrainingEvent,
  now: Date,
) {
  return (
    !isParticipantEnrollmentActive(request) ||
    isTrainingEventArchived(event) ||
    isEventFinished(event, now)
  );
}

export function getParticipantEnrollmentRecords(
  currentUserId: string,
  store: DemoStore,
  now: Date = new Date(),
): ParticipantEnrollmentRecord[] {
  return [...store.enrollmentRequests]
    .filter((request) => request.submitterUid === currentUserId)
    .map((request) => {
      const event = store.trainingEvents.find((item) => item.id === request.eventId);
      if (!event) {
        return null;
      }

      return {
        request,
        event,
        trainer: store.trainers.find((item) => item.id === event.trainerId),
        organizer: event.organizerId
          ? store.organizers.find((item) => item.id === event.organizerId) ?? null
          : null,
        isArchived: isParticipantEnrollmentArchived(request, event, now),
      };
    })
    .filter((item): item is ParticipantEnrollmentRecord => Boolean(item))
    .sort(
      (left, right) =>
        new Date(left.event.startsAt).getTime() - new Date(right.event.startsAt).getTime(),
    );
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

function getDaysUntil(startsAt: string, now: Date) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const eventDay = new Date(startsAt);
  eventDay.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((eventDay.getTime() - today.getTime()) / DAY_IN_MS));
}

export function getParticipantDashboardModel({
  currentUserId,
  participantProfileId,
  store,
  now = new Date(),
}: {
  currentUserId: string;
  participantProfileId?: string | null;
  store: DemoStore;
  now?: Date;
}): ParticipantDashboardModel {
  const participantRecords = getParticipantEnrollmentRecords(currentUserId, store, now);
  const participantGroupRecords = participantProfileId
    ? getParticipantGroupEventRecords(participantProfileId, store, now)
    : [];

  const visibleLegacyRecords = participantRecords.filter(
    (record) => !isSyncedGroupEnrollmentRecord(record),
  );
  const activeLegacyRecords = visibleLegacyRecords.filter((record) => !record.isArchived);
  const archivedLegacyRecords = visibleLegacyRecords.filter((record) => record.isArchived);
  const activeGroupRecords = participantGroupRecords.filter((record) => !record.isArchived);
  const archivedGroupRecords = participantGroupRecords.filter((record) => record.isArchived);

  const combinedActiveRecords = [
    ...activeLegacyRecords.map((record) => ({ source: "request" as const, record })),
    ...activeGroupRecords.map((record) => ({ source: "group" as const, record })),
  ].sort(
    (left, right) =>
      new Date(left.record.event.startsAt).getTime() - new Date(right.record.event.startsAt).getTime(),
  );

  return {
    activeEnrollmentCount: activeLegacyRecords.length + activeGroupRecords.length,
    archivedEnrollmentCount: archivedLegacyRecords.length + archivedGroupRecords.length,
    upcomingItems: combinedActiveRecords.slice(0, 2).map((item) => ({
      id: item.source === "request" ? item.record.request.id : item.record.eventParticipant.id,
      event: item.record.event,
      groupName:
        item.source === "request"
          ? getParticipantDashboardGroupLabel(item.record.event)
          : getParticipantDashboardGroupLabel(item.record.event, item.record.group),
      daysUntil: getDaysUntil(item.record.event.startsAt, now),
      source: item.source,
    })),
    pendingConfirmationItems: combinedActiveRecords
      .filter((item) =>
        item.source === "request"
          ? item.record.request.attendanceConfirmationStatus === "pending"
          : item.record.eventParticipant.attendanceConfirmationStatus === "pending",
      )
      .map((item) => ({
        id: item.source === "request" ? item.record.request.id : item.record.eventParticipant.id,
        token: item.source === "request" ? item.record.request.id : item.record.eventParticipant.id,
        event: item.record.event,
        groupName:
          item.source === "request"
            ? getParticipantDashboardGroupLabel(item.record.event)
            : getParticipantDashboardGroupLabel(item.record.event, item.record.group),
        source: item.source,
      })),
  };
}
