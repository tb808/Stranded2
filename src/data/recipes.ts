import type { BuildableId } from './buildables';
import type { ItemAmount, ItemId } from './items';

export type RecipeCategory = 'components' | 'tools' | 'survival' | 'building' | 'raft';
export type CraftingStation = 'hand' | 'workbench';

export type RecipeId =
  | 'lashing'
  | 'stone_knife'
  | 'obsidian_knife'
  | 'stone_axe'
  | 'wooden_spear'
  | 'building_hammer'
  | 'bait'
  | 'fishing_rod'
  | 'climbing_kit'
  | 'shovel'
  | 'whetstone'
  | 'campfire'
  | 'shelter'
  | 'bed'
  | 'chest'
  | 'workbench'
  | 'palm_still'
  | 'rain_collector'
  | 'fish_trap'
  | 'smoking_rack'
  | 'bandage'
  | 'simple_bandage'
  | 'herbal_antidote'
  | 'flower_tonic'
  | 'woven_shirt'
  | 'backpack'
  | 'hut_foundation'
  | 'hut_wall'
  | 'hut_doorway'
  | 'hut_roof'
  | 'raft_base'
  | 'raft_deck'
  | 'paddle';

export type RecipeOutput =
  | {
      readonly kind: 'item';
      readonly itemId: ItemId;
      readonly quantity: number;
    }
  | {
      readonly kind: 'buildable';
      readonly buildableId: BuildableId;
      readonly quantity: 1;
    };

export interface RecipeDefinition {
  readonly id: RecipeId;
  readonly label: string;
  readonly category: RecipeCategory;
  readonly ingredients: readonly ItemAmount[];
  readonly requiredBlueprint?: ItemId;
  readonly craftDurationSeconds: number;
  readonly output: RecipeOutput;
}

export const RECIPE_CATALOG = {
  lashing: {
    id: 'lashing',
    label: 'Seilbindung',
    category: 'components',
    craftDurationSeconds: 1,
    ingredients: [{ itemId: 'fiber', quantity: 4 }],
    output: { kind: 'item', itemId: 'lashing', quantity: 1 },
  },
  stone_knife: {
    id: 'stone_knife',
    label: 'Steinmesser',
    category: 'tools',
    craftDurationSeconds: 2,
    ingredients: [
      { itemId: 'stone', quantity: 1 },
      { itemId: 'fiber', quantity: 2 },
    ],
    output: { kind: 'item', itemId: 'stone_knife', quantity: 1 },
  },
  obsidian_knife: {
    id: 'obsidian_knife',
    label: 'Obsidianmesser',
    category: 'tools',
    craftDurationSeconds: 4,
    ingredients: [
      { itemId: 'obsidian_shard', quantity: 2 },
      { itemId: 'stick', quantity: 1 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'obsidian_knife', quantity: 1 },
  },
  stone_axe: {
    id: 'stone_axe',
    label: 'Steinaxt',
    category: 'tools',
    craftDurationSeconds: 4,
    ingredients: [
      { itemId: 'stone', quantity: 2 },
      { itemId: 'stick', quantity: 1 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'stone_axe', quantity: 1 },
  },
  wooden_spear: {
    id: 'wooden_spear',
    label: 'Holzspeer',
    category: 'tools',
    craftDurationSeconds: 3,
    ingredients: [
      { itemId: 'stick', quantity: 2 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'wooden_spear', quantity: 1 },
  },
  building_hammer: {
    id: 'building_hammer',
    label: 'Bauhammer',
    category: 'tools',
    craftDurationSeconds: 4,
    ingredients: [
      { itemId: 'stone', quantity: 1 },
      { itemId: 'stick', quantity: 2 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'building_hammer', quantity: 1 },
  },
  bait: {
    id: 'bait',
    label: 'Fischköder',
    category: 'components',
    craftDurationSeconds: 2,
    ingredients: [{ itemId: 'crab', quantity: 1 }],
    output: { kind: 'item', itemId: 'bait', quantity: 2 },
  },
  fishing_rod: {
    id: 'fishing_rod',
    label: 'Angel',
    category: 'tools',
    craftDurationSeconds: 5,
    ingredients: [
      { itemId: 'stick', quantity: 2 },
      { itemId: 'fiber', quantity: 2 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'fishing_rod', quantity: 1 },
  },
  climbing_kit: {
    id: 'climbing_kit',
    label: 'Kletterset',
    category: 'tools',
    craftDurationSeconds: 7,
    ingredients: [
      { itemId: 'lashing', quantity: 2 },
      { itemId: 'cloth', quantity: 2 },
      { itemId: 'metal_scrap', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'climbing_kit', quantity: 1 },
  },
  shovel: {
    id: 'shovel',
    label: 'Improvisierte Schaufel',
    category: 'tools',
    craftDurationSeconds: 5,
    requiredBlueprint: 'shovel_blueprint',
    ingredients: [
      { itemId: 'palm_log', quantity: 1 },
      { itemId: 'stick', quantity: 2 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'shovel', quantity: 1 },
  },
  whetstone: {
    id: 'whetstone',
    label: 'Riff-Wetzstein',
    category: 'tools',
    craftDurationSeconds: 3,
    ingredients: [
      { itemId: 'reef_stone', quantity: 2 },
      { itemId: 'stone', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'whetstone', quantity: 1 },
  },
  campfire: {
    id: 'campfire',
    label: 'Lagerfeuer',
    category: 'survival',
    craftDurationSeconds: 5,
    ingredients: [
      { itemId: 'stone', quantity: 4 },
      { itemId: 'stick', quantity: 4 },
    ],
    output: { kind: 'buildable', buildableId: 'campfire', quantity: 1 },
  },
  shelter: {
    id: 'shelter',
    label: 'Schutzdach',
    category: 'survival',
    craftDurationSeconds: 8,
    ingredients: [
      { itemId: 'stick', quantity: 3 },
      { itemId: 'palm_frond', quantity: 4 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'shelter', quantity: 1 },
  },
  bed: {
    id: 'bed',
    label: 'Bett',
    category: 'survival',
    craftDurationSeconds: 7,
    ingredients: [
      { itemId: 'stick', quantity: 3 },
      { itemId: 'palm_frond', quantity: 4 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'bed', quantity: 1 },
  },
  chest: {
    id: 'chest',
    label: 'Truhe',
    category: 'survival',
    craftDurationSeconds: 8,
    ingredients: [
      { itemId: 'palm_log', quantity: 2 },
      { itemId: 'stick', quantity: 2 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'chest', quantity: 1 },
  },
  workbench: {
    id: 'workbench',
    label: 'Werkbank',
    category: 'survival',
    craftDurationSeconds: 10,
    ingredients: [
      { itemId: 'palm_log', quantity: 2 },
      { itemId: 'stick', quantity: 4 },
      { itemId: 'lashing', quantity: 2 },
    ],
    output: { kind: 'buildable', buildableId: 'workbench', quantity: 1 },
  },
  palm_still: {
    id: 'palm_still',
    label: 'Palm-Destille',
    category: 'survival',
    craftDurationSeconds: 10,
    ingredients: [
      { itemId: 'stick', quantity: 3 },
      { itemId: 'palm_frond', quantity: 3 },
      { itemId: 'lashing', quantity: 1 },
      { itemId: 'coconut_shell', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'palm_still', quantity: 1 },
  },
  rain_collector: {
    id: 'rain_collector',
    label: 'Regenfänger',
    category: 'survival',
    craftDurationSeconds: 8,
    ingredients: [
      { itemId: 'stick', quantity: 3 },
      { itemId: 'palm_frond', quantity: 2 },
      { itemId: 'coconut_shell', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'rain_collector', quantity: 1 },
  },
  fish_trap: {
    id: 'fish_trap',
    label: 'Fischreuse',
    category: 'survival',
    craftDurationSeconds: 8,
    ingredients: [
      { itemId: 'stick', quantity: 4 },
      { itemId: 'palm_frond', quantity: 2 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'fish_trap', quantity: 1 },
  },
  smoking_rack: {
    id: 'smoking_rack',
    label: 'Räuchergestell',
    category: 'survival',
    craftDurationSeconds: 10,
    ingredients: [
      { itemId: 'stick', quantity: 5 },
      { itemId: 'stone', quantity: 4 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'smoking_rack', quantity: 1 },
  },
  bandage: {
    id: 'bandage',
    label: 'Kräuterverband',
    category: 'survival',
    craftDurationSeconds: 3,
    ingredients: [
      { itemId: 'healing_herb', quantity: 1 },
      { itemId: 'cloth', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'bandage', quantity: 1 },
  },
  simple_bandage: {
    id: 'simple_bandage',
    label: 'Einfacher Verband',
    category: 'survival',
    craftDurationSeconds: 2,
    ingredients: [{ itemId: 'fiber', quantity: 3 }],
    output: { kind: 'item', itemId: 'simple_bandage', quantity: 1 },
  },
  herbal_antidote: {
    id: 'herbal_antidote',
    label: 'Pflanzliches Gegengift',
    category: 'survival',
    craftDurationSeconds: 4,
    ingredients: [
      { itemId: 'healing_herb', quantity: 2 },
      { itemId: 'coconut_shell', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'herbal_antidote', quantity: 1 },
  },
  flower_tonic: {
    id: 'flower_tonic',
    label: 'Blütentonikum',
    category: 'survival',
    craftDurationSeconds: 5,
    ingredients: [
      { itemId: 'wildflower', quantity: 3 },
      { itemId: 'healing_herb', quantity: 1 },
      { itemId: 'coconut_shell', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'flower_tonic', quantity: 1 },
  },
  woven_shirt: {
    id: 'woven_shirt',
    label: 'Gewebtes Schutzhemd',
    category: 'survival',
    craftDurationSeconds: 7,
    ingredients: [
      { itemId: 'cloth', quantity: 3 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'woven_shirt', quantity: 1 },
  },
  backpack: {
    id: 'backpack',
    label: 'Großer Rucksack',
    category: 'survival',
    craftDurationSeconds: 9,
    ingredients: [
      { itemId: 'cloth', quantity: 4 },
      { itemId: 'lashing', quantity: 2 },
      { itemId: 'stick', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'backpack', quantity: 1 },
  },
  hut_foundation: {
    id: 'hut_foundation',
    label: 'Hüttenfundament',
    category: 'building',
    craftDurationSeconds: 8,
    ingredients: [
      { itemId: 'palm_log', quantity: 2 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'hut_foundation', quantity: 1 },
  },
  hut_wall: {
    id: 'hut_wall',
    label: 'Hüttenwand',
    category: 'building',
    craftDurationSeconds: 6,
    ingredients: [
      { itemId: 'palm_frond', quantity: 3 },
    ],
    output: { kind: 'buildable', buildableId: 'hut_wall', quantity: 1 },
  },
  hut_doorway: {
    id: 'hut_doorway',
    label: 'Türrahmen',
    category: 'building',
    craftDurationSeconds: 5,
    ingredients: [
      { itemId: 'stick', quantity: 2 },
    ],
    output: { kind: 'buildable', buildableId: 'hut_doorway', quantity: 1 },
  },
  hut_roof: {
    id: 'hut_roof',
    label: 'Hüttendach',
    category: 'building',
    craftDurationSeconds: 7,
    ingredients: [
      { itemId: 'palm_frond', quantity: 4 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'hut_roof', quantity: 1 },
  },
  raft_base: {
    id: 'raft_base',
    label: 'Floßbasis',
    category: 'raft',
    craftDurationSeconds: 10,
    ingredients: [
      { itemId: 'palm_log', quantity: 4 },
      { itemId: 'lashing', quantity: 2 },
    ],
    output: { kind: 'buildable', buildableId: 'raft_base', quantity: 1 },
  },
  raft_deck: {
    id: 'raft_deck',
    label: 'Floßdeck',
    category: 'raft',
    craftDurationSeconds: 8,
    ingredients: [
      { itemId: 'stick', quantity: 4 },
      { itemId: 'palm_frond', quantity: 2 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'buildable', buildableId: 'raft_deck', quantity: 1 },
  },
  paddle: {
    id: 'paddle',
    label: 'Paddel',
    category: 'raft',
    craftDurationSeconds: 4,
    ingredients: [
      { itemId: 'stick', quantity: 2 },
      { itemId: 'lashing', quantity: 1 },
    ],
    output: { kind: 'item', itemId: 'paddle', quantity: 1 },
  },
} as const satisfies Record<RecipeId, RecipeDefinition>;

export const RECIPE_IDS = Object.freeze(Object.keys(RECIPE_CATALOG) as RecipeId[]);

const WORKBENCH_RECIPE_IDS = new Set<RecipeId>([
  'obsidian_knife',
  'fishing_rod',
  'climbing_kit',
  'shovel',
  'whetstone',
  'chest',
  'palm_still',
  'rain_collector',
  'fish_trap',
  'smoking_rack',
  'woven_shirt',
  'backpack',
  'hut_foundation',
  'hut_wall',
  'hut_doorway',
  'hut_roof',
  'raft_base',
  'raft_deck',
  'paddle',
]);

export function craftingStationFor(recipe: RecipeDefinition): CraftingStation {
  return WORKBENCH_RECIPE_IDS.has(recipe.id) ? 'workbench' : 'hand';
}
