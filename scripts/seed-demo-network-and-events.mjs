import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import process from "node:process";
import { getApps, initializeApp, refreshToken } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const PASSWORD = "kocham";
const FIREBASE_TOOLS_PATH = resolve(
  homedir(),
  ".config",
  "configstore",
  "firebase-tools.json",
);
const DOTENV_PATH = resolve(process.cwd(), ".env.local");
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

const trainers = [
  { id: "trainer-11", displayName: "Dariusz", email: "dariusz@emandar.pl", city: "Warszawa" },
  { id: "trainer-1", displayName: "Jacek", email: "jacek@emandar.pl", city: "Warszawa" },
  { id: "trainer-2", displayName: "Marcin", email: "marcin@emandar.pl", city: "Kraków" },
  { id: "trainer-10", displayName: "Dorota", email: "dorota@emandar.pl", city: "Lublin" },
  { id: "trainer-4", displayName: "Asia", email: "asia@emandar.pl", city: "Wrocław" },
  { id: "trainer-5", displayName: "Krzysiu", email: "krzysiu@emandar.pl", city: "Poznań" },
  { id: "trainer-6", displayName: "Klaudia", email: "klaudia@emandar.pl", city: "Gdańsk" },
  { id: "trainer-3", displayName: "Beata", email: "beata@emandar.pl", city: "Łódź" },
];

const organizers = [
  { id: "organizer-karolina", displayName: "Karolina", email: "karolina@emandar.pl", city: "Warszawa" },
  { id: "organizer-marek", displayName: "Marek", email: "marek@emandar.pl", city: "Kraków" },
  { id: "organizer-demo", displayName: "Organizator Demo", email: "organizator-demo@emandar.pl", city: "Online" },
];

const candidateOrganizers = [
  {
    id: "organizer-kamila",
    displayName: "Kamila",
    email: "kamila@emandar.pl",
    phone: "+48 603 200 301",
    city: "Warszawa",
    description: "Chce organizować wydarzenia i jest w trakcie pierwszych rozmów z trenerami.",
  },
  {
    id: "organizer-patryk",
    displayName: "Patryk",
    email: "patryk@emandar.pl",
    phone: "+48 603 200 302",
    city: "Kraków",
    description: "Buduje lokalną grupę i zbiera pierwsze relacje z prowadzącymi.",
  },
  {
    id: "organizer-ola",
    displayName: "Ola",
    email: "ola@emandar.pl",
    phone: "+48 603 200 303",
    city: "Gdańsk",
    description: "Ma gotowe miejsce i chce uruchamiać szkolenia na północy.",
  },
  {
    id: "organizer-rafal",
    displayName: "Rafał",
    email: "rafal@emandar.pl",
    phone: "+48 603 200 304",
    city: "Poznań",
    description: "Chce ruszyć z wydarzeniami dla społeczności i klasycznymi grupami.",
  },
  {
    id: "organizer-natalia",
    displayName: "Natalia",
    email: "natalia@emandar.pl",
    phone: "+48 603 200 305",
    city: "Wrocław",
    description: "Kończy profil i czeka na akceptację pierwszych relacji.",
  },
  {
    id: "organizer-szymon",
    displayName: "Szymon",
    email: "szymon@emandar.pl",
    phone: "+48 603 200 306",
    city: "Online",
    description: "Chce prowadzić organizację wydarzeń hybrydowych i online.",
  },
];

const pendingAccountRequests = [
  {
    id: "account-request-demo-anna",
    displayName: "Anna Nowak",
    email: "anna.nowak.request@emandar.pl",
    phone: "+48 604 300 401",
    requestedRoles: ["organizer"],
    notes: "Chce zacząć od małych grup lokalnych i stopniowo rozwijać kalendarz.",
  },
  {
    id: "account-request-demo-piotr",
    displayName: "Piotr Kania",
    email: "piotr.kania.request@emandar.pl",
    phone: "+48 604 300 402",
    requestedRoles: ["organizer", "trainer"],
    notes: "Ma własną społeczność i chce równolegle prowadzić oraz organizować wydarzenia.",
  },
  {
    id: "account-request-demo-ewa",
    displayName: "Ewa Zawadzka",
    email: "ewa.zawadzka.request@emandar.pl",
    phone: "+48 604 300 403",
    requestedRoles: ["organizer"],
    notes: "Interesuje ją rola organizatorki wydarzeń dla społeczności.",
  },
  {
    id: "account-request-demo-michal",
    displayName: "Michał Lis",
    email: "michal.lis.request@emandar.pl",
    phone: "+48 604 300 404",
    requestedRoles: ["organizer"],
    notes: "Chce rozwijać grupy w swoim regionie i szuka pierwszych trenerów do współpracy.",
  },
  {
    id: "account-request-demo-zuzanna",
    displayName: "Zuzanna Wójcik",
    email: "zuzanna.wojcik.request@emandar.pl",
    phone: "+48 604 300 405",
    requestedRoles: ["organizer", "trainer"],
    notes: "Chce wejść do systemu w modelu mieszanym i czeka na decyzję admina.",
  },
];

function getAdminApp(projectId, refreshTokenValue) {
  const existing = getApps().find((app) => app.name === "seed-demo-network");
  if (existing) {
    return existing;
  }

  return initializeApp(
    {
      credential: refreshToken({
        type: "authorized_user",
        client_id: FIREBASE_CLI_CLIENT_ID,
        client_secret: FIREBASE_CLI_CLIENT_SECRET,
        refresh_token: refreshTokenValue,
      }),
      projectId,
    },
    "seed-demo-network",
  );
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
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

async function loadFirebaseToolsConfig() {
  return readJson(FIREBASE_TOOLS_PATH);
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

async function refreshFirebaseToolsAccessToken(firebaseToolsConfig) {
  const refreshTokenValue = firebaseToolsConfig?.tokens?.refresh_token;

  if (!refreshTokenValue) {
    throw new Error("Missing Firebase CLI refresh token.");
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshTokenValue,
      client_id: FIREBASE_CLI_CLIENT_ID,
      client_secret: FIREBASE_CLI_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok || !json?.access_token) {
    const message = json?.error_description ?? json?.error ?? response.statusText;
    throw new Error(`Failed to refresh Firebase CLI access token: ${message}`);
  }

  return json.access_token;
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

async function ensureAuthUser(auth, email, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    const updated = await auth.updateUser(existing.uid, {
      email,
      password: PASSWORD,
      displayName,
    });
    return updated.uid;
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const created = await auth.createUser({
    email,
    password: PASSWORD,
    displayName,
  });
  return created.uid;
}

function isoDate(baseDayOffset, hour) {
  const date = new Date(Date.UTC(2026, 2, 15 + baseDayOffset, hour, 0, 0, 0));
  return date.toISOString();
}

function makeSchedule(dayOffset) {
  return [
    {
      startsAt: isoDate(dayOffset, 9),
      endsAt: isoDate(dayOffset, 16),
    },
    {
      startsAt: isoDate(dayOffset + 1, 9),
      endsAt: isoDate(dayOffset + 1, 16),
    },
  ];
}

function buildEventDoc({
  id,
  trainer,
  organizer,
  sequence,
  collaborationMode,
  createdByRole,
}) {
  const scheduleDays = makeSchedule(sequence * 4);
  const startsAt = scheduleDays[0].startsAt;
  const endsAt = scheduleDays[scheduleDays.length - 1].endsAt;
  const accepted = collaborationMode === "accepted";
  const rejected = collaborationMode === "rejected";

  return {
    id,
    trainerId: trainer.id,
    organizerId: organizer.id,
    trainerUserId: trainer.userId,
    organizerUserId: organizer.userId,
    title: `${trainer.displayName} x ${organizer.displayName} #${sequence + 1}`,
    summary: accepted
      ? "Gotowe wydarzenie z pełną akceptacją obu stron."
      : rejected
        ? "Wydarzenie zatrzymane na etapie akceptacji."
        : "Wydarzenie czeka jeszcze na pełną akceptację.",
    description: `${trainer.displayName} i ${organizer.displayName} mają przygotowany scenariusz wydarzenia demo do testowania panelu.`,
    type: accepted ? "Warsztat" : "Spotkanie",
    startsAt,
    endsAt,
    scheduleDays,
    location: `${organizer.city} / ${trainer.city}`,
    tags: accepted ? ["demo", "zaakceptowane"] : rejected ? ["demo", "odrzucone"] : ["demo", "oczekuje"],
    capacity: 18 + sequence,
    enrolledCount: accepted ? 5 + sequence : 0,
    isPublished: accepted,
    imageHint: accepted ? "approved" : rejected ? "rejected" : "pending",
    brandStatus: "official",
    status: accepted ? "confirmed" : "active",
    minimumParticipants: 8,
    requiresOrganizerApproval: true,
    trainerCollaborationStatus:
      createdByRole === "trainer"
        ? "accepted"
        : rejected
          ? "rejected"
          : accepted
            ? "accepted"
            : "pending",
    organizerCollaborationStatus:
      createdByRole === "organizer"
        ? "accepted"
        : rejected
          ? "rejected"
          : accepted
            ? "accepted"
            : "pending",
    selfManagedByTrainer: false,
    createdByRole,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function seedCandidateOrganizers(projectId, accessToken, auth) {
  const results = [];

  for (const [index, organizer] of candidateOrganizers.entries()) {
    const authUid = await ensureAuthUser(auth, organizer.email, organizer.displayName);
    const seededAt = new Date().toISOString();

    await auth.setCustomUserClaims(authUid, { admin: false });

    await writeFirestoreDocument(projectId, accessToken, "users", authUid, {
      id: authUid,
      role: "organizer",
      roles: ["organizer"],
      primaryRole: "organizer",
      displayName: organizer.displayName,
      email: organizer.email,
      phone: organizer.phone,
      avatarUrl: `https://i.pravatar.cc/320?img=${40 + index}`,
      status: "active",
      trainerProfileId: null,
      organizerProfileId: organizer.id,
      seededFromDemo: true,
      seededAt,
      source: "scripts/seed-demo-network-and-events.mjs",
    });

    await writeFirestoreDocument(projectId, accessToken, "organizers", organizer.id, {
      id: organizer.id,
      userId: authUid,
      displayName: organizer.displayName,
      description: organizer.description,
      isVisible: true,
      contactName: organizer.displayName,
      location: organizer.city,
      seededAt,
      source: "scripts/seed-demo-network-and-events.mjs",
    });

    results.push({ ...organizer, userId: authUid });
  }

  return results;
}

async function main() {
  const env = await loadEnvFile(DOTENV_PATH);
  const projectId = env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("Missing VITE_FIREBASE_PROJECT_ID in .env.local.");
  }

  const firebaseToolsConfig = await loadFirebaseToolsConfig();
  const refreshTokenValue = firebaseToolsConfig?.tokens?.refresh_token;
  const accessToken = await refreshFirebaseToolsAccessToken(firebaseToolsConfig);

  if (!refreshTokenValue) {
    throw new Error("Missing Firebase CLI refresh token.");
  }

  const adminApp = getAdminApp(projectId, refreshTokenValue);
  const auth = getAuth(adminApp);

  for (const trainer of trainers) {
    trainer.userId = (await auth.getUserByEmail(trainer.email)).uid;
  }

  for (const organizer of organizers) {
    organizer.userId = (await auth.getUserByEmail(organizer.email)).uid;
  }

  const seededCandidates = await seedCandidateOrganizers(projectId, accessToken, auth);
  const seededAt = new Date().toISOString();

  for (const [index, trainer] of trainers.entries()) {
    const approvedOrganizer = organizers[index % organizers.length];
    const pendingOrganizer = organizers[(index + 1) % organizers.length];
    const rejectedOrganizer = organizers[(index + 2) % organizers.length];

    await writeFirestoreDocument(
      projectId,
      accessToken,
      "trainerOrganizerRelations",
      `${trainer.id}__${approvedOrganizer.id}`,
      {
        id: `${trainer.id}__${approvedOrganizer.id}`,
        trainerId: trainer.id,
        organizerId: approvedOrganizer.id,
        trainerUserId: trainer.userId,
        organizerUserId: approvedOrganizer.userId,
        status: "approved",
        requestedBy: index % 2 === 0 ? "organizer" : "trainer",
        createdAt: seededAt,
      },
    );

    await writeFirestoreDocument(
      projectId,
      accessToken,
      "trainerOrganizerRelations",
      `${trainer.id}__${pendingOrganizer.id}`,
      {
        id: `${trainer.id}__${pendingOrganizer.id}`,
        trainerId: trainer.id,
        organizerId: pendingOrganizer.id,
        trainerUserId: trainer.userId,
        organizerUserId: pendingOrganizer.userId,
        status: "pending",
        requestedBy: index % 2 === 0 ? "organizer" : "trainer",
        createdAt: seededAt,
      },
    );

    await writeFirestoreDocument(
      projectId,
      accessToken,
      "trainerOrganizerRelations",
      `${trainer.id}__${rejectedOrganizer.id}`,
      {
        id: `${trainer.id}__${rejectedOrganizer.id}`,
        trainerId: trainer.id,
        organizerId: rejectedOrganizer.id,
        trainerUserId: trainer.userId,
        organizerUserId: rejectedOrganizer.userId,
        status: "rejected",
        requestedBy: index % 2 === 0 ? "trainer" : "organizer",
        createdAt: seededAt,
      },
    );

    const acceptedEvent = buildEventDoc({
      id: `event-demo-${trainer.id}-accepted`,
      trainer,
      organizer: approvedOrganizer,
      sequence: index * 2,
      collaborationMode: "accepted",
      createdByRole: index % 2 === 0 ? "organizer" : "trainer",
    });

    const reviewEvent = buildEventDoc({
      id: `event-demo-${trainer.id}-review`,
      trainer,
      organizer: approvedOrganizer,
      sequence: index * 2 + 1,
      collaborationMode: index % 3 === 0 ? "rejected" : "pending",
      createdByRole: index % 2 === 0 ? "trainer" : "organizer",
    });

    await writeFirestoreDocument(projectId, accessToken, "trainingEvents", acceptedEvent.id, acceptedEvent);
    await writeFirestoreDocument(projectId, accessToken, "trainingEvents", reviewEvent.id, reviewEvent);
  }

  for (const [index, organizer] of seededCandidates.entries()) {
    const trainer = trainers[index % trainers.length];
    await writeFirestoreDocument(
      projectId,
      accessToken,
      "trainerOrganizerRelations",
      `${trainer.id}__${organizer.id}`,
      {
        id: `${trainer.id}__${organizer.id}`,
        trainerId: trainer.id,
        organizerId: organizer.id,
        trainerUserId: trainer.userId,
        organizerUserId: organizer.userId,
        status: "pending",
        requestedBy: "organizer",
        createdAt: seededAt,
      },
    );
  }

  for (const request of pendingAccountRequests) {
    await writeFirestoreDocument(projectId, accessToken, "accountRequests", request.id, {
      ...request,
      emailLowercase: request.email.toLowerCase(),
      status: "pending",
      submitterUid: null,
      reviewedAt: null,
      reviewedByUserId: null,
      createdAt: seededAt,
    });
  }

  console.log(
    `Seeded ${trainers.length * 3 + seededCandidates.length} relations, ${trainers.length * 2} events, ${pendingAccountRequests.length} account requests.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
