import type { FileRef } from '@/services/fileAccess';
import type { IFCSaveSource } from '@/state/ifcSaveInput';
import type { KnownTargetState } from '@/state/knownTargetGuard';

export class AutoSaveTargetUnavailableError extends Error {
  constructor() {
    super('The existing project file is not writable.');
    this.name = 'AutoSaveTargetUnavailableError';
  }
}

export const ACTUAL_AUTOSAVE_INTERVAL_MS = 10_000;

export function actualAutoSaveDelay(lastRunAt: number, now: number): number {
  return Math.max(0, ACTUAL_AUTOSAVE_INTERVAL_MS - (now - lastRunAt));
}

export interface ActualAutoSaveCandidate {
  id: string;
  content: number;
  enabled: boolean;
  dirty: boolean;
  ref: FileRef | null;
  source: IFCSaveSource;
  start?: KnownTargetState;
}

export type ActualAutoSaveWrite = boolean | 'stale' | 'refused' | 'yielded';

export interface ActualAutoSaveController {
  flush: () => Promise<void>;
  isSaving: () => boolean;
}

export function createActualAutoSaveController(deps: {
  listCandidates: () => ActualAutoSaveCandidate[];
  canWrite: (ref: FileRef) => Promise<boolean>;
  write: (candidate: ActualAutoSaveCandidate) => Promise<ActualAutoSaveWrite>;
  onFailure: (candidate: ActualAutoSaveCandidate, error: unknown) => void;
}): ActualAutoSaveController {
  let saving = false;
  let pending = false;
  let current: Promise<void> | null = null;

  const run = async () => {
    let staleRounds = 0;
    do {
      pending = false;
      for (const candidate of deps.listCandidates()) {
        if (!candidate.enabled || !candidate.dirty || !candidate.ref) continue;
        try {
          if (!await deps.canWrite(candidate.ref)) continue;
          const written = await deps.write(candidate);
          if (written === 'refused' || written === 'yielded') {
            continue;
          }
          if (written === 'stale') {
            if (staleRounds++ < 3) pending = true;
          } else if (!written) {
            deps.onFailure(candidate, new AutoSaveTargetUnavailableError());
          }
        } catch (error) {
          deps.onFailure(candidate, error);
        }
      }
    } while (pending);
  };

  return {
    flush: async () => {
      if (current) {
        pending = true;
        await current;
        return;
      }
      saving = true;
      current = run();
      try {
        await current;
      } finally {
        current = null;
        saving = false;
      }
    },
    isSaving: () => saving,
  };
}
