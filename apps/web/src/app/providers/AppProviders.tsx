import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { mapAppError } from "@/domain/errors";
import { getHighestRole, sortTrainerProfiles } from "@/domain/utils";
import {
  addEventParticipant as addEventParticipantAction,
  addGroupMember as addGroupMemberAction,
  archiveGroup as archiveGroupAction,
  archiveTrainingEvent as archiveTrainingEventAction,
  completeParticipantOnboarding as completeParticipantOnboardingAction,
  connectOrganizerToTrainerWithCode as connectOrganizerToTrainerWithCodeAction,
  confirmEnrollmentAttendance as confirmEnrollmentAttendanceAction,
  createGroup as createGroupAction,
  createOrUpdateOrganizerParticipantProfile as createOrUpdateOrganizerParticipantProfileAction,
  createEmptyStore,
  createUnifiedTrainingEvent as createTrainingEventAction,
  deleteTrainingEvent as deleteTrainingEventAction,
  decideEnrollment as decideEnrollmentAction,
  decideTrainingEventCollaboration as decideTrainingEventCollaborationAction,
  detachRelation as detachRelationAction,
  ensurePhoneParticipantProfileForFlow as ensurePhoneParticipantProfileForFlowAction,
  fetchAuthSession,
  fetchCurrentUser,
  fetchPanelNavigation,
  fetchPanelStore,
  fetchPublicCatalogStore,
  finalizeEventRoster as finalizeEventRosterAction,
  getCommunityEventReview as getCommunityEventReviewAction,
  manageOwnGroupEventParticipation as manageOwnGroupEventParticipationAction,
  manageEnrollmentRequest as manageEnrollmentRequestAction,
  openPanelEventsStream,
  publishTrainingEvent as publishTrainingEventAction,
  removeGroupMember as removeGroupMemberAction,
  registerParticipant as registerParticipantAction,
  resolveEnrollmentPhoto,
  reviewCommunityEvent as reviewCommunityEventAction,
  signIn as signInAction,
  signOut as signOutAction,
  submitEnrollment as submitEnrollmentAction,
  unpublishTrainingEvent as unpublishTrainingEventAction,
  updateTrainingEventBrandStatus as updateTrainingEventBrandStatusAction,
  updateAppSettings as updateAppSettingsAction,
  updateEventParticipantStatus as updateEventParticipantStatusAction,
  updateGroup as updateGroupAction,
  updateGroupMember as updateGroupMemberAction,
  updateCommunityOrganizerProfile as updateCommunityOrganizerProfileAction,
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
} from "@/data/apiClient";
import { queryKeys } from "@/data/queryClient";
import type {
  AppSettings,
  AppRole,
  AppUser,
  DecisionStatus,
  DemoStore,
  EmandarBrandStatus,
  EventParticipantInput,
  EventParticipantStatus,
  EventParticipantStatusUpdateInput,
  EnrollmentFormInput,
  GroupInput,
  GroupMemberInput,
  GroupMemberUpdateInput,
  GroupUpdateInput,
  CommunityOrganizerProfileUpdateInput,
  OrganizerParticipantProfileInput,
  ParticipantGroupEventManagementInput,
  ParticipantOnboardingInput,
  ParticipantRegistrationInput,
  ParticipantProfileUpdateInput,
  NotificationSettingsUpdateInput,
  OrganizerProfileUpdateInput,
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
    acceptedParticipantStatus?: Extract<EventParticipantStatus, "invited" | "confirmed" | "rezerwowy">,
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

function mergeStores(publicStore: DemoStore, privateStore: Partial<DemoStore>): DemoStore {
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
    enrollmentRequests:
      privateStore.enrollmentRequests ?? publicStore.enrollmentRequests,
    notifications: privateStore.notifications ?? publicStore.notifications,
    appSettings: privateStore.appSettings ?? publicStore.appSettings,
  };
}

export function AppProviders({ children }: { children: ReactNode }) {
  const publicStoreQuery = useQuery({
    queryKey: queryKeys.publicCatalog,
    queryFn: fetchPublicCatalogStore,
    staleTime: 60_000,
  });
  const authSessionQuery = useQuery({
    queryKey: queryKeys.authSession,
    queryFn: fetchAuthSession,
    staleTime: 15_000,
  });
  const authUserId = authSessionQuery.data?.userId ?? null;
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: fetchCurrentUser,
    enabled: Boolean(authUserId),
    retry: false,
  });
  const panelStoreQuery = useQuery({
    queryKey: queryKeys.panelStore,
    queryFn: fetchPanelStore,
    enabled: Boolean(authUserId && currentUserQuery.data),
    staleTime: 15_000,
  });
  const panelNavigationQuery = useQuery({
    queryKey: queryKeys.panelNavigation,
    queryFn: fetchPanelNavigation,
    enabled: Boolean(authUserId && currentUserQuery.data),
    staleTime: 15_000,
  });

  const currentUser = useMemo<AppUser | null>(() => {
    if (!authUserId || !currentUserQuery.data) {
      return null;
    }

    const highestRole = getHighestRole(currentUserQuery.data);
    if (currentUserQuery.data.role === highestRole) {
      return currentUserQuery.data;
    }

    return {
      ...currentUserQuery.data,
      role: highestRole,
    };
  }, [authUserId, currentUserQuery.data]);

  const hasAuthenticatedSession = authUserId !== null;
  const authReady = !authSessionQuery.isLoading;
  const currentUserReady = !authUserId || !currentUserQuery.isLoading;

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }
    return openPanelEventsStream();
  }, [currentUser]);

  const publicStore = publicStoreQuery.data ?? createEmptyStore();
  const privateStore = panelStoreQuery.data ?? (currentUser ? { users: [currentUser] } : {});

  const store = useMemo(
    () => mergeStores(publicStore, privateStore),
    [privateStore, publicStore],
  );

  const notificationsCount =
    panelNavigationQuery.data?.notificationsCount ??
    (currentUser
      ? store.notifications.filter(
          (item) => item.userId === currentUser.id && !item.readAt,
        ).length
      : 0);
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
      async manageEnrollmentRequest(
        requestId,
        decision,
        transferTargetEventId,
        acceptedParticipantStatus,
      ) {
        if (!currentUser) {
          throw new Error("Musisz być zalogowany.");
        }

        await withFriendlyErrors(() =>
          manageEnrollmentRequestAction(
            {
              requestId,
              decision,
              transferTargetEventId,
              acceptedParticipantStatus,
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
