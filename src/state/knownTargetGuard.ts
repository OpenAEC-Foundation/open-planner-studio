import { knownTargetContent, type FileRef } from '@/services/fileAccess';
import type { SourceTargetContent } from '@/services/fileAccess/sourceTargetContent';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { TargetFingerprint } from './documentContract';

type FeatureFlags = Parameters<typeof ifcForeignContentEnabled>[0];
export type KnownTargetChange = Extract<SourceTargetContent, 'changed' | 'unreadable'>;
export interface KnownTargetState {
  readonly featureFlags: FeatureFlags;
  readonly known: TargetFingerprint | null;
}

export function guardedKnownTarget(state: KnownTargetState, ref: FileRef): TargetFingerprint | null {
  return ifcForeignContentEnabled(state.featureFlags) && state.known !== null && ref.kind !== 'site' ? state.known : null;
}

export async function changedKnownTarget(
  current: () => KnownTargetState, known: TargetFingerprint, ref: FileRef,
): Promise<KnownTargetChange | null> {
  if (ref.kind === 'site') return null;
  const content = await knownTargetContent(ref, known);
  if (content !== 'changed' && content !== 'unreadable') return null;
  return guardedKnownTarget(current(), ref) === known ? content : null;
}
