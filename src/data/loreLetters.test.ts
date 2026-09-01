import { describe, expect, it } from 'vitest';
import { getLoreLetter, LORE_LETTERS } from './loreLetters';
import { WORLD_MANIFEST } from './worldManifest';

describe('Lore-Briefe', () => {
  it('bildet eine eindeutige, fortlaufende Briefserie über alle Inseln', () => {
    expect(LORE_LETTERS.map(({ sequence }) => sequence)).toEqual(
      Array.from({ length: WORLD_MANIFEST.islands.length }, (_, index) => index + 1),
    );
    expect(new Set(LORE_LETTERS.map(({ id }) => id)).size).toBe(LORE_LETTERS.length);
    expect(LORE_LETTERS.every(({ paragraphs }) => paragraphs.length >= 3)).toBe(true);
    expect([...LORE_LETTERS.map(({ islandId }) => islandId)].sort()).toEqual(
      [...WORLD_MANIFEST.islands.map(({ id }) => id)].sort(),
    );
  });

  it('findet einen Brief anhand seiner Welt-ID', () => {
    expect(getLoreLetter('letter-start-beach')?.title).toBe('Der erste Morgen');
    expect(getLoreLetter('unbekannt')).toBeNull();
  });
});
