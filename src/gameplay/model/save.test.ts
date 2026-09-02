import { describe, expect, it } from 'vitest';

import {
  migrateGameSave,
  validateGameSaveV1,
  type GameSaveV0,
  type GameSaveV1,
} from './save';
import { createInitialSurvivalState } from './survival';

function currentSave(): GameSaveV1 {
  return {
    saveVersion: 1,
    savedAtUnixMs: 1_700_000_000_000,
    world: {
      seed: 'test-seed',
      currentIslandId: 'kleine-sandbank',
      depletedResourceIds: ['stick-01'],
    },
    player: {
      position: [1, 2, 3],
      yaw: 0.5,
      inventory: [
        { itemId: 'stick', quantity: 3 },
        { itemId: 'cooked_crab', quantity: 1 },
      ],
      survival: createInitialSurvivalState(),
    },
    placedBuildables: [
      {
        instanceId: 'campfire-01',
        buildableId: 'campfire',
        position: [4, 5, 6],
        yaw: 1,
      },
    ],
    raft: {
      instanceId: 'raft-01',
      position: [7, 0, 8],
      yaw: 2,
      hasBase: true,
      hasDeck: true,
    },
  };
}

describe('save validation and migration', () => {
  it('validates and defensively reconstructs a current save', () => {
    const source = currentSave();
    const result = validateGameSaveV1(source);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.errors.join('\n'));
    }
    expect(result.value).toEqual(source);
    expect(result.value).not.toBe(source);
    expect(result.value.player.inventory).not.toBe(source.player.inventory);
  });

  it('rejects unknown items, oversized stacks, and impossible raft composition', () => {
    const invalid = {
      ...currentSave(),
      player: {
        ...currentSave().player,
        inventory: [
          { itemId: 'unknown', quantity: 1 },
          { itemId: 'stone_axe', quantity: 2 },
        ],
      },
      raft: {
        ...currentSave().raft,
        hasBase: false,
        hasDeck: true,
      },
    };
    const result = validateGameSaveV1(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected invalid save.');
    }
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'save.player.inventory[0].itemId is unknown.',
        'save.player.inventory[1].quantity exceeds its item stack limit.',
        'save.raft cannot have a deck without a base.',
      ]),
    );
  });

  it('purely migrates the legacy V0 shape to V1 defaults', () => {
    const legacy: GameSaveV0 = {
      saveVersion: 0,
      savedAtUnixMs: 1_600_000_000_000,
      seed: 'legacy-seed',
      currentIslandId: 'dschungelbucht',
      playerPosition: [10, 2, -4],
      playerYaw: 0.25,
      inventory: [{ itemId: 'paddle', quantity: 1 }],
      vitals: {
        health: 95,
        hunger: 60,
        thirst: 55,
        stamina: 80,
        oxygen: 100,
      },
      dayElapsedSeconds: 900,
    };
    const before = JSON.stringify(legacy);
    const result = migrateGameSave(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.errors.join('\n'));
    }
    expect(result.migratedFrom).toBe(0);
    expect(result.value).toMatchObject({
      saveVersion: 1,
      world: {
        seed: 'legacy-seed',
        currentIslandId: 'dschungelbucht',
        depletedResourceIds: [],
      },
      player: {
        position: [10, 2, -4],
        yaw: 0.25,
        survival: {
          health: 95,
          hunger: 60,
          thirst: 55,
          stamina: 80,
          oxygen: 100,
          staminaRegenDelayRemaining: 0,
          dayElapsedSeconds: 300,
        },
      },
      placedBuildables: [],
      raft: null,
    });
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it('rejects corrupt and future save versions without mutating input', () => {
    expect(migrateGameSave(null)).toEqual({ ok: false, errors: ['save must be an object.'] });
    const future = { ...currentSave(), saveVersion: 2 };
    const before = JSON.stringify(future);
    const result = migrateGameSave(future);
    expect(result).toEqual({ ok: false, errors: ['Unsupported saveVersion: 2.'] });
    expect(JSON.stringify(future)).toBe(before);
  });
});
