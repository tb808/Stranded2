import { describe, expect, it, vi } from "vitest";
import { GameApp } from "./GameApp";
import { Inventory, createInitialSurvivalState, type SurvivalState } from "../gameplay/model";
import type { BuildingState } from "../world/TropicalWorld";
import type { ItemId } from "../data/items";
import type { RuntimeSaveV1 } from "../save/runtimeSave";

interface TestApp {
  inventory: Inventory;
  survival: SurvivalState;
  toolDurability: Partial<Record<ItemId, number>>;
  craft(id: string, amount: number, bypass: boolean): void;
  useInventoryItem(id: string): void;
  interactBuilding(id: string): void;
  respawn(): void;
  restoreSave(save: RuntimeSaveV1): void;
}
function app(inventory: Inventory, building?: BuildingState): TestApp {
  return Object.assign(Object.create(GameApp.prototype) as TestApp, {
    inventory, survival: createInitialSurvivalState(), toolDurability: {},
    ui: { addToast: vi.fn(), showGame: vi.fn() },
    audio: { play: vi.fn() }, refreshUi: vi.fn(), saveGame: vi.fn(),
    world: { getBuilding: () => building }, selectedItemId: () => null,
    physics: { setPlayerEnabled: vi.fn(), setPlayerPosition: vi.fn() },
    createHudViewModel: vi.fn(), requestPointerLock: vi.fn(),
  });
}

describe("Spielmechaniken im GameApp", () => {
  it("bricht Crafting ohne Teilprodukte oder verjüngte Zutaten ab", () => {
    const inventory = new Inventory(2, [
      { itemId: "crab", quantity: 2, spoilageSecondsRemaining: 5 },
      { itemId: "bait", quantity: 15 },
    ]);
    const game = app(inventory);
    const before = inventory.slots;
    game.craft("bait", 1, true);
    expect(game.inventory.slots).toEqual(before);
  });
  it("repariert vorhandene Werkzeuge nicht durch Herstellung eines Ersatzes", () => {
    const game = app(new Inventory(24, [
      { itemId: "stone_knife", quantity: 1 }, { itemId: "stone", quantity: 1 }, { itemId: "fiber", quantity: 2 },
    ]));
    game.toolDurability.stone_knife = 3;
    game.craft("stone_knife", 1, true);
    expect(game.inventory.count("stone_knife")).toBe(2);
    expect(game.toolDurability.stone_knife).toBe(3);
  });
  it("isst die ausgewählte ältere Nahrung statt eines anderen Stapels", () => {
    const game = app(new Inventory(24, [
      { itemId: "mango", quantity: 1, spoilageSecondsRemaining: 500 },
      { itemId: "mango", quantity: 1, spoilageSecondsRemaining: 5 },
    ]));
    game.useInventoryItem("slot-1");
    expect(game.inventory.stacks).toEqual([{ itemId: "mango", quantity: 1, spoilageSecondsRemaining: 500 }]);
  });
  it("bewahrt fertiges Essen bei vollem Inventar und erlaubt Abholen ohne Feuer", () => {
    const fire: BuildingState = {
      id: "fire", type: "campfire", position: { x: 0, y: 0, z: 0 }, rotationY: 0,
      fireFuel: 0, cookingProgress: 30, cookingItem: "raw_meat", waterCharges: 0, waterProgress: 0,
    };
    const game = app(new Inventory(1, [{ itemId: "stone", quantity: 1 }]), fire);
    game.interactBuilding("fire");
    expect(fire.cookingProgress).toBe(30);
    expect(fire.cookingItem).toBe("raw_meat");
    game.inventory.remove("stone", 1);
    game.interactBuilding("fire");
    expect(game.inventory.count("cooked_meat")).toBe(1);
    expect(fire.cookingProgress).toBe(0);
    expect(fire.cookingItem).toBeUndefined();
  });
  it("behält beim Respawn die aktuelle Tageszeit", () => {
    const game = app(new Inventory());
    game.survival = { ...game.survival, health: 0, dayElapsedSeconds: 510 };
    game.respawn();
    expect(game.survival.health).toBe(100);
    expect(game.survival.dayElapsedSeconds).toBe(510);
  });
  it("setzt beim Laden eines tödlichen Spielstands die Gesundheit auf 50", () => {
    const game = app(new Inventory());
    Object.assign(game, {
      notebook: {}, preferredHotbarItem: null, equippedShirt: false, equippedBackpack: false,
      brackwaterSicknessSeconds: 0, poisonSecondsRemaining: 0, poisonCausedDeath: false,
      isBleeding: false, bleedingCausedDeath: false, previousFatigueLevel: null,
      foodSpoilageAccumulator: 0, toolDurability: {}, day: 1, playedSeconds: 0,
      yaw: 0, pitch: 0, spawnPoint: { x: 0, y: 0, z: 0 },
      world: { restore: vi.fn() },
    });
    const save: RuntimeSaveV1 = {
      schemaVersion: 1,
      contentVersion: "0.1.0",
      savedAtUnixMs: 1,
      day: 2,
      playedSeconds: 10,
      player: {
        position: { x: 1, y: 2, z: 3 },
        yaw: 0,
        pitch: 0,
        spawnPoint: { x: 1, y: 2, z: 3 },
        inventory: [],
        survival: { ...createInitialSurvivalState(), health: 0 },
        toolDurability: {},
      },
      world: {
        removedEntityIds: [], removedEntityDays: {}, buildings: [], raft: null,
        wreckLooted: false, sharkAlive: true, deathPacks: [], dynamicDrops: [],
      },
      deathPacks: [],
    };

    game.restoreSave(save);

    expect(game.survival.health).toBe(50);
  });
});

it('öffnet nach dem Tod das Hauptmenü ohne den letzten Spielstand zu überschreiben', async () => {
  const save = vi.fn();
  const finish = vi.fn();
  const game = Object.assign(Object.create(GameApp.prototype) as { returnToMenu(): Promise<void> }, {
    state: 'dead', saveGame: save, finishReturnToMenu: finish,
  });
  await game.returnToMenu();
  expect(save).not.toHaveBeenCalled();
  expect(finish).toHaveBeenCalledOnce();
});
it('zeigt bei tödlicher Blutung im Schlaf den Tod statt einer Erfolgsmeldung', async () => {
  const death = vi.fn();
  const toast = vi.fn();
  const save = vi.fn();
  const game = Object.assign(Object.create(GameApp.prototype) as { sleepInBed(): Promise<void> }, {
    survival: { ...createInitialSurvivalState(), health: 1, dayElapsedSeconds: 480 },
    sleeping: false, brackwaterSicknessSeconds: 0, poisonSecondsRemaining: 0, isBleeding: true,
    settings: { reducedMotion: true }, sleepTransition: { classList: { toggle: vi.fn(), add: vi.fn(), remove: vi.fn() } },
    waitForSleepTransition: async () => {}, advanceFoodSpoilage: vi.fn(),
    world: { advanceBuildingProduction: vi.fn() }, simulationTime: 0, day: 1,
    ui: { addToast: toast }, refreshUi: vi.fn(), handleDeath: death, saveGame: save,
  });
  await game.sleepInBed();
  expect(death).toHaveBeenCalledOnce();
  expect(toast).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it('macht Angel und Schaufel trotz vier anderer Werkzeuge auswählbar', () => {
  const game = Object.assign(Object.create(GameApp.prototype) as TestApp & { selectedItemId(): ItemId }, {
    inventory: new Inventory(24, (['stone_knife', 'stone_axe', 'wooden_spear', 'building_hammer', 'fishing_rod', 'shovel'] as ItemId[]).map(itemId => ({ itemId, quantity: 1 }))),
    preferredHotbarItem: null, selectedHotbarIndex: 0,
    ui: { addToast: vi.fn(), closePanel: vi.fn() }, refreshUi: vi.fn(), cancelBuild: vi.fn(),
  });
  game.useInventoryItem('slot-4');
  expect(game.selectedItemId()).toBe('fishing_rod');
  game.useInventoryItem('slot-5');
  expect(game.selectedItemId()).toBe('shovel');
  expect(game.inventory.usedSlots).toBe(6);
});
it('überschreibt den Spielstand auch vor dem Todesbildschirm nicht mit null Gesundheit', async () => {
  const createSave = vi.fn();
  const game = Object.assign(Object.create(GameApp.prototype) as { saveGame(): Promise<boolean> }, {
    physics: {}, world: {}, state: 'playing', sleeping: false,
    survival: { ...createInitialSurvivalState(), health: 0 }, createSave,
  });
  expect(await game.saveGame()).toBe(false);
  expect(createSave).not.toHaveBeenCalled();
});
