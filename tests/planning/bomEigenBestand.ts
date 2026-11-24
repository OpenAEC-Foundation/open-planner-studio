import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import type { FileRef } from '@/services/fileAccess';
import { createCloseDocumentDialogActions } from '@/components/layout/DocumentChrome/closeDocumentActions';
import { loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';

export const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
export const addBom = (data: Uint8Array) => new Uint8Array([...UTF8_BOM, ...data]);
export const hasBom = (data: Uint8Array) => UTF8_BOM.every((b, i) => data[i] === b);
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex').slice(0, 16);

export type Kind = 'pad' | 'handle';
export const SEQUENCES = [
  'ongewijzigd', 'wijziging', 'tweemaal', 'automatisch', 'automatisch-voor-de-opslag-veranderd', 'sluitvraag', 'voor-de-opslag-veranderd',
  'voor-de-opslag-veranderd-met-bom', 'tijdens-het-schrijven', 'tijdens-het-schrijven-automatisch', 'gewist', 'al-open', 'gelinkt',
] as const;
export type Sequence = typeof SEQUENCES[number];

export interface Files {
  readonly other: Uint8Array;
  readonly model: Uint8Array;
}

export interface StepTrace {
  readonly step: string;
  readonly outcome: boolean | null;
  readonly errors: readonly string[];
  readonly disk: string | null;
  readonly bomAsExpected: boolean | null;
  readonly fingerprintOnDisk: boolean | null;
  readonly dirty: boolean;
  readonly extra?: Readonly<Record<string, unknown>>;
}

class Handle {
  readonly kind = 'file';
  beforeWrite: (() => void) | null = null;
  onRead: (() => void) | null = null;
  constructor(readonly name: string, public bytes: Uint8Array | null) {}
  async isSameEntry(other: unknown) { return other === this; }
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  async getFile() {
    this.onRead?.();
    if (!this.bytes) throw new DOMException('weg', 'NotFoundError');
    return new File([new Uint8Array(this.bytes).buffer], this.name);
  }
  async createWritable() {
    const parts: Uint8Array[] = [];
    return {
      write: async (part: Uint8Array | string) => {
        const during = this.beforeWrite;
        this.beforeWrite = null;
        during?.();
        parts.push(typeof part === 'string' ? new TextEncoder().encode(part) : new Uint8Array(part));
      },
      abort: async () => {},
      close: async () => { this.bytes = new Uint8Array(Buffer.concat(parts)); },
    };
  }
}

type Store = ReturnType<Awaited<ReturnType<typeof loadStore>>['createAppStoreContext']>['store'];

export interface Place {
  readonly ref: FileRef;
  read(): Uint8Array | null;
  put(data: Uint8Array): void;
  remove(): void;
  duringWrite(action: () => void): void;
  onRead(action: () => void): void;
  link?: string;
  dispose(): void;
}

export function placeOnDisk(root: string, data: Uint8Array, linked = false): Place {
  const folder = mkdtempSync(join(root, 'pad-'));
  const file = join(folder, 'planning.ifc');
  writeFileSync(file, data);
  const path = linked ? join(folder, 'koppeling.ifc') : file;
  if (linked) symlinkSync(file, path);
  const ipc = installNodeFileIpc({ appDataDir: join(folder, 'appdata') });
  let during: (() => void) | null = null;
  let reading: (() => void) | null = null;
  ipc.faults.onCall = (command, called) => {
    if ((command === 'plugin:fs|open' || command === 'plugin:fs|read_file') && called === path) reading?.();
    if (!during || !/^plugin:fs\|write_(?:file|text_file)$/.test(command)) return;
    const action = during;
    during = null;
    action();
  };
  return {
    ref: { kind: 'path', path },
    read: () => { try { return new Uint8Array(readFileSync(path)); } catch { return null; } },
    put: next => writeFileSync(path, next),
    remove: () => unlinkSync(path),
    duringWrite: action => { during = action; },
    onRead: action => { reading = action; },
    ...(linked ? { link: path } : {}),
    dispose: () => ipc.dispose(),
  };
}

export function placeInBrowser(data: Uint8Array): Place {
  const handle = new Handle('planning.ifc', data);
  return {
    ref: { kind: 'handle', handle: handle as unknown as FileSystemFileHandle },
    read: () => handle.bytes,
    put: next => { handle.bytes = next; },
    remove: () => { handle.bytes = null; },
    duringWrite: action => { handle.beforeWrite = action; },
    onRead: action => { handle.onRead = action; },
    dispose: () => {},
  };
}

export async function openStore(data: Uint8Array, ref: FileRef): Promise<Store> {
  const { createAppStoreContext } = await loadStore();
  const { store } = createAppStoreContext();
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

export async function ownPlanning(source: Uint8Array): Promise<Uint8Array> {
  const place = placeInBrowser(source);
  const store = await openStore(source, place.ref);
  await store.getState().saveFileForDocument(store.getState().activeDocumentId);
  return place.read()!;
}

export async function trace(
  root: string, kind: Kind, source: Uint8Array, withBom: boolean, sequence: Sequence, files: Files,
): Promise<StepTrace[]> {
  const start = withBom ? addBom(source) : source;
  const place = kind === 'pad' ? placeOnDisk(root, start, sequence === 'gelinkt') : placeInBrowser(start);
  const steps: StepTrace[] = [];
  try {
    const store = await openStore(start, place.ref);
    const autoSave = createFileAutoSaveController({ getState: store.getState, enabled: () => true });
    let renames = 0;
    let lastByApp = true, otherHadBom = false;
    const byOther = (data: Uint8Array) => { lastByApp = false; otherHadBom = hasBom(data); place.put(data); };
    const rename = () => {
      const task = store.getState().tasks.find(t => !t.isSummary)!;
      store.getState().updateTask(task.id, { name: `Hernoemd ${++renames}` });
    };
    const record = (step: string, outcome: boolean | null, extra?: Record<string, unknown>) => {
      const s = store.getState();
      if (outcome === true) lastByApp = true;
      const disk = place.read();
      const bom = disk ? hasBom(disk) : null;
      const shown = disk && withBom && bom ? disk.subarray(UTF8_BOM.length) : disk;
      const bomAsExpected = disk ? bom === (lastByApp ? withBom : otherHadBom) : null;
      const known = s.knownTargetFingerprint;
      steps.push({
        step, outcome,
        errors: s.ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey),
        disk: shown ? sha(shown) : null, bomAsExpected,
        fingerprintOnDisk: known && disk ? known.byteLength === disk.byteLength && known.sha256 === createHash('sha256').update(disk).digest('hex') : null,
        dirty: s.isDirty,
        ...(extra ? { extra } : {}),
      });
      store.setState(st => { st.ui.notifications = []; });
    };
    const ctrlS = async (step: string) => record(step, await store.getState().saveFileForDocument(store.getState().activeDocumentId));
    const auto = async (step: string) => {
      store.getState().setAutoSaveToFile(true);
      await autoSave.flush();
      record(step, !store.getState().isDirty);
    };
    const external = (data: Uint8Array) => (sequence.endsWith('-met-bom') && withBom ? addBom(data) : data);
    record('geopend', null, { tasks: store.getState().tasks.length });
    switch (sequence) {
      case 'ongewijzigd': await ctrlS('Ctrl+S'); break;
      case 'wijziging': rename(); await ctrlS('Ctrl+S'); break;
      case 'tweemaal': rename(); await ctrlS('Ctrl+S 1'); rename(); await ctrlS('Ctrl+S 2'); break;
      case 'automatisch': rename(); await auto('ronde 1'); rename(); await auto('ronde 2'); rename(); await ctrlS('Ctrl+S daarna'); break;
      case 'automatisch-voor-de-opslag-veranderd':
        rename(); byOther(files.other); await auto('een andere planning');
        rename(); await auto('volgende ronde');
        break;
      case 'sluitvraag': rename(); record('sluitvraag', await closeQuestionSave(store)); break;
      case 'voor-de-opslag-veranderd':
      case 'voor-de-opslag-veranderd-met-bom':
        rename();
        byOther(external(files.other)); await ctrlS('een andere planning');
        byOther(external(files.model)); await ctrlS('een gebouwmodel');
        place.put(start); lastByApp = true; await ctrlS('de geopende versie terug');
        break;
      case 'tijdens-het-schrijven':
      case 'tijdens-het-schrijven-automatisch':
        rename();
        place.duringWrite(() => byOther(files.model));
        if (sequence === 'tijdens-het-schrijven') await ctrlS('Ctrl+S'); else await auto('ronde');
        break;
      case 'gewist': rename(); place.remove(); await ctrlS('Ctrl+S'); break;
      case 'al-open': {
        rename(); await ctrlS('Ctrl+S');
        const before = store.getState().getOpenDocumentPayloads().length;
        const name = place.ref.kind === 'path' ? basename(place.ref.path) : 'planning.ifc';
        await store.getState().openOpenedFile({ name, content: '', bytes: place.read()!, ref: place.ref });
        const s = store.getState();
        record('opnieuw geopend', null, {
          extraTabs: s.getOpenDocumentPayloads().length - before,
          changedOnDisk: !!s.documents.find(d => d.id === s.activeDocumentId)?.changedOnDisk,
        });
        break;
      }
      case 'gelinkt':
        rename(); await ctrlS('Ctrl+S');
        if (place.link) record('koppeling', null, { stillLink: lstatSync(place.link).isSymbolicLink() });
        break;
    }
  } finally { place.dispose(); }
  return steps;
}

export function differences(main: readonly StepTrace[], pr: readonly StepTrace[]): string[] {
  if (main.length !== pr.length) return [`aantal stappen ${main.length} ≠ ${pr.length}`];
  const out: string[] = [];
  main.forEach((m, i) => {
    const p = pr[i];
    for (const field of ['step', 'outcome', 'errors', 'disk', 'fingerprintOnDisk', 'dirty', 'extra'] as const) {
      if (JSON.stringify(m[field]) !== JSON.stringify(p[field])) out.push(`${m.step}: ${field} ${JSON.stringify(m[field])} ≠ ${JSON.stringify(p[field])}`);
    }
    if (m.bomAsExpected === false || p.bomAsExpected === false) out.push(`${m.step}: de BOM klopt niet (zonder ${m.bomAsExpected}, met ${p.bomAsExpected})`);
  });
  return out;
}

export async function allTraces(repo: string, root: string, withBom: boolean): Promise<Record<string, StepTrace[]>> {
  const read = (rel: string) => new Uint8Array(readFileSync(join(repo, rel)));
  const example = read('public/examples/03-kantoorgebouw-zuidas.ifc');
  const files = { other: read('public/examples/10-villa-wassenaar.ifc'), model: read('tests/fixtures/ifc-foreign/eigen-plus-model.ifc') };
  const lf = await ownPlanning(example);
  const crlf = new TextEncoder().encode(new TextDecoder().decode(lf).split('\n').join('\r\n'));
  const sources = [['eigen planning (LF)', lf], ['eigen planning (CRLF)', crlf], ['voorbeeld 03', example]] as const;
  const out: Record<string, StepTrace[]> = {};
  for (const [name, source] of sources) {
    for (const kind of ['pad', 'handle'] as const) {
      for (const sequence of SEQUENCES) {
        if (sequence === 'gelinkt' && kind === 'handle') continue;
        out[`${name} | ${kind} | ${sequence}`] = await trace(root, kind, source, withBom, sequence, files);
      }
    }
  }
  return out;
}
