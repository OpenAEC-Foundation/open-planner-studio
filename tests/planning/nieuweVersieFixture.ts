import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { installNodeFileIpc } from './nodeFileIpc';

installBrowserStubs();
installFakeRecoveryIndexedDb();
const reseed = installDeterminism();
export const realError = console.error;
console.error = () => {};

const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const { buildImportLabels } = await import('@/i18n/importLabels');
export type App = ReturnType<typeof createAppStoreContext>;
export type Store = App['store'];

let checks = 0;
const diffs: string[] = [];
export const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: ${g?.slice(0, 400)} ≠ ${w?.slice(0, 400)}`);
};
export const report = (name: string) => {
  console.error = realError;
  for (const diff of diffs) console.log(`XX ${diff}`);
  console.log(`${name}: ${checks} controles, ${diffs.length} afwijkingen`);
  if (diffs.length) process.exitCode = 1;
};
export const labels = buildImportLabels((key) => key);
export const enc = new TextEncoder();

export function newApp(flag: boolean): App {
  reseed(0x804);
  const app = createAppStoreContext();
  if (flag) app.store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  return app;
}
function planIfc(name: string, task: string): string {
  const store = newApp(false).store;
  store.getState().newProject();
  store.getState().setProject({ name, startDate: '2026-01-05' });
  store.getState().addTask({ name: task });
  return writeIFC(buildWriteIFCInput(store.getState(), 'planOnly'));
}
export function gate() {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => { open = resolve; });
  return { wait, open: () => open() };
}
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export const until = async (cond: () => boolean) => {
  for (let i = 0; i < 400 && !cond(); i++) await sleep(5);
  return cond();
};
export const kantoorIfc = planIfc('Kantoor', 'Fundering');
export const schoolIfc = planIfc('School', 'Dak');
export const changedIfc = planIfc('Kantoor', 'Extern opgeslagen werk');
export const errors = (store: Store) => store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);
export const names = (store: Store) => store.getState().tasks.map(t => t.name);
export const has = (store: Store, id: string) => store.getState().documents.some(d => d.id === id);

export const dir = mkdtempSync(join(tmpdir(), 'ops-nieuwe-versie-'));
export const kantoor = join(dir, 'kantoor.ifc');
export const school = join(dir, 'school.ifc');
export const onDisk = (path = kantoor) => createHash('sha256').update(readFileSync(path)).digest('hex');
export const ipc = installNodeFileIpc({ appDataDir: mkdtempSync(join(tmpdir(), 'ops-nieuwe-versie-appdata-')) });
export const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
win.parent = win;
export const dialog: { open: string | null; save: string | null } = { open: null, save: null };
export type Invoke = (command: string, args: unknown, options?: unknown) => Promise<unknown>;
export const internals = win.__TAURI_INTERNALS__ as { invoke: Invoke };
const innerInvoke = internals.invoke;
export const baseInvoke: Invoke = async (command, args, options) => {
  if (command === 'plugin:dialog|open') return dialog.open;
  if (command === 'plugin:dialog|save') return dialog.save;
  return innerInvoke(command, args, options);
};
export const resetInvoke = () => { internals.invoke = baseInvoke; };
resetInvoke();
export const isRead = (command: string, args: unknown, path = kantoor) =>
  /^plugin:fs\|read_(text_)?file$/.test(command) && (args as { path?: string } | undefined)?.path === path;
export const openPath = async (store: Store, path: string) => {
  dialog.open = path;
  await store.getState().openFile(labels);
};

export async function setup(dirty: boolean) {
  writeFileSync(kantoor, kantoorIfc);
  writeFileSync(school, schoolIfc);
  const app = newApp(true);
  const st = app.store;
  const T = () => st.getState();
  await openPath(st, kantoor);
  const a = T().activeDocumentId;
  if (dirty) T().addTask({ name: 'Eigen werk' });
  T().newDocument();
  await openPath(st, school);
  const b = T().activeDocumentId;
  writeFileSync(kantoor, changedIfc);
  await openPath(st, kantoor);
  st.setState(s => { s.ui.notifications = []; });
  return { app, st, T, a, b };
}
