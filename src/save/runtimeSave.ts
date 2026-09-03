import { CHEST_STORAGE_SLOTS, isBuildableId } from "../data/buildables";
import { getMaxDurability, ITEM_CATALOG, isItemId, type ItemId } from "../data/items";
import { LEGACY_DAY_LENGTH_SECONDS, POISON_DURATION_SECONDS, getFoodSpoilageDuration, type ItemStack, type SurvivalState } from "../gameplay/model";
import type { Vec3Like } from "../core/math";
import type { WorldSaveState } from "../world/TropicalWorld";

export interface DeathPackSave {
  position: Vec3Like;
  inventory: ItemStack[];
}

export interface RuntimeSaveV1 {
  schemaVersion: 1;
  contentVersion: "0.1.0";
  savedAtUnixMs: number;
  day: number;
  playedSeconds: number;
  player: {
    position: Vec3Like;
    yaw: number;
    pitch: number;
    spawnPoint: Vec3Like;
    inventory: ItemStack[];
    survival: SurvivalState;
    toolDurability: Partial<Record<ItemId, number>>;
    equipment?: {
      wovenShirt: boolean;
      backpack: boolean;
    };
    conditions?: {
      brackwaterSicknessSeconds: number;
      poisonSecondsRemaining?: number;
      isBleeding?: boolean;
    };
  };
  world: WorldSaveState;
  deathPacks: DeathPackSave[];
}

type UnknownRecord = Record<string, unknown>;

export function isRuntimeSaveV1(value: unknown): value is RuntimeSaveV1 {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 1 || value.contentVersion !== "0.1.0") return false;
  if (!isNonNegativeInteger(value.savedAtUnixMs) || !isPositiveInteger(value.day) || value.day > 1_000_000) return false;
  if (!isNonNegativeFinite(value.playedSeconds) || value.playedSeconds > 10_000_000_000) return false;
  if (!isPlayer(value.player) || !isWorld(value.world)) return false;
  return isDeathPackSaves(value.deathPacks);
}

function isPlayer(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isVec3(value.position) || !isVec3(value.spawnPoint)) return false;
  if (!isFiniteNumber(value.yaw) || Math.abs(value.yaw) > 1_000_000 || !isFiniteNumber(value.pitch)) return false;
  if (Math.abs(value.pitch) > Math.PI / 2 + 0.01) return false;
  const equipment = value.equipment;
  if (equipment !== undefined && !isEquipment(equipment)) return false;
  if (value.conditions !== undefined && !isConditions(value.conditions)) return false;
  const hasBackpack = isRecord(equipment) && equipment.backpack === true;
  if (!isInventory(value.inventory, hasBackpack ? 36 : 24) || !isSurvival(value.survival)) return false;
  if (hasBackpack && !(value.inventory as UnknownRecord[]).some((stack) => stack.itemId === "backpack")) return false;
  if (isRecord(equipment) && equipment.wovenShirt === true && !(value.inventory as UnknownRecord[]).some((stack) => stack.itemId === "woven_shirt")) return false;
  return isDurabilityRecord(value.toolDurability);
}

function isEquipment(value: unknown): boolean {
  return isRecord(value) && typeof value.wovenShirt === "boolean" && typeof value.backpack === "boolean";
}

function isConditions(value: unknown): boolean {
  return isRecord(value) &&
    isRangeNumber(value.brackwaterSicknessSeconds, 0, 50) &&
    (value.poisonSecondsRemaining === undefined || isRangeNumber(value.poisonSecondsRemaining, 0, POISON_DURATION_SECONDS)) &&
    (value.isBleeding === undefined || typeof value.isBleeding === "boolean");
}

function isWorld(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isStringArray(value.removedEntityIds, 20_000)) return false;
  if (value.removedEntityDays !== undefined && !isRemovedDayRecord(value.removedEntityDays)) return false;
  if (!Array.isArray(value.buildings) || value.buildings.length > 5_000 || !value.buildings.every(isBuilding)) return false;
  if (value.raft !== null && !isRaft(value.raft)) return false;
  if (typeof value.wreckLooted !== "boolean" || typeof value.sharkAlive !== "boolean") return false;
  if (!Array.isArray(value.deathPacks) || value.deathPacks.length > 1_000 || !value.deathPacks.every(isWorldDeathPack)) return false;
  const dynamicDropsValid = value.dynamicDrops === undefined || (
    Array.isArray(value.dynamicDrops) &&
    value.dynamicDrops.length <= 20_000 &&
    value.dynamicDrops.every(isDynamicDrop)
  );
  if (!dynamicDropsValid) return false;
  const ids = [
    ...value.buildings.map((building) => (building as UnknownRecord).id),
    ...value.deathPacks.map((pack) => (pack as UnknownRecord).id),
    ...(Array.isArray(value.dynamicDrops) ? value.dynamicDrops.map((drop) => (drop as UnknownRecord).id) : []),
  ];
  return ids.every(isNonEmptyString) && new Set(ids).size === ids.length;
}

function isBuilding(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isBuildableId(value.type)) return false;
  if (value.type === "raft_base" || value.type === "raft_deck" || !isVec3(value.position)) return false;
  const storedItemsValid = value.storedItems === undefined || (
    value.type === "chest" && isInventory(value.storedItems, CHEST_STORAGE_SLOTS)
  );
  const fishTrapValid = value.type !== "fish_trap" || (
    isRangeNumber(value.fishTrapProgress, 0, 120) &&
    isNonNegativeInteger(value.fishTrapStored) &&
    (value.fishTrapStored as number) <= 3 &&
    typeof value.fishTrapBaited === "boolean"
  );
  const smokingRackValid = value.type !== "smoking_rack" || (
    isRangeNumber(value.smokerProgress, 0, 90) &&
    isNonNegativeInteger(value.smokerInputCount) &&
    (value.smokerInputCount as number) <= 3 &&
    isNonNegativeInteger(value.smokerReadyCount) &&
    (value.smokerReadyCount as number) <= 3 &&
    !((value.smokerInputCount as number) > 0 && (value.smokerReadyCount as number) > 0)
  );
  return storedItemsValid &&
    fishTrapValid &&
    smokingRackValid &&
    isFiniteNumber(value.rotationY) &&
    isRangeNumber(value.waterCharges, 0, value.type === "rain_collector" ? 5 : 3) &&
    isRangeNumber(value.waterProgress, 0, 360) &&
    isNonNegativeFinite(value.fireFuel) &&
    isNonNegativeFinite(value.cookingProgress) &&
    (value.cookingItem === undefined || value.cookingItem === "crab" || value.cookingItem === "raw_meat" || value.cookingItem === "raw_fish");
}

function isRaft(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isVec3(value.position)) return false;
  if (!isRecord(value.rotation)) return false;
  const rotation = value.rotation;
  if (![rotation.x, rotation.y, rotation.z, rotation.w].every(isFiniteNumber)) return false;
  const normSquared = (rotation.x as number) ** 2 + (rotation.y as number) ** 2 + (rotation.z as number) ** 2 + (rotation.w as number) ** 2;
  if (normSquared < 0.8 || normSquared > 1.2) return false;
  return typeof value.hasDeck === "boolean" && isRangeNumber(value.durability, 0, 100);
}

function isWorldDeathPack(value: unknown): boolean {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isVec3(value.position) &&
    isLoot(value.loot);
}

function isDynamicDrop(value: unknown): boolean {
  return isRecord(value) &&
    isNonEmptyString(value.id) &&
    isItemId(value.itemId) &&
    isPositiveInteger(value.count) &&
    value.count <= ITEM_CATALOG[value.itemId].stackLimit * 24 &&
    isVec3(value.position);
}

function isDeathPackSaves(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 1_000 && value.every((pack) => (
    isRecord(pack) && isVec3(pack.position) && isInventory(pack.inventory)
  ));
}

function isInventory(value: unknown, maximumSlots = 24): boolean {
  const occupiedSlots = new Set<number>();
  return Array.isArray(value) && value.length <= maximumSlots && value.every((stack) => {
    if (!isRecord(stack) || !isItemId(stack.itemId) || !isPositiveInteger(stack.quantity)) return false;
    if (stack.slotIndex !== undefined) {
      if (!isNonNegativeInteger(stack.slotIndex) || stack.slotIndex >= maximumSlots || occupiedSlots.has(stack.slotIndex)) return false;
      occupiedSlots.add(stack.slotIndex);
    }
    const spoilageDuration = getFoodSpoilageDuration(stack.itemId);
    const freshnessValid = stack.spoilageSecondsRemaining === undefined || (
      spoilageDuration !== undefined && isRangeNumber(stack.spoilageSecondsRemaining, 0, spoilageDuration)
    );
    return stack.quantity <= ITEM_CATALOG[stack.itemId].stackLimit && freshnessValid;
  });
}

function isLoot(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 24 && value.every((stack) => (
    isRecord(stack) &&
    isItemId(stack.itemId) &&
    isPositiveInteger(stack.count) &&
    stack.count <= ITEM_CATALOG[stack.itemId].stackLimit * 24
  ));
}

function isSurvival(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const maxStamina = value.maxStamina === undefined ? 100 : value.maxStamina;
  const fatigue = value.fatigue === undefined ? 0 : value.fatigue;
  return [value.health, value.hunger, value.thirst, value.stamina, value.oxygen]
    .every((entry) => isRangeNumber(entry, 0, 100)) &&
    isRangeNumber(fatigue, 0, 100) &&
    isRangeNumber(maxStamina, 35, 100) &&
    (value.stamina as number) <= (maxStamina as number) &&
    isRangeNumber(value.staminaRegenDelayRemaining, 0, 1) &&
    isRangeNumber(value.dayElapsedSeconds, 0, LEGACY_DAY_LENGTH_SECONDS, false);
}

function isDurabilityRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([itemId, durability]) => {
    if (!isItemId(itemId)) return false;
    const maximum = getMaxDurability(itemId);
    return maximum !== undefined && isRangeNumber(durability, 0, maximum);
  });
}

function isRemovedDayRecord(value: unknown): boolean {
  if (!isRecord(value) || Object.keys(value).length > 20_000) return false;
  return Object.values(value).every(isPositiveInteger);
}

function isStringArray(value: unknown, maximumLength: number): boolean {
  return Array.isArray(value) && value.length <= maximumLength && value.every(isNonEmptyString);
}

function isVec3(value: unknown): value is Vec3Like {
  if (!isRecord(value)) return false;
  return [value.x, value.y, value.z].every((component) => isFiniteNumber(component) && Math.abs(component) <= 10_000);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isRangeNumber(value: unknown, minimum: number, maximum: number, inclusiveMaximum = true): value is number {
  if (!isFiniteNumber(value) || value < minimum) return false;
  return inclusiveMaximum ? value <= maximum : value < maximum;
}
