import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { validateMergeOutput } from '@/services/ifc/foreign/mergeValidation';
import { applyForeignRule, foreignChangeCount, goneStepIds, newForeignChangeCount, type ForeignChange } from '@/services/ifc/foreign/changeList';
import { foreignChangeList, foreignReferences } from '@/services/ifc/foreign/foreignReferences';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { classify } from '@/services/ifc/foreign/classify';
import { scanForeignToOpen } from '@/services/ifc/foreign/foreignScan';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import { FOREIGN_LINKS_NOTICE_KEY, foreignLinksDroppedSince } from '@/state/foreignLinksNotice';
import { cloneDomain, mergeProblems, openForeign, settle, shownAfterOpen } from './ifcMergeKern';
import { loadStore, openInStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';

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
const notices = (opened: Opened) => opened.store.getState().ui.notifications.filter(n => n.dedupeKey === FOREIGN_LINKS_NOTICE_KEY);

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

const EIGEN = withLines(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), [
  `#9001=IFCRELASSIGNSTOPRODUCT('${guid('1RegelTweeLijst')}',$,$,$,(#51),$,#393);`,
  `#9002=IFCRELASSIGNSTOPROCESS('${guid('1RegelTweeEnkel')}',$,$,$,(#354),$,#51,$);`,
  `#9003=IFCRELASSIGNSTOPRODUCT('${guid('1RegelEenTweeLeden')}',$,$,$,(#51,#53),$,#354);`,
  '#9004=IFCPROPERTYREFERENCEVALUE(\'Taak\',$,$,#51);',
  `#9005=IFCPROPERTYSET('${guid('1RegelDrieSet')}',$,'Pset_Keten',$,(#9004));`,
  `#9006=IFCRELDEFINESBYPROPERTIES('${guid('1RegelDrieRel')}',$,$,$,(#393),#9005);`,
  '#9007=IFCPROPERTYSINGLEVALUE(\'Opmerking\',$,IFCLABEL(\'blijft\'),$);',
  `#9008=IFCPROPERTYSET('${guid('1RegelVierSet')}',$,'Pset_Los',$,(#9007));`,
  `#9009=IFCRELDEFINESBYPROPERTIES('${guid('1RegelVierRel')}',$,$,$,(#51),#9008);`,
]);
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
  assert.equal(changed.kind, 'gewijzigd');
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

await check('de knop Ongedaan maken voert de undo van de wisstap uit', async () => {
  const opened = await openInStore(encode(EIGEN));
  const id = taskId(opened, 'Set up site');
  opened.store.getState().deleteTask(id);
  const [notice] = notices(opened);
  assert(notice?.action?.kind === 'undoHistoryEvent', 'de melding heeft de knop');
  assert.equal(notice.action.labelKey, 'notifications.actions.undo');
  opened.store.getState().undoHistoryEvent(notice.action.eventId);
  assert(opened.store.getState().tasks.some(t => t.id === id), 'de taak is terug');
  assert.equal(notices(opened).length, 0, 'de melding verdwijnt met haar stap');
  assert.equal((await save(opened)).foreignChanges, undefined);
});

await check('geen melding: geen koppelingen, flag uit, of een document zonder vreemd deel', async () => {
  const opened = await openInStore(encode(EIGEN));
  opened.store.getState().deleteTask(taskId(opened, 'Apply roofing'));
  assert.equal(notices(opened).length, 0, 'een taak zonder koppelingen');
  assert.equal((await save(opened)).foreignChanges, undefined);

  const flagOff = await openInStore(encode(EIGEN));
  const before = flagOff.store.getState();
  flagOff.store.setState(s => { s.ui.featureFlags = { ifcForeignContent: false }; });
  flagOff.store.getState().deleteTask(taskId(flagOff, 'Set up site'));
  assert.equal(notices(flagOff).length, 0, 'flag uit');
  assert.equal(foreignLinksDroppedSince(flagOff.store.getState(), before), 0, 'flag uit: geen telling');

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
  assert.equal(store.getState().ui.notifications.filter(n => n.dedupeKey === FOREIGN_LINKS_NOTICE_KEY).length, 0);
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
  assert.equal(decode(prepared.foreignChanges![0].oldBytes).trim(), lineOf(source.bytes, 9101));
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
  assert.notDeepEqual(problems(prepared.bytes, changes.filter(c => c.id !== 9003)), [], 'een gewijzigd stuk dat niet op de lijst staat');
  const asDropped = changes.map(c => c.id === 9003 ? { kind: 'vervallen' as const, id: c.id, oldBytes: c.oldBytes } : c);
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

console.log(`Verwijderen met gegevens van andere programma's: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
