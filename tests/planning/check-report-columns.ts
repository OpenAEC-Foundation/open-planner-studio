// De kolomlijst van de Gantt-afdruk (issue #817, deel B). Bewaakt:
//  1. Zonder kolomlijst en met dezelfde lijst als expliciete ingebouwde kolommen geeft de render
//     byte-gelijke tekenopdrachten, met de kolomgrenzen in de oude volgorde. Let op: dit vergelijkt de
//     huidige render met zichzelf. Het legt het gedrag van vóór #817 (main) niet vast (review Sol #847).
//  2. Volgorde: de kolommen staan op papier in de volgorde van de lijst, de taaknaam altijd erbij.
//  3. Celtekst: een registerkolom (Kalenderdagen) toont per taak dezelfde tekst als de cel in het
//     taakraster (`getCell`), via één bron (`taskGridCellText`).
//  4. Breedte: gemeten = langste tekst + opvulling, begrensd; zonder meting de vaste terugvalbreedte
//     (het pad zonder meten is deterministisch).
//  5. Opslag: een oude instelling zonder kolomlijst valt terug op de standaard, met de keuze Voltooiing;
//     rommel valt terug; de taaknaam komt er altijd in. De breedte per dag mag een breuk onder 1 zijn; de
//     vervallen stap "export" valt terug op stap 1.
//  6. Caches voor 5000 taken: een kolom erbij meet alleen die kolom (zelfde breedtes als zonder cache), en
//     dezelfde registerkolom blijft hetzelfde object.
import './domStub';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderReport, measureTableColumnWidths, buildPrintRows, AUTO_COLUMN_MIN_WIDTH, createTableColumnMeasureCache,
  CUSTOM_COLUMN_FALLBACK_WIDTH, REPORT_MAX_ZOOM, REPORT_MIN_DAY_WIDTH, type PrintOptions, type PrintTableColumn,
} from '@/services/print/printPreview';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import { readIFC } from '@/services/ifc/ifcReader';
import { createTaskGridAdapter, createTaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { effHoursPerDay, effectiveCalendarOf, effectiveDurationDisplay } from '@/utils/taskDuration';
import {
  DEFAULT_REPORT_SETTINGS, REPORT_DEFAULT_COLUMNS, REPORT_MAX_COLUMNS, REPORT_REQUIRED_COLUMN,
  chosenReportChange, loadReportSettings, parseReportColumns, patchReportSettings,
} from '@/utils/reportSettings';
import {
  addReportColumn, isDefaultReportColumns, moveReportColumn, placeReportColumn, removeReportColumn,
  reportColumnsFromGrid, resolveReportColumns,
} from '@/components/panels/reportStudio/reportColumns';
import type { ViewRow } from '@/engine/view/visibleRows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };
const eq = (got: unknown, want: unknown, msg: string) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) fail(`${msg}: verwacht ${w}, kreeg ${g}`);
};

// ── Opnemende Draw2D: elke tekenopdracht als één regel tekst ──────────────────────────────────
interface Recorded { log: string[]; texts: { text: string; x: number; y: number }[] }
function record(options: PrintOptions): Recorded & { result: ReturnType<typeof renderReport> } {
  const log: string[] = [];
  const texts: { text: string; x: number; y: number }[] = [];
  const st = { font: '10px x', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
  const r = (v: number) => Math.round(v * 100) / 100;
  const d2d: Draw2D = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash(d) { log.push(`dash ${d.join(',')}`); },
    fillRect(x, y, w, h) { log.push(`fillRect ${r(x)} ${r(y)} ${r(w)} ${r(h)} ${st.fillStyle}`); },
    strokeRect(x, y, w, h) { log.push(`strokeRect ${r(x)} ${r(y)} ${r(w)} ${r(h)} ${st.strokeStyle}`); },
    beginPath() { log.push('beginPath'); },
    moveTo(x, y) { log.push(`moveTo ${r(x)} ${r(y)}`); },
    lineTo(x, y) { log.push(`lineTo ${r(x)} ${r(y)}`); },
    closePath() { log.push('closePath'); },
    fill() { log.push(`fill ${st.fillStyle}`); },
    stroke() { log.push(`stroke ${st.strokeStyle} ${st.lineWidth}`); },
    roundRect(x, y, w, h) { log.push(`roundRect ${r(x)} ${r(y)} ${r(w)} ${r(h)}`); },
    fillText(text, x, y) { log.push(`text ${text} ${r(x)} ${r(y)} ${st.font} ${st.textAlign}`); texts.push({ text, x, y }); },
    measureText(t) { return { width: t.length * 6 }; },
  };
  const result = renderReport(() => d2d, project.tasks, project.sequences, project.calendar, project.project.name, options);
  return { log, texts, result };
}

// ── Fixture: het echte voorbeeldproject (57 taken) ────────────────────────────────────────────
const project = readIFC(readFileSync(join(ROOT, 'public/examples/03-kantoorgebouw-zuidas.ifc'), 'utf8'));
const baseOptions = (over: Partial<PrintOptions> = {}): PrintOptions => ({
  showCritical: true, showFloat: true, showDeps: true, showWeekends: true, showLegend: true,
  showTaskNames: true, showCompletion: true, autoFit: true, customZoom: 22,
  paperSize: 'A3', orientation: 'landscape', companyName: 'Bouwbedrijf',
  locale: 'nl', calendars: [project.calendar], resources: project.resources, assignments: project.assignments,
  projectStartDate: project.project.startDate, projectEndDate: project.project.endDate,
  ...over,
});
const BUILTIN_DEFAULT: PrintTableColumn[] = [
  { key: 'task.wbsCode', builtin: 'wbs' }, { key: 'task.name', builtin: 'name' },
  { key: 'task.time.scheduleDuration', builtin: 'duration' }, { key: 'task.time.start', builtin: 'start' },
  { key: 'task.time.finish', builtin: 'end' }, { key: 'task.time.completion', builtin: 'complete' },
];

// ── 1. Zonder lijst = expliciete standaardlijst, byte-gelijk (de huidige render met zichzelf) ─────
{
  const legacy = record(baseOptions());
  const explicit = record(baseOptions({ tableColumns: BUILTIN_DEFAULT }));
  eq(explicit.log.length, legacy.log.length, 'standaardlijst: evenveel tekenopdrachten als de vaste tabel');
  const firstDiff = legacy.log.findIndex((line, i) => explicit.log[i] !== line);
  ok(firstDiff === -1, `standaardlijst: tekenopdrachten gelijk aan de vaste tabel (eerste verschil op ${firstDiff}: ${legacy.log[firstDiff]} ↔ ${explicit.log[firstDiff]})`);
  eq(explicit.result.tableWidth, legacy.result.tableWidth, 'standaardlijst: zelfde tabelbreedte');
  eq((legacy.result.tableColumnBounds ?? []).map(c => c.key), ['wbs', 'name', 'duration', 'start', 'end', 'complete'],
    'vaste tabel: kolomgrenzen in de oude volgorde');

  // Voltooiing uit zonder lijst ⇒ geen Volt.-kolom (oud gedrag); met een lijst stuurt de lijst.
  const noCompletion = record(baseOptions({ showCompletion: false }));
  ok(!(noCompletion.result.tableColumnBounds ?? []).some(c => c.key === 'complete'), 'vaste tabel: Voltooiing uit ⇒ geen Volt.-kolom');
  const listWithCompletion = record(baseOptions({ showCompletion: false, tableColumns: BUILTIN_DEFAULT }));
  ok((listWithCompletion.result.tableColumnBounds ?? []).some(c => c.key === 'complete'), 'met lijst: de lijst bepaalt de Volt.-kolom, niet showCompletion');
}

// ── 2. Volgorde en verplichte taaknaam ──────────────────────────────────────────────────────────
{
  const reordered = record(baseOptions({ tableColumns: [
    { key: 'task.time.finish', builtin: 'end' }, { key: 'task.name', builtin: 'name' }, { key: 'task.wbsCode', builtin: 'wbs' },
  ] }));
  const bounds = reordered.result.tableColumnBounds ?? [];
  eq(bounds.map(c => c.key), ['end', 'name', 'wbs'], 'herschikt: kolommen in de volgorde van de lijst');
  ok(bounds.every((c, i) => i === 0 || c.x >= bounds[i - 1].x + bounds[i - 1].w - 0.01), 'herschikt: x loopt op zonder overlap');
  const headerTexts = reordered.texts.filter(t => t.y < (reordered.result.headerHeight || 0)).map(t => t.text);
  ok(!headerTexts.includes('Duur'), 'herschikt: een weggelaten kolom (Duur) staat niet in de kop');

  const withoutName = record(baseOptions({ tableColumns: [{ key: 'task.time.start', builtin: 'start' }] }));
  eq((withoutName.result.tableColumnBounds ?? []).map(c => c.key), ['name', 'start'], 'zonder taaknaam: de naam komt er vooraan bij');

  const dupes = record(baseOptions({ tableColumns: [
    { key: 'task.name', builtin: 'name' }, { key: 'task.time.start', builtin: 'start' }, { key: 'x', builtin: 'start' },
  ] }));
  eq((dupes.result.tableColumnBounds ?? []).map(c => c.key), ['name', 'start'], 'dubbele soort telt één keer');
}

// ── 3. Celtekst uit één bron: Kalenderdagen zoals het taakraster ────────────────────────────────
const domain = createTaskGridAdapterDomain({
  projectId: project.project.id, tasks: project.tasks, sequences: project.sequences, cpmResult: null,
  assignments: project.assignments, resources: project.resources, baselines: project.baselines ?? [],
  activityCodeTypes: project.activityCodeTypes ?? [], customFieldDefs: project.customFieldDefs ?? [],
  scheduleStale: false, wbsAutoNumber: false,
  labelForColumn: key => key,
  effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, project.calendar, project.resourceCalendars ?? [])),
  effectiveCalendar: t => effectiveCalendarOf(t, project.calendar, project.resourceCalendars ?? []),
  durationDisplay: effectiveDurationDisplay('auto', true),
  workdayDurationMeasure: true,
  numberLocale: 'nl',
});
const CAL_DAYS = 'task.time.calendarDays';
{
  ok(domain.descriptorsById.has(taskColumnId(CAL_DAYS)), 'register: de kolom Kalenderdagen bestaat');
  // De kop zoals het raster hem noemt; hier het laatste deel van de sleutel, kort genoeg om te passen.
  const resolved = resolveReportColumns([...REPORT_DEFAULT_COLUMNS, CAL_DAYS, 'cf.bestaat-niet'], domain, project.tasks, key => key.split('.').pop() ?? key);
  eq(resolved.missing, ['cf.bestaat-niet'], 'onbekende kolom komt in "missing" en niet in de afdruk');
  eq(resolved.columns.map(c => c.key), [...REPORT_DEFAULT_COLUMNS, CAL_DAYS], 'opgeloste kolommen in volgorde');
  const cal = resolved.columns.find(c => c.key === CAL_DAYS)!;
  ok(!cal.builtin && typeof cal.header === 'string' && cal.header.length > 0, 'registerkolom: eigen kop');
  ok(cal.align === 'right', `registerkolom met een getal: rechts uitgelijnd (kreeg ${cal.align})`);

  // Dezelfde tekst als de cel in het raster.
  const rows: ViewRow[] = project.tasks.map(task => ({ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false }));
  const adapter = createTaskGridAdapter({ surfaceId: 'gantt-task-grid', rows, selectedTaskIds: [] }, domain);
  let compared = 0;
  for (const task of project.tasks) {
    const gridText = adapter.getCell(task.id, taskColumnId(CAL_DAYS))?.text ?? '';
    const paperText = cal.cells?.get(task.id) ?? '';
    const want = gridText === '—' ? '' : gridText;
    if (paperText !== want) { fail(`celtekst ${task.id}: raster "${gridText}", papier "${paperText}"`); break; }
    if (want) compared++;
  }
  ok(compared > 10, `celtekst: genoeg gevulde cellen vergeleken (${compared})`);

  // En die tekst staat op papier, in de kolom Kalenderdagen.
  // Zoals het paneel: meten op koppen en cellen van dit rapport, dan tekenen met die breedtes.
  const measuredWidths = measureTableColumnWidths(buildPrintRows(project.tasks, undefined),
    { showCompletion: true, tableColumns: resolved.columns }, text => text.length * 6);
  ok((measuredWidths[CAL_DAYS] ?? 0) >= AUTO_COLUMN_MIN_WIDTH, 'meten: registerkolom krijgt een gemeten breedte');
  const paper = record(baseOptions({ tableColumns: resolved.columns, columnWidths: measuredWidths }));
  const bounds = paper.result.tableColumnBounds ?? [];
  const calBox = bounds.find(c => c.key === CAL_DAYS);
  ok(!!calBox, 'papier: kolomgrens voor Kalenderdagen');
  eq(bounds.map(c => c.key), ['wbs', 'name', 'duration', 'start', 'end', 'complete', CAL_DAYS], 'papier: registerkolom achter de standaardkolommen');
  if (calBox) {
    const sample = [...(cal.cells ?? new Map<string, string>()).values()][0];
    const inColumn = paper.texts.filter(t => t.text === sample && t.x >= calBox.x - 0.01 && t.x <= calBox.x + calBox.w + 0.01);
    ok(inColumn.length > 0, `papier: celtekst "${sample}" staat binnen de kolom Kalenderdagen`);
    ok(paper.texts.some(t => t.text === cal.header), 'papier: kop Kalenderdagen getekend');
  }
}

// ── 6. Caches voor een groot plan: alleen de nieuwe kolom meten ────────────────────────────────
{
  const labelFor = (key: string) => key.split('.').pop() ?? key;
  const columnCache = new Map<string, PrintTableColumn>();
  const first = resolveReportColumns([...REPORT_DEFAULT_COLUMNS, CAL_DAYS], domain, project.tasks, labelFor, columnCache);
  const moved = resolveReportColumns([CAL_DAYS, ...REPORT_DEFAULT_COLUMNS], domain, project.tasks, labelFor, columnCache);
  ok(first.columns.find(c => c.key === CAL_DAYS) === moved.columns.find(c => c.key === CAL_DAYS),
    'cache: dezelfde registerkolom blijft hetzelfde object, ook op een andere plek');
  const rows = buildPrintRows(project.tasks, undefined);
  let calls = 0;
  const meter = (text: string) => { calls++; return text.length * 6; };
  const measureCache = createTableColumnMeasureCache();
  const standard = first.columns.filter(c => c.key !== CAL_DAYS);
  measureTableColumnWidths(rows, { showCompletion: true, tableColumns: standard }, meter, measureCache);
  const fullCalls = calls;
  calls = 0;
  const added = measureTableColumnWidths(rows, { showCompletion: true, tableColumns: first.columns }, meter, measureCache);
  const addCalls = calls;
  eq(added, measureTableColumnWidths(rows, { showCompletion: true, tableColumns: first.columns }, meter), 'cache: dezelfde breedtes als zonder cache');
  ok(addCalls > 0 && addCalls < fullCalls / 2, `cache: een kolom erbij meet alleen die kolom (${addCalls} tegen ${fullCalls} metingen)`);
  calls = 0;
  measureTableColumnWidths(rows, { showCompletion: true, tableColumns: moved.columns }, meter, measureCache);
  eq(calls, 0, 'cache: een kolom verplaatsen meet niets opnieuw');
}

// ── 4. Breedte: meten en terugval ─────────────────────────────────────────────────────────────
{
  const meter = (text: string) => text.length * 6;
  const custom: PrintTableColumn = {
    key: 'k1', header: 'Kop', align: 'right',
    cells: new Map(project.tasks.slice(0, 3).map((t, i) => [t.id, 'x'.repeat(5 + i * 5)] as const)),
    fallbackWidth: 50, maxWidth: 90,
  };
  const rows = buildPrintRows(project.tasks, undefined);
  const widths = measureTableColumnWidths(rows, { showCompletion: true, tableColumns: [{ key: 'task.name', builtin: 'name' }, custom] }, meter);
  // Langste tekst 15 tekens × 6 = 90 + 2 × 4 opvulling + 1 = 99 ⇒ begrensd op maxWidth 90.
  eq(widths.k1, 90, 'meten: begrensd op maxWidth');
  const narrow = measureTableColumnWidths(rows, { showCompletion: true, tableColumns: [{ ...custom, cells: new Map([[project.tasks[0].id, 'x']]) }] }, meter);
  eq(narrow.k1, Math.max(AUTO_COLUMN_MIN_WIDTH, 3 * 6 + 2 * 4 + 1), 'meten: de kop telt mee, met ondergrens');
  ok(widths.duration === undefined, 'meten: een kolom buiten de lijst wordt niet gemeten');

  // Zonder meting: de terugvalbreedte van de kolom; zonder eigen terugval de algemene.
  const fallback = record(baseOptions({ tableColumns: [{ key: 'task.name', builtin: 'name' }, custom, { key: 'k2', header: 'B', cells: new Map() }] }));
  const fb = new Map((fallback.result.tableColumnBounds ?? []).map(c => [c.key, c.w] as const));
  const k = (fb.get('k1') ?? 0) / 50;
  ok(k > 0, 'terugval: kolom k1 heeft een breedte');
  ok(Math.abs((fb.get('k2') ?? 0) - CUSTOM_COLUMN_FALLBACK_WIDTH * k) < 0.01, `terugval: zonder eigen breedte de algemene (${CUSTOM_COLUMN_FALLBACK_WIDTH})`);
  // Deterministisch: twee keer renderen geeft dezelfde opdrachten.
  const again = record(baseOptions({ tableColumns: [{ key: 'task.name', builtin: 'name' }, custom, { key: 'k2', header: 'B', cells: new Map() }] }));
  ok(again.log.join('\n') === fallback.log.join('\n'), 'terugval: twee renders geven dezelfde tekenopdrachten');

  // Gemeten breedte gaat via columnWidths door naar de render.
  const measured = record(baseOptions({ tableColumns: [{ key: 'task.name', builtin: 'name' }, custom], columnWidths: { k1: 70 } }));
  const mw = (measured.result.tableColumnBounds ?? []).find(c => c.key === 'k1')?.w ?? 0;
  ok(Math.abs(mw - 70 * k) < 0.01, `render: gemeten breedte 70 wordt gebruikt (kreeg ${mw / k})`);
}

// ── 5. Opslag en lijstbewerkingen ───────────────────────────────────────────────────────────────
{
  eq(DEFAULT_REPORT_SETTINGS.columns, [...REPORT_DEFAULT_COLUMNS], 'standaard: de zes kolommen van vóór #817');
  eq(DEFAULT_REPORT_SETTINGS.sidebar, 'open', 'standaard: zijbalk open');
  eq(DEFAULT_REPORT_SETTINGS.studioStep, 'tasks', 'standaard: eerste bezoek opent stap 1');
  eq(DEFAULT_REPORT_SETTINGS.paperHintSeen, false, 'standaard: aanwijzing bij het papier nog niet gezien');

  localStorage.setItem('ops-reportSettings', JSON.stringify({ showCompletion: false }));
  eq((await loadReportSettings()).columns, REPORT_DEFAULT_COLUMNS.filter(id => id !== 'task.time.completion'),
    'oude instelling zonder lijst, Voltooiing uit ⇒ standaard zonder Voltooiing');
  localStorage.setItem('ops-reportSettings', JSON.stringify({ showCompletion: true }));
  eq((await loadReportSettings()).columns, [...REPORT_DEFAULT_COLUMNS], 'oude instelling zonder lijst, Voltooiing aan ⇒ standaard');
  localStorage.setItem('ops-reportSettings', JSON.stringify({ columns: 'kapot', sidebar: 'zijwaarts', studioStep: 'kelder', paperHintSeen: 'ja' }));
  const junk = await loadReportSettings();
  eq(junk.studioStep, 'tasks', 'rommel in de open stap ⇒ stap 1');
  eq(junk.paperHintSeen, false, 'rommel in de aanwijzing ⇒ niet gezien');
  eq(junk.columns, [...REPORT_DEFAULT_COLUMNS], 'rommel in de lijst ⇒ standaard');
  eq(junk.sidebar, 'open', 'rommel in de zijbalkstand ⇒ open');

  eq(parseReportColumns([]), undefined, 'lege lijst ⇒ terugval');
  eq(parseReportColumns(['task.time.start', 'task.time.start', 7, '', 'a\u0000b']), [REPORT_REQUIRED_COLUMN, 'task.time.start'],
    'parse: dubbele, niet-tekst en stuurtekens weg; taaknaam vooraan erbij');
  eq(parseReportColumns(Array.from({ length: 40 }, (_, i) => `c${i}`))?.length, REPORT_MAX_COLUMNS, 'parse: hoogstens het maximum');
  ok(parseReportColumns(Array.from({ length: 40 }, (_, i) => `c${i}`))?.includes(REPORT_REQUIRED_COLUMN) === true, 'parse: taaknaam blijft ook bij het maximum');

  patchReportSettings({ ...DEFAULT_REPORT_SETTINGS, columns: ['task.name', CAL_DAYS, 'task.wbsCode'], sidebar: 'rail', studioStep: 'page', paperHintSeen: true });
  const saved = await loadReportSettings();
  eq(saved.studioStep, 'page', 'round-trip: laatst gebruikte stap');
  eq(saved.paperHintSeen, true, 'round-trip: aanwijzing gezien');
  eq(saved.columns, ['task.name', CAL_DAYS, 'task.wbsCode'], 'round-trip: kolomlijst met volgorde');
  eq(saved.sidebar, 'rail', 'round-trip: zijbalkstand');
  eq(saved.barColors, { mode: 'critical' }, 'round-trip: standaard balkkleuren');
  patchReportSettings({ ...DEFAULT_REPORT_SETTINGS, barColors: { mode: 'category', field: { src: 'builtin', key: 'taskType' }, colors: { critical: '#112233' } } });
  eq((await loadReportSettings()).barColors, { mode: 'category', field: { src: 'builtin', key: 'taskType' }, colors: { critical: '#112233' } }, 'round-trip: eigen balkkleuren');
  localStorage.setItem('ops-reportSettings', JSON.stringify({ barColors: { mode: 'regenboog' } }));
  eq((await loadReportSettings()).barColors, { mode: 'critical' }, 'onbekende balkkleur ⇒ de standaard (kritiek pad)');

  // Eén schrijfroute (review Terra #893, ronde 1): een patch leest de opgeslagen stand op het moment van
  // schrijven. Een wijziging van elders (ander venster, host) die tussen het laden en de patch viel, blijft.
  patchReportSettings({ ...DEFAULT_REPORT_SETTINGS });
  const stale = await loadReportSettings();
  localStorage.setItem('ops-reportSettings', JSON.stringify({ ...stale, columns: ['task.name', CAL_DAYS] }));
  patchReportSettings(chosenReportChange(stale, { paperSize: 'A4' }));
  const merged = await loadReportSettings();
  eq(merged.paperSize, 'A4', 'patch: het eigen veld staat erin');
  eq(merged.columns, ['task.name', CAL_DAYS], 'patch: de kolommen van elders blijven staan');
  // Een keuze schrijft elk gekozen veld, ook als de kopie het al had (review Terra #893, ronde 3): de opslag kan
  // van elders anders zijn, en de velden van één keuze horen bij elkaar.
  eq(chosenReportChange(stale, { layoutId: stale.layoutId, followView: true }), { layoutId: stale.layoutId, followView: true },
    'keuze: ook een veld dat de kopie al had');
  // De optiegroepen per optie (review Terra #893, ronde 2): een tabeloptie of resourceoptie van elders blijft staan.
  const fresh = await loadReportSettings();
  localStorage.setItem('ops-reportSettings', JSON.stringify({
    ...fresh,
    tableReports: { ...fresh.tableReports, nearCriticalDays: 11 },
    resourceGantt: { ...fresh.resourceGantt, groupByType: !fresh.resourceGantt.groupByType },
  }));
  const tableChange = chosenReportChange(fresh, { tableReports: { ...fresh.tableReports, wbsSummaryLevel: 3 } });
  eq(tableChange, { tableReports: { wbsSummaryLevel: 3 } }, 'diff: alleen de gewijzigde tabeloptie');
  patchReportSettings(tableChange);
  patchReportSettings(chosenReportChange(fresh, { resourceGantt: { ...fresh.resourceGantt, includeUnassigned: !fresh.resourceGantt.includeUnassigned } }));
  const groups = await loadReportSettings();
  eq([groups.tableReports.nearCriticalDays, groups.tableReports.wbsSummaryLevel], [11, 3], 'patch: tabeloptie van elders blijft, de eigen staat erin');
  eq([groups.resourceGantt.groupByType, groups.resourceGantt.includeUnassigned], [!fresh.resourceGantt.groupByType, !fresh.resourceGantt.includeUnassigned],
    'patch: resourceoptie van elders blijft, de eigen staat erin');
  // Een wijziging die van de opslag afhangt, krijgt de actuele opslag.
  localStorage.setItem('ops-reportSettings', JSON.stringify({ ...groups, layoutId: 'elders' }));
  patchReportSettings(stored => ({ reportType: 'lookAhead', ...(stored.layoutId === 'elders' ? { paperHintSeen: true } : {}) }));
  eq([(await loadReportSettings()).layoutId, (await loadReportSettings()).paperHintSeen], ['elders', true], 'patch als functie: leest de actuele opslag');

  localStorage.setItem('ops-reportSettings', JSON.stringify({ studioStep: 'export', customZoom: 0.2034567 }));
  const older = await loadReportSettings();
  eq(older.studioStep, 'tasks', 'vervallen stap Opslaan (PDF) ⇒ stap 1');
  eq(older.customZoom, 0.2034567, 'breedte per dag onder 1 px blijft precies bewaard (geen afronding)');
  localStorage.setItem('ops-reportSettings', JSON.stringify({ customZoom: 0.000_01 }));
  eq((await loadReportSettings()).customZoom, REPORT_MIN_DAY_WIDTH, 'te kleine breedte per dag ⇒ de kleinste');
  localStorage.setItem('ops-reportSettings', JSON.stringify({ customZoom: 400 }));
  eq((await loadReportSettings()).customZoom, REPORT_MAX_ZOOM, 'te grote breedte per dag ⇒ de grootste');

  const base = [...REPORT_DEFAULT_COLUMNS];
  eq(addReportColumn(base, CAL_DAYS), [...base, CAL_DAYS], 'toevoegen: achteraan');
  eq(addReportColumn(base, 'task.name'), base, 'toevoegen: geen dubbele');
  eq(removeReportColumn(base, 'task.name'), base, 'weghalen: de taaknaam blijft');
  eq(removeReportColumn(base, 'task.wbsCode')[0], 'task.name', 'weghalen: WBS weg');
  eq(moveReportColumn(base, 'task.name', -1).slice(0, 2), ['task.name', 'task.wbsCode'], 'verplaatsen: een plek omhoog');
  eq(moveReportColumn(base, 'task.wbsCode', -1), base, 'verplaatsen: bovenaan blijft bovenaan');
  eq(placeReportColumn(base, 'task.time.completion', 0)[0], 'task.time.completion', 'slepen: naar de eerste plek');
  ok(isDefaultReportColumns(base) && !isDefaultReportColumns([...base].reverse()), 'standaardherkenning');
  eq(reportColumnsFromGrid(['task.time.start', 'onbekend', CAL_DAYS], new Set([CAL_DAYS])),
    [REPORT_REQUIRED_COLUMN, 'task.time.start', CAL_DAYS], 'zoals de tabel: alleen bestaande kolommen, taaknaam vooraan erbij');
}

if (failures > 0) {
  console.log(`XX report-columns: ${failures} afwijking(en)`);
  process.exit(1);
}
console.log('OK report-columns: kolomlijst van de afdruk (volgorde, celtekst, breedte, opslag)');
