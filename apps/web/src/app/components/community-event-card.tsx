import { useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, ChevronDown, Images, MapPin } from "lucide-react";
import { Link } from "react-router";
import type { AppUser, DemoStore, TrainingEvent, TrainingEventImage } from "@/domain/types";
import {
  canManageTrainingEvent,
  getTrainingEventScheduleBounds,
  getTrainingEventScheduleDays,
  isCommunityBrandStatus,
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
import { useAppState } from "@/app/providers/AppProviders";

type CommunityEventCardStatusItem = {
  label: string;
  value: string;
};

type CommunityEventCardProps = {
  event: TrainingEvent;
  showTrainerImage?: boolean;
  renderActionSlot?: (placement: "mobile" | "desktop") => ReactNode;
  statusItems?: CommunityEventCardStatusItem[];
};

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
    title: `Dzień ${index + 1}`,
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

function getPublicLeadName(event: TrainingEvent, trainerName?: string) {
  return trainerName || event.creatorDisplayName || "Gospodarz wydarzenia";
}

function getEventTags(event: TrainingEvent) {
  return (event.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
}

function getEventImagePreviewWidth(image: TrainingEventImage, height = 112) {
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 1;
  return Math.max(88, Math.round(height * ratio));
}

function getCommunityEventCoverImageIndex(
  event: Pick<TrainingEvent, "eventImages" | "useEventImageAsCover">,
) {
  return event.useEventImageAsCover === true && (event.eventImages?.length ?? 0) > 0 ? 0 : null;
}

function getCommunityEventImageAlt(eventTitle: string, index: number) {
  return `${eventTitle} zdjęcie ${index + 1}`;
}

function canManagePublicEvent(event: TrainingEvent, currentUser: AppUser | null) {
  return currentUser ? canManageTrainingEvent(event, currentUser) : false;
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
  onOpenIndexChange: (index: number | null) => void;
}) {
  const currentIndex = openIndex ?? 0;
  const image = images[currentIndex];

  return (
    <Dialog open={openIndex !== null} onOpenChange={(open) => onOpenIndexChange(open ? currentIndex : null)}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-brand-navy/80 backdrop-blur-sm" />
        <DialogContent className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(calc(100vw-3rem),1100px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[2rem] border border-white/20 bg-brand-navy p-0 text-white shadow-soft">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
            <DialogHeader className="text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/75">
                Galeria wydarzenia
              </p>
              <DialogTitle className="text-2xl font-semibold text-white">
                {eventTitle}
              </DialogTitle>
              <DialogDescription className="text-sm text-white/70">
                Przeglądaj zdjęcia wydarzenia {eventTitle}.
              </DialogDescription>
            </DialogHeader>
            <DialogClose className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15">
              Zamknij
            </DialogClose>
          </div>

          {image ? (
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-5 sm:px-6">
              <img
                src={image.url}
                alt={getCommunityEventImageAlt(eventTitle, currentIndex)}
                className="max-h-[58vh] w-auto max-w-full rounded-[1.7rem] object-contain shadow-soft"
              />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenIndexChange((currentIndex - 1 + images.length) % images.length)
                    }
                    className="absolute left-5 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Wstecz
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenIndexChange((currentIndex + 1) % images.length)}
                    className="absolute right-5 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Dalej
                  </button>
                </>
              )}
            </div>
          ) : null}

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto border-t border-white/10 px-5 py-4">
              {images.map((galleryImage, index) => (
                <CommunityEventGalleryThumbnail
                  key={galleryImage.id}
                  image={galleryImage}
                  alt={getCommunityEventImageAlt(eventTitle, index)}
                  onClick={() => onOpenIndexChange(index)}
                  isActive={index === currentIndex}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function CommunityEventStatusRow({
  items,
  className = "",
}: {
  items: CommunityEventCardStatusItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={["flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-muted", className].join(" ")}>
      {items.map((item) => (
        <span key={`${item.label}-${item.value}`}>
          {item.label}: <span className="font-semibold text-brand-navy">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

export function CommunityEventCard({
  event,
  showTrainerImage = true,
  renderActionSlot,
  statusItems = [],
}: CommunityEventCardProps) {
  const { currentUser, store } = useAppState();
  const trainer = store.trainers.find((item) => item.id === event.trainerId);
  const eventTags = getEventTags(event);
  const scheduleRows = getScheduleRows(event);
  const scheduleRangeLabel = getScheduleRangeLabel(event);
  const scheduleStartLabel = formatDate(getTrainingEventScheduleBounds(event).startsAt);
  const eventImages = event.eventImages ?? [];
  const communityLeadMaxHeight = eventImages.length > 0 ? "544px" : "336px";
  const canManage = canManagePublicEvent(event, currentUser);
  const leadName = getPublicLeadName(event, trainer?.displayName);
  const leadAvatarUrl =
    event.useEventImageAsCover === true ? eventImages[0]?.url || event.creatorAvatarUrl : event.creatorAvatarUrl;
  const communityEventTitle = event.title || event.location;
  const communityCoverImageIndex = getCommunityEventCoverImageIndex(event);
  const managementPath = `/panel/wydarzenia-spolecznosci/${event.id}`;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const compactTitle = getCompactCommunityEventTitle(event.title, event.location);
  const compactLocation = event.location;
  const durationDaysLabel = getEventDurationDaysLabel(event);
  const mobileSummarySchedule = scheduleRows.slice(0, 2);
  const compactTags = eventTags.slice(0, 2);
  const hasMoreCompactTags = eventTags.length > compactTags.length;
  const shouldShowExpandedTagsIndicator = hasMoreCompactTags || isMobileExpanded;
  const hasCustomActions = typeof renderActionSlot === "function";

  function renderDefaultActions(placement: "mobile" | "desktop") {
    return (
      <>
        {canManage && (
          <Link
            to={managementPath}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy shadow-soft"
          >
            {placement === "mobile" ? "Edytuj" : "Edytuj wydarzenie"}
          </Link>
        )}
        <Link
          to={`/kalendarz/${event.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-navy px-4 py-3 text-sm font-semibold text-white shadow-soft"
        >
          Chcę wziąć udział
          <ArrowRight size={16} />
        </Link>
      </>
    );
  }

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
          <CommunityEventStatusRow items={statusItems} className="mt-4" />
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
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {hasCustomActions ? renderActionSlot("mobile") : renderDefaultActions("mobile")}
          </div>
        </div>
      ) : null}
    </article>
  );

  return (
    <>
      {mobileCard}
      <article className="hidden rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft md:block">
        <div
          className={`grid gap-6 md:items-stretch ${
            showTrainerImage ? "md:grid-cols-[228px_minmax(0,1fr)]" : "grid-cols-1"
          }`}
        >
          {showTrainerImage && (
            <div
              className="relative overflow-hidden rounded-[1.75rem] bg-brand-shell md:h-full md:min-h-[336px]"
              style={{ maxHeight: communityLeadMaxHeight }}
            >
              {leadAvatarUrl ? (
                communityCoverImageIndex !== null ? (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(communityCoverImageIndex)}
                    aria-label="Otwórz galerię wydarzenia"
                    className="group h-full w-full cursor-zoom-in text-left"
                    >
                      <img
                        src={leadAvatarUrl}
                        alt={leadName}
                        className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                      />
                      <span className="pointer-events-none absolute inset-0 bg-brand-navy/0 transition group-hover:bg-brand-navy/10" />
                    </button>
                ) : (
                  <img
                    src={leadAvatarUrl}
                    alt={leadName}
                    className="h-full w-full object-cover object-top"
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-sky/40 to-white text-4xl font-semibold text-brand-navy">
                  {leadName.slice(0, 1)}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/45 to-transparent px-5 py-5 text-white">
                <p className="text-lg font-semibold">{leadName}</p>
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-2xl font-semibold text-brand-navy md:text-[2.2rem]">
                  {compactTitle}
                </h3>
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                  {event.location}
                </p>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand-sky-deep">
                  {scheduleRangeLabel}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {hasCustomActions ? renderActionSlot("desktop") : renderDefaultActions("desktop")}
              </div>
            </div>

            <p className="mt-5 max-w-3xl text-brand-muted">{event.summary}</p>
            <CommunityEventStatusRow items={statusItems} className="mt-4" />

            <div
              className={`mt-6 grid gap-3 ${
                scheduleRows.length > 1 ? "md:grid-cols-2 xl:grid-cols-4" : "grid-cols-1"
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

            {eventTags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {eventTags.map((tag) => (
                  <span
                    key={`${event.id}-${tag}`}
                    className="rounded-full bg-brand-sky/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {eventImages.length > 0 && (
              <div className="mt-5 flex gap-4 overflow-x-auto pb-1 pr-2">
                  {eventImages.map((image, index) => (
                    <CommunityEventGalleryThumbnail
                      key={image.id}
                      image={image}
                      alt={getCommunityEventImageAlt(communityEventTitle, index)}
                      onClick={() => setLightboxIndex(index)}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
        {eventImages.length > 0 && (
          <CommunityEventGalleryLightbox
            eventTitle={communityEventTitle}
            images={eventImages}
            openIndex={lightboxIndex}
            onOpenIndexChange={setLightboxIndex}
          />
        )}
      </article>
    </>
  );
}
