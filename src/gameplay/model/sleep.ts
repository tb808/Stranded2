import {
  DAY_LENGTH_SECONDS,
  DAYLIGHT_DURATION_SECONDS,
  NIGHT_DURATION_SECONDS,
  type SurvivalState,
} from './survival';

export const DAY_START_FRACTION = 0.2;
export const NIGHT_END_FRACTION = 0.2;
export const NIGHT_START_FRACTION = 0.76;
export const SLEEP_START_FRACTION = 18 / 24;
export const SLEEP_END_FRACTION = 3 / 24;
export const EARLIEST_WAKE_FRACTION = 6 / 24;
export const LATEST_WAKE_FRACTION = 12 / 24;

export interface SleepResult {
  readonly slept: boolean;
  readonly state: SurvivalState;
  readonly skippedSeconds: number;
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
  const roundedTimeOfDay = Math.round(timeOfDay * 1_000_000_000_000) / 1_000_000_000_000;
  return roundedTimeOfDay % 1;
}

export function isNightTime(dayElapsedSeconds: number): boolean {
  const timeOfDay = getTimeOfDayFraction(dayElapsedSeconds);
  return timeOfDay >= NIGHT_START_FRACTION || timeOfDay < NIGHT_END_FRACTION;
}

export function getElapsedSecondsAtTimeOfDay(timeOfDayFraction: number): number {
  if (!Number.isFinite(timeOfDayFraction) || timeOfDayFraction < 0 || timeOfDayFraction >= 1) {
    throw new RangeError('timeOfDayFraction must be finite and between 0 (inclusive) and 1 (exclusive).');
  }
  if (timeOfDayFraction >= DAY_START_FRACTION && timeOfDayFraction < NIGHT_START_FRACTION) {
    return ((timeOfDayFraction - DAY_START_FRACTION) / (NIGHT_START_FRACTION - DAY_START_FRACTION)) * DAYLIGHT_DURATION_SECONDS;
  }
  const nightClockFraction = timeOfDayFraction >= NIGHT_START_FRACTION
    ? timeOfDayFraction - NIGHT_START_FRACTION
    : 1 - NIGHT_START_FRACTION + timeOfDayFraction;
  return DAYLIGHT_DURATION_SECONDS +
    (nightClockFraction / (1 - NIGHT_START_FRACTION + NIGHT_END_FRACTION)) * NIGHT_DURATION_SECONDS;
}

export function isSleepTime(dayElapsedSeconds: number): boolean {
  const timeOfDay = getTimeOfDayFraction(dayElapsedSeconds);
  return timeOfDay >= SLEEP_START_FRACTION || timeOfDay <= SLEEP_END_FRACTION;
}

export function getWakeTimeFraction(dayElapsedSeconds: number): number {
  const bedtime = getTimeOfDayFraction(dayElapsedSeconds);
  if (bedtime < SLEEP_START_FRACTION && bedtime > SLEEP_END_FRACTION) {
    throw new RangeError('The current time is outside the sleep window.');
  }
  const hoursAfterSleepStart = bedtime >= SLEEP_START_FRACTION
    ? bedtime - SLEEP_START_FRACTION
    : 1 - SLEEP_START_FRACTION + bedtime;
  const sleepWindowLength = 1 - SLEEP_START_FRACTION + SLEEP_END_FRACTION;
  const bedtimeProgress = hoursAfterSleepStart / sleepWindowLength;
  return EARLIEST_WAKE_FRACTION + bedtimeProgress * (LATEST_WAKE_FRACTION - EARLIEST_WAKE_FRACTION);
}

export function sleepUntilMorning(state: SurvivalState): SleepResult {
  if (!isSleepTime(state.dayElapsedSeconds)) {
    return { slept: false, state: { ...state }, skippedSeconds: 0 };
  }

  const wakeElapsedSeconds = getElapsedSecondsAtTimeOfDay(getWakeTimeFraction(state.dayElapsedSeconds));
  const currentElapsedSeconds = state.dayElapsedSeconds % DAY_LENGTH_SECONDS;
  const skippedSeconds = (wakeElapsedSeconds - currentElapsedSeconds + DAY_LENGTH_SECONDS) % DAY_LENGTH_SECONDS;

  return {
    slept: true,
    skippedSeconds,
    state: {
      ...state,
      hunger: Math.max(0, state.hunger - 8),
      thirst: Math.max(0, state.thirst - 12),
      stamina: state.maxStamina,
      fatigue: 0,
      staminaRegenDelayRemaining: 0,
      dayElapsedSeconds: wakeElapsedSeconds,
    },
  };
}
