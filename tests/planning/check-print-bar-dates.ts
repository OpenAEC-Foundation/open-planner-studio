// Issue #868 — begin- en einddatum naast de balken in de afdruk en de PDF (rapportoptie `showBarDates`,
// standaard uit; besluit Ethan 14-11-2026, optie 2).
//
// Met de optie aan staat de begindatum rechts uitgelijnd links vóór de balk en de einddatum rechts
// achter de balk, op de plek waar de naam begon; de naam schuift erachter. Een mijlpaal krijgt één
// datum, tussen de ruit en de naam. De tekst is precies die van de kolommen Start en Einde in dezelfde
// afdruk (`taskOwnCellTexts`). Met de datums aan valt een naam die rechts niet past NIET terug naar
// links (daar staat de begindatum), maar wordt hij rechts afgekapt met "…". De optie werkt ook met
// Taaknamen uit: dan staan alleen de datums er.
//
// Tekent met de ECHTE `renderReport` en een opnemende Draw2D.
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { renderReport, type PrintOptions } from '@/services/print/printPreview';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { TaskTime } from '@/types/task';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const CHAR_W = 6;
const BAR_LABEL_GAP = 6 + 8; // DEP_STUB + 8
const PAD_LEFT = 4;          // BAR_LABEL_PAD_LEFT
const DATE_GAP = 6;          // tussen einddatum en naam

interface TextCall { text: string; x: number; y: number; align: string }
interface Rect { x: number; y: number; w: number; h: number }
function renderPrint(extra: Partial<PrintOptions>) {
  const texts: TextCall[] = [];
  const rects: Rect[] = [];
  const st: Record<string, unknown> = { font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left', textBaseline: 'alphabetic' };
  const noop = () => {};
  const d2d = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash: noop, fillRect: noop, strokeRect: noop, closePath: noop, beginPath: noop, moveTo: noop,
    lineTo: noop, fill: noop, stroke: noop,
    fillText(text: string, x: number, y: number) { texts.push({ text: String(text), x, y, align: String(st.textAlign) }); },
    roundRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h }); },
    measureText: (t: string) => ({ width: String(t).length * CHAR_W }),
  } as unknown as Draw2D;
  const s = S();
  const result = renderReport(() => d2d, s.tasks, s.sequences, s.calendar, 'P', {
    showCritical: true, showFloat: false, showDeps: false, showWeekends: true, showLegend: false,
    showTaskNames: true, showCompletion: false, autoFit: false, customZoom: 24,
    paperSize: 'A3', orientation: 'landscape', companyName: '', barColorSelection: { mode: 'critical' },
    activityCodeTypes: [], customFieldDefs: [], dateNotation: 'dmy', timeNotation: '24h',
    ...extra,
  } as PrintOptions);
  const chart = texts.filter(t => t.x >= result.tableWidth && t.y >= result.headerHeight);
  const rowOf = (y: number) => Math.floor((y - result.headerHeight) / 24);
  const inRow = (row: number) => chart.filter(t => rowOf(t.y) === row);
  const bar = (row: number) => rects.find(r => r.x >= result.tableWidth && r.y >= result.headerHeight && r.h > 8 && rowOf(r.y) === row);
  const table = texts.filter(t => t.x < result.tableWidth && t.y >= result.headerHeight);
  return { chart, table, inRow, bar, tableWidth: result.tableWidth };
}
const fmt = (ts: TextCall[]) => JSON.stringify(ts.map(t => [t.text, Math.round(t.x * 10) / 10, t.align]));
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
const DATE = /^\d{2}-\d{2}-\d{4}$/;

S().newProject();
S().setProject({ name: 'Datums op papier', startDate: '2026-06-01' });
const A = S().addTask({ name: 'Fundering', time: { durationUnit: 'days', scheduleDuration: 5 } as TaskTime });
const M = S().addTask({ name: 'Oplevering', isMilestone: true, time: { durationUnit: 'days', scheduleDuration: 0 } as TaskTime });
S().addSequence({ predecessorId: A, successorId: M, type: 'FINISH_START', lagDays: 0 });
S().runCPM();

// ── Uit (standaard): geen datum naast de balken ──
{
  const p = renderPrint({});
  ok(`uit: geen datum in het chartgebied (${fmt(p.chart)})`, !p.chart.some(t => DATE.test(t.text)));
}

// ── Aan ──
{
  const p = renderPrint({ showBarDates: true });
  const r0 = p.inRow(0);
  const bar0 = p.bar(0);
  ok('opzet: balk van A in rij 0', bar0 !== undefined);
  const start = r0.find(t => t.text === '01-06-2026');
  const eind = r0.find(t => t.text === '05-06-2026');
  const naam = r0.find(t => t.text === 'Fundering');
  if (bar0) {
    ok(`taak: begindatum rechts uitgelijnd links vóór de balk (${fmt(r0)})`,
      start !== undefined && start.align === 'right' && near(start.x, bar0.x - PAD_LEFT));
    ok(`taak: einddatum rechts achter de balk (${fmt(r0)})`,
      eind !== undefined && eind.align === 'left' && near(eind.x, bar0.x + bar0.w + BAR_LABEL_GAP));
    ok(`taak: naam achter de einddatum (${fmt(r0)})`,
      eind !== undefined && naam !== undefined && near(naam.x, eind.x + eind.text.length * CHAR_W + DATE_GAP));
  }
  const r1 = p.inRow(1);
  const datums1 = r1.filter(t => DATE.test(t.text));
  const naam1 = r1.find(t => t.text === 'Oplevering');
  // De mijlpaal volgt FS op A (eindigt vr 05-06) en valt op ma 08-06; dezelfde tekst als zijn Start-cel.
  // In de tabel kapt de nepmeting (6 px per teken) de kolom af; het begin is dezelfde datum.
  const tabel1 = p.table.filter(t => t.text.startsWith('08-06-'));
  ok(`mijlpaal: precies één datum (${fmt(r1)})`, datums1.length === 1 && datums1[0].text === '08-06-2026');
  ok(`mijlpaal: dezelfde datum als in de tabel (${fmt(tabel1)})`, tabel1.length >= 1);
  ok(`mijlpaal: naam achter de datum (${fmt(r1)})`,
    datums1.length === 1 && naam1 !== undefined && near(naam1.x, datums1[0].x + datums1[0].text.length * CHAR_W + DATE_GAP));
}

// ── Aan, met Taaknamen uit: alleen de datums ──
{
  const p = renderPrint({ showBarDates: true, showTaskNames: false });
  const r0 = p.inRow(0);
  ok(`namen uit: datums blijven (${fmt(r0)})`, r0.some(t => t.text === '01-06-2026') && r0.some(t => t.text === '05-06-2026'));
  ok(`namen uit: geen naam (${fmt(r0)})`, !p.chart.some(t => t.text === 'Fundering' || t.text === 'Oplevering'));
}

// ── Andere Datumnotatie: dezelfde tekst als de tabel ──
{
  const p = renderPrint({ showBarDates: true, dateNotation: 'ymd' });
  const r0 = p.inRow(0);
  ok(`jaar-maand-dag (${fmt(r0)})`, r0.some(t => t.text === '2026-06-01') && r0.some(t => t.text === '2026-06-05'));
}

// ── Lange naam bij de rechterrand: rechts afkappen, niet naar links ──
{
  S().updateTask(A, { name: 'Fundering '.repeat(60).trim() });
  const p = renderPrint({ showBarDates: true });
  const r0 = p.inRow(0);
  const bar0 = p.bar(0);
  const naam = r0.find(t => t.text.startsWith('Fundering'));
  ok(`lange naam: afgekapt met een ellips (${fmt(r0)})`, naam !== undefined && naam.text.endsWith('…'));
  ok(`lange naam: rechts van de balk, niet links (${fmt(r0)})`,
    naam !== undefined && bar0 !== undefined && naam.align === 'left' && naam.x > bar0.x + bar0.w);
}

if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`check-print-bar-dates: ${diffs.length} van ${checks} checks ROOD`);
  process.exit(1);
}
console.log(`check-print-bar-dates: alle ${checks} checks groen`);
