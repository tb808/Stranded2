import { describe, expect, it } from 'vitest';

import {
  DAY_START_FRACTION,
  EARLIEST_WAKE_FRACTION,
  LATEST_WAKE_FRACTION,
  NIGHT_END_FRACTION,
  NIGHT_START_FRACTION,
  SLEEP_END_FRACTION,
  SLEEP_START_FRACTION,
  getElapsedSecondsAtTimeOfDay,
  getTimeOfDayFraction,
  getWakeTimeFraction,
  isNightTime,
  isSleepTime,
  sleepUntilMorning,
} from './sleep';
import { DAY_LENGTH_SECONDS, DAYLIGHT_DURATION_SECONDS, NIGHT_DURATION_SECONDS, createInitialSurvivalState, type SurvivalState } from './survival';

function elapsedAt(timeOfDayFraction: number): number {
  return getElapsedSecondsAtTimeOfDay(timeOfDayFraction);
}

function state(patch: Partial<SurvivalState> = {}): SurvivalState {
  return { ...createInitialSurvivalState(), ...patch };
}

describe('sleep helpers', () => {
  it('teilt den zehnminütigen Zyklus in sieben Minuten Tag und drei Minuten Nacht', () => {
    expect(DAY_LENGTH_SECONDS).toBe(600);
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

  it('erlaubt Schlaf von 18:00 bis einschließlich 03:00', () => {
    expect(isSleepTime(elapsedAt(SLEEP_START_FRACTION))).toBe(true);
    expect(isSleepTime(elapsedAt(0.99))).toBe(true);
    expect(isSleepTime(elapsedAt(0))).toBe(true);
    expect(isSleepTime(elapsedAt(SLEEP_END_FRACTION))).toBe(true);
    expect(isSleepTime(elapsedAt(SLEEP_START_FRACTION - 1 / 1_440))).toBe(false);
    expect(isSleepTime(elapsedAt(SLEEP_END_FRACTION + 1 / 1_440))).toBe(false);
  });

  it('berechnet abhängig von der Einschlafzeit eine Aufwachzeit zwischen 06:00 und 12:00', () => {
    expect(getWakeTimeFraction(elapsedAt(SLEEP_START_FRACTION))).toBeCloseTo(EARLIEST_WAKE_FRACTION);
    expect(getWakeTimeFraction(elapsedAt(21 / 24))).toBeCloseTo(8 / 24);
    expect(getWakeTimeFraction(elapsedAt(0))).toBeCloseTo(10 / 24);
    expect(getWakeTimeFraction(elapsedAt(SLEEP_END_FRACTION))).toBeCloseTo(LATEST_WAKE_FRACTION);
  });

  it('skips a night to morning and applies the sleep costs without mutating input', () => {
    const original = state({
      health: 73,
      hunger: 6,
      thirst: 9,
      stamina: 21,
      oxygen: 64,
      fatigue: 85,
      staminaRegenDelayRemaining: 0.8,
      dayElapsedSeconds: elapsedAt(0.95),
    });

    const result = sleepUntilMorning(original);

    expect(result).toEqual({
      slept: true,
      skippedSeconds: expect.any(Number),
      state: {
        health: 73,
        hunger: 0,
        thirst: 0,
        stamina: 100,
        maxStamina: 100,
        oxygen: 64,
        fatigue: 0,
        staminaRegenDelayRemaining: 0,
        dayElapsedSeconds: elapsedAt(getWakeTimeFraction(original.dayElapsedSeconds)),
      },
    });
    expect(original.hunger).toBe(6);
    expect(original.dayElapsedSeconds).toBe(elapsedAt(0.95));
  });

  it('returns an unchanged copy during daytime', () => {
    const original = state({ hunger: 48, thirst: 37, stamina: 44, dayElapsedSeconds: elapsedAt(0.5) });
    const result = sleepUntilMorning(original);

    expect(result).toEqual({ slept: false, state: original, skippedSeconds: 0 });
    expect(result.state).not.toBe(original);
  });
});
