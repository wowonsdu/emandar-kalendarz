import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppUser, DemoStore } from "@/domain/types";
import {
  canApproveEnrollmentRequest,
  getHighestRole,
  hasInheritedRole,
  hasModeratorAccess,
  isCommunityBrandStatus,
  isOperationalEnrollmentRequest,
} from "@/domain/utils";

export type AppNavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
};

export type AppNavigationSection = {
  title: string;
  items: AppNavigationItem[];
};

export const publicNavItems: AppNavigationItem[] = [
  { to: "/kalendarz", label: "Kalendarz", icon: CalendarDays },
  { to: "/trenerzy", label: "Przekazujący Wiedzę", icon: Users },
  { to: "/wydarzenia-spolecznosci", label: "Wydarzenia społeczności", icon: Bell },
];

export function buildPublicNavigationSections(): AppNavigationSection[] {
  return [
    {
      title: "Widok Publiczny",
      items: publicNavItems.map((item) => ({ ...item })),
    },
  ];
}

export function buildAuthenticatedNavigationSections(
  user: Pick<
    AppUser,
    | "id"
    | "role"
    | "roles"
    | "primaryRole"
    | "trainerProfileId"
    | "organizerProfileId"
    | "organizerFunctionsBlockedAt"
  >,
  store: Pick<DemoStore, "trainers" | "trainingEvents" | "enrollmentRequests">,
): AppNavigationSection[] {
  const highestRole = getHighestRole(user);
  const trainerProfile = store.trainers.find((item) => item.userId === user.id);
  const isCommunityTrainer =
    highestRole === "trainer" && isCommunityBrandStatus(trainerProfile?.brandStatus);
  const pendingCommunityApprovals = hasModeratorAccess(user)
    ? store.trainingEvents.filter(
        (item) =>
          isCommunityBrandStatus(item.brandStatus) &&
          item.publicationApprovalStatus === "pending",
      ).length
    : 0;
  const pendingEnrollmentRequests = store.enrollmentRequests.filter((request) => {
    if (request.finalStatus !== "pending") {
      return false;
    }

    if (!isOperationalEnrollmentRequest(request, store)) {
      return false;
    }

    const event = store.trainingEvents.find((item) => item.id === request.eventId);
    if (!event) {
      return false;
    }

    return canApproveEnrollmentRequest(event, user);
  }).length;

  const sections: AppNavigationSection[] = [
    {
      title: "Widok Publiczny",
      items: publicNavItems.map((item) => ({ ...item })),
    },
    {
      title: "Moja Przestrzeń",
      items: [
        { to: "/panel/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/panel/grupy", label: "Grupy", icon: Users },
        { to: "/panel/szkolenia", label: "Szkolenia", icon: CalendarDays },
        {
          to: "/panel/wydarzenia-spolecznosci",
          label: "Wydarzenia społeczności",
          icon: CalendarDays,
        },
        {
          to: "/panel/zgloszenia",
          label: "Chcą wziąć udział",
          icon: Bell,
          badgeCount: pendingEnrollmentRequests || undefined,
        },
        { to: "/panel/ustawienia", label: "Ustawienia", icon: ShieldCheck },
      ],
    },
  ];

  if (hasModeratorAccess(user)) {
    sections.push({
      title: "Moderator",
      items: [
        {
          to: "/panel/moderacja-wydarzen-spolecznosci",
          label: "Moderacja wydarzeń",
          icon: Bell,
          badgeCount: pendingCommunityApprovals || undefined,
        },
        { to: "/panel/uzytkownicy", label: "Konta i blokady", icon: Users },
      ],
    });
  }

  if (hasInheritedRole(user, "organizer")) {
    sections.push({
      title: "Organizator",
      items: [{ to: "/panel/terminy", label: "Terminy", icon: CalendarDays }],
    });
  }

  if (hasInheritedRole(user, "trainer") && !isCommunityTrainer) {
    sections.push({
      title: "Trener",
      items: [{ to: "/panel/organizatorzy", label: "Organizatorzy", icon: Users }],
    });
  }

  if (highestRole === "admin") {
    sections.push({
      title: "Admin",
      items: [{ to: "/panel/trenerzy", label: "Przekazujący Wiedzę", icon: Users }],
    });
  }

  return sections;
}
