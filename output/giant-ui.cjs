const fs=require('fs');
function update(p,fn){fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
update('src/app/GameApp.ts',s=>s.replace('import { getIsland, WORLD_MANIFEST,','import { getChartedIslands, getIsland, WORLD_MANIFEST,')
.replace('const swimming = deepWater && playerPosition.y < 1.1','const waterSurface = world.getWaterSurfaceAt(playerPosition.x, playerPosition.z);\n    const swimming = deepWater && playerPosition.y < waterSurface + 1.1')
.replace('this.underwater = swimming && playerPosition.y < -0.72','this.underwater = swimming && playerPosition.y < waterSurface - 0.72')
.replace('const buoyancy = clamp((0.55 - (this.physics?.getPlayerPosition().y ?? 0.55)) * 2.2, -1.2, 1.2);','const position = this.physics!.getPlayerPosition();\n      const surface = this.world?.getWaterSurfaceAt(position.x, position.z) ?? 0;\n      const buoyancy = clamp((surface + 0.55 - position.y) * 2.2, -1.2, 1.2);')
.replace('islands: WORLD_MANIFEST.islands.map((island)', 'islands: getChartedIslands(this.world?.isGiantIslandCharted() ?? false).map((island)')
.replace('Die alte Karte zeigt eine riesige Insel weit außerhalb des bekannten Archipels. Auf deiner HUD-Karte ist sie noch nicht verzeichnet.', 'Die Karte zeigt die Rieseninsel weit im Nordosten. Ihr Smaragdsee liegt im Zentrum; von der Südwestbucht führt ein Pfad zu Elias’ Lager. M öffnet deine Inselkarte.')
.replace('Zeigt eine riesige Insel außerhalb der bekannten HUD-Karte.', 'Karte zur fernen Rieseninsel im Nordosten mit Smaragdsee und Elias’ Lager.')
.replace('    if (target.kind === "lore_letter") {',`    if (target.kind === 'elias') {
      this.state = 'paused'; this.exitPointerLock();
      this.ui.showLetter({ conversation: true, sequence: 0, total: 0,
        title: 'Elias Voss', dateLabel: 'Endlich Gesellschaft', locationLabel: 'Lager am Smaragdsee · Rieseninsel',
        paragraphs: [
          'Du hast es geschafft! Ich bin Elias. Wenn du meine Briefe gefunden hast, kennst du schon einen Teil meiner Reise. Die alte Karte hat auch mich hierhergeführt.',
          'Hier am Südwestufer ist der Boden trocken und eben. Der Wald hält den Wind ab, und das klare Wasser liegt gleich vor uns. Setz dich ans Feuer und ruh dich von der Überfahrt aus.',
          'Der Pfad hinter meinem Zelt führt zurück zur geschützten Bucht. Auf dieser Insel findest du Wildschweine, Hühner, Schildkröten, Vögel und Schlangen. Am nordöstlichen Seeufer leben Krokodile – dort solltest du Abstand halten. Vor der Küste ziehen Haie ihre Kreise.',
          'Hinter dem See steigen die bewaldeten Grate auf. Pack genug Wasser und Verbände ein, bevor du losziehst. Zwischen den Baumriesen verliert man schnell die Orientierung.'
        ], signature: 'Elias' });
      return;
    }
    if (target.kind === "lore_letter") {`)
.replace('    if (kind === "lore_letter") return', '    if (kind === "elias") return { key: "E", action: "Sprechen", target: "Elias Voss" };\n    if (kind === "lore_letter") return'));
update('src/ui/types.ts',s=>s.replace('export interface LetterViewModel {','export interface LetterViewModel {\n  conversation?: boolean;'));
update('src/ui/ModalView.ts',s=>s.replace("close.setAttribute('aria-label', 'Brief schließen');", "close.setAttribute('aria-label', model.conversation ? 'Gespräch beenden' : 'Brief schließen');")
.replace('`Gefundener Brief · ${model.sequence} von ${model.total}`',"model.conversation ? 'Gespräch am Lagerfeuer' : `Gefundener Brief · ${model.sequence} von ${model.total}`")
.replace("'Automatisch im Notizbuch gespeichert · N zum Nachlesen · Esc oder × zum Schließen'", "model.conversation ? 'Elias bleibt hier im Lager · Esc oder × zum Beenden' : 'Automatisch im Notizbuch gespeichert · N zum Nachlesen · Esc oder × zum Schließen'"));
update('src/data/worldManifest.test.ts',s=>s.replaceAll('fourteen','fifteen').replaceAll('toHaveLength(14)','toHaveLength(15)').replace("      'sonnenrand-insel',", "      'sonnenrand-insel',\n      'rieseninsel',").replace("expect(largest.id).toBe('dschungelberg')","expect(largest.id).toBe('rieseninsel')").replace("      'dschungelberg',\n    ]);", "      'dschungelberg',\n      'rieseninsel',\n    ]);"));
