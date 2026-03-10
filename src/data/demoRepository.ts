import { demoSeed } from "./demoSeed";
import type {
  AppUser,
  AuthSession,
  AvailabilityInput,
  DemoStore,
  EnrollmentFormInput,
  GroupInput,
} from "@/domain/types";
import {
  canOrganizerAccessTrainer,
  deriveEnrollmentFinalStatus,
  sortEventsByDate,
} from "@/domain/utils";
import { syncDemoStateToFirebase } from "@/lib/firebaseSync";

const DEMO_STORE_KEY = "emandar-demo-store";
const DEMO_SESSION_KEY = "emandar-demo-session";
const DEMO_STORE_VERSION_KEY = "emandar-demo-store-version";
const DEMO_STORE_VERSION = "10";

function cloneStore(store: DemoStore) {
  return JSON.parse(JSON.stringify(store)) as DemoStore;
}

function cloneSession(session: AuthSession) {
  return JSON.parse(JSON.stringify(session)) as AuthSession;
}

function readStore() {
  const saved = localStorage.getItem(DEMO_STORE_KEY);
  const version = localStorage.getItem(DEMO_STORE_VERSION_KEY);

  if (!saved || version !== DEMO_STORE_VERSION) {
    const seeded = cloneStore(demoSeed);
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(seeded));
    localStorage.setItem(DEMO_STORE_VERSION_KEY, DEMO_STORE_VERSION);
    return seeded;
  }

  return JSON.parse(saved) as DemoStore;
}

function writeStore(store: DemoStore) {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
  localStorage.setItem(DEMO_STORE_VERSION_KEY, DEMO_STORE_VERSION);
}

function readSession(): AuthSession {
  const saved = localStorage.getItem(DEMO_SESSION_KEY);
  if (!saved) {
    return { userId: null };
  }

  return JSON.parse(saved) as AuthSession;
}

function writeSession(session: AuthSession) {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
}

function syncToFirebase(store: DemoStore, session: AuthSession, source: string) {
  if ((globalThis as { __emandarFirebaseSyncWarned?: boolean }).__emandarFirebaseSyncWarned) {
    void syncDemoStateToFirebase(store, session, source).catch(() => {});
    return;
  }

  void syncDemoStateToFirebase(store, session, source).catch((error) => {
    (globalThis as { __emandarFirebaseSyncWarned?: boolean }).__emandarFirebaseSyncWarned =
      true;
    console.warn("Firebase sync is blocked by the current Firebase project rules.", error);
  });
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function findEventContext(store: DemoStore, eventId: string) {
  const event = store.trainingEvents.find((item) => item.id === eventId);
  if (!event) {
    throw new Error("Nie znaleziono szkolenia");
  }

  const trainer = store.trainers.find((item) => item.id === event.trainerId);
  const organizer = store.organizers.find(
    (item) => item.id === event.organizerId,
  );

  if (!trainer || !organizer) {
    throw new Error("Brak danych szkolenia");
  }

  return { event, trainer, organizer };
}

function pushNotification(
  store: DemoStore,
  userId: string,
  title: string,
  body: string,
  entityType: DemoStore["notifications"][number]["entityType"],
) {
  store.notifications.unshift({
    id: createId("notification"),
    userId,
    title,
    body,
    createdAt: nowIso(),
    entityType,
  });
}

export class DemoRepository {
  getBootstrap() {
    const store = cloneStore(readStore());
    const session = cloneSession(readSession());
    syncToFirebase(store, session, "bootstrap");

    return {
      store,
      session,
    };
  }

  resetDemo() {
    const seeded = cloneStore(demoSeed);
    writeStore(seeded);
    const session = { userId: null };
    writeSession(session);
    syncToFirebase(seeded, session, "reset-demo");
    return {
      store: seeded,
      session,
    };
  }

  signIn(email: string, password: string) {
    const store = readStore();
    const user = store.users.find(
      (item) =>
        item.email.toLowerCase() === email.toLowerCase() &&
        item.password === password,
    );

    if (!user) {
      throw new Error("Nieprawidłowy email lub hasło.");
    }

    const session = { userId: user.id };
    writeSession(session);
    pushNotification(
      store,
      user.id,
      "Zalogowano do panelu demo",
      "Sesja działa lokalnie. W następnym kroku można ją podmienić na Firebase Auth.",
      "auth",
    );
    writeStore(store);
    syncToFirebase(store, session, "sign-in");

    return {
      user,
      store: cloneStore(store),
      session,
    };
  }

  signOut() {
    const store = readStore();
    const session = { userId: null };
    writeSession(session);
    syncToFirebase(store, session, "sign-out");
    return {
      store: cloneStore(store),
      session,
    };
  }

  submitEnrollment(input: EnrollmentFormInput) {
    const store = readStore();
    const { event, trainer, organizer } = findEventContext(store, input.eventId);
    const request = {
      id: createId("request"),
      ...input,
      trainerDecision: "pending" as const,
      organizerDecision: "pending" as const,
      finalStatus: "pending" as const,
      createdAt: nowIso(),
    };

    store.enrollmentRequests.unshift(request);
    pushNotification(
      store,
      trainer.userId,
      "Nowe zgłoszenie uczestnika",
      `${input.imieNazwisko} chce dołączyć do szkolenia ${event.title}.`,
      "request",
    );
    pushNotification(
      store,
      organizer.userId,
      "Nowe zgłoszenie do grupy",
      `${input.imieNazwisko} wysłał formularz do wydarzenia ${event.title}.`,
      "request",
    );
    writeStore(store);
    syncToFirebase(store, cloneSession(readSession()), "submit-enrollment");

    return {
      request,
      store: cloneStore(store),
      session: cloneSession(readSession()),
    };
  }

  decideEnrollment(
    requestId: string,
    actor: AppUser,
    decision: "accepted" | "rejected",
  ) {
    const store = readStore();
    const request = store.enrollmentRequests.find((item) => item.id === requestId);

    if (!request) {
      throw new Error("Nie znaleziono zgłoszenia.");
    }

    const { trainer, organizer } = findEventContext(store, request.eventId);

    if (actor.role === "trainer" && actor.id === trainer.userId) {
      request.trainerDecision = decision;
    } else if (actor.role === "organizer" && actor.id === organizer.userId) {
      request.organizerDecision = decision;
    } else if (actor.role !== "admin") {
      throw new Error("Brak dostępu do tej decyzji.");
    }

    request.finalStatus = deriveEnrollmentFinalStatus(
      request.trainerDecision,
      request.organizerDecision,
    );

    pushNotification(
      store,
      trainer.userId,
      "Zmieniono status zgłoszenia",
      `${request.imieNazwisko}: ${request.finalStatus}.`,
      "request",
    );
    pushNotification(
      store,
      organizer.userId,
      "Zmieniono status zgłoszenia",
      `${request.imieNazwisko}: ${request.finalStatus}.`,
      "request",
    );
    writeStore(store);
    syncToFirebase(store, cloneSession(readSession()), "decide-enrollment");

    return {
      store: cloneStore(store),
      session: cloneSession(readSession()),
    };
  }

  requestRelation(organizerId: string, trainerId: string) {
    const store = readStore();
    const exists = store.relations.find(
      (item) => item.organizerId === organizerId && item.trainerId === trainerId,
    );

    if (exists) {
      throw new Error("Ta relacja już istnieje.");
    }

    const relation = {
      id: createId("relation"),
      trainerId,
      organizerId,
      status: "pending" as const,
      requestedBy: "organizer" as const,
      createdAt: nowIso(),
    };
    store.relations.unshift(relation);

    const trainer = store.trainers.find((item) => item.id === trainerId);
    const organizer = store.organizers.find((item) => item.id === organizerId);
    if (trainer && organizer) {
      pushNotification(
        store,
        trainer.userId,
        "Nowa prośba o współpracę",
        `${organizer.displayName} chce uzyskać dostęp do Twoich terminów.`,
        "relation",
      );
    }

    writeStore(store);
    syncToFirebase(store, cloneSession(readSession()), "request-relation");

    return {
      store: cloneStore(store),
      session: cloneSession(readSession()),
    };
  }

  decideRelation(
    relationId: string,
    actor: AppUser,
    status: "approved" | "rejected",
  ) {
    const store = readStore();
    const relation = store.relations.find((item) => item.id === relationId);
    if (!relation) {
      throw new Error("Nie znaleziono relacji.");
    }

    const trainer = store.trainers.find((item) => item.id === relation.trainerId);
    const organizer = store.organizers.find(
      (item) => item.id === relation.organizerId,
    );

    if (!trainer || !organizer) {
      throw new Error("Nie znaleziono powiązanych profili.");
    }

    if (actor.role === "trainer" && actor.id !== trainer.userId) {
      throw new Error("Możesz zarządzać tylko swoimi relacjami.");
    }

    relation.status = status;
    pushNotification(
      store,
      organizer.userId,
      "Zmieniono status relacji",
      `${trainer.displayName}: ${status === "approved" ? "zaakceptowano" : "odrzucono"} współpracę.`,
      "relation",
    );
    writeStore(store);
    syncToFirebase(store, cloneSession(readSession()), "decide-relation");

    return {
      store: cloneStore(store),
      session: cloneSession(readSession()),
    };
  }

  createGroup(input: GroupInput, actor: AppUser) {
    const store = readStore();

    if (actor.role !== "admin" && actor.role !== "organizer") {
      throw new Error("Nie możesz tworzyć grup.");
    }

    if (
      actor.role === "organizer" &&
      !canOrganizerAccessTrainer(input.organizerId, input.trainerId, store.relations)
    ) {
      throw new Error("Brak zatwierdzonej relacji z Przekazującym Wiedzę.");
    }

    store.groups.unshift({
      id: createId("group"),
      ...input,
      createdAt: nowIso(),
    });

    const trainer = store.trainers.find((item) => item.id === input.trainerId);
    if (trainer) {
      pushNotification(
        store,
        trainer.userId,
        "Dodano nową grupę",
        `Przypisano Cię do grupy ${input.name}.`,
        "group",
      );
    }

    writeStore(store);
    syncToFirebase(store, cloneSession(readSession()), "create-group");

    return {
      store: cloneStore(store),
      session: cloneSession(readSession()),
    };
  }

  addAvailabilitySlot(input: AvailabilityInput, actor: AppUser) {
    const store = readStore();
    const trainer = store.trainers.find((item) => item.id === input.trainerId);

    if (!trainer) {
      throw new Error("Nie znaleziono Przekazującego Wiedzę.");
    }

    if (actor.role === "trainer" && actor.id !== trainer.userId) {
      throw new Error("Możesz dodawać terminy tylko sobie.");
    }

    store.availabilitySlots.unshift({
      id: createId("slot"),
      ...input,
      visibility: "approved-organizers",
    });
    writeStore(store);
    syncToFirebase(store, cloneSession(readSession()), "add-availability-slot");

    return {
      store: cloneStore(store),
      session: cloneSession(readSession()),
    };
  }

  getPublicEvents() {
    const store = readStore();
    return sortEventsByDate(store.trainingEvents.filter((item) => item.isPublished));
  }
}
