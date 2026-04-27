import type {
  AppSettings,
  AppUser,
  CommunityOrganizerProfileUpdateInput,
  DecisionStatus,
  DemoStore,
  EmandarBrandStatus,
  EnrollmentFormInput,
  EventParticipantInput,
  EventParticipantStatus,
  EventParticipantStatusUpdateInput,
  GroupInput,
  GroupMemberInput,
  GroupMemberUpdateInput,
  GroupUpdateInput,
  NotificationSettingsUpdateInput,
  OrganizerParticipantProfileInput,
  OrganizerProfileUpdateInput,
  ParticipantGroupEventManagementInput,
  ParticipantOnboardingInput,
  ParticipantProfileUpdateInput,
  ParticipantRegistrationInput,
  TrainingEvent,
  TrainingEventImage,
  TrainingEventInput,
  TrainingEventManagementUpdateInput,
  TrainerProfileUpdateInput,
} from "@/domain/types";
import { sortTrainerProfiles } from "@/domain/utils";

export type Unsubscribe = () => void;
type StorePatch = Partial<DemoStore>;

export type VerifiedPhonePreAuthState = {
  phone: string;
  verifiedAt: string;
  seedTrainerId?: string;
};

export type ConfirmSmsCodeResult =
  | {
      status: "existing-account";
      userId: string;
      phone: string;
    }
  | {
      status: "missing-account";
      phone: string;
    };

const pollIntervalMs = 5000;
const verifiedPhoneSessionKey = "emandar:verified-phone-preauth";

let cachedPublicStore: StorePatch | null = null;
let cachedPrivateStore: DemoStore | null = null;
let cachedCurrentUser: AppUser | null = null;
let pollTimer: number | null = null;
let nextListenerId = 1;

const publicListeners = new Map<number, (patch: StorePatch) => void>();
const privateListeners = new Map<number, (patch: StorePatch) => void>();
const userProfileListeners = new Map<number, { userId: string; callback: (user: AppUser | null) => void }>();
const authListeners = new Map<number, (userId: string | null) => void>();

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
    enrollmentRequests: [],
    notifications: [],
    appSettings: {
      signupPhotoMode: "optional",
      enrollmentPhotoMode: "optional",
    },
  };
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function buildApiUrl(basePath: string, path: string) {
  return `${normalizeBasePath(basePath)}api/${path.replace(/^\/+/, "")}`.replace(/([^:]\/)\/+/g, "$1");
}

function resolveApiUrls(path: string, options: { baseUrl?: string; pathname?: string } = {}) {
  const configuredBasePath = normalizeBasePath(options.baseUrl ?? getBasePath());
  const pathname =
    options.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const prefersEmandarBase = configuredBasePath === "/" && pathname.startsWith("/emandar/");
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

  return basePathCandidates.map((basePath) => buildApiUrl(basePath, path));
}

async function fetchFirst<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown = null;
  for (const url of resolveApiUrls(path)) {
    try {
      const response = await fetch(url, {
        ...init,
        credentials: "same-origin",
        headers: {
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...init?.headers,
        },
      });
      if (!response.ok) {
        const error = new Error(`${path}-${response.status}`);
        if (response.status !== 404) {
          throw error;
        }
        lastError = error;
        continue;
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && /-\d{3}$/.test(error.message) && !error.message.endsWith("-404")) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Nie udało się połączyć z API.");
}

async function postJson<T>(path: string, payload: unknown) {
  return fetchFirst<T>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function refreshAuth() {
  const session = await fetchFirst<{ userId: string | null }>("auth/session").catch(() => ({ userId: null }));
  authListeners.forEach((listener) => listener(session.userId));
  if (!session.userId) {
    cachedPrivateStore = null;
    cachedCurrentUser = null;
    userProfileListeners.forEach(({ callback }) => callback(null));
    return null;
  }

  const me = await fetchFirst<{ user: AppUser }>("me").catch(() => null);
  cachedCurrentUser = me?.user ?? null;
  userProfileListeners.forEach(({ userId, callback }) => {
    callback(userId === cachedCurrentUser?.id ? cloneValue(cachedCurrentUser) : null);
  });
  return session.userId;
}

async function refreshPublicStore() {
  const patch = await fetchFirst<StorePatch>("public/bootstrap");
  patch.trainers = sortTrainerProfiles(patch.trainers ?? []);
  cachedPublicStore = patch;
  publicListeners.forEach((listener) => listener(cloneValue(patch)));
}

async function refreshPrivateStore() {
  if (!cachedCurrentUser) {
    return;
  }
  const store = await fetchFirst<DemoStore>("panel/bootstrap").catch(() => null);
  if (!store) {
    return;
  }
  cachedPrivateStore = store;
  privateListeners.forEach((listener) => listener(cloneValue(store)));
  userProfileListeners.forEach(({ userId, callback }) => {
    callback(cloneValue(store.users.find((item) => item.id === userId) ?? null));
  });
}

async function refreshAll() {
  await refreshPublicStore().catch(() => undefined);
  await refreshAuth();
  await refreshPrivateStore();
}

function maybeStartPolling() {
  if (typeof window === "undefined" || pollTimer !== null) {
    return;
  }
  pollTimer = window.setInterval(() => {
    void refreshAll();
  }, pollIntervalMs);
}

function maybeStopPolling() {
  if (
    pollTimer === null ||
    publicListeners.size > 0 ||
    privateListeners.size > 0 ||
    userProfileListeners.size > 0
  ) {
    return;
  }
  window.clearInterval(pollTimer);
  pollTimer = null;
}

async function runCommand<T>(name: string, args: unknown[] = []) {
  const response = await postJson<{ ok: true; result: T }>(`panel/command/${name}`, { args }).catch((error) => {
    throw error;
  });
  await refreshAll();
  return response.result;
}

function readVerifiedPhoneState(): VerifiedPhonePreAuthState | null {
  if (typeof window === "undefined") {
    return null;
  }
  const rawValue = window.sessionStorage.getItem(verifiedPhoneSessionKey);
  if (!rawValue) {
    return null;
  }
  try {
    return JSON.parse(rawValue) as VerifiedPhonePreAuthState;
  } catch {
    return null;
  }
}

function writeVerifiedPhoneState(value: VerifiedPhonePreAuthState | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (!value) {
    window.sessionStorage.removeItem(verifiedPhoneSessionKey);
    return;
  }
  window.sessionStorage.setItem(verifiedPhoneSessionKey, JSON.stringify(value));
}

function stripFileFields<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input };
  delete next.avatarFile;
  delete next.photoFile;
  return next;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku."));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",").pop() ?? "" : value);
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file: File, purpose: "avatar" | "enrollment-photo" | "event-image") {
  const response = await postJson<TrainingEventImage>("uploads", {
    filename: file.name,
    contentType: file.type,
    dataBase64: await readFileAsBase64(file),
    purpose,
  });
  return response;
}

async function uploadImageWithSessionRetry(file: File, purpose: "avatar" | "enrollment-photo" | "event-image") {
  try {
    return await uploadImage(file, purpose);
  } catch (error) {
    if (!(error instanceof Error) || (error.message !== "uploads-401" && error.message !== "uploads-403")) {
      throw error;
    }

    await refreshAll();
    return uploadImage(file, purpose);
  }
}

export function subscribeAuthState(onAuthState: (userId: string | null) => void): Unsubscribe {
  const listenerId = nextListenerId++;
  authListeners.set(listenerId, onAuthState);
  void refreshAuth();
  maybeStartPolling();
  return () => {
    authListeners.delete(listenerId);
    maybeStopPolling();
  };
}

export function subscribePublicStore(onPatch: (patch: StorePatch) => void): Unsubscribe {
  const listenerId = nextListenerId++;
  publicListeners.set(listenerId, onPatch);
  if (cachedPublicStore) {
    onPatch(cloneValue(cachedPublicStore));
  }
  void refreshPublicStore();
  maybeStartPolling();
  return () => {
    publicListeners.delete(listenerId);
    maybeStopPolling();
  };
}

export function subscribeUserProfile(userId: string, onUser: (user: AppUser | null) => void): Unsubscribe {
  const listenerId = nextListenerId++;
  userProfileListeners.set(listenerId, { userId, callback: onUser });
  if (cachedCurrentUser?.id === userId) {
    onUser(cloneValue(cachedCurrentUser));
  }
  void refreshAuth();
  maybeStartPolling();
  return () => {
    userProfileListeners.delete(listenerId);
    maybeStopPolling();
  };
}

export function subscribePrivateStore(_currentUser: AppUser, onPatch: (patch: StorePatch) => void): Unsubscribe {
  const listenerId = nextListenerId++;
  privateListeners.set(listenerId, onPatch);
  if (cachedPrivateStore) {
    onPatch(cloneValue(cachedPrivateStore));
  }
  void refreshPrivateStore();
  maybeStartPolling();
  return () => {
    privateListeners.delete(listenerId);
    maybeStopPolling();
  };
}

export function getCurrentSessionPhone() {
  return cachedCurrentUser?.phone ?? "";
}

export function getVerifiedPhonePreAuth() {
  return readVerifiedPhoneState();
}

export async function requestSmsCode(phone: string) {
  const response = await postJson<{ normalizedPhone: string; code?: string }>("auth/sms/request", { phone });
  return {
    normalizedPhone: response.normalizedPhone,
    code: response.code,
  };
}

export async function confirmSmsCode(phone: string, code: string, seedTrainerId?: string) {
  const result = await postJson<ConfirmSmsCodeResult>("auth/sms/confirm", { phone, code, seedTrainerId });
  if (result.status === "missing-account") {
    writeVerifiedPhoneState({
      phone: result.phone,
      verifiedAt: new Date().toISOString(),
      seedTrainerId,
    });
  } else {
    writeVerifiedPhoneState(null);
  }
  await refreshAll();
  return result;
}

export async function fetchAppUser(userId: string) {
  if (cachedPrivateStore) {
    const user = cachedPrivateStore.users.find((item) => item.id === userId);
    if (user) return cloneValue(user);
  }
  const response = await fetchFirst<{ user: AppUser }>("me");
  return response.user;
}

export async function signIn(email: string, password: string) {
  const response = await postJson<{ userId: string }>("auth/dev-login", { email, password });
  await refreshAll();
  return fetchAppUser(response.userId);
}

export async function signOut() {
  await postJson<{ ok: boolean }>("auth/logout", {});
  cachedCurrentUser = null;
  cachedPrivateStore = null;
  writeVerifiedPhoneState(null);
  authListeners.forEach((listener) => listener(null));
  privateListeners.forEach((listener) => listener({}));
  userProfileListeners.forEach(({ callback }) => callback(null));
}

export async function ensurePhoneParticipantProfileForFlow(seedTrainerId?: string) {
  return runCommand<{ ok: true; userId: string; accountCreated?: boolean }>(
    "ensurePhoneParticipantProfileForFlow",
    [seedTrainerId],
  );
}

export async function registerParticipant(input: ParticipantRegistrationInput) {
  const verified = readVerifiedPhoneState();
  const result = await runCommand("registerParticipant", [
    { ...stripFileFields(input as unknown as Record<string, unknown>), phone: verified?.phone ?? input.phone },
  ]);
  writeVerifiedPhoneState(null);

  if (input.avatarFile) {
    const avatarUrl = (await uploadImageWithSessionRetry(input.avatarFile, "avatar")).url;
    await runCommand("updateParticipantProfile", [{ avatarUrl }]);
  }

  return result;
}

export async function submitEnrollment(input: EnrollmentFormInput) {
  let photoPath: string | undefined;
  if (input.photoFile) {
    photoPath = (await uploadImage(input.photoFile, "enrollment-photo")).url;
  }
  return runCommand("submitEnrollment", [{ ...stripFileFields(input as unknown as Record<string, unknown>), photoPath }]);
}

export const ensurePhoneParticipantProfile = ensurePhoneParticipantProfileForFlow;

export function resolveEnrollmentPhoto(path: string) {
  return Promise.resolve(path);
}

export async function uploadCommunityEventImages(files: File[]) {
  return Promise.all(files.map((file) => uploadImage(file, "event-image")));
}

export function decideEnrollment(requestId: string, currentUser: AppUser, decision: "accepted" | "rejected") {
  return runCommand("decideEnrollment", [requestId, currentUser.id, decision]);
}

export function manageEnrollmentRequest(
  input: {
    requestId: string;
    decision: DecisionStatus;
    transferTargetEventId?: string | null;
    acceptedParticipantStatus?: Extract<EventParticipantStatus, "invited" | "confirmed" | "rezerwowy">;
  },
  _currentUser: AppUser,
) {
  return runCommand("manageEnrollmentRequest", [input]);
}

export function manageOwnGroupEventParticipation(
  input: {
    eventParticipantId: string;
    action: ParticipantGroupEventManagementInput["action"];
    transferTargetEventId?: string | null;
  },
  _currentUser: AppUser,
) {
  return runCommand("manageOwnGroupEventParticipation", [input]);
}

export function detachRelation(relationId: string, _currentUser: AppUser, archiveLinkedEvents?: boolean) {
  return runCommand("detachRelation", [relationId, archiveLinkedEvents]);
}

export function createGroup(input: GroupInput, _actor: AppUser) {
  return runCommand<{ ok: true; groupId: string }>("createGroup", [input]);
}

export function updateGroup(input: GroupUpdateInput, _actor: AppUser) {
  return runCommand("updateGroup", [input]);
}

export function archiveGroup(groupId: string, _actor: AppUser) {
  return runCommand("archiveGroup", [groupId]);
}

export function createOrUpdateOrganizerParticipantProfile(input: OrganizerParticipantProfileInput, _actor: AppUser) {
  return runCommand("createOrUpdateOrganizerParticipantProfile", [input]);
}

export function addGroupMember(input: GroupMemberInput, _actor: AppUser) {
  return runCommand("addGroupMember", [input]);
}

export function updateGroupMember(input: GroupMemberUpdateInput, _actor: AppUser) {
  return runCommand("updateGroupMember", [input]);
}

export function removeGroupMember(memberId: string, _actor: AppUser) {
  return runCommand("removeGroupMember", [memberId]);
}

export function addEventParticipant(input: EventParticipantInput, _actor: AppUser) {
  return runCommand("addEventParticipant", [input]);
}

export function updateEventParticipantStatus(input: EventParticipantStatusUpdateInput, _actor: AppUser) {
  return runCommand("updateEventParticipantStatus", [input]);
}

export function finalizeEventRoster(eventId: string, _actor: AppUser) {
  return runCommand("finalizeEventRoster", [eventId]);
}

export const createTrainingEvent = (input: TrainingEventInput, _actor: AppUser) =>
  runCommand("createTrainingEvent", [input]);
export const createUnifiedTrainingEvent = createTrainingEvent;

export const archiveTrainingEvent = (eventId: string, _actor: AppUser) =>
  runCommand("archiveTrainingEvent", [eventId]);
export const publishTrainingEvent = (eventId: string, _actor: AppUser) =>
  runCommand("publishTrainingEvent", [eventId]);
export const unpublishTrainingEvent = (eventId: string, _actor: AppUser) =>
  runCommand("unpublishTrainingEvent", [eventId]);
export const deleteTrainingEvent = (eventId: string, _actor: AppUser) =>
  runCommand("deleteTrainingEvent", [eventId]);

export const updateTrainerProfile = (input: TrainerProfileUpdateInput, _currentUser: AppUser) =>
  runCommand("updateTrainerProfile", [input]);
export const updateParticipantProfile = (input: ParticipantProfileUpdateInput, _currentUser: AppUser) =>
  runCommand("updateParticipantProfile", [input]);
export const updateOrganizerProfile = (input: OrganizerProfileUpdateInput, _currentUser: AppUser) =>
  runCommand("updateOrganizerProfile", [input]);
export const updateCommunityOrganizerProfile = (input: CommunityOrganizerProfileUpdateInput, _currentUser: AppUser) =>
  runCommand("updateCommunityOrganizerProfile", [input]);

export const updateTrainerNotificationSettings = (input: NotificationSettingsUpdateInput, _currentUser: AppUser) =>
  runCommand("updateTrainerNotificationSettings", [input]);
export const updateOrganizerNotificationSettings = (input: NotificationSettingsUpdateInput, _currentUser: AppUser) =>
  runCommand("updateOrganizerNotificationSettings", [input]);
export const updateUserNotificationSettings = (input: NotificationSettingsUpdateInput, _currentUser: AppUser) =>
  runCommand("updateUserNotificationSettings", [input]);

export const updateTrainerBrandStatus = (
  input: { trainerId: string; brandStatus: EmandarBrandStatus },
  _currentUser: AppUser,
) => runCommand("updateTrainerBrandStatus", [input]);

export const updateTrainingEventBrandStatus = (
  input: { eventId: string; brandStatus: EmandarBrandStatus },
  _currentUser: AppUser,
) => runCommand("updateTrainingEventBrandStatus", [input]);

export const decideTrainingEventCollaboration = (
  input: { eventId: string; status: "accepted" | "rejected" },
  _currentUser: AppUser,
) => runCommand("decideTrainingEventCollaboration", [input]);

export const updateTrainingEventManagement = (input: TrainingEventManagementUpdateInput, _currentUser: AppUser) =>
  runCommand("updateTrainingEventManagement", [input]);

export const updateUserModeratorRole = (userId: string, enabled: boolean, _currentUser: AppUser) =>
  runCommand("updateUserModeratorRole", [userId, enabled]);
export const updateUserOrganizerFunctionsBlocked = (userId: string, blocked: boolean, _currentUser: AppUser) =>
  runCommand("updateUserOrganizerFunctionsBlocked", [userId, blocked]);

export const updateAppSettings = (input: AppSettings) => runCommand("updateAppSettings", [input]);

export const connectOrganizerToTrainerWithCode = (
  trainerAuthorizationCode: string,
  expectedTrainerId?: string,
) =>
  runCommand<{ ok: true; trainerId: string; organizerProfileCreated: boolean }>(
    "connectOrganizerToTrainerWithCode",
    [trainerAuthorizationCode, expectedTrainerId],
  );

export const completeParticipantOnboarding = (input: ParticipantOnboardingInput) =>
  runCommand("completeParticipantOnboarding", [input]);

export const confirmEnrollmentAttendance = (token: string, decision: "confirm" | "decline") =>
  runCommand("confirmEnrollmentAttendance", [token, decision]);

export const getCommunityEventReview = (token: string) =>
  runCommand<{
    ok: true;
    event: TrainingEvent;
    creatorName: string;
    creatorPhone: string;
  }>("getCommunityEventReview", [token]);

export const reviewCommunityEvent = (input: {
  token: string;
  decision: "accepted" | "rejected";
  message?: string;
}) => runCommand<{ ok: true; eventId: string }>("reviewCommunityEvent", [input]);
