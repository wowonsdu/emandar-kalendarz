import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function buildRelationId(trainerId, organizerId) {
  return `${trainerId}__${organizerId}`;
}

async function resolveServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const raw = await readFile(resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH), "utf8");
    return JSON.parse(raw);
  }

  return null;
}

async function main() {
  const serviceAccount = await resolveServiceAccount();
  const app =
    getApps()[0] ??
    initializeApp(
      serviceAccount
        ? {
            credential: cert(serviceAccount),
            projectId:
              process.env.FIREBASE_PROJECT_ID ??
              process.env.GCLOUD_PROJECT ??
              serviceAccount.project_id,
          }
        : {
            credential: applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT,
          },
    );
  const db = getFirestore(app);
  const [trainerSnapshots, organizerSnapshots, relationSnapshots, eventSnapshots, groupSnapshots, slotSnapshots, enrollmentSnapshots] =
    await Promise.all([
      db.collection("trainers").get(),
      db.collection("organizers").get(),
      db.collection("trainerOrganizerRelations").get(),
      db.collection("trainingEvents").get(),
      db.collection("groups").get(),
      db.collection("availabilitySlots").get(),
      db.collection("enrollmentRequests").get(),
    ]);

  const trainerById = new Map(
    trainerSnapshots.docs.map((entry) => [entry.id, entry.data()]),
  );
  const organizerById = new Map(
    organizerSnapshots.docs.map((entry) => [entry.id, entry.data()]),
  );

  const relationGroups = new Map();
  for (const snapshot of relationSnapshots.docs) {
    const data = snapshot.data();
    const key = buildRelationId(data.trainerId, data.organizerId);
    const current = relationGroups.get(key);

    if (!current || new Date(data.createdAt ?? 0).getTime() >= new Date(current.data.createdAt ?? 0).getTime()) {
      relationGroups.set(key, { snapshot, data });
    }
  }

  let migratedRelations = 0;
  for (const [relationId, entry] of relationGroups.entries()) {
    const trainer = trainerById.get(entry.data.trainerId);
    const organizer = organizerById.get(entry.data.organizerId);

    await db.collection("trainerOrganizerRelations").doc(relationId).set(
      {
        ...entry.data,
        trainerUserId: trainer?.userId ?? entry.data.trainerUserId ?? null,
        organizerUserId: organizer?.userId ?? entry.data.organizerUserId ?? null,
      },
      { merge: true },
    );

    if (entry.snapshot.id !== relationId) {
      await entry.snapshot.ref.delete();
    }

    migratedRelations += 1;
  }

  let updatedEvents = 0;
  for (const snapshot of eventSnapshots.docs) {
    const data = snapshot.data();
    const trainer = trainerById.get(data.trainerId);
    const organizer = data.organizerId ? organizerById.get(data.organizerId) : null;
    const selfManaged =
      data.brandStatus === "supported" || data.selfManagedByTrainer === true || !data.organizerId;

    await snapshot.ref.set(
      {
        trainerUserId: trainer?.userId ?? data.trainerUserId ?? null,
        organizerUserId: organizer?.userId ?? data.organizerUserId ?? null,
        requiresOrganizerApproval: selfManaged ? false : data.requiresOrganizerApproval ?? true,
        selfManagedByTrainer: selfManaged,
        trainerCollaborationStatus: data.trainerCollaborationStatus ?? "accepted",
        organizerCollaborationStatus: selfManaged
          ? "not-required"
          : data.organizerCollaborationStatus ?? "accepted",
        archivedForOrganizerId:
          data.archivedAt && data.archivedForOrganizerId === undefined
            ? data.organizerId ?? null
            : data.archivedForOrganizerId,
      },
      { merge: true },
    );

    updatedEvents += 1;
  }

  for (const snapshot of groupSnapshots.docs) {
    const data = snapshot.data();
    const trainer = trainerById.get(data.trainerId);
    const organizer = organizerById.get(data.organizerId);

    await snapshot.ref.set(
      {
        trainerUserId: trainer?.userId ?? data.trainerUserId ?? null,
        organizerUserId: organizer?.userId ?? data.organizerUserId ?? null,
      },
      { merge: true },
    );
  }

  for (const snapshot of slotSnapshots.docs) {
    const data = snapshot.data();
    const trainer = trainerById.get(data.trainerId);

    await snapshot.ref.set(
      {
        trainerUserId: trainer?.userId ?? data.trainerUserId ?? null,
        visibleToOrganizerIds: data.visibleToOrganizerIds ?? [],
      },
      { merge: true },
    );
  }

  for (const snapshot of enrollmentSnapshots.docs) {
    const data = snapshot.data();
    const trainer = trainerById.get(data.trainerId);
    const organizer = data.organizerId ? organizerById.get(data.organizerId) : null;

    await snapshot.ref.set(
      {
        trainerUserId: trainer?.userId ?? data.trainerUserId ?? null,
        organizerUserId: organizer?.userId ?? data.organizerUserId ?? null,
        requiresOrganizerApproval: data.organizerId ? data.requiresOrganizerApproval ?? true : false,
      },
      { merge: true },
    );
  }

  console.log(
    `Backfill complete: ${migratedRelations} relations normalized, ${updatedEvents} events updated.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
