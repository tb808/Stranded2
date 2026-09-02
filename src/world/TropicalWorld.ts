import {
  AnimationMixer,
  BackSide,
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Camera,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  LOD,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type AnimationAction,
} from "three";
import type { AssetService } from "../assets/AssetService";
import { clamp, distanceSquaredXZ, fbm2D, SeededRandom, smoothstep, type Vec3Like } from "../core/math";
import { CHEST_STORAGE_SLOTS, type BuildableId } from "../data/buildables";
import type { ItemId } from "../data/items";
import { LORE_LETTERS, type LoreLetterId } from "../data/loreLetters";
import { Inventory, type ItemStack } from "../gameplay/model/inventory";
import { oceanConditionsForWeather, type OceanConditions } from "../gameplay/model/ocean";
import { weatherState, type WeatherState } from "../gameplay/model/weather";
import { WORLD_MANIFEST, getIsland, type IslandDimensions, type IslandId, type ResourceSourceId, type WorldIslandManifest } from "../data/worldManifest";
import type { RapierPhysicsWorld } from "../physics/RapierPhysicsWorld";

const SEA_LEVEL = 0;
const WORLD_SEED = 0x57a4d2;
const TREE_FALL_DURATION_SECONDS = 1.45;
const TREE_SETTLE_DURATION_SECONDS = 0.35;
const FISH_TRAP_CATCH_SECONDS = 120;
const FISH_TRAP_CAPACITY = 3;
const FISHING_SCHOOL_COOLDOWN_SECONDS = 35;
const SMOKING_DURATION_SECONDS = 90;
const SMOKING_BATCH_SIZE = 3;
const CLIMB_STAMINA_COST = 22;
const VOLCANIC_HEAT_DAMAGE_INTERVAL_SECONDS = 4;
const TREE_FALL_ANGLE = Math.PI / 2 - 0.035;
const HUT_MODULE_SIZE = 4;
const HUT_HALF_SIZE = HUT_MODULE_SIZE / 2;
const HUT_WALL_HEIGHT = 2.7;
const HUT_FOUNDATION_THICKNESS = 0.34;
const HUT_SUPPORT_INSET = 1.66;
const VOLCANO_LANDMARK = {
  localX: 4,
  localZ: -3,
  plateauHeight: 7.5,
  plateauRadiusX: 78,
  plateauRadiusZ: 64,
  modelHeight: 56,
} as const;
const VOLCANIC_LAVA_PATHS = [
  [{ x: -2, z: 2 }, { x: -18, z: 16 }, { x: -40, z: 31 }, { x: -68, z: 45 }, { x: -93, z: 61 }],
  [{ x: 10, z: 1 }, { x: 27, z: 14 }, { x: 48, z: 33 }, { x: 72, z: 49 }],
  [{ x: 7, z: -9 }, { x: 20, z: -27 }, { x: 35, z: -48 }, { x: 50, z: -69 }],
] as const;
const TREASURE_CHEST_ID = "treasure-sandbar-buried-chest";
const TREASURE_CHEST_DUG_MARKER = "treasure-sandbar-chest-dug";

const LORE_LETTER_PLACEMENTS = {
  "letter-start-beach": { x: -2, z: -3, rotationY: 0.25 },
  "letter-wreck-cargo": { x: 90, z: -45, rotationY: -0.55 },
  "letter-fisher-camp": { x: -44, z: 35, rotationY: -0.35 },
  "letter-mangrove-walkway": { x: -68, z: -43, rotationY: 0.4 },
  "letter-reef-path": { x: 54, z: 39, rotationY: -0.15 },
  "letter-waterfall-ruins": { x: -38, z: 21, rotationY: 0.55 },
  "letter-mountain-outpost": { x: -85, z: 36, rotationY: 0.7 },
  "letter-volcano-crater": { x: -19, z: -13, rotationY: -0.45 },
  "letter-flower-stone-circle": { x: 4, z: 13, rotationY: 0.3 },
  "letter-moon-cliffs": { x: 54, z: -4, rotationY: -0.7 },
  "letter-treasure-sandbar": { x: -9, z: 7, rotationY: 0.35 },
} as const satisfies Readonly<Record<LoreLetterId, { x: number; z: number; rotationY: number }>>;
type HutBuildableId = Extract<BuildableId, "hut_foundation" | "hut_wall" | "hut_doorway" | "hut_roof">;
type FoundationSupportDepths = readonly [number, number, number, number];

export interface BuildPlacement {
  position: Vector3;
  rotationY: number;
  valid: boolean;
  reason: string;
}
const ISLAND_TERRAIN_SEEDS: Readonly<Record<IslandId, number>> = {
  "kleine-sandbank": 11,
  dschungelbucht: 29,
  palmenlagune: 47,
  mangrovenbucht: 61,
  felsenriff: 83,
  wasserfallinsel: 101,
  dschungelberg: 127,
  vulkaninsel: 149,
  blueteninsel: 173,
  mondklippen: 197,
  schatzsandbank: 223,
};

interface TerrainRise {
  readonly x: number;
  readonly z: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly height: number;
  readonly power?: number;
}

interface TerrainGorge {
  readonly fromX: number;
  readonly fromZ: number;
  readonly toX: number;
  readonly toZ: number;
  readonly width: number;
  readonly depth: number;
}

interface IslandTerrainStructure {
  readonly baseHeightFactor: number;
  readonly terraceStep: number;
  readonly terraceBlend: number;
  readonly rises: readonly TerrainRise[];
  readonly gorges: readonly TerrainGorge[];
}

interface FreshwaterBasinDefinition {
  readonly id: string;
  readonly name: string;
  readonly islandId: IslandId;
  readonly normalizedX: number;
  readonly normalizedZ: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly depth: number;
  readonly surfaceInset: number;
  readonly fixedSurfaceY?: number;
}

interface WatercoursePoint {
  readonly x: number;
  readonly z: number;
  readonly width: number;
}

interface WatercourseDefinition {
  readonly id: string;
  readonly name: string;
  readonly islandId: IslandId;
  readonly depth: number;
  readonly points: readonly WatercoursePoint[];
}

interface ResolvedFreshwaterBasin {
  readonly x: number;
  readonly z: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly surfaceY: number;
}

type ResolvedWatercoursePoint = WatercoursePoint & { surfaceY: number };

export const ISLAND_TERRAIN_STRUCTURES: Readonly<Partial<Record<IslandId, IslandTerrainStructure>>> = {
  dschungelbucht: {
    baseHeightFactor: 0.2,
    terraceStep: 2.4,
    terraceBlend: 0.2,
    rises: [
      { x: -0.16, z: -0.2, radiusX: 0.4, radiusZ: 0.34, height: 13 },
      { x: 0.36, z: 0.28, radiusX: 0.3, radiusZ: 0.3, height: 10 },
      { x: 0.18, z: -0.48, radiusX: 0.28, radiusZ: 0.22, height: 12 },
      { x: -0.43, z: 0.29, radiusX: 0.3, radiusZ: 0.2, height: 8 },
    ],
    gorges: [
      { fromX: -0.38, fromZ: -0.5, toX: 0.04, toZ: 0.2, width: 0.075, depth: 6.5 },
      { fromX: 0.08, fromZ: 0.18, toX: 0.48, toZ: 0.5, width: 0.055, depth: 4 },
    ],
  },
  palmenlagune: {
    baseHeightFactor: 0.12,
    terraceStep: 1.25,
    terraceBlend: 0.16,
    rises: [
      { x: -0.48, z: -0.12, radiusX: 0.28, radiusZ: 0.32, height: 7.2 },
      { x: 0.42, z: -0.3, radiusX: 0.27, radiusZ: 0.24, height: 6.4 },
      { x: 0.08, z: -0.56, radiusX: 0.3, radiusZ: 0.2, height: 5.8 },
      { x: -0.24, z: 0.4, radiusX: 0.22, radiusZ: 0.2, height: 4.8 },
    ],
    gorges: [
      { fromX: -0.7, fromZ: 0.05, toX: -0.24, toZ: 0.02, width: 0.055, depth: 2.2 },
      { fromX: 0.26, fromZ: -0.58, toX: 0.62, toZ: -0.2, width: 0.05, depth: 1.8 },
    ],
  },
  mangrovenbucht: {
    baseHeightFactor: 0.1,
    terraceStep: 1.1,
    terraceBlend: 0.12,
    rises: [
      { x: -0.48, z: 0.28, radiusX: 0.28, radiusZ: 0.24, height: 4.8 },
      { x: 0.42, z: 0.34, radiusX: 0.3, radiusZ: 0.22, height: 5.2 },
      { x: -0.28, z: -0.38, radiusX: 0.25, radiusZ: 0.2, height: 3.8 },
      { x: 0.48, z: -0.28, radiusX: 0.22, radiusZ: 0.25, height: 4.3 },
    ],
    gorges: [
      { fromX: -0.72, fromZ: -0.12, toX: 0.7, toZ: 0.12, width: 0.055, depth: 2.4 },
      { fromX: -0.12, fromZ: -0.64, toX: 0.08, toZ: 0.62, width: 0.04, depth: 1.7 },
    ],
  },
  felsenriff: {
    baseHeightFactor: 0.3,
    terraceStep: 2.1,
    terraceBlend: 0.38,
    rises: [
      { x: 0, z: 0, radiusX: 0.32, radiusZ: 0.38, height: 9.5 },
      { x: -0.42, z: -0.24, radiusX: 0.3, radiusZ: 0.28, height: 8.5 },
      { x: 0.43, z: 0.26, radiusX: 0.28, radiusZ: 0.25, height: 10.5 },
      { x: 0.32, z: -0.4, radiusX: 0.22, radiusZ: 0.2, height: 7.5 },
    ],
    gorges: [
      { fromX: -0.58, fromZ: 0.42, toX: 0.55, toZ: -0.3, width: 0.06, depth: 6.5 },
      { fromX: -0.2, fromZ: -0.62, toX: 0.08, toZ: 0.58, width: 0.045, depth: 4.8 },
    ],
  },
  wasserfallinsel: {
    baseHeightFactor: 0.18,
    terraceStep: 3.4,
    terraceBlend: 0.28,
    rises: [
      { x: -0.08, z: 0, radiusX: 0.38, radiusZ: 0.42, height: 27 },
      { x: -0.48, z: -0.3, radiusX: 0.3, radiusZ: 0.25, height: 20 },
      { x: -0.4, z: 0.38, radiusX: 0.28, radiusZ: 0.25, height: 18 },
      { x: 0.28, z: 0.42, radiusX: 0.24, radiusZ: 0.22, height: 14 },
    ],
    gorges: [
      { fromX: -0.12, fromZ: 0.02, toX: 0.62, toZ: 0, width: 0.055, depth: 8.5 },
      { fromX: -0.48, fromZ: -0.5, toX: -0.18, toZ: -0.08, width: 0.06, depth: 6 },
    ],
  },
  dschungelberg: {
    baseHeightFactor: 0.2,
    terraceStep: 4.5,
    terraceBlend: 0.24,
    rises: [
      { x: 0.02, z: -0.04, radiusX: 0.36, radiusZ: 0.42, height: 49 },
      { x: 0.4, z: -0.28, radiusX: 0.3, radiusZ: 0.3, height: 39 },
      { x: 0.34, z: 0.4, radiusX: 0.28, radiusZ: 0.25, height: 34 },
      { x: -0.42, z: -0.34, radiusX: 0.25, radiusZ: 0.24, height: 31 },
      { x: -0.3, z: 0.38, radiusX: 0.27, radiusZ: 0.22, height: 28 },
    ],
    gorges: [
      { fromX: 0.1, fromZ: -0.62, toX: 0.5, toZ: 0.42, width: 0.07, depth: 15 },
      { fromX: -0.56, fromZ: -0.12, toX: -0.08, toZ: 0.32, width: 0.065, depth: 11 },
      { fromX: -0.12, fromZ: 0.4, toX: 0.42, toZ: 0.56, width: 0.05, depth: 8 },
    ],
  },
  vulkaninsel: {
    baseHeightFactor: 0.13,
    terraceStep: 1.8,
    terraceBlend: 0.08,
    rises: [
      { x: -0.5, z: 0.32, radiusX: 0.24, radiusZ: 0.22, height: 5.5 },
      { x: 0.52, z: 0.34, radiusX: 0.25, radiusZ: 0.24, height: 7 },
      { x: 0.46, z: -0.46, radiusX: 0.23, radiusZ: 0.2, height: 5 },
      { x: -0.44, z: -0.38, radiusX: 0.25, radiusZ: 0.22, height: 6 },
    ],
    gorges: [
      { fromX: -0.2, fromZ: 0.08, toX: -0.68, toZ: 0.5, width: 0.045, depth: 2.4 },
      { fromX: 0.22, fromZ: 0.1, toX: 0.65, toZ: 0.48, width: 0.04, depth: 2 },
    ],
  },
  blueteninsel: {
    baseHeightFactor: 0.18,
    terraceStep: 2.2,
    terraceBlend: 0.1,
    rises: [
      { x: -0.33, z: -0.08, radiusX: 0.33, radiusZ: 0.42, height: 11 },
      { x: 0.34, z: 0.12, radiusX: 0.35, radiusZ: 0.4, height: 12.5 },
      { x: -0.02, z: 0.45, radiusX: 0.3, radiusZ: 0.22, height: 7.5 },
      { x: 0.08, z: -0.48, radiusX: 0.28, radiusZ: 0.2, height: 6.5 },
    ],
    gorges: [
      { fromX: -0.14, fromZ: -0.62, toX: -0.02, toZ: 0.58, width: 0.05, depth: 2.2 },
      { fromX: -0.55, fromZ: 0.34, toX: 0.55, toZ: -0.24, width: 0.04, depth: 1.6 },
    ],
  },
  mondklippen: {
    baseHeightFactor: 0.28,
    terraceStep: 2.8,
    terraceBlend: 0.3,
    rises: [
      { x: 0.34, z: 0, radiusX: 0.42, radiusZ: 0.5, height: 17 },
      { x: -0.15, z: -0.48, radiusX: 0.36, radiusZ: 0.25, height: 19 },
      { x: -0.18, z: 0.49, radiusX: 0.34, radiusZ: 0.24, height: 21 },
      { x: 0.55, z: 0.3, radiusX: 0.22, radiusZ: 0.24, height: 12 },
    ],
    gorges: [
      { fromX: -0.58, fromZ: 0, toX: 0.15, toZ: 0, width: 0.08, depth: 8 },
      { fromX: 0.08, fromZ: -0.58, toX: 0.45, toZ: 0.48, width: 0.045, depth: 5.5 },
    ],
  },
};

const FRESHWATER_BASINS: readonly FreshwaterBasinDefinition[] = [
  {
    id: "freshwater-spring",
    name: "Dschungelquellteich",
    islandId: "dschungelbucht",
    normalizedX: 0.233,
    normalizedZ: 0.136,
    radiusX: 8.8,
    radiusZ: 6.2,
    depth: 1.05,
    surfaceInset: 0.42,
  },
  {
    id: "wasserfallinsel-source-lake",
    name: "Quellsee",
    islandId: "wasserfallinsel",
    normalizedX: 0.14,
    normalizedZ: -0.08,
    radiusX: 12.5,
    radiusZ: 7.8,
    depth: 1.25,
    surfaceInset: 0.5,
  },
  {
    id: "wasserfallinsel-pool",
    name: "Nebelpool",
    islandId: "wasserfallinsel",
    normalizedX: 0.56,
    normalizedZ: 0,
    radiusX: 10.8,
    radiusZ: 8.4,
    depth: 1.45,
    surfaceInset: 0,
    fixedSurfaceY: 0.46,
  },
  {
    id: "dschungelberg-spring",
    name: "Bergquellteich",
    islandId: "dschungelberg",
    normalizedX: -0.36,
    normalizedZ: 0.24,
    radiusX: 8.4,
    radiusZ: 5.8,
    depth: 1.1,
    surfaceInset: 0.44,
  },
] as const;

const WATERCOURSES: readonly WatercourseDefinition[] = [
  {
    id: "dschungelbucht-spring-run",
    name: "Quellbach",
    islandId: "dschungelbucht",
    depth: 0.32,
    points: [
      { x: 0.27, z: 0.15, width: 2.1 },
      { x: 0.15, z: 0.22, width: 1.9 },
      { x: -0.01, z: 0.31, width: 1.75 },
      { x: -0.22, z: 0.4, width: 1.65 },
      { x: -0.47, z: 0.49, width: 1.8 },
      { x: -0.73, z: 0.56, width: 2.35 },
    ],
  },
  {
    id: "wasserfallinsel-upper-river",
    name: "Quellfluss",
    islandId: "wasserfallinsel",
    depth: 0.38,
    points: [
      { x: 0.19, z: -0.065, width: 2.4 },
      { x: 0.24, z: -0.025, width: 2.25 },
      { x: 0.3, z: 0.018, width: 2.15 },
      { x: 0.35, z: -0.012, width: 2.25 },
      { x: 0.425, z: 0, width: 2.65 },
    ],
  },
  {
    id: "dschungelberg-mountain-run",
    name: "Bergbach",
    islandId: "dschungelberg",
    depth: 0.34,
    points: [
      { x: -0.4, z: 0.25, width: 1.75 },
      { x: -0.49, z: 0.29, width: 1.65 },
      { x: -0.59, z: 0.35, width: 1.6 },
      { x: -0.69, z: 0.43, width: 1.75 },
      { x: -0.78, z: 0.51, width: 2.05 },
      { x: -0.86, z: 0.58, width: 2.5 },
    ],
  },
] as const;

const WATERCOURSE_PATH_CACHE = new Map<string, readonly ResolvedWatercoursePoint[]>();
const FRESHWATER_BASIN_CACHE = new Map<string, ResolvedFreshwaterBasin>();

export type WorldQualityProfile = "low" | "medium" | "high" | "ultra";

const STREAMING_DISTANCE_FACTORS: Readonly<Record<WorldQualityProfile, number>> = {
  low: 0.72,
  medium: 0.88,
  high: 1,
  ultra: 1.15,
};

const KIT_LANDMARK_CLEARINGS: Readonly<Partial<Record<IslandId, readonly {
  x: number;
  z: number;
  radius: number;
}[]>>> = {
  dschungelbucht: [
    { x: 89, z: -40, radius: 25 },
    { x: -65, z: 62, radius: 19 },
  ],
  palmenlagune: [{ x: -48, z: 31, radius: 23 }],
  mangrovenbucht: [{ x: -61, z: -45, radius: 19 }],
  felsenriff: [
    { x: 67, z: 40, radius: 21 },
    { x: -25, z: -48, radius: 14 },
    { x: -34, z: -7, radius: 11 },
    { x: 6, z: 12, radius: 10 },
    { x: 42, z: -14, radius: 9 },
  ],
  wasserfallinsel: [
    { x: -45, z: 26, radius: 18 },
    { x: 68, z: -55, radius: 20 },
  ],
  dschungelberg: [
    { x: -92, z: 37, radius: 21 },
    { x: -38, z: 4, radius: 14 },
    { x: 8, z: -8, radius: 12 },
    { x: 48, z: 18, radius: 11 },
  ],
  vulkaninsel: [{ x: VOLCANO_LANDMARK.localX, z: VOLCANO_LANDMARK.localZ, radius: 66 }],
  blueteninsel: [{ x: 0, z: 8, radius: 15 }],
  mondklippen: [
    { x: -47, z: -62, radius: 14 },
    { x: -50, z: 64, radius: 14 },
  ],
  schatzsandbank: [{ x: 7, z: 0, radius: 10 }],
};

const ORIGINAL_ISLAND_DIMENSIONS: Readonly<Record<IslandId, IslandDimensions>> = {
  "kleine-sandbank": { widthMeters: 65, depthMeters: 45 },
  dschungelbucht: { widthMeters: 300, depthMeters: 220 },
  palmenlagune: { widthMeters: 230, depthMeters: 170 },
  mangrovenbucht: { widthMeters: 250, depthMeters: 180 },
  felsenriff: { widthMeters: 210, depthMeters: 145 },
  wasserfallinsel: { widthMeters: 350, depthMeters: 260 },
  dschungelberg: { widthMeters: 400, depthMeters: 300 },
  vulkaninsel: { widthMeters: 350, depthMeters: 270 },
  blueteninsel: { widthMeters: 320, depthMeters: 230 },
  mondklippen: { widthMeters: 320, depthMeters: 230 },
  schatzsandbank: { widthMeters: 82, depthMeters: 58 },
};

export type WildlifeKind = "wild_boar" | "chicken" | "turtle" | "bird" | "crocodile" | "snake";
export type WildlifeBehaviorState = "sleeping" | "feeding" | "drinking" | "wandering" | "alerted";

interface IslandWildlifeCounts {
  readonly wildBoars: number;
  readonly chickens: number;
  readonly turtles: number;
  readonly birds: number;
  readonly crocodiles: number;
  readonly snakes: number;
}

export const ISLAND_WILDLIFE: Readonly<Partial<Record<IslandId, Readonly<IslandWildlifeCounts>>>> = {
  dschungelbucht: { wildBoars: 8, chickens: 10, turtles: 2, birds: 3, crocodiles: 0, snakes: 4 },
  palmenlagune: { wildBoars: 2, chickens: 9, turtles: 5, birds: 4, crocodiles: 0, snakes: 0 },
  mangrovenbucht: { wildBoars: 4, chickens: 6, turtles: 3, birds: 4, crocodiles: 5, snakes: 5 },
  felsenriff: { wildBoars: 0, chickens: 0, turtles: 4, birds: 3, crocodiles: 0, snakes: 0 },
  wasserfallinsel: { wildBoars: 6, chickens: 7, turtles: 3, birds: 3, crocodiles: 0, snakes: 4 },
  dschungelberg: { wildBoars: 8, chickens: 5, turtles: 0, birds: 3, crocodiles: 0, snakes: 4 },
  vulkaninsel: { wildBoars: 0, chickens: 2, turtles: 2, birds: 3, crocodiles: 0, snakes: 0 },
  blueteninsel: { wildBoars: 3, chickens: 10, turtles: 3, birds: 6, crocodiles: 0, snakes: 0 },
  mondklippen: { wildBoars: 2, chickens: 4, turtles: 4, birds: 7, crocodiles: 0, snakes: 0 },
  schatzsandbank: { wildBoars: 0, chickens: 0, turtles: 1, birds: 2, crocodiles: 0, snakes: 0 },
};

export const WORLD_SCENERY_MODEL_IDS = [
  "nature.flower-red",
  "nature.flower-yellow",
  "nature.grass",
  "nature.grass-leafs",
  "nature.grass-leafs-large",
  "nature.grass-large",
  "nature.lily-large",
  "nature.river-straight",
  "nature.river-rocks",
  "nature.mushroom-red-group",
  "nature.mushroom-tan-group",
  "nature.bush-detailed",
  "nature.bush-large",
  "nature.plant-flat-short",
  "nature.plant-flat-tall",
  "nature.rock-large-b",
  "nature.rock-large-c",
  "nature.rock-small-b",
  "nature.rock-small-flat",
  "nature.rock-tall-c",
  "nature.rock-tall-f",
  "nature.statue-column-damaged",
  "nature.statue-head",
  "nature.statue-obelisk",
  "nature.stump-old-tall",
  "nature.tree-default",
  "survival.barrel",
  "survival.bottle-large",
  "survival.box-large",
  "survival.bucket",
  "survival.campfire-fishing-stand",
  "survival.fence-fortified",
  "survival.resource-planks",
  "survival.resource-wood",
  "survival.signpost",
  "survival.structure-floor",
  "survival.structure",
  "survival.structure-roof",
  "survival.fence-doorway",
  "survival.tent",
  "survival.workbench-anvil",
  "environment.volcano",
] as const;

export type WorldEntityKind = ItemId | "palm" | "tree" | "crab" | WildlifeKind | "shark" | "freshwater" | "brackwater" | "wreck_chest" | "summit_cache" | "crater_cache" | "waterfall_cache" | "moon_cache" | "buried_chest" | "signal_beacon" | "climbing_anchor" | "death_pack" | "lore_letter" | "building" | "raft";

export interface LootStack {
  itemId: ItemId;
  count: number;
}

export interface ClimbOutcome {
  success: boolean;
  message: string;
  destination?: Vec3Like;
  staminaCost: number;
  reachesSummit?: boolean;
}

interface WorldEntity {
  id: string;
  kind: WorldEntityKind;
  object: Object3D;
  available: boolean;
  amount: number;
  hitPoints: number;
  maxHitPoints: number;
  collider?: ReturnType<RapierPhysicsWorld["addFixedCylinder"]>;
  cooldown: number;
  home?: Vector3;
  dynamicDrop?: boolean;
  falling?: FallingTreeState;
  instancedTree?: InstancedTreeInstance;
  mixer?: AnimationMixer;
  animationActions?: Map<string, AnimationAction>;
  activeAnimation?: string;
  wildlifePhase?: number;
  wildlifeState?: WildlifeBehaviorState;
  wildlifeProvoked?: boolean;
  wildlifeGroupId?: string;
  wildlifeWaterTarget?: Vector3;
  wildlifePerch?: Vector3;
  wildlifeLastTrackPosition?: Vector3;
  wildlifeTrackCooldown?: number;
  burningSeconds?: number;
  fireObject?: Object3D;
  climbDestination?: Vec3Like;
  climbReachesSummit?: boolean;
}

interface FallingTreeState {
  elapsedSeconds: number;
  readonly startQuaternion: Quaternion | null;
  readonly axis: Vector3;
  readonly direction: Vector3;
}

interface InstancedTreeInstance {
  readonly variant: "jungle" | "mangrove";
  readonly index: number;
  readonly center: Vector3;
  readonly position: Vector3;
  readonly height: number;
  readonly rotationY: number;
  readonly rootScaleX: number;
  readonly rootScaleZ: number;
  readonly roots: InstancedMesh | null;
  readonly trunks: InstancedMesh;
  readonly crowns: InstancedMesh;
  readonly silhouettes: InstancedMesh | null;
}

interface FishSchool {
  readonly object: Group;
  readonly home: Vector3;
  readonly islandId: IslandId;
  readonly orbitRadius: number;
  readonly speed: number;
  readonly phase: number;
  availableAtSeconds: number;
}

interface WildlifeTrack {
  readonly object: Group;
  ageSeconds: number;
  readonly lifetimeSeconds: number;
}

interface KitSceneryPlacement {
  readonly assetId: string;
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly rotationY?: number;
  readonly colliderRadius?: number;
}

export interface BuildingState {
  id: string;
  type: Exclude<BuildableId, "raft_base" | "raft_deck">;
  position: Vec3Like;
  rotationY: number;
  waterCharges: number;
  waterProgress: number;
  fireFuel: number;
  cookingProgress: number;
  cookingItem?: "crab" | "raw_meat" | "raw_fish";
  fishTrapProgress?: number;
  fishTrapStored?: number;
  fishTrapBaited?: boolean;
  smokerProgress?: number;
  smokerInputCount?: number;
  smokerReadyCount?: number;
  foundationSupportDepths?: FoundationSupportDepths;
  storedItems?: ItemStack[];
}

export interface RaftState {
  id: string;
  position: Vec3Like;
  rotation: { x: number; y: number; z: number; w: number };
  hasDeck: boolean;
  durability: number;
}

export interface DynamicDropState {
  id: string;
  itemId: ItemId;
  count: number;
  position: Vec3Like;
}

export interface WorldSaveState {
  removedEntityIds: string[];
  removedEntityDays: Record<string, number>;
  buildings: BuildingState[];
  raft: RaftState | null;
  wreckLooted: boolean;
  sharkAlive: boolean;
  deathPacks: Array<{ id: string; position: Vec3Like; loot: LootStack[] }>;
  dynamicDrops: DynamicDropState[];
}

export type WorldEvent =
  | { type: "player-damage"; amount: number; text: string; causesBleeding?: boolean }
  | { type: "player-poison"; text: string }
  | { type: "raft-damage"; amount: number; text: string }
  | { type: "message"; text: string };

export interface LookTarget {
  id: string;
  kind: WorldEntityKind;
  label: string;
  distance: number;
}

export interface AttackOutcome {
  hit: boolean;
  message?: string;
  loot?: LootStack[];
}

export interface CollectOutcome {
  success: boolean;
  message: string;
  loot: LootStack[];
}

export class TropicalWorld {
  public readonly scene = new Scene();
  public readonly sun = new DirectionalLight(0xffefcf, 3.2);
  private readonly hemisphere = new HemisphereLight(0x91d8ff, 0x3b2d16, 1.8);
  private readonly entities = new Map<string, WorldEntity>();
  private readonly fallingTrees = new Set<WorldEntity>();
  private readonly raycaster = new Raycaster();
  private readonly mouseCenter = new Vector2(0, 0);
  private readonly removedEntityIds = new Set<string>();
  private readonly removedEntityDays = new Map<string, number>();
  private readonly buildings = new Map<string, BuildingState>();
  private readonly buildingObjects = new Map<string, Object3D>();
  private readonly deathPackLoot = new Map<string, LootStack[]>();
  private readonly dynamicDropIds = new Set<string>();
  private readonly streamedScenery: Array<{ object: Object3D; center: Vector3; distance: number }> = [];
  private readonly fishSchools: FishSchool[] = [];
  private readonly wildlifeTrackGroup = new Group();
  private readonly wildlifeTracks: WildlifeTrack[] = [];
  private readonly shorelineFoamMaterials: ShaderMaterial[] = [];
  private readonly raftObject = new Group();
  private readonly rain = createRainVisual();
  private readonly lightningLight = new PointLight(0xd8edff, 0, 230, 1.25);
  private readonly interactiveObjects: Object3D[] = [];
  private readonly inlandWaterMaterials: ShaderMaterial[] = [];
  private readonly oceanMaterial: ShaderMaterial;
  private readonly skyMaterial: ShaderMaterial;
  private skyObject: Mesh | null = null;
  private raft: RaftState | null = null;
  private shark: WorldEntity | null = null;
  private wreckLooted = false;
  private elapsedSeconds = 0;
  private currentDay = 1;
  private entityCounter = 0;
  private streamingDistanceFactor = STREAMING_DISTANCE_FACTORS.high;
  private playerUnderwater = false;
  private currentWeather: WeatherState = weatherState("clear");
  private currentOceanConditions = oceanConditionsForWeather("clear", 0);
  private lastLightningSlot = -1;
  private lightningFlashSeconds = 0;
  private volcanicHeatSeconds = 0;

  public constructor(
    private readonly physics: RapierPhysicsWorld,
    private readonly assets: AssetService,
  ) {
    this.scene.background = new Color(0x7bc8df);
    this.scene.fog = new FogExp2(0x8fcad4, 0.00155);
    this.sun.position.set(-120, 180, 80);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -90;
    this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90;
    this.sun.shadow.camera.bottom = -90;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 480;
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.normalBias = 0.045;
    this.wildlifeTrackGroup.name = "Kurzlebige Tierspuren";
    this.scene.add(this.sun, this.sun.target, this.hemisphere, this.rain, this.lightningLight, this.wildlifeTrackGroup);
    this.oceanMaterial = createOceanMaterial();
    this.skyMaterial = createSkyMaterial();
  }

  public async initialize(onProgress?: (progress: number) => void): Promise<void> {
    await this.assets.preloadModels(
      [
        "nature.palm-bent",
        "nature.palm-detailed-short",
        "nature.palm-detailed-tall",
        "nature.rock-small",
        "nature.rock-large",
        "nature.log",
        "survival.bedroll",
        "survival.bedroll-frame",
        "survival.campfire-pit",
        "survival.chest",
        "survival.fish",
        "survival.tent-canvas",
        "survival.tool-axe",
        "survival.tool-hammer",
        "survival.workbench",
        "animal.wild-boar",
        "animal.chicken",
        "animal.turtle",
        "animal.bird",
        "animal.crocodile",
        "food.meat-raw",
        "food.meat-cooked",
        ...WORLD_SCENERY_MODEL_IDS,
      ],
      (value) => onProgress?.(value * 0.35),
    );
    this.buildTerrain();
    onProgress?.(0.55);
    this.buildOceanAndSky();
    this.populateWorld();
    onProgress?.(1);
  }

  public dispose(): void {
    this.scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Points) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      }
    });
    this.oceanMaterial.dispose();
    this.skyMaterial.dispose();
  }

  public heightAt(x: number, z: number): number {
    let height = -8;
    for (const island of WORLD_MANIFEST.islands) height = Math.max(height, islandHeightAt(x, z, island));
    return height;
  }

  public isDeepWater(x: number, z: number): boolean {
    return this.heightAt(x, z) < -2.5;
  }

  public getIslandAt(x: number, z: number): WorldIslandManifest | null {
    let closest: { island: WorldIslandManifest; distance: number } | null = null;
    for (const island of WORLD_MANIFEST.islands) {
      const dx = (x - island.positionMeters.x) / (island.dimensions.widthMeters * 0.5);
      const dz = (z - island.positionMeters.z) / (island.dimensions.depthMeters * 0.5);
      const distance = Math.hypot(dx, dz);
      if (distance <= 1.08 && (!closest || distance < closest.distance)) closest = { island, distance };
    }
    return closest?.island ?? null;
  }

  public getFishSchoolPositions(): Vec3Like[] {
    return this.fishSchools.map(({ object }) => ({
      x: object.position.x,
      y: object.position.y,
      z: object.position.z,
    }));
  }

  public getWildlifePositions(): Array<{ id: string; kind: WildlifeKind; position: Vec3Like; state: WildlifeBehaviorState; groupId: string; hasWaterTarget: boolean; isAirborne: boolean }> {
    return [...this.entities.values()].flatMap((entity) =>
      isWildlifeKind(entity.kind) && entity.available
        ? [{
            id: entity.id,
            kind: entity.kind,
            position: { x: entity.object.position.x, y: entity.object.position.y, z: entity.object.position.z },
            state: entity.wildlifeState ?? "wandering",
            groupId: entity.wildlifeGroupId ?? entity.id,
            hasWaterTarget: Boolean(entity.wildlifeWaterTarget),
            isAirborne: entity.kind === "bird" && entity.object.position.y - this.heightAt(entity.object.position.x, entity.object.position.z) > 1.2,
          }]
        : [],
    );
  }

  public getWildlifeTrackCount(): number {
    return this.wildlifeTracks.length;
  }

  public getOceanConditions(): OceanConditions {
    return { ...this.currentOceanConditions };
  }

  public update(
    dtSeconds: number,
    elapsedSeconds: number,
    day: number,
    timeOfDay: number,
    playerPosition: Vec3Like,
    playerSwimming: boolean,
    playerOnRaft: boolean,
    playerUnderwater = false,
    weather: WeatherState = weatherState("clear"),
    playerNoise = 0,
  ): WorldEvent[] {
    this.elapsedSeconds = elapsedSeconds;
    this.playerUnderwater = playerUnderwater;
    this.currentWeather = weather;
    this.currentOceanConditions = oceanConditionsForWeather(weather.kind, elapsedSeconds);
    this.oceanMaterial.uniforms.uTime!.value = elapsedSeconds;
    this.oceanMaterial.uniforms.uWaveHeight!.value = this.currentOceanConditions.waveHeight;
    this.oceanMaterial.uniforms.uWaveSpeed!.value = this.currentOceanConditions.waveSpeed;
    this.oceanMaterial.uniforms.uChoppiness!.value = this.currentOceanConditions.choppiness;
    this.oceanMaterial.uniforms.uFoamStrength!.value = this.currentOceanConditions.foamStrength;
    this.oceanMaterial.uniforms.uTideHeight!.value = this.currentOceanConditions.tideHeight;
    (this.oceanMaterial.uniforms.uWind!.value as Vector2).set(this.currentOceanConditions.windX, this.currentOceanConditions.windZ);
    for (const material of this.shorelineFoamMaterials) {
      material.uniforms.uTime!.value = elapsedSeconds;
      material.uniforms.uStrength!.value = 0.72 + this.currentOceanConditions.foamStrength * 0.55;
      material.uniforms.uTideHeight!.value = this.currentOceanConditions.tideHeight;
    }
    this.physics.setOceanConditions?.(this.currentOceanConditions);
    for (const material of this.inlandWaterMaterials) material.uniforms.uTime!.value = elapsedSeconds;
    this.skyObject?.position.set(playerPosition.x, playerPosition.y, playerPosition.z);
    this.updateLighting(timeOfDay, playerPosition);
    this.updateRaftVisual();
    this.animateVegetation(elapsedSeconds);
    const treeEvents = this.updateFallingTrees(dtSeconds);
    const events: WorldEvent[] = [...treeEvents];
    this.updateFishSchools(elapsedSeconds, playerPosition);
    this.updateStreaming(playerPosition);
    this.updateRain(dtSeconds, playerPosition, weather);

    const volcanicHeat = this.getVolcanicHeatLevel(playerPosition);
    if (volcanicHeat > 0 && !playerSwimming && !playerUnderwater) {
      this.volcanicHeatSeconds += dtSeconds;
      if (this.volcanicHeatSeconds >= VOLCANIC_HEAT_DAMAGE_INTERVAL_SECONDS) {
        this.volcanicHeatSeconds %= VOLCANIC_HEAT_DAMAGE_INTERVAL_SECONDS;
        const amount = volcanicHeat === 2 ? (weather.isRaining ? 3 : 8) : weather.isRaining ? 0 : 4;
        if (amount > 0) events.push({
          type: "player-damage",
          amount,
          text: volcanicHeat === 2
            ? "Die Gluthitze am Krater verbrennt dich – zieh dich zurück und trink Wasser!"
            : "Die Vulkanhitze zehrt an dir – halte Wasser bereit.",
        });
      }
    } else this.volcanicHeatSeconds = 0;

    while (this.currentDay < day) {
      this.currentDay += 1;
      this.replenishDaily(this.currentDay);
    }

    for (const building of this.buildings.values()) {
      if ((building.type === "palm_still" || building.type === "rain_collector")) {
        const capacity = building.type === "rain_collector" ? 5 : 3;
        const collectionMultiplier = building.type === "rain_collector"
          ? weather.isRaining ? weather.rainCollectionMultiplier : 0
          : weather.rainCollectionMultiplier;
        if (building.waterCharges < capacity) building.waterProgress += dtSeconds * collectionMultiplier;
        while (building.waterProgress >= 360 && building.waterCharges < capacity) {
          building.waterProgress -= 360;
          building.waterCharges += 1;
          events.push({ type: "message", text: `${building.type === "rain_collector" ? "Der Regenfänger" : "Die Palm-Destille"} hat eine Portion Wasser gesammelt.` });
        }
      }
      if (building.type === "campfire") {
        building.fireFuel = Math.max(0, building.fireFuel - dtSeconds);
        if (building.cookingProgress > 0 && building.fireFuel > 0) {
          building.cookingProgress += dtSeconds;
        }
        this.updateCampfireCookingVisual(building);
      }
      if (building.type === "fish_trap") {
        const stored = building.fishTrapStored ?? 0;
        if (building.fishTrapBaited && stored < FISH_TRAP_CAPACITY) {
          building.fishTrapProgress = (building.fishTrapProgress ?? 0) + dtSeconds;
          if (building.fishTrapProgress >= FISH_TRAP_CATCH_SECONDS) {
            building.fishTrapProgress = 0;
            building.fishTrapBaited = false;
            building.fishTrapStored = stored + 1;
            events.push({ type: "message", text: "Eine Fischreuse in der Palmenlagune hat einen Fisch gefangen." });
          }
        }
        this.updateFishTrapVisual(building);
      }
      if (building.type === "smoking_rack") {
        if ((building.smokerInputCount ?? 0) > 0 && (building.smokerReadyCount ?? 0) === 0) {
          building.smokerProgress = (building.smokerProgress ?? 0) + dtSeconds;
          if (building.smokerProgress >= SMOKING_DURATION_SECONDS) {
            building.smokerProgress = 0;
            building.smokerReadyCount = building.smokerInputCount ?? 0;
            building.smokerInputCount = 0;
            events.push({ type: "message", text: "Das Räucherfleisch in der Dschungelbucht ist fertig." });
          }
        }
        this.updateSmokingRackVisual(building);
      }
    }

    this.updateBurningTrees(dtSeconds, events);
    this.updateLightning(dtSeconds, playerPosition, weather, events);
    this.updateCrabs(dtSeconds, playerPosition, events);
    this.updateWildlife(dtSeconds, playerPosition, timeOfDay, playerNoise, events);
    this.updateShark(dtSeconds, playerPosition, playerSwimming, playerOnRaft, events);
    return events;
  }

  public forceLightningStrike(playerPosition: Vec3Like): WorldEvent[] {
    this.lightningFlashSeconds = 0.18;
    this.lightningLight.position.set(playerPosition.x, playerPosition.y + 18, playerPosition.z);
    const extinguishedFire = [...this.buildings.values()]
      .filter((building) => building.type === "campfire" && building.fireFuel <= 0 && distanceSquaredXZ(building.position, playerPosition) <= 65 * 65)
      .sort((a, b) => distanceSquaredXZ(a.position, playerPosition) - distanceSquaredXZ(b.position, playerPosition))[0];
    if (extinguishedFire) {
      extinguishedFire.fireFuel = 90;
      this.updateCampfireCookingVisual(extinguishedFire);
      this.lightningLight.position.set(extinguishedFire.position.x, extinguishedFire.position.y + 12, extinguishedFire.position.z);
      return [{ type: "message", text: "Ein Blitz schlägt ins Lagerfeuer ein und entzündet es!" }];
    }

    const tree = [...this.entities.values()]
      .filter((entity) => (entity.kind === "tree" || entity.kind === "palm") && entity.available && !entity.falling && distanceSquaredXZ(entity.object.position, playerPosition) <= 100 * 100)
      .sort((a, b) => distanceSquaredXZ(a.object.position, playerPosition) - distanceSquaredXZ(b.object.position, playerPosition))[0];
    if (tree) {
      const damage = Math.max(1, tree.maxHitPoints * 0.35);
      tree.hitPoints = Math.max(1, tree.hitPoints - damage);
      this.igniteTree(tree);
      this.lightningLight.position.set(tree.object.position.x, tree.object.position.y + 12, tree.object.position.z);
      return [{ type: "message", text: `Ein Blitz beschädigt ${tree.kind === "palm" ? "eine Palme" : "einen Baum"} und setzt das trockene Holz in Brand!` }];
    }
    return [{ type: "message", text: "Ein Blitz schlägt mit ohrenbetäubendem Knall in der Nähe ein." }];
  }

  public getVolcanicHeatLevel(position: Vec3Like): 0 | 1 | 2 {
    if (this.getIslandAt(position.x, position.z)?.id !== "vulkaninsel") return 0;
    const island = getIsland("vulkaninsel");
    const local = { x: position.x - island.positionMeters.x, z: position.z - island.positionMeters.z };
    const craterDistance = Math.hypot(local.x - VOLCANO_LANDMARK.localX, local.z - VOLCANO_LANDMARK.localZ);
    if (craterDistance < 52) return 2;
    if (craterDistance < 92) return 1;
    for (const path of VOLCANIC_LAVA_PATHS) {
      for (let index = 0; index < path.length - 1; index += 1) {
        const distance = distanceToSegmentXZ(local, path[index]!, path[index + 1]!);
        if (distance < 6) return 2;
        if (distance < 13) return 1;
      }
    }
    return 0;
  }

  public getCliffWindLevel(position: Vec3Like): 0 | 1 | 2 {
    if (this.getIslandAt(position.x, position.z)?.id !== "mondklippen") return 0;
    const island = getIsland("mondklippen");
    const localX = position.x - island.positionMeters.x;
    const localZ = position.z - island.positionMeters.z;
    if (localX < -38 && Math.abs(localZ) > 24) return 2;
    const ground = this.heightAt(position.x, position.z);
    if (ground >= 15) return 2;
    if (ground >= 8 || (Math.abs(localZ) > 26 && localX < 85)) return 1;
    return 0;
  }

  public getLookTarget(camera: Camera, maxDistance = 4): LookTarget | null {
    this.raycaster.setFromCamera(this.mouseCenter, camera);
    const hits = this.raycaster.intersectObjects(this.interactiveObjects, true);
    for (const hit of hits) {
      if (hit.distance > maxDistance) break;
      const id = findEntityId(hit.object, hit.instanceId);
      if (!id) continue;
      const entity = this.entities.get(id);
      if (!entity?.available || entity.falling) continue;
      return { id, kind: entity.kind, label: labelForKind(entity.kind), distance: hit.distance };
    }
    return null;
  }

  public collect(targetId: string): CollectOutcome {
    const entity = this.entities.get(targetId);
    if (!entity?.available) return { success: false, message: "Hier gibt es nichts mehr.", loot: [] };
    if (entity.kind === "buried_chest") {
      if (!this.isBuriedChestDug()) return {
        success: false,
        message: "Die Truhe steckt tief im Sand. Du brauchst eine Schaufel, um sie freizulegen.",
        loot: [],
      };
      this.removeEntity(entity);
      return {
        success: true,
        message: "Truhe geöffnet: Du findest die Karte einer riesigen, noch unbekannten Insel.",
        loot: [{ itemId: "giant_island_map", count: 1 }],
      };
    }
    if (entity.kind === "wreck_chest") {
      if (this.wreckLooted) return { success: false, message: "Die Wrackkiste ist leer.", loot: [] };
      this.wreckLooted = true;
      entity.available = false;
      entity.object.visible = false;
      this.removedEntityIds.add(entity.id);
      return {
        success: true,
        message: "Wrackkiste geborgen: 8× Stoff und 2× Metallschrott.",
        loot: [
          { itemId: "cloth", count: 8 },
          { itemId: "metal_scrap", count: 2 },
        ],
      };
    }
    if (entity.kind === "summit_cache") {
      this.removeEntity(entity);
      return {
        success: true,
        message: "Gipfelvorrat geborgen: 2× Räucherfleisch, 2× Stoff und 2× Metallschrott.",
        loot: [
          { itemId: "smoked_meat", count: 2 },
          { itemId: "cloth", count: 2 },
          { itemId: "metal_scrap", count: 2 },
        ],
      };
    }
    if (entity.kind === "crater_cache") {
      this.removeEntity(entity);
      return {
        success: true,
        message: "Geologenkiste geborgen: 4× Obsidian, 2× Metallschrott und 2× Räucherfleisch.",
        loot: [
          { itemId: "obsidian_shard", count: 4 },
          { itemId: "metal_scrap", count: 2 },
          { itemId: "smoked_meat", count: 2 },
        ],
      };
    }
    if (entity.kind === "waterfall_cache") {
      this.removeEntity(entity);
      return {
        success: true,
        message: "Versteck hinter dem Wasserfall geborgen: 3× Stoff, 2× Metallschrott und 2× gegrillter Fisch.",
        loot: [
          { itemId: "cloth", count: 3 },
          { itemId: "metal_scrap", count: 2 },
          { itemId: "cooked_fish", count: 2 },
        ],
      };
    }
    if (entity.kind === "moon_cache") {
      const progress = this.getSignalBeaconProgress();
      if (progress.activated < progress.total) return {
        success: false,
        message: `Die Windgrat-Kiste ist verriegelt. Entzünde zuerst alle Windsignale (${progress.activated}/${progress.total}).`,
        loot: [],
      };
      this.removeEntity(entity);
      return {
        success: true,
        message: "Windgrat-Vorrat geborgen: 5× Stoff, 4× Metallschrott und 3× Räucherfleisch.",
        loot: [
          { itemId: "cloth", count: 5 },
          { itemId: "metal_scrap", count: 4 },
          { itemId: "smoked_meat", count: 3 },
        ],
      };
    }
    if (entity.kind === "freshwater") {
      return { success: true, message: "Du trinkst frisches Quellwasser.", loot: [] };
    }
    if (entity.kind === "brackwater") {
      return {
        success: true,
        message: "Das salzige Brackwasser lindert den Durst nur kurz und macht dich krank.",
        loot: [],
      };
    }
    if (entity.kind === "death_pack") {
      const loot = this.deathPackLoot.get(entity.id) ?? [];
      this.deathPackLoot.delete(entity.id);
      this.removeEntity(entity);
      return { success: true, message: "Dein verlorener Rucksack wurde geborgen.", loot: loot.map((entry) => ({ ...entry })) };
    }
    if (entity.kind === "building" || entity.kind === "raft" || entity.kind === "lore_letter" || entity.kind === "climbing_anchor" || entity.kind === "signal_beacon" || entity.kind === "palm" || entity.kind === "tree" || entity.kind === "crab" || isWildlifeKind(entity.kind) || entity.kind === "shark") {
      return { success: false, message: "Das kannst du nicht aufheben.", loot: [] };
    }
    const count = entity.dynamicDrop
      ? Math.max(1, Math.floor(entity.amount))
      : entity.kind === "fiber"
        ? 4
        : Math.max(1, entity.amount);
    this.removeEntity(entity);
    return {
      success: true,
      message: `${count}× ${labelForKind(entity.kind)} aufgenommen.`,
      loot: [{ itemId: entity.kind, count }],
    };
  }

  public isBuriedChestDug(): boolean {
    return this.removedEntityIds.has(TREASURE_CHEST_DUG_MARKER);
  }

  public digBuriedChest(targetId: string): CollectOutcome {
    const entity = this.entities.get(targetId);
    if (!entity?.available || entity.kind !== "buried_chest") return {
      success: false,
      message: "Hier gibt es keine vergrabene Truhe.",
      loot: [],
    };
    if (this.isBuriedChestDug()) return {
      success: true,
      message: "Die Truhe ist bereits freigelegt und kann geöffnet werden.",
      loot: [],
    };
    this.removedEntityIds.add(TREASURE_CHEST_DUG_MARKER);
    this.removedEntityDays.set(TREASURE_CHEST_DUG_MARKER, this.currentDay);
    this.updateBuriedChestVisual();
    return {
      success: true,
      message: "Du gräbst die Truhe aus dem Sand. Jetzt kannst du sie öffnen.",
      loot: [],
    };
  }

  public useClimbingAnchor(targetId: string): ClimbOutcome {
    const entity = this.entities.get(targetId);
    if (!entity?.available || entity.kind !== "climbing_anchor" || !entity.climbDestination) {
      return { success: false, message: "Dieser Seilanker ist nicht benutzbar.", staminaCost: 0 };
    }
    return {
      success: true,
      message: entity.climbReachesSummit
        ? "Du ziehst dich am letzten Seil zum Gipfelgrat hinauf. Der gesamte Archipel liegt unter dir."
        : "Du sicherst das Kletterset ein und steigst zur nächsten Bergterrasse auf.",
      destination: { ...entity.climbDestination },
      staminaCost: CLIMB_STAMINA_COST,
      ...(entity.climbReachesSummit ? { reachesSummit: true } : {}),
    };
  }

  public activateSignalBeacon(targetId: string): CollectOutcome {
    const entity = this.entities.get(targetId);
    if (!entity?.available || entity.kind !== "signal_beacon") return {
      success: false,
      message: "Dieses Windsignal ist bereits entzündet.",
      loot: [],
    };
    this.markSignalBeaconActivated(entity);
    const progress = this.getSignalBeaconProgress();
    return {
      success: true,
      message: progress.activated === progress.total
        ? "Das dritte Windsignal brennt. Die Windgrat-Kiste wurde entriegelt!"
        : `Windsignal entzündet (${progress.activated}/${progress.total}).`,
      loot: [],
    };
  }

  public getSignalBeaconProgress(): { activated: number; total: number } {
    const ids = ["moon-signal-1", "moon-signal-2", "moon-signal-3"];
    return {
      activated: ids.filter((id) => !this.entities.get(id)?.available).length,
      total: ids.length,
    };
  }

  public attack(camera: Camera, tool: ItemId | null): AttackOutcome {
    const target = this.getLookTarget(camera, tool === "wooden_spear" ? 3.4 : 2.5);
    if (!target) return { hit: false };
    const entity = this.entities.get(target.id);
    if (!entity?.available) return { hit: false };
    if (entity.kind === "palm" || entity.kind === "tree") {
      const treeLabel = entity.kind === "palm" ? "Palme" : "Baum";
      if (tool !== "stone_axe") return { hit: false, message: entity.kind === "palm" ? "Für die Palme brauchst du eine Steinaxt." : "Für den Baum brauchst du eine Steinaxt." };
      entity.hitPoints -= 1;
      if (entity.kind === "palm") entity.object.rotation.z += (entity.hitPoints % 2 === 0 ? 1 : -1) * 0.012;
      if (entity.hitPoints <= 0) {
        this.beginTreeFall(entity, camera);
        return { hit: true, message: `${treeLabel === "Palme" ? "Die Palme" : "Der Baum"} kippt – Vorsicht!` };
      }
      return { hit: true, message: `${treeLabel} getroffen (${entity.hitPoints}/${entity.maxHitPoints}).` };
    }
    if (entity.kind === "crab") {
      const damage = tool === "wooden_spear" ? 35 : tool === "obsidian_knife" ? 30 : tool === "stone_knife" ? 15 : tool === "stone_axe" ? 20 : 0;
      if (damage <= 0) return { hit: false, message: "Du brauchst ein Werkzeug gegen die Krabbe." };
      entity.hitPoints -= damage;
      if (entity.hitPoints <= 0) {
        this.removeEntity(entity);
        return { hit: true, message: "Krabbe erlegt.", loot: [{ itemId: "crab", count: 1 }] };
      }
      return { hit: true, message: "Die Krabbe weicht zurück." };
    }
    if (isWildlifeKind(entity.kind)) {
      const damage = tool === "wooden_spear"
        ? 35
        : tool === "stone_axe"
          ? 24
          : tool === "obsidian_knife"
            ? 28
            : tool === "stone_knife"
              ? 18
            : 0;
      if (damage <= 0) return { hit: false, message: `Du brauchst ein Werkzeug gegen ${wildlifeAccusativeLabel(entity.kind)}.` };
      entity.hitPoints -= damage;
      entity.cooldown = Math.max(entity.cooldown, 1.2);
      entity.wildlifeState = "alerted";
      if (entity.kind === "wild_boar") entity.wildlifeProvoked = true;
      if (entity.hitPoints <= 0) {
        this.setEntityAnimation(entity, "Death");
        this.removeEntity(entity);
        const jungleBayGame = this.getIslandAt(entity.object.position.x, entity.object.position.z)?.id === "dschungelbucht";
        const count = entity.kind === "crocodile"
          ? 4
          : entity.kind === "wild_boar"
            ? jungleBayGame ? 4 : 3
            : entity.kind === "chicken" && jungleBayGame
              ? 2
              : entity.kind === "turtle" ? 2 : 1;
        return { hit: true, message: `${labelForKind(entity.kind)} erlegt: ${count}× rohes Fleisch.`, loot: [{ itemId: "raw_meat", count }] };
      }
      return { hit: true, message: entity.kind === "wild_boar" || entity.kind === "crocodile" ? `${labelForKind(entity.kind)} wird aggressiv!` : `${labelForKind(entity.kind)} flieht!` };
    }
    if (entity.kind === "shark" && tool === "wooden_spear") {
      entity.hitPoints -= 30;
      entity.cooldown = 12;
      if (entity.hitPoints <= 0) {
        this.removeEntity(entity);
        return { hit: true, message: "Der Hai ist besiegt." };
      }
      return { hit: true, message: "Der Hai zieht sich kurz zurück." };
    }
    return { hit: false };
  }

  public fish(camera: Camera): AttackOutcome {
    const origin = new Vector3();
    const direction = new Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(direction);
    direction.y = 0;
    if (direction.lengthSq() <= Number.EPSILON) return { hit: false, message: "Richte die Angel auf einen Fischschwarm." };
    direction.normalize();

    const school = this.fishSchools
      .filter((candidate) => candidate.islandId === "palmenlagune")
      .map((candidate) => {
        const offset = candidate.object.position.clone().sub(origin);
        offset.y = 0;
        const distance = offset.length();
        const facing = distance > 0 ? direction.dot(offset.normalize()) : 1;
        return { candidate, distance, facing };
      })
      .filter(({ distance, facing }) => distance <= 34 && facing >= 0.48)
      .sort((left, right) => left.distance - right.distance)[0]?.candidate;
    if (!school) {
      return { hit: false, message: "Stell dich ans Ufer der Palmenlagune und richte die Angel auf einen sichtbaren Fischschwarm." };
    }
    if (this.elapsedSeconds < school.availableAtSeconds) {
      return { hit: false, message: "Der aufgescheuchte Fischschwarm muss sich erst wieder sammeln." };
    }
    school.availableAtSeconds = this.elapsedSeconds + FISHING_SCHOOL_COOLDOWN_SECONDS;
    return {
      hit: true,
      message: "Fisch gefangen! Der Köder ist verbraucht.",
      loot: [{ itemId: "raw_fish", count: 1 }],
    };
  }

  public createBuilding(type: Exclude<BuildableId, "raft_base" | "raft_deck">, position: Vec3Like, rotationY: number, restoredId?: string): BuildingState {
    const id = restoredId ?? `building-${++this.entityCounter}`;
    this.reserveEntityCounter(id);
    const foundationSupportDepths = type === "hut_foundation"
      ? this.getFoundationSupportDepths(position, rotationY)
      : undefined;
    const object = createBuildVisual(type, this.assets, foundationSupportDepths);
    object.position.set(position.x, position.y, position.z);
    object.rotation.y = rotationY;
    object.userData.entityId = id;
    this.scene.add(object);
    this.interactiveObjects.push(object);
    this.entities.set(id, { id, kind: "building", object, available: true, amount: 1, hitPoints: 100, maxHitPoints: 100, cooldown: 0 });
    const state: BuildingState = {
      id,
      type,
      position: { ...position },
      rotationY,
      waterCharges: 0,
      waterProgress: 0,
      fireFuel: type === "campfire" ? 120 : 0,
      cookingProgress: 0,
      ...(type === "fish_trap" ? { fishTrapProgress: 0, fishTrapStored: 0, fishTrapBaited: false } : {}),
      ...(type === "smoking_rack" ? { smokerProgress: 0, smokerInputCount: 0, smokerReadyCount: 0 } : {}),
      ...(foundationSupportDepths ? { foundationSupportDepths } : {}),
      ...(type === "chest" ? { storedItems: [] } : {}),
    };
    this.buildings.set(id, state);
    this.buildingObjects.set(id, object);
    this.addBuildingCollider(type, position, rotationY);
    return state;
  }

  public getBuilding(id: string): BuildingState | null {
    return this.buildings.get(id) ?? null;
  }

  public advanceStoredFoodSpoilage(deltaSeconds: number): number {
    let spoiledCount = 0;
    for (const building of this.buildings.values()) {
      if (building.type !== "chest" || !building.storedItems?.length) continue;
      const inventory = new Inventory(CHEST_STORAGE_SLOTS, building.storedItems);
      spoiledCount += inventory.advanceSpoilage(deltaSeconds);
      building.storedItems = [...inventory.stacks];
    }
    return spoiledCount;
  }

  public findNearestBuilding(type: BuildingState["type"], position: Vec3Like, radius: number): BuildingState | null {
    for (const building of this.buildings.values()) {
      if (building.type === type && distanceSquaredXZ(building.position, position) <= radius * radius) return building;
    }
    return null;
  }

  public findNearestLitCampfire(position: Vec3Like, radius: number): BuildingState | null {
    return [...this.buildings.values()]
      .filter((building) => building.type === "campfire" && building.fireFuel > 0)
      .filter((building) => distanceSquaredXZ(building.position, position) <= radius * radius)
      .sort((left, right) => distanceSquaredXZ(left.position, position) - distanceSquaredXZ(right.position, position))[0] ?? null;
  }

  public createRaftBase(position: Vec3Like, rotationY: number): RaftState | null {
    if (this.raft) return null;
    const id = "raft-main";
    this.physics.createRaft(id, position, rotationY);
    this.raft = {
      id,
      position: { ...position },
      rotation: { x: 0, y: Math.sin(rotationY / 2), z: 0, w: Math.cos(rotationY / 2) },
      hasDeck: false,
      durability: 100,
    };
    this.raftObject.clear();
    this.raftObject.add(createRaftVisual(false));
    this.raftObject.userData.entityId = id;
    this.scene.add(this.raftObject);
    this.interactiveObjects.push(this.raftObject);
    this.entities.set(id, { id, kind: "raft", object: this.raftObject, available: true, amount: 1, hitPoints: 100, maxHitPoints: 100, cooldown: 0 });
    return this.raft;
  }

  public createDeathPack(position: Vec3Like, loot: readonly LootStack[], restoredId?: string): string {
    const id = restoredId ?? `death-pack-${++this.entityCounter}`;
    this.reserveEntityCounter(id);
    const pack = new Group();
    const body = new Mesh(new BoxGeometry(0.72, 0.82, 0.38), new MeshStandardMaterial({ color: 0x5f4932, roughness: 0.95 }));
    body.position.y = 0.44;
    pack.add(body);
    const flap = new Mesh(new BoxGeometry(0.64, 0.3, 0.42), new MeshStandardMaterial({ color: 0x3f3528, roughness: 1 }));
    flap.position.set(0, 0.65, 0.02);
    pack.add(flap);
    pack.position.set(position.x, Math.max(0.25, position.y), position.z);
    pack.userData.entityId = id;
    this.scene.add(pack);
    this.interactiveObjects.push(pack);
    this.entities.set(id, { id, kind: "death_pack", object: pack, available: true, amount: 1, hitPoints: 1, maxHitPoints: 1, cooldown: 0 });
    this.deathPackLoot.set(id, loot.map((entry) => ({ ...entry })));
    return id;
  }

  public dropLoot(position: Vec3Like, loot: readonly LootStack[]): string[] {
    return this.spawnLooseLoot(new Vector3(position.x, Math.max(this.heightAt(position.x, position.z), position.y), position.z), loot);
  }

  public setQuality(profile: WorldQualityProfile): void {
    this.streamingDistanceFactor = STREAMING_DISTANCE_FACTORS[profile];
  }

  public getNearestDeathPack(position: Vec3Like): { distance: number; headingDegrees: number } | null {
    let best: { distance: number; headingDegrees: number } | null = null;
    for (const [id] of this.deathPackLoot) {
      const entity = this.entities.get(id);
      if (!entity?.available) continue;
      const dx = entity.object.position.x - position.x;
      const dz = entity.object.position.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (!best || distance < best.distance) best = { distance, headingDegrees: ((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360 };
    }
    return best;
  }

  public addRaftDeck(): boolean {
    if (!this.raft || this.raft.hasDeck) return false;
    this.raft.hasDeck = true;
    this.physics.addRaftDeck(this.raft.id);
    this.raftObject.clear();
    this.raftObject.add(createRaftVisual(true));
    return true;
  }

  public getRaft(): RaftState | null {
    return this.raft;
  }

  public damageRaft(amount: number): void {
    if (!this.raft) return;
    this.raft.durability = Math.max(0, this.raft.durability - amount);
  }

  public repairRaft(amount: number): void {
    if (!this.raft) return;
    this.raft.durability = Math.min(100, this.raft.durability + amount);
  }

  public getPlacementPosition(camera: Camera, type: BuildableId, rotationY: number): BuildPlacement {
    const origin = new Vector3();
    const direction = new Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    const distance = type.startsWith("raft_") ? 5.5 : type === "fish_trap" ? 4.8 : isHutBuildable(type) ? 4.6 : 3.5;
    const x = origin.x + direction.x * distance;
    const z = origin.z + direction.z * distance;
    const terrainY = this.heightAt(x, z);
    const position = new Vector3(x, type.startsWith("raft_") ? 0.35 : type === "fish_trap" ? SEA_LEVEL + 0.04 : terrainY, z);
    if (type === "raft_base") {
      const valid = terrainY > -1.8 && terrainY < -0.15 && !this.raft;
      return { position, rotationY, valid, reason: valid ? "" : "Floßbasis nur in freiem Flachwasser platzieren." };
    }
    if (type === "raft_deck") {
      const pose = this.raft ? this.physics.getRaftPose(this.raft.id) : null;
      const near = pose ? distanceSquaredXZ(position, pose.position) < 25 : false;
      return { position: pose ? new Vector3(pose.position.x, pose.position.y, pose.position.z) : position, rotationY, valid: Boolean(this.raft && !this.raft.hasDeck && near), reason: "Das Deck muss auf die Floßbasis gebaut werden." };
    }
    if (type === "fish_trap") {
      const lagoon = getIsland("palmenlagune");
      const localX = x - lagoon.positionMeters.x;
      const localZ = z - lagoon.positionMeters.z;
      const lagoonDistance = Math.hypot(
        localX / (lagoon.dimensions.widthMeters * 0.5 * 0.31),
        localZ / (lagoon.dimensions.depthMeters * 0.5 * 0.27),
      );
      const valid = this.getIslandAt(x, z)?.id === lagoon.id
        && lagoonDistance < 0.88
        && terrainY > -1.7
        && terrainY < -0.45
        && !this.overlapsBuilding(position, 2.2);
      return {
        position,
        rotationY,
        valid,
        reason: valid ? "" : "Die Fischreuse kann nur im flachen Innenwasser der Palmenlagune stehen.",
      };
    }
    if (type === "smoking_rack") {
      const slope = Math.max(
        Math.abs(this.heightAt(x + 0.8, z) - terrainY),
        Math.abs(this.heightAt(x, z + 0.8) - terrainY),
      );
      const valid = this.getIslandAt(x, z)?.id === "dschungelbucht"
        && terrainY > 0.15
        && slope < 0.75
        && !this.overlapsBuilding(position, 1.9);
      return {
        position,
        rotationY,
        valid,
        reason: valid ? "" : "Das Räuchergestell kann nur auf ebenem Boden der Dschungelbucht stehen.",
      };
    }
    if (isHutBuildable(type)) return this.getHutPlacement(type, position, rotationY);
    const slope = Math.max(
      Math.abs(this.heightAt(x + 0.8, z) - terrainY),
      Math.abs(this.heightAt(x, z + 0.8) - terrainY),
    );
    const valid = terrainY > 0.15 && slope < 0.75 && !this.overlapsBuilding(position, 1.7);
    void rotationY;
    return { position, rotationY, valid, reason: valid ? "" : "Hier ist der Boden zu steil oder blockiert." };
  }

  public getHutPlacementAt(type: BuildableId, x: number, z: number, rotationY = 0): BuildPlacement {
    const position = new Vector3(x, this.heightAt(x, z), z);
    return isHutBuildable(type)
      ? this.getHutPlacement(type, position, rotationY)
      : { position, rotationY, valid: false, reason: "Dieses Bauteil gehört nicht zum modularen Hüttenbau." };
  }

  public serialize(): WorldSaveState {
    const pose = this.raft ? this.physics.getRaftPose(this.raft.id) : null;
    if (this.raft && pose) {
      this.raft.position = { ...pose.position };
      this.raft.rotation = { ...pose.rotation };
    }
    return {
      removedEntityIds: [...this.removedEntityIds],
      removedEntityDays: Object.fromEntries(this.removedEntityDays),
      buildings: [...this.buildings.values()].map((building) => ({
        ...building,
        position: { ...building.position },
        ...(building.type === "chest"
          ? { storedItems: (building.storedItems ?? []).map((stack) => ({ ...stack })) }
          : {}),
      })),
      raft: this.raft ? { ...this.raft, position: { ...this.raft.position }, rotation: { ...this.raft.rotation } } : null,
      wreckLooted: this.wreckLooted,
      sharkAlive: Boolean(this.shark?.available),
      deathPacks: [...this.deathPackLoot.entries()].flatMap(([id, loot]) => {
        const entity = this.entities.get(id);
        return entity?.available ? [{ id, position: { x: entity.object.position.x, y: entity.object.position.y, z: entity.object.position.z }, loot: loot.map((entry) => ({ ...entry })) }] : [];
      }),
      dynamicDrops: [...this.dynamicDropIds].flatMap((id) => {
        const entity = this.entities.get(id);
        if (!entity?.available) return [];
        return [{
          id,
          itemId: entity.kind as ItemId,
          count: Math.max(1, Math.floor(entity.amount)),
          position: { x: entity.object.position.x, y: entity.object.position.y, z: entity.object.position.z },
        }];
      }),
    };
  }

  public restore(state: WorldSaveState): void {
    for (const id of state.removedEntityIds) {
      const entity = this.entities.get(id);
      if (entity?.kind === "signal_beacon") this.markSignalBeaconActivated(entity);
      else if (entity) this.removeEntity(entity);
      this.removedEntityIds.add(id);
      this.reserveEntityCounter(id);
    }
    this.updateBuriedChestVisual();
    this.removedEntityDays.clear();
    for (const [id, removedDay] of Object.entries(state.removedEntityDays ?? {})) {
      if (Number.isFinite(removedDay)) this.removedEntityDays.set(id, Math.max(1, Math.floor(removedDay)));
    }
    for (const building of state.buildings) {
      const restored = this.createBuilding(building.type, building.position, building.rotationY, building.id);
      Object.assign(restored, building, {
        position: { ...building.position },
        ...(building.type === "chest"
          ? { storedItems: (building.storedItems ?? []).map((stack) => ({ ...stack })) }
          : {}),
      });
      this.updateCampfireCookingVisual(restored);
      this.updateFishTrapVisual(restored);
      this.updateSmokingRackVisual(restored);
    }
    if (state.raft) {
      this.createRaftBase(state.raft.position, 0);
      if (state.raft.hasDeck) this.addRaftDeck();
      if (this.raft) {
        this.raft.durability = state.raft.durability;
        this.physics.setRaftPose(this.raft.id, state.raft.position, state.raft.rotation);
      }
    }
    this.wreckLooted = state.wreckLooted;
    if (!state.sharkAlive && this.shark) this.removeEntity(this.shark);
    for (const pack of state.deathPacks ?? []) this.createDeathPack(pack.position, pack.loot, pack.id);
    for (const drop of state.dynamicDrops ?? []) this.createDynamicDrop(drop);
  }

  private buildTerrain(): void {
    for (const island of WORLD_MANIFEST.islands) this.buildIslandTerrain(island);
  }

  private buildIslandTerrain(island: WorldIslandManifest): void {
    const radiusX = island.dimensions.widthMeters * 0.5;
    const radiusZ = island.dimensions.depthMeters * 0.5;
    const padding = 1.1;
    const metersPerSegment = island.archetype === "palm-lagoon" || island.archetype === "mangrove-bay"
      ? 1.65
      : island.biomes.includes("freshwater")
        ? 2
        : 3.5;
    const segmentsX = Math.max(18, Math.ceil(island.dimensions.widthMeters / metersPerSegment));
    const segmentsZ = Math.max(14, Math.ceil(island.dimensions.depthMeters / metersPerSegment));
    const columns = segmentsX + 1;
    const rows = segmentsZ + 1;
    const vertices = new Float32Array(columns * rows * 3);
    const colors = new Float32Array(columns * rows * 3);
    const indices = new Uint32Array(segmentsX * segmentsZ * 6);
    const color = new Color();
    const minX = island.positionMeters.x - radiusX * padding;
    const minZ = island.positionMeters.z - radiusZ * padding;
    const spanX = radiusX * 2 * padding;
    const spanZ = radiusZ * 2 * padding;

    for (let zIndex = 0; zIndex < rows; zIndex += 1) {
      const z = minZ + (zIndex / segmentsZ) * spanZ;
      for (let xIndex = 0; xIndex < columns; xIndex += 1) {
        const x = minX + (xIndex / segmentsX) * spanX;
        const y = islandHeightAt(x, z, island);
        const offset = (zIndex * columns + xIndex) * 3;
        vertices[offset] = x;
        vertices[offset + 1] = y;
        vertices[offset + 2] = z;
        terrainColor(color, x, z, y, island);
        colors[offset] = color.r;
        colors[offset + 1] = color.g;
        colors[offset + 2] = color.b;
      }
    }
    let indexOffset = 0;
    for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
      for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
        const a = zIndex * columns + xIndex;
        const b = a + 1;
        const c = a + columns;
        const d = c + 1;
        indices[indexOffset++] = a;
        indices[indexOffset++] = c;
        indices[indexOffset++] = b;
        indices[indexOffset++] = b;
        indices[indexOffset++] = c;
        indices[indexOffset++] = d;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    const terrain = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }));
    terrain.name = `Inselterrain: ${island.name}`;
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    this.physics.addTerrain(vertices, indices);
  }

  private buildOceanAndSky(): void {
    const seabed = createSandySeabed(2_900, 1_900, 420, 80);
    this.scene.add(seabed);

    const oceanGeometry = new PlaneGeometry(2_900, 1_900, 240, 156);
    oceanGeometry.rotateX(-Math.PI / 2);
    const ocean = new Mesh(oceanGeometry, this.oceanMaterial);
    ocean.name = "Dynamischer Ozean";
    ocean.position.set(420, SEA_LEVEL, 80);
    ocean.renderOrder = 4;
    this.scene.add(ocean);

    for (const island of WORLD_MANIFEST.islands) {
      const foam = createFoamRing(
        island.positionMeters.x,
        island.positionMeters.z,
        island.dimensions.widthMeters * 0.47,
        island.dimensions.depthMeters * 0.47,
      );
      this.shorelineFoamMaterials.push(foam.material);
      this.scene.add(foam);
    }

    const sky = new Mesh(new SphereGeometry(1_500, 32, 18), this.skyMaterial);
    sky.position.set(0, 0, 0);
    sky.renderOrder = -2;
    this.scene.add(sky);
    this.skyObject = sky;
  }

  private populateWorld(): void {
    const rng = new SeededRandom(WORLD_SEED);
    for (const island of WORLD_MANIFEST.islands) {
      const entityPrefix = island.id === "kleine-sandbank" ? "start" : island.id === "dschungelbucht" ? "jungle" : island.id;
      const radiusX = island.dimensions.widthMeters * 0.5;
      const radiusZ = island.dimensions.depthMeters * 0.5;
      const centerX = island.positionMeters.x;
      const centerZ = island.positionMeters.z;
      const palmCount = resourceCount(island, "palm_tree");
      const palmMin = island.archetype === "palm-lagoon" ? 0.34 : island.isStart ? 0.36 : 0.3;
      this.ringPositions(island, palmCount, palmMin, 0.72, rng)
        .forEach((position, index) => this.spawnPalm(`${entityPrefix}-palm-${index}`, position, index % 3));

      if (island.hasJungle) {
        const treeCount = Math.min(380, Math.max(72, Math.round((island.dimensions.widthMeters * island.dimensions.depthMeters) / 480)));
        const trees: Array<{ position: Vector3; height: number; rotation: number }> = [];
        for (let index = 0; index < treeCount * 2 && trees.length < treeCount; index += 1) {
          const angle = rng.range(0, Math.PI * 2);
          const radius = Math.sqrt(rng.next()) * 0.64;
          const x = centerX + Math.cos(angle) * radius * radiusX;
          const z = centerZ + Math.sin(angle) * radius * radiusZ;
          const y = this.heightAt(x, z);
          if (
            y > 1.2
            && !isInKitLandmarkClearing(island, x - centerX, z - centerZ, 3)
            && !isInFreshwaterFeature(island, x, z, 3.5)
          ) {
            trees.push({ position: new Vector3(x, y, z), height: rng.range(6, island.archetype === "mountain-jungle" ? 13 : 11), rotation: rng.range(0, Math.PI * 2) });
          }
        }
        this.spawnJungleForest(
          `${entityPrefix}-tree`,
          trees,
          new Vector3(centerX, 0, centerZ),
          Math.max(520, Math.max(island.dimensions.widthMeters, island.dimensions.depthMeters) * 1.6),
        );
      }

      if (!island.isStart) this.spawnIslandGroundCover(island, rng);

      const innerFraction = island.archetype === "palm-lagoon" ? 0.34 : 0.18;
      this.spawnLooseResources(`${entityPrefix}-stick`, "stick", resourceCount(island, "loose_stick"), island, innerFraction, 0.72, rng);
      this.spawnLooseResources(`${entityPrefix}-stone`, "stone", resourceCount(island, "loose_stone"), island, innerFraction, 0.72, rng);
      this.spawnLooseResources(`${entityPrefix}-fiber`, "fiber", resourceCount(island, "fiber_plant"), island, innerFraction, 0.7, rng);
      this.spawnLooseResources(`${entityPrefix}-coconut`, "coconut", resourceCount(island, "coconut"), island, Math.max(innerFraction, 0.25), 0.68, rng);
      this.spawnLooseResources(`${entityPrefix}-mango`, "mango", resourceCount(island, "mango_tree"), island, 0.2, 0.58, rng);
      this.spawnCrabs(
        `${entityPrefix}-crab`,
        resourceCount(island, "crab"),
        centerX,
        centerZ,
        radiusX * 0.68,
        radiusX * 0.82,
        radiusZ / radiusX,
        rng,
      );
      const wildlife = ISLAND_WILDLIFE[island.id];
      if (wildlife) this.spawnIslandWildlife(island, wildlife, rng);
      if (island.id === "mangrovenbucht") {
        this.spawnMedicinalHerbs(island, resourceCount(island, "healing_herb"), rng);
      }
    }

    this.spawnIslandWaterFeatures(rng);
    this.spawnWreck();
    this.spawnIslandLandmarks(rng);
    this.spawnFishSchools(rng);
    this.spawnShark();
  }

  private ringPositions(island: WorldIslandManifest, count: number, minFraction: number, maxFraction: number, rng: SeededRandom): Vector3[] {
    const positions: Vector3[] = [];
    if (count <= 0) return positions;
    const radiusX = island.dimensions.widthMeters * 0.5;
    const radiusZ = island.dimensions.depthMeters * 0.5;
    for (let index = 0; index < count; index += 1) {
      let x = island.positionMeters.x;
      let z = island.positionMeters.z;
      let height = 0.5;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = (index / count) * Math.PI * 2 + rng.range(-0.18, 0.18) + attempt * 0.31;
        let fraction = rng.range(minFraction, maxFraction);
        x = island.positionMeters.x + Math.cos(angle) * fraction * radiusX;
        z = island.positionMeters.z + Math.sin(angle) * fraction * radiusZ;
        height = this.heightAt(x, z);
        if (height < 0.45) {
          fraction = Math.max(minFraction, Math.min(maxFraction, 0.58));
          x = island.positionMeters.x + Math.cos(angle) * fraction * radiusX;
          z = island.positionMeters.z + Math.sin(angle) * fraction * radiusZ;
          height = this.heightAt(x, z);
        }
        if (
          !isInKitLandmarkClearing(
            island,
            x - island.positionMeters.x,
            z - island.positionMeters.z,
            2.5,
          )
          && !isInFreshwaterFeature(island, x, z, 2.8)
        ) break;
      }
      positions.push(new Vector3(x, Math.max(0.25, height), z));
    }
    return positions;
  }

  private spawnPalm(id: string, position: Vector3, variant: number): void {
    const modelIds = ["nature.palm-bent", "nature.palm-detailed-short", "nature.palm-detailed-tall"];
    const model = this.assets.createModel(modelIds[variant % modelIds.length] ?? "nature.palm-detailed-tall");
    const object = model ?? createProceduralPalm();
    normalizeHeight(object, 7.5 + variant * 0.7);
    object.position.copy(position);
    object.rotation.y = variant * 1.91;
    object.userData.entityId = id;
    this.scene.add(object);
    this.interactiveObjects.push(object);
    const collider = this.physics.addFixedCylinder({ x: position.x, y: position.y + 2.5, z: position.z }, 2.5, 0.38);
    this.entities.set(id, { id, kind: "palm", object, available: true, amount: 1, hitPoints: 8, maxHitPoints: 8, collider, cooldown: 0 });
  }

  private spawnJungleForest(
    idPrefix: string,
    trees: ReadonlyArray<{ position: Vector3; height: number; rotation: number }>,
    center: Vector3,
    streamingDistance: number,
  ): void {
    if (trees.length === 0) return;
    const near = new Group();
    const far = new Group();
    const trunkMaterial = new MeshStandardMaterial({ color: 0x5b4327, roughness: 1 });
    const foliageMaterial = new MeshStandardMaterial({ color: 0x1c642f, roughness: 0.95, flatShading: true });
    const trunks = new InstancedMesh(new CylinderGeometry(0.28, 0.52, 1, 7), trunkMaterial, trees.length);
    const crowns = new InstancedMesh(new SphereGeometry(1, 7, 5), foliageMaterial, trees.length * 3);
    const silhouettes = createKitInstancedMesh(this.assets, "nature.tree-default", trees.length);
    trunks.name = "Fällbare Dschungelbäume - Stämme";
    crowns.name = "Fällbare Dschungelbäume - Kronen";
    if (silhouettes) silhouettes.name = "Fällbare Dschungelbäume - Kenney-Fernansicht";
    const trunkEntityIds = new Array<string>(trees.length);
    const crownEntityIds = new Array<string>(trees.length * 3);
    const silhouetteEntityIds = new Array<string>(trees.length);

    trees.forEach((tree, index) => {
      const id = `${idPrefix}-${index}`;
      trunkEntityIds[index] = id;
      if (silhouettes) silhouetteEntityIds[index] = id;
      for (let crownIndex = 0; crownIndex < 3; crownIndex += 1) crownEntityIds[index * 3 + crownIndex] = id;
      const instance: InstancedTreeInstance = {
        variant: "jungle",
        index,
        center,
        position: tree.position.clone(),
        height: tree.height,
        rotationY: tree.rotation,
        rootScaleX: 1,
        rootScaleZ: 1,
        roots: null,
        trunks,
        crowns,
        silhouettes,
      };
      this.updateInstancedTreeMatrices(instance, null);
      const marker = new Object3D();
      marker.position.copy(tree.position);
      marker.rotation.y = tree.rotation;
      marker.userData.entityId = id;
      const collider = this.physics.addFixedCylinder({ x: tree.position.x, y: tree.position.y + 2.3, z: tree.position.z }, 2.3, 0.45);
      this.entities.set(id, {
        id,
        kind: "tree",
        object: marker,
        available: true,
        amount: 1,
        hitPoints: 8,
        maxHitPoints: 8,
        collider,
        cooldown: 0,
        instancedTree: instance,
      });
    });

    trunks.userData.entityIds = trunkEntityIds;
    crowns.userData.entityIds = crownEntityIds;
    if (silhouettes) silhouettes.userData.entityIds = silhouetteEntityIds;

    trunks.castShadow = true;
    crowns.castShadow = true;
    trunks.receiveShadow = true;
    crowns.receiveShadow = false;
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (silhouettes) silhouettes.instanceMatrix.needsUpdate = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    if (silhouettes) silhouettes.computeBoundingSphere();
    near.add(trunks, crowns);
    if (silhouettes) far.add(silhouettes);
    const forest = new LOD();
    forest.position.copy(center);
    forest.addLevel(near, 0);
    if (silhouettes) forest.addLevel(far, 140);
    this.scene.add(forest);
    this.interactiveObjects.push(trunks, crowns);
    this.streamedScenery.push({ object: forest, center: center.clone(), distance: streamingDistance });
  }

  private spawnIslandGroundCover(island: WorldIslandManifest, rng: SeededRandom): void {
    if (island.archetype === "rock-reef" || island.archetype === "volcanic") {
      this.spawnKitRockField(island, rng);
      return;
    }
    const area = island.dimensions.widthMeters * island.dimensions.depthMeters;
    const totalCount = Math.min(520, Math.max(80, Math.round(area / 320)));
    const definitions = [
      { assetId: "nature.grass", minHeight: 0.38, maxHeight: 0.72, widthFactor: 0.9, castsShadow: false },
      { assetId: "nature.grass-leafs", minHeight: 0.45, maxHeight: 0.88, widthFactor: 0.98, castsShadow: false },
      { assetId: "nature.plant-flat-short", minHeight: 0.54, maxHeight: 1.02, widthFactor: 0.92, castsShadow: true },
      { assetId: "nature.bush-large", minHeight: 0.72, maxHeight: 1.38, widthFactor: 1.12, castsShadow: true },
      ...(island.archetype === "flower-meadow" ? [
        { assetId: "nature.flower-red", minHeight: 0.42, maxHeight: 0.72, widthFactor: 0.9, castsShadow: false },
        { assetId: "nature.flower-yellow", minHeight: 0.42, maxHeight: 0.72, widthFactor: 0.9, castsShadow: false },
      ] : []),
    ] as const;
    const variants: Array<{
      mesh: InstancedMesh;
      minHeight: number;
      maxHeight: number;
      widthFactor: number;
      count: number;
    }> = [];
    for (const definition of definitions) {
      const mesh = createKitInstancedMesh(this.assets, definition.assetId, totalCount);
      if (!mesh) continue;
      mesh.name = `Kit-Bodendecker: ${definition.assetId}`;
      mesh.castShadow = definition.castsShadow;
      mesh.receiveShadow = true;
      variants.push({
        mesh,
        minHeight: definition.minHeight,
        maxHeight: definition.maxHeight,
        widthFactor: definition.widthFactor,
        count: 0,
      });
    }
    if (variants.length === 0) return;

    const group = new Group();
    group.name = `Bodendeckung: ${island.name}`;
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const radiusX = island.dimensions.widthMeters * 0.5;
    const radiusZ = island.dimensions.depthMeters * 0.5;
    const minFraction = island.archetype === "palm-lagoon" ? 0.31 : 0.16;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const yAxis = new Vector3(0, 1, 0);
    const local = new Vector3();
    const scale = new Vector3();
    let placedCount = 0;

    for (let attempt = 0; attempt < totalCount * 8 && placedCount < totalCount; attempt += 1) {
      const angle = rng.range(0, Math.PI * 2);
      const fraction = Math.sqrt(rng.range(minFraction * minFraction, 0.75 * 0.75));
      const localX = Math.cos(angle) * fraction * radiusX;
      const localZ = Math.sin(angle) * fraction * radiusZ;
      const x = island.positionMeters.x + localX;
      const z = island.positionMeters.z + localZ;
      const ground = this.heightAt(x, z);
      const landingDistance = Math.hypot(
        localX - island.safeLanding.offsetMeters.x,
        localZ - island.safeLanding.offsetMeters.z,
      );
      if (
        ground < 0.42
        || landingDistance < 14
        || isInKitLandmarkClearing(island, localX, localZ, 2)
        || isInFreshwaterFeature(island, x, z, 2.5)
      ) continue;

      quaternion.setFromAxisAngle(yAxis, rng.range(0, Math.PI * 2));
      const variant = variants[placedCount % variants.length]!;
      const height = rng.range(variant.minHeight, variant.maxHeight);
      local.set(localX, ground, localZ);
      scale.set(
        height * variant.widthFactor * rng.range(0.86, 1.14),
        height,
        height * variant.widthFactor * rng.range(0.86, 1.14),
      );
      variant.mesh.setMatrixAt(variant.count, matrix.compose(local, quaternion, scale));
      variant.count += 1;
      placedCount += 1;
    }

    for (const variant of variants) {
      variant.mesh.count = variant.count;
      variant.mesh.instanceMatrix.needsUpdate = true;
      variant.mesh.computeBoundingSphere();
      group.add(variant.mesh);
    }
    this.scene.add(group);
    this.streamedScenery.push({
      object: group,
      center: group.position.clone(),
      distance: Math.max(420, Math.max(island.dimensions.widthMeters, island.dimensions.depthMeters) * 1.7),
    });
  }

  private spawnKitRockField(island: WorldIslandManifest, rng: SeededRandom): void {
    const rockIds = [
      "nature.rock-small",
      "nature.rock-small-b",
      "nature.rock-small-flat",
      "nature.rock-large",
      "nature.rock-large-b",
      "nature.rock-large-c",
      "nature.rock-tall-c",
      "nature.rock-tall-f",
    ] as const;
    const area = island.dimensions.widthMeters * island.dimensions.depthMeters;
    const targetCount = Math.min(118, Math.max(72, Math.round(area / 720)));
    const group = new Group();
    group.name = `Kit-Felsfeld: ${island.name}`;
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const radiusX = island.dimensions.widthMeters * 0.5;
    const radiusZ = island.dimensions.depthMeters * 0.5;
    const accepted: Array<{ x: number; z: number; spacing: number }> = [];

    for (let attempt = 0; attempt < targetCount * 18 && accepted.length < targetCount; attempt += 1) {
      const angle = rng.range(0, Math.PI * 2);
      const fraction = Math.sqrt(rng.range(0.17 ** 2, 0.78 ** 2));
      const localX = Math.cos(angle) * fraction * radiusX;
      const localZ = Math.sin(angle) * fraction * radiusZ;
      const worldX = island.positionMeters.x + localX;
      const worldZ = island.positionMeters.z + localZ;
      const ground = this.heightAt(worldX, worldZ);
      const landingDistance = Math.hypot(
        localX - island.safeLanding.offsetMeters.x,
        localZ - island.safeLanding.offsetMeters.z,
      );
      const assetId = rockIds[accepted.length % rockIds.length]!;
      const isTall = assetId.includes("tall");
      const isLarge = assetId.includes("large");
      const height = isTall
        ? rng.range(2.6, 5.2)
        : isLarge
          ? rng.range(1.35, 3.25)
          : rng.range(0.48, 1.2);
      const spacing = Math.max(2.8, height * 0.72);
      if (
        ground < 0.42
        || landingDistance < 15
        || isInKitLandmarkClearing(island, localX, localZ, 2.5)
        || accepted.some((other) => Math.hypot(other.x - localX, other.z - localZ) < Math.max(spacing, other.spacing))
      ) continue;

      const model = this.assets.createModel(assetId);
      if (!model) continue;
      normalizeHeight(model, height);
      const anchor = new Group();
      anchor.name = `Kit-Fels: ${assetId}`;
      anchor.position.set(localX, ground, localZ);
      anchor.rotation.y = rng.range(0, Math.PI * 2);
      anchor.scale.set(rng.range(0.86, 1.18), 1, rng.range(0.86, 1.18));
      anchor.add(model);
      group.add(anchor);
      accepted.push({ x: localX, z: localZ, spacing });

      if (height >= 2.2 && accepted.length % 3 === 0) {
        this.physics.addFixedCylinder(
          { x: worldX, y: ground + height * 0.46, z: worldZ },
          height * 0.46,
          clamp(height * 0.24, 0.45, 1.35),
        );
      }
    }

    if (group.children.length === 0) return;
    this.scene.add(group);
    this.streamedScenery.push({
      object: group,
      center: group.position.clone(),
      distance: Math.max(540, Math.max(island.dimensions.widthMeters, island.dimensions.depthMeters) * 1.8),
    });
  }

  private spawnLooseResources(
    prefix: string,
    kind: ItemId,
    count: number,
    island: WorldIslandManifest,
    minFraction: number,
    maxFraction: number,
    rng: SeededRandom,
  ): void {
    if (count <= 0) return;
    const radiusX = island.dimensions.widthMeters * 0.5;
    const radiusZ = island.dimensions.depthMeters * 0.5;
    for (let index = 0; index < count; index += 1) {
      let x = island.positionMeters.x;
      let z = island.positionMeters.z;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = (index / count) * Math.PI * 2 + rng.range(-0.14, 0.14) + attempt * 0.27;
        const radius = rng.range(minFraction, maxFraction);
        x = island.positionMeters.x + Math.cos(angle) * radius * radiusX;
        z = island.positionMeters.z + Math.sin(angle) * radius * radiusZ;
        if (
          !isInKitLandmarkClearing(
            island,
            x - island.positionMeters.x,
            z - island.positionMeters.z,
            1.5,
          )
          && !isInFreshwaterFeature(island, x, z, 1.8)
        ) break;
      }
      const position = new Vector3(x, this.heightAt(x, z) + 0.14, z);
      const id = `${prefix}-${index}`;
      const object = createResourceVisual(kind, this.assets);
      object.position.copy(position);
      object.rotation.y = rng.range(0, Math.PI * 2);
      object.userData.entityId = id;
      this.scene.add(object);
      this.interactiveObjects.push(object);
      this.entities.set(id, { id, kind, object, available: true, amount: 1, hitPoints: 1, maxHitPoints: 1, cooldown: 0 });
    }
  }

  private spawnMedicinalHerbs(island: WorldIslandManifest, count: number, rng: SeededRandom): void {
    if (count <= 0) return;
    const crocodiles = [...this.entities.values()].filter((entity) =>
      entity.kind === "crocodile" && entity.home && this.getIslandAt(entity.home.x, entity.home.z)?.id === island.id,
    );
    const radiusX = island.dimensions.widthMeters * 0.5;
    const radiusZ = island.dimensions.depthMeters * 0.5;
    const accepted: Vector3[] = [];

    for (let index = 0; index < count; index += 1) {
      const guardian = crocodiles[index % Math.max(1, crocodiles.length)];
      const guardianHome = guardian?.home;
      let position: Vector3 | null = null;
      for (let attempt = 0; attempt < 28; attempt += 1) {
        const angle = index * 2.17 + attempt * 0.83 + rng.range(-0.22, 0.22);
        const distance = rng.range(5.2, 9.2);
        const fallbackX = island.positionMeters.x + Math.cos(angle) * radiusX * rng.range(0.24, 0.64);
        const fallbackZ = island.positionMeters.z + Math.sin(angle) * radiusZ * rng.range(0.24, 0.64);
        const x = (guardianHome?.x ?? fallbackX) + Math.cos(angle) * distance;
        const z = (guardianHome?.z ?? fallbackZ) + Math.sin(angle) * distance;
        const localX = x - island.positionMeters.x;
        const localZ = z - island.positionMeters.z;
        const ground = this.heightAt(x, z);
        const landingDistance = Math.hypot(
          localX - island.safeLanding.offsetMeters.x,
          localZ - island.safeLanding.offsetMeters.z,
        );
        if (
          Math.hypot(localX / radiusX, localZ / radiusZ) > 0.78
          || ground < 0.18
          || ground > 3.8
          || landingDistance < 17
          || accepted.some((other) => distanceSquaredXZ(other, { x, y: ground, z }) < 2.6 ** 2)
        ) continue;
        position = new Vector3(x, ground + 0.04, z);
        break;
      }
      if (!position) continue;
      accepted.push(position);
      const id = `${island.id}-healing-herb-${index}`;
      const object = createResourceVisual("healing_herb", this.assets);
      object.name = "Sammelbar: Mangroven-Heilkraut";
      object.position.copy(position);
      object.rotation.y = rng.range(0, Math.PI * 2);
      object.userData.entityId = id;
      this.scene.add(object);
      this.interactiveObjects.push(object);
      this.entities.set(id, {
        id,
        kind: "healing_herb",
        object,
        available: true,
        amount: 1,
        hitPoints: 1,
        maxHitPoints: 1,
        cooldown: 0,
      });
    }
  }

  private spawnCrabs(prefix: string, count: number, centerX: number, centerZ: number, minRadius: number, maxRadius: number, zScale: number, rng: SeededRandom): void {
    if (count <= 0) return;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const radius = rng.range(minRadius, maxRadius);
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius * zScale;
      const object = createCrabVisual();
      object.position.set(x, this.heightAt(x, z) + 0.18, z);
      const id = `${prefix}-${index}`;
      object.userData.entityId = id;
      this.scene.add(object);
      this.interactiveObjects.push(object);
      this.entities.set(id, { id, kind: "crab", object, available: true, amount: 1, hitPoints: 12, maxHitPoints: 12, cooldown: rng.range(0, 2), home: object.position.clone() });
    }
  }

  private spawnIslandWildlife(
    island: WorldIslandManifest,
    counts: Readonly<IslandWildlifeCounts>,
    rng: SeededRandom,
  ): void {
    const accepted: Vector3[] = [];
    const radiusX = island.dimensions.widthMeters * 0.5;
    const radiusZ = island.dimensions.depthMeters * 0.5;
    const spawnSpecies = (kind: WildlifeKind, count: number, minimumDistance: number, speciesRng = rng): void => {
      const spawned: WorldEntity[] = [];
      for (let index = 0; index < count; index += 1) {
        let position: Vector3 | null = null;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const angle = speciesRng.range(0, Math.PI * 2);
          const minimumFraction = kind === "turtle" ? 0.62 : kind === "crocodile" ? 0.28 : 0.2;
          const maximumFraction = kind === "turtle" ? 0.91 : kind === "crocodile" ? 0.76 : 0.72;
          const fraction = Math.sqrt(speciesRng.range(minimumFraction ** 2, maximumFraction ** 2));
          const localX = Math.cos(angle) * fraction * radiusX;
          const localZ = Math.sin(angle) * fraction * radiusZ;
          const x = island.positionMeters.x + localX;
          const z = island.positionMeters.z + localZ;
          const ground = this.heightAt(x, z);
          const landingDistance = Math.hypot(
            localX - island.safeLanding.offsetMeters.x,
            localZ - island.safeLanding.offsetMeters.z,
          );
          if (
            (kind === "turtle" ? ground < 0.08 || ground > 2.4 : kind === "crocodile" ? ground < -0.35 || ground > 3.2 : ground < 0.5)
          || landingDistance < 19
          || isInKitLandmarkClearing(island, localX, localZ, 4)
          || (kind !== "crocodile" && isInFreshwaterFeature(island, x, z, 3))
          || accepted.some((other) => distanceSquaredXZ(other, { x, y: ground, z }) < minimumDistance ** 2)
          ) continue;
          position = new Vector3(x, ground + (kind === "bird" ? 3.8 : kind === "turtle" || kind === "crocodile" ? 0.1 : 0.03), z);
          break;
        }
        if (!position) continue;
        accepted.push(position.clone());
        const id = `${island.id}-${kind}-${index}`;
        const object = createWildlifeVisual(kind, this.assets);
        object.position.copy(position);
        object.rotation.y = speciesRng.range(0, Math.PI * 2);
        object.userData.entityId = id;
        this.scene.add(object);
        this.interactiveObjects.push(object);
        const waterTarget = this.findWildlifeWaterTarget(kind, island, position);
        const perch = kind === "bird" ? this.findWildlifePerch(position) : null;
        const cooldown = speciesRng.range(0, 2);
        const wildlifePhase = speciesRng.range(0, Math.PI * 2);
        const entity: WorldEntity = {
          id,
          kind,
          object,
          available: true,
          amount: 1,
          hitPoints: wildlifeHitPoints(kind),
          maxHitPoints: wildlifeHitPoints(kind),
          cooldown,
          home: position.clone(),
          wildlifePhase,
          wildlifeState: "wandering",
          wildlifeLastTrackPosition: position.clone(),
          wildlifeTrackCooldown: 0.6 + wildlifePhase / (Math.PI * 2) * 1.8,
        };
        if (waterTarget) entity.wildlifeWaterTarget = waterTarget;
        if (perch) entity.wildlifePerch = perch;
        this.setupEntityAnimations(entity);
        this.entities.set(id, entity);
        spawned.push(entity);
      }

      const groupSize = kind === "wild_boar" || kind === "chicken" || kind === "turtle" || kind === "bird" ? 3 : 1;
      const remaining = [...spawned];
      for (let groupIndex = 0; remaining.length > 0; groupIndex += 1) {
        const leader = remaining.shift()!;
        const members = [leader];
        while (members.length < groupSize && remaining.length > 0) {
          let nearestIndex = 0;
          for (let candidateIndex = 1; candidateIndex < remaining.length; candidateIndex += 1) {
            if (distanceSquaredXZ(remaining[candidateIndex]!.object.position, leader.object.position)
              < distanceSquaredXZ(remaining[nearestIndex]!.object.position, leader.object.position)) nearestIndex = candidateIndex;
          }
          members.push(remaining.splice(nearestIndex, 1)[0]!);
        }
        const groupId = `${island.id}-${kind}-group-${groupIndex}`;
        for (const member of members) member.wildlifeGroupId = groupId;
      }
    };
    spawnSpecies("wild_boar", counts.wildBoars, 8);
    spawnSpecies("chicken", counts.chickens, 5.5);
    spawnSpecies("turtle", counts.turtles, 6.5);
    spawnSpecies("bird", counts.birds, 7);
    spawnSpecies("crocodile", counts.crocodiles, 11);
    spawnSpecies("snake", counts.snakes, 5.5, new SeededRandom(ISLAND_TERRAIN_SEEDS[island.id] + 1_427));
  }

  private findWildlifeWaterTarget(kind: WildlifeKind, island: WorldIslandManifest, home: Vector3): Vector3 | null {
    if (kind === "bird" || kind === "snake" || kind === "turtle" || kind === "crocodile") return null;
    const basins = FRESHWATER_BASINS
      .filter(({ islandId }) => islandId === island.id)
      .map((definition) => resolveFreshwaterBasin(definition, island));
    const nearest = basins.sort((left, right) => {
      const leftPosition = { x: island.positionMeters.x + left.x, y: 0, z: island.positionMeters.z + left.z };
      const rightPosition = { x: island.positionMeters.x + right.x, y: 0, z: island.positionMeters.z + right.z };
      return distanceSquaredXZ(leftPosition, home) - distanceSquaredXZ(rightPosition, home);
    })[0];
    if (!nearest) return null;
    const centerX = island.positionMeters.x + nearest.x;
    const centerZ = island.positionMeters.z + nearest.z;
    const outward = new Vector3(home.x - centerX, 0, home.z - centerZ);
    if (outward.lengthSq() < 0.01) outward.set(1, 0, 0);
    outward.normalize();
    const x = centerX + outward.x * nearest.radiusX * 1.08;
    const z = centerZ + outward.z * nearest.radiusZ * 1.08;
    return new Vector3(x, this.heightAt(x, z), z);
  }

  private findWildlifePerch(position: Vector3): Vector3 | null {
    let nearest: { position: Vector3; distanceSquared: number } | null = null;
    for (const entity of this.entities.values()) {
      if ((entity.kind !== "tree" && entity.kind !== "palm") || !entity.available) continue;
      const distanceSquared = distanceSquaredXZ(entity.object.position, position);
      if (distanceSquared > 28 ** 2 || nearest && distanceSquared >= nearest.distanceSquared) continue;
      const height = entity.instancedTree?.height ?? 6.5;
      nearest = {
        position: new Vector3(entity.object.position.x, entity.object.position.y + height * 0.68, entity.object.position.z),
        distanceSquared,
      };
    }
    return nearest?.position ?? null;
  }

  private spawnIslandWaterFeatures(rng: SeededRandom): void {
    this.spawnTidalLagoonWater(getIsland("palmenlagune"));
    this.spawnMangroveWaterways(getIsland("mangrovenbucht"));
    for (const basin of FRESHWATER_BASINS) this.spawnFreshwaterBasin(basin);
    for (const course of WATERCOURSES) this.spawnFreshwaterCourse(course);
    this.spawnWatersideKitDetails(rng);
  }

  private createInlandWaterMaterial(
    deepColor: number,
    shallowColor: number,
    opacity: number,
    waveHeight: number,
  ): ShaderMaterial {
    const material = createInlandWaterMaterial(deepColor, shallowColor, opacity, waveHeight);
    this.inlandWaterMaterials.push(material);
    return material;
  }

  private spawnFreshwaterBasin(definition: FreshwaterBasinDefinition): void {
    const island = getIsland(definition.islandId);
    const basin = resolveFreshwaterBasin(definition, island);
    const shorelineSeed = freshwaterBasinShoreSeed(definition, island);
    const group = new Group();
    group.name = `Gewässer: ${definition.name}`;
    group.position.set(island.positionMeters.x + basin.x, 0, island.positionMeters.z + basin.z);
    group.userData.entityId = definition.id;

    const water = new Mesh(
      createOrganicPondGeometry(basin.radiusX * 0.92, basin.radiusZ * 0.92, shorelineSeed, 80),
      this.createInlandWaterMaterial(0x176d72, 0x65d4c3, 0.79, 0.035),
    );
    water.name = `Wasserfläche: ${definition.name}`;
    water.position.y = basin.surfaceY;
    water.renderOrder = 7;
    group.add(water);

    const shallows = new Mesh(
      createOrganicRingGeometry(
        basin.radiusX * 0.75,
        basin.radiusZ * 0.75,
        basin.radiusX * 0.915,
        basin.radiusZ * 0.915,
        shorelineSeed,
        80,
      ),
      new MeshBasicMaterial({ color: 0xb8ead5, transparent: true, opacity: 0.16, depthWrite: false, side: DoubleSide }),
    );
    shallows.name = `Flachwasser-Saum: ${definition.name}`;
    shallows.position.y = basin.surfaceY + 0.018;
    shallows.renderOrder = 8;
    group.add(shallows);

    this.scene.add(group);
    this.interactiveObjects.push(water);
    this.entities.set(definition.id, {
      id: definition.id,
      kind: "freshwater",
      object: group,
      available: true,
      amount: 1,
      hitPoints: 1,
      maxHitPoints: 1,
      cooldown: 0,
    });
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 480 });
  }

  private spawnFreshwaterCourse(definition: WatercourseDefinition): void {
    const island = getIsland(definition.islandId);
    const resolved = resolveWatercoursePath(definition, island).map((point) => ({
      x: point.x,
      y: point.surfaceY - definition.depth * 0.18,
      z: point.z,
      width: point.width,
    }));
    const group = new Group();
    group.name = `Gewässer: ${definition.name}`;
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const water = new Mesh(
      createWaterRibbonGeometryFromSamples(resolved, 0.8),
      this.createInlandWaterMaterial(0x24767c, 0x54b6b5, 0.76, 0.018),
    );
    water.name = `Wasserlauf: ${definition.name}`;
    water.renderOrder = 7;
    group.add(water);
    this.spawnRiverKitSegments(definition, resolved, group);
    this.scene.add(group);
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 560 });
  }

  private spawnRiverKitSegments(
    definition: WatercourseDefinition,
    resolved: readonly { x: number; y: number; z: number; width: number }[],
    parent: Group,
  ): void {
    if (resolved.length < 2) return;
    const curve = new CatmullRomCurve3(
      resolved.map(({ x, y, z }) => new Vector3(x, y, z)),
      false,
      "centripetal",
      0.5,
    );
    const length = curve.getLength();
    if (length < 1) return;

    const kitCourse = new Group();
    kitCourse.name = `Nature-Kit-Fluss: ${definition.name}`;
    // Short, slightly overlapping pieces keep the straight Kit tile from
    // producing visible wedges where the Catmull-Rom course bends.
    const segmentCount = Math.max(2, Math.ceil(length / 4.8));
    const segmentLength = length / segmentCount * 1.24;
    for (let index = 0; index < segmentCount; index += 1) {
      const t = (index + 0.5) / segmentCount;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const widthPosition = t * (resolved.length - 1);
      const widthIndex = Math.min(resolved.length - 2, Math.floor(widthPosition));
      const widthMix = widthPosition - widthIndex;
      const width = resolved[widthIndex]!.width
        + (resolved[widthIndex + 1]!.width - resolved[widthIndex]!.width) * widthMix;
      if (index % 7 !== 3) continue;
      const modelId = "nature.river-rocks";
      const model = this.assets.createModel(modelId);
      if (!model) continue;

      fitModelToBox(model, Math.max(3.8, width * 2.45), 0.3, Math.max(3.8, segmentLength));
      model.name = `Kit-Flussmodul ${index + 1}: ${definition.name}`;
      model.userData.assetId = modelId;
      model.position.x += point.x;
      model.position.y += point.y + 0.018;
      model.position.z += point.z;
      model.rotation.order = "YXZ";
      model.rotation.y = Math.atan2(tangent.x, tangent.z);
      model.rotation.x = -Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z));
      kitCourse.add(model);
    }
    parent.add(kitCourse);
  }

  private spawnTidalLagoonWater(island: WorldIslandManifest): void {
    const radiusX = island.dimensions.widthMeters * 0.5;
    const radiusZ = island.dimensions.depthMeters * 0.5;
    const group = new Group();
    group.name = "Gewässer: Innere Palmenlagune";
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const lagoon = new Mesh(
      createOrganicPondGeometry(radiusX * 0.305, radiusZ * 0.265, ISLAND_TERRAIN_SEEDS[island.id] + 13),
      this.createInlandWaterMaterial(0x117d8c, 0x63ded2, 0.7, 0.028),
    );
    lagoon.position.y = SEA_LEVEL + 0.045;
    lagoon.renderOrder = 7;
    const channel = new Mesh(
      createWaterRibbonGeometry(palmLagoonChannelPoints(island).map((point) => ({ ...point, y: SEA_LEVEL + 0.048 })), 12),
      this.createInlandWaterMaterial(0x11788a, 0x55d1ca, 0.69, 0.022),
    );
    channel.position.y = 0.006;
    channel.renderOrder = 7;
    const foam = new Mesh(
      createOrganicRingGeometry(radiusX * 0.292, radiusZ * 0.252, radiusX * 0.322, radiusZ * 0.281, ISLAND_TERRAIN_SEEDS[island.id] + 37),
      new MeshBasicMaterial({ color: 0xe7faf0, transparent: true, opacity: 0.27, depthWrite: false, side: DoubleSide }),
    );
    foam.position.y = SEA_LEVEL + 0.095;
    foam.renderOrder = 8;
    group.add(lagoon, channel, foam);
    this.scene.add(group);
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 520 });
  }

  private spawnMangroveWaterways(island: WorldIslandManifest): void {
    const group = new Group();
    group.name = "Gewässer: Mangrovenkanäle";
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    group.userData.entityId = "mangrove-brackwater";
    const material = this.createInlandWaterMaterial(0x356f65, 0x82b489, 0.64, 0.016);
    for (const [index, path] of mangroveChannelPaths(island).entries()) {
      const channel = new Mesh(
        createWaterRibbonGeometry(path.map((point) => ({ ...point, y: SEA_LEVEL + 0.052 })), 10),
        material,
      );
      channel.name = `Brackwasserarm ${index + 1}`;
      channel.renderOrder = 7;
      group.add(channel);
    }
    const lagoon = mangroveEastLagoon(island);
    const lagoonMesh = new Mesh(
      createOrganicPondGeometry(lagoon.radiusX, lagoon.radiusZ, ISLAND_TERRAIN_SEEDS[island.id] + 91),
      material,
    );
    lagoonMesh.name = "Brackwasser: Stille Ostlagune";
    lagoonMesh.position.set(lagoon.x, SEA_LEVEL + 0.052, lagoon.z);
    lagoonMesh.renderOrder = 7;
    group.add(lagoonMesh);
    this.scene.add(group);
    this.interactiveObjects.push(group);
    this.entities.set("mangrove-brackwater", {
      id: "mangrove-brackwater",
      kind: "brackwater",
      object: group,
      available: true,
      amount: 1,
      hitPoints: 1,
      maxHitPoints: 1,
      cooldown: 0,
    });
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 540 });
  }

  private spawnWatersideKitDetails(rng: SeededRandom): void {
    for (const definition of FRESHWATER_BASINS) {
      const island = getIsland(definition.islandId);
      const basin = resolveFreshwaterBasin(definition, island);
      const lilies: KitSceneryPlacement[] = [];
      const lilyCount = definition.id === "wasserfallinsel-pool" ? 4 : definition.id.includes("source-lake") ? 8 : 5;
      for (let index = 0; index < lilyCount; index += 1) {
        const angle = (index / lilyCount) * Math.PI * 2 + rng.range(-0.22, 0.22);
        const fraction = rng.range(0.24, 0.68);
        lilies.push({
          assetId: "nature.lily-large",
          x: basin.x + Math.cos(angle) * basin.radiusX * fraction,
          z: basin.z + Math.sin(angle) * basin.radiusZ * fraction,
          height: rng.range(0.17, 0.25),
          rotationY: rng.range(0, Math.PI * 2),
        });
      }
      this.spawnKitSceneryCluster(`Biotop: ${definition.name}-Seerosen`, island, lilies, 480, basin.surfaceY + 0.025);

      this.spawnKitSceneryCluster(`Biotop: ${definition.name}-Ufer`, island, [
        { assetId: "nature.plant-flat-tall", x: basin.x - basin.radiusX * 1.08, z: basin.z + basin.radiusZ * 0.35, height: 1.15, rotationY: 0.35 },
        { assetId: "nature.plant-flat-tall", x: basin.x + basin.radiusX * 0.88, z: basin.z - basin.radiusZ * 0.62, height: 0.96, rotationY: 1.4 },
        { assetId: "nature.rock-small", x: basin.x + basin.radiusX * 1.02, z: basin.z + basin.radiusZ * 0.3, height: 0.72, rotationY: -0.5 },
        { assetId: "nature.rock-small-flat", x: basin.x - basin.radiusX * 0.72, z: basin.z - basin.radiusZ * 0.94, height: 0.58, rotationY: 0.8 },
        { assetId: "nature.log", x: basin.x + basin.radiusX * 0.18, z: basin.z + basin.radiusZ * 1.08, height: 0.7, rotationY: 1.18 },
      ], 520);
    }

    const mangrove = getIsland("mangrovenbucht");
    const lagoon = mangroveEastLagoon(mangrove);
    const eastLilies: KitSceneryPlacement[] = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const fraction = rng.range(0.18, 0.72);
      eastLilies.push({
        assetId: "nature.lily-large",
        x: lagoon.x + Math.cos(angle) * lagoon.radiusX * fraction,
        z: lagoon.z + Math.sin(angle) * lagoon.radiusZ * fraction,
        height: rng.range(0.17, 0.25),
        rotationY: rng.range(0, Math.PI * 2),
      });
    }
    this.spawnKitSceneryCluster("Biotop: Stille Ostlagune", mangrove, eastLilies, 460, SEA_LEVEL + 0.075);
  }

  private spawnFishSchools(rng: SeededRandom): void {
    for (const island of WORLD_MANIFEST.islands) {
      const schoolCount = island.isStart ? 2 : island.isLarge ? 4 : 3;
      const radiusX = island.dimensions.widthMeters * 0.5;
      const radiusZ = island.dimensions.depthMeters * 0.5;
      for (let schoolIndex = 0; schoolIndex < schoolCount; schoolIndex += 1) {
        let x = island.positionMeters.x;
        let z = island.positionMeters.z;
        let bottom = -8;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const angle = (schoolIndex / schoolCount) * Math.PI * 2 + rng.range(-0.5, 0.5);
          const fraction = rng.range(0.94, 1.18);
          x = island.positionMeters.x + Math.cos(angle) * radiusX * fraction;
          z = island.positionMeters.z + Math.sin(angle) * radiusZ * fraction;
          bottom = this.heightAt(x, z);
          if (bottom < -1.7) break;
        }

        const school = new Group();
        school.name = `Fischschwarm: ${island.name} ${schoolIndex + 1}`;
        const depth = clamp(bottom + rng.range(1.4, 3.1), -5.2, -1.15);
        school.position.set(x, depth, z);
        const fishCount = island.isLarge ? 7 : 5;
        for (let fishIndex = 0; fishIndex < fishCount; fishIndex += 1) {
          const fish = this.assets.createModel("survival.fish") ?? createProceduralFish();
          normalizeHeight(fish, rng.range(0.42, 0.68));
          fish.position.set(
            rng.range(-2.8, 2.8),
            rng.range(-0.55, 0.55),
            rng.range(-2.1, 2.1),
          );
          fish.rotation.y = rng.range(-0.14, 0.14);
          fish.userData.baseY = fish.position.y;
          fish.userData.swimPhase = rng.range(0, Math.PI * 2);
          fish.traverse((object) => {
            object.castShadow = false;
            object.receiveShadow = false;
          });
          school.add(fish);
        }
        this.scene.add(school);
        this.fishSchools.push({
          object: school,
          home: school.position.clone(),
          islandId: island.id,
          orbitRadius: rng.range(4, 9),
          speed: rng.range(0.11, 0.2),
          phase: rng.range(0, Math.PI * 2),
          availableAtSeconds: 0,
        });
      }
    }
    this.spawnPalmLagoonFishSchools(rng);
  }

  private spawnPalmLagoonFishSchools(rng: SeededRandom): void {
    const island = getIsland("palmenlagune");
    const radiusX = island.dimensions.widthMeters * 0.5 * 0.19;
    const radiusZ = island.dimensions.depthMeters * 0.5 * 0.16;
    for (let schoolIndex = 0; schoolIndex < 3; schoolIndex += 1) {
      const angle = (schoolIndex / 3) * Math.PI * 2 + 0.35;
      const school = new Group();
      school.name = `Lagunen-Fischschwarm ${schoolIndex + 1}`;
      school.position.set(
        island.positionMeters.x + Math.cos(angle) * radiusX,
        -0.62,
        island.positionMeters.z + Math.sin(angle) * radiusZ,
      );
      for (let fishIndex = 0; fishIndex < 6; fishIndex += 1) {
        const fish = this.assets.createModel("survival.fish") ?? createProceduralFish();
        normalizeHeight(fish, rng.range(0.44, 0.64));
        fish.position.set(rng.range(-2.1, 2.1), rng.range(-0.28, 0.28), rng.range(-1.6, 1.6));
        fish.rotation.y = rng.range(-0.16, 0.16);
        fish.userData.baseY = fish.position.y;
        fish.userData.swimPhase = rng.range(0, Math.PI * 2);
        fish.traverse((object) => {
          object.castShadow = false;
          object.receiveShadow = false;
        });
        school.add(fish);
      }
      this.scene.add(school);
      this.fishSchools.push({
        object: school,
        home: school.position.clone(),
        islandId: island.id,
        orbitRadius: rng.range(2.2, 4.2),
        speed: rng.range(0.1, 0.17),
        phase: rng.range(0, Math.PI * 2),
        availableAtSeconds: 0,
      });
    }
  }

  private spawnIslandLandmarks(rng: SeededRandom): void {
    this.spawnMangroveGrove(getIsland("mangrovenbucht"), rng);
    this.spawnCoralGarden(getIsland("felsenriff"), rng);
    this.spawnRockSpires(getIsland("felsenriff"), [
      { x: -34, z: -7, height: 18, radius: 5.8 },
      { x: 6, z: 12, height: 14, radius: 4.8 },
      { x: 42, z: -14, height: 10, radius: 4.1 },
    ]);
    this.spawnRockArch(getIsland("felsenriff"));
    this.spawnWaterfall(getIsland("wasserfallinsel"));
    this.spawnRockSpires(getIsland("dschungelberg"), [
      { x: -38, z: 4, height: 22, radius: 9 },
      { x: 8, z: -8, height: 18, radius: 7.5 },
      { x: 48, z: 18, height: 12, radius: 6 },
    ]);
    this.spawnVolcano(getIsland("vulkaninsel"));
    this.spawnVolcanicGameplay(getIsland("vulkaninsel"));
    this.spawnFlowerBands(getIsland("blueteninsel"));
    this.spawnFlowerStoneCircle(getIsland("blueteninsel"));
    this.spawnRemainingIslandGameplay();
    this.spawnTreasureSandbarGameplay();
    this.spawnRockSpires(getIsland("mondklippen"), [
      { x: -47, z: -62, height: 15, radius: 5.5 },
      { x: -50, z: 64, height: 18, radius: 6.2 },
      { x: 48, z: 22, height: 11, radius: 4.5 },
    ]);
    this.spawnNatureKitDetails(rng);
    this.spawnAbandonedKitSites();
    this.spawnStructuralKitLandmarks();
    this.spawnMountainClimbingRoute();
    this.spawnLoreLetters();
  }

  private spawnNatureKitDetails(rng: SeededRandom): void {
    const palettes: Readonly<Record<IslandId, readonly string[]>> = {
      "kleine-sandbank": [
        "nature.grass-large",
        "nature.flower-yellow",
        "nature.bush-detailed",
        "nature.rock-small-flat",
      ],
      dschungelbucht: [
        "nature.bush-detailed",
        "nature.bush-large",
        "nature.grass-leafs",
        "nature.plant-flat-short",
        "nature.plant-flat-tall",
        "nature.mushroom-red-group",
        "nature.mushroom-tan-group",
        "nature.stump-old-tall",
      ],
      palmenlagune: [
        "nature.grass",
        "nature.grass-large",
        "nature.flower-red",
        "nature.flower-yellow",
        "nature.bush-detailed",
        "nature.rock-small-flat",
      ],
      mangrovenbucht: [
        "nature.grass-leafs",
        "nature.bush-large",
        "nature.plant-flat-tall",
        "nature.mushroom-tan-group",
        "nature.stump-old-tall",
        "nature.rock-small-b",
      ],
      felsenriff: [
        "nature.rock-large-b",
        "nature.rock-large-c",
        "nature.rock-small-b",
        "nature.rock-small-flat",
        "nature.rock-tall-c",
        "nature.rock-tall-f",
      ],
      wasserfallinsel: [
        "nature.bush-detailed",
        "nature.bush-large",
        "nature.plant-flat-short",
        "nature.plant-flat-tall",
        "nature.mushroom-red-group",
        "nature.flower-red",
        "nature.stump-old-tall",
      ],
      dschungelberg: [
        "nature.rock-large-c",
        "nature.rock-tall-f",
        "nature.bush-detailed",
        "nature.grass-leafs",
        "nature.plant-flat-short",
        "nature.mushroom-tan-group",
        "nature.stump-old-tall",
      ],
      vulkaninsel: [
        "nature.rock-large-b",
        "nature.rock-large-c",
        "nature.rock-small-b",
        "nature.rock-small-flat",
        "nature.rock-tall-c",
        "nature.rock-tall-f",
      ],
      blueteninsel: [
        "nature.flower-red",
        "nature.flower-yellow",
        "nature.grass-large",
        "nature.grass-leafs",
        "nature.bush-detailed",
        "nature.rock-small-flat",
      ],
      mondklippen: [
        "nature.rock-large-b",
        "nature.rock-large-c",
        "nature.rock-small-flat",
        "nature.grass",
        "nature.grass-leafs",
        "nature.flower-yellow",
      ],
      schatzsandbank: [
        "nature.grass",
        "nature.grass-large",
        "nature.bush-detailed",
        "nature.rock-small-flat",
      ],
    };

    for (const island of WORLD_MANIFEST.islands) {
      const palette = palettes[island.id];
      const count = island.isStart ? 7 : island.archetype === "flower-meadow" ? 64 : island.isLarge ? 24 : 17;
      const placements: KitSceneryPlacement[] = [];
      const radiusX = island.dimensions.widthMeters * 0.5;
      const radiusZ = island.dimensions.depthMeters * 0.5;
      for (let attempt = 0; attempt < count * 7 && placements.length < count; attempt += 1) {
        const angle = rng.range(0, Math.PI * 2);
        const minFraction = island.archetype === "palm-lagoon" ? 0.32 : 0.2;
        const fraction = Math.sqrt(rng.range(minFraction ** 2, 0.7 ** 2));
        const x = Math.cos(angle) * radiusX * fraction;
        const z = Math.sin(angle) * radiusZ * fraction;
        const ground = this.heightAt(island.positionMeters.x + x, island.positionMeters.z + z);
        const landingDistance = Math.hypot(x - island.safeLanding.offsetMeters.x, z - island.safeLanding.offsetMeters.z);
        if (
          ground < 0.35
          || landingDistance < 10
          || isInKitLandmarkClearing(island, x, z, 2)
          || isInFreshwaterFeature(island, island.positionMeters.x + x, island.positionMeters.z + z, 2.2)
          || placements.some((placement) => Math.hypot(placement.x - x, placement.z - z) < 3.8)
        ) continue;
        const assetId = palette[placements.length % palette.length]!;
        placements.push({
          assetId,
          x,
          z,
          height: sceneryModelHeight(assetId) * rng.range(0.82, 1.18),
          rotationY: rng.range(0, Math.PI * 2),
        });
      }
      this.spawnKitSceneryCluster(`Biotop: ${island.name}`, island, placements);
    }

    const mangrove = getIsland("mangrovenbucht");
    const lilies: KitSceneryPlacement[] = [];
    const lilyCount = 22;
    const lilySpan = mangrove.dimensions.widthMeters * 0.34;
    for (let index = 0; index < lilyCount; index += 1) {
      const x = -lilySpan + index * (lilySpan * 2 / (lilyCount - 1));
      const channelZ = Math.sin(x * 0.075) * 6.5;
      lilies.push({
        assetId: "nature.lily-large",
        x,
        z: channelZ + (index % 2 === 0 ? -1.35 : 1.35),
        height: rng.range(0.18, 0.28),
        rotationY: rng.range(0, Math.PI * 2),
      });
    }
    this.spawnKitSceneryCluster("Biotop: Seerosenkanal", mangrove, lilies, 420, SEA_LEVEL + 0.035);
  }

  private spawnAbandonedKitSites(): void {
    this.spawnKitSceneryCluster("Landmarke: Wrackfracht", getIsland("dschungelbucht"), [
      { assetId: "survival.barrel", x: 88, z: -43, height: 1.1, rotationY: 0.8, colliderRadius: 0.44 },
      { assetId: "survival.box-large", x: 93, z: -40, height: 1, rotationY: -0.25, colliderRadius: 0.5 },
      { assetId: "survival.bucket", x: 85, z: -38, height: 0.52, rotationY: 0.4 },
      { assetId: "survival.resource-planks", x: 97, z: -46, height: 0.46, rotationY: 1.4 },
      { assetId: "survival.bottle-large", x: 91, z: -36, height: 0.32, rotationY: -0.7 },
      { assetId: "survival.signpost", x: 78, z: -32, height: 1.9, rotationY: 1.1, colliderRadius: 0.18 },
    ], 480, undefined, true);

    this.spawnKitSceneryCluster("Landmarke: Fischerlager", getIsland("palmenlagune"), [
      { assetId: "survival.tent", x: -50, z: 30, height: 2.3, rotationY: 0.7, colliderRadius: 1.35 },
      { assetId: "survival.campfire-fishing-stand", x: -36, z: 22, height: 1.85, rotationY: -0.8, colliderRadius: 0.72 },
      { assetId: "survival.barrel", x: -63, z: 21, height: 1.05, rotationY: 0.15, colliderRadius: 0.42 },
      { assetId: "survival.resource-wood", x: -43, z: 42, height: 0.62, rotationY: 1.5 },
      { assetId: "survival.fence-fortified", x: -62, z: 39, height: 1.75, rotationY: 0.55, colliderRadius: 0.65 },
      { assetId: "survival.bucket", x: -31, z: 31, height: 0.52, rotationY: -0.5 },
    ], 520, undefined, true);

    this.spawnKitSceneryCluster("Landmarke: Überwucherte Ruinen", getIsland("wasserfallinsel"), [
      { assetId: "nature.statue-column-damaged", x: -45, z: 24, height: 4.4, rotationY: 0.2, colliderRadius: 0.65 },
      { assetId: "nature.statue-head", x: -39, z: 28, height: 1.55, rotationY: -0.7, colliderRadius: 0.55 },
      { assetId: "nature.statue-obelisk", x: -51, z: 31, height: 5.4, rotationY: 0.35, colliderRadius: 0.62 },
      { assetId: "nature.mushroom-red-group", x: -42, z: 32, height: 0.45, rotationY: 1.2 },
      { assetId: "nature.mushroom-tan-group", x: -47, z: 19, height: 0.42, rotationY: 0.4 },
      { assetId: "nature.flower-red", x: -35, z: 24, height: 0.62, rotationY: -0.2 },
      { assetId: "nature.bush-detailed", x: -54, z: 25, height: 1.5, rotationY: 0.9 },
    ], 620, undefined, true);

    this.spawnKitSceneryCluster("Landmarke: Berg-Außenposten", getIsland("dschungelberg"), [
      { assetId: "survival.structure-floor", x: -92, z: 38, height: 0.32, rotationY: 0.35, colliderRadius: 1.6 },
      { assetId: "survival.tent", x: -92, z: 38, height: 2.35, rotationY: 0.35, colliderRadius: 1.25 },
      { assetId: "survival.workbench-anvil", x: -84, z: 41, height: 1.35, rotationY: -0.9, colliderRadius: 0.75 },
      { assetId: "survival.barrel", x: -99, z: 34, height: 1.05, rotationY: 0.4, colliderRadius: 0.42 },
      { assetId: "survival.box-large", x: -87, z: 33, height: 1, rotationY: 0.15, colliderRadius: 0.5 },
      { assetId: "survival.resource-planks", x: -101, z: 41, height: 0.46, rotationY: 1.1 },
      { assetId: "survival.signpost", x: -106, z: 29, height: 1.9, rotationY: 0.8, colliderRadius: 0.18 },
      { assetId: "nature.rock-tall-c", x: -78, z: 35, height: 4.8, rotationY: -0.45, colliderRadius: 1.25 },
    ], 760, undefined, true);
  }

  private spawnMountainClimbingRoute(): void {
    const island = getIsland("dschungelberg");
    const scale = islandLayoutScale(island);
    const resolve = (localX: number, localZ: number): Vector3 => {
      const x = island.positionMeters.x + localX * scale.x;
      const z = island.positionMeters.z + localZ * scale.z;
      return new Vector3(x, this.heightAt(x, z), z);
    };

    const kitPosition = resolve(-78, 45);
    const kit = createResourceVisual("climbing_kit", this.assets);
    kit.name = "Kletterset am Berg-Außenposten";
    kit.position.copy(kitPosition).add(new Vector3(0, 0.22, 0));
    kit.rotation.y = -0.55;
    kit.userData.entityId = "mountain-climbing-kit";
    this.scene.add(kit);
    this.interactiveObjects.push(kit);
    this.entities.set("mountain-climbing-kit", {
      id: "mountain-climbing-kit",
      kind: "climbing_kit",
      object: kit,
      available: true,
      amount: 1,
      hitPoints: 1,
      maxHitPoints: 1,
      cooldown: 0,
    });

    const stages = [
      resolve(-70, 30),
      resolve(-42, 10),
      resolve(-18, -2),
      resolve(0, -4),
    ];
    for (let index = 0; index < stages.length - 1; index += 1) {
      const source = stages[index]!;
      const destination = stages[index + 1]!;
      const anchor = createClimbingAnchorVisual(this.assets, index + 1);
      const id = `mountain-climbing-anchor-${index + 1}`;
      anchor.name = `Seilanker ${index + 1}: Dschungelberg`;
      anchor.position.copy(source);
      anchor.rotation.y = Math.atan2(destination.x - source.x, destination.z - source.z);
      anchor.userData.entityId = id;
      this.scene.add(anchor);
      this.interactiveObjects.push(anchor);
      this.entities.set(id, {
        id,
        kind: "climbing_anchor",
        object: anchor,
        available: true,
        amount: 1,
        hitPoints: 1,
        maxHitPoints: 1,
        cooldown: 0,
        climbDestination: { x: destination.x, y: destination.y + 1.1, z: destination.z },
        climbReachesSummit: index === stages.length - 2,
      });
    }

    const summit = stages.at(-1)!;
    const cacheX = summit.x + 4.2;
    const cacheZ = summit.z + 2.5;
    const cache = this.assets.createModel("survival.box-large") ?? createSummitCacheFallback();
    normalizeHeight(cache, 0.95);
    cache.name = "Gipfelvorrat: Dschungelberg";
    cache.position.set(cacheX, this.heightAt(cacheX, cacheZ) + 0.05, cacheZ);
    cache.rotation.y = 0.45;
    cache.userData.entityId = "mountain-summit-cache";
    this.scene.add(cache);
    this.interactiveObjects.push(cache);
    this.entities.set("mountain-summit-cache", {
      id: "mountain-summit-cache",
      kind: "summit_cache",
      object: cache,
      available: true,
      amount: 1,
      hitPoints: 1,
      maxHitPoints: 1,
      cooldown: 0,
    });
  }

  private spawnLoreLetters(): void {
    for (const letter of LORE_LETTERS) {
      const placement = LORE_LETTER_PLACEMENTS[letter.id];
      this.spawnLoreLetter(
        letter.id,
        getIsland(letter.islandId),
        placement.x,
        placement.z,
        placement.rotationY,
      );
    }
  }

  private spawnLoreLetter(
    id: string,
    island: WorldIslandManifest,
    x: number,
    z: number,
    rotationY: number,
  ): void {
    const layoutScale = islandLayoutScale(island);
    const origin = KIT_LANDMARK_CLEARINGS[island.id]?.[0];
    const localX = origin ? origin.x * layoutScale.x + x - origin.x : x * layoutScale.x;
    const localZ = origin ? origin.z * layoutScale.z + z - origin.z : z * layoutScale.z;
    const worldX = island.positionMeters.x + localX;
    const worldZ = island.positionMeters.z + localZ;
    const object = createLoreLetterVisual();
    object.name = `Brief: ${id}`;
    object.position.set(worldX, this.heightAt(worldX, worldZ) + 0.08, worldZ);
    object.rotation.y = rotationY;
    object.userData.entityId = id;
    this.scene.add(object);
    this.interactiveObjects.push(object);
    this.entities.set(id, {
      id,
      kind: "lore_letter",
      object,
      available: true,
      amount: 1,
      hitPoints: 1,
      maxHitPoints: 1,
      cooldown: 0,
    });
  }

  private spawnStructuralKitLandmarks(): void {
    this.spawnKitSceneryCluster("Landmarke: Steiniger Dschungelpass", getIsland("dschungelbucht"), [
      { assetId: "nature.rock-tall-f", x: -74, z: 56, height: 5.4, rotationY: 0.35, colliderRadius: 1.15 },
      { assetId: "nature.rock-large-c", x: -65, z: 61, height: 2.8, rotationY: -0.7, colliderRadius: 0.8 },
      { assetId: "nature.stump-old-tall", x: -77, z: 68, height: 1.45, rotationY: 0.8, colliderRadius: 0.42 },
      { assetId: "nature.log", x: -62, z: 72, height: 0.82, rotationY: 1.15, colliderRadius: 0.35 },
      { assetId: "survival.signpost", x: -53, z: 55, height: 1.9, rotationY: -0.45, colliderRadius: 0.18 },
    ], 580, undefined, true, { x: -65, z: 62 });

    this.spawnKitSceneryCluster("Landmarke: Mangroven-Stegrest", getIsland("mangrovenbucht"), [
      { assetId: "survival.resource-planks", x: -70, z: -42, height: 0.52, rotationY: 0.18 },
      { assetId: "survival.fence-fortified", x: -61, z: -47, height: 1.8, rotationY: 0.4, colliderRadius: 0.65 },
      { assetId: "nature.log", x: -75, z: -53, height: 0.86, rotationY: 1.22, colliderRadius: 0.36 },
      { assetId: "nature.stump-old-tall", x: -53, z: -37, height: 1.35, rotationY: -0.55, colliderRadius: 0.4 },
      { assetId: "survival.bucket", x: -47, z: -48, height: 0.52, rotationY: 0.7 },
    ], 520, undefined, true, { x: -61, z: -45 });

    this.spawnKitSceneryCluster("Landmarke: Riffpfad", getIsland("felsenriff"), [
      { assetId: "nature.rock-tall-c", x: 67, z: 38, height: 5.8, rotationY: -0.2, colliderRadius: 1.2 },
      { assetId: "nature.rock-large-b", x: 76, z: 43, height: 3.1, rotationY: 0.6, colliderRadius: 0.85 },
      { assetId: "nature.rock-large-c", x: 59, z: 48, height: 2.55, rotationY: -0.85, colliderRadius: 0.72 },
      { assetId: "survival.signpost", x: 51, z: 36, height: 1.9, rotationY: 0.95, colliderRadius: 0.18 },
      { assetId: "survival.resource-planks", x: 82, z: 33, height: 0.48, rotationY: 1.35 },
    ], 620, undefined, true, { x: 67, z: 40 });

    this.spawnKitSceneryCluster("Landmarke: Wasserfall-Felsstufen", getIsland("wasserfallinsel"), [
      { assetId: "nature.rock-large-c", x: 60, z: -52, height: 3.4, rotationY: 0.25, colliderRadius: 0.9 },
      { assetId: "nature.rock-large-b", x: 69, z: -45, height: 2.7, rotationY: -0.6, colliderRadius: 0.75 },
      { assetId: "nature.rock-tall-f", x: 76, z: -55, height: 4.9, rotationY: 0.8, colliderRadius: 1.05 },
      { assetId: "nature.statue-column-damaged", x: 56, z: -63, height: 3.8, rotationY: -0.15, colliderRadius: 0.58 },
      { assetId: "nature.bush-detailed", x: 70, z: -66, height: 1.5, rotationY: 0.5 },
    ], 660, undefined, true, { x: 68, z: -55 });
  }

  private spawnKitSceneryCluster(
    name: string,
    island: WorldIslandManifest,
    placements: readonly KitSceneryPlacement[],
    streamingDistance = 460,
    fixedY?: number,
    scaleOffsets = false,
    layoutOrigin?: { x: number; z: number },
  ): void {
    const group = new Group();
    group.name = name;
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    for (const placement of placements) {
      const model = this.assets.createModel(placement.assetId);
      if (!model) continue;
      normalizeHeight(model, placement.height);
      const anchor = new Group();
      anchor.name = `Kit-Modell: ${placement.assetId}`;
      anchor.add(model);
      const layoutScale = scaleOffsets ? islandLayoutScale(island) : { x: 1, z: 1 };
      const origin = scaleOffsets ? layoutOrigin ?? KIT_LANDMARK_CLEARINGS[island.id]?.[0] : undefined;
      const localX = origin
        ? origin.x * layoutScale.x + placement.x - origin.x
        : placement.x * layoutScale.x;
      const localZ = origin
        ? origin.z * layoutScale.z + placement.z - origin.z
        : placement.z * layoutScale.z;
      const worldX = island.positionMeters.x + localX;
      const worldZ = island.positionMeters.z + localZ;
      const ground = fixedY ?? this.heightAt(worldX, worldZ);
      anchor.position.set(localX, ground, localZ);
      anchor.rotation.y = placement.rotationY ?? 0;
      group.add(anchor);
      if (placement.colliderRadius) {
        this.physics.addFixedCylinder(
          { x: worldX, y: ground + placement.height * 0.5, z: worldZ },
          placement.height * 0.5,
          placement.colliderRadius,
        );
      }
    }
    if (group.children.length === 0) return;
    this.scene.add(group);
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: streamingDistance });
  }

  private spawnMangroveGrove(island: WorldIslandManifest, rng: SeededRandom): void {
    const count = 100;
    const group = new Group();
    group.name = "Landmarke: Wurzelhain";
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const roots = new InstancedMesh(
      new ConeGeometry(0.72, 1.35, 6, 1, true),
      new MeshStandardMaterial({ color: 0x654426, roughness: 1, side: DoubleSide }),
      count,
    );
    const trunks = new InstancedMesh(
      new CylinderGeometry(0.13, 0.25, 1, 6),
      new MeshStandardMaterial({ color: 0x5a3d25, roughness: 1 }),
      count,
    );
    const crowns = new InstancedMesh(
      new SphereGeometry(1, 7, 5),
      new MeshStandardMaterial({ color: 0x315b31, roughness: 0.98, flatShading: true }),
      count,
    );
    roots.name = "Fällbare Mangroven - Wurzeln";
    trunks.name = "Fällbare Mangroven - Stämme";
    crowns.name = "Fällbare Mangroven - Kronen";
    const entityIds = new Array<string>(count);
    for (let index = 0; index < count; index += 1) {
      const id = `mangrove-tree-${index}`;
      entityIds[index] = id;
      const side = index % 2 === 0 ? -1 : 1;
      let localX = 0;
      let localZ = 0;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        localX = rng.range(-island.dimensions.widthMeters * 0.38, island.dimensions.widthMeters * 0.36);
        const channelZ = Math.sin(localX * 0.075) * 7;
        localZ = channelZ + side * rng.range(island.dimensions.depthMeters * 0.07, island.dimensions.depthMeters * 0.19);
        if (!isInKitLandmarkClearing(island, localX, localZ, 3)) break;
      }
      const x = island.positionMeters.x + localX;
      const z = island.positionMeters.z + localZ;
      const ground = Math.max(-0.15, this.heightAt(x, z));
      const height = rng.range(3.4, 5.4);
      const rotationY = rng.range(0, Math.PI * 2);
      const rootScaleX = rng.range(0.75, 1.2);
      const rootScaleZ = rng.range(0.75, 1.2);
      const instance: InstancedTreeInstance = {
        variant: "mangrove",
        index,
        center: group.position,
        position: new Vector3(x, ground, z),
        height,
        rotationY,
        rootScaleX,
        rootScaleZ,
        roots,
        trunks,
        crowns,
        silhouettes: null,
      };
      this.updateInstancedTreeMatrices(instance, null);
      const marker = new Object3D();
      marker.position.set(x, ground, z);
      marker.rotation.y = rotationY;
      marker.userData.entityId = id;
      const collider = index % 4 === 0
        ? this.physics.addFixedCylinder({ x, y: ground + 1.8, z }, 1.8, 0.42)
        : null;
      this.entities.set(id, {
        id,
        kind: "tree",
        object: marker,
        available: true,
        amount: 1,
        hitPoints: 8,
        maxHitPoints: 8,
        cooldown: 0,
        instancedTree: instance,
        ...(collider ? { collider } : {}),
      });
    }
    roots.userData.entityIds = entityIds;
    trunks.userData.entityIds = entityIds;
    crowns.userData.entityIds = entityIds;
    roots.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    roots.computeBoundingSphere();
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    roots.castShadow = true;
    trunks.castShadow = true;
    crowns.castShadow = true;
    group.add(roots, trunks, crowns);
    this.scene.add(group);
    this.interactiveObjects.push(roots, trunks, crowns);
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 520 });
  }

  private spawnRockSpires(
    island: WorldIslandManifest,
    spires: ReadonlyArray<{ x: number; z: number; height: number; radius: number }>,
  ): void {
    const group = new Group();
    group.name = `Landmarke: ${island.name} Felsgrat`;
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const layoutScale = islandLayoutScale(island);
    for (const [spireIndex, spire] of spires.entries()) {
      const localX = spire.x * layoutScale.x;
      const localZ = spire.z * layoutScale.z;
      const cluster = [
        { id: spireIndex % 2 === 0 ? "nature.rock-tall-c" : "nature.rock-tall-f", x: 0, z: 0, height: spire.height * 0.76, radius: spire.radius * 0.47 },
        { id: "nature.rock-large-c", x: -spire.radius * 0.62, z: spire.radius * 0.26, height: spire.height * 0.42, radius: spire.radius * 0.34 },
        { id: "nature.rock-tall-f", x: spire.radius * 0.54, z: -spire.radius * 0.34, height: spire.height * 0.5, radius: spire.radius * 0.31 },
        { id: "nature.rock-large-b", x: spire.radius * 0.48, z: spire.radius * 0.58, height: spire.height * 0.32, radius: spire.radius * 0.27 },
      ] as const;
      for (const [rockIndex, part] of cluster.entries()) {
        const model = this.assets.createModel(part.id);
        if (!model) continue;
        normalizeHeight(model, part.height);
        const partX = localX + part.x;
        const partZ = localZ + part.z;
        const worldX = island.positionMeters.x + partX;
        const worldZ = island.positionMeters.z + partZ;
        const ground = this.heightAt(worldX, worldZ);
        const anchor = new Group();
        anchor.name = `Kit-Felsformation: ${part.id}`;
        anchor.position.set(partX, ground, partZ);
        anchor.rotation.y = spireIndex * 1.27 + rockIndex * 0.83;
        anchor.add(model);
        group.add(anchor);
        this.physics.addFixedCylinder(
          { x: worldX, y: ground + part.height * 0.43, z: worldZ },
          part.height * 0.43,
          Math.max(0.55, part.radius),
        );
      }
    }
    if (group.children.length === 0) return;
    this.scene.add(group);
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 520 });
  }

  private spawnVolcano(island: WorldIslandManifest): void {
    const { localX, localZ, modelHeight } = VOLCANO_LANDMARK;
    const worldX = island.positionMeters.x + localX;
    const worldZ = island.positionMeters.z + localZ;
    const ground = this.heightAt(worldX, worldZ);
    const group = new Group();
    group.name = "Landmarke: Feuerkrater";
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);

    const model = this.assets.createModel("environment.volcano");
    if (model) {
      normalizeHeight(model, modelHeight);
      const anchor = new Group();
      anchor.name = "Poly-Pizza-Modell: Volcano";
      anchor.position.set(localX, ground, localZ);
      anchor.rotation.y = -0.62;
      anchor.add(model);
      group.add(anchor);
    }

    const smokePositions = new Float32Array(24 * 3);
    for (let index = 0; index < 24; index += 1) {
      const t = index / 23;
      const radius = 0.6 + t * 4.5;
      smokePositions[index * 3] = localX + Math.sin(index * 2.17) * radius;
      smokePositions[index * 3 + 1] = ground + modelHeight * 0.88 + t * 23;
      smokePositions[index * 3 + 2] = localZ + Math.cos(index * 1.73) * radius;
    }
    const smokeGeometry = new BufferGeometry();
    smokeGeometry.setAttribute("position", new BufferAttribute(smokePositions, 3));
    const smoke = new Points(
      smokeGeometry,
      new PointsMaterial({ color: 0x77736f, size: 3.6, transparent: true, opacity: 0.34, depthWrite: false }),
    );
    smoke.name = "Vulkanrauch";
    group.add(smoke);

    const glow = new PointLight(0xff5a16, 5.5, 85, 1.8);
    glow.name = "Kraterglut";
    glow.position.set(localX - 7, ground + modelHeight * 0.76, localZ + 3);
    group.add(glow);

    this.scene.add(group);
    this.physics.addFixedCylinder(
      { x: worldX, y: ground + 18, z: worldZ },
      18,
      18,
    );
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 720 });
  }

  private spawnVolcanicGameplay(island: WorldIslandManifest): void {
    const lava = new Group();
    lava.name = "Landmarke: Glutpfad";
    lava.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const lavaMaterial = new MeshStandardMaterial({
      color: 0xff4c12,
      emissive: 0xff2600,
      emissiveIntensity: 2.6,
      roughness: 0.38,
    });
    for (const path of VOLCANIC_LAVA_PATHS) {
      for (let index = 0; index < path.length - 1; index += 1) {
        const start = path[index]!;
        const end = path[index + 1]!;
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const length = Math.hypot(dx, dz);
        const localX = (start.x + end.x) * 0.5;
        const localZ = (start.z + end.z) * 0.5;
        const worldX = island.positionMeters.x + localX;
        const worldZ = island.positionMeters.z + localZ;
        const ribbon = new Mesh(new BoxGeometry(3.2, 0.12, length + 1), lavaMaterial);
        ribbon.name = "Glühende Lavarinne";
        ribbon.position.set(localX, this.heightAt(worldX, worldZ) + 0.09, localZ);
        ribbon.rotation.y = Math.atan2(dx, dz);
        lava.add(ribbon);
      }
    }
    for (const marker of [VOLCANIC_LAVA_PATHS[0]![2]!, VOLCANIC_LAVA_PATHS[1]![2]!, VOLCANIC_LAVA_PATHS[2]![2]!]) {
      const light = new PointLight(0xff4a16, 2.8, 32, 1.8);
      light.position.set(
        marker.x,
        this.heightAt(island.positionMeters.x + marker.x, island.positionMeters.z + marker.z) + 1.2,
        marker.z,
      );
      lava.add(light);
    }
    this.scene.add(lava);
    this.streamedScenery.push({ object: lava, center: lava.position.clone(), distance: 600 });

    const deposits = [
      { x: -72, z: -22 }, { x: -59, z: -39 }, { x: -48, z: 28 }, { x: -31, z: 43 }, { x: -24, z: -16 },
      { x: 44, z: 30 }, { x: 59, z: 10 }, { x: 39, z: -36 }, { x: 16, z: -51 }, { x: -9, z: -45 },
    ];
    const count = Math.min(resourceCount(island, "obsidian_field"), deposits.length);
    for (let index = 0; index < count; index += 1) {
      const local = deposits[index]!;
      const x = island.positionMeters.x + local.x;
      const z = island.positionMeters.z + local.z;
      const object = createResourceVisual("obsidian_shard", this.assets);
      const id = `volcano-obsidian-${index}`;
      object.name = "Sammelbar: Obsidianvorkommen";
      object.position.set(x, this.heightAt(x, z) + 0.06, z);
      object.rotation.y = index * 1.73;
      object.userData.entityId = id;
      this.scene.add(object);
      this.interactiveObjects.push(object);
      this.entities.set(id, {
        id,
        kind: "obsidian_shard",
        object,
        available: true,
        amount: 1,
        hitPoints: 1,
        maxHitPoints: 1,
        cooldown: 0,
      });
    }

    const cacheX = island.positionMeters.x - 23;
    const cacheZ = island.positionMeters.z - 9;
    const cache = this.assets.createModel("survival.box-large") ?? createSummitCacheFallback();
    normalizeHeight(cache, 0.95);
    cache.name = "Geologenkiste am Feuerkrater";
    cache.position.set(cacheX, this.heightAt(cacheX, cacheZ) + 0.05, cacheZ);
    cache.rotation.y = -0.5;
    cache.userData.entityId = "volcano-crater-cache";
    this.scene.add(cache);
    this.interactiveObjects.push(cache);
    this.entities.set("volcano-crater-cache", {
      id: "volcano-crater-cache",
      kind: "crater_cache",
      object: cache,
      available: true,
      amount: 1,
      hitPoints: 1,
      maxHitPoints: 1,
      cooldown: 0,
    });
  }

  private spawnFlowerStoneCircle(island: WorldIslandManifest): void {
    const placements: KitSceneryPlacement[] = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = index / 10 * Math.PI * 2;
      placements.push({
        assetId: index % 2 === 0 ? "nature.rock-small-flat" : "nature.rock-small-b",
        x: Math.cos(angle) * 10,
        z: 8 + Math.sin(angle) * 8,
        height: index % 2 === 0 ? 1.2 : 0.9,
        rotationY: angle + Math.PI * 0.5,
        colliderRadius: 0.45,
      });
    }
    placements.push({
      assetId: "nature.statue-column-damaged",
      x: 0,
      z: 8,
      height: 3.8,
      rotationY: 0.35,
      colliderRadius: 0.6,
    });
    this.spawnKitSceneryCluster("Landmarke: Alter Steinkreis", island, placements, 520);
  }

  private spawnFlowerBands(island: WorldIslandManifest): void {
    const placements: KitSceneryPlacement[] = [];
    for (let index = 0; index < 84; index += 1) {
      const progress = index / 83;
      const x = -96 + progress * 192;
      const band = index % 2 === 0 ? -1 : 1;
      placements.push({
        assetId: index % 3 === 0 ? "nature.flower-red" : "nature.flower-yellow",
        x,
        z: Math.sin(progress * Math.PI * 3.2) * 18 + band * 10,
        height: 0.82 + (index % 5) * 0.075,
        rotationY: index * 1.37,
      });
    }
    this.spawnKitSceneryCluster("Landmarke: Blütenmeer", island, placements, 560);
  }

  private spawnRemainingIslandGameplay(): void {
    const reef = getIsland("felsenriff");
    const reefDeposits = [
      { x: 108, z: -36 }, { x: 118, z: -24 }, { x: 124, z: -10 }, { x: 126, z: 5 },
      { x: 122, z: 20 }, { x: 114, z: 34 }, { x: 104, z: 44 }, { x: 98, z: -46 },
    ];
    const reefCount = Math.min(resourceCount(reef, "reef_stone_bed"), reefDeposits.length);
    for (let index = 0; index < reefCount; index += 1) {
      const local = reefDeposits[index]!;
      const x = reef.positionMeters.x + local.x;
      const z = reef.positionMeters.z + local.z;
      const object = createResourceVisual("reef_stone", this.assets);
      const id = `reef-stone-${index}`;
      object.name = "Sammelbar: Riffkieselbank";
      object.position.set(x, this.heightAt(x, z) + 0.08, z);
      object.rotation.y = index * 1.31;
      object.userData.entityId = id;
      this.scene.add(object);
      this.interactiveObjects.push(object);
      this.entities.set(id, { id, kind: "reef_stone", object, available: true, amount: 1, hitPoints: 1, maxHitPoints: 1, cooldown: 0 });
    }

    const waterfall = getIsland("wasserfallinsel");
    const waterfallX = waterfall.positionMeters.x + waterfall.dimensions.widthMeters * 0.5 * 0.425 - 4;
    const waterfallZ = waterfall.positionMeters.z - 3.5;
    this.spawnChallengeCache(
      "waterfall-hidden-cache",
      "waterfall_cache",
      "Versteck hinter dem Wasserfall",
      waterfallX,
      waterfallZ,
      -0.25,
    );

    const flowers = getIsland("blueteninsel");
    const flowerCount = resourceCount(flowers, "wildflower_patch");
    for (let index = 0; index < flowerCount; index += 1) {
      const angle = index / flowerCount * Math.PI * 2 + (index % 3) * 0.13;
      const radius = 24 + (index % 4) * 10;
      const x = flowers.positionMeters.x + Math.cos(angle) * radius;
      const z = flowers.positionMeters.z + 8 + Math.sin(angle) * radius * 0.68;
      const object = createResourceVisual("wildflower", this.assets);
      const id = `flower-island-wildflower-${index}`;
      object.name = "Sammelbar: Duftblüte";
      object.position.set(x, this.heightAt(x, z) + 0.03, z);
      object.rotation.y = index * 1.57;
      object.userData.entityId = id;
      this.scene.add(object);
      this.interactiveObjects.push(object);
      this.entities.set(id, { id, kind: "wildflower", object, available: true, amount: 1, hitPoints: 1, maxHitPoints: 1, cooldown: 0 });
    }

    const moon = getIsland("mondklippen");
    const beaconLocals = [
      { x: -72, z: -50 },
      { x: -70, z: 54 },
      { x: 58, z: 31 },
    ];
    for (const [index, local] of beaconLocals.entries()) {
      const x = moon.positionMeters.x + local.x;
      const z = moon.positionMeters.z + local.z;
      const object = createSignalBeaconVisual(this.assets, index + 1);
      const id = `moon-signal-${index + 1}`;
      object.name = `Windsignal ${index + 1}: Mondklippen`;
      object.position.set(x, this.heightAt(x, z) + 0.04, z);
      object.rotation.y = index * 2.1;
      object.userData.entityId = id;
      this.scene.add(object);
      this.interactiveObjects.push(object);
      this.entities.set(id, { id, kind: "signal_beacon", object, available: true, amount: 1, hitPoints: 1, maxHitPoints: 1, cooldown: 0 });
    }
    this.spawnChallengeCache(
      "moon-wind-cache",
      "moon_cache",
      "Verriegelte Windgrat-Kiste",
      moon.positionMeters.x + 62,
      moon.positionMeters.z - 2,
      0.35,
    );
  }

  private spawnTreasureSandbarGameplay(): void {
    const island = getIsland("schatzsandbank");
    const chestX = island.positionMeters.x + 7;
    const chestZ = island.positionMeters.z;
    const ground = this.heightAt(chestX, chestZ);
    const chest = this.assets.createModel("survival.chest") ?? createSummitCacheFallback();
    normalizeHeight(chest, 1.2);
    chest.name = "Halb vergrabene Truhe";
    chest.position.set(chestX, ground - 0.52, chestZ);
    chest.rotation.y = -0.28;
    chest.userData.entityId = TREASURE_CHEST_ID;
    chest.userData.buriedY = ground - 0.52;
    chest.userData.dugY = ground + 0.04;
    this.scene.add(chest);
    this.interactiveObjects.push(chest);
    this.entities.set(TREASURE_CHEST_ID, {
      id: TREASURE_CHEST_ID,
      kind: "buried_chest",
      object: chest,
      available: true,
      amount: 1,
      hitPoints: 1,
      maxHitPoints: 1,
      cooldown: 0,
    });

    const mound = createTreasureSandMound();
    mound.name = "Grabungsstelle: Vergrabene Truhe";
    mound.position.set(chestX, ground + 0.015, chestZ);
    this.scene.add(mound);

    const blueprintX = chestX + 2.55;
    const blueprintZ = chestZ + 1.45;
    const blueprint = createResourceVisual("shovel_blueprint", this.assets);
    blueprint.name = "Schaufel-Bauplan neben der Truhe";
    blueprint.position.set(blueprintX, this.heightAt(blueprintX, blueprintZ) + 0.09, blueprintZ);
    blueprint.rotation.set(-0.06, 0.45, 0.03);
    blueprint.userData.entityId = "treasure-sandbar-shovel-blueprint";
    this.scene.add(blueprint);
    this.interactiveObjects.push(blueprint);
    this.entities.set("treasure-sandbar-shovel-blueprint", {
      id: "treasure-sandbar-shovel-blueprint",
      kind: "shovel_blueprint",
      object: blueprint,
      available: true,
      amount: 1,
      hitPoints: 1,
      maxHitPoints: 1,
      cooldown: 0,
    });
    this.updateBuriedChestVisual();
  }

  private updateBuriedChestVisual(): void {
    const entity = this.entities.get(TREASURE_CHEST_ID);
    if (!entity || entity.kind !== "buried_chest") return;
    const targetY = this.isBuriedChestDug() ? entity.object.userData.dugY : entity.object.userData.buriedY;
    if (typeof targetY === "number") entity.object.position.y = targetY;
  }

  private spawnChallengeCache(
    id: string,
    kind: "waterfall_cache" | "moon_cache",
    name: string,
    x: number,
    z: number,
    rotationY: number,
  ): void {
    const object = this.assets.createModel("survival.box-large") ?? createSummitCacheFallback();
    normalizeHeight(object, 0.95);
    object.name = name;
    object.position.set(x, this.heightAt(x, z) + 0.05, z);
    object.rotation.y = rotationY;
    object.userData.entityId = id;
    this.scene.add(object);
    this.interactiveObjects.push(object);
    this.entities.set(id, { id, kind, object, available: true, amount: 1, hitPoints: 1, maxHitPoints: 1, cooldown: 0 });
  }

  private spawnCoralGarden(island: WorldIslandManifest, rng: SeededRandom): void {
    const count = 72;
    const group = new Group();
    group.name = "Landmarke: Korallengarten";
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const coral = new InstancedMesh(
      new ConeGeometry(0.35, 1, 5),
      new MeshStandardMaterial({ color: 0xd37863, roughness: 0.8 }),
      count,
    );
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const local = new Vector3();
    for (let index = 0; index < count; index += 1) {
      const angle = rng.range(-0.9, 0.8);
      const radius = rng.range(island.dimensions.widthMeters * 0.4, island.dimensions.widthMeters * 0.5);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * (island.dimensions.depthMeters / island.dimensions.widthMeters) + 12;
      const ground = this.heightAt(island.positionMeters.x + x, island.positionMeters.z + z);
      local.set(x, ground + 0.45, z);
      quaternion.setFromAxisAngle(new Vector3(0, 1, 0), rng.range(0, Math.PI * 2));
      scale.set(rng.range(0.8, 1.4), rng.range(0.7, 1.8), rng.range(0.8, 1.4));
      coral.setMatrixAt(index, matrix.compose(local, quaternion, scale));
    }
    coral.instanceMatrix.needsUpdate = true;
    group.add(coral);
    this.scene.add(group);
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 420 });
  }

  private spawnRockArch(island: WorldIslandManifest): void {
    const group = new Group();
    group.name = "Landmarke: Riffbogen";
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const layoutScale = islandLayoutScale(island);
    const offsetX = -25 * layoutScale.x;
    const offsetZ = -48 * layoutScale.z;
    const worldX = island.positionMeters.x + offsetX;
    const worldZ = island.positionMeters.z + offsetZ;
    const ground = this.heightAt(worldX, worldZ);
    for (const [index, x] of [-3.2, 3.2].entries()) {
      const pillar = this.assets.createModel(index === 0 ? "nature.rock-tall-c" : "nature.rock-tall-f");
      if (pillar) {
        fitModelToBox(pillar, 2.55, 6.5, 2.75);
        const anchor = new Group();
        anchor.name = `Kit-Felsbogen-Pfeiler: ${index + 1}`;
        anchor.position.set(offsetX + x, ground, offsetZ);
        anchor.rotation.y = index === 0 ? -0.28 : 0.36;
        anchor.add(pillar);
        group.add(anchor);
      }
      this.physics.addFixedCuboid({ x: worldX + x, y: ground + 3.25, z: worldZ }, { x: 1.15, y: 3.25, z: 1.3 });
    }
    const lintel = this.assets.createModel("nature.rock-large-c");
    if (lintel) {
      fitModelToBox(lintel, 8.7, 2.1, 2.9);
      const anchor = new Group();
      anchor.name = "Kit-Felsbogen-Sturz: nature.rock-large-c";
      anchor.position.set(offsetX, ground + 6.05, offsetZ);
      anchor.rotation.z = -0.05;
      anchor.add(lintel);
      group.add(anchor);
    }
    this.physics.addFixedCuboid({ x: worldX, y: ground + 7.1, z: worldZ }, { x: 4.35, y: 1.05, z: 1.4 }, -0.05);
    if (group.children.length === 0) return;
    this.scene.add(group);
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 360 });
  }

  private spawnWaterfall(island: WorldIslandManifest): void {
    const group = new Group();
    group.name = "Landmarke: Großer Wasserfall";
    group.position.set(island.positionMeters.x, 0, island.positionMeters.z);
    const radiusX = island.dimensions.widthMeters * 0.5;
    const waterfallX = radiusX * 0.425;
    const plungeDefinition = FRESHWATER_BASINS.find(({ id }) => id === "wasserfallinsel-pool")!;
    const plungePool = resolveFreshwaterBasin(plungeDefinition, island);
    const base = plungePool.surfaceY + 0.08;
    const river = WATERCOURSES.find(({ id }) => id === "wasserfallinsel-upper-river")!;
    const top = Math.max(
      base + 9,
      this.heightAt(island.positionMeters.x + waterfallX, island.positionMeters.z) + river.depth * 0.82,
    );
    const height = Math.min(19, top - base);
    const geometry = createWaterfallRibbonGeometry(5.4, height);
    const water = new Mesh(
      geometry,
      new MeshBasicMaterial({ color: 0x9eece6, transparent: true, opacity: 0.62, side: DoubleSide, depthWrite: false }),
    );
    water.name = "Wasserfall: Hauptschleier";
    water.position.set(waterfallX, base, 0);
    water.renderOrder = 8;
    const whitewater = new Mesh(
      createWaterfallRibbonGeometry(2.1, height * 0.98),
      new MeshBasicMaterial({ color: 0xe6fff7, transparent: true, opacity: 0.38, side: DoubleSide, depthWrite: false }),
    );
    whitewater.name = "Wasserfall: Gischtstreifen";
    whitewater.position.set(waterfallX - 0.035, base + 0.12, -0.7);
    whitewater.renderOrder = 9;
    const runout = new Mesh(
      createWaterRibbonGeometry([
        { x: waterfallX + 0.8, y: plungePool.surfaceY + 0.07, z: 0, width: 3.2 },
        { x: waterfallX + (plungePool.x - waterfallX) * 0.48, y: plungePool.surfaceY + 0.06, z: -0.7, width: 3.8 },
        { x: plungePool.x, y: plungePool.surfaceY + 0.055, z: plungePool.z, width: plungePool.radiusZ * 0.72 },
      ], 12),
      this.createInlandWaterMaterial(0x1a7378, 0x88e3d5, 0.75, 0.022),
    );
    runout.name = "Wasserfall: Abfluss zum Nebelpool";
    runout.renderOrder = 7;
    const mist = new Mesh(
      new SphereGeometry(3.3, 14, 8),
      new MeshBasicMaterial({ color: 0xdaf9f1, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    mist.name = "Wasserfall: Bodennebel";
    mist.scale.set(1.65, 0.5, 1.25);
    mist.position.set(waterfallX + 3, base + 1.05, 0);
    group.add(runout, water, whitewater, mist);
    this.scene.add(group);
    this.streamedScenery.push({ object: group, center: group.position.clone(), distance: 520 });
  }

  private spawnWreck(): void {
    const island = getIsland("dschungelbucht");
    const x = island.positionMeters.x + island.dimensions.widthMeters * 0.39;
    const z = island.positionMeters.z - island.dimensions.depthMeters * 0.29;
    const y = this.heightAt(x, z);
    const wreck = new Group();
    wreck.name = "Interaktiv: Wrack aus Survival-Kit-Modellen";
    const wreckParts = [
      { id: "survival.resource-planks", x: -1.6, y: 0.08, z: 0.2, height: 0.48, rotationY: -0.22 },
      { id: "survival.resource-planks", x: 1.55, y: 0.22, z: 0.65, height: 0.44, rotationY: 0.34 },
      { id: "survival.resource-wood", x: -0.35, y: 0.18, z: 1.45, height: 0.72, rotationY: 1.08 },
      { id: "survival.barrel", x: 2.15, y: 0, z: -1.3, height: 1.05, rotationY: -0.5 },
      { id: "survival.chest", x: 0, y: 0.04, z: -0.45, height: 1.05, rotationY: 0.12 },
    ] as const;
    for (const part of wreckParts) {
      const model = this.assets.createModel(part.id);
      if (!model) continue;
      normalizeHeight(model, part.height);
      const anchor = new Group();
      anchor.name = `Kit-Modell: ${part.id}`;
      anchor.position.set(part.x, part.y, part.z);
      anchor.rotation.y = part.rotationY;
      anchor.add(model);
      wreck.add(anchor);
    }
    if (wreck.children.length === 0) return;
    wreck.position.set(x, y + 0.1, z);
    wreck.rotation.y = -0.4;
    wreck.userData.entityId = "wreck-chest";
    this.scene.add(wreck);
    this.interactiveObjects.push(wreck);
    this.entities.set("wreck-chest", { id: "wreck-chest", kind: "wreck_chest", object: wreck, available: true, amount: 1, hitPoints: 1, maxHitPoints: 1, cooldown: 0 });
  }

  private spawnShark(): void {
    const shark = createSharkVisual();
    const jungleBay = getIsland("dschungelbucht");
    shark.position.set(jungleBay.positionMeters.x * 0.5, -1.2, 25);
    shark.userData.entityId = "channel-shark";
    this.scene.add(shark);
    this.interactiveObjects.push(shark);
    this.shark = { id: "channel-shark", kind: "shark", object: shark, available: true, amount: 1, hitPoints: 160, maxHitPoints: 160, cooldown: 0, home: shark.position.clone() };
    this.entities.set(this.shark.id, this.shark);
  }

  private updateCrabs(dt: number, player: Vec3Like, events: WorldEvent[]): void {
    for (const crab of this.entities.values()) {
      if (crab.kind !== "crab" || !crab.available || !crab.home) continue;
      crab.cooldown = Math.max(0, crab.cooldown - dt);
      const distanceToPlayer = Math.sqrt(distanceSquaredXZ(crab.object.position, player));
      const target = distanceToPlayer < 4 ? new Vector3(player.x, crab.object.position.y, player.z) : crab.home;
      const direction = target.clone().sub(crab.object.position);
      direction.y = 0;
      if (direction.lengthSq() > 0.4) {
        direction.normalize();
        crab.object.position.addScaledVector(direction, dt * (distanceToPlayer < 4 ? 0.75 : 0.25));
        crab.object.rotation.y = Math.atan2(direction.x, direction.z);
        crab.object.position.y = this.heightAt(crab.object.position.x, crab.object.position.z) + 0.18;
      }
      if (distanceToPlayer < 0.85 && crab.cooldown <= 0) {
        crab.cooldown = 3;
        events.push({ type: "player-damage", amount: 4, text: "Eine Krabbe zwickt dich!" });
      }
    }
  }

  private updateWildlife(dt: number, player: Vec3Like, timeOfDay: number, playerNoise: number, events: WorldEvent[]): void {
    this.updateWildlifeTracks(dt);
    const wildlife = [...this.entities.values()].filter((entity) =>
      isWildlifeKind(entity.kind) && entity.available && entity.home,
    );
    const groups = new Map<string, WorldEntity[]>();
    for (const animal of wildlife) {
      const groupId = animal.wildlifeGroupId ?? animal.id;
      const members = groups.get(groupId) ?? [];
      members.push(animal);
      groups.set(groupId, members);
    }
    const alarmedGroups = new Set<string>();
    for (const animal of wildlife) {
      if (animal.kind !== "bird" && animal.kind !== "chicken" && animal.kind !== "turtle") continue;
      const distanceToPlayer = Math.sqrt(distanceSquaredXZ(animal.object.position, player));
      const hearingRange = animal.kind === "bird" ? 30 : 16;
      const heard = playerNoise > 0.05 && distanceToPlayer < hearingRange * (0.45 + clamp(playerNoise, 0, 1));
      const close = distanceToPlayer < (animal.kind === "bird" ? 11 : 6.5);
      const recentlyAlarmed = animal.wildlifeState === "alerted" && animal.cooldown > 0;
      if (heard || close || recentlyAlarmed) alarmedGroups.add(animal.wildlifeGroupId ?? animal.id);
    }
    for (const animal of wildlife) {
      animal.mixer?.update(dt);
      animal.cooldown = Math.max(0, animal.cooldown - dt);
      animal.wildlifeTrackCooldown = Math.max(0, (animal.wildlifeTrackCooldown ?? 0) - dt);
      const home = animal.home!;
      const distanceToPlayer = Math.sqrt(distanceSquaredXZ(animal.object.position, player));
      const phase = animal.wildlifePhase ?? 0;
      if (animal.kind === "wild_boar" && animal.wildlifeProvoked && distanceToPlayer > 32) {
        animal.wildlifeProvoked = false;
      }
      const provokedBoar = animal.kind === "wild_boar" && animal.wildlifeProvoked === true;
      const hearingRange = animal.kind === "bird" ? 30 : animal.kind === "crocodile" ? 24 : animal.kind === "wild_boar" ? 20 : animal.kind === "snake" ? 12 : 16;
      const noiseHeard = playerNoise > 0.05 && distanceToPlayer < hearingRange * (0.45 + clamp(playerNoise, 0, 1));
      const proximityThreat = distanceToPlayer < (animal.kind === "crocodile" ? 8.5 : animal.kind === "wild_boar" ? 7.5 : animal.kind === "bird" ? 11 : animal.kind === "snake" ? 5.5 : 6.5);
      const groupAlarmed = alarmedGroups.has(animal.wildlifeGroupId ?? animal.id);
      const threatened = noiseHeard || proximityThreat || groupAlarmed || provokedBoar || animal.wildlifeState === "alerted" && animal.cooldown > 0;
      const isNight = timeOfDay < 0.21 || timeOfDay > 0.84;
      const drinking = !isNight && !threatened && Boolean(animal.wildlifeWaterTarget) && timeOfDay >= 0.3 && timeOfDay <= 0.38;
      const feeding = !isNight && !threatened && ((this.elapsedSeconds * 0.035 + phase) % 1 + 1) % 1 < 0.34;
      const state: WildlifeBehaviorState = isNight && !threatened
        ? "sleeping"
        : threatened
          ? "alerted"
          : drinking
            ? "drinking"
            : feeding
              ? "feeding"
              : "wandering";
      animal.wildlifeState = state;
      animal.object.userData.wildlifeState = state;
      if (noiseHeard || groupAlarmed) animal.cooldown = Math.max(animal.cooldown, 3.5);
      if (animal.kind === "bird") this.updateBirdWingAnimation(animal, state, phase);
      if (animal.kind === "snake") this.updateSnakeAnimation(animal, state, phase);

      if (state === "sleeping") {
        this.setEntityAnimation(animal, "Idle");
        animal.object.rotation.x = 0;
        animal.object.rotation.z = animal.kind === "bird" ? 0 : 0.08;
        const ground = this.heightAt(animal.object.position.x, animal.object.position.z);
        if (animal.kind === "bird" && animal.wildlifePerch) {
          const perchDirection = animal.wildlifePerch.clone().sub(animal.object.position);
          animal.object.position.addScaledVector(perchDirection, Math.min(1, dt * 0.85));
          if (perchDirection.lengthSq() > 0.05) animal.object.rotation.y = Math.atan2(perchDirection.x, perchDirection.z);
        } else animal.object.position.y = ground + (animal.kind === "bird" ? 0.62 : animal.kind === "turtle" || animal.kind === "crocodile" ? 0.1 : 0.03);
        continue;
      }

      animal.object.rotation.z *= Math.max(0, 1 - dt * 5);
      animal.object.rotation.x = state === "feeding" ? 0.12 : 0;
      if (animal.kind === "bird" && state === "feeding") {
        const feedingGround = this.heightAt(animal.object.position.x, animal.object.position.z);
        animal.object.position.y += (feedingGround + 0.52 - animal.object.position.y) * Math.min(1, dt * 2.5);
      }
      const orbitRadius = animal.kind === "crocodile" ? 9 : animal.kind === "wild_boar" ? 10 : animal.kind === "bird" ? 15 : animal.kind === "turtle" ? 5 : animal.kind === "snake" ? 4 : 7;
      const wanderTarget = new Vector3(
        home.x + Math.sin(this.elapsedSeconds * (animal.kind === "wild_boar" || animal.kind === "crocodile" ? 0.075 : 0.11) + phase) * orbitRadius,
        animal.object.position.y,
        home.z + Math.cos(this.elapsedSeconds * (animal.kind === "wild_boar" || animal.kind === "crocodile" ? 0.061 : 0.09) + phase * 1.3) * orbitRadius,
      );
      const members = groups.get(animal.wildlifeGroupId ?? animal.id) ?? [animal];
      if (state === "wandering" && members.length > 1) {
        const center = members.reduce((sum, member) => sum.add(member.object.position), new Vector3()).multiplyScalar(1 / members.length);
        center.y = wanderTarget.y;
        wanderTarget.lerp(center, 0.38);
      }
      const aggressive = animal.kind === "crocodile" || animal.kind === "snake" || provokedBoar;
      const target = state === "alerted"
        ? aggressive
          ? new Vector3(player.x, animal.object.position.y, player.z)
          : animal.object.position.clone().multiplyScalar(2).sub(new Vector3(player.x, animal.object.position.y, player.z))
        : state === "drinking" && animal.wildlifeWaterTarget
          ? animal.wildlifeWaterTarget.clone()
          : wanderTarget;
      const direction = target.sub(animal.object.position);
      direction.y = 0;
      for (const other of wildlife) {
        if (other === animal) continue;
        const separationX = animal.object.position.x - other.object.position.x;
        const separationZ = animal.object.position.z - other.object.position.z;
        const distanceSq = separationX * separationX + separationZ * separationZ;
        const minimum = animal.kind === "crocodile" || other.kind === "crocodile" ? 3.4 : animal.kind === "wild_boar" || other.kind === "wild_boar" ? 2.2 : 1.25;
        if (distanceSq > 0.001 && distanceSq < minimum * minimum) {
          const strength = 2.4 / Math.sqrt(distanceSq);
          direction.x += separationX * strength;
          direction.z += separationZ * strength;
        }
      }
      if (state === "drinking" && direction.lengthSq() < 1.8 ** 2) {
        direction.set(0, 0, 0);
        animal.object.rotation.x = 0.18;
      }
      if (direction.lengthSq() > 0.06 && state !== "feeding") {
        direction.normalize();
        const speed = state === "alerted"
          ? animal.kind === "crocodile" ? 2.8 : animal.kind === "wild_boar" ? 3.2 : animal.kind === "turtle" ? 1.2 : animal.kind === "snake" ? 1.7 : 3.5
          : animal.kind === "crocodile" ? 0.48 : animal.kind === "wild_boar" ? 0.62 : animal.kind === "turtle" ? 0.3 : animal.kind === "bird" ? 2.2 : animal.kind === "snake" ? 0.38 : 0.78;
        const nextX = animal.object.position.x + direction.x * dt * speed;
        const nextZ = animal.object.position.z + direction.z * dt * speed;
        const nextGround = this.heightAt(nextX, nextZ);
        const habitatValid = animal.kind === "bird"
          || animal.kind === "turtle" && nextGround > 0.04 && nextGround < 3
          || animal.kind === "crocodile" && nextGround > -0.45 && nextGround < 3.6
          || nextGround > 0.4;
        if (habitatValid && (state === "alerted" || state === "drinking" || distanceSquaredXZ({ x: nextX, y: nextGround, z: nextZ }, home) < (orbitRadius + 8) ** 2)) {
          animal.object.position.x = nextX;
          animal.object.position.z = nextZ;
          if (animal.kind === "bird") {
            const flightHeight = Math.max(nextGround + 3.2, 3.4) + Math.sin(this.elapsedSeconds * 4 + phase) * 0.35;
            animal.object.position.y += (flightHeight - animal.object.position.y) * Math.min(1, dt * 2.2);
          } else animal.object.position.y = nextGround + (animal.kind === "turtle" || animal.kind === "crocodile" ? 0.1 : 0.03);
          animal.object.rotation.y = Math.atan2(direction.x, direction.z);
        }
        this.setEntityAnimation(animal, state === "alerted" ? "Run" : animal.kind === "wild_boar" || animal.kind === "crocodile" ? "Walk" : "Idle_Peck");
        this.maybeSpawnWildlifeTrack(animal);
      } else this.setEntityAnimation(animal, state === "feeding" || state === "drinking" ? "Eat" : "Idle");

      if (animal.kind === "wild_boar" && provokedBoar && distanceToPlayer < 1.35 && animal.cooldown <= 0) {
        animal.cooldown = 4;
        this.setEntityAnimation(animal, "Headbutt");
        events.push({ type: "player-damage", amount: 12, text: "Das Wildschwein rammt dich!", causesBleeding: true });
      } else if (animal.kind === "crocodile" && distanceToPlayer < 1.75 && animal.cooldown <= 0) {
        animal.cooldown = 5;
        this.setEntityAnimation(animal, "Attack");
        events.push({ type: "player-damage", amount: 24, text: "Das Krokodil schnappt nach dir!", causesBleeding: true });
      } else if (animal.kind === "snake" && distanceToPlayer < 0.95 && animal.cooldown <= 0) {
        animal.cooldown = 6;
        events.push({ type: "player-poison", text: "Eine Giftschlange beißt dich – du bist vergiftet!" });
      }
    }
  }

  private maybeSpawnWildlifeTrack(animal: WorldEntity): void {
    const kind = animal.kind;
    if (
      (kind !== "wild_boar" && kind !== "chicken" && kind !== "turtle" && kind !== "crocodile")
      || (animal.wildlifeTrackCooldown ?? 0) > 0
    ) return;
    const ground = this.heightAt(animal.object.position.x, animal.object.position.z);
    if (ground < 0.12) return;
    const lastPosition = animal.wildlifeLastTrackPosition ?? animal.home;
    if (lastPosition && distanceSquaredXZ(lastPosition, animal.object.position) < 1.55 ** 2) return;

    const track = createWildlifeTrackVisual(kind);
    track.position.set(animal.object.position.x, ground + 0.025, animal.object.position.z);
    track.rotation.y = animal.object.rotation.y;
    this.wildlifeTrackGroup.add(track);
    this.wildlifeTracks.push({ object: track, ageSeconds: 0, lifetimeSeconds: 68 });
    animal.wildlifeLastTrackPosition = animal.object.position.clone();
    animal.wildlifeTrackCooldown = kind === "turtle" || kind === "crocodile" ? 3.2 : 2.1;

    if (this.wildlifeTracks.length > 120) this.removeWildlifeTrack(0);
  }

  private updateWildlifeTracks(dt: number): void {
    for (let index = this.wildlifeTracks.length - 1; index >= 0; index -= 1) {
      const track = this.wildlifeTracks[index]!;
      track.ageSeconds += dt;
      if (track.ageSeconds >= track.lifetimeSeconds) {
        this.removeWildlifeTrack(index);
        continue;
      }
      const opacity = 0.34 * (1 - smoothstep(0.38, 1, track.ageSeconds / track.lifetimeSeconds));
      track.object.traverse((part) => {
        if (!(part instanceof Mesh)) return;
        const materials = Array.isArray(part.material) ? part.material : [part.material];
        for (const material of materials) {
          if (material instanceof MeshBasicMaterial || material instanceof MeshStandardMaterial) material.opacity = opacity;
        }
      });
    }
  }

  private removeWildlifeTrack(index: number): void {
    const [track] = this.wildlifeTracks.splice(index, 1);
    if (!track) return;
    this.wildlifeTrackGroup.remove(track.object);
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<MeshBasicMaterial | MeshStandardMaterial>();
    track.object.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      geometries.add(part.geometry);
      const partMaterials = Array.isArray(part.material) ? part.material : [part.material];
      for (const material of partMaterials) {
        if (material instanceof MeshBasicMaterial || material instanceof MeshStandardMaterial) materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }

  private updateSnakeAnimation(animal: WorldEntity, state: WildlifeBehaviorState, phase: number): void {
    const speed = state === "alerted" ? 11 : 5;
    const amplitude = state === "sleeping" ? 0.025 : state === "alerted" ? 0.16 : 0.09;
    animal.object.traverse((part) => {
      const index = part.userData.snakeSegmentIndex;
      if (typeof index !== "number") return;
      part.position.x = Math.sin(this.elapsedSeconds * speed + phase + index * 0.72) * amplitude;
    });
  }

  private updateBirdWingAnimation(animal: WorldEntity, state: WildlifeBehaviorState, phase: number): void {
    const leftWing = animal.object.getObjectByName("bird-wing-left");
    const rightWing = animal.object.getObjectByName("bird-wing-right");
    if (!leftWing || !rightWing) return;
    const amplitude = state === "alerted" ? 0.82 : state === "wandering" ? 0.58 : 0.08;
    const speed = state === "alerted" ? 13 : 9;
    const flap = state === "sleeping" || state === "feeding"
      ? 0.08
      : Math.sin(this.elapsedSeconds * speed + phase) * amplitude;
    leftWing.rotation.z = flap;
    rightWing.rotation.z = -flap;
  }

  private setupEntityAnimations(entity: WorldEntity): void {
    if (entity.object.animations.length === 0) return;
    entity.mixer = new AnimationMixer(entity.object);
    entity.animationActions = new Map(entity.object.animations.map((clip) => [clip.name, entity.mixer!.clipAction(clip)]));
    this.setEntityAnimation(entity, "Idle");
  }

  private setEntityAnimation(entity: WorldEntity, requested: string): void {
    if (!entity.animationActions || entity.activeAnimation === requested) return;
    const action = entity.animationActions.get(requested)
      ?? entity.animationActions.get(requested === "Idle_Peck" ? "Idle" : requested === "Walk" ? "Run" : "Idle");
    if (!action) return;
    const previous = entity.activeAnimation ? entity.animationActions.get(entity.activeAnimation) : undefined;
    previous?.fadeOut(0.18);
    action.reset().fadeIn(0.18).play();
    entity.activeAnimation = action.getClip().name;
  }

  private updateCampfireCookingVisual(building: BuildingState): void {
    if (building.type !== "campfire") return;
    const root = this.buildingObjects.get(building.id);
    if (!root) return;
    const flame = root.getObjectByName("campfire-flame");
    if (flame) flame.visible = building.fireFuel > 0;
    const duration = building.cookingItem === "raw_meat" ? 30 : building.cookingItem === "raw_fish" ? 20 : 25;
    const state = building.cookingProgress <= 0 || !building.cookingItem
      ? "empty"
      : `${building.cookingItem}-${building.cookingProgress >= duration ? "cooked" : "raw"}`;
    if (root.userData.cookingVisualState === state) return;
    const oldVisual = root.getObjectByName("cooking-food");
    if (oldVisual) root.remove(oldVisual);
    root.userData.cookingVisualState = state;
    if (state === "empty") return;
    const cooked = state.endsWith("-cooked");
    const food = building.cookingItem === "raw_meat"
      ? createResourceVisual(cooked ? "cooked_meat" : "raw_meat", this.assets)
      : building.cookingItem === "raw_fish"
        ? createResourceVisual(cooked ? "cooked_fish" : "raw_fish", this.assets)
        : createCrabVisual(cooked ? 0x9a3f22 : 0xd65d32);
    food.name = "cooking-food";
    food.position.set(0, 0.77, 0);
    food.rotation.set(-0.18, 0.35, 0.08);
    if (building.cookingItem === "crab") food.scale.setScalar(0.72);
    root.add(food);
  }

  private updateFishTrapVisual(building: BuildingState): void {
    if (building.type !== "fish_trap") return;
    const root = this.buildingObjects.get(building.id);
    const catchVisual = root?.getObjectByName("fish-trap-catch");
    if (catchVisual) catchVisual.visible = (building.fishTrapStored ?? 0) > 0;
    const baitMarker = root?.getObjectByName("fish-trap-bait-marker");
    if (baitMarker) baitMarker.visible = Boolean(building.fishTrapBaited);
  }

  private updateSmokingRackVisual(building: BuildingState): void {
    if (building.type !== "smoking_rack") return;
    const root = this.buildingObjects.get(building.id);
    if (!root) return;
    const rawCount = building.smokerInputCount ?? 0;
    const readyCount = building.smokerReadyCount ?? 0;
    for (let index = 0; index < SMOKING_BATCH_SIZE; index += 1) {
      const raw = root.getObjectByName(`smoker-raw-meat-${index}`);
      if (raw) raw.visible = index < rawCount;
      const ready = root.getObjectByName(`smoker-ready-meat-${index}`);
      if (ready) ready.visible = index < readyCount;
    }
    const smoke = root.getObjectByName("smoker-smoke");
    if (smoke) smoke.visible = rawCount > 0;
  }

  private updateShark(dt: number, player: Vec3Like, swimming: boolean, onRaft: boolean, events: WorldEvent[]): void {
    const shark = this.shark;
    if (!shark?.available) return;
    shark.cooldown = Math.max(0, shark.cooldown - dt);
    const sharkPosition = shark.object.position;
    const distance = Math.sqrt(distanceSquaredXZ(sharkPosition, player));
    const canHunt = (swimming || onRaft) && this.isDeepWater(player.x, player.z) && distance < 35;
    let target: Vector3;
    if (canHunt && shark.cooldown <= 0) target = new Vector3(player.x, -1.1, player.z);
    else target = new Vector3(170 + Math.sin(this.elapsedSeconds * 0.12) * 70, -1.25, 18 + Math.cos(this.elapsedSeconds * 0.17) * 48);
    const direction = target.sub(sharkPosition);
    direction.y *= 0.25;
    if (direction.lengthSq() > 0.01) {
      direction.normalize();
      sharkPosition.addScaledVector(direction, dt * (canHunt ? 4.2 : 2.1));
      shark.object.rotation.y = Math.atan2(direction.x, direction.z) - Math.PI / 2;
      shark.object.rotation.z = Math.sin(this.elapsedSeconds * 2) * 0.05;
    }
    if (canHunt && swimming && distance < 2.2 && shark.cooldown <= 0) {
      shark.cooldown = 5;
      events.push({ type: "player-damage", amount: 22, text: "Der Hai hat dich gebissen!", causesBleeding: true });
    } else if (canHunt && onRaft && distance < 2.8 && shark.cooldown <= 0) {
      shark.cooldown = 18;
      events.push({ type: "raft-damage", amount: 8, text: "Der Hai rammt dein Floß!" });
    }
  }

  private updateLighting(timeOfDay: number, player: Vec3Like): void {
    const angle = timeOfDay * Math.PI * 2 - Math.PI / 2;
    const height = Math.sin(angle);
    const daylight = smoothstep(-0.18, 0.25, height);
    this.sun.position.set(player.x + Math.cos(angle) * 240, height * 240, player.z + Math.sin(angle) * 120);
    this.sun.target.position.set(player.x, 0, player.z);
    this.sun.target.updateMatrixWorld();
    this.sun.intensity = 0.2 + daylight * 3;
    this.hemisphere.intensity = 0.28 + daylight * 1.55;
    const dayColor = new Color(0x8fcbd7);
    const nightColor = new Color(0x061625);
    const skyColor = nightColor.lerp(dayColor, daylight);
    if (this.playerUnderwater) {
      const underwaterColor = new Color(0x0b7180).multiplyScalar(0.45 + daylight * 0.55);
      this.scene.background = underwaterColor;
      this.sun.intensity *= 0.2;
      this.hemisphere.intensity = 0.28 + daylight * 0.42;
      if (this.scene.fog instanceof FogExp2) {
        this.scene.fog.color.copy(underwaterColor);
        this.scene.fog.density = 0.032;
      }
    } else {
      if (this.currentWeather.kind === "rain") {
        skyColor.lerp(new Color(0x657985), 0.58);
        this.sun.intensity *= 0.55;
        this.hemisphere.intensity *= 0.72;
      } else if (this.currentWeather.kind === "storm") {
        skyColor.lerp(new Color(0x263746), 0.78);
        this.sun.intensity *= 0.24;
        this.hemisphere.intensity *= 0.52;
      } else if (this.currentWeather.kind === "heat") {
        skyColor.lerp(new Color(0xf0c383), 0.2);
        this.sun.intensity *= 1.12;
      }
      this.scene.background = skyColor;
      if (this.scene.fog instanceof FogExp2) {
        this.scene.fog.color.copy(skyColor);
        this.scene.fog.density = this.currentWeather.kind === "storm"
          ? 0.0028
          : this.currentWeather.kind === "rain"
            ? 0.0022
            : this.currentWeather.kind === "heat"
              ? 0.0018
              : 0.00155;
      }
    }
    this.skyMaterial.uniforms.uDaylight!.value = daylight;
  }

  private updateRain(dtSeconds: number, player: Vec3Like, weather: WeatherState): void {
    this.rain.visible = weather.isRaining && !this.playerUnderwater;
    this.rain.position.set(player.x, player.y + 8, player.z);
    if (!this.rain.visible) return;
    const positions = this.rain.geometry.getAttribute("position") as BufferAttribute;
    for (let index = 1; index < positions.count * 3; index += 3) {
      const nextY = (positions.array[index] as number) - dtSeconds * (weather.kind === "storm" ? 23 : 17);
      positions.array[index] = nextY < -10 ? nextY + 20 : nextY;
    }
    positions.needsUpdate = true;
  }

  private updateLightning(dtSeconds: number, player: Vec3Like, weather: WeatherState, events: WorldEvent[]): void {
    this.lightningFlashSeconds = Math.max(0, this.lightningFlashSeconds - dtSeconds);
    this.lightningLight.intensity = this.lightningFlashSeconds > 0 ? 120 : 0;
    if (!weather.hasLightning) return;
    const slot = Math.floor(this.elapsedSeconds / 14);
    if (slot === this.lastLightningSlot) return;
    this.lastLightningSlot = slot;
    events.push(...this.forceLightningStrike(player));
  }

  private igniteTree(entity: WorldEntity): void {
    entity.burningSeconds = 22;
    if (entity.fireObject) return;
    const fire = createLightningFireVisual();
    fire.position.set(0, 1.4, 0);
    entity.object.add(fire);
    entity.fireObject = fire;
  }

  private updateBurningTrees(dtSeconds: number, events: WorldEvent[]): void {
    for (const entity of this.entities.values()) {
      if (!entity.fireObject || !entity.burningSeconds) continue;
      entity.burningSeconds = Math.max(0, entity.burningSeconds - dtSeconds);
      const pulse = 0.88 + Math.sin(this.elapsedSeconds * 9 + entity.object.position.x) * 0.12;
      entity.fireObject.scale.setScalar(pulse);
      if (entity.burningSeconds > 0) continue;
      entity.object.remove(entity.fireObject);
      delete entity.fireObject;
      entity.hitPoints = Math.max(1, entity.hitPoints - 1);
      events.push({ type: "message", text: `Das Feuer an ${entity.kind === "palm" ? "der Palme" : "dem Baum"} ist erloschen, hat aber sichtbaren Schaden hinterlassen.` });
    }
  }

  private animateVegetation(time: number): void {
    for (const entity of this.entities.values()) {
      if (entity.kind === "palm" && entity.available && !entity.falling) {
        entity.object.rotation.z = Math.sin(time * 0.55 + entity.object.position.x) * 0.008;
      }
    }
  }

  private beginTreeFall(entity: WorldEntity, camera: Camera): void {
    const cameraPosition = new Vector3();
    camera.getWorldPosition(cameraPosition);
    const direction = entity.object.position.clone().sub(cameraPosition);
    direction.y = 0;
    if (direction.lengthSq() < 0.001) {
      direction.set(Math.sin(entity.object.rotation.y), 0, Math.cos(entity.object.rotation.y));
    }
    direction.normalize();
    const axis = new Vector3(direction.z, 0, -direction.x).normalize();
    entity.falling = {
      elapsedSeconds: 0,
      startQuaternion: entity.instancedTree ? null : entity.object.quaternion.clone(),
      axis,
      direction,
    };
    this.fallingTrees.add(entity);
    if (entity.collider) {
      this.physics.removeColliderBody(entity.collider);
      delete entity.collider;
    }
  }

  private updateFallingTrees(dtSeconds: number): WorldEvent[] {
    const events: WorldEvent[] = [];
    const fallRotation = new Quaternion();
    for (const entity of this.fallingTrees) {
      const falling = entity.falling;
      if (!entity.available || !falling) {
        this.fallingTrees.delete(entity);
        continue;
      }
      falling.elapsedSeconds += dtSeconds;
      const progress = clamp(falling.elapsedSeconds / TREE_FALL_DURATION_SECONDS, 0, 1);
      const acceleratedProgress = progress * progress;
      fallRotation.setFromAxisAngle(falling.axis, TREE_FALL_ANGLE * acceleratedProgress);
      if (entity.instancedTree) this.updateInstancedTreeMatrices(entity.instancedTree, fallRotation);
      else if (falling.startQuaternion) entity.object.quaternion.copy(falling.startQuaternion).premultiply(fallRotation);

      if (falling.elapsedSeconds < TREE_FALL_DURATION_SECONDS + TREE_SETTLE_DURATION_SECONDS) continue;
      const dropDistance = entity.instancedTree ? Math.min(3.4, entity.instancedTree.height * 0.35) : 2.4;
      const lootOrigin = entity.object.position.clone().addScaledVector(falling.direction, dropDistance);
      const isPalm = entity.kind === "palm";
      delete entity.falling;
      this.fallingTrees.delete(entity);
      this.removeEntity(entity);
      this.spawnLooseLoot(lootOrigin, isPalm
        ? [
            { itemId: "palm_log", count: 1 },
            { itemId: "palm_frond", count: 4 },
          ]
        : [{ itemId: "palm_log", count: 1 }]);
      events.push({
        type: "message",
        text: isPalm ? "Die Palme ist gefallen. Stamm und Palmwedel liegen bereit." : "Der Baum ist gefallen. Der Stamm liegt bereit.",
      });
    }
    return events;
  }

  private updateInstancedTreeMatrices(tree: InstancedTreeInstance, fallRotation: Quaternion | null): void {
    const base = new Matrix4().makeTranslation(
      tree.position.x - tree.center.x,
      tree.position.y,
      tree.position.z - tree.center.z,
    );
    const fall = fallRotation ? new Matrix4().makeRotationFromQuaternion(fallRotation) : new Matrix4();
    const turn = new Matrix4().makeRotationY(tree.rotationY);
    const offset = new Matrix4();
    const scale = new Matrix4();
    const matrix = new Matrix4();
    const setPart = (
      mesh: InstancedMesh,
      index: number,
      x: number,
      y: number,
      z: number,
      scaleX: number,
      scaleY: number,
      scaleZ: number,
    ): void => {
      offset.makeTranslation(x, y, z);
      scale.makeScale(scaleX, scaleY, scaleZ);
      matrix.copy(base).multiply(fall).multiply(offset).multiply(turn).multiply(scale);
      mesh.setMatrixAt(index, matrix);
      mesh.instanceMatrix.needsUpdate = true;
    };

    if (tree.variant === "mangrove") {
      if (tree.roots) setPart(tree.roots, tree.index, 0, 0.62, 0, tree.rootScaleX, 1, tree.rootScaleZ);
      setPart(tree.trunks, tree.index, 0, 0.75 + tree.height * 0.5, 0, 1, tree.height, 1);
      setPart(
        tree.crowns,
        tree.index,
        0,
        tree.height + 1.1,
        0,
        tree.height * 0.42,
        tree.height * 0.25,
        tree.height * 0.42,
      );
      return;
    }

    setPart(tree.trunks, tree.index, 0, tree.height * 0.325, 0, 1, tree.height * 0.65, 1);
    for (let crownIndex = 0; crownIndex < 3; crownIndex += 1) {
      const crownScale = tree.height * (0.2 + crownIndex * 0.015);
      setPart(
        tree.crowns,
        tree.index * 3 + crownIndex,
        (crownIndex - 1) * 0.5,
        tree.height * (0.65 + crownIndex * 0.08),
        (crownIndex % 2) * 0.55,
        crownScale,
        crownScale * 0.72,
        crownScale,
      );
    }
    if (tree.silhouettes) {
      setPart(
        tree.silhouettes,
        tree.index,
        0,
        0,
        0,
        tree.height * 0.78,
        tree.height,
        tree.height * 0.78,
      );
    }
  }

  private hideInstancedTree(tree: InstancedTreeInstance): void {
    const hidden = new Matrix4().makeScale(0, 0, 0);
    if (tree.roots) tree.roots.setMatrixAt(tree.index, hidden);
    tree.trunks.setMatrixAt(tree.index, hidden);
    if (tree.silhouettes) tree.silhouettes.setMatrixAt(tree.index, hidden);
    for (let crownIndex = 0; crownIndex < 3; crownIndex += 1) tree.crowns.setMatrixAt(tree.index * 3 + crownIndex, hidden);
    if (tree.roots) tree.roots.instanceMatrix.needsUpdate = true;
    tree.trunks.instanceMatrix.needsUpdate = true;
    tree.crowns.instanceMatrix.needsUpdate = true;
    if (tree.silhouettes) tree.silhouettes.instanceMatrix.needsUpdate = true;
  }

  private updateFishSchools(time: number, player: Vec3Like): void {
    const maxDistance = 190 * this.streamingDistanceFactor;
    const maxDistanceSquared = maxDistance * maxDistance;
    for (const school of this.fishSchools) {
      const visible = distanceSquaredXZ(school.home, player) <= maxDistanceSquared;
      school.object.visible = visible;
      if (!visible) continue;
      const angle = school.phase + time * school.speed;
      school.object.position.set(
        school.home.x + Math.cos(angle) * school.orbitRadius,
        school.home.y + Math.sin(time * 0.7 + school.phase) * 0.28,
        school.home.z + Math.sin(angle) * school.orbitRadius,
      );
      school.object.rotation.y = -angle;
      school.object.children.forEach((fish, index) => {
        const baseY = typeof fish.userData.baseY === "number" ? fish.userData.baseY : 0;
        const phase = typeof fish.userData.swimPhase === "number" ? fish.userData.swimPhase : index;
        fish.position.y = baseY + Math.sin(time * 1.8 + phase) * 0.12;
        fish.rotation.z = Math.sin(time * 2.5 + phase) * 0.055;
      });
    }
  }

  private updateStreaming(player: Vec3Like): void {
    for (const entity of this.entities.values()) {
      if (!entity.available) {
        entity.object.visible = false;
        continue;
      }
      if (entity.instancedTree) continue;
      const baseDistance = entity.kind === "palm"
        ? 220
        : entity.kind === "raft" || entity.kind === "death_pack" || entity.kind === "building"
          ? 260
          : entity.kind === "shark"
            ? 150
            : entity.kind === "freshwater" || entity.kind === "brackwater" || entity.kind === "wreck_chest"
              ? 180
              : isWildlifeKind(entity.kind)
                ? 125
              : entity.kind === "crab"
                ? 90
                : 80;
      const maxDistance = baseDistance * this.streamingDistanceFactor;
      entity.object.visible = distanceSquaredXZ(entity.object.position, player) <= maxDistance * maxDistance;
    }
    for (const scenery of this.streamedScenery) {
      const maxDistance = scenery.distance * this.streamingDistanceFactor;
      scenery.object.visible = distanceSquaredXZ(scenery.center, player) <= maxDistance * maxDistance;
    }
  }

  private updateRaftVisual(): void {
    if (!this.raft) return;
    const pose = this.physics.getRaftPose(this.raft.id);
    if (!pose) return;
    this.raftObject.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.raftObject.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
    this.raft.position = { ...pose.position };
    this.raft.rotation = { ...pose.rotation };
  }

  private getHutPlacement(type: HutBuildableId, rawPosition: Vector3, requestedRotationY: number): BuildPlacement {
    const quarterTurn = snapQuarterTurn(requestedRotationY);
    if (type === "hut_foundation") {
      const snapped = this.snapFoundationPosition(rawPosition);
      const terrainHeights = this.getFoundationTerrainHeights(snapped, quarterTurn);
      const highest = Math.max(...terrainHeights);
      const lowest = Math.min(...terrainHeights);
      snapped.y = highest + 0.12;
      const duplicate = [...this.buildings.values()].some((building) =>
        building.type === "hut_foundation" && distanceSquaredXZ(building.position, snapped) < 1,
      );
      const blocked = [...this.buildings.values()].some((building) =>
        !isHutBuildable(building.type) && distanceSquaredXZ(building.position, snapped) < 5.3,
      );
      const valid = lowest > 0.12 && highest - lowest <= 2.4 && !duplicate && !blocked;
      const reason = lowest <= 0.12
        ? "Fundamente brauchen festen Inselboden."
        : highest - lowest > 2.4
          ? "Das Gefälle ist selbst für Stützpfeiler zu groß."
          : duplicate
            ? "Hier steht bereits ein Fundament."
            : blocked
              ? "Der Platz für das Fundament ist blockiert."
              : "";
      return { position: snapped, rotationY: quarterTurn, valid, reason };
    }

    const foundations = [...this.buildings.values()].filter((building) => building.type === "hut_foundation");
    if (foundations.length === 0) {
      return { position: rawPosition, rotationY: quarterTurn, valid: false, reason: "Baue zuerst ein Hüttenfundament." };
    }

    if (type === "hut_roof") {
      const nearest = foundations
        .map((foundation) => ({ foundation, distance: distanceSquaredXZ(foundation.position, rawPosition) }))
        .sort((a, b) => a.distance - b.distance)[0]!;
      const position = new Vector3(
        nearest.foundation.position.x,
        nearest.foundation.position.y + HUT_WALL_HEIGHT,
        nearest.foundation.position.z,
      );
      const occupied = [...this.buildings.values()].some((building) =>
        building.type === "hut_roof" && distanceSquaredXZ(building.position, position) < 0.5,
      );
      const inRange = nearest.distance <= 12.25;
      return {
        position,
        rotationY: nearest.foundation.rotationY,
        valid: inRange && !occupied,
        reason: !inRange ? "Ziele auf das Fundament, das ein Dach erhalten soll." : occupied ? "Dieses Fundament hat bereits ein Dach." : "",
      };
    }

    const edgeCandidates = foundations.flatMap((foundation) => this.getFoundationEdgeCandidates(foundation));
    const nearest = edgeCandidates
      .map((candidate) => ({ ...candidate, distance: distanceSquaredXZ(candidate.position, rawPosition) }))
      .sort((a, b) => a.distance - b.distance)[0]!;
    const occupied = [...this.buildings.values()].some((building) =>
      (building.type === "hut_wall" || building.type === "hut_doorway")
      && distanceSquaredXZ(building.position, nearest.position) < 0.18,
    );
    const inRange = nearest.distance <= 10.24;
    return {
      position: nearest.position,
      rotationY: nearest.rotationY,
      valid: inRange && !occupied,
      reason: !inRange ? "Ziele auf eine freie Fundamentkante." : occupied ? "An dieser Kante ist bereits ein Bauteil eingerastet." : "",
    };
  }

  private snapFoundationPosition(rawPosition: Vector3): Vector3 {
    let best: { position: Vector3; distance: number } | null = null;
    for (const foundation of this.buildings.values()) {
      if (foundation.type !== "hut_foundation") continue;
      for (const offset of [
        new Vector3(HUT_MODULE_SIZE, 0, 0),
        new Vector3(-HUT_MODULE_SIZE, 0, 0),
        new Vector3(0, 0, HUT_MODULE_SIZE),
        new Vector3(0, 0, -HUT_MODULE_SIZE),
      ]) {
        offset.applyAxisAngle(new Vector3(0, 1, 0), foundation.rotationY);
        const position = new Vector3(foundation.position.x + offset.x, 0, foundation.position.z + offset.z);
        const distance = distanceSquaredXZ(position, rawPosition);
        if (!best || distance < best.distance) best = { position, distance };
      }
    }
    if (best && best.distance <= 5.29) return best.position;
    return new Vector3(Math.round(rawPosition.x * 2) / 2, 0, Math.round(rawPosition.z * 2) / 2);
  }

  private getFoundationEdgeCandidates(foundation: BuildingState): Array<{ position: Vector3; rotationY: number }> {
    return [
      { offset: new Vector3(0, 0, -HUT_HALF_SIZE), rotation: foundation.rotationY },
      { offset: new Vector3(0, 0, HUT_HALF_SIZE), rotation: foundation.rotationY },
      { offset: new Vector3(HUT_HALF_SIZE, 0, 0), rotation: foundation.rotationY + Math.PI / 2 },
      { offset: new Vector3(-HUT_HALF_SIZE, 0, 0), rotation: foundation.rotationY + Math.PI / 2 },
    ].map(({ offset, rotation }) => {
      offset.applyAxisAngle(new Vector3(0, 1, 0), foundation.rotationY);
      return {
        position: new Vector3(foundation.position.x + offset.x, foundation.position.y, foundation.position.z + offset.z),
        rotationY: snapQuarterTurn(rotation),
      };
    });
  }

  private getFoundationTerrainHeights(position: Vec3Like, rotationY: number): number[] {
    const sampleOffsets = [
      [0, 0],
      [-HUT_SUPPORT_INSET, -HUT_SUPPORT_INSET],
      [HUT_SUPPORT_INSET, -HUT_SUPPORT_INSET],
      [HUT_SUPPORT_INSET, HUT_SUPPORT_INSET],
      [-HUT_SUPPORT_INSET, HUT_SUPPORT_INSET],
      [0, -HUT_SUPPORT_INSET],
      [HUT_SUPPORT_INSET, 0],
      [0, HUT_SUPPORT_INSET],
      [-HUT_SUPPORT_INSET, 0],
    ] as const;
    const cosine = Math.cos(rotationY);
    const sine = Math.sin(rotationY);
    return sampleOffsets.map(([localX, localZ]) => {
      const worldX = position.x + localX * cosine + localZ * sine;
      const worldZ = position.z - localX * sine + localZ * cosine;
      return this.heightAt(worldX, worldZ);
    });
  }

  private getFoundationSupportDepths(position: Vec3Like, rotationY: number): FoundationSupportDepths {
    const heights = this.getFoundationTerrainHeights(position, rotationY).slice(1, 5);
    return heights.map((height) => clamp(position.y - HUT_FOUNDATION_THICKNESS - height + 0.12, 0.28, 2.75)) as unknown as FoundationSupportDepths;
  }

  private addBuildingCollider(type: BuildingState["type"], position: Vec3Like, rotationY: number): void {
    if (type === "campfire") return;
    if (type === "hut_foundation") {
      this.physics.addFixedCuboid(
        { x: position.x, y: position.y - HUT_FOUNDATION_THICKNESS / 2, z: position.z },
        { x: HUT_HALF_SIZE, y: HUT_FOUNDATION_THICKNESS / 2, z: HUT_HALF_SIZE },
        rotationY,
      );
      return;
    }
    if (type === "hut_wall") {
      this.physics.addFixedCuboid(
        { x: position.x, y: position.y + HUT_WALL_HEIGHT / 2, z: position.z },
        { x: HUT_HALF_SIZE, y: HUT_WALL_HEIGHT / 2, z: 0.12 },
        rotationY,
      );
      return;
    }
    if (type === "hut_doorway") {
      const cosine = Math.cos(rotationY);
      const sine = Math.sin(rotationY);
      for (const localX of [-1.72, 1.72]) {
        this.physics.addFixedCuboid(
          { x: position.x + localX * cosine, y: position.y + HUT_WALL_HEIGHT / 2, z: position.z - localX * sine },
          { x: 0.28, y: HUT_WALL_HEIGHT / 2, z: 0.16 },
          rotationY,
        );
      }
      return;
    }
    if (type === "hut_roof") return;
    const size = type === "shelter"
      ? { x: 1.6, y: 1.1, z: 1.3 }
      : type === "bed"
        ? { x: 0.85, y: 0.35, z: 1.35 }
        : type === "chest"
          ? { x: 0.7, y: 0.55, z: 0.5 }
          : { x: 1, y: 0.7, z: 0.65 };
    this.physics.addFixedCuboid({ x: position.x, y: position.y + size.y, z: position.z }, size, rotationY);
  }

  private overlapsBuilding(position: Vec3Like, radius: number): boolean {
    for (const building of this.buildings.values()) {
      if (distanceSquaredXZ(position, building.position) < radius * radius) return true;
    }
    return false;
  }

  private removeEntity(entity: WorldEntity): void {
    if (!entity.available) return;
    entity.available = false;
    entity.object.visible = false;
    if (entity.fireObject) {
      entity.object.remove(entity.fireObject);
      delete entity.fireObject;
      entity.burningSeconds = 0;
    }
    if (entity.instancedTree) this.hideInstancedTree(entity.instancedTree);
    if (entity.collider) this.physics.removeColliderBody(entity.collider);
    this.removedEntityIds.add(entity.id);
    if (!this.removedEntityDays.has(entity.id)) this.removedEntityDays.set(entity.id, this.currentDay);
  }

  private markSignalBeaconActivated(entity: WorldEntity): void {
    entity.available = false;
    entity.object.visible = true;
    const flame = entity.object.getObjectByName("signal-beacon-flame");
    if (flame) flame.visible = true;
    this.removedEntityIds.add(entity.id);
    if (!this.removedEntityDays.has(entity.id)) this.removedEntityDays.set(entity.id, this.currentDay);
  }

  private spawnLooseLoot(origin: Vector3, loot: readonly LootStack[]): string[] {
    const ids: string[] = [];
    let angleOffset = 0;
    for (const stack of loot) {
      const count = Math.floor(stack.count);
      if (!Number.isFinite(count) || count <= 0) continue;
      const position = origin.clone().add(new Vector3(Math.cos(angleOffset) * 1.2, 0, Math.sin(angleOffset) * 1.2));
      position.y = this.heightAt(position.x, position.z) + 0.16;
      const id = this.nextDynamicDropId();
      this.createDynamicDrop({ id, itemId: stack.itemId, count, position });
      ids.push(id);
      angleOffset += 1.7;
    }
    return ids;
  }

  private createDynamicDrop(drop: DynamicDropState): void {
    const count = Math.floor(drop.count);
    if (!drop.id || !Number.isFinite(count) || count <= 0 || this.entities.has(drop.id)) return;
    const object = createResourceVisual(drop.itemId, this.assets);
    object.position.set(drop.position.x, drop.position.y, drop.position.z);
    object.userData.entityId = drop.id;
    this.scene.add(object);
    this.interactiveObjects.push(object);
    this.entities.set(drop.id, {
      id: drop.id,
      kind: drop.itemId,
      object,
      available: true,
      amount: count,
      hitPoints: 1,
      maxHitPoints: 1,
      cooldown: 0,
      dynamicDrop: true,
    });
    this.dynamicDropIds.add(drop.id);
    this.reserveEntityCounter(drop.id);
  }

  private nextDynamicDropId(): string {
    let id: string;
    do id = `drop-${++this.entityCounter}`;
    while (this.entities.has(id) || this.removedEntityIds.has(id));
    return id;
  }

  private reserveEntityCounter(id: string): void {
    const match = /^(?:drop|building|death-pack)-(\d+)$/.exec(id);
    if (!match) return;
    const value = Number(match[1]);
    if (Number.isSafeInteger(value)) this.entityCounter = Math.max(this.entityCounter, value);
  }

  private replenishDaily(day: number): void {
    for (const entity of this.entities.values()) {
      if (entity.available) continue;
      if (entity.dynamicDrop) continue;
      const removedDay = this.removedEntityDays.get(entity.id) ?? 1;
      const fiberOrCrabReady = (entity.kind === "fiber" || entity.kind === "crab") && day - removedDay >= 1;
      const herbReady = (entity.kind === "healing_herb" || entity.kind === "wildflower") && day - removedDay >= 2;
      const fruitReady = (entity.kind === "coconut" || entity.kind === "mango") && day - removedDay >= 2;
      const wildlifeReady = isWildlifeKind(entity.kind) && day - removedDay >= 3;
      if (fiberOrCrabReady || herbReady || fruitReady || wildlifeReady) {
        entity.available = true;
        entity.object.visible = true;
        entity.hitPoints = entity.maxHitPoints;
        this.removedEntityIds.delete(entity.id);
        this.removedEntityDays.delete(entity.id);
        if (wildlifeReady) {
          entity.wildlifeState = "wandering";
          entity.wildlifeProvoked = false;
          this.setEntityAnimation(entity, "Idle");
        }
      }
    }
    this.spawnDailyWashups(day);
  }

  private spawnDailyWashups(day: number): void {
    const random = new SeededRandom(WORLD_SEED ^ Math.imul(day, 0x9e3779b1));
    const definition = WORLD_MANIFEST.islands[(day - 1) % WORLD_MANIFEST.islands.length] ?? WORLD_MANIFEST.islands[0];
    const island = {
      id: definition.id,
      centerX: definition.positionMeters.x,
      centerZ: definition.positionMeters.z,
      radius: definition.dimensions.widthMeters * 0.43,
      zScale: definition.dimensions.depthMeters / definition.dimensions.widthMeters,
    };
    const washups: ReadonlyArray<{ kind: ItemId; count: number }> = [
      { kind: "stick", count: 3 },
      { kind: "stone", count: 2 },
      { kind: "palm_log", count: 1 },
    ];
    for (const washup of washups) {
      for (let index = 0; index < washup.count; index += 1) {
        const id = `washup-${day}-${island.id}-${washup.kind}-${index}`;
        if (this.entities.has(id) || this.removedEntityIds.has(id)) continue;
        const angle = random.range(0, Math.PI * 2);
        const radius = island.radius + random.range(-1.5, 1.5);
        const x = island.centerX + Math.cos(angle) * radius;
        const z = island.centerZ + Math.sin(angle) * radius * island.zScale;
        const object = createResourceVisual(washup.kind, this.assets);
        object.position.set(x, this.heightAt(x, z) + 0.16, z);
        object.rotation.y = random.range(0, Math.PI * 2);
        object.userData.entityId = id;
        this.scene.add(object);
        this.interactiveObjects.push(object);
        this.entities.set(id, {
          id,
          kind: washup.kind,
          object,
          available: true,
          amount: 1,
          hitPoints: 1,
          maxHitPoints: 1,
          cooldown: 0,
        });
      }
    }
  }
}

export function createBuildVisual(type: BuildableId, assets: AssetService, foundationSupportDepths?: FoundationSupportDepths): Group {
  if (type === "hut_foundation") return createHutFoundationVisual(assets, foundationSupportDepths);
  if (type === "hut_wall") return createHutWallVisual(assets);
  if (type === "hut_doorway") return createHutDoorwayVisual(assets);
  if (type === "hut_roof") return createHutRoofVisual(assets);
  if (type === "rain_collector") return createRainCollectorVisual(assets);
  if (type === "fish_trap") return createFishTrapVisual(assets);
  if (type === "smoking_rack") return createSmokingRackVisual(assets);
  if (type === "bed") {
    const bed = createCombinedAssetVisual(
      ["survival.bedroll-frame", "survival.bedroll"],
      assets,
      0.72,
    );
    if (bed) return bed;
  }
  const loadedId = type === "campfire"
    ? "survival.campfire-pit"
    : type === "shelter"
      ? "survival.tent-canvas"
      : type === "chest"
        ? "survival.chest"
        : type === "workbench"
          ? "survival.workbench"
          : null;
  const loaded = loadedId ? assets.createModel(loadedId) : null;
  if (loaded) {
    const targetHeight = type === "shelter" ? 2.4 : type === "workbench" ? 1.3 : type === "chest" ? 1.05 : 0.7;
    const wrapper = new Group();
    normalizeHeight(loaded, targetHeight);
    wrapper.add(loaded);
    if (type === "campfire") wrapper.add(createCampfireFlame());
    return wrapper;
  }
  if (type === "campfire") return createCampfireVisual();
  if (type === "shelter") return createShelterVisual();
  if (type === "bed") return createBedVisual();
  if (type === "chest") return createChestVisual();
  if (type === "workbench") return createWorkbenchVisual();
  if (type === "palm_still") return createStillVisual();
  return createRaftVisual(type === "raft_deck");
}

function createHutFoundationVisual(assets: AssetService, supportDepths: FoundationSupportDepths = [0.65, 0.65, 0.65, 0.65]): Group {
  const root = new Group();
  const floor = assets.createModel("survival.structure-floor");
  if (floor) {
    fitModelToBox(floor, HUT_MODULE_SIZE, HUT_FOUNDATION_THICKNESS, HUT_MODULE_SIZE);
    floor.position.y -= HUT_FOUNDATION_THICKNESS;
    root.add(floor);
  } else {
    const fallback = new Mesh(
      new BoxGeometry(HUT_MODULE_SIZE, HUT_FOUNDATION_THICKNESS, HUT_MODULE_SIZE),
      new MeshStandardMaterial({ color: 0x80603a, roughness: 0.96 }),
    );
    fallback.position.y = -HUT_FOUNDATION_THICKNESS / 2;
    root.add(fallback);
  }

  const postMaterial = new MeshStandardMaterial({ color: 0x5d3e24, roughness: 1 });
  const corners = [
    [-HUT_SUPPORT_INSET, -HUT_SUPPORT_INSET],
    [HUT_SUPPORT_INSET, -HUT_SUPPORT_INSET],
    [HUT_SUPPORT_INSET, HUT_SUPPORT_INSET],
    [-HUT_SUPPORT_INSET, HUT_SUPPORT_INSET],
  ] as const;
  corners.forEach(([x, z], index) => {
    const depth = supportDepths[index] ?? 0.65;
    const post = new Mesh(new CylinderGeometry(0.12, 0.17, depth, 7), postMaterial);
    post.position.set(x, -HUT_FOUNDATION_THICKNESS - depth / 2 + 0.1, z);
    post.castShadow = true;
    root.add(post);
  });

  const cutMaterial = new MeshStandardMaterial({ color: 0x4c3524, roughness: 1 });
  for (const [x, z, width, depth] of [
    [0, -2.04, 3.86, 0.1],
    [0, 2.04, 3.86, 0.1],
    [-2.04, 0, 0.1, 3.86],
    [2.04, 0, 0.1, 3.86],
  ] as const) {
    const cutEdge = new Mesh(new BoxGeometry(width, 0.38, depth), cutMaterial);
    cutEdge.position.set(x, -0.27, z);
    cutEdge.receiveShadow = true;
    root.add(cutEdge);
  }
  return root;
}

function createHutWallVisual(assets: AssetService): Group {
  const root = new Group();
  const structure = assets.createModel("survival.structure");
  if (structure) {
    fitModelToBox(structure, HUT_MODULE_SIZE, HUT_WALL_HEIGHT, 0.28);
    root.add(structure);
  }
  const panel = new Mesh(
    new BoxGeometry(3.38, 1.92, 0.12),
    new MeshStandardMaterial({ color: 0x9f8855, roughness: 1, side: DoubleSide }),
  );
  panel.position.y = 1.22;
  panel.castShadow = true;
  panel.receiveShadow = true;
  root.add(panel);
  const bindingMaterial = new MeshStandardMaterial({ color: 0x5c4127, roughness: 1 });
  for (const y of [0.42, 1.22, 2.02]) {
    const binding = new Mesh(new BoxGeometry(3.56, 0.08, 0.17), bindingMaterial);
    binding.position.y = y;
    root.add(binding);
  }
  return root;
}

function createHutDoorwayVisual(assets: AssetService): Group {
  const root = new Group();
  const doorway = assets.createModel("survival.fence-doorway");
  if (doorway) {
    fitModelToBox(doorway, HUT_MODULE_SIZE, HUT_WALL_HEIGHT, 0.3);
    root.add(doorway);
    return root;
  }
  const wood = new MeshStandardMaterial({ color: 0x654529, roughness: 1 });
  for (const x of [-1.72, 1.72]) {
    const post = new Mesh(new BoxGeometry(0.34, HUT_WALL_HEIGHT, 0.28), wood);
    post.position.set(x, HUT_WALL_HEIGHT / 2, 0);
    root.add(post);
  }
  const header = new Mesh(new BoxGeometry(HUT_MODULE_SIZE, 0.34, 0.28), wood);
  header.position.y = HUT_WALL_HEIGHT - 0.17;
  root.add(header);
  return root;
}

function createHutRoofVisual(assets: AssetService): Group {
  const root = new Group();
  const roof = assets.createModel("survival.structure-roof");
  if (roof) {
    fitModelToBox(roof, HUT_MODULE_SIZE + 0.45, 1.25, HUT_MODULE_SIZE + 0.45);
    root.add(roof);
  }
  const material = new MeshStandardMaterial({ color: 0x667744, roughness: 1, side: DoubleSide });
  for (const direction of [-1, 1]) {
    const half = new Mesh(new BoxGeometry(HUT_MODULE_SIZE + 0.5, 0.14, HUT_HALF_SIZE + 0.34), material);
    half.position.set(0, 0.66, direction * 1.02);
    half.rotation.x = direction * -0.48;
    half.castShadow = true;
    half.receiveShadow = true;
    root.add(half);
  }
  return root;
}

function createCombinedAssetVisual(ids: readonly string[], assets: AssetService, targetHeight: number): Group | null {
  const combined = new Group();
  for (const id of ids) {
    const model = assets.createModel(id);
    if (model) combined.add(model);
  }
  if (combined.children.length === 0) return null;
  normalizeHeight(combined, targetHeight);
  const wrapper = new Group();
  wrapper.add(combined);
  return wrapper;
}

function islandHeightAt(x: number, z: number, island: WorldIslandManifest): number {
  const rawHeight = rawIslandHeightAt(x, z, island);
  if (rawHeight <= -7.9) return rawHeight;
  return carveFreshwaterTerrain(x, z, island, rawHeight);
}

function rawIslandHeightAt(x: number, z: number, island: WorldIslandManifest): number {
  const dx = x - island.positionMeters.x;
  const dz = z - island.positionMeters.z;
  const radiusX = island.dimensions.widthMeters * 0.5;
  const radiusZ = island.dimensions.depthMeters * 0.5;
  const seed = ISLAND_TERRAIN_SEEDS[island.id];
  const warp = fbm2D(x * 0.025, z * 0.025, seed, 3) * (
    island.archetype === "rock-reef" || island.archetype === "volcanic" ? 0.15 : 0.09
  );
  const normalized = Math.sqrt((dx / radiusX) ** 2 + (dz / radiusZ) ** 2) + warp;
  if (normalized >= 1.08) return -8;
  if (island.isStart) return startIslandHeightAt(x, z, island, normalized, seed);
  if (island.archetype === "crescent-cliffs") {
    const coveDistance = Math.hypot(
      (dx / radiusX + 0.72) / 0.45,
      (dz / radiusZ) / 0.58,
    );
    if (coveDistance < 1) {
      const coveNoise = fbm2D(x * 0.07, z * 0.07, seed + 303, 2) * 0.08;
      return -1.35 + coveDistance * 0.18 + coveNoise;
    }
  }
  if (island.id === "dschungelberg") {
    const landingDistance = Math.hypot(dx - island.safeLanding.offsetMeters.x, dz - island.safeLanding.offsetMeters.z);
    if (landingDistance < 24 * Math.max(islandLayoutScale(island).x, islandLayoutScale(island).z)) {
      const landingNoise = fbm2D(x * 0.09, z * 0.09, seed + 501, 2) * 0.08;
      return 0.78 + landingNoise;
    }
  }
  if (normalized >= 0.92) return -8 + (1.08 - normalized) / 0.16 * 7.4;
  if (normalized >= 0.79) return -0.6 + (0.92 - normalized) / 0.13 * 1.25;

  if (island.archetype === "palm-lagoon") {
    const lagoonNoise = fbm2D(x * 0.08, z * 0.08, seed + 9, 2) * 0.08;
    const lagoonWarp = fbm2D(x * 0.035, z * 0.035, seed + 211, 3) * 0.075;
    const lagoonDistance = Math.hypot(dx / (radiusX * 0.31), dz / (radiusZ * 0.27)) + lagoonWarp;
    if (lagoonDistance < 1) return -1.28 + lagoonNoise + lagoonDistance * 0.12;
    const channelDistance = distanceToWatercourse(dx, dz, palmLagoonChannelPoints(island));
    if (channelDistance < 1) return -0.72 + lagoonNoise + channelDistance * 0.18;
  }

  if (island.archetype === "mangrove-bay") {
    const channelDistance = Math.min(...mangroveChannelPaths(island).map((path) => distanceToWatercourse(dx, dz, path)));
    if (channelDistance < 1) return -0.68 + channelDistance * 0.19;
    const lagoon = mangroveEastLagoon(island);
    const lagoonDistance = Math.hypot((dx - lagoon.x) / lagoon.radiusX, (dz - lagoon.z) / lagoon.radiusZ);
    if (lagoonDistance < 1) return -0.62 + lagoonDistance * 0.16;
  }

  const interior = 1 - normalized / 0.79;
  const roughness = island.terrainProfile.roughness === "low" ? 0.55 : island.terrainProfile.roughness === "medium" ? 1 : 1.55;
  const noise = fbm2D(x * 0.045, z * 0.045, seed + 77, 4) * roughness;
  const peak = island.terrainProfile.maximumHeightMeters - 0.65;
  const structure = ISLAND_TERRAIN_STRUCTURES[island.id];
  const baseFactor = structure?.baseHeightFactor ?? 0.22;
  const interiorMask = smoothstep(0.02, 0.3, interior);
  const normalizedX = dx / radiusX;
  const normalizedZ = dz / radiusZ;
  const landingDistance = Math.hypot(dx - island.safeLanding.offsetMeters.x, dz - island.safeLanding.offsetMeters.z);
  const landingScale = Math.max(islandLayoutScale(island).x, islandLayoutScale(island).z);
  const featureBlend = smoothstep(27 * landingScale, 45 * landingScale, landingDistance);
  let height = 0.65
    + Math.pow(Math.max(0, interior), 1.28) * peak * baseFactor
    + noise * (0.22 + interior * 1.05);

  if (structure) {
    let riseHeight = 0;
    for (const rise of structure.rises) {
      const distance = Math.hypot(
        (normalizedX - rise.x) / rise.radiusX,
        (normalizedZ - rise.z) / rise.radiusZ,
      );
      if (distance >= 1) continue;
      const falloff = 1 - smoothstep(0, 1, distance);
      riseHeight = Math.max(riseHeight, rise.height * Math.pow(falloff, rise.power ?? 1.15));
    }
    height += riseHeight * interiorMask * featureBlend;

    if (structure.terraceBlend > 0 && height > 1.2) {
      const terracePosition = height / structure.terraceStep;
      const terraceBase = Math.floor(terracePosition);
      const roundedFraction = smoothstep(0.2, 0.8, terracePosition - terraceBase);
      const terracedHeight = (terraceBase + roundedFraction) * structure.terraceStep;
      height += (terracedHeight - height) * structure.terraceBlend * interiorMask;
    }

    let gorgeDepth = 0;
    for (const gorge of structure.gorges) {
      const distance = distanceToSegment2D(
        normalizedX,
        normalizedZ,
        gorge.fromX,
        gorge.fromZ,
        gorge.toX,
        gorge.toZ,
      );
      if (distance >= gorge.width) continue;
      gorgeDepth = Math.max(gorgeDepth, gorge.depth * (1 - smoothstep(gorge.width * 0.28, gorge.width, distance)));
    }
    height -= gorgeDepth * interiorMask * featureBlend;
  }

  const ridgeNoise = Math.max(0, Math.abs(fbm2D(x * 0.021, z * 0.033, seed + 211, 3)) - 0.28);
  height += ridgeNoise * interior * (
    island.archetype === "mountain-jungle" ? 7.5
      : island.archetype === "volcanic" ? 1.5
        : island.archetype === "crescent-cliffs" ? 4.8
          : island.hasJungle ? 3.8
            : 2.8
  );
  if (island.archetype === "volcanic") {
    const platformDistance = Math.hypot(
      (dx - VOLCANO_LANDMARK.localX) / VOLCANO_LANDMARK.plateauRadiusX,
      (dz - VOLCANO_LANDMARK.localZ) / VOLCANO_LANDMARK.plateauRadiusZ,
    );
    const terrainBlend = smoothstep(0.82, 1.28, platformDistance);
    height = VOLCANO_LANDMARK.plateauHeight * (1 - terrainBlend) + height * terrainBlend;
  }
  if (island.archetype === "mangrove-bay") height = Math.min(height, 6.8);
  height = Math.max(island.archetype === "mangrove-bay" || island.archetype === "palm-lagoon" ? 0.12 : 0.35, height);
  return Math.min(height, island.terrainProfile.maximumHeightMeters + 2.5);
}

function startIslandHeightAt(x: number, z: number, island: WorldIslandManifest, normalized: number, seed: number): number {
  if (normalized >= 0.92) return -8 + (1.08 - normalized) / 0.16 * 7.4;
  if (normalized >= 0.79) return -0.6 + (0.92 - normalized) / 0.13 * 1.25;
  const interior = 1 - normalized / 0.79;
  const noise = fbm2D(x * 0.045, z * 0.045, seed + 77, 4) * 0.55;
  const peak = island.terrainProfile.maximumHeightMeters - 0.65;
  return Math.min(
    0.65 + Math.pow(Math.max(0, interior), 1.65) * peak + noise * (0.25 + interior * 1.2),
    island.terrainProfile.maximumHeightMeters + 2.5,
  );
}

function resolveFreshwaterBasin(
  definition: FreshwaterBasinDefinition,
  island: WorldIslandManifest,
): ResolvedFreshwaterBasin {
  const cached = FRESHWATER_BASIN_CACHE.get(definition.id);
  if (cached) return cached;
  const radiusX = island.dimensions.widthMeters * 0.5;
  const radiusZ = island.dimensions.depthMeters * 0.5;
  const layoutScale = islandLayoutScale(island);
  const x = definition.normalizedX * radiusX;
  const z = definition.normalizedZ * radiusZ;
  const basinRadiusX = definition.radiusX * layoutScale.x;
  const basinRadiusZ = definition.radiusZ * layoutScale.z;
  if (definition.fixedSurfaceY !== undefined) {
    const resolved = { x, z, radiusX: basinRadiusX, radiusZ: basinRadiusZ, surfaceY: definition.fixedSurfaceY };
    FRESHWATER_BASIN_CACHE.set(definition.id, resolved);
    return resolved;
  }
  let lowestRim = rawIslandHeightAt(island.positionMeters.x + x, island.positionMeters.z + z, island);
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    lowestRim = Math.min(lowestRim, rawIslandHeightAt(
      island.positionMeters.x + x + Math.cos(angle) * basinRadiusX * 1.08,
      island.positionMeters.z + z + Math.sin(angle) * basinRadiusZ * 1.08,
      island,
    ));
  }
  const resolved = {
    x,
    z,
    radiusX: basinRadiusX,
    radiusZ: basinRadiusZ,
    surfaceY: Math.max(0.42, lowestRim - definition.surfaceInset),
  };
  FRESHWATER_BASIN_CACHE.set(definition.id, resolved);
  return resolved;
}

function resolveWatercoursePoints(
  definition: WatercourseDefinition,
  island: WorldIslandManifest,
): ResolvedWatercoursePoint[] {
  const radiusX = island.dimensions.widthMeters * 0.5;
  const radiusZ = island.dimensions.depthMeters * 0.5;
  const layoutScale = islandLayoutScale(island);
  const widthScale = (layoutScale.x + layoutScale.z) * 0.5;
  const points = definition.points.map((point) => {
    const x = point.x * radiusX;
    const z = point.z * radiusZ;
    return {
      x,
      z,
      width: point.width * widthScale,
      surfaceY: rawIslandHeightAt(island.positionMeters.x + x, island.positionMeters.z + z, island) - definition.depth * 0.16,
    };
  });
  for (let index = 1; index < points.length; index += 1) {
    points[index]!.surfaceY = Math.min(points[index]!.surfaceY, points[index - 1]!.surfaceY - 0.025);
  }
  return points;
}

function resolveWatercoursePath(
  definition: WatercourseDefinition,
  island: WorldIslandManifest,
): readonly ResolvedWatercoursePoint[] {
  const cached = WATERCOURSE_PATH_CACHE.get(definition.id);
  if (cached) return cached;
  const sampled = sampleWatercourseControlPoints(resolveWatercoursePoints(definition, island), 12);
  for (let index = 0; index < sampled.length; index += 1) {
    const point = sampled[index]!;
    const groundFollowingSurface = rawIslandHeightAt(
      island.positionMeters.x + point.x,
      island.positionMeters.z + point.z,
      island,
    ) - definition.depth * 0.16;
    point.surfaceY = index === 0
      ? groundFollowingSurface
      : Math.min(groundFollowingSurface, sampled[index - 1]!.surfaceY - 0.004);
  }
  WATERCOURSE_PATH_CACHE.set(definition.id, sampled);
  return sampled;
}

function sampleWatercourseControlPoints(
  points: readonly ResolvedWatercoursePoint[],
  samplesPerSegment: number,
): ResolvedWatercoursePoint[] {
  if (points.length < 2) return [...points];
  const curve = new CatmullRomCurve3(
    points.map(({ x, z }) => new Vector3(x, 0, z)),
    false,
    "centripetal",
    0.5,
  );
  const segments = Math.max(4, (points.length - 1) * samplesPerSegment);
  const sampled: ResolvedWatercoursePoint[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const center = curve.getPoint(t);
    const pointPosition = t * (points.length - 1);
    const fromIndex = Math.min(points.length - 2, Math.floor(pointPosition));
    const blend = pointPosition - fromIndex;
    const from = points[fromIndex]!;
    const to = points[fromIndex + 1]!;
    sampled.push({
      x: center.x,
      z: center.z,
      width: from.width + (to.width - from.width) * blend,
      surfaceY: from.surfaceY + (to.surfaceY - from.surfaceY) * blend,
    });
  }
  return sampled;
}

function freshwaterBasinShoreSeed(
  definition: FreshwaterBasinDefinition,
  island: WorldIslandManifest,
): number {
  return ISLAND_TERRAIN_SEEDS[island.id] + definition.id.length * 31;
}

function organicBasinRadiusFactor(angle: number, seed: number): number {
  const phase = (seed % 997) * 0.017;
  return clamp(
    1
      + Math.sin(angle * 2 + phase) * 0.075
      + Math.sin(angle * 3 - phase * 1.37) * 0.045
      + Math.sin(angle * 5 + phase * 0.73) * 0.026
      + Math.sin(angle * 7 - phase * 0.41) * 0.014,
    0.84,
    1.16,
  );
}

function organicBasinDistance(
  localX: number,
  localZ: number,
  basin: { x: number; z: number; radiusX: number; radiusZ: number },
  seed: number,
): number {
  const normalizedX = (localX - basin.x) / basin.radiusX;
  const normalizedZ = (localZ - basin.z) / basin.radiusZ;
  const angle = Math.atan2(normalizedZ, normalizedX);
  return Math.hypot(normalizedX, normalizedZ) / organicBasinRadiusFactor(angle, seed);
}

function carveFreshwaterTerrain(x: number, z: number, island: WorldIslandManifest, rawHeight: number): number {
  let height = rawHeight;
  const localX = x - island.positionMeters.x;
  const localZ = z - island.positionMeters.z;
  for (const definition of FRESHWATER_BASINS) {
    if (definition.islandId !== island.id) continue;
    const basin = resolveFreshwaterBasin(definition, island);
    const distance = organicBasinDistance(localX, localZ, basin, freshwaterBasinShoreSeed(definition, island));
    if (distance >= 1.28) continue;
    const bed = basin.surfaceY
      - definition.depth * (1 - smoothstep(0.18, 0.98, distance))
      - fbm2D(x * 0.13, z * 0.13, ISLAND_TERRAIN_SEEDS[island.id] + 607, 2) * 0.06;
    const bankBlend = smoothstep(0.94, 1.28, distance);
    const carved = bed + (rawHeight - bed) * bankBlend;
    height = Math.min(height, carved);
  }

  for (const definition of WATERCOURSES) {
    if (definition.islandId !== island.id) continue;
    const sample = nearestWatercourseSample(localX, localZ, resolveWatercoursePath(definition, island));
    if (sample.distance >= 1.72) continue;
    const bed = sample.surfaceY - definition.depth * (1 - smoothstep(0.1, 0.92, sample.distance));
    const bankBlend = smoothstep(0.92, 1.72, sample.distance);
    height = Math.min(height, bed + (rawHeight - bed) * bankBlend);
  }
  return height;
}

function isInFreshwaterFeature(
  island: WorldIslandManifest,
  worldX: number,
  worldZ: number,
  padding = 0,
): boolean {
  const localX = worldX - island.positionMeters.x;
  const localZ = worldZ - island.positionMeters.z;
  for (const definition of FRESHWATER_BASINS) {
    if (definition.islandId !== island.id) continue;
    const basin = resolveFreshwaterBasin(definition, island);
    const paddedBasin = {
      ...basin,
      radiusX: basin.radiusX + padding,
      radiusZ: basin.radiusZ + padding,
    };
    const distance = organicBasinDistance(
      localX,
      localZ,
      paddedBasin,
      freshwaterBasinShoreSeed(definition, island),
    );
    if (distance < 1.2) return true;
  }
  for (const definition of WATERCOURSES) {
    if (definition.islandId !== island.id) continue;
    const points = resolveWatercoursePath(definition, island).map((point) => ({ ...point, width: point.width + padding }));
    if (distanceToWatercourse(localX, localZ, points) < 1.3) return true;
  }
  return false;
}

function palmLagoonChannelPoints(island: WorldIslandManifest): WatercoursePoint[] {
  const radiusX = island.dimensions.widthMeters * 0.5;
  const radiusZ = island.dimensions.depthMeters * 0.5;
  return [
    { x: radiusX * 0.25, z: radiusZ * 0.035, width: radiusZ * 0.046 },
    { x: radiusX * 0.34, z: radiusZ * 0.088, width: radiusZ * 0.043 },
    { x: radiusX * 0.43, z: radiusZ * 0.11, width: radiusZ * 0.041 },
    { x: radiusX * 0.52, z: radiusZ * 0.025, width: radiusZ * 0.038 },
    { x: radiusX * 0.61, z: -radiusZ * 0.025, width: radiusZ * 0.035 },
    { x: radiusX * 0.7, z: radiusZ * 0.032, width: radiusZ * 0.033 },
    { x: radiusX * 0.79, z: radiusZ * 0.07, width: radiusZ * 0.031 },
    { x: radiusX * 0.88, z: radiusZ * 0.018, width: radiusZ * 0.029 },
  ];
}

function mangroveChannelPaths(island: WorldIslandManifest): WatercoursePoint[][] {
  const radiusX = island.dimensions.widthMeters * 0.5;
  const radiusZ = island.dimensions.depthMeters * 0.5;
  const layoutScale = islandLayoutScale(island);
  const main: WatercoursePoint[] = [];
  for (let index = 0; index <= 14; index += 1) {
    const fraction = -0.86 + (index / 14) * 1.72;
    const x = fraction * radiusX;
    main.push({
      x,
      z: Math.sin(x * 0.075) * 6.5 * layoutScale.z,
      width: (3.45 + Math.sin(index * 1.37) * 0.42 + Math.abs(fraction) * 1.1) * ((layoutScale.x + layoutScale.z) * 0.5),
    });
  }
  const westStartX = -0.12 * radiusX;
  const westStartZ = Math.sin(westStartX * 0.075) * 6.5 * layoutScale.z;
  const west = [
    { x: westStartX, z: westStartZ, width: 3.5 * layoutScale.z },
    { x: -0.28 * radiusX, z: -0.18 * radiusZ, width: 3.15 * layoutScale.z },
    { x: -0.43 * radiusX, z: -0.39 * radiusZ, width: 3.65 * layoutScale.z },
    { x: -0.6 * radiusX, z: -0.6 * radiusZ, width: 4.7 * layoutScale.z },
  ];
  const lagoon = mangroveEastLagoon(island);
  const eastStartX = 0.12 * radiusX;
  const eastStartZ = Math.sin(eastStartX * 0.075) * 6.5 * layoutScale.z;
  const east = [
    { x: eastStartX, z: eastStartZ, width: 3.4 * layoutScale.z },
    { x: 0.28 * radiusX, z: 0.11 * radiusZ, width: 3 * layoutScale.z },
    { x: 0.42 * radiusX, z: 0.23 * radiusZ, width: 3.55 * layoutScale.z },
    { x: lagoon.x, z: lagoon.z, width: lagoon.radiusZ * 0.58 },
  ];
  return [main, west, east];
}

function mangroveEastLagoon(island: WorldIslandManifest): { x: number; z: number; radiusX: number; radiusZ: number } {
  const layoutScale = islandLayoutScale(island);
  return {
    x: island.dimensions.widthMeters * 0.275,
    z: island.dimensions.depthMeters * 0.15,
    radiusX: 18 * layoutScale.x,
    radiusZ: 12 * layoutScale.z,
  };
}

function distanceToWatercourse(x: number, z: number, points: readonly WatercoursePoint[]): number {
  return nearestWatercourseSample(x, z, points).distance;
}

function nearestWatercourseSample<T extends WatercoursePoint & { surfaceY?: number }>(
  x: number,
  z: number,
  points: readonly T[],
): { distance: number; surfaceY: number } {
  let closestDistance = Number.POSITIVE_INFINITY;
  let surfaceY = points[0]?.surfaceY ?? SEA_LEVEL;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const segmentX = to.x - from.x;
    const segmentZ = to.z - from.z;
    const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
    const projection = lengthSquared <= Number.EPSILON
      ? 0
      : clamp(((x - from.x) * segmentX + (z - from.z) * segmentZ) / lengthSquared, 0, 1);
    const centerX = from.x + segmentX * projection;
    const centerZ = from.z + segmentZ * projection;
    const width = from.width + (to.width - from.width) * projection;
    const distance = Math.hypot(x - centerX, z - centerZ) / Math.max(0.1, width);
    if (distance >= closestDistance) continue;
    closestDistance = distance;
    surfaceY = (from.surfaceY ?? SEA_LEVEL) + ((to.surfaceY ?? SEA_LEVEL) - (from.surfaceY ?? SEA_LEVEL)) * projection;
  }
  return { distance: closestDistance, surfaceY };
}

function distanceToSegment2D(
  pointX: number,
  pointZ: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): number {
  const segmentX = toX - fromX;
  const segmentZ = toZ - fromZ;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(pointX - fromX, pointZ - fromZ);
  const projection = clamp(((pointX - fromX) * segmentX + (pointZ - fromZ) * segmentZ) / lengthSquared, 0, 1);
  return Math.hypot(pointX - (fromX + segmentX * projection), pointZ - (fromZ + segmentZ * projection));
}

function resourceCount(island: WorldIslandManifest, sourceId: ResourceSourceId): number {
  return island.resources.find((source) => source.sourceId === sourceId)?.count ?? 0;
}

function sceneryModelHeight(assetId: string): number {
  if (assetId.includes("mushroom")) return 0.42;
  if (assetId.includes("flower")) return 0.62;
  if (assetId.includes("grass")) return 0.75;
  if (assetId.includes("plant-flat-short")) return 0.72;
  if (assetId.includes("plant-flat")) return 1.15;
  if (assetId.includes("bush")) return 1.45;
  if (assetId.includes("stump")) return 1.1;
  if (assetId.includes("rock-tall")) return 4.2;
  if (assetId.includes("rock-large")) return 2.4;
  return 0.7;
}

function isInKitLandmarkClearing(
  island: WorldIslandManifest,
  localX: number,
  localZ: number,
  padding = 0,
): boolean {
  const layoutScale = islandLayoutScale(island);
  return (KIT_LANDMARK_CLEARINGS[island.id] ?? []).some((clearing) => (
    Math.hypot(
      localX - clearing.x * layoutScale.x,
      localZ - clearing.z * layoutScale.z,
    ) < clearing.radius + padding
  ));
}

function islandLayoutScale(island: WorldIslandManifest): { x: number; z: number } {
  const original = ORIGINAL_ISLAND_DIMENSIONS[island.id];
  return {
    x: island.dimensions.widthMeters / original.widthMeters,
    z: island.dimensions.depthMeters / original.depthMeters,
  };
}

function terrainColor(target: Color, x: number, z: number, height: number, island: WorldIslandManifest): void {
  const noise = fbm2D(x * 0.04, z * 0.04, 99, 3) * 0.5 + 0.5;
  if (freshwaterTerrainColor(target, x, z, island, noise)) return;
  if (island.archetype === "volcanic" && height < -1.2) target.setRGB(0.18 + noise * 0.06, 0.17 + noise * 0.05, 0.16 + noise * 0.045);
  else if (island.archetype === "volcanic" && height < 0.82) target.setRGB(0.22 + noise * 0.06, 0.2 + noise * 0.05, 0.18 + noise * 0.04);
  else if (island.archetype === "volcanic") target.setRGB(0.2 + noise * 0.09, 0.19 + noise * 0.075, 0.18 + noise * 0.07);
  else if (height < -1.2) target.setRGB(0.52 + noise * 0.13, 0.44 + noise * 0.11, 0.26 + noise * 0.08);
  else if (height < 0.82) target.setRGB(0.66 + noise * 0.12, 0.55 + noise * 0.11, 0.3 + noise * 0.08);
  else if (island.archetype === "rock-reef") target.setRGB(0.34 + noise * 0.12, 0.35 + noise * 0.11, 0.33 + noise * 0.1);
  else if (island.archetype === "mangrove-bay") target.setRGB(0.2 + noise * 0.08, 0.3 + noise * 0.1, 0.12 + noise * 0.05);
  else if (island.archetype === "palm-lagoon") target.setRGB(0.35 + noise * 0.11, 0.56 + noise * 0.13, 0.19 + noise * 0.05);
  else if (island.archetype === "flower-meadow") target.setRGB(0.34 + noise * 0.1, 0.58 + noise * 0.13, 0.2 + noise * 0.05);
  else if (island.archetype === "crescent-cliffs" && height > 8) target.setRGB(0.6 + noise * 0.12, 0.61 + noise * 0.1, 0.56 + noise * 0.09);
  else if (island.archetype === "crescent-cliffs") target.setRGB(0.38 + noise * 0.1, 0.5 + noise * 0.11, 0.24 + noise * 0.06);
  else if (island.archetype === "mountain-jungle" && height > 23) target.setRGB(0.28 + noise * 0.1, 0.31 + noise * 0.09, 0.28 + noise * 0.08);
  else if (height > 12) target.setRGB(0.18 + noise * 0.08, 0.29 + noise * 0.09, 0.17 + noise * 0.04);
  else if (island.hasJungle) target.setRGB(0.12 + noise * 0.09, 0.32 + noise * 0.16, 0.13 + noise * 0.07);
  else target.setRGB(0.29 + noise * 0.11, 0.47 + noise * 0.12, 0.16 + noise * 0.05);
}

function freshwaterTerrainColor(
  target: Color,
  worldX: number,
  worldZ: number,
  island: WorldIslandManifest,
  noise: number,
): boolean {
  const localX = worldX - island.positionMeters.x;
  const localZ = worldZ - island.positionMeters.z;
  for (const definition of FRESHWATER_BASINS) {
    if (definition.islandId !== island.id) continue;
    const basin = resolveFreshwaterBasin(definition, island);
    const distance = organicBasinDistance(
      localX,
      localZ,
      basin,
      freshwaterBasinShoreSeed(definition, island),
    );
    if (distance >= 1.24) continue;
    if (distance < 0.9) target.setRGB(0.19 + noise * 0.07, 0.25 + noise * 0.065, 0.15 + noise * 0.035);
    else target.setRGB(0.33 + noise * 0.1, 0.3 + noise * 0.075, 0.16 + noise * 0.04);
    return true;
  }
  for (const definition of WATERCOURSES) {
    if (definition.islandId !== island.id) continue;
    const distance = distanceToWatercourse(localX, localZ, resolveWatercoursePath(definition, island));
    if (distance >= 1.55) continue;
    if (distance < 0.92) target.setRGB(0.25 + noise * 0.07, 0.25 + noise * 0.055, 0.14 + noise * 0.035);
    else target.setRGB(0.38 + noise * 0.08, 0.31 + noise * 0.065, 0.16 + noise * 0.035);
    return true;
  }
  return false;
}

function createWaterfallRibbonGeometry(width: number, height: number): BufferGeometry {
  const segments = 10;
  const vertices = new Float32Array((segments + 1) * 2 * 3);
  const indices = new Uint32Array(segments * 6);
  for (let row = 0; row <= segments; row += 1) {
    const t = row / segments;
    const center = Math.sin(row * 1.73) * width * 0.045;
    const halfWidth = width * 0.5 * (0.86 + Math.sin(row * 2.11 + 0.4) * 0.11);
    const vertexOffset = row * 6;
    vertices[vertexOffset] = 0;
    vertices[vertexOffset + 1] = t * height;
    vertices[vertexOffset + 2] = center - halfWidth;
    vertices[vertexOffset + 3] = 0;
    vertices[vertexOffset + 4] = t * height;
    vertices[vertexOffset + 5] = center + halfWidth;
    if (row === segments) continue;
    const indexOffset = row * 6;
    const a = row * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices[indexOffset] = a;
    indices[indexOffset + 1] = c;
    indices[indexOffset + 2] = b;
    indices[indexOffset + 3] = b;
    indices[indexOffset + 4] = c;
    indices[indexOffset + 5] = d;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(vertices, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function createSandySeabed(width: number, depth: number, centerX: number, centerZ: number): Mesh {
  const geometry = new PlaneGeometry(width, depth, 160, 108);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position") as BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const color = new Color();
  for (let index = 0; index < positions.count; index += 1) {
    const localX = positions.getX(index);
    const localZ = positions.getZ(index);
    const worldX = localX + centerX;
    const worldZ = localZ + centerZ;
    const dunes = Math.sin(worldX * 0.075 + Math.sin(worldZ * 0.035) * 1.8) * 0.09;
    const irregularity = fbm2D(worldX * 0.018, worldZ * 0.018, WORLD_SEED + 991, 3) * 0.16;
    positions.setY(index, dunes + irregularity);
    const ripple = Math.sin(worldX * 0.34 + Math.sin(worldZ * 0.16) * 1.4) * 0.5 + 0.5;
    const mottling = fbm2D(worldX * 0.035, worldZ * 0.035, WORLD_SEED + 1_207, 3) * 0.5 + 0.5;
    color.setRGB(
      0.55 + ripple * 0.08 + mottling * 0.05,
      0.46 + ripple * 0.07 + mottling * 0.04,
      0.27 + ripple * 0.045 + mottling * 0.035,
    );
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  positions.needsUpdate = true;
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const seabed = new Mesh(
    geometry,
    new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  seabed.name = "Sandiger Meeresboden";
  seabed.position.set(centerX, -8.35, centerZ);
  seabed.receiveShadow = true;
  return seabed;
}

function createProceduralFish(): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({ color: 0xd7973d, roughness: 0.85, flatShading: true });
  const body = new Mesh(new SphereGeometry(0.5, 8, 5), material);
  body.scale.set(1.25, 0.55, 0.42);
  const tail = new Mesh(new ConeGeometry(0.34, 0.55, 3), material);
  tail.position.x = -0.72;
  tail.rotation.z = -Math.PI / 2;
  group.add(body, tail);
  return group;
}

function createOrganicPondGeometry(radiusX: number, radiusZ: number, seed: number, segments = 64): BufferGeometry {
  const vertices = new Float32Array((segments + 1) * 3);
  const indices = new Uint32Array(segments * 3);
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const radiusVariation = organicBasinRadiusFactor(angle, seed);
    const vertexOffset = (index + 1) * 3;
    vertices[vertexOffset] = Math.cos(angle) * radiusX * radiusVariation;
    vertices[vertexOffset + 2] = Math.sin(angle) * radiusZ * radiusVariation;
    const indexOffset = index * 3;
    indices[indexOffset] = 0;
    indices[indexOffset + 1] = index + 1;
    indices[indexOffset + 2] = ((index + 1) % segments) + 1;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(vertices, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function createOrganicRingGeometry(
  innerRadiusX: number,
  innerRadiusZ: number,
  outerRadiusX: number,
  outerRadiusZ: number,
  seed: number,
  segments = 64,
): BufferGeometry {
  const vertices = new Float32Array(segments * 2 * 3);
  const indices = new Uint32Array(segments * 6);
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const shape = organicBasinRadiusFactor(angle, seed);
    const vertexOffset = index * 6;
    vertices[vertexOffset] = Math.cos(angle) * innerRadiusX * shape;
    vertices[vertexOffset + 2] = Math.sin(angle) * innerRadiusZ * shape;
    vertices[vertexOffset + 3] = Math.cos(angle) * outerRadiusX * shape;
    vertices[vertexOffset + 5] = Math.sin(angle) * outerRadiusZ * shape;
    const next = (index + 1) % segments;
    const indexOffset = index * 6;
    const inner = index * 2;
    const outer = inner + 1;
    const nextInner = next * 2;
    const nextOuter = nextInner + 1;
    indices[indexOffset] = inner;
    indices[indexOffset + 1] = outer;
    indices[indexOffset + 2] = nextInner;
    indices[indexOffset + 3] = nextInner;
    indices[indexOffset + 4] = outer;
    indices[indexOffset + 5] = nextOuter;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(vertices, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function createWaterRibbonGeometry(
  points: ReadonlyArray<WatercoursePoint & { y: number }>,
  samplesPerSegment = 10,
): BufferGeometry {
  const sampled = sampleWatercourseControlPoints(
    points.map(({ x, y, z, width }) => ({ x, z, width, surfaceY: y })),
    samplesPerSegment,
  ).map(({ x, z, width, surfaceY }) => ({ x, y: surfaceY, z, width }));
  return createWaterRibbonGeometryFromSamples(sampled);
}

function createWaterRibbonGeometryFromSamples(
  points: ReadonlyArray<WatercoursePoint & { y: number }>,
  widthFactor = 0.86,
): BufferGeometry {
  const segments = Math.max(0, points.length - 1);
  const vertices = new Float32Array(points.length * 2 * 3);
  const indices = new Uint32Array(segments * 6);
  for (let index = 0; index < points.length; index += 1) {
    const center = points[index]!;
    const previous = points[Math.max(0, index - 1)]!;
    const next = points[Math.min(points.length - 1, index + 1)]!;
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const normalX = -tangentZ;
    const normalZ = tangentX;
    const normalLength = Math.max(0.001, Math.hypot(normalX, normalZ));
    const edgeVariation = 1 + Math.sin(index * 1.91) * 0.035 + Math.sin(index * 0.73 + 1.2) * 0.025;
    const halfWidth = center.width * widthFactor * edgeVariation;
    const vertexOffset = index * 6;
    vertices[vertexOffset] = center.x + (normalX / normalLength) * halfWidth;
    vertices[vertexOffset + 1] = center.y;
    vertices[vertexOffset + 2] = center.z + (normalZ / normalLength) * halfWidth;
    vertices[vertexOffset + 3] = center.x - (normalX / normalLength) * halfWidth;
    vertices[vertexOffset + 4] = center.y;
    vertices[vertexOffset + 5] = center.z - (normalZ / normalLength) * halfWidth;
    if (index === points.length - 1) continue;
    const indexOffset = index * 6;
    const left = index * 2;
    const right = left + 1;
    const nextLeft = left + 2;
    const nextRight = left + 3;
    indices[indexOffset] = left;
    indices[indexOffset + 1] = right;
    indices[indexOffset + 2] = nextLeft;
    indices[indexOffset + 3] = nextLeft;
    indices[indexOffset + 4] = right;
    indices[indexOffset + 5] = nextRight;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(vertices, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function createInlandWaterMaterial(
  deepColor: number,
  shallowColor: number,
  opacity: number,
  waveHeight: number,
): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new Color(deepColor) },
      uShallow: { value: new Color(shallowColor) },
      uOpacity: { value: opacity },
      uWaveHeight: { value: waveHeight },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uWaveHeight;
      varying float vRipple;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        float ripple = sin((p.x + p.z) * 0.34 + uTime * 1.15) * 0.55
          + cos(p.x * 0.23 - p.z * 0.28 - uTime * 0.82) * 0.45;
        p.y += ripple * uWaveHeight;
        vRipple = ripple;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform float uOpacity;
      varying float vRipple;
      varying vec3 vWorld;
      void main() {
        float current = sin(vWorld.x * 0.19 + vWorld.z * 0.13) * 0.5 + 0.5;
        float highlight = smoothstep(0.62, 1.0, vRipple * 0.5 + 0.5) * 0.11;
        vec3 color = mix(uDeep, uShallow, 0.34 + current * 0.16 + highlight);
        gl_FragColor = vec4(color, uOpacity);
      }
    `,
  });
}

function createOceanMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new Color(0x075b78) },
      uShallow: { value: new Color(0x37c6c5) },
      uWaveHeight: { value: 0.14 },
      uWaveSpeed: { value: 0.92 },
      uChoppiness: { value: 0.26 },
      uFoamStrength: { value: 0.08 },
      uWind: { value: new Vector2(0.84, 0.55) },
      uTideHeight: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uWaveHeight;
      uniform float uWaveSpeed;
      uniform float uChoppiness;
      uniform vec2 uWind;
      uniform float uTideHeight;
      varying float vCrest;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        vec4 baseWorld = modelMatrix * vec4(position, 1.0);
        vec2 crossWind = vec2(-uWind.y, uWind.x);
        float alongWind = dot(baseWorld.xz, uWind);
        float acrossWind = dot(baseWorld.xz, crossWind);
        float primaryPhase = alongWind * 0.055 + uTime * 1.05 * uWaveSpeed;
        float crossPhase = acrossWind * 0.083 - uTime * 0.82 * uWaveSpeed;
        float ripplePhase = (baseWorld.x + baseWorld.z) * 0.17 + uTime * 1.45 * uWaveSpeed;
        float primary = sin(primaryPhase) * uWaveHeight * 0.58;
        float crossWave = cos(crossPhase) * uWaveHeight * 0.31;
        float ripple = sin(ripplePhase) * uWaveHeight * 0.11;
        p.y += uTideHeight + primary + crossWave + ripple;
        p.xz += uWind * cos(primaryPhase) * uWaveHeight * uChoppiness * 0.12;
        vCrest = sin(primaryPhase) * 0.62 + cos(crossPhase) * 0.27 + sin(ripplePhase) * 0.11;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform float uChoppiness;
      uniform float uFoamStrength;
      uniform vec2 uWind;
      varying float vCrest;
      varying vec3 vWorld;
      void main() {
        float movingBands = sin(dot(vWorld.xz, uWind) * 0.14 - uTime * 0.5) * 0.5 + 0.5;
        vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        if (normal.y < 0.0) normal = -normal;
        vec3 viewDirection = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2);
        float crest = smoothstep(0.7 - uFoamStrength * 0.18, 0.96, vCrest * 0.5 + 0.5) * uFoamStrength;
        vec3 color = mix(uDeep, uShallow, 0.25 + movingBands * 0.12 + fresnel * 0.28);
        color *= 1.0 - uChoppiness * 0.14;
        color = mix(color, vec3(0.88, 0.97, 0.95), crest * 0.82);
        gl_FragColor = vec4(color, 0.7 + fresnel * 0.08 + crest * 0.12);
      }
    `,
  });
}

function createFoamRing(x: number, z: number, radiusX: number, radiusZ: number): Mesh<RingGeometry, ShaderMaterial> {
  const geometry = new RingGeometry(0.965, 1.02, 128, 1);
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0.76 },
      uTideHeight: { value: 0 },
      uColor: { value: new Color(0xdff8ed) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uTideHeight;
      varying float vRadius;
      varying float vAngle;
      void main() {
        vec3 p = position;
        vRadius = length(p.xy);
        vAngle = atan(p.y, p.x);
        float pulse = sin(vAngle * 7.0 - uTime * 1.65) * 0.004 + sin(vAngle * 3.0 + uTime * 0.8) * 0.003;
        p.xy *= 1.0 + pulse;
        p.z += uTideHeight + sin(vAngle * 4.0 - uTime * 1.25) * 0.025;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uStrength;
      uniform vec3 uColor;
      varying float vRadius;
      varying float vAngle;
      void main() {
        float ringMask = smoothstep(0.965, 0.982, vRadius) * (1.0 - smoothstep(0.998, 1.02, vRadius));
        float brokenFoam = smoothstep(-0.28, 0.5, sin(vAngle * 17.0 + uTime * 1.1) + sin(vAngle * 9.0 - uTime * 0.73) * 0.55);
        float alpha = ringMask * (0.18 + brokenFoam * 0.36) * uStrength;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const foam = new Mesh(geometry, material);
  foam.name = "Animierte Brandung";
  foam.position.set(x, SEA_LEVEL + 0.08, z);
  foam.rotation.x = -Math.PI / 2;
  foam.scale.set(radiusX, radiusZ, 1);
  foam.renderOrder = 5;
  return foam;
}

function createSkyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { uDaylight: { value: 1 } },
    vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uDaylight; varying vec3 vPos;
      void main(){
        float h=normalize(vPos).y*0.5+0.5;
        vec3 day=mix(vec3(0.72,0.91,0.94),vec3(0.08,0.38,0.62),smoothstep(0.15,0.85,h));
        vec3 night=mix(vec3(0.015,0.035,0.08),vec3(0.005,0.015,0.04),h);
        gl_FragColor=vec4(mix(night,day,uDaylight),1.0);
      }
    `,
  });
}

function createProceduralPalm(): Group {
  const group = new Group();
  const trunkMaterial = new MeshStandardMaterial({ color: 0x80532e, roughness: 1 });
  const leafMaterial = new MeshStandardMaterial({ color: 0x2f7d38, roughness: 0.9, side: DoubleSide });
  for (let index = 0; index < 5; index += 1) {
    const segment = new Mesh(new CylinderGeometry(0.18 - index * 0.015, 0.22 - index * 0.012, 1.2, 7), trunkMaterial);
    segment.position.set(index * 0.06, 0.6 + index * 1.08, 0);
    segment.rotation.z = -0.05;
    segment.castShadow = true;
    group.add(segment);
  }
  for (let index = 0; index < 8; index += 1) {
    const frond = new Mesh(new ConeGeometry(0.65, 3.6, 4), leafMaterial);
    frond.position.set(0.34, 5.6, 0);
    frond.rotation.z = Math.PI / 2.8;
    frond.rotation.y = (index / 8) * Math.PI * 2;
    frond.castShadow = true;
    group.add(frond);
  }
  return group;
}

function createResourceVisual(kind: ItemId, assets: AssetService): Group {
  if (kind === "climbing_kit") return createClimbingKitVisual();
  if (kind === "shovel") return createShovelVisual();
  if (kind === "shovel_blueprint" || kind === "giant_island_map") return createDocumentVisual(kind);
  if (kind === "obsidian_shard") return createObsidianVisual();
  if (kind === "reef_stone") return createReefStoneVisual();
  if (kind === "wildflower") return createWildflowerVisual();
  const group = new Group();
  const modelId = kind === "stone"
    ? "nature.rock-small"
    : kind === "fiber"
      ? "nature.grass-leafs-large"
      : kind === "healing_herb"
        ? "nature.plant-flat-tall"
      : kind === "palm_log" || kind === "stick"
        ? "nature.log"
        : kind === "raw_meat"
          ? "food.meat-raw"
          : kind === "cooked_meat" || kind === "smoked_meat"
            ? "food.meat-cooked"
            : kind === "raw_fish" || kind === "cooked_fish"
              ? "survival.fish"
            : null;
  const loaded = modelId ? assets.createModel(modelId) : null;
  if (loaded) {
    // Hand-sized collectible props add very little to the scene when casting
    // shadows, but each mesh otherwise costs another draw in the shadow pass.
    loaded.traverse((object) => {
      object.castShadow = false;
    });
    if (kind === "raw_meat" || kind === "cooked_meat" || kind === "smoked_meat" || kind === "raw_fish" || kind === "cooked_fish") normalizeMaxDimension(loaded, kind === "raw_fish" || kind === "cooked_fish" ? 0.62 : 0.52);
    else normalizeHeight(loaded, kind === "fiber" ? 0.92 : kind === "healing_herb" ? 0.88 : kind === "palm_log" ? 0.55 : kind === "stick" ? 0.13 : 0.28);
    if (kind === "fiber") {
      loaded.name = "Kenney-Faserpflanze";
      loaded.userData.assetId = modelId;
    }
    if (kind === "healing_herb") {
      loaded.name = "Kenney-Mangroven-Heilkraut";
      loaded.userData.assetId = modelId;
      loaded.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
        else object.material = object.material.clone();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof MeshStandardMaterial) {
            material.color.multiply(new Color(0.68, 1.08, 0.82));
            material.emissive.setHex(0x183a27);
            material.emissiveIntensity = 0.18;
          }
        }
      });
    }
    if (kind === "cooked_fish") {
      loaded.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
        else object.material = object.material.clone();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof MeshStandardMaterial) material.color.multiply(new Color(0.72, 0.48, 0.3));
        }
      });
    }
    if (kind === "smoked_meat") {
      loaded.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
        else object.material = object.material.clone();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof MeshStandardMaterial) material.color.multiply(new Color(0.52, 0.34, 0.24));
        }
      });
    }
    if (kind === "stick" || kind === "palm_log") loaded.rotation.z = Math.PI / 2;
    group.add(loaded);
    return group;
  }
  const material = new MeshStandardMaterial({ roughness: 0.9, color: 0xffffff });
  let mesh: Mesh;
  if (kind === "fiber" || kind === "healing_herb") {
    material.color.set(kind === "healing_herb" ? 0x62b96d : 0x4a9b3c);
    material.emissive.setHex(kind === "healing_herb" ? 0x173c25 : 0x000000);
    material.emissiveIntensity = kind === "healing_herb" ? 0.16 : 0;
    mesh = new Mesh(new ConeGeometry(kind === "healing_herb" ? 0.46 : 0.38, 0.8, 7), material);
    mesh.position.y = 0.35;
  } else if (kind === "coconut" || kind === "coconut_shell") {
    material.color.set(0x5d371d);
    mesh = new Mesh(new SphereGeometry(0.22, 10, 7), material);
  } else if (kind === "mango") {
    material.color.set(0xf3a323);
    mesh = new Mesh(new SphereGeometry(0.16, 10, 7), material);
    mesh.scale.y = 1.25;
  } else if (kind === "bait") {
    material.color.set(0xc77b46);
    mesh = new Mesh(new SphereGeometry(0.13, 8, 6), material);
  } else if (kind === "cloth") {
    material.color.set(0xe8dfbf);
    mesh = new Mesh(new BoxGeometry(0.42, 0.08, 0.35), material);
  } else if (kind === "bandage") {
    material.color.set(0xe9e2c9);
    mesh = new Mesh(new BoxGeometry(0.4, 0.09, 0.22), material);
  } else if (kind === "herbal_antidote") {
    material.color.set(0x5da36a);
    material.emissive.setHex(0x173823);
    material.emissiveIntensity = 0.12;
    mesh = new Mesh(new CylinderGeometry(0.11, 0.14, 0.32, 8), material);
  } else if (kind === "metal_scrap") {
    material.color.set(0x8a9496);
    material.metalness = 0.7;
    mesh = new Mesh(new BoxGeometry(0.38, 0.12, 0.28), material);
  } else {
    material.color.set(kind === "palm_frond" ? 0x3b863b : 0x80522d);
    mesh = new Mesh(kind === "palm_frond" ? new ConeGeometry(0.32, 1.1, 5) : new CylinderGeometry(0.05, 0.07, 1.2, 6), material);
    mesh.rotation.z = Math.PI / 2;
  }
  mesh.castShadow = false;
  group.add(mesh);
  return group;
}

function createShovelVisual(): Group {
  const group = new Group();
  group.name = "Improvisierte Schaufel";
  const wood = new MeshStandardMaterial({ color: 0x8b552f, roughness: 0.92 });
  const binding = new MeshStandardMaterial({ color: 0xc39a61, roughness: 1 });
  const spadeMaterial = new MeshStandardMaterial({ color: 0x667174, roughness: 0.58, metalness: 0.42 });
  const shaft = new Mesh(new CylinderGeometry(0.035, 0.045, 1.32, 8), wood);
  shaft.position.y = 0.76;
  const grip = new Mesh(new BoxGeometry(0.34, 0.07, 0.07), wood);
  grip.position.y = 1.45;
  const collar = new Mesh(new CylinderGeometry(0.055, 0.055, 0.16, 8), binding);
  collar.position.y = 0.16;
  const blade = new Mesh(new BoxGeometry(0.42, 0.5, 0.075), spadeMaterial);
  blade.position.y = -0.1;
  blade.rotation.z = Math.PI / 4;
  blade.scale.set(0.9, 1, 1);
  group.add(shaft, grip, collar, blade);
  return group;
}

function createDocumentVisual(kind: "shovel_blueprint" | "giant_island_map"): Group {
  const group = new Group();
  const isBlueprint = kind === "shovel_blueprint";
  group.name = isBlueprint ? "Schaufel-Bauplan" : "Karte der Rieseninsel";
  const paper = new Mesh(
    new BoxGeometry(0.92, 0.045, 0.66),
    new MeshStandardMaterial({ color: isBlueprint ? 0xd9e1d9 : 0xd8c28d, roughness: 0.96 }),
  );
  paper.position.y = 0.025;
  group.add(paper);
  const ink = new MeshStandardMaterial({ color: isBlueprint ? 0x315f78 : 0x76512f, roughness: 0.82 });
  for (let index = 0; index < 4; index += 1) {
    const line = new Mesh(new BoxGeometry(0.54 - index * 0.05, 0.012, 0.025), ink);
    line.position.set(-0.08 + index * 0.025, 0.054, -0.22 + index * 0.12);
    line.rotation.y = isBlueprint ? 0 : index % 2 === 0 ? 0.18 : -0.12;
    group.add(line);
  }
  const marker = new Mesh(
    isBlueprint ? new BoxGeometry(0.055, 0.014, 0.38) : new ConeGeometry(0.13, 0.025, 7),
    ink,
  );
  marker.position.set(0.27, 0.058, 0.02);
  marker.rotation.y = isBlueprint ? -0.32 : 0;
  group.add(marker);
  return group;
}

function createTreasureSandMound(): Group {
  const group = new Group();
  const sand = new MeshStandardMaterial({ color: 0xd7b76f, roughness: 1 });
  const mound = new Mesh(new SphereGeometry(1, 18, 8), sand);
  mound.scale.set(3.2, 0.22, 2.35);
  mound.position.y = -0.16;
  mound.receiveShadow = true;
  const disturbedSand = new Mesh(new RingGeometry(1.5, 2.4, 24), new MeshStandardMaterial({ color: 0xcda85f, roughness: 1, side: DoubleSide }));
  disturbedSand.rotation.x = -Math.PI / 2;
  disturbedSand.position.y = 0.018;
  disturbedSand.scale.z = 0.72;
  group.add(mound, disturbedSand);
  return group;
}

function createObsidianVisual(): Group {
  const group = new Group();
  group.name = "Obsidianscherbe";
  const material = new MeshStandardMaterial({
    color: 0x17151d,
    emissive: 0x28122f,
    emissiveIntensity: 0.22,
    metalness: 0.34,
    roughness: 0.32,
  });
  const heights = [0.72, 0.52, 0.4];
  for (const [index, height] of heights.entries()) {
    const shard = new Mesh(new ConeGeometry(0.15 - index * 0.018, height, 5), material);
    shard.position.set((index - 1) * 0.15, height * 0.5, index === 1 ? -0.05 : 0.04);
    shard.rotation.z = (index - 1) * 0.16;
    group.add(shard);
  }
  return group;
}

function createReefStoneVisual(): Group {
  const group = new Group();
  group.name = "Riffkiesel";
  const material = new MeshStandardMaterial({ color: 0x77aeb2, roughness: 0.58, metalness: 0.08 });
  for (let index = 0; index < 4; index += 1) {
    const pebble = new Mesh(new SphereGeometry(0.16 + index * 0.018, 8, 6), material);
    pebble.scale.set(1.35, 0.55, 0.9);
    pebble.position.set((index - 1.5) * 0.18, 0.08 + (index % 2) * 0.035, (index % 2) * 0.13);
    group.add(pebble);
  }
  return group;
}

function createWildflowerVisual(): Group {
  const group = new Group();
  group.name = "Duftblüte";
  const stemMaterial = new MeshStandardMaterial({ color: 0x3f873f, roughness: 0.92 });
  const petalMaterial = new MeshStandardMaterial({ color: 0xd77aca, emissive: 0x32132d, emissiveIntensity: 0.15, roughness: 0.78 });
  const centerMaterial = new MeshStandardMaterial({ color: 0xf4ca45, roughness: 0.72 });
  const stem = new Mesh(new CylinderGeometry(0.018, 0.025, 0.62, 6), stemMaterial);
  stem.position.y = 0.31;
  group.add(stem);
  for (let index = 0; index < 6; index += 1) {
    const petal = new Mesh(new SphereGeometry(0.09, 7, 5), petalMaterial);
    const angle = index / 6 * Math.PI * 2;
    petal.scale.set(1.45, 0.45, 0.75);
    petal.position.set(Math.cos(angle) * 0.11, 0.66, Math.sin(angle) * 0.11);
    petal.rotation.y = -angle;
    group.add(petal);
  }
  const center = new Mesh(new SphereGeometry(0.075, 8, 6), centerMaterial);
  center.position.y = 0.675;
  group.add(center);
  return group;
}

function createSignalBeaconVisual(assets: AssetService, index: number): Group {
  const group = new Group();
  const signpost = assets.createModel("survival.signpost");
  if (signpost) {
    normalizeHeight(signpost, 1.65);
    group.add(signpost);
  }
  const paleStone = new MeshStandardMaterial({ color: 0xc8c3ad, roughness: 0.94 });
  const darkMetal = new MeshStandardMaterial({ color: 0x4f595b, roughness: 0.55, metalness: 0.5 });
  const base = new Mesh(new CylinderGeometry(0.58, 0.7, 0.35, 8), paleStone);
  base.position.y = 0.18;
  const bowl = new Mesh(new CylinderGeometry(0.42, 0.25, 0.24, 10), darkMetal);
  bowl.position.y = 0.52;
  const marker = new Mesh(new BoxGeometry(0.24, 0.2, 0.05), new MeshStandardMaterial({ color: 0xe1c864, roughness: 0.8 }));
  marker.position.set(0.45, 1.25, 0.03);
  marker.rotation.z = (index - 2) * 0.08;
  const flame = new Mesh(
    new ConeGeometry(0.22, 0.62, 8),
    new MeshBasicMaterial({ color: 0xffad32, transparent: true, opacity: 0.88 }),
  );
  flame.name = "signal-beacon-flame";
  flame.position.y = 0.92;
  flame.visible = false;
  group.add(base, bowl, marker, flame);
  return group;
}

function createClimbingKitVisual(): Group {
  const group = new Group();
  group.name = "Kletterset";
  const ropeMaterial = new MeshStandardMaterial({ color: 0xc49a61, roughness: 1, side: DoubleSide });
  const metalMaterial = new MeshStandardMaterial({ color: 0x7f8c91, roughness: 0.48, metalness: 0.68 });
  for (let index = 0; index < 4; index += 1) {
    const coil = new Mesh(new RingGeometry(0.16 + index * 0.026, 0.185 + index * 0.026, 16), ropeMaterial);
    coil.rotation.x = -Math.PI / 2;
    coil.position.y = 0.025 + index * 0.012;
    group.add(coil);
  }
  const peg = new Mesh(new CylinderGeometry(0.027, 0.035, 0.42, 7), metalMaterial);
  peg.rotation.z = Math.PI / 2;
  peg.position.set(0.05, 0.105, 0.02);
  const hook = new Mesh(new RingGeometry(0.055, 0.077, 10, 1, 0, Math.PI * 1.55), metalMaterial);
  hook.position.set(0.25, 0.105, 0.02);
  hook.rotation.y = Math.PI / 2;
  group.add(peg, hook);
  return group;
}

function createClimbingAnchorVisual(assets: AssetService, index: number): Group {
  const group = new Group();
  const signpost = assets.createModel("survival.signpost");
  if (signpost) {
    normalizeHeight(signpost, 1.7);
    signpost.position.y = 0.02;
    signpost.traverse((object) => { object.castShadow = true; });
    group.add(signpost);
  }
  const metalMaterial = new MeshStandardMaterial({ color: 0x6e7d82, roughness: 0.52, metalness: 0.64 });
  const ropeMaterial = new MeshStandardMaterial({ color: 0xc49a61, roughness: 1, side: DoubleSide });
  const stake = new Mesh(new CylinderGeometry(0.045, 0.06, 1.25, 7), metalMaterial);
  stake.position.set(0.38, 0.62, 0);
  const coil = new Mesh(new RingGeometry(0.18, 0.215, 18), ropeMaterial);
  coil.position.set(0.38, 0.73, 0.045);
  const marker = new Mesh(new BoxGeometry(0.3, 0.22, 0.04), new MeshStandardMaterial({
    color: index === 3 ? 0xe6b94a : 0xd7d0b2,
    emissive: index === 3 ? 0x443108 : 0x11100c,
    emissiveIntensity: 0.18,
    roughness: 0.82,
  }));
  marker.position.set(0.38, 1.2, 0.02);
  group.add(stake, coil, marker);
  return group;
}

function createSummitCacheFallback(): Group {
  const group = new Group();
  const wood = new MeshStandardMaterial({ color: 0x76502f, roughness: 0.92 });
  const metal = new MeshStandardMaterial({ color: 0x7c8587, roughness: 0.55, metalness: 0.55 });
  const box = new Mesh(new BoxGeometry(1.15, 0.62, 0.72), wood);
  box.position.y = 0.31;
  const lid = new Mesh(new BoxGeometry(1.2, 0.12, 0.77), wood);
  lid.position.y = 0.68;
  const bandA = new Mesh(new BoxGeometry(0.09, 0.76, 0.79), metal);
  bandA.position.set(-0.38, 0.36, 0);
  const bandB = bandA.clone();
  bandB.position.x = 0.38;
  group.add(box, lid, bandA, bandB);
  return group;
}

export function createLoreLetterVisual(): Group {
  const group = new Group();
  const paperMaterial = new MeshStandardMaterial({
    color: 0xe8cf91,
    emissive: 0x3a270d,
    emissiveIntensity: 0.14,
    roughness: 0.92,
  });
  const inkMaterial = new MeshStandardMaterial({ color: 0x4a3521, roughness: 1 });
  const sealMaterial = new MeshStandardMaterial({ color: 0x8d302b, roughness: 0.72 });
  const paper = new Mesh(new BoxGeometry(0.72, 0.035, 0.5), paperMaterial);
  paper.castShadow = true;
  paper.receiveShadow = true;
  group.add(paper);

  for (let index = 0; index < 4; index += 1) {
    const width = index === 3 ? 0.25 : 0.42;
    const line = new Mesh(new BoxGeometry(width, 0.008, 0.014), inkMaterial);
    line.position.set(-0.055, 0.023, -0.13 + index * 0.075);
    group.add(line);
  }

  const seal = new Mesh(new CylinderGeometry(0.065, 0.065, 0.024, 12), sealMaterial);
  seal.position.set(0.22, 0.035, 0.13);
  seal.castShadow = true;
  group.add(seal);
  return group;
}

function createCrabVisual(color = 0xd65d32): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({ color, roughness: 0.85 });
  const body = new Mesh(new SphereGeometry(0.28, 10, 6), material);
  body.scale.set(1.2, 0.45, 0.8);
  group.add(body);
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index += 1) {
      const leg = new Mesh(new CylinderGeometry(0.025, 0.035, 0.45, 5), material);
      leg.position.set(side * (0.22 + index * 0.05), 0, (index - 1) * 0.14);
      leg.rotation.z = side * 1.08;
      group.add(leg);
    }
    const claw = new Mesh(new SphereGeometry(0.13, 7, 5), material);
    claw.position.set(side * 0.43, 0.08, 0.18);
    group.add(claw);
  }
  return group;
}

function createWildlifeTrackVisual(kind: Exclude<WildlifeKind, "bird" | "snake">): Group {
  const group = new Group();
  group.name = `Tierspur: ${kind}`;
  const isLarge = kind === "wild_boar" || kind === "crocodile";
  const isReptile = kind === "turtle" || kind === "crocodile";
  const material = new MeshBasicMaterial({
    color: isReptile ? 0x4d533d : 0x514331,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const padGeometry = new SphereGeometry(isLarge ? 0.18 : 0.11, 7, 4);
  const spacing = isLarge ? 0.3 : 0.19;
  for (const side of [-1, 1]) {
    const pad = new Mesh(padGeometry, material);
    pad.position.set(side * spacing, 0, side * -0.16);
    pad.scale.set(isReptile ? 1.45 : 0.85, 0.055, isReptile ? 0.72 : 1.35);
    group.add(pad);
    if (kind === "chicken") {
      for (const toeOffset of [-0.08, 0, 0.08]) {
        const toe = new Mesh(new SphereGeometry(0.035, 5, 3), material);
        toe.position.set(side * spacing + toeOffset, 0, side * -0.25);
        toe.scale.set(0.65, 0.04, 2.2);
        group.add(toe);
      }
    }
  }
  return group;
}

function createWildlifeVisual(kind: WildlifeKind, assets: AssetService): Group {
  if (kind === "wild_boar") return createWildBoarVisual(assets);
  if (kind === "chicken") return createChickenVisual(assets);
  if (kind === "snake") return createProceduralSnake();
  const group = new Group();
  const assetId = kind === "turtle" ? "animal.turtle" : kind === "bird" ? "animal.bird" : "animal.crocodile";
  const model = assets.createModel(assetId);
  if (model) {
    if (kind === "bird") {
      model.rotation.z = -Math.PI / 2;
      normalizeMaxDimension(model, 0.78);
    } else normalizeHeight(model, kind === "crocodile" ? 0.72 : 0.56);
    group.add(model);
    group.animations = model.animations;
  } else group.add(kind === "turtle" ? createProceduralTurtle() : kind === "bird" ? createProceduralBird() : createProceduralCrocodile());
  if (kind === "bird") addBirdWings(group);
  return group;
}

function createProceduralSnake(): Group {
  const snake = new Group();
  snake.name = "3D-Modell: Giftschlange";
  const scales = new MeshStandardMaterial({ color: 0x315c2f, roughness: 0.82, flatShading: true });
  const belly = new MeshStandardMaterial({ color: 0x9eaa62, roughness: 0.9, flatShading: true });
  const eyeMaterial = new MeshBasicMaterial({ color: 0xffd84a });
  const tongueMaterial = new MeshBasicMaterial({ color: 0xb51f36 });
  for (let index = 0; index < 10; index += 1) {
    const radius = 0.13 * (1 - index * 0.055);
    const segment = new Mesh(new SphereGeometry(radius, 8, 6), index % 3 === 1 ? belly : scales);
    segment.name = `snake-body-${index}`;
    segment.userData.snakeSegmentIndex = index;
    segment.scale.set(1, 0.62, 1.65);
    segment.position.set(Math.sin(index * 0.72) * 0.09, 0.12, -index * 0.19);
    segment.castShadow = true;
    snake.add(segment);
  }
  const head = new Mesh(new SphereGeometry(0.19, 9, 6), scales);
  head.name = "snake-head";
  head.scale.set(1.08, 0.7, 1.35);
  head.position.set(0, 0.18, 0.25);
  head.castShadow = true;
  snake.add(head);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.032, 7, 5), eyeMaterial);
    eye.name = side < 0 ? "snake-eye-left" : "snake-eye-right";
    eye.position.set(side * 0.13, 0.23, 0.36);
    snake.add(eye);
    const tongue = new Mesh(new CylinderGeometry(0.009, 0.009, 0.24, 4), tongueMaterial);
    tongue.name = "snake-tongue";
    tongue.position.set(side * 0.025, 0.12, 0.51);
    tongue.rotation.x = Math.PI / 2;
    tongue.rotation.z = side * 0.12;
    snake.add(tongue);
  }
  return snake;
}

function addBirdWings(bird: Group): void {
  const material = new MeshStandardMaterial({ color: 0x3b7fa4, roughness: 0.88, flatShading: true, side: DoubleSide });
  for (const side of [-1, 1] as const) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array([
      0, 0, -0.2,
      side * 0.84, 0, -0.08,
      side * 0.56, 0, 0.34,
      0, 0, 0.24,
    ]), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    const pivot = new Group();
    pivot.name = side < 0 ? "bird-wing-left" : "bird-wing-right";
    pivot.position.set(side * 0.04, 0.3, -0.04);
    const wing = new Mesh(geometry, material.clone());
    wing.castShadow = true;
    pivot.add(wing);
    bird.add(pivot);
  }
}

function createProceduralTurtle(): Group {
  const group = new Group();
  const shell = new MeshStandardMaterial({ color: 0x476b3b, roughness: 0.94, flatShading: true });
  const skin = new MeshStandardMaterial({ color: 0x718653, roughness: 0.96, flatShading: true });
  const body = new Mesh(new SphereGeometry(0.55, 9, 6), shell);
  body.scale.set(1.1, 0.45, 1.35);
  body.position.y = 0.3;
  const head = new Mesh(new SphereGeometry(0.2, 8, 6), skin);
  head.position.set(0, 0.24, 0.72);
  group.add(body, head);
  for (const x of [-0.46, 0.46]) for (const z of [-0.4, 0.4]) {
    const flipper = new Mesh(new SphereGeometry(0.16, 7, 5), skin);
    flipper.scale.set(1.35, 0.35, 0.72);
    flipper.position.set(x, 0.13, z);
    group.add(flipper);
  }
  return group;
}

function createProceduralBird(): Group {
  const group = new Group();
  const feather = new MeshStandardMaterial({ color: 0x2f7280, roughness: 0.9, flatShading: true });
  const body = new Mesh(new SphereGeometry(0.22, 8, 6), feather);
  body.scale.set(0.75, 0.72, 1.25);
  const head = new Mesh(new SphereGeometry(0.14, 8, 6), feather);
  head.position.set(0, 0.11, 0.28);
  group.add(body, head);
  return group;
}

function createProceduralCrocodile(): Group {
  const group = new Group();
  const scales = new MeshStandardMaterial({ color: 0x526b3c, roughness: 1, flatShading: true });
  const body = new Mesh(new SphereGeometry(0.48, 10, 6), scales);
  body.scale.set(0.8, 0.42, 2.15);
  body.position.y = 0.3;
  const head = new Mesh(new BoxGeometry(0.72, 0.34, 1.05), scales);
  head.position.set(0, 0.28, 1.15);
  const tail = new Mesh(new ConeGeometry(0.34, 1.9, 8), scales);
  tail.position.set(0, 0.25, -1.35);
  tail.rotation.x = -Math.PI / 2;
  group.add(body, head, tail);
  for (const x of [-0.42, 0.42]) for (const z of [-0.55, 0.55]) {
    const leg = new Mesh(new CylinderGeometry(0.08, 0.1, 0.55, 6), scales);
    leg.position.set(x, 0.14, z);
    leg.rotation.z = Math.PI / 2;
    group.add(leg);
  }
  return group;
}

function createWildBoarVisual(assets: AssetService): Group {
  const group = new Group();
  const model = assets.createModel("animal.wild-boar");
  if (model) {
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
      else object.material = object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          material.color.multiply(new Color(0.47, 0.34, 0.23));
          material.roughness = Math.max(0.82, material.roughness);
        }
      }
    });
    normalizeHeight(model, 1.32);
    group.add(model);
    group.animations = model.animations;
  } else group.add(createProceduralWildBoar());

  const tuskMaterial = new MeshStandardMaterial({ color: 0xeadfbd, roughness: 0.72 });
  for (const x of [-0.19, 0.19]) {
    const tusk = new Mesh(new ConeGeometry(0.055, 0.38, 7), tuskMaterial);
    tusk.position.set(x, 0.39, 0.78);
    tusk.rotation.x = Math.PI / 2;
    group.add(tusk);
  }
  return group;
}

function createChickenVisual(assets: AssetService): Group {
  const group = new Group();
  const model = assets.createModel("animal.chicken");
  if (model) {
    normalizeHeight(model, 0.72);
    group.add(model);
    group.animations = model.animations;
  } else group.add(createProceduralChicken());
  return group;
}

function createProceduralWildBoar(): Group {
  const group = new Group();
  const fur = new MeshStandardMaterial({ color: 0x5c3b28, roughness: 1, flatShading: true });
  const body = new Mesh(new SphereGeometry(0.55, 9, 6), fur);
  body.scale.set(1.35, 0.72, 0.72);
  body.position.y = 0.68;
  const head = new Mesh(new SphereGeometry(0.38, 8, 6), fur);
  head.scale.set(0.8, 0.82, 1.05);
  head.position.set(0, 0.62, 0.62);
  group.add(body, head);
  for (const x of [-0.35, 0.35]) for (const z of [-0.28, 0.35]) {
    const leg = new Mesh(new CylinderGeometry(0.075, 0.09, 0.55, 6), fur);
    leg.position.set(x, 0.28, z);
    group.add(leg);
  }
  return group;
}

function createProceduralChicken(): Group {
  const group = new Group();
  const feathers = new MeshStandardMaterial({ color: 0xf2e3b5, roughness: 0.94, flatShading: true });
  const red = new MeshStandardMaterial({ color: 0xc83f2f, roughness: 0.9, flatShading: true });
  const yellow = new MeshStandardMaterial({ color: 0xe5a638, roughness: 0.9, flatShading: true });
  const body = new Mesh(new SphereGeometry(0.28, 8, 6), feathers);
  body.scale.set(0.85, 1.1, 1.05);
  body.position.y = 0.36;
  const head = new Mesh(new SphereGeometry(0.16, 8, 6), feathers);
  head.position.set(0, 0.63, 0.2);
  const comb = new Mesh(new ConeGeometry(0.07, 0.13, 5), red);
  comb.position.set(0, 0.8, 0.18);
  const beak = new Mesh(new ConeGeometry(0.07, 0.16, 4), yellow);
  beak.position.set(0, 0.62, 0.39);
  beak.rotation.x = Math.PI / 2;
  group.add(body, head, comb, beak);
  return group;
}

function createSharkVisual(): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({ color: 0x587b86, roughness: 0.55 });
  const body = new Mesh(new SphereGeometry(1, 18, 10), material);
  body.scale.set(2.2, 0.65, 0.65);
  group.add(body);
  const tail = new Mesh(new ConeGeometry(0.75, 1.5, 3), material);
  tail.position.x = -2.1;
  tail.rotation.z = -Math.PI / 2;
  group.add(tail);
  const fin = new Mesh(new ConeGeometry(0.48, 1.2, 3), material);
  fin.position.set(0, 0.75, 0);
  group.add(fin);
  const eyeMaterial = new MeshBasicMaterial({ color: 0x050505 });
  for (const z of [-0.48, 0.48]) {
    const eye = new Mesh(new SphereGeometry(0.07, 8, 6), eyeMaterial);
    eye.position.set(1.25, 0.18, z);
    group.add(eye);
  }
  return group;
}

function createCampfireVisual(): Group {
  const group = new Group();
  const stone = new MeshStandardMaterial({ color: 0x6c6b62, roughness: 1 });
  for (let index = 0; index < 9; index += 1) {
    const mesh = new Mesh(new SphereGeometry(0.2, 7, 5), stone);
    const angle = (index / 9) * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * 0.62, 0.16, Math.sin(angle) * 0.62);
    group.add(mesh);
  }
  group.add(createCampfireFlame());
  return group;
}

function createCampfireFlame(): Group {
  const flame = new Group();
  flame.name = "campfire-flame";
  const outer = new Mesh(new ConeGeometry(0.27, 0.72, 8), new MeshBasicMaterial({ color: 0xff7b22, transparent: true, opacity: 0.88 }));
  outer.position.y = 0.45;
  const inner = new Mesh(new ConeGeometry(0.15, 0.46, 7), new MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.92 }));
  inner.position.y = 0.36;
  flame.add(outer, inner);
  return flame;
}

function createLightningFireVisual(): Group {
  const fire = createCampfireFlame();
  fire.name = "lightning-fire";
  fire.scale.setScalar(1.35);
  const glow = new PointLight(0xff7a22, 2.4, 8, 2);
  glow.position.y = 0.7;
  fire.add(glow);
  return fire;
}

function createRainVisual(): Points {
  const positions = new Float32Array(360 * 3);
  const random = new SeededRandom(0x7a11fa11);
  for (let index = 0; index < 360; index += 1) {
    positions[index * 3] = random.range(-20, 20);
    positions[index * 3 + 1] = random.range(-10, 10);
    positions[index * 3 + 2] = random.range(-20, 20);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new PointsMaterial({ color: 0xbfe7ff, size: 0.085, transparent: true, opacity: 0.76, depthWrite: false });
  const rain = new Points(geometry, material);
  rain.name = "weather-rain";
  rain.visible = false;
  rain.frustumCulled = false;
  return rain;
}

function createShelterVisual(): Group {
  const group = new Group();
  const wood = new MeshStandardMaterial({ color: 0x74502c, roughness: 1 });
  const leaf = new MeshStandardMaterial({ color: 0x557d37, roughness: 1, side: DoubleSide });
  for (const x of [-1.3, 1.3]) {
    const post = new Mesh(new CylinderGeometry(0.09, 0.12, 2.2, 6), wood);
    post.position.set(x, 1.1, -0.8);
    group.add(post);
  }
  const roof = new Mesh(new BoxGeometry(3.2, 0.12, 2.6), leaf);
  roof.position.set(0, 1.65, 0);
  roof.rotation.x = -0.42;
  group.add(roof);
  return group;
}

function createBedVisual(): Group {
  const group = new Group();
  const wood = new MeshStandardMaterial({ color: 0x74502c, roughness: 1 });
  const fabric = new MeshStandardMaterial({ color: 0x587b56, roughness: 0.92 });
  const frame = new Mesh(new BoxGeometry(1.65, 0.18, 2.7), wood);
  frame.position.y = 0.25;
  const mattress = new Mesh(new BoxGeometry(1.5, 0.24, 2.45), fabric);
  mattress.position.y = 0.45;
  const pillow = new Mesh(new BoxGeometry(1.12, 0.18, 0.5), new MeshStandardMaterial({ color: 0xd7c9a2, roughness: 1 }));
  pillow.position.set(0, 0.65, -0.85);
  group.add(frame, mattress, pillow);
  return group;
}

function createChestVisual(): Group {
  const group = new Group();
  const wood = new MeshStandardMaterial({ color: 0x76502d, roughness: 0.95 });
  const metal = new MeshStandardMaterial({ color: 0x4f5551, roughness: 0.72, metalness: 0.12 });
  const body = new Mesh(new BoxGeometry(1.35, 0.75, 0.95), wood);
  body.position.y = 0.42;
  const lid = new Mesh(new BoxGeometry(1.42, 0.22, 1.02), wood);
  lid.position.y = 0.91;
  const latch = new Mesh(new BoxGeometry(0.18, 0.32, 0.08), metal);
  latch.position.set(0, 0.65, 0.51);
  group.add(body, lid, latch);
  return group;
}

function createWorkbenchVisual(): Group {
  const group = new Group();
  const wood = new MeshStandardMaterial({ color: 0x6f4a28, roughness: 0.95 });
  const top = new Mesh(new BoxGeometry(2.2, 0.16, 1), wood);
  top.position.y = 0.9;
  group.add(top);
  for (const x of [-0.85, 0.85]) for (const z of [-0.32, 0.32]) {
    const leg = new Mesh(new BoxGeometry(0.14, 0.9, 0.14), wood);
    leg.position.set(x, 0.45, z);
    group.add(leg);
  }
  return group;
}

function createStillVisual(): Group {
  const group = createShelterVisual();
  group.scale.set(0.55, 0.55, 0.55);
  const bowl = new Mesh(new CylinderGeometry(0.65, 0.48, 0.28, 16), new MeshStandardMaterial({ color: 0x67543a, roughness: 0.8 }));
  bowl.position.y = 0.18;
  group.add(bowl);
  return group;
}

function createRainCollectorVisual(assets: AssetService): Group {
  const group = new Group();
  const wood = new MeshStandardMaterial({ color: 0x684725, roughness: 1 });
  for (const [x, z] of [[-0.78, -0.58], [0.78, -0.58], [0, 0.82]] as const) {
    const post = new Mesh(new CylinderGeometry(0.07, 0.1, 1.75, 7), wood);
    post.position.set(x, 0.86, z);
    post.rotation.z = x * 0.08;
    group.add(post);
  }
  const canvas = new Mesh(
    new ConeGeometry(1.18, 0.58, 12, 1, true),
    new MeshStandardMaterial({ color: 0x8b9b72, roughness: 0.92, side: DoubleSide }),
  );
  canvas.position.y = 1.58;
  canvas.rotation.x = Math.PI;
  group.add(canvas);
  const bucket = assets.createModel("survival.bucket");
  if (bucket) {
    normalizeHeight(bucket, 0.72);
    bucket.position.y = 0.36;
    group.add(bucket);
  } else {
    const fallbackBucket = new Mesh(
      new CylinderGeometry(0.38, 0.3, 0.65, 12, 1, true),
      new MeshStandardMaterial({ color: 0x647377, roughness: 0.72, metalness: 0.18, side: DoubleSide }),
    );
    fallbackBucket.position.y = 0.34;
    group.add(fallbackBucket);
  }
  return group;
}

function createFishTrapVisual(assets: AssetService): Group {
  const group = new Group();
  group.name = "Kenney-Fischreuse";
  const fishingStand = assets.createModel("survival.campfire-fishing-stand");
  if (fishingStand) {
    normalizeHeight(fishingStand, 1.45);
    fishingStand.position.set(-0.22, -0.12, 0);
    group.add(fishingStand);
  } else {
    const wood = new MeshStandardMaterial({ color: 0x71502f, roughness: 1 });
    for (const x of [-0.62, 0.62]) {
      const post = new Mesh(new CylinderGeometry(0.06, 0.09, 1.35, 7), wood);
      post.position.set(x, 0.5, 0);
      group.add(post);
    }
    const crossbar = new Mesh(new CylinderGeometry(0.045, 0.055, 1.5, 7), wood);
    crossbar.position.y = 1.08;
    crossbar.rotation.z = Math.PI / 2;
    group.add(crossbar);
  }

  const bucket = assets.createModel("survival.bucket");
  if (bucket) {
    normalizeHeight(bucket, 0.52);
    bucket.position.set(0.72, 0.02, 0.34);
    group.add(bucket);
  }

  const caughtFish = assets.createModel("survival.fish") ?? createProceduralFish();
  normalizeHeight(caughtFish, 0.58);
  caughtFish.name = "fish-trap-catch";
  caughtFish.position.set(0.02, 0.22, 0.12);
  caughtFish.rotation.set(0, 0.4, Math.PI / 2);
  caughtFish.visible = false;
  group.add(caughtFish);

  const baitMarker = new Mesh(
    new SphereGeometry(0.09, 7, 5),
    new MeshStandardMaterial({ color: 0xd8a05a, roughness: 0.9 }),
  );
  baitMarker.name = "fish-trap-bait-marker";
  baitMarker.position.set(0, 0.12, 0);
  baitMarker.visible = false;
  group.add(baitMarker);
  return group;
}

function createSmokingRackVisual(assets: AssetService): Group {
  const group = new Group();
  group.name = "Kenney-Räuchergestell";

  const stand = assets.createModel("survival.campfire-fishing-stand");
  if (stand) {
    normalizeHeight(stand, 1.55);
    stand.position.y = -0.05;
    group.add(stand);
  } else {
    const wood = new MeshStandardMaterial({ color: 0x68472a, roughness: 1 });
    for (const x of [-0.72, 0.72]) {
      const post = new Mesh(new CylinderGeometry(0.07, 0.1, 1.45, 7), wood);
      post.position.set(x, 0.68, 0);
      group.add(post);
    }
    const bar = new Mesh(new CylinderGeometry(0.05, 0.06, 1.65, 7), wood);
    bar.position.y = 1.22;
    bar.rotation.z = Math.PI / 2;
    group.add(bar);
  }

  const pit = assets.createModel("survival.campfire-pit");
  if (pit) {
    normalizeHeight(pit, 0.34);
    pit.position.set(0, 0.02, 0);
    group.add(pit);
  }

  const rawSource = assets.createModel("food.meat-raw");
  const readySource = assets.createModel("food.meat-cooked");
  for (let index = 0; index < SMOKING_BATCH_SIZE; index += 1) {
    const x = (index - 1) * 0.42;
    const raw = rawSource?.clone(true) ?? new Mesh(
      new BoxGeometry(0.28, 0.18, 0.12),
      new MeshStandardMaterial({ color: 0xb95048, roughness: 0.9 }),
    );
    normalizeMaxDimension(raw, 0.36);
    raw.name = `smoker-raw-meat-${index}`;
    raw.position.set(x, 0.9, 0);
    raw.rotation.set(0.2, index * 0.35, 0.18);
    raw.visible = false;
    group.add(raw);

    const ready = readySource?.clone(true) ?? new Mesh(
      new BoxGeometry(0.28, 0.18, 0.12),
      new MeshStandardMaterial({ color: 0x6f3527, roughness: 0.95 }),
    );
    normalizeMaxDimension(ready, 0.36);
    ready.name = `smoker-ready-meat-${index}`;
    ready.position.copy(raw.position);
    ready.rotation.copy(raw.rotation);
    ready.visible = false;
    group.add(ready);
  }

  const smoke = new Group();
  smoke.name = "smoker-smoke";
  const smokeMaterial = new MeshBasicMaterial({ color: 0xb9c2b7, transparent: true, opacity: 0.18, depthWrite: false });
  for (let index = 0; index < 4; index += 1) {
    const puff = new Mesh(new SphereGeometry(0.12 + index * 0.045, 7, 5), smokeMaterial);
    puff.position.set(Math.sin(index * 1.7) * 0.12, 0.62 + index * 0.22, Math.cos(index * 1.3) * 0.08);
    smoke.add(puff);
  }
  smoke.visible = false;
  group.add(smoke);
  return group;
}

function createRaftVisual(hasDeck: boolean): Group {
  const group = new Group();
  const logMaterial = new MeshStandardMaterial({ color: 0x78502d, roughness: 1 });
  for (const x of [-1.05, -0.35, 0.35, 1.05]) {
    const log = new Mesh(new CylinderGeometry(0.27, 0.27, 3.1, 8), logMaterial);
    log.position.x = x;
    log.rotation.x = Math.PI / 2;
    log.castShadow = true;
    group.add(log);
  }
  if (hasDeck) {
    const deckMaterial = new MeshStandardMaterial({ color: 0xa37843, roughness: 0.9 });
    for (let z = -1.2; z <= 1.2; z += 0.4) {
      const slat = new Mesh(new BoxGeometry(2.8, 0.1, 0.3), deckMaterial);
      slat.position.set(0, 0.34, z);
      slat.castShadow = true;
      group.add(slat);
    }
  }
  return group;
}

function createKitInstancedMesh(assets: AssetService, assetId: string, capacity: number): InstancedMesh | null {
  const model = assets.createModel(assetId);
  if (!model) return null;
  model.updateMatrixWorld(true);
  let source: Mesh | null = null;
  model.traverse((object) => {
    if (!source && object instanceof Mesh) source = object;
  });
  if (!source) return null;

  const sourceMesh = source as Mesh;
  const geometry = sourceMesh.geometry.clone();
  geometry.applyMatrix4(sourceMesh.matrixWorld);
  geometry.computeBoundingBox();
  const initialBox = geometry.boundingBox;
  if (!initialBox) {
    geometry.dispose();
    return null;
  }
  const initialSize = initialBox.getSize(new Vector3());
  if (initialSize.y <= Number.EPSILON) {
    geometry.dispose();
    return null;
  }

  const normalization = 1 / initialSize.y;
  geometry.scale(normalization, normalization, normalization);
  geometry.computeBoundingBox();
  const normalizedBox = geometry.boundingBox!;
  const center = normalizedBox.getCenter(new Vector3());
  geometry.translate(-center.x, -normalizedBox.min.y, -center.z);
  geometry.computeBoundingSphere();
  return new InstancedMesh(geometry, sourceMesh.material, capacity);
}

function normalizeHeight(object: Object3D, targetHeight: number): void {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  if (size.y <= 0) return;
  const scale = targetHeight / size.y;
  object.scale.multiplyScalar(scale);
  const normalizedBox = new Box3().setFromObject(object);
  object.position.y -= normalizedBox.min.y;
}

function normalizeMaxDimension(object: Object3D, targetSize: number): void {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (longest <= 0) return;
  object.scale.multiplyScalar(targetSize / longest);
  const normalizedBox = new Box3().setFromObject(object);
  const center = normalizedBox.getCenter(new Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= normalizedBox.min.y;
}

function fitModelToBox(object: Object3D, targetWidth: number, targetHeight: number, targetDepth: number): void {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return;
  object.scale.set(
    object.scale.x * targetWidth / size.x,
    object.scale.y * targetHeight / size.y,
    object.scale.z * targetDepth / size.z,
  );
  const fittedBox = new Box3().setFromObject(object);
  const center = fittedBox.getCenter(new Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= fittedBox.min.y;
}

function isHutBuildable(type: BuildableId): type is HutBuildableId {
  return type === "hut_foundation" || type === "hut_wall" || type === "hut_doorway" || type === "hut_roof";
}

function snapQuarterTurn(rotationY: number): number {
  const turn = Math.PI / 2;
  return Math.round(rotationY / turn) * turn;
}

function findEntityId(object: Object3D, instanceId: number | undefined = undefined): string | null {
  let current: Object3D | null = object;
  while (current) {
    if (instanceId !== undefined && Array.isArray(current.userData.entityIds)) {
      const id = current.userData.entityIds[instanceId] as unknown;
      if (typeof id === "string") return id;
    }
    if (typeof current.userData.entityId === "string") return current.userData.entityId as string;
    current = current.parent;
  }
  return null;
}

function labelForKind(kind: WorldEntityKind): string {
  const labels: Partial<Record<WorldEntityKind, string>> = {
    fiber: "Faserpflanze",
    stick: "Stock",
    stone: "Stein",
    palm_frond: "Palmwedel",
    palm_log: "Palmstamm",
    coconut: "Kokosnuss",
    coconut_shell: "Kokosschale",
    crab: "Krabbe",
    cooked_crab: "Gekochte Krabbe",
    raw_meat: "Rohes Fleisch",
    cooked_meat: "Gegrilltes Fleisch",
    smoked_meat: "Räucherfleisch",
    raw_fish: "Roher Fisch",
    cooked_fish: "Gegrillter Fisch",
    spoiled_food: "Verdorbene Nahrung",
    bait: "Fischköder",
    mango: "Mango",
    healing_herb: "Mangroven-Heilkraut",
    bandage: "Kräuterverband",
    herbal_antidote: "Pflanzliches Gegengift",
    flower_tonic: "Blütentonikum",
    whetstone: "Riff-Wetzstein",
    cloth: "Stoff",
    metal_scrap: "Metallschrott",
    obsidian_shard: "Obsidianscherbe",
    reef_stone: "Riffkiesel",
    wildflower: "Duftblüte",
    fishing_rod: "Angel",
    obsidian_knife: "Obsidianmesser",
    climbing_kit: "Kletterset",
    shovel_blueprint: "Schaufel-Bauplan",
    shovel: "Improvisierte Schaufel",
    giant_island_map: "Karte der Rieseninsel",
    palm: "Palme",
    tree: "Baum",
    wild_boar: "Wildschwein",
    chicken: "Huhn",
    turtle: "Schildkröte",
    bird: "Tropenvogel",
    crocodile: "Krokodil",
    snake: "Giftschlange",
    shark: "Hai",
    freshwater: "Süßwasserquelle",
    brackwater: "Brackwasser",
    wreck_chest: "Wrackkiste",
    summit_cache: "Gipfelvorrat",
    crater_cache: "Geologenkiste",
    waterfall_cache: "Wasserfall-Versteck",
    moon_cache: "Windgrat-Kiste",
    buried_chest: "Halb vergrabene Truhe",
    signal_beacon: "Windsignal",
    climbing_anchor: "Seilanker",
    death_pack: "Verlorener Rucksack",
    lore_letter: "Vergilbter Brief",
    building: "Bauwerk",
    raft: "Floß",
  };
  return labels[kind] ?? kind;
}

function isWildlifeKind(kind: WorldEntityKind): kind is WildlifeKind {
  return kind === "wild_boar" || kind === "chicken" || kind === "turtle" || kind === "bird" || kind === "crocodile" || kind === "snake";
}

function distanceToSegmentXZ(
  point: { x: number; z: number },
  start: { x: number; z: number },
  end: { x: number; z: number },
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - start.x, point.z - start.z);
  const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

function wildlifeHitPoints(kind: WildlifeKind): number {
  return kind === "crocodile" ? 120 : kind === "wild_boar" ? 75 : kind === "turtle" ? 42 : kind === "chicken" ? 18 : kind === "snake" ? 16 : 14;
}

function wildlifeAccusativeLabel(kind: WildlifeKind): string {
  return kind === "wild_boar"
    ? "das Wildschwein"
    : kind === "chicken"
      ? "das Huhn"
      : kind === "turtle"
        ? "die Schildkröte"
      : kind === "bird"
        ? "den Tropenvogel"
        : kind === "snake"
          ? "die Giftschlange"
          : "das Krokodil";
}
