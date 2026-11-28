import { isProjectFileWriteBusy } from '@/services/fileAccess/writeCoordinator';
import { flushRecoveryNow } from './recoveryFlush';

interface PendingSource {
  readonly sha256: string;
  recorded: boolean;
}

const pending = new Map<string, PendingSource>();

export function pendingIfcSourceSha256(documentId: string): string | undefined {
  return pending.get(documentId)?.sha256;
}

export function hasPendingIfcSource(): boolean {
  return pending.size > 0;
}

export function confirmRecordedPending(recorded: (documentId: string) => string | undefined): void {
  for (const [id, entry] of pending) entry.recorded = recorded(id) === entry.sha256;
}

export type RecoveryPendingOutcome = 'replaced' | 'not-replaced' | 'not-recorded';

export async function replaceWithRecoveryPending(
  documentId: string,
  nextSha256: string,
  steps: { replace: () => Promise<boolean>; commit: () => void },
): Promise<RecoveryPendingOutcome> {
  if (!isProjectFileWriteBusy()) throw new Error('replaceWithRecoveryPending hoort binnen runProjectFileWrite.');
  if (pending.has(documentId)) throw new Error('Er loopt al een vervanging voor dit document.');
  pending.set(documentId, { sha256: nextSha256, recorded: false });
  try {
    try { await flushRecoveryNow(); } catch { }
    if (!pending.get(documentId)?.recorded) return 'not-recorded';
    if (!(await steps.replace())) return 'not-replaced';
    steps.commit();
    return 'replaced';
  } finally {
    pending.delete(documentId);
    await flushRecoveryNow().catch(() => { });
  }
}
