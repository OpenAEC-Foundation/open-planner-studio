import assert from 'node:assert/strict';
import { castDraft } from 'immer';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MergeNeedsPhase2Error, prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { validateMergeOutput } from '@/services/ifc/foreign/mergeValidation';
import { applyForeignRule, goneStepIds, newForeignChangeCount, type ForeignChange, type ForeignReferences, type ForeignRuleOutcome } from '@/services/ifc/foreign/changeList';
import { foreignChangeList, foreignReferences } from '@/services/ifc/foreign/foreignReferences';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { classify } from '@/services/ifc/foreign/classify';
import { scanForeignToOpen } from '@/services/ifc/foreign/foreignScan';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import { cloneDomain, mergeProblems, openForeign, settle, shownAfterOpen } from './ifcMergeKern';
import { loadStore, openInStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { twoTasksAndChain } from './ifcTwoTasksChain';
import { arrayAndCollectionOperations } from './operationCount';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
installDeterminism();
const text = (name: string) => readFileSync(join(root, name), 'utf8');
const encode = (content: string) => new TextEncoder().encode(content);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const guid = (label: string) => label.padEnd(22, '0').slice(0, 22);
const withLines = (content: string, lines: readonly string[]) => {
  const end = content.lastIndexOf('ENDSEC;');
  return content.slice(0, end) + lines.join('\n') + '\n' + content.slice(end);
};
const lineOf = (bytes: Uint8Array, id: number) => new RegExp(`^#${id}=.*$`, 'm').exec(decode(bytes))?.[0];
const listed = (changes: readonly ForeignChange[] | undefined) => (changes ?? []).map(c => `${c.kind} #${c.id}`);
const foreignChangeCount = (outcome: ForeignRuleOutcome) => outcome.dropped.size + outcome.trimmed.size + outcome.droppedUnusedKeys.length;

let passed = 0, failed = 0;
async function check(label: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${label}`); }
  catch (error) { failed++; console.error(`XX ${label}`, error); }
}

type Opened = Awaited<ReturnType<typeof openInStore>>;
const taskId = (opened: Opened, name: string) => {
  const task = opened.store.getState().tasks.find(t => t.name === name);
  assert(task, `taak ${name}`);
  return task.id;
};
const save = (opened: Opened) => prepareIfcWrite(cloneDomain(opened.snapshot(opened.store)), opened.store.getState().ifcSource!);
const notices = (opened: Opened) => opened.store.getState().ui.notifications.filter(n => n.messageKey === 'notifications.foreignLinksDropped');

const R4 = decode(await settle(encode(text('tests/fixtures/ifc-foreign/council/r4-k1.ifc'))));

await check('plan: 4D-bestand, taak met IfcRelAssignsToProduct wissen, opslaan: de relatie vervalt, de rest byte-gelijk, melding met het aantal', async () => {
  const opened = await openInStore(encode(R4));
  const source = opened.store.getState().ifcSource!;
  opened.store.getState().deleteTask(taskId(opened, 'Externe bronactiviteit'));
  const [notice] = notices(opened);
  assert.equal(notice?.messageKey, 'notifications.foreignLinksDropped');
  assert.equal(notice.params?.count, 1);
  const prepared = await save(opened);
  assert.deepEqual(listed(prepared.foreignChanges), ['vervallen #905']);
  assert.equal(prepared.foreignChanges!.length, notice.params?.count, 'de melding bij het wissen en het opslaan tellen hetzelfde');
  assert.equal(lineOf(prepared.bytes, 905), undefined, 'de relatie is weg');
  assert.equal(lineOf(prepared.bytes, 904), lineOf(source.bytes, 904), 'de wand blijft (regel 4)');
  assert.deepEqual(mergeProblems(source.bytes, prepared.bytes, prepared.foreignChanges), []);
});

const EIGEN = twoTasksAndChain(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'));
const ALL_DROPPED_FOR_SET_UP_SITE = ['vervallen #9001', 'vervallen #9002', 'gewijzigd #9003', 'vervallen #9004', 'vervallen #9005', 'vervallen #9006', 'vervallen #9009'];

await check('regels 1 tot en met 4 in één opslag, en wat niet op de lijst staat is byte-gelijk', async () => {
  const opened = await openInStore(encode(EIGEN));
  const source = opened.store.getState().ifcSource!;
  assert(source.foreignReferences, 'de bron kent de verwijzingen van de andere programma\'s');
  opened.store.getState().deleteTask(taskId(opened, 'Set up site'));
  assert.equal(notices(opened)[0]?.params?.count, 7);
  const prepared = await save(opened);
  assert.deepEqual(listed(prepared.foreignChanges), ALL_DROPPED_FOR_SET_UP_SITE);
  assert.deepEqual(mergeProblems(source.bytes, prepared.bytes, prepared.foreignChanges), []);
  for (const id of [393, 354, 9007, 9008]) assert.equal(lineOf(prepared.bytes, id), lineOf(source.bytes, id), `#${id} blijft staan (regel 4)`);
  const changed = prepared.foreignChanges!.find(c => c.id === 9003)!;
  assert(changed.kind === 'gewijzigd');
  assert.equal(decode(changed.oldBytes).trim(), lineOf(source.bytes, 9003), 'de oude bytes zijn die van de bron');
  assert.equal(decode(changed.kind === 'gewijzigd' ? changed.newBytes : new Uint8Array()).trim(),
    `#9003=IFCRELASSIGNSTOPRODUCT('${guid('1RegelEenTweeLeden')}',$,$,$,(#53),$,#354);`, 'regel 1: alleen het lid gaat eruit');
  assert.equal(lineOf(prepared.bytes, 9003), decode(changed.kind === 'gewijzigd' ? changed.newBytes : new Uint8Array()).trim());
  const reopened = await openForeign(prepared.bytes);
  assert.equal(planningCanon(cloneDomain(reopened)), planningCanon(cloneDomain(await shownAfterOpen(cloneDomain(opened.snapshot(opened.store))))),
    'heropenen geeft dezelfde planning');
  const again = await prepareIfcWrite(cloneDomain(reopened), reopened.ifcSource!);
  assert.equal(again.foreignChanges, undefined, 'een tweede opslag zonder bewerking heeft geen wijzigingslijst');
  assert.deepEqual(again.bytes, prepared.bytes, 'een tweede opslag zonder bewerking verandert niets');
  assert.deepEqual(prepared.source.foreignReferences, reopened.ifcSource!.foreignReferences, 'de nieuwe bron kent dezelfde verwijzingen als heropenen');
  assert.deepEqual([...prepared.source.classes], [...reopened.ifcSource!.classes], 'de nieuwe bron heeft dezelfde klassen als heropenen');
  opened.store.setState(s => { s.ifcSource = castDraft(prepared.source); });
  opened.store.getState().setProject({ description: 'na het wissen' });
  const next = await save(opened);
  assert.equal(next.foreignChanges, undefined, 'een volgende opslag met een bewerking op de nieuwe bron');
  assert.deepEqual(mergeProblems(prepared.bytes, next.bytes), []);
});

await check('een stuk dat zijn laatste verwijzing naar de planning kwijtraakt: de nieuwe bron deelt het in zoals heropenen', async () => {
  const opened = await openInStore(encode(withLines(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'),
    [`#9003=IFCRELASSIGNSTOPRODUCT('${guid('1LaatsteVerwijzing')}',$,$,$,(#51,#393),$,#354);`])));
  const source = opened.store.getState().ifcSource!;
  const sourceIndex = scanForeignStep(source.bytes);
  assert.equal(source.classes[sourceIndex.chunkOf('9003')], 3, 'in de bron: A');
  opened.store.getState().deleteTask(taskId(opened, 'Set up site'));
  const prepared = await save(opened);
  assert.deepEqual(listed(prepared.foreignChanges), ['gewijzigd #9003']);
  const outputIndex = scanForeignStep(prepared.bytes), outputClasses = classify(outputIndex).classes;
  assert.equal(prepared.source.classes[outputIndex.chunkOf('9003')], 4, 'na opslaan: V');
  assert.deepEqual([...prepared.source.classes], [...outputClasses]);
  opened.store.setState(s => { s.ifcSource = castDraft(prepared.source); });
  opened.store.getState().setProject({ description: 'na het wissen' });
  assert.equal((await save(opened)).foreignChanges, undefined, 'een volgende opslag lukt');
});

const MIXED = await (async () => {
  const base = decode(await settle(encode(text('tests/fixtures/ifc-foreign/council/r6sol-twee-werkplannen.ifc'))));
  return withLines(base.replace(/^(#59=IFCRELASSIGNSTOCONTROL\(.*)\(#57\),\$,#54\);/m, '$1(#57,#909),$$,#54);'), [
    "#908=IFCTASKTIME('Kind Time',.PREDICTED.,$,.WORKTIME.,'P0Y0M2D','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','2026-09-01T07:00:00','2026-09-02T07:00:00','P0Y0M0D','P0Y0M0D',.F.,$,$,$,$,$,$);",
    "#909=IFCTASK('3kindTaak0000000000000',#6,'Kind',$,$,'1.1',$,$,$,.F.,$,#908,.CONSTRUCTION.);",
    "#910=IFCEVENT('0vreemdEvent0000000000',#903,'Gebeurtenis',$,$,$,$,.NOTDEFINED.,.NOTDEFINED.,$,$);",
    "#911=IFCRELNESTS('0gemengdNest0000000000',#903,$,$,#57,(#909,#910));",
  ]);
})();

await check('een gemengde relatie (§4.6): het eigen lid gaat eruit, of de relatie vervalt met haar ouder', async () => {
  const child = await openInStore(encode(MIXED));
  const source = child.store.getState().ifcSource!;
  child.store.getState().deleteTask(taskId(child, 'Kind'));
  const withoutChild = await save(child);
  assert.deepEqual(listed(withoutChild.foreignChanges), ['gewijzigd #911']);
  assert.equal(lineOf(withoutChild.bytes, 911), "#911=IFCRELNESTS('0gemengdNest0000000000',#903,$,$,#57,(#910));");
  assert.deepEqual(mergeProblems(source.bytes, withoutChild.bytes, withoutChild.foreignChanges), []);
  const reopened = await openForeign(withoutChild.bytes);
  const parent = reopened.tasks.find(t => t.name === 'Externe bronactiviteit')!;
  assert.deepEqual(parent.childIds, [], 'na heropenen heeft de ouder geen kind meer');

  const both = await openInStore(encode(MIXED));
  both.store.getState().deleteTask(taskId(both, 'Externe bronactiviteit'));
  const withoutParent = await save(both);
  assert(listed(withoutParent.foreignChanges).includes('vervallen #911'), listed(withoutParent.foreignChanges).join(', '));
  assert.equal(lineOf(withoutParent.bytes, 910), lineOf(source.bytes, 910), 'de gebeurtenis blijft (regel 4)');
  assert.deepEqual(mergeProblems(source.bytes, withoutParent.bytes, withoutParent.foreignChanges), []);
});

function ruleOn(content: string, goneIds: readonly number[]) {
  const bytes = encode(content), index = scanForeignStep(bytes), cls = classify(index);
  const outcome = applyForeignRule(foreignReferences(index, cls.classes, bytes, cls.selection.inD), new Set(goneIds));
  return { outcome, changes: foreignChangeList(outcome, index, bytes) };
}

await check('regel 1: een lijst met twee leden waarvan er één vervalt, met oude en nieuwe bytes', async () => {
  const { changes } = ruleOn(EIGEN, [53]);
  assert.deepEqual(listed(changes), ['gewijzigd #9003']);
  const [change] = changes;
  assert(change.kind === 'gewijzigd');
  assert.match(decode(change.newBytes), /,\(#51\),\$,#354\);$/);
});

await check('regel 2: een enkele verwijzing en een lijst die leeg wordt laten het stuk vervallen', async () => {
  const single = ruleOn(withLines(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'),
    [`#9002=IFCRELASSIGNSTOPROCESS('${guid('1RegelTweeEnkel')}',$,$,$,(#354),$,#51,$);`]), [51]);
  assert.deepEqual(listed(single.changes), ['vervallen #9002']);
  const empty = ruleOn(withLines(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'),
    [`#9001=IFCRELASSIGNSTOPRODUCT('${guid('1RegelTweeLijst')}',$,$,$,(#51),$,#393);`]), [51]);
  assert.deepEqual(listed(empty.changes), ['vervallen #9001']);
});

await check('regel 3: een keten van drie stukken vervalt, regel 4: wat een vervallen stuk aanwees blijft', async () => {
  const { changes } = ruleOn(withLines(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), [
    '#9004=IFCPROPERTYREFERENCEVALUE(\'Taak\',$,$,#51);',
    `#9005=IFCPROPERTYSET('${guid('1RegelDrieSet')}',$,'Pset_Keten',$,(#9004));`,
    `#9006=IFCRELDEFINESBYPROPERTIES('${guid('1RegelDrieRel')}',$,$,$,(#393),#9005);`,
  ]), [51]);
  assert.deepEqual(listed(changes), ['vervallen #9004', 'vervallen #9005', 'vervallen #9006']);
});

await check('regel 4: een losse pset blijft staan als de relatie naar de taak vervalt', async () => {
  const { changes } = ruleOn(withLines(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), [
    '#9007=IFCPROPERTYSINGLEVALUE(\'Opmerking\',$,IFCLABEL(\'blijft\'),$);',
    `#9008=IFCPROPERTYSET('${guid('1RegelVierSet')}',$,'Pset_Los',$,(#9007));`,
    `#9009=IFCRELDEFINESBYPROPERTIES('${guid('1RegelVierRel')}',$,$,$,(#51),#9008);`,
  ]), [51]);
  assert.deepEqual(listed(changes), ['vervallen #9009']);
});

await check('de bytes van een lid: commentaar en witruimte rond het lid gaan mee, de rest blijft', async () => {
  const lines = (list: string) => [`#9003=IFCRELASSIGNSTOPRODUCT('${guid('1Lid')}',$,$,$,${list},$,#354);`];
  const base = text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc');
  const cases: [string, number, string][] = [
    ['(#51 /*a*/ , /*b*/ #53)', 51, '(#53)'],
    ['(#53, #51)', 51, '(#53)'],
    ['(#53,#51,#55)', 51, '(#53,#55)'],
    ['(#51,#53,#55)', 53, '(#51,#55)'],
    ['(#51,#53,#55)', 51, '(#53,#55)'],
  ];
  for (const [list, gone, want] of cases) {
    const { changes } = ruleOn(withLines(base, lines(list)), [gone]);
    assert.equal(changes.length, 1, list);
    const [change] = changes;
    assert(change.kind === 'gewijzigd', list);
    assert.equal(decode(change.newBytes).trim(), lines(want)[0], list);
  }
  const typed = ruleOn(withLines(base, ['#9010=IFCPROPERTYSINGLEVALUE(\'Ref\',$,IFCLABEL(\'#51\'),$);',
    `#9011=IFCRELASSIGNSTOPRODUCT('${guid('1Getypeerd')}',$,$,$,(#53,#9012),$,#354);`, '#9012=IFCPROPERTYREFERENCEVALUE(\'Taak\',$,$,(#51,#53));']), [51]);
  assert.deepEqual(listed(typed.changes), ['gewijzigd #9012'], 'een # in een string telt niet; een lid van een geneste lijst gaat eruit');
});

await check('de telling bij het wissen: per stap wat er bij komt of verandert', async () => {
  const { outcome: none } = ruleOn(EIGEN, []);
  const { outcome: first } = ruleOn(EIGEN, [53]);
  const { outcome: both } = ruleOn(EIGEN, [53, 51]);
  assert.equal(foreignChangeCount(none), 0);
  assert.equal(newForeignChangeCount(none, first), 1);
  assert.equal(newForeignChangeCount(first, both), 7, 'het gewijzigde stuk vervalt nu, en telt dus weer mee');
  assert.equal(foreignChangeCount(both), 7);
  const { outcome: second } = ruleOn(EIGEN, [51]);
  assert.equal(newForeignChangeCount(second, both), 1, 'na het wissen van de eerste taak telt de tweede alleen wat erbij komt');
});

await check('verwijderen en Ctrl+Z vóór het opslaan: er vervalt niets', async () => {
  const opened = await openInStore(encode(EIGEN));
  const source = opened.store.getState().ifcSource!;
  opened.store.getState().deleteTask(taskId(opened, 'Set up site'));
  opened.store.getState().undo();
  const prepared = await save(opened);
  assert.equal(prepared.foreignChanges, undefined);
  assert.deepEqual(mergeProblems(source.bytes, prepared.bytes), []);
  for (const id of [9001, 9002, 9003, 9004, 9005, 9006, 9009]) assert.equal(lineOf(prepared.bytes, id), lineOf(source.bytes, id));
});

await check('geen melding: geen koppelingen, flag uit, of een document zonder vreemd deel', async () => {
  const opened = await openInStore(encode(EIGEN));
  opened.store.getState().deleteTask(taskId(opened, 'Apply roofing'));
  assert.equal(notices(opened).length, 0, 'een taak zonder koppelingen');
  assert.equal((await save(opened)).foreignChanges, undefined);

  const flagOff = await openInStore(encode(EIGEN));
  flagOff.store.setState(s => { s.ui.featureFlags = { ifcForeignContent: false }; });
  flagOff.store.getState().deleteTask(taskId(flagOff, 'Set up site'));
  assert.equal(notices(flagOff).length, 0, 'flag uit');

  const own = await openInStore(encode(text('public/examples/03-kantoorgebouw-zuidas.ifc')));
  assert.equal(own.store.getState().ifcSource?.foreign ?? false, false);
  own.store.getState().deleteTask(own.store.getState().tasks.find(t => t.childIds.length === 0)!.id);
  assert.equal(notices(own).length, 0, 'een document zonder vreemd deel');

  const { createAppStoreContext } = await loadStore();
  const { store } = createAppStoreContext();
  const realError = console.error;
  console.error = () => {};
  try { await store.getState().openOpenedFile({ name: 'bron.ifc', content: EIGEN, bytes: encode(EIGEN), ref: null }); }
  finally { console.error = realError; }
  assert.equal(store.getState().ifcSource ?? null, null, 'met de flag uit heeft de app geen bron, zoals main');
  assert(!store.getState().tasks.some(t => t.name === 'Set up site'), 'met de flag uit weigert de app een bestand met gebouwmodel, zoals main');
  assert.equal(store.getState().ui.notifications.filter(n => n.messageKey === 'notifications.foreignLinksDropped').length, 0);
});

const ASSIGNMENTS = text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')
  .replace("#154=IFCPROPERTYSET('26EUCC2ORYjlLXgzsMT4U9',#6,'OPS_Assignments',$,(#152,#153));",
    "#154=IFCPROPERTYSET('26EUCC2ORYjlLXgzsMT4U9',#6,'OPS_Assignments',$,(#152,#153,#9101));\n#9101=IFCPROPERTYSINGLEVALUE('3LKE2mEiGfOR4VMIq3h_xv#5',$,IFCTEXT('1|UNIFORM'),$);");

await check('de ongebruikte sleutel van een verwijderde taak staat als vervallen op de lijst en telt mee', async () => {
  const opened = await openInStore(encode(ASSIGNMENTS));
  const source = opened.store.getState().ifcSource!;
  assert.deepEqual(source.unusedKeys, [{ taskStepId: 63, propertyStepIds: [9101] }]);
  opened.store.getState().deleteTask(taskId(opened, 'Build masonry walls'));
  assert.equal(notices(opened)[0]?.params?.count, 1);
  const prepared = await save(opened);
  assert.deepEqual(prepared.foreignChanges?.map(c => [c.kind, c.id, c.kind === 'vervallen' ? c.unusedKeyOfTask : undefined]), [['vervallen', 9101, 63]]);
  const [key] = prepared.foreignChanges!;
  assert(key.kind === 'vervallen');
  assert.equal(decode(key.oldBytes).trim(), lineOf(source.bytes, 9101));
  assert.equal(lineOf(prepared.bytes, 9101), undefined);
  assert.deepEqual(mergeProblems(source.bytes, prepared.bytes, prepared.foreignChanges), []);
});

await check('controle 1: niets vervalt of wijzigt zonder op de lijst te staan, en de lijst volgt uit de regel', async () => {
  const opened = await openInStore(encode(EIGEN));
  const source = opened.store.getState().ifcSource!;
  opened.store.getState().deleteTask(taskId(opened, 'Set up site'));
  const prepared = await save(opened);
  const changes = prepared.foreignChanges!;
  const index = scanForeignStep(source.bytes), cls = classify(index);
  const problems = (bytes: Uint8Array, list: readonly ForeignChange[]) => validateMergeOutput(index, cls, source.bytes, bytes, { changes: list }).problems;
  assert.deepEqual(problems(prepared.bytes, changes), []);
  assert.notDeepEqual(problems(prepared.bytes, changes.filter(c => c.id !== 9001)), [], 'een vervallen stuk dat niet op de lijst staat');
  const still9001 = encode(withLines(decode(prepared.bytes), [lineOf(source.bytes, 9001)!]));
  assert.notDeepEqual(problems(still9001, changes.filter(c => c.id !== 9001)), [], 'een stuk dat volgens de regel vervalt, blijft staan');
  assert.notDeepEqual(problems(prepared.bytes, changes.filter(c => c.id !== 9003)), [], 'een gewijzigd stuk dat niet op de lijst staat');
  const asDropped = changes.map(c => c.id === 9003 && c.kind === 'gewijzigd' ? { kind: 'vervallen' as const, id: c.id, oldBytes: c.oldBytes } : c);
  assert.notDeepEqual(problems(prepared.bytes, asDropped), [], 'een lijst die van de regel afwijkt');
  const withOld = decode(prepared.bytes).replace(lineOf(prepared.bytes, 9003)!, lineOf(source.bytes, 9003)!);
  assert.notDeepEqual(problems(encode(withOld), changes), [], 'de uitvoer heeft niet de nieuwe bytes van de lijst');
  const wallGone = decode(prepared.bytes).replace(`${lineOf(prepared.bytes, 393)!}\n`, '');
  assert.notDeepEqual(problems(encode(wallGone), changes), [], 'een stuk vervalt zonder op de lijst te staan');
  const without9003 = decode(prepared.bytes).replace(`${lineOf(prepared.bytes, 9003)!}\n`, '');
  assert.notDeepEqual(problems(encode(without9003), asDropped), [], 'een stuk vervalt dat volgens de regel alleen een lid kwijt was');
  const brokenList = changes.map(c => c.id === 9003 && c.kind === 'gewijzigd' ? { ...c, newBytes: encode(decode(c.newBytes).replace('(#53)', '(,#53)')) } : c);
  const brokenOutput = decode(prepared.bytes).replace('(#53),$,#354)', '(,#53),$,#354)');
  assert.notDeepEqual(problems(encode(brokenOutput), brokenList), [], 'een kapotte lijst in een gewijzigd stuk');
  const tampered = changes.map(c => c.id === 9003 && c.kind === 'gewijzigd' ? { ...c, newBytes: encode(decode(c.newBytes).replace('(#53)', '(#53,#55)')) } : c);
  const tamperedOutput = decode(prepared.bytes).replace('(#53),$,#354)', '(#53,#55),$,#354)');
  assert.notDeepEqual(problems(encode(tamperedOutput), tampered), [], 'een gewijzigd stuk met een ander lid dan de regel geeft');
  const trailing = changes.map(c => c.id === 9003 && c.kind === 'gewijzigd' ? { ...c, newBytes: encode(decode(c.newBytes).replace('(#53)', '(#53,)')) } : c);
  const trailingOutput = decode(prepared.bytes).replace('(#53),$,#354)', '(#53,),$,#354)');
  assert.notDeepEqual(problems(encode(trailingOutput), trailing), [], 'een slotkomma in een gewijzigd stuk');
});

await check('een getypeerde lijst: het lid gaat eruit, en controle 1 keurt de juiste uitvoer goed', async () => {
  const opened = await openInStore(encode(withLines(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), [
    `#9030=IFCRELDEFINESBYPROPERTIES('${guid('1GetypeerdeLijst')}',$,$,$,(#393),IFCPROPERTYSETDEFINITIONSET((#51,#53)));`,
  ])));
  const source = opened.store.getState().ifcSource!;
  opened.store.getState().deleteTask(taskId(opened, 'Set up site'));
  const prepared = await save(opened);
  assert.deepEqual(listed(prepared.foreignChanges), ['gewijzigd #9030']);
  assert.equal(lineOf(prepared.bytes, 9030), `#9030=IFCRELDEFINESBYPROPERTIES('${guid('1GetypeerdeLijst')}',$,$,$,(#393),IFCPROPERTYSETDEFINITIONSET((#53)));`);
  assert.deepEqual(mergeProblems(source.bytes, prepared.bytes, prepared.foreignChanges), []);
});

await check('flag aan zonder vreemd deel: geen grafiek bij openen en geen melding', async () => {
  const own = encode(text('public/examples/03-kantoorgebouw-zuidas.ifc'));
  const scan = scanForeignToOpen(own);
  assert(scan.ok && scan.foreignReferences === undefined, 'zonder vreemd deel bouwt het openen geen grafiek');
  const opened = await openInStore(own);
  assert.equal(opened.store.getState().ifcSource?.foreignReferences, undefined);
});

function wideReferences(members: number): ForeignReferences {
  return { stepIds: Int32Array.of(9_000_000), groupStart: Int32Array.of(0, 1), groupSize: Int32Array.of(members),
    targetStart: Int32Array.of(0, members), targets: Int32Array.from({ length: members }, (_, k) => k + 1) };
}

await check('een brede lijst: de helft wissen is lineair werk', async () => {
  const work = (members: number) => arrayAndCollectionOperations(() => {
    const outcome = applyForeignRule(wideReferences(members), new Set(Array.from({ length: members / 2 }, (_, k) => k + 1)));
    assert.equal(outcome.trimmed.get(9_000_000)?.size, members / 2);
    assert.equal(outcome.dropped.size, 0);
  }).operations;
  const small = work(10_000), large = work(20_000);
  console.log(`   werk bij een lijst van 10.000 met 5.000 gewist: ${small}; 20.000 met 10.000 gewist: ${large}`);
  assert(large / small < 2.5, `twee keer zo breed geeft ${(large / small).toFixed(2)} keer zoveel werk; lineair is 2, kwadratisch 4`);
});

await check('een relatie met 150.000 leden: de grafiek bouwt zonder de argumentgrens', async () => {
  const members = 150_000;
  const lines = ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION((''),'2;1');", "FILE_NAME('','',(''),(''),'','','');", "FILE_SCHEMA(('IFC4X3_ADD2'));", 'ENDSEC;', 'DATA;'];
  for (let k = 1; k <= members; k++) lines.push(`#${k}=IFCTASK('${guid(`3T${k.toString(36)}`)}',$,'t',$,$,$,$,$,$,.F.,$,$,$);`);
  lines.push(`#${members + 1}=IFCWALL('${guid('2Wand')}',$,'Wand',$,$,$,$,$,$);`);
  lines.push(`#${members + 2}=IFCRELASSIGNSTOPRODUCT('${guid('2Rel')}',$,$,$,(${Array.from({ length: members }, (_, k) => `#${k + 1}`).join(',')}),$,#${members + 1});`);
  lines.push('ENDSEC;', 'END-ISO-10303-21;');
  const bytes = encode(lines.join('\n')), index = scanForeignStep(bytes);
  const classes = new Uint8Array(index.count), inD = new Uint8Array(index.count);
  for (let i = 0; i < index.count; i++) {
    if (!index.isEntity(i)) continue;
    const task = index.type(i) === 'IFCTASK';
    classes[i] = task ? 1 : index.type(i) === 'IFCWALL' ? 4 : 3;
    inD[i] = task ? 1 : 0;
  }
  const references = foreignReferences(index, classes, bytes, inD);
  assert.equal(references.targets.length, members);
  assert.deepEqual([...references.groupSize], [members]);
});

await check('een vreemd lid in een eigen pset van een verwijderde taak blijft als los stuk staan (§4.2 stap 3)', async () => {
  const bytes = await settle(encode(text('tests/fixtures/ifc-foreign/council/r7sol-vreemd-lid-bij-notitie.ifc')
    .replace("IFCTEXT('[]')", `IFCTEXT('[{"id":"n1","text":"Bouwhek plaatsen","done":false}]')`)));
  const opened = await openInStore(bytes);
  const source = opened.store.getState().ifcSource!;
  assert(lineOf(source.bytes, 9100)?.includes('VendorSecretNote'));
  opened.store.getState().deleteTask(taskId(opened, 'Set up site'));
  assert.equal(notices(opened).length, 0, 'een vreemd lid vervalt niet en telt dus niet mee');
  const prepared = await save(opened);
  assert.equal(prepared.foreignChanges, undefined);
  assert.equal(lineOf(prepared.bytes, 9100), lineOf(source.bytes, 9100), 'het lid staat er nog, byte-gelijk');
  assert(!/OPS_TaskNotes',\$,\([^)]*#9100\)/.test(decode(prepared.bytes)), 'geen pset meer voor de verwijderde taak');
  assert.deepEqual(mergeProblems(source.bytes, prepared.bytes), []);
});

await check('de verwijzingen bij openen zijn dezelfde als die de merge uit de bron haalt', async () => {
  const bytes = encode(EIGEN), index = scanForeignStep(bytes), cls = classify(index);
  const opened = scanForeignToOpen(bytes);
  assert(opened.ok);
  assert.deepEqual(opened.foreignReferences, foreignReferences(index, cls.classes, bytes, cls.selection.inD));
  const store = await openInStore(bytes);
  assert.deepEqual(store.store.getState().ifcSource!.foreignReferences, opened.foreignReferences);
  const gone = goneStepIds(store.store.getState().ifcSource!.stepIds, { ...store.store.getState(), resourceCalendars: store.store.getState().calendars });
  assert.equal(gone.size, 0, 'zonder bewerking is er niets verdwenen');
});

await check('een beschadigde complexe instantie op de wijzigingslijst: de uitvoercontrole eindigt met een weigering', async () => {
  const opened = await openInStore(encode(withLines(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), [
    `#9050=(IFCRELASSIGNS((#51),$),IFCRELASSIGNSTOPRODUCT(#393),IFCRELATIONSHIP(),IFCROOT('${guid('1Complex')}',$,$,$));`,
  ])));
  assert(opened.store.getState().ifcSource, 'het bestand opent');
  opened.store.getState().deleteTask(taskId(opened, 'Set up site'));
  let refusal: unknown;
  try { await save(opened); } catch (error) { refusal = error; }
  assert(refusal instanceof MergeNeedsPhase2Error, 'het opslaan weigert');
  assert(refusal.cases.some(c => c.kind === 'uitvoer-controle'), refusal.cases.map(c => c.kind).join(', '));
});

function reversedChain(length: number) {
  const lines: string[] = [];
  for (let k = length - 1; k >= 0; k--) {
    lines.push(`#${9100 + length - 1 - k}=IFCPROPERTYREFERENCEVALUE('k${k}',$,$,#${k === 0 ? 51 : 9100 + length - k});`);
  }
  return withLines(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), lines);
}

await check('een lange keten in omgekeerde bronvolgorde: de uitvoercontrole doet lineair werk', async () => {
  const work = async (length: number) => {
    const opened = await openInStore(encode(reversedChain(length)));
    const source = opened.store.getState().ifcSource!;
    opened.store.getState().deleteTask(taskId(opened, 'Set up site'));
    const prepared = await save(opened);
    assert((prepared.foreignChanges ?? []).filter(c => c.kind === 'vervallen' && c.id >= 9100).length === length, 'de hele keten vervalt');
    const index = scanForeignStep(source.bytes), cls = classify(index);
    const { result, operations } = arrayAndCollectionOperations(() =>
      validateMergeOutput(index, cls, source.bytes, prepared.bytes, { changes: prepared.foreignChanges }));
    assert.deepEqual(result.problems, []);
    return operations;
  };
  const small = await work(400), large = await work(800);
  console.log(`   werk van de uitvoercontrole bij een keten van 400: ${small}; van 800: ${large}`);
  assert(large / small < 2.6, `twee keer zo lang geeft ${(large / small).toFixed(2)} keer zoveel werk; lineair is 2, kwadratisch 4`);
});

await check('een lange keten met één brede pset over alle leden: de uitvoercontrole telt elke vervallen verwijzing één keer', async () => {
  const work = async (length: number) => {
    const members = Array.from({ length }, (_, k) => `#${9100 + k}`).join(',');
    const opened = await openInStore(encode(withLines(reversedChain(length),
      [`#9000=IFCPROPERTYSET('0BredeKeten000000000000',$,'Pset_Keten',$,(${members}));`])));
    const source = opened.store.getState().ifcSource!;
    opened.store.getState().deleteTask(taskId(opened, 'Set up site'));
    const prepared = await save(opened);
    assert.equal((prepared.foreignChanges ?? []).filter(c => c.kind === 'vervallen' && c.id >= 9000).length, length + 1, 'de keten en de pset vervallen');
    const index = scanForeignStep(source.bytes), cls = classify(index);
    const { result, operations } = arrayAndCollectionOperations(() =>
      validateMergeOutput(index, cls, source.bytes, prepared.bytes, { changes: prepared.foreignChanges }));
    assert.deepEqual(result.problems, []);
    return operations;
  };
  const small = await work(400), large = await work(800);
  console.log(`   werk van de uitvoercontrole met een brede pset bij 400: ${small}; bij 800: ${large}`);
  assert(large / small < 2.6, `twee keer zo lang geeft ${(large / small).toFixed(2)} keer zoveel werk; lineair is 2, kwadratisch 4`);
});

function historySteps(run: () => void): number {
  const prototype = Array.prototype as unknown as Record<symbol, (this: unknown[]) => Iterator<unknown>>;
  const original = prototype[Symbol.iterator]!;
  let steps = 0;
  prototype[Symbol.iterator] = function (this: unknown[]) {
    const inner = original.call(this);
    if (this.length < 90) return inner;
    return { next: () => { steps++; return inner.next(); }, [Symbol.iterator]() { return this; } } as unknown as Iterator<unknown>;
  };
  try { run(); } finally { prototype[Symbol.iterator] = original; }
  return steps;
}

await check('Opnieuw kiest de stap één keer, ook met de flag uit en zonder vreemd deel', async () => {
  for (const flag of [false, true]) {
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: flag }; });
    store.getState().newProject();
    const ids = [store.getState().addTask({ name: 'a' }), store.getState().addTask({ name: 'b' })];
    for (let k = 0; k < 150; k++) store.getState().updateTask(ids[k % 2]!, { name: `t${k}` });
    store.getState().undo();
    const redo = historySteps(() => store.getState().redo());
    const undo = historySteps(() => store.getState().undo());
    console.log(`   flag ${flag ? 'aan' : 'uit'}: Opnieuw ${redo}, Ongedaan maken ${undo} stappen door de geschiedenis`);
    assert(store.getState().historyEvents.length >= 90 && undo >= 90, 'Ongedaan maken loopt de geschiedenis één keer door');
    assert(redo < undo * 1.3, `Opnieuw loopt ${(redo / undo).toFixed(2)} keer zo vaak door de geschiedenis; één keuze is ongeveer 1, twee keuzes ongeveer 2`);
  }
});

console.log(`Verwijderen met gegevens van andere programma's: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
