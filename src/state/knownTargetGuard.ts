import { knownTargetContent, type FileRef } from '@/services/fileAccess';
import type { TargetReaders } from '@/services/fileAccess/foreignSourceTarget';
import type { SourceTargetContent } from '@/services/fileAccess/sourceTargetContent';
import { scanForeignTargetBytesAsync, type TargetForeignScan } from '@/services/ifc/foreign/targetForeignScan';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import type { TargetFingerprint } from './documentContract';

type FeatureFlags = Parameters<typeof ifcForeignContentEnabled>[0];
type KnownTargetChange = Extract<SourceTargetContent, 'changed' | 'unreadable'>;
export interface KnownTargetState {
  readonly featureFlags: FeatureFlags;
  readonly known: TargetFingerprint | null;
}

export interface KnownTargetCheck {
  readonly change: KnownTargetChange | null;
  readonly readers: () => TargetReaders;
}

export function guardedKnownTarget(state: KnownTargetState, ref: FileRef): TargetFingerprint | null {
  return ifcForeignContentEnabled(state.featureFlags) && state.known !== null && ref.kind !== 'site' ? state.known : null;
}

export async function checkKnownTarget(
  current: () => KnownTargetState, known: TargetFingerprint, ref: FileRef, readers: () => TargetReaders,
): Promise<KnownTargetCheck> {
  if (ref.kind === 'site') return { change: null, readers };
  const read = await knownTargetContent(ref, known);
  const stillKnown = guardedKnownTarget(current(), ref) === known;
  if (read.content === 'same') {
    return { change: null, readers: readersOfReadContent(read.bytes, stillKnown && known.origin === 'written', readers) };
  }
  const change = read.content === 'changed' || read.content === 'unreadable' ? read.content : null;
  return { change: stillKnown ? change : null, readers };
}

function readersOfReadContent(bytes: Uint8Array, writtenByThisTab: boolean, readers: () => TargetReaders): () => TargetReaders {
  let scan: Promise<TargetForeignScan> | undefined;
  const scanned = () => (scan ??= writtenByThisTab ? Promise.resolve<TargetForeignScan>('no-model') : scanForeignTargetBytesAsync(bytes));
  return () => ({ ...readers(), scanPath: scanned, scanHandle: scanned });
}
