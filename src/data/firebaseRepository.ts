import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Query,
  type Unsubscribe,
} from "firebase/firestore";
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes,
  type UploadMetadata,
} from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import {
  firebaseAuth,
  firebaseDb,
  firebaseFunctions,
  firebaseStorage,
} from "@/lib/firebase";
import type {
  AccountApprovalStatus,
  AccountRequest,
  AccountRequestInput,
  AppSettings,
  AppUser,
  AvailabilityInput,
  AvailabilitySlot,
  DemoStore,
  EmandarBrandStatus,
  EventCollaborationStatus,
  EnrollmentFormInput,
  ParticipantEnrollmentManagementInput,
  ParticipantOnboardingInput,
  EnrollmentRequestManagementInput,
  EnrollmentRequest,
  NotificationRecord,
  NotificationSettingsUpdateInput,
  OrganizerProfile,
  OrganizerProfileUpdateInput,
  ParticipantProfileUpdateInput,
  PhotoMode,
  TrainerAccountApproval,
  TrainerCalendarFeed,
  TrainerCalendarFeedInput,
  TrainerCalendarLivePreview,
  TrainerExternalBusyMonth,
  TrainerBrandStatusUpdateInput,
  TrainerOrganizerRelation,
  TrainerProfile,
  TrainerProfileUpdateInput,
  TrainingEventBrandStatusUpdateInput,
  TrainingEventCollaborationUpdateInput,
  TrainingEventImage,
  TrainingEventManagementUpdateInput,
  TrainingEventInput,
  TrainingEventScheduleDay,
  TrainingEventStatus,
  TrainingEvent,
} from "@/domain/types";
import { normalizeNotificationSettings } from "@/domain/notifications";
import {
  canDecideTrainingEventCollaboration,
  canManageTrainingEvent,
  deriveEnrollmentFinalStatus,
  getTrainingEventScheduleDays,
  isPhotoModeEnabled,
  isPhotoModeRequired,
  isParticipantEnrollmentActive,
  isTrainingEventCollaborationAccepted,
  isTrainingEventArchived,
  isSelfManagedTrainingEvent,
  isCommunityBrandStatus,
  resolvePhotoMode,
  resolveOrganizerCollaborationStatus,
  resolveMinimumParticipants,
  resolveTrainerCollaborationStatus,
  resolveTrainingEventStatus,
} from "@/domain/utils";

type StorePatch = Partial<DemoStore>;

const collections = {
  users: "users",
  trainers: "trainers",
  organizers: "organizers",
  trainingEvents: "trainingEvents",
  enrollmentRequests: "enrollmentRequests",
  relations: "trainerOrganizerRelations",
  availabilitySlots: "availabilitySlots",
  trainerCalendarFeeds: "trainerCalendarFeeds",
  trainerExternalBusyMonths: "trainerExternalBusyMonths",
  notifications: "notifications",
  accountRequests: "accountRequests",
  trainerAccountApprovals: "trainerAccountApprovals",
  appMeta: "app_meta",
} as const;

export function createEmptyStore(): DemoStore {
  return {
    users: [],
    trainers: [],
    organizers: [],
    relations: [],
    trainingEvents: [],
    publicTrainingEvents: [],
    availabilitySlots: [],
    trainerCalendarFeeds: [],
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

function assertReady() {
  if (!firebaseDb || !firebaseAuth || !firebaseStorage) {
    throw new Error("Firebase nie jest jeszcze gotowy.");
  }

  return {
    auth: firebaseAuth,
    db: firebaseDb,
    storage: firebaseStorage,
  };
}

async function callFirebaseFunction<TInput extends Record<string, unknown> | undefined, TOutput>(
  name: string,
  payload?: TInput,
) {
  if (!firebaseFunctions) {
    throw new Error("Firebase Functions nie jest jeszcze gotowe.");
  }

  const callable = httpsCallable<TInput | undefined, TOutput>(firebaseFunctions, name);
  const result = await callable(payload);
  return result.data;
}

function nowIso() {
  return new Date().toISOString();
}

async function hashTrainerAuthorizationCode(code: string) {
  const normalized = code.trim();

  if (!normalized) {
    throw new Error("Podaj kod trenera.");
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("Przeglądarka nie obsługuje bezpiecznego hashowania kodu.");
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBrandStatus(
  value: EmandarBrandStatus | null | undefined,
): EmandarBrandStatus {
  return value === "supported" ? "supported" : "official";
}

function resolveEventStatus(
  value: TrainingEventStatus | null | undefined,
): TrainingEventStatus {
  return resolveTrainingEventStatus(value);
}

function normalizeEventTags(tags: string[] | null | undefined) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeEventImages(images: TrainingEventImage[] | null | undefined) {
  return (images ?? []).map((image) => ({
    id: image.id,
    url: image.url,
    storagePath: image.storagePath,
    width: image.width,
    height: image.height,
  }));
}

function normalizeScheduleDays(
  scheduleDays: TrainingEventScheduleDay[] | null | undefined,
) {
  const normalizedDays = (scheduleDays ?? []).map((day) => {
    const startsAt = new Date(day.startsAt);
    const endsAt = new Date(day.endsAt);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new Error("Podaj poprawne daty szkolenia.");
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new Error("Każdy dzień szkolenia musi kończyć się po starcie.");
    }

    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
  });

  if (normalizedDays.length === 0) {
    throw new Error("Dodaj przynajmniej jeden dzień szkolenia.");
  }

  const sortedDays = [...normalizedDays].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );

  sortedDays.forEach((day, index) => {
    if (index === 0) {
      return;
    }

    const previousDay = new Date(sortedDays[index - 1]?.startsAt ?? "");
    const currentDay = new Date(day.startsAt);

    previousDay.setHours(0, 0, 0, 0);
    currentDay.setHours(0, 0, 0, 0);

    const daysDifference = Math.round(
      (currentDay.getTime() - previousDay.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDifference !== 1) {
      throw new Error("Dni szkolenia muszą następować kolejno po sobie.");
    }
  });

  return sortedDays;
}

function normalizeEventCollaborationStatus(
  value: EventCollaborationStatus | null | undefined,
  fallback: EventCollaborationStatus,
) {
  if (
    value === "accepted" ||
    value === "pending" ||
    value === "rejected" ||
    value === "not-required"
  ) {
    return value;
  }

  return fallback;
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeUserRoles(value: unknown, fallbackRole?: string | null) {
  const roles = Array.isArray(value)
    ? value.filter(
        (role): role is AppUser["role"] =>
          role === "admin" ||
          role === "trainer" ||
          role === "organizer" ||
          role === "participant",
      )
    : [];

  if (roles.length > 0) {
    return roles;
  }

  if (
    fallbackRole === "admin" ||
    fallbackRole === "trainer" ||
    fallbackRole === "organizer" ||
    fallbackRole === "participant"
  ) {
    return [fallbackRole];
  }

  return ["participant"] satisfies AppUser["roles"];
}

function normalizeAppUserRecord(userId: string, raw: unknown) {
  const normalized = normalizeValue(raw) as Record<string, unknown>;
  const roles = normalizeUserRoles(normalized.roles, typeof normalized.role === "string" ? normalized.role : null);
  const pendingRoles = Array.from(
    new Set(
      Array.isArray(normalized.pendingRoles)
        ? normalized.pendingRoles.filter((role) => role === "trainer" || role === "organizer")
        : [],
    ),
  ) as Array<Exclude<AppUser["role"], "admin" | "participant">>;
  const primaryRole =
    normalized.primaryRole === "admin" ||
    normalized.primaryRole === "trainer" ||
    normalized.primaryRole === "organizer" ||
    normalized.primaryRole === "participant"
      ? normalized.primaryRole
      : roles[0];
  const activeRole =
    normalized.role === "admin" ||
    normalized.role === "trainer" ||
    normalized.role === "organizer" ||
    normalized.role === "participant"
      ? normalized.role
      : primaryRole;
  const accountApprovalStatus: AccountApprovalStatus =
    normalized.accountApprovalStatus === "pending" ||
    normalized.accountApprovalStatus === "rejected" ||
    normalized.accountApprovalStatus === "approved"
      ? normalized.accountApprovalStatus
      : "approved";
  const selectedTrainerIds = Array.from(
    new Set(
      Array.isArray(normalized.selectedTrainerIds)
        ? normalized.selectedTrainerIds.filter((item): item is string => typeof item === "string")
        : [],
    ),
  );
  const approvedTrainerIds = Array.from(
    new Set(
      Array.isArray(normalized.approvedTrainerIds)
        ? normalized.approvedTrainerIds.filter((item): item is string => typeof item === "string")
        : [],
    ),
  );

  return {
    id: userId,
    ...normalized,
    role: roles.includes(activeRole) ? activeRole : primaryRole,
    roles,
    primaryRole,
    pendingRoles,
    accountApprovalStatus,
    selectedTrainerIds,
    approvedTrainerIds,
    trainerProfileId:
      typeof normalized.trainerProfileId === "string"
        ? normalized.trainerProfileId
        : undefined,
    organizerProfileId:
      typeof normalized.organizerProfileId === "string"
        ? normalized.organizerProfileId
        : undefined,
  } as AppUser;
}

function getUserTrainerProfileId(user: Pick<AppUser, "trainerProfileId">) {
  const trainerProfileId = user.trainerProfileId?.trim();

  if (!trainerProfileId) {
    throw new Error("To konto nie ma aktywnego profilu Przekazującego Wiedzę.");
  }

  return trainerProfileId;
}

function getUserOrganizerProfileId(user: Pick<AppUser, "organizerProfileId">) {
  const organizerProfileId = user.organizerProfileId?.trim();

  if (!organizerProfileId) {
    throw new Error("To konto nie ma aktywnego profilu organizatora.");
  }

  return organizerProfileId;
}

export function buildRelationId(trainerId: string, organizerId: string) {
  return `${trainerId}__${organizerId}`;
}

async function getRelationByPair(trainerId: string, organizerId: string) {
  const { db } = assertReady();
  let snapshot;

  try {
    snapshot = await getDoc(doc(db, collections.relations, buildRelationId(trainerId, organizerId)));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "permission-denied"
    ) {
      return null;
    }

    throw error;
  }

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(normalizeValue(snapshot.data()) as Omit<TrainerOrganizerRelation, "id">),
  } as TrainerOrganizerRelation;
}

async function requireApprovedRelation(
  trainer: Pick<TrainerProfile, "id" | "userId">,
  organizer: Pick<OrganizerProfile, "id" | "userId">,
) {
  const relation = await getRelationByPair(trainer.id, organizer.id);

  if (
    !relation ||
    relation.status !== "approved" ||
    relation.trainerUserId !== trainer.userId ||
    relation.organizerUserId !== organizer.userId
  ) {
    throw new Error("Najpierw potrzebujesz zatwierdzonej relacji miedzy trenerem i organizatorem.");
  }

  return relation;
}

function ensureEventCanAcceptEnrollment(event: TrainingEvent) {
  if (isTrainingEventArchived(event)) {
    throw new Error("To szkolenie zostalo zarchiwizowane i nie przyjmuje juz zgloszen.");
  }

  if (!isTrainingEventCollaborationAccepted(event)) {
    throw new Error("To szkolenie czeka jeszcze na pelna akceptacje wspolpracy.");
  }

  if (resolveEventStatus(event.status) === "cancelled") {
    throw new Error("To wydarzenie jest anulowane i nie przyjmuje nowych zgloszen.");
  }

  if (!event.isPublished) {
    throw new Error("To szkolenie nie przyjmuje teraz zgloszen.");
  }
}

function normalizeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item)) as T;
  }

  if (value && typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().toISOString() as T;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeValue(nested)]),
    ) as T;
  }

  return value;
}

function mapDocs<T extends { id: string }>(docs: Array<{ id: string; data: () => unknown }>) {
  return docs.map((item) => ({
    id: item.id,
    ...(normalizeValue(item.data()) as Omit<T, "id">),
  })) as T[];
}

function subscribeArray<T extends { id: string }>(
  source: Query,
  onData: (items: T[]) => void,
) {
  return onSnapshot(source, (snapshot) => {
    onData(mapDocs<T>(snapshot.docs));
  });
}

function pushSorted<T extends { createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function mergeById<T extends { id: string }>(...groups: T[][]) {
  return Array.from(
    new Map(groups.flat().map((item) => [item.id, item])).values(),
  );
}

function normalizeAppSettings(raw: unknown): AppSettings {
  const normalized = normalizeValue(raw) as Record<string, unknown>;
  const signupFallback = normalized.signupPhotoRequired === true ? "required" : "optional";

  return {
    signupPhotoMode: resolvePhotoMode(normalized.signupPhotoMode, signupFallback),
    enrollmentPhotoMode: resolvePhotoMode(normalized.enrollmentPhotoMode, "optional"),
  };
}

async function mapQuery<T extends { id: string }>(source: Query) {
  const snapshot = await getDocs(source);
  return mapDocs<T>(snapshot.docs);
}

export function subscribePublicStore(onPatch: (patch: StorePatch) => void): Unsubscribe {
  const { db } = assertReady();

  const unsubs = [
    onSnapshot(doc(db, collections.appMeta, "publicSettings"), (snapshot) => {
      onPatch({
        appSettings: snapshot.exists()
          ? normalizeAppSettings(snapshot.data())
          : {
              signupPhotoMode: "optional",
              enrollmentPhotoMode: "optional",
            },
      });
    }),
    subscribeArray<TrainerProfile>(
      query(collection(db, collections.trainers), where("isVisible", "==", true)),
      (trainers) => {
        onPatch({ trainers });
      },
    ),
    subscribeArray<TrainingEvent>(
      query(
        collection(db, collections.trainingEvents),
        where("isPublished", "==", true),
      ),
      (trainingEvents) => {
        onPatch({ trainingEvents, publicTrainingEvents: trainingEvents });
      },
    ),
  ];

  onPatch({ organizers: [], trainerAccountApprovals: [] });

  return () => {
    unsubs.forEach((unsubscribe) => unsubscribe());
  };
}

export function subscribeUserProfile(
  userId: string,
  onUser: (user: AppUser | null) => void,
): Unsubscribe {
  const { db } = assertReady();

  return onSnapshot(doc(db, collections.users, userId), (snapshot) => {
    if (!snapshot.exists()) {
      onUser(null);
      return;
    }

    onUser(normalizeAppUserRecord(snapshot.id, snapshot.data()));
  });
}

export async function fetchAppUser(userId: string) {
  const { db } = assertReady();
  const snapshot = await getDoc(doc(db, collections.users, userId));

  if (!snapshot.exists()) {
    throw new Error("To konto nie ma jeszcze profilu aplikacyjnego.");
  }

  return normalizeAppUserRecord(snapshot.id, snapshot.data());
}

export async function ensurePhoneParticipantProfile(input?: {
  seedTrainerId?: string;
  trainerAuthorizationCode?: string;
}) {
  return callFirebaseFunction<
    { seedTrainerId?: string; trainerAuthorizationCode?: string } | undefined,
    | { ok: true; userId: string; accountCreated?: boolean }
    | { ok: true; trainerId: string; organizerProfileCreated: boolean }
  >(
    "ensurePhoneParticipantProfile",
    input,
  );
}

export async function ensurePhoneParticipantProfileForFlow(seedTrainerId?: string) {
  return ensurePhoneParticipantProfile(seedTrainerId ? { seedTrainerId } : undefined);
}

function buildRoleQuery(
  collectionName: string,
  field: string,
  value: string | undefined,
): Query | null {
  const { db } = assertReady();
  if (!value) {
    return null;
  }

  return query(collection(db, collectionName), where(field, "==", value));
}

export function subscribePrivateStore(
  currentUser: AppUser,
  onPatch: (patch: StorePatch) => void,
): Unsubscribe {
  const { db } = assertReady();
  const unsubs: Unsubscribe[] = [];
  const trainerProfileId = currentUser.trainerProfileId;
  const organizerProfileId = currentUser.organizerProfileId;
  let incomingAccountApprovals: TrainerAccountApproval[] = [];
  let outgoingAccountApprovals: TrainerAccountApproval[] = [];
  let participantOwnEnrollmentRequests: EnrollmentRequest[] = [];
  let participantManagedEnrollmentRequests: EnrollmentRequest[] = [];

  function syncAccountApprovals() {
    onPatch({
      trainerAccountApprovals: pushSorted(
        mergeById(incomingAccountApprovals, outgoingAccountApprovals),
      ),
    });
  }

  onPatch({ users: [currentUser] });

  unsubs.push(
    subscribeArray<TrainerProfile>(collection(db, collections.trainers), (trainers) => {
      onPatch({ trainers });
    }),
  );
  unsubs.push(
    subscribeArray<OrganizerProfile>(
      collection(db, collections.organizers),
      (organizers) => {
        onPatch({ organizers });
      },
    ),
  );
  unsubs.push(
    subscribeArray<NotificationRecord>(
      query(collection(db, collections.notifications), where("userId", "==", currentUser.id)),
      (notifications) => {
        onPatch({ notifications: pushSorted(notifications) });
      },
    ),
  );

  if (currentUser.role === "trainer" && trainerProfileId) {
    unsubs.push(
      subscribeArray<TrainerCalendarFeed>(
        query(
          collection(db, collections.trainerCalendarFeeds),
          where("trainerId", "==", trainerProfileId),
          where("trainerUserId", "==", currentUser.id),
        ),
        (trainerCalendarFeeds) => {
          onPatch({ trainerCalendarFeeds: pushSorted(trainerCalendarFeeds) });
        },
      ),
    );
    unsubs.push(
      subscribeArray<TrainerExternalBusyMonth>(
        query(
          collection(db, collections.trainerExternalBusyMonths),
          where("trainerId", "==", trainerProfileId),
        ),
        (trainerExternalBusyMonths) => {
          onPatch({ trainerExternalBusyMonths });
        },
      ),
    );
  } else {
    onPatch({ trainerCalendarFeeds: [], trainerExternalBusyMonths: [] });
  }

  if (currentUser.role === "admin") {
    unsubs.push(
      subscribeArray<TrainerAccountApproval>(
        collection(db, collections.trainerAccountApprovals),
        (trainerAccountApprovals) => {
          onPatch({
            trainerAccountApprovals: pushSorted(trainerAccountApprovals),
          });
        },
      ),
    );
    unsubs.push(
      subscribeArray<TrainingEvent>(collection(db, collections.trainingEvents), (items) => {
        onPatch({ trainingEvents: items });
      }),
    );
    unsubs.push(
      subscribeArray<TrainerOrganizerRelation>(
        collection(db, collections.relations),
        (relations) => {
          onPatch({ relations: pushSorted(relations) });
        },
      ),
    );
    unsubs.push(
      subscribeArray<AvailabilitySlot>(
        collection(db, collections.availabilitySlots),
        (availabilitySlots) => {
          onPatch({ availabilitySlots });
        },
      ),
    );
    unsubs.push(
      subscribeArray<EnrollmentRequest>(
        collection(db, collections.enrollmentRequests),
        (enrollmentRequests) => {
          onPatch({ enrollmentRequests: pushSorted(enrollmentRequests) });
        },
      ),
    );
    unsubs.push(
      subscribeArray<AccountRequest>(
        collection(db, collections.accountRequests),
        (accountRequests) => {
          onPatch({ accountRequests: pushSorted(accountRequests) });
        },
      ),
    );

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }

  const canUseRoleScopedEventQuery =
    currentUser.role === "trainer" || currentUser.role === "organizer";
  const eventsQuery = canUseRoleScopedEventQuery
    ? buildRoleQuery(
        collections.trainingEvents,
        currentUser.role === "trainer" ? "trainerUserId" : "organizerUserId",
        currentUser.id,
      )
    : null;
  if (eventsQuery) {
    unsubs.push(
      subscribeArray<TrainingEvent>(eventsQuery, (trainingEvents) => {
        onPatch({ trainingEvents });
      }),
    );
  } else {
    onPatch({ trainingEvents: currentUser.role === "participant" ? undefined : [] });
  }

  const relationsQuery =
    currentUser.role === "trainer" || currentUser.role === "organizer"
      ? buildRoleQuery(
          collections.relations,
          currentUser.role === "trainer" ? "trainerUserId" : "organizerUserId",
          currentUser.id,
        )
      : null;
  if (relationsQuery) {
    unsubs.push(
      subscribeArray<TrainerOrganizerRelation>(relationsQuery, (relations) => {
        onPatch({ relations: pushSorted(relations) });
      }),
    );
  } else {
    onPatch({ relations: currentUser.role === "participant" ? undefined : [] });
  }

  if (currentUser.role === "trainer") {
    const ownSlotsQuery = buildRoleQuery(
      collections.availabilitySlots,
      "trainerUserId",
      currentUser.id,
    );
    const ownRequestsQuery = buildRoleQuery(
      collections.enrollmentRequests,
      "trainerUserId",
      currentUser.id,
    );

    if (ownSlotsQuery) {
      unsubs.push(
        subscribeArray<AvailabilitySlot>(ownSlotsQuery, (availabilitySlots) => {
          onPatch({ availabilitySlots });
        }),
      );
    } else {
      onPatch({ availabilitySlots: [] });
    }

    if (ownRequestsQuery) {
      unsubs.push(
        subscribeArray<EnrollmentRequest>(ownRequestsQuery, (enrollmentRequests) => {
          onPatch({ enrollmentRequests: pushSorted(enrollmentRequests) });
        }),
      );
    } else {
      onPatch({ enrollmentRequests: [] });
    }

    unsubs.push(
      subscribeArray<TrainerAccountApproval>(
        query(
          collection(db, collections.trainerAccountApprovals),
          where("targetTrainerUserId", "==", currentUser.id),
        ),
        (incomingApprovals) => {
          incomingAccountApprovals = incomingApprovals;
          syncAccountApprovals();
        },
      ),
    );
    unsubs.push(
      subscribeArray<TrainerAccountApproval>(
        query(
          collection(db, collections.trainerAccountApprovals),
          where("requesterUserId", "==", currentUser.id),
        ),
        (outgoingApprovals) => {
          outgoingAccountApprovals = outgoingApprovals;
          syncAccountApprovals();
        },
      ),
    );
  }

  if (currentUser.role === "organizer") {
    if (organizerProfileId) {
      unsubs.push(
        subscribeArray<AvailabilitySlot>(
          query(
            collection(db, collections.availabilitySlots),
            where("visibleToOrganizerIds", "array-contains", organizerProfileId),
          ),
          (availabilitySlots) => {
            onPatch({ availabilitySlots });
          },
        ),
      );
    } else {
      onPatch({ availabilitySlots: [] });
    }

    const organizerRequestsQuery = buildRoleQuery(
      collections.enrollmentRequests,
      "organizerUserId",
      currentUser.id,
    );
    if (organizerRequestsQuery) {
      unsubs.push(
        subscribeArray<EnrollmentRequest>(organizerRequestsQuery, (items) => {
          onPatch({ enrollmentRequests: pushSorted(items) });
        }),
      );
    } else {
      onPatch({ enrollmentRequests: [] });
    }
  }

  if (currentUser.role === "participant") {
    function syncParticipantEnrollmentRequests() {
      onPatch({
        enrollmentRequests: pushSorted(
          mergeById(participantOwnEnrollmentRequests, participantManagedEnrollmentRequests),
        ),
      });
    }

    unsubs.push(
      subscribeArray<TrainingEvent>(collection(db, collections.trainingEvents), (trainingEvents) => {
        onPatch({ trainingEvents });
      }),
    );
    unsubs.push(
      subscribeArray<EnrollmentRequest>(
        query(
          collection(db, collections.enrollmentRequests),
          where("submitterUid", "==", currentUser.id),
        ),
        (enrollmentRequests) => {
          participantOwnEnrollmentRequests = enrollmentRequests;
          syncParticipantEnrollmentRequests();
        },
      ),
    );
    unsubs.push(
      subscribeArray<EnrollmentRequest>(
        query(
          collection(db, collections.enrollmentRequests),
          where("trainerUserId", "==", currentUser.id),
        ),
        (enrollmentRequests) => {
          participantManagedEnrollmentRequests = enrollmentRequests;
          syncParticipantEnrollmentRequests();
        },
      ),
    );
    onPatch({
      relations: [],
      availabilitySlots: [],
      trainerCalendarFeeds: [],
      trainerExternalBusyMonths: [],
    });
  }

  if (currentUser.role !== "trainer" && currentUser.role !== "admin") {
    unsubs.push(
      subscribeArray<TrainerAccountApproval>(
        query(
          collection(db, collections.trainerAccountApprovals),
          where("requesterUserId", "==", currentUser.id),
        ),
        (trainerAccountApprovals) => {
          outgoingAccountApprovals = trainerAccountApprovals;
          syncAccountApprovals();
        },
      ),
    );
  }

  return () => {
    unsubs.forEach((unsubscribe) => unsubscribe());
  };
}

async function ensureAnonymousSession() {
  const { auth } = assertReady();

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  if (!auth.currentUser) {
    throw new Error("Nie udało się uruchomić sesji anonimowej.");
  }

  return auth.currentUser;
}

function sanitizeNotificationSettingsInput(input: NotificationSettingsUpdateInput) {
  const normalized = normalizeNotificationSettings(input);

  return {
    ...normalized,
    sendToParticipants:
      normalized.requireParticipantSmsConfirmation || normalized.sendToParticipants,
  };
}

async function getTrainerProfile(trainerId: string) {
  const { db } = assertReady();
  const snapshot = await getDoc(doc(db, collections.trainers, trainerId));

  if (!snapshot.exists()) {
    throw new Error("Nie znaleziono profilu Przekazującego Wiedzę.");
  }

  return {
    id: snapshot.id,
    ...(normalizeValue(snapshot.data()) as Omit<TrainerProfile, "id">),
  } as TrainerProfile;
}

async function getOrganizerProfile(organizerId: string) {
  const { db } = assertReady();
  const snapshot = await getDoc(doc(db, collections.organizers, organizerId));

  if (!snapshot.exists()) {
    throw new Error("Nie znaleziono profilu organizatora.");
  }

  return {
    id: snapshot.id,
    ...(normalizeValue(snapshot.data()) as Omit<OrganizerProfile, "id">),
  } as OrganizerProfile;
}

async function getEvent(eventId: string) {
  const { db } = assertReady();
  const snapshot = await getDoc(doc(db, collections.trainingEvents, eventId));

  if (!snapshot.exists()) {
    throw new Error("Nie znaleziono szkolenia.");
  }

  return {
    id: snapshot.id,
    ...(normalizeValue(snapshot.data()) as Omit<TrainingEvent, "id">),
  } as TrainingEvent;
}

async function getTrainerCalendarFeed(feedId: string) {
  const { db } = assertReady();
  const snapshot = await getDoc(doc(db, collections.trainerCalendarFeeds, feedId));

  if (!snapshot.exists()) {
    throw new Error("Nie znaleziono feedu iCal.");
  }

  return {
    id: snapshot.id,
    ...(normalizeValue(snapshot.data()) as Omit<TrainerCalendarFeed, "id">),
  } as TrainerCalendarFeed;
}

async function getRelation(relationId: string) {
  const { db } = assertReady();
  const snapshot = await getDoc(doc(db, collections.relations, relationId));

  if (!snapshot.exists()) {
    throw new Error("Nie znaleziono relacji.");
  }

  return {
    id: snapshot.id,
    ...(normalizeValue(snapshot.data()) as Omit<TrainerOrganizerRelation, "id">),
  } as TrainerOrganizerRelation;
}

async function updateOrganizerSlotVisibility(
  relation: Pick<TrainerOrganizerRelation, "trainerId" | "organizerId">,
  isVisible: boolean,
) {
  const { db } = assertReady();
  const slotSnapshots = await getDocs(
    query(
      collection(db, collections.availabilitySlots),
      where("trainerId", "==", relation.trainerId),
    ),
  );

  await Promise.all(
    slotSnapshots.docs.map((slotSnapshot) =>
      updateDoc(slotSnapshot.ref, {
        visibleToOrganizerIds: isVisible
          ? arrayUnion(relation.organizerId)
          : arrayRemove(relation.organizerId),
      }),
    ),
  );
}

async function archiveEventDocument(
  event: TrainingEvent,
  actor: AppUser,
  reason: TrainingEvent["archivedReason"],
) {
  const { db } = assertReady();

  await updateDoc(doc(db, collections.trainingEvents, event.id), {
    archivedAt: nowIso(),
    archivedByRole: actor.role,
    archivedReason: reason,
    archivedForOrganizerId: event.organizerId ?? null,
    isPublished: false,
  });
}

async function waitForRelationArchiveEffects(
  relation: Pick<TrainerOrganizerRelation, "trainerId" | "organizerId">,
) {
  const { db } = assertReady();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const eventSnapshots = await getDocs(
      query(
        collection(db, collections.trainingEvents),
        where("trainerId", "==", relation.trainerId),
        where("organizerId", "==", relation.organizerId),
      ),
    );

    const allArchived = eventSnapshots.docs.every((eventSnapshot) =>
      Boolean(eventSnapshot.data().archivedAt),
    );

    if (allArchived) {
      return;
    }

    await sleep(100);
  }
}

async function notifyUser(
  userId: string,
  title: string,
  body: string,
  entityType: NotificationRecord["entityType"],
) {
  void userId;
  void title;
  void body;
  void entityType;
}

async function notifyUsers(
  userIds: Array<string | null | undefined>,
  title: string,
  body: string,
  entityType: NotificationRecord["entityType"],
) {
  void userIds;
  void title;
  void body;
  void entityType;
}

async function getEnrollmentRequestsForEvent(eventId: string) {
  const { db } = assertReady();
  return mapQuery<EnrollmentRequest>(
    query(collection(db, collections.enrollmentRequests), where("eventId", "==", eventId)),
  );
}

function countActiveEnrollmentRequests(requests: EnrollmentRequest[]) {
  return requests.filter((request) => isParticipantEnrollmentActive(request)).length;
}

function countAcceptedEnrollmentRequests(requests: EnrollmentRequest[]) {
  return requests.filter(
    (request) =>
      request.finalStatus === "accepted" && isParticipantEnrollmentActive(request),
  ).length;
}

function resolveManagedEventStatus(
  currentStatus: TrainingEventStatus | undefined,
  acceptedCount: number,
  minimumParticipants: number,
) {
  if (resolveEventStatus(currentStatus) === "cancelled") {
    return "cancelled" as const;
  }

  return acceptedCount >= minimumParticipants ? "confirmed" : "active";
}

async function syncEventEnrollmentState(
  eventId: string,
  overrides?: Partial<Pick<TrainingEvent, "status" | "capacity" | "minimumParticipants">>,
) {
  const { db } = assertReady();
  const event = await getEvent(eventId);
  const requests = await getEnrollmentRequestsForEvent(eventId);
  const acceptedCount = countAcceptedEnrollmentRequests(requests);
  const capacity = Math.max(1, overrides?.capacity ?? event.capacity);
  const minimumParticipants = Math.max(
    1,
    Math.min(
      capacity,
      overrides?.minimumParticipants ?? resolveMinimumParticipants(event),
    ),
  );
  const nextStatus = resolveManagedEventStatus(
    overrides?.status ?? event.status,
    acceptedCount,
    minimumParticipants,
  );

  await updateDoc(doc(db, collections.trainingEvents, eventId), {
    capacity,
    enrolledCount: acceptedCount,
    minimumParticipants,
    status: nextStatus,
  });
}

export async function signIn(email: string, password: string) {
  const { auth } = assertReady();
  const result = await signInWithEmailAndPassword(auth, email, password);
  return fetchAppUser(result.user.uid);
}

export async function signOut() {
  const { auth } = assertReady();
  await firebaseSignOut(auth);
}

export async function updateActiveRole(currentUser: AppUser, role: AppUser["role"]) {
  const { db } = assertReady();

  if (!currentUser.roles.includes(role)) {
    throw new Error("Nie mozesz przelaczyc na role, ktorej to konto nie ma.");
  }

  await updateDoc(doc(db, collections.users, currentUser.id), {
    role,
  });
}

function getFirebaseApiKey() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("Brak konfiguracji VITE_FIREBASE_API_KEY.");
  }

  return apiKey;
}

function slugifyDisplayName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRequestedRoles(
  requestedRoles: Array<"trainer" | "organizer" | "participant"> | undefined,
) {
  return Array.from(new Set((requestedRoles ?? []).filter(Boolean))) as Array<
    "trainer" | "organizer" | "participant"
  >;
}

async function createPasswordAuthUser(email: string, password: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${getFirebaseApiKey()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | { localId?: string; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.localId) {
    const message = payload?.error?.message;
    if (message === "EMAIL_EXISTS") {
      throw new Error("Konto z tym adresem email już istnieje.");
    }

    throw new Error("Nie udało się utworzyć konta Auth.");
  }

  return payload.localId;
}

async function sendPasswordReset(email: string) {
  await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${getFirebaseApiKey()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
      }),
    },
  );
}

export async function submitEnrollment(input: EnrollmentFormInput) {
  const { auth, storage } = assertReady();
  await ensureAnonymousSession();

  if (
    input.photoFile &&
    !["image/jpeg", "image/png", "image/webp"].includes(input.photoFile.type)
  ) {
    throw new Error("Zdjęcie musi być w formacie JPG, PNG albo WEBP.");
  }
  if (input.photoFile && input.photoFile.size > 5 * 1024 * 1024) {
    throw new Error("Zdjęcie nie może być większe niż 5 MB.");
  }

  const draft = await callFirebaseFunction<
    Pick<
      EnrollmentFormInput,
      "eventId" | "imieNazwisko" | "telefon" | "polecenieOdKogo" | "wiadomosc"
    >,
    { requestId: string; photoPath: string | null; photoMode: PhotoMode }
  >("createEnrollmentDraft", {
    eventId: input.eventId,
    imieNazwisko: input.imieNazwisko,
    telefon: input.telefon,
    polecenieOdKogo: input.polecenieOdKogo,
    wiadomosc: input.wiadomosc,
  });

  try {
    if (!isPhotoModeEnabled(draft.photoMode) && input.photoFile) {
      throw new Error("To szkolenie nie zbiera zdjęcia twarzy.");
    }

    const profileAvatar =
      input.photoFile &&
      isPhotoModeEnabled(draft.photoMode) &&
      auth.currentUser &&
      !auth.currentUser.isAnonymous
        ? await uploadCurrentUserAvatar(input.photoFile)
        : null;

    if (isPhotoModeRequired(draft.photoMode) && !input.photoFile) {
      throw new Error("To szkolenie wymaga zdjęcia twarzy.");
    }

    if (input.photoFile) {
      if (!draft.photoPath) {
        throw new Error("To szkolenie nie przyjmuje teraz zdjęcia twarzy.");
      }

      const metadata: UploadMetadata = { contentType: input.photoFile.type };
      await uploadBytes(ref(storage, draft.photoPath), input.photoFile, metadata);
    }

    await callFirebaseFunction<
      {
        requestId: string;
        photoPath?: string;
        avatarPath?: string;
        avatarUrl?: string;
      },
      { ok: true }
    >("finalizeEnrollmentDraft", {
      requestId: draft.requestId,
      photoPath: input.photoFile ? draft.photoPath ?? undefined : undefined,
      avatarPath: profileAvatar?.avatarPath,
      avatarUrl: profileAvatar?.avatarUrl,
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Nie udało się wgrać zdjęcia.");
  }
}

export async function decideEnrollment(
  requestId: string,
  actor: AppUser,
  decision: "accepted" | "rejected" | "pending",
) {
  void actor;
  await callFirebaseFunction<
    {
      requestId: string;
      decision: "accepted" | "rejected";
    },
    { ok: true }
  >("decideEnrollment", {
    requestId,
    decision: decision === "pending" ? "rejected" : decision,
  });
  return;

  const { db } = assertReady();
  const requestRef = doc(db, collections.enrollmentRequests, requestId);
  const requestSnapshot = await getDoc(requestRef);

  if (!requestSnapshot.exists()) {
    throw new Error("Nie znaleziono zgłoszenia.");
  }

  const request = {
    id: requestSnapshot.id,
    ...(normalizeValue(requestSnapshot.data()) as Omit<EnrollmentRequest, "id">),
  } as EnrollmentRequest;
  const trainer = await getTrainerProfile(request.trainerId);
  const organizer = request.organizerId
    ? await getOrganizerProfile(request.organizerId)
    : null;

  const updates: Record<string, unknown> = {};
  if (actor.role === "trainer" && actor.trainerProfileId === trainer.id) {
    updates.trainerDecision = decision;
  } else if (
    organizer &&
    actor.role === "organizer" &&
    actor.organizerProfileId === organizer.id
  ) {
    updates.organizerDecision = decision;
  } else if (actor.role === "admin") {
    updates.trainerDecision = decision;
    updates.organizerDecision = request.requiresOrganizerApproval ? decision : "pending";
  } else if (actor.role !== "admin") {
    throw new Error("Brak dostępu do tej decyzji.");
  }

  const finalStatus = deriveEnrollmentFinalStatus(
    (updates.trainerDecision as EnrollmentRequest["trainerDecision"]) ??
      request.trainerDecision,
    (updates.organizerDecision as EnrollmentRequest["organizerDecision"]) ??
      request.organizerDecision,
    request.requiresOrganizerApproval,
  );

  await updateDoc(requestRef, {
    ...updates,
    finalStatus,
  });

  await syncEventEnrollmentState(request.eventId);

  await Promise.all([
    notifyUser(
      trainer.userId,
      "Zmieniono status zgłoszenia",
      `${request.imieNazwisko}: ${finalStatus}.`,
      "request",
    ),
    notifyUser(
      organizer?.userId ?? trainer.userId,
      "Zmieniono status zgłoszenia",
      `${request.imieNazwisko}: ${finalStatus}.`,
      "request",
    ),
  ]);
}

export async function manageEnrollmentRequest(
  input: EnrollmentRequestManagementInput,
  actor: AppUser,
) {
  void actor;
  await callFirebaseFunction<
    {
      requestId: string;
      decision: EnrollmentRequestManagementInput["decision"];
      transferTargetEventId?: string;
    },
    { ok: true }
  >("manageEnrollmentRequest", {
    requestId: input.requestId,
    decision: input.decision,
    transferTargetEventId: input.transferTargetEventId?.trim() || undefined,
  });
  return;

  const { db } = assertReady();
  const requestRef = doc(db, collections.enrollmentRequests, input.requestId);
  const requestSnapshot = await getDoc(requestRef);

  if (!requestSnapshot.exists()) {
    throw new Error("Nie znaleziono zgłoszenia.");
  }

  const request = {
    id: requestSnapshot.id,
    ...(normalizeValue(requestSnapshot.data()) as Omit<EnrollmentRequest, "id">),
  } as EnrollmentRequest;
  const sourceEvent = await getEvent(request.eventId);
  const canManageSource = canManageTrainingEvent(sourceEvent, actor);

  if (!canManageSource) {
    throw new Error("Możesz zarządzać tylko zgłoszeniami do swoich wydarzeń.");
  }

  const targetEventId = input.transferTargetEventId?.trim();
  const targetEvent = targetEventId ? await getEvent(targetEventId) : sourceEvent;

  if (targetEventId) {
    const canManageTarget = canManageTrainingEvent(targetEvent, actor);

    if (!canManageTarget) {
      throw new Error("Możesz przenosić osoby tylko do swoich wydarzeń.");
    }
  }

  const targetTrainer = await getTrainerProfile(targetEvent.trainerId);
  const targetOrganizer = targetEvent.organizerId
    ? await getOrganizerProfile(targetEvent.organizerId)
    : null;
  const targetRequiresOrganizerApproval =
    targetEvent.requiresOrganizerApproval ?? !isSelfManagedTrainingEvent(targetEvent);

  let nextTrainerDecision =
    !targetEventId || request.trainerId === targetEvent.trainerId
      ? request.trainerDecision
      : "pending";
  let nextOrganizerDecision =
    targetRequiresOrganizerApproval
      ? !targetEventId || request.organizerId === targetEvent.organizerId
        ? request.organizerDecision
        : "pending"
      : "pending";

  if (actor.role === "trainer" && actor.trainerProfileId === targetEvent.trainerId) {
    nextTrainerDecision = input.decision;
  } else if (
    actor.role === "organizer" &&
    actor.organizerProfileId === targetEvent.organizerId &&
    targetRequiresOrganizerApproval
  ) {
    nextOrganizerDecision = input.decision;
  } else if (actor.role === "admin") {
    nextTrainerDecision = input.decision;
    nextOrganizerDecision = targetRequiresOrganizerApproval ? input.decision : "pending";
  }

  const nextFinalStatus = deriveEnrollmentFinalStatus(
    nextTrainerDecision,
    nextOrganizerDecision,
    targetRequiresOrganizerApproval,
  );

  await updateDoc(requestRef, {
    eventId: targetEvent.id,
    trainerId: targetEvent.trainerId,
    organizerId: targetEvent.organizerId ?? null,
    trainerUserId: targetTrainer.userId,
    organizerUserId: targetOrganizer?.userId ?? null,
    trainerDecision: nextTrainerDecision,
    organizerDecision: nextOrganizerDecision,
    finalStatus: nextFinalStatus,
    requiresOrganizerApproval: targetRequiresOrganizerApproval,
  });

  await Promise.all([
    syncEventEnrollmentState(request.eventId),
    targetEvent.id === request.eventId
      ? Promise.resolve()
      : syncEventEnrollmentState(targetEvent.id),
  ]);

  await notifyUsers(
    [targetTrainer.userId, targetOrganizer?.userId],
    "Zmieniono status uczestnika",
    `${request.imieNazwisko}: ${nextFinalStatus}.`,
    "request",
  );
}

export async function manageOwnEnrollment(
  input: ParticipantEnrollmentManagementInput,
  actor: AppUser,
) {
  void actor;
  await callFirebaseFunction<
    ParticipantEnrollmentManagementInput,
    { ok: true }
  >("manageOwnEnrollment", {
    requestId: input.requestId,
    action: input.action,
    transferTargetEventId: input.transferTargetEventId?.trim() || undefined,
  });
}

export async function requestRelation(currentUser: AppUser, trainerId: string) {
  if (currentUser.role !== "organizer" || !currentUser.organizerProfileId) {
    throw new Error("Tylko organizator może prosić o relację.");
  }

  const trainer = await getTrainerProfile(trainerId);
  const organizer = await getOrganizerProfile(currentUser.organizerProfileId);
  const relationId = buildRelationId(trainerId, organizer.id);
  const existingRelation = await getRelationByPair(trainerId, organizer.id);

  if (existingRelation?.status === "pending" || existingRelation?.status === "approved") {
    throw new Error("Ta relacja juz istnieje.");
  }

  if (existingRelation) {
    const { db } = assertReady();
    await updateDoc(doc(db, collections.relations, relationId), {
      status: "pending",
      requestedBy: "organizer",
      createdAt: nowIso(),
      trainerUserId: trainer.userId,
      organizerUserId: organizer.userId,
      detachedAt: deleteField(),
      detachedByRole: deleteField(),
      archivedLinkedEvents: deleteField(),
    });
  } else {
    const { db } = assertReady();
    await setDoc(doc(db, collections.relations, relationId), {
      trainerId,
      organizerId: organizer.id,
      trainerUserId: trainer.userId,
      organizerUserId: organizer.userId,
      status: "pending",
      requestedBy: "organizer",
      createdAt: nowIso(),
    });
  }

  if (organizer) {
    await notifyUser(
    trainer.userId,
    "Nowa prośba o współpracę",
    `${organizer.displayName} chce uzyskać dostęp do Twoich terminów.`,
    "relation",
    );
  }
}

export async function decideRelation(
  relationId: string,
  actor: AppUser,
  status: "approved" | "rejected",
) {
  const { db } = assertReady();
  const relationRef = doc(db, collections.relations, relationId);
  const relation = await getRelation(relationId);

  const canDecide =
    actor.role === "admin" ||
    (actor.role === "trainer" &&
      actor.trainerProfileId === relation.trainerId &&
      relation.requestedBy === "organizer") ||
    (actor.role === "organizer" &&
      actor.organizerProfileId === relation.organizerId &&
      relation.requestedBy === "trainer");

  if (!canDecide) {
    throw new Error("Możesz zarządzać tylko swoimi relacjami.");
  }

  if (relation.status !== "pending") {
    throw new Error("Tylko oczekujaca relacje mozna zaakceptowac albo odrzucic.");
  }

  await updateDoc(relationRef, {
    status,
    detachedAt: deleteField(),
    detachedByRole: deleteField(),
    archivedLinkedEvents: deleteField(),
  });
  await updateOrganizerSlotVisibility(relation, status === "approved");

  const trainer = await getTrainerProfile(relation.trainerId);
  const organizerUserId =
    relation.organizerUserId ?? (await getOrganizerProfile(relation.organizerId)).userId;

  await notifyUser(
    organizerUserId,
    "Zmieniono status relacji",
    `${trainer.displayName}: ${status === "approved" ? "zaakceptowano" : "odrzucono"} współpracę.`,
    "relation",
  );
}

export async function detachRelation(
  relationId: string,
  actor: AppUser,
  archiveLinkedEvents = false,
) {
  const { db } = assertReady();
  const relationRef = doc(db, collections.relations, relationId);
  const relation = await getRelation(relationId);

  const canDetach =
    actor.role === "admin" ||
    (actor.role === "trainer" && actor.trainerProfileId === relation.trainerId) ||
    (actor.role === "organizer" && actor.organizerProfileId === relation.organizerId);

  if (!canDetach) {
    throw new Error("Mozesz odpiac tylko wlasna relacje.");
  }

  if (relation.status !== "approved") {
    throw new Error("Odpiac mozna tylko aktywna relacje.");
  }

  const shouldArchiveLinkedEvents = actor.role === "trainer" && archiveLinkedEvents;

  await updateDoc(relationRef, {
    status: "detached",
    detachedAt: nowIso(),
    detachedByRole: actor.role,
    archivedLinkedEvents: shouldArchiveLinkedEvents,
  });

  if (shouldArchiveLinkedEvents) {
    await waitForRelationArchiveEffects(relation);
  }
}

export async function addAvailabilitySlot(input: AvailabilityInput, actor: AppUser) {
  const { db } = assertReady();
  const trainerId =
    actor.role === "trainer" && actor.trainerProfileId
      ? actor.trainerProfileId
      : input.trainerId;
  const trainer = await getTrainerProfile(trainerId);

  if (actor.role === "trainer" && actor.trainerProfileId !== trainer.id) {
    throw new Error("Możesz dodawać terminy tylko sobie.");
  }

  const approvedRelations = await mapQuery<TrainerOrganizerRelation>(
    query(
      collection(db, collections.relations),
      where("trainerId", "==", trainer.id),
      where("trainerUserId", "==", trainer.userId),
      where("status", "==", "approved"),
    ),
  );

  await addDoc(collection(db, collections.availabilitySlots), {
    trainerId: trainer.id,
    trainerUserId: trainer.userId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    location: input.location,
    notes: input.notes,
    visibility: "approved-organizers",
    visibleToOrganizerIds: approvedRelations.map((relation) => relation.organizerId),
  });
}

export async function addTrainerCalendarFeed(
  input: TrainerCalendarFeedInput,
  actor: AppUser,
) {
  const { db } = assertReady();

  if (actor.role !== "trainer" || !actor.trainerProfileId) {
    throw new Error("Tylko trener może podpiąć swój kalendarz iCal.");
  }

  const trainer = await getTrainerProfile(actor.trainerProfileId);

  if (isCommunityBrandStatus(trainer.brandStatus)) {
    throw new Error("Panel wspólnych terminów jest dostępny tylko dla oficjalnych trenerów.");
  }

  const createdAt = nowIso();
  await addDoc(collection(db, collections.trainerCalendarFeeds), {
    trainerId: trainer.id,
    trainerUserId: trainer.userId,
    provider: input.provider,
    url: input.url.trim(),
    enabled: true,
    lastSyncStatus: "idle",
    createdAt,
    updatedAt: createdAt,
  });
}

export async function updateTrainerCalendarFeedEnabled(
  feedId: string,
  enabled: boolean,
  actor: AppUser,
) {
  const { db } = assertReady();

  if (actor.role !== "trainer" || !actor.trainerProfileId) {
    throw new Error("Tylko trener może zarządzać feedami iCal.");
  }

  const trainer = await getTrainerProfile(actor.trainerProfileId);
  const feed = await getTrainerCalendarFeed(feedId);

  if (feed.trainerId !== trainer.id) {
    throw new Error("Możesz zarządzać tylko swoimi feedami iCal.");
  }

  await updateDoc(doc(db, collections.trainerCalendarFeeds, feedId), {
    enabled,
    updatedAt: nowIso(),
  });
}

export async function removeTrainerCalendarFeed(feedId: string, actor: AppUser) {
  const { db } = assertReady();

  if (actor.role !== "trainer" || !actor.trainerProfileId) {
    throw new Error("Tylko trener może usuwać feedy iCal.");
  }

  const trainer = await getTrainerProfile(actor.trainerProfileId);
  const feed = await getTrainerCalendarFeed(feedId);

  if (feed.trainerId !== trainer.id) {
    throw new Error("Możesz usuwać tylko swoje feedy iCal.");
  }

  await deleteDoc(doc(db, collections.trainerCalendarFeeds, feedId));
}

export async function syncOwnTrainerCalendarFeeds(actor: AppUser) {
  if (actor.role !== "trainer" || !actor.trainerProfileId) {
    throw new Error("Tylko trener moze synchronizowac feedy iCal.");
  }

  const trainer = await getTrainerProfile(actor.trainerProfileId);

  if (isCommunityBrandStatus(trainer.brandStatus)) {
    throw new Error("Panel wspolnych terminow jest dostepny tylko dla oficjalnych trenerow.");
  }

  return callFirebaseFunction<undefined, TrainerCalendarLivePreview>(
    "getOwnTrainerCalendarPreview",
  );
}

export async function createTrainingEvent(input: TrainingEventInput, actor: AppUser) {
  const { db } = assertReady();
  if (actor.role !== "trainer" || !actor.trainerProfileId) {
    throw new Error("Tylko Przekazujący Wiedzę może tworzyć szkolenia.");
  }

  const trainer = await getTrainerProfile(actor.trainerProfileId);
  const brandStatus = resolveBrandStatus(input.brandStatus ?? trainer.brandStatus);
  const isCommunityTrainer = isCommunityBrandStatus(brandStatus);
  const organizer =
    !isCommunityTrainer && input.organizerId
      ? await getOrganizerProfile(input.organizerId)
      : null;

  if (!isCommunityTrainer) {
    if (!organizer) {
      throw new Error("Najpierw wybierz organizatora dla szkolenia.");
    }

    await requireApprovedRelation(trainer, organizer);
  }

  const normalizedScheduleDays = normalizeScheduleDays(input.scheduleDays);
  const firstScheduleDay = normalizedScheduleDays[0];
  const lastScheduleDay = normalizedScheduleDays[normalizedScheduleDays.length - 1];
  const startsAt = new Date(firstScheduleDay?.startsAt ?? "");
  const endsAt = new Date(lastScheduleDay?.endsAt ?? "");

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime())
  ) {
    throw new Error("Podaj poprawne daty szkolenia.");
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("Data zakończenia musi być późniejsza niż start.");
  }

  if (false) {
    throw new Error("Drugi dzień szkolenia musi kończyć się po starcie.");
  }

  if (false) {
    throw new Error("Drugi dzień szkolenia musi zaczynać się po pierwszym dniu.");
  }

  const trimmedLocation = input.location.trim();
  const trimmedTitle = input.title?.trim() ?? "";
  const normalizedTags = normalizeEventTags(input.tags);
  const minimumParticipants = Math.max(
    1,
    Math.min(input.capacity, input.minimumParticipants ?? input.capacity),
  );

  if (isCommunityTrainer && !trimmedTitle) {
    throw new Error("Podaj tytuł wydarzenia społeczności.");
  }

  await addDoc(collection(db, collections.trainingEvents), {
    trainerId: trainer.id,
    organizerId: organizer?.id ?? null,
    trainerUserId: trainer.userId,
    organizerUserId: organizer?.userId ?? null,
    title: isCommunityTrainer ? trimmedTitle : trimmedLocation,
    summary: input.summary.trim(),
    description: input.description.trim(),
    type: input.type.trim(),
    startsAt: firstScheduleDay?.startsAt ?? startsAt.toISOString(),
    endsAt: lastScheduleDay?.endsAt ?? endsAt.toISOString(),
    scheduleDays: normalizedScheduleDays,
    location: trimmedLocation,
    tags: normalizedTags,
    capacity: input.capacity,
    enrolledCount: 0,
    isPublished: input.isPublished,
    imageHint: trimmedLocation.split(/\s+/)[0]?.toLowerCase() || "event",
    brandStatus,
    status: resolveEventStatus(input.status),
    minimumParticipants,
    requiresOrganizerApproval: !isCommunityTrainer,
  });

  if (organizer) {
    await notifyUser(
      organizer.userId,
    "Nowe szkolenie od Przekazującego Wiedzę",
    `${trainer.displayName} dodał szkolenie ${trimmedLocation}.`,
      "event",
    );
  }
}

export async function createUnifiedTrainingEvent(
  input: TrainingEventInput,
  actor: AppUser,
) {
  void actor;
  await callFirebaseFunction<
    {
      trainerId?: string;
      organizerId?: string;
      title?: string;
      eventImages?: TrainingEventImage[];
      useEventImageAsCover?: boolean;
      summary: string;
      description: string;
      type: string;
      scheduleDays: TrainingEventScheduleDay[];
      location: string;
      tags?: string[];
      capacity: number;
      isPublished: boolean;
      status?: TrainingEventStatus;
      minimumParticipants?: number;
      brandStatus?: EmandarBrandStatus;
      selfManagedByTrainer?: boolean;
    },
    { ok: true; eventId: string }
  >("createUnifiedTrainingEvent", {
    trainerId: input.trainerId,
    organizerId: input.organizerId,
    title: input.title,
    eventImages: normalizeEventImages(input.eventImages),
    useEventImageAsCover: input.useEventImageAsCover === true,
    summary: input.summary,
    description: input.description,
    type: input.type,
    scheduleDays: input.scheduleDays,
    location: input.location,
    tags: input.tags,
    capacity: input.capacity,
    isPublished: input.isPublished,
    status: input.status,
    minimumParticipants: input.minimumParticipants,
    brandStatus: input.brandStatus,
    selfManagedByTrainer: input.selfManagedByTrainer,
  });
  return;

  const { db } = assertReady();

  if (
    (actor.role !== "trainer" && actor.role !== "organizer") ||
    (actor.role === "trainer" && !actor.trainerProfileId) ||
    (actor.role === "organizer" && !actor.organizerProfileId)
  ) {
    throw new Error("Tylko Przekazujący Wiedzę albo organizator może tworzyć szkolenia.");
  }

  const actingOrganizer =
    actor.role === "organizer"
      ? await getOrganizerProfile(getUserOrganizerProfileId(actor))
      : null;
  const actingTrainer =
    actor.role === "trainer"
      ? await getTrainerProfile(getUserTrainerProfileId(actor))
      : null;
  const trainer =
    actor.role === "trainer"
      ? actingTrainer
      : input.trainerId
        ? await getTrainerProfile(input.trainerId)
        : null;

  if (!trainer) {
    throw new Error("Najpierw wybierz Przekazującego Wiedzę dla szkolenia.");
  }

  const brandStatus =
    actor.role === "trainer"
      ? resolveBrandStatus(input.brandStatus ?? trainer.brandStatus)
      : "official";
  const isCommunityTrainer = isCommunityBrandStatus(brandStatus);

  if (actor.role === "organizer" && isCommunityTrainer) {
    throw new Error("Organizator może tworzyć tylko oficjalne szkolenia.");
  }

  if (actor.role === "organizer" && isCommunityBrandStatus(trainer.brandStatus)) {
    throw new Error("Wydarzenia społeczności pozostają po stronie ich właściciela.");
  }

  const selfManagedByTrainer =
    actor.role === "trainer" && !isCommunityTrainer
      ? Boolean(input.selfManagedByTrainer || !input.organizerId)
      : false;
  const organizer =
    isCommunityTrainer || selfManagedByTrainer
      ? null
      : actor.role === "organizer"
        ? actingOrganizer
        : input.organizerId
          ? await getOrganizerProfile(input.organizerId)
          : null;

  if (!isCommunityTrainer && !selfManagedByTrainer && !organizer) {
    throw new Error("Najpierw wybierz organizatora dla szkolenia.");
  }

  if (!isCommunityTrainer && !selfManagedByTrainer && organizer) {
    await requireApprovedRelation(trainer, organizer);
  }

  const normalizedScheduleDays = normalizeScheduleDays(input.scheduleDays);
  const firstScheduleDay = normalizedScheduleDays[0];
  const lastScheduleDay = normalizedScheduleDays[normalizedScheduleDays.length - 1];
  const startsAt = new Date(firstScheduleDay?.startsAt ?? "");
  const endsAt = new Date(lastScheduleDay?.endsAt ?? "");

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime())
  ) {
    throw new Error("Podaj poprawne daty szkolenia.");
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("Data zakończenia musi być późniejsza niż start.");
  }

  if (false) {
    throw new Error("Drugi dzień szkolenia musi kończyć się po starcie.");
  }

  if (false) {
    throw new Error("Drugi dzień szkolenia musi zaczynać się po pierwszym dniu.");
  }

  const trimmedLocation = input.location.trim();
  const normalizedTags = normalizeEventTags(input.tags);
  const minimumParticipants = Math.max(
    1,
    Math.min(input.capacity, input.minimumParticipants ?? input.capacity),
  );

  await addDoc(collection(db, collections.trainingEvents), {
    trainerId: trainer.id,
    organizerId: organizer?.id ?? null,
    trainerUserId: trainer.userId,
    organizerUserId: organizer?.userId ?? null,
    title: trimmedLocation,
    summary: input.summary.trim(),
    description: input.description.trim(),
    type: input.type.trim(),
    startsAt: firstScheduleDay?.startsAt ?? startsAt.toISOString(),
    endsAt: lastScheduleDay?.endsAt ?? endsAt.toISOString(),
    scheduleDays: normalizedScheduleDays,
    location: trimmedLocation,
    tags: normalizedTags,
    capacity: input.capacity,
    enrolledCount: 0,
    isPublished: input.isPublished,
    imageHint: trimmedLocation.split(/\s+/)[0]?.toLowerCase() || "event",
    brandStatus,
    status: resolveEventStatus(input.status),
    minimumParticipants,
    requiresOrganizerApproval: !isCommunityTrainer && !selfManagedByTrainer,
    trainerCollaborationStatus: actor.role === "trainer" ? "accepted" : "pending",
    organizerCollaborationStatus:
      isCommunityTrainer || selfManagedByTrainer
        ? "not-required"
        : actor.role === "organizer"
          ? "accepted"
          : "pending",
    selfManagedByTrainer: isCommunityTrainer ? true : selfManagedByTrainer,
    createdByRole: actor.role,
  });

  if (isCommunityTrainer || selfManagedByTrainer) {
    return;
  }

  if (actor.role === "trainer" && organizer) {
    await notifyUser(
      organizer.userId,
      "Nowe szkolenie czeka na akceptację",
      `${trainer.displayName} dodał szkolenie ${trimmedLocation}.`,
      "event",
    );
  }

  if (actor.role === "organizer") {
    await notifyUser(
      trainer.userId,
      "Nowe szkolenie czeka na akceptację",
      `${organizer?.displayName ?? "Organizator"} dodał szkolenie ${trimmedLocation}.`,
      "event",
    );
  }
}

async function uploadCurrentUserAvatar(file: File) {
  const { auth, storage } = assertReady();

  if (!auth.currentUser) {
    throw new Error("Najpierw potwierdź numer telefonu.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Zdjęcie musi być w formacie JPG, PNG albo WEBP.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Zdjęcie nie może być większe niż 5 MB.");
  }

  const avatarPath = `profile-photos/users/${auth.currentUser.uid}/avatar`;
  const avatarRef = ref(storage, avatarPath);
  const metadata: UploadMetadata = { contentType: file.type };

  await uploadBytes(avatarRef, file, metadata);

  return {
    avatarPath,
    avatarUrl: await getDownloadURL(avatarRef),
  };
}

async function readImageSize(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Nie udało się odczytać wymiarów zdjęcia."));
      element.src = objectUrl;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadCommunityEventImages(files: File[]) {
  const { auth, storage } = assertReady();

  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error("Najpierw zaloguj się do panelu.");
  }

  const pendingFiles = files.filter(Boolean);

  if (pendingFiles.length === 0) {
    return [];
  }

  return Promise.all(
    pendingFiles.map(async (file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Zdjęcia wydarzenia muszą być w formacie JPG, PNG albo WEBP.");
      }

      if (file.size > 8 * 1024 * 1024) {
        throw new Error("Każde zdjęcie wydarzenia może mieć maksymalnie 8 MB.");
      }

      const imageId = crypto.randomUUID();
      const extension =
        file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const storagePath = `event-photos/users/${auth.currentUser.uid}/${imageId}.${extension}`;
      const imageRef = ref(storage, storagePath);
      const metadata: UploadMetadata = { contentType: file.type };
      const dimensions = await readImageSize(file);

      await uploadBytes(imageRef, file, metadata);

      return {
        id: imageId,
        url: await getDownloadURL(imageRef),
        storagePath,
        width: dimensions.width,
        height: dimensions.height,
      } satisfies TrainingEventImage;
    }),
  );
}

export async function submitAccountRequest(input: AccountRequestInput) {
  const { auth } = assertReady();

  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error("Najpierw potwierdź numer telefonu kodem SMS.");
  }

  if (!input.trainerAuthorizationCode.trim()) {
    throw new Error("Podaj kod trenera.");
  }

  const avatar = input.avatarFile ? await uploadCurrentUserAvatar(input.avatarFile) : null;

  await callFirebaseFunction<
    {
      displayName: string;
      phone: string;
      trainerAuthorizationCode: string;
      notes: string;
      avatarPath?: string;
      avatarUrl?: string;
    },
    { ok: true; accountCreated?: boolean }
  >("finalizePhoneRegistration", {
    displayName: input.displayName,
    phone: input.phone,
    trainerAuthorizationCode: input.trainerAuthorizationCode.trim(),
    notes: input.notes,
    avatarPath: avatar?.avatarPath,
    avatarUrl: avatar?.avatarUrl,
  });
}

export async function connectOrganizerToTrainerWithCode(trainerAuthorizationCode: string) {
  const { auth } = assertReady();

  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error("Musisz być zalogowany.");
  }

  if (!trainerAuthorizationCode.trim()) {
    throw new Error("Podaj kod trenera.");
  }

  return ensurePhoneParticipantProfile({
    trainerAuthorizationCode: trainerAuthorizationCode.trim(),
  });
}

export async function completeParticipantOnboarding(input: ParticipantOnboardingInput) {
  const { auth } = assertReady();

  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new Error("Najpierw potwierdź numer telefonu kodem SMS.");
  }

  const avatar = input.avatarFile ? await uploadCurrentUserAvatar(input.avatarFile) : null;

  await callFirebaseFunction<
    {
      displayName: string;
      requestedRoles: Array<"participant" | "organizer">;
      notes?: string;
      avatarPath?: string;
      avatarUrl?: string;
      organizerTrainingIntent?: string;
      selectedTrainerIds: string[];
    },
    { ok: true; accountCreated?: boolean }
  >("finalizePhoneRegistration", {
    displayName: input.displayName,
    requestedRoles: input.requestedRoles,
    notes: input.notes?.trim() || "",
    avatarPath: avatar?.avatarPath,
    avatarUrl: avatar?.avatarUrl,
    organizerTrainingIntent: input.organizerTrainingIntent?.trim() || undefined,
    selectedTrainerIds: input.selectedTrainerIds,
  });
}

export async function getCommunityEventReview(token: string) {
  await ensureAnonymousSession();
  return callFirebaseFunction<
    { token: string },
    {
      ok: true;
      event: TrainingEvent;
      creatorName: string;
      creatorPhone: string;
    }
  >("getCommunityEventReview", { token });
}

export async function reviewCommunityEvent(input: {
  token: string;
  decision: "accepted" | "rejected";
  message?: string;
}) {
  await ensureAnonymousSession();
  return callFirebaseFunction<
    {
      token: string;
      decision: "accepted" | "rejected";
      message?: string;
    },
    { ok: true; eventId: string }
  >("reviewCommunityEvent", input);
}

export async function updateTrainerProfile(
  currentUser: AppUser,
  input: TrainerProfileUpdateInput,
) {
  const { db, storage } = assertReady();

  if (
    (currentUser.role !== "trainer" && currentUser.role !== "admin") ||
    !currentUser.trainerProfileId
  ) {
    throw new Error("Tylko Przekazujący Wiedzę może edytować ten profil.");
  }

  const trainerRef = doc(db, collections.trainers, currentUser.trainerProfileId);
  const trainer = await getTrainerProfile(currentUser.trainerProfileId);
  const specialties = Array.from(
    new Set(input.specialties.map((item) => item.trim()).filter(Boolean)),
  );
  const locations = Array.from(
    new Set(input.locations.map((item) => item.trim()).filter(Boolean)),
  );
  const updates: Record<string, unknown> = {
    heroNote: input.heroNote.trim(),
    bio: input.bio.trim(),
    specialties,
    locations,
  };

  if (input.avatarFile) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(input.avatarFile.type)) {
      throw new Error("Zdjęcie musi być w formacie JPG, PNG albo WEBP.");
    }

    if (input.avatarFile.size > 5 * 1024 * 1024) {
      throw new Error("Zdjęcie nie może być większe niż 5 MB.");
    }

    const avatarPath = `profile-photos/trainers/${currentUser.id}/avatar`;
    const avatarRef = ref(storage, avatarPath);
    const metadata: UploadMetadata = { contentType: input.avatarFile.type };

    await uploadBytes(avatarRef, input.avatarFile, metadata);

    updates.avatarPath = avatarPath;
    updates.avatarUrl = await getDownloadURL(avatarRef);
    updates.avatarUploadedAt = nowIso();
  }

  const nextAuthorizationCode = input.authorizationCode?.trim() ?? "";
  if (nextAuthorizationCode) {
    updates.authorizationCodeHash = await hashTrainerAuthorizationCode(nextAuthorizationCode);
    updates.authorizationCodeConfigured = true;
    updates.authorizationCodeUpdatedAt = nowIso();
  } else if (trainer.authorizationCodeConfigured === true) {
    updates.authorizationCodeConfigured = true;
  }

  await updateDoc(trainerRef, updates);
}

export async function updateParticipantProfile(
  currentUser: AppUser,
  input: ParticipantProfileUpdateInput,
) {
  const { db } = assertReady();

  if (currentUser.role !== "participant") {
    throw new Error("Tylko uczestnik może edytować ten profil.");
  }

  const updates: Record<string, unknown> = {
    displayName: input.displayName.trim(),
    referralSource: input.referralSource?.trim() || "",
    notes: input.notes?.trim() || "",
  };

  if (input.avatarFile) {
    const avatar = await uploadCurrentUserAvatar(input.avatarFile);
    updates.avatarPath = avatar.avatarPath;
    updates.avatarUrl = avatar.avatarUrl;
  }

  await updateDoc(doc(db, collections.users, currentUser.id), updates);

  const communityEvents = await getDocs(
    query(
      collection(db, collections.trainingEvents),
      where("creatorUserId", "==", currentUser.id),
      where("brandStatus", "==", "supported"),
    ),
  );

  if (!communityEvents.empty) {
    const batch = writeBatch(db);
    const creatorAvatarUrl =
      typeof updates.avatarUrl === "string"
        ? updates.avatarUrl
        : currentUser.avatarUrl ?? null;

    communityEvents.docs.forEach((eventDoc) => {
      batch.update(eventDoc.ref, {
        creatorDisplayName: updates.displayName,
        creatorAvatarUrl,
      });
    });

    await batch.commit();
  }
}

export async function updateOrganizerProfile(
  currentUser: AppUser,
  input: OrganizerProfileUpdateInput,
) {
  const { db } = assertReady();

  if (currentUser.role !== "organizer" || !currentUser.organizerProfileId) {
    throw new Error("Tylko organizator może edytować ten profil.");
  }

  await updateDoc(doc(db, collections.organizers, currentUser.organizerProfileId), {
    displayName: input.displayName.trim(),
    contactName: input.contactName.trim(),
    location: input.location.trim(),
    description: input.description.trim(),
  });
}

export async function updateTrainerNotificationSettings(
  currentUser: AppUser,
  input: NotificationSettingsUpdateInput,
) {
  const { db } = assertReady();

  if (
    (currentUser.role !== "trainer" && currentUser.role !== "admin") ||
    !currentUser.trainerProfileId
  ) {
    throw new Error("Tylko Przekazujący Wiedzę może zmieniać ustawienia powiadomień.");
  }

  await updateDoc(doc(db, collections.trainers, currentUser.trainerProfileId), {
    notificationSettings: sanitizeNotificationSettingsInput(input),
  });
}

export async function updateOrganizerNotificationSettings(
  currentUser: AppUser,
  input: NotificationSettingsUpdateInput,
) {
  const { db } = assertReady();

  if (currentUser.role !== "organizer" || !currentUser.organizerProfileId) {
    throw new Error("Tylko organizator może zmieniać ustawienia powiadomień.");
  }

  await updateDoc(doc(db, collections.organizers, currentUser.organizerProfileId), {
    notificationSettings: sanitizeNotificationSettingsInput(input),
  });
}

export async function updateTrainerBrandStatus(
  input: TrainerBrandStatusUpdateInput,
  actor: AppUser,
) {
  const { db } = assertReady();

  if (actor.role !== "admin") {
    throw new Error("Tylko admin może zmieniać status Emandar profilu.");
  }

  await updateDoc(doc(db, collections.trainers, input.trainerId), {
    brandStatus: resolveBrandStatus(input.brandStatus),
  });
}

export async function updateTrainingEventBrandStatus(
  input: TrainingEventBrandStatusUpdateInput,
  actor: AppUser,
) {
  const { db } = assertReady();

  if (actor.role !== "admin") {
    throw new Error("Tylko admin może zmieniać status Emandar wydarzenia.");
  }

  await updateDoc(doc(db, collections.trainingEvents, input.eventId), {
    brandStatus: resolveBrandStatus(input.brandStatus),
  });
}

export async function decideTrainingEventCollaboration(
  input: TrainingEventCollaborationUpdateInput,
  actor: AppUser,
) {
  const { db } = assertReady();
  const event = await getEvent(input.eventId);

  if (!canDecideTrainingEventCollaboration(event, actor)) {
    throw new Error("Możesz odpowiadać tylko na swoje zaproszenia do szkolenia.");
  }

  const updates: Partial<TrainingEvent> = {};

  if (actor.role === "trainer" && actor.trainerProfileId === event.trainerId) {
    updates.trainerCollaborationStatus = input.status;
  }

  if (actor.role === "organizer" && actor.organizerProfileId === event.organizerId) {
    updates.organizerCollaborationStatus = input.status;
  }

  if (actor.role === "admin") {
    updates.trainerCollaborationStatus =
      normalizeEventCollaborationStatus(
        event.trainerCollaborationStatus,
        resolveTrainerCollaborationStatus(event),
      ) === "pending"
        ? input.status
        : resolveTrainerCollaborationStatus(event);
    updates.organizerCollaborationStatus =
      normalizeEventCollaborationStatus(
        event.organizerCollaborationStatus,
        resolveOrganizerCollaborationStatus(event),
      ) === "pending"
        ? input.status
        : resolveOrganizerCollaborationStatus(event);
  }

  await updateDoc(doc(db, collections.trainingEvents, input.eventId), updates);

  const trainer = await getTrainerProfile(event.trainerId);
  const organizer = event.organizerId ? await getOrganizerProfile(event.organizerId) : null;
  const nextTrainerStatus =
    updates.trainerCollaborationStatus ?? resolveTrainerCollaborationStatus(event);
  const nextOrganizerStatus =
    updates.organizerCollaborationStatus ?? resolveOrganizerCollaborationStatus(event);

  await notifyUsers(
    [trainer.userId, organizer?.userId],
    "Zmieniono status współpracy przy szkoleniu",
    `${event.title}: trener ${nextTrainerStatus}, organizator ${nextOrganizerStatus}.`,
    "event",
  );
}

export async function confirmEnrollmentAttendance(
  token: string,
  decision: "confirm" | "decline",
) {
  await ensureAnonymousSession();
  await callFirebaseFunction<
    {
      token: string;
      decision: "confirm" | "decline";
    },
    { ok: true; requestId: string; status: "confirmed" | "declined" }
  >("confirmEnrollmentAttendance", {
    token: token.trim(),
    decision,
  });
}

export async function updateTrainingEventManagement(
  input: TrainingEventManagementUpdateInput,
  actor: AppUser,
) {
  void actor;
  await callFirebaseFunction<
    {
      eventId: string;
      status: TrainingEventStatus;
      capacity: number;
      minimumParticipants: number;
      title?: string;
      location?: string;
      tags?: string[];
      eventImages?: TrainingEventImage[];
      useEventImageAsCover?: boolean;
      scheduleDays?: TrainingEventScheduleDay[];
      transferTargetEventId?: string;
      enrollmentPhotoRequirement?: "default" | "required" | "optional";
      publicationDecision?: "accepted" | "rejected";
      publicationReviewMessage?: string;
    },
    { ok: true }
  >("updateTrainingEventManagement", {
    eventId: input.eventId,
    status: input.status,
    capacity: input.capacity,
    minimumParticipants: input.minimumParticipants,
    title: input.title?.trim() || undefined,
    location: input.location?.trim() || undefined,
    tags: input.tags,
    eventImages: normalizeEventImages(input.eventImages),
    useEventImageAsCover: input.useEventImageAsCover === true,
    scheduleDays: input.scheduleDays,
    transferTargetEventId: input.transferTargetEventId?.trim() || undefined,
    enrollmentPhotoRequirement: input.enrollmentPhotoRequirement,
    publicationDecision: input.publicationDecision,
    publicationReviewMessage: input.publicationReviewMessage?.trim() || undefined,
  });
  return;

  const { db } = assertReady();
  const event = await getEvent(input.eventId);

  const canManage = canManageTrainingEvent(event, actor);

  if (!canManage) {
    throw new Error("Mozesz zarzadzac tylko swoimi wydarzeniami.");
  }

  if (isTrainingEventArchived(event)) {
    throw new Error("To szkolenie jest juz zarchiwizowane.");
  }

  const normalizedCapacity = Math.max(1, input.capacity);
  const normalizedMinimumParticipants = Math.max(
    1,
    Math.min(normalizedCapacity, input.minimumParticipants),
  );
  const normalizedTags = normalizeEventTags(input.tags);
  const normalizedScheduleDays = normalizeScheduleDays(
    input.scheduleDays ?? getTrainingEventScheduleDays(event),
  );
  const firstScheduleDay = normalizedScheduleDays[0];
  const lastScheduleDay = normalizedScheduleDays[normalizedScheduleDays.length - 1];
  const targetEventId = input.transferTargetEventId?.trim();

  if (!targetEventId) {
    await updateDoc(doc(db, collections.trainingEvents, input.eventId), {
      tags: normalizedTags,
      startsAt: firstScheduleDay?.startsAt ?? event.startsAt,
      endsAt: lastScheduleDay?.endsAt ?? event.endsAt,
      scheduleDays: normalizedScheduleDays,
    });
    await syncEventEnrollmentState(input.eventId, {
      capacity: normalizedCapacity,
      status: resolveEventStatus(input.status),
      minimumParticipants: normalizedMinimumParticipants,
    });
    return;
  }

  if (targetEventId === event.id) {
    throw new Error("Wybierz inne wydarzenie do przeniesienia zgłoszeń.");
  }

  const targetEvent = await getEvent(targetEventId);
  const canManageTarget = canManageTrainingEvent(targetEvent, actor);

  if (!canManageTarget) {
    throw new Error("Możesz przenosić zgłoszenia tylko do swoich wydarzeń.");
  }

  const [sourceRequests, targetTrainer] = await Promise.all([
    getEnrollmentRequestsForEvent(event.id),
    getTrainerProfile(targetEvent.trainerId),
  ]);
  const targetOrganizer = targetEvent.organizerId
    ? await getOrganizerProfile(targetEvent.organizerId)
    : null;
  const targetRequiresOrganizerApproval =
    targetEvent.requiresOrganizerApproval ?? !isSelfManagedTrainingEvent(targetEvent);
  const transferableRequests = sourceRequests.filter(
    (request) => request.finalStatus !== "rejected",
  );

  const batch = writeBatch(db);

  transferableRequests.forEach((request) => {
    const nextTrainerDecision =
      request.trainerId === targetEvent.trainerId
        ? request.trainerDecision
        : "pending";
    const nextOrganizerDecision = targetRequiresOrganizerApproval
      ? request.organizerId === targetEvent.organizerId
        ? request.organizerDecision
        : "pending"
      : "pending";

    batch.update(doc(db, collections.enrollmentRequests, request.id), {
      eventId: targetEvent.id,
      trainerId: targetEvent.trainerId,
      organizerId: targetEvent.organizerId ?? null,
      trainerUserId: targetTrainer.userId,
      organizerUserId: targetOrganizer?.userId ?? null,
      trainerDecision: nextTrainerDecision,
      organizerDecision: nextOrganizerDecision,
      finalStatus: deriveEnrollmentFinalStatus(
        nextTrainerDecision,
        nextOrganizerDecision,
        targetRequiresOrganizerApproval,
      ),
      requiresOrganizerApproval: targetRequiresOrganizerApproval,
    });
  });

  await batch.commit();

  await Promise.all([
    updateDoc(doc(db, collections.trainingEvents, input.eventId), {
      tags: normalizedTags,
      startsAt: firstScheduleDay?.startsAt ?? event.startsAt,
      endsAt: lastScheduleDay?.endsAt ?? event.endsAt,
      scheduleDays: normalizedScheduleDays,
    }),
    syncEventEnrollmentState(event.id, {
      capacity: normalizedCapacity,
      status: resolveEventStatus(input.status),
      minimumParticipants: normalizedMinimumParticipants,
    }),
    syncEventEnrollmentState(targetEvent.id),
  ]);

  if (transferableRequests.length > 0) {
    await notifyUsers(
      [targetTrainer.userId, targetOrganizer?.userId],
      "Przeniesiono zgłoszenia do szkolenia",
      `${transferableRequests.length} zgłoszeń przeniesiono do ${targetEvent.title}.`,
      "request",
    );
  }
}

export async function archiveTrainingEvent(eventId: string, actor: AppUser) {
  void actor;
  await callFirebaseFunction<{ eventId: string }, { ok: true }>("archiveTrainingEvent", {
    eventId,
  });
  return;

  const event = await getEvent(eventId);

  if (!canManageTrainingEvent(event, actor)) {
    throw new Error("Mozesz archiwizowac tylko swoje wydarzenia.");
  }

  if (isTrainingEventArchived(event)) {
    throw new Error("To szkolenie jest juz zarchiwizowane.");
  }

  await archiveEventDocument(event, actor, "manual");
}

export async function decideAccountRequest(
  requestId: string,
  actor: AppUser,
  status: "approved" | "rejected",
) {
  void actor;
  await callFirebaseFunction<{ requestId: string }, { ok: true }>(
    status === "approved" ? "approveAccountRequest" : "rejectAccountRequest",
    { requestId },
  );
  return;

  const { db } = assertReady();

  if (actor.role !== "admin") {
    throw new Error("Tylko admin może obsługiwać rejestracje.");
  }

  const requestRef = doc(db, collections.accountRequests, requestId);
  const requestSnapshot = await getDoc(requestRef);

  if (!requestSnapshot.exists()) {
    throw new Error("Nie znaleziono wniosku o konto.");
  }

  const request = {
    id: requestSnapshot.id,
    ...(normalizeValue(requestSnapshot.data()) as Omit<AccountRequest, "id">),
  } as AccountRequest;

  if (request.status !== "pending") {
    throw new Error("Ten wniosek został już wcześniej obsłużony.");
  }

  if (status === "rejected") {
    await updateDoc(requestRef, {
      status,
      reviewedAt: nowIso(),
      reviewedByUserId: actor.id,
    });
    return;
  }

  const requestedRoles = normalizeRequestedRoles(request.requestedRoles);

  if (requestedRoles.length === 0) {
    throw new Error("Wniosek nie zawiera żadnego poprawnego zakresu.");
  }

  const temporaryPassword = `${createId("emandar")}${createId("tmp")}`;
  const userId = await createPasswordAuthUser(request.email, temporaryPassword);
  const trainerProfileId = requestedRoles.includes("trainer") ? createId("trainer") : null;
  const organizerProfileId = requestedRoles.includes("organizer")
    ? createId("organizer")
    : null;
  const primaryRole = requestedRoles.includes("organizer") ? "organizer" : "trainer";

  await setDoc(doc(db, collections.users, userId), {
    displayName: request.displayName,
    email: request.email,
    phone: request.phone,
    avatarUrl: "",
    status: "active",
    role: primaryRole,
    roles: requestedRoles,
    primaryRole,
    trainerProfileId,
    organizerProfileId,
    createdAt: nowIso(),
  });

  if (trainerProfileId) {
    await setDoc(doc(db, collections.trainers, trainerProfileId), {
      userId,
      slug: slugifyDisplayName(request.displayName),
      displayName: request.displayName,
      sortOrder: 999,
      bio: request.notes?.trim() || "Nowy profil oczekuje na uzupelnienie opisu.",
      specialties: [],
      locations: [],
      isVisible: false,
      heroNote: "Profil w trakcie konfiguracji.",
      avatarUrl: "",
      brandStatus: "supported",
    });
  }

  if (organizerProfileId) {
    await setDoc(doc(db, collections.organizers, organizerProfileId), {
      userId,
      displayName: request.displayName,
      description:
        request.notes?.trim() || "Nowy organizator oczekuje na uzupelnienie profilu.",
      isVisible: false,
      contactName: request.displayName.split(/\s+/)[0] ?? request.displayName,
      location: "",
    });
  }

  await updateDoc(requestRef, {
    status,
    reviewedAt: nowIso(),
    reviewedByUserId: actor.id,
    createdUserId: userId,
    trainerProfileId,
    organizerProfileId,
  });

  await sendPasswordReset(request.email);
}

export async function resolveEnrollmentPhoto(path: string) {
  const { storage } = assertReady();
  const blob = await getBlob(ref(storage, path));
  return URL.createObjectURL(blob);
}

export async function decideTrainerAccountApproval(
  approvalId: string,
  status: "accepted" | "rejected",
) {
  await callFirebaseFunction<
    { approvalId: string; status: "accepted" | "rejected" },
    { ok: true }
  >("decideTrainerAccountApproval", {
    approvalId,
    status,
  });
}

export async function updateAppSettings(input: AppSettings) {
  const { db } = assertReady();

  await setDoc(
    doc(db, collections.appMeta, "publicSettings"),
    {
      signupPhotoMode: resolvePhotoMode(input.signupPhotoMode, "optional"),
      enrollmentPhotoMode: resolvePhotoMode(input.enrollmentPhotoMode, "optional"),
    },
    { merge: true },
  );
}
