import type {
  AppSettings,
  AppUser,
  AppRole,
  DecisionStatus,
  DemoStore,
  EmandarBrandStatus,
  EnrollmentIntent,
  EventCollaborationStatus,
  GroupMemberPriority,
  EnrollmentFinalStatus,
  EnrollmentRequest,
  OrganizerProfile,
  ParticipantEnrollmentStatus,
  PhotoMode,
  TrainingJoinAudience,
  TrainingEventScheduleDay,
  TrainingEventWorkflowStatus,
  TrainerOrganizerRelation,
  TrainingEventStatus,
  TrainingEvent,
  TrainerProfile,
} from "./types";

type PrioritizedParticipantRecord = {
  priority: GroupMemberPriority;
  participantDisplayName: string;
};

type CapabilityUser =
  | {
      id?: string;
      role?: AppRole;
      roles?: AppRole[];
      primaryRole?: AppRole;
      trainerProfileId?: string;
      organizerProfileId?: string;
      organizerFunctionsBlockedAt?: string;
    }
  | null
  | undefined;

export const GROUP_MEMBER_PRIORITY_ORDER: Record<GroupMemberPriority, number> = {
  stali: 0,
  regularni: 1,
  rezerwowi: 2,
};

const GROUP_MEMBER_PRIORITY_SECTIONS = [
  "stali",
  "regularni",
  "rezerwowi",
] as const satisfies GroupMemberPriority[];

export function sortParticipantRecordsByPriorityAndName<T extends PrioritizedParticipantRecord>(
  records: T[],
) {
  return [...records].sort((left, right) => {
    const leftRank = GROUP_MEMBER_PRIORITY_ORDER[left.priority];
    const rightRank = GROUP_MEMBER_PRIORITY_ORDER[right.priority];
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.participantDisplayName.localeCompare(right.participantDisplayName, "pl");
  });
}

export function groupParticipantRecordsByPriority<T extends PrioritizedParticipantRecord>(
  records: T[],
) {
  const sortedRecords = sortParticipantRecordsByPriorityAndName(records);

  return GROUP_MEMBER_PRIORITY_SECTIONS.flatMap((priority) => {
    const sectionRecords = sortedRecords.filter((record) => record.priority === priority);
    if (sectionRecords.length === 0) {
      return [];
    }

    return [
      {
        priority,
        records: sectionRecords,
      },
    ];
  });
}

export function deriveEnrollmentFinalStatus(
  decision: DecisionStatus,
): EnrollmentFinalStatus {
  if (decision === "accepted") {
    return "accepted";
  }

  if (decision === "rejected") {
    return "rejected";
  }

  return "pending";
}

export function resolveParticipantEnrollmentStatus(
  value: ParticipantEnrollmentStatus | null | undefined,
): ParticipantEnrollmentStatus {
  return value === "cancelled" ? "cancelled" : "active";
}

export function resolveEnrollmentIntent(
  _value: EnrollmentIntent | null | undefined,
): EnrollmentIntent {
  return "participating";
}

export function getEnrollmentIntentLabel(
  _value: EnrollmentIntent | null | undefined,
) {
  return "Chcę wziąć udział";
}

export function buildPhoneHref(phone: string | null | undefined) {
  const trimmedPhone = phone?.trim();
  if (!trimmedPhone) {
    return null;
  }

  const digitsOnly = trimmedPhone.replace(/\D/g, "");
  if (!digitsOnly) {
    return null;
  }

  return trimmedPhone.startsWith("+") ? `tel:+${digitsOnly}` : `tel:${digitsOnly}`;
}

export function resolveCommunityEventOrganizerPhone(
  event: Pick<TrainingEvent, "brandStatus" | "creatorPhone" | "organizerId" | "organizerUserId">,
  store: Pick<DemoStore, "organizers" | "users">,
) {
  if (!isCommunityBrandStatus(event.brandStatus)) {
    return null;
  }

  const creatorPhone = event.creatorPhone?.trim();
  if (creatorPhone) {
    return creatorPhone;
  }

  const organizerUser = event.organizerUserId
    ? store.users.find((item) => item.id === event.organizerUserId)
    : null;
  const organizerUserPhone = organizerUser?.phone?.trim();
  if (organizerUserPhone) {
    return organizerUserPhone;
  }

  const organizer = event.organizerId
    ? store.organizers.find((item) => item.id === event.organizerId)
    : null;
  const organizerOwner = organizer?.userId
    ? store.users.find((item) => item.id === organizer.userId)
    : null;

  return organizerOwner?.phone?.trim() || null;
}

export function resolveOrganizerProfileVariant(
  organizer: OrganizerProfile | null | undefined,
  variant: "official" | "community",
) {
  if (variant === "community") {
    return {
      displayName:
        organizer?.communityProfile?.displayName?.trim() ||
        organizer?.displayName?.trim() ||
        "",
      description:
        organizer?.communityProfile?.description?.trim() ||
        organizer?.description?.trim() ||
        "",
      contactName:
        organizer?.communityProfile?.contactName?.trim() ||
        organizer?.contactName?.trim() ||
        "",
      location:
        organizer?.communityProfile?.location?.trim() ||
        organizer?.location?.trim() ||
        "",
    };
  }

  return {
    displayName: organizer?.displayName?.trim() || "",
    description: organizer?.description?.trim() || "",
    contactName: organizer?.contactName?.trim() || "",
    location: organizer?.location?.trim() || "",
  };
}

export function resolveEventOwnerDisplayLabels(
  event: Pick<
    TrainingEvent,
    | "brandStatus"
    | "creatorDisplayName"
    | "organizerId"
    | "selfManagedByTrainer"
    | "trainerId"
  >,
  store: Pick<DemoStore, "organizers" | "trainers">,
) {
  const trainer = event.trainerId
    ? store.trainers.find((item) => item.id === event.trainerId) ?? null
    : null;
  const organizer = event.organizerId
    ? store.organizers.find((item) => item.id === event.organizerId) ?? null
    : null;
  const isCommunityEvent = isCommunityBrandStatus(event.brandStatus);
  const organizerDisplay = resolveOrganizerProfileVariant(
    organizer,
    isCommunityEvent ? "community" : "official",
  ).displayName;
  const trainerName =
    trainer?.displayName?.trim() ||
    (isCommunityEvent ? organizerDisplay : "") ||
    event.creatorDisplayName?.trim() ||
    "Gospodarz wydarzenia";

  return {
    trainerName,
    organizerName: isSelfManagedTrainingEvent(event)
      ? trainerName
      : organizerDisplay || "Organizator",
  };
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
  event: Pick<TrainingEvent, "trainerCollaborationStatus">,
): EventCollaborationStatus {
  if (event.trainerCollaborationStatus) {
    return event.trainerCollaborationStatus;
  }

  return "accepted";
}

export function resolveOrganizerCollaborationStatus(
  event: Pick<TrainingEvent, "organizerId" | "organizerCollaborationStatus" | "selfManagedByTrainer"> &
    Partial<Pick<TrainingEvent, "brandStatus">>,
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
  event: Pick<TrainingEvent, "selfManagedByTrainer" | "organizerId"> &
    Partial<Pick<TrainingEvent, "brandStatus">>,
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
    | "trainerId"
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
    | "groupId"
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

  if (!event.groupId) {
    return false;
  }

  return isTrainingEventCollaborationAccepted(event);
}

export function canPublishTrainingEvent(
  event: Pick<
    TrainingEvent,
    "archivedAt" | "brandStatus" | "isPublished" | "publicationApprovalStatus"
  >,
) {
  if (event.isPublished || isTrainingEventArchived(event)) {
    return false;
  }

  if (isCommunityBrandStatus(event.brandStatus)) {
    return event.publicationApprovalStatus === "accepted";
  }

  return true;
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
  actor: CapabilityUser,
) {
  if (!actor) {
    return false;
  }
  const actorRole = actor.role ?? getHighestRole(actor);

  if (actorRole === "admin") {
    return true;
  }

  if (isCommunityBrandStatus(event.brandStatus) && actor.id === event.creatorUserId) {
    return true;
  }

  const canUseTrainerLayer =
    getRoleHierarchyLevel(actorRole) >= getRoleHierarchyLevel("trainer");
  const canUseOrganizerLayer =
    getRoleHierarchyLevel(actorRole) >= getRoleHierarchyLevel("organizer");

  if (canUseTrainerLayer && actor.trainerProfileId === event.trainerId) {
    return (
      isSelfManagedTrainingEvent(event) ||
      resolveTrainerCollaborationStatus(event) === "accepted" ||
      event.createdByRole === "trainer"
    );
  }

  if (
    canUseOrganizerLayer &&
    actor.organizerProfileId === event.organizerId
  ) {
    if (isOrganizerFunctionsBlocked(actor)) {
      return false;
    }

    if (isTrainingEventArchived(event)) {
      return false;
    }

    return (
      resolveOrganizerCollaborationStatus(event) === "accepted" ||
      event.createdByRole === "organizer"
    );
  }

  if (actor.id === event.creatorUserId) {
    return true;
  }

  return false;
}

export function canApproveEnrollmentRequest(
  event: Pick<
    TrainingEvent,
    | "archivedAt"
    | "brandStatus"
    | "creatorUserId"
    | "organizerId"
    | "selfManagedByTrainer"
    | "trainerId"
  >,
  actor: CapabilityUser,
) {
  if (!actor) {
    return false;
  }
  const actorRole = actor.role ?? getHighestRole(actor);

  if (actorRole === "admin") {
    return !isTrainingEventArchived(event);
  }

  if (isTrainingEventArchived(event)) {
    return false;
  }

  if (
    actor.organizerProfileId === event.organizerId &&
    !isOrganizerFunctionsBlocked(actor)
  ) {
    return true;
  }

  if (isSelfManagedTrainingEvent(event)) {
    if (actor.trainerProfileId === event.trainerId) {
      return true;
    }

    if (actor.id === event.creatorUserId) {
      return true;
    }
  }

  if (isCommunityBrandStatus(event.brandStatus) && actor.id === event.creatorUserId) {
    return true;
  }

  return false;
}

export function isOperationalEnrollmentRequest(
  request: Pick<EnrollmentRequest, "eventId" | "eventParticipantId" | "finalStatus">,
  store: Pick<DemoStore, "trainingEvents">,
) {
  if (request.finalStatus === "accepted") {
    return false;
  }

  const event = store.trainingEvents.find((item) => item.id === request.eventId);
  if (!event?.groupId) {
    return true;
  }

  return !request.eventParticipantId;
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
  actor: CapabilityUser,
) {
  if (!actor) {
    return false;
  }
  const actorRole = actor.role ?? getHighestRole(actor);

  if (isTrainingEventArchived(event)) {
    return false;
  }

  if (actorRole === "admin") {
    return true;
  }

  if (
    getRoleHierarchyLevel(actorRole) >= getRoleHierarchyLevel("trainer") &&
    actor.trainerProfileId === event.trainerId
  ) {
    return resolveTrainerCollaborationStatus(event) === "pending";
  }

  if (
    getRoleHierarchyLevel(actorRole) >= getRoleHierarchyLevel("organizer") &&
    actor.organizerProfileId === event.organizerId &&
    !isOrganizerFunctionsBlocked(actor)
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

export function isOfficialGroupTrainingEvent(
  event: Partial<Pick<TrainingEvent, "brandStatus" | "groupId">>,
) {
  return !isCommunityBrandStatus(event.brandStatus) && Boolean(event.groupId);
}

export function getEventParticipantCount(
  event: Pick<TrainingEvent, "enrolledCount" | "capacity"> &
    Partial<Pick<TrainingEvent, "brandStatus" | "groupId" | "assignedCount">>,
) {
  if (isOfficialGroupTrainingEvent(event)) {
    return typeof event.assignedCount === "number" ? event.assignedCount : event.enrolledCount;
  }

  return event.enrolledCount;
}

export function getEventOverflowCount(
  event: Pick<TrainingEvent, "enrolledCount" | "capacity"> &
    Partial<Pick<TrainingEvent, "brandStatus" | "groupId" | "assignedCount">>,
) {
  return Math.max(getEventParticipantCount(event) - event.capacity, 0);
}

export function getAvailablePlaces(
  event: Pick<TrainingEvent, "capacity" | "enrolledCount"> &
    Partial<Pick<TrainingEvent, "brandStatus" | "groupId" | "assignedCount">>,
) {
  return Math.max(event.capacity - getEventParticipantCount(event), 0);
}

export function getEventFillRate(
  event: Pick<TrainingEvent, "capacity" | "enrolledCount"> &
    Partial<Pick<TrainingEvent, "brandStatus" | "groupId" | "assignedCount">>,
) {
  if (event.capacity <= 0) {
    return 0;
  }

  return (
    Math.round((Math.min(getEventParticipantCount(event), event.capacity) / event.capacity) * 1000) /
    10
  );
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

export function resolveTrainingEventWorkflowStatus(
  event: Pick<
    TrainingEvent,
    | "archivedAt"
    | "isPublished"
    | "trainerDecisionReason"
    | "withdrawnAt"
    | "workflowStatus"
  >,
): TrainingEventWorkflowStatus {
  if (
    event.workflowStatus === "draft-requested" ||
    event.workflowStatus === "trainer-accepted" ||
    event.workflowStatus === "trainer-rejected" ||
    event.workflowStatus === "withdrawn" ||
    event.workflowStatus === "published"
  ) {
    return event.workflowStatus;
  }

  if (event.withdrawnAt) {
    return "withdrawn";
  }

  if (event.isPublished) {
    return "published";
  }

  return event.trainerDecisionReason ? "trainer-rejected" : "trainer-accepted";
}

export function getTrainingEventWorkflowStatusLabel(
  workflowStatus: TrainingEventWorkflowStatus | undefined | null,
) {
  switch (workflowStatus) {
    case "trainer-accepted":
      return "zaakceptowany przez trenera";
    case "trainer-rejected":
      return "odrzucony przez trenera";
    case "withdrawn":
      return "wycofany";
    case "published":
      return "opublikowany";
    default:
      return "oczekuje na decyzję trenera";
  }
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
    case "moderator":
      return "Moderator";
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

const ROLE_HIERARCHY = ["participant", "organizer", "trainer", "admin"] as const;
type HierarchicalRole = (typeof ROLE_HIERARCHY)[number];

function isHierarchicalRole(role: AppRole): role is HierarchicalRole {
  return role !== "moderator";
}

export function getRoleHierarchyLevel(role: AppRole) {
  if (!isHierarchicalRole(role)) {
    return ROLE_HIERARCHY.indexOf("participant");
  }

  return ROLE_HIERARCHY.indexOf(role);
}

export function getHighestRole(
  user: CapabilityUser,
) {
  if (!user) {
    return "participant" as const;
  }

  const candidates = [
    user.role,
    user.primaryRole,
    ...(Array.isArray(user.roles) ? user.roles : []),
  ].filter(
    (role): role is HierarchicalRole =>
      Boolean(role) && isHierarchicalRole(role as AppRole),
  );

  return candidates.reduce<HierarchicalRole>((highest, role) => {
    return getRoleHierarchyLevel(role) > getRoleHierarchyLevel(highest) ? role : highest;
  }, "participant");
}

export function hasInheritedRole(
  user: CapabilityUser,
  role: AppRole,
) {
  if (role === "moderator") {
    return hasModeratorAccess(user);
  }

  return getRoleHierarchyLevel(getHighestRole(user)) >= getRoleHierarchyLevel(role);
}

export function resolvePhotoMode(
  value: unknown,
  fallback: PhotoMode = "optional",
): PhotoMode {
  return value === "required" || value === "optional" || value === "disabled"
    ? value
    : fallback;
}

export function isPhotoModeRequired(mode: PhotoMode) {
  return mode === "required";
}

export function isPhotoModeEnabled(mode: PhotoMode) {
  return mode !== "disabled";
}

export function resolveEnrollmentPhotoModeForEvent(
  event: Pick<TrainingEvent, "enrollmentPhotoRequirement">,
  appSettings: Pick<AppSettings, "enrollmentPhotoMode">,
) {
  if (event.enrollmentPhotoRequirement === "required") {
    return "required";
  }

  if (event.enrollmentPhotoRequirement === "optional") {
    return "optional";
  }

  return resolvePhotoMode(appSettings.enrollmentPhotoMode, "optional");
}

export function resolveTrainingJoinAudience(
  value: unknown,
  fallback: TrainingJoinAudience = "new-people",
): TrainingJoinAudience {
  return value === "existing-practitioners" || value === "new-people"
    ? value
    : fallback;
}

export function resolveTrainingJoinAudienceForEvent(
  event: Pick<TrainingEvent, "joinAudienceSetting">,
  group?: { defaultJoinAudience?: TrainingJoinAudience | null } | null,
) {
  if (event.joinAudienceSetting === "existing-practitioners") {
    return "existing-practitioners";
  }

  if (event.joinAudienceSetting === "new-people") {
    return "new-people";
  }

  return resolveTrainingJoinAudience(group?.defaultJoinAudience, "new-people");
}

export function getTrainingJoinAudienceLabel(value: TrainingJoinAudience | null | undefined) {
  return resolveTrainingJoinAudience(value) === "existing-practitioners"
    ? "Tylko Ćwiczący"
    : "Nowe osoby";
}

export function hasRole(
  user: CapabilityUser,
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

export function hasModeratorAccess(
  user: CapabilityUser,
) {
  return hasRole(user, "admin") || hasRole(user, "moderator");
}

export function isOrganizerFunctionsBlocked(
  user: Pick<AppUser, "organizerFunctionsBlockedAt"> | null | undefined,
) {
  return Boolean(user?.organizerFunctionsBlockedAt);
}

export function canUseOrganizerFunctions(
  user: CapabilityUser,
) {
  return hasInheritedRole(user, "organizer") && !isOrganizerFunctionsBlocked(user);
}

export function canModerateTrainingEvent(
  event: Pick<TrainingEvent, "archivedAt">,
  actor:
    | Pick<AppUser, "role" | "roles" | "primaryRole">
    | null
    | undefined,
) {
  void event;
  return hasModeratorAccess(actor);
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

export function doIntervalsOverlap(
  left: Pick<TrainingEventScheduleDay, "startsAt" | "endsAt">,
  right: Pick<TrainingEventScheduleDay, "startsAt" | "endsAt">,
) {
  return (
    toTimestamp(left.startsAt) < toTimestamp(right.endsAt) &&
    toTimestamp(left.endsAt) > toTimestamp(right.startsAt)
  );
}

export function doesTrainingEventOverlapRange(
  event: Pick<TrainingEvent, "scheduleDays" | "startsAt" | "endsAt">,
  startsAt: string,
  endsAt: string,
) {
  const target = { startsAt, endsAt };
  return getTrainingEventScheduleDays(event).some((day) => doIntervalsOverlap(day, target));
}

export function buildGoogleCalendarSubscribeUrl(
  calendarUrl: string,
) {
  const trimmed = calendarUrl.trim();

  if (!trimmed) {
    return "";
  }

  return `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(trimmed)}`;
}

function toTimestamp(value: string) {
  return new Date(value).getTime();
}
