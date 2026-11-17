/**
 * Scanner en indeling in een Worker, met een synchrone terugval (#804 fase 1a, §4.13). Zelfde patroon als de
 * crashherstel-serialisatie (`recoverySnapshotSerializer.ts`): zonder Worker (Node, de headless kern, een webview zonder
 * module-Workers) of bij een fout van het transport (start, CSP, clone, geen start, geen antwoord) rekent de hoofdthread
 * zelf, met precies dezelfde functies. Een fout in de indeling zelf blijft een fout: de terugval zou hem alleen herhalen.
 *
 * Eén Worker per scan (het openen, de doelscan): zo houdt geen Worker geheugen vast na afloop. Binnen die scan gaan de
 * verzoeken één voor één (`withScanWorker`): het openen stuurt één verzoek, de doelscan eerst de stukken van zijn
 * modelscan en dan de bytes voor de indeling (knownbug 1758). De Worker krijgt kopieën (`postMessage` zonder
 * overdracht); de aanroeper blijft eigenaar (§4.8).
 *
 * Starten (fixronde 1 van #985): de Worker meldt één keer `started` zodra zijn script draait en het eerste verzoek binnen
 * is. Tot dan wacht de runner hoogstens `FOREIGN_SCAN_START_TIMEOUT_MS`, daarna per verzoek de ruime rekentijd
 * (`timeoutMs`). Na een terugval is de Worker gestopt en zijn de luisteraars weg: een laat bericht doet niets.
 */
import { scanForeign, type ForeignScanOutcome } from './foreignScan';
import type { ForeignScanWorkerRequest, ForeignScanWorkerResponse } from './foreignScanHandler';
import type { TargetScanStep } from './targetModelScan';

export type ForeignScanWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;

export interface ForeignScanRunOptions {
  /** Injecteerbaar voor tests. Standaard een module-Worker, of `null` als er geen `Worker` is. */
  createWorker?: () => ForeignScanWorker | null;
  /** Zonder startbevestiging binnen deze tijd: synchrone terugval. Standaard `FOREIGN_SCAN_START_TIMEOUT_MS`. */
  startTimeoutMs?: number;
  /** Na de startbevestiging, zonder antwoord op een verzoek binnen deze tijd: synchrone terugval. Standaard 120 s (300 MB
   *  kost in de meting ongeveer 6 s). */
  timeoutMs?: number;
}

/**
 * De gekozen grens voor starten: wie later start, krijgt de terugval, en die is nooit fout, alleen trager. Een gemeten
 * bovengrens voor een gezonde start in de webview is het niet (knownbug 1759).
 */
export const FOREIGN_SCAN_START_TIMEOUT_MS = 3_000;

/** Een fout uit de scan in de Worker: inhoudelijk, dus geen terugval. De doelscan rekent hem wel opnieuw
 *  (`targetForeignScan.ts`), zodat zijn uitkomst altijd die van de synchrone weg is. */
export class ForeignScanFailure extends Error {}

/** Het transport faalt (start, CSP, clone, geen start, geen antwoord): de aanroeper rekent zelf. */
class ScanWorkerUnavailable extends Error {}

/** De verzoeken van één scan aan zijn Worker, één voor één. */
export interface ForeignScanSession {
  /** Scan en indeling van `bytes` (een kopie). */
  outcome(bytes: Uint8Array): Promise<ForeignScanOutcome>;
  /** Het volgende stuk (een kopie) voor de modelscan van de doelscan, `null` aan het einde. */
  step(chunk: Uint8Array | null): Promise<TargetScanStep>;
}

function defaultCreateWorker(): ForeignScanWorker | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./foreignScan.worker.ts', import.meta.url), { type: 'module' });
}

type Body<T> = T extends unknown ? Omit<T, 'id'> : never;

/**
 * `work` met één Worker; zonder Worker of bij een fout van het transport `fallback` (na het stoppen van de Worker). Een
 * `ForeignScanFailure` en elke andere fout van `work` (bijvoorbeeld een leesfout) gaan door naar de aanroeper.
 */
export async function withScanWorker<T>(
  opts: ForeignScanRunOptions,
  work: (session: ForeignScanSession) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  let worker: ForeignScanWorker | null = null;
  try {
    worker = (opts.createWorker ?? defaultCreateWorker)();
  } catch {
    worker = null;
  }
  if (!worker) return fallback();
  const active = worker;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let started = false;
  let lastId = 0;
  let pending: { id: number; resolve: (r: ForeignScanWorkerResponse) => void; reject: (e: Error) => void } | null = null;
  let broken: Error | null = null;
  const fail = (error: Error) => {
    broken ??= error;
    clearTimeout(timeout);
    pending?.reject(broken);
    pending = null;
  };
  const arm = () => {
    clearTimeout(timeout);
    timeout = started
      ? setTimeout(() => fail(new ScanWorkerUnavailable('De scanner-Worker antwoordde niet op tijd.')), opts.timeoutMs ?? 120_000)
      : setTimeout(() => fail(new ScanWorkerUnavailable('De scanner-Worker startte niet op tijd.')),
        opts.startTimeoutMs ?? FOREIGN_SCAN_START_TIMEOUT_MS);
  };
  active.onmessage = ({ data }: MessageEvent<ForeignScanWorkerResponse>) => {
    if ('started' in data) {
      if (started) return;
      started = true;
      if (pending) arm();
      return;
    }
    if (!pending || data.id !== pending.id) return;
    const { resolve, reject } = pending;
    pending = null;
    clearTimeout(timeout);
    if ('error' in data) reject(new ForeignScanFailure(data.error));
    else resolve(data);
  };
  active.onerror = (event) => { event.preventDefault(); fail(new ScanWorkerUnavailable(event.message)); };
  active.onmessageerror = () => fail(new ScanWorkerUnavailable('De scanner-Worker kon het antwoord niet lezen.'));
  const ask = (request: Body<ForeignScanWorkerRequest>): Promise<ForeignScanWorkerResponse> => {
    if (broken) return Promise.reject(broken);
    return new Promise((resolve, reject) => {
      pending = { id: ++lastId, resolve, reject };
      arm();
      try {
        active.postMessage({ id: lastId, ...request } as ForeignScanWorkerRequest);
      } catch (error) {
        fail(new ScanWorkerUnavailable(error instanceof Error ? error.message : String(error)));
      }
    });
  };
  const unexpected = () => new ScanWorkerUnavailable('De scanner-Worker gaf een onverwacht antwoord.');
  const session: ForeignScanSession = {
    outcome: async (bytes) => {
      const r = await ask({ bytes });
      if (!('outcome' in r)) throw unexpected();
      return r.outcome;
    },
    step: async (chunk) => {
      const r = await ask({ push: chunk });
      if (!('step' in r)) throw unexpected();
      return r.step;
    },
  };
  try {
    return await work(session);
  } catch (error) {
    if (!(error instanceof ScanWorkerUnavailable)) throw error;
  } finally {
    clearTimeout(timeout);
    active.onmessage = null;
    active.onerror = null;
    active.onmessageerror = null;
    active.terminate();
  }
  return fallback();
}

export function runForeignScan(bytes: Uint8Array, opts: ForeignScanRunOptions = {}): Promise<ForeignScanOutcome> {
  return withScanWorker(opts, session => session.outcome(bytes), () => scanForeign(bytes));
}
