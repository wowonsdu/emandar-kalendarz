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

const demoAccounts = [
  {
    role: "trainer",
    profileId: "trainer-1",
    sortOrder: 2,
    displayName: "Jacek",
    email: "jacek@emandar.pl",
    phone: "+48 601 100 101",
    slug: "jacek",
    bio: "Prowadzi procesy grupowe z duzym spokojem, osadzeniem i bardzo czytelnym prowadzeniem.",
    heroNote: "Daje grupie poczucie bezpieczenstwa i klarowna strukture pracy.",
    specialties: ["Praca grupowa", "Uważność", "Integracja"],
    locations: ["Warszawa", "Online"],
    avatarUrl: "https://i.pravatar.cc/320?img=13",
  },
  {
    role: "trainer",
    profileId: "trainer-2",
    sortOrder: 3,
    displayName: "Marcin",
    email: "marcin@emandar.pl",
    phone: "+48 601 100 102",
    slug: "marcin",
    bio: "Laczy wrazliwosc z konkretem i dobrze prowadzi grupy w pracy z emocjami oraz cialem.",
    heroNote: "Pomaga przejsc od chaosu i napiecia do prostoty i kontaktu ze soba.",
    specialties: ["Emocje", "Ciało", "Oddech"],
    locations: ["Kraków", "Online"],
    avatarUrl: "https://i.pravatar.cc/320?img=14",
  },
  {
    role: "trainer",
    profileId: "trainer-10",
    sortOrder: 4,
    displayName: "Dorota",
    email: "dorota@emandar.pl",
    phone: "+48 601 909 808",
    slug: "dorota",
    bio: "Prowadzi szkolenia z uwaznosci, pracy z cialem i odzyskiwania energii po przeciazeniu.",
    heroNote: "Laczy spokoj, konkret i bezpieczne tempo pracy, dzieki czemu grupa szybko wraca do rownowagi.",
    specialties: ["Uwaznosc", "Cialo", "Regeneracja"],
    locations: ["Warszawa", "Lublin", "Online"],
    avatarUrl: "https://i.pravatar.cc/320?img=28",
  },
  {
    role: "trainer",
    profileId: "trainer-4",
    sortOrder: 5,
    displayName: "Asia",
    email: "asia@emandar.pl",
    phone: "+48 601 100 104",
    slug: "asia",
    bio: "Wnosi lekkość, empatie i bardzo naturalne budowanie zaufania w grupie.",
    heroNote: "Prowadzi delikatnie, ale z wyczuciem momentu i duza skutecznoscia.",
    specialties: ["Relacje", "Komunikacja", "Delikatna praca"],
    locations: ["Wrocław", "Online"],
    avatarUrl: "https://i.pravatar.cc/320?img=32",
  },
  {
    role: "trainer",
    profileId: "trainer-5",
    sortOrder: 6,
    displayName: "Krzysiu",
    email: "krzysiu@emandar.pl",
    phone: "+48 601 100 105",
    slug: "krzysiu",
    bio: "Pracuje konkretnie i dynamicznie, dobrze prowadzi osoby potrzebujace przełamania impasu.",
    heroNote: "Pomaga ruszyc z miejsca i odzyskac sprawczosc bez zbednego napinania.",
    specialties: ["Sprawczość", "Decyzje", "Przełamywanie blokad"],
    locations: ["Poznań", "Online"],
    avatarUrl: "https://i.pravatar.cc/320?img=15",
  },
  {
    role: "trainer",
    profileId: "trainer-6",
    sortOrder: 7,
    displayName: "Klaudia",
    email: "klaudia@emandar.pl",
    phone: "+48 601 100 106",
    slug: "klaudia",
    bio: "Prowadzi subtelna i bardzo uwazna prace, dobrze wspiera osoby wrazliwe i przemeczone.",
    heroNote: "Tworzy przestrzen, w ktorej mozna zwolnic i uslyszec to, co naprawde wazne.",
    specialties: ["Wrażliwość", "Regulacja", "Kontakt ze sobą"],
    locations: ["Gdańsk", "Online"],
    avatarUrl: "https://i.pravatar.cc/320?img=16",
  },
  {
    role: "trainer",
    profileId: "trainer-3",
    sortOrder: 20,
    displayName: "Beata",
    email: "beata@emandar.pl",
    phone: "+48 601 100 103",
    slug: "beata",
    bio: "Laczy duza dojrzalosc, cieplo i praktyke w prowadzeniu spotkan rozwojowych.",
    heroNote: "Wnosi spokoj, zaufanie i dojrzała obecnosc w procesie grupowym.",
    specialties: ["Dojrzałość", "Kobiecość", "Proces grupowy"],
    locations: ["Łódź", "Online"],
    avatarUrl: "https://i.pravatar.cc/320?img=17",
  },
  {
    role: "organizer",
    profileId: "organizer-karolina",
    displayName: "Karolina",
    email: "karolina@emandar.pl",
    phone: "+48 602 100 201",
    description: "Prowadzi organizacje szkolen, kontakt z uczestnikami i dopinanie logistyki.",
    contactName: "Karolina",
    location: "Warszawa",
    avatarUrl: "https://i.pravatar.cc/320?img=18",
  },
  {
    role: "organizer",
    profileId: "organizer-marek",
    displayName: "Marek",
    email: "marek@emandar.pl",
    phone: "+48 602 100 202",
    description: "Koordynuje kalendarz wydarzen, miejsca i komunikacje z grupa.",
    contactName: "Marek",
    location: "Kraków",
    avatarUrl: "https://i.pravatar.cc/320?img=19",
  },
  {
    role: "organizer",
    profileId: "organizer-demo",
    displayName: "Organizator Demo",
    email: "organizator-demo@emandar.pl",
    phone: "+48 602 100 203",
    description: "Konto demonstracyjne do testowania panelu organizatora i relacji z trenerami.",
    contactName: "Demo",
    location: "Online",
    avatarUrl: "https://i.pravatar.cc/320?img=20",
  },
  {
    role: "participant",
    profileId: null,
    displayName: "Grzegorz Emanowicz",
    email: "grzegorz.emanowicz@emandar.pl",
    phone: "+48 605 100 301",
    avatarUrl: "https://i.pravatar.cc/320?img=21",
  },
  {
    role: "participant",
    profileId: null,
    displayName: "Grzegorz Chotnicki",
    email: "grzegorz.chotnicki@emandar.pl",
    phone: "+48 605 100 302",
    avatarUrl: "https://i.pravatar.cc/320?img=22",
  },
  {
    role: "participant",
    profileId: null,
    displayName: "Ola Chotnicka",
    email: "ola.chotnicka@emandar.pl",
    phone: "+48 605 100 303",
    avatarUrl: "https://i.pravatar.cc/320?img=23",
  },
];

function getAdminApp(projectId, refreshTokenValue) {
  const existing = getApps().find((app) => app.name === "seed-demo-accounts");
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
    "seed-demo-accounts",
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

function fromFirestoreValue(value) {
  if (!value) {
    return null;
  }

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
    return value.doubleValue;
  }

  if ("arrayValue" in value) {
    return (value.arrayValue?.values ?? []).map((item) => fromFirestoreValue(item));
  }

  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue?.fields ?? {}).map(([key, nested]) => [
        key,
        fromFirestoreValue(nested),
      ]),
    );
  }

  return null;
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

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? `Failed to fetch ${collectionName}/${docId}: ${response.statusText}`,
    );
  }

  return Object.fromEntries(
    Object.entries(payload?.fields ?? {}).map(([key, value]) => [key, fromFirestoreValue(value)]),
  );
}

async function ensureAuthUser(auth, account) {
  try {
    const existing = await auth.getUserByEmail(account.email);
    const updated = await auth.updateUser(existing.uid, {
      email: account.email,
      password: PASSWORD,
      displayName: account.displayName,
    });
    return updated.uid;
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const created = await auth.createUser({
    email: account.email,
    password: PASSWORD,
    displayName: account.displayName,
  });
  return created.uid;
}

async function seedAccount(projectId, accessToken, auth, account) {
  const authUid = await ensureAuthUser(auth, account);
  const seededAt = new Date().toISOString();
  const existingUser = await getFirestoreDocument(projectId, accessToken, "users", authUid);

  await auth.setCustomUserClaims(authUid, {
    admin: false,
  });

  await writeFirestoreDocument(projectId, accessToken, "users", authUid, {
    id: authUid,
    role: account.role,
    roles: [account.role],
    primaryRole: account.role,
    displayName: account.displayName,
    email: account.email,
    phone: account.phone,
    avatarUrl: existingUser?.avatarUrl ?? account.avatarUrl,
    avatarPath: existingUser?.avatarPath ?? null,
    status: "active",
    trainerProfileId: account.role === "trainer" ? account.profileId : null,
    organizerProfileId: account.role === "organizer" ? account.profileId : null,
    seededFromDemo: true,
    seededAt,
    source: "scripts/seed-demo-auth-accounts.mjs",
  });

  if (account.role === "trainer") {
    const existingTrainer = await getFirestoreDocument(
      projectId,
      accessToken,
      "trainers",
      account.profileId,
    );

    await writeFirestoreDocument(projectId, accessToken, "trainers", account.profileId, {
      id: account.profileId,
      userId: authUid,
      slug: account.slug,
      displayName: account.displayName,
      sortOrder: account.sortOrder,
      bio: existingTrainer?.bio ?? account.bio,
      specialties: account.specialties,
      locations: account.locations,
      isVisible: true,
      heroNote: existingTrainer?.heroNote ?? account.heroNote,
      avatarUrl: existingTrainer?.avatarUrl ?? account.avatarUrl,
      avatarPath: existingTrainer?.avatarPath ?? null,
      avatarUploadedAt: existingTrainer?.avatarUploadedAt ?? null,
      brandStatus: "official",
      seededAt,
      source: "scripts/seed-demo-auth-accounts.mjs",
    });
  } else if (account.role === "organizer") {
    await writeFirestoreDocument(projectId, accessToken, "organizers", account.profileId, {
      id: account.profileId,
      userId: authUid,
      displayName: account.displayName,
      description: account.description,
      isVisible: true,
      contactName: account.contactName,
      location: account.location,
      seededAt,
      source: "scripts/seed-demo-auth-accounts.mjs",
    });
  }

  return { authUid, profileId: account.profileId, email: account.email, role: account.role };
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

  for (const account of demoAccounts) {
    const result = await seedAccount(projectId, accessToken, auth, account);
    console.log(`${account.displayName} ready. role=${result.role} uid=${result.authUid} profile=${result.profileId}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
