// De store-context: iedere instantie bezit niet alleen state, maar ook haar uitvoeringsmetadata.
//
// `createAppStoreContext()` is de positieve ownershipgrens: store en uitvoeringsmetadata horen bij
// dezelfde context. `createAppStore()` blijft de kale compatibiliteitsfactory en de gemounte
// productinterface blijft één app-singleton gebruiken. Deze batterij bewijst documentstate,
// runtimes, interleaved mutaties, extensiedata/hostbinding en het contextlokale appklembord.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import {
  appStoreContext,
  createAppStore,
  createAppStoreContext,
  useAppStore,
} from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';
import {
  createExtensionApi,
  type ExtensionHostBinding,
} from '@/extensions/extensionApi';
import { getExtensionSdk } from '@/extensions/sdk';
import {
  clearCjkFontProviders,
  getCjkFontProviders,
} from '@/services/pdf/fontRegistry';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

// ── 1. Twee contexten zijn state- én runtimegescheiden ────────────────────────
const contextA = createAppStoreContext();
const contextB = createAppStoreContext();
const A = contextA.store;
const B = contextB.store;
const appliedHistoryDepth = (store: typeof A) => store.getState().historyEvents
  .filter(event => event.state === 'applied').length;
const undoneHistoryDepth = (store: typeof A) => store.getState().historyEvents
  .filter(event => event.state === 'undone').length;

eq('1 de factory levert twee verschillende stores', A === B, false);
eq('1a geen van beide is de singleton', A === useAppStore || B === useAppStore, false);
eq('1b iedere context levert een verschillend runtimeobject', contextA.runtime === contextB.runtime, false);
eq('1c de singleton is ook een contextinstantie', appStoreContext.store === useAppStore, true);
const bareStore = createAppStore();
eq('1d createAppStore blijft een kale Zustandstore leveren',
  ['getState', 'setState', 'subscribe']
    .every(k => typeof (bareStore as unknown as Record<string, unknown>)[k] === 'function'), true);

eq('2 A start zonder taken', A.getState().tasks.length, 0);
eq('2a B ook', B.getState().tasks.length, 0);
eq('2b maar niet met hetzelfde state-object', A.getState() === B.getState(), false);

// ── 2. Projectdata is per instantie ───────────────────────────────────
{
  const a1 = A.getState().addTask({ name: 'alleen in A' });
  eq('3 A heeft de taak', A.getState().tasks.length, 1);
  eq('3a B niet', B.getState().tasks.length, 0);
  eq('3b de singleton is niet geraakt', useAppStore.getState().tasks.some(t => t.id === a1), false);

  const b1 = B.getState().addTask({ name: 'alleen in B' });
  B.getState().addTask({ name: 'en nog een in B' });
  eq('4 B heeft er nu twee', B.getState().tasks.length, 2);
  eq('4a A nog steeds één', A.getState().tasks.length, 1);

  A.getState().updateTask(a1, { name: 'hernoemd in A' });
  eq('5 de naam in A veranderde', A.getState().tasks[0]?.name, 'hernoemd in A');
  eq('5a die in B niet', B.getState().tasks.find(t => t.id === b1)?.name, 'alleen in B');

  A.getState().setProject({ name: 'Project A' });
  B.getState().setProject({ name: 'Project B' });
  eq('6 projectnaam A', A.getState().project.name, 'Project A');
  eq('6a projectnaam B', B.getState().project.name, 'Project B');

  A.getState().addResource({ name: 'Kraan A', type: 'EQUIPMENT', description: '', maxUnits: 1 });
  eq('7 resource in A', A.getState().resources.length, 1);
  eq('7a niet in B', B.getState().resources.length, 0);
}

// ── 3. Undo/redo is per instantie ────────────────────────────────────
{
  const diepteA = appliedHistoryDepth(A);
  const diepteB = appliedHistoryDepth(B);
  eq('8 beide hebben een eigen undo-stack met eigen diepte', diepteA === diepteB, false);

  const naamVoor = B.getState().tasks[0]?.name;
  B.getState().addTask({ name: 'derde in B' });
  eq('9 B groeide', B.getState().tasks.length, 3);
  eq('9a A niet', A.getState().tasks.length, 1);

  B.getState().undo();
  eq('10 undo op B draaide B terug', B.getState().tasks.length, 2);
  eq('10a en liet A met rust', A.getState().tasks.length, 1);
  eq('10b de eerste taak van B is ongemoeid', B.getState().tasks[0]?.name, naamVoor);

  const redoB = undoneHistoryDepth(B);
  A.getState().undo();
  eq('11 undo op A liet de redo-geschiedenis van B staan', undoneHistoryDepth(B), redoB);
}

// ── 4. Batchruntime is contextgebonden ────────────────────────────────────
{
  const batchA = createAppStoreContext();
  const batchB = createAppStoreContext();
  const txB = createBatchTransactions(batchB);
  const appVoor = capturePayload(useAppStore.getState());
  const aVoor = capturePayload(batchA.store.getState());
  const aUndoVoor = appliedHistoryDepth(batchA.store);
  const bUndoVoor = appliedHistoryDepth(batchB.store);
  const appUndoVoor = appliedHistoryDepth(useAppStore);

  txB.withTransaction(() => {
    eq('12 tijdens de batch is alleen runtime B actief', batchB.runtime.isBatchActive(), true);
    eq('12a runtime A blijft buiten de batch', batchA.runtime.isBatchActive(), false);
    batchB.store.getState().addTask({ name: 'bulk in B' });
    batchB.store.getState().addTask({ name: 'bulk in B 2' });
  });
  eq('12b twee mutators in B leveren één B-snapshot',
    appliedHistoryDepth(batchB.store), bUndoVoor + 1);
  eq('12c A krijgt door batch B geen snapshot', appliedHistoryDepth(batchA.store), aUndoVoor);
  eq('12d de app-singleton krijgt door batch B geen snapshot',
    appliedHistoryDepth(useAppStore), appUndoVoor);
  eq('12e A blijft byte-inhoudelijk gelijk', capturePayload(batchA.store.getState()), aVoor);
  eq('12f de app-singleton blijft byte-inhoudelijk gelijk', capturePayload(useAppStore.getState()), appVoor);
  eq('12g runtime B sluit na de callback', batchB.runtime.isBatchActive(), false);

  const interleavedA = createAppStoreContext();
  const interleavedB = createAppStoreContext();
  const txInterleavedB = createBatchTransactions(interleavedB);
  const interleavedAUndoVoor = appliedHistoryDepth(interleavedA.store);
  const interleavedBUndoVoor = appliedHistoryDepth(interleavedB.store);
  txInterleavedB.withTransaction(() => {
    interleavedB.store.getState().addTask({ name: 'B binnen eigen batch' });
    interleavedA.store.getState().addTask({ name: 'A tijdens batch B' });
  });
  eq('13 mutatie A tijdens batch B krijgt een eigen undo-stap',
    appliedHistoryDepth(interleavedA.store), interleavedAUndoVoor + 1);
  eq('13a batch B houdt precies één eigen undo-stap',
    appliedHistoryDepth(interleavedB.store), interleavedBUndoVoor + 1);
}

// ── 5. Klembord blijft app-globaal; paste-undo hoort bij de doelcontext ────────
{
  const pasteA = createAppStoreContext();
  const pasteB = createAppStoreContext();
  const appVoor = capturePayload(useAppStore.getState());
  const aVoor = capturePayload(pasteA.store.getState());
  const sourceId = pasteB.store.getState().addTask({ name: 'kopieerbare tak' });
  pasteB.store.getState().copyTasks([sourceId]);
  const clipboardVoor = pasteB.store.getState().taskClipboard;
  pasteB.store.getState().newDocument();
  eq('14 copyTasks-klembord overleeft een documentwissel in dezelfde appcontext',
    pasteB.store.getState().taskClipboard, clipboardVoor);

  const bUndoVoor = appliedHistoryDepth(pasteB.store);
  const pasted = pasteB.store.getState().pasteTasks();
  eq('14a paste op B maakt één nieuwe root', pasted.length, 1);
  eq('14b paste op B pusht alleen op B één snapshot',
    appliedHistoryDepth(pasteB.store), bUndoVoor + 1);
  eq('14c paste op B gebruikt de klembordinhoud', pasteB.store.getState().tasks[0]?.name, 'kopieerbare tak');
  eq('14d paste op B laat A byte-inhoudelijk gelijk', capturePayload(pasteA.store.getState()), aVoor);
  eq('14e paste op B laat de app-singleton byte-inhoudelijk gelijk', capturePayload(useAppStore.getState()), appVoor);
}

// ── 6. Extensiedata volgt document B; appregistraties volgen host A ─────────
{
  const extensionA = createAppStoreContext();
  const extensionB = createAppStoreContext();
  const A = extensionA.store;
  const B = extensionB.store;

  A.getState().setProject({ name: 'Hostdocument A' });
  A.getState().addTask({ name: 'Taak alleen in A' });
  B.getState().setProject({ name: 'Document B' });
  B.getState().setCalendar({ ...B.getState().calendar, name: 'Kalender B' });
  const voorganger = B.getState().addTask({ name: 'Voorganger B' });
  const opvolger = B.getState().addTask({ name: 'Opvolger B' });
  B.getState().addSequence({
    predecessorId: voorganger,
    successorId: opvolger,
    type: 'FINISH_START',
    lagDays: 0,
  });
  const resource = B.getState().addResource({
    name: 'Kraan B',
    type: 'EQUIPMENT',
    description: '',
    maxUnits: 1,
  });
  B.getState().assignResource(voorganger, resource, 1);

  const notificationsA: string[] = [];
  const notificationsB: string[] = [];
  const hostA: ExtensionHostBinding = {
    app: extensionA,
    showNotification: (extensionId, message, type) => {
      notificationsA.push(`${extensionId}|${type}|${message}`);
    },
  };
  const hostB: ExtensionHostBinding = {
    app: extensionB,
    showNotification: (extensionId, message, type) => {
      notificationsB.push(`${extensionId}|${type}|${message}`);
    },
  };
  const permissions = ['ribbon', 'backstage', 'events', 'pdf-fonts'] as const;
  const api = createExtensionApi(
    'context-test', [...permissions], undefined, extensionB, hostA,
  );
  const peerApi = createExtensionApi(
    'context-test', [...permissions], undefined, extensionA, hostB,
  );

  const aVoorBatch = capturePayload(A.getState());
  const singletonVoorBatch = capturePayload(useAppStore.getState());
  const aUndoVoorBatch = appliedHistoryDepth(A);
  const bUndoVoorBatch = appliedHistoryDepth(B);
  const bTakenVoorBatch = B.getState().tasks.length;
  api.data.batch(() => {
    api.data.addTask({ name: 'Bulk B 1' });
    api.data.addTask({ name: 'Bulk B 2' });
  });
  eq('17 extensiebatch voegt twee taken toe aan document B',
    B.getState().tasks.length, bTakenVoorBatch + 2);
  eq('17a extensiebatch vormt precies één undo-stap in B',
    appliedHistoryDepth(B), bUndoVoorBatch + 1);
  eq('17b extensiebatch verandert undo van A niet',
    appliedHistoryDepth(A), aUndoVoorBatch);
  eq('17c extensiebatch laat document A byte-inhoudelijk gelijk',
    capturePayload(A.getState()), aVoorBatch);
  eq('17d extensiebatch laat de app-singleton byte-inhoudelijk gelijk',
    capturePayload(useAppStore.getState()), singletonVoorBatch);

  eq('18 data.getProject leest document B', api.data.getProject().name, 'Document B');
  eq('18a data.getCalendar leest document B', api.data.getCalendar().name, 'Kalender B');
  eq('18b data.getTasks leest document B',
    api.data.getTasks().map(task => task.name),
    ['Voorganger B', 'Opvolger B', 'Bulk B 1', 'Bulk B 2']);
  eq('18c data.getSequences leest document B', api.data.getSequences().length, 1);
  eq('18d data.getResources leest document B', api.data.getResources().map(r => r.name), ['Kraan B']);
  eq('18e data.getAssignments leest document B', api.data.getAssignments().length, 1);

  const customUndoVoor = appliedHistoryDepth(B);
  const customId = api.data.addTask({
    name: 'Engineering B',
    customTaskType: { id: '  ops-engineering  ', name: '  Engineering  ' },
  });
  eq('18f extensie materialiseert getrimde custom id+naam in document B',
    B.getState().customTaskTypes, [{ id: 'ops-engineering', name: 'Engineering' }]);
  eq('18g extensie kent de custom classificatie aan de taak toe',
    B.getState().tasks.find(task => task.id === customId)?.customTaskTypeId, 'ops-engineering');
  eq('18h extensielezing geeft stabiele id plus projectsnapshotnaam terug',
    api.data.getTasks().find(task => task.id === customId)?.customTaskType,
    { id: 'ops-engineering', name: 'Engineering' });
  eq('18i catalogusmaterialisatie plus taak vormt één undo-stap',
    appliedHistoryDepth(B), customUndoVoor + 1);

  let nameConflict = false;
  try {
    api.data.addTask({ name: 'Conflict', customTaskType: { id: 'ops-anders', name: 'engineering' } });
  } catch { nameConflict = true; }
  eq('18j dezelfde naam met andere id wordt vóór mutatie geweigerd', nameConflict, true);
  eq('18k geweigerde extensieclassificatie maakt geen halve taak',
    B.getState().tasks.some(task => task.name === 'Conflict'), false);

  api.data.updateTask(customId, { taskType: 'CONSTRUCTION' });
  eq('18l expliciete builtin via extensie wist alleen de taaktoewijzing',
    B.getState().tasks.find(task => task.id === customId)?.customTaskTypeId, undefined);
  eq('18m builtin-update behoudt de projectsnapshot',
    B.getState().customTaskTypes, [{ id: 'ops-engineering', name: 'Engineering' }]);
  api.data.updateTask(customId, { customTaskType: { id: 'ops-engineering' } });
  eq('18n bestaand custom id kan zonder herhaalde naam opnieuw worden toegewezen',
    B.getState().tasks.find(task => task.id === customId)?.customTaskTypeId, 'ops-engineering');
  api.data.updateTask('bestaat-niet', { customTaskType: { id: 'ops-wees', name: 'Wees' } });
  eq('18o onbekend update-id materialiseert geen wees in de projectcatalogus',
    B.getState().customTaskTypes, [{ id: 'ops-engineering', name: 'Engineering' }]);

  A.setState({ scheduleStale: true });
  B.setState({ scheduleStale: true });
  const aVoorRecalculate = capturePayload(A.getState());
  api.data.recalculate();
  eq('19 recalculate maakt alleen planning B vers', B.getState().scheduleStale, false);
  eq('19a recalculate raakt planning A niet', capturePayload(A.getState()), aVoorRecalculate);

  const sdk = getExtensionSdk();
  const sdkCustomTask = sdk.factory.createTask({
    name: 'SDK custom',
    customTaskType: { id: ' ops-sdk ', name: ' SDK type ' },
  });
  eq('19b SDK-factory behoudt stabiele custom id plus getrimde snapshotnaam',
    sdkCustomTask.customTaskType, { id: 'ops-sdk', name: 'SDK type' });
  eq('19c SDK-factory zet custom classificaties nooit stil op CONSTRUCTION',
    sdkCustomTask.taskType, 'USERDEFINED');
  const geladenProject = sdk.factory.emptyImportResult({
    project: { ...sdk.factory.createProject(), name: 'Geladen via extensie in B' },
    tasks: [sdk.factory.createTask({ name: 'Geladen taak B' })],
  });
  const aVoorLoad = capturePayload(A.getState());
  api.data.loadProject(geladenProject);
  eq('20 loadProject vervangt alleen document B', B.getState().project.name, 'Geladen via extensie in B');
  eq('20a loadProject vult alleen document B', B.getState().tasks.map(task => task.name), ['Geladen taak B']);
  eq('20b loadProject rekent document B door', B.getState().scheduleStale, false);
  eq('20c loadProject laat document A byte-inhoudelijk gelijk', capturePayload(A.getState()), aVoorLoad);

  const conflictProject = sdk.factory.emptyImportResult({
    tasks: [sdk.factory.createTask({
      name: 'Conflictimport',
      customTaskType: { id: 'ops-conflict-a', name: 'Dubbel' },
    })],
    customTaskTypes: [{ id: 'ops-conflict-b', name: 'dubbel' }],
  });
  const bVoorConflictLoad = capturePayload(B.getState());
  let importConflict = false;
  try { api.data.loadProject(conflictProject); } catch { importConflict = true; }
  eq('20d extensie-import weigert dezelfde naam met conflicterende ids', importConflict, true);
  eq('20e conflicterende extensie-import laat het document byte-inhoudelijk gelijk',
    capturePayload(B.getState()), bVoorConflictLoad);

  api.importers.register({
    id: 'context-importer',
    name: 'Contextimporter',
    description: '',
    fileExtensions: ['.ctx'],
    handler: async () => sdk.factory.emptyImportResult(),
  });
  api.ui.addRibbonButton({
    tab: 'planning',
    group: 'Context',
    label: 'Contextknop',
    onClick: () => undefined,
  });
  api.ui.showNotification('alleen naar host A', 'warning');
  eq('21 importer landt alleen in hoststore A', A.getState().extensionImporters.length, 1);
  eq('21a importer landt niet in documentstore B', B.getState().extensionImporters.length, 0);
  eq('21b ribbonknop landt alleen in hoststore A', A.getState().extensionRibbonButtons.length, 1);
  eq('21c ribbonknop landt niet in documentstore B', B.getState().extensionRibbonButtons.length, 0);
  eq('21d notificatie gebruikt alleen de geïnjecteerde A-sink',
    notificationsA, ['context-test|warning|alleen naar host A']);
  eq('21e notificatie raakt de B-sink niet', notificationsB, []);

  let eventWaarde: unknown;
  api.events.on('context-test:event', data => { eventWaarde = data; });
  peerApi.events.emit('context-test:event', { gedeeld: true });
  eq('22 eventbus blijft appglobaal over documentcontexten heen', eventWaarde, { gedeeld: true });

  api.settings.set('gedeeld', { context: 'appglobaal' });
  eq('22a settingsprefix blijft per extensie en appglobaal',
    peerApi.settings.get('gedeeld', null), { context: 'appglobaal' });

  clearCjkFontProviders();
  api.pdfFonts.register({
    id: 'context-font',
    covers: codepoint => codepoint === 65,
    getRegularBytes: async () => new Uint8Array([1, 2, 3]),
  });
  eq('22b PDF-fontregistry blijft appglobaal',
    getCjkFontProviders().map(provider => provider.id), ['context-font']);

  api._cleanup();
  peerApi._cleanup();
  eq('23 cleanup verwijdert importer uit hoststore A', A.getState().extensionImporters.length, 0);
  eq('23a cleanup verwijdert ribbonknop uit hoststore A', A.getState().extensionRibbonButtons.length, 0);
  eq('23b cleanup schrijft geen UI naar documentstore B',
    [B.getState().extensionImporters.length, B.getState().extensionRibbonButtons.length], [0, 0]);
  eq('23c cleanup verwijdert globale fontprovider', getCjkFontProviders().length, 0);
}

// ── 7. De singleton blijft de singleton ────────────────────────────────────
{
  eq('24 useAppStore heeft de bekende Zustandvorm',
    ['getState', 'setState', 'subscribe']
      .every(k => typeof (useAppStore as unknown as Record<string, unknown>)[k] === 'function'), true);
  eq('24a de singleton levert een volledige AppState',
    ['project', 'tasks', 'sequences', 'resources', 'assignments', 'ui', 'view',
      'historyEvents', 'nextHistorySequence']
      .every(k => k in useAppStore.getState()), true);

  const C = createAppStore();
  const D = createAppStore();
  for (const veld of ['tasks', 'sequences', 'resources', 'assignments', 'historyEvents'] as const) {
    eq(`25 "${veld}" is niet gedeeld tussen twee verse instanties`,
      (C.getState() as unknown as Record<string, unknown>)[veld]
        === (D.getState() as unknown as Record<string, unknown>)[veld],
      false);
  }
}

// ── Uitslag ────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: store-factory — ${checks} checks groen`);
} else {
  console.log(`XX store-factory — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
