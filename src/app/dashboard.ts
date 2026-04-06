import {
  getHighestRole,
  isTrainingEventArchived,
} from "@/domain/utils";
import type {
  AppUser,
  DemoStore,
  EventParticipant,
  Group,
  OrganizerProfile,
  TrainerProfile,
  TrainingEvent,
} from "@/domain/types";

export type DashboardPerspective = "participant" | "organizer" | "trainer";

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
  participantProfileId,
  store,
  now = new Date(),
}: {
  participantProfileId?: string | null;
  store: DemoStore;
  now?: Date;
}): ParticipantDashboardModel {
  const participantGroupRecords = participantProfileId
    ? getParticipantGroupEventRecords(participantProfileId, store, now)
    : [];

  const activeGroupRecords = participantGroupRecords.filter((record) => !record.isArchived);
  const archivedGroupRecords = participantGroupRecords.filter((record) => record.isArchived);
  const sortedActiveGroupRecords = [...activeGroupRecords].sort(
    (left, right) =>
      new Date(left.event.startsAt).getTime() - new Date(right.event.startsAt).getTime(),
  );

  return {
    activeEnrollmentCount: activeGroupRecords.length,
    archivedEnrollmentCount: archivedGroupRecords.length,
    upcomingItems: sortedActiveGroupRecords.slice(0, 2).map((record) => ({
      id: record.eventParticipant.id,
      event: record.event,
      groupName: getParticipantDashboardGroupLabel(record.event, record.group),
      daysUntil: getDaysUntil(record.event.startsAt, now),
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
