const fs=require('fs');
function update(p,fn){fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
update('src/world/TropicalWorld.ts',s=>s.replace(' && distanceSquaredXZ(entity.object.position, player) < 320 ** 2','')
.replace('  "letter-sunrim-island": {', '  "letter-giant-camp": { x: -235, z: -128, rotationY: 0.4 },\n  "letter-sunrim-island": {')
.replace('  if (normalized >= 0.92) return -8 + (1.08 - normalized) / 0.16 * 7.4;',`  if (island.id === 'rieseninsel') {
    const landingDistance = Math.hypot(dx-island.safeLanding.offsetMeters.x,dz-island.safeLanding.offsetMeters.z);
    if (landingDistance < 26) return 1.1;
  }
  if (normalized >= 0.92) return -8 + (1.08 - normalized) / 0.16 * 7.4;`));
update('src/data/worldManifest.test.ts',s=>s.replace("      { id: 'sonnenrand-insel', widthMeters: 118, depthMeters: 82 },", "      { id: 'sonnenrand-insel', widthMeters: 118, depthMeters: 82 },\n      { id: 'rieseninsel', widthMeters: 1600, depthMeters: 1200 },"));
update('src/world/TropicalWorld.test.ts',s=>s.replace('world.getIslandAt(position.x, position.z)?.id === "mangrovenbucht"','["mangrovenbucht", "rieseninsel"].includes(world.getIslandAt(position.x, position.z)?.id ?? "")'));
update('src/data/loreLetters.ts',s=>s.replace('] as const satisfies readonly LoreLetterDefinition[];',`  {
    id: 'letter-giant-camp', islandId: 'rieseninsel', sequence: 15,
    title: 'Ein Ort zum Bleiben', dateLabel: 'Tag 217', locationLabel: 'Elias’ Lager · Smaragdsee',
    paragraphs: [
      'Die Karte hatte recht. Nach Tagen auf offenem Meer stand ein grüner Horizont vor mir. Hinter den Stränden begann ein Wald, dessen Bäume größer waren als alles, was ich bisher gesehen hatte.',
      'In der Mitte der Insel liegt ein See. Ich habe mein Zelt auf einer trockenen Lichtung am Südwestufer aufgeschlagen. Zwischen Feuer, Vorräten und Zelt bleibt genug Platz; mein Pfad führt zurück zur geschützten Bucht.',
      'Die Krokodile halten sich am gegenüberliegenden Ufer auf. Im Wald leben Wildschweine, Hühner und Giftschlangen; über den Blüten tanzen blaue Schmetterlinge. Zum ersten Mal denke ich daran, länger an einem Ort zu bleiben. Falls du diese Zeilen liest: Ich bin gleich hier im Lager.'
    ], signature: 'Elias Voss',
  },
] as const satisfies readonly LoreLetterDefinition[];`));
