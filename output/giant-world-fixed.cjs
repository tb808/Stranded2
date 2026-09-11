const fs = require('fs');
const p='src/world/TropicalWorld.ts'; let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
function edit(a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,80));s=s.replace(a,b);}
edit('const TREASURE_CHEST_ID', `export const GIANT_CAMP = { x: -220, z: -120, y: 14, radius: 32 } as const;
export const GIANT_LAKE = { radiusX: 180, radiusZ: 135, surfaceY: 10 } as const;
const GIANT_TRAIL = [
  { x: -560, z: -260, y: 1.1 }, { x: -450, z: -225, y: 5 },
  { x: -330, z: -175, y: 10 }, { x: -220, z: -120, y: 14 },
] as const;
const TREASURE_CHEST_ID`);
edit('  "sonnenrand-insel": 281,','  "sonnenrand-insel": 281,\n  rieseninsel: 307,');
edit('export const ISLAND_TERRAIN_STRUCTURES: Readonly<Partial<Record<IslandId, IslandTerrainStructure>>> = {',`export const ISLAND_TERRAIN_STRUCTURES: Readonly<Partial<Record<IslandId, IslandTerrainStructure>>> = {
  rieseninsel: {
    baseHeightFactor: 0.3, terraceStep: 4, terraceBlend: 0.12,
    rises: [
      { x: -0.3, z: 0.43, radiusX: 0.38, radiusZ: 0.3, height: 88 },
      { x: 0.18, z: 0.49, radiusX: 0.36, radiusZ: 0.28, height: 98 },
      { x: 0.52, z: 0.1, radiusX: 0.3, radiusZ: 0.45, height: 76 },
      { x: 0.23, z: -0.48, radiusX: 0.32, radiusZ: 0.28, height: 56 },
    ],
    gorges: [],
  },`);
edit('const FRESHWATER_BASINS: readonly FreshwaterBasinDefinition[] = [',`const FRESHWATER_BASINS: readonly FreshwaterBasinDefinition[] = [
  { id: 'rieseninsel-lake', name: 'Smaragdsee', islandId: 'rieseninsel',
    normalizedX: 0, normalizedZ: 0, radiusX: GIANT_LAKE.radiusX, radiusZ: GIANT_LAKE.radiusZ,
    depth: 6, surfaceInset: 0, fixedSurfaceY: GIANT_LAKE.surfaceY },`);
edit('  dschungelbucht: [\n    { x: 89', '  rieseninsel: [GIANT_CAMP],\n  dschungelbucht: [\n    { x: 89');
edit('  "sonnenrand-insel": { widthMeters: 118, depthMeters: 82 },','  "sonnenrand-insel": { widthMeters: 118, depthMeters: 82 },\n  rieseninsel: { widthMeters: 1600, depthMeters: 1200 },');
edit('  dschungelbucht: { wildBoars:', '  rieseninsel: { wildBoars: 18, chickens: 24, turtles: 12, birds: 20, crocodiles: 8, snakes: 14 },\n  dschungelbucht: { wildBoars:');
edit('| "shark" | "freshwater"', '| "shark" | "elias" | "freshwater"');
edit('  private shark: WorldEntity | null = null;', '  private shark: WorldEntity | null = null;\n  private readonly butterflies: Group[] = [];');
edit('    return this.heightAt(x, z) < -2.5;', '    return this.heightAt(x, z) < this.getWaterSurfaceAt(x, z) - 2.5;');
edit('  public getIslandAt(', `  public isGiantIslandCharted(): boolean {
    // The looted chest is already saved permanently, including in older saves.
    return this.removedEntityIds.has(TREASURE_CHEST_ID);
  }

  public getWaterSurfaceAt(x: number, z: number): number {
    const island = getIsland('rieseninsel');
    const basin = resolveFreshwaterBasin(FRESHWATER_BASINS[0]!, island);
    return organicBasinDistance(x - island.positionMeters.x, z - island.positionMeters.z,
      basin, freshwaterBasinShoreSeed(FRESHWATER_BASINS[0]!, island)) < 0.92
      ? GIANT_LAKE.surfaceY : SEA_LEVEL;
  }

  public getIslandAt(`);
edit('    this.physics.setOceanConditions?.(this.currentOceanConditions);',`    const inland = this.getWaterSurfaceAt(playerPosition.x, playerPosition.z) > SEA_LEVEL;
    this.physics.setOceanConditions?.(inland
      ? { ...this.currentOceanConditions, currentX: 0, currentZ: 0 }
      : this.currentOceanConditions);`);
edit('    this.animateVegetation(elapsedSeconds);','    this.animateVegetation(elapsedSeconds);\n    this.animateGiantIsland(elapsedSeconds, playerPosition);');
edit('message: "Truhe geöffnet: Du findest die Karte einer riesigen, noch unbekannten Insel."','message: "Karte gefunden: Die Rieseninsel ist jetzt auf deiner Inselkarte verzeichnet – weit im Nordosten!"');
edit('    const metersPerSegment = island.archetype', '    const metersPerSegment = island.id === "rieseninsel" ? 4 : island.archetype');
edit('    const seabed = createSandySeabed(2_900, 1_900, 420, 80);','    const seabed = createSandySeabed(14_000, 12_000, 2_000, 1_500);');
edit('new PlaneGeometry(2_900, 1_900, 240, 156)','new PlaneGeometry(14_000, 12_000, 400, 340)');
edit('ocean.position.set(420, SEA_LEVEL, 80)','ocean.position.set(2_000, SEA_LEVEL, 1_500)');
edit('    const rng = new SeededRandom(WORLD_SEED);\n    for (const island of WORLD_MANIFEST.islands) {','    const sharedRng = new SeededRandom(WORLD_SEED);\n    for (const island of WORLD_MANIFEST.islands) {\n      const rng = island.id === "rieseninsel" ? new SeededRandom(307_571) : sharedRng;');
edit('const treeCount = Math.min(380,','const treeCount = island.id === "rieseninsel" ? 5200 : Math.min(380,');
edit('index < treeCount * 2','index < treeCount * 5');
edit('const radius = Math.sqrt(rng.next()) * 0.64;', 'const radius = Math.sqrt(rng.next()) * (island.id === "rieseninsel" ? 0.78 : 0.64);');
edit('height: rng.range(6, island.archetype === "mountain-jungle" ? 13 : 11)', 'height: island.id === "rieseninsel" ? rng.range(14, 28) : rng.range(6, island.archetype === "mountain-jungle" ? 13 : 11)');
edit('        this.spawnJungleForest(\n',`        if (island.id === 'rieseninsel') {
          // Local forest chunks keep near/far LOD useful across this enormous island.
          const chunks = new Map<string, typeof trees>();
          for (const tree of trees) {
            const key = Math.floor((tree.position.x - centerX) / 120) + ':' + Math.floor((tree.position.z - centerZ) / 120);
            const chunk = chunks.get(key) ?? []; chunk.push(tree); chunks.set(key, chunk);
          }
          for (const [key, chunk] of chunks) {
            const [cx, cz] = key.split(':').map(Number);
            this.spawnJungleForest(entityPrefix + '-tree-' + key, chunk,
              new Vector3(centerX + (cx! + 0.5) * 120, 0, centerZ + (cz! + 0.5) * 120), 1500);
          }
        } else this.spawnJungleForest(
`);
edit('    this.spawnIslandWaterFeatures(rng);','    const rng = sharedRng;\n    this.spawnIslandWaterFeatures(rng);');
edit('      positions.push(new Vector3(x, Math.max(0.25, height), z));',`      if (island.id === 'rieseninsel' && (height < 0.25
        || isInKitLandmarkClearing(island, x - island.positionMeters.x, z - island.positionMeters.z, 3)
        || isInFreshwaterFeature(island, x, z, 3))) continue;
      positions.push(new Vector3(x, Math.max(0.25, height), z));`);
edit('const totalCount = Math.min(520,','const totalCount = island.id === "rieseninsel" ? 16000 : Math.min(520,');
edit('const height = rng.range(variant.minHeight, variant.maxHeight);', 'const height = rng.range(variant.minHeight, variant.maxHeight) * (island.id === "rieseninsel" ? 1.65 : 1);');
// Crocodiles have their own protected shore habitat, away from Elias and the trail.
edit('const localX = Math.cos(angle) * fraction * radiusX;\n          const localZ = Math.sin(angle) * fraction * radiusZ;',`const giantShore = island.id === 'rieseninsel' && (kind === 'crocodile' || kind === 'turtle');
          const shoreAngle = 0.2 + (index / Math.max(1, count - 1)) * 1.3 + attempt * 0.08;
          const localX = giantShore ? Math.cos(shoreAngle) * GIANT_LAKE.radiusX * speciesRng.range(1.06, 1.28) : Math.cos(angle) * fraction * radiusX;
          const localZ = giantShore ? Math.sin(shoreAngle) * GIANT_LAKE.radiusZ * speciesRng.range(1.06, 1.28) : Math.sin(angle) * fraction * radiusZ;`);
edit('(kind === "turtle" ? ground < 0.08', '(giantShore ? ground < 9.8 || ground > 16 : kind === "turtle" ? ground < 0.08');
edit('(kind !== "crocodile" && isInFreshwaterFeature', '(!giantShore && kind !== "crocodile" && isInFreshwaterFeature');
edit('this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 480 });', 'this.streamedScenery.push({ object: group, center: group.position.clone(), distance: island.id === "rieseninsel" ? 1800 : 480 });');
edit('    this.spawnDistantSmallIslandLandmarks();','    this.spawnDistantSmallIslandLandmarks();\n    this.spawnGiantIslandLandmarks();');
edit('    const palettes: Readonly<Record<IslandId, readonly string[]>> = {','    const palettes: Readonly<Record<IslandId, readonly string[]>> = {\n      rieseninsel: ["nature.bush-large", "nature.plant-flat-tall", "nature.mushroom-red-group", "nature.flower-red", "nature.stump-old-tall"],');
edit('const count = island.isStart ? 7', 'const count = island.id === "rieseninsel" ? 140 : island.isStart ? 7');
edit('isWildlifeKind(entity.kind) && entity.available && entity.home,','isWildlifeKind(entity.kind) && entity.available && entity.home && distanceSquaredXZ(entity.object.position, player) < 320 ** 2,');
edit('        const habitatValid = animal.kind === "bird"',`        const giantHabitat = animal.id.startsWith('rieseninsel-');
        const blockedCamp = giantHabitat && isInKitLandmarkClearing(getIsland('rieseninsel'), nextX - 4600, nextZ - 3800, 6);
        const habitatValid = !blockedCamp && (animal.kind === "bird"`);
edit('|| animal.kind === "turtle" && nextGround > 0.04 && nextGround < 3','|| animal.kind === "turtle" && nextGround > (giantHabitat ? 9.7 : 0.04) && nextGround < (giantHabitat ? 17 : 3)');
edit('|| animal.kind === "crocodile" && nextGround > -0.45 && nextGround < 3.6','|| animal.kind === "crocodile" && nextGround > (giantHabitat ? 9.5 : -0.45) && nextGround < (giantHabitat ? 17 : 3.6)');
// close the boolean expression at its last clause (verified below by typecheck).
edit('|| nextGround > 0.4;', '|| nextGround > 0.4) && !(giantHabitat && nextGround < 9.5 && Math.hypot((nextX - 4600) / 180, (nextZ - 3800) / 135) < 1.2);');
edit('  if (island.archetype === "mangrove-bay") height = Math.min(height, 6.8);',`  if (island.id === 'rieseninsel') {
    // A continuous, dry lake rim; a broad, truly level camp with feathered edges.
    const lakeDistance = Math.hypot(dx / GIANT_LAKE.radiusX, dz / GIANT_LAKE.radiusZ);
    height = Math.max(height, 12.5 * (1 - smoothstep(1.3, 2.2, lakeDistance)));
    for (let i = 0; i < GIANT_TRAIL.length - 1; i++) {
      const a = GIANT_TRAIL[i]!, b = GIANT_TRAIL[i + 1]!;
      const t = clamp(((dx-a.x)*(b.x-a.x)+(dz-a.z)*(b.z-a.z))/((b.x-a.x)**2+(b.z-a.z)**2),0,1);
      const distance = Math.hypot(dx-a.x-(b.x-a.x)*t,dz-a.z-(b.z-a.z)*t);
      const blend = 1-smoothstep(5,16,distance);
      height += (a.y+(b.y-a.y)*t-height)*blend;
    }
    height += (GIANT_CAMP.y-height)*(1-smoothstep(30,48,Math.hypot(dx-GIANT_CAMP.x,dz-GIANT_CAMP.z)));
  }
  if (island.archetype === "mangrove-bay") height = Math.min(height, 6.8);`);
edit('  const layoutScale = islandLayoutScale(island);\n  return (KIT_LANDMARK_CLEARINGS',`  const layoutScale = islandLayoutScale(island);
  if (island.id === 'rieseninsel' && GIANT_TRAIL.some((point, index) => {
    const next = GIANT_TRAIL[index + 1];
    return next && distanceToSegment2D(localX, localZ, point.x, point.z, next.x, next.z) < 6 + padding;
  })) return true;
  return (KIT_LANDMARK_CLEARINGS`);
edit('  if (freshwaterTerrainColor(target, x, z, island, noise)) return;',`  if (island.id === 'rieseninsel' && isInKitLandmarkClearing(island, x-island.positionMeters.x, z-island.positionMeters.z)) {
    target.setRGB(0.38+noise*0.08,0.29+noise*0.07,0.14+noise*0.03); return;
  }
  if (freshwaterTerrainColor(target, x, z, island, noise)) return;`);
edit('    giant_island_map: "Karte der Rieseninsel",','    giant_island_map: "Karte der Rieseninsel",\n    elias: "Elias Voss",');
fs.writeFileSync(p,s);

