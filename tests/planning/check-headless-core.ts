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
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openIfc, openIfcBytes, PlannerCoreError, type PlannerDocument, type ScheduleSummary } from '@/core';
import { createAppStoreContext } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { prepareIfcOutput } from '@/state/prepareIfcOutput';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { taskDepths } from '@/utils/wbs';
import type { Task } from '@/types/task';
import { foreignWorkMethodSource, oldOwnSource, OLD_TASK_NAME } from '../mcp/headlessCorpus';
import { answerDigest, FORMS } from '../../headless/server/smoke-corpus.mjs';

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
function eqText(label: string, actual: string, expected: string): void {
  ok(label, actual === expected, `${actual} ≠ ${expected}`);
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
  ok(`9a ${name}: zonder vreemd deel heeft de samenvatting geen foreignContent, op beide routes, zoals main`,
    !('foreignContent' in bytesSummary) && !('foreignContent' in summary), JSON.stringify(bytesSummary.foreignContent));
  const textIfc = await atOneWriteTime(() => doc.toIfc());
  const bytesIfc = await atOneWriteTime(() => bytesDoc.toIfcBytes());
  ok(`9b ${name}: toIfcBytes() schrijft byte voor byte dezelfde IFC als toIfc() van de tekstroute`,
    sameBytes(bytesIfc, encoded(textIfc)), firstLineDiff(utf8(bytesIfc), textIfc));
  const bytesDocText = await atOneWriteTime(() => bytesDoc.toIfc()).catch((e: unknown) => `schrijven weigerde: ${String(e)}`);
  ok(`9c ${name}: toIfc() van een bytesdocument zonder vreemd deel = toIfc() van de tekstroute`,
    bytesDocText === textIfc, firstLineDiff(bytesDocText, textIfc));
  const textDocBytes = await atOneWriteTime(() => doc.toIfcBytes());
  ok(`9d ${name}: toIfcBytes() van een tekstdocument = byte voor byte de UTF-8 van toIfc()`,
    sameBytes(textDocBytes, encoded(textIfc)), firstLineDiff(utf8(textDocBytes), textIfc));
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
  ok('8a de tekstroute bewaart geen vreemd deel: de samenvatting heeft geen foreignContent', !('foreignContent' in doc.schedule()));
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
  const withoutForeignContent = (summary: ScheduleSummary) => JSON.stringify({ ...summary, foreignContent: null });
  ok('8e de samenvatting van de bytesroute is die van de tekstroute, op foreignContent na',
    withoutForeignContent(bytesDoc.schedule()) === withoutForeignContent(doc.schedule()));
}

// De blokkade op de historische eigen kop (1132) is weg, ook voor echte kernuitvoer.
for (const name of ['ohara', 'data']) {
  const text = readFileSync(join(root, `tests/planning/fixtures/oude-tags/v2026.7.12-${name}-showcase-verbouwing-eengezinswoning.ifc`), 'utf8');
  const doc = await openIfc(text);
  const written = doc.toIfc();
  ok(`8 ${name}: oude eigen planning schrijft en heropent met alle twintig taken`,
    doc.schedule().counts.tasks === 20 && (await openIfc(written)).schedule().counts.tasks === 20);
}

{
  const review = foreignWorkMethodSource(root);
  for (const [route, open] of [['openIfc', () => openIfc(review.toString('utf8'))], ['openIfcBytes', () => openIfcBytes(new Uint8Array(review))]] as const) {
    const doc = await open();
    ok(`19 ${route}: een taak zonder OwnerHistory met een werkwijze van een ander programma opent en rekent`, doc.schedule().counts.tasks === 47);
    eqText(`19 ${route}: toIfc() weigert vóór uitvoer, want de gewone writer schrijft WorkMethod als $ (#1219)`,
      await refusalOf(() => doc.toIfc()), 'IFC_WRITE_FAILED:foreign');
    eqText(`19 ${route}: toIfcBytes() weigert ook`, await refusalOf(() => doc.toIfcBytes()), 'IFC_WRITE_FAILED:foreign');
  }
  const old = await openIfc(oldOwnSource(root));
  eqText('19 een oude eigen bron met een lege owner history en alleen gedragen slots schrijft zoals main',
    await refusalOf(() => old.toIfc()), 'geschreven');
  const reopened = await openIfc(old.toIfc());
  ok('19 de oude eigen bron heropent met alle taken en de oude taaknaam', reopened.schedule().counts.tasks === 47
    && reopened.schedule().tasks.some(t => t.name === OLD_TASK_NAME), JSON.stringify(reopened.schedule().counts));
}

{
  const reference = JSON.parse(readFileSync(join(root, 'headless/server/main-reference.json'), 'utf8')) as
    { main: string; cases: Record<string, { ifc?: { status: number; sha256?: string } }> };
  const oldOwn = ['v2026.7.7-urentaak-10-villa-wassenaar.ifc', 'v2026.7.12-data-showcase-verbouwing-eengezinswoning.ifc',
    'v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc'];
  for (const file of oldOwn) {
    const source = readFileSync(join(root, 'tests/planning/fixtures/oude-tags', file));
    ok(`20 ${file}: het lopende werkschema heet nog Bouwplanning v1.0`, source.includes("'Bouwplanning v1.0'"));
    for (const [form, shape] of FORMS) {
      const body = shape(source);
      const label = `oude-tags/${file}, ${form}`;
      const main = reference.cases[label]?.ifc;
      const viaText = await openIfc(body.toString('utf8'));
      viaText.schedule();
      const viaBytes = await openIfcBytes(new Uint8Array(body));
      viaBytes.schedule();
      const fromText = await refusalOf(() => viaText.toIfc());
      ok(`20 ${label}: toIfc() schrijft wat main ${reference.main.slice(0, 9)} schrijft (main-reference.json)`, main?.status === 200
        && fromText === 'geschreven' && answerDigest(viaText.toIfc(), 'ifc', 200, body) === main.sha256, fromText);
      const fromBytes = await refusalOf(() => viaBytes.toIfcBytes());
      ok(`20 ${label}: toIfcBytes() schrijft hetzelfde`, main?.status === 200 && fromBytes === 'geschreven'
        && answerDigest(utf8(await viaBytes.toIfcBytes()), 'ifc', 200, body) === main.sha256, fromBytes);
    }
  }
}

const foreignFixture = (name: string): string => join(root, 'tests/fixtures/ifc-foreign', name);

async function refusalOf(write: () => unknown): Promise<string> {
  try {
    await write();
    return 'geschreven';
  } catch (e) {
    return e instanceof PlannerCoreError ? `${e.code}:${String(e.details.reason)}` : String(e);
  }
}
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
  const pureModel = readFileSync(foreignFixture('model-ifc4.ifc'));
  eqText('12e een model zonder planning geeft de fout van main',
    await codeOf(() => openIfcBytes(new Uint8Array(pureModel))), await codeOf(() => openIfc(pureModel.toString('utf8'))));
  ok('12f een IFC2X3-model blijft geweigerd ⇒ IFC_READ_FAILED',
    await codeOf(() => openIfcBytes(new Uint8Array(readFileSync(foreignFixture('model-ifc2x3.ifc'))))) === 'IFC_READ_FAILED');
  const own = readFileSync(files[0]);
  ok('12g witruimte vóór de kop opent op de bytesroute',
    await codeOf(() => openIfcBytes(new Uint8Array([0x0a, 0x20, ...own]))) === 'geen fout');
}

const UTF8_BOM = [0xef, 0xbb, 0xbf];
const startsWithBom = (bytes: Uint8Array): boolean => UTF8_BOM.every((b, i) => bytes[i] === b);
async function openInAppWithFlag(name: string, bytes: Uint8Array) {
  const app = createAppStoreContext({ emitHostEvents: false });
  app.store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const realError = console.error;
  let failure: unknown;
  console.error = (...args: unknown[]) => { failure = args[1]; };
  try {
    await app.store.getState().openOpenedFile({ name, content: '', bytes: new Uint8Array(bytes), ref: null });
  } finally {
    console.error = realError;
  }
  return { app, failure };
}
const appDatesOf = (tasks: readonly Task[]): Dates => Object.fromEntries(tasks.map(t => [t.id,
  `${t.time.earlyStart}|${t.time.earlyFinish}|${t.time.lateStart}|${t.time.lateFinish}|${t.time.totalFloat}|${t.time.isCritical}`]));

{
  const own = readFileSync(files[0]);
  const withBom = new Uint8Array([...UTF8_BOM, ...own]);
  const viaText = await openIfc(new TextDecoder().decode(withBom));
  const textSummary = viaText.schedule();
  let viaBytes: Awaited<ReturnType<typeof openIfcBytes>> | undefined;
  try { viaBytes = await openIfcBytes(withBom); } catch (e) { ok('12h een eigen voorbeeld met BOM opent via de bytesroute', false, String(e)); }
  if (viaBytes) {
    const bytesSummary = viaBytes.schedule();
    ok('12h een eigen voorbeeld met BOM opent via de bytesroute met dezelfde samenvatting als via tekst',
      JSON.stringify(bytesSummary) === JSON.stringify(textSummary), firstDiff(datesOf(bytesSummary), datesOf(textSummary)));
    const textIfc = await atOneWriteTime(() => viaText.toIfc());
    ok('12i zonder vreemd deel schrijft de bytesroute dezelfde IFC als de tekstroute (zonder BOM, zoals main)',
      sameBytes(await atOneWriteTime(() => viaBytes!.toIfcBytes()), encoded(textIfc)));
  }
  const { app, failure } = await openInAppWithFlag('bom.ifc', withBom);
  const appDiff = firstDiff(datesOf(textSummary), appDatesOf(app.store.getState().tasks));
  ok('12j de app met de flag aan opent het voorbeeld met BOM, met dezelfde datums als de kern (was knownbug 2212)',
    failure === undefined && app.store.getState().tasks.length === textSummary.counts.tasks && appDiff === '',
    failure === undefined ? appDiff : String(failure));
}

const modelFixture = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const modelLines = (() => {
  const idOf = (line: string) => Number(/^#(\d+)=/.exec(line)?.[1] ?? NaN);
  const own = readFileSync(join(root, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8').split('\n');
  const highestOwnId = Math.max(...own.map(idOf).filter(Number.isFinite));
  return utf8(modelFixture).split('\n').filter(line => idOf(line) > highestOwnId);
})();
function modelLinesKeptInOrder(bytes: Uint8Array): boolean {
  const lines = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).split('\n');
  let at = 0;
  for (const line of modelLines) {
    at = lines.indexOf(line, at);
    if (at < 0) return false;
    at++;
  }
  return true;
}
{
  const withBom = new Uint8Array([...UTF8_BOM, ...modelFixture]);
  ok('15 fixture: het andere programma voegde 77 entiteiten toe, met ids boven die van het eigen voorbeeld',
    modelLines.length === 77 && modelLines.some(line => line.includes('IFCWALL')), String(modelLines.length));
  let doc: Awaited<ReturnType<typeof openIfcBytes>> | undefined;
  try { doc = await openIfcBytes(withBom); } catch (e) { ok('15a een modelbestand met BOM opent via de bytesroute', false, String(e)); }
  if (doc) {
    doc.schedule();
    ok('15a een modelbestand met BOM komt na schedule() byte-gelijk terug, met de BOM', sameBytes(await doc.toIfcBytes(), withBom));
  }
  const { app, failure } = await openInAppWithFlag('bom-model.ifc', withBom);
  ok('15b de app met de flag aan opent het modelbestand met BOM', failure === undefined && app.store.getState().ifcSource?.foreignObjectCount === 90,
    String(failure));
  const leaf = app.store.getState().tasks.find(t => t.childIds.length === 0 && !t.isMilestone);
  const newName = `${leaf?.name ?? ''} (gewijzigd)`;
  if (leaf) app.store.getState().updateTask(leaf.id, { name: newName });
  let edited: Uint8Array | undefined;
  try {
    const output = await prepareIfcOutput(app.store.getState(), buildWriteIFCInput(app.store.getState(), 'merge'));
    edited = output.prepared?.bytes;
  } catch (e) { ok('15c de merge met een gewijzigde taaknaam slaagt', false, String(e)); }
  if (edited) {
    ok('15c de merge met een gewijzigde taaknaam slaagt en schrijft een ander bestand', !sameBytes(edited, withBom));
    ok('15d na de merge met een gewijzigde planning staat de BOM er nog', startsWithBom(edited));
    ok('15e de regels van het model staan byte-gelijk en in dezelfde volgorde', modelLinesKeptInOrder(edited));
    const reopened = await openIfcBytes(edited);
    const summary = reopened.schedule();
    ok('15f de kern leest de gewijzigde naam en houdt het vreemde deel',
      summary.tasks.some(t => t.name === newName) && summary.foreignContent?.objectCount === 90, JSON.stringify(summary.foreignContent));
    ok('15g en geeft dat bestand na schedule() byte-gelijk terug', sameBytes(await reopened.toIfcBytes(), edited));
  }
}

{
  const own = readFileSync(files[0], 'utf8');
  const asIfc2x3 = (text: string) => text.replace(/FILE_SCHEMA\(.*?\);/, "FILE_SCHEMA(('IFC2X3'));");
  const withPset = own.replace('ENDSEC;\nEND-ISO-10303-21;',
    "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('behouden'),$);\n" +
    "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\nENDSEC;\nEND-ISO-10303-21;");
  const legacy = asIfc2x3(withPset);
  ok('16 fixture: een IFC2X3-planning met de externe pset ExternPset, zonder model',
    legacy.includes("FILE_SCHEMA(('IFC2X3'))") && legacy.includes('ExternPset') && !legacy.includes('IFCWALL('));
  const doc = await openIfcBytes(encoded(legacy));
  const summary = doc.schedule();
  ok('16a de planning opent en rekent; de bytesroute bewaart van IFC2X3 niets naast de planning',
    summary.counts.tasks > 0 && !('foreignContent' in summary), JSON.stringify(summary.foreignContent));
  const refusal = async (write: () => unknown) => {
    try { await write(); return 'schreef een bestand'; } catch (e) {
      return e instanceof PlannerCoreError ? `${e.code}:${String(e.details.reason)}` : String(e);
    }
  };
  eqText('16b toIfcBytes() weigert vóór uitvoer zoals main', await refusal(() => doc.toIfcBytes()), 'IFC_WRITE_FAILED:foreign');
  eqText('16c toIfc() weigert vóór uitvoer zoals main', await refusal(() => doc.toIfc()), 'IFC_WRITE_FAILED:foreign');
  eqText('16d de tekstroute weigert hetzelfde bestand, zoals main',
    await refusal(async () => (await openIfc(legacy)).toIfc()), 'IFC_WRITE_FAILED:foreign');
  const plainLegacy = asIfc2x3(own);
  const plainBytes = await openIfcBytes(encoded(plainLegacy));
  const plainText = await openIfc(plainLegacy);
  ok('16e een IFC2X3-planning zonder vreemde inhoud schrijft via bytes dezelfde IFC als de tekstroute, zoals main',
    sameBytes(await atOneWriteTime(() => plainBytes.toIfcBytes()), encoded(await atOneWriteTime(() => plainText.toIfc()))));
  const plainWithBom = new Uint8Array([...UTF8_BOM, ...encoded(plainLegacy)]);
  const plainBomBytes = await openIfcBytes(plainWithBom);
  const plainBomMain = await openIfc(Buffer.from(plainWithBom).toString('utf8'));
  ok('16f dezelfde IFC2X3-planning met één BOM schrijft via bytes dezelfde IFC als main',
    sameBytes(await atOneWriteTime(() => plainBomBytes.toIfcBytes()), encoded(await atOneWriteTime(() => plainBomMain.toIfc()))));
  const psetWithBom = new Uint8Array([...UTF8_BOM, ...encoded(legacy)]);
  eqText('16g de IFC2X3-planning met externe pset en één BOM weigert schrijven zoals main',
    await refusal(async () => (await openIfcBytes(psetWithBom)).toIfcBytes()),
    await refusal(async () => (await openIfc(Buffer.from(psetWithBom).toString('utf8'))).toIfc()));
}

{
  const text = readFileSync(foreignFixture('bonsai-4d.ifc'), 'utf8');
  const timeOfWallA = "#109=IFCTASKTIME($,$,$,$,'P5D','2026-02-02T09:00:00','2026-02-06T17:00:00',$,$,";
  const stale = text.replace(timeOfWallA,
    "#109=IFCTASKTIME($,$,$,$,'P5D','2026-02-02T09:00:00','2026-02-06T17:00:00','2026-03-02T09:00:00','2026-03-06T17:00:00',");
  ok('14 fixture: een Bonsai-planning met een vroege start die de berekening niet geeft', stale !== text);
  const doc = await openIfcBytes(encoded(stale));
  ok('14a de planning van het andere programma is te berekenen', doc.schedule().foreignContent?.objectCount === 155);
  const written = await doc.toIfcBytes();
  const line120 = (t: string) => t.match(/^#120=.*$/m)?.[0];
  ok('14b na doorrekenen behoudt de merge het vreemde deel: heropend hetzelfde vreemde deel, #120 byte voor byte',
    (await openIfcBytes(written)).schedule().foreignContent?.objectCount === 155 && line120(new TextDecoder().decode(written)) === line120(text));
  const council = readFileSync(foreignFixture('council/r6opus-twee-werkplannen.na.ifc'), 'utf8');
  const timeOfRoot = "#31=IFCTASKTIME($,.NOTDEFINED.,$,'P5D',$,'2026-01-05T08:00:00','2026-01-09T17:00:00',$,$,";
  const staleCouncil = council.replace(timeOfRoot,
    "#31=IFCTASKTIME($,.NOTDEFINED.,$,'P5D',$,'2026-01-05T08:00:00','2026-01-09T17:00:00','2026-03-02T08:00:00','2026-03-06T17:00:00',");
  ok('14c fixture: een planning van een ander programma in een oude lay-out met een vroege start die de berekening niet geeft', staleCouncil !== council);
  const old = await openIfcBytes(encoded(staleCouncil));
  old.schedule();
  let error: unknown;
  try { await old.toIfcBytes(); } catch (e) { error = e; }
  ok('14c de merge kan het vreemde deel niet behouden ⇒ IFC_WRITE_FAILED met reason merge-needs-phase2, vóór uitvoer',
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

{
  const oldOps = readFileSync(join(root, 'tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc'));
  const own = readFileSync(files[0]);
  const nbsp = encoded('\u00a0');
  const leads: Array<[string, Uint8Array]> = [
    ['oude OPS-export uit v2026.7.12 met BOM', new Uint8Array([...UTF8_BOM, ...oldOps])],
    ['dubbele BOM', new Uint8Array([...UTF8_BOM, ...UTF8_BOM, ...own])],
    ['BOM na een spatie', new Uint8Array([0x20, ...UTF8_BOM, ...own])],
    ['U+00A0 na een BOM', new Uint8Array([...UTF8_BOM, ...nbsp, ...own])],
  ];
  for (const [label, bytes] of leads) {
    const asMain = await openIfc(Buffer.from(bytes).toString('utf8'));
    const mainSummary = asMain.schedule();
    let doc: Awaited<ReturnType<typeof openIfcBytes>> | undefined;
    try { doc = await openIfcBytes(bytes); } catch (e) { ok(`17 ${label}: openIfcBytes leest wat main las`, false, String(e)); }
    if (!doc) continue;
    const summary = doc.schedule();
    ok(`17 ${label}: openIfcBytes geeft dezelfde samenvatting als main`,
      JSON.stringify(summary) === JSON.stringify(mainSummary), firstDiff(datesOf(summary), datesOf(mainSummary)));
    const mainIfc = await atOneWriteTime(() => asMain.toIfc());
    ok(`17 ${label}: toIfcBytes() schrijft byte voor byte wat main schreef`,
      sameBytes(await atOneWriteTime(() => doc!.toIfcBytes()), encoded(mainIfc)));
  }
  const withPset = utf8(own).replace('ENDSEC;\nEND-ISO-10303-21;',
    "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('behouden'),$);\n" +
    "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\nENDSEC;\nEND-ISO-10303-21;");
  const doubleBomPset = new Uint8Array([...UTF8_BOM, ...UTF8_BOM, ...encoded(withPset)]);
  const refusedWrite = async (write: () => unknown) => {
    try { await write(); return 'schreef een bestand'; } catch (e) {
      return e instanceof PlannerCoreError ? `${e.code}:${String(e.details.reason)}` : String(e);
    }
  };
  const reused = new Uint8Array([...UTF8_BOM, 0x20, ...oldOps]);
  const pending = openIfcBytes(reused);
  reused.fill(0x20);
  ok('17d de tekstroute leest de eigen kopie van de invoer, ook als de aanroeper zijn buffer meteen hergebruikt',
    await codeOf(async () => (await pending).schedule()) === 'geen fout');
  const fallbackDoc = await openIfcBytes(doubleBomPset);
  ok('17a dubbele BOM met externe pset: de terugval leest de planning', fallbackDoc.schedule().counts.tasks > 0);
  eqText('17b en schrijven weigert zoals main, met reason foreign', await refusedWrite(() => fallbackDoc.toIfcBytes()), 'IFC_WRITE_FAILED:foreign');

  const { app, failure } = await openInAppWithFlag('oude-kop-bom.ifc', leads[0][1]);
  const viaText = (await openIfc(Buffer.from(leads[0][1]).toString('utf8'))).schedule();
  const appDiff = firstDiff(datesOf(viaText), appDatesOf(app.store.getState().tasks));
  ok('17c de app met de flag aan opent de oude OPS-export met BOM, met dezelfde 20 taken en datums',
    failure === undefined && app.store.getState().tasks.length === 20 && appDiff === '',
    failure === undefined ? appDiff : String(failure));
}

{
  const describe = (e: unknown): string => e instanceof PlannerCoreError ? `${e.code}:${String(e.details.reason ?? '')}` : `ander fouttype: ${String(e)}`;
  const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  type Write = (doc: PlannerDocument, summary: ScheduleSummary) => Promise<Uint8Array>;
  interface Outcome { open: string; summary?: ScheduleSummary; http?: string; bytes?: string }
  const outcome = (open: () => Promise<PlannerDocument>, asHttp: Write, asBytes: Write): Promise<Outcome> => atOneWriteTime(async () => {
    let doc: PlannerDocument;
    try { doc = await open(); } catch (e) { return { open: describe(e) }; }
    let summary: ScheduleSummary;
    try { summary = doc.schedule(); } catch (e) { return { open: 'open', http: `rekenen ${describe(e)}` }; }
    const written = async (write: Write) => {
      try { return digest(await write(doc, summary)); } catch (e) { return `schrijven ${describe(e)}`; }
    };
    return { open: 'open', summary, http: await written(asHttp), bytes: await written(asBytes) };
  });
  const wrote = (result: string | undefined) => !!result && /^[0-9a-f]{64}$/.test(result);
  function ruleBroken(main: Outcome, viaBytes: Outcome): string {
    if (main.open !== viaBytes.open) return `openen: ${viaBytes.open} ≠ ${main.open}`;
    if (!main.summary || !viaBytes.summary) return main.http === viaBytes.http ? '' : `rekenen: ${viaBytes.http} ≠ ${main.http}`;
    const plain = (summary: ScheduleSummary) => JSON.stringify({ ...summary, foreignContent: null });
    if (plain(main.summary) !== plain(viaBytes.summary)) return 'samenvatting wijkt af van main';
    if (!viaBytes.summary.foreignContent) {
      if (viaBytes.http !== main.http) return `uitvoer zoals de HTTP-worker: ${viaBytes.http?.slice(0, 80)} ≠ ${main.http?.slice(0, 80)}`;
      return viaBytes.bytes === main.bytes ? '' : `toIfcBytes(): ${viaBytes.bytes?.slice(0, 80)} ≠ ${main.bytes?.slice(0, 80)}`;
    }
    if (wrote(main.http)) return 'de bytes-route bewaart een vreemd deel waar main gewoon schreef';
    return wrote(viaBytes.http) && wrote(viaBytes.bytes) ? '' : `bewaren mislukt: ${viaBytes.bytes?.slice(0, 80)}`;
  }
  const emptyLiveSchedule = (() => {
    const st = createAppStoreContext({ emitHostEvents: false }).store.getState();
    const task: Task = {
      id: 'taak-1', name: 'Taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED', priority: 500,
      isMilestone: false, parentId: null, childIds: [], time: createDefaultTaskTime('2027-03-01', 5), resourceIds: [],
    };
    const written = writeIFC({
      project: { ...st.project, id: 'leeg-werkschema', startDate: '2027-03-01' }, calendar: st.calendar,
      tasks: [task], sequences: [], resources: [], assignments: [],
      baselines: [{ id: 'bl-1', name: 'Baseline', createdAt: '2027-02-15T12:00:00.000Z', projectEnd: '2027-03-05', projectDuration: 5,
        tasks: [{ taskId: 'taak-1', start: '2027-03-01', finish: '2027-03-05', duration: 5, isMilestone: false }] }],
      activeBaselineId: 'bl-1',
    });
    const scheduleId = (kind: string) => new RegExp(`^#(\\d+)=IFCWORKSCHEDULE\\(.*\\.${kind}\\.\\);$`, 'm').exec(written)?.[1];
    const [live, baseline] = [scheduleId('PLANNED'), scheduleId('BASELINE')];
    return written.split('\n').map(line => /^#\d+=IFC(RELNESTS|RELASSIGNSTOCONTROL)\(/.test(line)
      ? line.replace(new RegExp(`#${live}\\b`), `#${baseline}`) : line).join('\n');
  })();
  const corpus: Array<[string, Uint8Array]> = [
    ...files.map(f => [f.slice(root.length + 1), new Uint8Array(readFileSync(f))] as [string, Uint8Array]),
    ...readdirSync(join(root, 'tests/planning/fixtures/oude-tags')).filter(f => f.endsWith('.ifc'))
      .map(f => [`oude-tags/${f}`, new Uint8Array(readFileSync(join(root, 'tests/planning/fixtures/oude-tags', f)))] as [string, Uint8Array]),
    ['IFC2X3-planning', encoded(utf8(new Uint8Array(readFileSync(files[0]))).replace(/FILE_SCHEMA\(.*?\);/, "FILE_SCHEMA(('IFC2X3'));"))],
    ['leeg eigen werkschema met één baselinetaak', encoded(emptyLiveSchedule)],
  ];
  ok('18 fixture: het leeg eigen werkschema leest via tekst één taak',
    (await openIfc(emptyLiveSchedule)).schedule().counts.tasks === 1);
  const forms: Array<[string, (bytes: Uint8Array) => Uint8Array]> = [
    ['kaal', bytes => bytes],
    ['met BOM', bytes => new Uint8Array([...UTF8_BOM, ...bytes])],
    ['met BOM en een spatie', bytes => new Uint8Array([...UTF8_BOM, 0x20, ...bytes])],
  ];
  let pinned = 0;
  let kept = 0;
  for (const [name, source] of corpus) {
    for (const [form, shape] of forms) {
      const bytes = shape(source);
      const viaMain = await outcome(() => openIfc(Buffer.from(bytes).toString('utf8')),
        async doc => encoded(doc.toIfc()), async doc => encoded(doc.toIfc()));
      const viaBytes = await outcome(() => openIfcBytes(bytes),
        async (doc, summary) => !summary.foreignContent ? encoded(doc.toIfc()) : doc.toIfcBytes(), doc => doc.toIfcBytes());
      const broken = ruleBroken(viaMain, viaBytes);
      ok(`18 ${name}, ${form}: openIfcBytes geeft de uitkomst van main, of bewaart een vreemd deel waar main weigerde`, broken === '', broken);
      if (viaBytes.summary?.foreignContent) kept++;
      pinned++;
    }
  }
  ok('18 de bytes-route bewaart alleen bij de twee oude woongebouw-bestanden, waar de indeling een vreemd deel ziet en main het schrijven weigert, in elke vorm',
    kept === 2 * forms.length, String(kept));
  ok('18 de regel is gepind op het hele corpus', pinned === corpus.length * forms.length && pinned >= 130, String(pinned));
}


if (diffs.length === 0) {
  console.log(`OK: headless kern — ${checks} checks groen (${files.length} voorbeeldbestanden)`);
} else {
  console.log(`XX headless kern — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`  - ${d}`);
  process.exit(1);
}
