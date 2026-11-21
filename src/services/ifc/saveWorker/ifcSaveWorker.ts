/**
 * De bediening van de opslagworker (#804 stap 4), op het patroon van `recoverySnapshotSerializer.ts`: één herbruikbare
 * worker, hoogstens één verzoek tegelijk (een volgend verzoek wacht zijn beurt af), een verzoeknummer, een time-out die
 * met de grootte van de bron meegroeit, en `dispose` breekt een lopend verzoek af. De gemounte app bezit één client
 * (`appStore.ts`, stap 5) en geeft zijn berekenfunctie onvoorwaardelijk aan de opslagroutes: de merge én de gewone
 * writer rekenen hier (stap 6, besluit technisch beslisser 16 november 2026, zonder flag).
 *
 * De terugvalregel (besluit technisch beslisser, 16 november 2026): alleen als de worker niet start, rekent de
 * hoofdthread zelf, met `computeIfcOutputHere` (zoals `prepareIfcOutput` zonder worker). "Gestart" betekent: de worker
 * meldde `started` (zijn script en imports zijn geladen). Daarvóór zijn een ontbrekende `Worker`, een fout in de
 * constructor (de sandbox van de SuperCloud-werkplek, zie `backgroundLeveling.ts`), een fout bij het laden of geen
 * start binnen `IFC_SAVE_START_TIMEOUT_MS` een startprobleem: terugval, en de rest van de sessie rekent de hoofdthread.
 * Daarna is sterven, de tijd overschrijden of een onleesbaar antwoord een fout (`IfcSaveWorkerError`) die de aanroeper
 * als mislukte opslag krijgt; de hoofdthread rekent dan nooit opnieuw (een merge die de worker liet sterven, kan het
 * tabblad laten vastlopen). Een antwoord dat niet bij het verzoek past (`resultFits`), is ook zo'n fout. De volgende
 * opslag start een nieuwe worker. Een inhoudelijke fout (een weigering van de merge, een fout van de writer) komt als
 * dezelfde foutsoort aan en laat de worker staan.
 */
import { computeIfcOutputHere, type IfcOutputCompute, type IfcSaveJob } from '@/state/prepareIfcOutput';
import {
  errorFromWire, outputFromResult, resultFits, wireErrorFits, type IfcSaveRequest, type IfcSaveResponse, type IfcSaveResult,
} from './ifcSaveProtocol';
import { IfcSaveWorkerError } from './ifcSaveWorkerError';
import { meting804 } from '@/services/debug/meting804'; // METING

export type IfcSaveWorkerPort = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;

/** Zonder `started` binnen deze tijd: de worker startte niet, dus terugval. Gekozen grens, niet gemeten (zie knownbug
 *  1759 voor de scanner): wie later start, krijgt de terugval, en die is nooit fout, alleen trager. */
export const IFC_SAVE_START_TIMEOUT_MS = 10_000;

/** De rekentijd: 60 s plus 1 s per begonnen MiB bron (een merge van 300 MB krijgt zo ruim zes minuten). */
export function ifcSaveTimeoutMs(job: IfcSaveJob): number {
  const mib = job.kind === 'merge' ? Math.ceil(job.source.bytes.byteLength / 2 ** 20) : 0;
  return 60_000 + mib * 1_000;
}

/** De worker startte niet: alleen dan rekent de hoofdthread. */
class IfcSaveWorkerNotStarted extends Error {}

export interface IfcSaveWorkerOptions {
  /** Injecteerbaar voor tests. Standaard een module-worker, of `null` zonder `Worker`. */
  createWorker?: () => IfcSaveWorkerPort | null;
  startTimeoutMs?: number;
  timeoutMs?: (job: IfcSaveJob) => number;
}

export interface IfcSaveWorker {
  /** Voor `prepareIfcOutput(state, input, planOnly, compute)`: dezelfde uitkomst, berekend in de worker. */
  readonly compute: IfcOutputCompute;
  /** Stopt de worker; een lopend en elk later verzoek eindigt met `IfcSaveWorkerError` (`disposed`). */
  dispose(): void;
}

export function defaultCreateIfcSaveWorker(): IfcSaveWorkerPort | null {
  if (typeof Worker === 'undefined') return null;
  const worker = new Worker(new URL('./ifcSave.worker.ts', import.meta.url), { type: 'module' });
  meting804('worker aangemaakt'); // METING
  // METING #804: de meetregels van de worker, met zijn eigen klok; naast `onmessage` van `ask`.
  worker.addEventListener('message', ({ data }: MessageEvent) => {
    const m = data as { meting804?: unknown; t?: unknown } | null;
    if (m && typeof m.meting804 === 'string' && typeof m.t === 'number') meting804(`worker: ${m.meting804}`, m.t);
  });
  return worker;
}

export function createIfcSaveWorker(opts: IfcSaveWorkerOptions = {}): IfcSaveWorker {
  const createWorker = opts.createWorker ?? defaultCreateIfcSaveWorker;
  const startTimeoutMs = opts.startTimeoutMs ?? IFC_SAVE_START_TIMEOUT_MS;
  const timeoutMs = opts.timeoutMs ?? ifcSaveTimeoutMs;
  let worker: IfcSaveWorkerPort | null = null;
  let started = false;
  let unavailable = false;
  let disposed = false;
  let nextId = 0;
  let tail: Promise<unknown> = Promise.resolve();
  let abortActive: ((error: Error) => void) | null = null;

  const stopWorker = () => {
    worker?.terminate();
    worker = null;
    started = false;
  };
  // METING #804 (optie `stop-worker-na`): de worker na een opslag stoppen, zonder lopend verzoek.
  (globalThis as { __opsMeting804StopWorker?: () => boolean }).__opsMeting804StopWorker = () => {
    if (!worker || abortActive) return false;
    stopWorker();
    return true;
  };
  const disposedError = () => new IfcSaveWorkerError('disposed', 'De opslagworker is gestopt.');

  const ask = (port: IfcSaveWorkerPort, job: IfcSaveJob, stop?: AbortSignal): Promise<IfcSaveResult> => {
    const id = ++nextId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onStop: (() => void) | undefined;
    return new Promise<IfcSaveResult>((resolve, reject) => {
      // #804 stap 8: Automatisch opslaan wijkt. Deze worker stopt (het rekenen valt niet anders af te breken); het volgende
      // verzoek start een nieuwe. Geen fout van de worker, dus de client blijft bruikbaar.
      onStop = () => {
        if (worker === port) stopWorker();
        reject(stop!.reason);
      };
      stop?.addEventListener('abort', onStop, { once: true });
      const arm = () => {
        clearTimeout(timer);
        timer = started
          ? setTimeout(() => reject(new IfcSaveWorkerError('timeout', `De opslagworker antwoordde niet binnen ${timeoutMs(job)} ms.`)), timeoutMs(job))
          : setTimeout(() => reject(new IfcSaveWorkerNotStarted('De opslagworker startte niet op tijd.')), startTimeoutMs);
      };
      abortActive = reject;
      port.onmessage = ({ data }: MessageEvent<IfcSaveResponse>) => {
        if ('started' in data) {
          if (!started) { started = true; arm(); }
          return;
        }
        if (data.id !== id) return;
        meting804('antwoord van de worker ontvangen'); // METING
        // Het juiste nummer, maar een antwoord dat niet bij dit verzoek past: transport, nooit een uitkomst.
        if ('error' in data && wireErrorFits(data.error)) reject(errorFromWire(data.error));
        else if ('result' in data && resultFits(job, data.result)) resolve(data.result);
        else reject(new IfcSaveWorkerError('transport', 'De opslagworker gaf een antwoord dat niet bij het verzoek past.'));
      };
      port.onerror = (event) => {
        event.preventDefault();
        reject(started ? new IfcSaveWorkerError('crashed', event.message || 'De opslagworker stierf tijdens het rekenen.')
          : new IfcSaveWorkerNotStarted(event.message || 'De opslagworker startte niet.'));
      };
      port.onmessageerror = () => reject(new IfcSaveWorkerError('transport', 'De opslagworker gaf een onleesbaar antwoord.'));
      arm();
      try {
        // Een kopie, nooit een overdracht: de hoofdthread blijft eigenaar van de bronbytes.
        meting804(`verzoek naar de worker (${job.kind}) begin`); // METING
        port.postMessage({ id, job } satisfies IfcSaveRequest);
        meting804('verzoek naar de worker verstuurd'); // METING
      } catch (error) {
        reject(new IfcSaveWorkerError('transport', `Het opslagverzoek kon niet naar de worker: ${error instanceof Error ? error.message : String(error)}`));
      }
    }).finally(() => {
      clearTimeout(timer);
      if (onStop) stop?.removeEventListener('abort', onStop);
      abortActive = null;
      port.onmessage = null;
      port.onerror = null;
      port.onmessageerror = null;
    });
  };

  const compute: IfcOutputCompute = (job, stop) => {
    const run = tail.then(async () => {
      if (disposed) throw disposedError();
      // Week de ronde al terwijl ze op haar beurt in de worker wachtte, dan rekent ze niet.
      if (stop?.aborted) throw stop.reason;
      if (!worker && !unavailable) {
        try { worker = createWorker(); } catch { worker = null; }
        started = false;
        if (!worker) unavailable = true;
      }
      if (!worker) return computeIfcOutputHere(job);
      const port = worker;
      try {
        return outputFromResult(job, await ask(port, job, stop));
      } catch (error) {
        if (stop?.aborted) throw error;
        if (error instanceof IfcSaveWorkerNotStarted) {
          if (worker === port) stopWorker();
          if (disposed) throw disposedError();
          unavailable = true;
          return computeIfcOutputHere(job);
        }
        // Gestorven, verlopen of onleesbaar: deze worker niet meer gebruiken, en niet opnieuw rekenen.
        if (error instanceof IfcSaveWorkerError && worker === port) stopWorker();
        throw error;
      }
    });
    tail = run.catch(() => undefined);
    return run;
  };

  return {
    compute,
    dispose: () => {
      disposed = true;
      const abort = abortActive;
      stopWorker();
      abort?.(disposedError());
    },
  };
}
