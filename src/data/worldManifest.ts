import type { ItemAmount } from './items';

export type IslandId =
  | 'kleine-sandbank'
  | 'dschungelbucht'
  | 'palmenlagune'
  | 'mangrovenbucht'
  | 'felsenriff'
  | 'wasserfallinsel'
  | 'dschungelberg'
  | 'vulkaninsel'
  | 'blueteninsel'
  | 'mondklippen'
  | 'schatzsandbank';

export type IslandArchetype =
  | 'sandbank'
  | 'jungle-bay'
  | 'palm-lagoon'
  | 'mangrove-bay'
  | 'rock-reef'
  | 'waterfall-jungle'
  | 'mountain-jungle'
  | 'volcanic'
  | 'flower-meadow'
  | 'crescent-cliffs'
  | 'treasure-sandbar';

export type ReleasePhase = 1 | 2;

export type ResourceSourceId =
  | 'loose_stick'
  | 'loose_stone'
  | 'fiber_plant'
  | 'palm_tree'
  | 'coconut'
  | 'mango_tree'
  | 'healing_herb'
  | 'obsidian_field'
  | 'reef_stone_bed'
  | 'wildflower_patch'
  | 'crab';

export interface IslandDimensions {
  readonly widthMeters: number;
  readonly depthMeters: number;
}

export interface IslandPosition {
  readonly x: number;
  readonly z: number;
}

export type IslandBiome =
  | 'sand'
  | 'shallows'
  | 'palm-grove'
  | 'jungle'
  | 'lagoon'
  | 'mangrove'
  | 'reef'
  | 'rock'
  | 'freshwater'
  | 'mountain'
  | 'volcanic'
  | 'meadow'
  | 'cliff';

export interface TerrainProfile {
  readonly maximumHeightMeters: number;
  readonly roughness: 'low' | 'medium' | 'high';
  readonly shoreline: 'gentle' | 'mixed' | 'steep';
}

export interface ResourceSourceDefinition {
  readonly sourceId: ResourceSourceId;
  readonly count: number;
  readonly yield: readonly ItemAmount[];
}

export interface WorldIslandManifest {
  readonly id: IslandId;
  readonly name: string;
  readonly archetype: IslandArchetype;
  readonly description: string;
  readonly visualIdentity: string;
  readonly landmarks: readonly string[];
  readonly safeLanding: { readonly label: string; readonly offsetMeters: IslandPosition };
  readonly positionMeters: IslandPosition;
  readonly dimensions: IslandDimensions;
  readonly climate: 'tropical';
  readonly biomes: readonly IslandBiome[];
  readonly terrainProfile: TerrainProfile;
  readonly isStart: boolean;
  readonly isLarge: boolean;
  readonly hasJungle: boolean;
  readonly releasePhase: ReleasePhase;
  readonly resources: readonly ResourceSourceDefinition[];
}

export type IslandDefinition = WorldIslandManifest;

export interface WorldManifest {
  readonly id: 'tropical-archipelago';
  readonly islands: readonly [
    WorldIslandManifest,
    WorldIslandManifest,
    WorldIslandManifest,
    WorldIslandManifest,
    WorldIslandManifest,
    WorldIslandManifest,
    WorldIslandManifest,
    WorldIslandManifest,
    WorldIslandManifest,
    WorldIslandManifest,
    WorldIslandManifest,
  ];
}

const START_ISLAND_RESOURCES = [
  { sourceId: 'loose_stick', count: 32, yield: [{ itemId: 'stick', quantity: 1 }] },
  { sourceId: 'loose_stone', count: 12, yield: [{ itemId: 'stone', quantity: 1 }] },
  { sourceId: 'fiber_plant', count: 16, yield: [{ itemId: 'fiber', quantity: 4 }] },
  {
    sourceId: 'palm_tree',
    count: 10,
    yield: [
      { itemId: 'palm_log', quantity: 1 },
      { itemId: 'palm_frond', quantity: 4 },
    ],
  },
  { sourceId: 'coconut', count: 8, yield: [{ itemId: 'coconut', quantity: 1 }] },
  { sourceId: 'crab', count: 6, yield: [{ itemId: 'crab', quantity: 1 }] },
] as const satisfies readonly ResourceSourceDefinition[];

export const WORLD_MANIFEST: WorldManifest = {
  id: 'tropical-archipelago',
  islands: [
    {
      id: 'kleine-sandbank',
      name: 'Kleine Sandbank',
      archetype: 'sandbank',
      description: 'Die kleinste Insel des Archipels: ein niedriger, offener Startstrand ohne Dschungel.',
      visualIdentity: 'Heller Sand, flaches türkisfarbenes Wasser und zehn weit auseinanderstehende Palmen.',
      landmarks: ['Startstrand', 'Flache Nordbucht'],
      safeLanding: { label: 'Startstrand', offsetMeters: { x: -5, z: 0 } },
      positionMeters: { x: 0, z: 0 },
      dimensions: { widthMeters: 65, depthMeters: 45 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'palm-grove'],
      terrainProfile: { maximumHeightMeters: 4, roughness: 'low', shoreline: 'gentle' },
      isStart: true,
      isLarge: false,
      hasJungle: false,
      releasePhase: 1,
      resources: START_ISLAND_RESOURCES,
    },
    {
      id: 'dschungelbucht',
      name: 'Dschungelbucht',
      archetype: 'jungle-bay',
      description: 'Eine große, bewaldete Insel mit geschützter Ankunftsbucht und ergiebigen Ressourcen.',
      visualIdentity: 'Dichter grüner Dschungel, hohe Felsen und ein breiter Sandbogen an der Westküste.',
      landmarks: ['Sichere Ankunftsbucht', 'Aussichtsfelsen', 'Süßwasserquelle', 'Wrackbucht', 'Wrackfracht'],
      safeLanding: { label: 'Sichere Ankunftsbucht', offsetMeters: { x: -126, z: 0 } },
      positionMeters: { x: 390, z: 0 },
      dimensions: { widthMeters: 360, depthMeters: 270 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'jungle', 'rock', 'freshwater'],
      terrainProfile: { maximumHeightMeters: 20, roughness: 'high', shoreline: 'mixed' },
      isStart: false,
      isLarge: true,
      hasJungle: true,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 96, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 54, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 96, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 54, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 32, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'mango_tree', count: 30, yield: [{ itemId: 'mango', quantity: 1 }] },
        { sourceId: 'crab', count: 24, yield: [{ itemId: 'crab', quantity: 1 }] },
      ],
    },
    {
      id: 'palmenlagune',
      name: 'Palmenlagune',
      archetype: 'palm-lagoon',
      description: 'Eine sanfte Ringinsel, deren geschützte Lagune sich als sicherer Floßankerplatz eignet.',
      visualIdentity: 'Fast weißer Sand, leuchtend türkise Innenlagune und besonders viele Kokospalmen.',
      landmarks: ['Innere Lagune', 'Palmenhalbmond', 'Südliche Sandzunge', 'Fischerlager'],
      safeLanding: { label: 'Südliche Sandzunge', offsetMeters: { x: 0, z: 76 } },
      positionMeters: { x: -440, z: 270 },
      dimensions: { widthMeters: 290, depthMeters: 215 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'lagoon', 'palm-grove'],
      terrainProfile: { maximumHeightMeters: 9, roughness: 'low', shoreline: 'gentle' },
      isStart: false,
      isLarge: false,
      hasJungle: false,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 60, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 28, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 60, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 68, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 52, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'crab', count: 22, yield: [{ itemId: 'crab', quantity: 1 }] },
      ],
    },
    {
      id: 'mangrovenbucht',
      name: 'Mangrovenbucht',
      archetype: 'mangrove-bay',
      description: 'Eine flache, feuchte Insel mit verschlungenen Wasserarmen und einem dichten Mangrovengürtel.',
      visualIdentity: 'Dunkles Brackwasser, olivgrüne Baumkronen, sichtbare Stelzwurzeln und schlammige Ufer.',
      landmarks: ['Mangrovenkanal', 'Wurzelhain', 'Stille Ostlagune', 'Seerosenkanal'],
      safeLanding: { label: 'Südliches Kanalufer', offsetMeters: { x: 0, z: -81 } },
      positionMeters: { x: 290, z: 500 },
      dimensions: { widthMeters: 310, depthMeters: 225 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'mangrove', 'lagoon'],
      terrainProfile: { maximumHeightMeters: 8, roughness: 'medium', shoreline: 'gentle' },
      isStart: false,
      isLarge: false,
      hasJungle: false,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 76, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 32, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 78, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 36, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 22, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'healing_herb', count: 18, yield: [{ itemId: 'healing_herb', quantity: 1 }] },
        { sourceId: 'crab', count: 32, yield: [{ itemId: 'crab', quantity: 1 }] },
      ],
    },
    {
      id: 'felsenriff',
      name: 'Felsenriff',
      archetype: 'rock-reef',
      description: 'Eine karge, windige Riffinsel mit steilen Felsnadeln und reichen Steinvorkommen.',
      visualIdentity: 'Graue Felstürme, dunkle Brandungskanten, Korallenflachwasser und nur wenige Palmen.',
      landmarks: ['Drei Felsnadeln', 'Riffbogen', 'Korallengarten', 'Steingarten', 'Riffkieselbank'],
      safeLanding: { label: 'Nordwestliche Felsplatte', offsetMeters: { x: -77, z: 32 } },
      positionMeters: { x: 700, z: -335 },
      dimensions: { widthMeters: 270, depthMeters: 185 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'reef', 'rock'],
      terrainProfile: { maximumHeightMeters: 14, roughness: 'high', shoreline: 'steep' },
      isStart: false,
      isLarge: false,
      hasJungle: false,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 44, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 98, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 40, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 16, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 14, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'crab', count: 24, yield: [{ itemId: 'crab', quantity: 1 }] },
        { sourceId: 'reef_stone_bed', count: 8, yield: [{ itemId: 'reef_stone', quantity: 1 }] },
      ],
    },
    {
      id: 'wasserfallinsel',
      name: 'Wasserfallinsel',
      archetype: 'waterfall-jungle',
      description: 'Eine große Dschungelinsel, deren Hochquelle über eine Felswand in einen Süßwasserpool stürzt.',
      visualIdentity: 'Smaragdgrüner Wald, heller Wasserfall, gestufte Klippen und feuchter Nebel am Fuß der Wand.',
      landmarks: ['Großer Wasserfall', 'Quellplateau', 'Nebelpool', 'Oststrand', 'Überwucherte Ruinen', 'Versteck hinter dem Wasserfall'],
      safeLanding: { label: 'Oststrand', offsetMeters: { x: 154, z: 0 } },
      positionMeters: { x: 910, z: 335 },
      dimensions: { widthMeters: 430, depthMeters: 320 },
      climate: 'tropical',
      biomes: ['sand', 'jungle', 'rock', 'freshwater'],
      terrainProfile: { maximumHeightMeters: 32, roughness: 'high', shoreline: 'mixed' },
      isStart: false,
      isLarge: true,
      hasJungle: true,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 116, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 70, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 116, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 70, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 40, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'mango_tree', count: 40, yield: [{ itemId: 'mango', quantity: 1 }] },
        { sourceId: 'crab', count: 30, yield: [{ itemId: 'crab', quantity: 1 }] },
      ],
    },
    {
      id: 'dschungelberg',
      name: 'Dschungelberg',
      archetype: 'mountain-jungle',
      description: 'Die größte und höchste Insel: ein bewaldeter Berg mit felsigem Gipfel und weiten Ausblicken.',
      visualIdentity: 'Dunkler Bergdschungel, terrassierte Hänge, grauer Gipfelgrat und Wolkennebel in großer Höhe.',
      landmarks: ['Gipfelgrat', 'Dschungelterrassen', 'Bergquelle', 'Nordklippen', 'Berg-Außenposten', 'Seilroute'],
      safeLanding: { label: 'Nordwestbucht', offsetMeters: { x: -206, z: 38 } },
      positionMeters: { x: 1_280, z: -60 },
      dimensions: { widthMeters: 500, depthMeters: 375 },
      climate: 'tropical',
      biomes: ['sand', 'jungle', 'rock', 'freshwater', 'mountain'],
      terrainProfile: { maximumHeightMeters: 58, roughness: 'high', shoreline: 'steep' },
      isStart: false,
      isLarge: true,
      hasJungle: true,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 130, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 98, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 124, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 82, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 46, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'mango_tree', count: 46, yield: [{ itemId: 'mango', quantity: 1 }] },
        { sourceId: 'crab', count: 36, yield: [{ itemId: 'crab', quantity: 1 }] },
      ],
    },
    {
      id: 'vulkaninsel',
      name: 'Vulkaninsel',
      archetype: 'volcanic',
      description: 'Eine junge schwarze Insel mit einem rauchenden Feuerberg, erstarrten Lavaströmen und einer geschützten Aschebucht.',
      visualIdentity: 'Schwarzer Basalt, glutrote Lavarinnen, ein gezackter Kraterkegel und nur vereinzelte grüne Küstenpflanzen.',
      landmarks: ['Feuerkrater', 'Glutpfad', 'Erstarrter Lavastrom', 'Aschebucht', 'Obsidianfeld', 'Geologenkiste'],
      safeLanding: { label: 'Aschebucht', offsetMeters: { x: -118, z: 54 } },
      positionMeters: { x: -600, z: -520 },
      dimensions: { widthMeters: 350, depthMeters: 270 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'rock', 'volcanic'],
      terrainProfile: { maximumHeightMeters: 14, roughness: 'medium', shoreline: 'steep' },
      isStart: false,
      isLarge: false,
      hasJungle: false,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 40, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 112, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 34, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 14, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 12, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'crab', count: 20, yield: [{ itemId: 'crab', quantity: 1 }] },
        { sourceId: 'obsidian_field', count: 10, yield: [{ itemId: 'obsidian_shard', quantity: 1 }] },
      ],
    },
    {
      id: 'blueteninsel',
      name: 'Blüteninsel',
      archetype: 'flower-meadow',
      description: 'Eine sonnige, sanft gewellte Insel mit offenen Wiesen, zwei grünen Hügeln und ungewöhnlich vielen Blütenpflanzen.',
      visualIdentity: 'Helles Gras, rote und gelbe Blütenbänder, lockere Palmenhaine und zwei weich gerundete Aussichtshügel.',
      landmarks: ['Zwillingshügel', 'Blütenmeer', 'Heller Nordstrand', 'Alter Steinkreis', 'Duftblütenhain'],
      safeLanding: { label: 'Heller Nordstrand', offsetMeters: { x: 28, z: -82 } },
      positionMeters: { x: -300, z: 690 },
      dimensions: { widthMeters: 320, depthMeters: 230 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'palm-grove', 'meadow'],
      terrainProfile: { maximumHeightMeters: 16, roughness: 'low', shoreline: 'gentle' },
      isStart: false,
      isLarge: false,
      hasJungle: false,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 58, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 34, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 92, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 38, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 28, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'crab', count: 22, yield: [{ itemId: 'crab', quantity: 1 }] },
        { sourceId: 'wildflower_patch', count: 16, yield: [{ itemId: 'wildflower', quantity: 1 }] },
      ],
    },
    {
      id: 'mondklippen',
      name: 'Mondklippen',
      archetype: 'crescent-cliffs',
      description: 'Eine halbmondförmige Kalkinsel, deren offene Westbucht von zwei hohen Klippenarmen und hellen Felstürmen eingefasst wird.',
      visualIdentity: 'Kreidehelle Klippen, ein tiefblauer halbmondförmiger Einschnitt, kurze Grasflächen und windschiefe Palmen.',
      landmarks: ['Mondbucht', 'Weiße Wachtürme', 'Windgrat', 'Oststrand', 'Drei Windsignale'],
      safeLanding: { label: 'Oststrand', offsetMeters: { x: 112, z: 8 } },
      positionMeters: { x: 1_650, z: 520 },
      dimensions: { widthMeters: 320, depthMeters: 230 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'rock', 'cliff'],
      terrainProfile: { maximumHeightMeters: 24, roughness: 'high', shoreline: 'mixed' },
      isStart: false,
      isLarge: false,
      hasJungle: false,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 50, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 94, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 46, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 24, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 18, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'crab', count: 24, yield: [{ itemId: 'crab', quantity: 1 }] },
      ],
    },
    {
      id: 'schatzsandbank',
      name: 'Schatzsandbank',
      archetype: 'treasure-sandbar',
      description: 'Eine kleine, ruhige Sandinsel, kaum größer als die Startinsel, auf der eine halb versunkene Truhe verborgen liegt.',
      visualIdentity: 'Warmer heller Sand, ein lockerer Palmenkranz und eine auffällige Grabungsstelle mit alten Holzresten.',
      landmarks: ['Vergrabene Truhe', 'Verwehter Bauplan', 'Flache Ankerbucht'],
      safeLanding: { label: 'Flache Ankerbucht', offsetMeters: { x: -24, z: 8 } },
      positionMeters: { x: -180, z: -180 },
      dimensions: { widthMeters: 82, depthMeters: 58 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'palm-grove'],
      terrainProfile: { maximumHeightMeters: 4.8, roughness: 'low', shoreline: 'gentle' },
      isStart: false,
      isLarge: false,
      hasJungle: false,
      releasePhase: 1,
      resources: [
        { sourceId: 'loose_stick', count: 20, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 10, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 14, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 12, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 8, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'crab', count: 7, yield: [{ itemId: 'crab', quantity: 1 }] },
      ],
    },
  ],
};

export const ISLAND_IDS = Object.freeze(WORLD_MANIFEST.islands.map(({ id }) => id));

export function isIslandId(value: unknown): value is IslandId {
  return typeof value === 'string' && ISLAND_IDS.some((id) => id === value);
}

export function getStartIsland(): WorldIslandManifest {
  const startIsland = WORLD_MANIFEST.islands.find(({ isStart }) => isStart);
  if (!startIsland) {
    throw new Error('World manifest has no start island.');
  }
  return startIsland;
}

export function getIsland(id: IslandId): WorldIslandManifest {
  const island = WORLD_MANIFEST.islands.find((candidate) => candidate.id === id);
  if (!island) throw new Error(`Unknown island: ${id}`);
  return island;
}
