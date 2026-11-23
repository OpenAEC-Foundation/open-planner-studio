import type { FileData, FileFilter, FileRef, OpenDialogOpts, OpenedFile, RefuseBeforePlace, SaveDialogOpts, SaveOutcome } from './index';
import { extensionOf } from '@/utils/filePath';
import { bytesBlob, ByteWriteError } from './byteWrite';

const hasFSA = (): boolean => typeof window !== 'undefined' && 'showOpenFilePicker' in window;

/** Onze FileFilter[] → de picker `types`-vorm (accept: MIME → extensies met punt). */
function toAcceptTypes(filters: FileFilter[]): FilePickerAcceptType[] {
  return filters.map((f) => ({
    description: f.name,
    accept: { 'application/octet-stream': f.extensions.map((e) => `.${e}`) },
  }));
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Weigert de OMGEVING de schrijfactie blijvend (in plaats van de gebruiker of de schijf)?
 *
 * Chromium gooit hier `NotAllowedError` wanneer de readwrite-grant van de handle niet op
 * `granted` staat (of nooit kan komen, zoals in een policy-geblokkeerde webview) — dát is een
 * eigenschap van de OMGEVING en blijft gelden bij een volgende poging. `QuotaExceededError`,
 * `NotFoundError`, `NoModificationAllowedError` e.d. zijn juist ECHTE fouten (schijf vol, bestand
 * verdwenen, bestand vergrendeld) — die horen als fout gemeld te worden, niet stil omzeild.
 *
 * Bewust op `err.name` en NIET op de fouttekst: die verschilt per browser, per versie en per
 * UI-taal.
 */
function isNotAllowedRefusal(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'NotAllowedError';
}

/**
 * `SecurityError`: "geen geldige gebruikersactivatie" — een eigenschap van DEZE ene aanroep (het
 * schrijfmoment mist een vers gebruikersgebaar), niet van de omgeving. Vooral de
 * `actualAutosave`-timer (`saveToRefWithoutPromptWeb`, 10s-throttle zonder gebaar) raakt dit; een
 * handmatige Ctrl+S heeft wél een vers gebaar. NIET onthouden als omgevingseigenschap — de
 * eerstvolgende aanroep verdient een eigen, verse poging.
 */
function isSecurityRefusal(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'SecurityError';
}

/** Herkent beide gevallen — gebruikt waar het er alleen om gaat of dit pad NU niet lukt en er
 *  moet worden teruggevallen, ongeacht of dat blijvend (`NotAllowedError`) of eenmalig
 *  (`SecurityError`) is. Latchen gebeurt apart, per call site, alleen op `isNotAllowedRefusal`. */
function isPlatformRefusal(err: unknown): boolean {
  return isNotAllowedRefusal(err) || isSecurityRefusal(err);
}

/**
 * Pre-check vóór we de FSA-picker openen: sommige embedded webviews (o.a. de Electron-webview
 * van de Claude-desktopapp) laten `showOpenFilePicker`/`showSaveFilePicker` gewoon bestaan, maar
 * blokkeren de feature via een permissions-policy. `document.featurePolicy.allowsFeature(...)`
 * geeft dat dan vooraf `false` — zo vermijden we de zinloze picker-flits (kiezer verschijnt, en
 * de eerstvolgende call gooit alsnog `NotAllowedError`/`SecurityError`).
 *
 * Defensief: `featurePolicy` (non-standaard, Chromium-only, en inmiddels afgebouwd ten gunste
 * van Permissions Policy) kan ontbreken — dan geven we `false` terug (niet geblokkeerd) en laat
 * de runtime-vangnetten hieronder het werk doen zodra de weigering zich daadwerkelijk voordoet.
 */
function featurePolicyBlocksFSA(): boolean {
  const fp = typeof document !== 'undefined' ? document.featurePolicy : undefined;
  if (!fp || typeof fp.allowsFeature !== 'function') return false;
  try {
    return fp.allowsFeature('file-system-access') === false;
  } catch {
    return false;
  }
}

/**
 * Gemeten: in de embedded webview van de Claude-desktopapp (Electron 42 / Chrome 148)
 * bestáát de File System Access API volledig — `showSaveFilePicker`, `FileSystemWritableFileStream`
 * en `createWritable` zijn alle drie aanwezig, en OPFS-handles (die geen grant nodig hebben)
 * schrijven gewoon — maar een handle uit de bestandskiezer krijgt nooit een readwrite-grant, dus
 * `createWritable` gooit `NotAllowedError`. Feature-detectie kan dat per definitie niet zien: de
 * API bestáát, hij weigert alleen bij gebruik.
 *
 * Daarom onthouden we de eerste weigering. Vanaf dat moment gaat elke schrijfactie rechtstreeks
 * via de download-route in plaats van de gebruiker per opslagpoging een kiezer voor te schotelen
 * die tóch nergens toe leidt. Module-scope (niet per handle): het is een eigenschap van de
 * omgeving, niet van één bestand.
 */
let platformRefusesWrites = false;

/** Alleen voor tests/diagnose: is de download-terugval geactiveerd? */
export function webWriteRefusedByPlatform(): boolean {
  return platformRefusesWrites;
}

/** Alleen voor tests: zet de omgevingsdetectie terug op onbekend. */
export function resetWebWriteRefusalForTests(): void {
  platformRefusesWrites = false;
}

/**
 * Spiegelbeeld van `platformRefusesWrites`, maar voor het openen van bestanden: de picker
 * verschijnt, maar `handle.getFile()`/de permissievraag gooit `NotAllowedError`/`SecurityError`
 * (zelfde omgeving, zelfde policy-blokkade). Zodra dat één keer gebeurt, slaat elke volgende
 * open-poging de kansloze picker over en gaat meteen naar `openViaInput`.
 */
let platformRefusesReads = false;

/** Alleen voor tests/diagnose: is de input-terugval voor openen geactiveerd? */
export function webReadRefusedByPlatform(): boolean {
  return platformRefusesReads;
}

/** Alleen voor tests: zet de openen-detectie terug op onbekend. */
export function resetWebReadRefusalForTests(): void {
  platformRefusesReads = false;
}

// ---- Fallback (Firefox/Safari): <input type=file> + blob-download ----

/** Een gekozen bestand als tekst, of als bytes voor een binair formaat (`opts.binaryExtensions`).
 *  Geëxporteerd voor de dev-link `?open=` (`src/utils/devOpenLink.ts`). */
export async function openedFromFile(file: File, ref: FileRef | null, opts?: OpenDialogOpts): Promise<OpenedFile> {
  if ((opts?.binaryExtensions ?? []).includes(extensionOf(file.name))) {
    return { name: file.name, content: '', bytes: new Uint8Array(await file.arrayBuffer()), ref };
  }
  return { name: file.name, content: await file.text(), ref };
}

function openViaInput(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.addEventListener('cancel', () => resolve(null));
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await openedFromFile(file, null, opts) : null);
    };
    input.click();
  });
}

function downloadBlob(name: string, content: string | Uint8Array | Blob, mime?: string): void {
  const blob = new Blob([content as BlobPart], { type: mime ?? 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Een browserhandle heeft geen createNew op het uiteindelijke doel. Daarom kiest de nieuwe
 * byte-dialoog in 1c altijd een download, ook wanneer de gewone tekstkiezer beschikbaar is.
 */
export async function saveNewBytesDialogWeb(
  defaultName: string, bytes: Uint8Array, opts: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  if (opts.refuseDownload?.()) return null;
  try { downloadBlob(defaultName, bytesBlob(bytes, opts.mime ?? 'application/octet-stream'), opts.mime); }
  catch (error) { throw new ByteWriteError('download', error); }
  return { ref: null, name: defaultName, viaDownload: true };
}

/** Ook een leeg bestand bewijst geen nieuwe naam; vóór createWritable veilig weigeren (1130). */
export async function saveNewBytesToRefWeb(ref: FileRef, _bytes: Uint8Array): Promise<boolean> {
  if (ref.kind !== 'handle') return false;
  throw new ByteWriteError('handle-not-exclusive');
}

/**
 * Knownbug 1131 stap 2: schrijftoestemming voor het eigen bestand van een document met een gebouwmodel, vóór de merge.
 * De vraag van de browser hoort bij het gebaar van de planner (Ctrl+S); na een merge van enkele seconden kan dat
 * gebaar verlopen zijn. Dezelfde weigeringen als `saveToRefWeb`: annuleren of een omgevingsweigering is `false`.
 */
export async function handleWritePermissionWeb(handle: FileSystemFileHandle): Promise<boolean> {
  if (platformRefusesWrites) return false;
  try {
    return await readwriteGranted(handle);
  } catch (err) {
    if (!isAbort(err) && !isPlatformRefusal(err)) throw err;
    if (isNotAllowedRefusal(err)) platformRefusesWrites = true;
    return false;
  }
}

/**
 * Knownbug 1131 stap 2: het eigen bestand achter een handle vervangen door de voorbereide buffer.
 * `createWritable()` schrijft naar een tijdelijk bestand van de browser; pas `close()` zet de inhoud op zijn plek.
 * Vlak vóór `close()` vraagt deze functie `stillSource()`: staat op het doel nog de bron? Zo niet, dan `abort()` en
 * `false`: het bestand blijft ongemoeid. Daarna, zonder `await` ertussen, de synchrone laatste controle van de
 * aanroeper (`refuseBeforePlace`, knownbug 1896, review van #1027): hoort de opslag nog bij de inhoud van het document?
 * Een wijziging tussen die controle en `close()` kan dan niet meer; een wijziging op schijf ná de bronvergelijking gaat
 * verloren, want de browser kent geen voorwaardelijk opslaan (ontwerp §4.10, §4.15). Een schrijf- of sluitfout gooit
 * `ByteWriteError`.
 */
export async function replaceHandleWithBytesWeb(
  handle: FileSystemFileHandle, bytes: Uint8Array, stillSource: () => Promise<boolean>, refuseBeforePlace: RefuseBeforePlace,
): Promise<boolean> {
  const writable = await handle.createWritable();
  try {
    await writable.write(bytes as BufferSource);
  } catch (error) {
    await writable.abort().catch(() => { /* de schrijffout hieronder telt */ });
    throw new ByteWriteError('write', error);
  }
  let same: boolean;
  try { same = await stillSource(); }
  catch (error) { await writable.abort().catch(() => {}); throw error; }
  if (!same || refuseBeforePlace()) {
    await writable.abort();
    return false;
  }
  try { await writable.close(); } catch (error) { throw new ByteWriteError('close', error); }
  return true;
}

/** Een bestand dat de planner koos, met het handvat als de browser dat geeft (Chromium). */
export interface PickedWebFile {
  file: File;
  handle: FileSystemFileHandle | null;
}

function pickViaInput(filters: FileFilter[], multiple: boolean): Promise<PickedWebFile[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.addEventListener('cancel', () => resolve(null));
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      resolve(files.length > 0 ? files.map((file) => ({ file, handle: null })) : null);
    };
    input.click();
  });
}

/**
 * Kiest een of meer bestanden zonder ze te openen (stap 1.8: het bronbestand van een externe relatie).
 * Chromium: `showOpenFilePicker`, met het handvat erbij, zodat de aanroeper het kan onthouden. Andere
 * browsers, of een omgeving die de kiezer weigert: `<input type="file">`, zonder handvat. `null` =
 * geannuleerd. Dezelfde vangnetten als `openFileDialogWeb`.
 */
export async function pickFilesWeb(filters: FileFilter[], multiple: boolean): Promise<PickedWebFile[] | null> {
  if (hasFSA() && !platformRefusesReads && !featurePolicyBlocksFSA()) {
    try {
      const handles = await window.showOpenFilePicker!({ multiple, types: toAcceptTypes(filters) });
      const picked: PickedWebFile[] = [];
      for (const handle of handles) picked.push({ file: await handle.getFile(), handle });
      return picked.length > 0 ? picked : null;
    } catch (err) {
      if (isAbort(err)) return null;
      if (isPlatformRefusal(err)) {
        platformRefusesReads = true;
        return pickViaInput(filters, multiple);
      }
      throw err;
    }
  }
  return pickViaInput(filters, multiple);
}

/**
 * Het bestand achter een onthouden handvat, met leesrecht. `prompt: false` (het vangnet bij openen en bij
 * terugkeer naar het venster): alleen bij `granted`, nooit een vraag op de achtergrond. `prompt: true` (een
 * klik van de planner): bij `prompt` vraagt de browser toestemming. Geweigerd of niet te vragen ⇒ `null`.
 */
export async function fileFromHandleWeb(handle: FileSystemFileHandle, prompt: boolean): Promise<File | null> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'read' };
  try {
    let state = await handle.queryPermission?.(opts);
    if (state === undefined) state = 'granted';
    if (state === 'prompt' && prompt) state = await handle.requestPermission?.(opts);
    if (state !== 'granted') return null;
    return await handle.getFile();
  } catch {
    return null;
  }
}

// ---- Publieke web-backend ----

export async function openFileDialogWeb(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  // Twee vangnetten tegen een policy-geblokkeerde FSA (gemeten in de Claude-desktopapp-webview,
  // zie `featurePolicyBlocksFSA`): vooraf de picker-flits vermijden als de policy het al meldt,
  // én — als de policy niets zegt of zich vergist — de doorlopende poging alsnog opvangen.
  if (hasFSA() && !platformRefusesReads && !featurePolicyBlocksFSA()) {
    try {
      const [handle] = await window.showOpenFilePicker!({ multiple: false, types: toAcceptTypes(filters) });
      // `await` binnen de try: een weigering tijdens het lezen moet de catch hieronder bereiken.
      return await openedFromFile(await handle.getFile(), { kind: 'handle', handle }, opts);
    } catch (err) {
      // Annuleren blijft `null` — geen tweede picker via de input-terugval.
      if (isAbort(err)) return null;
      // De omgeving (niet de gebruiker) weigert: dit gebeurt vóórdat er inhoud gelezen is
      // (`getFile`/de impliciete permissievraag daarvóór), dus er is niets om kwijt te raken.
      // Eenmalig terugvallen op de input-picker, en onthouden voor volgende keren.
      if (isPlatformRefusal(err)) {
        platformRefusesReads = true;
        return openViaInput(filters, opts);
      }
      throw err;
    }
  }
  return openViaInput(filters, opts);
}

/**
 * De web-opslaanroute voor tekst én bytes. `FileSystemWritableFileStream.write` accepteert
 * beide vormen, dus het enige verschil tussen de twee publieke varianten is het MIME-type van de
 * download-terugval; de picker, de weigeringsafhandeling en het latchen blijven één plek. Zou dit
 * twee kopieën zijn, dan drift de foutafhandeling van het byte-pad onvermijdelijk weg van die van
 * het tekstpad.
 */
export async function saveDataDialogWeb(
  defaultName: string, data: FileData, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  // Zelfde policy-blokkade kan hier ook optreden (`showSaveFilePicker` bestaat, `createWritable`
  // weigert) — de catch hieronder vangt dat op via `platformRefusesWrites`/de download-route; de
  // featurePolicy-precheck bespaart de nutteloze picker-flits.
  if (hasFSA() && !platformRefusesWrites && !featurePolicyBlocksFSA()) {
    try {
      // `startIn: 'downloads'` is een Chromium-uitbreiding op de FSA-spec (well-known directory) —
      // niet-Chromium browsers negeren een onbekende optie stilzwijgend, dus dit is veilig overal.
      const handle = await window.showSaveFilePicker!({
        suggestedName: defaultName,
        types: toAcceptTypes(filters),
        ...(opts?.preferDownloads ? { startIn: 'downloads' as const } : {}),
      });
      // #804 fixronde 1: het gekozen bestand vóór `createWritable()` controleren (bijv. de bron van een gebouwmodel).
      if (await opts?.refuseTarget?.({ kind: 'handle', handle })) return null;
      // Chromium heeft een bestaand doel bij het kiezen al leeggemaakt, dus `abort()` brengt het oude bestand niet terug
      // maar laat 0 bytes staan (knownbug 1899). Daarom geeft de aanroeper hier alleen een late controle mee als een leeg
      // bestand beter is dan de uitvoer (fixronde 2 van #1097: een IFC-export na een tabbladwissel).
      if (!(await writeThroughHandle(handle, data, opts?.refuseBeforePlace))) return null;
      const file = await handle.getFile();
      return { ref: { kind: 'handle', handle }, name: file.name };
    } catch (err) {
      // Annuleren is geen fout — en mag dus ook geen download opleveren.
      if (isAbort(err)) return null;
      // Echte fout (schijf vol, bestand verdwenen/vergrendeld, geblokkeerd bestandstype): doorgeven,
      // zodat de aanroeper hem als fout meldt. Alleen een omgevingsweigering valt terug — en alleen
      // `NotAllowedError` is dat blijvend genoeg om te onthouden; `SecurityError` (geen gebruikers-
      // activatie op dít moment) is een eenmalige makke voor deze aanroep.
      if (!isPlatformRefusal(err)) throw err;
      if (isNotAllowedRefusal(err)) platformRefusesWrites = true;
    }
  }
  // Terugval: download. Geen herbruikbare ref — dit is de enige route die in élke omgeving werkt,
  // dus het bestand raakt hoe dan ook bij de gebruiker. `viaDownload` laat de aanroeper dat zeggen.
  // Review #872 ronde 7 (Terra): ook na een geweigerde kiezer, dus na een `await`: eerst de controle van de aanroeper.
  if (opts?.refuseDownload?.()) return null;
  downloadBlob(defaultName, data, opts?.mime);
  return { ref: null, name: defaultName, viaDownload: true };
}

/**
 * Schrijf `data` via de schrijfstroom van de handle. De browser zet de inhoud pas bij `close()` op het bestand; vlak
 * daarvóór beslist `refuseBeforePlace` (knownbug 1896). Weigert die, dan `abort()`: het bestand blijft zoals het was,
 * en de functie geeft `false`. Een schrijf- of sluitfout gooit, zoals voorheen.
 */
async function writeThroughHandle(
  handle: FileSystemFileHandle, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null,
): Promise<boolean> {
  const writable = await handle.createWritable();
  await writable.write(data as FileSystemWriteChunkType);
  if (refuseBeforePlace?.()) {
    await writable.abort().catch(() => { /* de weigering telt */ });
    return false;
  }
  await writable.close();
  return true;
}

/** In-place opslaan vereist readwrite; showOpenFilePicker geeft alleen read. Fouten gaan naar de aanroeper. */
async function readwriteGranted(handle: FileSystemFileHandle): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
  if ((await handle.queryPermission?.(opts)) === 'granted') return true;
  return (await handle.requestPermission?.(opts)) === 'granted';
}

export async function saveToRefWeb(
  ref: FileRef, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null, writeGranted = false,
): Promise<boolean> {
  if (ref.kind !== 'handle') return false;
  // Weet de omgeving al dat schrijven via handles hier niet kan? Dan de permissievraag overslaan:
  // die levert alleen een prompt op die tóch nergens toe leidt. `false` stuurt de aanroeper naar
  // `saveFileDialog`, die dan meteen de download-route pakt.
  if (platformRefusesWrites) return false;
  const { handle } = ref;
  try {
    if (!writeGranted && !(await readwriteGranted(handle))) return false;
    return await writeThroughHandle(handle, data, refuseBeforePlace);
  } catch (err) {
    // Weigert de omgeving blijvend (`NotAllowedError`, grant niet en nooit `granted`), onthoud dat
    // dan: anders krijgt de gebruiker bij élke opslagpoging eerst een permissieprompt en dan een
    // bestandskiezer, om vervolgens alsnog in de download-terugval te landen. `SecurityError` (geen
    // gebruikersactivatie op dít moment) latcht bewust NIET — de eerstvolgende handmatige Ctrl+S
    // heeft weer een vers gebaar en verdient een eigen, verse in-place poging in plaats van meteen
    // gedegradeerd te worden. Annuleren en een omgevingsweigering blijven `false`; een echte
    // schrijffout gaat naar de aanroeper, zodat die de reden meldt VÓÓR een eventuele opslaan-als-
    // terugval. Anders lijkt een vergrendeld bestand op een gewone browserbeperking (knownbug163).
    if (!isAbort(err) && !isPlatformRefusal(err)) throw err;
    if (isNotAllowedRefusal(err)) platformRefusesWrites = true;
    return false;
  }
}

/** Promptvrije browser-precheck voor de daadwerkelijke AutoSave-timer. */
export async function canWriteToRefWithoutPromptWeb(ref: FileRef): Promise<boolean> {
  if (ref.kind !== 'handle' || platformRefusesWrites) return false;
  try {
    return (await ref.handle.queryPermission?.({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Timerpad: geen `requestPermission`, geen picker en geen download-terugval — dit is de
 * `actualAutosave`-aanroep zonder omringend gebruikersgebaar (10s-throttle, zie
 * `src/hooks/useAutoSave.ts`), dus de meest waarschijnlijke plek voor een `SecurityError`
 * ("geen geldige gebruikersactivatie"). Zo'n weigering is een eigenschap van DEZE ene poging, niet
 * van de omgeving: latchen zou de eerstvolgende hándmatige save (met een écht gebaar) onterecht
 * naar de downloadroute sturen. `onFailure` in `actualAutoSave.ts` meldt de gemiste schrijfactie
 * al gededupliceerd — geen data gaat verloren (recovery blijft los draaien) en er komt geen
 * browserprompt bij, want dit pad valt nooit terug op een picker.
 */
export async function saveToRefWithoutPromptWeb(ref: FileRef, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  if (!await canWriteToRefWithoutPromptWeb(ref) || ref.kind !== 'handle') return false;
  try {
    return await writeThroughHandle(ref.handle, data, refuseBeforePlace);
  } catch (err) {
    if (isNotAllowedRefusal(err)) platformRefusesWrites = true;
    return false;
  }
}

/**
 * Gedeelde permissie-dans voor een leesactie op een handle, voor `readFromRefWeb`/
 * `readBytesFromRefWeb`. Die verschillen alleen in hoe ze de uiteindelijke `File` naar het
 * resultaat vertalen (`.text()` vs. `new Uint8Array(await .arrayBuffer())`). `extract`
 * draagt dat verschil; de rest (kind-guard, queryPermission/requestPermission en lezen)
 * blijft één plek.
 *
 * Geen `openViaInput`-terugval hier: een handle-ref komt uit "recente bestanden" en `<input
 * type=file>` levert geen handle op om te heronthouden — een nieuwe kiezer zou een compleet
 * andere UX zijn dan "dit recente bestand heropenen". In een omgeving die FSA-reads blokkeert
 * (zie `featurePolicyBlocksFSA`/`platformRefusesReads`) kan een handle-ref dus per definitie
 * nooit gelezen worden. Een weigering geeft `null`; een leesfout gaat met zijn reden naar de
 * aanroeper, zodat Recent de bestaande foutmelding kan tonen zonder de entry te verwijderen.
 */
async function readRefWeb<T>(ref: FileRef, extract: (file: File) => Promise<T>): Promise<T | null> {
  if (ref.kind !== 'handle') return null;
  const { handle } = ref;
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'read' };
  if ((await handle.queryPermission?.(opts)) !== 'granted') {
    if ((await handle.requestPermission?.(opts)) !== 'granted') return null;
  }
  const file = await handle.getFile();
  return extract(file);
}

export function readFromRefWeb(ref: FileRef): Promise<string | null> {
  return readRefWeb(ref, (file) => file.text());
}

export function readBytesFromRefWeb(ref: FileRef): Promise<Uint8Array | null> {
  return readRefWeb(ref, async (file) => new Uint8Array(await file.arrayBuffer()));
}
