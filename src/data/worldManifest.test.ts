import { describe, expect, it } from 'vitest';

import { BUILDABLE_IDS } from './buildables';
import { ITEM_CATALOG } from './items';
import { RECIPE_CATALOG, RECIPE_IDS } from './recipes';
import { WORLD_MANIFEST, getIsland, getStartIsland } from './worldManifest';
import { Inventory } from '../gameplay/model/inventory';

describe('WORLD_MANIFEST', () => {
  it('contains the eleven planned, distinct tropical islands in release order', () => {
    expect(WORLD_MANIFEST.islands.map(({ id }) => id)).toEqual([
      'kleine-sandbank',
      'dschungelbucht',
      'palmenlagune',
      'mangrovenbucht',
      'felsenriff',
      'wasserfallinsel',
      'dschungelberg',
      'vulkaninsel',
      'blueteninsel',
      'mondklippen',
      'schatzsandbank',
    ]);
    expect(new Set(WORLD_MANIFEST.islands.map(({ id }) => id))).toHaveLength(11);
    expect(new Set(WORLD_MANIFEST.islands.map(({ archetype }) => archetype))).toHaveLength(11);
    expect(WORLD_MANIFEST.islands.every(({ climate }) => climate === 'tropical')).toBe(true);
    expect(WORLD_MANIFEST.islands.every(({ releasePhase }) => releasePhase === 1)).toBe(true);
  });

  it('documents identity, landmarks, landing site and resources for every playable island', () => {
    for (const island of WORLD_MANIFEST.islands) {
      expect(island.description.length, island.name).toBeGreaterThan(35);
      expect(island.visualIdentity.length, island.name).toBeGreaterThan(35);
      expect(island.landmarks.length, island.name).toBeGreaterThanOrEqual(2);
      expect(new Set(island.landmarks).size, island.name).toBe(island.landmarks.length);
      expect(island.safeLanding.label.length, island.name).toBeGreaterThan(3);
      expect(island.resources.length, island.name).toBeGreaterThan(0);
      expect(new Set(island.resources.map(({ sourceId }) => sourceId)).size, island.name).toBe(island.resources.length);
      expect(island.resources.every(({ count, yield: drops }) => (
        Number.isInteger(count) && count > 0 && drops.every(({ quantity }) => Number.isInteger(quantity) && quantity > 0)
      )), island.name).toBe(true);
      const normalizedLandingDistance = Math.hypot(
        island.safeLanding.offsetMeters.x / (island.dimensions.widthMeters * 0.5),
        island.safeLanding.offsetMeters.z / (island.dimensions.depthMeters * 0.5),
      );
      expect(normalizedLandingDistance, island.name).toBeLessThan(0.9);
    }
  });

  it('reserves eleven unique fixed positions and keeps the first destination 390 meters from the start', () => {
    const positions = WORLD_MANIFEST.islands.map(({ positionMeters }) => `${positionMeters.x}:${positionMeters.z}`);
    expect(new Set(positions)).toHaveLength(11);
    const start = getIsland('kleine-sandbank').positionMeters;
    const jungle = getIsland('dschungelbucht').positionMeters;
    expect(Math.hypot(jungle.x - start.x, jungle.z - start.z)).toBe(390);
    expect(WORLD_MANIFEST.islands.every(({ biomes, terrainProfile }) => (
      biomes.length > 0 && terrainProfile.maximumHeightMeters > 0
    ))).toBe(true);
  });

  it('has one smallest start island and a unique largest jungle island', () => {
    const area = (widthMeters: number, depthMeters: number): number => widthMeters * depthMeters;
    const start = getStartIsland();
    const startArea = area(start.dimensions.widthMeters, start.dimensions.depthMeters);
    const largest = WORLD_MANIFEST.islands.reduce((current, island) =>
      area(island.dimensions.widthMeters, island.dimensions.depthMeters) >
      area(current.dimensions.widthMeters, current.dimensions.depthMeters)
        ? island
        : current,
    );

    expect(WORLD_MANIFEST.islands.filter(({ isStart }) => isStart)).toHaveLength(1);
    expect(start.id).toBe('kleine-sandbank');
    expect(start.dimensions).toEqual({ widthMeters: 65, depthMeters: 45 });
    expect(
      WORLD_MANIFEST.islands
        .filter(({ id }) => id !== start.id)
        .every(
          ({ dimensions }) => area(dimensions.widthMeters, dimensions.depthMeters) > startArea,
        ),
    ).toBe(true);
    expect(largest.id).toBe('dschungelberg');
    expect(largest.hasJungle).toBe(true);
    expect(WORLD_MANIFEST.islands.filter(({ isLarge }) => isLarge).every(({ hasJungle }) => hasJungle)).toBe(
      true,
    );
    expect(WORLD_MANIFEST.islands.filter(({ isLarge }) => isLarge).map(({ id }) => id)).toEqual([
      'dschungelbucht',
      'wasserfallinsel',
      'dschungelberg',
    ]);
  });

  it('keeps the start island smallest, adds one compact treasure island and makes the other destinations substantially larger', () => {
    const start = getStartIsland();
    const startArea = start.dimensions.widthMeters * start.dimensions.depthMeters;
    const destinations = WORLD_MANIFEST.islands.filter(({ isStart }) => !isStart);

    expect(destinations.map(({ id, dimensions }) => ({ id, ...dimensions }))).toEqual([
      { id: 'dschungelbucht', widthMeters: 360, depthMeters: 270 },
      { id: 'palmenlagune', widthMeters: 290, depthMeters: 215 },
      { id: 'mangrovenbucht', widthMeters: 310, depthMeters: 225 },
      { id: 'felsenriff', widthMeters: 270, depthMeters: 185 },
      { id: 'wasserfallinsel', widthMeters: 430, depthMeters: 320 },
      { id: 'dschungelberg', widthMeters: 500, depthMeters: 375 },
      { id: 'vulkaninsel', widthMeters: 350, depthMeters: 270 },
      { id: 'blueteninsel', widthMeters: 320, depthMeters: 230 },
      { id: 'mondklippen', widthMeters: 320, depthMeters: 230 },
      { id: 'schatzsandbank', widthMeters: 82, depthMeters: 58 },
    ]);
    expect(destinations.filter(({ id }) => id !== 'schatzsandbank').every(({ dimensions }) => (
      dimensions.widthMeters * dimensions.depthMeters >= startArea * 10
    ))).toBe(true);
    const treasure = getIsland('schatzsandbank');
    const treasureArea = treasure.dimensions.widthMeters * treasure.dimensions.depthMeters;
    expect(treasureArea).toBeGreaterThan(startArea);
    expect(treasureArea).toBeLessThan(startArea * 2);
  });

  it('leaves navigable ocean between every pair of enlarged island shores', () => {
    for (let firstIndex = 0; firstIndex < WORLD_MANIFEST.islands.length; firstIndex += 1) {
      const first = WORLD_MANIFEST.islands[firstIndex]!;
      for (let secondIndex = firstIndex + 1; secondIndex < WORLD_MANIFEST.islands.length; secondIndex += 1) {
        const second = WORLD_MANIFEST.islands[secondIndex]!;
        const normalizedSeparation = Math.hypot(
          (second.positionMeters.x - first.positionMeters.x) /
            ((first.dimensions.widthMeters + second.dimensions.widthMeters) * 0.5),
          (second.positionMeters.z - first.positionMeters.z) /
            ((first.dimensions.depthMeters + second.dimensions.depthMeters) * 0.5),
        );
        expect(normalizedSeparation, `${first.name} / ${second.name}`).toBeGreaterThan(1.3);
      }
    }
  });

  it('adds enough harvestable life to prevent the larger destination islands from feeling empty', () => {
    const destinations = WORLD_MANIFEST.islands.filter(({ isStart, id }) => !isStart && id !== 'schatzsandbank');
    for (const island of destinations) {
      const totalSources = island.resources.reduce((total, resource) => total + resource.count, 0);
      expect(totalSources, island.name).toBeGreaterThanOrEqual(150);
      expect(island.resources.find(({ sourceId }) => sourceId === 'crab')?.count, island.name).toBeGreaterThanOrEqual(16);
      expect(island.resources.find(({ sourceId }) => sourceId === 'fiber_plant')?.count, island.name).toBeGreaterThanOrEqual(30);
    }
  });

  it('matches all exact start-resource source counts', () => {
    const counts = Object.fromEntries(
      getStartIsland().resources.map(({ sourceId, count }) => [sourceId, count]),
    );
    expect(counts).toEqual({
      loose_stick: 32,
      loose_stone: 12,
      fiber_plant: 16,
      palm_tree: 10,
      coconut: 8,
      crab: 6,
    });
  });

  it('provides enough reachable raw materials to craft every planned recipe', () => {
    const inventory = new Inventory();
    for (const source of getStartIsland().resources) {
      for (const harvested of source.yield) {
        const result = inventory.add(harvested.itemId, harvested.quantity * source.count);
        expect(result.remainder).toBe(0);
      }
    }

    const coconutByproduct = ITEM_CATALOG.coconut.useByproduct;
    expect(inventory.remove('coconut', 1).missing).toBe(0);
    expect(inventory.add(coconutByproduct.itemId, coconutByproduct.quantity).remainder).toBe(0);

    const explorationRecipes = new Set([
      'rain_collector',
      'bandage',
      'herbal_antidote',
      'woven_shirt',
      'backpack',
      'bait',
      'fishing_rod',
      'climbing_kit',
      'obsidian_knife',
      'whetstone',
      'flower_tonic',
      'fish_trap',
      'smoking_rack',
      'shovel',
    ]);
    const requiredLashings = RECIPE_IDS.filter((recipeId) => recipeId !== 'lashing' && !explorationRecipes.has(recipeId)).reduce(
      (total, recipeId) =>
        total +
        RECIPE_CATALOG[recipeId].ingredients
          .filter(({ itemId }) => itemId === 'lashing')
          .reduce((sum, { quantity }) => sum + quantity, 0),
      0,
    );

    for (let count = 0; count < requiredLashings; count += 1) {
      expect(inventory.consume(RECIPE_CATALOG.lashing.ingredients)).toBe(true);
      expect(inventory.add('lashing', 1).remainder).toBe(0);
    }

    for (const recipeId of RECIPE_IDS.filter((id) => id !== 'lashing' && !explorationRecipes.has(id))) {
      const recipe = RECIPE_CATALOG[recipeId];
      expect(inventory.consume(recipe.ingredients), recipe.label).toBe(true);
      if (recipe.output.kind === 'item') {
        expect(inventory.add(recipe.output.itemId, recipe.output.quantity).remainder).toBe(0);
      }
    }
  });

  it('has one recipe output for every buildable', () => {
    const buildableOutputs = RECIPE_IDS.flatMap((recipeId) => {
      const output = RECIPE_CATALOG[recipeId].output;
      return output.kind === 'buildable' ? [output.buildableId] : [];
    });
    expect(buildableOutputs.sort()).toEqual([...BUILDABLE_IDS].sort());
  });
});
