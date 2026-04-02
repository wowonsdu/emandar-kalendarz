import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";
import { useAppState } from "./providers/AppProviders";
import type { AppRole } from "@/domain/types";
import { getRoleLabel, isCommunityBrandStatus } from "@/domain/utils";

function brandNavLinkClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
    isActive
      ? "bg-brand-navy text-white"
      : "text-brand-navy/80 hover:bg-white hover:text-brand-navy",
  ].join(" ");
}

function exactNavLinkClass(currentPath: string, targetPath: string) {
  return brandNavLinkClass({ isActive: currentPath === targetPath });
}

const publicNavItems = [
  { to: "/kalendarz", label: "Kalendarz", icon: CalendarDays },
  { to: "/trenerzy", label: "Przekazujacy Wiedze", icon: Users },
  { to: "/wydarzenia-spolecznosci", label: "Społeczność", icon: Bell },
] as const;

function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <div
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11",
          inverted ? "bg-white/10 text-white" : "bg-brand-sky/15 text-brand-navy",
        ].join(" ")}
      >
        <Sparkles size={20} />
      </div>
      <div className="min-w-0">
        <div
          className={[
            "truncate text-[10px] uppercase tracking-[0.28em] sm:text-xs sm:tracking-[0.35em]",
            inverted ? "text-white/60" : "text-brand-navy/60",
          ].join(" ")}
        >
          Emandar
        </div>
        <div
          className={[
            "truncate text-base font-semibold sm:text-lg",
            inverted ? "text-white" : "text-brand-navy",
          ].join(" ")}
        >
          Kalendarz
        </div>
      </div>
    </Link>
  );
}

export function PublicLayout() {
  const { currentUser, getRoleHomePath } = useAppState();
  const location = useLocation();
  const userHomePath = currentUser ? getRoleHomePath(currentUser.role) : "/login";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, currentUser?.role]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!isMobileMenuOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(126,211,255,0.35),_transparent_32%),linear-gradient(180deg,_#f8fcff_0%,_#eef7fd_55%,_#ffffff_100%)]">
      <header className="sticky top-0 z-30 border-b border-brand-line/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4 lg:px-8">
          <div className="min-w-0 md:hidden">
            <BrandMark />
          </div>
          <div className="hidden min-w-0 md:block">
            <BrandMark />
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            {publicNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={() => exactNavLinkClass(location.pathname, item.to)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            {currentUser ? (
              <Link
                to={userHomePath}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-xs font-semibold text-white shadow-soft sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Moja Przestrzen</span>
                <span className="sm:hidden">Panel</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold text-brand-navy sm:px-5 sm:py-2.5 sm:text-sm"
                >
                  <ShieldCheck size={15} className="hidden sm:block" />
                  Logowanie
                </Link>
                <Link
                  to="/rejestracja"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-3 py-2 text-xs font-semibold text-white shadow-soft sm:px-5 sm:py-2.5 sm:text-sm"
                >
                  <ShieldCheck size={15} className="hidden sm:block" />
                  Rejestracja
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="ml-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-line bg-white text-brand-navy shadow-soft md:hidden"
            aria-label="Otwórz menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Zamknij menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-brand-navy/45 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 right-0 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border-l border-white/10 bg-brand-navy text-white shadow-2xl">
            <div className="flex min-h-full flex-col px-5 py-6">
              <div className="mb-8 flex items-start justify-between gap-4">
                <BrandMark inverted />
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/20"
                  aria-label="Zamknij menu"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="space-y-2">
                {publicNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={[
                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                        isActive
                          ? "bg-white text-brand-navy"
                          : "text-white/75 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                    >
                      <Icon size={18} />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="mt-8 space-y-3 rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
                {currentUser ? (
                  <Link
                    to={userHomePath}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-4 py-3 text-sm font-semibold text-white shadow-soft"
                  >
                    <LayoutDashboard size={16} />
                    Moja Przestrzen
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20"
                    >
                      <ShieldCheck size={16} />
                      Logowanie
                    </Link>
                    <Link
                      to="/rejestracja"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-navy px-4 py-3 text-sm font-semibold text-white shadow-soft"
                    >
                      <ShieldCheck size={16} />
                      Rejestracja
                    </Link>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <footer className="border-t border-brand-line/70 bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-brand-muted sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-brand-navy">Emandar Kalendarz</p>
            <p>Osobna aplikacja React podpieta do emandar.pl przez link w menu.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/kalendarz" className="hover:text-brand-navy">
              Najblizsze szkolenia
            </Link>
            <Link to="/wydarzenia-spolecznosci" className="hover:text-brand-navy">
              Wydarzenia społeczności
            </Link>
            <Link to="/trenerzy" className="hover:text-brand-navy">
              Przekazujacy Wiedze
            </Link>
            <Link to={userHomePath} className="hover:text-brand-navy">
              {currentUser ? "Moja Przestrzen" : "Panel"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function panelItems(
  role: AppRole,
  isCommunityTrainer = false,
  pendingCommunityApprovals = 0,
) {
  const base = [
    { to: "/panel/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/kalendarz", label: "Widok publiczny", icon: Sparkles },
  ];

  if (role === "participant") {
    return [
      ...base,
      { to: "/panel/ustawienia", label: "Mój profil", icon: ShieldCheck },
      { to: "/panel/szkolenia", label: "Szkolenia Emandar", icon: CalendarDays },
      {
        to: "/panel/wydarzenia-spolecznosci",
        label: "Wydarzenia społeczności",
        icon: CalendarDays,
      },
    ];
  }

  if (role === "organizer") {
    return [
      ...base,
      { to: "/panel/ustawienia", label: "Mój profil", icon: ShieldCheck },
      { to: "/panel/grupy", label: "Grupy", icon: Users },
      { to: "/panel/szkolenia", label: "Szkolenia Emandar", icon: CalendarDays },
      {
        to: "/panel/wydarzenia-spolecznosci",
        label: "Wydarzenia społeczności",
        icon: CalendarDays,
      },
      {
        to: "/panel/terminy",
        label: "Terminy",
        icon: CalendarDays,
      },
      { to: "/panel/powiadomienia", label: "Powiadomienia", icon: Bell },
      { to: "/panel/relacje", label: "Relacje", icon: ShieldCheck },
      { to: "/panel/zgloszenia", label: "Zgloszenia", icon: Bell },
    ];
  }

  if (role === "trainer") {
    return [
      ...base,
      { to: "/panel/ustawienia", label: "Mój profil", icon: ShieldCheck },
      { to: "/panel/grupy", label: "Grupy", icon: Users },
      { to: "/panel/szkolenia", label: "Szkolenia Emandar", icon: CalendarDays },
      {
        to: "/panel/wydarzenia-spolecznosci",
        label: "Wydarzenia społeczności",
        icon: CalendarDays,
      },
      {
        to: "/panel/terminy",
        label: "Terminy",
        icon: CalendarDays,
      },
      { to: "/panel/powiadomienia", label: "Powiadomienia", icon: Bell },
      ...(isCommunityTrainer
        ? []
        : [{ to: "/panel/organizatorzy", label: "Organizatorzy", icon: Users }]),
      { to: "/panel/zgloszenia", label: "Zgloszenia", icon: Bell },
    ];
  }

  return [
    ...base,
    { to: "/panel/ustawienia", label: "Mój profil", icon: ShieldCheck },
    { to: "/panel/grupy", label: "Grupy", icon: Users },
    { to: "/panel/rejestracje", label: "Rejestracje", icon: ShieldCheck },
    { to: "/panel/trenerzy", label: "Przekazujacy Wiedze", icon: Users },
    { to: "/panel/organizatorzy", label: "Organizatorzy", icon: Users },
    { to: "/panel/szkolenia", label: "Szkolenia Emandar", icon: CalendarDays },
    {
      to: "/panel/wydarzenia-spolecznosci",
      label: "Wydarzenia społeczności",
      icon: CalendarDays,
      badgeCount: pendingCommunityApprovals,
    },
    { to: "/panel/terminy", label: "Terminy", icon: CalendarDays },
    { to: "/panel/powiadomienia", label: "Powiadomienia", icon: Bell },
    { to: "/panel/relacje", label: "Relacje", icon: ShieldCheck },
    { to: "/panel/zgloszenia", label: "Zgloszenia", icon: Bell },
  ];
}

function getPanelBackPath(pathname: string, search: string) {
  const searchParams = new URLSearchParams(search);
  const mode = searchParams.get("mode");

  if (pathname === "/panel/grupy" && mode === "create") {
    return "/panel/grupy";
  }

  if (pathname.startsWith("/panel/grupy/")) {
    if (mode === "edit") {
      return pathname;
    }
    return "/panel/grupy";
  }

  if (pathname === "/panel/szkolenia/utworz" || pathname.startsWith("/panel/szkolenia/")) {
    return "/panel/szkolenia";
  }

  if (
    pathname === "/panel/wydarzenia-spolecznosci/utworz" ||
    pathname.startsWith("/panel/wydarzenia-spolecznosci/")
  ) {
    return "/panel/wydarzenia-spolecznosci";
  }

  if (pathname === "/panel/terminy" && (searchParams.get("groupId") || searchParams.get("slotId"))) {
    return "/panel/terminy";
  }

  return null;
}

function PanelNavigationContent({
  availableRoles,
  currentRole,
  currentUserEmailOrPhone,
  displayName,
  items,
  notificationsCount,
  onClose,
  onRoleChange,
  onSignOut,
}: {
  availableRoles: AppRole[];
  currentRole: AppRole;
  currentUserEmailOrPhone: string;
  displayName: string;
  items: ReturnType<typeof panelItems>;
  notificationsCount: number;
  onClose?: () => void;
  onRoleChange: (role: AppRole) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex h-full flex-col px-5 py-6">
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">
              Panel Emandar
            </p>
            <p className="mt-2 text-2xl font-semibold">{displayName}</p>
            <p className="text-sm text-white/70">{currentUserEmailOrPhone}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/20 lg:hidden"
              aria-label="Zamknij menu"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
        {availableRoles.length > 1 && (
          <label className="mt-4 grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Aktywna rola
            </span>
            <select
              value={currentRole}
              onChange={(event) => onRoleChange(event.target.value as AppRole)}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role} className="text-brand-navy">
                  {getRoleLabel(role)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-white text-brand-navy"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                ].join(" ")
              }
            >
              <Icon size={18} />
              <span className="min-w-0 flex-1">{item.label}</span>
              {item.badgeCount ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-1 text-xs font-semibold text-white">
                  <Bell size={12} />
                  {item.badgeCount}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-sm text-white/80">
          <span>Nowe powiadomienia</span>
          <span className="rounded-full bg-white/15 px-2 py-1 font-semibold">
            {notificationsCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
        >
          <LogOut size={16} />
          Wyloguj
        </button>
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { authReady, currentUser, currentUserReady } = useAppState();
  const location = useLocation();

  if (!authReady || !currentUserReady) {
    return null;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function PanelLayout() {
  const { availableRoles, currentUser, notificationsCount, setActiveRole, signOut, store } =
    useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const trainerProfile = store.trainers.find((item) => item.userId === currentUser?.id);
  const organizerProfile = store.organizers.find((item) => item.userId === currentUser?.id);
  const pendingCommunityApprovals = store.trainingEvents.filter(
    (item) =>
      isCommunityBrandStatus(item.brandStatus) &&
      item.publicationApprovalStatus === "pending",
  ).length;
  const items = panelItems(
    currentUser?.role ?? "participant",
    currentUser?.role === "trainer" && isCommunityBrandStatus(trainerProfile?.brandStatus),
    currentUser?.role === "admin" ? pendingCommunityApprovals : 0,
  );
  const currentUserEmailOrPhone = currentUser?.email || currentUser?.phone || "Konto SMS";
  const panelBackPath = getPanelBackPath(location.pathname, location.search);
  const organizerCanCreateOfficialTraining =
    currentUser?.role === "organizer" &&
    Boolean(organizerProfile) &&
    store.groups.some(
      (group) => group.organizerId === organizerProfile?.id && group.status === "active",
    );
  const participantCanCreateOfficialTraining =
    currentUser?.role === "participant" &&
    Boolean(organizerProfile) &&
    store.relations.some(
      (relation) =>
        relation.organizerId === organizerProfile?.id &&
        relation.status === "approved",
    );
  const trainerCanCreateOfficialTraining = currentUser?.role === "trainer";
  const canCreateOfficialTraining =
    trainerCanCreateOfficialTraining ||
    organizerCanCreateOfficialTraining ||
    participantCanCreateOfficialTraining;
  const canCreateCommunityEvent =
    currentUser?.role === "participant" || currentUser?.role === "trainer";
  const headerCreateShortcut =
    location.pathname === "/panel/grupy" && currentUser.role === "organizer"
      ? {
          to: "/panel/grupy/utworz",
          mobileLabel: "Utwórz",
          desktopLabel: "Utwórz grupę",
          ariaLabel: "Utwórz grupę",
        }
      : location.pathname === "/panel/szkolenia" && canCreateOfficialTraining
        ? {
            to: "/panel/szkolenia/utworz",
            mobileLabel: "Utwórz",
            desktopLabel: "Utwórz szkolenie",
            ariaLabel: "Utwórz szkolenie",
          }
        : location.pathname === "/panel/wydarzenia-spolecznosci" && canCreateCommunityEvent
          ? {
              to: "/panel/wydarzenia-spolecznosci/utworz",
              mobileLabel: "Utwórz",
              desktopLabel: "Utwórz wydarzenie",
              ariaLabel: "Utwórz wydarzenie",
            }
          : null;

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, currentUser?.role]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!isMobileMenuOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, [isMobileMenuOpen]);

  function handleRoleChange(role: AppRole) {
    void setActiveRole(role).then(() => {
      navigate("/panel/dashboard");
    });
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-brand-shell">
      <div className="grid min-h-screen w-full lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-brand-line/80 bg-brand-navy text-white lg:block">
          <div className="sticky top-0 min-h-screen">
            <PanelNavigationContent
              availableRoles={availableRoles}
              currentRole={currentUser.role}
              currentUserEmailOrPhone={currentUserEmailOrPhone}
              displayName={currentUser.displayName}
              items={items}
              notificationsCount={notificationsCount}
              onRoleChange={handleRoleChange}
              onSignOut={() => {
                void signOut();
              }}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-brand-line/80 bg-white/90 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-10">
              <div className="min-w-0">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-brand-muted sm:text-xs sm:tracking-[0.32em]">
                    {getRoleLabel(currentUser.role)}
                  </p>
                  <h1 className="whitespace-nowrap text-lg font-semibold leading-tight text-brand-navy sm:text-2xl">
                    Panel zarzadzania
                  </h1>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {panelBackPath ? (
                  <Link
                    to={panelBackPath}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-line bg-white text-brand-navy shadow-soft lg:hidden"
                    aria-label="Wróć"
                  >
                    <ArrowLeft size={20} />
                  </Link>
                ) : null}
                {headerCreateShortcut ? (
                  <Link
                    to={headerCreateShortcut.to}
                    className="inline-flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-brand-line bg-white px-3 text-brand-navy shadow-soft sm:gap-2 sm:px-3.5"
                    aria-label={headerCreateShortcut.ariaLabel}
                  >
                    <Plus size={18} />
                    <span className="text-sm font-semibold sm:hidden">
                      {headerCreateShortcut.mobileLabel}
                    </span>
                    <span className="hidden text-sm font-semibold sm:inline">
                      {headerCreateShortcut.desktopLabel}
                    </span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-line bg-white text-brand-navy shadow-soft lg:hidden"
                  aria-label="Otwórz menu"
                >
                  <Menu size={22} />
                </button>
              </div>
            </div>
          </header>

          <main className="px-3 py-4 sm:px-6 sm:py-6 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Zamknij menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-brand-navy/45 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 right-0 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border-l border-brand-line/80 bg-brand-navy text-white shadow-2xl">
            <PanelNavigationContent
              availableRoles={availableRoles}
              currentRole={currentUser.role}
              currentUserEmailOrPhone={currentUserEmailOrPhone}
              displayName={currentUser.displayName}
              items={items}
              notificationsCount={notificationsCount}
              onClose={() => setIsMobileMenuOpen(false)}
              onRoleChange={handleRoleChange}
              onSignOut={() => {
                setIsMobileMenuOpen(false);
                void signOut();
              }}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
