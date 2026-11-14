// #804 fase 1c, E16: bronidentiteit van gekoppelde hulpregels; de gewone writer blijft gelijk.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC, writeIfcMergeLines } from '@/services/ifc/ifcWriter';
import { classify } from '@/services/ifc/foreign/classify';
import { preserveAuxiliaryIdentities, pristineDomain, replaceRefsOutsideText, parseOutLine, type LossCheckInput } from '@/services/ifc/foreign/lossCheck';
import { mergeIdPlan, writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { MAX_STEP_ID } from '@/services/ifc/foreign/stepScanner';
import { psetOwners, validateMergeOutput } from '@/services/ifc/foreign/mergeValidation';
import { openInStore, TRIAS_FILES } from './ifcAppRoute';
import { generatedModel } from './ifcGeneratedModel';
import { installDeterminism } from './ifcPariteitKern';
import { applyEdit, cloneDomain, concat, mergeProblems, openForeign, ordinaryEdits, tryMerge } from './ifcMergeKern';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const reseed = installDeterminism();
const failures: string[] = [];
const check = (message: string, yes: boolean) => { if (!yes) failures.push(message); };
const read = (rel: string) => new Uint8Array(readFileSync(join(root, rel)));
const model = (text: string) => generatedModel(root, text, 0);
const basis = read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');

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

// Eerst een nieuwe resource in de app maken en als eigen IFC vastleggen. Dat levert haar
// eerste bronidentiteit; de twee volgende opslagen zijn merges met een model.
const fresh = await openInStore(basis);
fresh.store.getState().addResource({ name: 'Nieuwe kraan E16', type: 'EQUIPMENT', description: '', maxUnits: 1 });
const input = cloneDomain(fresh.snapshot(fresh.store));
// 1147: de eerste merge direct na addResource weigert al op main. De bronkoppeling
// kan een nog niet bestaand hulpstuk niet herstellen; de eindcontrole blijft intact.
const direct = await tryMerge(input, fresh.snapshot(fresh.store).ifcSource!);
check('1147: bestaande weigering bij de eerste opslag van een nieuwe resource blijft zichtbaar', !direct.ok && direct.kinds.includes('planning-na-openen'));
const born = new TextEncoder().encode(writeIFC(input));
const withModel = model(new TextDecoder().decode(born));
const opened = await openForeign(withModel);
const one = await tryMerge(cloneDomain(opened), opened.ifcSource!);
assert(one.ok, one.ok ? '' : JSON.stringify(one.error.cases));
const next = await openForeign(one.bytes), two = await tryMerge(cloneDomain(next), next.ifcSource!);
assert(two.ok, two.ok ? '' : JSON.stringify(two.error.cases));
const original = resourceHelpers(withModel), first = resourceHelpers(one.bytes), second = resourceHelpers(two.bytes);
for (const [id, expected] of original) {
  check(`E16 resource ${id}: pset en relatie houden bron-GlobalId en bron-id`, same(first.get(id), expected));
  check(`E16 resource ${id}: na openen en tweede merge dezelfde identiteit`, same(second.get(id), expected));
}
assert.equal(original.size, input.resources.length);
check('E16: C/A/V zijn na beide merges bytegelijk', !mergeProblems(withModel, one.bytes).length && !mergeProblems(one.bytes, two.bytes).length);
console.log(`E16 resource: ${original.size} resources, bron → merge → openen → merge`);

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
