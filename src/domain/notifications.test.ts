import { describe, expect, it } from "vitest";
import {
  getDefaultNotificationSettings,
  normalizeNotificationSettings,
  resolveAttendanceConfirmationStatusLabel,
  resolveNotificationSettingsOwnerRole,
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

  it("prefers organizer settings for shared official events", () => {
    expect(
      resolveNotificationSettingsOwnerRole({
        organizerId: "organizer-1",
        brandStatus: "official",
        selfManagedByTrainer: false,
      }),
    ).toBe("organizer");
  });

  it("uses trainer settings for community or self managed events", () => {
    expect(
      resolveNotificationSettingsOwnerRole({
        organizerId: "organizer-1",
        brandStatus: "supported",
        selfManagedByTrainer: false,
      }),
    ).toBe("trainer");

    expect(
      resolveNotificationSettingsOwnerRole({
        organizerId: "organizer-1",
        brandStatus: "official",
        selfManagedByTrainer: true,
      }),
    ).toBe("trainer");
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
