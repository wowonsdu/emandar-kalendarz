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
  Phone,
  ShieldCheck,
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
import { Link, Navigate, useLocation, useParams } from "react-router";
import { toast } from "sonner";
import { useAppState } from "../providers/AppProviders";
import {
  aggregateEventCapacityStats,
  getAvailablePlaces,
  getEventFillRate,
  getRoleLabel,
  getTrainingEventStatusLabel,
  isCommunityBrandStatus,
  resolveMinimumParticipants,
  resolveTrainingEventStatus,
  sortEventsByDate,
  sortEventsByFillRate,
} from "@/domain/utils";
import type {
  EmandarBrandStatus,
  EnrollmentRequest,
  TrainingEvent,
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

function PanelSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-4xl font-semibold text-brand-navy">{title}</h2>
        <p className="mt-3 max-w-3xl text-lg text-brand-muted">{description}</p>
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

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);
  const relevantEvents =
    currentUser.role === "trainer"
      ? store.trainingEvents.filter((item) => item.trainerId === trainerProfile?.id)
      : currentUser.role === "organizer"
        ? store.trainingEvents.filter(
            (item) => item.organizerId === organizerProfile?.id,
          )
        : store.trainingEvents;
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
  const { currentUser, decideEnrollment, store } = useAppState();

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );

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
                    ? "md:grid-cols-[1fr_1.15fr]"
                    : "md:grid-cols-[1fr_1fr_1.15fr]"
                }`}
              >
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
    </PanelSection>
  );
}

export function RelationsPage() {
  const { currentUser, decideRelation, requestRelation, store } = useAppState();
  const [selectedTrainer, setSelectedTrainer] = useState(
    store.trainers[0]?.id ?? "",
  );

  if (!currentUser) {
    return null;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const isCommunityTrainer = isCommunityTrainerProfile(trainerProfile?.brandStatus);

  if (currentUser.role === "trainer") {
    return <Navigate to={isCommunityTrainer ? "/panel/szkolenia" : "/panel/organizatorzy"} replace />;
  }
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
            </article>
          );
        })}
      </div>
    </PanelSection>
  );
}

export function GroupsPage() {
  const { createGroup, currentUser, store } = useAppState();
  const [form, setForm] = useState({
    organizerId: store.organizers[0]?.id ?? "",
    trainerId: store.trainers[0]?.id ?? "",
    name: "",
    visibility: "public" as "private" | "public",
    location: "",
    notes: "",
  });

  if (!currentUser) {
    return null;
  }

  const organizerProfile = store.organizers.find(
    (item) => item.userId === currentUser.id,
  );
  const availableTrainers =
    currentUser.role === "organizer" && organizerProfile
      ? store.trainers.filter((trainer) =>
          store.relations.some(
            (relation) =>
              relation.organizerId === organizerProfile.id &&
              relation.trainerId === trainer.id &&
              relation.status === "approved",
          ),
        )
      : store.trainers;
  const groups =
    currentUser.role === "admin"
      ? store.groups
      : currentUser.role === "organizer"
        ? store.groups.filter((group) => group.organizerId === organizerProfile?.id)
        : store.groups.filter(
            (group) =>
              group.trainerId ===
              store.trainers.find((item) => item.userId === currentUser.id)?.id,
          );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createGroup({
        ...form,
        organizerId: currentUser.role === "admin" ? form.organizerId : undefined,
      });
      toast.success("Dodano nową grupę.");
      setForm((current) => ({
        ...current,
        name: "",
        location: "",
        notes: "",
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać grupy.");
    }
  }

  return (
    <PanelSection
      eyebrow="Grupy"
      title="Tworzenie i obsługa grup"
      description="Organizator zakłada grupę i przypisuje do niej Przekazującego Wiedzę. Admin ma pełny wgląd, a Przekazujący Wiedzę widzi grupy, do których został przypisany."
    >
      {(currentUser.role === "organizer" || currentUser.role === "admin") && (
        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {currentUser.role === "admin" && (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">Organizator</span>
                <select
                  value={form.organizerId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      organizerId: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
                >
                  {store.organizers.map((organizer) => (
                    <option key={organizer.id} value={organizer.id}>
                      {organizer.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}

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
                {availableTrainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Nazwa grupy</span>
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Miejsce</span>
              <input
                required
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

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-brand-navy">Widoczność</span>
              <select
                value={form.visibility}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    visibility: event.target.value as "private" | "public",
                  }))
                }
                className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              >
                <option value="public">Publiczna</option>
                <option value="private">Prywatna</option>
              </select>
            </label>

            <label className="grid gap-2 xl:col-span-2">
              <span className="text-sm font-semibold text-brand-navy">Notatki</span>
              <textarea
                rows={4}
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
            <Users size={16} />
            Dodaj grupę
          </button>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyPanelState
              title="Brak grup"
              description="Nowe grupy utworzone przez organizatorów pojawią się tutaj."
            />
          </div>
        )}
        {groups.map((group) => {
          const trainer = store.trainers.find((item) => item.id === group.trainerId);
          const organizer = store.organizers.find((item) => item.id === group.organizerId);

          return (
            <article
              key={group.id}
              className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold text-brand-navy">{group.name}</h3>
                  <p className="mt-2 text-brand-muted">{group.notes}</p>
                </div>
                <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                  {group.visibility}
                </span>
              </div>
              <div className="mt-5 space-y-2 text-sm text-brand-muted">
                  <p>Przekazujący Wiedzę: {trainer?.displayName}</p>
                <p>Organizator: {organizer?.displayName}</p>
                <p>Miejsce: {group.location}</p>
              </div>
            </article>
          );
        })}
      </div>
    </PanelSection>
  );
}

export function AvailabilityPage() {
  const { addAvailabilitySlot, currentUser, store } = useAppState();
  const [form, setForm] = useState({
    trainerId: store.trainers[0]?.id ?? "",
    startsAt: "2026-05-05T17:00",
    endsAt: "2026-05-05T20:00",
    location: "Warszawa / online",
    notes: "Nowy termin",
  });

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
    store,
    updateTrainingEventBrandStatus,
    updateTrainingEventManagement,
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

  const events = useMemo(
    () =>
      currentUser.role === "trainer"
        ? store.trainingEvents.filter((item) => item.trainerId === trainerProfile?.id)
        : currentUser.role === "organizer"
          ? store.trainingEvents.filter((item) => item.organizerId === organizerProfile?.id)
          : store.trainingEvents,
    [currentUser.role, organizerProfile?.id, store.trainingEvents, trainerProfile?.id],
  );
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
  const [trainerEventForm, setTrainerEventForm] = useState({
    organizerId: "",
    summary: "",
    description: "",
    type: "Warsztat stacjonarny",
    status: "active" as TrainingEventStatus,
    startsAt: "",
    endsAt: "",
    dayTwoStartsAt: "",
    dayTwoEndsAt: "",
    location: "",
    capacity: "20",
    minimumParticipants: "10",
    isPublished: true,
  });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventManagementDrafts, setEventManagementDrafts] = useState<
    Record<
      string,
      {
        status: TrainingEventStatus;
        capacity: string;
        minimumParticipants: string;
        transferTargetEventId: string;
      }
    >
  >({});
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [transferringEventId, setTransferringEventId] = useState<string | null>(null);

  if (isCreatorView && currentUser.role !== "trainer") {
    return <Navigate to="/panel/szkolenia" replace />;
  }

  function getEventManagementDraft(event: TrainingEvent) {
    return (
      eventManagementDrafts[event.id] ?? {
        status: resolveTrainingEventStatus(event.status),
        capacity: String(event.capacity),
        minimumParticipants: String(resolveMinimumParticipants(event)),
        transferTargetEventId: "",
      }
    );
  }

  function updateEventManagementDraft(
    event: TrainingEvent,
    patch: Partial<ReturnType<typeof getEventManagementDraft>>,
  ) {
    const fallbackDraft = {
      status: resolveTrainingEventStatus(event.status),
      capacity: String(event.capacity),
      minimumParticipants: String(resolveMinimumParticipants(event)),
      transferTargetEventId: "",
    };

    setEventManagementDrafts((previous) => ({
      ...previous,
      [event.id]: {
        ...(previous[event.id] ?? fallbackDraft),
        ...patch,
      },
    }));
  }

  function clearEventManagementDraft(eventId: string) {
    setEventManagementDrafts((previous) => {
      if (!(eventId in previous)) {
        return previous;
      }

      const next = { ...previous };
      delete next[eventId];
      return next;
    });
  }

  useEffect(() => {
    if (currentUser.role !== "trainer" || isCommunityTrainer) {
      return;
    }

    setTrainerEventForm((previous) => {
      const nextOrganizerId = previous.organizerId || availableOrganizers[0]?.id || "";
      if (previous.organizerId === nextOrganizerId) {
        return previous;
      }

      return {
        ...previous,
        organizerId: nextOrganizerId,
      };
    });
  }, [availableOrganizers, currentUser.role, isCommunityTrainer]);

  return (
    <PanelSection
      eyebrow="Szkolenia"
      title={
        isCreatorView
          ? "Kreator wydarzeń"
          : currentUser.role === "trainer"
            ? "Moje szkolenia"
            : "Lista wydarzeń"
      }
      description={
        isCreatorView
          ? "Tutaj dodajesz nowe wydarzenia bez mieszania tego z listą już utworzonych pozycji."
          : "To jest warstwa operacyjna wydarzeń, które pochodzą bezpośrednio z Firestore."
      }
    >
      {isCreatorView &&
        currentUser.role === "trainer" &&
        (!isCommunityTrainer && availableOrganizers.length === 0 ? (
          <EmptyPanelState
            title="Najpierw relacja z organizatorem"
            description="Aby dodać szkolenie, Przekazujący Wiedzę musi mieć przynajmniej jedną zaakceptowaną relację z organizatorem."
          />
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setCreatingEvent(true);

              try {
                await createTrainingEvent({
                  organizerId: isCommunityTrainer ? undefined : trainerEventForm.organizerId,
                  summary: trainerEventForm.summary,
                  description: trainerEventForm.description,
                  type: isCommunityTrainer
                    ? "Wydarzenie społeczności"
                    : trainerEventForm.type,
                  status: trainerEventForm.status,
                  startsAt: trainerEventForm.startsAt,
                  endsAt: trainerEventForm.endsAt,
                  dayTwoStartsAt: trainerEventForm.dayTwoStartsAt,
                  dayTwoEndsAt: trainerEventForm.dayTwoEndsAt,
                  location: trainerEventForm.location,
                  capacity: Number(trainerEventForm.capacity),
                  minimumParticipants: Number(trainerEventForm.minimumParticipants),
                  isPublished: trainerEventForm.isPublished,
                });
                toast.success("Szkolenie zostało dodane.");
                setTrainerEventForm((previous) => ({
                  ...previous,
                  summary: "",
                  description: "",
                  status: "active",
                  startsAt: "",
                  endsAt: "",
                  dayTwoStartsAt: "",
                  dayTwoEndsAt: "",
                  location: "",
                  capacity: "20",
                  minimumParticipants: "10",
                  isPublished: true,
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

            <div className="grid gap-4 xl:grid-cols-2">
              {!isCommunityTrainer && (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">Organizator</span>
                  <select
                    required
                    value={trainerEventForm.organizerId}
                    onChange={(event) =>
                      setTrainerEventForm((previous) => ({
                        ...previous,
                        organizerId: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                  >
                    {availableOrganizers.map((organizer) => (
                      <option key={organizer.id} value={organizer.id}>
                        {organizer.displayName}
                      </option>
                    ))}
                  </select>
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
                <span className="text-sm font-semibold text-brand-navy">Dzień 1: start</span>
                <input
                  required
                  type="datetime-local"
                  value={trainerEventForm.startsAt}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      startsAt: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">Dzień 1: koniec</span>
                <input
                  required
                  type="datetime-local"
                  value={trainerEventForm.endsAt}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      endsAt: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">Dzień 2: start</span>
                <input
                  required
                  type="datetime-local"
                  value={trainerEventForm.dayTwoStartsAt}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      dayTwoStartsAt: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-brand-navy">Dzień 2: koniec</span>
                <input
                  required
                  type="datetime-local"
                  value={trainerEventForm.dayTwoEndsAt}
                  onChange={(event) =>
                    setTrainerEventForm((previous) => ({
                      ...previous,
                      dayTwoEndsAt: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
                />
              </label>

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

      {!isCreatorView && <div className="space-y-4">
        {events.length === 0 && (
          <EmptyPanelState
            title="Brak wydarzeń"
            description="Po seedzie albo dodaniu wydarzeń pojawią się tutaj szkolenia."
          />
        )}
        {sortEventsByDate(events).map((event) => {
          const managementDraft = getEventManagementDraft(event);
          const eventRequests = store.enrollmentRequests.filter(
            (item) => item.eventId === event.id,
          );
          const activeRequestsCount = eventRequests.filter(
            (item) => item.finalStatus !== "rejected",
          ).length;
          const transferOptions = sortEventsByDate(
            events.filter((item) => {
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
          <article
            key={event.id}
            className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold text-brand-navy">{event.location}</h3>
                <p className="mt-2 text-brand-muted">{event.summary}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                  {event.isPublished ? "opublikowane" : "ukryte"}
                </span>
                <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                  {getBrandStatusLabel(event.brandStatus)}
                </span>
                <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
                  {getTrainingEventStatusLabel(event.status)}
                </span>
              </div>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-brand-muted md:grid-cols-4">
              <p>
                {formatDate(event.startsAt)}
                {event.dayTwoStartsAt ? ` / ${formatDate(event.dayTwoStartsAt)}` : ""}
              </p>
              <p>
                {formatShortTime(event.startsAt)} - {formatShortTime(event.endsAt)}
                {event.dayTwoStartsAt && event.dayTwoEndsAt
                  ? ` • ${formatShortTime(event.dayTwoStartsAt)} - ${formatShortTime(event.dayTwoEndsAt)}`
                  : ""}
              </p>
              <p>
                {event.enrolledCount}/{event.capacity} uczestników
              </p>
              <p>
                Prog: {resolveMinimumParticipants(event)} osob, aktywne zgloszenia:{" "}
                {activeRequestsCount}
              </p>
            </div>
            <div className="mt-5 rounded-3xl border border-brand-line bg-brand-shell p-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_220px_220px_1fr]">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">
                    Status wydarzenia
                  </span>
                  <select
                    value={managementDraft.status}
                    onChange={(changeEvent) =>
                      updateEventManagementDraft(event, {
                        status: changeEvent.target.value as TrainingEventStatus,
                      })
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
                    value={managementDraft.capacity}
                    onChange={(changeEvent) =>
                      updateEventManagementDraft(event, {
                        capacity: changeEvent.target.value,
                      })
                    }
                    className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">
                    Prog uczestnikow
                  </span>
                  <input
                    min={1}
                    type="number"
                    value={managementDraft.minimumParticipants}
                    onChange={(changeEvent) =>
                      updateEventManagementDraft(event, {
                        minimumParticipants: changeEvent.target.value,
                      })
                    }
                    className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-brand-navy">
                    Przenies aktywne zgloszenia do
                  </span>
                  <select
                    value={managementDraft.transferTargetEventId}
                    onChange={(changeEvent) =>
                      updateEventManagementDraft(event, {
                        transferTargetEventId: changeEvent.target.value,
                      })
                    }
                    className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-brand-navy outline-none"
                  >
                    <option value="">Bez przenoszenia</option>
                    {transferOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.location} | {formatDate(option.startsAt)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={savingEventId === event.id}
                  onClick={async () => {
                    setSavingEventId(event.id);

                    try {
                      await updateTrainingEventManagement(
                        event.id,
                        managementDraft.status,
                        Number(managementDraft.capacity) || event.capacity,
                        Number(managementDraft.minimumParticipants) ||
                          resolveMinimumParticipants(event),
                      );
                      clearEventManagementDraft(event.id);
                      toast.success("Zapisano ustawienia szkolenia.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się zapisać ustawień szkolenia.",
                      );
                    } finally {
                      setSavingEventId(null);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingEventId === event.id ? "Zapisywanie..." : "Zapisz status"}
                </button>
                <button
                  type="button"
                  disabled={
                    transferringEventId === event.id ||
                    !managementDraft.transferTargetEventId ||
                    activeRequestsCount === 0
                  }
                  onClick={async () => {
                    setTransferringEventId(event.id);

                    try {
                      await updateTrainingEventManagement(
                        event.id,
                        managementDraft.status,
                        Number(managementDraft.capacity) || event.capacity,
                        Number(managementDraft.minimumParticipants) ||
                          resolveMinimumParticipants(event),
                        managementDraft.transferTargetEventId,
                      );
                      clearEventManagementDraft(event.id);
                      toast.success("Przeniesiono aktywne zgłoszenia.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się przenieść zgłoszeń.",
                      );
                    } finally {
                      setTransferringEventId(null);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy disabled:opacity-60"
                >
                  {transferringEventId === event.id
                    ? "Przenoszenie..."
                    : "Zapisz i przenies zgloszenia"}
                </button>
              </div>
              <p className="mt-3 text-sm text-brand-muted">
                Przenoszone sa zgloszenia, ktore nie zostaly odrzucone.
              </p>
            </div>
            {currentUser.role === "admin" && (
              <div className="mt-5 max-w-sm">
                <AdminBrandStatusSelect
                  value={event.brandStatus}
                  onChange={(brandStatus) =>
                    updateTrainingEventBrandStatus(event.id, brandStatus)
                  }
                />
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to={`/panel/szkolenia/${event.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
              >
                Otworz pelny widok
              </Link>
              <Link
                to={`/kalendarz/${event.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-navy"
              >
                Zobacz widok publiczny
              </Link>
            </div>
          </article>
          );
        })}
      </div>}
    </PanelSection>
  );
}

export function EventManagementPage() {
  const { eventId } = useParams();
  const {
    currentUser,
    manageEnrollmentRequest,
    store,
    updateTrainingEventManagement,
  } = useAppState();
  const [savingSettings, setSavingSettings] = useState(false);
  const [movingRequestId, setMovingRequestId] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [transferSelections, setTransferSelections] = useState<Record<string, string>>({});
  const [settingsDraft, setSettingsDraft] = useState({
    status: "active" as TrainingEventStatus,
    capacity: "1",
    minimumParticipants: "1",
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

  const canManageEvent =
    currentUser.role === "admin" ||
    (currentUser.role === "trainer" && currentUser.profileId === event.trainerId) ||
    (currentUser.role === "organizer" && currentUser.profileId === event.organizerId);

  if (!canManageEvent) {
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
      title={event.location}
      description="Tutaj zarządzasz ustawieniami wydarzenia i listą osób, które chcą wziąć w nim udział."
    >
      <article className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
              {event.title}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-brand-navy">{event.location}</h3>
            <p className="mt-2 text-brand-muted">{event.summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-brand-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
              {event.isPublished ? "opublikowane" : "ukryte"}
            </span>
            <span className="rounded-full border border-brand-line px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy">
              {getTrainingEventStatusLabel(event.status)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-brand-muted md:grid-cols-4">
          <p>
            {formatDate(event.startsAt)}
            {event.dayTwoStartsAt ? ` / ${formatDate(event.dayTwoStartsAt)}` : ""}
          </p>
          <p>
            {formatShortTime(event.startsAt)} - {formatShortTime(event.endsAt)}
            {event.dayTwoStartsAt && event.dayTwoEndsAt
              ? ` / ${formatShortTime(event.dayTwoStartsAt)} - ${formatShortTime(event.dayTwoEndsAt)}`
              : ""}
          </p>
          <p>Maks. miejsc: {event.capacity}</p>
          <p>Minimalny prog: {resolveMinimumParticipants(event)}</p>
        </div>

        <div className="mt-6 rounded-3xl border border-brand-line bg-brand-shell p-4">
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
        </div>
      </article>

      <div className="space-y-4">
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
      </div>
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
              description="Po seedzie Firebase katalog osób będzie widoczny tutaj."
            />
          </div>
        )}
        {items.map((item) => (
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
        ))}
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
  });
  const [organizerForm, setOrganizerForm] = useState({
    displayName: "",
    contactName: "",
    location: "",
    description: "",
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
    });
  }, [organizerProfile]);

  if (!currentUser) {
    return null;
  }

  if (currentUser.role === "trainer" && trainerProfile) {
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
  const { currentUser, decideAccountRequest, store } = useAppState();

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <PanelSection
        eyebrow="Rejestracje"
        title="Wnioski o konto"
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
      title="Nowe wnioski o konto"
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
                  {request.requestedRole}
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

            {request.status === "pending" && (
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
