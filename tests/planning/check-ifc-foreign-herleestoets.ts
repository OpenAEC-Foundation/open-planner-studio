// 1107: de open-stappen zijn verplicht en hun volledige uitkomst wordt getoetst.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedModel } from './ifcGeneratedModel';
import { storeWith, loadStore } from './ifcAppRoute';
import { readbackDifference } from './ifcReadbackEquality';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { MINUTE_MODEL_TIME_MODEL } from '@/state/migrations/minuteModel';
import { readFileSync } from 'node:fs';
import { installDeterminism } from './ifcPariteitKern';
import { canon, cloneDomain, applyEdit, ordinaryEdits, openForeign, openReadPlanning, shownAfterOpen, tryMerge } from './ifcMergeKern';
import { writeIfcMerge, MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';

const reseed = installDeterminism();
const bytes = new Uint8Array(readFileSync(new URL('../fixtures/ifc-foreign/eigen-plus-model.ifc', import.meta.url)));
const opened = await openForeign(bytes);
const source = opened.ifcSource!;
const d = cloneDomain(opened);
await assert.rejects(async () => {
  // Ook voor JS-aanroepers: zonder functie geen uitvoer, vóór de writer iets opbouwt.
  // @ts-expect-error De derde parameter is verplicht.
  await writeIfcMerge(d, source);
}, (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases[0].kind === 'open-stappen-ontbreken');

const saved = await tryMerge(d, source);
assert(saved.ok, saved.ok ? '' : JSON.stringify(saved.error.cases));
assert.equal(readbackDifference(saved.shown, await openForeign(saved.bytes)), undefined, 'naad = bytes-route, diep gelijk');
// Vergelijkingsproef: een gewijzigde uitvoerduur weigert ook zonder herberekening; dit bewijst alleen de vergelijking.
await assert.rejects(() => writeIfcMerge(d, source, async (parsed, side) => {
  let input = structuredClone(parsed);
  if (side === 'uitvoer') input = await applyEdit(ordinaryEdits(input).find(e => e.kind === 'duur')!, input);
  return openReadPlanning(input, side);
}), (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'planning-na-openen' && c.detail.includes('.time.')));
// Blijvende proef: een duurwijziging zonder F5 schrijft; de twaalf tijdvelden normaliseren gelijk.
const longer = await applyEdit(ordinaryEdits(opened).find(e => e.kind === 'duur')!, cloneDomain(opened));
const result = await tryMerge(longer, source);
assert(result.ok, result.ok ? '' : JSON.stringify(result.error.cases));
const wanted = await shownAfterOpen(longer);
const full = await openForeign(result.bytes);
assert.equal(canon(wanted, reseed), canon(full, reseed));
assert.equal(readbackDifference(result.shown, full), undefined);
let fields = 0;
for (const task of longer.tasks) {
  const back = full.tasks.find(t => t.id === task.id)!;
  for (const key of Object.keys(task.time) as (keyof typeof task.time)[]) if (task.time[key] !== back.time[key]) fields++;
}
assert.equal(fields, 12, 'de twaalf opnieuw berekende tijdvelden van de eerdere stop');
// De gedeelde voortgangsbewerking gebruikt enterTaskProgress, inclusief bevestigen van een startvraag.
const beforeProgress = cloneDomain(opened);
beforeProgress.importPristine = true;
const progressed = await applyEdit(ordinaryEdits(opened).find(e => e.kind === 'voortgang')!, beforeProgress);
assert.equal(progressed.importPristine, undefined, 'de echte invoer wist ook de oude importvlag');
const progressTask = progressed.tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!;
assert.equal(progressTask.time.completion, 0.5);
assert.equal(progressTask.status, 'STARTED');
assert(progressTask.time.actualStart);
const progressMerge = await tryMerge(progressed, source);
assert(progressMerge.ok, progressMerge.ok ? '' : JSON.stringify(progressMerge.error.cases));
assert.equal(readbackDifference(progressMerge.shown, await openForeign(progressMerge.bytes)), undefined);
console.log('OK herleestoets: verplichte naad, afwijkende herberekening van de uitvoer en gelijkheid met volledige heropening');

// Observatie van 1113 via de echte setter: de rest hoort vóór opslaan al 0 te zijn.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const raw = readFileSync(join(root, 'tests/planning/fixtures/oude-tags/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc'), 'utf8');
  const o = await openForeign(generatedModel(root, raw, 0));
  const { store, buildWriteIFCInput } = await storeWith(cloneDomain(o));
  const task = store.getState().tasks.find(t => t.name === 'Set up site')!;
  const before = task.time.remainingTime;
  assert.equal(store.getState().setActualFinish(task.id, task.time.scheduleFinish), true);
  const input = buildWriteIFCInput(store.getState());
  const afterEntry = input.tasks.find(t => t.id === task.id)!.time.remainingTime;
  assert.equal(afterEntry, 0, 'de echte invoer zet de rest al vóór opslaan op 0');
  const shown = await shownAfterOpen(input);
  const normalized = shown.tasks.find(t => t.id === task.id)!.time.remainingTime;
  const merge = await tryMerge(input, o.ifcSource!);
  console.log('1113', JSON.stringify({ route: 'setActualFinish', before, afterEntry, normalized, merge: merge.ok ? 'schrijft' : merge.error.cases }));
  if (merge.ok) {
    const full = await openForeign(merge.bytes);
    console.log('1113 naad/bytes', merge.shown.tasks.find(t => t.id === task.id)!.time.remainingTime, full.tasks.find(t => t.id === task.id)!.time.remainingTime);
    assert.equal(readbackDifference(merge.shown, full), undefined);
  }
}

// Alleen de bibliotheekvolgorde mag verschillen; verlies, toevoeging, inhoud en dubbele ids blijven zichtbaar.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const raw = readFileSync(join(root, 'tests/planning/fixtures/h7-tijden-oude-writer.ifc'), 'utf8');
  const o = await openForeign(generatedModel(root, raw, 0));
  const input = cloneDomain(o);
  assert(input.resourceCalendars && input.resourceCalendars.length > 1);
  const reordered = cloneDomain(o);
  reordered.resourceCalendars!.reverse();
  assert.equal(canon(input, reseed), canon(reordered, reseed), 'kalenderbibliotheek: alleen andere volgorde is gelijk');
  const id = input.resourceCalendars.find(c => c.id !== input.project.calendarId)!.id;
  const changed = (edit: (planning: typeof input) => void) => writeIfcMerge(input, o.ifcSource!, async (parsed, side) => {
    const shown = structuredClone(await openReadPlanning(parsed, side));
    if (side === 'uitvoer') edit(shown);
    return shown;
  });
  const rejected = (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'planning-na-openen');
  // De callback bootst een fout in de herlezing na; alle gewone open-stappen blijven actief.
  const orderOnly = await changed(p => { p.resourceCalendars!.reverse(); });
  assert(orderOnly.length > 0);
  await assert.rejects(() => changed(p => { p.resourceCalendars = p.resourceCalendars!.filter(c => c.id !== id); }), rejected, 'kalender verdwenen');
  await assert.rejects(() => changed(p => { p.resourceCalendars!.push({ ...structuredClone(p.resourceCalendars![0]), id: 'cal-onverwacht' }); }), rejected, 'kalender erbij');
  await assert.rejects(() => changed(p => { p.resourceCalendars!.find(c => c.id === id)!.workStartHour += 1e-9; }), rejected, 'werktijd blijft exact, ook onder de schrijfprecisie');
  await assert.rejects(() => changed(p => { p.resourceCalendars!.find(c => c.id === id)!.shift = 'FIRST'; }), rejected, 'ook een door de writer genormaliseerd kalenderdetail blijft exact');
  await assert.rejects(() => changed(p => { p.resourceCalendars!.find(c => c.id === id)!.workingExceptions = [{ name: 'Onverwacht', startDate: '2027-03-06', endDate: '2027-03-06', bands: [{ start: 480, end: 540 }] }]; }), rejected, 'werkende uitzondering veranderd');
  await assert.rejects(() => changed(p => { p.resourceCalendars!.push(structuredClone(p.resourceCalendars!.find(c => c.id === id)!)); }), rejected, 'dubbel kalender-id valt niet samen');
  console.log('OK kalenderbibliotheek: volgorde gelijk; ontbreken, toevoegen, werktijd, uitzondering en dubbel id geweigerd');

  const cases = JSON.parse(readFileSync(join(root, 'tests/planning/fixtures/ifc-foreign-herleestoets-gevallen.json'), 'utf8')) as {bestand:string;bewerking:string}[];
  let written = 0;
  for (const c of cases.filter(c => c.bewerking.endsWith(' wissen'))) {
    const file = c.bestand.startsWith('h7-') ? 'h7-tijden-oude-writer.ifc' : 'urenperdag-oude-writer.ifc';
    const source = await openForeign(generatedModel(root, readFileSync(join(root, 'tests/planning/fixtures', file), 'utf8'), 0));
    const { store, buildWriteIFCInput } = await storeWith(cloneDomain(source));
    store.getState().deleteTasksBulk([c.bewerking.replace(/ wissen$/, '')]);
    const edited = buildWriteIFCInput(store.getState());
    const r = await tryMerge(edited, source.ifcSource!);
    assert(r.ok, r.ok ? '' : `${file}: ${JSON.stringify(r.error.cases)}`);
    const full = await openForeign(r.bytes);
    assert.equal(canon(await shownAfterOpen(edited), reseed), canon(full, reseed));
    assert.equal(readbackDifference(r.shown, full), undefined);
    written++;
  }
  assert.equal(written, 6);
  console.log('OK zes echte wisacties: schrijven, dezelfde kalenders en inhoud na volledig heropenen');
}

// Trias: alle vier echte invoerroutes weigeren zolang de ongewijzigde duur precisie zou verliezen.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const base = readFileSync(join(root, 'tests/planning/fixtures/oude-tags/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc'), 'utf8');
  const { splitStepArgs } = await import('@/services/ifc/foreign/stepScanner');
  const { openInStore } = await import('./ifcAppRoute');
  let refused = 0;
  for (const remaining of [2.3333333333333335, 1.2345678901234567]) {
    const line = base.split('\n').find(l => l.includes("IFCTASKTIME('Set up site Time'"))!;
    const args = splitStepArgs(line.slice(line.indexOf('(') + 1, line.lastIndexOf(')')));
    args[18] = `'P0Y0M${remaining}D'`;
    const raw = base.replace(line, line.slice(0, line.indexOf('(') + 1) + args.join(',') + ');');
    for (const edit of ['completion', 'actualStart'] as const) {
      const { store, snapshot } = await openInStore(generatedModel(root, raw, 0));
      const task = store.getState().tasks.find(t => t.name === 'Set up site')!;
      const accepted = edit === 'completion' ? store.getState().setTaskProgress(task.id, 0.5)
        : store.getState().setActualStart(task.id, task.time.scheduleStart);
      assert(accepted);
      const input = cloneDomain(snapshot(store));
      const expected = (await shownAfterOpen(input)).tasks.find(t => t.id === task.id)!;
      assert.equal(expected.time.scheduleDuration, 2.3333333333333335);
      const r = await tryMerge(input, snapshot(store).ifcSource!);
      if (r.ok) {
        const back = (await openForeign(r.bytes)).tasks.find(t => t.id === task.id)!;
        console.log('STIL PRECISIEVERLIES', JSON.stringify({ remaining, edit, duration: back.time.scheduleDuration }));
      } else {
        assert(r.error.cases.some(c => c.kind === 'ongewijzigd-getal' && c.detail.includes(task.id)
          && c.detail.includes('time.scheduleDuration') && c.detail.includes('2.3333333333333335') && c.detail.includes('2.333333')));
        refused++;
      }
    }
  }
  assert.equal(refused, 4, 'alle vier weigeren getypeerd; geen stille afronding van een ongewijzigde duur');
  console.log('OK ongewijzigd getal: alle vier echte voortgangsacties weigeren de afgeronde duur');
}

// Terra R1: de echte extensie-load verandert alleen de lag-eenheid; het ongewijzigde getal moet exact blijven.
{
  const { openInStore } = await import('./ifcAppRoute');
  const { loadExtensionProject } = await import('@/extensions/retainActiveDocument');
  const { toExtProject, toExtCalendar, toExtTask, toExtSequence, toExtResource, toExtAssignment } = await import('@/extensions/extMappers');
  const text = new TextDecoder().decode(bytes).replace("IFCDURATION('P2D'),.WORKTIME.", "IFCDURATION('P2.3333333333333335D'),.WORKTIME.");
  const { store, snapshot } = await openInStore(new TextEncoder().encode(text));
  const before = snapshot(store);
  const seq = before.sequences.find(s => s.lagDays === 2.3333333333333335)!;
  assert(seq);
  const state = store.getState();
  const ext = { project: toExtProject(state.project), calendar: toExtCalendar(state.calendar), tasks: state.tasks.map(t => toExtTask(t)),
    sequences: state.sequences.map(toExtSequence), resources: state.resources.map(toExtResource), assignments: state.assignments.map(toExtAssignment) };
  ext.sequences.find(s => s.id === seq.id)!.lagUnit = 'ELAPSEDTIME';
  loadExtensionProject(store, ext);
  const input = cloneDomain(snapshot(store));
  assert.equal(snapshot(store).ifcSource, before.ifcSource, 'de bron blijft gekoppeld');
  assert.equal(input.sequences.find(s => s.id === seq.id)!.lagDays, seq.lagDays);
  assert.equal((await shownAfterOpen(input)).sequences.find(s => s.id === seq.id)!.lagDays, seq.lagDays);
  const r = await tryMerge(input, before.ifcSource!);
  if (r.ok) console.log('STIL LAGVERLIES', (await openForeign(r.bytes)).sequences.find(s => s.id === seq.id)!.lagDays);
  assert(!r.ok, 'geen bytes met een stil afgeronde ongewijzigde lag');
  assert(r.error.cases.some(c => c.kind === 'ongewijzigd-getal' && c.detail.includes(seq.id)
    && c.detail.includes('lagDays') && c.detail.includes('2.3333333333333335') && c.detail.includes('2.333333')));
  console.log('OK Terra R1: echte lag-eenheidswijziging weigert getypeerd op de ongewijzigde lag');
}

// Rechtstreeks betekent werkelijk exact: dezelfde writer-canon mag deze twee lags gelijk vinden, de leeswegtoets niet.
{
  const a = cloneDomain(opened), b = cloneDomain(opened);
  a.sequences[0].lagDays = 2.3333333333333335;
  b.sequences[0].lagDays = 2.333333;
  assert(readbackDifference(a, b)?.includes('lagDays'));
}

// Meer dan zes decimalen in andere soorten dingen: een gemaakte bron, daarna een echte extensie-load.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const precise = 2.3333333333333335, seedInput = cloneDomain(opened);
  seedInput.resources[0].maxUnits = precise;
  seedInput.assignments[0].unitsPerDay = precise;
  seedInput.project.schedulingOptions = { ...seedInput.project.schedulingOptions, nearCriticalThreshold: precise };
  const task = seedInput.tasks[0];
  seedInput.baselines = [{ id: 'fix1-baseline', name: 'Precieze baseline', createdAt: '2027-01-01T12:00:00Z',
    projectEnd: task.time.scheduleFinish, projectDuration: precise,
    tasks: [{ taskId: task.id, start: task.time.scheduleStart, finish: task.time.scheduleFinish, duration: precise, isMilestone: false }] }];
  const { openInStore } = await import('./ifcAppRoute');
  const { loadExtensionProject } = await import('@/extensions/retainActiveDocument');
  const { toExtProject, toExtCalendar, toExtTask, toExtSequence, toExtResource, toExtAssignment } = await import('@/extensions/extMappers');
  const { store, snapshot } = await openInStore(generatedModel(root, writeIFC(seedInput), 0));
  const state = store.getState();
  const ext = { project: toExtProject(state.project), calendar: toExtCalendar(state.calendar), tasks: state.tasks.map(t => toExtTask(t)),
    sequences: state.sequences.map(toExtSequence), resources: state.resources.map(toExtResource), assignments: state.assignments.map(toExtAssignment) };
  ext.project.name += ' hernoemd';
  loadExtensionProject(store, ext);
  const input = cloneDomain(snapshot(store));
  const numbers = (p: typeof input) => [p.resources.find(r => r.id === seedInput.resources[0].id)!.maxUnits,
    p.assignments.find(a => a.taskId === seedInput.assignments[0].taskId && a.resourceId === seedInput.assignments[0].resourceId)!.unitsPerDay,
    p.project.schedulingOptions!.nearCriticalThreshold, p.baselines![0].projectDuration, p.baselines![0].tasks[0].duration];
  assert.deepEqual(numbers(input), Array(5).fill(precise), 'bron en echte actie dragen de vijf precieze waarden');
  assert.deepEqual(numbers(await shownAfterOpen(input)), numbers(input));
  const r = await tryMerge(input, snapshot(store).ifcSource!);
  if (r.ok) {
    const full = await openForeign(r.bytes);
    assert.deepEqual(numbers(full), numbers(input), 'resource, toewijzing, project en baseline komen exact terug');
    assert.equal(readbackDifference(r.shown, full), undefined);
  } else assert(r.kinds.includes('ongewijzigd-getal'), JSON.stringify(r.error.cases));
  console.log('OK buiten taken: resource, toewijzing, project en baseline exact of getypeerd geweigerd', r.ok ? 'exact' : r.kinds);
}

// Gemaakte, geldige invoer die de echte herberekening nodig heeft om de afronding zichtbaar te maken.
// De gewone writer rondt 2.9999998 kalendertijd-dagen naar 3; vóór berekening is haar projectie gelijk.
// Optionele, niet-opgeslagen analysecaches ontbreken in deze fixture om uitsluitend de rekenstap te isoleren.
{
  const { openInStore } = await import('./ifcAppRoute');
  const { store, snapshot } = await openInStore(bytes);
  const task = store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
  store.getState().updateTask(task.id, { time: { ...task.time, durationUnit: 'days', durationMinutes: undefined,
    durationType: 'ELAPSEDTIME', scheduleDuration: 2.9999998 } });
  const input = cloneDomain(snapshot(store));
  for (const t of input.tasks) { delete t.time.interferingFloat; delete t.time.floatPath; }
  const { createAppStoreContext, buildWriteIFCInput } = await loadStore();
  const actual: Partial<Record<'uitvoer' | 'domein', typeof input>> = {};
  const run = (recompute: boolean) => writeIfcMerge(input, snapshot(store).ifcSource!, async (p, side) => {
    const parsed = side === 'domein' ? { ...structuredClone(p), timeModel: MINUTE_MODEL_TIME_MODEL,
      resourceCalendars: p.resourceCalendars?.filter(c => c.id !== p.project.calendarId) } : structuredClone(p);
    const { store: fresh } = createAppStoreContext();
    const apply = fresh.getState().applyLoadedProject;
    fresh.setState({ applyLoadedProject: (data, opts) => apply(data, { ...opts, recompute }) });
    fresh.getState().openAsDocument(parsed, { name: 'herberekenproef.ifc', ref: null });
    return actual[side] = buildWriteIFCInput(fresh.getState());
  });
  assert((await run(false)).length > 0, 'alle bestaande controles passeren zonder herberekening');
  assert.equal(canon(actual.domein!, reseed), canon(actual.uitvoer!, reseed), 'de bestaande writerprojectie is zonder rekenen gelijk');
  const recompute = true; // Mutatievoorwaarde: alleen dit wordt false, de echte open-stappen blijven lopen.
  let rejection: unknown;
  try { await run(recompute); console.log('HERBEREKENING UIT: de merge schrijft'); } catch (e) { rejection = e; }
  assert(rejection instanceof MergeNeedsPhase2Error && rejection.cases.some(c => c.kind === 'planning-na-openen'),
    'de echte herberekening moet het verschil veroorzaken en laten weigeren');
  const computed = ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'freeFloat', 'totalFloat', 'freeFloatMinutes', 'totalFloatMinutes', 'isCritical'] as const;
  assert(actual.domein!.tasks.some(t => computed.some(k =>
    !Object.is(actual.uitvoer!.tasks.find(x => x.id === t.id)!.time[k], t.time[k]))),
    'de echte solver geeft door de afronding andere rekendatums of speling');
  console.log('OK echte herberekening: zonder rekenen schrijft de merge; met rekenen verschillen rekenuitkomsten', rejection.cases);
}
