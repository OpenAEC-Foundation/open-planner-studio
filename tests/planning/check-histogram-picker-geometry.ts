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

const FAKE_VIEW = { viewStartDate: '2026-01-01' } as unknown as ViewState;

const FAKE_PALETTE: HistogramPalette = {
  bg: '#fff', surfaceAlt: '#fff', grid: '#eee', border: '#ddd', text: '#000',
  textDim: '#666', accent: '#000', hover: 'rgba(0,0,0,0.05)', active: 'rgba(0,0,0,0.08)',
  barNormal: '#000', barOver: '#f00', capacity: '#666',
};

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

{
  const trackHeight = histogramPickerTrackHeight(160);
  eq('standaardgeval: trackHeight', trackHeight, 134);
  const maxScroll = histogramPickerMaxScroll(picker(30).length, 160);
  eq('standaardgeval: maxScroll', maxScroll, 406);
}

{
  const trackHeight = histogramPickerTrackHeight(170);
  eq('precies passend: trackHeight', trackHeight, 144);
  const maxScroll = histogramPickerMaxScroll(picker(8).length, 170);
  eq('precies passend: maxScroll is exact 0', maxScroll, 0);

  const maxScrollSmall = histogramPickerMaxScroll(picker(2).length, 170);
  eq('ruim passend: maxScroll blijft 0', maxScrollSmall, 0);
}

{
  const maxScroll = histogramPickerMaxScroll(0, 160);
  eq('nul resources: maxScroll is 0', maxScroll, 0);
  const trackHeight = histogramPickerTrackHeight(160);
  ok('nul resources: trackHeight blijft positief (canvas zelf ongewijzigd)', trackHeight === 134);
}

{
  const list = picker(30);
  const maxScroll = histogramPickerMaxScroll(list.length, 160);
  const renderer = makeRenderer({ canvasHeight: 160, picker: list, pickerScrollY: maxScroll });

  const hit = renderer.pickerAt(10, 159);
  eq('volle scroll: pickerAt onderaan de canvas raakt de laatste resource', hit?.id, 'r29');

  const beyond = renderer.pickerAt(10, 1000);
  ok('volle scroll: pickerAt ver voorbij de lijst geeft null', beyond === null);

  const pinned = renderer.pickerAt(10, 9);
  ok('volle scroll: de gepinde somrij (index 0) blijft bereikbaar op zijn vaste positie', pinned?.id === undefined);
}

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
  eq('label: past niet ⇒ afgekapt met ellips', labelsFor(60, 'Grondwerkers ploeg').join('|'), 'Grond…');
  eq('label: knipt niet midden in een surrogaatpaar', labelsFor(60, '𝒜𝒜𝒜𝒜𝒜𝒜𝒜').join('|'), '𝒜𝒜…');
  eq('label: geen ruimte ⇒ niets, geen losse letter + ellips', labelsFor(20, 'Grondwerkers').join('|'), '');
}

console.log(`histogram-picker-geometry: ${checks} checks, ${diffs.length} afwijkingen`);
if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX ${d}`);
  process.exit(1);
}
