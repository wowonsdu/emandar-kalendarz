import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  ImagePlus,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { AppUser, EmandarBrandStatus, TrainingEvent } from "@/domain/types";
import {
  getTrainingEventScheduleBounds,
  getTrainingEventScheduleDays,
  isTrainingEventArchived,
  isSelfManagedTrainingEvent,
  isTrainingEventCollaborationAccepted,
  isCommunityBrandStatus,
  resolveBrandStatus,
  resolveTrainingEventStatus,
  sortEventsByDate,
} from "@/domain/utils";
import { useAppState } from "../providers/AppProviders";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getScheduleRows(event: TrainingEvent) {
  return getTrainingEventScheduleDays(event).map((day, index) => ({
    key: `day-${index + 1}`,
    title: `Dzien ${index + 1}`,
    label: formatDate(day.startsAt),
    range: `${formatTime(day.startsAt)} - ${formatTime(day.endsAt)}`,
  }));
}

function getScheduleRangeLabel(event: TrainingEvent) {
  const bounds = getTrainingEventScheduleBounds(event);

  if (bounds.dayCount <= 1) {
    return formatDate(bounds.startsAt);
  }

  return `od ${formatDate(bounds.startsAt)} do ${formatDate(bounds.endsAt)}`;
}

function firstName(value?: string) {
  if (!value) {
    return "";
  }

  return value.trim().split(/\s+/)[0] ?? "";
}

function getPublicOrganizerName(event: TrainingEvent, organizerName?: string, trainerName?: string) {
  if (isSelfManagedTrainingEvent(event)) {
    return firstName(trainerName);
  }

  return firstName(organizerName) || "Zespół Emandar";
}

function getPublicOrganizerDescription(
  event: TrainingEvent,
  organizerDescription?: string,
  trainerHeroNote?: string,
) {
  if (isSelfManagedTrainingEvent(event)) {
    return trainerHeroNote ?? "";
  }

  return organizerDescription || "Szczegóły organizacyjne otrzymasz po zgłoszeniu.";
}

function getEventTags(event: TrainingEvent) {
  return (event.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
}

function canManagePublicEvent(event: TrainingEvent, currentUser: AppUser | null) {
  if (!currentUser) {
    return false;
  }

  if (currentUser.role === "admin") {
    return true;
  }

  if (currentUser.role === "trainer") {
    return currentUser.trainerProfileId === event.trainerId;
  }

  if (currentUser.role === "organizer") {
    return (
      Boolean(event.organizerId) &&
      currentUser.organizerProfileId === event.organizerId &&
      !isTrainingEventArchived(event)
    );
  }

  return false;
}

function isOfficialTrainerProfile(
  status: EmandarBrandStatus | undefined,
) {
  return resolveBrandStatus(status) === "official";
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[2rem] border border-dashed border-brand-line bg-white/80 p-8 text-center shadow-soft">
      <h3 className="text-2xl font-semibold text-brand-navy">{title}</h3>
      <p className="mt-3 text-brand-muted">{description}</p>
    </article>
  );
}

function EventFeedSection({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  events,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  events: TrainingEvent[];
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-10 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-sky-deep">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-brand-navy sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-lg text-brand-muted">{description}</p>
      </div>

      <div className="grid gap-6">
        {events.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          events.map((event) => <EventCard key={event.id} eventId={event.id} />)
        )}
      </div>
    </section>
  );
}

function EventCard({ eventId }: { eventId: string }) {
  const { currentUser, store } = useAppState();
  const event = store.trainingEvents.find((item) => item.id === eventId);

  if (!event) {
    return null;
  }

  const trainer = store.trainers.find((item) => item.id === event.trainerId);
  const eventTags = getEventTags(event);
  const scheduleRows = getScheduleRows(event);
  const scheduleRangeLabel = getScheduleRangeLabel(event);
  const isCommunityEvent = isCommunityBrandStatus(event.brandStatus);
  const canManage = canManagePublicEvent(event, currentUser);

  return (
    <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
      <div className="grid gap-6 md:grid-cols-[228px_minmax(0,1fr)] md:items-stretch">
        <div className="relative h-full min-h-[21rem] overflow-hidden rounded-[1.75rem] bg-brand-shell">
          {trainer?.avatarUrl ? (
            <img
              src={trainer.avatarUrl}
              alt={trainer.displayName}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-sky/40 to-white text-4xl font-semibold text-brand-navy">
              {trainer?.displayName?.slice(0, 1)}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/45 to-transparent px-4 py-5 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-white/75">
              Przekazujący Wiedzę
            </p>
            <p className="text-lg font-semibold">{trainer?.displayName}</p>
          </div>
        </div>

        <div className="flex h-full flex-col">
          <div>
            <h3 className="text-2xl font-semibold text-brand-navy">{event.location}</h3>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
            {scheduleRangeLabel}
            </p>
            <p className="mt-3 line-clamp-2 text-brand-muted">{event.summary}</p>
          </div>
          <div
            className={`mt-6 grid gap-3 ${
              scheduleRows.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1"
            }`}
          >
            {scheduleRows.map((row) => (
              <div
                key={row.key}
                className="rounded-2xl bg-brand-shell px-4 py-3 text-sm text-brand-muted"
              >
                <div className="mb-1 flex items-center gap-2 font-semibold text-brand-navy">
                  <CalendarDays size={16} />
                  {row.title}
                </div>
                <p>{row.label}</p>
                <p>{row.range}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 text-sm text-brand-muted">
            <div>
              {isCommunityEvent || isSelfManagedTrainingEvent(event)
                ? "Prowadzone samodzielnie"
                : "Organizator:"}{" "}
              {!isCommunityEvent && !isSelfManagedTrainingEvent(event) && (
                <span className="font-semibold text-brand-navy">
                  {getPublicOrganizerName(event, undefined, trainer?.displayName)}
                </span>
              )}
            </div>
          </div>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-5">
            {eventTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
              {eventTags.map((tag) => (
                <span
                  key={`${event.id}-${tag}`}
                  className="rounded-full bg-brand-sky/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy"
                >
                  {tag}
                </span>
              ))}
              </div>
            ) : (
              <div />
            )}
            <div className="flex flex-wrap items-center gap-3">
              {canManage && (
                <Link
                  to={`/panel/szkolenia/${event.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-soft"
                >
                  Edytuj szkolenie
                </Link>
              )}
              <Link
                to={`/kalendarz/${event.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
              >
                Poproś o kontakt
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function LandingPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-soft">
            <Sparkles size={16} />
            Kalendarz i panel Emandar na Firebase
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-tight text-brand-navy sm:text-6xl">
            Publiczny kalendarz szkoleń i panel współpracy dla Przekazujących
            Wiedzę oraz organizatorów.
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-brand-muted">
            W tej wersji dane publiczne, logowanie, zgłoszenia i zdjęcia trafiają
            już do Firebase. Możesz przejść do kalendarza, sprawdzić
            Przekazujących Wiedzę, wejść w Wydarzenia Społeczności albo zalogować się do panelu.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/kalendarz"
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft"
            >
              Przejdź do kalendarza
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/trenerzy"
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-6 py-3.5 text-sm font-semibold text-brand-navy"
            >
              Poznaj Przekazujących Wiedzę
            </Link>
            <Link
              to="/wydarzenia-spolecznosci"
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-6 py-3.5 text-sm font-semibold text-brand-navy"
            >
              Wydarzenia Społeczności
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-sky/15 px-6 py-3.5 text-sm font-semibold text-brand-navy"
            >
              Zaloguj się do panelu
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          {[
            {
              title: "Kalendarz",
              description:
                "Lista najbliższych szkoleń, szybki detal i formularz zgłoszenia ze zdjęciem.",
              icon: CalendarDays,
              to: "/kalendarz",
            },
            {
              title: "Przekazujący Wiedzę",
              description:
                "Publiczne profile Przekazujących Wiedzę oraz ich najbliższe wydarzenia.",
              icon: Users,
              to: "/trenerzy",
            },
            {
              title: "Wydarzenia Społeczności",
              description:
                "Osobna strona z nieoficjalnymi wydarzeniami wspieranymi przez Emandar.",
              icon: CalendarDays,
              to: "/wydarzenia-spolecznosci",
            },
            {
              title: "Panel",
              description:
                "Osobny obszar dla admina, Przekazującego Wiedzę i organizatora oparty o Firebase Auth.",
              icon: ShieldCheck,
              to: "/login",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                to={card.to}
                className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft transition-transform hover:-translate-y-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-sky/15 text-brand-navy">
                  <Icon size={22} />
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-brand-navy">
                  {card.title}
                </h2>
                <p className="mt-2 text-brand-muted">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CalendarPage() {
  const { store } = useAppState();
  const events = useMemo(
    () =>
      sortEventsByDate(
        store.trainingEvents.filter(
          (item) =>
            item.isPublished &&
            !isTrainingEventArchived(item) &&
            resolveBrandStatus(item.brandStatus) === "official" &&
            isTrainingEventCollaborationAccepted(item),
        ),
      ),
    [store.trainingEvents],
  );

  return (
    <EventFeedSection
      eyebrow="Kalendarz"
      title="Najblizsze grupy Emandar"
      description="Znajdz wydarzenie dla siebie i popros o kontakt. Osobna zakladka Wydarzenia Spolecznosci zbiera inicjatywy niezalezne."
      emptyTitle="Brak opublikowanych szkoleń"
      emptyDescription="Po dodaniu wydarzeń pojawią się tutaj szkolenia."
      events={events}
    />
  );
}

export function CommunityEventsPage() {
  const { store } = useAppState();
  const events = useMemo(
    () =>
      sortEventsByDate(
        store.trainingEvents.filter(
          (item) =>
            item.isPublished &&
            !isTrainingEventArchived(item) &&
            resolveBrandStatus(item.brandStatus) === "supported" &&
            isTrainingEventCollaborationAccepted(item),
        ),
      ),
    [store.trainingEvents],
  );

  return (
    <EventFeedSection
      eyebrow="Spolecznosc"
      title="Wydarzenia Spolecznosci"
      description="To osobna przestrzen dla nieoficjalnych wydarzen wspieranych przez Emandar. Znajdziesz tu niezalezne inicjatywy, kameralne spotkania i szkolenia spolecznosci."
      emptyTitle="Brak wydarzeń społeczności"
      emptyDescription="Gdy pojawią się nowe inicjatywy wspierane przez społeczność, zobaczysz je tutaj."
      events={events}
    />
  );
}

export function EventDetailsPage() {
  const { eventId } = useParams();
  const { currentUser, store, submitEnrollment } = useAppState();
  const navigate = useNavigate();
  const event = store.trainingEvents.find((item) => item.id === eventId);
  const trainer = store.trainers.find((item) => item.id === event?.trainerId);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    imieNazwisko: "",
    telefon: "",
    polecenieOdKogo: "",
    wiadomosc: "",
    photoFile: null as File | null,
  });

  if (!event || !trainer) {
    return <Navigate to="/kalendarz" replace />;
  }

  if (isTrainingEventArchived(event)) {
    return <Navigate to={isCommunityBrandStatus(event.brandStatus) ? "/wydarzenia-spolecznosci" : "/kalendarz"} replace />;
  }

  const scheduleRows = getScheduleRows(event);
  const scheduleRangeLabel = getScheduleRangeLabel(event);
  const isCommunityEvent = isCommunityBrandStatus(event.brandStatus);
  const eventStatus = resolveTrainingEventStatus(event.status);
  const isCancelled = eventStatus === "cancelled";
  const eventTags = getEventTags(event);
  const canManage = canManagePublicEvent(event, currentUser);

  function handleFileChange(fileEvent: ChangeEvent<HTMLInputElement>) {
    const nextFile = fileEvent.target.files?.[0] ?? null;
    setForm((current) => ({
      ...current,
      photoFile: nextFile,
    }));
  }

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();

    if (!form.photoFile) {
      toast.error("Dodaj zdjęcie twarzy.");
      return;
    }

    setLoading(true);
    try {
      await submitEnrollment({
        eventId: event.id,
        imieNazwisko: form.imieNazwisko,
        telefon: form.telefon,
        polecenieOdKogo: form.polecenieOdKogo,
        wiadomosc: form.wiadomosc,
        photoFile: form.photoFile,
      });
      toast.success("Zgłoszenie i zdjęcie zostały zapisane.");
      setForm({
        imieNazwisko: "",
        telefon: "",
        polecenieOdKogo: "",
        wiadomosc: "",
        photoFile: null,
      });
      navigate(isCommunityEvent ? "/wydarzenia-spolecznosci" : "/kalendarz");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się wysłać zgłoszenia.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
            {event.type}
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-brand-navy">{event.location}</h1>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] text-brand-sky-deep">
            {scheduleRangeLabel}
          </p>
          <p className="mt-4 text-lg font-medium text-brand-sky-deep">{event.summary}</p>
          <p className="mt-4 text-lg text-brand-muted">{event.description}</p>

          <div
            className={`mt-8 grid gap-4 ${
              scheduleRows.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1"
            }`}
          >
            {scheduleRows.map((row) => (
              <div key={row.key} className="rounded-3xl bg-brand-shell p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                  <CalendarDays size={16} />
                  {row.title}
                </div>
                <p className="mt-2 text-brand-muted">{row.label}</p>
                <p className="text-brand-muted">{row.range}</p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.25em] text-brand-sky-deep">
            Maks. {event.capacity} uczestnikow
          </p>

          <div
            className={`mt-8 grid gap-4 ${
              isCommunityEvent ? "md:grid-cols-1" : "md:grid-cols-2"
            }`}
          >
            <div className="rounded-3xl border border-brand-line bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-sky-deep">
                Przekazujący Wiedzę
              </p>
              <p className="mt-2 text-2xl font-semibold text-brand-navy">
                {trainer.displayName}
              </p>
              <p className="mt-2 text-brand-muted">{trainer.heroNote}</p>
            </div>
            {!isCommunityEvent && (
              <div className="rounded-3xl border border-brand-line bg-white p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-sky-deep">
                  Organizator
                </p>
                <p className="mt-2 text-2xl font-semibold text-brand-navy">
                    {getPublicOrganizerName(event, undefined, trainer.displayName)}
                  </p>
                  <p className="mt-2 text-brand-muted">
                    {getPublicOrganizerDescription(event, undefined, trainer.heroNote)}
                  </p>
                </div>
              )}
          </div>
          {eventTags.length > 0 && (
            <div className="mt-6 rounded-3xl border border-brand-line bg-brand-shell p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-sky-deep">
                Tagi wydarzenia
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {eventTags.map((tag) => (
                  <span
                    key={`${event.id}-detail-${tag}`}
                    className="rounded-full border border-brand-line bg-white px-3 py-1 text-sm font-semibold text-brand-navy"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
            Formularz dołączenia
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-brand-navy">
            Chcę poprosić o kontakt w sprawie tego szkolenia
          </h2>
          <p className="mt-3 text-brand-muted">
            {isCommunityEvent
              ? "Zgloszenie trafi bezposrednio do osoby prowadzacej to wydarzenie."
              : "Zgłoszenie trafi jednocześnie do Przekazującego Wiedzę i organizatora."}{" "}
            Zdjęcie jest zapisywane w Firebase Storage i dostępne tylko dla
            uprawnionych osób.
          </p>
          {isCancelled && (
            <p className="mt-4 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm font-semibold text-brand-navy">
              Zapisy sa wstrzymane, bo to wydarzenie ma status anulowane.
            </p>
          )}

          <div className="mt-8 grid gap-4">
            <input
              required
              value={form.imieNazwisko}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  imieNazwisko: event.target.value,
                }))
              }
              placeholder="Imię i nazwisko"
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
            <input
              required
              value={form.telefon}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  telefon: event.target.value,
                }))
              }
              placeholder="Numer telefonu"
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
            <input
              value={form.polecenieOdKogo}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  polecenieOdKogo: event.target.value,
                }))
              }
              placeholder="Czy jesteś z polecenia od kogoś?"
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
            <label className="grid gap-3 rounded-3xl border border-dashed border-brand-line bg-brand-shell px-4 py-4 text-brand-navy">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <ImagePlus size={16} />
                Zdjęcie twarzy
              </span>
              <input
                required
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="text-sm"
              />
              <span className="text-sm text-brand-muted">
                {form.photoFile
                  ? `Wybrany plik: ${form.photoFile.name}`
                  : "Wymagane: JPG, PNG albo WEBP"}
              </span>
            </label>
            <textarea
              rows={5}
              value={form.wiadomosc}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  wiadomosc: event.target.value,
                }))
              }
              placeholder={
                isCommunityEvent
                  ? "Napisz wiadomosc do osoby prowadzacej wydarzenie"
                  : "Napisz wiadomość do Przekazującego Wiedzę i organizatora"
              }
              className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {canManage && (
              <Link
                to={`/panel/szkolenia/${event.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-6 py-3.5 text-sm font-semibold text-brand-navy shadow-soft"
              >
                Edytuj szkolenie
              </Link>
            )}
            <button
              type="submit"
              disabled={loading || isCancelled}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {loading ? "Wysyłanie..." : "Poproś o kontakt"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export function TrainersPage() {
  const { store } = useAppState();
  const trainers = useMemo(
    () =>
      store.trainers.filter(
        (item) => item.isVisible && isOfficialTrainerProfile(item.brandStatus),
      ),
    [store.trainers],
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-10 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-sky-deep">
          Przekazujący Wiedzę
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-brand-navy sm:text-5xl">
          Profile Przekazujących Wiedzę
        </h1>
        <p className="mt-4 text-lg text-brand-muted">
          Każdy z naszych przekazujących wiedzę ma swój niepowtarzalny aromat, poznaj je wszystkie.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {trainers.length === 0 ? (
          <div className="sm:col-span-2 xl:col-span-4">
            <EmptyState
              title="Brak publicznych profili"
              description="Tutaj pojawią się tylko profile trenerów, które zostały ręcznie dodane i odblokowane w systemie."
            />
          </div>
        ) : (
          trainers.map((trainer) => {
            const cardSummary = trainer.heroNote?.trim()
              ? trainer.heroNote.trim()
              : trainer.bio.length > 80
                ? `${trainer.bio.slice(0, 80).trim()}...`
                : trainer.bio;

            return (
              <article
                key={trainer.id}
                className="group relative h-[33rem] overflow-hidden rounded-[1.8rem] border border-brand-line bg-brand-shell shadow-soft"
              >
                <div className="h-full w-full">
                  {trainer.avatarUrl ? (
                    <img
                      src={trainer.avatarUrl}
                      alt={trainer.displayName}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-sky/45 via-brand-shell to-brand-navy/35 text-6xl font-semibold text-brand-navy/70">
                      {trainer.displayName.slice(0, 1)}
                    </div>
                  )}
                </div>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-navy/55 via-brand-navy/10 to-transparent" />

                <div className="absolute inset-x-4 bottom-4 rounded-[1.35rem] bg-white/90 p-5 shadow-soft backdrop-blur-md">
                  <h2 className="text-2xl font-semibold leading-tight text-brand-navy">
                    {trainer.displayName}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-brand-muted">
                    {cardSummary}
                  </p>
                  <Link
                    to={`/trenerzy/${trainer.slug}`}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Zobacz profil
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export function TrainerDetailsPage() {
  const { slug } = useParams();
  const { store } = useAppState();
  const trainer = store.trainers.find((item) => item.slug === slug);

  if (!trainer) {
    return <Navigate to="/trenerzy" replace />;
  }

  if (!trainer.isVisible || !isOfficialTrainerProfile(trainer.brandStatus)) {
    return <Navigate to="/wydarzenia-spolecznosci" replace />;
  }

  const publicEvents = sortEventsByDate(
    store.trainingEvents.filter(
      (event) => event.trainerId === trainer.id && event.isPublished && !isTrainingEventArchived(event),
    ),
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
          <div className="mb-6 overflow-hidden rounded-[1.8rem] border border-brand-line bg-brand-shell">
            {trainer.avatarUrl ? (
              <img
                src={trainer.avatarUrl}
                alt={trainer.displayName}
                className="h-[42rem] w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-[42rem] items-center justify-center bg-gradient-to-br from-brand-sky/45 via-brand-shell to-brand-navy/35 text-7xl font-semibold text-brand-navy/70">
                {trainer.displayName.slice(0, 1)}
              </div>
            )}
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
            Profil Przekazującego Wiedzę
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-brand-navy">
            {trainer.displayName}
          </h1>
          <p className="mt-4 text-lg font-medium text-brand-sky-deep">
            {trainer.heroNote}
          </p>
          <p className="mt-4 text-brand-muted">{trainer.bio}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {trainer.specialties.map((specialty) => (
              <span
                key={specialty}
                className="rounded-full border border-brand-line px-3 py-1 text-sm text-brand-muted"
              >
                {specialty}
              </span>
            ))}
          </div>
          <div className="mt-6 space-y-3 text-brand-muted">
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              {trainer.locations.join(" • ")}
            </div>
            <div className="flex items-center gap-2">
              <Users size={16} />
              {publicEvents.length} publicznych szkoleń
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {publicEvents.length === 0 ? (
            <EmptyState
              title="Brak publicznych wydarzeń"
              description="Ta osoba nie ma jeszcze opublikowanych szkolen."
            />
          ) : (
            publicEvents.map((event) => <EventCard key={event.id} eventId={event.id} />)
          )}
        </div>
      </div>
    </section>
  );
}

export function LoginPage() {
  const { authReady, currentUser, signIn } = useAppState();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (currentUser) {
    return <Navigate to="/panel/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success("Zalogowano do panelu.");
      navigate("/panel/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zalogować.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft"
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Hasło</span>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !authReady}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
          >
            {loading ? "Logowanie..." : "Wejdź do panelu"}
            <ArrowRight size={16} />
          </button>

          <div className="mt-8 rounded-3xl border border-brand-line bg-brand-shell p-5 text-sm text-brand-muted">
            <div className="flex items-center gap-2 font-semibold text-brand-navy">
              <Phone size={16} />
              Dostęp do panelu
            </div>
            <p className="mt-2">
              Jesteś organizatorem grup? Zarejestruj się, wybierz swojego
              Przekazującego Wiedzę i poczekaj na akceptację.
            </p>
            <Link
              to="/rejestracja"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 font-semibold text-brand-navy"
            >
              Utwórz konto organizatora
              <ArrowRight size={14} />
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}

export function RegisterPage() {
  const { currentUser, submitAccountRequest } = useAppState();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    requestedRoles: ["organizer"] as Array<"trainer" | "organizer">,
    notes: "",
  });

  if (currentUser) {
    return <Navigate to="/panel/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      if (form.requestedRoles.length === 0) {
        toast.error("Wybierz przynajmniej jeden zakres działania.");
        return;
      }

      await submitAccountRequest(form);
      toast.success("Zgłoszenie konta zostało zapisane.");
      navigate("/login");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udało się wysłać zgłoszenia rejestracyjnego.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
          Rejestracja
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-brand-navy">
          Zgłoszenie nowego konta
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-brand-muted">
          Wypełnij formularz, a po akceptacji przez admina konto może działać
          jako organizator grup Emandar, osoba prowadząca wydarzenia dla
          społeczności albo w obu tych trybach naraz.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">
              Imię i nazwisko
            </span>
            <input
              required
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">
              Numer telefonu
            </span>
            <input
              required
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">
              Chcę działać jako
            </span>
            <div className="grid gap-3 rounded-3xl border border-brand-line bg-brand-shell p-4">
              <label className="flex items-start gap-3 text-brand-navy">
                <input
                  type="checkbox"
                  checked={form.requestedRoles.includes("organizer")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requestedRoles: event.target.checked
                        ? Array.from(new Set([...current.requestedRoles, "organizer"]))
                        : current.requestedRoles.filter((role) => role !== "organizer"),
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-semibold">Organizator grup Emandar</span>
                  <span className="text-sm text-brand-muted">
                    Organizujesz normalne szkolenia z Przekazującym Wiedzę na podstawie
                    zatwierdzonej relacji.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-brand-navy">
                <input
                  type="checkbox"
                  checked={form.requestedRoles.includes("trainer")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requestedRoles: event.target.checked
                        ? Array.from(new Set([...current.requestedRoles, "trainer"]))
                        : current.requestedRoles.filter((role) => role !== "trainer"),
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-semibold">Wydarzenia dla społeczności</span>
                  <span className="text-sm text-brand-muted">
                    Prowadzisz własne zgłoszenia i wydarzenia społeczności bez przypinania
                    ich do trenera.
                  </span>
                </span>
              </label>
            </div>
            <p className="text-sm text-brand-muted">
              Możesz zaznaczyć oba warianty, jeśli chcesz działać jednocześnie w obu
              obszarach.
            </p>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">
              Kilka słów o sobie
            </span>
            <textarea
              rows={5}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {loading ? "Wysyłanie..." : "Wyślij zgłoszenie"}
              <ArrowRight size={16} />
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-6 py-3.5 text-sm font-semibold text-brand-navy"
            >
              Wróć do logowania
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
