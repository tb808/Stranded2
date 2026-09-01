import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_SECONDS } from './survival';
import { getWeatherState, weatherState } from './weather';

describe('Wetter', () => {
  it('liefert einen reproduzierbaren Tagesverlauf mit Regen, Hitze und Gewitter', () => {
    const states = Array.from({ length: 10 }, (_, index) =>
      getWeatherState(1, index * DAY_LENGTH_SECONDS / 10).kind,
    );
    expect(states).toEqual(expect.arrayContaining(['rain', 'heat', 'storm']));
    expect(getWeatherState(1, 240)).toEqual(getWeatherState(1, 240));
  });

  it('verstärkt bei Hitze den Durst und sammelt bei Gewitter besonders viel Wasser', () => {
    expect(weatherState('heat').thirstDrainMultiplier).toBeGreaterThan(1.5);
    expect(weatherState('storm')).toMatchObject({ isRaining: true, hasLightning: true });
    expect(weatherState('storm').rainCollectionMultiplier).toBeGreaterThan(weatherState('rain').rainCollectionMultiplier);
  });
});
