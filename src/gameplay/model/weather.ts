import { DAY_LENGTH_SECONDS } from './survival';

export type WeatherKind = 'clear' | 'rain' | 'heat' | 'storm';

export interface WeatherState {
  readonly kind: WeatherKind;
  readonly label: string;
  readonly icon: string;
  readonly isRaining: boolean;
  readonly hasLightning: boolean;
  readonly thirstDrainMultiplier: number;
  readonly rainCollectionMultiplier: number;
}

const WEATHER_SEQUENCE: readonly WeatherKind[] = [
  'clear',
  'heat',
  'clear',
  'clear',
  'rain',
  'clear',
  'clear',
  'heat',
  'clear',
  'clear',
  'storm',
  'clear',
];

const WEATHER_DEFINITIONS: Readonly<Record<WeatherKind, Omit<WeatherState, 'kind'>>> = {
  clear: {
    label: 'Klar',
    icon: '☀',
    isRaining: false,
    hasLightning: false,
    thirstDrainMultiplier: 1,
    rainCollectionMultiplier: 1,
  },
  rain: {
    label: 'Regen',
    icon: '🌧',
    isRaining: true,
    hasLightning: false,
    thirstDrainMultiplier: 0.92,
    rainCollectionMultiplier: 6,
  },
  heat: {
    label: 'Hitze',
    icon: '☀',
    isRaining: false,
    hasLightning: false,
    thirstDrainMultiplier: 1.8,
    rainCollectionMultiplier: 1,
  },
  storm: {
    label: 'Gewitter',
    icon: '⛈',
    isRaining: true,
    hasLightning: true,
    thirstDrainMultiplier: 1,
    rainCollectionMultiplier: 10,
  },
};

export function weatherState(kind: WeatherKind): WeatherState {
  return { kind, ...WEATHER_DEFINITIONS[kind] };
}

export function getWeatherState(day: number, dayElapsedSeconds: number): WeatherState {
  const normalizedDay = Math.max(1, Math.floor(day));
  const elapsed = Math.max(0, dayElapsedSeconds) % DAY_LENGTH_SECONDS;
  const segmentLength = DAY_LENGTH_SECONDS / WEATHER_SEQUENCE.length;
  const segment = Math.floor(elapsed / segmentLength);
  const dayOffset = (normalizedDay * 2 + Math.floor(normalizedDay / 3)) % WEATHER_SEQUENCE.length;
  return weatherState(WEATHER_SEQUENCE[(segment + dayOffset) % WEATHER_SEQUENCE.length] ?? 'clear');
}
