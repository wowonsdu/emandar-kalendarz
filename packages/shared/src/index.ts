import { z } from "zod";

export const persistedCollectionKeys = [
  "users",
  "trainers",
  "organizers",
  "participantProfiles",
  "groups",
  "groupMembers",
  "eventParticipants",
  "relations",
  "trainingEvents",
  "publicTrainingEvents",
  "enrollmentRequests",
  "notifications",
  "appSettings",
] as const;

export const persistedCollectionKeySchema = z.enum(persistedCollectionKeys);

export type PersistedCollectionKey = z.infer<typeof persistedCollectionKeySchema>;

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type JsonValue = z.infer<typeof jsonPrimitiveSchema> | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

export const collectionValueSchema = z.union([z.array(jsonValueSchema), z.record(jsonValueSchema)]);

export const storeCollectionsPatchSchema = z
  .object(
    Object.fromEntries(
      persistedCollectionKeys.map((key) => [key, collectionValueSchema.optional()]),
    ) as Record<PersistedCollectionKey, z.ZodOptional<typeof collectionValueSchema>>,
  )
  .strict();

export const storePatchRequestSchema = z.object({
  baseVersion: z.number().int().nonnegative(),
  collections: storeCollectionsPatchSchema,
});

export const storeSnapshotResponseSchema = z.object({
  version: z.number().int().nonnegative(),
  store: z.record(collectionValueSchema),
});

export const storeVersionResponseSchema = z.object({
  version: z.number().int().nonnegative(),
});

export const storePatchResponseSchema = z.object({
  version: z.number().int().nonnegative(),
  writtenCollections: z.array(persistedCollectionKeySchema),
});

export const smsRequestSchema = z.object({
  phone: z.string().min(1),
});

export const smsConfirmSchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(1),
  seedTrainerId: z.string().optional(),
});

export const commandRequestSchema = z.object({
  args: z.array(z.unknown()).default([]),
});

export const okMutationResponseSchema = z.object({
  ok: z.literal(true),
  result: z.unknown().optional(),
});

export const publicCatalogResponseSchema = z.object({
  trainers: z.array(z.record(z.unknown())),
  organizers: z.array(z.record(z.unknown())).default([]),
  publicTrainingEvents: z.array(z.record(z.unknown())),
  trainingEvents: z.array(z.record(z.unknown())).default([]),
  appSettings: z.record(z.unknown()).default({}),
});

export const publicTrainerListResponseSchema = z.object({
  trainers: z.array(z.record(z.unknown())),
});

export const publicEventListResponseSchema = z.object({
  events: z.array(z.record(z.unknown())),
});

const queryScalarSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.union([z.string(), z.number()]).optional(),
);

const repeatedQueryStringSchema = z.preprocess(
  (value) => {
    if (value === undefined) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  },
  z
    .array(z.string())
    .transform((values) => values.map((value) => value.trim()).filter(Boolean)),
);

function parsePositiveIntQueryParam(value: z.infer<typeof queryScalarSchema>, fallback: number, ctx: z.RefinementCtx) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expected a positive integer",
    });
    return z.NEVER;
  }

  return parsed;
}

function isValidCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

const calendarDateQuerySchema = queryScalarSchema.transform((value, ctx) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }

  if (!isValidCalendarDate(normalized)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Expected YYYY-MM-DD",
    });
    return z.NEVER;
  }

  return normalized;
});

export const publicEventAudienceQuerySchema = queryScalarSchema.transform((value, ctx) => {
  const normalized = String(value ?? "all").trim();
  if (normalized === "all" || normalized === "new-people" || normalized === "existing-practitioners") {
    return normalized;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Invalid audience",
  });
  return z.NEVER;
});

export type PublicEventAudienceQuery = z.infer<typeof publicEventAudienceQuerySchema>;

const publicEventSearchQuerySchema = queryScalarSchema.transform((value) => {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
});

export const paginatedRecordsResponseSchema = z.object({
  items: z.array(z.record(z.unknown())),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const publicEventPageQuerySchema = z
  .object({
    page: queryScalarSchema.transform((value, ctx) => parsePositiveIntQueryParam(value, 1, ctx)),
    pageSize: queryScalarSchema.transform((value, ctx) => parsePositiveIntQueryParam(value, 25, ctx)),
    sort: queryScalarSchema.transform((value, ctx) => {
      const normalized = String(value ?? "startsAtAsc").trim();
      if (normalized === "startsAtAsc" || normalized === "startsAtDesc" || normalized === "createdAtDesc") {
        return normalized;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid sort",
      });
      return z.NEVER;
    }),
    search: publicEventSearchQuerySchema,
    trainerId: repeatedQueryStringSchema,
    dateFrom: calendarDateQuerySchema,
    dateTo: calendarDateQuerySchema,
    audience: publicEventAudienceQuerySchema,
  })
  .partial()
  .transform((value, ctx) => {
    const dateFrom = value.dateFrom;
    const dateTo = value.dateTo;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dateFrom must be before or equal to dateTo",
        path: ["dateFrom"],
      });
      return z.NEVER;
    }

    return {
      page: value.page ?? 1,
      pageSize: value.pageSize ?? 25,
      sort: value.sort ?? "startsAtAsc",
      search: value.search,
      trainerId: value.trainerId ?? [],
      dateFrom,
      dateTo,
      audience: value.audience ?? "all",
    };
  });

export type PublicEventPageQuery = z.infer<typeof publicEventPageQuerySchema>;

export const publicEventFiltersResponseSchema = z.object({
  tags: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  trainers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  dateBounds: z
    .object({
      min: z.string(),
      max: z.string(),
    })
    .nullable(),
});

export const publicEventPageResponseSchema = paginatedRecordsResponseSchema.extend({
  filters: publicEventFiltersResponseSchema,
});

export const publicEventDetailResponseSchema = z.object({
  event: z.record(z.unknown()).nullable(),
});

export const panelReadModelResponseSchema = z.object({
  users: z.array(z.record(z.unknown())).default([]),
  trainers: z.array(z.record(z.unknown())).default([]),
  organizers: z.array(z.record(z.unknown())).default([]),
  participantProfiles: z.array(z.record(z.unknown())).default([]),
  groups: z.array(z.record(z.unknown())).default([]),
  groupMembers: z.array(z.record(z.unknown())).default([]),
  eventParticipants: z.array(z.record(z.unknown())).default([]),
  relations: z.array(z.record(z.unknown())).default([]),
  trainingEvents: z.array(z.record(z.unknown())).default([]),
  publicTrainingEvents: z.array(z.record(z.unknown())).default([]),
  enrollmentRequests: z.array(z.record(z.unknown())).default([]),
  notifications: z.array(z.record(z.unknown())).default([]),
  appSettings: z.record(z.unknown()).default({}),
});

export const panelNavigationResponseSchema = z.object({
  notificationsCount: z.number().int().nonnegative(),
  pendingEnrollmentRequestsCount: z.number().int().nonnegative(),
  pendingCommunityEventsCount: z.number().int().nonnegative(),
});

export const sseEventTypeSchema = z.enum([
  "notification.created",
  "notification.read",
  "notification.count",
  "job.updated",
  "entity.changed",
]);

export const sseEventSchema = z.object({
  type: sseEventTypeSchema,
  id: z.string().optional(),
  userId: z.string().optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  count: z.number().int().nonnegative().optional(),
  jobId: z.string().optional(),
  status: z.string().optional(),
});

export const participantRegistrationRequestSchema = z.object({
  registrationToken: z.string().min(1),
  input: z.record(z.unknown()),
});

export const publicEnrollmentRequestSchema = z.object({
  eventId: z.string().min(1),
  intent: z.string().optional(),
  imieNazwisko: z.string().min(1),
  telefon: z.string().min(1),
  polecenieOdKogo: z.string().default(""),
  wiadomosc: z.string().default(""),
  photoUploadId: z.string().optional(),
});

export const uploadRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  dataBase64: z.string().min(1),
  purpose: z.enum(["avatar", "enrollment-photo", "event-image"]).default("event-image"),
});

export const uploadResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  width: z.number().int().nonnegative().default(0),
  height: z.number().int().nonnegative().default(0),
});

export const signedActionTokenSchema = z.object({
  token: z.string().min(32),
});

export const signedAttendanceDecisionSchema = z.enum(["confirm", "decline"]);

export const signedAttendanceRequestSchema = signedActionTokenSchema.extend({
  decision: signedAttendanceDecisionSchema,
});

export const signedCommunityEventReviewRequestSchema = signedActionTokenSchema.extend({
  decision: z.enum(["accepted", "rejected"]),
  message: z.string().default(""),
});

export const booleanMutationSchema = z.object({
  enabled: z.boolean().optional(),
  blocked: z.boolean().optional(),
});

export const eventParticipantStatusMutationSchema = z.object({
  eventParticipantId: z.string().min(1),
  status: z.string().min(1),
});

export const appSettingsMutationSchema = z.object({
  input: z.record(z.unknown()),
});

export const communityEventReviewMutationSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  message: z.string().default(""),
});

export const authSessionResponseSchema = z.object({
  userId: z.string().nullable(),
});

export const smsRequestResponseSchema = z.object({
  normalizedPhone: z.string(),
  code: z.string().optional(),
});

export const smsConfirmResponseSchema = z.union([
  z.object({
    status: z.literal("existing-account"),
    userId: z.string(),
    phone: z.string(),
  }),
  z.object({
    status: z.literal("missing-account"),
    phone: z.string(),
    registrationToken: z.string(),
    verifiedAt: z.string().optional(),
  }),
]);

export const csrfResponseSchema = z.object({
  token: z.string(),
});

export const roleSchema = z.enum(["participant", "moderator", "organizer", "trainer", "admin"]);
export type AppRole = z.infer<typeof roleSchema>;

export const linearRoleHierarchy: Exclude<AppRole, "moderator">[] = [
  "participant",
  "organizer",
  "trainer",
  "admin",
];

export function hasInheritedRole(roles: AppRole[], requiredRole: Exclude<AppRole, "moderator">) {
  const highestLevel = Math.max(
    ...roles
      .filter((role): role is Exclude<AppRole, "moderator"> => role !== "moderator")
      .map((role) => linearRoleHierarchy.indexOf(role)),
    0,
  );

  return highestLevel >= linearRoleHierarchy.indexOf(requiredRole);
}

export function hasModeratorCapability(roles: AppRole[]) {
  return roles.includes("moderator") || hasInheritedRole(roles, "admin");
}
