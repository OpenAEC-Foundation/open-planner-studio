// Layouts in het Rapport-tabblad (issue #861): de meegeleverde layout Resourcediagram op de Gantt-afdruk moet
// precies doen wat het oude rapporttype Resourcediagram deed, zodat dat type weg kan. Deze check legt de twee
// wegen naast elkaar, op een plan met gelijknamige resources, een naamloze resource, taken met meer resources,
// een taak met twee records van dezelfde resource, een mijlpaal, een hammock en een taak zonder resource.
//
//   oud   = wat `ReportPanel` doet bij `reportType: 'resourceGantt'` (rijen uit `computeResourceGanttRows`, en
//           `showDeps` uit, `showCritical` aan, blad per resource, tijdvenster, toewijzingskolommen);
//   nieuw = wat het tabblad doet: de keuze uit de opslag (`reportTaskSource`), de layout uit
//           `builtinLayouts`, de rijen uit `computeLayoutReportRows` en de printvelden uit `studioRowPrintFields`.
//
// Vergeleken per variant (alle 16 standen van de vier opties, zonder en met periode): de rijen (soort, sleutel,
// label, diepte, telling, taak), de toewijzingen per rij, de tellingen, de printvelden, en de bladen
// (`measurePrintReport` + dezelfde tegeling als papier en PDF). Daarna een paar regels van de nieuwe weg zelf:
// filter en sortering van een eigen layout, de keuze in de opslag, en wat een layout aan kolommen en
// schakelaars meebrengt.
// Draait via run.sh. Exit 0 = alles groen.

import { computeResourceGanttRows, type ResolvedPeriod } from '@/engine/reports';
import { computeLayoutReportRows, groupIsMultiBand, resourceBandShape } from '@/engine/reports/layoutReport';
import { computeViewRows, type ViewContext, type ViewRow } from '@/engine/view/visibleRows';
import { RESOURCE_DIAGRAM_LAYOUT_ID } from '@/engine/view/layoutPresets';
import { builtinLayouts } from '@/components/viewControls/builtinLayouts';
import { reportTaskSource, taskSourcePatch, layoutReportPatch } from '@/components/panels/reportStudio/reportLayouts';
import { studioRowPrintFields, type StudioRowSource } from '@/components/panels/reportStudio/studioRowSource';
import { measurePrintReport, type PrintOptions } from '@/services/print/printPreview';
import { computeTileLayout, reportTileInput } from '@/services/print/tileLayout';
import { ganttTileOptions } from '@/services/print/reportPaperModel';
import { DEFAULT_REPORT_SETTINGS, type ResourceGanttReportOptions } from '@/utils/reportSettings';
import type { Task, TaskTime } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import type { FieldRef, FilterNode, Layout } from '@/types/view';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { missingFilterFields, type FieldCatalogCtx } from '@/components/viewControls/fieldCatalog';

let failures = 0;
const fail = (msg: string) => { console.log(`XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };
const eq = (msg: string, got: unknown, want: unknown) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) fail(`${msg}\n   kreeg  ${a}\n   wilde  ${b}`);
};

// ── Plan ──────────────────────────────────────────────────────────────────────────────────────────
const cal = {
  id: 'c1', name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
} as unknown as WorkCalendar;

const time = (start: string, finish: string, over: Partial<TaskTime> = {}): TaskTime => ({
  earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish,
  duration: 5, totalFloat: 0, isCritical: false, completion: 0,
  scheduleStart: start, scheduleFinish: finish, ...over,
} as TaskTime);
const task = (id: string, name: string, start: string, finish: string, over: Partial<Task> = {}): Task => ({
  id, name, parentId: 'fase', childIds: [], isMilestone: false, wbsCode: id,
  taskType: 'CONSTRUCTION', activityCodes: {}, customFields: {},
  time: time(start, finish), ...over,
} as unknown as Task);

const leaves: Task[] = [
  task('t1', 'Fundering', '2026-03-02', '2026-03-13', { time: time('2026-03-02', '2026-03-13', { isCritical: true }) }),
  task('t2', 'Casco', '2026-03-16', '2026-04-10'),
  task('t3', 'Gevel', '2026-04-13', '2026-04-24'),
  task('t4', 'Oplevering', '2026-05-04', '2026-05-04', { isMilestone: true }),
  task('t5', 'Begeleiding', '2026-03-02', '2026-05-04', { isHammock: true }),
  task('t6', 'Afwerking', '2026-04-27', '2026-05-01'),
  task('t7', 'Losse taak', '2026-02-16', '2026-02-20'),
  // Begint vóór Fundering: binnen een band staat hij op start bovenaan, in invoervolgorde onderaan.
  task('t8', 'Bouwrijp maken', '2026-02-23', '2026-02-27'),
];
const fase = task('fase', 'Fase 1', '2026-02-16', '2026-05-04', { parentId: undefined, childIds: leaves.map(l => l.id) });
const tasks: Task[] = [fase, ...leaves];

const res = (id: string, name: string, type: Resource['type']): Resource => ({ id, name, type, description: '', maxUnits: 1 });
const resources: Resource[] = [
  res('r-jan1', 'Jan', 'LABOR'),
  res('r-kraan', 'Kraan', 'EQUIPMENT'),
  res('r-jan2', ' jan ', 'LABOR'),
  res('r-leeg', '', 'MATERIAL'),
  res('r-ploeg', 'Ploeg Noord', 'CREW'),
];
let n = 0;
const asg = (taskId: string, resourceId: string, unitsPerDay = 1, over: Partial<ResourceAssignment> = {}): ResourceAssignment =>
  ({ id: `a${++n}`, taskId, resourceId, unitsPerDay, ...over });
const assignments: ResourceAssignment[] = [
  asg('t1', 'r-jan1'), asg('t1', 'r-kraan', 0.5),
  asg('t2', 'r-jan2'), asg('t2', 'r-jan1', 2), asg('t2', 'r-ploeg'),
  // Twee records van dezelfde resource op één taak: één rij, eenheden opgeteld, curve verschilt ⇒ onbekend.
  asg('t3', 'r-leeg', 1), asg('t3', 'r-leeg', 2, { curve: 'BELL' }),
  asg('t4', 'r-ploeg'), asg('t5', 'r-kraan'), asg('t6', 'r-jan1', 1, { curve: 'FRONT_LOADED' }),
  asg('t8', 'r-ploeg'), asg('t8', 'r-jan1'),
  // Een toewijzing aan een onbekende resource telt niet.
  asg('t7', 'r-weg'),
];

const locale = 'nl';
const noneLabel = '(geen)';
const typeLabels = { LABOR: 'Arbeid', CREW: 'Ploeg', SUBCONTRACTOR: 'Onderaannemer', EQUIPMENT: 'Materieel', MATERIAL: 'Materiaal' };
const ctx: ViewContext = { activityCodeTypes: [], customFieldDefs: [], resources, assignments, noneLabel, resourceTypeLabels: typeLabels };
const tLabel = ((key: string) => key) as Parameters<typeof builtinLayouts>[0];

// Basisopties zoals het paneel ze voor beide wegen zet (alles behalve wat uit de rijenbron volgt).
const base = (over: Partial<PrintOptions>): PrintOptions => ({
  showCritical: true, showFloat: true, showDeps: true, showWeekends: true, showLegend: true,
  showTaskNames: true, showCompletion: true, autoFit: true, customZoom: 22,
  paperSize: 'A4', orientation: 'landscape', companyName: 'Test',
  barColorSelection: { mode: 'critical' }, activityCodeTypes: [], customFieldDefs: [],
  taskTypeLabels: {}, barColorNoneLabel: noneLabel, resources, assignments,
  labels: {
    noTasks: '-', printed: '-', today: '-', statusDate: 'Statusdatum', progressDate: 'Voortgangsdatum',
    legend: {
      criticalPath: 'Kritiek pad', normal: 'Normaal', nearCritical: 'Bijna-kritiek', milestone: 'Mijlpaal',
      summary: 'Samenvatting', float: 'Speling', completion: 'Voortgang', relationStyle: 'Bepalend',
    },
    tableHeaders: { wbs: 'WBS', taskName: 'Taak', start: 'Start', end: 'Eind', duration: 'Duur', completion: 'Volt.', unitsPerDay: 'Eenh./d', curve: 'Curve' },
  } as PrintOptions['labels'],
  curveLabels: { UNIFORM: 'Gelijk', BELL: 'Klok', FRONT_LOADED: 'Voorin' },
  ...over,
});

const rowShape = (rows: readonly ViewRow[]) => rows.map(r => (r.kind === 'group'
  ? ['g', r.rowKey, r.label, r.depth, r.count]
  : ['t', r.rowKey, r.task.id, r.depth]));

/** Bladen zoals papier en PDF ze tegelen: aantal, en per blad het bereik op het papier. */
function pages(options: PrintOptions) {
  const dims = measurePrintReport(tasks, [], cal, 'Plan', options);
  const layout = computeTileLayout(reportTileInput(dims, ganttTileOptions(options, true, true)));
  return {
    rows: layout.rows, cols: layout.cols,
    body: layout.bodyRows.map(b => [Math.round(b.srcY * 100) / 100, Math.round(b.srcH * 100) / 100]),
    forced: dims.forcedBreakOffsets ?? [], dropped: dims.assignmentColumnsDropped ?? false,
  };
}

// ── 1. De keuze: een bewaard Resourcediagram opent de meegeleverde layout ───────────────────────────
const source = reportTaskSource({ ...DEFAULT_REPORT_SETTINGS, reportType: 'resourceGantt' });
eq('opslag: reportType resourceGantt ⇒ layout Resourcediagram', source, { kind: 'layout', id: RESOURCE_DIAGRAM_LAYOUT_ID });
const rd = builtinLayouts(tLabel).find(l => source.kind === 'layout' && l.id === source.id);
ok(!!rd, 'de layout Resourcediagram staat in de meegeleverde layouts');
eq('terug naar de opslag: de layout Resourcediagram ⇒ layoutId én reportType resourceGantt', taskSourcePatch(source), { reportType: 'resourceGantt', layoutId: RESOURCE_DIAGRAM_LAYOUT_ID, followView: false });
// Een ander rapport bekijken overschrijft alleen `reportType` (review Sol #847, ronde 4): de layout blijft.
for (const reportType of ['milestones', 'gantt'] as const) {
  eq(`uitstap: reportType ${reportType} met layoutId Resourcediagram ⇒ layout Resourcediagram`,
    reportTaskSource({ ...taskSourcePatch(source), reportType }), { kind: 'layout', id: RESOURCE_DIAGRAM_LAYOUT_ID });
}
// Het oude paneel (flag uit) kiest het rapporttype Resourcediagram terwijl een eigen layout bewaard staat:
// die latere keuze wint, zoals vóór deze fix.
eq('flag uit: reportType resourceGantt wint van een bewaarde eigen layout',
  reportTaskSource({ reportType: 'resourceGantt', layoutId: 'layout-x', followView: false }), { kind: 'layout', id: RESOURCE_DIAGRAM_LAYOUT_ID });
eq('een eigen layout ⇒ gantt + layoutId', taskSourcePatch({ kind: 'layout', id: 'layout-x' }), { reportType: 'gantt', layoutId: 'layout-x', followView: false });
eq('Zoals de weergave', taskSourcePatch({ kind: 'view' }), { reportType: 'gantt', layoutId: '', followView: true });
eq('Alle taken', reportTaskSource({ reportType: 'gantt', layoutId: '', followView: false }), { kind: 'all' });

// ── 2. Pariteit met het oude rapporttype, alle opties en een periode ───────────────────────────────
const windows: (ResolvedPeriod | undefined)[] = [undefined, { from: '2026-03-20', to: '2026-04-20' }];
let variants = 0;
for (const window of windows) {
  for (let bits = 0; bits < 16; bits++) {
    const opts: ResourceGanttReportOptions = {
      pageBreakPerResource: (bits & 1) !== 0,
      includeUnassigned: (bits & 2) !== 0,
      groupByType: (bits & 4) !== 0,
      showAssignmentColumns: (bits & 8) !== 0,
      period: window ? { preset: 'custom', from: window.from, to: window.to } : { preset: 'project' },
    };
    const name = `[${Object.entries(opts).filter(([k, v]) => k !== 'period' && v).map(([k]) => k).join(',') || 'geen opties'}${window ? ', periode' : ''}]`;

    // Oud: ReportPanel bij reportType 'resourceGantt'.
    const old = computeResourceGanttRows({ tasks, resources, assignments }, {
      includeUnassigned: opts.includeUnassigned, noneLabel, locale, groupByType: opts.groupByType, typeLabels, window,
    });
    const oldOptions = base({
      showCritical: true, showDeps: false, rows: old.rows,
      pageBreakBeforeGroups: opts.pageBreakPerResource, timeWindow: window,
      assignmentColumns: opts.showAssignmentColumns, rowAssignments: old.assignmentByRowKey,
    });

    // Nieuw: de stap Taken van het tabblad, met de planner-schakelaars bewust andersom (relaties aan, kritiek
    // pad uit): de layout moet die net als het oude type overrulen.
    const fresh = computeLayoutReportRows(rd!, { tasks, ctx }, {
      includeUnassigned: opts.includeUnassigned, groupByType: opts.groupByType, window, locale, typeLabels,
    });
    const rowSource: StudioRowSource = {
      rows: fresh.rows, multiBand: fresh.multiBand,
      resource: fresh.resource ? { result: fresh.resource, options: opts, window } : null,
    };
    const newOptions = base(studioRowPrintFields(rowSource, { showDeps: true, showCritical: false }));

    ok(fresh.resource !== null, `${name} nieuw: de resourcebouwer bouwt de rijen`);
    eq(`${name} rijen`, rowShape(fresh.rows), rowShape(old.rows));
    eq(`${name} toewijzingen per rij`, [...(fresh.resource?.assignmentByRowKey ?? [])], [...old.assignmentByRowKey]);
    eq(`${name} tellingen`, fresh.resource?.counts, old.counts);
    const fields = (o: PrintOptions) => [o.showDeps, o.showCritical, o.pageBreakBeforeGroups, o.timeWindow, o.assignmentColumns];
    eq(`${name} printvelden`, fields(newOptions), fields(oldOptions));
    eq(`${name} bladen`, pages(newOptions), pages(oldOptions));
    variants++;
  }
}
ok(variants === 32, 'alle 32 varianten vergeleken');

// Het plan raakt wat het moet raken (anders bewijst de pariteit weinig).
{
  const r = computeResourceGanttRows({ tasks, resources, assignments }, { includeUnassigned: true, noneLabel, locale, typeLabels });
  const bands = r.rows.filter(x => x.kind === 'group').map(x => (x.kind === 'group' ? x.label : ''));
  ok(bands.includes('Jan #1') && bands.includes('jan #2'), `gelijke namen krijgen een volgnummer (${bands.join(' | ')})`);
  ok(bands.includes('#4'), 'een naamloze resource krijgt een surrogaat');
  ok(bands[bands.length - 1] === noneLabel, 'taken zonder resource als laatste band');
  ok(r.rows.filter(x => x.kind === 'task' && x.task.id === 't2').length === 3, 'een taak met drie resources staat onder drie banden');
  ok(r.rows.some(x => x.kind === 'task' && x.task.id === 't4') && r.rows.some(x => x.kind === 'task' && x.task.id === 't5'), 'mijlpaal en hammock tellen mee');
  const dubbel = [...r.assignmentByRowKey.entries()].find(([key]) => key.includes('"t3"'));
  eq('twee records van één resource: eenheden opgeteld, curve onbekend', dubbel?.[1], { unitsPerDay: 3, curve: null });
  const periode = computeResourceGanttRows({ tasks, resources, assignments }, { includeUnassigned: true, noneLabel, locale, window: windows[1] });
  ok(periode.counts.outsidePeriod > 0 && periode.counts.inPeriod > 0, 'de periode laat taken weg en houdt er over');
  const paged = pages(base({ rows: r.rows, pageBreakBeforeGroups: true }));
  ok(paged.forced.length > 0 && paged.rows > 1, 'een blad per resource geeft gedwongen bladovergangen');
}

// ── 3. Regels van de nieuwe weg zelf ────────────────────────────────────────────────────────────────
// Een eigen layout met een resourcegroepering: dezelfde bouwer (identiteit, niet naam), met filter en sortering.
{
  const own: Layout = {
    id: 'layout-eigen', name: 'Eigen',
    group: [{ field: { src: 'resource' }, dir: 'asc' }],
    sort: [{ field: { src: 'builtin', key: 'name' }, dir: 'asc' }],
    filter: { kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'Gevel' },
  };
  const r = computeLayoutReportRows(own, { tasks, ctx }, { includeUnassigned: false, groupByType: false, locale, typeLabels });
  ok(r.resource !== null && r.multiBand, 'eigen layout op resource: de resourcebouwer, relaties uit');
  ok(!r.rows.some(x => x.kind === 'task' && x.task.id === 't3'), 'het filter van de layout geldt');
  const jan1 = r.rows.findIndex(x => x.kind === 'group' && x.label === 'Jan #1');
  const names: string[] = [];
  for (const x of r.rows.slice(jan1 + 1)) { if (x.kind !== 'task') break; names.push(x.task.name); }
  eq('de sortering van de layout binnen een band (op naam)', names, ['Afwerking', 'Bouwrijp maken', 'Casco', 'Fundering']);
  const startSorted = computeLayoutReportRows(rd!, { tasks, ctx }, { includeUnassigned: false, groupByType: false, locale, typeLabels });
  const jan1b = startSorted.rows.findIndex(x => x.kind === 'group' && x.label === 'Jan #1');
  ok(startSorted.rows[jan1b + 1]?.kind === 'task' && (startSorted.rows[jan1b + 1] as { task: Task }).task.id === 't8', 'het Resourcediagram sorteert op start');
  const desc = computeLayoutReportRows({ ...own, filter: undefined, group: [{ field: { src: 'resource' }, dir: 'desc' }] }, { tasks, ctx },
    { includeUnassigned: false, groupByType: false, locale, typeLabels });
  const ascBands = startSorted.rows.filter(x => x.kind === 'group').map(x => (x.kind === 'group' ? x.label : ''));
  const descBands = desc.rows.filter(x => x.kind === 'group').map(x => (x.kind === 'group' ? x.label : ''));
  eq('aflopende resourcegroepering keert de banden om', descBands, [...ascBands].reverse());
  const typed = computeLayoutReportRows({ group: [{ field: { src: 'resourceType' }, dir: 'asc' }, { field: { src: 'resource' }, dir: 'asc' }] },
    { tasks, ctx }, { includeUnassigned: false, groupByType: false, locale, typeLabels });
  eq('[resourcetype, resource] is de typelaag van het oude rapport', rowShape(typed.rows),
    rowShape(computeResourceGanttRows({ tasks, resources, assignments }, { includeUnassigned: false, noneLabel, locale, groupByType: true, typeLabels }).rows));
}
// Een groepering zonder resource: de rijen van het scherm, zonder ingeklapte banden; relaties blijven aan.
{
  const filterOnly: Layout = { id: 'f', name: 'Filter', filter: { kind: 'rule', field: { src: 'builtin', key: 'isMilestone' }, operator: 'eq', value: true } };
  const r = computeLayoutReportRows(filterOnly, { tasks, ctx }, { includeUnassigned: false, groupByType: false, locale });
  eq('alleen een filter: de boom met de mijlpaal en zijn fase',
    rowShape(r.rows), rowShape(computeViewRows(tasks, { filter: filterOnly.filter!, group: [], sort: [], collapsedTaskIds: new Set(), collapsedGroupKeys: new Set() }, ctx)));
  ok(r.resource === null && !r.multiBand, 'alleen een filter: geen resourcebouwer, relaties aan');
  ok(groupIsMultiBand([{ field: { src: 'resourceType' }, dir: 'asc' }]) && resourceBandShape([{ field: { src: 'resourceType' }, dir: 'asc' }]) === null,
    'alleen op resourcetype: relaties uit, maar de rijen van het scherm');
  const fields = studioRowPrintFields({ rows: r.rows, multiBand: false, resource: null }, { showDeps: true, showCritical: false });
  eq('zonder resource volgen relaties en kritiek pad de planner', [fields.showDeps, fields.showCritical, fields.pageBreakBeforeGroups, fields.assignmentColumns], [true, false, false, false]);
  // Zoals de weergave, terwijl het scherm op resource groepeert: de rijen van het scherm, relaties uit, kritiek pad aan.
  const banded = studioRowPrintFields({ rows: r.rows, multiBand: true, resource: null }, { showDeps: true, showCritical: false });
  eq('banden zonder resourcebouwer: relaties uit, kritiek pad aan, geen resourcevelden',
    [banded.showDeps, banded.showCritical, banded.pageBreakBeforeGroups, banded.assignmentColumns, banded.timeWindow], [false, true, false, false, undefined]);
}
// Wat een layout bij het kiezen meebrengt.
{
  const available = new Set(['task.wbsCode', 'task.name', 'task.time.start', 'task.time.finish', 'task.custom.x']);
  const layout: Layout = {
    id: 'l', name: 'L',
    columns: ['task.wbsCode', 'task.time.start', 'task.onbekend'].map(id => ({ id: taskColumnId(id), width: 80, pinned: false })),
    showRelations: false,
    overlays: { baseline: true, progressLine: false, statusDateLine: true, resourceAccent: true, floatBand: false, barColors: { mode: 'auto' } },
    timeScale: 'week',
  };
  eq('kolommen, relaties en overlays (geen tijdschaal, geen balkkleuren)', layoutReportPatch(layout, available), {
    columns: ['task.name', 'task.wbsCode', 'task.time.start'], showDeps: false,
    showBaselineOverlay: true, showFloat: false, statusLine: 'statusDate',
  });
  eq('voortgangslijn gaat voor statusdatumlijn', layoutReportPatch({ ...layout, columns: undefined, overlays: { ...layout.overlays!, progressLine: true } }, available).statusLine, 'progress');
  eq('het Resourcediagram brengt niets mee (relaties staan daar toch uit)', layoutReportPatch(rd!, available), {});
  eq('een layout zonder delen brengt niets mee', layoutReportPatch({ id: 'x', name: 'X', filter: null }, available), {});
}
// Een filterveld dat het project niet heeft (review Sol #847, ronde 4): de stap Taken meldt het, het filter blijft.
{
  const ctx = {
    activityCodeTypes: [{ id: 'ac-fase', name: 'Fase', values: [] }], customFieldDefs: [{ id: 'cf-zone', name: 'Zone', type: 'text' }],
    resources: [], builtinLabels: {}, taskTypeLabels: {}, resourceLabel: 'Resource', activityCodeSuffix: '', customFieldSuffix: '',
  } as unknown as FieldCatalogCtx;
  const rule = (field: FieldRef): FilterNode => ({ kind: 'rule', field, operator: 'eq', value: 'A' });
  const gone: FieldRef = { src: 'customField', defId: 'removed-custom-field' };
  const goneCode: FieldRef = { src: 'activityCode', typeId: 'ac-weg' };
  eq('bestaande velden: niets te melden', missingFilterFields({ kind: 'group', op: 'AND', children: [
    rule({ src: 'builtin', key: 'name' }), rule({ src: 'builtin', key: 'activeDuring' }), rule({ src: 'customField', defId: 'cf-zone' }),
    rule({ src: 'activityCode', typeId: 'ac-fase' }), rule({ src: 'resource' }), rule({ src: 'resourceType' }),
  ] }, ctx), []);
  eq('geen filter: niets te melden', missingFilterFields(null, ctx), []);
  eq('een verwijderd eigen veld, ook diep in een groep en twee keer: één melding per veld', missingFilterFields({ kind: 'group', op: 'OR', children: [
    rule(gone), { kind: 'group', op: 'AND', children: [rule({ src: 'builtin', key: 'name' }), rule(gone), rule(goneCode)] },
  ] }, ctx), [gone, goneCode]);
}

console.log(failures === 0 ? 'check-report-layouts: alles groen' : `check-report-layouts: ${failures} fout(en)`);
process.exit(failures === 0 ? 0 : 1);
