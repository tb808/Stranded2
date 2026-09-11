const fs=require('fs');let p='src/world/TropicalWorld.ts',s=fs.readFileSync(p,'utf8');
s=s.replace('  private readonly butterflies: Group[] = [];','  private readonly butterflies: Group[] = [];\n  private eliasFlame: Object3D | null = null;');
s=s.replace('island.id === "rieseninsel" ? 5200','island.id === "rieseninsel" ? 8800');
s=s.replace('rng.range(14, 28)', 'rng.range(18, 32)');
s=s.replace('const silhouettes = createKitInstancedMesh(this.assets, "nature.tree-default", trees.length);',`const giantForest = idPrefix.startsWith('rieseninsel-');
    const silhouettes = giantForest
      ? new InstancedMesh(new SphereGeometry(1, 7, 5), foliageMaterial, trees.length)
      : createKitInstancedMesh(this.assets, "nature.tree-default", trees.length);
    if (giantForest && silhouettes) silhouettes.userData.giantCanopy = true;`);
s=s.replace('    setPart(tree.trunks, tree.index, 0, tree.height * 0.325, 0, 1, tree.height * 0.65, 1);',`    const giant = tree.silhouettes?.userData.giantCanopy === true;
    setPart(tree.trunks, tree.index, 0, tree.height * 0.325, 0, giant ? 2.6 : 1, tree.height * 0.65, giant ? 2.6 : 1);`);
s=s.replace('const crownScale = tree.height * (0.2 + crownIndex * 0.015);','const crownScale = tree.height * ((giant ? 0.25 : 0.2) + crownIndex * 0.015);');
s=s.replace('        tree.height * 0.78,\n        tree.height,\n        tree.height * 0.78,','        tree.height * (giant ? 0.3 : 0.78),\n        tree.height * (giant ? 0.25 : 1),\n        tree.height * (giant ? 0.3 : 0.78),');
s=s.replace('        tree.silhouettes,\n        tree.index,\n        0,\n        0,','        tree.silhouettes,\n        tree.index,\n        0,\n        giant ? tree.height * 0.75 : 0,');
s=s.replace('      this.updateInstancedTreeMatrices(instance, null);',`      this.updateInstancedTreeMatrices(instance, null);
      if (giantForest) {
        const tint = new Color().setHSL(0.27 + (index % 5) * 0.013, 0.38, 0.55 + (index % 4) * 0.08);
        for (let crown = 0; crown < 3; crown++) crowns.setColorAt(index*3+crown,tint);
        silhouettes?.setColorAt(index,tint);
      }`);
s=s.replace("this.assets.createModel('survival.tent') ?? createShelterVisual(), -9", "createCombinedAssetVisual(['survival.tent', 'survival.tent-canvas'], this.assets, 2.7) ?? createShelterVisual(), -9");
s=s.replace("    const fire = createCampfireVisual();", "    const fire = createCampfireVisual();\n    this.eliasFlame = fire.getObjectByName('campfire-flame') ?? null;");
s=s.replace("const flame=this.scene.getObjectByName('Elias’ Lagerfeuer')?.getObjectByName('campfire-flame');", 'const flame=this.eliasFlame;');
s=s.replace('  else if (height > 12) target.setRGB', '  else if (island.id === "rieseninsel") target.setRGB(0.035 + noise * 0.028, 0.105 + noise * 0.055, 0.043 + noise * 0.025);\n  else if (height > 12) target.setRGB');
// The broad bay blends back into the original beach instead of having a sharp platform edge.
s=s.replace("    if (landingDistance < 26) return 1.1;", "    if (landingDistance < 26) return 1.1;\n    if (landingDistance < 42 && normalized >= 0.79) return 1.1 * (1-smoothstep(26,42,landingDistance)) + (-0.6+(0.92-normalized)/0.13*1.25)*smoothstep(26,42,landingDistance);");
fs.writeFileSync(p,s);
function update(p,fn){fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
update('src/data/worldManifest.ts',s=>s.replace('Die größte und höchste Insel: ein bewaldeter Berg','Ein hoher Inselberg im bekannten Archipel: ein bewaldeter Berg'));
update('src/ui/ScreenViews.ts',s=>s.replace('Vierzehn Inseln. Ein Ozean.', 'Ferne Inseln. Ein Ozean.'));
update('src/world/GiantIsland.test.ts',s=>s.replace('Matrix4, Mesh, Vector3','Matrix4, Vector3'));
update('README.md',s=>s.replaceAll('vierzehn','fünfzehn').replace('größte und höchste Insel mit Waldterrassen','hohe Berginsel mit Waldterrassen')
.replace('Die verbindlichen Positionen', '- **Rieseninsel (1.600 × 1.200 m):** über zehnmal die Fläche des Dschungelbergs, mehrere Kilometer nordöstlich des bisherigen Archipels. Dichter Wald mit 8.800 Bäumen, Baumriesen, Unterholz und Schmetterlingen umgibt den zentralen Smaragdsee. Alle bisherigen Landtierarten leben hier; vor der Küste schwimmen Fische und ein Hai. Ein freier Pfad führt von der Südwestbucht zu Elias’ bewohntem Lager mit Zelt, Feuer, Sitzbank, Vorräten und Arbeitstisch. `E` beginnt ein Gespräch mit Elias.\n\nDie verbindlichen Positionen')
.replace('diese Zielinsel ist bewusst noch nicht Teil der Welt- oder HUD-Karte.', 'beim Öffnen der Truhe wird die Rieseninsel dauerhaft auf der Inselkarte freigeschaltet. Vorher fehlen dort sowohl ihre Form als auch ihre Beschriftung. Der gespeicherte Truhenfund schaltet sie auch in älteren Spielständen frei; das Kartenitem muss nicht im Rucksack bleiben.')
.replace('Sie zeigt Lage und Größe aller fünfzehn vorhandenen Inseln;', 'Sie zeigt zunächst vierzehn Inseln; nach dem Kartenfund in der Schatztruhe kommt die ferne Rieseninsel hinzu;'));
