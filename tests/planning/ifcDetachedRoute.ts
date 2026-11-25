import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileAutoSaveController } from '@/services/actualAutosave/fileAutoSave';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { refsOutsideText, replaceRefsOutsideText } from '@/services/ifc/foreign/lossCheck';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { mappedChunks } from '@/services/ifc/foreign/sourceSlots';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';
import { registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { loadStore } from './ifcAppRoute';
import { cloneDomain, firstDiff, openForeign } from './ifcMergeKern';
import { installNodeFileIpc } from './nodeFileIpc';

type Store = ReturnType<Awaited<ReturnType<typeof loadStore>>['createAppStoreContext']>['store'];

export interface DesktopDocument {
  readonly store: Store;
  readonly path: string;
  readonly file: () => Uint8Array;
  readonly ctrlS: () => Promise<boolean>;
  readonly autoSave: () => Promise<void>;
  readonly close: () => void;
}

export function desktopRoute() {
  const appDataDir = mkdtempSync(join(tmpdir(), 'ops-detached-appdata-'));
  const dir = mkdtempSync(join(tmpdir(), 'ops-detached-'));
  const ipc = installNodeFileIpc({ appDataDir });
  const win = window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } };
  const invoke = win.__TAURI_INTERNALS__.invoke;
  let chosen: string | null = null;
  win.__TAURI_INTERNALS__.invoke = async (...args) => (args[0] === 'plugin:dialog|save' ? chosen : invoke(...args));
  let files = 0;
  async function open(bytes: Uint8Array, flag = true): Promise<DesktopDocument> {
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    const path = join(dir, `bestand-${++files}.ifc`);
    writeFileSync(path, bytes);
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: flag }; });
    await store.getState().openOpenedFile({ name: 'bron.ifc', content: new TextDecoder().decode(bytes), bytes, ref: { kind: 'path', path } });
    const tracker = new RecoveryDeltaTracker();
    const unregister = registerRecoveryFlush(async () => {
      const s = store.getState();
      await runRecoveryTick(tracker, s.activeDocumentId, s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
    });
    let clock = 5_000_000;
    let controller: ReturnType<typeof createFileAutoSaveController> | undefined;
    return {
      store, path,
      file: () => new Uint8Array(readFileSync(path)),
      ctrlS: () => store.getState().saveFileForDocument(store.getState().activeDocumentId),
      autoSave: async () => {
        if (!controller) {
          store.getState().setAutoSaveToFile(true);
          controller = createFileAutoSaveController({ getState: store.getState, enabled: () => true, now: () => clock });
        }
        controller.observe();
        clock += 31_000;
        await controller.flushModels();
      },
      close: () => { unregister(); },
    };
  }
  return {
    open, ipc,
    choose: (name: string) => { chosen = join(dir, name); return chosen; },
    dispose: () => { ipc.dispose(); rmSync(dir, { recursive: true, force: true }); rmSync(appDataDir, { recursive: true, force: true }); },
  };
}

const GUID = /^'[0-9A-Za-z_$]{22}'$/;

function foreignPart(bytes: Uint8Array, source: IfcSource): Map<string, number> {
  const index = scanForeignStep(bytes);
  const memo = new Map<number, string>();
  const refs = (token: string) => replaceRefsOutsideText(token, id => {
    const t = index.chunkOf(String(id));
    return t < 0 ? '#?' : `<${key(t)}>`;
  });
  const content = (c: number): string => `${index.type(c)}(${(index.argTokens(c) ?? []).map(refs).join(',')})`;
  const key = (c: number): string => {
    const known = memo.get(c);
    if (known !== undefined) return known;
    memo.set(c, `kring ${index.type(c)}`);
    const args = index.argTokens(c) ?? [];
    const value = args.length >= 5 && GUID.test(args[0].trim()) ? args[0].trim() : content(c);
    memo.set(c, value);
    return value;
  };
  const counts = new Map<string, number>();
  const add = (text: string) => counts.set(text, (counts.get(text) ?? 0) + 1);
  for (let c = 0; c < index.count; c++) if (index.isEntity(c) && source.classes[c] !== 1) add(content(c));
  for (const [c] of mappedChunks(index, source.sourceSlots ?? new Map())) {
    (index.argTokens(c) ?? []).forEach((token, k) => {
      for (const id of refsOutsideText(token)) {
        const t = index.chunkOf(String(id));
        if (t >= 0 && source.classes[t] !== 1) add(`${key(c)}.${k} wijst naar ${key(t)}`);
      }
    });
  }
  return counts;
}

export async function endDifferences(expected: Uint8Array, actual: Uint8Array): Promise<string[]> {
  const [e, a] = [await openForeign(expected), await openForeign(actual)];
  const problems: string[] = [];
  const pe = planningCanon(cloneDomain(e)), pa = planningCanon(cloneDomain(a));
  if (pe !== pa) problems.push(`planning: ${firstDiff(pe, pa)}`);
  const fe = foreignPart(expected, e.ifcSource!), fa = foreignPart(actual, a.ifcSource!);
  for (const [text, n] of fe) if ((fa.get(text) ?? 0) !== n) problems.push(`${n}× verwacht, ${fa.get(text) ?? 0}× in de uitvoer: ${text.slice(0, 260)}`);
  for (const [text, n] of fa) if (!fe.has(text)) problems.push(`${n}× extra in de uitvoer: ${text.slice(0, 260)}`);
  return problems;
}
