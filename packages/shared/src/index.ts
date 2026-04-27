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
