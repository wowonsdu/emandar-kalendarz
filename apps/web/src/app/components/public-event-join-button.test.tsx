import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { PublicEventJoinButton } from "./public-event-join-button";

describe("PublicEventJoinButton", () => {
  it("renders the shared public event join CTA", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/kalendarz">
        <PublicEventJoinButton eventId="event-1" />
      </StaticRouter>,
    );

    expect(markup).toContain('href="/kalendarz/event-1"');
    expect(markup).toContain("min-w-[9.5rem]");
    expect(markup).toContain("Biorę udział");
  });
});
