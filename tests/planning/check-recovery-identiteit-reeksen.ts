import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { desktop, hash, installSessionStorage, openAt, sharedGlobalIdSource, type Store } from './recoveryIdentityFixture';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { clearOwnRecovery, clearRecovery, holdRecoveryForLater, loadRecovery } from '@/services/recovery/recoveryStore';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import type { RecoveryDocInput } from '@/state/documentContract';

installDeterminism();
await loadStore();
installSessionStorage();

const TRANSACTION_STORES = ['records', 'xer-archives'];
let webFault: ((store: string, value: { id: string }) => boolean) | null = null;
let failCopy = false;
let transactionImage: Map<string, Map<string, unknown>> | null = null, aborted: Map<string, Map<string, unknown>> | null = null;
const db = installFakeRecoveryIndexedDb({
  onTransaction: mode => {
    if (mode === 'readwrite') transactionImage = new Map(TRANSACTION_STORES.map(name => [name, new Map(db.store(name))]));
  },
  onPut: (store, value) => {
    if (store === 'sources' && failCopy) throw new DOMException('bronquotum', 'QuotaExceededError');
    if (webFault?.(store, value)) { aborted = transactionImage; throw new DOMException('quotum', 'QuotaExceededError'); }
  },
});
const rollBackAbortedTransaction = () => {
  if (!aborted) return;
  for (const [name, image] of aborted) {
    const live = db.store(name);
    live.clear();
    for (const [key, value] of image) live.set(key, value);
  }
  aborted = null;
};

const dir = mkdtempSync(join(tmpdir(), 'ops-identiteit-reeksen-'));
const { source } = await sharedGlobalIdSource(dir);

function prng(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sequences(kinds: readonly string[], fixed: readonly (readonly string[])[], seed: number, length: number, minimum: number) {
  const random = prng(seed), covered = new Set<string>(), out: string[][] = [];
  const cover = (steps: readonly string[]) => { for (let i = 1; i < steps.length; i++) covered.add(`${steps[i - 1]}>${steps[i]}`); };
  for (const steps of fixed) { out.push([...steps]); cover(steps); }
  while (covered.size < kinds.length ** 2 || out.length < minimum) {
    const steps: string[] = [];
    for (let i = 0; i < length; i++) {
      const previous = steps.at(-1);
      const open = previous === undefined ? [] : kinds.filter(k => !covered.has(`${previous}>${k}`));
      const pool = open.length > 0 && random() < 0.8 ? open : kinds;
      steps.push(pool[Math.floor(random() * pool.length)]);
    }
    cover(steps);
    out.push(steps);
  }
  return { list: out, pairs: covered.size };
}

const byText = (a: unknown, b: unknown) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
function planning(read: RecoveryDocInput) {
  return {
    resources: read.resources.map(r => [r.id, r.name, r.calendarId ?? null]).sort(byText),
    calendars: (read.resourceCalendars ?? []).map(c => [c.id, c.name]).sort(byText),
    sequences: read.sequences.map(q => [q.id, q.predecessorId, q.successorId]).sort(byText),
    tasks: read.tasks.map(t => [t.id, t.calendarId ?? null, [...t.resourceIds].sort()]).sort(byText),
    assignments: read.assignments.map(a => [a.taskId, a.resourceId]).sort(byText),
    globalIds: Object.entries(read.ifcGlobalIds ?? {}).sort(byText),
  };
}

interface Own { res: Map<string, string>; cal: Map<string, string>; seq: Map<string, string>; globalIds: Record<string, string> }
function ownIdentities(store: Store): Own {
  const s = store.getState();
  return {
    res: new Map(s.resources.map(r => [r.name, r.id])),
    cal: new Map(s.calendars.map(c => [c.name, c.id])),
    seq: new Map(s.sequences.map(q => [`${q.predecessorId}>${q.successorId}`, q.id])),
    globalIds: { ...s.ifcGlobalIds },
  };
}
function foreignIds(read: RecoveryDocInput, own: Own): string[] {
  const wrong: string[] = [];
  const globalId = (seed: string) => {
    if ((read.ifcGlobalIds ?? {})[seed] !== own.globalIds[seed]) wrong.push(`${seed} draagt ${(read.ifcGlobalIds ?? {})[seed]}`);
  };
  for (const r of read.resources) {
    if (own.res.get(r.name) !== r.id) wrong.push(`resource ${r.name} kreeg ${r.id}`);
    else globalId(`res:${r.id}`);
  }
  for (const c of read.resourceCalendars ?? []) {
    if (c.id === read.calendar.id) continue;
    if (own.cal.get(c.name) !== c.id) wrong.push(`kalender ${c.name} kreeg ${c.id}`);
    else globalId(`cal:${c.id}`);
  }
  for (const q of read.sequences) {
    if (own.seq.get(`${q.predecessorId}>${q.successorId}`) !== q.id) wrong.push(`relatie ${q.predecessorId}>${q.successorId} kreeg ${q.id}`);
    else globalId(`seq:${q.id}`);
  }
  for (const t of read.tasks) if (own.globalIds[`task:${t.id}`] !== undefined) globalId(`task:${t.id}`);
  return wrong;
}

const WEB_KINDS = ['verschuif', 'ronde', 'mislukt:snapshot', 'mislukt:manifest', 'terug', 'opnieuw', 'tab', 'rotatie', 'opruimen', 'flag', 'bronkopie'];
const DESKTOP_KINDS = ['verschuif', 'ronde', 'mislukt:ifc-openen', 'mislukt:ifc-plaatsen', 'mislukt:manifest-openen', 'mislukt:manifest-plaatsen',
  'terug', 'opnieuw', 'tab', 'rotatie', 'opruimen', 'flag', 'opruimfout'];
const verdicts = { eigen: 0, main: 0, leeg: 0 };

async function runSequence(route: 'browser' | 'desktop', steps: readonly string[], n: number) {
  const appData = route === 'desktop' ? join(dir, `appdata-${n}`) : null;
  if (appData) mkdirSync(appData);
  const ipc = appData ? desktop(appData) : null;
  let lastOpened = '', desktopFault: string | null = null;
  if (ipc) {
    ipc.faults.beforeOpen = path => {
      lastOpened = path;
      if ((desktopFault === 'mislukt:ifc-openen' && path.endsWith('.ifc.tmp'))
        || (desktopFault === 'mislukt:manifest-openen' && path.endsWith('.documents.json.tmp'))) throw new Error('schijffout');
    };
    ipc.faults.onCall = command => {
      if (command !== 'plugin:fs|rename') return;
      if ((desktopFault === 'mislukt:ifc-plaatsen' && lastOpened.endsWith('.ifc.tmp'))
        || (desktopFault === 'mislukt:manifest-plaatsen' && lastOpened.endsWith('.documents.json.tmp'))) throw new Error('schijffout');
    };
  }
  try {
    const live = await openAt(source, appData ? join(dir, `reeks-${n}.ifc`) : null);
    const modelId = live.getState().activeDocumentId!;
    live.getState().newDocument();
    const otherId = live.getState().activeDocumentId!;
    live.getState().switchDocument(modelId);
    const own = ownIdentities(live);
    const duplicates = (['res', 'cal', 'seq'] as const).flatMap(kind => [...own[kind].values()]
      .filter(id => id.endsWith('-dup-2')).map(id => ({ kind, first: id.slice(0, -'-dup-2'.length), second: id })));
    assert.equal(duplicates.length, 3, 'een paar per soort: resource, kalender en relatie');
    const tracker = new RecoveryDeltaTracker();
    let flag = true, latest = null as { ifc: string; field: string; flag: boolean } | null;
    const fieldText = (field: unknown) => JSON.stringify(field ?? null);
    const present = (kind: 'res' | 'cal' | 'seq', id: string) => {
      const s = live.getState();
      return (kind === 'res' ? s.resources : kind === 'cal' ? s.calendars : s.sequences).some(o => o.id === id);
    };
    const round = async () => {
      const docs = live.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, flag));
      try {
        if (await runRecoveryTick(tracker, live.getState().activeDocumentId, docs, undefined, () => true, () => {})) {
          const written = (await loadRecovery()).docs.find(d => d.id === modelId);
          latest = written ? { ifc: written.ifc, field: fieldText(written.snapshotIdentities), flag } : null;
        }
        return 'geslaagd';
      } catch (error) {
        assert.match(String(error), /schijffout|QuotaExceeded|quotum/, `${route} reeks ${n}: alleen de ingebrachte schrijffout`);
        rollBackAbortedTransaction();
        return 'mislukt';
      }
    };
    for (const [i, step] of steps.entries()) {
      const label = `${route} reeks ${n} stap ${i + 1} (${steps.slice(0, i + 1).join(' → ')})`;
      if (['verschuif', 'terug', 'opnieuw'].includes(step) && live.getState().activeDocumentId !== modelId) live.getState().switchDocument(modelId);
      if (step === 'verschuif') {
        const pair = duplicates.find(p => present(p.kind, p.first) && present(p.kind, p.second));
        const s = live.getState();
        if (!pair) s.updateTask(s.tasks.find(t => !t.isMilestone && t.childIds.length === 0)!.id, { name: `Bewerking ${n}.${i}` });
        else if (pair.kind === 'res') s.removeResource(pair.first);
        else if (pair.kind === 'cal') s.removeCalendar(pair.first);
        else s.removeSequence(pair.first);
      } else if (step === 'ronde') await round();
      else if (step.startsWith('mislukt:')) {
        if (ipc) desktopFault = step;
        else webFault = (store, value) => store === 'records' && value.id.includes(step === 'mislukt:snapshot' ? '::doc::' : '::manifest');
        try { await round(); } finally { desktopFault = null; webFault = null; }
      } else if (step === 'terug') live.getState().undo();
      else if (step === 'opnieuw') live.getState().redo();
      else if (step === 'tab') {
        live.getState().switchDocument(live.getState().activeDocumentId === modelId ? otherId : modelId);
        await round();
      } else if (step === 'rotatie') {
        await holdRecoveryForLater([]);
        tracker.forgetPersisted();
      } else if (step === 'opruimen') {
        await tracker.runExclusive(async () => { try { await clearOwnRecovery(); } finally { tracker.forgetPersisted(); } });
        if (ipc) latest = null;
      } else if (step === 'flag') {
        flag = !flag;
        live.setState(s => { s.ui.featureFlags = { ifcForeignContent: flag }; });
      } else if (step === 'bronkopie') {
        failCopy = true;
        try { await round(); } finally { failCopy = false; }
      } else if (step === 'opruimfout') {
        ipc!.faults.removeError = 'verwijderen mislukt';
        try { await round(); } finally { ipc!.faults.removeError = null; }
      } else throw new Error(`onbekende stap ${step}`);

      const loaded = await loadRecovery();
      const stored = loaded.docs.find(d => d.id === modelId);
      if (!stored) { verdicts.leeg++; continue; }
      if (stored.snapshotIdentities !== undefined) {
        assert.equal(stored.snapshotIdentities.sha256, hash(Buffer.from(stored.ifc)), `${label}: de bewaarde koppeling hoort bij de bewaarde snapshot`);
      }
      const { ifcSource: _source, sourceCopyDocumentKey: _copy, ...planOnly } = stored;
      const read = await readRecoveryDocument(planOnly, loaded.archives, flag);
      const wrong = foreignIds(read, own);
      if (wrong.length === 0) { verdicts.eigen++; continue; }
      const main = await readRecoveryDocument({ ...planOnly, snapshotIdentities: undefined }, loaded.archives, flag);
      assert.deepEqual(planning(read), planning(main), `${label}: een herstel dat niet het eigen is, is precies dat van main (${wrong.join('; ')})`);
      const newest = latest !== null && latest.ifc === stored.ifc && latest.field === fieldText(stored.snapshotIdentities);
      assert(!(flag && newest && latest?.flag), `${label}: de laatst geschreven versie, geschreven met de flag aan, herstelt elk object zijn eigen id (${wrong.join('; ')})`);
      verdicts.main++;
    }
  } finally {
    ipc?.dispose();
    await clearRecovery();
  }
}

const web = sequences(WEB_KINDS, [
  ['ronde', 'verschuif', 'mislukt:snapshot', 'terug', 'tab'],
  ['flag', 'ronde', 'flag', 'ronde'],
], 804, 12, 12);
for (const [n, steps] of web.list.entries()) await runSequence('browser', steps, n);
const webSteps = web.list.reduce((sum, steps) => sum + steps.length, 0);
console.log(`BROWSER: ${web.list.length} reeksen, ${webSteps} stappen, ${web.pairs} van ${WEB_KINDS.length ** 2} paren van opeenvolgende stappen.`);
const disk = sequences(DESKTOP_KINDS, [
  ['ronde', 'verschuif', 'mislukt:manifest-openen', 'terug', 'tab'],
  ['flag', 'ronde', 'flag', 'ronde'],
], 1198, 12, 12);
for (const [n, steps] of disk.list.entries()) await runSequence('desktop', steps, n);
const diskSteps = disk.list.reduce((sum, steps) => sum + steps.length, 0);
console.log(`DESKTOP: ${disk.list.length} reeksen, ${diskSteps} stappen, ${disk.pairs} van ${DESKTOP_KINDS.length ** 2} paren van opeenvolgende stappen.`);
assert.equal(web.pairs, WEB_KINDS.length ** 2);
assert.equal(disk.pairs, DESKTOP_KINDS.length ** 2);
assert(verdicts.eigen > 0 && verdicts.main > 0, 'beide uitkomsten komen voor');
console.log(`OK  recovery-identiteit-reeksen: na elke stap het eigen herstel (${verdicts.eigen}x) of precies dat van main (${verdicts.main}x), ${verdicts.leeg}x niets op schijf; nooit een object met het id van een ander.`);
