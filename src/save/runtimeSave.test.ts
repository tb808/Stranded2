import { describe, expect, it } from "vitest";
import { isRuntimeSaveV1, type RuntimeSaveV1 } from "./runtimeSave";

function validSave(): RuntimeSaveV1 {
  return {
    schemaVersion: 1,
    contentVersion: "0.1.0",
    savedAtUnixMs: 1_700_000_000_000,
    day: 2,
    playedSeconds: 400,
    player: {
      position: { x: 2, y: 3, z: 4 },
      spawnPoint: { x: -8, y: 3, z: 0 },
      yaw: 0.4,
      pitch: -0.2,
      inventory: [{ itemId: "fiber", quantity: 8 }],
      survival: {
        health: 100,
        hunger: 65,
        thirst: 55,
        stamina: 90,
        maxStamina: 90,
        oxygen: 100,
        fatigue: 0,
        staminaRegenDelayRemaining: 0,
        dayElapsedSeconds: 320,
      },
      toolDurability: { stone_knife: 42 },
    },
    world: {
      removedEntityIds: ["stick-start-1"],
      removedEntityDays: { "stick-start-1": 1 },
      buildings: [],
      raft: null,
      wreckLooted: false,
      sharkAlive: true,
      deathPacks: [],
      dynamicDrops: [{ id: "drop-1", itemId: "stick", count: 2, position: { x: 1, y: 1, z: 1 } }],
    },
    deathPacks: [],
  };
}

describe("RuntimeSaveV1", () => {
  it("akzeptiert einen vollständig gültigen Laufzeit-Spielstand", () => {
    expect(isRuntimeSaveV1(validSave())).toBe(true);
  });

  it("speichert gefundene Briefe sowie Insel-, Rohstoff- und Tierentdeckungen", () => {
    const save = validSave();
    save.notebook = {
      discoveredLetterIds: ["letter-start-beach"],
      islands: [{
        islandId: "kleine-sandbank",
        visitedDay: 1,
        resourceIds: ["coconut", "fiber"],
        animalIds: ["crab"],
      }],
    };
    expect(isRuntimeSaveV1(save)).toBe(true);

    (save.notebook.islands[0] as unknown as Record<string, unknown>).animalIds = ["dragon"];
    expect(isRuntimeSaveV1(save)).toBe(false);
  });

  it("akzeptiert ältere Spielstände ohne Notizbuch", () => {
    const save = validSave() as unknown as Record<string, unknown>;
    delete save.notebook;
    expect(isRuntimeSaveV1(save)).toBe(true);
  });

  it("weist beschädigte verschachtelte Inventar- und Vitaldaten zurück", () => {
    const save = validSave() as unknown as Record<string, any>;
    save.player.inventory[0].itemId = "unbekannt";
    save.player.survival.thirst = Number.NaN;
    expect(isRuntimeSaveV1(save)).toBe(false);
  });

  it("weist ungültige Bau- und Dropdaten zurück", () => {
    const invalidBuilding = validSave() as unknown as Record<string, any>;
    invalidBuilding.world.buildings.push({ id: "x", type: "raft_base", position: { x: 0, y: 0, z: 0 }, rotationY: 0, waterCharges: 0, waterProgress: 0, fireFuel: 0, cookingProgress: 0 });
    expect(isRuntimeSaveV1(invalidBuilding)).toBe(false);

    const invalidDrop = validSave() as unknown as Record<string, any>;
    invalidDrop.world.dynamicDrops[0].count = -1;
    expect(isRuntimeSaveV1(invalidDrop)).toBe(false);
  });

  it("lädt Spielstände der Inhaltsversion 0.1.0 auch vor Einführung dynamischer Drops", () => {
    const legacyShape = validSave() as unknown as Record<string, any>;
    delete legacyShape.world.dynamicDrops;
    delete legacyShape.world.removedEntityDays;
    delete legacyShape.player.survival.maxStamina;
    expect(isRuntimeSaveV1(legacyShape)).toBe(true);
  });

  it("validiert die reduzierte maximale Ausdauer", () => {
    const valid = validSave() as unknown as Record<string, any>;
    valid.player.survival.stamina = 64;
    valid.player.survival.maxStamina = 70;
    expect(isRuntimeSaveV1(valid)).toBe(true);

    valid.player.survival.stamina = 71;
    expect(isRuntimeSaveV1(valid)).toBe(false);
  });

  it("speichert Müdigkeit und lädt ältere Spielstände ohne Müdigkeitswert als ausgeruht", () => {
    const save = validSave() as unknown as Record<string, any>;
    save.player.survival.fatigue = 82;
    expect(isRuntimeSaveV1(save)).toBe(true);

    save.player.survival.fatigue = 101;
    expect(isRuntimeSaveV1(save)).toBe(false);
    delete save.player.survival.fatigue;
    expect(isRuntimeSaveV1(save)).toBe(true);
  });

  it("speichert eine laufende Brackwasserkrankheit und akzeptiert ältere Spielstände ohne Zustandsfeld", () => {
    const save = validSave() as unknown as Record<string, any>;
    save.player.conditions = { brackwaterSicknessSeconds: 31.5 };
    expect(isRuntimeSaveV1(save)).toBe(true);

    save.player.conditions.brackwaterSicknessSeconds = 51;
    expect(isRuntimeSaveV1(save)).toBe(false);
    delete save.player.conditions;
    expect(isRuntimeSaveV1(save)).toBe(true);
  });

  it("speichert eine Vergiftung und akzeptiert ältere Zustandsfelder ohne Giftwert", () => {
    const save = validSave() as unknown as Record<string, any>;
    save.player.conditions = { brackwaterSicknessSeconds: 0, poisonSecondsRemaining: 900 };
    expect(isRuntimeSaveV1(save)).toBe(true);

    save.player.conditions.poisonSecondsRemaining = 1_801;
    expect(isRuntimeSaveV1(save)).toBe(false);
    delete save.player.conditions.poisonSecondsRemaining;
    expect(isRuntimeSaveV1(save)).toBe(true);
  });

  it("speichert eine Blutung und akzeptiert ältere Zustandsfelder ohne Blutungswert", () => {
    const save = validSave() as unknown as Record<string, any>;
    save.player.conditions = { brackwaterSicknessSeconds: 0, isBleeding: true };
    expect(isRuntimeSaveV1(save)).toBe(true);

    save.player.conditions.isBleeding = "ja";
    expect(isRuntimeSaveV1(save)).toBe(false);
    delete save.player.conditions.isBleeding;
    expect(isRuntimeSaveV1(save)).toBe(true);
  });

  it("speichert die Resthaltbarkeit von Nahrung und akzeptiert alte Stapel ohne Frischewert", () => {
    const save = validSave() as unknown as Record<string, any>;
    save.player.inventory = [{ itemId: "raw_fish", quantity: 2, spoilageSecondsRemaining: 200 }];
    expect(isRuntimeSaveV1(save)).toBe(true);

    save.player.inventory[0].spoilageSecondsRemaining = 601;
    expect(isRuntimeSaveV1(save)).toBe(false);
    save.player.inventory = [{ itemId: "stone", quantity: 1, spoilageSecondsRemaining: 100 }];
    expect(isRuntimeSaveV1(save)).toBe(false);
    delete save.player.inventory[0].spoilageSecondsRemaining;
    expect(isRuntimeSaveV1(save)).toBe(true);
  });

  it("validiert Truheninhalte und akzeptiert alte Truhen ohne Lagerfeld", () => {
    const chest: Record<string, any> = {
      id: "building-1",
      type: "chest",
      position: { x: 0, y: 1, z: 0 },
      rotationY: 0,
      waterCharges: 0,
      waterProgress: 0,
      fireFuel: 0,
      cookingProgress: 0,
      storedItems: [{ itemId: "stone", quantity: 7 }],
    };
    const save = validSave() as unknown as Record<string, any>;
    save.world.buildings.push(chest);
    expect(isRuntimeSaveV1(save)).toBe(true);

    delete chest.storedItems;
    expect(isRuntimeSaveV1(save)).toBe(true);
  });

  it("akzeptiert ausgerüstete Rucksäcke mit bis zu 36 Stapeln und alte Spielstände ohne Ausrüstung", () => {
    const legacy = validSave();
    expect(isRuntimeSaveV1(legacy)).toBe(true);

    const equipped = validSave() as unknown as Record<string, any>;
    equipped.player.equipment = { wovenShirt: true, backpack: true };
    equipped.player.inventory = [
      { itemId: "backpack", quantity: 1 },
      { itemId: "woven_shirt", quantity: 1 },
      ...Array.from({ length: 34 }, () => ({ itemId: "fiber", quantity: 1 })),
    ];
    expect(isRuntimeSaveV1(equipped)).toBe(true);
  });

  it("verwirft Ausrüstung ohne passenden Gegenstand und überfüllte Basisinventare", () => {
    const missingItem = validSave() as unknown as Record<string, any>;
    missingItem.player.equipment = { wovenShirt: false, backpack: true };
    expect(isRuntimeSaveV1(missingItem)).toBe(false);

    const overflowing = validSave() as unknown as Record<string, any>;
    overflowing.player.inventory = Array.from({ length: 25 }, () => ({ itemId: "fiber", quantity: 1 }));
    expect(isRuntimeSaveV1(overflowing)).toBe(false);
  });

  it("erlaubt dem Regenfänger fünf gespeicherte Wasserportionen", () => {
    const save = validSave() as unknown as Record<string, any>;
    save.world.buildings.push({
      id: "building-rain",
      type: "rain_collector",
      position: { x: 0, y: 1, z: 0 },
      rotationY: 0,
      waterCharges: 5,
      waterProgress: 0,
      fireFuel: 0,
      cookingProgress: 0,
    });
    expect(isRuntimeSaveV1(save)).toBe(true);
    save.world.buildings[0].waterCharges = 6;
    expect(isRuntimeSaveV1(save)).toBe(false);
  });

  it("validiert Köder, Fangfortschritt und Vorrat einer Fischreuse", () => {
    const save = validSave() as unknown as Record<string, any>;
    save.world.buildings.push({
      id: "building-trap",
      type: "fish_trap",
      position: { x: -440, y: 0.04, z: 270 },
      rotationY: 0,
      waterCharges: 0,
      waterProgress: 0,
      fireFuel: 0,
      cookingProgress: 0,
      fishTrapProgress: 75,
      fishTrapStored: 2,
      fishTrapBaited: true,
    });
    expect(isRuntimeSaveV1(save)).toBe(true);

    save.world.buildings[0].fishTrapStored = 4;
    expect(isRuntimeSaveV1(save)).toBe(false);
    save.world.buildings[0].fishTrapStored = 2;
    save.world.buildings[0].fishTrapProgress = 121;
    expect(isRuntimeSaveV1(save)).toBe(false);
  });

  it("validiert laufende und fertige Chargen eines Räuchergestells", () => {
    const rack = {
      id: "building-smoker",
      type: "smoking_rack",
      position: { x: 264, y: 0.8, z: 0 },
      rotationY: 0,
      waterCharges: 0,
      waterProgress: 0,
      fireFuel: 0,
      cookingProgress: 0,
      smokerProgress: 45,
      smokerInputCount: 3,
      smokerReadyCount: 0,
    };
    const save = validSave() as unknown as Record<string, any>;
    save.world.buildings.push(rack);
    expect(isRuntimeSaveV1(save)).toBe(true);

    rack.smokerReadyCount = 3;
    expect(isRuntimeSaveV1(save)).toBe(false);
    rack.smokerInputCount = 0;
    rack.smokerProgress = 91;
    expect(isRuntimeSaveV1(save)).toBe(false);
  });

  it("verwirft zu viele, unbekannte oder überfüllte Truhenstapel", () => {
    const chest = {
      id: "building-1",
      type: "chest",
      position: { x: 0, y: 1, z: 0 },
      rotationY: 0,
      waterCharges: 0,
      waterProgress: 0,
      fireFuel: 0,
      cookingProgress: 0,
      storedItems: Array.from({ length: 17 }, () => ({ itemId: "stone", quantity: 1 })),
    };
    const save = validSave() as unknown as Record<string, any>;
    save.world.buildings.push(chest);
    expect(isRuntimeSaveV1(save)).toBe(false);

    chest.storedItems = [{ itemId: "stone", quantity: 17 }];
    expect(isRuntimeSaveV1(save)).toBe(false);
    chest.storedItems = [{ itemId: "unbekannt", quantity: 1 }];
    expect(isRuntimeSaveV1(save)).toBe(false);
  });

  it("weist doppelte persistente Welt-IDs und extreme Koordinaten zurück", () => {
    const duplicate = validSave() as unknown as Record<string, any>;
    duplicate.world.deathPacks.push({ id: "drop-1", position: { x: 0, y: 1, z: 0 }, loot: [] });
    expect(isRuntimeSaveV1(duplicate)).toBe(false);

    const extreme = validSave() as unknown as Record<string, any>;
    extreme.player.position.x = Number.MAX_VALUE;
    expect(isRuntimeSaveV1(extreme)).toBe(false);
  });
});
