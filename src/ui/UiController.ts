import { element, isEditableTarget, setHidden } from './dom';
import { GamePanelView } from './GamePanelView';
import { HudView } from './HudView';
import { ModalView } from './ModalView';
import { BootView, MainMenuView } from './ScreenViews';
import type {
  BootViewModel,
  BuildViewModel,
  CraftingViewModel,
  DeathViewModel,
  HudViewModel,
  InventoryViewModel,
  LetterViewModel,
  MainMenuViewModel,
  NotebookViewModel,
  PauseViewModel,
  SettingsViewModel,
  StorageErrorViewModel,
  StorageViewModel,
  UiCallbacks,
  UiControllerOptions,
  UiPanel,
  UiPrimaryScreen,
  UiToast,
} from './types';

const DEFAULT_SETTINGS: SettingsViewModel = {
  quality: 'high',
  audio: {
    master: 0.8,
    ambience: 0.75,
    effects: 0.8,
    ui: 0.65,
  },
  fov: 75,
  sensitivity: 1,
  reducedMotion: false,
};

type ModalReturn = 'menu' | 'game' | 'pause' | null;

export class UiController {
  readonly element: HTMLElement;

  private readonly callbacks: Partial<UiCallbacks>;
  private readonly bootView: BootView;
  private readonly menuView: MainMenuView;
  private readonly hudView: HudView;
  private readonly panelView: GamePanelView;
  private readonly modalView: ModalView;
  private readonly toastRegion: HTMLElement;
  private readonly toastTimers = new Map<string, number>();
  private screen: UiPrimaryScreen = 'boot';
  private settings: SettingsViewModel;
  private lastPauseModel: PauseViewModel = {};
  private modalReturn: ModalReturn = null;
  private toastSequence = 0;
  private destroyed = false;

  constructor(options: UiControllerOptions) {
    this.callbacks = options.callbacks ?? {};
    this.settings = cloneSettings(options.initialSettings ?? DEFAULT_SETTINGS);

    this.bootView = new BootView({
      retry: () => this.callbacks.onRetryBoot?.(),
      openHelp: () => this.callbacks.onOpenWebGlHelp?.(),
    });
    this.menuView = new MainMenuView({
      continueGame: () => this.callbacks.onContinue?.(),
      newGame: () => this.callbacks.onNewGame?.(),
      openSettings: () => this.showSettings('menu'),
      openCredits: () => this.showCredits(),
    });
    this.hudView = new HudView({
      selectHotbar: (index, itemId) => this.callbacks.onHotbarSelected?.(index, itemId),
    });
    this.panelView = new GamePanelView({
      close: () => this.closePanel(),
      switchPanel: (panel) => this.openPanel(panel),
      selectInventoryItem: (instanceId) => this.callbacks.onInventoryItemSelected?.(instanceId),
      moveInventoryStack: (sourceIndex, targetIndex) => this.callbacks.onInventoryStackMoved?.(sourceIndex, targetIndex),
      useInventoryItem: (instanceId) => this.callbacks.onInventoryItemUsed?.(instanceId),
      dropInventoryItem: (instanceId) => this.callbacks.onInventoryItemDropped?.(instanceId),
      depositStorageItem: (instanceId) => this.callbacks.onStorageDeposit?.(instanceId),
      withdrawStorageItem: (instanceId) => this.callbacks.onStorageWithdraw?.(instanceId),
      selectCraftingCategory: (category) => this.callbacks.onCraftingCategorySelected?.(category),
      selectRecipe: (recipeId) => this.callbacks.onRecipeSelected?.(recipeId),
      craft: (recipeId, amount) => this.callbacks.onCraftRequested?.(recipeId, amount),
      selectBuildCategory: (category) => this.callbacks.onBuildCategorySelected?.(category),
      selectBuild: (buildId) => {
        this.callbacks.onBuildSelected?.(buildId);
        this.closePanel();
      },
      cancelBuild: () => this.callbacks.onBuildCancelled?.(),
    });
    this.modalView = new ModalView({
      requestClose: () => this.handleModalClose(),
      resume: () => this.resumeFromPause(),
      openSettings: () => this.showSettings('pause'),
      returnToMainMenu: () => this.callbacks.onReturnToMainMenu?.(),
      reloadLastSave: () => this.callbacks.onReloadLastSave?.(),
      restartAfterDeath: () => this.callbacks.onRestartAfterDeath?.(),
      settingsChanged: (settings) => this.applySettings(settings),
      storageRetry: () => this.callbacks.onStorageRetry?.(),
      continueWithoutSaving: () => this.callbacks.onContinueWithoutSaving?.(),
      storageDismissed: () => {
        this.callbacks.onStorageErrorDismissed?.();
        this.closeModalAndRestore();
      },
    });

    this.toastRegion = element('ol', 'toast-region');
    this.toastRegion.setAttribute('aria-live', 'polite');
    this.toastRegion.setAttribute('aria-label', 'Hinweise');

    const screens = element(
      'div',
      'ui-screens',
      this.bootView.element,
      this.menuView.element,
      this.hudView.element,
    );
    this.element = element(
      'div',
      'game-ui',
      screens,
      this.panelView.element,
      this.modalView.element,
      this.toastRegion,
    );
    this.element.dataset.screen = this.screen;
    this.element.classList.toggle('ui-reduced-motion', this.settings.reducedMotion);
    options.root.append(this.element);
    this.setScreen('boot');
    window.addEventListener('keydown', this.handleKeyDown, { capture: true });
  }

  showBoot(model: BootViewModel = { mode: 'booting' }): void {
    this.closeAllOverlays();
    this.bootView.update(model);
    this.setScreen('boot');
  }

  showLoading(model: Omit<BootViewModel, 'mode'> = {}): void {
    this.showBoot({ ...model, mode: 'loading' });
  }

  showFatalWebGl(model: Omit<BootViewModel, 'mode'> = {}): void {
    this.showBoot({ ...model, mode: 'fatal-webgl' });
  }

  showMainMenu(model: MainMenuViewModel): void {
    this.closeAllOverlays();
    this.menuView.update(model);
    this.setScreen('menu');
  }

  showGame(model?: HudViewModel): void {
    this.modalView.close();
    this.modalReturn = null;
    if (model) this.hudView.update(model);
    this.setScreen('game');
  }

  updateHud(model: HudViewModel): void {
    this.hudView.update(model);
  }

  updateInventory(model: InventoryViewModel): void {
    this.panelView.updateInventory(model);
  }

  updateCrafting(model: CraftingViewModel): void {
    this.panelView.updateCrafting(model);
  }

  updateBuild(model: BuildViewModel): void {
    this.panelView.updateBuild(model);
  }

  updateStorage(model: StorageViewModel): void {
    this.panelView.updateStorage(model);
  }

  updateNotebook(model: NotebookViewModel): void {
    this.panelView.updateNotebook(model);
  }

  updateSettings(model: SettingsViewModel): void {
    this.settings = cloneSettings(model);
    this.element.classList.toggle('ui-reduced-motion', model.reducedMotion);
    if (this.modalView.getActiveModal() === 'settings') this.modalView.showSettings(this.settings);
  }

  openPanel(panel: UiPanel): void {
    if (this.screen !== 'game' || this.modalView.getActiveModal()) return;
    if (this.panelView.getActivePanel() === panel) {
      this.closePanel();
      return;
    }
    this.panelView.open(panel);
    this.element.dataset.panel = panel;
    this.callbacks.onPanelChanged?.(panel);
  }

  closePanel(): void {
    if (!this.panelView.isOpen()) return;
    this.panelView.close();
    delete this.element.dataset.panel;
    this.callbacks.onPanelChanged?.(null);
  }

  showPause(model: PauseViewModel = {}): void {
    this.closePanel();
    this.lastPauseModel = model;
    this.modalReturn = 'game';
    this.modalView.showPause(model);
  }

  showLetter(model: LetterViewModel): void {
    this.closePanel();
    this.modalReturn = 'game';
    this.modalView.showLetter(model);
  }

  showDeath(model: DeathViewModel): void {
    this.closePanel();
    this.modalReturn = null;
    this.modalView.showDeath(model);
  }

  showStorageError(model: StorageErrorViewModel): void {
    const active = this.modalView.getActiveModal();
    this.modalReturn = active === 'pause' ? 'pause' : this.screen === 'menu' ? 'menu' : 'game';
    this.closePanel();
    this.modalView.showStorageError(model);
  }

  dismissStorageError(): void {
    if (this.modalView.getActiveModal() === 'storage-error') this.closeModalAndRestore();
  }

  showSettings(returnTo: Exclude<ModalReturn, null> = this.screen === 'menu' ? 'menu' : 'game'): void {
    this.modalReturn = returnTo;
    this.modalView.showSettings(this.settings);
  }

  showCredits(): void {
    this.modalReturn = this.screen === 'menu' ? 'menu' : 'game';
    this.modalView.showCredits();
  }

  addToast(toast: UiToast): string {
    const id = toast.id ?? `ui-toast-${++this.toastSequence}`;
    const existing = this.toastRegion.querySelector<HTMLElement>(`[data-toast-id="${CSS.escape(id)}"]`);
    existing?.remove();
    const item = element('li', 'toast', toast.text);
    item.dataset.toastId = id;
    item.dataset.tone = toast.tone ?? 'info';
    this.toastRegion.append(item);

    const previousTimer = this.toastTimers.get(id);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    const timer = window.setTimeout(() => this.dismissToast(id), toast.durationMs ?? 4200);
    this.toastTimers.set(id, timer);
    return id;
  }

  dismissToast(id: string): void {
    const item = this.toastRegion.querySelector<HTMLElement>(`[data-toast-id="${CSS.escape(id)}"]`);
    if (!item) return;
    const timer = this.toastTimers.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    this.toastTimers.delete(id);
    if (this.settings.reducedMotion) {
      item.remove();
      return;
    }
    item.classList.add('toast--leaving');
    window.setTimeout(() => item.remove(), 180);
  }

  setPointerLockActive(active: boolean): void {
    this.element.classList.toggle('game-ui--pointer-locked', active);
  }

  setHudVisible(visible: boolean): void {
    this.hudView.element.classList.toggle('game-hud--hidden', !visible);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('keydown', this.handleKeyDown, { capture: true });
    for (const timer of this.toastTimers.values()) window.clearTimeout(timer);
    this.toastTimers.clear();
    this.modalView.close();
    this.element.remove();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.destroyed || event.defaultPrevented || isEditableTarget(event.target)) return;

    if (event.code === 'Escape') {
      event.preventDefault();
      if (this.modalView.getActiveModal()) {
        this.handleModalClose();
      } else if (this.panelView.isOpen()) {
        this.closePanel();
      } else if (this.screen === 'game') {
        this.callbacks.onPauseRequested?.();
      }
      return;
    }

    if (this.screen !== 'game' || this.modalView.getActiveModal() || event.repeat) return;
    if (event.code === 'KeyB' && this.callbacks.onBuildCancelled?.()) {
      event.preventDefault();
      return;
    }
    const panelByCode: Partial<Record<string, UiPanel>> = {
      KeyI: 'inventory',
      KeyC: 'crafting',
      KeyB: 'build',
      KeyN: 'notebook',
    };
    const panel = panelByCode[event.code];
    if (panel) {
      event.preventDefault();
      this.openPanel(panel);
      return;
    }

    if (!this.panelView.isOpen() && /^Digit[1-9]$/.test(event.code)) {
      const index = Number(event.code.slice(-1)) - 1;
      this.callbacks.onHotbarSelected?.(index);
    }
  };

  private setScreen(screen: UiPrimaryScreen): void {
    this.screen = screen;
    this.element.dataset.screen = screen;
    setHidden(this.bootView.element, screen !== 'boot');
    setHidden(this.menuView.element, screen !== 'menu');
    setHidden(this.hudView.element, screen !== 'game');
  }

  private handleModalClose(): void {
    const active = this.modalView.getActiveModal();
    if (!active) return;
    if (active === 'pause') {
      this.resumeFromPause();
      return;
    }
    if (active === 'letter') {
      this.resumeFromPause();
      return;
    }
    if (active === 'death') return;
    if (active === 'storage-error') {
      this.callbacks.onStorageErrorDismissed?.();
    }
    this.closeModalAndRestore();
  }

  private closeModalAndRestore(): void {
    const destination = this.modalReturn;
    this.modalView.close();
    this.modalReturn = null;
    if (destination === 'pause') {
      this.modalReturn = 'game';
      this.modalView.showPause(this.lastPauseModel);
    }
  }

  private resumeFromPause(): void {
    this.modalView.close();
    this.modalReturn = null;
    this.callbacks.onResume?.();
  }

  private closeAllOverlays(): void {
    this.panelView.close();
    this.modalView.close();
    this.modalReturn = null;
    delete this.element.dataset.panel;
  }

  private applySettings(model: SettingsViewModel): void {
    this.settings = cloneSettings(model);
    this.element.classList.toggle('ui-reduced-motion', model.reducedMotion);
    this.callbacks.onSettingsChanged?.(cloneSettings(model));
  }
}

function cloneSettings(settings: SettingsViewModel): SettingsViewModel {
  return {
    ...settings,
    audio: { ...settings.audio },
  };
}

export function createUiController(options: UiControllerOptions): UiController {
  return new UiController(options);
}
