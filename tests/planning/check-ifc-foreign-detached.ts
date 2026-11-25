import assert from 'node:assert/strict';
import { castDraft } from 'immer';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ForeignChange } from '@/services/ifc/foreign/changeList';
import { classify } from '@/services/ifc/foreign/classify';
import { validateMergeOutput } from '@/services/ifc/foreign/mergeValidation';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { resetPlanOnlyAsker, setPlanOnlyAsker } from '@/services/ifc/planOnlyQuestion';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { elementLinkCounts, taskElementLinks } from '@/state/taskElementLinks';
import { prepareIfcOutput } from '@/state/prepareIfcOutput';
import { loadStore, openInStore } from './ifcAppRoute';
import { bonsaiPlanning, PIN_FILE } from './ifcBonsaiPin';
import { desktopRoute, endDifferences } from './ifcDetachedRoute';
import { openForeign } from './ifcMergeKern';
import { installDeterminism } from './ifcPariteitKern';
import { twoTasksAndChain } from './ifcTwoTasksChain';

installDeterminism();
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const text = (name: string) => readFileSync(join(root, name), 'utf8');
const encode = (content: string) => new TextEncoder().encode(content);
const route = desktopRoute();

let passed = 0, failed = 0;
async function check(label: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${label}`); }
  catch (error) { failed++; console.error(`XX ${label}`, error instanceof Error ? error.message : error); }
}

const FIXTURES: readonly [string, Uint8Array][] = [
  ['bonsai-4d.ifc', new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc')))],
  ['de pinbron', encode(bonsaiPlanning(PIN_FILE).text)],
  ['eigen-plus-model.ifc met een stuk naar twee taken en een keten', encode(twoTasksAndChain(text('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')))],
  ['eigen-plus-model.ifc', new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')))],
];

type StepKind = 'taak' | 'resource' | 'relatie' | 'terug' | 'opnieuw' | 'opslaan' | 'automatisch';
interface Step { readonly kind: StepKind; readonly pick: number }
const WEIGHTS: readonly [StepKind, number][] = [['taak', 4], ['resource', 1], ['relatie', 1], ['terug', 4], ['opnieuw', 1], ['opslaan', 3], ['automatisch', 1]];
const SAVES: ReadonlySet<StepKind> = new Set(['opslaan', 'automatisch']);

function randomSteps(seed: number, length: number): Step[] {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const total = WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  return Array.from({ length }, () => {
    let r = next() * total;
    const kind = WEIGHTS.find(([, w]) => (r -= w) < 0)?.[0] ?? 'opslaan';
    return { kind, pick: Math.floor(next() * 1000) };
  });
}

type Store = Awaited<ReturnType<typeof openInStore>>['store'];
interface Played { readonly store: Store; readonly ctrlS?: () => Promise<unknown>; readonly autoSave?: () => Promise<unknown> }

function linkedTasks(store: Store): ReadonlySet<string> {
  const source = store.getState().ifcSource!;
  const targets = new Set(source.foreignReferences?.targets ?? []);
  return new Set(Object.entries(source.stepIds).filter(([seed, step]) => seed.startsWith('task:') && targets.has(step)).map(([seed]) => seed.slice('task:'.length)));
}

class Player {
  private applied = 0;
  private undone = 0;
  private readonly linked: ReadonlySet<string>;
  constructor(private readonly doc: Played) { this.linked = linkedTasks(doc.store); }
  async play(step: Step): Promise<string> {
    const s = this.doc.store.getState();
    const byId = <T extends { id: string }>(list: readonly T[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
    const remove = (label: string, list: readonly { id: string; name?: string }[], run: (id: string) => void) => {
      if (list.length === 0) return `${label} (geen)`;
      const target = byId(list)[Math.floor(step.pick / 2) % list.length];
      run(target.id);
      this.applied++;
      this.undone = 0;
      return `${label} ${target.name ?? target.id}`;
    };
    switch (step.kind) {
      case 'taak': {
        const linked = s.tasks.filter(t => this.linked.has(t.id));
        return remove('wis taak', step.pick % 2 === 0 && linked.length > 0 ? linked : s.tasks, id => s.deleteTask(id));
      }
      case 'resource': return remove('wis resource', s.resources, id => s.removeResource(id));
      case 'relatie': return remove('wis relatie', s.sequences, id => s.removeSequence(id));
      case 'terug':
        if (this.applied === 0) return 'Ctrl+Z (niets)';
        s.undo(); this.applied--; this.undone++;
        return 'Ctrl+Z';
      case 'opnieuw':
        if (this.undone === 0) return 'Ctrl+Y (niets)';
        s.redo(); this.undone--; this.applied++;
        return 'Ctrl+Y';
      case 'opslaan':
        await this.doc.ctrlS?.();
        return 'Ctrl+S';
      case 'automatisch':
        await this.doc.autoSave?.();
        return 'Automatisch opslaan';
    }
  }
}

const errors = (store: Store) => store.getState().ui.notifications.filter(n => n.severity === 'error')
  .map(n => `${n.messageKey}${n.detail ? `: ${String(n.detail).slice(0, 300)}` : ''}`);

async function refusedWithoutDetached(bytes: Uint8Array, plan: readonly Step[]): Promise<boolean> {
  const { store } = await openInStore(bytes);
  const save = async () => {
    const prepared = (await prepareIfcOutput(store.getState(), buildWriteIFCInput(store.getState(), 'merge'))).prepared;
    if (prepared) store.setState(s => { s.ifcSource = castDraft({ ...prepared.source, detached: undefined }); });
  };
  const replay = new Player({ store, ctrlS: save, autoSave: save });
  for (const step of plan.slice(0, -1)) {
    try { await replay.play(step); } catch { return false; }
  }
  try { await replay.play(plan.at(-1)!); return false; } catch { return true; }
}

async function oneSaveAtTheEnd(bytes: Uint8Array, plan: readonly Step[]): Promise<Uint8Array | string> {
  const { store } = await openInStore(bytes), replay = new Player({ store });
  for (const step of plan) await replay.play(step);
  try {
    const output = await prepareIfcOutput(store.getState(), buildWriteIFCInput(store.getState(), 'merge'));
    return output.prepared?.bytes ?? encode(output.content!);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const SEEDS = Array.from({ length: 12 }, (_, i) => 11 + i);
const LENGTH = 12;
for (const [name, bytes] of FIXTURES) {
  await check(`de regel op ${name}: na elke opslag is het bestand gelijk aan één opslag aan het eind (zaden ${SEEDS[0]} tot en met ${SEEDS.at(-1)}, ${LENGTH} stappen en een laatste Ctrl+S)`, async () => {
    const found: string[] = [];
    let refusedBoth = 0, compared = 0, refusedLikeMain = 0;
    for (const seed of SEEDS) {
      const plan: Step[] = [...randomSteps(seed, LENGTH), { kind: 'opslaan', pick: 0 }];
      const doc = await route.open(bytes), player = new Player(doc);
      const labels: string[] = [];
      for (let i = 0; i < plan.length; i++) {
        const before = errors(doc.store).length;
        labels.push(await player.play(plan[i]));
        if (!SAVES.has(plan[i].kind)) continue;
        const expected = await oneSaveAtTheEnd(bytes, plan.slice(0, i + 1));
        const refused = errors(doc.store).slice(before);
        if (typeof expected === 'string') {
          if (refused.length === 0) found.push(`zaad ${seed}, na ${labels.join(' → ')}: de reeks schrijft, één opslag aan het eind weigert: ${expected.slice(0, 300)}`);
          else refusedBoth++;
          break;
        }
        compared++;
        if (refused.length > 0 && await refusedWithoutDetached(bytes, plan.slice(0, i + 1))) {
          console.log(`  zaad ${seed}: weigert ook met de bron zonder detached, zoals main (knownbug 2371): ${labels.join(' → ')}`);
          refusedLikeMain++;
          break;
        }
        const problems = [...refused.map(e => `de reeks weigert: ${e}`), ...await endDifferences(expected, doc.file())];
        if (problems.length > 0) {
          found.push(`zaad ${seed}, na ${labels.join(' → ')}:\n    ${problems.slice(0, 8).join('\n    ')}`);
          break;
        }
      }
      doc.close();
      console.log(`  zaad ${seed}: ${labels.join(' → ')}`);
    }
    console.log(`  ${compared} keer vergeleken na een opslag`);
    if (refusedLikeMain > 0) console.log(`  ${refusedLikeMain} reeks(en) gestopt waar de tussentijdse opslag ook zonder detached weigert`);
    if (refusedBoth > 0) console.log(`  ${refusedBoth} reeks(en) gestopt waar ook één opslag aan het eind weigert`);
    if (found.length > 0) throw new Error(`\n  ${found.join('\n  ')}`);
  });
}

const B4D = FIXTURES[0][1];
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const lineWith = (bytes: Uint8Array, guid: string) => decode(bytes).split(/\r?\n/).find(l => l.includes(`('${guid}'`));
const taskNamed = (store: Store, name: string) => store.getState().tasks.find(t => t.name === name)!.id;
const stepOf = (doc: { store: Store }, seed: string) => doc.store.getState().ifcSource!.stepIds[seed];
const countNotices = (store: Store) => store.getState().ui.notifications.filter(n => n.messageKey === 'notifications.foreignChangesWritten').map(n => n.params?.count);
const WAND_A = 'task:task-ifc-22icVZXFsEZ1Ius5rjnii6';
const METSELPLOEG = 'res:res-ifc-1RAmjWsPoBqSfsFswNCJJX';

async function atTheEnd(bytes: Uint8Array, edit: (store: Store) => void): Promise<Uint8Array> {
  const { store } = await openInStore(bytes);
  edit(store);
  return (await prepareIfcOutput(store.getState(), buildWriteIFCInput(store.getState(), 'merge'))).prepared!.bytes;
}
const deleteAndUndo = (name: string) => (store: Store) => { store.getState().deleteTask(taskNamed(store, name)); store.getState().undo(); };

await check('bonsai-4d.ifc: wissen, opslaan, Ctrl+Z, opslaan, heropenen: de taak en de vijf vreemde stukken zijn terug, met de verwijzing naar het huidige #id', async () => {
  const doc = await route.open(B4D);
  const id = taskNamed(doc.store, 'Wand A bouwen');
  doc.store.getState().deleteTask(id);
  assert.equal(await doc.ctrlS(), true, 'de eerste opslag schrijft');
  assert.deepEqual(countNotices(doc.store), [5], 'de telling van de eerste opslag');
  for (const guid of ['3rmDhv9f7mdZ0AEONco1oi', '2oLY78FIZdi8IJWejj6wJV', '3QiYKzhPjDbsDmw8S1hMW9']) assert.equal(lineWith(doc.file(), guid), undefined, `${guid} is weg`);
  assert.equal(doc.store.getState().ifcSource!.detached?.pieces.size, 5, 'de vijf stukken zijn bewaard');
  doc.store.getState().undo();
  assert(doc.store.getState().tasks.some(t => t.id === id), 'Ctrl+Z brengt de taak terug');
  assert.equal(await doc.ctrlS(), true, 'de tweede opslag schrijft');
  assert.deepEqual(countNotices(doc.store), [5], 'terugzetten telt niet mee in de melding');
  const written = doc.file(), reopened = await openForeign(written);
  const task = reopened.ifcSource!.stepIds[WAND_A];
  assert(task !== undefined, 'de taak staat in het heropende bestand');
  assert.equal(task, stepOf(doc, WAND_A), 'de bron na opslaan en het heropende bestand geven de taak hetzelfde #id');
  assert.notEqual(task, 104, 'de taak heeft een nieuw #id');
  assert.match(lineWith(written, '0oHvMxggWNftrR39jeFeUQ')!, new RegExp(`,\\(#${task},#144\\),\\$,#30\\);$`), 'de koppeling aan Wand A, met beide leden');
  assert.match(lineWith(written, '3rmDhv9f7mdZ0AEONco1oi')!, new RegExp(`,#119,\\$,\\$,\\(#118,#30\\),\\$,#${task},#121\\);$`), 'de toewijzing van Bonsai, met haar GlobalId en QuantityInProcess');
  assert.match(lineWith(written, '15BofJPOWYnhktOk_Bimg5')!, new RegExp(`\\(#${task},#108,#144,#160\\),\\$,#98\\);$`), 'de kalenderrelatie, in de oude volgorde');
  assert.match(lineWith(written, '2oLY78FIZdi8IJWejj6wJV')!, new RegExp(`\\(#${task}\\),#124\\);$`), 'de notitie van Bonsai');
  assert.match(lineWith(written, '3QiYKzhPjDbsDmw8S1hMW9')!, new RegExp(`\\(#144\\),#${task}\\);$`), 'de koppeling aan de baselinetaak');
  assert.equal(decode(written).match(/IFCRELASSIGNSTOPROCESS\(/g)?.length, decode(B4D).match(/IFCRELASSIGNSTOPROCESS\(/g)?.length, 'geen eigen toewijzingsrelatie naast die van Bonsai');
  assert.deepEqual(reopened.assignments.filter(a => a.taskId === id).length, 1, 'één toewijzing na heropenen');
  assert.deepEqual(await endDifferences(await atTheEnd(B4D, deleteAndUndo('Wand A bouwen')), written), [], 'gelijk aan dezelfde reeks zonder tussentijdse opslag');
  assert.equal(doc.store.getState().ifcSource!.detached, undefined, 'alles is terug: niets meer bewaard');
  const again = await prepareIfcOutput(doc.store.getState(), buildWriteIFCInput(doc.store.getState(), 'merge'));
  assert.deepEqual(again.prepared!.bytes, written, 'een tweede opslag direct daarna schrijft byte voor byte hetzelfde');
  const fresh = await openInStore(written);
  const after = await prepareIfcOutput(fresh.store.getState(), buildWriteIFCInput(fresh.store.getState(), 'merge'));
  assert.deepEqual(after.prepared!.bytes, written, 'ook na heropenen schrijft een opslag hetzelfde');
  doc.close();
});

await check('bonsai-4d.ifc zonder tussentijdse opslag: wissen, Ctrl+Z, opslaan geeft de koppelingen van de bron', async () => {
  const doc = await route.open(B4D);
  deleteAndUndo('Wand A bouwen')(doc.store);
  await doc.ctrlS();
  assert.equal(doc.store.getState().ifcSource!.detached, undefined, 'zonder tussentijdse opslag is er niets bewaard');
  for (const guid of ['0oHvMxggWNftrR39jeFeUQ', '3rmDhv9f7mdZ0AEONco1oi', '15BofJPOWYnhktOk_Bimg5', '2oLY78FIZdi8IJWejj6wJV', '3QiYKzhPjDbsDmw8S1hMW9']) {
    assert.equal(lineWith(doc.file(), guid), lineWith(B4D, guid), `${guid} bytegelijk`);
  }
  assert.deepEqual(await endDifferences(await atTheEnd(B4D, deleteAndUndo('Wand A bouwen')), doc.file()), []);
  doc.close();
});

await check('twee opslagrondes: de oudste versie komt terug, met alleen de leden die nog bestaan', async () => {
  const doc = await route.open(B4D);
  doc.store.getState().removeResource(METSELPLOEG.slice('res:'.length));
  await doc.ctrlS();
  assert.match(lineWith(doc.file(), '3rmDhv9f7mdZ0AEONco1oi')!, /,\(#30\),\$,#104,#121\);$/, 'ronde 1: de resource is uit de toewijzing van Bonsai');
  doc.store.getState().deleteTask(taskNamed(doc.store, 'Wand A bouwen'));
  await doc.ctrlS();
  assert.equal(lineWith(doc.file(), '3rmDhv9f7mdZ0AEONco1oi'), undefined, 'ronde 2: de toewijzing van Bonsai is weg');
  doc.store.getState().undo();
  await doc.ctrlS();
  const task = stepOf(doc, WAND_A);
  assert.match(lineWith(doc.file(), '3rmDhv9f7mdZ0AEONco1oi')!, new RegExp(`,#119,\\$,\\$,\\(#30\\),\\$,#${task},#121\\);$`), 'de taak terug: de oudste versie zonder de resource, die nog weg is');
  doc.store.getState().undo();
  await doc.ctrlS();
  const resource = stepOf(doc, METSELPLOEG);
  assert.match(lineWith(doc.file(), '3rmDhv9f7mdZ0AEONco1oi')!, new RegExp(`,#119,\\$,\\$,\\(#${resource},#30\\),\\$,#${task},#121\\);$`), 'ook de resource terug: de oudste versie helemaal');
  const expected = await atTheEnd(B4D, store => {
    store.getState().removeResource(METSELPLOEG.slice('res:'.length));
    store.getState().deleteTask(taskNamed(store, 'Wand A bouwen'));
    store.getState().undo();
    store.getState().undo();
  });
  assert.deepEqual(await endDifferences(expected, doc.file()), []);
  doc.close();
});

await check('de pinbron: een bewaarde toewijzing van Bonsai krijgt na Ctrl+Z haar resource terug, met haar GlobalId en QuantityInProcess', async () => {
  const bytes = FIXTURES[1][1], doc = await route.open(bytes), source = doc.store.getState().ifcSource!;
  const resource = Object.entries(source.stepIds).find(([seed, step]) => seed.startsWith('res:') && step === 110)![0];
  const guid = '0BonsaiFm3_b9f8mO9$CFm';
  assert.match(lineWith(bytes, guid)!, /,\(#109,#110\),\$,#63,#990014\);$/, 'de bron: een toewijzing van Bonsai met twee resources');
  const remove = (store: Store) => store.getState().removeResource(resource.slice('res:'.length));
  remove(doc.store);
  await doc.ctrlS();
  assert.match(lineWith(doc.file(), guid)!, /,\(#109\),\$,#63,#990014\);$/, 'na het wissen: alleen de andere resource');
  doc.store.getState().undo();
  await doc.ctrlS();
  assert.match(lineWith(doc.file(), guid)!, new RegExp(`,\\(#109,#${stepOf(doc, resource)}\\),\\$,#63,#990014\\);$`), 'na Ctrl+Z: de resource terug in dezelfde toewijzing');
  assert.deepEqual(await endDifferences(await atTheEnd(bytes, store => { remove(store); store.getState().undo(); }), doc.file()), []);
  doc.close();
});

await check('controle 1 telt teruggezette stukken mee als teruggezet, en alleen die', async () => {
  const doc = await route.open(B4D);
  doc.store.getState().deleteTask(taskNamed(doc.store, 'Wand A bouwen'));
  await doc.ctrlS();
  doc.store.getState().undo();
  const source = doc.store.getState().ifcSource!;
  const prepared = (await prepareIfcOutput(doc.store.getState(), buildWriteIFCInput(doc.store.getState(), 'merge'))).prepared!;
  assert.deepEqual(prepared.foreignChanges!.map(c => c.kind), ['teruggezet', 'teruggezet', 'teruggezet', 'teruggezet', 'teruggezet']);
  const index = scanForeignStep(source.bytes), cls = classify(index);
  const problems = (changes: readonly ForeignChange[]) => validateMergeOutput(index, cls, source.bytes, prepared.bytes, { changes }).problems;
  assert.deepEqual(problems(prepared.foreignChanges!), []);
  for (const left of prepared.foreignChanges!) {
    assert.notDeepEqual(problems(prepared.foreignChanges!.filter(c => c !== left)), [], `zonder #${left.id} op de lijst weigert controle 1`);
  }
  doc.close();
});

await check('geheugen: detached bewaart eigen kopieën, geen deel van de buffer van een bron', async () => {
  const doc = await route.open(B4D);
  const first = doc.store.getState().ifcSource!;
  doc.store.getState().deleteTask(taskNamed(doc.store, 'Wand A bouwen'));
  await doc.ctrlS();
  const next = doc.store.getState().ifcSource!;
  assert(next.detached && next.detached.pieces.size > 0);
  for (const [id, piece] of next.detached.pieces) {
    assert(piece.bytes.buffer !== first.bytes.buffer && piece.bytes.buffer !== next.bytes.buffer, `#${id} deelt de buffer van een bron`);
    assert.equal(piece.bytes.byteOffset, 0, `#${id} is een deel van een grotere buffer`);
    assert.equal(piece.bytes.buffer.byteLength, piece.bytes.byteLength, `#${id} houdt een grotere buffer vast`);
  }
  doc.close();
});

await check('Exporteren naar een ander doel en Exporteren zonder gebouwmodel verbruiken detached niet; Opslaan als neemt het mee', async () => {
  const doc = await route.open(B4D);
  doc.store.getState().deleteTask(taskNamed(doc.store, 'Wand A bouwen'));
  await doc.ctrlS();
  const kept = doc.store.getState().ifcSource!;
  doc.store.getState().undo();
  const exported = route.choose('export.ifc');
  await doc.store.getState().exportAs('ifc');
  assert.deepEqual(await endDifferences(await atTheEnd(B4D, deleteAndUndo('Wand A bouwen')), new Uint8Array(readFileSync(exported))), [], 'de export heeft het vreemde deel van de planning die de planner ziet');
  assert.equal(doc.store.getState().ifcSource, kept, 'de export vervangt de bron niet');
  setPlanOnlyAsker(async () => true);
  route.choose('zonder-model.ifc');
  await doc.store.getState().exportAs('ifc', { withoutBuildingModel: true });
  resetPlanOnlyAsker();
  assert.equal(doc.store.getState().ifcSource, kept, 'Exporteren zonder gebouwmodel vervangt de bron niet');
  doc.store.getState().redo();
  const as = route.choose('opslaan-als.ifc');
  await doc.store.getState().saveFileAs();
  assert.equal(doc.store.getState().filePath, as);
  assert.equal(doc.store.getState().ifcSource!.detached?.pieces.size, 5, 'Opslaan als neemt detached mee');
  doc.store.getState().undo();
  await doc.ctrlS();
  const expected = await atTheEnd(B4D, store => { deleteAndUndo('Wand A bouwen')(store); store.getState().redo(); store.getState().undo(); });
  assert.deepEqual(await endDifferences(expected, new Uint8Array(readFileSync(as))), [], 'Ctrl+S op het nieuwe bestand zet terug');
  doc.close();
});

await check('de knop Ongedaan maken: na een opslag, en tijdens een lopende opslag, komt het vreemde deel bij de volgende opslag terug', async () => {
  for (const during of [false, true]) {
    const doc = await route.open(B4D);
    doc.store.getState().deleteTask(taskNamed(doc.store, 'Wand A bouwen'));
    const notice = doc.store.getState().ui.notifications.find(n => n.messageKey === 'notifications.foreignLinksDropped')!;
    assert.equal(notice.action?.kind, 'undoHistoryEvent', 'de wismelding heeft de knop');
    const click = () => {
      const action = doc.store.getState().ui.notifications.find(n => n.id === notice.id)?.action;
      assert(action?.kind === 'undoHistoryEvent', 'de knop staat er nog');
      doc.store.getState().undoHistoryEvent(action.eventId);
      doc.store.getState().dismissNotification(notice.id);
    };
    if (during) {
      let clicked = false;
      route.ipc.faults.beforeOpen = () => { if (!clicked) { clicked = true; click(); } };
      await doc.ctrlS();
      route.ipc.faults.beforeOpen = null;
      assert(clicked, 'de klik viel tijdens de opslag');
      assert.notEqual(lineWith(doc.file(), '3rmDhv9f7mdZ0AEONco1oi'), lineWith(B4D, '3rmDhv9f7mdZ0AEONco1oi'), 'die opslag schreef de wisstap');
      assert.equal(doc.store.getState().isDirty, true, 'het document blijft gewijzigd');
    } else {
      await doc.ctrlS();
      click();
    }
    await doc.ctrlS();
    assert.deepEqual(await endDifferences(await atTheEnd(B4D, deleteAndUndo('Wand A bouwen')), doc.file()), [], `${during ? 'tijdens' : 'na'} de opslag: het vreemde deel is terug`);
    doc.close();
  }
});

await check('het taakpaneel tussen Ctrl+Z en de volgende opslag toont de koppelingen uit detached', async () => {
  const doc = await route.open(B4D);
  const id = taskNamed(doc.store, 'Wand A bouwen');
  const before = elementLinkCounts(taskElementLinks(doc.store.getState(), id)!);
  doc.store.getState().deleteTask(id);
  await doc.ctrlS();
  doc.store.getState().undo();
  assert.deepEqual(elementLinkCounts(taskElementLinks(doc.store.getState(), id)!), before);
  doc.close();
});

await check('flag aan, niets gewist: geen detached en geen teruggezet stuk', async () => {
  const doc = await route.open(B4D);
  const stuc = doc.store.getState().tasks.find(t => t.name === 'Stucwerk')!;
  doc.store.getState().updateTask(stuc.id, { time: { ...stuc.time, scheduleDuration: stuc.time.scheduleDuration + 1 } });
  await doc.ctrlS();
  assert.equal(doc.store.getState().ifcSource!.detached, undefined);
  doc.close();
});

route.dispose();
console.log(`Detached: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
