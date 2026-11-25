import { precomputeSha256 } from '@/services/xerSourceArchive';
import type { IfcxClassification } from './ifcx';

const KEPT = 32;
const ownDigests: string[] = [];

export async function rememberOwnIfcxBytes(bytes: Uint8Array): Promise<void> {
  rememberOwnIfcxDigest(await precomputeSha256(bytes));
}

export function rememberOwnIfcxDigest(sha256: string): void {
  const at = ownDigests.indexOf(sha256);
  if (at >= 0) ownDigests.splice(at, 1);
  ownDigests.push(sha256);
  if (ownDigests.length > KEPT) ownDigests.shift();
}

export async function classifyIfcxTarget(bytes: Uint8Array): Promise<IfcxClassification> {
  if (ownDigests.includes(await precomputeSha256(bytes))) return 'own';
  const { classifyIfcx } = await import('./ifcx');
  const classification = classifyIfcx(bytes);
  if (classification === 'own') await rememberOwnIfcxBytes(bytes);
  return classification;
}

export async function openOwnIfcx(bytes: Uint8Array) {
  const { readIfcx } = await import('./ifcx');
  const read = readIfcx(bytes);
  await rememberOwnIfcxBytes(bytes);
  return read;
}
