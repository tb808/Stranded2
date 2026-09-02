import type { WeatherKind } from "./weather";

export interface OceanConditions {
  readonly waveHeight: number;
  readonly waveSpeed: number;
  readonly choppiness: number;
  readonly foamStrength: number;
  readonly windX: number;
  readonly windZ: number;
  readonly currentX: number;
  readonly currentZ: number;
  readonly tideHeight: number;
}

interface OceanPreset {
  readonly waveHeight: number;
  readonly waveSpeed: number;
  readonly choppiness: number;
  readonly foamStrength: number;
  readonly currentStrength: number;
  readonly windAngle: number;
}

const OCEAN_PRESETS: Readonly<Record<WeatherKind, OceanPreset>> = {
  clear: { waveHeight: 0.14, waveSpeed: 0.92, choppiness: 0.26, foamStrength: 0.08, currentStrength: 0.06, windAngle: 0.58 },
  heat: { waveHeight: 0.09, waveSpeed: 0.72, choppiness: 0.14, foamStrength: 0.025, currentStrength: 0.035, windAngle: 2.02 },
  rain: { waveHeight: 0.25, waveSpeed: 1.08, choppiness: 0.5, foamStrength: 0.38, currentStrength: 0.13, windAngle: 1.18 },
  storm: { waveHeight: 0.5, waveSpeed: 1.42, choppiness: 0.9, foamStrength: 1, currentStrength: 0.3, windAngle: 2.62 },
};

const TIDE_PERIOD_SECONDS = 420;

export function oceanConditionsForWeather(kind: WeatherKind, elapsedSeconds: number): OceanConditions {
  const preset = OCEAN_PRESETS[kind];
  const directionSwing = Math.sin(elapsedSeconds * 0.0061) * (kind === "storm" ? 0.16 : 0.08);
  const angle = preset.windAngle + directionSwing;
  const windX = Math.cos(angle);
  const windZ = Math.sin(angle);
  const currentAngle = angle + 0.24;
  return {
    waveHeight: preset.waveHeight,
    waveSpeed: preset.waveSpeed,
    choppiness: preset.choppiness,
    foamStrength: preset.foamStrength,
    windX,
    windZ,
    currentX: Math.cos(currentAngle) * preset.currentStrength,
    currentZ: Math.sin(currentAngle) * preset.currentStrength,
    tideHeight: Math.sin(elapsedSeconds * Math.PI * 2 / TIDE_PERIOD_SECONDS) * 0.075,
  };
}

export function oceanSurfaceHeight(x: number, z: number, elapsedSeconds: number, conditions: OceanConditions): number {
  const alongWind = x * conditions.windX + z * conditions.windZ;
  const acrossWind = x * -conditions.windZ + z * conditions.windX;
  const primary = Math.sin(alongWind * 0.055 + elapsedSeconds * 1.05 * conditions.waveSpeed) * conditions.waveHeight * 0.58;
  const cross = Math.cos(acrossWind * 0.083 - elapsedSeconds * 0.82 * conditions.waveSpeed) * conditions.waveHeight * 0.31;
  const ripples = Math.sin((x + z) * 0.17 + elapsedSeconds * 1.45 * conditions.waveSpeed) * conditions.waveHeight * 0.11;
  return conditions.tideHeight + primary + cross + ripples;
}
