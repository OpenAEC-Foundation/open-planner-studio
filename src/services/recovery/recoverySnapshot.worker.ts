import { serializeRecoveryInput, type RecoverySnapshotInput } from './recoverySnapshotInput';

export type RecoveryWorkerRequest = { id: number; snapshot: RecoverySnapshotInput };
export type RecoveryWorkerResponse = { id: number } & ({ ifc: string } | { error: string });

// Geen store, DOM, bestandstoegang of Tauri in deze worker.
self.onmessage = ({ data }: MessageEvent<RecoveryWorkerRequest>) => {
  let response: RecoveryWorkerResponse;
  try {
    response = { id: data.id, ifc: serializeRecoveryInput(data.snapshot) };
  } catch (error) {
    response = { id: data.id, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};
