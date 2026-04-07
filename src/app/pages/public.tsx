import { Fragment, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type {
  AppUser,
  DemoStore,
  EmandarBrandStatus,
  EnrollmentIntent,
  TrainingEvent,
  TrainingEventImage,
} from "@/domain/types";
import {
  confirmSmsCode,
  fetchAppUser,
  getCurrentSessionPhone,
  requestSmsCode,
} from "@/data/mockRepository";
import {
  getParticipantEnrollmentViewRecords,
} from "@/app/dashboard";
import {
  canManageTrainingEvent,
  buildPhoneHref,
  getTrainingEventScheduleBounds,
  getTrainingEventScheduleDays,
  isPhotoModeEnabled,
  isPhotoModeRequired,
  isTrainingEventArchived,
  isSelfManagedTrainingEvent,
  isTrainingEventCollaborationAccepted,
  isCommunityBrandStatus,
  isTrainingEventPubliclyVisible,
  getTrainingJoinAudienceLabel,
  resolveCommunityEventOrganizerPhone,
  resolveEnrollmentPhotoModeForEvent,
  resolveBrandStatus,
  resolveTrainingJoinAudienceForEvent,
  resolveTrainingEventStatus,
  sortEventsByDate,
} from "@/domain/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { AvatarMedia } from "@/app/components/avatar-media";
import { CommunityEventCard } from "@/app/components/community-event-card";
import { useAppState } from "../providers/AppProviders";

const emandarCalendarLogoUrl = `${import.meta.env.BASE_URL}brand-assets/emandar-logo.png`;

type ConfirmationResult = {
  confirm: (code: string) => Promise<{
    user: {
      uid: string;
      phoneNumber: string | null;
    };
  }>;
};

class RecaptchaVerifier {
  clear() {}
}

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

function getEventDurationDaysLabel(event: TrainingEvent) {
  const bounds = getTrainingEventScheduleBounds(event);
  return bounds.dayCount === 1 ? "1 dzień" : `${bounds.dayCount} dni`;
}

function getCompactLocationTitle(location: string) {
  const [primary = location] = location.split("/");
  return primary.trim();
}

function getCompactCommunityEventTitle(title: string | null | undefined, location: string) {
  const normalizedTitle = title?.trim();
  if (!normalizedTitle) {
    return location;
  }

  const [primaryLocation = ""] = location.split("/");
  const normalizedLocation = primaryLocation.trim();
  if (!normalizedLocation) {
    return normalizedTitle;
  }

  const escapedLocation = normalizedLocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutDuplicatedLocation = normalizedTitle.replace(
    new RegExp(`^${escapedLocation}\\s*[•\\-:]\\s*`, "i"),
    "",
  );

  return withoutDuplicatedLocation.trim() || normalizedTitle;
}

function firstName(value?: string) {
  if (!value) {
    return "";
  }

  return value.trim().split(/\s+/)[0] ?? "";
}

function hasCompletedParticipantRegistration(user: AppUser | null) {
  if (!user) {
    return false;
  }

  if (user.role !== "participant") {
    return true;
  }

  return typeof user.participantOnboardingCompletedAt === "string";
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
      { label: "Anita", email: "anita@emandar.pl", accent: "Organizator", role: "organizer" },
      { label: "Karolina", email: "karolina@emandar.pl", accent: "Organizator", role: "organizer" },
      { label: "Marek", email: "marek@emandar.pl", accent: "Organizator", role: "organizer" },
      { label: "Organizator Demo", email: "organizator-demo@emandar.pl", accent: "Organizator", role: "organizer" },
    ],
  },
  {
    title: "Uczestnicy",
    description: "Konta uczestników do testowania własnego dashboardu i bieżących szkoleń.",
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

function getPublicLeadName(event: TrainingEvent, trainerName?: string) {
  return trainerName || event.creatorDisplayName || "Gospodarz wydarzenia";
}

function getEventTags(event: TrainingEvent) {
  return (event.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
}

function getTrainingJoinAudienceBadgeText(value: "existing-practitioners" | "new-people") {
  return getTrainingJoinAudienceLabel(value);
}

function getTrainingJoinAudienceBadgeClassName(value: "existing-practitioners" | "new-people") {
  return value === "existing-practitioners"
    ? "border border-violet-200 bg-violet-50 text-violet-800"
    : "border border-emerald-200 bg-emerald-50 text-emerald-800";
}

function canManagePublicEvent(event: TrainingEvent, currentUser: AppUser | null) {
  return currentUser ? canManageTrainingEvent(event, currentUser) : false;
}

function isOfficialTrainerProfile(
  status: EmandarBrandStatus | undefined,
) {
  return resolveBrandStatus(status) === "official";
}

function getPublicEventCollection(store: Pick<DemoStore, "publicTrainingEvents" | "trainingEvents">) {
  return store.publicTrainingEvents.length > 0 ? store.publicTrainingEvents : store.trainingEvents;
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

function EmandarTrainingBadge({ className = "" }: { className?: string }) {
  return (
    <img
      src={emandarCalendarLogoUrl}
      alt="Emandar"
      className={["h-11 w-11 object-contain drop-shadow-[0_8px_18px_rgba(12,63,128,0.35)]", className].join(" ")}
    />
  );
}

function getEventImagePreviewWidth(image: TrainingEventImage, height = 112) {
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 1;
  return Math.max(88, Math.round(height * ratio));
}

function PublicDetailEyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={[
        "text-sm font-semibold uppercase tracking-[0.25em] text-brand-sky-deep",
        className,
      ].join(" ")}
    >
      {children}
    </p>
  );
}

function getCommunityEventCoverImageIndex(
  event: Pick<TrainingEvent, "eventImages" | "useEventImageAsCover">,
) {
  return event.useEventImageAsCover === true && (event.eventImages?.length ?? 0) > 0 ? 0 : null;
}

function getCommunityEventImageAlt(eventTitle: string, index: number) {
  return `${eventTitle} zdjęcie ${index + 1}`;
}

function CommunityEventGalleryThumbnail({
  image,
  alt,
  onClick,
  height = 112,
  width,
  isActive = false,
}: {
  image: TrainingEventImage;
  alt: string;
  onClick: () => void;
  height?: number;
  width?: number;
  isActive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Powiększ ${alt}`}
      className={`group relative shrink-0 overflow-hidden rounded-[1.4rem] border bg-brand-shell text-left shadow-soft transition hover:-translate-y-0.5 ${
        isActive ? "border-brand-navy ring-2 ring-brand-sky/40" : "border-brand-line"
      }`}
      style={{
        height: `${height}px`,
        width: `${width ?? getEventImagePreviewWidth(image, height)}px`,
      }}
    >
      <img
        src={image.url}
        alt={alt}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
      />
      <span className="pointer-events-none absolute inset-0 bg-brand-navy/0 transition group-hover:bg-brand-navy/10" />
    </button>
  );
}

function CommunityEventGalleryLightbox({
  eventTitle,
  images,
  openIndex,
  onOpenIndexChange,
}: {
  eventTitle: string;
  images: TrainingEventImage[];
  openIndex: number | null;
  onOpenIndexChange: (nextIndex: number | null) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (openIndex === null) {
      return;
    }

    setCurrentIndex(Math.max(0, Math.min(images.length - 1, openIndex)));
  }, [images.length, openIndex]);

  useEffect(() => {
    if (openIndex === null || images.length < 2) {
      return;
    }

    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "ArrowLeft") {
        setCurrentIndex((previous) => Math.max(previous - 1, 0));
      }

      if (keyboardEvent.key === "ArrowRight") {
        setCurrentIndex((previous) => Math.min(previous + 1, images.length - 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [images.length, openIndex]);

  const currentImage = images[currentIndex];

  if (!currentImage) {
    return null;
  }

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < images.length - 1;

  return (
    <Dialog
      open={openIndex !== null}
      onOpenChange={(nextOpen) => onOpenIndexChange(nextOpen ? currentIndex : null)}
    >
      <DialogPortal>
        <DialogOverlay className="bg-brand-navy/12 backdrop-blur-[2px]" />

        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,780px)] max-w-none max-h-[92vh] -translate-x-1/2 -translate-y-1/2 outline-none"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Galeria wydarzenia społeczności</DialogTitle>
            <DialogDescription>
              Przeglądaj zdjęcia wydarzenia {eventTitle}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-[1.75rem] border border-white/75 bg-white/96 p-2.5 text-brand-navy shadow-[0_18px_56px_rgba(21,52,105,0.14)] backdrop-blur-xl sm:p-4">
            <div className="mb-2 flex justify-end sm:mb-3">
              <DialogClose className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-line/70 bg-white/90 text-brand-navy shadow-[0_10px_24px_rgba(21,52,105,0.10)] transition hover:bg-white">
                <X size={20} />
                <span className="sr-only">Zamknij galerię</span>
              </DialogClose>
            </div>

            <div className="relative h-[min(44vh,360px)] overflow-hidden rounded-[1.35rem] border border-brand-line/60 bg-[#f7fbff] sm:h-[min(62vh,520px)]">
              <div className="flex h-full w-full items-center justify-center p-3 sm:p-4">
                <img
                  src={currentImage.url}
                  alt={getCommunityEventImageAlt(eventTitle, currentIndex)}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((previous) => Math.max(previous - 1, 0))}
                    disabled={!canGoPrev}
                    aria-label="Poprzednie zdjęcie"
                    className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-brand-navy shadow-[0_8px_20px_rgba(21,52,105,0.10)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 sm:left-4"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((previous) => Math.min(previous + 1, images.length - 1))
                    }
                    disabled={!canGoNext}
                    aria-label="Następne zdjęcie"
                    className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-brand-navy shadow-[0_8px_20px_rgba(21,52,105,0.10)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 sm:right-4"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
                  Galeria wydarzenia
                </p>
                <p className="mt-1 text-base font-semibold text-brand-navy sm:text-lg">{eventTitle}</p>
              </div>
              <span className="rounded-full border border-brand-line/70 bg-white px-3 py-1 text-xs font-semibold text-brand-muted shadow-[0_8px_20px_rgba(21,52,105,0.06)] sm:text-sm">
                {currentIndex + 1} / {images.length}
              </span>
            </div>

            {images.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto px-1 pb-1 sm:mt-3 sm:gap-3">
                {images.map((image, index) => (
                  <CommunityEventGalleryThumbnail
                    key={image.id}
                    image={image}
                    alt={getCommunityEventImageAlt(eventTitle, index)}
                    onClick={() => setCurrentIndex(index)}
                    height={56}
                    width={68}
                    isActive={index === currentIndex}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
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
  const publicEvents = getPublicEventCollection(store);
  const event = publicEvents.find((item) => item.id === eventId);

  if (!event) {
    return null;
  }

  const trainer = store.trainers.find((item) => item.id === event.trainerId);
  const organizer = store.organizers.find((item) => item.id === event.organizerId);
  const eventGroup = event.groupId
    ? store.groups.find((item) => item.id === event.groupId) ?? null
    : null;
  const eventTags = getEventTags(event);
  const scheduleRows = getScheduleRows(event);
  const scheduleRangeLabel = getScheduleRangeLabel(event);
  const scheduleStartLabel = formatDate(getTrainingEventScheduleBounds(event).startsAt);
  const isCommunityEvent = isCommunityBrandStatus(event.brandStatus);
  const eventImages = event.eventImages ?? [];
  const canManage = canManagePublicEvent(event, currentUser);
  const leadName = getPublicLeadName(event, trainer?.displayName);
  const leadAvatarUrl = isCommunityEvent
    ? event.useEventImageAsCover === true
      ? eventImages[0]?.url || event.creatorAvatarUrl
      : event.creatorAvatarUrl
    : trainer?.avatarUrl;
  const managementPath = isCommunityEvent
    ? `/panel/wydarzenia-spolecznosci/${event.id}`
    : `/panel/szkolenia/${event.id}`;
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const compactTitle = isCommunityEvent
    ? getCompactCommunityEventTitle(event.title, event.location)
    : getCompactLocationTitle(event.location);
  const compactLocation = event.location;
  const desktopGroupName = eventGroup?.name?.trim() || event.groupName?.trim() || null;
  const desktopTitle = desktopGroupName || event.location;
  const shouldShowDesktopLocationRow = Boolean(desktopGroupName && event.location.trim());
  const durationDaysLabel = getEventDurationDaysLabel(event);
  const resolvedJoinAudience = resolveTrainingJoinAudienceForEvent(event, eventGroup);
  const joinAudienceBadgeText = getTrainingJoinAudienceBadgeText(resolvedJoinAudience);
  const joinAudienceBadgeClassName = getTrainingJoinAudienceBadgeClassName(resolvedJoinAudience);
  const mobileSummarySchedule = scheduleRows.slice(0, 2);
  const compactTags = eventTags.slice(0, 2);
  const hasMoreCompactTags = eventTags.length > compactTags.length;
  const shouldShowExpandedTagsIndicator = hasMoreCompactTags || isMobileExpanded;

  const mobileCard = (
    <article className="overflow-hidden rounded-[1.75rem] border border-brand-line bg-white shadow-soft md:hidden">
      <button
        type="button"
        onClick={() => setIsMobileExpanded((value) => !value)}
        className="flex w-full items-stretch text-left"
        aria-expanded={isMobileExpanded}
      >
        <div className="relative w-[6.1rem] shrink-0 self-stretch overflow-hidden bg-brand-shell">
          <div className="absolute inset-0 flex items-center justify-center">
            {leadAvatarUrl ? (
              <img
                src={leadAvatarUrl}
                alt={leadName}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-sky/35 to-white text-2xl font-semibold text-brand-navy">
                {leadName.slice(0, 1)}
              </div>
            )}
          </div>
          {!isCommunityEvent ? (
            <EmandarTrainingBadge className="absolute right-2 top-2 z-10" />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy/88 via-brand-navy/52 to-transparent px-2.5 py-2.5 text-white">
            <p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/95">
              {leadName}
            </p>
          </div>
        </div>
        <div className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="break-words pr-1 text-[1.52rem] font-semibold leading-[1.08] text-brand-navy">
                {compactTitle}
              </h3>
            </div>
            <span
              className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-line bg-brand-shell text-brand-navy transition-transform ${
                isMobileExpanded ? "rotate-180" : ""
              }`}
            >
              <ChevronDown size={16} />
            </span>
          </div>
          <div className="mt-2.5 grid gap-1.5 text-sm text-brand-muted">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="shrink-0 text-brand-sky-deep" />
              <span className="min-w-0 truncate">{compactLocation}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-brand-navy">{scheduleStartLabel}</span>
              <span className="rounded-full bg-brand-shell px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-muted">
                {durationDaysLabel}
              </span>
            </div>
            {!isCommunityEvent ? (
              <div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${joinAudienceBadgeClassName}`}
                >
                  {joinAudienceBadgeText}
                </span>
              </div>
            ) : null}
          </div>
          {compactTags.length > 0 && !isMobileExpanded && (
            <div className="mt-3 flex flex-nowrap gap-2 overflow-hidden">
              {compactTags.map((tag) => (
                <span
                  key={`${event.id}-compact-${tag}`}
                  className="truncate rounded-full bg-brand-sky/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-navy"
                >
                  {tag}
                </span>
              ))}
              {shouldShowExpandedTagsIndicator ? (
                <span className="shrink-0 rounded-full bg-brand-sky/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-navy">
                  {isMobileExpanded ? `${eventTags.length} tagów` : "..."}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </button>

      {isMobileExpanded ? (
        <div className="border-t border-brand-line px-3.5 pb-4 pt-4">
          <p className="text-sm leading-6 text-brand-muted">{event.summary}</p>
          <div
            className={`mt-4 grid gap-2 ${
              mobileSummarySchedule.length > 1 ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {mobileSummarySchedule.map((row) => (
              <div
                key={`${event.id}-mobile-${row.key}`}
                className="min-w-0 rounded-2xl bg-brand-shell px-3 py-3 text-sm text-brand-muted"
              >
                <div className="mb-1 flex items-center gap-2 font-semibold text-brand-navy">
                  <CalendarDays size={15} />
                  {row.title}
                </div>
                <p>{row.label}</p>
                <p>{row.range}</p>
              </div>
            ))}
          </div>
          {eventTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {eventTags.map((tag) => (
                <span
                  key={`${event.id}-mobile-expanded-${tag}`}
                  className="rounded-full bg-brand-sky/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-navy"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {!(isCommunityEvent || isSelfManagedTrainingEvent(event)) && (
            <p className="mt-4 text-sm text-brand-muted">
              Organizator:{" "}
              <span className="font-semibold text-brand-navy">
                {getPublicOrganizerName(event, organizer?.displayName, trainer?.displayName)}
              </span>
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {canManage && (
              <Link
                to={managementPath}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy shadow-soft"
              >
                Edytuj
              </Link>
            )}
            <Link
              to={`/kalendarz/${event.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-4 py-3 text-sm font-semibold text-white shadow-soft"
            >
              Chcę wziąć udział
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : null}
    </article>
  );

  if (isCommunityEvent) {
    return <CommunityEventCard event={event} showTrainerImage={showTrainerImage} />;
  }

  return (
    <>
      {mobileCard}
      <article className="hidden overflow-hidden rounded-[2rem] border border-brand-line bg-white shadow-soft md:block">
      <div
        className={`grid md:items-stretch ${
          showTrainerImage
            ? isCommunityEvent
              ? "md:grid-cols-[228px_minmax(0,1fr)]"
              : "md:grid-cols-[252px_minmax(0,1fr)]"
            : "md:grid-cols-1"
        }`}
      >
        {showTrainerImage && (
          <div className="relative h-full min-h-[21rem] overflow-hidden bg-brand-shell">
            {leadAvatarUrl ? (
              <img
                src={leadAvatarUrl}
                alt={leadName}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-sky/40 to-white text-4xl font-semibold text-brand-navy">
                {leadName.slice(0, 1)}
              </div>
            )}
            {!isCommunityEvent ? (
              <EmandarTrainingBadge className="absolute right-3 top-3 z-10" />
            ) : null}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/45 to-transparent px-4 py-5 text-white">
              <p className="text-sm uppercase tracking-[0.2em] text-white/75">
                {isCommunityEvent ? "Gospodarz wydarzenia" : "Przekazujący Wiedzę"}
              </p>
              <p className="text-lg font-semibold">{leadName}</p>
            </div>
          </div>
        )}

        <div className="flex h-full flex-col p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-2xl font-semibold text-brand-navy">
                {isCommunityEvent ? event.title || event.location : desktopTitle}
              </h3>
              {isCommunityEvent && (
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                  {event.location}
                </p>
              )}
              {!isCommunityEvent && shouldShowDesktopLocationRow && (
                <div className="mt-2 flex items-center gap-2 text-sm text-brand-muted">
                  <MapPin size={15} className="shrink-0 text-brand-sky-deep" />
                  <span>{event.location}</span>
                </div>
              )}
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                {scheduleRangeLabel}
              </p>
              <p className="mt-3 line-clamp-2 text-brand-muted">{event.summary}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canManage && (
                <Link
                  to={managementPath}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-soft"
                >
                  Edytuj szkolenie
                </Link>
              )}
              <Link
                to={`/kalendarz/${event.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
              >
                Chcę wziąć udział
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div
            className={`mt-6 grid gap-3 ${
              scheduleRows.length > 1
                ? "grid-cols-2 xl:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
                : "grid-cols-1"
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
          {isCommunityEvent && eventImages.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-4">
              {eventImages.map((image, index) => (
                <img
                  key={image.id}
                  src={image.url}
                  alt={`${event.title || event.location} ${index + 1}`}
                  className="rounded-[1.4rem] border border-brand-line bg-brand-shell object-cover shadow-soft"
                  style={{
                    height: "112px",
                    width: `${Math.max(88, Math.round(112 * (image.width / image.height || 1)))}px`,
                  }}
                />
              ))}
            </div>
          )}
          <div className="mt-auto pt-5">
            {eventTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {!isCommunityEvent ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${joinAudienceBadgeClassName}`}
                  >
                    {joinAudienceBadgeText}
                  </span>
                ) : null}
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
              <div>
                {!isCommunityEvent ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${joinAudienceBadgeClassName}`}
                  >
                    {joinAudienceBadgeText}
                  </span>
                ) : null}
              </div>
            )}
            {!(isCommunityEvent || isSelfManagedTrainingEvent(event)) && (
              <div className="mt-5 text-sm text-brand-muted">
                <div>
                  Organizator:{" "}
                  <span className="font-semibold text-brand-navy">
                    {getPublicOrganizerName(event, organizer?.displayName, trainer?.displayName)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </article>
    </>
  );
}

export function LandingPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-soft">
            <Sparkles size={16} />
            Kalendarz i panel Emandar w trybie prototypowym
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-tight text-brand-navy sm:text-6xl">
            Publiczny kalendarz szkoleń i panel współpracy dla Przekazujących
            Wiedzę oraz organizatorów.
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-brand-muted">
            W tej wersji dane publiczne, logowanie, zgłoszenia i zdjęcia trafiają
            do współdzielonego mock backendu opartego o JSON-y. Możesz przejść do kalendarza, sprawdzić
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
                "Osobny obszar dla admina, Przekazującego Wiedzę i organizatora oparty o mock auth SMS i współdzielony store.",
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
  const publicEvents = getPublicEventCollection(store);
  const events = useMemo(
    () =>
      sortEventsByDate(
        publicEvents.filter(
          (item) =>
            resolveBrandStatus(item.brandStatus) === "official" &&
            isTrainingEventPubliclyVisible(item),
        ),
      ),
    [publicEvents],
  );

  return (
    <EventFeedSection
      eyebrow="Szkolenia Emandar"
      title="Spotkania z Przekazującymi wiedzę"
      emptyTitle="Brak opublikowanych szkoleń"
      emptyDescription="Po dodaniu wydarzeń pojawią się tutaj szkolenia."
      events={events}
    />
  );
}

export function CommunityEventsPage() {
  const { store } = useAppState();
  const publicEvents = getPublicEventCollection(store);
  const events = useMemo(
    () =>
      sortEventsByDate(
        publicEvents.filter(
          (item) =>
            resolveBrandStatus(item.brandStatus) === "supported" &&
            isTrainingEventPubliclyVisible(item),
        ),
      ),
    [publicEvents],
  );

  return (
    <EventFeedSection
      eyebrow="Wydarzenia społeczności"
      title="Wydarzenia społeczności"
      description="Przeglądaj otwarte wydarzenia społeczności i zgłaszaj chęć udziału u osoby prowadzącej."
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
  const publicEvents = getPublicEventCollection(store);
  const event = publicEvents.find((item) => item.id === eventId);
  const trainer = store.trainers.find((item) => item.id === event?.trainerId);
  const organizer = store.organizers.find((item) => item.id === event?.organizerId);
  const participantProfile =
    store.participantProfiles?.find(
      (item) =>
        item.id === currentUser?.participantProfileId ||
        item.linkedUserId === currentUser?.id,
    ) ?? null;
  const participantEnrollmentRecords = useMemo(
    () =>
      getParticipantEnrollmentViewRecords({
        userId: currentUser?.id,
        participantProfileId: participantProfile?.id ?? currentUser?.participantProfileId,
        store,
      }),
    [currentUser?.id, currentUser?.participantProfileId, participantProfile?.id, store],
  );
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsDialogStage, setSmsDialogStage] = useState<"verify" | "success">("verify");
  const [smsVerified, setSmsVerified] = useState(Boolean(currentUser?.phone || getCurrentSessionPhone()));
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
  const [form, setForm] = useState({
    intent: "participating" as EnrollmentIntent,
    imieNazwisko: "",
    telefon: currentUser?.phone ?? getCurrentSessionPhone(),
    polecenieOdKogo: "",
    wiadomosc: "",
    photoFile: null as File | null,
  });
  const [galleryLightboxIndex, setGalleryLightboxIndex] = useState<number | null>(null);

  if (!event) {
    return <Navigate to="/kalendarz" replace />;
  }

  if (isTrainingEventArchived(event)) {
    return <Navigate to="/kalendarz" replace />;
  }

  if (!isTrainingEventPubliclyVisible(event)) {
    return <Navigate to="/kalendarz" replace />;
  }

  const organizerContactPhone = resolveCommunityEventOrganizerPhone(event, store);
  const organizerContactHref = buildPhoneHref(organizerContactPhone);
  const scheduleRows = getScheduleRows(event);
  const shouldCollapseSchedule = scheduleRows.length > 4;
  const middleScheduleRows = shouldCollapseSchedule ? scheduleRows.slice(1, -1) : [];
  const visibleScheduleRows =
    shouldCollapseSchedule && !isScheduleExpanded
      ? [scheduleRows[0], scheduleRows[scheduleRows.length - 1]].filter(Boolean)
      : scheduleRows;
  const eventStatus = resolveTrainingEventStatus(event.status);
  const isCancelled = eventStatus === "cancelled";
  const eventTags = getEventTags(event);
  const canManage = canManagePublicEvent(event, currentUser);
  const enrollmentPhotoMode = resolveEnrollmentPhotoModeForEvent(event, store.appSettings);
  const enrollmentPhotoRequired = isPhotoModeRequired(enrollmentPhotoMode);
  const enrollmentPhotoEnabled = isPhotoModeEnabled(enrollmentPhotoMode);
  const leadName = getPublicLeadName(event, trainer?.displayName);
  const isCommunityEvent = isCommunityBrandStatus(event.brandStatus);
  const eventGroup = event.groupId
    ? store.groups.find((item) => item.id === event.groupId) ?? null
    : null;
  const resolvedJoinAudience = resolveTrainingJoinAudienceForEvent(event, eventGroup);
  const joinAudienceBadgeText = getTrainingJoinAudienceBadgeText(resolvedJoinAudience);
  const joinAudienceBadgeClassName = getTrainingJoinAudienceBadgeClassName(resolvedJoinAudience);
  const eventImages = event.eventImages ?? [];
  const detailEventTitle = event.title || event.location;
  const managementPath = isCommunityEvent
    ? `/panel/wydarzenia-spolecznosci/${event.id}`
    : `/panel/szkolenia/${event.id}`;
  const returnPath = "/panel/dashboard";
  const isLoggedInEnrollmentFlow = Boolean(currentUser);
  const alreadyJoinedCommunityEvent =
    isCommunityEvent &&
    participantEnrollmentRecords.some((record) => record.event.id === event.id);
  const shouldShowJoinedCommunityState = isCommunityEvent && alreadyJoinedCommunityEvent;
  const loggedInEnrollmentName =
    participantProfile?.displayName?.trim() ||
    currentUser?.displayName?.trim() ||
    "";
  const loggedInEnrollmentPhone =
    currentUser?.phone?.trim() ||
    participantProfile?.phone?.trim() ||
    getCurrentSessionPhone() ||
    "";
  const recipientMessage = isCommunityEvent
    ? "Zgłoszenie trafi do organizatora."
    : `Zgłoszenie trafi do Przekazującego Wiedzę${organizer ? " i organizatora." : "."}`;
  const joinAudienceMessage =
    resolvedJoinAudience === "existing-practitioners"
      ? "To szkolenie jest opisane jako termin dla osób już ćwiczących."
      : "To szkolenie jest otwarte także dla nowych osób.";

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enrollmentPhotoEnabled && form.photoFile) {
      setForm((current) => ({
        ...current,
        photoFile: null,
      }));
    }
  }, [enrollmentPhotoEnabled, form.photoFile]);

  useEffect(() => {
    setIsScheduleExpanded(false);
  }, [event.id]);

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
    if (isLoggedInEnrollmentFlow) {
      if (!loggedInEnrollmentName) {
        throw new Error("Na koncie brakuje imienia i nazwiska potrzebnego do zgłoszenia.");
      }

      normalizePhoneNumberForSms(loggedInEnrollmentPhone);
      return;
    }

    if (!form.imieNazwisko.trim()) {
      throw new Error("Podaj imię i nazwisko.");
    }

    normalizePhoneNumberForSms(form.telefon);

    if (enrollmentPhotoRequired && !form.photoFile) {
      throw new Error("Dodaj zdjęcie twarzy.");
    }
  }

  async function submitEnrollmentRequest(phoneOverride?: string) {
    setLoading(true);

    try {
      const submissionName = isLoggedInEnrollmentFlow ? loggedInEnrollmentName : form.imieNazwisko;
      const submissionPhone = isLoggedInEnrollmentFlow
        ? loggedInEnrollmentPhone
        : phoneOverride ?? form.telefon;
      const submissionPhotoFile = isLoggedInEnrollmentFlow
        ? null
        : enrollmentPhotoEnabled
          ? form.photoFile
          : null;
      const hasEnrollmentPhoto =
        !isLoggedInEnrollmentFlow && enrollmentPhotoEnabled && Boolean(form.photoFile);

      await submitEnrollment({
        eventId: event.id,
        intent: form.intent,
        imieNazwisko: submissionName,
        telefon: submissionPhone,
        polecenieOdKogo: isLoggedInEnrollmentFlow ? "" : form.polecenieOdKogo,
        wiadomosc: form.wiadomosc,
        photoFile: submissionPhotoFile,
      });
      if (isLoggedInEnrollmentFlow) {
        toast.success("Zgłoszenie udziału zostało zapisane.");
      } else {
        toast.success(
          hasEnrollmentPhoto
            ? "Zgłoszenie i zdjęcie zostały zapisane."
            : "Zgłoszenie zostało zapisane.",
        );
      }
      setVerificationCode("");
      setConfirmationResult(null);
      setSmsDialogStage("success");
      setIsSmsDialogOpen(true);
      setForm({
        intent: "participating",
        imieNazwisko: "",
        telefon: currentUser?.phone ?? getCurrentSessionPhone(),
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
    setSendingCode(true);

    try {
      const normalizedPhone = normalizePhoneNumberForSms(form.telefon);
      if (!recaptchaRef.current) {
        recaptchaRef.current = createRecaptchaVerifier("enrollment-phone-recaptcha");
      }

      const { code, result } = await createConfirmationResult(
        normalizedPhone,
        event.trainerId ?? undefined,
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
      toast.success(`Kod demo został wysłany. Użyj ${code}.`);
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

    if (isLoggedInEnrollmentFlow) {
      await ensurePhoneParticipantProfileForFlow(event.trainerId ?? undefined);
      await submitEnrollmentRequest(loggedInEnrollmentPhone);
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
    <section className="mx-auto max-w-7xl overflow-x-clip px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8">
        <div className="min-w-0 overflow-hidden rounded-[2rem] border border-brand-line bg-white p-5 shadow-soft sm:rounded-[2.25rem] sm:p-6 lg:rounded-[2.5rem] lg:p-7">
          <PublicDetailEyebrow className="tracking-[0.3em]">
            {event.type}
          </PublicDetailEyebrow>
          <h1 className="mt-3 break-words text-[1.8rem] font-semibold leading-[1.08] text-brand-navy sm:mt-4 sm:text-[2.2rem] lg:text-4xl">
            {isCommunityBrandStatus(event.brandStatus)
              ? event.title || event.location
              : event.location}
          </h1>
          {isCommunityBrandStatus(event.brandStatus) ? (
            <PublicDetailEyebrow className="mt-3">
              {event.location}
            </PublicDetailEyebrow>
          ) : null}
          {!isCommunityEvent ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] sm:text-xs sm:tracking-[0.18em] ${joinAudienceBadgeClassName}`}
              >
                {joinAudienceBadgeText}
              </span>
            </div>
          ) : null}

          {isCommunityEvent && eventImages.length > 0 && (
            <div className="mt-6 rounded-[1.75rem] border border-brand-line bg-brand-shell/55 p-4 sm:mt-8 sm:rounded-[2rem] sm:p-5">
              <button
                type="button"
                onClick={() => setGalleryLightboxIndex(0)}
                aria-label="Otwórz galerię wydarzenia"
                className="group relative block w-full overflow-hidden rounded-[1.8rem] border border-brand-line bg-white text-left shadow-soft"
              >
                <img
                  src={eventImages[0].url}
                  alt={getCommunityEventImageAlt(detailEventTitle, 0)}
                  className="h-[20rem] w-full object-cover transition duration-300 group-hover:scale-[1.02] sm:h-[26rem]"
                />
                <span className="pointer-events-none absolute inset-0 bg-brand-navy/0 transition group-hover:bg-brand-navy/10" />
              </button>

              {eventImages.length > 1 && (
                <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                  {eventImages.map((image, index) => (
                    <CommunityEventGalleryThumbnail
                      key={image.id}
                      image={image}
                      alt={getCommunityEventImageAlt(detailEventTitle, index)}
                      onClick={() => setGalleryLightboxIndex(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            className={`mt-5 grid gap-2.5 sm:mt-6 sm:gap-3 ${
              scheduleRows.length > 1 ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-1"
            }`}
          >
            {visibleScheduleRows.map((row, index) => (
              <Fragment key={row.key}>
                <div className="rounded-2xl bg-brand-shell px-3 py-3 text-sm text-brand-muted sm:px-4 sm:py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                    <CalendarDays size={15} />
                    {row.title}
                  </div>
                  <p className="mt-1.5 text-brand-muted">{row.label}</p>
                  <p className="text-brand-muted">{row.range}</p>
                </div>
                {shouldCollapseSchedule && index === 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsScheduleExpanded((value) => !value)}
                    className="group rounded-2xl border border-brand-line bg-white px-3 py-3 text-left text-brand-muted shadow-soft transition hover:-translate-y-0.5 hover:border-brand-sky-deep/35 hover:bg-brand-shell/65 sm:px-4 sm:py-4"
                    aria-expanded={isScheduleExpanded}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold text-brand-navy">
                      <span>
                        {isScheduleExpanded
                          ? "Zwiń pozostałe dni"
                          : `Pokaż ${middleScheduleRows.length} ${
                              middleScheduleRows.length === 1 ? "dzień" : "dni"
                            }`}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 transition-transform ${isScheduleExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                    <p className="mt-1.5 text-sm leading-6">
                      {isScheduleExpanded
                        ? "Zostaw tylko pierwszy i ostatni dzień szkolenia."
                        : "Rozwiń środkowe dni harmonogramu."}
                    </p>
                  </button>
                ) : null}
              </Fragment>
            ))}
          </div>

          <div className="mt-5 space-y-4 border-t border-brand-line/80 pt-4 sm:mt-6 sm:space-y-5 sm:pt-5">
            <p className="text-base font-medium leading-7 text-brand-sky-deep sm:text-lg">
              {event.summary}
            </p>
            <p className="text-base leading-7 text-brand-muted sm:text-lg">
              {event.description}
            </p>

            {isCommunityEvent ? (
              <div className="grid grid-cols-1 gap-3 border-t border-brand-line/70 pt-4 sm:gap-4 sm:pt-5">
                <div className="min-w-0 rounded-[1.65rem] border border-brand-line bg-white px-4 py-4 shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-sky-deep sm:text-xs sm:tracking-[0.22em]">
                      Organizator
                    </p>
                  </div>
                  <p className="mt-3 break-words text-[1.42rem] font-semibold leading-[1.08] text-brand-navy sm:text-[1.65rem]">
                    {getPublicOrganizerName(event, organizer?.displayName, leadName)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 border-t border-brand-line/70 pt-4 sm:gap-4 sm:pt-5">
                <Link
                  to={trainer?.slug ? `/trenerzy/${trainer.slug}` : "/trenerzy"}
                  state={trainer?.slug ? { publicBackPath: `/kalendarz/${event.id}` } : undefined}
                  className="group min-w-0 rounded-[1.65rem] border border-brand-line bg-white px-4 py-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-sky-deep/35 hover:bg-brand-shell/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-sky-deep sm:text-xs sm:tracking-[0.22em]">
                      Przekazujący
                    </p>
                    <ArrowRight
                      size={15}
                      className="mt-0.5 shrink-0 text-brand-sky-deep transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                  <p className="mt-3 break-words text-[1.42rem] font-semibold leading-[1.08] text-brand-navy sm:text-[1.65rem]">
                    {leadName}
                  </p>
                </Link>

                <div className="min-w-0 rounded-[1.65rem] border border-brand-line bg-white px-4 py-4 shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-sky-deep sm:text-xs sm:tracking-[0.22em]">
                      Organizator
                    </p>
                  </div>
                  <p className="mt-3 break-words text-[1.42rem] font-semibold leading-[1.08] text-brand-navy sm:text-[1.65rem]">
                    {getPublicOrganizerName(event, organizer?.displayName, leadName)}
                  </p>
                </div>
              </div>
            )}

            {eventTags.length > 0 && (
              <div>
                <PublicDetailEyebrow>Tagi wydarzenia</PublicDetailEyebrow>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {eventTags.map((tag) => (
                    <span
                      key={`${event.id}-detail-${tag}`}
                      className="rounded-full bg-brand-sky/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-navy sm:px-3 sm:text-xs sm:tracking-[0.18em]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {shouldShowJoinedCommunityState ? (
          <article className="min-w-0 overflow-hidden rounded-[2rem] border border-brand-line bg-white p-5 shadow-soft sm:rounded-[2.25rem] sm:p-6 lg:rounded-[2.5rem] lg:p-7">
            <PublicDetailEyebrow className="tracking-[0.3em]">
              Kontakt
            </PublicDetailEyebrow>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
              Już dołączono
            </p>
            <p className="mt-3 text-sm leading-6 text-brand-muted sm:text-base">
              Masz już zapisane zgłoszenie albo udział w tym wydarzeniu. Zamiast wysyłać kolejny
              formularz, skontaktuj się bezpośrednio z organizatorem.
            </p>
            <p className="mt-4 rounded-3xl border border-brand-line bg-brand-shell px-5 py-4 text-sm text-brand-navy">
              {organizerContactPhone ? (
                <>
                  Telefon organizatora:{" "}
                  <span className="font-semibold">{organizerContactPhone}</span>
                </>
              ) : (
                "Numer organizatora nie jest dostępny."
              )}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center">
              {canManage && (
                <Link
                  to={managementPath}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-6 py-3.5 text-sm font-semibold text-brand-navy shadow-soft sm:w-auto"
                >
                  Edytuj wydarzenie
                </Link>
              )}
              {organizerContactHref ? (
                <a
                  href={organizerContactHref}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft sm:w-auto"
                >
                  Kontakt z Organizatorem
                  <Phone size={16} />
                </a>
              ) : null}
            </div>
          </article>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="min-w-0 overflow-hidden rounded-[2rem] border border-brand-line bg-white p-5 shadow-soft sm:rounded-[2.25rem] sm:p-6 lg:rounded-[2.5rem] lg:p-7"
          >
            <PublicDetailEyebrow className="tracking-[0.3em]">
              Formularz dołączenia
            </PublicDetailEyebrow>
            {!isLoggedInEnrollmentFlow ? (
              <p className="mt-3 text-sm leading-6 text-brand-muted sm:text-base">
                {`${recipientMessage} ${
                  !isCommunityEvent ? `${joinAudienceMessage} ` : ""
                }${
                  enrollmentPhotoMode === "required"
                    ? "Zdjęcie jest wymagane i trafia do prototypowego store tylko dla uprawnionych osób."
                    : enrollmentPhotoMode === "optional"
                      ? "Zdjęcie jest opcjonalne. Jeśli je dodasz, będzie widoczne tylko dla uprawnionych osób."
                      : "W tym formularzu zdjęcie uczestnika jest globalnie wyłączone i nie będzie zbierane."
                }`}
              </p>
            ) : null}
            {isCancelled && (
              <p className="mt-4 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm font-semibold text-brand-navy">
                Zapisy sa wstrzymane, bo to wydarzenie ma status anulowane.
              </p>
            )}

            <div className="mt-6 grid gap-4 sm:mt-7">
              {isLoggedInEnrollmentFlow ? (
                <div className="rounded-3xl border border-brand-navy bg-white px-5 py-5 text-left text-brand-navy shadow-soft">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em]">
                    Chcę wziąć udział
                  </p>
                  <p className="mt-2 text-sm">
                    Organizator skontaktuje się z Tobą, żeby potwierdzić Twój udział w wydarzeniu.
                  </p>
                </div>
              ) : (
                <>
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
                    className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
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
                    className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none disabled:opacity-70"
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
                    className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                  />
                  {enrollmentPhotoEnabled && (
                    <label className="grid min-w-0 gap-3 rounded-3xl border border-dashed border-brand-line bg-brand-shell px-4 py-4 text-brand-navy">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold">
                        <ImagePlus size={16} />
                        Zdjęcie twarzy
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFileChange}
                        className="block w-full min-w-0 max-w-full text-sm"
                      />
                      <span className="text-sm text-brand-muted">
                        {form.photoFile
                          ? `Wybrany plik: ${form.photoFile.name}`
                          : enrollmentPhotoRequired
                            ? "Wymagane: JPG, PNG albo WEBP"
                            : "Opcjonalne: JPG, PNG albo WEBP"}
                      </span>
                    </label>
                  )}
                </>
              )}
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
                  isLoggedInEnrollmentFlow
                    ? "Opcjonalna notatka do organizatora"
                    : organizer
                      ? "Napisz wiadomość do Przekazującego Wiedzę i organizatora"
                      : "Napisz wiadomość do osoby prowadzącej"
                }
                className="w-full min-w-0 max-w-full rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center">
              {canManage && (
                <Link
                  to={managementPath}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-6 py-3.5 text-sm font-semibold text-brand-navy shadow-soft sm:w-auto"
                >
                  {isCommunityEvent ? "Edytuj wydarzenie" : "Edytuj szkolenie"}
                </Link>
              )}
              <button
                type="submit"
                disabled={loading || isCancelled}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60 sm:w-auto"
              >
                {loading
                  ? "Wysyłanie..."
                  : "Chcę wziąć udział"}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}
      </div>

      {isCommunityEvent && eventImages.length > 0 && (
        <CommunityEventGalleryLightbox
          eventTitle={detailEventTitle}
          images={eventImages}
          openIndex={galleryLightboxIndex}
          onOpenIndexChange={setGalleryLightboxIndex}
        />
      )}

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
                  className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
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
    <section className="mx-auto max-w-5xl overflow-x-clip px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <article className="min-w-0 overflow-hidden rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-sky-deep">
            Moderacja wydarzenia społeczności
          </p>
          <h1 className="mt-4 break-words text-3xl font-semibold text-brand-navy sm:text-4xl">
            {reviewLoaded.event.title || reviewLoaded.event.location}
          </h1>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
            {reviewLoaded.event.location}
          </p>
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

        <article className="min-w-0 rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
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
                className="group relative h-[28.05rem] overflow-hidden rounded-[1.8rem] border border-brand-line bg-brand-shell shadow-soft"
              >
                <div className="h-full w-full">
                  {trainer.avatarUrl ? (
                    <AvatarMedia
                      src={trainer.avatarUrl}
                      alt={trainer.displayName}
                      crop={trainer.avatarCrop}
                      className="h-full w-full"
                      imageClassName="transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-sky/45 via-brand-shell to-brand-navy/35 text-6xl font-semibold text-brand-navy/70">
                      {trainer.displayName.slice(0, 1)}
                    </div>
                  )}
                </div>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-navy/55 via-brand-navy/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-[1.6rem] bg-white p-5 shadow-soft">
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
  const publicEventsSource = getPublicEventCollection(store);

  if (!trainer) {
    return <Navigate to="/trenerzy" replace />;
  }

  if (!trainer.isVisible || !isOfficialTrainerProfile(trainer.brandStatus)) {
    return <Navigate to="/trenerzy" replace />;
  }

  const publicEvents = sortEventsByDate(
    publicEventsSource.filter(
      (event) => event.trainerId === trainer.id && event.isPublished && !isTrainingEventArchived(event),
    ),
  );

  return (
    <section className="mx-auto max-w-7xl overflow-x-clip px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 overflow-hidden rounded-[2.5rem] border border-brand-line bg-white shadow-soft">
          <div className="bg-brand-shell">
            {trainer.avatarUrl ? (
              <AvatarMedia
                src={trainer.avatarUrl}
                alt={trainer.displayName}
                crop={trainer.avatarCrop}
                className="h-[20rem] w-full sm:h-[24rem] lg:h-[30rem]"
              />
            ) : (
              <div className="flex h-[20rem] items-center justify-center bg-gradient-to-br from-brand-sky/45 via-brand-shell to-brand-navy/35 text-7xl font-semibold text-brand-navy/70 sm:h-[24rem] lg:h-[30rem]">
                {trainer.displayName.slice(0, 1)}
              </div>
            )}
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
              Profil Przekazującego Wiedzę
            </p>
            <h1 className="mt-4 break-words text-3xl font-semibold text-brand-navy sm:text-4xl">
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
        </div>

        <div className="min-w-0 space-y-5">
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

function createRecaptchaVerifier(_containerId: string) {
  return new RecaptchaVerifier();
}

async function createConfirmationResult(phone: string, seedTrainerId?: string) {
  const { normalizedPhone, code } = await requestSmsCode(phone);

  return {
    normalizedPhone,
    code,
    result: {
      confirm: async (submittedCode: string) => {
        const confirmed = await confirmSmsCode(normalizedPhone, submittedCode, seedTrainerId);

        return {
          user: {
            uid: confirmed.userId,
            phoneNumber: confirmed.phone,
          },
        };
      },
    } satisfies ConfirmationResult,
  };
}

type SmsConfirmationDialogCopy = {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
};

function SmsConfirmationDialog({
  open,
  onOpenChange,
  phone,
  verificationCode,
  onVerificationCodeChange,
  onConfirm,
  disabled,
  copy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  verificationCode: string;
  onVerificationCodeChange: (value: string) => void;
  onConfirm: () => void;
  disabled: boolean;
  copy: SmsConfirmationDialogCopy;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[2rem] border-brand-line p-0">
        <div className="grid gap-5 p-6 sm:p-8">
          <DialogHeader className="text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-sky-deep">
              Potwierdzenie SMS
            </p>
            <DialogTitle className="text-2xl font-semibold text-brand-navy">
              {copy.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-brand-muted">
              Wysłaliśmy kod SMS na numer <strong className="text-brand-navy">{phone}</strong>.{" "}
              {copy.description}
            </DialogDescription>
          </DialogHeader>

          <input
            required
            inputMode="numeric"
            value={verificationCode}
            onChange={(event) => onVerificationCodeChange(event.target.value)}
            placeholder="Kod z SMS"
            className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
            >
              Zamknij
            </button>
            <button
              type="button"
              disabled={disabled || !verificationCode.trim()}
              onClick={onConfirm}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {disabled ? copy.pendingLabel : copy.confirmLabel}
              <Phone size={16} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SmsLoginScreen() {
  const {
    authReady,
    currentUser,
    ensurePhoneParticipantProfileForFlow,
    getPublicSignedInPath,
    signIn,
  } = useAppState();
  const navigate = useNavigate();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [quickLoginEmail, setQuickLoginEmail] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  if (currentUser) {
    return <Navigate to={getPublicSignedInPath()} replace />;
  }

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSendingCode(true);

    try {
      const normalizedPhone = normalizePhoneNumberForSms(phone);
      if (!recaptchaRef.current) {
        recaptchaRef.current = createRecaptchaVerifier("login-phone-recaptcha");
      }

      const { code, result } = await createConfirmationResult(normalizedPhone);

      setPhone(normalizedPhone);
      setVerificationCode("");
      setConfirmationResult(result);
      setIsSmsDialogOpen(true);
      toast.success(`Kod demo został wysłany. Użyj ${code}.`);
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
      let appUser = await fetchAppUser(result.user.uid);
      if (!appUser.participantProfileId) {
        await ensurePhoneParticipantProfileForFlow();
        appUser = await fetchAppUser(result.user.uid);
      }
      setVerificationCode("");
      setConfirmationResult(null);
      setIsSmsDialogOpen(false);
      toast.success("Zalogowano.");
      navigate(getPublicSignedInPath());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się potwierdzić kodu SMS.",
      );
    } finally {
      setConfirmingCode(false);
    }
  }

  async function handleQuickLogin(
    emailToUse: string,
  ) {
    setQuickLoginEmail(emailToUse);

    try {
      await signIn(emailToUse, demoLoginPassword);
      toast.success(`Zalogowano jako ${emailToUse}.`);
      navigate(getPublicSignedInPath());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zalogować kontem demo.",
      );
    } finally {
      setQuickLoginEmail(null);
    }
  }

  return (
    <section className="mx-auto max-w-7xl overflow-x-clip px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 rounded-[2rem] border border-brand-line bg-white p-5 shadow-soft sm:rounded-[2.5rem] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-sky-deep sm:text-sm sm:tracking-[0.3em]">
            Logowanie SMS
          </p>

          <form onSubmit={handleSendCode} className="mt-4 grid gap-4 sm:mt-6">
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

          <div id="login-phone-recaptcha" className="sr-only" />

          <div className="mt-8 rounded-3xl border border-brand-line bg-brand-shell p-4 text-sm text-brand-muted sm:p-5">
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

        <aside className="min-w-0 rounded-[2rem] border border-brand-line bg-white p-4 shadow-soft sm:rounded-[2.5rem] sm:p-6">
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
                      onClick={() => void handleQuickLogin(account.email)}
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

      <SmsConfirmationDialog
        open={isSmsDialogOpen}
        onOpenChange={setIsSmsDialogOpen}
        phone={phone}
        verificationCode={verificationCode}
        onVerificationCodeChange={setVerificationCode}
        onConfirm={() => void handleConfirmCode()}
        disabled={!confirmationResult || confirmingCode}
        copy={{
          title: "Potwierdź logowanie",
          description: "Wpisz go, żeby się zalogować.",
          confirmLabel: "Potwierdź logowanie",
          pendingLabel: "Potwierdzanie...",
        }}
      />
    </section>
  );
}

function SmsRegisterScreen() {
  const {
    authReady,
    currentUser,
    getPublicSignedInPath,
    registerParticipant,
    store,
  } = useAppState();
  const navigate = useNavigate();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const searchParams =
    typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const enrollmentSource = searchParams.get("source") === "enrollment";
  const prefetchedPhone =
    typeof window === "undefined" ? "" : searchParams.get("phone") ?? "";
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [smsVerified, setSmsVerified] = useState(Boolean(currentUser?.phone || getCurrentSessionPhone()));
  const [form, setForm] = useState({
    displayName: "",
    phone: prefetchedPhone || currentUser?.phone || getCurrentSessionPhone(),
    notes: "",
    avatarFile: null as File | null,
    trainingDataConsentAccepted: false,
  });
  const signupPhotoMode = store.appSettings.signupPhotoMode;
  const signupPhotoRequired = isPhotoModeRequired(signupPhotoMode);
  const signupPhotoEnabled = isPhotoModeEnabled(signupPhotoMode);

  useEffect(() => {
    const sessionPhone = currentUser?.phone || getCurrentSessionPhone();
    if (sessionPhone) {
      setSmsVerified(true);
      setForm((current) => ({
        ...current,
        phone: sessionPhone || current.phone,
      }));
    }

    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, [currentUser?.phone]);

  useEffect(() => {
    if (!signupPhotoEnabled && form.avatarFile) {
      setForm((current) => ({
        ...current,
        avatarFile: null,
      }));
    }
  }, [signupPhotoEnabled, form.avatarFile]);

  if (hasCompletedParticipantRegistration(currentUser)) {
    return <Navigate to={getPublicSignedInPath()} replace />;
  }

  function resetSmsVerification() {
    setSmsVerified(false);
    setVerificationCode("");
    setConfirmationResult(null);
  }

  function validateRegistrationForm() {
    if (!form.displayName.trim()) {
      throw new Error("Podaj imię i nazwisko.");
    }

    normalizePhoneNumberForSms(form.phone);

    if (signupPhotoRequired && !form.avatarFile) {
      throw new Error("Dodaj zdjęcie profilowe.");
    }

    if (!form.notes.trim()) {
      throw new Error("Napisz kilka słów o sobie.");
    }

    if (!form.trainingDataConsentAccepted) {
      throw new Error(
        "Zaznacz zgodę na przetwarzanie danych osobowych do celów organizacji szkoleń.",
      );
    }
  }

  async function finalizeRegistration(phoneOverride?: string) {
    setLoading(true);

    try {
      await registerParticipant({
        displayName: form.displayName,
        phone: phoneOverride ?? form.phone,
        notes: form.notes,
        avatarFile: signupPhotoEnabled ? form.avatarFile : null,
        trainingDataConsentAccepted: form.trainingDataConsentAccepted,
      });
      toast.success("Konto uczestnika zostało utworzone.");
      navigate(getPublicSignedInPath());
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się utworzyć konta.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCode() {
    setSendingCode(true);

    try {
      const normalizedPhone = normalizePhoneNumberForSms(form.phone);
      if (!recaptchaRef.current) {
        recaptchaRef.current = createRecaptchaVerifier("register-phone-recaptcha");
      }

      const { code, result } = await createConfirmationResult(normalizedPhone);

      setForm((current) => ({
        ...current,
        phone: normalizedPhone,
      }));
      setVerificationCode("");
      setConfirmationResult(result);
      setIsSmsDialogOpen(true);
      toast.success(`Kod demo został wysłany. Użyj ${code}.`);
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
      const confirmedPhone = result.user.phoneNumber ?? form.phone;
      setForm((current) => ({
        ...current,
        phone: confirmedPhone,
      }));
      setSmsVerified(true);
      setVerificationCode("");
      setConfirmationResult(null);
      setIsSmsDialogOpen(false);
      toast.success("Numer telefonu został potwierdzony.");
      await finalizeRegistration(confirmedPhone);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się potwierdzić kodu SMS.",
      );
    } finally {
      setConfirmingCode(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      validateRegistrationForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Uzupełnij wymagane pola formularza.",
      );
      return;
    }

    if (smsVerified) {
      await finalizeRegistration();
      return;
    }

    if (confirmationResult) {
      setIsSmsDialogOpen(true);
      return;
    }

    await handleSendCode();
  }

  return (
    <section className="mx-auto max-w-5xl overflow-x-clip px-4 py-14 sm:px-6 lg:px-8">
      <div className="min-w-0 overflow-hidden rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
          Rejestracja
        </p>
        <p className="mt-4 max-w-3xl text-lg text-brand-muted">
          Zakładasz konto uczestnika, potwierdzając numer telefonu SMS-kodem.
        </p>
        {enrollmentSource && (
          <p className="mt-3 max-w-3xl rounded-3xl border border-brand-line bg-brand-shell px-4 py-3 text-sm text-brand-muted">
            Jeśli wcześniej wysłałeś lub wysłałaś zgłoszenie udziału do szkolenia na ten sam numer,
            po założeniu konta zgłoszenie pojawi się automatycznie w Twoich szkoleniach.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
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
            placeholder="Imię i nazwisko"
            className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />

          <input
            required
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => {
              if (smsVerified || confirmationResult) {
                resetSmsVerification();
              }

              setForm((current) => ({
                ...current,
                phone: event.target.value,
              }));
            }}
            placeholder="Numer telefonu"
            className="w-full min-w-0 max-w-full rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
          />

          {signupPhotoEnabled && (
            <label className="grid min-w-0 gap-3 rounded-[2rem] border border-dashed border-brand-line bg-brand-shell px-4 py-4 text-brand-navy">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <ImagePlus size={16} />
                Zdjęcie profilowe {signupPhotoRequired ? "(wymagane)" : "(opcjonalne)"}
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
                className="block w-full min-w-0 max-w-full text-sm"
              />
              <span className="text-sm text-brand-muted">
                {form.avatarFile
                  ? `Wybrany plik: ${form.avatarFile.name}`
                  : "JPG, PNG albo WEBP do 5 MB"}
              </span>
            </label>
          )}

          <label className="grid min-w-0 gap-2">
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
              className="w-full min-w-0 max-w-full rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <label className="flex items-start gap-3 rounded-[1.75rem] border border-brand-line bg-brand-shell px-4 py-4 text-sm text-brand-muted">
            <input
              type="checkbox"
              checked={form.trainingDataConsentAccepted}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  trainingDataConsentAccepted: event.target.checked,
                }))
              }
              className="mt-1"
            />
            <span>
              Wyrażam zgodę na przetwarzanie moich danych osobowych zgodnie z RODO do
              celów organizacji szkoleń.
            </span>
          </label>

          <button
            type="submit"
            disabled={
              loading ||
              sendingCode ||
              confirmingCode ||
              !authReady ||
              !form.trainingDataConsentAccepted
            }
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60 sm:w-auto"
          >
            {loading
              ? "Tworzenie konta..."
              : sendingCode
                ? "Wysyłanie kodu..."
                : "Utwórz konto"}
            <ArrowRight size={16} />
          </button>

          {smsVerified && !loading && (
            <p className="text-sm text-brand-muted">
              Numer telefonu jest już potwierdzony. Kliknięcie przycisku utworzy konto bez
              ponownej weryfikacji SMS.
            </p>
          )}

          <div id="register-phone-recaptcha" className="sr-only" />
        </form>
      </div>

      <SmsConfirmationDialog
        open={isSmsDialogOpen}
        onOpenChange={setIsSmsDialogOpen}
        phone={form.phone}
        verificationCode={verificationCode}
        onVerificationCodeChange={setVerificationCode}
        onConfirm={() => void handleConfirmCode()}
        disabled={!confirmationResult || confirmingCode || loading}
        copy={{
          title: "Potwierdź numer telefonu",
          description: "Wpisz go, żeby dokończyć tworzenie konta.",
          confirmLabel: "Potwierdź kod i utwórz konto",
          pendingLabel: "Potwierdzanie...",
        }}
      />
    </section>
  );
}

export function LoginPage() {
  return <SmsLoginScreen />;
}

function LoginPageLegacyUnused() {
  const { authReady, currentUser, getPublicSignedInPath, signIn } = useAppState();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickLoginEmail, setQuickLoginEmail] = useState<string | null>(null);

  if (currentUser) {
    return <Navigate to={getPublicSignedInPath()} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success("Zalogowano.");
      navigate(getPublicSignedInPath());
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
  ) {
    setQuickLoginEmail(emailToUse);

    try {
      await signIn(emailToUse, demoLoginPassword);
      toast.success(`Zalogowano jako ${emailToUse}.`);
      navigate(getPublicSignedInPath());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nie udało się zalogować kontem demo.",
      );
    } finally {
      setQuickLoginEmail(null);
    }
  }

  return (
    <section className="mx-auto max-w-7xl overflow-x-clip px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <form
          onSubmit={handleSubmit}
          className="min-w-0 rounded-[2.5rem] border border-brand-line bg-white p-8 shadow-soft"
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
              Potwierdź numer telefonu i załóż konto uczestnika. Dostęp organizatora
              aktywujesz później z panelu.
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

        <aside className="min-w-0 rounded-[2.5rem] border border-brand-line bg-white p-6 shadow-soft">
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
                      onClick={() => void handleQuickLogin(account.email)}
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
