import { describe, expect, it } from "vitest";
import { mapAppError } from "./errors";

describe("mapAppError", () => {
  it("normalizes backend codes before mapping", () => {
    const mapped = mapAppError({
      code: "backend/internal",
      message: "internal",
    });

    expect(mapped).toBeInstanceOf(Error);
    expect(mapped.message).toBe(
      "Nie udalo sie zsynchronizowac feedow iCal. Sprobuj ponownie za chwile.",
    );
  });

  it("keeps explicit backend messages when no dedicated mapping exists", () => {
    const mapped = mapAppError({
      code: "backend/unknown-code",
      message: "Backend exploded",
    });

    expect(mapped).toBeInstanceOf(Error);
    expect(mapped.message).toBe("Backend exploded");
  });
});
