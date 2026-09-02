import { describe, expect, it } from 'vitest';

import {
  DAY_LENGTH_SECONDS,
  DAYLIGHT_DURATION_SECONDS,
  NIGHT_DURATION_SECONDS,
  SURVIVAL_RATES,
  SURVIVAL_START,
  advanceSurvival,
  createInitialSurvivalState,
  type SurvivalState,
} from './survival';

function state(overrides: Partial<SurvivalState> = {}): SurvivalState {
  return { ...createInitialSurvivalState(), ...overrides };
}

describe('survival model', () => {
  it('uses the fixed planned start values and drain rates', () => {
    expect(createInitialSurvivalState()).toMatchObject(SURVIVAL_START);
    expect(SURVIVAL_RATES).toMatchObject({
      hungerDrainPerSecond: 1 / 75,
      thirstDrainPerSecond: 1 / 45,
      starvationDamagePerSecond: 1 / 4,
      dehydrationDamagePerSecond: 2 / 3,
      underwaterOxygenDrainPerSecond: 5,
      drowningDamagePerSecond: 5,
      sprintStaminaDrainPerSecond: 18,
      fastSwimStaminaDrainPerSecond: 12,
      staminaRegenPerSecond: 15,
      staminaRegenDelaySeconds: 1,
      fatigueGainPerSecond: 100 / (DAY_LENGTH_SECONDS * 2),
    });
    expect(DAYLIGHT_DURATION_SECONDS).toBe(300);
    expect(NIGHT_DURATION_SECONDS).toBe(120);
    expect(DAY_LENGTH_SECONDS).toBe(420);
  });

  it('drains hunger and thirst at their fixed rates', () => {
    const after = advanceSurvival(state(), 225);
    expect(after.hunger).toBeCloseTo(67);
    expect(after.thirst).toBeCloseTo(60);
  });

  it('damages health for starvation and dehydration using time spent at zero', () => {
    const starving = advanceSurvival(state({ hunger: 0 }), 4);
    expect(starving.health).toBeCloseTo(99);

    const dehydrating = advanceSurvival(state({ thirst: 0 }), 3);
    expect(dehydrating.health).toBeCloseTo(98);

    const reachesZeroMidStep = advanceSurvival(state({ hunger: 1 }), 79);
    expect(reachesZeroMidStep.health).toBeCloseTo(99);
  });

  it('drains oxygen underwater and applies drowning damage after it reaches zero', () => {
    const empty = advanceSurvival(state(), 20, { movement: 'swim', isUnderwater: true });
    expect(empty.oxygen).toBe(0);
    expect(empty.health).toBe(100);

    const drowning = advanceSurvival(empty, 2, { movement: 'swim', isUnderwater: true });
    expect(drowning.health).toBe(90);
    const surfaced = advanceSurvival(drowning, 0.1, { movement: 'idle', isUnderwater: false });
    expect(surfaced.oxygen).toBe(100);
  });

  it('verbraucht bei Hitze entsprechend schneller Wasser', () => {
    const normal = advanceSurvival(state(), 30, { movement: 'idle', isUnderwater: false });
    const hot = advanceSurvival(state(), 30, { movement: 'idle', isUnderwater: false, thirstDrainMultiplier: 1.8 });
    expect(state().thirst - hot.thirst).toBeCloseTo((state().thirst - normal.thirst) * 1.8);
  });

  it('drains sprint and fast-swim stamina and waits one second before regeneration', () => {
    const sprinting = advanceSurvival(state(), 1, { movement: 'sprint', isUnderwater: false });
    expect(sprinting.stamina).toBe(82);
    expect(sprinting.staminaRegenDelayRemaining).toBe(1);

    const waiting = advanceSurvival(sprinting, 1, { movement: 'walk', isUnderwater: false });
    expect(waiting.stamina).toBe(82);
    expect(waiting.staminaRegenDelayRemaining).toBe(0);

    const regenerating = advanceSurvival(waiting, 1, {
      movement: 'idle',
      isUnderwater: false,
    });
    expect(regenerating.stamina).toBe(97);

    const fastSwimming = advanceSurvival(state(), 1, {
      movement: 'fast-swim',
      isUnderwater: false,
    });
    expect(fastSwimming.stamina).toBe(88);
  });

  it('reduziert bei Kälte die maximale Ausdauer und stellt sie in Wärme wieder her', () => {
    const cold = advanceSurvival(state(), 60, {
      movement: 'idle',
      isUnderwater: false,
      isCold: true,
    });
    expect(cold.maxStamina).toBeCloseTo(95.2);
    expect(cold.stamina).toBeCloseTo(95.2);

    const warm = advanceSurvival(cold, 32, {
      movement: 'idle',
      isUnderwater: false,
      isCold: false,
    });
    expect(warm.maxStamina).toBe(100);
    expect(warm.stamina).toBe(100);
  });

  it('begrenzt den Kälteverlust der maximalen Ausdauer auf einen spielbaren Mindestwert', () => {
    const cold = advanceSurvival(state(), 10_000, {
      movement: 'idle',
      isUnderwater: false,
      isCold: true,
    });
    expect(cold.maxStamina).toBe(35);
    expect(cold.stamina).toBe(35);
  });

  it('builds fatigue over two days without sleep', () => {
    const afterOneDay = advanceSurvival(state({ hunger: 100, thirst: 100 }), DAY_LENGTH_SECONDS);
    expect(afterOneDay.fatigue).toBeCloseTo(50);
    const afterTwoDays = advanceSurvival(afterOneDay, DAY_LENGTH_SECONDS);
    expect(afterTwoDays.fatigue).toBe(100);
  });

  it('regenerates stamina more slowly while exhausted', () => {
    const rested = advanceSurvival(state({ stamina: 0, fatigue: 0 }), 1);
    const exhausted = advanceSurvival(state({ stamina: 0, fatigue: 100 }), 1);
    expect(rested.stamina).toBe(15);
    expect(exhausted.stamina).toBeCloseTo(5.25);
  });

  it('damages health at maximum fatigue until the player sleeps', () => {
    const exhausted = advanceSurvival(state({ fatigue: 100 }), 10);
    expect(exhausted.health).toBeCloseTo(99.2);
  });

  it('wraps the thirty-minute day clock', () => {
    expect(advanceSurvival(state({ dayElapsedSeconds: 415 }), 10).dayElapsedSeconds).toBe(5);
  });

  it('rejects invalid time deltas', () => {
    expect(() => advanceSurvival(state(), -1)).toThrow(RangeError);
    expect(() => advanceSurvival(state(), Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
