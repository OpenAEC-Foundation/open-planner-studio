import { IfcCalendarTimePrecisionError } from '@/services/ifc/ifcErrors';
import type { IFCSaveSource } from '@/state/ifcSaveInput';
import { recoverySnapshotInput, writeRecoverySnapshot, type RecoverySnapshot } from './recoverySnapshotInput';
import type { RecoveryWorkerRequest, RecoveryWorkerResponse } from './recoverySnapshot.worker';

export type RecoveryWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;

class RecoverySerializationError extends Error {}

export function createRecoverySnapshotSerializer(
  createWorker: () => RecoveryWorker | null = () => typeof Worker === 'undefined' ? null
    : new Worker(new URL('./recoverySnapshot.worker.ts', import.meta.url), { type: 'module' }),
) {
  let worker: RecoveryWorker | null = null;
  let unavailable = false;
  let disposed = false;
  let nextId = 0;
  let tail: Promise<unknown> = Promise.resolve();
  let rejectActive: ((error: Error) => void) | null = null;

  const serialize = (source: IFCSaveSource, identities = false): Promise<RecoverySnapshot> => {
    const snapshot = recoverySnapshotInput(source, identities);
    const run = tail.then(async () => {
      if (disposed) throw new Error('Crashherstel-serialisatie is gestopt.');
      if (!worker && !unavailable) {
        try { worker = createWorker(); } catch { unavailable = true; }
        if (!worker) unavailable = true;
      }
      if (!worker) return writeRecoverySnapshot(snapshot);
      const activeWorker = worker;
      const id = ++nextId;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        return await new Promise<RecoverySnapshot>((resolve, reject) => {
          rejectActive = reject;
          timeout = setTimeout(() => reject(new Error('Crashherstel-worker antwoordde niet binnen 60 seconden.')), 60_000);
          activeWorker.onmessage = ({ data }: MessageEvent<RecoveryWorkerResponse>) => {
            if (data.id !== id) return;
            if ('error' in data) reject(data.calendarTimeMinutes !== undefined
              ? new IfcCalendarTimePrecisionError(data.calendarTimeMinutes) : new RecoverySerializationError(data.error));
            else resolve(data.identities ? { ifc: data.ifc, identities: data.identities } : { ifc: data.ifc });
          };
          activeWorker.onerror = (event) => { event.preventDefault(); reject(new Error(event.message)); };
          activeWorker.onmessageerror = () => reject(new Error('Crashherstel-worker kon het antwoord niet lezen.'));
          activeWorker.postMessage({ id, snapshot } satisfies RecoveryWorkerRequest);
        });
      } catch (error) {
        if (error instanceof RecoverySerializationError || error instanceof IfcCalendarTimePrecisionError) throw error;
        activeWorker.terminate();
        worker = null;
        unavailable = true;
        if (disposed) throw error;
        return writeRecoverySnapshot(snapshot);
      } finally {
        clearTimeout(timeout);
        rejectActive = null;
        activeWorker.onmessage = null;
        activeWorker.onerror = null;
        activeWorker.onmessageerror = null;
      }
    });
    tail = run.catch(() => undefined);
    return run;
  };

  return {
    serialize,
    dispose: () => {
      disposed = true;
      worker?.terminate();
      worker = null;
      rejectActive?.(new Error('Crashherstel-serialisatie is gestopt.'));
    },
  };
}
