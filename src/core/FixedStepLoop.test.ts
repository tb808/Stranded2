import { afterEach, describe, expect, it, vi } from "vitest";
import { FixedStepLoop } from "./FixedStepLoop";

describe("FixedStepLoop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("simulates at exactly 60 Hz, interpolates the remainder and caps catch-up work", () => {
    const scheduled: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      scheduled.push(callback);
      return scheduled.length;
    }));
    vi.spyOn(performance, "now").mockReturnValue(1_000);

    const fixedDeltas: number[] = [];
    const alphas: number[] = [];
    const loop = new FixedStepLoop({
      fixedUpdate: (dt) => fixedDeltas.push(dt),
      frameUpdate: (alpha) => alphas.push(alpha),
    });

    loop.start();
    scheduled.shift()!(1_020);
    expect(fixedDeltas).toHaveLength(1);
    expect(fixedDeltas[0]).toBeCloseTo(1 / 60, 10);
    expect(alphas[0]).toBeCloseTo(0.2, 5);

    scheduled.shift()!(2_020);
    expect(fixedDeltas).toHaveLength(6);
    expect(alphas[1]).toBe(0);

    loop.stop();
    scheduled.shift()!(2_040);
    expect(fixedDeltas).toHaveLength(6);
  });
});
