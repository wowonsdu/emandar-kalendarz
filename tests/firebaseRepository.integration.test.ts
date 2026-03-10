import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, getApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import {
  deleteApp as deleteClientApp,
  getApps as getClientApps,
  initializeApp as initializeClientApp,
} from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import type { AppRole, AppUser } from "@/domain/types";

type RepositoryModule = typeof import("@/data/firebaseRepository");
type FirebaseLibModule = typeof import("@/lib/firebase");
const PROJECT_ID = "emandar-c1e15";
const adminApp =
  getApps()[0] ??
  initializeAdminApp({
    projectId: PROJECT_ID,
  });
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);

const ids = {
  trainerUid: "trainer-int-uid",
  organizerUid: "organizer-int-uid",
  trainerId: "trainer-int-1",
  organizerId: "organizer-int-1",
  relationId: "trainer-int-1__organizer-int-1",
  sharedEventId: "event-shared-int-1",
  archivedEventId: "event-archived-int-1",
};

let repository: RepositoryModule;
let firebaseLib: FirebaseLibModule;
let testClientAuth: Auth | null = null;
let testClientDb: Firestore | null = null;
let testClientFunctions: Functions | null = null;
let testClientStorage: FirebaseStorage | null = null;

function buildTestActor(
  user: Pick<AppUser, "id" | "displayName" | "email" | "phone">,
  role: AppRole,
  ownedProfileId: string,
): AppUser {
  return {
    ...user,
    role,
    roles: [role],
    primaryRole: role,
    status: "active",
    trainerProfileId: role === "trainer" ? ownedProfileId : undefined,
    organizerProfileId: role === "organizer" ? ownedProfileId : undefined,
  };
}

async function clearCollection(collectionName: string) {
  const docs = await adminDb.collection(collectionName).listDocuments();

  for (const entry of docs) {
    await entry.delete();
  }
}

async function clearAuthUsers() {
  let nextPageToken: string | undefined;

  do {
    const page = await adminAuth.listUsers(1000, nextPageToken);
    nextPageToken = page.pageToken;

    for (const user of page.users) {
      await adminAuth.deleteUser(user.uid);
    }
  } while (nextPageToken);
}

async function seedAuthUsers() {
  const users = [
    {
      uid: ids.trainerUid,
      email: "trainer.integration@emandar.pl",
      password: "kocham123",
      displayName: "Klaudia Integration",
    },
    {
      uid: ids.organizerUid,
      email: "organizer.integration@emandar.pl",
      password: "kocham123",
      displayName: "Marek Integration",
    },
  ];

  for (const user of users) {
    await adminAuth.createUser(user);
  }
}

async function seedFirestoreState() {
  const now = "2026-03-10T10:00:00.000Z";

  await adminDb.collection("users").doc(ids.trainerUid).set({
    role: "trainer",
    roles: ["trainer"],
    primaryRole: "trainer",
    trainerProfileId: ids.trainerId,
    status: "active",
    displayName: "Klaudia Integration",
    email: "trainer.integration@emandar.pl",
    phone: "+48 600 100 101",
  });
  await adminDb.collection("users").doc(ids.organizerUid).set({
    role: "organizer",
    roles: ["organizer"],
    primaryRole: "organizer",
    organizerProfileId: ids.organizerId,
    status: "active",
    displayName: "Marek Integration",
    email: "organizer.integration@emandar.pl",
    phone: "+48 600 100 102",
  });
  await adminDb.collection("trainers").doc(ids.trainerId).set({
    userId: ids.trainerUid,
    slug: "klaudia-integration",
    displayName: "Klaudia Integration",
    bio: "Bio",
    specialties: ["oddech"],
    locations: ["Warszawa"],
    isVisible: true,
    heroNote: "Hero",
    brandStatus: "official",
  });
  await adminDb.collection("organizers").doc(ids.organizerId).set({
    userId: ids.organizerUid,
    displayName: "Marek Integration",
    description: "Opis",
    isVisible: true,
    contactName: "Marek",
    location: "Krakow",
  });
  await adminDb.collection("trainerOrganizerRelations").doc(ids.relationId).set({
    trainerId: ids.trainerId,
    organizerId: ids.organizerId,
    trainerUserId: ids.trainerUid,
    organizerUserId: ids.organizerUid,
    status: "approved",
    requestedBy: "organizer",
    createdAt: now,
  });
  await adminDb.collection("trainingEvents").doc(ids.sharedEventId).set({
    trainerId: ids.trainerId,
    organizerId: ids.organizerId,
    trainerUserId: ids.trainerUid,
    organizerUserId: ids.organizerUid,
    title: "Szkolenie wspolne",
    summary: "Demo",
    description: "Demo",
    type: "Warsztat",
    startsAt: "2026-04-10T09:00:00.000Z",
    endsAt: "2026-04-11T16:00:00.000Z",
    scheduleDays: [
      {
        startsAt: "2026-04-10T09:00:00.000Z",
        endsAt: "2026-04-10T16:00:00.000Z",
      },
      {
        startsAt: "2026-04-11T09:00:00.000Z",
        endsAt: "2026-04-11T16:00:00.000Z",
      },
    ],
    location: "Warszawa",
    tags: ["oddech"],
    capacity: 20,
    enrolledCount: 4,
    isPublished: true,
    imageHint: "calm",
    brandStatus: "official",
    status: "active",
    minimumParticipants: 8,
    requiresOrganizerApproval: true,
    trainerCollaborationStatus: "accepted",
    organizerCollaborationStatus: "accepted",
    selfManagedByTrainer: false,
    createdByRole: "organizer",
  });
  await adminDb.collection("trainingEvents").doc(ids.archivedEventId).set({
    trainerId: ids.trainerId,
    organizerId: ids.organizerId,
    trainerUserId: ids.trainerUid,
    organizerUserId: ids.organizerUid,
    title: "Szkolenie do archiwum",
    summary: "Demo",
    description: "Demo",
    type: "Warsztat",
    startsAt: "2026-05-10T09:00:00.000Z",
    endsAt: "2026-05-11T16:00:00.000Z",
    scheduleDays: [
      {
        startsAt: "2026-05-10T09:00:00.000Z",
        endsAt: "2026-05-10T16:00:00.000Z",
      },
      {
        startsAt: "2026-05-11T09:00:00.000Z",
        endsAt: "2026-05-11T16:00:00.000Z",
      },
    ],
    location: "Krakow",
    tags: ["oddech"],
    capacity: 18,
    enrolledCount: 3,
    isPublished: true,
    imageHint: "calm",
    brandStatus: "official",
    status: "active",
    minimumParticipants: 8,
    requiresOrganizerApproval: true,
    trainerCollaborationStatus: "accepted",
    organizerCollaborationStatus: "accepted",
    selfManagedByTrainer: false,
    createdByRole: "organizer",
  });
}

async function resetEmulatorState() {
  await clearAuthUsers();

  for (const collectionName of [
    "users",
    "trainers",
    "organizers",
    "trainerOrganizerRelations",
    "trainingEvents",
    "availabilitySlots",
    "enrollmentRequests",
    "notifications",
    "accountRequests",
  ]) {
    await clearCollection(collectionName);
  }

  await seedAuthUsers();
  await seedFirestoreState();
  await new Promise((resolve) => setTimeout(resolve, 600));
}

async function waitForClientDoc(collectionName: string, id: string) {
  if (!testClientDb) {
    throw new Error("Client Firestore is not initialized.");
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const snapshot = await getDoc(doc(testClientDb, collectionName, id));

    if (snapshot.exists()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Seeded document ${collectionName}/${id} is not visible to client tests.`);
}

function mockFirebaseModule() {
  vi.doMock("@/lib/firebase", async () => {
    const app = initializeClientApp({
      apiKey: "demo-api-key",
      authDomain: "emandar-c1e15.firebaseapp.com",
      projectId: PROJECT_ID,
      storageBucket: "emandar-c1e15.firebasestorage.app",
      messagingSenderId: "816516819122",
      appId: "1:816516819122:web:74d6303d435df4cfab01ab",
      measurementId: "G-G663SW8FM8",
    });
    const auth = getAuth(app);
    const db = getFirestore(app);
    const functions = getFunctions(app);
    const storage = getStorage(app);

    connectAuthEmulator(auth, "http://127.0.0.1:9098", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8085);
    connectFunctionsEmulator(functions, "127.0.0.1", 5002);
    connectStorageEmulator(storage, "127.0.0.1", 9195);

    testClientAuth = auth;
    testClientDb = db;
    testClientFunctions = functions;
    testClientStorage = storage;

    return {
      firebaseConfig: {
        apiKey: "demo-api-key",
        authDomain: "emandar-c1e15.firebaseapp.com",
        projectId: PROJECT_ID,
        storageBucket: "emandar-c1e15.firebasestorage.app",
        messagingSenderId: "816516819122",
        appId: "1:816516819122:web:74d6303d435df4cfab01ab",
        measurementId: "G-G663SW8FM8",
      },
      isFirebaseConfigured: true,
      firebaseApp: app,
      firebaseAuth: auth,
      firebaseDb: db,
      firebaseFunctions: functions,
      firebaseStorage: storage,
      firebaseAnalyticsPromise: Promise.resolve(null),
      getFirebaseAppCheck: () => null,
      ensureAppCheckToken: async () => undefined,
    };
  });
}

describe("firebase repository integration", () => {
  beforeAll(async () => {
    process.env.GCLOUD_PROJECT = PROJECT_ID;
  });

  beforeEach(async () => {
    await Promise.all(getClientApps().map((app) => deleteClientApp(app).catch(() => undefined)));
    vi.resetModules();
    mockFirebaseModule();
    repository = await import("@/data/firebaseRepository");
    firebaseLib = await import("@/lib/firebase");
    await resetEmulatorState();
    await repository.signOut().catch(() => undefined);
  });

  afterAll(async () => {
    await repository.signOut().catch(() => undefined);
    await Promise.all(getClientApps().map((app) => deleteClientApp(app).catch(() => undefined)));

    if (getApps().length > 0) {
      await deleteApp(adminApp);
    }
  });

async function signInAs(uid: string) {
  if (!firebaseLib.firebaseAuth) {
    throw new Error("Firebase auth is not available in tests.");
  }

    const credentialsByUid: Record<string, { email: string; password: string }> = {
      [ids.trainerUid]: {
        email: "trainer.integration@emandar.pl",
        password: "kocham123",
      },
      [ids.organizerUid]: {
        email: "organizer.integration@emandar.pl",
        password: "kocham123",
      },
    };
    const credentials = credentialsByUid[uid];

    if (!credentials) {
      throw new Error(`Missing auth credentials for test uid ${uid}.`);
    }

  const credential = await signInWithEmailAndPassword(
    firebaseLib.firebaseAuth,
    credentials.email,
    credentials.password,
  );

  await firebaseLib.firebaseAuth.authStateReady();
  await credential.user.getIdToken(true);
  await new Promise((resolve) => setTimeout(resolve, 400));
}

  it("allows organizer to create event for approved trainer relation", async () => {
    await signInAs(ids.organizerUid);
    const organizer = buildTestActor(
      {
        id: ids.organizerUid,
        displayName: "Marek Integration",
        email: "organizer.integration@emandar.pl",
        phone: "+48 600 100 102",
      },
      "organizer",
      ids.organizerId,
    );

    await repository.createUnifiedTrainingEvent(
      {
        trainerId: ids.trainerId,
        organizerId: ids.organizerId,
        summary: "Nowe szkolenie",
        description: "Opis",
        type: "Warsztat",
        scheduleDays: [
          {
            startsAt: "2026-06-10T09:00:00.000Z",
            endsAt: "2026-06-10T16:00:00.000Z",
          },
          {
            startsAt: "2026-06-11T09:00:00.000Z",
            endsAt: "2026-06-11T16:00:00.000Z",
          },
        ],
        location: "Warszawa",
        tags: ["oddech", "regeneracja"],
        capacity: 24,
        isPublished: true,
        status: "active",
        minimumParticipants: 10,
      },
      organizer,
    );

    const createdEvents = await adminDb
      .collection("trainingEvents")
      .where("title", "==", "Warszawa")
      .get();

    expect(createdEvents.docs.some((entry) => entry.data().organizerId === ids.organizerId)).toBe(
      true,
    );
  });

  it("archives linked events when trainer detaches relation with archive flag", async () => {
    await signInAs(ids.trainerUid);
    const trainer = buildTestActor(
      {
        id: ids.trainerUid,
        displayName: "Klaudia Integration",
        email: "trainer.integration@emandar.pl",
        phone: "+48 600 100 101",
      },
      "trainer",
      ids.trainerId,
    );

    await repository.detachRelation(ids.relationId, trainer, true);

    const relationSnapshot = await adminDb
      .collection("trainerOrganizerRelations")
      .doc(ids.relationId)
      .get();
    const archivedEventSnapshot = await adminDb
      .collection("trainingEvents")
      .doc(ids.sharedEventId)
      .get();

    expect(relationSnapshot.data()?.status).toBe("detached");
    expect(relationSnapshot.data()?.archivedLinkedEvents).toBe(true);
    expect(archivedEventSnapshot.data()?.archivedReason).toBe("relation-detached");
    expect(archivedEventSnapshot.data()?.isPublished).toBe(false);
  });

  it("blocks management update for already archived event", async () => {
    await signInAs(ids.trainerUid);
    const trainer = buildTestActor(
      {
        id: ids.trainerUid,
        displayName: "Klaudia Integration",
        email: "trainer.integration@emandar.pl",
        phone: "+48 600 100 101",
      },
      "trainer",
      ids.trainerId,
    );

    await repository.archiveTrainingEvent(ids.archivedEventId, trainer);

    await expect(
      repository.updateTrainingEventManagement(
        {
          eventId: ids.archivedEventId,
          status: "active",
          capacity: 22,
          minimumParticipants: 10,
          tags: ["oddech"],
        },
        trainer,
      ),
    ).rejects.toThrow("zarchiwizowane");
  });
});
