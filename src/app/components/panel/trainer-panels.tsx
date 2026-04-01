import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Check,
  Edit3,
  Link2,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import type {
  AppRole,
  TrainerCalendarFeed,
  TrainerCalendarFeedInput,
  TrainerCalendarFeedProvider,
  TrainerSharedSlot,
  TrainerSharedSlotInput,
  TrainerSharedSlotSource,
  TrainerSharedSlotStatus,
  TrainerSharedSlotUpdateInput,
  TrainingEvent,
  TrainingEventWorkflowStatus,
} from "@/domain/types";
import {
  getTrainingEventScheduleBounds,
  getTrainingEventWorkflowStatusLabel,
  resolveTrainingEventWorkflowStatus,
} from "@/domain/utils";

export type TrainerCalendarFeedCard = Pick<
  TrainerCalendarFeed,
  "id" | "provider" | "url" | "enabled" | "lastSyncedAt" | "lastSyncStatus" | "lastSyncError"
>;

export type TrainerSharedSlotCard = Pick<
  TrainerSharedSlot,
  "id" | "trainerId" | "startsAt" | "endsAt" | "location" | "notes" | "source" | "status"
> &
  Partial<Pick<TrainerSharedSlot, "createdAt" | "updatedAt" | "archivedAt" | "archivedReason">>;

export type TrainerDraftCard = Pick<
  TrainingEvent,
  | "id"
  | "trainerId"
  | "organizerId"
  | "title"
  | "summary"
  | "description"
  | "type"
  | "startsAt"
  | "endsAt"
  | "scheduleDays"
  | "location"
  | "capacity"
  | "enrolledCount"
  | "workflowStatus"
  | "sharedSlotId"
  | "trainerDecisionReason"
  | "publishAutomaticallyAfterTrainerApproval"
  | "minimumParticipants"
  | "status"
>;

export interface TrainerPrivateIcalPanelProps {
  feeds: TrainerCalendarFeedCard[];
  syncingFeeds?: boolean;
  onSyncFeeds?: () => void;
  onAddFeed: (input: TrainerCalendarFeedInput) => Promise<void> | void;
  onToggleFeedEnabled: (feedId: string, enabled: boolean) => Promise<void> | void;
  onRemoveFeed: (feedId: string) => Promise<void> | void;
}

export interface TrainerSharedSlotsPanelProps {
  trainerId?: string;
  slots: TrainerSharedSlotCard[];
  onCreateSlot: (input: TrainerSharedSlotInput) => Promise<void> | void;
  onUpdateSlot?: (input: TrainerSharedSlotUpdateInput) => Promise<void> | void;
  onArchiveSlot?: (slotId: string) => Promise<void> | void;
}

export interface TrainerDraftRequestsPanelProps {
  drafts: TrainerDraftCard[];
  selectedDraftId?: string | null;
  onSelectDraft?: (draftId: string) => void;
}

export interface TrainerDraftDecisionsPanelProps {
  draft: TrainerDraftCard | null;
  previousEvent?: Pick<TrainingEvent, "title" | "startsAt" | "endsAt" | "location"> | null;
  nextEvent?: Pick<TrainingEvent, "title" | "startsAt" | "endsAt" | "location"> | null;
  travelWarning?: string;
  onAccept?: (draft: TrainerDraftCard) => Promise<void> | void;
  onReject?: (draft: TrainerDraftCard, reason: string) => Promise<void> | void;
  onWithdraw?: (draft: TrainerDraftCard) => Promise<void> | void;
}

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

function toDatetimeLocalValue(value: string) {
  return value.slice(0, 16);
}

function fromDatetimeLocalValue(value: string) {
  return new Date(value).toISOString();
}

function normalizeTrainerSharedSlotSource(value: TrainerSharedSlotSource | string | undefined) {
  return value === "ical-derived" ? "ical-derived" : "manual";
}

function getTrainerSharedSlotSourceLabel(source: TrainerSharedSlotSource) {
  return source === "ical-derived" ? "wyliczony z iCal" : "ręczny";
}

function getTrainerSharedSlotStatusLabel(status: TrainerSharedSlotStatus) {
  return status === "archived" ? "zarchiwizowany" : "aktywny";
}

function getFeedSyncStatusLabel(feed: TrainerCalendarFeedCard) {
  switch (feed.lastSyncStatus) {
    case "success":
      return "zsynchronizowano";
    case "error":
      return "błąd";
    default:
      return "oczekuje";
  }
}

function getFeedSyncTone(feed: TrainerCalendarFeedCard) {
  switch (feed.lastSyncStatus) {
    case "success":
      return "secondary" as const;
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function getWorkflowTone(workflowStatus: TrainingEventWorkflowStatus | undefined) {
  switch (workflowStatus) {
    case "trainer-accepted":
    case "published":
      return "secondary" as const;
    case "trainer-rejected":
    case "withdrawn":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function getWorkflowLabel(workflowStatus: TrainingEventWorkflowStatus | undefined) {
  return getTrainingEventWorkflowStatusLabel(workflowStatus);
}

export function TrainerPrivateIcalPanel({
  feeds,
  syncingFeeds = false,
  onSyncFeeds,
  onAddFeed,
  onToggleFeedEnabled,
  onRemoveFeed,
}: TrainerPrivateIcalPanelProps) {
  const [provider, setProvider] = useState<TrainerCalendarFeedProvider>("google");
  const [url, setUrl] = useState("");
  const activeFeedCount = feeds.filter((feed) => feed.enabled).length;

  return (
    <Card className="rounded-[2rem] border-brand-line shadow-soft">
      <CardHeader>
        <CardTitle className="text-xl text-brand-navy">Prywatne feedy iCal</CardTitle>
        <CardDescription>
          Podpinamy prywatny kalendarz tylko po to, aby wyliczyć przyszłe wolne przedziały.
          Szczegóły wydarzeń pozostają ukryte.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={onSyncFeeds}
            disabled={syncingFeeds || feeds.length === 0}
            className="rounded-full"
          >
            <RefreshCcw size={16} />
            {syncingFeeds ? "Synchronizowanie..." : "Synchronizuj feedy"}
          </Button>
          <p className="text-sm text-brand-muted">
            Aktywne feedy: {activeFeedCount} / {feeds.length}
          </p>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await onAddFeed({
              provider,
              url,
            });
            setUrl("");
          }}
          className="grid gap-4 xl:grid-cols-[160px_minmax(0,1fr)_auto]"
        >
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">Provider</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as TrainerCalendarFeedProvider)}
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
            >
              <option value="google">Google</option>
              <option value="apple">Apple</option>
              <option value="ical">iCal</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">URL feedu</span>
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://.../basic.ics"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" className="w-full rounded-full bg-brand-sky text-brand-navy">
              <Link2 size={16} />
              Dodaj feed
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          {feeds.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-brand-line bg-brand-shell/60 p-5 text-sm text-brand-muted">
              Brak feedów iCal. Dodaj feed, aby liczyć przyszłe wolne przedziały.
            </div>
          ) : (
            feeds.map((feed) => (
              <article
                key={feed.id}
                className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getFeedSyncTone(feed)}>{feed.provider}</Badge>
                      <Badge variant="outline">{getFeedSyncStatusLabel(feed)}</Badge>
                    </div>
                    <p className="break-all text-sm text-brand-muted">{feed.url}</p>
                    {feed.lastSyncedAt && (
                      <p className="text-xs text-brand-muted">
                        Ostatnia synchronizacja: {formatDateTime(feed.lastSyncedAt)}
                      </p>
                    )}
                    {feed.lastSyncError && (
                      <p className="text-sm text-red-600">{feed.lastSyncError}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => void onToggleFeedEnabled(feed.id, !feed.enabled)}
                    >
                      {feed.enabled ? <X size={14} /> : <Check size={14} />}
                      {feed.enabled ? "Wyłącz" : "Włącz"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => void onRemoveFeed(feed.id)}
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

export function TrainerSharedSlotsPanel({
  slots,
  onCreateSlot,
  onUpdateSlot,
  onArchiveSlot,
}: TrainerSharedSlotsPanelProps) {
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [form, setForm] = useState({
    startsAt: "",
    endsAt: "",
    location: "",
    notes: "",
    source: "manual" as TrainerSharedSlotSource,
  });

  const editingSlot = useMemo(
    () => slots.find((slot) => slot.id === editingSlotId) ?? null,
    [editingSlotId, slots],
  );

  useEffect(() => {
    if (!editingSlot) {
      return;
    }

    setForm({
      startsAt: toDatetimeLocalValue(editingSlot.startsAt),
      endsAt: toDatetimeLocalValue(editingSlot.endsAt),
      location: editingSlot.location,
      notes: editingSlot.notes,
      source: normalizeTrainerSharedSlotSource(editingSlot.source),
    });
  }, [editingSlot]);

  const sortedSlots = useMemo(
    () =>
      [...slots].sort(
        (left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime(),
      ),
    [slots],
  );

  async function handleSubmit() {
    const payload = {
      startsAt: fromDatetimeLocalValue(form.startsAt),
      endsAt: fromDatetimeLocalValue(form.endsAt),
      location: form.location.trim(),
      notes: form.notes.trim(),
      source: normalizeTrainerSharedSlotSource(form.source),
    } satisfies TrainerSharedSlotInput;

    if (editingSlot && onUpdateSlot) {
      await onUpdateSlot({
        slotId: editingSlot.id,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        location: payload.location,
        notes: payload.notes,
      });
      setEditingSlotId(null);
      return;
    }

    await onCreateSlot(payload);
    setForm({
      startsAt: "",
      endsAt: "",
      location: "",
      notes: "",
      source: "manual",
    });
  }

  return (
    <Card className="rounded-[2rem] border-brand-line shadow-soft">
      <CardHeader>
        <CardTitle className="text-xl text-brand-navy">Udostępnione sloty</CardTitle>
        <CardDescription>
          Trener publikuje konkretne przedziały czasowe dla zaakceptowanych organizatorów.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">Start</span>
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">Koniec</span>
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
            />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold text-brand-navy">Lokalizacja</span>
            <Input
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="Warszawa / online"
            />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold text-brand-navy">Notatki</span>
            <Textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Krótki opis lub warunki udostępnienia"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">Źródło</span>
            <select
              value={form.source}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  source: normalizeTrainerSharedSlotSource(event.target.value),
                }))
              }
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
            >
              <option value="manual">Ręczny</option>
              <option value="ical-derived">Wyliczony z iCal</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" className="rounded-full" onClick={() => void handleSubmit()}>
            {editingSlot ? <Edit3 size={16} /> : <CalendarClock size={16} />}
            {editingSlot ? "Zapisz zmiany" : "Dodaj slot"}
          </Button>
          {editingSlot ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setEditingSlotId(null);
                setForm({
                  startsAt: "",
                  endsAt: "",
                  location: "",
                  notes: "",
                  source: "manual",
                });
              }}
            >
              Anuluj edycję
            </Button>
          ) : null}
        </div>

        <div className="space-y-3">
          {sortedSlots.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-brand-line bg-brand-shell/60 p-5 text-sm text-brand-muted">
              Brak udostępnionych slotów. Dodaj pierwszy przedział czasowy.
            </div>
          ) : (
            sortedSlots.map((slot) => (
              <article
                key={slot.id}
                className="rounded-3xl border border-brand-line bg-brand-shell/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={slot.status === "archived" ? "destructive" : "secondary"}>
                        {getTrainerSharedSlotStatusLabel(slot.status)}
                      </Badge>
                      <Badge variant="outline">{getTrainerSharedSlotSourceLabel(slot.source)}</Badge>
                    </div>
                    <p className="text-lg font-semibold text-brand-navy">
                      {formatDate(slot.startsAt)}
                    </p>
                    <p className="text-brand-muted">
                      {formatShortTime(slot.startsAt)} - {formatShortTime(slot.endsAt)}
                    </p>
                    <p className="text-sm text-brand-muted">{slot.location}</p>
                    <p className="text-sm text-brand-muted">{slot.notes}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onUpdateSlot ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => {
                          setEditingSlotId(slot.id);
                          setForm({
                            startsAt: toDatetimeLocalValue(slot.startsAt),
                            endsAt: toDatetimeLocalValue(slot.endsAt),
                            location: slot.location,
                            notes: slot.notes,
                            source: normalizeTrainerSharedSlotSource(slot.source),
                          });
                        }}
                      >
                        <Edit3 size={14} />
                        Edytuj
                      </Button>
                    ) : null}
                    {onArchiveSlot ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => void onArchiveSlot(slot.id)}
                      >
                        <Trash2 size={14} />
                        Archiwizuj
                      </Button>
                    ) : null}
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

export function TrainerDraftRequestsPanel({
  drafts,
  selectedDraftId,
  onSelectDraft,
}: TrainerDraftRequestsPanelProps) {
  const sortedDrafts = useMemo(
    () =>
      [...drafts].sort(
        (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      ),
    [drafts],
  );

  return (
    <Card className="rounded-[2rem] border-brand-line shadow-soft">
      <CardHeader>
        <CardTitle className="text-xl text-brand-navy">Prośby o szkolenie</CardTitle>
        <CardDescription>
          Organizator przygotowuje pełny draft szkolenia, a trener wybiera, który termin
          zaakceptować.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedDrafts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-brand-line bg-brand-shell/60 p-5 text-sm text-brand-muted">
            Brak oczekujących draftów szkolenia.
          </div>
        ) : (
          sortedDrafts.map((draft) => {
            const isSelected = selectedDraftId === draft.id;
            const scheduleBounds = getTrainingEventScheduleBounds(draft);

            return (
              <button
                key={draft.id}
                type="button"
                onClick={() => onSelectDraft?.(draft.id)}
                className={`w-full rounded-3xl border p-4 text-left transition ${
                  isSelected
                    ? "border-brand-navy bg-brand-navy/5"
                    : "border-brand-line bg-brand-shell/60 hover:bg-brand-shell"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getWorkflowTone(resolveTrainingEventWorkflowStatus(draft))}>
                        {getWorkflowLabel(resolveTrainingEventWorkflowStatus(draft))}
                      </Badge>
                      {draft.publishAutomaticallyAfterTrainerApproval ? (
                        <Badge variant="secondary">Auto-publikacja</Badge>
                      ) : (
                        <Badge variant="outline">Ręczna publikacja</Badge>
                      )}
                    </div>
                    <p className="text-base font-semibold text-brand-navy">{draft.title}</p>
                    {draft.groupName ? (
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                        Grupa: {draft.groupName}
                      </p>
                    ) : null}
                    <p className="text-sm text-brand-muted">
                      {formatDate(scheduleBounds.startsAt)} · {formatShortTime(scheduleBounds.startsAt)} -{" "}
                      {formatShortTime(scheduleBounds.endsAt)}
                    </p>
                    <p className="text-sm text-brand-muted">{draft.location}</p>
                    <p className="text-sm text-brand-muted">
                      Pojemność: {draft.enrolledCount}/{draft.capacity}
                    </p>
                  </div>
                  <div className="text-right text-xs text-brand-muted">
                    <p>ID: {draft.id}</p>
                    {draft.sharedSlotId ? <p>Slot: {draft.sharedSlotId}</p> : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function TrainerDraftDecisionsPanel({
  draft,
  previousEvent,
  nextEvent,
  travelWarning,
  onAccept,
  onReject,
  onWithdraw,
}: TrainerDraftDecisionsPanelProps) {
  const [rejectReason, setRejectReason] = useState("");

  if (!draft) {
    return (
      <Card className="rounded-[2rem] border-brand-line shadow-soft">
        <CardHeader>
          <CardTitle className="text-xl text-brand-navy">Decyzja trenera</CardTitle>
          <CardDescription>Wybierz draft z listy, aby zobaczyć szczegóły i decyzje.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-3xl border border-dashed border-brand-line bg-brand-shell/60 p-5 text-sm text-brand-muted">
            Brak wybranego draftu szkolenia.
          </div>
        </CardContent>
      </Card>
    );
  }

  const scheduleBounds = getTrainingEventScheduleBounds(draft);
  const workflowStatus = resolveTrainingEventWorkflowStatus(draft);

  return (
    <Card className="rounded-[2rem] border-brand-line shadow-soft">
      <CardHeader>
        <CardTitle className="text-xl text-brand-navy">Decyzja trenera</CardTitle>
        <CardDescription>
          Tu trener wybiera, czy draft szkolenia przechodzi dalej do publikacji.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getWorkflowTone(workflowStatus)}>{getWorkflowLabel(workflowStatus)}</Badge>
            {draft.publishAutomaticallyAfterTrainerApproval ? (
              <Badge variant="secondary">Auto-publikacja</Badge>
            ) : (
              <Badge variant="outline">Publikacja ręczna</Badge>
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-brand-navy">{draft.title}</p>
            <p className="text-sm text-brand-muted">{draft.type}</p>
            {draft.groupName ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                Grupa: {draft.groupName}
              </p>
            ) : null}
          </div>
          <p className="text-sm text-brand-muted">{draft.summary}</p>
          <div className="grid gap-3 rounded-3xl border border-brand-line bg-brand-shell/60 p-4 text-sm text-brand-muted xl:grid-cols-2">
            <div>
              <p className="font-semibold text-brand-navy">Termin</p>
              <p>
                {formatDate(scheduleBounds.startsAt)} · {formatShortTime(scheduleBounds.startsAt)} -{" "}
                {formatShortTime(scheduleBounds.endsAt)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-brand-navy">Lokalizacja</p>
              <p>{draft.location}</p>
            </div>
            <div>
              <p className="font-semibold text-brand-navy">Pojemność</p>
              <p>
                {draft.enrolledCount}/{draft.capacity}
              </p>
            </div>
            <div>
              <p className="font-semibold text-brand-navy">Minimalna liczba osób</p>
              <p>{draft.minimumParticipants ?? draft.capacity}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-2">
              <p className="font-semibold">Wariant logistyczny</p>
              <p>
                {travelWarning ??
                  "Tutaj pojawią się poprzednie i następne szkolenie oraz szacowany czas dojazdu."}
              </p>
              {previousEvent ? (
                <p>
                  Poprzednie: {previousEvent.title} · {formatShortTime(previousEvent.endsAt)}
                </p>
              ) : null}
              {nextEvent ? (
                <p>
                  Następne: {nextEvent.title} · {formatShortTime(nextEvent.startsAt)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">Powód odrzucenia</span>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Opcjonalny komentarz dla organizatora"
            />
          </label>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3 border-t border-brand-line pt-6">
        <Button type="button" className="rounded-full" onClick={() => void onAccept?.(draft)}>
          <ShieldCheck size={16} />
          Zatwierdź
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => void onReject?.(draft, rejectReason)}
        >
          <X size={16} />
          Odrzuć
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => void onWithdraw?.(draft)}
        >
          <Trash2 size={16} />
          Wycofaj
        </Button>
      </CardFooter>
    </Card>
  );
}

export interface TrainerAvailabilityWorkspaceProps {
  currentUserRole: AppRole;
  feeds: TrainerCalendarFeedCard[];
  sharedSlots: TrainerSharedSlotCard[];
  drafts: TrainerDraftCard[];
  syncingFeeds?: boolean;
  onSyncFeeds?: () => void;
  onAddFeed: (input: TrainerCalendarFeedInput) => Promise<void> | void;
  onToggleFeedEnabled: (feedId: string, enabled: boolean) => Promise<void> | void;
  onRemoveFeed: (feedId: string) => Promise<void> | void;
  onCreateSlot: (input: TrainerSharedSlotInput) => Promise<void> | void;
  onUpdateSlot?: (input: TrainerSharedSlotUpdateInput) => Promise<void> | void;
  onArchiveSlot?: (slotId: string) => Promise<void> | void;
  onAcceptDraft?: (draft: TrainerDraftCard) => Promise<void> | void;
  onRejectDraft?: (draft: TrainerDraftCard, reason: string) => Promise<void> | void;
  onWithdrawDraft?: (draft: TrainerDraftCard) => Promise<void> | void;
}

export function TrainerAvailabilityWorkspace({
  currentUserRole,
  feeds,
  sharedSlots,
  drafts,
  syncingFeeds,
  onSyncFeeds,
  onAddFeed,
  onToggleFeedEnabled,
  onRemoveFeed,
  onCreateSlot,
  onUpdateSlot,
  onArchiveSlot,
  onAcceptDraft,
  onRejectDraft,
  onWithdrawDraft,
}: TrainerAvailabilityWorkspaceProps) {
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (drafts.length === 0) {
      setSelectedDraftId(null);
      return;
    }

    if (!selectedDraftId || !drafts.some((draft) => draft.id === selectedDraftId)) {
      setSelectedDraftId(drafts[0].id);
    }
  }, [drafts, selectedDraftId]);

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId],
  );

  const previousEvent = null;
  const nextEvent = null;

  if (currentUserRole !== "trainer") {
    return null;
  }

  return (
    <div className="mb-6 space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <TrainerPrivateIcalPanel
          feeds={feeds}
          syncingFeeds={syncingFeeds}
          onSyncFeeds={onSyncFeeds}
          onAddFeed={onAddFeed}
          onToggleFeedEnabled={onToggleFeedEnabled}
          onRemoveFeed={onRemoveFeed}
        />
        <TrainerSharedSlotsPanel
          slots={sharedSlots}
          onCreateSlot={onCreateSlot}
          onUpdateSlot={onUpdateSlot}
          onArchiveSlot={onArchiveSlot}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <TrainerDraftRequestsPanel
          drafts={drafts}
          selectedDraftId={selectedDraftId}
          onSelectDraft={setSelectedDraftId}
        />
        <TrainerDraftDecisionsPanel
          draft={selectedDraft}
          previousEvent={previousEvent}
          nextEvent={nextEvent}
          onAccept={onAcceptDraft}
          onReject={onRejectDraft}
          onWithdraw={onWithdrawDraft}
        />
      </div>
    </div>
  );
}
