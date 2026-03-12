import { initializeApp } from "firebase/app";
import {
  ReCaptchaV3Provider,
  getToken as getAppCheckToken,
  initializeAppCheck,
  type AppCheck,
} from "firebase/app-check";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

function readEnv(name: string) {
  if (typeof process !== "undefined" && process.env[name]) {
    return process.env[name];
  }

  return import.meta.env[name];
}

const env = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID"),
  measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID"),
  useEmulators: readEnv("VITE_USE_FIREBASE_EMULATORS"),
  authEmulatorHost: readEnv("VITE_FIREBASE_AUTH_EMULATOR_HOST") ?? readEnv("FIREBASE_AUTH_EMULATOR_HOST"),
  firestoreEmulatorHost: readEnv("VITE_FIRESTORE_EMULATOR_HOST") ?? readEnv("FIRESTORE_EMULATOR_HOST"),
  functionsEmulatorHost:
    readEnv("VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST") ?? readEnv("FIREBASE_FUNCTIONS_EMULATOR_HOST"),
  storageEmulatorHost:
    readEnv("VITE_FIREBASE_STORAGE_EMULATOR_HOST") ?? readEnv("FIREBASE_STORAGE_EMULATOR_HOST"),
  appCheckSiteKey: readEnv("VITE_FIREBASE_APP_CHECK_SITE_KEY"),
  appCheckDebugToken: readEnv("VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN"),
};

export const firebaseFunctionsRegion = "europe-west1";

export const firebaseConfig = {
  apiKey: env.apiKey,
  authDomain: env.authDomain,
  projectId: env.projectId,
  storageBucket: env.storageBucket,
  messagingSenderId: env.messagingSenderId,
  appId: env.appId,
  measurementId: env.measurementId,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

export const firebaseApp = isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : null;

const authPersistence =
  typeof window === "undefined"
    ? undefined
    : [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence];

export const firebaseAuth = firebaseApp
  ? initializeAuth(firebaseApp, {
      persistence: authPersistence,
      // We use only email/password and anonymous auth, so loading the popup/redirect
      // resolver just creates unnecessary iframe auth traffic on production.
      popupRedirectResolver: undefined,
    })
  : null;
export const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;
export const firebaseFunctions = firebaseApp ? getFunctions(firebaseApp, firebaseFunctionsRegion) : null;

const shouldUseEmulators = env.useEmulators === "true";

function parseHostPort(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [host, portValue] = value.split(":");
  const port = Number(portValue);

  if (!host || Number.isNaN(port)) {
    return null;
  }

  return { host, port };
}

if (shouldUseEmulators && firebaseAuth && firebaseDb && firebaseStorage && firebaseFunctions) {
  const authHost = parseHostPort(env.authEmulatorHost);
  const firestoreHost = parseHostPort(env.firestoreEmulatorHost);
  const functionsHost = parseHostPort(env.functionsEmulatorHost);
  const storageHost = parseHostPort(env.storageEmulatorHost);

  if (authHost) {
    connectAuthEmulator(firebaseAuth, `http://${authHost.host}:${authHost.port}`, {
      disableWarnings: true,
    });
    firebaseAuth.settings.appVerificationDisabledForTesting = true;
  }

  if (firestoreHost) {
    connectFirestoreEmulator(firebaseDb, firestoreHost.host, firestoreHost.port);
  }

  if (functionsHost) {
    connectFunctionsEmulator(firebaseFunctions, functionsHost.host, functionsHost.port);
  }

  if (storageHost) {
    connectStorageEmulator(firebaseStorage, storageHost.host, storageHost.port);
  }
}

let cachedAppCheck: AppCheck | null = null;

export function getFirebaseAppCheck() {
  if (!firebaseApp || typeof window === "undefined") {
    return null;
  }

  if (shouldUseEmulators) {
    return null;
  }

  if (cachedAppCheck) {
    return cachedAppCheck;
  }

  if (!env.appCheckSiteKey) {
    return null;
  }

  cachedAppCheck = initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(env.appCheckSiteKey || "debug-placeholder"),
    isTokenAutoRefreshEnabled: true,
  });

  return cachedAppCheck;
}

export async function ensureAppCheckToken() {
  const appCheck = getFirebaseAppCheck();

  if (!appCheck) {
    return null;
  }

  try {
    const result = await getAppCheckToken(appCheck, false);
    return result.token;
  } catch {
    return null;
  }
}

export const firebaseAnalyticsPromise: Promise<Analytics | null> =
  typeof window !== "undefined" && firebaseApp
    ? isSupported()
        .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
        .catch(() => null)
    : Promise.resolve(null);
