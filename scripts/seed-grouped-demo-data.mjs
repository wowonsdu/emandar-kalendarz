import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from "firebase/firestore";

const SCRIPT_SOURCE = "scripts/seed-grouped-demo-data.mjs";
const DOTENV_PATHS = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env.production"),
];
const PASSWORD = "kocham";

const trainerSeeds = [
  {
    key: "jacek",
    profileId: "trainer-1",
    displayName: "Jacek",
    email: "jacek@emandar.pl",
    phone: "+48 601 100 101",
    slug: "jacek",
    city: "Warszawa",
    feedUrl: "https://panel.ceo/emandar/demo-ical/jacek-private-demo.ics",
  },
  {
    key: "marcin",
    profileId: "trainer-2",
    displayName: "Marcin",
    email: "marcin@emandar.pl",
    phone: "+48 601 100 102",
    slug: "marcin",
    city: "Kraków",
    feedUrl: "https://panel.ceo/emandar/demo-ical/marcin-private-demo.ics",
  },
  {
    key: "dorota",
    profileId: "trainer-10",
    displayName: "Dorota",
    email: "dorota@emandar.pl",
    phone: "+48 601 909 808",
    slug: "dorota",
    city: "Lublin",
    feedUrl: "https://panel.ceo/emandar/demo-ical/dorota-private-demo.ics",
  },
];

const organizerSeeds = [
  {
    key: "karolina",
    profileId: "organizer-karolina",
    displayName: "Karolina",
    email: "karolina@emandar.pl",
    phone: "+48 602 100 201",
    city: "Warszawa",
    feedUrl: "https://panel.ceo/emandar/demo-ical/karolina-busy-demo.ics",
  },
  {
    key: "marek",
    profileId: "organizer-marek",
    displayName: "Marek",
    email: "marek@emandar.pl",
    phone: "+48 602 100 202",
    city: "Kraków",
    feedUrl: "https://panel.ceo/emandar/demo-ical/marek-busy-demo.ics",
  },
  {
    key: "demo",
    profileId: "organizer-demo",
    displayName: "Organizator Demo",
    email: "organizator-demo@emandar.pl",
    phone: "+48 602 100 203",
    city: "Online",
    feedUrl: "https://panel.ceo/emandar/demo-ical/demo-organizer-busy.ics",
  },
];

const participantSeeds = [
  {
    key: "grzegorzE",
    displayName: "Grzegorz Emanowicz",
    email: "grzegorz.emanowicz@emandar.pl",
    phone: "+48 605 100 301",
  },
  {
    key: "grzegorzC",
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

const managedParticipantSeeds = [
  {
    key: "anna",
    displayName: "Anna Nowak",
    phone: "+48 605 100 304",
    notes: "Dodana ręcznie przez organizatora, jeszcze bez potwierdzonego logowania.",
    confirmationStatus: "unconfirmed",
  },
  {
    key: "tomasz",
    displayName: "Tomasz Lis",
    phone: "+48 605 100 305",
    notes: "Profil administracyjny do testowania dokładania do rosteru przez organizatora.",
    confirmationStatus: "unconfirmed",
  },
  {
    key: "kasia",
    displayName: "Kasia Zielińska",
    phone: "+48 605 100 306",
    notes: "Uczestniczka grupy online, bez jeszcze zakończonej rejestracji SMS.",
    confirmationStatus: "unconfirmed",
  },
];

const groupSeeds = [
  {
    id: "group-warszawa-oddech",
    name: "Warszawa • Krąg Oddechu",
    trainerKey: "jacek",
    organizerKey: "karolina",
    notes: "Stała grupa warszawska z klasycznym flow organizator-trener.",
    defaultLocation: "Warszawa / Praga",
    defaultEventType: "training",
    defaultCapacity: 16,
    defaultTags: ["warszawa", "oddech", "grupa"],
    defaultConfirmationLeadTimeDays: 5,
  },
  {
    id: "group-krakow-regeneracja",
    name: "Kraków • Regeneracja",
    trainerKey: "marcin",
    organizerKey: "marek",
    notes: "Grupa do demo draftów oczekujących i zaakceptowanych przez trenera.",
    defaultLocation: "Kraków / Kazimierz",
    defaultEventType: "training",
    defaultCapacity: 14,
    defaultTags: ["kraków", "regeneracja"],
    defaultConfirmationLeadTimeDays: 7,
  },
  {
    id: "group-online-post",
    name: "Online • Post i Uważność",
    trainerKey: "dorota",
    organizerKey: "demo",
    notes: "Grupa pod posty, wydarzenia online i scenariusze z odrzuconym draftem.",
    defaultLocation: "Online / Zoom",
    defaultEventType: "post",
    defaultCapacity: 20,
    defaultTags: ["online", "post", "uważność"],
    defaultConfirmationLeadTimeDays: 3,
  },
];

const membershipSeeds = [
  { groupId: "group-warszawa-oddech", participantKey: "grzegorzE", priority: "stali" },
  { groupId: "group-warszawa-oddech", participantKey: "ola", priority: "stali" },
  { groupId: "group-warszawa-oddech", participantKey: "grzegorzC", priority: "regularni" },
  { groupId: "group-warszawa-oddech", participantKey: "anna", priority: "rezerwowi" },
  { groupId: "group-krakow-regeneracja", participantKey: "grzegorzC", priority: "stali" },
  { groupId: "group-krakow-regeneracja", participantKey: "tomasz", priority: "regularni" },
  { groupId: "group-krakow-regeneracja", participantKey: "kasia", priority: "rezerwowi" },
  { groupId: "group-online-post", participantKey: "ola", priority: "stali" },
  { groupId: "group-online-post", participantKey: "tomasz", priority: "regularni" },
  { groupId: "group-online-post", participantKey: "grzegorzE", priority: "rezerwowi" },
];

const approvedRelations = [
  { trainerKey: "jacek", organizerKey: "karolina", status: "approved", requestedBy: "organizer" },
  { trainerKey: "marcin", organizerKey: "marek", status: "approved", requestedBy: "trainer" },
  { trainerKey: "dorota", organizerKey: "demo", status: "approved", requestedBy: "organizer" },
];

const secondaryRelations = [
  { trainerKey: "jacek", organizerKey: "demo", status: "pending", requestedBy: "organizer" },
  { trainerKey: "marcin", organizerKey: "karolina", status: "rejected", requestedBy: "trainer" },
];

function hashToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePhoneLookupKey(value) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits;
}

function buildParticipantProfileId(phoneNumber) {
  return `participant-${normalizePhoneLookupKey(phoneNumber)}`;
}

function buildRelationId(trainerId, organizerId) {
  return `${trainerId}__${organizerId}`;
}

function buildGroupMemberId(groupId, participantProfileId) {
  return `${groupId}__${participantProfileId}`;
}

function buildEventParticipantId(eventId, participantProfileId) {
  return `${eventId}__${participantProfileId}`;
}

function toIsoAtDayOffset(dayOffset, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function makeSchedule(dayOffset, startHour = 10, endHour = 17, durationDays = 2) {
  return Array.from({ length: durationDays }, (_, index) => ({
    startsAt: toIsoAtDayOffset(dayOffset + index, startHour),
    endsAt: toIsoAtDayOffset(dayOffset + index, endHour),
  }));
}

function loadBounds(scheduleDays) {
  return {
    startsAt: scheduleDays[0].startsAt,
    endsAt: scheduleDays[scheduleDays.length - 1].endsAt,
  };
}

function splitDisplayName(displayName) {
  const [firstName = "", ...lastNameParts] = displayName.split(/\s+/).filter(Boolean);
  return {
    firstName,
    lastName: lastNameParts.join(" "),
  };
}

function activeParticipantCount(participants) {
  return participants.filter(
    (participant) => participant.status === "invited" || participant.status === "confirmed",
  ).length;
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

function getClientApp(env) {
  const existing = getApps().find((app) => app.name === "seed-grouped-demo");
  if (existing) {
    return existing;
  }

  return initializeApp(
    {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    },
    "seed-grouped-demo",
  );
}

async function listCollectionDocuments(db, collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

async function writeFirestoreDocument(db, collectionName, docId, data) {
  await setDoc(
    doc(db, collectionName, docId),
    Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ),
    { merge: true },
  );
}

async function deleteFirestoreDocument(db, collectionName, docId) {
  await deleteDoc(doc(db, collectionName, docId));
}

async function ensureAuthUser(auth, account) {
  try {
    const credential = await signInWithEmailAndPassword(auth, account.email, PASSWORD);
    if (credential.user.displayName !== account.displayName) {
      await updateProfile(credential.user, { displayName: account.displayName });
    }
    await signOut(auth);
    return credential.user.uid;
  } catch (error) {
    if (
      error?.code !== "auth/user-not-found" &&
      error?.code !== "auth/invalid-credential" &&
      error?.code !== "auth/invalid-login-credentials"
    ) {
      throw error;
    }
  }

  const created = await createUserWithEmailAndPassword(auth, account.email, PASSWORD);
  await updateProfile(created.user, { displayName: account.displayName });
  const uid = created.user.uid;
  await signOut(auth);
  return uid;
}

function collectDemoAccountDescriptors() {
  return [
    ...trainerSeeds.map((trainer) => ({
      role: "trainer",
      profileId: trainer.profileId,
      displayName: trainer.displayName,
      email: trainer.email,
      phone: trainer.phone,
    })),
    ...organizerSeeds.map((organizer) => ({
      role: "organizer",
      profileId: organizer.profileId,
      displayName: organizer.displayName,
      email: organizer.email,
      phone: organizer.phone,
    })),
    ...participantSeeds.map((participant) => ({
      role: "participant",
      profileId: null,
      displayName: participant.displayName,
      email: participant.email,
      phone: participant.phone,
    })),
  ];
}

async function ensureDemoAuthAccounts(auth, db) {
  const seededAt = new Date().toISOString();
  const accounts = collectDemoAccountDescriptors();
  const authUsersByEmail = new Map();

  for (const account of accounts) {
    const authUid = await ensureAuthUser(auth, account);
    authUsersByEmail.set(account.email, { uid: authUid });

    await writeFirestoreDocument(db, "users", authUid, {
      id: authUid,
      role: account.role,
      roles: [account.role],
      primaryRole: account.role,
      displayName: account.displayName,
      email: account.email,
      phone: account.phone,
      status: "active",
      trainerProfileId: account.role === "trainer" ? account.profileId : null,
      organizerProfileId: account.role === "organizer" ? account.profileId : null,
      participantProfileId: account.role === "participant" ? null : undefined,
      seededFromDemo: true,
      seededAt,
      source: SCRIPT_SOURCE,
    });
  }

  return authUsersByEmail;
}

function buildParticipantEntityMaps(authUsersByEmail) {
  const byKey = new Map();

  for (const seed of participantSeeds) {
    const user = authUsersByEmail.get(seed.email);
    if (!user) {
      throw new Error(`Missing demo participant account for ${seed.email}`);
    }

    byKey.set(seed.key, {
      ...seed,
      profileId: buildParticipantProfileId(seed.phone),
      linkedUserId: user.uid,
      confirmationStatus: "confirmed",
      confirmedAt: new Date().toISOString(),
    });
  }

  for (const seed of managedParticipantSeeds) {
    byKey.set(seed.key, {
      ...seed,
      profileId: buildParticipantProfileId(seed.phone),
      linkedUserId: null,
      confirmationStatus: seed.confirmationStatus,
      confirmedAt: null,
    });
  }

  return byKey;
}

function buildSlotDefinitions(context) {
  const createdAt = context.seededAt;
  return [
    {
      id: "slot-jacek-karolina-source",
      trainerKey: "jacek",
      organizerKey: "karolina",
      startsAt: toIsoAtDayOffset(14, 10),
      endsAt: toIsoAtDayOffset(14, 17),
      location: "Warszawa / Praga",
      notes: "Slot pod główne szkolenie grupy warszawskiej.",
      visibility: "approved-organizers",
      source: "manual",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "slot-jacek-karolina-target",
      trainerKey: "jacek",
      organizerKey: "karolina",
      startsAt: toIsoAtDayOffset(42, 10),
      endsAt: toIsoAtDayOffset(42, 17),
      location: "Warszawa / Praga",
      notes: "Docelowy termin do testu przeniesienia uczestnika między wydarzeniami grupy.",
      visibility: "approved-organizers",
      source: "ical-derived",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "slot-jacek-karolina-open",
      trainerKey: "jacek",
      organizerKey: "karolina",
      startsAt: toIsoAtDayOffset(77, 10),
      endsAt: toIsoAtDayOffset(77, 17),
      location: "Warszawa / Żoliborz",
      notes: "Wolny termin do tworzenia kolejnego draftu z poziomu organizatora.",
      visibility: "approved-organizers",
      source: "ical-derived",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "slot-marcin-marek-draft",
      trainerKey: "marcin",
      organizerKey: "marek",
      startsAt: toIsoAtDayOffset(28, 10),
      endsAt: toIsoAtDayOffset(29, 17),
      location: "Kraków / Kazimierz",
      notes: "Slot pod draft oczekujący na decyzję trenera.",
      visibility: "approved-organizers",
      source: "manual",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "slot-marcin-marek-accepted",
      trainerKey: "marcin",
      organizerKey: "marek",
      startsAt: toIsoAtDayOffset(56, 10),
      endsAt: toIsoAtDayOffset(57, 17),
      location: "Kraków / Kazimierz",
      notes: "Slot pod draft już zaakceptowany przez trenera, jeszcze bez publikacji.",
      visibility: "approved-organizers",
      source: "ical-derived",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "slot-dorota-demo-post",
      trainerKey: "dorota",
      organizerKey: "demo",
      startsAt: toIsoAtDayOffset(18, 18),
      endsAt: toIsoAtDayOffset(18, 21),
      location: "Online / Zoom",
      notes: "Publikowany post grupowy online.",
      visibility: "approved-organizers",
      source: "manual",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "slot-dorota-demo-rejected",
      trainerKey: "dorota",
      organizerKey: "demo",
      startsAt: toIsoAtDayOffset(63, 18),
      endsAt: toIsoAtDayOffset(63, 21),
      location: "Online / Zoom",
      notes: "Draft odrzucony przez trenera ze względu na kolizję logistyczną.",
      visibility: "approved-organizers",
      source: "ical-derived",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
  ].map((slot) => {
    const trainer = context.trainersByKey.get(slot.trainerKey);
    const organizer = context.organizersByKey.get(slot.organizerKey);

    return {
      id: slot.id,
      trainerId: trainer.profileId,
      trainerUserId: trainer.userId,
      organizerId: organizer.profileId,
      organizerUserId: organizer.userId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      location: slot.location,
      notes: slot.notes,
      visibility: slot.visibility,
      source: slot.source,
      status: slot.status,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
    };
  });
}

function buildEventDefinitions(context) {
  const groupWarsaw = context.groupsById.get("group-warszawa-oddech");
  const groupKrakow = context.groupsById.get("group-krakow-regeneracja");
  const groupOnline = context.groupsById.get("group-online-post");
  const trainerJacek = context.trainersByKey.get("jacek");
  const trainerMarcin = context.trainersByKey.get("marcin");
  const trainerDorota = context.trainersByKey.get("dorota");
  const organizerKarolina = context.organizersByKey.get("karolina");
  const organizerMarek = context.organizersByKey.get("marek");
  const organizerDemo = context.organizersByKey.get("demo");
  const createdAt = context.seededAt;

  const sourceSchedule = makeSchedule(14, 10, 17, 2);
  const targetSchedule = makeSchedule(42, 10, 17, 2);
  const draftSchedule = makeSchedule(28, 10, 17, 2);
  const acceptedSchedule = makeSchedule(56, 10, 17, 2);
  const onlinePostSchedule = makeSchedule(18, 18, 21, 1);
  const rejectedSchedule = makeSchedule(63, 18, 21, 1);

  return [
    {
      id: "event-group-warsaw-source",
      group: groupWarsaw,
      trainer: trainerJacek,
      organizer: organizerKarolina,
      creator: organizerKarolina,
      createdByRole: "organizer",
      sharedSlotId: "slot-jacek-karolina-source",
      title: "Warszawa • Krąg Oddechu #1",
      summary: "Najbliższe szkolenie grupowe z rosterem i publicznym intake spiętym z grupą.",
      description:
        "Seedowane szkolenie do testowania rosteru, publicznego intake i samoobsługowego transferu uczestnika w obrębie tej samej grupy.",
      type: "Warsztat oddechowy",
      eventTypeSystem: "training",
      scheduleDays: sourceSchedule,
      location: "Warszawa / Praga",
      tags: ["warszawa", "oddech", "demo"],
      capacity: 8,
      enrolledCount: 3,
      isPublished: true,
      imageHint: "warszawa-oddech",
      brandStatus: "official",
      status: "confirmed",
      minimumParticipants: 5,
      requiresOrganizerApproval: true,
      eligibleGroupPriorities: ["stali", "regularni", "rezerwowi"],
      confirmationLeadTimeDays: 5,
      trainerCollaborationStatus: "accepted",
      organizerCollaborationStatus: "accepted",
      selfManagedByTrainer: false,
      workflowStatus: "published",
      publishAutomaticallyAfterTrainerApproval: true,
      trainerDecidedAt: createdAt,
      trainerDecidedByUserId: trainerJacek.userId,
      trainerDecisionReason: null,
      publicationApprovalStatus: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "event-group-warsaw-target",
      group: groupWarsaw,
      trainer: trainerJacek,
      organizer: organizerKarolina,
      creator: organizerKarolina,
      createdByRole: "organizer",
      sharedSlotId: "slot-jacek-karolina-target",
      title: "Warszawa • Krąg Oddechu #2",
      summary: "Kolejny termin tej samej grupy, gotowy do testowania przeniesienia uczestnika.",
      description:
        "Drugie opublikowane wydarzenie tej samej grupy. Uczestnik z wpisem source=public-form może przenieść się tutaj z poprzedniego terminu.",
      type: "Warsztat oddechowy",
      eventTypeSystem: "training",
      scheduleDays: targetSchedule,
      location: "Warszawa / Praga",
      tags: ["warszawa", "oddech", "demo"],
      capacity: 8,
      enrolledCount: 2,
      isPublished: true,
      imageHint: "warszawa-oddech",
      brandStatus: "official",
      status: "confirmed",
      minimumParticipants: 5,
      requiresOrganizerApproval: true,
      eligibleGroupPriorities: ["stali", "regularni", "rezerwowi"],
      confirmationLeadTimeDays: 5,
      trainerCollaborationStatus: "accepted",
      organizerCollaborationStatus: "accepted",
      selfManagedByTrainer: false,
      workflowStatus: "published",
      publishAutomaticallyAfterTrainerApproval: true,
      trainerDecidedAt: createdAt,
      trainerDecidedByUserId: trainerJacek.userId,
      trainerDecisionReason: null,
      publicationApprovalStatus: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "event-group-krakow-draft",
      group: groupKrakow,
      trainer: trainerMarcin,
      organizer: organizerMarek,
      creator: organizerMarek,
      createdByRole: "organizer",
      sharedSlotId: "slot-marcin-marek-draft",
      title: "Kraków • Regeneracja • draft",
      summary: "Draft czekający na decyzję trenera, z pełnym kontekstem grupy.",
      description:
        "Seedowany draft szkolenia grupowego do testowania listy draftów u organizatora i panelu decyzji po stronie trenera.",
      type: "Warsztat regeneracyjny",
      eventTypeSystem: "training",
      scheduleDays: draftSchedule,
      location: "Kraków / Kazimierz",
      tags: ["kraków", "regeneracja", "draft"],
      capacity: 14,
      enrolledCount: 0,
      isPublished: false,
      imageHint: "krakow-regeneracja",
      brandStatus: "official",
      status: "active",
      minimumParticipants: 6,
      requiresOrganizerApproval: true,
      eligibleGroupPriorities: ["stali", "regularni"],
      confirmationLeadTimeDays: 7,
      trainerCollaborationStatus: "pending",
      organizerCollaborationStatus: "accepted",
      selfManagedByTrainer: false,
      workflowStatus: "draft-requested",
      publishAutomaticallyAfterTrainerApproval: true,
      publicationApprovalStatus: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "event-group-krakow-accepted",
      group: groupKrakow,
      trainer: trainerMarcin,
      organizer: organizerMarek,
      creator: organizerMarek,
      createdByRole: "organizer",
      sharedSlotId: "slot-marcin-marek-accepted",
      title: "Kraków • Regeneracja • zaakceptowane",
      summary: "Draft zaakceptowany przez trenera, jeszcze bez publikacji dla uczestników.",
      description:
        "Seedowane wydarzenie w stanie trainer-accepted, przydatne do testowania dalszych kroków organizatora po akceptacji draftu.",
      type: "Warsztat regeneracyjny",
      eventTypeSystem: "training",
      scheduleDays: acceptedSchedule,
      location: "Kraków / Kazimierz",
      tags: ["kraków", "regeneracja", "zaakceptowane"],
      capacity: 14,
      enrolledCount: 0,
      isPublished: false,
      imageHint: "krakow-regeneracja",
      brandStatus: "official",
      status: "active",
      minimumParticipants: 6,
      requiresOrganizerApproval: true,
      eligibleGroupPriorities: ["stali", "regularni", "rezerwowi"],
      confirmationLeadTimeDays: 7,
      trainerCollaborationStatus: "accepted",
      organizerCollaborationStatus: "accepted",
      selfManagedByTrainer: false,
      workflowStatus: "trainer-accepted",
      publishAutomaticallyAfterTrainerApproval: false,
      trainerDecidedAt: createdAt,
      trainerDecidedByUserId: trainerMarcin.userId,
      trainerDecisionReason: null,
      publicationApprovalStatus: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "event-group-online-post",
      group: groupOnline,
      trainer: trainerDorota,
      organizer: organizerDemo,
      creator: organizerDemo,
      createdByRole: "organizer",
      sharedSlotId: "slot-dorota-demo-post",
      title: "Online • Post i Uważność",
      summary: "Opublikowany post grupowy w modelu rosterowym z priorytetami.",
      description:
        "Seedowane wydarzenie grupowe typu post, pokazujące że grupa może zawierać także inne typy wydarzeń niż klasyczne szkolenie.",
      type: "Post grupowy",
      eventTypeSystem: "post",
      scheduleDays: onlinePostSchedule,
      location: "Online / Zoom",
      tags: ["online", "post", "uważność"],
      capacity: 20,
      enrolledCount: 2,
      isPublished: true,
      imageHint: "online-post",
      brandStatus: "official",
      status: "confirmed",
      minimumParticipants: 4,
      requiresOrganizerApproval: true,
      eligibleGroupPriorities: ["stali", "regularni", "rezerwowi"],
      confirmationLeadTimeDays: 3,
      trainerCollaborationStatus: "accepted",
      organizerCollaborationStatus: "accepted",
      selfManagedByTrainer: false,
      workflowStatus: "published",
      publishAutomaticallyAfterTrainerApproval: true,
      trainerDecidedAt: createdAt,
      trainerDecidedByUserId: trainerDorota.userId,
      trainerDecisionReason: null,
      publicationApprovalStatus: null,
      rosterFinalizedAt: createdAt,
      rosterFinalizedByUserId: organizerDemo.userId,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "event-group-online-rejected",
      group: groupOnline,
      trainer: trainerDorota,
      organizer: organizerDemo,
      creator: organizerDemo,
      createdByRole: "organizer",
      sharedSlotId: "slot-dorota-demo-rejected",
      title: "Online • Draft odrzucony",
      summary: "Draft odrzucony przez trenera z powodów logistycznych.",
      description:
        "Seedowany przykład draftu odrzuconego po stronie trenera, tak aby organizer widział kompletną historię decyzji.",
      type: "Post grupowy",
      eventTypeSystem: "post",
      scheduleDays: rejectedSchedule,
      location: "Online / Zoom",
      tags: ["online", "post", "odrzucone"],
      capacity: 20,
      enrolledCount: 0,
      isPublished: false,
      imageHint: "online-post",
      brandStatus: "official",
      status: "active",
      minimumParticipants: 4,
      requiresOrganizerApproval: true,
      eligibleGroupPriorities: ["stali", "regularni", "rezerwowi"],
      confirmationLeadTimeDays: 3,
      trainerCollaborationStatus: "rejected",
      organizerCollaborationStatus: "accepted",
      selfManagedByTrainer: false,
      workflowStatus: "trainer-rejected",
      publishAutomaticallyAfterTrainerApproval: false,
      trainerDecidedAt: createdAt,
      trainerDecidedByUserId: trainerDorota.userId,
      trainerDecisionReason: "Kolizja z wcześniejszym wyjazdem i brak bezpiecznego czasu dojazdu.",
      publicationApprovalStatus: null,
      createdAt,
      updatedAt: createdAt,
    },
  ].map((event) => {
    const { startsAt, endsAt } = loadBounds(event.scheduleDays);
    return {
      id: event.id,
      trainerId: event.trainer.profileId,
      organizerId: event.organizer.profileId,
      groupId: event.group.id,
      groupName: event.group.name,
      trainerUserId: event.trainer.userId,
      organizerUserId: event.organizer.userId,
      creatorUserId: event.creator.userId,
      creatorDisplayName: event.creator.displayName,
      creatorPhone: event.creator.phone,
      title: event.title,
      summary: event.summary,
      description: event.description,
      type: event.type,
      eventTypeSystem: event.eventTypeSystem,
      startsAt,
      endsAt,
      scheduleDays: event.scheduleDays,
      location: event.location,
      tags: event.tags,
      capacity: event.capacity,
      enrolledCount: event.enrolledCount,
      isPublished: event.isPublished,
      imageHint: event.imageHint,
      brandStatus: event.brandStatus,
      status: event.status,
      workflowStatus: event.workflowStatus,
      sharedSlotId: event.sharedSlotId,
      publishAutomaticallyAfterTrainerApproval: event.publishAutomaticallyAfterTrainerApproval,
      minimumParticipants: event.minimumParticipants,
      requiresOrganizerApproval: event.requiresOrganizerApproval,
      eligibleGroupPriorities: event.eligibleGroupPriorities,
      confirmationLeadTimeDays: event.confirmationLeadTimeDays,
      trainerCollaborationStatus: event.trainerCollaborationStatus,
      organizerCollaborationStatus: event.organizerCollaborationStatus,
      selfManagedByTrainer: event.selfManagedByTrainer,
      createdByRole: event.createdByRole,
      publicationApprovalStatus: event.publicationApprovalStatus,
      trainerDecidedAt: event.trainerDecidedAt ?? null,
      trainerDecidedByUserId: event.trainerDecidedByUserId ?? null,
      trainerDecisionReason: event.trainerDecisionReason,
      rosterFinalizedAt: event.rosterFinalizedAt ?? null,
      rosterFinalizedByUserId: event.rosterFinalizedByUserId ?? null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    };
  });
}

function buildEventParticipantDefinitions(context, eventsById, participantEntitiesByKey) {
  const definitions = [
    {
      eventId: "event-group-warsaw-source",
      participantKey: "grzegorzE",
      priority: "stali",
      status: "invited",
      source: "public-form",
      attendanceConfirmationStatus: "pending",
      attendanceConfirmationRequestedAt: context.seededAt,
      attendanceConfirmationExpiresAt: eventsById.get("event-group-warsaw-source").startsAt,
    },
    {
      eventId: "event-group-warsaw-source",
      participantKey: "grzegorzC",
      priority: "regularni",
      status: "confirmed",
      source: "organizer",
      attendanceConfirmationStatus: "confirmed",
      attendanceConfirmationRequestedAt: context.seededAt,
      attendanceConfirmationRespondedAt: context.seededAt,
    },
    {
      eventId: "event-group-warsaw-source",
      participantKey: "ola",
      priority: "stali",
      status: "confirmed",
      source: "auto-core",
      attendanceConfirmationStatus: "confirmed",
      attendanceConfirmationRequestedAt: context.seededAt,
      attendanceConfirmationRespondedAt: context.seededAt,
    },
    {
      eventId: "event-group-warsaw-target",
      participantKey: "ola",
      priority: "stali",
      status: "invited",
      source: "auto-core",
      attendanceConfirmationStatus: "not-required",
    },
    {
      eventId: "event-group-warsaw-target",
      participantKey: "anna",
      priority: "rezerwowi",
      status: "invited",
      source: "organizer",
      attendanceConfirmationStatus: "not-required",
    },
    {
      eventId: "event-group-online-post",
      participantKey: "ola",
      priority: "stali",
      status: "confirmed",
      source: "auto-core",
      attendanceConfirmationStatus: "confirmed",
      attendanceConfirmationRequestedAt: context.seededAt,
      attendanceConfirmationRespondedAt: context.seededAt,
    },
    {
      eventId: "event-group-online-post",
      participantKey: "tomasz",
      priority: "regularni",
      status: "invited",
      source: "organizer",
      attendanceConfirmationStatus: "pending",
      attendanceConfirmationRequestedAt: context.seededAt,
      attendanceConfirmationExpiresAt: eventsById.get("event-group-online-post").startsAt,
    },
  ];

  return definitions.map((definition) => {
    const event = eventsById.get(definition.eventId);
    const participant = participantEntitiesByKey.get(definition.participantKey);

    return {
      id: buildEventParticipantId(event.id, participant.profileId),
      eventId: event.id,
      eventTitle: event.title,
      groupId: event.groupId,
      groupName: event.groupName,
      organizerId: event.organizerId,
      organizerUserId: event.organizerUserId,
      trainerId: event.trainerId,
      trainerUserId: event.trainerUserId,
      participantProfileId: participant.profileId,
      participantDisplayName: participant.displayName,
      participantPhone: participant.phone,
      participantUserId: participant.linkedUserId ?? null,
      priority: definition.priority,
      status: definition.status,
      source: definition.source,
      overCapacity: false,
      invitedAt: context.seededAt,
      attendanceConfirmationStatus: definition.attendanceConfirmationStatus,
      attendanceConfirmationRequestedAt: definition.attendanceConfirmationRequestedAt ?? null,
      attendanceConfirmationRespondedAt: definition.attendanceConfirmationRespondedAt ?? null,
      attendanceConfirmationExpiresAt: definition.attendanceConfirmationExpiresAt ?? null,
      confirmedAt: definition.status === "confirmed" ? context.seededAt : null,
      declinedAt: definition.status === "declined" ? context.seededAt : null,
      removedAt: definition.status === "removed" ? context.seededAt : null,
      updatedAt: context.seededAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      sourceScript: SCRIPT_SOURCE,
    };
  });
}

function buildEnrollmentRequests(context, eventsById, participantEntitiesByKey, eventParticipantsById) {
  const groupSourceEvent = eventsById.get("event-group-warsaw-source");
  const groupTargetEvent = eventsById.get("event-group-warsaw-target");
  const publicFormParticipant = participantEntitiesByKey.get("grzegorzE");
  const publicFormRosterEntry = eventParticipantsById.get(
    buildEventParticipantId(groupSourceEvent.id, publicFormParticipant.profileId),
  );
  const trainerJacek = context.trainersByKey.get("jacek");
  const organizerKarolina = context.organizersByKey.get("karolina");

  return [
    {
      id: "request-group-warsaw-public-form-synced",
      eventId: groupSourceEvent.id,
      trainerId: trainerJacek.profileId,
      organizerId: organizerKarolina.profileId,
      submitterUid: publicFormParticipant.linkedUserId,
      participantProfileId: publicFormParticipant.profileId,
      eventParticipantId: publicFormRosterEntry.id,
      normalizedPhone: normalizePhoneLookupKey(publicFormParticipant.phone),
      trainerUserId: trainerJacek.userId,
      organizerUserId: organizerKarolina.userId,
      trainerContactName: trainerJacek.displayName,
      trainerContactPhone: trainerJacek.phone,
      trainerContactEmail: trainerJacek.email,
      organizerContactPhone: organizerKarolina.phone,
      organizerContactEmail: organizerKarolina.email,
      organizerContactName: organizerKarolina.displayName,
      imieNazwisko: publicFormParticipant.displayName,
      telefon: publicFormParticipant.phone,
      polecenieOdKogo: "Formularz publiczny grupy warszawskiej",
      wiadomosc: "Chcę dołączyć do tej grupy i przetestować nowy roster grupowy.",
      photoStatus: "ready",
      trainerDecision: "accepted",
      organizerDecision: "accepted",
      finalStatus: "accepted",
      participantStatus: "active",
      participantManagedAt: context.seededAt,
      participantActionSource: "staff",
      attendanceConfirmationStatus: "pending",
      attendanceConfirmationRequestedAt: context.seededAt,
      attendanceConfirmationRespondedAt: null,
      requiresOrganizerApproval: true,
      createdAt: context.seededAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    },
    {
      id: "request-group-warsaw-intake-pending",
      eventId: groupTargetEvent.id,
      trainerId: trainerJacek.profileId,
      organizerId: organizerKarolina.profileId,
      submitterUid: null,
      participantProfileId: null,
      eventParticipantId: null,
      normalizedPhone: normalizePhoneLookupKey("+48 605 100 307"),
      trainerUserId: trainerJacek.userId,
      organizerUserId: organizerKarolina.userId,
      trainerContactName: trainerJacek.displayName,
      trainerContactPhone: trainerJacek.phone,
      trainerContactEmail: trainerJacek.email,
      organizerContactPhone: organizerKarolina.phone,
      organizerContactEmail: organizerKarolina.email,
      organizerContactName: organizerKarolina.displayName,
      imieNazwisko: "Paweł Nowik",
      telefon: "+48 605 100 307",
      polecenieOdKogo: "Czeka na wolne miejsce w grupie",
      wiadomosc: "Chętnie dołączę, jeśli zwolni się miejsce na kolejnym terminie.",
      photoStatus: "pending",
      trainerDecision: "pending",
      organizerDecision: "pending",
      finalStatus: "pending",
      participantStatus: "active",
      participantManagedAt: null,
      participantActionSource: "staff",
      attendanceConfirmationStatus: "not-required",
      attendanceConfirmationRequestedAt: null,
      attendanceConfirmationRespondedAt: null,
      requiresOrganizerApproval: true,
      createdAt: context.seededAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    },
    {
      id: "request-group-online-intake-partial",
      eventId: "event-group-online-post",
      trainerId: context.trainersByKey.get("dorota").profileId,
      organizerId: context.organizersByKey.get("demo").profileId,
      submitterUid: participantEntitiesByKey.get("ola").linkedUserId,
      participantProfileId: participantEntitiesByKey.get("ola").profileId,
      eventParticipantId: null,
      normalizedPhone: normalizePhoneLookupKey(participantEntitiesByKey.get("ola").phone),
      trainerUserId: context.trainersByKey.get("dorota").userId,
      organizerUserId: context.organizersByKey.get("demo").userId,
      trainerContactName: context.trainersByKey.get("dorota").displayName,
      trainerContactPhone: context.trainersByKey.get("dorota").phone,
      trainerContactEmail: context.trainersByKey.get("dorota").email,
      organizerContactPhone: context.organizersByKey.get("demo").phone,
      organizerContactEmail: context.organizersByKey.get("demo").email,
      organizerContactName: context.organizersByKey.get("demo").displayName,
      imieNazwisko: participantEntitiesByKey.get("ola").displayName,
      telefon: participantEntitiesByKey.get("ola").phone,
      polecenieOdKogo: "Stała uczestniczka grupy online",
      wiadomosc: "Organizer może zdecydować, czy dopiąć ją do konkretnego rosteru.",
      photoStatus: "ready",
      trainerDecision: "accepted",
      organizerDecision: "pending",
      finalStatus: "partial",
      participantStatus: "active",
      participantManagedAt: null,
      participantActionSource: "staff",
      attendanceConfirmationStatus: "not-required",
      attendanceConfirmationRequestedAt: null,
      attendanceConfirmationRespondedAt: null,
      requiresOrganizerApproval: true,
      createdAt: context.seededAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    },
  ];
}

async function wipeCollection(db, collectionName, predicate = null) {
  const documents = await listCollectionDocuments(db, collectionName);
  const targets = predicate ? documents.filter(predicate) : documents;

  for (const document of targets) {
    await deleteFirestoreDocument(db, collectionName, document.id);
  }

  return targets.map((document) => document.id);
}

async function resetParticipantUserLinks(db) {
  const users = await listCollectionDocuments(db, "users");

  const participantUsers = users.filter((user) => {
    if (user.role === "participant") {
      return true;
    }

    return Array.isArray(user.roles) && user.roles.includes("participant");
  });

  for (const user of participantUsers) {
    await writeFirestoreDocument(db, "users", user.id, {
      participantProfileId: null,
    });
  }

  return participantUsers.length;
}

function buildSeedContext(authUsersByEmail) {
  const trainersByKey = new Map(
    trainerSeeds.map((trainer) => {
      const authUser = authUsersByEmail.get(trainer.email);
      if (!authUser) {
        throw new Error(`Missing trainer account ${trainer.email}`);
      }

      return [
        trainer.key,
        {
          ...trainer,
          userId: authUser.uid,
        },
      ];
    }),
  );
  const organizersByKey = new Map(
    organizerSeeds.map((organizer) => {
      const authUser = authUsersByEmail.get(organizer.email);
      if (!authUser) {
        throw new Error(`Missing organizer account ${organizer.email}`);
      }

      return [
        organizer.key,
        {
          ...organizer,
          userId: authUser.uid,
        },
      ];
    }),
  );
  const participantEntitiesByKey = buildParticipantEntityMaps(authUsersByEmail);
  const seededAt = new Date().toISOString();

  const groupsById = new Map(
    groupSeeds.map((group) => {
      const trainer = trainersByKey.get(group.trainerKey);
      const organizer = organizersByKey.get(group.organizerKey);

      return [
        group.id,
        {
          id: group.id,
          name: group.name,
          organizerId: organizer.profileId,
          organizerUserId: organizer.userId,
          trainerId: trainer.profileId,
          trainerUserId: trainer.userId,
          status: "active",
          notes: group.notes,
          defaultLocation: group.defaultLocation,
          defaultEventType: group.defaultEventType,
          defaultCapacity: group.defaultCapacity,
          defaultTags: group.defaultTags,
          defaultConfirmationLeadTimeDays: group.defaultConfirmationLeadTimeDays,
          createdAt: seededAt,
          updatedAt: seededAt,
          seededFromDemo: true,
          seededAt,
          source: SCRIPT_SOURCE,
        },
      ];
    }),
  );

  return {
    seededAt,
    trainersByKey,
    organizersByKey,
    participantEntitiesByKey,
    groupsById,
  };
}

function buildParticipantProfiles(context) {
  const membershipsByParticipant = new Map();

  for (const membership of membershipSeeds) {
    const bucket = membershipsByParticipant.get(membership.participantKey) ?? [];
    bucket.push(membership);
    membershipsByParticipant.set(membership.participantKey, bucket);
  }

  return [...context.participantEntitiesByKey.entries()].map(([participantKey, participant]) => {
    const memberships = membershipsByParticipant.get(participantKey) ?? [];
    const groupIds = memberships.map((membership) => membership.groupId);
    const organizerIds = new Set();
    const organizerUserIds = new Set();
    const trainerIds = new Set();
    const trainerUserIds = new Set();

    for (const membership of memberships) {
      const group = context.groupsById.get(membership.groupId);
      organizerIds.add(group.organizerId);
      organizerUserIds.add(group.organizerUserId);
      trainerIds.add(group.trainerId);
      trainerUserIds.add(group.trainerUserId);
    }

    const { firstName, lastName } = splitDisplayName(participant.displayName);
    const firstMembershipGroup = memberships[0]
      ? context.groupsById.get(memberships[0].groupId)
      : null;

    return {
      id: participant.profileId,
      linkedUserId: participant.linkedUserId,
      displayName: participant.displayName,
      firstName,
      lastName,
      phone: participant.phone,
      phoneLookupKey: normalizePhoneLookupKey(participant.phone),
      email: participant.email ?? null,
      notes: participant.notes ?? null,
      referralSource: "demo-group-seed",
      confirmationStatus: participant.confirmationStatus,
      status: "active",
      managerOrganizerIds: [...organizerIds],
      managerOrganizerUserIds: [...organizerUserIds],
      managerTrainerIds: [...trainerIds],
      managerTrainerUserIds: [...trainerUserIds],
      groupIds,
      activeGroupIds: groupIds,
      createdAt: context.seededAt,
      updatedAt: context.seededAt,
      createdByOrganizerId: firstMembershipGroup?.organizerId ?? null,
      createdByUserId: firstMembershipGroup?.organizerUserId ?? participant.linkedUserId ?? null,
      confirmedAt: participant.confirmedAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    };
  });
}

function buildGroupMembers(context) {
  return membershipSeeds.map((membership) => {
    const group = context.groupsById.get(membership.groupId);
    const participant = context.participantEntitiesByKey.get(membership.participantKey);

    return {
      id: buildGroupMemberId(group.id, participant.profileId),
      groupId: group.id,
      organizerId: group.organizerId,
      organizerUserId: group.organizerUserId,
      trainerId: group.trainerId,
      trainerUserId: group.trainerUserId,
      participantProfileId: participant.profileId,
      participantUserId: participant.linkedUserId ?? null,
      participantDisplayName: participant.displayName,
      participantPhone: participant.phone,
      priority: membership.priority,
      membershipStatus: "active",
      notes: participant.notes ?? null,
      joinedAt: context.seededAt,
      removedAt: null,
      updatedAt: context.seededAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    };
  });
}

function buildTrainerAndOrganizerFeeds(context, approvedRelationDocs, slotDocs) {
  const trainerFeeds = [...context.trainersByKey.values()].map((trainer) => ({
    id: `trainer-calendar-feed-${trainer.profileId}`,
    trainerId: trainer.profileId,
    trainerUserId: trainer.userId,
    provider: "ical",
    url: trainer.feedUrl,
    enabled: true,
    lastSyncedAt: context.seededAt,
    lastSyncStatus: "success",
    lastSyncError: null,
    createdAt: context.seededAt,
    updatedAt: context.seededAt,
    seededFromDemo: true,
    seededAt: context.seededAt,
    source: SCRIPT_SOURCE,
  }));

  const organizerFeeds = [...context.organizersByKey.values()].map((organizer) => ({
    id: `organizer-calendar-feed-${organizer.profileId}`,
    organizerId: organizer.profileId,
    organizerUserId: organizer.userId,
    provider: "ical",
    url: organizer.feedUrl,
    enabled: true,
    lastSyncedAt: context.seededAt,
    lastSyncStatus: "success",
    lastSyncError: null,
    createdAt: context.seededAt,
    updatedAt: context.seededAt,
    seededFromDemo: true,
    seededAt: context.seededAt,
    source: SCRIPT_SOURCE,
  }));

  const relationFeeds = approvedRelationDocs.map((relation) => {
    const feedToken = `demo-feed-${relation.id}`;
    const matchedSharedSlotIds = slotDocs
      .filter(
        (slot) =>
          slot.trainerId === relation.trainerId && slot.organizerId === relation.organizerId,
      )
      .map((slot) => slot.id);

    return {
      id: `trainer-organizer-feed-${relation.id}`,
      relationId: relation.id,
      trainerId: relation.trainerId,
      organizerId: relation.organizerId,
      trainerUserId: relation.trainerUserId,
      organizerUserId: relation.organizerUserId,
      tokenVersion: 1,
      token: feedToken,
      tokenHash: hashToken(feedToken),
      enabled: true,
      createdAt: context.seededAt,
      updatedAt: context.seededAt,
      tokenRotatedAt: context.seededAt,
      publicFeedUrl: `https://panel.ceo/emandar/api/ical/trainer-organizer/${feedToken}.ics`,
      matchedSharedSlotIds,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    };
  });

  return {
    trainerFeeds,
    organizerFeeds,
    relationFeeds,
  };
}

async function wipeOfficialTrainingLayer(db) {
  const participantUserResetCount = await resetParticipantUserLinks(db);
  const deletedParticipantProfiles = await wipeCollection(db, "participantProfiles");
  const deletedGroups = await wipeCollection(db, "groups");
  const deletedGroupMembers = await wipeCollection(db, "groupMembers");
  const deletedEventParticipants = await wipeCollection(db, "eventParticipants");
  const deletedRelations = await wipeCollection(db, "trainerOrganizerRelations");
  const deletedAvailabilitySlots = await wipeCollection(db, "availabilitySlots");
  const deletedTrainerSharedSlots = await wipeCollection(db, "trainerSharedSlots");
  const deletedTrainerCalendarFeeds = await wipeCollection(db, "trainerCalendarFeeds");
  const deletedOrganizerCalendarFeeds = await wipeCollection(db, "organizerCalendarFeeds");
  const deletedOrganizerExternalBusyMonths = await wipeCollection(
    db,
    "organizerExternalBusyMonths",
  );
  const deletedTrainerOrganizerCalendarFeeds = await wipeCollection(
    db,
    "trainerOrganizerCalendarFeeds",
  );
  const deletedTrainerExternalBusyMonths = await wipeCollection(
    db,
    "trainerExternalBusyMonths",
  );

  const trainingEvents = await listCollectionDocuments(db, "trainingEvents");
  const deletedTrainingEvents = trainingEvents.filter(
    (event) => event.brandStatus !== "supported",
  );
  const deletedTrainingEventIds = new Set(deletedTrainingEvents.map((event) => event.id));

  const enrollmentRequests = await listCollectionDocuments(db, "enrollmentRequests");
  const deletedEnrollmentRequests = enrollmentRequests.filter((request) =>
    deletedTrainingEventIds.has(request.eventId),
  );
  const deletedEnrollmentRequestIds = new Set(
    deletedEnrollmentRequests.map((request) => request.id),
  );

  for (const request of deletedEnrollmentRequests) {
    await deleteFirestoreDocument(db, "enrollmentRequests", request.id);
  }

  for (const event of deletedTrainingEvents) {
    await deleteFirestoreDocument(db, "trainingEvents", event.id);
  }

  const smsDispatches = await listCollectionDocuments(db, "smsDispatches");
  const deletedSmsDispatches = smsDispatches.filter(
    (dispatch) =>
      deletedTrainingEventIds.has(dispatch.eventId) ||
      deletedEnrollmentRequestIds.has(dispatch.requestId),
  );
  for (const dispatch of deletedSmsDispatches) {
    await deleteFirestoreDocument(db, "smsDispatches", dispatch.id);
  }

  return {
    participantUserResetCount,
    participantProfiles: deletedParticipantProfiles.length,
    groups: deletedGroups.length,
    groupMembers: deletedGroupMembers.length,
    eventParticipants: deletedEventParticipants.length,
    relations: deletedRelations.length,
    availabilitySlots: deletedAvailabilitySlots.length,
    trainerSharedSlots: deletedTrainerSharedSlots.length,
    trainerCalendarFeeds: deletedTrainerCalendarFeeds.length,
    organizerCalendarFeeds: deletedOrganizerCalendarFeeds.length,
    organizerExternalBusyMonths: deletedOrganizerExternalBusyMonths.length,
    trainerOrganizerCalendarFeeds: deletedTrainerOrganizerCalendarFeeds.length,
    trainerExternalBusyMonths: deletedTrainerExternalBusyMonths.length,
    enrollmentRequests: deletedEnrollmentRequests.length,
    trainingEvents: deletedTrainingEvents.length,
    smsDispatches: deletedSmsDispatches.length,
  };
}

async function seedGroupedDemo(db, authUsersByEmail) {
  const context = buildSeedContext(authUsersByEmail);
  const participantProfiles = buildParticipantProfiles(context);
  const groupMembers = buildGroupMembers(context);

  const approvedRelationDocs = approvedRelations.map((relation) => {
    const trainer = context.trainersByKey.get(relation.trainerKey);
    const organizer = context.organizersByKey.get(relation.organizerKey);
    return {
      id: buildRelationId(trainer.profileId, organizer.profileId),
      trainerId: trainer.profileId,
      organizerId: organizer.profileId,
      trainerUserId: trainer.userId,
      organizerUserId: organizer.userId,
      status: relation.status,
      requestedBy: relation.requestedBy,
      createdAt: context.seededAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    };
  });

  const secondaryRelationDocs = secondaryRelations.map((relation) => {
    const trainer = context.trainersByKey.get(relation.trainerKey);
    const organizer = context.organizersByKey.get(relation.organizerKey);
    return {
      id: buildRelationId(trainer.profileId, organizer.profileId),
      trainerId: trainer.profileId,
      organizerId: organizer.profileId,
      trainerUserId: trainer.userId,
      organizerUserId: organizer.userId,
      status: relation.status,
      requestedBy: relation.requestedBy,
      createdAt: context.seededAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    };
  });

  const slotDocs = buildSlotDefinitions(context);
  const feedDocs = buildTrainerAndOrganizerFeeds(context, approvedRelationDocs, slotDocs);
  const eventDocs = buildEventDefinitions(context);
  const eventsById = new Map(eventDocs.map((event) => [event.id, event]));
  const eventParticipantDocs = buildEventParticipantDefinitions(
    context,
    eventsById,
    context.participantEntitiesByKey,
  );
  const eventParticipantsById = new Map(
    eventParticipantDocs.map((participant) => [participant.id, participant]),
  );
  const enrollmentRequests = buildEnrollmentRequests(
    context,
    eventsById,
    context.participantEntitiesByKey,
    eventParticipantsById,
  );

  const eventParticipantsByEventId = eventParticipantDocs.reduce((summary, participant) => {
    const bucket = summary.get(participant.eventId) ?? [];
    bucket.push(participant);
    summary.set(participant.eventId, bucket);
    return summary;
  }, new Map());

  for (const event of eventDocs) {
    event.enrolledCount = activeParticipantCount(
      eventParticipantsByEventId.get(event.id) ?? [],
    );
  }

  for (const trainer of context.trainersByKey.values()) {
    await writeFirestoreDocument(db, "users", trainer.userId, {
      trainerProfileId: trainer.profileId,
    });
  }

  for (const organizer of context.organizersByKey.values()) {
    await writeFirestoreDocument(db, "users", organizer.userId, {
      organizerProfileId: organizer.profileId,
    });
  }

  for (const participant of context.participantEntitiesByKey.values()) {
    if (!participant.linkedUserId) {
      continue;
    }

    const preferredTrainerIds =
      participant.key === "grzegorzE"
        ? [context.trainersByKey.get("jacek").profileId, context.trainersByKey.get("dorota").profileId]
        : participant.key === "grzegorzC"
          ? [context.trainersByKey.get("jacek").profileId, context.trainersByKey.get("marcin").profileId]
          : [context.trainersByKey.get("dorota").profileId];

    await writeFirestoreDocument(db, "users", participant.linkedUserId, {
      participantProfileId: participant.profileId,
      participantOnboardingCompletedAt: context.seededAt,
      selectedTrainerIds: preferredTrainerIds,
      approvedTrainerIds: preferredTrainerIds,
    });
  }

  for (const group of context.groupsById.values()) {
    await writeFirestoreDocument(db, "groups", group.id, group);
  }

  for (const relation of [...approvedRelationDocs, ...secondaryRelationDocs]) {
    await writeFirestoreDocument(db, "trainerOrganizerRelations", relation.id, relation);
  }

  for (const participantProfile of participantProfiles) {
    await writeFirestoreDocument(db, "participantProfiles", participantProfile.id, participantProfile);
  }

  for (const groupMember of groupMembers) {
    await writeFirestoreDocument(db, "groupMembers", groupMember.id, groupMember);
  }

  for (const trainerFeed of feedDocs.trainerFeeds) {
    await writeFirestoreDocument(db, "trainerCalendarFeeds", trainerFeed.id, trainerFeed);
  }

  for (const organizerFeed of feedDocs.organizerFeeds) {
    await writeFirestoreDocument(db, "organizerCalendarFeeds", organizerFeed.id, organizerFeed);
  }

  for (const relationFeed of feedDocs.relationFeeds) {
    await writeFirestoreDocument(db, "trainerOrganizerCalendarFeeds", relationFeed.id, relationFeed);
  }

  for (const slot of slotDocs) {
    await writeFirestoreDocument(db, "trainerSharedSlots", slot.id, slot);
  }

  for (const event of eventDocs) {
    await writeFirestoreDocument(db, "trainingEvents", event.id, event);
  }

  for (const eventParticipant of eventParticipantDocs) {
    await writeFirestoreDocument(db, "eventParticipants", eventParticipant.id, eventParticipant);
  }

  for (const request of enrollmentRequests) {
    await writeFirestoreDocument(db, "enrollmentRequests", request.id, request);
  }

  return {
    participantProfiles: participantProfiles.length,
    groups: context.groupsById.size,
    groupMembers: groupMembers.length,
    relations: approvedRelationDocs.length + secondaryRelationDocs.length,
    trainerFeeds: feedDocs.trainerFeeds.length,
    organizerFeeds: feedDocs.organizerFeeds.length,
    relationFeeds: feedDocs.relationFeeds.length,
    sharedSlots: slotDocs.length,
    events: eventDocs.length,
    eventParticipants: eventParticipantDocs.length,
    enrollmentRequests: enrollmentRequests.length,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const env = await loadEnvFromCandidates();
  const projectId = env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("Missing VITE_FIREBASE_PROJECT_ID in .env.local or .env.production.");
  }
  if (!env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_AUTH_DOMAIN || !env.VITE_FIREBASE_APP_ID) {
    throw new Error("Missing Firebase web config in env file.");
  }

  const app = getClientApp(env);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          projectId,
          apply,
          message:
            "Dry run only. Run with --apply to wipe the official training prototype layer and seed grouped demo data.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const authUsersByEmail = await ensureDemoAuthAccounts(auth, db);
  await signInWithEmailAndPassword(auth, trainerSeeds[0].email, PASSWORD);
  const wiped = await wipeOfficialTrainingLayer(db);
  const seeded = await seedGroupedDemo(db, authUsersByEmail);
  await signOut(auth);

  console.log(
    JSON.stringify(
      {
        projectId,
        apply,
        wiped,
        seeded,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
