export type BuildableCategory = 'survival' | 'crafting' | 'building' | 'raft';

export type BuildablePlacement = 'ground' | 'foundation' | 'foundation-edge' | 'foundation-top' | 'shallow-water' | 'raft-base';

export type BuildableId =
  | 'campfire'
  | 'shelter'
  | 'bed'
  | 'chest'
  | 'workbench'
  | 'palm_still'
  | 'rain_collector'
  | 'fish_trap'
  | 'smoking_rack'
  | 'hut_foundation'
  | 'hut_wall'
  | 'hut_doorway'
  | 'hut_roof'
  | 'raft_base'
  | 'raft_deck';

export interface BuildableDefinition {
  readonly id: BuildableId;
  readonly label: string;
  readonly category: BuildableCategory;
  readonly placement: BuildablePlacement;
  readonly isRaftPart: boolean;
}

export const BUILDABLE_CATALOG = {
  campfire: {
    id: 'campfire',
    label: 'Lagerfeuer',
    category: 'survival',
    placement: 'ground',
    isRaftPart: false,
  },
  shelter: {
    id: 'shelter',
    label: 'Schutzdach',
    category: 'survival',
    placement: 'ground',
    isRaftPart: false,
  },
  bed: {
    id: 'bed',
    label: 'Bett',
    category: 'survival',
    placement: 'ground',
    isRaftPart: false,
  },
  chest: {
    id: 'chest',
    label: 'Truhe',
    category: 'survival',
    placement: 'ground',
    isRaftPart: false,
  },
  workbench: {
    id: 'workbench',
    label: 'Werkbank',
    category: 'crafting',
    placement: 'ground',
    isRaftPart: false,
  },
  palm_still: {
    id: 'palm_still',
    label: 'Palm-Destille',
    category: 'survival',
    placement: 'ground',
    isRaftPart: false,
  },
  rain_collector: {
    id: 'rain_collector',
    label: 'Regenfänger',
    category: 'survival',
    placement: 'ground',
    isRaftPart: false,
  },
  fish_trap: {
    id: 'fish_trap',
    label: 'Fischreuse',
    category: 'survival',
    placement: 'shallow-water',
    isRaftPart: false,
  },
  smoking_rack: {
    id: 'smoking_rack',
    label: 'Räuchergestell',
    category: 'survival',
    placement: 'ground',
    isRaftPart: false,
  },
  hut_foundation: {
    id: 'hut_foundation',
    label: 'Hüttenfundament',
    category: 'building',
    placement: 'foundation',
    isRaftPart: false,
  },
  hut_wall: {
    id: 'hut_wall',
    label: 'Hüttenwand',
    category: 'building',
    placement: 'foundation-edge',
    isRaftPart: false,
  },
  hut_doorway: {
    id: 'hut_doorway',
    label: 'Türrahmen',
    category: 'building',
    placement: 'foundation-edge',
    isRaftPart: false,
  },
  hut_roof: {
    id: 'hut_roof',
    label: 'Hüttendach',
    category: 'building',
    placement: 'foundation-top',
    isRaftPart: false,
  },
  raft_base: {
    id: 'raft_base',
    label: 'Floßbasis',
    category: 'raft',
    placement: 'shallow-water',
    isRaftPart: true,
  },
  raft_deck: {
    id: 'raft_deck',
    label: 'Floßdeck',
    category: 'raft',
    placement: 'raft-base',
    isRaftPart: true,
  },
} as const satisfies Record<BuildableId, BuildableDefinition>;

export const CHEST_STORAGE_SLOTS = 16;

export const BUILDABLE_IDS = Object.freeze(Object.keys(BUILDABLE_CATALOG) as BuildableId[]);

export function isBuildableId(value: unknown): value is BuildableId {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(BUILDABLE_CATALOG, value)
  );
}
