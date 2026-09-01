import { describe, expect, it } from 'vitest';
import type { MapIslandViewModel } from './types';
import { clampMapPoint, createMapProjection } from './mapProjection';

const islands: MapIslandViewModel[] = [
  { id: 'west', label: 'West', x: -100, z: 0, width: 40, depth: 20, isStart: false, isCurrent: false },
  { id: 'east', label: 'East', x: 100, z: 100, width: 40, depth: 20, isStart: false, isCurrent: true },
];

describe('createMapProjection', () => {
  it('ordnet Osten rechts und Norden oben an', () => {
    const projection = createMapProjection(islands, 320, 200);
    const southWest = projection.project(-100, 0);
    const northEast = projection.project(100, 100);
    expect(northEast.x).toBeGreaterThan(southWest.x);
    expect(northEast.y).toBeLessThan(southWest.y);
  });

  it('verwendet für Inselbreite und -tiefe denselben Maßstab', () => {
    const projection = createMapProjection(islands, 320, 200);
    expect(projection.scaleLength(40)).toBeCloseTo(projection.scaleLength(20) * 2);
  });

  it('hält den Spielerpfeil auch außerhalb des Archipels am sichtbaren Kartenrand', () => {
    expect(clampMapPoint({ x: 500, y: -40 }, 320, 190)).toEqual({ x: 313, y: 7 });
  });
});
