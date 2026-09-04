import {
  ACESFilmicToneMapping,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { AssetService } from "../assets/AssetService";
import { AudioService } from "../audio/AudioService";
import { FixedStepLoop } from "../core/FixedStepLoop";
import { clamp, type Vec3Like } from "../core/math";
import { supportsWebGl2 } from "../core/webgl";
import { BUILDABLE_CATALOG, CHEST_STORAGE_SLOTS, isBuildableId, type BuildableId } from "../data/buildables";
import { getMaxDurability, ITEM_CATALOG, type ItemId } from "../data/items";
import { getLoreLetter, LORE_LETTERS } from "../data/loreLetters";
import {
  craftingStationFor,
  RECIPE_CATALOG,
  RECIPE_IDS,
  type CraftingStation,
  type RecipeDefinition,
  type RecipeId,
} from "../data/recipes";
import { getIsland, WORLD_MANIFEST, type IslandId } from "../data/worldManifest";
import {
  Inventory,
  ExpeditionNotebook,
  DAY_LENGTH_SECONDS,
  POISON_DURATION_SECONDS,
  advanceBleeding,
  advancePoison,
  advanceSurvival,
  calculateSwimmingMotion,
  createInitialSurvivalState,
  formatFoodFreshness,
  getTimeOfDayFraction,
  getWeatherState,
  isNotebookAnimalId,
  weatherState,
  sleepUntilMorning,
  transferItems,
  type MovementActivity,
  type NotebookAnimalId,
  type SurvivalState,
  type WeatherKind,
  type WeatherState,
} from "../gameplay/model";
import { InputController, type InputSnapshot } from "../input/InputController";
import type { RapierPhysicsWorld } from "../physics/RapierPhysicsWorld";
import { FirstPersonToolView } from "../rendering/FirstPersonToolView";
import { IndexedDbSaveRepository } from "../save/IndexedDbSaveRepository";
import { IndexedDbSettingsRepository } from "../save/IndexedDbSettingsRepository";
import { isRuntimeSaveV1, type RuntimeSaveV1 } from "../save/runtimeSave";
import { createPersistedSettings, isPersistedSettingsV1, type PersistedSettingsV1 } from "../save/settings";
import {
  createUiController,
  type BuildViewModel,
  type CraftingViewModel,
  type HudViewModel,
  type InventoryViewModel,
  type NotebookViewModel,
  type RecipeViewModel,
  type SettingsViewModel,
  type StorageViewModel,
  type UiController,
  type UiPanel,
} from "../ui";
import { createBuildVisual, TropicalWorld, type LootStack } from "../world/TropicalWorld";

type AppState = "boot" | "menu" | "loading" | "playing" | "paused" | "dead" | "fatal";

const SETTINGS_KEY = "stranded2-settings-v1";
const DEFAULT_SETTINGS: SettingsViewModel = {
  quality: "high",
  audio: { master: 0.8, ambience: 0.72, effects: 0.82, ui: 0.7 },
  fov: 75,
  sensitivity: 1,
  reducedMotion: false,
};

const ITEM_ICONS: Partial<Record<ItemId, string>> = {
  fiber: "🌿",
  stick: "╱",
  stone: "⬟",
  palm_frond: "🌴",
  palm_log: "▰",
  coconut: "🥥",
  coconut_shell: "◒",
  crab: "🦀",
  cooked_crab: "🍖",
  raw_meat: "🥩",
  cooked_meat: "🍖",
  smoked_meat: "🥓",
  raw_fish: "🐟",
  cooked_fish: "🐟",
  spoiled_food: "🤢",
  bait: "🪱",
  mango: "🥭",
  healing_herb: "🌱",
  bandage: "🩹",
  simple_bandage: "🩹",
  herbal_antidote: "🧪",
  flower_tonic: "💗",
  whetstone: "🪨",
  cloth: "▧",
  metal_scrap: "⚙",
  obsidian_shard: "◆",
  reef_stone: "◉",
  wildflower: "🌸",
  lashing: "➰",
  portable_workbench: "🧰",
  campfire: "🔥",
  shelter: "⛺",
  bed: "🛏️",
  chest: "🧰",
  workbench: "🛠️",
  palm_still: "💧",
  rain_collector: "🌧️",
  fish_trap: "🎣",
  smoking_rack: "♨️",
  hut_foundation: "▦",
  hut_wall: "▥",
  hut_doorway: "🚪",
  hut_roof: "⌂",
  raft_base: "🛶",
  raft_deck: "≋",
  stone_knife: "🔪",
  obsidian_knife: "🗡️",
  stone_axe: "🪓",
  wooden_spear: "➤",
  building_hammer: "🔨",
  fishing_rod: "🎣",
  climbing_kit: "🧗",
  shovel_blueprint: "📐",
  shovel: "⛏️",
  giant_island_map: "🗺️",
  paddle: "🛶",
  woven_shirt: "👕",
  backpack: "🎒",
};

const NOTEBOOK_ANIMALS: Record<NotebookAnimalId, { label: string; iconText: string }> = {
  crab: { label: "Krabbe", iconText: "🦀" },
  fish: { label: "Fisch", iconText: "🐟" },
  wild_boar: { label: "Wildschwein", iconText: "🐗" },
  chicken: { label: "Huhn", iconText: "🐔" },
  turtle: { label: "Schildkröte", iconText: "🐢" },
  bird: { label: "Tropenvogel", iconText: "🦜" },
  crocodile: { label: "Krokodil", iconText: "🐊" },
  snake: { label: "Schlange", iconText: "🐍" },
  shark: { label: "Hai", iconText: "🦈" },
};

const BASE_INVENTORY_SLOTS = 24;
const BACKPACK_INVENTORY_SLOTS = 36;
const CAMPFIRE_WARMTH_RADIUS_METERS = 6;
const BRACKWATER_SICKNESS_DURATION_SECONDS = 50;
const BRACKWATER_SICKNESS_DAMAGE_PER_SECOND = 0.3;
const BRACKWATER_SICKNESS_THIRST_MULTIPLIER = 2.4;

type WarmthSource = "clothing" | "fire" | null;
type FatigueLevel = "rested" | "tired" | "exhausted";

export class GameApp {
  private readonly renderer: WebGLRenderer;
  private readonly camera = new PerspectiveCamera(75, 1, 0.08, 1_850);
  private readonly assets = new AssetService();
  private readonly audio = new AudioService(this.assets);
  private readonly saveRepository = new IndexedDbSaveRepository<RuntimeSaveV1>();
  private readonly settingsRepository = new IndexedDbSettingsRepository<PersistedSettingsV1>();
  private readonly ui: UiController;
  private readonly input: InputController;
  private readonly loop: FixedStepLoop;
  private readonly stage: HTMLElement;
  private readonly sleepTransition: HTMLElement;
  private readonly buildGhost = new Group();
  private readonly toolView = new FirstPersonToolView(this.assets);
  private physics: RapierPhysicsWorld | null = null;
  private world: TropicalWorld | null = null;
  private state: AppState = "boot";
  private inventory = new Inventory();
  private notebook = new ExpeditionNotebook();
  private survival: SurvivalState = createInitialSurvivalState();
  private settings: SettingsViewModel;
  private toolDurability: Partial<Record<ItemId, number>> = {};
  private selectedHotbarIndex = 0;
  private selectedBuild: BuildableId | null = null;
  private placementInventoryItemId: ItemId | null = null;
  private buildRotation = 0;
  private buildPlacementValid = false;
  private buildPlacementReason = "";
  private yaw = -Math.PI / 2;
  private pitch = 0;
  private day = 1;
  private playedSeconds = 0;
  private simulationTime = 0;
  private autosaveAccumulator = 0;
  private foodSpoilageAccumulator = 0;
  private uiAccumulator = 0;
  private footstepAccumulator = 0;
  private staticRenderAccumulator = 0;
  private spawnPoint: Vec3Like = { x: -8, y: 3, z: 0 };
  private onRaft = false;
  private mapOpen = false;
  private panelOpen: UiPanel | null = null;
  private activeChestId: string | null = null;
  private pointerWasLocked = false;
  private suppressPointerPause = false;
  private currentCraftCategory = "Alle";
  private craftingStation: CraftingStation = "hand";
  private openingWorkbench = false;
  private currentBuildCategory = "Alle";
  private preparingWorld = false;
  private underwater = false;
  private weather: WeatherState = getWeatherState(1, 0);
  private previousWeatherKind: WeatherKind | null = null;
  private weatherOverride: WeatherKind | null = null;
  private equippedShirt = false;
  private equippedBackpack = false;
  private isCold = false;
  private previousCold: boolean | null = null;
  private warmthSource: WarmthSource = null;
  private brackwaterSicknessSeconds = 0;
  private poisonSecondsRemaining = 0;
  private poisonCausedDeath = false;
  private isBleeding = false;
  private bleedingCausedDeath = false;
  private previousFatigueLevel: FatigueLevel | null = null;
  private toolViewMoving = false;
  private sleeping = false;
  private currentIslandId: IslandId | null = null;
  private lastStorageOperation: "load" | "save" = "save";
  private pendingSaveAction: {
    onSaved: () => void | Promise<void>;
    onSkipped: () => void | Promise<void>;
  } | null = null;

  public constructor(private readonly root: HTMLElement) {
    this.root.replaceChildren();
    this.stage = document.createElement("main");
    this.stage.className = "game-stage";
    this.stage.setAttribute("aria-label", "Stranded2 3D-Spielwelt");
    this.root.append(this.stage);

    this.sleepTransition = document.createElement("div");
    this.sleepTransition.className = "sleep-transition";
    this.sleepTransition.setAttribute("aria-hidden", "true");
    const upperEyelid = document.createElement("div");
    upperEyelid.className = "sleep-transition__lid sleep-transition__lid--upper";
    const lowerEyelid = document.createElement("div");
    lowerEyelid.className = "sleep-transition__lid sleep-transition__lid--lower";
    const darkness = document.createElement("div");
    darkness.className = "sleep-transition__darkness";
    this.sleepTransition.append(darkness, upperEyelid, lowerEyelid);
    this.root.append(this.sleepTransition);

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(new Color(0x06171c));
    this.renderer.domElement.className = "game-canvas";
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute("aria-label", "First-Person-Spielansicht. Klicken, um die Maussteuerung zu aktivieren.");
    this.stage.append(this.renderer.domElement);

    this.settings = loadSettings();
    this.ui = createUiController({
      root: this.root,
      initialSettings: this.settings,
      callbacks: {
        onContinue: () => void this.continueGame(),
        onNewGame: () => void this.newGame(),
        onRetryBoot: () => void this.bootstrap(),
        onOpenWebGlHelp: () => window.open("https://get.webgl.org/webgl2/", "_blank", "noopener,noreferrer"),
        onPauseRequested: () => void this.pauseGame(),
        onResume: () => this.resumeGame(),
        onReturnToMainMenu: () => void this.returnToMenu(),
        onReloadLastSave: () => void this.continueGame(),
        onRestartAfterDeath: () => this.respawn(),
        onPanelChanged: (panel) => this.handlePanelChanged(panel),
        onHotbarSelected: (index) => {
          this.selectedHotbarIndex = clamp(index, 0, 3);
          this.refreshUi();
        },
        onInventoryItemUsed: (id) => this.useInventoryItem(id),
        onInventoryItemDropped: (id) => this.dropInventoryItem(id),
        onInventoryStackMoved: (sourceIndex, targetIndex) => {
          if (this.inventory.moveStack(sourceIndex, targetIndex)) {
            this.refreshUi();
            void this.saveGame(false);
          }
        },
        onStorageDeposit: (id) => this.depositStorageItem(id),
        onStorageWithdraw: (id) => this.withdrawStorageItem(id),
        onCraftingCategorySelected: (category) => {
          this.currentCraftCategory = category;
          this.ui.updateCrafting(this.createCraftingViewModel());
        },
        onRecipeSelected: () => undefined,
        onCraftRequested: (recipeId, amount) => this.craft(recipeId as RecipeId, amount),
        onBuildCategorySelected: (category) => {
          this.currentBuildCategory = category;
          this.ui.updateBuild(this.createBuildViewModel());
        },
        onBuildSelected: (buildId) => this.selectBuild(buildId as BuildableId),
        onBuildCancelled: () => this.cancelBuild(),
        onSettingsChanged: (settings) => this.applySettings(settings),
        onStorageRetry: () => void this.retryStorageOperation(),
        onContinueWithoutSaving: () => {
          const pending = this.pendingSaveAction;
          this.pendingSaveAction = null;
          this.ui.dismissStorageError();
          if (pending) void pending.onSkipped();
        },
        onStorageErrorDismissed: () => {
          this.pendingSaveAction = null;
        },
      },
    });

    this.input = new InputController(this.renderer.domElement);
    this.input.attach();
    this.loop = new FixedStepLoop({
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      frameUpdate: (alpha, elapsed) => this.frameUpdate(alpha, elapsed),
    });
    this.loop.start();

    window.addEventListener("resize", this.resize);
    window.addEventListener("blur", this.onWindowBlur);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("pointerlockerror", this.onPointerLockError);
    this.renderer.domElement.addEventListener("click", this.onCanvasClick);
    this.renderer.domElement.addEventListener("webglcontextlost", this.onContextLost);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.onContextRestored);
    this.resize();
    this.applySettings(this.settings, false);
    this.installDebugApi();
  }

  public async bootstrap(): Promise<void> {
    this.state = "boot";
    this.ui.showBoot({ mode: "booting", title: "Stranded2", message: "Browser und Speicher werden vorbereitet …" });
    if (!supportsWebGl2()) {
      this.state = "fatal";
      this.ui.showFatalWebGl({
        title: "WebGL2 wird benötigt",
        message: "Dieser Browser oder Grafiktreiber stellt WebGL2 nicht bereit.",
        detail: "Aktualisiere den Browser und den Grafiktreiber oder aktiviere Hardwarebeschleunigung.",
        canRetry: true,
        canOpenHelp: true,
      });
      return;
    }

    try {
      this.ui.showLoading({ title: "Stranded2", message: "Lokale Assets werden geprüft …", progress: 0.15 });
      await this.assets.initialize();
      try {
        await this.settingsRepository.open();
        const persistedSettings = await this.settingsRepository.load(isPersistedSettingsV1);
        if (persistedSettings) this.applySettings(persistedSettings.settings, false);
        else await this.settingsRepository.save(createPersistedSettings(this.settings));
        localStorage.removeItem(SETTINGS_KEY);
      } catch (error) {
        console.warn("Einstellungen bleiben nur für diese Sitzung verfügbar.", error);
      }
      this.ui.showLoading({ title: "Stranded2", message: "Spielstände werden geprüft …", progress: 0.6 });
      let saveMeta = null;
      try {
        await this.saveRepository.open();
        saveMeta = await this.saveRepository.getMeta();
      } catch (error) {
        console.warn("Speichern ist in dieser Sitzung nicht verfügbar.", error);
      }
      this.state = "menu";
      this.ui.showMainMenu({
        canContinue: Boolean(saveMeta),
        ...(saveMeta
          ? { continueSummary: {
              slotId: "current",
              islandName: "Tropischer Archipel",
              playedFor: `Tag ${saveMeta.day}`,
              savedAt: new Date(saveMeta.savedAtUnixMs).toLocaleString("de-CH"),
            } }
          : {}),
        versionLabel: "Vertical Slice 0.1.0",
      });
    } catch (error) {
      this.state = "fatal";
      this.ui.showFatalWebGl({
        title: "Start fehlgeschlagen",
        message: "Die lokalen Spieldateien konnten nicht geladen werden.",
        detail: error instanceof Error ? error.message : String(error),
        canRetry: true,
      });
    }
  }

  public dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.ui.destroy();
    this.world?.dispose();
    this.physics?.dispose();
    this.audio.dispose();
    this.toolView.dispose();
    this.renderer.dispose();
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("blur", this.onWindowBlur);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("pointerlockerror", this.onPointerLockError);
  }

  private async newGame(): Promise<void> {
    if (this.preparingWorld) return;
    try {
      await this.saveRepository.deleteAll();
    } catch {
      // Eine blockierte IndexedDB soll den Start einer lokalen Sitzung nicht verhindern.
    }
    if (!(await this.prepareWorld())) return;
    this.inventory = new Inventory();
    this.notebook = new ExpeditionNotebook();
    this.survival = createInitialSurvivalState();
    this.toolDurability = {};
    this.equippedShirt = false;
    this.equippedBackpack = false;
    this.isCold = false;
    this.previousCold = null;
    this.warmthSource = null;
    this.brackwaterSicknessSeconds = 0;
    this.poisonSecondsRemaining = 0;
    this.poisonCausedDeath = false;
    this.isBleeding = false;
    this.bleedingCausedDeath = false;
    this.previousFatigueLevel = null;
    this.weatherOverride = null;
    this.weather = getWeatherState(1, 0);
    this.previousWeatherKind = this.weather.kind;
    this.day = 1;
    this.playedSeconds = 0;
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.onRaft = false;
    this.mapOpen = false;
    this.activeChestId = null;
    this.selectedBuild = null;
    this.placementInventoryItemId = null;
    this.autosaveAccumulator = 0;
    this.foodSpoilageAccumulator = 0;
    this.uiAccumulator = 0;
    this.spawnPoint = this.defaultSpawn();
    this.physics?.setPlayerPosition(this.spawnPoint);
    await this.beginPlaying();
    this.ui.addToast({ text: "Du bist gestrandet. M öffnet die Karte, N dein Expeditions-Notizbuch.", tone: "info", durationMs: 7_000 });
  }

  private async continueGame(): Promise<void> {
    if (this.preparingWorld) return;
    const result = await this.saveRepository.load(isRuntimeSaveV1);
    if (result.status !== "ok") {
      if (result.status === "missing") {
        this.ui.addToast({ text: "Kein Spielstand gefunden.", tone: "warning" });
        return;
      }
      this.lastStorageOperation = "load";
      this.ui.showStorageError({
        operation: "load",
        message: result.error,
        canRetry: true,
        canContinueWithoutSaving: result.status === "unavailable",
      });
      return;
    }
    if (!(await this.prepareWorld())) return;
    this.restoreSave(result.payload);
    await this.beginPlaying();
    this.ui.addToast({ text: result.source === "backup" ? "Backup-Spielstand geladen." : "Spielstand geladen.", tone: "success" });
  }

  private async prepareWorld(): Promise<boolean> {
    this.preparingWorld = true;
    this.state = "loading";
    this.exitPointerLock();
    this.ui.showLoading({ title: "Archipel wird aufgebaut", message: "Physik wird initialisiert …", progress: 0.05 });
    try {
      this.world?.dispose();
      this.physics?.dispose();
      this.world = null;
      this.physics = null;
      this.onRaft = false;
      this.mapOpen = false;
      const { RapierPhysicsWorld } = await import("../physics/RapierPhysicsWorld");
      this.physics = new RapierPhysicsWorld();
      await this.physics.initialize();
      this.world = new TropicalWorld(this.physics, this.assets);
      await this.world.initialize((progress) => {
        this.ui.showLoading({
          title: "Archipel wird aufgebaut",
          message: progress < 0.55 ? "Tropische Modelle werden vorbereitet …" : "Inseln und Ressourcen werden verteilt …",
          progress: 0.1 + progress * 0.86,
        });
      });
      this.world.setQuality(this.settings.quality);
      this.physics.createPlayer(this.defaultSpawn());
      this.buildGhost.clear();
      this.world.scene.add(this.buildGhost);
      return true;
    } catch (error) {
      this.world?.dispose();
      this.physics?.dispose();
      this.world = null;
      this.physics = null;
      this.state = "fatal";
      this.ui.showFatalWebGl({
        title: "Inselwelt konnte nicht aufgebaut werden",
        message: "Die 3D-Welt oder ihre Physikdateien konnten nicht initialisiert werden.",
        detail: error instanceof Error ? error.message : String(error),
        canRetry: true,
      });
      return false;
    } finally {
      this.preparingWorld = false;
    }
  }

  private async beginPlaying(): Promise<void> {
    this.state = "playing";
    this.panelOpen = null;
    this.activeChestId = null;
    const position = this.physics?.getPlayerPosition();
    this.currentIslandId = position ? this.world?.getIslandAt(position.x, position.z)?.id ?? null : null;
    if (this.currentIslandId) this.notebook.visitIsland(this.currentIslandId, this.day);
    this.ui.showGame(this.createHudViewModel());
    this.refreshUi();
    await this.audio.unlock();
    this.audio.startOceanAmbience();
    this.requestPointerLock();
  }

  private fixedUpdate(dt: number): void {
    const physics = this.physics;
    const world = this.world;
    const input = this.input.consume();
    if (!physics || !world || this.state !== "playing" || this.panelOpen || this.sleeping) return;
    this.simulationTime += dt;

    this.yaw -= input.lookDeltaX;
    this.pitch = clamp(this.pitch - input.lookDeltaY, -1.45, 1.45);

    if (input.pressed.has("inventory")) this.ui.openPanel("inventory");
    if (input.pressed.has("map")) {
      this.mapOpen = !this.mapOpen;
      this.refreshUi();
    }
    if (input.pressed.has("rotate") && this.selectedBuild) {
      this.buildRotation += this.selectedBuild.startsWith("hut_") ? Math.PI / 2 : Math.PI / 8;
    }
    this.handleHotbarKeys(input);

    const playerPosition = physics.getPlayerPosition();
    const deepWater = world.isDeepWater(playerPosition.x, playerPosition.z);
    const swimming = deepWater && playerPosition.y < 1.1 && !this.onRaft;
    this.underwater = swimming && playerPosition.y < -0.72;
    const movement = this.createMovement(input, swimming);
    this.toolViewMoving = movement.activity !== "idle";

    if (this.onRaft) {
      const raft = world.getRaft();
      if (raft) {
        const throttle = (input.held.has("forward") ? 1 : 0) - (input.held.has("backward") ? 1 : 0);
        const steering = (input.held.has("left") ? 1 : 0) - (input.held.has("right") ? 1 : 0);
        physics.applyRaftControl(raft.id, throttle, steering, this.inventory.count("paddle") > 0 && raft.durability > 0);
      }
      if (input.pressed.has("interact")) this.disembarkRaft();
    } else {
      physics.movePlayer(movement.motion, dt);
      if (input.pressed.has("interact")) this.interact();
      if (input.pressed.has("workbench")) this.useWorkbench();
      if (input.pressed.has("attack") && !this.mapOpen) {
        this.toolView.triggerUse();
        if (this.selectedBuild) this.placeSelectedBuild();
        else this.attack();
      }
    }

    this.weather = this.weatherOverride
      ? weatherState(this.weatherOverride)
      : getWeatherState(this.day, this.survival.dayElapsedSeconds);
    this.audio.setOceanIntensity(this.weather.kind === "storm" ? 1 : this.weather.kind === "rain" ? 0.62 : this.weather.kind === "heat" ? 0.14 : 0.32);
    this.notifyWeatherTransition();
    this.warmthSource = this.equippedShirt
      ? "clothing"
      : world.findNearestLitCampfire(playerPosition, CAMPFIRE_WARMTH_RADIUS_METERS)
        ? "fire"
        : null;
    this.isCold = this.weather.isRaining && this.warmthSource === null;
    this.notifyColdTransition();
    const oldDayElapsed = this.survival.dayElapsedSeconds;
    const volcanicHeat = world.getVolcanicHeatLevel(playerPosition);
    const cliffWind = world.getCliffWindLevel(playerPosition);
    const weatherThirstMultiplier = this.underwater
      ? 1
      : this.weather.kind === "heat" && this.equippedShirt
        ? 1.45
        : this.weather.thirstDrainMultiplier;
    const volcanicThirstMultiplier = this.underwater
      ? 1
      : volcanicHeat === 2
        ? this.equippedShirt ? 1.9 : 3.2
        : volcanicHeat === 1
          ? this.equippedShirt ? 1.35 : 2.1
          : 1;
    this.survival = advanceSurvival(this.survival, dt, {
      movement: movement.activity,
      isUnderwater: this.underwater,
      thirstDrainMultiplier: weatherThirstMultiplier * volcanicThirstMultiplier * (this.brackwaterSicknessSeconds > 0 ? BRACKWATER_SICKNESS_THIRST_MULTIPLIER : 1),
      isCold: this.isCold,
    });
    this.notifyFatigueTransition();
    if (cliffWind > 0 && !this.underwater) this.patchVitals({
      stamina: Math.max(0, this.survival.stamina - dt * (cliffWind === 2 ? 4.5 : 2)),
      staminaRegenDelayRemaining: Math.max(this.survival.staminaRegenDelayRemaining, 0.35),
    });
    if (this.brackwaterSicknessSeconds > 0) {
      const previousSicknessSeconds = this.brackwaterSicknessSeconds;
      const activeSeconds = Math.min(dt, previousSicknessSeconds);
      this.brackwaterSicknessSeconds = Math.max(0, previousSicknessSeconds - dt);
      this.patchVitals({
        health: Math.max(0, this.survival.health - activeSeconds * BRACKWATER_SICKNESS_DAMAGE_PER_SECOND),
      });
      if (previousSicknessSeconds > 0 && this.brackwaterSicknessSeconds === 0) {
        this.ui.addToast({ text: "Die Brackwasserkrankheit klingt ab.", tone: "success" });
      }
    }
    this.advancePoisonCondition(dt);
    this.advanceBleedingCondition(dt);
    this.foodSpoilageAccumulator += dt;
    if (this.foodSpoilageAccumulator >= 1) {
      const elapsedSpoilageSeconds = Math.floor(this.foodSpoilageAccumulator);
      this.foodSpoilageAccumulator -= elapsedSpoilageSeconds;
      this.advanceFoodSpoilage(elapsedSpoilageSeconds);
    }
    if (this.survival.dayElapsedSeconds < oldDayElapsed) this.day += 1;
    this.playedSeconds += dt;
    this.autosaveAccumulator += dt;
    this.uiAccumulator += dt;
    this.footstepAccumulator += dt;

    physics.step(dt, this.simulationTime);
    if (this.onRaft) this.anchorPlayerToRaft();

    const updatedPosition = physics.getPlayerPosition();
    this.updateIslandDiscovery(updatedPosition);
    const timeOfDay = getTimeOfDayFraction(this.survival.dayElapsedSeconds);
    const playerNoise = input.pressed.has("attack")
      ? 1
      : input.pressed.has("interact")
        ? 0.72
        : input.pressed.has("workbench")
          ? 0.4
        : movement.activity === "sprint"
          ? 0.82
          : movement.activity === "walk"
            ? 0.28
            : 0;
    const events = world.update(
      dt,
      this.simulationTime,
      this.day,
      timeOfDay,
      updatedPosition,
      swimming,
      this.onRaft,
      this.underwater,
      this.weather,
      playerNoise,
    );
    for (const event of events) {
      if (event.type === "player-damage") this.damagePlayer(event.amount, event.text, event.causesBleeding);
      else if (event.type === "player-poison") this.poisonPlayer(event.text);
      else if (event.type === "raft-damage") {
        world.damageRaft(event.amount);
        this.ui.addToast({ text: event.text, tone: "danger" });
      } else this.ui.addToast({ text: event.text, tone: "info" });
    }

    if (movement.activity === "sprint" && this.footstepAccumulator > 0.38 && physics.isPlayerGrounded()) {
      this.footstepAccumulator = 0;
      void this.audio.play("sfx.footstep-grass-1", "sfx", 0.18);
    }
    if (this.survival.health <= 0 && this.state === "playing") this.handleDeath();
    if (this.autosaveAccumulator >= 60) {
      this.autosaveAccumulator = 0;
      void this.saveGame(false);
    }
    if (this.uiAccumulator >= 0.1) {
      this.uiAccumulator = 0;
      this.discoverNearbyWildlife(updatedPosition);
      this.refreshUi();
    }
  }

  private frameUpdate(_alpha: number, elapsed: number): void {
    const world = this.world;
    const physics = this.physics;
    if (!world || !physics) {
      this.renderer.clear();
      return;
    }
    if (this.state !== "playing" || this.panelOpen) {
      this.staticRenderAccumulator += elapsed;
      if (this.staticRenderAccumulator < 0.2) return;
      this.staticRenderAccumulator = 0;
    } else this.staticRenderAccumulator = 0;
    const position = physics.getPlayerPosition();
    if (this.onRaft) {
      const raft = world.getRaft();
      const pose = raft ? physics.getRaftPose(raft.id) : null;
      if (pose) this.camera.position.set(pose.position.x, pose.position.y + 1.55, pose.position.z);
    } else {
      this.camera.position.set(position.x, position.y + 0.62, position.z);
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.updateBuildGhost();
    const heldItem = this.state === "playing" && !this.panelOpen && !this.mapOpen ? this.heldItemId() : null;
    this.toolView.update(heldItem, elapsed, this.toolViewMoving, this.settings.reducedMotion);
    this.renderer.render(world.scene, this.camera);
    this.toolView.render(this.renderer);
  }

  private createMovement(input: InputSnapshot, swimming: boolean): { motion: { x: number; z: number; vertical: number; swimming: boolean }; activity: MovementActivity } {
    const forward = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const direction = new Vector3();
    if (input.held.has("forward")) direction.add(forward);
    if (input.held.has("backward")) direction.sub(forward);
    if (input.held.has("right")) direction.add(right);
    if (input.held.has("left")) direction.sub(right);
    if (direction.lengthSq() > 1) direction.normalize();
    const forwardAxis = (input.held.has("forward") ? 1 : 0) - (input.held.has("backward") ? 1 : 0);
    const rightAxis = (input.held.has("right") ? 1 : 0) - (input.held.has("left") ? 1 : 0);
    const hasMovementInput = forwardAxis !== 0 || rightAxis !== 0;
    const sprinting = input.held.has("sprint") && this.survival.stamina > 0 && this.survival.fatigue < 80 && hasMovementInput;
    const fatigueSpeedMultiplier = this.survival.fatigue >= 80 ? 0.7 : this.survival.fatigue >= 50 ? 0.85 : 1;
    const speed = (swimming ? (sprinting ? 3.5 : 2.35) : sprinting ? 6.4 : 4.1) * fatigueSpeedMultiplier;
    let vertical = 0;
    if (swimming) {
      const buoyancy = clamp((0.55 - (this.physics?.getPlayerPosition().y ?? 0.55)) * 2.2, -1.2, 1.2);
      const swimMotion = calculateSwimmingMotion({
        yaw: this.yaw,
        pitch: this.pitch,
        forwardAxis,
        rightAxis,
        speed,
        buoyancy,
        ascend: input.held.has("jump"),
        descend: input.held.has("dive"),
      });
      return {
        motion: { ...swimMotion, swimming: true },
        activity: sprinting ? "fast-swim" : "swim",
      };
    } else if (input.pressed.has("jump") && this.physics?.isPlayerGrounded()) vertical = 5.2;
    const activity: MovementActivity = swimming ? (sprinting ? "fast-swim" : "swim") : sprinting ? "sprint" : direction.lengthSq() > 0 ? "walk" : "idle";
    return { motion: { x: direction.x * speed, z: direction.z * speed, vertical, swimming }, activity };
  }

  private interact(): void {
    const world = this.world;
    const physics = this.physics;
    if (!world || !physics) return;
    const target = world.getLookTarget(this.camera, 4);
    if (!target) return;

    if (target.kind === "raft") {
      const raft = world.getRaft();
      if (raft && raft.durability < 100 && this.selectedItemId() === "building_hammer") {
        if (this.inventory.remove("stick", 1).removed === 1) {
          world.repairRaft(25);
          this.damageTool("building_hammer", 1);
          this.ui.addToast({ text: `Floß repariert (${Math.round(world.getRaft()?.durability ?? 100)} %).`, tone: "success" });
          void this.audio.play("sfx.impact-wood-heavy", "sfx", 0.35);
        } else {
          this.ui.addToast({ text: "Zum Reparieren brauchst du einen Stock.", tone: "warning" });
        }
        this.refreshUi();
        return;
      }
      if (!raft?.hasDeck) {
        this.ui.addToast({ text: "Die Floßbasis braucht zuerst ein Deck.", tone: "warning" });
        return;
      }
      if (raft.durability <= 0) {
        this.ui.addToast({ text: "Das Floß ist zu stark beschädigt. Wähle den Bauhammer und repariere es mit einem Stock.", tone: "warning" });
        return;
      }
      if (this.inventory.count("paddle") === 0) {
        this.ui.addToast({ text: "Zum Fahren brauchst du ein Paddel.", tone: "warning" });
        return;
      }
      this.onRaft = true;
      physics.setPlayerEnabled(false);
      this.ui.addToast({ text: "Floßsteuerung: W/S paddeln, A/D lenken, E aussteigen.", tone: "info", durationMs: 6_000 });
      return;
    }

    if (target.kind === "building") {
      this.interactBuilding(target.id);
      return;
    }
    if (target.kind === "lore_letter") {
      this.openLoreLetter(target.id);
      return;
    }
    if (target.kind === "climbing_anchor") {
      this.climbMountain(target.id);
      return;
    }
    if (target.kind === "signal_beacon") {
      const cost = [{ itemId: "stick" as const, quantity: 2 }, { itemId: "cloth" as const, quantity: 1 }];
      if (!this.inventory.canConsume(cost)) {
        this.ui.addToast({ text: "Für ein Windsignal brauchst du 2× Stock und 1× Stoff.", tone: "warning" });
        return;
      }
      const signal = world.activateSignalBeacon(target.id);
      if (signal.success) this.inventory.consume(cost);
      this.ui.addToast({ text: signal.message, tone: signal.success ? "success" : "warning", durationMs: 5_500 });
      this.refreshUi();
      return;
    }
    if (target.kind === "buried_chest" && !world.isBuriedChestDug()) {
      if (this.selectedItemId() !== "shovel") {
        this.ui.addToast({ text: "Wähle die Schaufel im Schnellzugriff aus, um die Truhe freizulegen.", tone: "warning" });
        return;
      }
      this.toolView.triggerUse();
      const digging = world.digBuriedChest(target.id);
      if (digging.success) {
        this.damageTool("shovel", 2);
        void this.audio.play("sfx.impact-generic-light", "sfx", 0.42);
      }
      this.ui.addToast({ text: digging.message, tone: digging.success ? "success" : "warning", durationMs: 5_500 });
      this.refreshUi();
      return;
    }
    const outcome = world.collect(target.id);
    if (target.kind === "freshwater" && outcome.success) {
      const restorative = target.id.startsWith("wasserfallinsel-");
      this.patchVitals({
        thirst: 100,
        ...(restorative ? {
          health: Math.min(100, this.survival.health + 10),
          stamina: this.survival.maxStamina,
        } : {}),
      });
      this.ui.addToast({
        text: restorative ? "Das klare Wasser stillt den Durst, heilt 10 Gesundheit und füllt deine Ausdauer." : outcome.message,
        tone: "success",
      });
      return;
    }
    if (target.kind === "brackwater" && outcome.success) {
      this.drinkBrackwater(outcome.message);
      return;
    }
    if (outcome.success) {
      this.addLoot(outcome.loot);
      void this.audio.play("ui.confirm", "ui", 0.35);
    }
    this.ui.addToast({ text: outcome.message, tone: outcome.success ? "success" : "warning" });
  }

  private useWorkbench(): void {
    const world = this.world;
    if (!world) return;
    const target = world.getLookTarget(this.camera, 4);
    if (!target || target.kind !== "building") return;
    const building = world.getBuilding(target.id);
    if (!building || building.type !== "workbench") return;
    this.openWorkbenchCrafting();
  }

  private openWorkbenchCrafting(): void {
    this.craftingStation = "workbench";
    this.currentCraftCategory = "Alle";
    this.openingWorkbench = true;
    this.ui.updateCrafting(this.createCraftingViewModel());
    this.ui.openPanel("crafting");
  }

  private interactBuilding(id: string): void {
    const world = this.world;
    const building = world?.getBuilding(id);
    if (!world || !building) return;
    if (building.type === "shelter") {
      this.spawnPoint = { x: building.position.x, y: building.position.y + 1.1, z: building.position.z + 2 };
      this.ui.addToast({ text: "Schutzdach als Respawnpunkt gesetzt.", tone: "success" });
      void this.saveGame(false);
    } else if (building.type === "bed") {
      void this.sleepInBed();
    } else if (building.type === "chest") {
      this.activeChestId = building.id;
      this.ui.updateStorage(this.createStorageViewModel());
      this.ui.openPanel("storage");
    } else if (building.type === "palm_still" || building.type === "rain_collector") {
      if (building.waterCharges <= 0) this.ui.addToast({
        text: building.type === "rain_collector" && !this.weather.isRaining
          ? "Der Regenfänger ist leer. Er füllt sich beim nächsten Regen."
          : `${building.type === "rain_collector" ? "Der Regenfänger" : "Die Destille"} sammelt Wasser (${Math.round((building.waterProgress / 360) * 100)} %).`,
        tone: "info",
      });
      else {
        building.waterCharges -= 1;
        this.patchVitals({ thirst: Math.min(100, this.survival.thirst + 20) });
        this.ui.addToast({ text: "Du trinkst eine Portion sauberes Wasser.", tone: "success" });
      }
    } else if (building.type === "fish_trap") {
      const stored = building.fishTrapStored ?? 0;
      if (stored > 0) {
        const result = this.inventory.add("raw_fish", stored);
        building.fishTrapStored = stored - result.added;
        if (result.added > 0) this.recordLootDiscoveries([{ itemId: "raw_fish", count: result.added }]);
        this.ui.addToast({
          text: result.added > 0 ? `${result.added}× rohen Fisch aus der Reuse genommen.` : "Im Inventar ist kein Platz für den Fang.",
          tone: result.added > 0 ? "success" : "warning",
        });
      } else if (building.fishTrapBaited) {
        const progress = Math.min(100, Math.round(((building.fishTrapProgress ?? 0) / 120) * 100));
        this.ui.addToast({ text: `Die beköderte Reuse arbeitet (${progress} %).`, tone: "info" });
      } else if (this.inventory.remove("bait", 1).removed === 1) {
        building.fishTrapBaited = true;
        building.fishTrapProgress = 0;
        this.ui.addToast({ text: "Fischreuse beködert. Ein Fang dauert ungefähr zwei Minuten.", tone: "success" });
      } else {
        this.ui.addToast({ text: "Die Fischreuse braucht einen Fischköder.", tone: "warning" });
      }
    } else if (building.type === "smoking_rack") {
      const ready = building.smokerReadyCount ?? 0;
      const input = building.smokerInputCount ?? 0;
      if (ready > 0) {
        const result = this.inventory.add("smoked_meat", ready);
        building.smokerReadyCount = ready - result.added;
        this.ui.addToast({
          text: result.added > 0 ? `${result.added}× Räucherfleisch vom Gestell genommen.` : "Im Inventar ist kein Platz für das Räucherfleisch.",
          tone: result.added > 0 ? "success" : "warning",
        });
      } else if (input > 0) {
        const progress = Math.min(100, Math.round(((building.smokerProgress ?? 0) / 90) * 100));
        this.ui.addToast({ text: `Das Fleisch räuchert (${progress} %).`, tone: "info" });
      } else if (this.inventory.canConsume([{ itemId: "raw_meat", quantity: 3 }, { itemId: "stick", quantity: 1 }])) {
        this.inventory.consume([{ itemId: "raw_meat", quantity: 3 }, { itemId: "stick", quantity: 1 }]);
        building.smokerInputCount = 3;
        building.smokerProgress = 0;
        this.ui.addToast({ text: "Drei Stück Fleisch hängen im Rauch. Die Charge dauert ungefähr 90 Sekunden.", tone: "success" });
      } else {
        this.ui.addToast({ text: "Für eine Räuchercharge brauchst du 3× rohes Fleisch und 1× Stock.", tone: "warning" });
      }
    } else if (building.type === "campfire") {
      if (building.fireFuel <= 0) {
        if (this.inventory.remove("stick", 1).removed === 1) {
          building.fireFuel += 60;
          this.ui.addToast({ text: "Ein Stock hält das Feuer weitere 60 Sekunden am Brennen.", tone: "success" });
        } else this.ui.addToast({ text: "Das Feuer ist aus. Du brauchst einen Stock.", tone: "warning" });
      } else if (building.cookingProgress >= (building.cookingItem === "raw_meat" ? 30 : building.cookingItem === "raw_fish" ? 20 : 25)) {
        const cookedItem = building.cookingItem === "raw_meat" ? "cooked_meat" : building.cookingItem === "raw_fish" ? "cooked_fish" : "cooked_crab";
        building.cookingProgress = 0;
        delete building.cookingItem;
        this.inventory.add(cookedItem, 1);
        this.ui.addToast({ text: cookedItem === "cooked_meat" ? "Gegrilltes Fleisch vom Feuer genommen." : cookedItem === "cooked_fish" ? "Gegrillten Fisch vom Feuer genommen." : "Gekochte Krabbe vom Feuer genommen.", tone: "success" });
      } else if (building.cookingProgress > 0) {
        const duration = building.cookingItem === "raw_meat" ? 30 : building.cookingItem === "raw_fish" ? 20 : 25;
        const label = building.cookingItem === "raw_meat" ? "Das Fleisch" : building.cookingItem === "raw_fish" ? "Der Fisch" : "Die Krabbe";
        this.ui.addToast({ text: `${label} gart (${Math.min(100, Math.round((building.cookingProgress / duration) * 100))} %).`, tone: "info" });
      } else {
        const selected = this.selectedItemId();
        const cookingItem = selected === "raw_meat" || selected === "raw_fish" || selected === "crab"
          ? selected
          : this.inventory.count("raw_meat") > 0
            ? "raw_meat"
            : this.inventory.count("raw_fish") > 0
              ? "raw_fish"
            : this.inventory.count("crab") > 0
              ? "crab"
              : null;
        if (cookingItem && this.inventory.remove(cookingItem, 1).removed === 1) {
          building.cookingItem = cookingItem;
          building.cookingProgress = 0.001;
          this.ui.addToast({ text: cookingItem === "raw_meat" ? "Rohes Fleisch auf den Grill gelegt." : cookingItem === "raw_fish" ? "Rohen Fisch auf den Grill gelegt." : "Rohe Krabbe auf das Feuer gelegt.", tone: "success" });
        } else this.ui.addToast({ text: "Halte rohes Fleisch, einen rohen Fisch oder eine rohe Krabbe bereit.", tone: "info" });
      }
    } else if (building.type === "workbench") {
      if (this.selectedItemId() === "building_hammer") {
        const stored = this.inventory.add("portable_workbench", 1);
        if (stored.remainder > 0) {
          this.ui.addToast({ text: "Im Inventar ist kein freier Platz für die Werkbank.", tone: "warning" });
        } else if (!world.pickupWorkbench(id)) {
          this.inventory.remove("portable_workbench", 1);
          this.ui.addToast({ text: "Die Werkbank konnte nicht aufgehoben werden.", tone: "warning" });
        } else {
          void this.audio.play("sfx.impact-wood-heavy", "sfx", 0.32);
          this.ui.addToast({ text: "Werkbank eingepackt und ins Inventar gelegt.", tone: "success" });
          void this.saveGame(false);
        }
        this.refreshUi();
        return;
      }
      this.ui.addToast({ text: "Werkbank mit F benutzen. Zum Aufheben Bauhammer auswählen und E drücken.", tone: "info" });
    }
    this.refreshUi();
  }

  private async sleepInBed(): Promise<void> {
    if (this.sleeping) return;
    const result = sleepUntilMorning(this.survival);
    if (!result.slept) {
      this.ui.addToast({ text: "Du kannst zwischen 18:00 und 03:00 Uhr schlafen.", tone: "info" });
      return;
    }

    this.sleeping = true;
    const reducedMotion = this.settings.reducedMotion;
    this.sleepTransition.classList.toggle("sleep-transition--reduced", reducedMotion);
    this.sleepTransition.classList.add("sleep-transition--active");
    await this.waitForSleepTransition(reducedMotion ? 160 : 760);

    this.survival = result.state;
    this.previousFatigueLevel = "rested";
    this.advancePoisonCondition(result.skippedSeconds);
    this.advanceBleedingCondition(result.skippedSeconds);
    this.advanceFoodSpoilage(result.skippedSeconds);
    this.day += 1;
    this.weather = this.weatherOverride
      ? weatherState(this.weatherOverride)
      : getWeatherState(this.day, this.survival.dayElapsedSeconds);
    this.previousWeatherKind = this.weather.kind;
    this.refreshUi();

    await this.waitForSleepTransition(reducedMotion ? 300 : 1_040);
    this.sleepTransition.classList.remove("sleep-transition--active", "sleep-transition--reduced");
    this.sleeping = false;
    const wakeMinutes = Math.round(getTimeOfDayFraction(this.survival.dayElapsedSeconds) * 24 * 60) % (24 * 60);
    const wakeTime = `${String(Math.floor(wakeMinutes / 60)).padStart(2, "0")}:${String(wakeMinutes % 60).padStart(2, "0")}`;
    this.ui.addToast({ text: `Du wachst um ${wakeTime} Uhr vollständig erholt auf.`, tone: "success" });
    void this.saveGame(false);
  }

  private waitForSleepTransition(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  private openLoreLetter(id: string): boolean {
    const letter = getLoreLetter(id);
    if (!letter || (this.state !== "playing" && this.state !== "paused")) return false;
    const discovered = this.notebook.discoverLetter(letter.id);
    this.notebook.visitIsland(letter.islandId, this.day);
    this.ui.updateNotebook(this.createNotebookViewModel());
    if (discovered) void this.saveGame(false);
    this.state = "paused";
    this.exitPointerLock();
    this.ui.showLetter({ ...letter, total: LORE_LETTERS.length });
    void this.audio.play("ui.confirm", "ui", 0.28);
    return true;
  }

  private climbMountain(id: string): boolean {
    const world = this.world;
    const physics = this.physics;
    if (!world || !physics) return false;
    if (this.inventory.count("climbing_kit") === 0) {
      this.ui.addToast({ text: "Du brauchst ein Kletterset für diesen Seilanker.", tone: "warning" });
      return false;
    }
    const outcome = world.useClimbingAnchor(id);
    if (!outcome.success || !outcome.destination) {
      this.ui.addToast({ text: outcome.message, tone: "warning" });
      return false;
    }
    if (this.survival.stamina < outcome.staminaCost) {
      this.ui.addToast({ text: `Zu erschöpft: Der Aufstieg kostet ${outcome.staminaCost} Ausdauer.`, tone: "warning" });
      return false;
    }
    this.patchVitals({
      stamina: this.survival.stamina - outcome.staminaCost,
      staminaRegenDelayRemaining: Math.max(this.survival.staminaRegenDelayRemaining, 1),
    });
    physics.setPlayerPosition(outcome.destination);
    this.damageTool("climbing_kit", 1);
    void this.audio.play("ui.confirm", "ui", 0.38);
    this.ui.addToast({ text: outcome.message, tone: "success", durationMs: outcome.reachesSummit ? 7_000 : 4_500 });
    this.refreshUi();
    return true;
  }

  private attack(): void {
    const tool = this.selectedItemId();
    if (tool === "fishing_rod") {
      if (this.inventory.count("bait") <= 0) {
        this.ui.addToast({ text: "Zum Angeln brauchst du Fischköder.", tone: "warning" });
        return;
      }
      const fishingOutcome = this.world?.fish(this.camera) ?? { hit: false };
      if (fishingOutcome.hit) {
        this.inventory.remove("bait", 1);
        this.damageTool("fishing_rod", 1);
        if (fishingOutcome.loot) this.addLoot(fishingOutcome.loot);
        void this.audio.play("ui.confirm", "ui", 0.32);
      }
      if (fishingOutcome.message) this.ui.addToast({ text: fishingOutcome.message, tone: fishingOutcome.hit ? "success" : "warning" });
      this.refreshUi();
      return;
    }
    const observedTarget = this.world?.getLookTarget(this.camera, tool === "wooden_spear" ? 3.4 : 2.5);
    if (observedTarget && isNotebookAnimalId(observedTarget.kind)) {
      this.recordAnimalDiscovery(observedTarget.kind);
    }
    const outcome = this.world?.attack(this.camera, tool) ?? { hit: false };
    if (outcome.hit && tool) this.damageTool(tool, 1);
    if (outcome.loot) this.addLoot(outcome.loot);
    if (outcome.message) this.ui.addToast({ text: outcome.message, tone: outcome.hit ? "success" : "warning" });
    if (outcome.hit) void this.audio.play(tool === "stone_axe" ? "sfx.impact-wood-heavy" : "sfx.impact-generic-light", "sfx", 0.4);
  }

  private craft(recipeId: RecipeId, amount: number, bypassStation = false): void {
    const recipe: RecipeDefinition = RECIPE_CATALOG[recipeId];
    if (!recipe) return;
    if (recipe.requiredBlueprint && this.inventory.count(recipe.requiredBlueprint) === 0) {
      this.ui.addToast({ text: `Dafür musst du zuerst den ${ITEM_CATALOG[recipe.requiredBlueprint].label} finden.`, tone: "warning" });
      return;
    }
    const count = clamp(Math.floor(amount), 1, 10);
    if (!bypassStation && craftingStationFor(recipe) === "workbench" && (this.craftingStation !== "workbench" || !this.isNearWorkbench())) {
      this.ui.addToast({ text: "Dieses Rezept kann nur direkt an einer Werkbank hergestellt werden.", tone: "warning" });
      return;
    }
    let crafted = 0;
    for (let index = 0; index < count; index += 1) {
      if (!this.inventory.consume(recipe.ingredients)) break;
      const outputItemId = recipe.output.kind === "buildable" ? recipe.output.buildableId : recipe.output.itemId;
      const result = this.inventory.add(outputItemId, recipe.output.quantity);
      if (result.remainder > 0) {
        this.addLoot(recipe.ingredients, false);
        break;
      }
      const maxDurability = getMaxDurability(outputItemId);
      if (maxDurability) this.toolDurability[outputItemId] = maxDurability;
      crafted += 1;
    }
    this.ui.addToast({ text: crafted > 0 ? `${crafted}× ${recipe.label} hergestellt.` : "Nicht genug Material oder Inventarplatz.", tone: crafted > 0 ? "success" : "warning" });
    if (crafted > 0) void this.audio.play("ui.confirm", "ui", 0.35);
    this.refreshUi();
  }

  private selectBuild(buildId: BuildableId): void {
    if (this.inventory.count(buildId) === 0) {
      this.ui.addToast({ text: `Stelle zuerst den ${ITEM_CATALOG[buildId].label} her.`, tone: "warning" });
      return;
    }
    if (this.inventory.count("building_hammer") === 0) {
      this.ui.addToast({ text: "Zum Bauen brauchst du einen Bauhammer.", tone: "warning" });
      return;
    }
    this.beginBuildPlacement(buildId, buildId);
  }

  private beginBuildPlacement(buildId: BuildableId, inventoryItemId: ItemId): void {
    this.selectedBuild = buildId;
    this.placementInventoryItemId = inventoryItemId;
    // A newly placed raft should point away from the player in the direction
    // they are looking. Otherwise its fixed world-space heading makes forward
    // input run along many shorelines instead of out to sea.
    this.buildRotation = buildId === "raft_base" ? this.yaw + Math.PI : 0;
    this.buildGhost.clear();
    const visual = createBuildVisual(buildId, this.assets);
    visual.traverse((object) => {
      if (object instanceof Mesh) object.material = new MeshBasicMaterial({ color: 0x5be58b, transparent: true, opacity: 0.55, depthWrite: false });
    });
    this.buildGhost.add(visual);
    this.ui.addToast({
      text: inventoryItemId === "portable_workbench"
        ? "Werkbank platzieren: Linksklick setzen, R drehen, B abbrechen."
        : buildId.startsWith("hut_")
          ? "Bauteil an einen gelben Baupunkt führen: es rastet automatisch bündig ein."
          : "Bauposition wählen: Linksklick setzen, R drehen, B abbrechen.",
      tone: "info",
      durationMs: 5_500,
    });
    this.suppressPointerPause = true;
    this.requestPointerLock();
  }

  private placeSelectedBuild(): void {
    const world = this.world;
    if (!world || !this.selectedBuild) return;
    const inventoryItemId = this.placementInventoryItemId;
    const storedWorkbench = inventoryItemId === "portable_workbench";
    if (!this.buildPlacementValid) {
      this.ui.addToast({ text: this.buildPlacementReason || "Hier kann nicht gebaut werden.", tone: "warning" });
      return;
    }
    if (!inventoryItemId || this.inventory.remove(inventoryItemId, 1).removed !== 1) {
      this.ui.addToast({ text: "Der benötigte Bausatz fehlt inzwischen.", tone: "warning" });
      this.cancelBuild();
      return;
    }
    const placement = world.getPlacementPosition(this.camera, this.selectedBuild, this.buildRotation);
    const placed = this.selectedBuild === "raft_base"
      ? world.createRaftBase(placement.position, placement.rotationY) !== null
      : this.selectedBuild === "raft_deck"
        ? world.addRaftDeck()
        : Boolean(world.createBuilding(this.selectedBuild, placement.position, placement.rotationY));
    if (!placed) {
      this.inventory.add(inventoryItemId, 1);
      this.ui.addToast({ text: "Das Bauwerk konnte hier nicht platziert werden. Der Bausatz bleibt im Inventar.", tone: "warning" });
      this.cancelBuild();
      this.refreshUi();
      return;
    }
    if (!storedWorkbench) this.damageTool("building_hammer", 1);
    void this.audio.play("sfx.impact-wood-heavy", "sfx", 0.4);
    this.ui.addToast({ text: storedWorkbench ? "Werkbank wieder aufgestellt." : `${BUILDABLE_CATALOG[this.selectedBuild].label} gebaut.`, tone: "success" });
    this.cancelBuild();
    this.refreshUi();
  }

  private updateBuildGhost(): void {
    if (!this.world || !this.selectedBuild || this.state !== "playing") {
      this.buildGhost.visible = false;
      return;
    }
    const placement = this.world.getPlacementPosition(this.camera, this.selectedBuild, this.buildRotation);
    this.buildGhost.visible = true;
    this.buildGhost.position.copy(placement.position);
    this.buildGhost.rotation.y = placement.rotationY;
    this.buildPlacementValid = placement.valid;
    this.buildPlacementReason = placement.reason;
    const color = placement.valid ? 0x5be58b : 0xf05d52;
    this.buildGhost.traverse((object) => {
      if (object instanceof Mesh && object.material instanceof MeshBasicMaterial) object.material.color.setHex(color);
    });
  }

  private cancelBuild(): boolean {
    if (!this.selectedBuild) return false;
    this.selectedBuild = null;
    this.placementInventoryItemId = null;
    this.buildGhost.clear();
    this.buildGhost.visible = false;
    return true;
  }

  private useInventoryItem(instanceId: string): void {
    const index = Number(instanceId.replace("slot-", ""));
    const stack = this.inventory.slots[index];
    if (!stack) return;
    if (isBuildableId(stack.itemId)) {
      if (this.inventory.count("building_hammer") === 0) {
        this.ui.addToast({ text: "Zum Platzieren brauchst du einen Bauhammer.", tone: "warning" });
      } else {
        this.ui.closePanel();
        this.beginBuildPlacement(stack.itemId, stack.itemId);
      }
    } else if (stack.itemId === "portable_workbench") {
      this.ui.closePanel();
      this.beginBuildPlacement("workbench", "portable_workbench");
    } else if (stack.itemId === "coconut") {
      this.inventory.remove("coconut", 1);
      this.inventory.add(ITEM_CATALOG.coconut.useByproduct.itemId, ITEM_CATALOG.coconut.useByproduct.quantity);
      this.patchVitals({ hunger: Math.min(100, this.survival.hunger + 5), thirst: Math.min(100, this.survival.thirst + 18) });
      this.ui.addToast({ text: "Kokosnuss getrunken und gegessen.", tone: "success" });
    } else if (stack.itemId === "mango") {
      this.inventory.remove("mango", 1);
      this.patchVitals({ hunger: Math.min(100, this.survival.hunger + 18), thirst: Math.min(100, this.survival.thirst + 10) });
      this.ui.addToast({ text: "Saftige Mango gegessen.", tone: "success" });
    } else if (stack.itemId === "cooked_crab") {
      this.inventory.remove("cooked_crab", 1);
      this.patchVitals({ hunger: Math.min(100, this.survival.hunger + 28) });
      this.ui.addToast({ text: "Gekochte Krabbe gegessen.", tone: "success" });
    } else if (stack.itemId === "cooked_meat") {
      this.inventory.remove("cooked_meat", 1);
      this.patchVitals({ hunger: Math.min(100, this.survival.hunger + 42) });
      this.ui.addToast({ text: "Gegrilltes Fleisch gegessen.", tone: "success" });
    } else if (stack.itemId === "smoked_meat") {
      this.inventory.remove("smoked_meat", 1);
      this.patchVitals({ hunger: Math.min(100, this.survival.hunger + 55) });
      this.ui.addToast({ text: "Kräftiges Räucherfleisch gegessen.", tone: "success" });
    } else if (stack.itemId === "cooked_fish") {
      this.inventory.remove("cooked_fish", 1);
      this.patchVitals({ hunger: Math.min(100, this.survival.hunger + 34) });
      this.ui.addToast({ text: "Gegrillten Fisch gegessen.", tone: "success" });
    } else if (stack.itemId === "spoiled_food") {
      this.ui.addToast({ text: "Diese Nahrung ist verdorben und nicht mehr essbar.", tone: "warning" });
    } else if (stack.itemId === "healing_herb") {
      if (this.poisonSecondsRemaining <= 0) {
        this.ui.addToast({ text: "Du bist nicht vergiftet und brauchst kein Heilkraut.", tone: "info" });
      } else {
        this.inventory.remove("healing_herb", 1);
        this.poisonSecondsRemaining = 0;
        this.poisonCausedDeath = false;
        this.ui.addToast({ text: "Das Mangroven-Heilkraut neutralisiert das Schlangengift.", tone: "success", durationMs: 6_000 });
      }
    } else if (stack.itemId === "bandage") {
      if (this.poisonSecondsRemaining <= 0) {
        this.ui.addToast({ text: "Du bist nicht vergiftet und brauchst keinen Kräuterverband.", tone: "info" });
      } else {
        this.inventory.remove("bandage", 1);
        this.poisonSecondsRemaining = 0;
        this.poisonCausedDeath = false;
        this.patchVitals({ health: Math.min(100, this.survival.health + 20) });
        this.ui.addToast({ text: "Kräuterverband angelegt: Das Schlangengift ist neutralisiert und 20 Gesundheit wurden wiederhergestellt.", tone: "success" });
      }
    } else if (stack.itemId === "simple_bandage") {
      if (!this.isBleeding) {
        this.ui.addToast({ text: "Du blutest nicht und brauchst keinen einfachen Verband.", tone: "info" });
      } else {
        this.inventory.remove("simple_bandage", 1);
        this.isBleeding = false;
        this.bleedingCausedDeath = false;
        this.patchVitals({ health: Math.min(100, this.survival.health + 15) });
        this.ui.addToast({ text: "Einfachen Verband angelegt: Die Blutung ist gestoppt und 15 Gesundheit wurden wiederhergestellt.", tone: "success" });
      }
    } else if (stack.itemId === "herbal_antidote") {
      if (this.brackwaterSicknessSeconds <= 0 && this.poisonSecondsRemaining <= 0) {
        this.ui.addToast({ text: "Du bist weder krank noch vergiftet.", tone: "info" });
      } else {
        this.inventory.remove("herbal_antidote", 1);
        this.brackwaterSicknessSeconds = 0;
        this.poisonSecondsRemaining = 0;
        this.poisonCausedDeath = false;
        this.ui.addToast({ text: "Das Gegengift stoppt die Brackwasserkrankheit und Schlangengift.", tone: "success" });
      }
    } else if (stack.itemId === "flower_tonic") {
      if (this.survival.health >= 100 && this.survival.stamina >= this.survival.maxStamina) {
        this.ui.addToast({ text: "Du bist bereits vollständig erholt.", tone: "info" });
      } else {
        this.inventory.remove("flower_tonic", 1);
        this.patchVitals({
          health: Math.min(100, this.survival.health + 30),
          stamina: this.survival.maxStamina,
          staminaRegenDelayRemaining: 0,
        });
        this.ui.addToast({ text: "Blütentonikum getrunken: 30 Gesundheit und volle Ausdauer.", tone: "success" });
      }
    } else if (stack.itemId === "whetstone") {
      const selected = this.selectedItemId();
      const damagedTools = this.inventory.stacks
        .map(({ itemId }) => itemId)
        .filter((itemId) => {
          const max = getMaxDurability(itemId);
          return Boolean(max && (this.toolDurability[itemId] ?? max) < max);
        });
      const tool = selected && damagedTools.includes(selected) ? selected : damagedTools[0];
      if (!tool) {
        this.ui.addToast({ text: "Kein beschädigtes Werkzeug zum Schärfen gefunden.", tone: "info" });
      } else {
        const max = getMaxDurability(tool)!;
        this.inventory.remove("whetstone", 1);
        this.toolDurability[tool] = Math.min(max, (this.toolDurability[tool] ?? max) + 35);
        this.ui.addToast({ text: `${ITEM_CATALOG[tool].label} um 35 Haltbarkeit repariert.`, tone: "success" });
      }
    } else if (stack.itemId === "giant_island_map") {
      this.ui.addToast({
        text: "Die alte Karte zeigt eine riesige Insel weit außerhalb des bekannten Archipels. Auf deiner HUD-Karte ist sie noch nicht verzeichnet.",
        tone: "info",
        durationMs: 8_000,
      });
    } else if (stack.itemId === "shovel_blueprint") {
      this.ui.addToast({ text: "Bauplan gelesen: Die Improvisierte Schaufel ist jetzt unter Werkzeuge herstellbar.", tone: "info" });
    } else if (stack.itemId === "woven_shirt") {
      this.equippedShirt = !this.equippedShirt;
      this.ui.addToast({
        text: this.equippedShirt
          ? "Schutzhemd angezogen: hält dich im Regen warm, dämpft Schaden und Hitze."
          : "Schutzhemd ausgezogen.",
        tone: "success",
      });
    } else if (stack.itemId === "backpack") {
      if (this.equippedBackpack) {
        if (this.inventory.usedSlots > BASE_INVENTORY_SLOTS) {
          this.ui.addToast({ text: `Leere zuerst ${this.inventory.usedSlots - BASE_INVENTORY_SLOTS} zusätzliche Inventarplätze.`, tone: "warning" });
        } else {
          this.inventory = new Inventory(
            BASE_INVENTORY_SLOTS,
            this.inventory.slots.flatMap((stack) => stack ? [stack] : []),
          );
          this.equippedBackpack = false;
          this.ui.addToast({ text: "Großen Rucksack abgelegt: wieder 24 Inventarplätze.", tone: "success" });
        }
      } else {
        this.inventory = new Inventory(
          BACKPACK_INVENTORY_SLOTS,
          this.inventory.slots.flatMap((stack) => stack ? [stack] : []),
        );
        this.equippedBackpack = true;
        this.ui.addToast({ text: "Großen Rucksack angelegt: 36 Inventarplätze verfügbar.", tone: "success" });
      }
    } else if (stack.itemId === "crab" || stack.itemId === "raw_meat" || stack.itemId === "raw_fish") this.ui.addToast({ text: "Rohes Essen muss zuerst am Lagerfeuer gegart werden.", tone: "warning" });
    else this.ui.addToast({ text: `${ITEM_CATALOG[stack.itemId].label} kann nicht direkt benutzt werden.`, tone: "info" });
    this.refreshUi();
  }

  private dropInventoryItem(instanceId: string): void {
    const index = Number(instanceId.replace("slot-", ""));
    const stack = this.inventory.slots[index];
    const position = this.physics?.getPlayerPosition();
    if (!stack || !position || !this.world) return;
    if (stack.itemId === "portable_workbench") {
      this.ui.closePanel();
      this.beginBuildPlacement("workbench", "portable_workbench");
      this.refreshUi();
      return;
    }
    if (this.isEquipped(stack.itemId)) {
      this.ui.addToast({ text: "Lege diese Ausrüstung zuerst über „Benutzen“ ab.", tone: "warning" });
      return;
    }
    this.inventory.remove(stack.itemId, stack.quantity);
    const forward = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.world.dropLoot({ x: position.x + forward.x * 1.5, y: position.y, z: position.z + forward.z * 1.5 }, [{ itemId: stack.itemId, count: stack.quantity }]);
    this.ui.addToast({ text: `${ITEM_CATALOG[stack.itemId].label} abgelegt.`, tone: "info" });
    this.refreshUi();
  }

  private depositStorageItem(instanceId: string): void {
    const building = this.activeChestId ? this.world?.getBuilding(this.activeChestId) : null;
    const index = Number(instanceId.replace("storage-player-", ""));
    const stack = this.inventory.slots[index];
    if (!building || building.type !== "chest" || !stack || !Number.isSafeInteger(index)) return;
    if (this.isEquipped(stack.itemId)) {
      this.ui.addToast({ text: "Lege diese Ausrüstung zuerst über „Benutzen“ ab.", tone: "warning" });
      return;
    }

    const chestInventory = new Inventory(CHEST_STORAGE_SLOTS, building.storedItems ?? []);
    const result = transferItems(this.inventory, chestInventory, stack.itemId, stack.quantity);
    building.storedItems = [...chestInventory.stacks];
    if (result.transferred === 0) {
      this.ui.addToast({ text: "Die Truhe ist voll.", tone: "warning" });
    } else {
      this.ui.addToast({
        text: `${result.transferred}× ${ITEM_CATALOG[stack.itemId].label} eingelagert${result.remainder > 0 ? `, ${result.remainder} bleiben im Rucksack` : ""}.`,
        tone: "success",
      });
      void this.saveGame(false);
    }
    this.refreshUi();
  }

  private withdrawStorageItem(instanceId: string): void {
    const building = this.activeChestId ? this.world?.getBuilding(this.activeChestId) : null;
    const index = Number(instanceId.replace("storage-container-", ""));
    if (!building || building.type !== "chest" || !Number.isSafeInteger(index)) return;

    const chestInventory = new Inventory(CHEST_STORAGE_SLOTS, building.storedItems ?? []);
    const stack = chestInventory.slots[index];
    if (!stack) return;
    const result = transferItems(chestInventory, this.inventory, stack.itemId, stack.quantity);
    building.storedItems = [...chestInventory.stacks];
    if (result.transferred === 0) {
      this.ui.addToast({ text: "Dein Rucksack ist voll.", tone: "warning" });
    } else {
      this.ui.addToast({
        text: `${result.transferred}× ${ITEM_CATALOG[stack.itemId].label} aus der Truhe genommen${result.remainder > 0 ? `, ${result.remainder} bleiben eingelagert` : ""}.`,
        tone: "success",
      });
      void this.saveGame(false);
    }
    this.refreshUi();
  }

  private addLoot(
    loot: readonly LootStack[] | readonly { itemId: ItemId; quantity: number }[],
    recordDiscovery = true,
  ): void {
    for (const entry of loot) {
      const count = "count" in entry ? entry.count : entry.quantity;
      const result = this.inventory.add(entry.itemId, count);
      if (result.remainder > 0) {
        const position = this.physics?.getPlayerPosition();
        if (position) this.world?.dropLoot(position, [{ itemId: entry.itemId, count: result.remainder }]);
        this.ui.addToast({ text: `Inventar voll: ${result.remainder}× ${ITEM_CATALOG[entry.itemId].label} liegen vor dir.`, tone: "warning" });
      }
    }
    if (recordDiscovery) this.recordLootDiscoveries(loot);
    this.refreshUi();
  }

  private damageTool(itemId: ItemId, amount: number): void {
    const max = getMaxDurability(itemId);
    if (!max) return;
    const next = (this.toolDurability[itemId] ?? max) - amount;
    if (next <= 0) {
      this.inventory.remove(itemId, 1);
      delete this.toolDurability[itemId];
      this.ui.addToast({ text: `${ITEM_CATALOG[itemId].label} ist zerbrochen.`, tone: "danger" });
    } else this.toolDurability[itemId] = next;
  }

  private damagePlayer(amount: number, text: string, causesBleeding = false): void {
    const reducedAmount = this.equippedShirt ? amount * 0.75 : amount;
    const nextHealth = Math.max(0, this.survival.health - reducedAmount);
    const startsBleeding = causesBleeding && !this.isBleeding && nextHealth > 0;
    if (causesBleeding && nextHealth > 0) this.isBleeding = true;
    this.patchVitals({ health: nextHealth });
    const protectionText = this.equippedShirt ? " Das Schutzhemd dämpft den Schaden." : "";
    const bleedingText = startsBleeding ? " Die Wunde blutet – lege schnell einen Verband an!" : "";
    this.ui.addToast({
      text: `${text}${protectionText}${bleedingText}`,
      tone: "danger",
      ...(startsBleeding ? { durationMs: 8_000 } : {}),
    });
  }

  private poisonPlayer(text: string): void {
    const alreadyPoisoned = this.poisonSecondsRemaining > 0;
    this.poisonSecondsRemaining = POISON_DURATION_SECONDS;
    this.poisonCausedDeath = false;
    this.ui.addToast({
      text: `${text} ${alreadyPoisoned ? "Die Giftwirkung beginnt erneut." : "Ohne Mangroven-Heilkraut stirbst du nach drei Tagen."}`,
      tone: "danger",
      durationMs: 8_000,
    });
    this.refreshUi();
  }

  private advancePoisonCondition(deltaSeconds: number): void {
    if (this.poisonSecondsRemaining <= 0 || deltaSeconds <= 0) return;
    const result = advancePoison(this.survival.health, this.poisonSecondsRemaining, deltaSeconds);
    this.poisonSecondsRemaining = result.remainingSeconds;
    this.poisonCausedDeath = result.health <= 0;
    this.patchVitals({ health: result.health });
  }

  private advanceBleedingCondition(deltaSeconds: number): void {
    if (!this.isBleeding || deltaSeconds <= 0 || this.survival.health <= 0) return;
    const previousHealth = this.survival.health;
    const health = advanceBleeding(previousHealth, true, deltaSeconds);
    this.bleedingCausedDeath = previousHealth > 0 && health <= 0;
    this.patchVitals({ health });
  }

  private advanceFoodSpoilage(deltaSeconds: number): void {
    if (deltaSeconds <= 0) return;
    const spoiledInBackpack = this.inventory.advanceSpoilage(deltaSeconds);
    const spoiledInStorage = this.world?.advanceStoredFoodSpoilage(deltaSeconds) ?? 0;
    if (spoiledInBackpack > 0) {
      this.ui.addToast({
        text: `${spoiledInBackpack}× Nahrung in deinem Rucksack ist verdorben.`,
        tone: "warning",
        durationMs: 6_000,
      });
      this.refreshUi();
    }
    if (spoiledInStorage > 0 && this.activeChestId) this.ui.updateStorage(this.createStorageViewModel());
  }

  private drinkBrackwater(message = "Das Brackwasser macht dich krank."): void {
    this.patchVitals({ thirst: Math.min(100, this.survival.thirst + 12) });
    this.brackwaterSicknessSeconds = Math.max(this.brackwaterSicknessSeconds, BRACKWATER_SICKNESS_DURATION_SECONDS);
    this.ui.addToast({ text: `${message} Stelle ein pflanzliches Gegengift her.`, tone: "danger", durationMs: 7_000 });
    this.refreshUi();
  }

  private handleDeath(): void {
    const physics = this.physics;
    const world = this.world;
    if (!physics || !world) return;
    this.state = "dead";
    this.onRaft = false;
    this.mapOpen = false;
    physics.setPlayerEnabled(false);
    const loot = this.inventory.stacks.map((stack) => ({ itemId: stack.itemId, count: stack.quantity }));
    if (loot.length > 0) world.createDeathPack(physics.getPlayerPosition(), loot);
    this.inventory = new Inventory();
    this.equippedShirt = false;
    this.equippedBackpack = false;
    this.isCold = false;
    this.previousCold = null;
    this.warmthSource = null;
    const deathCause = this.bleedingCausedDeath
      ? "An Blutverlust gestorben"
      : this.poisonCausedDeath || this.poisonSecondsRemaining > 0
      ? "An Schlangengift gestorben"
      : this.survival.thirst <= 0
        ? "Verdurstet"
        : this.survival.hunger <= 0
          ? "Verhungert"
          : this.survival.oxygen <= 0
            ? "Ertrunken"
            : this.survival.fatigue >= 100
              ? "An völliger Erschöpfung gestorben"
            : "Den Gefahren der Inseln erlegen";
    this.brackwaterSicknessSeconds = 0;
    this.poisonSecondsRemaining = 0;
    this.poisonCausedDeath = false;
    this.isBleeding = false;
    this.bleedingCausedDeath = false;
    this.previousFatigueLevel = null;
    this.exitPointerLock();
    this.ui.showDeath({
      cause: deathCause,
      survivedFor: formatDuration(this.playedSeconds),
      islandName: this.locationLabel(physics.getPlayerPosition()),
      canReload: true,
    });
  }

  private respawn(): void {
    if (!this.physics) return;
    this.survival = { ...createInitialSurvivalState(), hunger: 60, thirst: 60 };
    this.isCold = false;
    this.previousCold = null;
    this.warmthSource = null;
    this.brackwaterSicknessSeconds = 0;
    this.poisonSecondsRemaining = 0;
    this.poisonCausedDeath = false;
    this.isBleeding = false;
    this.bleedingCausedDeath = false;
    this.previousFatigueLevel = null;
    this.mapOpen = false;
    this.physics.setPlayerEnabled(true);
    this.physics.setPlayerPosition(this.spawnPoint);
    this.state = "playing";
    this.ui.showGame(this.createHudViewModel());
    this.requestPointerLock();
  }

  private anchorPlayerToRaft(): void {
    const raft = this.world?.getRaft();
    const pose = raft ? this.physics?.getRaftPose(raft.id) : null;
    if (pose) this.physics?.setPlayerPosition({ x: pose.position.x, y: pose.position.y + 1, z: pose.position.z });
  }

  private disembarkRaft(): void {
    const raft = this.world?.getRaft();
    const pose = raft ? this.physics?.getRaftPose(raft.id) : null;
    if (!pose || !this.physics || !this.world) return;
    this.onRaft = false;
    this.physics.setPlayerEnabled(true);
    const rightX = 1 - 2 * (pose.rotation.y * pose.rotation.y + pose.rotation.z * pose.rotation.z);
    const rightZ = 2 * (pose.rotation.x * pose.rotation.z - pose.rotation.w * pose.rotation.y);
    const forwardX = 2 * (pose.rotation.x * pose.rotation.z + pose.rotation.w * pose.rotation.y);
    const forwardZ = 1 - 2 * (pose.rotation.x * pose.rotation.x + pose.rotation.y * pose.rotation.y);
    const candidates = [
      { x: pose.position.x + rightX * 2.6, z: pose.position.z + rightZ * 2.6 },
      { x: pose.position.x - rightX * 2.6, z: pose.position.z - rightZ * 2.6 },
      { x: pose.position.x + forwardX * 2.8, z: pose.position.z + forwardZ * 2.8 },
      { x: pose.position.x - forwardX * 2.8, z: pose.position.z - forwardZ * 2.8 },
    ].map((candidate) => ({ ...candidate, terrainY: this.world!.heightAt(candidate.x, candidate.z) }));
    candidates.sort((left, right) => {
      const leftScore = left.terrainY > -1.8 ? 100 + left.terrainY : left.terrainY;
      const rightScore = right.terrainY > -1.8 ? 100 + right.terrainY : right.terrainY;
      return rightScore - leftScore;
    });
    const target = candidates[0]!;
    this.physics.setPlayerPosition({ x: target.x, y: Math.max(0.85, target.terrainY + 1), z: target.z });
  }

  private async pauseGame(): Promise<void> {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.exitPointerLock();
    const pauseModel = (saveStatus: "saved" | "saving" | "unavailable") => ({
      locationLabel: this.locationLabel(this.physics?.getPlayerPosition() ?? this.defaultSpawn()),
      playedFor: formatDuration(this.playedSeconds),
      saveStatus,
    });
    this.pendingSaveAction = {
      onSaved: () => this.ui.showPause(pauseModel("saved")),
      onSkipped: () => this.ui.showPause(pauseModel("unavailable")),
    };
    this.ui.showPause(pauseModel("saving"));
    if (!(await this.saveGame(false))) return;
    const pending = this.pendingSaveAction;
    this.pendingSaveAction = null;
    await pending?.onSaved();
  }

  private resumeGame(): void {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.ui.showGame(this.createHudViewModel());
    this.requestPointerLock();
  }

  private async returnToMenu(): Promise<void> {
    this.pendingSaveAction = {
      onSaved: () => this.finishReturnToMenu(),
      onSkipped: () => this.finishReturnToMenu(),
    };
    if (!(await this.saveGame(false))) return;
    const pending = this.pendingSaveAction;
    this.pendingSaveAction = null;
    await pending?.onSaved();
  }

  private async finishReturnToMenu(): Promise<void> {
    this.audio.stopOceanAmbience();
    this.state = "menu";
    this.exitPointerLock();
    const meta = await this.saveRepository.getMeta().catch(() => null);
    this.ui.showMainMenu({
      canContinue: Boolean(meta),
      ...(meta ? { continueSummary: { slotId: "current", islandName: this.locationLabel(this.physics?.getPlayerPosition() ?? this.defaultSpawn()), playedFor: formatDuration(this.playedSeconds), savedAt: new Date(meta.savedAtUnixMs).toLocaleString("de-CH") } } : {}),
      versionLabel: "Vertical Slice 0.1.0",
    });
  }

  private async saveGame(showToast = true): Promise<boolean> {
    if (!this.physics || !this.world || this.state === "loading") return false;
    try {
      const payload = this.createSave();
      await this.saveRepository.save(payload, this.day);
      if (showToast) this.ui.addToast({ text: "Spielstand gespeichert.", tone: "success" });
      return true;
    } catch (error) {
      this.lastStorageOperation = "save";
      this.ui.showStorageError({
        operation: "save",
        message: "Speichern ist momentan nicht verfügbar.",
        detail: error instanceof Error ? error.message : String(error),
        canRetry: true,
        canContinueWithoutSaving: true,
      });
      return false;
    }
  }

  private async retryStorageOperation(): Promise<void> {
    if (this.lastStorageOperation === "load") {
      await this.continueGame();
      return;
    }
    if (!(await this.saveGame(false))) return;
    const pending = this.pendingSaveAction;
    this.pendingSaveAction = null;
    this.ui.dismissStorageError();
    await pending?.onSaved();
  }

  private createSave(): RuntimeSaveV1 {
    if (!this.physics || !this.world) throw new Error("Die Welt ist noch nicht bereit.");
    return {
      schemaVersion: 1,
      contentVersion: "0.1.0",
      savedAtUnixMs: Date.now(),
      day: this.day,
      playedSeconds: this.playedSeconds,
      player: {
        position: this.physics.getPlayerPosition(),
        yaw: this.yaw,
        pitch: this.pitch,
        spawnPoint: { ...this.spawnPoint },
        inventory: [...this.inventory.stacks],
        survival: { ...this.survival },
        toolDurability: { ...this.toolDurability },
        equipment: {
          wovenShirt: this.equippedShirt,
          backpack: this.equippedBackpack,
        },
        conditions: {
          brackwaterSicknessSeconds: this.brackwaterSicknessSeconds,
          poisonSecondsRemaining: this.poisonSecondsRemaining,
          isBleeding: this.isBleeding,
        },
      },
      world: this.world.serialize(),
      deathPacks: [],
      notebook: this.notebook.serialize(),
    };
  }

  private restoreSave(save: RuntimeSaveV1): void {
    if (!this.physics || !this.world) return;
    this.onRaft = false;
    this.mapOpen = false;
    this.activeChestId = null;
    this.notebook = new ExpeditionNotebook(save.notebook);
    this.physics.setPlayerEnabled(true);
    this.equippedShirt = Boolean(save.player.equipment?.wovenShirt);
    this.equippedBackpack = Boolean(save.player.equipment?.backpack);
    this.brackwaterSicknessSeconds = save.player.conditions?.brackwaterSicknessSeconds ?? 0;
    this.poisonSecondsRemaining = save.player.conditions?.poisonSecondsRemaining ?? 0;
    this.poisonCausedDeath = false;
    this.isBleeding = save.player.conditions?.isBleeding ?? false;
    this.bleedingCausedDeath = false;
    this.previousFatigueLevel = null;
    this.foodSpoilageAccumulator = 0;
    this.inventory = new Inventory(this.equippedBackpack ? BACKPACK_INVENTORY_SLOTS : BASE_INVENTORY_SLOTS, save.player.inventory);
    const savedMaxStamina = (save.player.survival as Partial<SurvivalState>).maxStamina ?? 100;
    const savedFatigue = (save.player.survival as Partial<SurvivalState>).fatigue ?? 0;
    this.survival = {
      ...save.player.survival,
      maxStamina: savedMaxStamina,
      fatigue: savedFatigue,
      stamina: Math.min(save.player.survival.stamina, savedMaxStamina),
      dayElapsedSeconds: save.player.survival.dayElapsedSeconds % DAY_LENGTH_SECONDS,
    };
    this.isCold = false;
    this.previousCold = null;
    this.warmthSource = null;
    this.toolDurability = { ...save.player.toolDurability };
    this.day = save.day;
    this.playedSeconds = save.playedSeconds;
    this.yaw = save.player.yaw;
    this.pitch = save.player.pitch;
    this.spawnPoint = { ...save.player.spawnPoint };
    this.physics.setPlayerPosition(save.player.position);
    this.world.restore(save.world);
    this.weather = getWeatherState(this.day, this.survival.dayElapsedSeconds);
    this.previousWeatherKind = this.weather.kind;
  }

  private createHudViewModel(): HudViewModel {
    const position = this.physics?.getPlayerPosition() ?? this.defaultSpawn();
    const target = this.selectedBuild ? null : this.world?.getLookTarget(this.camera, 4);
    const targetPrompt = target ? this.promptForTarget(target.id, target.kind, target.label) : undefined;
    const deathPack = this.world?.getNearestDeathPack(position);
    const hotbar = this.hotbarItems();
    const heading = ((MathUtils.radToDeg(this.yaw) + 180) % 360 + 360) % 360;
    const currentIsland = this.world?.getIslandAt(position.x, position.z) ?? null;
    const volcanicHeat = this.world?.getVolcanicHeatLevel(position) ?? 0;
    const cliffWind = this.world?.getCliffWindLevel(position) ?? 0;
    const timeFraction = getTimeOfDayFraction(this.survival.dayElapsedSeconds);
    const hours = Math.floor(timeFraction * 24);
    const minutes = Math.floor(((timeFraction * 24) % 1) * 60);
    const metric = (value: number, max = 100) => {
      const ratio = max > 0 ? value / max : 0;
      return { current: value, max, display: `${Math.round(value)}`, state: ratio < 0.2 ? "critical" as const : ratio < 0.45 ? "warning" as const : "good" as const };
    };
    return {
      health: metric(this.survival.health),
      hunger: metric(this.survival.hunger),
      thirst: metric(this.survival.thirst),
      stamina: {
        ...metric(this.survival.stamina, this.survival.maxStamina),
        display: `${Math.round(this.survival.stamina)}/${Math.round(this.survival.maxStamina)}`,
      },
      oxygen: metric(this.survival.oxygen),
      fatigue: {
        current: this.survival.fatigue,
        max: 100,
        display: `${Math.round(this.survival.fatigue)}%`,
        state: this.survival.fatigue >= 80 ? "critical" : this.survival.fatigue >= 50 ? "warning" : "good",
      },
      headingDegrees: heading,
      locationLabel: `${this.locationLabel(position)} · Tag ${this.day} · ${this.weather.icon} ${this.weather.label}${volcanicHeat === 2 ? " · 🔥 Gluthitze" : volcanicHeat === 1 ? " · 🌡️ Vulkanhitze" : ""}${cliffWind === 2 ? " · 🌬️ Sturmgrat" : cliffWind === 1 ? " · 💨 Klippenwind" : ""}${this.isCold ? " · 🥶 Kalt" : this.weather.isRaining && this.warmthSource === "fire" ? " · 🔥 Feuerwärme" : this.weather.isRaining && this.warmthSource === "clothing" ? " · 👕 Geschützt" : ""}${this.survival.fatigue >= 80 ? " · 💤 Erschöpft" : this.survival.fatigue >= 50 ? " · 😴 Müde" : ""}${this.isBleeding ? " · 🩸 Blutung" : ""}${this.poisonSecondsRemaining > 0 ? ` · ☠ Vergiftet ${Math.ceil(this.poisonSecondsRemaining / DAY_LENGTH_SECONDS)} T` : ""}${this.brackwaterSicknessSeconds > 0 ? ` · 🤢 Krank ${Math.ceil(this.brackwaterSicknessSeconds)} s` : ""}${deathPack ? ` · Rucksack ${Math.round(deathPack.distance)} m` : ""}`,
      ...(this.selectedBuild
        ? { prompt: { key: "LMB", action: this.buildPlacementValid ? "Bauen" : this.buildPlacementReason || "Ungültig", target: BUILDABLE_CATALOG[this.selectedBuild].label } }
        : targetPrompt
          ? { prompt: targetPrompt }
          : {}),
      messages: [],
      hotbar: [0, 1, 2, 3].map((index) => {
        const itemId = hotbar[index];
        const durability = itemId ? getMaxDurability(itemId) : undefined;
        return itemId
          ? { index, itemId, label: ITEM_CATALOG[itemId].label, iconText: ITEM_ICONS[itemId] ?? "•", quantity: this.inventory.count(itemId), ...(durability ? { durability: (this.toolDurability[itemId] ?? durability) / durability } : {}) }
          : { index };
      }),
      selectedHotbarIndex: this.selectedHotbarIndex,
      clockLabel: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
      map: {
        visible: this.mapOpen,
        playerX: position.x,
        playerZ: position.z,
        headingDegrees: heading,
        locationLabel: currentIsland?.name ?? "Offener Ozean",
        islands: WORLD_MANIFEST.islands.map((island) => ({
          id: island.id,
          label: island.name,
          x: island.positionMeters.x,
          z: island.positionMeters.z,
          width: island.dimensions.widthMeters,
          depth: island.dimensions.depthMeters,
          isStart: island.isStart,
          isCurrent: island.id === currentIsland?.id,
        })),
      },
    };
  }

  private promptForTarget(id: string, kind: string, label: string): { key: string; action: string; target?: string } {
    if (kind === "palm" || kind === "tree" || kind === "crab" || kind === "wild_boar" || kind === "chicken" || kind === "turtle" || kind === "bird" || kind === "crocodile" || kind === "shark") return { key: "LMB", action: "Werkzeug benutzen", target: label };
    if (kind === "raft") {
      const raft = this.world?.getRaft();
      const repairing = Boolean(raft && raft.durability < 100 && this.selectedItemId() === "building_hammer");
      return { key: "E", action: repairing ? `Reparieren (${Math.round(raft?.durability ?? 0)} %)` : this.onRaft ? "Aussteigen" : "Floß betreten", target: label };
    }
    if (kind === "building") {
      const building = this.world?.getBuilding(id);
      if (building?.type === "workbench") {
        return this.selectedItemId() === "building_hammer"
          ? { key: "F / E", action: "Benutzen / aufheben", target: BUILDABLE_CATALOG.workbench.label }
          : { key: "F", action: "Werkbank benutzen", target: BUILDABLE_CATALOG.workbench.label };
      }
      const action = building?.type === "shelter"
        ? "Respawnpunkt setzen"
        : building?.type === "bed"
          ? "Bis zum Morgen schlafen"
          : building?.type === "chest"
            ? "Öffnen"
            : building?.type === "campfire"
              ? "Kochen / Feuer nachlegen"
              : building?.type === "fish_trap"
                ? "Fang prüfen / beködern"
              : building?.type === "smoking_rack"
                ? "Fleisch räuchern / Charge prüfen"
              : building?.type === "palm_still" || building?.type === "rain_collector"
                ? "Wasser trinken"
                : "Benutzen";
      return { key: "E", action, target: building ? BUILDABLE_CATALOG[building.type].label : label };
    }
    if (kind === "lore_letter") return { key: "E", action: "Lesen", target: label };
    if (kind === "climbing_anchor") return { key: "E", action: "Seilaufstieg benutzen", target: label };
    if (kind === "signal_beacon") return { key: "E", action: "Windsignal entzünden", target: label };
    if (kind === "buried_chest") return {
      key: "E",
      action: this.world?.isBuriedChestDug() ? "Öffnen" : this.selectedItemId() === "shovel" ? "Ausgraben" : "Schaufel auswählen",
      target: label,
    };
    return { key: "E", action: kind === "freshwater" || kind === "brackwater" ? "Trinken" : "Aufnehmen", target: label };
  }

  private createInventoryViewModel(): InventoryViewModel {
    return this.inventoryViewModel(
      this.inventory,
      "slot",
      `Inventar · ${this.inventory.usedSlots}/${this.inventory.maxSlots}`,
    );
  }

  private inventoryViewModel(inventory: Inventory, instancePrefix: string, title: string): InventoryViewModel {
    const stacks = inventory.slots;
    return {
      title,
      slots: Array.from({ length: inventory.maxSlots }, (_, index) => {
        const stack = stacks[index];
        return stack
          ? {
              index,
              item: {
                instanceId: `${instancePrefix}-${index}`,
                itemId: stack.itemId,
                label: ITEM_CATALOG[stack.itemId].label,
                description: stack.itemId === "portable_workbench"
                  ? "Benutzen oder Ablegen, um die Werkbank ohne neue Materialkosten wieder zu platzieren."
                  : ITEM_CATALOG[stack.itemId].category === "buildable"
                    ? "Benutzen, um den Bausatz in der Welt zu platzieren. Beim Abbrechen bleibt er im Inventar."
                  : stack.itemId === "healing_herb"
                    ? "Benutzen, um eine Vergiftung durch Schlangen zu heilen."
                  : stack.itemId === "spoiled_food"
                    ? "Verdorben und nicht mehr essbar."
                  : stack.itemId === "crab" || stack.itemId === "raw_meat" || stack.itemId === "raw_fish"
                    ? `Muss vor dem Essen am Lagerfeuer gegart werden.${stack.spoilageSecondsRemaining === undefined ? "" : ` ${formatFoodFreshness(stack.spoilageSecondsRemaining)}.`}`
                  : ITEM_CATALOG[stack.itemId].category === "food"
                  ? `Kann über Benutzen verzehrt werden.${stack.spoilageSecondsRemaining === undefined ? "" : ` ${formatFoodFreshness(stack.spoilageSecondsRemaining)}.`}`
                  : ITEM_CATALOG[stack.itemId].category === "medical"
                    ? stack.itemId === "simple_bandage"
                      ? "Anlegen, um eine Blutung zu stoppen und 15 Gesundheit wiederherzustellen."
                      : stack.itemId === "bandage"
                        ? "Anlegen, um Schlangengift zu neutralisieren und 20 Gesundheit wiederherzustellen."
                      : stack.itemId === "flower_tonic"
                        ? "Benutzen für 30 Gesundheit und volle Ausdauer."
                        : "Benutzen, um Krankheit und Schlangengift zu stoppen."
                    : stack.itemId === "whetstone"
                      ? "Benutzen, um ein beschädigtes Werkzeug um 35 Haltbarkeit zu reparieren."
                      : stack.itemId === "shovel_blueprint"
                        ? "Schaltet das Rezept für die Improvisierte Schaufel frei."
                        : stack.itemId === "giant_island_map"
                          ? "Zeigt eine riesige Insel außerhalb der bekannten HUD-Karte."
                      : ITEM_CATALOG[stack.itemId].category === "tool"
                        ? stack.itemId === "shovel"
                          ? "Zum Freilegen vergrabener Truhen im Sand."
                          : "Werkzeug für Sammeln, Jagd oder Bauen."
                        : "Rohstoff für Herstellungsrezepte.",
                iconText: ITEM_ICONS[stack.itemId] ?? "•",
                quantity: stack.quantity,
                ...(ITEM_CATALOG[stack.itemId].category === "equipment" ? {
                  description: stack.itemId === "backpack"
                    ? "Anlegen für 12 zusätzliche Inventarplätze."
                    : "Anziehen für 25 % weniger Schaden und besseren Hitzeschutz.",
                  equipped: this.isEquipped(stack.itemId),
                } : {}),
                ...(getMaxDurability(stack.itemId) ? { durability: (this.toolDurability[stack.itemId] ?? getMaxDurability(stack.itemId) ?? 1) / (getMaxDurability(stack.itemId) ?? 1) } : {}),
              },
            }
          : { index };
      }),
    };
  }

  private createStorageViewModel(): StorageViewModel {
    const building = this.activeChestId ? this.world?.getBuilding(this.activeChestId) : null;
    const chestInventory = new Inventory(CHEST_STORAGE_SLOTS, building?.type === "chest" ? building.storedItems ?? [] : []);
    return {
      title: "Truhe",
      player: this.inventoryViewModel(
        this.inventory,
        "storage-player",
        `Rucksack · ${this.inventory.usedSlots}/${this.inventory.maxSlots}`,
      ),
      container: this.inventoryViewModel(
        chestInventory,
        "storage-container",
        `Truhe · ${chestInventory.usedSlots}/${chestInventory.maxSlots}`,
      ),
      hint: "Klicke einen Stapel an, um ihn vollständig zwischen Rucksack und Truhe zu verschieben. Esc schließt die Truhe.",
    };
  }

  private createCraftingViewModel(): CraftingViewModel {
    const categoryOrder = ["Komponenten", "Werkzeuge", "Versorgung", "Hüttenbau", "Floß"];
    const categoryMap: Record<string, string> = { components: "Komponenten", tools: "Werkzeuge", survival: "Versorgung", building: "Hüttenbau", raft: "Floß" };
    const stationRecipeIds = this.craftingStation === "workbench"
      ? RECIPE_IDS
      : RECIPE_IDS.filter((id) => craftingStationFor(RECIPE_CATALOG[id]) === "hand");
    const categories = [
      "Alle",
      ...categoryOrder.filter((category) => stationRecipeIds.some((id) => categoryMap[RECIPE_CATALOG[id].category] === category)),
    ];
    const activeCategory = categories.includes(this.currentCraftCategory) ? this.currentCraftCategory : "Alle";
    const recipes = stationRecipeIds.filter((id) => {
      const recipe = RECIPE_CATALOG[id];
      return activeCategory === "Alle" || categoryMap[recipe.category] === activeCategory;
    }).map((id) => this.recipeViewModel(RECIPE_CATALOG[id], categoryMap));
    return {
      station: this.craftingStation,
      title: this.craftingStation === "workbench" ? "Werkbank" : "Handwerk",
      hint: this.craftingStation === "workbench"
        ? "Alle bekannten Rezepte – von Handarbeit bis zu präzisen Werkbankteilen."
        : "Einfache Dinge, die du ohne feste Arbeitsfläche herstellen kannst.",
      categories,
      activeCategory,
      recipes,
    };
  }

  private recipeViewModel(recipe: RecipeDefinition, categoryMap: Record<string, string>): RecipeViewModel {
    const blueprintMissing = Boolean(recipe.requiredBlueprint && this.inventory.count(recipe.requiredBlueprint) === 0);
    return {
      id: recipe.id,
      label: recipe.label,
      category: categoryMap[recipe.category] ?? recipe.category,
      description: `${recipe.output.kind === "buildable" ? "Wird als Bausatz in deinem Inventar abgelegt und kann dort über „Benutzen“ platziert werden." : "Wird direkt in deinem Rucksack hergestellt."} Arbeitszeit: ${recipe.craftDurationSeconds} s.`,
      iconText: recipe.category === "components"
        ? "≋"
        : recipe.category === "tools"
          ? "⌁"
          : recipe.category === "building"
            ? "▦"
            : recipe.category === "raft"
              ? "≈"
              : "+",
      ingredients: recipe.ingredients.map((ingredient) => ({ itemId: ingredient.itemId, label: ITEM_CATALOG[ingredient.itemId].label, owned: this.inventory.count(ingredient.itemId), required: ingredient.quantity })),
      canCraft: this.inventory.canConsume(recipe.ingredients) && !blueprintMissing,
      ...(blueprintMissing && recipe.requiredBlueprint
          ? { lockedReason: `${ITEM_CATALOG[recipe.requiredBlueprint].label} benötigt` }
          : {}),
    };
  }

  private createBuildViewModel(): BuildViewModel {
    const categories = ["Alle", "Überleben", "Werkbank", "Hüttenbau", "Floß"];
    const categoryMap: Record<string, string> = { survival: "Überleben", crafting: "Werkbank", building: "Hüttenbau", raft: "Floß" };
    const options = Object.values(BUILDABLE_CATALOG)
      .filter((buildable) => this.currentBuildCategory === "Alle" || categoryMap[buildable.category] === this.currentBuildCategory)
      .map((buildable) => {
        const owned = this.inventory.count(buildable.id);
        const hammerMissing = this.inventory.count("building_hammer") === 0;
        return {
          id: buildable.id,
          label: buildable.label,
          category: categoryMap[buildable.category] ?? buildable.category,
          description: buildable.id === "smoking_rack"
            ? "Nur auf ebenem Boden der Dschungelbucht platzierbar."
            : buildable.placement === "ground"
              ? "Auf festem, ebenem Boden platzieren."
            : buildable.placement === "foundation"
              ? "Nivelliert sich am höchsten Bodenpunkt, gräbt die Kante frei und setzt Stützpfeiler."
              : buildable.placement === "foundation-edge"
                ? "Rastet bündig an einer freien Fundamentkante ein."
                : buildable.placement === "foundation-top"
                  ? "Rastet exakt auf einem Hüttenfundament ein."
                  : buildable.placement === "shallow-water"
                    ? "Nur im Flachwasser platzierbar."
                    : "Auf eine bestehende Floßbasis setzen.",
          iconText: buildable.category === "raft" ? "≈" : buildable.category === "building" ? "▦" : buildable.category === "crafting" ? "⌁" : "+",
          ingredients: [{ itemId: buildable.id, label: ITEM_CATALOG[buildable.id].label, owned, required: 1 }],
          available: owned > 0 && !hammerMissing,
          ...(hammerMissing
            ? { lockedReason: "Bauhammer benötigt" }
            : owned === 0
              ? { lockedReason: "Bausatz zuerst herstellen" }
              : {}),
        };
      });
    return { categories, activeCategory: this.currentBuildCategory, options, ...(this.selectedBuild ? { selectedBuildId: this.selectedBuild } : {}) };
  }

  private createNotebookViewModel(): NotebookViewModel {
    const notebook = this.notebook.serialize();
    const discoveredLetters = new Set(notebook.discoveredLetterIds);
    return {
      storyEntries: LORE_LETTERS
        .filter((letter) => discoveredLetters.has(letter.id))
        .sort((left, right) => left.sequence - right.sequence)
        .map((letter) => ({ ...letter })),
      islands: notebook.islands.map((entry) => {
        const island = getIsland(entry.islandId);
        return {
          id: island.id,
          name: island.name,
          description: island.description,
          visitedDay: entry.visitedDay,
          resources: entry.resourceIds.map((itemId) => ({
            id: itemId,
            label: ITEM_CATALOG[itemId].label,
            iconText: ITEM_ICONS[itemId] ?? "◆",
          })),
          animals: entry.animalIds.map((animalId) => ({
            id: animalId,
            ...NOTEBOOK_ANIMALS[animalId],
          })),
        };
      }),
      totalStoryEntries: LORE_LETTERS.length,
      totalIslands: WORLD_MANIFEST.islands.length,
    };
  }

  private refreshUi(): void {
    if (this.state !== "playing" && this.state !== "paused") return;
    this.ui.updateHud(this.createHudViewModel());
    this.ui.updateInventory(this.createInventoryViewModel());
    if (this.activeChestId) this.ui.updateStorage(this.createStorageViewModel());
    this.ui.updateCrafting(this.createCraftingViewModel());
    this.ui.updateBuild(this.createBuildViewModel());
    this.ui.updateNotebook(this.createNotebookViewModel());
  }

  private selectedItemId(): ItemId | null {
    return this.hotbarItems()[this.selectedHotbarIndex] ?? null;
  }

  private heldItemId(): ItemId | null {
    if (this.selectedBuild && this.placementInventoryItemId === "portable_workbench") return null;
    if (this.selectedBuild && this.inventory.count("building_hammer") > 0) return "building_hammer";
    return this.selectedItemId();
  }

  private hotbarItems(): ItemId[] {
    const priorities: ItemId[] = ["obsidian_knife", "stone_knife", "stone_axe", "wooden_spear", "shovel", "building_hammer", "fishing_rod", "climbing_kit", "paddle", "simple_bandage", "bandage", "herbal_antidote", "raw_fish", "cooked_fish", "raw_meat", "cooked_meat", "smoked_meat", "crab", "cooked_crab", "coconut"];
    const result = priorities.filter((id) => this.inventory.count(id) > 0).slice(0, 4);
    for (const stack of this.inventory.stacks) {
      if (result.length >= 4) break;
      if (ITEM_CATALOG[stack.itemId].category === "equipment" || ITEM_CATALOG[stack.itemId].category === "buildable") continue;
      if (!result.includes(stack.itemId)) result.push(stack.itemId);
    }
    return result;
  }

  private handleHotbarKeys(input: InputSnapshot): void {
    (["hotbar1", "hotbar2", "hotbar3", "hotbar4"] as const).forEach((action, index) => {
      if (input.pressed.has(action)) this.selectedHotbarIndex = index;
    });
  }

  private isNearWorkbench(): boolean {
    const position = this.physics?.getPlayerPosition();
    return Boolean(position && this.world?.findNearestBuilding("workbench", position, 4));
  }

  private patchVitals(patch: Partial<SurvivalState>): void {
    this.survival = { ...this.survival, ...patch };
  }

  private isEquipped(itemId: ItemId): boolean {
    return (itemId === "woven_shirt" && this.equippedShirt) || (itemId === "backpack" && this.equippedBackpack);
  }

  private notifyWeatherTransition(): void {
    if (this.weather.kind === this.previousWeatherKind) return;
    const hadPreviousWeather = this.previousWeatherKind !== null;
    this.previousWeatherKind = this.weather.kind;
    if (!hadPreviousWeather) return;
    const text = this.weather.kind === "rain"
      ? "Regen setzt ein – es wird kalt und Wasserbehälter füllen sich schneller."
      : this.weather.kind === "heat"
        ? "Die Hitze steigt – du brauchst deutlich mehr Wasser."
        : this.weather.kind === "storm"
          ? "Ein kaltes Gewitter zieht auf – das Meer wird rau und Blitze können Feuer und Bäume treffen."
          : "Der Himmel klart auf.";
    this.ui.addToast({ text, tone: this.weather.kind === "storm" || this.weather.kind === "heat" ? "warning" : "info", durationMs: 5_000 });
  }

  private notifyColdTransition(): void {
    if (this.isCold === this.previousCold) return;
    const hadPreviousState = this.previousCold !== null;
    this.previousCold = this.isCold;
    if (!hadPreviousState) return;
    this.ui.addToast({
      text: this.isCold
        ? "Dir ist kalt. Deine maximale Ausdauer sinkt – zieh Kleidung an oder bleib nahe an einem brennenden Lagerfeuer."
        : "Dir ist wieder warm. Deine maximale Ausdauer erholt sich langsam.",
      tone: this.isCold ? "warning" : "success",
      durationMs: 6_000,
    });
  }

  private notifyFatigueTransition(): void {
    const level: FatigueLevel = this.survival.fatigue >= 80
      ? "exhausted"
      : this.survival.fatigue >= 50
        ? "tired"
        : "rested";
    if (level === this.previousFatigueLevel) return;
    const previous = this.previousFatigueLevel;
    this.previousFatigueLevel = level;
    if (previous === null || level === "rested") return;
    this.ui.addToast({
      text: level === "exhausted"
        ? "Du bist völlig erschöpft. Sprinten ist nicht mehr möglich – finde ein Bett und schlafe."
        : "Du wirst müde. Deine Ausdauer erholt sich langsamer.",
      tone: level === "exhausted" ? "danger" : "warning",
      durationMs: 7_000,
    });
  }

  private handlePanelChanged(panel: UiPanel | null): void {
    if (panel !== "storage" && this.activeChestId) {
      this.activeChestId = null;
      if (this.state === "playing") void this.saveGame(false);
    }
    if (panel === "crafting" && this.openingWorkbench) {
      this.openingWorkbench = false;
    } else if (panel === null) {
      this.openingWorkbench = false;
      if (this.craftingStation !== "hand") {
        this.craftingStation = "hand";
        this.currentCraftCategory = "Alle";
        this.ui.updateCrafting(this.createCraftingViewModel());
      }
    }
    this.panelOpen = panel;
    if (panel) {
      this.suppressPointerPause = true;
      this.exitPointerLock();
    } else if (this.state === "playing") this.requestPointerLock();
  }

  private applySettings(settings: SettingsViewModel, persist = true): void {
    this.settings = structuredClone(settings);
    this.ui.updateSettings(this.settings);
    if (persist) void this.settingsRepository.save(createPersistedSettings(this.settings)).catch((error) => {
      console.warn("Einstellungen konnten nicht dauerhaft gespeichert werden.", error);
    });
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
    this.toolView.setProjection(settings.fov, this.camera.aspect);
    this.input.setLookSettings(0.0014 + settings.sensitivity * 0.0014, false);
    this.audio.setMasterVolume(settings.audio.master);
    this.audio.setBusVolume("ambience", settings.audio.ambience);
    this.audio.setBusVolume("sfx", settings.audio.effects);
    this.audio.setBusVolume("ui", settings.audio.ui);
    const pixelRatio = settings.quality === "low"
      ? 1
      : settings.quality === "medium"
        ? Math.min(devicePixelRatio, 1.25)
        : settings.quality === "high"
          ? Math.min(devicePixelRatio, 1.5)
          : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.world?.setQuality(settings.quality);
    this.resize();
  }

  private locationLabel(position: Vec3Like): string {
    return this.world?.getIslandAt(position.x, position.z)?.name ?? "Offener Ozean";
  }

  private recordLootDiscoveries(
    loot: readonly LootStack[] | readonly { itemId: ItemId; quantity: number }[],
  ): void {
    const position = this.physics?.getPlayerPosition();
    const island = position ? this.world?.getIslandAt(position.x, position.z) : null;
    const islandId = island?.id ?? this.currentIslandId;
    if (!islandId) return;
    const discoveries: string[] = [];
    for (const entry of loot) {
      if (this.notebook.discoverResource(islandId, entry.itemId, this.day)) {
        discoveries.push(ITEM_CATALOG[entry.itemId].label);
      }
      if (entry.itemId === "crab" && this.notebook.discoverAnimal(islandId, "crab", this.day)) {
        discoveries.push(NOTEBOOK_ANIMALS.crab.label);
      }
      if (entry.itemId === "raw_fish" && this.notebook.discoverAnimal(islandId, "fish", this.day)) {
        discoveries.push(NOTEBOOK_ANIMALS.fish.label);
      }
    }
    if (discoveries.length === 0) return;
    this.ui.updateNotebook(this.createNotebookViewModel());
    this.ui.addToast({
      id: "notebook-discovery",
      text: `Notizbuch ergänzt: ${[...new Set(discoveries)].join(", ")}.`,
      tone: "info",
      durationMs: 3_600,
    });
    void this.saveGame(false);
  }

  private recordAnimalDiscovery(animalId: NotebookAnimalId): void {
    const position = this.physics?.getPlayerPosition();
    const island = position ? this.world?.getIslandAt(position.x, position.z) : null;
    const islandId = island?.id ?? this.currentIslandId;
    if (!islandId || !this.notebook.discoverAnimal(islandId, animalId, this.day)) return;
    this.ui.updateNotebook(this.createNotebookViewModel());
    this.ui.addToast({
      id: "notebook-discovery",
      text: `Tier im Notizbuch vermerkt: ${NOTEBOOK_ANIMALS[animalId].label}.`,
      tone: "info",
      durationMs: 3_600,
    });
    void this.saveGame(false);
  }

  private discoverNearbyWildlife(playerPosition: Vec3Like): void {
    const world = this.world;
    if (!world) return;
    const discoveries: NotebookAnimalId[] = [];
    for (const animal of world.getWildlifePositions()) {
      const dx = animal.position.x - playerPosition.x;
      const dz = animal.position.z - playerPosition.z;
      if (dx * dx + dz * dz > 18 * 18) continue;
      const island = world.getIslandAt(animal.position.x, animal.position.z);
      if (island && this.notebook.discoverAnimal(island.id, animal.kind, this.day)) {
        discoveries.push(animal.kind);
      }
    }
    if (discoveries.length === 0) return;
    this.ui.updateNotebook(this.createNotebookViewModel());
    this.ui.addToast({
      id: "notebook-discovery",
      text: `Tierwelt entdeckt: ${discoveries.map((id) => NOTEBOOK_ANIMALS[id].label).join(", ")}.`,
      tone: "info",
      durationMs: 4_200,
    });
    void this.saveGame(false);
  }

  private updateIslandDiscovery(position: Vec3Like): void {
    const island = this.world?.getIslandAt(position.x, position.z);
    if (!island) return;
    const firstVisit = this.notebook.visitIsland(island.id, this.day);
    if (firstVisit) {
      this.ui.updateNotebook(this.createNotebookViewModel());
      void this.saveGame(false);
    }
    if (island.id === this.currentIslandId) return;
    this.currentIslandId = island.id;
    this.ui.addToast({
      text: firstVisit
        ? `${island.name} entdeckt und ins Notizbuch eingetragen – ${island.description}`
        : `${island.name} erreicht.`,
      tone: firstVisit ? "success" : "info",
      durationMs: firstVisit ? 7_000 : 3_500,
    });
  }

  private defaultSpawn(): Vec3Like {
    const x = -5;
    const z = 0;
    return { x, y: (this.world?.heightAt(x, z) ?? 3.5) + 1, z };
  }

  private installDebugApi(): void {
    if (!import.meta.env.DEV) return;
    window.__stranded2Debug = {
      snapshot: () => ({
        state: this.state,
        position: this.physics?.getPlayerPosition() ?? null,
        inventory: this.inventory.stacks,
        survival: this.survival,
        day: this.day,
        selectedBuild: this.selectedBuild,
        heldTool: this.heldItemId(),
        raft: this.world?.getRaft() ?? null,
        onRaft: this.onRaft,
        mapOpen: this.mapOpen,
        fishSchools: this.world?.getFishSchoolPositions() ?? [],
        wildlife: this.world?.getWildlifePositions() ?? [],
        weather: this.weather,
        equipment: { wovenShirt: this.equippedShirt, backpack: this.equippedBackpack },
        conditions: { brackwaterSicknessSeconds: this.brackwaterSicknessSeconds, poisonSecondsRemaining: this.poisonSecondsRemaining, isBleeding: this.isBleeding },
        world: this.world?.serialize() ?? null,
      }),
      grant: (items) => {
        for (const item of items) this.inventory.add(item.itemId, item.count);
        this.refreshUi();
      },
      teleport: (x, y, z) => this.physics?.setPlayerPosition({ x, y, z }),
      lookAt: (x, y, z) => {
        const player = this.physics?.getPlayerPosition();
        if (!player) return;
        const dx = x - player.x;
        const dz = z - player.z;
        this.yaw = Math.atan2(-dx, -dz);
        this.pitch = clamp(Math.atan2(y - (player.y + 0.65), Math.hypot(dx, dz)), -1.45, 1.45);
      },
      teleportToIsland: (island) => {
        const islandId: IslandId = island === "start" ? "kleine-sandbank" : island === "jungle" ? "dschungelbucht" : island;
        const definition = getIsland(islandId);
        const x = definition.positionMeters.x + definition.safeLanding.offsetMeters.x;
        const z = definition.positionMeters.z + definition.safeLanding.offsetMeters.z;
        const towardCenterX = definition.positionMeters.x - x;
        const towardCenterZ = definition.positionMeters.z - z;
        this.yaw = Math.atan2(-towardCenterX, -towardCenterZ);
        this.pitch = 0;
        this.physics?.setPlayerPosition({ x, y: (this.world?.heightAt(x, z) ?? 2) + 1, z });
      },
      swingTool: () => this.toolView.triggerUse(),
      attack: () => {
        this.toolView.triggerUse();
        this.attack();
      },
      craft: (recipeId) => this.craft(recipeId, 1, true),
      use: (itemId) => {
        const index = this.inventory.slots.findIndex((stack) => stack?.itemId === itemId);
        if (index < 0) return false;
        this.useInventoryItem(`slot-${index}`);
        return true;
      },
      build: (buildId, x, z) => {
        const world = this.world;
        const recipe = RECIPE_CATALOG[buildId as RecipeId];
        if (!world || !recipe || recipe.output.kind !== "buildable" || this.inventory.count("building_hammer") === 0) return false;
        if (!this.inventory.consume(recipe.ingredients)) return false;
        if (buildId === "raft_base") {
          if (!world.createRaftBase({ x, y: 0.35, z }, 0)) return false;
        } else if (buildId === "raft_deck") {
          if (!world.addRaftDeck()) return false;
        } else if (buildId === "fish_trap") {
          world.createBuilding("fish_trap", { x, y: 0.04, z }, 0);
        } else if (buildId.startsWith("hut_")) {
          const placement = world.getHutPlacementAt(buildId, x, z);
          if (!placement.valid) return false;
          world.createBuilding(buildId, placement.position, placement.rotationY);
        } else {
          world.createBuilding(buildId, { x, y: world.heightAt(x, z), z }, 0);
        }
        this.damageTool("building_hammer", 1);
        this.refreshUi();
        return true;
      },
      interactBuilding: (id) => {
        const building = this.world?.getBuilding(id);
        if (!building) return false;
        this.interactBuilding(id);
        return true;
      },
      climb: (id) => this.climbMountain(id),
      readLetter: (id) => this.openLoreLetter(id),
      setCookingProgress: (id, seconds) => {
        const building = this.world?.getBuilding(id);
        if (!building || building.type !== "campfire" || !Number.isFinite(seconds)) return false;
        building.cookingProgress = Math.max(0, seconds);
        return true;
      },
      setFishTrapProgress: (id, seconds) => {
        const building = this.world?.getBuilding(id);
        if (!building || building.type !== "fish_trap" || !Number.isFinite(seconds)) return false;
        building.fishTrapProgress = clamp(seconds, 0, 120);
        return true;
      },
      setSmokingProgress: (id, seconds) => {
        const building = this.world?.getBuilding(id);
        if (!building || building.type !== "smoking_rack" || !Number.isFinite(seconds)) return false;
        building.smokerProgress = clamp(seconds, 0, 90);
        return true;
      },
      setDayElapsedSeconds: (seconds) => {
        if (!Number.isFinite(seconds)) return;
        this.survival = {
          ...this.survival,
          dayElapsedSeconds: clamp(seconds, 0, DAY_LENGTH_SECONDS - Number.EPSILON),
        };
        this.refreshUi();
      },
      setWeather: (kind) => {
        this.weatherOverride = kind;
        this.weather = kind ? weatherState(kind) : getWeatherState(this.day, this.survival.dayElapsedSeconds);
        this.previousWeatherKind = null;
        this.refreshUi();
      },
      lightning: () => {
        const position = this.physics?.getPlayerPosition();
        if (!position) return [];
        const events = this.world?.forceLightningStrike(position) ?? [];
        for (const event of events) this.ui.addToast({ text: event.text, tone: event.type === "player-damage" ? "danger" : "info" });
        return events;
      },
      enterRaft: () => {
        const raft = this.world?.getRaft();
        if (!raft?.hasDeck || this.inventory.count("paddle") === 0 || !this.physics) return false;
        this.onRaft = true;
        this.physics.setPlayerEnabled(false);
        this.anchorPlayerToRaft();
        return true;
      },
      moveRaft: (x, z) => {
        const raft = this.world?.getRaft();
        if (!raft || !this.physics) return;
        this.physics.setRaftPose(raft.id, { x, y: 0.45, z }, { x: 0, y: 0, z: 0, w: 1 });
        this.anchorPlayerToRaft();
      },
      exitRaft: () => this.disembarkRaft(),
      save: async () => {
        await this.saveGame();
      },
      damage: (amount) => this.damagePlayer(amount, "Debug-Schaden"),
      injure: (amount) => this.damagePlayer(amount, "Debug-Verletzung", true),
      drinkBrackwater: () => this.drinkBrackwater(),
      poison: () => this.poisonPlayer("Debug-Vergiftung."),
      spoilFood: (seconds) => {
        if (Number.isFinite(seconds) && seconds >= 0) this.advanceFoodSpoilage(seconds);
      },
      setFatigue: (value) => {
        if (!Number.isFinite(value)) return;
        this.patchVitals({ fatigue: clamp(value, 0, 100) });
        this.notifyFatigueTransition();
        this.refreshUi();
      },
      toggleMap: () => {
        this.mapOpen = !this.mapOpen;
        this.refreshUi();
        return this.mapOpen;
      },
    };
  }

  private requestPointerLock(): void {
    if (this.state !== "playing" || this.panelOpen || document.pointerLockElement === this.renderer.domElement) return;
    void this.renderer.domElement.requestPointerLock().catch(() => {
      this.ui.addToast({ text: "Klicke in die Spielwelt, um die Maussteuerung zu aktivieren.", tone: "info" });
    });
  }

  private exitPointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private readonly onCanvasClick = (): void => {
    if (this.state === "playing" && !this.panelOpen) this.requestPointerLock();
  };

  private readonly onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.ui.setPointerLockActive(locked);
    this.input.setEnabled(locked && this.state === "playing");
    if (this.pointerWasLocked && !locked && this.state === "playing" && !this.panelOpen) {
      if (this.suppressPointerPause) this.suppressPointerPause = false;
      else void this.pauseGame();
    }
    this.pointerWasLocked = locked;
  };

  private readonly onPointerLockError = (): void => {
    this.input.setEnabled(false);
    this.ui.addToast({ text: "Maussteuerung wurde vom Browser abgelehnt. Klicke erneut in die Spielwelt.", tone: "warning" });
  };

  private readonly onWindowBlur = (): void => {
    if (this.state === "playing" && !this.panelOpen) void this.pauseGame();
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.suppressPointerPause = true;
    this.exitPointerLock();
    this.state = "paused";
    this.ui.showLoading({ title: "Grafikkontext verloren", message: "Die 3D-Darstellung wird wiederhergestellt …", progress: 0.5 });
  };

  private readonly onContextRestored = (): void => {
    this.state = "paused";
    this.ui.showPause({ locationLabel: this.locationLabel(this.physics?.getPlayerPosition() ?? this.defaultSpawn()), playedFor: formatDuration(this.playedSeconds), saveStatus: "saved" });
  };

  private readonly resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.toolView.setProjection(this.settings.fov, this.camera.aspect);
    this.renderer.setSize(width, height, false);
  };
}

function loadSettings(): SettingsViewModel {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(stored) as Partial<SettingsViewModel>;
    const merged: SettingsViewModel = {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      audio: { ...DEFAULT_SETTINGS.audio, ...parsed.audio },
    };
    return isPersistedSettingsV1({ schemaVersion: 1, settings: merged }) ? merged : structuredClone(DEFAULT_SETTINGS);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return hours > 0 ? `${hours} Std. ${minutes} Min.` : `${Math.max(1, minutes)} Min.`;
}
