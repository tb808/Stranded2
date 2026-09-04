import { describe, expect, it } from 'vitest';

import { ExpeditionNotebook, isNotebookSave } from './notebook';

describe('ExpeditionNotebook', () => {
  it('protokolliert Besuche, Briefe, Rohstoffe und Tiere nur einmal', () => {
    const notebook = new ExpeditionNotebook();

    expect(notebook.visitIsland('kleine-sandbank', 1)).toBe(true);
    expect(notebook.visitIsland('kleine-sandbank', 4)).toBe(false);
    expect(notebook.discoverLetter('letter-start-beach')).toBe(true);
    expect(notebook.discoverLetter('letter-start-beach')).toBe(false);
    expect(notebook.discoverResource('kleine-sandbank', 'coconut', 1)).toBe(true);
    expect(notebook.discoverResource('kleine-sandbank', 'coconut', 1)).toBe(false);
    expect(notebook.discoverAnimal('kleine-sandbank', 'crab', 1)).toBe(true);
    expect(notebook.discoverAnimal('kleine-sandbank', 'crab', 1)).toBe(false);

    expect(notebook.serialize()).toEqual({
      discoveredLetterIds: ['letter-start-beach'],
      islands: [{
        islandId: 'kleine-sandbank',
        visitedDay: 1,
        resourceIds: ['coconut'],
        animalIds: ['crab'],
      }],
    });
  });

  it('legt bei einer Entdeckung automatisch einen Insel-Eintrag an und ignoriert hergestellte Dinge', () => {
    const notebook = new ExpeditionNotebook();

    expect(notebook.discoverResource('vulkaninsel', 'obsidian_shard', 8)).toBe(true);
    expect(notebook.discoverResource('vulkaninsel', 'stone_axe', 8)).toBe(false);
    expect(notebook.serialize().islands).toEqual([{
      islandId: 'vulkaninsel',
      visitedDay: 8,
      resourceIds: ['obsidian_shard'],
      animalIds: [],
    }]);
  });

  it('lässt sich ohne geteilte mutable Zustände aus dem Spielstand wiederherstellen', () => {
    const saved = {
      discoveredLetterIds: ['letter-fisher-camp'],
      islands: [{
        islandId: 'palmenlagune',
        visitedDay: 3,
        resourceIds: ['raw_fish'],
        animalIds: ['fish'],
      }],
    } as const;
    expect(isNotebookSave(saved)).toBe(true);

    const restored = new ExpeditionNotebook(saved as never);
    restored.discoverAnimal('palmenlagune', 'turtle', 4);
    expect(saved.islands[0].animalIds).toEqual(['fish']);
    expect(restored.serialize().islands[0]?.animalIds).toEqual(['fish', 'turtle']);
  });

  it('weist unbekannte und doppelte gespeicherte Entdeckungen zurück', () => {
    expect(isNotebookSave({ discoveredLetterIds: ['missing-letter'], islands: [] })).toBe(false);
    expect(isNotebookSave({
      discoveredLetterIds: [],
      islands: [{
        islandId: 'kleine-sandbank',
        visitedDay: 1,
        resourceIds: ['fiber', 'fiber'],
        animalIds: [],
      }],
    })).toBe(false);
  });
});
