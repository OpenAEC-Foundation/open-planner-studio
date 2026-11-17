// De handler van de scanworker (`foreignScan.worker.ts`), los van `self`: de proeven laten precies deze code als Worker
// antwoorden. Eén handler per Worker, en één Worker per scan: de modelscanner van de doelscan (knownbug 1758) leeft zo
// lang als die ene scan. Geen store, DOM, bestandstoegang of Tauri.
import { foreignScanTransferables, scanForeign, type ForeignScanOutcome } from './foreignScan';
import { targetScanPush, type TargetScanStep } from './targetModelScan';

/**
 * `bytes`: scan en indeling (het openen, en de indeling van de doelscan); de Worker krijgt een kopie. `push`: het
 * volgende stuk voor de modelscan van de doelscan, `null` aan het einde; het antwoord is de stap van de scanner (verder,
 * terugspoelen of de uitkomst), zodat de hoofdthread niet verder leest dan nodig.
 */
export type ForeignScanWorkerRequest = { id: number } & ({ bytes: Uint8Array } | { push: Uint8Array | null });
/** Eén keer `started` (het script draait en het eerste verzoek is binnen; fixronde 1 van #985), dan per verzoek één
 *  antwoord: de uitkomst, de stap of de fout. */
export type ForeignScanWorkerResponse = { id: number }
  & ({ started: true } | { outcome: ForeignScanOutcome } | { step: TargetScanStep } | { error: string });

export function createForeignScanHandler(
  post: (response: ForeignScanWorkerResponse, transfer: ArrayBuffer[]) => void,
): (request: ForeignScanWorkerRequest) => void {
  let started = false;
  let push: ((chunk: Uint8Array | null) => TargetScanStep) | undefined;
  return (request) => {
    if (!started) {
      started = true;
      post({ id: request.id, started: true }, []);
    }
    try {
      if ('push' in request) {
        // MUTATIE: de Worker slaat de modelcontrole over; aan het einde zegt hij altijd 'no-model'.
        push ??= targetScanPush();
        post({ id: request.id, step: request.push === null ? { result: 'no-model' } : null }, []);
      } else {
        const outcome = scanForeign(request.bytes);
        post({ id: request.id, outcome }, foreignScanTransferables(outcome));
      }
    } catch (error) {
      post({ id: request.id, error: error instanceof Error ? error.message : String(error) }, []);
    }
  };
}
