import { foreignScanTransferables, scanForeign, scanForeignToOpen, type ForeignScanOutcome } from './foreignScan';
import { targetScanPush, type TargetScanStep } from './targetModelScan';

export type ForeignScanWorkerRequest = { id: number } & ({ bytes: Uint8Array; open?: true } | { push: Uint8Array | null });
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
        push ??= targetScanPush();
        post({ id: request.id, step: push(request.push) }, []);
      } else {
        const outcome = request.open ? scanForeignToOpen(request.bytes) : scanForeign(request.bytes);
        post({ id: request.id, outcome }, foreignScanTransferables(outcome));
      }
    } catch (error) {
      post({ id: request.id, error: error instanceof Error ? error.message : String(error) }, []);
    }
  };
}
