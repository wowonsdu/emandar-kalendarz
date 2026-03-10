export type AppRole = "admin" | "trainer" | "organizer";

export type UserStatus = "active" | "invited";
export type RelationStatus = "pending" | "approved" | "rejected";
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

export interface AppUser {
  id: string;
  role: AppRole;
  displayName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  status: UserStatus;
  profileId?: string;
  createdAt?: string;
  password?: string;
}

export interface TrainerProfile {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  bio: string;
  specialties: string[];
  locations: string[];
  isVisible: boolean;
  heroNote: string;
  avatarUrl?: string;
  avatarPath?: string;
  avatarUploadedAt?: string;
  brandStatus: EmandarBrandStatus;
}

export interface OrganizerProfile {
  id: string;
  userId: string;
  displayName: string;
  description: string;
  isVisible: boolean;
  contactName?: string;
  location?: string;
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
}

export interface GroupRecord {
  id: string;
  organizerId: string;
  trainerId: string;
  organizerUserId?: string;
  trainerUserId?: string;
  name: string;
  visibility: "private" | "public";
  location: string;
  notes: string;
  createdAt: string;
}

export interface TrainingEvent {
  id: string;
  trainerId: string;
  organizerId?: string | null;
  trainerUserId?: string;
  organizerUserId?: string | null;
  groupId?: string;
  title: string;
  summary: string;
  description: string;
  type: string;
  startsAt: string;
  endsAt: string;
  dayTwoStartsAt?: string;
  dayTwoEndsAt?: string;
  location: string;
  capacity: number;
  enrolledCount: number;
  isPublished: boolean;
  imageHint: string;
  brandStatus: EmandarBrandStatus;
  status?: TrainingEventStatus;
  minimumParticipants?: number;
  requiresOrganizerApproval?: boolean;
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
    | "group"
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
  requestedRole: Exclude<AppRole, "admin">;
  notes: string;
  status: AccountRequestStatus;
  createdAt: string;
}

export interface DemoStore {
  users: AppUser[];
  trainers: TrainerProfile[];
  organizers: OrganizerProfile[];
  relations: TrainerOrganizerRelation[];
  groups: GroupRecord[];
  trainingEvents: TrainingEvent[];
  availabilitySlots: AvailabilitySlot[];
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
  requestedRole: Exclude<AppRole, "admin">;
  notes: string;
}

export interface GroupInput {
  organizerId: string;
  trainerId: string;
  name: string;
  visibility: "private" | "public";
  location: string;
  notes: string;
}

export interface AvailabilityInput {
  trainerId: string;
  startsAt: string;
  endsAt: string;
  location: string;
  notes: string;
}

export interface TrainingEventInput {
  organizerId?: string;
  summary: string;
  description: string;
  type: string;
  startsAt: string;
  endsAt: string;
  dayTwoStartsAt: string;
  dayTwoEndsAt: string;
  location: string;
  capacity: number;
  isPublished: boolean;
  brandStatus?: EmandarBrandStatus;
  status?: TrainingEventStatus;
  minimumParticipants?: number;
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
  transferTargetEventId?: string | null;
}

export interface EnrollmentRequestManagementInput {
  requestId: string;
  decision: DecisionStatus;
  transferTargetEventId?: string | null;
}
