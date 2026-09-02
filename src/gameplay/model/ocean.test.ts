import { describe, expect, it } from "vitest";
import { oceanConditionsForWeather, oceanSurfaceHeight } from "./ocean";

describe("dynamisches Meer", () => {
  it("erzeugt bei Gewitter höhere, schnellere und schaumigere Wellen als bei Hitze", () => {
    const calm = oceanConditionsForWeather("heat", 80);
    const storm = oceanConditionsForWeather("storm", 80);

    expect(storm.waveHeight).toBeGreaterThan(calm.waveHeight * 4);
    expect(storm.waveSpeed).toBeGreaterThan(calm.waveSpeed);
    expect(storm.foamStrength).toBeGreaterThan(calm.foamStrength);
    expect(Math.hypot(storm.currentX, storm.currentZ)).toBeGreaterThan(Math.hypot(calm.currentX, calm.currentZ));
  });

  it("kombiniert Windwellen mit einer langsamen täglichen Gezeit", () => {
    const lowTide = oceanConditionsForWeather("clear", 315);
    const highTide = oceanConditionsForWeather("clear", 105);
    expect(highTide.tideHeight).toBeCloseTo(0.075, 4);
    expect(lowTide.tideHeight).toBeCloseTo(-0.075, 4);

    const first = oceanSurfaceHeight(140, -90, 12, oceanConditionsForWeather("rain", 12));
    const later = oceanSurfaceHeight(140, -90, 13, oceanConditionsForWeather("rain", 13));
    expect(first).not.toBeCloseTo(later, 4);
  });
});
