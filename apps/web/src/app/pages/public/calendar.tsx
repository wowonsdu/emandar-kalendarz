import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  LoaderCircle,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
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
  type ConfirmSmsCodeResult,
  fetchAppUser,
  fetchPublicEventsPage,
  type PublicEventFilterOptions,
  type PublicEventFilters,
  getCurrentSessionPhone,
  getVerifiedPhonePreAuth,
  requestSmsCode,
} from "@/data/apiClient";
import {
  getParticipantEnrollmentViewRecords,
} from "@/app/dashboard";
import {
  buildRegistrationPath,
  getInitialVerifiedRegistrationPhone,
  resolveLoginSmsConfirmAction,
  shouldResetVerifiedPhone,
} from "../public-auth-flow";
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
  resolveEventOwnerDisplayLabels,
  resolveCommunityEventOrganizerPhone,
  resolveEnrollmentPhotoModeForEvent,
  resolveBrandStatus,
  resolveTrainingJoinAudienceForEvent,
  resolveTrainingEventStatus,
} from "@/domain/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { AvatarMedia } from "@/app/components/avatar-media";
import { CommunityEventCard } from "@/app/components/community-event-card";
import { PublicEventJoinButton } from "@/app/components/public-event-join-button";
import { useAppState } from "../../providers/AppProviders";

const emandarCalendarLogoUrl = `${import.meta.env.BASE_URL}brand-assets/emandar-logo.png`;

type ConfirmationResult = {
  confirm: (code: string) => Promise<ConfirmSmsCodeResult>;
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
const isDemoLoginEnabled = import.meta.env.DEV;

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

function getPublicOrganizerName(
  event: TrainingEvent,
  ownerLabels: ReturnType<typeof resolveEventOwnerDisplayLabels>,
) {
  if (isSelfManagedTrainingEvent(event)) {
    return firstName(ownerLabels.trainerName);
  }

  return firstName(ownerLabels.organizerName) || "Zespół Emandar";
}

function getPublicLeadName(ownerLabels: ReturnType<typeof resolveEventOwnerDisplayLabels>) {
  return ownerLabels.trainerName;
}

function getEventTags(event: TrainingEvent) {
  return (event.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
}

const publicEventsPageSize = 25;
const emptyPublicEventFilterOptions: PublicEventFilterOptions = {
  tags: [],
  trainers: [],
  dateBounds: null,
};
const publicEventSearchDebounceMs = 300;
const publicEventSearchMinLength = 3;
const publicEventAudienceFilterOptions = [
  { value: "new-people", label: "Nowe osoby" },
  { value: "existing-practitioners", label: "Tylko Ćwiczący" },
] as const;

type PublicEventAudienceFilter = (typeof publicEventAudienceFilterOptions)[number]["value"];

function normalizeFilterValue(value: string) {
  return value.trim().toLocaleLowerCase("pl-PL");
}

function normalizePublicEventSearch(value: string | null | undefined) {
  const search = value?.trim() ?? "";
  return search.length >= publicEventSearchMinLength ? search : undefined;
}

function dedupeValues(values: string[], caseInsensitive = false) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const key = caseInsensitive ? normalizeFilterValue(trimmed) : trimmed;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(trimmed);
  });

  return result;
}

function parsePublicEventAudienceFilter(searchParams: URLSearchParams): PublicEventAudienceFilter {
  const value = searchParams.get("audience")?.trim();
  return value === "existing-practitioners" ? value : "new-people";
}

export function parsePublicEventFilters(
  searchParams: URLSearchParams,
  options: { includeAudience?: boolean } = {},
): PublicEventFilters {
  return {
    search: normalizePublicEventSearch(searchParams.get("search")),
    trainerIds: dedupeValues(searchParams.getAll("trainerId")),
    dateFrom: searchParams.get("dateFrom")?.trim() || undefined,
    dateTo: searchParams.get("dateTo")?.trim() || undefined,
    audience: options.includeAudience ? parsePublicEventAudienceFilter(searchParams) : "all",
  };
}

function parsePublicEventPage(searchParams: URLSearchParams) {
  const parsed = Number(searchParams.get("page") ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getPublicEventFiltersKey(filters: PublicEventFilters) {
  return JSON.stringify({
    search: normalizeFilterValue(filters.search ?? ""),
    trainerIds: [...(filters.trainerIds ?? [])].sort(),
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
    audience: filters.audience ?? "all",
  });
}

function countActivePublicFilters(filters: PublicEventFilters) {
  return (
    (filters.search?.trim() ? 1 : 0) +
    (filters.trainerIds?.length ?? 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.audience === "existing-practitioners" ? 1 : 0)
  );
}

export function setPublicEventFiltersInSearchParams(
  searchParams: URLSearchParams,
  filters: PublicEventFilters,
) {
  const next = new URLSearchParams(searchParams);
  next.delete("page");
  next.delete("tag");
  next.delete("search");
  next.delete("trainerId");
  next.delete("dateFrom");
  next.delete("dateTo");
  next.delete("audience");

  const search = normalizePublicEventSearch(filters.search);
  if (search) {
    next.set("search", search);
  }
  dedupeValues(filters.trainerIds ?? []).forEach((trainerId) => next.append("trainerId", trainerId));
  if (filters.dateFrom) {
    next.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    next.set("dateTo", filters.dateTo);
  }
  if (filters.audience === "existing-practitioners") {
    next.set("audience", filters.audience);
  }

  return next;
}

function usePublicEventSearchInput({
  filters,
  searchParams,
  setSearchParams,
}: {
  filters: PublicEventFilters;
  searchParams: URLSearchParams;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
}) {
  const appliedSearch = filters.search ?? "";
  const [searchInput, setSearchInput] = useState(appliedSearch);
  const syncedSearchRef = useRef(appliedSearch);

  useEffect(() => {
    if (syncedSearchRef.current === appliedSearch) {
      return;
    }

    syncedSearchRef.current = appliedSearch;
    setSearchInput(appliedSearch);
  }, [appliedSearch]);

  useEffect(() => {
    const trimmedSearch = searchInput.trim();
    const nextSearch = trimmedSearch.length === 0 ? undefined : normalizePublicEventSearch(trimmedSearch);

    if (trimmedSearch.length > 0 && !nextSearch) {
      return;
    }

    if ((nextSearch ?? "") === appliedSearch) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSearchParams(
        setPublicEventFiltersInSearchParams(searchParams, {
          ...filters,
          search: nextSearch,
        }),
      );
    }, publicEventSearchDebounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [appliedSearch, filters, searchInput, searchParams, setSearchParams]);

  function clearSearchInput() {
    syncedSearchRef.current = "";
    setSearchInput("");
  }

  return {
    searchInput,
    setSearchInput,
    clearSearchInput,
  };
}

export function PublicEventSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block w-full">
      <span className="sr-only">Szukaj wydarzeń</span>
      <Search
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Szukaj po miejscu, dacie, trenerze lub tagu"
        className="h-12 w-full rounded-2xl border border-brand-line bg-white pl-11 pr-4 text-sm font-medium text-brand-navy shadow-soft outline-none placeholder:text-brand-muted focus:border-brand-sky-deep"
      />
    </label>
  );
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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-navy/12 backdrop-blur-[2px]" />

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

export function PublicEventFiltersPanel({
  options,
  value,
  searchValue,
  activeCount,
  showAudienceFilter = false,
  onSearchChange,
  onChange,
  onClear,
}: {
  options: PublicEventFilterOptions;
  value: PublicEventFilters;
  searchValue: string;
  activeCount: number;
  showAudienceFilter?: boolean;
  onSearchChange: (value: string) => void;
  onChange: (filters: PublicEventFilters) => void;
  onClear: () => void;
}) {
  const selectedTrainerIds = new Set(value.trainerIds ?? []);
  const selectedAudience = value.audience === "existing-practitioners" ? value.audience : "new-people";

  function toggleTrainer(trainerId: string) {
    const nextTrainerIds = selectedTrainerIds.has(trainerId)
      ? (value.trainerIds ?? []).filter((item) => item !== trainerId)
      : [...(value.trainerIds ?? []), trainerId];

    onChange({ ...value, trainerIds: nextTrainerIds });
  }

  function setAudience(audience: PublicEventAudienceFilter) {
    onChange({ ...value, audience });
  }

  return (
    <div className="rounded-[1.5rem] border border-brand-line bg-white p-4 shadow-soft">
      <div className="space-y-5">
        <PublicEventSearchInput value={searchValue} onChange={onSearchChange} />

        <section>
          <h3 className="text-sm font-semibold text-brand-navy">Kiedy</h3>
          <div className="mt-3 grid gap-2">
            <label className="relative block">
              <span className="sr-only">Data od</span>
              <input
                type="date"
                value={value.dateFrom ?? ""}
                aria-label="Data od"
                min={options.dateBounds?.min}
                max={options.dateBounds?.max}
                onChange={(event) => onChange({ ...value, dateFrom: event.target.value || undefined })}
                className="h-10 w-full rounded-xl border border-brand-line bg-white px-11 text-sm font-semibold text-brand-navy outline-none focus:border-brand-sky-deep"
              />
              <CalendarDays
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy"
                aria-hidden="true"
              />
            </label>
            <label className="relative block">
              <span className="sr-only">Data do</span>
              <input
                type="date"
                value={value.dateTo ?? ""}
                aria-label="Data do"
                min={options.dateBounds?.min}
                max={options.dateBounds?.max}
                onChange={(event) => onChange({ ...value, dateTo: event.target.value || undefined })}
                className="h-10 w-full rounded-xl border border-brand-line bg-white px-11 text-sm font-semibold text-brand-navy outline-none focus:border-brand-sky-deep"
              />
              <CalendarDays
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy"
                aria-hidden="true"
              />
            </label>
          </div>
        </section>

        {showAudienceFilter ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Dla kogo</h3>
            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-brand-line bg-brand-shell p-1">
              {publicEventAudienceFilterOptions.map((option) => {
                const isActive = selectedAudience === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAudience(option.value)}
                    className={[
                      "min-h-9 rounded-xl px-2 py-1.5 text-center text-[11px] font-semibold leading-tight transition-colors sm:text-xs",
                      isActive
                        ? "bg-white text-brand-navy shadow-[0_6px_18px_rgba(21,52,105,0.10)]"
                        : "text-brand-muted hover:text-brand-navy",
                    ].join(" ")}
                    aria-pressed={isActive}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Trenerzy</h3>
          {options.trainers.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {options.trainers.map((trainer) => {
                const isActive = selectedTrainerIds.has(trainer.id);
                return (
                  <label
                    key={trainer.id}
                    className={[
                      "flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                      isActive
                        ? "border-brand-navy bg-brand-shell text-brand-navy"
                        : "border-brand-line bg-white text-brand-navy hover:border-brand-sky-deep",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleTrainer(trainer.id)}
                      className="h-4 w-4 rounded border-brand-line text-brand-navy accent-brand-navy"
                    />
                    <span className="min-w-0 flex-1 truncate">{trainer.label}</span>
                    {trainer.count !== undefined ? (
                      <span className="text-xs font-semibold text-brand-muted">{trainer.count}</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-brand-muted">Brak trenerów.</p>
          )}
        </section>
      </div>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy shadow-soft"
        >
          Wyczyść filtry
        </button>
      ) : null}
    </div>
  );
}

function EventFeedSection({
  eyebrow,
  emptyTitle,
  emptyDescription,
  events,
  pagination,
  filterPanel,
  activeFilterCount = 0,
  isFetching = false,
}: {
  eyebrow: string;
  title?: string;
  description?: string;
  emptyTitle: string;
  emptyDescription: string;
  events: TrainingEvent[];
  filterPanel?: ReactNode;
  activeFilterCount?: number;
  isFetching?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    loading?: boolean;
  };
}) {
  function handlePageChange(nextPage: number) {
    if (!pagination || nextPage === pagination.page) {
      return;
    }

    pagination.onPageChange(nextPage);

    if (typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    }
  }

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  return (
    <section className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:px-8">
      <div className={filterPanel ? "grid gap-7 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start" : ""}>
        {filterPanel ? (
          <aside className="hidden lg:sticky lg:top-24 lg:block">
            {filterPanel}
          </aside>
        ) : null}

        <div className="min-w-0">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-base font-semibold uppercase tracking-[0.28em] text-brand-navy sm:text-lg">
                {eyebrow}
              </p>
            </div>

            {filterPanel ? (
              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-start lg:justify-end">
                <button
                  type="button"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-4 text-sm font-semibold text-brand-navy shadow-soft lg:hidden"
                >
                  <SlidersHorizontal size={17} />
                  Filtry
                  {activeFilterCount > 0 ? (
                    <span className="rounded-full bg-brand-navy px-2 py-0.5 text-xs text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative" aria-busy={isFetching || undefined}>
            {isFetching ? (
              <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white/95 px-4 py-2 text-sm font-semibold text-brand-navy shadow-soft backdrop-blur">
                  <LoaderCircle size={16} className="animate-spin text-brand-sky-deep" aria-hidden="true" />
                  Filtrowanie...
                </div>
              </div>
            ) : null}
            <div className="grid gap-6">
              {events.length === 0 ? (
                <EmptyState title={emptyTitle} description={emptyDescription} />
              ) : (
                events.map((event) => <EventCard key={event.id} eventId={event.id} eventOverride={event} />)
              )}
            </div>
          </div>
          {pagination && pagination.totalPages > 1 ? (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-brand-muted shadow-soft">
              <span>
                Strona {pagination.page} z {pagination.totalPages}. Razem: {pagination.totalItems}.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || pagination.loading}
                  onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-shell px-4 py-2 font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                  Poprzednia
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages || pagination.loading}
                  onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-shell px-4 py-2 font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Następna
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {filterPanel ? (
        <Dialog open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
          <DialogPortal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-navy/35 backdrop-blur-sm" />
            <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border-r border-brand-line bg-brand-shell p-4 outline-none shadow-2xl lg:hidden">
              <DialogHeader className="sr-only">
                <DialogTitle>Filtry</DialogTitle>
                <DialogDescription>Filtry listy wydarzeń.</DialogDescription>
              </DialogHeader>
              <div className="mb-4 flex justify-end">
                <DialogClose className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-line bg-white text-brand-navy shadow-soft">
                  <X size={18} />
                  <span className="sr-only">Zamknij filtry</span>
                </DialogClose>
              </div>
              {filterPanel}
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      ) : null}
    </section>
  );
}

function EventCard({
  eventId,
  eventOverride,
  showTrainerImage = true,
}: {
  eventId: string;
  eventOverride?: TrainingEvent;
  showTrainerImage?: boolean;
}) {
  const { currentUser, store } = useAppState();
  const publicEvents = getPublicEventCollection(store);
  const event = publicEvents.find((item) => item.id === eventId) ?? eventOverride;

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
  const ownerLabels = resolveEventOwnerDisplayLabels(event, store);
  const eventImages = event.eventImages ?? [];
  const canManage = canManagePublicEvent(event, currentUser);
  const leadName = getPublicLeadName(ownerLabels);
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
  const shouldCollapseDesktopSchedule = scheduleRows.length > 8;
  const desktopLeadingScheduleRows = shouldCollapseDesktopSchedule
    ? scheduleRows.slice(0, 6)
    : scheduleRows;
  const desktopFinalScheduleRow = shouldCollapseDesktopSchedule
    ? scheduleRows[scheduleRows.length - 1]
    : null;
  const hiddenDesktopScheduleRowCount = shouldCollapseDesktopSchedule
    ? scheduleRows.length - desktopLeadingScheduleRows.length - 1
    : 0;
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
                {getPublicOrganizerName(event, ownerLabels)}
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
            <PublicEventJoinButton eventId={event.id} />
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
              <PublicEventJoinButton eventId={event.id} />
            </div>
          </div>
          <div
            className={`mt-6 grid gap-3 ${
              scheduleRows.length > 1
                ? "grid-cols-2 xl:grid-cols-4"
                : "grid-cols-1"
            }`}
          >
            {desktopLeadingScheduleRows.map((row) => (
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
            {shouldCollapseDesktopSchedule ? (
              <div className="flex min-h-[5.5rem] items-center justify-center rounded-2xl border border-dashed border-brand-line bg-brand-shell px-4 py-3 text-brand-sky-deep">
                <div className="text-center">
                  <p className="text-2xl font-semibold leading-none">...</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                    +{hiddenDesktopScheduleRowCount} dni
                  </p>
                </div>
              </div>
            ) : null}
            {desktopFinalScheduleRow ? (
              <div
                key={desktopFinalScheduleRow.key}
                className="rounded-2xl bg-brand-shell px-4 py-3 text-sm text-brand-muted"
              >
                <div className="mb-1 flex items-center gap-2 font-semibold text-brand-navy">
                  <CalendarDays size={16} />
                  {desktopFinalScheduleRow.title}
                </div>
                <p>{desktopFinalScheduleRow.label}</p>
                <p>{desktopFinalScheduleRow.range}</p>
              </div>
            ) : null}
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
                    {getPublicOrganizerName(event, ownerLabels)}
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
            do wspólnego API Emandar. Możesz przejść do kalendarza, sprawdzić
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
                "Osobny obszar dla admina, Przekazującego Wiedzę i organizatora z logowaniem SMS i wspólnymi danymi systemu.",
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
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePublicEventPage(searchParams);
  const filters = useMemo(() => parsePublicEventFilters(searchParams, { includeAudience: true }), [searchParams]);
  const filtersKey = useMemo(() => getPublicEventFiltersKey(filters), [filters]);
  const activeFilterCount = countActivePublicFilters(filters);
  const eventsPageQuery = useQuery({
    queryKey: ["public", "events", "official", page, filtersKey],
    queryFn: () => fetchPublicEventsPage("official", { page, pageSize: publicEventsPageSize, filters }),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
  const {
    searchInput,
    setSearchInput,
    clearSearchInput,
  } = usePublicEventSearchInput({ filters, searchParams, setSearchParams });

  function handleFiltersChange(nextFilters: PublicEventFilters) {
    setSearchParams(setPublicEventFiltersInSearchParams(searchParams, nextFilters));
  }

  function handleClearFilters() {
    clearSearchInput();
    setSearchParams(setPublicEventFiltersInSearchParams(searchParams, {}));
  }

  function handlePageChange(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(nextPage));
    }
    setSearchParams(next);
  }

  const filterPanel = (
    <PublicEventFiltersPanel
      options={eventsPageQuery.data?.filters ?? emptyPublicEventFilterOptions}
      value={filters}
      searchValue={searchInput}
      activeCount={activeFilterCount}
      showAudienceFilter
      onSearchChange={setSearchInput}
      onChange={handleFiltersChange}
      onClear={handleClearFilters}
    />
  );
  const events = eventsPageQuery.data?.items ?? [];

  return (
    <EventFeedSection
      eyebrow="Szkolenia Emandar"
      title="Spotkania z Przekazującymi wiedzę"
      description="Kalendarz oficjalnych szkoleń będzie uzupełniany przez zespół Emandar."
      emptyTitle="Brak opublikowanych szkoleń"
      emptyDescription={
        activeFilterCount > 0
          ? "Nie znaleziono szkoleń pasujących do wybranych filtrów."
          : "Po dodaniu wydarzeń pojawią się tutaj szkolenia."
      }
      events={events}
      filterPanel={filterPanel}
      activeFilterCount={activeFilterCount}
      isFetching={eventsPageQuery.isFetching}
      pagination={
        eventsPageQuery.data
          ? {
              page: eventsPageQuery.data.page,
              totalPages: eventsPageQuery.data.totalPages,
              totalItems: eventsPageQuery.data.totalItems,
              loading: eventsPageQuery.isFetching,
              onPageChange: handlePageChange,
            }
          : undefined
      }
    />
  );
}

export function CommunityEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePublicEventPage(searchParams);
  const filters = useMemo(() => parsePublicEventFilters(searchParams), [searchParams]);
  const filtersKey = useMemo(() => getPublicEventFiltersKey(filters), [filters]);
  const activeFilterCount = countActivePublicFilters(filters);
  const eventsPageQuery = useQuery({
    queryKey: ["public", "events", "community", page, filtersKey],
    queryFn: () => fetchPublicEventsPage("community", { page, pageSize: publicEventsPageSize, filters }),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
  const {
    searchInput,
    setSearchInput,
    clearSearchInput,
  } = usePublicEventSearchInput({ filters, searchParams, setSearchParams });

  function handleFiltersChange(nextFilters: PublicEventFilters) {
    setSearchParams(setPublicEventFiltersInSearchParams(searchParams, nextFilters));
  }

  function handleClearFilters() {
    clearSearchInput();
    setSearchParams(setPublicEventFiltersInSearchParams(searchParams, {}));
  }

  function handlePageChange(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(nextPage));
    }
    setSearchParams(next);
  }

  const filterPanel = (
    <PublicEventFiltersPanel
      options={eventsPageQuery.data?.filters ?? emptyPublicEventFilterOptions}
      value={filters}
      searchValue={searchInput}
      activeCount={activeFilterCount}
      onSearchChange={setSearchInput}
      onChange={handleFiltersChange}
      onClear={handleClearFilters}
    />
  );
  const events = eventsPageQuery.data?.items ?? [];

  return (
    <EventFeedSection
      eyebrow="Wydarzenia społeczności"
      title="Wydarzenia społeczności"
      description="Przeglądaj otwarte wydarzenia społeczności i zgłaszaj chęć udziału u osoby prowadzącej."
      emptyTitle="Brak wydarzeń społeczności"
      emptyDescription={
        activeFilterCount > 0
          ? "Nie znaleziono wydarzeń społeczności pasujących do wybranych filtrów."
          : "Po opublikowaniu nowych wydarzeń pojawią się właśnie tutaj."
      }
      events={events}
      filterPanel={filterPanel}
      activeFilterCount={activeFilterCount}
      isFetching={eventsPageQuery.isFetching}
      pagination={
        eventsPageQuery.data
          ? {
              page: eventsPageQuery.data.page,
              totalPages: eventsPageQuery.data.totalPages,
              totalItems: eventsPageQuery.data.totalItems,
              loading: eventsPageQuery.isFetching,
              onPageChange: handlePageChange,
            }
          : undefined
      }
    />
  );
}
