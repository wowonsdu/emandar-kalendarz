import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import crypto from "node:crypto";
import process from "node:process";
import { getApps, initializeApp, refreshToken } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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
  const existing = getApps().find((app) => app.name === "admin-upsert");
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
    "admin-upsert",
  );
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function printUsage() {
  console.log(`
Usage:
  npm run admin:create -- --email "admin@example.com" --display-name "Admin" --phone "+48 600 100 100" --password "StrongPass123!"

Optional:
  --avatar-url "https://example.com/avatar.jpg"
  --project-id "emandar-prod"
  --help

Notes:
  - Creates the Firebase Auth account when it does not exist yet.
  - Promotes an existing account to admin by setting custom claims and the users/{uid} document.
  - Keeps existing trainer/organizer profile ids if the user document already has them.
`);
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

function fromFirestoreValue(value) {
  if ("nullValue" in value) {
    return null;
  }

  if ("stringValue" in value) {
    return value.stringValue;
  }

  if ("booleanValue" in value) {
    return value.booleanValue;
  }

  if ("integerValue" in value) {
    return Number(value.integerValue);
  }

  if ("doubleValue" in value) {
    return Number(value.doubleValue);
  }

  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((entry) => fromFirestoreValue(entry));
  }

  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, nested]) => [
        key,
        fromFirestoreValue(nested),
      ]),
    );
  }

  throw new Error("Unsupported Firestore response value.");
}

async function getFirestoreDocument(projectId, accessToken, collectionName, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = json?.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return Object.fromEntries(
    Object.entries(json?.fields ?? {}).map(([key, value]) => [key, fromFirestoreValue(value)]),
  );
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

async function lookupAccountByEmail(projectId, accessToken, email) {
  const response = await firebaseRequest(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: [email],
      }),
    },
  );

  return response.users?.[0] ?? null;
}

async function createAccount(apiKey, { email, password, displayName }) {
  return firebaseRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        displayName,
        returnSecureToken: true,
      }),
    },
  );
}

function mergeRoles(existingUser) {
  const baseRoles = Array.isArray(existingUser?.roles)
    ? existingUser.roles.filter(
        (role) => role === "admin" || role === "trainer" || role === "organizer",
      )
    : [];
  const fallbackRoles = [
    existingUser?.role,
    existingUser?.primaryRole,
  ].filter((role) => role === "admin" || role === "trainer" || role === "organizer");

  return Array.from(new Set(["admin", ...baseRoles, ...fallbackRoles]));
}

async function updateAccount(accessToken, payload) {
  return firebaseRequest("https://identitytoolkit.googleapis.com/v1/accounts:update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function buildUserDocument({
  existingUser,
  uid,
  email,
  displayName,
  phone,
  avatarUrl,
}) {
  const createdAt =
    typeof existingUser?.createdAt === "string" && existingUser.createdAt.trim()
      ? existingUser.createdAt
      : new Date().toISOString();

  return {
    ...existingUser,
    displayName,
    email,
    phone,
    avatarUrl: avatarUrl ?? existingUser?.avatarUrl ?? "",
    status: "active",
    role: "admin",
    roles: mergeRoles(existingUser),
    primaryRole: "admin",
    trainerProfileId: existingUser?.trainerProfileId ?? null,
    organizerProfileId: existingUser?.organizerProfileId ?? null,
    createdAt,
    updatedAt: new Date().toISOString(),
    adminProvisionedAt:
      typeof existingUser?.adminProvisionedAt === "string"
        ? existingUser.adminProvisionedAt
        : new Date().toISOString(),
    adminProvisionedBy: "scripts/upsert-admin-user.mjs",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true") {
    printUsage();
    return;
  }

  const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
  const displayName = typeof args["display-name"] === "string" ? args["display-name"].trim() : "";
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";
  const password = typeof args.password === "string" ? args.password : "";
  const avatarUrl = typeof args["avatar-url"] === "string" ? args["avatar-url"].trim() : "";
  const generatedPassword = password || crypto.randomBytes(18).toString("base64url");

  if (!email || !displayName || !phone) {
    printUsage();
    throw new Error("Missing required flags: --email, --display-name, --phone.");
  }

  const env = await loadEnvFile(DOTENV_PATH);
  const projectId =
    (typeof args["project-id"] === "string" && args["project-id"].trim()) ||
    env.VITE_FIREBASE_PROJECT_ID;
  const apiKey = env.VITE_FIREBASE_API_KEY;

  if (!projectId) {
    throw new Error("Missing VITE_FIREBASE_PROJECT_ID in .env.local.");
  }

  if (!apiKey) {
    throw new Error("Missing VITE_FIREBASE_API_KEY in .env.local.");
  }

  const firebaseToolsConfig = await readJson(FIREBASE_TOOLS_PATH);
  const refreshTokenValue = firebaseToolsConfig?.tokens?.refresh_token;
  const accessToken = await refreshFirebaseToolsAccessToken(firebaseToolsConfig);

  if (!refreshTokenValue) {
    throw new Error("Missing Firebase CLI refresh token.");
  }

  const adminApp = getAdminApp(projectId, refreshTokenValue);
  const auth = getAuth(adminApp);

  let authUser = null;

  try {
    authUser = await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const wasCreated = !authUser;

  if (!authUser) {
    authUser = await auth.createUser({
      email,
      password: generatedPassword,
      displayName,
    });
  } else {
    const updatePayload = {
      email,
      displayName,
      ...(password ? { password } : {}),
    };
    authUser = await auth.updateUser(authUser.uid, updatePayload);
  }

  const uid = authUser.uid;
  await auth.setCustomUserClaims(uid, {
    ...(authUser.customClaims ?? {}),
    admin: true,
  });

  const existingUser = await getFirestoreDocument(projectId, accessToken, "users", uid);
  const userDocument = buildUserDocument({
    existingUser,
    uid,
    email,
    displayName,
    phone,
    avatarUrl: avatarUrl || undefined,
  });

  await writeFirestoreDocument(projectId, accessToken, "users", uid, userDocument);

  console.log(`Admin ready. uid=${uid} email=${email}`);
  if (wasCreated || password) {
    console.log(`Temporary password: ${password || generatedPassword}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
