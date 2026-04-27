import { persistedCollectionKeys, type PersistedCollectionKey } from "@emandar/shared";
import type { DemoStoreRecord, JsonRecord } from "./types.js";

export function getDefaultNotificationSettings() {
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

export function createEmptyStore(): DemoStoreRecord {
  return {
    users: [],
    trainers: [],
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
      defaultNotificationSettings: getDefaultNotificationSettings(),
    },
  };
}

export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeStore(raw: Record<string, unknown>): DemoStoreRecord {
  const defaults = createEmptyStore();
  const next = {} as DemoStoreRecord;

  for (const key of persistedCollectionKeys) {
    const fallback = defaults[key];
    const value = raw[key];
    next[key] = Array.isArray(fallback)
      ? Array.isArray(value)
        ? cloneValue(value)
        : []
      : value && typeof value === "object" && !Array.isArray(value)
        ? cloneValue(value as JsonRecord)
        : cloneValue(fallback);
  }

  return next;
}

export function getArrayCollectionKeys() {
  return persistedCollectionKeys.filter((key) => key !== "appSettings") as Exclude<
    PersistedCollectionKey,
    "appSettings"
  >[];
}
