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

const SCRIPT_SOURCE = "scripts/seed-grouped-demo-data-extended.mjs";
const DOTENV_PATHS = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env.production"),
];
const PASSWORD = "kocham";
const HORIZON_MONTHS = 24;
const WAITLIST_PHONE_BASE = 608900000;
const GENERATED_PHONE_BASE = 607200000;

const trainers = [
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
    key: "dariusz",
    profileId: "trainer-11",
    displayName: "Dariusz",
    email: "dariusz@emandar.pl",
    phone: "+48 601 100 100",
    slug: "dariusz",
    city: "Warszawa",
    feedUrl: "https://panel.ceo/emandar/demo-ical/dariusz-private-demo.ics",
  },
];

const organizers = [
  {
    key: "anita",
    profileId: "organizer-anita",
    displayName: "Anita",
    email: "anita@emandar.pl",
    phone: "+48 602 100 204",
    city: "Warszawa",
    feedUrl: "https://panel.ceo/emandar/demo-ical/anita-busy-demo.ics",
  },
];

const authParticipantSeeds = [
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

const groupBlueprints = [
  {
    id: "group-anita-jacek-warszawa-centrum",
    name: "Warszawa • Oddech Centralny",
    trainerKey: "jacek",
    organizerKey: "anita",
    city: "Warszawa",
    location: "Warszawa / Centrum",
    typeLabel: "Warsztat oddechowy",
    defaultEventType: "training",
    capacity: 18,
    intervalWeeks: 6,
    startOffsetDays: 16,
    tags: ["warszawa", "oddech", "regularna-grupa"],
  },
  {
    id: "group-anita-jacek-praga",
    name: "Warszawa • Regeneracja Praga",
    trainerKey: "jacek",
    organizerKey: "anita",
    city: "Warszawa",
    location: "Warszawa / Praga",
    typeLabel: "Szkolenie regeneracyjne",
    defaultEventType: "training",
    capacity: 16,
    intervalWeeks: 8,
    startOffsetDays: 23,
    tags: ["warszawa", "praga", "regeneracja"],
  },
  {
    id: "group-anita-jacek-lodz",
    name: "Łódź • Kontakt i Uważność",
    trainerKey: "jacek",
    organizerKey: "anita",
    city: "Łódź",
    location: "Łódź / Śródmieście",
    typeLabel: "Warsztat kontaktu",
    defaultEventType: "training",
    capacity: 20,
    intervalWeeks: 10,
    startOffsetDays: 31,
    tags: ["łódź", "kontakt", "uważność"],
  },
  {
    id: "group-anita-jacek-bialystok",
    name: "Białystok • Grupa Uziemienia",
    trainerKey: "jacek",
    organizerKey: "anita",
    city: "Białystok",
    location: "Białystok / Centrum",
    typeLabel: "Warsztat uziemienia",
    defaultEventType: "training",
    capacity: 17,
    intervalWeeks: 12,
    startOffsetDays: 38,
    tags: ["białystok", "uziemienie", "warsztat"],
  },
  {
    id: "group-anita-jacek-online",
    name: "Online • Krąg Integracyjny",
    trainerKey: "jacek",
    organizerKey: "anita",
    city: "Online",
    location: "Online / Zoom",
    typeLabel: "Krąg integracyjny",
    defaultEventType: "post",
    capacity: 24,
    intervalWeeks: 4,
    startOffsetDays: 12,
    tags: ["online", "integracja", "krąg"],
  },
  {
    id: "group-anita-marcin-kazimierz",
    name: "Kraków • Regeneracja Kazimierz",
    trainerKey: "marcin",
    organizerKey: "anita",
    city: "Kraków",
    location: "Kraków / Kazimierz",
    typeLabel: "Szkolenie regeneracyjne",
    defaultEventType: "training",
    capacity: 18,
    intervalWeeks: 6,
    startOffsetDays: 18,
    tags: ["kraków", "kazimierz", "regeneracja"],
  },
  {
    id: "group-anita-marcin-katowice",
    name: "Katowice • Praktyka Regularna",
    trainerKey: "marcin",
    organizerKey: "anita",
    city: "Katowice",
    location: "Katowice / Centrum",
    typeLabel: "Praktyka regularna",
    defaultEventType: "training",
    capacity: 16,
    intervalWeeks: 8,
    startOffsetDays: 26,
    tags: ["katowice", "praktyka", "regularna-grupa"],
  },
  {
    id: "group-anita-marcin-rzeszow",
    name: "Rzeszów • Głębszy Kontakt",
    trainerKey: "marcin",
    organizerKey: "anita",
    city: "Rzeszów",
    location: "Rzeszów / Rynek",
    typeLabel: "Warsztat kontaktu",
    defaultEventType: "training",
    capacity: 17,
    intervalWeeks: 10,
    startOffsetDays: 35,
    tags: ["rzeszów", "kontakt", "warsztat"],
  },
  {
    id: "group-anita-marcin-wroclaw",
    name: "Wrocław • Reset i Oddech",
    trainerKey: "marcin",
    organizerKey: "anita",
    city: "Wrocław",
    location: "Wrocław / Nadodrze",
    typeLabel: "Warsztat resetu",
    defaultEventType: "training",
    capacity: 20,
    intervalWeeks: 12,
    startOffsetDays: 44,
    tags: ["wrocław", "reset", "oddech"],
  },
  {
    id: "group-anita-marcin-poznan",
    name: "Poznań • Warsztat Ciała",
    trainerKey: "marcin",
    organizerKey: "anita",
    city: "Poznań",
    location: "Poznań / Jeżyce",
    typeLabel: "Warsztat ciała",
    defaultEventType: "training",
    capacity: 15,
    intervalWeeks: 8,
    startOffsetDays: 52,
    tags: ["poznań", "ciało", "warsztat"],
  },
  {
    id: "group-anita-marcin-online",
    name: "Online • Krąg Po Procesie",
    trainerKey: "marcin",
    organizerKey: "anita",
    city: "Online",
    location: "Online / Zoom",
    typeLabel: "Krąg po procesie",
    defaultEventType: "post",
    capacity: 26,
    intervalWeeks: 6,
    startOffsetDays: 14,
    tags: ["online", "krąg", "integracja"],
  },
  {
    id: "group-anita-dariusz-post",
    name: "Warszawa • Post i Cisza",
    trainerKey: "dariusz",
    organizerKey: "anita",
    city: "Warszawa",
    location: "Warszawa / Żoliborz",
    typeLabel: "Proces postny",
    defaultEventType: "post",
    capacity: 18,
    intervalWeeks: 10,
    startOffsetDays: 20,
    tags: ["warszawa", "post", "cisza"],
  },
  {
    id: "group-anita-dariusz-lublin",
    name: "Lublin • Weekend Regeneracji",
    trainerKey: "dariusz",
    organizerKey: "anita",
    city: "Lublin",
    location: "Lublin / Stare Miasto",
    typeLabel: "Weekend regeneracji",
    defaultEventType: "training",
    capacity: 16,
    intervalWeeks: 12,
    startOffsetDays: 29,
    tags: ["lublin", "weekend", "regeneracja"],
  },
  {
    id: "group-anita-dariusz-gdansk",
    name: "Gdańsk • Integracja Męska",
    trainerKey: "dariusz",
    organizerKey: "anita",
    city: "Gdańsk",
    location: "Gdańsk / Wrzeszcz",
    typeLabel: "Krąg męski",
    defaultEventType: "training",
    capacity: 19,
    intervalWeeks: 8,
    startOffsetDays: 41,
    tags: ["gdańsk", "krąg", "męska-grupa"],
  },
  {
    id: "group-anita-dariusz-online",
    name: "Online • Domknięcie Procesu",
    trainerKey: "dariusz",
    organizerKey: "anita",
    city: "Online",
    location: "Online / Zoom",
    typeLabel: "Domknięcie procesu",
    defaultEventType: "post",
    capacity: 22,
    intervalWeeks: 6,
    startOffsetDays: 11,
    tags: ["online", "domknięcie", "proces"],
  },
];

const firstNames = [
  "Anna",
  "Piotr",
  "Marta",
  "Tomasz",
  "Joanna",
  "Mateusz",
  "Ewa",
  "Michał",
  "Paulina",
  "Karol",
  "Natalia",
  "Łukasz",
  "Katarzyna",
  "Paweł",
  "Monika",
  "Damian",
  "Agnieszka",
  "Adam",
  "Julia",
  "Szymon",
  "Magda",
  "Krzysztof",
  "Oliwia",
  "Wojciech",
  "Patrycja",
  "Kamil",
  "Weronika",
  "Bartosz",
  "Aleksandra",
  "Marcin",
  "Milena",
  "Igor",
  "Zofia",
  "Dawid",
  "Aneta",
  "Maciej",
];

const lastNames = [
  "Nowak",
  "Kowalski",
  "Wiśniewska",
  "Mazur",
  "Wójcik",
  "Kamiński",
  "Lewandowska",
  "Zieliński",
  "Szymańska",
  "Woźniak",
  "Dąbrowski",
  "Kozłowska",
  "Jankowski",
  "Król",
  "Wieczorek",
  "Wrona",
  "Baran",
  "Piotrowska",
  "Grabowski",
  "Kaczmarek",
  "Sawicka",
  "Pawlak",
  "Michalak",
  "Jaworska",
  "Malinowski",
  "Rutkowska",
  "Ostrowski",
  "Czarnecka",
  "Błaszczyk",
  "Tomczak",
  "Walczak",
  "Lis",
  "Stępień",
  "Romanowska",
  "Piekarski",
  "Sikora",
];

function hashToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicInt(seed, min, max) {
  const buffer = createHash("sha256").update(seed).digest();
  const number = buffer.readUInt32BE(0);
  return min + (number % (max - min + 1));
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

function addDays(baseDate, dayOffset) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

function addWeeks(baseDate, weekOffset) {
  return addDays(baseDate, weekOffset * 7);
}

function addMonths(baseDate, monthOffset) {
  const date = new Date(baseDate);
  date.setMonth(date.getMonth() + monthOffset);
  return date;
}

function atTime(date, hour, minute = 0) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

function buildScheduleDays(eventStartDate, eventTypeSystem) {
  if (eventTypeSystem === "post") {
    return [
      {
        startsAt: atTime(eventStartDate, 18, 0),
        endsAt: atTime(eventStartDate, 21, 0),
      },
    ];
  }

  return [
    {
      startsAt: atTime(eventStartDate, 10, 0),
      endsAt: atTime(eventStartDate, 17, 0),
    },
    {
      startsAt: atTime(addDays(eventStartDate, 1), 10, 0),
      endsAt: atTime(addDays(eventStartDate, 1), 16, 0),
    },
  ];
}

function loadBounds(scheduleDays) {
  return {
    startsAt: scheduleDays[0].startsAt,
    endsAt: scheduleDays[scheduleDays.length - 1].endsAt,
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
  const existing = getApps().find((app) => app.name === "seed-grouped-demo-extended");
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
    "seed-grouped-demo-extended",
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
    Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
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
    ...trainers.map((trainer) => ({
      role: "trainer",
      profileId: trainer.profileId,
      displayName: trainer.displayName,
      email: trainer.email,
      phone: trainer.phone,
    })),
    ...organizers.map((organizer) => ({
      role: "organizer",
      profileId: organizer.profileId,
      displayName: organizer.displayName,
      email: organizer.email,
      phone: organizer.phone,
    })),
    ...authParticipantSeeds.map((participant) => ({
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

function buildAuthParticipantEntities(authUsersByEmail) {
  return authParticipantSeeds.map((participant) => {
    const user = authUsersByEmail.get(participant.email);
    if (!user) {
      throw new Error(`Missing auth participant ${participant.email}`);
    }

    return {
      key: participant.key,
      displayName: participant.displayName,
      email: participant.email,
      phone: participant.phone,
      profileId: buildParticipantProfileId(participant.phone),
      linkedUserId: user.uid,
      confirmationStatus: "confirmed",
      confirmedAt: new Date().toISOString(),
      notes: "Uczestnik testowy z pełnym kontem logowania.",
    };
  });
}

function buildSeedContext(authUsersByEmail) {
  const trainersByKey = new Map(
    trainers.map((trainer) => {
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
    organizers.map((organizer) => {
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
  const seededAt = new Date().toISOString();

  const groupsById = new Map(
    groupBlueprints.map((group) => {
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
          notes: `Stała grupa ${group.city.toLowerCase()} prowadzona przez ${trainer.displayName} i koordynowana przez Anitę.`,
          defaultLocation: group.location,
          defaultEventType: group.defaultEventType,
          defaultCapacity: group.capacity,
          defaultTags: group.tags,
          defaultConfirmationLeadTimeDays: group.defaultEventType === "post" ? 3 : 6,
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
    groupsById,
    authParticipants: buildAuthParticipantEntities(authUsersByEmail),
  };
}

function buildGeneratedParticipantName(seedValue) {
  const firstName = firstNames[deterministicInt(`${seedValue}:first`, 0, firstNames.length - 1)];
  const lastName = lastNames[deterministicInt(`${seedValue}:last`, 0, lastNames.length - 1)];
  return `${firstName} ${lastName}`;
}

function buildGeneratedPhone(counter) {
  return `+48 ${String(GENERATED_PHONE_BASE + counter).slice(0, 3)} ${String(
    GENERATED_PHONE_BASE + counter,
  ).slice(3, 6)} ${String(GENERATED_PHONE_BASE + counter).slice(6, 9)}`;
}

function assignPriority(index, counts) {
  if (index < counts.stali) {
    return "stali";
  }

  if (index < counts.stali + counts.regularni) {
    return "regularni";
  }

  return "rezerwowi";
}

function buildParticipantUniverse(context) {
  const participantEntities = [];
  const memberships = [];
  let phoneCounter = 0;

  for (let groupIndex = 0; groupIndex < groupBlueprints.length; groupIndex += 1) {
    const blueprint = groupBlueprints[groupIndex];
    const group = context.groupsById.get(blueprint.id);
    const totalMembers = deterministicInt(`${group.id}:member-total`, 15, 30);
    const stali = Math.max(5, Math.floor(totalMembers * 0.34));
    const regularni = Math.max(4, Math.floor(totalMembers * 0.33));
    const rezerwowi = totalMembers - stali - regularni;
    const counts = { stali, regularni, rezerwowi };

    const injectedAuthParticipant = context.authParticipants[groupIndex % context.authParticipants.length];
    const authPriority = groupIndex % 3 === 0 ? "stali" : groupIndex % 3 === 1 ? "regularni" : "rezerwowi";

    memberships.push({
      groupId: group.id,
      participantKey: injectedAuthParticipant.key,
      priority: authPriority,
    });

    for (let memberIndex = 0; memberIndex < totalMembers - 1; memberIndex += 1) {
      phoneCounter += 1;
      const participantSeed = `${group.id}:participant:${memberIndex}`;
      const phone = buildGeneratedPhone(phoneCounter);
      const profileId = buildParticipantProfileId(phone);
      const displayName = buildGeneratedParticipantName(participantSeed);
      const participantKey = `${group.id}:participant:${memberIndex}`;
      const priority = assignPriority(memberIndex, counts);

      participantEntities.push({
        key: participantKey,
        profileId,
        displayName,
        phone,
        email: null,
        linkedUserId: null,
        notes:
          priority === "stali"
            ? "Stały członek grupy, zwykle potwierdza udział najszybciej."
            : priority === "regularni"
              ? "Regularnie wraca na wydarzenia grupy i reaguje po komunikacie organizatora."
              : "Rezerwowy kontakt w bazie organizatora, czeka na wolne miejsca.",
        confirmationStatus: "unconfirmed",
        confirmedAt: null,
      });

      memberships.push({
        groupId: group.id,
        participantKey,
        priority,
      });
    }
  }

  for (const authParticipant of context.authParticipants) {
    participantEntities.push(authParticipant);
  }

  return {
    participantEntitiesByKey: new Map(participantEntities.map((participant) => [participant.key, participant])),
    memberships,
  };
}

function buildParticipantProfiles(context, participantEntitiesByKey, memberships) {
  const membershipsByParticipant = new Map();

  for (const membership of memberships) {
    const bucket = membershipsByParticipant.get(membership.participantKey) ?? [];
    bucket.push(membership);
    membershipsByParticipant.set(membership.participantKey, bucket);
  }

  return [...participantEntitiesByKey.entries()].map(([participantKey, participant]) => {
    const participantMemberships = membershipsByParticipant.get(participantKey) ?? [];
    const groupIds = participantMemberships.map((membership) => membership.groupId);
    const organizerIds = new Set();
    const organizerUserIds = new Set();
    const trainerIds = new Set();
    const trainerUserIds = new Set();

    for (const membership of participantMemberships) {
      const group = context.groupsById.get(membership.groupId);
      if (!group) {
        continue;
      }

      organizerIds.add(group.organizerId);
      organizerUserIds.add(group.organizerUserId);
      trainerIds.add(group.trainerId);
      trainerUserIds.add(group.trainerUserId);
    }

    const { firstName, lastName } = splitDisplayName(participant.displayName);
    const firstMembershipGroup = participantMemberships[0]
      ? context.groupsById.get(participantMemberships[0].groupId)
      : null;

    return {
      id: participant.profileId,
      linkedUserId: participant.linkedUserId,
      displayName: participant.displayName,
      firstName,
      lastName,
      phone: participant.phone,
      phoneLookupKey: normalizePhoneLookupKey(participant.phone),
      email: participant.email,
      notes: participant.notes ?? null,
      referralSource: "demo-anita-extended-seed",
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

function buildGroupMembers(context, participantEntitiesByKey, memberships) {
  return memberships.map((membership) => {
    const group = context.groupsById.get(membership.groupId);
    const participant = participantEntitiesByKey.get(membership.participantKey);

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

function buildRelationDocs(context) {
  return trainers.map((trainer) => {
    const trainerProfile = context.trainersByKey.get(trainer.key);
    const organizer = context.organizersByKey.get("anita");
    return {
      id: buildRelationId(trainerProfile.profileId, organizer.profileId),
      trainerId: trainerProfile.profileId,
      organizerId: organizer.profileId,
      trainerUserId: trainerProfile.userId,
      organizerUserId: organizer.userId,
      status: "approved",
      requestedBy: "organizer",
      createdAt: context.seededAt,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    };
  });
}

function buildTrainerProfileDocs(context) {
  return trainers.map((trainer, index) => {
    const trainerProfile = context.trainersByKey.get(trainer.key);

    return {
      id: trainer.profileId,
      userId: trainerProfile.userId,
      slug: trainer.slug,
      displayName: trainer.displayName,
      sortOrder: index + 1,
      bio: `Profil demo ${trainer.displayName} do obslugi grup organizatora Anita.`,
      heroNote: `${trainer.displayName} prowadzi regularne grupy i wspiera organizacyjny workflow planowania terminow.`,
      specialties: ["Praca grupowa", "Planowanie", "Proces"],
      locations: [trainer.city, "Online"],
      isVisible: true,
      brandStatus: "official",
      defaultEnrollmentPhotoRequired: false,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    };
  });
}

function buildOrganizerProfileDocs(context) {
  return organizers.map((organizer) => {
    const organizerProfile = context.organizersByKey.get(organizer.key);

    return {
      id: organizer.profileId,
      userId: organizerProfile.userId,
      displayName: organizer.displayName,
      description:
        "Koordynuje wiele grup jednoczesnie i spina kalendarz trenerow z zapisami uczestnikow.",
      isVisible: true,
      contactName: organizer.displayName,
      location: organizer.city,
      seededFromDemo: true,
      seededAt: context.seededAt,
      source: SCRIPT_SOURCE,
    };
  });
}

function buildEventsAndSlots(context, participantEntitiesByKey, memberships) {
  const slots = [];
  const events = [];
  const membershipsByGroupId = memberships.reduce((summary, membership) => {
    const bucket = summary.get(membership.groupId) ?? [];
    bucket.push(membership);
    summary.set(membership.groupId, bucket);
    return summary;
  }, new Map());
  const horizonDate = addMonths(new Date(), HORIZON_MONTHS);

  for (const blueprint of groupBlueprints) {
    const group = context.groupsById.get(blueprint.id);
    const trainer = context.trainersByKey.get(blueprint.trainerKey);
    const organizer = context.organizersByKey.get(blueprint.organizerKey);
    const memberCount = membershipsByGroupId.get(group.id)?.length ?? 0;
    const baseDate = addDays(new Date(), blueprint.startOffsetDays);
    let eventIndex = 0;
    let eventDate = baseDate;

    while (eventDate <= horizonDate) {
      const scheduleDays = buildScheduleDays(eventDate, blueprint.defaultEventType);
      const { startsAt, endsAt } = loadBounds(scheduleDays);
      const slotId = `slot-${group.id}-${String(eventIndex + 1).padStart(2, "0")}`;
      const eventId = `event-${group.id}-${String(eventIndex + 1).padStart(2, "0")}`;
      const published = eventIndex < 10;
      const trainerAccepted = published || eventIndex < 14;
      const finalized = eventIndex < 2;

      slots.push({
        id: slotId,
        trainerId: trainer.profileId,
        trainerUserId: trainer.userId,
        organizerId: organizer.profileId,
        organizerUserId: organizer.userId,
        startsAt,
        endsAt,
        location: blueprint.location,
        notes: `Slot dla ${group.name} #${eventIndex + 1}.`,
        visibility: "approved-organizers",
        source: eventIndex % 2 === 0 ? "ical-derived" : "manual",
        status: "active",
        createdAt: context.seededAt,
        updatedAt: context.seededAt,
        seededFromDemo: true,
        seededAt: context.seededAt,
        sourceScript: SCRIPT_SOURCE,
      });

      events.push({
        id: eventId,
        trainerId: trainer.profileId,
        trainerProfileId: trainer.profileId,
        organizerId: organizer.profileId,
        organizerProfileId: organizer.profileId,
        groupId: group.id,
        groupName: group.name,
        trainerUserId: trainer.userId,
        organizerUserId: organizer.userId,
        creatorUserId: organizer.userId,
        creatorDisplayName: organizer.displayName,
        creatorPhone: organizer.phone,
        title: `${group.name} #${eventIndex + 1}`,
        summary: `Termin grupy ${group.name} zaplanowany przez Anitę z ${trainer.displayName}.`,
        description:
          published
            ? `Opublikowany termin grupy ${group.name} na osi 24 miesięcy do przodu.`
            : trainerAccepted
              ? `Termin zaakceptowany przez trenera i czekający na dalszą obsługę organizatora.`
              : `Draft dalszego planowania grupy ${group.name} w kalendarzu Anity.`,
        type: blueprint.typeLabel,
        eventTypeSystem: blueprint.defaultEventType,
        startsAt,
        endsAt,
        scheduleDays,
        location: blueprint.location,
        tags: [...blueprint.tags, trainer.slug],
        capacity: blueprint.capacity,
        enrolledCount: 0,
        isPublished: published,
        imageHint: `${blueprint.trainerKey}-${blueprint.city.toLowerCase()}`,
        brandStatus: "official",
        status: published ? "confirmed" : "active",
        workflowStatus: published
          ? "published"
          : trainerAccepted
            ? "trainer-accepted"
            : "draft-requested",
        sharedSlotId: slotId,
        publishAutomaticallyAfterTrainerApproval: published,
        minimumParticipants: Math.max(6, Math.min(10, Math.floor(memberCount * 0.35))),
        requiresOrganizerApproval: true,
        eligibleGroupPriorities: ["stali", "regularni", "rezerwowi"],
        confirmationLeadTimeDays: group.defaultConfirmationLeadTimeDays,
        trainerCollaborationStatus: published || trainerAccepted ? "accepted" : "pending",
        organizerCollaborationStatus: "accepted",
        selfManagedByTrainer: false,
        createdByRole: "organizer",
        publicationApprovalStatus: null,
        trainerDecidedAt: published || trainerAccepted ? context.seededAt : null,
        trainerDecidedByUserId: published || trainerAccepted ? trainer.userId : null,
        trainerDecisionReason: null,
        rosterFinalizedAt: finalized ? context.seededAt : null,
        rosterFinalizedByUserId: finalized ? organizer.userId : null,
        createdAt: context.seededAt,
        updatedAt: context.seededAt,
        seededFromDemo: true,
        seededAt: context.seededAt,
        source: SCRIPT_SOURCE,
      });

      eventIndex += 1;
      eventDate = addWeeks(eventDate, blueprint.intervalWeeks);
    }
  }

  return { slots, events };
}

function sortMembershipsForRoster(groupMemberships) {
  const priorityWeight = {
    stali: 0,
    regularni: 1,
    rezerwowi: 2,
  };

  return [...groupMemberships].sort((left, right) => {
    const leftWeight = priorityWeight[left.priority] ?? 99;
    const rightWeight = priorityWeight[right.priority] ?? 99;
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return left.participantKey.localeCompare(right.participantKey);
  });
}

function buildEventParticipantsAndRequests(context, events, participantEntitiesByKey, memberships) {
  const eventsByGroupId = events.reduce((summary, event) => {
    const bucket = summary.get(event.groupId) ?? [];
    bucket.push(event);
    summary.set(event.groupId, bucket);
    return summary;
  }, new Map());
  const membershipsByGroupId = memberships.reduce((summary, membership) => {
    const bucket = summary.get(membership.groupId) ?? [];
    bucket.push(membership);
    summary.set(membership.groupId, bucket);
    return summary;
  }, new Map());
  const eventParticipants = [];
  const enrollmentRequests = [];
  let waitlistCounter = 0;

  for (const blueprint of groupBlueprints) {
    const group = context.groupsById.get(blueprint.id);
    const trainer = context.trainersByKey.get(blueprint.trainerKey);
    const organizer = context.organizersByKey.get(blueprint.organizerKey);
    const groupEvents = eventsByGroupId.get(group.id) ?? [];
    const sortedMemberships = sortMembershipsForRoster(membershipsByGroupId.get(group.id) ?? []);

    for (let eventIndex = 0; eventIndex < groupEvents.length; eventIndex += 1) {
      const event = groupEvents[eventIndex];
      if (!event.isPublished || eventIndex > 3) {
        continue;
      }

      const targetActiveCount = Math.min(
        blueprint.capacity - 1,
        deterministicInt(`${event.id}:active-count`, 8, Math.min(blueprint.capacity, 13)),
      );
      const selectedMemberships = sortedMemberships.slice(
        0,
        Math.min(sortedMemberships.length, targetActiveCount + 2),
      );

      for (let memberIndex = 0; memberIndex < selectedMemberships.length; memberIndex += 1) {
        const membership = selectedMemberships[memberIndex];
        const participant = participantEntitiesByKey.get(membership.participantKey);
        const isWaitlist = memberIndex >= targetActiveCount;
        const eventParticipantId = buildEventParticipantId(event.id, participant.profileId);
        const source =
          eventIndex === 0 && memberIndex === 0
            ? "public-form"
            : membership.priority === "stali"
              ? "auto-core"
              : "organizer";
        const status = isWaitlist ? "declined" : memberIndex % 3 === 0 ? "invited" : "confirmed";
        const attendanceConfirmationStatus =
          status === "confirmed"
            ? "confirmed"
            : status === "declined"
              ? "declined"
              : eventIndex < 2
                ? "pending"
                : "not-required";

        eventParticipants.push({
          id: eventParticipantId,
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
          priority: membership.priority,
          status,
          source,
          overCapacity: false,
          invitedAt: context.seededAt,
          attendanceConfirmationStatus,
          attendanceConfirmationRequestedAt:
            attendanceConfirmationStatus === "pending" ? context.seededAt : null,
          attendanceConfirmationRespondedAt:
            attendanceConfirmationStatus === "confirmed" ? context.seededAt : null,
          attendanceConfirmationExpiresAt:
            attendanceConfirmationStatus === "pending" ? event.startsAt : null,
          confirmedAt: status === "confirmed" ? context.seededAt : null,
          declinedAt: status === "declined" ? context.seededAt : null,
          removedAt: null,
          updatedAt: context.seededAt,
          seededFromDemo: true,
          seededAt: context.seededAt,
          sourceScript: SCRIPT_SOURCE,
        });

        if (eventIndex === 0 && memberIndex === 0) {
          enrollmentRequests.push({
            id: `request-${event.id}-${participant.profileId}-synced`,
            eventId: event.id,
            trainerId: trainer.profileId,
            organizerId: organizer.profileId,
            submitterUid: participant.linkedUserId,
            participantProfileId: participant.profileId,
            eventParticipantId,
            normalizedPhone: normalizePhoneLookupKey(participant.phone),
            trainerUserId: trainer.userId,
            organizerUserId: organizer.userId,
            trainerContactName: trainer.displayName,
            trainerContactPhone: trainer.phone,
            trainerContactEmail: trainer.email,
            organizerContactPhone: organizer.phone,
            organizerContactEmail: organizer.email,
            organizerContactName: organizer.displayName,
            imieNazwisko: participant.displayName,
            telefon: participant.phone,
            polecenieOdKogo: `Formularz publiczny grupy ${group.name}`,
            wiadomosc: "Chcę dołączyć do regularnych terminów tej grupy i mieć miejsce na liście.",
            photoStatus: "ready",
            trainerDecision: "accepted",
            organizerDecision: "accepted",
            finalStatus: "accepted",
            participantStatus: "active",
            participantManagedAt: context.seededAt,
            participantActionSource: "staff",
            attendanceConfirmationStatus:
              attendanceConfirmationStatus === "confirmed" ? "confirmed" : "pending",
            attendanceConfirmationRequestedAt: context.seededAt,
            attendanceConfirmationRespondedAt:
              attendanceConfirmationStatus === "confirmed" ? context.seededAt : null,
            requiresOrganizerApproval: true,
            createdAt: context.seededAt,
            seededFromDemo: true,
            seededAt: context.seededAt,
            source: SCRIPT_SOURCE,
          });
        }
      }

      if (eventIndex < 2) {
        waitlistCounter += 1;
        const waitlistPhone = `+48 ${String(WAITLIST_PHONE_BASE + waitlistCounter).slice(0, 3)} ${String(
          WAITLIST_PHONE_BASE + waitlistCounter,
        ).slice(3, 6)} ${String(WAITLIST_PHONE_BASE + waitlistCounter).slice(6, 9)}`;
        enrollmentRequests.push({
          id: `request-${event.id}-waitlist-${waitlistCounter}`,
          eventId: event.id,
          trainerId: trainer.profileId,
          organizerId: organizer.profileId,
          submitterUid: null,
          participantProfileId: null,
          eventParticipantId: null,
          normalizedPhone: normalizePhoneLookupKey(waitlistPhone),
          trainerUserId: trainer.userId,
          organizerUserId: organizer.userId,
          trainerContactName: trainer.displayName,
          trainerContactPhone: trainer.phone,
          trainerContactEmail: trainer.email,
          organizerContactPhone: organizer.phone,
          organizerContactEmail: organizer.email,
          organizerContactName: organizer.displayName,
          imieNazwisko: buildGeneratedParticipantName(`${event.id}:waitlist:${waitlistCounter}`),
          telefon: waitlistPhone,
          polecenieOdKogo: "Lista rezerwowa grupy",
          wiadomosc: "Chcę wejść na listę rezerwową i dostać znać, jeśli zwolni się miejsce.",
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
        });
      }
    }
  }

  const eventParticipantsByEventId = eventParticipants.reduce((summary, participant) => {
    const bucket = summary.get(participant.eventId) ?? [];
    bucket.push(participant);
    summary.set(participant.eventId, bucket);
    return summary;
  }, new Map());

  for (const event of events) {
    event.enrolledCount = activeParticipantCount(eventParticipantsByEventId.get(event.id) ?? []);
  }

  return {
    eventParticipants,
    enrollmentRequests,
  };
}

function buildFeeds(context, approvedRelationDocs, slots) {
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
    const feedToken = `extended-demo-feed-${relation.id}`;
    const matchedSharedSlotIds = slots
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

async function writeDocumentsChunked(db, collectionName, documents, chunkSize = 25) {
  for (let index = 0; index < documents.length; index += chunkSize) {
    const chunk = documents.slice(index, index + chunkSize);
    await Promise.all(
      chunk.map((documentData) =>
        writeFirestoreDocument(db, collectionName, documentData.id, documentData),
      ),
    );
  }
}

async function seedExtendedDemo(db, authUsersByEmail) {
  const context = buildSeedContext(authUsersByEmail);
  const { participantEntitiesByKey, memberships } = buildParticipantUniverse(context);
  const participantProfiles = buildParticipantProfiles(
    context,
    participantEntitiesByKey,
    memberships,
  );
  const groupMembers = buildGroupMembers(context, participantEntitiesByKey, memberships);
  const relationDocs = buildRelationDocs(context);
  const trainerProfileDocs = buildTrainerProfileDocs(context);
  const organizerProfileDocs = buildOrganizerProfileDocs(context);
  const { slots, events } = buildEventsAndSlots(context, participantEntitiesByKey, memberships);
  const { eventParticipants, enrollmentRequests } = buildEventParticipantsAndRequests(
    context,
    events,
    participantEntitiesByKey,
    memberships,
  );
  const feedDocs = buildFeeds(context, relationDocs, slots);

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

  for (const participant of context.authParticipants) {
    const trainerKey =
      participant.key === "grzegorzE"
        ? "jacek"
        : participant.key === "grzegorzC"
          ? "marcin"
          : "dariusz";
    const preferredTrainerId = context.trainersByKey.get(trainerKey).profileId;

    await writeFirestoreDocument(db, "users", participant.linkedUserId, {
      participantProfileId: participant.profileId,
      participantOnboardingCompletedAt: context.seededAt,
      selectedTrainerIds: [preferredTrainerId],
      approvedTrainerIds: [preferredTrainerId],
    });
  }

  await writeDocumentsChunked(db, "trainers", trainerProfileDocs);
  await writeDocumentsChunked(db, "organizers", organizerProfileDocs);
  await writeDocumentsChunked(db, "groups", [...context.groupsById.values()]);
  await writeDocumentsChunked(db, "trainerOrganizerRelations", relationDocs);
  await writeDocumentsChunked(db, "participantProfiles", participantProfiles);
  await writeDocumentsChunked(db, "groupMembers", groupMembers);
  await writeDocumentsChunked(db, "trainerCalendarFeeds", feedDocs.trainerFeeds);
  await writeDocumentsChunked(db, "organizerCalendarFeeds", feedDocs.organizerFeeds);
  await writeDocumentsChunked(db, "trainerOrganizerCalendarFeeds", feedDocs.relationFeeds);
  await writeDocumentsChunked(db, "trainerSharedSlots", slots);
  await writeDocumentsChunked(db, "trainingEvents", events);
  await writeDocumentsChunked(db, "eventParticipants", eventParticipants);
  await writeDocumentsChunked(db, "enrollmentRequests", enrollmentRequests);

  const groupsByTrainer = groupBlueprints.reduce((summary, group) => {
    summary[group.trainerKey] = (summary[group.trainerKey] ?? 0) + 1;
    return summary;
  }, {});

  return {
    organizer: organizers[0].email,
    groupsByTrainer,
    participantProfiles: participantProfiles.length,
    groups: groupBlueprints.length,
    groupMembers: groupMembers.length,
    relations: relationDocs.length,
    trainerFeeds: feedDocs.trainerFeeds.length,
    organizerFeeds: feedDocs.organizerFeeds.length,
    relationFeeds: feedDocs.relationFeeds.length,
    sharedSlots: slots.length,
    events: events.length,
    eventParticipants: eventParticipants.length,
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
            "Dry run only. Run with --apply to wipe the official training prototype layer and seed the extended Anita organizer scenario.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const authUsersByEmail = await ensureDemoAuthAccounts(auth, db);
  await signInWithEmailAndPassword(auth, trainers[0].email, PASSWORD);
  const wiped = await wipeOfficialTrainingLayer(db);
  const seeded = await seedExtendedDemo(db, authUsersByEmail);
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
