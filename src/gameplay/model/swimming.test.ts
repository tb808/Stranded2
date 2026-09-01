import { describe, expect, it } from 'vitest';
import { calculateSwimmingMotion } from './swimming';

const base = {
  yaw: 0,
  pitch: 0,
  forwardAxis: 1,
  rightAxis: 0,
  speed: 2.35,
  buoyancy: 0,
  ascend: false,
  descend: false,
};

describe('calculateSwimmingMotion', () => {
  it('schwimmt mit der Blickrichtung nach oben oder unten', () => {
    const upward = calculateSwimmingMotion({ ...base, pitch: 0.7 });
    const downward = calculateSwimmingMotion({ ...base, pitch: -0.7 });
    expect(upward.vertical).toBeGreaterThan(1.4);
    expect(downward.vertical).toBeLessThan(-1.4);
    expect(Math.abs(upward.z)).toBeLessThan(base.speed);
  });

  it('erzwingt mit der Sprungtaste Auftrieb, auch wenn der Blick nach unten zeigt', () => {
    const motion = calculateSwimmingMotion({ ...base, pitch: -1.1, ascend: true });
    expect(motion.vertical).toBeGreaterThanOrEqual(2.8);
  });

  it('behält die Abtauchtaste als eindeutige Gegensteuerung bei', () => {
    const motion = calculateSwimmingMotion({ ...base, pitch: 1.1, descend: true });
    expect(motion.vertical).toBeLessThanOrEqual(-2.4);
  });

  it('nutzt den natürlichen Auftrieb beim horizontalen Schwimmen und Treiben', () => {
    expect(calculateSwimmingMotion({ ...base, buoyancy: 0.8 }).vertical).toBeCloseTo(0.8);
    expect(calculateSwimmingMotion({ ...base, forwardAxis: 0, buoyancy: 0.8 }).vertical).toBeCloseTo(0.8);
  });
});
