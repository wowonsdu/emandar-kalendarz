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
