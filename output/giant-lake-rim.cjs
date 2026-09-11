const fs=require('fs');const p='src/world/TropicalWorld.ts';let s=fs.readFileSync(p,'utf8');
s=s.replace('height = Math.max(height, 12.5 * (1 - smoothstep(1.3, 2.2, lakeDistance)));','height += (12.5-height)*(1-smoothstep(1.35,1.9,lakeDistance));');
fs.writeFileSync(p,s);
