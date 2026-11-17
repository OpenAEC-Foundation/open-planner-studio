// Een nep-scanworker zoals `foreignScan.worker.ts`, voor `runForeignScan` in Node (geen module-Workers). Gedeeld door
// `check-ifc-foreign-open.ts` (openen) en `check-ifc-foreign-target.ts` (de doelscan), zodat beide dezelfde Worker-naad
// gebruiken: een kopie van de bytes via `structuredClone`, eerst de startbevestiging, dan het antwoord async met
// `transfer`, de indeling in de "Worker". `realHandlerWorker` laat de echte handler van `foreignScan.worker.ts` antwoorden.
import { foreignScanTransferables, scanForeign } from '@/services/ifc/foreign/foreignScan';
import type { ForeignScanWorker } from '@/services/ifc/foreign/foreignScanRunner';
import type { ForeignScanWorkerRequest, ForeignScanWorkerResponse } from '@/services/ifc/foreign/foreignScan.worker';

/**
 * `ok`: start en rekent echt; `transport`: start mislukt (onerror); `indeling`: start, dan een inhoudelijke fout;
 * `stil`: meldt nooit iets (het script laadt niet); `gestart-stil`: start, en antwoordt daarna nooit; `laat`: start pas
 * na `LATE_MS` en antwoordt dan echt (na een terugval mag dat niets meer doen); `vals`: start en antwoordt met één
 * C-entiteit extra in de tellingen, zodat een proef ziet dat het antwoord van de Worker gold en niet een terugval.
 */
export type FakeScanWorkerMode = 'ok' | 'transport' | 'indeling' | 'stil' | 'gestart-stil' | 'laat' | 'vals';

/** Na zoveel ms start de `laat`-Worker. */
export const LATE_MS = 60;

export interface FakeScanWorkerStats {
  /** Aantal verzoeken dat een Worker kreeg. */
  posts: number;
  /** Aantal gestopte Workers. */
  terminated: number;
  /** Berichten die de Worker na het stoppen nog stuurde, zonder luisteraar (de runner deed er niets meer mee). */
  ignored: number;
}

export const fakeScanWorkerStats = (): FakeScanWorkerStats => ({ posts: 0, terminated: 0, ignored: 0 });

type Deliver = (data: ForeignScanWorkerResponse, transfer?: ArrayBuffer[]) => void;

/** De naad van een echte Worker: kopie heen, overdracht terug, berichten na het stoppen zonder luisteraar. */
function workerShell(stats: FakeScanWorkerStats, handle: (copy: ForeignScanWorkerRequest, deliver: Deliver, fail: () => void) => void): ForeignScanWorker {
  const w: ForeignScanWorker = {
    onmessage: null, onerror: null, onmessageerror: null,
    terminate: () => { stats.terminated++; },
    postMessage: (msg: ForeignScanWorkerRequest) => {
      stats.posts++;
      const copy = structuredClone(msg);
      const deliver: Deliver = (data, transfer = []) => {
        const listener = w.onmessage as unknown as ((e: { data: unknown }) => void) | null;
        if (!listener) { stats.ignored++; return; }
        listener({ data: structuredClone(data, { transfer }) });
      };
      const fail = () => (w.onerror as unknown as ((e: { message: string; preventDefault: () => void }) => void) | null)
        ?.({ message: 'start mislukt', preventDefault: () => {} });
      handle(copy, deliver, fail);
    },
  } as unknown as ForeignScanWorker;
  return w;
}

export function fakeScanWorker(mode: FakeScanWorkerMode, stats: FakeScanWorkerStats = fakeScanWorkerStats()): ForeignScanWorker {
  return workerShell(stats, (copy, deliver, fail) => {
    setTimeout(() => {
      if (mode === 'stil') return;
      if (mode === 'transport') { fail(); return; }
      deliver({ id: copy.id, started: true });
      if (mode === 'gestart-stil') return;
      if (mode === 'indeling') { setTimeout(() => deliver({ id: copy.id, error: 'indeling faalt' }), 0); return; }
      // Zoals `foreignScan.worker.ts`: de typed arrays gaan over met `transfer`, niet als kopie.
      setTimeout(() => {
        const real = scanForeign(copy.bytes);
        const outcome = mode === 'vals' && real.ok ? { ...real, counts: { ...real.counts, C: real.counts.C + 1 } } : real;
        deliver({ id: copy.id, outcome }, foreignScanTransferables(outcome));
      }, 0);
    }, mode === 'laat' ? LATE_MS : 0);
  });
}

/**
 * De handler van `foreignScan.worker.ts` zelf, met een eigen `self` alleen tijdens het laden en tijdens één bericht.
 * Laadt de handler één keer (async) en geeft een synchrone `createWorker`-fabriek terug.
 */
export async function loadRealScanHandler(): Promise<(stats?: FakeScanWorkerStats) => ForeignScanWorker> {
  const fakeSelf = {
    onmessage: null as ((e: { data: ForeignScanWorkerRequest }) => void) | null,
    post: (() => {}) as Deliver,
    postMessage(data: ForeignScanWorkerResponse, opts?: { transfer?: ArrayBuffer[] }) { fakeSelf.post(data, opts?.transfer); },
  };
  const g = globalThis as { self?: unknown };
  const withSelf = (run: () => void) => {
    const saved = g.self;
    g.self = fakeSelf;
    try { run(); } finally { g.self = saved; }
  };
  const saved = g.self;
  g.self = fakeSelf;
  try { await import('@/services/ifc/foreign/foreignScan.worker'); } finally { g.self = saved; }
  if (!fakeSelf.onmessage) throw new Error('foreignScan.worker.ts zette geen onmessage');
  return (stats = fakeScanWorkerStats()) => workerShell(stats, (copy, deliver) => {
    setTimeout(() => withSelf(() => {
      // Elke `postMessage` van de handler wordt een eigen taak, zoals tussen threads.
      fakeSelf.post = (data, transfer) => { setTimeout(() => deliver(data, transfer), 0); };
      fakeSelf.onmessage!({ data: copy });
    }), 0);
  });
}
