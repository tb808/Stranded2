import { describe, expect, it } from 'vitest';
import { WORLD_MANIFEST } from '../data/worldManifest';
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

  it('nimmt alle drei neuen Außeninseln vollständig in den Kartenmaßstab auf', () => {
    const manifestIslands: MapIslandViewModel[] = WORLD_MANIFEST.islands.map((island) => ({
      id: island.id,
      label: island.name,
      x: island.positionMeters.x,
      z: island.positionMeters.z,
      width: island.dimensions.widthMeters,
      depth: island.dimensions.depthMeters,
      isStart: island.isStart,
      isCurrent: false,
    }));
    const projection = createMapProjection(manifestIslands, 320, 190);
    for (const id of ['westwind-eiland', 'nordstern-sandbank', 'sonnenrand-insel']) {
      const island = manifestIslands.find((candidate) => candidate.id === id)!;
      const center = projection.project(island.x, island.z);
      const halfWidth = projection.scaleLength(island.width) / 2;
      const halfDepth = projection.scaleLength(island.depth) / 2;
      expect(center.x).toBeGreaterThanOrEqual(12 + halfWidth);
      expect(center.x).toBeLessThanOrEqual(320 - 12 - halfWidth);
      expect(center.y).toBeGreaterThanOrEqual(12 + halfDepth);
      expect(center.y).toBeLessThanOrEqual(190 - 12 - halfDepth);
    }
  });
});
