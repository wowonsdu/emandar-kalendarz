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
const DOTENV_PATHS = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env.production"),
];
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";
const MARCIN_PUBLIC_ICAL_URL =
  "https://panel.ceo/emandar/demo-ical/marcin-free-slots-demo.ics";

const trainers = [
  { id: "trainer-11", displayName: "Dariusz", email: "dariusz@emandar.pl", phone: "+48 601 100 100", city: "Warszawa" },
  { id: "trainer-1", displayName: "Jacek", email: "jacek@emandar.pl", phone: "+48 601 100 101", city: "Warszawa" },
  { id: "trainer-2", displayName: "Marcin", email: "marcin@emandar.pl", phone: "+48 601 100 102", city: "Kraków" },
  { id: "trainer-10", displayName: "Dorota", email: "dorota@emandar.pl", phone: "+48 601 909 808", city: "Lublin" },
  { id: "trainer-4", displayName: "Asia", email: "asia@emandar.pl", phone: "+48 601 100 104", city: "Wrocław" },
  { id: "trainer-5", displayName: "Krzysiu", email: "krzysiu@emandar.pl", phone: "+48 601 100 105", city: "Poznań" },
  { id: "trainer-6", displayName: "Klaudia", email: "klaudia@emandar.pl", phone: "+48 601 100 106", city: "Gdańsk" },
  { id: "trainer-3", displayName: "Beata", email: "beata@emandar.pl", phone: "+48 601 100 103", city: "Łódź" },
];

const organizers = [
  { id: "organizer-karolina", displayName: "Karolina", email: "karolina@emandar.pl", phone: "+48 602 100 201", city: "Warszawa" },
  { id: "organizer-marek", displayName: "Marek", email: "marek@emandar.pl", phone: "+48 602 100 202", city: "Kraków" },
  { id: "organizer-demo", displayName: "Organizator Demo", email: "organizator-demo@emandar.pl", phone: "+48 602 100 203", city: "Online" },
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

const participantAccounts = [
  {
    displayName: "Grzegorz Emanowicz",
    email: "grzegorz.emanowicz@emandar.pl",
    phone: "+48 605 100 301",
  },
  {
    displayName: "Grzegorz Chotnicki",
    email: "grzegorz.chotnicki@emandar.pl",
    phone: "+48 605 100 302",
  },
  {
    displayName: "Ola Chotnicka",
    email: "ola.chotnicka@emandar.pl",
    phone: "+48 605 100 303",
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

async function loadEnvFromCandidates() {
  const merged = {};

  for (const filePath of DOTENV_PATHS) {
    Object.assign(merged, await loadEnvFile(filePath));
  }

  return merged;
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

function getFutureEventCount(trainerIndex) {
  return 5 + (trainerIndex % 6);
}

function makeFutureSchedule(dayOffset, durationDays = 2) {
  return Array.from({ length: durationDays }, (_, index) => ({
    startsAt: isoDate(dayOffset + index, 10),
    endsAt: isoDate(dayOffset + index, 17),
  }));
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

function buildFutureTrainingEventDoc({
  id,
  trainer,
  organizer,
  trainerIndex,
  eventIndex,
}) {
  const startOffset = 21 + trainerIndex * 28 + eventIndex * 9;
  const durationDays = eventIndex % 3 === 2 ? 3 : 2;
  const scheduleDays = makeFutureSchedule(startOffset, durationDays);
  const startsAt = scheduleDays[0].startsAt;
  const endsAt = scheduleDays[scheduleDays.length - 1].endsAt;
  const trainingTypes = [
    "Warsztat",
    "Warsztat weekendowy",
    "Spotkanie grupowe",
    "Intensyw",
  ];

  return {
    id,
    trainerId: trainer.id,
    organizerId: organizer.id,
    trainerUserId: trainer.userId,
    organizerUserId: organizer.userId,
    title: `${trainer.displayName} | grupa ${eventIndex + 1}`,
    summary: `Przyszły termin ${trainer.displayName} przygotowany do testowania publicznego kalendarza i zgłoszeń.`,
    description: `${trainer.displayName} prowadzi kolejne wydarzenie seedowane w przyszłym terminie. Rekord służy do testowania publicznego kalendarza, profilu trenera oraz zapisów uczestników.`,
    type: trainingTypes[eventIndex % trainingTypes.length],
    startsAt,
    endsAt,
    scheduleDays,
    location: `${organizer.city} / ${trainer.city}`,
    tags: ["seed", "przyszłe", trainer.slug ?? trainer.displayName.toLowerCase()],
    capacity: 14 + ((trainerIndex + eventIndex) % 8),
    enrolledCount: 0,
    isPublished: true,
    imageHint: "future-seed",
    brandStatus: "official",
    status: "confirmed",
    minimumParticipants: 6 + (eventIndex % 4),
    requiresOrganizerApproval: true,
    trainerCollaborationStatus: "accepted",
    organizerCollaborationStatus: "accepted",
    selfManagedByTrainer: false,
    createdByRole: eventIndex % 2 === 0 ? "trainer" : "organizer",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildParticipantEventDoc({
  id,
  trainer,
  organizer,
  title,
  summary,
  type,
  dayOffset,
  status = "confirmed",
  archivedAt = null,
  enrolledCount = 0,
  capacity = 16,
}) {
  const scheduleDays = makeSchedule(dayOffset);
  return {
    id,
    trainerId: trainer.id,
    organizerId: organizer?.id ?? null,
    trainerUserId: trainer.userId,
    organizerUserId: organizer?.userId ?? null,
    title,
    summary,
    description: `${title} przygotowane do testowania panelu uczestnika.`,
    type,
    startsAt: scheduleDays[0].startsAt,
    endsAt: scheduleDays[scheduleDays.length - 1].endsAt,
    scheduleDays,
    location: organizer ? `${organizer.city} / ${trainer.city}` : trainer.city,
    tags: ["participant-demo"],
    capacity,
    enrolledCount,
    isPublished: true,
    imageHint: "participant-demo",
    brandStatus: "official",
    status,
    minimumParticipants: 6,
    requiresOrganizerApproval: Boolean(organizer),
    trainerCollaborationStatus: "accepted",
    organizerCollaborationStatus: organizer ? "accepted" : "not-required",
    selfManagedByTrainer: !organizer,
    createdByRole: organizer ? "organizer" : "trainer",
    archivedAt,
    archivedReason: archivedAt ? "manual" : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildParticipantEnrollmentDoc({
  id,
  event,
  trainer,
  organizer,
  participant,
  finalStatus,
  participantStatus = "active",
  createdAt,
}) {
  return {
    id,
    eventId: event.id,
    trainerId: trainer.id,
    organizerId: organizer?.id ?? null,
    submitterUid: participant.userId,
    trainerUserId: trainer.userId,
    organizerUserId: organizer?.userId ?? null,
    trainerContactPhone: trainer.phone ?? "+48 601 000 000",
    trainerContactEmail: trainer.email,
    organizerContactPhone: organizer?.phone ?? "+48 602 000 000",
    organizerContactEmail: organizer?.email ?? null,
    organizerContactName: organizer?.displayName ?? null,
    imieNazwisko: participant.displayName,
    telefon: participant.phone,
    polecenieOdKogo: "Demo panelu uczestnika",
    wiadomosc: "Scenariusz seedowany do testowania panelu uczestnika.",
    photoStatus: "ready",
    trainerDecision:
      finalStatus === "accepted" || finalStatus === "partial" ? "accepted" : "rejected",
    organizerDecision:
      organizer
        ? finalStatus === "accepted"
          ? "accepted"
          : finalStatus === "partial"
            ? "pending"
            : "rejected"
        : "pending",
    finalStatus,
    participantStatus,
    participantActionSource: participantStatus === "cancelled" ? "participant" : "staff",
    participantManagedAt: participantStatus === "cancelled" ? createdAt : null,
    attendanceConfirmationStatus: finalStatus === "accepted" ? "pending" : "not-required",
    requiresOrganizerApproval: Boolean(organizer),
    createdAt,
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

async function seedParticipantScenarios(projectId, accessToken, auth) {
  const seededParticipants = [];

  for (const participant of participantAccounts) {
    const userId = (await auth.getUserByEmail(participant.email)).uid;
    seededParticipants.push({ ...participant, userId });
  }

  const byEmail = new Map(seededParticipants.map((participant) => [participant.email, participant]));
  const grzegorzE = byEmail.get("grzegorz.emanowicz@emandar.pl");
  const grzegorzC = byEmail.get("grzegorz.chotnicki@emandar.pl");
  const ola = byEmail.get("ola.chotnicka@emandar.pl");

  if (!grzegorzE || !grzegorzC || !ola) {
    throw new Error("Missing seeded participant accounts.");
  }

  const eventMain = buildParticipantEventDoc({
    id: "participant-event-main",
    trainer: trainers[1],
    organizer: organizers[0],
    title: "Warsztat oddechowy Warszawa",
    summary: "Najbliższe szkolenie dla aktywnego uczestnika z pełnym kontaktem do zespołu.",
    type: "Warsztat stacjonarny",
    dayOffset: 5,
    enrolledCount: 2,
  });
  const eventTransferTarget = buildParticipantEventDoc({
    id: "participant-event-transfer-target",
    trainer: trainers[1],
    organizer: organizers[0],
    title: "Warsztat oddechowy Warszawa bis",
    summary: "Termin docelowy do testowania przeniesienia uczestnika.",
    type: "Warsztat stacjonarny",
    dayOffset: 13,
    status: "active",
    enrolledCount: 0,
    capacity: 18,
  });
  const eventPending = buildParticipantEventDoc({
    id: "participant-event-pending",
    trainer: trainers[3],
    organizer: organizers[2],
    title: "Regeneracja i uważność Lublin",
    summary: "Szkolenie oczekujące jeszcze na pełną akceptację zapisu.",
    type: "Warsztat weekendowy",
    dayOffset: 9,
    status: "active",
    enrolledCount: 0,
  });
  const eventPast = buildParticipantEventDoc({
    id: "participant-event-past",
    trainer: trainers[4],
    organizer: organizers[1],
    title: "Archiwalne szkolenie Wrocław",
    summary: "Przeszłe szkolenie do sekcji archiwum uczestnika.",
    type: "Warsztat stacjonarny",
    dayOffset: -10,
    enrolledCount: 1,
    archivedAt: "2026-03-12T08:00:00.000Z",
  });
  const eventTransferSource = buildParticipantEventDoc({
    id: "participant-event-transfer-source",
    trainer: trainers[1],
    organizer: organizers[0],
    title: "Warsztat oddechowy Kraków grupa A",
    summary: "Aktywny zapis przeznaczony do testu przeniesienia.",
    type: "Warsztat stacjonarny",
    dayOffset: 7,
    enrolledCount: 1,
  });

  const participantEvents = [
    eventMain,
    eventTransferTarget,
    eventPending,
    eventPast,
    eventTransferSource,
  ];

  for (const event of participantEvents) {
    await writeFirestoreDocument(projectId, accessToken, "trainingEvents", event.id, event);
  }

  const participantEnrollments = [
    buildParticipantEnrollmentDoc({
      id: "participant-enrollment-grzegorz-accepted",
      event: eventMain,
      trainer: trainers[1],
      organizer: organizers[0],
      participant: grzegorzE,
      finalStatus: "accepted",
      createdAt: "2026-03-16T08:00:00.000Z",
    }),
    buildParticipantEnrollmentDoc({
      id: "participant-enrollment-grzegorz-pending",
      event: eventPending,
      trainer: trainers[3],
      organizer: organizers[2],
      participant: grzegorzE,
      finalStatus: "partial",
      createdAt: "2026-03-16T09:00:00.000Z",
    }),
    buildParticipantEnrollmentDoc({
      id: "participant-enrollment-grzegorz-archived",
      event: eventPast,
      trainer: trainers[4],
      organizer: organizers[1],
      participant: grzegorzE,
      finalStatus: "accepted",
      participantStatus: "cancelled",
      createdAt: "2026-03-10T09:00:00.000Z",
    }),
    buildParticipantEnrollmentDoc({
      id: "participant-enrollment-grzegorz-transfer",
      event: eventTransferSource,
      trainer: trainers[1],
      organizer: organizers[0],
      participant: grzegorzC,
      finalStatus: "accepted",
      createdAt: "2026-03-16T10:00:00.000Z",
    }),
    buildParticipantEnrollmentDoc({
      id: "participant-enrollment-ola-archived",
      event: eventPast,
      trainer: trainers[4],
      organizer: organizers[1],
      participant: ola,
      finalStatus: "accepted",
      createdAt: "2026-03-08T09:00:00.000Z",
    }),
  ];

  for (const enrollment of participantEnrollments) {
    await writeFirestoreDocument(
      projectId,
      accessToken,
      "enrollmentRequests",
      enrollment.id,
      enrollment,
    );
  }

  return {
    participants: seededParticipants.length,
    events: participantEvents.length,
    enrollments: participantEnrollments.length,
  };
}

async function main() {
  const env = await loadEnvFromCandidates();
  const projectId = env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("Missing VITE_FIREBASE_PROJECT_ID in .env.local or .env.production.");
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
  const participantSeed = await seedParticipantScenarios(projectId, accessToken, auth);
  const seededAt = new Date().toISOString();
  let seededFutureTrainerEvents = 0;

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

    const futureEventCount = getFutureEventCount(index);

    for (let eventIndex = 0; eventIndex < futureEventCount; eventIndex += 1) {
      const futureEvent = buildFutureTrainingEventDoc({
        id: `event-seed-${trainer.id}-future-${eventIndex + 1}`,
        trainer,
        organizer: approvedOrganizer,
        trainerIndex: index,
        eventIndex,
      });

      await writeFirestoreDocument(
        projectId,
        accessToken,
        "trainingEvents",
        futureEvent.id,
        futureEvent,
      );
      seededFutureTrainerEvents += 1;
    }

    if (trainer.id === "trainer-2") {
      await writeFirestoreDocument(
        projectId,
        accessToken,
        "trainerCalendarFeeds",
        "trainer-2-google-public",
        {
          id: "trainer-2-google-public",
          trainerId: trainer.id,
          trainerUserId: trainer.userId,
          provider: "ical",
          url: MARCIN_PUBLIC_ICAL_URL,
          enabled: true,
          lastSyncStatus: "idle",
          createdAt: seededAt,
          updatedAt: seededAt,
          source: "scripts/seed-demo-network-and-events.mjs",
        },
      );
    }
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
    `Seeded ${trainers.length * 3 + seededCandidates.length} relations, ${trainers.length * 2 + seededFutureTrainerEvents + participantSeed.events} events, ${participantSeed.enrollments} participant enrollments and ${pendingAccountRequests.length} account requests.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
