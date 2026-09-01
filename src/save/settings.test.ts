import { describe, expect, it } from "vitest";
import { createPersistedSettings, isPersistedSettingsV1 } from "./settings";

const settings = {
  quality: "high",
  audio: { master: 0.8, ambience: 0.7, effects: 0.9, ui: 0.6 },
  fov: 75,
  sensitivity: 1,
  reducedMotion: false,
} as const;

describe("versionierte Einstellungen", () => {
  it("akzeptiert das aktuelle Schema und erstellt eine unabhängige Kopie", () => {
    const persisted = createPersistedSettings(settings);
    expect(isPersistedSettingsV1(persisted)).toBe(true);
    expect(persisted.settings).not.toBe(settings);
  });

  it("weist ungültige Profile und Lautstärken zurück", () => {
    expect(isPersistedSettingsV1({ schemaVersion: 1, settings: { ...settings, quality: "cinematic" } })).toBe(false);
    expect(isPersistedSettingsV1({ schemaVersion: 1, settings: { ...settings, audio: { ...settings.audio, master: 4 } } })).toBe(false);
  });
});
