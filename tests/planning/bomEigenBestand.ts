import { createHash } from 'node:crypto';
import { linkSync, lstatSync, mkdtempSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createCloseDocumentDialogActions } from '@/components/layout/DocumentChrome/closeDocumentActions';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import type { FileRef } from '@/services/fileAccess';
import type { SiteStorage } from '@/services/fileAccess/siteHost';
import { outputFromResult, runIfcSaveJob } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import { IfcSaveWorkerError } from '@/services/ifc/saveWorker/ifcSaveWorkerError';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import type { TargetFingerprint } from '@/state/documentContract';
import { computeIfcOutputHere, type IfcOutputCompute } from '@/state/prepareIfcOutput';
import { loadStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { installNodeFileIpc } from './nodeFileIpc';

export const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
export const addBom = (data: Uint8Array) => new Uint8Array(Buffer.concat([Buffer.from(UTF8_BOM), data]));
export const hasBom = (data: Uint8Array) => UTF8_BOM.every((b, i) => data[i] === b);
export const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const withoutBom = (data: Uint8Array) => (hasBom(data) ? data.subarray(UTF8_BOM.length) : data);
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.byteLength === b.byteLength && Buffer.from(a.buffer, a.byteOffset, a.byteLength)
  .equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
const bytesOf = (data: BufferSource) => (ArrayBuffer.isView(data)
  ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data));

export type Kind = 'pad' | 'handle';
export type Compute = 'hier' | 'worker';
export type How = 'Ctrl+S' | 'Automatisch opslaan' | 'sluitvraag';
export const MOMENTS = ['recht', 'rekenen', 'hash', 'lezing-1', 'lezing-2', 'lezing-3', 'schrijven'] as const;
export type Moment = typeof MOMENTS[number];
export type Fingerprint = 'klopt' | 'anders' | 'geen';

export interface StepTrace {
  readonly step: string;
  readonly outcome: boolean | null;
  readonly notices: readonly string[];
  readonly disk: string | null;
  readonly bomOk: boolean | null;
  readonly fingerprint: Fingerprint;
  readonly dirty: boolean;
  readonly events: string;
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface Files {
  readonly lf: Uint8Array;
  readonly crlf: Uint8Array;
  readonly example: Uint8Array;
  readonly other: Uint8Array;
  readonly model: Uint8Array;
  readonly foreign: Uint8Array;
}

export interface Recording {
  readonly basis: string;
  readonly inputs: Readonly<Record<string, string>>;
  readonly cases: Readonly<Record<string, readonly StepTrace[]>>;
  readonly boundaries: Readonly<Record<string, readonly StepTrace[]>>;
}

class Tracker {
  events: string[] = [];
  reads = 0;
  fired = false;
  inCompute = false;
  output: Uint8Array | null = null;
  private withBomOutput: Uint8Array | null = null;
  private armed: { moment: Moment; action: () => void } | null = null;
  constructor(readonly withBom: boolean) {}
  arm(moment: Moment, action: () => void) {
    this.armed = { moment, action };
    this.reads = 0;
    this.fired = false;
  }
  settle(): Record<string, unknown> | undefined {
    const result = this.armed || this.fired ? { ingreep: this.fired } : undefined;
    this.armed = null;
    this.fired = false;
    return result;
  }
  fire(moment: Moment) {
    if (this.armed?.moment !== moment) return;
    const { action } = this.armed;
    this.armed = null;
    this.fired = true;
    action();
  }
  note(event: string, moment?: Moment) {
    this.events.push(event);
    if (moment) this.fire(moment);
  }
  read(event: string) {
    this.reads++;
    this.note(event, `lezing-${this.reads}` as Moment);
  }
  setOutput(bytes: Uint8Array) {
    this.output = bytes;
    this.withBomOutput = addBom(bytes);
  }
  digest(data: Uint8Array) {
    const plain = !!this.output && sameBytes(data, this.output);
    const bom = !!this.withBomOutput && sameBytes(data, this.withBomOutput);
    if (plain || bom) this.note('hash-uitvoer', (this.withBom ? bom : plain) ? 'hash' : undefined);
    else if (!this.inCompute) this.note('hash');
  }
  take() {
    const events = this.events;
    this.events = [];
    return events;
  }
}

let active: Tracker | null = null;

function patchDigest(): () => void {
  const subtle = globalThis.crypto.subtle;
  const digest = subtle.digest;
  subtle.digest = function (this: SubtleCrypto, algorithm: AlgorithmIdentifier, data: BufferSource) {
    active?.digest(bytesOf(data));
    return digest.call(this, algorithm, data);
  } as typeof subtle.digest;
  return () => { subtle.digest = digest; };
}

interface Box { bytes: Uint8Array | null }

class Handle {
  readonly kind = 'file';
  query: PermissionState = 'granted';
  request: PermissionState | Error = 'granted';
  readError: Error | null = null;
  writeError: Error | null = null;
  constructor(readonly name: string, readonly box: Box, private readonly tracker: Tracker) {}
  async isSameEntry(other: unknown) { return other instanceof Handle && other.box === this.box; }
  async queryPermission() {
    this.tracker.note('recht-vragen', 'recht');
    return this.query;
  }
  async requestPermission() {
    this.tracker.note('recht-verzoeken', 'recht');
    if (this.request instanceof Error) throw this.request;
    return this.request;
  }
  async getFile() {
    this.tracker.read('lezen');
    if (this.readError) throw this.readError;
    if (!this.box.bytes) throw new DOMException('weg', 'NotFoundError');
    return new File([new Uint8Array(this.box.bytes).buffer], this.name);
  }
  async createWritable() {
    this.tracker.note('schrijfstroom');
    if (this.writeError) throw this.writeError;
    const parts: Uint8Array[] = [];
    return {
      write: async (part: Uint8Array | string | Blob) => {
        this.tracker.note('schrijven', 'schrijven');
        parts.push(part instanceof Blob ? new Uint8Array(await part.arrayBuffer())
          : typeof part === 'string' ? new TextEncoder().encode(part) : new Uint8Array(part));
      },
      abort: async () => { this.tracker.note('afbreken'); },
      close: async () => {
        this.tracker.note('sluiten');
        this.box.bytes = new Uint8Array(Buffer.concat(parts));
      },
    };
  }
}

type Store = ReturnType<Awaited<ReturnType<typeof loadStore>>['createAppStoreContext']>['store'];
type Failure = 'lezen' | 'schijf vol' | 'hernoemen' | 'schrijfstroom';

interface Place {
  readonly ref: FileRef;
  readonly appBom: boolean;
  byApp: boolean;
  otherBom: boolean;
  read(): Uint8Array | null;
  put(data: Uint8Array): void;
  remove(): void;
  fail(failure: Failure): void;
  twin(): FileRef;
  readonly link?: string;
  dispose(): void;
}

function placeOnDisk(root: string, tracker: Tracker, data: Uint8Array, appBom: boolean, linked = false): Place {
  const folder = mkdtempSync(join(root, 'pad-'));
  const file = join(folder, 'planning.ifc');
  const twin = join(folder, 'ander.ifc');
  writeFileSync(file, data);
  const path = linked ? join(folder, 'koppeling.ifc') : file;
  if (linked) symlinkSync(file, path);
  const ipc = installNodeFileIpc({ appDataDir: join(folder, 'appdata') });
  const nameOf = (p: string) => (p === file ? 'doel' : p === path ? 'koppeling' : p === twin ? 'ander'
    : dirname(p) === folder ? 'tijdelijk' : null);
  ipc.faults.onCall = (command, called) => {
    const name = called === undefined ? '' : nameOf(called);
    if (name === null) return;
    const event = `${command.replace(/^plugin:(?:fs|resources)\|/, '')}${name ? `:${name}` : ''}`;
    if ((command === 'plugin:fs|open' || command === 'plugin:fs|read_file') && called === path) tracker.read(event);
    else tracker.note(event, /^plugin:fs\|write/.test(command) ? 'schrijven' : undefined);
  };
  return {
    ref: { kind: 'path', path }, appBom, byApp: true, otherBom: false,
    read: () => { try { return new Uint8Array(readFileSync(path)); } catch { return null; } },
    put: next => writeFileSync(path, next),
    remove: () => unlinkSync(path),
    fail: failure => {
      if (failure === 'lezen') ipc.faults.readError = 'failed to read file: Permission denied (os error 13)';
      if (failure === 'schijf vol') ipc.faults.writeErrorAfter = 100;
      if (failure === 'hernoemen') ipc.faults.renameError = 'failed to rename file: Permission denied (os error 13)';
    },
    twin: () => {
      linkSync(file, twin);
      return { kind: 'path', path: twin };
    },
    ...(linked ? { link: path } : {}),
    dispose: () => ipc.dispose(),
  };
}

function placeInBrowser(tracker: Tracker, data: Uint8Array | null, appBom: boolean): Place & { readonly handle: Handle } {
  const box: Box = { bytes: data };
  const handle = new Handle('planning.ifc', box, tracker);
  return {
    handle, ref: { kind: 'handle', handle: handle as unknown as FileSystemFileHandle }, appBom, byApp: true, otherBom: false,
    read: () => box.bytes,
    put: next => { box.bytes = next; },
    remove: () => { box.bytes = null; },
    fail: failure => {
      if (failure === 'lezen') handle.readError = new DOMException('geen toegang', 'NotReadableError');
      if (failure === 'schrijfstroom') handle.writeError = new DOMException('geen schrijfstroom', 'NoModificationAllowedError');
    },
    twin: () => ({ kind: 'handle', handle: new Handle('ander.ifc', box, tracker) as unknown as FileSystemFileHandle }),
    dispose: () => {},
  };
}

async function openStore(data: Uint8Array, ref: FileRef, compute?: IfcOutputCompute): Promise<Store> {
  const { createAppStoreContext } = await loadStore();
  const { store } = createAppStoreContext(compute ? { ifcSaveCompute: compute } : undefined);
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const name = ref.kind === 'path' ? basename(ref.path) : 'planning.ifc';
  await store.getState().openOpenedFile({ name, content: '', bytes: data, ref });
  return store;
}

async function closeQuestionSave(store: Store): Promise<boolean> {
  const id = store.getState().activeDocumentId;
  let closed = false;
  await createCloseDocumentDialogActions({
    pendingId: id, getActiveDocumentId: () => store.getState().activeDocumentId,
    switchDocument: store.getState().switchDocument,
    closeDocument: async (documentId, options) => {
      const done = await store.getState().closeDocumentAfterSaves(documentId, options);
      closed = done !== false;
      return done;
    },
    saveFile: () => store.getState().saveFileForDocument(id),
    clearPending: () => {}, restoreOpenerFocus: () => {},
    onSavePendingChange: pending => store.getState().setUI({ closeQuestionSaving: pending }),
  }).save();
  return closed;
}

function computeFor(mode: Compute, tracker: Tracker, control: { fail: boolean }): IfcOutputCompute {
  return async job => {
    tracker.note('rekenen', 'rekenen');
    if (control.fail) throw new IfcSaveWorkerError('crashed', 'proef: de opslagworker stierf');
    tracker.inCompute = true;
    try {
      if (mode === 'hier') {
        const output = await computeIfcOutputHere(job);
        if (!output.prepared) tracker.setOutput(output.bytes ?? new TextEncoder().encode(output.content));
        return output;
      }
      if (job.kind !== 'writer') return outputFromResult(job, await runIfcSaveJob(job));
      const result = await runIfcSaveJob({ kind: 'writer', input: job.input });
      if (result.kind !== 'writer') return outputFromResult(job, result);
      tracker.setOutput(result.bytes);
      return outputFromResult(job, job.hashBytes ? { ...result, sha256: await precomputeSha256(result.bytes) } : result);
    } finally {
      tracker.inCompute = false;
    }
  };
}

function fingerprintOf(known: TargetFingerprint | null, disk: Uint8Array | null): Fingerprint {
  if (!known) return 'geen';
  if (!disk) return 'anders';
  const bom = (known as { readonly utf8Bom?: boolean }).utf8Bom;
  return known.byteLength === disk.byteLength && known.sha256 === sha256(disk) && (bom === undefined || bom === hasBom(disk))
    ? 'klopt' : 'anders';
}

const browserWindow = () => globalThis.window as unknown as {
  showOpenFilePicker?: () => Promise<unknown>;
  showSaveFilePicker?: () => Promise<unknown>;
  openaecHost?: unknown;
};

export interface Run {
  readonly store: Store;
  readonly place: Place;
  readonly files: Files;
  readonly kind: Kind;
  readonly withBom: boolean;
  readonly control: { fail: boolean };
  rename(): void;
  byOther(data: Uint8Array): void;
  inBomWorld(data: Uint8Array): Uint8Array;
  at(moment: Moment, action: () => void): void;
  save(step: string, how: How): Promise<void>;
  record(step: string, outcome: boolean | null, extra?: Record<string, unknown>): void;
  picker(answer: 'nieuw bestand' | 'geannuleerd'): void;
  openTwin(): Promise<void>;
}

type Source = 'LF' | 'CRLF' | 'voorbeeld 03';
interface Scenario {
  readonly name: string;
  readonly kinds?: readonly Kind[];
  readonly sources?: readonly Source[];
  readonly linked?: boolean;
  run(r: Run): Promise<void>;
}

const VOORAF = [
  ['een andere planning', (r: Run) => r.byOther(r.files.other)],
  ['een gebouwmodel', (r: Run) => r.byOther(r.files.model)],
  ['vreemde inhoud', (r: Run) => r.byOther(r.files.foreign)],
  ['geen IFC', (r: Run) => r.byOther(new TextEncoder().encode('Geen IFC'))],
  ['een andere planning, in de wereld van het bestand', (r: Run) => r.byOther(r.inBomWorld(r.files.other))],
  ['een gebouwmodel, in de wereld van het bestand', (r: Run) => r.byOther(r.inBomWorld(r.files.model))],
  ['gewist', (r: Run) => r.place.remove()],
  ['een leesfout', (r: Run) => r.place.fail('lezen')],
] as const;

const ROUTES = ['Ctrl+S', 'Automatisch opslaan'] as const;
const ORIGINS = ['geopend', 'na een eigen opslag'] as const;

async function fromOrigin(r: Run, origin: typeof ORIGINS[number]) {
  if (origin === 'geopend') return;
  r.rename();
  await r.save('eigen opslag', 'Ctrl+S');
}

export function scenarios(): Scenario[] {
  const list: Scenario[] = [
    { name: 'ongewijzigd', sources: ['LF', 'CRLF', 'voorbeeld 03'], run: r => r.save('Ctrl+S', 'Ctrl+S') },
    { name: 'wijziging', sources: ['LF', 'CRLF', 'voorbeeld 03'], run: async r => { r.rename(); await r.save('Ctrl+S', 'Ctrl+S'); } },
    {
      name: 'tweemaal', sources: ['LF', 'CRLF', 'voorbeeld 03'],
      run: async r => { r.rename(); await r.save('Ctrl+S 1', 'Ctrl+S'); r.rename(); await r.save('Ctrl+S 2', 'Ctrl+S'); },
    },
    {
      name: 'automatisch', sources: ['LF', 'CRLF', 'voorbeeld 03'],
      run: async r => {
        r.rename(); await r.save('ronde 1', 'Automatisch opslaan');
        r.rename(); await r.save('ronde 2', 'Automatisch opslaan');
        r.rename(); await r.save('Ctrl+S daarna', 'Ctrl+S');
      },
    },
    { name: 'sluitvraag', sources: ['LF', 'CRLF', 'voorbeeld 03'], run: async r => { r.rename(); await r.save('sluitvraag', 'sluitvraag'); } },
    {
      name: 'de geopende versie terug na een andere planning',
      run: async r => {
        r.rename();
        const start = r.place.read()!;
        r.byOther(r.files.other); await r.save('een andere planning', 'Ctrl+S');
        r.place.put(start); r.place.byApp = true; await r.save('de geopende versie terug', 'Ctrl+S');
      },
    },
    {
      name: 'al open',
      run: async r => {
        r.rename(); await r.save('Ctrl+S', 'Ctrl+S');
        const before = r.store.getState().getOpenDocumentPayloads().length;
        const name = r.place.ref.kind === 'path' ? basename(r.place.ref.path) : 'planning.ifc';
        await r.store.getState().openOpenedFile({ name, content: '', bytes: r.place.read()!, ref: r.place.ref });
        const s = r.store.getState();
        r.record('opnieuw geopend', null, {
          extraTabs: s.getOpenDocumentPayloads().length - before,
          changedOnDisk: !!s.documents.find(d => d.id === s.activeDocumentId)?.changedOnDisk,
        });
      },
    },
    {
      name: 'gelinkt pad', kinds: ['pad'], linked: true,
      run: async r => {
        r.rename(); await r.save('Ctrl+S', 'Ctrl+S');
        if (r.place.link) r.record('koppeling', null, { stillLink: lstatSync(r.place.link).isSymbolicLink() });
      },
    },
    {
      name: 'het doel is de bron van een ander tabblad met een gebouwmodel',
      run: async r => {
        r.rename();
        r.byOther(r.files.model);
        await r.openTwin();
        await r.save('Ctrl+S', 'Ctrl+S');
        await r.save('Automatisch opslaan', 'Automatisch opslaan');
      },
    },
    { name: 'rekenen mislukt, Ctrl+S', run: async r => { r.rename(); r.control.fail = true; await r.save('Ctrl+S', 'Ctrl+S'); } },
    {
      name: 'rekenen mislukt, Automatisch opslaan',
      run: async r => { r.rename(); r.control.fail = true; await r.save('ronde', 'Automatisch opslaan'); },
    },
    {
      name: 'recht na een vraag', kinds: ['handle'],
      run: async r => {
        const handle = (r.place as ReturnType<typeof placeInBrowser>).handle;
        handle.query = 'prompt';
        r.rename(); await r.save('Ctrl+S', 'Ctrl+S');
      },
    },
    {
      name: 'recht geweigerd, de kiezer kiest een nieuw bestand', kinds: ['handle'],
      run: async r => {
        const handle = (r.place as ReturnType<typeof placeInBrowser>).handle;
        handle.query = 'prompt';
        handle.request = 'denied';
        const before = sha256(r.place.read()!);
        r.picker('nieuw bestand');
        r.rename(); await r.save('Ctrl+S', 'Ctrl+S');
        r.rename(); await r.save('Ctrl+S op het nieuwe bestand', 'Ctrl+S');
        r.record('het oude bestand', null, { intact: sha256(r.place.read()!) === before });
      },
    },
    {
      name: 'recht geweigerd, de kiezer geannuleerd', kinds: ['handle'],
      run: async r => {
        const handle = (r.place as ReturnType<typeof placeInBrowser>).handle;
        handle.query = 'prompt';
        handle.request = 'denied';
        r.picker('geannuleerd');
        r.rename(); await r.save('Ctrl+S', 'Ctrl+S');
      },
    },
    {
      name: 'het rechtverzoek faalt', kinds: ['handle'],
      run: async r => {
        const handle = (r.place as ReturnType<typeof placeInBrowser>).handle;
        handle.query = 'prompt';
        handle.request = new Error('proef: het rechtverzoek faalt');
        r.picker('nieuw bestand');
        r.rename(); await r.save('Ctrl+S', 'Ctrl+S');
      },
    },
    {
      name: 'Automatisch opslaan zonder recht', kinds: ['handle'],
      run: async r => {
        (r.place as ReturnType<typeof placeInBrowser>).handle.query = 'prompt';
        r.rename(); await r.save('ronde', 'Automatisch opslaan');
      },
    },
  ];
  for (const how of ROUTES) {
    for (const origin of ORIGINS) {
      for (const [content, change] of VOORAF) {
        list.push({
          name: `${how}, ${origin}: vooraf ${content}`,
          run: async r => { await fromOrigin(r, origin); r.rename(); change(r); await r.save(how, how); },
        });
      }
      for (const moment of MOMENTS) {
        for (const content of ['een andere planning', 'een gebouwmodel'] as const) {
          list.push({
            name: `${how}, ${origin}: ${content} op het doel bij ${moment}`,
            kinds: moment === 'recht' ? ['handle'] : undefined,
            run: async r => {
              await fromOrigin(r, origin);
              r.rename();
              r.at(moment, () => r.byOther(content === 'een gebouwmodel' ? r.files.model : r.files.other));
              await r.save(how, how);
            },
          });
        }
        list.push({
          name: `${how}, ${origin}: het tabblad bewerkt bij ${moment}`,
          kinds: moment === 'recht' ? ['handle'] : undefined,
          run: async r => {
            await fromOrigin(r, origin);
            r.rename();
            r.at(moment, () => r.rename());
            await r.save(how, how);
          },
        });
      }
      for (const moment of ['rekenen', 'lezing-1', 'lezing-2', 'schrijven'] as const) {
        list.push({
          name: `${how}, ${origin}: de flag gaat uit bij ${moment}`,
          run: async r => {
            await fromOrigin(r, origin);
            r.rename();
            r.at(moment, () => r.store.getState().setUI({ featureFlags: {} }));
            await r.save(how, how);
          },
        });
      }
      for (const failure of ['schijf vol', 'hernoemen', 'schrijfstroom'] as const) {
        list.push({
          name: `${how}, ${origin}: ${failure} mislukt`,
          kinds: failure === 'schrijfstroom' ? ['handle'] : ['pad'],
          run: async r => {
            await fromOrigin(r, origin);
            r.rename();
            r.place.fail(failure);
            if (failure === 'schrijfstroom') r.picker('nieuw bestand');
            await r.save(how, how);
          },
        });
      }
    }
  }
  return list;
}

async function runScenario(
  root: string, files: Files, withBom: boolean, kind: Kind, compute: Compute, source: Uint8Array, scenario: Scenario,
): Promise<StepTrace[]> {
  const tracker = new Tracker(withBom);
  const start = withBom ? addBom(source) : new Uint8Array(source);
  const place = kind === 'pad' ? placeOnDisk(root, tracker, start, withBom, !!scenario.linked) : placeInBrowser(tracker, start, withBom);
  const places: Place[] = [place];
  const steps: StepTrace[] = [];
  const control = { fail: false };
  const win = browserWindow();
  active = tracker;
  try {
    const computeOut = computeFor(compute, tracker, control);
    const store = await openStore(start, place.ref, computeOut);
    const autoSave = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: computeOut });
    let renames = 0;
    const placeOf = () => {
      const s = store.getState();
      return places.find(p => (p.ref.kind === 'handle' ? s.fileHandle === p.ref.handle : p.ref.kind === 'path' && s.filePath === p.ref.path)) ?? null;
    };
    const record = (step: string, outcome: boolean | null, extra?: Record<string, unknown>) => {
      const s = store.getState();
      const target = placeOf() ?? place;
      const disk = target.read();
      if (disk && tracker.output && sameBytes(withoutBom(disk), tracker.output)) target.byApp = true;
      steps.push({
        step, outcome,
        notices: s.ui.notifications.map(n => `${n.severity}:${n.messageKey}`),
        disk: disk ? sha256(withoutBom(disk)) : null,
        bomOk: disk ? hasBom(disk) === (target.byApp ? target.appBom : target.otherBom) : null,
        fingerprint: fingerprintOf(s.knownTargetFingerprint, disk),
        dirty: s.isDirty,
        events: tracker.take().join(' '),
        ...(extra ? { extra } : {}),
      });
      store.setState(st => { st.ui.notifications = []; });
    };
    const run: Run = {
      store, place, files, kind, withBom, control,
      rename: () => {
        const task = store.getState().tasks.find(t => !t.isSummary)!;
        store.getState().updateTask(task.id, { name: `Hernoemd ${++renames}` });
      },
      byOther: data => { place.byApp = false; place.otherBom = hasBom(data); place.put(data); },
      inBomWorld: data => (withBom ? addBom(data) : data),
      at: (moment, action) => tracker.arm(moment, action),
      record,
      save: async (step, how) => {
        let outcome: boolean;
        if (how === 'Ctrl+S') outcome = await store.getState().saveFileForDocument(store.getState().activeDocumentId);
        else if (how === 'sluitvraag') outcome = await closeQuestionSave(store);
        else {
          store.getState().setAutoSaveToFile(true);
          await autoSave.flush();
          outcome = !store.getState().isDirty;
        }
        record(step, outcome, tracker.settle());
      },
      picker: answer => {
        win.showOpenFilePicker = async () => [];
        win.showSaveFilePicker = async () => {
          tracker.note('kiezer');
          if (answer === 'geannuleerd') throw new DOMException('geannuleerd', 'AbortError');
          const chosen = placeInBrowser(tracker, new Uint8Array(), false);
          places.push(chosen);
          return chosen.handle;
        };
      },
      openTwin: async () => {
        const id = store.getState().activeDocumentId;
        const ref = place.twin();
        await store.getState().openOpenedFile({ name: 'ander.ifc', content: '', bytes: place.read()!, ref });
        const s = store.getState();
        record('ander tabblad geopend', null, { tabs: s.getOpenDocumentPayloads().length, otherActive: s.activeDocumentId !== id });
        if (s.activeDocumentId !== id) await store.getState().switchDocument(id);
      },
    };
    record('geopend', null, { tasks: store.getState().tasks.length });
    await scenario.run(run);
  } finally {
    active = null;
    delete win.showOpenFilePicker;
    delete win.showSaveFilePicker;
    for (const p of places) p.dispose();
  }
  return steps;
}

let reseed: ((seed: number) => void) | null = null;

function* caseList() {
  for (const kind of ['pad', 'handle'] as const) {
    for (const compute of ['hier', 'worker'] as const) {
      for (const scenario of scenarios()) {
        if (scenario.kinds && !scenario.kinds.includes(kind)) continue;
        for (const source of scenario.sources ?? ['LF']) {
          yield { name: `${source} | ${kind} | ${compute} | ${scenario.name}`, kind, compute, source, scenario };
        }
      }
    }
  }
}

export async function runCases(root: string, files: Files, withBom: boolean): Promise<Record<string, StepTrace[]>> {
  reseed ??= installDeterminism();
  const restore = patchDigest();
  const out: Record<string, StepTrace[]> = {};
  try {
    for (const c of caseList()) {
      reseed(0x2212);
      const source = c.source === 'LF' ? files.lf : c.source === 'CRLF' ? files.crlf : files.example;
      out[c.name] = await runScenario(root, files, withBom, c.kind, c.compute, source, c.scenario);
    }
  } finally { restore(); }
  return out;
}

export async function ownPlanning(source: Uint8Array): Promise<Uint8Array> {
  reseed ??= installDeterminism();
  reseed(0x2212);
  const tracker = new Tracker(false);
  const place = placeInBrowser(tracker, source, false);
  const store = await openStore(source, place.ref);
  await store.getState().saveFileForDocument(store.getState().activeDocumentId);
  return place.read()!;
}

export async function loadFiles(repo: string): Promise<Files> {
  const read = (rel: string) => new Uint8Array(readFileSync(join(repo, rel)));
  const example = read('public/examples/03-kantoorgebouw-zuidas.ifc');
  const lf = await ownPlanning(example);
  return {
    lf, crlf: new TextEncoder().encode(new TextDecoder().decode(lf).split('\n').join('\r\n')), example,
    other: read('public/examples/10-villa-wassenaar.ifc'),
    model: read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc'),
    foreign: read('tests/fixtures/ifc-foreign/twee-werkplannen.ifc'),
  };
}

export function inputHashes(files: Files): Record<string, string> {
  return Object.fromEntries(Object.entries(files).map(([name, data]) => [name, sha256(data)]));
}

export const BOUNDARIES = [
  'extern een andere planning met BOM', 'extern de geopende planning terug zonder BOM', 'onbekende versie na flag uit en aan',
] as const;

export async function runBoundaries(root: string, files: Files, withBom: boolean): Promise<Record<string, StepTrace[]>> {
  reseed ??= installDeterminism();
  const restore = patchDigest();
  const out: Record<string, StepTrace[]> = {};
  try {
    for (const kind of ['pad', 'handle'] as const) {
      for (const name of BOUNDARIES) {
        reseed(0x2212);
        out[`${kind} | ${name}`] = await runScenario(root, files, withBom, kind, 'hier', files.lf, {
          name,
          run: async r => {
            if (name === 'onbekende versie na flag uit en aan') {
              r.store.getState().setUI({ featureFlags: {} });
              r.store.getState().setUI({ featureFlags: { ifcForeignContent: true } });
            }
            if (name === 'extern een andere planning met BOM') r.byOther(addBom(files.other));
            if (name === 'extern de geopende planning terug zonder BOM') r.byOther(files.lf);
            r.rename();
            await r.save('Ctrl+S', 'Ctrl+S');
          },
        });
      }
    }
    reseed(0x2212);
    out['site | Ctrl+S'] = await siteCase(withBom ? addBom(files.lf) : files.lf);
  } finally { restore(); }
  return out;
}

async function siteCase(data: Uint8Array): Promise<StepTrace[]> {
  const { createAppStoreContext } = await loadStore();
  const { store } = createAppStoreContext();
  store.getState().setUI({ featureFlags: { ifcForeignContent: true } });
  const win = browserWindow();
  let version = 'v1';
  let onSite = data;
  const saves: { baseVersion?: string; bom: boolean }[] = [];
  const storage: SiteStorage = {
    list: async () => [],
    versions: async () => [],
    open: async () => ({ file: { id: 'plan', name: 'planning.ifc', version }, data: onSite }),
    save: async ({ data: blob, baseVersion }) => {
      onSite = new Uint8Array(await blob.arrayBuffer());
      saves.push({ baseVersion, bom: hasBom(onSite) });
      version = 'v2';
      return { id: 'plan', name: 'planning.ifc', version };
    },
  };
  win.openaecHost = { storage };
  try {
    const opened = await store.getState().openFromSite('plan');
    const task = store.getState().tasks.find(t => !t.isSummary)!;
    store.getState().updateTask(task.id, { name: 'Hernoemd 1' });
    const saved = await store.getState().saveFileForDocument(store.getState().activeDocumentId);
    const s = store.getState();
    return [{
      step: 'Ctrl+S', outcome: saved, notices: s.ui.notifications.map(n => `${n.severity}:${n.messageKey}`),
      disk: sha256(withoutBom(onSite)), bomOk: null, fingerprint: fingerprintOf(s.knownTargetFingerprint, onSite), dirty: s.isDirty,
      events: '', extra: { opened, saves, version },
    }];
  } finally {
    delete win.openaecHost;
  }
}

export const waitPoints = (events: string) => events.replace(/hash-uitvoer(?: hash-uitvoer)+/g, 'hash-uitvoer');

export function differences(main: readonly StepTrace[], pr: readonly StepTrace[]): string[] {
  if (main.length !== pr.length) return [`aantal stappen ${main.length} ≠ ${pr.length}`];
  const out: string[] = [];
  main.forEach((m, i) => {
    const p = pr[i];
    for (const field of ['step', 'outcome', 'notices', 'disk', 'fingerprint', 'dirty', 'extra'] as const) {
      if (JSON.stringify(m[field]) !== JSON.stringify(p[field])) out.push(`${m.step}: ${field} ${JSON.stringify(m[field])} ≠ ${JSON.stringify(p[field])}`);
    }
    if (waitPoints(m.events) !== waitPoints(p.events)) out.push(`${m.step}: wachtpunten "${m.events}" ≠ "${p.events}"`);
    if (m.bomOk === false || p.bomOk === false) out.push(`${m.step}: de BOM klopt niet (main ${m.bomOk}, PR ${p.bomOk})`);
    if (p.outcome === true && m.outcome === true && p.fingerprint !== 'klopt' && m.fingerprint === 'klopt') {
      out.push(`${m.step}: geslaagd zonder correcte vingerafdruk`);
    }
  });
  return out;
}
