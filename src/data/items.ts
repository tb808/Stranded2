export type ItemCategory = 'material' | 'component' | 'food' | 'medical' | 'tool' | 'equipment';

export type ItemId =
  | 'fiber'
  | 'stick'
  | 'stone'
  | 'palm_frond'
  | 'palm_log'
  | 'coconut'
  | 'coconut_shell'
  | 'crab'
  | 'cooked_crab'
  | 'raw_meat'
  | 'cooked_meat'
  | 'smoked_meat'
  | 'raw_fish'
  | 'cooked_fish'
  | 'spoiled_food'
  | 'bait'
  | 'cloth'
  | 'metal_scrap'
  | 'obsidian_shard'
  | 'reef_stone'
  | 'wildflower'
  | 'mango'
  | 'healing_herb'
  | 'bandage'
  | 'simple_bandage'
  | 'herbal_antidote'
  | 'flower_tonic'
  | 'whetstone'
  | 'lashing'
  | 'portable_workbench'
  | 'woven_shirt'
  | 'backpack'
  | 'stone_knife'
  | 'obsidian_knife'
  | 'stone_axe'
  | 'wooden_spear'
  | 'building_hammer'
  | 'fishing_rod'
  | 'climbing_kit'
  | 'paddle'
  | 'shovel_blueprint'
  | 'shovel'
  | 'giant_island_map';

export interface ItemAmount {
  readonly itemId: ItemId;
  readonly quantity: number;
}

export interface ItemDefinition {
  readonly id: ItemId;
  readonly label: string;
  readonly category: ItemCategory;
  readonly stackLimit: number;
  readonly maxDurability?: number;
  readonly useByproduct?: ItemAmount;
}

export const ITEM_CATALOG = {
  fiber: {
    id: 'fiber',
    label: 'Faser',
    category: 'material',
    stackLimit: 64,
  },
  stick: {
    id: 'stick',
    label: 'Stock',
    category: 'material',
    stackLimit: 32,
  },
  stone: {
    id: 'stone',
    label: 'Stein',
    category: 'material',
    stackLimit: 16,
  },
  palm_frond: {
    id: 'palm_frond',
    label: 'Palmwedel',
    category: 'material',
    stackLimit: 32,
  },
  palm_log: {
    id: 'palm_log',
    label: 'Stamm',
    category: 'material',
    stackLimit: 8,
  },
  coconut: {
    id: 'coconut',
    label: 'Kokosnuss',
    category: 'food',
    stackLimit: 8,
    useByproduct: { itemId: 'coconut_shell', quantity: 2 },
  },
  coconut_shell: {
    id: 'coconut_shell',
    label: 'Kokosschale',
    category: 'material',
    stackLimit: 8,
  },
  crab: {
    id: 'crab',
    label: 'Krabbe',
    category: 'food',
    stackLimit: 8,
  },
  cooked_crab: {
    id: 'cooked_crab',
    label: 'Gekochte Krabbe',
    category: 'food',
    stackLimit: 8,
  },
  raw_meat: {
    id: 'raw_meat',
    label: 'Rohes Fleisch',
    category: 'food',
    stackLimit: 8,
  },
  cooked_meat: {
    id: 'cooked_meat',
    label: 'Gegrilltes Fleisch',
    category: 'food',
    stackLimit: 8,
  },
  smoked_meat: {
    id: 'smoked_meat',
    label: 'Räucherfleisch',
    category: 'food',
    stackLimit: 12,
  },
  raw_fish: {
    id: 'raw_fish',
    label: 'Roher Fisch',
    category: 'food',
    stackLimit: 8,
  },
  cooked_fish: {
    id: 'cooked_fish',
    label: 'Gegrillter Fisch',
    category: 'food',
    stackLimit: 8,
  },
  spoiled_food: {
    id: 'spoiled_food',
    label: 'Verdorbene Nahrung',
    category: 'food',
    stackLimit: 16,
  },
  bait: {
    id: 'bait',
    label: 'Fischköder',
    category: 'component',
    stackLimit: 16,
  },
  cloth: {
    id: 'cloth',
    label: 'Stoff',
    category: 'material',
    stackLimit: 16,
  },
  metal_scrap: {
    id: 'metal_scrap',
    label: 'Metallschrott',
    category: 'material',
    stackLimit: 16,
  },
  obsidian_shard: {
    id: 'obsidian_shard',
    label: 'Obsidianscherbe',
    category: 'material',
    stackLimit: 16,
  },
  reef_stone: {
    id: 'reef_stone',
    label: 'Riffkiesel',
    category: 'material',
    stackLimit: 16,
  },
  wildflower: {
    id: 'wildflower',
    label: 'Duftblüte',
    category: 'material',
    stackLimit: 24,
  },
  mango: {
    id: 'mango',
    label: 'Mango',
    category: 'food',
    stackLimit: 8,
  },
  healing_herb: {
    id: 'healing_herb',
    label: 'Mangroven-Heilkraut',
    category: 'material',
    stackLimit: 16,
  },
  bandage: {
    id: 'bandage',
    label: 'Kräuterverband',
    category: 'medical',
    stackLimit: 8,
  },
  simple_bandage: {
    id: 'simple_bandage',
    label: 'Einfacher Verband',
    category: 'medical',
    stackLimit: 12,
  },
  herbal_antidote: {
    id: 'herbal_antidote',
    label: 'Pflanzliches Gegengift',
    category: 'medical',
    stackLimit: 8,
  },
  flower_tonic: {
    id: 'flower_tonic',
    label: 'Blütentonikum',
    category: 'medical',
    stackLimit: 8,
  },
  whetstone: {
    id: 'whetstone',
    label: 'Riff-Wetzstein',
    category: 'component',
    stackLimit: 8,
  },
  lashing: {
    id: 'lashing',
    label: 'Seilbindung',
    category: 'component',
    stackLimit: 16,
  },
  portable_workbench: {
    id: 'portable_workbench',
    label: 'Verpackte Werkbank',
    category: 'component',
    stackLimit: 1,
  },
  woven_shirt: {
    id: 'woven_shirt',
    label: 'Gewebtes Schutzhemd',
    category: 'equipment',
    stackLimit: 1,
  },
  backpack: {
    id: 'backpack',
    label: 'Großer Rucksack',
    category: 'equipment',
    stackLimit: 1,
  },
  stone_knife: {
    id: 'stone_knife',
    label: 'Steinmesser',
    category: 'tool',
    stackLimit: 1,
    maxDurability: 60,
  },
  obsidian_knife: {
    id: 'obsidian_knife',
    label: 'Obsidianmesser',
    category: 'tool',
    stackLimit: 1,
    maxDurability: 100,
  },
  stone_axe: {
    id: 'stone_axe',
    label: 'Steinaxt',
    category: 'tool',
    stackLimit: 1,
    maxDurability: 80,
  },
  wooden_spear: {
    id: 'wooden_spear',
    label: 'Holzspeer',
    category: 'tool',
    stackLimit: 1,
    maxDurability: 30,
  },
  building_hammer: {
    id: 'building_hammer',
    label: 'Bauhammer',
    category: 'tool',
    stackLimit: 1,
    maxDurability: 100,
  },
  fishing_rod: {
    id: 'fishing_rod',
    label: 'Angel',
    category: 'tool',
    stackLimit: 1,
    maxDurability: 80,
  },
  climbing_kit: {
    id: 'climbing_kit',
    label: 'Kletterset',
    category: 'tool',
    stackLimit: 1,
    maxDurability: 12,
  },
  paddle: {
    id: 'paddle',
    label: 'Paddel',
    category: 'tool',
    stackLimit: 1,
    maxDurability: 100,
  },
  shovel_blueprint: {
    id: 'shovel_blueprint',
    label: 'Schaufel-Bauplan',
    category: 'component',
    stackLimit: 1,
  },
  shovel: {
    id: 'shovel',
    label: 'Improvisierte Schaufel',
    category: 'tool',
    stackLimit: 1,
    maxDurability: 70,
  },
  giant_island_map: {
    id: 'giant_island_map',
    label: 'Karte der Rieseninsel',
    category: 'component',
    stackLimit: 1,
  },
} as const satisfies Record<ItemId, ItemDefinition>;

export const ITEM_IDS = Object.freeze(Object.keys(ITEM_CATALOG) as ItemId[]);

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ITEM_CATALOG, value);
}

export function getMaxDurability(itemId: ItemId): number | undefined {
  return (ITEM_CATALOG[itemId] as ItemDefinition).maxDurability;
}
