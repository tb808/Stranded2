import { button, clear, element, focusFirst, percentage, setHidden } from './dom';
import type {
  BuildOptionViewModel,
  BuildViewModel,
  CraftingViewModel,
  IngredientViewModel,
  InventoryItemViewModel,
  InventoryViewModel,
  RecipeViewModel,
  StorageViewModel,
  UiPanel,
} from './types';

interface GamePanelActions {
  close(): void;
  switchPanel(panel: UiPanel): void;
  selectInventoryItem(instanceId: string): void;
  useInventoryItem(instanceId: string): void;
  dropInventoryItem(instanceId: string): void;
  depositStorageItem(instanceId: string): void;
  withdrawStorageItem(instanceId: string): void;
  selectCraftingCategory(category: string): void;
  selectRecipe(recipeId: string): void;
  craft(recipeId: string, amount: number): void;
  selectBuildCategory(category: string): void;
  selectBuild(buildId: string): void;
  cancelBuild(): void;
}

const PANEL_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export class GamePanelView {
  readonly element: HTMLElement;

  private readonly title: HTMLElement;
  private readonly shortcut: HTMLElement;
  private readonly body: HTMLElement;
  private readonly navButtons = new Map<UiPanel, HTMLButtonElement>();
  private readonly actions: GamePanelActions;
  private activePanel: UiPanel | null = null;
  private inventory: InventoryViewModel = { slots: [] };
  private crafting: CraftingViewModel = { categories: [], recipes: [] };
  private build: BuildViewModel = { categories: [], options: [] };
  private storage: StorageViewModel = {
    player: { slots: [] },
    container: { slots: [] },
  };
  private selectedInventoryId: string | undefined;
  private selectedRecipeId: string | undefined;
  private previouslyFocusedElement: HTMLElement | null = null;
  private focusRequest: number | null = null;

  constructor(actions: GamePanelActions) {
    this.actions = actions;
    this.title = element('h2', 'game-panel__title', 'Rucksack');
    this.title.id = 'game-panel-title';
    this.shortcut = element('kbd', 'game-panel__shortcut', 'I');
    const close = button('Schließen', 'icon-button game-panel__close', actions.close);
    close.setAttribute('aria-label', 'Fenster schließen');
    close.textContent = '×';

    const header = element(
      'header',
      'game-panel__header',
      element('div', 'game-panel__heading', this.shortcut, this.title),
      close,
    );

    const nav = element('nav', 'game-panel__nav');
    nav.setAttribute('aria-label', 'Spielmenüs');
    const tabs: ReadonlyArray<[UiPanel, string, string]> = [
      ['inventory', 'Rucksack', 'I'],
      ['crafting', 'Herstellen', 'C'],
      ['build', 'Bauen', 'B'],
    ];
    for (const [panel, label, key] of tabs) {
      const control = button(
        label,
        'game-panel__nav-button',
        () => this.actions.switchPanel(panel),
      );
      control.replaceChildren(
        element('span', 'game-panel__nav-label', label),
        element('kbd', 'game-panel__nav-key', key),
      );
      control.setAttribute('aria-pressed', 'false');
      nav.append(control);
      this.navButtons.set(panel, control);
    }

    this.body = element('div', 'game-panel__body');
    this.element = element('aside', 'game-panel', header, nav, this.body);
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-labelledby', this.title.id);
    this.element.setAttribute('aria-modal', 'true');
    this.element.tabIndex = -1;
    this.element.addEventListener('keydown', this.handleFocusTrap);
    setHidden(this.element, true);
  }

  isOpen(): boolean {
    return this.activePanel !== null;
  }

  getActivePanel(): UiPanel | null {
    return this.activePanel;
  }

  open(panel: UiPanel): void {
    const wasOpen = this.isOpen();
    if (!wasOpen) {
      const active = document.activeElement;
      this.previouslyFocusedElement =
        active instanceof HTMLElement && !this.element.contains(active) ? active : null;
    }
    this.activePanel = panel;
    setHidden(this.element, false);
    this.render();
    if (this.focusRequest !== null) window.cancelAnimationFrame(this.focusRequest);
    this.focusRequest = window.requestAnimationFrame(() => {
      this.focusRequest = null;
      if (this.isOpen()) focusFirst(this.element);
    });
  }

  close(): void {
    if (!this.isOpen()) return;
    if (this.focusRequest !== null) {
      window.cancelAnimationFrame(this.focusRequest);
      this.focusRequest = null;
    }
    this.activePanel = null;
    setHidden(this.element, true);
    const focusTarget = this.previouslyFocusedElement;
    this.previouslyFocusedElement = null;
    if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
  }

  updateInventory(model: InventoryViewModel): void {
    this.inventory = model;
    this.selectedInventoryId =
      model.selectedInstanceId ??
      (model.slots.some((slot) => slot.item?.instanceId === this.selectedInventoryId)
        ? this.selectedInventoryId
        : undefined);
    if (this.activePanel === 'inventory') this.render();
  }

  updateCrafting(model: CraftingViewModel): void {
    this.crafting = model;
    this.selectedRecipeId =
      model.selectedRecipeId ??
      (model.recipes.some((recipe) => recipe.id === this.selectedRecipeId)
        ? this.selectedRecipeId
        : undefined);
    if (this.activePanel === 'crafting') this.render();
  }

  updateBuild(model: BuildViewModel): void {
    this.build = model;
    if (this.activePanel === 'build') this.render();
  }

  updateStorage(model: StorageViewModel): void {
    this.storage = model;
    if (this.activePanel === 'storage') this.render();
  }

  private render(): void {
    if (!this.activePanel) return;
    const focusKey =
      document.activeElement instanceof HTMLElement && this.body.contains(document.activeElement)
        ? document.activeElement.dataset.panelFocus
        : undefined;
    const meta: Record<UiPanel, [string, string]> = {
      inventory: [this.inventory.title ?? 'Rucksack', 'I'],
      crafting: ['Herstellen', 'C'],
      build: ['Bauplan wählen', 'B'],
      storage: [this.storage.title ?? 'Truhe', 'E'],
    };
    this.title.textContent = meta[this.activePanel][0];
    this.shortcut.textContent = meta[this.activePanel][1];
    for (const [panel, control] of this.navButtons) {
      const active = panel === this.activePanel;
      control.dataset.active = String(active);
      control.setAttribute('aria-pressed', String(active));
    }

    if (this.activePanel === 'inventory') this.renderInventory();
    if (this.activePanel === 'crafting') this.renderCrafting();
    if (this.activePanel === 'build') this.renderBuild();
    if (this.activePanel === 'storage') this.renderStorage();
    this.restoreRenderedFocus(focusKey);
  }

  private renderInventory(): void {
    clear(this.body);
    const grid = element('div', 'inventory-grid');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Inventarplätze');

    for (const slot of this.inventory.slots) {
      const item = slot.item;
      const control = element(
        'button',
        'inventory-slot',
        element('span', 'inventory-slot__number', String(slot.index + 1)),
        element('span', 'inventory-slot__icon', item?.iconText ?? ''),
        element('span', 'inventory-slot__label', item?.label ?? 'Leer'),
        element(
          'span',
          'inventory-slot__quantity',
          item && item.quantity > 1 ? String(item.quantity) : '',
        ),
      );
      control.type = 'button';
      control.disabled = !item;
      control.dataset.panelFocus = `inventory-slot-${slot.index}`;
      const selected = Boolean(item && item.instanceId === this.selectedInventoryId);
      control.dataset.selected = String(selected);
      if (item) control.setAttribute('aria-pressed', String(selected));
      control.setAttribute(
        'aria-label',
        item ? `${item.label}, Anzahl ${item.quantity}` : `Platz ${slot.index + 1}, leer`,
      );
      if (item) {
        control.addEventListener('click', () => {
          this.selectedInventoryId = item.instanceId;
          this.actions.selectInventoryItem(item.instanceId);
          this.render();
        });
      }
      grid.append(control);
    }

    const selected = this.inventory.slots.find(
      (slot) => slot.item?.instanceId === this.selectedInventoryId,
    )?.item;
    const detail = this.inventoryDetail(selected);
    const weight = this.renderWeight();
    this.body.append(element('div', 'inventory-layout', element('div', '', weight, grid), detail));
  }

  private inventoryDetail(item?: InventoryItemViewModel): HTMLElement {
    if (!item) {
      return element(
        'section',
        'panel-detail panel-detail--empty',
        element('span', 'panel-detail__empty-icon', '◇'),
        element('h3', '', 'Gegenstand wählen'),
        element('p', '', 'Wähle einen belegten Platz, um Details und Aktionen zu sehen.'),
      );
    }

    const durability = element('div', 'detail-meter');
    if (item.durability !== undefined) {
      const fill = element('span', 'detail-meter__fill');
      fill.style.setProperty('--value', `${Math.max(0, Math.min(1, item.durability)) * 100}%`);
      durability.append(
        element('span', 'detail-meter__label', 'Haltbarkeit'),
        element('span', 'detail-meter__track', fill),
      );
    }
    setHidden(durability, item.durability === undefined);

    const use = button('Benutzen', 'button button--primary', () =>
      this.actions.useInventoryItem(item.instanceId),
    );
    use.dataset.panelFocus = `inventory-use-${item.instanceId}`;
    const drop = button('Ablegen', 'button button--quiet', () =>
      this.actions.dropInventoryItem(item.instanceId),
    );
    drop.dataset.panelFocus = `inventory-drop-${item.instanceId}`;
    return element(
      'section',
      'panel-detail',
      element('span', 'panel-detail__icon', item.iconText ?? '◇'),
      element('p', 'panel-detail__eyebrow', item.equipped ? 'Ausgerüstet' : 'Im Rucksack'),
      element('h3', 'panel-detail__title', item.label),
      element('p', 'panel-detail__description', item.description ?? 'Keine Beschreibung.'),
      durability,
      element(
        'dl',
        'panel-detail__facts',
        element('div', '', element('dt', '', 'Anzahl'), element('dd', '', String(item.quantity))),
        item.weight !== undefined
          ? element('div', '', element('dt', '', 'Gewicht'), element('dd', '', `${item.weight.toFixed(1)} kg`))
          : null,
      ),
      element('div', 'button-row panel-detail__actions', use, drop),
    );
  }

  private renderWeight(): HTMLElement {
    const current = this.inventory.currentWeight;
    const max = this.inventory.maxWeight;
    const wrap = element('div', 'inventory-weight');
    if (current === undefined || max === undefined) {
      setHidden(wrap, true);
      return wrap;
    }
    const fill = element('span', 'inventory-weight__fill');
    fill.style.setProperty('--value', `${percentage(current, max) * 100}%`);
    wrap.append(
      element('span', 'inventory-weight__label', `Traglast ${current.toFixed(1)} / ${max.toFixed(1)} kg`),
      element('span', 'inventory-weight__track', fill),
    );
    return wrap;
  }

  private renderStorage(): void {
    clear(this.body);
    const hint = element(
      'p',
      'storage-panel__hint',
      this.storage.hint ??
        'Klicke einen Gegenstand im Rucksack an, um ihn einzulagern. Klicke einen Gegenstand in der Truhe an, um ihn mitzunehmen.',
    );
    this.body.append(
      hint,
      element(
        'div',
        'storage-layout',
        this.storageInventorySection(
          'player',
          'Rucksack',
          this.storage.player,
          'In die Truhe legen',
          (instanceId) => this.actions.depositStorageItem(instanceId),
        ),
        this.storageInventorySection(
          'container',
          'Truhe',
          this.storage.container,
          'In den Rucksack nehmen',
          (instanceId) => this.actions.withdrawStorageItem(instanceId),
        ),
      ),
    );
  }

  private storageInventorySection(
    side: 'player' | 'container',
    title: string,
    inventory: InventoryViewModel,
    actionLabel: string,
    onTransfer: (instanceId: string) => void,
  ): HTMLElement {
    const heading = element('h3', 'storage-section__title', title);
    heading.id = `storage-${side}-title`;
    const occupied = inventory.slots.filter((slot) => Boolean(slot.item)).length;
    const capacity = element(
      'span',
      'storage-section__capacity',
      `${occupied} / ${inventory.slots.length} Plätze belegt`,
    );
    const grid = element('div', 'inventory-grid storage-section__grid');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', `${title}: Gegenstände`);

    for (const slot of inventory.slots) {
      const item = slot.item;
      const control = element(
        'button',
        'inventory-slot storage-slot',
        element('span', 'inventory-slot__number', String(slot.index + 1)),
        element('span', 'inventory-slot__icon', item?.iconText ?? ''),
        element('span', 'inventory-slot__label', item?.label ?? 'Leer'),
        element(
          'span',
          'inventory-slot__quantity',
          item && item.quantity > 1 ? String(item.quantity) : '',
        ),
        item ? element('span', 'storage-slot__action', side === 'player' ? '→' : '←') : null,
      );
      control.type = 'button';
      control.disabled = !item;
      control.dataset.panelFocus = `storage-${side}-slot-${slot.index}`;
      control.setAttribute(
        'aria-label',
        item
          ? `${item.label}, Anzahl ${item.quantity}: ${actionLabel}`
          : `${title}, Platz ${slot.index + 1}, leer`,
      );
      if (item) {
        control.title = `${item.label}: ${actionLabel}`;
        control.addEventListener('click', () => onTransfer(item.instanceId));
      }
      grid.append(control);
    }

    return element(
      'section',
      'storage-section',
      element('header', 'storage-section__header', heading, capacity),
      grid,
    );
  }

  private renderCrafting(): void {
    clear(this.body);
    const activeCategory = this.crafting.activeCategory ?? this.crafting.categories[0];
    const categoryNav = this.categoryNav(
      this.crafting.categories,
      activeCategory,
      (category) => this.actions.selectCraftingCategory(category),
    );
    const visibleRecipes = this.crafting.recipes.filter(
      (recipe) => !activeCategory || activeCategory === 'Alle' || recipe.category === activeCategory,
    );
    const list = element('div', 'catalog-list');
    for (const recipe of visibleRecipes) {
      list.append(this.recipeButton(recipe));
    }
    if (visibleRecipes.length === 0) {
      list.append(element('p', 'catalog-list__empty', 'In dieser Kategorie sind noch keine Rezepte bekannt.'));
    }

    const selected = this.crafting.recipes.find((recipe) => recipe.id === this.selectedRecipeId);
    this.body.append(
      categoryNav,
      element('div', 'catalog-layout', list, this.recipeDetail(selected)),
    );
  }

  private recipeButton(recipe: RecipeViewModel): HTMLButtonElement {
    const control = element(
      'button',
      'catalog-card',
      element('span', 'catalog-card__icon', recipe.iconText ?? '◇'),
      element(
        'span',
        'catalog-card__copy',
        element('strong', '', recipe.label),
        element('small', '', recipe.canCraft ? 'Bereit' : recipe.lockedReason ?? 'Material fehlt'),
      ),
    );
    control.type = 'button';
    control.dataset.panelFocus = `recipe-${recipe.id}`;
    control.dataset.available = String(recipe.canCraft);
    control.dataset.selected = String(recipe.id === this.selectedRecipeId);
    control.setAttribute('aria-pressed', String(recipe.id === this.selectedRecipeId));
    control.addEventListener('click', () => {
      this.selectedRecipeId = recipe.id;
      this.actions.selectRecipe(recipe.id);
      this.render();
    });
    return control;
  }

  private recipeDetail(recipe?: RecipeViewModel): HTMLElement {
    if (!recipe) return this.emptyDetail('Rezept wählen', 'Wähle links ein Rezept, um die benötigten Materialien zu prüfen.');
    const craftOne = button('1× herstellen', 'button button--primary', () =>
      this.actions.craft(recipe.id, 1),
    );
    craftOne.dataset.panelFocus = `recipe-craft-one-${recipe.id}`;
    craftOne.disabled = !recipe.canCraft;
    const craftFive = button('5×', 'button button--quiet', () => this.actions.craft(recipe.id, 5));
    craftFive.dataset.panelFocus = `recipe-craft-five-${recipe.id}`;
    craftFive.disabled = !recipe.canCraft;
    return element(
      'section',
      'panel-detail',
      element('span', 'panel-detail__icon', recipe.iconText ?? '◇'),
      element('p', 'panel-detail__eyebrow', recipe.category),
      element('h3', 'panel-detail__title', recipe.label),
      element('p', 'panel-detail__description', recipe.description ?? 'Keine Beschreibung.'),
      this.ingredientList(recipe.ingredients),
      !recipe.canCraft
        ? element('p', 'panel-detail__warning', recipe.lockedReason ?? 'Nicht genügend Material.')
        : null,
      element('div', 'button-row panel-detail__actions', craftOne, craftFive),
    );
  }

  private renderBuild(): void {
    clear(this.body);
    const activeCategory = this.build.activeCategory ?? this.build.categories[0];
    const categoryNav = this.categoryNav(
      this.build.categories,
      activeCategory,
      (category) => this.actions.selectBuildCategory(category),
    );
    const list = element('div', 'build-grid');
    const visible = this.build.options.filter(
      (option) => !activeCategory || activeCategory === 'Alle' || option.category === activeCategory,
    );
    for (const option of visible) list.append(this.buildCard(option));
    if (visible.length === 0) {
      list.append(element('p', 'catalog-list__empty', 'Keine Baupläne in dieser Kategorie.'));
    }
    const cancelBuild = button('Aktuellen Bau abbrechen', 'button button--quiet', this.actions.cancelBuild);
    cancelBuild.dataset.panelFocus = 'build-cancel';
    this.body.append(
      categoryNav,
      element(
        'div',
        'build-layout',
        list,
        element(
          'aside',
          'build-help',
          element('p', 'panel-detail__eyebrow', 'Baumodus'),
          element('h3', '', 'Am passenden Ort bauen'),
          element('p', '', 'Wähle einen Bauplan. Die Platzierung erfolgt anschließend direkt in der Welt.'),
          cancelBuild,
        ),
      ),
    );
  }

  private buildCard(option: BuildOptionViewModel): HTMLElement {
    const control = element(
      'button',
      'build-card',
      element('span', 'build-card__icon', option.iconText ?? '⌂'),
      element('span', 'build-card__category', option.category),
      element('strong', 'build-card__title', option.label),
      element('span', 'build-card__description', option.description ?? ''),
      this.ingredientList(option.ingredients, true),
      element(
        'span',
        'build-card__status',
        option.available ? 'Platzieren' : option.lockedReason ?? 'Material fehlt',
      ),
    );
    control.type = 'button';
    control.dataset.panelFocus = `build-${option.id}`;
    control.disabled = !option.available;
    control.dataset.selected = String(option.id === this.build.selectedBuildId);
    control.addEventListener('click', () => this.actions.selectBuild(option.id));
    return control;
  }

  private categoryNav(
    categories: readonly string[],
    active: string | undefined,
    onSelect: (category: string) => void,
  ): HTMLElement {
    const nav = element('nav', 'category-tabs');
    nav.setAttribute('aria-label', 'Kategorien');
    for (const category of categories) {
      const control = button(category, 'category-tab', () => onSelect(category));
      control.dataset.panelFocus = `category-${this.activePanel ?? 'panel'}-${category}`;
      control.dataset.active = String(category === active);
      control.setAttribute('aria-pressed', String(category === active));
      nav.append(control);
    }
    return nav;
  }

  private ingredientList(
    ingredients: readonly IngredientViewModel[],
    compact = false,
  ): HTMLElement {
    const list = element('ul', compact ? 'ingredient-list ingredient-list--compact' : 'ingredient-list');
    list.setAttribute('aria-label', 'Benötigte Materialien');
    for (const ingredient of ingredients) {
      const enough = ingredient.owned >= ingredient.required;
      const item = element(
        'li',
        'ingredient',
        element('span', 'ingredient__label', ingredient.label),
        element('span', 'ingredient__amount', `${ingredient.owned}/${ingredient.required}`),
      );
      item.dataset.enough = String(enough);
      list.append(item);
    }
    return list;
  }

  private emptyDetail(title: string, text: string): HTMLElement {
    return element(
      'section',
      'panel-detail panel-detail--empty',
      element('span', 'panel-detail__empty-icon', '◇'),
      element('h3', '', title),
      element('p', '', text),
    );
  }

  private readonly handleFocusTrap = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !this.isOpen()) return;
    const focusable = Array.from(
      this.element.querySelectorAll<HTMLElement>(PANEL_FOCUSABLE_SELECTOR),
    ).filter((candidate) => !candidate.hidden && candidate.getAttribute('aria-hidden') !== 'true');
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      this.element.focus({ preventScroll: true });
      return;
    }

    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === this.element)) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  private restoreRenderedFocus(focusKey: string | undefined): void {
    if (!focusKey) return;
    const target = this.body.querySelector<HTMLElement>(
      `[data-panel-focus="${CSS.escape(focusKey)}"]`,
    );
    if (target && (!(target instanceof HTMLButtonElement) || !target.disabled)) {
      target.focus({ preventScroll: true });
    } else if (!this.element.contains(document.activeElement)) {
      focusFirst(this.element);
    }
  }
}
