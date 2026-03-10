import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import process from "node:process";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DEMO_SEED_PATH = resolve(process.cwd(), "src/data/demoSeed.ts");
const FIREBASE_TOOLS_PATH = resolve(
  homedir(),
  ".config",
  "configstore",
  "firebase-tools.json",
);
const DOTENV_PATH = resolve(process.cwd(), ".env.local");
const COLLECTIONS = [
  { storeKey: "users", collectionName: "users" },
  { storeKey: "trainers", collectionName: "trainers" },
  { storeKey: "organizers", collectionName: "organizers" },
  { storeKey: "relations", collectionName: "trainerOrganizerRelations" },
  { storeKey: "groups", collectionName: "groups" },
  { storeKey: "trainingEvents", collectionName: "trainingEvents" },
  { storeKey: "availabilitySlots", collectionName: "availabilitySlots" },
  { storeKey: "enrollmentRequests", collectionName: "enrollmentRequests" },
  { storeKey: "notifications", collectionName: "notifications" },
  { storeKey: "accountRequests", collectionName: "accountRequests" },
];

function deriveEnrollmentFinalStatus(trainerDecision, organizerDecision) {
  if (trainerDecision === "rejected" || organizerDecision === "rejected") {
    return "rejected";
  }

  if (trainerDecision === "accepted" && organizerDecision === "accepted") {
    return "accepted";
  }

  if (trainerDecision === "accepted" || organizerDecision === "accepted") {
    return "partial";
  }

  return "pending";
}

function parseJsonEnv(name) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    throw new Error(`Environment variable ${name} does not contain valid JSON.`, {
      cause: error,
    });
  }
}

async function loadServiceAccountFromFile(filePath) {
  const resolvedPath = resolve(process.cwd(), filePath);
  const raw = await readFile(resolvedPath, "utf8");
  return JSON.parse(raw);
}

async function loadFirebaseToolsConfig() {
  try {
    const raw = await readFile(FIREBASE_TOOLS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function resolveCredentialConfig() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = parseJsonEnv("FIREBASE_SERVICE_ACCOUNT_JSON");

    return {
      credential: cert(serviceAccount),
      projectId:
        process.env.FIREBASE_PROJECT_ID ??
        serviceAccount.project_id ??
        process.env.GCLOUD_PROJECT ??
        null,
      source: "FIREBASE_SERVICE_ACCOUNT_JSON",
      firebaseToolsConfig: null,
    };
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath) {
    const serviceAccount = await loadServiceAccountFromFile(serviceAccountPath);

    return {
      credential: cert(serviceAccount),
      projectId:
        process.env.FIREBASE_PROJECT_ID ??
        serviceAccount.project_id ??
        process.env.GCLOUD_PROJECT ??
        null,
      source:
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH
          ? "FIREBASE_SERVICE_ACCOUNT_PATH"
          : "GOOGLE_APPLICATION_CREDENTIALS",
      firebaseToolsConfig: null,
    };
  }

  const firebaseToolsConfig = await loadFirebaseToolsConfig();
  if (firebaseToolsConfig?.tokens?.access_token) {
    return {
      credential: null,
      projectId:
        process.env.FIREBASE_PROJECT_ID ??
        process.env.GCLOUD_PROJECT ??
        firebaseToolsConfig?.activeProjects?.[process.cwd()] ??
        null,
      source: "firebaseToolsLogin",
      firebaseToolsConfig,
    };
  }

  return {
    credential: applicationDefault(),
    projectId:
      process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? null,
    source: "applicationDefault",
    firebaseToolsConfig: null,
  };
}

async function loadDemoSeed() {
  const source = await readFile(DEMO_SEED_PATH, "utf8");
  const prefix = "export const demoSeed: DemoStore =";
  const startIndex = source.indexOf(prefix);

  if (startIndex === -1) {
    throw new Error(`Could not find demoSeed export in ${DEMO_SEED_PATH}.`);
  }

  const objectStart = source.indexOf("{", startIndex + prefix.length);
  const objectEnd = source.lastIndexOf("};");

  if (objectStart === -1 || objectEnd === -1) {
    throw new Error(`Could not parse demo seed object from ${DEMO_SEED_PATH}.`);
  }

  const objectLiteral = source.slice(objectStart, objectEnd + 1);
  const factory = new Function(
    "deriveEnrollmentFinalStatus",
    `"use strict"; return (${objectLiteral});`,
  );

  return factory(deriveEnrollmentFinalStatus);
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
          return null;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
        return [key, value];
      })
      .filter(Boolean);

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function buildSeedPayloads(store, userIdMap) {
  const trainerById = new Map(store.trainers.map((trainer) => [trainer.id, trainer]));
  const organizerById = new Map(
    store.organizers.map((organizer) => [organizer.id, organizer]),
  );
  const trainerIdByUserId = new Map(
    store.trainers.map((trainer) => [trainer.userId, trainer.id]),
  );
  const organizerIdByUserId = new Map(
    store.organizers.map((organizer) => [organizer.userId, organizer.id]),
  );

  const users = store.users.map(({ password, ...user }) => {
    const authUid = userIdMap.get(user.id) ?? user.id;

    return {
      ...user,
      id: authUid,
      legacyDemoId: user.id,
      profileId:
        user.role === "trainer"
          ? trainerIdByUserId.get(user.id) ?? null
          : user.role === "organizer"
            ? organizerIdByUserId.get(user.id) ?? null
            : null,
      seededFromDemo: true,
    };
  });

  const trainers = store.trainers.map((trainer) => ({
    ...trainer,
    userId: userIdMap.get(trainer.userId) ?? trainer.userId,
  }));

  const organizers = store.organizers.map((organizer) => ({
    ...organizer,
    userId: userIdMap.get(organizer.userId) ?? organizer.userId,
  }));

  const relations = store.relations.map((relation) => {
    const trainer = trainerById.get(relation.trainerId);
    const organizer = organizerById.get(relation.organizerId);

    return {
      ...relation,
      trainerUserId:
        trainer ? userIdMap.get(trainer.userId) ?? trainer.userId : relation.trainerUserId ?? null,
      organizerUserId:
        organizer
          ? userIdMap.get(organizer.userId) ?? organizer.userId
          : relation.organizerUserId ?? null,
    };
  });

  const groups = store.groups.map((group) => {
    const trainer = trainerById.get(group.trainerId);
    const organizer = organizerById.get(group.organizerId);

    return {
      ...group,
      trainerUserId:
        trainer ? userIdMap.get(trainer.userId) ?? trainer.userId : group.trainerUserId ?? null,
      organizerUserId:
        organizer
          ? userIdMap.get(organizer.userId) ?? organizer.userId
          : group.organizerUserId ?? null,
    };
  });

  const trainingEvents = store.trainingEvents.map((event) => {
    const trainer = trainerById.get(event.trainerId);
    const organizer = organizerById.get(event.organizerId);

    return {
      ...event,
      trainerUserId:
        trainer ? userIdMap.get(trainer.userId) ?? trainer.userId : event.trainerUserId ?? null,
      organizerUserId:
        organizer
          ? userIdMap.get(organizer.userId) ?? organizer.userId
          : event.organizerUserId ?? null,
    };
  });

  const availabilitySlots = store.availabilitySlots.map((slot) => {
    const trainer = trainerById.get(slot.trainerId);

    return {
      ...slot,
      trainerUserId:
        trainer ? userIdMap.get(trainer.userId) ?? trainer.userId : slot.trainerUserId ?? null,
      visibleToOrganizerIds: slot.visibleToOrganizerIds ?? [],
    };
  });

  const enrollmentRequests = store.enrollmentRequests.map((request) => {
    const trainer = trainerById.get(request.trainerId);
    const organizer = organizerById.get(request.organizerId);

    return {
      ...request,
      trainerUserId:
        trainer ? userIdMap.get(trainer.userId) ?? trainer.userId : request.trainerUserId ?? null,
      organizerUserId:
        organizer
          ? userIdMap.get(organizer.userId) ?? organizer.userId
          : request.organizerUserId ?? null,
      submitterUid: request.submitterUid ?? null,
    };
  });

  return {
    users,
    trainers,
    organizers,
    relations,
    groups,
    trainingEvents,
    availabilitySlots,
    enrollmentRequests,
    notifications: store.notifications.map((notification) => ({
      ...notification,
      userId: userIdMap.get(notification.userId) ?? notification.userId,
    })),
    accountRequests: store.accountRequests,
  };
}

async function upsertAuthUserAdmin(auth, user) {
  const createPayload = {
    uid: user.id,
    email: user.email,
    emailVerified: true,
    password: user.password,
    displayName: user.displayName,
    disabled: user.status !== "active",
  };
  const updatePayload = {
    email: user.email,
    emailVerified: true,
    password: user.password,
    displayName: user.displayName,
    disabled: user.status !== "active",
  };

  try {
    await auth.updateUser(user.id, updatePayload);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }

    await auth.createUser(createPayload);
  }

  await auth.setCustomUserClaims(user.id, {
    role: user.role,
    admin: user.role === "admin",
  });
}

async function seedAuthUsersAdmin(auth, users) {
  for (const user of users) {
    await upsertAuthUserAdmin(auth, user);
  }

  return new Map(users.map((user) => [user.id, user.id]));
}

async function seedFirestoreAdmin(db, store, userIdMap) {
  const batch = db.batch();
  const payloads = buildSeedPayloads(store, userIdMap);

  for (const { storeKey, collectionName } of COLLECTIONS) {
    for (const item of payloads[storeKey]) {
      batch.set(
        db.collection(collectionName).doc(item.id),
        {
          ...item,
          seededAt: FieldValue.serverTimestamp(),
          source: "scripts/seed-firebase.mjs",
        },
        { merge: true },
      );
    }
  }

  batch.set(
    db.collection("app_meta").doc("seed"),
    {
      collections: COLLECTIONS.map((entry) => entry.collectionName),
      counts: Object.fromEntries(
        COLLECTIONS.map(({ storeKey, collectionName }) => [
          collectionName,
          payloads[storeKey].length,
        ]),
      ),
      seededAt: FieldValue.serverTimestamp(),
      source: "scripts/seed-firebase.mjs",
      usersSeeded: payloads.users.length,
    },
    { merge: true },
  );

  await batch.commit();
}

async function firebaseRequest(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = json?.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return json;
}

async function upsertAuthUsersViaWebApi(users, apiKey) {
  const idMap = new Map();

  for (const user of users) {
    try {
      const created = await firebaseRequest(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            password: user.password,
            returnSecureToken: true,
          }),
        },
      );

      idMap.set(user.id, created.localId);
      continue;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("EMAIL_EXISTS")) {
        throw error;
      }
    }

    const existing = await firebaseRequest(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          returnSecureToken: true,
        }),
      },
    );

    idMap.set(user.id, existing.localId);
  }

  return idMap;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }

  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { integerValue: value.toString() };
    }

    return { doubleValue: value };
  }

  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nested]) => [key, toFirestoreValue(nested)]),
        ),
      },
    };
  }

  throw new Error(`Unsupported Firestore value: ${String(value)}`);
}

async function writeFirestoreDocument(projectId, accessToken, collectionName, docId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}`;

  await firebaseRequest(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]),
      ),
    }),
  });
}

async function seedFirestoreViaRest(projectId, accessToken, store, userIdMap) {
  const payloads = buildSeedPayloads(store, userIdMap);
  const seededAt = new Date().toISOString();

  for (const { storeKey, collectionName } of COLLECTIONS) {
    for (const item of payloads[storeKey]) {
      const { id, ...data } = item;
      await writeFirestoreDocument(projectId, accessToken, collectionName, id, {
        ...data,
        source: "scripts/seed-firebase.mjs",
        seededAt,
      });
    }
  }

  await writeFirestoreDocument(projectId, accessToken, "app_meta", "seed", {
    collections: COLLECTIONS.map((entry) => entry.collectionName),
    counts: Object.fromEntries(
      COLLECTIONS.map(({ storeKey, collectionName }) => [
        collectionName,
        payloads[storeKey].length,
      ]),
    ),
    seededAt,
    source: "scripts/seed-firebase.mjs",
    usersSeeded: payloads.users.length,
  });
}

async function seedUsingAdminSdk(credentialConfig, demoStore) {
  const app =
    getApps()[0] ??
    initializeApp({
      credential: credentialConfig.credential,
      projectId: credentialConfig.projectId,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

  const auth = getAuth(app);
  const db = getFirestore(app);

  const userIdMap = await seedAuthUsersAdmin(auth, demoStore.users);
  await seedFirestoreAdmin(db, demoStore, userIdMap);
}

async function seedUsingFirebaseToolsLogin(credentialConfig, demoStore) {
  const firebaseToolsConfig = credentialConfig.firebaseToolsConfig;
  const accessToken = firebaseToolsConfig?.tokens?.access_token;

  if (!accessToken) {
    throw new Error("Missing Firebase CLI access token.");
  }

  const envFile = await loadEnvFile(DOTENV_PATH);
  const apiKey = process.env.VITE_FIREBASE_API_KEY ?? envFile.VITE_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing VITE_FIREBASE_API_KEY. Could not seed Auth users via Web API.");
  }

  const userIdMap = await upsertAuthUsersViaWebApi(demoStore.users, apiKey);
  await seedFirestoreViaRest(
    credentialConfig.projectId,
    accessToken,
    demoStore,
    userIdMap,
  );
}

async function main() {
  const credentialConfig = await resolveCredentialConfig();
  const demoStore = await loadDemoSeed();
  const projectId = credentialConfig.projectId;

  if (!projectId) {
    throw new Error(
      "Missing Firebase project id. Set FIREBASE_PROJECT_ID, GCLOUD_PROJECT, or provide a service account with project_id.",
    );
  }

  if (credentialConfig.source === "firebaseToolsLogin") {
    await seedUsingFirebaseToolsLogin(credentialConfig, demoStore);
  } else {
    await seedUsingAdminSdk(credentialConfig, demoStore);
  }

  console.log(
    `Seeded ${demoStore.users.length} auth users and ${COLLECTIONS.length} Firestore collections into ${projectId} using ${credentialConfig.source}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);

  if (error instanceof Error && error.cause) {
    console.error(error.cause);
  }

  process.exitCode = 1;
});
