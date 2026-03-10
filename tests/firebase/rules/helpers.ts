import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import {
  getBytes,
  ref,
  uploadString,
  type FirebaseStorage,
} from "firebase/storage";

export const PROJECT_ID = "emandar-c1e15";
export const STORAGE_BUCKET = `gs://${PROJECT_ID}.firebasestorage.app`;

let cachedEnvironment: RulesTestEnvironment | null = null;

function loadRules(fileName: string) {
  return readFileSync(resolve(process.cwd(), fileName), "utf8");
}

export async function getRulesEnvironment() {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  cachedEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: loadRules("firestore.rules"),
    },
    storage: {
      rules: loadRules("storage.rules"),
    },
  });

  return cachedEnvironment;
}

export async function resetRulesData() {
  const env = await getRulesEnvironment();
  await env.clearFirestore();
}

export async function cleanupRulesEnvironment() {
  if (!cachedEnvironment) {
    return;
  }

  await cachedEnvironment.cleanup();
  cachedEnvironment = null;
}

export async function seedFirestoreDocuments(
  entries: Array<{ collection: string; id: string; data: Record<string, unknown> }>,
) {
  const env = await getRulesEnvironment();

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    for (const entry of entries) {
      await setDoc(doc(db, entry.collection, entry.id), entry.data);
    }
  });
}

export async function seedStorageFile(path: string, contents = "seed-image") {
  const env = await getRulesEnvironment();

  await env.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage(STORAGE_BUCKET);
    await uploadString(ref(storage, path), contents, "raw", {
      contentType: "image/png",
    });
  });
}

export async function readFirestoreDoc(db: Firestore, collectionName: string, id: string) {
  return getDoc(doc(db, collectionName, id));
}

export async function readStorageBlob(storage: FirebaseStorage, path: string) {
  return getBytes(ref(storage, path));
}

export async function writeStorageString(
  storage: FirebaseStorage,
  path: string,
  contentType = "image/png",
) {
  return uploadString(ref(storage, path), "demo-image-content", "raw", {
    contentType,
  });
}

function normalizedClaims(claims: Record<string, unknown> = {}) {
  return {
    admin: false,
    ...claims,
  };
}

export async function authenticatedContext(
  uid: string,
  claims?: Record<string, unknown>,
): Promise<RulesTestContext> {
  const env = await getRulesEnvironment();
  return env.authenticatedContext(uid, normalizedClaims(claims));
}

export async function authenticatedFirestore(
  uid: string,
  claims?: Record<string, unknown>,
) {
  const context = await authenticatedContext(uid, claims);
  return context.firestore();
}

export async function authenticatedStorage(
  uid: string,
  claims?: Record<string, unknown>,
) {
  const context = await authenticatedContext(uid, claims);
  return context.storage(STORAGE_BUCKET);
}
