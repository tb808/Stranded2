import { describe, expect, it } from "vitest";
import { advanceBleeding, BLEEDING_DAMAGE_PER_SECOND } from "./bleeding";

describe("bleeding", () => {
  it("drains health continuously while the wound is bleeding", () => {
    expect(advanceBleeding(80, true, 30)).toBeCloseTo(80 - 30 * BLEEDING_DAMAGE_PER_SECOND);
  });

  it("does not drain health after the bleeding has been stopped", () => {
    expect(advanceBleeding(80, false, 30)).toBe(80);
  });

  it("never lowers health below zero", () => {
    expect(advanceBleeding(2, true, 60)).toBe(0);
  });

  it("rejects invalid values", () => {
    expect(() => advanceBleeding(100, true, -1)).toThrow(RangeError);
    expect(() => advanceBleeding(Number.NaN, true, 1)).toThrow(RangeError);
  });
});
