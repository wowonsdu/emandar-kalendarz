import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Check,
  ImagePlus,
  Phone,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { createAttendanceConfirmationTokens } from "@/data/apiClient";
import { useAppState } from "../../providers/AppProviders";
import {
  type DashboardPerspective,
  getDashboardPerspectives,
  getOrganizerOfficialDashboardModel,
  getParticipantDashboardModel,
  getParticipantEnrollmentViewRecords,
  type ParticipantEnrollmentViewRecord,
  type ParticipantGroupEventRecord,
  type ParticipantPendingEnrollmentRequestRecord,
} from "@/app/dashboard";
import { CommunityEventCard } from "@/app/components/community-event-card";
import { saveOrganizerProfiles } from "@/app/pages/organizer-profile-flow";
import { AvatarMedia } from "@/app/components/avatar-media";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { cn } from "@/app/components/ui/utils";
import {
  NOTIFICATION_TEMPLATE_PLACEHOLDERS,
  normalizeNotificationSettings,
  resolveAttendanceConfirmationStatusLabel,
} from "@/domain/notifications";
import {
  aggregateEventCapacityStats,
  buildPhoneHref,
  canApproveEnrollmentRequest,
  canPublishTrainingEvent,
  canDecideTrainingEventCollaboration,
  canManageTrainingEvent,
  canModerateTrainingEvent,
  canUseOrganizerFunctions,
  getEventCollaborationStatusLabel,
  getAvailablePlaces,
  getEventFillRate,
  getEventOverflowCount,
  getEventParticipantCount,
  getHighestRole,
  getRoleLabel,
  getTrainingJoinAudienceLabel,
  getTrainingEventScheduleBounds,
  getTrainingEventScheduleDays,
  getTrainingEventStatusLabel,
  hasModeratorAccess,
  hasInheritedRole,
  isOfficialGroupTrainingEvent,
  isTrainingEventCollaborationAccepted,
  isTrainingEventArchived,
  isSelfManagedTrainingEvent,
  isCommunityBrandStatus,
  isOrganizerFunctionsBlocked,
  resolveEnrollmentIntent,
  resolveCommunityEventOrganizerPhone,
  resolveEventOwnerDisplayLabels,
  resolveOrganizerProfileVariant,
  resolveOrganizerCollaborationStatus,
  resolveMinimumParticipants,
  resolveTrainingJoinAudienceForEvent,
  resolveTrainerCollaborationStatus,
  resolveTrainingEventWorkflowStatus,
  resolveTrainingEventStatus,
  groupParticipantRecordsByPriority,
  sortEventsByDate,
  sortEventsByFillRate,
  sortParticipantRecordsByPriorityAndName,
  sortTrainerProfiles,
} from "@/domain/utils";
import type {
  AppRole,
  AppUser,
  AvatarCropSettings,
  DecisionStatus,
  DemoStore,
  EmandarBrandStatus,
  EnrollmentFinalStatus,
  EnrollmentIntent,
  EnrollmentRequest,
  EventParticipant,
  EventParticipantStatus,
  Group,
  GroupEventType,
  GroupMember,
  GroupMemberPriority,
  OrganizerProfile,
  ParticipantProfile,
  PhotoMode,
  TrainerProfile,
  TrainerOrganizerRelation,
  TrainingEventImage,
  TrainingJoinAudienceSetting,
  TrainingEvent,
  TrainingEventScheduleDay,
  TrainingEventStatus,
} from "@/domain/types";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatShortTime(date: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

const PROFILE_AVATAR_ASPECT_RATIO = 4 / 5;

type AvatarCropDraft = {
  file: File | null;
  previewUrl: string | null;
  revokePreviewUrl: boolean;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  panX: number;
  panY: number;
};

type AvatarCropDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};

type AvatarCropPinchState = {
  startDistance: number;
  startZoom: number;
  startCenterX: number;
  startCenterY: number;
  startPanX: number;
  startPanY: number;
};

function createEmptyAvatarCropDraft(): AvatarCropDraft {
  return {
    file: null,
    previewUrl: null,
    revokePreviewUrl: false,
    naturalWidth: 0,
    naturalHeight: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
  };
}

function clampAvatarPan(value: number) {
  return Math.max(-100, Math.min(100, value));
}

function getAvatarCoverPlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  zoom: number,
  panX: number,
  panY: number,
) {
  const safeSourceWidth = Math.max(sourceWidth, 1);
  const safeSourceHeight = Math.max(sourceHeight, 1);
  const safeZoom = Math.max(1, zoom);
  const baseScale = Math.max(targetWidth / safeSourceWidth, targetHeight / safeSourceHeight);
  const drawWidth = safeSourceWidth * baseScale * safeZoom;
  const drawHeight = safeSourceHeight * baseScale * safeZoom;
  const overflowX = Math.max(drawWidth - targetWidth, 0);
  const overflowY = Math.max(drawHeight - targetHeight, 0);
  const left = (targetWidth - drawWidth) / 2 + (clampAvatarPan(panX) / 100) * (overflowX / 2);
  const top = (targetHeight - drawHeight) / 2 + (clampAvatarPan(panY) / 100) * (overflowY / 2);

  return {
    drawWidth,
    drawHeight,
    left,
    top,
  };
}

function getAvatarCropPreviewStyle(draft: AvatarCropDraft): CSSProperties | undefined {
  if (!draft.previewUrl || !draft.naturalWidth || !draft.naturalHeight) {
    return undefined;
  }

  const previewFrameWidth = 100;
  const previewFrameHeight = previewFrameWidth / PROFILE_AVATAR_ASPECT_RATIO;
  const placement = getAvatarCoverPlacement(
    draft.naturalWidth,
    draft.naturalHeight,
    previewFrameWidth,
    previewFrameHeight,
    draft.zoom,
    draft.panX,
    draft.panY,
  );

  return {
    position: "absolute",
    width: `${placement.drawWidth}%`,
    height: `${(placement.drawHeight / previewFrameHeight) * 100}%`,
    left: `${placement.left}%`,
    top: `${(placement.top / previewFrameHeight) * 100}%`,
    maxWidth: "none",
  };
}

async function readImageDimensions(previewUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => reject(new Error("Nie udało się odczytać zdjęcia."));
    image.src = previewUrl;
  });
}

function buildAvatarCropSettings(draft: AvatarCropDraft): AvatarCropSettings | undefined {
  if (!draft.previewUrl || !draft.naturalWidth || !draft.naturalHeight) {
    return undefined;
  }

  return {
    sourceWidth: draft.naturalWidth,
    sourceHeight: draft.naturalHeight,
    zoom: draft.zoom,
    panX: draft.panX,
    panY: draft.panY,
  };
}

type GroupFormState = {
  name: string;
  trainerId: string;
  notes: string;
  defaultLocation: string;
  defaultEventType: GroupEventType;
  defaultCapacity: string;
  defaultTagsText: string;
  defaultConfirmationLeadTimeDays: string;
  defaultJoinAudience: "existing-practitioners" | "new-people";
};

type GroupMemberFormState = {
  participantProfileId: string;
  displayName: string;
  phone: string;
  notes: string;
  referralSource: string;
  priority: GroupMemberPriority;
};

type GroupMemberDraftState = {
  priority: GroupMemberPriority;
  notes: string;
};

type GroupMemberSaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
};

type TrainingEventFormState = {
  groupId: string;
  trainerId: string;
  organizerId: string;
  selfManagedByTrainer: boolean;
  title: string;
  eventImages: TrainingEventImage[];
  useEventImageAsCover: boolean;
  summary: string;
  description: string;
  tags: string;
  type: string;
  status: TrainingEventStatus;
  firstDayDate: string;
  scheduleDays: ScheduleDayDraft[];
  location: string;
  capacity: string;
  minimumParticipants: string;
  confirmationLeadTimeDays: string;
  joinAudience: "existing-practitioners" | "new-people";
  isPublished: boolean;
};

type EventManagementSettingsDraft = {
  status: TrainingEventStatus;
  capacity: string;
  minimumParticipants: string;
  confirmationLeadTimeDays: string;
  title: string;
  location: string;
  eventImages: TrainingEventImage[];
  useEventImageAsCover: boolean;
  summary: string;
  description: string;
  enrollmentPhotoRequirement: "default" | "required" | "optional";
  joinAudience: "existing-practitioners" | "new-people";
  tags: string;
  firstDayDate: string;
  scheduleDays: ScheduleDayDraft[];
};

type CommunityEventEditorValues = {
  status: TrainingEventStatus;
  capacity: string;
  minimumParticipants: string;
  confirmationLeadTimeDays: string;
  title: string;
  location: string;
  eventImages: TrainingEventImage[];
  useEventImageAsCover: boolean;
  tags: string;
  summary: string;
  description: string;
  firstDayDate: string;
  scheduleDays: ScheduleDayDraft[];
};

function createEmptyGroupFormState(trainerId = ""): GroupFormState {
  return {
    name: "",
    trainerId,
    notes: "",
    defaultLocation: "",
    defaultEventType: "training",
    defaultCapacity: "20",
    defaultTagsText: "",
    defaultConfirmationLeadTimeDays: "7",
    defaultJoinAudience: "new-people",
  };
}

function createEmptyTrainingEventFormState(): TrainingEventFormState {
  return {
    groupId: "",
    trainerId: "",
    organizerId: "",
    selfManagedByTrainer: false,
    title: "",
    eventImages: [],
    useEventImageAsCover: false,
    summary: "",
    description: "",
    tags: "",
    type: "Warsztat stacjonarny",
    status: "active",
    firstDayDate: "",
    scheduleDays: resizeScheduleDayDrafts(2, []),
    location: "",
    capacity: "20",
    minimumParticipants: "10",
    confirmationLeadTimeDays: "5",
    joinAudience: "new-people",
    isPublished: true,
  };
}

export function getGroupTrainingCreatePath(groupId: string) {
  const params = new URLSearchParams({
    groupId,
    returnToGroupId: groupId,
  });

  return `/panel/szkolenia/utworz?${params.toString()}`;
}

export function getLatestGroupTrainingCopy(
  events: TrainingEvent[],
  groupId: string,
) {
  const latestGroupEvent = sortEventsByDate(
    events.filter(
      (event) =>
        event.groupId === groupId &&
        !isCommunityBrandStatus(event.brandStatus) &&
        !isTrainingEventArchived(event),
    ),
  ).at(-1);

  return {
    summary: latestGroupEvent?.summary ?? "",
    description: latestGroupEvent?.description ?? "",
  };
}

export function applyOfficialGroupDefaultsToTrainingForm(
  previous: TrainingEventFormState,
  group: Group | null,
  events: TrainingEvent[],
): TrainingEventFormState {
  if (!group) {
    return previous;
  }

  const latestGroupCopy = getLatestGroupTrainingCopy(events, group.id);

  return {
    ...previous,
    groupId: group.id,
    trainerId: group.trainerId,
    summary: latestGroupCopy.summary,
    description: latestGroupCopy.description,
    location: group.defaultLocation ?? "",
    capacity:
      typeof group.defaultCapacity === "number" ? String(group.defaultCapacity) : previous.capacity,
    confirmationLeadTimeDays: String(group.defaultConfirmationLeadTimeDays ?? 5),
    joinAudience: group.defaultJoinAudience ?? previous.joinAudience,
    tags: group.defaultTags?.length ? group.defaultTags.join(", ") : "",
  };
}

function createGroupFormStateFromGroup(group: Group): GroupFormState {
  return {
    name: group.name,
    trainerId: group.trainerId,
    notes: group.notes ?? "",
    defaultLocation: group.defaultLocation ?? "",
    defaultEventType: group.defaultEventType,
    defaultCapacity: String(group.defaultCapacity ?? 20),
    defaultTagsText: (group.defaultTags ?? []).join(", "),
    defaultConfirmationLeadTimeDays: String(group.defaultConfirmationLeadTimeDays ?? 7),
    defaultJoinAudience: group.defaultJoinAudience ?? "new-people",
  };
}

function getPersistedJoinAudienceSetting(
  joinAudience: "existing-practitioners" | "new-people",
  group?: Pick<Group, "defaultJoinAudience"> | null,
): TrainingJoinAudienceSetting {
  if (group && joinAudience === group.defaultJoinAudience) {
    return "default";
  }

  return joinAudience;
}

function createEmptyGroupMemberFormState(): GroupMemberFormState {
  return {
    participantProfileId: "",
    displayName: "",
    phone: "",
    notes: "",
    referralSource: "",
    priority: "rezerwowi",
  };
}

function createGroupMemberDraftState(member: GroupMember): GroupMemberDraftState {
  return {
    priority: member.priority,
    notes: member.notes ?? "",
  };
}

function normalizeGroupMemberNotes(value?: string) {
  return value?.trim() ?? "";
}

function hasGroupMemberDraftChanges(member: GroupMember, draft?: GroupMemberDraftState) {
  if (!draft) {
    return false;
  }

  return (
    draft.priority !== member.priority ||
    normalizeGroupMemberNotes(draft.notes) !== normalizeGroupMemberNotes(member.notes)
  );
}

const GROUP_MEMBER_SAVE_FEEDBACK_MS = 1800;

function normalizeParticipantPhoneLookupKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return digits;
  }

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits;
}

function hasCompleteParticipantPhone(value: string) {
  return normalizeParticipantPhoneLookupKey(value).length >= 11;
}

function applyParticipantProfileToGroupMemberForm(
  previous: GroupMemberFormState,
  profile: ParticipantProfile,
): GroupMemberFormState {
  return {
    ...previous,
    participantProfileId: profile.id,
    displayName: profile.displayName,
    phone: profile.phone,
    referralSource: profile.referralSource ?? "",
  };
}

function getGroupPriorityLabel(priority: GroupMemberPriority) {
  switch (priority) {
    case "stali":
      return "Stali";
    case "regularni":
      return "Regularni";
    default:
      return "Rezerwowi";
  }
}

function getGroupEventTypeLabel(eventType: GroupEventType) {
  return eventType === "post" ? "Post" : "Szkolenie";
}

function sortGroupsByStatusAndName(groups: Group[]) {
  return [...groups].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "active" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "pl");
  });
}

export function splitGroupsByArchivedStatus(groups: Group[]) {
  return {
    active: groups.filter((group) => group.status !== "archived"),
    archived: groups.filter((group) => group.status === "archived"),
  };
}

export function getManagedGroupsForUser(input: {
  currentUser: Pick<AppUser, "role" | "roles" | "primaryRole">;
  groups: Group[];
  organizerProfileId?: string | null;
  trainerProfileId?: string | null;
}) {
  const managedGroupIds = new Set<string>();
  const managedGroups: Group[] = [];

  for (const group of input.groups) {
    const isOrganizerOwned =
      Boolean(input.organizerProfileId) && group.organizerId === input.organizerProfileId;
    const isTrainerOwned =
      hasInheritedRole(input.currentUser, "trainer") &&
      Boolean(input.trainerProfileId) &&
      group.trainerId === input.trainerProfileId;

    if (!isOrganizerOwned && !isTrainerOwned) {
      continue;
    }

    if (managedGroupIds.has(group.id)) {
      continue;
    }

    managedGroupIds.add(group.id);
    managedGroups.push(group);
  }

  return sortGroupsByStatusAndName(managedGroups);
}

function getParticipantConfirmationLabel(profile?: ParticipantProfile | null) {
  if (!profile) {
    return "Brak profilu";
  }

  return profile.confirmationStatus === "confirmed" ? "Potwierdzony" : "Niepotwierdzony";
}

function resolveBrandStatus(
  status: EmandarBrandStatus | undefined,
): EmandarBrandStatus {
  return status === "supported" ? "supported" : "official";
}

function getBrandStatusLabel(status: EmandarBrandStatus | undefined) {
  return resolveBrandStatus(status) === "supported"
    ? "Wspierane przez Emandar"
    : "Oficjalny Emandar";
}

function getEventLifecycleLabel(event: TrainingEvent) {
  return isTrainingEventArchived(event)
    ? "Zarchiwizowane"
    : getTrainingEventStatusLabel(event.status);
}

function getEventOwnerLabel(
  event: TrainingEvent,
  store: ReturnType<typeof useAppState>["store"],
) {
  return resolveEventOwnerDisplayLabels(event, store);
}

function getEventLocationParts(location: string) {
  const [rawPrimaryLocation, ...rawExtras] = location
    .split("+")
    .map((item) => item.trim())
    .filter(Boolean);
  const primaryLocation = rawPrimaryLocation ?? location.trim();
  const [city, ...regionParts] = primaryLocation
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    primaryLocation,
    city: city ?? primaryLocation,
    region: regionParts.length > 0 ? regionParts.join(", ") : null,
    extraLocationLabel: rawExtras.length > 0 ? rawExtras.join(" + ") : null,
  };
}

function getEventCardTitle(
  event: TrainingEvent,
  currentUser: ReturnType<typeof useAppState>["currentUser"],
  store: ReturnType<typeof useAppState>["store"],
) {
  if (isCommunityBrandStatus(event.brandStatus)) {
    return event.title || event.location;
  }

  const ownerLabels = getEventOwnerLabel(event, store);
  const locationParts = getEventLocationParts(event.location);

  if (currentUser?.role === "organizer") {
    const locationLabel = locationParts.region
      ? `${locationParts.city}, ${locationParts.region}`
      : locationParts.city;
    return `${ownerLabels.trainerName}, ${locationLabel}`;
  }

  return locationParts.primaryLocation;
}

function getEventCollaborationNotice(event: TrainingEvent) {
  const trainerStatus = resolveTrainerCollaborationStatus(event);
  const organizerStatus = resolveOrganizerCollaborationStatus(event);

  if (
    trainerStatus === "rejected" ||
    organizerStatus === "rejected"
  ) {
    return "Współpraca przy tym szkoleniu została odrzucona i wymaga poprawy po stronie zaproszonych osób.";
  }

  if (
    !isSelfManagedTrainingEvent(event) &&
    (trainerStatus === "pending" || organizerStatus === "pending")
  ) {
    return "To szkolenie czeka jeszcze na akceptację współpracy drugiej strony.";
  }

  return null;
}

function parseEventTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

type ScheduleDayDraft = {
  startTime: string;
  endTime: string;
};

function getDefaultScheduleDayDraft(index: number): ScheduleDayDraft {
  if (index === 0) {
    return {
      startTime: "15:00",
      endTime: "21:00",
    };
  }

  return {
    startTime: "09:00",
    endTime: "14:00",
  };
}

function resizeScheduleDayDrafts(
  nextDayCount: number,
  currentDrafts: ScheduleDayDraft[],
) {
  return Array.from({ length: Math.max(1, nextDayCount) }, (_, index) => ({
    ...(currentDrafts[index] ?? getDefaultScheduleDayDraft(index)),
  }));
}

function formatDateInputValue(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatTimeInputValue(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(11, 16);
}

function buildScheduleDaysFromDrafts(
  firstDayDate: string,
  drafts: ScheduleDayDraft[],
): TrainingEventScheduleDay[] {
  if (!firstDayDate) {
    return [];
  }

  return drafts.map((draft, index) => {
    const nextDate = new Date(`${firstDayDate}T00:00`);
    nextDate.setDate(nextDate.getDate() + index);
    const localDate = new Date(nextDate.getTime() - nextDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

    return {
      startsAt: new Date(`${localDate}T${draft.startTime}`).toISOString(),
      endsAt: new Date(`${localDate}T${draft.endTime}`).toISOString(),
    };
  });
}

function getScheduleDraftsFromEvent(event: TrainingEvent) {
  const scheduleDays = getTrainingEventScheduleDays(event);

  return {
    firstDayDate: formatDateInputValue(scheduleDays[0]?.startsAt ?? event.startsAt),
    scheduleDays: scheduleDays.map((day) => ({
      startTime: formatTimeInputValue(day.startsAt),
      endTime: formatTimeInputValue(day.endsAt),
    })),
  };
}

function getCommunityModerationStatusLabel(
  status: TrainingEvent["publicationApprovalStatus"],
) {
  if (status === "accepted") {
    return "Moderacja zaakceptowana";
  }

  if (status === "rejected") {
    return "Moderacja odrzucona";
  }

  return "Czeka na moderację";
}

function getCommunityPublicationVisibilityLabel(event: Pick<TrainingEvent, "isPublished">) {
  return event.isPublished ? "Opublikowane" : "Ukryte";
}

function getCommunityStatusRowItems(event: TrainingEvent) {
  return [
    {
      label: "Publikacja",
      value: getCommunityPublicationVisibilityLabel(event),
    },
    {
      label: "Moderacja",
      value: getCommunityModerationStatusLabel(event.publicationApprovalStatus),
    },
    {
      label: "Status",
      value: getEventLifecycleLabel(event),
    },
  ];
}

function getCommunityEventEditorValuesFromTrainingForm(
  form: TrainingEventFormState,
): CommunityEventEditorValues {
  return {
    status: form.status,
    capacity: form.capacity,
    minimumParticipants: form.minimumParticipants,
    confirmationLeadTimeDays: form.confirmationLeadTimeDays,
    title: form.title,
    location: form.location,
    eventImages: form.eventImages,
    useEventImageAsCover: form.useEventImageAsCover,
    tags: form.tags,
    summary: form.summary,
    description: form.description,
    firstDayDate: form.firstDayDate,
    scheduleDays: form.scheduleDays,
  };
}

function applyCommunityEventEditorValuesToTrainingForm(
  form: TrainingEventFormState,
  values: CommunityEventEditorValues,
): TrainingEventFormState {
  return {
    ...form,
    status: values.status,
    capacity: values.capacity,
    minimumParticipants: values.minimumParticipants,
    confirmationLeadTimeDays: values.confirmationLeadTimeDays,
    title: values.title,
    location: values.location,
    eventImages: values.eventImages,
    useEventImageAsCover: values.useEventImageAsCover,
    tags: values.tags,
    summary: values.summary,
    description: values.description,
    firstDayDate: values.firstDayDate,
    scheduleDays: values.scheduleDays,
  };
}

function getCommunityEventEditorValuesFromManagementDraft(
  draft: EventManagementSettingsDraft,
): CommunityEventEditorValues {
  return {
    status: draft.status,
    capacity: draft.capacity,
    minimumParticipants: draft.minimumParticipants,
    confirmationLeadTimeDays: draft.confirmationLeadTimeDays,
    title: draft.title,
    location: draft.location,
    eventImages: draft.eventImages,
    useEventImageAsCover: draft.useEventImageAsCover,
    tags: draft.tags,
    summary: draft.summary,
    description: draft.description,
    firstDayDate: draft.firstDayDate,
    scheduleDays: draft.scheduleDays,
  };
}

function applyCommunityEventEditorValuesToManagementDraft(
  draft: EventManagementSettingsDraft,
  values: CommunityEventEditorValues,
): EventManagementSettingsDraft {
  return {
    ...draft,
    status: values.status,
    capacity: values.capacity,
    minimumParticipants: values.minimumParticipants,
    confirmationLeadTimeDays: values.confirmationLeadTimeDays,
    title: values.title,
    location: values.location,
    eventImages: values.eventImages,
    useEventImageAsCover: values.useEventImageAsCover,
    tags: values.tags,
    summary: values.summary,
    description: values.description,
    firstDayDate: values.firstDayDate,
    scheduleDays: values.scheduleDays,
  };
}

function getPanelScheduleRangeLabel(event: TrainingEvent) {
  const bounds = getTrainingEventScheduleBounds(event);

  if (bounds.dayCount <= 1) {
    return formatDate(bounds.startsAt);
  }

  return `od ${formatDate(bounds.startsAt)} do ${formatDate(bounds.endsAt)}`;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDashboardMonthBuckets(now: Date) {
  const firstVisibleMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return Array.from({ length: 3 }, (_, index) => {
    const start = new Date(firstVisibleMonth.getFullYear(), firstVisibleMonth.getMonth() + index, 1);
    const end = new Date(
      firstVisibleMonth.getFullYear(),
      firstVisibleMonth.getMonth() + index + 1,
      0,
      23,
      59,
      59,
      999,
    );

    return {
      key: getMonthKey(start),
      label: formatMonthLabel(start),
      start,
      end,
    };
  });
}

function isDateWithinRange(date: string, startsAt: Date, endsAt: Date) {
  const timestamp = new Date(date).getTime();
  return timestamp >= startsAt.getTime() && timestamp <= endsAt.getTime();
}

function getDashboardEventLabel(
  event: TrainingEvent,
  currentUser: ReturnType<typeof useAppState>["currentUser"],
  store: ReturnType<typeof useAppState>["store"],
) {
  const title = getEventCardTitle(event, currentUser, store) || event.title;
  const bounds = getTrainingEventScheduleBounds(event);
  return `${title} • ${formatDate(bounds.startsAt)}`;
}

function getOrganizerOfficialDashboardEventLabel(
  event: TrainingEvent,
  store: ReturnType<typeof useAppState>["store"],
) {
  const group = event.groupId ? store.groups.find((item) => item.id === event.groupId) ?? null : null;
  const bounds = getTrainingEventScheduleBounds(event);
  const title = group?.name ?? event.groupName ?? event.title ?? event.location;
  return `${title} • ${formatDate(bounds.startsAt)}`;
}

function getDaysUntilLabel(startsAt: string, now: Date) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const eventDay = new Date(startsAt);
  eventDay.setHours(0, 0, 0, 0);

  const daysUntil = Math.max(0, Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  if (daysUntil === 0) {
    return "dzisiaj";
  }

  if (daysUntil === 1) {
    return "za 1 dzień";
  }

  if (daysUntil % 10 >= 2 && daysUntil % 10 <= 4 && (daysUntil % 100 < 12 || daysUntil % 100 > 14)) {
    return `za ${daysUntil} dni`;
  }

  return `za ${daysUntil} dni`;
}

function isOperationalEnrollmentRequest(
  request: EnrollmentRequest,
  store: ReturnType<typeof useAppState>["store"],
) {
  const event = store.trainingEvents.find((item) => item.id === request.eventId);
  if (!event?.groupId) {
    return true;
  }

  return !request.eventParticipantId;
}

function isEventFinished(event: TrainingEvent) {
  const bounds = getTrainingEventScheduleBounds(event);
  return new Date(bounds.endsAt).getTime() < Date.now();
}

function isCommunityModerationPending(event: TrainingEvent) {
  return event.publicationApprovalStatus === "pending";
}

function getParticipantGroupTransferOptions(
  record: ParticipantGroupEventRecord,
  store: ReturnType<typeof useAppState>["store"],
) {
  const groupId = record.event.groupId;
  const eligibleCurrentPriority = record.eventParticipant.priority;
  const sourceLinkedRequest = store.enrollmentRequests.find(
    (request) => request.eventParticipantId === record.eventParticipant.id,
  );

  if (
    !groupId ||
    record.event.rosterFinalizedAt ||
    new Date(record.event.startsAt).getTime() <= Date.now()
  ) {
    return [];
  }

  if (record.eventParticipant.source === "public-form" && !sourceLinkedRequest) {
    return [];
  }

  return sortEventsByDate(
    store.trainingEvents.filter((event) => {
      if (event.id === record.event.id || event.groupId !== groupId) {
        return false;
      }

        if (
          isTrainingEventArchived(event) ||
          isEventFinished(event) ||
          !event.isPublished ||
          !isTrainingEventCollaborationAccepted(event) ||
          Boolean(event.rosterFinalizedAt) ||
          new Date(event.startsAt).getTime() <= Date.now() ||
          getEventParticipantCount(event) >= event.capacity
        ) {
          return false;
        }

      const eligiblePriorities =
        event.eligibleGroupPriorities?.length && event.eligibleGroupPriorities.length > 0
          ? event.eligibleGroupPriorities
          : ["stali", "regularni", "rezerwowi"];
      if (!eligiblePriorities.includes(eligibleCurrentPriority)) {
        return false;
      }

      const hasExistingParticipant = (store.eventParticipants ?? []).some(
        (item) =>
          item.eventId === event.id &&
          item.participantProfileId === record.eventParticipant.participantProfileId,
      );

      if (hasExistingParticipant) {
        return false;
      }

      return !store.enrollmentRequests.some((request) => {
        if (request.id === sourceLinkedRequest?.id || request.eventId !== event.id) {
          return false;
        }

        return (
          request.participantProfileId === record.eventParticipant.participantProfileId ||
          request.telefon === sourceLinkedRequest?.telefon
        );
      });
    }),
  );
}

function ParticipantContactBlock({
  title,
  name,
  contact,
  fallback,
}: {
  title: string;
  name?: string | null;
  contact?: string | null;
  fallback: string;
}) {
  return (
    <div className="rounded-3xl border border-brand-line bg-brand-shell p-4">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
        {title}
      </p>
      <p className="mt-2 break-words text-lg font-semibold text-brand-navy">
        {name ?? fallback}
      </p>
      <p className="mt-1 text-sm text-brand-muted">
        {contact || "Dane kontaktowe pojawią się po przypisaniu."}
      </p>
    </div>
  );
}

function ParticipantGroupEventCard({
  record,
}: {
  record: ParticipantGroupEventRecord;
}) {
  const { manageOwnGroupEventParticipation, store } = useAppState();
  const [transferTargetEventId, setTransferTargetEventId] = useState("");
  const [submittingAction, setSubmittingAction] = useState<null | "cancel" | "transfer">(null);
  const transferOptions = useMemo(
    () => getParticipantGroupTransferOptions(record, store),
    [record, store],
  );
  const canCancelParticipation =
    !record.isArchived &&
    (record.eventParticipant.status === "invited" || record.eventParticipant.status === "confirmed");
  const canTransferParticipation = canCancelParticipation && transferOptions.length > 0;

  useEffect(() => {
    setTransferTargetEventId((current) =>
      current && transferOptions.some((event) => event.id === current)
        ? current
        : transferOptions[0]?.id || "",
    );
  }, [transferOptions]);

  return (
    <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
            {record.group?.name ?? record.event.groupName ?? "Grupa Emandar"}
          </p>
          <h3 className="mt-2 break-words text-2xl font-semibold text-brand-navy">
            {record.event.title}
          </h3>
          <p className="mt-2 text-brand-muted">{record.event.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
            {getEventParticipantStatusLabel(record.eventParticipant.status)}
          </span>
          <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
            {getGroupPriorityLabel(record.eventParticipant.priority)}
          </span>
          <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
            SMS:{" "}
            {resolveAttendanceConfirmationStatusLabel(
              record.eventParticipant.attendanceConfirmationStatus,
            )}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ParticipantContactBlock
          title="Przekazujący Wiedzę"
          name={record.trainer?.displayName}
          contact={null}
          fallback="Dane prowadzącego"
        />
        <ParticipantContactBlock
          title="Organizator"
          name={record.organizer?.displayName}
          contact={null}
          fallback="Wydarzenie bez dodatkowego organizatora"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted">
        <span>{getPanelScheduleRangeLabel(record.event)}</span>
        <span>{record.event.location}</span>
        <span>{getEventParticipantCountLabel(record.event)} miejsc</span>
        {getEventConfirmedCountLabel(record.event) ? (
          <span>{getEventConfirmedCountLabel(record.event)}</span>
        ) : null}
        {getEventCapacityOverflowLabel(record.event) ? (
          <span>{getEventCapacityOverflowLabel(record.event)}</span>
        ) : null}
      </div>

      {canCancelParticipation ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <button
            type="button"
            disabled={submittingAction !== null}
            onClick={async () => {
              if (!window.confirm("Zrezygnować z udziału w tym wydarzeniu grupowym?")) {
                return;
              }

              setSubmittingAction("cancel");
              try {
                await manageOwnGroupEventParticipation(record.eventParticipant.id, "cancel");
                toast.success("Zrezygnowano z udziału w wydarzeniu grupowym.");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Nie udało się zrezygnować z wydarzenia grupowego.",
                );
              } finally {
                setSubmittingAction(null);
              }
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60 sm:w-auto"
          >
            <X size={16} />
            {submittingAction === "cancel" ? "Rezygnowanie..." : "Zrezygnuj z udziału"}
          </button>

          {canTransferParticipation ? (
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                value={transferTargetEventId}
                onChange={(event) => setTransferTargetEventId(event.target.value)}
                className="min-w-0 w-full max-w-full rounded-full border border-brand-line bg-white px-4 py-3 text-sm text-brand-navy outline-none"
              >
                {transferOptions.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} • {getPanelScheduleRangeLabel(event)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={submittingAction !== null || !transferTargetEventId}
                onClick={async () => {
                  setSubmittingAction("transfer");
                  try {
                    await manageOwnGroupEventParticipation(
                      record.eventParticipant.id,
                      "transfer",
                      transferTargetEventId,
                    );
                    toast.success("Przeniesiono udział na inne wydarzenie grupy.");
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Nie udało się przenieść udziału.",
                    );
                  } finally {
                    setSubmittingAction(null);
                  }
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                <RefreshCcw size={16} />
                {submittingAction === "transfer"
                  ? "Przenoszenie..."
                  : "Przenieś na inne wydarzenie"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ParticipantPendingEnrollmentRequestCard({
  record,
}: {
  record: ParticipantPendingEnrollmentRequestRecord;
}) {
  return (
    <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
            {record.group?.name ?? record.event.groupName ?? "Grupa Emandar"}
          </p>
          <h3 className="mt-2 break-words text-2xl font-semibold text-brand-navy">
            {record.event.title}
          </h3>
          <p className="mt-2 text-brand-muted">{record.event.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
            {getEnrollmentFinalStatusLabel(record.displayStatus)}
          </span>
          <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
            Zgloszenie
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ParticipantContactBlock
          title="Przekazujący Wiedzę"
          name={record.trainer?.displayName ?? record.request.trainerContactName}
          contact={record.request.trainerContactPhone ?? record.request.trainerContactEmail ?? null}
          fallback="Dane prowadzącego pojawią się po akceptacji."
        />
        <ParticipantContactBlock
          title="Organizator"
          name={record.organizer?.displayName ?? record.request.organizerContactName}
          contact={record.request.organizerContactPhone ?? record.request.organizerContactEmail ?? null}
          fallback="Dane organizatora pojawią się po akceptacji."
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted">
        <span>{getPanelScheduleRangeLabel(record.event)}</span>
        <span>{record.event.location}</span>
        <span>{getEventParticipantCountLabel(record.event)} miejsc</span>
        {getEventConfirmedCountLabel(record.event) ? (
          <span>{getEventConfirmedCountLabel(record.event)}</span>
        ) : null}
        {getEventCapacityOverflowLabel(record.event) ? (
          <span>{getEventCapacityOverflowLabel(record.event)}</span>
        ) : null}
      </div>

      <p className="mt-5 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm text-brand-muted">
        To zgłoszenie czeka na decyzję organizatora albo prowadzącego.
      </p>
    </article>
  );
}

function ParticipantOnboardingCard() {
  const { completeParticipantOnboarding, currentUser, store } = useAppState();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: currentUser?.displayName ?? "",
    selectedTrainerIds: currentUser?.selectedTrainerIds ?? [],
    notes: "",
    avatarFile: null as File | null,
  });
  const trainers = useMemo(
    () =>
      sortTrainerProfiles(
        store.trainers.filter(
          (trainer) =>
            !isCommunityTrainerProfile(trainer.brandStatus) &&
            trainer.displayName.trim().length > 0,
        ),
      ),
    [store.trainers],
  );

  function toggleTrainer(trainerId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      selectedTrainerIds: checked
        ? Array.from(new Set([...current.selectedTrainerIds, trainerId]))
        : current.selectedTrainerIds.filter((item) => item !== trainerId),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await completeParticipantOnboarding({
        displayName: form.displayName,
        selectedTrainerIds: form.selectedTrainerIds,
        notes: form.notes,
        avatarFile: form.avatarFile,
      });
      toast.success("Profil uczestnika został uzupełniony.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zapisać onboardingu.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
      <SectionBlockHeading
        title="Uzupełnij profil"
        description="Po potwierdzeniu numeru masz już konto uczestnika. Tutaj uzupełniasz profil i zaznaczasz trenerów, do których już chodzisz na grupy."
      />
      <form onSubmit={handleSubmit} className="mt-5 grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-brand-navy">Imię i nazwisko</span>
          <input
            required
            value={form.displayName}
            onChange={(event) =>
              setForm((current) => ({ ...current, displayName: event.target.value }))
            }
            className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
        </label>

        <div className="grid gap-3 rounded-[2rem] border border-brand-line bg-brand-shell p-4 text-brand-navy">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked
              disabled
              className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
            />
            <span className="grid gap-1">
              <span className="text-sm font-semibold">Uczestnik</span>
              <span className="text-sm text-brand-muted">
                To konto działa jako uczestnik. Dostęp organizatora aktywujesz później z menu
                Organizator Emandar po wpisaniu kodu trenera.
              </span>
            </span>
          </div>
          <Link
            to="/panel/relacje"
            className="inline-flex items-center gap-2 self-start rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy"
          >
            <Users size={16} />
            Organizator Emandar
          </Link>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-brand-navy">
            Do kogo chodzisz na grupy?
          </span>
          <div className="grid gap-3 rounded-[2rem] border border-brand-line bg-brand-shell p-4">
            {trainers.map((trainer) => (
              <label key={trainer.id} className="flex items-start gap-3 text-brand-navy">
                <input
                  type="checkbox"
                  checked={form.selectedTrainerIds.includes(trainer.id)}
                  onChange={(event) => toggleTrainer(trainer.id, event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-semibold">{trainer.displayName}</span>
                  {trainer.heroNote.trim() ? (
                    <span className="text-sm text-brand-muted">{trainer.heroNote}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </label>

        <label className="grid gap-3 rounded-[2rem] border border-dashed border-brand-line bg-brand-shell px-4 py-4 text-brand-navy">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <ImagePlus size={16} />
            Zdjęcie profilowe
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                avatarFile: event.target.files?.[0] ?? null,
              }))
            }
            className="text-sm"
          />
          <span className="text-sm text-brand-muted">
            {form.avatarFile ? `Wybrany plik: ${form.avatarFile.name}` : "JPG, PNG albo WEBP do 5 MB"}
          </span>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-brand-navy">Kilka słów o sobie</span>
          <textarea
            rows={5}
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
        >
          {saving ? "Zapisywanie..." : "Zapisz profil"}
        </button>
      </form>
    </article>
  );
}

function getDashboardChartHeight(itemCount: number) {
  return Math.max(180, itemCount * 48);
}

function getCommunityEventEditPath(eventId: string) {
  return `/panel/wydarzenia-spolecznosci/${eventId}/edytuj`;
}

function getEnrollmentFinalStatusLabel(status: EnrollmentFinalStatus) {
  switch (status) {
    case "accepted":
      return "Przyjete";
    case "rejected":
      return "Odrzucone";
    case "partial":
      return "Czesciowe";
    default:
      return "Oczekujace";
  }
}

const MANAGEABLE_EVENT_PARTICIPANT_STATUSES = [
  "invited",
  "rezerwowy",
  "confirmed",
  "declined",
] as const satisfies EventParticipantStatus[];

const EVENT_PARTICIPANT_STATUS_ORDER: Record<EventParticipantStatus, number> = {
  confirmed: 0,
  invited: 1,
  rezerwowy: 2,
  declined: 3,
  removed: 4,
};

type GroupEventRosterSectionKey = GroupMemberPriority | "joining";
type ManagedOfficialTrainingRosterSectionKey = "assigned" | "reserve" | "inactive";

function getEventParticipantStatusLabel(status: EventParticipantStatus) {
  switch (status) {
    case "confirmed":
      return "Potwierdził";
    case "rezerwowy":
      return "Rezerwowy";
    case "declined":
      return "Odrzucił";
    case "removed":
      return "Usunięty";
    case "invited":
      return "Zaproszony";
    default:
      return status;
  }
}

function getEventParticipantCountLabel(
  event: Pick<TrainingEvent, "capacity" | "enrolledCount"> &
    Partial<Pick<TrainingEvent, "brandStatus" | "groupId" | "assignedCount">>,
) {
  return `${getEventParticipantCount(event)}/${event.capacity}`;
}

function getEventCapacityOverflowLabel(
  event: Pick<TrainingEvent, "capacity" | "enrolledCount"> &
    Partial<Pick<TrainingEvent, "brandStatus" | "groupId" | "assignedCount">>,
) {
  const overflowCount = getEventOverflowCount(event);
  return overflowCount > 0 ? `Nad limit: ${overflowCount}` : null;
}

function getEventConfirmedCountLabel(
  event: Pick<TrainingEvent, "enrolledCount"> &
    Partial<Pick<TrainingEvent, "brandStatus" | "groupId">>,
) {
  return isOfficialGroupTrainingEvent(event) ? `Potwierdzeni: ${event.enrolledCount}` : null;
}

function resolveEnrollmentAcceptanceTargetStatus(
  event: Pick<TrainingEvent, "brandStatus" | "groupId" | "capacity" | "enrolledCount"> &
    Partial<Pick<TrainingEvent, "assignedCount">>,
) {
  if (!isOfficialGroupTrainingEvent(event)) {
    return event.groupId ? "invited" : "confirmed";
  }

  return getEventParticipantCount(event) < event.capacity ? "invited" : "rezerwowy";
}

function getEnrollmentAcceptanceHint(
  event: Pick<TrainingEvent, "brandStatus" | "groupId" | "capacity" | "enrolledCount"> &
    Partial<Pick<TrainingEvent, "assignedCount">>,
) {
  if (!isOfficialGroupTrainingEvent(event)) {
    return null;
  }

  return resolveEnrollmentAcceptanceTargetStatus(event) === "rezerwowy"
    ? "Po potwierdzeniu osoba trafi na listę rezerwowych."
    : "Po potwierdzeniu osoba trafi na listę uczestników szkolenia.";
}

function getEventParticipantSourceLabel(source: EventParticipant["source"]) {
  switch (source) {
    case "auto-core":
      return "Rdzeń grupy";
    case "organizer":
      return "Dopisany ręcznie";
    default:
      return "Chcę wziąć udział";
  }
}

function getGroupEventRosterSectionLabel(section: GroupEventRosterSectionKey) {
  if (section === "joining") {
    return "Dołączający";
  }

  return getGroupPriorityLabel(section);
}

function getManagedOfficialTrainingRosterSectionLabel(
  section: ManagedOfficialTrainingRosterSectionKey,
) {
  switch (section) {
    case "assigned":
      return "Lista uczestników";
    case "reserve":
      return "Lista rezerwowych";
    default:
      return "Poza listą";
  }
}

function sortGroupEventParticipantsByStatusAndName(participants: EventParticipant[]) {
  return [...participants].sort((left, right) => {
    const statusOrder =
      EVENT_PARTICIPANT_STATUS_ORDER[left.status] - EVENT_PARTICIPANT_STATUS_ORDER[right.status];
    if (statusOrder !== 0) {
      return statusOrder;
    }

    return left.participantDisplayName.localeCompare(right.participantDisplayName, "pl");
  });
}

function buildGroupEventRosterSections(
  participants: EventParticipant[],
  activeGroupMembersByParticipantProfileId: Map<string, GroupMember>,
) {
  const buckets: Record<GroupEventRosterSectionKey, EventParticipant[]> = {
    stali: [],
    regularni: [],
    rezerwowi: [],
    joining: [],
  };

  participants.forEach((participant) => {
    if (participant.status === "removed") {
      return;
    }

    const activeGroupMember = activeGroupMembersByParticipantProfileId.get(
      participant.participantProfileId,
    );
    const sectionKey: GroupEventRosterSectionKey = activeGroupMember?.priority ?? "joining";
    buckets[sectionKey].push(participant);
  });

  return (["stali", "regularni", "rezerwowi", "joining"] as const)
    .map((sectionKey) => ({
      key: sectionKey,
      title: getGroupEventRosterSectionLabel(sectionKey),
      participants: sortGroupEventParticipantsByStatusAndName(buckets[sectionKey]),
    }))
    .filter((section) => section.participants.length > 0);
}

function buildManagedOfficialTrainingRosterSections(
  participants: EventParticipant[],
): ManagedEventParticipantSection[] {
  const buckets: Record<ManagedOfficialTrainingRosterSectionKey, EventParticipant[]> = {
    assigned: [],
    reserve: [],
    inactive: [],
  };

  participants.forEach((participant) => {
    if (participant.status === "removed" || participant.status === "declined") {
      buckets.inactive.push(participant);
      return;
    }

    if (participant.status === "rezerwowy") {
      buckets.reserve.push(participant);
      return;
    }

    buckets.assigned.push(participant);
  });

  return (["assigned", "reserve", "inactive"] as const)
    .map((sectionKey) => ({
      key: sectionKey,
      title: getManagedOfficialTrainingRosterSectionLabel(sectionKey),
      participants: sortGroupEventParticipantsByStatusAndName(buckets[sectionKey]),
    }))
    .filter((section) => section.participants.length > 0);
}

type AcceptedRequestGroupDialogDraft = {
  priority: GroupMemberPriority;
  notes: string;
  syncFutureEvents: boolean;
};

type AcceptedRequestGroupAssignmentTarget = {
  groupId: string;
  participantProfileId: string;
  participantName: string;
  futureOpenGroupEventsCount: number;
};

type AcceptedRequestGroupDialogSession = AcceptedRequestGroupAssignmentTarget & {
  draft: AcceptedRequestGroupDialogDraft;
};

export function createAcceptedRequestGroupDialogDraft(): AcceptedRequestGroupDialogDraft {
  return {
    priority: "regularni",
    notes: "",
    syncFutureEvents: false,
  };
}

function getFutureOpenGroupEvents(
  store: Pick<DemoStore, "trainingEvents">,
  groupId: string,
  currentEventId?: string,
) {
  return sortEventsByDate(
    store.trainingEvents.filter(
      (item) =>
        item.groupId === groupId &&
        item.id !== currentEventId &&
        !isTrainingEventArchived(item) &&
        !item.rosterFinalizedAt &&
        new Date(item.startsAt).getTime() > Date.now(),
    ),
  );
}

function hasActiveGroupMember(
  store: Pick<DemoStore, "groupMembers">,
  groupId: string,
  participantProfileId: string,
) {
  return (store.groupMembers ?? []).some(
    (item) =>
      item.groupId === groupId &&
      item.participantProfileId === participantProfileId &&
      item.membershipStatus === "active",
  );
}

function getAcceptedRequestGroupAssignmentTarget({
  request,
  event,
  store,
}: {
  request: Pick<EnrollmentRequest, "participantProfileId" | "imieNazwisko">;
  event: Pick<TrainingEvent, "id" | "groupId">;
  store: Pick<DemoStore, "groupMembers" | "trainingEvents">;
}) {
  if (!event.groupId || !request.participantProfileId) {
    return null;
  }

  if (hasActiveGroupMember(store, event.groupId, request.participantProfileId)) {
    return null;
  }

  const futureOpenGroupEvents = getFutureOpenGroupEvents(store, event.groupId, event.id);

  return {
    groupId: event.groupId,
    participantProfileId: request.participantProfileId,
    participantName: request.imieNazwisko,
    futureOpenGroupEventsCount: futureOpenGroupEvents.length,
  };
}

export function AcceptedRequestGroupDialogBody({
  draft,
  disabled = false,
  futureOpenGroupEventsCount,
  onCancel,
  onDraftChange,
  onSubmit,
}: {
  draft: AcceptedRequestGroupDialogDraft;
  disabled?: boolean;
  futureOpenGroupEventsCount: number;
  onCancel: () => void;
  onDraftChange: (
    updater: (previous: AcceptedRequestGroupDialogDraft) => AcceptedRequestGroupDialogDraft,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-brand-navy">Ranga w grupie</span>
        <select
          autoFocus
          value={draft.priority}
          onChange={(event) =>
            onDraftChange((previous) => ({
              ...previous,
              priority: event.target.value as GroupMemberPriority,
            }))
          }
          disabled={disabled}
          className="w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="stali">Stali</option>
          <option value="regularni">Regularni</option>
          <option value="rezerwowi">Rezerwowi</option>
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-brand-navy">Notatki</span>
        <textarea
          rows={3}
          value={draft.notes}
          onChange={(event) =>
            onDraftChange((previous) => ({
              ...previous,
              notes: event.target.value,
            }))
          }
          disabled={disabled}
          className="w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      {futureOpenGroupEventsCount > 0 ? (
        <label className="flex items-start gap-3 rounded-3xl border border-brand-line bg-brand-shell/60 p-4 text-sm text-brand-muted">
          <input
            type="checkbox"
            checked={draft.syncFutureEvents}
            onChange={(event) =>
              onDraftChange((previous) => ({
                ...previous,
                syncFutureEvents: event.target.checked,
              }))
            }
            disabled={disabled}
            className="mt-1"
          />
          <span>
            {futureOpenGroupEventsCount === 1
              ? "Dodaj też automatycznie do 1 przyszłego otwartego szkolenia tej grupy."
              : `Dodaj też automatycznie do ${futureOpenGroupEventsCount} przyszłych otwartych szkoleń tej grupy.`}
          </span>
        </label>
      ) : null}

      <DialogFooter className="mt-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-full border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {disabled ? "Dodawanie..." : "Dodaj do grupy"}
        </button>
      </DialogFooter>
    </form>
  );
}

function CommunityEventMutationForm({
  disabled = false,
  submitLabel,
  submitting,
  uploadingImages,
  helperMessage,
  values,
  onChange,
  onSubmit,
  onUploadImages,
}: {
  disabled?: boolean;
  submitLabel: string;
  submitting: boolean;
  uploadingImages: boolean;
  helperMessage?: string | null;
  values: CommunityEventEditorValues;
  onChange: (updater: (previous: CommunityEventEditorValues) => CommunityEventEditorValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUploadImages: (files: File[]) => Promise<void>;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
    >
      <CommunityEventEditorFields
        values={values}
        uploadingImages={uploadingImages}
        disabled={disabled || submitting}
        onChange={onChange}
        onUploadImages={onUploadImages}
      />

      {helperMessage ? (
        <div className="mt-4 rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-sm text-brand-muted">
          {helperMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={disabled || submitting}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
      >
        {submitting ? "Zapisywanie..." : submitLabel}
      </button>
    </form>
  );
}

function useAcceptedRequestGroupDialog({
  addGroupMember,
}: {
  addGroupMember: (input: {
    groupId: string;
    participantProfileId: string;
    priority: GroupMemberPriority;
    notes?: string;
    syncFutureEvents?: boolean;
  }) => Promise<void>;
}) {
  const [session, setSession] = useState<AcceptedRequestGroupDialogSession | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  function closeDialog(result: boolean) {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setSubmitting(false);
    setSession(null);
  }

  function updateDraft(
    updater: (previous: AcceptedRequestGroupDialogDraft) => AcceptedRequestGroupDialogDraft,
  ) {
    setSession((previous) =>
      previous
        ? {
            ...previous,
            draft: updater(previous.draft),
          }
        : previous,
    );
  }

  function openDialog(target: AcceptedRequestGroupAssignmentTarget) {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setSubmitting(false);
    setSession({
      ...target,
      draft: createAcceptedRequestGroupDialogDraft(),
    });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    setSubmitting(true);

    try {
      await addGroupMember({
        groupId: session.groupId,
        participantProfileId: session.participantProfileId,
        priority: session.draft.priority,
        notes: session.draft.notes,
        syncFutureEvents:
          session.futureOpenGroupEventsCount > 0 ? session.draft.syncFutureEvents : false,
      });
      closeDialog(true);
    } catch (error) {
      setSubmitting(false);
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać osoby do grupy.");
    }
  }

  const dialog = session ? (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) {
          closeDialog(false);
        }
      }}
    >
      <DialogContent className="max-w-md rounded-[2rem] border border-brand-line bg-white p-0">
        <div className="p-6 sm:p-7">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-semibold text-brand-navy">
              Dopisz do grupy
            </DialogTitle>
            <DialogDescription className="text-sm text-brand-muted">
              {`${
                session.participantName || "Ta osoba"
              } trafiła już na roster wydarzenia. Wybierz rangę, uzupełnij notatkę i zdecyduj, czy dopisać ją też do grupy.`}
            </DialogDescription>
          </DialogHeader>

          <AcceptedRequestGroupDialogBody
            draft={session.draft}
            disabled={submitting}
            futureOpenGroupEventsCount={session.futureOpenGroupEventsCount}
            onCancel={() => closeDialog(false)}
            onDraftChange={updateDraft}
            onSubmit={handleSubmit}
          />
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  return {
    dialog,
    openDialog,
  };
}

type EnrollmentRequestDisplayStatus = EnrollmentRequest["finalStatus"] | "partial";

type EnrollmentRequestArchiveSectionKey = "active" | "confirmed" | "rejected";

type ParticipantOfficialEnrollmentSectionKey = "pending" | "reserve" | "participating";

type EnrollmentRequestArchiveSection = {
  key: EnrollmentRequestArchiveSectionKey;
  title: string;
  requests: EnrollmentRequest[];
  defaultOpen: boolean;
};

type ParticipantOfficialEnrollmentSection = {
  key: ParticipantOfficialEnrollmentSectionKey;
  title: string;
  records: ParticipantEnrollmentViewRecord[];
};

type EnrollmentRequestListItemPosition = "single" | "first" | "middle" | "last";

type ManagedEventParticipantSection = {
  key: string;
  title: string;
  participants: EventParticipant[];
};

export type EnrollmentRequestTransferOption = {
  id: string;
  label: string;
};

const ENROLLMENT_REQUEST_ARCHIVE_SORT_ORDER: Record<EnrollmentRequestDisplayStatus, number> = {
  pending: 0,
  partial: 1,
  accepted: 2,
  rejected: 3,
};

function resolveEnrollmentRequestDisplayStatus(
  request: Pick<EnrollmentRequest, "finalStatus">,
): EnrollmentRequestDisplayStatus {
  return request.finalStatus as EnrollmentRequestDisplayStatus;
}

export function buildParticipantOfficialEnrollmentSections(
  records: ParticipantEnrollmentViewRecord[],
): ParticipantOfficialEnrollmentSection[] {
  const buckets: Record<ParticipantOfficialEnrollmentSectionKey, ParticipantEnrollmentViewRecord[]> = {
    pending: [],
    reserve: [],
    participating: [],
  };

  records.forEach((record) => {
    if (record.isArchived) {
      return;
    }

    if (record.kind === "request" && record.displayStatus === "pending") {
      buckets.pending.push(record);
      return;
    }

    if (record.kind === "roster" && record.eventParticipant.status === "rezerwowy") {
      buckets.reserve.push(record);
      return;
    }

    if (
      record.kind === "roster" &&
      (record.eventParticipant.status === "invited" || record.eventParticipant.status === "confirmed")
    ) {
      buckets.participating.push(record);
    }
  });

  return [
    {
      key: "pending" as const,
      title: "Oczekujące",
      records: buckets.pending,
    },
    {
      key: "reserve" as const,
      title: "Lista rezerwowych",
      records: buckets.reserve,
    },
    {
      key: "participating" as const,
      title: "Uczestniczę",
      records: buckets.participating,
    },
  ].filter((section) => section.records.length > 0);
}

function isEnrollmentRequestTransferredByStaff(
  request: Pick<EnrollmentRequest, "participantStatus" | "participantActionSource">,
) {
  return request.participantStatus === "cancelled" && request.participantActionSource === "staff";
}

export function splitEnrollmentRequestsByIntent(requests: EnrollmentRequest[]) {
  const participatingRequests = [...requests]
    .filter(
      (request) =>
        resolveEnrollmentIntent(request.intent) === "participating" &&
        !isEnrollmentRequestTransferredByStaff(request),
    )
    .sort((left, right) => {
      const leftStatus = resolveEnrollmentRequestDisplayStatus(left);
      const rightStatus = resolveEnrollmentRequestDisplayStatus(right);
      const statusDelta =
        ENROLLMENT_REQUEST_ARCHIVE_SORT_ORDER[leftStatus] -
        ENROLLMENT_REQUEST_ARCHIVE_SORT_ORDER[rightStatus];

      if (statusDelta !== 0) {
        return statusDelta;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

  const activeRequests = participatingRequests.filter((request) => {
    const status = resolveEnrollmentRequestDisplayStatus(request);
    return status !== "accepted" && status !== "rejected";
  });
  const confirmedRequests = participatingRequests.filter(
    (request) => resolveEnrollmentRequestDisplayStatus(request) === "accepted",
  );
  const rejectedRequests = participatingRequests.filter(
    (request) => resolveEnrollmentRequestDisplayStatus(request) === "rejected",
  );

  return [
    {
      key: "active",
      title: "Oczekujące",
      requests: activeRequests,
      defaultOpen: true,
    },
    {
      key: "confirmed",
      title: "Potwierdzone",
      requests: confirmedRequests,
      defaultOpen: false,
    },
    {
      key: "rejected",
      title: "Odrzucone",
      requests: rejectedRequests,
      defaultOpen: false,
    },
  ].filter((section): section is EnrollmentRequestArchiveSection => section.requests.length > 0);
}

function isCommunityTrainerProfile(status: EmandarBrandStatus | undefined) {
  return isCommunityBrandStatus(status);
}

function isCommunityPanelEvent(
  event: Pick<TrainingEvent, "brandStatus">,
) {
  return isCommunityBrandStatus(event.brandStatus);
}

function getPanelEventListPath(
  event: Pick<TrainingEvent, "brandStatus">,
) {
  return isCommunityPanelEvent(event)
    ? "/panel/wydarzenia-spolecznosci"
    : "/panel/szkolenia";
}

function getPanelEventDetailPath(
  event: Pick<TrainingEvent, "id" | "brandStatus">,
) {
  return `${getPanelEventListPath(event)}/${event.id}`;
}

function AdminBrandStatusSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: EmandarBrandStatus | undefined;
  onChange: (nextValue: EmandarBrandStatus) => Promise<void>;
  disabled?: boolean;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-brand-navy">Status Emandar</span>
      <select
        value={resolveBrandStatus(value)}
        disabled={saving || disabled}
        onChange={async (event) => {
          const nextValue = event.target.value as EmandarBrandStatus;
          setSaving(true);

          try {
            await onChange(nextValue);
            toast.success("Status Emandar został zapisany.");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Nie udało się zapisać statusu Emandar.",
            );
          } finally {
            setSaving(false);
          }
        }}
        className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-sm font-semibold text-brand-navy outline-none disabled:opacity-60"
      >
        <option value="official">Oficjalny Emandar</option>
        <option value="supported">Wspierane przez Emandar</option>
      </select>
    </label>
  );
}

const photoModeOptions: Array<{ value: PhotoMode; label: string }> = [
  { value: "required", label: "WYMAGANE" },
  { value: "optional", label: "OPCJONALNE" },
  { value: "disabled", label: "WYŁĄCZONE" },
];

function PhotoModeSegmentedControl({
  value,
  onChange,
  disabled = false,
}: {
  value: PhotoMode;
  onChange: (nextValue: PhotoMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2 rounded-[1.75rem] border border-brand-line bg-white p-1.5 shadow-soft sm:inline-flex sm:w-auto sm:flex-wrap sm:items-center">
      {photoModeOptions.map((option, index) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`inline-flex min-w-0 items-center justify-center rounded-full px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap transition sm:px-4 sm:py-2 sm:text-sm sm:tracking-[0.16em] ${
            index === photoModeOptions.length - 1 ? "col-span-2 sm:col-span-1" : ""
          } ${
            value === option.value
              ? "bg-brand-navy text-white shadow-soft"
              : "bg-brand-shell/35 text-brand-muted hover:bg-brand-shell hover:text-brand-navy"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CollaborationActionBar({
  onDecision,
  pending,
  acceptLabel = "Akceptuj wspolprace",
  rejectLabel = "Odrzuc wspolprace",
}: {
  onDecision: (status: "accepted" | "rejected") => Promise<void>;
  pending: boolean;
  acceptLabel?: string;
  rejectLabel?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => void onDecision("accepted")}
        className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        <Check size={16} />
        {acceptLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => void onDecision("rejected")}
        className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
      >
        <X size={16} />
        {rejectLabel}
      </button>
    </div>
  );
}

function PanelSection({
  eyebrow: _eyebrow,
  title,
  description,
  action,
  showLeadText = true,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  showLeadText?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-2.5 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-medium leading-snug text-brand-navy sm:text-2xl">
            {title}
          </h2>
          {showLeadText && description ? (
            <p className="mt-2 max-w-3xl break-words text-sm text-brand-muted sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  detail,
  valueClassName = "",
  className = "",
  labelClassName = "",
  layout = "default",
  detailClassName = "",
  detailPlacement = "inline",
  iconWrapperClassName = "",
}: {
  label: string;
  value: string | number;
  icon: typeof Bell;
  detail?: string;
  valueClassName?: string;
  className?: string;
  labelClassName?: string;
  layout?: "default" | "stacked";
  detailClassName?: string;
  detailPlacement?: "inline" | "below";
  iconWrapperClassName?: string;
}) {
  if (layout === "stacked") {
    return (
      <article
        className={cn(
          "flex min-h-0 flex-col items-start justify-start gap-2.5 rounded-[1.125rem] border border-brand-line bg-white px-4 py-3 shadow-soft sm:gap-3 sm:rounded-[1.5rem] sm:px-5 sm:py-4",
          className,
        )}
      >
        <p
          className={cn(
            "text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-brand-muted sm:text-sm sm:tracking-[0.2em]",
            labelClassName,
          )}
        >
          {label}
        </p>
        <div className="flex w-full items-center gap-2.5 sm:gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] bg-brand-sky/15 text-brand-navy sm:h-10 sm:w-10 sm:rounded-2xl",
              iconWrapperClassName,
            )}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "text-2xl font-semibold leading-none text-brand-navy sm:text-3xl",
                valueClassName,
              )}
            >
              {value}
            </p>
            {detail && detailPlacement === "inline" ? (
              <p className={cn("mt-2 break-words text-sm leading-snug text-brand-muted", detailClassName)}>
                {detail}
              </p>
            ) : null}
          </div>
        </div>
        {detail && detailPlacement === "below" ? (
          <p className={cn("break-words text-sm leading-snug text-brand-muted", detailClassName)}>
            {detail}
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <article
      className={cn(
        "flex min-h-[96px] items-center gap-3 rounded-[1.5rem] border border-brand-line bg-white p-3.5 shadow-soft sm:min-h-[108px] sm:rounded-[2rem] sm:p-5",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-sky/15 text-brand-navy sm:h-11 sm:w-11",
          iconWrapperClassName,
        )}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "break-words text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted sm:text-sm sm:tracking-[0.2em]",
            labelClassName,
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-3xl font-semibold leading-none text-brand-navy sm:mt-2 sm:text-4xl",
            valueClassName,
          )}
        >
          {value}
        </p>
        {detail ? (
          <p className="mt-2 break-words text-sm leading-snug text-brand-muted">{detail}</p>
        ) : null}
      </div>
    </article>
  );
}

function EmptyPanelState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[2rem] border border-dashed border-brand-line bg-white p-8 text-center shadow-soft">
      <h3 className="text-2xl font-semibold text-brand-navy">{title}</h3>
      <p className="mt-3 text-brand-muted">{description}</p>
    </article>
  );
}

function SectionBlockHeading({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  if (!title && !description) {
    return null;
  }

  return (
    <div>
      {title ? (
        <h3 className="break-words text-xl font-semibold leading-tight text-brand-navy sm:text-2xl">{title}</h3>
      ) : null}
      {description ? <p className="mt-2 text-sm text-brand-muted">{description}</p> : null}
    </div>
  );
}

function EnrollmentRequestArchiveSectionBlock({
  title,
  count,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-2 px-1">
        <span className="rounded-full bg-brand-navy/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-navy sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.2em]">
          {title}
        </span>
        <div className="h-px flex-1 bg-brand-line/80" />
        <span className="text-[11px] text-brand-muted sm:text-xs">{count}</span>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full border border-brand-line bg-white text-brand-navy shadow-soft sm:size-9"
            aria-label={open ? `Zwiń sekcję ${title}` : `Rozwiń sekcję ${title}`}
          >
            <ChevronDown
              size={14}
              className={cn("transition-transform duration-200", open ? "rotate-180" : "")}
            />
          </button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="pt-3 sm:pt-4">
        <div className="space-y-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function getEnrollmentRequestContextLabels(
  event: Pick<TrainingEvent, "groupName" | "location" | "title">,
  group?: Pick<Group, "name"> | null,
) {
  const groupLabel =
    group?.name?.trim() || event.groupName?.trim() || event.title?.trim() || "Termin Emandar";
  const locationLabel = event.location?.trim() || "Brak lokalizacji";

  return {
    groupLabel,
    locationLabel,
  };
}

function getEnrollmentRequestListItemPosition(
  index: number,
  total: number,
): EnrollmentRequestListItemPosition {
  if (total <= 1) {
    return "single";
  }

  if (index === 0) {
    return "first";
  }

  if (index === total - 1) {
    return "last";
  }

  return "middle";
}

function EnrollmentRequestListSurface({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-brand-line bg-white shadow-soft divide-y divide-brand-line/80">
      {children}
    </div>
  );
}

function EnrollmentRequestMetaRow({
  request,
}: {
  request: Pick<EnrollmentRequest, "telefon" | "polecenieOdKogo">;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-brand-muted">
      <span className="inline-flex items-center gap-1.5 sm:gap-2">
        <Phone size={12} className="sm:size-[14px]" />
        {request.telefon}
      </span>
      <span>{request.polecenieOdKogo || "Bez polecenia"}</span>
    </div>
  );
}

function hasEnrollmentRequestMessage(
  request: Pick<EnrollmentRequest, "wiadomosc">,
) {
  return request.wiadomosc.trim().length > 0;
}

function EnrollmentRequestMessageBlock({
  request,
}: {
  request: Pick<EnrollmentRequest, "wiadomosc">;
}) {
  if (!hasEnrollmentRequestMessage(request)) {
    return null;
  }

  return (
    <div className="rounded-3xl bg-brand-shell px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted sm:text-[11px]">
        Wiadomość
      </p>
      <p className="mt-2 text-sm leading-relaxed text-brand-muted">{request.wiadomosc.trim()}</p>
    </div>
  );
}

function getEnrollmentRequestDecisionOptions(
  finalStatus: EnrollmentRequestDisplayStatus,
) {
  if (finalStatus === "accepted") {
    return ["rejected"] as const;
  }

  if (finalStatus === "rejected") {
    return ["accepted"] as const;
  }

  return ["rejected", "accepted"] as const;
}

export function EnrollmentRequestDecisionButtons({
  finalStatus,
  acceptHint = null,
  disabled = false,
  onDecision,
}: {
  finalStatus: EnrollmentRequestDisplayStatus;
  acceptHint?: string | null;
  disabled?: boolean;
  onDecision: (decision: Extract<DecisionStatus, "accepted" | "rejected">) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {getEnrollmentRequestDecisionOptions(finalStatus).map((decision) => (
          <button
            key={decision}
            type="button"
            disabled={disabled}
            onClick={() => onDecision(decision)}
            className={
              decision === "accepted"
                ? "inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:flex-none"
                : "inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60 sm:flex-none"
            }
          >
            {decision === "accepted" ? "Potwierdź" : "Odrzuć"}
          </button>
        ))}
      </div>
      {finalStatus === "pending" && acceptHint ? (
        <p className="text-sm text-brand-muted">{acceptHint}</p>
      ) : null}
    </div>
  );
}

export function EnrollmentRequestSlimRow({
  request,
  event,
  eventGroup,
  isExpanded,
  onExpandedChange,
  isSaving = false,
  itemPosition = "single",
  children,
}: {
  request: EnrollmentRequest;
  event: Pick<TrainingEvent, "id" | "brandStatus" | "groupName" | "location" | "title">;
  eventGroup?: Pick<Group, "name"> | null;
  isExpanded: boolean;
  onExpandedChange: (open: boolean) => void;
  isSaving?: boolean;
  itemPosition?: EnrollmentRequestListItemPosition;
  children: ReactNode;
}) {
  const { groupLabel, locationLabel } = getEnrollmentRequestContextLabels(event, eventGroup);
  const eventDetailPath = getPanelEventDetailPath(event);
  const itemShapeClassName =
    itemPosition === "single"
      ? "rounded-[1.75rem]"
      : itemPosition === "first"
        ? "rounded-t-[1.75rem]"
        : itemPosition === "last"
          ? "rounded-b-[1.75rem]"
          : "";

  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandedChange}>
      <article
        className={cn(
          "overflow-hidden bg-white px-6 py-3 sm:px-6 sm:py-4",
          itemShapeClassName,
        )}
      >
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 sm:items-center">
          <div className="min-w-0">
            <Link
              to={eventDetailPath}
              className="inline-flex max-w-full truncate text-xs font-semibold uppercase tracking-[0.18em] text-brand-sky-deep underline-offset-4 transition hover:text-brand-navy hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky-deep/40 sm:text-[13px] sm:tracking-[0.22em]"
            >
              {groupLabel}
            </Link>
            <p className="mt-1 min-w-0 text-sm text-brand-muted">{locationLabel}</p>
          </div>

          <div className="flex shrink-0 items-start gap-2 sm:items-center">
            <div className="flex flex-col items-end gap-1.5 pt-0.5">
              <span className="rounded-full bg-brand-navy px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white sm:px-3 sm:text-xs">
                {getEnrollmentFinalStatusLabel(request.finalStatus)}
              </span>
              <div className="flex min-h-4 items-center gap-1 text-[11px] text-brand-muted sm:text-xs">
                {isSaving ? (
                  <span
                    title="Zapisywanie zgłoszenia"
                    aria-label="Zapisywanie zgłoszenia"
                    className="inline-flex size-4 items-center justify-center text-brand-navy sm:size-5"
                  >
                    <RefreshCcw size={10} className="animate-spin sm:size-3.5" />
                  </span>
                ) : null}
                <span>{formatDate(request.createdAt)}</span>
              </div>
            </div>

            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-none border-l border-brand-line bg-transparent text-brand-navy sm:size-12 sm:rounded-full sm:border sm:bg-white sm:shadow-soft"
                aria-label={
                  isExpanded
                    ? `Ukryj szczegóły ${request.imieNazwisko}`
                    : `Pokaż szczegóły ${request.imieNazwisko}`
                }
              >
                <ChevronDown
                  size={16}
                  className={cn(
                    "transition-transform duration-200",
                    isExpanded ? "rotate-180" : "",
                    "sm:size-[18px]",
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </div>

          <p className="col-span-2 min-w-0 text-[17px] font-semibold leading-tight text-brand-navy sm:text-lg">
            {request.imieNazwisko}
          </p>
        </div>

        <CollapsibleContent className="mt-3 border-t border-brand-line/60 pt-3 sm:mt-4 sm:border-t sm:border-brand-line/70 sm:pt-4">
          {children}
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}

export function buildManagedEventParticipantSections(
  event: Pick<TrainingEvent, "brandStatus" | "groupId">,
  participants: EventParticipant[],
  activeGroupMembersByParticipantProfileId: Map<string, GroupMember>,
): ManagedEventParticipantSection[] {
  if (isOfficialGroupTrainingEvent(event)) {
    return buildManagedOfficialTrainingRosterSections(participants);
  }

  if (event.groupId) {
    return buildGroupEventRosterSections(participants, activeGroupMembersByParticipantProfileId);
  }

  const visibleParticipants = participants.filter((participant) => participant.status !== "removed");
  if (visibleParticipants.length === 0) {
    return [];
  }

  return [
    {
      key: "participants",
      title: "Uczestnicy",
      participants: sortGroupEventParticipantsByStatusAndName(visibleParticipants),
    },
  ];
}

export function buildCommunityParticipantSections(
  participants: EventParticipant[],
): ManagedEventParticipantSection[] {
  const visibleParticipants = participants.filter(
    (participant) => participant.status === "invited" || participant.status === "confirmed",
  );

  if (visibleParticipants.length === 0) {
    return [];
  }

  return [
    {
      key: "participants",
      title: "Uczestnicy",
      participants: sortGroupEventParticipantsByStatusAndName(visibleParticipants),
    },
  ];
}

export function buildCommunityReserveSections(
  participants: EventParticipant[],
): ManagedEventParticipantSection[] {
  const reserveParticipants = participants.filter(
    (participant) => participant.status === "rezerwowy",
  );

  if (reserveParticipants.length === 0) {
    return [];
  }

  return [
    {
      key: "reserve",
      title: "Rezerwowi",
      participants: sortGroupEventParticipantsByStatusAndName(reserveParticipants),
    },
  ];
}

export function buildEnrollmentRequestTransferOptions({
  currentUser,
  event,
  store,
}: {
  currentUser: AppUser;
  event: TrainingEvent;
  store: DemoStore;
}): EnrollmentRequestTransferOption[] {
  const isCommunityEvent = isCommunityPanelEvent(event);

  return sortEventsByDate(
    store.trainingEvents.filter((item) => {
      if (item.id === event.id || !canManageTrainingEvent(item, currentUser)) {
        return false;
      }

      if (
        isTrainingEventArchived(item) ||
        isEventFinished(item) ||
        !item.isPublished ||
        item.status === "cancelled" ||
        new Date(item.startsAt).getTime() <= Date.now() ||
        getAvailablePlaces(item) <= 0
      ) {
        return false;
      }

      if (isCommunityEvent) {
        if (!isCommunityPanelEvent(item)) {
          return false;
        }

        const hasMatchingOrganizer =
          Boolean(event.organizerId) && item.organizerId === event.organizerId;
        const hasMatchingOrganizerUser =
          Boolean(event.organizerUserId) && item.organizerUserId === event.organizerUserId;
        const hasMatchingCreator =
          !event.organizerId && !event.organizerUserId && item.creatorUserId === event.creatorUserId;

        return hasMatchingOrganizer || hasMatchingOrganizerUser || hasMatchingCreator;
      }

      return !isCommunityPanelEvent(item);
    }),
  ).map((item) => {
    if (isCommunityEvent) {
      return {
        id: item.id,
        label: `${item.title || "Wydarzenie społeczności"} | ${formatDate(item.startsAt)} | ${item.location}`,
      };
    }

    const itemGroup =
      store.groups?.find((group) => group.id === item.groupId)?.name?.trim() ||
      item.groupName?.trim() ||
      item.title?.trim() ||
      "Termin Emandar";

    return {
      id: item.id,
      label: `${itemGroup} | ${formatDate(item.startsAt)} | ${item.location}`,
    };
  });
}

function EnrollmentRequestTransferPanel({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: EnrollmentRequestTransferOption[];
  value: string;
  onChange: (nextValue: string) => void;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-brand-line bg-brand-shell p-4">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
        {title}
      </p>
      <select
        value={value}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
        className="mt-3 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
      >
        <option value="">Wybierz termin</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EnrollmentRequestManagementActions({
  finalStatus,
  acceptHint = null,
  disabled = false,
  transferPending = false,
  transferTargetEventId = "",
  onDecision,
  onTransfer,
}: {
  finalStatus: EnrollmentRequestDisplayStatus;
  acceptHint?: string | null;
  disabled?: boolean;
  transferPending?: boolean;
  transferTargetEventId?: string;
  onDecision: (decision: Extract<DecisionStatus, "accepted" | "rejected">) => void;
  onTransfer: () => void;
}) {
  const canReject = finalStatus !== "rejected";
  const canAccept = finalStatus !== "accepted";
  const shouldTransfer = transferTargetEventId.trim().length > 0;
  const isDisabled = disabled || transferPending;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {canReject ? (
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => onDecision("rejected")}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60 sm:flex-none"
          >
            Odrzuć
          </button>
        ) : null}

        {shouldTransfer || canAccept ? (
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => {
              if (shouldTransfer) {
                onTransfer();
                return;
              }

              onDecision("accepted");
            }}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:flex-none"
          >
            {shouldTransfer ? (transferPending ? "Przenoszenie..." : "Przenieś") : "Potwierdź"}
          </button>
        ) : null}
      </div>
      {!shouldTransfer && canAccept && acceptHint ? (
        <p className="text-sm text-brand-muted">{acceptHint}</p>
      ) : null}
    </div>
  );
}

function ManagedEventParticipantRow({
  canManageParticipant,
  eventIsArchived,
  isExpanded,
  isSaving,
  onExpandedChange,
  onStatusChange,
  participant,
  participantProfile,
  rowIndex,
}: {
  canManageParticipant: boolean;
  eventIsArchived: boolean;
  isExpanded: boolean;
  isSaving: boolean;
  onExpandedChange: (open: boolean) => void;
  onStatusChange: (status: EventParticipantStatus) => Promise<void>;
  participant: EventParticipant;
  participantProfile?: ParticipantProfile | null;
  rowIndex: number;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandedChange}>
      <article
        className={cn(
          "border-b border-brand-line/70 px-6 py-2.5 last:border-b-0",
          rowIndex % 2 === 0 ? "bg-white" : "bg-brand-shell/35",
          "sm:rounded-3xl sm:border sm:bg-brand-shell/60 sm:p-4",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-brand-navy sm:text-lg">
              {participant.participantDisplayName}
            </p>
          </div>

          {canManageParticipant && !eventIsArchived ? (
            <select
              value={participant.status}
              disabled={isSaving}
              onChange={(changeEvent) =>
                void onStatusChange(changeEvent.target.value as EventParticipantStatus)
              }
              className="h-9 w-auto max-w-full shrink-0 appearance-none rounded-xl border border-brand-line bg-white pl-3 pr-8 text-xs font-semibold text-brand-navy outline-none disabled:opacity-60 sm:h-12 sm:rounded-2xl sm:pl-4 sm:pr-10 sm:text-sm"
            >
              {MANAGEABLE_EVENT_PARTICIPANT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getEventParticipantStatusLabel(status)}
                </option>
              ))}
            </select>
          ) : (
            <span className="rounded-full border border-brand-line px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-navy sm:text-xs">
              {getEventParticipantStatusLabel(participant.status)}
            </span>
          )}

          {isSaving ? (
            <span
              title="Zapisywanie statusu"
              aria-label="Zapisywanie statusu"
              className="inline-flex size-6 shrink-0 items-center justify-center text-brand-navy sm:size-8"
            >
              <RefreshCcw size={12} className="animate-spin sm:size-[14px]" />
            </span>
          ) : null}

          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-none border-l border-brand-line bg-transparent text-brand-navy sm:size-12 sm:rounded-full sm:border sm:bg-white sm:shadow-soft"
              aria-label={
                isExpanded
                  ? `Ukryj szczegóły ${participant.participantDisplayName}`
                  : `Pokaż szczegóły ${participant.participantDisplayName}`
              }
            >
              <ChevronDown
                size={16}
                className={cn(
                  "transition-transform duration-200",
                  isExpanded ? "rotate-180" : "",
                  "sm:size-[18px]",
                )}
              />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-2 border-t border-brand-line/60 pt-2.5 sm:mt-4 sm:border-t sm:border-brand-line/70 sm:pt-4">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-brand-muted sm:gap-3 sm:text-sm">
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <Phone size={12} className="sm:size-[14px]" />
                {participant.participantPhone}
              </span>
              {participantProfile ? (
                <span className="rounded-full border border-brand-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-navy sm:px-3 sm:py-1 sm:text-xs sm:tracking-[0.18em]">
                  {getParticipantConfirmationLabel(participantProfile)}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-brand-line bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-navy sm:text-xs">
                SMS: {resolveAttendanceConfirmationStatusLabel(participant.attendanceConfirmationStatus)}
              </span>
              <span className="rounded-full border border-brand-line bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-navy sm:text-xs">
                {getEventParticipantSourceLabel(participant.source)}
              </span>
              {participant.overCapacity ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900 sm:text-xs">
                  ponad limit
                </span>
              ) : null}
            </div>
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}

function ManagedEventParticipantSections({
  canManageParticipant,
  eventIsArchived,
  expandedParticipantIds,
  onExpandedChange,
  onStatusChange,
  participantProfilesById,
  sections,
  updatingParticipantId,
}: {
  canManageParticipant: boolean;
  eventIsArchived: boolean;
  expandedParticipantIds: string[];
  onExpandedChange: (participantId: string, open: boolean) => void;
  onStatusChange: (participantId: string, status: EventParticipantStatus) => Promise<void>;
  participantProfilesById: Map<string, ParticipantProfile>;
  sections: ManagedEventParticipantSection[];
  updatingParticipantId: string | null;
}) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="-mx-6 mt-4 space-y-5 sm:mx-0 sm:mt-6 sm:space-y-6">
      {sections.map((section) => (
        <section key={section.key} className="space-y-1.5 sm:space-y-3">
          <div className="flex items-center gap-2 px-6 sm:px-1">
            <span className="rounded-full bg-brand-navy/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-navy sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.2em]">
              {section.title}
            </span>
            <div className="h-px flex-1 bg-brand-line/80" />
            <span className="text-[11px] text-brand-muted sm:text-xs">
              {section.participants.length}
            </span>
          </div>

          <div className="border-y border-brand-line/70 bg-white sm:space-y-3 sm:border-y-0 sm:bg-transparent">
            {section.participants.map((participant, rowIndex) => (
              <ManagedEventParticipantRow
                key={participant.id}
                canManageParticipant={canManageParticipant}
                eventIsArchived={eventIsArchived}
                isExpanded={expandedParticipantIds.includes(participant.id)}
                isSaving={updatingParticipantId === participant.id}
                onExpandedChange={(open) => onExpandedChange(participant.id, open)}
                onStatusChange={(status) => onStatusChange(participant.id, status)}
                participant={participant}
                participantProfile={participantProfilesById.get(participant.participantProfileId) ?? null}
                rowIndex={rowIndex}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ManagedEnrollmentRequestsSection({
  canManageRequests,
  event,
  eventGroup,
  title = "Chcą wziąć udział",
  movingRequestId,
  onDecision,
  onTransfer,
  onTransferSelectionChange,
  requestSections,
  requestTransferOptions,
  transferSelections,
  updatingRequestId,
  expandedRequestIds,
  expandedRequestSections,
  onExpandedRequestChange,
  onExpandedSectionChange,
}: {
  canManageRequests: boolean;
  event: TrainingEvent;
  eventGroup?: Group | null;
  title?: string;
  movingRequestId: string | null;
  onDecision: (request: EnrollmentRequest, decision: DecisionStatus) => Promise<void>;
  onTransfer: (request: EnrollmentRequest) => Promise<void>;
  onTransferSelectionChange: (requestId: string, nextValue: string) => void;
  requestSections: EnrollmentRequestArchiveSection[];
  requestTransferOptions: EnrollmentRequestTransferOption[];
  transferSelections: Record<string, string>;
  updatingRequestId: string | null;
  expandedRequestIds: string[];
  expandedRequestSections: Record<EnrollmentRequestArchiveSectionKey, boolean>;
  onExpandedRequestChange: (requestId: string, open: boolean) => void;
  onExpandedSectionChange: (key: EnrollmentRequestArchiveSectionKey, open: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionBlockHeading
        title={title}
        description="Aktywne zgłoszenia są na górze, a potwierdzone i odrzucone osoby spadają niżej do osobnych zwiniętych sekcji."
      />
      {requestSections.length === 0 ? (
        <EmptyPanelState
          title="Brak zgłoszeń"
          description="Gdy pojawią się nowe prośby o dołączenie, zobaczysz je tutaj."
        />
      ) : (
        requestSections.map((section) => (
          <EnrollmentRequestArchiveSectionBlock
            key={section.key}
            title={section.title}
            count={section.requests.length}
            open={expandedRequestSections[section.key] ?? section.defaultOpen}
            onOpenChange={(open) => onExpandedSectionChange(section.key, open)}
          >
            <EnrollmentRequestListSurface>
              {section.requests.map((request, index) => {
                const transferTargetEventId = transferSelections[request.id] ?? "";
                const showTransferPanel = requestTransferOptions.length > 0;
                const showPhoto = hasEnrollmentRequestReadyPhoto(request);
                const acceptHint = getEnrollmentAcceptanceHint(event);

                return (
                  <EnrollmentRequestSlimRow
                    key={request.id}
                    request={request}
                    event={event}
                    eventGroup={eventGroup}
                    isExpanded={expandedRequestIds.includes(request.id)}
                    onExpandedChange={(open) => onExpandedRequestChange(request.id, open)}
                    isSaving={updatingRequestId === request.id || movingRequestId === request.id}
                    itemPosition={getEnrollmentRequestListItemPosition(index, section.requests.length)}
                  >
                    <div className="space-y-4">
                      <EnrollmentRequestMetaRow request={request} />
                      <EnrollmentRequestMessageBlock request={request} />

                      {showPhoto || showTransferPanel ? (
                        <div
                          className={cn(
                            "grid gap-4",
                            showPhoto && showTransferPanel ? "lg:grid-cols-[1.2fr_1fr]" : "",
                          )}
                        >
                          <EnrollmentPhotoCard request={request} />
                          <EnrollmentRequestTransferPanel
                            title={
                              isCommunityPanelEvent(event)
                                ? "Przenieś na inne wydarzenie"
                                : "Przenieś na inny termin"
                            }
                            options={requestTransferOptions}
                            value={transferTargetEventId}
                            onChange={(nextValue) =>
                              onTransferSelectionChange(request.id, nextValue)
                            }
                          />
                        </div>
                      ) : null}

                      {canManageRequests ? (
                        <EnrollmentRequestManagementActions
                          finalStatus={resolveEnrollmentRequestDisplayStatus(request)}
                          acceptHint={acceptHint}
                          disabled={updatingRequestId === request.id}
                          transferPending={movingRequestId === request.id}
                          transferTargetEventId={transferTargetEventId}
                          onDecision={(decision) => void onDecision(request, decision)}
                          onTransfer={() => void onTransfer(request)}
                        />
                      ) : null}
                    </div>
                  </EnrollmentRequestSlimRow>
                );
              })}
            </EnrollmentRequestListSurface>
          </EnrollmentRequestArchiveSectionBlock>
        ))
      )}
    </div>
  );
}

function hasEnrollmentRequestReadyPhoto(
  request: Pick<EnrollmentRequest, "photoPath" | "photoStatus">,
) {
  return Boolean(request.photoPath && request.photoStatus === "ready");
}

function EventScopeSwitch({
  title,
  activeScope,
  joinedLabel,
  ownedLabel,
  onChange,
}: {
  title?: string;
  activeScope: "all" | "mine";
  joinedLabel: string;
  ownedLabel: string;
  onChange: (scope: "all" | "mine") => void;
}) {
  return (
    <div className="w-full max-w-[28rem]">
      {title ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-brand-sky-deep">
          {title}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-1 rounded-[1.75rem] border border-brand-line bg-white p-1 shadow-soft">
        <button
          type="button"
          onClick={() => onChange("all")}
          className={`min-w-0 rounded-[1.35rem] px-3 py-2.5 text-center text-sm font-semibold transition ${
            activeScope === "all"
              ? "bg-brand-navy text-white"
              : "text-brand-muted hover:text-brand-navy"
          }`}
        >
          {joinedLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange("mine")}
          className={`min-w-0 rounded-[1.35rem] px-3 py-2.5 text-center text-sm font-semibold transition ${
            activeScope === "mine"
              ? "bg-brand-navy text-white"
              : "text-brand-muted hover:text-brand-navy"
          }`}
        >
          {ownedLabel}
        </button>
      </div>
    </div>
  );
}

type CommunityModerationTimelineScope = "pending" | "future" | "past";

function CommunityModerationTimelineSwitch({
  activeScope,
  onChange,
}: {
  activeScope: CommunityModerationTimelineScope;
  onChange: (scope: CommunityModerationTimelineScope) => void;
}) {
  const options: Array<{ scope: CommunityModerationTimelineScope; label: string }> = [
    { scope: "pending", label: "Oczekujące" },
    { scope: "future", label: "Przyszłe" },
    { scope: "past", label: "Przeszłe" },
  ];

  return (
    <div className="w-full max-w-[34rem]">
      <div className="grid grid-cols-3 gap-1 rounded-[1.75rem] border border-brand-line bg-white p-1 shadow-soft">
        {options.map((option) => (
          <button
            key={option.scope}
            type="button"
            onClick={() => onChange(option.scope)}
            className={`min-w-0 rounded-[1.35rem] px-3 py-2.5 text-center text-sm font-semibold transition ${
              activeScope === option.scope
                ? "bg-brand-navy text-white"
                : "text-brand-muted hover:text-brand-navy"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getEventImagePreviewWidth(image: TrainingEventImage, height = 112) {
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 1;
  return Math.max(88, Math.round(height * ratio));
}

function moveEventImageToFront(images: TrainingEventImage[], imageId: string) {
  const selectedImage = images.find((image) => image.id === imageId);

  if (!selectedImage) {
    return images;
  }

  return [selectedImage, ...images.filter((image) => image.id !== imageId)];
}

function EventGalleryField({
  images,
  useEventImageAsCover,
  uploading,
  disabled = false,
  onUpload,
  onRemove,
  onToggleUseEventImageAsCover,
  onMakePrimary,
}: {
  images: TrainingEventImage[];
  useEventImageAsCover: boolean;
  uploading: boolean;
  disabled?: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onRemove: (imageId: string) => void;
  onToggleUseEventImageAsCover: (nextValue: boolean) => void;
  onMakePrimary: (imageId: string) => void;
}) {
  return (
    <div className="grid gap-3 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-sm font-semibold text-brand-navy">Zdjęcia wydarzenia</span>
          <p className="mt-1 text-sm text-brand-muted">
            Dodaj maksymalnie 8 zdjęć. Pierwsze zdjęcie będzie głównym obrazem wydarzenia.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-soft disabled:opacity-60">
          <ImagePlus size={16} />
          {uploading ? "Wgrywanie..." : "Dodaj zdjęcia"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            disabled={disabled || uploading || images.length >= 8}
            className="hidden"
            onChange={async (event) => {
              const selectedFiles = Array.from(event.target.files ?? []);
              event.target.value = "";

              if (selectedFiles.length === 0) {
                return;
              }

              await onUpload(selectedFiles);
            }}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-3xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy">
        <input
          type="checkbox"
          checked={useEventImageAsCover}
          onChange={(event) => onToggleUseEventImageAsCover(event.target.checked)}
          disabled={disabled || images.length === 0}
          className="mt-1"
        />
        <span className="grid gap-1">
          <span className="text-sm font-semibold">
            Ustaw inne zdjęcie jako zdjęcie główne
          </span>
          <span className="text-sm text-brand-muted">
            Domyślnie po lewej pokaże się zdjęcie z profilu autora. Po zaznaczeniu możesz wybrać zdjęcie główne z galerii.
          </span>
        </span>
      </label>

      {images.length > 0 ? (
        <div className="flex flex-wrap gap-4">
          {images.map((image, index) => (
            <div key={image.id} className="grid gap-2">
              <div
                className="relative overflow-hidden rounded-[1.4rem] border border-brand-line bg-white shadow-soft"
                style={{
                  width: `${getEventImagePreviewWidth(image)}px`,
                  height: "112px",
                }}
              >
                <img
                  src={image.url}
                  alt={`Zdjęcie wydarzenia ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-brand-navy/80 via-brand-navy/30 to-transparent px-3 py-2">
                  <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-navy">
                    {useEventImageAsCover && index === 0 ? "Główne" : `Zdjęcie ${index + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(image.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand-navy transition hover:bg-white"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {useEventImageAsCover && index !== 0 && (
                  <button
                    type="button"
                    onClick={() => onMakePrimary(image.id)}
                    className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold text-brand-navy shadow-soft"
                  >
                    Ustaw jako główne
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-brand-line bg-white px-4 py-5 text-sm text-brand-muted">
          Nie dodano jeszcze zdjęć wydarzenia. Jeśli zostawisz tę sekcję pustą, publiczny widok pokaże zdjęcie gospodarza.
        </div>
      )}
    </div>
  );
}

function EventDetailScopeSwitch({
  activeTab,
  onChange,
  requestCount,
  participantCountLabel,
  reserveCount,
}: {
  activeTab: "requests" | "participants" | "reserve";
  onChange: (nextTab: "requests" | "participants" | "reserve") => void;
  requestCount: number;
  participantCountLabel: string;
  reserveCount: number;
}) {
  const items = [
    {
      id: "requests" as const,
      label: "Zgłoszenia",
      badge: requestCount > 0 ? String(requestCount) : undefined,
      icon: <Bell size={15} />,
    },
    {
      id: "participants" as const,
      label: "Uczestnicy",
      badge: participantCountLabel,
      icon: <Users size={15} />,
    },
    {
      id: "reserve" as const,
      label: "Rezerwowi",
      badge: reserveCount > 0 ? String(reserveCount) : undefined,
      icon: <ShieldCheck size={15} />,
    },
  ];

  return (
    <div className="w-full rounded-[1.75rem] border border-brand-line bg-white p-1 shadow-soft">
      <div className="grid gap-1 md:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-[1.35rem] px-3 py-2.5 text-center text-sm font-semibold transition ${
              activeTab === item.id
                ? "bg-brand-navy text-white"
                : "text-brand-muted hover:text-brand-navy"
            }`}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === item.id
                    ? "bg-white/18 text-white"
                    : "bg-brand-shell text-brand-navy"
                }`}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function CommunityEventEditorFields({
  values,
  disabled = false,
  uploadingImages,
  onChange,
  onUploadImages,
}: {
  values: CommunityEventEditorValues;
  disabled?: boolean;
  uploadingImages: boolean;
  onChange: (updater: (previous: CommunityEventEditorValues) => CommunityEventEditorValues) => void;
  onUploadImages: (files: File[]) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-brand-navy">Tytuł wydarzenia</span>
        <input
          required
          disabled={disabled}
          value={values.title}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              title: event.target.value,
            }))
          }
          placeholder="np. Kajaki nad Bugiem"
          className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-brand-navy">Lokalizacja</span>
        <input
          required
          disabled={disabled}
          value={values.location}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              location: event.target.value,
            }))
          }
          placeholder="np. Warszawa, dolnośląskie"
          className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
      </label>

      <label className="grid gap-2 xl:col-span-2">
        <span className="text-sm font-semibold text-brand-navy">Status wydarzenia</span>
        <select
          disabled={disabled}
          value={values.status}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              status: event.target.value as TrainingEventStatus,
            }))
          }
          className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        >
          <option value="active">Aktywne</option>
          <option value="confirmed">Potwierdzone zorganizowanie</option>
          <option value="cancelled">Anulowane</option>
        </select>
      </label>

      <label className="grid gap-2 xl:col-span-2">
        <span className="text-sm font-semibold text-brand-navy">Krótka informacja o wydarzeniu</span>
        <textarea
          required
          disabled={disabled}
          rows={3}
          maxLength={180}
          value={values.summary}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              summary: event.target.value,
            }))
          }
          className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
      </label>

      <label className="grid gap-2 xl:col-span-2">
        <span className="text-sm font-semibold text-brand-navy">Informacja do prośby o dołączenie</span>
        <textarea
          required
          disabled={disabled}
          rows={6}
          value={values.description}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              description: event.target.value,
            }))
          }
          className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
        <span className="text-sm text-brand-muted">
          Ten tekst pokaże się osobie przed wysłaniem prośby o dołączenie.
        </span>
      </label>

      <label className="grid gap-2 xl:col-span-2">
        <span className="text-sm font-semibold text-brand-navy">Tagi wydarzenia</span>
        <input
          disabled={disabled}
          value={values.tags}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              tags: event.target.value,
            }))
          }
          placeholder="np. ognisko, pożywienie, nocleg, samodzielna kuchnia"
          className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
        <span className="text-sm text-brand-muted">
          Oddziel tagi przecinkami. Pokażą się publicznie jako chmura tagów.
        </span>
      </label>

      <div className="grid gap-2 xl:col-span-2">
        <EventGalleryField
          images={values.eventImages}
          useEventImageAsCover={values.useEventImageAsCover}
          uploading={uploadingImages}
          disabled={disabled}
          onUpload={onUploadImages}
          onRemove={(imageId) =>
            onChange((previous) => {
              const nextImages = previous.eventImages.filter((image) => image.id !== imageId);
              return {
                ...previous,
                eventImages: nextImages,
                useEventImageAsCover: nextImages.length > 0 ? previous.useEventImageAsCover : false,
              };
            })
          }
          onToggleUseEventImageAsCover={(nextValue) =>
            onChange((previous) => ({
              ...previous,
              useEventImageAsCover: nextValue && previous.eventImages.length > 0,
            }))
          }
          onMakePrimary={(imageId) =>
            onChange((previous) => ({
              ...previous,
              eventImages: moveEventImageToFront(previous.eventImages, imageId),
            }))
          }
        />
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-brand-navy">Pierwszy dzień wydarzenia</span>
        <input
          required
          disabled={disabled}
          type="date"
          value={values.firstDayDate}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              firstDayDate: event.target.value,
            }))
          }
          className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-brand-navy">Liczba dni wydarzenia</span>
        <input
          required
          disabled={disabled}
          min={1}
          type="number"
          value={values.scheduleDays.length}
          onChange={(event) => {
            const nextDayCount = Math.max(1, Number(event.target.value) || 1);
            onChange((previous) => ({
              ...previous,
              scheduleDays: resizeScheduleDayDrafts(nextDayCount, previous.scheduleDays),
            }));
          }}
          className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
      </label>

      <div className="grid gap-4 xl:col-span-2 xl:grid-cols-4">
        {values.scheduleDays.map((day, index) => {
          const draftScheduleDays = buildScheduleDaysFromDrafts(
            values.firstDayDate,
            values.scheduleDays,
          );

          return (
            <div
              key={`community-editor-day-${index + 1}`}
              className="rounded-3xl border border-brand-line bg-brand-shell p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                  Dzień {index + 1}
                </p>
                <p className="text-sm text-brand-muted">
                  {draftScheduleDays[index]?.startsAt
                    ? formatDate(draftScheduleDays[index].startsAt)
                    : "Wybierz pierwszy dzień"}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Godzina startu</span>
                  <input
                    required
                    disabled={disabled}
                    type="time"
                    value={day.startTime}
                    onChange={(event) =>
                      onChange((previous) => ({
                        ...previous,
                        scheduleDays: previous.scheduleDays.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, startTime: event.target.value } : item,
                        ),
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Godzina końca</span>
                  <input
                    required
                    disabled={disabled}
                    type="time"
                    value={day.endTime}
                    onChange={(event) =>
                      onChange((previous) => ({
                        ...previous,
                        scheduleDays: previous.scheduleDays.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, endTime: event.target.value } : item,
                        ),
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-brand-navy">Limit miejsc</span>
        <input
          required
          disabled={disabled}
          min={1}
          type="number"
          value={values.capacity}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              capacity: event.target.value,
            }))
          }
          className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-brand-navy">Próg potwierdzenia wydarzenia</span>
        <input
          required
          disabled={disabled}
          min={1}
          type="number"
          value={values.minimumParticipants}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              minimumParticipants: event.target.value,
            }))
          }
          className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-brand-navy">SMS potwierdzenia udziału</span>
        <input
          required
          disabled={disabled}
          min={0}
          type="number"
          value={values.confirmationLeadTimeDays}
          onChange={(event) =>
            onChange((previous) => ({
              ...previous,
              confirmationLeadTimeDays: event.target.value,
            }))
          }
          className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
        />
        <span className="text-sm text-brand-muted">
          Ile dni przed wydarzeniem wysłać SMS z prośbą o potwierdzenie udziału.
        </span>
      </label>
    </div>
  );
}

function getCommunityChartColor(status: TrainingEventStatus | undefined) {
  return resolveTrainingEventStatus(status) === "confirmed"
    ? "#0ea5a4"
    : "#174f9a";
}

function CommunityPerformanceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; fillRate: number; statusLabel: string } }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold text-brand-navy">{item.label}</p>
      <p className="mt-1 text-sm text-brand-muted">{item.statusLabel}</p>
      <p className="mt-2 text-sm font-semibold text-brand-navy">
        Zapełnienie: {item.fillRate}%
      </p>
    </div>
  );
}

function DashboardChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[1.5rem] border border-brand-line bg-white p-3.5 shadow-soft sm:rounded-[2rem] sm:p-5">
      <div className="min-h-0 sm:min-h-[88px]">
        <SectionBlockHeading title={title} description={description} />
      </div>
      <div className="mt-3.5 sm:mt-5">{children}</div>
    </article>
  );
}

function DashboardChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[168px] items-center justify-center rounded-[1.5rem] border border-dashed border-brand-line bg-brand-shell px-4 text-center text-sm text-brand-muted sm:min-h-[240px] sm:px-5">
      {message}
    </div>
  );
}

function DashboardLegend({
  items,
}: {
  items: Array<{ label: string; color: string }>;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 rounded-full bg-brand-shell px-3 py-1 text-brand-navy"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

type DashboardEventBarDatum = {
  id: string;
  label: string;
  startsAt: string;
  statusLabel: string;
  status: TrainingEventStatus;
  isOfficialGroupTraining: boolean;
  fillRate: number;
  missingPeople: number;
  occupiedPlaces: number;
  confirmedCount: number;
  overflowCount: number;
  capacity: number;
  availablePlaces: number;
};

type DashboardMonthCapacityDatum = {
  key: string;
  label: string;
  totalCapacity: number;
  enrolledCount: number;
  confirmedCount: number;
  overflowCount: number;
  availablePlaces: number;
};

type DashboardMonthRequestsDatum = {
  key: string;
  label: string;
  total: number;
};

type DashboardMonthDecisionDatum = {
  key: string;
  label: string;
  accepted: number;
  pending: number;
  rejected: number;
  partial: number;
};

type DashboardMonthOutcomeDatum = {
  key: string;
  label: string;
  confirmed: number;
  cancelled: number;
};

type DashboardOrganizerGroupsDatum = {
  organizerId: string;
  label: string;
  plannedGroups: number;
};

function MissingPeopleTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardEventBarDatum }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold text-brand-navy">{item.label}</p>
      <p className="mt-1 text-sm text-brand-muted">{item.statusLabel}</p>
      <p className="mt-2 text-sm text-brand-navy">Brakuje: {item.missingPeople} osob</p>
      <p className="text-sm text-brand-navy">Na rosterze: {item.occupiedPlaces}/{item.capacity}</p>
      {item.isOfficialGroupTraining ? (
        <p className="text-sm text-brand-navy">Potwierdzeni: {item.confirmedCount}</p>
      ) : null}
      {item.overflowCount > 0 ? (
        <p className="text-sm text-brand-navy">Nad limit: {item.overflowCount}</p>
      ) : null}
    </div>
  );
}

function CapacityByMonthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardMonthCapacityDatum }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold text-brand-navy">{item.label}</p>
      <p className="mt-2 text-sm text-brand-navy">Na rosterze: {item.enrolledCount}</p>
      <p className="text-sm text-brand-navy">Potwierdzeni: {item.confirmedCount}</p>
      <p className="text-sm text-brand-navy">Liczba miejsc: {item.totalCapacity}</p>
      <p className="text-sm text-brand-navy">Wolne miejsca: {item.availablePlaces}</p>
      {item.overflowCount > 0 ? (
        <p className="text-sm text-brand-navy">Nad limit: {item.overflowCount}</p>
      ) : null}
    </div>
  );
}

function RequestsByMonthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardMonthRequestsDatum }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold text-brand-navy">{item.label}</p>
      <p className="mt-2 text-sm text-brand-navy">Nowe zgloszenia: {item.total}</p>
    </div>
  );
}

function RequestDecisionsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardMonthDecisionDatum }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold text-brand-navy">{item.label}</p>
      <div className="mt-2 space-y-1 text-sm text-brand-navy">
        <p>{getEnrollmentFinalStatusLabel("accepted")}: {item.accepted}</p>
        <p>{getEnrollmentFinalStatusLabel("pending")}: {item.pending}</p>
        <p>{getEnrollmentFinalStatusLabel("partial")}: {item.partial}</p>
        <p>{getEnrollmentFinalStatusLabel("rejected")}: {item.rejected}</p>
      </div>
    </div>
  );
}

function EventOutcomesTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardMonthOutcomeDatum }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold text-brand-navy">{item.label}</p>
      <p className="mt-2 text-sm text-brand-navy">Potwierdzone: {item.confirmed}</p>
      <p className="text-sm text-brand-navy">Anulowane: {item.cancelled}</p>
    </div>
  );
}

function OrganizerGroupsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardOrganizerGroupsDatum }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold text-brand-navy">{item.label}</p>
      <p className="mt-2 text-sm text-brand-navy">Zaplanowane grupy: {item.plannedGroups}</p>
    </div>
  );
}

function CancelledEventsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardEventBarDatum }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold text-brand-navy">{item.label}</p>
      <p className="mt-1 text-sm text-brand-muted">{item.statusLabel}</p>
      <p className="mt-2 text-sm text-brand-navy">Liczba miejsc: {item.capacity}</p>
      <p className="text-sm text-brand-navy">Na rosterze: {item.occupiedPlaces}</p>
      {item.isOfficialGroupTraining ? (
        <p className="text-sm text-brand-navy">Potwierdzeni: {item.confirmedCount}</p>
      ) : null}
      {item.overflowCount > 0 ? (
        <p className="text-sm text-brand-navy">Nad limit: {item.overflowCount}</p>
      ) : null}
    </div>
  );
}

function EnrollmentPhotoCard({ request }: { request: EnrollmentRequest }) {
  const { resolveEnrollmentPhoto } = useAppState();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const shouldShowPhoto = hasEnrollmentRequestReadyPhoto(request);

  useEffect(() => {
    if (!shouldShowPhoto || !request.photoPath || request.photoStatus !== "ready") {
      setPhotoUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    void resolveEnrollmentPhoto(request.photoPath)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        objectUrl = url;
        setPhotoUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setPhotoUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [request.photoPath, request.photoStatus, resolveEnrollmentPhoto, shouldShowPhoto]);

  if (!shouldShowPhoto) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-brand-line bg-brand-shell p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy">
        <ImagePlus size={16} />
        Zdjęcie twarzy
      </div>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`Zdjęcie zgłoszenia ${request.imieNazwisko}`}
          className="h-56 w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="h-56 animate-pulse rounded-2xl bg-white/70" />
      )}
    </div>
  );
}


function DetachRelationControls({
  relationId,
  allowArchiveOption,
}: {
  relationId: string;
  allowArchiveOption: boolean;
}) {
  const { detachRelation } = useAppState();
  const [archiveLinkedEvents, setArchiveLinkedEvents] = useState(false);
  const [detaching, setDetaching] = useState(false);

  return (
    <div className="mt-5 rounded-3xl border border-brand-line bg-brand-shell p-4">
      {allowArchiveOption && (
        <label className="flex items-start gap-3 text-sm text-brand-muted">
          <input
            type="checkbox"
            checked={archiveLinkedEvents}
            onChange={(event) => setArchiveLinkedEvents(event.target.checked)}
            className="mt-1"
          />
          <span>
            Przy odpieciu zarchiwizuj wszystkie szkolenia powiazane z tym organizatorem.
            Organizator zobaczy je potem tylko jako archiwalne i bez mozliwosci otwarcia.
          </span>
        </label>
      )}

      <button
        type="button"
        disabled={detaching}
        onClick={async () => {
          const confirmMessage = allowArchiveOption && archiveLinkedEvents
            ? "Odepnac relacje i zarchiwizowac powiazane szkolenia?"
            : "Odepnac te relacje?";

          if (!window.confirm(confirmMessage)) {
            return;
          }

          setDetaching(true);

          try {
            await detachRelation(relationId, archiveLinkedEvents);
            toast.success(
              allowArchiveOption && archiveLinkedEvents
                ? "Relacja zostala odpięta, a szkolenia zarchiwizowane."
                : "Relacja zostala odpięta.",
            );
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Nie udalo sie odpiac relacji.",
            );
          } finally {
            setDetaching(false);
          }
        }}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
      >
        {detaching ? "Odpinanie..." : "Odepnij relacje"}
      </button>
    </div>
  );
}

export function OrganizerRelationsHubSection({
  activeRelations,
  availableTrainers,
  organizerFunctionsAreBlocked,
  onConnectTrainer,
  onDetachRelation,
  trainerNamesById,
}: {
  activeRelations: TrainerOrganizerRelation[];
  availableTrainers: TrainerProfile[];
  organizerFunctionsAreBlocked: boolean;
  onConnectTrainer: (trainerId: string, trainerAuthorizationCode: string) => Promise<void>;
  onDetachRelation: (relationId: string) => Promise<void>;
  trainerNamesById: Map<string, string>;
}) {
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerProfile | null>(null);
  const [trainerAuthorizationCode, setTrainerAuthorizationCode] = useState("");
  const [connectingTrainerId, setConnectingTrainerId] = useState<string | null>(null);
  const [detachingRelationId, setDetachingRelationId] = useState<string | null>(null);
  const activeRelationsByTrainerId = useMemo(
    () => new Map(activeRelations.map((relation) => [relation.trainerId, relation])),
    [activeRelations],
  );

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SectionBlockHeading
          title="Przekazujący wiedzę"
          description="Tu zarządzasz połączeniami z Przekazującymi Wiedzę. Zielone kafle są już aktywne."
        />
        {availableTrainers.length === 0 ? (
          <EmptyPanelState
            title="Brak trenerów"
            description="Gdy profile trenerów będą widoczne publicznie, pojawią się tutaj automatycznie."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {availableTrainers.map((trainer) => {
              const activeRelation = activeRelationsByTrainerId.get(trainer.id);
              const isConnected = Boolean(activeRelation);
              const isConnecting = connectingTrainerId === trainer.id;
              const isDetaching = activeRelation && detachingRelationId === activeRelation.id;

              if (isConnected) {
                return (
                  <button
                    key={trainer.id}
                    type="button"
                    disabled={organizerFunctionsAreBlocked || isDetaching}
                    onClick={async () => {
                      if (!activeRelation) {
                        return;
                      }

                      if (!window.confirm("Odepnąć tego Przekazującego Wiedzę?")) {
                        return;
                      }

                      setDetachingRelationId(activeRelation.id);

                      try {
                        await onDetachRelation(activeRelation.id);
                        toast.success("Relacja została odpięta.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się odpiąć relacji.",
                        );
                      } finally {
                        setDetachingRelationId((current) =>
                          current === activeRelation.id ? null : current,
                        );
                      }
                    }}
                    className="min-h-[8.75rem] rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-4 text-left shadow-soft transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex h-full flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-700">
                          {trainer.displayName.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-brand-navy sm:text-base">
                            {trainer.displayName}
                          </p>
                          <p className="mt-1 text-xs text-brand-muted">
                            {isDetaching
                              ? "Odpinanie..."
                              : `od ${formatDate(activeRelation.createdAt)}`}
                          </p>
                        </div>
                      </div>
                      <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                        <Check size={14} />
                        Połączono
                      </span>
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={trainer.id}
                  type="button"
                  disabled={organizerFunctionsAreBlocked || isConnecting}
                  onClick={() => {
                    setTrainerAuthorizationCode("");
                    setSelectedTrainer(trainer);
                  }}
                  className="min-h-[8.75rem] rounded-[1.6rem] border border-brand-line bg-white p-4 text-left shadow-soft transition hover:border-brand-sky hover:bg-brand-shell/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex flex-1 items-center gap-3">
                      <div className="inline-flex size-11 shrink-0 items-center justify-center self-center rounded-full bg-brand-shell text-lg font-semibold text-brand-navy">
                        {trainer.displayName.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-brand-navy sm:text-xl">
                          {trainer.displayName}
                        </p>
                      </div>
                    </div>
                    <p className="mt-auto text-sm text-brand-muted">
                      {isConnecting ? "Łączenie..." : "Kliknij, by połączyć"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {organizerFunctionsAreBlocked ? (
          <p className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Funkcje organizatora są chwilowo zablokowane przez moderatora lub admina. Nadal
            zachowujesz konto uczestnika i podgląd danych, ale nie aktywujesz tu nowych relacji ani
            nie uruchamiasz działań organizerowych.
          </p>
        ) : null}
      </section>
      <Dialog open={Boolean(selectedTrainer)} onOpenChange={(open) => !open && setSelectedTrainer(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border border-brand-line bg-white p-0">
          <div className="p-6 sm:p-7">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-semibold text-brand-navy">
                Połącz z trenerem
              </DialogTitle>
              <DialogDescription className="text-sm text-brand-muted">
                {selectedTrainer
                  ? `Wpisz kod od ${selectedTrainer.displayName}, aby aktywować relację organizatora.`
                  : "Wpisz kod trenera, aby aktywować relację organizatora."}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!selectedTrainer) {
                  return;
                }

                setConnectingTrainerId(selectedTrainer.id);

                try {
                  await onConnectTrainer(selectedTrainer.id, trainerAuthorizationCode);
                  toast.success("Relacja z Przekazującym została aktywowana.");
                  setTrainerAuthorizationCode("");
                  setSelectedTrainer(null);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Nie udało się aktywować relacji.",
                  );
                } finally {
                  setConnectingTrainerId((current) =>
                    current === selectedTrainer.id ? null : current,
                  );
                }
              }}
              className="mt-6 space-y-4"
            >
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">Kod trenera</span>
                <input
                  required
                  autoFocus
                  value={trainerAuthorizationCode}
                  onChange={(event) => setTrainerAuthorizationCode(event.target.value)}
                  placeholder="Wpisz kod od trenera"
                  disabled={organizerFunctionsAreBlocked || !selectedTrainer}
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                />
              </label>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedTrainer(null)}
                  className="inline-flex items-center justify-center rounded-full border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy shadow-soft"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={organizerFunctionsAreBlocked || !selectedTrainer || !trainerAuthorizationCode.trim()}
                  className="inline-flex items-center justify-center rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
                >
                  {selectedTrainer && connectingTrainerId === selectedTrainer.id
                    ? "Łączenie..."
                    : "Połącz"}
                </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RelationsHubContent() {
  const {
    connectOrganizerToTrainerWithCode,
    currentUser,
    detachRelation,
    store,
  } = useAppState();

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const organizerFunctionsAreBlocked = isOrganizerFunctionsBlocked(currentUser);
  const canUseOrganizerHub = currentUser.role !== "admin" || Boolean(organizerProfile);
  const canUseTrainerHub = hasInheritedRole(currentUser, "trainer") && Boolean(trainerProfile);
  const shouldShowOrganizerRelationsList = currentUser.role !== "admin" || Boolean(organizerProfile);
  const shouldShowSelfHub = currentUser.role !== "admin" || canUseOrganizerHub || canUseTrainerHub;
  const organizerRelations = organizerProfile
    ? store.relations.filter((relation) => relation.organizerId === organizerProfile.id)
    : [];
  const activeOrganizerRelations = organizerRelations.filter(
    (relation) => relation.status === "approved",
  );
  const trainerRelations = trainerProfile
    ? store.relations.filter((relation) => relation.trainerId === trainerProfile.id)
    : [];
  const trainerNamesById = new Map(
    (store.trainers ?? []).map((trainer) => [trainer.id, trainer.displayName]),
  );
  const availableOrganizerTrainers = sortTrainerProfiles(
    (store.trainers ?? []).filter(
      (trainer) => trainer.isVisible && trainer.brandStatus === "official",
    ),
  );
  const allRelations = currentUser.role === "admin"
    ? store.relations
    : Array.from(
        new Map(
          [...organizerRelations, ...trainerRelations].map((relation) => [relation.id, relation]),
        ).values(),
      );

  function renderRelationCard(
    relation: (typeof allRelations)[number],
    scope: "trainer" | "organizer" | "admin",
  ) {
    const trainer = store.trainers.find((item) => item.id === relation.trainerId);
    const organizer = store.organizers.find((item) => item.id === relation.organizerId);
    const allowArchiveOption = scope === "trainer";
    const canDetach =
      relation.status === "approved" &&
      (scope !== "organizer" || !organizerFunctionsAreBlocked);

    return (
      <article
        key={`${scope}-${relation.id}`}
        className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold text-brand-navy">
              {trainer?.displayName ?? "Trener"} ↔ {organizer?.displayName ?? "Organizator"}
            </p>
            <p className="mt-2 text-brand-muted">
              Połączenie utworzone {formatDate(relation.createdAt)}.
            </p>
          </div>
          <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy">
            {relation.status}
          </span>
        </div>

        {canDetach ? (
          <DetachRelationControls
            relationId={relation.id}
            allowArchiveOption={allowArchiveOption}
          />
        ) : null}
      </article>
    );
  }

  return (
    <div className="space-y-6">
      {shouldShowSelfHub ? (
        <div className="space-y-6">
          {canUseTrainerHub ? (
            <section className="space-y-4">
              <SectionBlockHeading
                title="Moi organizatorzy"
                description="To organizatorzy przypięci do Ciebie jako Przekazującego Wiedzę."
              />
              {trainerRelations.length === 0 ? (
                <EmptyPanelState
                  title="Brak organizatorów"
                  description="Aktywne relacje z organizatorami pojawią się tutaj automatycznie."
                />
              ) : (
                trainerRelations.map((relation) => renderRelationCard(relation, "trainer"))
              )}
            </section>
          ) : null}

          {shouldShowOrganizerRelationsList ? (
            <OrganizerRelationsHubSection
              activeRelations={activeOrganizerRelations}
              availableTrainers={availableOrganizerTrainers}
              organizerFunctionsAreBlocked={organizerFunctionsAreBlocked}
              onConnectTrainer={(trainerId, trainerAuthorizationCode) =>
                connectOrganizerToTrainerWithCode(trainerAuthorizationCode, trainerId).then(() => undefined)
              }
              onDetachRelation={(relationId) => detachRelation(relationId)}
              trainerNamesById={trainerNamesById}
            />
          ) : null}
        </div>
      ) : null}

      {currentUser.role === "admin" && !canUseOrganizerHub && !canUseTrainerHub ? (
        <div className="space-y-4">
          <SectionBlockHeading
            title="Wszystkie relacje"
            description="Admin widzi pełny przekrój połączeń trener-organizator."
          />
          {allRelations.length === 0 && (
          <EmptyPanelState
            title="Brak relacji"
            description="Aktywne relacje trener-organizator pojawią się tutaj automatycznie."
          />
          )}
          {allRelations.map((relation) => renderRelationCard(relation, "admin"))}
        </div>
      ) : null}
    </div>
  );
}

export function RelationsPage() {
  return <Navigate to="/panel/ustawienia" replace />;
}

function PeoplePage({ kind }: { kind: "trainer" | "organizer" }) {
  const { currentUser, store, updateTrainerBrandStatus } = useAppState();
  const items = kind === "organizer" ? store.organizers : store.trainers;
  const trainerProfile = store.trainers.find((item) => item.userId === currentUser?.id);
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const organizerRelationsById =
    kind === "organizer" && currentUser?.role === "trainer" && trainerProfile
      ? new Map(
          store.relations
            .filter((relation) => relation.trainerId === trainerProfile.id)
            .map((relation) => [relation.organizerId, relation]),
        )
      : null;

  if (kind === "organizer" && currentUser?.role === "trainer" && isCommunityTrainer) {
    return <Navigate to="/panel/szkolenia" replace />;
  }

  return (
    <PanelSection
      eyebrow="Ludzie"
      title={kind === "organizer" ? "Organizatorzy" : "Przekazujący Wiedzę"}
      description="Katalog osób i podmiotów widocznych z poziomu panelu."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {items.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyPanelState
              title="Brak rekordów"
              description="Katalog pojawi si? tutaj dopiero po dodaniu realnych rekord?w do systemu."
            />
          </div>
        )}
        {items.map((item) => {
          const organizerRelation =
            kind === "organizer" && currentUser?.role === "trainer"
              ? organizerRelationsById?.get(item.id)
              : null;

          return (
            <article
              key={item.id}
              className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
            >
              <h3 className="text-2xl font-semibold text-brand-navy">
                {item.displayName}
              </h3>
              <p className="mt-3 text-brand-muted">
                {"bio" in item ? item.bio : item.description}
              </p>
              {"bio" in item && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                    {getBrandStatusLabel(item.brandStatus)}
                  </span>
                </div>
              )}
              {organizerRelation && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                    relacja: {organizerRelation.status}
                  </span>
                </div>
              )}
              {organizerRelation?.status === "approved" && (
                <DetachRelationControls
                  relationId={organizerRelation.id}
                  allowArchiveOption
                />
              )}
              {kind === "trainer" && currentUser?.role === "admin" && "bio" in item && (
                <div className="mt-5 max-w-sm">
                  <AdminBrandStatusSelect
                    value={item.brandStatus}
                    onChange={(brandStatus) =>
                      updateTrainerBrandStatus(item.id, brandStatus)
                    }
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </PanelSection>
  );
}

export function TrainerDirectoryPage() {
  return <PeoplePage kind="trainer" />;
}

export function OrganizerDirectoryPage() {
  return <PeoplePage kind="organizer" />;
}

export function UserManagementPage() {
  const {
    currentUser,
    store,
    updateUserModeratorRole,
    updateUserOrganizerFunctionsBlocked,
  } = useAppState();

  if (!currentUser || !hasModeratorAccess(currentUser)) {
    return (
      <PanelSection
        eyebrow="Konta"
        title="Konta i blokady"
        description="Ten ekran jest dostępny tylko dla moderatora albo admina."
      >
        <EmptyPanelState
          title="Brak dostępu"
          description="Moderator lub admin może zarządzać blokadami organizatora i rolą moderatora."
        />
      </PanelSection>
    );
  }

  const canGrantModeratorRole = currentUser.role === "admin";
  const users = [...store.users]
    .filter((user) => user.id !== currentUser.id || currentUser.role === "admin")
    .sort((left, right) => left.displayName.localeCompare(right.displayName, "pl"));

  return (
    <PanelSection
      eyebrow="Konta"
      title="Konta i blokady"
      description="Moderator może blokować funkcje organizatora bez odpinania relacji. Admin dodatkowo nadaje i odbiera rolę moderatora."
    >
      <div className="space-y-4">
        {users.map((user) => {
          const userRoles = Array.from(new Set<AppRole>(["participant", ...(user.roles ?? [])])).sort(
            (left, right) => getRoleLabel(left).localeCompare(getRoleLabel(right), "pl"),
          );
          const organizerProfile = store.organizers.find((item) => item.userId === user.id);
          const organizerFunctionsAreBlocked = isOrganizerFunctionsBlocked(user);
          const canToggleOrganizerBlock = Boolean(organizerProfile);
          const hasModeratorRole = user.roles?.includes("moderator") ?? false;

          return (
            <article
              key={user.id}
              className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-brand-navy">{user.displayName}</p>
                  <div className="mt-3 space-y-1 text-sm text-brand-muted">
                    <p>{user.email ?? "Konto bez emaila"}</p>
                    <p>{user.phone}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {userRoles.map((role) => (
                    <span
                      key={`${user.id}-${role}`}
                      className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy"
                    >
                      {getRoleLabel(role)}
                    </span>
                  ))}
                  {organizerFunctionsAreBlocked ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">
                      organizer zablokowany
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {canGrantModeratorRole && user.role !== "admin" ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await updateUserModeratorRole(user.id, !hasModeratorRole);
                        toast.success(
                          hasModeratorRole
                            ? "Rola moderatora została odebrana."
                            : "Rola moderatora została nadana.",
                        );
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zmienić roli moderatora.",
                        );
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
                  >
                    <ShieldCheck size={16} />
                    {hasModeratorRole ? "Odbierz moderatora" : "Nadaj moderatora"}
                  </button>
                ) : null}

                {canToggleOrganizerBlock ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await updateUserOrganizerFunctionsBlocked(
                          user.id,
                          !organizerFunctionsAreBlocked,
                        );
                        toast.success(
                          organizerFunctionsAreBlocked
                            ? "Odblokowano funkcje organizatora."
                            : "Zablokowano funkcje organizatora.",
                        );
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zmienić blokady organizatora.",
                        );
                      }
                    }}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold ${
                      organizerFunctionsAreBlocked
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    <Users size={16} />
                    {organizerFunctionsAreBlocked
                      ? "Odblokuj organizatora"
                      : "Zablokuj organizatora"}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </PanelSection>
  );
}
