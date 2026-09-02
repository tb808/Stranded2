import { isBuildableId, type BuildableId } from '../../data/buildables';
import { ITEM_CATALOG, isItemId } from '../../data/items';
import { isIslandId, type IslandId } from '../../data/worldManifest';
import type { ItemStack } from './inventory';
import { DAY_LENGTH_SECONDS, LEGACY_DAY_LENGTH_SECONDS, type SurvivalState, type SurvivalVitals } from './survival';

export const CURRENT_SAVE_VERSION = 1 as const;

export type Vec3 = readonly [number, number, number];

export interface SavedWorldV1 {
  readonly seed: string;
  readonly currentIslandId: IslandId;
  readonly depletedResourceIds: readonly string[];
}

export interface SavedPlayerV1 {
  readonly position: Vec3;
  readonly yaw: number;
  readonly inventory: readonly ItemStack[];
  readonly survival: SurvivalState;
}

export interface SavedBuildableV1 {
  readonly instanceId: string;
  readonly buildableId: BuildableId;
  readonly position: Vec3;
  readonly yaw: number;
}

export interface SavedRaftV1 {
  readonly instanceId: string;
  readonly position: Vec3;
  readonly yaw: number;
  readonly hasBase: boolean;
  readonly hasDeck: boolean;
}

export interface GameSaveV1 {
  readonly saveVersion: 1;
  readonly savedAtUnixMs: number;
  readonly world: SavedWorldV1;
  readonly player: SavedPlayerV1;
  readonly placedBuildables: readonly SavedBuildableV1[];
  readonly raft: SavedRaftV1 | null;
}

export interface GameSaveV0 {
  readonly saveVersion: 0;
  readonly savedAtUnixMs: number;
  readonly seed: string;
  readonly currentIslandId: IslandId;
  readonly playerPosition: Vec3;
  readonly playerYaw: number;
  readonly inventory: readonly ItemStack[];
  readonly vitals: SurvivalVitals;
  readonly dayElapsedSeconds: number;
}

export type SaveValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] };

export type SaveMigrationResult =
  | {
      readonly ok: true;
      readonly value: GameSaveV1;
      readonly migratedFrom: 0 | 1;
    }
  | { readonly ok: false; readonly errors: readonly string[] };

type UnknownRecord = Record<string, unknown>;

export function validateGameSaveV1(input: unknown): SaveValidationResult<GameSaveV1> {
  const errors: string[] = [];
  const save = readRecord(input, 'save', errors);
  if (!save) {
    return { ok: false, errors };
  }

  if (save.saveVersion !== CURRENT_SAVE_VERSION) {
    errors.push(`save.saveVersion must be ${CURRENT_SAVE_VERSION}.`);
  }
  const savedAtUnixMs = readNonNegativeInteger(save.savedAtUnixMs, 'save.savedAtUnixMs', errors);
  const world = parseWorld(save.world, errors);
  const player = parsePlayer(save.player, errors);
  const placedBuildables = parseBuildables(save.placedBuildables, errors);
  const raft = parseRaft(save.raft, errors);

  if (
    errors.length > 0 ||
    savedAtUnixMs === undefined ||
    !world ||
    !player ||
    !placedBuildables ||
    raft === undefined
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      saveVersion: CURRENT_SAVE_VERSION,
      savedAtUnixMs,
      world,
      player,
      placedBuildables,
      raft,
    },
  };
}

export function migrateGameSave(input: unknown): SaveMigrationResult {
  const record = isRecord(input) ? input : undefined;
  if (!record) {
    return { ok: false, errors: ['save must be an object.'] };
  }

  if (record.saveVersion === CURRENT_SAVE_VERSION) {
    const validated = validateGameSaveV1(input);
    return validated.ok
      ? { ok: true, value: validated.value, migratedFrom: 1 }
      : validated;
  }

  if (record.saveVersion !== 0) {
    return {
      ok: false,
      errors: [`Unsupported saveVersion: ${String(record.saveVersion)}.`],
    };
  }

  const legacy = validateGameSaveV0(input);
  if (!legacy.ok) {
    return legacy;
  }

  const migrated: GameSaveV1 = {
    saveVersion: CURRENT_SAVE_VERSION,
    savedAtUnixMs: legacy.value.savedAtUnixMs,
    world: {
      seed: legacy.value.seed,
      currentIslandId: legacy.value.currentIslandId,
      depletedResourceIds: [],
    },
    player: {
      position: legacy.value.playerPosition,
      yaw: legacy.value.playerYaw,
      inventory: legacy.value.inventory,
      survival: {
        ...legacy.value.vitals,
        maxStamina: 100,
        fatigue: 0,
        staminaRegenDelayRemaining: 0,
        dayElapsedSeconds: legacy.value.dayElapsedSeconds % DAY_LENGTH_SECONDS,
      },
    },
    placedBuildables: [],
    raft: null,
  };

  const validated = validateGameSaveV1(migrated);
  return validated.ok
    ? { ok: true, value: validated.value, migratedFrom: 0 }
    : validated;
}

function validateGameSaveV0(input: unknown): SaveValidationResult<GameSaveV0> {
  const errors: string[] = [];
  const save = readRecord(input, 'save', errors);
  if (!save) {
    return { ok: false, errors };
  }
  if (save.saveVersion !== 0) {
    errors.push('save.saveVersion must be 0.');
  }
  const savedAtUnixMs = readNonNegativeInteger(save.savedAtUnixMs, 'save.savedAtUnixMs', errors);
  const seed = readNonEmptyString(save.seed, 'save.seed', errors);
  const currentIslandId = readIslandId(save.currentIslandId, 'save.currentIslandId', errors);
  const playerPosition = readVec3(save.playerPosition, 'save.playerPosition', errors);
  const playerYaw = readFiniteNumber(save.playerYaw, 'save.playerYaw', errors);
  const inventory = parseInventory(save.inventory, 'save.inventory', errors);
  const vitals = parseVitals(save.vitals, 'save.vitals', errors);
  const dayElapsedSeconds = readRangeNumber(
    save.dayElapsedSeconds,
    0,
    LEGACY_DAY_LENGTH_SECONDS,
    'save.dayElapsedSeconds',
    errors,
    false,
  );

  if (
    errors.length > 0 ||
    savedAtUnixMs === undefined ||
    seed === undefined ||
    !currentIslandId ||
    !playerPosition ||
    playerYaw === undefined ||
    !inventory ||
    !vitals ||
    dayElapsedSeconds === undefined
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      saveVersion: 0,
      savedAtUnixMs,
      seed,
      currentIslandId,
      playerPosition,
      playerYaw,
      inventory,
      vitals,
      dayElapsedSeconds,
    },
  };
}

function parseWorld(value: unknown, errors: string[]): SavedWorldV1 | undefined {
  const world = readRecord(value, 'save.world', errors);
  if (!world) {
    return undefined;
  }
  const seed = readNonEmptyString(world.seed, 'save.world.seed', errors);
  const currentIslandId = readIslandId(
    world.currentIslandId,
    'save.world.currentIslandId',
    errors,
  );
  const depletedResourceIds = readStringArray(
    world.depletedResourceIds,
    'save.world.depletedResourceIds',
    errors,
  );
  return seed !== undefined && currentIslandId && depletedResourceIds
    ? { seed, currentIslandId, depletedResourceIds }
    : undefined;
}

function parsePlayer(value: unknown, errors: string[]): SavedPlayerV1 | undefined {
  const player = readRecord(value, 'save.player', errors);
  if (!player) {
    return undefined;
  }
  const position = readVec3(player.position, 'save.player.position', errors);
  const yaw = readFiniteNumber(player.yaw, 'save.player.yaw', errors);
  const inventory = parseInventory(player.inventory, 'save.player.inventory', errors);
  const survival = parseSurvival(player.survival, 'save.player.survival', errors);
  return position && yaw !== undefined && inventory && survival
    ? { position, yaw, inventory, survival }
    : undefined;
}

function parseBuildables(value: unknown, errors: string[]): SavedBuildableV1[] | undefined {
  if (!Array.isArray(value)) {
    errors.push('save.placedBuildables must be an array.');
    return undefined;
  }
  const buildables: SavedBuildableV1[] = [];
  value.forEach((candidate, index) => {
    const path = `save.placedBuildables[${index}]`;
    const record = readRecord(candidate, path, errors);
    if (!record) {
      return;
    }
    const instanceId = readNonEmptyString(record.instanceId, `${path}.instanceId`, errors);
    const buildableId = isBuildableId(record.buildableId)
      ? record.buildableId
      : undefined;
    if (!buildableId) {
      errors.push(`${path}.buildableId is unknown.`);
    }
    const position = readVec3(record.position, `${path}.position`, errors);
    const yaw = readFiniteNumber(record.yaw, `${path}.yaw`, errors);
    if (instanceId !== undefined && buildableId && position && yaw !== undefined) {
      buildables.push({ instanceId, buildableId, position, yaw });
    }
  });
  return buildables;
}

function parseRaft(
  value: unknown,
  errors: string[],
): SavedRaftV1 | null | undefined {
  if (value === null) {
    return null;
  }
  const raft = readRecord(value, 'save.raft', errors);
  if (!raft) {
    return undefined;
  }
  const instanceId = readNonEmptyString(raft.instanceId, 'save.raft.instanceId', errors);
  const position = readVec3(raft.position, 'save.raft.position', errors);
  const yaw = readFiniteNumber(raft.yaw, 'save.raft.yaw', errors);
  const hasBase = readBoolean(raft.hasBase, 'save.raft.hasBase', errors);
  const hasDeck = readBoolean(raft.hasDeck, 'save.raft.hasDeck', errors);
  if (hasDeck === true && hasBase === false) {
    errors.push('save.raft cannot have a deck without a base.');
  }
  return instanceId !== undefined && position && yaw !== undefined && hasBase !== undefined && hasDeck !== undefined
    ? { instanceId, position, yaw, hasBase, hasDeck }
    : undefined;
}

function parseInventory(
  value: unknown,
  path: string,
  errors: string[],
): ItemStack[] | undefined {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return undefined;
  }
  const inventory: ItemStack[] = [];
  value.forEach((candidate, index) => {
    const stackPath = `${path}[${index}]`;
    const stack = readRecord(candidate, stackPath, errors);
    if (!stack) {
      return;
    }
    if (!isItemId(stack.itemId)) {
      errors.push(`${stackPath}.itemId is unknown.`);
      return;
    }
    const quantity = readPositiveInteger(stack.quantity, `${stackPath}.quantity`, errors);
    if (quantity === undefined) {
      return;
    }
    if (quantity > ITEM_CATALOG[stack.itemId].stackLimit) {
      errors.push(`${stackPath}.quantity exceeds its item stack limit.`);
      return;
    }
    const spoilageSecondsRemaining = stack.spoilageSecondsRemaining === undefined
      ? undefined
      : readRangeNumber(stack.spoilageSecondsRemaining, 0, 10_000_000_000, `${stackPath}.spoilageSecondsRemaining`, errors);
    if (stack.spoilageSecondsRemaining !== undefined && spoilageSecondsRemaining === undefined) return;
    inventory.push({
      itemId: stack.itemId,
      quantity,
      ...(spoilageSecondsRemaining === undefined ? {} : { spoilageSecondsRemaining }),
    });
  });
  return inventory;
}

function parseSurvival(
  value: unknown,
  path: string,
  errors: string[],
): SurvivalState | undefined {
  const record = readRecord(value, path, errors);
  if (!record) {
    return undefined;
  }
  const vitals = parseVitals(value, path, errors);
  const staminaRegenDelayRemaining = readRangeNumber(
    record.staminaRegenDelayRemaining,
    0,
    1,
    `${path}.staminaRegenDelayRemaining`,
    errors,
  );
  const dayElapsedSeconds = readRangeNumber(
    record.dayElapsedSeconds,
    0,
    LEGACY_DAY_LENGTH_SECONDS,
    `${path}.dayElapsedSeconds`,
    errors,
    false,
  );
  const maxStamina = record.maxStamina === undefined
    ? 100
    : readRangeNumber(record.maxStamina, 35, 100, `${path}.maxStamina`, errors);
  const fatigue = record.fatigue === undefined
    ? 0
    : readRangeNumber(record.fatigue, 0, 100, `${path}.fatigue`, errors);
  if (vitals && maxStamina !== undefined && vitals.stamina > maxStamina) {
    errors.push(`${path}.stamina cannot exceed maxStamina.`);
  }
  return vitals && maxStamina !== undefined && fatigue !== undefined && vitals.stamina <= maxStamina && staminaRegenDelayRemaining !== undefined && dayElapsedSeconds !== undefined
    ? { ...vitals, maxStamina, fatigue, staminaRegenDelayRemaining, dayElapsedSeconds: dayElapsedSeconds % DAY_LENGTH_SECONDS }
    : undefined;
}

function parseVitals(
  value: unknown,
  path: string,
  errors: string[],
): SurvivalVitals | undefined {
  const record = readRecord(value, path, errors);
  if (!record) {
    return undefined;
  }
  const health = readRangeNumber(record.health, 0, 100, `${path}.health`, errors);
  const hunger = readRangeNumber(record.hunger, 0, 100, `${path}.hunger`, errors);
  const thirst = readRangeNumber(record.thirst, 0, 100, `${path}.thirst`, errors);
  const stamina = readRangeNumber(record.stamina, 0, 100, `${path}.stamina`, errors);
  const oxygen = readRangeNumber(record.oxygen, 0, 100, `${path}.oxygen`, errors);
  return health !== undefined &&
    hunger !== undefined &&
    thirst !== undefined &&
    stamina !== undefined &&
    oxygen !== undefined
    ? { health, hunger, thirst, stamina, oxygen }
    : undefined;
}

function readRecord(value: unknown, path: string, errors: string[]): UnknownRecord | undefined {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(
  value: unknown,
  path: string,
  errors: string[],
): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string.`);
    return undefined;
  }
  return value;
}

function readStringArray(
  value: unknown,
  path: string,
  errors: string[],
): string[] | undefined {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    errors.push(`${path} must be an array of strings.`);
    return undefined;
  }
  return [...value] as string[];
}

function readIslandId(
  value: unknown,
  path: string,
  errors: string[],
): IslandId | undefined {
  if (!isIslandId(value)) {
    errors.push(`${path} is an unknown island id.`);
    return undefined;
  }
  return value;
}

function readVec3(value: unknown, path: string, errors: string[]): Vec3 | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((component) => typeof component !== 'number' || !Number.isFinite(component))
  ) {
    errors.push(`${path} must be a finite three-number tuple.`);
    return undefined;
  }
  return [value[0] as number, value[1] as number, value[2] as number];
}

function readBoolean(value: unknown, path: string, errors: string[]): boolean | undefined {
  if (typeof value !== 'boolean') {
    errors.push(`${path} must be boolean.`);
    return undefined;
  }
  return value;
}

function readFiniteNumber(value: unknown, path: string, errors: string[]): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number.`);
    return undefined;
  }
  return value;
}

function readNonNegativeInteger(
  value: unknown,
  path: string,
  errors: string[],
): number | undefined {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    errors.push(`${path} must be a non-negative safe integer.`);
    return undefined;
  }
  return value as number;
}

function readPositiveInteger(
  value: unknown,
  path: string,
  errors: string[],
): number | undefined {
  const result = readNonNegativeInteger(value, path, errors);
  if (result === 0) {
    errors.push(`${path} must be greater than zero.`);
    return undefined;
  }
  return result;
}

function readRangeNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
  errors: string[],
  inclusiveMaximum = true,
): number | undefined {
  const number = readFiniteNumber(value, path, errors);
  if (number === undefined) {
    return undefined;
  }
  const aboveMaximum = inclusiveMaximum ? number > maximum : number >= maximum;
  if (number < minimum || aboveMaximum) {
    const boundary = inclusiveMaximum ? 'inclusive' : 'exclusive';
    errors.push(`${path} must be between ${minimum} and ${maximum} (${boundary} maximum).`);
    return undefined;
  }
  return number;
}
