import { describe, expect, it } from 'vitest';

import { Inventory, transferItems } from './inventory';
import { DAY_LENGTH_SECONDS } from './survival';

describe('Inventory', () => {
  it('fills existing stacks before allocating another slot', () => {
    const inventory = new Inventory(2);
    expect(inventory.add('stone', 20)).toEqual({ added: 20, remainder: 0 });
    expect(inventory.stacks).toEqual([
      { itemId: 'stone', quantity: 16 },
      { itemId: 'stone', quantity: 4 },
    ]);

    expect(inventory.add('stone', 20)).toEqual({ added: 12, remainder: 8 });
    expect(inventory.stacks).toEqual([
      { itemId: 'stone', quantity: 16 },
      { itemId: 'stone', quantity: 16 },
    ]);
  });

  it('respects non-stackable tools and slot capacity', () => {
    const inventory = new Inventory(1);
    expect(inventory.add('stone_axe', 2)).toEqual({ added: 1, remainder: 1 });
    expect(inventory.usedSlots).toBe(1);
  });

  it('stores each packed workbench in its own inventory slot', () => {
    const inventory = new Inventory(2);
    expect(inventory.add('portable_workbench', 2)).toEqual({ added: 2, remainder: 0 });
    expect(inventory.stacks).toEqual([
      { itemId: 'portable_workbench', quantity: 1 },
      { itemId: 'portable_workbench', quantity: 1 },
    ]);
  });

  it('removes up to the available amount and reports missing quantity', () => {
    const inventory = new Inventory(4, [{ itemId: 'stick', quantity: 7 }]);
    expect(inventory.remove('stick', 4)).toEqual({ removed: 4, missing: 0 });
    expect(inventory.count('stick')).toBe(3);
    expect(inventory.remove('stick', 5)).toEqual({ removed: 3, missing: 2 });
    expect(inventory.usedSlots).toBe(0);
  });

  it('aggregates requirements and consumes atomically', () => {
    const inventory = new Inventory(4, [
      { itemId: 'fiber', quantity: 7 },
      { itemId: 'stone', quantity: 1 },
    ]);
    const duplicateRequirements = [
      { itemId: 'fiber', quantity: 4 },
      { itemId: 'fiber', quantity: 4 },
      { itemId: 'stone', quantity: 1 },
    ] as const;

    expect(inventory.canConsume(duplicateRequirements)).toBe(false);
    expect(inventory.consume(duplicateRequirements)).toBe(false);
    expect(inventory.count('fiber')).toBe(7);
    expect(inventory.count('stone')).toBe(1);

    expect(
      inventory.consume([
        { itemId: 'fiber', quantity: 6 },
        { itemId: 'stone', quantity: 1 },
      ]),
    ).toBe(true);
    expect(inventory.count('fiber')).toBe(1);
    expect(inventory.count('stone')).toBe(0);
  });

  it('clones without sharing mutable stack state', () => {
    const original = new Inventory(4, [{ itemId: 'mango', quantity: 2 }]);
    const clone = original.clone();
    clone.remove('mango', 1);
    expect(original.count('mango')).toBe(2);
    expect(clone.count('mango')).toBe(1);
  });

  it('rejects invalid quantities', () => {
    const inventory = new Inventory();
    expect(() => inventory.add('fiber', -1)).toThrow(RangeError);
    expect(() => inventory.remove('fiber', 1.5)).toThrow(RangeError);
    expect(() => inventory.consume([{ itemId: 'fiber', quantity: Number.NaN }])).toThrow(
      RangeError,
    );
  });

  it('turns raw food into inedible spoiled food after one game day', () => {
    const inventory = new Inventory(4);
    inventory.add('raw_fish', 2);
    expect(inventory.stacks[0]?.spoilageSecondsRemaining).toBe(DAY_LENGTH_SECONDS);

    expect(inventory.advanceSpoilage(DAY_LENGTH_SECONDS - 1)).toBe(0);
    expect(inventory.stacks[0]).toMatchObject({ itemId: 'raw_fish', quantity: 2, spoilageSecondsRemaining: 1 });
    expect(inventory.advanceSpoilage(1)).toBe(2);
    expect(inventory.stacks).toEqual([{ itemId: 'spoiled_food', quantity: 2 }]);
  });

  it('keeps food acquired at different times in separate freshness batches', () => {
    const inventory = new Inventory(4);
    inventory.add('raw_meat', 1);
    inventory.advanceSpoilage(100);
    inventory.add('raw_meat', 1);

    expect(inventory.stacks).toHaveLength(2);
    inventory.advanceSpoilage(DAY_LENGTH_SECONDS - 100);
    expect(inventory.count('spoiled_food')).toBe(1);
    expect(inventory.stacks.find(({ itemId }) => itemId === 'raw_meat')?.spoilageSecondsRemaining).toBe(100);
  });
});

describe('transferItems', () => {
  it('leaves both inventories unchanged when the target is full', () => {
    const source = new Inventory(1, [{ itemId: 'fiber', quantity: 8 }]);
    const target = new Inventory(1, [{ itemId: 'stone', quantity: 16 }]);

    expect(transferItems(source, target, 'fiber', 8)).toEqual({ transferred: 0, remainder: 8 });
    expect(source.stacks).toEqual([{ itemId: 'fiber', quantity: 8 }]);
    expect(target.stacks).toEqual([{ itemId: 'stone', quantity: 16 }]);
  });

  it('moves only the amount that fits into a partially free target', () => {
    const source = new Inventory(1, [{ itemId: 'fiber', quantity: 10 }]);
    const target = new Inventory(1, [{ itemId: 'fiber', quantity: 60 }]);

    expect(transferItems(source, target, 'fiber', 10)).toEqual({ transferred: 4, remainder: 6 });
    expect(source.stacks).toEqual([{ itemId: 'fiber', quantity: 6 }]);
    expect(target.stacks).toEqual([{ itemId: 'fiber', quantity: 64 }]);
  });

  it('preserves the total item quantity when the source contains less than requested', () => {
    const source = new Inventory(2, [{ itemId: 'stick', quantity: 3 }]);
    const target = new Inventory(2, [{ itemId: 'stick', quantity: 2 }]);
    const totalBefore = source.count('stick') + target.count('stick');

    expect(transferItems(source, target, 'stick', 8)).toEqual({ transferred: 3, remainder: 5 });
    expect(source.count('stick')).toBe(0);
    expect(target.count('stick')).toBe(5);
    expect(source.count('stick') + target.count('stick')).toBe(totalBefore);
  });

  it('preserves remaining freshness while moving food into storage', () => {
    const source = new Inventory(2, [{ itemId: 'cooked_fish', quantity: 2, spoilageSecondsRemaining: 75 }]);
    const target = new Inventory(2);
    expect(transferItems(source, target, 'cooked_fish', 2)).toEqual({ transferred: 2, remainder: 0 });
    expect(target.stacks).toEqual([{ itemId: 'cooked_fish', quantity: 2, spoilageSecondsRemaining: 75 }]);
  });
});
