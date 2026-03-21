import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MANIFEST_PATH = resolve(ROOT, "seed-assets", "trainer-avatars", "manifest.json");
const DOTENV_PATH = resolve(ROOT, ".env.production");
const FIREBASE_TOOLS_PATH = resolve(
  homedir(),
  ".config",
  "configstore",
  "firebase-tools.json",
);
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const trainerIds = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--trainer" && argv[index + 1]) {
      trainerIds.push(argv[index + 1]);
      index += 1;
    }
  }

  return { apply, trainerIds };
}

function parseEnv(raw) {
  return Object.fromEntries(
    raw
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
      .filter(Boolean),
  );
}

async function getAccessToken() {
  const firebaseToolsConfig = JSON.parse(await readFile(FIREBASE_TOOLS_PATH, "utf8"));
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
  const payload = await response.json();

  if (!response.ok || !payload?.access_token) {
    throw new Error(
      `Failed to refresh Firebase CLI access token: ${payload?.error_description ?? payload?.error ?? response.statusText}`,
    );
  }

  return payload.access_token;
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

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
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

  return { stringValue: String(value) };
}

async function patchFirestoreDocument(projectId, accessToken, collectionName, docId, patch) {
  const searchParams = new URLSearchParams();
  Object.keys(patch).forEach((field) => {
    searchParams.append("updateMask.fieldPaths", field);
  });

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}?${searchParams.toString()}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [key, toFirestoreValue(value)]),
        ),
      }),
    },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Failed to patch ${collectionName}/${docId}: ${payload?.error?.message ?? response.statusText}`,
    );
  }
}

async function uploadObject(bucket, objectName, fileBuffer, contentType, accessToken) {
  const downloadToken = randomUUID();
  const boundary = `boundary-${randomUUID()}`;
  const metadata = {
    name: objectName,
    contentType,
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
    },
  };

  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const suffix = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([prefix, fileBuffer, suffix]);

  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Failed to upload ${objectName}: ${payload?.error?.message ?? response.statusText}`,
    );
  }

  return {
    avatarUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`,
    avatarUploadedAt: new Date().toISOString(),
  };
}

async function main() {
  const { apply, trainerIds } = parseArgs(process.argv.slice(2));
  const env = parseEnv(await readFile(DOTENV_PATH, "utf8"));
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? manifest.projectId;
  const bucket = env.VITE_FIREBASE_STORAGE_BUCKET ?? manifest.storageBucket;

  const trainers = manifest.trainers.filter(
    (trainer) => trainerIds.length === 0 || trainerIds.includes(trainer.trainerId),
  );

  if (trainers.length === 0) {
    throw new Error("No trainers matched the provided filter.");
  }

  const preview = [];

  for (const trainer of trainers) {
    const backupPath = resolve(ROOT, "seed-assets", "trainer-avatars", trainer.backupFile);
    const fileBuffer = await readFile(backupPath);
    const sha256 = createHash("sha256").update(fileBuffer).digest("hex");

    if (sha256 !== trainer.sha256) {
      throw new Error(`Checksum mismatch for ${trainer.backupFile}.`);
    }

    preview.push({
      trainerId: trainer.trainerId,
      displayName: trainer.displayName,
      userId: trainer.userId,
      avatarPath: trainer.avatarPath,
      backupFile: trainer.backupFile,
      sha256,
    });
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          projectId,
          bucket,
          trainers: preview,
        },
        null,
        2,
      ),
    );
    console.log(
      "\nRun with --apply to upload the archived files back to Firebase Storage and patch trainer docs.",
    );
    return;
  }

  const accessToken = await getAccessToken();

  for (const trainer of trainers) {
    const backupPath = resolve(ROOT, "seed-assets", "trainer-avatars", trainer.backupFile);
    const fileBuffer = await readFile(backupPath);
    const upload = await uploadObject(
      bucket,
      trainer.avatarPath,
      fileBuffer,
      manifest.contentType ?? "image/jpeg",
      accessToken,
    );

    await patchFirestoreDocument(projectId, accessToken, "trainers", trainer.trainerId, {
      avatarPath: trainer.avatarPath,
      avatarUrl: upload.avatarUrl,
      avatarUploadedAt: upload.avatarUploadedAt,
    });

    console.log(
      `Restored avatar for ${trainer.displayName} (${trainer.trainerId}) -> ${trainer.avatarPath}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
