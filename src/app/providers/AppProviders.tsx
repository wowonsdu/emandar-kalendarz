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
import { mapAppError } from "@/domain/errors";
import { sortTrainerProfiles } from "@/domain/utils";
import {
  addAvailabilitySlot as addAvailabilitySlotAction,
  addTrainerCalendarFeed as addTrainerCalendarFeedAction,
  archiveTrainingEvent as archiveTrainingEventAction,
  confirmEnrollmentAttendance as confirmEnrollmentAttendanceAction,
  createEmptyStore,
  createUnifiedTrainingEvent as createTrainingEventAction,
  decideAccountRequest as decideAccountRequestAction,
  decideEnrollment as decideEnrollmentAction,
  decideTrainerPublicationApproval as decideTrainerPublicationApprovalAction,
  decideTrainingEventCollaboration as decideTrainingEventCollaborationAction,
  detachRelation as detachRelationAction,
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
  syncOwnTrainerCalendarFeeds as syncOwnTrainerCalendarFeedsAction,
  removeTrainerCalendarFeed as removeTrainerCalendarFeedAction,
  updateTrainingEventBrandStatus as updateTrainingEventBrandStatusAction,
  updateAppSettings as updateAppSettingsAction,
  updateTrainerCalendarFeedEnabled as updateTrainerCalendarFeedEnabledAction,
  updateActiveRole as updateActiveRoleAction,
  updateTrainingEventManagement as updateTrainingEventManagementAction,
  updateOrganizerProfile as updateOrganizerProfileAction,
  updateOrganizerNotificationSettings as updateOrganizerNotificationSettingsAction,
  updateTrainerBrandStatus as updateTrainerBrandStatusAction,
  updateTrainerNotificationSettings as updateTrainerNotificationSettingsAction,
  updateTrainerProfile as updateTrainerProfileAction,
} from "@/data/firebaseRepository";
import type {
  AccountRequestInput,
  AppSettings,
  AppRole,
  AppUser,
  AvailabilityInput,
  DecisionStatus,
  DemoStore,
  EmandarBrandStatus,
  EnrollmentFormInput,
  NotificationSettingsUpdateInput,
  OrganizerProfileUpdateInput,
  TrainerCalendarFeedInput,
  TrainingEventScheduleDay,
  TrainingEventInput,
  TrainingEventStatus,
  TrainerProfileUpdateInput,
} from "@/domain/types";

interface AppStateContextValue {
  store: DemoStore;
  currentUser: AppUser | null;
  currentUserReady: boolean;
  availableRoles: AppRole[];
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signOut: () => Promise<void>;
  setActiveRole: (role: AppRole) => Promise<void>;
  submitEnrollment: (input: EnrollmentFormInput) => Promise<void>;
  submitAccountRequest: (input: AccountRequestInput) => Promise<void>;
  decideAccountRequest: (
    requestId: string,
    status: "approved" | "rejected",
  ) => Promise<void>;
  decideTrainerPublicationApproval: (
    approvalId: string,
    status: "accepted" | "rejected",
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
  detachRelation: (
    relationId: string,
    archiveLinkedEvents?: boolean,
  ) => Promise<void>;
  createTrainingEvent: (input: TrainingEventInput) => Promise<void>;
  archiveTrainingEvent: (eventId: string) => Promise<void>;
  decideTrainingEventCollaboration: (
    eventId: string,
    status: "accepted" | "rejected",
  ) => Promise<void>;
  addAvailabilitySlot: (
    input: Omit<AvailabilityInput, "trainerId"> & { trainerId?: string },
  ) => Promise<void>;
  addTrainerCalendarFeed: (input: TrainerCalendarFeedInput) => Promise<void>;
  updateTrainerCalendarFeedEnabled: (feedId: string, enabled: boolean) => Promise<void>;
  removeTrainerCalendarFeed: (feedId: string) => Promise<void>;
  syncOwnTrainerCalendarFeeds: () => Promise<void>;
  updateTrainerProfile: (input: TrainerProfileUpdateInput) => Promise<void>;
  updateOrganizerProfile: (input: OrganizerProfileUpdateInput) => Promise<void>;
  updateAppSettings: (input: AppSettings) => Promise<void>;
  updateTrainerNotificationSettings: (
    input: NotificationSettingsUpdateInput,
  ) => Promise<void>;
  updateOrganizerNotificationSettings: (
    input: NotificationSettingsUpdateInput,
  ) => Promise<void>;
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
    tags?: string[],
    scheduleDays?: TrainingEventScheduleDay[],
    transferTargetEventId?: string,
    enrollmentPhotoRequirement?: "default" | "required" | "optional",
  ) => Promise<void>;
  notificationsCount: number;
  getRoleHomePath: (role: AppRole) => string;
  resolveEnrollmentPhoto: (path: string) => Promise<string>;
  confirmEnrollmentAttendance: (
    token: string,
    decision: "confirm" | "decline",
  ) => Promise<void>;
}

type StorePatch = Partial<DemoStore>;

const AppStateContext = createContext<AppStateContextValue | null>(null);

async function withFriendlyErrors<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    throw mapAppError(error);
  }
}

function getRoleHomePath(role: AppRole) {
  return role === "participant" ? "/kalendarz" : "/panel/dashboard";
}

function mergeStores(publicStore: DemoStore, privateStore: StorePatch): DemoStore {
  const trainers = sortTrainerProfiles(privateStore.trainers ?? publicStore.trainers);

  return {
    users: privateStore.users ?? publicStore.users,
    trainers,
    organizers: privateStore.organizers ?? publicStore.organizers,
    relations: privateStore.relations ?? publicStore.relations,
    trainingEvents: privateStore.trainingEvents ?? publicStore.trainingEvents,
    availabilitySlots: privateStore.availabilitySlots ?? publicStore.availabilitySlots,
    trainerCalendarFeeds:
      privateStore.trainerCalendarFeeds ?? publicStore.trainerCalendarFeeds,
    trainerExternalBusyMonths:
      privateStore.trainerExternalBusyMonths ?? publicStore.trainerExternalBusyMonths,
    enrollmentRequests:
      privateStore.enrollmentRequests ?? publicStore.enrollmentRequests,
    notifications: privateStore.notifications ?? publicStore.notifications,
    accountRequests: privateStore.accountRequests ?? publicStore.accountRequests,
    trainerPublicationApprovals:
      privateStore.trainerPublicationApprovals ?? publicStore.trainerPublicationApprovals,
    appSettings: privateStore.appSettings ?? publicStore.appSettings,
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
  const [currentUserReady, setCurrentUserReady] = useState(false);
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
      setCurrentUserReady(true);
      return;
    }

    return onAuthStateChanged(firebaseAuth, (user) => {
      setAuthReady(true);

      if (!user || user.isAnonymous) {
        setAuthUserId(null);
        setCurrentUser(null);
        setPrivateStore({});
        setCurrentUserReady(true);
        return;
      }

      setCurrentUser(null);
      setPrivateStore({});
      setCurrentUserReady(false);
      setAuthUserId(user.uid);
    });
  }, []);

  useEffect(() => {
    if (!firebaseAuth || !authUserId) {
      return;
    }

    return subscribeUserProfile(authUserId, (user) => {
      setCurrentUser(user);
      setCurrentUserReady(true);
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
  const availableRoles = currentUser?.roles ?? [];

  const value = useMemo<AppStateContextValue>(
    () => ({
      store,
      currentUser,
      currentUserReady,
      availableRoles,
      authReady,
      async signIn(email, password) {
        return withFriendlyErrors(() => signInAction(email, password));
      },
      async signOut() {
        await withFriendlyErrors(() => signOutAction());
      },
      async setActiveRole(role) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() => updateActiveRoleAction(currentUser, role));
      },
      async submitEnrollment(input) {
        await withFriendlyErrors(() => submitEnrollmentAction(input));
      },
      async submitAccountRequest(input) {
        await withFriendlyErrors(() => submitAccountRequestAction(input));
      },
      async decideAccountRequest(requestId, status) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          decideAccountRequestAction(requestId, currentUser, status),
        );
      },
      async decideTrainerPublicationApproval(approvalId, status) {
        if (!currentUser) {
          throw new Error("Musisz byÄ‡ zalogowany.");
        }

        await withFriendlyErrors(() =>
          decideTrainerPublicationApprovalAction(approvalId, status, currentUser),
        );
      },
      async decideEnrollment(requestId, decision) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          decideEnrollmentAction(requestId, currentUser, decision),
        );
      },
      async manageEnrollmentRequest(requestId, decision, transferTargetEventId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          manageEnrollmentRequestAction(
            {
              requestId,
              decision,
              transferTargetEventId,
            },
            currentUser,
          ),
        );
      },
      async requestRelation(trainerId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => requestRelationAction(currentUser, trainerId));
      },
      async decideRelation(relationId, status) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          decideRelationAction(relationId, currentUser, status),
        );
      },
      async detachRelation(relationId, archiveLinkedEvents) {
        throw new Error("Model grup zostal usuniety. Korzystaj z jednego modelu szkolen.");

        await withFriendlyErrors(() =>
          detachRelationAction(relationId, currentUser, archiveLinkedEvents),
        );
      },
      async __removeCreateGroup() {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        const organizerId =
          input.organizerId ??
          store.organizers.find((item) => item.userId === currentUser.id)?.id;

        if (!organizerId) {
          throw new Error("Brak profilu organizatora.");
        }

        await withFriendlyErrors(() =>
          createGroupAction(
            {
              ...input,
              organizerId,
            },
            currentUser,
          ),
        );
      },
      async createTrainingEvent(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => createTrainingEventAction(input, currentUser));
      },
      async archiveTrainingEvent(eventId) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() =>
          archiveTrainingEventAction(eventId, currentUser),
        );
      },
      async decideTrainingEventCollaboration(eventId, status) {
        if (!currentUser) {
          throw new Error("Musisz byÄ‡ zalogowany.");
        }

        await withFriendlyErrors(() =>
          decideTrainingEventCollaborationAction(
            {
              eventId,
              status,
            },
            currentUser,
          ),
        );
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

        await withFriendlyErrors(() =>
          addAvailabilitySlotAction(
            {
              ...input,
              trainerId,
            },
            currentUser,
          ),
        );
      },
      async addTrainerCalendarFeed(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => addTrainerCalendarFeedAction(input, currentUser));
      },
      async updateTrainerCalendarFeedEnabled(feedId, enabled) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateTrainerCalendarFeedEnabledAction(feedId, enabled, currentUser),
        );
      },
      async removeTrainerCalendarFeed(feedId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          removeTrainerCalendarFeedAction(feedId, currentUser),
        );
      },
      async syncOwnTrainerCalendarFeeds() {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => syncOwnTrainerCalendarFeedsAction(currentUser));
      },
      async updateTrainerProfile(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() => updateTrainerProfileAction(currentUser, input));
      },
      async updateOrganizerProfile(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() => updateOrganizerProfileAction(currentUser, input));
      },
      async updateAppSettings(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() => updateAppSettingsAction(input));
      },
      async updateTrainerNotificationSettings(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateTrainerNotificationSettingsAction(currentUser, input),
        );
      },
      async updateOrganizerNotificationSettings(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateOrganizerNotificationSettingsAction(currentUser, input),
        );
      },
      async updateTrainerBrandStatus(trainerId, brandStatus) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateTrainerBrandStatusAction(
            {
              trainerId,
              brandStatus,
            },
            currentUser,
          ),
        );
      },
      async updateTrainingEventBrandStatus(eventId, brandStatus) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateTrainingEventBrandStatusAction(
            {
              eventId,
              brandStatus,
            },
            currentUser,
          ),
        );
      },
      async updateTrainingEventManagement(
        eventId,
        status,
        capacity,
        minimumParticipants,
        tags,
        scheduleDays,
        transferTargetEventId,
        enrollmentPhotoRequirement,
      ) {
        if (!currentUser) {
          throw new Error("Musisz byÄ‡ zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateTrainingEventManagementAction(
            {
              eventId,
              status,
              capacity,
              minimumParticipants,
              tags,
              scheduleDays,
              transferTargetEventId,
              enrollmentPhotoRequirement,
            },
            currentUser,
          ),
        );
      },
      notificationsCount,
      getRoleHomePath,
      resolveEnrollmentPhoto,
      async confirmEnrollmentAttendance(token, decision) {
        await withFriendlyErrors(() =>
          confirmEnrollmentAttendanceAction(token, decision),
        );
      },
    }),
    [authReady, availableRoles, currentUser, currentUserReady, notificationsCount, store],
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
