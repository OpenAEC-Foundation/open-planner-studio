import { knownTargetContent, type FileRef } from '@/services/fileAccess';
import type { TargetReaders } from '@/services/fileAccess/foreignSourceTarget';
import type { SourceTargetContent } from '@/services/fileAccess/sourceTargetContent';
import type { TargetForeignScan } from '@/services/ifc/foreign/targetForeignScan';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { TargetFingerprint } from './documentContract';

type FeatureFlags = Parameters<typeof ifcForeignContentEnabled>[0];
type KnownTargetChange = Extract<SourceTargetContent, 'changed' | 'unreadable'>;
export interface KnownTargetState {
  readonly featureFlags: FeatureFlags;
  readonly known: TargetFingerprint | null;
}

export function guardedKnownTarget(state: KnownTargetState, ref: FileRef): TargetFingerprint | null {
  return ifcForeignContentEnabled(state.featureFlags) && state.known !== null && ref.kind !== 'site' ? state.known : null;
}

export function writtenKnownTarget(state: KnownTargetState, ref: FileRef): TargetFingerprint | null {
  const known = guardedKnownTarget(state, ref);
  return known?.origin === 'written' ? known : null;
}

const leftToKnownTarget = async (): Promise<TargetForeignScan> => 'no-model';

export function scanLeftToKnownTarget(readers: () => TargetReaders): () => TargetReaders {
  return () => ({ ...readers(), scanPath: leftToKnownTarget, scanHandle: leftToKnownTarget });
}

export async function stillWrittenKnownTarget(written: TargetFingerprint, ref: FileRef): Promise<boolean> {
  return ref.kind !== 'site' && await knownTargetContent(ref, written) === 'same';
}

export async function changedKnownTarget(
  current: () => KnownTargetState, known: TargetFingerprint, ref: FileRef,
): Promise<KnownTargetChange | null> {
  if (ref.kind === 'site') return null;
  const content = await knownTargetContent(ref, known);
  if (content !== 'changed' && content !== 'unreadable') return null;
  return guardedKnownTarget(current(), ref) === known ? content : null;
}
