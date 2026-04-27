import { describe, expect, it } from "vitest";
import {
  buildRegistrationPath,
  getInitialVerifiedRegistrationPhone,
  resolveLoginSmsConfirmAction,
  shouldResetVerifiedPhone,
} from "./public-auth-flow";

describe("public auth flow helpers", () => {
  it("redirects existing SMS login confirmations to the signed-in public path", () => {
    expect(
      resolveLoginSmsConfirmAction(
        {
          status: "existing-account",
          userId: "user-1",
          phone: "+48 500 600 700",
        },
        "/kalendarz",
      ),
    ).toEqual({
      kind: "sign-in",
      userId: "user-1",
      phone: "+48 500 600 700",
      navigateTo: "/kalendarz",
    });
  });

  it("sends missing-account SMS confirmations to registration with a prefilled phone", () => {
    expect(
      resolveLoginSmsConfirmAction(
        {
          status: "missing-account",
          phone: "+48 500 600 700",
        },
        "/kalendarz",
      ),
    ).toEqual({
      kind: "register",
      phone: "+48 500 600 700",
      navigateTo: buildRegistrationPath("+48 500 600 700"),
    });
  });

  it("starts registration in a verified state when the login-confirmed phone matches the query", () => {
    expect(
      getInitialVerifiedRegistrationPhone({
        prefetchedPhone: "+48 500 600 700",
        verifiedPreAuthPhone: "+48 500 600 700",
      }),
    ).toBe("+48 500 600 700");
  });

  it("does not auto-verify a different prefetched phone", () => {
    expect(
      getInitialVerifiedRegistrationPhone({
        prefetchedPhone: "+48 500 600 700",
        verifiedPreAuthPhone: "+48 500 600 701",
      }),
    ).toBeNull();
  });

  it("resets verified-phone state after the user changes the registration number", () => {
    expect(shouldResetVerifiedPhone("+48 500 600 700", "+48 500 600 701")).toBe(true);
    expect(shouldResetVerifiedPhone("+48 500 600 700", "+48 500 600 700")).toBe(false);
  });
});
