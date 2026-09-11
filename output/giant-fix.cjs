const fs=require('fs'); const p='src/world/TropicalWorld.ts'; let s=fs.readFileSync(p,'utf8');
s=s.replace('?? WORLD_MANIFEST.islands[0];','?? WORLD_MANIFEST.islands[0]!;');
s=s.replace('    gorges: [],','    gorges: [\n      {fromX:-0.18,fromZ:0.26,toX:-0.04,toZ:0.7,width:0.05,depth:14},\n      {fromX:0.3,fromZ:0.16,toX:0.68,toZ:0.35,width:0.045,depth:12},\n    ],');
// Cheap bounding rejection before terrain noise is sampled across every island.
s=s.replace('  const seed = ISLAND_TERRAIN_SEEDS[island.id];\n  const warp', '  if (Math.abs(dx) > radiusX * 1.2 || Math.abs(dz) > radiusZ * 1.2) return -8;\n  const seed = ISLAND_TERRAIN_SEEDS[island.id];\n  const warp');
fs.writeFileSync(p,s);
