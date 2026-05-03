import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CalendarPage,
  CommunityEventsPage,
  parsePublicEventFilters,
  PublicEventFiltersPanel,
  PublicEventSearchInput,
  setPublicEventFiltersInSearchParams,
} from "./calendar";
import type {
  PublicEventFilterOptions,
  PublicEventFilters,
  PublicEventPage,
} from "@/data/apiClient";
import type { TrainingEvent } from "@/domain/types";

const queryMockState = vi.hoisted(() => ({
  data: undefined as unknown,
  previousData: undefined as unknown,
  isFetching: false,
  capturedOptions: [] as Array<{
    placeholderData?: (previousData: unknown) => unknown;
  }>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useQuery: vi.fn((options) => {
      queryMockState.capturedOptions.push(options);
      const data =
        queryMockState.data ??
        (typeof options.placeholderData === "function"
          ? options.placeholderData(queryMockState.previousData)
          : undefined);

      return {
        data,
        isFetching: queryMockState.isFetching,
      };
    }),
  };
});

vi.mock("../../providers/AppProviders", () => ({
  useAppState: () => ({
    currentUser: null,
    store: {
      users: [],
      trainers: [
        {
          id: "trainer-1",
          userId: "trainer-user-1",
          slug: "anna",
          displayName: "Anna",
          bio: "",
          specialties: [],
          locations: [],
          isVisible: true,
          heroNote: "",
          brandStatus: "official",
        },
      ],
      organizers: [],
      participantProfiles: [],
      groups: [],
      groupMembers: [],
      eventParticipants: [],
      relations: [],
      trainingEvents: [],
      publicTrainingEvents: [],
      enrollmentRequests: [],
      notifications: [],
      appSettings: {
        signupPhotoMode: "optional",
        enrollmentPhotoMode: "optional",
      },
    },
  }),
}));

const filterOptions: PublicEventFilterOptions = {
  tags: [
    { value: "Weekend", label: "Weekend", count: 3 },
    { value: "NOWE OSOBY", label: "NOWE OSOBY", count: 2 },
  ],
  trainers: [
    { id: "trainer-1", label: "Anna", count: 2 },
    { id: "trainer-2", label: "Beata", count: 1 },
  ],
  dateBounds: { min: "2026-07-01", max: "2026-08-31" },
};

function renderFiltersPanel(value: PublicEventFilters = {}, showAudienceFilter = true) {
  return renderToStaticMarkup(
    <PublicEventFiltersPanel
      options={filterOptions}
      value={value}
      activeCount={0}
      showAudienceFilter={showAudienceFilter}
      onChange={vi.fn()}
      onClear={vi.fn()}
    />,
  );
}

function createTrainingEvent(overrides: Partial<TrainingEvent> = {}): TrainingEvent {
  return {
    id: "event-1",
    trainerId: "trainer-1",
    organizerId: null,
    groupId: null,
    groupName: null,
    title: "Szkolenie testowe",
    summary: "Opis wydarzenia",
    description: "Opis wydarzenia",
    type: "Szkolenie",
    startsAt: "2026-07-10T10:00:00.000Z",
    endsAt: "2026-07-10T12:00:00.000Z",
    scheduleDays: [
      {
        startsAt: "2026-07-10T10:00:00.000Z",
        endsAt: "2026-07-10T12:00:00.000Z",
      },
    ],
    location: "Gdańsk",
    tags: ["Weekend"],
    capacity: 12,
    enrolledCount: 0,
    isPublished: true,
    brandStatus: "official",
    status: "active",
    publicationApprovalStatus: "accepted",
    ...overrides,
  };
}

function createPublicEventPage(
  items: TrainingEvent[],
  overrides: Partial<PublicEventPage> = {},
): PublicEventPage {
  return {
    items,
    page: 1,
    pageSize: 25,
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / 25)),
    filters: filterOptions,
    ...overrides,
  };
}

beforeEach(() => {
  queryMockState.data = undefined;
  queryMockState.previousData = undefined;
  queryMockState.isFetching = false;
  queryMockState.capturedOptions = [];
});

describe("PublicEventFiltersPanel", () => {
  it("renders compact official filters without a tag filter section", () => {
    const markup = renderFiltersPanel({ audience: "new-people", trainerIds: ["trainer-2"] });

    const dateIndex = markup.indexOf("Kiedy");
    const audienceIndex = markup.indexOf("Dla kogo");
    const trainersIndex = markup.indexOf("Trenerzy");

    expect(dateIndex).toBeGreaterThanOrEqual(0);
    expect(audienceIndex).toBeGreaterThan(dateIndex);
    expect(trainersIndex).toBeGreaterThan(audienceIndex);
    expect(markup).not.toContain("Tagi");
    expect(markup).not.toContain("Wszystkie");
    expect(markup).toContain("Nowe osoby");
    expect(markup).toContain("Tylko Ćwiczący");
  });

  it("renders trainers as wrapping chip buttons, not checkbox rows", () => {
    const markup = renderFiltersPanel({ trainerIds: ["trainer-1"] });

    expect(markup).toContain("flex flex-wrap gap-2");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).not.toContain('type="checkbox"');
  });

  it("hides the audience section for community events", () => {
    const markup = renderFiltersPanel({}, false);

    expect(markup).not.toContain("Dla kogo");
    expect(markup).toContain("Kiedy");
    expect(markup).toContain("Data od");
    expect(markup).toContain("Data do");
    expect(markup).toContain("Trenerzy");
    expect(markup).not.toContain("Tagi");
  });

  it("defaults official audience to new people and resets page on filter changes", () => {
    const current = new URLSearchParams("page=3&tag=Weekend&search=Krak%C3%B3w&audience=new-people");
    const parsed = parsePublicEventFilters(current, { includeAudience: true });

    expect(parsed.search).toBe("Kraków");
    expect(parsed.audience).toBe("new-people");

    const next = setPublicEventFiltersInSearchParams(current, {
      ...parsed,
      search: " Beata ",
      audience: "existing-practitioners",
      trainerIds: ["trainer-1"],
    });

    expect(next.get("page")).toBeNull();
    expect(next.get("search")).toBe("Beata");
    expect(next.get("tag")).toBeNull();
    expect(next.get("audience")).toBe("existing-practitioners");
    expect(next.getAll("trainerId")).toEqual(["trainer-1"]);
  });

  it("removes search and new-people audience from URL state when cleared or parsed for community filters", () => {
    const current = new URLSearchParams("page=2&audience=new-people&tag=Weekend&search=Weekend");

    expect(parsePublicEventFilters(current).audience).toBe("all");

    const next = setPublicEventFiltersInSearchParams(current, {
      search: " ",
      audience: "all",
    });

    expect(next.get("page")).toBeNull();
    expect(next.get("search")).toBeNull();
    expect(next.get("audience")).toBeNull();
    expect(next.get("tag")).toBeNull();
  });

  it("does not parse or persist search terms shorter than three characters", () => {
    const current = new URLSearchParams("page=2&search=Ab&trainerId=trainer-1");
    const parsed = parsePublicEventFilters(current, { includeAudience: true });

    expect(parsed.search).toBeUndefined();

    const next = setPublicEventFiltersInSearchParams(current, {
      ...parsed,
      search: "Ka",
      trainerIds: ["trainer-1"],
    });

    expect(next.get("page")).toBeNull();
    expect(next.get("search")).toBeNull();
    expect(next.getAll("trainerId")).toEqual(["trainer-1"]);
  });

  it("persists search terms from three characters, resets page, and preserves other filters", () => {
    const current = new URLSearchParams(
      "page=4&trainerId=trainer-1&dateFrom=2026-07-01&audience=existing-practitioners",
    );
    const parsed = parsePublicEventFilters(current, { includeAudience: true });

    const next = setPublicEventFiltersInSearchParams(current, {
      ...parsed,
      search: "  Anna  ",
      trainerIds: ["trainer-1"],
      dateTo: "2026-07-31",
    });

    expect(next.get("page")).toBeNull();
    expect(next.get("search")).toBe("Anna");
    expect(next.getAll("trainerId")).toEqual(["trainer-1"]);
    expect(next.get("dateFrom")).toBe("2026-07-01");
    expect(next.get("dateTo")).toBe("2026-07-31");
    expect(next.get("audience")).toBe("existing-practitioners");
  });

  it("does not persist the default official new-people audience in URL state", () => {
    const current = new URLSearchParams("page=2&audience=existing-practitioners");
    const parsed = parsePublicEventFilters(new URLSearchParams(), { includeAudience: true });

    expect(parsed.audience).toBe("new-people");

    const next = setPublicEventFiltersInSearchParams(current, {
      audience: "new-people",
    });

    expect(next.get("page")).toBeNull();
    expect(next.get("audience")).toBeNull();
  });

  it("renders the public event search input with the expected placeholder", () => {
    const markup = renderToStaticMarkup(<PublicEventSearchInput value="Anna" onChange={vi.fn()} />);

    expect(markup).toContain('type="search"');
    expect(markup).toContain("Szukaj po miejscu, dacie, trenerze lub tagu");
    expect(markup).toContain('value="Anna"');
  });
});

describe("public calendar query rendering", () => {
  it("keeps previous official events rendered while a filtered page is fetching", () => {
    const previousPage = createPublicEventPage([
      createTrainingEvent({ id: "event-previous", location: "Gdańsk" }),
    ]);
    queryMockState.previousData = previousPage;
    queryMockState.isFetching = true;

    const markup = renderToStaticMarkup(
      <StaticRouter location="/kalendarz?search=brak">
        <CalendarPage />
      </StaticRouter>,
    );

    expect(queryMockState.capturedOptions[0]?.placeholderData?.(previousPage)).toBe(previousPage);
    expect(markup).toContain("Gdańsk");
    expect(markup).toContain("Filtrowanie...");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain("Nie znaleziono szkoleń pasujących do wybranych filtrów.");
  });

  it("shows the official empty state after a zero-result query resolves", () => {
    queryMockState.data = createPublicEventPage([], { totalItems: 0, totalPages: 1 });

    const markup = renderToStaticMarkup(
      <StaticRouter location="/kalendarz?search=brak">
        <CalendarPage />
      </StaticRouter>,
    );

    expect(markup).toContain("Nie znaleziono szkoleń pasujących do wybranych filtrów.");
    expect(markup).not.toContain("Filtrowanie...");
    expect(markup).not.toContain('aria-busy="true"');
  });

  it("renders simplified public headers without the removed descriptions", () => {
    queryMockState.data = createPublicEventPage([]);

    const officialMarkup = renderToStaticMarkup(
      <StaticRouter location="/kalendarz">
        <CalendarPage />
      </StaticRouter>,
    );
    const communityMarkup = renderToStaticMarkup(
      <StaticRouter location="/wydarzenia-spolecznosci">
        <CommunityEventsPage />
      </StaticRouter>,
    );

    expect(officialMarkup).toContain("Szkolenia Emandar");
    expect(officialMarkup).not.toContain("Spotkania z Przekazującymi wiedzę");
    expect(officialMarkup).not.toContain("Kalendarz oficjalnych szkoleń");
    expect(communityMarkup).toContain("Wydarzenia społeczności");
    expect(communityMarkup).not.toContain("Przeglądaj otwarte wydarzenia społeczności");
  });

  it("retains previous community event data between filter query keys", () => {
    const previousPage = createPublicEventPage([
      createTrainingEvent({
        id: "community-previous",
        title: "Krąg w Poznaniu",
        location: "Poznań",
        brandStatus: "supported",
        createdByRole: "participant",
      }),
    ]);
    queryMockState.previousData = previousPage;
    queryMockState.isFetching = true;

    const markup = renderToStaticMarkup(
      <StaticRouter location="/wydarzenia-spolecznosci?trainerId=trainer-1">
        <CommunityEventsPage />
      </StaticRouter>,
    );

    expect(queryMockState.capturedOptions[0]?.placeholderData?.(previousPage)).toBe(previousPage);
    expect(markup).toContain("Krąg w Poznaniu");
    expect(markup).not.toContain(
      "Nie znaleziono wydarzeń społeczności pasujących do wybranych filtrów.",
    );
  });
});
