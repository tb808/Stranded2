import { clamp } from "../../core/math";

export const BLEEDING_DAMAGE_PER_SECOND = 0.1;

export function advanceBleeding(health: number, isBleeding: boolean, deltaSeconds: number): number {
  if (![health, deltaSeconds].every(Number.isFinite) || health < 0 || deltaSeconds < 0) {
    throw new RangeError("Bleeding values must be finite and non-negative.");
  }
  if (!isBleeding || health === 0 || deltaSeconds === 0) return health;
  return clamp(health - deltaSeconds * BLEEDING_DAMAGE_PER_SECOND, 0, 100);
}
