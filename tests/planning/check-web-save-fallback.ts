import {
  saveDataDialogWeb, saveToRefWeb, saveToRefWithoutPromptWeb, webWriteRefusedByPlatform, resetWebWriteRefusalForTests,
  openFileDialogWeb, webReadRefusedByPlatform, resetWebReadRefusalForTests,
} from '@/services/fileAccess/webBackend';
import type { FileRef } from '@/services/fileAccess';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

interface Downloaded { name: string; bytes: number }
const downloads: Downloaded[] = [];
let lastBlob: Blob | null = null;

let nextInputFile: File | null = null;
const createdTags: string[] = [];

const g = globalThis as unknown as Record<string, unknown>;
g.document = {
  createElement: (tag: string) => {
    createdTags.push(tag);
    if (tag === 'a') {
      const el = { href: '', download: '', click: () => { downloads.push({ name: el.download, bytes: lastBlob?.size ?? -1 }); } };
      return el;
    }
    if (tag === 'input') {
      const el = {
        type: '', accept: '',
        files: undefined as File[] | undefined,
        onchange: null as (() => void | Promise<void>) | null,
        _cancelHandler: null as (() => void) | null,
        addEventListener(ev: string, cb: () => void) { if (ev === 'cancel') el._cancelHandler = cb; },
        click() {
          if (nextInputFile) { el.files = [nextInputFile]; void el.onchange?.(); }
          else { el._cancelHandler?.(); }
        },
      };
      return el;
    }
    throw new Error(`onverwacht element: ${tag}`);
  },
};
const realCreateObjectURL = URL.createObjectURL;
URL.createObjectURL = ((b: Blob) => { lastBlob = b; return 'blob:stub'; }) as typeof realCreateObjectURL;
URL.revokeObjectURL = (() => { }) as typeof URL.revokeObjectURL;

type HandleOpts = { permission?: PermissionState; writeError?: DOMException | null; getFileError?: DOMException | null };
let pickerCalls = 0;
let openPickerCalls = 0;
let permissionCalls = 0;
const makeHandle = (opts: HandleOpts): FileSystemFileHandle => ({
  kind: 'file',
  name: 'project.ifc',
  isSameEntry: () => Promise.resolve(false),
  getFile: () => (opts.getFileError ? Promise.reject(opts.getFileError) : Promise.resolve(new File(['x'], 'project.ifc'))),
  queryPermission: () => { permissionCalls++; return Promise.resolve(opts.permission ?? 'granted'); },
  requestPermission: () => { permissionCalls++; return Promise.resolve(opts.permission ?? 'granted'); },
  createWritable: () => {
    if (opts.writeError) return Promise.reject(opts.writeError);
    return Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() } as unknown as FileSystemWritableFileStream);
  },
} as unknown as FileSystemFileHandle);

function installWindow(handle: FileSystemFileHandle | null, pickerError?: DOMException) {
  pickerCalls = 0;
  permissionCalls = 0;
  g.window = {
    showOpenFilePicker: () => Promise.resolve([]),
    showSaveFilePicker: () => {
      pickerCalls++;
      if (pickerError) return Promise.reject(pickerError);
      return Promise.resolve(handle!);
    },
  };
}

let releaseDeferredSavePicker: ((handle: FileSystemFileHandle) => void) | null = null;
async function untilSavePickerOpen(): Promise<boolean> {
  for (let i = 0; i < 1000 && pickerCalls === 0; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  return pickerCalls > 0;
}
function installDeferredSaveWindow() {
  pickerCalls = 0;
  permissionCalls = 0;
  g.window = {
    showOpenFilePicker: () => Promise.resolve([]),
    showSaveFilePicker: () => {
      pickerCalls++;
      return new Promise<FileSystemFileHandle>((resolveHandle) => {
        releaseDeferredSavePicker = resolveHandle;
      });
    },
  };
}

function installOpenWindow(handle: FileSystemFileHandle | null, pickerError?: DOMException) {
  openPickerCalls = 0;
  permissionCalls = 0;
  g.window = {
    showOpenFilePicker: () => {
      openPickerCalls++;
      if (pickerError) return Promise.reject(pickerError);
      return Promise.resolve([handle!]);
    },
    showSaveFilePicker: () => Promise.reject(new Error('niet gebruikt in deze open-test')),
  };
}

const refused = () => new DOMException(
  "Failed to execute 'createWritable' on 'FileSystemFileHandle': The request is not allowed by the user agent or the platform in the current context.",
  'NotAllowedError',
);
const refusedSecurity = () => new DOMException(
  "Failed to execute 'createWritable' on 'FileSystemFileHandle': No user activation is currently available.",
  'SecurityError',
);
const FILTERS = [{ name: 'IFC Files', extensions: ['ifc'] }];

async function main() {
  resetWebWriteRefusalForTests();
  downloads.length = 0;
  installWindow(makeHandle({ writeError: refused() }));
  let outcome = await saveDataDialogWeb('plan.ifc', 'IFC-DATA', FILTERS);
  eq('1a weigering gooit niet maar levert een uitkomst', outcome !== null, true);
  eq('1b uitkomst is als download gemarkeerd', outcome?.viaDownload, true);
  eq('1c geen herbruikbare ref na een download', outcome?.ref, null);
  eq('1d het bestand is echt gedownload', downloads, [{ name: 'plan.ifc', bytes: 8 }]);
  eq('1e de omgevingsweigering is onthouden', webWriteRefusedByPlatform(), true);

  downloads.length = 0;
  installWindow(makeHandle({ writeError: refused() }));
  outcome = await saveDataDialogWeb('plan2.ifc', 'IFC', FILTERS);
  eq('2a kiezer wordt overgeslagen zodra de omgeving geweigerd heeft', pickerCalls, 0);
  eq('2b het bestand komt er alsnog', downloads.map(d => d.name), ['plan2.ifc']);

  resetWebWriteRefusalForTests();
  installWindow(null);
  const ref: FileRef = { kind: 'handle', handle: makeHandle({ writeError: refused() }) };
  eq('3a in-place schrijven mislukt', await saveToRefWeb(ref, 'IFC'), false);
  eq('3b en is als omgevingsweigering onthouden', webWriteRefusedByPlatform(), true);
  const naEerste = permissionCalls;
  eq('3c tweede poging vraagt geen permissie meer', await saveToRefWeb(ref, 'IFC') === false && permissionCalls === naEerste, true);

  resetWebWriteRefusalForTests();
  const refSecurity: FileRef = { kind: 'handle', handle: makeHandle({ writeError: refusedSecurity() }) };
  eq('3d in-place schrijven mislukt bij SecurityError', await saveToRefWeb(refSecurity, 'IFC'), false);
  eq('3e maar de omgeving geldt niet als blijvend geweigerd', webWriteRefusedByPlatform(), false);
  const refHersteld: FileRef = { kind: 'handle', handle: makeHandle({}) };
  eq('3f eerstvolgende poging probeert weer gewoon in-place', await saveToRefWeb(refHersteld, 'IFC'), true);

  resetWebWriteRefusalForTests();
  downloads.length = 0;
  installWindow(null, new DOMException('The user aborted a request.', 'AbortError'));
  eq('4a annuleren geeft null', await saveDataDialogWeb('plan.ifc', 'IFC', FILTERS), null);
  eq('4b annuleren downloadt niets', downloads.length, 0);
  eq('4c annuleren zet de omgeving niet op geweigerd', webWriteRefusedByPlatform(), false);

  resetWebWriteRefusalForTests();
  downloads.length = 0;
  installWindow(makeHandle({ writeError: new DOMException('disk full', 'QuotaExceededError') }));
  let threw = '';
  try {
    await saveDataDialogWeb('plan.ifc', 'IFC', FILTERS);
  } catch (err) {
    threw = (err as DOMException).name;
  }
  eq('5a schijf vol wordt doorgegeven als fout', threw, 'QuotaExceededError');
  eq('5b en wordt niet stil omgezet in een download', downloads.length, 0);
  eq('5c en zet de omgeving niet op geweigerd', webWriteRefusedByPlatform(), false);

  resetWebWriteRefusalForTests();
  downloads.length = 0;
  g.window = {};
  outcome = await saveDataDialogWeb('plan.ifc', 'IFC', FILTERS);
  eq('6a download-terugval zonder FSA', downloads.map(d => d.name), ['plan.ifc']);
  eq('6b ook daar als download gemarkeerd', outcome?.viaDownload, true);

  resetWebWriteRefusalForTests();
  downloads.length = 0;
  installWindow(makeHandle({ writeError: refusedSecurity() }));
  outcome = await saveDataDialogWeb('plan.ifc', 'IFC', FILTERS);
  eq('6c SecurityError levert alsnog een download op', outcome?.viaDownload, true);
  eq('6d maar de omgeving geldt niet als blijvend geweigerd', webWriteRefusedByPlatform(), false);
  downloads.length = 0;
  installWindow(makeHandle({}));
  outcome = await saveDataDialogWeb('plan3.ifc', 'IFC', FILTERS);
  eq('6e eerstvolgende poging probeert de picker weer', pickerCalls, 1);
  eq('6f en die slaagt gewoon in-place (geen download)', downloads.length, 0);
  eq('6g dus geen viaDownload meer', outcome?.viaDownload, undefined);

  resetWebWriteRefusalForTests();
  let refTimer: FileRef = { kind: 'handle', handle: makeHandle({ writeError: refusedSecurity() }) };
  eq('6i timerpad met SecurityError levert false op', await saveToRefWithoutPromptWeb(refTimer, 'IFC'), false);
  eq('6j maar latcht niet', webWriteRefusedByPlatform(), false);
  refTimer = { kind: 'handle', handle: makeHandle({}) };
  eq('6k eerstvolgende timerpoging schrijft weer gewoon', await saveToRefWithoutPromptWeb(refTimer, 'IFC'), true);

  resetWebWriteRefusalForTests();
  refTimer = { kind: 'handle', handle: makeHandle({ writeError: refused() }) };
  eq('6l timerpad met NotAllowedError levert false op', await saveToRefWithoutPromptWeb(refTimer, 'IFC'), false);
  eq('6m en latcht wél (blijvende omgevingsweigering)', webWriteRefusedByPlatform(), true);

  resetWebWriteRefusalForTests();
  downloads.length = 0;
  installWindow(makeHandle({ writeError: refused() }));
  const { useAppStore } = await import('@/state/appStore');
  const S = () => useAppStore.getState();
  S().newProject();
  S().addTask({ name: 'A' });
  await S().saveFile();
  const notes = S().ui.notifications.map(n => ({ sev: n.severity, key: n.messageKey }));
  eq('7a het project is als download opgeslagen', downloads.length, 1);
  eq('7b één melding, en dat is de browseruitleg over downloads', notes, [{ sev: 'info', key: 'notifications.browserSavesAsDownload' }]);
  eq('7b2 met een link naar de handleiding over bestanden', S().ui.notifications[0]?.helpArticleId, 'uitleg-bestanden');
  eq('7b3 en blijft langer staan dan een gewone info (15 s)', S().ui.notifications[0]?.durationMs, 15_000);
  eq('7c geen rauwe browserfout als detail', S().ui.notifications[0]?.detail, undefined);
  eq('7d het document geldt als opgeslagen', S().isDirty, false);

  S().addTask({ name: 'A2' });
  await S().saveFile();
  eq('7d2 de tweede opslag is weer een download', downloads.length, 2);
  eq('7d3 en de uitleg staat er nog steeds maar één keer',
    S().ui.notifications.filter(n => n.messageKey === 'notifications.browserSavesAsDownload').map(n => n.count), [1]);

  resetWebWriteRefusalForTests();
  installDeferredSaveWindow();
  const documentB = S().newDocument();
  S().addTask({ name: 'B wordt opgeslagen' });
  const documentC = S().newDocument();
  S().switchDocument(documentB);
  const lateSave = S().saveFile();
  eq('7e0 de dialoog voor B is open', await untilSavePickerOpen(), true);
  S().switchDocument(documentC);
  const handleB = makeHandle({});
  releaseDeferredSavePicker?.(handleB);
  await lateSave;
  eq('7e actieve document blijft C na late B-save', S().activeDocumentId, documentC);
  eq('7f C krijgt B-bestandsnaam niet', S().filePath, null);
  eq('7g C krijgt B-handle niet', S().fileHandle, null);
  S().switchDocument(documentB);
  eq('7h B ontvangt zijn eigen bestandsnaam', S().filePath, 'project.ifc');
  eq('7i B ontvangt zijn eigen handle', S().fileHandle === handleB, true);
  eq('7j ongewijzigd B wordt na zijn eigen save schoon', S().isDirty, false);

  installDeferredSaveWindow();
  const saveAsDocument = S().newDocument();
  S().addTask({ name: 'Opslaan als blijft bij dit document' });
  const saveAsNeighbour = S().newDocument();
  S().switchDocument(saveAsDocument);
  const lateSaveAs = S().saveFileAs();
  eq('7k0 de dialoog voor Opslaan als is open', await untilSavePickerOpen(), true);
  S().switchDocument(saveAsNeighbour);
  const saveAsHandle = makeHandle({});
  releaseDeferredSavePicker?.(saveAsHandle);
  await lateSaveAs;
  eq('7k actieve buur blijft actief na late Opslaan als', S().activeDocumentId, saveAsNeighbour);
  eq('7l buur krijgt Opslaan als-bestandsnaam niet', S().filePath, null);
  eq('7m buur krijgt Opslaan als-handle niet', S().fileHandle, null);
  S().switchDocument(saveAsDocument);
  eq('7n Opslaan als-bestandsnaam blijft bij bron', S().filePath, 'project.ifc');
  eq('7o Opslaan als-handle blijft bij bron', S().fileHandle === saveAsHandle, true);
  eq('7p ongewijzigde Opslaan als-bron wordt schoon', S().isDirty, false);

  const { resetBrowserSaveNoticeForTests } = await import('@/state/browserSaveNotice');
  resetBrowserSaveNoticeForTests();
  resetWebWriteRefusalForTests();
  installWindow(makeHandle({}));
  S().newDocument();
  S().addTask({ name: 'Bestaand' });
  useAppStore.setState({ filePath: 'bestaand.ifc', fileHandle: null });
  const before7q = S().ui.notifications.length;
  await S().saveFile();
  const added7q = S().ui.notifications.slice(before7q);
  eq('7q bestaand bestand, opnieuw een venster: één uitleg', added7q.map(n => n.messageKey), ['notifications.browserCannotOverwrite']);
  eq('7r de uitleg noemt het bestaande bestand', added7q[0]?.params?.name, 'bestaand.ifc');

  resetBrowserSaveNoticeForTests();
  installWindow(makeHandle({}));
  S().newDocument();
  S().addTask({ name: 'Nieuw' });
  const before7s = S().ui.notifications.length;
  await S().saveFile();
  eq('7s eerste keer opslaan via een venster: geen uitleg', S().ui.notifications.length, before7s);

  resetWebReadRefusalForTests();
  createdTags.length = 0;
  nextInputFile = new File(['acht'], 'gekozen-8.ifc');
  (g.document as { featurePolicy?: { allowsFeature: () => boolean } }).featurePolicy = { allowsFeature: () => false };
  installOpenWindow(null);
  let opened = await openFileDialogWeb(FILTERS);
  eq('8a de FSA-picker wordt niet eens aangeroepen', openPickerCalls, 0);
  eq('8b de input-terugval wordt wél gebruikt', createdTags.includes('input'), true);
  eq('8c en levert het door de gebruiker gekozen bestand op', opened?.name, 'gekozen-8.ifc');
  eq('8d featurePolicy-blokkade zet de open-weigering niet blijvend aan', webReadRefusedByPlatform(), false);
  delete (g.document as { featurePolicy?: unknown }).featurePolicy;

  resetWebReadRefusalForTests();
  createdTags.length = 0;
  nextInputFile = new File(['negen'], 'gekozen-9.ifc');
  installOpenWindow(makeHandle({ getFileError: refused() }));
  opened = await openFileDialogWeb(FILTERS);
  eq('9a de picker wordt wél geprobeerd', openPickerCalls, 1);
  eq('9b getFile-weigering valt terug op de input-terugval i.p.v. te gooien', createdTags.includes('input'), true);
  eq('9c en levert alsnog het gekozen bestand op', opened?.name, 'gekozen-9.ifc');
  eq('9d de weigering is onthouden', webReadRefusedByPlatform(), true);
  const openPickerCallsNaEerste = openPickerCalls;
  nextInputFile = new File(['tien'], 'gekozen-9b.ifc');
  opened = await openFileDialogWeb(FILTERS);
  eq('9e geen tweede picker-aanroep na een onthouden weigering', openPickerCalls, openPickerCallsNaEerste);
  eq('9f en toch weer een geslaagd resultaat via de terugval', opened?.name, 'gekozen-9b.ifc');

  resetWebReadRefusalForTests();
  createdTags.length = 0;
  nextInputFile = null;
  installOpenWindow(null, new DOMException('The user aborted a request.', 'AbortError'));
  opened = await openFileDialogWeb(FILTERS);
  eq('10a annuleren geeft null', opened, null);
  eq('10b de picker is precies één keer geprobeerd', openPickerCalls, 1);
  eq('10c annuleren triggert géén input-terugval (dus geen tweede kiezer)', createdTags.includes('input'), false);
  eq('10d annuleren zet de open-weigering niet aan', webReadRefusedByPlatform(), false);

  for (const kind of ['text', 'bytes'] as const) {
    resetWebWriteRefusalForTests();
    const handle = makeHandle({ getFileError: new DOMException('locked', 'NotReadableError') });
    installWindow(handle);
    const before = downloads.length;
    const data = kind === 'text' ? 'content' : new Uint8Array([1, 2]);
    const outcome = await saveDataDialogWeb('default.ifc', data, FILTERS);
    eq(`1014 ${kind}: gekozen naam`, outcome?.name, 'project.ifc');
    eq(`1014 ${kind}: gekozen handle behouden`, outcome?.ref?.kind === 'handle' && outcome.ref.handle === handle, true);
    eq(`1014 ${kind}: geen extra download`, downloads.length, before);
  }

  reported = true;
  if (diffs.length === 0) {
    console.log(`   web-opslaan-terugval: ${checks}/${checks} alles groen`);
  } else {
    for (const d of diffs) console.log(`   XX ${d}`);
    console.log(`   web-opslaan-terugval: ${checks - diffs.length}/${checks} groen, ${diffs.length} afwijking(en)`);
    process.exitCode = 1;
  }
}

let reported = false;
process.on('beforeExit', () => {
  if (reported) return;
  reported = true;
  console.log('   XX web-opslaan-terugval: de check stopte vóór het rapport (een stap wachtte op iets wat nooit kwam)');
  process.exitCode = 1;
});
void main();
