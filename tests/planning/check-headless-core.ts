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
// 7. Een oud bestand (B5) meldt zijn omzetting direct na het openen in `openWarnings`, en in elke
//    samenvatting; een nieuw bestand meldt niets.
//
// Het gebouwde pakket zelf (bundel, install, consumeervoorbeeld) toetst `npm run verify:core-package`.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openIfc, openIfcBytes, PlannerCoreError, type ScheduleSummary } from '@/core';
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

const utf8 = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const encoded = (text: string): Uint8Array => new TextEncoder().encode(text);
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
async function atOneWriteTime<T>(write: () => T | Promise<T>): Promise<T> {
  const RealDate = Date;
  const writeTime = RealDate.parse('2026-11-23T12:00:00Z');
  class WriteTimeDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(writeTime); else super(...(args as [number]));
    }
    static now(): number { return writeTime; }
  }
  globalThis.Date = WriteTimeDate as unknown as DateConstructor;
  try { return await write(); } finally { globalThis.Date = RealDate; }
}
function firstLineDiff(a: string, b: string): string {
  const [left, right] = [a.split('\n'), b.split('\n')];
  const at = left.findIndex((line, i) => line !== right[i]);
  return at < 0 ? (left.length === right.length ? '' : `lengte ${left.length} ≠ ${right.length}`) : `regel ${at + 1}: ${left[at]} ≠ ${right[at]}`;
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

  const bytesDoc = await openIfcBytes(new Uint8Array(readFileSync(file)));
  const bytesSummary = bytesDoc.schedule();
  ok(`9 ${name}: openIfcBytes geeft dezelfde samenvatting als openIfc`,
    JSON.stringify(bytesSummary) === JSON.stringify(summary), firstDiff(datesOf(bytesSummary), coreDates));
  ok(`9a ${name}: zonder vreemd deel is foreignContent null op beide routes`,
    bytesSummary.foreignContent === null && summary.foreignContent === null, JSON.stringify(bytesSummary.foreignContent));
  const textIfc = await atOneWriteTime(() => doc.toIfc());
  const bytesIfc = utf8(await atOneWriteTime(() => bytesDoc.toIfcBytes()));
  ok(`9b ${name}: toIfcBytes() schrijft dezelfde IFC als toIfc() van de tekstroute`, bytesIfc === textIfc, firstLineDiff(bytesIfc, textIfc));
  const bytesDocText = await atOneWriteTime(() => bytesDoc.toIfc());
  ok(`9c ${name}: toIfc() van een bytesdocument zonder vreemd deel = toIfc() van de tekstroute`,
    bytesDocText === textIfc, firstLineDiff(bytesDocText, textIfc));
  const textDocBytes = utf8(await atOneWriteTime(() => doc.toIfcBytes()));
  ok(`9d ${name}: toIfcBytes() van een tekstdocument = de UTF-8 van toIfc()`,
    textDocBytes === textIfc, firstLineDiff(textDocBytes, textIfc));
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
  const emptyIfc = writeIFC(buildWriteIFCInput(empty, 'planOnly'));
  ok('4d IFC zonder taken ⇒ NO_TASKS', await codeOf(() => openIfc(emptyIfc)) === 'NO_TASKS');
}
{
  // Een kring: twee bladtaken die elkaar opvolgen. De app weigert zo'n relatie bij invoer
  // (`addSequence`), maar een bestand van elders kan hem bevatten; daarom direct in de writer-invoer.
  const ctx = createAppStoreContext({ emitHostEvents: false });
  ctx.store.getState().loadState(readIFC(readFileSync(files[0], 'utf8')));
  const leaves = ctx.store.getState().tasks.filter(t => !t.isSummary && t.childIds.length === 0);
  const [x, y] = [leaves[0].id, leaves[1].id];
  const input = buildWriteIFCInput(ctx.store.getState(), 'planOnly');
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
  const appSaved = readIFC(writeIFC(buildWriteIFCInput(switched, 'planOnly')));
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
  const stale = writeIFC(buildWriteIFCInput(ctx.store.getState(), 'planOnly'));
  const datesIn = (ifc: string) => JSON.stringify(readIFC(ifc).tasks.map(t => [t.id, t.time.earlyStart, t.time.earlyFinish]));

  const app = createAppStoreContext({ emitHostEvents: false });
  app.store.getState().openAsDocument(await readIFCWithXerReconstruction(stale), { name: 'document.ifc', ref: null, saveTarget: false });
  const appAfterOpen = datesIn(writeIFC(buildWriteIFCInput(app.store.getState(), 'planOnly')));

  const doc = await openIfc(stale);
  ok('6 toIfc() vóór schedule() = de app na Bestand → Openen', datesIn(doc.toIfc()) === appAfterOpen);
  const s = doc.schedule();
  const fresh = s.tasks.find(t => t.id === target.id);
  ok('6a schedule() rekent de afwijkende datum terug', fresh?.start === target.time.earlyStart, `${fresh?.start} ≠ ${target.time.earlyStart}`);
  ok('6b toIfc() na schedule() bevat de berekende datum',
    readIFC(doc.toIfc()).tasks.find(t => t.id === target.id)?.time.earlyStart === target.time.earlyStart);
}

{
  // 7. B5 (aanval na #600, a10): een oud bestand zonder `TimeModel`, geschreven met de bron van
  //    `fbd4a3f9d`. Eén taak van 5 werkdagen, 32% gereed, werkelijke start 1 juni 07:00, statusdatum
  //    3 juni; kalender ma–vr 07–12 en 13–16; einde in het bestand vr 5 juni 16:00. Het openen rekent
  //    om (ma 8 juni 10:12). De kern meldt dat direct na het openen, vóór de eerste `toIfc()`; eerder
  //    schreef `openIfc(...).toIfc()` de nieuwe datum zonder enig signaal.
  const text = readFileSync(join(root, 'tests/planning/fixtures/b5-lopend-oude-writer.ifc'), 'utf8');
  const source = readIFC(text);
  ok('7 de fixture is een oud bestand', source.timeModel === undefined);
  const taskId = source.tasks[0].id;
  const doc = await openIfc(text);
  const opened = doc.openWarnings;
  ok('7a openWarnings meldt de omzetting met taak en grootste verschuiving, vóór toIfc()',
    JSON.stringify(opened) === JSON.stringify([{ code: 'MINUTE_MODEL_CONVERTED', ids: [taskId], maxShiftWorkdays: 0.4 }]),
    JSON.stringify(opened));
  opened[0]?.ids.push('gemuteerd');
  ok('7b openWarnings geeft een kopie', doc.openWarnings[0]?.ids.length === 1, JSON.stringify(doc.openWarnings));
  const written = readIFC(doc.toIfc());
  ok('7c toIfc() schrijft de omgerekende datum met de markering',
    written.tasks[0].time.earlyFinish === '2026-06-08T10:12' && written.timeModel === 'MINUTES-1',
    `${written.tasks[0].time.earlyFinish} ${written.timeModel}`);
  const w = doc.schedule().warnings.filter(x => x.code === 'MINUTE_MODEL_CONVERTED');
  ok('7d de samenvatting van schedule() houdt de waarschuwing',
    w.length === 1 && w[0].maxShiftWorkdays === 0.4 && JSON.stringify(w[0].ids) === JSON.stringify([taskId]),
    JSON.stringify(w));
  const modern = await openIfc(doc.toIfc());
  ok('7e een nieuw bestand (met TimeModel) meldt niets', modern.openWarnings.length === 0
    && !modern.schedule().warnings.some(x => x.code === 'MINUTE_MODEL_CONVERTED'), JSON.stringify(modern.openWarnings));
  const example = await openIfc(readFileSync(files[0], 'utf8'));
  ok('7f een voorbeeldbestand meldt niets bij het openen', example.openWarnings.length === 0, JSON.stringify(example.openWarnings));
}

// T3: tekst-API zonder bytesbehoud mag vreemde psets niet stil uit de uitvoer laten verdwijnen.
{
  const own = readFileSync(files[0], 'utf8');
  const foreign = own.replace('ENDSEC;\nEND-ISO-10303-21;',
    "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('behouden'),$);\n" +
    "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\nENDSEC;\nEND-ISO-10303-21;");
  ok('8 fixture heeft een externe pset zonder model', foreign !== own && !foreign.includes('IFCWALL('));
  const doc = await openIfc(foreign);
  ok('8 kern kan de planning samenvatten', doc.schedule().counts.tasks > 0);
  let error: unknown;
  try { doc.toIfc(); } catch (e) { error = e; }
  ok('8 toIfc weigert met de bestaande vaste code vóór uitvoer',
    error instanceof PlannerCoreError && error.code === 'IFC_WRITE_FAILED', String(error));
  ok('8a de tekstroute bewaart geen vreemd deel: foreignContent is null', doc.schedule().foreignContent === null);
  const bytesDoc = await openIfcBytes(encoded(foreign));
  const kept = bytesDoc.schedule().foreignContent;
  ok('8b de bytesroute meldt de externe pset als bewaard vreemd deel',
    JSON.stringify(kept) === JSON.stringify({ format: 'ifc', schema: 'IFC4X3_ADD2', objectCount: 2 }), JSON.stringify(kept));
  ok('8c toIfcBytes() schrijft de externe pset byte-gelijk terug', sameBytes(await bytesDoc.toIfcBytes(), encoded(foreign)));
  let bytesError: unknown;
  try { bytesDoc.toIfc(); } catch (e) { bytesError = e; }
  ok('8d toIfc() van een bytesdocument met een vreemd deel weigert met reason foreign',
    bytesError instanceof PlannerCoreError && bytesError.code === 'IFC_WRITE_FAILED' && bytesError.details.reason === 'foreign',
    String(bytesError));
}

// De blokkade op de historische eigen kop (1132) is weg, ook voor echte kernuitvoer.
for (const name of ['ohara', 'data']) {
  const text = readFileSync(join(root, `tests/planning/fixtures/oude-tags/v2026.7.12-${name}-showcase-verbouwing-eengezinswoning.ifc`), 'utf8');
  const doc = await openIfc(text);
  const written = doc.toIfc();
  ok(`8 ${name}: oude eigen planning schrijft en heropent met alle twintig taken`,
    doc.schedule().counts.tasks === 20 && (await openIfc(written)).schedule().counts.tasks === 20);
}

const foreignFixture = (name: string): string => join(root, 'tests/fixtures/ifc-foreign', name);
{
  const modelFile = foreignFixture('eigen-plus-model.ifc');
  const source = new Uint8Array(readFileSync(modelFile));
  ok('10 de tekstroute weigert het gebouwmodel, zoals main',
    await codeOf(() => openIfc(readFileSync(modelFile, 'utf8'))) === 'IFC_READ_FAILED');
  const input = new Uint8Array(source);
  const doc = await openIfcBytes(input);
  input.fill(0x20);
  const beforeSchedule = await doc.toIfcBytes();
  ok('10a toIfcBytes() vóór schedule() geeft het modelbestand byte-gelijk terug, ook na wijzigen van de invoerbuffer',
    sameBytes(beforeSchedule, source), `${beforeSchedule.length} ≠ ${source.length}`);
  beforeSchedule.fill(0x20);
  const summary = doc.schedule();
  ok('10b foreignContent beschrijft het bewaarde gebouwmodel',
    JSON.stringify(summary.foreignContent) === JSON.stringify({ format: 'ifc', schema: 'IFC4X3_ADD2', objectCount: 90 }),
    JSON.stringify(summary.foreignContent));
  ok('10c de planning naast het model is doorgerekend', summary.counts.tasks === 20, String(summary.counts.tasks));
  const afterSchedule = await doc.toIfcBytes();
  ok('10d toIfcBytes() na schedule() geeft het modelbestand byte-gelijk terug, ook na wijzigen van eerdere uitvoer',
    sameBytes(afterSchedule, source));
  ok('10e elke aanroep geeft een eigen buffer', (await doc.toIfcBytes()).buffer !== afterSchedule.buffer);
  let error: unknown;
  try { doc.toIfc(); } catch (e) { error = e; }
  ok('10f toIfc() weigert het gebouwmodel als tekst te schrijven, met reason foreign',
    error instanceof PlannerCoreError && error.code === 'IFC_WRITE_FAILED' && error.details.reason === 'foreign', String(error));

  const app = createAppStoreContext({ emitHostEvents: false });
  app.store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await app.store.getState().openOpenedFile({ name: 'eigen-plus-model.ifc', content: '', bytes: new Uint8Array(source), ref: null });
  ok('10g de app met de flag aan opent hetzelfde vreemde deel', app.store.getState().ifcSource?.foreignObjectCount === 90);
  app.store.getState().runCPM();
  const appDates: Dates = Object.fromEntries(app.store.getState().tasks.map(t => [t.id,
    `${t.time.earlyStart}|${t.time.earlyFinish}|${t.time.lateStart}|${t.time.lateFinish}|${t.time.totalFloat}|${t.time.isCritical}`]));
  const diff = firstDiff(datesOf(summary), appDates);
  ok('10h kern = app met de flag aan voor elke taak naast het model', diff === '' && Object.keys(appDates).length === 20, diff);
}

{
  const source = new Uint8Array(readFileSync(foreignFixture('latin1.ifc')));
  let validUtf8 = true;
  try { utf8(source); } catch { validUtf8 = false; }
  ok('11 de fixture is geen geldige UTF-8', !validUtf8);
  const doc = await openIfcBytes(source);
  doc.schedule();
  ok('11a een rauw Latin-1-byte in een model van een ander programma komt byte-gelijk terug',
    sameBytes(await doc.toIfcBytes(), source));
}

{
  ok('12 lege bytes ⇒ INVALID_INPUT', await codeOf(() => openIfcBytes(new Uint8Array())) === 'INVALID_INPUT');
  ok('12a geen Uint8Array ⇒ INVALID_INPUT',
    await codeOf(() => openIfcBytes('ISO-10303-21;' as unknown as Uint8Array)) === 'INVALID_INPUT');
  ok('12b geen STEP ⇒ INVALID_INPUT', await codeOf(() => openIfcBytes(encoded('{"tasks": []}'))) === 'INVALID_INPUT');
  ok('12c afgekapt STEP ⇒ IFC_READ_FAILED', await codeOf(() => openIfcBytes(encoded('ISO-10303-21;\nHEADER;'))) === 'IFC_READ_FAILED');
  const empty = createAppStoreContext({ emitHostEvents: false }).store.getState();
  ok('12d IFC zonder taken ⇒ NO_TASKS',
    await codeOf(() => openIfcBytes(encoded(writeIFC(buildWriteIFCInput(empty, 'planOnly'))))) === 'NO_TASKS');
  ok('12e een model zonder planning ⇒ NO_TASKS',
    await codeOf(() => openIfcBytes(new Uint8Array(readFileSync(foreignFixture('model-ifc4.ifc'))))) === 'NO_TASKS');
  ok('12f een IFC2X3-model blijft geweigerd ⇒ IFC_READ_FAILED',
    await codeOf(() => openIfcBytes(new Uint8Array(readFileSync(foreignFixture('model-ifc2x3.ifc'))))) === 'IFC_READ_FAILED');
  const own = readFileSync(files[0]);
  ok('12g witruimte vóór de kop opent op de bytesroute',
    await codeOf(() => openIfcBytes(new Uint8Array([0x0a, 0x20, ...own]))) === 'geen fout');
  const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...own]);
  const app = createAppStoreContext({ emitHostEvents: false });
  app.store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const realError = console.error;
  console.error = () => {};
  try {
    await app.store.getState().openOpenedFile({ name: 'bom.ifc', content: '', bytes: new Uint8Array(withBom), ref: null });
  } finally {
    console.error = realError;
  }
  const appOpened = app.store.getState().tasks.length > 0;
  const coreCode = await codeOf(() => openIfcBytes(withBom));
  ok('12h een BOM vóór de kop: de bytesroute doet hetzelfde als de app met de flag aan (knownbug 2212)',
    appOpened ? coreCode === 'geen fout' : coreCode === 'IFC_READ_FAILED', `app ${appOpened ? 'opent' : 'weigert'}, kern ${coreCode}`);
}

{
  const text = readFileSync(foreignFixture('bonsai-4d.ifc'), 'utf8');
  const timeOfWallA = "#109=IFCTASKTIME($,$,$,$,'P5D','2026-02-02T09:00:00','2026-02-06T17:00:00',$,$,";
  const stale = text.replace(timeOfWallA,
    "#109=IFCTASKTIME($,$,$,$,'P5D','2026-02-02T09:00:00','2026-02-06T17:00:00','2026-03-02T09:00:00','2026-03-06T17:00:00',");
  ok('14 fixture: een Bonsai-planning met een vroege start die de berekening niet geeft', stale !== text);
  const doc = await openIfcBytes(encoded(stale));
  ok('14a de planning van het andere programma is te berekenen', doc.schedule().foreignContent?.objectCount === 155);
  let error: unknown;
  try { await doc.toIfcBytes(); } catch (e) { error = e; }
  ok('14b de merge kan het vreemde deel niet behouden ⇒ IFC_WRITE_FAILED met reason merge-needs-phase2, vóór uitvoer',
    error instanceof PlannerCoreError && error.code === 'IFC_WRITE_FAILED' && error.details.reason === 'merge-needs-phase2', String(error));
}

{
  const xer = readFileSync(join(root, 'tests/planning/fixtures/xer-archief-herschreven.ifc'));
  const b5 = readFileSync(join(root, 'tests/planning/fixtures/b5-lopend-oude-writer.ifc'));
  for (const [label, bytes] of [['XER_ARCHIVE_DROPPED', xer], ['MINUTE_MODEL_CONVERTED', b5]] as const) {
    const viaBytes = (await openIfcBytes(new Uint8Array(bytes))).openWarnings;
    const viaText = (await openIfc(bytes.toString('utf8'))).openWarnings;
    ok(`13 ${label}: openWarnings via bytes = via tekst`,
      viaBytes.some(w => w.code === label) && JSON.stringify(viaBytes) === JSON.stringify(viaText), JSON.stringify(viaBytes));
  }
}

if (diffs.length === 0) {
  console.log(`OK: headless kern — ${checks} checks groen (${files.length} voorbeeldbestanden)`);
} else {
  console.log(`XX headless kern — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`  - ${d}`);
  process.exit(1);
}
