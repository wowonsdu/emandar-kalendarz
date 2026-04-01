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
  addEventParticipant as addEventParticipantAction,
  addGroupMember as addGroupMemberAction,
  addOrganizerCalendarFeed as addOrganizerCalendarFeedAction,
  addTrainerCalendarFeed as addTrainerCalendarFeedAction,
  addTrainerSharedSlot as addTrainerSharedSlotAction,
  archiveGroup as archiveGroupAction,
  archiveTrainingEvent as archiveTrainingEventAction,
  archiveTrainerSharedSlot as archiveTrainerSharedSlotAction,
  completeParticipantOnboarding as completeParticipantOnboardingAction,
  connectOrganizerToTrainerWithCode as connectOrganizerToTrainerWithCodeAction,
  confirmEnrollmentAttendance as confirmEnrollmentAttendanceAction,
  createGroup as createGroupAction,
  createOrUpdateOrganizerParticipantProfile as createOrUpdateOrganizerParticipantProfileAction,
  createEmptyStore,
  createOrganizerTrainingDraft as createOrganizerTrainingDraftAction,
  createUnifiedTrainingEvent as createTrainingEventAction,
  decideAccountRequest as decideAccountRequestAction,
  decideEnrollment as decideEnrollmentAction,
  decideOrganizerTrainingDraft as decideOrganizerTrainingDraftAction,
  decideTrainerAccountApproval as decideTrainerAccountApprovalAction,
  decideTrainingEventCollaboration as decideTrainingEventCollaborationAction,
  detachRelation as detachRelationAction,
  ensurePhoneParticipantProfileForFlow as ensurePhoneParticipantProfileForFlowAction,
  finalizeEventRoster as finalizeEventRosterAction,
  getCommunityEventReview as getCommunityEventReviewAction,
  getTrainerOrganizerGoogleCalendarSubscribeUrl as getTrainerOrganizerGoogleCalendarSubscribeUrlAction,
  manageOwnEnrollment as manageOwnEnrollmentAction,
  manageOwnGroupEventParticipation as manageOwnGroupEventParticipationAction,
  manageEnrollmentRequest as manageEnrollmentRequestAction,
  decideRelation as decideRelationAction,
  removeOrganizerCalendarFeed as removeOrganizerCalendarFeedAction,
  removeGroupMember as removeGroupMemberAction,
  requestRelation as requestRelationAction,
  resetTrainerOrganizerCalendarFeedToken as resetTrainerOrganizerCalendarFeedTokenAction,
  resolveEnrollmentPhoto,
  reviewCommunityEvent as reviewCommunityEventAction,
  signIn as signInAction,
  signOut as signOutAction,
  submitAccountRequest as submitAccountRequestAction,
  submitEnrollment as submitEnrollmentAction,
  subscribePrivateStore,
  subscribePublicStore,
  subscribeUserProfile,
  syncOwnOrganizerCalendarFeeds as syncOwnOrganizerCalendarFeedsAction,
  syncOwnTrainerCalendarFeeds as syncOwnTrainerCalendarFeedsAction,
  removeTrainerCalendarFeed as removeTrainerCalendarFeedAction,
  updateTrainingEventBrandStatus as updateTrainingEventBrandStatusAction,
  updateAppSettings as updateAppSettingsAction,
  updateEventParticipantStatus as updateEventParticipantStatusAction,
  updateGroup as updateGroupAction,
  updateGroupMember as updateGroupMemberAction,
  updateOrganizerCalendarFeedEnabled as updateOrganizerCalendarFeedEnabledAction,
  updateOrganizerTrainingDraft as updateOrganizerTrainingDraftAction,
  updateTrainerCalendarFeedEnabled as updateTrainerCalendarFeedEnabledAction,
  updateActiveRole as updateActiveRoleAction,
  updateTrainerSharedSlot as updateTrainerSharedSlotAction,
  updateTrainingEventManagement as updateTrainingEventManagementAction,
  updateOrganizerProfile as updateOrganizerProfileAction,
  updateParticipantProfile as updateParticipantProfileAction,
  updateOrganizerNotificationSettings as updateOrganizerNotificationSettingsAction,
  updateTrainerBrandStatus as updateTrainerBrandStatusAction,
  updateTrainerNotificationSettings as updateTrainerNotificationSettingsAction,
  updateTrainerProfile as updateTrainerProfileAction,
  uploadCommunityEventImages as uploadCommunityEventImagesAction,
  withdrawOrganizerTrainingDraft as withdrawOrganizerTrainingDraftAction,
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
  EventParticipantInput,
  EventParticipantStatusUpdateInput,
  EnrollmentFormInput,
  GroupInput,
  GroupMemberInput,
  GroupMemberUpdateInput,
  GroupUpdateInput,
  OrganizerCalendarFeedInput,
  OrganizerParticipantProfileInput,
  OrganizerTrainingDraftDecisionInput,
  OrganizerTrainingDraftInput,
  OrganizerTrainingDraftUpdateInput,
  ParticipantGroupEventManagementInput,
  ParticipantEnrollmentManagementInput,
  ParticipantOnboardingInput,
  ParticipantProfileUpdateInput,
  NotificationSettingsUpdateInput,
  OrganizerProfileUpdateInput,
  TrainerCalendarFeedInput,
  TrainerSharedSlotInput,
  TrainerSharedSlotUpdateInput,
  TrainingEventImage,
  TrainingEvent,
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
  ensurePhoneParticipantProfileForFlow: (
    seedTrainerId?: string,
  ) => Promise<{ ok: true; userId: string; accountCreated?: boolean }>;
  submitAccountRequest: (input: AccountRequestInput) => Promise<void>;
  connectOrganizerToTrainerWithCode: (
    trainerAuthorizationCode: string,
  ) => Promise<{ ok: true; trainerId: string; organizerProfileCreated: boolean }>;
  completeParticipantOnboarding: (input: ParticipantOnboardingInput) => Promise<void>;
  decideAccountRequest: (
    requestId: string,
    status: "approved" | "rejected",
  ) => Promise<void>;
  decideTrainerAccountApproval: (
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
  manageOwnEnrollment: (
    requestId: string,
    action: ParticipantEnrollmentManagementInput["action"],
    transferTargetEventId?: string,
  ) => Promise<void>;
  manageOwnGroupEventParticipation: (
    eventParticipantId: string,
    action: ParticipantGroupEventManagementInput["action"],
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
  createOrganizerTrainingDraft: (input: OrganizerTrainingDraftInput) => Promise<void>;
  updateOrganizerTrainingDraft: (input: OrganizerTrainingDraftUpdateInput) => Promise<void>;
  withdrawOrganizerTrainingDraft: (eventId: string) => Promise<void>;
  decideOrganizerTrainingDraft: (
    input: OrganizerTrainingDraftDecisionInput,
  ) => Promise<void>;
  archiveTrainingEvent: (eventId: string) => Promise<void>;
  decideTrainingEventCollaboration: (
    eventId: string,
    status: "accepted" | "rejected",
  ) => Promise<void>;
  createGroup: (input: GroupInput) => Promise<{ ok: true; groupId: string }>;
  updateGroup: (input: GroupUpdateInput) => Promise<void>;
  archiveGroup: (groupId: string) => Promise<void>;
  createOrUpdateOrganizerParticipantProfile: (
    input: OrganizerParticipantProfileInput,
  ) => Promise<void>;
  addGroupMember: (input: GroupMemberInput) => Promise<void>;
  updateGroupMember: (input: GroupMemberUpdateInput) => Promise<void>;
  removeGroupMember: (memberId: string) => Promise<void>;
  addEventParticipant: (input: EventParticipantInput) => Promise<void>;
  updateEventParticipantStatus: (input: EventParticipantStatusUpdateInput) => Promise<void>;
  finalizeEventRoster: (eventId: string) => Promise<void>;
  addTrainerSharedSlot: (input: TrainerSharedSlotInput) => Promise<void>;
  updateTrainerSharedSlot: (input: TrainerSharedSlotUpdateInput) => Promise<void>;
  archiveTrainerSharedSlot: (slotId: string) => Promise<void>;
  addAvailabilitySlot: (
    input: Omit<AvailabilityInput, "trainerId"> & { trainerId?: string },
  ) => Promise<void>;
  addTrainerCalendarFeed: (input: TrainerCalendarFeedInput) => Promise<void>;
  updateTrainerCalendarFeedEnabled: (feedId: string, enabled: boolean) => Promise<void>;
  removeTrainerCalendarFeed: (feedId: string) => Promise<void>;
  syncOwnTrainerCalendarFeeds: () => Promise<void>;
  addOrganizerCalendarFeed: (input: OrganizerCalendarFeedInput) => Promise<void>;
  updateOrganizerCalendarFeedEnabled: (feedId: string, enabled: boolean) => Promise<void>;
  removeOrganizerCalendarFeed: (feedId: string) => Promise<void>;
  syncOwnOrganizerCalendarFeeds: () => Promise<void>;
  resetTrainerOrganizerCalendarFeedToken: (relationId: string) => Promise<void>;
  getTrainerOrganizerGoogleCalendarSubscribeUrl: (
    relationId: string,
  ) => Promise<string>;
  updateTrainerProfile: (input: TrainerProfileUpdateInput) => Promise<void>;
  updateOrganizerProfile: (input: OrganizerProfileUpdateInput) => Promise<void>;
  updateParticipantProfile: (input: ParticipantProfileUpdateInput) => Promise<void>;
  uploadCommunityEventImages: (files: File[]) => Promise<TrainingEventImage[]>;
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
    title?: string,
    location?: string,
    tags?: string[],
    eventImages?: TrainingEventImage[],
    useEventImageAsCover?: boolean,
    scheduleDays?: TrainingEventScheduleDay[],
    transferTargetEventId?: string,
    enrollmentPhotoRequirement?: "default" | "required" | "optional",
    publicationDecision?: "accepted" | "rejected",
    publicationReviewMessage?: string,
  ) => Promise<void>;
  notificationsCount: number;
  getRoleHomePath: (role: AppRole) => string;
  resolveEnrollmentPhoto: (path: string) => Promise<string>;
  confirmEnrollmentAttendance: (
    token: string,
    decision: "confirm" | "decline",
  ) => Promise<void>;
  getCommunityEventReview: (token: string) => Promise<{
    ok: true;
    event: TrainingEvent;
    creatorName: string;
    creatorPhone: string;
  }>;
  reviewCommunityEvent: (input: {
    token: string;
    decision: "accepted" | "rejected";
    message?: string;
  }) => Promise<{ ok: true; eventId: string }>;
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
  return role === "participant" ? "/panel/dashboard" : "/panel/dashboard";
}

function mergeStores(publicStore: DemoStore, privateStore: StorePatch): DemoStore {
  const trainers = sortTrainerProfiles(privateStore.trainers ?? publicStore.trainers);

  return {
    users: privateStore.users ?? publicStore.users,
    trainers,
    organizers: privateStore.organizers ?? publicStore.organizers,
    participantProfiles:
      privateStore.participantProfiles ?? publicStore.participantProfiles,
    groups: privateStore.groups ?? publicStore.groups,
    groupMembers: privateStore.groupMembers ?? publicStore.groupMembers,
    eventParticipants:
      privateStore.eventParticipants ?? publicStore.eventParticipants,
    relations: privateStore.relations ?? publicStore.relations,
    trainingEvents: privateStore.trainingEvents ?? publicStore.trainingEvents,
    publicTrainingEvents: privateStore.publicTrainingEvents ?? publicStore.publicTrainingEvents,
    availabilitySlots: privateStore.availabilitySlots ?? publicStore.availabilitySlots,
    trainerSharedSlots: privateStore.trainerSharedSlots ?? publicStore.trainerSharedSlots,
    trainerCalendarFeeds:
      privateStore.trainerCalendarFeeds ?? publicStore.trainerCalendarFeeds,
    organizerCalendarFeeds:
      privateStore.organizerCalendarFeeds ?? publicStore.organizerCalendarFeeds,
    trainerOrganizerCalendarFeeds:
      privateStore.trainerOrganizerCalendarFeeds ?? publicStore.trainerOrganizerCalendarFeeds,
    trainerExternalBusyMonths:
      privateStore.trainerExternalBusyMonths ?? publicStore.trainerExternalBusyMonths,
    enrollmentRequests:
      privateStore.enrollmentRequests ?? publicStore.enrollmentRequests,
    notifications: privateStore.notifications ?? publicStore.notifications,
    accountRequests: privateStore.accountRequests ?? publicStore.accountRequests,
    trainerAccountApprovals:
      privateStore.trainerAccountApprovals ?? publicStore.trainerAccountApprovals,
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
      async ensurePhoneParticipantProfileForFlow(seedTrainerId) {
        return withFriendlyErrors(() =>
          ensurePhoneParticipantProfileForFlowAction(seedTrainerId),
        );
      },
      async submitAccountRequest(input) {
        await withFriendlyErrors(() => submitAccountRequestAction(input));
      },
      async connectOrganizerToTrainerWithCode(trainerAuthorizationCode) {
        return withFriendlyErrors(() =>
          connectOrganizerToTrainerWithCodeAction(trainerAuthorizationCode),
        );
      },
      async completeParticipantOnboarding(input) {
        await withFriendlyErrors(() => completeParticipantOnboardingAction(input));
      },
      async decideAccountRequest(requestId, status) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          decideAccountRequestAction(requestId, currentUser, status),
        );
      },
      async decideTrainerAccountApproval(approvalId, status) {
        if (!currentUser) {
          throw new Error("Musisz byÄ‡ zalogowany.");
        }

        await withFriendlyErrors(() =>
          decideTrainerAccountApprovalAction(approvalId, status, currentUser),
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
      async manageOwnEnrollment(requestId, action, transferTargetEventId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          manageOwnEnrollmentAction(
            {
              requestId,
              action,
              transferTargetEventId,
            },
            currentUser,
          ),
        );
      },
      async manageOwnGroupEventParticipation(eventParticipantId, action, transferTargetEventId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          manageOwnGroupEventParticipationAction(
            {
              eventParticipantId,
              action,
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
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          detachRelationAction(relationId, currentUser, archiveLinkedEvents),
        );
      },
      async createTrainingEvent(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => createTrainingEventAction(input, currentUser));
      },
      async createOrganizerTrainingDraft(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => createOrganizerTrainingDraftAction(input, currentUser));
      },
      async updateOrganizerTrainingDraft(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => updateOrganizerTrainingDraftAction(input, currentUser));
      },
      async withdrawOrganizerTrainingDraft(eventId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          withdrawOrganizerTrainingDraftAction(eventId, currentUser),
        );
      },
      async decideOrganizerTrainingDraft(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => decideOrganizerTrainingDraftAction(input, currentUser));
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
      async createGroup(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        return withFriendlyErrors(() => createGroupAction(input, currentUser));
      },
      async updateGroup(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => updateGroupAction(input, currentUser));
      },
      async archiveGroup(groupId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => archiveGroupAction(groupId, currentUser));
      },
      async createOrUpdateOrganizerParticipantProfile(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          createOrUpdateOrganizerParticipantProfileAction(input, currentUser),
        );
      },
      async addGroupMember(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => addGroupMemberAction(input, currentUser));
      },
      async updateGroupMember(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => updateGroupMemberAction(input, currentUser));
      },
      async removeGroupMember(memberId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => removeGroupMemberAction(memberId, currentUser));
      },
      async addEventParticipant(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => addEventParticipantAction(input, currentUser));
      },
      async updateEventParticipantStatus(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => updateEventParticipantStatusAction(input, currentUser));
      },
      async finalizeEventRoster(eventId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => finalizeEventRosterAction(eventId, currentUser));
      },
      async addTrainerSharedSlot(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => addTrainerSharedSlotAction(input, currentUser));
      },
      async updateTrainerSharedSlot(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => updateTrainerSharedSlotAction(input, currentUser));
      },
      async archiveTrainerSharedSlot(slotId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => archiveTrainerSharedSlotAction(slotId, currentUser));
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
      async addOrganizerCalendarFeed(input) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => addOrganizerCalendarFeedAction(input, currentUser));
      },
      async updateOrganizerCalendarFeedEnabled(feedId, enabled) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateOrganizerCalendarFeedEnabledAction(feedId, enabled, currentUser),
        );
      },
      async removeOrganizerCalendarFeed(feedId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          removeOrganizerCalendarFeedAction(feedId, currentUser),
        );
      },
      async syncOwnOrganizerCalendarFeeds() {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => syncOwnOrganizerCalendarFeedsAction(currentUser));
      },
      async resetTrainerOrganizerCalendarFeedToken(relationId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          resetTrainerOrganizerCalendarFeedTokenAction(relationId, currentUser),
        );
      },
      async getTrainerOrganizerGoogleCalendarSubscribeUrl(relationId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        const result = await withFriendlyErrors(() =>
          getTrainerOrganizerGoogleCalendarSubscribeUrlAction(relationId, currentUser),
        );

        return result.subscribeUrl;
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
      async updateParticipantProfile(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() => updateParticipantProfileAction(currentUser, input));
      },
      async uploadCommunityEventImages(files) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        return withFriendlyErrors(() => uploadCommunityEventImagesAction(files));
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
        title,
        location,
        tags,
        eventImages,
        useEventImageAsCover,
        scheduleDays,
        transferTargetEventId,
        enrollmentPhotoRequirement,
        publicationDecision,
        publicationReviewMessage,
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
              title,
              location,
              tags,
              eventImages,
              useEventImageAsCover,
              scheduleDays,
              transferTargetEventId,
              enrollmentPhotoRequirement,
              publicationDecision,
              publicationReviewMessage,
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
      async getCommunityEventReview(token) {
        return withFriendlyErrors(() => getCommunityEventReviewAction(token));
      },
      async reviewCommunityEvent(input) {
        return withFriendlyErrors(() => reviewCommunityEventAction(input));
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
