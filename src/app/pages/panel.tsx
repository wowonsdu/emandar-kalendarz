import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ImagePlus,
  Link2,
  Phone,
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
import { Link, useLocation, useParams } from "react-router";
import { toast } from "sonner";
import { useAppState } from "../providers/AppProviders";
import { resolveAttendanceConfirmationStatusLabel } from "@/domain/notifications";
import {
  aggregateEventCapacityStats,
  buildSharedAvailabilityWindows,
  canDecideTrainingEventCollaboration,
  canManageTrainingEvent,
  getEventCollaborationStatusLabel,
  getAvailablePlaces,
  getEventFillRate,
  getParticipantEnrollmentStatusLabel,
  getRoleLabel,
  getTrainingEventScheduleBounds,
  getTrainingEventScheduleDays,
  getTrainingEventStatusLabel,
  isParticipantEnrollmentActive,
  isTrainingEventCollaborationAccepted,
  isTrainingEventArchived,
  isSelfManagedTrainingEvent,
  isCommunityBrandStatus,
  resolveOrganizerCollaborationStatus,
  resolveMinimumParticipants,
  resolveTrainerCollaborationStatus,
  resolveTrainingEventStatus,
  sortEventsByDate,
  sortEventsByFillRate,
  sortTrainerProfiles,
} from "@/domain/utils";
import type {
  EmandarBrandStatus,
  EnrollmentFinalStatus,
  EnrollmentRequest,
  OrganizerProfile,
  TrainerProfile,
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

function getAvailabilityHorizonEnd() {
  const end = new Date();
  end.setUTCMinutes(0, 0, 0);
  end.setUTCFullYear(end.getUTCFullYear() + 3);
  return end.toISOString();
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
    trainerName: trainer?.displayName ?? "Przekazujący Wiedzę",
    organizerName: isSelfManagedTrainingEvent(event)
      ? trainer?.displayName ?? "Przekazujący Wiedzę"
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

function isEventFinished(event: TrainingEvent) {
  return new Date(event.endsAt).getTime() < Date.now();
}

function isParticipantEnrollmentArchived(
  request: EnrollmentRequest,
  event: TrainingEvent,
) {
  return !isParticipantEnrollmentActive(request) || isTrainingEventArchived(event) || isEventFinished(event);
}

function getParticipantEnrollmentRecords(
  store: ReturnType<typeof useAppState>["store"],
): ParticipantEnrollmentRecord[] {
  return [...store.enrollmentRequests]
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
      <p className="mt-2 text-lg font-semibold text-brand-navy">
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
          <h3 className="mt-2 text-2xl font-semibold text-brand-navy">
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
            title="Przekazujący Wiedzę"
            name={record.trainer?.displayName}
            contact={
              record.request.trainerContactPhone || record.request.trainerContactEmail
            }
            fallback="Profil trenera"
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
          <div className="flex flex-wrap gap-3">
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
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
            >
              <Trash2 size={16} />
              Zrezygnuj
            </button>

            {transferOptions.length > 0 && (
              <>
                <select
                  value={transferTargetEventId}
                  onChange={(event) => setTransferTargetEventId(event.target.value)}
                  className="rounded-full border border-brand-line bg-white px-4 py-3 text-sm text-brand-navy outline-none"
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
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <RefreshCcw size={16} />
                  Przenieś na inne szkolenie
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function getDashboardChartHeight(itemCount: number) {
  return Math.max(240, itemCount * 56);
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

function isCommunityTrainerProfile(status: EmandarBrandStatus | undefined) {
  return isCommunityBrandStatus(status);
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

function CollaborationActionBar({
  onDecision,
  pending,
}: {
  onDecision: (status: "accepted" | "rejected") => Promise<void>;
  pending: boolean;
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
        Akceptuj wspolprace
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => void onDecision("rejected")}
        className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
      >
        <X size={16} />
        Odrzuc wspolprace
      </button>
    </div>
  );
}

function PanelSection({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-4xl font-semibold text-brand-navy">{title}</h2>
          <p className="mt-3 max-w-3xl text-lg text-brand-muted">{description}</p>
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
    <article className="rounded-[2rem] border border-brand-line bg-white p-5 shadow-soft">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-sky/15 text-brand-navy">
        <Icon size={20} />
      </div>
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
        {label}
      </p>
      <p className="mt-2 text-4xl font-semibold text-brand-navy">{value}</p>
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
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-2xl font-semibold text-brand-navy">{title}</h3>
      <p className="mt-2 text-sm text-brand-muted">{description}</p>
    </div>
  );
}

function EventScopeSwitch({
  activeScope,
  mineLabel,
  onChange,
}: {
  activeScope: "all" | "mine";
  mineLabel: string;
  onChange: (scope: "all" | "mine") => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-brand-line bg-white p-1 shadow-soft">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          activeScope === "all"
            ? "bg-brand-navy text-white"
            : "text-brand-muted hover:text-brand-navy"
        }`}
      >
        Wszystkie wydarzenia
      </button>
      <button
        type="button"
        onClick={() => onChange("mine")}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          activeScope === "mine"
            ? "bg-brand-navy text-white"
            : "text-brand-muted hover:text-brand-navy"
        }`}
      >
        {mineLabel}
      </button>
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
    <article className="rounded-[2rem] border border-brand-line bg-white p-5 shadow-soft">
      <div className="min-h-[88px]">
        <SectionBlockHeading title={title} description={description} />
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function DashboardChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-[1.5rem] border border-dashed border-brand-line bg-brand-shell px-5 text-center text-sm text-brand-muted">
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

  if (currentUser.role === "participant") {
    const participantRecords = getParticipantEnrollmentRecords(store);
    const activeRecords = participantRecords.filter((record) => !record.isArchived);
    const archivedRecords = participantRecords.filter((record) => record.isArchived);
    const nextRecord = activeRecords[0];
    const needsAttentionCount = activeRecords.filter(
      (record) => record.request.finalStatus === "pending" || record.request.finalStatus === "partial",
    ).length;
    const ownAccountApprovals = store.trainerAccountApprovals.filter(
      (approval) => approval.requesterUserId === currentUser.id,
    );
    const shouldShowApprovalStatus =
      currentUser.accountApprovalStatus === "pending" ||
      currentUser.accountApprovalStatus === "rejected" ||
      ownAccountApprovals.length > 0;

    return (
      <PanelSection
        eyebrow={getRoleLabel(currentUser.role)}
        title="Twoje szkolenia i najbliższe wydarzenia"
        description="Tutaj widzisz wszystkie swoje zapisy, kontakt do zespołu prowadzącego oraz szybki skrót do archiwum uczestnictwa."
      >
        {shouldShowApprovalStatus && (
          <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <SectionBlockHeading
              title="Status konta"
              description="Dopóki trener nie zatwierdzi Twojego konta, działasz w trybie uczestnika i widzisz tylko własne szkolenia."
            />
            <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-3xl bg-brand-shell p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
                  Główny status
                </p>
                <p className="mt-3 text-2xl font-semibold text-brand-navy">
                  {currentUser.accountApprovalStatus === "rejected"
                    ? "Wymaga nowej akceptacji"
                    : currentUser.accountApprovalStatus === "approved"
                      ? "Konto potwierdzone"
                      : "Czeka na akceptację trenera"}
                </p>
                <p className="mt-3 text-sm text-brand-muted">
                  Zakres do odblokowania:{" "}
                  {getAccountRequestRoleLabel({
                    requestedRoles: [
                      "participant",
                      ...(currentUser.pendingRoles ?? []),
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
          <StatCard label="Aktywne zapisy" value={activeRecords.length} icon={CalendarDays} />
          <StatCard label="Wymagają uwagi" value={needsAttentionCount} icon={Bell} />
          <StatCard label="Archiwum" value={archivedRecords.length} icon={RefreshCcw} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
            <SectionBlockHeading
              title="Najbliższe szkolenie"
              description="Pierwszy aktywny zapis z kalendarza uczestnika."
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
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ParticipantContactBlock
                    title="Przekazujący Wiedzę"
                    name={nextRecord.trainer?.displayName}
                    contact={
                      nextRecord.request.trainerContactPhone ||
                      nextRecord.request.trainerContactEmail
                    }
                    fallback="Profil trenera"
                  />
                  <ParticipantContactBlock
                    title="Organizator"
                    name={
                      nextRecord.request.organizerContactName || nextRecord.organizer?.displayName
                    }
                    contact={
                      nextRecord.request.organizerContactPhone ||
                      nextRecord.request.organizerContactEmail
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
              description="Pełna lista Twoich aktywnych zapisów w kolejności dat."
            />
            <div className="mt-5 space-y-4">
              {activeRecords.slice(0, 5).map((record) => (
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
              {activeRecords.length === 0 && (
                <p className="rounded-3xl bg-brand-shell p-4 text-brand-muted">
                  Nie masz teraz żadnych aktywnych szkoleń.
                </p>
              )}
            </div>
          </article>
        </div>
      </PanelSection>
    );
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const relevantEvents =
    currentUser.role === "trainer"
      ? store.trainingEvents.filter(
          (item) => item.trainerId === trainerProfile?.id && !isTrainingEventArchived(item),
        )
      : currentUser.role === "organizer"
        ? store.trainingEvents.filter(
            (item) => item.organizerId === organizerProfile?.id && !isTrainingEventArchived(item),
          )
        : store.trainingEvents.filter((item) => !isTrainingEventArchived(item));
  const relevantRequests =
    currentUser.role === "trainer"
      ? store.enrollmentRequests.filter((item) => item.trainerId === trainerProfile?.id)
      : currentUser.role === "organizer"
        ? store.enrollmentRequests.filter(
            (item) => item.organizerId === organizerProfile?.id,
          )
        : store.enrollmentRequests;
  const communityEvents = useMemo(
    () =>
      currentUser.role === "trainer" && trainerProfile
        ? relevantEvents.filter(
            (item) =>
              item.trainerId === trainerProfile.id &&
              isCommunityBrandStatus(item.brandStatus),
          )
        : [],
    [currentUser.role, relevantEvents, trainerProfile],
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
    if (!dashboardWindow || (currentUser.role !== "trainer" && currentUser.role !== "organizer")) {
      return [];
    }

    const windowStart = new Date();
    return relevantEvents.filter((event) => isDateWithinRange(event.startsAt, windowStart, dashboardWindow.end));
  }, [currentUser.role, dashboardWindow, relevantEvents]);
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
    if (currentUser.role !== "trainer") {
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
  }, [analyticsActiveEvents, currentUser.role, store.organizers]);
  const analyticsRequestsInRange = useMemo(() => {
    if (!dashboardWindow || (currentUser.role !== "trainer" && currentUser.role !== "organizer")) {
      return [];
    }

    const rangeStart = dashboardMonthBuckets[0]?.start ?? new Date();
    return relevantRequests.filter((request) =>
      isDateWithinRange(request.createdAt, rangeStart, dashboardWindow.end),
    );
  }, [currentUser.role, dashboardMonthBuckets, dashboardWindow, relevantRequests]);
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
  const shouldShowRoleAnalytics =
    currentUser.role === "trainer" || currentUser.role === "organizer";

  return (
    <PanelSection
      eyebrow={getRoleLabel(currentUser.role)}
      title="Pulpit pracy"
      description="Panel jest już oparty o Firebase Auth, Firestore i Storage. Wszystkie liczby i rekordy pochodzą z bieżącej bazy projektu."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Szkolenia" value={relevantEvents.length} icon={CalendarDays} />
        <StatCard label="Zgłoszenia" value={relevantRequests.length} icon={Bell} />
        <StatCard label="Powiadomienia" value={notificationsCount} icon={ShieldCheck} />
        <StatCard
          label="Relacje"
          value={
            currentUser.role === "admin"
              ? store.relations.length
              : currentUser.role === "trainer"
                ? store.relations.filter((item) => item.trainerId === trainerProfile?.id).length
                : store.relations.filter((item) => item.organizerId === organizerProfile?.id).length
          }
          icon={Users}
        />
      </div>

      {shouldShowRoleAnalytics && (
        <>
          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                Oblozenie na najblizsze miesiace
              </p>
              <p className="mt-2 text-2xl font-semibold text-brand-navy">
                Nadchodzace szkolenia i ile osob jeszcze brakuje
              </p>
            </div>
            <div
              className={`grid gap-4 xl:grid-cols-2 ${
                currentUser.role === "trainer" ? "2xl:grid-cols-4" : "2xl:grid-cols-3"
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
                <div className="h-[280px]">
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

              {currentUser.role === "trainer" && (
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
              <p className="mt-2 text-2xl font-semibold text-brand-navy">
                Jak splywaja zgloszenia i czym koncza sie terminy
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <DashboardChartCard
                title="Zgloszenia w miesiacach"
                description="Nowe prosby o dolaczenie policzone po miesiacu utworzenia zgloszenia."
              >
                {analyticsRequestsInRange.length === 0 ? (
                  <DashboardChartEmptyState message="Brak zgloszen w biezacym oknie 3 miesiecy." />
                ) : (
                  <div className="h-[280px]">
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
                title="Statusy decyzji w miesiacach"
                description="Widac, ile zgloszen nadal czeka, a ile jest juz rozstrzygnietych."
              >
                {analyticsRequestsInRange.length === 0 ? (
                  <DashboardChartEmptyState message="Brak zgloszen do pokazania w tym okresie." />
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
                    <div className="h-[280px]">
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
                <div className="h-[280px]">
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <h3 className="text-2xl font-semibold text-brand-navy">Najbliższe szkolenia</h3>
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

        <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
          <h3 className="text-2xl font-semibold text-brand-navy">Ostatnie powiadomienia</h3>
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

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
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
    if (currentUser.role === "trainer") {
      return request.trainerId === trainerProfile?.id;
    }

    if (currentUser.role === "organizer") {
      return request.organizerId === organizerProfile?.id;
    }

    return true;
  });

  return (
    <PanelSection
      eyebrow="Zgłoszenia"
      title="Nowe osoby dołączające do szkoleń"
      description="Każde zgłoszenie trafia do panelu Przekazującego Wiedzę i organizatora. Status końcowy przechodzi na przyjęte dopiero po dwóch akceptacjach."
    >
      <div className="space-y-4">
        {requests.length === 0 && (
          <EmptyPanelState
            title="Brak zgłoszeń"
            description="Nowe zgłoszenia do Twoich wydarzeń pojawią się tutaj."
          />
        )}
        {requests.map((request) => {
          const event = store.trainingEvents.find((item) => item.id === request.eventId);
          if (!event) {
            return null;
          }

          const canTrainerDecide =
            currentUser.role === "trainer" && request.trainerDecision === "pending";
          const canOrganizerDecide =
            currentUser.role === "organizer" &&
            (request.requiresOrganizerApproval ?? true) &&
            request.organizerDecision === "pending";

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
                <span className="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  {request.finalStatus}
                </span>
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

              {(canTrainerDecide || canOrganizerDecide) && (
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

export function RelationsPage() {
  const {
    currentUser,
    decideRelation,
    requestRelation,
    store,
  } = useAppState();
  const [selectedTrainer, setSelectedTrainer] = useState(
    store.trainers[0]?.id ?? "",
  );

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);

  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const relations = store.relations.filter((relation) => {
    if (currentUser.role === "trainer") {
      return relation.trainerId === trainerProfile?.id;
    }
    if (currentUser.role === "organizer") {
      return relation.organizerId === organizerProfile?.id;
    }
    return true;
  });

  return (
    <PanelSection
      eyebrow="Relacje"
      title="Współpraca Przekazujących Wiedzę z organizatorami"
      description="Organizator prosi o dostęp do terminów Przekazującego Wiedzę, a Przekazujący Wiedzę akceptuje lub odrzuca relację. Po akceptacji organizator widzi prywatne sloty."
    >
      {currentUser.role === "organizer" && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await requestRelation(selectedTrainer);
              toast.success("Wysłano prośbę o nową relację.");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Nie udało się utworzyć relacji.",
              );
            }
          }}
          className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <label className="grid flex-1 gap-2">
              <span className="text-sm font-semibold text-brand-navy">
                Poproś o relację z Przekazującym Wiedzę
              </span>
              <select
                value={selectedTrainer}
                onChange={(event) => setSelectedTrainer(event.target.value)}
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              >
                {store.trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
            >
              <Users size={16} />
              Wyślij prośbę
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {relations.length === 0 && (
          <EmptyPanelState
            title="Brak relacji"
            description="Aktywne i oczekujące relacje Przekazujący Wiedzę-organizator pojawią się tutaj."
          />
        )}
        {relations.map((relation) => {
          const trainer = store.trainers.find((item) => item.id === relation.trainerId);
          const organizer = store.organizers.find(
            (item) => item.id === relation.organizerId,
          );
          const canDecide =
            relation.status === "pending" &&
            ((currentUser.role === "trainer" && trainer?.userId === currentUser.id) ||
              currentUser.role === "admin");

          return (
            <article
              key={relation.id}
              className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-brand-navy">
                    {trainer?.displayName} ↔ {organizer?.displayName}
                  </p>
                  <p className="mt-2 text-brand-muted">
                    Prośba od: {relation.requestedBy} • utworzona{" "}
                    {formatDate(relation.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy">
                  {relation.status}
                </span>
              </div>

              {canDecide && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await decideRelation(relation.id, "approved");
                        toast.success("Relacja została zaakceptowana.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zmienić relacji.",
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
                        await decideRelation(relation.id, "rejected");
                        toast.success("Relacja została odrzucona.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zmienić relacji.",
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

              {relation.status === "approved" &&
                (currentUser.role === "organizer" || currentUser.role === "admin") && (
                  <DetachRelationControls
                    relationId={relation.id}
                    allowArchiveOption={false}
                  />
                )}
            </article>
          );
        })}
      </div>
    </PanelSection>
  );
}

export function AvailabilityPage() {
  const {
    addAvailabilitySlot,
    addTrainerCalendarFeed,
    currentUser,
    removeTrainerCalendarFeed,
    store,
    syncOwnTrainerCalendarFeeds,
    updateTrainerCalendarFeedEnabled,
  } = useAppState();
  const [form, setForm] = useState({
    trainerId: store.trainers[0]?.id ?? "",
    startsAt: "2026-05-05T17:00",
    endsAt: "2026-05-05T20:00",
    location: "Warszawa / online",
    notes: "Nowy termin",
  });
  const [feedForm, setFeedForm] = useState({
    provider: "google" as TrainerCalendarFeedProvider,
    url: "",
  });
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>([]);
  const [minimumDurationHours, setMinimumDurationHours] = useState(1);
  const [showOnlyFullMatch, setShowOnlyFullMatch] = useState(false);
  const [syncingFeeds, setSyncingFeeds] = useState(false);

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);

  if (currentUser.role === "trainer" && isCommunityTrainer) {
    return <Navigate to="/panel/szkolenia" replace />;
  }

  const slots =
    currentUser.role === "organizer" && organizerProfile
      ? store.availabilitySlots.filter((slot) =>
          slot.visibleToOrganizerIds?.includes(organizerProfile.id),
        )
      : currentUser.role === "trainer"
        ? store.availabilitySlots.filter((slot) => slot.trainerId === trainerProfile?.id)
        : store.availabilitySlots;
  const officialTrainers = useMemo(
    () =>
      sortTrainerProfiles(
        store.trainers.filter((trainer) => !isCommunityTrainerProfile(trainer.brandStatus)),
      ),
    [store.trainers],
  );
  const ownCalendarFeeds = useMemo(
    () =>
      (trainerProfile
        ? store.trainerCalendarFeeds.filter((feed) => feed.trainerId === trainerProfile.id)
        : []
      ).sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [store.trainerCalendarFeeds, trainerProfile],
  );

  useEffect(() => {
    if (!trainerProfile || currentUser.role !== "trainer" || isCommunityTrainer) {
      return;
    }

    setSelectedTrainerIds((previous) => {
      const preservedIds = previous.filter((trainerId) =>
        officialTrainers.some((trainer) => trainer.id === trainerId),
      );

      if (!preservedIds.includes(trainerProfile.id)) {
        preservedIds.unshift(trainerProfile.id);
      }

      return preservedIds.length > 0 ? preservedIds : [trainerProfile.id];
    });
  }, [currentUser.role, isCommunityTrainer, officialTrainers, trainerProfile]);

  useEffect(() => {
    if (!trainerProfile || currentUser.role !== "trainer" || isCommunityTrainer) {
      return;
    }

    void syncOwnTrainerCalendarFeeds().catch(() => {});
  }, [currentUser.role, isCommunityTrainer, syncOwnTrainerCalendarFeeds, trainerProfile?.id]);

  const selectedTrainerProfiles = useMemo(
    () => officialTrainers.filter((trainer) => selectedTrainerIds.includes(trainer.id)),
    [officialTrainers, selectedTrainerIds],
  );
  const eventBusyIntervalsByTrainer = useMemo(
    () =>
      selectedTrainerIds.reduce<Record<string, Array<{ startsAt: string; endsAt: string; source: "emandar" }>>>(
        (accumulator, trainerId) => {
          accumulator[trainerId] = store.trainingEvents
            .filter(
              (event) =>
                event.trainerId === trainerId &&
                !isTrainingEventArchived(event) &&
                resolveTrainingEventStatus(event.status) !== "cancelled",
            )
            .flatMap((event) =>
              getTrainingEventScheduleDays(event).map((day) => ({
                startsAt: day.startsAt,
                endsAt: day.endsAt,
                source: "emandar" as const,
              })),
            );

          return accumulator;
        },
        {},
      ),
    [selectedTrainerIds, store.trainingEvents],
  );
  const externalBusyIntervalsByTrainer = useMemo(
    () =>
      selectedTrainerIds.reduce<Record<string, typeof store.trainerExternalBusyMonths[number]["intervals"]>>(
        (accumulator, trainerId) => {
          accumulator[trainerId] = store.trainerExternalBusyMonths
            .filter((month) => month.trainerId === trainerId)
            .flatMap((month) => month.intervals);

          return accumulator;
        },
        {},
      ),
    [selectedTrainerIds, store.trainerExternalBusyMonths],
  );
  const trainerNamesById = useMemo(
    () =>
      Object.fromEntries(
        officialTrainers.map((trainer) => [trainer.id, trainer.displayName]),
      ) as Record<string, string>,
    [officialTrainers],
  );
  const sharedAvailabilityWindows = useMemo(() => {
    if (selectedTrainerIds.length === 0) {
      return [];
    }

    const rangeStart = new Date();
    rangeStart.setUTCMinutes(0, 0, 0);

    const computedWindows = buildSharedAvailabilityWindows({
      trainerIds: selectedTrainerIds,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: getAvailabilityHorizonEnd(),
      minimumDurationHours,
      busyIntervalsByTrainer: selectedTrainerIds.reduce<
        Record<string, Array<{ startsAt: string; endsAt: string; source: "emandar" | "ical"; sourceLabel?: string }>>
      >((accumulator, trainerId) => {
        accumulator[trainerId] = [
          ...(eventBusyIntervalsByTrainer[trainerId] ?? []),
          ...(externalBusyIntervalsByTrainer[trainerId] ?? []),
        ];

        return accumulator;
      }, {}),
    });

    return computedWindows
      .filter((window) => (showOnlyFullMatch ? window.isFullMatch : true))
      .slice(0, 80);
  }, [
    eventBusyIntervalsByTrainer,
    externalBusyIntervalsByTrainer,
    minimumDurationHours,
    selectedTrainerIds,
    showOnlyFullMatch,
  ]);

  async function handleSyncFeeds() {
    try {
      setSyncingFeeds(true);
      await syncOwnTrainerCalendarFeeds();
      toast.success("Feedy iCal zostaly zsynchronizowane.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udalo sie zsynchronizowac kalendarzy.",
      );
    } finally {
      setSyncingFeeds(false);
    }
  }

  return (
    <PanelSection
      eyebrow="Terminy"
      title={
        currentUser.role === "organizer"
        ? "Terminy zatwierdzonych Przekazujących Wiedzę"
          : "Dostępność i sloty pod nowe grupy"
      }
      description="Organizator widzi tylko sloty Przekazujących Wiedzę z zatwierdzoną relacją. Przekazujący Wiedzę i admin mogą dodawać nowe terminy."
    >
      {(currentUser.role === "trainer" || currentUser.role === "admin") && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await addAvailabilitySlot({
                ...form,
                trainerId: currentUser.role === "admin" ? form.trainerId : undefined,
                startsAt: new Date(form.startsAt).toISOString(),
                endsAt: new Date(form.endsAt).toISOString(),
              });
              toast.success("Dodano nowy termin.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Nie udało się dodać terminu.");
            }
          }}
          className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {currentUser.role === "admin" && (
              <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Przekazujący Wiedzę</span>
                <select
                  value={form.trainerId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trainerId: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                >
                  {store.trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Start</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startsAt: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Koniec</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endsAt: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Miejsce</span>
              <input
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
            <label className="grid gap-2 xl:col-span-2">
              <span className="text-sm font-semibold text-brand-navy">Notatka</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
          >
            <CalendarDays size={16} />
            Dodaj termin
          </button>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {slots.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyPanelState
              title="Brak terminów"
            description="Terminy Przekazujących Wiedzę widoczne dla tej roli pojawią się tutaj."
            />
          </div>
        )}
        {slots.map((slot) => {
          const trainer = store.trainers.find((item) => item.id === slot.trainerId);

          return (
            <article
              key={slot.id}
              className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
            >
              <h3 className="text-2xl font-semibold text-brand-navy">
                {trainer?.displayName}
              </h3>
              <div className="mt-4 space-y-2 text-brand-muted">
                <p>{formatDate(slot.startsAt)}</p>
                <p>
                  {formatShortTime(slot.startsAt)} - {formatShortTime(slot.endsAt)}
                </p>
                <p>{slot.location}</p>
                <p>{slot.notes}</p>
              </div>
            </article>
          );
        })}
      </div>
    </PanelSection>
  );
}

export function EventsPage() {
  const location = useLocation();
  const {
    createTrainingEvent,
    currentUser,
    decideTrainingEventCollaboration,
    store,
  } = useAppState();

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const isCreatorView = location.pathname.endsWith("/kreator-wydarzen");
  const isParticipant = currentUser.role === "participant";
  const isAdmin = currentUser.role === "admin";
  const [eventScope, setEventScope] = useState<"all" | "mine">("all");
  const participantRecords = useMemo(
    () => (isParticipant ? getParticipantEnrollmentRecords(store) : []),
    [isParticipant, store],
  );
  const activeParticipantRecords = useMemo(
    () => participantRecords.filter((record) => !record.isArchived),
    [participantRecords],
  );
  const archivedParticipantRecords = useMemo(
    () => participantRecords.filter((record) => record.isArchived),
    [participantRecords],
  );
  const publicEvents = useMemo(
    () => sortEventsByDate(store.publicTrainingEvents.filter((event) => event.isPublished)),
    [store.publicTrainingEvents],
  );
  const ownEvents = useMemo(
    () =>
      currentUser.role === "trainer"
        ? store.trainingEvents.filter((item) => item.trainerId === trainerProfile?.id)
        : currentUser.role === "organizer"
          ? store.trainingEvents.filter((item) => item.organizerId === organizerProfile?.id)
          : currentUser.role === "admin"
            ? store.trainingEvents
            : [],
    [
      currentUser.role,
      organizerProfile?.id,
      store.trainingEvents,
      trainerProfile?.id,
    ],
  );
  const showingAllEvents = !isAdmin && !isCreatorView && eventScope === "all";
  const listedEvents = useMemo(
    () => (showingAllEvents ? publicEvents : sortEventsByDate(ownEvents)),
    [ownEvents, publicEvents, showingAllEvents],
  );
  const mineLabel = isParticipant
    ? "Moje szkolenia"
    : isCommunityTrainer
      ? "Moje wydarzenia"
      : "Moje szkolenia";
  const sectionTitle = isCreatorView
    ? "Kreator wydarzeń"
    : showingAllEvents
      ? "Wszystkie wydarzenia"
      : isParticipant
        ? "Moje szkolenia"
        : currentUser.role === "trainer" || currentUser.role === "organizer"
          ? mineLabel
          : "Lista wydarzeń";
  const sectionDescription = isCreatorView
    ? "Tutaj dodajesz nowe wydarzenia bez mieszania tego z listą już utworzonych pozycji."
    : showingAllEvents
      ? "Przeglądaj pełny publiczny kalendarz opublikowanych wydarzeń i dopiero potem przełączaj się na własny widok operacyjny."
      : isParticipant
        ? "Zarządzaj swoimi zapisami, sprawdzaj kontakty do prowadzących i miej pod ręką archiwum wcześniejszych szkoleń."
        : "To jest warstwa operacyjna wydarzeń, które pochodzą bezpośrednio z Firestore.";

  const availableOrganizers = useMemo(
    () =>
      currentUser.role === "trainer" && !isCommunityTrainer
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
      currentUser.role,
      isCommunityTrainer,
      store.organizers,
      store.relations,
      trainerProfile?.id,
    ],
  );
  const availableTrainers = useMemo(
    () =>
      currentUser.role === "organizer" && organizerProfile
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
    [currentUser.role, organizerProfile, store.relations, store.trainers],
  );
  const [trainerEventForm, setTrainerEventForm] = useState({
    trainerId: "",
    organizerId: "",
    selfManagedByTrainer: false,
    summary: "",
    description: "",
    tags: "",
    type: "Warsztat stacjonarny",
    status: "active" as TrainingEventStatus,
    firstDayDate: "",
    scheduleDays: resizeScheduleDayDrafts(2, []),
    location: "",
    capacity: "20",
    minimumParticipants: "10",
    isPublished: true,
  });
  const selfManagedOrganizerPlaceholder = "-";
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser.role !== "trainer" || isCommunityTrainer) {
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
  }, [availableOrganizers, currentUser.role, isCommunityTrainer]);

  useEffect(() => {
    if (currentUser.role !== "organizer") {
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
  }, [availableTrainers, currentUser.role]);

  if (
    isCreatorView &&
    currentUser.role !== "trainer" &&
    currentUser.role !== "organizer"
  ) {
    return <Navigate to="/panel/szkolenia" replace />;
  }

  return (
    <PanelSection
      eyebrow="Szkolenia"
      title={sectionTitle}
      description={sectionDescription}
      action={
        !isCreatorView &&
        (currentUser.role === "trainer" || currentUser.role === "organizer") ? (
          <Link
            to="/panel/kreator-wydarzen"
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
          >
            <CalendarDays size={16} />
            Utwórz wydarzenie
          </Link>
        ) : undefined
      }
    >
      {!isCreatorView && !isAdmin ? (
        <div className="flex justify-start">
          <EventScopeSwitch
            activeScope={eventScope}
            mineLabel={mineLabel}
            onChange={setEventScope}
          />
        </div>
      ) : null}

      {isCreatorView &&
        (currentUser.role === "trainer" || currentUser.role === "organizer") &&
        (currentUser.role === "organizer" && availableTrainers.length === 0 ? (
          <EmptyPanelState
            title="Najpierw aktywna relacja"
            description="Aby dodać szkolenie, Przekazujący Wiedzę musi mieć przynajmniej jedną zaakceptowaną relację z organizatorem."
          />
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setCreatingEvent(true);

              try {
                await createTrainingEvent({
                  trainerId:
                    currentUser.role === "organizer"
                      ? trainerEventForm.trainerId
                      : undefined,
                  organizerId:
                    currentUser.role === "trainer" &&
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
                  type: isCommunityTrainer
                    ? "Wydarzenie społeczności"
                    : trainerEventForm.type,
                  status: trainerEventForm.status,
                  location: trainerEventForm.location,
                  capacity: Number(trainerEventForm.capacity),
                  minimumParticipants: Number(trainerEventForm.minimumParticipants),
                  isPublished: trainerEventForm.isPublished,
                  selfManagedByTrainer:
                    currentUser.role === "trainer" && !isCommunityTrainer
                      ? trainerEventForm.selfManagedByTrainer
                      : undefined,
                });
                toast.success("Szkolenie zostało dodane.");
                setTrainerEventForm((previous) => ({
                  ...previous,
                  trainerId:
                    currentUser.role === "organizer"
                      ? availableTrainers[0]?.id ?? ""
                      : previous.trainerId,
                  summary: "",
                  description: "",
                  tags: "",
                  status: "active",
                  firstDayDate: "",
                  scheduleDays: resizeScheduleDayDrafts(2, []),
                  location: "",
                  capacity: "20",
                  minimumParticipants: "10",
                  isPublished: true,
                  selfManagedByTrainer:
                    currentUser.role === "trainer"
                      ? previous.selfManagedByTrainer
                      : false,
                }));
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Nie udało się zapisać szkolenia.",
                );
              } finally {
                setCreatingEvent(false);
              }
            }}
            className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
          >
            <div className="mb-5">
              <h3 className="text-2xl font-semibold text-brand-navy">
                {isCommunityTrainer ? "Dodaj wydarzenie społeczności" : "Dodaj nowe szkolenie"}
              </h3>
              <p className="mt-2 text-brand-muted">
                {isCommunityTrainer
                  ? "Uzupełnij miejsce, krótki opis, liczbę miejsc i informację dla osób, które chcą dołączyć."
                  : "Ustaw dwa dni szkolenia, nagłówek miejsca i krótką informację od organizatora."}
              </p>
            </div>

            {currentUser.role === "trainer" &&
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
              {currentUser.role === "organizer" && (
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
                  >
                    {availableTrainers.map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!isCommunityTrainer && currentUser.role === "trainer" && (
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

              {!isCommunityTrainer && currentUser.role === "trainer" && (
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
                      Sam organizuje to szkolenie
                    </span>
                  </span>
                </label>
              )}

              {!isCommunityTrainer && (
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

              <label className="grid gap-2">
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
                  {isCommunityTrainer ? "Lokalizacja" : "Nagłówek miejsca"}
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

              <label className="grid gap-2 xl:col-span-2">
                <span className="text-sm font-semibold text-brand-navy">
                  {isCommunityTrainer
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
                  Tagi wydarzenia
                </span>
                <input
                  value={trainerEventForm.tags}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      tags: event.target.value,
                    }))
                  }
                  placeholder="np. ognisko, pozywienie, nocleg, samodzielna kuchnia"
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
                <span className="text-sm text-brand-muted">
                  Oddziel tagi przecinkami. Pokaza sie publicznie jako chmura tagow.
                </span>
              </label>

              <label className="grid gap-2 xl:col-span-2">
                <span className="text-sm font-semibold text-brand-navy">
                  {isCommunityTrainer
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
                {isCommunityTrainer && (
                  <span className="text-sm text-brand-muted">
                    Ten tekst pokaże się osobie przed wysłaniem prośby o dołączenie.
                  </span>
                )}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">Pierwszy dzien szkolenia</span>
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

              <div className="grid gap-4 xl:col-span-2">
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
                            onChange={(event) =>
                              setTrainerEventForm((previous) => ({
                                ...previous,
                                scheduleDays: previous.scheduleDays.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        startTime: event.target.value,
                                      }
                                    : item,
                                ),
                              }))
                            }
                            className="rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-brand-navy">Godzina konca</span>
                          <input
                            required
                            type="time"
                            value={day.endTime}
                            onChange={(event) =>
                              setTrainerEventForm((previous) => ({
                                ...previous,
                                scheduleDays: previous.scheduleDays.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        endTime: event.target.value,
                                      }
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
                  Prog potwierdzenia wydarzenia
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
            </div>

            <button
              type="submit"
              disabled={creatingEvent}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {creatingEvent ? "Zapisywanie..." : "Dodaj szkolenie"}
            </button>
          </form>
        ))}

      {!isCreatorView && isParticipant && eventScope === "mine" ? (
        <div className="space-y-6">
          <div className="space-y-4">
            <SectionBlockHeading
              title="Aktywne"
              description="Nadchodzące szkolenia oraz zapisy, które są jeszcze w toku akceptacji."
            />
            {activeParticipantRecords.length === 0 ? (
              <EmptyPanelState
                title="Brak aktywnych szkoleń"
                description="Kiedy zapiszesz się na nowe szkolenie, pojawi się ono tutaj."
              />
            ) : (
              activeParticipantRecords.map((record) => (
                <ParticipantEnrollmentCard key={record.request.id} record={record} />
              ))
            )}
          </div>

          <div className="space-y-4">
            <SectionBlockHeading
              title="Archiwum"
              description="Zakończone, odrzucone lub anulowane uczestnictwa."
            />
            {archivedParticipantRecords.length === 0 ? (
              <EmptyPanelState
                title="Archiwum jest jeszcze puste"
                description="Wcześniejsze szkolenia i anulowane zapisy będą widoczne tutaj."
              />
            ) : (
              archivedParticipantRecords.map((record) => (
                <ParticipantEnrollmentCard key={record.request.id} record={record} />
              ))
            )}
          </div>
        </div>
      ) : !isCreatorView ? (
        <div className="space-y-4">
          {listedEvents.length === 0 && (
            <EmptyPanelState
              title={showingAllEvents ? "Brak opublikowanych wydarzeń" : "Brak wydarzeń"}
              description={
                showingAllEvents
                  ? "Kiedy w kalendarzu pojawią się nowe opublikowane szkolenia, zobaczysz je tutaj."
                  : "Tutaj pojawią się szkolenia dopiero po ich ręcznym dodaniu."
              }
            />
          )}
          {listedEvents.map((event) => {
          const eventRequests = store.enrollmentRequests.filter(
            (item) => item.eventId === event.id,
          );
          const activeRequestsCount = eventRequests.filter(
            (item) => item.finalStatus !== "rejected",
          ).length;
          const canDecideCollaboration =
            !showingAllEvents &&
            canDecideTrainingEventCollaboration(event, currentUser);
          const ownerLabels = getEventOwnerLabel(event, store);
          const listTitle = getEventCardTitle(event, currentUser, store);
          const locationParts = getEventLocationParts(event.location);
          const collaborationNotice = showingAllEvents
            ? null
            : getEventCollaborationNotice(event);
          const scheduleRangeLabel = getPanelScheduleRangeLabel(event);
          const scheduleDays = getTrainingEventScheduleDays(event);
          const canOpenEventDetails =
            !showingAllEvents &&
            !(currentUser.role === "organizer" && isTrainingEventArchived(event));

          return (
            <article
              key={event.id}
              className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                    {event.title}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-brand-navy">
                    {listTitle}
                  </h3>
                  <p className="mt-2 text-brand-muted">{event.summary}</p>
                </div>
                <div className="flex flex-col items-start gap-3 sm:items-end">
                  {showingAllEvents ? (
                    <Link
                      to={`/kalendarz/${event.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
                    >
                      Zobacz w kalendarzu
                    </Link>
                  ) : canOpenEventDetails ? (
                    <Link
                      to={`/panel/szkolenia/${event.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
                    >
                      Otworz szkolenie
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
                  <span>Prog: {resolveMinimumParticipants(event)} osob</span>
                  {!showingAllEvents ? (
                    <span>Aktywne zgloszenia: {activeRequestsCount}</span>
                  ) : null}
                  {showingAllEvents || currentUser.role !== "organizer" ? (
                    <span>Organizator: {ownerLabels.organizerName}</span>
                  ) : null}
                  {showingAllEvents ? (
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
                        Dzien {index + 1}
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
                      toast.success("Zapisano decyzje o wspolpracy.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udalo sie zapisac decyzji.",
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
  const {
    archiveTrainingEvent,
    currentUser,
    decideTrainingEventCollaboration,
    manageEnrollmentRequest,
    store,
    updateTrainingEventBrandStatus,
    updateTrainingEventManagement,
  } = useAppState();
  const [archivingEvent, setArchivingEvent] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [movingRequestId, setMovingRequestId] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [transferSelections, setTransferSelections] = useState<Record<string, string>>({});
  const [settingsDraft, setSettingsDraft] = useState({
    status: "active" as TrainingEventStatus,
    capacity: "1",
    minimumParticipants: "1",
    enrollmentPhotoRequirement: "default" as "default" | "required" | "optional",
    tags: "",
    firstDayDate: "",
    scheduleDays: resizeScheduleDayDrafts(2, []),
  });
  const event = store.trainingEvents.find((item) => item.id === eventId);

  useEffect(() => {
    if (!event) {
      return;
    }

    setSettingsDraft({
      status: resolveTrainingEventStatus(event.status),
      capacity: String(event.capacity),
      minimumParticipants: String(resolveMinimumParticipants(event)),
      enrollmentPhotoRequirement: event.enrollmentPhotoRequirement ?? "default",
      tags: (event.tags ?? []).join(", "),
      ...getScheduleDraftsFromEvent(event),
    });
  }, [event]);

  if (!currentUser || !eventId) {
    return <Navigate to="/panel/szkolenia" replace />;
  }

  if (!event) {
    return (
      <PanelSection
        eyebrow="Szkolenie"
        title="Nie znaleziono wydarzenia"
        description="To wydarzenie nie jest dostępne w Twoim panelu."
      >
        <EmptyPanelState
          title="Brak dostępu do wydarzenia"
          description="Wróć do listy swoich szkoleń i wybierz rekord, którym możesz zarządzać."
        />
      </PanelSection>
    );
  }

  const canManageEvent = canManageTrainingEvent(event, currentUser);
  const eventIsArchived = isTrainingEventArchived(event);
  const canDecideCollaboration = canDecideTrainingEventCollaboration(event, currentUser);
  const ownerLabels = getEventOwnerLabel(event, store);
  const detailTitle = getEventCardTitle(event, currentUser, store);
  const locationParts = getEventLocationParts(event.location);
  const collaborationNotice = getEventCollaborationNotice(event);
  const scheduleRangeLabel = getPanelScheduleRangeLabel(event);
  const scheduleDays = getTrainingEventScheduleDays(event);

  if (!canManageEvent && !canDecideCollaboration) {
    return <Navigate to="/panel/szkolenia" replace />;
  }

  const requests = store.enrollmentRequests.filter((item) => item.eventId === event.id);
  const manageableEvents = sortEventsByDate(
    store.trainingEvents.filter((item) => {
      if (item.id === event.id) {
        return false;
      }

      if (currentUser.role === "trainer") {
        return item.trainerId === event.trainerId;
      }

      if (currentUser.role === "organizer") {
        return item.organizerId === event.organizerId;
      }

      return true;
    }),
  );

  return (
    <PanelSection
      eyebrow="Pelny widok szkolenia"
      title={detailTitle}
      description="Tutaj zarządzasz ustawieniami wydarzenia i listą osób, które chcą wziąć w nim udział."
    >
      <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
              {event.title}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-brand-navy">{detailTitle}</h3>
            <p className="mt-2 text-brand-muted">{event.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
              {event.isPublished ? "opublikowane" : "ukryte"}
            </span>
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
          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px]">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Status szkolenia</span>
              <select
                value={settingsDraft.status}
                onChange={(changeEvent) =>
                  setSettingsDraft((previous) => ({
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
                  setSettingsDraft((previous) => ({
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
                  setSettingsDraft((previous) => ({
                    ...previous,
                    minimumParticipants: changeEvent.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
              />
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
                  setSettingsDraft((previous) => ({
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
                  setSettingsDraft((previous) => ({
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
                setSettingsDraft((previous) => ({
                  ...previous,
                  enrollmentPhotoRequirement: changeEvent.target.value as
                    | "default"
                    | "required"
                    | "optional",
                }))
              }
              className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
            >
              <option value="default">Dziedzicz z ustawień właściciela szkolenia</option>
              <option value="required">Zawsze wymagaj zdjęcia</option>
              <option value="optional">Zdjęcie opcjonalne</option>
            </select>
          </label>

          <div className="mt-4 grid gap-4">
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
                          setSettingsDraft((previous) => ({
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
                          setSettingsDraft((previous) => ({
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
                setSettingsDraft((previous) => ({
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
                    parseEventTags(settingsDraft.tags),
                    buildScheduleDaysFromDrafts(
                      settingsDraft.firstDayDate,
                      settingsDraft.scheduleDays,
                    ),
                    undefined,
                    settingsDraft.enrollmentPhotoRequirement,
                  );
                  toast.success("Zapisano ustawienia szkolenia.");
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
              to="/panel/szkolenia"
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
            >
              Wroc do listy szkolen
            </Link>
          </div>
          <p className="mt-3 text-sm text-brand-muted">
            Po osiagnieciu minimalnego progu status zmieni sie automatycznie na potwierdzone.
          </p>
        </div>}
      </article>

      {canManageEvent && !eventIsArchived && <div className="space-y-4">
        <SectionBlockHeading
          title="Uczestnicy i zgłoszenia"
          description="Tutaj widzisz pełną listę osób, zmieniasz ich status i przenosisz zgłoszenia na inne terminy."
        />
        {requests.length === 0 && (
          <EmptyPanelState
            title="Brak osob na liscie"
            description="Gdy pojawia sie nowe prosby o dolaczenie, zobaczysz je tutaj."
          />
        )}

        {requests.map((request) => {
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
                          currentUser.role === "organizer"
                            ? request.organizerDecision
                            : currentUser.role === "admin"
                              ? request.finalStatus === "accepted"
                                ? "accepted"
                                : request.finalStatus === "rejected"
                                  ? "rejected"
                                  : "pending"
                              : request.trainerDecision;

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
      </div>}
    </PanelSection>
  );
}

function PeoplePage({ kind }: { kind: "trainer" | "organizer" }) {
  const { currentUser, decideRelation, store, updateTrainerBrandStatus } = useAppState();
  const items = kind === "organizer" ? store.organizers : store.trainers;
  const trainerProfile = store.trainers.find((item) => item.userId === currentUser?.id);
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const pendingOrganizerRelations =
    kind === "organizer" && currentUser?.role === "trainer" && trainerProfile
      ? store.relations.filter(
          (relation) =>
            relation.trainerId === trainerProfile.id && relation.status === "pending",
        )
      : [];
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
      {pendingOrganizerRelations.length > 0 && (
        <div className="space-y-4">
          {pendingOrganizerRelations.map((relation) => {
            const organizer = store.organizers.find(
              (item) => item.id === relation.organizerId,
            );

            return (
              <article
                key={relation.id}
                className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                      Nowa prośba o współpracę
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-brand-navy">
                      {organizer?.displayName ?? "Organizator"}
                    </h3>
                    <p className="mt-2 text-brand-muted">
                      Prośba od organizatora czeka na Twoją decyzję.
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy">
                    {relation.status}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await decideRelation(relation.id, "approved");
                        toast.success("Relacja została zaakceptowana.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zmienić relacji.",
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
                        await decideRelation(relation.id, "rejected");
                        toast.success("Relacja została odrzucona.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się zmienić relacji.",
                        );
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
                  >
                    <X size={16} />
                    Odrzuć
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

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
    avatarFile: null as File | null,
    defaultEnrollmentPhotoRequired: false,
  });
  const [organizerForm, setOrganizerForm] = useState({
    displayName: "",
    contactName: "",
    location: "",
    description: "",
    defaultEnrollmentPhotoRequired: false,
  });
  const [appSettingsForm, setAppSettingsForm] = useState({
    signupPhotoRequired: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trainerProfile) {
      return;
    }

    setTrainerForm((previous) => ({
      ...previous,
      heroNote: trainerProfile.heroNote ?? "",
      bio: trainerProfile.bio ?? "",
      specialties: trainerProfile.specialties.join(", "),
      locations: trainerProfile.locations.join(", "),
      defaultEnrollmentPhotoRequired: trainerProfile.defaultEnrollmentPhotoRequired === true,
    }));
  }, [trainerProfile]);

  useEffect(() => {
    if (!organizerProfile) {
      return;
    }

    setOrganizerForm({
      displayName: organizerProfile.displayName ?? "",
      contactName: organizerProfile.contactName ?? "",
      location: organizerProfile.location ?? "",
      description: organizerProfile.description ?? "",
      defaultEnrollmentPhotoRequired: organizerProfile.defaultEnrollmentPhotoRequired === true,
    });
  }, [organizerProfile]);

  useEffect(() => {
    setAppSettingsForm({
      signupPhotoRequired: store.appSettings.signupPhotoRequired === true,
    });
  }, [store.appSettings.signupPhotoRequired]);

  if (!currentUser) {
    return null;
  }

  if (currentUser.role === "admin") {
    async function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setSaving(true);

      try {
        await updateAppSettings(appSettingsForm);
        toast.success("Ustawienia aplikacji zostały zapisane.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Nie udało się zapisać ustawień aplikacji.",
        );
      } finally {
        setSaving(false);
      }
    }

    return (
      <PanelSection
        eyebrow="Profil"
        title="Ustawienia globalne rejestracji"
        description="Admin kontroluje tutaj globalne wymagania na publicznej rejestracji."
      >
        <form
          onSubmit={handleSettingsSubmit}
          className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
        >
          <label className="flex items-start gap-3 rounded-3xl border border-brand-line bg-brand-shell p-4 text-brand-navy">
            <input
              type="checkbox"
              checked={appSettingsForm.signupPhotoRequired}
              onChange={(event) =>
                setAppSettingsForm({
                  signupPhotoRequired: event.target.checked,
                })
              }
              className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
            />
            <span className="grid gap-1">
              <span className="text-sm font-semibold">
                Wymagaj zdjęcia przy zakładaniu konta
              </span>
              <span className="text-sm text-brand-muted">
                Gdy ta opcja jest aktywna, publiczna rejestracja SMS nie pozwoli
                dokończyć konta bez zdjęcia profilowego.
              </span>
            </span>
          </label>

          <label className="mt-5 flex items-start gap-3 rounded-3xl border border-brand-line bg-brand-shell p-4 text-brand-navy">
            <input
              type="checkbox"
              checked={organizerForm.defaultEnrollmentPhotoRequired}
              onChange={(event) =>
                setOrganizerForm((previous) => ({
                  ...previous,
                  defaultEnrollmentPhotoRequired: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
            />
            <span className="grid gap-1">
              <span className="text-sm font-semibold">
                Wymagaj zdjęcia w zapisach na moje szkolenia
              </span>
              <span className="text-sm text-brand-muted">
                To ustawienie stanie się domyślnym wymaganiem dla wydarzeń organizowanych z Twojego profilu.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
          >
            {saving ? "Zapisywanie..." : "Zapisz ustawienia"}
          </button>
        </form>
      </PanelSection>
    );
  }

  if ((currentUser.role === "trainer" || currentUser.role === "admin") && trainerProfile) {
    async function handleTrainerSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
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
          avatarFile: trainerForm.avatarFile,
          defaultEnrollmentPhotoRequired: trainerForm.defaultEnrollmentPhotoRequired,
        });
        toast.success("Profil Przekazującego Wiedzę został zapisany.");
        setTrainerForm((previous) => ({
          ...previous,
          avatarFile: null,
        }));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Nie udało się zapisać profilu.",
        );
      } finally {
        setSaving(false);
      }
    }

    function handleTrainerAvatarChange(event: ChangeEvent<HTMLInputElement>) {
      const nextFile = event.target.files?.[0] ?? null;
      setTrainerForm((previous) => ({
        ...previous,
        avatarFile: nextFile,
      }));
    }

    return (
      <PanelSection
        eyebrow="Profil"
        title="Ustawienia profilu Przekazującego Wiedzę"
        description="Tutaj zmienisz zdjęcie, krótkie motto, opis, tagi i lokalizacje szkoleń. Po zapisie zmiany od razu trafią na publiczny widok Przekazujących Wiedzę."
      >
        <form
          onSubmit={handleTrainerSubmit}
          className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
        >
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[1.75rem] border border-brand-line bg-brand-shell">
                {trainerProfile.avatarUrl ? (
                  <img
                    src={trainerProfile.avatarUrl}
                    alt={trainerProfile.displayName}
                    className="h-64 w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center bg-gradient-to-br from-brand-sky/35 to-white text-6xl font-semibold text-brand-navy/70">
                    {trainerProfile.displayName.slice(0, 1)}
                  </div>
                )}
              </div>

              <label className="grid gap-2 rounded-3xl border border-dashed border-brand-line bg-brand-shell px-4 py-4 text-brand-navy">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <ImagePlus size={16} />
                  Nowe zdjęcie
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleTrainerAvatarChange}
                  className="text-sm"
                />
                <span className="text-sm text-brand-muted">
                  {trainerForm.avatarFile
                    ? trainerForm.avatarFile.name
                    : "JPG, PNG lub WEBP do 5 MB"}
                </span>
              </label>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">Krotkie motto</span>
                <input
                  required
                  value={trainerForm.heroNote}
                  onChange={(event) =>
                    setTrainerForm((previous) => ({
                      ...previous,
                      heroNote: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">
                  Dłuższy opis o sobie
                </span>
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
                  className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">
                  Tagi szkoleń
                </span>
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
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
                <span className="text-sm text-brand-muted">
                  Oddziel tagi przecinkami.
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">
                  Lokalizacje szkoleń
                </span>
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
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
                <span className="text-sm text-brand-muted">
                  Oddziel lokalizacje przecinkami.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-3xl border border-brand-line bg-white p-4 text-brand-navy">
                <input
                  type="checkbox"
                  checked={trainerForm.defaultEnrollmentPhotoRequired}
                  onChange={(event) =>
                    setTrainerForm((previous) => ({
                      ...previous,
                      defaultEnrollmentPhotoRequired: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-semibold">
                    Wymagaj zdjęcia w zapisach na moje szkolenia
                  </span>
                  <span className="text-sm text-brand-muted">
                    To ustawienie staje się domyślne dla szkoleń bez nadpisania na poziomie wydarzenia.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
              >
                {saving ? "Zapisywanie..." : "Zapisz profil"}
              </button>
            </div>
          </div>
        </form>
      </PanelSection>
    );
  }

  if (currentUser.role === "organizer" && organizerProfile) {
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
        eyebrow="Profil"
        title="Ustawienia profilu organizatora"
        description="Tutaj uzupełnisz nazwę organizatora, osobę kontaktową, lokalizację i opis."
      >
        <form
          onSubmit={handleOrganizerSubmit}
          className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
        >
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

            <label className="flex items-start gap-3 rounded-3xl border border-brand-line bg-brand-shell p-4 text-brand-navy xl:col-span-2">
              <input
                type="checkbox"
                checked={organizerForm.defaultEnrollmentPhotoRequired}
                onChange={(event) =>
                  setOrganizerForm((previous) => ({
                    ...previous,
                    defaultEnrollmentPhotoRequired: event.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
              />
              <span className="grid gap-1">
                <span className="text-sm font-semibold">
                  Wymagaj zdjęcia w zapisach na moje szkolenia
                </span>
                <span className="text-sm text-brand-muted">
                  To ustawienie stanie się domyślnym wymaganiem dla wydarzeń organizowanych z Twojego profilu.
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
          >
            {saving ? "Zapisywanie..." : "Zapisz profil"}
          </button>
        </form>
      </PanelSection>
    );
  }

  return (
    <PanelSection
      eyebrow="Profil"
      title="Ustawienia profilu"
      description="Ten ekran jest dostępny dla Przekazującego Wiedzę i organizatora."
    >
      <EmptyPanelState
        title="Brak dostępnego profilu"
        description="Zaloguj się jako Przekazujący Wiedzę albo organizator, aby edytować ustawienia."
      />
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

