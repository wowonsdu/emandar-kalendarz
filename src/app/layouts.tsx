import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Sparkles,
  Users,
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

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-sky/15 text-brand-navy">
        <Sparkles size={20} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.35em] text-brand-navy/60">
          Emandar
        </div>
        <div className="text-lg font-semibold text-brand-navy">Kalendarz</div>
      </div>
    </Link>
  );
}

export function PublicLayout() {
  const { currentUser, getRoleHomePath } = useAppState();
  const location = useLocation();
  const userHomePath = currentUser ? getRoleHomePath(currentUser.role) : "/login";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(126,211,255,0.35),_transparent_32%),linear-gradient(180deg,_#f8fcff_0%,_#eef7fd_55%,_#ffffff_100%)]">
      <header className="sticky top-0 z-30 border-b border-brand-line/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <BrandMark />

          <nav className="hidden items-center gap-2 md:flex">
            <NavLink
              to="/kalendarz"
              className={() => exactNavLinkClass(location.pathname, "/kalendarz")}
            >
              Kalendarz
            </NavLink>
            <NavLink
              to="/trenerzy"
              className={() => exactNavLinkClass(location.pathname, "/trenerzy")}
            >
              Przekazujacy Wiedze
            </NavLink>
            <NavLink
              to="/wydarzenia-spolecznosci"
              className={() =>
                exactNavLinkClass(location.pathname, "/wydarzenia-spolecznosci")
              }
            >
              Społeczność
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <Link
                to={userHomePath}
                className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
              >
                <LayoutDashboard size={16} />
                Moja Przestrzen
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-5 py-2.5 text-sm font-semibold text-brand-navy"
                >
                  <ShieldCheck size={16} />
                  Logowanie
                </Link>
                <Link
                  to="/rejestracja"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
                >
                  <ShieldCheck size={16} />
                  Rejestracja
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-brand-line/70 bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-brand-muted sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-brand-navy">Emandar Kalendarz</p>
            <p>Osobna aplikacja React podpieta do emandar.pl przez link w menu.</p>
          </div>
          <div className="flex gap-3">
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
  const base = [{ to: "/panel/dashboard", label: "Dashboard", icon: LayoutDashboard }];

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
      { to: "/panel/ustawienia", label: "Ustawienia profilu", icon: ShieldCheck },
      { to: "/panel/grupy", label: "Grupy", icon: Users },
      { to: "/panel/szkolenia", label: "Szkolenia Emandar", icon: CalendarDays },
      {
        to: "/panel/wydarzenia-spolecznosci",
        label: "Wydarzenia społeczności",
        icon: CalendarDays,
      },
      {
        to: "/panel/terminy",
        label: "Terminy Przekazujacych Wiedze",
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
      { to: "/panel/ustawienia", label: "Ustawienia profilu", icon: ShieldCheck },
      { to: "/panel/grupy", label: "Grupy", icon: Users },
      { to: "/panel/szkolenia", label: "Szkolenia Emandar", icon: CalendarDays },
      {
        to: "/panel/wydarzenia-spolecznosci",
        label: "Wydarzenia społeczności",
        icon: CalendarDays,
      },
      {
        to: "/panel/terminy",
        label: "Dostepnosc",
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
    { to: "/panel/ustawienia", label: "Ustawienia profilu", icon: ShieldCheck },
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
  const navigate = useNavigate();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const trainerProfile = store.trainers.find((item) => item.userId === currentUser.id);
  const pendingCommunityApprovals = store.trainingEvents.filter(
    (item) =>
      isCommunityBrandStatus(item.brandStatus) &&
      item.publicationApprovalStatus === "pending",
  ).length;
  const items = panelItems(
    currentUser.role,
    currentUser.role === "trainer" && isCommunityBrandStatus(trainerProfile?.brandStatus),
    currentUser.role === "admin" ? pendingCommunityApprovals : 0,
  );

  return (
    <div className="min-h-screen bg-brand-shell">
      <div className="grid min-h-screen w-full lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-r border-brand-line/80 bg-brand-navy text-white">
          <div className="sticky top-0 flex min-h-screen flex-col px-5 py-6">
            <div className="mb-10">
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                Panel Emandar
              </p>
              <p className="mt-2 text-2xl font-semibold">{currentUser.displayName}</p>
              <p className="text-sm text-white/70">
                {currentUser.email || currentUser.phone || "Konto SMS"}
              </p>
              {availableRoles.length > 1 && (
                <label className="mt-4 grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                    Aktywna rola
                  </span>
                  <select
                    value={currentUser.role}
                    onChange={(event) => {
                      void setActiveRole(event.target.value as AppRole).then(() => {
                        navigate("/panel/dashboard");
                      });
                    }}
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
                onClick={signOut}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
              >
                <LogOut size={16} />
                Wyloguj
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-brand-line/80 bg-white/90 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-brand-muted">
                  {getRoleLabel(currentUser.role)}
                </p>
                <h1 className="text-2xl font-semibold text-brand-navy">
                  Panel zarzadzania
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to="/kalendarz"
                  className="rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy"
                >
                  Zobacz widok publiczny
                </Link>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
