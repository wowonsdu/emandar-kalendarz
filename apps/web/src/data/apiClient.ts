import { QueryObserver } from "@tanstack/react-query";
import {
  authSessionResponseSchema,
  csrfResponseSchema,
  okMutationResponseSchema,
  paginatedRecordsResponseSchema,
  panelNavigationResponseSchema,
  panelReadModelResponseSchema,
  smsConfirmResponseSchema,
  smsRequestResponseSchema,
  sseEventSchema,
  uploadResponseSchema,
} from "@emandar/shared";
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
import { invalidateAppData, invalidateForSseEvent, queryClient, queryKeys } from "./queryClient";

export type Unsubscribe = () => void;
type StorePatch = Partial<DemoStore>;

export type VerifiedPhonePreAuthState = {
  phone: string;
  registrationToken: string;
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
      registrationToken: string;
    };

export type PanelNavigationReadModel = {
  notificationsCount: number;
  pendingEnrollmentRequestsCount: number;
  pendingCommunityEventsCount: number;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const verifiedPhoneSessionKey = "emandar:verified-phone-preauth";
let cachedCsrfToken: string | null = null;

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

function asDomain<T>(value: unknown): T {
  return value as T;
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
  const pathname = options.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
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

async function ensureCsrfToken() {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }
  const response = csrfResponseSchema.parse(await fetchFirst<unknown>("auth/csrf"));
  cachedCsrfToken = response.token;
  return response.token;
}

async function postJson<T>(path: string, payload: unknown) {
  const csrfToken = await ensureCsrfToken();
  return fetchFirst<T>(path, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "x-emandar-csrf": csrfToken,
    },
  });
}

async function postPublicJson<T>(path: string, payload: unknown) {
  return fetchFirst<T>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function stripFileFields<T extends Record<string, unknown>>(input: T): T {
  const next = { ...input };
  delete next.avatarFile;
  delete next.photoFile;
  return next;
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

export async function fetchAuthSession() {
  return authSessionResponseSchema.parse(await fetchFirst<unknown>("auth/session"));
}

export async function fetchCurrentUser() {
  const response = await fetchFirst<{ user: AppUser }>("me");
  return response.user;
}

export async function fetchPublicCatalogStore(): Promise<DemoStore> {
  const [core, officialEvents, communityEvents] = await Promise.all([
    fetchFirst<{
      trainers?: unknown[];
      organizers?: unknown[];
      appSettings?: Record<string, unknown>;
    }>("public/catalog-core"),
    fetchPublicEventsPage("official", { page: 1, pageSize: 25 }),
    fetchPublicEventsPage("community", { page: 1, pageSize: 25 }),
  ]);
  const publicTrainingEvents = [...officialEvents.items, ...communityEvents.items];
  return {
    ...createEmptyStore(),
    trainers: sortTrainerProfiles(asDomain<DemoStore["trainers"]>(core.trainers ?? [])),
    organizers: asDomain<DemoStore["organizers"]>(core.organizers ?? []),
    trainingEvents: publicTrainingEvents,
    publicTrainingEvents,
    appSettings: asDomain<DemoStore["appSettings"]>(core.appSettings ?? {}),
  };
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export async function fetchPublicEventsPage(
  kind: "official" | "community",
  options: { page?: number; pageSize?: number } = {},
): Promise<PaginatedResult<TrainingEvent>> {
  const path = kind === "community" ? "public/community-events" : "public/events";
  const response = paginatedRecordsResponseSchema.parse(
    await fetchFirst<unknown>(
      `${path}${buildQueryString({ page: options.page ?? 1, pageSize: options.pageSize ?? 25 })}`,
    ),
  );
  return {
    ...response,
    items: asDomain<TrainingEvent[]>(response.items),
  };
}

export async function fetchPanelEventsPage(
  kind: "official" | "community" | "all",
  options: { page?: number; pageSize?: number; sort?: "startsAtAsc" | "startsAtDesc" | "createdAtDesc" } = {},
): Promise<PaginatedResult<TrainingEvent>> {
  const response = paginatedRecordsResponseSchema.parse(
    await fetchFirst<unknown>(
      `panel/read-models/events-page${buildQueryString({
        kind,
        page: options.page ?? 1,
        pageSize: options.pageSize ?? 25,
        sort: options.sort,
      })}`,
    ),
  );
  return {
    ...response,
    items: asDomain<TrainingEvent[]>(response.items),
  };
}

export async function fetchPanelNavigation(): Promise<PanelNavigationReadModel> {
  return panelNavigationResponseSchema.parse(await fetchFirst<unknown>("panel/read-models/navigation"));
}

export async function fetchPanelStore(): Promise<DemoStore> {
  const paths = [
    "panel/read-models/users",
    "panel/read-models/trainers",
    "panel/read-models/organizers",
    "panel/read-models/participant-profiles",
    "panel/read-models/groups",
    "panel/read-models/group-members",
    "panel/read-models/event-participants",
    "panel/read-models/relations",
    "panel/read-models/events",
    "panel/read-models/enrollments",
    "panel/read-models/notifications",
    "panel/read-models/settings",
  ];
  const parts = await Promise.all(paths.map((path) => fetchFirst<unknown>(path)));
  const merged = parts.reduce<Record<string, unknown>>(
    (accumulator, part) => ({ ...accumulator, ...(part as Record<string, unknown>) }),
    {},
  );
  const parsed = panelReadModelResponseSchema.parse(merged);
  return {
    users: asDomain<DemoStore["users"]>(parsed.users),
    trainers: sortTrainerProfiles(asDomain<DemoStore["trainers"]>(parsed.trainers)),
    organizers: asDomain<DemoStore["organizers"]>(parsed.organizers),
    participantProfiles: asDomain<DemoStore["participantProfiles"]>(parsed.participantProfiles),
    groups: asDomain<DemoStore["groups"]>(parsed.groups),
    groupMembers: asDomain<DemoStore["groupMembers"]>(parsed.groupMembers),
    eventParticipants: asDomain<DemoStore["eventParticipants"]>(parsed.eventParticipants),
    relations: asDomain<DemoStore["relations"]>(parsed.relations),
    trainingEvents: asDomain<DemoStore["trainingEvents"]>(parsed.trainingEvents),
    publicTrainingEvents: asDomain<DemoStore["publicTrainingEvents"]>(parsed.publicTrainingEvents),
    enrollmentRequests: asDomain<DemoStore["enrollmentRequests"]>(parsed.enrollmentRequests),
    notifications: asDomain<DemoStore["notifications"]>(parsed.notifications),
    appSettings: asDomain<DemoStore["appSettings"]>(parsed.appSettings),
  };
}

async function refetchAppData() {
  await invalidateAppData();
  await Promise.all([
    queryClient.refetchQueries({ queryKey: queryKeys.publicCatalog, type: "active" }),
    queryClient.refetchQueries({ queryKey: queryKeys.panelNavigation, type: "active" }),
    queryClient.refetchQueries({ queryKey: queryKeys.panelStore, type: "active" }),
    queryClient.refetchQueries({ queryKey: queryKeys.currentUser, type: "active" }),
  ]);
}

async function refreshSessionBoundary() {
  const session = await fetchAuthSession().catch(() => ({ userId: null }));
  queryClient.setQueryData(queryKeys.authSession, session);
  if (session.userId) {
    const user = await fetchCurrentUser().catch(() => null);
    if (user) {
      queryClient.setQueryData(queryKeys.currentUser, user);
    }
  }
}

async function runPanelMutation<T>(path: string, payload: unknown = {}) {
  const response = okMutationResponseSchema.parse(await postJson<unknown>(path, payload));
  await refetchAppData();
  return response.result as T;
}

async function uploadImage(file: File, purpose: "avatar" | "enrollment-photo" | "event-image") {
  const response = uploadResponseSchema.parse(
    await postJson<unknown>("uploads", {
      filename: file.name,
      contentType: file.type,
      dataBase64: await readFileAsBase64(file),
      purpose,
    }),
  );
  return response as TrainingEventImage;
}

async function uploadImageWithSessionRetry(file: File, purpose: "avatar" | "enrollment-photo" | "event-image") {
  try {
    return await uploadImage(file, purpose);
  } catch (error) {
    if (!(error instanceof Error) || (error.message !== "uploads-401" && error.message !== "uploads-403")) {
      throw error;
    }

    await refreshSessionBoundary();
    await refetchAppData();
    return uploadImage(file, purpose);
  }
}

export function subscribeAuthState(onAuthState: (userId: string | null) => void): Unsubscribe {
  const observer = new QueryObserver(queryClient, {
    queryKey: queryKeys.authSession,
    queryFn: fetchAuthSession,
  });
  return observer.subscribe((result) => {
    if (result.data) {
      onAuthState(result.data.userId);
    }
  });
}

export function subscribePublicStore(onPatch: (patch: StorePatch) => void): Unsubscribe {
  const observer = new QueryObserver(queryClient, {
    queryKey: queryKeys.publicCatalog,
    queryFn: fetchPublicCatalogStore,
    staleTime: 60_000,
  });
  return observer.subscribe((result) => {
    if (result.data) {
      onPatch(cloneValue(result.data));
    }
  });
}

export function subscribeUserProfile(userId: string, onUser: (user: AppUser | null) => void): Unsubscribe {
  const observer = new QueryObserver(queryClient, {
    queryKey: queryKeys.currentUser,
    queryFn: fetchCurrentUser,
    enabled: Boolean(userId),
  });
  return observer.subscribe((result) => {
    onUser(result.data?.id === userId ? cloneValue(result.data) : null);
  });
}

export function subscribePrivateStore(_currentUser: AppUser, onPatch: (patch: StorePatch) => void): Unsubscribe {
  const observer = new QueryObserver(queryClient, {
    queryKey: queryKeys.panelStore,
    queryFn: fetchPanelStore,
  });
  return observer.subscribe((result) => {
    if (result.data) {
      onPatch(cloneValue(result.data));
    }
  });
}

export function getCurrentSessionPhone() {
  return queryClient.getQueryData<AppUser>(queryKeys.currentUser)?.phone ?? "";
}

export function getVerifiedPhonePreAuth() {
  return readVerifiedPhoneState();
}

export async function requestSmsCode(phone: string) {
  return smsRequestResponseSchema.parse(await postJson<unknown>("auth/sms/request", { phone }));
}

export async function confirmSmsCode(phone: string, code: string, seedTrainerId?: string) {
  const result = smsConfirmResponseSchema.parse(await postJson<unknown>("auth/sms/confirm", { phone, code, seedTrainerId }));
  if (result.status === "missing-account") {
    writeVerifiedPhoneState({
      phone: result.phone,
      registrationToken: result.registrationToken,
      verifiedAt: new Date().toISOString(),
      seedTrainerId,
    });
  } else {
    writeVerifiedPhoneState(null);
  }
  await refetchAppData();
  return result as ConfirmSmsCodeResult;
}

export async function fetchAppUser(userId: string) {
  const cached = queryClient.getQueryData<AppUser>(queryKeys.currentUser);
  if (cached?.id === userId) {
    return cloneValue(cached);
  }
  return fetchCurrentUser();
}

export async function signIn(email: string, password: string) {
  const response = await postJson<{ userId: string }>("auth/dev-login", { email, password });
  queryClient.setQueryData(queryKeys.authSession, { userId: response.userId });
  const user = await fetchAppUser(response.userId);
  queryClient.setQueryData(queryKeys.currentUser, user);
  await refetchAppData();
  return user;
}

export async function signOut() {
  await postJson<{ ok: boolean }>("auth/logout", {});
  writeVerifiedPhoneState(null);
  queryClient.setQueryData(queryKeys.authSession, { userId: null });
  queryClient.setQueryData(queryKeys.currentUser, null);
  queryClient.removeQueries({ queryKey: queryKeys.panelStore });
  queryClient.removeQueries({ queryKey: queryKeys.panelNavigation });
}

export async function ensurePhoneParticipantProfileForFlow(seedTrainerId?: string) {
  return runPanelMutation<{ ok: true; userId: string; accountCreated?: boolean }>(
    "panel/participants/ensure-phone-profile",
    { seedTrainerId },
  );
}

export async function registerParticipant(input: ParticipantRegistrationInput) {
  const verified = readVerifiedPhoneState();
  if (!verified?.registrationToken) {
    throw new Error("Najpierw potwierdź numer telefonu kodem SMS.");
  }
  const registrationInput = {
    ...stripFileFields(input as unknown as Record<string, unknown>),
    phone: verified.phone,
  };
  const response = await postJson<{ ok: true; result: unknown }>("auth/register-participant", {
    registrationToken: verified.registrationToken,
    input: registrationInput,
  });
  const result = response.result;
  writeVerifiedPhoneState(null);
  await refreshSessionBoundary();
  await refetchAppData();

  if (input.avatarFile) {
    const avatarUrl = (await uploadImageWithSessionRetry(input.avatarFile, "avatar")).url;
    await updateParticipantProfile({ avatarUrl } as unknown as ParticipantProfileUpdateInput, {} as AppUser);
  }

  return result;
}

export async function submitEnrollment(input: EnrollmentFormInput) {
  let photoPath: string | undefined;
  if (input.photoFile) {
    photoPath = (await uploadImage(input.photoFile, "enrollment-photo")).url;
  }
  const payload = { ...stripFileFields(input as unknown as Record<string, unknown>), photoPath };
  const response = await postJson<{ ok: true }>("public/enrollments", payload);
  await refetchAppData();
  return response;
}

export const ensurePhoneParticipantProfile = ensurePhoneParticipantProfileForFlow;

export function resolveEnrollmentPhoto(path: string) {
  return Promise.resolve(path);
}

export async function uploadCommunityEventImages(files: File[]) {
  return Promise.all(files.map((file) => uploadImage(file, "event-image")));
}

export function decideEnrollment(requestId: string, _currentUser: AppUser, decision: "accepted" | "rejected") {
  return runPanelMutation("panel/enrollments/manage", { requestId, decision });
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
  return runPanelMutation("panel/enrollments/manage", input);
}

export function manageOwnGroupEventParticipation(
  input: {
    eventParticipantId: string;
    action: ParticipantGroupEventManagementInput["action"];
    transferTargetEventId?: string | null;
  },
  _currentUser: AppUser,
) {
  return runPanelMutation("panel/participants/group-event-participation", input);
}

export function detachRelation(relationId: string, _currentUser: AppUser, archiveLinkedEvents?: boolean) {
  return runPanelMutation(`panel/relations/${relationId}/detach`, { archiveLinkedEvents });
}

export function createGroup(input: GroupInput, _actor: AppUser) {
  return runPanelMutation<{ ok: true; groupId: string }>("panel/groups", input);
}

export function updateGroup(input: GroupUpdateInput, _actor: AppUser) {
  return runPanelMutation(`panel/groups/${input.groupId}`, input);
}

export function archiveGroup(groupId: string, _actor: AppUser) {
  return runPanelMutation(`panel/groups/${groupId}/archive`);
}

export function createOrUpdateOrganizerParticipantProfile(input: OrganizerParticipantProfileInput, _actor: AppUser) {
  return runPanelMutation("panel/participant-profiles/organizer-upsert", input);
}

export function addGroupMember(input: GroupMemberInput, _actor: AppUser) {
  return runPanelMutation("panel/group-members", input);
}

export function updateGroupMember(input: GroupMemberUpdateInput, _actor: AppUser) {
  return runPanelMutation(`panel/group-members/${input.memberId}`, input);
}

export function removeGroupMember(memberId: string, _actor: AppUser) {
  return runPanelMutation(`panel/group-members/${memberId}/remove`);
}

export function addEventParticipant(input: EventParticipantInput, _actor: AppUser) {
  return runPanelMutation("panel/event-participants", input);
}

export function updateEventParticipantStatus(input: EventParticipantStatusUpdateInput, _actor: AppUser) {
  return runPanelMutation("panel/event-participants/status", input);
}

export function finalizeEventRoster(eventId: string, _actor: AppUser) {
  return runPanelMutation(`panel/events/${eventId}/roster/finalize`);
}

export const createTrainingEvent = (input: TrainingEventInput, _actor: AppUser) =>
  runPanelMutation("panel/events", input);
export const createUnifiedTrainingEvent = createTrainingEvent;

export const archiveTrainingEvent = (eventId: string, _actor: AppUser) =>
  runPanelMutation(`panel/events/${eventId}/archive`);
export const publishTrainingEvent = (eventId: string, _actor: AppUser) =>
  runPanelMutation(`panel/events/${eventId}/publish`);
export const unpublishTrainingEvent = (eventId: string, _actor: AppUser) =>
  runPanelMutation(`panel/events/${eventId}/unpublish`);
export const deleteTrainingEvent = (eventId: string, _actor: AppUser) =>
  runPanelMutation(`panel/events/${eventId}/delete`);

export const updateTrainerProfile = (input: TrainerProfileUpdateInput, _currentUser: AppUser) =>
  runPanelMutation("panel/profile/trainer", input);
export const updateParticipantProfile = (input: ParticipantProfileUpdateInput, _currentUser: AppUser) =>
  runPanelMutation("panel/profile/participant", input);
export const updateOrganizerProfile = (input: OrganizerProfileUpdateInput, _currentUser: AppUser) =>
  runPanelMutation("panel/profile/organizer", input);
export const updateCommunityOrganizerProfile = (input: CommunityOrganizerProfileUpdateInput, _currentUser: AppUser) =>
  runPanelMutation("panel/profile/community-organizer", input);

export const updateTrainerNotificationSettings = (input: NotificationSettingsUpdateInput, _currentUser: AppUser) =>
  runPanelMutation("panel/notification-settings/trainer", input);
export const updateOrganizerNotificationSettings = (input: NotificationSettingsUpdateInput, _currentUser: AppUser) =>
  runPanelMutation("panel/notification-settings/organizer", input);
export const updateUserNotificationSettings = (input: NotificationSettingsUpdateInput, _currentUser: AppUser) =>
  runPanelMutation("panel/notification-settings/user", input);

export const updateTrainerBrandStatus = (
  input: { trainerId: string; brandStatus: EmandarBrandStatus },
  _currentUser: AppUser,
) => runPanelMutation(`panel/trainers/${input.trainerId}/brand-status`, { brandStatus: input.brandStatus });

export const updateTrainingEventBrandStatus = (
  input: { eventId: string; brandStatus: EmandarBrandStatus },
  _currentUser: AppUser,
) => runPanelMutation(`panel/events/${input.eventId}/brand-status`, { brandStatus: input.brandStatus });

export const decideTrainingEventCollaboration = (
  input: { eventId: string; status: "accepted" | "rejected" },
  _currentUser: AppUser,
) => runPanelMutation(`panel/events/${input.eventId}/collaboration`, { status: input.status });

export const updateTrainingEventManagement = (input: TrainingEventManagementUpdateInput, _currentUser: AppUser) =>
  runPanelMutation(`panel/events/${input.eventId}/management`, input);

export const updateUserModeratorRole = (userId: string, enabled: boolean, _currentUser: AppUser) =>
  runPanelMutation(`panel/users/${userId}/moderator-role`, { enabled });

export const updateUserOrganizerFunctionsBlocked = (userId: string, blocked: boolean, _currentUser: AppUser) =>
  runPanelMutation(`panel/users/${userId}/organizer-functions-block`, { blocked });

export const updateAppSettings = (input: AppSettings) => runPanelMutation("panel/settings", { input });

export const connectOrganizerToTrainerWithCode = (trainerAuthorizationCode: string, expectedTrainerId?: string) =>
  runPanelMutation<{ ok: true; trainerId: string; organizerProfileCreated: boolean }>("panel/relations/connect-code", {
    trainerAuthorizationCode,
    expectedTrainerId,
  });

export const completeParticipantOnboarding = (input: ParticipantOnboardingInput) =>
  runPanelMutation("panel/profile/participant/onboarding", input);

export const confirmEnrollmentAttendance = (token: string, decision: "confirm" | "decline") =>
  postPublicJson<{ ok: true }>("public/signed-actions/attendance", { token, decision }).then(async (response) => {
    await refetchAppData();
    return response;
  });

export async function createAttendanceConfirmationTokens(
  entityId: string,
  entityType: "event_participant" | "enrollment_request" = "event_participant",
) {
  return postJson<{
    confirmToken: string;
    declineToken: string;
    confirmUrl: string;
    declineUrl: string;
  }>("panel/signed-actions/attendance", { entityId, entityType });
}

export const getCommunityEventReview = (token: string) =>
  fetchFirst<{
    ok: true;
    event: TrainingEvent;
    creatorName: string;
    creatorPhone: string;
  }>(`public/signed-actions/community-event-review/${token}`);

export const reviewCommunityEvent = (input: { token: string; decision: "accepted" | "rejected"; message?: string }) =>
  postPublicJson<{ ok: true; result: { ok: true; eventId: string } }>(
    "public/signed-actions/community-event-review",
    input,
  ).then(async (response) => {
    await refetchAppData();
    return response.result;
  });

export function openPanelEventsStream(onEvent?: (event: unknown) => void) {
  if (typeof EventSource === "undefined") {
    return () => undefined;
  }
  const source = new EventSource(resolveApiUrls("panel/events/stream")[0] ?? "/api/panel/events/stream", {
    withCredentials: true,
  });

  const handleMessage = (message: MessageEvent) => {
    try {
      const parsed = sseEventSchema.parse(JSON.parse(message.data));
      invalidateForSseEvent(parsed);
      onEvent?.(parsed);
    } catch {
      // Ignore malformed SSE frames; normal queries remain authoritative.
    }
  };

  for (const eventType of ["notification.created", "notification.read", "notification.count", "job.updated", "entity.changed"]) {
    source.addEventListener(eventType, handleMessage);
  }
  source.onmessage = handleMessage;

  return () => source.close();
}
