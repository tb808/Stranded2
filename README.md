# Stranded2

Ein eigenständiges, statisch hostbares First-Person-Survival-Spiel für moderne Desktop-Browser. Das feste Archipel besteht aus fünfzehn vollständig erzeugten und bereisbaren tropischen Inseln.

## Inseln

- **Kleine Sandbank (65 × 45 m):** kleinste, offene Startinsel mit hellem Sand, Flachwasser und zehn Palmen.
- **Dschungelbucht (360 × 270 m):** große Waldinsel mit sicherer Bucht, Aussichtsfelsen, Quelle und Wrack.
- **Palmenlagune (290 × 215 m):** niedrige Ringinsel mit Innenlagune, weißem Sand und dichtem Palmengürtel.
- **Mangrovenbucht (310 × 225 m):** flache Brackwasserinsel mit gewundenem Kanal, Stelzwurzeln und dunklem Grün.
- **Felsenriff (270 × 185 m):** karge, steinreiche Riffinsel mit drei Felsnadeln und einem Korallengarten.
- **Wasserfallinsel (430 × 320 m):** große Dschungelinsel mit Hochquelle, sichtbarem Wasserfall und trinkbarem Nebelpool.
- **Dschungelberg (500 × 375 m):** hohe Berginsel mit Waldterrassen, Bergquelle und felsigem Gipfelgrat.
- **Vulkaninsel (350 × 270 m):** schwarze Basaltinsel mit Feuerkrater, Lavarinnen, Aschebucht und Obsidianfeld.
- **Blüteninsel (320 × 230 m):** sanfte Wieseninsel mit Zwillingshügeln, dichtem Blütenmeer und altem Steinkreis.
- **Mondklippen (320 × 230 m):** halbmondförmige Kalkinsel mit eingeschnittener Westbucht, hellen Felstürmen und windigem Grat.
- **Schatzsandbank (82 × 58 m):** kompakte Sandinsel mit einer halb vergrabenen Truhe, Schaufel-Bauplan und einer Karte zu einer noch unbekannten Rieseninsel.
- **Westwind-Eiland (108 × 74 m):** fernes, windiges Felseiland mit schmalem Leestrand und wenigen schiefen Palmen.
- **Nordstern-Sandbank (94 × 66 m):** sehr flache Koralleninsel am nördlichen Kartenrand mit Gezeitentümpeln und hellem Sand.
- **Sonnenrand-Insel (118 × 82 m):** abgelegene Palmeninsel im Südosten mit geschützter Bucht und markantem Felskopf.

- **Rieseninsel (1.600 × 1.200 m):** über zehnmal die Fläche des Dschungelbergs, mehrere Kilometer nordöstlich des bisherigen Archipels. Dichter Wald mit 8.800 Bäumen, Baumriesen, Unterholz und Schmetterlingen umgibt den zentralen Smaragdsee. Alle bisherigen Landtierarten leben hier; vor der Küste schwimmen Fische und ein Hai. Ein freier Pfad führt von der Südwestbucht zu Elias’ bewohntem Lager mit Zelt, Feuer, Sitzbank, Vorräten und Arbeitstisch. `E` beginnt ein Gespräch mit Elias.

Die verbindlichen Positionen, Größen, Biome, Beschreibungen, Landmarken, sicheren Landestellen und Ressourcenregeln stehen in `src/data/worldManifest.ts`.

Unter Wasser gehen die Inselstrände in einen hellen, leicht gewellten Sandboden über. Kleine Schwärme aus dem Kenney-Survival-Kit schwimmen in den Küstenringen der fünfzehn Inseln; drei zusätzliche Schwärme beleben die geschützte Palmenlagune, während der offene Ozean fischfrei bleibt.

Das Meer reagiert dynamisch auf Wetter und Tageszeit. Bei Hitze liegt es ruhiger, Regen erzeugt kräftigere Kreuzwellen und im Gewitter entstehen hohe, dunklere Wellen mit sichtbaren Schaumkämmen; zugleich pulsiert die Brandung um jede Insel. Eine langsame Gezeit hebt und senkt den Wasserspiegel. Dieselben Wellen und Strömungen wirken auf die Floßauftriebspunkte und treiben Schwimmer sowie ungesicherte Flöße ab. Auch die Meeresbrandung wird bei rauem Wetter hörbar kräftiger.

Die Binnengewässer besitzen ausgeformte Becken und Ufer statt aufgesetzter Wasserscheiben: Quellbach und Bergbach folgen dem Gelände, der Quellsee speist sichtbar Wasserfall und Nebelpool, die Palmenlagune hat einen gewundenen Gezeiten-Auslass und die Mangrovenbucht mehrere verbundene Brackwasserarme. Die drei Süßwasserläufe verwenden skalierte und an das Gefälle ausgerichtete Fluss- und Flusssteinmodule aus dem Nature Kit über einer lückenlosen animierten Wasserfläche. Flache Ufersäume sowie Seerosen, Uferpflanzen, Treibholz und weitere Felsmodelle markieren die Übergänge.

Die Bodendeckung verwendet instanzierte Grasbüschel, Blattgruppen, Flachpflanzen und große Büsche aus dem Nature Kit statt prozeduraler Kegel. Sammelbare Faserpflanzen sind durch die hellere, breite `grass_leafsLarge`-Silhouette eindeutig von gewöhnlichem Unterholz zu unterscheiden. Auch die frühere kegelförmige Fernansicht der Dschungelbäume wurde durch instanzierte `tree_default`-Modelle ersetzt.

Die Zielinseln besitzen zusätzliche, handgesetzte Entdeckungsorte: eine ausgebaute Wrackstelle, ein Fischerlager, überwucherte Ruinen und ein Berg-Außenposten. Die kleine Startinsel bleibt bewusst naturbelassen. Felsgruppen, Blumen, Pilze, Seerosen, Büsche, Baumstümpfe und zurückgelassene Survival-Ausrüstung geben den größeren Biomen deutlich mehr Wiedererkennungswert.

Die Dschungelbucht ist das ergiebige Jagd- und Vorratsrevier. Acht Wildschweine und zehn Hühner machen sie deutlich wildreicher; dort erlegte Tiere liefern außerdem mehr Fleisch als ihre Artgenossen auf anderen Inseln. Nur auf dem Boden der Dschungelbucht lässt sich ein Räuchergestell bauen. Eine Charge aus drei Stücken rohem Fleisch und einem Stock wird darin in ungefähr 90 Sekunden zu drei besonders sättigenden Portionen Räucherfleisch. Das Gestell kombiniert Feuerstelle und Fischergestell aus dem Kenney-Survival-Kit mit den rohen und gegarten Kenney-Fleischmodellen.

Die Mangrovenbucht besitzt eine eigene Risiko-Belohnungs-Schleife: Achtzehn nachwachsende Heilkräuter stehen in den Revieren der dort heimischen Krokodile. Aus ihnen lassen sich Kräuterverbände gegen Schlangengift und ein pflanzliches Gegengift herstellen. Das Wasser der Kanäle ist interaktives Brackwasser; es lindert den Durst nur kurz, verursacht danach aber eine zeitlich begrenzte Krankheit mit Lebensverlust und erhöhtem Wasserbedarf.

In den bewaldeten Inselregionen leben Giftschlangen mit einem eigenen animierten 3D-Modell. Ihr Biss verursacht eine Vergiftung, die kontinuierlich Leben abzieht und nach drei Spieltagen tödlich endet. Ein direkt benutztes Mangroven-Heilkraut oder das daraus hergestellte Gegengift neutralisiert das Gift.

Die Tierwelt folgt einem sichtbaren Tagesablauf: Herdentiere bleiben in kleinen, räumlich passenden Gruppen, ziehen morgens zu nahe gelegenen Süßwasserstellen und suchen zwischendurch Futter. Wird ein Huhn, eine Schildkröte oder ein Vogel aufgeschreckt, reagiert die ganze Gruppe. Vögel landen nachts in erreichbaren Baumkronen; laufende Wildschweine, Hühner, Schildkröten und Krokodile hinterlassen am Boden dezente Spuren, die nach kurzer Zeit wieder verblassen.

Die Palmenlagune ist als ruhiges Versorgungsrevier auf Fischerei ausgerichtet. Aus Stöcken, Fasern und Seilen entsteht eine Angel; aus Krabben werden Fischköder. Sichtbare Schwärme lassen sich mit Angel und Köder fangen und benötigen danach eine kurze Erholungszeit. Zusätzlich können beköderte Fischreusen ausschließlich im flachen Innenwasser gebaut werden; nach ungefähr zwei Minuten halten sie bis zu drei Fische zur Abholung bereit. Reusen, Fang und Fischdarstellung verwenden das Fischergestell, den Eimer und das Fischmodell aus dem Kenney-Survival-Kit. Roher Fisch lässt sich anschließend am Lagerfeuer grillen.

Der Dschungelberg ist die Ausdauer- und Kletterinsel. Am Berg-Außenposten liegt ein Kletterset; weitere Sets lassen sich aus zwei Seilbindungen, zwei Stoff und einem Metallschrott herstellen. Drei gut sichtbare Seilanker führen über die Bergterrassen bis zum Gipfelgrat. Jede Etappe kostet 22 Ausdauer und einen Haltbarkeitspunkt des Sets. Oben wartet ein einmalig plünderbarer Gipfelvorrat mit Räucherfleisch, Stoff und Metallschrott.

Die Vulkaninsel ist das gefährliche Hochwert-Ressourcenrevier. Die Aschebucht ist ein sicherer Ausgangspunkt; leuchtende Lavarinnen und zwei deutlich markierte Hitzestufen führen zum Feuerkrater. Vulkanhitze steigert den Wasserverbrauch, Gluthitze verursacht zusätzlich regelmäßigen Schaden. Regen, Schwimmen und das gewebte Schutzhemd mildern die Belastung. Zehn einmalig sammelbare Obsidianvorkommen liegen entlang der heißen Route. Aus zwei Obsidianscherben, einem Stock und einer Seilbindung entsteht ein besonders langlebiges und starkes Obsidianmesser. Direkt am Krater belohnt eine einmalig plünderbare Geologenkiste das höchste Risiko.

Das Felsenriff ist das Tauch- und Werkzeugpflege-Revier. Acht einmalig sammelbare Riffkiesel liegen unter Wasser zwischen den Korallen und verlangen kontrollierten Umgang mit der Sauerstoffanzeige. Zwei Riffkiesel und ein gewöhnlicher Stein ergeben einen Riff-Wetzstein, der ein beschädigtes Werkzeug um 35 Haltbarkeit repariert.

Die Wasserfallinsel dient als Regenerations- und Entdeckungsrevier. Wasser aus Quellsee und Nebelpool stillt den Durst vollständig, heilt 10 Gesundheit und füllt die Ausdauer. Direkt hinter dem großen Wasserschleier liegt ein einmalig plünderbares Versteck mit Stoff, Metallschrott und gegrilltem Fisch.

Schwere körperliche Treffer durch Wildschweine, Krokodile und Haie verursachen blutende Verletzungen. Solange die Blutung aktiv ist, sinkt die Gesundheit fortlaufend – auch während des Schlafs. Ein einfacher Verband lässt sich überall per Hand aus drei Fasern herstellen, stoppt die Blutung und stellt 15 Gesundheit wieder her. Der Zustand wird im HUD mit `🩸 Blutung` angezeigt und in Spielständen gespeichert.

Verderbliche Nahrung besitzt pro Stapel eine sichtbare Resthaltbarkeit und altert sowohl im Rucksack als auch in Truhen und während des Schlafs. Krabben, rohes Fleisch und roher Fisch halten einen Spieltag; gekochte Nahrung und Mangos zwei Spieltage; Räucherfleisch fünf Spieltage. Kokosnüsse bleiben durch ihre harte Schale haltbar. Abgelaufene Vorräte werden zu ungenießbarer `Verdorbener Nahrung`. Beim Umlagern und Speichern bleibt die jeweilige Resthaltbarkeit erhalten.

Der neue Müdigkeitswert steigt während des Wachseins innerhalb von zwei Spieltagen von 0 auf 100 Prozent. Ab 50 Prozent regeneriert Ausdauer zunehmend langsamer und die Spielfigur bewegt sich schwerfälliger; ab 80 Prozent kann sie nicht mehr sprinten. Bei 100 Prozent verursacht völlige Erschöpfung fortlaufend Gesundheitsschaden. Eine Nacht im Bett setzt die Müdigkeit auf null, füllt die Ausdauer und überspringt wie bisher bis zum Morgen; Hunger, Durst, Gift, Blutung und Nahrungsverderb laufen währenddessen weiter. Alte Spielstände ohne Müdigkeitswert starten ausgeruht.

Auf der Blüteninsel wachsen sechzehn deutlich erkennbare Duftblüten, die nach zwei Spieltagen erneut austreiben. Drei Duftblüten, ein Mangroven-Heilkraut und eine Kokosschale ergeben ein Blütentonikum. Es heilt 30 Gesundheit und stellt die gesamte Ausdauer wieder her; damit verbindet das Rezept die friedliche Wieseninsel mit der riskanten Mangrovenbucht.

Die Mondklippen bilden eine windige Erkundungsprüfung. Auf hohen und exponierten Graten entzieht Klippenwind fortlaufend Ausdauer; die Stärke wird im HUD angezeigt. Drei Windsignale sind über beide Klippenarme verteilt und benötigen jeweils zwei Stöcke sowie einen Stoff zum Entzünden. Erst wenn alle drei sichtbar brennen, öffnet sich die Windgrat-Kiste mit einem großen Vorrat an Stoff, Metallschrott und Räucherfleisch.

Auf der Schatzsandbank ragt eine Truhe nur halb aus dem Sand. Direkt daneben liegt der Bauplan für eine improvisierte Schaufel aus Palmstamm, Stöcken und Seilbindung. Mit ausgewählter Schaufel kann die Truhe dauerhaft freigelegt und anschließend geöffnet werden. Darin liegt eine Karte zu einer riesigen Insel außerhalb des bekannten Archipels; beim Öffnen der Truhe wird die Rieseninsel dauerhaft auf der Inselkarte freigeschaltet. Vorher fehlen dort sowohl ihre Form als auch ihre Beschriftung. Der gespeicherte Truhenfund schaltet sie auch in älteren Spielständen frei; das Kartenitem muss nicht im Rucksack bleiben.

Zu den baubaren Survival-Objekten gehören Lagerfeuer, Schutzdach, Bett, Truhe, Werkbank und Palm-Destille. Das Schutzdach setzt den Respawnpunkt; im Bett kann nachts bis zum Morgen geschlafen werden. Im Rucksack lassen sich ganze Itemstapel per Drag-and-drop oder durch Anklicken von Quelle und Ziel frei anordnen; die Anordnung bleibt im Spielstand erhalten. Jede Truhe besitzt 16 dauerhaft gespeicherte Plätze. `F` öffnet an einer Werkbank das vollständige Herstellungsmenü. Mit ausgewähltem Bauhammer kann die Werkbank separat per `E` eingepackt werden. Die verpackte Werkbank liegt anschließend im Inventar und lässt sich über „Benutzen“ oder „Ablegen“ ohne neue Materialkosten wieder platzieren.

Regen und Gewitter kühlen die Spielfigur aus. Ohne angezogenes Schutzhemd oder ein brennendes Lagerfeuer in höchstens sechs Metern Entfernung sinkt die maximale Ausdauer langsam bis auf 35; in Wärme erholt sie sich wieder.

Ein vollständiger Zeitzyklus dauert sieben Echtzeit-Minuten: fünf Minuten Tageslicht und zwei Minuten Nacht.

Die Archipelkarte wird mit `M` hervorgeholt und mit einem weiteren Druck auf `M` wieder eingesteckt. Sie zeigt zunächst vierzehn Inseln; nach dem Kartenfund in der Schatztruhe kommt die ferne Rieseninsel hinzu; die drei kleinen Außeninseln markieren den westlichen, nördlichen und südöstlichen Rand. Die aktuelle Insel wird hervorgehoben; ein rot-weißer Pfeil markiert die genaue Spielerposition und dreht sich mit der Blickrichtung. Auch auf offenem Meer bleibt der Pfeil am Kartenrand sichtbar.

Das Expeditions-Notizbuch wird mit `N` geöffnet. Im Story-Teil werden alle bereits gelesenen Briefe von Elias dauerhaft zum Nachlesen gesammelt. Der Insel-Teil verzeichnet jede betretene Insel sowie die dort tatsächlich gefundenen Rohstoffe und beobachteten Tierarten. Dadurch lässt sich später gezielt nachschlagen, wo sich ein benötigtes Material farmen lässt. Alle Einträge werden automatisch im Spielstand gespeichert.

## Starten

Voraussetzungen: aktuelles Node.js, Desktop-Browser mit WebGL2 sowie Maus und Tastatur.

```bash
npm install
npm run dev
```

Vite startet die Entwicklungsversion standardmäßig unter `http://127.0.0.1:4173`.

## Steuerung

- `WASD`: bewegen beziehungsweise Floß steuern
- Maus: umsehen, Linksklick: Werkzeug benutzen oder bauen
- `Shift`: sprinten, `Space`: springen/auftauchen, `Strg`: abtauchen
- Beim Schwimmen folgt `W/S` der Blickrichtung: nach oben schauen lässt dich aufsteigen, nach unten schauen lässt dich abtauchen
- `E`: aufnehmen, benutzen, Floß betreten/verlassen
- `F`: Werkbank benutzen und vollständiges Herstellungsmenü öffnen
- `1`–`4`: Schnellzugriff, `Tab`: Inventar, `C`: Crafting, `B`: Bauen
- `M`: Karte hervorholen oder wieder einstecken
- `N`: Expeditions-Notizbuch öffnen oder schließen
- `R`: Bauvorschau drehen, `Esc`: Pause

## Qualitätssicherung

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Die Playwright-Suite prüft Chromium, Microsoft Edge und Firefox seriell, damit mehrere gleichzeitige WebGL-Welten die Messergebnisse nicht verfälschen. Die Unit-/Simulationstests decken unter anderem Manifest und Ressourcenbilanz, Rezepte, Survivalraten, deterministische Seeds, 60-Hz-Fixed-Step, Rapier-Kollisionen, Bauplatzregeln sowie Save-Migration und beschädigte Spielstände ab.

## Statischer Release

Der optimierte Produktionsbuild liegt in `dist/`. `file://` wird wegen ES-Modulen und Browser-Sicherheitsregeln nicht unterstützt.

### GitHub Pages

Dieses Repository ist für die Projektseite `https://<GitHub-Benutzername>.github.io/Stranded2/` vorkonfiguriert. Jeder Push auf `main` baut das Spiel mit GitHub Actions und veröffentlicht ausschließlich den Inhalt von `dist/`.

Nach dem ersten Push muss unter **Settings → Pages → Build and deployment → Source** einmalig **GitHub Actions** ausgewählt werden. Der Status des Deployments erscheint anschließend im Tab **Actions** und die fertige URL unter **Settings → Pages**.

Falls das GitHub-Repository umbenannt wird, muss `base` in `vite.config.ts` ebenfalls auf `/<neuer-repository-name>/` geändert werden. Bei einer eigenen Domain oder einem Repository namens `<GitHub-Benutzername>.github.io` ist stattdessen `base: "/"` erforderlich.

Spielstände, Backup und versionierte Einstellungen werden ausschließlich lokal und asynchron in getrennten IndexedDB-Bereichen gespeichert. Es gibt kein Backend und keine externen Laufzeitanfragen.

## Lizenz

Der eigene Quellcode steht unter der [MIT-Lizenz](LICENSE). Die eingebundenen Modelle, Texturen und Sounds sind davon ausgenommen und stehen unter ihren jeweils mitgelieferten CC0-, CC-BY-3.0- oder CC-BY-4.0-Lizenzen. Urheber, Quellen und lokale Lizenzdateien sind in [CREDITS.md](CREDITS.md) vollständig aufgeführt und müssen bei Weiterverteilung erhalten bleiben.
