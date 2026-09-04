import { getLoreLetter, type LoreLetterId } from '../../data/loreLetters';
import { isItemId, type ItemId } from '../../data/items';
import { isIslandId, type IslandId } from '../../data/worldManifest';

export const NOTEBOOK_RESOURCE_IDS = [
  'fiber',
  'stick',
  'stone',
  'palm_frond',
  'palm_log',
  'coconut',
  'crab',
  'raw_meat',
  'raw_fish',
  'mango',
  'healing_herb',
  'obsidian_shard',
  'reef_stone',
  'wildflower',
] as const satisfies readonly ItemId[];

export type NotebookResourceId = (typeof NOTEBOOK_RESOURCE_IDS)[number];

export const NOTEBOOK_ANIMAL_IDS = [
  'crab',
  'fish',
  'wild_boar',
  'chicken',
  'turtle',
  'bird',
  'crocodile',
  'snake',
  'shark',
] as const;

export type NotebookAnimalId = (typeof NOTEBOOK_ANIMAL_IDS)[number];

export interface NotebookIslandSave {
  islandId: IslandId;
  visitedDay: number;
  resourceIds: NotebookResourceId[];
  animalIds: NotebookAnimalId[];
}

export interface NotebookSave {
  discoveredLetterIds: LoreLetterId[];
  islands: NotebookIslandSave[];
}

export function isNotebookResourceId(value: unknown): value is NotebookResourceId {
  return isItemId(value) && NOTEBOOK_RESOURCE_IDS.some((id) => id === value);
}

export function isNotebookAnimalId(value: unknown): value is NotebookAnimalId {
  return typeof value === 'string' && NOTEBOOK_ANIMAL_IDS.some((id) => id === value);
}

export function isNotebookSave(value: unknown): value is NotebookSave {
  if (!isRecord(value) || !Array.isArray(value.discoveredLetterIds) || !Array.isArray(value.islands)) return false;
  if (value.discoveredLetterIds.length > 100 || value.islands.length > 100) return false;
  if (!value.discoveredLetterIds.every((id) => typeof id === 'string' && getLoreLetter(id))) return false;
  if (new Set(value.discoveredLetterIds).size !== value.discoveredLetterIds.length) return false;
  if (!value.islands.every(isNotebookIslandSave)) return false;
  return new Set(value.islands.map((entry) => entry.islandId)).size === value.islands.length;
}

export class ExpeditionNotebook {
  private readonly letters = new Set<LoreLetterId>();
  private readonly islands = new Map<IslandId, {
    visitedDay: number;
    resources: Set<NotebookResourceId>;
    animals: Set<NotebookAnimalId>;
  }>();

  constructor(save?: NotebookSave) {
    if (!save) return;
    for (const letterId of save.discoveredLetterIds) this.letters.add(letterId);
    for (const island of save.islands) {
      this.islands.set(island.islandId, {
        visitedDay: island.visitedDay,
        resources: new Set(island.resourceIds),
        animals: new Set(island.animalIds),
      });
    }
  }

  visitIsland(islandId: IslandId, day: number): boolean {
    if (this.islands.has(islandId)) return false;
    this.islands.set(islandId, {
      visitedDay: Math.max(1, Math.floor(day)),
      resources: new Set(),
      animals: new Set(),
    });
    return true;
  }

  discoverLetter(letterId: string): boolean {
    const letter = getLoreLetter(letterId);
    if (!letter || this.letters.has(letter.id as LoreLetterId)) return false;
    this.letters.add(letter.id as LoreLetterId);
    return true;
  }

  discoverResource(islandId: IslandId, itemId: ItemId, day: number): boolean {
    if (!isNotebookResourceId(itemId)) return false;
    this.visitIsland(islandId, day);
    const resources = this.islands.get(islandId)?.resources;
    if (!resources || resources.has(itemId)) return false;
    resources.add(itemId);
    return true;
  }

  discoverAnimal(islandId: IslandId, animalId: NotebookAnimalId, day: number): boolean {
    this.visitIsland(islandId, day);
    const animals = this.islands.get(islandId)?.animals;
    if (!animals || animals.has(animalId)) return false;
    animals.add(animalId);
    return true;
  }

  serialize(): NotebookSave {
    return {
      discoveredLetterIds: [...this.letters],
      islands: [...this.islands].map(([islandId, entry]) => ({
        islandId,
        visitedDay: entry.visitedDay,
        resourceIds: [...entry.resources],
        animalIds: [...entry.animals],
      })),
    };
  }
}

function isNotebookIslandSave(value: unknown): value is NotebookIslandSave {
  if (!isRecord(value) || !isIslandId(value.islandId)) return false;
  if (!Number.isSafeInteger(value.visitedDay) || (value.visitedDay as number) < 1 || (value.visitedDay as number) > 1_000_000) return false;
  if (!Array.isArray(value.resourceIds) || value.resourceIds.length > NOTEBOOK_RESOURCE_IDS.length) return false;
  if (!value.resourceIds.every(isNotebookResourceId) || new Set(value.resourceIds).size !== value.resourceIds.length) return false;
  if (!Array.isArray(value.animalIds) || value.animalIds.length > NOTEBOOK_ANIMAL_IDS.length) return false;
  return value.animalIds.every(isNotebookAnimalId) && new Set(value.animalIds).size === value.animalIds.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
