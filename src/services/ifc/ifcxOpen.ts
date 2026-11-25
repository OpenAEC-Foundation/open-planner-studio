import type { ReadImportResult } from '@/services/importTypes';
import { precomputeSha256 } from '@/services/xerSourceArchive';

export async function openOwnIfcx(bytes: Uint8Array): Promise<ReadImportResult> {
  const { readIfcx } = await import('./ifcx');
  const read = readIfcx(bytes);
  return { ...read, ifcxRead: { sha256: await precomputeSha256(bytes), byteLength: bytes.byteLength } };
}
