/**
 * Scanner en indeling in een Worker, met een synchrone terugval (#804 fase 1a, §4.13). Zelfde patroon als de
 * crashherstel-serialisatie (`recoverySnapshotSerializer.ts`): zonder Worker (Node, de headless kern, een webview zonder
 * module-Workers) of bij een fout van het transport (start, CSP, clone, geen start, geen antwoord) rekent de hoofdthread
 * zelf, met precies dezelfde functie. Een fout in de indeling zelf blijft een fout: de terugval zou hem alleen herhalen.
 *
 * Het transport in twee stappen (fixronde 1 van #985): de Worker meldt eerst `started` zodra zijn script geladen is en
 * het verzoek (met de bytes) ontvangen heeft; daarop wacht de runner hoogstens `FOREIGN_SCAN_START_TIMEOUT_MS`. Pas na
 * die bevestiging geldt de ruime rekentijd (`timeoutMs`). Zo houdt een Worker die nooit start, de opslag (die de doelscan
 * onder het schrijfslot draait) geen twee minuten op, en haalt een grote, gezonde scan zich niet naar de hoofdthread.
 * Na een terugval is de Worker gestopt en zijn de luisteraars weg: een late start of een laat antwoord doet niets.
 *
 * Eén Worker per scan (openen en de doelscan): zo houdt geen Worker geheugen vast na afloop. De Worker krijgt een kopie
 * van de bytes (`postMessage` zonder overdracht); de aanroeper blijft eigenaar (§4.8).
 */
import { scanForeign, type ForeignScanOutcome } from './foreignScan';
import type { ForeignScanWorkerRequest, ForeignScanWorkerResponse } from './foreignScan.worker';

export type ForeignScanWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;

export interface ForeignScanRunOptions {
  /** Injecteerbaar voor tests. Standaard een module-Worker, of `null` als er geen `Worker` is. */
  createWorker?: () => ForeignScanWorker | null;
  /** Zonder startbevestiging binnen deze tijd: synchrone terugval. Standaard `FOREIGN_SCAN_START_TIMEOUT_MS`. */
  startTimeoutMs?: number;
  /** Na de startbevestiging, zonder antwoord binnen deze tijd: synchrone terugval. Standaard 120 s (300 MB kost in de
   *  meting ongeveer 6 s). */
  timeoutMs?: number;
}

/**
 * Hoe lang de runner wacht tot de Worker meldt dat hij draait. Een gezonde module-Worker laadt zijn eigen bundel uit de
 * app (geen netwerk) en ontvangt een kopie van de bytes (bij 300 MB naar verwachting enkele honderden ms); dat past
 * ruim in 3 s, ook op een trage machine. Wie later start, krijgt de terugval: die is nooit fout, alleen trager (de scan
 * op de hoofdthread, zoals vóór de Worker). Een Worker die nooit start, kost de opslag zo hoogstens 3 s extra in plaats
 * van de volle rekentijd. Een vaste grens, geen grens naar grootte: de kopie is het enige deel dat met de grootte
 * groeit, en dat blijft ver onder deze grens. Niet gemeten in een echte webview.
 */
export const FOREIGN_SCAN_START_TIMEOUT_MS = 3_000;

/** Een fout uit `scanForeign` in de Worker: inhoudelijk, dus geen terugval. De doelscan rekent hem wel opnieuw
 *  (`targetForeignScan.ts`), zodat zijn uitkomst altijd die van de synchrone weg is. */
export class ForeignScanFailure extends Error {}

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
      let started = false;
      // MUTATIE: niet op de startbevestiging wachten, alleen op de rekentijd.
      timeout = setTimeout(() => reject(new Error('De scanner-Worker startte niet op tijd.')),
        opts.timeoutMs ?? 120_000);
      active.onmessage = ({ data }: MessageEvent<ForeignScanWorkerResponse>) => {
        if (data.id !== 1) return;
        if ('started' in data) {
          if (started) return;
          started = true;
          clearTimeout(timeout);
          timeout = setTimeout(() => reject(new Error('De scanner-Worker antwoordde niet op tijd.')), opts.timeoutMs ?? 120_000);
        } else if ('error' in data) reject(new ForeignScanFailure(data.error));
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
