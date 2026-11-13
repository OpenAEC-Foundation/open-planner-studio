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
import { canon, cloneDomain, applyEdit, ordinaryEdits, plannerEdits, openForeign, openReadPlanning, shownAfterOpen, tryMerge } from './ifcMergeKern';
import { writeIfcMerge, MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';

const reseed = installDeterminism();
const bytes = new Uint8Array(readFileSync(new URL('../fixtures/ifc-foreign/eigen-plus-model.ifc', import.meta.url)));
const opened = await openForeign(bytes);
const source = opened.ifcSource!;

// E4: elke getelde handeling gebruikt een verse apppayload, inclusief WBS en bewerkingsherkomst.
{
  const input = cloneDomain(opened), template = input.tasks.find(t => !t.childIds.length)!;
  input.tasks = [
    ['fase-a', null, ['a', 'b']], ['a', 'fase-a', []], ['b', 'fase-a', []],
    ['fase-c', null, ['c']], ['c', 'fase-c', []], ['los', null, []],
  ].map(([id, parentId, childIds]) => ({ ...structuredClone(template), id: id as string, name: id as string,
    parentId: parentId as string | null, childIds: childIds as string[], resourceIds: [], isMilestone: false }));
  input.sequences = []; input.assignments = []; input.baselines = []; input.activeBaselineId = null;
  input.importPristine = true;
  input.project.wbsAutoNumber = true;
  const before = structuredClone(input), kinds = new Set<string>();
  for (const edit of [...plannerEdits(input), ...ordinaryEdits(input)]) {
    const candidate = structuredClone(before), pristine = structuredClone(candidate);
    const result = await applyEdit(edit, candidate);
    kinds.add(edit.kind);
    if (edit.kind === 'niets') continue; // De referentie zonder handeling blijft bewust kaal.
    assert.deepEqual(candidate, pristine, `${edit.kind}: de actie muteert niet de aangeleverde payload`);
    assert.notStrictEqual(result, candidate, `${edit.kind}: de hele verse payload komt terug`);
    if (edit.kind === 'hernoemen') {
      assert.equal(result.tasks.find(t => t.id === 'a')!.name, 'Hernoemd in 1b');
      assert.equal(result.importPristine, undefined, 'de writerpayload laat de gewiste importvlag weg');
    }
    if (edit.kind === 'taak-erbij') {
      assert.equal(result.tasks.length, before.tasks.length + 1);
      const added = result.tasks.find(t => !before.tasks.some(old => old.id === t.id))!;
      assert(added.id.startsWith('task-'), 'een nieuwe taak krijgt haar id van addTask');
      assert(!added.resourceIds.length, 'een nieuwe taak kopieert geen bron-toewijzingen');
    }
    const ids = new Map(result.tasks.map(t => [t.id, t]));
    for (const task of result.tasks) {
      if (task.parentId) assert(ids.get(task.parentId)?.childIds.includes(task.id), 'ouder en kinderen blijven synchroon');
      for (const child of task.childIds) assert.equal(ids.get(child)?.parentId, task.id);
    }
  }
  assert.equal(kinds.size, 12, 'alle twaalf soorten handelingen zijn beproefd');
  assert.deepEqual(input, before, 'elke handeling begon bij dezelfde ongewijzigde invoer');
  console.log('OK E4: twaalf soorten echte appacties, verse payload, WBS en bewerkingsherkomst');
}

const d = cloneDomain(opened);
await assert.rejects(async () => {
  // Ook voor JS-aanroepers: zonder functie geen uitvoer, vóór de writer iets opbouwt.
  // @ts-expect-error De derde parameter is verplicht.
  await writeIfcMerge(d, source);
}, (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases[0].kind === 'open-stappen-ontbreken');

const saved = await tryMerge(d, source);
// E20: beproef de zuivere getalbewaking zelf, ook waar de writer-canon al eerder zou weigeren.
// De functie blijft privé in productcode: lees haar AST en voer precies die functie uit, geen kopie van de logica.
{
  const { createRequire } = await import('node:module');
  const ts = createRequire(import.meta.url)('typescript') as typeof import('typescript');
  const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../../src/services/ifc/foreign/mergeWriter.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('mergeWriter.ts', source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'unchangedPlanningNumberProblem')!;
  assert(fn, 'de bestaande private getalbewaking is gevonden');
  const code = ts.transpile(fn.getText(ast), { target: ts.ScriptTarget.ES2022 });
  const numberProblem = runInNewContext(`${code}; unchangedPlanningNumberProblem`) as
    (input: typeof opened, before: typeof opened, wanted: typeof opened, back: typeof opened) => string | undefined;
  const before = cloneDomain(opened);
  const row = (taskId: string, duration: number) => ({ taskId, duration, start: '2027-03-01T08:00:00', finish: '2027-03-02T16:00:00', isMilestone: false });
  before.baselines = [{ id: 'sleutelproef', name: 'Baseline', createdAt: '2027-01-01T12:00:00Z',
    projectEnd: '2027-03-02T16:00:00', projectDuration: 2,
    tasks: [row('eerste', 1), row('blijft', 2.3333333333333335), row('derde', 3), row('blijft', 4.000000000000001)] }];
  for (const reorder of [false, true]) {
    const input = structuredClone(before);
    input.baselines![0].tasks.shift();
    if (reorder) input.baselines![0].tasks.reverse();
    assert.equal(numberProblem(input, before, input, structuredClone(input)), undefined, 'ongewijzigde getallen komen exact terug na wissen/volgorde');
    const back = structuredClone(input);
    const target = back.baselines![0].tasks.find(t => t.taskId === 'derde')!;
    target.duration = 3.000000000000001;
    assert.match(numberProblem(input, before, input, back) ?? '', /task:derde.*duration/, 'een blijvend getal valt niet door positiekoppeling weg');
    // De twee voorkomens van hetzelfde taskId blijven afzonderlijk, in hun onderlinge volgorde.
    const duplicate = structuredClone(input);
    const duplicates = duplicate.baselines![0].tasks.filter(t => t.taskId === 'blijft');
    duplicates.at(-1)!.duration += 1e-12;
    if (!reorder) assert.match(numberProblem(input, before, input, duplicate) ?? '', /task:blijft,1.*duration/, 'dubbele taakregels vallen niet samen');
  }
  console.log('OK E20: baseline op taskId, eerste regel weg, andere volgorde en dubbele voorkomens');
}


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
  assert(merge.ok, merge.ok ? '' : JSON.stringify(merge.error.cases));
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

// 1109: de vier oorspronkelijke gevallen, plus werkelijk einde en 100%, houden de duur letterlijk in het bron-slot.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const base = readFileSync(join(root, 'tests/planning/fixtures/oude-tags/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc'), 'utf8');
  const { splitStepArgs } = await import('@/services/ifc/foreign/stepScanner');
  const { openInStore } = await import('./ifcAppRoute');
  let written = 0;
  for (const remaining of [2.3333333333333335, 1.2345678901234567]) {
    const line = base.split('\n').find(l => l.includes("IFCTASKTIME('Set up site Time'"))!;
    const args = splitStepArgs(line.slice(line.indexOf('(') + 1, line.lastIndexOf(')')));
    args[18] = `'P0Y0M${remaining}D'`;
    const raw = base.replace(line, line.slice(0, line.indexOf('(') + 1) + args.join(',') + ');');
    for (const edit of ['completion', 'actualStart', 'actualFinish', 'complete'] as const) {
      const { store, snapshot } = await openInStore(generatedModel(root, raw, 0));
      const task = store.getState().tasks.find(t => t.name === 'Set up site')!;
      const accepted = edit === 'completion' || edit === 'complete' ? store.getState().setTaskProgress(task.id, edit === 'complete' ? 1 : 0.5)
        : edit === 'actualStart' ? store.getState().setActualStart(task.id, task.time.scheduleStart)
        : store.getState().setActualFinish(task.id, task.time.scheduleFinish);
      assert(accepted);
      const input = cloneDomain(snapshot(store));
      const expected = (await shownAfterOpen(input)).tasks.find(t => t.id === task.id)!;
      assert.equal(expected.time.scheduleDuration, 2.3333333333333335);
      const r = await tryMerge(input, snapshot(store).ifcSource!);
      assert(r.ok, r.ok ? '' : JSON.stringify(r.error.cases));
      const full = await openForeign(r.bytes);
      const back = full.tasks.find(t => t.id === task.id)!;
      assert.equal(back.time.scheduleDuration, 2.3333333333333335);
      assert.equal(canon(await shownAfterOpen(input), reseed), canon(full, reseed));
      assert.equal(readbackDifference(r.shown, full), undefined, 'naad en volledige heropening exact gelijk');
      const text = new TextDecoder().decode(r.bytes);
      const tt = text.split('\n').find(l => l.includes("IFCTASKTIME('Set up site Time'"))!;
      assert.equal(splitStepArgs(tt.slice(tt.indexOf('(') + 1, tt.lastIndexOf(')')))[4], "'P0Y0M2.3333333333333335D'");
      written++;
    }
  }
  assert.equal(written, 8, 'alle acht schrijven met exact behouden duur');
  console.log('OK 1109: acht echte voortgangsacties schrijven met de precieze bronduur');
}

// 1109: een echte naamswijziging laat ook een niet-lege precieze rest letterlijk staan.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const raw = readFileSync(join(root, 'tests/planning/fixtures/oude-tags/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc'), 'utf8');
  const { openInStore } = await import('./ifcAppRoute');
  const { store, snapshot } = await openInStore(generatedModel(root, raw, 0));
  const before = snapshot(store);
  const task = before.tasks.find(t => t.name === 'Set up site')!;
  store.getState().updateTask(task.id, { name: 'Nieuwe naam voor precieze taak' });
  const input = cloneDomain(snapshot(store));
  assert.equal(input.tasks.find(t => t.id === task.id)!.time.remainingTime, 2.3333333333333335);
  const r = await tryMerge(input, before.ifcSource!);
  assert(r.ok, r.ok ? '' : JSON.stringify(r.error.cases));
  const full = await openForeign(r.bytes);
  assert.equal(full.tasks.find(t => t.id === task.id)!.time.remainingTime, 2.3333333333333335);
  const { splitStepArgs } = await import('@/services/ifc/foreign/stepScanner');
  const line = new TextDecoder().decode(r.bytes).split('\n').find(l => l.includes("IFCTASKTIME('Nieuwe naam voor precieze taak Time'"))!;
  assert.equal(splitStepArgs(line.slice(line.indexOf('(') + 1, line.lastIndexOf(')')))[18], "'P0Y0M2.3333333333333335D'", 'ook het restslot zelf houdt de bronwaarde');
  assert.equal(readbackDifference(r.shown, full), undefined);
  assert.equal(canon(await shownAfterOpen(input), reseed), canon(full, reseed));
  console.log('OK 1109: echte naamswijziging houdt de niet-lege precieze rest');
}

// Hele dagen hebben dezelfde bescherming nodig: voortgang mag alleen de rest wijzigen.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const { scanStep } = await import('@/services/ifc/foreign/stepScanner');
  for (const file of ['public/examples/10-villa-wassenaar.ifc',
    'tests/planning/fixtures/oude-tags/main-df9eafc7d-woongebouw-nieuwbouw.ifc']) {
    const raw = readFileSync(join(root, file), 'utf8');
    const bytes = generatedModel(root, raw, 0);
    const before = await openForeign(bytes);
    const task = before.tasks.find(t => t.childIds.length === 0 && !t.isMilestone)!;
    assert(Number.isInteger(task.time.scheduleDuration));
    const input = await applyEdit(ordinaryEdits(before).find(e => e.kind === 'voortgang')!, cloneDomain(before));
    assert.equal(input.tasks.find(t => t.id === task.id)!.time.scheduleDuration, task.time.scheduleDuration);
    const r = await tryMerge(input, before.ifcSource!);
    assert(r.ok, r.ok ? '' : JSON.stringify(r.error.cases));
    const durationToken = (bytes: Uint8Array) => {
      const ix = scanStep(bytes);
      const chunk = ix.chunkOf(String(before.ifcSource!.stepIds[`task:${task.id}`]));
      for (let k = 0; k < ix.argCount(chunk); k++) for (const time of ix.refsAt(chunk, k)) {
        if (ix.type(time) === 'IFCTASKTIME') return ix.argTokens(time)?.[4];
      }
      throw new Error('de taak heeft geen taaktijd');
    };
    assert.equal(durationToken(r.bytes), durationToken(bytes), 'de hele duur houdt letterlijk zijn bronvorm');
    const full = await openForeign(r.bytes);
    assert.equal(readbackDifference(r.shown, full), undefined);
    assert.equal(canon(await shownAfterOpen(input), reseed), canon(full, reseed));
  }
  console.log('OK 1109: voortgang op hele duren houdt het duurslot letterlijk');
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
  assert(r.ok, r.ok ? '' : JSON.stringify(r.error.cases));
  const full = await openForeign(r.bytes);
  assert.equal(full.sequences.find(s => s.id === seq.id)!.lagDays, seq.lagDays);
  assert.equal(full.sequences.find(s => s.id === seq.id)!.lagUnit, 'ELAPSEDTIME');
  assert(new TextDecoder().decode(r.bytes).includes("IFCDURATION('P2.3333333333333335D'),.ELAPSEDTIME."), 'de lag houdt letterlijk zijn brongetal');
  assert.equal(readbackDifference(r.shown, full), undefined);
  console.log('OK 1109: echte lag-eenheidswijziging schrijft met de precieze bronlag');
}

// 1116: de eerste echte bewerking wist de importvlag, zoals bij gewone opslag zonder model.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const raw = readFileSync(join(root, 'tests/planning/fixtures/ifc-arity-oude-writer.ifc'), 'utf8');
  const model = generatedModel(root, raw, 0);
  for (const kind of ['duur', 'doorrekenen', 'voortgang'] as const) {
    const initial = await openForeign(model);
    assert.equal(initial.importPristine, true);
    const input = await applyEdit(ordinaryEdits(initial).find(e => e.kind === kind)!, cloneDomain(initial));
    assert.equal(input.importPristine, undefined, `${kind}: echte actie wist de importvlag`);
    const r = await tryMerge(input, initial.ifcSource!);
    assert(r.ok, r.ok ? '' : JSON.stringify(r.error.cases));
    const full = await openForeign(r.bytes);
    assert.equal(readbackDifference(r.shown, full), undefined);
    assert.equal(canon(await shownAfterOpen(input), reseed), canon(full, reseed));
    const bare = await openForeign(new TextEncoder().encode(raw));
    const plainInput = await applyEdit(ordinaryEdits(bare).find(e => e.kind === kind)!, cloneDomain(bare));
    const plainText = writeIFC(plainInput);
    const plain = await openForeign(new TextEncoder().encode(plainText));
    for (const field of ['importPristine', 'recordedSourceFormat'] as const) {
      assert.equal(full[field], plain[field], `${kind}: dezelfde herkomst als gewone opslag`);
    }
    assert(!new TextDecoder().decode(r.bytes).includes("'UnchangedSinceImport'"));
    assert(!plainText.includes("'UnchangedSinceImport'"));
  }
  console.log('OK 1116: duur, duur met F5 en enterTaskProgress schrijven; herkomst gelijk aan gewone opslag');
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
