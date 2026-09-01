import { describe, expect, it } from 'vitest';

import {
  DAY_START_FRACTION,
  NIGHT_END_FRACTION,
  NIGHT_START_FRACTION,
  getTimeOfDayFraction,
  isNightTime,
  sleepUntilMorning,
} from './sleep';
import { DAY_LENGTH_SECONDS, DAYLIGHT_DURATION_SECONDS, NIGHT_DURATION_SECONDS, createInitialSurvivalState, type SurvivalState } from './survival';

function elapsedAt(timeOfDayFraction: number): number {
  if (timeOfDayFraction >= DAY_START_FRACTION && timeOfDayFraction < NIGHT_START_FRACTION) {
    return ((timeOfDayFraction - DAY_START_FRACTION) / (NIGHT_START_FRACTION - DAY_START_FRACTION)) * DAYLIGHT_DURATION_SECONDS;
  }
  const nightClockFraction = timeOfDayFraction >= NIGHT_START_FRACTION
    ? timeOfDayFraction - NIGHT_START_FRACTION
    : 1 - NIGHT_START_FRACTION + timeOfDayFraction;
  return DAYLIGHT_DURATION_SECONDS +
    (nightClockFraction / (1 - NIGHT_START_FRACTION + NIGHT_END_FRACTION)) * NIGHT_DURATION_SECONDS;
}

function state(patch: Partial<SurvivalState> = {}): SurvivalState {
  return { ...createInitialSurvivalState(), ...patch };
}

describe('sleep helpers', () => {
  it('teilt den siebenminütigen Zyklus in fünf Minuten Tag und zwei Minuten Nacht', () => {
    expect(DAY_LENGTH_SECONDS).toBe(420);
    expect(elapsedAt(NIGHT_START_FRACTION)).toBe(DAYLIGHT_DURATION_SECONDS);
    expect(DAY_LENGTH_SECONDS - elapsedAt(NIGHT_START_FRACTION)).toBe(NIGHT_DURATION_SECONDS);
  });

  it('converts elapsed game time to the displayed time of day', () => {
    expect(getTimeOfDayFraction(0)).toBe(DAY_START_FRACTION);
    expect(getTimeOfDayFraction(DAY_LENGTH_SECONDS)).toBe(DAY_START_FRACTION);
    expect(getTimeOfDayFraction(elapsedAt(0))).toBe(0);
    expect(() => getTimeOfDayFraction(-1)).toThrow(RangeError);
    expect(() => getTimeOfDayFraction(Number.NaN)).toThrow(RangeError);
  });

  it('treats the configured night start as inclusive and morning as exclusive', () => {
    expect(isNightTime(elapsedAt(NIGHT_START_FRACTION))).toBe(true);
    expect(isNightTime(elapsedAt(0.99))).toBe(true);
    expect(isNightTime(elapsedAt(0))).toBe(true);
    expect(isNightTime(elapsedAt(NIGHT_END_FRACTION - 0.01))).toBe(true);
    expect(isNightTime(elapsedAt(NIGHT_END_FRACTION))).toBe(false);
    expect(isNightTime(elapsedAt(0.5))).toBe(false);
  });

  it('skips a night to morning and applies the sleep costs without mutating input', () => {
    const original = state({
      health: 73,
      hunger: 6,
      thirst: 9,
      stamina: 21,
      oxygen: 64,
      staminaRegenDelayRemaining: 0.8,
      dayElapsedSeconds: elapsedAt(0.95),
    });

    const result = sleepUntilMorning(original);

    expect(result).toEqual({
      slept: true,
      state: {
        health: 73,
        hunger: 0,
        thirst: 0,
        stamina: 100,
        maxStamina: 100,
        oxygen: 64,
        staminaRegenDelayRemaining: 0,
        dayElapsedSeconds: 0,
      },
    });
    expect(original.hunger).toBe(6);
    expect(original.dayElapsedSeconds).toBe(elapsedAt(0.95));
  });

  it('returns an unchanged copy during daytime', () => {
    const original = state({ hunger: 48, thirst: 37, stamina: 44, dayElapsedSeconds: elapsedAt(0.5) });
    const result = sleepUntilMorning(original);

    expect(result).toEqual({ slept: false, state: original });
    expect(result.state).not.toBe(original);
  });
});
