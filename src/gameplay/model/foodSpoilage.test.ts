import { describe, expect, it } from "vitest";
import { DAY_LENGTH_SECONDS } from "./survival";
import { formatFoodFreshness, getFoodSpoilageDuration } from "./foodSpoilage";

describe("food spoilage", () => {
  it("gives raw, cooked and smoked food increasingly long shelf lives", () => {
    expect(getFoodSpoilageDuration("raw_meat")).toBe(DAY_LENGTH_SECONDS);
    expect(getFoodSpoilageDuration("cooked_meat")).toBe(DAY_LENGTH_SECONDS * 2);
    expect(getFoodSpoilageDuration("smoked_meat")).toBe(DAY_LENGTH_SECONDS * 5);
  });

  it("keeps hard-shelled coconuts non-perishable", () => {
    expect(getFoodSpoilageDuration("coconut")).toBeUndefined();
  });

  it("formats remaining shelf life for the inventory", () => {
    expect(formatFoodFreshness(DAY_LENGTH_SECONDS * 2)).toBe("noch 2 Tage haltbar");
    expect(formatFoodFreshness(59)).toBe("noch 1 Min. haltbar");
  });
});
