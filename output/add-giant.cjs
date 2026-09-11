const fs = require('fs');
const p = 'src/data/worldManifest.ts';
let s = fs.readFileSync(p, 'utf8');
const entry = `    {
      id: 'rieseninsel',
      name: 'Rieseninsel',
      archetype: 'giant-jungle',
      description: 'Ein fernes Dschungelreich mit uralten Baumriesen, bewaldeten Bergrücken und einem großen Süßwassersee im Herzen.',
      visualIdentity: 'Smaragdgrüner See, mehrstöckiges Blätterdach, hohe Felszinnen und eine bewohnte Lichtung am südwestlichen Seeufer.',
      landmarks: ['Smaragdsee', 'Elias’ Lager', 'Tor der Baumriesen', 'Nördlicher Kronengrat', 'Expeditionspfad'],
      safeLanding: { label: 'Geschützte Südwestbucht', offsetMeters: { x: -560, z: -260 } },
      positionMeters: { x: 4_600, z: 3_800 },
      dimensions: { widthMeters: 1_600, depthMeters: 1_200 },
      climate: 'tropical',
      biomes: ['sand', 'shallows', 'jungle', 'rock', 'freshwater', 'mountain'],
      terrainProfile: { maximumHeightMeters: 108, roughness: 'high', shoreline: 'mixed' },
      isStart: false,
      isLarge: true,
      hasJungle: true,
      releasePhase: 1,
      requiresTreasureMap: true,
      resources: [
        { sourceId: 'loose_stick', count: 180, yield: [{ itemId: 'stick', quantity: 1 }] },
        { sourceId: 'loose_stone', count: 100, yield: [{ itemId: 'stone', quantity: 1 }] },
        { sourceId: 'fiber_plant', count: 200, yield: [{ itemId: 'fiber', quantity: 4 }] },
        { sourceId: 'palm_tree', count: 160, yield: [{ itemId: 'palm_log', quantity: 1 }, { itemId: 'palm_frond', quantity: 4 }] },
        { sourceId: 'coconut', count: 80, yield: [{ itemId: 'coconut', quantity: 1 }] },
        { sourceId: 'mango_tree', count: 80, yield: [{ itemId: 'mango', quantity: 1 }] },
        { sourceId: 'crab', count: 36, yield: [{ itemId: 'crab', quantity: 1 }] },
      ],
    },
`;
s = s.replace('  ],\n};\n\nexport function getChartedIslands', entry + '  ],\n};\n\nexport function getChartedIslands');
// Normalize CRLF before the insertion if the existing file uses Windows endings.
if (!s.includes("id: 'rieseninsel'")) { s = s.replace(/\r\n/g, '\n'); s = s.replace('  ],\n};\n\nexport function getChartedIslands', entry + '  ],\n};\n\nexport function getChartedIslands'); }
fs.writeFileSync(p,s);
