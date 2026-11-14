// Issue #868 — begin- en einddatum naast de Gantt-balken (instelling `showBarDates`, standaard uit).
//
// Met de instelling aan staat de begindatum links vóór de balk (rechts uitgelijnd tegen de balk) en de
// einddatum rechts achter de balk, voorbij de knik van de eigen uitgaande relatie. Een naam die niet in
// de balk past (en de naam van een samenvatting of hammock) schuift door tot achter de einddatum. Een
// nulduurmijlpaal heeft één datum: die staat tussen de ruit en de naam. De tekst volgt de Datumnotatie
// en de B4-regel van de tabel (een datum zonder tijd op een dagrand, anders met de tijd in de
// Tijdnotatie). Zonder de instelling tekent de renderer geen datum.
//
// Draait de ECHTE renderer met een opnemende ctx-stub (measureText = 6 px per teken).
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer, type GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

const CHAR_W = 6;
const OUTSIDE_GAP = 8 + 6; // ARROW_STUB + OUTSIDE_LABEL_GAP
const DATE_GAP = 6;        // ruimte tussen begindatum en balk, en tussen einddatum en naam

interface TextCall { text: string; x: number; y: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; texts: TextCall[] } {
  const texts: TextCall[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop,
    fill: noop, stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: (text: string, x: number, y: number) => { texts.push({ text: String(text), x, y }); },
    strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * CHAR_W }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

const START = '2026-01-05'; // maandag
const FINISH = '2026-01-09';
const VIEW_START = '2025-12-29'; // een week eerder: de begindatum links van de balk staat in beeld
const KORT = 'Fundering';
const LANG = 'Gevelbekleding noordzijde aanbrengen';

S().newProject();
S().addTask({ name: KORT });
S().runCPM();
const tijd = (start: string, finish: string) => ({
  ...S().tasks[0].time,
  scheduleStart: start, scheduleFinish: finish,
  earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish,
  totalFloat: 0, isCritical: false,
});
const basis = S().tasks[0];
const kort: Task = { ...basis, id: 'kort', name: KORT, time: tijd(START, FINISH) } as Task;
const lang: Task = { ...basis, id: 'lang', name: LANG, time: tijd(START, FINISH) } as Task;
const fase: Task = { ...kort, id: 'fase', name: 'Ruwbouw', isSummary: true } as Task;
const mijlpaal: Task = {
  ...basis, id: 'mp', name: 'Oplevering', isMilestone: true,
  time: { ...tijd(FINISH, FINISH), scheduleDuration: 0 },
} as Task;

const rows: ViewRow[] = [kort, lang, fase, mijlpaal]
  .map(task => ({ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false }));

const W = 1200, H = 400, ROWH = 28, HDRH = 60, ZOOM = 24;
function render(extra: Partial<GanttRenderOptions>): { texts: TextCall[]; renderer: GanttRenderer } {
  const { ctx, texts } = makeCtx();
  const st = S();
  const renderer = new GanttRenderer(ctx, {
    rows,
    sequences: [],
    calendar: st.calendar,
    view: { ...st.view, scrollX: 0, scrollY: 0, zoom: ZOOM, viewStartDate: VIEW_START },
    selectedTaskIds: [],
    showStatusDateLine: false,
    showProgressLine: false,
    canvasWidth: W,
    canvasHeight: H,
    rowHeight: ROWH,
    headerHeight: HDRH,
    ...extra,
  });
  renderer.render();
  return { texts, renderer };
}
const rowBand = (i: number) => ({ top: HDRH + i * ROWH, bottom: HDRH + (i + 1) * ROWH });
const inRow = (texts: TextCall[], i: number) => texts.filter(t => t.y > rowBand(i).top && t.y < rowBand(i).bottom);
const fmt = (ts: TextCall[]) => JSON.stringify(ts.map(t => [t.text, t.x]));
const near = (a: number, b: number) => Math.abs(a - b) < 0.001;

// ── Standaard uit: geen datum in de Gantt ──
{
  const { texts } = render({});
  ok(`uit: geen datumtekst getekend (${fmt(texts.filter(t => /\d{2}-\d{2}-\d{4}/.test(t.text)))})`,
    !texts.some(t => /\d{2}-\d{2}-\d{4}/.test(t.text)));
}

// ── Aan, Datumnotatie dag-maand-jaar ──
{
  const { texts, renderer } = render({ showBarDates: true, dateNotation: 'dmy' });
  const rect = renderer.getTaskBarRect('kort');
  const rectLang = renderer.getTaskBarRect('lang');
  ok('opzet: balkgeometrie', rect !== null && rectLang !== null);
  if (rect && rectLang) {
    const r0 = inRow(texts, 0);
    const start0 = r0.find(t => t.text === '05-01-2026');
    const eind0 = r0.find(t => t.text === '09-01-2026');
    ok(`korte taak: begindatum links tegen de balk (${fmt(r0)})`,
      start0 !== undefined && near(start0.x + start0.text.length * CHAR_W, rect.left - DATE_GAP));
    ok(`korte taak: einddatum rechts achter de balk (${fmt(r0)})`,
      eind0 !== undefined && near(eind0.x, rect.right + OUTSIDE_GAP));
    ok(`korte taak: naam blijft in de balk (${fmt(r0)})`,
      r0.some(t => t.text === KORT && near(t.x, rect.left + 6)));

    const r1 = inRow(texts, 1);
    const eind1 = r1.find(t => t.text === '09-01-2026');
    const naam1 = r1.find(t => t.text.startsWith('Gevel'));
    ok(`lange naam: einddatum direct achter de balk (${fmt(r1)})`,
      eind1 !== undefined && near(eind1.x, rectLang.right + OUTSIDE_GAP));
    ok(`lange naam: naam schuift door tot achter de einddatum (${fmt(r1)})`,
      eind1 !== undefined && naam1 !== undefined && near(naam1.x, eind1.x + eind1.text.length * CHAR_W + DATE_GAP));
    // De klikbare naam ligt op de verschoven plek, niet op de datum.
    if (eind1 && naam1) {
      const y = HDRH + 1 * ROWH + ROWH / 2;
      ok('lange naam: klik op de naam vindt de taak', renderer.getTaskNameAt(naam1.x + 3, y)?.id === 'lang');
      ok('lange naam: klik op de einddatum is geen naamklik', renderer.getTaskNameAt(eind1.x + 3, y) === null);
    }

    // Samenvatting: zelfde datums als 'kort', naam altijd achter de einddatum.
    const r2 = inRow(texts, 2);
    const eind2 = r2.find(t => t.text === '09-01-2026');
    const naam2 = r2.find(t => t.text === 'Ruwbouw');
    ok(`samenvatting: begindatum links (${fmt(r2)})`, r2.some(t => t.text === '05-01-2026' && t.x < rect.left));
    ok(`samenvatting: naam achter de einddatum (${fmt(r2)})`,
      eind2 !== undefined && naam2 !== undefined && near(eind2.x, rect.right + OUTSIDE_GAP)
      && near(naam2.x, eind2.x + eind2.text.length * CHAR_W + DATE_GAP));

    // Mijlpaal: één datum, tussen de ruit en de naam.
    const r3 = inRow(texts, 3);
    const datums3 = r3.filter(t => /\d{2}-\d{2}-\d{4}/.test(t.text));
    const naam3 = r3.find(t => t.text === 'Oplevering');
    ok(`mijlpaal: precies één datum (${fmt(r3)})`, datums3.length === 1 && datums3[0].text === '09-01-2026');
    ok(`mijlpaal: naam achter de datum (${fmt(r3)})`,
      datums3.length === 1 && naam3 !== undefined && near(naam3.x, datums3[0].x + datums3[0].text.length * CHAR_W + DATE_GAP));
  }
}

// ── Weinig ruimte rechts (review Sol #951): datums en naam overlappen nooit ──
{
  const span = (t: TextCall) => [t.x, t.x + t.text.length * CHAR_W] as const;
  const overlap = (ts: TextCall[]) => ts.some((a, i) => ts.some((b, j) => j > i && span(a)[0] < span(b)[1] && span(b)[0] < span(a)[1]));
  // 450 px: de einddatum past nog achter de balk, de naam niet helemaal.
  const smal = render({ showBarDates: true, dateNotation: 'dmy', canvasWidth: 450 });
  const rect = smal.renderer.getTaskBarRect('lang');
  const r1 = inRow(smal.texts, 1);
  const eind = r1.find(t => t.text === '09-01-2026');
  const naam = r1.find(t => t.text.startsWith('Gevel'));
  ok(`smal: einddatum blijft direct achter de balk (${fmt(r1)})`, rect !== null && eind !== undefined && near(eind.x, rect.right + OUTSIDE_GAP));
  ok(`smal: naam afgekapt achter de einddatum (${fmt(r1)})`,
    eind !== undefined && naam !== undefined && naam.text.endsWith('…') && near(naam.x, eind.x + eind.text.length * CHAR_W + DATE_GAP));
  ok(`smal: niets overlapt (${fmt(r1)})`, !overlap(r1));
  // Zo smal dat de einddatum niet past: die vervalt, en de naam schuift niet over de begindatum.
  if (rect) {
    const krap = render({ showBarDates: true, dateNotation: 'dmy', canvasWidth: Math.round(rect.right + OUTSIDE_GAP + 30) });
    const k1 = inRow(krap.texts, 1);
    const k0 = inRow(krap.texts, 0);
    ok(`krap: geen einddatum (${fmt(k1)})`, !k1.some(t => t.text === '09-01-2026'));
    ok(`krap: begindatum staat er nog (${fmt(k1)})`, k1.some(t => t.text === '05-01-2026'));
    ok(`krap: naam niet links van de balk (${fmt(k1)})`, k1.filter(t => !/\d{2}-\d{2}-\d{4}/.test(t.text)).every(t => t.x >= rect.left));
    ok(`krap: niets overlapt (${fmt(k1)})`, !overlap(k1));
    ok(`krap: naam in de balk raakt geen einddatum (${fmt(k0)})`, !overlap(k0));
  }
}

// ── Mijlpaal met alleen een start: die datum staat bij de ruit ──
{
  const losseStart: Task = { ...mijlpaal, time: { ...mijlpaal.time, scheduleFinish: '', earlyFinish: '', lateFinish: '' } } as Task;
  const { ctx, texts } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: [{ kind: 'task', rowKey: losseStart.id, task: losseStart, depth: 0, dimmed: false }],
    sequences: [], calendar: st.calendar,
    view: { ...st.view, scrollX: 0, scrollY: 0, zoom: ZOOM, viewStartDate: VIEW_START },
    selectedTaskIds: [], showStatusDateLine: false, showProgressLine: false,
    canvasWidth: W, canvasHeight: H, rowHeight: ROWH, headerHeight: HDRH,
    showBarDates: true, dateNotation: 'dmy',
  }).render();
  const r0 = inRow(texts, 0);
  ok(`mijlpaal met alleen start: datum 09-01-2026 (${fmt(r0)})`, r0.some(t => t.text === '09-01-2026'));
}

// ── Andere Datumnotatie ──
{
  const { texts } = render({ showBarDates: true, dateNotation: 'mdy' });
  const r0 = inRow(texts, 0);
  ok(`maand-dag-jaar: begin en einde in die notatie (${fmt(r0)})`,
    r0.some(t => t.text === '01-05-2026') && r0.some(t => t.text === '01-09-2026'));
}

// ── Momenten met een tijd: de tijd komt erbij, in de Tijdnotatie (zoals de tabel) ──
{
  const uren: Task = { ...kort, time: tijd('2026-01-05T10:00', '2026-01-09T14:30') } as Task;
  const { ctx, texts } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: [{ kind: 'task', rowKey: uren.id, task: uren, depth: 0, dimmed: false }],
    sequences: [], calendar: st.calendar,
    view: { ...st.view, scrollX: 0, scrollY: 0, zoom: ZOOM, viewStartDate: VIEW_START },
    selectedTaskIds: [], showStatusDateLine: false, showProgressLine: false,
    canvasWidth: W, canvasHeight: H, rowHeight: ROWH, headerHeight: HDRH,
    showBarDates: true, dateNotation: 'dmy', timeNotation: '12h',
  }).render();
  const r0 = inRow(texts, 0);
  ok(`met tijd: begin '05-01-2026 10:00 AM' (${fmt(r0)})`, r0.some(t => t.text === '05-01-2026 10:00 AM'));
  ok(`met tijd: einde '09-01-2026 2:30 PM' (${fmt(r0)})`, r0.some(t => t.text === '09-01-2026 2:30 PM'));
}

if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`check-gantt-bar-dates: ${diffs.length} van ${checks} checks ROOD`);
  process.exit(1);
}
console.log(`check-gantt-bar-dates: alle ${checks} checks groen`);
