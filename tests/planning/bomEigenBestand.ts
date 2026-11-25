import { createHash } from 'node:crypto';
import { linkSync, lstatSync, mkdtempSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createCloseDocumentDialogActions } from '@/components/layout/DocumentChrome/closeDocumentActions';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import type { FileRef } from '@/services/fileAccess';
import type { SiteStorage } from '@/services/fileAccess/siteHost';
import { resetBrowserSaveNoticeForTests } from '@/state/browserSaveNotice';
import type { AppNotification } from '@/state/slices/types';
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
export const FLAG_MOMENTS = ['recht', 'rekenen', 'lezing-1', 'lezing-2', 'lezing-3', 'schrijven'] as const;
export type Moment = typeof MOMENTS[number] | 'bomversie' | 'kiezer';
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
  readonly sequences: readonly (readonly StepTrace[])[];
  readonly cases: Readonly<Record<string, number>>;
  readonly boundaries: Readonly<Record<string, readonly StepTrace[]>>;
}

export function recorded(recording: Recording, name: string): readonly StepTrace[] | undefined {
  const at = recording.cases[name];
  return at === undefined ? undefined : recording.sequences[at];
}

export function shareSequences(cases: Record<string, StepTrace[]>): { sequences: StepTrace[][]; cases: Record<string, number> } {
  const sequences: StepTrace[][] = [];
  const seen = new Map<string, number>();
  const index: Record<string, number> = {};
  for (const [name, steps] of Object.entries(cases)) {
    const key = JSON.stringify(steps);
    let at = seen.get(key);
    if (at === undefined) { at = sequences.push(steps) - 1; seen.set(key, at); }
    index[name] = at;
  }
  return { sequences, cases: index };
}

class Tracker {
  events: string[] = [];
  reads = 0;
  fired = false;
  inCompute = false;
  output: Uint8Array | null = null;
  private withBomOutput: Uint8Array | null = null;
  private armed: { moment: Moment; action: () => void }[] = [];
  private wasArmed = false;
  constructor(readonly withBom: boolean) {}
  arm(moment: Moment, action: () => void) {
    if (this.armed.length === 0) { this.reads = 0; this.fired = false; }
    this.armed.push({ moment, action });
    this.wasArmed = true;
  }
  settle(): Record<string, unknown> | undefined {
    const result = this.wasArmed ? { ingreep: this.fired } : undefined;
    this.armed = [];
    this.wasArmed = false;
    this.fired = false;
    return result;
  }
  fire(moment: Moment) {
    const due = this.armed.filter(a => a.moment === moment);
    if (due.length === 0) return;
    this.armed = this.armed.filter(a => a.moment !== moment);
    this.fired = true;
    for (const { action } of due) action();
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
    if (new Error().stack?.includes('isOwnBomVersion')) { this.note('hash-bomversie', 'bomversie'); return; }
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
  expectBom: boolean;
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
    ref: { kind: 'path', path }, appBom, expectBom: appBom, byApp: true, otherBom: false,
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
    handle, ref: { kind: 'handle', handle: handle as unknown as FileSystemFileHandle }, appBom, expectBom: appBom, byApp: true, otherBom: false,
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
  flag(on: boolean): void;
  attemptWithFlagOff(): void;
  save(step: string, how: How, after?: () => Record<string, unknown>): Promise<void>;
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
  readonly computes?: readonly Compute[];
  readonly opening?: false;
  run(r: Run): Promise<void>;
}

const VOORAF = [
  ['vreemde inhoud', (r: Run) => r.byOther(r.files.foreign)],
  ['geen IFC', (r: Run) => r.byOther(new TextEncoder().encode('Geen IFC'))],
  ['een gebouwmodel, in de wereld van het bestand', (r: Run) => r.byOther(r.inBomWorld(r.files.model))],
  ['gewist', (r: Run) => r.place.remove()],
  ['een leesfout', (r: Run) => r.place.fail('lezen')],
] as const;

const ROUTES = ['Ctrl+S', 'Automatisch opslaan'] as const;
const ORIGINS = ['geopend', 'na een eigen opslag'] as const;
export const CHANGES: readonly (readonly [string, ((files: Files) => Uint8Array) | null])[] = [
  ['een andere planning met BOM', files => addBom(files.other)],
  ['een andere planning zonder BOM', files => files.other],
  ['een gebouwmodel met BOM', files => addBom(files.model)],
  ['een gebouwmodel zonder BOM', files => files.model],
  ['het eigen bestand onveranderd', null],
];
export const SWITCHES = ['uit', 'uit en weer aan'] as const;
type Switch = typeof SWITCHES[number] | 'aan';
export const switchBaseline = (name: string) => name.replace(/; wissel [^;]+$/, '');
export const isSwitch = (name: string) => switchBaseline(name) !== name;
export const atBomVersion = (name: string) => name.includes(' bij bomversie');

function attempt(
  how: typeof ROUTES[number], origin: typeof ORIGINS[number], startOn: boolean, change: string,
  data: ((files: Files) => Uint8Array) | null, early: boolean, at: Moment | null, flip: Switch | null, flipAt: Moment | null,
): Scenario {
  const what = early ? `vooraf ${change}` : at ? `${change} bij ${at}` : change;
  const moments = [at, flipAt].filter((m): m is Moment => m !== null);
  return {
    name: `${how}, ${origin}, flag ${startOn ? 'aan' : 'uit'}: ${what}${flip ? `; wissel ${flip} bij ${flipAt}` : ''}`, opening: false,
    kinds: moments.includes('recht') ? ['handle'] : undefined,
    computes: moments.every(m => m === 'rekenen' || m === 'hash') ? undefined : ['hier'],
    run: async r => {
      await fromOrigin(r, origin);
      if (!startOn) r.attemptWithFlagOff();
      r.rename();
      const external = data ? data(r.files) : null;
      let placed = false;
      const put = () => { if (external) { r.byOther(external); placed = true; } };
      if (early) put();
      if (at && !early) r.at(at, put);
      if (flip && flipAt) {
        r.at(flipAt, () => {
          r.flag(flip === 'aan');
          if (flip === 'uit en weer aan') r.flag(true);
        });
      }
      await r.save(how, how, () => {
        const disk = r.place.read();
        return { extern: !external ? 'geen' : !placed ? 'niet geplaatst' : disk && sameBytes(disk, external) ? 'byte voor byte' : 'overschreven' };
      });
    },
  };
}

function withSwitch(base: Scenario, flip: Switch, at: Moment): Scenario {
  return {
    ...base, name: `${base.name}; wissel ${flip} bij ${at}`,
    run: async r => {
      r.at(at, () => {
        r.flag(flip === 'aan');
        if (flip === 'uit en weer aan') r.flag(true);
      });
      await base.run(r);
    },
  };
}

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
  list.push({
    name: 'recht geweigerd, de kiezer kiest een nieuw bestand, één poging', kinds: ['handle'],
    run: async r => {
      const handle = (r.place as ReturnType<typeof placeInBrowser>).handle;
      handle.query = 'prompt';
      handle.request = 'denied';
      r.picker('nieuw bestand');
      r.rename(); await r.save('Ctrl+S', 'Ctrl+S');
    },
  });
  for (const base of list.filter(c => c.name === 'recht geweigerd, de kiezer kiest een nieuw bestand, één poging' || c.name === 'het rechtverzoek faalt')) {
    for (const flip of SWITCHES) list.push(withSwitch(base, flip, 'kiezer'));
  }
  for (const how of ROUTES) {
    for (const origin of ORIGINS) {
      for (const [content, change] of VOORAF) {
        list.push({
          name: `${how}, ${origin}: vooraf ${content}`,
          run: async r => { await fromOrigin(r, origin); r.rename(); change(r); await r.save(how, how); },
        });
      }
      for (const startOn of origin === 'geopend' ? [true, false] : [true]) {
        for (const [change, data] of CHANGES) {
          list.push(attempt(how, origin, startOn, change, data, !!data, null, null, null));
          if (data) for (const at of startOn ? MOMENTS : FLAG_MOMENTS) list.push(attempt(how, origin, startOn, change, data, false, at, null, null));
          for (const flipAt of FLAG_MOMENTS) {
            for (const flip of startOn ? SWITCHES : ['aan' as const]) {
              if (data) list.push(attempt(how, origin, startOn, change, data, false, flipAt, flip, flipAt));
              list.push(attempt(how, origin, startOn, change, data, !!data, null, flip, flipAt));
            }
          }
        }
      }
      if (origin === 'geopend') {
        for (const [change, data] of CHANGES) {
          if (!data) continue;
          for (const flip of [null, ...SWITCHES]) list.push(attempt(how, origin, true, change, data, false, 'bomversie', flip, flip ? 'lezing-1' : null));
        }
      }
      for (const moment of MOMENTS) {
        list.push({
          name: `${how}, ${origin}: het tabblad bewerkt bij ${moment}`, opening: false,
          kinds: moment === 'recht' ? ['handle'] : undefined,
          run: async r => {
            await fromOrigin(r, origin);
            r.rename();
            r.at(moment, () => r.rename());
            await r.save(how, how);
          },
        });
      }
      for (const failure of ['schijf vol', 'hernoemen', 'schrijfstroom'] as const) {
        const failed: Scenario = {
          name: `${how}, ${origin}: ${failure} mislukt`,
          kinds: failure === 'schrijfstroom' ? ['handle'] : ['pad'],
          run: async r => {
            await fromOrigin(r, origin);
            r.rename();
            r.place.fail(failure);
            if (failure === 'schrijfstroom') r.picker('nieuw bestand');
            await r.save(how, how);
          },
        };
        list.push(failed);
        if (failure === 'schrijfstroom' && how === 'Ctrl+S') for (const flip of SWITCHES) list.push(withSwitch(failed, flip, 'kiezer'));
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
  resetBrowserSaveNoticeForTests();
  try {
    const computeOut = computeFor(compute, tracker, control);
    const store = await openStore(start, place.ref, computeOut);
    const autoSave = createFileAutoSaveController({ getState: store.getState, enabled: () => true, compute: computeOut });
    let renames = 0;
    let bomWithFlag = true;
    const placeOf = () => {
      const s = store.getState();
      return places.find(p => (p.ref.kind === 'handle' ? s.fileHandle === p.ref.handle : p.ref.kind === 'path' && s.filePath === p.ref.path)) ?? null;
    };
    const stable = (text: string) => text.split(root).join('<root>').replace(/<root>\/pad-[^/"\\\s]+/g, '<map>')
      .replace(/save-[a-z0-9]+\.ops-save\.tmp/g, '<tijdelijk>');
    const record = (step: string, outcome: boolean | null, extra?: Record<string, unknown>) => {
      const s = store.getState();
      const target = placeOf() ?? place;
      const disk = target.read();
      if (disk && tracker.output && sameBytes(withoutBom(disk), tracker.output)) {
        target.byApp = true;
        target.expectBom = target.appBom && bomWithFlag;
      }
      steps.push({
        step, outcome,
        notices: s.ui.notifications.map(n => stable(noticeOf(n))),
        disk: disk ? sha256(withoutBom(disk)) : null,
        bomOk: disk ? hasBom(disk) === (target.byApp ? target.expectBom : target.otherBom) : null,
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
      flag: on => store.getState().setUI({ featureFlags: on ? { ifcForeignContent: true } : {} }),
      attemptWithFlagOff: () => { store.getState().setUI({ featureFlags: {} }); bomWithFlag = false; },
      record,
      save: async (step, how, after) => {
        let outcome: boolean;
        if (how === 'Ctrl+S') outcome = await store.getState().saveFileForDocument(store.getState().activeDocumentId);
        else if (how === 'sluitvraag') outcome = await closeQuestionSave(store);
        else {
          store.getState().setAutoSaveToFile(true);
          await autoSave.flush();
          outcome = !store.getState().isDirty;
        }
        const extra = { ...tracker.settle(), ...after?.() };
        record(step, outcome, Object.keys(extra).length ? extra : undefined);
      },
      picker: answer => {
        win.showOpenFilePicker = async () => [];
        win.showSaveFilePicker = async () => {
          tracker.note('kiezer', 'kiezer');
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
    if (scenario.opening === false) tracker.take();
    else record('geopend', null, { tasks: store.getState().tasks.length });
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
        if (scenario.computes && !scenario.computes.includes(compute)) continue;
        for (const source of scenario.sources ?? ['LF']) {
          yield { name: `${source} | ${kind} | ${compute} | ${scenario.name}`, kind, compute, source, scenario };
        }
      }
    }
  }
}

export async function runCases(root: string, files: Files, withBom: boolean, only?: RegExp): Promise<Record<string, StepTrace[]>> {
  reseed ??= installDeterminism();
  const restore = patchDigest();
  const out: Record<string, StepTrace[]> = {};
  try {
    for (const c of caseList()) {
      if (only && !only.test(c.name)) continue;
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
  'extern een andere planning met BOM, in de wereld van het bestand', 'extern de geopende planning terug zonder BOM',
  'onbekende versie na flag uit en aan',
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
            if (name === 'extern een andere planning met BOM, in de wereld van het bestand') r.byOther(r.inBomWorld(files.other));
            if (name === 'extern de geopende planning terug zonder BOM') r.byOther(files.lf);
            r.rename();
            await r.save('Ctrl+S', 'Ctrl+S');
          },
        });
      }
    }
    reseed(0x2212);
    out['handle | recht geweigerd, een andere planning met BOM in de wereld van het bestand'] = await runScenario(
      root, files, withBom, 'handle', 'hier', files.lf, {
        name: 'recht geweigerd',
        run: async r => {
          const handle = (r.place as ReturnType<typeof placeInBrowser>).handle;
          handle.query = 'prompt';
          handle.request = 'denied';
          r.picker('nieuw bestand');
          r.byOther(r.inBomWorld(files.other));
          r.rename();
          await r.save('Ctrl+S', 'Ctrl+S');
        },
      });
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
      step: 'Ctrl+S', outcome: saved, notices: s.ui.notifications.map(noticeOf),
      disk: sha256(withoutBom(onSite)), bomOk: null, fingerprint: fingerprintOf(s.knownTargetFingerprint, onSite), dirty: s.isDirty,
      events: '', extra: { opened, saves, version },
    }];
  } finally {
    delete win.openaecHost;
  }
}

function noticeOf(notice: AppNotification): string {
  const rest = Object.entries(notice).filter(([key]) => !['id', 'dedupeKey', 'severity', 'messageKey'].includes(key));
  return `${notice.severity}:${notice.messageKey}${rest.length ? ` ${JSON.stringify(Object.fromEntries(rest))}` : ''}`;
}

const TARGET_READ = /^(?:open|read_file):(?:doel|koppeling)$|^lezen$/;
const WRITE = /^(?:write_file|write_text_file|write)(?::|$)|^schrijfstroom$/;

function bomHashBeforeWrite(tokens: readonly string[], at: number): boolean {
  for (const token of tokens.slice(at + 1)) {
    if (TARGET_READ.test(token)) return false;
    if (WRITE.test(token)) return true;
  }
  return false;
}

export function waitPoints(events: string): string {
  const tokens = events ? events.split(' ') : [];
  return tokens.filter((token, i) => token !== 'hash-bomversie' || bomHashBeforeWrite(tokens, i)).join(' ')
    .replace(/hash-uitvoer(?: hash-uitvoer)+/g, 'hash-uitvoer');
}

export const lastWaitIsBomHash = (events: string) => {
  const tokens = events ? events.split(' ') : [];
  return tokens.some((token, i) => token === 'hash-bomversie' && bomHashBeforeWrite(tokens, i));
};

export function differences(main: readonly StepTrace[], pr: readonly StepTrace[], switched: string | null = null): string[] {
  if (main.length !== pr.length) return [`aantal stappen ${main.length} ≠ ${pr.length}`];
  const out: string[] = [];
  const withoutIngreep = (extra: StepTrace['extra']) => (extra ? Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'ingreep')) : {});
  main.forEach((m, i) => {
    const p = pr[i];
    const clearedBySetting = switched !== null && switched !== 'aan' && p.outcome !== true && p.fingerprint === 'geen';
    for (const field of ['step', 'outcome', 'notices', 'disk', 'fingerprint', 'dirty', 'extra'] as const) {
      if (field === 'fingerprint' && clearedBySetting) continue;
      const [a, b] = field === 'extra' && switched !== null ? [withoutIngreep(m.extra), withoutIngreep(p.extra)] : [m[field], p[field]];
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${m.step}: ${field} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
    }
    if (waitPoints(m.events) !== waitPoints(p.events)) out.push(`${m.step}: wachtpunten "${m.events}" ≠ "${p.events}"`);
    if (lastWaitIsBomHash(p.events)) out.push(`${m.step}: de hash van de BOM-versie is het laatste wachtpunt vóór het schrijven`);
    if (m.bomOk === false || p.bomOk === false) out.push(`${m.step}: de BOM klopt niet (main ${m.bomOk}, PR ${p.bomOk})`);
  });
  return out;
}
