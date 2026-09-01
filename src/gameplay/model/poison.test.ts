import { describe, expect, it } from 'vitest';

import { DAY_LENGTH_SECONDS } from './survival';
import { POISON_DURATION_DAYS, POISON_DURATION_SECONDS, advancePoison } from './poison';

describe('Vergiftung', () => {
  it('zieht über genau drei Spieltage gleichmäßig 100 Leben ab', () => {
    expect(POISON_DURATION_DAYS).toBe(3);
    expect(POISON_DURATION_SECONDS).toBe(DAY_LENGTH_SECONDS * 3);

    const afterTwoDays = advancePoison(100, POISON_DURATION_SECONDS, DAY_LENGTH_SECONDS * 2);
    expect(afterTwoDays.health).toBeCloseTo(100 / 3);
    expect(afterTwoDays.remainingSeconds).toBe(DAY_LENGTH_SECONDS);

    const dead = advancePoison(afterTwoDays.health, afterTwoDays.remainingSeconds, DAY_LENGTH_SECONDS);
    expect(dead).toEqual({ health: 0, remainingSeconds: 0 });
  });

  it('wendet nur die noch aktive Giftzeit an und weist ungültige Werte zurück', () => {
    expect(advancePoison(80, 10, 20).remainingSeconds).toBe(0);
    expect(() => advancePoison(100, -1, 1)).toThrow(RangeError);
  });
});
