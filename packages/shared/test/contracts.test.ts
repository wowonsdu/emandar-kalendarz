import {
  hasInheritedRole,
  hasModeratorCapability,
  persistedCollectionKeys,
  storePatchRequestSchema,
} from "../src";
import { describe, expect, it } from "vitest";

describe("shared contracts", () => {
  it("accepts a partial store patch for known persisted collections", () => {
    const parsed = storePatchRequestSchema.parse({
      baseVersion: 1,
      collections: {
        users: [{ id: "user-1", role: "admin" }],
        appSettings: { signupPhotoMode: "optional" },
      },
    });

    expect(Object.keys(parsed.collections)).toEqual(["users", "appSettings"]);
  });

  it("keeps collection keys explicit", () => {
    expect(persistedCollectionKeys).toContain("trainingEvents");
    expect(persistedCollectionKeys).toContain("publicTrainingEvents");
  });

  it("models role inheritance cumulatively with moderator as an additive capability", () => {
    expect(hasInheritedRole(["trainer"], "organizer")).toBe(true);
    expect(hasInheritedRole(["organizer"], "trainer")).toBe(false);
    expect(hasModeratorCapability(["participant", "moderator"])).toBe(true);
    expect(hasModeratorCapability(["trainer"])).toBe(false);
    expect(hasModeratorCapability(["admin"])).toBe(true);
  });
});
