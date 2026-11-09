// Scanner en indeling buiten de hoofdthread (#804 fase 1a, §4.13: 300 MB kost ongeveer 6 s). De Worker krijgt een kopie
// van de bronbytes; de hoofdthread houdt het origineel (eigenaar, §4.8). Geen store, DOM, bestandstoegang of Tauri.
import { foreignScanTransferables, scanForeign, type ForeignScanOutcome } from './foreignScan';

export type ForeignScanWorkerRequest = { id: number; bytes: Uint8Array };
export type ForeignScanWorkerResponse = { id: number } & ({ outcome: ForeignScanOutcome } | { error: string });

self.onmessage = ({ data }: MessageEvent<ForeignScanWorkerRequest>) => {
  let response: ForeignScanWorkerResponse;
  let transfer: ArrayBuffer[] = [];
  try {
    const outcome = scanForeign(data.bytes);
    response = { id: data.id, outcome };
    transfer = foreignScanTransferables(outcome);
  } catch (error) {
    response = { id: data.id, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response, { transfer });
};
