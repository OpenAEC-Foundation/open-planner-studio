// Tijdvak van de Gantt-afdruk (issue #997): de planner kiest zelf van–tot in plaats van altijd de hele planning.
//
//   1. Opslag: één tijdvak (`period`) voor elke rijenbron, standaard de hele planning. De oude periode van het
//      resourcediagram (`resourceGantt.period`) gaat erin op, maar alleen als dat diagram de gekozen bron was.
//   2. Rijen: `rowsInPeriod` houdt alleen rijen die het tijdvak raken; lege groepsbanden vallen weg en tellen opnieuw.
//      `taskTreeRows` is de boom die `buildPrintRows` zonder rijenlijst gebruikt (dezelfde rijen als eerst).
//   3. De printvelden: het tijdvak gaat als `timeWindow` naar de render, voor elke bron.
//   4. De render: relatielijnen blijven bij een tijdvak staan, afgekapt op het chartgebied (eerst vielen ze weg).
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { DEFAULT_REPORT_SETTINGS, legacyPeriodPatch, loadReportSettings, patchReportSettings } from '@/utils/reportSettings';
import { rowsInPeriod, taskTreeRows } from '@/engine/reports';
import type { ViewRow } from '@/engine/view/visibleRows';
import { studioRowPrintFields } from '@/components/panels/reportStudio/studioRowSource';
import { buildPrintRows, renderReport, type PrintOptions } from '@/services/print/printPreview';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import type { Task, TaskTime } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { RESOURCE_DIAGRAM_LAYOUT_ID } from '@/engine/view/layoutPresets';

let failures = 0;
const fail = (msg: string) => { console.log(`XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };
const eq = (msg: string, got: unknown, want: unknown) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) fail(`${msg}\n   kreeg  ${a}\n   wilde  ${b}`);
};

// ── 1. Opslag ───────────────────────────────────────────────────────────────────────────────────────
{
  eq('standaard: de hele planning', DEFAULT_REPORT_SETTINGS.period, { preset: 'project' });
  ok(!('period' in DEFAULT_REPORT_SETTINGS.resourceGantt), 'het resourcediagram heeft geen eigen periode meer');
  const load = async (stored: unknown) => {
    localStorage.setItem('ops-reportSettings', JSON.stringify(stored));
    return loadReportSettings();
  };
  const custom = { preset: 'custom', from: '2026-03-01', to: '2026-03-31' };
  eq('een bewaard tijdvak wordt geladen', (await load({ period: custom })).period, custom);
  eq('rommel ⇒ de hele planning', (await load({ period: { preset: 'nonsense' } })).period, { preset: 'project' });
  eq('omgekeerd bereik ⇒ de hele planning', (await load({ period: { preset: 'custom', from: '2026-03-31', to: '2026-03-01' } })).period, { preset: 'project' });
  eq('oude periode van het gekozen resourcediagram gaat over',
    (await load({ layoutId: RESOURCE_DIAGRAM_LAYOUT_ID, resourceGantt: { period: { preset: 'next4Weeks' } } })).period, { preset: 'next4Weeks' });
  eq('… ook bij het oude rapporttype Resourcediagram',
    (await load({ reportType: 'resourceGantt', resourceGantt: { period: custom } })).period, custom);
  eq('oude periode bij een andere bron telt niet: die stond niet op papier',
    (await load({ layoutId: '', resourceGantt: { period: { preset: 'next4Weeks' } } })).period, { preset: 'project' });
  eq('een nieuw tijdvak wint van de oude periode',
    (await load({ layoutId: RESOURCE_DIAGRAM_LAYOUT_ID, period: { preset: 'lastMonth' }, resourceGantt: { period: { preset: 'next4Weeks' } } })).period,
    { preset: 'lastMonth' });
  ok(!('period' in (await load({ resourceGantt: { period: custom } })).resourceGantt), 'de oude sleutel blijft niet in de geladen stand');
  // Een eigen layout: of die op resource groepeerde, weet pas het tabblad. Tot dan blijft de oude periode bewaard,
  // ook als er intussen iets anders wordt opgeslagen (review Sol #1005: ze ging bij de eerste schrijfactie verloren).
  const eigen = await load({ layoutId: 'layout-eigen', resourceGantt: { period: custom } });
  eq('eigen layout: nog geen tijdvak, de oude periode apart bewaard', [eigen.period, eigen.legacyResourcePeriod], [{ preset: 'project' }, custom]);
  patchReportSettings({ showDeps: false });
  const naSchrijven = await loadReportSettings();
  eq('… en een schrijfactie ertussen bewaart haar', naSchrijven.legacyResourcePeriod, custom);
  patchReportSettings(legacyPeriodPatch(naSchrijven, true)!);
  const besloten = await loadReportSettings();
  eq('groepeert de layout op resource, dan wordt zij het tijdvak', besloten.period, custom);
  ok(besloten.legacyResourcePeriod === undefined && !('legacyResourcePeriod' in JSON.parse(localStorage.getItem('ops-reportSettings')!)),
    '… en daarna staat zij niet meer apart in de opslag');
  eq('groepeert de layout niet op resource, dan vervalt zij',
    legacyPeriodPatch({ period: { preset: 'project' }, legacyResourcePeriod: custom as never }, false), { period: { preset: 'project' }, legacyResourcePeriod: undefined });
  eq('niets te beslissen zonder oude periode', legacyPeriodPatch({ period: { preset: 'project' } }, true), null);
  eq('een andere meegeleverde layout bewaart niets: daar stond de periode nooit op papier',
    (await load({ layoutId: 'builtin:anders', resourceGantt: { period: custom } })).legacyResourcePeriod, undefined);
  localStorage.setItem('ops-reportSettings', JSON.stringify({}));
  patchReportSettings({ period: { preset: 'custom', from: '2026-04-01', to: '2026-04-30' } });
  eq('round-trip door de opslag', (await loadReportSettings()).period, { preset: 'custom', from: '2026-04-01', to: '2026-04-30' });
}

// ── Plan ─────────────────────────────────────────────────────────────────────────────────────────────
const calendar: WorkCalendar = {
  id: 'cal', name: 'std', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const time = (start: string, finish: string): TaskTime => ({
  earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish,
  duration: 5, totalFloat: 0, isCritical: false, completion: 0, scheduleStart: start, scheduleFinish: finish,
} as unknown as TaskTime);
const task = (id: string, name: string, start: string, finish: string, over: Partial<Task> = {}): Task => ({
  id, name, parentId: 'fase', childIds: [], isMilestone: false, wbsCode: id, taskType: 'CONSTRUCTION',
  activityCodes: {}, customFields: {}, predecessorIds: [], successorIds: [], resourceIds: [],
  time: time(start, finish), ...over,
} as unknown as Task);
const a = task('a', 'Fundering', '2026-03-02', '2026-03-13');
const b = task('b', 'Casco', '2026-03-16', '2026-04-10');
const c = task('c', 'Gevel', '2026-04-13', '2026-04-24');
const m = task('m', 'Oplevering', '2026-05-04', '2026-05-04', { isMilestone: true });
const fase = task('fase', 'Fase 1', '2026-03-02', '2026-05-04', { parentId: undefined, childIds: ['a', 'b', 'c', 'm'] });
const wees = task('w', 'Wees', '2026-03-20', '2026-03-20', { parentId: 'weg' });
const leeg = task('x', 'Zonder datums', '', '', { parentId: undefined, time: {} as TaskTime });
const tasks = [fase, a, b, c, m, wees, leeg];
const period = { from: '2026-03-20', to: '2026-04-15' };
const shape = (rows: readonly ViewRow[]) => rows.map(r => (r.kind === 'group' ? `G${r.depth}:${r.label}(${r.count})`
  : r.kind === 'milestones' ? `M${r.depth}:${r.tasks.map(t => t.id).join('+')}` : `${r.depth}:${r.task.id}`));

// ── 2. Rijen ─────────────────────────────────────────────────────────────────────────────────────────
{
  eq('boom: wortels met kinderen, dan wezen', shape(taskTreeRows(tasks)), ['0:fase', '1:a', '1:b', '1:c', '1:m', '0:x', '0:w']);
  const printShape = (rows: ReturnType<typeof buildPrintRows>) => rows.map(r => `${r.kind}:${r.depth}:${r.task?.id ?? r.label}`);
  eq('buildPrintRows zonder rijenlijst = met de boom', printShape(buildPrintRows(tasks, undefined)), printShape(buildPrintRows(tasks, taskTreeRows(tasks))));

  const r = rowsInPeriod(taskTreeRows(tasks), period);
  eq('alleen wat het tijdvak raakt; een fase blijft, een taak zonder datums niet', shape(r.rows), ['0:fase', '1:b', '1:c', '0:w']);
  eq('buiten het tijdvak: Fundering, Oplevering, zonder datums', r.outsidePeriod, 3);
  eq('rand telt mee: een taak die op de eerste dag eindigt', shape(rowsInPeriod(taskTreeRows(tasks), { from: '2026-03-13', to: '2026-03-13' }).rows), ['0:fase', '1:a']);

  const g = (label: string, depth: number, count: number, collapsed = false): ViewRow =>
    ({ kind: 'group', rowKey: label, key: label, label, count, depth, levelIndex: depth, collapsed });
  const t = (x: Task, depth: number): ViewRow => ({ kind: 'task', rowKey: x.id, task: x, depth, dimmed: false });
  const grouped: ViewRow[] = [
    g('Ploeg A', 0, 3), g('Week 1', 1, 1), t(a, 2), g('Week 2', 1, 2), t(b, 2), t(c, 2),
    g('Ploeg B', 0, 1), t(m, 1),
    g('Ingeklapt', 0, 4, true),
  ];
  eq('lege banden vallen weg, tellingen volgen, een ingeklapte band blijft',
    shape(rowsInPeriod(grouped, period).rows), ['G0:Ploeg A(2)', 'G1:Week 2(2)', '2:b', '2:c', 'G0:Ingeklapt(4)']);
  // Review Sol #1005: een ingeklapte subband houdt haar hoofdband, ook als de open subband ernaast wegvalt.
  const zones: ViewRow[] = [
    g('Zone A', 0, 1), g('wk 12', 1, 1), t(b, 2),
    g('Zone B', 0, 3), g('26 sep', 1, 2, true), g('3 sep', 1, 1), t(a, 2),
  ];
  eq('een ingeklapte subband houdt haar hoofdband, met haar telling',
    shape(rowsInPeriod(zones, period).rows), ['G0:Zone A(1)', 'G1:wk 12(1)', '2:b', 'G0:Zone B(2)', 'G1:26 sep(2)']);
  // Een fase met opgeslagen datums hoeft haar kinderen niet te omsluiten: ze blijft staan als ouder van een kind in
  // het tijdvak, ook als haar eigen spanne het mist.
  const oudeFase = task('of', 'Fase met eigen datums', '2026-03-01', '2026-03-10', { parentId: undefined, childIds: ['k'] });
  const kind = task('k', 'Kind', '2026-03-25', '2026-03-27', { parentId: 'of' });
  const metOuder = rowsInPeriod(taskTreeRows([oudeFase, kind]), period);
  eq('een fase blijft als ouder van een kind in het tijdvak', [shape(metOuder.rows), metOuder.outsidePeriod], [['0:of', '1:k'], 0]);
  const reeks: ViewRow[] = [{ kind: 'milestones', rowKey: 'ms', tasks: [wees, m], depth: 1, dimmed: false }];
  eq('een mijlpalenreeks houdt alleen de mijlpalen in het tijdvak', shape(rowsInPeriod(reeks, period).rows), ['M1:w']);
  eq('… en valt weg als er geen over is', shape(rowsInPeriod(reeks, { from: '2026-01-01', to: '2026-01-31' }).rows), []);
  const same = taskTreeRows([fase, b, c]);
  ok(rowsInPeriod(same, period).rows.every((row, i) => row === same[i]), 'een rij die blijft, is dezelfde rij');
}

// ── 3. Printvelden ───────────────────────────────────────────────────────────────────────────────────
{
  const fields = studioRowPrintFields({ rows: undefined, multiBand: false, resource: null, window: period }, { showDeps: true, showCritical: true });
  eq('alle taken met een tijdvak: venster naar de render, relaties blijven aan', [fields.timeWindow, fields.showDeps], [period, true]);
  const none = studioRowPrintFields({ rows: undefined, multiBand: false, resource: null, window: undefined }, { showDeps: true, showCritical: true });
  eq('hele planning: geen venster', none.timeWindow, undefined);
}

// ── 4. Render: relatielijnen afgekapt op het chartgebied ────────────────────────────────────────────
{
  const sequences: Sequence[] = [
    // Venster 15 maart t/m 20 april. s1 vertrekt vóór het venster (Fundering eindigt 13 maart) en komt erin aan
    // (Casco begint 16 maart); s2 ligt er helemaal in; s3 ligt er helemaal achter (Gevel eindigt 24 april).
    { id: 's1', predecessorId: 'a', successorId: 'b', type: 'FINISH_START', lagDays: 0 },
    { id: 's2', predecessorId: 'b', successorId: 'c', type: 'FINISH_START', lagDays: 0 },
    { id: 's3', predecessorId: 'c', successorId: 'm', type: 'FINISH_START', lagDays: 0 },
  ];
  const record = (options: Partial<PrintOptions>) => {
    const segments: { pts: [number, number][]; lw: number }[] = [];
    const fills: [number, number][][] = [];
    let cur: [number, number][] = [];
    const st = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
    const d2d: Draw2D = {
      get font() { return st.font; }, set font(v) { st.font = v; },
      get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
      get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
      get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
      get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
      get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
      setLineDash() {}, fillRect() {}, strokeRect() {},
      beginPath() { cur = []; },
      moveTo(x, y) { cur.push([Number.NaN, Number.NaN], [x, y]); },
      lineTo(x, y) { cur.push([x, y]); },
      closePath() {},
      fill() { fills.push(cur.filter(p => !Number.isNaN(p[0]))); },
      stroke() { segments.push({ pts: cur.slice(), lw: st.lineWidth }); },
      roundRect() { cur = []; }, fillText() {},
      measureText(text) { return { width: text.length * 4.5 }; },
    };
    const rows = taskTreeRows([fase, a, b, c, m]);
    const dims = renderReport(() => d2d, [fase, a, b, c, m], sequences, calendar, 'P', {
      showCritical: false, showFloat: false, showDeps: true, showWeekends: true, showLegend: false, showTaskNames: false,
      showCompletion: false, autoFit: true, customZoom: 22, paperSize: 'A4', orientation: 'landscape', companyName: '',
      locale: 'nl', reportFontScale: 100, rows, ...options,
    } as PrintOptions);
    const chartTop = dims.headerHeight;
    const chartBottom = dims.height - dims.footerHeight;
    // Relatielijnen: lijndikte 1,2 in het chartgebied (raster 0,2–0,8, vandaag 1,5, randen 1).
    const deps = segments.filter(s => s.lw === 1.2 && s.pts.some(([, y]) => y > chartTop && y < chartBottom));
    const arrows = fills.filter(f => f.length === 3 && f.every(([, y]) => y > chartTop && y < chartBottom));
    return { deps, arrows, dims };
  };
  const full = record({});
  eq('zonder tijdvak: drie relatielijnen', full.deps.length, 3);
  const win = record({ timeWindow: { from: '2026-03-15', to: '2026-04-20' } });
  ok(win.deps.length === 2, `met tijdvak staan de relaties in het venster er nog (${win.deps.length} lijnen, verwacht 2)`);
  const xs = win.deps.flatMap(d => d.pts).filter(([x]) => !Number.isNaN(x)).map(([x]) => x);
  ok(xs.every(x => x >= win.dims.tableWidth - 1e-6 && x <= win.dims.width + 1e-6),
    `alle relatiepunten binnen het chartgebied [${win.dims.tableWidth}, ${win.dims.width}]: ${Math.min(...xs)}–${Math.max(...xs)}`);
  ok(xs.some(x => Math.abs(x - win.dims.tableWidth) < 1e-6), 'de relatie van vóór het venster begint op de linkerrand');
  const arrowXs = win.arrows.flat().map(([x]) => x);
  ok(win.arrows.length === 2 && arrowXs.every(x => x >= win.dims.tableWidth && x <= win.dims.width),
    `pijlpunten alleen binnen het venster (${win.arrows.length}, verwacht 2)`);
  // Tot en met 11 april: s2 vertrekt nog in het venster (Casco eindigt 10 april) maar komt erna aan (Gevel begint
  // 13 april). De lijn stopt op de rechterrand, zonder pijlpunt.
  const late = record({ timeWindow: { from: '2026-03-15', to: '2026-04-11' } });
  const lateXs = late.deps.flatMap(d => d.pts).filter(([x]) => !Number.isNaN(x)).map(([x]) => x);
  ok(late.deps.length === 2 && late.arrows.length === 1, `rechts het venster uit: twee lijnen, één pijlpunt (${late.deps.length}, ${late.arrows.length})`);
  ok(lateXs.every(x => x <= late.dims.width + 1e-6) && lateXs.some(x => Math.abs(x - late.dims.width) < 1e-6),
    'de lijn die rechts het venster uitloopt, stopt op de rechterrand');
}

// ── 5. Render: een taak in niet-werktijd op de werkdagas houdt haar balk ───────────────────────────
// Review Sol #1005. Zondag 27 september van 10.00 tot 12.00 uur (een taak op een weekendkalender) valt op de werkdagas (alleen werkbare dagen) tot één punt samen met maandag.
// Zonder tijdvak krijgt zo'n balk de minimumbreedte; met een tijdvak van 27 t/m 28 september viel hij weg.
{
  const zondag = task('zo', 'Zondagwerk', '2026-09-27T10:00', '2026-09-27T12:00', { parentId: undefined });
  const maandag = task('ma', 'Maandagwerk', '2026-09-28', '2026-09-28', { parentId: undefined });
  const bars = (options: Partial<PrintOptions>) => {
    const rects: { x: number; y: number; w: number }[] = [];
    const st = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
    const d2d: Draw2D = {
      get font() { return st.font; }, set font(v) { st.font = v; },
      get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
      get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
      get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
      get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
      get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
      setLineDash() {}, fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
      roundRect(x, y, w) { rects.push({ x, y, w }); }, fillText() {},
      measureText(text) { return { width: text.length * 4.5 }; },
    };
    const tasksHere = [zondag, maandag];
    const dims = renderReport(() => d2d, tasksHere, [], calendar, 'P', {
      showCritical: false, showFloat: false, showDeps: false, showWeekends: true, showLegend: false, showTaskNames: false,
      showCompletion: false, autoFit: true, customZoom: 22, paperSize: 'A4', orientation: 'landscape', companyName: '',
      locale: 'nl', reportFontScale: 100, rows: taskTreeRows(tasksHere), compressNonWorkdays: true, ...options,
    } as PrintOptions);
    const chartBottom = dims.height - dims.footerHeight;
    const inChart = rects.filter(r => r.y > dims.headerHeight && r.y < chartBottom && r.x >= dims.tableWidth - 1e-6 && r.x + r.w <= dims.width + 1e-6);
    return new Set(inChart.map(r => Math.round(r.y))).size;
  };
  eq('zonder tijdvak: twee balken', bars({}), 2);
  eq('met tijdvak 27 t/m 28 september: nog steeds twee balken', bars({ timeWindow: { from: '2026-09-27', to: '2026-09-28' } }), 2);
  eq('met tijdvak 29 t/m 30 september: geen balk (taken buiten het venster)', bars({ timeWindow: { from: '2026-09-29', to: '2026-09-30' } }), 0);
}

if (failures > 0) {
  console.log(`XX report-gantt-period: ${failures} afwijking(en)`);
  process.exit(1);
}
console.log('OK report-gantt-period: tijdvak bewaard, rijen en relaties binnen het tijdvak');
