import { ITEM_CATALOG, type ItemAmount, type ItemId } from '../../data/items';
import { getFoodSpoilageDuration } from './foodSpoilage';

export const DEFAULT_INVENTORY_SLOTS = 24;

export interface ItemStack {
  readonly itemId: ItemId;
  readonly quantity: number;
  readonly spoilageSecondsRemaining?: number;
  /** Persisted only when a stack is not in its naturally packed position. */
  readonly slotIndex?: number;
}

export interface AddResult {
  readonly added: number;
  readonly remainder: number;
}

export interface RemoveResult {
  readonly removed: number;
  readonly missing: number;
}

export interface TransferResult {
  readonly transferred: number;
  readonly remainder: number;
}

function assertQuantity(quantity: number, label: string): void {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}

export class Inventory {
  readonly maxSlots: number;

  private slotList: Array<ItemStack | undefined>;

  constructor(
    maxSlots = DEFAULT_INVENTORY_SLOTS,
    initialStacks: readonly ItemStack[] = [],
  ) {
    if (!Number.isSafeInteger(maxSlots) || maxSlots <= 0) {
      throw new RangeError('maxSlots must be a positive safe integer.');
    }
    this.maxSlots = maxSlots;
    this.slotList = Array.from({ length: maxSlots });

    for (const stack of initialStacks) {
      assertQuantity(stack.quantity, 'Stack quantity');
      if (stack.quantity === 0) {
        continue;
      }
      if (stack.slotIndex !== undefined) {
        if (!Number.isSafeInteger(stack.slotIndex) || stack.slotIndex < 0 || stack.slotIndex >= maxSlots) {
          throw new RangeError('Initial stack slot is outside inventory capacity.');
        }
        if (this.slotList[stack.slotIndex]) throw new RangeError('Initial stacks occupy the same inventory slot.');
        if (stack.quantity > ITEM_CATALOG[stack.itemId].stackLimit) throw new RangeError('Initial stack exceeds its item stack limit.');
        const spoilageDuration = getFoodSpoilageDuration(stack.itemId);
        if (stack.spoilageSecondsRemaining !== undefined && (!Number.isFinite(stack.spoilageSecondsRemaining) || stack.spoilageSecondsRemaining < 0)) {
          throw new RangeError('Food freshness must be finite and non-negative.');
        }
        if (spoilageDuration === undefined && stack.spoilageSecondsRemaining !== undefined) {
          throw new RangeError('Only perishable food can have freshness.');
        }
        const freshness = spoilageDuration === undefined
          ? undefined
          : Math.min(spoilageDuration, stack.spoilageSecondsRemaining ?? spoilageDuration);
        this.slotList[stack.slotIndex] = freshness === 0
          ? { itemId: 'spoiled_food', quantity: stack.quantity }
          : {
              itemId: stack.itemId,
              quantity: stack.quantity,
              ...(freshness === undefined ? {} : { spoilageSecondsRemaining: freshness }),
            };
        continue;
      }
      const result = this.add(stack.itemId, stack.quantity, stack.spoilageSecondsRemaining);
      if (result.remainder > 0) {
        throw new RangeError('Initial stacks exceed inventory capacity.');
      }
    }
  }

  get stacks(): readonly ItemStack[] {
    const occupied = this.slotList.flatMap((stack, slotIndex) => stack ? [{ stack, slotIndex }] : []);
    const isPacked = occupied.every(({ slotIndex }, packedIndex) => slotIndex === packedIndex);
    return occupied.map(({ stack, slotIndex }) => ({
      ...stack,
      ...(!isPacked ? { slotIndex } : {}),
    }));
  }

  get slots(): readonly (ItemStack | undefined)[] {
    return this.slotList.map((stack) => stack ? copyStack(stack) : undefined);
  }

  get usedSlots(): number {
    return this.slotList.reduce((total, stack) => total + (stack ? 1 : 0), 0);
  }

  count(itemId: ItemId): number {
    return this.slotList.reduce(
      (total, stack) => total + (stack?.itemId === itemId ? stack.quantity : 0),
      0,
    );
  }

  add(itemId: ItemId, quantity: number, spoilageSecondsRemaining?: number): AddResult {
    assertQuantity(quantity, 'Add quantity');
    const spoilageDuration = getFoodSpoilageDuration(itemId);
    if (spoilageSecondsRemaining !== undefined && (!Number.isFinite(spoilageSecondsRemaining) || spoilageSecondsRemaining < 0)) {
      throw new RangeError('Food freshness must be finite and non-negative.');
    }
    if (spoilageDuration === undefined && spoilageSecondsRemaining !== undefined) {
      throw new RangeError('Only perishable food can have freshness.');
    }
    const freshness = spoilageDuration === undefined
      ? undefined
      : Math.min(spoilageDuration, spoilageSecondsRemaining ?? spoilageDuration);
    if (spoilageDuration !== undefined && freshness === 0) return this.add('spoiled_food', quantity);
    let remainder = quantity;
    const stackLimit = ITEM_CATALOG[itemId].stackLimit;

    for (let index = 0; index < this.slotList.length && remainder > 0; index += 1) {
      const stack = this.slotList[index];
      if (!stack || stack.itemId !== itemId || stack.quantity >= stackLimit || !sameFreshness(stack.spoilageSecondsRemaining, freshness)) {
        continue;
      }
      const amount = Math.min(remainder, stackLimit - stack.quantity);
      this.slotList[index] = { itemId, quantity: stack.quantity + amount, ...(freshness === undefined ? {} : { spoilageSecondsRemaining: freshness }) };
      remainder -= amount;
    }

    while (remainder > 0) {
      const index = this.slotList.findIndex((stack) => !stack);
      if (index < 0) break;
      const amount = Math.min(remainder, stackLimit);
      this.slotList[index] = { itemId, quantity: amount, ...(freshness === undefined ? {} : { spoilageSecondsRemaining: freshness }) };
      remainder -= amount;
    }

    return { added: quantity - remainder, remainder };
  }

  remove(itemId: ItemId, quantity: number): RemoveResult {
    assertQuantity(quantity, 'Remove quantity');
    const removed = this.extract(itemId, quantity).reduce((total, stack) => total + stack.quantity, 0);
    return { removed, missing: quantity - removed };
  }

  extract(itemId: ItemId, quantity: number): ItemStack[] {
    assertQuantity(quantity, 'Extract quantity');
    const extracted: ItemStack[] = [];
    let remaining = quantity;
    for (let index = 0; index < this.slotList.length && remaining > 0; index += 1) {
      const stack = this.slotList[index];
      if (!stack || stack.itemId !== itemId) {
        continue;
      }
      const amount = Math.min(remaining, stack.quantity);
      extracted.push({ itemId, quantity: amount, ...(stack.spoilageSecondsRemaining === undefined ? {} : { spoilageSecondsRemaining: stack.spoilageSecondsRemaining }) });
      remaining -= amount;
      if (amount === stack.quantity) this.slotList[index] = undefined;
      else this.slotList[index] = { ...stack, quantity: stack.quantity - amount };
    }
    return extracted;
  }

  advanceSpoilage(deltaSeconds: number): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError('Spoilage time must be finite and non-negative.');
    if (deltaSeconds === 0) return 0;
    let spoiledCount = 0;
    for (let index = 0; index < this.slotList.length; index += 1) {
      const stack = this.slotList[index];
      if (!stack) continue;
      const duration = getFoodSpoilageDuration(stack.itemId);
      if (duration === undefined) continue;
      const remaining = Math.max(0, (stack.spoilageSecondsRemaining ?? duration) - deltaSeconds);
      if (remaining === 0) {
        spoiledCount += stack.quantity;
        this.slotList[index] = { itemId: 'spoiled_food', quantity: stack.quantity };
      } else this.slotList[index] = { ...stack, spoilageSecondsRemaining: remaining };
    }
    this.mergeCompatibleStacks();
    return spoiledCount;
  }

  canConsume(requirements: readonly ItemAmount[]): boolean {
    const totals = this.aggregateRequirements(requirements);
    return [...totals].every(([itemId, quantity]) => this.count(itemId) >= quantity);
  }

  consume(requirements: readonly ItemAmount[]): boolean {
    const totals = this.aggregateRequirements(requirements);
    if (![...totals].every(([itemId, quantity]) => this.count(itemId) >= quantity)) {
      return false;
    }
    for (const [itemId, quantity] of totals) {
      this.remove(itemId, quantity);
    }
    return true;
  }

  clone(): Inventory {
    return new Inventory(this.maxSlots, this.stacks);
  }

  moveStack(sourceIndex: number, targetIndex: number): boolean {
    if (![sourceIndex, targetIndex].every((index) => Number.isSafeInteger(index) && index >= 0 && index < this.maxSlots)) {
      throw new RangeError('Inventory slot index is outside inventory capacity.');
    }
    if (sourceIndex === targetIndex || !this.slotList[sourceIndex]) return false;
    [this.slotList[sourceIndex], this.slotList[targetIndex]] = [this.slotList[targetIndex], this.slotList[sourceIndex]];
    return true;
  }

  private aggregateRequirements(requirements: readonly ItemAmount[]): Map<ItemId, number> {
    const totals = new Map<ItemId, number>();
    for (const requirement of requirements) {
      assertQuantity(requirement.quantity, 'Requirement quantity');
      if (requirement.quantity === 0) {
        continue;
      }
      totals.set(
        requirement.itemId,
        (totals.get(requirement.itemId) ?? 0) + requirement.quantity,
      );
    }
    return totals;
  }

  private mergeCompatibleStacks(): void {
    for (let targetIndex = 0; targetIndex < this.slotList.length; targetIndex += 1) {
      const target = this.slotList[targetIndex];
      if (!target) continue;
      const limit = ITEM_CATALOG[target.itemId].stackLimit;
      for (let sourceIndex = targetIndex + 1; sourceIndex < this.slotList.length && target.quantity < limit; sourceIndex += 1) {
        const source = this.slotList[sourceIndex];
        const currentTarget = this.slotList[targetIndex];
        if (!source || !currentTarget || source.itemId !== currentTarget.itemId || !sameFreshness(source.spoilageSecondsRemaining, currentTarget.spoilageSecondsRemaining)) continue;
        const amount = Math.min(source.quantity, limit - currentTarget.quantity);
        this.slotList[targetIndex] = { ...currentTarget, quantity: currentTarget.quantity + amount };
        this.slotList[sourceIndex] = amount === source.quantity ? undefined : { ...source, quantity: source.quantity - amount };
      }
    }
  }
}

function copyStack(stack: ItemStack): ItemStack {
  return {
    itemId: stack.itemId,
    quantity: stack.quantity,
    ...(stack.spoilageSecondsRemaining === undefined ? {} : { spoilageSecondsRemaining: stack.spoilageSecondsRemaining }),
  };
}

export function transferItems(
  source: Inventory,
  target: Inventory,
  itemId: ItemId,
  quantity: number,
): TransferResult {
  assertQuantity(quantity, 'Transfer quantity');
  if (quantity === 0 || source === target) {
    return { transferred: 0, remainder: quantity };
  }

  const available = Math.min(quantity, source.count(itemId));
  const extracted = source.extract(itemId, available);
  let transferred = 0;
  for (const stack of extracted) {
    const { added, remainder } = target.add(stack.itemId, stack.quantity, stack.spoilageSecondsRemaining);
    transferred += added;
    if (remainder > 0) {
      const restored = source.add(stack.itemId, remainder, stack.spoilageSecondsRemaining);
      if (restored.remainder > 0) throw new Error('Inventory transfer could not be completed without item loss.');
    }
  }
  return { transferred, remainder: quantity - transferred };
}

function sameFreshness(left: number | undefined, right: number | undefined): boolean {
  return left === undefined && right === undefined || left !== undefined && right !== undefined && Math.abs(left - right) < 0.001;
}
