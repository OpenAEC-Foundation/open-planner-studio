import { placeGuidePanel, type GuidePlacementInput, type PlacementRect } from '@/components/guide/guidePlacement';
import { computeToastPlacement } from '@/components/layout/toastPlacement';

const failures: string[] = [];
const expect = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const rect = (left: number, top: number, width: number, height: number): PlacementRect =>
  ({ left, top, right: left + width, bottom: top + height });

function layout(w: number, h: number, panelHeight = 400): Pick<GuidePlacementInput, 'expanded' | 'compact'> {
  const bottom = h - 24 - 12;
  return {
    expanded: { end: rect(w - 12 - 320, bottom - panelHeight, 320, panelHeight), start: rect(12, bottom - panelHeight, 320, panelHeight) },
    compact: { end: rect(w - 12 - 160, bottom - 34, 160, 34), start: rect(12, bottom - 34, 160, 34) },
  };
}

expect('niets in de weg → eindkant',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: null, dialogs: [] }),
  { side: 'end', autoCompact: false });

expect('anker weg → terug naar de eindkant (knownbugs 59)',
  placeGuidePanel({ ...layout(1366, 768), current: 'start', anchor: null, dialogs: [] }),
  { side: 'end', autoCompact: false });

expect('anker onder het paneel, andere kant vrij → beginkant',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: rect(1000, 900, 200, 40), dialogs: [] }),
  { side: 'start', autoCompact: false });

expect('anker raakt beide kanten, geen venster → blijft staan',
  placeGuidePanel({ ...layout(1280, 1050), current: 'start', anchor: rect(0, 300, 1280, 700), dialogs: [] }),
  { side: 'start', autoCompact: false });

const calendar1280 = rect(210, 53, 860, 945);
expect('Kalenders op 1280×1050 → vanzelf ingeklapt (knownbugs 91)',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: null, dialogs: [calendar1280] }),
  { side: 'end', autoCompact: true });
const calendar1366 = rect(253, 38, 860, 691);
expect('Kalenders op 1366×768 → vanzelf ingeklapt (knownbugs 91)',
  placeGuidePanel({ ...layout(1366, 768), current: 'end', anchor: null, dialogs: [calendar1366] }),
  { side: 'end', autoCompact: true });

expect('knopje rechts bedekt het venster → knopje links',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: null, dialogs: [rect(200, 53, 1075, 980)] }),
  { side: 'start', autoCompact: true });

expect('Kalenders op 1920×1080 → uitgeklapt rechts',
  placeGuidePanel({ ...layout(1920, 1080), current: 'end', anchor: null, dialogs: [rect(530, 54, 860, 972)] }),
  { side: 'end', autoCompact: false });

expect('klein venster in het midden → uitgeklapt',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: null, dialogs: [rect(420, 300, 440, 300)] }),
  { side: 'end', autoCompact: false });

expect('venster rechts, anker links → ingeklapt, knopje links',
  placeGuidePanel({ ...layout(1280, 1050), current: 'end', anchor: rect(20, 700, 200, 40), dialogs: [rect(900, 300, 370, 700)] }),
  { side: 'start', autoCompact: true });

expect('melding naast begeleiding rechts',
  computeToastPlacement({ width: 1600, height: 950 }, [rect(1268, 514, 320, 400)], []),
  { kind: 'side', left: 16, right: 348, bottom: 24 });
expect('melding naast dialoog én begeleiding rechts',
  computeToastPlacement({ width: 1600, height: 950 }, [rect(480, 150, 640, 650), rect(1268, 514, 320, 400)], []),
  { kind: 'side', left: 16, right: 1136, bottom: 24 });
expect('begeleiding links: melding wijkt naar rechts',
  computeToastPlacement({ width: 1600, height: 950 }, [rect(12, 514, 320, 400)], []),
  { kind: 'side', left: 348, right: 16, bottom: 24 });
expect('geen ruimte naast begeleiding: meldingen eronder in de stapelvolgorde',
  computeToastPlacement({ width: 360, height: 640 }, [rect(12, 204, 336, 400)], []),
  { kind: 'underModal' });

if (failures.length > 0) {
  console.log(`XX guide-placement: ${failures.length} afwijking(en)`);
  for (const failure of failures) console.log(`   - ${failure}`);
  process.exit(1);
}
console.log('OK guide-placement: paneel wijkt uit voor anker en venster, klapt in als het nergens past');
