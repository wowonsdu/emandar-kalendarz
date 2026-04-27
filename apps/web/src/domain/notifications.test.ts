import { describe, expect, it } from "vitest";
import {
  getDefaultNotificationSettings,
  normalizeNotificationSettings,
  resolveAttendanceConfirmationStatusLabel,
} from "./notifications";

describe("notifications helpers", () => {
  it("fills defaults for missing settings", () => {
    expect(normalizeNotificationSettings(undefined)).toEqual(
      getDefaultNotificationSettings(),
    );
  });

  it("normalizes reminder lead days into supported range", () => {
    expect(
      normalizeNotificationSettings({
        reminderLeadDays: 99,
      }),
    ).toMatchObject({
      reminderLeadDays: 30,
    });
  });

  it("returns readable attendance labels", () => {
    expect(resolveAttendanceConfirmationStatusLabel("pending")).toBe(
      "Czeka na odpowiedź",
    );
    expect(resolveAttendanceConfirmationStatusLabel("confirmed")).toBe(
      "Potwierdzona obecność",
    );
    expect(resolveAttendanceConfirmationStatusLabel("declined")).toBe(
      "Odmowa udziału",
    );
  });
});
