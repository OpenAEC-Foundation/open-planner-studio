// Knownbug 166: Tauri wijst af met strings. Test de echte store-catches met een nep-pluginrand;
// Recent/Voorbeeld injecteren een fout bij het toepassen van geldig IFC, na de echte parser.
// Geen echte desktopdialogen of gebruikersbestanden worden geopend.
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
const g = globalThis as unknown as Record<string, unknown>;
const win: Record<string, unknown> = {};
win.parent = win;
g.window = win;
const mem = new Map<string, string>();
const storage = { getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } };
g.localStorage = storage;
g.sessionStorage = storage;
installFakeRecoveryIndexedDb();
const { useAppStore } = await import('@/state/appStore');
const { writeIFC } = await import('@/services/ifc/ifcWriter');
const { buildWriteIFCInput } = await import('@/state/ifcSaveInput');
const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
};
S().newProject();
S().addTask({ name: 'Bestaand werk' });
const ifc = writeIFC(buildWriteIFCInput(S()));
const originalOpen = S().openAsDocument;
const originalApply = S().applyLoadedProject;
let failure: unknown = 'Permission denied (os error 13)';
let failAt: 'dialog' | 'read' | 'apply' | 'cancel' = 'dialog';
win.__TAURI_INTERNALS__ = {
  invoke: async (cmd: string) => {
    if (cmd === 'plugin:dialog|open') {
      if (failAt === 'dialog') throw failure;
      return failAt === 'cancel' ? null : '/fixture.ifc';
    }
    if (cmd === 'plugin:fs|read_text_file') {
      if (failAt === 'read') throw failure;
      return new TextEncoder().encode(ifc);
    }
    throw new Error(`Onverwachte plugin-aanroep: ${cmd}`);
  },
};
const clear = () => useAppStore.setState(s => { s.ui.notifications = []; });
const snapshot = () => ({ taskIds: S().tasks.map(t => t.id), active: S().activeDocumentId,
  documents: S().documents.map(d => d.id), dirty: S().isDirty, filePath: S().filePath });
async function checkFailure(label: string, run: () => Promise<unknown>, key: string, detail: string) {
  clear();
  const before = snapshot();
  await run();
  eq(`${label}: één fout met reden`, S().ui.notifications.map(n => [n.severity, n.messageKey, n.detail]), [['error', key, detail]]);
  eq(`${label}: document blijft intact`, snapshot(), before);
}
for (const reason of ['Permission denied (os error 13)', new Error('Onleesbaar bestand')]) {
  failure = reason;
  const detail = reason instanceof Error ? reason.message : reason;
  for (const stage of ['dialog', 'read'] as const) {
    failAt = stage;
    await checkFailure(`Openen ${stage} ${typeof reason}`, () => S().openFile(), 'notifications.openFailed', detail);
  }
  failAt = 'apply';
  useAppStore.setState({ openAsDocument: () => { throw failure; },
    recentFiles: [{ id: 'fixture', name: 'fixture.ifc', ref: { kind: 'path', path: '/fixture.ifc' }, addedAt: 1 }] });
  await checkFailure(`Recent ${typeof reason}`, () => S().openRecentFile('fixture'), 'notifications.openFailed', detail);
  // Een pristine tabblad voorkomt een bewuste nieuw-tabbladstap vóór de geïnjecteerde apply-fout.
  S().newProject();
  useAppStore.setState({ openAsDocument: originalOpen, applyLoadedProject: () => { throw failure; } });
  await checkFailure(`Voorbeeld ${typeof reason}`, () => S().openExampleFromString(ifc, 'fixture.ifc'), 'notifications.openFailed', detail);
  useAppStore.setState({ applyLoadedProject: originalApply });
}
failAt = 'cancel';
clear();
await S().openFile();
eq('Annuleren geeft geen fout', S().ui.notifications, []);
delete win.__TAURI_INTERNALS__;
if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`open-failure-detail: ${diffs.length} afwijkingen bij ${checks} controles`);
  process.exitCode = 1;
} else console.log(`OK open-failure-detail: ${checks} controles groen`);
