import { describe, expect, it } from 'vitest';

import {
  DAY_START_FRACTION,
  NIGHT_END_FRACTION,
  NIGHT_START_FRACTION,
  SLEEP_DURATION_FRACTION,
  SLEEP_DURATION_HOURS,
  getElapsedSecondsAtTimeOfDay,
  getTimeOfDayFraction,
  getWakeTimeFraction,
  isNightTime,
  sleepForEightHours,
} from './sleep';
import { DAY_LENGTH_SECONDS, DAYLIGHT_DURATION_SECONDS, NIGHT_DURATION_SECONDS, createInitialSurvivalState, SURVIVAL_RATES, type SurvivalState } from './survival';

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

  it('erlaubt Schlaf zu jeder Tageszeit und setzt die Uhr exakt acht Stunden vor', () => {
    expect(SLEEP_DURATION_HOURS).toBe(8);
    expect(SLEEP_DURATION_FRACTION).toBe(1 / 3);
    for (const bedtime of [0, 6 / 24, 12 / 24, 18 / 24, 23 / 24]) {
      expect(getWakeTimeFraction(elapsedAt(bedtime))).toBeCloseTo((bedtime + 8 / 24) % 1);
    }
  });

  it('überspringt acht Spielstunden und wendet Schlafkosten an, ohne die Eingabe zu verändern', () => {
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

    const result = sleepForEightHours(original);

    expect(result).toEqual({
      slept: true,
      skippedSeconds: expect.any(Number),
      state: {
        health: 73,
        hunger: expect.closeTo(Math.max(0, 6 - result.skippedSeconds * SURVIVAL_RATES.hungerDrainPerSecond)),
        thirst: expect.closeTo(Math.max(0, 9 - result.skippedSeconds * SURVIVAL_RATES.thirstDrainPerSecond)),
        stamina: 100,
        maxStamina: 100,
        oxygen: 100,
        fatigue: 0,
        staminaRegenDelayRemaining: 0,
        dayElapsedSeconds: elapsedAt(getWakeTimeFraction(original.dayElapsedSeconds)),
      },
    });
    expect(original.hunger).toBe(6);
    expect(original.dayElapsedSeconds).toBe(elapsedAt(0.95));
  });

  it('erlaubt auch tagsüber acht Stunden Schlaf', () => {
    const original = state({ hunger: 48, thirst: 37, stamina: 44, dayElapsedSeconds: elapsedAt(0.5) });
    const result = sleepForEightHours(original);

    expect(result.slept).toBe(true);
    expect(getTimeOfDayFraction(result.state.dayElapsedSeconds)).toBeCloseTo(20 / 24);
    expect(result.state.fatigue).toBe(0);
  });
});

it('lässt Hunger und Durst auch im Schlaf tödlich werden', () => {
  const result = sleepForEightHours(state({ health: 10, hunger: 0, thirst: 0, dayElapsedSeconds: elapsedAt(0.9) }));
  expect(result.slept).toBe(true);
  expect(result.state.health).toBe(0);
});
it('berechnet Brackwasserkrankheit nur für ihre verbleibende Dauer', () => {
  const original = state({ health: 50, hunger: 100, thirst: 100, dayElapsedSeconds: elapsedAt(0.9) });
  const healthy = sleepForEightHours(original);
  const sick = sleepForEightHours(original, 20);
  expect(healthy.state.health - sick.state.health).toBeCloseTo(8);
  expect(healthy.state.thirst - sick.state.thirst).toBeCloseTo(20 * SURVIVAL_RATES.thirstDrainPerSecond * 1.4);
});
it('lässt Tote nicht schlafen', () => {
  expect(sleepForEightHours(state({ health: 0, dayElapsedSeconds: elapsedAt(0.9) })).slept).toBe(false);
});
