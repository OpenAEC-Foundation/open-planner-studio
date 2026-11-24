import { precomputeSha256 } from '@/services/xerSourceArchive';
import type { TargetFingerprint } from '@/state/documentContract';
import type { SourceTargetContent } from './sourceTargetContent';

export interface KnownTargetReader {
  size(): Promise<number>;
  bytes(): Promise<Uint8Array>;
  missing(error: unknown): boolean;
}

export type KnownTargetRead =
  | { readonly content: 'same'; readonly bytes: Uint8Array }
  | { readonly content: Exclude<SourceTargetContent, 'same'> };

const CHANGED: KnownTargetRead = { content: 'changed' };

export async function compareKnownTarget(reader: KnownTargetReader, known: TargetFingerprint): Promise<KnownTargetRead> {
  const failed = (error: unknown): KnownTargetRead => ({ content: reader.missing(error) ? 'missing' : 'unreadable' });
  let size: number;
  try { size = await reader.size(); } catch (error) { return failed(error); }
  if (size !== known.byteLength) return CHANGED;
  let bytes: Uint8Array;
  try { bytes = await reader.bytes(); } catch (error) { return failed(error); }
  if (bytes.byteLength !== known.byteLength) return CHANGED;
  return (await precomputeSha256(bytes)) === known.sha256 ? { content: 'same', bytes } : CHANGED;
}

export function knownTargetContentOfHandle(handle: FileSystemFileHandle, known: TargetFingerprint): Promise<KnownTargetRead> {
  let file: Promise<File> | undefined;
  const opened = () => (file ??= handle.getFile());
  return compareKnownTarget({
    size: async () => (await opened()).size,
    bytes: async () => new Uint8Array(await (await opened()).arrayBuffer()),
    missing: error => (error as { name?: unknown } | null)?.name === 'NotFoundError',
  }, known);
}
