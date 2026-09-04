export type UiPrimaryScreen = 'boot' | 'menu' | 'game';

export type UiPanel = 'inventory' | 'crafting' | 'build' | 'notebook' | 'storage';

export type UiModal =
  | 'pause'
  | 'letter'
  | 'settings'
  | 'credits'
  | 'death'
  | 'storage-error';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface BootViewModel {
  mode: 'booting' | 'loading' | 'fatal-webgl';
  title?: string;
  message?: string;
  detail?: string;
  progress?: number;
  progressLabel?: string;
  canRetry?: boolean;
  canOpenHelp?: boolean;
}

export interface ContinueGameSummary {
  slotId: string;
  islandName: string;
  playedFor: string;
  savedAt: string;
}

export interface MainMenuViewModel {
  canContinue: boolean;
  continueSummary?: ContinueGameSummary;
  versionLabel?: string;
}

export interface SurvivalMetricViewModel {
  current: number;
  max: number;
  display?: string;
  state?: 'good' | 'warning' | 'critical';
}

export interface InteractionPromptViewModel {
  key: string;
  action: string;
  target?: string;
  holdProgress?: number;
}

export interface HudMessageViewModel {
  id: string;
  text: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
}

export interface HotbarSlotViewModel {
  index: number;
  itemId?: string;
  label?: string;
  iconText?: string;
  quantity?: number;
  durability?: number;
  disabled?: boolean;
}

export interface MapIslandViewModel {
  id: string;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  isStart: boolean;
  isCurrent: boolean;
}

export interface HudMapViewModel {
  visible: boolean;
  playerX: number;
  playerZ: number;
  headingDegrees: number;
  locationLabel: string;
  islands: readonly MapIslandViewModel[];
}

export interface HudViewModel {
  health: SurvivalMetricViewModel;
  hunger: SurvivalMetricViewModel;
  thirst: SurvivalMetricViewModel;
  stamina: SurvivalMetricViewModel;
  oxygen: SurvivalMetricViewModel;
  fatigue: SurvivalMetricViewModel;
  headingDegrees: number;
  locationLabel?: string;
  prompt?: InteractionPromptViewModel;
  messages?: readonly HudMessageViewModel[];
  hotbar: readonly HotbarSlotViewModel[];
  selectedHotbarIndex: number;
  clockLabel?: string;
  map: HudMapViewModel;
}

export interface InventoryItemViewModel {
  instanceId: string;
  itemId: string;
  label: string;
  description?: string;
  iconText?: string;
  quantity: number;
  durability?: number;
  weight?: number;
  equipped?: boolean;
}

export interface InventorySlotViewModel {
  index: number;
  item?: InventoryItemViewModel;
}

export interface InventoryViewModel {
  title?: string;
  slots: readonly InventorySlotViewModel[];
  selectedInstanceId?: string;
  currentWeight?: number;
  maxWeight?: number;
}

export interface StorageViewModel {
  title?: string;
  player: InventoryViewModel;
  container: InventoryViewModel;
  hint?: string;
}

export interface NotebookDiscoveryViewModel {
  id: string;
  label: string;
  iconText: string;
}

export interface NotebookStoryEntryViewModel {
  id: string;
  sequence: number;
  title: string;
  dateLabel: string;
  locationLabel: string;
  paragraphs: readonly string[];
  signature: string;
}

export interface NotebookIslandEntryViewModel {
  id: string;
  name: string;
  description: string;
  visitedDay: number;
  resources: readonly NotebookDiscoveryViewModel[];
  animals: readonly NotebookDiscoveryViewModel[];
}

export interface NotebookViewModel {
  storyEntries: readonly NotebookStoryEntryViewModel[];
  islands: readonly NotebookIslandEntryViewModel[];
  totalStoryEntries: number;
  totalIslands: number;
}

export interface IngredientViewModel {
  itemId: string;
  label: string;
  owned: number;
  required: number;
}

export interface RecipeViewModel {
  id: string;
  label: string;
  category: string;
  description?: string;
  iconText?: string;
  ingredients: readonly IngredientViewModel[];
  canCraft: boolean;
  lockedReason?: string;
}

export interface CraftingViewModel {
  station: 'hand' | 'workbench';
  title: string;
  hint: string;
  categories: readonly string[];
  activeCategory?: string;
  recipes: readonly RecipeViewModel[];
  selectedRecipeId?: string;
}

export interface BuildOptionViewModel {
  id: string;
  label: string;
  category: string;
  description?: string;
  iconText?: string;
  ingredients: readonly IngredientViewModel[];
  available: boolean;
  lockedReason?: string;
}

export interface BuildViewModel {
  categories: readonly string[];
  activeCategory?: string;
  options: readonly BuildOptionViewModel[];
  selectedBuildId?: string;
}

export interface PauseViewModel {
  locationLabel?: string;
  playedFor?: string;
  saveStatus?: 'saved' | 'saving' | 'unavailable';
}

export interface LetterViewModel {
  sequence: number;
  total: number;
  title: string;
  dateLabel: string;
  locationLabel: string;
  paragraphs: readonly string[];
  signature: string;
}

export interface DeathViewModel {
  cause: string;
  survivedFor?: string;
  islandName?: string;
  canReload: boolean;
}

export interface StorageErrorViewModel {
  operation: 'load' | 'save' | 'quota';
  title?: string;
  message: string;
  detail?: string;
  canRetry: boolean;
  canContinueWithoutSaving: boolean;
}

export interface AudioSettingsViewModel {
  master: number;
  ambience: number;
  effects: number;
  ui: number;
}

export interface SettingsViewModel {
  quality: QualityPreset;
  audio: AudioSettingsViewModel;
  fov: number;
  sensitivity: number;
  reducedMotion: boolean;
}

export interface UiToast {
  id?: string;
  text: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  durationMs?: number;
}

export interface UiCallbacks {
  onContinue(): void;
  onNewGame(): void;
  onRetryBoot(): void;
  onOpenWebGlHelp(): void;
  onPauseRequested(): void;
  onResume(): void;
  onReturnToMainMenu(): void;
  onReloadLastSave(): void;
  onRestartAfterDeath(): void;
  onPanelChanged(panel: UiPanel | null): void;
  onHotbarSelected(index: number, itemId?: string): void;
  onInventoryItemSelected(instanceId: string): void;
  onInventoryStackMoved(sourceIndex: number, targetIndex: number): void;
  onInventoryItemUsed(instanceId: string): void;
  onInventoryItemDropped(instanceId: string): void;
  onStorageDeposit(instanceId: string): void;
  onStorageWithdraw(instanceId: string): void;
  onCraftingCategorySelected(category: string): void;
  onRecipeSelected(recipeId: string): void;
  onCraftRequested(recipeId: string, amount: number): void;
  onBuildCategorySelected(category: string): void;
  onBuildSelected(buildId: string): void;
  onBuildCancelled(): boolean;
  onSettingsChanged(settings: SettingsViewModel): void;
  onStorageRetry(): void;
  onContinueWithoutSaving(): void;
  onStorageErrorDismissed(): void;
}

export interface UiControllerOptions {
  root: HTMLElement;
  callbacks?: Partial<UiCallbacks>;
  initialSettings?: SettingsViewModel;
}
