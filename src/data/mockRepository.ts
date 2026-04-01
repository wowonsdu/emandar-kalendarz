import type {
  AccountRequest,
  AccountRequestInput,
  AppRole,
  AppSettings,
  AppUser,
  AvailabilityInput,
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
  ParticipantEnrollmentManagementInput,
  ParticipantGroupEventManagementInput,
  ParticipantOnboardingInput,
  ParticipantProfile,
  ParticipantProfileUpdateInput,
  PhotoMode,
  TrainerAccountApproval,
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
  deriveEnrollmentFinalStatus,
  isCommunityBrandStatus,
  isTrainingEventPubliclyVisible,
  resolveOrganizerCollaborationStatus,
  resolveTrainerCollaborationStatus,
} from "@/domain/utils";

export type Unsubscribe = () => void;
type StorePatch = Partial<DemoStore>;

const authSessionStorageKey = "emandar:mock-auth-session";
const smsSessionStorageKey = "emandar:mock-sms-session";
const storeShadowStorageKey = "emandar:mock-store-shadow:v4";
const pollIntervalMs = 5000;

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

function getBasePath() {
  return import.meta.env.BASE_URL || "/";
}

function getMockApiUrl(path: string) {
  const basePath = getBasePath().replace(/\/+$/, "");
  return `${basePath}/api/mock/${path}`.replace(/([^:]\/)\/+/g, "$1");
}

function getMockStaticUrl(path: string) {
  const basePath = getBasePath().replace(/\/+$/, "");
  return `${basePath}/mock-data/${path}`.replace(/([^:]\/)\/+/g, "$1");
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

function nowIso() {
  return new Date().toISOString();
}

function isStoreEmpty(store: DemoStore) {
  return (
    store.users.length === 0 &&
    store.trainers.length === 0 &&
    store.organizers.length === 0 &&
    store.participantProfiles.length === 0 &&
    store.groups.length === 0 &&
    store.trainingEvents.length === 0 &&
    store.enrollmentRequests.length === 0
  );
}

function mergeStoreCollections<T extends { id: string }>(
  seedItems: T[] | null | undefined,
  runtimeItems: T[] | null | undefined,
) {
  const merged = new Map<string, T>();

  for (const item of seedItems ?? []) {
    merged.set(item.id, cloneValue(item));
  }

  for (const item of runtimeItems ?? []) {
    const previous = merged.get(item.id);
    merged.set(
      item.id,
      previous
        ? ({
            ...cloneValue(previous),
            ...cloneValue(item),
          } as T)
        : cloneValue(item),
    );
  }

  return [...merged.values()];
}

function mergeSeedWithRuntime(seedStore: DemoStore, runtimeStore: Partial<DemoStore> | null | undefined) {
  if (!runtimeStore) {
    return normalizePublicStore(seedStore);
  }

  const mergedStore: Partial<DemoStore> = {
    ...cloneValue(seedStore),
    ...cloneValue(runtimeStore),
    users: mergeStoreCollections(seedStore.users, runtimeStore.users),
    trainers: mergeStoreCollections(seedStore.trainers, runtimeStore.trainers),
    organizers: mergeStoreCollections(seedStore.organizers, runtimeStore.organizers),
    participantProfiles: mergeStoreCollections(
      seedStore.participantProfiles,
      runtimeStore.participantProfiles,
    ),
    groups: mergeStoreCollections(seedStore.groups, runtimeStore.groups),
    groupMembers: mergeStoreCollections(seedStore.groupMembers, runtimeStore.groupMembers),
    eventParticipants: mergeStoreCollections(
      seedStore.eventParticipants,
      runtimeStore.eventParticipants,
    ),
    relations: mergeStoreCollections(seedStore.relations, runtimeStore.relations),
    trainingEvents: mergeStoreCollections(seedStore.trainingEvents, runtimeStore.trainingEvents),
    publicTrainingEvents: mergeStoreCollections(
      seedStore.publicTrainingEvents,
      runtimeStore.publicTrainingEvents,
    ),
    availabilitySlots: mergeStoreCollections(
      seedStore.availabilitySlots,
      runtimeStore.availabilitySlots,
    ),
    trainerSharedSlots: mergeStoreCollections(
      seedStore.trainerSharedSlots,
      runtimeStore.trainerSharedSlots,
    ),
    trainerCalendarFeeds: mergeStoreCollections(
      seedStore.trainerCalendarFeeds,
      runtimeStore.trainerCalendarFeeds,
    ),
    organizerCalendarFeeds: mergeStoreCollections(
      seedStore.organizerCalendarFeeds,
      runtimeStore.organizerCalendarFeeds,
    ),
    trainerOrganizerCalendarFeeds: mergeStoreCollections(
      seedStore.trainerOrganizerCalendarFeeds,
      runtimeStore.trainerOrganizerCalendarFeeds,
    ),
    trainerExternalBusyMonths: mergeStoreCollections(
      seedStore.trainerExternalBusyMonths,
      runtimeStore.trainerExternalBusyMonths,
    ),
    organizerExternalBusyMonths: mergeStoreCollections(
      seedStore.organizerExternalBusyMonths,
      runtimeStore.organizerExternalBusyMonths,
    ),
    enrollmentRequests: mergeStoreCollections(
      seedStore.enrollmentRequests,
      runtimeStore.enrollmentRequests,
    ),
    notifications: mergeStoreCollections(seedStore.notifications, runtimeStore.notifications),
    accountRequests: mergeStoreCollections(seedStore.accountRequests, runtimeStore.accountRequests),
    trainerAccountApprovals: mergeStoreCollections(
      seedStore.trainerAccountApprovals,
      runtimeStore.trainerAccountApprovals,
    ),
    appSettings: {
      ...cloneValue(seedStore.appSettings),
      ...(runtimeStore.appSettings ? cloneValue(runtimeStore.appSettings) : {}),
    },
  };

  return normalizePublicStore(mergedStore);
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

function splitDisplayName(value: string) {
  const normalized = value.trim();
  const [firstName = "", ...lastNameParts] = normalized.split(/\s+/).filter(Boolean);

  return {
    displayName: normalized,
    firstName,
    lastName: lastNameParts.join(" ") || undefined,
  };
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
    accountRequests: cloneValue(raw?.accountRequests ?? base.accountRequests),
    trainerAccountApprovals: cloneValue(
      raw?.trainerAccountApprovals ?? base.trainerAccountApprovals,
    ),
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
  const seedPayload = await fetchJsonOrNull<Partial<DemoStore>>(getMockStaticUrl("seed-store.json"));
  if (seedPayload) {
    const seedStore = normalizePublicStore(seedPayload);
    const runtimePayload = await fetchJsonOrNull<Partial<DemoStore>>(
      getMockStaticUrl("runtime-store.json"),
    );
    const store = mergeSeedWithRuntime(seedStore, runtimePayload);
    writeStorageJson(storeShadowStorageKey, store);
    return {
      store,
      version: Date.now(),
    };
  }

  const shadowStore = normalizePublicStore(readStorageJson<DemoStore | null>(storeShadowStorageKey, null));
  return {
    store: shadowStore,
    version: Date.now(),
  };
}

async function persistStore(store: DemoStore) {
  const payload = cloneValue(store);
  writeStorageJson(storeShadowStorageKey, payload);

  savePromise = savePromise.then(async () => {
    try {
      const response = await fetch(getMockApiUrl("runtime-store"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ store: payload }),
      });

      if (!response.ok) {
        throw new Error(`mock-save-${response.status}`);
      }

      const saved = (await response.json()) as {
        store?: Partial<DemoStore>;
        version?: number;
      };

      cachedStore = normalizePublicStore(saved.store ?? payload);
      cachedVersion = Number(saved.version ?? Date.now());
      writeStorageJson(storeShadowStorageKey, cachedStore);
    } catch {
      cachedStore = normalizePublicStore(payload);
      cachedVersion = Date.now();
    }
  });

  await savePromise;
}

async function ensureStoreLoaded() {
  if (cachedStore) {
    return cachedStore;
  }

  if (!loadPromise) {
    loadPromise = readStoreSnapshot().then(({ store, version }) => {
      cachedStore = store;
      cachedVersion = version;
      return store;
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
  if (savePromise !== Promise.resolve()) {
    await savePromise;
  }

  const snapshot = await readStoreSnapshot();
  if (snapshot.version === cachedVersion) {
    return;
  }

  cachedStore = snapshot.store;
  cachedVersion = snapshot.version;
  emitStoreListeners();
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
  const current = cloneValue(await ensureStoreLoaded());
  const result = await updater(current);
  const nextStore = rebuildDerivedStore(current);
  cachedStore = nextStore;
  cachedVersion = Date.now();
  await persistStore(nextStore);
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
  const activeRequests = store.enrollmentRequests.filter(
    (item) => item.participantStatus !== "cancelled" && item.finalStatus !== "rejected",
  );
  const activeParticipants = store.eventParticipants.filter(
    (item) => item.status === "confirmed" || item.status === "invited",
  );

  store.trainingEvents = store.trainingEvents.map((event) => {
    const requestCount = activeRequests.filter((item) => item.eventId === event.id).length;
    const participantCount = activeParticipants.filter((item) => item.eventId === event.id).length;

    return {
      ...event,
      enrolledCount: Math.max(requestCount, participantCount),
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

function requireTrainerProfileId(user: Pick<AppUser, "trainerProfileId">) {
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
    accountRequests: [],
    trainerAccountApprovals: [],
    appSettings: {
      signupPhotoMode: "optional",
      enrollmentPhotoMode: "optional",
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
      store.participantProfiles.push(createParticipantProfileFromUser(user));
    } else {
      user.phone = phone;
      user.phoneVerifiedAt = nowIso();
      user.authProvider = "phone";
      ensureRole(user, "participant");
      if (!user.participantProfileId) {
        user.participantProfileId = buildParticipantProfileId(phone);
        store.participantProfiles.push(createParticipantProfileFromUser(user));
      }
      if (seedTrainerId) {
        user.selectedTrainerIds = Array.from(new Set([...(user.selectedTrainerIds ?? []), seedTrainerId]));
      }
    }

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
      store.participantProfiles.push(createParticipantProfileFromUser(currentUser));
    }

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
  emitAuthListeners();
  emitStoreListeners();
}

export async function updateActiveRole(currentUser: AppUser, role: AppUser["role"]) {
  await mutateStore((store) => {
    const user = findUser(store, currentUser.id);
    if (!user) {
      throw new Error("Nie znaleziono użytkownika.");
    }

    if (!user.roles.includes(role)) {
      throw new Error("To konto nie ma wybranej roli.");
    }

    user.role = role;
  });
}

export async function submitEnrollment(input: EnrollmentFormInput) {
  const photoUrl = await maybeReadFile(input.photoFile);

  await mutateStore((store) => {
    const actor = getActorOrThrow(store);
    const event = store.trainingEvents.find((item) => item.id === input.eventId);
    if (!event) {
      throw new Error("Nie znaleziono wydarzenia.");
    }

    ensureRole(actor, "participant");
    if (!actor.participantProfileId) {
      actor.participantProfileId = buildParticipantProfileId(actor.phone || input.telefon);
      store.participantProfiles.push(createParticipantProfileFromUser(actor));
    }

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
    const requiresOrganizerApproval = !isCommunityBrandStatus(event.brandStatus) && Boolean(event.organizerId);
    const trainerDecision: DecisionStatus = isCommunityBrandStatus(event.brandStatus) ? "accepted" : "pending";
    const organizerDecision: DecisionStatus = requiresOrganizerApproval ? "pending" : "accepted";
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
      imieNazwisko: input.imieNazwisko.trim(),
      telefon: input.telefon.trim(),
      polecenieOdKogo: input.polecenieOdKogo.trim(),
      wiadomosc: input.wiadomosc.trim(),
      photoStatus: photoUrl ? "ready" : "pending",
      photoMode: resolvePhotoModeForEvent(event, store.appSettings.enrollmentPhotoMode),
      photoPath: photoUrl ?? undefined,
      photoUploadedAt: photoUrl ? nowIso() : undefined,
      trainerDecision,
      organizerDecision,
      finalStatus: deriveEnrollmentFinalStatus(
        trainerDecision,
        organizerDecision,
        requiresOrganizerApproval,
      ),
      participantStatus: "active",
      createdAt: nowIso(),
      requiresOrganizerApproval,
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

  const group = store.groups.find((item) => item.id === event.groupId);
  const participantProfile = store.participantProfiles.find(
    (item) => item.id === request.participantProfileId,
  );

  if (!group || !participantProfile) {
    return;
  }

  const eventParticipantId = buildEventParticipantId(event.id, request.participantProfileId);
  const existingIndex = store.eventParticipants.findIndex((item) => item.id === eventParticipantId);
  const payload: EventParticipant = {
    id: eventParticipantId,
    eventId: event.id,
    eventTitle: event.title || event.location,
    groupId: group.id,
    groupName: group.name,
    organizerId: group.organizerId,
    organizerUserId: group.organizerUserId ?? "",
    trainerId: group.trainerId,
    trainerUserId: group.trainerUserId ?? "",
    participantProfileId: participantProfile.id,
    participantDisplayName: participantProfile.displayName,
    participantPhone: participantProfile.phone,
    participantUserId: participantProfile.linkedUserId ?? null,
    priority: "regularni",
    status,
    source: "public-form",
    invitedAt: nowIso(),
    confirmedAt: status === "confirmed" ? nowIso() : undefined,
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

    if (currentUser.role === "trainer") {
      request.trainerDecision = input.decision;
    } else if (currentUser.role === "organizer" || currentUser.role === "admin") {
      request.organizerDecision = input.decision;
    }

    request.finalStatus = deriveEnrollmentFinalStatus(
      request.trainerDecision,
      request.organizerDecision,
      request.requiresOrganizerApproval !== false,
    );

    if (request.finalStatus === "accepted") {
      syncEventParticipantFromEnrollment(store, request, "confirmed");
    }

    if (request.finalStatus === "rejected") {
      request.participantStatus = "cancelled";
    }
  });
}

export async function manageOwnEnrollment(
  input: {
    requestId: string;
    action: ParticipantEnrollmentManagementInput["action"];
    transferTargetEventId?: string | null;
  },
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const request = store.enrollmentRequests.find(
      (item) => item.id === input.requestId && item.submitterUid === currentUser.id,
    );
    if (!request) {
      throw new Error("Nie znaleziono zgłoszenia.");
    }

    if (input.action === "cancel") {
      request.participantStatus = "cancelled";
      request.participantManagedAt = nowIso();
      request.participantActionSource = "participant";
      return;
    }

    if (!input.transferTargetEventId) {
      throw new Error("Wybierz docelowe wydarzenie.");
    }

    request.participantStatus = "cancelled";
    request.participantManagedAt = nowIso();
    request.participantActionSource = "participant";
    store.enrollmentRequests.unshift({
      ...cloneValue(request),
      id: createId("enrollment"),
      eventId: input.transferTargetEventId,
      createdAt: nowIso(),
      participantStatus: "active",
      trainerDecision: "pending",
      organizerDecision: request.requiresOrganizerApproval === false ? "accepted" : "pending",
      finalStatus: "pending",
    });
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
      return;
    }

    if (!input.transferTargetEventId) {
      throw new Error("Wybierz docelowe wydarzenie.");
    }

    entry.status = "declined";
    entry.declinedAt = nowIso();
    entry.updatedAt = nowIso();
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
      imieNazwisko: entry.participantDisplayName,
      telefon: entry.participantPhone,
      polecenieOdKogo: "Transfer uczestnika",
      wiadomosc: "Przeniesione przez uczestnika.",
      photoStatus: "pending",
      trainerDecision: "pending",
      organizerDecision: "pending",
      finalStatus: "pending",
      participantStatus: "active",
      createdAt: nowIso(),
      requiresOrganizerApproval: true,
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
  });
}

export async function createGroup(input: GroupInput, actor: AppUser) {
  return mutateStore((store) => {
    const organizerId = requireOrganizerProfileId(actor);
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

    group.name = input.name.trim();
    group.notes = input.notes?.trim();
    group.defaultLocation = input.defaultLocation?.trim();
    group.defaultEventType = input.defaultEventType;
    group.defaultCapacity = input.defaultCapacity;
    group.defaultTags = input.defaultTags ?? [];
    group.defaultConfirmationLeadTimeDays = input.defaultConfirmationLeadTimeDays;
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

    group.status = "archived";
    group.archivedAt = nowIso();
  });
}

export async function createOrUpdateOrganizerParticipantProfile(
  input: OrganizerParticipantProfileInput,
  actor: AppUser,
) {
  await mutateStore((store) => {
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

    let participantProfileId = input.participantProfileId;
    if (!participantProfileId) {
      if (!input.displayName?.trim() || !input.phone?.trim()) {
        throw new Error("Podaj imię i nazwisko oraz numer telefonu.");
      }

      participantProfileId = buildParticipantProfileId(input.phone);
      const existingProfile = store.participantProfiles.find((item) => item.id === participantProfileId);
      if (!existingProfile) {
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
      }
    }

    const profile = store.participantProfiles.find((item) => item.id === participantProfileId);
    if (!profile) {
      throw new Error("Nie znaleziono profilu uczestnika.");
    }

    const memberId = buildGroupMemberId(group.id, participantProfileId);
    const existingMember = store.groupMembers.find((item) => item.id === memberId);
    if (existingMember) {
      existingMember.membershipStatus = "active";
      existingMember.priority = asParticipantPriority(input.priority);
      existingMember.updatedAt = nowIso();
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

    member.membershipStatus = "removed";
    member.removedAt = nowIso();
    member.updatedAt = nowIso();
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
      priority: "regularni",
      status: input.overCapacity ? "invited" : "confirmed",
      source: "organizer",
      overCapacity: input.overCapacity === true,
      invitedAt: nowIso(),
      confirmedAt: input.overCapacity ? undefined : nowIso(),
    });

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
    const trainerId = actor.role === "trainer" ? requireTrainerProfileId(actor) : input.trainerId;

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
    const trainerId = requireTrainerProfileId(actor);
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
    const trainerId = requireTrainerProfileId(actor);
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
    const trainerId = requireTrainerProfileId(actor);
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
    creatorDisplayName: actor.displayName,
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
    });
  });
}

export async function updateOrganizerTrainingDraft(
  input: OrganizerTrainingDraftUpdateInput,
  actor: AppUser,
) {
  await mutateStore((store) => {
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
    });
  });
}

export async function withdrawOrganizerTrainingDraft(eventId: string, actor: AppUser) {
  await mutateStore((store) => {
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
    const base = createEventBase(store, actor, input);
    store.trainingEvents.unshift({
      id: createId("event"),
      ...base,
      groupId: input.groupId ?? null,
      groupName: store.groups.find((item) => item.id === input.groupId)?.name ?? null,
      eventImages: cloneValue(input.eventImages ?? []),
      useEventImageAsCover: input.useEventImageAsCover === true,
      eventTypeSystem: input.eventTypeSystem ?? null,
      enrolledCount: 0,
      workflowStatus: "published",
      requiresOrganizerApproval: !base.organizerId ? false : !isCommunityBrandStatus(base.brandStatus),
      eligibleGroupPriorities: cloneValue(input.eligibleGroupPriorities ?? ["stali", "regularni"]),
      confirmationLeadTimeDays: input.confirmationLeadTimeDays ?? 5,
      trainerCollaborationStatus:
        actor.role === "organizer" && base.trainerId ? "pending" : "accepted",
      organizerCollaborationStatus:
        actor.role === "trainer" && base.organizerId ? "pending" : resolveOrganizerCollaborationStatus(base),
      selfManagedByTrainer: input.selfManagedByTrainer === true || !base.organizerId,
      createdByRole: actor.role,
      publicationApprovalStatus: isCommunityBrandStatus(base.brandStatus)
        ? input.isPublished
          ? "pending"
          : "pending"
        : undefined,
      enrollmentPhotoRequirement: "optional",
    });
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

export async function submitAccountRequest(input: AccountRequestInput) {
  const avatarUrl = await maybeReadFile(input.avatarFile);

  await mutateStore((store) => {
    const actor = getActorOrThrow(store);
    const normalizedCode = input.trainerAuthorizationCode.trim().toUpperCase();
    const trainer = store.trainers.find(
      (item) => resolveTrainerAuthorizationCode(item as TrainerProfile & { authorizationCode?: string }) === normalizedCode,
    );

    store.accountRequests.unshift({
      id: createId("account-request"),
      displayName: input.displayName.trim(),
      phone: input.phone.trim(),
      requestedRoles: ["participant"],
      notes: input.notes.trim(),
      status: "pending",
      createdAt: nowIso(),
      authProvider: "phone",
      avatarPath: avatarUrl ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
      selectedTrainerIds: trainer ? [trainer.id] : [],
    });

    actor.displayName = input.displayName.trim();
    actor.notes = input.notes.trim();
    actor.phone = input.phone.trim();
    actor.selectedTrainerIds = trainer ? [trainer.id] : actor.selectedTrainerIds ?? [];
    actor.phoneVerifiedAt = nowIso();

    if (!actor.participantProfileId) {
      actor.participantProfileId = buildParticipantProfileId(actor.phone);
      store.participantProfiles.push(createParticipantProfileFromUser(actor));
    }
  });
}

export async function connectOrganizerToTrainerWithCode(trainerAuthorizationCode: string) {
  return mutateStore((store) => {
    const actor = getActorOrThrow(store);
    const normalizedCode = trainerAuthorizationCode.trim().toUpperCase();
    const trainer = store.trainers.find(
      (item) => resolveTrainerAuthorizationCode(item as TrainerProfile & { authorizationCode?: string }) === normalizedCode,
    );

    if (!trainer) {
      throw new Error("Nie znaleziono trenera dla tego kodu.");
    }

    ensureRole(actor, "organizer");
    let organizerId = actor.organizerProfileId;

    if (!organizerId) {
      organizerId = createId("organizer");
      actor.organizerProfileId = organizerId;
      store.organizers.unshift({
        id: organizerId,
        userId: actor.id,
        displayName: actor.displayName,
        description: actor.notes ?? "Nowy organizator utworzony z kodu trenera.",
        isVisible: true,
      });
    }

    const relationId = buildRelationId(trainer.id, organizerId);
    const existing = store.relations.find((item) => item.id === relationId);
    if (existing) {
      existing.status = "approved";
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

    return {
      ok: true as const,
      trainerId: trainer.id,
      organizerProfileCreated: !existing,
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
      store.participantProfiles.push(createParticipantProfileFromUser(actor));
    }

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

    if (input.requestedRoles.includes("organizer")) {
      ensureRole(actor, "organizer");
      if (!actor.organizerProfileId) {
        actor.organizerProfileId = createId("organizer");
        store.organizers.unshift({
          id: actor.organizerProfileId,
          userId: actor.id,
          displayName: actor.displayName,
          description: input.organizerTrainingIntent?.trim() || "Organizator utworzony z onboardingu.",
          isVisible: true,
          trainingIntent: input.organizerTrainingIntent?.trim(),
        });
      }

      input.selectedTrainerIds.forEach((trainerId) => {
        const trainer = findTrainer(store, trainerId);
        if (!trainer) {
          return;
        }

        store.trainerAccountApprovals.unshift({
          id: createId("trainer-approval"),
          requesterUserId: actor.id,
          requesterDisplayName: actor.displayName,
          requesterPhone: actor.phone,
          targetTrainerId: trainer.id,
          targetTrainerUserId: trainer.userId,
          requestedRoles: ["organizer"],
          status: "pending",
          createdAt: nowIso(),
        });
      });
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

  await mutateStore((store) => {
    const trainer = findTrainer(store, requireTrainerProfileId(currentUser));
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
  });
}

export async function updateParticipantProfile(
  input: ParticipantProfileUpdateInput,
  currentUser: AppUser,
) {
  const avatarUrl = await maybeReadFile(input.avatarFile);

  await mutateStore((store) => {
    const user = findUser(store, currentUser.id);
    if (!user) {
      throw new Error("Nie znaleziono użytkownika.");
    }

    user.displayName = input.displayName.trim();
    user.referralSource = input.referralSource?.trim();
    user.notes = input.notes?.trim();
    if (avatarUrl) {
      user.avatarUrl = avatarUrl;
      user.avatarPath = avatarUrl;
    }

    const profile = store.participantProfiles.find((item) => item.id === user.participantProfileId);
    if (profile) {
      const split = splitDisplayName(input.displayName);
      profile.displayName = split.displayName;
      profile.firstName = split.firstName;
      profile.lastName = split.lastName;
      profile.referralSource = input.referralSource?.trim();
      profile.notes = input.notes?.trim();
      profile.updatedAt = nowIso();
      if (avatarUrl) {
        profile.avatarUrl = avatarUrl;
        profile.avatarPath = avatarUrl;
      }
    }
  });
}

export async function updateOrganizerProfile(
  input: OrganizerProfileUpdateInput,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const organizer = findOrganizer(store, requireOrganizerProfileId(currentUser));
    if (!organizer) {
      throw new Error("Nie znaleziono profilu organizatora.");
    }

    organizer.displayName = input.displayName.trim();
    organizer.contactName = input.contactName.trim();
    organizer.location = input.location.trim();
    organizer.description = input.description.trim();
  });
}

export async function updateTrainerNotificationSettings(
  input: NotificationSettingsUpdateInput,
  currentUser: AppUser,
) {
  await mutateStore((store) => {
    const trainer = findTrainer(store, requireTrainerProfileId(currentUser));
    if (!trainer) {
      throw new Error("Nie znaleziono profilu trenera.");
    }

    trainer.notificationSettings = normalizeNotificationSettings(input);
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

    organizer.notificationSettings = normalizeNotificationSettings(input);
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

    if (currentUser.role === "trainer") {
      event.trainerCollaborationStatus = input.status;
      event.trainerDecidedAt = nowIso();
      event.trainerDecidedByUserId = currentUser.id;
    } else if (currentUser.role === "organizer" || currentUser.role === "admin") {
      event.organizerCollaborationStatus = input.status;
    }
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

    if (
      event.trainerUserId !== currentUser.id &&
      event.organizerUserId !== currentUser.id &&
      currentUser.role !== "admin"
    ) {
      throw new Error("Nie możesz zarządzać tym wydarzeniem.");
    }

    event.status = input.status;
    event.capacity = input.capacity;
    event.minimumParticipants = input.minimumParticipants;
    if (input.title !== undefined) {
      event.title = input.title.trim();
    }
    if (input.location !== undefined) {
      event.location = input.location.trim();
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

    if (
      event.trainerUserId !== actor.id &&
      event.organizerUserId !== actor.id &&
      actor.role !== "admin"
    ) {
      throw new Error("Nie możesz archiwizować tego wydarzenia.");
    }

    event.archivedAt = nowIso();
    event.archivedByRole = actor.role;
    event.archivedReason = "manual";
    event.isPublished = false;
  });
}

export async function decideAccountRequest(
  requestId: string,
  currentUser: AppUser,
  status: "approved" | "rejected",
) {
  if (currentUser.role !== "admin") {
    throw new Error("Tylko admin może rozpatrywać zgłoszenia kont.");
  }

  await mutateStore((store) => {
    const request = store.accountRequests.find((item) => item.id === requestId);
    if (!request) {
      throw new Error("Nie znaleziono zgłoszenia.");
    }

    request.status = status;
  });
}

export async function resolveEnrollmentPhoto(path: string) {
  return path;
}

export async function decideTrainerAccountApproval(
  approvalId: string,
  status: "accepted" | "rejected",
  currentUser: AppUser,
) {
  if (currentUser.role !== "trainer" && currentUser.role !== "admin") {
    throw new Error("Nie możesz rozpatrywać tej akceptacji.");
  }

  await mutateStore((store) => {
    const approval = store.trainerAccountApprovals.find((item) => item.id === approvalId);
    if (!approval) {
      throw new Error("Nie znaleziono zgłoszenia.");
    }

    approval.status = status;
  });
}

export async function updateAppSettings(input: AppSettings) {
  await mutateStore((store) => {
    store.appSettings = {
      signupPhotoMode: input.signupPhotoMode,
      enrollmentPhotoMode: input.enrollmentPhotoMode,
    };
  });
}
