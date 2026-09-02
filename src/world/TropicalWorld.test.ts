import { BoxGeometry, BufferAttribute, FogExp2, Group, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Vector3, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import type { AssetService } from "../assets/AssetService";
import type { RapierPhysicsWorld } from "../physics/RapierPhysicsWorld";
import { LORE_LETTERS } from "../data/loreLetters";
import { WORLD_MANIFEST, getIsland } from "../data/worldManifest";
import { weatherState } from "../gameplay/model/weather";
import { createBuildVisual, createLoreLetterVisual, ISLAND_TERRAIN_STRUCTURES, ISLAND_WILDLIFE, TropicalWorld, WORLD_SCENERY_MODEL_IDS } from "./TropicalWorld";

function createWorld(assets: AssetService = { createModel: () => null } as unknown as AssetService): TropicalWorld {
  const physics = { addFixedCuboid: () => ({}), removeColliderBody: () => undefined } as unknown as RapierPhysicsWorld;
  return new TropicalWorld(physics, assets);
}

async function createInitializedWorld(): Promise<TropicalWorld> {
  const physics = {
    addFixedCuboid: () => ({}),
    addFixedCylinder: () => ({}),
    addTerrain: () => undefined,
    removeColliderBody: () => undefined,
  } as unknown as RapierPhysicsWorld;
  const assets = {
    createModel: () => null,
    preloadModels: async (_ids: readonly string[], onProgress?: (progress: number) => void) => onProgress?.(1),
  } as unknown as AssetService;
  const world = new TropicalWorld(physics, assets);
  await world.initialize();
  return world;
}

function findEntityObject(world: TropicalWorld, id: string): Object3D {
  let result: Object3D | null = null;
  world.scene.traverse((object) => {
    if (object.userData.entityId === id) result = object;
  });
  if (!result) throw new Error(`Weltobjekt ${id} wurde nicht gefunden.`);
  return result;
}

function groupByKey<T>(values: readonly T[], keyOf: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const members = groups.get(key) ?? [];
    members.push(value);
    groups.set(key, members);
  }
  return groups;
}

describe("TropicalWorld Bauplatzregeln", () => {
  it("entfernt eine aufgehobene Werkbank samt Kollision und aus dem Spielstand", () => {
    const removedColliders: unknown[] = [];
    const collider = { id: "workbench-collider" };
    const physics = {
      addFixedCuboid: () => collider,
      removeColliderBody: (removed: unknown) => removedColliders.push(removed),
    } as unknown as RapierPhysicsWorld;
    const world = new TropicalWorld(physics, { createModel: () => null } as unknown as AssetService);
    const workbench = world.createBuilding("workbench", { x: 0, y: 1, z: 0 }, 0);

    expect(world.pickupWorkbench(workbench.id)).toBe(true);
    expect(world.getBuilding(workbench.id)).toBeNull();
    expect(world.serialize().buildings).toHaveLength(0);
    expect(removedColliders).toEqual([collider]);
    expect(findEntityObject(world, workbench.id).visible).toBe(false);
    expect(world.pickupWorkbench(workbench.id)).toBe(false);
    world.dispose();
  });

  it("stellt gefundene Briefe als sichtbares Pergament mit Siegel dar", () => {
    const letter = createLoreLetterVisual();
    expect(letter.children.length).toBe(6);
    expect(letter.children.every((child) => child instanceof Mesh)).toBe(true);
  });

  it("erlaubt ebenen Inselboden und weist tiefes Wasser zurück", () => {
    const world = createWorld();
    const camera = new PerspectiveCamera();

    camera.position.set(-5, 6, 5);
    camera.lookAt(-5, 2, 0);
    camera.updateMatrixWorld(true);
    expect(world.getPlacementPosition(camera, "shelter", 0).valid).toBe(true);

    camera.position.set(170, 6, 100);
    camera.lookAt(170, 0, 90);
    camera.updateMatrixWorld(true);
    expect(world.getPlacementPosition(camera, "shelter", 0)).toMatchObject({
      valid: false,
      reason: "Hier ist der Boden zu steil oder blockiert.",
    });

    world.dispose();
  });

  it("erlaubt Fischreusen ausschließlich im flachen Innenwasser der Palmenlagune", () => {
    const world = createWorld();
    const camera = new PerspectiveCamera();
    camera.position.set(-440, 3, 274.8);
    camera.lookAt(-440, 0, 270);
    camera.updateMatrixWorld(true);
    expect(world.getPlacementPosition(camera, "fish_trap", 0)).toMatchObject({
      valid: true,
      position: { x: -440, y: 0.04, z: 270 },
    });

    camera.position.set(0, 3, 4.8);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    expect(world.getPlacementPosition(camera, "fish_trap", 0)).toMatchObject({
      valid: false,
      reason: "Die Fischreuse kann nur im flachen Innenwasser der Palmenlagune stehen.",
    });
    world.dispose();
  });

  it("erlaubt das Räuchergestell ausschließlich auf Boden der Dschungelbucht", () => {
    const world = createWorld();
    const camera = new PerspectiveCamera();
    camera.position.set(260.5, 4, 0);
    camera.lookAt(264, 1, 0);
    camera.updateMatrixWorld(true);
    expect(world.getPlacementPosition(camera, "smoking_rack", 0).valid).toBe(true);

    camera.position.set(-3.5, 4, 0);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld(true);
    expect(world.getPlacementPosition(camera, "smoking_rack", 0)).toMatchObject({
      valid: false,
      reason: "Das Räuchergestell kann nur auf ebenem Boden der Dschungelbucht stehen.",
    });
    world.dispose();
  });

  it("rastet Hüttenbauteile bündig an Fundamenten ein und verhindert doppelte Kanten", () => {
    const world = createWorld();
    world.createBuilding("hut_foundation", { x: 0, y: 2, z: 0 }, 0);
    const camera = new PerspectiveCamera();
    camera.position.set(0, 5, 7);
    camera.lookAt(0, 2, 0);
    camera.updateMatrixWorld(true);

    const wall = world.getPlacementPosition(camera, "hut_wall", 0.37);
    expect(wall.valid).toBe(true);
    expect(wall.position.toArray()).toEqual([0, 2, 2]);
    expect(wall.rotationY).toBe(0);

    world.createBuilding("hut_wall", wall.position, wall.rotationY);
    expect(world.getPlacementPosition(camera, "hut_doorway", 0).valid).toBe(false);

    const roof = world.getPlacementPosition(camera, "hut_roof", 1.2);
    expect(roof).toMatchObject({ valid: true, rotationY: 0 });
    expect(roof.position.toArray()).toEqual([0, 4.7, 0]);
    world.dispose();
  });

  it("rastet benachbarte Fundamente im Vier-Meter-Raster ein", () => {
    const world = createWorld();
    world.createBuilding("hut_foundation", { x: 0, y: 2, z: 0 }, 0);
    const camera = new PerspectiveCamera();
    camera.position.set(4.15, 6, 4.6);
    camera.lookAt(4.15, 2, 0);
    camera.updateMatrixWorld(true);

    const placement = world.getPlacementPosition(camera, "hut_foundation", 0.7);
    expect(placement.position.x).toBe(4);
    expect(placement.position.z).toBe(0);
    expect(placement.rotationY).toBe(0);
    world.dispose();
  });
});

describe("TropicalWorld Inselarchipel", () => {
  it("erkennt alle zehn Manifest-Inseln und erzeugt eine sichere Landefläche", () => {
    const world = createWorld();
    for (const island of WORLD_MANIFEST.islands) {
      expect(world.getIslandAt(island.positionMeters.x, island.positionMeters.z)?.id).toBe(island.id);
      const landingX = island.positionMeters.x + island.safeLanding.offsetMeters.x;
      const landingZ = island.positionMeters.z + island.safeLanding.offsetMeters.z;
      expect(world.heightAt(landingX, landingZ), `${island.name} Landestelle`).toBeGreaterThan(0.05);
      expect(world.getIslandAt(landingX, landingZ)?.id).toBe(island.id);
    }
    expect(world.getIslandAt(100, 600)).toBeNull();
    world.dispose();
  });

  it("gibt den neun Zielinseln unterschiedliche Terrain-Signaturen", () => {
    const world = createWorld();
    const lagoon = getIsland("palmenlagune");
    expect(world.heightAt(lagoon.positionMeters.x, lagoon.positionMeters.z)).toBeLessThan(0);
    expect(world.heightAt(
      lagoon.positionMeters.x - lagoon.dimensions.widthMeters * 0.32,
      lagoon.positionMeters.z,
    )).toBeGreaterThan(0.5);

    const mangrove = getIsland("mangrovenbucht");
    expect(world.heightAt(mangrove.positionMeters.x, mangrove.positionMeters.z)).toBeLessThan(0);
    expect(world.heightAt(
      mangrove.positionMeters.x,
      mangrove.positionMeters.z + mangrove.dimensions.depthMeters * 0.18,
    )).toBeGreaterThan(0.3);

    const reef = getIsland("felsenriff");
    expect(world.heightAt(reef.positionMeters.x, reef.positionMeters.z)).toBeGreaterThan(8);
    const waterfall = getIsland("wasserfallinsel");
    expect(world.heightAt(waterfall.positionMeters.x, waterfall.positionMeters.z)).toBeGreaterThan(20);
    const mountain = getIsland("dschungelberg");
    expect(world.heightAt(mountain.positionMeters.x, mountain.positionMeters.z)).toBeGreaterThan(45);
    expect(world.heightAt(mountain.positionMeters.x, mountain.positionMeters.z)).toBeGreaterThan(
      world.heightAt(waterfall.positionMeters.x, waterfall.positionMeters.z),
    );

    const volcano = getIsland("vulkaninsel");
    const volcanoPlatformHeights = [
      [-28, -22],
      [28, -22],
      [-28, 22],
      [28, 22],
      [4, -3],
    ].map(([x, z]) => world.heightAt(volcano.positionMeters.x + x!, volcano.positionMeters.z + z!));
    expect(Math.max(...volcanoPlatformHeights) - Math.min(...volcanoPlatformHeights)).toBeLessThan(0.02);
    expect(volcanoPlatformHeights[0]).toBeCloseTo(7.5, 2);
    expect(world.heightAt(volcano.positionMeters.x + 100, volcano.positionMeters.z)).toBeLessThan(12);
    const flowers = getIsland("blueteninsel");
    expect(world.heightAt(flowers.positionMeters.x - flowers.dimensions.widthMeters * 0.17, flowers.positionMeters.z)).toBeGreaterThan(7);
    const cliffs = getIsland("mondklippen");
    expect(world.heightAt(cliffs.positionMeters.x - cliffs.dimensions.widthMeters * 0.36, cliffs.positionMeters.z)).toBeLessThan(0);
    expect(world.heightAt(cliffs.positionMeters.x + cliffs.dimensions.widthMeters * 0.17, cliffs.positionMeters.z)).toBeGreaterThan(4);
    world.dispose();
  });

  it("formt jede große Insel aus mehreren Hochgebieten und eingeschnittenen Geländeläufen", () => {
    const world = createWorld();
    for (const [islandId, structure] of Object.entries(ISLAND_TERRAIN_STRUCTURES)) {
      const island = getIsland(islandId as keyof typeof ISLAND_TERRAIN_STRUCTURES);
      expect(structure.rises.length, `${island.name}: Hochgebiete`).toBeGreaterThanOrEqual(4);
      expect(structure.gorges.length, `${island.name}: Schluchten`).toBeGreaterThanOrEqual(2);
      const riseHeights = structure.rises.map((rise) => world.heightAt(
        island.positionMeters.x + rise.x * island.dimensions.widthMeters * 0.5,
        island.positionMeters.z + rise.z * island.dimensions.depthMeters * 0.5,
      ));
      const elevatedThreshold = island.terrainProfile.maximumHeightMeters * 0.2;
      expect(riseHeights.filter((height) => height > elevatedThreshold).length, island.name).toBeGreaterThanOrEqual(3);
    }
    world.dispose();
  });

  it("senkt die großen Schluchten sichtbar zwischen ihren Seitenwänden ab", () => {
    const world = createWorld();
    for (const islandId of ["dschungelbucht", "felsenriff", "wasserfallinsel", "dschungelberg"] as const) {
      const island = getIsland(islandId);
      const gorge = ISLAND_TERRAIN_STRUCTURES[islandId]!.gorges[0]!;
      const middleX = (gorge.fromX + gorge.toX) * 0.5;
      const middleZ = (gorge.fromZ + gorge.toZ) * 0.5;
      const segmentX = gorge.toX - gorge.fromX;
      const segmentZ = gorge.toZ - gorge.fromZ;
      const segmentLength = Math.hypot(segmentX, segmentZ);
      const offsetX = (-segmentZ / segmentLength) * gorge.width * 1.7;
      const offsetZ = (segmentX / segmentLength) * gorge.width * 1.7;
      const sample = (x: number, z: number) => world.heightAt(
        island.positionMeters.x + x * island.dimensions.widthMeters * 0.5,
        island.positionMeters.z + z * island.dimensions.depthMeters * 0.5,
      );
      const floor = sample(middleX, middleZ);
      const rim = Math.max(sample(middleX + offsetX, middleZ + offsetZ), sample(middleX - offsetX, middleZ - offsetZ));
      expect(rim - floor, island.name).toBeGreaterThan(0.45);
    }
    world.dispose();
  });

  it("formt organische Lagunen, verzweigte Mangrovenarme und trockene Ufer dazwischen", () => {
    const world = createWorld();
    const palmLagoon = getIsland("palmenlagune");
    const palmRadiusX = palmLagoon.dimensions.widthMeters * 0.5;
    const palmRadiusZ = palmLagoon.dimensions.depthMeters * 0.5;
    expect(world.heightAt(
      palmLagoon.positionMeters.x + palmRadiusX * 0.61,
      palmLagoon.positionMeters.z - palmRadiusZ * 0.025,
    )).toBeLessThan(0);

    const mangrove = getIsland("mangrovenbucht");
    const mangroveRadiusX = mangrove.dimensions.widthMeters * 0.5;
    const mangroveRadiusZ = mangrove.dimensions.depthMeters * 0.5;
    expect(world.heightAt(
      mangrove.positionMeters.x - mangroveRadiusX * 0.43,
      mangrove.positionMeters.z - mangroveRadiusZ * 0.39,
    )).toBeLessThan(0);
    expect(world.heightAt(
      mangrove.positionMeters.x + mangrove.dimensions.widthMeters * 0.275,
      mangrove.positionMeters.z + mangrove.dimensions.depthMeters * 0.15,
    )).toBeLessThan(0);
    expect(world.heightAt(
      mangrove.positionMeters.x,
      mangrove.positionMeters.z + mangroveRadiusZ * 0.42,
    )).toBeGreaterThan(0.3);
    world.dispose();
  });

  it("setzt Süßwasseroberflächen über ausgeformte Becken und baut lange, geglättete Bach-Meshes", async () => {
    const world = await createInitializedWorld();
    for (const name of ["Dschungelquellteich", "Quellsee", "Nebelpool", "Bergquellteich"] as const) {
      const water = world.scene.getObjectByName(`Gewässer: ${name}`)!;
      expect(water, name).toBeDefined();
      const surface = water.getObjectByName(`Wasserfläche: ${name}`)!;
      const surfacePosition = surface.getWorldPosition(new Vector3());
      expect(surfacePosition.y - world.heightAt(surfacePosition.x, surfacePosition.z), name).toBeGreaterThan(0.45);
      const positions = (surface as Mesh).geometry.getAttribute("position") as BufferAttribute;
      for (let index = 1; index < positions.count; index += 8) {
        const shoreX = surfacePosition.x + positions.getX(index);
        const shoreZ = surfacePosition.z + positions.getZ(index);
        expect(
          Math.abs(surfacePosition.y - world.heightAt(shoreX, shoreZ)),
          `${name}: geschlossene Uferkontur`,
        ).toBeLessThan(0.16);
      }
    }
    for (const name of ["Quellbach", "Quellfluss", "Bergbach"] as const) {
      const course = world.scene.getObjectByName(`Gewässer: ${name}`)!;
      expect(course, name).toBeDefined();
      const mesh = course.getObjectByName(`Wasserlauf: ${name}`) as Mesh;
      expect(mesh.geometry.getAttribute("position").count, name).toBeGreaterThan(60);
      const positions = mesh.geometry.getAttribute("position") as BufferAttribute;
      let previousSurfaceY = Number.POSITIVE_INFINITY;
      for (let index = 0; index < positions.count; index += 2) {
        const leftX = positions.getX(index);
        const leftY = positions.getY(index);
        const leftZ = positions.getZ(index);
        const rightX = positions.getX(index + 1);
        const rightY = positions.getY(index + 1);
        const rightZ = positions.getZ(index + 1);
        const centerX = course.position.x + (leftX + rightX) * 0.5;
        const centerZ = course.position.z + (leftZ + rightZ) * 0.5;
        const surfaceY = (leftY + rightY) * 0.5;
        const centerClearance = surfaceY - world.heightAt(centerX, centerZ);
        expect(surfaceY, `${name}: stetiges Gefälle`).toBeLessThanOrEqual(previousSurfaceY + 0.001);
        expect(
          centerClearance,
          `${name}: freier Flussquerschnitt`,
        ).toBeGreaterThan(0.14);
        const row = index / 2;
        const rowCount = positions.count / 2;
        if (centerClearance < 0.7 && row >= rowCount * 0.45 && row < rowCount - 4) {
          for (const edge of [[leftX, leftY, leftZ], [rightX, rightY, rightZ]] as const) {
            expect(
              world.heightAt(course.position.x + edge[0], course.position.z + edge[2]) - edge[1],
              `${name}: Wasser bleibt zwischen den Ufern (Reihe ${row})`,
            ).toBeGreaterThan(-0.12);
          }
        }
        previousSurfaceY = surfaceY;
      }
    }
    world.dispose();
  });
});

describe("TropicalWorld Dschungelberg-Kletterroute", () => {
  it("platziert Kletterset, drei Seilanker und Gipfelvorrat auf dem Dschungelberg", async () => {
    const world = await createInitializedWorld();
    const kit = findEntityObject(world, "mountain-climbing-kit");
    const cache = findEntityObject(world, "mountain-summit-cache");
    expect(world.getIslandAt(kit.position.x, kit.position.z)?.id).toBe("dschungelberg");
    expect(world.getIslandAt(cache.position.x, cache.position.z)?.id).toBe("dschungelberg");

    const destinations: Vector3[] = [];
    for (let index = 1; index <= 3; index += 1) {
      const anchor = findEntityObject(world, `mountain-climbing-anchor-${index}`);
      expect(world.getIslandAt(anchor.position.x, anchor.position.z)?.id).toBe("dschungelberg");
      const outcome = world.useClimbingAnchor(`mountain-climbing-anchor-${index}`);
      expect(outcome).toMatchObject({ success: true, staminaCost: 22 });
      expect(outcome.destination).toBeDefined();
      destinations.push(new Vector3(outcome.destination!.x, outcome.destination!.y, outcome.destination!.z));
      expect(outcome.reachesSummit ?? false).toBe(index === 3);
    }
    expect(destinations[2]!.y).toBeGreaterThan(45);
    world.dispose();
  });

  it("vergibt Kletterset und Gipfelvorrat nur einmal und speichert beide Funde", async () => {
    const world = await createInitializedWorld();
    expect(world.collect("mountain-climbing-kit")).toMatchObject({
      success: true,
      loot: [{ itemId: "climbing_kit", count: 1 }],
    });
    expect(world.collect("mountain-summit-cache")).toMatchObject({
      success: true,
      loot: [
        { itemId: "smoked_meat", count: 2 },
        { itemId: "cloth", count: 2 },
        { itemId: "metal_scrap", count: 2 },
      ],
    });
    expect(world.collect("mountain-climbing-kit").success).toBe(false);
    expect(world.collect("mountain-summit-cache").success).toBe(false);

    const saved = world.serialize();
    expect(saved.removedEntityIds).toEqual(expect.arrayContaining(["mountain-climbing-kit", "mountain-summit-cache"]));
    const restored = await createInitializedWorld();
    restored.restore(saved);
    expect(findEntityObject(restored, "mountain-climbing-kit").visible).toBe(false);
    expect(findEntityObject(restored, "mountain-summit-cache").visible).toBe(false);
    world.dispose();
    restored.dispose();
  });

  it("weist unbekannte Seilanker zurück", async () => {
    const world = await createInitializedWorld();
    expect(world.useClimbingAnchor("kein-anker")).toMatchObject({ success: false, staminaCost: 0 });
    world.dispose();
  });
});

describe("TropicalWorld Vulkaninsel", () => {
  it("staffelt die Hitze von der sicheren Aschebucht bis zur Gluthitze am Krater", () => {
    const world = createWorld();
    const island = getIsland("vulkaninsel");
    const landing = {
      x: island.positionMeters.x + island.safeLanding.offsetMeters.x,
      y: 2,
      z: island.positionMeters.z + island.safeLanding.offsetMeters.z,
    };
    expect(world.getVolcanicHeatLevel(landing)).toBe(0);
    expect(world.getVolcanicHeatLevel({ x: island.positionMeters.x + 74, y: 8, z: island.positionMeters.z - 3 })).toBe(1);
    expect(world.getVolcanicHeatLevel({ x: island.positionMeters.x + 4, y: 8, z: island.positionMeters.z - 3 })).toBe(2);
    expect(world.getVolcanicHeatLevel({ x: 0, y: 2, z: 0 })).toBe(0);
    world.dispose();
  });

  it("verursacht in der Gluthitze regelmäßigen Schaden, den Regen abschwächt", () => {
    const world = createWorld();
    const island = getIsland("vulkaninsel");
    const crater = { x: island.positionMeters.x + 4, y: 8, z: island.positionMeters.z - 3 };
    const clearEvents = world.update(4, 4, 1, 0.5, crater, false, false, false, weatherState("clear"));
    expect(clearEvents).toContainEqual(expect.objectContaining({ type: "player-damage", amount: 8 }));
    world.update(0.1, 4.1, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false, false, weatherState("clear"));
    const rainEvents = world.update(4, 8.1, 1, 0.5, crater, false, false, false, weatherState("rain"));
    expect(rainEvents).toContainEqual(expect.objectContaining({ type: "player-damage", amount: 3 }));
    world.dispose();
  });

  it("platziert zehn Obsidianvorkommen und die Geologenkiste dauerhaft auf der Vulkaninsel", async () => {
    const world = await createInitializedWorld();
    const deposits = Array.from({ length: 10 }, (_, index) => findEntityObject(world, `volcano-obsidian-${index}`));
    expect(deposits.every(({ position }) => world.getIslandAt(position.x, position.z)?.id === "vulkaninsel")).toBe(true);
    const cache = findEntityObject(world, "volcano-crater-cache");
    expect(world.getIslandAt(cache.position.x, cache.position.z)?.id).toBe("vulkaninsel");
    expect(world.getVolcanicHeatLevel(cache.position)).toBe(2);

    expect(world.collect("volcano-obsidian-0")).toMatchObject({
      success: true,
      loot: [{ itemId: "obsidian_shard", count: 1 }],
    });
    expect(world.collect("volcano-crater-cache")).toMatchObject({
      success: true,
      loot: [
        { itemId: "obsidian_shard", count: 4 },
        { itemId: "metal_scrap", count: 2 },
        { itemId: "smoked_meat", count: 2 },
      ],
    });
    const saved = world.serialize();
    expect(saved.removedEntityIds).toEqual(expect.arrayContaining(["volcano-obsidian-0", "volcano-crater-cache"]));
    const restored = await createInitializedWorld();
    restored.restore(saved);
    expect(findEntityObject(restored, "volcano-obsidian-0").visible).toBe(false);
    expect(findEntityObject(restored, "volcano-crater-cache").visible).toBe(false);
    world.dispose();
    restored.dispose();
  });
});

describe("TropicalWorld restliche Insel-Spielschleifen", () => {
  it("vergräbt die Schatztruhe halb im Sand, legt den Bauplan daneben und speichert das Ausgraben", async () => {
    const world = await createInitializedWorld();
    const island = getIsland("schatzsandbank");
    const chest = findEntityObject(world, "treasure-sandbar-buried-chest");
    const blueprint = findEntityObject(world, "treasure-sandbar-shovel-blueprint");
    const buriedY = chest.position.y;

    expect(world.getIslandAt(chest.position.x, chest.position.z)?.id).toBe(island.id);
    expect(Math.hypot(blueprint.position.x - chest.position.x, blueprint.position.z - chest.position.z)).toBeLessThan(3.5);
    expect(world.collect("treasure-sandbar-shovel-blueprint")).toMatchObject({
      success: true,
      loot: [{ itemId: "shovel_blueprint", count: 1 }],
    });
    expect(world.collect("treasure-sandbar-buried-chest").success).toBe(false);
    expect(world.digBuriedChest("treasure-sandbar-buried-chest").success).toBe(true);
    expect(chest.position.y).toBeGreaterThan(buriedY + 0.5);

    const saved = world.serialize();
    expect(saved.removedEntityIds).toEqual(expect.arrayContaining([
      "treasure-sandbar-shovel-blueprint",
      "treasure-sandbar-chest-dug",
    ]));
    const restored = await createInitializedWorld();
    restored.restore(saved);
    const restoredChest = findEntityObject(restored, "treasure-sandbar-buried-chest");
    expect(restored.isBuriedChestDug()).toBe(true);
    expect(restoredChest.position.y).toBeGreaterThan(buriedY + 0.5);
    expect(restored.collect("treasure-sandbar-buried-chest")).toMatchObject({
      success: true,
      loot: [{ itemId: "giant_island_map", count: 1 }],
    });
    expect(restored.collect("treasure-sandbar-buried-chest").success).toBe(false);
    world.dispose();
    restored.dispose();
  });

  it("macht das Felsenriff zum Tauchrevier für acht einmalige Riffkiesel", async () => {
    const world = await createInitializedWorld();
    const deposits = Array.from({ length: 8 }, (_, index) => findEntityObject(world, `reef-stone-${index}`));
    expect(deposits.every(({ position }) => world.getIslandAt(position.x, position.z)?.id === "felsenriff")).toBe(true);
    expect(deposits.filter(({ position }) => position.y < 0.2).length).toBeGreaterThanOrEqual(4);
    expect(world.collect("reef-stone-0")).toMatchObject({
      success: true,
      loot: [{ itemId: "reef_stone", count: 1 }],
    });
    expect(world.serialize().removedEntityIds).toContain("reef-stone-0");
    world.dispose();
  });

  it("versteckt einen einmaligen Vorrat direkt hinter dem großen Wasserfall", async () => {
    const world = await createInitializedWorld();
    const cache = findEntityObject(world, "waterfall-hidden-cache");
    expect(world.getIslandAt(cache.position.x, cache.position.z)?.id).toBe("wasserfallinsel");
    const waterfall = getIsland("wasserfallinsel");
    const curtainX = waterfall.positionMeters.x + waterfall.dimensions.widthMeters * 0.5 * 0.425;
    expect(Math.hypot(cache.position.x - curtainX, cache.position.z - waterfall.positionMeters.z)).toBeLessThan(6);
    expect(world.collect("waterfall-hidden-cache")).toMatchObject({
      success: true,
      loot: [
        { itemId: "cloth", count: 3 },
        { itemId: "metal_scrap", count: 2 },
        { itemId: "cooked_fish", count: 2 },
      ],
    });
    expect(world.collect("waterfall-hidden-cache").success).toBe(false);
    world.dispose();
  });

  it("lässt sechzehn Duftblüten auf der Blüteninsel nach zwei Tagen nachwachsen", async () => {
    const world = await createInitializedWorld();
    const flowers = Array.from({ length: 16 }, (_, index) => findEntityObject(world, `flower-island-wildflower-${index}`));
    expect(flowers.every(({ position }) => world.getIslandAt(position.x, position.z)?.id === "blueteninsel")).toBe(true);
    expect(world.collect("flower-island-wildflower-0")).toMatchObject({
      success: true,
      loot: [{ itemId: "wildflower", count: 1 }],
    });
    world.update(0, 0, 2, 0.5, { x: 0, y: 2, z: 0 }, false, false);
    expect(world.collect("flower-island-wildflower-0").success).toBe(false);
    world.update(0, 0, 3, 0.5, { x: 0, y: 2, z: 0 }, false, false);
    expect(world.collect("flower-island-wildflower-0").success).toBe(true);
    world.dispose();
  });

  it("entriegelt die Windgrat-Kiste erst nach allen drei Windsignalen und speichert den Fortschritt", async () => {
    const world = await createInitializedWorld();
    const moon = getIsland("mondklippen");
    const landing = {
      x: moon.positionMeters.x + moon.safeLanding.offsetMeters.x,
      y: 2,
      z: moon.positionMeters.z + moon.safeLanding.offsetMeters.z,
    };
    expect(world.getCliffWindLevel(landing)).toBe(0);
    const signals = [1, 2, 3].map((index) => findEntityObject(world, `moon-signal-${index}`));
    expect(signals.every(({ position }) => world.getIslandAt(position.x, position.z)?.id === "mondklippen")).toBe(true);
    expect(signals.some(({ position }) => world.getCliffWindLevel(position) > 0)).toBe(true);
    expect(world.collect("moon-wind-cache")).toMatchObject({ success: false, message: expect.stringContaining("0/3") });
    for (let index = 1; index <= 3; index += 1) expect(world.activateSignalBeacon(`moon-signal-${index}`).success).toBe(true);
    expect(world.getSignalBeaconProgress()).toEqual({ activated: 3, total: 3 });

    const saved = world.serialize();
    const restored = await createInitializedWorld();
    restored.restore(saved);
    expect(restored.getSignalBeaconProgress()).toEqual({ activated: 3, total: 3 });
    expect(findEntityObject(restored, "moon-signal-1").getObjectByName("signal-beacon-flame")?.visible).toBe(true);
    expect(restored.collect("moon-wind-cache")).toMatchObject({
      success: true,
      loot: [
        { itemId: "cloth", count: 5 },
        { itemId: "metal_scrap", count: 4 },
        { itemId: "smoked_meat", count: 3 },
      ],
    });
    world.dispose();
    restored.dispose();
  });
});

describe("TropicalWorld dynamische Drops", () => {
  it("serialisiert und restauriert Item, Menge, Position und stabile ID", () => {
    const source = createWorld();
    const ids = source.dropLoot(
      { x: 4, y: 2, z: -3 },
      [
        { itemId: "fiber", count: 2 },
        { itemId: "palm_frond", count: 4 },
      ],
    );

    expect(ids).toHaveLength(2);
    const saved = source.serialize();
    expect(saved.dynamicDrops.map(({ id, itemId, count }) => ({ id, itemId, count }))).toEqual([
      { id: ids[0], itemId: "fiber", count: 2 },
      { id: ids[1], itemId: "palm_frond", count: 4 },
    ]);

    const restored = createWorld();
    restored.restore(saved);
    expect(restored.serialize().dynamicDrops).toEqual(saved.dynamicDrops);

    const [nextId] = restored.dropLoot({ x: 8, y: 2, z: 1 }, [{ itemId: "stick", count: 1 }]);
    expect(nextId).toBe(`drop-${Math.max(...ids.map((id) => Number(id.slice("drop-".length)))) + 1}`);

    source.dispose();
    restored.dispose();
  });

  it("legt Restmengen als einen öffentlichen Drop ab und sammelt exakt diese Menge ein", () => {
    const world = createWorld();
    const [id] = world.dropLoot({ x: 0, y: 2, z: 0 }, [{ itemId: "fiber", count: 3 }]);

    expect(id).toBeDefined();
    expect(world.collect(id!)).toMatchObject({
      success: true,
      loot: [{ itemId: "fiber", count: 3 }],
    });
    expect(world.serialize().dynamicDrops).toEqual([]);

    world.dispose();
  });

  it("behält IDs von Gebäuden und Todesrucksäcken beim Wiederherstellen stabil", () => {
    const source = createWorld();
    const building = source.createBuilding("campfire", { x: 2, y: 1, z: 3 }, 0.25);
    const packId = source.createDeathPack({ x: 4, y: 1, z: 5 }, [{ itemId: "stone", count: 2 }]);
    const saved = source.serialize();

    const restored = createWorld();
    restored.restore(saved);
    expect(restored.serialize().buildings[0]?.id).toBe(building.id);
    expect(restored.serialize().deathPacks[0]?.id).toBe(packId);
    expect(restored.createBuilding("campfire", { x: 6, y: 1, z: 7 }, 0).id).not.toBe(building.id);
    expect(restored.createDeathPack({ x: 8, y: 1, z: 9 }, []).toString()).not.toBe(packId);

    source.dispose();
    restored.dispose();
  });

  it("speichert Truheninhalte tief kopiert und lädt alte leere Truhen weiter", () => {
    const source = createWorld();
    const chest = source.createBuilding("chest", { x: 2, y: 1, z: 3 }, 0.25);
    chest.storedItems = [
      { itemId: "stone", quantity: 7 },
      { itemId: "fiber", quantity: 12 },
    ];
    const saved = source.serialize();
    chest.storedItems[0] = { itemId: "stone", quantity: 1 };
    expect(saved.buildings[0]?.storedItems).toEqual([
      { itemId: "stone", quantity: 7 },
      { itemId: "fiber", quantity: 12 },
    ]);

    const restored = createWorld();
    restored.restore(saved);
    expect(restored.getBuilding(chest.id)?.storedItems).toEqual(saved.buildings[0]?.storedItems);

    const legacy = structuredClone(saved);
    delete legacy.buildings[0]!.storedItems;
    const legacyRestored = createWorld();
    legacyRestored.restore(legacy);
    expect(legacyRestored.getBuilding(chest.id)?.storedItems).toEqual([]);

    source.dispose();
    restored.dispose();
    legacyRestored.dispose();
  });

  it("lässt gelagerte Nahrung in Truhen weiter verderben", () => {
    const world = createWorld();
    const chest = world.createBuilding("chest", { x: 2, y: 1, z: 2 }, 0);
    chest.storedItems = [{ itemId: "raw_meat", quantity: 2, spoilageSecondsRemaining: 1 }];
    expect(world.advanceStoredFoodSpoilage(1)).toBe(2);
    expect(chest.storedItems).toEqual([{ itemId: "spoiled_food", quantity: 2 }]);
    world.dispose();
  });
});

describe("TropicalWorld Bäume fällen", () => {
  it("lässt die Palme erst sichtbar umkippen und legt danach den aufsammelbaren Stamm ab", async () => {
    const world = await createInitializedWorld();
    let palm: Object3D | null = null;
    world.scene.traverse((object) => {
      if (!palm && typeof object.userData.entityId === "string" && object.userData.entityId.includes("-palm-")) palm = object;
    });
    expect(palm).not.toBeNull();
    const palmObject = palm!;
    const camera = new PerspectiveCamera(75, 1, 0.1, 20);
    camera.position.set(palmObject.position.x, palmObject.position.y + 2.2, palmObject.position.z + 1.8);
    camera.lookAt(palmObject.position.x, palmObject.position.y + 2.2, palmObject.position.z);
    camera.updateMatrixWorld(true);

    for (let hit = 0; hit < 8; hit += 1) {
      world.scene.updateMatrixWorld(true);
      expect(world.attack(camera, "stone_axe").hit).toBe(true);
    }
    const uprightRotation = palmObject.quaternion.clone();
    expect(palmObject.visible).toBe(true);
    expect(world.serialize().dynamicDrops).toEqual([]);

    world.update(1, 1, 1, 0.35, camera.position, false, false);
    expect(palmObject.visible).toBe(true);
    expect(palmObject.quaternion.angleTo(uprightRotation)).toBeGreaterThan(0.35);
    expect(world.serialize().dynamicDrops).toEqual([]);

    world.update(1, 2, 1, 0.35, camera.position, false, false);
    expect(palmObject.visible).toBe(false);
    const drops = world.serialize().dynamicDrops;
    expect(drops.map(({ itemId, count }) => ({ itemId, count }))).toEqual(expect.arrayContaining([
      { itemId: "palm_log", count: 1 },
      { itemId: "palm_frond", count: 4 },
    ]));
    const log = drops.find(({ itemId }) => itemId === "palm_log");
    expect(world.collect(log!.id)).toMatchObject({ success: true, loot: [{ itemId: "palm_log", count: 1 }] });
    world.dispose();
  });

  it("macht jeden instanzierten Dschungelbaum fällbar und legt danach einen Stamm ab", async () => {
    const world = await createInitializedWorld();
    let trunks: InstancedMesh | null = null;
    world.scene.traverse((object) => {
      if (!trunks && object instanceof InstancedMesh && object.name === "Fällbare Dschungelbäume - Stämme") trunks = object;
    });
    expect(trunks).not.toBeNull();
    const trunkInstances = trunks!;
    world.scene.updateMatrixWorld(true);

    const uprightMatrix = new Matrix4();
    trunkInstances.getMatrixAt(0, uprightMatrix);
    const localCenter = new Vector3().setFromMatrixPosition(uprightMatrix);
    const instanceScale = new Vector3().setFromMatrixScale(uprightMatrix);
    const treeHeight = instanceScale.y / 0.65;
    const treeBase = new Vector3(localCenter.x, localCenter.y - treeHeight * 0.325, localCenter.z);
    trunkInstances.localToWorld(treeBase);

    const camera = new PerspectiveCamera(75, 1, 0.1, 20);
    camera.position.set(treeBase.x, treeBase.y + 2.2, treeBase.z + 1.8);
    camera.lookAt(treeBase.x, treeBase.y + 2.2, treeBase.z);
    camera.updateMatrixWorld(true);
    const target = world.getLookTarget(camera, 2.5);
    expect(target).toMatchObject({ kind: "tree", label: "Baum" });

    for (let hit = 0; hit < 8; hit += 1) {
      world.scene.updateMatrixWorld(true);
      expect(world.attack(camera, "stone_axe").hit).toBe(true);
    }
    world.update(1, 1, 1, 0.35, camera.position, false, false);
    const fallingMatrix = new Matrix4();
    trunkInstances.getMatrixAt(0, fallingMatrix);
    expect(fallingMatrix.equals(uprightMatrix)).toBe(false);
    expect(world.serialize().dynamicDrops).toEqual([]);

    world.update(1, 2, 1, 0.35, camera.position, false, false);
    const hiddenMatrix = new Matrix4();
    trunkInstances.getMatrixAt(0, hiddenMatrix);
    expect(hiddenMatrix.determinant()).toBeCloseTo(0);
    expect(world.serialize().removedEntityIds).toContain(target!.id);
    const drops = world.serialize().dynamicDrops;
    expect(drops.map(({ itemId, count }) => ({ itemId, count }))).toEqual([{ itemId: "palm_log", count: 1 }]);
    const saved = world.serialize();
    expect(world.collect(drops[0]!.id)).toMatchObject({ success: true, loot: [{ itemId: "palm_log", count: 1 }] });
    world.dispose();

    const restored = await createInitializedWorld();
    restored.restore(saved);
    let restoredTrunks: InstancedMesh | null = null;
    restored.scene.traverse((object) => {
      if (!restoredTrunks && object instanceof InstancedMesh && object.name === "Fällbare Dschungelbäume - Stämme") restoredTrunks = object;
    });
    const treeIndex = Number(target!.id.split("-").at(-1));
    const restoredMatrix = new Matrix4();
    restoredTrunks!.getMatrixAt(treeIndex, restoredMatrix);
    expect(restoredMatrix.determinant()).toBeCloseTo(0);
    expect(restored.serialize().dynamicDrops).toEqual(saved.dynamicDrops);
    restored.dispose();
  });

  it("behandelt auch die Mangroven als fällbare Bäume", async () => {
    const world = await createInitializedWorld();
    let trunks: InstancedMesh | null = null;
    world.scene.traverse((object) => {
      if (!trunks && object instanceof InstancedMesh && object.name === "Fällbare Mangroven - Stämme") trunks = object;
    });
    expect(trunks).not.toBeNull();
    const trunkInstances = trunks!;
    world.scene.updateMatrixWorld(true);
    const matrix = new Matrix4();
    trunkInstances.getMatrixAt(0, matrix);
    const localCenter = new Vector3().setFromMatrixPosition(matrix);
    const treeHeight = new Vector3().setFromMatrixScale(matrix).y;
    const treeBase = new Vector3(localCenter.x, localCenter.y - 0.75 - treeHeight * 0.5, localCenter.z);
    trunkInstances.localToWorld(treeBase);

    const camera = new PerspectiveCamera(75, 1, 0.1, 20);
    camera.position.set(treeBase.x, treeBase.y + 1.8, treeBase.z + 1.8);
    camera.lookAt(treeBase.x, treeBase.y + 1.8, treeBase.z);
    camera.updateMatrixWorld(true);
    expect(world.getLookTarget(camera, 2.5)).toMatchObject({ kind: "tree", label: "Baum" });
    for (let hit = 0; hit < 8; hit += 1) {
      world.scene.updateMatrixWorld(true);
      expect(world.attack(camera, "stone_axe").hit).toBe(true);
    }
    world.update(2, 2, 1, 0.35, camera.position, false, false);
    expect(world.serialize().dynamicDrops.map(({ itemId, count }) => ({ itemId, count }))).toEqual([
      { itemId: "palm_log", count: 1 },
    ]);
    world.dispose();
  });
});

describe("TropicalWorld Kenney-Bauwerke", () => {
  it("fordert für Bett und Truhe ausdrücklich die Survival-Kit-Modelle an", () => {
    const requested: string[] = [];
    const assets = {
      createModel: (id: string) => {
        requested.push(id);
        const model = new Group();
        model.add(new Mesh(new BoxGeometry(1, 1, 1)));
        return model;
      },
    } as unknown as AssetService;

    expect(createBuildVisual("bed", assets).children.length).toBeGreaterThan(0);
    expect(createBuildVisual("chest", assets).children.length).toBeGreaterThan(0);
    expect(requested).toEqual([
      "survival.bedroll-frame",
      "survival.bedroll",
      "survival.chest",
    ]);
  });

  it("verwendet die modularen Survival-Kit-Strukturmodelle für den Hüttenbau", () => {
    const requested: string[] = [];
    const assets = {
      createModel: (id: string) => {
        requested.push(id);
        const model = new Group();
        model.add(new Mesh(new BoxGeometry(1, 1, 1)));
        return model;
      },
    } as unknown as AssetService;

    createBuildVisual("hut_foundation", assets);
    createBuildVisual("hut_wall", assets);
    createBuildVisual("hut_doorway", assets);
    createBuildVisual("hut_roof", assets);
    expect(requested).toEqual([
      "survival.structure-floor",
      "survival.structure",
      "survival.fence-doorway",
      "survival.structure-roof",
    ]);
  });

  it("baut den Regenfänger um den Eimer aus dem Survival Kit", () => {
    const requested: string[] = [];
    const assets = {
      createModel: (id: string) => {
        requested.push(id);
        const model = new Group();
        model.add(new Mesh(new BoxGeometry(1, 1, 1)));
        return model;
      },
    } as unknown as AssetService;
    expect(createBuildVisual("rain_collector", assets).children.length).toBeGreaterThan(0);
    expect(requested).toEqual(["survival.bucket"]);
  });

  it("setzt die Fischreuse aus Fischergestell, Eimer und Fisch des Survival Kits zusammen", () => {
    const requested: string[] = [];
    const assets = {
      createModel: (id: string) => {
        requested.push(id);
        const model = new Group();
        model.add(new Mesh(new BoxGeometry(1, 1, 1)));
        return model;
      },
    } as unknown as AssetService;
    const trap = createBuildVisual("fish_trap", assets);
    expect(trap.children.length).toBeGreaterThan(0);
    expect(requested).toEqual([
      "survival.campfire-fishing-stand",
      "survival.bucket",
      "survival.fish",
    ]);
    expect(trap.getObjectByName("fish-trap-catch")?.visible).toBe(false);
  });

  it("setzt das Räuchergestell aus Kenney-Feuerstelle, Gestell und Fleischmodellen zusammen", () => {
    const requested: string[] = [];
    const assets = {
      createModel: (id: string) => {
        requested.push(id);
        const model = new Group();
        model.add(new Mesh(new BoxGeometry(1, 1, 1)));
        return model;
      },
    } as unknown as AssetService;
    const rack = createBuildVisual("smoking_rack", assets);
    expect(requested).toEqual([
      "survival.campfire-fishing-stand",
      "survival.campfire-pit",
      "food.meat-raw",
      "food.meat-cooked",
    ]);
    expect(rack.getObjectByName("smoker-raw-meat-0")?.visible).toBe(false);
    expect(rack.getObjectByName("smoker-ready-meat-0")?.visible).toBe(false);
  });

  it("lädt die zusätzlichen Kit-Modelle und setzt daraus unterscheidbare Entdeckungsorte zusammen", async () => {
    const preloaded: string[] = [];
    const requested: string[] = [];
    const assets = {
      preloadModels: async (ids: readonly string[], onProgress?: (progress: number) => void) => {
        preloaded.push(...ids);
        onProgress?.(1);
      },
      createModel: (id: string) => {
        requested.push(id);
        const model = new Group();
        model.add(new Mesh(new BoxGeometry(1, 1, 1)));
        return model;
      },
    } as unknown as AssetService;
    const physics = {
      addTerrain: () => undefined,
      addFixedCuboid: () => ({}),
      addFixedCylinder: () => ({}),
    } as unknown as RapierPhysicsWorld;
    const world = new TropicalWorld(physics, assets);
    await world.initialize();

    expect(preloaded).toEqual(expect.arrayContaining([...WORLD_SCENERY_MODEL_IDS]));
    expect(requested).toContain("nature.grass-leafs-large");
    const groundCover = world.scene.getObjectByName("Bodendeckung: Dschungelbucht")!;
    expect(groundCover).toBeDefined();
    expect(groundCover.children.map(({ name }) => name)).toEqual(expect.arrayContaining([
      "Kit-Bodendecker: nature.grass",
      "Kit-Bodendecker: nature.grass-leafs",
      "Kit-Bodendecker: nature.plant-flat-short",
      "Kit-Bodendecker: nature.bush-large",
    ]));
    for (const name of ["Quellbach", "Quellfluss", "Bergbach"] as const) {
      const kitRiver = world.scene.getObjectByName(`Nature-Kit-Fluss: ${name}`)!;
      expect(kitRiver, name).toBeDefined();
      expect(kitRiver.children.length, name).toBeGreaterThan(0);
      expect(kitRiver.children.every(({ userData }) => userData.assetId === "nature.river-rocks"), name).toBe(true);
    }
    const discoverySiteNames = [
      "Landmarke: Wrackfracht",
      "Landmarke: Fischerlager",
      "Landmarke: Überwucherte Ruinen",
      "Landmarke: Berg-Außenposten",
    ];
    const structuralLandmarkNames = [
      "Landmarke: Steiniger Dschungelpass",
      "Landmarke: Mangroven-Stegrest",
      "Landmarke: Riffpfad",
      "Landmarke: Wasserfall-Felsstufen",
    ];
    for (const name of [...discoverySiteNames, ...structuralLandmarkNames, "Biotop: Seerosenkanal"]) {
      expect(world.scene.getObjectByName(name), name).toBeDefined();
    }
    expect(world.scene.getObjectByName("Landmarke: Verlassenes Strandlager")).toBeUndefined();
    for (const name of discoverySiteNames) {
      const site = world.scene.getObjectByName(name)!;
      for (const child of site.children) {
        const position = child.getWorldPosition(new Vector3());
        expect(world.heightAt(position.x, position.z), `${name}: ${child.name}`).toBeGreaterThan(0.05);
      }
      for (let firstIndex = 0; firstIndex < site.children.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < site.children.length; secondIndex += 1) {
          const first = site.children[firstIndex]!;
          const second = site.children[secondIndex]!;
          const isSupportedTent = new Set([first.name, second.name]).size === 2
            && [first.name, second.name].every((modelName) => (
              modelName === "Kit-Modell: survival.structure-floor" || modelName === "Kit-Modell: survival.tent"
            ));
          if (isSupportedTent) continue;
          const firstPosition = first.getWorldPosition(new Vector3());
          const secondPosition = second.getWorldPosition(new Vector3());
          expect(
            Math.hypot(firstPosition.x - secondPosition.x, firstPosition.z - secondPosition.z),
            `${name}: ${first.name} / ${second.name}`,
          ).toBeGreaterThan(2.4);
        }
      }
    }
    expect(world.scene.getObjectByName("Kit-Modell: nature.statue-obelisk")).toBeDefined();
    expect(world.scene.getObjectByName("Kit-Modell: survival.workbench-anvil")).toBeDefined();
    for (const letter of LORE_LETTERS) {
      const object = findEntityObject(world, letter.id);
      expect(world.getIslandAt(object.position.x, object.position.z)?.id, letter.id).toBe(letter.islandId);
    }
    const fisherLetter = findEntityObject(world, "letter-fisher-camp");
    const letterCamera = new PerspectiveCamera();
    letterCamera.position.copy(fisherLetter.position).add(new Vector3(0, 2, 0));
    letterCamera.lookAt(fisherLetter.position);
    letterCamera.updateMatrixWorld(true);
    world.scene.updateMatrixWorld(true);
    expect(world.getLookTarget(letterCamera, 4)).toMatchObject({
      id: "letter-fisher-camp",
      kind: "lore_letter",
      label: "Vergilbter Brief",
    });
    const rockField = world.scene.getObjectByName("Kit-Felsfeld: Felsenriff")!;
    expect(rockField.children.length).toBeGreaterThan(60);
    expect(rockField.children.every(({ name }) => name.startsWith("Kit-Fels: nature.rock-"))).toBe(true);
    for (const ridgeName of ["Landmarke: Felsenriff Felsgrat", "Landmarke: Dschungelberg Felsgrat"]) {
      const ridge = world.scene.getObjectByName(ridgeName)!;
      expect(ridge.children).toHaveLength(12);
      expect(ridge.children.every(({ name }) => name.startsWith("Kit-Felsformation: nature.rock-"))).toBe(true);
    }
    const arch = world.scene.getObjectByName("Landmarke: Riffbogen")!;
    expect(arch.children.map(({ name }) => name)).toEqual([
      "Kit-Felsbogen-Pfeiler: 1",
      "Kit-Felsbogen-Pfeiler: 2",
      "Kit-Felsbogen-Sturz: nature.rock-large-c",
    ]);
    const wreck = world.scene.getObjectByName("Interaktiv: Wrack aus Survival-Kit-Modellen")!;
    expect(wreck.children.every(({ name }) => name.startsWith("Kit-Modell: survival."))).toBe(true);
    world.dispose();
  });
});

describe("TropicalWorld Wetterwirkungen", () => {
  it("füllt Regenfänger nur bei Regen und beschleunigt Palm-Destillen", () => {
    const world = createWorld();
    const collector = world.createBuilding("rain_collector", { x: 0, y: 1, z: 0 }, 0);
    const still = world.createBuilding("palm_still", { x: 3, y: 1, z: 0 }, 0);
    world.update(60, 60, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false, false, weatherState("clear"));
    expect(collector.waterProgress).toBe(0);
    expect(still.waterProgress).toBe(60);

    const events = world.update(60, 120, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false, false, weatherState("rain"));
    expect(collector.waterCharges).toBe(1);
    expect(still.waterCharges).toBe(1);
    expect(events.some(({ text }) => text.includes("Wasser gesammelt"))).toBe(true);
    world.dispose();
  });

  it("kann ein erloschenes Lagerfeuer per Blitz neu entfachen", () => {
    const world = createWorld();
    const campfire = world.createBuilding("campfire", { x: 2, y: 1, z: 2 }, 0);
    campfire.fireFuel = 0;
    const events = world.forceLightningStrike({ x: 0, y: 2, z: 0 });
    expect(campfire.fireFuel).toBe(90);
    expect(events[0]?.text).toContain("entzündet");
    expect(findEntityObject(world, campfire.id).getObjectByName("campfire-flame")?.visible).toBe(true);
    world.dispose();
  });

  it("erkennt nur brennende Lagerfeuer innerhalb der Wärmereichweite", () => {
    const world = createWorld();
    const extinguished = world.createBuilding("campfire", { x: 1, y: 1, z: 0 }, 0);
    const lit = world.createBuilding("campfire", { x: 4, y: 1, z: 0 }, 0);
    extinguished.fireFuel = 0;

    expect(world.findNearestLitCampfire({ x: 0, y: 1, z: 0 }, 6)?.id).toBe(lit.id);
    expect(world.findNearestLitCampfire({ x: 11, y: 1, z: 0 }, 6)).toBeNull();
    world.dispose();
  });

  it("beschädigt und entzündet einen erreichbaren Baum, wenn kein Feuer vorhanden ist", async () => {
    const world = await createInitializedWorld();
    const events = world.forceLightningStrike({ x: -5, y: 3, z: 0 });
    expect(events[0]?.text).toContain("beschädigt");
    expect(world.scene.getObjectByName("lightning-fire")).toBeDefined();
    world.dispose();
  });
});

describe("TropicalWorld Streamingqualität", () => {
  it("skaliert die Sichtweite kleiner Ressourcen für alle Qualitätsprofile", () => {
    const world = createWorld();
    const [id] = world.dropLoot({ x: 0, y: 2, z: 0 }, [{ itemId: "stick", count: 1 }]);
    const drop = world.serialize().dynamicDrops[0]!;
    const object = findEntityObject(world, id!);
    const playerAtDistance = (distance: number) => ({ x: drop.position.x + distance, y: drop.position.y, z: drop.position.z });

    world.setQuality("low");
    world.update(0, 0, 1, 0.5, playerAtDistance(60), false, false);
    expect(object.visible).toBe(false);

    world.setQuality("medium");
    world.update(0, 0, 1, 0.5, playerAtDistance(60), false, false);
    expect(object.visible).toBe(true);

    world.setQuality("high");
    world.update(0, 0, 1, 0.5, playerAtDistance(85), false, false);
    expect(object.visible).toBe(false);

    world.setQuality("ultra");
    world.update(0, 0, 1, 0.5, playerAtDistance(85), false, false);
    expect(object.visible).toBe(true);

    world.dispose();
  });

  it("deaktiviert den zusätzlichen Shadow-Pass für kleine Sammelobjekte", () => {
    const loadedModel = new Group();
    const loadedMesh = new Mesh();
    loadedMesh.castShadow = true;
    loadedModel.add(loadedMesh);
    const assets = { createModel: () => loadedModel.clone(true) } as unknown as AssetService;
    const world = createWorld(assets);
    const [id] = world.dropLoot({ x: 0, y: 2, z: 0 }, [{ itemId: "stick", count: 1 }]);
    const object = findEntityObject(world, id!);
    const shadowCasters: Object3D[] = [];
    object.traverse((child) => {
      if (child.castShadow) shadowCasters.push(child);
    });

    expect(shadowCasters).toEqual([]);
    world.dispose();
  });
});

describe("TropicalWorld dynamisches Meer", () => {
  it("passt Wellen, Strömung und Brandung sichtbar an das Wetter an", async () => {
    const world = await createInitializedWorld();
    world.update(0.1, 80, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false, false, weatherState("heat"));
    const calm = world.getOceanConditions();
    world.update(0.1, 81, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false, false, weatherState("storm"));
    const storm = world.getOceanConditions();

    expect(world.scene.getObjectByName("Dynamischer Ozean")).toBeInstanceOf(Mesh);
    expect(world.scene.children.filter(({ name }) => name === "Animierte Brandung")).toHaveLength(WORLD_MANIFEST.islands.length);
    expect(storm.waveHeight).toBeGreaterThan(calm.waveHeight);
    expect(storm.choppiness).toBeGreaterThan(calm.choppiness);
    expect(storm.foamStrength).toBeGreaterThan(calm.foamStrength);
    expect(Math.hypot(storm.currentX, storm.currentZ)).toBeGreaterThan(Math.hypot(calm.currentX, calm.currentZ));
    world.dispose();
  });
});

describe("TropicalWorld Inseltiere und Grill", () => {
  it("macht die Mangrovenbucht durch bewachte Heilkräuter und trinkbares, riskantes Brackwasser spielerisch eigenständig", async () => {
    const world = await createInitializedWorld();
    const mangrove = getIsland("mangrovenbucht");
    const crocodiles = world.getWildlifePositions().filter(({ kind }) => kind === "crocodile");
    const herbs = Array.from({ length: 18 }, (_, index) => {
      const id = `mangrovenbucht-healing-herb-${index}`;
      return { id, object: findEntityObject(world, id) };
    });

    expect(herbs).toHaveLength(18);
    for (const { object } of herbs) {
      expect(world.getIslandAt(object.position.x, object.position.z)?.id).toBe(mangrove.id);
      expect(crocodiles.some(({ position }) => Math.hypot(position.x - object.position.x, position.z - object.position.z) <= 9.3)).toBe(true);
    }

    expect(world.collect(herbs[0]!.id)).toEqual({
      success: true,
      message: "1× Mangroven-Heilkraut aufgenommen.",
      loot: [{ itemId: "healing_herb", count: 1 }],
    });
    expect(world.collect(herbs[0]!.id).success).toBe(false);
    expect(world.serialize().removedEntityIds).toContain(herbs[0]!.id);

    world.update(0, 0, 3, 0.5, { ...mangrove.positionMeters, y: 1 }, false, false);
    expect(world.collect(herbs[0]!.id).success).toBe(true);
    expect(world.collect("mangrove-brackwater")).toMatchObject({
      success: true,
      message: expect.stringContaining("macht dich krank"),
      loot: [],
    });
    world.dispose();
  });

  it("verteilt alle Tierarten mit Abstand und hält die Startinsel tierfrei", async () => {
    const world = await createInitializedWorld();
    const wildlife = world.getWildlifePositions();
    const expectedCount = Object.values(ISLAND_WILDLIFE).reduce(
      (sum, counts) => sum + counts.wildBoars + counts.chickens + counts.turtles + counts.birds + counts.crocodiles + counts.snakes,
      0,
    );
    expect(wildlife).toHaveLength(expectedCount);
    expect(wildlife.some(({ position }) => world.getIslandAt(position.x, position.z)?.isStart)).toBe(false);
    expect(wildlife.filter(({ kind }) => kind === "crocodile").every(({ position }) => world.getIslandAt(position.x, position.z)?.id === "mangrovenbucht")).toBe(true);
    expect(new Set(wildlife.map(({ kind }) => kind))).toEqual(new Set(["wild_boar", "chicken", "turtle", "bird", "crocodile", "snake"]));

    for (let first = 0; first < wildlife.length; first += 1) {
      const a = wildlife[first]!;
      for (let second = first + 1; second < wildlife.length; second += 1) {
        const b = wildlife[second]!;
        if (world.getIslandAt(a.position.x, a.position.z)?.id !== world.getIslandAt(b.position.x, b.position.z)?.id) continue;
        expect(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)).toBeGreaterThanOrEqual(5.49);
      }
    }
    world.dispose();
  });

  it("verwendet ein sichtbares Schlangenmodell und vergiftet den Spieler beim Biss", async () => {
    const world = await createInitializedWorld();
    const snake = world.getWildlifePositions().find(({ kind }) => kind === "snake")!;
    const object = findEntityObject(world, snake.id);

    expect(object.name).toBe("3D-Modell: Giftschlange");
    expect(object.getObjectByName("snake-head")).toBeDefined();
    expect(object.getObjectByName("snake-eye-left")).toBeDefined();
    expect(object.getObjectByName("snake-tongue")).toBeDefined();

    const events = world.update(3, 400, 1, 0.5, snake.position, false, false);
    expect(events).toContainEqual({
      type: "player-poison",
      text: "Eine Giftschlange beißt dich – du bist vergiftet!",
    });
    world.dispose();
  });

  it("lässt Tiere nachts schlafen, tagsüber fressen und durch Geräusche aufschrecken", async () => {
    const world = await createInitializedWorld();
    world.update(0.1, 10, 1, 0.08, { x: 0, y: 2, z: 0 }, false, false);
    expect(world.getWildlifePositions().every(({ state }) => state === "sleeping")).toBe(true);

    world.update(0.1, 400, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false);
    expect(world.getWildlifePositions().some(({ state }) => state === "feeding")).toBe(true);

    const animal = world.getWildlifePositions().find(({ kind }) => kind === "chicken")!;
    world.update(0.1, 401, 1, 0.08, animal.position, false, false, false, weatherState("clear"), 1);
    expect(world.getWildlifePositions().find(({ id }) => id === animal.id)?.state).toBe("alerted");
    world.dispose();
  });

  it("ordnet Herdentiere dauerhaft kleinen, räumlich passenden Gruppen zu", async () => {
    const world = await createInitializedWorld();
    const herdAnimals = world.getWildlifePositions().filter(({ kind }) => (
      kind === "wild_boar" || kind === "chicken" || kind === "turtle" || kind === "bird"
    ));
    const groups = groupByKey(herdAnimals, ({ groupId }) => groupId);

    expect([...groups.values()].every((members) => members.length >= 1 && members.length <= 3)).toBe(true);
    expect([...groups.values()].some((members) => members.length === 3)).toBe(true);
    for (const members of groups.values()) {
      expect(new Set(members.map(({ kind }) => kind)).size).toBe(1);
      expect(new Set(members.map(({ position }) => world.getIslandAt(position.x, position.z)?.id)).size).toBe(1);
    }
    world.dispose();
  });

  it("schickt Tiere morgens ans Süßwasser und alarmiert eine ganze Vogelgruppe gemeinsam", async () => {
    const world = await createInitializedWorld();
    world.update(0.1, 100, 1, 0.34, { x: 0, y: 2, z: 0 }, false, false);
    const drinkers = world.getWildlifePositions().filter(({ hasWaterTarget }) => hasWaterTarget);
    expect(drinkers.length).toBeGreaterThan(0);
    expect(drinkers.every(({ state }) => state === "drinking")).toBe(true);

    const birds = world.getWildlifePositions().filter(({ kind }) => kind === "bird");
    const flock = [...groupByKey(birds, ({ groupId }) => groupId).values()].find((members) => members.length > 1)!;
    world.update(0.1, 101, 1, 0.5, flock[0]!.position, false, false, false, weatherState("clear"), 1);
    const flockIds = new Set(flock.map(({ id }) => id));
    expect(world.getWildlifePositions().filter(({ id }) => flockIds.has(id)).every(({ state }) => state === "alerted")).toBe(true);
    world.dispose();
  });

  it("lässt Vögel nachts in Baumkronen landen und laufende Tiere vergängliche Spuren hinterlassen", async () => {
    const world = await createInitializedWorld();
    const birdsBefore = new Map(world.getWildlifePositions().filter(({ kind }) => kind === "bird").map(({ id, position }) => [id, position]));
    world.update(2, 20, 1, 0.08, { x: 0, y: 2, z: 0 }, false, false);
    const perchedBirds = world.getWildlifePositions().filter(({ kind, state, position, id }) => {
      const before = birdsBefore.get(id)!;
      return kind === "bird" && state === "sleeping" && position.y > before.y
        && Math.hypot(position.x - before.x, position.z - before.z) > 0.1;
    });
    expect(perchedBirds.length).toBeGreaterThan(0);

    for (let second = 0; second < 10; second += 1) {
      world.update(1, 400 + second, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false);
    }
    expect(world.getWildlifeTrackCount()).toBeGreaterThan(0);
    expect(world.scene.getObjectByName("Kurzlebige Tierspuren")?.children.length).toBe(world.getWildlifeTrackCount());
    world.dispose();
  });

  it("lässt Wildschweine friedlich, bis der Spieler eines angreift", async () => {
    const world = await createInitializedWorld();
    world.update(3, 400, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false);
    const boar = world.getWildlifePositions().find(({ kind }) => kind === "wild_boar")!;
    const boarObject = findEntityObject(world, boar.id);

    const peacefulEvents = world.update(0, 401, 1, 0.5, boarObject.position, false, false);
    expect(peacefulEvents.some(({ type }) => type === "player-damage")).toBe(false);

    const camera = new PerspectiveCamera(75, 1, 0.1, 20);
    camera.position.copy(boarObject.position).add(new Vector3(0, 0.65, 2.2));
    camera.lookAt(boarObject.position.x, boarObject.position.y + 0.4, boarObject.position.z);
    camera.updateMatrixWorld(true);
    world.scene.updateMatrixWorld(true);
    expect(world.attack(camera, "wooden_spear")).toMatchObject({
      hit: true,
      message: "Wildschwein wird aggressiv!",
    });

    const chaseTarget = boarObject.position.clone().add(new Vector3(5, 0, 0));
    world.update(1.3, 402.3, 1, 0.5, chaseTarget, false, false);
    const retaliationEvents = world.update(0, 402.3, 1, 0.5, boarObject.position, false, false);
    expect(retaliationEvents).toContainEqual({
      type: "player-damage",
      amount: 12,
      text: "Das Wildschwein rammt dich!",
      causesBleeding: true,
    });
    world.dispose();
  });

  it("hält Vögel aufrecht, bewegt sie durch die Luft und schlägt mit zwei sichtbaren Flügeln", async () => {
    const world = await createInitializedWorld();
    world.update(0.1, 400, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false);
    const bird = world.getWildlifePositions().find(({ kind, state }) => kind === "bird" && state === "wandering")!;
    const object = findEntityObject(world, bird.id);
    const before = object.position.clone();
    world.update(1, 401, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false);
    const leftWing = object.getObjectByName("bird-wing-left")!;
    const rightWing = object.getObjectByName("bird-wing-right")!;
    expect(Math.hypot(object.position.x - before.x, object.position.z - before.z)).toBeGreaterThan(0.1);
    expect(leftWing).toBeDefined();
    expect(rightWing).toBeDefined();
    expect(leftWing.rotation.z).toBeCloseTo(-rightWing.rotation.z);
    expect(Math.abs(leftWing.rotation.z)).toBeGreaterThan(0.01);
    expect(Math.abs(object.rotation.z)).toBeLessThan(0.01);
    world.dispose();
  });

  it("zeigt rohes und anschließend sichtbar gegartes Fleisch auf dem Lagerfeuer", async () => {
    const world = await createInitializedWorld();
    const campfire = world.createBuilding("campfire", { x: 0, y: world.heightAt(0, 0), z: 0 }, 0);
    campfire.cookingItem = "raw_meat";
    campfire.cookingProgress = 1;
    world.update(0, 1, 1, 0.5, { x: 0, y: 3, z: 4 }, false, false);
    expect(world.scene.getObjectByName("cooking-food")).toBeDefined();
    const root = findEntityObject(world, campfire.id);
    expect(root.userData.cookingVisualState).toBe("raw_meat-raw");

    campfire.cookingProgress = 30;
    world.update(0, 2, 1, 0.5, { x: 0, y: 3, z: 4 }, false, false);
    expect(root.userData.cookingVisualState).toBe("raw_meat-cooked");
    expect(root.getObjectByName("campfire-flame")?.visible).toBe(true);
    world.dispose();
  });
});

describe("TropicalWorld Dschungelbucht-Jagd", () => {
  it("macht die Dschungelbucht zum dichten Revier und belohnt dortige Jagd stärker", async () => {
    const world = await createInitializedWorld();
    const jungleWildlife = world.getWildlifePositions().filter(({ position }) => (
      world.getIslandAt(position.x, position.z)?.id === "dschungelbucht"
    ));
    expect(jungleWildlife.filter(({ kind }) => kind === "wild_boar")).toHaveLength(8);
    expect(jungleWildlife.filter(({ kind }) => kind === "chicken")).toHaveLength(10);

    const boar = jungleWildlife.find(({ kind }) => kind === "wild_boar")!;
    const boarObject = findEntityObject(world, boar.id);
    const camera = new PerspectiveCamera(75, 1, 0.1, 20);
    camera.position.copy(boarObject.position).add(new Vector3(0, 0.65, 2.2));
    camera.lookAt(boarObject.position.x, boarObject.position.y + 0.4, boarObject.position.z);
    camera.updateMatrixWorld(true);
    world.scene.updateMatrixWorld(true);
    world.attack(camera, "wooden_spear");
    world.attack(camera, "wooden_spear");
    expect(world.attack(camera, "wooden_spear")).toMatchObject({
      hit: true,
      loot: [{ itemId: "raw_meat", count: 4 }],
    });
    world.dispose();
  });

  it("räuchert eine Dreiercharge, zeigt den Zustand und speichert den Vorrat", () => {
    const world = createWorld();
    const rack = world.createBuilding("smoking_rack", { x: 264, y: world.heightAt(264, 0), z: 0 }, 0);
    rack.smokerInputCount = 3;
    const events = world.update(90, 90, 1, 0.5, { x: 264, y: 2, z: 0 }, false, false);
    expect(rack).toMatchObject({ smokerInputCount: 0, smokerProgress: 0, smokerReadyCount: 3 });
    expect(events).toContainEqual({ type: "message", text: "Das Räucherfleisch in der Dschungelbucht ist fertig." });
    const root = findEntityObject(world, rack.id);
    expect(root.getObjectByName("smoker-ready-meat-0")?.visible).toBe(true);
    expect(root.getObjectByName("smoker-smoke")?.visible).toBe(false);

    const restored = createWorld();
    restored.restore(world.serialize());
    expect(restored.getBuilding(rack.id)).toMatchObject({ smokerInputCount: 0, smokerReadyCount: 3 });
    expect(findEntityObject(restored, rack.id).getObjectByName("smoker-ready-meat-2")?.visible).toBe(true);
    world.dispose();
    restored.dispose();
  });
});

describe("TropicalWorld Palmenlagunen-Fischerei", () => {
  it("fängt mit der Angel nur einen anvisierten Lagunenschwarm und setzt danach eine Schonzeit", async () => {
    const world = await createInitializedWorld();
    world.update(0, 10, 1, 0.5, { x: -440, y: 2, z: 270 }, false, false);
    const lagoon = getIsland("palmenlagune");
    const school = world.getFishSchoolPositions().find(({ x, z }) => Math.hypot(
      (x - lagoon.positionMeters.x) / (lagoon.dimensions.widthMeters * 0.5 * 0.31),
      (z - lagoon.positionMeters.z) / (lagoon.dimensions.depthMeters * 0.5 * 0.27),
    ) < 0.9);
    expect(school).toBeDefined();

    const camera = new PerspectiveCamera();
    camera.position.set(school!.x, 2, school!.z + 8);
    camera.lookAt(school!.x, school!.y, school!.z);
    camera.updateMatrixWorld(true);
    expect(world.fish(camera)).toMatchObject({
      hit: true,
      loot: [{ itemId: "raw_fish", count: 1 }],
    });
    expect(world.fish(camera)).toMatchObject({
      hit: false,
      message: "Der aufgescheuchte Fischschwarm muss sich erst wieder sammeln.",
    });
    world.dispose();
  });

  it("verbraucht pro Reusenfang einen Köder, zeigt den Fang und speichert den Zustand", () => {
    const world = createWorld();
    const trap = world.createBuilding("fish_trap", { x: -440, y: 0.04, z: 270 }, 0);
    trap.fishTrapBaited = true;
    const events = world.update(120, 120, 1, 0.5, { x: -440, y: 2, z: 270 }, false, false);
    expect(trap).toMatchObject({ fishTrapBaited: false, fishTrapProgress: 0, fishTrapStored: 1 });
    expect(events.some(({ text }) => text.includes("Fisch gefangen"))).toBe(true);
    expect(findEntityObject(world, trap.id).getObjectByName("fish-trap-catch")?.visible).toBe(true);

    const restored = createWorld();
    restored.restore(world.serialize());
    expect(restored.getBuilding(trap.id)).toMatchObject({
      fishTrapBaited: false,
      fishTrapProgress: 0,
      fishTrapStored: 1,
    });
    expect(findEntityObject(restored, trap.id).getObjectByName("fish-trap-catch")?.visible).toBe(true);
    world.dispose();
    restored.dispose();
  });

  it("zeigt Fisch beim Grillen roh und nach zwanzig Sekunden gegart", () => {
    const world = createWorld();
    const campfire = world.createBuilding("campfire", { x: 0, y: world.heightAt(0, 0), z: 0 }, 0);
    campfire.cookingItem = "raw_fish";
    campfire.cookingProgress = 1;
    world.update(0, 1, 1, 0.5, { x: 0, y: 3, z: 4 }, false, false);
    const root = findEntityObject(world, campfire.id);
    expect(root.userData.cookingVisualState).toBe("raw_fish-raw");

    campfire.cookingProgress = 20;
    world.update(0, 2, 1, 0.5, { x: 0, y: 3, z: 4 }, false, false);
    expect(root.userData.cookingVisualState).toBe("raw_fish-cooked");
    world.dispose();
  });
});

describe("TropicalWorld Unterwasserwelt", () => {
  it("schaltet unter Wasser auf dichten blaugrünen Nebel und anschließend wieder zurück", () => {
    const world = createWorld();
    expect(world.scene.fog).toBeInstanceOf(FogExp2);

    world.update(0, 0, 1, 0.5, { x: 38, y: -3, z: 0 }, true, false, true);
    expect((world.scene.fog as FogExp2).density).toBeCloseTo(0.032);
    expect((world.scene.background as { getHex: () => number }).getHex()).not.toBe(0x8fcbd7);

    world.update(0, 0, 1, 0.5, { x: 0, y: 2, z: 0 }, false, false, false);
    expect((world.scene.fog as FogExp2).density).toBeCloseTo(0.00155);
    world.dispose();
  });

  it("lädt das Survival-Kit-Fischmodell und verteilt Schwärme nur im Küstenring der Inseln", async () => {
    const preloaded: string[] = [];
    const assets = {
      preloadModels: async (ids: readonly string[], onProgress?: (progress: number) => void) => {
        preloaded.push(...ids);
        onProgress?.(1);
      },
      createModel: (id: string) => {
        if (id !== "survival.fish") return null;
        const fish = new Group();
        fish.add(new Mesh(new BoxGeometry(1, 0.4, 0.3)));
        return fish;
      },
    } as unknown as AssetService;
    const physics = {
      addTerrain: () => undefined,
      addFixedCuboid: () => ({}),
      addFixedCylinder: () => ({}),
    } as unknown as RapierPhysicsWorld;
    const world = new TropicalWorld(physics, assets);
    await world.initialize();

    expect(preloaded).toContain("survival.fish");
    expect(world.scene.getObjectByName("Sandiger Meeresboden")).toBeDefined();
    const schools = world.scene.children.filter(({ name }) => name.startsWith("Fischschwarm:"));
    const expectedSchoolCount = WORLD_MANIFEST.islands.reduce(
      (total, island) => total + (island.isStart ? 2 : island.isLarge ? 4 : 3),
      0,
    );
    expect(schools).toHaveLength(expectedSchoolCount);
    for (const school of schools) {
      const nearestCoastRing = Math.min(...WORLD_MANIFEST.islands.map((island) => Math.hypot(
        (school.position.x - island.positionMeters.x) / (island.dimensions.widthMeters * 0.5),
        (school.position.z - island.positionMeters.z) / (island.dimensions.depthMeters * 0.5),
      )));
      expect(nearestCoastRing, school.name).toBeGreaterThanOrEqual(0.9);
      expect(nearestCoastRing, school.name).toBeLessThanOrEqual(1.2);
    }

    world.dispose();
  });
});
