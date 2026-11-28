import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import type { ForeignSourceMark } from '@/services/ifc/foreign/foreignSourceMark';
import { scanForeignTargetBlob, scanForeignTargetBytesAsync, type OwnBomVersion, type TargetForeignScan } from '@/services/ifc/foreign/targetForeignScan';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { compareFilePaths, type FileIdentityFs } from './fileIdentity';
import type { IfcxClassification } from '@/services/ifc/ifcx';
import type { FileRef } from './index';

export interface ForeignSourceTargetDeps {
  identityFs?: FileIdentityFs;
}

export function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  const na = normalizeExternalSourcePath(a);
  return na !== null && na === normalizeExternalSourcePath(b);
}

export async function sameEntry(a: FileSystemFileHandle, b: FileSystemFileHandle): Promise<boolean> {
  try {
    return await a.isSameEntry(b);
  } catch {
    return false;
  }
}

function targetContent(handle: FileSystemFileHandle): (mark: ForeignSourceMark) => Promise<boolean> {
  let file: Promise<File | null> | undefined;
  let digest: Promise<string | null> | undefined;
  return async (mark) => {
    file ??= handle.getFile().catch(() => null);
    const f = await file;
    if (!f || f.size !== mark.byteLength) return false;
    digest ??= f.arrayBuffer().then(b => precomputeSha256(new Uint8Array(b))).catch(() => null);
    return (await digest) === mark.sha256;
  };
}

export interface TargetReaders {
  scanPath?: (path: string, ownBomVersion: OwnBomVersion | null) => Promise<TargetForeignScan | null>;
  readSite?: (id: string) => Promise<Uint8Array | null>;
  readPath?: (path: string) => Promise<Uint8Array | null>;
}

export function capturedTargetReaders(current: Uint8Array | 'unreadable' | null, base: () => TargetReaders): () => TargetReaders {
  if (current === null) return base;
  let scan: Promise<TargetForeignScan> | undefined;
  return () => ({
    ...base(),
    scanPath: async () => current === 'unreadable' ? 'unreadable' : (scan ??= scanForeignTargetBytesAsync(current)),
    readPath: async (path: string) => {
      if (current === 'unreadable') throw new Error(`Het bestaande doel ${path} is niet leesbaar.`);
      return current;
    },
  });
}

export async function targetRefusal(
  target: FileRef, readers: TargetReaders = {}, ownBomVersion: OwnBomVersion | null = null,
): Promise<'model' | 'foreign' | 'unreadable' | null> {
  const refusal = (scan: TargetForeignScan | null) => (scan === 'model' || scan === 'foreign' || scan === 'unreadable' ? scan : null);
  try {
    switch (target.kind) {
      case 'handle':
        return refusal(await scanForeignTargetBlob(await target.handle.getFile(), { ownBomVersion }));
      case 'path':
        return readers.scanPath ? refusal(await readers.scanPath(target.path, ownBomVersion)) : 'unreadable';
      case 'site': {
        const bytes = readers.readSite ? await readers.readSite(target.id) : null;
        return bytes ? refusal(await scanForeignTargetBytesAsync(bytes)) : 'unreadable';
      }
    }
  } catch {
    return 'unreadable';
  }
}

export type IfcxClassify = (bytes: Uint8Array) => Promise<IfcxClassification>;

export async function ifcxTargetRefusal(
  target: FileRef, readers: TargetReaders, classify: IfcxClassify | undefined,
): Promise<'foreign' | 'unreadable' | null> {
  if (target.kind === 'site') return null;
  let bytes: Uint8Array | null;
  try {
    bytes = await existingTargetBytes(target, readers);
  } catch {
    return 'unreadable';
  }
  if (bytes === null || bytes.byteLength === 0) return null;
  if (!classify) return 'unreadable';
  try {
    const classification = await classify(bytes);
    return classification === 'own' ? null : classification === 'foreign' ? 'foreign' : 'unreadable';
  } catch {
    return 'unreadable';
  }
}

async function existingTargetBytes(target: Exclude<FileRef, { kind: 'site' }>, readers: TargetReaders): Promise<Uint8Array | null> {
  if (target.kind === 'handle') {
    const file = await target.handle.getFile();
    return file.size === 0 ? null : new Uint8Array(await file.arrayBuffer());
  }
  if (!readers.readPath) throw new Error('Geen lezer voor een bestaand pad.');
  return readers.readPath(target.path);
}

export async function sameLocalFile(a: string, b: string, deps: ForeignSourceTargetDeps = {}): Promise<boolean> {
  if (samePath(a, b)) return true;
  return !!deps.identityFs && (await compareFilePaths(deps.identityFs, a, b)) === 'same';
}

export async function isForeignSourceTarget(
  target: FileRef,
  marks: readonly ForeignSourceMark[],
  deps: ForeignSourceTargetDeps = {},
): Promise<boolean> {
  const sameContent = target.kind === 'handle' ? targetContent(target.handle) : null;
  for (const mark of marks) {
    switch (target.kind) {
      case 'site':
        if (mark.siteFileId !== null && mark.siteFileId === target.id) return true;
        break;
      case 'path':
        if (mark.filePath !== null && await sameLocalFile(target.path, mark.filePath, deps)) return true;
        break;
      case 'handle':
        if (mark.handle) {
          if (await sameEntry(mark.handle, target.handle)) return true;
        } else if (sameContent && await sameContent(mark)) {
          return true;
        }
        break;
    }
  }
  return false;
}
