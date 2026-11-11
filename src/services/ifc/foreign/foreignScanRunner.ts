/**
 * Scanner en indeling in een Worker, met een synchrone terugval (#804 fase 1a, §4.13). Zelfde patroon als de
 * crashherstel-serialisatie (`recoverySnapshotSerializer.ts`): zonder Worker (Node, de headless kern, een webview zonder
 * module-Workers) of bij een fout van het transport (start, CSP, clone, geen antwoord) rekent de hoofdthread zelf, met
 * precies dezelfde functie. Een fout in de indeling zelf blijft een fout: de terugval zou hem alleen herhalen.
 *
 * Eén Worker per open-actie: openen is zeldzaam, en zo houdt geen Worker geheugen vast na het openen. De Worker krijgt
 * een kopie van de bytes (`postMessage` zonder overdracht); de aanroeper blijft eigenaar (§4.8).
 */
import { scanForeign, type ForeignScanOutcome } from './foreignScan';
import type { ForeignScanWorkerRequest, ForeignScanWorkerResponse } from './foreignScan.worker';

export type ForeignScanWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;

export interface ForeignScanRunOptions {
  /** Injecteerbaar voor tests. Standaard een module-Worker, of `null` als er geen `Worker` is. */
  createWorker?: () => ForeignScanWorker | null;
  /** Zonder antwoord binnen deze tijd: synchrone terugval. Standaard 120 s (300 MB kost in de meting ongeveer 6 s). */
  timeoutMs?: number;
}

/** Een fout uit `scanForeign` in de Worker: inhoudelijk, dus geen terugval. */
class ForeignScanFailure extends Error {}

function defaultCreateWorker(): ForeignScanWorker | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./foreignScan.worker.ts', import.meta.url), { type: 'module' });
}

export async function runForeignScan(bytes: Uint8Array, opts: ForeignScanRunOptions = {}): Promise<ForeignScanOutcome> {
  let worker: ForeignScanWorker | null = null;
  try {
    worker = (opts.createWorker ?? defaultCreateWorker)();
  } catch {
    worker = null;
  }
  if (!worker) return scanForeign(bytes);
  const active = worker;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<ForeignScanOutcome>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('De scanner-Worker antwoordde niet op tijd.')), opts.timeoutMs ?? 120_000);
      active.onmessage = ({ data }: MessageEvent<ForeignScanWorkerResponse>) => {
        if (data.id !== 1) return;
        if ('error' in data) reject(new ForeignScanFailure(data.error));
        else resolve(data.outcome);
      };
      active.onerror = (event) => { event.preventDefault(); reject(new Error(event.message)); };
      active.onmessageerror = () => reject(new Error('De scanner-Worker kon het antwoord niet lezen.'));
      active.postMessage({ id: 1, bytes } satisfies ForeignScanWorkerRequest);
    });
  } catch (error) {
    if (error instanceof ForeignScanFailure) throw error;
    return scanForeign(bytes);
  } finally {
    clearTimeout(timeout);
    active.onmessage = null;
    active.onerror = null;
    active.onmessageerror = null;
    active.terminate();
  }
}
