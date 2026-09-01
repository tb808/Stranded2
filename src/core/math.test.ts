import { describe, expect, it } from "vitest";
import { SeededRandom, fbm2D } from "./math";

describe("deterministische Weltzufallswerte", () => {
  it("liefert für denselben Welt-Seed identische Spawnfolgen", () => {
    const sequence = (seed: number) => {
      const random = new SeededRandom(seed);
      return Array.from({ length: 32 }, (_, index) => ({
        angleOffset: random.range(-0.14, 0.14),
        radius: random.range(4, 20),
        rotation: random.range(0, Math.PI * 2),
        index,
      }));
    };

    expect(sequence(0x57a4d2)).toEqual(sequence(0x57a4d2));
    expect(sequence(0x57a4d2)).not.toEqual(sequence(0x57a4d3));
    expect(fbm2D(12.5, -8.25, 29, 4)).toBe(fbm2D(12.5, -8.25, 29, 4));
  });
});
