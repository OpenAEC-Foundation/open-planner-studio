// Een scanworker voor `withScanWorker` in Node (geen module-Workers), gedeeld door `check-ifc-foreign-open.ts` (openen)
// en `check-ifc-foreign-target.ts` (de doelscan). Binnenin draait de echte handler van de Worker
// (`createForeignScanHandler`, dezelfde code als `foreignScan.worker.ts`), met de naad van een echte Worker: een kopie
// van elk verzoek via `structuredClone`, elk antwoord als eigen taak met `transfer`, en na het stoppen geen luisteraar
// meer. De modi zetten daar een storing omheen.
import { createForeignScanHandler, type ForeignScanWorkerRequest, type ForeignScanWorkerResponse } from '@/services/ifc/foreign/foreignScanHandler';
import type { ForeignScanWorker } from '@/services/ifc/foreign/foreignScanRunner';

/**
 * `ok`: de echte handler; `transport`: start mislukt (onerror); `indeling`: start, dan op elk verzoek een inhoudelijke
 * fout; `stil`: meldt nooit iets (het script laadt niet); `gestart-stil`: start, en antwoordt daarna nooit; `laat`: alles
 * pas na `LATE_MS` (na een terugval mag dat niets meer doen); `halverwege`: het eerste verzoek gaat goed, bij het tweede
 * breekt het transport; `vals-model`: elke stap van de modelscan zegt 'model'; `vals-indeling`: de indeling telt één C
 * extra. De twee valse modi bewijzen dat het antwoord van de Worker gold en niet een terugval.
 */
export type FakeScanWorkerMode = 'ok' | 'transport' | 'indeling' | 'stil' | 'gestart-stil' | 'laat' | 'halverwege' | 'vals-model' | 'vals-indeling';

/** Na zoveel ms antwoordt de `laat`-Worker. */
export const LATE_MS = 60;

export interface FakeScanWorkerStats {
  /** Aantal gemaakte Workers. */
  workers: number;
  /** Aantal verzoeken met bytes voor de indeling. */
  classify: number;
  /** Aantal stukken voor de modelscan (zonder het einde). */
  pushes: number;
  /** Aantal verzoeken aan de modelscan (stukken en het einde). */
  steps: number;
  /** Aantal gestopte Workers. */
  terminated: number;
  /** Berichten die de Worker na het stoppen nog stuurde, zonder luisteraar (de runner deed er niets meer mee). */
  ignored: number;
}

export const fakeScanWorkerStats = (): FakeScanWorkerStats => ({ workers: 0, classify: 0, pushes: 0, steps: 0, terminated: 0, ignored: 0 });

export function fakeScanWorker(mode: FakeScanWorkerMode, stats: FakeScanWorkerStats = fakeScanWorkerStats()): ForeignScanWorker {
  stats.workers++;
  let requests = 0;
  const w: ForeignScanWorker = {
    onmessage: null, onerror: null, onmessageerror: null,
    terminate: () => { stats.terminated++; },
  } as unknown as ForeignScanWorker;
  const deliver = (data: ForeignScanWorkerResponse, transfer: ArrayBuffer[] = []) => {
    const listener = w.onmessage as unknown as ((e: { data: unknown }) => void) | null;
    if (!listener) { stats.ignored++; return; }
    listener({ data: structuredClone(data, { transfer }) });
  };
  const fail = () => (w.onerror as unknown as ((e: { message: string; preventDefault: () => void }) => void) | null)
    ?.({ message: 'transport mislukt', preventDefault: () => {} });
  const handle = createForeignScanHandler((response, transfer) => {
    let data = response;
    if (mode === 'vals-model' && 'step' in data) data = { id: data.id, step: { result: 'model' } };
    if (mode === 'vals-indeling' && 'outcome' in data && data.outcome.ok) {
      data = { id: data.id, outcome: { ...data.outcome, counts: { ...data.outcome.counts, C: data.outcome.counts.C + 1 } } };
    }
    // Elk antwoord een eigen taak, zoals tussen threads.
    setTimeout(() => deliver(data, transfer), 0);
  });
  (w as { postMessage: (msg: ForeignScanWorkerRequest) => void }).postMessage = (msg) => {
    requests++;
    if ('bytes' in msg) stats.classify++;
    else {
      stats.steps++;
      if (msg.push !== null) stats.pushes++;
    }
    const copy = structuredClone(msg);
    setTimeout(() => {
      if (mode === 'stil') return;
      if (mode === 'transport' || (mode === 'halverwege' && requests > 1)) { fail(); return; }
      if (mode === 'gestart-stil' || mode === 'indeling') {
        if (requests === 1) deliver({ id: copy.id, started: true });
        if (mode === 'indeling') setTimeout(() => deliver({ id: copy.id, error: 'indeling faalt' }), 0);
        return;
      }
      handle(copy);
    }, mode === 'laat' ? LATE_MS : 0);
  };
  return w;
}
