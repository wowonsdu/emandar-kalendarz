import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export type HeaderBackConfig = {
  showBackButton: boolean;
  fallbackPath: string | null;
  stateBackPath: string | null;
};

export type HeaderBackTarget =
  | { kind: "none" }
  | { kind: "history" }
  | { kind: "path"; path: string };

export const STANDARD_HEADER_HEIGHT_CLASS = "h-[72px] md:h-20";

type HeaderLayoutKind = "public" | "panel";

type HeaderBackConfigInput = {
  kind: HeaderLayoutKind;
  pathname: string;
  search: string;
  state: unknown;
  rootPaths: ReadonlySet<string>;
};

function getHeaderStateBackPath(state: unknown) {
  if (!state || typeof state !== "object") {
    return null;
  }

  const candidate = (state as { headerBackPath?: unknown; publicBackPath?: unknown }).headerBackPath
    ?? (state as { publicBackPath?: unknown }).publicBackPath;

  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function hasPanelNestedSearch(pathname: string, search: string) {
  const searchParams = new URLSearchParams(search);

  if (pathname === "/panel/grupy" && searchParams.get("mode") === "create") {
    return true;
  }

  return false;
}

function getPublicFallbackPath(pathname: string) {
  if (pathname.startsWith("/kalendarz/")) {
    return "/kalendarz";
  }

  if (pathname.startsWith("/trenerzy/")) {
    return "/trenerzy";
  }

  if (pathname.startsWith("/wydarzenia-spolecznosci/")) {
    return "/wydarzenia-spolecznosci";
  }

  return "/kalendarz";
}

function getPanelFallbackPath(pathname: string, search: string) {
  const searchParams = new URLSearchParams(search);
  const mode = searchParams.get("mode");

  if (pathname === "/panel/powiadomienia") {
    return "/panel/ustawienia";
  }

  if (pathname === "/panel/grupy" && mode === "create") {
    return "/panel/grupy";
  }

  if (pathname.startsWith("/panel/grupy/")) {
    if (mode === "edit") {
      return pathname;
    }

    return "/panel/grupy";
  }

  if (pathname === "/panel/szkolenia/utworz" && searchParams.get("returnToGroupId")) {
    return `/panel/grupy/${searchParams.get("returnToGroupId")}`;
  }

  if (pathname === "/panel/szkolenia/utworz" || pathname.startsWith("/panel/szkolenia/")) {
    return "/panel/szkolenia";
  }

  if (
    pathname === "/panel/wydarzenia-spolecznosci/utworz" ||
    pathname.startsWith("/panel/wydarzenia-spolecznosci/")
  ) {
    if (searchParams.get("view") === "moderation") {
      return "/panel/moderacja-wydarzen-spolecznosci";
    }

    return "/panel/wydarzenia-spolecznosci";
  }

  if (pathname === "/panel/relacje") {
    return "/panel/ustawienia";
  }

  if (pathname.startsWith("/panel/")) {
    return "/panel/dashboard";
  }

  return null;
}

export function getHeaderBackConfig({
  kind,
  pathname,
  search,
  state,
  rootPaths,
}: HeaderBackConfigInput): HeaderBackConfig {
  const stateBackPath = getHeaderStateBackPath(state);
  const isRootPath = rootPaths.has(pathname);
  const isRootLevelView =
    kind === "panel" ? isRootPath && !hasPanelNestedSearch(pathname, search) : isRootPath;

  if (isRootLevelView) {
    return {
      showBackButton: false,
      fallbackPath: null,
      stateBackPath,
    };
  }

  return {
    showBackButton: true,
    fallbackPath: kind === "panel" ? getPanelFallbackPath(pathname, search) : getPublicFallbackPath(pathname),
    stateBackPath,
  };
}

export function resolveHeaderBackTarget(
  config: Pick<HeaderBackConfig, "fallbackPath" | "stateBackPath">,
  historyState: unknown,
): HeaderBackTarget {
  if (config.stateBackPath) {
    return { kind: "path", path: config.stateBackPath };
  }

  if (
    historyState &&
    typeof historyState === "object" &&
    typeof (historyState as { idx?: unknown }).idx === "number" &&
    (historyState as { idx: number }).idx > 0
  ) {
    return { kind: "history" };
  }

  if (config.fallbackPath) {
    return { kind: "path", path: config.fallbackPath };
  }

  return { kind: "none" };
}

export function HeaderBackButton({
  onClick,
  className = "",
  ariaLabel = "Wróć",
}: {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-line bg-white text-brand-navy shadow-soft",
        className,
      ].join(" ").trim()}
      aria-label={ariaLabel}
    >
      <ArrowLeft size={20} />
    </button>
  );
}

export function buildStandardHeaderInnerClassName(className: string) {
  return `${STANDARD_HEADER_HEIGHT_CLASS} ${className}`.trim();
}

export function PanelHeaderTitle({
  title,
  showBackButton,
  onBackClick,
}: {
  title: string;
  showBackButton: boolean;
  onBackClick: () => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        {showBackButton ? (
          <div className="hidden xl:flex">
            <HeaderBackButton onClick={onBackClick} />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="break-words text-lg font-semibold leading-tight text-brand-navy sm:text-2xl">
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}

export function PublicDesktopActions({
  showBackButton,
  onBackClick,
  children,
}: {
  showBackButton: boolean;
  onBackClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="ml-auto hidden min-w-0 flex-wrap items-center justify-end gap-3 xl:flex">
      {showBackButton ? <HeaderBackButton onClick={onBackClick} /> : null}
      {children}
    </div>
  );
}
