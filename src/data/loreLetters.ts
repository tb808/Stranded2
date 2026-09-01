import type { IslandId } from './worldManifest';

export interface LoreLetterDefinition {
  readonly id: string;
  readonly islandId: IslandId;
  readonly sequence: number;
  readonly title: string;
  readonly dateLabel: string;
  readonly locationLabel: string;
  readonly paragraphs: readonly string[];
  readonly signature: string;
}

export const LORE_LETTERS = [
  {
    id: 'letter-start-beach',
    islandId: 'kleine-sandbank',
    sequence: 1,
    title: 'Der erste Morgen',
    dateLabel: 'Tag 1',
    locationLabel: 'Startstrand · Kleine Sandbank',
    paragraphs: [
      'Falls jemand diese Zeilen findet: Mein Name ist Elias Voss. In der Nacht hat der Sturm mein Boot zerschlagen. Ich erwachte im Sand, mit Salz in den Augen und nichts bei mir außer einem stumpfen Messer.',
      'Die erste Kokosnuss stillte den Durst, aber ich lernte schnell, sparsam zu sein. Aus Palmwedeln baute ich ein niedriges Dach, aus trockenen Fasern eine Schnur. Mein erstes Feuer brannte erst beim sechsten Versuch.',
      'Ich werde an jedem Ort einen Brief zurücklassen. Vielleicht folgt eines Tages jemand meiner Spur. Heute zählt nur eines: Wasser finden und die nächste Nacht erleben.',
    ],
    signature: 'Elias',
  },
  {
    id: 'letter-wreck-cargo',
    islandId: 'dschungelbucht',
    sequence: 2,
    title: 'Wasser und Zähne',
    dateLabel: 'Tag 6',
    locationLabel: 'Wrackfracht · Dschungelbucht',
    paragraphs: [
      'Aus den Resten meines Bootes habe ich ein kleines Floß gebunden. Die Strömung trug mich in diese Bucht. Hinter den Bäumen fand ich endlich Süßwasser – klarer, als ich es mir in den letzten Tagen erträumt hatte.',
      'Mit einem scharf geschlagenen Stein und einem festen Ast machte ich eine Axt. Damit fällte ich genug Holz für ein richtiges Lager. Das Feuer hält die Tiere fern, solange ich nicht vergesse, Holz nachzulegen.',
      'Ein Wildschwein riss mir gestern den Proviantbeutel auf. Ich habe gelernt, Nahrung hoch aufzuhängen und nie ohne Speer ins Dickicht zu gehen. Überleben besteht hier vor allem daraus, denselben Fehler kein zweites Mal zu machen.',
    ],
    signature: 'Elias Voss',
  },
  {
    id: 'letter-fisher-camp',
    islandId: 'palmenlagune',
    sequence: 3,
    title: 'Die ruhige Lagune',
    dateLabel: 'Tag 14',
    locationLabel: 'Fischerlager · Palmenlagune',
    paragraphs: [
      'Die Lagune ist mein erster Ort, der sich beinahe wie ein Zuhause anfühlt. Zwischen zwei Pfählen hängt eine Reuse aus biegsamen Zweigen. Bei Ebbe füllt sie sich mit kleinen Fischen und Krabben.',
      'Ich gare nur, was ich am selben Tag esse. Den Rest räuchere ich langsam über dem Feuer. So habe ich Vorräte für Regen und Überfahrten. In einem ausgehöhlten Stamm sammle ich Wasser; Kokosnüsse sind nur noch meine Reserve.',
      'Das Floß hat jetzt einen festen Boden und ein Paddel. An der Zeltstange ritze ich Windrichtung und Gezeiten ein. Ich bin nicht mehr nur ein Schiffbrüchiger. Langsam werde ich zum Bewohner dieser Inseln.',
    ],
    signature: 'Elias',
  },
  {
    id: 'letter-mangrove-walkway',
    islandId: 'mangrovenbucht',
    sequence: 4,
    title: 'Über schwarzem Wasser',
    dateLabel: 'Tag 27',
    locationLabel: 'Stegrest · Mangrovenbucht',
    paragraphs: [
      'Hier bleibt alles feucht. Das Holz fault, Salz setzt sich auf die Haut und das dunkle Wasser darf man niemals trinken. Ich habe meine Schlafstelle auf Pfähle gesetzt und jedes Seil doppelt geknotet.',
      'Im Schlamm liegen Krokodile so still wie alte Stämme. Ich prüfe das Ufer mit dem Speer, bevor ich einen Fuß hinsetze. Eine kleine bittere Pflanze half gegen die Entzündung an meinem Bein; einige Blätter habe ich zum Trocknen aufgehängt.',
      'Der Mangrovenwald gibt reichlich Fasern und Krabben, verlangt dafür aber Geduld. Ich bewege mich langsam, lausche und verschwende kein trockenes Holz. Hast ist auf dieser Insel gefährlicher als Hunger.',
    ],
    signature: 'Elias Voss',
  },
  {
    id: 'letter-reef-path',
    islandId: 'felsenriff',
    sequence: 5,
    title: 'Der Wind dreht',
    dateLabel: 'Tag 39',
    locationLabel: 'Riffpfad · Felsenriff',
    paragraphs: [
      'Ein Sturm zwang mich, das Floß zwischen den Felsen an Land zu ziehen. Drei Tage lang peitschte die Brandung über das Riff. Ich verkeilte den Boden mit Steinen und nähte die gerissenen Seile mit neuen Fasern zusammen.',
      'Auf der kargen Insel wächst wenig. Ich sammelte Krabben in den flachen Becken und schlug harte Riffsteine zu Werkzeugen. Das wichtigste Gut blieb trockenes Brennmaterial; ich trug es unter der Kleidung, damit der Regen es nicht erreichte.',
      'Nachts lernte ich, die Richtung an den Sternen zu halten. Der Wind dreht kurz vor Sonnenaufgang nach Osten. Wer das Meer beobachtet, bevor er es betritt, muss weniger gegen es kämpfen.',
    ],
    signature: 'Elias',
  },
  {
    id: 'letter-waterfall-ruins',
    islandId: 'wasserfallinsel',
    sequence: 6,
    title: 'Wo das Wasser fällt',
    dateLabel: 'Tag 55',
    locationLabel: 'Überwucherte Ruinen · Wasserfallinsel',
    paragraphs: [
      'Seit zwei Wochen lebe ich nahe dem Wasserfall. Zum ersten Mal muss ich Wasser nicht zählen. Ich habe eine Rinne aus Bambus gebaut, die es bis zum Lager führt, und Fleisch im trockenen Luftzug hinter den Felsen geräuchert.',
      'Nach einem Fieber fehlte mir die Kraft zum Jagen. Mangos, Brühe und die Kräuter aus den Mangroven brachten mich durch vier schwere Tage. Seitdem bewahre ich immer Nahrung für eine Woche auf, auch wenn ringsum alles reichlich scheint.',
      'Die Ruinen schützen vor Wind, doch der Dschungel holt sich jeden freien Platz zurück. Jeden Morgen bessere ich Dach, Feuer und Vorräte aus. Ein Zuhause ist hier kein Gebäude – es ist eine Arbeit, die niemals ganz fertig wird.',
    ],
    signature: 'Elias Voss',
  },
  {
    id: 'letter-mountain-outpost',
    islandId: 'dschungelberg',
    sequence: 7,
    title: 'Über den Wolken',
    dateLabel: 'Tag 78',
    locationLabel: 'Berg-Außenposten · Dschungelberg',
    paragraphs: [
      'Der Aufstieg kostete mich zwei Tage. Aus Lianen und Stoffresten knüpfte ich ein Kletterseil und ließ an schwierigen Stellen feste Schlaufen zurück. Oben baute ich einen kleinen Außenposten über dem nassen Nebel.',
      'Von hier sehe ich fast den ganzen Archipel. Ich zeichnete Küsten, Strömungen und sichere Buchten auf ein Stück Segeltuch. Im Südwesten steigt jeden Morgen Rauch aus einer schwarzen Insel; im Norden leuchten helle Klippen.',
      'Ich habe aufgehört, die Tage bis zu meiner Rettung zu zählen. Stattdessen zähle ich Dächer, Werkzeuge und gefüllte Vorratskisten. Ich habe hier nicht nur ausgehalten. Ich habe mir ein Leben gebaut.',
    ],
    signature: 'Elias',
  },
  {
    id: 'letter-volcano-crater',
    islandId: 'vulkaninsel',
    sequence: 8,
    title: 'Schwarzer Boden',
    dateLabel: 'Tag 96',
    locationLabel: 'Feuerkrater · Vulkaninsel',
    paragraphs: [
      'Die schwarze Insel ist heiß genug, um Schuhsohlen weich zu machen. Ich arbeite nur am frühen Morgen und ruhe mittags im Schatten der Felsen. Meine Wasserschläuche vergrabe ich in kühler Asche, weit weg von den roten Rinnen.',
      'Obsidian bricht schärfer als jeder Stein, den ich kenne. Mit einem Splitter fertigte ich mein bestes Messer, doch die Kanten schneiden ebenso leicht in die eigene Hand. Langsame, saubere Arbeit spart Blut und Verbände.',
      'In einer alten Kiste fand ich Metall und haltbare Vorräte. Damit verstärkte ich das Floß für die längste Überfahrt. Der Feuerberg ist kein Ort zum Bleiben, aber er gab mir genau das, was ich zum Weiterziehen brauchte.',
    ],
    signature: 'Elias Voss',
  },
  {
    id: 'letter-flower-stone-circle',
    islandId: 'blueteninsel',
    sequence: 9,
    title: 'Ein stiller Monat',
    dateLabel: 'Tag 121',
    locationLabel: 'Alter Steinkreis · Blüteninsel',
    paragraphs: [
      'Ich blieb einen ganzen Monat auf dieser Insel. Nach Fels, Asche und Sümpfen wirkten die offenen Wiesen unwirklich. Hier konnte ich schlafen, ohne bei jedem Geräusch nach dem Speer zu greifen.',
      'Ich flickte Kleidung, flocht neue Körbe und legte Vorräte aus Kokosnüssen, Räucherfisch und Heilpflanzen an. Die duftenden Blüten halten getrocknet lange; zusammen mit den bitteren Mangrovenblättern beruhigen sie kleine Wunden.',
      'Zum ersten Mal fragte ich mich nicht, wie ich den nächsten Tag überlebe, sondern was ich mit ihm anfangen möchte. Ich setzte Blumen an das Lager und kochte länger als nötig. Auch das gehört zum Leben: etwas zu tun, das nicht bloß notwendig ist.',
    ],
    signature: 'Elias',
  },
  {
    id: 'letter-moon-cliffs',
    islandId: 'mondklippen',
    sequence: 10,
    title: 'Drei Feuer im Wind',
    dateLabel: 'Tag 146',
    locationLabel: 'Windgrat · Mondklippen',
    paragraphs: [
      'Auf den hellen Klippen baute ich drei Signalfeuer. Wochenlang entzündete ich sie bei klarem Himmel und sah nur Meer. Heute erschien am Horizont ein Segel. Kurz vor Sonnenuntergang antwortete es mit drei Lichtzeichen.',
      'Morgen lege ich Wasser, Räucherfisch und mein bestes Werkzeug am Oststrand bereit. Vielleicht kommt das Schiff. Vielleicht muss ich ihm entgegenpaddeln. Ich habe gelernt, Hoffnung wie ein Feuer zu behandeln: schützen, nähren und niemals unbeaufsichtigt lassen.',
      'Wer diese Briefe findet, soll wissen, dass ich hier gelebt habe – nicht nur überlebt. Wasser, Feuer, ein Dach und Geduld brachten mich durch 146 Tage. Alles Weitere begann mit dem Mut, am nächsten Morgen wieder aufzustehen.',
    ],
    signature: 'Elias Voss',
  },
  {
    id: 'letter-treasure-sandbar',
    islandId: 'schatzsandbank',
    sequence: 11,
    title: 'Unter dem Sand',
    dateLabel: 'Tag 163',
    locationLabel: 'Grabungsstelle · Schatzsandbank',
    paragraphs: [
      'Die Strömung setzte mich auf einer winzigen Sandinsel ab. Zwischen den Palmen ragte die Ecke einer schweren Truhe aus dem Boden, doch mit bloßen Händen war sie nicht freizulegen.',
      'Ich zeichnete eine einfache Schaufel auf festes Papier und legte den Bauplan neben die Grabungsstelle. Ein Palmstamm, zwei feste Stöcke und eine Seilbindung reichen aus, wenn das Blatt breit und der Griff gut verschnürt ist.',
      'In der Truhe liegt eine Karte, auf der weit außerhalb dieses Archipels eine Insel von gewaltiger Größe verzeichnet ist. Ich habe sie noch auf keiner meiner eigenen Karten eingetragen. Vielleicht führt die nächste Reise dorthin.',
    ],
    signature: 'Elias',
  },
] as const satisfies readonly LoreLetterDefinition[];

export type LoreLetterId = (typeof LORE_LETTERS)[number]['id'];

export function getLoreLetter(id: string): LoreLetterDefinition | null {
  return LORE_LETTERS.find((letter) => letter.id === id) ?? null;
}
