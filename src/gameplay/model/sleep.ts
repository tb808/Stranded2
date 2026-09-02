import {
  DAY_LENGTH_SECONDS,
  DAYLIGHT_DURATION_SECONDS,
  NIGHT_DURATION_SECONDS,
  type SurvivalState,
} from './survival';

export const DAY_START_FRACTION = 0.2;
export const NIGHT_END_FRACTION = 0.2;
export const NIGHT_START_FRACTION = 0.76;

export interface SleepResult {
  readonly slept: boolean;
  readonly state: SurvivalState;
}

export function getTimeOfDayFraction(dayElapsedSeconds: number): number {
  if (!Number.isFinite(dayElapsedSeconds) || dayElapsedSeconds < 0) {
    throw new RangeError('dayElapsedSeconds must be finite and non-negative.');
  }

  const elapsed = dayElapsedSeconds % DAY_LENGTH_SECONDS;
  const timeOfDay = elapsed < DAYLIGHT_DURATION_SECONDS
    ? DAY_START_FRACTION + (elapsed / DAYLIGHT_DURATION_SECONDS) * (NIGHT_START_FRACTION - DAY_START_FRACTION)
    : (
        NIGHT_START_FRACTION +
        ((elapsed - DAYLIGHT_DURATION_SECONDS) / NIGHT_DURATION_SECONDS) *
          (1 - NIGHT_START_FRACTION + NIGHT_END_FRACTION)
      ) % 1;
  return Math.round(timeOfDay * 1_000_000_000_000) / 1_000_000_000_000;
}

export function isNightTime(dayElapsedSeconds: number): boolean {
  const timeOfDay = getTimeOfDayFraction(dayElapsedSeconds);
  return timeOfDay >= NIGHT_START_FRACTION || timeOfDay < NIGHT_END_FRACTION;
}

export function sleepUntilMorning(state: SurvivalState): SleepResult {
  if (!isNightTime(state.dayElapsedSeconds)) {
    return { slept: false, state: { ...state } };
  }

  return {
    slept: true,
    state: {
      ...state,
      hunger: Math.max(0, state.hunger - 8),
      thirst: Math.max(0, state.thirst - 12),
      stamina: state.maxStamina,
      fatigue: 0,
      staminaRegenDelayRemaining: 0,
      dayElapsedSeconds: 0,
    },
  };
}
