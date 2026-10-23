// De headless kern (`src/core/`, pakket `@openaec/open-planner-core`) rekent precies zoals de app.
//
// 1. Voor ELK voorbeeldbestand (examples/ en public/examples/) geeft `openIfc → schedule()` per taak
//    dezelfde vroege/late datums, totale speling en kritiek-vlag als de app-store langs de route
//    van verify:examples (`loadState` → `runCPM`), en dezelfde projecteinddatum en -duur.
// 2. `toIfc()` → opnieuw openen → `schedule()` geeft dezelfde datums (de kern verliest niets dat de
//    berekening nodig heeft).
// 3. Documenten zijn los: twee tegelijk open documenten beïnvloeden elkaar niet.
// 4. Het foutmodel: één fouttype met een vaste `code` (INVALID_INPUT, IFC_READ_FAILED, NO_TASKS, SCHEDULE_FAILED),
//    met de taakidentiteiten bij een onberekenbare planningskring.
// 4g. Een IFC met 6.000 WBS-niveaus opent, rekent en bewaart zijn volledige structuur.
// 5. Een weggelaten XER-bronarchief komt als waarschuwing XER_ARCHIVE_DROPPED in de samenvatting.
// 6. Het openen-contract: `toIfc()` vóór `schedule()` geeft de stand van de app na Bestand → Openen.
//
// Het gebouwde pakket zelf (bundel, install, consumeervoorbeeld) toetst `npm run verify:core-package`.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openIfc, PlannerCoreError, type ScheduleSummary } from '@/core';
import { createAppStoreContext } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { taskDepths } from '@/utils/wbs';
import type { Task } from '@/types/task';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const diffs: string[] = [];
let checks = 0;
function ok(label: string, condition: boolean, detail = ''): void {
  checks++;
  if (!condition) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
}

const files = [
  ...readdirSync(join(root, 'examples')).filter(f => f.endsWith('.ifc')).map(f => join(root, 'examples', f)),
  ...readdirSync(join(root, 'public/examples')).filter(f => f.endsWith('.ifc')).map(f => join(root, 'public/examples', f)),
];
ok('0 er zijn voorbeeldbestanden', files.length >= 20, `${files.length}`);

type Dates = Record<string, string>;
function datesOf(s: ScheduleSummary): Dates {
  return Object.fromEntries(s.tasks.map(t => [t.id,
    `${t.start}|${t.finish}|${t.lateStart}|${t.lateFinish}|${t.totalFloat}|${t.critical}`]));
}
function firstDiff(a: Dates, b: Dates): string {
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[id] !== b[id]) return `${id}: kern ${a[id] ?? '—'} ≠ app ${b[id] ?? '—'}`;
  }
  return '';
}

for (const file of files) {
  const name = file.slice(root.length + 1);
  const text = readFileSync(file, 'utf8');

  // De app-route: een eigen storecontext, laden zoals verify:examples, dan F5.
  const ctx = createAppStoreContext({ emitHostEvents: false });
  ctx.store.getState().loadState(readIFC(text));
  ctx.store.getState().runCPM();
  const app = ctx.store.getState();
  const appDates: Dates = Object.fromEntries(app.tasks.map(t => [t.id,
    `${t.time.earlyStart}|${t.time.earlyFinish}|${t.time.lateStart}|${t.time.lateFinish}|${t.time.totalFloat}|${t.time.isCritical}`]));

  const doc = await openIfc(text);
  const summary = doc.schedule();
  const coreDates = datesOf(summary);
  const diff = firstDiff(coreDates, appDates);
  ok(`1 ${name}: kern = app voor elke taak`, diff === '', diff);
  ok(`1a ${name}: projecteinde gelijk`, summary.project.finish === app.cpmResult?.projectEnd,
    `${summary.project.finish} ≠ ${app.cpmResult?.projectEnd}`);
  ok(`1b ${name}: projectduur gelijk`, summary.project.durationWorkdays === app.cpmResult?.projectDuration);
  ok(`1c ${name}: tellingen kloppen`,
    summary.counts.tasks === app.tasks.length && summary.counts.relations === app.sequences.length
      && summary.counts.resources === app.resources.length && summary.counts.assignments === app.assignments.length);
  ok(`1d ${name}: kritiek pad gelijk`,
    JSON.stringify(summary.criticalPath) === JSON.stringify(app.cpmResult?.criticalPath));
  ok(`1e ${name}: samenvatting is gewone JSON`,
    JSON.stringify(JSON.parse(JSON.stringify(summary))) === JSON.stringify(summary));

  // 2. Terugschrijven en opnieuw openen geeft dezelfde berekening.
  const again = (await openIfc(doc.toIfc())).schedule();
  const roundDiff = firstDiff(datesOf(again), coreDates);
  ok(`2 ${name}: toIfc → openIfc → schedule geeft dezelfde datums`, roundDiff === '', roundDiff);
}

// 3. Twee documenten tegelijk: los van elkaar.
{
  const a = await openIfc(readFileSync(files[0], 'utf8'));
  const b = await openIfc(readFileSync(files[1], 'utf8'));
  const first = JSON.stringify(a.schedule());
  b.schedule();
  ok('3 een tweede document verandert het eerste niet', JSON.stringify(a.schedule()) === first);
}

// 4. Foutmodel.
async function codeOf(fn: () => Promise<unknown> | unknown): Promise<string> {
  try {
    await fn();
    return 'geen fout';
  } catch (err) {
    return err instanceof PlannerCoreError ? err.code : `ander fouttype: ${String(err)}`;
  }
}
ok('4a lege tekst ⇒ INVALID_INPUT', await codeOf(() => openIfc('')) === 'INVALID_INPUT');
ok('4b geen STEP ⇒ INVALID_INPUT', await codeOf(() => openIfc('{"tasks": []}')) === 'INVALID_INPUT');
ok('4c geen tekst ⇒ INVALID_INPUT', await codeOf(() => openIfc(42 as unknown as string)) === 'INVALID_INPUT');
ok('4c2 afgekapt STEP ⇒ IFC_READ_FAILED', await codeOf(() => openIfc('ISO-10303-21;\nHEADER;')) === 'IFC_READ_FAILED');
{
  const empty = createAppStoreContext({ emitHostEvents: false }).store.getState();
  const emptyIfc = writeIFC(buildWriteIFCInput(empty));
  ok('4d IFC zonder taken ⇒ NO_TASKS', await codeOf(() => openIfc(emptyIfc)) === 'NO_TASKS');
}
{
  // Een kring: twee bladtaken die elkaar opvolgen. De app weigert zo'n relatie bij invoer
  // (`addSequence`), maar een bestand van elders kan hem bevatten; daarom direct in de writer-invoer.
  const ctx = createAppStoreContext({ emitHostEvents: false });
  ctx.store.getState().loadState(readIFC(readFileSync(files[0], 'utf8')));
  const leaves = ctx.store.getState().tasks.filter(t => !t.isSummary && t.childIds.length === 0);
  const [x, y] = [leaves[0].id, leaves[1].id];
  const input = buildWriteIFCInput(ctx.store.getState());
  const base = { type: 'FINISH_START' as const, lagDays: 0 };
  input.sequences = [
    ...input.sequences,
    { ...base, id: 'seq-kring-1', predecessorId: x, successorId: y },
    { ...base, id: 'seq-kring-2', predecessorId: y, successorId: x },
  ];
  const cyclic = await openIfc(writeIFC(input));
  let err: unknown;
  try { cyclic.schedule(); } catch (e) { err = e; }
  ok('4e kring ⇒ SCHEDULE_FAILED', err instanceof PlannerCoreError && err.code === 'SCHEDULE_FAILED', String(err));
  const ids = err instanceof PlannerCoreError ? (err.details.taskIds as string[] | undefined) : undefined;
  ok('4f de fout noemt de taken van de kring', !!ids && ids.includes(x) && ids.includes(y), JSON.stringify(ids));
}

{
  // 4g. De bestaande 6.000-niveaus-repro moet slagen. Zelfstandige fixture: geen toevallige
  // constraints, hammocks of bronvelden uit een voorbeeldblad; vrije WBS-tekst en GEEN auto-vlag.
  const ctx = createAppStoreContext({ emitHostEvents: false });
  const st = ctx.store.getState();
  const N = 6000;
  const tasks: Task[] = Array.from({ length: N }, (_, i) => ({
    id: `nest-${i}`, name: `Nest ${i}`, description: '', wbsCode: `vrij-${i}`,
    taskType: 'CONSTRUCTION', status: 'NOT_STARTED', priority: 500, isMilestone: false,
    parentId: i ? `nest-${i - 1}` : null,
    childIds: i < N - 1 ? [`nest-${i + 1}`] : [],
    isSummary: i < N - 1 ? true : undefined,
    time: i === N - 1 ? createDefaultTaskTime('2026-03-18', 4) : createDefaultTaskTime('2026-03-02', 5), resourceIds: [],
  }));
  const deep = writeIFC({
    project: { ...st.project, id: 'diepe-wbs', startDate: '2026-03-02', wbsAutoNumber: undefined },
    calendar: { ...st.calendar, workDays: [1, 2, 3, 4, 5], holidays: [], generation: undefined }, tasks, sequences: [], resources: [], assignments: [],
  });
  const parsed = readIFC(deep);
  const shape = (ts: readonly Task[]) => JSON.stringify(ts.map(t =>
    [t.id, t.name, t.parentId, t.childIds, t.wbsCode, t.isSummary === true, t.isMilestone]));
  const expectedShape = shape(tasks);
  const sourceGuids = parsed.ifcGlobalIds ?? {};
  // Onafhankelijk orakel: vier werkdagen = wo 18, do 19, vr 20 en ma 23 maart.
  // Alle 5.999 fasen beginnen in het bestand met een ándere span (2–6 maart, vijf dagen).
  // Dus een ontbrekende of voortijdig afgebroken rollup kan niet toevallig slagen.
  const expectedStart = '2026-03-18';
  const expectedFinish = '2026-03-23';
  // D1/D2: de laadgrens geeft momenten; een afleidbare IFC-kalender schrijft ankerdatums.
  const expectedStartInstant = `${expectedStart}T07:00`;
  const expectedFinishInstant = `${expectedFinish}T16:00`;
  const startMatches = (value: string) => value === expectedStart || value === expectedStartInstant;
  const finishMatches = (value: string) => value === expectedFinish || value === expectedFinishInstant;
  const expectedDuration = 4;
  const hasExpectedSpan = (ts: readonly Task[]) => ts.length === N && ts.every(t =>
    startMatches(t.time.earlyStart) && finishMatches(t.time.earlyFinish)
      && startMatches(t.time.lateStart) && finishMatches(t.time.lateFinish)
      && t.time.scheduleDuration === expectedDuration && t.time.totalFloat === 0 && t.time.freeFloat === 0);
  ok('4g fixture: alle fasen hebben de oude span; alleen het diepste blad heeft de nieuwe span',
    parsed.tasks.slice(0, -1).every(t => t.time.earlyStart === '2026-03-02'
      && t.time.earlyFinish === '2026-03-06' && t.time.scheduleDuration === 5)
      && parsed.tasks[N - 1].time.scheduleStart === expectedStart
      && parsed.tasks[N - 1].time.scheduleFinish === expectedFinish
      && parsed.tasks[N - 1].time.scheduleDuration === expectedDuration);
  ok('4g repro: lezer bewaart alle 6.000 identiteiten, vrije codes en fasen zonder auto-vlag',
    parsed.project.wbsAutoNumber === undefined && shape(parsed.tasks) === expectedShape);
  const doc = await openIfc(deep);
  const opened = readIFC(doc.toIfc());
  ok('4g openen + opslaan vóór schedule bewaart de volledige WBS', shape(opened.tasks) === expectedShape);
  ok('4g openen rolt de letterlijke bladspan en vier dagen duur op naar alle fasen', hasExpectedSpan(opened.tasks));
  ok('4g vrije codes activeren geen automatische hernummering', opened.project.wbsAutoNumber === undefined);
  ok('4g de diepste taak heeft werkelijk niveau 6.000', taskDepths(opened.tasks).get(`nest-${N - 1}`) === N);
  const summary = doc.schedule();
  ok('4g alle 6.000 taken staan met de juiste fase-identiteit in de publieke samenvatting',
    summary.counts.tasks === N && summary.tasks.length === N
      && summary.tasks.every((t, i) => t.id === tasks[i].id && t.parentId === tasks[i].parentId
        && t.wbs === tasks[i].wbsCode && t.summary === (i < N - 1)));
  ok('4g expliciete berekening geeft alle fasen en het blad de onafhankelijk vastgelegde datums',
    summary.tasks.every(t => t.start === expectedStartInstant && t.finish === expectedFinishInstant
      && t.lateStart === expectedStartInstant && t.lateFinish === expectedFinishInstant && t.totalFloat === 0));
  const last = summary.tasks[N - 1];
  ok('4g ook de buitenste fasen krijgen de berekende bladspan, geen gedeeltelijke rollup',
    summary.tasks.every(t => t.start === last.start && t.finish === last.finish
      && t.lateStart === last.lateStart && t.lateFinish === last.lateFinish && t.totalFloat === last.totalFloat));
  const saved = readIFC(doc.toIfc());
  ok('4g opslaan na schedule bewaart de volledige WBS', shape(saved.tasks) === expectedShape);
  ok('4g save na berekenen bewaart de verwachte span en duur op alle niveaus', hasExpectedSpan(saved.tasks));
  ok('4g alle oorspronkelijke taak-GlobalIds blijven bewaard', tasks.every(t =>
    !!sourceGuids[`task:${t.id}`] && saved.ifcGlobalIds?.[`task:${t.id}`] === sourceGuids[`task:${t.id}`]));

  // Dezelfde save opnieuw via de app-route, met een expliciete false-vlag en ingeklapte wortel.
  // Verborgen afstammelingen mogen niet via het wees-vangnet alsnog als losse rijen verschijnen.
  saved.project.wbsAutoNumber = false;
  ctx.store.setState(s => { s.ui.collapsedTaskIds = ['nest-0']; });
  st.openAsDocument(saved, { name: 'diep.ifc', ref: null, saveTarget: false });
  const deepId = ctx.store.getState().activeDocumentId;
  ok('4g heropenen in de app behoudt de verwachte span en duur op alle niveaus', hasExpectedSpan(ctx.store.getState().tasks));
  ok('4g ingeklapte diepe WBS toont uitsluitend de wortel',
    ctx.store.getState().viewRows.length === 1 && ctx.store.getState().viewRows[0].rowKey === 'nest-0');
  ctx.store.getState().toggleCollapse('nest-0');
  const rows = ctx.store.getState().viewRows;
  ok('4g uitklappen toont alle rijen met hun echte diepte en stabiele sleutel', rows.length === N
    && rows.every((row, i) => row.kind === 'task' && row.rowKey === tasks[i].id && row.depth === i));
  ok('4g heropenen is schoon, zonder undo-stap en met expliciete false-vlag',
    !ctx.store.getState().isDirty && ctx.store.getState().historyEvents.length === 0
      && ctx.store.getState().project.wbsAutoNumber === false);
  const appDates = JSON.stringify(ctx.store.getState().tasks.map(t => [t.id, t.time.earlyStart, t.time.earlyFinish]));
  ok('4g heropenen rekent dezelfde datums als de headless kern', appDates
    === JSON.stringify(summary.tasks.map(t => [t.id, t.start, t.finish])));
  ctx.store.getState().newDocument();
  ctx.store.getState().switchDocument(deepId);
  const switched = ctx.store.getState();
  ok('4g documentwissel behoudt de verwachte span en duur op alle niveaus', hasExpectedSpan(switched.tasks));
  ok('4g documentwissel bewaart WBS, false-vlag en alle zichtbare rijen',
    shape(switched.tasks) === expectedShape && switched.project.wbsAutoNumber === false && switched.viewRows.length === N);
  const appSaved = readIFC(writeIFC(buildWriteIFCInput(switched)));
  ok('4g laatste IFC-roundtrip bewaart de verwachte span en duur op alle niveaus', hasExpectedSpan(appSaved.tasks));
  ok('4g save na heropenen en documentwissel bewaart structuur en GlobalIds', shape(appSaved.tasks) === expectedShape
    && tasks.every(t => appSaved.ifcGlobalIds?.[`task:${t.id}`] === sourceGuids[`task:${t.id}`]));
}

{
  // 5. Fixture met een onbruikbaar XER-bronarchief (bytes ontbreken).
  const text = readFileSync(join(root, 'tests/planning/fixtures/xer-archief-herschreven.ifc'), 'utf8');
  const issue = readIFC(text).xerArchiveIssue;
  ok('5 de fixture heeft een archiefprobleem', !!issue, JSON.stringify(issue));
  const w = (await openIfc(text)).schedule().warnings.find(x => x.code === 'XER_ARCHIVE_DROPPED');
  ok('5a de samenvatting meldt XER_ARCHIVE_DROPPED met de reden', !!w && w.detail === issue?.code && w.ids.length === 0, JSON.stringify(w));
  const clean = (await openIfc(readFileSync(files[0], 'utf8'))).schedule().warnings;
  ok('5b een gewoon bestand heeft die waarschuwing niet', !clean.some(x => x.code === 'XER_ARCHIVE_DROPPED'));
}

{
  // 6. Een bestand waarvan de opgeslagen datums niet kloppen met de berekening.
  const ctx = createAppStoreContext({ emitHostEvents: false });
  ctx.store.getState().loadState(readIFC(readFileSync(files[0], 'utf8')));
  ctx.store.getState().runCPM();
  const target = ctx.store.getState().tasks.find(t => t.childIds.length === 0 && !t.isSummary && !t.isMilestone)!;
  ctx.store.setState(d => {
    const t = d.tasks.find(x => x.id === target.id)!;
    t.time.earlyStart = '2030-01-07';
    t.time.earlyFinish = '2030-01-11';
  });
  const stale = writeIFC(buildWriteIFCInput(ctx.store.getState()));
  const datesIn = (ifc: string) => JSON.stringify(readIFC(ifc).tasks.map(t => [t.id, t.time.earlyStart, t.time.earlyFinish]));

  const app = createAppStoreContext({ emitHostEvents: false });
  app.store.getState().openAsDocument(await readIFCWithXerReconstruction(stale), { name: 'document.ifc', ref: null, saveTarget: false });
  const appAfterOpen = datesIn(writeIFC(buildWriteIFCInput(app.store.getState())));

  const doc = await openIfc(stale);
  ok('6 toIfc() vóór schedule() = de app na Bestand → Openen', datesIn(doc.toIfc()) === appAfterOpen);
  const s = doc.schedule();
  const fresh = s.tasks.find(t => t.id === target.id);
  ok('6a schedule() rekent de afwijkende datum terug', fresh?.start === target.time.earlyStart, `${fresh?.start} ≠ ${target.time.earlyStart}`);
  ok('6b toIfc() na schedule() bevat de berekende datum',
    readIFC(doc.toIfc()).tasks.find(t => t.id === target.id)?.time.earlyStart === target.time.earlyStart);
}

if (diffs.length === 0) {
  console.log(`OK: headless kern — ${checks} checks groen (${files.length} voorbeeldbestanden)`);
} else {
  console.log(`XX headless kern — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`  - ${d}`);
  process.exit(1);
}
