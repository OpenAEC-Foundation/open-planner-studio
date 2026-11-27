import type { ReadImportResult } from '@/services/importTypes';
import { precomputeSha256 } from '@/services/xerSourceArchive';

export async function openOwnIfcx(bytes: Uint8Array): Promise<ReadImportResult> {
  const { readIfcxForApp } = await import('./ifcx/appReader');
  const read = readIfcxForApp(bytes);
  return { ...read, ifcxRead: { sha256: await precomputeSha256(bytes), byteLength: bytes.byteLength } };
}
