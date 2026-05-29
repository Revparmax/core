import { describe, expect, test } from "bun:test";

import {
  legacyPercentHundredthsToRatio,
  occupancyRatio,
  scaleLegacyHundredths,
} from "./legacy-read-model-transforms";

describe("legacy read-model transforms", () => {
  test("scales legacy money and room count hundredths", () => {
    expect(scaleLegacyHundredths(11_078)).toBe(110.78);
    expect(scaleLegacyHundredths(3800)).toBe(38);
    expect(scaleLegacyHundredths(undefined)).toBeUndefined();
  });

  test("converts legacy percent hundredths into ratios for canonical budgets", () => {
    expect(legacyPercentHundredthsToRatio(5591)).toBeCloseTo(0.5591);
    expect(legacyPercentHundredthsToRatio(undefined)).toBeUndefined();
  });

  test("computes competitor occupancy from occupied and total rooms", () => {
    expect(occupancyRatio(39, 110)).toBeCloseTo(0.3545);
    expect(occupancyRatio(39, 0)).toBeUndefined();
    expect(occupancyRatio(undefined, 110)).toBeUndefined();
  });
});
