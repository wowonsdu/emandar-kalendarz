import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, getFirestore, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const DOTENV_PATHS = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env.production"),
];

const trainerAccounts = [
  { email: "dariusz@emandar.pl", password: "kocham", displayName: "Dariusz", city: "Warszawa", seedIndex: 0 },
  { email: "jacek@emandar.pl", password: "kocham", displayName: "Jacek", city: "Warszawa", seedIndex: 1 },
  { email: "marcin@emandar.pl", password: "kocham", displayName: "Marcin", city: "Krakow", seedIndex: 2 },
  { email: "dorota@emandar.pl", password: "kocham", displayName: "Dorota", city: "Lublin", seedIndex: 3 },
  { email: "asia@emandar.pl", password: "kocham", displayName: "Asia", city: "Wroclaw", seedIndex: 4 },
  { email: "krzysiu@emandar.pl", password: "kocham", displayName: "Krzysiu", city: "Poznan", seedIndex: 5 },
  { email: "klaudia@emandar.pl", password: "kocham", displayName: "Klaudia", city: "Gdansk", seedIndex: 6 },
  { email: "beata@emandar.pl", password: "kocham", displayName: "Beata", city: "Lodz", seedIndex: 7 },
];

function getFutureEventCount(trainerIndex) {
  return 5 + (trainerIndex % 6);
}

function isoDate(baseDayOffset, hour) {
  const date = new Date(Date.UTC(2026, 2, 22 + baseDayOffset, hour, 0, 0, 0));
  return date.toISOString();
}

function makeFutureSchedule(dayOffset, durationDays = 2) {
  return Array.from({ length: durationDays }, (_, index) => ({
    startsAt: isoDate(dayOffset + index, 10),
    endsAt: isoDate(dayOffset + index, 17),
  }));
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

function buildCallablePayload(account, eventIndex) {
  const startOffset = 14 + account.seedIndex * 28 + eventIndex * 9;
  const durationDays = eventIndex % 3 === 2 ? 3 : 2;
  const trainingTypes = [
    "Warsztat",
    "Warsztat weekendowy",
    "Spotkanie grupowe",
    "Intensyw",
  ];
  const scheduleDays = makeFutureSchedule(startOffset, durationDays);

  return {
    summary: `Przyszly termin ${account.displayName} #${eventIndex + 1}`,
    description: `${account.displayName} prowadzi kolejne wydarzenie seedowane w przyszlym terminie. Rekord sluzy do testowania publicznego kalendarza i zapisow.`,
    type: trainingTypes[eventIndex % trainingTypes.length],
    scheduleDays,
    location: `${account.city} / ${account.city}`,
    tags: ["seed", "przyszle", "self-managed", account.displayName.toLowerCase()],
    capacity: 14 + ((account.seedIndex + eventIndex) % 8),
    isPublished: true,
    status: "confirmed",
    minimumParticipants: 6 + (eventIndex % 4),
    selfManagedByTrainer: true,
  };
}

async function main() {
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

  const app = initializeApp(firebaseConfig, "future-training-seed-callable");
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const db = getFirestore(app);
  const functions = getFunctions(app, "europe-west1");
  const createUnifiedTrainingEvent = httpsCallable(functions, "createUnifiedTrainingEvent");

  let eventCount = 0;

  for (const account of trainerAccounts) {
    const credential = await signInWithEmailAndPassword(auth, account.email, account.password);
    const userId = credential.user.uid;
    const userRef = doc(db, "users", userId);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      throw new Error(`Missing user doc for ${account.email}.`);
    }

    const userData = userSnapshot.data();
    const originalRole = userData.role;
    const needsTrainerRole = originalRole !== "trainer";

    if (needsTrainerRole) {
      await updateDoc(userRef, {
        role: "trainer",
      });
    }

    try {
      const futureEventCount = getFutureEventCount(account.seedIndex);

      for (let eventIndex = 0; eventIndex < futureEventCount; eventIndex += 1) {
        const payload = buildCallablePayload(account, eventIndex);
        await createUnifiedTrainingEvent(payload);
        eventCount += 1;
      }
    } finally {
      if (needsTrainerRole) {
        await updateDoc(userRef, {
          role: originalRole,
        });
      }

      await signOut(auth);
    }
  }

  console.log(`Created ${eventCount} future training events via callable flow.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
