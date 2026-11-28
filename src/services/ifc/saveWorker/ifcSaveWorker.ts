import { computeIfcOutputHere, type IfcOutputCompute, type IfcSaveJob } from '@/state/prepareIfcOutput';
import type { IfcxClassification } from '@/services/ifc/ifcx';
import {
  classificationFits, errorFromWire, outputFromResult, resultFits, wireErrorFits, type IfcSaveRequestBody,
  type IfcSaveResponse, type IfcSaveWorkerRequest,
} from './ifcSaveProtocol';
import { IfcSaveWorkerError } from './ifcSaveWorkerError';

export type IfcSaveWorkerPort = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;

export const IFC_SAVE_START_TIMEOUT_MS = 10_000;
const IFCX_CLASSIFY_TIMEOUT_MS = 60_000;

export function ifcSaveTimeoutMs(job: IfcSaveJob): number {
  const mib = job.kind === 'merge' ? Math.ceil(job.source.bytes.byteLength / 2 ** 20) : 0;
  return 60_000 + mib * 1_000;
}

class IfcSaveWorkerNotStarted extends Error {}

export interface IfcSaveWorkerOptions {
  createWorker?: () => IfcSaveWorkerPort | null;
  startTimeoutMs?: number;
  timeoutMs?: (job: IfcSaveJob) => number;
}

export interface IfcSaveWorker {
  readonly compute: IfcOutputCompute;
  readonly classifyIfcx: (bytes: Uint8Array) => Promise<IfcxClassification>;
  dispose(): void;
}

export function defaultCreateIfcSaveWorker(): IfcSaveWorkerPort | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./ifcSave.worker.ts', import.meta.url), { type: 'module' });
}

export function createIfcSaveWorker(opts: IfcSaveWorkerOptions = {}): IfcSaveWorker {
  const createWorker = opts.createWorker ?? defaultCreateIfcSaveWorker;
  const startTimeoutMs = opts.startTimeoutMs ?? IFC_SAVE_START_TIMEOUT_MS;
  const timeoutMs = opts.timeoutMs ?? ifcSaveTimeoutMs;
  let worker: IfcSaveWorkerPort | null = null;
  let started = false;
  let startedOnce = false;
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
  const disposedError = () => new IfcSaveWorkerError('disposed', 'De opslagworker is gestopt.');
  const notStartedError = (message: string) => new IfcSaveWorkerError('not-started', message);

  const ask = <T,>(
    port: IfcSaveWorkerPort, body: IfcSaveRequestBody, fits: (data: IfcSaveResponse) => T | undefined, limitMs: number, stop?: AbortSignal,
  ): Promise<T> => {
    const id = ++nextId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onStop: (() => void) | undefined;
    return new Promise<T>((resolve, reject) => {
      onStop = () => {
        if (worker === port) stopWorker();
        reject(stop!.reason);
      };
      stop?.addEventListener('abort', onStop, { once: true });
      const arm = () => {
        clearTimeout(timer);
        timer = started
          ? setTimeout(() => reject(new IfcSaveWorkerError('timeout', `De opslagworker antwoordde niet binnen ${limitMs} ms.`)), limitMs)
          : setTimeout(() => reject(new IfcSaveWorkerNotStarted('De opslagworker startte niet op tijd.')), startTimeoutMs);
      };
      abortActive = reject;
      port.onmessage = ({ data }: MessageEvent<IfcSaveResponse>) => {
        if ('started' in data) {
          if (!started) { started = true; startedOnce = true; arm(); }
          return;
        }
        if (data.id !== id) return;
        const value = 'error' in data ? undefined : fits(data);
        if ('error' in data && wireErrorFits(data.error)) reject(errorFromWire(data.error));
        else if (value !== undefined) resolve(value);
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
        port.postMessage({ id, ...body } satisfies IfcSaveWorkerRequest);
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
      if (stop?.aborted) throw stop.reason;
      const workerOnly = (job.kind === 'merge' && startedOnce) || (job.kind === 'writer' && job.format === 'ifcx');
      if (!worker && (!unavailable || workerOnly)) {
        try { worker = createWorker(); } catch { worker = null; }
        started = false;
        if (!worker) {
          if (workerOnly) throw notStartedError('De opslagworker kon niet worden aangemaakt.');
          unavailable = true;
        }
      }
      if (!worker) return computeIfcOutputHere(job);
      const port = worker;
      try {
        const fits = (data: IfcSaveResponse) => 'result' in data && resultFits(job, data.result) ? data.result : undefined;
        return outputFromResult(job, await ask(port, { job }, fits, timeoutMs(job), stop));
      } catch (error) {
        if (stop?.aborted) throw error;
        if (error instanceof IfcSaveWorkerNotStarted) {
          if (worker === port) stopWorker();
          if (disposed) throw disposedError();
          if (workerOnly) throw notStartedError(error.message);
          unavailable = true;
          return computeIfcOutputHere(job);
        }
        if (error instanceof IfcSaveWorkerError && worker === port) stopWorker();
        throw error;
      } finally {
        if (job.kind === 'merge' && worker === port) stopWorker();
      }
    });
    tail = run.catch(() => undefined);
    return run;
  };

  const classifyIfcx = (bytes: Uint8Array): Promise<IfcxClassification> => {
    const run = tail.then(async () => {
      if (disposed) throw disposedError();
      if (!worker) {
        try { worker = createWorker(); } catch { worker = null; }
        started = false;
        if (!worker) throw notStartedError('De opslagworker kon niet worden aangemaakt.');
      }
      const port = worker;
      const fits = (data: IfcSaveResponse) => 'classification' in data && classificationFits(data.classification) ? data.classification : undefined;
      try {
        return await ask(port, { classify: bytes }, fits, IFCX_CLASSIFY_TIMEOUT_MS);
      } catch (error) {
        if (worker === port && (error instanceof IfcSaveWorkerNotStarted || error instanceof IfcSaveWorkerError)) stopWorker();
        if (disposed) throw disposedError();
        throw error instanceof IfcSaveWorkerNotStarted ? notStartedError(error.message) : error;
      }
    });
    tail = run.catch(() => undefined);
    return run;
  };

  return {
    compute,
    classifyIfcx,
    dispose: () => {
      disposed = true;
      const abort = abortActive;
      stopWorker();
      abort?.(disposedError());
    },
  };
}
