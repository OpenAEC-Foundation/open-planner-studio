export type SourceTargetContent = 'same' | 'changed' | 'missing' | 'unreadable';

export const TARGET_CHUNK_BYTES = 1 << 20;

export async function compareTargetChunks(
  next: () => Promise<Uint8Array | null>, expected: Uint8Array,
): Promise<'same' | 'changed'> {
  let offset = 0;
  for (let chunk = await next(); chunk !== null; chunk = await next()) {
    if (offset + chunk.length > expected.length) return 'changed';
    for (let i = 0; i < chunk.length; i++) if (chunk[i] !== expected[offset + i]) return 'changed';
    offset += chunk.length;
  }
  return offset === expected.length ? 'same' : 'changed';
}

export async function sourceTargetContentOfHandle(
  handle: FileSystemFileHandle, expected: Uint8Array,
): Promise<SourceTargetContent> {
  let file: File;
  try {
    file = await handle.getFile();
  } catch (error) {
    return (error as { name?: unknown } | null)?.name === 'NotFoundError' ? 'missing' : 'unreadable';
  }
  if (file.size !== expected.length) return 'changed';
  let offset = 0;
  try {
    return await compareTargetChunks(async () => {
      if (offset >= file.size) return null;
      const end = Math.min(offset + TARGET_CHUNK_BYTES, file.size);
      const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      if (chunk.length === 0) return null;
      offset += chunk.length;
      return chunk;
    }, expected);
  } catch {
    return 'unreadable';
  }
}
