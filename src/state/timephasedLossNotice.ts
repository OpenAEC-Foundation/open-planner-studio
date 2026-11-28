import type { NotifyInput } from './slices/types';
import { MPP_TIMEPHASED_HELP_ARTICLE_ID } from './helpArticles';

const notifiedDocIds = new Set<string>();

export function claimTimephasedLossNotice(docId: string): boolean {
  return claimOnce(notifiedDocIds, docId);
}

function claimOnce(registry: Set<string>, docId: string): boolean {
  if (registry.has(docId)) return false;
  registry.add(docId);
  return true;
}

function notifyOncePerDocument(
  claim: (docId: string) => boolean,
  notify: (n: NotifyInput) => void,
  docId: string,
  count: number,
  messageKey: NotifyInput['messageKey'],
  dedupeKey: string,
): void {
  if (count <= 0) return;
  if (!claim(docId)) return;
  notify({ severity: 'info', messageKey, params: { count }, dedupeKey, helpArticleId: MPP_TIMEPHASED_HELP_ARTICLE_ID });
}

export function __resetTimephasedLossNoticeForTests(): void {
  notifiedDocIds.clear();
  notifiedLevelingDelayDocIds.clear();
}

export function clearTimephasedLossNoticeForDoc(docId: string): void {
  notifiedDocIds.delete(docId);
  notifiedLevelingDelayDocIds.delete(docId);
}

export function notifyTimephasedLoss(
  notify: (n: NotifyInput) => void,
  docId: string,
  count: number,
): void {
  notifyOncePerDocument(
    claimTimephasedLossNotice, notify, docId, count,
    'notifications.mppTimephasedSteeringLost', `mpp-timephased-lost-${docId}`,
  );
}

const notifiedLevelingDelayDocIds = new Set<string>();

export function claimLevelingDelayRoundedNotice(docId: string): boolean {
  return claimOnce(notifiedLevelingDelayDocIds, docId);
}

export function notifyLevelingDelayRounded(
  notify: (n: NotifyInput) => void,
  docId: string,
  count: number,
): void {
  notifyOncePerDocument(
    claimLevelingDelayRoundedNotice, notify, docId, count,
    'notifications.levelingDelayRoundedToWorkdays', `leveling-delay-rounded-${docId}`,
  );
}

export interface TimephasedLossNoticeClaimSnapshot {
  readonly timephasedDocIds: ReadonlySet<string>;
  readonly levelingDelayDocIds: ReadonlySet<string>;
}

export function snapshotTimephasedLossNoticeClaims(): TimephasedLossNoticeClaimSnapshot {
  return {
    timephasedDocIds: new Set(notifiedDocIds),
    levelingDelayDocIds: new Set(notifiedLevelingDelayDocIds),
  };
}

export function restoreTimephasedLossNoticeClaims(snapshot: TimephasedLossNoticeClaimSnapshot): void {
  notifiedDocIds.clear();
  for (const docId of snapshot.timephasedDocIds) notifiedDocIds.add(docId);
  notifiedLevelingDelayDocIds.clear();
  for (const docId of snapshot.levelingDelayDocIds) notifiedLevelingDelayDocIds.add(docId);
}
