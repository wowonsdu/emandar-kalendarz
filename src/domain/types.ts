export type AppRole = "admin" | "trainer" | "organizer" | "participant" | "moderator";

export type UserStatus = "active" | "invited";
export type RelationStatus = "pending" | "approved" | "rejected" | "detached";
export type DecisionStatus = "pending" | "accepted" | "rejected";
export type EnrollmentFinalStatus =
  | "pending"
  | "accepted"
  | "rejected";
export type EnrollmentIntent = "participating";
export type ParticipantEnrollmentStatus = "active" | "cancelled";
export type EnrollmentPhotoStatus = "pending" | "ready" | "error";
export type PublicationApprovalStatus = "pending" | "accepted" | "rejected";
export type EmandarBrandStatus = "official" | "supported";
export type TrainingEventStatus = "active" | "confirmed" | "cancelled";
export type GroupStatus = "active" | "archived";
export type GroupMemberPriority = "stali" | "regularni" | "rezerwowi";
export type GroupMembershipStatus = "active" | "removed";
export type ParticipantProfileConfirmationStatus = "unconfirmed" | "confirmed";
export type ParticipantProfileStatus = "active" | "archived";
export type GroupEventType = "training" | "post";
export type EventParticipantStatus =
  | "invited"
  | "confirmed"
  | "declined"
  | "removed";
export type TrainingEventWorkflowStatus =
  | "draft-requested"
  | "trainer-accepted"
  | "trainer-rejected"
  | "withdrawn"
  | "published";
export type EnrollmentAttendanceConfirmationStatus =
  | "not-required"
  | "pending"
  | "confirmed"
  | "declined";
export type EventCollaborationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "not-required";
export type EnrollmentPhotoRequirement = "default" | "required" | "optional";
export type PhotoMode = "required" | "optional" | "disabled";
export type TrainingJoinAudience = "existing-practitioners" | "new-people";
export type TrainingJoinAudienceSetting = "default" | TrainingJoinAudience;
export type TrainerSharedSlotSource = "manual" | "ical-derived";
export type TrainerSharedSlotStatus = "active" | "archived";

export interface AvatarCropSettings {
  sourceWidth: number;
  sourceHeight: number;
  zoom: number;
  panX: number;
  panY: number;
}

export interface NotificationSettings {
  reminderLeadDays: number;
  sendToTrainer: boolean;
  sendToOrganizer: boolean;
  sendToParticipants: boolean;
  requireParticipantSmsConfirmation: boolean;
  reminderSmsTemplate: string;
  confirmationSmsTemplate: string;
}

export interface AppUser {
  id: string;
  role: AppRole;
  roles: AppRole[];
  primaryRole: AppRole;
  selectedTrainerIds?: string[];
  participantOnboardingCompletedAt?: string;
  communityEventAutoApprove?: boolean;
  displayName: string;
  notes?: string;
  referralSource?: string;
  email?: string | null;
  phone: string;
  avatarUrl?: string;
  avatarPath?: string;
  avatarCrop?: AvatarCropSettings;
  notificationSettings?: NotificationSettings;
  authProvider?: "phone" | "password";
  phoneVerifiedAt?: string;
  trainingDataConsentAccepted?: boolean;
  trainingDataConsentAcceptedAt?: string;
  status: UserStatus;
  trainerProfileId?: string;
  organizerProfileId?: string;
  participantProfileId?: string;
  organizerFunctionsBlockedAt?: string;
  organizerFunctionsBlockedByUserId?: string;
  createdAt?: string;
  password?: string;
}

export interface TrainerProfile {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  sortOrder?: number;
  bio: string;
  specialties: string[];
  locations: string[];
  isVisible: boolean;
  heroNote: string;
  avatarUrl?: string;
  avatarPath?: string;
  avatarCrop?: AvatarCropSettings;
  avatarUploadedAt?: string;
  brandStatus: EmandarBrandStatus;
  authorizationCode?: string;
  authorizationCodeConfigured?: boolean;
  authorizationCodeUpdatedAt?: string;
  notificationSettings?: NotificationSettings;
}

export interface OrganizerProfile {
  id: string;
  userId: string;
  displayName: string;
  description: string;
  isVisible: boolean;
  contactName?: string;
  location?: string;
  trainingIntent?: string;
  communityProfile?: OrganizerProfileVariant;
  notificationSettings?: NotificationSettings;
}

export interface OrganizerProfileVariant {
  displayName: string;
  description: string;
  contactName?: string;
  location?: string;
}

export interface ParticipantProfile {
  id: string;
  linkedUserId?: string | null;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  phoneLookupKey: string;
  email?: string | null;
  notes?: string;
  referralSource?: string;
  avatarUrl?: string;
  avatarPath?: string;
  avatarCrop?: AvatarCropSettings;
  confirmationStatus: ParticipantProfileConfirmationStatus;
  status: ParticipantProfileStatus;
  managerOrganizerIds?: string[];
  managerOrganizerUserIds?: string[];
  managerTrainerIds?: string[];
  managerTrainerUserIds?: string[];
  groupIds?: string[];
  activeGroupIds?: string[];
  createdAt: string;
  updatedAt?: string;
  createdByOrganizerId?: string | null;
  createdByUserId?: string | null;
  confirmedAt?: string;
}

export interface TrainerOrganizerRelation {
  id: string;
  trainerId: string;
  organizerId: string;
  trainerUserId?: string;
  organizerUserId?: string;
  status: RelationStatus;
  requestedBy: "trainer" | "organizer" | "admin";
  createdAt: string;
  detachedAt?: string;
  detachedByRole?: AppRole;
  archivedLinkedEvents?: boolean;
}

export interface Group {
  id: string;
  name: string;
  organizerId: string;
  organizerUserId?: string;
  trainerId: string;
  trainerUserId?: string;
  status: GroupStatus;
  notes?: string;
  defaultLocation?: string;
  defaultEventType: GroupEventType;
  defaultCapacity?: number;
  defaultTags?: string[];
  defaultConfirmationLeadTimeDays: number;
  defaultJoinAudience: TrainingJoinAudience;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  organizerId: string;
  organizerUserId?: string;
  trainerId: string;
  trainerUserId?: string;
  participantProfileId: string;
  participantUserId?: string | null;
  participantDisplayName: string;
  participantPhone: string;
  priority: GroupMemberPriority;
  membershipStatus: GroupMembershipStatus;
  notes?: string;
  joinedAt: string;
  removedAt?: string;
  updatedAt?: string;
}

export interface TrainingEventScheduleDay {
  startsAt: string;
  endsAt: string;
}

export interface TrainingEventImage {
  id: string;
  url: string;
  storagePath: string;
  width: number;
  height: number;
}

export interface TrainingEvent {
  id: string;
  trainerId?: string | null;
  organizerId?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  trainerUserId?: string | null;
  organizerUserId?: string | null;
  creatorUserId?: string | null;
  creatorDisplayName?: string;
  creatorAvatarUrl?: string | null;
  creatorPhone?: string | null;
  eventImages?: TrainingEventImage[];
  useEventImageAsCover?: boolean;
  title: string;
  summary: string;
  description: string;
  type: string;
  eventTypeSystem?: GroupEventType | null;
  startsAt: string;
  endsAt: string;
  scheduleDays: TrainingEventScheduleDay[];
  location: string;
  tags?: string[];
  capacity: number;
  enrolledCount: number;
  isPublished: boolean;
  imageHint: string;
  brandStatus: EmandarBrandStatus;
  status?: TrainingEventStatus;
  workflowStatus?: TrainingEventWorkflowStatus;
  sharedSlotId?: string | null;
  publishAutomaticallyAfterTrainerApproval?: boolean;
  minimumParticipants?: number;
  requiresOrganizerApproval?: boolean;
  eligibleGroupPriorities?: GroupMemberPriority[];
  confirmationLeadTimeDays?: number;
  trainerCollaborationStatus?: EventCollaborationStatus;
  organizerCollaborationStatus?: EventCollaborationStatus;
  selfManagedByTrainer?: boolean;
  createdByRole?: "trainer" | "organizer" | "participant";
  publicationApprovalStatus?: PublicationApprovalStatus;
  publicationApprovalRequestedAt?: string;
  publicationReviewedAt?: string;
  publicationReviewedByUserId?: string;
  publicationReviewMessage?: string;
  trainerDecidedAt?: string;
  trainerDecidedByUserId?: string;
  trainerDecisionReason?: string;
  rosterFinalizedAt?: string;
  rosterFinalizedByUserId?: string;
  withdrawnAt?: string;
  withdrawnByUserId?: string;
  archivedAt?: string;
  archivedByRole?: AppRole;
  archivedReason?: "relation-detached" | "manual";
  archivedForOrganizerId?: string | null;
  enrollmentPhotoRequirement?: EnrollmentPhotoRequirement;
  joinAudienceSetting?: TrainingJoinAudienceSetting;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  eventTitle: string;
  groupId: string;
  groupName: string;
  organizerId: string;
  organizerUserId: string;
  trainerId: string;
  trainerUserId: string;
  participantProfileId: string;
  participantDisplayName: string;
  participantPhone: string;
  participantUserId?: string | null;
  priority: GroupMemberPriority;
  status: EventParticipantStatus;
  source: "auto-core" | "organizer" | "public-form";
  overCapacity?: boolean;
  invitedAt: string;
  attendanceConfirmationStatus?: EnrollmentAttendanceConfirmationStatus;
  attendanceConfirmationRequestedAt?: string;
  attendanceConfirmationRespondedAt?: string;
  attendanceConfirmationExpiresAt?: string;
  confirmedAt?: string;
  declinedAt?: string;
  removedAt?: string;
  updatedAt?: string;
}

export interface AvailabilitySlot {
  id: string;
  trainerId: string;
  trainerUserId?: string;
  startsAt: string;
  endsAt: string;
  location: string;
  notes: string;
  visibility: "approved-organizers";
  visibleToOrganizerIds?: string[];
}

export interface TrainerSharedSlot {
  id: string;
  trainerId: string;
  trainerUserId?: string;
  startsAt: string;
  endsAt: string;
  location: string;
  notes: string;
  visibility: "approved-organizers";
  source: TrainerSharedSlotSource;
  status: TrainerSharedSlotStatus;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
  archivedReason?: "manual" | "conflict" | "relation-detached";
}

export type TrainerCalendarFeedProvider = "google" | "apple" | "ical";
export type TrainerCalendarFeedSyncStatus = "idle" | "success" | "error";

export interface TrainerCalendarFeed {
  id: string;
  trainerId: string;
  trainerUserId?: string;
  provider: TrainerCalendarFeedProvider;
  url: string;
  enabled: boolean;
  lastSyncedAt?: string;
  lastSyncStatus?: TrainerCalendarFeedSyncStatus;
  lastSyncError?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrganizerExternalBusyMonth {
  id: string;
  organizerId: string;
  monthKey: string;
  intervals: ExternalBusyInterval[];
  updatedAt: string;
}

export interface OrganizerCalendarFeed {
  id: string;
  organizerId: string;
  organizerUserId?: string;
  provider: TrainerCalendarFeedProvider;
  url: string;
  enabled: boolean;
  lastSyncedAt?: string;
  lastSyncStatus?: TrainerCalendarFeedSyncStatus;
  lastSyncError?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TrainerOrganizerCalendarFeed {
  id: string;
  relationId: string;
  trainerId: string;
  organizerId: string;
  trainerUserId?: string;
  organizerUserId?: string;
  tokenVersion: number;
  token?: string;
  tokenHash: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
  tokenRotatedAt?: string;
  publicFeedUrl?: string;
  matchedSharedSlotIds?: string[];
}

export interface ExternalBusyInterval {
  startsAt: string;
  endsAt: string;
  source: "emandar" | "ical";
  sourceLabel?: string;
}

export interface TrainerExternalBusyMonth {
  id: string;
  trainerId: string;
  monthKey: string;
  intervals: ExternalBusyInterval[];
  updatedAt: string;
}

export interface TrainerCalendarLivePreview {
  busyIntervals: ExternalBusyInterval[];
  enabledFeedCount: number;
  successfulFeedCount: number;
  fetchedAt: string;
  rangeStart: string;
  rangeEnd: string;
}

export interface SharedAvailabilityWindow {
  startsAt: string;
  endsAt: string;
  durationHours: number;
  availableTrainerIds: string[];
  missingTrainerIds: string[];
  availableCount: number;
  isFullMatch: boolean;
}

export type TrainerFreeDaySliceBucket =
  | "1-day"
  | "2-days"
  | "3-days"
  | "4-plus-days";

export interface TrainerFreeDaySlice {
  startsAt: string;
  endsAt: string;
  dayKey: string;
  durationHours: number;
  spanStartsAt: string;
  spanEndsAt: string;
  spanDays: number;
  spanBucket: TrainerFreeDaySliceBucket;
}

export interface EnrollmentRequest {
  id: string;
  eventId: string;
  trainerId?: string | null;
  organizerId?: string | null;
  submitterUid?: string;
  participantProfileId?: string | null;
  eventParticipantId?: string | null;
  normalizedPhone?: string;
  trainerUserId?: string | null;
  organizerUserId?: string | null;
  trainerContactName?: string | null;
  trainerContactPhone?: string | null;
  trainerContactEmail?: string | null;
  organizerContactPhone?: string | null;
  organizerContactEmail?: string | null;
  organizerContactName?: string | null;
  intent?: EnrollmentIntent;
  imieNazwisko: string;
  telefon: string;
  polecenieOdKogo: string;
  wiadomosc: string;
  photoStatus: EnrollmentPhotoStatus;
  photoMode?: PhotoMode;
  photoPath?: string;
  photoUploadedAt?: string;
  photoContentType?: string;
  finalStatus: EnrollmentFinalStatus;
  participantStatus?: ParticipantEnrollmentStatus;
  participantManagedAt?: string;
  participantActionSource?: "participant" | "staff";
  attendanceConfirmationStatus?: EnrollmentAttendanceConfirmationStatus;
  attendanceConfirmationRequestedAt?: string;
  attendanceConfirmationRespondedAt?: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string;
  entityType:
    | "request"
    | "relation"
    | "availability"
    | "event"
    | "auth"
    | "account-request";
}

export interface AppSettings {
  signupPhotoMode: PhotoMode;
  enrollmentPhotoMode: PhotoMode;
  defaultNotificationSettings?: NotificationSettings;
}

export interface DemoStore {
  users: AppUser[];
  trainers: TrainerProfile[];
  organizers: OrganizerProfile[];
  participantProfiles?: ParticipantProfile[];
  groups?: Group[];
  groupMembers?: GroupMember[];
  eventParticipants?: EventParticipant[];
  relations: TrainerOrganizerRelation[];
  trainingEvents: TrainingEvent[];
  publicTrainingEvents: TrainingEvent[];
  availabilitySlots: AvailabilitySlot[];
  trainerSharedSlots?: TrainerSharedSlot[];
  trainerCalendarFeeds?: TrainerCalendarFeed[];
  organizerCalendarFeeds?: OrganizerCalendarFeed[];
  trainerOrganizerCalendarFeeds?: TrainerOrganizerCalendarFeed[];
  trainerExternalBusyMonths?: TrainerExternalBusyMonth[];
  organizerExternalBusyMonths?: OrganizerExternalBusyMonth[];
  enrollmentRequests: EnrollmentRequest[];
  notifications: NotificationRecord[];
  appSettings: AppSettings;
}

export interface AuthSession {
  userId: string | null;
}

export interface EnrollmentFormInput {
  eventId: string;
  intent?: EnrollmentIntent;
  imieNazwisko: string;
  telefon: string;
  polecenieOdKogo: string;
  wiadomosc: string;
  photoFile?: File | null;
}

export interface ParticipantRegistrationInput {
  displayName: string;
  phone: string;
  notes: string;
  avatarFile?: File | null;
  trainingDataConsentAccepted: boolean;
}

export interface ParticipantOnboardingInput {
  displayName: string;
  notes?: string;
  selectedTrainerIds: string[];
  avatarFile?: File | null;
}

export interface ParticipantProfileUpdateInput {
  displayName: string;
  referralSource?: string;
  notes?: string;
  avatarFile?: File | null;
  avatarCrop?: AvatarCropSettings;
}

export interface OrganizerParticipantProfileInput {
  displayName: string;
  phone: string;
  notes?: string;
  referralSource?: string;
}

export interface AvailabilityInput {
  trainerId: string;
  startsAt: string;
  endsAt: string;
  location: string;
  notes: string;
}

export interface TrainerCalendarFeedInput {
  provider: TrainerCalendarFeedProvider;
  url: string;
}

export interface OrganizerCalendarFeedInput {
  provider: TrainerCalendarFeedProvider;
  url: string;
}

export interface TrainerSharedSlotInput {
  startsAt: string;
  endsAt: string;
  location: string;
  notes: string;
  source?: TrainerSharedSlotSource;
}

export interface TrainerSharedSlotUpdateInput {
  slotId: string;
  startsAt: string;
  endsAt: string;
  location: string;
  notes: string;
}

export interface OrganizerTrainingDraftInput {
  groupId: string;
  sharedSlotId: string;
  trainerId?: string;
  title?: string;
  eventImages?: TrainingEventImage[];
  useEventImageAsCover?: boolean;
  summary: string;
  description: string;
  type: string;
  eventTypeSystem?: GroupEventType;
  scheduleDays: TrainingEventScheduleDay[];
  location: string;
  tags?: string[];
  capacity: number;
  eligibleGroupPriorities?: GroupMemberPriority[];
  confirmationLeadTimeDays?: number;
  brandStatus?: EmandarBrandStatus;
  status?: TrainingEventStatus;
  minimumParticipants?: number;
  publishAutomaticallyAfterTrainerApproval?: boolean;
}

export interface OrganizerTrainingDraftUpdateInput {
  eventId: string;
  groupId: string;
  sharedSlotId: string;
  title?: string;
  eventImages?: TrainingEventImage[];
  useEventImageAsCover?: boolean;
  summary: string;
  description: string;
  type: string;
  eventTypeSystem?: GroupEventType;
  scheduleDays: TrainingEventScheduleDay[];
  location: string;
  tags?: string[];
  capacity: number;
  eligibleGroupPriorities?: GroupMemberPriority[];
  confirmationLeadTimeDays?: number;
  status?: TrainingEventStatus;
  minimumParticipants?: number;
  publishAutomaticallyAfterTrainerApproval?: boolean;
}

export interface OrganizerTrainingDraftDecisionInput {
  eventId: string;
  decision: "accepted" | "rejected";
  message?: string;
}

export interface TrainingEventInput {
  trainerId?: string;
  organizerId?: string;
  groupId?: string;
  title?: string;
  eventImages?: TrainingEventImage[];
  useEventImageAsCover?: boolean;
  summary: string;
  description: string;
  type: string;
  scheduleDays: TrainingEventScheduleDay[];
  location: string;
  tags?: string[];
  capacity: number;
  isPublished: boolean;
  brandStatus?: EmandarBrandStatus;
  status?: TrainingEventStatus;
  minimumParticipants?: number;
  eventTypeSystem?: GroupEventType;
  eligibleGroupPriorities?: GroupMemberPriority[];
  confirmationLeadTimeDays?: number;
  joinAudienceSetting?: TrainingJoinAudienceSetting;
  selfManagedByTrainer?: boolean;
}

export interface GroupInput {
  name: string;
  trainerId: string;
  notes?: string;
  defaultLocation?: string;
  defaultEventType: GroupEventType;
  defaultCapacity?: number;
  defaultTags?: string[];
  defaultConfirmationLeadTimeDays: number;
  defaultJoinAudience: TrainingJoinAudience;
}

export interface GroupUpdateInput {
  groupId: string;
  name: string;
  notes?: string;
  defaultLocation?: string;
  defaultEventType: GroupEventType;
  defaultCapacity?: number;
  defaultTags?: string[];
  defaultConfirmationLeadTimeDays: number;
  defaultJoinAudience: TrainingJoinAudience;
}

export interface GroupMemberInput {
  groupId: string;
  participantProfileId?: string;
  displayName?: string;
  phone?: string;
  notes?: string;
  referralSource?: string;
  priority: GroupMemberPriority;
  syncFutureEvents?: boolean;
}

export interface GroupMemberUpdateInput {
  memberId: string;
  priority: GroupMemberPriority;
  notes?: string;
}

export interface EventParticipantInput {
  eventId: string;
  participantProfileId: string;
  overCapacity?: boolean;
}

export interface EventParticipantStatusUpdateInput {
  eventParticipantId: string;
  status: EventParticipantStatus;
}

export interface TrainerProfileUpdateInput {
  heroNote: string;
  bio: string;
  specialties: string[];
  locations: string[];
  authorizationCode?: string;
  avatarFile?: File | null;
  avatarCrop?: AvatarCropSettings;
}

export interface OrganizerProfileUpdateInput {
  displayName: string;
  contactName: string;
  location: string;
  description: string;
}

export interface CommunityOrganizerProfileUpdateInput {
  displayName: string;
  contactName: string;
  location: string;
  description: string;
}

export interface NotificationSettingsUpdateInput {
  reminderLeadDays: number;
  sendToTrainer: boolean;
  sendToOrganizer: boolean;
  sendToParticipants: boolean;
  requireParticipantSmsConfirmation: boolean;
  reminderSmsTemplate: string;
  confirmationSmsTemplate: string;
}

export interface TrainerBrandStatusUpdateInput {
  trainerId: string;
  brandStatus: EmandarBrandStatus;
}

export interface TrainingEventBrandStatusUpdateInput {
  eventId: string;
  brandStatus: EmandarBrandStatus;
}

export interface TrainingEventManagementUpdateInput {
  eventId: string;
  status: TrainingEventStatus;
  capacity: number;
  minimumParticipants: number;
  confirmationLeadTimeDays?: number;
  title?: string;
  location?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  eventImages?: TrainingEventImage[];
  useEventImageAsCover?: boolean;
  scheduleDays?: TrainingEventScheduleDay[];
  transferTargetEventId?: string | null;
  enrollmentPhotoRequirement?: EnrollmentPhotoRequirement;
  joinAudienceSetting?: TrainingJoinAudienceSetting;
  publicationDecision?: "accepted" | "rejected";
  publicationReviewMessage?: string;
}

export interface EnrollmentRequestManagementInput {
  requestId: string;
  decision: DecisionStatus;
  transferTargetEventId?: string | null;
}

export interface ParticipantGroupEventManagementInput {
  eventParticipantId: string;
  action: "cancel" | "transfer";
  transferTargetEventId?: string | null;
}

export interface TrainingEventCollaborationUpdateInput {
  eventId: string;
  status: Extract<EventCollaborationStatus, "accepted" | "rejected">;
}
