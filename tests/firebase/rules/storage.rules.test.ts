import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  authenticatedStorage,
  cleanupRulesEnvironment,
  getRulesEnvironment,
  readStorageBlob,
  resetRulesData,
  seedFirestoreDocuments,
  seedStorageFile,
  writeStorageString,
} from "./helpers";

const ids = {
  trainerUid: "trainer-uid",
  organizerUid: "organizer-uid",
  outsiderUid: "outsider-uid",
  submitterUid: "submitter-uid",
  trainerId: "trainer-1",
  organizerId: "organizer-1",
  requestId: "request-1",
};

const enrollmentPhotoPath = `enrollment-photos/${ids.requestId}/original`;
const trainerAvatarPath = `profile-photos/trainers/${ids.trainerUid}/avatar`;

async function seedStorageState() {
  await seedFirestoreDocuments([
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
        organizerProfileId: "organizer-2",
        status: "active",
      },
    },
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
      collection: "enrollmentRequests",
      id: ids.requestId,
      data: {
        eventId: "event-1",
        trainerId: ids.trainerId,
        organizerId: ids.organizerId,
        trainerUserId: ids.trainerUid,
        organizerUserId: ids.organizerUid,
        submitterUid: ids.submitterUid,
        photoStatus: "ready",
        photoPath: enrollmentPhotoPath,
        imieNazwisko: "Jan Kowalski",
        telefon: "+48 600 100 200",
        polecenieOdKogo: "Instagram",
        wiadomosc: "Chce dolaczyc",
        trainerDecision: "pending",
        organizerDecision: "pending",
        finalStatus: "pending",
        createdAt: "2026-03-10T12:00:00.000Z",
      },
    },
  ]);

  await new Promise((resolve) => setTimeout(resolve, 400));

  await seedStorageFile(enrollmentPhotoPath);
  await seedStorageFile(trainerAvatarPath);
}

describe("storage rules", () => {
  beforeAll(async () => {
    await getRulesEnvironment();
  });

  beforeEach(async () => {
    await resetRulesData();
    await seedStorageState();
  });

  afterAll(async () => {
    await cleanupRulesEnvironment();
  });

  it("allows enrollment participants to read stored face photo", async () => {
    const env = await getRulesEnvironment();
    const trainerStorage = await authenticatedStorage(ids.trainerUid);
    const organizerStorage = await authenticatedStorage(ids.organizerUid);

    await assertSucceeds(readStorageBlob(trainerStorage, enrollmentPhotoPath));
    await assertSucceeds(readStorageBlob(organizerStorage, enrollmentPhotoPath));
  });

  it("blocks unrelated user from reading enrollment photo", async () => {
    const env = await getRulesEnvironment();
    const storage = await authenticatedStorage(ids.outsiderUid);

    await assertFails(readStorageBlob(storage, enrollmentPhotoPath));
  });

  it("allows only enrollment submitter to upload photo for own request", async () => {
    const env = await getRulesEnvironment();
    const ownerStorage = await authenticatedStorage(ids.submitterUid);
    const outsiderStorage = await authenticatedStorage(ids.outsiderUid);

    await assertSucceeds(writeStorageString(ownerStorage, enrollmentPhotoPath));
    await assertFails(writeStorageString(outsiderStorage, enrollmentPhotoPath));
  });

  it("allows trainer to manage own avatar but blocks other accounts", async () => {
    const env = await getRulesEnvironment();
    const trainerStorage = await authenticatedStorage(ids.trainerUid);
    const outsiderStorage = await authenticatedStorage(ids.outsiderUid);

    await assertSucceeds(writeStorageString(trainerStorage, trainerAvatarPath));
    await assertFails(writeStorageString(outsiderStorage, trainerAvatarPath));
  });
});
