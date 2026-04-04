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
import { CommunityEventCard } from "@/app/components/community-event-card";
import {
  OrganizerCalendarFeedsPanel,
  OrganizerGoogleCalendarExportPanel,
  OrganizerMatchedSlotsPanel,
  OrganizerTrainingDraftEditorPanel,
  OrganizerTrainingDraftListPanel,
  type OrganizerMatchedSlotView,
  type OrganizerTrainingDraftFormValues,
  type OrganizerTrainingDraftListItem,
  TrainerAvailabilityWorkspace,
} from "@/app/components/panel";
import { AvatarMedia } from "@/app/components/avatar-media";
import {
  NOTIFICATION_TEMPLATE_PLACEHOLDERS,
  normalizeNotificationSettings,
  resolveAttendanceConfirmationStatusLabel,
} from "@/domain/notifications";
import {
  aggregateEventCapacityStats,
  buildTrainerFreeDaySlices,
  canPublishTrainingEvent,
  canDecideTrainingEventCollaboration,
  canManageTrainingEvent,
  canModerateTrainingEvent,
  canUseOrganizerFunctions,
  getEnrollmentIntentLabel,
  getEventCollaborationStatusLabel,
  getAvailablePlaces,
  getEventFillRate,
  getHighestRole,
  getParticipantEnrollmentStatusLabel,
  getRoleLabel,
  getTrainingEventScheduleBounds,
  getTrainingEventScheduleDays,
  getTrainingEventStatusLabel,
  hasModeratorAccess,
  hasInheritedRole,
  isParticipantEnrollmentActive,
  isTrainingEventCollaborationAccepted,
  isTrainingEventArchived,
  isSelfManagedTrainingEvent,
  isCommunityBrandStatus,
  isOrganizerFunctionsBlocked,
  resolveEnrollmentIntent,
  resolveOrganizerCollaborationStatus,
  resolveMinimumParticipants,
  resolveTrainerCollaborationStatus,
  resolveTrainingEventWorkflowStatus,
  resolveTrainingEventStatus,
  sortEventsByDate,
  sortEventsByFillRate,
  sortTrainerProfiles,
} from "@/domain/utils";
import type {
  AvatarCropSettings,
  EmandarBrandStatus,
  EnrollmentFinalStatus,
  EnrollmentIntent,
  EnrollmentRequest,
  Group,
  GroupEventType,
  GroupMember,
  GroupMemberPriority,
  OrganizerProfile,
  ParticipantProfile,
  PhotoMode,
  TrainerProfile,
  TrainerFreeDaySliceBucket,
  TrainingEventImage,
  TrainerCalendarFeedProvider,
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

function formatDurationHours(hours: number) {
  if (Number.isInteger(hours)) {
    return `${hours} h`;
  }

  return `${hours.toFixed(1).replace(".", ",")} h`;
}

function getFreeSliceBucketLabel(bucket: TrainerFreeDaySliceBucket) {
  switch (bucket) {
    case "2-days":
      return "2 dni";
    case "3-days":
      return "3 dni";
    case "4-plus-days":
      return "Wiecej niz 3 dni";
    default:
      return "1 dzien";
  }
}

const FREE_SLICE_BUCKETS = [
  "1-day",
  "2-days",
  "3-days",
  "4-plus-days",
] as const satisfies TrainerFreeDaySliceBucket[];

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

function getAvailabilityHorizonEnd() {
  const end = new Date();
  end.setUTCMinutes(0, 0, 0);
  end.setUTCFullYear(end.getUTCFullYear() + 3);
  return end.toISOString();
}

function createOrganizerDraftFormValuesFromSlot(
  slot: OrganizerMatchedSlotView,
): OrganizerTrainingDraftFormValues {
  return {
    groupId: "",
    sharedSlotId: slot.id,
    title: `${slot.trainerName} · ${slot.location}`,
    summary: "",
    description: "",
    type: "Warsztat stacjonarny",
    location: slot.location,
    capacity: 20,
    minimumParticipants: 10,
    status: "active",
    publishAutomaticallyAfterTrainerApproval: false,
    tagsText: "",
    scheduleDays: [
      {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      },
    ],
  };
}

function createOrganizerDraftFormValuesFromEvent(
  event: TrainingEvent,
): OrganizerTrainingDraftFormValues {
  return {
    groupId: event.groupId ?? "",
    sharedSlotId: event.sharedSlotId ?? "",
    title: event.title,
    summary: event.summary,
    description: event.description,
    type: event.type,
    location: event.location,
    capacity: event.capacity,
    minimumParticipants: resolveMinimumParticipants(event),
    status: resolveTrainingEventStatus(event.status),
    publishAutomaticallyAfterTrainerApproval:
      event.publishAutomaticallyAfterTrainerApproval === true,
    tagsText: (event.tags ?? []).join(", "),
    scheduleDays: getTrainingEventScheduleDays(event),
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
};

type GroupMemberFormState = {
  participantProfileId: string;
  displayName: string;
  phone: string;
  notes: string;
  referralSource: string;
  priority: GroupMemberPriority;
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
  enrollmentPhotoRequirement: "default" | "required" | "optional";
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
    isPublished: true,
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
  };
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

const GROUP_PRIORITY_ORDER: Record<GroupMemberPriority, number> = {
  stali: 0,
  regularni: 1,
  rezerwowi: 2,
};

function getParticipantConfirmationLabel(profile?: ParticipantProfile | null) {
  if (!profile) {
    return "Brak profilu";
  }

  return profile.confirmationStatus === "confirmed" ? "Potwierdzony" : "Niepotwierdzony";
}

const ANNUAL_PLANNING_INTERVALS = [4, 6, 8, 10, 12] as const;

function buildTrainerTravelWarningForSlot(
  slot: OrganizerMatchedSlotView,
  events: TrainingEvent[],
) {
  const relevantEvents = events
    .filter(
      (event) =>
        event.trainerId === slot.trainerId &&
        !isTrainingEventArchived(event) &&
        resolveTrainingEventWorkflowStatus(event) !== "draft-requested",
    )
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  const previousEvent = [...relevantEvents]
    .filter((event) => new Date(event.endsAt).getTime() <= new Date(slot.startsAt).getTime())
    .sort((left, right) => new Date(right.endsAt).getTime() - new Date(left.endsAt).getTime())[0];
  const nextEvent = relevantEvents
    .filter((event) => new Date(event.startsAt).getTime() >= new Date(slot.endsAt).getTime())
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())[0];

  const warnings: string[] = [];

  if (previousEvent) {
    const gapHours =
      Math.round(
        ((new Date(slot.startsAt).getTime() - new Date(previousEvent.endsAt).getTime()) /
          (1000 * 60 * 60)) *
          10,
      ) / 10;
    warnings.push(
      `Poprzednie szkolenie: ${previousEvent.location} do ${formatDateTime(previousEvent.endsAt)}. Przerwa: ${gapHours} h.`,
    );
  }

  if (nextEvent) {
    const gapHours =
      Math.round(
        ((new Date(nextEvent.startsAt).getTime() - new Date(slot.endsAt).getTime()) /
          (1000 * 60 * 60)) *
          10,
      ) / 10;
    warnings.push(
      `Następne szkolenie: ${nextEvent.location} od ${formatDateTime(nextEvent.startsAt)}. Przerwa: ${gapHours} h.`,
    );
  }

  return warnings.join(" ");
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
  const trainer = store.trainers.find((item) => item.id === event.trainerId);
  const organizer = event.organizerId
    ? store.organizers.find((item) => item.id === event.organizerId)
    : null;

  return {
    trainerName:
      trainer?.displayName ?? event.creatorDisplayName ?? "Gospodarz wydarzenia",
    organizerName: isSelfManagedTrainingEvent(event)
      ? trainer?.displayName ?? event.creatorDisplayName ?? "Gospodarz wydarzenia"
      : organizer?.displayName ?? "Organizator",
  };
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

function getAccountRequestRoleLabel(request: {
  requestedRoles?: Array<"trainer" | "organizer" | "participant">;
}) {
  const normalizedRoles = Array.from(
    new Set((request.requestedRoles ?? []).filter(Boolean)),
  ) as Array<"trainer" | "organizer" | "participant">;

  if (
    normalizedRoles.includes("participant") &&
    normalizedRoles.includes("organizer") &&
    normalizedRoles.includes("trainer")
  ) {
    return "Uczestnik + organizator + wydarzenia dla społeczności";
  }

  if (normalizedRoles.includes("participant") && normalizedRoles.includes("organizer")) {
    return "Uczestnik + organizator grup Emandar";
  }

  if (normalizedRoles.includes("participant") && normalizedRoles.includes("trainer")) {
    return "Uczestnik + wydarzenia dla społeczności";
  }

  if (
    normalizedRoles.includes("organizer") &&
    normalizedRoles.includes("trainer")
  ) {
    return "Organizator grup Emandar + wydarzenia dla społeczności";
  }

  if (normalizedRoles.includes("organizer")) {
    return "Organizator grup Emandar";
  }

  if (normalizedRoles.includes("trainer")) {
    return "Wydarzenia dla społeczności";
  }

  if (normalizedRoles.includes("participant")) {
    return "Uczestnik";
  }

  return "Brak wyboru";
}

function getAccountApprovalStatusLabel(status: "pending" | "accepted" | "rejected") {
  switch (status) {
    case "accepted":
      return "Zaakceptowane";
    case "rejected":
      return "Odrzucone";
    default:
      return "Oczekujące";
  }
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
  event: TrainingEvent,
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
    summary: event.summary,
    description: event.description,
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

type ParticipantEnrollmentRecord = {
  request: EnrollmentRequest;
  event: TrainingEvent;
  trainer?: TrainerProfile;
  organizer?: OrganizerProfile | null;
  isArchived: boolean;
};

type ParticipantGroupEventRecord = {
  eventParticipant: ReturnType<typeof useAppState>["store"]["eventParticipants"] extends Array<infer T>
    ? T
    : never;
  event: TrainingEvent;
  trainer?: TrainerProfile;
  organizer?: OrganizerProfile | null;
  group?: Group | null;
  isArchived: boolean;
};

function isSyncedGroupEnrollmentRecord(record: ParticipantEnrollmentRecord) {
  return Boolean(record.event.groupId && record.request.eventParticipantId);
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

function isParticipantEnrollmentArchived(
  request: EnrollmentRequest,
  event: TrainingEvent,
) {
  return !isParticipantEnrollmentActive(request) || isTrainingEventArchived(event) || isEventFinished(event);
}

function getParticipantEnrollmentRecords(
  currentUserId: string,
  store: ReturnType<typeof useAppState>["store"],
): ParticipantEnrollmentRecord[] {
  return [...store.enrollmentRequests]
    .filter((request) => request.submitterUid === currentUserId)
    .map((request) => {
      const event = store.trainingEvents.find((item) => item.id === request.eventId);
      if (!event) {
        return null;
      }

      return {
        request,
        event,
        trainer: store.trainers.find((item) => item.id === event.trainerId),
        organizer: event.organizerId
          ? store.organizers.find((item) => item.id === event.organizerId) ?? null
          : null,
        isArchived: isParticipantEnrollmentArchived(request, event),
      };
    })
    .filter((item): item is ParticipantEnrollmentRecord => Boolean(item))
    .sort(
      (left, right) =>
        new Date(left.event.startsAt).getTime() - new Date(right.event.startsAt).getTime(),
    );
}

function isParticipantGroupEventArchived(
  eventParticipant: ParticipantGroupEventRecord["eventParticipant"],
  event: TrainingEvent,
) {
  return (
    eventParticipant.status === "declined" ||
    eventParticipant.status === "removed" ||
    isTrainingEventArchived(event) ||
    isEventFinished(event)
  );
}

function getParticipantGroupEventRecords(
  participantProfileId: string,
  store: ReturnType<typeof useAppState>["store"],
): ParticipantGroupEventRecord[] {
  return [...(store.eventParticipants ?? [])]
    .filter((eventParticipant) => eventParticipant.participantProfileId === participantProfileId)
    .map((eventParticipant) => {
      const event = store.trainingEvents.find((item) => item.id === eventParticipant.eventId);
      if (!event) {
        return null;
      }

      return {
        eventParticipant,
        event,
        trainer: store.trainers.find((item) => item.id === event.trainerId),
        organizer: event.organizerId
          ? store.organizers.find((item) => item.id === event.organizerId) ?? null
          : null,
        group: event.groupId ? store.groups?.find((item) => item.id === event.groupId) ?? null : null,
        isArchived: isParticipantGroupEventArchived(eventParticipant, event),
      };
    })
    .filter((item): item is ParticipantGroupEventRecord => Boolean(item))
    .sort(
      (left, right) =>
        new Date(left.event.startsAt).getTime() - new Date(right.event.startsAt).getTime(),
    );
}

function getParticipantTransferOptions(
  request: EnrollmentRequest,
  currentEvent: TrainingEvent,
  events: TrainingEvent[],
) {
  return sortEventsByDate(
    events.filter((event) => {
      if (event.id === currentEvent.id) {
        return false;
      }

      if (
        isTrainingEventArchived(event) ||
        isEventFinished(event) ||
        !event.isPublished ||
        !isTrainingEventCollaborationAccepted(event) ||
        event.type !== currentEvent.type ||
        event.capacity <= event.enrolledCount
      ) {
        return false;
      }

      return request.organizerId ? Boolean(event.organizerId) : true;
    }),
  );
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
        event.capacity <= event.enrolledCount
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

function ParticipantEnrollmentCard({
  record,
}: {
  record: ParticipantEnrollmentRecord;
}) {
  const { manageOwnEnrollment, store } = useAppState();
  const [transferTargetEventId, setTransferTargetEventId] = useState("");
  const [submittingAction, setSubmittingAction] = useState<null | "cancel" | "transfer">(null);
  const transferOptions = useMemo(
    () => getParticipantTransferOptions(record.request, record.event, store.trainingEvents),
    [record.event, record.request, store.trainingEvents],
  );
  const canManage =
    !record.isArchived &&
    !isTrainingEventArchived(record.event) &&
    new Date(record.event.startsAt).getTime() > Date.now();

  useEffect(() => {
    setTransferTargetEventId((current) => current || transferOptions[0]?.id || "");
  }, [transferOptions]);

  return (
    <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
            {record.event.title}
          </p>
          <h3 className="mt-2 break-words text-2xl font-semibold text-brand-navy">
            {getPanelScheduleRangeLabel(record.event)}
          </h3>
          <p className="mt-2 text-brand-muted">{record.event.summary}</p>
        </div>
        <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
          {getParticipantEnrollmentStatusLabel(record.request)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm text-brand-muted">
          <p className="font-semibold text-brand-navy">{record.event.location}</p>
          <p className="mt-2">Start: {formatDateTime(record.event.startsAt)}</p>
          <p>Koniec: {formatDateTime(record.event.endsAt)}</p>
          <p className="mt-2">Status zapisu: {record.request.finalStatus}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ParticipantContactBlock
            title={record.event.creatorUserId ? "Gospodarz wydarzenia" : "Przekazujący Wiedzę"}
            name={record.request.trainerContactName || record.trainer?.displayName}
            contact={
              record.request.trainerContactPhone || record.request.trainerContactEmail
            }
            fallback="Dane osoby prowadzącej"
          />
          <ParticipantContactBlock
            title="Organizator"
            name={record.request.organizerContactName || record.organizer?.displayName}
            contact={
              record.request.organizerContactPhone || record.request.organizerContactEmail
            }
            fallback="Szkolenie prowadzone bez organizatora"
          />
        </div>
      </div>

      {canManage && (
        <div className="mt-5 rounded-3xl border border-brand-line bg-brand-shell p-4">
          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
            <button
              type="button"
              disabled={submittingAction !== null}
              onClick={async () => {
                if (!window.confirm("Na pewno chcesz zrezygnować z tego szkolenia?")) {
                  return;
                }

                setSubmittingAction("cancel");
                try {
                  await manageOwnEnrollment(record.request.id, "cancel");
                  toast.success("Zrezygnowano ze szkolenia.");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Nie udało się zrezygnować.",
                  );
                } finally {
                  setSubmittingAction(null);
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60 sm:w-auto"
            >
              <Trash2 size={16} />
              Zrezygnuj
            </button>

            {transferOptions.length > 0 && (
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
                      await manageOwnEnrollment(
                        record.request.id,
                        "transfer",
                        transferTargetEventId,
                      );
                      toast.success("Przeniesiono zapis na inne szkolenie.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się przenieść zapisu.",
                      );
                    } finally {
                      setSubmittingAction(null);
                    }
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  <RefreshCcw size={16} />
                  Przenieś na inne szkolenie
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
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
            {record.eventParticipant.status}
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
        <span>
          {record.event.enrolledCount}/{record.event.capacity} miejsc
        </span>
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

type EnrollmentIntentFilter = "all" | EnrollmentIntent;

function matchesEnrollmentIntentFilter(
  request: Pick<EnrollmentRequest, "intent">,
  filter: EnrollmentIntentFilter,
) {
  if (filter === "all") {
    return true;
  }

  return resolveEnrollmentIntent(request.intent) === filter;
}

function splitEnrollmentRequestsByIntent(requests: EnrollmentRequest[]) {
  const contactRequests = requests.filter(
    (request) => resolveEnrollmentIntent(request.intent) === "contact",
  );
  const participatingRequests = requests.filter(
    (request) => resolveEnrollmentIntent(request.intent) === "participating",
  );

  return [
    {
      key: "contact",
      title: "Proszą o kontakt",
      requests: contactRequests,
    },
    {
      key: "participating",
      title: "Biorą udział",
      requests: participatingRequests,
    },
  ].filter((section) => section.requests.length > 0);
}

function getEnrollmentIntentBadgeClass(intent: EnrollmentIntent | null | undefined) {
  return resolveEnrollmentIntent(intent) === "participating"
    ? "rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white"
    : "rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy";
}

function EnrollmentIntentFilterSwitch({
  requests,
  value,
  onChange,
}: {
  requests: EnrollmentRequest[];
  value: EnrollmentIntentFilter;
  onChange: (nextValue: EnrollmentIntentFilter) => void;
}) {
  const options: Array<{ value: EnrollmentIntentFilter; label: string }> = [
    { value: "all", label: `Wszyscy (${requests.length})` },
    {
      value: "contact",
      label: `Proszą o kontakt (${requests.filter((request) => resolveEnrollmentIntent(request.intent) === "contact").length})`,
    },
    {
      value: "participating",
      label: `Biorą udział (${requests.filter((request) => resolveEnrollmentIntent(request.intent) === "participating").length})`,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            value === option.value
              ? "inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white"
              : "inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
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
}: {
  label: string;
  value: string | number;
  icon: typeof Bell;
}) {
  return (
    <article className="flex min-h-[96px] items-center gap-3 rounded-[1.5rem] border border-brand-line bg-white p-3.5 shadow-soft sm:min-h-[108px] sm:rounded-[2rem] sm:p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-sky/15 text-brand-navy sm:h-11 sm:w-11">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="break-words text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted sm:mt-4 sm:text-sm sm:tracking-[0.2em]">
          {label}
        </p>
        <p className="mt-1 text-3xl font-semibold leading-none text-brand-navy sm:mt-2 sm:text-4xl">{value}</p>
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
}: {
  activeTab: "requests" | "participants" | "edit";
  onChange: (nextTab: "requests" | "participants" | "edit") => void;
  requestCount: number;
  participantCountLabel: string;
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
      id: "edit" as const,
      label: "Edycja wydarzenia",
      badge: undefined,
      icon: null,
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
  fillRate: number;
  missingPeople: number;
  occupiedPlaces: number;
  capacity: number;
  availablePlaces: number;
};

type DashboardMonthCapacityDatum = {
  key: string;
  label: string;
  totalCapacity: number;
  enrolledCount: number;
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
      <p className="text-sm text-brand-navy">Zapisani: {item.occupiedPlaces}/{item.capacity}</p>
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
      <p className="mt-2 text-sm text-brand-navy">Zapisani: {item.enrolledCount}</p>
      <p className="text-sm text-brand-navy">Liczba miejsc: {item.totalCapacity}</p>
      <p className="text-sm text-brand-navy">Wolne miejsca: {item.availablePlaces}</p>
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
      <p className="text-sm text-brand-navy">Zapisani przed anulacja: {item.occupiedPlaces}</p>
    </div>
  );
}

function EnrollmentPhotoCard({ request }: { request: EnrollmentRequest }) {
  const { resolveEnrollmentPhoto } = useAppState();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!request.photoPath || request.photoStatus !== "ready") {
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
  }, [request.photoPath, request.photoStatus, resolveEnrollmentPhoto]);

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
        <p className="text-sm text-brand-muted">
          {request.photoStatus === "error"
            ? "Plik nie został jeszcze poprawnie zapisany."
            : "Zdjęcie jest przygotowywane albo nie zostało jeszcze dodane."}
        </p>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { currentUser, notificationsCount, store } = useAppState();

  if (!currentUser) {
    return null;
  }

  const participantRecords = getParticipantEnrollmentRecords(currentUser.id, store);
  const participantGroupRecords = currentUser.participantProfileId
    ? getParticipantGroupEventRecords(currentUser.participantProfileId, store)
    : [];
  const visibleLegacyRecords = participantRecords.filter(
    (record) => !isSyncedGroupEnrollmentRecord(record),
  );
  const activeRecords = visibleLegacyRecords.filter((record) => !record.isArchived);
  const archivedRecords = visibleLegacyRecords.filter((record) => record.isArchived);
  const activeGroupRecords = participantGroupRecords.filter((record) => !record.isArchived);
  const archivedGroupRecords = participantGroupRecords.filter((record) => record.isArchived);
  const nextLegacyRecord = activeRecords[0];
  const nextGroupRecord = activeGroupRecords[0];
  const nextRecord =
    !nextLegacyRecord
      ? nextGroupRecord
      : !nextGroupRecord
        ? nextLegacyRecord
        : new Date(nextGroupRecord.event.startsAt).getTime() <
            new Date(nextLegacyRecord.event.startsAt).getTime()
          ? nextGroupRecord
          : nextLegacyRecord;
  const needsAttentionCount =
    activeRecords.filter(
      (record) =>
        record.request.finalStatus === "pending" || record.request.finalStatus === "partial",
    ).length +
    activeGroupRecords.filter((record) => record.eventParticipant.status === "invited").length;
  const totalActiveCount = activeRecords.length + activeGroupRecords.length;
  const totalArchivedCount = archivedRecords.length + archivedGroupRecords.length;
  const upcomingGroupEvents = activeGroupRecords.slice(0, 5);
  const upcomingLegacyEvents = activeRecords.slice(0, 5);
  const nextRecordIsGroup =
    Boolean(nextRecord) && "eventParticipant" in nextRecord;
  const ownAccountApprovals = store.trainerAccountApprovals.filter(
    (approval) => approval.requesterUserId === currentUser.id,
  );
  const pendingElevatedRoles = (currentUser.pendingRoles ?? []).filter(
    (role) => role === "trainer",
  );
  const shouldShowApprovalStatus =
    pendingElevatedRoles.length > 0 ||
    currentUser.accountApprovalStatus === "rejected" ||
    ownAccountApprovals.length > 0;
  const participantDashboardContent = (
      <div className="space-y-6">
        {shouldShowApprovalStatus && (
          <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <SectionBlockHeading
              title="Dodatkowe role"
              description="Konto uczestnika działa od razu. Tutaj widać tylko status dodatkowych uprawnień, jeśli w ogóle zostały zgłoszone."
            />
            <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-3xl bg-brand-shell p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
                  Główny status
                </p>
                <p className="mt-3 text-2xl font-semibold text-brand-navy">
                  {currentUser.accountApprovalStatus === "rejected"
                    ? "Wymaga nowej akceptacji"
                    : pendingElevatedRoles.length > 0
                      ? "Czeka na dodatkową akceptację"
                      : "Konto uczestnika aktywne"}
                </p>
                <p className="mt-3 text-sm text-brand-muted">
                  Zakres do odblokowania:{" "}
                  {getAccountRequestRoleLabel({
                    requestedRoles: [
                      "participant",
                      ...pendingElevatedRoles,
                    ],
                  })}
                </p>
              </div>
              <div className="space-y-3">
                {ownAccountApprovals.length === 0 ? (
                  <p className="rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm text-brand-muted">
                    Brak przypisanych trenerów do akceptacji konta.
                  </p>
                ) : (
                  ownAccountApprovals.map((approval) => {
                    const trainer = store.trainers.find(
                      (item) => item.id === approval.targetTrainerId,
                    );

                    return (
                      <div
                        key={approval.id}
                        className="rounded-3xl border border-brand-line bg-brand-shell p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-brand-navy">
                              {trainer?.displayName ?? "Trener"}
                            </p>
                            <p className="mt-1 text-sm text-brand-muted">
                              {getAccountApprovalStatusLabel(approval.status)} • wysłano{" "}
                              {formatDate(approval.createdAt)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                            {getAccountApprovalStatusLabel(approval.status)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </article>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Aktywne zapisy" value={totalActiveCount} icon={CalendarDays} />
          <StatCard label="Wymagają uwagi" value={needsAttentionCount} icon={Bell} />
          <StatCard label="Archiwum" value={totalArchivedCount} icon={RefreshCcw} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <SectionBlockHeading
              title="Najbliższe szkolenie"
              description="Najbliższe wydarzenie z Twoich aktywnych zapisów i przydziałów grupowych."
            />
            {nextRecord ? (
              <div className="mt-5 rounded-3xl bg-brand-shell p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                  {nextRecord.event.title}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-brand-navy">
                  {getPanelScheduleRangeLabel(nextRecord.event)}
                </h3>
                <p className="mt-3 text-brand-muted">{nextRecord.event.location}</p>
                {nextRecordIsGroup ? (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                    {getGroupPriorityLabel(
                      (nextRecord as ParticipantGroupEventRecord).eventParticipant.priority,
                    )}{" "}
                    · status {(nextRecord as ParticipantGroupEventRecord).eventParticipant.status}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ParticipantContactBlock
                    title={
                      nextRecord.event.creatorUserId
                        ? "Gospodarz wydarzenia"
                        : "Przekazujący Wiedzę"
                    }
                    name={
                      "request" in nextRecord
                        ? nextRecord.request.trainerContactName || nextRecord.trainer?.displayName
                        : nextRecord.trainer?.displayName
                    }
                    contact={
                      "request" in nextRecord
                        ? nextRecord.request.trainerContactPhone ||
                          nextRecord.request.trainerContactEmail
                        : null
                    }
                    fallback="Dane osoby prowadzącej"
                  />
                  <ParticipantContactBlock
                    title="Organizator"
                    name={
                      "request" in nextRecord
                        ? nextRecord.request.organizerContactName || nextRecord.organizer?.displayName
                        : nextRecord.organizer?.displayName
                    }
                    contact={
                      "request" in nextRecord
                        ? nextRecord.request.organizerContactPhone ||
                          nextRecord.request.organizerContactEmail
                        : null
                    }
                    fallback="Szkolenie bez dodatkowego organizatora"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <EmptyPanelState
                  title="Brak nadchodzących zapisów"
                  description="Kiedy dołączysz do kolejnego szkolenia, pojawi się tutaj."
                />
              </div>
            )}
          </article>

          <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <SectionBlockHeading
              title="Nadchodzące wydarzenia"
              description="Zobaczysz tu zarówno klasyczne zgłoszenia, jak i wydarzenia przypisane przez grupę."
            />
            <div className="mt-5 space-y-4">
              {upcomingGroupEvents.map((record) => (
                <div key={record.eventParticipant.id} className="rounded-3xl border border-brand-line bg-brand-shell p-4">
                  <p className="font-semibold text-brand-navy">{record.event.title}</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {formatDate(record.event.startsAt)} • {record.event.location}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-sky-deep">
                    {record.group?.name ?? record.event.groupName ?? "Grupa"} · {record.eventParticipant.status}
                  </p>
                </div>
              ))}
              {upcomingLegacyEvents.map((record) => (
                <div key={record.request.id} className="rounded-3xl border border-brand-line bg-brand-shell p-4">
                  <p className="font-semibold text-brand-navy">{record.event.title}</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {formatDate(record.event.startsAt)} • {record.event.location}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-sky-deep">
                    {getParticipantEnrollmentStatusLabel(record.request)}
                  </p>
                </div>
              ))}
              {totalActiveCount === 0 && (
                <p className="rounded-3xl bg-brand-shell p-4 text-brand-muted">
                  Nie masz teraz żadnych aktywnych szkoleń.
                </p>
              )}
            </div>
          </article>
        </div>
      </div>
  );

  if (currentUser.role === "participant") {
    return (
      <PanelSection
        eyebrow={getRoleLabel(currentUser.role)}
        title="Twoje szkolenia i najbliższe wydarzenia"
        showLeadText={false}
      >
        {participantDashboardContent}
      </PanelSection>
    );
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const relevantEvents = store.trainingEvents.filter(
    (item) => !isTrainingEventArchived(item) && canManageTrainingEvent(item, currentUser),
  );
  const relevantEventIds = new Set(relevantEvents.map((event) => event.id));
  const relevantRequests = store.enrollmentRequests.filter((item) =>
    relevantEventIds.has(item.eventId),
  );
  const relevantOperationalRequests = useMemo(
    () => relevantRequests.filter((request) => isOperationalEnrollmentRequest(request, store)),
    [relevantRequests, store],
  );
  const communityEvents = useMemo(
    () =>
      hasInheritedRole(currentUser, "trainer") && trainerProfile
        ? relevantEvents.filter(
            (item) =>
              item.trainerId === trainerProfile.id &&
              isCommunityBrandStatus(item.brandStatus),
          )
        : [],
    [currentUser, relevantEvents, trainerProfile],
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
          fillRate: getEventFillRate(event),
          statusLabel: getTrainingEventStatusLabel(event.status),
          status: resolveTrainingEventStatus(event.status),
          occupiedPlaces: event.enrolledCount,
          availablePlaces: getAvailablePlaces(event),
          startsAt: event.startsAt,
        }),
      ),
    [activeCommunityEvents, confirmedCommunityEvents],
  );
  const hasCommunityKpiData = communityPerformanceData.length > 0;
  const dashboardMonthBuckets = useMemo(() => getDashboardMonthBuckets(new Date()), []);
  const dashboardWindow = dashboardMonthBuckets.at(-1);
  const analyticsEventsInRange = useMemo(() => {
    if (
      !dashboardWindow ||
      !hasInheritedRole(currentUser, "organizer")
    ) {
      return [];
    }

    const windowStart = new Date();
    return relevantEvents.filter((event) => isDateWithinRange(event.startsAt, windowStart, dashboardWindow.end));
  }, [currentUser, dashboardWindow, relevantEvents]);
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
        fillRate: getEventFillRate(event),
        missingPeople: getAvailablePlaces(event),
        occupiedPlaces: event.enrolledCount,
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
        fillRate: getEventFillRate(event),
        missingPeople: getAvailablePlaces(event),
        occupiedPlaces: event.enrolledCount,
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
          enrolledCount: monthEvents.reduce((sum, event) => sum + event.enrolledCount, 0),
          availablePlaces: monthEvents.reduce((sum, event) => sum + getAvailablePlaces(event), 0),
        };
      }),
    [analyticsActiveEvents, dashboardMonthBuckets],
  );
  const organizerGroupsData = useMemo(() => {
    if (!hasInheritedRole(currentUser, "trainer")) {
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
  }, [analyticsActiveEvents, currentUser, store.organizers]);
  const analyticsRequestsInRange = useMemo(() => {
    if (
      !dashboardWindow ||
      !hasInheritedRole(currentUser, "organizer")
    ) {
      return [];
    }

    const rangeStart = dashboardMonthBuckets[0]?.start ?? new Date();
    return relevantOperationalRequests.filter((request) =>
      isDateWithinRange(request.createdAt, rangeStart, dashboardWindow.end),
    );
  }, [currentUser, dashboardMonthBuckets, dashboardWindow, relevantOperationalRequests]);
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
  const shouldShowRoleAnalytics = hasInheritedRole(currentUser, "organizer");
  const relationsCount = currentUser.role === "admin"
    ? store.relations.length
    : store.relations.filter((item) => {
        const matchesTrainer = trainerProfile ? item.trainerId === trainerProfile.id : false;
        const matchesOrganizer = organizerProfile ? item.organizerId === organizerProfile.id : false;
        return matchesTrainer || matchesOrganizer;
      }).length;

  return (
    <PanelSection
      eyebrow={getRoleLabel(currentUser.role)}
      title="Pulpit pracy"
    >
      <div className="rounded-[2rem] border border-brand-line bg-white/70 p-4 shadow-soft sm:p-6">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
            Perspektywa uczestnika
          </p>
          <h3 className="mt-2 text-xl font-semibold text-brand-navy sm:text-2xl">
            Twoje zapisy i najbliższe wydarzenia
          </h3>
          <p className="mt-2 text-sm text-brand-muted">
            Wyższy poziom roli nie ukrywa już uczestnika. Ten blok zawsze pokazuje Twoje własne
            uczestnictwo, niezależnie od tego, czy dodatkowo organizujesz albo prowadzisz wydarzenia.
          </p>
        </div>
        {participantDashboardContent}
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
            Perspektywa operacyjna
          </p>
          <h3 className="mt-2 text-xl font-semibold text-brand-navy sm:text-2xl">
            Organizacja, relacje i stan terminów
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Szkolenia" value={relevantEvents.length} icon={CalendarDays} />
        <StatCard label="Intake" value={relevantOperationalRequests.length} icon={Bell} />
        <StatCard label="Powiadomienia" value={notificationsCount} icon={ShieldCheck} />
        <StatCard label="Relacje" value={relationsCount} icon={Users} />
      </div>

      {shouldShowRoleAnalytics && (
        <>
          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                Oblozenie na najblizsze miesiace
              </p>
              <p className="mt-2 text-xl font-semibold leading-tight text-brand-navy sm:text-2xl">
                Nadchodzace szkolenia i ile osob jeszcze brakuje
              </p>
            </div>
            <div
              className={`grid gap-4 xl:grid-cols-2 ${
                hasInheritedRole(currentUser, "trainer") ? "2xl:grid-cols-4" : "2xl:grid-cols-3"
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
                description="Porownanie wydarzen wedlug procentu zajetych miejsc."
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
                description="Laczna liczba zapisanych osob versus cala pula miejsc w nadchodzacych miesiacach."
              >
                <DashboardLegend
                  items={[
                    { label: "Zapisani", color: "#174f9a" },
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

              {hasInheritedRole(currentUser, "trainer") && (
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
                title="Intake w miesiacach"
                description="Nowe prosby o dolaczenie do wydarzen albo publiczny intake grup policzony po miesiacu utworzenia."
              >
                {analyticsRequestsInRange.length === 0 ? (
                  <DashboardChartEmptyState message="Brak intake w biezacym oknie 3 miesiecy." />
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
                title="Statusy intake w miesiacach"
                description="Widac, ile wpisow intake nadal czeka, a ile jest juz rozstrzygnietych."
              >
                {analyticsRequestsInRange.length === 0 ? (
                  <DashboardChartEmptyState message="Brak intake do pokazania w tym okresie." />
                ) : (
                  <>
                    <DashboardLegend
                      items={[
                        { label: "Przyjete", color: "#0ea5a4" },
                        { label: "Oczekujace", color: "#174f9a" },
                        { label: "Czesciowe", color: "#f59e0b" },
                        { label: "Odrzucone", color: "#c84b4b" },
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
                          <Bar dataKey="partial" stackId="status" fill="#f59e0b" />
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
        </>
      )}

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
                Brak wydarzeń dla tej roli.
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

      {isCommunityTrainer && (
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
    </PanelSection>
  );
}

export function RequestsPage() {
  const {
    currentUser,
    decideEnrollment,
    decideTrainerAccountApproval,
    store,
  } = useAppState();
  const [intentFilter, setIntentFilter] = useState<EnrollmentIntentFilter>("all");

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const manageableEventIds = new Set(
    store.trainingEvents
      .filter((event) => canManageTrainingEvent(event, currentUser))
      .map((event) => event.id),
  );

  const accountApprovals = store.trainerAccountApprovals.filter((approval) => {
    if (currentUser.role === "admin") {
      return true;
    }

    if (currentUser.role === "trainer") {
      return (
        approval.requesterUserId === currentUser.id ||
        approval.targetTrainerUserId === currentUser.id
      );
    }

    return false;
  });

  const requests = store.enrollmentRequests.filter((request) => {
    return manageableEventIds.has(request.eventId) && isOperationalEnrollmentRequest(request, store);
  });
  const filteredRequests = requests.filter((request) =>
    matchesEnrollmentIntentFilter(request, intentFilter),
  );
  const requestSections = splitEnrollmentRequestsByIntent(filteredRequests);

  return (
    <PanelSection
      eyebrow="Zgłoszenia"
      title="Nowe osoby i publiczny intake"
      showLeadText={false}
    >
      <div className="space-y-4">
        {requests.length > 0 && (
          <EnrollmentIntentFilterSwitch
            requests={requests}
            value={intentFilter}
            onChange={setIntentFilter}
          />
        )}
        {requests.length === 0 && (
          <EmptyPanelState
            title="Brak zgłoszeń"
            description="Nowe zgłoszenia do Twoich wydarzeń pojawią się tutaj."
          />
        )}
        {requests.length > 0 && requestSections.length === 0 && (
          <EmptyPanelState
            title="Brak zgłoszeń w tym widoku"
            description="Zmień filtr, żeby zobaczyć pozostałe osoby."
          />
        )}
        {requestSections.map((section) => (
          <div key={section.key} className="space-y-4">
            <SectionBlockHeading
              title={section.title}
              description={
                section.key === "contact"
                  ? "Osoby, które chcą najpierw porozmawiać i uzyskać odpowiedź na pytania."
                  : "Osoby deklarujące chęć udziału, ale nadal oczekujące na decyzję managera."
              }
            />
            {section.requests.map((request) => {
          const event = store.trainingEvents.find((item) => item.id === request.eventId);
          if (!event) {
            return null;
          }

          const canDecideRequest = canManageTrainingEvent(event, currentUser);

          return (
            <article
              key={request.id}
              className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                    {event.title}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-brand-navy">
                    {request.imieNazwisko}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-brand-muted">
                    <span className="inline-flex items-center gap-2">
                      <Phone size={14} />
                      {request.telefon}
                    </span>
                    <span>{request.polecenieOdKogo || "Bez polecenia"}</span>
                    <span>{formatDate(request.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={getEnrollmentIntentBadgeClass(request.intent)}>
                    {getEnrollmentIntentLabel(request.intent)}
                  </span>
                  <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                    {request.finalStatus}
                  </span>
                </div>
              </div>

              <p className="mt-4 rounded-3xl bg-brand-shell p-4 text-brand-muted">
                {request.wiadomosc || "Brak dodatkowej wiadomości."}
              </p>

              <div
                className={`mt-4 grid gap-4 ${
                  request.requiresOrganizerApproval === false
                    ? "md:grid-cols-[1fr_1fr_1.15fr]"
                    : "md:grid-cols-[1fr_1fr_1fr_1.15fr]"
                }`}
              >
                <div className="rounded-3xl border border-brand-line bg-brand-shell p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
                    Potwierdzenie uczestnika
                  </p>
                  <p className="mt-2 text-lg font-semibold text-brand-navy">
                    {resolveAttendanceConfirmationStatusLabel(
                      request.attendanceConfirmationStatus,
                    )}
                  </p>
                </div>
                <div className="rounded-3xl border border-brand-line bg-brand-shell p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
                    Decyzja Przekazującego Wiedzę
                  </p>
                  <p className="mt-2 text-lg font-semibold text-brand-navy">
                    {request.trainerDecision}
                  </p>
                </div>
                {request.requiresOrganizerApproval !== false && (
                  <div className="rounded-3xl border border-brand-line bg-brand-shell p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
                      Decyzja organizatora
                    </p>
                    <p className="mt-2 text-lg font-semibold text-brand-navy">
                      {request.organizerDecision}
                    </p>
                  </div>
                )}
                <EnrollmentPhotoCard request={request} />
              </div>

              {canDecideRequest && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await decideEnrollment(request.id, "accepted");
                        toast.success("Zaktualizowano decyzję dla zgłoszenia.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zaktualizować zgłoszenia.",
                        );
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
                  >
                    <Check size={16} />
                    Akceptuj
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await decideEnrollment(request.id, "rejected");
                        toast.success("Zaktualizowano decyzję dla zgłoszenia.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zaktualizować zgłoszenia.",
                        );
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
                  >
                    <X size={16} />
                    Odrzuć
                  </button>
                </div>
              )}
            </article>
          );
            })}
          </div>
        ))}
      </div>

      {(currentUser.role === "trainer" || currentUser.role === "admin") && (
        <div className="space-y-4">
          <SectionBlockHeading
            title={
              isCommunityTrainer
                ? "Status zatwierdzenia Twojego konta"
                : "Konta oczekujące na akceptację"
            }
            description={
              isCommunityTrainer
                ? "Tu widzisz prośby o akceptację Twojego konta przez wybranych trenerów."
                : "Oficjalny trener akceptuje tutaj osoby, które chodzą na jego grupę i chcą aktywować konto."
            }
          />

          {accountApprovals.length === 0 && (
            <EmptyPanelState
              title="Brak approvali kont"
              description="Nowe prośby o zatwierdzenie konta pojawią się tutaj po rejestracji."
            />
          )}

          {accountApprovals.map((approval) => {
            const targetTrainer = store.trainers.find(
              (item) => item.id === approval.targetTrainerId,
            );
            const canDecideApproval =
              approval.status === "pending" &&
              (approval.targetTrainerUserId === currentUser.id || currentUser.role === "admin");

            return (
              <article
                key={approval.id}
                className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-brand-navy">
                      {approval.requesterDisplayName ?? "Nowe konto"} →{" "}
                      {targetTrainer?.displayName ?? "Trener"}
                    </p>
                    <p className="mt-2 text-brand-muted">
                      {getAccountRequestRoleLabel({ requestedRoles: approval.requestedRoles })} •
                      utworzono {formatDate(approval.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy">
                    {getAccountApprovalStatusLabel(approval.status)}
                  </span>
                </div>

                <div className="mt-4 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm text-brand-muted">
                  <p>
                    Telefon: {approval.requesterPhone || "Brak numeru telefonu"}
                  </p>
                  <p className="mt-1">
                    Status approvala: {getAccountApprovalStatusLabel(approval.status)}
                  </p>
                </div>

                {canDecideApproval && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await decideTrainerAccountApproval(approval.id, "accepted");
                          toast.success("Konto zostało zaakceptowane.");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Nie udało się zapisać decyzji.",
                          );
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
                    >
                      <Check size={16} />
                      Akceptuj
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await decideTrainerAccountApproval(approval.id, "rejected");
                          toast.success("Konto zostało odrzucone.");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Nie udało się zapisać decyzji.",
                          );
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
                    >
                      <X size={16} />
                      Odrzuć
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
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

function RelationsHubContent() {
  const {
    connectOrganizerToTrainerWithCode,
    currentUser,
    store,
  } = useAppState();
  const [trainerAuthorizationCode, setTrainerAuthorizationCode] = useState("");
  const [connectingTrainer, setConnectingTrainer] = useState(false);

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const organizerFunctionsAreBlocked = isOrganizerFunctionsBlocked(currentUser);
  const canUseOrganizerHub = currentUser.role === "participant" || Boolean(organizerProfile);
  const canUseTrainerHub = hasInheritedRole(currentUser, "trainer") && Boolean(trainerProfile);
  const organizerRelations = organizerProfile
    ? store.relations.filter((relation) => relation.organizerId === organizerProfile.id)
    : [];
  const trainerRelations = trainerProfile
    ? store.relations.filter((relation) => relation.trainerId === trainerProfile.id)
    : [];
  const organizerActiveRelations = organizerRelations.filter(
    (relation) => relation.status === "approved",
  );
  const allRelations = currentUser.role === "admin"
    ? store.relations
    : Array.from(
        new Map(
          [...organizerRelations, ...trainerRelations].map((relation) => [relation.id, relation]),
        ).values(),
      );

  return (
    <div className="space-y-6">
      {canUseOrganizerHub && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setConnectingTrainer(true);
            try {
              await connectOrganizerToTrainerWithCode(trainerAuthorizationCode);
              setTrainerAuthorizationCode("");
              toast.success("Relacja z trenerem została aktywowana.");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Nie udało się aktywować relacji.",
              );
            } finally {
              setConnectingTrainer(false);
            }
          }}
          className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
        >
          <SectionBlockHeading
            title="Połącz się z trenerem"
            description="To jedyne wejście do aktywacji organizatora. Po wpisaniu poprawnego kodu trener od razu pojawi się na Twojej liście."
          />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <label className="grid flex-1 gap-2">
              <span className="text-sm font-semibold text-brand-navy">
                Kod trenera
              </span>
              <input
                required
                value={trainerAuthorizationCode}
                onChange={(event) => setTrainerAuthorizationCode(event.target.value)}
                placeholder="Wpisz kod od trenera"
                disabled={organizerFunctionsAreBlocked}
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={connectingTrainer || organizerFunctionsAreBlocked}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
            >
              <Users size={16} />
              {connectingTrainer ? "Aktywowanie..." : "Aktywuj relację"}
            </button>
          </div>
          {organizerFunctionsAreBlocked ? (
            <p className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Funkcje organizatora są chwilowo zablokowane przez moderatora lub admina. Nadal
              zachowujesz konto uczestnika i podgląd historycznych danych, ale nie aktywujesz tu
              nowych relacji ani nie uruchamiasz nowych działań organizerowych.
            </p>
          ) : null}
        </form>
      )}

      {organizerProfile ? (
        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <SectionBlockHeading
            title="Twój dostęp organizatora"
            description="Dostęp do tworzenia nowych grup i szkoleń zależy od liczby aktywnych połączeń z trenerami."
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <StatCard
              label="Aktywni trenerzy"
              value={organizerActiveRelations.length}
              icon={Users}
            />
            <StatCard
              label="Łączne relacje"
              value={organizerRelations.length}
              icon={ShieldCheck}
            />
          </div>
          <div className="mt-5 rounded-3xl border border-brand-line bg-brand-shell/70 p-4 text-sm text-brand-muted">
            {organizerFunctionsAreBlocked
              ? "Masz przypiętych trenerów, ale moderator lub admin zablokował teraz funkcje organizatora. Relacje zostają w systemie, jednak nowe grupy, szkolenia i działania organizerowe są wstrzymane."
              : organizerActiveRelations.length > 0
              ? "Masz aktywny dostęp organizatora. Możesz od razu tworzyć nowe grupy i szkolenia w odpowiednich ekranach panelu."
              : "Nie masz teraz aktywnego trenera. Zachowujesz wgląd do wcześniej utworzonych grup, ale nowe grupy i szkolenia pozostają zablokowane."}
          </div>
        </article>
      ) : null}

      {canUseOrganizerHub ? (
        <div className="space-y-4">
          <SectionBlockHeading
            title="Relacje organizatora"
            description="To aktywne i historyczne połączenia z trenerami, z których wynika dostęp organizatora."
          />
          {organizerRelations.length === 0 && (
            <EmptyPanelState
              title="Brak relacji organizatora"
              description="Nie masz jeszcze aktywnego połączenia z trenerem. Wpisz kod w tej sekcji, aby odblokować dostęp organizatora."
            />
          )}
          {organizerRelations.map((relation) => {
            const trainer = store.trainers.find((item) => item.id === relation.trainerId);
            const organizer = store.organizers.find(
              (item) => item.id === relation.organizerId,
            );

            return (
              <article
                key={`organizer-${relation.id}`}
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

                {relation.status === "approved" && !organizerFunctionsAreBlocked ? (
                  <DetachRelationControls relationId={relation.id} allowArchiveOption={false} />
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {canUseTrainerHub ? (
        <div className="space-y-4">
          <SectionBlockHeading
            title="Relacje trenera"
            description="Tutaj widzisz organizatorów przypiętych do Ciebie jako Przekazującego Wiedzę."
          />
          {trainerRelations.length === 0 && (
            <EmptyPanelState
              title="Brak relacji trenera"
              description="Aktywne relacje z organizatorami pojawią się tutaj automatycznie."
            />
          )}
          {trainerRelations.map((relation) => {
            const trainer = store.trainers.find((item) => item.id === relation.trainerId);
            const organizer = store.organizers.find(
              (item) => item.id === relation.organizerId,
            );

            return (
              <article
                key={`trainer-${relation.id}`}
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

                {relation.status === "approved" ? (
                  <DetachRelationControls relationId={relation.id} allowArchiveOption />
                ) : null}
              </article>
            );
          })}
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
          {allRelations.map((relation) => {
          const trainer = store.trainers.find((item) => item.id === relation.trainerId);
          const organizer = store.organizers.find(
            (item) => item.id === relation.organizerId,
          );

          return (
            <article
              key={`admin-${relation.id}`}
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

              {relation.status === "approved" ? (
                <DetachRelationControls relationId={relation.id} allowArchiveOption={false} />
              ) : null}
            </article>
          );
        })}
        </div>
      ) : null}
    </div>
  );
}

export function RelationsPage() {
  return <Navigate to="/panel/ustawienia" replace />;
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
  const [planningIntervalWeeks, setPlanningIntervalWeeks] =
    useState<(typeof ANNUAL_PLANNING_INTERVALS)[number]>(8);
  const [groupForm, setGroupForm] = useState<GroupFormState>(createEmptyGroupFormState());
  const [memberForm, setMemberForm] = useState<GroupMemberFormState>(
    createEmptyGroupMemberFormState(),
  );
  const [memberDrafts, setMemberDrafts] = useState<
    Record<string, { priority: GroupMemberPriority; notes: string }>
  >({});
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [groupScope, setGroupScope] = useState<"all" | "mine">("mine");

  if (!currentUser) {
    return null;
  }

  const organizerProfile = store.organizers.find((item) => item.userId === currentUser.id);
  const hasActiveOrganizerAccess = Boolean(
    organizerProfile &&
      (store.relations ?? []).some(
        (relation) =>
          relation.organizerId === organizerProfile.id && relation.status === "approved",
      ),
  );
  const canManageGroups =
    Boolean(organizerProfile) && hasActiveOrganizerAccess && canUseOrganizerFunctions(currentUser);
  const trainersById = useMemo(
    () => new Map((store.trainers ?? []).map((trainer) => [trainer.id, trainer])),
    [store.trainers],
  );
  const participantProfilesById = useMemo(
    () =>
      new Map((store.participantProfiles ?? []).map((profile) => [profile.id, profile])),
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
  const ownedGroups = useMemo(
    () =>
      organizerProfile
        ? sortGroupsByStatusAndName(
            (store.groups ?? []).filter((group) => group.organizerId === organizerProfile.id),
          )
        : [],
    [organizerProfile, store.groups],
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
  const hasOrganizerGroupScope =
    Boolean(organizerProfile) &&
    (ownedGroups.length > 0 || hasInheritedRole(currentUser, "organizer"));
  const isParticipantGroupViewer = !hasOrganizerGroupScope || groupScope === "all";
  const visibleGroups = useMemo(() => {
    if (isParticipantGroupViewer) {
      return joinedGroups;
    }

    return ownedGroups;
  }, [isParticipantGroupViewer, joinedGroups, ownedGroups]);
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
      )
      .sort((left, right) => {
        const leftRank = GROUP_PRIORITY_ORDER[left.priority];
        const rightRank = GROUP_PRIORITY_ORDER[right.priority];
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return left.participantDisplayName.localeCompare(right.participantDisplayName, "pl");
      });
  }, [selectedGroup, store.groupMembers]);
  const selectedGroupEvents = useMemo(() => {
    if (!selectedGroup) {
      return [];
    }

    return sortEventsByDate(
      (store.trainingEvents ?? []).filter((event) => event.groupId === selectedGroup.id),
    );
  }, [selectedGroup, store.trainingEvents]);
  const availableTrainers = useMemo(() => {
    if (!organizerProfile) {
      return [];
    }

    return (store.relations ?? [])
      .filter(
        (relation) =>
          relation.organizerId === organizerProfile.id && relation.status === "approved",
      )
      .map((relation) => trainersById.get(relation.trainerId))
      .filter((trainer): trainer is TrainerProfile => Boolean(trainer))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, "pl"));
  }, [organizerProfile, store.relations, trainersById]);
  const canCreateGroups = canManageGroups && availableTrainers.length > 0;
  const organizerManagedProfiles = useMemo(() => {
    if (!organizerProfile || !canManageGroups) {
      return [];
    }

    return (store.participantProfiles ?? [])
      .filter(
        (profile) =>
          profile.createdByOrganizerId === organizerProfile.id ||
          profile.managerOrganizerIds?.includes(organizerProfile.id),
        )
      .sort((left, right) => left.displayName.localeCompare(right.displayName, "pl"));
  }, [canManageGroups, organizerProfile, store.participantProfiles]);
  const sharedSlotsById = useMemo(
    () => new Map((store.trainerSharedSlots ?? []).map((slot) => [slot.id, slot])),
    [store.trainerSharedSlots],
  );
  const selectedGroupMatchedSlots = useMemo(() => {
    if (!selectedGroup || !organizerProfile || !canManageGroups) {
      return [] as OrganizerMatchedSlotView[];
    }

    return (store.trainerOrganizerCalendarFeeds ?? [])
      .filter(
        (feed) =>
          feed.organizerId === organizerProfile.id &&
          feed.trainerId === selectedGroup.trainerId &&
          feed.enabled,
      )
      .flatMap((feed) =>
        (feed.matchedSharedSlotIds ?? []).map((slotId) => {
          const slot = sharedSlotsById.get(slotId);
          if (!slot || slot.status === "archived" || slot.archivedAt) {
            return null;
          }

          const trainer = trainersById.get(slot.trainerId);
          const baseSlot = {
            ...slot,
            trainerName: trainer?.displayName ?? "Przekazujący Wiedzę",
            relation: undefined,
            googleFeedUrl: feed.publicFeedUrl,
          } satisfies OrganizerMatchedSlotView;

          return {
            ...baseSlot,
            travelWarning: buildTrainerTravelWarningForSlot(baseSlot, store.trainingEvents ?? []),
          } satisfies OrganizerMatchedSlotView;
        }),
      )
      .filter(
        (slot): slot is OrganizerMatchedSlotView =>
          Boolean(slot) && new Date(slot.startsAt).getTime() > Date.now(),
      )
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  }, [
    canManageGroups,
    organizerProfile,
    selectedGroup,
    sharedSlotsById,
    store.trainerOrganizerCalendarFeeds,
    store.trainingEvents,
    trainersById,
  ]);
  const selectedGroupIsOwnedByCurrentUser = Boolean(
    selectedGroup && organizerProfile && selectedGroup.organizerId === organizerProfile.id,
  );
  const selectedGroupParticipantMembership = selectedGroup
    ? participantGroupMembershipsByGroupId.get(selectedGroup.id) ?? null
    : null;
  const annualPlanningSuggestions = useMemo(() => {
    if (!selectedGroup || selectedGroupMatchedSlots.length === 0) {
      return [];
    }

    const intervalMs = planningIntervalWeeks * 7 * 24 * 60 * 60 * 1000;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const futureSlots = selectedGroupMatchedSlots.filter(
      (slot) => new Date(slot.startsAt).getTime() > Date.now(),
    );

    if (futureSlots.length === 0) {
      return [];
    }

    const usedIds = new Set<string>();
    const suggestions: Array<
      OrganizerMatchedSlotView & { suggestedGapDays: number; targetStartsAt: string }
    > = [];
    let previousAnchorTime =
      selectedGroupEvents.length > 0
        ? new Date(selectedGroupEvents[selectedGroupEvents.length - 1].startsAt).getTime()
        : Date.now();

    for (let index = 0; index < 6; index += 1) {
      const targetTime = previousAnchorTime + intervalMs;
      const minimumAllowedTime = previousAnchorTime + intervalMs * 0.6;
      const candidate = futureSlots
        .filter(
          (slot) =>
            !usedIds.has(slot.id) && new Date(slot.startsAt).getTime() >= minimumAllowedTime,
        )
        .sort((left, right) => {
          const leftDiff = Math.abs(new Date(left.startsAt).getTime() - targetTime);
          const rightDiff = Math.abs(new Date(right.startsAt).getTime() - targetTime);
          return leftDiff - rightDiff;
        })[0];

      if (!candidate) {
        break;
      }

      const candidateTime = new Date(candidate.startsAt).getTime();
      suggestions.push({
        ...candidate,
        suggestedGapDays: Math.round((candidateTime - previousAnchorTime) / oneDayMs),
        targetStartsAt: new Date(targetTime).toISOString(),
      });
      usedIds.add(candidate.id);
      previousAnchorTime = candidateTime;
    }

    return suggestions;
  }, [planningIntervalWeeks, selectedGroup, selectedGroupEvents, selectedGroupMatchedSlots]);

  useEffect(() => {
    if (!hasOrganizerGroupScope && groupScope !== "all") {
      setGroupScope("all");
    }
  }, [groupScope, hasOrganizerGroupScope]);

  useEffect(() => {
    if (!canCreateGroups || editingGroupId || groupForm.trainerId || availableTrainers.length === 0) {
      return;
    }

    setGroupForm((previous) => ({
      ...previous,
      trainerId: availableTrainers[0].id,
    }));
  }, [availableTrainers, canCreateGroups, editingGroupId, groupForm.trainerId]);

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

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedGroup) {
      toast.error("Najpierw wybierz grupę.");
      return;
    }

    if (!memberForm.participantProfileId && (!memberForm.displayName || !memberForm.phone)) {
      toast.error("Podaj imię i numer telefonu albo wybierz istniejący profil.");
      return;
    }

    try {
      setSavingMember(true);
      await addGroupMember({
        groupId: selectedGroup.id,
        participantProfileId: memberForm.participantProfileId || undefined,
        displayName: memberForm.participantProfileId ? undefined : memberForm.displayName,
        phone: memberForm.participantProfileId ? undefined : memberForm.phone,
        notes: memberForm.notes,
        referralSource: memberForm.referralSource,
        priority: memberForm.priority,
      });
      toast.success("Dodano członka grupy.");
      setMemberForm(createEmptyGroupMemberFormState());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać członka.");
    } finally {
      setSavingMember(false);
    }
  }

  async function handleSaveMember(member: GroupMember) {
    const draft = memberDrafts[member.id];

    try {
      await updateGroupMember({
        memberId: member.id,
        priority: draft?.priority ?? member.priority,
        notes: draft?.notes ?? member.notes ?? "",
      });
      toast.success("Zapisano zmiany członka grupy.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać zmian.");
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
              ? "Widzisz tylko grupy, które sam utworzyłeś albo do których już należysz. Dane administracyjne są tu ukryte."
              : "To nadrzędny kontekst dla wszystkich szkoleń Emandar w tej relacji trener-organizator."
            : isParticipantGroupViewer
              ? undefined
              : canManageGroups
                ? undefined
                : "To Twoje grupy organizatora. Bez aktywnego trenera pozostają dostępne w trybie podglądu."
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
        ) : canCreateGroups ? (
          <div className="flex flex-wrap gap-3">
            <Link
              to="/panel/grupy/utworz"
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
            >
              <Plus size={16} />
              Nowa grupa
            </Link>
          </div>
        ) : undefined
      }
    >
      {!isGroupDetailView && !isCreateGroupRoute && hasOrganizerGroupScope ? (
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
                    ? "Nie należysz jeszcze do żadnej grupy i nie masz własnych grup organizatora."
                  : "Nie masz jeszcze żadnych przypisanych grup."
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleGroups.map((group) => {
                const trainerName = trainersById.get(group.trainerId)?.displayName ?? "Trener";
                const isSelected = selectedGroup?.id === group.id;
                const isOwnedGroup = ownedGroups.some((ownedGroup) => ownedGroup.id === group.id);

                return (
                  <Link
                    key={group.id}
                    to={`/panel/grupy/${group.id}`}
                    className={`block rounded-[1.75rem] border p-4 shadow-soft transition sm:rounded-[2rem] sm:p-5 ${
                      isSelected
                        ? "border-brand-navy bg-brand-navy/5"
                        : "border-brand-line bg-white hover:bg-brand-shell/70"
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="space-y-2">
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
                        <p className="text-xl font-semibold leading-tight text-brand-navy sm:text-lg">
                          {group.name}
                        </p>
                        <p className="text-sm text-brand-muted">{trainerName}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm text-brand-muted">
                        <p>{activeMemberCounts[group.id] ?? 0} aktywnych osób</p>
                        <p className="text-right">{groupEventCounts[group.id] ?? 0} wydarzeń</p>
                      </div>
                      <p className="text-sm font-semibold text-brand-navy">Otwórz grupę</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ) : selectedGroup ? (
        <div className="space-y-6">
          {isEditGroupFormVisible ? (
            <article className="min-w-0 rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
              <SectionBlockHeading
                title="Edytuj grupę"
                description="Zmieniasz ustawienia nadrzędne dla tej relacji trener-organizator."
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
              </div>
              {selectedGroup.notes ? (
                <div className="mt-4 rounded-3xl border border-brand-line bg-brand-shell/60 p-4 text-sm text-brand-muted">
                  {selectedGroup.notes}
                </div>
              ) : null}
              {isParticipantGroupViewer ? (
                <div className="mt-4 rounded-3xl border border-brand-line bg-brand-shell/60 p-4 text-sm text-brand-muted">
                  {selectedGroupIsOwnedByCurrentUser
                    ? hasActiveOrganizerAccess
                      ? "To Twoja grupa organizatora. Masz aktywny dostęp organizatora, więc możesz zarządzać nią bez zmiany perspektywy konta."
                      : "To Twoja wcześniejsza grupa organizatora. Bez aktywnego trenera pozostaje dostępna tylko do podglądu."
                    : selectedGroupParticipantMembership
                      ? "Należysz do tej grupy jako uczestnik. Widzisz podgląd grupy i powiązane wydarzenia, bez ustawień administracyjnych."
                      : "Widzisz tę grupę w trybie podglądu."}
                </div>
              ) : null}
              {canManageGroups && selectedGroupIsOwnedByCurrentUser ? (
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
                    to="/panel/terminy"
                    className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
                  >
                    <CalendarDays size={16} />
                    Utwórz draft dla grupy
                  </Link>
                </div>
              ) : null}
            </article>

            {canManageGroups && selectedGroupIsOwnedByCurrentUser ? (
              <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
                <SectionBlockHeading
                  title="Planowanie Roczne"
                  description="System dobiera najlepsze przyszłe sloty dla tej grupy na bazie wspólnych terminów organizatora i trenera oraz docelowego interwału w tygodniach."
                />
                <div className="mt-6 flex flex-wrap gap-2">
                  {ANNUAL_PLANNING_INTERVALS.map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => setPlanningIntervalWeeks(interval)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        planningIntervalWeeks === interval
                          ? "bg-brand-navy text-white"
                          : "border border-brand-line text-brand-navy"
                      }`}
                    >
                      co {interval} tyg.
                    </button>
                  ))}
                </div>
                <div className="mt-6 space-y-3">
                  {annualPlanningSuggestions.length === 0 ? (
                    <EmptyPanelState
                      title="Brak sugestii"
                      description="Dla tej grupy nie ma jeszcze wystarczającej puli przyszłych zmatchowanych slotów, żeby zaproponować plan roczny."
                    />
                  ) : (
                    annualPlanningSuggestions.map((slot, index) => (
                      <article
                        key={slot.id}
                        className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <p className="text-lg font-semibold text-brand-navy">
                              Sugestia {index + 1} · {formatDate(slot.startsAt)}
                            </p>
                            <p className="text-sm text-brand-muted">
                              Cel: {formatDate(slot.targetStartsAt)} · faktyczny slot{" "}
                              {formatShortTime(slot.startsAt)} - {formatShortTime(slot.endsAt)}
                            </p>
                            <p className="text-sm text-brand-muted">{slot.location}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-brand-sky-deep">
                              przerwa {slot.suggestedGapDays} dni od poprzedniego wydarzenia
                            </p>
                            {slot.travelWarning ? (
                              <p className="text-sm text-amber-900">{slot.travelWarning}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/panel/terminy?groupId=${selectedGroup.id}&slotId=${slot.id}`,
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
                          >
                            <CalendarDays size={16} />
                            Otwórz draft
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </article>
            ) : null}

            <article className="min-w-0 rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
              <SectionBlockHeading
                title="Członkowie grupy"
                description={
                  isParticipantGroupViewer
                    ? "W podglądzie uczestnika pokazujemy tylko skład grupy bez danych administracyjnych."
                    : "Priorytet członka steruje tym, kto wpada automatycznie do rosteru wydarzenia i kto ma pierwszeństwo przy obsłudze listy."
                }
              />
              {canManageGroups && selectedGroupIsOwnedByCurrentUser && selectedGroup.status === "active" ? (
                <form onSubmit={handleAddMember} className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
                  <label className="grid min-w-0 gap-2 lg:col-span-2">
                    <span className="text-sm font-semibold text-brand-navy">
                      Istniejący profil uczestnika
                    </span>
                    <select
                      value={memberForm.participantProfileId}
                      onChange={(event) =>
                        setMemberForm((previous) => ({
                          ...previous,
                          participantProfileId: event.target.value,
                        }))
                      }
                      className="min-w-0 w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                    >
                      <option value="">Utwórz nowy profil przy dodawaniu</option>
                      {organizerManagedProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.displayName} · {profile.phone} · {getParticipantConfirmationLabel(profile)}
                        </option>
                      ))}
                    </select>
                  </label>
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
                      disabled={Boolean(memberForm.participantProfileId)}
                      className="min-w-0 w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
                    />
                  </label>
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-semibold text-brand-navy">Telefon</span>
                    <input
                      value={memberForm.phone}
                      onChange={(event) =>
                        setMemberForm((previous) => ({ ...previous, phone: event.target.value }))
                      }
                      disabled={Boolean(memberForm.participantProfileId)}
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
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-semibold text-brand-navy">Źródło / polecenie</span>
                    <input
                      value={memberForm.referralSource}
                      onChange={(event) =>
                        setMemberForm((previous) => ({
                          ...previous,
                          referralSource: event.target.value,
                        }))
                      }
                      className="min-w-0 w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
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
                </form>
              ) : null}
              <div className="mt-6 space-y-3">
                {selectedGroupMembers.length === 0 ? (
                  <EmptyPanelState
                    title="Brak członków"
                    description={
                      isParticipantGroupViewer
                        ? "Ta grupa nie ma jeszcze żadnych aktywnych członków."
                        : "Dodaj pierwsze osoby do grupy, aby planować szkolenia i budować roster wydarzeń."
                    }
                  />
                ) : (
                  selectedGroupMembers.map((member) => {
                    const draft = memberDrafts[member.id];
                    const participantProfile =
                      participantProfilesById.get(member.participantProfileId) ?? null;

                    return (
                      <article
                        key={member.id}
                        className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <p className="text-lg font-semibold text-brand-navy">
                              {member.participantDisplayName}
                            </p>
                            {isParticipantGroupViewer ? (
                              <p className="text-sm text-brand-muted">
                                {member.participantProfileId === currentUser.participantProfileId
                                  ? "To Twoje miejsce w tej grupie."
                                  : "Członek grupy."}
                              </p>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                                  <Phone size={14} />
                                  <span>{member.participantPhone}</span>
                                </div>
                                <p className="text-xs uppercase tracking-[0.2em] text-brand-sky-deep">
                                  {getGroupPriorityLabel(draft?.priority ?? member.priority)} ·{" "}
                                  {getParticipantConfirmationLabel(participantProfile)}
                                </p>
                              </>
                            )}
                          </div>
                          {canManageGroups && selectedGroupIsOwnedByCurrentUser ? (
                            <div className="grid min-w-0 gap-3 sm:min-w-[250px]">
                              <select
                                value={draft?.priority ?? member.priority}
                                onChange={(event) =>
                                  setMemberDrafts((previous) => ({
                                    ...previous,
                                    [member.id]: {
                                      priority: event.target.value as GroupMemberPriority,
                                      notes: previous[member.id]?.notes ?? member.notes ?? "",
                                    },
                                  }))
                                }
                                className="min-w-0 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 text-brand-navy outline-none"
                              >
                                <option value="stali">Stali</option>
                                <option value="regularni">Regularni</option>
                                <option value="rezerwowi">Rezerwowi</option>
                              </select>
                              <input
                                value={draft?.notes ?? member.notes ?? ""}
                                onChange={(event) =>
                                  setMemberDrafts((previous) => ({
                                    ...previous,
                                    [member.id]: {
                                      priority: previous[member.id]?.priority ?? member.priority,
                                      notes: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Notatki o uczestniku"
                                className="min-w-0 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 text-brand-navy outline-none"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleSaveMember(member)}
                                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white"
                                >
                                  <Check size={14} />
                                  Zapisz
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleRemoveMember(member.id)}
                                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                                >
                                  <Trash2 size={14} />
                                  Usuń
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </article>

            <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
              <SectionBlockHeading
                title="Wydarzenia grupy"
                description={
                  isParticipantGroupViewer
                    ? "Tutaj widać szkolenia przypięte do tej grupy. Szczegóły uczestnictwa sprawdzisz z poziomu listy szkoleń."
                    : "Tutaj widać wszystkie szkolenia i drafty przypięte do tej grupy."
                }
              />
              <div className="mt-6 space-y-3">
                {selectedGroupEvents.length === 0 ? (
                  <EmptyPanelState
                    title="Brak wydarzeń"
                    description="Po utworzeniu draftu albo szkolenia z poziomu terminów wydarzenia pojawią się tutaj automatycznie."
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

export function AvailabilityPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    addOrganizerCalendarFeed,
    addTrainerCalendarFeed,
    addTrainerSharedSlot,
    createOrganizerTrainingDraft,
    currentUser,
    decideOrganizerTrainingDraft,
    removeOrganizerCalendarFeed,
    removeTrainerCalendarFeed,
    store,
    syncOwnOrganizerCalendarFeeds,
    syncOwnTrainerCalendarFeeds,
    updateOrganizerCalendarFeedEnabled,
    updateOrganizerTrainingDraft,
    updateTrainerCalendarFeedEnabled,
    updateTrainerSharedSlot,
    archiveTrainerSharedSlot,
    withdrawOrganizerTrainingDraft,
  } = useAppState();
  const [organizerFeedForm, setOrganizerFeedForm] = useState({
    provider: "google" as TrainerCalendarFeedProvider,
    url: "",
  });
  const [syncingTrainerFeeds, setSyncingTrainerFeeds] = useState(false);
  const [syncingOrganizerFeeds, setSyncingOrganizerFeeds] = useState(false);
  const [activeFreeSliceBucket, setActiveFreeSliceBucket] = useState<
    "all" | TrainerFreeDaySliceBucket
  >("all");
  const [draftEditorMode, setDraftEditorMode] = useState<"create" | "edit" | null>(null);
  const [draftFormValues, setDraftFormValues] = useState<OrganizerTrainingDraftFormValues | null>(
    null,
  );
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [withdrawingDraftId, setWithdrawingDraftId] = useState<string | null>(null);

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const hasTrainerAvailabilityScope =
    hasInheritedRole(currentUser, "trainer") && Boolean(trainerProfile) && !isCommunityTrainer;
  const hasOrganizerAvailabilityScope =
    canUseOrganizerFunctions(currentUser) && Boolean(organizerProfile);

  const ownCalendarFeeds = useMemo(
    () =>
      (trainerProfile
        ? (store.trainerCalendarFeeds ?? []).filter((feed) => feed.trainerId === trainerProfile.id)
        : []
      ).sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [store.trainerCalendarFeeds, trainerProfile],
  );
  const ownSharedSlots = useMemo(
    () =>
      (trainerProfile
        ? (store.trainerSharedSlots ?? []).filter((slot) => slot.trainerId === trainerProfile.id)
        : []
      ).sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()),
    [store.trainerSharedSlots, trainerProfile],
  );
  const trainerDrafts = useMemo(
    () =>
      sortEventsByDate(
        (store.trainingEvents ?? []).filter(
          (event) =>
            event.trainerId === trainerProfile?.id &&
            resolveTrainingEventWorkflowStatus(event) === "draft-requested",
        ),
      ),
    [store.trainingEvents, trainerProfile?.id],
  );
  const organizerFeeds = useMemo(
    () =>
      (organizerProfile
        ? (store.organizerCalendarFeeds ?? []).filter(
            (feed) => feed.organizerId === organizerProfile.id,
          )
        : []
      ).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [organizerProfile, store.organizerCalendarFeeds],
  );
  const organizerRelationFeeds = useMemo(
    () =>
      (organizerProfile
        ? (store.trainerOrganizerCalendarFeeds ?? []).filter(
            (feed) => feed.organizerId === organizerProfile.id && feed.enabled,
          )
        : []
      ).sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
    [organizerProfile, store.trainerOrganizerCalendarFeeds],
  );

  useEffect(() => {
    if (!hasTrainerAvailabilityScope) {
      return;
    }

    void syncOwnTrainerCalendarFeeds().catch(() => {});
  }, [hasTrainerAvailabilityScope, syncOwnTrainerCalendarFeeds]);
  useEffect(() => {
    if (!hasOrganizerAvailabilityScope) {
      return;
    }

    void syncOwnOrganizerCalendarFeeds().catch(() => {});
  }, [hasOrganizerAvailabilityScope, syncOwnOrganizerCalendarFeeds]);

  const ownBusyIntervals = useMemo(() => {
    if (!trainerProfile) {
      return [];
    }

    return [
      ...store.trainingEvents
        .filter(
          (event) =>
            event.trainerId === trainerProfile.id &&
            !isTrainingEventArchived(event) &&
            !["draft-requested", "trainer-rejected", "withdrawn"].includes(
              resolveTrainingEventWorkflowStatus(event),
            ) &&
            resolveTrainingEventStatus(event.status) !== "cancelled",
        )
        .flatMap((event) =>
          getTrainingEventScheduleDays(event).map((day) => ({
            startsAt: day.startsAt,
            endsAt: day.endsAt,
            source: "emandar" as const,
          })),
        ),
      ...(store.trainerExternalBusyMonths ?? [])
        .filter((month) => month.trainerId === trainerProfile.id)
        .flatMap((month) => month.intervals),
    ];
  }, [
    store.trainerExternalBusyMonths,
    store.trainingEvents,
    trainerProfile,
  ]);
  const freeDaySlices = useMemo(() => {
    if (!trainerProfile || ownCalendarFeeds.length === 0) {
      return [];
    }

    return buildTrainerFreeDaySlices({
      busyIntervals: ownBusyIntervals,
      rangeStart: new Date().toISOString(),
      rangeEnd: getAvailabilityHorizonEnd(),
      minimumDurationHours: 1,
    }).slice(0, 240);
  }, [ownBusyIntervals, ownCalendarFeeds.length, trainerProfile]);
  const freeDaySlicesByBucket = useMemo(
    () =>
      FREE_SLICE_BUCKETS.reduce<Record<TrainerFreeDaySliceBucket, typeof freeDaySlices>>(
        (accumulator, bucket) => {
          accumulator[bucket] = freeDaySlices.filter((slice) => slice.spanBucket === bucket);
          return accumulator;
        },
        {
          "1-day": [],
          "2-days": [],
          "3-days": [],
          "4-plus-days": [],
        },
      ),
    [freeDaySlices],
  );
  const enabledFeedCount = ownCalendarFeeds.filter((feed) => feed.enabled).length;
  const approvedRelationsById = useMemo(
    () =>
      new Map(
        (store.relations ?? [])
          .filter((relation) => relation.status === "approved")
          .map((relation) => [relation.id, relation]),
      ),
    [store.relations],
  );
  const trainerById = useMemo(
    () => new Map((store.trainers ?? []).map((trainer) => [trainer.id, trainer])),
    [store.trainers],
  );
  const organizerMatchedSlots = useMemo(() => {
    const sharedSlotsById = new Map((store.trainerSharedSlots ?? []).map((slot) => [slot.id, slot]));

    return organizerRelationFeeds
      .flatMap((feed) =>
        (feed.matchedSharedSlotIds ?? []).map((slotId) => {
          const slot = sharedSlotsById.get(slotId);

          if (!slot || slot.status === "archived" || slot.archivedAt) {
            return null;
          }

          const trainer = trainerById.get(slot.trainerId);
          const relation = approvedRelationsById.get(feed.relationId);
          const baseSlot = {
            ...slot,
            trainerName: trainer?.displayName ?? "Przekazujący Wiedzę",
            relation,
            googleFeedUrl: feed.publicFeedUrl,
          } satisfies OrganizerMatchedSlotView;

          return {
            ...baseSlot,
            travelWarning: buildTrainerTravelWarningForSlot(baseSlot, store.trainingEvents ?? []),
          } satisfies OrganizerMatchedSlotView;
        }),
      )
      .filter((slot): slot is OrganizerMatchedSlotView => Boolean(slot))
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  }, [
    approvedRelationsById,
    organizerRelationFeeds,
    store.trainerSharedSlots,
    store.trainingEvents,
    trainerById,
  ]);
  const organizerGroupMemberCounts = useMemo(
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
  const organizerGroups = useMemo(
    () =>
      (store.groups ?? [])
        .filter(
          (group) =>
            group.organizerId === organizerProfile?.id &&
            group.status === "active" &&
            approvedRelationsById.has(`${group.trainerId}__${group.organizerId}`),
        )
        .map((group) => ({
          id: group.id,
          name: group.name,
          trainerId: group.trainerId,
          trainerName: trainerById.get(group.trainerId)?.displayName,
          activeMembersCount: organizerGroupMemberCounts[group.id] ?? 0,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "pl")),
    [
      approvedRelationsById,
      organizerGroupMemberCounts,
      organizerProfile?.id,
      store.groups,
      trainerById,
    ],
  );
  const organizerDrafts = useMemo(() => {
    const matchedSlotsById = new Map(organizerMatchedSlots.map((slot) => [slot.id, slot]));

    return sortEventsByDate(
      (store.trainingEvents ?? [])
        .filter((event) => event.organizerId === organizerProfile?.id && Boolean(event.sharedSlotId))
        .map((event) => ({
          ...event,
          trainerName: trainerById.get(event.trainerId ?? "")?.displayName,
          slot: event.sharedSlotId ? matchedSlotsById.get(event.sharedSlotId) ?? null : null,
        })),
    ) as OrganizerTrainingDraftListItem[];
  }, [organizerMatchedSlots, organizerProfile?.id, store.trainingEvents, trainerById]);
  const visibleFreeSliceBuckets = useMemo(() => {
    if (activeFreeSliceBucket !== "all") {
      return [activeFreeSliceBucket];
    }

    return FREE_SLICE_BUCKETS.filter(
      (bucket) => (freeDaySlicesByBucket[bucket] ?? []).length > 0,
    );
  }, [activeFreeSliceBucket, freeDaySlicesByBucket]);

  useEffect(() => {
    if (!hasOrganizerAvailabilityScope || !organizerProfile) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const slotId = params.get("slotId");

    if (!slotId) {
      return;
    }

    const slot = organizerMatchedSlots.find((item) => item.id === slotId);
    if (!slot) {
      return;
    }

    const requestedGroupId = params.get("groupId");
    const matchingGroups = organizerGroups.filter((group) => group.trainerId === slot.trainerId);
    const resolvedGroupId =
      requestedGroupId && matchingGroups.some((group) => group.id === requestedGroupId)
        ? requestedGroupId
        : matchingGroups.length === 1
          ? matchingGroups[0].id
          : "";

    setDraftEditorMode("create");
    setEditingDraftId(null);
    setDraftFormValues({
      ...createOrganizerDraftFormValuesFromSlot(slot),
      groupId: resolvedGroupId,
    });
    void navigate("/panel/terminy", { replace: true });
  }, [
    hasOrganizerAvailabilityScope,
    location.search,
    navigate,
    organizerGroups,
    organizerMatchedSlots,
    organizerProfile,
  ]);

  async function handleSyncTrainerFeeds() {
    try {
      setSyncingTrainerFeeds(true);
      await syncOwnTrainerCalendarFeeds();
      toast.success("Feedy iCal zostaly zsynchronizowane.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udalo sie zsynchronizowac kalendarzy.",
      );
    } finally {
      setSyncingTrainerFeeds(false);
    }
  }

  async function handleSyncOrganizerFeeds() {
    try {
      setSyncingOrganizerFeeds(true);
      await syncOwnOrganizerCalendarFeeds();
      toast.success("Feedy organizatora zostaly zsynchronizowane.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udalo sie zsynchronizowac feedow organizatora.",
      );
    } finally {
      setSyncingOrganizerFeeds(false);
    }
  }

  async function handleCopyLink(value: string, label = "Skopiowano link.") {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Nie udało się skopiować linku.");
    }
  }

  async function handleAddTrainerFeed(
    input: { provider: TrainerCalendarFeedProvider; url: string },
  ) {
    try {
      await addTrainerCalendarFeed(input);
      toast.success("Dodano feed iCal.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udalo sie dodac feedu iCal.");
    }
  }

  async function handleAddOrganizerFeed(
    input: { provider: TrainerCalendarFeedProvider; url: string },
  ) {
    try {
      await addOrganizerCalendarFeed(input);
      setOrganizerFeedForm((current) => ({
        ...current,
        url: "",
      }));
      toast.success("Dodano feed organizatora.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udalo sie dodac feedu.");
    }
  }

  async function handleCreateDraft(values: OrganizerTrainingDraftFormValues) {
    if (!values.groupId) {
      toast.error("Wybierz grupę dla draftu.");
      return;
    }

    try {
      setSavingDraft(true);
      await createOrganizerTrainingDraft({
        groupId: values.groupId,
        sharedSlotId: values.sharedSlotId,
        title: values.title,
        summary: values.summary,
        description: values.description,
        type: values.type,
        location: values.location,
        capacity: values.capacity,
        minimumParticipants: values.minimumParticipants,
        status: values.status,
        publishAutomaticallyAfterTrainerApproval: values.publishAutomaticallyAfterTrainerApproval,
        tags: parseEventTags(values.tagsText),
        scheduleDays: values.scheduleDays,
      });
      toast.success("Utworzono draft szkolenia.");
      setDraftEditorMode(null);
      setDraftFormValues(null);
      setEditingDraftId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udalo sie utworzyc draftu.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleUpdateDraft(values: OrganizerTrainingDraftFormValues) {
    if (!editingDraftId) {
      return;
    }

    if (!values.groupId) {
      toast.error("Wybierz grupę dla draftu.");
      return;
    }

    try {
      setSavingDraft(true);
      await updateOrganizerTrainingDraft({
        eventId: editingDraftId,
        groupId: values.groupId,
        sharedSlotId: values.sharedSlotId,
        title: values.title,
        summary: values.summary,
        description: values.description,
        type: values.type,
        location: values.location,
        capacity: values.capacity,
        minimumParticipants: values.minimumParticipants,
        status: values.status,
        publishAutomaticallyAfterTrainerApproval: values.publishAutomaticallyAfterTrainerApproval,
        tags: parseEventTags(values.tagsText),
        scheduleDays: values.scheduleDays,
      });
      toast.success("Zapisano draft szkolenia.");
      setDraftEditorMode(null);
      setDraftFormValues(null);
      setEditingDraftId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udalo sie zapisac draftu.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleWithdrawDraft(eventId: string) {
    try {
      setWithdrawingDraftId(eventId);
      await withdrawOrganizerTrainingDraft(eventId);
      toast.success("Wycofano draft szkolenia.");
      if (editingDraftId === eventId) {
        setDraftEditorMode(null);
        setDraftFormValues(null);
        setEditingDraftId(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udalo sie wycofac draftu.");
    } finally {
      setWithdrawingDraftId(null);
    }
  }

  return (
    <PanelSection
      eyebrow="Terminy"
      title="Terminy i feedy"
      description="Jeden ekran zbiera terminy i feedy dla wszystkich warstw, które masz odblokowane. Wyższy poziom nie ukrywa już niższych workflowów."
    >
      {hasTrainerAvailabilityScope && (
        <div className="space-y-6">
          <TrainerAvailabilityWorkspace
            currentUserRole="trainer"
            feeds={ownCalendarFeeds}
            sharedSlots={ownSharedSlots}
            drafts={trainerDrafts}
            syncingFeeds={syncingTrainerFeeds}
            onSyncFeeds={() => void handleSyncTrainerFeeds()}
            onAddFeed={(input) => handleAddTrainerFeed(input)}
            onToggleFeedEnabled={(feedId, enabled) =>
              updateTrainerCalendarFeedEnabled(feedId, enabled)
            }
            onRemoveFeed={(feedId) => removeTrainerCalendarFeed(feedId)}
            onCreateSlot={(input) => addTrainerSharedSlot(input)}
            onUpdateSlot={(input) => updateTrainerSharedSlot(input)}
            onArchiveSlot={(slotId) => archiveTrainerSharedSlot(slotId)}
            onAcceptDraft={(draft) =>
              decideOrganizerTrainingDraft({
                eventId: draft.id,
                decision: "accepted",
              }).then(() => toast.success("Zaakceptowano draft szkolenia."))
            }
            onRejectDraft={(draft, reason) =>
              decideOrganizerTrainingDraft({
                eventId: draft.id,
                decision: "rejected",
                message: reason,
              }).then(() => toast.success("Odrzucono draft szkolenia."))
            }
          />

          <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <SectionBlockHeading
              title="Wolne przedzialy z prywatnego kalendarza"
              description="To warstwa pomocnicza dla trenera. Zrodlowe wydarzenia iCal pozostaja ukryte, a tutaj widac tylko przyszle wolne okna do publikacji jako sloty."
            />
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveFreeSliceBucket("all")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  activeFreeSliceBucket === "all"
                    ? "bg-brand-navy text-white"
                    : "border border-brand-line text-brand-navy"
                }`}
              >
                Wszystkie ({freeDaySlices.length})
              </button>
              {FREE_SLICE_BUCKETS.map((bucket) => (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => setActiveFreeSliceBucket(bucket)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    activeFreeSliceBucket === bucket
                      ? "bg-brand-navy text-white"
                      : "border border-brand-line text-brand-navy"
                  }`}
                >
                  {getFreeSliceBucketLabel(bucket)} ({freeDaySlicesByBucket[bucket].length})
                </button>
              ))}
            </div>

            {enabledFeedCount === 0 ? (
              <div className="mt-6">
                <EmptyPanelState
                  title="Brak aktywnego feedu"
                  description="Aktywuj przynajmniej jeden prywatny feed iCal, aby zobaczyc przyszle wolne przedzialy."
                />
              </div>
            ) : freeDaySlices.length === 0 ? (
              <div className="mt-6">
                <EmptyPanelState
                  title="Brak wolnych przedzialow"
                  description="W aktualnym horyzoncie nie ma jeszcze wolnych dziennych okien spelniajacych minimum jednej godziny."
                />
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {visibleFreeSliceBuckets.map((bucket) => (
                  <section key={bucket}>
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg font-semibold text-brand-navy">
                        {getFreeSliceBucketLabel(bucket)}
                      </h4>
                      <p className="text-sm text-brand-muted">
                        {freeDaySlicesByBucket[bucket].length} przedzialow
                      </p>
                    </div>
                    <div className="mt-3 space-y-3">
                      {freeDaySlicesByBucket[bucket].map((slice) => (
                        <article
                          key={`${slice.startsAt}-${slice.endsAt}`}
                          className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-brand-navy">
                                {formatDate(slice.startsAt)}
                              </p>
                              <p className="mt-1 text-brand-muted">
                                {formatShortTime(slice.startsAt)} - {formatShortTime(slice.endsAt)}
                              </p>
                            </div>
                            <div className="text-right text-sm text-brand-muted">
                              <p>{formatDurationHours(slice.durationHours)}</p>
                              <p className="mt-1">
                                Luka: {slice.spanDays} {slice.spanDays === 1 ? "dzien" : "dni"}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </article>
        </div>
      )}

      {hasOrganizerAvailabilityScope && organizerProfile && (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <OrganizerCalendarFeedsPanel
              feeds={organizerFeeds}
              draft={organizerFeedForm}
              onDraftChange={setOrganizerFeedForm}
              onCreateFeed={(input) => void handleAddOrganizerFeed(input)}
              onToggleEnabled={(feedId, enabled) =>
                updateOrganizerCalendarFeedEnabled(feedId, enabled)
              }
              onRemoveFeed={(feedId) => removeOrganizerCalendarFeed(feedId)}
              onSync={() => void handleSyncOrganizerFeeds()}
              syncing={syncingOrganizerFeeds}
            />
            <OrganizerMatchedSlotsPanel
              slots={organizerMatchedSlots}
              onCreateDraft={(slotId) => {
                const slot = organizerMatchedSlots.find((item) => item.id === slotId);
                if (!slot) {
                  return;
                }

                const matchingGroups = organizerGroups.filter(
                  (group) => group.trainerId === slot.trainerId,
                );
                setDraftEditorMode("create");
                setEditingDraftId(null);
                setDraftFormValues({
                  ...createOrganizerDraftFormValuesFromSlot(slot),
                  groupId: matchingGroups.length === 1 ? matchingGroups[0].id : "",
                });
              }}
              onCopyFeedLink={(feedUrl) => void handleCopyLink(feedUrl, "Skopiowano adres feedu.")}
            />
          </div>

          {draftFormValues && (
            <OrganizerTrainingDraftEditorPanel
              mode={draftEditorMode ?? "create"}
              values={draftFormValues}
              availableSlots={organizerMatchedSlots}
              availableGroups={organizerGroups}
              onChange={setDraftFormValues}
              onSubmit={(values) =>
                draftEditorMode === "edit"
                  ? void handleUpdateDraft(values)
                  : void handleCreateDraft(values)
              }
              onCancel={() => {
                setDraftEditorMode(null);
                setDraftFormValues(null);
                setEditingDraftId(null);
              }}
              onWithdraw={
                draftEditorMode === "edit" && editingDraftId
                  ? (_values) => void handleWithdrawDraft(editingDraftId)
                  : undefined
              }
              submitting={savingDraft}
              withdrawing={Boolean(editingDraftId && withdrawingDraftId === editingDraftId)}
            />
          )}

          <OrganizerTrainingDraftListPanel
            drafts={organizerDrafts}
            onEdit={(draft) => {
              if (resolveTrainingEventWorkflowStatus(draft) !== "draft-requested") {
                toast.error("Edytować można tylko draft oczekujący na decyzję trenera.");
                return;
              }

              setDraftEditorMode("edit");
              setEditingDraftId(draft.id);
              setDraftFormValues(createOrganizerDraftFormValuesFromEvent(draft));
            }}
            onWithdraw={(draft) => void handleWithdrawDraft(draft.id)}
          />

          {organizerRelationFeeds.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {organizerRelationFeeds.map((feed) => {
                const trainerName =
                  trainerById.get(feed.trainerId)?.displayName ?? "Przekazujący Wiedzę";

                return (
                  <OrganizerGoogleCalendarExportPanel
                    key={feed.id}
                    title={`Google Calendar · ${trainerName}`}
                    description="Subskrybuj dopasowany feed tej relacji, aby widzieć tylko sloty zgodne z Twoim kalendarzem."
                    feedUrl={feed.publicFeedUrl ?? ""}
                    onCopyLink={(subscribeUrl) =>
                      void handleCopyLink(subscribeUrl, "Skopiowano link do Google Calendar.")
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {currentUser.role === "admin" && (
        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <SectionBlockHeading
            title="Nowy model terminow"
            description="Admin widzi tu stan techniczny wdrozenia nowego flow slotow, feedow i draftow."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4">
              <p className="text-sm text-brand-muted">Sloty trenerow</p>
              <p className="mt-2 text-2xl font-semibold text-brand-navy">
                {store.trainerSharedSlots?.length ?? 0}
              </p>
            </div>
            <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4">
              <p className="text-sm text-brand-muted">Feedy organizatorow</p>
              <p className="mt-2 text-2xl font-semibold text-brand-navy">
                {store.organizerCalendarFeeds?.length ?? 0}
              </p>
            </div>
            <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4">
              <p className="text-sm text-brand-muted">Feedy relacji</p>
              <p className="mt-2 text-2xl font-semibold text-brand-navy">
                {store.trainerOrganizerCalendarFeeds?.length ?? 0}
              </p>
            </div>
            <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4">
              <p className="text-sm text-brand-muted">Drafty szkoleń</p>
              <p className="mt-2 text-2xl font-semibold text-brand-navy">
                {
                  (store.trainingEvents ?? []).filter(
                    (event) => Boolean(event.sharedSlotId),
                  ).length
                }
              </p>
            </div>
          </div>
        </article>
      )}
    </PanelSection>
  );
}

export function EventsPage() {
  const location = useLocation();
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
  const isLegacyCreatorView = location.pathname.endsWith("/kreator-wydarzen");
  const isCreatorView = isCommunityCreatorView || isOfficialCreatorView;
  const canCreateCommunityEvent = true;
  const [eventScope, setEventScope] = useState<"all" | "mine">(
    isCommunitySection ? "all" : hasOfficialManagementScope ? "mine" : "all",
  );
  const [communityModerationScope, setCommunityModerationScope] =
    useState<CommunityModerationTimelineScope>("pending");
  const participantRecords = useMemo(
    () => getParticipantEnrollmentRecords(currentUser.id, store),
    [currentUser.id, store],
  );
  const participantGroupRecords = useMemo(
    () =>
      currentUser.participantProfileId
        ? getParticipantGroupEventRecords(currentUser.participantProfileId, store).filter(
            (record) => !isCommunityPanelEvent(record.event),
          )
        : [],
    [currentUser.participantProfileId, store],
  );
  const participantOfficialRecords = useMemo(
    () =>
      participantRecords.filter(
        (record) =>
          !isCommunityPanelEvent(record.event) &&
          !(record.event.groupId && record.request.eventParticipantId),
      ),
    [participantRecords],
  );
  const participantCommunityRecords = useMemo(
    () => participantRecords.filter((record) => isCommunityPanelEvent(record.event)),
    [participantRecords],
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

  const availableOrganizers = useMemo(
    () =>
      isTrainerManager && !isCommunityTrainer
        ? store.relations
            .filter(
              (relation) =>
                relation.trainerId === trainerProfile?.id && relation.status === "approved",
            )
            .map((relation) =>
              store.organizers.find((item) => item.id === relation.organizerId),
            )
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
        : [],
    [
      isCommunityTrainer,
      isTrainerManager,
      store.organizers,
      store.relations,
      trainerProfile?.id,
    ],
  );
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
  const selfManagedOrganizerPlaceholder = "-";
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

    setTrainerEventForm((previous) => ({
      ...previous,
      groupId,
      trainerId: nextGroup?.trainerId ?? previous.trainerId,
      location:
        nextGroup?.defaultLocation && previous.location !== nextGroup.defaultLocation
          ? nextGroup.defaultLocation
          : previous.location,
      capacity:
        typeof nextGroup?.defaultCapacity === "number"
          ? String(nextGroup.defaultCapacity)
          : previous.capacity,
      confirmationLeadTimeDays:
        typeof nextGroup?.defaultConfirmationLeadTimeDays === "number"
          ? String(nextGroup.defaultConfirmationLeadTimeDays)
          : previous.confirmationLeadTimeDays,
      tags:
        nextGroup?.defaultTags && nextGroup.defaultTags.length > 0
          ? nextGroup.defaultTags.join(", ")
          : previous.tags,
    }));
  }

  useEffect(() => {
    if (!isTrainerManager || isCommunityTrainer) {
      return;
    }

    setTrainerEventForm((previous) => {
      const nextOrganizerId = previous.organizerId || availableOrganizers[0]?.id || "";
      const shouldSelfManage = availableOrganizers.length === 0 || previous.selfManagedByTrainer;
      if (
        previous.organizerId === nextOrganizerId &&
        previous.selfManagedByTrainer === shouldSelfManage
      ) {
        return previous;
      }

      return {
        ...previous,
        organizerId: nextOrganizerId,
        selfManagedByTrainer: shouldSelfManage,
      };
    });
  }, [availableOrganizers, isCommunityTrainer, isTrainerManager]);

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
    trainerEventForm.groupId,
  ]);

  if (isLegacyCreatorView) {
    return (
      <Navigate
        to={
          canCreateOfficialTraining
            ? "/panel/szkolenia/utworz"
            : "/panel/wydarzenia-spolecznosci/utworz"
        }
        replace
      />
    );
  }

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
          <form
            onSubmit={async (event) => {
              event.preventDefault();
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
            className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
          >
            <CommunityEventEditorFields
              values={getCommunityEventEditorValuesFromTrainingForm(trainerEventForm)}
              uploadingImages={uploadingCreatorImages}
              disabled={creatingEvent}
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
            />

            <div className="mt-4 rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-sm text-brand-muted">
              Po zapisie wydarzenie trafi do moderacji admina. Publikacja następuje dopiero po
              akceptacji Dariusza albo roli admin.
            </div>

            <button
              type="submit"
              disabled={creatingEvent}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {creatingEvent ? "Zapisywanie..." : "Wyślij wydarzenie do moderacji"}
            </button>
          </form>
        ) : !isCommunitySection && isOrganizerManager && availableOfficialGroups.length === 0 ? (
          <EmptyPanelState
            title="Najpierw utwórz grupę"
            description="Oficjalne szkolenie organizatora musi być przypięte do grupy. Najpierw dodaj grupę, a potem wróć do kreatora szkolenia."
          />
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setCreatingEvent(true);

              try {
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
                  organizerId:
                    isTrainerManager &&
                    !isCommunitySection &&
                    !isCommunityTrainer &&
                    !trainerEventForm.selfManagedByTrainer
                      ? trainerEventForm.organizerId
                      : undefined,
                  summary: trainerEventForm.summary,
                  description: trainerEventForm.description,
                  tags: parseEventTags(trainerEventForm.tags),
                  scheduleDays: buildScheduleDaysFromDrafts(
                    trainerEventForm.firstDayDate,
                    trainerEventForm.scheduleDays,
                  ),
                  type: isCommunitySection
                    ? "Wydarzenie społeczności"
                    : trainerEventForm.type,
                  status: trainerEventForm.status,
                  location: trainerEventForm.location,
                  capacity: Number(trainerEventForm.capacity),
                  minimumParticipants: Number(trainerEventForm.minimumParticipants),
                  confirmationLeadTimeDays: Number(trainerEventForm.confirmationLeadTimeDays),
                  isPublished: isCommunitySection ? false : trainerEventForm.isPublished,
                  brandStatus: isCommunitySection ? "supported" : undefined,
                  eventTypeSystem:
                    !isCommunitySection && selectedOfficialGroup
                      ? selectedOfficialGroup.defaultEventType
                      : undefined,
                  selfManagedByTrainer:
                    isTrainerManager &&
                    !isCommunitySection &&
                    !isCommunityTrainer
                      ? trainerEventForm.selfManagedByTrainer
                      : undefined,
                });
                toast.success(
                  isCommunitySection
                    ? "Wydarzenie zostało wysłane do moderacji."
                    : "Szkolenie zostało dodane.",
                );
                setTrainerEventForm((previous) => ({
                  ...createEmptyTrainingEventFormState(),
                  groupId:
                    !isCommunitySection &&
                    hasOfficialManagementScope
                      ? previous.groupId
                      : "",
                  trainerId:
                    !isCommunitySection && selectedOfficialGroup
                      ? selectedOfficialGroup.trainerId
                      : !isCommunitySection && isOrganizerManager
                        ? availableTrainers[0]?.id ?? ""
                      : previous.trainerId,
                  location:
                    !isCommunitySection && selectedOfficialGroup?.defaultLocation
                      ? selectedOfficialGroup.defaultLocation
                      : "",
                  capacity:
                    !isCommunitySection &&
                    typeof selectedOfficialGroup?.defaultCapacity === "number"
                      ? String(selectedOfficialGroup.defaultCapacity)
                      : "20",
                  confirmationLeadTimeDays:
                    !isCommunitySection &&
                    typeof selectedOfficialGroup?.defaultConfirmationLeadTimeDays === "number"
                      ? String(selectedOfficialGroup.defaultConfirmationLeadTimeDays)
                      : "5",
                  tags:
                    !isCommunitySection &&
                    selectedOfficialGroup?.defaultTags &&
                    selectedOfficialGroup.defaultTags.length > 0
                      ? selectedOfficialGroup.defaultTags.join(", ")
                      : "",
                  isPublished: !isCommunitySection,
                  selfManagedByTrainer:
                    isTrainerManager && !isCommunitySection
                      ? previous.selfManagedByTrainer
                      : false,
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
            {isTrainerManager &&
              !isCommunitySection &&
              !isCommunityTrainer &&
              availableOrganizers.length === 0 && (
                <div className="mb-6 rounded-[2rem] border border-brand-sky/35 bg-[linear-gradient(135deg,rgba(14,72,139,0.08),rgba(112,170,230,0.16))] p-5 text-brand-navy shadow-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-sky-deep">
                        Tryb samodzielny
                      </p>
                      <h4 className="mt-2 text-xl font-semibold">
                        Możesz od razu utworzyć własne szkolenie
                      </h4>
                      <p className="mt-2 max-w-2xl text-sm text-brand-muted">
                        Nie masz jeszcze aktywnej relacji z organizatorem, więc to wydarzenie
                        zapisze się jako szkolenie organizowane bezpośrednio przez Ciebie.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setTrainerEventForm((previous) => ({
                          ...previous,
                          selfManagedByTrainer: true,
                        }))
                      }
                      className="inline-flex items-center justify-center rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-navy/90"
                    >
                      Tworzę własne szkolenie
                    </button>
                  </div>
                </div>
              )}

            <div className="grid gap-4 xl:grid-cols-2">
              {!isCommunitySection &&
                hasOfficialManagementScope && (
                <label className="grid gap-2 xl:col-span-2">
                  <span className="text-sm font-semibold text-brand-navy">Grupa</span>
                  <select
                    required={isOrganizerManager}
                    value={trainerEventForm.groupId}
                    onChange={(event) => applyOfficialGroupToTrainingForm(event.target.value)}
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                  >
                    {isTrainerManager ? (
                      <option value="">Bez przypiętej grupy</option>
                    ) : null}
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
                    Wybierz jedną z istniejących rezerwacji tej grupy albo ustaw nową datę niżej.
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

              {!isCommunitySection && !isCommunityTrainer && isTrainerManager && (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Organizator</span>
                  <select
                    required={!trainerEventForm.selfManagedByTrainer}
                    disabled={trainerEventForm.selfManagedByTrainer}
                    value={
                      trainerEventForm.selfManagedByTrainer
                        ? selfManagedOrganizerPlaceholder
                        : trainerEventForm.organizerId
                    }
                    onChange={(event) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        organizerId: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                  >
                    <option value={selfManagedOrganizerPlaceholder}>-</option>
                    {availableOrganizers.map((organizer) => (
                      <option key={organizer.id} value={organizer.id}>
                        {organizer.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!isCommunitySection && !isCommunityTrainer && isTrainerManager && (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Tryb organizacji</span>
                  <span className="flex min-h-[54px] items-center rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy">
                    <input
                      type="checkbox"
                      checked={trainerEventForm.selfManagedByTrainer}
                      onChange={(event) =>
                        setTrainerEventForm((previous) => ({
                          ...previous,
                          selfManagedByTrainer: event.target.checked,
                        }))
                      }
                    />
                    <span className="ml-3 text-sm font-semibold">
                      Sam organizuję to szkolenie
                    </span>
                  </span>
                </label>
              )}

              {!isCommunitySection && !isCommunityTrainer && hasOfficialManagementScope && (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Typ szkolenia</span>
                  <input
                    required
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
                  required
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
                    : "Krótka informacja od organizatora"}
                </span>
                <textarea
                  required
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
                    : "Dłuższy opis na widoku szczegółowym"}
                </span>
                <textarea
                  required
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
                  required
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
                  required
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
                  required
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
                <span className="text-sm text-brand-muted">
                  Ile dni przed wydarzeniem wysłać SMS z prośbą o potwierdzenie udziału.
                  {!isCommunitySection && selectedOfficialGroup
                    ? " Domyślnie ta wartość startuje z ustawień grupy."
                    : ""}
                </span>
              </label>

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
          {participantOfficialRecords.length === 0 && participantGroupRecords.length === 0 ? (
            <EmptyPanelState
              title="Nie masz jeszcze żadnych szkoleń"
              description="Kiedy zapiszesz się na szkolenie Emandar, pojawi się ono tutaj."
            />
          ) : (
            <>
              {participantGroupRecords.length > 0 ? (
                <div className="space-y-4">
                  <SectionBlockHeading />
                  {participantGroupRecords.map((record) => (
                    <ParticipantGroupEventCard
                      key={record.eventParticipant.id}
                      record={record}
                    />
                  ))}
                </div>
              ) : null}

              {participantOfficialRecords.length > 0 ? (
                <div className="space-y-4">
                  <SectionBlockHeading
                    title="Legacy zgłoszenia i zapisy"
                    description="To starszy tor obsługi oparty o zgłoszenia, pozostawiony dla wydarzeń poza nowym rosterem grupowym."
                  />
                  {participantOfficialRecords.map((record) => (
                    <ParticipantEnrollmentCard key={record.request.id} record={record} />
                  ))}
                </div>
              ) : null}
            </>
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
                  <CommunityEventCard key={record.request.id} event={record.event} />
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
                          Edytuj wydarzenie
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
                    <span>{event.enrolledCount}/{event.capacity} miejsc</span>
                    <span>Próg: {resolveMinimumParticipants(event)} osób</span>
                    <span>
                      {event.groupId ? "Publiczny intake" : "Aktywne zgłoszenia"}:{" "}
                      {activeRequestsCount}
                    </span>
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
    "requests" | "participants" | "edit"
  >("requests");
  const [requestIntentFilter, setRequestIntentFilter] = useState<EnrollmentIntentFilter>("all");
  const [publishingEvent, setPublishingEvent] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<EventManagementSettingsDraft>({
    status: "active" as TrainingEventStatus,
    capacity: "1",
    minimumParticipants: "1",
    confirmationLeadTimeDays: "5",
    title: "",
    location: "",
    eventImages: [] as TrainingEventImage[],
    useEventImageAsCover: false,
    enrollmentPhotoRequirement: "default" as "default" | "required" | "optional",
    tags: "",
    firstDayDate: "",
    scheduleDays: resizeScheduleDayDrafts(2, []),
  });
  const event = store.trainingEvents.find((item) => item.id === eventId);
  const eventGroup = event?.groupId
    ? (store.groups ?? []).find((item) => item.id === event.groupId) ?? null
    : null;
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
      enrollmentPhotoRequirement: sourceEvent.enrollmentPhotoRequirement ?? "default",
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

  const requests = store.enrollmentRequests.filter((item) => {
    if (item.eventId !== event.id) {
      return false;
    }

    if (!event.groupId) {
      return true;
    }

    return !item.eventParticipantId;
  });
  const groupEventParticipants = (store.eventParticipants ?? [])
    .filter((item) => item.eventId === event.id)
    .sort((left, right) => {
      const leftRank = GROUP_PRIORITY_ORDER[left.priority];
      const rightRank = GROUP_PRIORITY_ORDER[right.priority];
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.participantDisplayName.localeCompare(right.participantDisplayName, "pl");
    });
  const assignableGroupMembers =
    event.groupId && (isEventOrganizerOwner || currentUser.role === "admin")
      ? (store.groupMembers ?? [])
          .filter(
            (member) =>
              member.groupId === event.groupId &&
              member.membershipStatus === "active" &&
              !groupEventParticipants.some(
                (participant) => participant.participantProfileId === member.participantProfileId,
              ),
          )
          .sort((left, right) => {
            const leftRank = GROUP_PRIORITY_ORDER[left.priority];
            const rightRank = GROUP_PRIORITY_ORDER[right.priority];
            if (leftRank !== rightRank) {
              return leftRank - rightRank;
            }

            return left.participantDisplayName.localeCompare(right.participantDisplayName, "pl");
          })
      : [];
  const manageableEvents = sortEventsByDate(
    store.trainingEvents.filter((item) => {
      if (item.id === event.id) {
        return false;
      }

      return canManageTrainingEvent(item, currentUser);
    }),
  );
  const pendingRequestsCount = requests.filter(
    (item) => item.finalStatus === "pending" || item.finalStatus === "partial",
  ).length;
  const communityParticipantRequests = requests.filter(
    (item) => item.finalStatus === "accepted" || item.finalStatus === "partial",
  );
  const filteredRequestSections = splitEnrollmentRequestsByIntent(
    requests.filter((request) => matchesEnrollmentIntentFilter(request, requestIntentFilter)),
  );

  if (isCommunityEvent) {
    const communityEditorValues = getCommunityEventEditorValuesFromManagementDraft(
      settingsDraft,
      event,
    );

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
          participantCountLabel={`${event.enrolledCount}/${event.capacity}`}
        />

        {communityDetailTab === "edit" ? (
          <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <CommunityEventEditorFields
              values={communityEditorValues}
              disabled={!canManageEvent || eventIsArchived}
              uploadingImages={uploadingSettingsImages}
              onChange={(updater) =>
                updateSettingsDraft((previous) =>
                  applyCommunityEventEditorValuesToManagementDraft(
                    previous,
                    updater(getCommunityEventEditorValuesFromManagementDraft(previous, event)),
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
            />

            {canManageEvent && !eventIsArchived ? (
              <>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={savingSettings}
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
                          settingsDraft.title,
                          settingsDraft.location,
                          communityEditorValues.summary,
                          communityEditorValues.description,
                          parseEventTags(settingsDraft.tags),
                          settingsDraft.eventImages,
                          settingsDraft.useEventImageAsCover,
                          buildScheduleDaysFromDrafts(
                            settingsDraft.firstDayDate,
                            settingsDraft.scheduleDays,
                          ),
                          undefined,
                          settingsDraft.enrollmentPhotoRequirement,
                        );
                        toast.success("Zapisano ustawienia wydarzenia.");
                        setIsSettingsDirty(false);
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zapisać ustawień wydarzenia.",
                        );
                      } finally {
                        setSavingSettings(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {savingSettings ? "Zapisywanie..." : "Zapisz ustawienia"}
                  </button>
                </div>
                <p className="mt-3 text-sm text-brand-muted">
                  Po osiągnięciu minimalnego progu status zmieni się automatycznie na potwierdzone.
                </p>
              </>
            ) : (
              <p className="mt-4 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm font-semibold text-brand-navy">
                Moderator widzi ten formularz poglądowo. Edycja danych wydarzenia pozostaje po
                stronie twórcy albo admina.
              </p>
            )}
          </article>
        ) : null}

        {communityDetailTab === "participants" ? (
          <article className="space-y-4 rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <SectionBlockHeading
              title="Uczestnicy wydarzenia"
              description="Lista osób, które mają już potwierdzony udział albo są częściowo przetworzone w tym wydarzeniu."
            />
            {communityParticipantRequests.length === 0 ? (
              <EmptyPanelState
                title="Brak potwierdzonych uczestników"
                description="Zaakceptowane osoby pojawią się tutaj automatycznie."
              />
            ) : (
              <div className="space-y-3">
                {communityParticipantRequests.map((request) => (
                  <article
                    key={`participant-${request.id}`}
                    className="rounded-[2rem] border border-brand-line bg-brand-shell/60 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold text-brand-navy">
                          {request.imieNazwisko}
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-brand-muted">
                          <span className="inline-flex items-center gap-2">
                            <Phone size={14} />
                            {request.telefon}
                          </span>
                          <span>Status: {request.finalStatus}</span>
                          <span>
                            SMS:{" "}
                            {resolveAttendanceConfirmationStatusLabel(
                              request.attendanceConfirmationStatus,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 rounded-3xl bg-white p-4 text-brand-muted">
                      {request.wiadomosc || "Brak dodatkowej wiadomości."}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </article>
        ) : null}

        {communityDetailTab === "requests" ? (
          <div className="space-y-4">
            <SectionBlockHeading
              title="Zgłoszenia do wydarzenia"
              description="Tutaj widzisz wszystkie prośby o dołączenie, a licznik na zakładce pokazuje te, które nie zostały jeszcze przeprocesowane."
            />
            {requests.length > 0 ? (
              <EnrollmentIntentFilterSwitch
                requests={requests}
                value={requestIntentFilter}
                onChange={setRequestIntentFilter}
              />
            ) : null}
            {requests.length === 0 ? (
              <EmptyPanelState
                title="Brak zgłoszeń"
                description="Gdy pojawią się nowe prośby o dołączenie, zobaczysz je tutaj."
              />
            ) : filteredRequestSections.length === 0 ? (
              <EmptyPanelState
                title="Brak zgłoszeń w tym widoku"
                description="Zmień filtr, żeby zobaczyć pozostałe osoby."
              />
            ) : (
              filteredRequestSections.map((section) => (
                <div key={section.key} className="space-y-4">
                  <SectionBlockHeading
                    title={section.title}
                    description={
                      section.key === "contact"
                        ? "Osoby, które czekają na odpowiedź i rozmowę z organizatorem."
                        : "Osoby deklarujące gotowość udziału, ale nadal oczekujące na decyzję."
                    }
                  />
                  {section.requests.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-2xl font-semibold text-brand-navy">
                            {request.imieNazwisko}
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm text-brand-muted">
                            <span className="inline-flex items-center gap-2">
                              <Phone size={14} />
                              {request.telefon}
                            </span>
                            <span>{request.polecenieOdKogo || "Bez polecenia"}</span>
                            <span>{formatDate(request.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={getEnrollmentIntentBadgeClass(request.intent)}>
                            {getEnrollmentIntentLabel(request.intent)}
                          </span>
                          <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                            {request.finalStatus}
                          </span>
                          <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                            SMS:{" "}
                            {resolveAttendanceConfirmationStatusLabel(
                              request.attendanceConfirmationStatus,
                            )}
                          </span>
                        </div>
                      </div>

                      <p className="mt-4 rounded-3xl bg-brand-shell p-4 text-brand-muted">
                        {request.wiadomosc || "Brak dodatkowej wiadomości."}
                      </p>

                      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                        <EnrollmentPhotoCard request={request} />
                        <div className="rounded-3xl border border-brand-line bg-brand-shell p-4">
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
                            Stan zgłoszenia
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                              trener: {request.trainerDecision}
                            </span>
                            {request.requiresOrganizerApproval !== false ? (
                              <span className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                                organizator: {request.organizerDecision}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {canManageEvent && !eventIsArchived ? (
                        <div className="mt-5 flex flex-wrap gap-3">
                          {(["accepted", "pending", "rejected"] as const).map((decision) => (
                            <button
                              key={decision}
                              type="button"
                              disabled={updatingRequestId === request.id}
                              onClick={async () => {
                                setUpdatingRequestId(request.id);

                                try {
                                  await manageEnrollmentRequest(request.id, decision);
                                  toast.success("Zmieniono status osoby w wydarzeniu.");
                                } catch (error) {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Nie udało się zmienić statusu osoby.",
                                  );
                                } finally {
                                  setUpdatingRequestId(null);
                                }
                              }}
                              className={
                                decision === "accepted"
                                  ? "inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                                  : decision === "rejected"
                                    ? "inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                                    : "inline-flex items-center gap-2 rounded-full bg-brand-shell px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                              }
                            >
                              {decision === "accepted"
                                ? "Zaakceptuj"
                                : decision === "rejected"
                                  ? "Odrzuć"
                                  : "Ustaw oczekuje"}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ))
            )}
          </div>
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
            <span>Minimalny prog: {resolveMinimumParticipants(event)}</span>
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
              description="To jest administracyjny skład wydarzenia oparty o grupę i priorytety członków, niezależny od publicznych zgłoszeń."
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

          {groupEventParticipants.length === 0 ? (
            <EmptyPanelState
              title="Roster jest pusty"
              description="Po akceptacji draftu pojawią się tu auto-przypisani stali uczestnicy, a organizator może dopisać kolejne osoby ręcznie."
            />
          ) : (
            <div className="space-y-3">
              {groupEventParticipants.map((participant) => (
                <article
                  key={participant.id}
                  className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-brand-navy">
                        {participant.participantDisplayName}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                        <Phone size={14} />
                        <span>{participant.participantPhone}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-sky/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-sky-deep">
                          {getGroupPriorityLabel(participant.priority)}
                        </span>
                        <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                          {participant.status}
                        </span>
                        <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                          SMS:{" "}
                          {resolveAttendanceConfirmationStatusLabel(
                            participant.attendanceConfirmationStatus,
                          )}
                        </span>
                        {participant.overCapacity ? (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">
                            ponad limit
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {(isEventOrganizerOwner || currentUser.role === "admin") && !eventIsArchived ? (
                      <div className="flex flex-wrap gap-2">
                        {(["invited", "confirmed", "declined", "removed"] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={participant.status === status || updatingEventParticipantId === participant.id}
                            onClick={async () => {
                              setUpdatingEventParticipantId(participant.id);

                              try {
                                await updateEventParticipantStatus({
                                  eventParticipantId: participant.id,
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
                            }}
                            className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {canManageEvent && !eventIsArchived && <div className="space-y-4">
        <SectionBlockHeading
          title={event.groupId ? "Publiczny intake i zgłoszenia" : "Uczestnicy i zgłoszenia"}
          description={
            event.groupId
              ? "Tutaj zostają tylko nowe lub jeszcze niezsynchronizowane zgłoszenia z formularza publicznego. Skład zaakceptowanych osób jest prowadzony wyżej na rosterze grupowym."
              : "Tutaj widzisz pełną listę osób, zmieniasz ich status i przenosisz zgłoszenia na inne terminy."
          }
        />
        {requests.length > 0 && (
          <EnrollmentIntentFilterSwitch
            requests={requests}
            value={requestIntentFilter}
            onChange={setRequestIntentFilter}
          />
        )}
        {requests.length === 0 && (
          <EmptyPanelState
            title={event.groupId ? "Brak nowych zgłoszeń" : "Brak osob na liscie"}
            description={
              event.groupId
                ? "Zaakceptowane osoby zostały już przeniesione na roster grupowy. Tutaj pojawią się tylko nowe zgłoszenia z formularza."
                : "Gdy pojawia sie nowe prosby o dolaczenie, zobaczysz je tutaj."
            }
          />
        )}
        {requests.length > 0 && filteredRequestSections.length === 0 && (
          <EmptyPanelState
            title="Brak zgłoszeń w tym widoku"
            description="Zmień filtr, żeby zobaczyć pozostałe osoby."
          />
        )}

        {filteredRequestSections.map((section) => (
          <div key={section.key} className="space-y-4">
            <SectionBlockHeading
              title={section.title}
              description={
                section.key === "contact"
                  ? "Osoby, które chcą najpierw porozmawiać z organizatorem albo trenerem."
                  : "Osoby deklarujące chęć udziału, ale nadal oczekujące na decyzję."
              }
            />
            {section.requests.map((request) => {
          const transferTargetEventId = transferSelections[request.id] ?? "";

          return (
            <article
              key={request.id}
              className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold text-brand-navy">
                    {request.imieNazwisko}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-brand-muted">
                    <span className="inline-flex items-center gap-2">
                      <Phone size={14} />
                      {request.telefon}
                    </span>
                    <span>{request.polecenieOdKogo || "Bez polecenia"}</span>
                    <span>{formatDate(request.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={getEnrollmentIntentBadgeClass(request.intent)}>
                    {getEnrollmentIntentLabel(request.intent)}
                  </span>
                  <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    {request.finalStatus}
                  </span>
                  <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                    SMS:{" "}
                    {resolveAttendanceConfirmationStatusLabel(
                      request.attendanceConfirmationStatus,
                    )}
                  </span>
                  <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                    trener: {request.trainerDecision}
                  </span>
                  {request.requiresOrganizerApproval !== false && (
                    <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                      organizator: {request.organizerDecision}
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-4 rounded-3xl bg-brand-shell p-4 text-brand-muted">
                {request.wiadomosc || "Brak dodatkowej wiadomości."}
              </p>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <EnrollmentPhotoCard request={request} />
                <div className="rounded-3xl border border-brand-line bg-brand-shell p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
                    Przenies na inny termin
                  </p>
                  <select
                    value={transferTargetEventId}
                    onChange={(changeEvent) =>
                      setTransferSelections((previous) => ({
                        ...previous,
                        [request.id]: changeEvent.target.value,
                      }))
                    }
                    className="mt-3 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
                  >
                    <option value="">Wybierz termin</option>
                    {manageableEvents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.location} | {formatDate(item.startsAt)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!transferTargetEventId || movingRequestId === request.id}
                    onClick={async () => {
                      setMovingRequestId(request.id);

                      try {
                        const moveDecision =
                          request.finalStatus === "accepted"
                            ? "accepted"
                            : request.finalStatus === "rejected"
                              ? "rejected"
                              : "pending";

                        await manageEnrollmentRequest(
                          request.id,
                          moveDecision,
                          transferTargetEventId,
                        );
                        setTransferSelections((previous) => ({
                          ...previous,
                          [request.id]: "",
                        }));
                        toast.success("Przeniesiono osobe na inny termin.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się przenieść osoby.",
                        );
                      } finally {
                        setMovingRequestId(null);
                      }
                    }}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                  >
                    {movingRequestId === request.id ? "Przenoszenie..." : "Przenies osobe"}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {(["accepted", "pending", "rejected"] as const).map((decision) => (
                  <button
                    key={decision}
                    type="button"
                    disabled={updatingRequestId === request.id}
                    onClick={async () => {
                      setUpdatingRequestId(request.id);

                      try {
                        await manageEnrollmentRequest(request.id, decision);
                        toast.success("Zmieniono status osoby w szkoleniu.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zmienić statusu osoby.",
                        );
                      } finally {
                        setUpdatingRequestId(null);
                      }
                    }}
                    className={
                      decision === "accepted"
                        ? "inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        : decision === "rejected"
                          ? "inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                          : "inline-flex items-center gap-2 rounded-full bg-brand-shell px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                    }
                  >
                    {decision === "accepted"
                      ? "Zaakceptuj"
                      : decision === "rejected"
                        ? "Odrzuc"
                        : "Ustaw oczekuje"}
                  </button>
                ))}
              </div>
            </article>
          );
            })}
          </div>
        ))}
      </div>}
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

export function ProfileSettingsPage() {
  const {
    currentUser,
    store,
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
  const [participantForm, setParticipantForm] = useState({
    displayName: "",
    referralSource: "",
    notes: "",
  });
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
    if (!organizerProfile) {
      return;
    }

    setOrganizerForm({
      displayName: organizerProfile.displayName ?? "",
      contactName: organizerProfile.contactName ?? "",
      location: organizerProfile.location ?? "",
      description: organizerProfile.description ?? "",
    });
  }, [organizerProfile?.id]);

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

      if (trainerProfile) {
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
          avatarFile: participantAvatarDraft.file,
          avatarCrop,
        });
      }

      toast.success(trainerProfile ? "Profil został zapisany." : "Profil uczestnika został zapisany.");
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
      setTrainerForm((previous) => ({
        ...previous,
        authorizationCode: "",
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zapisać profilu.",
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

          {trainerProfile ? (
            <div className="mt-2 rounded-[1.75rem] border border-brand-line bg-brand-shell/40 p-4 sm:rounded-[2rem] sm:p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                  Przekazujący Wiedzę
                </p>
                <h4 className="mt-2 text-lg font-semibold text-brand-navy sm:text-xl">
                  Dodatkowe ustawienia profilu trenera
                </h4>
                <p className="mt-2 text-sm text-brand-muted">
                  Te pola rozszerzają Twój bazowy profil i sterują kartą publiczną, filtrowaniem
                  szkoleń oraz kodem do łączenia organizatorów.
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
                    className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none"
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
                    className="w-full min-w-0 max-w-full rounded-3xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none"
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
                    className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none"
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
                    className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none"
                  />
                  <span className="text-sm text-brand-muted">Oddziel lokalizacje przecinkami.</span>
                </label>

                <label className="grid min-w-0 gap-2">
                  <span className="text-sm font-semibold text-brand-navy">
                    Kod autoryzacyjny trenera
                  </span>
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
                    className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none"
                  />
                  <span className="text-sm text-brand-muted">
                    {trainerProfile.authorizationCodeConfigured
                      ? "Aktualny kod jest ukryty. Wpisz nowy tylko wtedy, gdy chcesz go zmienić."
                      : "Bez ustawionego kodu nowe konta i nowe relacje organizatorów nie zostaną aktywowane."}
                  </span>
                </label>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
          >
            {saving ? "Zapisywanie..." : trainerProfile ? "Zapisz profil" : "Zapisz profil uczestnika"}
          </button>
        </div>
      </div>
    </form>
  );

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

  async function handleOrganizerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await updateOrganizerProfile(organizerForm);
      toast.success("Profil organizatora został zapisany.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zapisać profilu.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelSection
      eyebrow="Ustawienia"
      title="Ustawienia"
      description="To jedno miejsce zbiera profil, dostęp organizatora Emandar i rzadkie konfiguracje systemowe."
    >
      <div className="space-y-6">
        {participantProfileFormContent}

        <article className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
              Dostęp organizatora
            </p>
            <h3 className="mt-2 text-xl font-semibold text-brand-navy sm:text-2xl">
              Organizator Emandar i relacje
            </h3>
            <p className="mt-2 text-sm text-brand-muted">
              To rzadziej używana konfiguracja dostępu. Tutaj połączysz się z trenerem kodem,
              sprawdzisz aktywne relacje i zobaczysz, czy masz odblokowane funkcje organizatora.
            </p>
          </div>
          <RelationsHubContent />
        </article>

        {organizerProfile ? (
          <form
            onSubmit={handleOrganizerSubmit}
            className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:p-6"
          >
            <div className="mb-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                Organizator
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">
                Nazwa organizatora
              </span>
              <input
                required
                value={organizerForm.displayName}
                onChange={(event) =>
                  setOrganizerForm((previous) => ({
                    ...previous,
                    displayName: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Imię kontaktowe</span>
              <input
                required
                value={organizerForm.contactName}
                onChange={(event) =>
                  setOrganizerForm((previous) => ({
                    ...previous,
                    contactName: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>

            <label className="grid gap-2 xl:col-span-2">
              <span className="text-sm font-semibold text-brand-navy">Lokalizacja</span>
              <input
                required
                value={organizerForm.location}
                onChange={(event) =>
                  setOrganizerForm((previous) => ({
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
                value={organizerForm.description}
                onChange={(event) =>
                  setOrganizerForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {saving ? "Zapisywanie..." : "Zapisz profil organizatora"}
            </button>
          </form>
        ) : null}

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

export function AccountRequestsPage() {
  const { currentUser, store } = useAppState();

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <PanelSection
        eyebrow="Rejestracje"
        title="Historia rejestracji"
        description="Ten ekran jest dostępny tylko dla admina."
      >
        <EmptyPanelState
          title="Brak dostępu"
        description="Tylko admin może przeglądać i zatwierdzać rejestracje."
        />
      </PanelSection>
    );
  }

  return (
    <PanelSection
      eyebrow="Rejestracje"
      title="Historia rejestracji SMS"
      description="Publiczna rejestracja zapisuje tylko wniosek. Admin może go zaakceptować albo odrzucić bez nadawania roli w ciemno."
    >
      <div className="space-y-4">
        {store.accountRequests.length === 0 && (
          <EmptyPanelState
            title="Brak wnioskow"
            description="Nowe prosby o konto pojawia sie tutaj po wyslaniu formularza rejestracji."
          />
        )}

        {store.accountRequests.map((request) => (
          <article
            key={request.id}
            className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                  {getAccountRequestRoleLabel(request)}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-brand-navy">
                  {request.displayName}
                </h3>
                <div className="mt-3 space-y-1 text-sm text-brand-muted">
                  <p>{request.email}</p>
                  <p>{request.phone}</p>
                  <p>{formatDate(request.createdAt)}</p>
                </div>
              </div>
              <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                {request.status}
              </span>
            </div>

            <p className="mt-4 rounded-3xl bg-brand-shell p-4 text-brand-muted">
              {request.notes || "Brak dodatkowych informacji."}
            </p>

            {false && request.status === "pending" && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await decideAccountRequest(request.id, "approved");
                      toast.success("Wniosek został zaakceptowany.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się zmienić statusu wniosku.",
                      );
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
                >
                  <Check size={16} />
                  Akceptuj
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await decideAccountRequest(request.id, "rejected");
                      toast.success("Wniosek został odrzucony.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się zmienić statusu wniosku.",
                      );
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
                >
                  <X size={16} />
                  Odrzuc
                </button>
              </div>
            )}
          </article>
        ))}
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
          const userRoles = Array.from(new Set(["participant", ...(user.roles ?? [])])).sort(
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

