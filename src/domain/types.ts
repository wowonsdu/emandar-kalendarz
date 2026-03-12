export type AppRole = "admin" | "trainer" | "organizer";

export type UserStatus = "active" | "invited";
export type RelationStatus = "pending" | "approved" | "rejected" | "detached";
export type DecisionStatus = "pending" | "accepted" | "rejected";
export type EnrollmentFinalStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "partial";
export type EnrollmentPhotoStatus = "pending" | "ready" | "error";
export type AccountRequestStatus = "pending" | "approved" | "rejected";
export type EmandarBrandStatus = "official" | "supported";
export type TrainingEventStatus = "active" | "confirmed" | "cancelled";
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
  displayName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  status: UserStatus;
  trainerProfileId?: string;
  organizerProfileId?: string;
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
  avatarUploadedAt?: string;
  brandStatus: EmandarBrandStatus;
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
  notificationSettings?: NotificationSettings;
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

export interface TrainingEventScheduleDay {
  startsAt: string;
  endsAt: string;
}

export interface TrainingEvent {
  id: string;
  trainerId: string;
  organizerId?: string | null;
  trainerUserId?: string;
  organizerUserId?: string | null;
  title: string;
  summary: string;
  description: string;
  type: string;
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
  minimumParticipants?: number;
  requiresOrganizerApproval?: boolean;
  trainerCollaborationStatus?: EventCollaborationStatus;
  organizerCollaborationStatus?: EventCollaborationStatus;
  selfManagedByTrainer?: boolean;
  createdByRole?: "trainer" | "organizer";
  archivedAt?: string;
  archivedByRole?: AppRole;
  archivedReason?: "relation-detached" | "manual";
  archivedForOrganizerId?: string | null;
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

export interface SharedAvailabilityWindow {
  startsAt: string;
  endsAt: string;
  durationHours: number;
  availableTrainerIds: string[];
  missingTrainerIds: string[];
  availableCount: number;
  isFullMatch: boolean;
}

export interface EnrollmentRequest {
  id: string;
  eventId: string;
  trainerId: string;
  organizerId?: string | null;
  submitterUid?: string;
  trainerUserId?: string;
  organizerUserId?: string | null;
  imieNazwisko: string;
  telefon: string;
  polecenieOdKogo: string;
  wiadomosc: string;
  photoStatus: EnrollmentPhotoStatus;
  photoPath?: string;
  photoUploadedAt?: string;
  photoContentType?: string;
  trainerDecision: DecisionStatus;
  organizerDecision: DecisionStatus;
  finalStatus: EnrollmentFinalStatus;
  attendanceConfirmationStatus?: EnrollmentAttendanceConfirmationStatus;
  attendanceConfirmationRequestedAt?: string;
  attendanceConfirmationRespondedAt?: string;
  createdAt: string;
  requiresOrganizerApproval?: boolean;
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

export interface AccountRequest {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  requestedRoles?: Array<Exclude<AppRole, "admin">>;
  notes: string;
  status: AccountRequestStatus;
  createdAt: string;
}

export interface DemoStore {
  users: AppUser[];
  trainers: TrainerProfile[];
  organizers: OrganizerProfile[];
  relations: TrainerOrganizerRelation[];
  trainingEvents: TrainingEvent[];
  availabilitySlots: AvailabilitySlot[];
  trainerCalendarFeeds: TrainerCalendarFeed[];
  trainerExternalBusyMonths: TrainerExternalBusyMonth[];
  enrollmentRequests: EnrollmentRequest[];
  notifications: NotificationRecord[];
  accountRequests: AccountRequest[];
}

export interface AuthSession {
  userId: string | null;
}

export interface EnrollmentFormInput {
  eventId: string;
  imieNazwisko: string;
  telefon: string;
  polecenieOdKogo: string;
  wiadomosc: string;
  photoFile: File;
}

export interface AccountRequestInput {
  displayName: string;
  email: string;
  phone: string;
  requestedRoles: Array<Exclude<AppRole, "admin">>;
  notes: string;
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

export interface TrainingEventInput {
  trainerId?: string;
  organizerId?: string;
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
  selfManagedByTrainer?: boolean;
}

export interface TrainerProfileUpdateInput {
  heroNote: string;
  bio: string;
  specialties: string[];
  locations: string[];
  avatarFile?: File | null;
}

export interface OrganizerProfileUpdateInput {
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
  tags?: string[];
  scheduleDays?: TrainingEventScheduleDay[];
  transferTargetEventId?: string | null;
}

export interface EnrollmentRequestManagementInput {
  requestId: string;
  decision: DecisionStatus;
  transferTargetEventId?: string | null;
}

export interface TrainingEventCollaborationUpdateInput {
  eventId: string;
  status: Extract<EventCollaborationStatus, "accepted" | "rejected">;
}
