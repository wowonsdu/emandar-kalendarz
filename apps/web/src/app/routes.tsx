import { Suspense, lazy, type ComponentType } from "react";
import { Navigate, createBrowserRouter } from "react-router";
import { PanelLayout, PublicLayout, RequireAuth } from "./layouts";

const CalendarPage = createLazyRoute(() =>
  import("./pages/public/calendar").then((module) => ({ default: module.CalendarPage })),
);
const CommunityEventsPage = createLazyRoute(() =>
  import("./pages/public/calendar").then((module) => ({ default: module.CommunityEventsPage })),
);
const LandingPage = createLazyRoute(() =>
  import("./pages/public/calendar").then((module) => ({ default: module.LandingPage })),
);
const EventDetailsPage = createLazyRoute(() =>
  import("./pages/public/event-detail").then((module) => ({ default: module.EventDetailsPage })),
);
const CommunityEventReviewPage = createLazyRoute(() =>
  import("./pages/public/signed-actions").then((module) => ({
    default: module.CommunityEventReviewPage,
  })),
);
const AttendanceConfirmationPage = createLazyRoute(() =>
  import("./pages/attendance-confirmation").then((module) => ({
    default: module.AttendanceConfirmationPage,
  })),
);
const TrainersPage = createLazyRoute(() =>
  import("./pages/public/trainers").then((module) => ({ default: module.TrainersPage })),
);
const TrainerDetailsPage = createLazyRoute(() =>
  import("./pages/public/trainers").then((module) => ({
    default: module.TrainerDetailsPage,
  })),
);
const LoginPage = createLazyRoute(() =>
  import("./pages/public/auth").then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = createLazyRoute(() =>
  import("./pages/public/auth").then((module) => ({ default: module.RegisterPage })),
);
const DashboardPage = createLazyRoute(() =>
  import("./pages/panel/dashboard").then((module) => ({ default: module.DashboardPage })),
);
const GroupsPage = createLazyRoute(() =>
  import("./pages/panel/groups").then((module) => ({ default: module.GroupsPage })),
);
const EventsPage = createLazyRoute(() =>
  import("./pages/panel/events").then((module) => ({ default: module.EventsPage })),
);
const EventManagementPage = createLazyRoute(() =>
  import("./pages/panel/events").then((module) => ({
    default: module.EventManagementPage,
  })),
);
const RequestsPage = createLazyRoute(() =>
  import("./pages/panel/requests-relations").then((module) => ({
    default: module.RequestsPage,
  })),
);
const RelationsPage = createLazyRoute(() =>
  import("./pages/panel/requests-relations").then((module) => ({
    default: module.RelationsPage,
  })),
);
const ProfileSettingsPage = createLazyRoute(() =>
  import("./pages/panel/settings").then((module) => ({
    default: module.ProfileSettingsPage,
  })),
);
const NotificationsSettingsPage = createLazyRoute(() =>
  import("./pages/notifications").then((module) => ({
    default: module.NotificationsSettingsPage,
  })),
);
const UserManagementPage = createLazyRoute(() =>
  import("./pages/panel/admin").then((module) => ({ default: module.UserManagementPage })),
);
const TrainerDirectoryPage = createLazyRoute(() =>
  import("./pages/panel/admin").then((module) => ({
    default: module.TrainerDirectoryPage,
  })),
);
const OrganizerDirectoryPage = createLazyRoute(() =>
  import("./pages/panel/admin").then((module) => ({
    default: module.OrganizerDirectoryPage,
  })),
);

function RouteLoader() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-brand-muted sm:px-6 lg:px-8">
      Ladowanie...
    </div>
  );
}

function createLazyRoute(loader: () => Promise<{ default: ComponentType }>) {
  const LazyRoute = lazy(loader);

  return function LazyRouteWithSuspense() {
    return (
      <Suspense fallback={<RouteLoader />}>
        <LazyRoute />
      </Suspense>
    );
  };
}

function NotFoundPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
        404
      </p>
      <h1 className="mt-4 text-5xl font-semibold text-brand-navy">
        Tego miejsca jeszcze nie ma
      </h1>
      <p className="mt-4 text-lg text-brand-muted">
        Wroc do kalendarza albo otworz panel, jesli szukasz ekranow operacyjnych.
      </p>
    </section>
  );
}

const basename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: PublicLayout,
      children: [
        { index: true, element: <Navigate to="/kalendarz" replace /> },
        { path: "kalendarz", Component: CalendarPage },
        { path: "wydarzenia-spolecznosci", Component: CommunityEventsPage },
        { path: "moderacja-wydarzenia/:token", Component: CommunityEventReviewPage },
        { path: "kalendarz/:eventId", Component: EventDetailsPage },
        { path: "trenerzy", Component: TrainersPage },
        { path: "trenerzy/:slug", Component: TrainerDetailsPage },
        {
          path: "potwierdzenie-udzialu/:token/:decision",
          Component: AttendanceConfirmationPage,
        },
        { path: "login", Component: LoginPage },
        { path: "rejestracja", Component: RegisterPage },
        { path: "start", Component: LandingPage },
        { path: "*", Component: NotFoundPage },
      ],
    },
    {
      Component: RequireAuth,
      children: [
        {
          path: "/panel",
          Component: PanelLayout,
          children: [
            { index: true, element: <Navigate to="/panel/dashboard" replace /> },
            { path: "dashboard", Component: DashboardPage },
            { path: "ustawienia", Component: ProfileSettingsPage },
            { path: "powiadomienia", Component: NotificationsSettingsPage },
            { path: "grupy", Component: GroupsPage },
            { path: "grupy/utworz", Component: GroupsPage },
            { path: "grupy/:groupId", Component: GroupsPage },
            { path: "zgloszenia", Component: RequestsPage },
            { path: "relacje", Component: RelationsPage },
            { path: "szkolenia", Component: EventsPage },
            { path: "szkolenia/utworz", Component: EventsPage },
            { path: "szkolenia/:eventId", Component: EventManagementPage },
            { path: "wydarzenia-spolecznosci", Component: EventsPage },
            { path: "wydarzenia-spolecznosci/utworz", Component: EventsPage },
            { path: "wydarzenia-spolecznosci/:eventId/edytuj", Component: EventManagementPage },
            { path: "wydarzenia-spolecznosci/:eventId", Component: EventManagementPage },
            { path: "moderacja-wydarzen-spolecznosci", Component: EventsPage },
            { path: "uzytkownicy", Component: UserManagementPage },
            { path: "trenerzy", Component: TrainerDirectoryPage },
            { path: "organizatorzy", Component: OrganizerDirectoryPage },
          ],
        },
      ],
    },
  ],
  { basename },
);
