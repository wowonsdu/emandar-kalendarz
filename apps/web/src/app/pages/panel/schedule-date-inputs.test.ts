import { describe, expect, it } from "vitest";
import {
  addDaysToDateInput,
  getInclusiveDateRangeDayCount,
  getScheduleEndDateInputValue,
} from "./schedule-date-inputs";

describe("schedule date input helpers", () => {
  it("keeps one-day schedules on the same start and end date", () => {
    expect(getScheduleEndDateInputValue("2026-06-10", 1)).toBe("2026-06-10");
    expect(getInclusiveDateRangeDayCount("2026-06-10", "2026-06-10")).toBe(1);
  });

  it("sets a two-day schedule end date to the day after start", () => {
    expect(getScheduleEndDateInputValue("2026-06-10", 2)).toBe("2026-06-11");
    expect(addDaysToDateInput("2026-06-10", 1)).toBe("2026-06-11");
  });

  it("counts later end dates inclusively", () => {
    expect(getInclusiveDateRangeDayCount("2026-06-10", "2026-06-13")).toBe(4);
  });

  it("collapses an end date before start to one day", () => {
    expect(getInclusiveDateRangeDayCount("2026-06-10", "2026-06-09")).toBe(1);
  });
});
