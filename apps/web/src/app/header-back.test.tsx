import { renderToStaticMarkup } from "react-dom/server";
import { Link, StaticRouter } from "react-router";
import { describe, expect, it } from "vitest";
import {
  PanelHeaderTitle,
  PublicDesktopActions,
  STANDARD_HEADER_HEIGHT_CLASS,
  buildStandardHeaderInnerClassName,
  getHeaderBackConfig,
  resolveHeaderBackTarget,
} from "./header-back";

describe("header back config", () => {
  it("hides the back button on top-level public routes", () => {
    const config = getHeaderBackConfig({
      kind: "public",
      pathname: "/kalendarz",
      search: "",
      state: null,
      rootPaths: new Set(["/kalendarz", "/trenerzy", "/wydarzenia-spolecznosci"]),
    });

    expect(config).toEqual({
      showBackButton: false,
      fallbackPath: null,
      stateBackPath: null,
    });
  });

  it("shows the back button for public detail routes", () => {
    const config = getHeaderBackConfig({
      kind: "public",
      pathname: "/kalendarz/event-1",
      search: "",
      state: null,
      rootPaths: new Set(["/kalendarz", "/trenerzy", "/wydarzenia-spolecznosci"]),
    });

    expect(config).toEqual({
      showBackButton: true,
      fallbackPath: "/kalendarz",
      stateBackPath: null,
    });
  });

  it("treats create and filtered panel routes as nested views", () => {
    const rootPaths = new Set(["/panel/dashboard", "/panel/grupy", "/panel/szkolenia"]);

    expect(
      getHeaderBackConfig({
        kind: "panel",
        pathname: "/panel/grupy",
        search: "?mode=create",
        state: null,
        rootPaths,
      }),
    ).toEqual({
      showBackButton: true,
      fallbackPath: "/panel/grupy",
      stateBackPath: null,
    });

    expect(
      getHeaderBackConfig({
        kind: "panel",
        pathname: "/panel/szkolenia/utworz",
        search: "?groupId=group-1&returnToGroupId=group-1",
        state: null,
        rootPaths,
      }),
    ).toEqual({
      showBackButton: true,
      fallbackPath: "/panel/grupy/group-1",
      stateBackPath: null,
    });
  });

  it("routes moderated community event details back to moderation", () => {
    const config = getHeaderBackConfig({
      kind: "panel",
      pathname: "/panel/wydarzenia-spolecznosci/event-1",
      search: "?view=moderation",
      state: null,
      rootPaths: new Set([
        "/panel/dashboard",
        "/panel/wydarzenia-spolecznosci",
        "/panel/moderacja-wydarzen-spolecznosci",
      ]),
    });

    expect(config).toEqual({
      showBackButton: true,
      fallbackPath: "/panel/moderacja-wydarzen-spolecznosci",
      stateBackPath: null,
    });
  });

  it("routes community event edit views back to the community events list", () => {
    const config = getHeaderBackConfig({
      kind: "panel",
      pathname: "/panel/wydarzenia-spolecznosci/event-1/edytuj",
      search: "",
      state: null,
      rootPaths: new Set([
        "/panel/dashboard",
        "/panel/wydarzenia-spolecznosci",
      ]),
    });

    expect(config).toEqual({
      showBackButton: true,
      fallbackPath: "/panel/wydarzenia-spolecznosci",
      stateBackPath: null,
    });
  });

  it("keeps explicit state back paths ahead of fallbacks", () => {
    const config = getHeaderBackConfig({
      kind: "public",
      pathname: "/trenerzy/anita",
      search: "",
      state: { publicBackPath: "/kalendarz/event-1" },
      rootPaths: new Set(["/kalendarz", "/trenerzy", "/wydarzenia-spolecznosci"]),
    });

    expect(config).toEqual({
      showBackButton: true,
      fallbackPath: "/trenerzy",
      stateBackPath: "/kalendarz/event-1",
    });
  });
});

describe("header back target resolution", () => {
  it("prefers explicit state back paths over browser history", () => {
    expect(
      resolveHeaderBackTarget(
        { fallbackPath: "/kalendarz", stateBackPath: "/kalendarz/event-1" },
        { idx: 3 },
      ),
    ).toEqual({
      kind: "path",
      path: "/kalendarz/event-1",
    });
  });

  it("uses browser history when the current app history index is greater than zero", () => {
    expect(
      resolveHeaderBackTarget(
        { fallbackPath: "/panel/szkolenia", stateBackPath: null },
        { idx: 1 },
      ),
    ).toEqual({ kind: "history" });
  });

  it("falls back to a deterministic route on first-entry deep links", () => {
    expect(
      resolveHeaderBackTarget(
        { fallbackPath: "/panel/szkolenia", stateBackPath: null },
        { idx: 0 },
      ),
    ).toEqual({
      kind: "path",
      path: "/panel/szkolenia",
    });
  });
});

describe("header rendering", () => {
  it("builds the same standard header height class for every layout wrapper", () => {
    expect(STANDARD_HEADER_HEIGHT_CLASS).toBe("h-[72px] md:h-20");
    expect(buildStandardHeaderInnerClassName("flex items-center")).toContain(STANDARD_HEADER_HEIGHT_CLASS);
    expect(buildStandardHeaderInnerClassName("flex items-center")).toContain("flex items-center");
  });

  it("renders the panel desktop back button before the panel title", () => {
    const markup = renderToStaticMarkup(
      <PanelHeaderTitle
        title="Panel zarzadzania"
        showBackButton
        onBackClick={() => {}}
      />,
    );

    expect(markup.indexOf('aria-label="Wróć"')).toBeLessThan(markup.indexOf("Panel zarzadzania"));
  });

  it("renders the public desktop back button before the action buttons", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/kalendarz/event-1">
        <PublicDesktopActions showBackButton onBackClick={() => {}}>
          <Link to="/panel/dashboard">Moja Przestrzeń</Link>
        </PublicDesktopActions>
      </StaticRouter>,
    );

    expect(markup.indexOf('aria-label="Wróć"')).toBeLessThan(markup.indexOf("Moja Przestrzeń"));
    expect(markup).toContain("lg:flex");
    expect(markup).not.toContain("md:flex");
  });
});
