import { Navigate, createBrowserRouter } from "react-router";
import { PanelLayout, PublicLayout, RequireAuth } from "./layouts";
import {
  CalendarPage,
  CommunityEventsPage,
  EventDetailsPage,
  LandingPage,
  LoginPage,
  RegisterPage,
  TrainerDetailsPage,
  TrainersPage,
} from "./pages/public";
import {
  AccountRequestsPage,
  AvailabilityPage,
  DashboardPage,
  EventManagementPage,
  EventsPage,
  OrganizerDirectoryPage,
  RelationsPage,
  RequestsPage,
  ProfileSettingsPage,
  TrainerDirectoryPage,
} from "./pages/panel";

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
        Wróć do kalendarza albo otwórz panel, jeśli szukasz ekranów operacyjnych.
      </p>
    </section>
  );
}

const basename = import.meta.env.DEV ? "/" : "/emandar";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: PublicLayout,
      children: [
        { index: true, element: <Navigate to="/kalendarz" replace /> },
        { path: "kalendarz", Component: CalendarPage },
        { path: "wydarzenia-spolecznosci", Component: CommunityEventsPage },
        { path: "kalendarz/:eventId", Component: EventDetailsPage },
        { path: "trenerzy", Component: TrainersPage },
        { path: "trenerzy/:slug", Component: TrainerDetailsPage },
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
            { path: "rejestracje", Component: AccountRequestsPage },
            { path: "zgloszenia", Component: RequestsPage },
            { path: "relacje", Component: RelationsPage },
            { path: "terminy", Component: AvailabilityPage },
            { path: "szkolenia", Component: EventsPage },
            { path: "szkolenia/:eventId", Component: EventManagementPage },
            { path: "kreator-wydarzen", Component: EventsPage },
            { path: "trenerzy", Component: TrainerDirectoryPage },
            { path: "organizatorzy", Component: OrganizerDirectoryPage },
          ],
        },
      ],
    },
  ],
  { basename },
);
