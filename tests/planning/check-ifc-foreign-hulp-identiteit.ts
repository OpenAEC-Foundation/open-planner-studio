// #804 fase 1c, E16: bronidentiteit van gekoppelde hulpregels; de gewone writer blijft gelijk.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ifcGuid128, ifcObjectSeed, writeIFC, writeIfcMergeLines } from '@/services/ifc/ifcWriter';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import { sourceFormProblems } from '@/services/ifc/foreign/sourceForm';
import { classify } from '@/services/ifc/foreign/classify';
import { preserveAuxiliaryIdentities, pristineDomain, replaceRefsOutsideText, parseOutLine, type LossCheckInput } from '@/services/ifc/foreign/lossCheck';
import { mergeIdPlan, MergeNeedsPhase2Error, writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { MAX_STEP_ID } from '@/services/ifc/foreign/stepScanner';
import { psetOwners, validateMergeOutput } from '@/services/ifc/foreign/mergeValidation';
import { openInStore, TRIAS_FILES } from './ifcAppRoute';
import { generatedModel } from './ifcGeneratedModel';
import { installDeterminism } from './ifcPariteitKern';
import { applyEdit, cloneDomain, concat, mergeProblems, newObjectEdits, openForeign, ordinaryEdits, tryMerge, type Domain } from './ifcMergeKern';
import { readbackDifference } from './ifcReadbackEquality';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const reseed = installDeterminism();
const failures: string[] = [];
const check = (message: string, yes: boolean) => { if (!yes) failures.push(message); };
const read = (rel: string) => new Uint8Array(readFileSync(join(root, rel)));
const model = (text: string) => generatedModel(root, text, 0);
const basis = read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');

// Fixronde 1: een dubbel GlobalId mag twee verschillende koppelingen niet gelijk maken.
{
  const opened = await openInStore(basis), base = cloneDomain(opened.snapshot(opened.store));
  const a = structuredClone(base), guid = ifcGuid128('review-924-collision');
  a.resources = [{ ...a.resources[0], id: 'review-a', name: 'Kraan A', costPerHour: 10 },
    { ...a.resources[0], id: 'review-b', name: 'Kraan B', costPerHour: 20 }];
  a.ifcGlobalIds = { ...a.ifcGlobalIds, [ifcObjectSeed('res', 'review-a')]: guid, [ifcObjectSeed('res', 'review-b')]: guid };
  a.assignments = [{ ...a.assignments[0], resourceId: 'review-a' }];
  const assigned = (p: Domain, id: string) => {
    p.assignments[0].resourceId = id;
    p.tasks = p.tasks.map(t => ({ ...t, resourceIds: t.id === p.assignments[0].taskId ? [id] : [] }));
  };
  assigned(a, 'review-a');
  const b = structuredClone(a); assigned(b, 'review-b');
  check('fix1 a: twee resources met dezelfde GlobalId houden verschillende toewijzingen', planningCanon(a) !== planningCanon(b));
  const c = structuredClone(a), d = structuredClone(b), canonical = `res-ifc-${guid}`;
  for (const p of [c, d]) {
    p.resources[0].id = canonical;
    p.ifcGlobalIds = { ...p.ifcGlobalIds, [ifcObjectSeed('res', canonical)]: guid };
  }
  assigned(c, canonical);
  check('fix1 b: een bestaand canoniek id en een nieuwe resource blijven onderscheiden', planningCanon(c) !== planningCanon(d));
  const e = structuredClone(base), calendarGuid = ifcGuid128('review-924-calendar-collision');
  e.resourceCalendars = [...(e.resourceCalendars ?? []),
    { ...structuredClone(e.calendar), id: 'review-cal-a', name: 'Ochtend', workStartHour: 7 },
    { ...structuredClone(e.calendar), id: 'review-cal-b', name: 'Middag', workStartHour: 9 }];
  e.ifcGlobalIds = { ...e.ifcGlobalIds, [ifcObjectSeed('cal', 'review-cal-a')]: calendarGuid, [ifcObjectSeed('cal', 'review-cal-b')]: calendarGuid };
  e.resources[0].calendarId = 'review-cal-a';
  const f = structuredClone(e); f.resources[0].calendarId = 'review-cal-b';
  check('fix1 c: twee kalenders met dezelfde doelidentiteit houden verschillende resourcekoppelingen', planningCanon(e) !== planningCanon(f));
}

function resourceHelpers(bytes: Uint8Array) {
  const index = scanForeignStep(bytes), result = new Map<string, { pset: string; relation: string; psetId: string; relationId: string }>();
  for (let c = 0; c < index.count; c++) {
    if (index.type(c) !== 'IFCPROPERTYSET' || index.name(c) !== 'OPS_Resource') continue;
    const owner = psetOwners(index, c)[0];
    let relation = -1;
    for (let k = index.inStart(c); k < index.inEnd(c); k++) if (index.type(index.inSource(k)) === 'IFCRELDEFINESBYPROPERTIES') relation = index.inSource(k);
    if (owner !== undefined && relation >= 0) result.set(index.globalId(owner), { pset: index.globalId(c), relation: index.globalId(relation), psetId: index.id(c), relationId: index.id(relation) });
  }
  return result;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const rootGuids = (bytes: Uint8Array) => {
  const index = scanForeignStep(bytes), result = new Set<string>();
  for (let c = 0; c < index.count; c++) {
    const a = index.argTokens(c);
    if (a && a.length >= 5 && /^'[0-9A-Za-z_$]{22}'$/.test(a[0]) && /^#\d+$/.test(a[1])) result.add(index.globalId(c));
  }
  return result;
};

// Direct na toevoegen opslaan als merge: geen gewone opslag als tussenstap (1147).
const fresh = await openInStore(basis);
fresh.store.getState().addResource({ name: 'Nieuwe kraan E16', type: 'EQUIPMENT', description: '', maxUnits: 1 });
const input = cloneDomain(fresh.snapshot(fresh.store));
const born = new TextEncoder().encode(writeIFC(input));
const one = await tryMerge(input, fresh.snapshot(fresh.store).ifcSource!);
assert(one.ok, one.ok ? '' : JSON.stringify(one.error.cases));
const next = await openForeign(one.bytes), two = await tryMerge(cloneDomain(next), next.ifcSource!);
assert(two.ok, two.ok ? '' : JSON.stringify(two.error.cases));
const original = resourceHelpers(basis), first = resourceHelpers(one.bytes), second = resourceHelpers(two.bytes);
for (const [id, expected] of original) {
  check(`E16 resource ${id}: pset en relatie houden bron-GlobalId en bron-id`, same(first.get(id), expected));
}
for (const [id, expected] of first) check(`E16 resource ${id}: na openen en tweede merge dezelfde identiteit`, same(second.get(id), expected));
assert.equal(first.size, input.resources.length);
check('E16: C/A/V zijn na beide merges bytegelijk', !mergeProblems(basis, one.bytes).length && !mergeProblems(one.bytes, two.bytes).length);
console.log(`E16 resource: ${first.size} resources, toevoegen → merge → openen → merge`);

// De meting van 1023: het repo-voorbeeld is met verse resource-ids geschreven; de lezer
// leidt die bij openen uit hun GlobalId af. Main verliest hier 36 hulp-GlobalIds.
const office = model(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc'), 'utf8'));
const officeDomain = await openForeign(office), officeSave = await tryMerge(cloneDomain(officeDomain), officeDomain.ifcSource!);
assert(officeSave.ok, officeSave.ok ? '' : JSON.stringify(officeSave.error.cases));
const before = rootGuids(office), after = rootGuids(officeSave.bytes);
const added = [...after].filter(guid => !before.has(guid));
check(`E16 kantoor: geen nieuwe hulp-GlobalIds (${added.length})`, added.length === 0);
check('E16 kantoor: vreemde bytes intact', !mergeProblems(office, officeSave.bytes).length);
console.log(`E16 kantoor: ${before.size} GlobalIds, ${added.length} nieuw`);

// Eén echt oud eigen bestand; de uitgebreide toets blijft daarnaast tien van tien.
const old = model(readFileSync(join(root, TRIAS_FILES[2]), 'utf8'));
const oldDomain = await openForeign(old), oldSave = await tryMerge(cloneDomain(oldDomain), oldDomain.ifcSource!);
assert(oldSave.ok, oldSave.ok ? '' : JSON.stringify(oldSave.error.cases));
const oldIndex = scanForeignStep(old), oldClass = classify(oldIndex), oldOut = scanForeignStep(oldSave.bytes);
let kept = 0, expectedOld = 0;
for (let c = 0; c < oldIndex.count; c++) {
  const a = oldIndex.argTokens(c);
  if (oldClass.classes[c] !== 1 || oldClass.selection.inD[c] || !a || a.length < 5 || !/^'[0-9A-Za-z_$]{22}'$/.test(a[0]) || !/^#\d+$/.test(a[1])) continue;
  expectedOld++;
  const out = oldOut.chunkOf(oldIndex.id(c));
  if (out >= 0 && oldIndex.globalId(c) === oldOut.globalId(out)) kept++;
}
check(`E16 oud eigen: alle ${expectedOld} hulp-GlobalIds met hetzelfde bron-id`, expectedOld > 0 && kept === expectedOld);
check('E16 oud eigen: vreemde bytes intact', !mergeProblems(old, oldSave.bytes).length);
console.log(`E16 oud eigen: ${kept} hulp-GlobalIds met hetzelfde bron-id`);

// 7b: de drie echte handelingen op beide bronnen; de kalender ook zonder gebruiker.
for (const [label, bytes] of [['eigen', basis], ['kantoor', office]] as const) {
  for (const kind of ['resource-erbij', 'kalender-los', 'kalender-erbij', 'baseline-vastleggen'] as const) {
    const { store, snapshot } = await openInStore(bytes);
    const before = snapshot(store), initial = cloneDomain(before);
    let input: Domain;
    if (kind === 'kalender-los') {
      const { id: _id, ...calendar } = structuredClone(initial.calendar);
      store.getState().addCalendar({ ...calendar, name: 'Nieuwe losse kalender 1c' });
      input = cloneDomain(snapshot(store));
    } else input = await applyEdit(newObjectEdits(initial).find(e => e.kind === kind)!, initial);
    const saved = await tryMerge(input, before.ifcSource!);
    check(`${label} ${kind}: eerste opslag schrijft`, saved.ok);
    if (!saved.ok) { console.error(label, kind, saved.error.cases); continue; }
    const reopened = await openForeign(saved.bytes);
    const again = await tryMerge(cloneDomain(reopened), reopened.ifcSource!);
    check(`${label} ${kind}: tweede opslag schrijft`, again.ok);
    if (!again.ok) continue;
    const twice = await openForeign(again.bytes);
    check(`${label} ${kind}: C/A/V beide keren bytegelijk`, !mergeProblems(bytes, saved.bytes).length && !mergeProblems(saved.bytes, again.bytes).length);
    assert.equal(readbackDifference(reopened, twice), undefined, `${label} ${kind}: twee volledige heropeningen gelijk`);
    if (kind === 'resource-erbij') {
      const first = resourceHelpers(saved.bytes), second = resourceHelpers(again.bytes);
      assert.equal(first.size, input.resources.length);
      assert.deepEqual(second, first, `${label}: ook de nieuwe resource houdt pset-/relatie-identiteit`);
    } else if (kind.startsWith('kalender')) {
      const added = input.resourceCalendars!.find(c => !before.resourceCalendars!.some(old => old.id === c.id))!;
      const actual = reopened.resourceCalendars!.find(c => c.name === added.name)!;
      assert(actual, 'de toegevoegde kalender is na volledig heropenen aanwezig');
      assert.equal(readbackDifference({ ...input, resourceCalendars: [{ ...added, id: 'vergelijk-kalender' }] },
        { ...input, resourceCalendars: [{ ...actual, id: 'vergelijk-kalender' }] }), undefined, 'alle kalenderinhoud exact, alleen intern id anders');
      if (kind === 'kalender-erbij') {
        const owner = input.resources.find(r => r.calendarId === added.id)!;
        assert.equal(reopened.resources.find(r => r.name === owner.name)!.calendarId, actual.id, 'de verwijzing blijft bij dezelfde kalender');
      }
    } else assert.deepEqual(reopened.baselines, input.baselines, 'baseline met exact dezelfde rijen na volledig heropenen');
    console.log(`OK 7b ${label} ${kind}: eerste merge → openen → tweede merge, C/A/V bytegelijk`);
  }
}

// 1552: dezelfde identiteit in de bronvormcontrole, met alle kalenderwaarden nog exact.
for (const file of [
  'b5-lopend-oude-writer.ifc', 'oude-tags/v2026.7.7-urentaak-10-villa-wassenaar.ifc',
  'oude-tags/v2026.9.0-urentaak-10-villa-wassenaar.ifc', 'urenperdag-oude-writer.ifc',
  'vast-werk-oude-writer.ifc', 'werkdag-einde-main-bibliotheek.ifc',
]) {
  const bytes = model(readFileSync(join(root, 'tests/planning/fixtures', file), 'utf8'));
  const { store, snapshot } = await openInStore(bytes), before = snapshot(store), base = cloneDomain(before);
  const input = await applyEdit(newObjectEdits(base).find(e => e.kind === 'kalender-erbij')!, base);
  const added = input.resourceCalendars!.find(c => !base.resourceCalendars!.some(old => old.id === c.id))!;
  const first = await tryMerge(input, before.ifcSource!);
  assert(first.ok, `${file}: ${first.ok ? '' : JSON.stringify(first.error.cases)}`);
  const opened = await openForeign(first.bytes), second = await tryMerge(cloneDomain(opened), opened.ifcSource!);
  assert(second.ok, `${file}: tweede merge schrijft`);
  const twice = await openForeign(second.bytes), actual = opened.resourceCalendars!.find(c => c.name === added.name)!;
  assert(actual, `${file}: nieuwe kalender aanwezig na volledig heropenen`);
  assert.equal(readbackDifference({ ...input, resourceCalendars: [{ ...added, id: 'kalender' }] },
    { ...input, resourceCalendars: [{ ...actual, id: 'kalender' }] }), undefined, `${file}: alle kalenderinhoud exact`);
  assert.equal(readbackDifference(opened, twice), undefined, `${file}: twee volledige heropeningen gelijk`);
  assert.equal(mergeProblems(bytes, first.bytes).length, 0, `${file}: vreemde bytes eerste opslag`);
  assert.equal(mergeProblems(first.bytes, second.bytes).length, 0, `${file}: vreemde bytes tweede opslag`);
  const leaf = [{ kind: 'calendar' as const, id: added.id }];
  assert.deepEqual(sourceFormProblems(leaf, input, opened), [], `${file}: gedeelde identiteit vindt dezelfde kalender`);
  const wrong = structuredClone(opened);
  wrong.resourceCalendars!.find(c => c.id === actual.id)!.workStartHour += 1e-9;
  assert(sourceFormProblems(leaf, input, wrong).length > 0, `${file}: bronvormcontrole blijft exact op werktijd`);
  await assert.rejects(() => writeIfcMerge(input, before.ifcSource!, async (parsed, side) => {
    const shown = structuredClone(parsed);
    if (side === 'uitvoer') shown.resourceCalendars!.find(c => c.name === added.name)!.workStartHour += 1e-9;
    return shown;
  }), (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'planning-na-openen'),
  `${file}: andere werktijd na heropenen geeft getypeerde weigering zonder bytes`);
  console.log(`OK fix1 1552 ${file}: twee merges, kalender exact, C/A/V bytegelijk, werktijdverlies geweigerd`);
}

// Zes verliesproeven op de echte heropening: identiteitsprojectie mag inhoud en koppelingen nooit maskeren.
{
  const { store, snapshot } = await openInStore(basis), state = () => store.getState();
  const resourceIds = state().resources.slice(0, 2).map(r => r.id);
  const { id: _id, ...calendar } = structuredClone(state().calendar);
  const a = state().addCalendar({ ...calendar, name: 'Verliesproef A' });
  const b = state().addCalendar({ ...calendar, name: 'Verliesproef B' });
  state().updateResource(resourceIds[0], { calendarId: a });
  state().updateResource(resourceIds[1], { calendarId: b });
  state().addResource({ name: 'Nieuwe verliesproefresource', type: 'EQUIPMENT', description: 'Niet verliezen', maxUnits: 2, costPerHour: 37.5 });
  state().saveBaseline('Baseline verliesproef');
  const rich = snapshot(store), input = cloneDomain(rich);
  assert((await tryMerge(input, rich.ifcSource!)).ok, 'de combinatie schrijft zonder foutnabootsing');
  const mutations: [string, (shown: Domain) => void][] = [
    ['a kalenderkoppelingen verwisseld', p => {
      const first = p.resources.find(r => r.id === resourceIds[0])!, second = p.resources.find(r => r.id === resourceIds[1])!;
      [first.calendarId, second.calendarId] = [second.calendarId, first.calendarId];
    }],
    ['b resource-psetwaarde weg', p => { delete p.resources.find(r => r.name === 'Nieuwe verliesproefresource')!.costPerHour; }],
    ['c werktijd anders', p => { p.resourceCalendars!.find(c => c.name === 'Verliesproef A')!.workStartHour += 1e-9; }],
    ['d toewijzing op andere resource', p => {
      p.assignments[0].resourceId = p.resources.find(r => r.id !== p.assignments[0].resourceId)!.id;
    }],
    ['e ander projectveld bij baselinehandeling', p => { p.project.wbsAutoNumber = !p.project.wbsAutoNumber; }],
    ['f resource verdwenen', p => { p.resources = p.resources.filter(r => r.name !== 'Nieuwe verliesproefresource'); }],
  ];
  for (const [label, mutate] of mutations) {
    await assert.rejects(() => writeIfcMerge(input, rich.ifcSource!, async (parsed, side) => {
      const shown = structuredClone(parsed);
      if (side === 'uitvoer') mutate(shown);
      return shown;
    }), (e: unknown) => e instanceof MergeNeedsPhase2Error && e.cases.some(c => c.kind === 'planning-na-openen'), `${label}: getypeerd geweigerd, geen bytes`);
    console.log(`OK 7b verlies ${label}: getypeerde weigering zonder bytes`);
  }
}

// Twee uitvoerrelaties/psets met dezelfde eigenaar en naam: de bestaande koppeling
// markeert dit dubbelzinnig. Geen van beide mag willekeurig de bron-GlobalId krijgen.
const idx = scanForeignStep(office), cls = classify(idx), source = officeDomain.ifcSource!;
const plan = mergeIdPlan(idx, cls, source.stepIds, officeDomain.calendar.id, office);
const raw = writeIfcMergeLines(cloneDomain(officeDomain), plan.plan);
const lines = raw.lines.map(text => parseOutLine(text)!);
const pset = lines.find(l => l.type === 'IFCPROPERTYSET' && l.args[2] === "'OPS_Resource'")!;
const relation = lines.find(l => l.type === 'IFCRELDEFINESBYPROPERTIES' && l.args[5] === `#${pset.id}`)!;
const last = Math.max(...lines.map(l => l.id));
const duplicates = [...lines, { ...pset, id: last + 1 }, { ...relation, id: last + 2, args: relation.args.map((v, k) => k === 5 ? `#${last + 1}` : v) }];
const pairingInput: LossCheckInput = { index: idx, cls, fixed: new Set([...plan.bySource.keys(), ...plan.baselineHeads.values()]), bySource: plan.bySource,
  o0: duplicates, o1: duplicates, pristine: await pristineDomain(idx, cls, source), domain: cloneDomain(officeDomain), sourceOwnerHistory: plan.sourceOwnerHistory, projectWritten: plan.plan.projectSourceId === undefined };
const ambiguous = preserveAuxiliaryIdentities(pairingInput, duplicates);
const owner = Number(relation.args[4].replace(/[()#]/g, ''));
const sourcePset = Array.from({ length: idx.count }, (_, c) => c).find(c => idx.type(c) === 'IFCPROPERTYSET' && idx.name(c) === 'OPS_Resource' && psetOwners(idx, c).some(o => Number(idx.id(o)) === owner))!;
const sourceGuid = idx.globalId(sourcePset);
check('E16 dubbelzinnig: geen willekeurige bron-GlobalId op de twee kandidaten', ambiguous.filter(l => l.type === 'IFCPROPERTYSET' && l.args[2] === "'OPS_Resource'" && l.args[0] === `'${sourceGuid}'`).length === 0);

// Het bron-id-bereik kan op zijn: een gekoppelde property op MAX_STEP_ID plus
// een echte nieuwe taak. De behoudstap kan dan geen nieuwe ids uitgeven. Alleen
// de ongewijzigde kale uitvoer mag terug, en ook die moet volledig zijn gecontroleerd.
const baseIndex = scanForeignStep(basis), baseClass = classify(baseIndex);
let highProperty = -1;
for (let c = 0; c < baseIndex.count; c++) if (baseClass.classes[c] === 1 && baseIndex.type(c) === 'IFCPROPERTYSINGLEVALUE') { highProperty = c; break; }
assert(highProperty >= 0);
const oldId = Number(baseIndex.id(highProperty));
const high = new TextEncoder().encode(replaceRefsOutsideText(new TextDecoder().decode(basis), id => `#${id === oldId ? MAX_STEP_ID : id}`));
const highDomain = await openForeign(high), highInput = await applyEdit(ordinaryEdits(highDomain).find(e => e.kind === 'taak-erbij')!, cloneDomain(highDomain));
const fallback = await tryMerge(highInput, highDomain.ifcSource!);
check('E16 terugval: de geldige kale merge blijft schrijven als behoud geen ids kan uitgeven', fallback.ok);
if (fallback.ok) {
  const highScan = scanForeignStep(high), result = validateMergeOutput(highScan, classify(highScan), high, fallback.bytes);
  check('E16 terugval: dezelfde uitvoercontrole keurt de teruggegeven bytes goed', !result.problems.length);
  check('E16 terugval: nieuw stuk raakt geen bron-id op MAX_STEP_ID', scanForeignStep(fallback.bytes).chunkOf(String(MAX_STEP_ID)) < 0);
}

// De eis van Trias: de route zonder vreemd deel is bytegelijk de gewone writer.
const bare = await openForeign(born);
assert(bare.ifcSource && !bare.ifcSource.foreign);
reseed(0xe16); const ordinary = new TextEncoder().encode(writeIFC(cloneDomain(bare)));
reseed(0xe16); const unchanged = concat(await writeIfcMerge(cloneDomain(bare), bare.ifcSource));
check('E16 gewone route: byte voor byte de gewone writer, zonder behoudstap', Buffer.compare(ordinary, unchanged) === 0);

if (failures.length) { for (const failure of failures) console.error(`XX ${failure}`); throw new Error(`${failures.length} afwijkingen in hulpidentiteit`); }
console.log('OK hulpidentiteit: gekoppelde bron-GlobalIds en bron-ids; dubbelzinnigheid, terugval en gewone bytepariteit');
