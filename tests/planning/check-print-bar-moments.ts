// Scherm = afdruk: een balk met momenten staat op papier op dezelfde momenten als op het scherm.
//
// AANLEIDING (aanval na #600, a09 en a11). Sinds F2 heeft elke taak momenten, maar de afdruk rekende elke
// balk nog in hele dagen: `parseDate` haalde de tijd weg en `+ zoom` telde er een hele einddag bij. Twee
// aansluitende halve dagen (A ma 07:00–11:00, B ma 11:00–16:00) werden op papier twee overlappende hele
// dagen; een dag van 00:00 tot 00:00 op een 24-uurskalender werd twee dagen breed; een urentaak had
// hetzelfde al. Scherm en afdruk delen nu één balkregel (`taskBarSpan`, `src/engine/renderer/barSpan.ts`):
// met momenten van het startmoment tot het exclusieve eindmoment, alleen bij datums zonder tijd tot het
// einde van de einddag.
//
// Deze batterij tekent met de ECHTE `GanttRenderer` (opnemende 2D-context) en de ECHTE `renderReport`
// (opnemende Draw2D) en vergelijkt de balken, de fasebalk, de relatiepijl en een mijlpaal met een moment.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { renderReport, type PrintOptions } from '@/services/print/printPreview';
import { PRINT_PALETTE } from '@/engine/renderer/themePalette';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskTime } from '@/types/task';
import { parseDate } from '@/utils/dateUtils';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function near(label: string, actual: number | undefined, expected: number, tol = 0.01): void {
  checks++;
  if (actual === undefined || !Number.isFinite(actual) || Math.abs(actual - expected) > tol) {
    diffs.push(`${label}: kreeg ${actual === undefined ? 'geen waarde' : actual.toFixed(3)}, verwacht ${expected.toFixed(3)}`);
  }
}
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

const BANDS = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const STD: WorkCalendar = {
  id: 'cal', name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: { 1: BANDS, 2: BANDS, 3: BANDS, 4: BANDS, 5: BANDS, 6: [], 7: [] } },
} as WorkCalendar;

// ── Scherm: opnemende 2D-context, de balk komt uit `getTaskBarRect` ─────────────────────────────
function renderScreen(tasks: Task[], zoom: number) {
  const noop = () => {};
  const ctx = new Proxy({
    fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '', lineWidth: 1, globalAlpha: 1,
    measureText: (s: string) => ({ width: String(s).length * 6 }), getLineDash: () => [],
    createLinearGradient: () => ({ addColorStop: noop }), createPattern: () => null,
  } as Record<string | symbol, unknown>, {
    get: (t, k) => (k in t ? t[k] : noop),
    set: (t, k, v) => { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  const st = S();
  const rows = tasks.map(task => ({ kind: 'task' as const, rowKey: task.id, task, depth: 0, dimmed: false }));
  const renderer = new GanttRenderer(ctx, {
    rows, sequences: [], calendar: st.calendar,
    view: { ...st.view, viewStartDate: '2026-06-01', zoom, scrollX: 0, scrollY: 0 },
    selectedTaskIds: [], canvasWidth: 4000, canvasHeight: 400, rowHeight: 28, headerHeight: 60,
    barSplitMode: 'never',
  });
  renderer.render();
  const origin = renderer.dateToX(parseDate('2026-06-01'));
  const bar = (id: string) => {
    const r = renderer.getTaskBarRect(id);
    return r ? { x1: r.left - origin, x2: r.right - origin } : null;
  };
  return { bar };
}

// ── Afdruk: opnemende Draw2D; de as begint zeven dagen vóór de vroegste taakdag (ma 1 juni) ────────
interface Shape { x: number; y: number; w: number; h: number; color: string }
interface Path { pts: { x: number; y: number }[]; color: string; kind: 'stroke' | 'fill' }
function renderPrint(tasks: Task[], zoom: number, extra: Partial<PrintOptions> = {}) {
  const rects: Shape[] = [];
  const paths: Path[] = [];
  let path: { x: number; y: number }[] = [];
  const st: Record<string, unknown> = { font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left', textBaseline: 'alphabetic' };
  const noop = () => {};
  const d2d = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash: noop, fillRect: noop, strokeRect: noop, closePath: noop, fillText: noop,
    beginPath() { path = []; },
    moveTo(x: number, y: number) { path.push({ x, y }); },
    lineTo(x: number, y: number) { path.push({ x, y }); },
    fill() { if (path.length) paths.push({ pts: path, color: String(st.fillStyle), kind: 'fill' }); },
    stroke() { if (path.length) paths.push({ pts: path, color: String(st.strokeStyle), kind: 'stroke' }); },
    roundRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h, color: String(st.fillStyle) }); },
    measureText: (t: string) => ({ width: t.length * 6 }),
  } as unknown as Draw2D;
  const s = S();
  const result = renderReport(() => d2d, tasks, s.sequences, s.calendar, 'P', {
    showCritical: true, showFloat: false, showDeps: true, showWeekends: true, showLegend: false,
    showTaskNames: false, showCompletion: false, autoFit: false, customZoom: zoom,
    paperSize: 'A3', orientation: 'landscape', companyName: '', barColorSelection: { mode: 'critical' },
    activityCodeTypes: [], customFieldDefs: [], dateNotation: 'dmy', timeNotation: '24h',
    ...extra,
  } as PrintOptions);
  // Zonder tijdvenster (dat zou de relaties weglaten) zet de afdruk zeven dagen marge vóór de vroegste
  // taakdag; alle scenario's hieronder beginnen op ma 1 juni.
  const origin = result.tableWidth + 7 * zoom;
  const body = (r: Shape) => r.x >= result.tableWidth - 0.5 && r.y >= result.headerHeight;
  const rowOf = (y: number) => Math.floor((y - result.headerHeight) / 24);
  // Een taakbalk is het hoogste vlak in zijn rij; de fasehaak is het platte vlak van de fase.
  const barRects = rects.filter(r => body(r) && r.h > 8);
  const bar = (row: number) => {
    const r = barRects.find(b => rowOf(b.y) === row);
    return r ? { x1: r.x - origin, x2: r.x + r.w - origin } : null;
  };
  const summary = (row: number) => {
    const r = rects.find(b => body(b) && b.h > 2 && b.h <= 8 && rowOf(b.y) === row && b.color === PRINT_PALETTE.summary);
    return r ? { x1: r.x - origin, x2: r.x + r.w - origin } : null;
  };
  // Paden in chartcoördinaten: x vanaf ma 00:00, y vanaf de bovenkant van de eerste rij.
  const chart = (kind: Path['kind']) => paths
    .filter(p => p.kind === kind && p.pts[0].x >= result.tableWidth && p.pts[0].y >= result.headerHeight)
    .map(p => p.pts.map(q => ({ x: q.x - origin, y: q.y - result.headerHeight })));
  const strokes = chart('stroke');
  const fills = chart('fill');
  return { bar, summary, strokes, fills, rowHeight: 24 };
}

function project(calendar: WorkCalendar): void {
  S().newProject();
  S().setProject({ name: 'Momenten op papier', startDate: '2026-06-01' });
  S().setCalendar(calendar);
}

// ── 1. Twee aansluitende halve dagen onder een fase (a09) ──────────────────────────────────────
{
  project(STD);
  const P = S().addTask({ name: 'Fase' });
  const A = S().addTask({ name: 'A', parentId: P, time: { durationUnit: 'days', scheduleDuration: 0.5 } as TaskTime });
  const B = S().addTask({ name: 'B', parentId: P, time: { durationUnit: 'days', scheduleDuration: 0.5 } as TaskTime });
  S().addSequence({ predecessorId: A, successorId: B, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const t = (id: string) => S().tasks.find(x => x.id === id)!;
  eq('1 opzet: A ma 07:00–11:00, B 11:00–16:00, fase 07:00–16:00',
    [t(A).time.earlyStart, t(A).time.earlyFinish, t(B).time.earlyStart, t(B).time.earlyFinish, t(P).time.earlyStart, t(P).time.earlyFinish],
    ['2026-06-01T07:00', '2026-06-01T11:00', '2026-06-01T11:00', '2026-06-01T16:00', '2026-06-01T07:00', '2026-06-01T16:00']);

  const zoom = 240;
  const screen = renderScreen([t(A), t(B)], zoom);
  const printed = renderPrint(S().tasks, zoom);
  // Rijvolgorde in de afdruk: fase, A, B.
  const pA = printed.bar(1);
  const pB = printed.bar(2);
  near('1a afdruk: A begint om 07:00', pA?.x1, (7 / 24) * zoom);
  near('1b afdruk: A eindigt om 11:00', pA?.x2, (11 / 24) * zoom);
  near('1c afdruk: B begint waar A eindigt (11:00), geen overlap', pB?.x1, (11 / 24) * zoom);
  near('1d afdruk: B eindigt om 16:00', pB?.x2, (16 / 24) * zoom);
  const sA = screen.bar(A);
  const sB = screen.bar(B);
  near('1e scherm = afdruk: begin A', pA?.x1, sA?.x1 ?? Number.NaN);
  near('1f scherm = afdruk: einde A', pA?.x2, sA?.x2 ?? Number.NaN);
  near('1g scherm = afdruk: begin B', pB?.x1, sB?.x1 ?? Number.NaN);
  near('1h scherm = afdruk: einde B', pB?.x2, sB?.x2 ?? Number.NaN);
  const pP = printed.summary(0);
  near('1i afdruk: de fasebalk begint om 07:00', pP?.x1, (7 / 24) * zoom);
  near('1j afdruk: de fasebalk eindigt om 16:00, niet een dag later', pP?.x2, (16 / 24) * zoom);
  // De FS-pijl vertrekt op het einde van A, niet op het einde van de dag.
  // De pijl is het eerste pad met een knik (rasterlijnen zijn rechte lijnen van twee punten) dat in de rij van A begint.
  const arrow = printed.strokes.find(p => p.length >= 3 && Math.abs(p[0].y - printed.rowHeight * 1.5) < printed.rowHeight / 2);
  near('1k afdruk: de relatiepijl vertrekt op het einde van A', arrow?.[0].x, (11 / 24) * zoom);
}

// ── 2. Een volle dag op een 24-uurskalender (a11) ──────────────────────────────────────────────
{
  project({ ...STD, workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24, workTime: undefined } as WorkCalendar);
  const C = S().addTask({ name: 'Volle kalenderdag', time: { durationUnit: 'days', scheduleDuration: 1 } as TaskTime });
  S().runCPM();
  const c = S().tasks.find(x => x.id === C)!;
  eq('2 opzet: 1 d loopt van 1 juni 00:00 tot 2 juni 00:00', [c.time.earlyStart, c.time.earlyFinish], ['2026-06-01T00:00', '2026-06-02T00:00']);
  const zoom = 96;
  const printed = renderPrint(S().tasks, zoom);
  const screen = renderScreen([c], zoom);
  const day = printed.bar(0);
  near('2a afdruk: de balk is één dag breed', day ? day.x2 - day.x1 : undefined, zoom);
  near('2b scherm = afdruk: einde', printed.bar(0)?.x2, screen.bar(C)?.x2 ?? Number.NaN);
}

// ── 3. Een urentaak, een mijlpaal met een moment en een taak met alleen datums ──────────────────────
{
  project(STD);
  const H = S().addTask({ name: 'Vier uur', time: { durationUnit: 'hours', durationMinutes: 240 } as TaskTime });
  const M = S().addTask({ name: 'Mijlpaal', isMilestone: true, time: { scheduleDuration: 0 } as TaskTime });
  S().addSequence({ predecessorId: H, successorId: M, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const h = S().tasks.find(x => x.id === H)!;
  const m = S().tasks.find(x => x.id === M)!;
  eq('3 opzet: urentaak 07:00–11:00, mijlpaal 11:00', [h.time.earlyStart, h.time.earlyFinish, m.time.earlyStart], ['2026-06-01T07:00', '2026-06-01T11:00', '2026-06-01T11:00']);
  // Een taak met alleen datums (van vóór het minutenmodel) houdt haar inclusieve einddag.
  const old: Task = { ...h, id: 'oud', name: 'Alleen datums', time: { ...h.time, scheduleStart: '2026-06-02', earlyStart: '2026-06-02', scheduleFinish: '2026-06-02', earlyFinish: '2026-06-02' } };
  const zoom = 240;
  const printed = renderPrint([h, m, old], zoom);
  const screen = renderScreen([h, m, old], zoom);
  near('3a afdruk: de urentaak begint om 07:00', printed.bar(0)?.x1, (7 / 24) * zoom);
  near('3b afdruk: de urentaak eindigt om 11:00', printed.bar(0)?.x2, (11 / 24) * zoom);
  near('3c scherm = afdruk: einde urentaak', printed.bar(0)?.x2, screen.bar(H)?.x2 ?? Number.NaN);
  // De ruit: het eerste punt van het pad is de top, recht boven het anker.
  const diamond = printed.fills.find(p => p.length === 4 && Math.abs(p[0].y - printed.rowHeight * 1.5) < printed.rowHeight / 2);
  near('3d afdruk: de mijlpaal met een moment staat op 11:00', diamond?.[0].x, (11 / 24) * zoom);
  near('3e afdruk: alleen datums blijft de hele dag (begin)', printed.bar(2)?.x1, zoom);
  near('3f afdruk: alleen datums blijft de hele dag (einde)', printed.bar(2)?.x2, 2 * zoom);
  near('3g scherm = afdruk: alleen datums', printed.bar(2)?.x2, screen.bar('oud')?.x2 ?? Number.NaN);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  print-bar-moments: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  print-bar-moments: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
