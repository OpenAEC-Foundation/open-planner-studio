// #804 fase 1c PR 8a: één gecontroleerd schrijfresultaat, met de sessiekaart voor de volgende opslag.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { prepareIfcWrite, MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { classify } from '@/services/ifc/foreign/classify';
import { cloneDomain, concat, mergeProblems, openForeign, sameBytes, recalculated } from './ifcMergeKern';
import { openInStore, storeEdit, lengthen, lengthenedTask, TRIAS_FILES } from './ifcAppRoute';
import { generatedModel } from './ifcGeneratedModel';
import { installDeterminism } from './ifcPariteitKern';
import { readbackDifference } from './ifcReadbackEquality';
import { changedScopes, pristineDomain } from '@/services/ifc/foreign/lossCheck';
import { planningCanon, planningDifference } from '@/services/ifc/foreign/planningCanon';
import { sourceFormWhereUnchanged } from '@/services/ifc/foreign/sourceForm';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const reseed = installDeterminism();
const read = (name: string) => new Uint8Array(readFileSync(join(root, name)));
const withModel = (name: string) => generatedModel(root, readFileSync(join(root, name), 'latin1'), 0);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
let passed = 0, failed = 0;
async function check(label: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${label}`); }
  catch (error) { failed++; console.error(`XX ${label}`, error); }
}

async function sourceProof(result: PreparedIfcWrite, input: WriteIFCInput) {
  const bytes = concat(result.parts), source = result.source;
  assert.deepEqual(source.bytes, bytes);
  assert.equal(result.sha256, hash(bytes));
  assert.equal(source.sha256, result.sha256);
  assert(Object.isFrozen(source.opened));
  assert(Object.isFrozen(source.opened!.tasks));
  assert.deepEqual(source.opened, input, 'opened is de bevroren schrijfinvoer');
  const index = scanForeignStep(bytes), classified = classify(index);
  assert.deepEqual(source.classes, classified.classes, 'writerklassen = onafhankelijk ingedeelde uitvoer');
  assert.deepEqual(source.foreignMembers.map(c => source.chunkIds[c]), classified.foreignMembers.map(c => Number(index.id(c))));
  for (const task of input.tasks) {
    const step = source.stepIds[`task:${task.id}`];
    assert.equal(typeof step, 'number', `sessietaak ${task.id} heeft een uitvoer-id`);
    assert.equal(index.type(index.chunkOf(String(step))), 'IFCTASK');
  }
  const reopened = (await openForeign(bytes)).ifcSource!;
  assert.deepEqual(source.chunkStarts, reopened.chunkStarts);
  assert.deepEqual(source.chunkIds, reopened.chunkIds);
  assert.deepEqual(source.stepIds, reopened.stepIds, 'deze gevallen behouden de sessie-ids ook bij openen');
  assert.equal(source.schemaName, reopened.schemaName);
  assert.equal(source.foreign, reopened.foreign);
  assert.equal(source.foreignObjectCount, reopened.foreignObjectCount);
  assert.equal(source.lineEnding, reopened.lineEnding);
  assert(result.parts.every(part => part.buffer === source.bytes.buffer), 'delen houden alleen de nieuwe bronbuffer vast');
}

for (const [label, bytes] of [
  ['kantoor', withModel('public/examples/03-kantoorgebouw-zuidas.ifc')],
  ['eigen-plus-model', read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')],
  ['oude-villa', withModel(TRIAS_FILES[3])],
] as const) {
  await check(`${label}: drie saves met de nieuwe bron = heropenen, vreemd deel blijft bytegelijk`, async () => {
    const initial = await openForeign(bytes);
    let source = initial.ifcSource!, input = cloneDomain(initial), previous = bytes;
    let newId = '';
    for (let step = 0; step < 3; step++) {
      const reopened = await openForeign(previous);
      const edit = async (d: WriteIFCInput, replayId?: string) => {
        const changed = step === 0 ? await lengthen(d, lengthenedTask(d).id)
          : step === 1 ? await storeEdit(d, state => {
            const made = state.addTask({ name: 'Nieuwe taak PR 8a' }, { phaseAssignments: 'move', answered: true });
            // Twee appcontexten hebben een oplopende id-teller. Alleen de ene nieuwe,
            // ongerelateerde worteltaak krijgt voor de replay dezelfde sessie-identiteit.
            if (replayId) state.updateTask(made, { id: replayId });
          }) : await storeEdit(d, state => { state.deleteTask(newId); });
        return recalculated(changed); // Voor iedere opslag F5, dus geen vergelijking met verouderde datums.
      };
      reseed(0x8a + step);
      input = await edit(input);
      if (step === 1) newId = input.tasks.find(t => t.name === 'Nieuwe taak PR 8a')!.id;
      const frozenBefore = structuredClone(input);
      const result = await prepareIfcWrite(input, source);
      await sourceProof(result, frozenBefore);
      assert.deepEqual(mergeProblems(bytes, result.source.bytes), []);
      reseed(0x8a + step);
      const inputReopen = await edit(cloneDomain(reopened), step === 1 ? newId : undefined);
      const viaReopen = await prepareIfcWrite(inputReopen, reopened.ifcSource!);
      const left = new TextDecoder().decode(concat(result.parts)).split('\n');
      const right = new TextDecoder().decode(concat(viaReopen.parts)).split('\n');
      const at = left.findIndex((line, i) => line !== right[i]);
      assert(sameBytes(concat(result.parts), concat(viaReopen.parts)), `${label}, stap ${step}: ${left[at]} != ${right[at]}; invoer: ${readbackDifference(input, inputReopen)}`);
      source = result.source;
      previous = source.bytes;
      assert.deepEqual(input, frozenBefore, 'de aanroeper is niet gewijzigd');
      // Het verbruik van deze metadata is de afspraak voor 8b; de writer muteert de invoer niet.
      input = { ...input, ifcLiteralCalendarIds: [...new Set([...(input.ifcLiteralCalendarIds ?? []), ...result.literalCalendarIds])] };
    }
  });
  await check(`${label}: zonder bewerking zijn bytes en bron dezelfde`, async () => {
    const opened = await openForeign(bytes);
    const result = await prepareIfcWrite(cloneDomain(opened), opened.ifcSource!);
    assert.strictEqual(result.source, opened.ifcSource);
    assert.deepEqual(concat(result.parts), bytes);
    assert.equal(result.sha256, hash(bytes));
  });
}

await check('7b met 8a: vier echte resource-/kalenderhandelingen schrijven; zonder wijziging bronbytes', async () => {
  const bytes = read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
  const { store, snapshot } = await openInStore(bytes), state = () => store.getState();
  let source = snapshot(store).ifcSource!;
  const unchanged = async () => {
    const original = cloneDomain(snapshot(store));
    const index = scanForeignStep(source.bytes), pristine = await pristineDomain(index, classify(index), source);
    const basis = sourceFormWhereUnchanged(original, source.opened, pristine);
    for (const mode of ['merge', 'planOnly'] as const) {
      const input = { ...original, writeMode: mode };
      assert.equal(changedScopes(input, original).keys.size, 0, `${mode}: alleen modus is geen scopewijziging`);
      assert.equal(planningCanon(input), planningCanon(original), `${mode}: dezelfde canon`);
      assert.equal(planningDifference(input, original), planningDifference(original, original), `${mode}: dezelfde verschilomschrijving`);
      assert.equal(readbackDifference(input, original), undefined, `${mode}: dezelfde herlezen planning`);
      const form = sourceFormWhereUnchanged(input, source.opened, pristine);
      assert.deepEqual(form.checked, basis.checked, `${mode}: dezelfde bronvormcontrole`);
      assert.equal(changedScopes(form.input, basis.input).keys.size, 0, `${mode}: dezelfde planning in bronvorm`);
      const result = await prepareIfcWrite(input, source);
      assert(result.source === source, `${mode}: zonder wijziging blijft de bron dezelfde`);
      assert.equal(result.parts.length, 1);
      assert(result.parts[0] === source.bytes, `${mode}: zonder wijziging zijn het letterlijk de bronbytes`);
      console.log(`OK E27 ${mode}: scopes/canon/bronvorm gelijk en letterlijke bronretour`);
    }
  };
  const save = async (label: string, verify: (actual: WriteIFCInput, input: WriteIFCInput) => void) => {
    const input = cloneDomain(snapshot(store)), before = source;
    const result = await prepareIfcWrite(input, before), written = concat(result.parts);
    const otherMode = { ...input, writeMode: 'planOnly' as const };
    const alternative = await prepareIfcWrite(otherMode, before);
    assert.equal(alternative.sha256, result.sha256, `${label}: alleen modus verandert de uitvoerhash niet`);
    assert(sameBytes(concat(alternative.parts), written), `${label}: alleen modus geeft dezelfde bytes, zonder weigering`);
    const afterAlternative = await prepareIfcWrite(input, alternative.source);
    assert(afterAlternative.source === alternative.source, `${label}: planOnly-bron en merge-invoer blijven ongewijzigd`);
    assert(afterAlternative.parts[0] === alternative.source.bytes, `${label}: ook andersom letterlijke bronretour`);
    console.log(`OK E27 ${label}: merge/planOnly bytegelijk, daarna dezelfde bron in beide richtingen`);
    assert.notStrictEqual(result.source, before, `${label}: nieuwe bron, geen snelle bronretour`);
    assert(!sameBytes(written, before.bytes), `${label}: gewijzigde bytes`);
    assert.deepEqual(result.source.opened, input, `${label}: de schrijfmomentopname draagt de wijziging`);
    assert.deepEqual(mergeProblems(bytes, written), [], `${label}: vreemd deel bytegelijk`);
    const reopened = await openForeign(written);
    verify(reopened, input);
    assert(![...changedScopes(input, reopened, before.opened).keys].some(k => /^(res|cal):|^order:(res|cal)$/.test(k)),
      `${label}: andere interne ids zijn geen resource- of kalenderbewerking`);
    source = result.source;
    await unchanged();
    console.log(`OK 7b/8a ${label}: wijziging heropend; daarna letterlijke bronretour`);
  };
  await unchanged();
  const resource = state().addResource({ name: 'Nieuwe resource prepare 7b', type: 'EQUIPMENT', description: 'Eerste voorbereiding', maxUnits: 2, costPerHour: 37.5 });
  await save('resource toevoegen', actual => {
    const added = actual.resources.find(r => r.name === 'Nieuwe resource prepare 7b')!;
    assert(added); assert.equal(added.description, 'Eerste voorbereiding');
    assert.equal(added.maxUnits, 2); assert.equal(added.costPerHour, 37.5);
  });
  const { id: _id, ...calendar } = structuredClone(state().calendar);
  const calendarId = state().addCalendar({ ...calendar, name: 'Nieuwe kalender prepare 7b' });
  await save('kalender toevoegen', (actual, input) => {
    const added = actual.resourceCalendars!.find(c => c.name === 'Nieuwe kalender prepare 7b')!;
    assert(added);
    assert.deepEqual({ ...added, id: calendarId }, input.resourceCalendars!.find(c => c.id === calendarId), 'alle kalenderwaarden, alleen intern id anders');
  });
  assert.notEqual(state().resources.find(r => r.id === resource)!.calendarId ?? state().calendar.id, calendarId);
  state().updateResource(resource, { calendarId });
  await save('resource kiest andere kalender', actual => {
    const added = actual.resourceCalendars!.find(c => c.name === 'Nieuwe kalender prepare 7b')!;
    assert.equal(actual.resources.find(r => r.name === 'Nieuwe resource prepare 7b')!.calendarId, added.id);
  });
  const assignment = structuredClone(state().assignments[0]);
  state().unassignResource(assignment.id);
  state().assignResource(assignment.taskId, resource, assignment.unitsPerDay);
  assert(!state().assignments.some(a => a.id === assignment.id));
  assert(state().assignments.some(a => a.taskId === assignment.taskId && a.resourceId === resource));
  await save('toewijzing naar andere resource', actual => {
    const added = actual.resources.find(r => r.name === 'Nieuwe resource prepare 7b')!;
    assert(actual.assignments.some(a => a.taskId === assignment.taskId && a.resourceId === added.id && a.unitsPerDay === assignment.unitsPerDay));
    assert(!actual.assignments.some(a => a.taskId === assignment.taskId && a.resourceId === assignment.resourceId));
    assert(actual.tasks.find(t => t.id === assignment.taskId)!.resourceIds.includes(added.id));
  });
});

await check('losse kalender en baseline: eerste voorbereiding schrijft, tweede geeft de bronbytes', async () => {
  for (const kind of ['kalender', 'baseline'] as const) {
    const { store, snapshot } = await openInStore(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
    const source = snapshot(store).ifcSource!;
    if (kind === 'kalender') {
      const { id: _id, ...calendar } = structuredClone(store.getState().calendar);
      store.getState().addCalendar({ ...calendar, name: 'Losse kalender herhaald opslaan' });
    } else store.getState().saveBaseline('Baseline herhaald opslaan');
    const input = cloneDomain(snapshot(store)), first = await prepareIfcWrite(input, source);
    assert.notStrictEqual(first.source, source);
    assert(!sameBytes(concat(first.parts), source.bytes));
    const reopened = await openForeign(concat(first.parts));
    if (kind === 'kalender') {
      const expected = input.resourceCalendars!.find(c => c.name === 'Losse kalender herhaald opslaan')!;
      const actual = reopened.resourceCalendars!.find(c => c.name === expected.name)!;
      assert(actual); assert.deepEqual({ ...actual, id: expected.id }, expected);
    } else assert.deepEqual(reopened.baselines, input.baselines);
    const second = await prepareIfcWrite(cloneDomain(snapshot(store)), first.source);
    assert.strictEqual(second.source, first.source);
    assert.strictEqual(second.parts[0], first.source.bytes);
    assert.deepEqual(mergeProblems(source.bytes, concat(second.parts)), []);
    console.log(`OK fix2 ${kind}: toevoegen/vastleggen → voorbereiden → zonder wijziging bronbytes`);
  }
});

await check('getalcontrole: vier verliezen op nieuwe objecten weigeren zonder bytes', async () => {
  const { store, snapshot } = await openInStore(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
  const state = () => store.getState();
  state().addResource({ name: 'Getalproef A', type: 'EQUIPMENT', description: '', maxUnits: 2, costPerHour: 37.5 });
  state().addResource({ name: 'Getalproef B', type: 'EQUIPMENT', description: '', maxUnits: 3, costPerHour: 12.75 });
  const { id: _id, ...calendar } = structuredClone(state().calendar);
  state().addCalendar({ ...calendar, name: 'Getalproef kalender' });
  const input = cloneDomain(snapshot(store)), first = await prepareIfcWrite(input, snapshot(store).ifcSource!);
  const losses: [string, (shown: WriteIFCInput) => void][] = [
    ['maxUnits anders', p => { p.resources.find(r => r.name === 'Getalproef A')!.maxUnits += 1e-12; }],
    ['tarieven verwisseld', p => {
      const a = p.resources.find(r => r.name === 'Getalproef A')!, b = p.resources.find(r => r.name === 'Getalproef B')!;
      [a.costPerHour, b.costPerHour] = [b.costPerHour, a.costPerHour];
    }],
    ['werktijd anders', p => { p.resourceCalendars!.find(c => c.name === 'Getalproef kalender')!.workStartHour += 1e-9; }],
    ['resource verdwenen', p => { p.resources = p.resources.filter(r => r.name !== 'Getalproef A'); }],
  ];
  for (const [label, mutate] of losses) {
    for (const mode of ['merge', 'planOnly'] as const) {
      const modeInput = { ...input, writeMode: mode };
      await assert.rejects(() => prepareIfcWrite(modeInput, first.source, async (parsed, side) => {
        const shown = structuredClone(parsed);
        if (side === 'uitvoer') mutate(shown);
        return shown;
      }), (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'ongewijzigd-getal'), `${label}, ${mode}: geen bytes`);
    }
    console.log(`OK fix2 getalverlies ${label}: ongewijzigd-getal, geen bytes`);
  }
});

await check('vreemde herkomst: niets wijzigen bewaart de bron; wijzigen blijft veilig geweigerd', async () => {
  const bytes = read('tests/fixtures/ifc-foreign/bonsai-4d.ifc');
  const opened = await openForeign(bytes), input = cloneDomain(opened);
  const result = await prepareIfcWrite(input, opened.ifcSource!);
  assert.strictEqual(result.source, opened.ifcSource);
  assert.deepEqual(concat(result.parts), bytes);
  const edited = await storeEdit(input, state => { state.setProject({ name: 'Bewerkt' }); });
  await assert.rejects(prepareIfcWrite(edited, opened.ifcSource!), (e: unknown) => e instanceof MergeNeedsPhase2Error
    && e.cases.some(c => c.kind === 'vreemde-herkomst'));
});

await check('bewerking en undo: de oorspronkelijke bytes terug', async () => {
  const bytes = read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
  const { store, snapshot } = await openInStore(bytes);
  const task = lengthenedTask(snapshot(store));
  store.getState().updateTask(task.id, { name: 'Tijdelijk' });
  store.getState().undo();
  const opened = snapshot(store), result = await prepareIfcWrite(cloneDomain(opened), opened.ifcSource!);
  assert.strictEqual(result.source, opened.ifcSource);
  assert.deepEqual(concat(result.parts), bytes);
});

await check('stuk 1 doorloopt dezelfde vaste uitvoercontrole', async () => {
  const opened = await openForeign(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
  await assert.rejects(prepareIfcWrite(cloneDomain(opened), opened.ifcSource!, async input => input),
    (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'open-stappen-ontbreken'));
});

await check('E13: nieuwe uurtaak maakt kalender letterlijk; wissen met het resultaat houdt dat vast', async () => {
  const opened = await openForeign(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
  const before = cloneDomain(opened), cal = before.calendar.id;
  assert(!before.ifcLiteralCalendarIds?.includes(cal), 'de bronkalender was nog niet letterlijk');
  let added = '';
  const input = await storeEdit(before, state => {
    const time = { ...lengthenedTask(before).time, durationUnit: 'hours' as const, durationMinutes: 60, scheduleDuration: 0.125 };
    added = state.addTask({ name: 'Uurtaak voor letterlijke kalender', time }, { phaseAssignments: 'move', answered: true });
  });
  assert(added);
  const first = await prepareIfcWrite(input, opened.ifcSource!);
  assert(first.literalCalendarIds.includes(cal));
  const carried = { ...input, ifcLiteralCalendarIds: [...new Set([...(input.ifcLiteralCalendarIds ?? []), ...first.literalCalendarIds])] };
  const deleted = await storeEdit(carried, state => { state.deleteTask(added); });
  const second = await prepareIfcWrite(deleted, first.source);
  assert(second.literalCalendarIds.includes(cal));
  const reopened = await openForeign(concat(second.parts));
  assert(reopened.ifcLiteralCalendarIds?.includes(cal));
  assert(new TextDecoder().decode(second.source.bytes).includes("'LiteralTimes',$,IFCBOOLEAN(.T.)"));
});

await check('de nieuwe bron houdt de schrijfmomentopname vast bij later doorwerken', async () => {
  const opened = await openForeign(read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
  const input = await lengthen(cloneDomain(opened), lengthenedTask(opened).id);
  const before = structuredClone(input);
  const result = await prepareIfcWrite(input, opened.ifcSource!);
  input.tasks[0].name = 'Latere bewerking';
  assert.deepEqual(result.source.opened, before);
  assert.notStrictEqual(result.source.opened, input);
  assert(Object.isFrozen(result.source.opened!.tasks[0]));
});

await check('zonder vreemd deel: gewone writer met en zonder bewerking, ook op oud bestand', async () => {
  for (const file of ['public/examples/03-kantoorgebouw-zuidas.ifc', TRIAS_FILES[3]]) {
    const bytes = read(file), opened = await openForeign(bytes);
    assert.equal(opened.ifcSource!.foreign, false);
    for (const input of [cloneDomain(opened), await lengthen(cloneDomain(opened), lengthenedTask(opened).id)]) {
      const result = await prepareIfcWrite(input, opened.ifcSource!);
      assert.deepEqual(concat(result.parts), new TextEncoder().encode(writeIFC(input)));
      assert.notStrictEqual(result.source, opened.ifcSource);
      await sourceProof(result, input);
    }
  }
});

console.log(`Voorbereid schrijfresultaat: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
