import type {
  AppRole,
  AppSettings,
  AppUser,
  AvailabilityInput,
  CommunityOrganizerProfileUpdateInput,
  AvailabilitySlot,
  DecisionStatus,
  DemoStore,
  EmandarBrandStatus,
  EnrollmentFormInput,
  EnrollmentRequest,
  EventParticipant,
  EventParticipantInput,
  EventParticipantStatusUpdateInput,
  Group,
  GroupInput,
  GroupMember,
  GroupMemberInput,
  GroupMemberPriority,
  GroupMemberUpdateInput,
  GroupUpdateInput,
  NotificationRecord,
  NotificationSettingsUpdateInput,
  OrganizerCalendarFeedInput,
  OrganizerParticipantProfileInput,
  OrganizerProfile,
  OrganizerProfileUpdateInput,
  OrganizerTrainingDraftDecisionInput,
  OrganizerTrainingDraftInput,
  OrganizerTrainingDraftUpdateInput,
  ParticipantGroupEventManagementInput,
  ParticipantRegistrationInput,
  ParticipantOnboardingInput,
  ParticipantProfile,
  ParticipantProfileUpdateInput,
  PhotoMode,
  TrainerCalendarFeedInput,
  TrainerOrganizerRelation,
  TrainerProfile,
  TrainerProfileUpdateInput,
  TrainerSharedSlotInput,
  TrainerSharedSlotUpdateInput,
  TrainingEvent,
  TrainingEventBrandStatusUpdateInput,
  TrainingEventCollaborationUpdateInput,
  TrainingEventImage,
  TrainingEventInput,
  TrainingEventManagementUpdateInput,
  TrainingEventScheduleDay,
  TrainingEventStatus,
} from "@/domain/types";
import { normalizeNotificationSettings } from "@/domain/notifications";
import {
  canApproveEnrollmentRequest,
  canManageTrainingEvent,
  canModerateTrainingEvent,
  canUseOrganizerFunctions,
  canOrganizerAccessTrainer,
  deriveEnrollmentFinalStatus,
  getRoleHierarchyLevel,
  hasModeratorAccess,
  isCommunityBrandStatus,
  isTrainingEventArchived,
  isTrainingEventPubliclyVisible,
  isOrganizerFunctionsBlocked,
  resolveEnrollmentIntent,
  resolveOrganizerCollaborationStatus,
  resolveOrganizerProfileVariant,
  resolveTrainerCollaborationStatus,
} from "@/domain/utils";

export type Unsubscribe = () => void;
type StorePatch = Partial<DemoStore>;
type PersistedCollectionKey =
  | "users"
  | "trainers"
  | "organizers"
  | "participantProfiles"
  | "groups"
  | "groupMembers"
  | "eventParticipants"
  | "relations"
  | "trainingEvents"
  | "availabilitySlots"
  | "trainerSharedSlots"
  | "trainerCalendarFeeds"
  | "organizerCalendarFeeds"
  | "trainerOrganizerCalendarFeeds"
  | "trainerExternalBusyMonths"
  | "organizerExternalBusyMonths"
  | "enrollmentRequests"
  | "notifications"
  | "appSettings";
type PersistedCollectionsPatch = Partial<Pick<DemoStore, PersistedCollectionKey>>;

const authSessionStorageKey = "emandar:mock-auth-session";
const smsSessionStorageKey = "emandar:mock-sms-session";
const pollIntervalMs = 5000;
const persistedCollectionKeys: PersistedCollectionKey[] = [
  "users",
  "trainers",
  "organizers",
  "participantProfiles",
  "groups",
  "groupMembers",
  "eventParticipants",
  "relations",
  "trainingEvents",
  "availabilitySlots",
  "trainerSharedSlots",
  "trainerCalendarFeeds",
  "organizerCalendarFeeds",
  "trainerOrganizerCalendarFeeds",
  "trainerExternalBusyMonths",
  "organizerExternalBusyMonths",
  "enrollmentRequests",
  "notifications",
  "appSettings",
];

let cachedStore: DemoStore | null = null;
let cachedVersion = 0;
let loadPromise: Promise<DemoStore> | null = null;
let savePromise: Promise<void> = Promise.resolve();
let pollTimer: number | null = null;

let nextListenerId = 1;

const publicListeners = new Map<number, (patch: StorePatch) => void>();
const privateListeners = new Map<number, (patch: StorePatch) => void>();
const userProfileListeners = new Map<number, { userId: string; callback: (user: AppUser | null) => void }>();
const authListeners = new Map<number, (userId: string | null) => void>();

class MockVersionConflictError extends Error {
  snapshot: { store: DemoStore; version: number };

  constructor(snapshot: { store: DemoStore; version: number }) {
    super("Dane zostały zmienione w innym oknie. Widok został odświeżony, spróbuj ponownie.");
    this.name = "MockVersionConflictError";
    this.snapshot = snapshot;
  }
}

function getBasePath() {
  return import.meta.env.BASE_URL || "/";
}

function normalizeBasePath(basePath: string) {
  const trimmed = basePath.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

function buildMockApiUrl(basePath: string, path: string) {
  return `${normalizeBasePath(basePath)}api/mock/${path}`.replace(/([^:]\/)\/+/g, "$1");
}

export function resolveMockApiUrls(
  path: string,
  options: { baseUrl?: string; pathname?: string } = {},
) {
  const configuredBasePath = normalizeBasePath(options.baseUrl ?? getBasePath());
  const pathname =
    options.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const prefersEmandarBase =
    configuredBasePath === "/" && pathname.startsWith("/emandar/");
  const basePathCandidates = Array.from(
    new Set(
      [
        prefersEmandarBase ? "/emandar/" : configuredBasePath,
        configuredBasePath,
        pathname.startsWith("/emandar/") ? "/emandar/" : null,
        "/",
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const pathCandidates = Array.from(
    new Set(
      path.endsWith(".php") ? [path, path.replace(/\.php$/, "")] : [path, `${path}.php`],
    ),
  );

  return basePathCandidates.flatMap((basePath) =>
    pathCandidates.map((pathCandidate) => buildMockApiUrl(basePath, pathCandidate)),
  );
}

function canUseDomStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStorageJson<T>(key: string, fallback: T): T {
  if (!canUseDomStorage()) {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function writeStorageJson(key: string, value: unknown) {
  if (!canUseDomStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorageValue(key: string) {
  if (!canUseDomStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeForDiff(value: unknown) {
  return JSON.stringify(value);
}

function nowIso() {
  return new Date().toISOString();
}

async function fetchJsonOrNull<T>(url: string) {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function createId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizePhoneLookupKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return digits;
  }

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits;
}

function buildParticipantProfileId(phone: string) {
  const phoneLookupKey = normalizePhoneLookupKey(phone);
  if (!phoneLookupKey) {
    throw new Error("Podaj poprawny numer telefonu.");
  }

  return `participant-${phoneLookupKey}`;
}

export function buildRelationId(trainerId: string, organizerId: string) {
  return `${trainerId}__${organizerId}`;
}

function buildGroupMemberId(groupId: string, participantProfileId: string) {
  return `${groupId}__${participantProfileId}`;
}

function buildEventParticipantId(eventId: string, participantProfileId: string) {
  return `${eventId}__${participantProfileId}`;
}

function isFutureOpenGroupEvent(event: TrainingEvent) {
  return (
    Boolean(event.groupId) &&
    !isTrainingEventArchived(event) &&
    !event.rosterFinalizedAt &&
    new Date(event.startsAt).getTime() > Date.now()
  );
}

function countConfirmedEventParticipants(store: DemoStore, eventId: string) {
  return store.eventParticipants.filter(
    (participant) => participant.eventId === eventId && participant.status === "confirmed",
  ).length;
}

function recomputeEventEnrolledCount(store: DemoStore, eventId: string) {
  const event = store.trainingEvents.find((item) => item.id === eventId);
  if (!event) {
    return;
  }

  event.enrolledCount = countConfirmedEventParticipants(store, eventId);
}

function syncParticipantProfileGroupMembership(
  profile: ParticipantProfile,
  group: Group,
  member: GroupMember,
) {
  profile.groupIds = Array.from(new Set([...(profile.groupIds ?? []), group.id]));

  if (member.membershipStatus === "active") {
    profile.activeGroupIds = Array.from(new Set([...(profile.activeGroupIds ?? []), group.id]));
  } else {
    profile.activeGroupIds = (profile.activeGroupIds ?? []).filter((item) => item !== group.id);
  }

  profile.managerOrganizerIds = Array.from(
    new Set([...(profile.managerOrganizerIds ?? []), group.organizerId]),
  );
  if (group.organizerUserId) {
    profile.managerOrganizerUserIds = Array.from(
      new Set([...(profile.managerOrganizerUserIds ?? []), group.organizerUserId]),
    );
  }

  profile.managerTrainerIds = Array.from(new Set([...(profile.managerTrainerIds ?? []), group.trainerId]));
  if (group.trainerUserId) {
    profile.managerTrainerUserIds = Array.from(
      new Set([...(profile.managerTrainerUserIds ?? []), group.trainerUserId]),
    );
  }

  profile.updatedAt = nowIso();
}

function syncGroupMemberToEvent(
  store: DemoStore,
  event: TrainingEvent,
  member: GroupMember,
  source: EventParticipant["source"] = "auto-core",
) {
  if (!event.groupId || member.membershipStatus !== "active") {
    return null;
  }

  const group = store.groups.find((item) => item.id === event.groupId);
  const profile = store.participantProfiles.find((item) => item.id === member.participantProfileId);
  if (!group || !profile) {
    return null;
  }

  const eventParticipantId = buildEventParticipantId(event.id, profile.id);
  const existingIndex = store.eventParticipants.findIndex((item) => item.id === eventParticipantId);
  const existingParticipant = existingIndex >= 0 ? store.eventParticipants[existingIndex] : null;
  const payload: EventParticipant = {
    id: eventParticipantId,
    eventId: event.id,
    eventTitle: event.title || event.location,
    groupId: group.id,
    groupName: group.name,
    organizerId: group.organizerId,
    organizerUserId: group.organizerUserId ?? event.organizerUserId ?? "",
    trainerId: group.trainerId,
    trainerUserId: group.trainerUserId ?? event.trainerUserId ?? "",
    participantProfileId: profile.id,
    participantDisplayName: profile.displayName,
    participantPhone: profile.phone,
    participantUserId: profile.linkedUserId ?? null,
    priority: member.priority,
    status: existingParticipant?.status === "confirmed" ? "confirmed" : "invited",
    source: existingParticipant?.source ?? source,
    overCapacity: existingParticipant?.overCapacity,
    invitedAt: existingParticipant?.invitedAt ?? nowIso(),
    attendanceConfirmationStatus: existingParticipant?.attendanceConfirmationStatus,
    attendanceConfirmationRequestedAt: existingParticipant?.attendanceConfirmationRequestedAt,
    attendanceConfirmationRespondedAt: existingParticipant?.attendanceConfirmationRespondedAt,
    attendanceConfirmationExpiresAt: existingParticipant?.attendanceConfirmationExpiresAt,
    confirmedAt: existingParticipant?.status === "confirmed"
      ? existingParticipant.confirmedAt ?? nowIso()
      : undefined,
    declinedAt: existingParticipant?.status === "declined" ? existingParticipant.declinedAt : undefined,
    removedAt: existingParticipant?.status === "removed" ? existingParticipant.removedAt : undefined,
    updatedAt: nowIso(),
  };

  if (existingIndex >= 0) {
    store.eventParticipants[existingIndex] = {
      ...store.eventParticipants[existingIndex],
      ...payload,
    };
  } else {
    store.eventParticipants.unshift(payload);
  }

  recomputeEventEnrolledCount(store, event.id);
  return eventParticipantId;
}

function syncGroupMemberToFutureOpenEvents(
  store: DemoStore,
  group: Group,
  member: GroupMember,
) {
  store.trainingEvents
    .filter((event) => event.groupId === group.id && isFutureOpenGroupEvent(event))
    .forEach((event) => {
      syncGroupMemberToEvent(store, event, member, "auto-core");
    });
}

function syncGroupRosterToEvent(store: DemoStore, event: TrainingEvent) {
  if (!event.groupId) {
    return;
  }

  const members = store.groupMembers.filter(
    (member) => member.groupId === event.groupId && member.membershipStatus === "active",
  );

  members.forEach((member) => {
    syncGroupMemberToEvent(store, event, member, "auto-core");
  });

  recomputeEventEnrolledCount(store, event.id);
}

function splitDisplayName(value: string) {
  const normalized = value.trim();
  const [firstName = "", ...lastNameParts] = normalized.split(/\s+/).filter(Boolean);

  return {
    displayName: normalized,
    firstName,
    lastName: lastNameParts.join(" ") || undefined,
  };
}

function isPhoneOnlyDisplayName(value: string | null | undefined, phone: string) {
  const normalizedValue = normalizePhoneLookupKey(value ?? "");
  const normalizedPhone = normalizePhoneLookupKey(phone);
  return Boolean(normalizedValue) && normalizedValue === normalizedPhone;
}

function normalizePublicStore(raw: Partial<DemoStore> | null | undefined): DemoStore {
  const base = createEmptyStore();

  const nextStore: DemoStore = {
    ...base,
    ...(raw ?? {}),
    users: cloneValue(raw?.users ?? base.users),
    trainers: cloneValue(raw?.trainers ?? base.trainers),
    organizers: cloneValue(raw?.organizers ?? base.organizers),
    participantProfiles: cloneValue(raw?.participantProfiles ?? base.participantProfiles),
    groups: cloneValue(raw?.groups ?? base.groups),
    groupMembers: cloneValue(raw?.groupMembers ?? base.groupMembers),
    eventParticipants: cloneValue(raw?.eventParticipants ?? base.eventParticipants),
    relations: cloneValue(raw?.relations ?? base.relations),
    trainingEvents: cloneValue(raw?.trainingEvents ?? base.trainingEvents),
    publicTrainingEvents: cloneValue(raw?.publicTrainingEvents ?? base.publicTrainingEvents),
    availabilitySlots: cloneValue(raw?.availabilitySlots ?? base.availabilitySlots),
    trainerSharedSlots: cloneValue(raw?.trainerSharedSlots ?? base.trainerSharedSlots),
    trainerCalendarFeeds: cloneValue(raw?.trainerCalendarFeeds ?? base.trainerCalendarFeeds),
    organizerCalendarFeeds: cloneValue(raw?.organizerCalendarFeeds ?? base.organizerCalendarFeeds),
    organizerExternalBusyMonths: cloneValue(
      raw?.organizerExternalBusyMonths ?? base.organizerExternalBusyMonths,
    ),
    trainerOrganizerCalendarFeeds: cloneValue(
      raw?.trainerOrganizerCalendarFeeds ?? base.trainerOrganizerCalendarFeeds,
    ),
    trainerExternalBusyMonths: cloneValue(
      raw?.trainerExternalBusyMonths ?? base.trainerExternalBusyMonths,
    ),
    enrollmentRequests: cloneValue(raw?.enrollmentRequests ?? base.enrollmentRequests),
    notifications: cloneValue(raw?.notifications ?? base.notifications),
    appSettings: {
      ...base.appSettings,
      ...(raw?.appSettings ?? {}),
    },
  };

  return rebuildDerivedStore(nextStore);
}

function getCurrentSessionState() {
  return readStorageJson<{ userId: string | null }>(authSessionStorageKey, { userId: null });
}

function setCurrentSessionUserId(userId: string | null) {
  writeStorageJson(authSessionStorageKey, { userId });
}

function getCurrentSessionUserId() {
  return getCurrentSessionState().userId ?? null;
}

function getCurrentSmsSession() {
  return readStorageJson<{ phone: string; code: string; requestedAt: string } | null>(
    smsSessionStorageKey,
    null,
  );
}

async function readStoreSnapshot(): Promise<{ store: DemoStore; version: number }> {
  for (const url of resolveMockApiUrls("state.php")) {
    const payload = await fetchJsonOrNull<{
      store?: Partial<DemoStore>;
      version?: number;
    }>(url);

    if (!payload?.store) {
      continue;
    }

    return {
      store: normalizePublicStore(payload.store),
      version: Number(payload.version ?? Date.now()),
    };
  }

  throw new Error("Nie udało się wczytać mock store.");
}

async function readStoreVersion() {
  for (const url of resolveMockApiUrls("version.php")) {
    const payload = await fetchJsonOrNull<{
      version?: number;
    }>(url);

    if (typeof payload?.version !== "undefined") {
      return Number(payload.version);
    }
  }

  throw new Error("Nie udało się pobrać wersji mock store.");
}

function buildPersistedCollectionsPatch(
  previousStore: DemoStore,
  nextStore: DemoStore,
): PersistedCollectionsPatch {
  const patch: PersistedCollectionsPatch = {};

  persistedCollectionKeys.forEach((collectionKey) => {
    if (serializeForDiff(previousStore[collectionKey]) === serializeForDiff(nextStore[collectionKey])) {
      return;
    }

    patch[collectionKey] = cloneValue(nextStore[collectionKey]);
  });

  return patch;
}

async function persistStore(
  collections: PersistedCollectionsPatch,
  baseVersion: number,
) {
  const payload = cloneValue(collections);
  const pendingSave = savePromise.then(async () => {
    let lastError: unknown = null;

    for (const url of resolveMockApiUrls("patch.php")) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ baseVersion, collections: payload }),
        });

        if (response.status === 409) {
          const snapshot = await readStoreSnapshot();
          throw new MockVersionConflictError(snapshot);
        }

        if (!response.ok) {
          lastError = new Error(`mock-patch-${response.status}`);
          continue;
        }

        const saved = (await response.json()) as {
          version?: number;
          writtenCollections?: string[];
        };

        return {
          version: Number(saved.version ?? Date.now()),
          writtenCollections: saved.writtenCollections ?? Object.keys(payload),
        };
      } catch (error) {
        if (error instanceof MockVersionConflictError) {
          throw error;
        }

        lastError = error;
      }
    }

    if (lastError instanceof MockVersionConflictError) {
      throw lastError;
    }

    if (lastError instanceof Error && lastError.message.startsWith("mock-patch-")) {
      throw lastError;
    }

    throw new Error("Nie udało się połączyć z lokalnym mock API.");
  });

  savePromise = pendingSave.then(
    () => undefined,
    () => undefined,
  );

  return pendingSave;
}

async function ensureStoreLoaded() {
  if (cachedStore) {
    return cachedStore;
  }

  if (!loadPromise) {
    loadPromise = readStoreSnapshot()
      .then(({ store, version }) => {
        cachedStore = store;
        cachedVersion = version;
        return store;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }

  return loadPromise;
}

function getCachedStore() {
  return cachedStore ?? createEmptyStore();
}

function getCurrentStoreUser(store: DemoStore) {
  const userId = getCurrentSessionUserId();
  if (!userId) {
    return null;
  }

  return store.users.find((item) => item.id === userId) ?? null;
}

function emitAuthListeners() {
  const userId = getCurrentSessionUserId();

  authListeners.forEach((listener) => {
    listener(userId);
  });
}

function buildPublicPatch(store: DemoStore): StorePatch {
  return {
    trainers: cloneValue(store.trainers),
    organizers: cloneValue(store.organizers),
    publicTrainingEvents: cloneValue(store.publicTrainingEvents),
    trainingEvents: cloneValue(store.publicTrainingEvents),
    appSettings: cloneValue(store.appSettings),
  };
}

function buildPrivatePatch(store: DemoStore): StorePatch {
  return cloneValue(store);
}

function emitStoreListeners() {
  const store = getCachedStore();
  const publicPatch = buildPublicPatch(store);
  const privatePatch = buildPrivatePatch(store);

  publicListeners.forEach((listener) => {
    listener(publicPatch);
  });

  privateListeners.forEach((listener) => {
    listener(privatePatch);
  });

  userProfileListeners.forEach(({ userId, callback }) => {
    callback(cloneValue(store.users.find((item) => item.id === userId) ?? null));
  });
}

async function refreshStoreIfChanged() {
  await savePromise;

  try {
    const latestVersion = await readStoreVersion();
    if (latestVersion === cachedVersion) {
      return;
    }

    const snapshot = await readStoreSnapshot();
    cachedStore = snapshot.store;
    cachedVersion = snapshot.version;
    emitStoreListeners();
  } catch {
    return;
  }
}

function maybeStartPolling() {
  if (typeof window === "undefined" || pollTimer !== null) {
    return;
  }

  const hasListeners =
    publicListeners.size > 0 ||
    privateListeners.size > 0 ||
    userProfileListeners.size > 0;

  if (!hasListeners) {
    return;
  }

  pollTimer = window.setInterval(() => {
    void refreshStoreIfChanged();
  }, pollIntervalMs);
}

function maybeStopPolling() {
  if (pollTimer === null) {
    return;
  }

  const hasListeners =
    publicListeners.size > 0 ||
    privateListeners.size > 0 ||
    userProfileListeners.size > 0;

  if (hasListeners) {
    return;
  }

  window.clearInterval(pollTimer);
  pollTimer = null;
}

async function mutateStore<T>(updater: (store: DemoStore) => T | Promise<T>) {
  const previous = cloneValue(await ensureStoreLoaded());
  const previousVersion = cachedVersion;
  const current = cloneValue(previous);
  const result = await updater(current);
  const nextStore = rebuildDerivedStore(current);
  const collectionsPatch = buildPersistedCollectionsPatch(previous, nextStore);

  try {
    if (Object.keys(collectionsPatch).length > 0) {
      const persisted = await persistStore(collectionsPatch, previousVersion);
      cachedVersion = persisted.version;
    }
    cachedStore = nextStore;
  } catch (error) {
    if (error instanceof MockVersionConflictError) {
      cachedStore = error.snapshot.store;
      cachedVersion = error.snapshot.version;
      emitStoreListeners();
      throw new Error(error.message);
    }

    cachedStore = previous;
    cachedVersion = previousVersion;
    throw error;
  }

  emitStoreListeners();
  return result;
}

function createNotification(
  store: DemoStore,
  userId: string | null | undefined,
  title: string,
  body: string,
  entityType: NotificationRecord["entityType"],
) {
  if (!userId) {
    return;
  }

  store.notifications.unshift({
    id: createId("notification"),
    userId,
    title,
    body,
    entityType,
    createdAt: nowIso(),
  });
}

function findTrainer(store: DemoStore, trainerId?: string | null) {
  return store.trainers.find((item) => item.id === trainerId) ?? null;
}

function findOrganizer(store: DemoStore, organizerId?: string | null) {
  return store.organizers.find((item) => item.id === organizerId) ?? null;
}

function findUser(store: DemoStore, userId?: string | null) {
  return store.users.find((item) => item.id === userId) ?? null;
}

function ensureOrganizerProfileRecord(store: DemoStore, user: AppUser) {
  if (user.organizerProfileId) {
    const organizer = findOrganizer(store, user.organizerProfileId);
    if (organizer) {
      return organizer;
    }
  }

  const organizerId = user.organizerProfileId ?? createId("organizer");
  user.organizerProfileId = organizerId;

  const organizer: OrganizerProfile = {
    id: organizerId,
    userId: user.id,
    displayName: user.displayName,
    description: user.notes ?? "Nowy organizer utworzony z profilu użytkownika.",
    isVisible: true,
  };
  store.organizers.unshift(organizer);
  return organizer;
}

function resolveEventCreatorDisplayName(
  actor: AppUser,
  input: { brandStatus?: EmandarBrandStatus | null },
  organizer: OrganizerProfile | null,
  trainer: TrainerProfile | null,
) {
  if (isCommunityBrandStatus(input.brandStatus)) {
    return (
      resolveOrganizerProfileVariant(organizer, "community").displayName ||
      actor.displayName
    );
  }

  return (
    resolveOrganizerProfileVariant(organizer, "official").displayName ||
    trainer?.displayName?.trim() ||
    actor.displayName
  );
}

function getActorOrThrow(store: DemoStore) {
  const actor = getCurrentStoreUser(store);
  if (!actor) {
    throw new Error("Musisz być zalogowany.");
  }

  return actor;
}

function resolveTrainerAuthorizationCode(trainer: TrainerProfile & { authorizationCode?: string }) {
  return trainer.authorizationCode || trainer.slug.toUpperCase();
}

function rebuildParticipantDerivedFields(store: DemoStore) {
  const activeMembers = store.groupMembers.filter((item) => item.membershipStatus === "active");
  const groupedByParticipant = new Map<string, GroupMember[]>();

  activeMembers.forEach((member) => {
    const bucket = groupedByParticipant.get(member.participantProfileId) ?? [];
    bucket.push(member);
    groupedByParticipant.set(member.participantProfileId, bucket);
  });

  store.participantProfiles = store.participantProfiles.map((profile) => {
    const members = groupedByParticipant.get(profile.id) ?? [];

    return {
      ...profile,
      groupIds: members.map((item) => item.groupId),
      activeGroupIds: members.map((item) => item.groupId),
      managerOrganizerIds: Array.from(new Set(members.map((item) => item.organizerId))),
      managerOrganizerUserIds: Array.from(
        new Set(members.map((item) => item.organizerUserId).filter(Boolean) as string[]),
      ),
      managerTrainerIds: Array.from(new Set(members.map((item) => item.trainerId))),
      managerTrainerUserIds: Array.from(
        new Set(members.map((item) => item.trainerUserId).filter(Boolean) as string[]),
      ),
      updatedAt: nowIso(),
    };
  });
}

function rebuildEventDerivedFields(store: DemoStore) {
  store.trainingEvents = store.trainingEvents.map((event) => {
    return {
      ...event,
      enrolledCount: countConfirmedEventParticipants(store, event.id),
    };
  });

  store.publicTrainingEvents = store.trainingEvents.filter((event) =>
    isTrainingEventPubliclyVisible(event),
  );
}

function rebuildDerivedStore(store: DemoStore) {
  rebuildParticipantDerivedFields(store);
  rebuildEventDerivedFields(store);
  return store;
}

function createParticipantProfileFromUser(user: AppUser): ParticipantProfile {
  const profileId = user.participantProfileId ?? buildParticipantProfileId(user.phone);
  const name = splitDisplayName(user.displayName || user.phone);

  return {
    id: profileId,
    linkedUserId: user.id,
    displayName: name.displayName,
    firstName: name.firstName,
    lastName: name.lastName,
    phone: user.phone,
    phoneLookupKey: normalizePhoneLookupKey(user.phone),
    email: user.email ?? undefined,
    confirmationStatus: user.phoneVerifiedAt ? "confirmed" : "unconfirmed",
    status: "active",
    createdAt: user.createdAt ?? nowIso(),
    confirmedAt: user.phoneVerifiedAt,
    notes: user.notes,
    referralSource: user.referralSource,
  };
}

function upsertParticipantProfileFromUser(store: DemoStore, user: AppUser) {
  const nextProfile = createParticipantProfileFromUser(user);
  const existingIndex = store.participantProfiles.findIndex((item) => item.id === nextProfile.id);
  if (existingIndex < 0) {
    store.participantProfiles.push(nextProfile);
    return nextProfile;
  }

  const existingProfile = store.participantProfiles[existingIndex];
  const shouldPreserveExistingName =
    !isPhoneOnlyDisplayName(existingProfile.displayName, existingProfile.phone) &&
    isPhoneOnlyDisplayName(nextProfile.displayName, nextProfile.phone);

  const updatedProfile: ParticipantProfile = {
    ...existingProfile,
    ...nextProfile,
    displayName: shouldPreserveExistingName ? existingProfile.displayName : nextProfile.displayName,
    firstName: shouldPreserveExistingName ? existingProfile.firstName : nextProfile.firstName,
    lastName: shouldPreserveExistingName ? existingProfile.lastName : nextProfile.lastName,
    email: nextProfile.email ?? existingProfile.email,
    notes: nextProfile.notes ?? existingProfile.notes,
    referralSource: nextProfile.referralSource ?? existingProfile.referralSource,
    avatarUrl: nextProfile.avatarUrl ?? existingProfile.avatarUrl,
    avatarPath: nextProfile.avatarPath ?? existingProfile.avatarPath,
    avatarCrop: nextProfile.avatarCrop ?? existingProfile.avatarCrop,
    createdAt: existingProfile.createdAt,
    createdByOrganizerId: existingProfile.createdByOrganizerId ?? nextProfile.createdByOrganizerId,
    createdByUserId: existingProfile.createdByUserId ?? nextProfile.createdByUserId,
    confirmedAt: nextProfile.confirmedAt ?? existingProfile.confirmedAt,
    managerOrganizerIds: existingProfile.managerOrganizerIds,
    managerOrganizerUserIds: existingProfile.managerOrganizerUserIds,
    managerTrainerIds: existingProfile.managerTrainerIds,
    managerTrainerUserIds: existingProfile.managerTrainerUserIds,
    groupIds: existingProfile.groupIds,
    activeGroupIds: existingProfile.activeGroupIds,
  };

  store.participantProfiles[existingIndex] = updatedProfile;
  return updatedProfile;
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

async function maybeReadFile(file?: File | null) {
  if (!file) {
    return null;
  }

  return readFileAsDataUrl(file);
}

function ensureRole(user: AppUser, role: AppRole) {
  if (!user.roles.includes(role)) {
    user.roles = [...user.roles, role];
  }
}

function hasApprovedOrganizerRelation(store: DemoStore, organizerId: string) {
  return store.relations.some(
    (relation) => relation.organizerId === organizerId && relation.status === "approved",
  );
}

function syncOrganizerRoleFromRelations(store: DemoStore, user: AppUser) {
  ensureRole(user, "participant");

  if (!user.organizerProfileId) {
    user.roles = user.roles.filter((role) => role !== "organizer");
    if (user.role === "organizer") {
      user.role = "participant";
    }
    return;
  }

  if (hasApprovedOrganizerRelation(store, user.organizerProfileId)) {
    ensureRole(user, "organizer");
    return;
  }

  user.roles = user.roles.filter((role) => role !== "organizer");
  if (user.role === "organizer") {
    user.role = "participant";
  }
}

function ensureAdminActor(actor: Pick<AppUser, "role" | "roles" | "primaryRole">) {
  if (!hasRoleOrAdmin(actor, "admin")) {
    throw new Error("Tylko admin może wykonać tę akcję.");
  }
}

function hasRoleOrAdmin(
  actor: Pick<AppUser, "role" | "roles" | "primaryRole">,
  role: AppRole,
) {
  return actor.role === role || (Array.isArray(actor.roles) && actor.roles.includes(role));
}

function ensureOrganizerFunctionsActive(
  actor: Pick<AppUser, "role" | "roles" | "primaryRole" | "organizerFunctionsBlockedAt">,
) {
  if (isOrganizerFunctionsBlocked(actor)) {
    throw new Error("Funkcje organizatora są zablokowane przez moderatora lub admina.");
  }

  if (!canUseOrganizerFunctions(actor)) {
    throw new Error("To konto nie ma aktywnego dostępu organizatora.");
  }
}

function deleteTrainingEventFromStore(store: DemoStore, eventId: string) {
  store.trainingEvents = store.trainingEvents.filter((item) => item.id !== eventId);
  store.enrollmentRequests = store.enrollmentRequests.filter((item) => item.eventId !== eventId);
  store.eventParticipants = store.eventParticipants.filter((item) => item.eventId !== eventId);
}

function requireTrainerProfileId(
  store: DemoStore,
  user: Pick<AppUser, "id" | "trainerProfileId">,
) {
  if (user.trainerProfileId) {
    return user.trainerProfileId;
  }

  const trainer = store.trainers.find((item) => item.userId === user.id);
  if (trainer) {
    const storedUser = findUser(store, user.id);
    if (storedUser) {
      storedUser.trainerProfileId = trainer.id;
      ensureRole(storedUser, "trainer");
    }

    return trainer.id;
  }

  const storedUser = findUser(store, user.id);
  if (storedUser?.trainerProfileId) {
    return storedUser.trainerProfileId;
  }

  if (!user.trainerProfileId) {
    throw new Error("To konto nie ma profilu trenera.");
  }

  return user.trainerProfileId;
}

function requireOrganizerProfileId(user: Pick<AppUser, "organizerProfileId">) {
  if (!user.organizerProfileId) {
    throw new Error("To konto nie ma profilu organizatora.");
  }

  return user.organizerProfileId;
}

function asParticipantPriority(value: string | undefined): GroupMemberPriority {
  if (value === "regularni" || value === "rezerwowi") {
    return value;
  }

  return "stali";
}

export function createEmptyStore(): DemoStore {
  return {
    users: [],
    trainers: [],
    organizers: [],
    participantProfiles: [],
    groups: [],
    groupMembers: [],
    eventParticipants: [],
    relations: [],
    trainingEvents: [],
    publicTrainingEvents: [],
    availabilitySlots: [],
    trainerSharedSlots: [],
    trainerCalendarFeeds: [],
    organizerCalendarFeeds: [],
    organizerExternalBusyMonths: [],
    trainerOrganizerCalendarFeeds: [],
    trainerExternalBusyMonths: [],
    enrollmentRequests: [],
    notifications: [],
    appSettings: {
      signupPhotoMode: "optional",
      enrollmentPhotoMode: "optional",
      defaultNotificationSettings: normalizeNotificationSettings(undefined),
    },
  };
}

export function subscribeAuthState(onAuthState: (userId: string | null) => void): Unsubscribe {
  const listenerId = nextListenerId++;
  authListeners.set(listenerId, onAuthState);
  onAuthState(getCurrentSessionUserId());

  return () => {
    authListeners.delete(listenerId);
  };
}

export function getCurrentSessionPhone() {
  const store = getCachedStore();
  return getCurrentStoreUser(store)?.phone ?? "";
}

export async function requestSmsCode(phone: string) {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) {
    throw new Error("Podaj numer telefonu.");
  }

  const code = "123456";
  writeStorageJson(smsSessionStorageKey, {
    phone: normalizedPhone,
    code,
    requestedAt: nowIso(),
  });

  return {
    normalizedPhone,
    code,
  };
}

export async function confirmSmsCode(phone: string, code: string, seedTrainerId?: string) {
  const smsSession = getCurrentSmsSession();
  if (!smsSession || smsSession.phone !== phone) {
    throw new Error("Najpierw wyślij kod SMS.");
  }

  if (smsSession.code !== code.trim()) {
    throw new Error("Kod SMS jest nieprawidłowy.");
  }

  const result = await mutateStore((store) => {
    let user = store.users.find((item) => item.phone === phone) ?? null;

    if (!user) {
      const participantProfileId = buildParticipantProfileId(phone);
      user = {
        id: `user-${participantProfileId}`,
        role: "participant",
        roles: ["participant"],
        primaryRole: "participant",
        displayName: phone,
        phone,
        status: "active",
        participantProfileId,
        phoneVerifiedAt: nowIso(),
        createdAt: nowIso(),
        selectedTrainerIds: seedTrainerId ? [seedTrainerId] : [],
        authProvider: "phone",
      };
      store.users.push(user);
    } else {
      user.phone = phone;
      user.phoneVerifiedAt = nowIso();
      user.authProvider = "phone";
      ensureRole(user, "participant");
      if (!user.participantProfileId) {
        user.participantProfileId = buildParticipantProfileId(phone);
      }
      if (seedTrainerId) {
        user.selectedTrainerIds = Array.from(new Set([...(user.selectedTrainerIds ?? []), seedTrainerId]));
      }
    }

    upsertParticipantProfileFromUser(store, user);

    return {
      userId: user.id,
      phone,
    };
  });

  setCurrentSessionUserId(result.userId);
  removeStorageValue(smsSessionStorageKey);
  emitAuthListeners();
  emitStoreListeners();

  return result;
}

export function subscribePublicStore(onPatch: (patch: StorePatch) => void): Unsubscribe {
  const listenerId = nextListenerId++;
  publicListeners.set(listenerId, onPatch);
  void ensureStoreLoaded().then((store) => {
    if (publicListeners.has(listenerId)) {
      onPatch(buildPublicPatch(store));
    }
  });
  maybeStartPolling();

  return () => {
    publicListeners.delete(listenerId);
    maybeStopPolling();
  };
}

export function subscribeUserProfile(
  userId: string,
  onUser: (user: AppUser | null) => void,
): Unsubscribe {
  const listenerId = nextListenerId++;
  userProfileListeners.set(listenerId, {
    userId,
    callback: onUser,
  });

  void ensureStoreLoaded().then((store) => {
    if (userProfileListeners.has(listenerId)) {
      onUser(cloneValue(store.users.find((item) => item.id === userId) ?? null));
    }
  });
  maybeStartPolling();

  return () => {
    userProfileListeners.delete(listenerId);
    maybeStopPolling();
  };
}

export async function fetchAppUser(userId: string) {
  const store = await ensureStoreLoaded();
  const user = store.users.find((item) => item.id === userId) ?? null;

  if (!user) {
    throw new Error("Nie znaleziono użytkownika.");
  }

  return cloneValue(user);
}

export async function ensurePhoneParticipantProfile(input?: {
  seedTrainerId?: string;
}) {
  const result = await mutateStore((store) => {
    const currentUser = getActorOrThrow(store);
    const accountCreated = !currentUser.participantProfileId;

    ensureRole(currentUser, "participant");
    if (!currentUser.participantProfileId) {
      currentUser.participantProfileId = buildParticipantProfileId(currentUser.phone);
    }
    upsertParticipantProfileFromUser(store, currentUser);

    if (input?.seedTrainerId) {
      currentUser.selectedTrainerIds = Array.from(
        new Set([...(currentUser.selectedTrainerIds ?? []), input.seedTrainerId]),
      );
    }

    return {
      ok: true as const,
      userId: currentUser.id,
      accountCreated,
    };
  });

  return result;
}

export async function ensurePhoneParticipantProfileForFlow(seedTrainerId?: string) {
  return ensurePhoneParticipantProfile({ seedTrainerId });
}

export function subscribePrivateStore(
  currentUser: AppUser,
  onPatch: (patch: StorePatch) => void,
): Unsubscribe {
  const listenerId = nextListenerId++;
  privateListeners.set(listenerId, onPatch);
  void ensureStoreLoaded().then((store) => {
    if (privateListeners.has(listenerId) && getCurrentSessionUserId() === currentUser.id) {
      onPatch(buildPrivatePatch(store));
    }
  });
  maybeStartPolling();

  return () => {
    privateListeners.delete(listenerId);
    maybeStopPolling();
  };
}

export async function signIn(email: string, password: string) {
  const store = await ensureStoreLoaded();
  const user = store.users.find(
    (item) =>
      String(item.email ?? "").toLowerCase() === email.trim().toLowerCase() &&
      item.password === password,
  );

  if (!user) {
    throw new Error("Nieprawidłowy email lub hasło.");
  }

  setCurrentSessionUserId(user.id);
  emitAuthListeners();
  emitStoreListeners();
  return cloneValue(user);
}

export async function signOut() {
  setCurrentSessionUserId(null);
  emitStoreListeners();
  emitAuthListeners();
}

export async function submitEnrollment(input: EnrollmentFormInput) {
  const photoUrl = await maybeReadFile(input.photoFile);

  await mutateStore((store) => {
    const actor = getActorOrThrow(store);
    const event = store.trainingEvents.find((item) => item.id === input.eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    if (!isCommunityBrandStatus(event.brandStatus) && !event.groupId) {
      throw new Error("To szkolenie nie przyjmuje już zapisów w tym trybie.");
    }

    ensureRole(actor, "participant");
    if (!actor.participantProfileId) {
      actor.participantProfileId = buildParticipantProfileId(actor.phone || input.telefon);
    }
    upsertParticipantProfileFromUser(store, actor);

    const existing = store.enrollmentRequests.find(
      (item) =>
        item.eventId === event.id &&
        item.participantProfileId === actor.participantProfileId &&
        item.participantStatus !== "cancelled",
    );
    if (existing) {
      throw new Error("To zgłoszenie jest już zapisane.");
    }

    const trainer = findTrainer(store, event.trainerId);
    const organizer = findOrganizer(store, event.organizerId);
    const requestId = createId("enrollment");

    store.enrollmentRequests.unshift({
      id: requestId,
      eventId: event.id,
      trainerId: event.trainerId ?? null,
      organizerId: event.organizerId ?? null,
      submitterUid: actor.id,
      participantProfileId: actor.participantProfileId,
      normalizedPhone: normalizePhoneLookupKey(input.telefon),
      trainerUserId: trainer?.userId ?? null,
      organizerUserId: organizer?.userId ?? null,
      intent: resolveEnrollmentIntent(input.intent),
      imieNazwisko: input.imieNazwisko.trim(),
      telefon: input.telefon.trim(),
      polecenieOdKogo: input.polecenieOdKogo.trim(),
      wiadomosc: input.wiadomosc.trim(),
      photoStatus: photoUrl ? "ready" : "pending",
      photoMode: resolvePhotoModeForEvent(event, store.appSettings.enrollmentPhotoMode),
      photoPath: photoUrl ?? undefined,
      photoUploadedAt: photoUrl ? nowIso() : undefined,
      finalStatus: deriveEnrollmentFinalStatus("pending"),
      participantStatus: "active",
      createdAt: nowIso(),
    });

    createNotification(
      store,
      trainer?.userId,
      "Nowe zgłoszenie uczestnika",
      `${input.imieNazwisko.trim()} zapisał(a) się na ${event.title || event.location}.`,
      "request",
    );
    createNotification(
      store,
      organizer?.userId,
      "Nowe zgłoszenie uczestnika",
      `${input.imieNazwisko.trim()} zapisał(a) się na ${event.title || event.location}.`,
      "request",
    );
  });
}

function resolvePhotoModeForEvent(
  event: Pick<TrainingEvent, "enrollmentPhotoRequirement">,
  defaultPhotoMode: PhotoMode,
): PhotoMode {
  if (event.enrollmentPhotoRequirement === "required") {
    return "required";
  }

  if (event.enrollmentPhotoRequirement === "optional") {
    return "optional";
  }

  return defaultPhotoMode;
}

function syncEventParticipantFromEnrollment(
  store: DemoStore,
  request: EnrollmentRequest,
  status: EventParticipant["status"],
) {
  const event = store.trainingEvents.find((item) => item.id === request.eventId);
  if (!event || !request.participantProfileId) {
    return;
  }

  const group = event.groupId
    ? store.groups.find((item) => item.id === event.groupId) ?? null
    : null;
  const participantProfile = store.participantProfiles.find(
    (item) => item.id === request.participantProfileId,
  );
  const activeGroupMember = event.groupId
    ? store.groupMembers.find(
        (item) =>
          item.groupId === event.groupId &&
          item.participantProfileId === request.participantProfileId &&
          item.membershipStatus === "active",
      )
    : null;

  if (!participantProfile) {
    throw new Error("Nie można zaakceptować zgłoszenia bez profilu uczestnika.");
  }

  const eventParticipantId = buildEventParticipantId(event.id, request.participantProfileId);
  const existingIndex = store.eventParticipants.findIndex((item) => item.id === eventParticipantId);
  const existingParticipant = existingIndex >= 0 ? store.eventParticipants[existingIndex] : null;
  const resolvedStatus =
    existingParticipant?.status === "confirmed" ? existingParticipant.status : status;
  const payload: EventParticipant = {
    id: eventParticipantId,
    eventId: event.id,
    eventTitle: event.title || event.location,
    groupId: group?.id ?? event.groupId ?? "",
    groupName: group?.name ?? event.groupName ?? event.title ?? event.location,
    organizerId: event.organizerId ?? group?.organizerId ?? "",
    organizerUserId: event.organizerUserId ?? group?.organizerUserId ?? "",
    trainerId: event.trainerId ?? group?.trainerId ?? "",
    trainerUserId: event.trainerUserId ?? group?.trainerUserId ?? "",
    participantProfileId: participantProfile.id,
    participantDisplayName: participantProfile.displayName,
    participantPhone: participantProfile.phone,
    participantUserId: participantProfile.linkedUserId ?? null,
    priority: activeGroupMember?.priority ?? "regularni",
    status: resolvedStatus,
    source: "public-form",
    invitedAt: nowIso(),
    confirmedAt:
      resolvedStatus === "confirmed" ? existingParticipant?.confirmedAt ?? nowIso() : undefined,
    updatedAt: nowIso(),
  };

  if (existingIndex >= 0) {
    store.eventParticipants[existingIndex] = {
      ...store.eventParticipants[existingIndex],
      ...payload,
    };
  } else {
    store.eventParticipants.unshift(payload);
  }

  request.eventParticipantId = eventParticipantId;
  recomputeEventEnrolledCount(store, event.id);
}

function markEventParticipantFromEnrollmentAsDeclined(
  store: DemoStore,
  request: Pick<EnrollmentRequest, "eventId" | "eventParticipantId" | "participantProfileId">,
) {
  const eventParticipantId =
    request.eventParticipantId ??
    (request.participantProfileId
      ? buildEventParticipantId(request.eventId, request.participantProfileId)
      : null);
  if (!eventParticipantId) {
    return;
  }

  const existingIndex = store.eventParticipants.findIndex((item) => item.id === eventParticipantId);
  if (existingIndex < 0) {
    return;
  }

  store.eventParticipants[existingIndex] = {
    ...store.eventParticipants[existingIndex],
    status: "declined",
    confirmedAt: undefined,
    declinedAt: nowIso(),
    removedAt: undefined,
    updatedAt: nowIso(),
  };
}

function transferEnrollmentRequestToEvent(
  store: DemoStore,
  request: EnrollmentRequest,
  targetEvent: TrainingEvent,
) {
  const trainer = findTrainer(store, targetEvent.trainerId);
  const organizer = findOrganizer(store, targetEvent.organizerId);
  const transferredRequest: EnrollmentRequest = {
    ...cloneValue(request),
    id: createId("enrollment"),
    eventId: targetEvent.id,
    trainerId: targetEvent.trainerId ?? null,
    organizerId: targetEvent.organizerId ?? null,
    trainerUserId: trainer?.userId ?? null,
    organizerUserId: organizer?.userId ?? null,
    eventParticipantId: null,
    createdAt: nowIso(),
    participantStatus: "active",
    participantManagedAt: undefined,
    participantActionSource: "staff",
    attendanceConfirmationStatus: undefined,
    attendanceConfirmationRequestedAt: undefined,
    attendanceConfirmationRespondedAt: undefined,
    finalStatus: deriveEnrollmentFinalStatus("pending"),
  };

  store.enrollmentRequests.unshift(transferredRequest);
}

export async function decideEnrollment(
  requestId: string,
  currentUser: AppUser,
  decision: "accepted" | "rejected",
) {
  await manageEnrollmentRequest({ requestId, decision }, currentUser);
}

export async function manageEnrollmentRequest(
  input: {
    requestId: string;
    decision: DecisionStatus;
    transferTargetEventId?: string | null;
  },
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const request = store.enrollmentRequests.find((item) => item.id === input.requestId);
    if (!request) {
      throw new Error("Nie znaleziono zgłoszenia.");
    }

    const event = store.trainingEvents.find((item) => item.id === request.eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia dla zgłoszenia.");
    }

    const canApproveRequest = canApproveEnrollmentRequest(event, currentUser);
    if (!canApproveRequest) {
      throw new Error("Nie możesz zarządzać tym zgłoszeniem.");
    }

    if (input.transferTargetEventId) {
      const targetEvent = store.trainingEvents.find(
        (item) => item.id === input.transferTargetEventId,
      );
      if (!targetEvent) {
        throw new Error("Nie znaleziono docelowego wydarzenia.");
      }

      if (targetEvent.id === event.id) {
        throw new Error("Wybierz inny termin docelowy.");
      }

      if (!canApproveEnrollmentRequest(targetEvent, currentUser)) {
        throw new Error("Nie możesz zarządzać docelowym wydarzeniem.");
      }

      request.participantStatus = "cancelled";
      request.participantManagedAt = nowIso();
      request.participantActionSource = "staff";
      markEventParticipantFromEnrollmentAsDeclined(store, request);
      recomputeEventEnrolledCount(store, event.id);
      transferEnrollmentRequestToEvent(store, request, targetEvent);
      return;
    }

    request.finalStatus = deriveEnrollmentFinalStatus(input.decision);

    if (request.finalStatus === "accepted") {
      syncEventParticipantFromEnrollment(store, request, event.groupId ? "invited" : "confirmed");
    }

    if (request.finalStatus === "rejected") {
      request.participantStatus = "cancelled";
      markEventParticipantFromEnrollmentAsDeclined(store, request);
    } else {
      request.participantStatus = "active";
    }

    recomputeEventEnrolledCount(store, event.id);
  });
}

export async function manageOwnGroupEventParticipation(
  input: {
    eventParticipantId: string;
    action: ParticipantGroupEventManagementInput["action"];
    transferTargetEventId?: string | null;
  },
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const entry = store.eventParticipants.find(
      (item) =>
        item.id === input.eventParticipantId &&
        item.participantUserId === currentUser.id,
    );

    if (!entry) {
      throw new Error("Nie znaleziono uczestnika wydarzenia.");
    }

    if (input.action === "cancel") {
      entry.status = "declined";
      entry.declinedAt = nowIso();
      entry.updatedAt = nowIso();
      recomputeEventEnrolledCount(store, entry.eventId);
      return;
    }

    if (!input.transferTargetEventId) {
      throw new Error("Wybierz docelowe wydarzenie.");
    }

    entry.status = "declined";
    entry.declinedAt = nowIso();
    entry.updatedAt = nowIso();
    recomputeEventEnrolledCount(store, entry.eventId);
    store.enrollmentRequests.unshift({
      id: createId("enrollment"),
      eventId: input.transferTargetEventId,
      trainerId: entry.trainerId,
      organizerId: entry.organizerId,
      submitterUid: currentUser.id,
      participantProfileId: entry.participantProfileId,
      normalizedPhone: normalizePhoneLookupKey(entry.participantPhone),
      trainerUserId: entry.trainerUserId,
      organizerUserId: entry.organizerUserId,
      intent: "participating",
      imieNazwisko: entry.participantDisplayName,
      telefon: entry.participantPhone,
      polecenieOdKogo: "Transfer uczestnika",
      wiadomosc: "Przeniesione przez uczestnika.",
      photoStatus: "pending",
      finalStatus: "pending",
      participantStatus: "active",
      createdAt: nowIso(),
    });
  });
}

export async function detachRelation(
  relationId: string,
  currentUser: AppUser,
  archiveLinkedEvents = false,
) {
  await mutateStore((store) => {
    const relation = store.relations.find((item) => item.id === relationId);
    if (!relation) {
      throw new Error("Nie znaleziono relacji.");
    }

    relation.status = "detached";
    relation.detachedAt = nowIso();
    relation.detachedByRole = currentUser.role;
    relation.archivedLinkedEvents = archiveLinkedEvents;

    if (archiveLinkedEvents) {
      store.trainingEvents = store.trainingEvents.map((event) => {
        if (event.trainerId !== relation.trainerId || event.organizerId !== relation.organizerId) {
          return event;
        }

        return {
          ...event,
          archivedAt: nowIso(),
          archivedByRole: currentUser.role,
          archivedReason: "relation-detached",
        };
      });
    }

    if (relation.organizerUserId) {
      const organizerUser = findUser(store, relation.organizerUserId);
      if (organizerUser) {
        syncOrganizerRoleFromRelations(store, organizerUser);
      }
    }
  });
}

export async function createGroup(input: GroupInput, actor: AppUser) {
  return mutateStore((store) => {
    ensureOrganizerFunctionsActive(actor);
    const organizerId = requireOrganizerProfileId(actor);
    if (!canOrganizerAccessTrainer(organizerId, input.trainerId, store.relations)) {
      throw new Error("Najpierw potrzebujesz aktywnego połączenia z tym trenerem.");
    }
    const groupId = createId("group");

    store.groups.unshift({
      id: groupId,
      name: input.name.trim(),
      organizerId,
      organizerUserId: actor.id,
      trainerId: input.trainerId,
      trainerUserId: findTrainer(store, input.trainerId)?.userId ?? undefined,
      status: "active",
      notes: input.notes?.trim(),
      defaultLocation: input.defaultLocation?.trim(),
      defaultEventType: input.defaultEventType,
      defaultCapacity: input.defaultCapacity,
      defaultTags: input.defaultTags ?? [],
      defaultConfirmationLeadTimeDays: input.defaultConfirmationLeadTimeDays,
      defaultJoinAudience: input.defaultJoinAudience,
      createdAt: nowIso(),
    });

    return {
      ok: true as const,
      groupId,
    };
  });
}

export async function updateGroup(input: GroupUpdateInput, actor: AppUser) {
  await mutateStore((store) => {
    const group = store.groups.find((item) => item.id === input.groupId);
    if (!group) {
      throw new Error("Nie znaleziono grupy.");
    }

    if (group.organizerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz edytować tej grupy.");
    }

    if (group.organizerUserId === actor.id && actor.role !== "admin") {
      ensureOrganizerFunctionsActive(actor);
    }

    group.name = input.name.trim();
    group.notes = input.notes?.trim();
    group.defaultLocation = input.defaultLocation?.trim();
    group.defaultEventType = input.defaultEventType;
    group.defaultCapacity = input.defaultCapacity;
    group.defaultTags = input.defaultTags ?? [];
    group.defaultConfirmationLeadTimeDays = input.defaultConfirmationLeadTimeDays;
    group.defaultJoinAudience = input.defaultJoinAudience;
    group.updatedAt = nowIso();
  });
}

export async function archiveGroup(groupId: string, actor: AppUser) {
  await mutateStore((store) => {
    const group = store.groups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Nie znaleziono grupy.");
    }

    if (group.organizerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz archiwizować tej grupy.");
    }

    if (group.organizerUserId === actor.id && actor.role !== "admin") {
      ensureOrganizerFunctionsActive(actor);
    }

    group.status = "archived";
    group.archivedAt = nowIso();
  });
}

export async function createOrUpdateOrganizerParticipantProfile(
  input: OrganizerParticipantProfileInput,
  actor: AppUser,
) {
  await mutateStore((store) => {
    ensureOrganizerFunctionsActive(actor);
    const organizerId = requireOrganizerProfileId(actor);
    const profileId = buildParticipantProfileId(input.phone);
    const existing = store.participantProfiles.find((item) => item.id === profileId);
    const split = splitDisplayName(input.displayName);

    if (existing) {
      existing.displayName = split.displayName;
      existing.firstName = split.firstName;
      existing.lastName = split.lastName;
      existing.notes = input.notes?.trim();
      existing.referralSource = input.referralSource?.trim();
      existing.managerOrganizerIds = Array.from(new Set([...(existing.managerOrganizerIds ?? []), organizerId]));
      existing.managerOrganizerUserIds = Array.from(
        new Set([...(existing.managerOrganizerUserIds ?? []), actor.id]),
      );
      existing.updatedAt = nowIso();
      return;
    }

    store.participantProfiles.unshift({
      id: profileId,
      linkedUserId: null,
      displayName: split.displayName,
      firstName: split.firstName,
      lastName: split.lastName,
      phone: input.phone.trim(),
      phoneLookupKey: normalizePhoneLookupKey(input.phone),
      notes: input.notes?.trim(),
      referralSource: input.referralSource?.trim(),
      confirmationStatus: "unconfirmed",
      status: "active",
      createdAt: nowIso(),
      createdByOrganizerId: organizerId,
      createdByUserId: actor.id,
      managerOrganizerIds: [organizerId],
      managerOrganizerUserIds: [actor.id],
    });
  });
}

export async function addGroupMember(input: GroupMemberInput, actor: AppUser) {
  return mutateStore((store) => {
    const group = store.groups.find((item) => item.id === input.groupId);
    if (!group) {
      throw new Error("Nie znaleziono grupy.");
    }

    if (group.organizerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz dodawać członków do tej grupy.");
    }

    if (group.organizerUserId === actor.id && actor.role !== "admin") {
      ensureOrganizerFunctionsActive(actor);
    }

    let participantProfileId = input.participantProfileId?.trim() || undefined;
    let profile = participantProfileId
      ? store.participantProfiles.find((item) => item.id === participantProfileId)
      : undefined;

    if (participantProfileId && !profile) {
      throw new Error("Nie znaleziono profilu uczestnika.");
    }

    if (!participantProfileId) {
      if (!input.displayName?.trim() || !input.phone?.trim()) {
        throw new Error("Podaj imię i nazwisko oraz numer telefonu.");
      }

      participantProfileId = buildParticipantProfileId(input.phone);
      const existingProfile = store.participantProfiles.find((item) => item.id === participantProfileId);
      if (existingProfile) {
        profile = existingProfile;
      } else {
        const split = splitDisplayName(input.displayName);
        store.participantProfiles.unshift({
          id: participantProfileId,
          linkedUserId: null,
          displayName: split.displayName,
          firstName: split.firstName,
          lastName: split.lastName,
          phone: input.phone.trim(),
          phoneLookupKey: normalizePhoneLookupKey(input.phone),
          notes: input.notes?.trim(),
          referralSource: input.referralSource?.trim(),
          confirmationStatus: "unconfirmed",
          status: "active",
          createdAt: nowIso(),
          createdByOrganizerId: group.organizerId,
          createdByUserId: actor.id,
        });
        profile = store.participantProfiles[0];
      }
    }

    if (!profile) {
      throw new Error("Nie znaleziono profilu uczestnika.");
    }

    const memberId = buildGroupMemberId(group.id, participantProfileId);
    const existingMember = store.groupMembers.find((item) => item.id === memberId);
    if (existingMember) {
      existingMember.membershipStatus = "active";
      existingMember.participantUserId = profile.linkedUserId ?? null;
      existingMember.participantDisplayName = profile.displayName;
      existingMember.participantPhone = profile.phone;
      existingMember.priority = asParticipantPriority(input.priority);
      existingMember.notes = input.notes?.trim();
      existingMember.updatedAt = nowIso();
      syncParticipantProfileGroupMembership(profile, group, existingMember);
      if (input.syncFutureEvents) {
        syncGroupMemberToFutureOpenEvents(store, group, existingMember);
      }
      return {
        ok: true as const,
        memberId,
        participantProfileId,
      };
    }

    store.groupMembers.unshift({
      id: memberId,
      groupId: group.id,
      organizerId: group.organizerId,
      organizerUserId: group.organizerUserId,
      trainerId: group.trainerId,
      trainerUserId: group.trainerUserId,
      participantProfileId,
      participantUserId: profile.linkedUserId ?? null,
      participantDisplayName: profile.displayName,
      participantPhone: profile.phone,
      priority: asParticipantPriority(input.priority),
      membershipStatus: "active",
      notes: input.notes?.trim(),
      joinedAt: nowIso(),
    });
    syncParticipantProfileGroupMembership(profile, group, store.groupMembers[0]);
    if (input.syncFutureEvents) {
      syncGroupMemberToFutureOpenEvents(store, group, store.groupMembers[0]);
    }

    return {
      ok: true as const,
      memberId,
      participantProfileId,
    };
  });
}

export async function updateGroupMember(input: GroupMemberUpdateInput, actor: AppUser) {
  await mutateStore((store) => {
    const member = store.groupMembers.find((item) => item.id === input.memberId);
    if (!member) {
      throw new Error("Nie znaleziono członka grupy.");
    }

    if (member.organizerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz edytować tego członka.");
    }

    if (member.organizerUserId === actor.id && actor.role !== "admin") {
      ensureOrganizerFunctionsActive(actor);
    }

    member.priority = asParticipantPriority(input.priority);
    member.notes = input.notes?.trim();
    member.updatedAt = nowIso();
  });
}

export async function removeGroupMember(memberId: string, actor: AppUser) {
  await mutateStore((store) => {
    const member = store.groupMembers.find((item) => item.id === memberId);
    if (!member) {
      throw new Error("Nie znaleziono członka grupy.");
    }

    if (member.organizerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz usunąć tego członka.");
    }

    if (member.organizerUserId === actor.id && actor.role !== "admin") {
      ensureOrganizerFunctionsActive(actor);
    }

    member.membershipStatus = "removed";
    member.removedAt = nowIso();
    member.updatedAt = nowIso();

    const profile = store.participantProfiles.find((item) => item.id === member.participantProfileId);
    if (profile) {
      profile.activeGroupIds = (profile.activeGroupIds ?? []).filter((item) => item !== member.groupId);
      profile.updatedAt = nowIso();
    }
  });
}

export async function addEventParticipant(input: EventParticipantInput, actor: AppUser) {
  return mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === input.eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    const group = store.groups.find((item) => item.id === event.groupId);
    const profile = store.participantProfiles.find((item) => item.id === input.participantProfileId);
    const activeGroupMember = store.groupMembers.find(
      (item) =>
        item.groupId === event.groupId &&
        item.participantProfileId === input.participantProfileId &&
        item.membershipStatus === "active",
    );
    if (!group || !profile) {
      throw new Error("Nie znaleziono wymaganych danych.");
    }

    const eventParticipantId = buildEventParticipantId(event.id, profile.id);
    if (store.eventParticipants.some((item) => item.id === eventParticipantId)) {
      return {
        ok: true as const,
        eventParticipantId,
      };
    }

    store.eventParticipants.unshift({
      id: eventParticipantId,
      eventId: event.id,
      eventTitle: event.title || event.location,
      groupId: group.id,
      groupName: group.name,
      organizerId: group.organizerId,
      organizerUserId: group.organizerUserId ?? actor.id,
      trainerId: group.trainerId,
      trainerUserId: group.trainerUserId ?? "",
      participantProfileId: profile.id,
      participantDisplayName: profile.displayName,
      participantPhone: profile.phone,
      participantUserId: profile.linkedUserId ?? null,
      priority: activeGroupMember?.priority ?? "regularni",
      status: "invited",
      source: "organizer",
      overCapacity: input.overCapacity === true,
      invitedAt: nowIso(),
    });
    recomputeEventEnrolledCount(store, event.id);

    return {
      ok: true as const,
      eventParticipantId,
    };
  });
}

export async function updateEventParticipantStatus(
  input: EventParticipantStatusUpdateInput,
  actor: AppUser,
) {
  await mutateStore((store) => {
    const participant = store.eventParticipants.find((item) => item.id === input.eventParticipantId);
    if (!participant) {
      throw new Error("Nie znaleziono uczestnika wydarzenia.");
    }

    if (
      participant.organizerUserId !== actor.id &&
      participant.trainerUserId !== actor.id &&
      actor.role !== "admin"
    ) {
      throw new Error("Nie możesz zmieniać statusu tego uczestnika.");
    }

    participant.status = input.status;
    participant.updatedAt = nowIso();
    if (input.status === "confirmed") {
      participant.confirmedAt = nowIso();
    }
    if (input.status === "declined" || input.status === "removed") {
      participant.declinedAt = nowIso();
    }
    if (input.status !== "confirmed") {
      participant.confirmedAt = input.status === "confirmed" ? participant.confirmedAt : undefined;
    }

    recomputeEventEnrolledCount(store, participant.eventId);
  });
}

export async function finalizeEventRoster(eventId: string, actor: AppUser) {
  await mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    if (
      event.organizerUserId !== actor.id &&
      event.trainerUserId !== actor.id &&
      actor.role !== "admin"
    ) {
      throw new Error("Nie możesz finalizować rosteru tego wydarzenia.");
    }

    event.rosterFinalizedAt = nowIso();
    event.rosterFinalizedByUserId = actor.id;
  });
}

export async function addAvailabilitySlot(input: AvailabilityInput, actor: AppUser) {
  await mutateStore((store) => {
    const trainerId =
      actor.role === "trainer" ? requireTrainerProfileId(store, actor) : input.trainerId;

    store.availabilitySlots.unshift({
      id: createId("availability"),
      trainerId,
      trainerUserId: findTrainer(store, trainerId)?.userId ?? actor.id,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location.trim(),
      notes: input.notes.trim(),
      visibility: "approved-organizers",
      visibleToOrganizerIds: [],
    });
  });
}

export async function addTrainerCalendarFeed(input: TrainerCalendarFeedInput, actor: AppUser) {
  await mutateStore((store) => {
    const trainerId = requireTrainerProfileId(store, actor);
    store.trainerCalendarFeeds.unshift({
      id: createId("trainer-feed"),
      trainerId,
      trainerUserId: actor.id,
      provider: input.provider,
      url: input.url.trim(),
      enabled: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
}

export async function updateTrainerCalendarFeedEnabled(
  feedId: string,
  enabled: boolean,
  actor: AppUser,
) {
  await mutateStore((store) => {
    const feed = store.trainerCalendarFeeds.find((item) => item.id === feedId);
    if (!feed) {
      throw new Error("Nie znaleziono feedu kalendarza.");
    }

    if (feed.trainerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz zmieniać tego feedu.");
    }

    feed.enabled = enabled;
    feed.updatedAt = nowIso();
  });
}

export async function removeTrainerCalendarFeed(feedId: string, actor: AppUser) {
  await mutateStore((store) => {
    const feed = store.trainerCalendarFeeds.find((item) => item.id === feedId);
    if (!feed) {
      throw new Error("Nie znaleziono feedu kalendarza.");
    }

    if (feed.trainerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz usunąć tego feedu.");
    }

    store.trainerCalendarFeeds = store.trainerCalendarFeeds.filter((item) => item.id !== feedId);
  });
}

export async function syncOwnTrainerCalendarFeeds(actor: AppUser) {
  await mutateStore((store) => {
    const trainerId = requireTrainerProfileId(store, actor);
    store.trainerCalendarFeeds = store.trainerCalendarFeeds.map((feed) =>
      feed.trainerId === trainerId
        ? {
            ...feed,
            updatedAt: nowIso(),
            syncRequestedAt: nowIso(),
          }
        : feed,
    );
  });
}

export async function addTrainerSharedSlot(input: TrainerSharedSlotInput, actor: AppUser) {
  await mutateStore((store) => {
    const trainerId = requireTrainerProfileId(store, actor);
    store.trainerSharedSlots.unshift({
      id: createId("shared-slot"),
      trainerId,
      trainerUserId: actor.id,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location.trim(),
      notes: input.notes.trim(),
      source: input.source ?? "manual",
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
}

export async function updateTrainerSharedSlot(input: TrainerSharedSlotUpdateInput, actor: AppUser) {
  await mutateStore((store) => {
    const slot = store.trainerSharedSlots.find((item) => item.id === input.slotId);
    if (!slot) {
      throw new Error("Nie znaleziono slotu.");
    }

    if (slot.trainerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz zmieniać tego slotu.");
    }

    slot.startsAt = input.startsAt;
    slot.endsAt = input.endsAt;
    slot.location = input.location.trim();
    slot.notes = input.notes.trim();
    slot.updatedAt = nowIso();
  });
}

export async function archiveTrainerSharedSlot(slotId: string, actor: AppUser) {
  await mutateStore((store) => {
    const slot = store.trainerSharedSlots.find((item) => item.id === slotId);
    if (!slot) {
      throw new Error("Nie znaleziono slotu.");
    }

    if (slot.trainerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz archiwizować tego slotu.");
    }

    slot.status = "archived";
    slot.updatedAt = nowIso();
  });
}

export async function addOrganizerCalendarFeed(input: OrganizerCalendarFeedInput, actor: AppUser) {
  await mutateStore((store) => {
    const organizerId = requireOrganizerProfileId(actor);
    store.organizerCalendarFeeds.unshift({
      id: createId("organizer-feed"),
      organizerId,
      organizerUserId: actor.id,
      provider: input.provider,
      url: input.url.trim(),
      enabled: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
}

export async function updateOrganizerCalendarFeedEnabled(
  feedId: string,
  enabled: boolean,
  actor: AppUser,
) {
  await mutateStore((store) => {
    const feed = store.organizerCalendarFeeds.find((item) => item.id === feedId);
    if (!feed) {
      throw new Error("Nie znaleziono feedu organizatora.");
    }

    if (feed.organizerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz zmieniać tego feedu.");
    }

    feed.enabled = enabled;
    feed.updatedAt = nowIso();
  });
}

export async function removeOrganizerCalendarFeed(feedId: string, actor: AppUser) {
  await mutateStore((store) => {
    const feed = store.organizerCalendarFeeds.find((item) => item.id === feedId);
    if (!feed) {
      throw new Error("Nie znaleziono feedu organizatora.");
    }

    if (feed.organizerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz usunąć tego feedu.");
    }

    store.organizerCalendarFeeds = store.organizerCalendarFeeds.filter((item) => item.id !== feedId);
  });
}

export async function syncOwnOrganizerCalendarFeeds(actor: AppUser) {
  await mutateStore((store) => {
    const organizerId = requireOrganizerProfileId(actor);
    store.organizerCalendarFeeds = store.organizerCalendarFeeds.map((feed) =>
      feed.organizerId === organizerId
        ? {
            ...feed,
            updatedAt: nowIso(),
            syncRequestedAt: nowIso(),
          }
        : feed,
    );
  });
}

function createEventBase(
  store: DemoStore,
  actor: AppUser,
  input:
    | TrainingEventInput
    | OrganizerTrainingDraftInput
    | OrganizerTrainingDraftUpdateInput,
) {
  const trainerId =
    "trainerId" in input && input.trainerId ? input.trainerId : actor.trainerProfileId ?? null;
  const organizerId = actor.organizerProfileId ?? ("organizerId" in input ? input.organizerId ?? null : null);
  const trainer = findTrainer(store, trainerId);
  const organizer = findOrganizer(store, organizerId);

  return {
    trainerId,
    organizerId,
    trainerUserId: trainer?.userId ?? null,
    organizerUserId: organizer?.userId ?? null,
    creatorUserId: actor.id,
    creatorDisplayName: resolveEventCreatorDisplayName(actor, input, organizer, trainer),
    title: input.title?.trim() || input.location.trim(),
    summary: input.summary.trim(),
    description: input.description.trim(),
    type: input.type.trim(),
    startsAt: input.scheduleDays[0]?.startsAt ?? nowIso(),
    endsAt: input.scheduleDays[input.scheduleDays.length - 1]?.endsAt ?? nowIso(),
    scheduleDays: cloneValue(input.scheduleDays),
    location: input.location.trim(),
    tags: cloneValue(input.tags ?? []),
    capacity: input.capacity,
    isPublished: "isPublished" in input ? Boolean(input.isPublished) : false,
    imageHint: isCommunityBrandStatus(input.brandStatus ?? "official")
      ? "community event"
      : "training event",
    brandStatus: input.brandStatus ?? "official",
    status: input.status ?? "active",
    minimumParticipants: input.minimumParticipants ?? 1,
  };
}

export async function createOrganizerTrainingDraft(
  input: OrganizerTrainingDraftInput,
  actor: AppUser,
) {
  await mutateStore((store) => {
    ensureOrganizerFunctionsActive(actor);
    const group = store.groups.find((item) => item.id === input.groupId);
    if (!group) {
      throw new Error("Nie znaleziono grupy.");
    }

    const base = createEventBase(store, actor, input);
    store.trainingEvents.unshift({
      id: createId("event"),
      ...base,
      groupId: group.id,
      groupName: group.name,
      eventImages: cloneValue(input.eventImages ?? []),
      useEventImageAsCover: input.useEventImageAsCover === true,
      eventTypeSystem: input.eventTypeSystem ?? group.defaultEventType,
      enrolledCount: 0,
      workflowStatus: "draft-requested",
      publishAutomaticallyAfterTrainerApproval: input.publishAutomaticallyAfterTrainerApproval,
      requiresOrganizerApproval: false,
      eligibleGroupPriorities: cloneValue(input.eligibleGroupPriorities ?? ["stali", "regularni"]),
      confirmationLeadTimeDays: input.confirmationLeadTimeDays ?? group.defaultConfirmationLeadTimeDays,
      trainerCollaborationStatus: "pending",
      organizerCollaborationStatus: "accepted",
      sharedSlotId: input.sharedSlotId,
      createdByRole: "organizer",
      publicationApprovalStatus: isCommunityBrandStatus(base.brandStatus) ? "pending" : undefined,
      enrollmentPhotoRequirement: "optional",
      joinAudienceSetting: "default",
    });
  });
}

export async function updateOrganizerTrainingDraft(
  input: OrganizerTrainingDraftUpdateInput,
  actor: AppUser,
) {
  await mutateStore((store) => {
    if (actor.role !== "admin") {
      ensureOrganizerFunctionsActive(actor);
    }

    const event = store.trainingEvents.find((item) => item.id === input.eventId);
    if (!event) {
      throw new Error("Nie znaleziono draftu.");
    }

    if (event.organizerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz zmieniać tego draftu.");
    }

    const group = store.groups.find((item) => item.id === input.groupId);
    if (!group) {
      throw new Error("Nie znaleziono grupy.");
    }

    const base = createEventBase(store, actor, input);
    Object.assign(event, {
      ...base,
      groupId: group.id,
      groupName: group.name,
      eventImages: cloneValue(input.eventImages ?? []),
      useEventImageAsCover: input.useEventImageAsCover === true,
      eventTypeSystem: input.eventTypeSystem ?? group.defaultEventType,
      sharedSlotId: input.sharedSlotId,
      eligibleGroupPriorities: cloneValue(input.eligibleGroupPriorities ?? event.eligibleGroupPriorities ?? []),
      confirmationLeadTimeDays:
        input.confirmationLeadTimeDays ?? event.confirmationLeadTimeDays ?? group.defaultConfirmationLeadTimeDays,
      joinAudienceSetting: event.joinAudienceSetting ?? "default",
    });
  });
}

export async function withdrawOrganizerTrainingDraft(eventId: string, actor: AppUser) {
  await mutateStore((store) => {
    if (actor.role !== "admin") {
      ensureOrganizerFunctionsActive(actor);
    }

    const event = store.trainingEvents.find((item) => item.id === eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    if (event.organizerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz wycofać tego draftu.");
    }

    event.workflowStatus = "withdrawn";
    event.withdrawnAt = nowIso();
    event.withdrawnByUserId = actor.id;
    event.isPublished = false;
  });
}

export async function decideOrganizerTrainingDraft(
  input: OrganizerTrainingDraftDecisionInput,
  actor: AppUser,
) {
  await mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === input.eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    if (event.trainerUserId !== actor.id && actor.role !== "admin") {
      throw new Error("Nie możesz zdecydować o tym drafcie.");
    }

    event.trainerCollaborationStatus = input.decision;
    event.trainerDecidedAt = nowIso();
    event.trainerDecidedByUserId = actor.id;
    event.trainerDecisionReason = input.message?.trim();
    event.workflowStatus = input.decision === "accepted" ? "trainer-accepted" : "trainer-rejected";
    if (input.decision === "accepted") {
      event.isPublished = !isCommunityBrandStatus(event.brandStatus);
    }
  });
}

export async function resetTrainerOrganizerCalendarFeedToken(
  relationId: string,
  actor: AppUser,
) {
  return mutateStore((store) => {
    const relation = store.relations.find((item) => item.id === relationId);
    if (!relation) {
      throw new Error("Nie znaleziono relacji.");
    }

    if (
      relation.organizerUserId !== actor.id &&
      relation.trainerUserId !== actor.id &&
      actor.role !== "admin"
    ) {
      throw new Error("Nie możesz zresetować tokenu tej relacji.");
    }

    const token = createId("feed");
    const publicFeedUrl = `${window.location.origin}${getBasePath()}api/ical/trainer-organizer/${token}.ics`;
    const existing = store.trainerOrganizerCalendarFeeds.find((item) => item.id === relation.id);
    if (existing) {
      existing.token = token;
      existing.publicFeedUrl = publicFeedUrl;
      existing.updatedAt = nowIso();
    } else {
      store.trainerOrganizerCalendarFeeds.unshift({
        id: relation.id,
        relationId: relation.id,
        trainerId: relation.trainerId,
        organizerId: relation.organizerId,
        trainerUserId: relation.trainerUserId ?? "",
        organizerUserId: relation.organizerUserId ?? "",
        token,
        publicFeedUrl,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    return {
      ok: true as const,
      token,
    };
  });
}

export async function getTrainerOrganizerGoogleCalendarSubscribeUrl(
  relationId: string,
  actor: AppUser,
) {
  const store = await ensureStoreLoaded();
  const feed = store.trainerOrganizerCalendarFeeds.find((item) => item.id === relationId);
  if (!feed) {
    await resetTrainerOrganizerCalendarFeedToken(relationId, actor);
    const refreshedStore = await ensureStoreLoaded();
    return (
      refreshedStore.trainerOrganizerCalendarFeeds.find((item) => item.id === relationId)?.publicFeedUrl ??
      ""
    );
  }

  return feed.publicFeedUrl ?? "";
}

export async function createTrainingEvent(input: TrainingEventInput, actor: AppUser) {
  return createUnifiedTrainingEvent(input, actor);
}

export async function createUnifiedTrainingEvent(input: TrainingEventInput, actor: AppUser) {
  await mutateStore((store) => {
    if (!isCommunityBrandStatus(input.brandStatus) && actor.role === "organizer") {
      ensureOrganizerFunctionsActive(actor);
    }

    const group = !isCommunityBrandStatus(input.brandStatus)
      ? store.groups.find((item) => item.id === input.groupId)
      : null;
    if (!isCommunityBrandStatus(input.brandStatus) && !group) {
      throw new Error("Oficjalne szkolenie musi być przypięte do grupy.");
    }

    const base = createEventBase(store, actor, input);
    const organizerHasActiveTrainerRelation =
      actor.role === "organizer" &&
      Boolean(group?.organizerId) &&
      Boolean(base.trainerId) &&
      canOrganizerAccessTrainer(group.organizerId, base.trainerId, store.relations);

    const nextEvent: TrainingEvent = {
      id: createId("event"),
      ...base,
      organizerId: group?.organizerId ?? base.organizerId,
      organizerUserId:
        group?.organizerId
          ? store.organizers.find((item) => item.id === group.organizerId)?.userId ?? null
          : base.organizerUserId,
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
      eventImages: cloneValue(input.eventImages ?? []),
      useEventImageAsCover: input.useEventImageAsCover === true,
      eventTypeSystem: input.eventTypeSystem ?? group?.defaultEventType ?? null,
      enrolledCount: 0,
      workflowStatus: "published",
      requiresOrganizerApproval:
        !group?.organizerId ? false : !isCommunityBrandStatus(base.brandStatus),
      eligibleGroupPriorities: cloneValue(input.eligibleGroupPriorities ?? ["stali", "regularni"]),
      confirmationLeadTimeDays:
        input.confirmationLeadTimeDays ?? group?.defaultConfirmationLeadTimeDays ?? 5,
      trainerCollaborationStatus:
        actor.role === "organizer" && base.trainerId
          ? organizerHasActiveTrainerRelation && !isCommunityBrandStatus(base.brandStatus)
            ? "accepted"
            : "pending"
          : "accepted",
      organizerCollaborationStatus:
        actor.role === "trainer" && group?.organizerId ? "pending" : resolveOrganizerCollaborationStatus({
          ...base,
          organizerId: group?.organizerId ?? base.organizerId,
          selfManagedByTrainer: false,
        }),
      selfManagedByTrainer: false,
      createdByRole: actor.role,
      publicationApprovalStatus: isCommunityBrandStatus(base.brandStatus)
        ? input.isPublished
          ? "pending"
          : "pending"
        : undefined,
      enrollmentPhotoRequirement: "optional",
      joinAudienceSetting: input.joinAudienceSetting ?? group?.defaultJoinAudience ?? "default",
    };

    store.trainingEvents.unshift(nextEvent);

    if (nextEvent.groupId) {
      syncGroupRosterToEvent(store, nextEvent);
    } else {
      recomputeEventEnrolledCount(store, nextEvent.id);
    }
  });
}

export async function uploadCommunityEventImages(files: File[]) {
  const images = await Promise.all(
    files.map(async (file) => {
      const url = await readFileAsDataUrl(file);

      return {
        id: createId("event-image"),
        url,
        storagePath: `mock://event-images/${createId("asset")}`,
        width: 1200,
        height: 800,
      } satisfies TrainingEventImage;
    }),
  );

  return images;
}

export async function registerParticipant(input: ParticipantRegistrationInput) {
  const avatarUrl = await maybeReadFile(input.avatarFile);

  await mutateStore((store) => {
    const actor = getActorOrThrow(store);
    if (!input.trainingDataConsentAccepted) {
      throw new Error(
        "Zaznacz zgodę na przetwarzanie danych osobowych do celów organizacji szkoleń.",
      );
    }

    actor.displayName = input.displayName.trim();
    actor.notes = input.notes.trim();
    actor.phone = input.phone.trim();
    actor.phoneVerifiedAt = actor.phoneVerifiedAt ?? nowIso();
    actor.participantOnboardingCompletedAt = nowIso();
    actor.trainingDataConsentAccepted = true;
    actor.trainingDataConsentAcceptedAt = nowIso();

    if (avatarUrl) {
      actor.avatarUrl = avatarUrl;
      actor.avatarPath = avatarUrl;
    }

    ensureRole(actor, "participant");
    if (!actor.participantProfileId) {
      actor.participantProfileId = buildParticipantProfileId(actor.phone);
    }
    upsertParticipantProfileFromUser(store, actor);

    const participantProfile = store.participantProfiles.find(
      (item) => item.id === actor.participantProfileId,
    );
    if (participantProfile) {
      const name = splitDisplayName(actor.displayName);
      participantProfile.displayName = name.displayName;
      participantProfile.firstName = name.firstName;
      participantProfile.lastName = name.lastName;
      participantProfile.linkedUserId = actor.id;
      participantProfile.phone = actor.phone;
      participantProfile.phoneLookupKey = normalizePhoneLookupKey(actor.phone);
      participantProfile.confirmationStatus = actor.phoneVerifiedAt ? "confirmed" : "unconfirmed";
      participantProfile.confirmedAt = actor.phoneVerifiedAt;
      participantProfile.notes = actor.notes;
      participantProfile.updatedAt = nowIso();
      if (avatarUrl) {
        participantProfile.avatarUrl = avatarUrl;
        participantProfile.avatarPath = avatarUrl;
      }
    }
  });
}

export async function connectOrganizerToTrainerWithCode(
  trainerAuthorizationCode: string,
  expectedTrainerId?: string,
) {
  return mutateStore((store) => {
    const actor = getActorOrThrow(store);
    if (isOrganizerFunctionsBlocked(actor)) {
      throw new Error("Funkcje organizatora są zablokowane przez moderatora lub admina.");
    }
    const normalizedCode = trainerAuthorizationCode.trim().toUpperCase();
    const trainer = store.trainers.find(
      (item) => resolveTrainerAuthorizationCode(item as TrainerProfile & { authorizationCode?: string }) === normalizedCode,
    );

    if (!trainer) {
      throw new Error("Nie znaleziono trenera dla tego kodu.");
    }

    if (expectedTrainerId && trainer.id !== expectedTrainerId) {
      throw new Error("Ten kod należy do innego Przekazującego Wiedzę.");
    }

    ensureRole(actor, "participant");
    let organizerId = actor.organizerProfileId;
    let organizerProfileCreated = false;

    if (!organizerId) {
      organizerId = ensureOrganizerProfileRecord(store, actor).id;
      organizerProfileCreated = true;
    }

    const relationId = buildRelationId(trainer.id, organizerId);
    const existing = store.relations.find((item) => item.id === relationId);
    if (existing) {
      existing.status = "approved";
      existing.detachedAt = undefined;
      existing.detachedByRole = undefined;
      existing.archivedLinkedEvents = undefined;
    } else {
      store.relations.unshift({
        id: relationId,
        trainerId: trainer.id,
        organizerId,
        trainerUserId: trainer.userId,
        organizerUserId: actor.id,
        status: "approved",
        requestedBy: "organizer",
        createdAt: nowIso(),
      });
    }

    syncOrganizerRoleFromRelations(store, actor);

    return {
      ok: true as const,
      trainerId: trainer.id,
      organizerProfileCreated,
    };
  });
}

export async function completeParticipantOnboarding(input: ParticipantOnboardingInput) {
  const avatarUrl = await maybeReadFile(input.avatarFile);

  await mutateStore((store) => {
    const actor = getActorOrThrow(store);
    actor.displayName = input.displayName.trim();
    actor.notes = input.notes?.trim();
    actor.selectedTrainerIds = cloneValue(input.selectedTrainerIds);
    actor.participantOnboardingCompletedAt = nowIso();
    if (avatarUrl) {
      actor.avatarUrl = avatarUrl;
      actor.avatarPath = avatarUrl;
    }

    ensureRole(actor, "participant");
    if (!actor.participantProfileId) {
      actor.participantProfileId = buildParticipantProfileId(actor.phone);
    }
    upsertParticipantProfileFromUser(store, actor);

    const participantProfile = store.participantProfiles.find(
      (item) => item.id === actor.participantProfileId,
    );
    if (participantProfile) {
      const name = splitDisplayName(actor.displayName);
      participantProfile.displayName = name.displayName;
      participantProfile.firstName = name.firstName;
      participantProfile.lastName = name.lastName;
      participantProfile.linkedUserId = actor.id;
      participantProfile.notes = actor.notes;
      participantProfile.updatedAt = nowIso();
      if (avatarUrl) {
        participantProfile.avatarUrl = avatarUrl;
        participantProfile.avatarPath = avatarUrl;
      }
    }
  });
}

export async function getCommunityEventReview(token: string) {
  const store = await ensureStoreLoaded();
  const event = store.trainingEvents.find((item) => item.id === token);
  if (!event || !isCommunityBrandStatus(event.brandStatus)) {
    throw new Error("Nie znaleziono wydarzenia do moderacji.");
  }

  return {
    ok: true as const,
    event: cloneValue(event),
    creatorName: event.creatorDisplayName || "Autor wydarzenia",
    creatorPhone: event.creatorPhone || findUser(store, event.creatorUserId)?.phone || "",
  };
}

export async function reviewCommunityEvent(input: {
  token: string;
  decision: "accepted" | "rejected";
  message?: string;
}) {
  return mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === input.token);
    if (!event || !isCommunityBrandStatus(event.brandStatus)) {
      throw new Error("Nie znaleziono wydarzenia do moderacji.");
    }

    event.publicationApprovalStatus = input.decision;
    event.publicationReviewMessage = input.message?.trim();
    event.publicationReviewedAt = nowIso();
    event.publicationReviewedByUserId = getCurrentSessionUserId() ?? "mock-review";
    event.isPublished = input.decision === "accepted";

    return {
      ok: true as const,
      eventId: event.id,
    };
  });
}

export async function updateTrainerProfile(input: TrainerProfileUpdateInput, currentUser: AppUser) {
  const avatarUrl = await maybeReadFile(input.avatarFile);
  const avatarCrop = input.avatarCrop ? cloneValue(input.avatarCrop) : undefined;

  await mutateStore((store) => {
    const trainer = findTrainer(store, requireTrainerProfileId(store, currentUser));
    if (!trainer) {
      throw new Error("Nie znaleziono profilu trenera.");
    }

    trainer.heroNote = input.heroNote.trim();
    trainer.bio = input.bio.trim();
    trainer.specialties = cloneValue(input.specialties);
    trainer.locations = cloneValue(input.locations);
    const nextAuthorizationCode = input.authorizationCode?.trim().toUpperCase();
    if (nextAuthorizationCode) {
      trainer.authorizationCode = nextAuthorizationCode;
      trainer.authorizationCodeConfigured = true;
      trainer.authorizationCodeUpdatedAt = nowIso();
    }
    if (avatarUrl) {
      trainer.avatarUrl = avatarUrl;
      trainer.avatarPath = avatarUrl;
      trainer.avatarUploadedAt = nowIso();
    }
    if (avatarCrop) {
      trainer.avatarCrop = avatarCrop;
    }
  });
}

export async function updateParticipantProfile(
  input: ParticipantProfileUpdateInput,
  currentUser: AppUser,
) {
  const avatarUrl = await maybeReadFile(input.avatarFile);
  const avatarCrop = input.avatarCrop ? cloneValue(input.avatarCrop) : undefined;
  const nextDisplayName = input.displayName.trim();
  const nextReferralSource = input.referralSource?.trim();
  const nextNotes = input.notes?.trim();

  await mutateStore((store) => {
    const user = findUser(store, currentUser.id);
    if (!user) {
      throw new Error("Nie znaleziono użytkownika.");
    }

    user.displayName = nextDisplayName;
    user.referralSource = nextReferralSource;
    user.notes = nextNotes;
    if (avatarUrl) {
      user.avatarUrl = avatarUrl;
      user.avatarPath = avatarUrl;
    }
    if (avatarCrop) {
      user.avatarCrop = avatarCrop;
    }

    const profile = store.participantProfiles.find((item) => item.id === user.participantProfileId);
    if (profile) {
      const split = splitDisplayName(nextDisplayName);
      profile.displayName = split.displayName;
      profile.firstName = split.firstName;
      profile.lastName = split.lastName;
      profile.referralSource = nextReferralSource;
      profile.notes = nextNotes;
      profile.updatedAt = nowIso();
      if (avatarUrl) {
        profile.avatarUrl = avatarUrl;
        profile.avatarPath = avatarUrl;
      }
      if (avatarCrop) {
        profile.avatarCrop = avatarCrop;
      }
    }

    if (user.trainerProfileId) {
      const trainer = store.trainers.find((item) => item.id === user.trainerProfileId);
      if (trainer) {
        trainer.displayName = nextDisplayName;
        if (avatarUrl) {
          trainer.avatarUrl = avatarUrl;
          trainer.avatarPath = avatarUrl;
          trainer.avatarUploadedAt = nowIso();
        }
        if (avatarCrop) {
          trainer.avatarCrop = avatarCrop;
        }
      }
    }
  });
}

export async function updateOrganizerProfile(
  input: OrganizerProfileUpdateInput,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const user = findUser(store, currentUser.id);
    if (!user) {
      throw new Error("Nie znaleziono użytkownika.");
    }

    const organizer = ensureOrganizerProfileRecord(store, user);

    organizer.displayName = input.displayName.trim();
    organizer.contactName = input.contactName.trim();
    organizer.location = input.location.trim();
    organizer.description = input.description.trim();
  });
}

export async function updateCommunityOrganizerProfile(
  input: CommunityOrganizerProfileUpdateInput,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const user = findUser(store, currentUser.id);
    if (!user) {
      throw new Error("Nie znaleziono użytkownika.");
    }

    const organizer = ensureOrganizerProfileRecord(store, user);
    organizer.communityProfile = {
      displayName: input.displayName.trim(),
      contactName: input.contactName.trim(),
      location: input.location.trim(),
      description: input.description.trim(),
    };
  });
}

export async function updateTrainerNotificationSettings(
  input: NotificationSettingsUpdateInput,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const trainer = findTrainer(store, requireTrainerProfileId(store, currentUser));
    if (!trainer) {
      throw new Error("Nie znaleziono profilu trenera.");
    }

    const systemDefaults = normalizeNotificationSettings(store.appSettings.defaultNotificationSettings);
    trainer.notificationSettings = normalizeNotificationSettings(input, systemDefaults);
    const user = findUser(store, currentUser.id);
    if (user) {
      user.notificationSettings = normalizeNotificationSettings(input, systemDefaults);
    }
  });
}

export async function updateOrganizerNotificationSettings(
  input: NotificationSettingsUpdateInput,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const organizer = findOrganizer(store, requireOrganizerProfileId(currentUser));
    if (!organizer) {
      throw new Error("Nie znaleziono profilu organizatora.");
    }

    const systemDefaults = normalizeNotificationSettings(store.appSettings.defaultNotificationSettings);
    organizer.notificationSettings = normalizeNotificationSettings(input, systemDefaults);
    const user = findUser(store, currentUser.id);
    if (user) {
      user.notificationSettings = normalizeNotificationSettings(input, systemDefaults);
    }
  });
}

export async function updateUserNotificationSettings(
  input: NotificationSettingsUpdateInput,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const user = findUser(store, currentUser.id);
    if (!user) {
      throw new Error("Nie znaleziono użytkownika.");
    }

    const systemDefaults = normalizeNotificationSettings(store.appSettings.defaultNotificationSettings);
    user.notificationSettings = normalizeNotificationSettings(input, systemDefaults);
  });
}

export async function updateTrainerBrandStatus(
  trainerId: string,
  brandStatus: EmandarBrandStatus,
  currentUser: AppUser,
) {
  if (currentUser.role !== "admin") {
    throw new Error("Tylko admin może zmieniać status marki trenera.");
  }

  await mutateStore((store) => {
    const trainer = findTrainer(store, trainerId);
    if (!trainer) {
      throw new Error("Nie znaleziono profilu trenera.");
    }

    trainer.brandStatus = brandStatus;
  });
}

export async function updateTrainingEventBrandStatus(
  eventId: string,
  brandStatus: EmandarBrandStatus,
  currentUser: AppUser,
) {
  if (currentUser.role !== "admin") {
    throw new Error("Tylko admin może zmieniać status marki wydarzenia.");
  }

  await mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    event.brandStatus = brandStatus;
  });
}

export async function decideTrainingEventCollaboration(
  input: TrainingEventCollaborationUpdateInput,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === input.eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    const canActAsTrainer =
      getRoleHierarchyLevel(currentUser.role) >= getRoleHierarchyLevel("trainer") &&
      currentUser.trainerProfileId === event.trainerId;
    const canActAsOrganizer =
      getRoleHierarchyLevel(currentUser.role) >= getRoleHierarchyLevel("organizer") &&
      currentUser.organizerProfileId === event.organizerId;

    if (currentUser.role === "admin") {
      if (resolveTrainerCollaborationStatus(event) === "pending") {
        event.trainerCollaborationStatus = input.status;
        event.trainerDecidedAt = nowIso();
        event.trainerDecidedByUserId = currentUser.id;
      }

      if (resolveOrganizerCollaborationStatus(event) === "pending") {
        event.organizerCollaborationStatus = input.status;
      }

      return;
    }

    if (canActAsTrainer && resolveTrainerCollaborationStatus(event) === "pending") {
      event.trainerCollaborationStatus = input.status;
      event.trainerDecidedAt = nowIso();
      event.trainerDecidedByUserId = currentUser.id;
      return;
    }

    if (canActAsOrganizer && resolveOrganizerCollaborationStatus(event) === "pending") {
      event.organizerCollaborationStatus = input.status;
      return;
    }

    throw new Error("Nie możesz podjąć tej decyzji.");
  });
}

export async function confirmEnrollmentAttendance(
  token: string,
  decision: "confirm" | "decline",
) {
  await mutateStore((store) => {
    const participant = store.eventParticipants.find((item) => item.id === token);
    if (participant) {
      participant.attendanceConfirmationStatus = decision === "confirm" ? "confirmed" : "declined";
      participant.attendanceConfirmationRespondedAt = nowIso();
      participant.updatedAt = nowIso();
      if (decision === "decline") {
        participant.status = "declined";
      }
      return;
    }

    const request = store.enrollmentRequests.find((item) => item.id === token);
    if (!request) {
      throw new Error("Nie znaleziono potwierdzenia uczestnictwa.");
    }

    request.attendanceConfirmationStatus = decision === "confirm" ? "confirmed" : "declined";
    request.attendanceConfirmationRespondedAt = nowIso();
  });
}

export async function updateTrainingEventManagement(
  input: TrainingEventManagementUpdateInput,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === input.eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    const canManageEvent = canManageTrainingEvent(event, currentUser);
    const canModerateCommunityPublication =
      input.publicationDecision !== undefined &&
      isCommunityBrandStatus(event.brandStatus) &&
      canModerateTrainingEvent(event, currentUser);

    if (!canManageEvent && !canModerateCommunityPublication) {
      throw new Error("Nie możesz zarządzać tym wydarzeniem.");
    }

    if (canManageEvent) {
      event.status = input.status;
      event.capacity = input.capacity;
      event.minimumParticipants = input.minimumParticipants;
      if (typeof input.confirmationLeadTimeDays === "number") {
        event.confirmationLeadTimeDays = Math.max(0, Math.round(input.confirmationLeadTimeDays));
      }
      if (input.title !== undefined) {
        event.title = input.title.trim();
      }
      if (input.location !== undefined) {
        event.location = input.location.trim();
      }
      if (input.summary !== undefined) {
        event.summary = input.summary.trim();
      }
      if (input.description !== undefined) {
        event.description = input.description.trim();
      }
      if (input.tags !== undefined) {
        event.tags = cloneValue(input.tags);
      }
      if (input.eventImages !== undefined) {
        event.eventImages = cloneValue(input.eventImages);
      }
      if (input.useEventImageAsCover !== undefined) {
        event.useEventImageAsCover = input.useEventImageAsCover;
      }
      if (input.scheduleDays !== undefined) {
        event.scheduleDays = cloneValue(input.scheduleDays);
        event.startsAt = input.scheduleDays[0]?.startsAt ?? event.startsAt;
        event.endsAt = input.scheduleDays[input.scheduleDays.length - 1]?.endsAt ?? event.endsAt;
      }
      if (input.enrollmentPhotoRequirement !== undefined) {
        event.enrollmentPhotoRequirement = input.enrollmentPhotoRequirement;
      }
      if (input.joinAudienceSetting !== undefined) {
        event.joinAudienceSetting = input.joinAudienceSetting;
      }
    }

    if (input.publicationDecision !== undefined) {
      event.publicationApprovalStatus = input.publicationDecision;
      event.publicationReviewMessage = input.publicationReviewMessage?.trim();
      event.publicationReviewedAt = nowIso();
      event.publicationReviewedByUserId = currentUser.id;
      event.isPublished = input.publicationDecision === "accepted";
    }
  });
}

export async function archiveTrainingEvent(eventId: string, actor: AppUser) {
  await mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    if (!canManageTrainingEvent(event, actor)) {
      throw new Error("Nie możesz archiwizować tego wydarzenia.");
    }

    event.archivedAt = nowIso();
    event.archivedByRole = actor.role;
    event.archivedReason = "manual";
    event.isPublished = false;
  });
}

export async function unpublishTrainingEvent(eventId: string, actor: AppUser) {
  await mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    if (!canModerateTrainingEvent(event, actor)) {
      throw new Error("Nie możesz wycofać publikacji tego wydarzenia.");
    }

    event.isPublished = false;
    if (isCommunityBrandStatus(event.brandStatus)) {
      event.publicationReviewedAt = nowIso();
      event.publicationReviewedByUserId = actor.id;
      event.publicationReviewMessage = "Publikacja została wycofana przez moderatora.";
    }
  });
}

export async function publishTrainingEvent(eventId: string, actor: AppUser) {
  await mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    if (!canManageTrainingEvent(event, actor)) {
      throw new Error("Nie możesz opublikować tego wydarzenia.");
    }

    if (isTrainingEventArchived(event)) {
      throw new Error("Nie możesz opublikować zarchiwizowanego wydarzenia.");
    }

    if (isCommunityBrandStatus(event.brandStatus) && event.publicationApprovalStatus !== "accepted") {
      throw new Error("To wydarzenie nie ma jeszcze akceptacji moderacji.");
    }

    if (
      !isCommunityBrandStatus(event.brandStatus) &&
      actor.role === "organizer" &&
      actor.organizerProfileId === event.organizerId &&
      !isOrganizerFunctionsBlocked(actor) &&
      event.trainerId &&
      canOrganizerAccessTrainer(actor.organizerProfileId, event.trainerId, store.relations)
    ) {
      event.trainerCollaborationStatus = "accepted";
    }

    event.isPublished = true;
  });
}

export async function deleteTrainingEvent(eventId: string, actor: AppUser) {
  await mutateStore((store) => {
    const event = store.trainingEvents.find((item) => item.id === eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    if (!canModerateTrainingEvent(event, actor)) {
      throw new Error("Nie możesz usunąć tego wydarzenia.");
    }

    deleteTrainingEventFromStore(store, eventId);
  });
}

export async function updateUserModeratorRole(
  userId: string,
  enabled: boolean,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    ensureAdminActor(currentUser);
    const user = findUser(store, userId);
    if (!user) {
      throw new Error("Nie znaleziono użytkownika.");
    }

    if (user.role === "admin") {
      throw new Error("Nie można zmieniać moderatora na koncie admina.");
    }

    ensureRole(user, "participant");
    user.roles = enabled
      ? Array.from(new Set([...user.roles, "moderator"]))
      : user.roles.filter((role) => role !== "moderator");
  });
}

export async function updateUserOrganizerFunctionsBlocked(
  userId: string,
  blocked: boolean,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    if (!hasModeratorAccess(currentUser)) {
      throw new Error("Tylko moderator lub admin może zablokować funkcje organizatora.");
    }

    const user = findUser(store, userId);
    if (!user) {
      throw new Error("Nie znaleziono użytkownika.");
    }

    if (!user.organizerProfileId) {
      throw new Error("To konto nie ma profilu organizatora.");
    }

    user.organizerFunctionsBlockedAt = blocked ? nowIso() : undefined;
    user.organizerFunctionsBlockedByUserId = blocked ? currentUser.id : undefined;
  });
}

export async function resolveEnrollmentPhoto(path: string) {
  return path;
}

export async function updateAppSettings(input: AppSettings) {
  await mutateStore((store) => {
    store.appSettings = {
      signupPhotoMode: input.signupPhotoMode,
      enrollmentPhotoMode: input.enrollmentPhotoMode,
      defaultNotificationSettings: normalizeNotificationSettings(
        input.defaultNotificationSettings,
      ),
    };
  });
}
