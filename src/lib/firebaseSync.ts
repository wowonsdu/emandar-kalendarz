import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import type { AuthSession, DemoStore } from "@/domain/types";
import {
  firebaseAnalyticsPromise,
  firebaseApp,
  firebaseAuth,
  firebaseConfig,
  firebaseDb,
  firebaseStorage,
} from "./firebase";

function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function ensureFirebaseSession() {
  if (!firebaseAuth) {
    return null;
  }

  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser;
  }

  try {
    const result = await signInAnonymously(firebaseAuth);
    return result.user;
  } catch {
    return null;
  }
}

export async function syncDemoStateToFirebase(
  store: DemoStore,
  session: AuthSession,
  source: string,
) {
  if (!firebaseApp || !firebaseDb) {
    return false;
  }

  await ensureFirebaseSession();
  const analytics = await firebaseAnalyticsPromise;

  await Promise.all([
    setDoc(
      doc(firebaseDb, "app_meta", "web_client"),
      {
        appName: "emandar-kalendarz",
        projectId: firebaseConfig.projectId,
        source,
        services: {
          analytics: Boolean(analytics),
          auth: Boolean(firebaseAuth),
          firestore: true,
          storage: Boolean(firebaseStorage),
        },
        runtime: {
          href: typeof window !== "undefined" ? window.location.href : null,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
        },
        syncedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      doc(firebaseDb, "app_state", "demo_store"),
      {
        counts: {
          users: store.users.length,
          trainers: store.trainers.length,
          organizers: store.organizers.length,
          relations: store.relations.length,
          groups: store.groups.length,
          trainingEvents: store.trainingEvents.length,
          availabilitySlots: store.availabilitySlots.length,
          enrollmentRequests: store.enrollmentRequests.length,
          notifications: store.notifications.length,
        },
        source,
        store: sanitizeForFirestore(store),
        syncedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      doc(firebaseDb, "app_state", "session"),
      {
        session: sanitizeForFirestore(session),
        source,
        syncedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);

  return true;
}
