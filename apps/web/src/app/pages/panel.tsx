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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useAppState } from "../providers/AppProviders";
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

function getDashboardPerspectiveLabel(perspective: DashboardPerspective) {
  switch (perspective) {
    case "trainer":
      return "Trener";
    case "organizer":
      return "Organizator";
    default:
      return "Uczestnik";
  }
}

function getDashboardPerspectiveTitle(perspective: DashboardPerspective) {
  switch (perspective) {
    case "trainer":
      return "Dashboard trenera";
    case "organizer":
      return "Dashboard organizatora";
    default:
      return "Dashboard uczestnika";
  }
}

function formatDaysUntilLabel(daysUntil: number) {
  if (daysUntil <= 0) {
    return "Dzisiaj";
  }

  if (daysUntil === 1) {
    return "Za 1 dzień";
  }

  return `Za ${daysUntil} dni`;
}

function DashboardPerspectiveSwitch({
  perspectives,
  activePerspective,
  onChange,
}: {
  perspectives: DashboardPerspective[];
  activePerspective: DashboardPerspective;
  onChange: (perspective: DashboardPerspective) => void;
}) {
  return (
    <div className="w-full max-w-[40rem]">
      <div
        className="grid gap-1 rounded-[1.75rem] border border-brand-line bg-white p-1 shadow-soft"
        style={{ gridTemplateColumns: `repeat(${perspectives.length}, minmax(0, 1fr))` }}
      >
        {perspectives.map((perspective) => (
          <button
            key={perspective}
            type="button"
            onClick={() => onChange(perspective)}
            className={`min-w-0 rounded-[1.35rem] px-3 py-2.5 text-center text-sm font-semibold transition ${
              activePerspective === perspective
                ? "bg-brand-navy text-white"
                : "text-brand-muted hover:text-brand-navy"
            }`}
          >
            {getDashboardPerspectiveLabel(perspective)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ParticipantDashboardPerspectiveView({
  currentUser,
  store,
  confirmEnrollmentAttendance,
}: {
  currentUser: AppUser;
  store: DemoStore;
  confirmEnrollmentAttendance: (token: string, decision: "confirm" | "decline") => Promise<void>;
}) {
  const participantDashboard = useMemo(
    () =>
      getParticipantDashboardModel({
        userId: currentUser.id,
        participantProfileId: currentUser.participantProfileId,
        store,
      }),
    [currentUser.id, currentUser.participantProfileId, store],
  );
  const [showPendingConfirmations, setShowPendingConfirmations] = useState(false);
  const [confirmingToken, setConfirmingToken] = useState<string | null>(null);

  useEffect(() => {
    if (participantDashboard.pendingConfirmationItems.length === 0) {
      setShowPendingConfirmations(false);
    }
  }, [participantDashboard.pendingConfirmationItems.length]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
            Twoje szkolenia
          </p>
          <p className="mt-3 text-5xl font-semibold text-brand-navy">
            {participantDashboard.activeEnrollmentCount}
          </p>
          <p className="mt-3 text-sm text-brand-muted">
            Na tyle aktywnych szkoleń jesteś teraz zapisany.
          </p>
          <p className="mt-4 text-sm text-brand-muted">
            Oczekujace decyzje: {participantDashboard.pendingJoinRequestCount}
          </p>
          <p className="mt-4 text-sm text-brand-muted">
            Archiwum: {participantDashboard.archivedEnrollmentCount}
          </p>
        </article>

        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                Wymagają potwierdzenia
              </p>
              <p className="mt-3 text-3xl font-semibold text-brand-navy">
                {participantDashboard.pendingConfirmationItems.length}
              </p>
              <p className="mt-3 max-w-xl text-sm text-brand-muted">
                Potwierdź udział, a status zmieni się na potwierdzony i nie dostaniesz już SMS-a
                z prośbą o potwierdzenie obecności.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setShowPendingConfirmations((current) => !current)
              }
              className="inline-flex items-center rounded-full border border-brand-line bg-brand-shell px-5 py-3 text-sm font-semibold text-brand-navy"
            >
              {showPendingConfirmations ? "Ukryj listę" : "Pokaż szkolenia"}
            </button>
          </div>
        </article>
      </div>

      <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
        <SectionBlockHeading
          title="Dwa najbliższe szkolenia"
          description="Szybki skrót do najbliższych terminów. Klik z kafla przenosi do odpowiedniej listy szkoleń."
        />
        {participantDashboard.upcomingItems.length === 0 ? (
          <div className="mt-5">
            <EmptyPanelState
              title="Brak nadchodzących szkoleń"
              description="Kiedy dołączysz do kolejnego terminu, zobaczysz go tutaj."
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {participantDashboard.upcomingItems.map((item) => (
              <Link
                key={item.id}
                to={getPanelEventListPath(item.event)}
                className="rounded-[1.75rem] border border-brand-line bg-brand-shell p-5 transition hover:border-brand-sky-deep hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-sky-deep">
                    {formatDaysUntilLabel(item.daysUntil)}
                  </p>
                  <span className="rounded-full border border-brand-line bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-navy">
                    {item.statusLabel}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
                      Data
                    </p>
                    <p className="mt-2 text-lg font-semibold text-brand-navy">
                      {formatDate(item.event.startsAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
                      Grupa
                    </p>
                    <p className="mt-2 text-lg font-semibold text-brand-navy">
                      {item.groupName}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </article>

      {showPendingConfirmations && (
        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <SectionBlockHeading
            title="Szkolenia do potwierdzenia"
            description="Potwierdzenie od razu zapisuje status jako potwierdzony."
          />
          <div className="mt-5 space-y-4">
            {participantDashboard.pendingConfirmationItems.length === 0 ? (
              <p className="rounded-3xl bg-brand-shell p-4 text-brand-muted">
                Nie masz teraz szkoleń oczekujących na potwierdzenie.
              </p>
            ) : (
              participantDashboard.pendingConfirmationItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[1.75rem] border border-brand-line bg-brand-shell p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-brand-navy">{item.event.title}</p>
                      <p className="mt-2 text-sm text-brand-muted">
                        {formatDate(item.event.startsAt)} • {item.groupName}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={confirmingToken === item.token}
                      onClick={async () => {
                        setConfirmingToken(item.token);

                        try {
                          await confirmEnrollmentAttendance(item.token, "confirm");
                          toast.success("Udział został potwierdzony.");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Nie udało się potwierdzić udziału.",
                          );
                        } finally {
                          setConfirmingToken((current) =>
                            current === item.token ? null : current,
                          );
                        }
                      }}
                      className="inline-flex items-center rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {confirmingToken === item.token ? "Potwierdzanie..." : "Potwierdź udział"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      )}
    </div>
  );
}

function getScopedManagedEventsForPerspective({
  currentUser,
  events,
  perspective,
  organizerProfile,
  trainerProfile,
}: {
  currentUser: AppUser;
  events: TrainingEvent[];
  perspective: Exclude<DashboardPerspective, "participant">;
  organizerProfile: OrganizerProfile | null;
  trainerProfile: TrainerProfile | null;
}) {
  return events.filter((event) => {
    if (isTrainingEventArchived(event) || !canManageTrainingEvent(event, currentUser)) {
      return false;
    }

    if (perspective === "trainer") {
      if (trainerProfile?.id && event.trainerId === trainerProfile.id) {
        return true;
      }

      return isCommunityBrandStatus(event.brandStatus) && event.creatorUserId === currentUser.id;
    }

    if (organizerProfile?.id && event.organizerId === organizerProfile.id) {
      return true;
    }

    return event.creatorUserId === currentUser.id && event.createdByRole === "organizer";
  });
}

function OperationalDashboardPerspectiveView({
  currentUser,
  notificationsCount,
  perspective,
  store,
}: {
  currentUser: AppUser;
  notificationsCount: number;
  perspective: Exclude<DashboardPerspective, "participant">;
  store: DemoStore;
}) {
  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id) ?? null;
  const organizerProfile = store.organizers.find((item) => item.userId === currentUser.id) ?? null;
  const isTrainerPerspective = perspective === "trainer";
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const dashboardNow = useMemo(() => new Date(), []);
  const relevantEvents = useMemo(
    () =>
      getScopedManagedEventsForPerspective({
        currentUser,
        events: store.trainingEvents,
        perspective,
        organizerProfile,
        trainerProfile,
      }),
    [currentUser, organizerProfile, perspective, store.trainingEvents, trainerProfile],
  );
  const relevantEventIds = useMemo(
    () => new Set(relevantEvents.map((event) => event.id)),
    [relevantEvents],
  );
  const relevantRequests = useMemo(
    () => store.enrollmentRequests.filter((item) => relevantEventIds.has(item.eventId)),
    [relevantEventIds, store.enrollmentRequests],
  );
  const relevantOperationalRequests = useMemo(
    () => relevantRequests.filter((request) => isOperationalEnrollmentRequest(request, store)),
    [relevantRequests, store],
  );
  const communityEvents = useMemo(
    () =>
      isTrainerPerspective && trainerProfile
        ? relevantEvents.filter(
            (item) =>
              item.trainerId === trainerProfile.id &&
              isCommunityBrandStatus(item.brandStatus),
          )
        : [],
    [isTrainerPerspective, relevantEvents, trainerProfile],
  );
  const activeCommunityEvents = useMemo(
    () =>
      communityEvents.filter(
        (item) => resolveTrainingEventStatus(item.status) === "active",
      ),
    [communityEvents],
  );
  const confirmedCommunityEvents = useMemo(
    () =>
      communityEvents.filter(
        (item) => resolveTrainingEventStatus(item.status) === "confirmed",
      ),
    [communityEvents],
  );
  const activeCommunityStats = useMemo(
    () => aggregateEventCapacityStats(activeCommunityEvents),
    [activeCommunityEvents],
  );
  const confirmedCommunityStats = useMemo(
    () => aggregateEventCapacityStats(confirmedCommunityEvents),
    [confirmedCommunityEvents],
  );
  const communityPerformanceData = useMemo(
    () =>
      sortEventsByFillRate([...activeCommunityEvents, ...confirmedCommunityEvents]).map(
        (event) => ({
          id: event.id,
          label: event.location || event.title,
          isOfficialGroupTraining: isOfficialGroupTrainingEvent(event),
          fillRate: getEventFillRate(event),
          statusLabel: getTrainingEventStatusLabel(event.status),
          status: resolveTrainingEventStatus(event.status),
          occupiedPlaces: getEventParticipantCount(event),
          confirmedCount: event.enrolledCount,
          overflowCount: getEventOverflowCount(event),
          availablePlaces: getAvailablePlaces(event),
          startsAt: event.startsAt,
          capacity: event.capacity,
          missingPeople: getAvailablePlaces(event),
        }),
      ),
    [activeCommunityEvents, confirmedCommunityEvents],
  );
  const hasCommunityKpiData = communityPerformanceData.length > 0;
  const dashboardMonthBuckets = useMemo(() => getDashboardMonthBuckets(dashboardNow), [dashboardNow]);
  const dashboardWindow = dashboardMonthBuckets.at(-1);
  const organizerOfficialDashboard = useMemo(
    () =>
      !isTrainerPerspective && organizerProfile
        ? getOrganizerOfficialDashboardModel({
            organizerProfileId: organizerProfile.id,
            store,
            now: dashboardNow,
          })
        : null,
    [dashboardNow, isTrainerPerspective, organizerProfile, store],
  );
  const organizerAnalyticsEventsInRange = useMemo(() => {
    if (!organizerOfficialDashboard || !dashboardWindow) {
      return [];
    }

    return organizerOfficialDashboard.pipelineEvents.filter((event) =>
      isDateWithinRange(event.startsAt, dashboardNow, dashboardWindow.end),
    );
  }, [dashboardNow, dashboardWindow, organizerOfficialDashboard]);
  const organizerDashboardEventData = useMemo(
    () =>
      organizerAnalyticsEventsInRange.map((event) => ({
        id: event.id,
        label: getOrganizerOfficialDashboardEventLabel(event, store),
        startsAt: event.startsAt,
        statusLabel: getTrainingEventStatusLabel(event.status),
        status: resolveTrainingEventStatus(event.status),
        isOfficialGroupTraining: isOfficialGroupTrainingEvent(event),
        fillRate: getEventFillRate(event),
        missingPeople: getAvailablePlaces(event),
        occupiedPlaces: getEventParticipantCount(event),
        confirmedCount: event.enrolledCount,
        overflowCount: getEventOverflowCount(event),
        capacity: event.capacity,
        availablePlaces: getAvailablePlaces(event),
      })),
    [organizerAnalyticsEventsInRange, store],
  );
  const organizerMissingPeopleData = useMemo(
    () =>
      [...organizerDashboardEventData].sort((left, right) => {
        if (right.missingPeople !== left.missingPeople) {
          return right.missingPeople - left.missingPeople;
        }

        return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
      }),
    [organizerDashboardEventData],
  );
  const organizerFillRateData = useMemo(
    () =>
      [...organizerDashboardEventData].sort((left, right) => {
        if (left.fillRate !== right.fillRate) {
          return left.fillRate - right.fillRate;
        }

        return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
      }),
    [organizerDashboardEventData],
  );
  const organizerCapacityByMonthData = useMemo(
    () =>
      dashboardMonthBuckets.map((bucket) => {
        const monthEvents = organizerAnalyticsEventsInRange.filter((event) =>
          isDateWithinRange(event.startsAt, bucket.start, bucket.end),
        );

        return {
          key: bucket.key,
          label: bucket.label,
          totalCapacity: monthEvents.reduce((sum, event) => sum + event.capacity, 0),
          enrolledCount: monthEvents.reduce((sum, event) => sum + getEventParticipantCount(event), 0),
          confirmedCount: monthEvents.reduce((sum, event) => sum + event.enrolledCount, 0),
          overflowCount: monthEvents.reduce((sum, event) => sum + getEventOverflowCount(event), 0),
          availablePlaces: monthEvents.reduce((sum, event) => sum + getAvailablePlaces(event), 0),
        };
      }),
    [dashboardMonthBuckets, organizerAnalyticsEventsInRange],
  );
  const organizerAnalyticsRequestsInRange = useMemo(() => {
    if (!organizerOfficialDashboard || !dashboardWindow) {
      return [];
    }

    const rangeStart = dashboardMonthBuckets[0]?.start ?? dashboardNow;
    return organizerOfficialDashboard.requestHistoryRecords.filter(({ request }) =>
      isDateWithinRange(request.createdAt, rangeStart, dashboardWindow.end),
    );
  }, [dashboardMonthBuckets, dashboardNow, dashboardWindow, organizerOfficialDashboard]);
  const organizerRequestsByMonthData = useMemo(
    () =>
      dashboardMonthBuckets.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        total: organizerAnalyticsRequestsInRange.filter(({ request }) =>
          isDateWithinRange(request.createdAt, bucket.start, bucket.end),
        ).length,
      })),
    [dashboardMonthBuckets, organizerAnalyticsRequestsInRange],
  );
  const organizerRequestDecisionsByMonthData = useMemo(
    () =>
      dashboardMonthBuckets.map((bucket) => {
        const monthRequests = organizerAnalyticsRequestsInRange.filter(({ request }) =>
          isDateWithinRange(request.createdAt, bucket.start, bucket.end),
        );

        return {
          key: bucket.key,
          label: bucket.label,
          accepted: monthRequests.filter(({ request }) => request.finalStatus === "accepted").length,
          pending: monthRequests.filter(({ request }) => request.finalStatus === "pending").length,
          rejected: monthRequests.filter(({ request }) => request.finalStatus === "rejected").length,
          partial: monthRequests.filter(({ request }) => request.finalStatus === "partial").length,
        };
      }),
    [dashboardMonthBuckets, organizerAnalyticsRequestsInRange],
  );
  const analyticsEventsInRange = useMemo(() => {
    if (!dashboardWindow) {
      return [];
    }

    const windowStart = new Date();
    return relevantEvents.filter((event) =>
      isDateWithinRange(event.startsAt, windowStart, dashboardWindow.end),
    );
  }, [dashboardWindow, relevantEvents]);
  const analyticsActiveEvents = useMemo(
    () =>
      analyticsEventsInRange.filter((event) => {
        const status = resolveTrainingEventStatus(event.status);
        return status === "active" || status === "confirmed";
      }),
    [analyticsEventsInRange],
  );
  const dashboardEventData = useMemo(
    () =>
      analyticsActiveEvents.map((event) => ({
        id: event.id,
        label: getDashboardEventLabel(event, currentUser, store),
        startsAt: event.startsAt,
        statusLabel: getTrainingEventStatusLabel(event.status),
        status: resolveTrainingEventStatus(event.status),
        isOfficialGroupTraining: isOfficialGroupTrainingEvent(event),
        fillRate: getEventFillRate(event),
        missingPeople: getAvailablePlaces(event),
        occupiedPlaces: getEventParticipantCount(event),
        confirmedCount: event.enrolledCount,
        overflowCount: getEventOverflowCount(event),
        capacity: event.capacity,
        availablePlaces: getAvailablePlaces(event),
      })),
    [analyticsActiveEvents, currentUser, store],
  );
  const missingPeopleData = useMemo(
    () =>
      [...dashboardEventData].sort((left, right) => {
        if (right.missingPeople !== left.missingPeople) {
          return right.missingPeople - left.missingPeople;
        }

        return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
      }),
    [dashboardEventData],
  );
  const fillRateData = useMemo(
    () =>
      sortEventsByFillRate(analyticsActiveEvents).map((event) => ({
        id: event.id,
        label: getDashboardEventLabel(event, currentUser, store),
        startsAt: event.startsAt,
        statusLabel: getTrainingEventStatusLabel(event.status),
        status: resolveTrainingEventStatus(event.status),
        isOfficialGroupTraining: isOfficialGroupTrainingEvent(event),
        fillRate: getEventFillRate(event),
        missingPeople: getAvailablePlaces(event),
        occupiedPlaces: getEventParticipantCount(event),
        confirmedCount: event.enrolledCount,
        overflowCount: getEventOverflowCount(event),
        capacity: event.capacity,
        availablePlaces: getAvailablePlaces(event),
      })),
    [analyticsActiveEvents, currentUser, store],
  );
  const capacityByMonthData = useMemo(
    () =>
      dashboardMonthBuckets.map((bucket) => {
        const monthEvents = analyticsActiveEvents.filter((event) =>
          isDateWithinRange(event.startsAt, bucket.start, bucket.end),
        );

        return {
          key: bucket.key,
          label: bucket.label,
          totalCapacity: monthEvents.reduce((sum, event) => sum + event.capacity, 0),
          enrolledCount: monthEvents.reduce((sum, event) => sum + getEventParticipantCount(event), 0),
          confirmedCount: monthEvents.reduce((sum, event) => sum + event.enrolledCount, 0),
          overflowCount: monthEvents.reduce((sum, event) => sum + getEventOverflowCount(event), 0),
          availablePlaces: monthEvents.reduce((sum, event) => sum + getAvailablePlaces(event), 0),
        };
      }),
    [analyticsActiveEvents, dashboardMonthBuckets],
  );
  const organizerGroupsData = useMemo(() => {
    if (!isTrainerPerspective) {
      return [];
    }

    const grouped = analyticsActiveEvents.reduce<Map<string, DashboardOrganizerGroupsDatum>>(
      (summary, event) => {
        if (!event.organizerId) {
          return summary;
        }

        const organizer = store.organizers.find((item) => item.id === event.organizerId);
        const existing = summary.get(event.organizerId);

        if (existing) {
          existing.plannedGroups += 1;
          return summary;
        }

        summary.set(event.organizerId, {
          organizerId: event.organizerId,
          label: organizer?.displayName ?? "Nieznany organizator",
          plannedGroups: 1,
        });

        return summary;
      },
      new Map(),
    );

    return [...grouped.values()].sort((left, right) => {
      if (right.plannedGroups !== left.plannedGroups) {
        return right.plannedGroups - left.plannedGroups;
      }

      return left.label.localeCompare(right.label, "pl");
    });
  }, [analyticsActiveEvents, isTrainerPerspective, store.organizers]);
  const analyticsRequestsInRange = useMemo(() => {
    if (!dashboardWindow) {
      return [];
    }

    const rangeStart = dashboardMonthBuckets[0]?.start ?? new Date();
    return relevantOperationalRequests.filter((request) =>
      isDateWithinRange(request.createdAt, rangeStart, dashboardWindow.end),
    );
  }, [dashboardMonthBuckets, dashboardWindow, relevantOperationalRequests]);
  const requestsByMonthData = useMemo(
    () =>
      dashboardMonthBuckets.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        total: analyticsRequestsInRange.filter((request) =>
          isDateWithinRange(request.createdAt, bucket.start, bucket.end),
        ).length,
      })),
    [analyticsRequestsInRange, dashboardMonthBuckets],
  );
  const requestDecisionsByMonthData = useMemo(
    () =>
      dashboardMonthBuckets.map((bucket) => {
        const monthRequests = analyticsRequestsInRange.filter((request) =>
          isDateWithinRange(request.createdAt, bucket.start, bucket.end),
        );

        return {
          key: bucket.key,
          label: bucket.label,
          accepted: monthRequests.filter((request) => request.finalStatus === "accepted").length,
          pending: monthRequests.filter((request) => request.finalStatus === "pending").length,
          rejected: monthRequests.filter((request) => request.finalStatus === "rejected").length,
          partial: monthRequests.filter((request) => request.finalStatus === "partial").length,
        };
      }),
    [analyticsRequestsInRange, dashboardMonthBuckets],
  );
  const eventOutcomesByMonthData = useMemo(
    () =>
      dashboardMonthBuckets.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        confirmed: analyticsEventsInRange.filter(
          (event) =>
            isDateWithinRange(event.startsAt, bucket.start, bucket.end) &&
            resolveTrainingEventStatus(event.status) === "confirmed",
        ).length,
        cancelled: analyticsEventsInRange.filter(
          (event) =>
            isDateWithinRange(event.startsAt, bucket.start, bucket.end) &&
            resolveTrainingEventStatus(event.status) === "cancelled",
        ).length,
      })),
    [analyticsEventsInRange, dashboardMonthBuckets],
  );
  const relationsCount = useMemo(() => {
    if (isTrainerPerspective) {
      return trainerProfile
        ? store.relations.filter((item) => item.trainerId === trainerProfile.id).length
        : 0;
    }

    return organizerProfile
      ? store.relations.filter((item) => item.organizerId === organizerProfile.id).length
      : 0;
  }, [isTrainerPerspective, organizerProfile, store.relations, trainerProfile]);

  if (!isTrainerPerspective) {
    const newRequestsCount = store.enrollmentRequests.filter((request) => {
      if (request.finalStatus !== "pending") {
        return false;
      }

      if (!isOperationalEnrollmentRequest(request, store)) {
        return false;
      }

      const event = store.trainingEvents.find((item) => item.id === request.eventId);
      if (!event) {
        return false;
      }

      return canApproveEnrollmentRequest(event, currentUser);
    }).length;
    const nextPipelineEvent = organizerOfficialDashboard?.pipelineEvents[0] ?? null;
    const followingPipelineEvent = organizerOfficialDashboard?.pipelineEvents[1] ?? null;
    const nextPipelineEventDate = nextPipelineEvent
      ? getDaysUntilLabel(nextPipelineEvent.startsAt, dashboardNow)
      : "Brak";
    const nextPipelineEventGroup =
      nextPipelineEvent?.groupName ??
      (nextPipelineEvent?.groupId
        ? store.groups.find((item) => item.id === nextPipelineEvent.groupId)?.name ?? null
        : null) ??
      "Brak najbliższego terminu";
    const followingPipelineEventDate = followingPipelineEvent
      ? getDaysUntilLabel(followingPipelineEvent.startsAt, dashboardNow)
      : "Brak";
    const followingPipelineEventGroup =
      followingPipelineEvent?.groupName ??
      (followingPipelineEvent?.groupId
        ? store.groups.find((item) => item.id === followingPipelineEvent.groupId)?.name ?? null
        : null) ??
      "Brak następnego terminu";

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-6 sm:gap-4">
          <StatCard
            label="Nowe"
            value={newRequestsCount}
            icon={Bell}
            layout="stacked"
            className="min-h-[108px] w-full min-w-0"
            labelClassName="whitespace-nowrap"
            iconWrapperClassName={
              newRequestsCount > 0 ? "bg-red-500 text-white" : ""
            }
          />
          <StatCard
            label="Najbliższe"
            value={nextPipelineEventDate}
            detail={nextPipelineEventGroup}
            valueClassName="text-lg leading-tight sm:text-2xl"
            icon={CalendarDays}
            layout="stacked"
            className="min-h-[108px] w-full min-w-0"
            labelClassName="whitespace-nowrap"
            detailClassName="mt-0 w-full truncate whitespace-nowrap"
            detailPlacement="below"
          />
          <StatCard
            label="Następne"
            value={followingPipelineEventDate}
            detail={followingPipelineEventGroup}
            valueClassName="text-lg leading-tight sm:text-2xl"
            icon={CalendarDays}
            layout="stacked"
            className="min-h-[108px] w-full min-w-0"
            labelClassName="whitespace-nowrap"
            detailClassName="mt-0 w-full truncate whitespace-nowrap"
            detailPlacement="below"
          />
          <StatCard
            label="Grupy"
            value={organizerOfficialDashboard?.groups.length ?? 0}
            icon={Users}
            layout="stacked"
            className="min-h-[108px] w-full min-w-0"
            labelClassName="whitespace-nowrap"
          />
          <StatCard
            label="Szkolenia"
            value={organizerOfficialDashboard?.pipelineEvents.length ?? 0}
            icon={CalendarDays}
            layout="stacked"
            className="min-h-[108px] w-full min-w-0"
            labelClassName="whitespace-nowrap"
          />
          <StatCard
            label="Uczestnicy"
            value={organizerOfficialDashboard?.activeMemberCount ?? 0}
            icon={ShieldCheck}
            layout="stacked"
            className="min-h-[108px] w-full min-w-0"
            labelClassName="whitespace-nowrap"
          />
        </div>

        <section className="space-y-4">
          <div>
            <p className="text-xl font-semibold leading-tight text-brand-navy sm:text-2xl">
              Najbliższe terminy i ile osób jeszcze brakuje
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <DashboardChartCard
              title="Może dołączyć"
              description="Najbliższe terminy wg ilości osób, które mogą dołączyć."
            >
              {organizerMissingPeopleData.length === 0 ? (
                <DashboardChartEmptyState message="Brak aktywnych grupowych szkoleń Emandar w najbliższych 3 miesiącach." />
              ) : (
                <div style={{ height: `${getDashboardChartHeight(organizerMissingPeopleData.length)}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={organizerMissingPeopleData}
                      layout="vertical"
                      margin={{ top: 8, right: 20, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} stroke="#6982a0" />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={190}
                        tick={{ fill: "#123e78", fontSize: 12 }}
                      />
                      <Tooltip content={<MissingPeopleTooltip />} />
                      <Bar dataKey="missingPeople" fill="#174f9a" radius={[0, 14, 14, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashboardChartCard>

            <DashboardChartCard
              title="Zapełnienie terminów"
              description="Porównanie przyszłych terminów według poziomu zapełnienia rosteru."
            >
              {organizerFillRateData.length === 0 ? (
                <DashboardChartEmptyState message="Brak terminów do porównania w tym oknie czasu." />
              ) : (
                <div style={{ height: `${getDashboardChartHeight(organizerFillRateData.length)}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={organizerFillRateData}
                      layout="vertical"
                      margin={{ top: 8, right: 20, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                        stroke="#6982a0"
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={190}
                        tick={{ fill: "#123e78", fontSize: 12 }}
                      />
                      <Tooltip content={<CancelledEventsTooltip />} />
                      <Bar dataKey="fillRate" fill="#174f9a" radius={[0, 14, 14, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashboardChartCard>

            <DashboardChartCard
              title="Obłożenie w miesiącach"
              description="Łączna liczba osób na rosterze versus cała pula miejsc w pipeline grup."
            >
              <DashboardLegend
                items={[
                  { label: "Na rosterze", color: "#174f9a" },
                  { label: "Liczba miejsc", color: "#88aee0" },
                ]}
              />
              <div className="h-[220px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={organizerCapacityByMonthData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#6982a0" />
                    <YAxis allowDecimals={false} stroke="#6982a0" />
                    <Tooltip content={<CapacityByMonthTooltip />} />
                    <Bar dataKey="enrolledCount" fill="#174f9a" radius={[10, 10, 0, 0]} />
                    <Bar dataKey="totalCapacity" fill="#88aee0" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DashboardChartCard>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xl font-semibold leading-tight text-brand-navy sm:text-2xl">
              Jak spływają zgłoszenia do grupowych szkoleń
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <DashboardChartCard
              title="Zgłoszenia udziału w miesiącach"
              description="Nowe prośby o dołączenie do szkoleń Emandar policzone po miesiącu utworzenia."
            >
              {organizerAnalyticsRequestsInRange.length === 0 ? (
                <DashboardChartEmptyState message="Brak zgłoszeń udziału w bieżącym oknie 3 miesięcy." />
              ) : (
                <div className="h-[220px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={organizerRequestsByMonthData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                      <XAxis dataKey="label" stroke="#6982a0" />
                      <YAxis allowDecimals={false} stroke="#6982a0" />
                      <Tooltip content={<RequestsByMonthTooltip />} />
                      <Bar dataKey="total" fill="#174f9a" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashboardChartCard>

            <DashboardChartCard
              title="Statusy zgłoszeń udziału"
              description="Accepted, pending i rejected są liczone z requestów, także po syncu do rosteru."
            >
              {organizerAnalyticsRequestsInRange.length === 0 ? (
                <DashboardChartEmptyState message="Brak zgłoszeń udziału do pokazania w tym okresie." />
              ) : (
                <>
                  <DashboardLegend
                    items={[
                      { label: "Potwierdzono", color: "#0ea5a4" },
                      { label: "Oczekujące", color: "#174f9a" },
                      { label: "Odrzucono", color: "#c84b4b" },
                    ]}
                  />
                  <div className="h-[220px] sm:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={organizerRequestDecisionsByMonthData}
                        margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                        <XAxis dataKey="label" stroke="#6982a0" />
                        <YAxis allowDecimals={false} stroke="#6982a0" />
                        <Tooltip content={<RequestDecisionsTooltip />} />
                        <Bar dataKey="accepted" stackId="status" fill="#0ea5a4" />
                        <Bar dataKey="pending" stackId="status" fill="#174f9a" />
                        <Bar dataKey="rejected" stackId="status" fill="#c84b4b" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </DashboardChartCard>
          </div>
        </section>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
          <article className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6">
            <h3 className="text-xl font-semibold text-brand-navy sm:text-2xl">
              Najbliższe grupy do ogarnięcia
            </h3>
            <div className="mt-5 space-y-4">
              {(organizerOfficialDashboard?.groupSummaries ?? []).slice(0, 4).map((summary) => (
                <div
                  key={summary.group.id}
                  className="rounded-3xl border border-brand-line bg-brand-shell p-4"
                >
                  <p className="font-semibold text-brand-navy">{summary.group.name}</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    Aktywni członkowie: {summary.activeMemberCount}
                  </p>
                  <p className="text-sm text-brand-muted">
                    Terminy w pipeline: {summary.upcomingEventCount}
                  </p>
                  <p className="text-sm text-brand-muted">
                    Czekają na decyzję: {summary.pendingRequestCount}
                  </p>
                  <p className="mt-2 text-sm text-brand-navy">
                    Najbliższy termin:{" "}
                    {summary.nextEvent
                      ? `${formatDate(summary.nextEvent.startsAt)} • ${summary.nextEvent.location}`
                      : "Brak"}
                  </p>
                </div>
              ))}
              {(organizerOfficialDashboard?.groupSummaries.length ?? 0) === 0 && (
                <p className="rounded-3xl bg-brand-shell p-4 text-brand-muted">
                  Brak aktywnych grup organizatora.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6">
            <h3 className="text-xl font-semibold text-brand-navy sm:text-2xl">
              Terminy wymagające decyzji
            </h3>
            <div className="mt-5 space-y-4">
              {(organizerOfficialDashboard?.eventsRequiringDecision ?? []).slice(0, 4).map((summary) => (
                <div
                  key={summary.event.id}
                  className="rounded-3xl border border-brand-line bg-brand-shell p-4"
                >
                  <p className="font-semibold text-brand-navy">{summary.group.name}</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {formatDate(summary.event.startsAt)} • {summary.event.location}
                  </p>
                  <p className="mt-2 text-sm text-brand-navy">
                    Oczekujące zgłoszenia: {summary.pendingRequestCount}
                  </p>
                  <p className="text-sm text-brand-muted">
                    Wolne miejsca: {summary.missingPeople} • Zapełnienie: {Math.round(summary.fillRate)}%
                  </p>
                  <p className="text-sm text-brand-muted">
                    Na rosterze: {getEventParticipantCount(summary.event)}/{summary.event.capacity}
                    {getEventOverflowCount(summary.event) > 0
                      ? ` • Nad limit: ${getEventOverflowCount(summary.event)}`
                      : ""}
                  </p>
                </div>
              ))}
              {(organizerOfficialDashboard?.eventsRequiringDecision.length ?? 0) === 0 && (
                <p className="rounded-3xl bg-brand-shell p-4 text-brand-muted">
                  Brak terminów z oczekującymi zgłoszeniami.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6">
            <h3 className="text-xl font-semibold text-brand-navy sm:text-2xl">Ostatnie powiadomienia</h3>
            <div className="mt-5 space-y-4">
              {store.notifications.slice(0, 4).map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-3xl border border-brand-line bg-brand-shell p-4"
                >
                  <p className="font-semibold text-brand-navy">{notification.title}</p>
                  <p className="mt-1 text-sm text-brand-muted">{notification.body}</p>
                </div>
              ))}
              {store.notifications.length === 0 && (
                <p className="rounded-3xl bg-brand-shell p-4 text-brand-muted">
                  Brak nowych powiadomień.
                </p>
              )}
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Szkolenia" value={relevantEvents.length} icon={CalendarDays} />
        <StatCard label="Chcą wziąć udział" value={relevantOperationalRequests.length} icon={Bell} />
        <StatCard label="Powiadomienia" value={notificationsCount} icon={ShieldCheck} />
        <StatCard label="Relacje" value={relationsCount} icon={Users} />
      </div>

      <section className="space-y-4">
        <div>
          <p className="text-xl font-semibold leading-tight text-brand-navy sm:text-2xl">
            Nadchodzace szkolenia i ile osob jeszcze brakuje
          </p>
        </div>
        <div
          className={`grid gap-4 xl:grid-cols-2 ${
            isTrainerPerspective ? "2xl:grid-cols-4" : "2xl:grid-cols-3"
          }`}
        >
          <DashboardChartCard
            title="Brakuje osob do domkniecia"
            description="Szybki podglad, ile miejsc trzeba jeszcze dopelnic w najblizszych terminach."
          >
            {missingPeopleData.length === 0 ? (
              <DashboardChartEmptyState message="Brak aktywnych albo potwierdzonych wydarzen w najblizszych 3 miesiacach." />
            ) : (
              <div style={{ height: `${getDashboardChartHeight(missingPeopleData.length)}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={missingPeopleData}
                    layout="vertical"
                    margin={{ top: 8, right: 20, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} stroke="#6982a0" />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={190}
                      tick={{ fill: "#123e78", fontSize: 12 }}
                    />
                    <Tooltip content={<MissingPeopleTooltip />} />
                    <Bar dataKey="missingPeople" fill="#174f9a" radius={[0, 14, 14, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardChartCard>

          <DashboardChartCard
            title="Zapelnienie terminow"
            description="Porownanie wydarzen wedlug procentu zapełnienia rosteru."
          >
            {fillRateData.length === 0 ? (
              <DashboardChartEmptyState message="Brak wydarzen do porownania w tym oknie czasu." />
            ) : (
              <div style={{ height: `${getDashboardChartHeight(fillRateData.length)}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fillRateData}
                    layout="vertical"
                    margin={{ top: 8, right: 20, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      stroke="#6982a0"
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={190}
                      tick={{ fill: "#123e78", fontSize: 12 }}
                    />
                    <Tooltip content={<CancelledEventsTooltip />} />
                    <Bar dataKey="fillRate" radius={[0, 14, 14, 0]}>
                      {fillRateData.map((item) => (
                        <Cell key={item.id} fill={getCommunityChartColor(item.status)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardChartCard>

          <DashboardChartCard
            title="Oblozenie w miesiacach"
            description="Laczna liczba osob na rosterze versus cala pula miejsc w nadchodzacych miesiacach."
          >
            <DashboardLegend
              items={[
                { label: "Na rosterze", color: "#174f9a" },
                { label: "Liczba miejsc", color: "#88aee0" },
              ]}
            />
            <div className="h-[220px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={capacityByMonthData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#6982a0" />
                  <YAxis allowDecimals={false} stroke="#6982a0" />
                  <Tooltip content={<CapacityByMonthTooltip />} />
                  <Bar dataKey="enrolledCount" fill="#174f9a" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="totalCapacity" fill="#88aee0" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardChartCard>

          {isTrainerPerspective && (
            <DashboardChartCard
              title="Grupy wedlug organizatorow"
              description="Ile zaplanowanych grup masz w tym samym oknie czasu u kazdego organizatora."
            >
              {organizerGroupsData.length === 0 ? (
                <DashboardChartEmptyState message="Brak zaplanowanych grup z przypisanym organizatorem w najblizszych 3 miesiacach." />
              ) : (
                <div style={{ height: `${getDashboardChartHeight(organizerGroupsData.length)}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={organizerGroupsData}
                      layout="vertical"
                      margin={{ top: 8, right: 20, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} stroke="#6982a0" />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={190}
                        tick={{ fill: "#123e78", fontSize: 12 }}
                      />
                      <Tooltip content={<OrganizerGroupsTooltip />} />
                      <Bar dataKey="plannedGroups" fill="#0f766e" radius={[0, 14, 14, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashboardChartCard>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
            Operacyjnie
          </p>
          <p className="mt-2 text-xl font-semibold leading-tight text-brand-navy sm:text-2xl">
            Jak splywaja zgloszenia i czym koncza sie terminy
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <DashboardChartCard
            title="Zgłoszenia udziału w miesiącach"
            description="Nowe prośby o dołączenie do wydarzeń policzone po miesiącu utworzenia."
          >
            {analyticsRequestsInRange.length === 0 ? (
              <DashboardChartEmptyState message="Brak zgłoszeń udziału w bieżącym oknie 3 miesięcy." />
            ) : (
              <div className="h-[220px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={requestsByMonthData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#6982a0" />
                    <YAxis allowDecimals={false} stroke="#6982a0" />
                    <Tooltip content={<RequestsByMonthTooltip />} />
                    <Bar dataKey="total" fill="#174f9a" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardChartCard>

          <DashboardChartCard
            title="Statusy zgłoszeń udziału w miesiącach"
            description="Widać, ile zgłoszeń nadal czeka, a ile jest już rozstrzygniętych."
          >
            {analyticsRequestsInRange.length === 0 ? (
              <DashboardChartEmptyState message="Brak zgłoszeń udziału do pokazania w tym okresie." />
            ) : (
              <>
                <DashboardLegend
                  items={[
                    { label: "Potwierdzono", color: "#0ea5a4" },
                    { label: "Oczekujące", color: "#174f9a" },
                    { label: "Odrzucono", color: "#c84b4b" },
                  ]}
                />
                <div className="h-[220px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={requestDecisionsByMonthData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                      <XAxis dataKey="label" stroke="#6982a0" />
                      <YAxis allowDecimals={false} stroke="#6982a0" />
                      <Tooltip content={<RequestDecisionsTooltip />} />
                      <Bar dataKey="accepted" stackId="status" fill="#0ea5a4" />
                      <Bar dataKey="pending" stackId="status" fill="#174f9a" />
                      <Bar dataKey="rejected" stackId="status" fill="#c84b4b" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </DashboardChartCard>

          <DashboardChartCard
            title="Potwierdzenia i anulacje"
            description="Miesieczny wynik wydarzen, ktore doszly do skutku albo wypadly z kalendarza."
          >
            <DashboardLegend
              items={[
                { label: "Potwierdzone", color: "#0ea5a4" },
                { label: "Anulowane", color: "#c84b4b" },
              ]}
            />
            <div className="h-[220px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={eventOutcomesByMonthData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#6982a0" />
                  <YAxis allowDecimals={false} stroke="#6982a0" />
                  <Tooltip content={<EventOutcomesTooltip />} />
                  <Bar dataKey="confirmed" fill="#0ea5a4" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="cancelled" fill="#c84b4b" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardChartCard>
        </div>
      </section>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6">
          <h3 className="text-xl font-semibold text-brand-navy sm:text-2xl">Najbliższe szkolenia</h3>
          <div className="mt-5 space-y-4">
            {sortEventsByDate(relevantEvents)
              .slice(0, 4)
              .map((event) => (
                <div
                  key={event.id}
                  className="rounded-3xl border border-brand-line bg-brand-shell p-4"
                >
                  <p className="font-semibold text-brand-navy">{event.title}</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {formatDate(event.startsAt)} • {event.location}
                  </p>
                </div>
              ))}
            {relevantEvents.length === 0 && (
              <p className="rounded-3xl bg-brand-shell p-4 text-brand-muted">
                Brak wydarzeń dla tej perspektywy.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6">
          <h3 className="text-xl font-semibold text-brand-navy sm:text-2xl">Ostatnie powiadomienia</h3>
          <div className="mt-5 space-y-4">
            {store.notifications.slice(0, 4).map((notification) => (
              <div
                key={notification.id}
                className="rounded-3xl border border-brand-line bg-brand-shell p-4"
              >
                <p className="font-semibold text-brand-navy">{notification.title}</p>
                <p className="mt-1 text-sm text-brand-muted">{notification.body}</p>
              </div>
            ))}
            {store.notifications.length === 0 && (
              <p className="rounded-3xl bg-brand-shell p-4 text-brand-muted">
                Brak nowych powiadomień.
              </p>
            )}
          </div>
        </article>
      </div>

      {isTrainerPerspective && isCommunityTrainer && (
        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
              KPI wydarzen spolecznosci
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-brand-navy">
              Jak wypelniaja sie Twoje otwarte i potwierdzone wydarzenia
            </h3>
            <p className="mt-2 text-brand-muted">
              Sloty liczymy jako laczna liczbe miejsc we wszystkich aktywnych i potwierdzonych
              wydarzeniach spolecznosci.
            </p>
          </div>

          {!hasCommunityKpiData ? (
            <div className="mt-6">
              <EmptyPanelState
                title="Brak danych do KPI"
                description="Gdy dodasz aktywne lub potwierdzone wydarzenia spolecznosci, zobaczysz tu agregacje miejsc i ranking wypelnienia."
              />
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  label="Aktywne wydarzenia"
                  value={activeCommunityStats.eventCount}
                  icon={CalendarDays}
                />
                <StatCard
                  label="Sloty aktywne"
                  value={activeCommunityStats.totalCapacity}
                  icon={Users}
                />
                <StatCard
                  label="Wolne miejsca aktywne"
                  value={activeCommunityStats.totalRemainingPlaces}
                  icon={Bell}
                />
                <StatCard
                  label="Potwierdzone wydarzenia"
                  value={confirmedCommunityStats.eventCount}
                  icon={ShieldCheck}
                />
                <StatCard
                  label="Sloty potwierdzone"
                  value={confirmedCommunityStats.totalCapacity}
                  icon={Users}
                />
                <StatCard
                  label="Wolne miejsca potwierdzone"
                  value={confirmedCommunityStats.totalRemainingPlaces}
                  icon={CalendarDays}
                />
              </div>

              <div className="mt-6 rounded-[2rem] border border-brand-line bg-brand-shell p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xl font-semibold text-brand-navy">
                      Ranking wypelnienia miejsc
                    </h4>
                    <p className="mt-1 text-sm text-brand-muted">
                      Najlepiej i najslabiej performujace wydarzenia wedlug procentu zapelnienia.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
                    <span className="rounded-full bg-brand-navy px-3 py-1 text-white">
                      Aktywne
                    </span>
                    <span className="rounded-full bg-[#0ea5a4] px-3 py-1 text-white">
                      Potwierdzone
                    </span>
                  </div>
                </div>

                <div className="mt-6 h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={communityPerformanceData}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#d7e5f2" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                        stroke="#6982a0"
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={180}
                        tick={{ fill: "#123e78", fontSize: 12 }}
                      />
                      <Tooltip content={<CommunityPerformanceTooltip />} />
                      <Bar dataKey="fillRate" radius={[0, 14, 14, 0]}>
                        {communityPerformanceData.map((item) => (
                          <Cell
                            key={item.id}
                            fill={getCommunityChartColor(item.status)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </article>
      )}
    </div>
  );
}

function RoleAwareDashboardView({
  confirmEnrollmentAttendance,
  currentUser,
  notificationsCount,
  store,
}: {
  confirmEnrollmentAttendance: (token: string, decision: "confirm" | "decline") => Promise<void>;
  currentUser: AppUser;
  notificationsCount: number;
  store: DemoStore;
}) {
  const perspectives = useMemo(
    () => getDashboardPerspectives(currentUser),
    [currentUser],
  );
  const [activePerspective, setActivePerspective] = useState<DashboardPerspective>(
    perspectives[0] ?? "participant",
  );

  useEffect(() => {
    if (!perspectives.includes(activePerspective)) {
      setActivePerspective(perspectives[0] ?? "participant");
    }
  }, [activePerspective, perspectives]);

  return (
    <PanelSection
      eyebrow={getRoleLabel(currentUser.role)}
      title={getDashboardPerspectiveTitle(activePerspective)}
      description={
        activePerspective === "participant"
          ? "Twoje zapisy, dwa najbliższe szkolenia i terminy, które nadal wymagają potwierdzenia udziału."
          : activePerspective === "organizer"
            ? "Twoje grupy, szkolenia, powiadomienia i nadchodzące akcje."
          : undefined
      }
      showLeadText
    >
      {perspectives.length > 1 ? (
        <div className="flex justify-start">
          <DashboardPerspectiveSwitch
            perspectives={perspectives}
            activePerspective={activePerspective}
            onChange={setActivePerspective}
          />
        </div>
      ) : null}

      {activePerspective === "participant" ? (
        <ParticipantDashboardPerspectiveView
          currentUser={currentUser}
          store={store}
          confirmEnrollmentAttendance={confirmEnrollmentAttendance}
        />
      ) : (
        <OperationalDashboardPerspectiveView
          currentUser={currentUser}
          notificationsCount={notificationsCount}
          perspective={activePerspective}
          store={store}
        />
      )}
    </PanelSection>
  );
}

export function DashboardPage() {
  const { confirmEnrollmentAttendance, currentUser, notificationsCount, store } = useAppState();

  if (!currentUser) {
    return null;
  }

  if (currentUser.role === "admin") {
    return (
      <PanelSection
        eyebrow={getRoleLabel(currentUser.role)}
        title="Dashboard"
        description="Legacy dashboard został usunięty. Ten widok wróci w nowej wersji."
        showLeadText
      >
        <EmptyPanelState
          title="Dashboard admina jest w przebudowie"
          description="Legacy tor raportowania został usunięty. Na ten moment użyj sekcji panelu po lewej stronie."
        />
      </PanelSection>
    );
  }

  return (
    <RoleAwareDashboardView
      confirmEnrollmentAttendance={confirmEnrollmentAttendance}
      currentUser={currentUser}
      notificationsCount={notificationsCount}
      store={store}
    />
  );
}

export function RequestsPage() {
  const {
    addGroupMember,
    currentUser,
    manageEnrollmentRequest,
    store,
  } = useAppState();

  if (!currentUser) {
    return null;
  }

  const [expandedRequestSections, setExpandedRequestSections] = useState<
    Record<EnrollmentRequestArchiveSectionKey, boolean>
  >({
    active: true,
    confirmed: false,
    rejected: false,
  });
  const [expandedRequestIds, setExpandedRequestIds] = useState<string[]>([]);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const {
    dialog: acceptedRequestGroupDialog,
    openDialog: openAcceptedRequestGroupDialog,
  } = useAcceptedRequestGroupDialog({
    addGroupMember,
  });
  const manageableEventIds = new Set(
    store.trainingEvents
      .filter((event) => canManageTrainingEvent(event, currentUser))
      .map((event) => event.id),
  );

  const requests = store.enrollmentRequests.filter((request) =>
    manageableEventIds.has(request.eventId),
  );
  const requestSections = splitEnrollmentRequestsByIntent(requests);

  function toggleExpandedRequest(requestId: string, open: boolean) {
    setExpandedRequestIds((previous) =>
      open
        ? Array.from(new Set([...previous, requestId]))
        : previous.filter((item) => item !== requestId),
    );
  }

  async function handleRequestDecision(
    request: EnrollmentRequest,
    event: TrainingEvent,
    decision: Extract<DecisionStatus, "accepted" | "rejected">,
  ) {
    setUpdatingRequestId(request.id);

    try {
      const acceptedTargetStatus =
        decision === "accepted" ? resolveEnrollmentAcceptanceTargetStatus(event) : null;

      await manageEnrollmentRequest(request.id, decision);
      if (decision === "accepted") {
        if (acceptedTargetStatus === "rezerwowy") {
          toast.success("Potwierdzono zgłoszenie i dodano osobę do listy rezerwowych.");
          return;
        }

        const groupAssignmentTarget = getAcceptedRequestGroupAssignmentTarget({
          request,
          event,
          store,
        });
        const addedToGroup = groupAssignmentTarget
          ? await openAcceptedRequestGroupDialog(groupAssignmentTarget)
          : false;
        toast.success(
          event.groupId
            ? addedToGroup
              ? "Potwierdzono zgłoszenie, dodano osobę do rosteru i do grupy."
              : "Potwierdzono zgłoszenie i dodano osobę do rosteru wydarzenia."
            : "Potwierdzono zgłoszenie.",
        );
      } else {
        toast.success("Odrzucono zgłoszenie.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zaktualizować zgłoszenia.",
      );
    } finally {
      setUpdatingRequestId(null);
    }
  }

  return (
    <PanelSection
      eyebrow="Chcą wziąć udział"
      title="Osoby, które chcą wziąć udział"
      showLeadText={false}
    >
      <div className="space-y-4">
        {requests.length === 0 && (
          <EmptyPanelState
            title="Brak zgłoszeń"
            description="Archiwum zgłoszeń do Twoich wydarzeń pojawi się tutaj."
          />
        )}
        {requestSections.map((section) => (
          <EnrollmentRequestArchiveSectionBlock
            key={section.key}
            title={section.title}
            count={section.requests.length}
            open={expandedRequestSections[section.key] ?? section.defaultOpen}
            onOpenChange={(open) =>
              setExpandedRequestSections((previous) => ({
                ...previous,
                [section.key]: open,
              }))
            }
          >
            <EnrollmentRequestListSurface>
              {section.requests.map((request, index) => {
                const event = store.trainingEvents.find((item) => item.id === request.eventId);
                if (!event) {
                  return null;
                }

                const eventGroup = event.groupId
                  ? (store.groups ?? []).find((item) => item.id === event.groupId) ?? null
                  : null;
                const canDecideRequest = canManageTrainingEvent(event, currentUser);
                const isExpanded = expandedRequestIds.includes(request.id);

                return (
                  <EnrollmentRequestSlimRow
                    key={request.id}
                    request={request}
                    event={event}
                    eventGroup={eventGroup}
                    isExpanded={isExpanded}
                    onExpandedChange={(open) => toggleExpandedRequest(request.id, open)}
                    isSaving={updatingRequestId === request.id}
                    itemPosition={getEnrollmentRequestListItemPosition(index, section.requests.length)}
                  >
                    <div className="space-y-4">
                      <EnrollmentRequestMetaRow request={request} />
                      <EnrollmentRequestMessageBlock request={request} />

                      <EnrollmentPhotoCard request={request} />

                      {canDecideRequest ? (
                        <EnrollmentRequestDecisionButtons
                          finalStatus={resolveEnrollmentRequestDisplayStatus(request)}
                          acceptHint={getEnrollmentAcceptanceHint(event)}
                          disabled={updatingRequestId === request.id}
                          onDecision={(decision) =>
                            void handleRequestDecision(request, event, decision)
                          }
                        />
                      ) : null}
                    </div>
                  </EnrollmentRequestSlimRow>
                );
              })}
            </EnrollmentRequestListSurface>
          </EnrollmentRequestArchiveSectionBlock>
        ))}
        {acceptedRequestGroupDialog}
      </div>
    </PanelSection>
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

function GroupListSlimRow({
  activeMemberCount,
  eventCount,
  group,
  isExpanded,
  isOwnedGroup,
  isParticipantGroupViewer,
  nearestEventLabel,
  onExpandedChange,
  trainerName,
}: {
  activeMemberCount: number;
  eventCount: number;
  group: Group;
  isExpanded: boolean;
  isOwnedGroup: boolean;
  isParticipantGroupViewer: boolean;
  nearestEventLabel: string | null;
  onExpandedChange: (open: boolean) => void;
  trainerName: string;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandedChange}>
      <article
        className={cn(
          "bg-white px-6 py-3",
          "sm:rounded-3xl sm:border sm:bg-white sm:p-4 sm:shadow-soft",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {isOwnedGroup && !isParticipantGroupViewer ? (
                <span className="rounded-full bg-brand-navy/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-navy sm:text-xs sm:tracking-[0.2em]">
                  Twoja grupa
                </span>
              ) : null}
              <span className="rounded-full bg-brand-sky/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-sky-deep sm:text-xs sm:tracking-[0.2em]">
                {group.status === "active" ? "Aktywna" : "Archiwum"}
              </span>
              <span className="text-xs text-brand-muted">
                {getGroupEventTypeLabel(group.defaultEventType)}
              </span>
            </div>
            <p className="mt-2 truncate text-[15px] font-semibold leading-tight text-brand-navy sm:text-lg">
              {group.name}
            </p>
          </div>

          <div className="shrink-0 text-right text-[11px] text-brand-muted sm:min-w-[132px] sm:text-sm">
            <p>{activeMemberCount} aktywnych osób</p>
            <p className="mt-1">{eventCount} {eventCount === 1 ? "wydarzenie" : "wydarzeń"}</p>
          </div>

          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-none border-l border-brand-line bg-transparent text-brand-navy sm:size-12 sm:rounded-full sm:border sm:bg-white sm:shadow-soft"
              aria-label={
                isExpanded ? `Ukryj szczegóły ${group.name}` : `Pokaż szczegóły ${group.name}`
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-brand-muted sm:text-sm">
                <span className="inline-flex items-center gap-2">
                  <Users size={14} />
                  {trainerName}
                </span>
                <span>{activeMemberCount} aktywnych osób</span>
                <span>{eventCount} {eventCount === 1 ? "wydarzenie" : "wydarzeń"}</span>
              </div>

              <p className="text-sm text-brand-muted">
                Najbliższe szkolenie:{" "}
                <span className="font-semibold text-brand-navy">
                  {nearestEventLabel ?? "Brak nadchodzącego szkolenia"}
                </span>
              </p>
            </div>

            <div className="flex items-start justify-start lg:justify-end">
              <Link
                to={`/panel/grupy/${group.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
              >
                Otwórz grupę
              </Link>
            </div>
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
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
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [isArchivedGroupsOpen, setIsArchivedGroupsOpen] = useState(false);
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [groupScope, setGroupScope] = useState<"all" | "mine">("mine");
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
  const isParticipantGroupViewer = !hasManagedGroupScope || groupScope === "all";
  const visibleGroups = useMemo(() => {
    if (isParticipantGroupViewer) {
      return joinedGroups;
    }

    return managedGroups;
  }, [isParticipantGroupViewer, joinedGroups, managedGroups]);
  const { active: activeVisibleGroups, archived: archivedVisibleGroups } = useMemo(
    () => splitGroupsByArchivedStatus(visibleGroups),
    [visibleGroups],
  );
  const isCreateGroupRoute = location.pathname === "/panel/grupy/utworz";
  const isGroupDetailView = Boolean(groupId);
  const selectedGroup = groupId
    ? visibleGroups.find((group) => group.id === groupId) ?? null
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
  const selectedGroupParticipantMembership = selectedGroup
    ? participantGroupMembershipsByGroupId.get(selectedGroup.id) ?? null
    : null;

  useEffect(() => {
    if (!hasManagedGroupScope && groupScope !== "all") {
      setGroupScope("all");
    }
  }, [groupScope, hasManagedGroupScope]);

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

  function toggleExpandedGroup(groupId: string, open: boolean) {
    setExpandedGroupIds((previous) => {
      if (open) {
        return previous.includes(groupId) ? previous : [...previous, groupId];
      }

      return previous.filter((id) => id !== groupId);
    });
  }

  function renderGroupRows(groups: Group[]) {
    return (
      <div className="divide-y divide-brand-line/70 border-y border-brand-line/70 bg-white sm:space-y-3 sm:divide-y-0 sm:border-y-0 sm:bg-transparent">
        {groups.map((group) => {
          const trainerName = trainersById.get(group.trainerId)?.displayName ?? "Trener";
          const isOwnedGroup = managedGroups.some((managedGroup) => managedGroup.id === group.id);

          return (
            <GroupListSlimRow
              key={group.id}
              activeMemberCount={activeMemberCounts[group.id] ?? 0}
              eventCount={groupEventCounts[group.id] ?? 0}
              group={group}
              isExpanded={expandedGroupIds.includes(group.id)}
              isOwnedGroup={isOwnedGroup}
              isParticipantGroupViewer={isParticipantGroupViewer}
              nearestEventLabel={nearestGroupEventLabels[group.id] ?? null}
              onExpandedChange={(open) => toggleExpandedGroup(group.id, open)}
              trainerName={trainerName}
            />
          );
        })}
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
            ? selectedGroup.name
            : "Grupy Emandar"
      }
      description={
        isCreateGroupRoute
          ? undefined
          : isGroupDetailView
            ? isParticipantGroupViewer
              ? "Widzisz grupę w perspektywie uczestnika. Dane administracyjne są tu ukryte."
              : "To nadrzędny kontekst dla wszystkich szkoleń Emandar przypiętych do tej grupy."
            : isParticipantGroupViewer
              ? undefined
              : canManageGroups
                ? undefined
                : "To Twoje grupy. Obecnie masz do nich tylko dostęp podglądowy."
      }
      showLeadText={isCreateGroupRoute || isGroupDetailView}
      action={
        isCreateGroupRoute ? undefined : isGroupDetailView ? (
          <div className="flex flex-wrap gap-3">
            <Link
              to="/panel/grupy"
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-soft"
            >
              <X size={16} />
              Wróć do listy
            </Link>
          </div>
        ) : undefined
      }
    >
      {!isGroupDetailView && !isCreateGroupRoute && hasManagedGroupScope ? (
        <div className="flex justify-start">
          <EventScopeSwitch
            activeScope={groupScope}
            joinedLabel="Uczestniczę"
            ownedLabel="Organizuję"
            onChange={setGroupScope}
          />
        </div>
      ) : null}

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
          {visibleGroups.length === 0 ? (
            <EmptyPanelState
              title="Brak grup"
              description={
                canCreateGroups
                  ? "Utwórz pierwszą grupę, zanim zaczniesz planować szkolenia Emandar."
                  : isParticipantGroupViewer
                    ? "Nie należysz jeszcze do żadnej grupy i nie masz jeszcze własnych grup."
                  : "Nie masz jeszcze żadnych przypisanych grup."
              }
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

          <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
              <div className="grid gap-4 md:grid-cols-2">
                <StatCard
                  label="Członkowie"
                  value={activeMemberCounts[selectedGroup.id] ?? 0}
                  icon={Users}
                />
                <StatCard
                  label="Wydarzenia"
                  value={groupEventCounts[selectedGroup.id] ?? 0}
                  icon={CalendarDays}
                />
              </div>
              <div className="mt-6 grid gap-3 rounded-3xl border border-brand-line bg-brand-shell/60 p-4 text-sm text-brand-muted md:grid-cols-2">
                <div>
                  <p className="font-semibold text-brand-navy">Trener</p>
                  <p>{trainersById.get(selectedGroup.trainerId)?.displayName ?? "Brak"}</p>
                </div>
                <div>
                  <p className="font-semibold text-brand-navy">Typ domyślny</p>
                  <p>{getGroupEventTypeLabel(selectedGroup.defaultEventType)}</p>
                </div>
                <div>
                  <p className="font-semibold text-brand-navy">Lokalizacja</p>
                  <p>{selectedGroup.defaultLocation || "Brak ustawionej lokalizacji"}</p>
                </div>
                <div>
                  <p className="font-semibold text-brand-navy">SMS potwierdzenia udziału</p>
                  <p>{selectedGroup.defaultConfirmationLeadTimeDays} dni przed wydarzeniem</p>
                </div>
                <div>
                  <p className="font-semibold text-brand-navy">Mogą dołączyć</p>
                  <p>{getTrainingJoinAudienceLabel(selectedGroup.defaultJoinAudience)}</p>
                </div>
              </div>
              {selectedGroup.notes ? (
                <div className="mt-4 rounded-3xl border border-brand-line bg-brand-shell/60 p-4 text-sm text-brand-muted">
                  {selectedGroup.notes}
                </div>
              ) : null}
              {isParticipantGroupViewer ? (
                <div className="mt-4 rounded-3xl border border-brand-line bg-brand-shell/60 p-4 text-sm text-brand-muted">
                  {selectedGroupIsManagedByCurrentUser
                    ? canManageGroups
                      ? "To Twoja grupa. W tym widoku oglądasz ją jak uczestnik, a pełne zarządzanie masz po przełączeniu na zakładkę Organizuję."
                      : "To Twoja grupa, ale w tej chwili pozostaje dostępna tylko do podglądu."
                    : selectedGroupParticipantMembership
                      ? "Należysz do tej grupy jako uczestnik. Widzisz podgląd grupy i powiązane wydarzenia, bez ustawień administracyjnych."
                      : "Widzisz tę grupę w trybie podglądu."}
                </div>
              ) : null}
              {canManageGroups && selectedGroupIsManagedByCurrentUser ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGroupId(selectedGroup.id);
                      setGroupForm(createGroupFormStateFromGroup(selectedGroup));
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-soft"
                  >
                    <ShieldCheck size={16} />
                    Edytuj grupę
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleArchiveSelectedGroup()}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 shadow-soft"
                  >
                    <Trash2 size={16} />
                    Archiwizuj
                  </button>
                  <Link
                    to={getGroupTrainingCreatePath(selectedGroup.id)}
                    state={{ headerBackPath: `/panel/grupy/${selectedGroup.id}` }}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
                  >
                    <CalendarDays size={16} />
                    Utwórz wydarzenie
                  </Link>
                </div>
              ) : null}
            </article>

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

            <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
              <SectionBlockHeading
                title="Wydarzenia grupy"
                description={
                  isParticipantGroupViewer
                    ? "Tutaj widać szkolenia przypięte do tej grupy. Szczegóły uczestnictwa sprawdzisz z poziomu listy szkoleń."
                    : "Tutaj widać wszystkie szkolenia przypięte do tej grupy i możesz szybko dodawać kolejne terminy."
                }
              />
              {canManageGroups && selectedGroupIsManagedByCurrentUser && selectedGroup.status === "active" ? (
                <div className="mt-6">
                  <Link
                    to={getGroupTrainingCreatePath(selectedGroup.id)}
                    state={{ headerBackPath: `/panel/grupy/${selectedGroup.id}` }}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
                  >
                    <CalendarDays size={16} />
                    Utwórz wydarzenie
                  </Link>
                </div>
              ) : null}
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
        </div>
      ) : null}
    </PanelSection>
  );
}

export function EventsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    createTrainingEvent,
    currentUser,
    decideTrainingEventCollaboration,
    publishTrainingEvent,
    store,
    unpublishTrainingEvent,
    uploadCommunityEventImages,
  } = useAppState();

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const highestRole = getHighestRole(currentUser);
  const hasModerationScope = hasModeratorAccess(currentUser);
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const isOrganizerManager =
    canUseOrganizerFunctions(currentUser) && Boolean(organizerProfile);
  const isTrainerManager =
    hasInheritedRole(currentUser, "trainer") && Boolean(trainerProfile);
  const hasOfficialManagementScope = isOrganizerManager || isTrainerManager;
  const isCommunityModerationSection = location.pathname.startsWith(
    "/panel/moderacja-wydarzen-spolecznosci",
  );
  const isCommunitySection =
    isCommunityModerationSection ||
    location.pathname.startsWith("/panel/wydarzenia-spolecznosci");
  const isCommunityCreatorView = location.pathname.endsWith("/wydarzenia-spolecznosci/utworz");
  const isOfficialCreatorView = location.pathname.endsWith("/szkolenia/utworz");
  const isCreatorView = isCommunityCreatorView || isOfficialCreatorView;
  const canCreateCommunityEvent = true;
  const [eventScope, setEventScope] = useState<"all" | "mine">(
    isCommunitySection ? "all" : hasOfficialManagementScope ? "mine" : "all",
  );
  const [communityModerationScope, setCommunityModerationScope] =
    useState<CommunityModerationTimelineScope>("pending");
  const participantEnrollmentRecords = useMemo(
    () =>
      getParticipantEnrollmentViewRecords({
        userId: currentUser.id,
        participantProfileId: currentUser.participantProfileId,
        store,
      }),
    [currentUser.id, currentUser.participantProfileId, store],
  );
  const participantOfficialRecords = useMemo(
    () =>
      participantEnrollmentRecords.filter((record) => !isCommunityPanelEvent(record.event)),
    [participantEnrollmentRecords],
  );
  const participantOfficialSections = useMemo(
    () => buildParticipantOfficialEnrollmentSections(participantOfficialRecords),
    [participantOfficialRecords],
  );
  const participantCommunityRecords = useMemo(
    () =>
      participantEnrollmentRecords.filter((record) => isCommunityPanelEvent(record.event)),
    [participantEnrollmentRecords],
  );
  const officialEvents = useMemo(
    () =>
      sortEventsByDate(
        store.trainingEvents.filter((event) => !isCommunityPanelEvent(event)),
      ),
    [store.trainingEvents],
  );
  const communityEvents = useMemo(
    () =>
      sortEventsByDate(
        store.trainingEvents.filter((event) => isCommunityPanelEvent(event)),
      ),
    [store.trainingEvents],
  );
  const officialListedEvents = useMemo(
    () =>
      hasModerationScope
        ? officialEvents
        : officialEvents.filter((item) => canManageTrainingEvent(item, currentUser)),
    [currentUser, hasModerationScope, officialEvents],
  );
  const ownCommunityEvents = useMemo(
    () =>
      communityEvents.filter((item) => item.creatorUserId === currentUser.id),
    [communityEvents, currentUser.id],
  );
  const listedEvents = isCommunitySection
    ? isCommunityModerationSection
      ? [...communityEvents]
          .filter((event) => {
            const isPendingEvent = isCommunityModerationPending(event);
            if (communityModerationScope === "pending") {
              return isPendingEvent;
            }
            if (isPendingEvent) {
              return false;
            }
            const isPastEvent = isEventFinished(event);
            return communityModerationScope === "past" ? isPastEvent : !isPastEvent;
          })
          .sort((left, right) => {
            if (communityModerationScope === "past") {
              return new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime();
            }

            return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
          })
      : hasModerationScope
      ? communityEvents
      : ownCommunityEvents
    : officialListedEvents;
  const isCommunityJoinedView =
    !isCommunityModerationSection && isCommunitySection && eventScope === "all";
  const isOfficialJoinedView =
    !isCommunitySection &&
    !hasModerationScope &&
    (!hasOfficialManagementScope || eventScope === "all");
  const isCommunityListView = isCommunitySection && !isCreatorView;
  const shouldShowScopeSwitch =
    !isCreatorView && !isCommunityModerationSection && (isCommunitySection || hasOfficialManagementScope);
  const eyebrow = isCommunityModerationSection
    ? "Moderacja wydarzeń społeczności"
    : isCommunitySection
      ? "Wydarzenia społeczności"
      : "Szkolenia";
  const sectionTitle = isCreatorView
    ? isCommunitySection
      ? "Utwórz wydarzenie społeczności"
      : "Utwórz szkolenie"
    : isCommunityModerationSection
      ? "Moderacja wydarzeń społeczności"
      : isCommunitySection
      ? "Wydarzenia społeczności"
      : "Szkolenia Emandar";
  const sectionDescription = isCreatorView
    ? isCommunitySection
      ? "Tutaj dodajesz wydarzenie społeczności, które po zapisie trafia bezpośrednio do moderacji admina."
      : "Tutaj dodajesz szkolenie Emandar bez mieszania go z wydarzeniami społeczności."
    : isCommunityModerationSection
      ? "Tutaj moderator albo admin widzi wszystkie wydarzenia społeczności, może przejrzeć ich status i otworzyć pełną moderację."
      : isCommunitySection
      ? "Tutaj widzisz listę wydarzeń społeczności, w których bierzesz udział albo które utworzyłeś."
      : hasModerationScope
        ? "Tutaj moderator albo admin widzi wszystkie szkolenia Emandar, także te prowadzone przez grupy i organizatorów."
      : hasOfficialManagementScope
        ? undefined
        : "Tutaj widzisz szkolenia Emandar, w których bierzesz udział.";

  const availableTrainers = useMemo(
    () =>
      isOrganizerManager && organizerProfile
        ? store.trainers.filter(
            (trainer) =>
              !isCommunityTrainerProfile(trainer.brandStatus) &&
              store.relations.some(
                (relation) =>
                  relation.organizerId === organizerProfile.id &&
                  relation.trainerId === trainer.id &&
                  relation.status === "approved",
              ),
          )
        : [],
    [isOrganizerManager, organizerProfile, store.relations, store.trainers],
  );
  const canCreateOfficialTraining = isTrainerManager || isOrganizerManager;
  const [trainerEventForm, setTrainerEventForm] = useState<TrainingEventFormState>(
    createEmptyTrainingEventFormState(),
  );
  const scheduleStartInputRef = useRef<HTMLInputElement | null>(null);
  const hasFocusedGroupCreatorScheduleRef = useRef(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [uploadingCreatorImages, setUploadingCreatorImages] = useState(false);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [togglingPublicationEventId, setTogglingPublicationEventId] = useState<string | null>(null);
  const availableOfficialGroups = useMemo(() => {
    if (isCommunitySection) {
      return [] as Group[];
    }

    if (isOrganizerManager && organizerProfile) {
      return store.groups
        .filter(
          (group) =>
            group.organizerId === organizerProfile.id && group.status === "active",
        )
        .sort((left, right) => left.name.localeCompare(right.name, "pl"));
    }

    if (isTrainerManager && trainerProfile) {
      return store.groups
        .filter(
          (group) => group.trainerId === trainerProfile.id && group.status === "active",
        )
        .sort((left, right) => left.name.localeCompare(right.name, "pl"));
    }

    return [] as Group[];
  }, [
    isCommunitySection,
    isOrganizerManager,
    isTrainerManager,
    organizerProfile,
    store.groups,
    trainerProfile,
  ]);
  const selectedOfficialGroup =
    availableOfficialGroups.find((group) => group.id === trainerEventForm.groupId) ?? null;
  const creatorSearchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const requestedOfficialGroupId = creatorSearchParams.get("groupId") ?? "";
  const returnToGroupId = creatorSearchParams.get("returnToGroupId") ?? "";
  const selectedOfficialGroupTrainerName = selectedOfficialGroup
    ? store.trainers.find((trainer) => trainer.id === selectedOfficialGroup.trainerId)?.displayName ??
      "Przekazujący Wiedzę"
    : null;
  const selectedOfficialGroupEvents = useMemo(
    () =>
      selectedOfficialGroup
        ? sortEventsByDate(
            store.trainingEvents.filter(
              (event) =>
                !isCommunityPanelEvent(event) && event.groupId === selectedOfficialGroup.id,
            ),
          )
        : [],
    [selectedOfficialGroup, store.trainingEvents],
  );

  useEffect(() => {
    if (!isCommunitySection && !hasModerationScope && !hasOfficialManagementScope && eventScope !== "all") {
      setEventScope("all");
    }
  }, [eventScope, hasModerationScope, hasOfficialManagementScope, isCommunitySection]);

  useEffect(() => {
    if (!isCommunityModerationSection && communityModerationScope !== "pending") {
      setCommunityModerationScope("pending");
    }
  }, [communityModerationScope, isCommunityModerationSection]);

  if (isCommunityModerationSection && !hasModerationScope) {
    return <Navigate to="/panel/wydarzenia-spolecznosci" replace />;
  }

  function applyOfficialGroupToTrainingForm(groupId: string) {
    const nextGroup = availableOfficialGroups.find((group) => group.id === groupId) ?? null;

    setTrainerEventForm((previous) =>
      applyOfficialGroupDefaultsToTrainingForm(previous, nextGroup, store.trainingEvents),
    );
  }

  useEffect(() => {
    if (!isOrganizerManager) {
      return;
    }

    setTrainerEventForm((previous) => {
      const nextTrainerId = previous.trainerId || availableTrainers[0]?.id || "";
      if (previous.trainerId === nextTrainerId) {
        return previous;
      }

      return {
        ...previous,
        trainerId: nextTrainerId,
      };
    });
  }, [availableTrainers, isOrganizerManager]);

  useEffect(() => {
    if (isCommunitySection) {
      return;
    }

    if (!hasOfficialManagementScope) {
      return;
    }

    const nextGroupId =
      availableOfficialGroups.find((group) => group.id === requestedOfficialGroupId)?.id ??
      availableOfficialGroups.find((group) => group.id === trainerEventForm.groupId)?.id ??
      availableOfficialGroups[0]?.id ??
      "";

    if (!nextGroupId || trainerEventForm.groupId === nextGroupId) {
      return;
    }

    applyOfficialGroupToTrainingForm(nextGroupId);
  }, [
    availableOfficialGroups,
    hasOfficialManagementScope,
    isCommunitySection,
    requestedOfficialGroupId,
    trainerEventForm.groupId,
  ]);

  useEffect(() => {
    if (!isOfficialCreatorView || !returnToGroupId) {
      hasFocusedGroupCreatorScheduleRef.current = false;
      return;
    }

    if (
      hasFocusedGroupCreatorScheduleRef.current ||
      trainerEventForm.groupId !== returnToGroupId
    ) {
      return;
    }

    hasFocusedGroupCreatorScheduleRef.current = true;
    window.requestAnimationFrame(() => {
      scheduleStartInputRef.current?.focus();
    });
  }, [isOfficialCreatorView, returnToGroupId, trainerEventForm.groupId]);

  if (isOfficialCreatorView && !canCreateOfficialTraining) {
    return <Navigate to="/panel/szkolenia" replace />;
  }

  if (isCommunityCreatorView && !canCreateCommunityEvent) {
    return <Navigate to="/panel/wydarzenia-spolecznosci" replace />;
  }

  return (
    <PanelSection
      eyebrow={eyebrow}
      title={sectionTitle}
      description={sectionDescription}
      showLeadText={!isCommunityListView}
    >
      {isCommunityModerationSection ? (
        <div className="flex justify-start">
          <CommunityModerationTimelineSwitch
            activeScope={communityModerationScope}
            onChange={setCommunityModerationScope}
          />
        </div>
      ) : null}

      {shouldShowScopeSwitch ? (
        <div className="flex justify-start">
          <EventScopeSwitch
            activeScope={eventScope}
            joinedLabel="Uczestniczę"
            ownedLabel="Organizuję"
            onChange={setEventScope}
          />
        </div>
      ) : null}

      {isCreatorView ? (
        isCommunitySection ? (
          <CommunityEventMutationForm
            values={getCommunityEventEditorValuesFromTrainingForm(trainerEventForm)}
            uploadingImages={uploadingCreatorImages}
            submitting={creatingEvent}
            submitLabel="Wyślij wydarzenie do moderacji"
            helperMessage="Po zapisie wydarzenie trafi do moderacji admina. Publikacja następuje dopiero po akceptacji Dariusza albo roli admin."
            onChange={(updater) =>
              setTrainerEventForm((previous) =>
                applyCommunityEventEditorValuesToTrainingForm(
                  previous,
                  updater(getCommunityEventEditorValuesFromTrainingForm(previous)),
                ),
              )
            }
            onUploadImages={async (files) => {
              const availableSlots = Math.max(0, 8 - trainerEventForm.eventImages.length);
              const filesToUpload = files.slice(0, availableSlots);

              if (filesToUpload.length === 0) {
                toast.error("Do wydarzenia możesz dodać maksymalnie 8 zdjęć.");
                return;
              }

              setUploadingCreatorImages(true);

              try {
                const uploadedImages = await uploadCommunityEventImages(filesToUpload);
                setTrainerEventForm((previous) => ({
                  ...previous,
                  eventImages: [...previous.eventImages, ...uploadedImages],
                }));
              } finally {
                setUploadingCreatorImages(false);
              }
            }}
            onSubmit={async (submitEvent) => {
              submitEvent.preventDefault();
              setCreatingEvent(true);

              try {
                await createTrainingEvent({
                  title: trainerEventForm.title,
                  eventImages: trainerEventForm.eventImages,
                  useEventImageAsCover: trainerEventForm.useEventImageAsCover,
                  summary: trainerEventForm.summary,
                  description: trainerEventForm.description,
                  tags: parseEventTags(trainerEventForm.tags),
                  scheduleDays: buildScheduleDaysFromDrafts(
                    trainerEventForm.firstDayDate,
                    trainerEventForm.scheduleDays,
                  ),
                  type: "Wydarzenie społeczności",
                  status: trainerEventForm.status,
                  location: trainerEventForm.location,
                  capacity: Number(trainerEventForm.capacity),
                  minimumParticipants: Number(trainerEventForm.minimumParticipants),
                  confirmationLeadTimeDays: Number(trainerEventForm.confirmationLeadTimeDays),
                  isPublished: false,
                  brandStatus: "supported",
                });
                toast.success("Wydarzenie zostało wysłane do moderacji.");
                setTrainerEventForm((previous) => ({
                  ...previous,
                  ...createEmptyTrainingEventFormState(),
                  isPublished: false,
                }));
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Nie udało się zapisać wydarzenia.",
                );
              } finally {
                setCreatingEvent(false);
              }
            }}
          />
        ) : !isCommunitySection && hasOfficialManagementScope && availableOfficialGroups.length === 0 ? (
          <EmptyPanelState
            title="Najpierw utwórz grupę"
            description="Oficjalne szkolenie musi być przypięte do grupy. Najpierw dodaj albo aktywuj grupę, a potem wróć do kreatora szkolenia."
          />
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setCreatingEvent(true);

              try {
                const officialCapacity = Math.max(
                  1,
                  Number(trainerEventForm.capacity) || selectedOfficialGroup?.defaultCapacity || 20,
                );
                const officialMinimumParticipants = Math.max(
                  1,
                  Number(trainerEventForm.minimumParticipants) || officialCapacity,
                );
                const officialConfirmationLeadTimeDays = Math.max(
                  0,
                  Number(trainerEventForm.confirmationLeadTimeDays) ||
                    selectedOfficialGroup?.defaultConfirmationLeadTimeDays ||
                    5,
                );
                const officialLocation =
                  trainerEventForm.location.trim() || selectedOfficialGroup?.defaultLocation || "";
                const officialType = trainerEventForm.type.trim() || "Warsztat stacjonarny";

                await createTrainingEvent({
                  groupId:
                    !isCommunitySection && trainerEventForm.groupId
                      ? trainerEventForm.groupId
                      : undefined,
                  trainerId:
                    !isCommunitySection && isOrganizerManager
                      ? trainerEventForm.trainerId
                      : undefined,
                  title: isCommunitySection ? trainerEventForm.title : undefined,
                  eventImages: isCommunitySection ? trainerEventForm.eventImages : undefined,
                  useEventImageAsCover:
                    isCommunitySection ? trainerEventForm.useEventImageAsCover : undefined,
                  organizerId: undefined,
                  summary: trainerEventForm.summary,
                  description: trainerEventForm.description,
                  tags: parseEventTags(trainerEventForm.tags),
                  scheduleDays: buildScheduleDaysFromDrafts(
                    trainerEventForm.firstDayDate,
                    trainerEventForm.scheduleDays,
                  ),
                  type: isCommunitySection
                    ? "Wydarzenie społeczności"
                    : officialType,
                  status: trainerEventForm.status,
                  location: isCommunitySection ? trainerEventForm.location : officialLocation,
                  capacity: isCommunitySection
                    ? Number(trainerEventForm.capacity)
                    : officialCapacity,
                  minimumParticipants: isCommunitySection
                    ? Number(trainerEventForm.minimumParticipants)
                    : officialMinimumParticipants,
                  confirmationLeadTimeDays: isCommunitySection
                    ? Number(trainerEventForm.confirmationLeadTimeDays)
                    : officialConfirmationLeadTimeDays,
                  isPublished: isCommunitySection ? false : trainerEventForm.isPublished,
                  brandStatus: isCommunitySection ? "supported" : undefined,
                  joinAudienceSetting:
                    isCommunitySection
                      ? undefined
                      : getPersistedJoinAudienceSetting(
                          trainerEventForm.joinAudience,
                          selectedOfficialGroup,
                        ),
                  eventTypeSystem:
                    !isCommunitySection && selectedOfficialGroup
                      ? selectedOfficialGroup.defaultEventType
                      : undefined,
                  selfManagedByTrainer: undefined,
                });
                toast.success(
                  isCommunitySection
                    ? "Wydarzenie zostało wysłane do moderacji."
                    : "Szkolenie zostało dodane.",
                );
                if (!isCommunitySection && returnToGroupId) {
                  navigate(`/panel/grupy/${returnToGroupId}`);
                  return;
                }

                setTrainerEventForm((previous) => ({
                  ...createEmptyTrainingEventFormState(),
                  ...(isCommunitySection
                    ? {}
                    : applyOfficialGroupDefaultsToTrainingForm(
                        createEmptyTrainingEventFormState(),
                        selectedOfficialGroup,
                        store.trainingEvents,
                      )),
                  summary: isCommunitySection ? "" : previous.summary,
                  description: isCommunitySection ? "" : previous.description,
                  isPublished: !isCommunitySection,
                  selfManagedByTrainer: false,
                }));
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Nie udało się zapisać wydarzenia.",
                );
              } finally {
                setCreatingEvent(false);
              }
            }}
            className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
          >
            <div className="grid gap-4 xl:grid-cols-2">
              {!isCommunitySection &&
                hasOfficialManagementScope && (
                <label className="grid gap-2 xl:col-span-2">
                  <span className="text-sm font-semibold text-brand-navy">Grupa</span>
                  <select
                    required
                    value={trainerEventForm.groupId}
                    onChange={(event) => applyOfficialGroupToTrainingForm(event.target.value)}
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                  >
                    {availableOfficialGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!isCommunitySection &&
                selectedOfficialGroup &&
                hasOfficialManagementScope && (
                <div className="rounded-3xl border border-brand-line bg-brand-shell/70 p-4 xl:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                        Wybrana grupa
                      </p>
                      <p className="mt-2 text-lg font-semibold text-brand-navy">
                        {selectedOfficialGroup.name}
                      </p>
                      <p className="mt-1 text-sm text-brand-muted">
                        Trener: {selectedOfficialGroupTrainerName}
                      </p>
                      <p className="mt-1 text-sm text-brand-muted">
                        Mogą dołączyć: {getTrainingJoinAudienceLabel(selectedOfficialGroup.defaultJoinAudience)}
                      </p>
                    </div>
                    <p className="text-sm text-brand-muted">
                      {selectedOfficialGroupEvents.length === 0
                        ? "Brak zaplanowanych szkoleń tej grupy."
                        : `${selectedOfficialGroupEvents.length} zaplanowanych szkoleń.`}
                    </p>
                  </div>

                  {selectedOfficialGroupEvents.length > 0 ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {selectedOfficialGroupEvents.slice(0, 4).map((event) => (
                        <div
                          key={`${selectedOfficialGroup.id}-${event.id}`}
                          className="rounded-2xl border border-brand-line bg-white px-4 py-3"
                        >
                          <p className="text-sm font-semibold text-brand-navy">
                            {getPanelScheduleRangeLabel(event)}
                          </p>
                          <p className="mt-1 text-sm text-brand-muted">{event.location}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <p className="mt-4 text-sm text-brand-muted">
                    Formularz startuje z trenerem i ustawieniami tej grupy. Datę oraz godziny ustawisz niżej.
                  </p>
                </div>
              )}

              {!isCommunitySection &&
                isOrganizerManager && (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">
                    Przekazujący Wiedzę
                  </span>
                  <select
                    required
                    value={trainerEventForm.trainerId}
                    onChange={(event) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        trainerId: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                    disabled={isOrganizerManager && Boolean(selectedOfficialGroup)}
                  >
                    {availableTrainers.map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!isCommunitySection && !isCommunityTrainer && hasOfficialManagementScope && (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Typ szkolenia</span>
                  <input
                    value={trainerEventForm.type}
                    onChange={(event) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        type: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                  />
                </label>
              )}

              {isCommunitySection && (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Tytuł wydarzenia</span>
                  <input
                    required
                    value={trainerEventForm.title}
                    onChange={(event) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        title: event.target.value,
                      }))
                    }
                    placeholder="np. Kajaki nad Bugiem"
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                  />
                </label>
              )}

              <label className={`grid gap-2 ${isCommunitySection ? "" : "xl:col-span-2"}`}>
                <span className="text-sm font-semibold text-brand-navy">
                  {isCommunitySection ? "Lokalizacja" : "Nagłówek miejsca"}
                </span>
                <input
                  required={isCommunitySection}
                  value={trainerEventForm.location}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      location: event.target.value,
                    }))
                  }
                  placeholder="np. Warszawa, dolnośląskie"
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className={`${isCommunitySection ? "grid gap-2 xl:col-span-2" : "grid gap-2"}`}>
                <span className="text-sm font-semibold text-brand-navy">Status wydarzenia</span>
                <select
                  value={trainerEventForm.status}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      status: event.target.value as TrainingEventStatus,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                >
                  <option value="active">Aktywne</option>
                  <option value="confirmed">Potwierdzone zorganizowanie</option>
                  <option value="cancelled">Anulowane</option>
                </select>
              </label>

              <label className="grid gap-2 xl:col-span-2">
                <span className="text-sm font-semibold text-brand-navy">
                  {isCommunitySection
                    ? "Krótka informacja o wydarzeniu"
                    : "Krótka informacja od organizatora (opcjonalnie)"}
                </span>
                <textarea
                  required={isCommunitySection}
                  rows={3}
                  maxLength={180}
                  value={trainerEventForm.summary}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      summary: event.target.value,
                    }))
                  }
                  className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="grid gap-2 xl:col-span-2">
                <span className="text-sm font-semibold text-brand-navy">
                  {isCommunitySection
                    ? "Informacja do prośby o dołączenie"
                    : "Dłuższy opis na widoku szczegółowym (opcjonalnie)"}
                </span>
                <textarea
                  required={isCommunitySection}
                  rows={6}
                  value={trainerEventForm.description}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
                {isCommunitySection && (
                  <span className="text-sm text-brand-muted">
                    Ten tekst pokaże się osobie przed wysłaniem prośby o dołączenie.
                  </span>
                )}
              </label>

              <label className="grid gap-2 xl:col-span-2">
                <span className="text-sm font-semibold text-brand-navy">Tagi wydarzenia</span>
                <input
                  value={trainerEventForm.tags}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      tags: event.target.value,
                    }))
                  }
                  placeholder="np. ognisko, pożywienie, nocleg, samodzielna kuchnia"
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
                <span className="text-sm text-brand-muted">
                  Oddziel tagi przecinkami. Pokażą się publicznie jako chmura tagów.
                </span>
              </label>

              <div className="grid gap-2 xl:col-span-2">
                {isCommunitySection && (
                  <EventGalleryField
                    images={trainerEventForm.eventImages}
                    useEventImageAsCover={trainerEventForm.useEventImageAsCover}
                    uploading={uploadingCreatorImages}
                    disabled={creatingEvent}
                    onUpload={async (files) => {
                      const availableSlots = Math.max(0, 8 - trainerEventForm.eventImages.length);
                      const filesToUpload = files.slice(0, availableSlots);

                      if (filesToUpload.length === 0) {
                        toast.error("Do wydarzenia możesz dodać maksymalnie 8 zdjęć.");
                        return;
                      }

                      setUploadingCreatorImages(true);

                      try {
                        const uploadedImages = await uploadCommunityEventImages(filesToUpload);
                        setTrainerEventForm((previous) => ({
                          ...previous,
                          eventImages: [...previous.eventImages, ...uploadedImages],
                        }));
                      } finally {
                        setUploadingCreatorImages(false);
                      }
                    }}
                    onRemove={(imageId) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        eventImages: previous.eventImages.filter((image) => image.id !== imageId),
                        useEventImageAsCover:
                          previous.eventImages.filter((image) => image.id !== imageId).length > 0
                            ? previous.useEventImageAsCover
                            : false,
                      }))
                    }
                    onToggleUseEventImageAsCover={(nextValue) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        useEventImageAsCover: nextValue && previous.eventImages.length > 0,
                      }))
                    }
                    onMakePrimary={(imageId) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        eventImages: moveEventImageToFront(previous.eventImages, imageId),
                      }))
                    }
                  />
                )}
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">Pierwszy dzień szkolenia</span>
                <input
                  ref={scheduleStartInputRef}
                  required
                  type="date"
                  value={trainerEventForm.firstDayDate}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      firstDayDate: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">Liczba dni szkolenia</span>
                <input
                  min={1}
                  type="number"
                  value={trainerEventForm.scheduleDays.length}
                  onChange={(event) => {
                    const nextDayCount = Math.max(1, Number(event.target.value) || 1);
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      scheduleDays: resizeScheduleDayDrafts(
                        nextDayCount,
                        previous.scheduleDays,
                      ),
                    }));
                  }}
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <div className="grid gap-4 xl:col-span-2 xl:grid-cols-4">
                {trainerEventForm.scheduleDays.map((day, index) => {
                  const draftScheduleDays = buildScheduleDaysFromDrafts(
                    trainerEventForm.firstDayDate,
                    trainerEventForm.scheduleDays,
                  );

                  return (
                    <div
                      key={`creator-day-${index + 1}`}
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
                            type="time"
                            value={day.startTime}
                            onChange={(event) =>
                              setTrainerEventForm((previous) => ({
                                ...previous,
                                scheduleDays: previous.scheduleDays.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, startTime: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                            className="rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-brand-navy">Godzina końca</span>
                          <input
                            required
                            type="time"
                            value={day.endTime}
                            onChange={(event) =>
                              setTrainerEventForm((previous) => ({
                                ...previous,
                                scheduleDays: previous.scheduleDays.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, endTime: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                            className="rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none"
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
                  min={1}
                  type="number"
                  value={trainerEventForm.capacity}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      capacity: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">
                  Próg potwierdzenia wydarzenia
                </span>
                <input
                  required
                  min={1}
                  type="number"
                  value={trainerEventForm.minimumParticipants}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      minimumParticipants: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">
                  SMS potwierdzenia udziału
                </span>
                <input
                  min={0}
                  type="number"
                  value={trainerEventForm.confirmationLeadTimeDays}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      confirmationLeadTimeDays: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              {!isCommunitySection ? (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Mogą dołączyć</span>
                  <select
                    value={trainerEventForm.joinAudience}
                    onChange={(event) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        joinAudience: event.target.value as TrainingEventFormState["joinAudience"],
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                  >
                    <option value="existing-practitioners">Tylko Ćwiczący</option>
                    <option value="new-people">Nowe osoby</option>
                  </select>
                </label>
              ) : null}

              {!isCommunitySection ? (
                <div className="text-sm text-brand-muted xl:col-span-2">
                  Ile dni przed wydarzeniem wysłać SMS z prośbą o potwierdzenie udziału.
                  {selectedOfficialGroup
                    ? " Domyślnie ta wartość startuje z ustawień grupy."
                    : ""}
                </div>
              ) : null}

              {isCommunitySection ? (
                <div className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-sm text-brand-muted xl:col-span-2">
                  Po zapisie wydarzenie trafi do moderacji admina. Publikacja następuje dopiero po akceptacji Dariusza albo roli admin.
                </div>
              ) : (
                <label className="flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy xl:col-span-2">
                  <input
                    type="checkbox"
                    checked={trainerEventForm.isPublished}
                    onChange={(event) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        isPublished: event.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm font-semibold">Od razu opublikuj szkolenie</span>
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={creatingEvent}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {creatingEvent
                ? "Zapisywanie..."
                : isCommunitySection
                  ? "Wyślij wydarzenie do moderacji"
                  : "Dodaj szkolenie"}
            </button>
          </form>
        )
      ) : !isCreatorView && isOfficialJoinedView ? (
        <div className="space-y-6">
          {participantOfficialSections.length === 0 ? (
            <EmptyPanelState
              title="Brak aktywnych szkoleń"
              description="Gdy zgłosisz się na szkolenie Emandar albo trafisz na roster, pojawi się ono tutaj w odpowiedniej sekcji."
            />
          ) : (
            <div className="-mx-6 space-y-5 sm:mx-0 sm:space-y-6">
              {participantOfficialSections.map((section) => (
                <section key={section.key} className="space-y-1.5 sm:space-y-3">
                  <div className="flex items-center gap-2 px-6 sm:px-1">
                    <span className="rounded-full bg-brand-navy/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-navy sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.2em]">
                      {section.title}
                    </span>
                    <div className="h-px flex-1 bg-brand-line/80" />
                    <span className="text-[11px] text-brand-muted sm:text-xs">
                      {section.records.length}
                    </span>
                  </div>

                  <div className="space-y-4 px-6 sm:px-0">
                    {section.records.map((record) =>
                      record.kind === "request" ? (
                        <ParticipantPendingEnrollmentRequestCard
                          key={record.request.id}
                          record={record}
                        />
                      ) : (
                        <ParticipantGroupEventCard
                          key={record.eventParticipant.id}
                          record={record}
                        />
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : !isCreatorView && isCommunityModerationSection ? (
        <div className="space-y-4">
          {listedEvents.length === 0 ? (
            <EmptyPanelState
              title={
                communityModerationScope === "pending"
                  ? "Brak wydarzeń oczekujących"
                  : communityModerationScope === "future"
                    ? "Brak przyszłych wydarzeń"
                    : "Brak przeszłych wydarzeń"
              }
              description={
                communityModerationScope === "pending"
                  ? "Community eventy pojawią się tutaj automatycznie, gdy tylko trafią do systemu."
                  : communityModerationScope === "future"
                    ? "Zaakceptowane albo odrzucone wydarzenia z przyszłymi terminami pojawią się tutaj."
                    : "Wydarzenia po zakończeniu terminu pojawią się tutaj automatycznie."
              }
            />
          ) : (
            listedEvents.map((event) => (
              <CommunityEventCard
                key={event.id}
                event={event}
                statusItems={getCommunityStatusRowItems(event)}
                renderActionSlot={() => (
                  <Link
                    to={`${getPanelEventDetailPath(event)}?view=moderation`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
                  >
                    Otwórz moderację
                  </Link>
                )}
              />
            ))
          )}
        </div>
      ) : !isCreatorView && isCommunitySection ? (
        <div className="space-y-6">
          {isCommunityJoinedView ? (
            <div className="space-y-4">
              {participantCommunityRecords.length === 0 ? (
                <EmptyPanelState
                  title="Nie bierzesz jeszcze udziału w żadnym wydarzeniu społeczności"
                  description="Kiedy dołączysz do community eventu, pojawi się on tutaj."
                />
              ) : (
                participantCommunityRecords.map((record) => (
                  <CommunityEventCard
                    key={record.kind === "request" ? record.request.id : record.eventParticipant.id}
                    event={record.event}
                    statusItems={[
                      {
                        label: "Status udziału",
                        value:
                          record.kind === "request"
                            ? getEnrollmentFinalStatusLabel(record.displayStatus)
                            : getEventParticipantStatusLabel(record.eventParticipant.status),
                      },
                    ]}
                    renderActionSlot={() => {
                      const organizerPhone = resolveCommunityEventOrganizerPhone(record.event, store);
                      const organizerPhoneHref = buildPhoneHref(organizerPhone);

                      if (!organizerPhoneHref) {
                        return (
                          <span className="inline-flex items-center justify-center rounded-full border border-brand-line bg-brand-shell px-5 py-3 text-sm font-semibold text-brand-muted">
                            Numer organizatora niedostępny
                          </span>
                        );
                      }

                      return (
                        <a
                          href={organizerPhoneHref}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
                        >
                          Kontakt z Organizatorem
                          <Phone size={16} />
                        </a>
                      );
                    }}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {ownCommunityEvents.length === 0 ? (
                <EmptyPanelState
                  title="Nie masz jeszcze własnych wydarzeń"
                  description="Dodaj pierwsze wydarzenie społeczności, a pojawi się tutaj z bieżącym statusem moderacji."
                />
              ) : (
                ownCommunityEvents.map((event) => (
                  <CommunityEventCard
                    key={event.id}
                    event={event}
                    statusItems={getCommunityStatusRowItems(event)}
                    renderActionSlot={() => (
                      <>
                        <Link
                          to={getPanelEventDetailPath(event)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-soft"
                        >
                          Szczegóły wydarzenia
                        </Link>
                        {event.isPublished ? (
                          <button
                            type="button"
                            disabled={togglingPublicationEventId === event.id}
                            onClick={async () => {
                              setTogglingPublicationEventId(event.id);
                              try {
                                await unpublishTrainingEvent(event.id);
                                toast.success("Publikacja została wyłączona.");
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Nie udało się wyłączyć publikacji.",
                                );
                              } finally {
                                setTogglingPublicationEventId(null);
                              }
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
                          >
                            {togglingPublicationEventId === event.id
                              ? "Wyłączanie..."
                              : "Wyłącz z publikacji"}
                          </button>
                        ) : canPublishTrainingEvent(event) ? (
                          <button
                            type="button"
                            disabled={togglingPublicationEventId === event.id}
                            onClick={async () => {
                              setTogglingPublicationEventId(event.id);
                              try {
                                await publishTrainingEvent(event.id);
                                toast.success("Wydarzenie zostało opublikowane.");
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Nie udało się opublikować wydarzenia.",
                                );
                              } finally {
                                setTogglingPublicationEventId(null);
                              }
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
                          >
                            {togglingPublicationEventId === event.id
                              ? "Publikowanie..."
                              : "Publikuj wydarzenie"}
                          </button>
                        ) : null}
                      </>
                    )}
                  />
                ))
              )}
            </div>
          )}
        </div>
      ) : !isCreatorView ? (
        <div className="space-y-4">
          {listedEvents.length === 0 && (
            <EmptyPanelState
              title={isCommunitySection ? "Brak wydarzeń społeczności" : "Brak szkoleń"}
              description={
                isCommunitySection
                  ? "Tutaj pojawią się Twoje wydarzenia społeczności po ich dodaniu."
                  : "Tutaj pojawią się szkolenia Emandar, którymi zarządzasz."
              }
            />
          )}
          {listedEvents.map((event) => {
            const eventRequests = store.enrollmentRequests.filter(
              (item) => item.eventId === event.id,
            );
            const activeRequestsCount = eventRequests.filter((item) =>
              event.groupId
                ? !item.eventParticipantId && item.finalStatus !== "rejected"
                : item.finalStatus !== "rejected",
            ).length;
            const canDecideCollaboration =
              !isCommunitySection &&
              canDecideTrainingEventCollaboration(event, currentUser);
            const ownerLabels = getEventOwnerLabel(event, store);
            const listTitle = getEventCardTitle(event, currentUser, store);
            const locationParts = getEventLocationParts(event.location);
            const listEyebrow = isCommunitySection ? "Wydarzenie społeczności" : event.title;
            const collaborationNotice = !isCommunitySection
              ? getEventCollaborationNotice(event)
              : null;
            const scheduleRangeLabel = getPanelScheduleRangeLabel(event);
            const scheduleDays = getTrainingEventScheduleDays(event);
            const canOpenEventDetails =
              !(currentUser.role === "organizer" && isTrainingEventArchived(event));
            const eventDetailPath = isCommunityModerationSection
              ? `${getPanelEventDetailPath(event)}?view=moderation`
              : getPanelEventDetailPath(event);

            return (
              <article
                key={event.id}
                className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                      {listEyebrow}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-brand-navy">
                      {listTitle}
                    </h3>
                    <p className="mt-2 text-brand-muted">{event.summary}</p>
                  </div>
                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    {canOpenEventDetails ? (
                      <Link
                        to={eventDetailPath}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
                      >
                        {isCommunitySection ? "Otwórz wydarzenie" : "Otwórz szkolenie"}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-shell px-5 py-3 text-sm font-semibold text-brand-muted">
                        Zarchiwizowane
                      </span>
                    )}
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                        {event.isPublished ? "opublikowane" : "ukryte"}
                      </span>
                      {isCommunitySection && event.publicationApprovalStatus ? (
                        <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                          {event.publicationApprovalStatus === "accepted"
                            ? "moderacja zaakceptowana"
                            : event.publicationApprovalStatus === "rejected"
                              ? "moderacja odrzucona"
                              : "w moderacji"}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                        {getEventLifecycleLabel(event)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm text-brand-muted">
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <span>{scheduleRangeLabel}</span>
                    <span>{getEventParticipantCountLabel(event)} miejsc</span>
                    {getEventConfirmedCountLabel(event) ? (
                      <span>{getEventConfirmedCountLabel(event)}</span>
                    ) : null}
                    {getEventCapacityOverflowLabel(event) ? (
                      <span>{getEventCapacityOverflowLabel(event)}</span>
                    ) : null}
                    <span>Próg: {resolveMinimumParticipants(event)} osób</span>
                    <span>Chcą wziąć udział: {activeRequestsCount}</span>
                    {isCommunitySection ? (
                      <span>Gospodarz: {ownerLabels.trainerName}</span>
                    ) : currentUser.role !== "organizer" ? (
                      <span>Organizator: {ownerLabels.organizerName}</span>
                    ) : null}
                    {!isCommunitySection ? (
                      <span>Przekazujący Wiedzę: {ownerLabels.trainerName}</span>
                    ) : null}
                  </div>
                  <div
                    className={`grid gap-3 ${
                      scheduleDays.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"
                    }`}
                  >
                    {scheduleDays.map((day, index) => (
                      <div
                        key={`${event.id}-schedule-${index + 1}`}
                        className="rounded-2xl bg-brand-shell px-4 py-3"
                      >
                        <div className="text-sm font-semibold text-brand-navy">
                          Dzień {index + 1}
                        </div>
                        <p>{formatDate(day.startsAt)}</p>
                        <p>
                          {formatShortTime(day.startsAt)} - {formatShortTime(day.endsAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {locationParts.extraLocationLabel && (
                  <p className="mt-3 text-sm text-brand-muted">
                    Dodatkowo: {locationParts.extraLocationLabel}
                  </p>
                )}

                {collaborationNotice && (
                  <p className="mt-4 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm font-semibold text-brand-navy">
                    {collaborationNotice}
                  </p>
                )}

                {canDecideCollaboration && (
                  <CollaborationActionBar
                    pending={savingEventId === event.id}
                    onDecision={async (status) => {
                      setSavingEventId(event.id);

                      try {
                        await decideTrainingEventCollaboration(event.id, status);
                        toast.success("Zapisano decyzję o współpracy.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zapisać decyzji.",
                        );
                      } finally {
                        setSavingEventId(null);
                      }
                    }}
                  />
                )}
              </article>
            );
          })}
        </div>
      ) : null}
    </PanelSection>
  );
}

export function EventManagementPage() {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const {
    addEventParticipant,
    addGroupMember,
    archiveTrainingEvent,
    currentUser,
    deleteTrainingEvent,
    decideTrainingEventCollaboration,
    finalizeEventRoster,
    manageEnrollmentRequest,
    publishTrainingEvent,
    store,
    unpublishTrainingEvent,
    updateEventParticipantStatus,
    updateTrainingEventBrandStatus,
    updateTrainingEventManagement,
    uploadCommunityEventImages,
  } = useAppState();
  const [archivingEvent, setArchivingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [unpublishingEvent, setUnpublishingEvent] = useState(false);
  const [uploadingSettingsImages, setUploadingSettingsImages] = useState(false);
  const [expandedRosterParticipantIds, setExpandedRosterParticipantIds] = useState<string[]>([]);
  const [expandedRequestIds, setExpandedRequestIds] = useState<string[]>([]);
  const [expandedRequestSections, setExpandedRequestSections] = useState<
    Record<EnrollmentRequestArchiveSectionKey, boolean>
  >({
    active: true,
    confirmed: false,
    rejected: false,
  });
  const [movingRequestId, setMovingRequestId] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [assigningParticipantId, setAssigningParticipantId] = useState("");
  const [savingEventParticipant, setSavingEventParticipant] = useState(false);
  const [updatingEventParticipantId, setUpdatingEventParticipantId] = useState<string | null>(null);
  const [finalizingRoster, setFinalizingRoster] = useState(false);
  const [transferSelections, setTransferSelections] = useState<Record<string, string>>({});
  const hydratedSettingsEventIdRef = useRef<string | null>(null);
  const hydratedSettingsSnapshotRef = useRef<string | null>(null);
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [communityDetailTab, setCommunityDetailTab] = useState<
    "requests" | "participants" | "reserve"
  >("requests");
  const [publishingEvent, setPublishingEvent] = useState(false);
  const {
    dialog: acceptedRequestGroupDialog,
    openDialog: openAcceptedRequestGroupDialog,
  } = useAcceptedRequestGroupDialog({
    addGroupMember,
  });
  const [settingsDraft, setSettingsDraft] = useState<EventManagementSettingsDraft>({
    status: "active" as TrainingEventStatus,
    capacity: "1",
    minimumParticipants: "1",
    confirmationLeadTimeDays: "5",
    title: "",
    location: "",
    eventImages: [] as TrainingEventImage[],
    useEventImageAsCover: false,
    summary: "",
    description: "",
    enrollmentPhotoRequirement: "default" as "default" | "required" | "optional",
    joinAudience: "new-people",
    tags: "",
    firstDayDate: "",
    scheduleDays: resizeScheduleDayDrafts(2, []),
  });
  const event = store.trainingEvents.find((item) => item.id === eventId);
  const eventGroup = event?.groupId
    ? (store.groups ?? []).find((item) => item.id === event.groupId) ?? null
    : null;
  const resolvedEventJoinAudience = event
    ? resolveTrainingJoinAudienceForEvent(event, eventGroup)
    : "new-people";
  const sectionEyebrow = location.pathname.startsWith("/panel/wydarzenia-spolecznosci")
    ? "Społeczność"
    : "Szkolenia";
  const fallbackListPath = event
    ? isCommunityPanelEvent(event) && searchParams.get("view") === "moderation"
      ? "/panel/moderacja-wydarzen-spolecznosci"
      : getPanelEventListPath(event)
    : location.pathname.startsWith("/panel/wydarzenia-spolecznosci")
      ? "/panel/wydarzenia-spolecznosci"
      : "/panel/szkolenia";
  const backListLabel =
    fallbackListPath === "/panel/moderacja-wydarzen-spolecznosci"
      ? "Wróć do moderacji"
      : fallbackListPath === "/panel/wydarzenia-spolecznosci"
        ? "Wróć do wydarzeń społeczności"
        : "Wróć do listy szkoleń";
  const isCommunityEditRoute = location.pathname.endsWith("/edytuj");

  function createEventManagementSettingsDraft(sourceEvent: TrainingEvent) {
    return {
      status: resolveTrainingEventStatus(sourceEvent.status),
      capacity: String(sourceEvent.capacity),
      minimumParticipants: String(resolveMinimumParticipants(sourceEvent)),
      confirmationLeadTimeDays: String(sourceEvent.confirmationLeadTimeDays ?? 5),
      title: sourceEvent.title ?? "",
      location: sourceEvent.location ?? "",
      eventImages: sourceEvent.eventImages ?? [],
      useEventImageAsCover: sourceEvent.useEventImageAsCover === true,
      summary: sourceEvent.summary,
      description: sourceEvent.description,
      enrollmentPhotoRequirement: sourceEvent.enrollmentPhotoRequirement ?? "default",
      joinAudience: resolveTrainingJoinAudienceForEvent(sourceEvent, eventGroup),
      tags: (sourceEvent.tags ?? []).join(", "),
      ...getScheduleDraftsFromEvent(sourceEvent),
    };
  }

  function updateSettingsDraft(
    updater: (previous: typeof settingsDraft) => typeof settingsDraft,
  ) {
    setIsSettingsDirty(true);
    setSettingsDraft((previous) => updater(previous));
  }

  useEffect(() => {
    if (!event) {
      return;
    }

    const nextDraft = createEventManagementSettingsDraft(event);
    const nextSnapshot = JSON.stringify(nextDraft);
    const isDifferentEvent = hydratedSettingsEventIdRef.current !== event.id;
    const isDifferentSnapshot = hydratedSettingsSnapshotRef.current !== nextSnapshot;

    if (!isDifferentEvent && (isSettingsDirty || !isDifferentSnapshot)) {
      return;
    }

    setSettingsDraft(nextDraft);
    hydratedSettingsEventIdRef.current = event.id;
    hydratedSettingsSnapshotRef.current = nextSnapshot;
  }, [event, isSettingsDirty]);

  if (!currentUser || !eventId) {
    return <Navigate to={fallbackListPath} replace />;
  }

  if (!event) {
    return (
      <PanelSection
        eyebrow={sectionEyebrow}
        title="Nie znaleziono wydarzenia"
        description="To wydarzenie nie jest dostępne w Twoim panelu."
      >
        <EmptyPanelState
          title="Brak dostępu do wydarzenia"
          description="Wróć do odpowiedniej listy i wybierz rekord, którym możesz zarządzać."
        />
      </PanelSection>
    );
  }

  const canManageEvent = canManageTrainingEvent(event, currentUser);
  const canModerateEvent = canModerateTrainingEvent(event, currentUser);
  const canPublishEvent = canManageEvent && canPublishTrainingEvent(event);
  const eventIsArchived = isTrainingEventArchived(event);
  const isCommunityEvent = isCommunityBrandStatus(event.brandStatus);
  const isEventOrganizerOwner =
    Boolean(event.organizerId) && currentUser.organizerProfileId === event.organizerId;
  const canUseOrganizerRosterTools =
    (isEventOrganizerOwner || currentUser.role === "admin") && !eventIsArchived;
  const canDecideCollaboration =
    !isCommunityEvent && canDecideTrainingEventCollaboration(event, currentUser);
  const canModerateCommunityPublication =
    canModerateEvent && isCommunityEvent && event.publicationApprovalStatus === "pending";
  const ownerLabels = getEventOwnerLabel(event, store);
  const detailTitle = getEventCardTitle(event, currentUser, store);
  const detailEyebrow = isCommunityEvent
    ? "Wydarzenie społeczności"
    : event.title;
  const locationParts = getEventLocationParts(event.location);
  const collaborationNotice = getEventCollaborationNotice(event);
  const scheduleRangeLabel = getPanelScheduleRangeLabel(event);
  const scheduleDays = getTrainingEventScheduleDays(event);

  if (!canManageEvent && !canDecideCollaboration && !canModerateEvent) {
    return <Navigate to={fallbackListPath} replace />;
  }

  const eventRequests = store.enrollmentRequests.filter((item) => item.eventId === event.id);
  const requests = eventRequests;
  const participantProfilesById = useMemo(
    () => new Map((store.participantProfiles ?? []).map((profile) => [profile.id, profile])),
    [store.participantProfiles],
  );
  const activeGroupMembersByParticipantProfileId = useMemo(() => {
    if (!event.groupId) {
      return new Map<string, GroupMember>();
    }

    return new Map(
      (store.groupMembers ?? [])
        .filter(
          (member) =>
            member.groupId === event.groupId && member.membershipStatus === "active",
        )
        .map((member) => [member.participantProfileId, member]),
    );
  }, [event.groupId, store.groupMembers]);
  const groupEventParticipants = (store.eventParticipants ?? []).filter(
    (item) => item.eventId === event.id,
  );
  const communityParticipantSections = useMemo(
    () => buildCommunityParticipantSections(groupEventParticipants),
    [groupEventParticipants],
  );
  const communityReserveSections = useMemo(
    () => buildCommunityReserveSections(groupEventParticipants),
    [groupEventParticipants],
  );
  const communityParticipantCount = communityParticipantSections.reduce(
    (sum, section) => sum + section.participants.length,
    0,
  );
  const communityReserveCount = communityReserveSections.reduce(
    (sum, section) => sum + section.participants.length,
    0,
  );
  const managedParticipantSections = buildManagedEventParticipantSections(
    event,
    groupEventParticipants,
    activeGroupMembersByParticipantProfileId,
  );
  const assignableGroupMembers =
    event.groupId && (isEventOrganizerOwner || currentUser.role === "admin")
      ? sortParticipantRecordsByPriorityAndName(
          (store.groupMembers ?? [])
          .filter(
            (member) =>
              member.groupId === event.groupId &&
              member.membershipStatus === "active" &&
              !groupEventParticipants.some(
                (participant) => participant.participantProfileId === member.participantProfileId,
              ),
          ),
        )
      : [];
  const requestTransferOptions = useMemo(
    () =>
      buildEnrollmentRequestTransferOptions({
        currentUser,
        event,
        store,
      }),
    [currentUser, event, store],
  );
  const requestSections = splitEnrollmentRequestsByIntent(requests);
  const pendingRequestsCount =
    requestSections.find((section) => section.key === "active")?.requests.length ?? 0;

  function toggleExpandedRosterParticipant(participantId: string, open: boolean) {
    setExpandedRosterParticipantIds((previous) =>
      open
        ? Array.from(new Set([...previous, participantId]))
        : previous.filter((item) => item !== participantId),
    );
  }

  function toggleExpandedRequest(requestId: string, open: boolean) {
    setExpandedRequestIds((previous) =>
      open
        ? Array.from(new Set([...previous, requestId]))
        : previous.filter((item) => item !== requestId),
    );
  }

  async function handleEnrollmentDecision(
    request: EnrollmentRequest,
    decision: DecisionStatus,
  ) {
    setUpdatingRequestId(request.id);

    try {
      const acceptedTargetStatus =
        decision === "accepted" ? resolveEnrollmentAcceptanceTargetStatus(event) : null;

      await manageEnrollmentRequest(request.id, decision);

      if (decision === "accepted") {
        if (acceptedTargetStatus === "rezerwowy") {
          toast.success("Zaakceptowano zgłoszenie i dodano osobę do listy rezerwowych.");
          return;
        }

        const groupAssignmentTarget = getAcceptedRequestGroupAssignmentTarget({
          request,
          event,
          store,
        });
        const addedToGroup = groupAssignmentTarget
          ? await openAcceptedRequestGroupDialog(groupAssignmentTarget)
          : false;
        toast.success(
          event.groupId
            ? addedToGroup
              ? "Zaakceptowano zgłoszenie, dodano osobę do rosteru i do grupy."
              : "Zaakceptowano zgłoszenie i dodano osobę do rosteru wydarzenia."
            : "Zaakceptowano zgłoszenie.",
        );
      } else if (decision === "rejected") {
        toast.success("Odrzucono zgłoszenie.");
      } else {
        toast.success("Ustawiono zgłoszenie jako oczekujące.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zmienić statusu zgłoszenia.",
      );
    } finally {
      setUpdatingRequestId(null);
    }
  }

  async function handleEventParticipantStatusChange(
    participantId: string,
    status: EventParticipantStatus,
  ) {
    setUpdatingEventParticipantId(participantId);

    try {
      await updateEventParticipantStatus({
        eventParticipantId: participantId,
        status,
      });
      toast.success("Zmieniono status uczestnika wydarzenia.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udało się zmienić statusu uczestnika.",
      );
    } finally {
      setUpdatingEventParticipantId(null);
    }
  }

  async function handleTransferEnrollmentRequest(request: EnrollmentRequest) {
    const transferTargetEventId = transferSelections[request.id] ?? "";
    if (!transferTargetEventId) {
      return;
    }

    setMovingRequestId(request.id);

    try {
      await manageEnrollmentRequest(request.id, "pending", transferTargetEventId);
      setTransferSelections((previous) => ({
        ...previous,
        [request.id]: "",
      }));
      toast.success("Przeniesiono zgłoszenie na inny termin. Na docelowym wydarzeniu czeka na decyzję.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się przenieść osoby.",
      );
    } finally {
      setMovingRequestId(null);
    }
  }

  if (isCommunityEvent) {
    const communityEditorValues = getCommunityEventEditorValuesFromManagementDraft(
      settingsDraft,
    );

    if (isCommunityEditRoute) {
      if (!canManageEvent || eventIsArchived) {
        return <Navigate to={getPanelEventDetailPath(event)} replace />;
      }

      return (
        <PanelSection
          eyebrow={sectionEyebrow}
          title="Edytuj wydarzenie społeczności"
          description="Tutaj edytujesz istniejące wydarzenie społeczności tym samym formularzem co przy tworzeniu."
        >
          <CommunityEventMutationForm
            values={communityEditorValues}
            uploadingImages={uploadingSettingsImages}
            submitting={savingSettings}
            submitLabel="Zapisz zmiany w wydarzeniu społeczności"
            helperMessage="Edytujesz istniejące wydarzenie społeczności."
            onChange={(updater) =>
              updateSettingsDraft((previous) =>
                applyCommunityEventEditorValuesToManagementDraft(
                  previous,
                  updater(getCommunityEventEditorValuesFromManagementDraft(previous)),
                ),
              )
            }
            onUploadImages={async (files) => {
              const availableSlots = Math.max(0, 8 - settingsDraft.eventImages.length);
              const filesToUpload = files.slice(0, availableSlots);

              if (filesToUpload.length === 0) {
                toast.error("Do wydarzenia możesz dodać maksymalnie 8 zdjęć.");
                return;
              }

              setUploadingSettingsImages(true);

              try {
                const uploadedImages = await uploadCommunityEventImages(filesToUpload);
                updateSettingsDraft((previous) => ({
                  ...previous,
                  eventImages: [...previous.eventImages, ...uploadedImages],
                }));
              } finally {
                setUploadingSettingsImages(false);
              }
            }}
            onSubmit={async (submitEvent) => {
              submitEvent.preventDefault();
              setSavingSettings(true);

              try {
                await updateTrainingEventManagement(
                  event.id,
                  settingsDraft.status,
                  Number(settingsDraft.capacity) || event.capacity,
                  Number(settingsDraft.minimumParticipants) || resolveMinimumParticipants(event),
                  Number(settingsDraft.confirmationLeadTimeDays) || 0,
                  settingsDraft.title,
                  settingsDraft.location,
                  settingsDraft.summary,
                  settingsDraft.description,
                  parseEventTags(settingsDraft.tags),
                  settingsDraft.eventImages,
                  settingsDraft.useEventImageAsCover,
                  buildScheduleDaysFromDrafts(
                    settingsDraft.firstDayDate,
                    settingsDraft.scheduleDays,
                  ),
                  undefined,
                  settingsDraft.enrollmentPhotoRequirement,
                  undefined,
                );
                toast.success("Zapisano zmiany w wydarzeniu społeczności.");
                setIsSettingsDirty(false);
                navigate(getPanelEventDetailPath(event), { replace: true });
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Nie udało się zapisać zmian w wydarzeniu.",
                );
              } finally {
                setSavingSettings(false);
              }
            }}
          />
        </PanelSection>
      );
    }

    return (
      <PanelSection
        eyebrow={sectionEyebrow}
        title={detailTitle}
        description="Tutaj zarządzasz ustawieniami wydarzenia i listą osób, które chcą wziąć w nim udział."
      >
        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-brand-muted">{event.summary}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted">
                <span>{scheduleRangeLabel}</span>
                <span>Maks. miejsc: {event.capacity}</span>
                <span>Minimalny próg: {resolveMinimumParticipants(event)}</span>
                <span>
                  SMS: {event.confirmationLeadTimeDays ?? eventGroup?.defaultConfirmationLeadTimeDays ?? 0} dni
                  przed wydarzeniem
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted">
                {getCommunityStatusRowItems(event).map((item) => (
                  <span key={`${item.label}-${item.value}`}>
                    {item.label}: <span className="font-semibold text-brand-navy">{item.value}</span>
                  </span>
                ))}
              </div>
            </div>
            {canManageEvent && !eventIsArchived ? (
              <Link
                to={getCommunityEventEditPath(event.id)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
              >
                Edytuj wydarzenie
              </Link>
            ) : null}
          </div>

          <div
            className={`mt-5 grid gap-3 ${scheduleDays.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"}`}
          >
            {scheduleDays.map((day, index) => (
              <div
                key={`${event.id}-detail-day-${index + 1}`}
                className="rounded-2xl bg-brand-shell px-4 py-3"
              >
                <div className="text-sm font-semibold text-brand-navy">Dzień {index + 1}</div>
                <p>{formatDate(day.startsAt)}</p>
                <p>
                  {formatShortTime(day.startsAt)} - {formatShortTime(day.endsAt)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 text-sm text-brand-muted md:grid-cols-3">
            <p>Gospodarz: {ownerLabels.trainerName}</p>
            <p>Organizator: {ownerLabels.organizerName}</p>
            <p>Pełna lokalizacja: {locationParts.primaryLocation}</p>
          </div>

          {locationParts.extraLocationLabel ? (
            <p className="mt-3 text-sm text-brand-muted">
              Dodatkowo: {locationParts.extraLocationLabel}
            </p>
          ) : null}

          {canModerateCommunityPublication ? (
            <div className="mt-5">
              <CollaborationActionBar
                pending={savingSettings}
                acceptLabel="Zatwierdź publikację"
                rejectLabel="Odrzuć wydarzenie"
                onDecision={async (status) => {
                  setSavingSettings(true);

                  try {
                    await updateTrainingEventManagement(
                      event.id,
                      settingsDraft.status,
                      Number(settingsDraft.capacity) || event.capacity,
                      Number(settingsDraft.minimumParticipants) || resolveMinimumParticipants(event),
                      Number(settingsDraft.confirmationLeadTimeDays) || 0,
                      settingsDraft.title,
                      settingsDraft.location,
                      event.summary,
                      event.description,
                      parseEventTags(settingsDraft.tags),
                      settingsDraft.eventImages,
                      settingsDraft.useEventImageAsCover,
                      buildScheduleDaysFromDrafts(
                        settingsDraft.firstDayDate,
                        settingsDraft.scheduleDays,
                      ),
                      undefined,
                      settingsDraft.enrollmentPhotoRequirement,
                      isCommunityEvent
                        ? undefined
                        : getPersistedJoinAudienceSetting(settingsDraft.joinAudience, eventGroup),
                      status,
                    );
                    toast.success(
                      status === "accepted"
                        ? "Wydarzenie zostało zatwierdzone."
                        : "Wydarzenie zostało odrzucone.",
                    );
                    setIsSettingsDirty(false);
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Nie udało się zapisać moderacji.",
                    );
                  } finally {
                    setSavingSettings(false);
                  }
                }}
              />
            </div>
          ) : null}

          {(canManageEvent || canModerateEvent) ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {canPublishEvent ? (
                <button
                  type="button"
                  disabled={publishingEvent || unpublishingEvent || deletingEvent}
                  onClick={async () => {
                    setPublishingEvent(true);
                    try {
                      await publishTrainingEvent(event.id);
                      toast.success("Wydarzenie zostało opublikowane.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się opublikować wydarzenia.",
                      );
                    } finally {
                      setPublishingEvent(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {publishingEvent ? "Publikowanie..." : "Publikuj wydarzenie"}
                </button>
              ) : null}
              {canModerateEvent && event.isPublished ? (
                <button
                  type="button"
                  disabled={publishingEvent || unpublishingEvent || deletingEvent}
                  onClick={async () => {
                    if (!window.confirm("Wycofać publikację tego wydarzenia?")) {
                      return;
                    }

                    setUnpublishingEvent(true);
                    try {
                      await unpublishTrainingEvent(event.id);
                      toast.success("Publikacja została wycofana.");
                      setIsSettingsDirty(false);
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się wycofać publikacji.",
                      );
                    } finally {
                      setUnpublishingEvent(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                >
                  {unpublishingEvent ? "Wycofywanie..." : "Wyłącz z publikacji"}
                </button>
              ) : null}
              {canModerateEvent ? (
                <button
                  type="button"
                  disabled={publishingEvent || unpublishingEvent || deletingEvent}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Usunąć to wydarzenie całkowicie razem ze zgłoszeniami i uczestnikami?",
                      )
                    ) {
                      return;
                    }

                    setDeletingEvent(true);
                    try {
                      await deleteTrainingEvent(event.id);
                      toast.success("Wydarzenie zostało usunięte.");
                      navigate(fallbackListPath, { replace: true });
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Nie udało się usunąć wydarzenia.",
                      );
                    } finally {
                      setDeletingEvent(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
                >
                  <Trash2 size={16} />
                  {deletingEvent ? "Usuwanie..." : "Usuń całkowicie"}
                </button>
              ) : null}
              <Link
                to={fallbackListPath}
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
              >
                {backListLabel}
              </Link>
            </div>
          ) : null}

          {canModerateEvent && !canManageEvent ? (
            <p className="mt-5 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm font-semibold text-brand-navy">
              Jesteś tutaj w trybie moderacji. Możesz przeglądać rekord, wycofać publikację albo
              usunąć wydarzenie całkowicie, ale bez edycji ustawień organizacyjnych.
            </p>
          ) : null}
        </article>

        <EventDetailScopeSwitch
          activeTab={communityDetailTab}
          onChange={setCommunityDetailTab}
          requestCount={pendingRequestsCount}
          participantCountLabel={`${communityParticipantCount}/${event.capacity}`}
          reserveCount={communityReserveCount}
        />

        {communityDetailTab === "participants" ? (
          <article className="space-y-4 rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <SectionBlockHeading
              title="Uczestnicy wydarzenia"
              description="Tutaj widać osoby, które są obecnie na liście uczestników wydarzenia."
            />
            {communityParticipantSections.length === 0 ? (
              <EmptyPanelState
                title="Brak uczestników wydarzenia"
                description="Zaakceptowane osoby pojawią się tutaj po przeniesieniu na listę uczestników."
              />
            ) : (
              <ManagedEventParticipantSections
                canManageParticipant={canManageEvent}
                eventIsArchived={eventIsArchived}
                expandedParticipantIds={expandedRosterParticipantIds}
                onExpandedChange={toggleExpandedRosterParticipant}
                onStatusChange={handleEventParticipantStatusChange}
                participantProfilesById={participantProfilesById}
                sections={communityParticipantSections}
                updatingParticipantId={updatingEventParticipantId}
              />
            )}
          </article>
        ) : null}

        {communityDetailTab === "reserve" ? (
          <article className="space-y-4 rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <SectionBlockHeading
              title="Lista rezerwowych"
              description="Tutaj widać osoby odłożone na listę rezerwowych tego wydarzenia."
            />
            {communityReserveSections.length === 0 ? (
              <EmptyPanelState
                title="Brak rezerwowych"
                description="Gdy kogoś przeniesiesz na rezerwę, pojawi się tutaj."
              />
            ) : (
              <ManagedEventParticipantSections
                canManageParticipant={canManageEvent}
                eventIsArchived={eventIsArchived}
                expandedParticipantIds={expandedRosterParticipantIds}
                onExpandedChange={toggleExpandedRosterParticipant}
                onStatusChange={handleEventParticipantStatusChange}
                participantProfilesById={participantProfilesById}
                sections={communityReserveSections}
                updatingParticipantId={updatingEventParticipantId}
              />
            )}
          </article>
        ) : null}

        {communityDetailTab === "requests" ? (
          <>
            <ManagedEnrollmentRequestsSection
              canManageRequests={canManageEvent && !eventIsArchived}
              title="Zgłoszenia"
              event={event}
              eventGroup={eventGroup}
              movingRequestId={movingRequestId}
              onDecision={handleEnrollmentDecision}
              onTransfer={handleTransferEnrollmentRequest}
              onTransferSelectionChange={(requestId, nextValue) =>
                setTransferSelections((previous) => ({
                  ...previous,
                  [requestId]: nextValue,
                }))
              }
              requestSections={requestSections}
              requestTransferOptions={requestTransferOptions}
              transferSelections={transferSelections}
              updatingRequestId={updatingRequestId}
              expandedRequestIds={expandedRequestIds}
              expandedRequestSections={expandedRequestSections}
              onExpandedRequestChange={toggleExpandedRequest}
              onExpandedSectionChange={(key, open) =>
                setExpandedRequestSections((previous) => ({
                  ...previous,
                  [key]: open,
                }))
              }
            />
            {acceptedRequestGroupDialog}
          </>
        ) : null}
      </PanelSection>
    );
  }

  return (
    <PanelSection
      eyebrow={sectionEyebrow}
      title={detailTitle}
      description="Tutaj zarządzasz ustawieniami wydarzenia i listą osób, które chcą wziąć w nim udział."
    >
      <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
              {detailEyebrow}
            </p>
            <p className="mt-2 text-brand-muted">{event.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
              {event.isPublished ? "opublikowane" : "ukryte"}
            </span>
            {event.publicationApprovalStatus && (
              <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                {event.publicationApprovalStatus === "accepted"
                  ? "moderacja zaakceptowana"
                  : event.publicationApprovalStatus === "rejected"
                    ? "moderacja odrzucona"
                    : "czeka na moderację"}
              </span>
            )}
            <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
              {getEventLifecycleLabel(event)}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm text-brand-muted">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <span>{scheduleRangeLabel}</span>
            <span>Maks. miejsc: {event.capacity}</span>
            <span>Na rosterze: {getEventParticipantCountLabel(event)}</span>
            {getEventConfirmedCountLabel(event) ? (
              <span>{getEventConfirmedCountLabel(event)}</span>
            ) : null}
            {getEventCapacityOverflowLabel(event) ? (
              <span>{getEventCapacityOverflowLabel(event)}</span>
            ) : null}
            <span>Minimalny prog: {resolveMinimumParticipants(event)}</span>
            {!isCommunityEvent ? (
              <span>Mogą dołączyć: {getTrainingJoinAudienceLabel(resolvedEventJoinAudience)}</span>
            ) : null}
            <span>
              SMS: {event.confirmationLeadTimeDays ?? eventGroup?.defaultConfirmationLeadTimeDays ?? 0} dni
              przed wydarzeniem
            </span>
          </div>
          <div
            className={`grid gap-3 ${scheduleDays.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"}`}
          >
            {scheduleDays.map((day, index) => (
              <div
                key={`${event.id}-detail-day-${index + 1}`}
                className="rounded-2xl bg-brand-shell px-4 py-3"
              >
                <div className="text-sm font-semibold text-brand-navy">Dzien {index + 1}</div>
                <p>{formatDate(day.startsAt)}</p>
                <p>
                  {formatShortTime(day.startsAt)} - {formatShortTime(day.endsAt)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-brand-muted md:grid-cols-3">
          <p>Przekazujacy Wiedze: {ownerLabels.trainerName}</p>
          <p>Organizator: {ownerLabels.organizerName}</p>
          <p>Pelna lokalizacja: {locationParts.primaryLocation}</p>
        </div>

        {locationParts.extraLocationLabel && (
          <p className="mt-3 text-sm text-brand-muted">
            Dodatkowo: {locationParts.extraLocationLabel}
          </p>
        )}

        {canDecideCollaboration && (
          <CollaborationActionBar
            pending={savingSettings}
            onDecision={async (status) => {
              setSavingSettings(true);

              try {
                await decideTrainingEventCollaboration(event.id, status);
                toast.success("Zapisano decyzje o wspolpracy.");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Nie udalo sie zapisac decyzji.",
                );
              } finally {
                setSavingSettings(false);
              }
            }}
          />
        )}

        {canModerateCommunityPublication && (
          <CollaborationActionBar
            pending={savingSettings}
            acceptLabel="Zatwierdź publikację"
            rejectLabel="Odrzuć wydarzenie"
            onDecision={async (status) => {
              setSavingSettings(true);

              try {
                await updateTrainingEventManagement(
                  event.id,
                  settingsDraft.status,
                  Number(settingsDraft.capacity) || event.capacity,
                  Number(settingsDraft.minimumParticipants) || resolveMinimumParticipants(event),
                  Number(settingsDraft.confirmationLeadTimeDays) || 0,
                  isCommunityEvent ? settingsDraft.title : undefined,
                  isCommunityEvent ? settingsDraft.location : undefined,
                  undefined,
                  undefined,
                  parseEventTags(settingsDraft.tags),
                  isCommunityEvent ? settingsDraft.eventImages : undefined,
                  isCommunityEvent ? settingsDraft.useEventImageAsCover : undefined,
                  buildScheduleDaysFromDrafts(
                    settingsDraft.firstDayDate,
                    settingsDraft.scheduleDays,
                  ),
                  undefined,
                  settingsDraft.enrollmentPhotoRequirement,
                  isCommunityEvent
                    ? undefined
                    : getPersistedJoinAudienceSetting(settingsDraft.joinAudience, eventGroup),
                  status,
                );
                toast.success(
                  status === "accepted"
                    ? "Wydarzenie zostało zatwierdzone."
                    : "Wydarzenie zostało odrzucone.",
                );
                setIsSettingsDirty(false);
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Nie udało się zapisać moderacji.",
                );
              } finally {
                setSavingSettings(false);
              }
            }}
          />
        )}

        {canModerateEvent && !canManageEvent ? (
          <p className="mt-5 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm font-semibold text-brand-navy">
            Jesteś tutaj w trybie moderacji. Możesz przeglądać rekord, wycofać publikację albo
            usunąć wydarzenie całkowicie, ale bez edycji ustawień organizacyjnych.
          </p>
        ) : null}

        {collaborationNotice && (
          <p className="mt-5 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm font-semibold text-brand-navy">
            {collaborationNotice}
          </p>
        )}

        {eventIsArchived && (
          <p className="mt-5 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm font-semibold text-brand-navy">
            To szkolenie jest zarchiwizowane. Pozostaje widoczne do wgladu, ale nie przyjmuje juz zapisow ani zmian organizatora.
          </p>
        )}

        {canManageEvent && !eventIsArchived && <div className="mt-6 rounded-3xl border border-brand-line bg-brand-shell p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <SectionBlockHeading
              title="Ustawienia szkolenia"
              description="W tym miejscu ustawiasz status, limity i prog potwierdzenia."
            />
            {currentUser.role === "admin" && (
              <div className="w-full max-w-sm">
                <AdminBrandStatusSelect
                  value={event.brandStatus}
                  onChange={(brandStatus) =>
                    updateTrainingEventBrandStatus(event.id, brandStatus)
                  }
                />
              </div>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px_220px]">
            {isCommunityEvent && (
              <>
                <label className="grid gap-2 md:col-span-3">
                  <span className="text-sm font-semibold text-brand-navy">Tytuł wydarzenia</span>
                  <input
                    value={settingsDraft.title}
                    onChange={(changeEvent) =>
                      updateSettingsDraft((previous) => ({
                        ...previous,
                        title: changeEvent.target.value,
                      }))
                    }
                    placeholder="np. Kajaki nad Bugiem"
                    className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
                  />
                </label>
                <label className="grid gap-2 md:col-span-3">
                  <span className="text-sm font-semibold text-brand-navy">Lokalizacja wydarzenia</span>
                  <input
                    value={settingsDraft.location}
                    onChange={(changeEvent) =>
                      updateSettingsDraft((previous) => ({
                        ...previous,
                        location: changeEvent.target.value,
                      }))
                    }
                    placeholder="np. Drohiczyn, nad Bugiem"
                    className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
                  />
                </label>
                <div className="md:col-span-3">
                  <EventGalleryField
                    images={settingsDraft.eventImages}
                    useEventImageAsCover={settingsDraft.useEventImageAsCover}
                    uploading={uploadingSettingsImages}
                    disabled={savingSettings || archivingEvent}
                    onUpload={async (files) => {
                      const availableSlots = Math.max(0, 8 - settingsDraft.eventImages.length);
                      const filesToUpload = files.slice(0, availableSlots);

                      if (filesToUpload.length === 0) {
                        toast.error("Do wydarzenia możesz dodać maksymalnie 8 zdjęć.");
                        return;
                      }

                      setUploadingSettingsImages(true);

                      try {
                        const uploadedImages = await uploadCommunityEventImages(filesToUpload);
                        updateSettingsDraft((previous) => ({
                          ...previous,
                          eventImages: [...previous.eventImages, ...uploadedImages],
                        }));
                      } finally {
                        setUploadingSettingsImages(false);
                      }
                    }}
                    onRemove={(imageId) =>
                      updateSettingsDraft((previous) => ({
                        ...previous,
                        eventImages: previous.eventImages.filter((image) => image.id !== imageId),
                        useEventImageAsCover:
                          previous.eventImages.filter((image) => image.id !== imageId).length > 0
                            ? previous.useEventImageAsCover
                            : false,
                      }))
                    }
                    onToggleUseEventImageAsCover={(nextValue) =>
                      updateSettingsDraft((previous) => ({
                        ...previous,
                        useEventImageAsCover: nextValue && previous.eventImages.length > 0,
                      }))
                    }
                    onMakePrimary={(imageId) =>
                      updateSettingsDraft((previous) => ({
                        ...previous,
                        eventImages: moveEventImageToFront(previous.eventImages, imageId),
                      }))
                    }
                  />
                </div>
              </>
            )}
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Status szkolenia</span>
              <select
                value={settingsDraft.status}
                onChange={(changeEvent) =>
                  updateSettingsDraft((previous) => ({
                    ...previous,
                    status: changeEvent.target.value as TrainingEventStatus,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
              >
                <option value="active">Aktywne</option>
                <option value="confirmed">Potwierdzone zorganizowanie</option>
                <option value="cancelled">Anulowane</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Maks. miejsc</span>
              <input
                min={1}
                type="number"
                value={settingsDraft.capacity}
                onChange={(changeEvent) =>
                  updateSettingsDraft((previous) => ({
                    ...previous,
                    capacity: changeEvent.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Minimalny prog osob</span>
              <input
                min={1}
                type="number"
                value={settingsDraft.minimumParticipants}
                onChange={(changeEvent) =>
                  updateSettingsDraft((previous) => ({
                    ...previous,
                    minimumParticipants: changeEvent.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">
                SMS potwierdzenia udziału
              </span>
              <input
                min={0}
                type="number"
                value={settingsDraft.confirmationLeadTimeDays}
                onChange={(changeEvent) =>
                  updateSettingsDraft((previous) => ({
                    ...previous,
                    confirmationLeadTimeDays: changeEvent.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
              />
              <span className="text-xs text-brand-muted">
                {eventGroup
                  ? `Grupa bazowa ma teraz ustawione ${eventGroup.defaultConfirmationLeadTimeDays} dni.`
                  : "Dla wydarzeń społeczności ustawiasz timing bezpośrednio tutaj."}
              </span>
            </label>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Pierwszy dzien szkolenia</span>
              <input
                required
                type="date"
                value={settingsDraft.firstDayDate}
                onChange={(changeEvent) =>
                  updateSettingsDraft((previous) => ({
                    ...previous,
                    firstDayDate: changeEvent.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Liczba dni szkolenia</span>
              <input
                required
                min={1}
                type="number"
                value={settingsDraft.scheduleDays.length}
                onChange={(changeEvent) => {
                  const nextDayCount = Math.max(1, Number(changeEvent.target.value) || 1);
                  updateSettingsDraft((previous) => ({
                    ...previous,
                    scheduleDays: resizeScheduleDayDrafts(
                      nextDayCount,
                      previous.scheduleDays,
                    ),
                  }));
                }}
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
              />
            </label>
          </div>

          <label className="mt-4 grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">
              Zdjęcie w formularzu zapisu
            </span>
            <select
              value={settingsDraft.enrollmentPhotoRequirement}
              onChange={(changeEvent) =>
                updateSettingsDraft((previous) => ({
                  ...previous,
                  enrollmentPhotoRequirement: changeEvent.target.value as
                    | "default"
                    | "required"
                    | "optional",
                }))
              }
              className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
            >
              <option value="default">Dziedzicz z ustawień globalnych portalu</option>
              <option value="required">Zawsze wymagaj zdjęcia</option>
              <option value="optional">Zdjęcie opcjonalne</option>
            </select>
          </label>

          {!isCommunityEvent ? (
            <label className="mt-4 grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Mogą dołączyć</span>
              <select
                value={settingsDraft.joinAudience}
                onChange={(changeEvent) =>
                  updateSettingsDraft((previous) => ({
                    ...previous,
                    joinAudience: changeEvent.target.value as EventManagementSettingsDraft["joinAudience"],
                  }))
                }
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
              >
                <option value="existing-practitioners">Tylko Ćwiczący</option>
                <option value="new-people">Nowe osoby</option>
              </select>
              <span className="text-xs text-brand-muted">
                {eventGroup
                  ? `Grupa bazowa ma teraz ustawione ${getTrainingJoinAudienceLabel(eventGroup.defaultJoinAudience)}.`
                  : `Aktualnie to szkolenie pokazuje ${getTrainingJoinAudienceLabel(resolvedEventJoinAudience)}.`}
              </span>
            </label>
          ) : null}

          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            {settingsDraft.scheduleDays.map((day, index) => {
              const draftScheduleDays = buildScheduleDaysFromDrafts(
                settingsDraft.firstDayDate,
                settingsDraft.scheduleDays,
              );

              return (
                <div
                  key={`management-day-${index + 1}`}
                  className="rounded-3xl border border-brand-line bg-white p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                      Dzien {index + 1}
                    </p>
                    <p className="text-sm text-brand-muted">
                      {draftScheduleDays[index]?.startsAt
                        ? formatDate(draftScheduleDays[index].startsAt)
                        : "Wybierz pierwszy dzien"}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-brand-navy">Godzina startu</span>
                      <input
                        required
                        type="time"
                        value={day.startTime}
                        onChange={(changeEvent) =>
                          updateSettingsDraft((previous) => ({
                            ...previous,
                            scheduleDays: previous.scheduleDays.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    startTime: changeEvent.target.value,
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-brand-navy">Godzina konca</span>
                      <input
                        required
                        type="time"
                        value={day.endTime}
                        onChange={(changeEvent) =>
                          updateSettingsDraft((previous) => ({
                            ...previous,
                            scheduleDays: previous.scheduleDays.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    endTime: changeEvent.target.value,
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <label className="mt-4 grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">Tagi wydarzenia</span>
            <input
              value={settingsDraft.tags}
              onChange={(changeEvent) =>
                updateSettingsDraft((previous) => ({
                  ...previous,
                  tags: changeEvent.target.value,
                }))
              }
              placeholder="np. ognisko, pozywienie, nocleg, samodzielna kuchnia"
              className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
            />
            <span className="text-sm text-brand-muted">
              Oddziel tagi przecinkami. Pokaza sie publicznie jako chmura tagow.
            </span>
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={savingSettings || archivingEvent}
              onClick={async () => {
                setSavingSettings(true);

                try {
	                  await updateTrainingEventManagement(
	                    event.id,
	                    settingsDraft.status,
	                    Number(settingsDraft.capacity) || event.capacity,
	                    Number(settingsDraft.minimumParticipants) ||
	                      resolveMinimumParticipants(event),
	                    Number(settingsDraft.confirmationLeadTimeDays) || 0,
	                    isCommunityEvent ? settingsDraft.title : undefined,
	                    isCommunityEvent ? settingsDraft.location : undefined,
	                    undefined,
	                    undefined,
	                    parseEventTags(settingsDraft.tags),
	                    isCommunityEvent ? settingsDraft.eventImages : undefined,
	                    isCommunityEvent ? settingsDraft.useEventImageAsCover : undefined,
	                    buildScheduleDaysFromDrafts(
	                      settingsDraft.firstDayDate,
	                      settingsDraft.scheduleDays,
	                    ),
	                    undefined,
	                    settingsDraft.enrollmentPhotoRequirement,
	                    isCommunityEvent
	                      ? undefined
	                      : getPersistedJoinAudienceSetting(settingsDraft.joinAudience, eventGroup),
                  );
                  toast.success("Zapisano ustawienia szkolenia.");
                  setIsSettingsDirty(false);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Nie udało się zapisać ustawień szkolenia.",
                  );
                } finally {
                  setSavingSettings(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingSettings ? "Zapisywanie..." : "Zapisz ustawienia"}
            </button>
            <button
              type="button"
              disabled={savingSettings || archivingEvent}
              onClick={async () => {
                if (!window.confirm("Zarchiwizowac to szkolenie i wylaczyc nowe zapisy?")) {
                  return;
                }

                setArchivingEvent(true);

                try {
                  await archiveTrainingEvent(event.id);
                  toast.success("Szkolenie zostalo zarchiwizowane.");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Nie udalo sie zarchiwizowac szkolenia.",
                  );
                } finally {
                  setArchivingEvent(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
            >
              {archivingEvent ? "Archiwizowanie..." : "Zarchiwizuj szkolenie"}
            </button>
            <Link
              to={fallbackListPath}
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
            >
              {backListLabel}
            </Link>
          </div>
          <p className="mt-3 text-sm text-brand-muted">
            Po osiagnieciu minimalnego progu status zmieni sie automatycznie na potwierdzone.
          </p>
        </div>}

        {canModerateEvent ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {event.isPublished ? (
              <button
                type="button"
                disabled={unpublishingEvent || deletingEvent}
                onClick={async () => {
                  if (!window.confirm("Wycofać publikację tego wydarzenia?")) {
                    return;
                  }

                  setUnpublishingEvent(true);
                  try {
                    await unpublishTrainingEvent(event.id);
                    toast.success("Publikacja została wycofana.");
                    setIsSettingsDirty(false);
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Nie udało się wycofać publikacji.",
                    );
                  } finally {
                    setUnpublishingEvent(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
              >
                {unpublishingEvent ? "Wycofywanie..." : "Wycofaj publikację"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={unpublishingEvent || deletingEvent}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Usunąć to wydarzenie całkowicie razem ze zgłoszeniami i uczestnikami?",
                  )
                ) {
                  return;
                }

                setDeletingEvent(true);
                try {
                  await deleteTrainingEvent(event.id);
                  toast.success("Wydarzenie zostało usunięte.");
                  navigate(fallbackListPath, { replace: true });
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Nie udało się usunąć wydarzenia.",
                  );
                } finally {
                  setDeletingEvent(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
            >
              <Trash2 size={16} />
              {deletingEvent ? "Usuwanie..." : "Usuń całkowicie"}
            </button>
          </div>
        ) : null}
      </article>

      {event.groupId ? (
        <article className="space-y-4 rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionBlockHeading
              title="Roster wydarzenia grupowego"
              description="To jest administracyjna lista uczestników szkolenia i osób odłożonych na listę rezerwowych."
            />
            <div className="flex flex-col items-start gap-2 sm:items-end">
              {event.rosterFinalizedAt ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  roster zamknięty {formatDate(event.rosterFinalizedAt)}
                </span>
              ) : (
                <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                  roster otwarty
                </span>
              )}
              {canUseOrganizerRosterTools ? (
                <button
                  type="button"
                  disabled={finalizingRoster}
                  onClick={async () => {
                    setFinalizingRoster(true);

                    try {
                      await finalizeEventRoster(event.id);
                      toast.success("Zamknięto skład wydarzenia.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się zamknąć składu wydarzenia.",
                      );
                    } finally {
                      setFinalizingRoster(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
                >
                  {finalizingRoster ? "Zamykanie..." : "Zamknij roster"}
                </button>
              ) : null}
            </div>
          </div>
          {canUseOrganizerRosterTools ? (
            <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  value={assigningParticipantId}
                  onChange={(changeEvent) => setAssigningParticipantId(changeEvent.target.value)}
                  className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
                >
                  <option value="">Dodaj członka grupy do rosteru</option>
                  {assignableGroupMembers.map((member) => (
                    <option key={member.id} value={member.participantProfileId}>
                      {member.participantDisplayName} · {getGroupPriorityLabel(member.priority)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!assigningParticipantId || savingEventParticipant}
                  onClick={async () => {
                    if (!assigningParticipantId) {
                      return;
                    }

                    setSavingEventParticipant(true);
                    try {
                      await addEventParticipant({
                        eventId: event.id,
                        participantProfileId: assigningParticipantId,
                      });
                      setAssigningParticipantId("");
                      toast.success("Dodano uczestnika do rosteru wydarzenia.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się dodać uczestnika do wydarzenia.",
                      );
                    } finally {
                      setSavingEventParticipant(false);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
                >
                  <Users size={16} />
                  {savingEventParticipant ? "Dodawanie..." : "Dodaj do rosteru"}
                </button>
              </div>
            </div>
          ) : null}

          {managedParticipantSections.length === 0 ? (
            <EmptyPanelState
              title="Roster jest pusty"
              description="Po akceptacji zgłoszeń osoby pojawią się tutaj na liście uczestników albo rezerwowych."
            />
          ) : (
            <ManagedEventParticipantSections
              canManageParticipant={isEventOrganizerOwner || currentUser.role === "admin"}
              eventIsArchived={eventIsArchived}
              expandedParticipantIds={expandedRosterParticipantIds}
              onExpandedChange={toggleExpandedRosterParticipant}
              onStatusChange={handleEventParticipantStatusChange}
              participantProfilesById={participantProfilesById}
              sections={managedParticipantSections}
              updatingParticipantId={updatingEventParticipantId}
            />
          )}
        </article>
      ) : null}

      {canManageEvent && !eventIsArchived ? (
        <>
          <ManagedEnrollmentRequestsSection
            canManageRequests={true}
            event={event}
            eventGroup={eventGroup}
            movingRequestId={movingRequestId}
            onDecision={handleEnrollmentDecision}
            onTransfer={handleTransferEnrollmentRequest}
            onTransferSelectionChange={(requestId, nextValue) =>
              setTransferSelections((previous) => ({
                ...previous,
                [requestId]: nextValue,
              }))
            }
            requestSections={requestSections}
            requestTransferOptions={requestTransferOptions}
            transferSelections={transferSelections}
            updatingRequestId={updatingRequestId}
            expandedRequestIds={expandedRequestIds}
            expandedRequestSections={expandedRequestSections}
            onExpandedRequestChange={toggleExpandedRequest}
            onExpandedSectionChange={(key, open) =>
              setExpandedRequestSections((previous) => ({
                ...previous,
                [key]: open,
              }))
            }
          />
          {acceptedRequestGroupDialog}
        </>
      ) : null}
    </PanelSection>
  );
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

type SettingsRoleView = "base" | "trainer" | "organizer";

function SettingsRoleViewSwitch({
  views,
  activeView,
  onChange,
}: {
  views: Array<{ value: SettingsRoleView; label: string }>;
  activeView: SettingsRoleView;
  onChange: (view: SettingsRoleView) => void;
}) {
  return (
    <div className="w-full max-w-[40rem]">
      <div
        className="grid gap-1 rounded-[1.75rem] border border-brand-line bg-white p-1 shadow-soft"
        style={{ gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))` }}
      >
        {views.map((view) => (
          <button
            key={view.value}
            type="button"
            onClick={() => onChange(view.value)}
            className={`min-w-0 rounded-[1.35rem] px-3 py-2.5 text-center text-sm font-semibold transition ${
              activeView === view.value
                ? "bg-brand-navy text-white"
                : "text-brand-muted hover:text-brand-navy"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OrganizerProfileEditorCard({
  title,
  description,
  form,
  onChange,
}: {
  title: string;
  description: string;
  form: {
    displayName: string;
    contactName: string;
    location: string;
    description: string;
  };
  onChange: (
    updater: (previous: {
      displayName: string;
      contactName: string;
      location: string;
      description: string;
    }) => {
      displayName: string;
      contactName: string;
      location: string;
      description: string;
    },
  ) => void;
}) {
  return (
    <section className="rounded-[1.75rem] border border-brand-line bg-white p-5 shadow-soft sm:p-6">
      <div className="mb-5">
        <h3 className="text-xl font-semibold text-brand-navy sm:text-2xl">{title}</h3>
        <p className="mt-2 text-sm text-brand-muted">{description}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-brand-navy">Wyświetlana nazwa</span>
          <input
            required
            value={form.displayName}
            onChange={(event) =>
              onChange((previous) => ({
                ...previous,
                displayName: event.target.value,
              }))
            }
            className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-brand-navy">Lokalizacja</span>
          <input
            required
            value={form.location}
            onChange={(event) =>
              onChange((previous) => ({
                ...previous,
                location: event.target.value,
              }))
            }
            className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
        </label>

        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold text-brand-navy">Opis</span>
          <textarea
            required
            rows={8}
            value={form.description}
            onChange={(event) =>
              onChange((previous) => ({
                ...previous,
                description: event.target.value,
              }))
            }
            className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
        </label>
      </div>
    </section>
  );
}

export function ProfileSettingsPage() {
  const {
    currentUser,
    store,
    updateCommunityOrganizerProfile,
    updateOrganizerProfile,
    updateParticipantProfile,
    updateAppSettings,
    updateTrainerProfile,
  } = useAppState();
  const trainerProfile = store.trainers.find((item) => item.userId === currentUser?.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser?.id,
  );
  const [trainerForm, setTrainerForm] = useState({
    heroNote: "",
    bio: "",
    specialties: "",
    locations: "",
    authorizationCode: "",
  });
  const [organizerForm, setOrganizerForm] = useState({
    displayName: "",
    contactName: "",
    location: "",
    description: "",
  });
  const [communityOrganizerForm, setCommunityOrganizerForm] = useState({
    displayName: "",
    contactName: "",
    location: "",
    description: "",
  });
  const [participantForm, setParticipantForm] = useState({
    displayName: "",
    referralSource: "",
    notes: "",
  });
  const [activeSettingsView, setActiveSettingsView] = useState<SettingsRoleView>("base");
  const [participantAvatarDraft, setParticipantAvatarDraft] = useState<AvatarCropDraft>(
    createEmptyAvatarCropDraft(),
  );
  const [participantAvatarInteracting, setParticipantAvatarInteracting] = useState(false);
  const participantAvatarDragStateRef = useRef<AvatarCropDragState | null>(null);
  const participantAvatarPinchStateRef = useRef<AvatarCropPinchState | null>(null);
  const participantAvatarPointersRef = useRef(new Map<number, { clientX: number; clientY: number }>());
  const [appSettingsForm, setAppSettingsForm] = useState({
    signupPhotoMode: "optional" as PhotoMode,
    enrollmentPhotoMode: "optional" as PhotoMode,
    confirmationSmsTemplate: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trainerProfile) {
      return;
    }

    setTrainerForm({
      heroNote: trainerProfile.heroNote ?? "",
      bio: trainerProfile.bio ?? "",
      specialties: trainerProfile.specialties.join(", "),
      locations: trainerProfile.locations.join(", "),
      authorizationCode: "",
    });
  }, [trainerProfile?.id]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const officialOrganizerProfile = resolveOrganizerProfileVariant(organizerProfile, "official");
    const communityProfile = resolveOrganizerProfileVariant(organizerProfile, "community");

    setOrganizerForm({
      displayName: officialOrganizerProfile.displayName || currentUser.displayName || "",
      contactName: officialOrganizerProfile.contactName || "",
      location: officialOrganizerProfile.location || "",
      description: officialOrganizerProfile.description || currentUser.notes || "",
    });
    setCommunityOrganizerForm({
      displayName: communityProfile.displayName || currentUser.displayName || "",
      contactName: communityProfile.contactName || "",
      location: communityProfile.location || "",
      description: communityProfile.description || currentUser.notes || "",
    });
  }, [currentUser, organizerProfile]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setParticipantForm({
      displayName: currentUser.displayName ?? "",
      referralSource: currentUser.referralSource ?? "",
      notes: currentUser.notes ?? "",
    });
    setParticipantAvatarDraft(createEmptyAvatarCropDraft());
    participantAvatarDragStateRef.current = null;
    participantAvatarPinchStateRef.current = null;
    participantAvatarPointersRef.current.clear();
    setParticipantAvatarInteracting(false);
  }, [currentUser?.id, currentUser?.displayName, currentUser?.notes, currentUser?.referralSource]);

  useEffect(() => {
    return () => {
      if (participantAvatarDraft.revokePreviewUrl && participantAvatarDraft.previewUrl) {
        URL.revokeObjectURL(participantAvatarDraft.previewUrl);
      }
    };
  }, [participantAvatarDraft.previewUrl, participantAvatarDraft.revokePreviewUrl]);

  useEffect(() => {
    const defaultNotificationSettings = normalizeNotificationSettings(
      store.appSettings.defaultNotificationSettings,
    );
    setAppSettingsForm({
      signupPhotoMode: store.appSettings.signupPhotoMode,
      enrollmentPhotoMode: store.appSettings.enrollmentPhotoMode,
      confirmationSmsTemplate: defaultNotificationSettings.confirmationSmsTemplate,
    });
  }, [
    store.appSettings.defaultNotificationSettings,
    store.appSettings.enrollmentPhotoMode,
    store.appSettings.signupPhotoMode,
  ]);

  const canShowOrganizerSettingsView = currentUser
    ? currentUser.role !== "admin" || Boolean(organizerProfile)
    : false;
  const availableSettingsViews = useMemo<Array<{ value: SettingsRoleView; label: string }>>(
    () => [
      { value: "base", label: "Profil bazowy" },
      ...(trainerProfile ? [{ value: "trainer" as const, label: "Przekazujący" }] : []),
      ...(canShowOrganizerSettingsView
        ? [{ value: "organizer" as const, label: "Organizator" }]
        : []),
    ],
    [canShowOrganizerSettingsView, trainerProfile],
  );

  useEffect(() => {
    if (!availableSettingsViews.some((view) => view.value === activeSettingsView)) {
      setActiveSettingsView(availableSettingsViews[0]?.value ?? "base");
    }
  }, [activeSettingsView, availableSettingsViews]);

  if (!currentUser) {
    return null;
  }

  const participantAvatarPreviewStyle = getAvatarCropPreviewStyle(participantAvatarDraft);

  async function loadParticipantAvatarDraft(
    sourceUrl: string,
    options?: {
      file?: File | null;
      crop?: AvatarCropSettings;
      revokePreviewUrl?: boolean;
    },
  ) {
    const dimensions =
      options?.crop?.sourceWidth && options?.crop?.sourceHeight
        ? {
            width: options.crop.sourceWidth,
            height: options.crop.sourceHeight,
          }
        : await readImageDimensions(sourceUrl);

    setParticipantAvatarDraft((previous) => {
      if (previous.revokePreviewUrl && previous.previewUrl) {
        URL.revokeObjectURL(previous.previewUrl);
      }

      return {
        file: options?.file ?? null,
        previewUrl: sourceUrl,
        revokePreviewUrl: options?.revokePreviewUrl === true,
        naturalWidth: dimensions.width,
        naturalHeight: dimensions.height,
        zoom: options?.crop?.zoom ?? 1,
        panX: options?.crop?.panX ?? 0,
        panY: options?.crop?.panY ?? 0,
      };
    });
    participantAvatarDragStateRef.current = null;
    participantAvatarPinchStateRef.current = null;
    participantAvatarPointersRef.current.clear();
    setParticipantAvatarInteracting(false);
  }

  async function handleParticipantAvatarSelection(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!nextFile) {
      return;
    }

    const previewUrl = URL.createObjectURL(nextFile);

    try {
      await loadParticipantAvatarDraft(previewUrl, {
        file: nextFile,
        revokePreviewUrl: true,
      });
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      toast.error(
        error instanceof Error ? error.message : "Nie udało się wczytać zdjęcia.",
      );
    }
  }

  function handleParticipantAvatarPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!participantAvatarDraft.previewUrl) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    participantAvatarPointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    const pointers = Array.from(participantAvatarPointersRef.current.values());
    if (pointers.length >= 2) {
      const [first, second] = pointers;
      participantAvatarDragStateRef.current = null;
      participantAvatarPinchStateRef.current = {
        startDistance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        startZoom: participantAvatarDraft.zoom,
        startCenterX: (first.clientX + second.clientX) / 2,
        startCenterY: (first.clientY + second.clientY) / 2,
        startPanX: participantAvatarDraft.panX,
        startPanY: participantAvatarDraft.panY,
      };
    } else {
      participantAvatarPinchStateRef.current = null;
      participantAvatarDragStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: participantAvatarDraft.panX,
        startPanY: participantAvatarDraft.panY,
      };
    }
    setParticipantAvatarInteracting(true);
  }

  function handleParticipantAvatarPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!participantAvatarPointersRef.current.has(event.pointerId)) {
      return;
    }

    participantAvatarPointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    const frameWidth = Math.max(event.currentTarget.clientWidth, 1);
    const frameHeight = Math.max(event.currentTarget.clientHeight, 1);
    const pointers = Array.from(participantAvatarPointersRef.current.values());

    if (pointers.length >= 2) {
      const [first, second] = pointers;
      const pinchState = participantAvatarPinchStateRef.current;
      if (!pinchState) {
        return;
      }

      const nextDistance = Math.max(
        Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        1,
      );
      const nextCenterX = (first.clientX + second.clientX) / 2;
      const nextCenterY = (first.clientY + second.clientY) / 2;
      const distanceRatio = nextDistance / Math.max(pinchState.startDistance, 1);
      const deltaX = ((nextCenterX - pinchState.startCenterX) / frameWidth) * 200;
      const deltaY = ((nextCenterY - pinchState.startCenterY) / frameHeight) * 200;

      setParticipantAvatarDraft((previous) => ({
        ...previous,
        zoom: Math.max(1, Math.min(2.2, Math.round(pinchState.startZoom * distanceRatio * 100) / 100)),
        panX: clampAvatarPan(pinchState.startPanX + deltaX),
        panY: clampAvatarPan(pinchState.startPanY + deltaY),
      }));
      return;
    }

    const dragState = participantAvatarDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = ((event.clientX - dragState.startClientX) / frameWidth) * 200;
    const deltaY = ((event.clientY - dragState.startClientY) / frameHeight) * 200;

    setParticipantAvatarDraft((previous) => ({
      ...previous,
      panX: clampAvatarPan(dragState.startPanX + deltaX),
      panY: clampAvatarPan(dragState.startPanY + deltaY),
    }));
  }

  function handleParticipantAvatarPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    participantAvatarPointersRef.current.delete(event.pointerId);
    const pointers = Array.from(participantAvatarPointersRef.current.values());

    if (pointers.length >= 2) {
      const [first, second] = pointers;
      participantAvatarPinchStateRef.current = {
        startDistance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        startZoom: participantAvatarDraft.zoom,
        startCenterX: (first.clientX + second.clientX) / 2,
        startCenterY: (first.clientY + second.clientY) / 2,
        startPanX: participantAvatarDraft.panX,
        startPanY: participantAvatarDraft.panY,
      };
      participantAvatarDragStateRef.current = null;
      setParticipantAvatarInteracting(true);
      return;
    }

    if (pointers.length === 1) {
      const [pointer] = pointers;
      const [[pointerId]] = Array.from(participantAvatarPointersRef.current.entries());
      participantAvatarPinchStateRef.current = null;
      participantAvatarDragStateRef.current = {
        pointerId,
        startClientX: pointer.clientX,
        startClientY: pointer.clientY,
        startPanX: participantAvatarDraft.panX,
        startPanY: participantAvatarDraft.panY,
      };
      setParticipantAvatarInteracting(true);
      return;
    }

    participantAvatarDragStateRef.current = null;
    participantAvatarPinchStateRef.current = null;
    setParticipantAvatarInteracting(false);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const avatarCrop = buildAvatarCropSettings(participantAvatarDraft);

      await updateParticipantProfile({
        displayName: participantForm.displayName,
        referralSource: participantForm.referralSource,
        notes: participantForm.notes,
        avatarFile: participantAvatarDraft.file,
        avatarCrop,
      });

      toast.success("Profil bazowy został zapisany.");
      participantAvatarDragStateRef.current = null;
      participantAvatarPinchStateRef.current = null;
      participantAvatarPointersRef.current.clear();
      setParticipantAvatarInteracting(false);
      setParticipantAvatarDraft((previous) => {
        if (previous.revokePreviewUrl && previous.previewUrl) {
          URL.revokeObjectURL(previous.previewUrl);
        }

        return createEmptyAvatarCropDraft();
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zapisać profilu.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTrainerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trainerProfile) {
      return;
    }

    setSaving(true);

    try {
      await updateTrainerProfile({
        heroNote: trainerForm.heroNote,
        bio: trainerForm.bio,
        specialties: trainerForm.specialties
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        locations: trainerForm.locations
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        authorizationCode: trainerForm.authorizationCode,
      });
      toast.success("Profil Przekazującego został zapisany.");
      setTrainerForm((previous) => ({
        ...previous,
        authorizationCode: "",
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zapisać profilu trenera.",
      );
    } finally {
      setSaving(false);
    }
  }

  const participantProfileFormContent = (
    <form
      onSubmit={handleProfileSubmit}
      className="min-w-0 overflow-hidden rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6"
    >
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
          {trainerProfile ? "Profil bazowy" : "Uczestnik"}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-brand-navy sm:text-2xl">
          {trainerProfile ? "Mój profil" : "Profil uczestnika"}
        </h3>
        <p className="mt-2 text-sm text-brand-muted">
          {trainerProfile
            ? "To nadal jest jeden profil użytkownika. Przekazujący wiedzę ma tu po prostu dodatkowe ustawienia publicznego profilu i szkoleń."
            : "Ta sekcja zostaje dostępna także na wyższych poziomach roli, bo każdy organizator, trener i admin nadal zachowuje bazowe capability uczestnika."}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-3 sm:space-y-4">
          <div className="overflow-hidden rounded-[1.75rem] border border-brand-line bg-brand-shell">
            {participantAvatarDraft.previewUrl ? (
              <div
                onPointerDown={handleParticipantAvatarPointerDown}
                onPointerMove={handleParticipantAvatarPointerMove}
                onPointerUp={handleParticipantAvatarPointerEnd}
                onPointerCancel={handleParticipantAvatarPointerEnd}
                className={`relative aspect-[4/5] w-full overflow-hidden bg-brand-shell touch-none ${
                  participantAvatarInteracting ? "cursor-grabbing" : "cursor-grab"
                }`}
              >
                <img
                  src={participantAvatarDraft.previewUrl}
                  alt="Podgląd nowego zdjęcia profilowego"
                  style={participantAvatarPreviewStyle}
                  className="select-none"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy/75 via-brand-navy/25 to-transparent px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                  Przesuń zdjęcie lub użyj pinch
                </div>
                <div className="absolute right-3 top-3 flex gap-2">
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setParticipantAvatarDraft((previous) => ({
                        ...previous,
                        zoom: Math.max(1, Math.round((previous.zoom - 0.1) * 100) / 100),
                      }));
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-semibold text-brand-navy shadow-soft backdrop-blur"
                    aria-label="Zmniejsz zdjęcie"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setParticipantAvatarDraft((previous) => ({
                        ...previous,
                        zoom: Math.min(2.2, Math.round((previous.zoom + 0.1) * 100) / 100),
                      }));
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-semibold text-brand-navy shadow-soft backdrop-blur"
                    aria-label="Powiększ zdjęcie"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : currentUser.avatarUrl ? (
              <button
                type="button"
                onClick={() => {
                  void loadParticipantAvatarDraft(currentUser.avatarUrl!, {
                    crop: currentUser.avatarCrop,
                  });
                }}
                className="relative block h-52 w-full overflow-hidden text-left sm:h-64"
              >
                <AvatarMedia
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName}
                  crop={currentUser.avatarCrop}
                  className="h-full w-full"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy/70 to-transparent px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                  Dotknij zdjęcia, żeby poprawić kadr
                </div>
              </button>
            ) : (
              <div className="flex h-52 items-center justify-center bg-gradient-to-br from-brand-sky/35 to-white text-5xl font-semibold text-brand-navy/70 sm:h-64 sm:text-6xl">
                {currentUser.displayName.slice(0, 1)}
              </div>
            )}
          </div>

          <label className="grid gap-2 rounded-[1.75rem] border border-dashed border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy sm:rounded-3xl sm:py-4">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <ImagePlus size={16} />
              Nowe zdjęcie
            </span>
            <span className="inline-flex w-fit items-center justify-center rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-soft">
              Wybierz plik
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                void handleParticipantAvatarSelection(event);
              }}
              className="hidden"
            />
            <span className="text-sm text-brand-muted">
              {participantAvatarDraft.file
                ? participantAvatarDraft.file.name
                : "JPG, PNG lub WEBP do 5 MB"}
            </span>
          </label>

          {participantAvatarDraft.previewUrl ? (
            <div className="rounded-[1.5rem] border border-brand-line/70 bg-white/80 px-4 py-3 text-brand-navy shadow-soft">
              <p className="text-sm text-brand-muted">
                {participantAvatarDraft.file
                  ? "Ustaw kadr bezpośrednio na zdjęciu. Przeciągnij palcem lub myszą, użyj pinch na mobile albo `+/-` na obrazie. Zapis nastąpi dopiero po kliknięciu `Zapisz profil uczestnika`."
                  : "Poprawiasz kadr obecnego zdjęcia. Przeciągnij obraz albo użyj pinch i `+/-` na zdjęciu. Zapis nastąpi dopiero po kliknięciu `Zapisz profil uczestnika`."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setParticipantAvatarDraft((previous) => ({
                      ...previous,
                      zoom: 1,
                      panX: 0,
                      panY: 0,
                    }))
                  }
                  className="inline-flex items-center justify-center rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-soft"
                >
                  Resetuj kadr
                </button>
                <button
                  type="button"
                  onClick={() => {
                    participantAvatarDragStateRef.current = null;
                    participantAvatarPinchStateRef.current = null;
                    participantAvatarPointersRef.current.clear();
                    setParticipantAvatarInteracting(false);
                    setParticipantAvatarDraft((previous) => {
                      if (previous.revokePreviewUrl && previous.previewUrl) {
                        URL.revokeObjectURL(previous.previewUrl);
                      }

                      return createEmptyAvatarCropDraft();
                    });
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-soft"
                >
                  Cofnij nowe zdjęcie
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-4">
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-brand-navy">Imię i nazwisko</span>
            <input
              required
              value={participantForm.displayName}
              onChange={(event) =>
                setParticipantForm((previous) => ({
                  ...previous,
                  displayName: event.target.value,
                }))
              }
              className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-brand-navy">Numer telefonu</span>
            <input
              value={currentUser.phone ?? ""}
              disabled
              className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-muted outline-none"
            />
          </label>

          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-brand-navy">Skąd do nas trafiłeś?</span>
            <input
              value={participantForm.referralSource}
              onChange={(event) =>
                setParticipantForm((previous) => ({
                  ...previous,
                  referralSource: event.target.value,
                }))
              }
              placeholder="np. od znajomego, z warsztatu, z Instagrama"
              className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-brand-navy">Kilka słów o sobie</span>
            <textarea
              rows={8}
              value={participantForm.notes}
              onChange={(event) =>
                setParticipantForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
              placeholder="To pole zostaje przy Twoim profilu i pomaga potem lepiej Cię rozpoznać."
              className="w-full min-w-0 max-w-full rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
          >
            {saving ? "Zapisywanie..." : "Zapisz profil bazowy"}
          </button>
        </div>
      </div>
    </form>
  );

  const trainerProfileFormContent = trainerProfile ? (
    <form
      onSubmit={handleTrainerSubmit}
      className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6"
    >
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
          Przekazujący wiedzę
        </p>
        <h3 className="mt-2 text-xl font-semibold text-brand-navy sm:text-2xl">
          Profil Przekazującego
        </h3>
        <p className="mt-2 text-sm text-brand-muted">
          Te pola rozszerzają bazowy profil i sterują kartą publiczną, filtrowaniem szkoleń oraz
          kodem do łączenia organizatorów.
        </p>
      </div>

      <div className="grid min-w-0 gap-4">
        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-brand-navy">Krótkie motto</span>
          <input
            required
            value={trainerForm.heroNote}
            onChange={(event) =>
              setTrainerForm((previous) => ({
                ...previous,
                heroNote: event.target.value,
              }))
            }
            className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-brand-navy">Dłuższy opis o sobie</span>
          <textarea
            required
            rows={8}
            value={trainerForm.bio}
            onChange={(event) =>
              setTrainerForm((previous) => ({
                ...previous,
                bio: event.target.value,
              }))
            }
            className="w-full min-w-0 max-w-full rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-brand-navy">Tagi szkoleń</span>
          <input
            required
            value={trainerForm.specialties}
            onChange={(event) =>
              setTrainerForm((previous) => ({
                ...previous,
                specialties: event.target.value,
              }))
            }
            placeholder="np. Oddech, Regeneracja, Praca z grupą"
            className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
          <span className="text-sm text-brand-muted">Oddziel tagi przecinkami.</span>
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-brand-navy">Lokalizacje szkoleń</span>
          <input
            required
            value={trainerForm.locations}
            onChange={(event) =>
              setTrainerForm((previous) => ({
                ...previous,
                locations: event.target.value,
              }))
            }
            placeholder="np. Warszawa, Łódź, Online"
            className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
          <span className="text-sm text-brand-muted">Oddziel lokalizacje przecinkami.</span>
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-brand-navy">Kod autoryzacyjny trenera</span>
          <input
            value={trainerForm.authorizationCode}
            onChange={(event) =>
              setTrainerForm((previous) => ({
                ...previous,
                authorizationCode: event.target.value,
              }))
            }
            placeholder={
              trainerProfile.authorizationCodeConfigured
                ? "Wpisz nowy kod, aby nadpisać obecny"
                : "Ustaw kod dla uczestników i organizatorów"
            }
            className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />
          <span className="text-sm text-brand-muted">
            {trainerProfile.authorizationCodeConfigured
              ? "Aktualny kod jest ukryty. Wpisz nowy tylko wtedy, gdy chcesz go zmienić."
              : "Bez ustawionego kodu nowe konta i nowe relacje organizatorów nie zostaną aktywowane."}
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
      >
        {saving ? "Zapisywanie..." : "Zapisz profil Przekazującego"}
      </button>
    </form>
  ) : null;

  async function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedConfirmationTemplate = appSettingsForm.confirmationSmsTemplate.trim();
    if (!normalizedConfirmationTemplate) {
      toast.error("Uzupełnij globalny wzór SMS potwierdzenia.");
      return;
    }

    if (
      !normalizedConfirmationTemplate.includes("{{confirm_url}}") ||
      !normalizedConfirmationTemplate.includes("{{decline_url}}")
    ) {
      toast.error("Globalny szablon SMS musi zawierać link TAK i NIE.");
      return;
    }

    setSaving(true);

    try {
      await updateAppSettings({
        signupPhotoMode: appSettingsForm.signupPhotoMode,
        enrollmentPhotoMode: appSettingsForm.enrollmentPhotoMode,
        defaultNotificationSettings: {
          ...normalizeNotificationSettings(store.appSettings.defaultNotificationSettings),
          confirmationSmsTemplate: normalizedConfirmationTemplate,
        },
      });
      toast.success("Ustawienia aplikacji zostały zapisane.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zapisać ustawień aplikacji.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleOrganizerProfilesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await saveOrganizerProfiles({
        officialProfile: organizerForm,
        communityProfile: communityOrganizerForm,
        updateOrganizerProfile,
        updateCommunityOrganizerProfile,
      });
      toast.success("Profile organizatora zostały zapisane.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zapisać profili organizatora.",
      );
    } finally {
      setSaving(false);
    }
  }

  const organizerSettingsContent = canShowOrganizerSettingsView ? (
    <div className="space-y-6">
      <form
        onSubmit={handleOrganizerProfilesSubmit}
        className="space-y-6"
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <OrganizerProfileEditorCard
            title="Profil organizatora Emandar"
            description="Widoczny przy oficjalnych szkoleniach Emandar i relacjach organizer-trener."
            form={organizerForm}
            onChange={setOrganizerForm}
          />

          <OrganizerProfileEditorCard
            title="Profil organizatora wydarzeń społeczności"
            description="Widoczny przy wydarzeniach społeczności i Twojej roli organizatora."
            form={communityOrganizerForm}
            onChange={setCommunityOrganizerForm}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-3 ml-auto flex w-fit items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
        >
          {saving ? "Zapisywanie..." : "Zapisz profile organizatora"}
        </button>
      </form>

      <RelationsHubContent />
    </div>
  ) : null;

  return (
    <PanelSection
      eyebrow="Ustawienia"
      title="Ustawienia"
      description="To jedno miejsce zbiera profil bazowy, ustawienia ról i rzadkie konfiguracje systemowe."
    >
      <div className="space-y-6">
        <SettingsRoleViewSwitch
          views={availableSettingsViews}
          activeView={activeSettingsView}
          onChange={setActiveSettingsView}
        />

        {activeSettingsView === "base" ? participantProfileFormContent : null}
        {activeSettingsView === "trainer" ? trainerProfileFormContent : null}
        {activeSettingsView === "organizer" ? organizerSettingsContent : null}

        {hasModeratorAccess(currentUser) ? (
          <form
            onSubmit={handleSettingsSubmit}
            className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6"
          >
            <div className="mb-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                SMS
              </p>
              <h3 className="mt-2 text-xl font-semibold text-brand-navy sm:text-2xl">
                Globalny wzór SMS potwierdzenia
              </h3>
              <p className="mt-2 text-sm text-brand-muted">
                Ten szablon jest wspólny dla całej aplikacji. Organizatorzy i trenerzy ustawiają
                tylko czas wysyłki na grupach oraz wydarzeniach.
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">
                  Treść SMS potwierdzenia udziału
                </span>
                <textarea
                  rows={7}
                  value={appSettingsForm.confirmationSmsTemplate}
                  onChange={(event) =>
                    setAppSettingsForm((previous) => ({
                      ...previous,
                      confirmationSmsTemplate: event.target.value,
                    }))
                  }
                  className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
                <span className="text-sm text-brand-muted">
                  Szablon musi zawierać linki <code>{"{{confirm_url}}"}</code> i{" "}
                  <code>{"{{decline_url}}"}</code>.
                </span>
              </label>
              <div className="rounded-[1.75rem] border border-brand-line bg-brand-shell p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                  Placeholdery
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {NOTIFICATION_TEMPLATE_PLACEHOLDERS.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-brand-line bg-white px-3 py-1 text-xs font-semibold text-brand-navy"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {saving ? "Zapisywanie..." : "Zapisz wzór SMS"}
            </button>
          </form>
        ) : null}

        {currentUser.role === "admin" ? (
          <form
            onSubmit={handleSettingsSubmit}
            className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6"
          >
            <div className="mb-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                Admin
              </p>
              <h3 className="mt-2 text-xl font-semibold text-brand-navy sm:text-2xl">
                Ustawienia systemowe
              </h3>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-4 rounded-3xl border border-brand-line bg-brand-shell p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="grid gap-1">
                  <span className="text-sm font-semibold text-brand-navy">
                    Zdjęcie uczestnika przy rejestracji konta
                  </span>
                  <span className="text-sm text-brand-muted">
                    Steruje publiczną rejestracją uczestnika. Tryb wyłączony ukrywa pole
                    zdjęcia, a pozostałe tryby określają, czy zdjęcie jest opcjonalne czy
                    wymagane.
                  </span>
                </div>
                <PhotoModeSegmentedControl
                  value={appSettingsForm.signupPhotoMode}
                  onChange={(nextValue) =>
                    setAppSettingsForm((previous) => ({
                      ...previous,
                      signupPhotoMode: nextValue,
                    }))
                  }
                  disabled={saving}
                />
              </div>

              <div className="grid gap-4 rounded-3xl border border-brand-line bg-brand-shell p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="grid gap-1">
                  <span className="text-sm font-semibold text-brand-navy">
                    Zdjęcie uczestnika przy zapisie na szkolenie
                  </span>
                  <span className="text-sm text-brand-muted">
                    To globalny domyślny tryb dla szkoleń. Nadpisanie na poziomie konkretnego
                    wydarzenia nadal wygrywa.
                  </span>
                </div>
                <PhotoModeSegmentedControl
                  value={appSettingsForm.enrollmentPhotoMode}
                  onChange={(nextValue) =>
                    setAppSettingsForm((previous) => ({
                      ...previous,
                      enrollmentPhotoMode: nextValue,
                    }))
                  }
                  disabled={saving}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {saving ? "Zapisywanie..." : "Zapisz ustawienia"}
            </button>
          </form>
        ) : null}
      </div>
    </PanelSection>
  );
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

