// Een nep-scanworker zoals `foreignScan.worker.ts`, voor `runForeignScan` in Node (geen module-Workers). Gedeeld door
// `check-ifc-foreign-open.ts` (openen) en `check-ifc-foreign-target.ts` (de doelscan), zodat beide dezelfde Worker-naad
// gebruiken: een kopie van de bytes via `structuredClone`, antwoord async met `transfer`, de indeling in de "Worker".
import { foreignScanTransferables, scanForeign } from '@/services/ifc/foreign/foreignScan';
import type { ForeignScanWorker } from '@/services/ifc/foreign/foreignScanRunner';

/** `ok`: rekent echt; `transport`: start mislukt (onerror); `indeling`: een inhoudelijke fout; `stil`: antwoordt nooit. */
export type FakeScanWorkerMode = 'ok' | 'transport' | 'indeling' | 'stil';

export interface FakeScanWorkerStats {
  /** Aantal verzoeken dat een Worker kreeg. */
  posts: number;
  /** Aantal gestopte Workers. */
  terminated: number;
}

export const fakeScanWorkerStats = (): FakeScanWorkerStats => ({ posts: 0, terminated: 0 });

export function fakeScanWorker(mode: FakeScanWorkerMode, stats: FakeScanWorkerStats = fakeScanWorkerStats()): ForeignScanWorker {
  const w: ForeignScanWorker = {
    onmessage: null, onerror: null, onmessageerror: null,
    terminate: () => { stats.terminated++; },
    postMessage: (msg: { id: number; bytes: Uint8Array }) => {
      stats.posts++;
      const copy = structuredClone(msg);
      setTimeout(() => {
        if (mode === 'stil') return;
        if (mode === 'transport') {
          (w.onerror as unknown as (e: { message: string; preventDefault: () => void }) => void)?.({ message: 'start mislukt', preventDefault: () => {} });
          return;
        }
        const deliver = (data: unknown, transfer: ArrayBuffer[] = []) =>
          (w.onmessage as unknown as (e: { data: unknown }) => void)?.({ data: structuredClone(data, { transfer }) });
        if (mode === 'indeling') { deliver({ id: copy.id, error: 'indeling faalt' }); return; }
        // Zoals `foreignScan.worker.ts`: de typed arrays gaan over met `transfer`, niet als kopie.
        const outcome = scanForeign(copy.bytes);
        deliver({ id: copy.id, outcome }, foreignScanTransferables(outcome));
      }, 0);
    },
  } as unknown as ForeignScanWorker;
  return w;
}
