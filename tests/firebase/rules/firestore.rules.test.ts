import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import {
  authenticatedFirestore,
  cleanupRulesEnvironment,
  getRulesEnvironment,
  readFirestoreDoc,
  resetRulesData,
  seedFirestoreDocuments,
} from "./helpers";

const ids = {
  adminUid: "admin-uid",
  trainerUid: "trainer-uid",
  trainerUid2: "trainer-uid-2",
  organizerUid: "organizer-uid",
  outsiderUid: "outsider-uid",
  submitterUid: "submitter-uid",
  trainerId: "trainer-1",
  hiddenTrainerId: "trainer-hidden",
  secondTrainerId: "trainer-2",
  organizerId: "organizer-1",
  outsiderOrganizerId: "organizer-2",
  approvedRelationId: "trainer-1__organizer-1",
  pendingRelationId: "trainer-2__organizer-1",
  publicEventId: "event-public",
  draftEventId: "event-draft",
  archivedEventId: "event-archived",
  enrollmentId: "request-1",
  notificationId: "notification-1",
  accountRequestId: "account-request-1",
};

function userDocs() {
  return [
    {
      collection: "users",
      id: ids.adminUid,
      data: {
        role: "admin",
        roles: ["admin"],
        primaryRole: "admin",
        status: "active",
      },
    },
    {
      collection: "users",
      id: ids.trainerUid,
      data: {
        role: "trainer",
        roles: ["trainer"],
        primaryRole: "trainer",
        trainerProfileId: ids.trainerId,
        status: "active",
      },
    },
    {
      collection: "users",
      id: ids.trainerUid2,
      data: {
        role: "trainer",
        roles: ["trainer"],
        primaryRole: "trainer",
        trainerProfileId: ids.secondTrainerId,
        status: "active",
      },
    },
    {
      collection: "users",
      id: ids.organizerUid,
      data: {
        role: "organizer",
        roles: ["organizer"],
        primaryRole: "organizer",
        organizerProfileId: ids.organizerId,
        status: "active",
      },
    },
    {
      collection: "users",
      id: ids.outsiderUid,
      data: {
        role: "organizer",
        roles: ["organizer"],
        primaryRole: "organizer",
        organizerProfileId: ids.outsiderOrganizerId,
        status: "active",
      },
    },
  ];
}

function trainerDocs() {
  return [
    {
      collection: "trainers",
      id: ids.trainerId,
      data: {
        userId: ids.trainerUid,
        displayName: "Klaudia",
        slug: "klaudia",
        bio: "Bio",
        specialties: ["oddech"],
        locations: ["Warszawa"],
        heroNote: "Hero",
        isVisible: true,
        brandStatus: "official",
      },
    },
    {
      collection: "trainers",
      id: ids.hiddenTrainerId,
      data: {
        userId: "trainer-hidden-uid",
        displayName: "Ukryta",
        slug: "ukryta",
        bio: "Bio",
        specialties: [],
        locations: [],
        heroNote: "Hero",
        isVisible: false,
        brandStatus: "supported",
      },
    },
    {
      collection: "trainers",
      id: ids.secondTrainerId,
      data: {
        userId: ids.trainerUid2,
        displayName: "Beata",
        slug: "beata",
        bio: "Bio",
        specialties: ["spokoj"],
        locations: ["Krakow"],
        heroNote: "Hero",
        isVisible: true,
        brandStatus: "official",
      },
    },
  ];
}

function organizerDocs() {
  return [
    {
      collection: "organizers",
      id: ids.organizerId,
      data: {
        userId: ids.organizerUid,
        displayName: "Marek",
        description: "Opis",
        contactName: "Marek",
        location: "Krakow",
        isVisible: true,
      },
    },
    {
      collection: "organizers",
      id: ids.outsiderOrganizerId,
      data: {
        userId: ids.outsiderUid,
        displayName: "Karolina",
        description: "Opis",
        contactName: "Karolina",
        location: "Warszawa",
        isVisible: true,
      },
    },
  ];
}

function eventDoc(overrides: Record<string, unknown> = {}) {
  return {
    trainerId: ids.trainerId,
    organizerId: ids.organizerId,
    trainerUserId: ids.trainerUid,
    organizerUserId: ids.organizerUid,
    title: "Klaudia: warsztat oddechu",
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
    ...overrides,
  };
}

async function seedCoreState() {
  await seedFirestoreDocuments([
    ...userDocs(),
    ...trainerDocs(),
    ...organizerDocs(),
    {
      collection: "trainerOrganizerRelations",
      id: ids.approvedRelationId,
      data: {
        trainerId: ids.trainerId,
        organizerId: ids.organizerId,
        trainerUserId: ids.trainerUid,
        organizerUserId: ids.organizerUid,
        status: "approved",
        requestedBy: "organizer",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    },
    {
      collection: "trainerOrganizerRelations",
      id: ids.pendingRelationId,
      data: {
        trainerId: ids.secondTrainerId,
        organizerId: ids.organizerId,
        trainerUserId: ids.trainerUid2,
        organizerUserId: ids.organizerUid,
        status: "pending",
        requestedBy: "organizer",
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    },
    {
      collection: "trainingEvents",
      id: ids.publicEventId,
      data: eventDoc(),
    },
    {
      collection: "trainingEvents",
      id: ids.draftEventId,
      data: eventDoc({
        isPublished: false,
        trainerCollaborationStatus: "pending",
      }),
    },
    {
      collection: "trainingEvents",
      id: ids.archivedEventId,
      data: eventDoc({
        archivedAt: "2026-03-10T12:00:00.000Z",
        archivedByRole: "trainer",
        archivedReason: "manual",
        isPublished: false,
      }),
    },
    {
      collection: "enrollmentRequests",
      id: ids.enrollmentId,
      data: {
        eventId: ids.publicEventId,
        trainerId: ids.trainerId,
        organizerId: ids.organizerId,
        trainerUserId: ids.trainerUid,
        organizerUserId: ids.organizerUid,
        submitterUid: ids.submitterUid,
        imieNazwisko: "Jan Kowalski",
        telefon: "+48 600 100 200",
        polecenieOdKogo: "Instagram",
        wiadomosc: "Chce dolaczyc",
        photoStatus: "ready",
        trainerDecision: "pending",
        organizerDecision: "pending",
        finalStatus: "pending",
        requiresOrganizerApproval: true,
        createdAt: "2026-03-10T12:00:00.000Z",
      },
    },
    {
      collection: "notifications",
      id: ids.notificationId,
      data: {
        userId: ids.trainerUid,
        title: "Powiadomienie",
        body: "Demo",
        entityType: "event",
        createdAt: "2026-03-10T12:30:00.000Z",
      },
    },
    {
      collection: "accountRequests",
      id: ids.accountRequestId,
      data: {
        displayName: "Nowa Osoba",
        email: "nowa@emandar.pl",
        emailLowercase: "nowa@emandar.pl",
        phone: "+48 600 100 999",
        requestedRoles: ["trainer"],
        notes: "Notatka",
        status: "pending",
        createdAt: "2026-03-10T08:00:00.000Z",
      },
    },
  ]);
}

describe("firestore rules", () => {
  beforeAll(async () => {
    await getRulesEnvironment();
  });

  beforeEach(async () => {
    await resetRulesData();
    await seedCoreState();
  });

  afterAll(async () => {
    await cleanupRulesEnvironment();
  });

  it("allows public reads only for visible trainers and public events", async () => {
    const env = await getRulesEnvironment();
    const anonymousDb = env.unauthenticatedContext().firestore();

    await assertSucceeds(readFirestoreDoc(anonymousDb, "trainers", ids.trainerId));
    await assertFails(readFirestoreDoc(anonymousDb, "trainers", ids.hiddenTrainerId));
    await assertSucceeds(readFirestoreDoc(anonymousDb, "trainingEvents", ids.publicEventId));
    await assertFails(readFirestoreDoc(anonymousDb, "trainingEvents", ids.draftEventId));
  });

  it("blocks anonymous access to private collections", async () => {
    const env = await getRulesEnvironment();
    const anonymousDb = env.unauthenticatedContext().firestore();

    await assertFails(getDocs(collection(anonymousDb, "organizers")));
    await assertFails(getDocs(collection(anonymousDb, "accountRequests")));
    await assertFails(readFirestoreDoc(anonymousDb, "enrollmentRequests", ids.enrollmentId));
  });

  it("allows organizer to create pending relation request for own profile", async () => {
    const db = await authenticatedFirestore(ids.organizerUid);

    await assertSucceeds(
      setDoc(doc(db, "trainerOrganizerRelations", `${ids.hiddenTrainerId}__${ids.organizerId}`), {
        trainerId: ids.hiddenTrainerId,
        organizerId: ids.organizerId,
        trainerUserId: "trainer-hidden-uid",
        organizerUserId: ids.organizerUid,
        status: "pending",
        requestedBy: "organizer",
        createdAt: "2026-03-10T10:00:00.000Z",
      }),
    );
  });

  it("allows target trainer to approve relation and blocks unrelated organizer", async () => {
    const trainerDb = await authenticatedFirestore(ids.trainerUid2);
    const outsiderDb = await authenticatedFirestore(ids.outsiderUid);

    await assertSucceeds(
      updateDoc(doc(trainerDb, "trainerOrganizerRelations", ids.pendingRelationId), {
        status: "approved",
      }),
    );

    await assertFails(
      updateDoc(doc(outsiderDb, "trainerOrganizerRelations", ids.pendingRelationId), {
        status: "approved",
      }),
    );
  });

  it("blocks direct client creation of training events and enrollment requests", async () => {
    const organizerDb = await authenticatedFirestore(ids.organizerUid);
    const submitterDb = await authenticatedFirestore(ids.submitterUid);

    await assertFails(
      setDoc(doc(organizerDb, "trainingEvents", "event-client-create"), eventDoc()),
    );

    await assertFails(
      setDoc(doc(submitterDb, "enrollmentRequests", "request-client-create"), {
        eventId: ids.publicEventId,
        trainerId: ids.trainerId,
        organizerId: ids.organizerId,
        trainerUserId: ids.trainerUid,
        organizerUserId: ids.organizerUid,
        submitterUid: ids.submitterUid,
        imieNazwisko: "Jan Kowalski",
        telefon: "+48 600 100 200",
        polecenieOdKogo: "Instagram",
        wiadomosc: "Chce dolaczyc",
        photoStatus: "pending",
        trainerDecision: "pending",
        organizerDecision: "pending",
        finalStatus: "pending",
        requiresOrganizerApproval: true,
        createdAt: "2026-03-10T12:00:00.000Z",
      }),
    );
  });

  it("allows only event participants to update their own collaboration status", async () => {
    const trainerDb = await authenticatedFirestore(ids.trainerUid);
    const organizerDb = await authenticatedFirestore(ids.organizerUid);
    const adminDb = await authenticatedFirestore(ids.adminUid, { admin: true });
    const adminWithoutClaimDb = await authenticatedFirestore(ids.adminUid);

    await assertSucceeds(
      updateDoc(doc(trainerDb, "trainingEvents", ids.draftEventId), {
        trainerCollaborationStatus: "accepted",
      }),
    );

    await assertSucceeds(
      updateDoc(doc(adminDb, "trainingEvents", ids.draftEventId), {
        trainerCollaborationStatus: "accepted",
        organizerCollaborationStatus: "accepted",
      }),
    );

    await assertSucceeds(
      updateDoc(doc(adminWithoutClaimDb, "trainingEvents", ids.publicEventId), {
        trainerCollaborationStatus: "accepted",
        organizerCollaborationStatus: "accepted",
      }),
    );

    await assertFails(
      updateDoc(doc(organizerDb, "trainingEvents", ids.publicEventId), {
        tags: ["zmiana"],
      }),
    );
  });

  it("allows only owners to read enrollment requests", async () => {
    const trainerDb = await authenticatedFirestore(ids.trainerUid);
    const outsiderDb = await authenticatedFirestore(ids.outsiderUid);

    await assertSucceeds(readFirestoreDoc(trainerDb, "enrollmentRequests", ids.enrollmentId));
    await assertFails(readFirestoreDoc(outsiderDb, "enrollmentRequests", ids.enrollmentId));
  });

  it("allows notification owner to mark it as read but blocks creating notifications from client", async () => {
    const trainerDb = await authenticatedFirestore(ids.trainerUid);

    await assertSucceeds(
      updateDoc(doc(trainerDb, "notifications", ids.notificationId), {
        readAt: "2026-03-10T13:00:00.000Z",
      }),
    );

    await assertFails(
      setDoc(doc(trainerDb, "notifications", "notification-new"), {
        userId: ids.trainerUid,
        title: "Nie wolno",
        body: "Nie wolno",
        entityType: "event",
        createdAt: "2026-03-10T13:00:00.000Z",
      }),
    );
  });

  it("allows only admin to read account requests", async () => {
    const adminDb = await authenticatedFirestore(ids.adminUid, { admin: true });
    const organizerDb = await authenticatedFirestore(ids.organizerUid);

    await assertSucceeds(readFirestoreDoc(adminDb, "accountRequests", ids.accountRequestId));
    await assertFails(readFirestoreDoc(organizerDb, "accountRequests", ids.accountRequestId));
  });
});
