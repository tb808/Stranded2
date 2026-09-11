import { Box3, Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AssetService } from '../assets/AssetService';
import type { RapierPhysicsWorld } from '../physics/RapierPhysicsWorld';
import { getChartedIslands, getIsland, WORLD_MANIFEST } from '../data/worldManifest';
import { GIANT_CAMP, GIANT_LAKE, ISLAND_WILDLIFE, TropicalWorld } from './TropicalWorld';

describe('Rieseninsel expedition', () => {
  let world: TropicalWorld;
  beforeAll(async () => {
    world = new TropicalWorld({ addFixedCylinder: () => ({}), addFixedCuboid: () => ({}), addTerrain: () => undefined, removeColliderBody: () => undefined } as unknown as RapierPhysicsWorld,
      { createModel: () => null, preloadModels: async () => undefined } as unknown as AssetService);
    await world.initialize();
  }, 30_000);
  afterAll(() => world.dispose());

  it('is ten times the previous largest island and separated by kilometres of open sea', () => {
    const giant = getIsland('rieseninsel');
    for (const other of WORLD_MANIFEST.islands.filter(({ id }) => id !== giant.id)) {
      expect(giant.dimensions.widthMeters * giant.dimensions.depthMeters).toBeGreaterThan(other.dimensions.widthMeters * other.dimensions.depthMeters * 10);
      const distance = Math.hypot(giant.positionMeters.x - other.positionMeters.x, giant.positionMeters.z - other.positionMeters.z);
      expect(distance - giant.dimensions.widthMeters / 2 - other.dimensions.widthMeters / 2).toBeGreaterThan(3000);
    }
  });

  it('has a deep central freshwater lake with a dry rim, and a genuinely flat camp', () => {
    const center = getIsland('rieseninsel').positionMeters;
    expect(world.heightAt(center.x, center.z)).toBeLessThan(GIANT_LAKE.surfaceY - 5.8);
    expect(world.getWaterSurfaceAt(center.x, center.z)).toBe(GIANT_LAKE.surfaceY);
    expect(world.isDeepWater(center.x, center.z)).toBe(true);
    expect(world.getWaterSurfaceAt(center.x - 900, center.z)).toBe(0);
    for (let i = 0; i < 36; i++) {
      const angle = i / 36 * Math.PI * 2;
      expect(world.heightAt(center.x + Math.cos(angle) * 180 * 1.28, center.z + Math.sin(angle) * 135 * 1.28)).toBeGreaterThan(9.9);
    }
    for (let x = -20; x <= 20; x += 4) for (let z = -16; z <= 16; z += 4) {
      expect(world.heightAt(center.x + GIANT_CAMP.x + x, center.z + GIANT_CAMP.z + z)).toBe(14);
    }
    expect(world.collect('rieseninsel-lake')).toMatchObject({ success: true, loot: [] });
  });

  it('grounds all camp props and Elias without intersecting bounding boxes', () => {
    const camp = world.scene.getObjectByName('Elias’ Lager')!;
    const props = camp.children.filter((child) => child instanceof Group);
    const npc = world.scene.getObjectByName('Elias Voss')!;
    world.scene.updateMatrixWorld(true);
    const boxes = [...props, npc].map((object) => ({ name: object.name, box: new Box3().setFromObject(object) }));
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!;
      expect(a.box.min.y, a.name).toBeCloseTo(14, 4);
      for (const b of boxes.slice(i + 1)) expect(a.box.intersectsBox(b.box), a.name + ' / ' + b.name).toBe(false);
    }
    expect(world.collect('elias').success).toBe(false);
    expect(npc.visible).toBe(true);
  });

  it('contains every existing land species, coastal fish, a shark and butterflies', () => {
    const animals = world.getWildlifePositions().filter(({ id }) => id.startsWith('rieseninsel-'));
    const counts = ISLAND_WILDLIFE.rieseninsel!;
    expect(animals.length).toBe(Object.values(counts).reduce((a, b) => a + b, 0));
    expect(new Set(animals.map(({ kind }) => kind))).toEqual(new Set(['wild_boar','chicken','turtle','bird','crocodile','snake']));
    const center = getIsland('rieseninsel').positionMeters;
    expect(world.getFishSchoolPositions().some(({ x, z }) => Math.hypot(x-center.x,z-center.z)<1000)).toBe(true);
    expect(world.scene.children.some((object) => object.userData.entityId === 'rieseninsel-coast-shark')).toBe(true);
    expect(world.scene.children.filter(({ name }) => name === 'Dschungel-Schmetterling')).toHaveLength(32);
    for (const animal of animals) expect(Math.hypot(animal.position.x-center.x-GIANT_CAMP.x,animal.position.z-center.z-GIANT_CAMP.z)).toBeGreaterThan(36);
  });

  it('keeps thousands of trees outside the camp clearing', () => {
    let count = 0;
    const matrix = new Matrix4();
    const position = new Vector3();
    world.scene.traverse((object) => {
      if (!(object instanceof InstancedMesh) || !object.name.includes('Stämme')) return;
      const ids = object.userData.entityIds as string[];
      if (!ids?.[0]?.startsWith('rieseninsel-')) return;
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
        expect(Math.hypot(position.x-4380,position.z-3680)).toBeGreaterThan(35);
        count++;
      }
    });
    expect(count).toBeGreaterThan(5000);
  });

  it('reveals the island only after looting the dug chest and restores old saves', () => {
    expect(world.isGiantIslandCharted()).toBe(false);
    expect(getChartedIslands(false).some(({ id }) => id === 'rieseninsel')).toBe(false);
    world.digBuriedChest('treasure-sandbar-buried-chest');
    expect(world.isGiantIslandCharted()).toBe(false);
    expect(world.collect('treasure-sandbar-buried-chest').loot).toEqual([{ itemId: 'giant_island_map', count: 1 }]);
    expect(world.isGiantIslandCharted()).toBe(true);
    expect(getChartedIslands(true)).toContain(getIsland('rieseninsel'));
    const restored = new TropicalWorld({} as RapierPhysicsWorld, {} as AssetService);
    restored.restore(world.serialize());
    expect(restored.isGiantIslandCharted()).toBe(true);
    restored.dispose();
  });
});
