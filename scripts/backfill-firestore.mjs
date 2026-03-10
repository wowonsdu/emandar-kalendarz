import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DOTENV_PATH = resolve(process.cwd(), ".env.local");

function parseJsonEnv(name) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return null;
  }

  return JSON.parse(rawValue);
}

async function loadServiceAccountFromFile(filePath) {
  const raw = await readFile(resolve(process.cwd(), filePath), "utf8");
  return JSON.parse(raw);
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const pairs = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
          return null;
        }

        return [
          line.slice(0, separatorIndex).trim(),
          line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, ""),
        ];
      })
      .filter(Boolean);

    return Object.fromEntries(pairs);
  } catch {
    return {};
  }
}

async function resolveAdminConfig() {
  const envFile = await loadEnvFile(DOTENV_PATH);

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = parseJsonEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
    return {
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID ?? serviceAccount.project_id ?? envFile.VITE_FIREBASE_PROJECT_ID,
    };
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = await loadServiceAccountFromFile(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    return {
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID ?? serviceAccount.project_id ?? envFile.VITE_FIREBASE_PROJECT_ID,
    };
  }

  return {
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID ?? envFile.VITE_FIREBASE_PROJECT_ID,
  };
}

function relationId(trainerId, organizerId) {
  return `${trainerId}__${organizerId}`;
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const adminConfig = await resolveAdminConfig();

  if (!adminConfig.projectId) {
    throw new Error("Missing Firebase project id.");
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: adminConfig.credential,
      projectId: adminConfig.projectId,
    });

  const db = getFirestore(app);
  const trainers = new Map();
  const organizers = new Map();
  const plannedWrites = [];
  const plannedDeletes = [];

  for (const snapshot of (await db.collection("trainers").get()).docs) {
    trainers.set(snapshot.id, snapshot.data());
  }

  for (const snapshot of (await db.collection("organizers").get()).docs) {
    organizers.set(snapshot.id, snapshot.data());
  }

  for (const snapshot of (await db.collection("trainerOrganizerRelations").get()).docs) {
    const data = snapshot.data();
    const trainer = trainers.get(data.trainerId);
    const organizer = organizers.get(data.organizerId);
    const normalizedId = relationId(data.trainerId, data.organizerId);
    const patch = {};

    if (trainer?.userId && data.trainerUserId !== trainer.userId) {
      patch.trainerUserId = trainer.userId;
    }

    if (organizer?.userId && data.organizerUserId !== organizer.userId) {
      patch.organizerUserId = organizer.userId;
    }

    if (Object.keys(patch).length > 0) {
      plannedWrites.push({ collection: "trainerOrganizerRelations", id: snapshot.id, patch });
    }

    if (snapshot.id !== normalizedId) {
      plannedWrites.push({
        collection: "trainerOrganizerRelations",
        id: normalizedId,
        patch: { ...data, ...patch },
      });
      plannedDeletes.push({ collection: "trainerOrganizerRelations", id: snapshot.id });
    }
  }

  for (const collectionName of [
    "trainingEvents",
    "availabilitySlots",
    "enrollmentRequests",
    "groups",
  ]) {
    for (const snapshot of (await db.collection(collectionName).get()).docs) {
      const data = snapshot.data();
      const trainer = data.trainerId ? trainers.get(data.trainerId) : null;
      const organizer = data.organizerId ? organizers.get(data.organizerId) : null;
      const patch = {};

      if (trainer?.userId && data.trainerUserId !== trainer.userId) {
        patch.trainerUserId = trainer.userId;
      }

      if (data.organizerId && organizer?.userId && data.organizerUserId !== organizer.userId) {
        patch.organizerUserId = organizer.userId;
      }

      if (Object.keys(patch).length > 0) {
        plannedWrites.push({ collection: collectionName, id: snapshot.id, patch });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        projectId: adminConfig.projectId,
        writes: plannedWrites.length,
        deletes: plannedDeletes.length,
        plannedWrites,
        plannedDeletes,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    return;
  }

  for (const write of plannedWrites) {
    await db.collection(write.collection).doc(write.id).set(write.patch, { merge: true });
  }

  for (const deletion of plannedDeletes) {
    await db.collection(deletion.collection).doc(deletion.id).delete();
  }

  console.log("Backfill applied.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
