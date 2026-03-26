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
import { useEffect, useRef } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { AppUser, EmandarBrandStatus, TrainingEvent } from "@/domain/types";
import { updateActiveRole as updateActiveRoleAction } from "@/data/firebaseRepository";
import { fetchAppUser } from "@/data/firebaseRepository";
import {
  getTrainingEventScheduleBounds,
  getTrainingEventScheduleDays,
  isTrainingEventArchived,
  isSelfManagedTrainingEvent,
  isTrainingEventCollaborationAccepted,
  isCommunityBrandStatus,
  isEnrollmentPhotoRequiredForEvent,
  resolveBrandStatus,
  resolveTrainingEventStatus,
  sortEventsByDate,
} from "@/domain/utils";
import { firebaseAuth } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
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

const demoLoginPassword = "kocham";

const demoLoginSections = [
  {
    title: "Admin",
    description: "Szybkie wejście na konto zarządzające całym systemem.",
    accounts: [
      { label: "Dariusz", email: "dariusz@emandar.pl", accent: "Admin", role: "admin" },
    ],
  },
  {
    title: "Przekazujący Wiedzę",
    description: "Jedno kliknięcie loguje od razu na wybrany profil trenera.",
    accounts: [
      { label: "Jacek", email: "jacek@emandar.pl", accent: "Trener", role: "trainer" },
      { label: "Marcin", email: "marcin@emandar.pl", accent: "Trener", role: "trainer" },
      { label: "Dorota", email: "dorota@emandar.pl", accent: "Trener", role: "trainer" },
      { label: "Asia", email: "asia@emandar.pl", accent: "Trener", role: "trainer" },
      { label: "Krzysiu", email: "krzysiu@emandar.pl", accent: "Trener", role: "trainer" },
      { label: "Klaudia", email: "klaudia@emandar.pl", accent: "Trener", role: "trainer" },
      { label: "Beata", email: "beata@emandar.pl", accent: "Trener", role: "trainer" },
    ],
  },
  {
    title: "Organizatorzy",
    description: "Konta organizatorów do testowania relacji, wydarzeń i zgłoszeń.",
    accounts: [
      { label: "Karolina", email: "karolina@emandar.pl", accent: "Organizator", role: "organizer" },
      { label: "Marek", email: "marek@emandar.pl", accent: "Organizator", role: "organizer" },
      { label: "Organizator Demo", email: "organizator-demo@emandar.pl", accent: "Organizator", role: "organizer" },
    ],
  },
  {
    title: "Uczestnicy",
    description: "Konta uczestników do testowania własnego dashboardu, archiwum i przenoszenia zapisów.",
    accounts: [
      { label: "Grzegorz Emanowicz", email: "grzegorz.emanowicz@emandar.pl", accent: "Uczestnik", role: "participant" },
      { label: "Grzegorz Chotnicki", email: "grzegorz.chotnicki@emandar.pl", accent: "Uczestnik", role: "participant" },
      { label: "Ola Chotnicka", email: "ola.chotnicka@emandar.pl", accent: "Uczestnik", role: "participant" },
    ],
  },
] as const;

function getPublicOrganizerName(event: TrainingEvent, organizerName?: string, trainerName?: string) {
  if (isSelfManagedTrainingEvent(event)) {
    return firstName(trainerName || event.creatorDisplayName);
  }

  return firstName(organizerName) || "Zespół Emandar";
}

function getPublicOrganizerDescription(
  event: TrainingEvent,
  organizerDescription?: string,
  trainerHeroNote?: string,
) {
  if (isSelfManagedTrainingEvent(event)) {
    return trainerHeroNote ?? "Szczegóły organizacyjne otrzymasz po zgłoszeniu.";
  }

  return organizerDescription || "Szczegóły organizacyjne otrzymasz po zgłoszeniu.";
}

function getPublicLeadName(event: TrainingEvent, trainerName?: string) {
  return trainerName || event.creatorDisplayName || "Gospodarz wydarzenia";
}

function getPublicLeadDescription(event: TrainingEvent, trainerHeroNote?: string) {
  if (trainerHeroNote?.trim()) {
    return trainerHeroNote.trim();
  }

  if (isCommunityBrandStatus(event.brandStatus)) {
    return "To wydarzenie społeczności jest prowadzone bezpośrednio przez jego autora.";
  }

  return "Osoba prowadząca skontaktuje się po wysłaniu zgłoszenia.";
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

  if (currentUser.role === "participant") {
    return currentUser.id === event.creatorUserId;
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
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 max-w-3xl">
        <p className="text-base font-semibold uppercase tracking-[0.28em] text-brand-navy sm:text-lg">
          {eyebrow}
        </p>
        <p className="mt-2 text-lg text-brand-muted">
          <span className="text-brand-muted">{title}. </span>
          {description}
        </p>
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

function EventCard({
  eventId,
  showTrainerImage = true,
}: {
  eventId: string;
  showTrainerImage?: boolean;
}) {
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
  const leadName = getPublicLeadName(event, trainer?.displayName);

  return (
    <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
      <div
        className={`grid gap-6 md:items-stretch ${
          showTrainerImage ? "md:grid-cols-[228px_minmax(0,1fr)]" : "md:grid-cols-1"
        }`}
      >
        {showTrainerImage && (
          <div className="relative h-full min-h-[21rem] overflow-hidden rounded-[1.75rem] bg-brand-shell">
            {trainer?.avatarUrl ? (
              <img
                src={trainer.avatarUrl}
                alt={trainer.displayName}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-sky/40 to-white text-4xl font-semibold text-brand-navy">
                {leadName.slice(0, 1)}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/45 to-transparent px-4 py-5 text-white">
              <p className="text-sm uppercase tracking-[0.2em] text-white/75">
                {isCommunityEvent ? "Gospodarz wydarzenia" : "Przekazujący Wiedzę"}
              </p>
              <p className="text-lg font-semibold">{leadName}</p>
            </div>
          </div>
        )}

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
            Przekazujących Wiedzę albo zalogować się do panelu.
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
      description="Znajdz wydarzenie dla siebie i popros o kontakt z osoba prowadzaca lub organizatorem."
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
      eyebrow="Społeczność"
      title="Wydarzenia społeczności"
      description="Przeglądaj otwarte wydarzenia społeczności i poproś o kontakt z osobą prowadzącą."
      emptyTitle="Brak wydarzeń społeczności"
      emptyDescription="Po opublikowaniu nowych wydarzeń pojawią się właśnie tutaj."
      events={events}
    />
  );
}

export function EventDetailsPage() {
  const { eventId } = useParams();
  const { currentUser, ensurePhoneParticipantProfileForFlow, store, submitEnrollment } =
    useAppState();
  const navigate = useNavigate();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const event = store.trainingEvents.find((item) => item.id === eventId);
  const trainer = store.trainers.find((item) => item.id === event?.trainerId);
  const organizer = store.organizers.find((item) => item.id === event?.organizerId);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsDialogStage, setSmsDialogStage] = useState<"verify" | "success">("verify");
  const [smsVerified, setSmsVerified] = useState(
    Boolean(firebaseAuth?.currentUser?.phoneNumber),
  );
  const [form, setForm] = useState({
    imieNazwisko: "",
    telefon: firebaseAuth?.currentUser?.phoneNumber ?? "",
    polecenieOdKogo: "",
    wiadomosc: "",
    photoFile: null as File | null,
  });

  if (!event) {
    return <Navigate to="/kalendarz" replace />;
  }

  if (isTrainingEventArchived(event)) {
    return <Navigate to="/kalendarz" replace />;
  }

  const scheduleRows = getScheduleRows(event);
  const scheduleRangeLabel = getScheduleRangeLabel(event);
  const eventStatus = resolveTrainingEventStatus(event.status);
  const isCancelled = eventStatus === "cancelled";
  const eventTags = getEventTags(event);
  const canManage = canManagePublicEvent(event, currentUser);
  const photoRequired = isEnrollmentPhotoRequiredForEvent(event, trainer, organizer);
  const leadName = getPublicLeadName(event, trainer?.displayName);
  const leadDescription = getPublicLeadDescription(event, trainer?.heroNote);
  const returnPath = "/panel/dashboard";

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  function handleFileChange(fileEvent: ChangeEvent<HTMLInputElement>) {
    const nextFile = fileEvent.target.files?.[0] ?? null;
    setForm((current) => ({
      ...current,
      photoFile: nextFile,
    }));
  }

  function handleSmsDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setIsSmsDialogOpen(true);
      return;
    }

    setIsSmsDialogOpen(false);

    if (smsDialogStage === "success") {
      navigate(returnPath);
    }
  }

  function handleSuccessReturn() {
    setIsSmsDialogOpen(false);
    navigate(returnPath);
  }

  function validateEnrollmentForm() {
    if (!form.imieNazwisko.trim()) {
      throw new Error("Podaj imię i nazwisko.");
    }

    normalizePhoneNumberForSms(form.telefon);

    if (photoRequired && !form.photoFile) {
      throw new Error("Dodaj zdjęcie twarzy.");
    }
  }

  async function submitEnrollmentRequest(phoneOverride?: string) {
    setLoading(true);

    try {
      await submitEnrollment({
        eventId: event.id,
        imieNazwisko: form.imieNazwisko,
        telefon: phoneOverride ?? form.telefon,
        polecenieOdKogo: form.polecenieOdKogo,
        wiadomosc: form.wiadomosc,
        photoFile: form.photoFile,
      });
      toast.success(
        photoRequired
          ? "Zgłoszenie i zdjęcie zostały zapisane."
          : "Zgłoszenie zostało zapisane.",
      );
      setVerificationCode("");
      setConfirmationResult(null);
      setSmsDialogStage("success");
      setIsSmsDialogOpen(true);
      setForm({
        imieNazwisko: "",
        telefon: firebaseAuth?.currentUser?.phoneNumber ?? "",
        polecenieOdKogo: "",
        wiadomosc: "",
        photoFile: null,
      });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się wysłać zgłoszenia.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCode() {
    if (!firebaseAuth) {
      toast.error("Firebase Auth nie jest skonfigurowany.");
      return;
    }

    setSendingCode(true);

    try {
      const normalizedPhone = normalizePhoneNumberForSms(form.telefon);
      if (!recaptchaRef.current) {
        recaptchaRef.current = createRecaptchaVerifier("enrollment-phone-recaptcha");
      }

      const result = await signInWithPhoneNumber(
        firebaseAuth,
        normalizedPhone,
        recaptchaRef.current,
      );

      setForm((current) => ({
        ...current,
        telefon: normalizedPhone,
      }));
      setSmsDialogStage("verify");
      setVerificationCode("");
      setConfirmationResult(result);
      setSmsVerified(false);
      setIsSmsDialogOpen(true);
      toast.success("Kod SMS został wysłany.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się wysłać kodu SMS.",
      );
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSendingCode(false);
    }
  }

  async function handleConfirmCode() {
    if (!confirmationResult) {
      toast.error("Najpierw wyślij kod SMS.");
      return;
    }

    setConfirmingCode(true);

    try {
      const result = await confirmationResult.confirm(verificationCode.trim());
      const confirmedPhone = result.user.phoneNumber ?? form.telefon;
      await ensurePhoneParticipantProfileForFlow(event.trainerId ?? undefined);

      setForm((current) => ({
        ...current,
        telefon: confirmedPhone,
      }));
      setSmsVerified(true);
      setVerificationCode("");
      toast.success("Numer telefonu został potwierdzony.");
      await submitEnrollmentRequest(confirmedPhone);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się potwierdzić kodu SMS.",
      );
    } finally {
      setConfirmingCode(false);
    }
  }

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();

    try {
      validateEnrollmentForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Uzupełnij wymagane pola formularza.",
      );
      return;
    }

    if (smsVerified) {
      await ensurePhoneParticipantProfileForFlow(event.trainerId ?? undefined);
      await submitEnrollmentRequest();
      return;
    }

    setIsSmsDialogOpen(true);
    await handleSendCode();
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

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-brand-line bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-sky-deep">
                {isCommunityBrandStatus(event.brandStatus)
                  ? "Gospodarz wydarzenia"
                  : "Przekazujący Wiedzę"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-brand-navy">
                {leadName}
              </p>
              <p className="mt-2 text-brand-muted">{leadDescription}</p>
            </div>
            <div className="rounded-3xl border border-brand-line bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-sky-deep">
                Organizator
              </p>
              <p className="mt-2 text-2xl font-semibold text-brand-navy">
                {getPublicOrganizerName(event, organizer?.displayName, leadName)}
              </p>
              <p className="mt-2 text-brand-muted">
                {getPublicOrganizerDescription(
                  event,
                  organizer?.description,
                  trainer?.heroNote,
                )}
              </p>
            </div>
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
          <p className="mt-3 text-brand-muted">
            Zgłoszenie trafi do Przekazującego Wiedzę
            {organizer ? " i organizatora." : "."}{" "}
            {photoRequired
              ? "Zdjęcie jest wymagane i trafia do Firebase Storage tylko dla uprawnionych osób."
              : "Zdjęcie jest opcjonalne. Jeśli je dodasz, będzie widoczne tylko dla uprawnionych osób."}
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
              disabled={smsVerified}
              onChange={(event) => {
                setSmsDialogStage("verify");
                setConfirmationResult(null);
                setVerificationCode("");
                setForm((current) => ({
                  ...current,
                  telefon: event.target.value,
                }));
              }}
              placeholder="Numer telefonu"
              className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
            />
            <div id="enrollment-phone-recaptcha" className="sr-only" />
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
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="text-sm"
              />
              <span className="text-sm text-brand-muted">
                {form.photoFile
                  ? `Wybrany plik: ${form.photoFile.name}`
                  : photoRequired
                    ? "Wymagane: JPG, PNG albo WEBP"
                    : "Opcjonalne: JPG, PNG albo WEBP"}
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
                organizer
                  ? "Napisz wiadomość do Przekazującego Wiedzę i organizatora"
                  : "Napisz wiadomość do osoby prowadzącej"
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
      <Dialog open={isSmsDialogOpen} onOpenChange={handleSmsDialogOpenChange}>
        <DialogContent className="max-w-md rounded-[2rem] border-brand-line p-0">
          <div className="bg-white p-6 sm:p-7">
            <DialogHeader className="text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                {smsDialogStage === "success" ? "Zgłoszenie wysłane" : "Weryfikacja SMS"}
              </p>
              <DialogTitle className="text-2xl font-semibold text-brand-navy">
                {smsDialogStage === "success"
                  ? "Zgłoszenie zostało przekazane"
                  : "Potwierdź zgłoszenie kodem SMS"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-brand-muted">
                {smsDialogStage === "success"
                  ? "Organizator dostał Twoje zgłoszenie, dostaniesz sms lub telefon z potwierdzeniem zapisu na szkolenie."
                  : sendingCode
                  ? "Wysyłamy kod SMS na podany numer telefonu. Poczekaj chwilę."
                  : confirmationResult
                    ? (
                        <>
                          Wpisz kod wysłany na numer{" "}
                          <span className="font-semibold text-brand-navy">{form.telefon}</span>.
                          Po potwierdzeniu od razu wyślemy zgłoszenie.
                        </>
                      )
                    : "Jeśli kod nie dotarł albo wysyłka się nie powiodła, możesz spróbować ponownie z tego okna."}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-4">
              {smsDialogStage === "success" ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSuccessReturn}
                    className="inline-flex items-center justify-center rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
                  >
                    Przejdź do Mojej przestrzeni
                  </button>
                </div>
              ) : sendingCode ? (
                <div className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-6 text-center text-sm font-semibold text-brand-navy">
                  Wysyłanie kodu SMS...
                </div>
              ) : confirmationResult ? (
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="Kod z SMS"
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              ) : (
                <div className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-6 text-sm text-brand-muted">
                  Kod nie jest jeszcze gotowy do potwierdzenia.
                </div>
              )}
              {smsDialogStage === "verify" ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSmsDialogOpen(false)}
                    className="inline-flex items-center justify-center rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
                  >
                    Wróć do formularza
                  </button>
                  <button
                    type="button"
                    disabled={sendingCode}
                    onClick={() => void handleSendCode()}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                  >
                    Wyślij kod ponownie
                    <Phone size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={
                      sendingCode ||
                      !confirmationResult ||
                      confirmingCode ||
                      verificationCode.trim().length === 0 ||
                      loading
                    }
                    onClick={() => void handleConfirmCode()}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {confirmingCode || loading ? "Potwierdzanie..." : "Potwierdź kod"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function CommunityEventReviewPage() {
  const { token } = useParams();
  const { getCommunityEventReview, reviewCommunityEvent } = useAppState();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewLoaded, setReviewLoaded] = useState<{
    event: TrainingEvent;
    creatorName: string;
    creatorPhone: string;
  } | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [enableAutoApprove, setEnableAutoApprove] = useState(false);
  const [decision, setDecision] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void getCommunityEventReview(token)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setReviewLoaded({
          event: result.event,
          creatorName: result.creatorName,
          creatorPhone: result.creatorPhone,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Nie udało się wczytać moderacji.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getCommunityEventReview, token]);

  async function handleDecision(nextDecision: "accepted" | "rejected") {
    if (!token) {
      return;
    }

    setSaving(true);
    try {
      await reviewCommunityEvent({
        token,
        decision: nextDecision,
        message: reviewMessage,
        enableAutoApprove,
      });
      setDecision(nextDecision);
      toast.success(
        nextDecision === "accepted"
          ? "Wydarzenie zostało zatwierdzone."
          : "Wydarzenie zostało odrzucone.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się zapisać decyzji.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
          <p className="text-sm text-brand-muted">Ładowanie moderacji wydarzenia...</p>
        </div>
      </section>
    );
  }

  if (!token || !reviewLoaded) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <EmptyState
          title="Link moderacyjny jest nieaktualny"
          description="Ten token nie działa albo wydarzenie zostało już wcześniej rozpatrzone."
        />
      </section>
    );
  }

  const scheduleRows = getScheduleRows(reviewLoaded.event);

  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-sky-deep">
            Moderacja wydarzenia społeczności
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-brand-navy">
            {reviewLoaded.event.location}
          </h1>
          <p className="mt-3 text-lg text-brand-muted">{reviewLoaded.event.summary}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {scheduleRows.map((row) => (
              <div key={row.key} className="rounded-3xl bg-brand-shell p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                  {row.title}
                </p>
                <p className="mt-2 text-brand-navy">{row.label}</p>
                <p className="text-brand-muted">{row.range}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3 text-brand-muted">
            <p>{reviewLoaded.event.description}</p>
            <p>Maks. miejsc: {reviewLoaded.event.capacity}</p>
            <p>Twórca: {reviewLoaded.creatorName}</p>
            <p>Telefon: {reviewLoaded.creatorPhone}</p>
          </div>
        </article>

        <article className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-sky-deep">
            Decyzja admina
          </p>
          {decision ? (
            <div className="mt-6 rounded-3xl bg-brand-shell p-5">
              <p className="text-lg font-semibold text-brand-navy">
                {decision === "accepted" ? "Wydarzenie zatwierdzone" : "Wydarzenie odrzucone"}
              </p>
              <p className="mt-2 text-brand-muted">
                Decyzja została już zapisana. Twórca otrzyma SMS z informacją zwrotną.
              </p>
            </div>
          ) : (
            <>
              <label className="mt-6 grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">
                  Komentarz dla twórcy
                </span>
                <textarea
                  rows={6}
                  value={reviewMessage}
                  onChange={(event) => setReviewMessage(event.target.value)}
                  className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="mt-5 flex items-start gap-3 rounded-3xl border border-brand-line bg-brand-shell p-4 text-brand-navy">
                <input
                  type="checkbox"
                  checked={enableAutoApprove}
                  onChange={(event) => setEnableAutoApprove(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-semibold">
                    Akceptuj automatycznie kolejne wydarzenia tej osoby
                  </span>
                  <span className="text-sm text-brand-muted">
                    Włączy auto-akceptację przyszłych wydarzeń społeczności tego autora.
                  </span>
                </span>
              </label>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDecision("accepted")}
                  className="inline-flex items-center justify-center rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Zapisywanie..." : "Zatwierdzam"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDecision("rejected")}
                  className="inline-flex items-center justify-center rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                >
                  Odrzucam
                </button>
              </div>
            </>
          )}
        </article>
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
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 max-w-2xl">
        <p className="text-base font-semibold uppercase tracking-[0.28em] text-brand-navy sm:text-lg">
          Przekazujący Wiedzę
        </p>
        <p className="mt-2 text-lg text-brand-muted">
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
    return <Navigate to="/trenerzy" replace />;
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
            publicEvents.map((event) => (
              <EventCard key={event.id} eventId={event.id} showTrainerImage={false} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function normalizePhoneNumberForSms(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Podaj numer telefonu.");
  }

  if (trimmed.startsWith("+")) {
    const normalized = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    if (normalized.length < 10) {
      throw new Error("Podaj poprawny numer telefonu.");
    }
    return normalized;
  }

  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 9) {
    return `+48${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("48")) {
    return `+${digits}`;
  }

  if (trimmed.startsWith("00") && digits.length > 2) {
    return `+${digits.slice(2)}`;
  }

  if (digits.length >= 10) {
    return `+${digits}`;
  }

  throw new Error("Podaj poprawny numer telefonu.");
}

function createRecaptchaVerifier(containerId: string) {
  if (!firebaseAuth) {
    throw new Error("Firebase Auth nie jest skonfigurowany.");
  }

  return new RecaptchaVerifier(firebaseAuth, containerId, {
    size: "invisible",
  });
}

function SmsLoginScreen() {
  const { authReady, currentUser, ensurePhoneParticipantProfileForFlow, getRoleHomePath, signIn } =
    useAppState();
  const navigate = useNavigate();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const [quickLoginEmail, setQuickLoginEmail] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  if (currentUser) {
    return <Navigate to={getRoleHomePath(currentUser.role)} replace />;
  }

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firebaseAuth) {
      toast.error("Firebase Auth nie jest skonfigurowany.");
      return;
    }

    setSendingCode(true);

    try {
      const normalizedPhone = normalizePhoneNumberForSms(phone);
      if (!recaptchaRef.current) {
        recaptchaRef.current = createRecaptchaVerifier("login-phone-recaptcha");
      }

      const result = await signInWithPhoneNumber(
        firebaseAuth,
        normalizedPhone,
        recaptchaRef.current,
      );

      setPhone(normalizedPhone);
      setConfirmationResult(result);
      toast.success("Kod SMS został wysłany.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się wysłać kodu SMS.",
      );
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSendingCode(false);
    }
  }

  async function handleConfirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!confirmationResult) {
      toast.error("Najpierw wyślij kod SMS.");
      return;
    }

    setConfirmingCode(true);

    try {
      const result = await confirmationResult.confirm(verificationCode.trim());
      let appUser;
      try {
        appUser = await fetchAppUser(result.user.uid);
      } catch {
        await ensurePhoneParticipantProfileForFlow();
        appUser = await fetchAppUser(result.user.uid);
      }
      toast.success("Zalogowano do panelu.");
      navigate(getRoleHomePath(appUser.role));
    } catch (error) {
      if (firebaseAuth?.currentUser?.uid) {
        try {
          const appUser = await fetchAppUser(firebaseAuth.currentUser.uid);
          toast.success("Zalogowano do panelu.");
          navigate(getRoleHomePath(appUser.role));
          return;
        } catch {
          try {
            await ensurePhoneParticipantProfileForFlow();
            const appUser = await fetchAppUser(firebaseAuth.currentUser.uid);
            toast.success("Utworzono konto uczestnika i zalogowano do panelu.");
            navigate(getRoleHomePath(appUser.role));
            return;
          } catch {
            toast.error("Nie udało się dokończyć tworzenia konta uczestnika.");
            return;
          }
        }
      }

      toast.error(
        error instanceof Error ? error.message : "Nie udało się potwierdzić kodu SMS.",
      );
    } finally {
      setConfirmingCode(false);
    }
  }

  async function handleQuickLogin(
    emailToUse: string,
    targetRole: "admin" | "trainer" | "organizer" | "participant",
  ) {
    setQuickLoginEmail(emailToUse);

    try {
      const user = await signIn(emailToUse, demoLoginPassword);
      const nextRole =
        user.role !== targetRole && user.roles.includes(targetRole) ? targetRole : user.role;

      if (user.role !== targetRole && user.roles.includes(targetRole)) {
        await updateActiveRoleAction(user, targetRole);
      }
      toast.success(`Zalogowano jako ${emailToUse}.`);
      navigate(getRoleHomePath(nextRole));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zalogować kontem demo.",
      );
    } finally {
      setQuickLoginEmail(null);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
            Logowanie SMS
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-brand-navy">
            Wejście do aplikacji tylko numerem telefonu
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-muted">
            Podaj numer telefonu, potwierdź kod SMS i gotowe. To jest główny sposób
            logowania dla wszystkich zwykłych użytkowników.
          </p>

          <form onSubmit={handleSendCode} className="mt-8 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Numer telefonu</span>
              <input
                required
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+48 500 600 700"
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={sendingCode || !authReady}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {sendingCode ? "Wysyłanie kodu..." : "Wyślij kod SMS"}
              <Phone size={16} />
            </button>
          </form>

          <div id="login-phone-recaptcha" />

          <form onSubmit={handleConfirmCode} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Kod z SMS</span>
              <input
                required
                inputMode="numeric"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                placeholder="123456"
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!confirmationResult || confirmingCode}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
              >
                {confirmingCode ? "Potwierdzanie..." : "Potwierdź i wejdź"}
                <ArrowRight size={16} />
              </button>
              <Link
                to="/rejestracja"
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-6 py-3.5 text-sm font-semibold text-brand-navy"
              >
                Załóż nowe konto
              </Link>
            </div>
          </form>

          <div className="mt-8 rounded-3xl border border-brand-line bg-brand-shell p-5 text-sm text-brand-muted">
            <div className="flex items-center gap-2 font-semibold text-brand-navy">
              <ShieldCheck size={16} />
              Konta demo
            </div>
            <p className="mt-2">
              Istniejące konta mailowe zostają tylko dla demo. Poniżej nadal możesz
              wejść nimi jednym kliknięciem.
            </p>
          </div>
        </div>

        <aside className="rounded-[2.5rem] border border-brand-line bg-white p-6 shadow-soft">
          <div className="flex items-center gap-2 text-brand-navy">
            <Sparkles size={18} />
            <p className="text-sm font-semibold uppercase tracking-[0.25em]">
              Szybkie logowanie
            </p>
          </div>
          <p className="mt-3 text-sm text-brand-muted">
            Konta demo logują się jednym kliknięciem tym samym hasłem systemowym.
          </p>

          <div className="mt-6 space-y-5">
            {demoLoginSections.map((section) => (
              <section
                key={section.title}
                className="rounded-3xl border border-brand-line bg-brand-shell p-4"
              >
                <h2 className="text-sm font-semibold text-brand-navy">{section.title}</h2>
                <p className="mt-1 text-xs leading-5 text-brand-muted">
                  {section.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {section.accounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      disabled={!authReady || sendingCode || quickLoginEmail !== null}
                      onClick={() => void handleQuickLogin(account.email, account.role)}
                      className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:border-brand-navy disabled:opacity-60"
                    >
                      <span>{account.label}</span>
                      <span className="rounded-full bg-brand-shell px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-brand-muted">
                        {quickLoginEmail === account.email ? "Logowanie..." : account.accent}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function SmsRegisterScreen() {
  const {
    currentUser,
    ensurePhoneParticipantProfileForFlow,
    getRoleHomePath,
    store,
    submitAccountRequest,
  } = useAppState();
  const navigate = useNavigate();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const searchParams =
    typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const participantSignup = searchParams.get("role") === "participant";
  const enrollmentSource = searchParams.get("source") === "enrollment";
  const prefetchedPhone =
    typeof window === "undefined" ? "" : searchParams.get("phone") ?? "";
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const [checkingExistingAccount, setCheckingExistingAccount] = useState(false);
  const [stayOnRegistrationFlow, setStayOnRegistrationFlow] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [smsVerified, setSmsVerified] = useState(
    Boolean(firebaseAuth?.currentUser && !firebaseAuth.currentUser.isAnonymous),
  );
  const [form, setForm] = useState({
    displayName: "",
    phone: prefetchedPhone,
    requestedRoles: participantSignup
      ? (["participant"] as Array<"trainer" | "organizer" | "participant">)
      : ([] as Array<"trainer" | "organizer" | "participant">),
    notes: "",
    organizerTrainingIntent: "",
    selectedTrainerIds: [] as string[],
    avatarFile: null as File | null,
  });
  const officialTrainers = useMemo(
    () => store.trainers.filter((trainer) => !isCommunityBrandStatus(trainer.brandStatus)),
    [store.trainers],
  );

  useEffect(() => {
    if (firebaseAuth?.currentUser && !firebaseAuth.currentUser.isAnonymous) {
      setSmsVerified(true);
      if (firebaseAuth.currentUser.phoneNumber) {
        setForm((current) => ({
          ...current,
          phone: firebaseAuth.currentUser?.phoneNumber ?? current.phone,
        }));
      }
    }

    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  if (currentUser && !checkingExistingAccount && !stayOnRegistrationFlow) {
    return <Navigate to={getRoleHomePath(currentUser.role)} replace />;
  }

  function toggleTrainer(trainerId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      selectedTrainerIds: checked
        ? Array.from(new Set([...current.selectedTrainerIds, trainerId]))
        : current.selectedTrainerIds.filter((item) => item !== trainerId),
    }));
  }

  function toggleRole(
    role: "trainer" | "organizer" | "participant",
    checked: boolean,
  ) {
    setForm((current) => ({
      ...current,
      requestedRoles: checked
        ? Array.from(new Set([...current.requestedRoles, role]))
        : current.requestedRoles.filter((item) => item !== role),
      organizerTrainingIntent:
        role === "organizer" && !checked ? "" : current.organizerTrainingIntent,
    }));
  }

  async function handleSendCode() {
    if (!firebaseAuth) {
      toast.error("Firebase Auth nie jest skonfigurowany.");
      return;
    }

    setSendingCode(true);

    try {
      const normalizedPhone = normalizePhoneNumberForSms(form.phone);
      if (!recaptchaRef.current) {
        recaptchaRef.current = createRecaptchaVerifier("register-phone-recaptcha");
      }

      const result = await signInWithPhoneNumber(
        firebaseAuth,
        normalizedPhone,
        recaptchaRef.current,
      );

      setForm((current) => ({
        ...current,
        phone: normalizedPhone,
      }));
      setConfirmationResult(result);
      toast.success("Kod SMS został wysłany.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się wysłać kodu SMS.",
      );
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSendingCode(false);
    }
  }

  async function handleConfirmCode() {
    if (!confirmationResult) {
      toast.error("Najpierw wyślij kod SMS.");
      return;
    }

    setConfirmingCode(true);

    try {
      setCheckingExistingAccount(true);
      const result = await confirmationResult.confirm(verificationCode.trim());
      const confirmedPhone = result.user.phoneNumber ?? form.phone;
      await ensurePhoneParticipantProfileForFlow();
      const appUser = await fetchAppUser(result.user.uid);

      setForm((current) => ({
        ...current,
        displayName: current.displayName || appUser.displayName || "",
        phone: confirmedPhone,
        selectedTrainerIds:
          current.selectedTrainerIds.length > 0
            ? current.selectedTrainerIds
            : appUser.selectedTrainerIds ?? [],
        requestedRoles: current.requestedRoles.includes("participant")
          ? current.requestedRoles
          : (["participant", ...current.requestedRoles] as Array<
              "trainer" | "organizer" | "participant"
            >),
      }));

      setStayOnRegistrationFlow(true);
      setSmsVerified(true);
      toast.success("Numer telefonu został potwierdzony. Dokończ onboarding konta.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się potwierdzić kodu SMS.",
      );
    } finally {
      setCheckingExistingAccount(false);
      setConfirmingCode(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!smsVerified) {
      toast.error("Najpierw potwierdź numer telefonu kodem SMS.");
      return;
    }

    setLoading(true);

    try {
      if (form.requestedRoles.length === 0) {
        toast.error("Wybierz przynajmniej jeden typ konta.");
        return;
      }

      await submitAccountRequest({
        displayName: form.displayName,
        phone: form.phone,
        requestedRoles: form.requestedRoles,
        notes: form.notes,
        avatarFile: form.avatarFile,
        organizerTrainingIntent: form.organizerTrainingIntent,
        selectedTrainerIds: form.selectedTrainerIds,
      });
      navigate("/panel/dashboard");
      toast.success("Onboarding został zapisany.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się utworzyć konta.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
          Rejestracja
        </p>
        <p className="mt-4 max-w-3xl text-lg text-brand-muted">
          Najpierw potwierdzasz numer telefonu, a potem uzupełniasz profil uczestnika i,
          jeśli chcesz, prosisz o rolę organizatora grup Emandar.
        </p>
        {enrollmentSource && (
          <p className="mt-3 max-w-3xl rounded-3xl border border-brand-line bg-brand-shell px-4 py-3 text-sm text-brand-muted">
            Jeśli wcześniej wysłałeś lub wysłałaś prośbę o kontakt do szkolenia na ten sam numer,
            po założeniu konta zgłoszenie pojawi się automatycznie w Twoich szkoleniach.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Imię i nazwisko</span>
              <input
                required
                autoComplete="name"
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
              <span className="text-sm font-semibold text-brand-navy">Numer telefonu</span>
              <input
                required
                autoComplete="tel"
                value={form.phone}
                disabled={smsVerified}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="+48 500 600 700"
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
              />
            </label>
          </div>

          <div className="rounded-[2rem] border border-brand-line bg-brand-shell p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                  Weryfikacja SMS
                </p>
                <p className="mt-2 text-sm text-brand-muted">
                  {smsVerified
                    ? "Numer został już potwierdzony."
                    : "Najpierw wyślij kod i potwierdź numer telefonu."}
                </p>
              </div>
              {!smsVerified && (
                <button
                  type="button"
                  disabled={sendingCode}
                  onClick={() => void handleSendCode()}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {sendingCode ? "Wysyłanie..." : "Wyślij kod SMS"}
                  <Phone size={16} />
                </button>
              )}
            </div>

            {!smsVerified && (
              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="Kod z SMS"
                  className="rounded-2xl border border-brand-line bg-white px-4 py-3.5 text-brand-navy outline-none"
                />
                <button
                  type="button"
                  disabled={!confirmationResult || confirmingCode}
                  onClick={() => void handleConfirmCode()}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                >
                  {confirmingCode ? "Potwierdzanie..." : "Potwierdź kod"}
                </button>
              </div>
            )}
            <div id="register-phone-recaptcha" />
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">Zakres konta</span>
            <div className="grid gap-3 rounded-[2rem] border border-brand-line bg-brand-shell p-4 text-brand-navy">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.requestedRoles.includes("participant")}
                  onChange={(event) => toggleRole("participant", event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-semibold">Uczestnik</span>
                  <span className="text-sm text-brand-muted">
                    Widzisz swoje zgłoszenia i szkolenia, także zanim trener potwierdzi konto.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.requestedRoles.includes("organizer")}
                  onChange={(event) => toggleRole("organizer", event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-semibold">Organizator grup Emandar</span>
                  <span className="text-sm text-brand-muted">
                    Po akceptacji konta i relacji z trenerem możesz organizować oficjalne szkolenia.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {form.requestedRoles.includes("organizer") && (
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">
                Jakie szkolenia chcesz organizować?
              </span>
              <textarea
                required
                rows={4}
                value={form.organizerTrainingIntent}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    organizerTrainingIntent: event.target.value,
                  }))
                }
                className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>
          )}

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">
              Do czyjej grupy chodzisz?
            </span>
            <div className="grid gap-3 rounded-[2rem] border border-brand-line bg-brand-shell p-4">
              {officialTrainers.length === 0 && (
                <p className="text-sm text-brand-muted">
                  Brak dostępnych trenerów do wyboru. Dodaj najpierw widoczne profile
                  trenerów w danych aplikacji.
                </p>
              )}
              {officialTrainers.map((trainer) => (
                <label key={trainer.id} className="flex items-start gap-3 text-brand-navy">
                  <input
                    type="checkbox"
                    checked={form.selectedTrainerIds.includes(trainer.id)}
                    onChange={(event) => toggleTrainer(trainer.id, event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border border-brand-line accent-brand-navy"
                  />
                  <span className="grid gap-1">
                    <span className="text-sm font-semibold">{trainer.displayName}</span>
                    <span className="text-sm text-brand-muted">{trainer.heroNote}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-sm text-brand-muted">
              Wystarczy jedna akceptacja od wybranego trenera, żeby konto zostało potwierdzone.
            </p>
          </label>

          <label className="grid gap-3 rounded-[2rem] border border-dashed border-brand-line bg-brand-shell px-4 py-4 text-brand-navy">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <ImagePlus size={16} />
              Zdjęcie profilowe {store.appSettings.signupPhotoRequired ? "(wymagane)" : "(opcjonalne)"}
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
              {form.avatarFile
                ? `Wybrany plik: ${form.avatarFile.name}`
                : "JPG, PNG albo WEBP do 5 MB"}
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">Kilka słów o sobie</span>
            <textarea
              required
              rows={6}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Napisz kilka słów o sobie i czego szukasz w grupie lub najbliższych szkoleniach."
              className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={loading || !smsVerified}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
          >
            {loading
              ? "Zapisywanie profilu..."
              : "Zapisz profil i przejdź do panelu"}
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}

export function LoginPage() {
  return <SmsLoginScreen />;
}

function LoginPageLegacyUnused() {
  const { authReady, currentUser, getRoleHomePath, signIn } = useAppState();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickLoginEmail, setQuickLoginEmail] = useState<string | null>(null);

  if (currentUser) {
    return <Navigate to={getRoleHomePath(currentUser.role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const user = await signIn(email, password);
      toast.success("Zalogowano do panelu.");
      navigate(getRoleHomePath(user.role));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zalogować.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickLogin(
    emailToUse: string,
    targetRole: "admin" | "trainer" | "organizer" | "participant",
  ) {
    setQuickLoginEmail(emailToUse);

    try {
      const user = await signIn(emailToUse, demoLoginPassword);
      const nextRole =
        user.role !== targetRole && user.roles.includes(targetRole) ? targetRole : user.role;

      if (user.role !== targetRole && user.roles.includes(targetRole)) {
        await updateActiveRoleAction(user, targetRole);
      }
      toast.success(`Zalogowano jako ${emailToUse}.`);
      navigate(getRoleHomePath(nextRole));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zalogować kontem demo.",
      );
    } finally {
      setQuickLoginEmail(null);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
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
                autoComplete="email"
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
                autoComplete="current-password"
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
              Potwierdź numer telefonu, wybierz trenerów, do których chodzisz na grupę,
              i załóż konto uczestnika, organizatora albo społeczności.
            </p>
            <Link
              to="/rejestracja"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 font-semibold text-brand-navy"
            >
              Utwórz konto
              <ArrowRight size={14} />
            </Link>
          </div>
        </form>

        <aside className="rounded-[2.5rem] border border-brand-line bg-white p-6 shadow-soft">
          <div className="flex items-center gap-2 text-brand-navy">
            <Sparkles size={18} />
            <p className="text-sm font-semibold uppercase tracking-[0.25em]">
              Szybkie logowanie
            </p>
          </div>
          <p className="mt-3 text-sm text-brand-muted">
            Konta demo logują się jednym kliknięciem tym samym hasłem systemowym.
          </p>

          <div className="mt-6 space-y-5">
            {demoLoginSections.map((section) => (
              <section
                key={section.title}
                className="rounded-3xl border border-brand-line bg-brand-shell p-4"
              >
                <h2 className="text-sm font-semibold text-brand-navy">{section.title}</h2>
                <p className="mt-1 text-xs leading-5 text-brand-muted">
                  {section.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {section.accounts.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      disabled={!authReady || loading || quickLoginEmail !== null}
                      onClick={() => void handleQuickLogin(account.email, account.role)}
                      className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-navy transition hover:border-brand-navy disabled:opacity-60"
                    >
                      <span>{account.label}</span>
                      <span className="rounded-full bg-brand-shell px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-brand-muted">
                        {quickLoginEmail === account.email ? "Logowanie..." : account.accent}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

export function RegisterPage() {
  return <SmsRegisterScreen />;
}

function RegisterPageLegacyUnused() {
  const { currentUser, getRoleHomePath, submitAccountRequest } = useAppState();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    requestedRoles: ["organizer"] as Array<"trainer" | "organizer">,
    notes: "",
    password: "",
    confirmPassword: "",
  });

  if (currentUser) {
    return <Navigate to={getRoleHomePath(currentUser.role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      if (form.requestedRoles.length === 0) {
        toast.error("Wybierz przynajmniej jeden zakres działania.");
        return;
      }

      if (form.password.length < 6) {
        toast.error("Hasło musi mieć przynajmniej 6 znaków.");
        return;
      }

      if (form.password !== form.confirmPassword) {
        toast.error("Hasła muszą być identyczne.");
        return;
      }

      await submitAccountRequest({
        displayName: form.displayName,
        email: form.email,
        phone: form.phone,
        requestedRoles: form.requestedRoles,
        notes: form.notes,
        password: form.password,
      });
      toast.success("Konto zostało utworzone. Możesz się zalogować.");
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
              name="name"
              autoComplete="name"
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
              name="email"
              autoComplete="email"
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
              name="tel"
              autoComplete="tel"
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

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Hasło</span>
              <input
                required
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={6}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Powtórz hasło</span>
              <input
                required
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={6}
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </label>
          </div>

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
