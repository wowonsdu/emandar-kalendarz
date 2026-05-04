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
  ChevronUp,
  ChevronsUpDown,
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

type SortDirection = "asc" | "desc";
type GroupSortKey =
  | "name"
  | "nearest"
  | "members"
  | "events"
  | "trainer"
  | "organizer"
  | "status";
type GroupSortState = {
  key: GroupSortKey;
  direction: SortDirection;
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

function getGroupDetailTitle(group: Pick<Group, "name" | "defaultEventType">) {
  const eventTypeLabel = getGroupEventTypeLabel(group.defaultEventType).toLocaleLowerCase("pl");

  return `${group.name} / ${eventTypeLabel}`;
}

function getShortProfileName(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  const shortened = trimmed.replace(/^(trener|trenerka|organizator|organizatorka)\s+/i, "");

  return shortened.trim() || trimmed;
}

function sortGroupsByStatusAndName(groups: Group[]) {
  return [...groups].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "active" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "pl");
  });
}

function normalizeListSearchText(value: string) {
  return value
    .toLocaleLowerCase("pl")
    .replace(/[łŁ]/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function compareListText(left: string, right: string) {
  return left.localeCompare(right, "pl", { numeric: true, sensitivity: "base" });
}

function applySortDirection(value: number, direction: SortDirection) {
  return direction === "asc" ? value : -value;
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
            "break-words text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] text-brand-muted sm:text-sm sm:tracking-[0.2em]",
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


function GroupListStatusBadges({
  group,
  isOwnedGroup,
  isParticipantGroupViewer,
}: {
  group: Group;
  isOwnedGroup: boolean;
  isParticipantGroupViewer: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full bg-brand-shell px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-navy">
        {group.status === "active" ? "Aktywna" : "Archiwum"}
      </span>
      {isOwnedGroup && !isParticipantGroupViewer ? (
        <span className="rounded-full border border-brand-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-navy">
          Twoja grupa
        </span>
      ) : null}
    </div>
  );
}

function GroupListMobileCard({
  activeMemberCount,
  eventCount,
  group,
  isOwnedGroup,
  isParticipantGroupViewer,
  nearestEventLabel,
  onOpenGroup,
  organizerName,
  trainerName,
}: {
  activeMemberCount: number;
  eventCount: number;
  group: Group;
  isOwnedGroup: boolean;
  isParticipantGroupViewer: boolean;
  nearestEventLabel: string | null;
  onOpenGroup: () => void;
  organizerName: string;
  trainerName: string;
}) {
  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Otwórz grupę ${group.name}`}
      onClick={onOpenGroup}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
          keyEvent.preventDefault();
          onOpenGroup();
        }
      }}
      className="cursor-pointer rounded-[2rem] border border-brand-line bg-white p-5 shadow-soft transition-colors hover:bg-brand-shell/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug text-brand-navy">{group.name}</h3>
          <p className="mt-1 text-sm font-semibold text-brand-sky-deep">
            {getGroupEventTypeLabel(group.defaultEventType)}
          </p>
        </div>
        <GroupListStatusBadges
          group={group}
          isOwnedGroup={isOwnedGroup}
          isParticipantGroupViewer={isParticipantGroupViewer}
        />
      </div>

      <div className="mt-4 grid gap-3 text-sm text-brand-muted sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
            Najbliższe
          </p>
          <p className="mt-1 font-semibold text-brand-navy">
            {nearestEventLabel ?? "Brak nadchodzącego szkolenia"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
            Trener
          </p>
          <p className="mt-1 font-semibold text-brand-navy">{trainerName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
            Organizator
          </p>
          <p className="mt-1 font-semibold text-brand-navy">{organizerName}</p>
        </div>
        <p>{activeMemberCount} aktywnych osób</p>
        <p>
          {eventCount} {eventCount === 1 ? "wydarzenie" : "wydarzeń"}
        </p>
      </div>
    </article>
  );
}

export function GroupsPage() {
  const {
    addGroupMember,
    archiveGroup,
    createGroup,
    currentUser,
    removeGroupMember,
    store,
    updateGroup,
    updateGroupMember,
  } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(createEmptyGroupFormState());
  const [memberForm, setMemberForm] = useState<GroupMemberFormState>(
    createEmptyGroupMemberFormState(),
  );
  const [memberDrafts, setMemberDrafts] = useState<Record<string, GroupMemberDraftState>>({});
  const [memberSaveStates, setMemberSaveStates] = useState<Record<string, GroupMemberSaveState>>(
    {},
  );
  const [isArchivedGroupsOpen, setIsArchivedGroupsOpen] = useState(false);
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [groupScope, setGroupScope] = useState<"all" | "mine">("mine");
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupSort, setGroupSort] = useState<GroupSortState | null>(null);
  const [groupDetailTab, setGroupDetailTab] = useState<"members" | "events">("members");
  const memberDraftsRef = useRef(memberDrafts);
  const memberSaveTimeoutsRef = useRef<Record<string, number>>({});
  const savingMemberIdsRef = useRef<Record<string, boolean>>({});
  const queuedMemberSaveIdsRef = useRef<Record<string, boolean>>({});

  if (!currentUser) {
    return null;
  }

  const organizerProfile = store.organizers.find((item) => item.userId === currentUser.id);
  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const hasActiveOrganizerAccess = Boolean(
    organizerProfile &&
      (store.relations ?? []).some(
        (relation) =>
          relation.organizerId === organizerProfile.id && relation.status === "approved",
      ),
  );
  const canManageOrganizerGroups =
    Boolean(organizerProfile) && hasActiveOrganizerAccess && canUseOrganizerFunctions(currentUser);
  const canManageTrainerGroups =
    hasInheritedRole(currentUser, "trainer") && Boolean(trainerProfile);
  const canManageGroups = canManageOrganizerGroups || canManageTrainerGroups;
  const trainersById = useMemo(
    () => new Map((store.trainers ?? []).map((trainer) => [trainer.id, trainer])),
    [store.trainers],
  );
  const organizersById = useMemo(
    () => new Map((store.organizers ?? []).map((organizer) => [organizer.id, organizer])),
    [store.organizers],
  );
  const participantProfilesById = useMemo(
    () =>
      new Map((store.participantProfiles ?? []).map((profile) => [profile.id, profile])),
    [store.participantProfiles],
  );
  const participantProfilesByPhoneLookupKey = useMemo(
    () =>
      new Map(
        (store.participantProfiles ?? []).map((profile) => [profile.phoneLookupKey, profile]),
      ),
    [store.participantProfiles],
  );
  const activeMemberCounts = useMemo(
    () =>
      (store.groupMembers ?? []).reduce<Record<string, number>>((accumulator, member) => {
        if (member.membershipStatus !== "active") {
          return accumulator;
        }

        accumulator[member.groupId] = (accumulator[member.groupId] ?? 0) + 1;
        return accumulator;
      }, {}),
    [store.groupMembers],
  );
  const participantGroupMembershipsByGroupId = useMemo(() => {
    if (!currentUser.participantProfileId) {
      return new Map<string, GroupMember>();
    }

    return new Map(
      (store.groupMembers ?? [])
        .filter(
          (member) =>
            member.participantProfileId === currentUser.participantProfileId &&
            member.membershipStatus === "active",
        )
        .map((member) => [member.groupId, member]),
    );
  }, [currentUser.participantProfileId, store.groupMembers]);
  const groupEventCounts = useMemo(
    () =>
      (store.trainingEvents ?? []).reduce<Record<string, number>>((accumulator, event) => {
        if (!event.groupId || isTrainingEventArchived(event)) {
          return accumulator;
        }

        accumulator[event.groupId] = (accumulator[event.groupId] ?? 0) + 1;
        return accumulator;
      }, {}),
    [store.trainingEvents],
  );
  const nearestGroupEventLabels = useMemo(
    () => {
      const nextLabels: Record<string, string> = {};

      for (const event of sortEventsByDate(
        (store.trainingEvents ?? []).filter(
          (item) =>
            Boolean(item.groupId) &&
            !isTrainingEventArchived(item) &&
            new Date(item.startsAt).getTime() > Date.now(),
        ),
      )) {
        if (!event.groupId || nextLabels[event.groupId]) {
          continue;
        }

        nextLabels[event.groupId] = getPanelScheduleRangeLabel(event);
      }

      return nextLabels;
    },
    [store.trainingEvents],
  );
  const nearestGroupEventTimestamps = useMemo(
    () => {
      const nextTimestamps: Record<string, number> = {};

      for (const event of sortEventsByDate(
        (store.trainingEvents ?? []).filter(
          (item) =>
            Boolean(item.groupId) &&
            !isTrainingEventArchived(item) &&
            new Date(item.startsAt).getTime() > Date.now(),
        ),
      )) {
        if (!event.groupId || nextTimestamps[event.groupId]) {
          continue;
        }

        nextTimestamps[event.groupId] = new Date(event.startsAt).getTime();
      }

      return nextTimestamps;
    },
    [store.trainingEvents],
  );
  const managedGroups = useMemo(
    () =>
      getManagedGroupsForUser({
        currentUser,
        groups: store.groups ?? [],
        organizerProfileId: organizerProfile?.id,
        trainerProfileId: trainerProfile?.id,
      }),
    [currentUser, organizerProfile?.id, store.groups, trainerProfile?.id],
  );
  const joinedGroups = useMemo(
    () =>
      sortGroupsByStatusAndName(
        (store.groups ?? []).filter((group) =>
          participantGroupMembershipsByGroupId.has(group.id),
        ),
      ),
    [participantGroupMembershipsByGroupId, store.groups],
  );
  const hasManagedGroupScope =
    managedGroups.length > 0 ||
    (Boolean(organizerProfile) && hasInheritedRole(currentUser, "organizer")) ||
    (Boolean(trainerProfile) && hasInheritedRole(currentUser, "trainer"));
  const isParticipantGroupListScope = !hasManagedGroupScope || groupScope === "all";
  const visibleGroups = useMemo(() => {
    if (isParticipantGroupListScope) {
      return joinedGroups;
    }

    return managedGroups;
  }, [isParticipantGroupListScope, joinedGroups, managedGroups]);
  const detailAccessibleGroups = useMemo(() => {
    const groupsById = new Map<string, Group>();

    for (const group of managedGroups) {
      groupsById.set(group.id, group);
    }

    for (const group of joinedGroups) {
      groupsById.set(group.id, group);
    }

    return [...groupsById.values()];
  }, [joinedGroups, managedGroups]);
  const normalizedGroupSearchQuery = normalizeListSearchText(groupSearchQuery.trim());
  const isGroupSearchApplied = normalizedGroupSearchQuery.length >= 3;
  const filteredVisibleGroups = useMemo(() => {
    if (!isGroupSearchApplied) {
      return visibleGroups;
    }

    return visibleGroups.filter((group) => {
      const trainerName = trainersById.get(group.trainerId)?.displayName ?? "";
      const organizerName = organizersById.get(group.organizerId)?.displayName ?? "";
      const searchHaystack = normalizeListSearchText(
        [group.name, trainerName, organizerName].join(" "),
      );

      return searchHaystack.includes(normalizedGroupSearchQuery);
    });
  }, [
    isGroupSearchApplied,
    normalizedGroupSearchQuery,
    organizersById,
    trainersById,
    visibleGroups,
  ]);
  const sortedVisibleGroups = useMemo(() => {
    if (!groupSort) {
      return filteredVisibleGroups;
    }

    return [...filteredVisibleGroups].sort((left, right) => {
      let result = 0;

      switch (groupSort.key) {
        case "name":
          result = compareListText(left.name, right.name);
          break;
        case "nearest":
          result =
            (nearestGroupEventTimestamps[left.id] ?? Number.POSITIVE_INFINITY) -
            (nearestGroupEventTimestamps[right.id] ?? Number.POSITIVE_INFINITY);
          break;
        case "members":
          result = (activeMemberCounts[left.id] ?? 0) - (activeMemberCounts[right.id] ?? 0);
          break;
        case "events":
          result = (groupEventCounts[left.id] ?? 0) - (groupEventCounts[right.id] ?? 0);
          break;
        case "trainer":
          result = compareListText(
            trainersById.get(left.trainerId)?.displayName ?? "",
            trainersById.get(right.trainerId)?.displayName ?? "",
          );
          break;
        case "organizer":
          result = compareListText(
            organizersById.get(left.organizerId)?.displayName ?? "",
            organizersById.get(right.organizerId)?.displayName ?? "",
          );
          break;
        case "status":
          result = compareListText(left.status, right.status);
          break;
      }

      if (result === 0) {
        result = compareListText(left.name, right.name);
      }

      return applySortDirection(result, groupSort.direction);
    });
  }, [
    activeMemberCounts,
    filteredVisibleGroups,
    groupEventCounts,
    groupSort,
    nearestGroupEventTimestamps,
    organizersById,
    trainersById,
  ]);
  const { active: activeVisibleGroups, archived: archivedVisibleGroups } = useMemo(
    () => splitGroupsByArchivedStatus(sortedVisibleGroups),
    [sortedVisibleGroups],
  );
  const isCreateGroupRoute = location.pathname === "/panel/grupy/utworz";
  const isGroupDetailView = Boolean(groupId);
  const selectedGroup = groupId
    ? detailAccessibleGroups.find((group) => group.id === groupId) ?? null
    : null;
  const selectedGroupMembers = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    return (store.groupMembers ?? [])
      .filter(
        (member) => member.groupId === selectedGroup.id && member.membershipStatus === "active",
      );
  }, [selectedGroup, store.groupMembers]);
  const selectedGroupMembersById = useMemo(
    () => new Map(selectedGroupMembers.map((member) => [member.id, member])),
    [selectedGroupMembers],
  );
  const selectedGroupMemberSections = useMemo(() => {
    let rowIndex = 0;
    const effectiveMembers = selectedGroupMembers.map((member) => ({
      id: member.id,
      member,
      priority: memberDrafts[member.id]?.priority ?? member.priority,
      participantDisplayName: member.participantDisplayName,
    }));

    return groupParticipantRecordsByPriority(effectiveMembers).map((section) => ({
      priority: section.priority,
      members: section.records.map((record) => ({
        member: record.member,
        rowIndex: rowIndex++,
      })),
    }));
  }, [memberDrafts, selectedGroupMembers]);
  const selectedGroupEvents = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    return sortEventsByDate(
      (store.trainingEvents ?? []).filter((event) => event.groupId === selectedGroup.id),
    );
  }, [selectedGroup, store.trainingEvents]);
  const selectedGroupFutureOpenEvents = useMemo(
    () =>
      selectedGroupEvents.filter(
        (event) =>
          !isTrainingEventArchived(event) &&
          !event.rosterFinalizedAt &&
          new Date(event.startsAt).getTime() > Date.now(),
      ),
    [selectedGroupEvents],
  );
  const availableTrainers = useMemo(() => {
    const nextTrainers = new Map<string, TrainerProfile>();

    if (canManageTrainerGroups && trainerProfile) {
      nextTrainers.set(trainerProfile.id, trainerProfile);
    }

    if (canManageOrganizerGroups && organizerProfile) {
      for (const relation of store.relations ?? []) {
        if (relation.organizerId !== organizerProfile.id || relation.status !== "approved") {
          continue;
        }

        const trainer = trainersById.get(relation.trainerId);
        if (trainer) {
          nextTrainers.set(trainer.id, trainer);
        }
      }
    }

    return sortTrainerProfiles([...nextTrainers.values()]);
  }, [
    canManageOrganizerGroups,
    canManageTrainerGroups,
    organizerProfile,
    store.relations,
    trainerProfile,
    trainersById,
  ]);
  const canCreateGroups = canManageGroups && availableTrainers.length > 0;
  const managedParticipantProfiles = useMemo(() => {
    if (!canManageGroups) {
      return [];
    }

    return (store.participantProfiles ?? [])
      .filter(
        (profile) =>
          (organizerProfile &&
            (profile.createdByOrganizerId === organizerProfile.id ||
              profile.managerOrganizerIds?.includes(organizerProfile.id))) ||
          (trainerProfile && profile.managerTrainerIds?.includes(trainerProfile.id)),
        )
      .sort((left, right) => left.displayName.localeCompare(right.displayName, "pl"));
  }, [canManageGroups, organizerProfile, store.participantProfiles, trainerProfile]);
  const selectedMemberProfile = useMemo(
    () =>
      memberForm.participantProfileId
        ? participantProfilesById.get(memberForm.participantProfileId) ?? null
        : null,
    [memberForm.participantProfileId, participantProfilesById],
  );
  const memberProfileOptions = useMemo(() => {
    if (!selectedMemberProfile) {
      return managedParticipantProfiles;
    }

    return managedParticipantProfiles.some((profile) => profile.id === selectedMemberProfile.id)
      ? managedParticipantProfiles
      : [selectedMemberProfile, ...managedParticipantProfiles];
  }, [managedParticipantProfiles, selectedMemberProfile]);
  const shouldShowMemberDetails =
    Boolean(selectedMemberProfile) || hasCompleteParticipantPhone(memberForm.phone);
  const selectedGroupIsManagedByCurrentUser = Boolean(
    selectedGroup && managedGroups.some((group) => group.id === selectedGroup.id),
  );
  const isParticipantGroupViewer =
    isGroupDetailView && selectedGroup
      ? !selectedGroupIsManagedByCurrentUser || groupScope === "all"
      : isParticipantGroupListScope;

  useEffect(() => {
    if (!hasManagedGroupScope && groupScope !== "all") {
      setGroupScope("all");
    }
  }, [groupScope, hasManagedGroupScope]);

  useEffect(() => {
    setGroupDetailTab("members");
  }, [groupId]);

  useEffect(() => {
    if (!canCreateGroups || editingGroupId || groupForm.trainerId || availableTrainers.length === 0) {
      return;
    }

    setGroupForm((previous) => ({
      ...previous,
      trainerId: availableTrainers[0].id,
    }));
  }, [availableTrainers, canCreateGroups, editingGroupId, groupForm.trainerId]);

  useEffect(() => {
    memberDraftsRef.current = memberDrafts;
  }, [memberDrafts]);

  useEffect(() => {
    const selectedMemberIds = new Set(selectedGroupMembers.map((member) => member.id));

    setMemberDrafts((previous) => {
      let changed = false;
      const next: Record<string, GroupMemberDraftState> = {};

      for (const [memberId, draft] of Object.entries(previous)) {
        const member = selectedGroupMembersById.get(memberId);
        if (member && hasGroupMemberDraftChanges(member, draft)) {
          next[memberId] = draft;
        } else {
          changed = true;
        }
      }

      return changed ? next : previous;
    });

    setMemberSaveStates((previous) => {
      let changed = false;
      const next: Record<string, GroupMemberSaveState> = {};

      for (const [memberId, state] of Object.entries(previous)) {
        if (selectedMemberIds.has(memberId) && state.status !== "idle") {
          next[memberId] = state;
        } else {
          changed = true;
        }
      }

      return changed ? next : previous;
    });

    setExpandedMemberIds((previous) => {
      const next = previous.filter((memberId) => selectedMemberIds.has(memberId));
      return next.length === previous.length ? previous : next;
    });
  }, [selectedGroupMembers, selectedGroupMembersById]);

  useEffect(() => {
    return () => {
      Object.values(memberSaveTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  function resetGroupForm() {
    setEditingGroupId(null);
    setGroupForm(createEmptyGroupFormState(availableTrainers[0]?.id ?? ""));
  }

  const isCreateGroupFormVisible = canCreateGroups && !isGroupDetailView && isCreateGroupRoute;
  const isEditGroupFormVisible =
    canManageGroups &&
    isGroupDetailView &&
    Boolean(selectedGroup) &&
    editingGroupId === selectedGroup.id;

  function updateMemberSaveState(memberId: string, nextState: GroupMemberSaveState) {
    setMemberSaveStates((previous) => {
      const current = previous[memberId];
      if (current?.status === nextState.status && current?.message === nextState.message) {
        return previous;
      }

      return {
        ...previous,
        [memberId]: nextState,
      };
    });
  }

  function clearMemberSaveFeedbackTimer(memberId: string) {
    const timeoutId = memberSaveTimeoutsRef.current[memberId];
    if (!timeoutId) {
      return;
    }

    window.clearTimeout(timeoutId);
    delete memberSaveTimeoutsRef.current[memberId];
  }

  function queueSavedMemberFeedbackReset(memberId: string) {
    clearMemberSaveFeedbackTimer(memberId);
    memberSaveTimeoutsRef.current[memberId] = window.setTimeout(() => {
      setMemberSaveStates((previous) => {
        if (previous[memberId]?.status !== "saved") {
          return previous;
        }

        const next = { ...previous };
        delete next[memberId];
        return next;
      });
      delete memberSaveTimeoutsRef.current[memberId];
    }, GROUP_MEMBER_SAVE_FEEDBACK_MS);
  }

  function setMemberDraft(member: GroupMember, patch: Partial<GroupMemberDraftState>) {
    const nextDraft = {
      ...(memberDraftsRef.current[member.id] ?? createGroupMemberDraftState(member)),
      ...patch,
    };

    setMemberDrafts((previous) => ({
      ...previous,
      [member.id]: nextDraft,
    }));
    updateMemberSaveState(member.id, { status: "idle" });

    return nextDraft;
  }

  async function persistGroupMemberChanges(memberId: string, explicitDraft?: GroupMemberDraftState) {
    const member = selectedGroupMembersById.get(memberId);
    if (!member) {
      return;
    }

    const draft = explicitDraft ?? memberDraftsRef.current[memberId] ?? createGroupMemberDraftState(member);
    if (!hasGroupMemberDraftChanges(member, draft)) {
      setMemberDrafts((previous) => {
        if (!(memberId in previous)) {
          return previous;
        }

        const next = { ...previous };
        delete next[memberId];
        return next;
      });
      clearMemberSaveFeedbackTimer(memberId);
      setMemberSaveStates((previous) => {
        if (!(memberId in previous)) {
          return previous;
        }

        const next = { ...previous };
        delete next[memberId];
        return next;
      });
      return;
    }

    if (savingMemberIdsRef.current[memberId]) {
      queuedMemberSaveIdsRef.current[memberId] = true;
      return;
    }

    savingMemberIdsRef.current[memberId] = true;
    queuedMemberSaveIdsRef.current[memberId] = false;
    clearMemberSaveFeedbackTimer(memberId);
    updateMemberSaveState(memberId, { status: "saving" });

    try {
      await updateGroupMember({
        memberId,
        priority: draft.priority,
        notes: draft.notes,
      });

      updateMemberSaveState(memberId, { status: "saved" });
      queueSavedMemberFeedbackReset(memberId);
    } catch (error) {
      updateMemberSaveState(memberId, {
        status: "error",
        message: error instanceof Error ? error.message : "Nie udało się zapisać zmian.",
      });
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać zmian.");
    } finally {
      savingMemberIdsRef.current[memberId] = false;

      if (queuedMemberSaveIdsRef.current[memberId]) {
        queuedMemberSaveIdsRef.current[memberId] = false;
        window.setTimeout(() => {
          void persistGroupMemberChanges(memberId);
        }, 0);
      }
    }
  }

  function toggleExpandedMember(memberId: string, open: boolean) {
    setExpandedMemberIds((previous) => {
      if (open) {
        return previous.includes(memberId) ? previous : [...previous, memberId];
      }

      return previous.filter((id) => id !== memberId);
    });
  }

  function getMemberSaveStateLabel(memberId: string) {
    const state = memberSaveStates[memberId];
    switch (state?.status) {
      case "saving":
        return "Zapisywanie...";
      case "saved":
        return "Zapisano";
      case "error":
        return state.message ?? "Błąd zapisu";
      default:
        return null;
    }
  }

  function toggleGroupSort(key: GroupSortKey) {
    setGroupSort((previous) => {
      if (previous?.key === key) {
        return {
          key,
          direction: previous.direction === "asc" ? "desc" : "asc",
        };
      }

      return { key, direction: "asc" };
    });
  }

  function renderGroupSortHeader(
    key: GroupSortKey,
    label: string,
    className = "px-4 py-4",
  ) {
    const isActive = groupSort?.key === key;
    const SortIcon = isActive
      ? groupSort.direction === "desc"
        ? ChevronDown
        : ChevronUp
      : ChevronsUpDown;
    const directionLabel = isActive
      ? groupSort.direction === "desc"
        ? "malejąco"
        : "rosnąco"
      : "bez wybranego sortowania";

    return (
      <th className={className}>
        <button
          type="button"
          onClick={() => toggleGroupSort(key)}
          className={cn(
            "inline-flex w-full items-center gap-1.5 text-left uppercase tracking-[0.18em] transition-colors hover:text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky",
            className.includes("text-center") ? "justify-center" : "justify-start",
          )}
          aria-label={`Sortuj po kolumnie ${label}, ${directionLabel}`}
        >
          <span>{label}</span>
          <SortIcon
            aria-hidden="true"
            size={14}
            strokeWidth={2.4}
            className={isActive ? "text-brand-sky-deep" : "text-brand-muted"}
          />
        </button>
      </th>
    );
  }

  function renderGroupRows(groups: Group[]) {
    return (
      <div>
        <div className="space-y-4 lg:hidden">
          {groups.map((group) => {
            const trainerName = trainersById.get(group.trainerId)?.displayName ?? "Trener";
            const organizerName =
              organizersById.get(group.organizerId)?.displayName ?? "Organizator";
            const isOwnedGroup = managedGroups.some((managedGroup) => managedGroup.id === group.id);

            return (
              <GroupListMobileCard
                key={group.id}
                activeMemberCount={activeMemberCounts[group.id] ?? 0}
                eventCount={groupEventCounts[group.id] ?? 0}
                group={group}
                isOwnedGroup={isOwnedGroup}
                isParticipantGroupViewer={isParticipantGroupViewer}
                nearestEventLabel={nearestGroupEventLabels[group.id] ?? null}
                onOpenGroup={() => {
                  void navigate(`/panel/grupy/${group.id}`);
                }}
                organizerName={organizerName}
                trainerName={trainerName}
              />
            );
          })}
        </div>

        <div className="hidden overflow-hidden rounded-[1.5rem] border border-brand-line bg-white shadow-soft lg:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[7%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead className="bg-brand-shell/75 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
                <tr>
                  {renderGroupSortHeader("name", "Grupa", "px-5 py-4")}
                  {renderGroupSortHeader("nearest", "Najbliższe")}
                  {renderGroupSortHeader("members", "Osoby", "px-3 py-4 text-center")}
                  {renderGroupSortHeader("events", "Wydarzenia", "px-3 py-4 text-center")}
                  {renderGroupSortHeader("trainer", "Trener")}
                  {renderGroupSortHeader("organizer", "Organizator")}
                  {renderGroupSortHeader("status", "Status")}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {groups.map((group) => {
                  const trainerName = trainersById.get(group.trainerId)?.displayName ?? "Trener";
                  const organizerName =
                    organizersById.get(group.organizerId)?.displayName ?? "Organizator";
                  const isOwnedGroup = managedGroups.some(
                    (managedGroup) => managedGroup.id === group.id,
                  );
                  const groupDetailPath = `/panel/grupy/${group.id}`;

                  return (
                    <tr
                      key={group.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Otwórz grupę ${group.name}`}
                      onClick={() => {
                        void navigate(groupDetailPath);
                      }}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                          keyEvent.preventDefault();
                          void navigate(groupDetailPath);
                        }
                      }}
                      className="cursor-pointer align-top transition-colors hover:bg-brand-shell/45 focus-visible:bg-brand-shell/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-sky"
                    >
                      <td className="max-w-[22rem] px-5 py-5">
                        <p className="text-lg font-semibold leading-snug text-brand-navy">
                          {group.name}
                        </p>
                        <p className="mt-1 line-clamp-1 text-sm font-semibold text-brand-sky-deep">
                          {getGroupEventTypeLabel(group.defaultEventType)}
                        </p>
                      </td>
                      <td className="px-4 py-5 text-sm font-semibold text-brand-navy">
                        <span className="line-clamp-2">
                          {nearestGroupEventLabels[group.id] ?? "Brak nadchodzącego szkolenia"}
                        </span>
                      </td>
                      <td className="px-3 py-5 text-center text-sm font-semibold text-brand-navy">
                        {activeMemberCounts[group.id] ?? 0}
                      </td>
                      <td className="px-3 py-5 text-center text-sm font-semibold text-brand-navy">
                        {groupEventCounts[group.id] ?? 0}
                      </td>
                      <td className="px-4 py-5 text-sm text-brand-muted">
                        <span className="line-clamp-2">{trainerName}</span>
                      </td>
                      <td className="px-4 py-5 text-sm text-brand-muted">
                        <span className="line-clamp-2">{organizerName}</span>
                      </td>
                      <td className="px-4 py-5">
                        <GroupListStatusBadges
                          group={group}
                          isOwnedGroup={isOwnedGroup}
                          isParticipantGroupViewer={isParticipantGroupViewer}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function getMemberSaveStateTone(memberId: string) {
    switch (memberSaveStates[memberId]?.status) {
      case "saving":
        return "text-brand-muted";
      case "saved":
        return "text-emerald-700";
      case "error":
        return "text-red-700";
      default:
        return "text-brand-muted";
    }
  }

  async function handleSaveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!groupForm.trainerId) {
      toast.error("Wybierz trenera grupy.");
      return;
    }

    try {
      setSavingGroup(true);

      const payload = {
        name: groupForm.name,
        trainerId: groupForm.trainerId,
        notes: groupForm.notes,
        defaultLocation: groupForm.defaultLocation,
        defaultEventType: groupForm.defaultEventType,
        defaultCapacity: Number(groupForm.defaultCapacity) || 20,
        defaultTags: parseEventTags(groupForm.defaultTagsText),
        defaultConfirmationLeadTimeDays:
          Number(groupForm.defaultConfirmationLeadTimeDays) >= 0
            ? Number(groupForm.defaultConfirmationLeadTimeDays)
            : 7,
        defaultJoinAudience: groupForm.defaultJoinAudience,
      };

      if (editingGroupId) {
        await updateGroup({
          groupId: editingGroupId,
          ...payload,
        });
        toast.success("Zapisano ustawienia grupy.");
        navigate(`/panel/grupy/${editingGroupId}`, { replace: true });
      } else {
        const result = await createGroup(payload);
        toast.success("Utworzono nową grupę.");
        navigate(`/panel/grupy/${result.groupId}`);
      }

      resetGroupForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać grupy.");
    } finally {
      setSavingGroup(false);
    }
  }

  async function handleArchiveSelectedGroup() {
    if (!selectedGroup) {
      return;
    }

    try {
      await archiveGroup(selectedGroup.id);
      toast.success("Grupa została zarchiwizowana.");
      if (editingGroupId === selectedGroup.id) {
        resetGroupForm();
      }
      navigate("/panel/grupy", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zarchiwizować grupy.");
    }
  }

  function handleMemberPhoneChange(event: ChangeEvent<HTMLInputElement>) {
    const nextPhone = event.target.value;
    const nextPhoneLookupKey = normalizeParticipantPhoneLookupKey(nextPhone);
    const matchedProfile =
      nextPhoneLookupKey.length >= 11
        ? participantProfilesByPhoneLookupKey.get(nextPhoneLookupKey) ?? null
        : null;

    setMemberForm((previous) => {
      if (matchedProfile) {
        return applyParticipantProfileToGroupMemberForm(previous, matchedProfile);
      }

      return {
        ...previous,
        participantProfileId: "",
        phone: nextPhone,
        displayName: previous.participantProfileId ? "" : previous.displayName,
        referralSource: previous.participantProfileId ? "" : previous.referralSource,
      };
    });
  }

  function handleMemberProfileSelect(event: ChangeEvent<HTMLSelectElement>) {
    const nextProfileId = event.target.value;
    if (!nextProfileId) {
      setMemberForm((previous) => ({
        ...previous,
        participantProfileId: "",
        displayName: "",
        phone: "",
        referralSource: "",
      }));
      return;
    }

    const selectedProfile = participantProfilesById.get(nextProfileId);
    if (!selectedProfile) {
      return;
    }

    setMemberForm((previous) => applyParticipantProfileToGroupMemberForm(previous, selectedProfile));
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedGroup) {
      toast.error("Najpierw wybierz grupę.");
      return;
    }

    if (!selectedMemberProfile && !hasCompleteParticipantPhone(memberForm.phone)) {
      toast.error("Wpisz pełny numer telefonu uczestnika albo wybierz istniejący profil.");
      return;
    }

    if (!selectedMemberProfile && !memberForm.displayName.trim()) {
      toast.error("Podaj imię i nazwisko nowego uczestnika.");
      return;
    }

    try {
      setSavingMember(true);
      const shouldSyncFutureEvents =
        selectedGroupFutureOpenEvents.length > 0
          ? window.confirm(
              `Dodać tę osobę automatycznie także do ${selectedGroupFutureOpenEvents.length} przyszłych otwartych szkoleń tej grupy?`,
            )
          : false;
      await addGroupMember({
        groupId: selectedGroup.id,
        participantProfileId: memberForm.participantProfileId || undefined,
        displayName: selectedMemberProfile ? undefined : memberForm.displayName,
        phone: memberForm.phone,
        notes: memberForm.notes,
        referralSource: selectedMemberProfile ? undefined : memberForm.referralSource,
        priority: memberForm.priority,
        syncFutureEvents: shouldSyncFutureEvents,
      });
      toast.success("Dodano członka grupy.");
      setMemberForm(createEmptyGroupMemberFormState());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać członka.");
    } finally {
      setSavingMember(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await removeGroupMember(memberId);
      toast.success("Usunięto członka z grupy.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się usunąć członka.");
    }
  }

  if (isCreateGroupRoute && !canCreateGroups) {
    return <Navigate to="/panel/grupy" replace />;
  }

  if (isGroupDetailView && !selectedGroup) {
    return <Navigate to="/panel/grupy" replace />;
  }

  return (
    <PanelSection
      eyebrow="Grupy"
      title={
        isCreateGroupRoute
          ? "Nowa grupa"
          : isGroupDetailView && selectedGroup
            ? getGroupDetailTitle(selectedGroup)
            : "Grupy Emandar"
      }
      description={
        isCreateGroupRoute
          ? undefined
          : isGroupDetailView
            ? undefined
            : isParticipantGroupViewer
              ? undefined
              : canManageGroups
                ? undefined
                : "To Twoje grupy. Obecnie masz do nich tylko dostęp podglądowy."
      }
      showLeadText={isCreateGroupRoute || isGroupDetailView}
      action={
        isCreateGroupRoute ? undefined : isGroupDetailView ? (
          canManageGroups && selectedGroup && selectedGroupIsManagedByCurrentUser ? (
            <div className="flex flex-wrap gap-2 sm:gap-3 lg:justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingGroupId(selectedGroup.id);
                  setGroupForm(createGroupFormStateFromGroup(selectedGroup));
                }}
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy shadow-soft sm:px-5"
              >
                <ShieldCheck size={16} />
                Edytuj grupę
              </button>
              <Link
                to={getGroupTrainingCreatePath(selectedGroup.id)}
                state={{ headerBackPath: `/panel/grupy/${selectedGroup.id}` }}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-3 text-sm font-semibold text-white shadow-soft sm:px-5"
              >
                <CalendarDays size={16} />
                Utwórz wydarzenie
              </Link>
              <button
                type="button"
                onClick={() => void handleArchiveSelectedGroup()}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-soft sm:px-5"
              >
                <Trash2 size={16} />
                Archiwizuj
              </button>
            </div>
          ) : undefined
        ) : undefined
      }
    >
      {isCreateGroupFormVisible ? (
        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <form onSubmit={handleSaveGroup} className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 lg:col-span-2">
              <span className="text-sm font-semibold text-brand-navy">Nazwa grupy</span>
              <input
                required
                value={groupForm.name}
                onChange={(event) =>
                  setGroupForm((previous) => ({ ...previous, name: event.target.value }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Trener</span>
              <select
                value={groupForm.trainerId}
                onChange={(event) =>
                  setGroupForm((previous) => ({ ...previous, trainerId: event.target.value }))
                }
                disabled={Boolean(editingGroupId)}
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
              >
                <option value="">Wybierz trenera</option>
                {availableTrainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Domyślna lokalizacja</span>
              <input
                value={groupForm.defaultLocation}
                onChange={(event) =>
                  setGroupForm((previous) => ({
                    ...previous,
                    defaultLocation: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Domyślny typ</span>
              <select
                value={groupForm.defaultEventType}
                onChange={(event) =>
                  setGroupForm((previous) => ({
                    ...previous,
                    defaultEventType: event.target.value as GroupEventType,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              >
                <option value="training">Szkolenie</option>
                <option value="post">Post</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Domyślna pojemność</span>
              <input
                type="number"
                min={1}
                value={groupForm.defaultCapacity}
                onChange={(event) =>
                  setGroupForm((previous) => ({
                    ...previous,
                    defaultCapacity: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">
                SMS potwierdzenia udziału (dni)
              </span>
              <input
                type="number"
                min={0}
                value={groupForm.defaultConfirmationLeadTimeDays}
                onChange={(event) =>
                  setGroupForm((previous) => ({
                    ...previous,
                    defaultConfirmationLeadTimeDays: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Mogą dołączyć</span>
              <select
                value={groupForm.defaultJoinAudience}
                onChange={(event) =>
                  setGroupForm((previous) => ({
                    ...previous,
                    defaultJoinAudience: event.target.value as GroupFormState["defaultJoinAudience"],
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              >
                <option value="existing-practitioners">Tylko Ćwiczący</option>
                <option value="new-people">Nowe osoby</option>
              </select>
            </label>
            <label className="grid gap-2 lg:col-span-2">
              <span className="text-sm font-semibold text-brand-navy">Tagi domyślne</span>
              <input
                value={groupForm.defaultTagsText}
                onChange={(event) =>
                  setGroupForm((previous) => ({
                    ...previous,
                    defaultTagsText: event.target.value,
                  }))
                }
                placeholder="np. oddech, regeneracja, praca z grupą"
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2 lg:col-span-2">
              <span className="text-sm font-semibold text-brand-navy">Notatki</span>
              <textarea
                rows={3}
                value={groupForm.notes}
                onChange={(event) =>
                  setGroupForm((previous) => ({ ...previous, notes: event.target.value }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-3 lg:col-span-2">
              <button
                type="submit"
                disabled={savingGroup}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
              >
                <Check size={16} />
                {savingGroup ? "Zapisywanie..." : "Utwórz grupę"}
              </button>
              {isCreateGroupFormVisible ? (
                <button
                  type="button"
                  onClick={() => {
                    resetGroupForm();
                    navigate("/panel/grupy");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-soft"
                >
                  <X size={16} />
                  Anuluj
                </button>
              ) : null}
            </div>
          </form>
        </article>
      ) : null}

      {!isGroupDetailView && !isCreateGroupRoute ? (
        <div className="space-y-6">
          {hasManagedGroupScope || visibleGroups.length > 0 ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              {hasManagedGroupScope ? (
                <EventScopeSwitch
                  activeScope={groupScope}
                  joinedLabel="Uczestniczę"
                  ownedLabel="Organizuję"
                  onChange={setGroupScope}
                />
              ) : (
                <div />
              )}

              <label className="grid w-full gap-2 lg:max-w-md">
                <span className="text-sm font-semibold text-brand-navy">Szukaj grupy</span>
                <input
                  type="search"
                  value={groupSearchQuery}
                  onChange={(event) => setGroupSearchQuery(event.target.value)}
                  placeholder="Nazwa, trener lub organizator"
                  className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-brand-navy shadow-soft outline-none transition-colors placeholder:text-brand-muted focus:border-brand-sky"
                />
              </label>
            </div>
          ) : null}

          {visibleGroups.length === 0 ? (
            <EmptyPanelState
              title="Brak grup"
              description={
                canCreateGroups
                  ? isParticipantGroupListScope
                    ? "Nie należysz jeszcze do żadnej grupy. Przełącz na Organizuję, żeby zobaczyć grupy, którymi zarządzasz."
                    : "Utwórz pierwszą grupę, zanim zaczniesz planować szkolenia Emandar."
                  : isParticipantGroupViewer
                    ? "Nie należysz jeszcze do żadnej grupy i nie masz jeszcze własnych grup."
                    : "Nie masz jeszcze żadnych przypisanych grup."
              }
            />
          ) : sortedVisibleGroups.length === 0 ? (
            <EmptyPanelState
              title="Brak wyników"
              description="Zmień frazę wyszukiwania, żeby zobaczyć grupy z tej listy."
            />
          ) : (
            <>
              {activeVisibleGroups.length > 0 ? renderGroupRows(activeVisibleGroups) : null}

              {archivedVisibleGroups.length > 0 ? (
                <EnrollmentRequestArchiveSectionBlock
                  title="Archiwalne"
                  count={archivedVisibleGroups.length}
                  open={isArchivedGroupsOpen}
                  onOpenChange={setIsArchivedGroupsOpen}
                >
                  {renderGroupRows(archivedVisibleGroups)}
                </EnrollmentRequestArchiveSectionBlock>
              ) : null}
            </>
          )}
        </div>
      ) : selectedGroup ? (
        <div className="space-y-6">
          {isEditGroupFormVisible ? (
            <article className="min-w-0 rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
              <SectionBlockHeading
                title="Edytuj grupę"
                description="Zmieniasz ustawienia nadrzędne tej grupy i jej przyszłych szkoleń."
              />
              <form onSubmit={handleSaveGroup} className="mt-6 grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 lg:col-span-2">
                  <span className="text-sm font-semibold text-brand-navy">Nazwa grupy</span>
                  <input
                    required
                    value={groupForm.name}
                    onChange={(event) =>
                      setGroupForm((previous) => ({ ...previous, name: event.target.value }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Trener</span>
                  <select
                    value={groupForm.trainerId}
                    onChange={(event) =>
                      setGroupForm((previous) => ({ ...previous, trainerId: event.target.value }))
                    }
                    disabled
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
                  >
                    <option value="">Wybierz trenera</option>
                    {availableTrainers.map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Domyślna lokalizacja</span>
                  <input
                    value={groupForm.defaultLocation}
                    onChange={(event) =>
                      setGroupForm((previous) => ({
                        ...previous,
                        defaultLocation: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Domyślny typ</span>
                  <select
                    value={groupForm.defaultEventType}
                    onChange={(event) =>
                      setGroupForm((previous) => ({
                        ...previous,
                        defaultEventType: event.target.value as GroupEventType,
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                  >
                    <option value="training">Szkolenie</option>
                    <option value="post">Post</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Domyślna pojemność</span>
                  <input
                    type="number"
                    min={1}
                    value={groupForm.defaultCapacity}
                    onChange={(event) =>
                      setGroupForm((previous) => ({
                        ...previous,
                        defaultCapacity: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">
                    SMS potwierdzenia udziału (dni)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={groupForm.defaultConfirmationLeadTimeDays}
                    onChange={(event) =>
                      setGroupForm((previous) => ({
                        ...previous,
                        defaultConfirmationLeadTimeDays: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Mogą dołączyć</span>
                  <select
                    value={groupForm.defaultJoinAudience}
                    onChange={(event) =>
                      setGroupForm((previous) => ({
                        ...previous,
                        defaultJoinAudience: event.target.value as GroupFormState["defaultJoinAudience"],
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                  >
                    <option value="existing-practitioners">Tylko Ćwiczący</option>
                    <option value="new-people">Nowe osoby</option>
                  </select>
                </label>
                <label className="grid gap-2 lg:col-span-2">
                  <span className="text-sm font-semibold text-brand-navy">Tagi domyślne</span>
                  <input
                    value={groupForm.defaultTagsText}
                    onChange={(event) =>
                      setGroupForm((previous) => ({
                        ...previous,
                        defaultTagsText: event.target.value,
                      }))
                    }
                    placeholder="np. oddech, regeneracja, praca z grupą"
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                  />
                </label>
                <label className="grid gap-2 lg:col-span-2">
                  <span className="text-sm font-semibold text-brand-navy">Notatki</span>
                  <textarea
                    rows={3}
                    value={groupForm.notes}
                    onChange={(event) =>
                      setGroupForm((previous) => ({ ...previous, notes: event.target.value }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                  />
                </label>
                <div className="flex flex-wrap gap-3 lg:col-span-2">
                  <button
                    type="submit"
                    disabled={savingGroup}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
                  >
                    <Check size={16} />
                    {savingGroup ? "Zapisywanie..." : "Zapisz grupę"}
                  </button>
                  <button
                    type="button"
                    onClick={resetGroupForm}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-soft"
                  >
                    <X size={16} />
                    Anuluj edycję
                  </button>
                </div>
              </form>
            </article>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <StatCard
              label="Trener/Organizator"
              value={`${getShortProfileName(
                trainersById.get(selectedGroup.trainerId)?.displayName,
                "Brak",
              )} / ${getShortProfileName(
                organizersById.get(selectedGroup.organizerId)?.displayName,
                "Brak",
              )}`}
              icon={ShieldCheck}
              layout="stacked"
              valueClassName="text-base leading-snug sm:text-lg"
            />
            <StatCard
              label="Członkowie"
              value={activeMemberCounts[selectedGroup.id] ?? 0}
              icon={Users}
              layout="stacked"
            />
            <StatCard
              label="Wydarzenia"
              value={groupEventCounts[selectedGroup.id] ?? 0}
              icon={CalendarDays}
              layout="stacked"
            />
            <StatCard
              label="Najbliższy termin"
              value={nearestGroupEventLabels[selectedGroup.id] ?? "Brak"}
              icon={CalendarDays}
              layout="stacked"
              valueClassName="text-base leading-snug sm:text-lg"
            />
            <StatCard
              label="Lokalizacja"
              value={selectedGroup.defaultLocation || "Brak"}
              icon={CalendarDays}
              layout="stacked"
              valueClassName="text-base leading-snug sm:text-lg"
            />
            <StatCard
              label="Mogą dołączyć"
              value={getTrainingJoinAudienceLabel(selectedGroup.defaultJoinAudience)}
              icon={Users}
              layout="stacked"
              valueClassName="text-base leading-snug sm:text-lg"
            />
          </div>

          <div
            role="tablist"
            aria-label="Zawartość grupy"
            className="flex flex-wrap gap-2 rounded-[1.75rem] border border-brand-line bg-white p-1 shadow-soft sm:w-fit"
          >
            <button
              type="button"
              role="tab"
              aria-selected={groupDetailTab === "members"}
              onClick={() => setGroupDetailTab("members")}
              className={cn(
                "min-w-0 rounded-[1.35rem] px-4 py-2.5 text-sm font-semibold transition",
                groupDetailTab === "members"
                  ? "bg-brand-navy text-white"
                  : "text-brand-muted hover:text-brand-navy",
              )}
            >
              Członkowie
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={groupDetailTab === "events"}
              onClick={() => setGroupDetailTab("events")}
              className={cn(
                "min-w-0 rounded-[1.35rem] px-4 py-2.5 text-sm font-semibold transition",
                groupDetailTab === "events"
                  ? "bg-brand-navy text-white"
                  : "text-brand-muted hover:text-brand-navy",
              )}
            >
              Wydarzenia
            </button>
          </div>

          {groupDetailTab === "members" ? (
            <article className="min-w-0 rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
              <SectionBlockHeading
                title="Członkowie grupy"
                description={
                  isParticipantGroupViewer
                    ? "W podglądzie uczestnika pokazujemy tylko skład grupy bez danych administracyjnych."
                    : "Priorytet członka steruje tym, kto wpada automatycznie do rosteru wydarzenia i kto ma pierwszeństwo przy obsłudze listy."
                }
              />
              {canManageGroups && selectedGroupIsManagedByCurrentUser && selectedGroup.status === "active" ? (
                <form onSubmit={handleAddMember} className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
                  <div className="grid min-w-0 gap-4 lg:col-span-2 lg:grid-cols-2">
                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-semibold text-brand-navy">Wpisz nr tel osoby</span>
                      <input
                        value={memberForm.phone}
                        onChange={handleMemberPhoneChange}
                        placeholder="+48 600 123 456"
                        className="min-w-0 w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                      />
                    </label>
                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-semibold text-brand-navy">Wybierz z listy</span>
                      <select
                        value={memberForm.participantProfileId}
                        onChange={handleMemberProfileSelect}
                        className="min-w-0 w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                      >
                        <option value="">Wybierz uczestnika</option>
                        {memberProfileOptions.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.displayName} · {profile.phone} · {getParticipantConfirmationLabel(profile)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {shouldShowMemberDetails ? (
                    <>
                      <label className="grid min-w-0 gap-2">
                        <span className="text-sm font-semibold text-brand-navy">Imię i nazwisko</span>
                        <input
                          value={memberForm.displayName}
                          onChange={(event) =>
                            setMemberForm((previous) => ({
                              ...previous,
                              displayName: event.target.value,
                            }))
                          }
                          disabled={Boolean(selectedMemberProfile)}
                          className="min-w-0 w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
                        />
                      </label>
                      <label className="grid min-w-0 gap-2">
                        <span className="text-sm font-semibold text-brand-navy">Priorytet</span>
                        <select
                          value={memberForm.priority}
                          onChange={(event) =>
                            setMemberForm((previous) => ({
                              ...previous,
                              priority: event.target.value as GroupMemberPriority,
                            }))
                          }
                          className="min-w-0 w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                        >
                          <option value="stali">Stali</option>
                          <option value="regularni">Regularni</option>
                          <option value="rezerwowi">Rezerwowi</option>
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-2 lg:col-span-2">
                        <span className="text-sm font-semibold text-brand-navy">Źródło / polecenie</span>
                        <input
                          value={memberForm.referralSource}
                          onChange={(event) =>
                            setMemberForm((previous) => ({
                              ...previous,
                              referralSource: event.target.value,
                            }))
                          }
                          disabled={Boolean(selectedMemberProfile)}
                          className="min-w-0 w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 lg:col-span-2">
                        <span className="text-sm font-semibold text-brand-navy">Notatki</span>
                        <textarea
                          rows={3}
                          value={memberForm.notes}
                          onChange={(event) =>
                            setMemberForm((previous) => ({ ...previous, notes: event.target.value }))
                          }
                          className="min-w-0 w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                        />
                      </label>
                      <div className="lg:col-span-2">
                        <button
                          type="submit"
                          disabled={savingMember}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
                        >
                          <Users size={16} />
                          {savingMember ? "Dodawanie..." : "Dodaj członka"}
                        </button>
                      </div>
                    </>
                  ) : null}
                </form>
              ) : null}
              <div className="-mx-6 mt-4 space-y-5 sm:mx-0 sm:mt-6 sm:space-y-6">
                {selectedGroupMembers.length === 0 ? (
                  <div className="px-6 sm:px-0">
                    <EmptyPanelState
                      title="Brak członków"
                      description={
                        isParticipantGroupViewer
                          ? "Ta grupa nie ma jeszcze żadnych aktywnych członków."
                          : "Dodaj pierwsze osoby do grupy, aby planować szkolenia i budować roster wydarzeń."
                      }
                    />
                  </div>
                ) : (
                  selectedGroupMemberSections.map((section) => (
                    <section key={section.priority} className="space-y-1.5 sm:space-y-3">
                      <div className="flex items-center gap-2 px-6 sm:px-1">
                        <span className="rounded-full bg-brand-navy/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-navy sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.2em]">
                          {getGroupPriorityLabel(section.priority)}
                        </span>
                        <div className="h-px flex-1 bg-brand-line/80" />
                        <span className="text-[11px] text-brand-muted sm:text-xs">
                          {section.members.length}
                        </span>
                      </div>

                      <div className="border-y border-brand-line/70 bg-white sm:space-y-3 sm:border-y-0 sm:bg-transparent">
                        {section.members.map(({ member, rowIndex }) => {
                          const draft =
                            memberDrafts[member.id] ?? createGroupMemberDraftState(member);
                          const participantProfile =
                            participantProfilesById.get(member.participantProfileId) ?? null;
                          const isExpanded = expandedMemberIds.includes(member.id);
                          const saveState = memberSaveStates[member.id];
                          const saveStateLabel = getMemberSaveStateLabel(member.id);

                          return (
                            <Collapsible
                              key={member.id}
                              open={isExpanded}
                              onOpenChange={(open) => toggleExpandedMember(member.id, open)}
                            >
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
                                      {member.participantDisplayName}
                                    </p>
                                  </div>

                                  {canManageGroups && selectedGroupIsManagedByCurrentUser ? (
                                    <select
                                      value={draft.priority}
                                      onChange={(event) => {
                                        const nextDraft = setMemberDraft(member, {
                                          priority: event.target.value as GroupMemberPriority,
                                        });
                                        void persistGroupMemberChanges(member.id, nextDraft);
                                      }}
                                      className="h-9 w-[108px] shrink-0 appearance-none rounded-xl border border-brand-line bg-white px-3 text-xs font-semibold text-brand-navy outline-none sm:h-12 sm:w-[180px] sm:rounded-2xl sm:px-4 sm:text-sm"
                                    >
                                      <option value="stali">Stali</option>
                                      <option value="regularni">Regularni</option>
                                      <option value="rezerwowi">Rezerwowi</option>
                                    </select>
                                  ) : null}

                                  {saveStateLabel ? (
                                    <span
                                      title={saveStateLabel}
                                      aria-label={saveStateLabel}
                                      className={cn(
                                        "inline-flex size-6 shrink-0 items-center justify-center sm:size-8",
                                        getMemberSaveStateTone(member.id),
                                      )}
                                    >
                                      {saveState?.status === "saving" ? (
                                        <RefreshCcw size={12} className="animate-spin sm:size-[14px]" />
                                      ) : saveState?.status === "saved" ? (
                                        <Check size={12} className="sm:size-[14px]" />
                                      ) : saveState?.status === "error" ? (
                                        <X size={12} className="sm:size-[14px]" />
                                      ) : null}
                                    </span>
                                  ) : null}

                                  <CollapsibleTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-none border-l border-brand-line bg-transparent text-brand-navy sm:size-12 sm:rounded-full sm:border sm:bg-white sm:shadow-soft"
                                      aria-label={
                                        isExpanded
                                          ? `Ukryj szczegóły ${member.participantDisplayName}`
                                          : `Pokaż szczegóły ${member.participantDisplayName}`
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
                                  {isParticipantGroupViewer ? (
                                    <p className="text-xs text-brand-muted sm:text-sm">
                                      {member.participantProfileId === currentUser.participantProfileId
                                        ? "To Twoje miejsce w tej grupie."
                                        : "Członek grupy."}
                                    </p>
                                  ) : (
                                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                                      <div className="space-y-3 sm:space-y-4">
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-brand-muted sm:gap-3 sm:text-sm">
                                          <span className="inline-flex items-center gap-1.5 sm:gap-2">
                                            <Phone size={12} className="sm:size-[14px]" />
                                            {member.participantPhone}
                                          </span>
                                          <span className="rounded-full border border-brand-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-navy sm:px-3 sm:py-1 sm:text-xs sm:tracking-[0.18em]">
                                            {getParticipantConfirmationLabel(participantProfile)}
                                          </span>
                                        </div>

                                        {canManageGroups && selectedGroupIsManagedByCurrentUser ? (
                                          <label className="grid gap-2">
                                            <span className="text-xs font-semibold text-brand-navy sm:text-sm">
                                              Notatka o uczestniku
                                            </span>
                                            <textarea
                                              rows={3}
                                              value={draft.notes}
                                              onChange={(event) => {
                                                setMemberDraft(member, {
                                                  notes: event.target.value,
                                                });
                                              }}
                                              onBlur={() => {
                                                void persistGroupMemberChanges(member.id);
                                              }}
                                              placeholder="Notatki o uczestniku"
                                              className="min-h-20 rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-navy outline-none sm:min-h-24 sm:rounded-2xl sm:px-4 sm:py-3"
                                            />
                                          </label>
                                        ) : null}
                                      </div>

                                      {canManageGroups && selectedGroupIsManagedByCurrentUser ? (
                                        <div className="flex items-start justify-start lg:justify-end">
                                          <button
                                            type="button"
                                            onClick={() => void handleRemoveMember(member.id)}
                                            className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                                          >
                                            <Trash2 size={14} />
                                            Usuń
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  )}
                                </CollapsibleContent>
                              </article>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </article>
          ) : null}

          {groupDetailTab === "events" ? (
            <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
              <SectionBlockHeading
                title="Wydarzenia grupy"
                description={
                  isParticipantGroupViewer
                    ? "Tutaj widać szkolenia przypięte do tej grupy. Szczegóły uczestnictwa sprawdzisz z poziomu listy szkoleń."
                    : "Tutaj widać wszystkie szkolenia przypięte do tej grupy i możesz szybko dodawać kolejne terminy."
                }
              />
              <div className="mt-6 space-y-3">
                {selectedGroupEvents.length === 0 ? (
                  <EmptyPanelState
                    title="Brak wydarzeń"
                    description="Po utworzeniu szkolenia dla tej grupy wydarzenia pojawią się tutaj automatycznie."
                  />
                ) : (
                  selectedGroupEvents.map((event) =>
                    isParticipantGroupViewer ? (
                      <article
                        key={event.id}
                        className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <p className="text-lg font-semibold text-brand-navy">{event.title}</p>
                            <p className="text-sm text-brand-muted">
                              {formatDate(event.startsAt)} · {formatShortTime(event.startsAt)} -{" "}
                              {formatShortTime(event.endsAt)}
                            </p>
                            <p className="text-sm text-brand-muted">{event.location}</p>
                          </div>
                          <div className="text-right text-sm text-brand-muted">
                            <p>{getTrainingEventStatusLabel(resolveTrainingEventStatus(event.status))}</p>
                            <p className="mt-1">
                              {resolveTrainingEventWorkflowStatus(event)}
                            </p>
                          </div>
                        </div>
                      </article>
                    ) : (
                      <Link
                        key={event.id}
                        to={`/panel/szkolenia/${event.id}`}
                        className="block rounded-3xl border border-brand-line bg-brand-shell/60 p-4 transition hover:bg-brand-shell"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <p className="text-lg font-semibold text-brand-navy">{event.title}</p>
                            <p className="text-sm text-brand-muted">
                              {formatDate(event.startsAt)} · {formatShortTime(event.startsAt)} -{" "}
                              {formatShortTime(event.endsAt)}
                            </p>
                            <p className="text-sm text-brand-muted">{event.location}</p>
                          </div>
                          <div className="text-right text-sm text-brand-muted">
                            <p>{getTrainingEventStatusLabel(resolveTrainingEventStatus(event.status))}</p>
                            <p className="mt-1">
                              {resolveTrainingEventWorkflowStatus(event)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ),
                  )
                )}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </PanelSection>
  );
}
