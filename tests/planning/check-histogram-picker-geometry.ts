// R2a-opvolgpunt: headless geometrietest voor de histogram-resourcekiezerlijst.
//
// `histogramPickerTrackHeight`/`histogramPickerMaxScroll` (`src/engine/renderer/
// HistogramRenderer.ts`) zijn de pure functies die de scroll-eigenaar (buiten de renderer)
// gebruikt om de kiezerlijst binnen de strook te laten scrollen, met de gepinde "alle
// resources"-somrij als vast anker op index 0. `pickerAt` is de bijbehorende hit-test op de
// HistogramRenderer-instantie. Deze batterij toetst dat drie los aanroepbare stukken exact
// dezelfde geometrie delen (geen losse, uit de pas lopende herberekening bij tekenen vs.
// hit-testen vs. de scroll-hook).
//
// Draait via run.sh. Exit 0 = alles groen.

import {
  HistogramRenderer,
  histogramPickerTrackHeight,
  histogramPickerMaxScroll,
  type HistogramRenderOptions,
  type HistogramPickerItem,
} from '@/engine/renderer/HistogramRenderer';
import type { ViewState } from '@/types/view';
import type { HistogramPalette } from '@/engine/renderer/themePalette';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, actual: unknown, expected: unknown): void {
  ok(`${label} (kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)})`, actual === expected);
}

// Neutrale test-view: alleen `viewStartDate` wordt door de constructor gelezen
// (`parseDate(opts.view.viewStartDate)`); de rest doet voor deze geometrietoetsen niet ter zake.
const FAKE_VIEW = { viewStartDate: '2026-01-01' } as unknown as ViewState;

// Expliciet meegegeven palet zodat de constructor NIET `readHistogramPalette()` aanroept
// (die leest `getComputedStyle(document.documentElement)`, wat in deze headless Node-run
// niet bestaat) — puur/headless-testbaar precies zoals de renderer bedoeld is.
const FAKE_PALETTE: HistogramPalette = {
  bg: '#fff', surfaceAlt: '#fff', grid: '#eee', border: '#ddd', text: '#000',
  textDim: '#666', accent: '#000', hover: 'rgba(0,0,0,0.05)', active: 'rgba(0,0,0,0.08)',
  barNormal: '#000', barOver: '#f00', capacity: '#666',
};

// `ctx` wordt door de constructor alleen opgeslagen, nooit aangeroepen (dat gebeurt pas in
// `render()`, die deze batterij niet aanroept) — een lege stub volstaat.
const FAKE_CTX = {} as unknown as CanvasRenderingContext2D;

function picker(n: number): HistogramPickerItem[] {
  const items: HistogramPickerItem[] = [{ id: undefined, label: 'Alle resources', overallocated: false }];
  for (let i = 0; i < n; i++) {
    items.push({ id: `r${i}`, label: `Resource ${i}`, overallocated: false });
  }
  return items;
}

function makeRenderer(opts: Partial<HistogramRenderOptions> & { canvasHeight: number; picker: HistogramPickerItem[] }): HistogramRenderer {
  const full: HistogramRenderOptions = {
    series: { load: {}, capacity: {}, overSet: new Set() },
    picker: opts.picker,
    view: FAKE_VIEW,
    canvasWidth: 800,
    canvasHeight: opts.canvasHeight,
    pickerWidth: 160,
    pickerSide: opts.pickerSide,
    labels: { unitsSuffix: 'u' },
    palette: FAKE_PALETTE,
    pickerScrollY: opts.pickerScrollY,
  };
  return new HistogramRenderer(FAKE_CTX, full);
}

// ── 1. Standaardgeval: 160px hoog, 30 resources (+ gepinde somrij) ──────────
// rowH = 18 (fontScale 1), trackHeight = 160 - 8 - 18 = 134.
// scrollableCount = 31 - 1 = 30 → maxScroll = 30*18 - 134 = 540 - 134 = 406.
{
  const trackHeight = histogramPickerTrackHeight(160);
  eq('standaardgeval: trackHeight', trackHeight, 134);
  const maxScroll = histogramPickerMaxScroll(picker(30).length, 160);
  eq('standaardgeval: maxScroll', maxScroll, 406);
}

// ── 2. Precies passende lijst: geen scroll nodig (maxScroll 0) ─────────────
// canvasHeight 170 → trackHeight = 170 - 8 - 18 = 144. Met 8 resources: scrollableCount 8,
// 8*18 = 144 = trackHeight exact → maxScroll 0 (niet negatief, niet positief).
{
  const trackHeight = histogramPickerTrackHeight(170);
  eq('precies passend: trackHeight', trackHeight, 144);
  const maxScroll = histogramPickerMaxScroll(picker(8).length, 170);
  eq('precies passend: maxScroll is exact 0', maxScroll, 0);

  // Ruim onder de trackHeight moet ook gewoon 0 geven (geen scroll, geen negatieve waarde).
  const maxScrollSmall = histogramPickerMaxScroll(picker(2).length, 170);
  eq('ruim passend: maxScroll blijft 0', maxScrollSmall, 0);
}

// ── 3. Nul resources: lege lijst (alleen de theoretische somrij, itemCount 0) ───
{
  const maxScroll = histogramPickerMaxScroll(0, 160);
  eq('nul resources: maxScroll is 0', maxScroll, 0);
  const trackHeight = histogramPickerTrackHeight(160);
  ok('nul resources: trackHeight blijft positief (canvas zelf ongewijzigd)', trackHeight === 134);
}

// ── 4. `pickerAt` bij volle scroll geeft de LAATSTE resource terug ──────────
// 30 resources, canvasHeight 160 → maxScroll 406 (zie case 1). Bij pickerScrollY = maxScroll
// moet de onderste zichtbare rij in de scrollzone de laatste resource (index 30, id "r29") zijn.
{
  const list = picker(30);
  const maxScroll = histogramPickerMaxScroll(list.length, 160);
  const renderer = makeRenderer({ canvasHeight: 160, picker: list, pickerScrollY: maxScroll });

  // TOP_PAD=8, rowH=18 → scrollzone begint op y=26. Bij volle scroll (pickerScrollY = maxScroll
  // = 406) staat de LAATSTE resource ('r29', picker[30]) precies onderaan de canvas (y=159,
  // canvasHeight-1) — dat is exact het doel van `maxScroll`: verder scrollen kan niet, en de
  // onderkant van de trackHeight toont dan ook de onderkant van de lijst.
  const hit = renderer.pickerAt(10, 159);
  eq('volle scroll: pickerAt onderaan de canvas raakt de laatste resource', hit?.id, 'r29');

  // Ruim voorbij het einde van de lijst (buiten de canvas) geeft geen hit meer.
  const beyond = renderer.pickerAt(10, 1000);
  ok('volle scroll: pickerAt ver voorbij de lijst geeft null', beyond === null);

  // De gepinde somrij blijft op scroll 0 ongeacht pickerScrollY.
  const pinned = renderer.pickerAt(10, 9);
  ok('volle scroll: de gepinde somrij (index 0) blijft bereikbaar op zijn vaste positie', pinned?.id === undefined);
}

// ── 4b. G13: in ar/fa staat de kiezer rechts (onder de gespiegelde takenlijst) ─────────────
// Zelfde rijgeometrie en scroll, alleen op x 640..800 van een 800 px breed canvas. Links daarvan
// ligt de plot, waar de kiezer niets raakt.
{
  const list = picker(30);
  const maxScroll = histogramPickerMaxScroll(list.length, 160);
  const renderer = makeRenderer({ canvasHeight: 160, picker: list, pickerScrollY: maxScroll, pickerSide: 'right' });
  eq('rtl, volle scroll: onderaan de kiezer de laatste resource', renderer.pickerAt(650, 159)?.id, 'r29');
  ok('rtl: de gepinde somrij blijft bereikbaar', renderer.pickerAt(799, 9)?.id === undefined
    && renderer.pickerAt(799, 9) !== null);
  ok('rtl: links van de kiezer (de plot) geen kiezerhit', renderer.pickerAt(639, 159) === null);
  ok('rtl: x = 10 (de oude kiezerplek) is plot, geen kiezerhit', renderer.pickerAt(10, 9) === null);
}

// ── 5. Kiezerlabels afkappen: dezelfde `ellipsize` als de Gantt ─────────────────────────────
// De eigen afkapfunctie tekende altijd minstens één teken + "…", ook als er geen ruimte was, en
// knipte op UTF-16-code-units (een half surrogaatpaar vóór de ellips).
{
  const texts: string[] = [];
  const noop = () => undefined;
  const ctx = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 6 });
      if (prop === 'fillText') return (text: string) => { texts.push(text); };
      return noop;
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const labelsFor = (pickerWidth: number, label: string): string[] => {
    texts.length = 0;
    new HistogramRenderer(ctx, {
      series: { load: {}, capacity: {}, overSet: new Set() },
      picker: [{ id: 'r', label, overallocated: false }],
      view: FAKE_VIEW, canvasWidth: 800, canvasHeight: 160, pickerWidth,
      labels: { unitsSuffix: 'u' }, palette: FAKE_PALETTE,
    }).render();
    return texts.filter(text => text === '' || text.includes('…') || text === label);
  };
  // pickerWidth 60: tekst op x = 20, maxW = 60 − 20 − 4 = 36 px = 6 tekens (inclusief "…").
  eq('label: past niet ⇒ afgekapt met ellips', labelsFor(60, 'Grondwerkers ploeg').join('|'), 'Grond…');
  eq('label: knipt niet midden in een surrogaatpaar', labelsFor(60, '𝒜𝒜𝒜𝒜𝒜𝒜𝒜').join('|'), '𝒜𝒜…');
  eq('label: geen ruimte ⇒ niets, geen losse letter + ellips', labelsFor(20, 'Grondwerkers').join('|'), '');
}

console.log(`histogram-picker-geometry: ${checks} checks, ${diffs.length} afwijkingen`);
if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX ${d}`);
  process.exit(1);
}
