import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { mapAppError } from "@/domain/errors";
import { getHighestRole, sortTrainerProfiles } from "@/domain/utils";
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
  deleteTrainingEvent as deleteTrainingEventAction,
  decideEnrollment as decideEnrollmentAction,
  decideOrganizerTrainingDraft as decideOrganizerTrainingDraftAction,
  decideTrainingEventCollaboration as decideTrainingEventCollaborationAction,
  detachRelation as detachRelationAction,
  ensurePhoneParticipantProfileForFlow as ensurePhoneParticipantProfileForFlowAction,
  finalizeEventRoster as finalizeEventRosterAction,
  getCommunityEventReview as getCommunityEventReviewAction,
  getTrainerOrganizerGoogleCalendarSubscribeUrl as getTrainerOrganizerGoogleCalendarSubscribeUrlAction,
  manageOwnGroupEventParticipation as manageOwnGroupEventParticipationAction,
  manageEnrollmentRequest as manageEnrollmentRequestAction,
  publishTrainingEvent as publishTrainingEventAction,
  removeOrganizerCalendarFeed as removeOrganizerCalendarFeedAction,
  removeGroupMember as removeGroupMemberAction,
  registerParticipant as registerParticipantAction,
  resetTrainerOrganizerCalendarFeedToken as resetTrainerOrganizerCalendarFeedTokenAction,
  resolveEnrollmentPhoto,
  reviewCommunityEvent as reviewCommunityEventAction,
  signIn as signInAction,
  signOut as signOutAction,
  submitEnrollment as submitEnrollmentAction,
  subscribeAuthState,
  subscribePrivateStore,
  subscribePublicStore,
  subscribeUserProfile,
  syncOwnOrganizerCalendarFeeds as syncOwnOrganizerCalendarFeedsAction,
  syncOwnTrainerCalendarFeeds as syncOwnTrainerCalendarFeedsAction,
  removeTrainerCalendarFeed as removeTrainerCalendarFeedAction,
  unpublishTrainingEvent as unpublishTrainingEventAction,
  updateTrainingEventBrandStatus as updateTrainingEventBrandStatusAction,
  updateAppSettings as updateAppSettingsAction,
  updateEventParticipantStatus as updateEventParticipantStatusAction,
  updateGroup as updateGroupAction,
  updateGroupMember as updateGroupMemberAction,
  updateCommunityOrganizerProfile as updateCommunityOrganizerProfileAction,
  updateOrganizerCalendarFeedEnabled as updateOrganizerCalendarFeedEnabledAction,
  updateOrganizerTrainingDraft as updateOrganizerTrainingDraftAction,
  updateTrainerCalendarFeedEnabled as updateTrainerCalendarFeedEnabledAction,
  updateTrainerSharedSlot as updateTrainerSharedSlotAction,
  updateTrainingEventManagement as updateTrainingEventManagementAction,
  updateOrganizerProfile as updateOrganizerProfileAction,
  updateUserModeratorRole as updateUserModeratorRoleAction,
  updateUserOrganizerFunctionsBlocked as updateUserOrganizerFunctionsBlockedAction,
  updateParticipantProfile as updateParticipantProfileAction,
  updateOrganizerNotificationSettings as updateOrganizerNotificationSettingsAction,
  updateTrainerBrandStatus as updateTrainerBrandStatusAction,
  updateTrainerNotificationSettings as updateTrainerNotificationSettingsAction,
  updateTrainerProfile as updateTrainerProfileAction,
  updateUserNotificationSettings as updateUserNotificationSettingsAction,
  uploadCommunityEventImages as uploadCommunityEventImagesAction,
  withdrawOrganizerTrainingDraft as withdrawOrganizerTrainingDraftAction,
} from "@/data/mockRepository";
import type {
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
  CommunityOrganizerProfileUpdateInput,
  OrganizerCalendarFeedInput,
  OrganizerParticipantProfileInput,
  OrganizerTrainingDraftDecisionInput,
  OrganizerTrainingDraftInput,
  OrganizerTrainingDraftUpdateInput,
  ParticipantGroupEventManagementInput,
  ParticipantOnboardingInput,
  ParticipantRegistrationInput,
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
  hasAuthenticatedSession: boolean;
  currentUserReady: boolean;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signOut: () => Promise<void>;
  submitEnrollment: (input: EnrollmentFormInput) => Promise<void>;
  ensurePhoneParticipantProfileForFlow: (
    seedTrainerId?: string,
  ) => Promise<{ ok: true; userId: string; accountCreated?: boolean }>;
  registerParticipant: (input: ParticipantRegistrationInput) => Promise<void>;
  connectOrganizerToTrainerWithCode: (
    trainerAuthorizationCode: string,
    expectedTrainerId?: string,
  ) => Promise<{ ok: true; trainerId: string; organizerProfileCreated: boolean }>;
  completeParticipantOnboarding: (input: ParticipantOnboardingInput) => Promise<void>;
  decideEnrollment: (
    requestId: string,
    decision: "accepted" | "rejected",
  ) => Promise<void>;
  manageEnrollmentRequest: (
    requestId: string,
    decision: DecisionStatus,
    transferTargetEventId?: string,
  ) => Promise<void>;
  manageOwnGroupEventParticipation: (
    eventParticipantId: string,
    action: ParticipantGroupEventManagementInput["action"],
    transferTargetEventId?: string,
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
  publishTrainingEvent: (eventId: string) => Promise<void>;
  unpublishTrainingEvent: (eventId: string) => Promise<void>;
  deleteTrainingEvent: (eventId: string) => Promise<void>;
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
  updateCommunityOrganizerProfile: (
    input: CommunityOrganizerProfileUpdateInput,
  ) => Promise<void>;
  updateUserModeratorRole: (userId: string, enabled: boolean) => Promise<void>;
  updateUserOrganizerFunctionsBlocked: (
    userId: string,
    blocked: boolean,
  ) => Promise<void>;
  updateParticipantProfile: (input: ParticipantProfileUpdateInput) => Promise<void>;
  uploadCommunityEventImages: (files: File[]) => Promise<TrainingEventImage[]>;
  updateAppSettings: (input: AppSettings) => Promise<void>;
  updateNotificationSettings: (
    input: NotificationSettingsUpdateInput,
  ) => Promise<void>;
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
    confirmationLeadTimeDays?: number,
    title?: string,
    location?: string,
    summary?: string,
    description?: string,
    tags?: string[],
    eventImages?: TrainingEventImage[],
    useEventImageAsCover?: boolean,
    scheduleDays?: TrainingEventScheduleDay[],
    transferTargetEventId?: string,
    enrollmentPhotoRequirement?: "default" | "required" | "optional",
    joinAudienceSetting?: "default" | "existing-practitioners" | "new-people",
    publicationDecision?: "accepted" | "rejected",
    publicationReviewMessage?: string,
  ) => Promise<void>;
  notificationsCount: number;
  getPublicSignedInPath: () => string;
  getPanelHomePath: (role: AppRole) => string;
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

function getPublicSignedInPath() {
  return "/kalendarz";
}

function getPanelHomePath(role: AppRole) {
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
  const [rawCurrentUser, setRawCurrentUser] = useState<AppUser | null>(null);
  const [currentUserReady, setCurrentUserReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    return subscribePublicStore((patch) => {
      setPublicStore((previous) => ({
        ...previous,
        ...patch,
      }));
    });
  }, []);

  useEffect(() => {
    return subscribeAuthState((userId) => {
      setAuthReady(true);

      if (!userId) {
        setAuthUserId(null);
        setRawCurrentUser(null);
        setPrivateStore({});
        setCurrentUserReady(true);
        return;
      }

      setRawCurrentUser(null);
      setPrivateStore({});
      setCurrentUserReady(false);
      setAuthUserId(userId);
    });
  }, []);

  useEffect(() => {
    if (!authUserId) {
      return;
    }

    return subscribeUserProfile(authUserId, (user) => {
      setRawCurrentUser(user);
      setCurrentUserReady(true);
      setPrivateStore((previous) =>
        applyPatch(previous, {
          users: user ? [user] : [],
        }),
      );
    });
  }, [authUserId]);

  const currentUser = useMemo<AppUser | null>(() => {
    if (!rawCurrentUser) {
      return null;
    }

    const highestRole = getHighestRole(rawCurrentUser);
    if (rawCurrentUser.role === highestRole) {
      return rawCurrentUser;
    }

    return {
      ...rawCurrentUser,
      role: highestRole,
    };
  }, [rawCurrentUser]);

  const hasAuthenticatedSession = authUserId !== null;

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
      store,
      currentUser,
      hasAuthenticatedSession,
      currentUserReady,
      authReady,
      async signIn(email, password) {
        return withFriendlyErrors(() => signInAction(email, password));
      },
      async signOut() {
        await withFriendlyErrors(() => signOutAction());
      },
      async submitEnrollment(input) {
        await withFriendlyErrors(() => submitEnrollmentAction(input));
      },
      async ensurePhoneParticipantProfileForFlow(seedTrainerId) {
        return withFriendlyErrors(() =>
          ensurePhoneParticipantProfileForFlowAction(seedTrainerId),
        );
      },
      async registerParticipant(input) {
        await withFriendlyErrors(() => registerParticipantAction(input));
      },
      async connectOrganizerToTrainerWithCode(trainerAuthorizationCode, expectedTrainerId) {
        return withFriendlyErrors(() =>
          connectOrganizerToTrainerWithCodeAction(trainerAuthorizationCode, expectedTrainerId),
        );
      },
      async completeParticipantOnboarding(input) {
        await withFriendlyErrors(() => completeParticipantOnboardingAction(input));
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
      async publishTrainingEvent(eventId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => publishTrainingEventAction(eventId, currentUser));
      },
      async unpublishTrainingEvent(eventId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => unpublishTrainingEventAction(eventId, currentUser));
      },
      async deleteTrainingEvent(eventId) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() => deleteTrainingEventAction(eventId, currentUser));
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

        await withFriendlyErrors(() => updateTrainerProfileAction(input, currentUser));
      },
      async updateOrganizerProfile(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() => updateOrganizerProfileAction(input, currentUser));
      },
      async updateCommunityOrganizerProfile(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateCommunityOrganizerProfileAction(input, currentUser),
        );
      },
      async updateUserModeratorRole(userId, enabled) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateUserModeratorRoleAction(userId, enabled, currentUser),
        );
      },
      async updateUserOrganizerFunctionsBlocked(userId, blocked) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateUserOrganizerFunctionsBlockedAction(userId, blocked, currentUser),
        );
      },
      async updateParticipantProfile(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() => updateParticipantProfileAction(input, currentUser));
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
      async updateNotificationSettings(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateUserNotificationSettingsAction(input, currentUser),
        );
      },
      async updateTrainerNotificationSettings(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateTrainerNotificationSettingsAction(input, currentUser),
        );
      },
      async updateOrganizerNotificationSettings(input) {
        if (!currentUser) {
          throw new Error("Musisz byc zalogowany.");
        }

        await withFriendlyErrors(() =>
          updateOrganizerNotificationSettingsAction(input, currentUser),
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
        confirmationLeadTimeDays,
        title,
        location,
        summary,
        description,
        tags,
        eventImages,
        useEventImageAsCover,
        scheduleDays,
        transferTargetEventId,
        enrollmentPhotoRequirement,
        joinAudienceSetting,
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
              confirmationLeadTimeDays,
              title,
              location,
              summary,
              description,
              tags,
              eventImages,
              useEventImageAsCover,
              scheduleDays,
              transferTargetEventId,
              enrollmentPhotoRequirement,
              joinAudienceSetting,
              publicationDecision,
              publicationReviewMessage,
            },
            currentUser,
          ),
        );
      },
      notificationsCount,
      getPublicSignedInPath,
      getPanelHomePath,
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
    [authReady, currentUser, currentUserReady, hasAuthenticatedSession, notificationsCount, store],
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
