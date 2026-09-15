# Prüfung der Spielmechaniken

Stand: 15. September 2026

## Behobene Probleme

| Bereich | Korrektur |
| --- | --- |
| Werkzeugauswahl | Jedes Werkzeug lässt sich über „Benutzen“ im Inventar auf Schnellzugriff 1 auswählen, auch mit mehr als vier Werkzeugarten. |
| Inventarsteuerung | Tab öffnet und schließt das Inventar. Bereits von der Oberfläche behandelte Tastendrücke werden nicht nochmals als Spielaktion verarbeitet. |
| Stapelaktionen | Essen, Ablegen und Truhentransfers verwenden den ausgewählten Platz samt Resthaltbarkeit. Ein volles Ziel verändert den Ursprungsplatz nicht. |
| Crafting | Materialverbrauch und Ausgabe werden gemeinsam übernommen. Fehlgeschlagenes Crafting erzeugt keine Teilprodukte und setzt die Frische der Zutaten nicht zurück. Ein zusätzlich hergestelltes Werkzeug repariert das bereits verwendete nicht. |
| Kochen | Fertige Nahrung bleibt bei vollem Rucksack auf dem Grill und lässt sich auch bei erloschenem Feuer abholen. Die Garzeit berücksichtigt nur tatsächlich vorhandenen Brennstoff. |
| Nahrung | Resthaltbarkeit bleibt beim Ablegen, Aufnehmen, Tod und Speichern erhalten. Nahrung am Boden und in verlorenen Rucksäcken verdirbt weiter. Abgelegte Krabben sind wieder aufnehmbar. |
| Schlaf | Hunger, Durst und Brackwasserkrankheit laufen für die verstrichene Zeit weiter. Gift, Blutung und Verderb bleiben aktiv. Tödlicher Schlaf führt zur Todesansicht. |
| Produktion | Destillen, Regenfänger, Reusen, Feuer und Räuchergestelle arbeiten während des Schlafs weiter. Volle Wasserspeicher sammeln keinen ungültigen überschüssigen Fortschritt an. |
| Bauen | Bauplatz und Bauhammer werden unmittelbar beim Platzieren erneut geprüft. Eine alte gültige Bauvorschau genügt nicht. |
| Tod und Respawn | Die Tageszeit bleibt beim Respawn erhalten. Bauvorschauen werden beim Tod abgebrochen. Der letzte Spielstand wird nicht mit null Gesundheit überschrieben; die Rückkehr ins Hauptmenü bleibt möglich. |
| Speichern | Verlorene große Rucksäcke mit 36 Stapeln sind ladbar. Widersprüchliche Inventarplätze und ungültige Frischewerte werden zurückgewiesen. Aktueller Stand und Backup werden in derselben Datenbanktransaktion aktualisiert. Speicherzugriffe können nach vorübergehenden Fehlern erneut versucht werden. |
| Dokumentation und Tests | Die dokumentierte Tagesdauer entspricht wieder den vorhandenen Regeln: sieben Minuten Tag, drei Minuten Nacht. Der Behandlungstest unterscheidet einfachen Verband, Kräuterverband, Gegengift und Heilkraut. |

## Umfang

Geprüft wurden die zentralen Spielabläufe und ihre Verknüpfungen anhand des Quellcodes, der Unit-/Simulationstests und der vorhandenen Browser-Suite. Die automatischen Prüfungen umfassen unter anderem Rezepte, Ressourcen, Survival, Schwimmen, Physik, Bauen, Floßfahrten, Speicherung, Wiederherstellung und Fehleransichten. Ergänzte Regressionstests prüfen insbesondere die oben behobenen Grenzfälle.

Die Prüfung ist keine Garantie für jede mögliche Spielsituation oder Hardwarekonfiguration. Die Browser-Suite verwendet für einige Spielzustände die vorhandene Debug-Schnittstelle.

## Abschließende Prüfergebnisse

- Typprüfung: erfolgreich.
- Produktionsbuild: erfolgreich; Ausgabe in dist/.
- Unit-/Simulationstests: 211 bestanden im Gesamtlauf mit 26 Dateien; anschließend ein zusätzlicher Regressionstest für synchrone Schreibfehler ergänzt. Alle drei betroffenen Speichertests bestehen im gezielten Nachtest, damit insgesamt 212 geprüfte Tests. Ein separater Abschlusslauf ohne Browserlast bestätigte auch die zuvor durch Zeitlimits abgebrochenen Weltaufbautests.
- Browser-Suite: jeweils 11 Tests in Chromium und Microsoft Edge bestanden, insgesamt 22. Nach der letzten Korrektur wurden die vier betroffenen Speicherprüfungen in beiden Browsern erfolgreich wiederholt.
- Firefox: Alle 11 Tests scheitern vor dem Laden des Spiels beim Anlegen einer Browserseite. Die unabhängige Reproduktion mit Firefox 153.0, neuem Browserkontext und einer leeren Seite scheitert ebenfalls mit browserContext.newPage: Cannot read properties of undefined (reading '_page'). Die Firefox-Kompatibilität bleibt in dieser Umgebung unbestätigt.
- Git-Diff: keine Whitespace-Fehler.

Ausgeführt wurden die lokalen CLIs direkt über Node (TypeScript, Vitest, Playwright und Vite), da die vorhandene npm-Verknüpfung auf eine fehlende npm-cli.js verweist. Die Rechnerinstallation wurde nicht verändert.
