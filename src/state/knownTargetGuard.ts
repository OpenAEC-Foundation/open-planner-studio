import { knownTargetContent, type FileRef } from '@/services/fileAccess';
import type { SourceTargetContent } from '@/services/fileAccess/sourceTargetContent';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { utf8BomLength } from '@/services/ifc/foreign/stepScanner';
import { scanForeignTargetBytesAsync } from '@/services/ifc/foreign/targetForeignScan';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { TargetFingerprint } from './documentContract';
import type { WriteTargetRefusal } from './ifcForeignGuard';

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

export function contentLeftToKnownTarget(identity: WriteTargetRefusal | null | 'check-content'): WriteTargetRefusal | null {
  return identity === 'check-content' ? null : identity;
}

export async function stillWrittenKnownTarget(written: TargetFingerprint, ref: FileRef): Promise<boolean> {
  return ref.kind !== 'site' && await knownTargetContent(ref, written) === 'same';
}

export async function openedOwnTargetWithBom(
  state: KnownTargetState, ref: FileRef, source: IfcSource | null | undefined,
): Promise<boolean> {
  const known = guardedKnownTarget(state, ref);
  if (known?.origin !== 'opened' || !known.utf8Bom || !source || ref.kind === 'site') return false;
  if (source.sha256 !== known.sha256 || source.bytes.byteLength !== known.byteLength) return false;
  if (await knownTargetContent(ref, known) !== 'same') return false;
  return await scanForeignTargetBytesAsync(source.bytes.subarray(utf8BomLength(source.bytes))) === 'no-model';
}

export async function changedKnownTarget(
  current: () => KnownTargetState, known: TargetFingerprint, ref: FileRef,
): Promise<KnownTargetChange | null> {
  if (ref.kind === 'site') return null;
  const content = await knownTargetContent(ref, known);
  if (content !== 'changed' && content !== 'unreadable') return null;
  return guardedKnownTarget(current(), ref) === known ? content : null;
}
