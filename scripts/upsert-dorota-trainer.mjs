import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import process from "node:process";

const TRAINER_ID = "trainer-10";
const LEGACY_DEMO_USER_ID = "trainer-user-10";
const DOROTA_EMAIL = "dorota@emandar.pl";
const DOROTA_PASSWORD = "kocham";
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

async function ensureAuthUser(apiKey) {
  try {
    const created = await firebaseRequest(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: DOROTA_EMAIL,
          password: DOROTA_PASSWORD,
          returnSecureToken: true,
        }),
      },
    );

    return created.localId;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("EMAIL_EXISTS")) {
      throw error;
    }
  }

  const signedIn = await firebaseRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DOROTA_EMAIL,
        password: DOROTA_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );

  return signedIn.localId;
}

async function main() {
  const env = await loadEnvFile(DOTENV_PATH);
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;

  if (!apiKey) {
    throw new Error("Missing VITE_FIREBASE_API_KEY in .env.local.");
  }

  if (!projectId) {
    throw new Error("Missing VITE_FIREBASE_PROJECT_ID in .env.local.");
  }

  const firebaseToolsConfig = await loadFirebaseToolsConfig();
  const accessToken = await refreshFirebaseToolsAccessToken(firebaseToolsConfig);
  const authUid = await ensureAuthUser(apiKey);
  const seededAt = new Date().toISOString();

  await writeFirestoreDocument(projectId, accessToken, "users", authUid, {
    id: authUid,
    legacyDemoId: LEGACY_DEMO_USER_ID,
    role: "trainer",
    displayName: "Dorota",
    email: DOROTA_EMAIL,
    phone: "+48 601 909 808",
    avatarUrl: "https://i.pravatar.cc/320?img=28",
    status: "active",
      trainerProfileId: TRAINER_ID,
    seededFromDemo: true,
    seededAt,
    source: "scripts/upsert-dorota-trainer.mjs",
  });

  await writeFirestoreDocument(projectId, accessToken, "trainers", TRAINER_ID, {
    id: TRAINER_ID,
    userId: authUid,
    slug: "dorota",
    displayName: "Dorota",
    bio: "Prowadzi szkolenia z uwaznosci, pracy z cialem i odzyskiwania energii po przeciazeniu.",
    specialties: ["Uwaznosc", "Cialo", "Regeneracja"],
    locations: ["Warszawa, mazowieckie", "Lublin, lubelskie", "Online"],
    isVisible: true,
    heroNote:
      "Laczy spokoj, konkret i bezpieczne tempo pracy, dzieki czemu grupa szybko wraca do rownowagi.",
    avatarUrl: "https://i.pravatar.cc/320?img=28",
    brandStatus: "official",
    seededAt,
    source: "scripts/upsert-dorota-trainer.mjs",
  });

  console.log(`Dorota is ready. authUid=${authUid}, trainerId=${TRAINER_ID}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
