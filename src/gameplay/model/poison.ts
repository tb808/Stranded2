import { DAY_LENGTH_SECONDS } from './survival';

export const POISON_DURATION_DAYS = 3;
export const POISON_DURATION_SECONDS = DAY_LENGTH_SECONDS * POISON_DURATION_DAYS;
export const POISON_DAMAGE_PER_SECOND = 100 / POISON_DURATION_SECONDS;

export interface PoisonAdvanceResult {
  readonly health: number;
  readonly remainingSeconds: number;
}

export function advancePoison(health: number, remainingSeconds: number, deltaSeconds: number): PoisonAdvanceResult {
  if (![health, remainingSeconds, deltaSeconds].every(Number.isFinite) || health < 0 || remainingSeconds < 0 || deltaSeconds < 0) {
    throw new RangeError('Poison values must be finite and non-negative.');
  }
  const activeSeconds = Math.min(deltaSeconds, remainingSeconds);
  const nextRemainingSeconds = Math.max(0, remainingSeconds - deltaSeconds);
  return {
    health: nextRemainingSeconds === 0 ? 0 : Math.max(0, health - activeSeconds * POISON_DAMAGE_PER_SECOND),
    remainingSeconds: nextRemainingSeconds,
  };
}
