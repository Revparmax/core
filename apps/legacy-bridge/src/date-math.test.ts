import { describe, expect, it } from "bun:test";

import {
  addDays,
  daysBetween,
  monthRange,
  sameDateLastYear,
  sameWeekdayLastYear,
} from "../../../packages/backend/convex/legacyBridge/dateMath";

describe("forecast date math", () => {
  it("shifts normal dates to the same date last year", () => {
    expect(sameDateLastYear("2026-05-22")).toBe("2025-05-22");
  });

  it("maps leap day to February 28 when the prior year is not leap", () => {
    expect(sameDateLastYear("2024-02-29")).toBe("2023-02-28");
  });

  it("shifts dates to the same weekday last year for pace overlays", () => {
    expect(sameWeekdayLastYear("2026-05-23")).toBe("2025-05-24");
    expect(sameWeekdayLastYear("2026-04-30")).toBe("2025-05-01");
  });

  it("computes UTC day offsets", () => {
    expect(daysBetween("2026-05-22", "2026-05-29")).toBe(7);
    expect(addDays("2026-05-22", -7)).toBe("2026-05-15");
  });

  it("returns a calendar month range", () => {
    expect(monthRange("2026-02")).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });
});
