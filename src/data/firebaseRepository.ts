import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
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
import {
  firebaseAuth,
  firebaseDb,
  firebaseStorage,
} from "@/lib/firebase";
import type {
  AccountRequest,
  AccountRequestInput,
  AppUser,
  AvailabilityInput,
  AvailabilitySlot,
  DemoStore,
  EnrollmentFormInput,
  EnrollmentRequest,
  GroupInput,
  GroupRecord,
  NotificationRecord,
  OrganizerProfile,
  OrganizerProfileUpdateInput,
  TrainerOrganizerRelation,
  TrainerProfile,
  TrainerProfileUpdateInput,
  TrainingEventInput,
  TrainingEvent,
} from "@/domain/types";
import {
  canOrganizerAccessTrainer,
  deriveEnrollmentFinalStatus,
} from "@/domain/utils";

type StorePatch = Partial<DemoStore>;

const collections = {
  users: "users",
  trainers: "trainers",
  organizers: "organizers",
  trainingEvents: "trainingEvents",
  enrollmentRequests: "enrollmentRequests",
  relations: "trainerOrganizerRelations",
  groups: "groups",
  availabilitySlots: "availabilitySlots",
  notifications: "notifications",
  accountRequests: "accountRequests",
} as const;

export function createEmptyStore(): DemoStore {
  return {
    users: [],
    trainers: [],
    organizers: [],
    relations: [],
    groups: [],
    trainingEvents: [],
    availabilitySlots: [],
    enrollmentRequests: [],
    notifications: [],
    accountRequests: [],
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

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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

async function mapQuery<T extends { id: string }>(source: Query) {
  const snapshot = await getDocs(source);
  return mapDocs<T>(snapshot.docs);
}

export function subscribePublicStore(onPatch: (patch: StorePatch) => void): Unsubscribe {
  const { db } = assertReady();

  const unsubs = [
    subscribeArray<TrainerProfile>(
      query(collection(db, collections.trainers), where("isVisible", "==", true)),
      (trainers) => {
        onPatch({ trainers });
      },
    ),
    subscribeArray<OrganizerProfile>(
      query(collection(db, collections.organizers), where("isVisible", "==", true)),
      (organizers) => {
        onPatch({ organizers });
      },
    ),
    subscribeArray<TrainingEvent>(
      query(
        collection(db, collections.trainingEvents),
        where("isPublished", "==", true),
      ),
      (trainingEvents) => {
        onPatch({ trainingEvents });
      },
    ),
  ];

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

    onUser({
      id: snapshot.id,
      ...(normalizeValue(snapshot.data()) as Omit<AppUser, "id">),
    } as AppUser);
  });
}

export async function fetchAppUser(userId: string) {
  const { db } = assertReady();
  const snapshot = await getDoc(doc(db, collections.users, userId));

  if (!snapshot.exists()) {
    throw new Error("To konto nie ma jeszcze profilu aplikacyjnego.");
  }

  return {
    id: snapshot.id,
    ...(normalizeValue(snapshot.data()) as Omit<AppUser, "id">),
  } as AppUser;
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

  if (currentUser.role === "admin") {
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
      subscribeArray<GroupRecord>(collection(db, collections.groups), (groups) => {
        onPatch({ groups: pushSorted(groups) });
      }),
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

  const profileId = currentUser.profileId;

  const eventsQuery = buildRoleQuery(
    collections.trainingEvents,
    currentUser.role === "trainer" ? "trainerUserId" : "organizerUserId",
    currentUser.id,
  );
  if (eventsQuery) {
    unsubs.push(
      subscribeArray<TrainingEvent>(eventsQuery, (trainingEvents) => {
        onPatch({ trainingEvents });
      }),
    );
  } else {
    onPatch({ trainingEvents: [] });
  }

  const relationsQuery = buildRoleQuery(
    collections.relations,
    currentUser.role === "trainer" ? "trainerUserId" : "organizerUserId",
    currentUser.id,
  );
  if (relationsQuery) {
    unsubs.push(
      subscribeArray<TrainerOrganizerRelation>(relationsQuery, (relations) => {
        onPatch({ relations: pushSorted(relations) });
      }),
    );
  } else {
    onPatch({ relations: [] });
  }

  const groupsQuery = buildRoleQuery(
    collections.groups,
    currentUser.role === "trainer" ? "trainerUserId" : "organizerUserId",
    currentUser.id,
  );
  if (groupsQuery) {
    unsubs.push(
      subscribeArray<GroupRecord>(groupsQuery, (groups) => {
        onPatch({ groups: pushSorted(groups) });
      }),
    );
  } else {
    onPatch({ groups: [] });
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
  }

  if (currentUser.role === "organizer") {
    if (profileId) {
      unsubs.push(
        subscribeArray<AvailabilitySlot>(
          query(
            collection(db, collections.availabilitySlots),
            where("visibleToOrganizerIds", "array-contains", profileId),
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

async function notifyUser(
  userId: string,
  title: string,
  body: string,
  entityType: NotificationRecord["entityType"],
) {
  const { db } = assertReady();

  await addDoc(collection(db, collections.notifications), {
    id: createId("notification"),
    userId,
    title,
    body,
    entityType,
    createdAt: nowIso(),
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

export async function submitEnrollment(input: EnrollmentFormInput) {
  const { db, storage } = assertReady();
  const anonymousUser = await ensureAnonymousSession();

  const event = await getEvent(input.eventId);
  if (!event.isPublished) {
    throw new Error("To szkolenie nie przyjmuje teraz zgłoszeń.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(input.photoFile.type)) {
    throw new Error("Zdjęcie musi być w formacie JPG, PNG albo WEBP.");
  }

  const trainer = await getTrainerProfile(event.trainerId);
  const organizer = await getOrganizerProfile(event.organizerId);
  const requestRef = doc(collection(db, collections.enrollmentRequests));
  const photoPath = `enrollment-photos/${requestRef.id}/original`;

  await setDoc(requestRef, {
    eventId: event.id,
    trainerId: event.trainerId,
    organizerId: event.organizerId,
    submitterUid: anonymousUser.uid,
    trainerUserId: trainer.userId,
    organizerUserId: organizer.userId,
    imieNazwisko: input.imieNazwisko,
    telefon: input.telefon,
    polecenieOdKogo: input.polecenieOdKogo,
    wiadomosc: input.wiadomosc,
    photoStatus: "pending",
    trainerDecision: "pending",
    organizerDecision: "pending",
    finalStatus: "pending",
    createdAt: nowIso(),
  });

  try {
    const metadata: UploadMetadata = { contentType: input.photoFile.type };
    await uploadBytes(ref(storage, photoPath), input.photoFile, metadata);
    await updateDoc(requestRef, {
      photoStatus: "ready",
      photoPath,
      photoContentType: input.photoFile.type,
      photoUploadedAt: nowIso(),
    });
  } catch (error) {
    await updateDoc(requestRef, {
      photoStatus: "error",
    });

    throw error instanceof Error
      ? error
      : new Error("Nie udało się wgrać zdjęcia.");
  }

  await Promise.all([
    notifyUser(
      trainer.userId,
      "Nowe zgłoszenie uczestnika",
      `${input.imieNazwisko} chce dołączyć do szkolenia ${event.title}.`,
      "request",
    ),
    notifyUser(
      organizer.userId,
      "Nowe zgłoszenie do grupy",
      `${input.imieNazwisko} wysłał formularz do wydarzenia ${event.title}.`,
      "request",
    ),
  ]);
}

export async function decideEnrollment(
  requestId: string,
  actor: AppUser,
  decision: "accepted" | "rejected",
) {
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
  const organizer = await getOrganizerProfile(request.organizerId);

  const updates: Record<string, unknown> = {};
  if (actor.role === "trainer" && actor.profileId === trainer.id) {
    updates.trainerDecision = decision;
  } else if (actor.role === "organizer" && actor.profileId === organizer.id) {
    updates.organizerDecision = decision;
  } else if (actor.role !== "admin") {
    throw new Error("Brak dostępu do tej decyzji.");
  }

  const finalStatus = deriveEnrollmentFinalStatus(
    (updates.trainerDecision as EnrollmentRequest["trainerDecision"]) ??
      request.trainerDecision,
    (updates.organizerDecision as EnrollmentRequest["organizerDecision"]) ??
      request.organizerDecision,
  );

  await updateDoc(requestRef, {
    ...updates,
    finalStatus,
  });

  await Promise.all([
    notifyUser(
      trainer.userId,
      "Zmieniono status zgłoszenia",
      `${request.imieNazwisko}: ${finalStatus}.`,
      "request",
    ),
    notifyUser(
      organizer.userId,
      "Zmieniono status zgłoszenia",
      `${request.imieNazwisko}: ${finalStatus}.`,
      "request",
    ),
  ]);
}

export async function requestRelation(currentUser: AppUser, trainerId: string) {
  const { db } = assertReady();

  if (currentUser.role !== "organizer" || !currentUser.profileId) {
    throw new Error("Tylko organizator może prosić o relację.");
  }

  const existing = await getDocs(
    query(
      collection(db, collections.relations),
      where("organizerUserId", "==", currentUser.id),
      where("trainerId", "==", trainerId),
    ),
  );
  if (!existing.empty) {
    throw new Error("Ta relacja już istnieje.");
  }

  const trainer = await getTrainerProfile(trainerId);
  const organizer = await getOrganizerProfile(currentUser.profileId);

  await addDoc(collection(db, collections.relations), {
    trainerId,
    organizerId: currentUser.profileId,
    trainerUserId: trainer.userId,
    organizerUserId: organizer.userId,
    status: "pending",
    requestedBy: "organizer",
    createdAt: nowIso(),
  });

  await notifyUser(
    trainer.userId,
    "Nowa prośba o współpracę",
    `${organizer.displayName} chce uzyskać dostęp do Twoich terminów.`,
    "relation",
  );
}

export async function decideRelation(
  relationId: string,
  actor: AppUser,
  status: "approved" | "rejected",
) {
  const { db } = assertReady();
  const relationRef = doc(db, collections.relations, relationId);
  const relationSnapshot = await getDoc(relationRef);

  if (!relationSnapshot.exists()) {
    throw new Error("Nie znaleziono relacji.");
  }

  const relation = {
    id: relationSnapshot.id,
    ...(normalizeValue(relationSnapshot.data()) as Omit<TrainerOrganizerRelation, "id">),
  } as TrainerOrganizerRelation;

  const canDecide =
    actor.role === "admin" ||
    (actor.role === "trainer" &&
      actor.profileId === relation.trainerId &&
      relation.requestedBy === "organizer") ||
    (actor.role === "organizer" &&
      actor.profileId === relation.organizerId &&
      relation.requestedBy === "trainer");

  if (!canDecide) {
    throw new Error("Możesz zarządzać tylko swoimi relacjami.");
  }

  await updateDoc(relationRef, { status });

  const slotSnapshots = await getDocs(
    query(
      collection(db, collections.availabilitySlots),
      where("trainerId", "==", relation.trainerId),
    ),
  );

  await Promise.all(
    slotSnapshots.docs.map((slotSnapshot) =>
      updateDoc(slotSnapshot.ref, {
        visibleToOrganizerIds:
          status === "approved"
            ? arrayUnion(relation.organizerId)
            : arrayRemove(relation.organizerId),
      }),
    ),
  );

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

export async function createGroup(input: GroupInput, actor: AppUser) {
  const { db } = assertReady();

  if (actor.role !== "admin" && actor.role !== "organizer") {
    throw new Error("Nie możesz tworzyć grup.");
  }

  if (
    actor.role === "organizer" &&
    (!actor.profileId ||
      !canOrganizerAccessTrainer(
        actor.profileId,
        input.trainerId,
        await mapQuery<TrainerOrganizerRelation>(
          query(
            collection(db, collections.relations),
            where("organizerId", "==", actor.profileId),
          ),
        ),
      ))
  ) {
    throw new Error("Brak zatwierdzonej relacji z Przekazującym Wiedzę.");
  }

  const trainer = await getTrainerProfile(input.trainerId);
  const organizerId =
    actor.role === "organizer" && actor.profileId ? actor.profileId : input.organizerId;
  const organizer = await getOrganizerProfile(organizerId);

  await addDoc(collection(db, collections.groups), {
    ...input,
    organizerId,
    organizerUserId: organizer.userId,
    trainerUserId: trainer.userId,
    createdAt: nowIso(),
  });

  await notifyUser(
    trainer.userId,
    "Dodano nową grupę",
    `Przypisano Cię do grupy ${input.name}.`,
    "group",
  );
}

export async function addAvailabilitySlot(input: AvailabilityInput, actor: AppUser) {
  const { db } = assertReady();
  const trainerId =
    actor.role === "trainer" && actor.profileId ? actor.profileId : input.trainerId;
  const trainer = await getTrainerProfile(trainerId);

  if (actor.role === "trainer" && actor.profileId !== trainer.id) {
    throw new Error("Możesz dodawać terminy tylko sobie.");
  }

  const approvedRelations = await mapQuery<TrainerOrganizerRelation>(
    query(
      collection(db, collections.relations),
      where("trainerId", "==", trainer.id),
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

export async function createTrainingEvent(input: TrainingEventInput, actor: AppUser) {
  const { db } = assertReady();

  if (actor.role !== "trainer" || !actor.profileId) {
    throw new Error("Tylko Przekazujący Wiedzę może tworzyć szkolenia.");
  }

  const trainer = await getTrainerProfile(actor.profileId);
  const organizer = await getOrganizerProfile(input.organizerId);

  const approvedRelations = await mapQuery<TrainerOrganizerRelation>(
    query(
      collection(db, collections.relations),
      where("trainerId", "==", trainer.id),
      where("organizerId", "==", organizer.id),
      where("status", "==", "approved"),
    ),
  );

  if (approvedRelations.length === 0) {
    throw new Error("Najpierw potrzebujesz zatwierdzonej relacji z organizatorem.");
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const dayTwoStartsAt = new Date(input.dayTwoStartsAt);
  const dayTwoEndsAt = new Date(input.dayTwoEndsAt);

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    Number.isNaN(dayTwoStartsAt.getTime()) ||
    Number.isNaN(dayTwoEndsAt.getTime())
  ) {
    throw new Error("Podaj poprawne daty szkolenia.");
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("Data zakończenia musi być późniejsza niż start.");
  }

  if (dayTwoEndsAt.getTime() <= dayTwoStartsAt.getTime()) {
    throw new Error("Drugi dzień szkolenia musi kończyć się po starcie.");
  }

  if (dayTwoStartsAt.getTime() <= startsAt.getTime()) {
    throw new Error("Drugi dzień szkolenia musi zaczynać się po pierwszym dniu.");
  }

  const trimmedLocation = input.location.trim();

  await addDoc(collection(db, collections.trainingEvents), {
    trainerId: trainer.id,
    organizerId: organizer.id,
    trainerUserId: trainer.userId,
    organizerUserId: organizer.userId,
    title: trimmedLocation,
    summary: input.summary.trim(),
    description: input.description.trim(),
    type: input.type.trim(),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    dayTwoStartsAt: dayTwoStartsAt.toISOString(),
    dayTwoEndsAt: dayTwoEndsAt.toISOString(),
    location: trimmedLocation,
    capacity: input.capacity,
    enrolledCount: 0,
    isPublished: input.isPublished,
    imageHint: trimmedLocation.split(/\s+/)[0]?.toLowerCase() || "event",
  });

  await notifyUser(
    organizer.userId,
    "Nowe szkolenie od Przekazującego Wiedzę",
    `${trainer.displayName} dodał szkolenie ${trimmedLocation}.`,
    "event",
  );
}

export async function submitAccountRequest(input: AccountRequestInput) {
  const { db } = assertReady();
  await ensureAnonymousSession();

  await addDoc(collection(db, collections.accountRequests), {
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    requestedRole: input.requestedRole,
    notes: input.notes,
    status: "pending",
    createdAt: nowIso(),
  });
}

export async function updateTrainerProfile(
  currentUser: AppUser,
  input: TrainerProfileUpdateInput,
) {
  const { db, storage } = assertReady();

  if (currentUser.role !== "trainer" || !currentUser.profileId) {
    throw new Error("Tylko Przekazujący Wiedzę może edytować ten profil.");
  }

  const trainerRef = doc(db, collections.trainers, currentUser.profileId);
  const trainer = await getTrainerProfile(currentUser.profileId);
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

  await updateDoc(trainerRef, updates);
}

export async function updateOrganizerProfile(
  currentUser: AppUser,
  input: OrganizerProfileUpdateInput,
) {
  const { db } = assertReady();

  if (currentUser.role !== "organizer" || !currentUser.profileId) {
    throw new Error("Tylko organizator może edytować ten profil.");
  }

  await updateDoc(doc(db, collections.organizers, currentUser.profileId), {
    displayName: input.displayName.trim(),
    contactName: input.contactName.trim(),
    location: input.location.trim(),
    description: input.description.trim(),
  });
}

export async function decideAccountRequest(
  requestId: string,
  actor: AppUser,
  status: "approved" | "rejected",
) {
  const { db } = assertReady();

  if (actor.role !== "admin") {
    throw new Error("Tylko admin może obsługiwać rejestracje.");
  }

  await updateDoc(doc(db, collections.accountRequests, requestId), { status });
}

export async function resolveEnrollmentPhoto(path: string) {
  const { storage } = assertReady();
  const blob = await getBlob(ref(storage, path));
  return URL.createObjectURL(blob);
}
