import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import process from "node:process";
import { getApps, initializeApp, refreshToken } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const TRAINER_ID = "trainer-11";
const ORGANIZER_ID = "organizer-11";
const DARIUSZ_EMAIL = "dariusz@emandar.pl";
const LEGACY_ADMIN_EMAIL = "admin@emandar.pl";
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

function getAdminApp(projectId, refreshTokenValue) {
  const existing = getApps().find((app) => app.name === "dariusz-upsert");
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
    "dariusz-upsert",
  );
}

const trainerSortOrder = new Map([
  ["trainer-11", 1],
  ["trainer-1", 2],
  ["trainer-2", 3],
  ["trainer-10", 4],
  ["trainer-4", 5],
  ["trainer-5", 6],
  ["trainer-6", 7],
  ["trainer-3", 20],
]);

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
  const refreshToken = firebaseToolsConfig?.tokens?.refresh_token;

  if (!refreshToken) {
    throw new Error("Missing Firebase CLI refresh token.");
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
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

async function writeFirestoreDocument(
  projectId,
  accessToken,
  collectionName,
  docId,
  data,
  updateMask = [],
) {
  const query = new URLSearchParams();
  for (const field of updateMask) {
    query.append("updateMask.fieldPaths", field);
  }

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}`;
  const url = query.size > 0 ? `${baseUrl}?${query.toString()}` : baseUrl;

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

async function firestoreDocumentExists(projectId, accessToken, collectionName, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  return true;
}

async function ensureDariuszAuthUser(auth) {
  try {
    const existing = await auth.getUserByEmail(DARIUSZ_EMAIL);
    const updated = await auth.updateUser(existing.uid, {
      email: DARIUSZ_EMAIL,
      password: PASSWORD,
      displayName: "Dariusz",
    });
    return updated.uid;
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  try {
    const legacyAdmin = await auth.getUserByEmail(LEGACY_ADMIN_EMAIL);
    const updated = await auth.updateUser(legacyAdmin.uid, {
      email: DARIUSZ_EMAIL,
      password: PASSWORD,
      displayName: "Dariusz",
    });
    return updated.uid;
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const created = await auth.createUser({
    email: DARIUSZ_EMAIL,
    password: PASSWORD,
    displayName: "Dariusz",
  });
  return created.uid;
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
  const authUid = await ensureDariuszAuthUser(auth);
  const seededAt = new Date().toISOString();

  await auth.setCustomUserClaims(authUid, {
    admin: true,
  });

  await writeFirestoreDocument(projectId, accessToken, "users", authUid, {
    id: authUid,
    role: "admin",
    roles: ["admin", "trainer", "organizer"],
    primaryRole: "admin",
    displayName: "Dariusz",
    email: DARIUSZ_EMAIL,
    phone: "+48 600 100 100",
    avatarUrl: "https://i.pravatar.cc/320?img=12",
    status: "active",
    trainerProfileId: TRAINER_ID,
    organizerProfileId: ORGANIZER_ID,
    seededFromDemo: true,
    seededAt,
    source: "scripts/upsert-dariusz-admin-and-trainer-order.mjs",
  });

  await writeFirestoreDocument(projectId, accessToken, "trainers", TRAINER_ID, {
    id: TRAINER_ID,
    userId: authUid,
    slug: "dariusz",
    displayName: "Dariusz",
    sortOrder: 1,
    bio: "Nadzoruje cały system, a równolegle prowadzi strategiczne spotkania i szkolenia porządkujące procesy w organizacji.",
    specialties: ["Strategia", "Przeglad organizacji", "Procesy"],
    locations: ["Warszawa, mazowieckie", "Online"],
    isVisible: true,
    heroNote: "Laczy szeroki wglad w organizacje z bardzo konkretnym podejsciem do porzadkowania pracy i decyzji.",
    avatarUrl: "https://i.pravatar.cc/320?img=12",
    brandStatus: "official",
    seededAt,
    source: "scripts/upsert-dariusz-admin-and-trainer-order.mjs",
  });

  await writeFirestoreDocument(projectId, accessToken, "organizers", ORGANIZER_ID, {
    id: ORGANIZER_ID,
    userId: authUid,
    displayName: "Dariusz",
    description:
      "Prowadzi i nadzoruje organizacje szkolen Emandar, spina wspolprace, terminy i decyzje operacyjne.",
    isVisible: true,
    contactName: "Dariusz",
    location: "Warszawa, mazowieckie",
    seededAt,
    source: "scripts/upsert-dariusz-admin-and-trainer-order.mjs",
  });

  for (const [trainerId, sortOrder] of trainerSortOrder.entries()) {
    const trainerExists = await firestoreDocumentExists(
      projectId,
      accessToken,
      "trainers",
      trainerId,
    );

    if (!trainerExists) {
      console.log(`Skipping missing trainer ${trainerId} while updating sortOrder.`);
      continue;
    }

    await writeFirestoreDocument(
      projectId,
      accessToken,
      "trainers",
      trainerId,
      { sortOrder },
      ["sortOrder"],
    );
  }

  console.log(
    `Dariusz is ready. authUid=${authUid}, trainerId=${TRAINER_ID}, organizerId=${ORGANIZER_ID}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
