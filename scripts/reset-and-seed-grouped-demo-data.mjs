import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { initializeApp } from "firebase/app";
import {
  inMemoryPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const ROOT = process.cwd();
const SCRIPT_NAME = "scripts/reset-and-seed-grouped-demo-data.mjs";
const DOTENV_PATHS = [
  resolve(ROOT, ".env.local"),
  resolve(ROOT, ".env.production"),
];
const DEMO_LOGIN = {
  email: "organizator-demo@emandar.pl",
  password: "kocham",
};
const RESET_COLLECTIONS = [
  "groups",
  "groupMembers",
  "participantProfiles",
  "eventParticipants",
  "trainerOrganizerRelations",
  "availabilitySlots",
  "trainerSharedSlots",
  "trainerCalendarFeeds",
  "organizerCalendarFeeds",
  "organizerExternalBusyMonths",
  "trainerOrganizerCalendarFeeds",
  "trainerExternalBusyMonths",
  "notifications",
  "smsDispatches",
];

const TRAINERS = [
  { id: "trainer-1", displayName: "Jacek", email: "jacek@emandar.pl", phone: "+48 601 100 101" },
  { id: "trainer-2", displayName: "Marcin", email: "marcin@emandar.pl", phone: "+48 601 100 102" },
  { id: "trainer-10", displayName: "Dorota", email: "dorota@emandar.pl", phone: "+48 601 909 808" },
];

const ORGANIZERS = [
  {
    id: "organizer-karolina",
    displayName: "Karolina",
    email: "karolina@emandar.pl",
    phone: "+48 602 100 201",
  },
  {
    id: "organizer-marek",
    displayName: "Marek",
    email: "marek@emandar.pl",
    phone: "+48 602 100 202",
  },
  {
    id: "organizer-demo",
    displayName: "Organizator Demo",
    email: "organizator-demo@emandar.pl",
    phone: "+48 602 100 203",
  },
];

const PARTICIPANTS = [
  {
    key: "grzegorz-e",
    displayName: "Grzegorz Emanowicz",
    email: "grzegorz.emanowicz@emandar.pl",
    phone: "+48 605 100 301",
  },
  {
    key: "grzegorz-c",
    displayName: "Grzegorz Chotnicki",
    email: "grzegorz.chotnicki@emandar.pl",
    phone: "+48 605 100 302",
  },
  {
    key: "ola",
    displayName: "Ola Chotnicka",
    email: "ola.chotnicka@emandar.pl",
    phone: "+48 605 100 303",
  },
];

function normalizePhoneLookupKey(phoneNumber) {
  const digits = String(phoneNumber ?? "").replace(/\D+/g, "");
  if (!digits) {
    throw new Error(`Invalid phone number: ${String(phoneNumber)}`);
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits;
}

function buildParticipantProfileId(phoneNumber) {
  return `participant-${normalizePhoneLookupKey(phoneNumber)}`;
}

function buildGroupMemberId(groupId, participantProfileId) {
  return `${groupId}__${participantProfileId}`;
}

function buildEventParticipantId(eventId, participantProfileId) {
  return `${eventId}__${participantProfileId}`;
}

function relationId(trainerId, organizerId) {
  return `${trainerId}__${organizerId}`;
}

function slotId(trainerId, suffix) {
  return `shared-slot__${trainerId}__${suffix}`;
}

function availabilitySlotId(trainerId, suffix) {
  return `availability-slot__${trainerId}__${suffix}`;
}

function nowIso() {
  return new Date().toISOString();
}

function buildTimeWindow(dayOffset, hour, minute, durationMinutes) {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + dayOffset);
  startsAt.setHours(hour, minute, 0, 0);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
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

        return [
          line.slice(0, separatorIndex).trim(),
          line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, ""),
        ];
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

async function findUserByEmail(db, email) {
  const snapshot = await getDocs(
    query(collection(db, "users"), where("email", "==", email), limit(1)),
  );

  if (snapshot.empty) {
    throw new Error(`Missing user doc for ${email}. Run npm run demo:seed first.`);
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  };
}

async function requireProfileDoc(db, collectionName, id, label) {
  const snapshot = await getDoc(doc(db, collectionName, id));
  if (!snapshot.exists()) {
    throw new Error(`Missing ${label} doc ${id}. Run npm run demo:seed first.`);
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

async function listCollectionDocs(db, collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  }));
}

async function clearDocs(db, refs, dryRun) {
  if (refs.length === 0) {
    return;
  }

  if (dryRun) {
    return;
  }

  for (let index = 0; index < refs.length; index += 400) {
    const batch = writeBatch(db);
    refs.slice(index, index + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function upsertDocs(db, collectionName, documents, dryRun) {
  if (documents.length === 0 || dryRun) {
    return;
  }

  for (let index = 0; index < documents.length; index += 400) {
    const batch = writeBatch(db);
    documents.slice(index, index + 400).forEach((item) => {
      batch.set(doc(db, collectionName, item.id), item);
    });
    await batch.commit();
  }
}

function buildRelationDoc({ trainer, organizer, status, requestedBy, seededAt }) {
  return {
    id: relationId(trainer.id, organizer.id),
    trainerId: trainer.id,
    organizerId: organizer.id,
    trainerUserId: trainer.userId,
    organizerUserId: organizer.userId,
    status,
    requestedBy,
    createdAt: seededAt,
    seededAt,
    source: SCRIPT_NAME,
  };
}

function buildSlotDoc({ id, trainer, dayOffset, hour, minute, durationMinutes, location, notes, seededAt }) {
  const window = buildTimeWindow(dayOffset, hour, minute, durationMinutes);
  return {
    id,
    trainerId: trainer.id,
    trainerUserId: trainer.userId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    location,
    notes,
    visibility: "approved-organizers",
    source: "manual",
    status: "active",
    createdAt: seededAt,
    updatedAt: seededAt,
    seededAt,
    seedSource: SCRIPT_NAME,
  };
}

function buildAvailabilityDoc({ id, trainer, organizerId, startsAt, endsAt, location, notes, seededAt }) {
  return {
    id,
    trainerId: trainer.id,
    trainerUserId: trainer.userId,
    startsAt,
    endsAt,
    location,
    notes,
    visibility: "approved-organizers",
    visibleToOrganizerIds: organizerId ? [organizerId] : [],
    seededAt,
    source: SCRIPT_NAME,
  };
}

function buildGroupDoc({
  id,
  name,
  trainer,
  organizer,
  defaultLocation,
  defaultCapacity,
  defaultConfirmationLeadTimeDays,
  notes,
  seededAt,
}) {
  return {
    id,
    name,
    organizerId: organizer.id,
    organizerUserId: organizer.userId,
    trainerId: trainer.id,
    trainerUserId: trainer.userId,
    status: "active",
    notes,
    defaultLocation,
    defaultEventType: "training",
    defaultCapacity,
    defaultTags: ["demo", "grupa"],
    defaultConfirmationLeadTimeDays,
    createdAt: seededAt,
    updatedAt: seededAt,
    seededAt,
    source: SCRIPT_NAME,
  };
}

function buildParticipantProfileDoc({
  displayName,
  email,
  phone,
  linkedUserId,
  confirmationStatus,
  groupIds,
  organizerIds,
  organizerUserIds,
  trainerIds,
  trainerUserIds,
  createdByOrganizerId,
  createdByUserId,
  notes,
  seededAt,
}) {
  const [firstName, ...rest] = displayName.split(/\s+/);

  return {
    id: buildParticipantProfileId(phone),
    linkedUserId: linkedUserId ?? null,
    displayName,
    firstName,
    lastName: rest.join(" "),
    phone,
    phoneLookupKey: normalizePhoneLookupKey(phone),
    email: email ?? null,
    notes,
    referralSource: "demo-seed",
    confirmationStatus,
    status: "active",
    managerOrganizerIds: organizerIds,
    managerOrganizerUserIds: organizerUserIds,
    managerTrainerIds: trainerIds,
    managerTrainerUserIds: trainerUserIds,
    groupIds,
    activeGroupIds: groupIds,
    createdAt: seededAt,
    updatedAt: seededAt,
    createdByOrganizerId: createdByOrganizerId ?? null,
    createdByUserId: createdByUserId ?? null,
    confirmedAt: confirmationStatus === "confirmed" ? seededAt : null,
    seededAt,
    source: SCRIPT_NAME,
  };
}

function buildGroupMemberDoc({
  group,
  trainer,
  organizer,
  participantProfile,
  participantUserId,
  priority,
  notes,
  seededAt,
}) {
  return {
    id: buildGroupMemberId(group.id, participantProfile.id),
    groupId: group.id,
    organizerId: organizer.id,
    organizerUserId: organizer.userId,
    trainerId: trainer.id,
    trainerUserId: trainer.userId,
    participantProfileId: participantProfile.id,
    participantUserId: participantUserId ?? null,
    participantDisplayName: participantProfile.displayName,
    participantPhone: participantProfile.phone,
    priority,
    membershipStatus: "active",
    notes,
    joinedAt: seededAt,
    updatedAt: seededAt,
    removedAt: null,
    seededAt,
    source: SCRIPT_NAME,
  };
}

function buildTrainingEventDoc({
  id,
  slot,
  group,
  trainer,
  organizer,
  title,
  summary,
  description,
  location,
  capacity,
  enrolledCount,
  status,
  workflowStatus,
  isPublished,
  trainerCollaborationStatus,
  organizerCollaborationStatus,
  eligibleGroupPriorities,
  confirmationLeadTimeDays,
  rosterFinalizedAt,
  minimumParticipants,
  eventTypeSystem = "training",
  tags = ["demo", "grupa"],
  seededAt,
}) {
  return {
    id,
    trainerId: trainer.id,
    organizerId: organizer.id,
    groupId: group.id,
    groupName: group.name,
    trainerUserId: trainer.userId,
    organizerUserId: organizer.userId,
    creatorUserId: organizer.userId,
    creatorDisplayName: organizer.displayName,
    creatorAvatarUrl: null,
    creatorPhone: organizer.phone,
    title,
    summary,
    description,
    type: eventTypeSystem === "post" ? "Post grupowy" : "Szkolenie grupowe",
    eventTypeSystem,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    scheduleDays: [{ startsAt: slot.startsAt, endsAt: slot.endsAt }],
    location,
    tags,
    capacity,
    enrolledCount,
    isPublished,
    imageHint: "grupa demo",
    brandStatus: "official",
    status,
    workflowStatus,
    sharedSlotId: slot.id,
    publishAutomaticallyAfterTrainerApproval: true,
    minimumParticipants,
    requiresOrganizerApproval: true,
    eligibleGroupPriorities,
    confirmationLeadTimeDays,
    trainerCollaborationStatus,
    organizerCollaborationStatus,
    selfManagedByTrainer: false,
    createdByRole: "organizer",
    trainerDecidedAt: trainerCollaborationStatus === "accepted" ? seededAt : null,
    trainerDecidedByUserId: trainerCollaborationStatus === "accepted" ? trainer.userId : null,
    trainerDecisionReason: null,
    rosterFinalizedAt: rosterFinalizedAt ?? null,
    rosterFinalizedByUserId: rosterFinalizedAt ? organizer.userId : null,
    archivedAt: null,
    archivedByRole: null,
    archivedReason: null,
    archivedForOrganizerId: null,
    enrollmentPhotoRequirement: "default",
    seededAt,
    source: SCRIPT_NAME,
  };
}

function buildEventParticipantDoc({
  event,
  participantProfile,
  priority,
  status,
  source,
  attendanceStatus,
  participantUserId,
  seededAt,
}) {
  return {
    id: buildEventParticipantId(event.id, participantProfile.id),
    eventId: event.id,
    eventTitle: event.title,
    groupId: event.groupId,
    groupName: event.groupName,
    organizerId: event.organizerId,
    organizerUserId: event.organizerUserId,
    trainerId: event.trainerId,
    trainerUserId: event.trainerUserId,
    participantProfileId: participantProfile.id,
    participantDisplayName: participantProfile.displayName,
    participantPhone: participantProfile.phone,
    participantUserId: participantUserId ?? null,
    priority,
    status,
    source,
    overCapacity: false,
    invitedAt: seededAt,
    attendanceConfirmationStatus: attendanceStatus,
    attendanceConfirmationRequestedAt:
      attendanceStatus === "pending" || attendanceStatus === "confirmed" ? seededAt : null,
    attendanceConfirmationRespondedAt:
      attendanceStatus === "confirmed" ? seededAt : null,
    attendanceConfirmationExpiresAt:
      attendanceStatus === "pending" ? event.startsAt : null,
    confirmedAt: status === "confirmed" ? seededAt : null,
    declinedAt: status === "declined" ? seededAt : null,
    removedAt: status === "removed" ? seededAt : null,
    updatedAt: seededAt,
    seededAt,
    seedSource: SCRIPT_NAME,
  };
}

function buildEnrollmentRequestDoc({
  id,
  event,
  trainer,
  organizer,
  participantProfileId,
  eventParticipantId,
  name,
  phone,
  referral,
  message,
  trainerDecision,
  organizerDecision,
  finalStatus,
  participantStatus,
  attendanceStatus,
  seededAt,
}) {
  return {
    id,
    eventId: event.id,
    trainerId: trainer.id,
    organizerId: organizer.id,
    submitterUid: null,
    participantProfileId: participantProfileId ?? null,
    eventParticipantId: eventParticipantId ?? null,
    normalizedPhone: normalizePhoneLookupKey(phone),
    trainerUserId: trainer.userId,
    organizerUserId: organizer.userId,
    trainerContactName: trainer.displayName,
    trainerContactPhone: trainer.phone,
    trainerContactEmail: trainer.email,
    organizerContactPhone: organizer.phone,
    organizerContactEmail: organizer.email,
    organizerContactName: organizer.displayName,
    imieNazwisko: name,
    telefon: phone,
    polecenieOdKogo: referral,
    wiadomosc: message,
    photoStatus: "pending",
    trainerDecision,
    organizerDecision,
    finalStatus,
    participantStatus,
    participantManagedAt: participantStatus === "cancelled" ? seededAt : null,
    participantActionSource: participantStatus === "cancelled" ? "participant" : "staff",
    attendanceConfirmationStatus: attendanceStatus,
    requiresOrganizerApproval: true,
    createdAt: seededAt,
    seededAt,
    source: SCRIPT_NAME,
  };
}

async function purgeTrainingPrototypeData(db, dryRun) {
  const collectionDeletes = {};
  const refsToDelete = [];

  for (const collectionName of RESET_COLLECTIONS) {
    const documents = await listCollectionDocs(db, collectionName);
    collectionDeletes[collectionName] = documents.length;
    refsToDelete.push(...documents.map((item) => doc(db, collectionName, item.id)));
  }

  const trainingEvents = await listCollectionDocs(db, "trainingEvents");
  const officialEvents = trainingEvents.filter((event) => event.brandStatus !== "supported");
  const officialEventIds = new Set(officialEvents.map((event) => event.id));
  collectionDeletes.trainingEvents = officialEvents.length;
  refsToDelete.push(...officialEvents.map((event) => doc(db, "trainingEvents", event.id)));

  const enrollmentRequests = await listCollectionDocs(db, "enrollmentRequests");
  const officialRequests = enrollmentRequests.filter((request) =>
    officialEventIds.has(request.eventId),
  );
  collectionDeletes.enrollmentRequests = officialRequests.length;
  refsToDelete.push(
    ...officialRequests.map((request) => doc(db, "enrollmentRequests", request.id)),
  );

  console.log(
    JSON.stringify(
      {
        dryRun,
        deleteCount: refsToDelete.length,
        collectionDeletes,
      },
      null,
      2,
    ),
  );

  await clearDocs(db, refsToDelete, dryRun);
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const env = await loadEnvFromCandidates();
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw new Error("Missing Firebase config in .env.local or .env.production.");
  }

  const app = initializeApp(firebaseConfig, "reset-grouped-demo-data");
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  await signInWithEmailAndPassword(auth, DEMO_LOGIN.email, DEMO_LOGIN.password);
  const db = getFirestore(app);
  const seededAt = nowIso();

  try {
    await purgeTrainingPrototypeData(db, dryRun);

    const trainers = await Promise.all(
      TRAINERS.map(async (trainer) => {
        const user = await findUserByEmail(db, trainer.email);
        await requireProfileDoc(db, "trainers", trainer.id, "trainer profile");
        return {
          ...trainer,
          userId: user.id,
        };
      }),
    );
    const organizers = await Promise.all(
      ORGANIZERS.map(async (organizer) => {
        const user = await findUserByEmail(db, organizer.email);
        await requireProfileDoc(db, "organizers", organizer.id, "organizer profile");
        return {
          ...organizer,
          userId: user.id,
        };
      }),
    );
    const participants = await Promise.all(
      PARTICIPANTS.map(async (participant) => {
        const user = await findUserByEmail(db, participant.email);
        return {
          ...participant,
          userId: user.id,
        };
      }),
    );

    const trainersById = new Map(trainers.map((trainer) => [trainer.id, trainer]));
    const organizersById = new Map(organizers.map((organizer) => [organizer.id, organizer]));
    const participantsByKey = new Map(participants.map((participant) => [participant.key, participant]));

    const slots = [
      buildSlotDoc({
        id: slotId("trainer-1", "event-a"),
        trainer: trainersById.get("trainer-1"),
        dayOffset: 8,
        hour: 18,
        minute: 0,
        durationMinutes: 180,
        location: "Warszawa, ul. Pulawska 18",
        notes: "Termin pod finalizacje rosteru grupy Warszawa Oddech Core.",
        seededAt,
      }),
      buildSlotDoc({
        id: slotId("trainer-1", "event-b"),
        trainer: trainersById.get("trainer-1"),
        dayOffset: 31,
        hour: 18,
        minute: 0,
        durationMinutes: 180,
        location: "Warszawa, ul. Pulawska 18",
        notes: "Otwarte wydarzenie grupy z intake publicznym.",
        seededAt,
      }),
      buildSlotDoc({
        id: slotId("trainer-1", "draft-c"),
        trainer: trainersById.get("trainer-1"),
        dayOffset: 59,
        hour: 18,
        minute: 0,
        durationMinutes: 180,
        location: "Warszawa, ul. Pulawska 18",
        notes: "Draft do akceptacji przez trenera.",
        seededAt,
      }),
      buildSlotDoc({
        id: slotId("trainer-1", "free-d"),
        trainer: trainersById.get("trainer-1"),
        dayOffset: 87,
        hour: 18,
        minute: 0,
        durationMinutes: 180,
        location: "Warszawa, ul. Pulawska 18",
        notes: "Wolny slot do planowania rocznego.",
        seededAt,
      }),
      buildSlotDoc({
        id: slotId("trainer-2", "event-a"),
        trainer: trainersById.get("trainer-2"),
        dayOffset: 10,
        hour: 17,
        minute: 30,
        durationMinutes: 180,
        location: "Krakow, ul. Dietla 50",
        notes: "Otwarte wydarzenie grupy pracy z cialem.",
        seededAt,
      }),
      buildSlotDoc({
        id: slotId("trainer-2", "event-b"),
        trainer: trainersById.get("trainer-2"),
        dayOffset: 37,
        hour: 17,
        minute: 30,
        durationMinutes: 180,
        location: "Krakow, ul. Dietla 50",
        notes: "Finalizowany termin dla stalej grupy.",
        seededAt,
      }),
      buildSlotDoc({
        id: slotId("trainer-2", "free-c"),
        trainer: trainersById.get("trainer-2"),
        dayOffset: 65,
        hour: 17,
        minute: 30,
        durationMinutes: 180,
        location: "Krakow, ul. Dietla 50",
        notes: "Wolny slot do kolejnego planowania.",
        seededAt,
      }),
      buildSlotDoc({
        id: slotId("trainer-10", "event-a"),
        trainer: trainersById.get("trainer-10"),
        dayOffset: 14,
        hour: 19,
        minute: 0,
        durationMinutes: 150,
        location: "Online / Zoom",
        notes: "Post grupowy online.",
        seededAt,
      }),
      buildSlotDoc({
        id: slotId("trainer-10", "draft-b"),
        trainer: trainersById.get("trainer-10"),
        dayOffset: 45,
        hour: 19,
        minute: 0,
        durationMinutes: 150,
        location: "Online / Zoom",
        notes: "Draft kolejnego spotkania regeneracji.",
        seededAt,
      }),
      buildSlotDoc({
        id: slotId("trainer-10", "free-c"),
        trainer: trainersById.get("trainer-10"),
        dayOffset: 78,
        hour: 19,
        minute: 0,
        durationMinutes: 150,
        location: "Online / Zoom",
        notes: "Wolny slot do planowania rocznego.",
        seededAt,
      }),
    ];
    const slotsById = new Map(slots.map((slot) => [slot.id, slot]));

    const groups = [
      buildGroupDoc({
        id: "group-jacek-warszawa-core",
        name: "Warszawa Oddech Core",
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        defaultLocation: "Warszawa, ul. Pulawska 18",
        defaultCapacity: 12,
        defaultConfirmationLeadTimeDays: 3,
        notes: "Glowna grupa Karoliny z priorytetem dla stalego skladu.",
        seededAt,
      }),
      buildGroupDoc({
        id: "group-marcin-krakow-bodywork",
        name: "Krakow Praca z Cialem",
        trainer: trainersById.get("trainer-2"),
        organizer: organizersById.get("organizer-marek"),
        defaultLocation: "Krakow, ul. Dietla 50",
        defaultCapacity: 14,
        defaultConfirmationLeadTimeDays: 4,
        notes: "Grupa oparta o rytm mniej wiecej co 4-6 tygodni.",
        seededAt,
      }),
      buildGroupDoc({
        id: "group-dorota-online-regeneracja",
        name: "Online Regeneracja",
        trainer: trainersById.get("trainer-10"),
        organizer: organizersById.get("organizer-demo"),
        defaultLocation: "Online / Zoom",
        defaultCapacity: 18,
        defaultConfirmationLeadTimeDays: 2,
        notes: "Lekki cykl online dla spotkan typu training i post.",
        seededAt,
      }),
    ];
    const groupsById = new Map(groups.map((group) => [group.id, group]));

    const participantProfiles = [
      buildParticipantProfileDoc({
        displayName: participantsByKey.get("grzegorz-e").displayName,
        email: participantsByKey.get("grzegorz-e").email,
        phone: participantsByKey.get("grzegorz-e").phone,
        linkedUserId: participantsByKey.get("grzegorz-e").userId,
        confirmationStatus: "confirmed",
        groupIds: ["group-jacek-warszawa-core", "group-dorota-online-regeneracja"],
        organizerIds: ["organizer-karolina", "organizer-demo"],
        organizerUserIds: [
          organizersById.get("organizer-karolina").userId,
          organizersById.get("organizer-demo").userId,
        ],
        trainerIds: ["trainer-1", "trainer-10"],
        trainerUserIds: [
          trainersById.get("trainer-1").userId,
          trainersById.get("trainer-10").userId,
        ],
        createdByOrganizerId: "organizer-karolina",
        createdByUserId: organizersById.get("organizer-karolina").userId,
        notes: "Staly uczestnik kilku grup demonstracyjnych.",
        seededAt,
      }),
      buildParticipantProfileDoc({
        displayName: participantsByKey.get("grzegorz-c").displayName,
        email: participantsByKey.get("grzegorz-c").email,
        phone: participantsByKey.get("grzegorz-c").phone,
        linkedUserId: participantsByKey.get("grzegorz-c").userId,
        confirmationStatus: "confirmed",
        groupIds: ["group-jacek-warszawa-core"],
        organizerIds: ["organizer-karolina"],
        organizerUserIds: [organizersById.get("organizer-karolina").userId],
        trainerIds: ["trainer-1"],
        trainerUserIds: [trainersById.get("trainer-1").userId],
        createdByOrganizerId: "organizer-karolina",
        createdByUserId: organizersById.get("organizer-karolina").userId,
        notes: "Regularny uczestnik grupy warszawskiej.",
        seededAt,
      }),
      buildParticipantProfileDoc({
        displayName: participantsByKey.get("ola").displayName,
        email: participantsByKey.get("ola").email,
        phone: participantsByKey.get("ola").phone,
        linkedUserId: participantsByKey.get("ola").userId,
        confirmationStatus: "confirmed",
        groupIds: ["group-marcin-krakow-bodywork"],
        organizerIds: ["organizer-marek"],
        organizerUserIds: [organizersById.get("organizer-marek").userId],
        trainerIds: ["trainer-2"],
        trainerUserIds: [trainersById.get("trainer-2").userId],
        createdByOrganizerId: "organizer-marek",
        createdByUserId: organizersById.get("organizer-marek").userId,
        notes: "Stala uczestniczka krakowskiej grupy.",
        seededAt,
      }),
      buildParticipantProfileDoc({
        displayName: "Anna Rezerwowa",
        email: null,
        phone: "+48 605 100 304",
        linkedUserId: null,
        confirmationStatus: "unconfirmed",
        groupIds: [
          "group-jacek-warszawa-core",
          "group-marcin-krakow-bodywork",
          "group-dorota-online-regeneracja",
        ],
        organizerIds: ["organizer-karolina", "organizer-marek", "organizer-demo"],
        organizerUserIds: [
          organizersById.get("organizer-karolina").userId,
          organizersById.get("organizer-marek").userId,
          organizersById.get("organizer-demo").userId,
        ],
        trainerIds: ["trainer-1", "trainer-2", "trainer-10"],
        trainerUserIds: [
          trainersById.get("trainer-1").userId,
          trainersById.get("trainer-2").userId,
          trainersById.get("trainer-10").userId,
        ],
        createdByOrganizerId: "organizer-karolina",
        createdByUserId: organizersById.get("organizer-karolina").userId,
        notes: "Profil zalozony przez organizatora, jeszcze bez potwierdzenia SMS.",
        seededAt,
      }),
      buildParticipantProfileDoc({
        displayName: "Pawel Oczekujacy",
        email: null,
        phone: "+48 605 100 305",
        linkedUserId: null,
        confirmationStatus: "unconfirmed",
        groupIds: ["group-marcin-krakow-bodywork"],
        organizerIds: ["organizer-marek"],
        organizerUserIds: [organizersById.get("organizer-marek").userId],
        trainerIds: ["trainer-2"],
        trainerUserIds: [trainersById.get("trainer-2").userId],
        createdByOrganizerId: "organizer-marek",
        createdByUserId: organizersById.get("organizer-marek").userId,
        notes: "Nowa osoba z intake grupowego, jeszcze bez konta logowania.",
        seededAt,
      }),
    ];
    const participantProfilesById = new Map(
      participantProfiles.map((profile) => [profile.id, profile]),
    );

    const events = [
      buildTrainingEventDoc({
        id: "event-group-jacek-finalized",
        slot: slotsById.get(slotId("trainer-1", "event-a")),
        group: groupsById.get("group-jacek-warszawa-core"),
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        title: "Warszawa Oddech Core",
        summary: "Finalizowany sklad z potwierdzeniami uczestnikow i gotowym rosterem.",
        description: "Demo wydarzenia grupowego z zamknietym rosterem i aktywnymi statusami uczestnikow.",
        location: "Warszawa, ul. Pulawska 18",
        capacity: 12,
        enrolledCount: 2,
        status: "active",
        workflowStatus: "published",
        isPublished: true,
        trainerCollaborationStatus: "accepted",
        organizerCollaborationStatus: "accepted",
        eligibleGroupPriorities: ["stali", "regularni"],
        confirmationLeadTimeDays: 3,
        rosterFinalizedAt: seededAt,
        minimumParticipants: 6,
        seededAt,
      }),
      buildTrainingEventDoc({
        id: "event-group-jacek-intake",
        slot: slotsById.get(slotId("trainer-1", "event-b")),
        group: groupsById.get("group-jacek-warszawa-core"),
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        title: "Warszawa Oddech Core bis",
        summary: "Otwarte wydarzenie grupowe z dzialajacym intake publicznym i rosterem.",
        description: "Demo wydarzenia otwartego dla stalego skladu oraz osob z intake publicznego.",
        location: "Warszawa, ul. Pulawska 18",
        capacity: 12,
        enrolledCount: 2,
        status: "active",
        workflowStatus: "published",
        isPublished: true,
        trainerCollaborationStatus: "accepted",
        organizerCollaborationStatus: "accepted",
        eligibleGroupPriorities: ["stali", "regularni", "rezerwowi"],
        confirmationLeadTimeDays: 3,
        rosterFinalizedAt: null,
        minimumParticipants: 6,
        seededAt,
      }),
      buildTrainingEventDoc({
        id: "event-group-jacek-draft",
        slot: slotsById.get(slotId("trainer-1", "draft-c")),
        group: groupsById.get("group-jacek-warszawa-core"),
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        title: "Warszawa Oddech Core draft",
        summary: "Draft czekajacy na akceptacje trenera po stronie grouped workflow.",
        description: "Demo draftu tworzonego przez organizatora z poziomu grupy i slotu.",
        location: "Warszawa, ul. Pulawska 18",
        capacity: 12,
        enrolledCount: 0,
        status: "active",
        workflowStatus: "draft-requested",
        isPublished: false,
        trainerCollaborationStatus: "pending",
        organizerCollaborationStatus: "accepted",
        eligibleGroupPriorities: ["stali", "regularni"],
        confirmationLeadTimeDays: 3,
        rosterFinalizedAt: null,
        minimumParticipants: 6,
        seededAt,
      }),
      buildTrainingEventDoc({
        id: "event-group-marcin-open",
        slot: slotsById.get(slotId("trainer-2", "event-a")),
        group: groupsById.get("group-marcin-krakow-bodywork"),
        trainer: trainersById.get("trainer-2"),
        organizer: organizersById.get("organizer-marek"),
        title: "Krakow Praca z Cialem",
        summary: "Otwarte wydarzenie z jednym aktywnym uczestnikiem i intake do obslugi.",
        description: "Demo wydarzenia grupowego z miejscem na dalsze dopinanie skladu.",
        location: "Krakow, ul. Dietla 50",
        capacity: 14,
        enrolledCount: 1,
        status: "active",
        workflowStatus: "published",
        isPublished: true,
        trainerCollaborationStatus: "accepted",
        organizerCollaborationStatus: "accepted",
        eligibleGroupPriorities: ["stali", "regularni"],
        confirmationLeadTimeDays: 4,
        rosterFinalizedAt: null,
        minimumParticipants: 6,
        seededAt,
      }),
      buildTrainingEventDoc({
        id: "event-group-marcin-finalized",
        slot: slotsById.get(slotId("trainer-2", "event-b")),
        group: groupsById.get("group-marcin-krakow-bodywork"),
        trainer: trainersById.get("trainer-2"),
        organizer: organizersById.get("organizer-marek"),
        title: "Krakow Praca z Cialem final",
        summary: "Drugi termin grupy z zamknietym rosterem i SMS potwierdzeniami.",
        description: "Demo wydarzenia finalizowanego po stronie organizatora.",
        location: "Krakow, ul. Dietla 50",
        capacity: 14,
        enrolledCount: 2,
        status: "active",
        workflowStatus: "published",
        isPublished: true,
        trainerCollaborationStatus: "accepted",
        organizerCollaborationStatus: "accepted",
        eligibleGroupPriorities: ["stali", "regularni"],
        confirmationLeadTimeDays: 4,
        rosterFinalizedAt: seededAt,
        minimumParticipants: 6,
        seededAt,
      }),
      buildTrainingEventDoc({
        id: "event-group-dorota-post",
        slot: slotsById.get(slotId("trainer-10", "event-a")),
        group: groupsById.get("group-dorota-online-regeneracja"),
        trainer: trainersById.get("trainer-10"),
        organizer: organizersById.get("organizer-demo"),
        title: "Online Regeneracja",
        summary: "Post grupowy oparty o ta sama abstrakcje grupy i skladu.",
        description: "Demo wydarzenia typu post z uczestnikami tej samej grupy.",
        location: "Online / Zoom",
        capacity: 18,
        enrolledCount: 1,
        status: "active",
        workflowStatus: "published",
        isPublished: true,
        trainerCollaborationStatus: "accepted",
        organizerCollaborationStatus: "accepted",
        eligibleGroupPriorities: ["regularni", "rezerwowi"],
        confirmationLeadTimeDays: 2,
        rosterFinalizedAt: null,
        minimumParticipants: 4,
        eventTypeSystem: "post",
        seededAt,
      }),
      buildTrainingEventDoc({
        id: "event-group-dorota-draft",
        slot: slotsById.get(slotId("trainer-10", "draft-b")),
        group: groupsById.get("group-dorota-online-regeneracja"),
        trainer: trainersById.get("trainer-10"),
        organizer: organizersById.get("organizer-demo"),
        title: "Online Regeneracja draft",
        summary: "Draft spotkania online czekajacy na decyzje trenera.",
        description: "Demo grouped draftu dla eventu online.",
        location: "Online / Zoom",
        capacity: 18,
        enrolledCount: 0,
        status: "active",
        workflowStatus: "draft-requested",
        isPublished: false,
        trainerCollaborationStatus: "pending",
        organizerCollaborationStatus: "accepted",
        eligibleGroupPriorities: ["regularni", "rezerwowi"],
        confirmationLeadTimeDays: 2,
        rosterFinalizedAt: null,
        minimumParticipants: 4,
        seededAt,
      }),
    ];
    const eventsById = new Map(events.map((event) => [event.id, event]));

    const groupMembers = [
      buildGroupMemberDoc({
        group: groupsById.get("group-jacek-warszawa-core"),
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 301")),
        participantUserId: participantsByKey.get("grzegorz-e").userId,
        priority: "stali",
        notes: "Trzon grupy od poczatku.",
        seededAt,
      }),
      buildGroupMemberDoc({
        group: groupsById.get("group-jacek-warszawa-core"),
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 302")),
        participantUserId: participantsByKey.get("grzegorz-c").userId,
        priority: "regularni",
        notes: "Dolaczyl po kilku spotkaniach, regularnie wraca.",
        seededAt,
      }),
      buildGroupMemberDoc({
        group: groupsById.get("group-jacek-warszawa-core"),
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 304")),
        participantUserId: null,
        priority: "rezerwowi",
        notes: "Osoba z listy rezerwowej do ewentualnego dopinania.",
        seededAt,
      }),
      buildGroupMemberDoc({
        group: groupsById.get("group-marcin-krakow-bodywork"),
        trainer: trainersById.get("trainer-2"),
        organizer: organizersById.get("organizer-marek"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 303")),
        participantUserId: participantsByKey.get("ola").userId,
        priority: "stali",
        notes: "Priorytetowy sklad grupy krakowskiej.",
        seededAt,
      }),
      buildGroupMemberDoc({
        group: groupsById.get("group-marcin-krakow-bodywork"),
        trainer: trainersById.get("trainer-2"),
        organizer: organizersById.get("organizer-marek"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 305")),
        participantUserId: null,
        priority: "regularni",
        notes: "Osoba po pierwszym kontakcie, jeszcze niepotwierdzona.",
        seededAt,
      }),
      buildGroupMemberDoc({
        group: groupsById.get("group-marcin-krakow-bodywork"),
        trainer: trainersById.get("trainer-2"),
        organizer: organizersById.get("organizer-marek"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 304")),
        participantUserId: null,
        priority: "rezerwowi",
        notes: "Rezerwowa osoba do dopiecia w razie miejsca.",
        seededAt,
      }),
      buildGroupMemberDoc({
        group: groupsById.get("group-dorota-online-regeneracja"),
        trainer: trainersById.get("trainer-10"),
        organizer: organizersById.get("organizer-demo"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 301")),
        participantUserId: participantsByKey.get("grzegorz-e").userId,
        priority: "regularni",
        notes: "Regularnie pojawia sie na spotkaniach online.",
        seededAt,
      }),
      buildGroupMemberDoc({
        group: groupsById.get("group-dorota-online-regeneracja"),
        trainer: trainersById.get("trainer-10"),
        organizer: organizersById.get("organizer-demo"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 304")),
        participantUserId: null,
        priority: "rezerwowi",
        notes: "Osoba z puli rezerwowej dla spotkan online.",
        seededAt,
      }),
    ];

    const eventParticipants = [
      buildEventParticipantDoc({
        event: eventsById.get("event-group-jacek-finalized"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 301")),
        priority: "stali",
        status: "confirmed",
        source: "auto-core",
        attendanceStatus: "confirmed",
        participantUserId: participantsByKey.get("grzegorz-e").userId,
        seededAt,
      }),
      buildEventParticipantDoc({
        event: eventsById.get("event-group-jacek-finalized"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 302")),
        priority: "regularni",
        status: "invited",
        source: "organizer",
        attendanceStatus: "pending",
        participantUserId: participantsByKey.get("grzegorz-c").userId,
        seededAt,
      }),
      buildEventParticipantDoc({
        event: eventsById.get("event-group-jacek-intake"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 301")),
        priority: "stali",
        status: "invited",
        source: "auto-core",
        attendanceStatus: "not-required",
        participantUserId: participantsByKey.get("grzegorz-e").userId,
        seededAt,
      }),
      buildEventParticipantDoc({
        event: eventsById.get("event-group-jacek-intake"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 304")),
        priority: "rezerwowi",
        status: "invited",
        source: "public-form",
        attendanceStatus: "pending",
        participantUserId: null,
        seededAt,
      }),
      buildEventParticipantDoc({
        event: eventsById.get("event-group-marcin-open"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 303")),
        priority: "stali",
        status: "confirmed",
        source: "auto-core",
        attendanceStatus: "confirmed",
        participantUserId: participantsByKey.get("ola").userId,
        seededAt,
      }),
      buildEventParticipantDoc({
        event: eventsById.get("event-group-marcin-finalized"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 303")),
        priority: "stali",
        status: "confirmed",
        source: "auto-core",
        attendanceStatus: "confirmed",
        participantUserId: participantsByKey.get("ola").userId,
        seededAt,
      }),
      buildEventParticipantDoc({
        event: eventsById.get("event-group-marcin-finalized"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 305")),
        priority: "regularni",
        status: "invited",
        source: "organizer",
        attendanceStatus: "pending",
        participantUserId: null,
        seededAt,
      }),
      buildEventParticipantDoc({
        event: eventsById.get("event-group-dorota-post"),
        participantProfile: participantProfilesById.get(buildParticipantProfileId("+48 605 100 301")),
        priority: "regularni",
        status: "invited",
        source: "organizer",
        attendanceStatus: "not-required",
        participantUserId: participantsByKey.get("grzegorz-e").userId,
        seededAt,
      }),
    ];

    const relations = [
      buildRelationDoc({
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        status: "approved",
        requestedBy: "organizer",
        seededAt,
      }),
      buildRelationDoc({
        trainer: trainersById.get("trainer-2"),
        organizer: organizersById.get("organizer-marek"),
        status: "approved",
        requestedBy: "trainer",
        seededAt,
      }),
      buildRelationDoc({
        trainer: trainersById.get("trainer-10"),
        organizer: organizersById.get("organizer-demo"),
        status: "approved",
        requestedBy: "organizer",
        seededAt,
      }),
      buildRelationDoc({
        trainer: trainersById.get("trainer-10"),
        organizer: organizersById.get("organizer-karolina"),
        status: "pending",
        requestedBy: "organizer",
        seededAt,
      }),
    ];

    const trainerCalendarFeeds = trainers.map((trainer) => ({
      id: `trainer-feed__${trainer.id}`,
      trainerId: trainer.id,
      trainerUserId: trainer.userId,
      provider: "ical",
      url: `https://panel.ceo/emandar/demo-ical/${trainer.id}.ics`,
      enabled: true,
      lastSyncedAt: seededAt,
      lastSyncStatus: "success",
      createdAt: seededAt,
      updatedAt: seededAt,
      seededAt,
      source: SCRIPT_NAME,
    }));

    const organizerCalendarFeeds = organizers.map((organizer) => ({
      id: `organizer-feed__${organizer.id}`,
      organizerId: organizer.id,
      organizerUserId: organizer.userId,
      provider: "ical",
      url: `https://panel.ceo/emandar/demo-ical/${organizer.id}.ics`,
      enabled: true,
      lastSyncedAt: seededAt,
      lastSyncStatus: "success",
      createdAt: seededAt,
      updatedAt: seededAt,
      seededAt,
      source: SCRIPT_NAME,
    }));

    const trainerOrganizerCalendarFeeds = [
      {
        trainerId: "trainer-1",
        organizerId: "organizer-karolina",
        matchedSharedSlotIds: [slotId("trainer-1", "free-d")],
      },
      {
        trainerId: "trainer-2",
        organizerId: "organizer-marek",
        matchedSharedSlotIds: [slotId("trainer-2", "free-c")],
      },
      {
        trainerId: "trainer-10",
        organizerId: "organizer-demo",
        matchedSharedSlotIds: [slotId("trainer-10", "free-c")],
      },
    ].map(({ trainerId, organizerId, matchedSharedSlotIds }) => {
      const trainer = trainersById.get(trainerId);
      const organizer = organizersById.get(organizerId);
      return {
        id: relationId(trainerId, organizerId),
        relationId: relationId(trainerId, organizerId),
        trainerId,
        organizerId,
        trainerUserId: trainer.userId,
        organizerUserId: organizer.userId,
        tokenVersion: 1,
        token: `demo-token-${trainerId}-${organizerId}`,
        tokenHash: `demo-token-hash-${trainerId}-${organizerId}`,
        enabled: true,
        createdAt: seededAt,
        updatedAt: seededAt,
        tokenRotatedAt: seededAt,
        publicFeedUrl: `https://panel.ceo/emandar/api/ical/trainer-organizer/${trainerId}-${organizerId}.ics`,
        matchedSharedSlotIds,
        seededAt,
        source: SCRIPT_NAME,
      };
    });

    const availabilitySlots = [
      { slotKey: slotId("trainer-1", "event-a"), organizerId: "organizer-karolina" },
      { slotKey: slotId("trainer-1", "event-b"), organizerId: "organizer-karolina" },
      { slotKey: slotId("trainer-1", "draft-c"), organizerId: "organizer-karolina" },
      { slotKey: slotId("trainer-1", "free-d"), organizerId: "organizer-karolina" },
      { slotKey: slotId("trainer-2", "event-a"), organizerId: "organizer-marek" },
      { slotKey: slotId("trainer-2", "event-b"), organizerId: "organizer-marek" },
      { slotKey: slotId("trainer-2", "free-c"), organizerId: "organizer-marek" },
      { slotKey: slotId("trainer-10", "event-a"), organizerId: "organizer-demo" },
      { slotKey: slotId("trainer-10", "draft-b"), organizerId: "organizer-demo" },
      { slotKey: slotId("trainer-10", "free-c"), organizerId: "organizer-demo" },
    ].map(({ slotKey, organizerId }) => {
      const slot = slotsById.get(slotKey);
      return buildAvailabilityDoc({
        id: availabilitySlotId(slot.trainerId, slotKey.split("__").at(-1)),
        trainer: trainersById.get(slot.trainerId),
        organizerId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        location: slot.location,
        notes: slot.notes,
        seededAt,
      });
    });

    const enrollmentRequests = [
      buildEnrollmentRequestDoc({
        id: "request-group-jacek-anna-accepted",
        event: eventsById.get("event-group-jacek-intake"),
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        participantProfileId: buildParticipantProfileId("+48 605 100 304"),
        eventParticipantId: buildEventParticipantId(
          "event-group-jacek-intake",
          buildParticipantProfileId("+48 605 100 304"),
        ),
        name: "Anna Rezerwowa",
        phone: "+48 605 100 304",
        referral: "Lista rezerwowa grupy",
        message: "Chetnie wskocze, jesli zwolni sie miejsce albo organizator potwierdzi udzial.",
        trainerDecision: "accepted",
        organizerDecision: "accepted",
        finalStatus: "accepted",
        participantStatus: "active",
        attendanceStatus: "pending",
        seededAt,
      }),
      buildEnrollmentRequestDoc({
        id: "request-group-jacek-piotr-pending",
        event: eventsById.get("event-group-jacek-intake"),
        trainer: trainersById.get("trainer-1"),
        organizer: organizersById.get("organizer-karolina"),
        participantProfileId: null,
        eventParticipantId: null,
        name: "Piotr Czeka",
        phone: "+48 605 100 306",
        referral: "Znajomy z poprzedniej edycji",
        message: "Jesli pojawi sie miejsce, chetnie dolacze do tej grupy.",
        trainerDecision: "pending",
        organizerDecision: "pending",
        finalStatus: "pending",
        participantStatus: "active",
        attendanceStatus: "not-required",
        seededAt,
      }),
      buildEnrollmentRequestDoc({
        id: "request-group-marcin-partial",
        event: eventsById.get("event-group-marcin-open"),
        trainer: trainersById.get("trainer-2"),
        organizer: organizersById.get("organizer-marek"),
        participantProfileId: null,
        eventParticipantId: null,
        name: "Kasia Nowa",
        phone: "+48 605 100 307",
        referral: "Formularz publiczny",
        message: "Bylam juz raz na innej grupie i chce dolaczyc, gdy bedzie miejsce.",
        trainerDecision: "accepted",
        organizerDecision: "pending",
        finalStatus: "partial",
        participantStatus: "active",
        attendanceStatus: "not-required",
        seededAt,
      }),
    ];

    const collectionsToSeed = [
      ["trainerOrganizerRelations", relations],
      ["trainerCalendarFeeds", trainerCalendarFeeds],
      ["organizerCalendarFeeds", organizerCalendarFeeds],
      ["trainerSharedSlots", slots],
      ["availabilitySlots", availabilitySlots],
      ["trainerOrganizerCalendarFeeds", trainerOrganizerCalendarFeeds],
      ["groups", groups],
      ["participantProfiles", participantProfiles],
      ["groupMembers", groupMembers],
      ["trainingEvents", events],
      ["eventParticipants", eventParticipants],
      ["enrollmentRequests", enrollmentRequests],
    ];

    console.log(
      JSON.stringify(
        {
          dryRun,
          projectId: firebaseConfig.projectId,
          writeCount: collectionsToSeed.reduce(
            (sum, [, docs]) => sum + docs.length,
            0,
          ),
          collections: collectionsToSeed.map(([collectionName, docs]) => ({
            collectionName,
            count: docs.length,
          })),
        },
        null,
        2,
      ),
    );

    for (const [collectionName, docs] of collectionsToSeed) {
      await upsertDocs(db, collectionName, docs, dryRun);
    }

    if (!dryRun) {
      console.log(
        `Reloaded grouped demo data on ${firebaseConfig.projectId}: ${groups.length} groups, ${events.length} events, ${eventParticipants.length} event participants, ${enrollmentRequests.length} enrollment requests.`,
      );
    }
  } finally {
    await signOut(auth);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
