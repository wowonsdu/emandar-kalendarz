import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  MapPin,
  PencilLine,
  Plus,
  RefreshCcw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { buildGoogleCalendarSubscribeUrl } from "@/domain/utils";
import type {
  OrganizerCalendarFeed,
  OrganizerCalendarFeedInput,
  TrainerOrganizerRelation,
  TrainerSharedSlot,
  TrainingEvent,
  TrainingEventScheduleDay,
  TrainingEventStatus,
  TrainingEventWorkflowStatus,
} from "@/domain/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";

const CALENDAR_TIME_ZONE = "Europe/Warsaw";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: CALENDAR_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: CALENDAR_TIME_ZONE,
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatShortTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: CALENDAR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDurationHours(hours: number) {
  if (hours <= 0) {
    return "0 h";
  }

  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} h`;
}

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") +
    "T" +
    [pad(date.getHours()), pad(date.getMinutes())].join(":");
}

function fromLocalDateTimeValue(value: string) {
  return new Date(value).toISOString();
}

function safeDuration(start: string, end: string) {
  const duration = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return Math.max(0, Math.round(duration * 10) / 10);
}

function splitTagsText(tagsText: string) {
  return Array.from(
    new Set(
      tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function joinTags(tags: string[] | undefined) {
  return (tags ?? []).join(", ");
}

function renderStatusBadge(status: TrainingEventWorkflowStatus | undefined) {
  switch (status) {
    case "trainer-accepted":
      return <Badge variant="outline">zaakceptowany</Badge>;
    case "trainer-rejected":
      return <Badge variant="destructive">odrzucony</Badge>;
    case "withdrawn":
      return <Badge variant="secondary">wycofany</Badge>;
    case "published":
      return <Badge>opublikowany</Badge>;
    default:
      return <Badge variant="secondary">oczekuje</Badge>;
  }
}

function renderFeedStatus(feed: OrganizerCalendarFeed) {
  if (feed.lastSyncStatus === "error") {
    return <Badge variant="destructive">błąd</Badge>;
  }

  if (feed.lastSyncStatus === "success") {
    return <Badge>zsynchronizowano</Badge>;
  }

  return <Badge variant="secondary">oczekuje</Badge>;
}

function FieldLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <span className="text-sm font-semibold text-brand-navy">{children}</span>
      {hint ? <span className="text-xs text-brand-muted">{hint}</span> : null}
    </div>
  );
}

function ScheduleDaysEditor({
  days,
  onChange,
  disabled,
}: {
  days: TrainingEventScheduleDay[];
  onChange: (days: TrainingEventScheduleDay[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel hint="Kolejne terminy szkolenia">Terminy szkolenia</FieldLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() =>
            onChange([
              ...days,
              {
                startsAt: new Date().toISOString(),
                endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              },
            ])
          }
        >
          <Plus size={14} />
          Dodaj dzień
        </Button>
      </div>

      <div className="space-y-3">
        {days.map((day, index) => (
          <article
            key={`${day.startsAt}-${day.endsAt}-${index}`}
            className="grid gap-3 rounded-3xl border border-brand-line bg-brand-shell/60 p-4 md:grid-cols-[1fr_1fr_auto]"
          >
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
                Start
              </span>
              <input
                type="datetime-local"
                disabled={disabled}
                value={toLocalDateTimeValue(day.startsAt)}
                onChange={(event) => {
                  const next = [...days];
                  next[index] = {
                    ...next[index],
                    startsAt: fromLocalDateTimeValue(event.target.value),
                  };
                  onChange(next);
                }}
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
                Koniec
              </span>
              <input
                type="datetime-local"
                disabled={disabled}
                value={toLocalDateTimeValue(day.endsAt)}
                onChange={(event) => {
                  const next = [...days];
                  next[index] = {
                    ...next[index],
                    endsAt: fromLocalDateTimeValue(event.target.value),
                  };
                  onChange(next);
                }}
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
              />
            </label>
            <div className="flex items-end justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || days.length === 1}
                onClick={() => onChange(days.filter((_, dayIndex) => dayIndex !== index))}
              >
                <Trash2 size={14} />
                Usuń
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export interface OrganizerCalendarFeedManagementCardProps {
  title?: string;
  description?: string;
  feeds: OrganizerCalendarFeed[];
  draft: OrganizerCalendarFeedInput;
  onDraftChange: (next: OrganizerCalendarFeedInput) => void;
  onCreateFeed?: (input: OrganizerCalendarFeedInput) => void | Promise<void>;
  onToggleEnabled?: (feedId: string, enabled: boolean) => void | Promise<void>;
  onRemoveFeed?: (feedId: string) => void | Promise<void>;
  onResetFeedToken?: (feedId: string) => void | Promise<void>;
  onSync?: () => void | Promise<void>;
  syncing?: boolean;
  creating?: boolean;
}

export function OrganizerCalendarFeedManagementCard({
  title = "Feedy iCal organizatora",
  description = "Podpinasz własny kalendarz organizatora, aby system automatycznie zgrywał wolne terminy z udostępnionymi slotami trenerów.",
  feeds,
  draft,
  onDraftChange,
  onCreateFeed,
  onToggleEnabled,
  onRemoveFeed,
  onResetFeedToken,
  onSync,
  syncing = false,
  creating = false,
}: OrganizerCalendarFeedManagementCardProps) {
  const enabledFeedCount = feeds.filter((feed) => feed.enabled).length;

  return (
    <Card className="overflow-hidden border-brand-line/80 bg-white shadow-soft">
      <CardHeader className="bg-gradient-to-br from-white to-brand-shell/60">
        <CardTitle className="flex items-center gap-2 text-xl text-brand-navy">
          <CalendarDays size={18} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void onSync?.()}
            disabled={syncing || enabledFeedCount === 0}
            className="bg-brand-navy text-white hover:bg-brand-navy/90"
          >
            <RefreshCcw size={16} />
            {syncing ? "Synchronizowanie..." : "Synchronizuj feedy"}
          </Button>
          <Badge variant="outline">Aktywne: {enabledFeedCount} / {feeds.length}</Badge>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateFeed?.(draft);
          }}
          className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)_auto]"
        >
          <label className="grid gap-2">
            <FieldLabel>Provider</FieldLabel>
            <select
              value={draft.provider}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  provider: event.target.value as OrganizerCalendarFeedInput["provider"],
                })
              }
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
            >
              <option value="google">Google</option>
              <option value="apple">Apple</option>
              <option value="ical">iCal</option>
            </select>
          </label>
          <label className="grid gap-2">
            <FieldLabel hint="Publiczny lub prywatny adres feedu">URL feedu</FieldLabel>
            <input
              value={draft.url}
              onChange={(event) => onDraftChange({ ...draft, url: event.target.value })}
              placeholder="https://.../calendar.ics"
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" className="w-full bg-brand-sky text-brand-navy hover:bg-brand-sky/90">
              <Link2 size={16} />
              {creating ? "Dodawanie..." : "Dodaj feed"}
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          {feeds.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-brand-line bg-brand-shell/50 p-6 text-sm text-brand-muted">
              Brak feedów organizatora. Dodaj własny iCal, aby system mógł automatycznie zgrywać
              dostępność z terminami trenerów.
            </div>
          ) : (
            feeds.map((feed) => (
              <article
                key={feed.id}
                className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{feed.provider}</Badge>
                      {renderFeedStatus(feed)}
                    </div>
                    <p className="break-all text-sm text-brand-muted">{feed.url}</p>
                    {feed.lastSyncedAt ? (
                      <p className="text-xs text-brand-muted">
                        Ostatnia synchronizacja: {formatDateTime(feed.lastSyncedAt)}
                      </p>
                    ) : null}
                    {feed.lastSyncError ? (
                      <p className="text-sm text-red-600">{feed.lastSyncError}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void onToggleEnabled?.(feed.id, !feed.enabled)}
                    >
                      {feed.enabled ? <X size={14} /> : <Check size={14} />}
                      {feed.enabled ? "Wyłącz" : "Włącz"}
                    </Button>
                    {onResetFeedToken ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void onResetFeedToken(feed.id)}
                      >
                        <RefreshCcw size={14} />
                        Reset tokenu
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void onRemoveFeed?.(feed.id)}
                    >
                      <Trash2 size={14} />
                      Usuń
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export interface OrganizerGoogleCalendarExportCtaProps {
  feedUrl: string;
  title?: string;
  description?: string;
  label?: string;
  onCopyLink?: (subscribeUrl: string) => void;
  disabled?: boolean;
}

export function OrganizerGoogleCalendarExportCta({
  feedUrl,
  title = "Eksport do Google Calendar",
  description = "Subskrybuj przefiltrowany feed, aby widzieć dopasowane sloty bez ręcznego przepisywania terminów.",
  label = "Dodaj do Google Calendar",
  onCopyLink,
  disabled = false,
}: OrganizerGoogleCalendarExportCtaProps) {
  const subscribeUrl = buildGoogleCalendarSubscribeUrl(feedUrl);

  return (
    <Card className="overflow-hidden border-brand-line/80 bg-white shadow-soft">
      <CardHeader className="bg-gradient-to-br from-white to-brand-shell/60">
        <CardTitle className="flex items-center gap-2 text-xl text-brand-navy">
          <Globe size={18} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4">
          <p className="text-sm font-semibold text-brand-navy">Adres feedu</p>
          <p className="mt-2 break-all text-sm text-brand-muted">{feedUrl || "Brak adresu feedu"}</p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="bg-brand-navy text-white hover:bg-brand-navy/90"
          disabled={disabled || !subscribeUrl}
          asChild
        >
          <a href={subscribeUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            {label}
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !subscribeUrl}
          onClick={() => {
            if (!subscribeUrl) {
              return;
            }

            onCopyLink?.(subscribeUrl);
          }}
        >
          <Copy size={16} />
          Kopiuj link
        </Button>
      </CardFooter>
    </Card>
  );
}

export interface OrganizerMatchedSlotView extends TrainerSharedSlot {
  trainerName: string;
  trainerLocation?: string;
  relation?: TrainerOrganizerRelation;
  travelWarning?: string;
  googleFeedUrl?: string;
  draftCount?: number;
  nextTrainingSummary?: string;
}

export interface OrganizerMatchedSlotBrowserProps {
  title?: string;
  description?: string;
  slots: OrganizerMatchedSlotView[];
  onCreateDraft?: (slotId: string) => void;
  onCopyFeedLink?: (feedUrl: string) => void;
  onOpenGoogleCalendar?: (feedUrl: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function OrganizerMatchedSlotBrowser({
  title = "Dopasowane sloty trenerów",
  description = "Widok pokazuje wyłącznie sloty, które są zgodne z Twoim kalendarzem i mają aktywną relację z trenerem.",
  slots,
  onCreateDraft,
  onCopyFeedLink,
  onOpenGoogleCalendar,
  emptyTitle = "Brak dopasowanych terminów",
  emptyDescription = "Podłącz własny kalendarz i zaakceptowaną relację z trenerem, aby zobaczyć zgrane okna.",
}: OrganizerMatchedSlotBrowserProps) {
  return (
    <Card className="overflow-hidden border-brand-line/80 bg-white shadow-soft">
      <CardHeader className="bg-gradient-to-br from-white to-brand-shell/60">
        <CardTitle className="flex items-center gap-2 text-xl text-brand-navy">
          <CalendarDays size={18} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {slots.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-brand-line bg-brand-shell/50 p-6 text-sm text-brand-muted">
            <p className="font-semibold text-brand-navy">{emptyTitle}</p>
            <p className="mt-2">{emptyDescription}</p>
          </div>
        ) : (
          slots.map((slot) => (
            <article
              key={slot.id}
              className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{slot.trainerName}</Badge>
                    {slot.relation?.status ? (
                      <Badge variant={slot.relation.status === "approved" ? "default" : "secondary"}>
                        relacja: {slot.relation.status}
                      </Badge>
                    ) : null}
                    {slot.draftCount ? (
                      <Badge variant="secondary">
                        {slot.draftCount} draft{slot.draftCount === 1 ? "" : "y"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-lg font-semibold text-brand-navy">
                    {formatDateOnly(slot.startsAt)}
                  </p>
                  <p className="text-sm text-brand-muted">
                    {formatShortTime(slot.startsAt)} - {formatShortTime(slot.endsAt)}
                    {" · "}
                    {formatDurationHours(safeDuration(slot.startsAt, slot.endsAt))}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                    <MapPin size={14} />
                    <span>{slot.location}</span>
                  </div>
                  {slot.notes ? <p className="text-sm text-brand-muted">{slot.notes}</p> : null}
                  {slot.travelWarning ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <span>{slot.travelWarning}</span>
                    </div>
                  ) : null}
                  {slot.nextTrainingSummary ? (
                    <p className="text-xs text-brand-muted">{slot.nextTrainingSummary}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {slot.googleFeedUrl && onOpenGoogleCalendar ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenGoogleCalendar(slot.googleFeedUrl ?? "")}
                    >
                      <ExternalLink size={14} />
                      Google Calendar
                    </Button>
                  ) : null}
                  {slot.googleFeedUrl && onCopyFeedLink ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCopyFeedLink(slot.googleFeedUrl ?? "")}
                    >
                      <Copy size={14} />
                      Kopiuj feed
                    </Button>
                  ) : null}
                  {onCreateDraft ? (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-brand-navy text-white hover:bg-brand-navy/90"
                      onClick={() => onCreateDraft(slot.id)}
                    >
                      <Plus size={14} />
                      Nowy draft
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export interface OrganizerTrainingDraftFormValues {
  groupId: string;
  sharedSlotId: string;
  title: string;
  summary: string;
  description: string;
  type: string;
  location: string;
  capacity: number;
  minimumParticipants: number;
  status: TrainingEventStatus;
  publishAutomaticallyAfterTrainerApproval: boolean;
  tagsText: string;
  scheduleDays: TrainingEventScheduleDay[];
}

export interface OrganizerDraftGroupOption {
  id: string;
  name: string;
  trainerId: string;
  trainerName?: string;
  activeMembersCount?: number;
}

export interface OrganizerTrainingDraftEditorCardProps {
  title?: string;
  description?: string;
  mode: "create" | "edit";
  values: OrganizerTrainingDraftFormValues;
  availableSlots: OrganizerMatchedSlotView[];
  availableGroups: OrganizerDraftGroupOption[];
  onChange: (next: OrganizerTrainingDraftFormValues) => void;
  onSubmit: (values: OrganizerTrainingDraftFormValues) => void | Promise<void>;
  onCancel?: () => void;
  onWithdraw?: (values: OrganizerTrainingDraftFormValues) => void | Promise<void>;
  submitting?: boolean;
  withdrawing?: boolean;
  disabled?: boolean;
  errorMessage?: string;
}

export function OrganizerTrainingDraftEditorCard({
  title = "Draft szkolenia",
  description = "Wypełnij pełny plan szkolenia. Po zaakceptowaniu przez trenera można je opublikować bez przepisywania danych.",
  mode,
  values,
  availableSlots,
  availableGroups,
  onChange,
  onSubmit,
  onCancel,
  onWithdraw,
  submitting = false,
  withdrawing = false,
  disabled = false,
  errorMessage,
}: OrganizerTrainingDraftEditorCardProps) {
  const selectedSlot = availableSlots.find((slot) => slot.id === values.sharedSlotId);
  const visibleGroups = selectedSlot
    ? availableGroups.filter((group) => group.trainerId === selectedSlot.trainerId)
    : availableGroups;
  const selectedGroup = visibleGroups.find((group) => group.id === values.groupId);

  return (
    <Card className="overflow-hidden border-brand-line/80 bg-white shadow-soft">
      <CardHeader className="bg-gradient-to-br from-white to-brand-shell/60">
        <CardTitle className="flex items-center gap-2 text-xl text-brand-navy">
          <PencilLine size={18} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <label className="grid gap-2">
          <FieldLabel hint="Każdy draft musi należeć do grupy">Grupa</FieldLabel>
          <select
            value={values.groupId}
            onChange={(event) => onChange({ ...values, groupId: event.target.value })}
            disabled={disabled}
            className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
          >
            <option value="">Wybierz grupę</option>
            {visibleGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
                {group.activeMembersCount ? ` · ${group.activeMembersCount} osób` : ""}
              </option>
            ))}
          </select>
          {selectedGroup ? (
            <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4 text-sm text-brand-muted">
              <p className="font-semibold text-brand-navy">{selectedGroup.name}</p>
              <p className="mt-1">
                {selectedGroup.trainerName ?? selectedSlot?.trainerName ?? "Przekazujący Wiedzę"}
              </p>
              <p className="mt-1">
                Aktywni członkowie: {selectedGroup.activeMembersCount ?? 0}
              </p>
            </div>
          ) : null}
        </label>

        <label className="grid gap-2">
          <FieldLabel hint="Wybierz slot, z którego powstanie draft">Slot trenera</FieldLabel>
          <select
            value={values.sharedSlotId}
            onChange={(event) => {
              const nextSharedSlotId = event.target.value;
              const nextSlot = availableSlots.find((slot) => slot.id === nextSharedSlotId);
              const nextGroupId =
                values.groupId &&
                availableGroups.some(
                  (group) =>
                    group.id === values.groupId &&
                    (!nextSlot || group.trainerId === nextSlot.trainerId),
                )
                  ? values.groupId
                  : "";

              onChange({
                ...values,
                sharedSlotId: nextSharedSlotId,
                groupId: nextGroupId,
              });
            }}
            disabled={disabled}
            className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
          >
            <option value="">Wybierz slot</option>
            {availableSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.trainerName} · {formatDateTime(slot.startsAt)} · {slot.location}
              </option>
            ))}
          </select>
          {selectedSlot ? (
            <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4 text-sm text-brand-muted">
              <p className="font-semibold text-brand-navy">{selectedSlot.trainerName}</p>
              <p className="mt-1">
                {formatDateOnly(selectedSlot.startsAt)} · {formatShortTime(selectedSlot.startsAt)} -{" "}
                {formatShortTime(selectedSlot.endsAt)}
              </p>
              <p className="mt-1">{selectedSlot.location}</p>
              {selectedSlot.travelWarning ? (
                <p className="mt-2 flex items-start gap-2 text-amber-900">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{selectedSlot.travelWarning}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 md:col-span-2">
            <FieldLabel>Typ szkolenia</FieldLabel>
            <input
              value={values.type}
              onChange={(event) => onChange({ ...values, type: event.target.value })}
              disabled={disabled}
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
              placeholder="np. warsztat, retreat, sesja"
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <FieldLabel>W tytule</FieldLabel>
            <input
              value={values.title}
              onChange={(event) => onChange({ ...values, title: event.target.value })}
              disabled={disabled}
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
              placeholder="Pełna nazwa szkolenia"
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <FieldLabel>Krótki opis</FieldLabel>
            <textarea
              value={values.summary}
              onChange={(event) => onChange({ ...values, summary: event.target.value })}
              disabled={disabled}
              rows={3}
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
              placeholder="Jednozdaniowe podsumowanie szkolenia"
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <FieldLabel>Pełny opis</FieldLabel>
            <textarea
              value={values.description}
              onChange={(event) => onChange({ ...values, description: event.target.value })}
              disabled={disabled}
              rows={5}
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
              placeholder="Agenda, wymagania, uwagi organizacyjne"
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel hint="Liczba miejsc">Pojemność</FieldLabel>
            <input
              type="number"
              min={1}
              value={values.capacity}
              onChange={(event) =>
                onChange({ ...values, capacity: Number(event.target.value) || 1 })
              }
              disabled={disabled}
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel hint="Minimalna liczba osób">Minimum</FieldLabel>
            <input
              type="number"
              min={1}
              value={values.minimumParticipants}
              onChange={(event) =>
                onChange({ ...values, minimumParticipants: Number(event.target.value) || 1 })
              }
              disabled={disabled}
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
            />
          </label>
          <label className="grid gap-2">
            <FieldLabel>Stan</FieldLabel>
            <select
              value={values.status}
              onChange={(event) =>
                onChange({ ...values, status: event.target.value as TrainingEventStatus })
              }
              disabled={disabled}
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
            >
              <option value="active">Aktywne</option>
              <option value="confirmed">Potwierdzone</option>
              <option value="cancelled">Anulowane</option>
            </select>
          </label>
          <label className="grid gap-2">
            <FieldLabel hint="Po akceptacji trenera">Auto-publikacja</FieldLabel>
            <label className="flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-shell px-4 py-3">
              <input
                type="checkbox"
                checked={values.publishAutomaticallyAfterTrainerApproval}
                onChange={(event) =>
                  onChange({
                    ...values,
                    publishAutomaticallyAfterTrainerApproval: event.target.checked,
                  })
                }
                disabled={disabled}
              />
              <span className="text-sm text-brand-navy">Opublikuj automatycznie po akceptacji</span>
            </label>
          </label>
          <label className="grid gap-2 md:col-span-2">
            <FieldLabel hint="Oddzielaj przecinkami">Tagi</FieldLabel>
            <input
              value={values.tagsText}
              onChange={(event) => onChange({ ...values, tagsText: event.target.value })}
              disabled={disabled}
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none disabled:cursor-not-allowed"
              placeholder="joga, oddech, regeneracja"
            />
          </label>
        </div>

        <ScheduleDaysEditor
          days={values.scheduleDays}
          onChange={(scheduleDays) => onChange({ ...values, scheduleDays })}
          disabled={disabled}
        />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="bg-brand-navy text-white hover:bg-brand-navy/90"
          disabled={disabled || submitting}
          onClick={() => void onSubmit(values)}
        >
          <Check size={16} />
          {submitting ? "Zapisywanie..." : mode === "create" ? "Utwórz draft" : "Zapisz draft"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={disabled || submitting} onClick={onCancel}>
            Anuluj
          </Button>
        ) : null}
        {onWithdraw ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || withdrawing}
            onClick={() => void onWithdraw(values)}
          >
            <Undo2 size={16} />
            {withdrawing ? "Wycofywanie..." : "Wycofaj draft"}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

export interface OrganizerTrainingDraftListItem extends TrainingEvent {
  trainerName?: string;
  slot?: OrganizerMatchedSlotView | null;
}

export interface OrganizerTrainingDraftListCardProps {
  title?: string;
  description?: string;
  drafts: OrganizerTrainingDraftListItem[];
  onEdit?: (draft: OrganizerTrainingDraftListItem) => void;
  onWithdraw?: (draft: OrganizerTrainingDraftListItem) => void;
  onOpen?: (draft: OrganizerTrainingDraftListItem) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function OrganizerTrainingDraftListCard({
  title = "Moje drafty",
  description = "W tej kolejce widzisz szkolenia utworzone na podstawie slotów trenera oraz ich aktualny stan.",
  drafts,
  onEdit,
  onWithdraw,
  onOpen,
  emptyTitle = "Brak draftów",
  emptyDescription = "Stwórz pierwszy draft na dopasowanym slocie trenera, aby zacząć proces akceptacji.",
}: OrganizerTrainingDraftListCardProps) {
  return (
    <Card className="overflow-hidden border-brand-line/80 bg-white shadow-soft">
      <CardHeader className="bg-gradient-to-br from-white to-brand-shell/60">
        <CardTitle className="flex items-center gap-2 text-xl text-brand-navy">
          <CalendarDays size={18} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {drafts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-brand-line bg-brand-shell/50 p-6 text-sm text-brand-muted">
            <p className="font-semibold text-brand-navy">{emptyTitle}</p>
            <p className="mt-2">{emptyDescription}</p>
          </div>
        ) : (
          drafts.map((draft) => (
            <article
              key={draft.id}
              className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderStatusBadge(draft.workflowStatus)}
                    {draft.isPublished ? <Badge>opublikowane</Badge> : null}
                    {draft.publishAutomaticallyAfterTrainerApproval ? (
                      <Badge variant="secondary">auto-publikacja</Badge>
                    ) : null}
                  </div>
                  <p className="text-lg font-semibold text-brand-navy">{draft.title}</p>
                  <p className="text-sm text-brand-muted">{draft.summary}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                    <Clock3 size={14} />
                    <span>
                      {formatDateOnly(draft.startsAt)} · {formatShortTime(draft.startsAt)} -{" "}
                      {formatShortTime(draft.endsAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                    <MapPin size={14} />
                    <span>{draft.location}</span>
                  </div>
                  <p className="text-xs text-brand-muted">
                    Pojemność {draft.enrolledCount}/{draft.capacity}
                    {draft.minimumParticipants ? ` · minimum ${draft.minimumParticipants}` : ""}
                  </p>
                  {draft.groupName ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                      Grupa: {draft.groupName}
                    </p>
                  ) : null}
                  <p className="text-xs text-brand-muted">
                    Tagi: {joinTags(draft.tags)}
                  </p>
                  {draft.trainerDecisionReason ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {draft.trainerDecisionReason}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {onOpen ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpen(draft)}>
                      Otwórz
                    </Button>
                  ) : null}
                  {onEdit ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit(draft)}>
                      <PencilLine size={14} />
                      Edytuj
                    </Button>
                  ) : null}
                  {onWithdraw ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onWithdraw(draft)}
                    >
                      <Undo2 size={14} />
                      Wycofaj
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export interface OrganizerFeedExportSummaryProps {
  feed: OrganizerCalendarFeed | null;
  relation?: TrainerOrganizerRelation | null;
  trainerName?: string;
}

export function OrganizerFeedExportSummary({
  feed,
  relation,
  trainerName,
}: OrganizerFeedExportSummaryProps) {
  return (
    <Card className="overflow-hidden border-brand-line/80 bg-white shadow-soft">
      <CardHeader className="bg-gradient-to-br from-white to-brand-shell/60">
        <CardTitle className="flex items-center gap-2 text-xl text-brand-navy">
          <Globe size={18} />
          Feed dla Google Calendar
        </CardTitle>
        <CardDescription>
          {trainerName
            ? `Ten feed jest przygotowany dla relacji z trenerem ${trainerName}.`
            : "Sekretny feed z dopasowanymi slotami do subskrypcji."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4">
          <p className="text-sm font-semibold text-brand-navy">Relacja</p>
          <p className="mt-2 text-sm text-brand-muted">
            {relation ? `status: ${relation.status}` : "Brak relacji"}
          </p>
        </div>
        <div className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4">
          <p className="text-sm font-semibold text-brand-navy">Adres feedu</p>
          <p className="mt-2 break-all text-sm text-brand-muted">{feed?.url ?? "Brak feedu"}</p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!feed?.url}
          asChild
        >
          <a href={feed?.url ?? "#"} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            Otwórz feed
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

export const OrganizerCalendarFeedsPanel = OrganizerCalendarFeedManagementCard;
export type OrganizerCalendarFeedsPanelProps = OrganizerCalendarFeedManagementCardProps;

export const OrganizerMatchedSlotsPanel = OrganizerMatchedSlotBrowser;
export type OrganizerMatchedSlotsPanelProps = OrganizerMatchedSlotBrowserProps;

export const OrganizerTrainingDraftEditorPanel = OrganizerTrainingDraftEditorCard;
export type OrganizerTrainingDraftEditorPanelProps = OrganizerTrainingDraftEditorCardProps;

export const OrganizerTrainingDraftListPanel = OrganizerTrainingDraftListCard;
export type OrganizerTrainingDraftListPanelProps = OrganizerTrainingDraftListCardProps;

export const OrganizerGoogleCalendarExportPanel = OrganizerGoogleCalendarExportCta;
export type OrganizerGoogleCalendarExportPanelProps = OrganizerGoogleCalendarExportCtaProps;

export const OrganizerFeedExportSummaryPanel = OrganizerFeedExportSummary;
export type OrganizerFeedExportSummaryPanelProps = OrganizerFeedExportSummaryProps;
