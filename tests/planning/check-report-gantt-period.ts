import './domStub';
import { DEFAULT_REPORT_SETTINGS, latestReportSettings, legacyPeriodPatch, loadReportSettings, patchReportSettings, periodChoicePatch } from '@/utils/reportSettings';
import { computeLayoutReportRows, leavesOutsidePeriod, taskInPeriod, taskTreeRows, treeRowsInPeriod } from '@/engine/reports';
import { computeViewRows, type ViewContext, type ViewRowOpts } from '@/engine/view/visibleRows';
import { evaluate } from '@/engine/view/filterEval';
import type { Resource, ResourceAssignment } from '@/types/resource';
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

function fakeDraw2D(on: (d: Draw2D) => Partial<Draw2D>): Draw2D {
  const d: Draw2D = {
    font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline,
    setLineDash() {}, fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
    roundRect() {}, fillText() {},
    measureText(text) { return { width: text.length * 4.5 }; },
  };
  return Object.assign(d, on(d));
}

const RENDER_BASE = {
  showCritical: false, showFloat: false, showDeps: false, showWeekends: true, showLegend: false, showTaskNames: false,
  showCompletion: false, autoFit: true, customZoom: 22, paperSize: 'A4', orientation: 'landscape', companyName: '',
  locale: 'nl', reportFontScale: 100,
} as const;

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
  const alleTaken = await load({ layoutId: '', resourceGantt: { period: custom } });
  eq('alle taken: nog geen tijdvak, de oude periode apart bewaard', [alleTaken.period, alleTaken.legacyResourcePeriod], [{ preset: 'project' }, custom]);
  patchReportSettings({ showDeps: false });
  patchReportSettings({ layoutId: RESOURCE_DIAGRAM_LAYOUT_ID });
  const terug = latestReportSettings();
  eq('… en na een andere schrijfactie en terugschakelen naar het Resourcediagram wordt zij het tijdvak',
    legacyPeriodPatch(terug, true), { period: custom, legacyResourcePeriod: undefined });
  eq('een nieuw tijdvak wint van de oude periode',
    (await load({ layoutId: RESOURCE_DIAGRAM_LAYOUT_ID, period: { preset: 'lastMonth' }, resourceGantt: { period: { preset: 'next4Weeks' } } })).period,
    { preset: 'lastMonth' });
  ok(!('period' in (await load({ resourceGantt: { period: custom } })).resourceGantt), 'de oude sleutel blijft niet in de geladen stand');
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
  eq('groepeert de bron niet op resource, dan blijft zij bewaard', legacyPeriodPatch({ legacyResourcePeriod: custom as never }, false), null);
  eq('niets over te nemen zonder oude periode', legacyPeriodPatch({}, true), null);
  eq('ook bij een andere meegeleverde layout blijft zij bewaard',
    (await load({ layoutId: 'builtin:anders', resourceGantt: { period: custom } })).legacyResourcePeriod, custom);
  for (const keuze of [{ preset: 'nextMonth' }, { preset: 'project' }] as const) {
    await load({ layoutId: 'layout-eigen', resourceGantt: { period: custom } });
    patchReportSettings(periodChoicePatch(keuze));
    const naKeuze = latestReportSettings();
    eq(`een eigen keuze (${keuze.preset}) wint van de oude periode`, [naKeuze.period, legacyPeriodPatch(naKeuze, true)], [keuze, null]);
  }
  localStorage.setItem('ops-reportSettings', JSON.stringify({}));
  patchReportSettings({ period: { preset: 'custom', from: '2026-04-01', to: '2026-04-30' } });
  eq('round-trip door de opslag', (await loadReportSettings()).period, { preset: 'custom', from: '2026-04-01', to: '2026-04-30' });
}

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

{
  eq('boom: wortels met kinderen, dan wezen', shape(taskTreeRows(tasks)), ['0:fase', '1:a', '1:b', '1:c', '1:m', '0:x', '0:w']);
  const printShape = (rows: ReturnType<typeof buildPrintRows>) => rows.map(r => `${r.kind}:${r.depth}:${r.task?.id ?? r.label}`);
  eq('buildPrintRows zonder rijenlijst = met de boom', printShape(buildPrintRows(tasks, undefined)), printShape(buildPrintRows(tasks, taskTreeRows(tasks))));

  eq('alleen wat het tijdvak raakt; een fase blijft, een taak zonder datums niet', shape(treeRowsInPeriod(tasks, period)), ['0:fase', '1:b', '1:c', '0:w']);
  eq('buiten het tijdvak: Fundering, Oplevering, zonder datums', leavesOutsidePeriod(tasks, period), 3);
  eq('rand telt mee: een taak die op de eerste dag eindigt', shape(treeRowsInPeriod(tasks, { from: '2026-03-13', to: '2026-03-13' })), ['0:fase', '1:a']);
  const oudeFase = task('of', 'Fase met eigen datums', '2026-03-01', '2026-03-10', { parentId: undefined, childIds: ['k'] });
  const kind = task('k', 'Kind', '2026-03-25', '2026-03-27', { parentId: 'of' });
  eq('een fase met opgeslagen datums blijft als ouder van een kind in het tijdvak', shape(treeRowsInPeriod([oudeFase, kind], period)), ['0:of', '1:k']);
  const zonderKind = task('lf', 'Fase zonder taak in het tijdvak', '2026-03-20', '2026-03-25', { parentId: undefined, childIds: ['a2'] });
  const a2 = task('a2', 'Vroeg', '2026-03-02', '2026-03-06', { parentId: 'lf' });
  eq('een fase zonder taak in het tijdvak valt weg, ook als haar eigen datums het raken', shape(treeRowsInPeriod([zonderKind, a2], period)), []);
  const same = taskTreeRows([fase, b, c]);
  ok(treeRowsInPeriod([fase, b, c], period).every((row, i) => JSON.stringify(row) === JSON.stringify(same[i])), 'een rij die blijft, is dezelfde rij');

  const res = (id: string, name: string): Resource => ({ id, name, type: 'LABOR', description: '', maxUnits: 1 });
  const resources = [res('r-jan', 'Jan'), res('r-kraan', 'Kraan'), res('r-ploeg', 'Ploeg')];
  let n = 0;
  const asg = (taskId: string, resourceId: string): ResourceAssignment => ({ id: `as${++n}`, taskId, resourceId, unitsPerDay: 1 });
  const assignments = [asg('a', 'r-jan'), asg('a', 'r-kraan'), asg('b', 'r-jan'), asg('b', 'r-ploeg')];
  const ctx: ViewContext = { activityCodeTypes: [], customFieldDefs: [], resources, assignments, noneLabel: '(geen)', resourceTypeLabels: {} };
  const plan = [fase, a, b, c];
  const within = (x: Task) => taskInPeriod(x, period);
  const group: ViewRowOpts['group'] = [{ field: { src: 'builtin', key: 'taskType' }, dir: 'asc' }, { field: { src: 'resource' }, dir: 'asc' }];
  const opts = (over: Partial<ViewRowOpts> = {}): ViewRowOpts =>
    ({ filter: null, group: [], sort: [], collapsedTaskIds: new Set(), collapsedGroupKeys: new Set(), within, ...over });
  const open = computeViewRows(plan, opts({ group, within: undefined }), ctx);
  const keyOf = (label: string) => open.find(r => r.kind === 'group' && r.label === label)!.rowKey;
  const countOf = (rows: ViewRow[], match: (r: Extract<ViewRow, { kind: 'group' }>) => boolean) => {
    const row = rows.find(r => r.kind === 'group' && match(r));
    return row?.kind === 'group' ? row.count : null;
  };
  const gegroepeerd = computeViewRows(plan, opts({ group, collapsedGroupKeys: new Set([keyOf('Kraan')]) }), ctx);
  ok(!gegroepeerd.some(r => r.kind === 'group' && r.label === 'Kraan'),
    `een ingeklapte subband met alleen werk buiten het tijdvak valt weg (${shape(gegroepeerd).join(' ')})`);
  eq('een taak onder twee ploegen telt in de hoofdband één keer', countOf(gegroepeerd, r => r.depth === 0), 2);
  const dicht = computeViewRows(plan, opts({ group, collapsedGroupKeys: new Set([keyOf('Jan')]) }), ctx);
  eq('een ingeklapte subband telt alleen haar taken in het tijdvak', countOf(dicht, r => r.label === 'Jan'), 1);
  const boomDicht = computeViewRows([oudeFase, kind], opts({ collapsedTaskIds: new Set(['of']) }), ctx);
  eq('een ingeklapte fase blijft als alleen haar verborgen kind in het tijdvak valt', shape(boomDicht), ['0:of']);
  ok(boomDicht.every(r => r.kind !== 'task' || !r.dimmed), 'zonder filter is de ouder niet gedimd');
  const ms = (id: string, date: string) => task(id, id, date, date, { parentId: 'p', isMilestone: true,
    time: { ...time(date, date), scheduleDuration: 0 } as unknown as TaskTime });
  const p = task('p', 'Mijlpalen', '2026-03-01', '2026-05-01', { parentId: undefined, childIds: ['m-uit', 'm-in'] });
  const reeks = [p, ms('m-uit', '2026-03-02'), ms('m-in', '2026-03-25')];
  const reeksRij = computeViewRows(reeks, opts({ collapsedTaskIds: new Set(['m-uit']) }), ctx);
  eq('een ingeklapte reeks houdt haar sleutel en alleen de mijlpalen in het tijdvak', reeksRij.map(r => r.kind === 'milestones' ? `${r.rowKey}=${r.tasks.map(t => t.id)}` : r.rowKey),
    ['p', 'milestones:m-uit=m-in']);
  eq('… en valt weg als er geen over is', shape(computeViewRows(reeks, opts({ collapsedTaskIds: new Set(['m-uit']), within: x => taskInPeriod(x, { from: '2026-01-01', to: '2026-01-31' }) }), ctx)), []);
  const alles = (x: Task) => taskInPeriod(x, { from: '2026-01-01', to: '2026-12-31' });
  for (const g of [[], group]) {
    eq(`een tijdvak om alles heen = het scherm (${g.length ? 'gegroepeerd' : 'boom'})`,
      computeViewRows(plan, opts({ group: g, within: alles }), ctx), computeViewRows(plan, opts({ group: g, within: undefined }), ctx));
  }
  const layout = computeLayoutReportRows({ group }, { tasks: plan, ctx }, { includeUnassigned: true, groupByType: false, window: period, locale: 'nl' });
  eq('een layout gaat door dezelfde pijplijn', shape(layout.rows), shape(computeViewRows(plan, opts({ group }), ctx)));
  const filter: ViewRowOpts['filter'] = { kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'Fundering' };
  eq('buiten het tijdvak telt een taak die het filter van de bron al niet haalt niet mee',
    [leavesOutsidePeriod(plan, period), leavesOutsidePeriod(plan, period, x => evaluate(filter!, x, ctx))], [1, 0]);
}

{
  const fields = studioRowPrintFields({ rows: undefined, multiBand: false, resource: null, window: period }, { showDeps: true, showCritical: true });
  eq('alle taken met een tijdvak: venster naar de render, relaties blijven aan', [fields.timeWindow, fields.showDeps], [period, true]);
  const none = studioRowPrintFields({ rows: undefined, multiBand: false, resource: null, window: undefined }, { showDeps: true, showCritical: true });
  eq('hele planning: geen venster', none.timeWindow, undefined);
}

{
  const sequences: Sequence[] = [
    { id: 's1', predecessorId: 'a', successorId: 'b', type: 'FINISH_START', lagDays: 0 },
    { id: 's2', predecessorId: 'b', successorId: 'c', type: 'FINISH_START', lagDays: 0 },
    { id: 's3', predecessorId: 'c', successorId: 'm', type: 'FINISH_START', lagDays: 0 },
  ];
  const record = (options: Partial<PrintOptions>) => {
    const segments: { pts: [number, number][]; lw: number }[] = [];
    const fills: [number, number][][] = [];
    let cur: [number, number][] = [];
    const d2d = fakeDraw2D(d => ({
      beginPath() { cur = []; },
      moveTo(x, y) { cur.push([Number.NaN, Number.NaN], [x, y]); },
      lineTo(x, y) { cur.push([x, y]); },
      fill() { fills.push(cur.filter(p => !Number.isNaN(p[0]))); },
      stroke() { segments.push({ pts: cur.slice(), lw: d.lineWidth }); },
      roundRect() { cur = []; },
    }));
    const rows = taskTreeRows([fase, a, b, c, m]);
    const dims = renderReport(() => d2d, [fase, a, b, c, m], sequences, calendar, 'P', {
      ...RENDER_BASE, showDeps: true, rows, ...options,
    } as PrintOptions);
    const chartTop = dims.headerHeight;
    const chartBottom = dims.height - dims.footerHeight;
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
  const late = record({ timeWindow: { from: '2026-03-15', to: '2026-04-11' } });
  const lateXs = late.deps.flatMap(d => d.pts).filter(([x]) => !Number.isNaN(x)).map(([x]) => x);
  ok(late.deps.length === 2 && late.arrows.length === 1, `rechts het venster uit: twee lijnen, één pijlpunt (${late.deps.length}, ${late.arrows.length})`);
  ok(lateXs.every(x => x <= late.dims.width + 1e-6) && lateXs.some(x => Math.abs(x - late.dims.width) < 1e-6),
    'de lijn die rechts het venster uitloopt, stopt op de rechterrand');
}

{
  const zondag = task('zo', 'Zondagwerk', '2026-09-27T10:00', '2026-09-27T12:00', { parentId: undefined });
  const maandag = task('ma', 'Maandagwerk', '2026-09-28', '2026-09-28', { parentId: undefined });
  const bars = (options: Partial<PrintOptions>) => {
    const rects: { x: number; y: number; w: number }[] = [];
    const d2d = fakeDraw2D(() => ({ roundRect(x, y, w) { rects.push({ x, y, w }); } }));
    const tasksHere = [zondag, maandag];
    const dims = renderReport(() => d2d, tasksHere, [], calendar, 'P', {
      ...RENDER_BASE, rows: taskTreeRows(tasksHere), compressNonWorkdays: true, ...options,
    } as PrintOptions);
    const chartBottom = dims.height - dims.footerHeight;
    const inChart = rects.filter(r => r.y > dims.headerHeight && r.y < chartBottom && r.x >= dims.tableWidth - 1e-6 && r.x + r.w <= dims.width + 1e-6);
    return new Set(inChart.map(r => Math.round(r.y))).size;
  };
  eq('zonder tijdvak: twee balken', bars({}), 2);
  eq('met tijdvak 27 t/m 28 september: nog steeds twee balken', bars({ timeWindow: { from: '2026-09-27', to: '2026-09-28' } }), 2);
  eq('met tijdvak 29 t/m 30 september: geen balk (taken buiten het venster)', bars({ timeWindow: { from: '2026-09-29', to: '2026-09-30' } }), 0);
}

{
  const zondagFase = task('zf', 'Zondagfase', '2026-09-27T10:00', '2026-09-27T12:00', { parentId: undefined, isSummary: true });
  const vrijdag = task('vr', 'Vrijdagwerk', '2026-09-25', '2026-09-25', { parentId: undefined });
  const maxX = (options: Partial<PrintOptions>) => {
    const xs: { x: number; y: number }[] = [];
    const d2d = fakeDraw2D(() => ({
      fillRect(x, y, w) { xs.push({ x: x + w, y }); },
      moveTo(x, y) { xs.push({ x, y }); },
      lineTo(x, y) { xs.push({ x, y }); },
      roundRect(x, y, w) { xs.push({ x: x + w, y }); },
    }));
    const tasksHere = [vrijdag, zondagFase];
    const dims = renderReport(() => d2d, tasksHere, [], calendar, 'P', {
      ...RENDER_BASE, rows: taskTreeRows(tasksHere), compressNonWorkdays: true, ...options,
    } as PrintOptions);
    const chartBottom = dims.height - dims.footerHeight;
    const inChart = xs.filter(p => p.y > dims.headerHeight && p.y < chartBottom && Number.isFinite(p.x));
    return { max: Math.max(...inChart.map(p => p.x)), width: dims.width };
  };
  const edge = maxX({ timeWindow: { from: '2026-09-25', to: '2026-09-27' } });
  ok(edge.max <= edge.width + 1e-6, `de fase en haar haakjes blijven binnen het blad (tot x=${edge.max}, rand ${edge.width})`);
}

{
  const draw = (tasksHere: Task[], window: { from: string; to: string }, options: Partial<PrintOptions>) => {
    const fills: [number, number][][] = [];
    const strokes: { pts: [number, number][]; lw: number; style: string }[] = [];
    const texts: string[] = [];
    let cur: [number, number][] = [];
    const d2d = fakeDraw2D(d => ({
      beginPath() { cur = []; },
      moveTo(x, y) { cur.push([x, y]); },
      lineTo(x, y) { cur.push([x, y]); },
      fill() { fills.push(cur.slice()); },
      stroke() { strokes.push({ pts: cur.slice(), lw: d.lineWidth, style: d.strokeStyle }); },
      roundRect() { cur = []; },
      fillText(text) { texts.push(text); },
    }));
    const dims = renderReport(() => d2d, tasksHere, [], calendar, 'P', {
      ...RENDER_BASE, rows: treeRowsInPeriod(tasksHere, window), timeWindow: window, ...options,
    } as PrintOptions);
    const chartBottom = dims.height - dims.footerHeight;
    const inChart = ([, y]: [number, number]) => y > dims.headerHeight && y < chartBottom;
    const diamonds = fills.filter(f => f.length === 4 && f.every(inChart) && f[0][0] === f[2][0] && f[1][1] === f[3][1]);
    const shapes = fills.filter(f => f.length >= 3 && f.every(([, y]) => y > dims.headerHeight));
    return { dims, strokes, diamonds, shapes, texts };
  };

  const werk = task('wk', 'Werk', '2026-09-28', '2026-10-09', { parentId: undefined });
  for (const statusLine of ['statusDate', 'progress'] as const) {
    const r = draw([werk], { from: '2026-09-28', to: '2026-10-25' }, { statusDate: '2026-09-28', statusLine });
    const status = r.strokes.filter(s => s.lw === 1.5 && s.pts.some(([x]) => Math.abs(x - (r.dims.tableWidth + 1.25)) < 1e-6));
    ok(status.length > 0, `${statusLine}: de lijn staat net binnen de linkerrand als de statusdatum de eerste dag van het tijdvak is`);
    ok(r.texts.some(t => t.includes('28-09-2026')), `${statusLine}: met het datumlabel`);
  }

  const statusStrokes = (window: { from: string; to: string }, statusDate: string) => {
    const r = draw([werk], window, { statusDate, statusLine: 'statusDate', compressNonWorkdays: true });
    return r.strokes.filter(st => st.lw === 1.5 && st.pts.length === 2 && st.pts[0][0] === st.pts[1][0]
      && st.pts[0][0] >= r.dims.tableWidth - 1e-6 && st.pts[0][0] <= r.dims.width + 1e-6).length;
  };
  eq('werkdagas: een statusdatum op de zondag vóór het tijdvak staat niet op papier', statusStrokes({ from: '2026-09-28', to: '2026-10-02' }, '2026-09-27'), 0);
  eq('werkdagas: een statusdatum op de zondag als laatste dag staat er wel', statusStrokes({ from: '2026-09-28', to: '2026-10-04' }, '2026-10-04'), 1);
  eq('werkdagas: een statusdatum op de eerste dag staat er ook', statusStrokes({ from: '2026-09-28', to: '2026-10-02' }, '2026-09-28'), 1);

  const band: ViewRow = { kind: 'group', rowKey: '["Bouw"]', key: '["Bouw"]', label: 'Bouw', count: 1, depth: 0, levelIndex: 0, collapsed: true };
  const alleenBand = draw([werk], { from: '2026-09-28', to: '2026-10-02' }, { rows: [band], showTaskNames: true });
  ok(alleenBand.texts.some(t => t.includes('Bouw') && t.includes('1')), `een ingeklapte band alleen staat op papier met haar telling (${alleenBand.texts.slice(0, 6).join(' | ')})`);
  ok(!alleenBand.texts.some(t => /No tasks|Geen taken/.test(t)), 'en het blad is niet leeg');

  const weekend = task('we', 'Over het weekend', '2026-09-25', '2026-09-28', { parentId: undefined });
  const dagCijfers = (day: string) => draw([weekend], { from: day, to: day }, {}).texts.filter(t => /^\d{1,2}$/.test(t));
  ok(dagCijfers('2026-09-26').includes('26') && dagCijfers('2026-09-27').includes('27'),
    `het dagcijfer van een weekenddag staat op papier (za: ${dagCijfers('2026-09-26')}, zo: ${dagCijfers('2026-09-27')})`);

  const gesplitst = task('sp', 'Onderbroken', '2026-06-01', '2026-06-25', { parentId: undefined,
    time: { ...time('2026-06-01', '2026-06-25'), durationType: 'WORKTIME', scheduleDuration: 1 } as unknown as TaskTime,
    splitGaps: [{ afterMinutes: 1440, gapMinutes: 5760 }] } as Partial<Task>);
  const verbinding = (window: { from: string; to: string }) => {
    const r = draw([gesplitst], window, {});
    const at = (x: number) => (Math.abs(x - r.dims.tableWidth) < 1e-6 ? 'L' : Math.abs(x - r.dims.width) < 1e-6 ? 'R' : 'm');
    return r.strokes.filter(st => st.style.endsWith('80')).map(st => st.pts.map(([x]) => x))
      .filter(xs => xs.every(x => x >= r.dims.tableWidth - 1e-6 && x <= r.dims.width + 1e-6) && Math.abs(xs[xs.length - 1] - xs[0]) > 1)
      .map(xs => `${at(xs[0])}${at(xs[xs.length - 1])}`);
  };
  eq('de hele taak: één verbindingslijn tussen de werkblokken', verbinding({ from: '2026-06-01', to: '2026-06-30' }), ['mm']);
  eq('een tijdvak helemaal in de onderbreking: de lijn loopt van rand tot rand', verbinding({ from: '2026-06-08', to: '2026-06-10' }), ['LR']);
  eq('een tijdvak dat in de onderbreking begint: de lijn loopt van de linkerrand naar de hervatting', verbinding({ from: '2026-06-15', to: '2026-06-26' }), ['Lm']);

  const ms = (id: string, at: string) => task(id, id, at, at, { parentId: undefined, isMilestone: true,
    time: { ...time(at, at), scheduleDuration: 0 } as unknown as TaskTime });
  const vrij = task('vr2', 'Vrijdag', '2026-09-25', '2026-09-25', { parentId: undefined });
  const zondagDag = ms('zd', '2026-09-27');
  const zondagTijd = ms('zt', '2026-09-27T10:00');
  const rand = draw([vrij, zondagDag, zondagTijd], { from: '2026-09-25', to: '2026-09-27' }, { compressNonWorkdays: true });
  eq('beide zondagmijlpalen op de laatste dag houden hun ruit', rand.diamonds.length, 2);
  ok(rand.diamonds.flat().every(([x]) => x >= rand.dims.tableWidth - 1e-6 && x <= rand.dims.width + 1e-6), 'de ruiten blijven binnen het chartgebied');
  const ma = task('ma2', 'Maandag', '2026-09-28', '2026-09-28', { parentId: undefined });
  const baseline = new Map([['ma2', { start: '2026-09-27T10:00', finish: '2026-09-27T10:00', isMilestone: true }]]);
  const zonder = draw([ma], { from: '2026-09-28', to: '2026-09-28' }, { compressNonWorkdays: true, showBaselineOverlay: true, baselineOverlay: baseline });
  eq('een baselinemijlpaal van buiten het tijdvak staat niet op papier', zonder.shapes.length, 0);
  const binnen = draw([ma], { from: '2026-09-27', to: '2026-09-28' }, { compressNonWorkdays: true, showBaselineOverlay: true, baselineOverlay: baseline });
  ok(binnen.shapes.length > 0, '… en wel als zijn dag in het tijdvak valt');
}

if (failures > 0) {
  console.log(`XX report-gantt-period: ${failures} afwijking(en)`);
  process.exit(1);
}
console.log('OK report-gantt-period: tijdvak bewaard, rijen en relaties binnen het tijdvak');
