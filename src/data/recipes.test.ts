import { describe, expect, it } from 'vitest';

import { getMaxDurability, ITEM_CATALOG } from './items';
import { RECIPE_CATALOG } from './recipes';

describe('RECIPE_CATALOG', () => {
  it('contains the exact planned ingredient quantities', () => {
    expect(
      Object.fromEntries(
        Object.entries(RECIPE_CATALOG).map(([id, recipe]) => [id, recipe.ingredients]),
      ),
    ).toEqual({
      lashing: [{ itemId: 'fiber', quantity: 4 }],
      stone_knife: [
        { itemId: 'stone', quantity: 1 },
        { itemId: 'fiber', quantity: 2 },
      ],
      obsidian_knife: [
        { itemId: 'obsidian_shard', quantity: 2 },
        { itemId: 'stick', quantity: 1 },
        { itemId: 'lashing', quantity: 1 },
      ],
      stone_axe: [
        { itemId: 'stone', quantity: 2 },
        { itemId: 'stick', quantity: 1 },
        { itemId: 'lashing', quantity: 1 },
      ],
      wooden_spear: [
        { itemId: 'stick', quantity: 2 },
        { itemId: 'lashing', quantity: 1 },
      ],
      building_hammer: [
        { itemId: 'stone', quantity: 1 },
        { itemId: 'stick', quantity: 2 },
        { itemId: 'lashing', quantity: 1 },
      ],
      bait: [{ itemId: 'crab', quantity: 1 }],
      fishing_rod: [
        { itemId: 'stick', quantity: 2 },
        { itemId: 'fiber', quantity: 2 },
        { itemId: 'lashing', quantity: 1 },
      ],
      climbing_kit: [
        { itemId: 'lashing', quantity: 2 },
        { itemId: 'cloth', quantity: 2 },
        { itemId: 'metal_scrap', quantity: 1 },
      ],
      shovel: [
        { itemId: 'palm_log', quantity: 1 },
        { itemId: 'stick', quantity: 2 },
        { itemId: 'lashing', quantity: 1 },
      ],
      whetstone: [
        { itemId: 'reef_stone', quantity: 2 },
        { itemId: 'stone', quantity: 1 },
      ],
      campfire: [
        { itemId: 'stone', quantity: 4 },
        { itemId: 'stick', quantity: 4 },
      ],
      shelter: [
        { itemId: 'stick', quantity: 3 },
        { itemId: 'palm_frond', quantity: 4 },
        { itemId: 'lashing', quantity: 1 },
      ],
      bed: [
        { itemId: 'stick', quantity: 3 },
        { itemId: 'palm_frond', quantity: 4 },
        { itemId: 'lashing', quantity: 1 },
      ],
      chest: [
        { itemId: 'palm_log', quantity: 2 },
        { itemId: 'stick', quantity: 2 },
        { itemId: 'lashing', quantity: 1 },
      ],
      workbench: [
        { itemId: 'palm_log', quantity: 2 },
        { itemId: 'stick', quantity: 4 },
        { itemId: 'lashing', quantity: 2 },
      ],
      palm_still: [
        { itemId: 'stick', quantity: 3 },
        { itemId: 'palm_frond', quantity: 3 },
        { itemId: 'lashing', quantity: 1 },
        { itemId: 'coconut_shell', quantity: 1 },
      ],
      rain_collector: [
        { itemId: 'stick', quantity: 3 },
        { itemId: 'palm_frond', quantity: 2 },
        { itemId: 'coconut_shell', quantity: 1 },
      ],
      fish_trap: [
        { itemId: 'stick', quantity: 4 },
        { itemId: 'palm_frond', quantity: 2 },
        { itemId: 'lashing', quantity: 1 },
      ],
      smoking_rack: [
        { itemId: 'stick', quantity: 5 },
        { itemId: 'stone', quantity: 4 },
        { itemId: 'lashing', quantity: 1 },
      ],
      bandage: [
        { itemId: 'healing_herb', quantity: 1 },
        { itemId: 'cloth', quantity: 1 },
      ],
      herbal_antidote: [
        { itemId: 'healing_herb', quantity: 2 },
        { itemId: 'coconut_shell', quantity: 1 },
      ],
      flower_tonic: [
        { itemId: 'wildflower', quantity: 3 },
        { itemId: 'healing_herb', quantity: 1 },
        { itemId: 'coconut_shell', quantity: 1 },
      ],
      woven_shirt: [
        { itemId: 'cloth', quantity: 3 },
        { itemId: 'lashing', quantity: 1 },
      ],
      backpack: [
        { itemId: 'cloth', quantity: 4 },
        { itemId: 'lashing', quantity: 2 },
        { itemId: 'stick', quantity: 1 },
      ],
      hut_foundation: [
        { itemId: 'palm_log', quantity: 2 },
        { itemId: 'lashing', quantity: 1 },
      ],
      hut_wall: [
        { itemId: 'palm_frond', quantity: 3 },
      ],
      hut_doorway: [
        { itemId: 'stick', quantity: 2 },
      ],
      hut_roof: [
        { itemId: 'palm_frond', quantity: 4 },
        { itemId: 'lashing', quantity: 1 },
      ],
      raft_base: [
        { itemId: 'palm_log', quantity: 4 },
        { itemId: 'lashing', quantity: 2 },
      ],
      raft_deck: [
        { itemId: 'stick', quantity: 4 },
        { itemId: 'palm_frond', quantity: 2 },
        { itemId: 'lashing', quantity: 1 },
      ],
      paddle: [
        { itemId: 'stick', quantity: 2 },
        { itemId: 'lashing', quantity: 1 },
      ],
    });
  });

  it('defines crafting time and tool durability in the data catalogs', () => {
    expect(Object.values(RECIPE_CATALOG).every(({ craftDurationSeconds }) => craftDurationSeconds > 0)).toBe(true);
    const tools = Object.values(ITEM_CATALOG).filter(({ category }) => category === 'tool');
    expect(tools.every(({ id }) => (getMaxDurability(id) ?? 0) > 0)).toBe(true);
    expect(getMaxDurability('stone_axe')).toBe(80);
    expect(getMaxDurability('shovel')).toBe(70);
    expect(RECIPE_CATALOG.shovel.requiredBlueprint).toBe('shovel_blueprint');
  });
});
