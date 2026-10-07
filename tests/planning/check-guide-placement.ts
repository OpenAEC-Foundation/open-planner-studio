// De plek van het begeleidingspaneel (`src/components/guide/guidePlacement.ts`), met de echte maten
// uit de tutorials: het venster Kalenders is 860 breed en bijna schermhoog, het paneel 320 breed.
// knownbugs 91 (paneel over Toepassen), 59 (paneel springt niet terug) en het vanzelf inklappen.
import { placeGuidePanel, type GuidePlacementInput, type PlacementRect } from '@/components/guide/guidePlacement';

const failures: string[] = [];
const expect = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const rect = (left: number, top: number, width: number, height: number): PlacementRect =>
  ({ left, top, right: left + width, bottom: top + height });

/** Paneel en knopje onderaan een venster van `w`×`h` (statusbalk 24, marge 12). */
function layout(w: number, h: number, panelHeight = 400): Pick<GuidePlacementInput, 'expanded' | 'compact'> {
  const bottom = h - 24 - 12;
  return {
    expanded: { end: rect(w - 12 - 320, bottom - panelHeight, 320, panelHeight), start: rect(12, bottom - panelHeight, 320, panelHeight) },
    compact: { end: rect(w - 12 - 160, bottom - 34, 160, 34), start: rect(12, bottom - 34, 160, 34) },
  };
}

// Zonder anker en zonder venster: rechtsonder (eindkant).
expect('niets in de weg → eindkant',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: null, dialogs: [] }),
  { side: 'end', autoCompact: false });

// 59: het paneel stond links omdat een anker rechts lag; dat anker is weg → terug naar rechts.
expect('anker weg → terug naar de eindkant (knownbugs 59)',
  placeGuidePanel({ ...layout(1366, 768), current: 'start', anchor: null, dialogs: [] }),
  { side: 'end', autoCompact: false });

// Anker rechtsonder → uitwijken naar links.
expect('anker onder het paneel, andere kant vrij → beginkant',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: rect(1000, 900, 200, 40), dialogs: [] }),
  { side: 'start', autoCompact: false });

// Een anker over de hele breedte (Gantt-kaart): niets verschuift, niets klapt in.
expect('anker raakt beide kanten, geen venster → blijft staan',
  placeGuidePanel({ ...layout(1280, 1050), current: 'start', anchor: rect(0, 300, 1280, 700), dialogs: [] }),
  { side: 'start', autoCompact: false });

// 91: Kalenders op 1280×1050 (210,53 860×945): het paneel past aan geen kant; het knopje wel in de rand.
const calendar1280 = rect(210, 53, 860, 945);
expect('Kalenders op 1280×1050 → vanzelf ingeklapt (knownbugs 91)',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: null, dialogs: [calendar1280] }),
  { side: 'end', autoCompact: true });
const calendar1366 = rect(253, 38, 860, 691);
expect('Kalenders op 1366×768 → vanzelf ingeklapt (knownbugs 91)',
  placeGuidePanel({ ...layout(1366, 768), current: 'end', anchor: null, dialogs: [calendar1366] }),
  { side: 'end', autoCompact: true });

// Een venster van x 200 tot 1275: het paneel past nergens; het knopje rechts ligt over het venster, links niet.
expect('knopje rechts bedekt het venster → knopje links',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: null, dialogs: [rect(200, 53, 1075, 980)] }),
  { side: 'start', autoCompact: true });

// Kalenders op 1920×1080 (530,54 860×972): het paneel past ernaast, uitgeklapt.
expect('Kalenders op 1920×1080 → uitgeklapt rechts',
  placeGuidePanel({ ...layout(1920, 1080), current: 'end', anchor: null, dialogs: [rect(530, 54, 860, 972)] }),
  { side: 'end', autoCompact: false });

// Een klein venster midden in beeld raakt het paneel niet.
expect('klein venster in het midden → uitgeklapt',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: null, dialogs: [rect(420, 300, 440, 300)] }),
  { side: 'end', autoCompact: false });

// Een venster rechts en het anker links: geen kant vrij, het venster wordt geraakt → inklappen; het
// knopje links blijft onder het anker vandaan, dus daar.
expect('venster rechts, anker links → ingeklapt, knopje links',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: rect(20, 700, 200, 40), dialogs: [rect(900, 300, 370, 700)] }),
  { side: 'start', autoCompact: true });

if (failures.length > 0) {
  console.log(`XX guide-placement: ${failures.length} afwijking(en)`);
  for (const failure of failures) console.log(`   - ${failure}`);
  process.exit(1);
}
console.log('OK guide-placement: paneel wijkt uit voor anker en venster, klapt in als het nergens past');
