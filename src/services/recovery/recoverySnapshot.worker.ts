import { IfcCalendarTimePrecisionError } from '@/services/ifc/ifcErrors';
import { writeRecoverySnapshot, type RecoverySnapshot, type RecoverySnapshotInput } from './recoverySnapshotInput';

export type RecoveryWorkerRequest = { id: number; snapshot: RecoverySnapshotInput };
export type RecoveryWorkerResponse = { id: number } & (RecoverySnapshot | { error: string; calendarTimeMinutes?: number });

// Geen store, DOM, bestandstoegang of Tauri in deze worker.
self.onmessage = ({ data }: MessageEvent<RecoveryWorkerRequest>) => {
  let response: RecoveryWorkerResponse;
  try {
    response = { id: data.id, ...writeRecoverySnapshot(data.snapshot) };
  } catch (error) {
    response = { id: data.id, error: error instanceof Error ? error.message : String(error),
      ...(error instanceof IfcCalendarTimePrecisionError ? { calendarTimeMinutes: error.minutes } : {}),
    };
  }
  self.postMessage(response);
};
