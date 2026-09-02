export const DAYLIGHT_DURATION_SECONDS = 7 * 60;
export const NIGHT_DURATION_SECONDS = 3 * 60;
export const DAY_LENGTH_SECONDS = DAYLIGHT_DURATION_SECONDS + NIGHT_DURATION_SECONDS;
export const LEGACY_DAY_LENGTH_SECONDS = 30 * 60;

export const SURVIVAL_LIMITS = {
  health: 100,
  hunger: 100,
  thirst: 100,
  stamina: 100,
  oxygen: 100,
  fatigue: 100,
} as const;

export const SURVIVAL_START = {
  health: 100,
  hunger: 70,
  thirst: 65,
  stamina: 100,
  oxygen: 100,
  fatigue: 0,
} as const;

export const SURVIVAL_RATES = {
  hungerDrainPerSecond: 1 / 75,
  thirstDrainPerSecond: 1 / 45,
  starvationDamagePerSecond: 1 / 4,
  dehydrationDamagePerSecond: 2 / 3,
  underwaterOxygenDrainPerSecond: 5,
  drowningDamagePerSecond: 10 / 2,
  sprintStaminaDrainPerSecond: 18,
  fastSwimStaminaDrainPerSecond: 12,
  staminaRegenPerSecond: 15,
  staminaRegenDelaySeconds: 1,
  coldMaxStaminaDrainPerSecond: 0.08,
  warmMaxStaminaRecoveryPerSecond: 0.15,
  fatigueGainPerSecond: 100 / (DAY_LENGTH_SECONDS * 2),
  exhaustedHealthDamagePerSecond: 0.08,
} as const;

export const MINIMUM_COLD_MAX_STAMINA = 35;

export type MovementActivity = 'idle' | 'walk' | 'sprint' | 'swim' | 'fast-swim';

export interface SurvivalVitals {
  readonly health: number;
  readonly hunger: number;
  readonly thirst: number;
  readonly stamina: number;
  readonly oxygen: number;
}

export interface SurvivalState extends SurvivalVitals {
  readonly maxStamina: number;
  readonly fatigue: number;
  readonly staminaRegenDelayRemaining: number;
  readonly dayElapsedSeconds: number;
}

export interface SurvivalActivity {
  readonly movement: MovementActivity;
  readonly isUnderwater: boolean;
  readonly thirstDrainMultiplier?: number;
  readonly isCold?: boolean;
}

interface DrainResult {
  readonly value: number;
  readonly secondsAtZero: number;
}

const DEFAULT_ACTIVITY: SurvivalActivity = {
  movement: 'idle',
  isUnderwater: false,
};

export function createInitialSurvivalState(): SurvivalState {
  return {
    ...SURVIVAL_START,
    maxStamina: SURVIVAL_LIMITS.stamina,
    staminaRegenDelayRemaining: 0,
    dayElapsedSeconds: 0,
  };
}

export function advanceSurvival(
  state: SurvivalState,
  deltaSeconds: number,
  activity: SurvivalActivity = DEFAULT_ACTIVITY,
): SurvivalState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError('deltaSeconds must be finite and non-negative.');
  }
  if (deltaSeconds === 0 || state.health === 0) {
    return { ...state };
  }

  const hunger = drain(state.hunger, SURVIVAL_RATES.hungerDrainPerSecond, deltaSeconds);
  const thirstMultiplier = clamp(activity.thirstDrainMultiplier ?? 1, 0.25, 5);
  const thirst = drain(state.thirst, SURVIVAL_RATES.thirstDrainPerSecond * thirstMultiplier, deltaSeconds);
  const oxygen = activity.isUnderwater
    ? drain(state.oxygen, SURVIVAL_RATES.underwaterOxygenDrainPerSecond, deltaSeconds)
    : { value: SURVIVAL_LIMITS.oxygen, secondsAtZero: 0 };
  const fatigue = fill(state.fatigue, SURVIVAL_RATES.fatigueGainPerSecond, deltaSeconds);

  const healthDamage =
    hunger.secondsAtZero * SURVIVAL_RATES.starvationDamagePerSecond +
    thirst.secondsAtZero * SURVIVAL_RATES.dehydrationDamagePerSecond +
    oxygen.secondsAtZero * SURVIVAL_RATES.drowningDamagePerSecond;
  const exhaustionDamage = fatigue.secondsAtMaximum * SURVIVAL_RATES.exhaustedHealthDamagePerSecond;

  const maxStamina = activity.isCold
    ? clamp(
        state.maxStamina - SURVIVAL_RATES.coldMaxStaminaDrainPerSecond * deltaSeconds,
        MINIMUM_COLD_MAX_STAMINA,
        SURVIVAL_LIMITS.stamina,
      )
    : clamp(
        state.maxStamina + SURVIVAL_RATES.warmMaxStaminaRecoveryPerSecond * deltaSeconds,
        MINIMUM_COLD_MAX_STAMINA,
        SURVIVAL_LIMITS.stamina,
      );
  const stamina = advanceStamina(state, activity.movement, deltaSeconds, maxStamina, fatigue.value);

  return {
    health: clamp(state.health - healthDamage - exhaustionDamage, 0, SURVIVAL_LIMITS.health),
    hunger: hunger.value,
    thirst: thirst.value,
    stamina: stamina.value,
    maxStamina,
    oxygen: oxygen.value,
    fatigue: fatigue.value,
    staminaRegenDelayRemaining: stamina.regenDelayRemaining,
    dayElapsedSeconds: (state.dayElapsedSeconds + deltaSeconds) % DAY_LENGTH_SECONDS,
  };
}

function advanceStamina(
  state: SurvivalState,
  movement: MovementActivity,
  deltaSeconds: number,
  maxStamina: number,
  fatigue: number,
): { readonly value: number; readonly regenDelayRemaining: number } {
  const drainRate =
    movement === 'sprint'
      ? SURVIVAL_RATES.sprintStaminaDrainPerSecond
      : movement === 'fast-swim'
        ? SURVIVAL_RATES.fastSwimStaminaDrainPerSecond
        : 0;

  if (drainRate > 0) {
    return {
      value: clamp(state.stamina - drainRate * deltaSeconds, 0, maxStamina),
      regenDelayRemaining: SURVIVAL_RATES.staminaRegenDelaySeconds,
    };
  }

  const regenDelayRemaining = Math.max(0, state.staminaRegenDelayRemaining - deltaSeconds);
  const regenSeconds = Math.max(0, deltaSeconds - state.staminaRegenDelayRemaining);
  return {
    value: clamp(
      state.stamina + regenSeconds * SURVIVAL_RATES.staminaRegenPerSecond * fatigueStaminaRegenMultiplier(fatigue),
      0,
      maxStamina,
    ),
    regenDelayRemaining,
  };
}

function fatigueStaminaRegenMultiplier(fatigue: number): number {
  if (fatigue <= 50) return 1;
  return 1 - ((fatigue - 50) / 50) * 0.65;
}

function fill(value: number, rate: number, deltaSeconds: number): { readonly value: number; readonly secondsAtMaximum: number } {
  const secondsUntilMaximum = rate === 0 ? Number.POSITIVE_INFINITY : (100 - value) / rate;
  return {
    value: clamp(value + rate * deltaSeconds, 0, 100),
    secondsAtMaximum: Math.max(0, deltaSeconds - secondsUntilMaximum),
  };
}

function drain(value: number, rate: number, deltaSeconds: number): DrainResult {
  const secondsUntilEmpty = rate === 0 ? Number.POSITIVE_INFINITY : value / rate;
  return {
    value: clamp(value - rate * deltaSeconds, 0, 100),
    secondsAtZero: Math.max(0, deltaSeconds - secondsUntilEmpty),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
