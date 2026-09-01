import type { SettingsViewModel } from "../ui";

export interface PersistedSettingsV1 {
  schemaVersion: 1;
  settings: SettingsViewModel;
}

type UnknownRecord = Record<string, unknown>;

export function createPersistedSettings(settings: SettingsViewModel): PersistedSettingsV1 {
  return { schemaVersion: 1, settings: structuredClone(settings) };
}

export function isPersistedSettingsV1(value: unknown): value is PersistedSettingsV1 {
  return isRecord(value) && value.schemaVersion === 1 && isSettingsViewModel(value.settings);
}

export function isSettingsViewModel(value: unknown): value is SettingsViewModel {
  if (!isRecord(value) || !isRecord(value.audio)) return false;
  if (!(["low", "medium", "high", "ultra"] as const).includes(value.quality as never)) return false;
  if (!isRange(value.fov, 60, 100) || !isRange(value.sensitivity, 0.1, 3)) return false;
  if (typeof value.reducedMotion !== "boolean") return false;
  return [value.audio.master, value.audio.ambience, value.audio.effects, value.audio.ui]
    .every((volume) => isRange(volume, 0, 1));
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}
