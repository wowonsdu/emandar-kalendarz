import type {
  EnrollmentAttendanceConfirmationStatus,
  NotificationSettings,
} from "./types";

export const NOTIFICATION_TEMPLATE_PLACEHOLDERS = [
  "{{event_title}}",
  "{{event_date}}",
  "{{event_location}}",
  "{{recipient_name}}",
  "{{confirm_url}}",
  "{{decline_url}}",
] as const;

export function getDefaultNotificationSettings(): NotificationSettings {
  return {
    reminderLeadDays: 7,
    sendToTrainer: true,
    sendToOrganizer: true,
    sendToParticipants: true,
    requireParticipantSmsConfirmation: false,
    reminderSmsTemplate:
      "Przypomnienie o szkoleniu {{event_title}} dnia {{event_date}} w {{event_location}}.",
    confirmationSmsTemplate:
      "Czy bierzesz udział w szkoleniu {{event_title}} dnia {{event_date}}? Tak: {{confirm_url}} Nie: {{decline_url}}",
  };
}

export function normalizeNotificationSettings(
  value: Partial<NotificationSettings> | null | undefined,
  fallback: Partial<NotificationSettings> | null | undefined = undefined,
): NotificationSettings {
  const defaults = {
    ...getDefaultNotificationSettings(),
    ...(fallback ? getDefaultNotificationSettingsFromValue(fallback) : {}),
  };

  return {
    reminderLeadDays:
      typeof value?.reminderLeadDays === "number" && Number.isFinite(value.reminderLeadDays)
        ? Math.max(1, Math.min(30, Math.round(value.reminderLeadDays)))
        : defaults.reminderLeadDays,
    sendToTrainer:
      typeof value?.sendToTrainer === "boolean"
        ? value.sendToTrainer
        : defaults.sendToTrainer,
    sendToOrganizer:
      typeof value?.sendToOrganizer === "boolean"
        ? value.sendToOrganizer
        : defaults.sendToOrganizer,
    sendToParticipants:
      typeof value?.sendToParticipants === "boolean"
        ? value.sendToParticipants
        : defaults.sendToParticipants,
    requireParticipantSmsConfirmation:
      typeof value?.requireParticipantSmsConfirmation === "boolean"
        ? value.requireParticipantSmsConfirmation
        : defaults.requireParticipantSmsConfirmation,
    reminderSmsTemplate:
      typeof value?.reminderSmsTemplate === "string" && value.reminderSmsTemplate.trim()
        ? value.reminderSmsTemplate.trim()
        : defaults.reminderSmsTemplate,
    confirmationSmsTemplate:
      typeof value?.confirmationSmsTemplate === "string" && value.confirmationSmsTemplate.trim()
        ? value.confirmationSmsTemplate.trim()
        : defaults.confirmationSmsTemplate,
  };
}

export function resolveAttendanceConfirmationStatusLabel(
  status: EnrollmentAttendanceConfirmationStatus | null | undefined,
) {
  switch (status) {
    case "confirmed":
      return "Potwierdzona obecność";
    case "declined":
      return "Odmowa udziału";
    case "pending":
      return "Czeka na odpowiedź";
    default:
      return "Bez potwierdzenia SMS";
  }
}

function getDefaultNotificationSettingsFromValue(
  value: Partial<NotificationSettings>,
): Partial<NotificationSettings> {
  return {
    reminderLeadDays:
      typeof value.reminderLeadDays === "number" && Number.isFinite(value.reminderLeadDays)
        ? Math.max(1, Math.min(30, Math.round(value.reminderLeadDays)))
        : undefined,
    sendToTrainer:
      typeof value.sendToTrainer === "boolean" ? value.sendToTrainer : undefined,
    sendToOrganizer:
      typeof value.sendToOrganizer === "boolean" ? value.sendToOrganizer : undefined,
    sendToParticipants:
      typeof value.sendToParticipants === "boolean" ? value.sendToParticipants : undefined,
    requireParticipantSmsConfirmation:
      typeof value.requireParticipantSmsConfirmation === "boolean"
        ? value.requireParticipantSmsConfirmation
        : undefined,
    reminderSmsTemplate:
      typeof value.reminderSmsTemplate === "string" && value.reminderSmsTemplate.trim()
        ? value.reminderSmsTemplate.trim()
        : undefined,
    confirmationSmsTemplate:
      typeof value.confirmationSmsTemplate === "string" && value.confirmationSmsTemplate.trim()
        ? value.confirmationSmsTemplate.trim()
        : undefined,
  };
}

