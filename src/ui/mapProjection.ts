import type { MapIslandViewModel } from './types';

export interface MapProjection {
  project(x: number, z: number): { x: number; y: number };
  scaleLength(meters: number): number;
}

export function clampMapPoint(
  point: { x: number; y: number },
  width: number,
  height: number,
  inset = 7,
): { x: number; y: number } {
  return {
    x: Math.min(width - inset, Math.max(inset, point.x)),
    y: Math.min(height - inset, Math.max(inset, point.y)),
  };
}

export function createMapProjection(
  islands: readonly MapIslandViewModel[],
  width: number,
  height: number,
  padding = 12,
): MapProjection {
  const minX = Math.min(...islands.map((island) => island.x - island.width / 2));
  const maxX = Math.max(...islands.map((island) => island.x + island.width / 2));
  const minZ = Math.min(...islands.map((island) => island.z - island.depth / 2));
  const maxZ = Math.max(...islands.map((island) => island.z + island.depth / 2));
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(innerWidth / spanX, innerHeight / spanZ);
  const offsetX = padding + (innerWidth - spanX * scale) / 2;
  const offsetY = padding + (innerHeight - spanZ * scale) / 2;

  return {
    project: (x, z) => ({
      x: offsetX + (x - minX) * scale,
      y: offsetY + (maxZ - z) * scale,
    }),
    scaleLength: (meters) => meters * scale,
  };
}
