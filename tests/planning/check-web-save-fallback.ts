// Web-opslaan/openen-terugvalchecks — de input/download-route als de omgeving FSA weigert.
//
// Waarom deze batterij bestaat (gemeten 2026-07-30, uitgebreid 2026-08-15). In de embedded
// webview van de Claude-desktopapp (Electron 42 / Chrome 148) bestáát de File System Access API
// compleet: `showOpenFilePicker`, `showSaveFilePicker`, `FileSystemWritableFileStream` en
// `createWritable` zijn alle vier aanwezig, en OPFS-handles schrijven gewoon. Maar de
// permissions-policy van die omgeving blokkeert de feature zelf: een handle uit de bestandskiezer
// krijgt nooit een grant, dus `createWritable` (opslaan) én `getFile` (openen) gooien
// `NotAllowedError`. De web-backend koos zijn route puur op feature-detectie ("bestaat de API?")
// in plaats van op werking, en gaf de rauwe DOMException door: bij opslaan "Failed to save", bij
// openen "Failed to open file" plus een browsertekst — terwijl de input-/download-terugval in
// diezelfde omgeving prima werkt.
//
// Deze checks leggen vast (opslaan-pad):
//   1. Een omgevingsweigering (NotAllowedError/SecurityError) valt terug op downloaden en levert
//      een geslaagde `SaveOutcome` met `viaDownload` op — géén throw.
//   2. Annuleren blijft `null` (geen fout, en zeker geen ongevraagde download), en een ECHTE
//      schrijffout (schijf vol, bestand weg) blijft doorgegeven worden als fout.
//   3. Na één weigering slaat de backend de kansloze kiezer/permissieprompt over.
// Plus: `saveFile` in de store zet die uitkomst om in de `info`-melding en géén `saveFailed`.
//
// En (openen-pad, sinds 2026-08-15):
//   8. `document.featurePolicy.allowsFeature('file-system-access') === false` ⇒ de picker wordt
//      niet eens geopend, meteen de input-terugval.
//   9. Geen (bruikbare) featurePolicy, maar de picker/`getFile` gooit alsnog NotAllowedError ⇒
//      één keer terugvallen op de input-terugval (en dat onthouden voor de volgende open-poging).
//  10. Annuleren (AbortError uit de picker) blijft `null` — geen tweede picker via de terugval.
//
// Draait via run.sh. Exit 0 = alles groen.
import {
  saveFileDialogWeb, saveToRefWeb, webWriteRefusedByPlatform, resetWebWriteRefusalForTests,
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

// ── Minimale DOM-stub ────────────────────────────────────────────────────────
// De web-backend raakt exact drie dingen aan: `window.showSaveFilePicker` (bestaan + aanroep),
// `document.createElement('a').click()` en `URL.createObjectURL`. Meer is er niet nodig.
interface Downloaded { name: string; bytes: number }
const downloads: Downloaded[] = [];
let lastBlob: Blob | null = null;

// Voor de open-terugval (`<input type=file>`): welk bestand "kiest" de gebruiker zodra
// `openViaInput` de kiezer opent (`input.click()`)? `null` = de gebruiker annuleert.
// Gestuurd per test, gelezen op het moment dat `createElement('input')` wordt aangeroepen.
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
      // Minimale `<input type=file>`-stub: `click()` simuleert synchroon de bestandskeuze —
      // net als een echte klik uiteindelijk `onchange` (of bij annuleren het `cancel`-event)
      // vuurt, alleen zonder de echte OS-kiezer ertussen.
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
URL.revokeObjectURL = (() => { /* niets */ }) as typeof URL.revokeObjectURL;

/** Fabriceer een handle waarvan `createWritable`/`getFile` gooit wat wij willen. */
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

/** Zet `window` op met een kiezer die `handle` teruggeeft (of `pickerError` gooit). */
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

/** Zet `window` op met een open-kiezer die `[handle]` teruggeeft (of `pickerError` gooit). */
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
const FILTERS = [{ name: 'IFC Files', extensions: ['ifc'] }];

async function main() {
  // ── 1. Omgevingsweigering → download in plaats van een doorgegeven DOMException ──────────
  resetWebWriteRefusalForTests();
  downloads.length = 0;
  installWindow(makeHandle({ writeError: refused() }));
  let outcome = await saveFileDialogWeb('plan.ifc', 'IFC-DATA', FILTERS);
  eq('1a weigering gooit niet maar levert een uitkomst', outcome !== null, true);
  eq('1b uitkomst is als download gemarkeerd', outcome?.viaDownload, true);
  eq('1c geen herbruikbare ref na een download', outcome?.ref, null);
  eq('1d het bestand is echt gedownload', downloads, [{ name: 'plan.ifc', bytes: 8 }]);
  eq('1e de omgevingsweigering is onthouden', webWriteRefusedByPlatform(), true);

  // ── 2. Na de weigering geen kansloze kiezer meer ─────────────────────────────────────────
  downloads.length = 0;
  installWindow(makeHandle({ writeError: refused() }));
  outcome = await saveFileDialogWeb('plan2.ifc', 'IFC', FILTERS);
  eq('2a kiezer wordt overgeslagen zodra de omgeving geweigerd heeft', pickerCalls, 0);
  eq('2b het bestand komt er alsnog', downloads.map(d => d.name), ['plan2.ifc']);

  // ── 3. saveToRefWeb: weigering onthouden, en daarna geen permissieprompt meer ────────────
  resetWebWriteRefusalForTests();
  installWindow(null);
  const ref: FileRef = { kind: 'handle', handle: makeHandle({ writeError: refused() }) };
  eq('3a in-place schrijven mislukt', await saveToRefWeb(ref, 'IFC'), false);
  eq('3b en is als omgevingsweigering onthouden', webWriteRefusedByPlatform(), true);
  const naEerste = permissionCalls;
  eq('3c tweede poging vraagt geen permissie meer', await saveToRefWeb(ref, 'IFC') === false && permissionCalls === naEerste, true);

  // ── 4. Annuleren is geen fout en levert GEEN download ────────────────────────────────────
  resetWebWriteRefusalForTests();
  downloads.length = 0;
  installWindow(null, new DOMException('The user aborted a request.', 'AbortError'));
  eq('4a annuleren geeft null', await saveFileDialogWeb('plan.ifc', 'IFC', FILTERS), null);
  eq('4b annuleren downloadt niets', downloads.length, 0);
  eq('4c annuleren zet de omgeving niet op geweigerd', webWriteRefusedByPlatform(), false);

  // ── 5. Een ECHTE schrijffout blijft een fout ─────────────────────────────────────────────
  resetWebWriteRefusalForTests();
  downloads.length = 0;
  installWindow(makeHandle({ writeError: new DOMException('disk full', 'QuotaExceededError') }));
  let threw = '';
  try {
    await saveFileDialogWeb('plan.ifc', 'IFC', FILTERS);
  } catch (err) {
    threw = (err as DOMException).name;
  }
  eq('5a schijf vol wordt doorgegeven als fout', threw, 'QuotaExceededError');
  eq('5b en wordt niet stil omgezet in een download', downloads.length, 0);
  eq('5c en zet de omgeving niet op geweigerd', webWriteRefusedByPlatform(), false);

  // ── 6. Zonder File System Access API (Firefox/Safari) blijft de download-route staan ─────
  resetWebWriteRefusalForTests();
  downloads.length = 0;
  g.window = {};
  outcome = await saveFileDialogWeb('plan.ifc', 'IFC', FILTERS);
  eq('6a download-terugval zonder FSA', downloads.map(d => d.name), ['plan.ifc']);
  eq('6b ook daar als download gemarkeerd', outcome?.viaDownload, true);

  // ── 7. De store zet dit om in een info-melding, niet in "opslaan mislukt" ────────────────
  // Pas hier importeren: de store trekt het halve `src/`-oppervlak mee en heeft aan de DOM-stub
  // hierboven genoeg, maar de checks 1-6 moeten los van de store bewijsbaar blijven.
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
  eq('7b één melding, en dat is de download-info', notes, [{ sev: 'info', key: 'notifications.savedViaDownload' }]);
  eq('7c geen rauwe browserfout als detail', S().ui.notifications[0]?.detail, undefined);
  eq('7d het document geldt als opgeslagen', S().isDirty, false);

  // ── 7e. Een late uitkomst hoort bij document B, nooit bij inmiddels actief document C ─────
  resetWebWriteRefusalForTests();
  installDeferredSaveWindow();
  const documentB = S().newDocument();
  S().addTask({ name: 'B wordt opgeslagen' });
  const documentC = S().newDocument();
  S().switchDocument(documentB);
  const lateSave = S().saveFile();
  await Promise.resolve();
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

  // Ook de expliciete Opslaan als-route bindt een late bestemming aan haar brondocument.
  installDeferredSaveWindow();
  const saveAsDocument = S().newDocument();
  S().addTask({ name: 'Opslaan als blijft bij dit document' });
  const saveAsNeighbour = S().newDocument();
  S().switchDocument(saveAsDocument);
  const lateSaveAs = S().saveFileAs();
  await Promise.resolve();
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

  // ── 8. featurePolicy meldt vooraf een blokkade → meteen de input-terugval, geen picker ──────
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

  // ── 9. Geen (bruikbare) featurePolicy, maar de picker faalt runtime → eenmalige terugval ────
  // Dekt precies het gerapporteerde geval: `showOpenFilePicker` verschijnt en slaagt, maar
  // `handle.getFile()` gooit `NotAllowedError` vóórdat er iets gelezen is.
  resetWebReadRefusalForTests();
  createdTags.length = 0;
  nextInputFile = new File(['negen'], 'gekozen-9.ifc');
  installOpenWindow(makeHandle({ getFileError: refused() }));
  opened = await openFileDialogWeb(FILTERS);
  eq('9a de picker wordt wél geprobeerd', openPickerCalls, 1);
  eq('9b getFile-weigering valt terug op de input-terugval i.p.v. te gooien', createdTags.includes('input'), true);
  eq('9c en levert alsnog het gekozen bestand op', opened?.name, 'gekozen-9.ifc');
  eq('9d de weigering is onthouden', webReadRefusedByPlatform(), true);
  // Tweede open-poging: geen nieuwe (kansloze) picker meer, meteen naar de input-terugval.
  const openPickerCallsNaEerste = openPickerCalls;
  nextInputFile = new File(['tien'], 'gekozen-9b.ifc');
  opened = await openFileDialogWeb(FILTERS);
  eq('9e geen tweede picker-aanroep na een onthouden weigering', openPickerCalls, openPickerCallsNaEerste);
  eq('9f en toch weer een geslaagd resultaat via de terugval', opened?.name, 'gekozen-9b.ifc');

  // ── 10. Annuleren (AbortError) blijft `null` — géén tweede picker via de terugval ───────────
  resetWebReadRefusalForTests();
  createdTags.length = 0;
  nextInputFile = null;
  installOpenWindow(null, new DOMException('The user aborted a request.', 'AbortError'));
  opened = await openFileDialogWeb(FILTERS);
  eq('10a annuleren geeft null', opened, null);
  eq('10b de picker is precies één keer geprobeerd', openPickerCalls, 1);
  eq('10c annuleren triggert géén input-terugval (dus geen tweede kiezer)', createdTags.includes('input'), false);
  eq('10d annuleren zet de open-weigering niet aan', webReadRefusedByPlatform(), false);

  // ── Rapport ───────────────────────────────────────────────────────────────────────────────
  if (diffs.length === 0) {
    console.log(`   web-opslaan-terugval: ${checks}/${checks} alles groen`);
  } else {
    for (const d of diffs) console.log(`   XX ${d}`);
    console.log(`   web-opslaan-terugval: ${checks - diffs.length}/${checks} groen, ${diffs.length} afwijking(en)`);
    process.exitCode = 1;
  }
}

void main();
