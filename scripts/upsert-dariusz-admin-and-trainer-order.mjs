import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import process from "node:process";

const PROJECT_ID = "emandar-c1e15";
const TRAINER_ID = "trainer-11";
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

const trainerSortOrder = new Map([
  ["trainer-11", 1],
  ["trainer-1", 2],
  ["trainer-2", 3],
  ["trainer-10", 4],
  ["trainer-4", 5],
  ["trainer-5", 6],
  ["trainer-6", 7],
  ["trainer-3", 20],
  ["trainer-7", 100],
  ["trainer-8", 101],
  ["trainer-9", 102],
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

async function signInWithPassword(apiKey, email, password) {
  return firebaseRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
}

async function signUp(apiKey, email, password) {
  return firebaseRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );
}

async function updateAccount(apiKey, idToken, payload) {
  return firebaseRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        returnSecureToken: true,
        ...payload,
      }),
    },
  );
}

async function ensureDariuszAuthUser(apiKey) {
  try {
    const signedIn = await signInWithPassword(apiKey, DARIUSZ_EMAIL, PASSWORD);
    return signedIn.localId;
  } catch {
    // continue
  }

  try {
    const legacyAdmin = await signInWithPassword(apiKey, LEGACY_ADMIN_EMAIL, PASSWORD);
    await updateAccount(apiKey, legacyAdmin.idToken, {
      email: DARIUSZ_EMAIL,
      password: PASSWORD,
      displayName: "Dariusz",
    });
    return legacyAdmin.localId;
  } catch {
    // continue
  }

  const created = await signUp(apiKey, DARIUSZ_EMAIL, PASSWORD);
  await updateAccount(apiKey, created.idToken, {
    displayName: "Dariusz",
  });
  return created.localId;
}

async function main() {
  const env = await loadEnvFile(DOTENV_PATH);
  const apiKey = env.VITE_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing VITE_FIREBASE_API_KEY in .env.local.");
  }

  const firebaseToolsConfig = await loadFirebaseToolsConfig();
  const accessToken = await refreshFirebaseToolsAccessToken(firebaseToolsConfig);
  const authUid = await ensureDariuszAuthUser(apiKey);
  const seededAt = new Date().toISOString();

  await writeFirestoreDocument(PROJECT_ID, accessToken, "users", authUid, {
    id: authUid,
    role: "admin",
    displayName: "Dariusz",
    email: DARIUSZ_EMAIL,
    phone: "+48 600 100 100",
    avatarUrl: "https://i.pravatar.cc/320?img=12",
    status: "active",
      trainerProfileId: TRAINER_ID,
    seededFromDemo: true,
    seededAt,
    source: "scripts/upsert-dariusz-admin-and-trainer-order.mjs",
  });

  await writeFirestoreDocument(PROJECT_ID, accessToken, "trainers", TRAINER_ID, {
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

  for (const [trainerId, sortOrder] of trainerSortOrder.entries()) {
    await writeFirestoreDocument(
      PROJECT_ID,
      accessToken,
      "trainers",
      trainerId,
      { sortOrder },
      ["sortOrder"],
    );
  }

  console.log(`Dariusz is ready. authUid=${authUid}, trainerId=${TRAINER_ID}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
