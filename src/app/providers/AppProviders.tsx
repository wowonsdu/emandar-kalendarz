import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import {
  addAvailabilitySlot as addAvailabilitySlotAction,
  createEmptyStore,
  createGroup as createGroupAction,
  createTrainingEvent as createTrainingEventAction,
  decideAccountRequest as decideAccountRequestAction,
  decideEnrollment as decideEnrollmentAction,
  manageEnrollmentRequest as manageEnrollmentRequestAction,
  decideRelation as decideRelationAction,
  requestRelation as requestRelationAction,
  resolveEnrollmentPhoto,
  signIn as signInAction,
  signOut as signOutAction,
  submitAccountRequest as submitAccountRequestAction,
  submitEnrollment as submitEnrollmentAction,
  subscribePrivateStore,
  subscribePublicStore,
  subscribeUserProfile,
  updateTrainingEventBrandStatus as updateTrainingEventBrandStatusAction,
  updateTrainingEventManagement as updateTrainingEventManagementAction,
  updateOrganizerProfile as updateOrganizerProfileAction,
  updateTrainerBrandStatus as updateTrainerBrandStatusAction,
  updateTrainerProfile as updateTrainerProfileAction,
} from "@/data/firebaseRepository";
import type {
  AccountRequestInput,
  AppRole,
  AppUser,
  AvailabilityInput,
  DecisionStatus,
  DemoStore,
  EmandarBrandStatus,
  EnrollmentFormInput,
  GroupInput,
  OrganizerProfileUpdateInput,
  TrainingEventInput,
  TrainingEventStatus,
  TrainerProfileUpdateInput,
} from "@/domain/types";

interface AppStateContextValue {
  dataMode: string;
  store: DemoStore;
  currentUser: AppUser | null;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signOut: () => Promise<void>;
  resetDemo: () => Promise<void>;
  submitEnrollment: (input: EnrollmentFormInput) => Promise<void>;
  submitAccountRequest: (input: AccountRequestInput) => Promise<void>;
  decideAccountRequest: (
    requestId: string,
    status: "approved" | "rejected",
  ) => Promise<void>;
  decideEnrollment: (
    requestId: string,
    decision: "accepted" | "rejected",
  ) => Promise<void>;
  manageEnrollmentRequest: (
    requestId: string,
    decision: DecisionStatus,
    transferTargetEventId?: string,
  ) => Promise<void>;
  requestRelation: (trainerId: string) => Promise<void>;
  decideRelation: (
    relationId: string,
    status: "approved" | "rejected",
  ) => Promise<void>;
  createGroup: (
    input: Omit<GroupInput, "organizerId"> & { organizerId?: string },
  ) => Promise<void>;
  createTrainingEvent: (input: TrainingEventInput) => Promise<void>;
  addAvailabilitySlot: (
    input: Omit<AvailabilityInput, "trainerId"> & { trainerId?: string },
  ) => Promise<void>;
  updateTrainerProfile: (input: TrainerProfileUpdateInput) => Promise<void>;
  updateOrganizerProfile: (input: OrganizerProfileUpdateInput) => Promise<void>;
  updateTrainerBrandStatus: (
    trainerId: string,
    brandStatus: EmandarBrandStatus,
  ) => Promise<void>;
  updateTrainingEventBrandStatus: (
    eventId: string,
    brandStatus: EmandarBrandStatus,
  ) => Promise<void>;
  updateTrainingEventManagement: (
    eventId: string,
    status: TrainingEventStatus,
    capacity: number,
    minimumParticipants: number,
    transferTargetEventId?: string,
  ) => Promise<void>;
  notificationsCount: number;
  getRoleHomePath: (role: AppRole) => string;
  resolveEnrollmentPhoto: (path: string) => Promise<string>;
}

type StorePatch = Partial<DemoStore>;

const AppStateContext = createContext<AppStateContextValue | null>(null);

function getRoleHomePath(_role: AppRole) {
  return "/panel/dashboard";
}

function mergeStores(publicStore: DemoStore, privateStore: StorePatch): DemoStore {
  return {
    users: privateStore.users ?? publicStore.users,
    trainers: privateStore.trainers ?? publicStore.trainers,
    organizers: privateStore.organizers ?? publicStore.organizers,
    relations: privateStore.relations ?? publicStore.relations,
    groups: privateStore.groups ?? publicStore.groups,
    trainingEvents: privateStore.trainingEvents ?? publicStore.trainingEvents,
    availabilitySlots: privateStore.availabilitySlots ?? publicStore.availabilitySlots,
    enrollmentRequests:
      privateStore.enrollmentRequests ?? publicStore.enrollmentRequests,
    notifications: privateStore.notifications ?? publicStore.notifications,
    accountRequests: privateStore.accountRequests ?? publicStore.accountRequests,
  };
}

function applyPatch(previous: StorePatch, patch: StorePatch): StorePatch {
  return {
    ...previous,
    ...patch,
  };
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [publicStore, setPublicStore] = useState(() => createEmptyStore());
  const [privateStore, setPrivateStore] = useState<StorePatch>({});
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthReady(true);
      return;
    }

    return subscribePublicStore((patch) => {
      setPublicStore((previous) => ({
        ...previous,
        ...patch,
      }));
    });
  }, []);

  useEffect(() => {
    if (!firebaseAuth) {
      setAuthReady(true);
      return;
    }

    return onAuthStateChanged(firebaseAuth, (user) => {
      setAuthReady(true);

      if (!user || user.isAnonymous) {
        setAuthUserId(null);
        setCurrentUser(null);
        setPrivateStore({});
        return;
      }

      setAuthUserId(user.uid);
    });
  }, []);

  useEffect(() => {
    if (!firebaseAuth || !authUserId) {
      return;
    }

    return subscribeUserProfile(authUserId, (user) => {
      setCurrentUser(user);
      setPrivateStore((previous) =>
        applyPatch(previous, {
          users: user ? [user] : [],
        }),
      );
    });
  }, [authUserId]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setPrivateStore((previous) =>
      applyPatch(previous, {
        users: [currentUser],
      }),
    );

    return subscribePrivateStore(currentUser, (patch) => {
      setPrivateStore((previous) => applyPatch(previous, patch));
    });
  }, [currentUser]);

  const store = useMemo(
    () => mergeStores(publicStore, privateStore),
    [privateStore, publicStore],
  );

  const notificationsCount = currentUser
    ? store.notifications.filter(
        (item) => item.userId === currentUser.id && !item.readAt,
      ).length
    : 0;

  const value = useMemo<AppStateContextValue>(
    () => ({
      dataMode: isFirebaseConfigured ? "firebase" : "demo",
      store,
      currentUser,
      authReady,
      async signIn(email, password) {
        return signInAction(email, password);
      },
      async signOut() {
        await signOutAction();
      },
      async resetDemo() {
        throw new Error("Tryb demo został wyłączony.");
      },
      async submitEnrollment(input) {
        await submitEnrollmentAction(input);
      },
      async submitAccountRequest(input) {
        await submitAccountRequestAction(input);
      },
      async decideAccountRequest(requestId, status) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await decideAccountRequestAction(requestId, currentUser, status);
      },
      async decideEnrollment(requestId, decision) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await decideEnrollmentAction(requestId, currentUser, decision);
      },
      async manageEnrollmentRequest(requestId, decision, transferTargetEventId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await manageEnrollmentRequestAction(
          {
            requestId,
            decision,
            transferTargetEventId,
          },
          currentUser,
        );
      },
      async requestRelation(trainerId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await requestRelationAction(currentUser, trainerId);
      },
      async decideRelation(relationId, status) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await decideRelationAction(relationId, currentUser, status);
      },
      async createGroup(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        const organizerId =
          input.organizerId ??
          store.organizers.find((item) => item.userId === currentUser.id)?.id;

        if (!organizerId) {
          throw new Error("Brak profilu organizatora.");
        }

        await createGroupAction(
          {
            ...input,
            organizerId,
          },
          currentUser,
        );
      },
      async createTrainingEvent(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await createTrainingEventAction(input, currentUser);
      },
      async addAvailabilitySlot(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        const trainerId =
          input.trainerId ??
          store.trainers.find((item) => item.userId === currentUser.id)?.id;

        if (!trainerId) {
      throw new Error("Brak profilu Przekazującego Wiedzę.");
        }

        await addAvailabilitySlotAction(
          {
            ...input,
            trainerId,
          },
          currentUser,
        );
      },
      async updateTrainerProfile(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await updateTrainerProfileAction(currentUser, input);
      },
      async updateOrganizerProfile(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await updateOrganizerProfileAction(currentUser, input);
      },
      async updateTrainerBrandStatus(trainerId, brandStatus) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await updateTrainerBrandStatusAction(
          {
            trainerId,
            brandStatus,
          },
          currentUser,
        );
      },
      async updateTrainingEventBrandStatus(eventId, brandStatus) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await updateTrainingEventBrandStatusAction(
          {
            eventId,
            brandStatus,
          },
          currentUser,
        );
      },
      async updateTrainingEventManagement(
        eventId,
        status,
        capacity,
        minimumParticipants,
        transferTargetEventId,
      ) {
        if (!currentUser) {
          throw new Error("Musisz byÄ‡ zalogowany.");
        }

        await updateTrainingEventManagementAction(
          {
            eventId,
            status,
            capacity,
            minimumParticipants,
            transferTargetEventId,
          },
          currentUser,
        );
      },
      notificationsCount,
      getRoleHomePath,
      resolveEnrollmentPhoto,
    }),
    [authReady, currentUser, notificationsCount, store],
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppProviders");
  }

  return context;
}
