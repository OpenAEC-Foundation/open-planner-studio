import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';
import { tryMerge } from './ifcMergeKern';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery } from '@/services/recovery/recoveryStore';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import type { RecoverySnapshot } from '@/services/recovery/recoverySnapshotInput';
import { ifcGuid128, writeIFC } from '@/services/ifc/ifcWriter';

export const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
export const SCAFFOLDERS = 'Steigerbouwers', CRANE = 'Kraanmachinisten', THIRD = 'Derde ploeg';

export type Store = ReturnType<Awaited<ReturnType<typeof loadStore>>['createAppStoreContext']>['store'];
export type Loaded = Awaited<ReturnType<typeof loadRecovery>>;
export type Serialize = (source: IFCSaveSource, identities: boolean) => Promise<string | RecoverySnapshot>;

export function installSessionStorage(): void {
  const session = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v),
    removeItem: (k: string) => session.delete(k),
  } });
}

export function desktop(appDataDir?: string) {
  const ipc = installNodeFileIpc(appDataDir ? { appDataDir } : {});
  const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
  const invoke = internals.invoke;
  let target: string | null = null;
  internals.invoke = async (c, a, o) => c === 'plugin:dialog|save' ? target
    : c === 'plugin:fs|read_file' ? new Uint8Array(readFileSync((a as { path: string }).path)) : invoke(c, a, o);
  return { ...ipc, choose: (p: string) => { target = p; } };
}

export async function freshStore(enabled = true): Promise<Store> {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: enabled }; });
  return store;
}

export async function openAt(data: Uint8Array, path: string | null): Promise<Store> {
  if (path) writeFileSync(path, data);
  const store = await freshStore();
  await store.getState().openOpenedFile({ name: 'bron.ifc', content: '', bytes: data, ref: path ? { kind: 'path', path } : null });
  return store;
}

export async function saveAs(store: Store, target: string): Promise<Uint8Array> {
  const ipc = desktop(); ipc.choose(target);
  try { await store.getState().saveFileAs(); } finally { ipc.dispose(); }
  assert(existsSync(target), `bestand geschreven: ${target} (${store.getState().ui.notifications.map(n => n.messageKey).join(', ')})`);
  return new Uint8Array(readFileSync(target));
}

export function mainSnapshot(payload: IFCSaveSource, enabled = true): string {
  const mainSource = enabled && payload.ifcSource && !payload.ifcSource.foreign && payload.foreignSourceMark?.sourceMissing === undefined
    ? { ...payload, foreignSourceMark: null } : payload;
  const mark = mainSource.foreignSourceMark;
  return writeIFC({ ...buildWriteIFCInput(mainSource, 'planOnly'), xerSourceArchiveStorage: 'recovery-reference',
    ...(mark ? { recoveryForeignSource: { sha256: mark.sha256, byteLength: mark.byteLength } } : {}) });
}

export function pinMain(loaded: Loaded, store: Store, label: string, enabled = true) {
  let pinned = 0;
  for (const { id, payload } of store.getState().getOpenDocumentPayloads()) {
    const doc = loaded.docs.find(d => d.id === id);
    if (!doc) continue;
    assert.equal(doc.ifc, mainSnapshot(payload, enabled), `${label}: de snapshot is precies die van main`);
    pinned++;
  }
  assert(pinned > 0, `${label}: er is een snapshot vergeleken`);
}

export function recoveryDocuments(store: Store, enabled: boolean, onDesktop: boolean) {
  const capture = onDesktop ? desktop() : null;
  try { return store.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, enabled)); }
  finally { capture?.dispose(); }
}

export async function tick(store: Store, label: string, enabled = true, onDesktop = true, serialize?: Serialize) {
  const docs = recoveryDocuments(store, enabled, onDesktop);
  await runRecoveryTick(new RecoveryDeltaTracker(), store.getState().activeDocumentId, docs, serialize, undefined, () => {});
  const loaded = await loadRecovery();
  pinMain(loaded, store, label, enabled);
  return loaded;
}

export async function restore(loaded: Loaded, enabled = true, appDataDir?: string | null): Promise<Store> {
  const store = await freshStore();
  const ipc = appDataDir === null ? null : desktop(appDataDir);
  try {
    const inputs = [];
    for (const doc of loaded.docs) inputs.push(await readRecoveryDocument(doc, loaded.archives, enabled));
    assert.equal(store.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds.length, 0);
  } finally { ipc?.dispose(); }
  return store;
}

export const withoutField = (loaded: Loaded): Loaded => ({ ...loaded, docs: loaded.docs.map(({ snapshotIdentities: _field, ...doc }) => doc) });
export const withField = (loaded: Loaded, id: string, field: unknown): Loaded => ({
  ...loaded, docs: loaded.docs.map(doc => doc.id === id ? { ...doc, snapshotIdentities: field as never } : doc),
});

export function resourceLine(data: Uint8Array, name: string) {
  const index = scanForeignStep(data);
  for (let c = 0; c < index.count; c++) {
    if (!index.isEntity(c) || !index.type(c).endsWith('RESOURCE')) continue;
    if (index.argTokens(c)![2] === `'${name}'`) return { stepId: index.id(c), type: index.type(c), guid: index.globalId(c) };
  }
  return null;
}

export function entities(data: Uint8Array, type: string) {
  const index = scanForeignStep(data), out: { stepId: string; type: string; guid: string; name: string }[] = [];
  for (let c = 0; c < index.count; c++) {
    if (index.isEntity(c) && index.type(c) === type) out.push({ stepId: index.id(c), type, guid: index.globalId(c), name: index.argTokens(c)![2] });
  }
  return out;
}

const byText = (a: unknown, b: unknown) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
export function identities(store: Store, withSource = true) {
  const s = store.getState();
  const live = new Map<string, ReadonlySet<string>>([
    ['task', new Set(s.tasks.map(t => t.id))], ['res', new Set(s.resources.map(r => r.id))],
    ['cal', new Set([s.calendar.id, ...s.calendars.map(c => c.id)])], ['seq', new Set(s.sequences.map(q => q.id))],
  ]);
  const isLive = (seed: string) => {
    const at = seed.indexOf(':'), ids = live.get(seed.slice(0, at));
    return !ids || ids.has(seed.slice(at + 1));
  };
  return {
    resources: s.resources.map(r => [r.id, r.name, r.calendarId ?? null]).sort(byText),
    calendars: s.calendars.map(c => [c.id, c.name]).sort(byText),
    sequences: s.sequences.map(q => [q.id, q.predecessorId, q.successorId]).sort(byText),
    tasks: s.tasks.map(t => [t.id, t.name, t.calendarId ?? null, [...t.resourceIds].sort()]).sort(byText),
    assignments: s.assignments.map(a => [a.taskId, a.resourceId]).sort(byText),
    globalIds: Object.entries(s.ifcGlobalIds ?? {}).filter(([seed]) => isLive(seed)).sort(byText),
    stepIds: withSource ? Object.entries(s.ifcSource?.stepIds ?? {}).sort(byText) : [],
  };
}
export const sameIdentities = (actual: Store, expected: Store, label: string, withSource = true) =>
  assert.deepEqual(identities(actual, withSource), identities(expected, withSource), label);
export const resourceId = (store: Store, name: string) => store.getState().resources.find(r => r.name === name)?.id;
export const renameFirstTask = (store: Store, name: string) => {
  const task = store.getState().tasks.find(t => !t.isMilestone && t.childIds.length === 0)!;
  const previous = task.name;
  store.getState().updateTask(task.id, { name });
  return previous;
};
export const mergeKinds = async (store: Store) => {
  const outcome = await tryMerge(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
  return outcome.ok ? 'ok' : outcome.kinds.join(',');
};

export async function sharedGlobalIdSource(dir: string) {
  const model = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
  const builder = await openAt(model, join(dir, 'bouw.ifc'));
  for (const name of [SCAFFOLDERS, CRANE, THIRD]) builder.getState().addResource({ name, type: 'LABOR', description: '', maxUnits: 1, costPerHour: 0 });
  const { id: _projectCalendar, ...calendarBody } = builder.getState().calendar; void _projectCalendar;
  builder.getState().addCalendar({ ...calendarBody, name: 'Ploeg A' });
  const crewB = builder.getState().addCalendar({ ...calendarBody, name: 'Ploeg B' });
  const craneAtBuild = resourceId(builder, CRANE)!;
  builder.getState().updateResource(craneAtBuild, { calendarId: crewB });
  const assignedTask = builder.getState().tasks.find(t => !t.isMilestone && t.childIds.length === 0 && t.resourceIds.length === 0)!;
  builder.getState().assignResource(assignedTask.id, craneAtBuild, 1);
  assert(builder.getState().assignments.some(a => a.resourceId === craneAtBuild), 'de tweede resource is toegewezen');
  const built = await saveAs(builder, join(dir, 'bouw-opgeslagen.ifc'));
  const builtText = Buffer.from(built).toString('latin1');
  const occurrences = (guid: string) => builtText.split(guid).length - 1;
  const scaffolders = resourceLine(built, SCAFFOLDERS)!, crane = resourceLine(built, CRANE)!, third = resourceLine(built, THIRD)!;
  const calendars = entities(built, 'IFCWORKCALENDAR'), calendarA = calendars.find(c => c.name === "'Ploeg A'")!, calendarB = calendars.find(c => c.name === "'Ploeg B'")!;
  const [sequenceA, sequenceB] = entities(built, 'IFCRELSEQUENCE').filter(e => occurrences(e.guid) === 1);
  const [taskA, taskB] = entities(built, 'IFCTASK').filter(e => occurrences(e.guid) === 1);
  const pairs = [[scaffolders, crane], [calendarA, calendarB], [sequenceA, sequenceB], [taskA, taskB]] as const;
  for (const [first, second] of pairs) assert(first && second && occurrences(first.guid) === 1, 'de bouwbron heeft van elke soort een paar');
  assert(occurrences(crane.guid) > 1, 'de tweede resource heeft een verwijzing (de toewijzing)');
  const H = ifcGuid128(`res:res-ifc-${scaffolders.guid}`);
  const index = scanForeignStep(built);
  let highest = 0, foreignApplication = '';
  for (let c = 0; c < index.count; c++) {
    if (!index.isEntity(c)) continue;
    highest = Math.max(highest, Number(index.id(c)));
    if (index.type(c) === 'IFCAPPLICATION' && index.argTokens(c)![2] === "'Corpus modelleur'") foreignApplication = `#${index.id(c)}`;
  }
  let history = '';
  for (let c = 0; c < index.count && !history; c++) {
    if (index.isEntity(c) && index.type(c) === 'IFCOWNERHISTORY' && index.argTokens(c)![1] === foreignApplication) history = `#${index.id(c)}`;
  }
  assert(history, 'de fixture heeft een owner history van een ander programma');
  const [pset, prop, rel] = [highest + 1, highest + 2, highest + 3];
  const withForeignSet = (replacements: readonly (readonly [string, string])[]) => {
    let out = builtText;
    for (const [from, to] of replacements) out = out.split(from).join(to);
    return Uint8Array.from(out.replace(/ENDSEC;\r?\nEND-ISO-10303-21;/, end => [
      `#${pset}=IFCPROPERTYSET('1VreemdePsetOpKraanAaa',${history},'Vreemd_Planning',$,(#${prop}));`,
      `#${prop}=IFCPROPERTYSINGLEVALUE('Opmerking',$,IFCLABEL('van een ander programma'),$);`,
      `#${rel}=IFCRELDEFINESBYPROPERTIES('2VreemdeRelOpKraanAaaa',${history},$,$,(#${crane.stepId}),#${pset});`,
      end,
    ].join('\n')), c => c.charCodeAt(0));
  };
  const source = withForeignSet([...pairs.map(([first, second]) => [second.guid, first.guid] as const), [third.guid, H]]);
  assert.equal(resourceLine(source, THIRD)!.guid, H, 'de derde resource draagt H = ifcGuid128("res:res-ifc-" + G)');
  return { model, source, scaffolders, crane, third, calendarA, calendarB, H, withForeignSet };
}
