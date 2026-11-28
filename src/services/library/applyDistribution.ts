import type { TaskSplitGap } from '@/types/task';
import type { DistributionProposal } from './distribute';

export interface DistributionWrite {
  docId: string;
  scopeTaskIds: string[];
  write: {
    delays: Record<string, number>;
    gaps: Record<string, TaskSplitGap[]>;
    delayMinutes?: Record<string, number>;
  };
}

export type DistributionWritePlan =
  | { ok: true; writes: DistributionWrite[] }
  | { ok: false; reason: 'blocked' | 'shortfall' | 'nothing-to-write' };

export interface DistributionApplyRecord {
  libraryItemId: string;
  appliedAt: string;
  docs: Array<{
    docId: string;
    title: string;
    historyEventId: string;
    historySequence: number;
  }>;
}

export type DistributionApplyResult =
  | { ok: true; record: DistributionApplyRecord }
  | {
      ok: false;
      reason: 'blocked' | 'shortfall' | 'nothing-to-write' | 'scratch-failed';
      docId?: string;
      error?: string;
    };

export interface DistributionUndoReport {
  undoneDocIds: string[];
  skippedDocIds: string[];
}

export function planDistributionWrites(
  proposal: DistributionProposal,
  scopeTaskIdsByDoc: Record<string, string[]>,
): DistributionWritePlan {
  if (proposal.blocked !== null) return { ok: false, reason: 'blocked' };
  if (proposal.hasShortfall) return { ok: false, reason: 'shortfall' };

  const writes: DistributionWrite[] = [];
  for (const doc of proposal.docs) {
    if (!doc.participated || doc.cannotMove) continue;
    writes.push({
      docId: doc.docId,
      scopeTaskIds: scopeTaskIdsByDoc[doc.docId] ?? [],
      write: { delays: doc.delays, gaps: doc.gaps, ...(doc.delayMinutes ? { delayMinutes: doc.delayMinutes } : {}) },
    });
  }
  if (writes.length === 0) return { ok: false, reason: 'nothing-to-write' };
  return { ok: true, writes };
}
