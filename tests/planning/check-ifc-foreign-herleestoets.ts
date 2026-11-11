// 1107: de open-stappen zijn verplicht en hun volledige uitkomst wordt getoetst.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedModel } from './ifcGeneratedModel';
import { storeWith } from './ifcAppRoute';
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
assert.equal(canon(await openForeign(saved.bytes), reseed), canon(saved.shown, reseed), 'naad = bytes-route');
// Gemaakte proef van Trias: alleen aan de uitvoerkant verandert een invoerveld vóór de echte herberekening.
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
assert.equal(canon(result.shown, reseed), canon(full, reseed));
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
assert.equal(canon(progressMerge.shown, reseed), canon(await openForeign(progressMerge.bytes), reseed));
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
    assert.equal(canon(merge.shown, reseed), canon(full, reseed));
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
    assert.equal(canon(r.shown, reseed), canon(full, reseed));
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
