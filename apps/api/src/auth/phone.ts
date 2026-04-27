import type { DemoStoreRecord } from "../store/types.js";

export function normalizePhoneLookupKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return digits;
  }

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits;
}

export function isSamePhone(left: string | null | undefined, right: string | null | undefined) {
  return normalizePhoneLookupKey(left ?? "") === normalizePhoneLookupKey(right ?? "");
}

export function findUserByPhone(store: DemoStoreRecord, phone: string) {
  const users = Array.isArray(store.users) ? store.users : [];
  return (
    users.find((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }

      return isSamePhone((item as { phone?: string }).phone, phone);
    }) ?? null
  );
}
