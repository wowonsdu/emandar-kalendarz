export type SmsConfirmOutcome =
  | {
      status: "existing-account";
      userId: string;
      phone: string;
    }
  | {
      status: "missing-account";
      phone: string;
    };

export type LoginSmsConfirmAction =
  | {
      kind: "sign-in";
      userId: string;
      phone: string;
      navigateTo: string;
    }
  | {
      kind: "register";
      phone: string;
      navigateTo: string;
    };

function normalizePhoneKey(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

function isSamePhone(left: string | null | undefined, right: string | null | undefined) {
  const leftKey = normalizePhoneKey(left);
  const rightKey = normalizePhoneKey(right);
  return Boolean(leftKey) && leftKey === rightKey;
}

export function buildRegistrationPath(phone: string) {
  const searchParams = new URLSearchParams({ phone });
  return `/rejestracja?${searchParams.toString()}`;
}

export function resolveLoginSmsConfirmAction(
  outcome: SmsConfirmOutcome,
  signedInPath: string,
): LoginSmsConfirmAction {
  if (outcome.status === "existing-account") {
    return {
      kind: "sign-in",
      userId: outcome.userId,
      phone: outcome.phone,
      navigateTo: signedInPath,
    };
  }

  return {
    kind: "register",
    phone: outcome.phone,
    navigateTo: buildRegistrationPath(outcome.phone),
  };
}

export function getInitialVerifiedRegistrationPhone(input: {
  currentSessionPhone?: string | null;
  prefetchedPhone?: string | null;
  verifiedPreAuthPhone?: string | null;
}) {
  if (input.currentSessionPhone) {
    return input.currentSessionPhone;
  }

  if (input.prefetchedPhone && isSamePhone(input.prefetchedPhone, input.verifiedPreAuthPhone)) {
    return input.prefetchedPhone;
  }

  if (!input.prefetchedPhone) {
    return input.verifiedPreAuthPhone ?? null;
  }

  return null;
}

export function shouldResetVerifiedPhone(
  verifiedPhone: string | null,
  nextPhone: string,
) {
  if (!verifiedPhone) {
    return false;
  }

  return !isSamePhone(verifiedPhone, nextPhone);
}
