import { knownTargetContent, type FileRef } from '@/services/fileAccess';
import type { SourceTargetContent } from '@/services/fileAccess/sourceTargetContent';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { TargetFingerprint } from './documentContract';

type FeatureFlags = Parameters<typeof ifcForeignContentEnabled>[0];
export type KnownTargetChange = Extract<SourceTargetContent, 'changed' | 'unreadable'>;

export async function changedKnownTarget(
  featureFlags: FeatureFlags, known: TargetFingerprint | null, ref: FileRef,
): Promise<KnownTargetChange | null> {
  if (known === null || ref.kind === 'site' || !ifcForeignContentEnabled(featureFlags)) return null;
  const content = await knownTargetContent(ref, known);
  return content === 'changed' || content === 'unreadable' ? content : null;
}
