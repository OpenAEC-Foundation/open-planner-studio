// Is het gekozen doel van een opslag of export het bronbestand van een document met een vreemd deel (#804 fase 1a,
// fixronde 1)? Dan schreef de app alleen planning (of CSV, XML, ...) over het modelbestand. Deze controle draait vóór het
// schrijven: in de Tauri-route na de padkeuze, in de browser na `showSaveFilePicker` en vóór `createWritable()`, en vóór
// een nieuwe versie op de site.
//
// Per route:
//  - pad (Tauri): hetzelfde genormaliseerde pad, of dezelfde bestandsidentiteit (`compareFilePaths`: dev en ino);
//  - handle (browser): `isSameEntry` met de handle van de bron; zonder handle (na crashherstel bewaart de app geen
//    handle) dezelfde inhoud: lengte en SHA-256 van het gekozen bestand gelijk aan de bron;
//  - site: hetzelfde `siteFileId`.
// Is niet vast te stellen of het doel hetzelfde bestand is (een download, een fout bij lezen), dan telt het als een ander
// bestand: het nieuwe bestand mag.
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import type { ForeignSourceMark } from '@/services/ifc/foreign/foreignSourceMark';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { compareFilePaths, type FileIdentityFs } from './fileIdentity';
import type { FileRef } from './index';

export interface ForeignSourceTargetDeps {
  /** Bestandsidentiteit voor paden (Tauri: plugin-fs `stat`). Zonder: alleen het genormaliseerde pad. */
  identityFs?: FileIdentityFs;
}

/** Hetzelfde pad, lexicaal: dezelfde regel als de externe bronnen (`normalizeExternalSourcePath`). */
function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  const na = normalizeExternalSourcePath(a);
  return na !== null && na === normalizeExternalSourcePath(b);
}

async function sameEntry(a: FileSystemFileHandle, b: FileSystemFileHandle): Promise<boolean> {
  try {
    return await a.isSameEntry(b);
  } catch {
    return false;
  }
}

/** Heeft het gekozen bestand de inhoud van de bron? Eerst de lengte (goedkoop), dan de SHA-256. */
async function sameContent(handle: FileSystemFileHandle, mark: ForeignSourceMark): Promise<boolean> {
  try {
    const file = await handle.getFile();
    if (file.size !== mark.byteLength) return false;
    return (await precomputeSha256(new Uint8Array(await file.arrayBuffer()))) === mark.sha256;
  } catch {
    return false;
  }
}

/** Is `target` de bron van een van de `marks`? */
export async function isForeignSourceTarget(
  target: FileRef,
  marks: readonly ForeignSourceMark[],
  deps: ForeignSourceTargetDeps = {},
): Promise<boolean> {
  for (const mark of marks) {
    switch (target.kind) {
      case 'site':
        if (mark.siteFileId !== null && mark.siteFileId === target.id) return true;
        break;
      case 'path':
        if (mark.filePath === null) break;
        if (samePath(target.path, mark.filePath)) return true;
        if (deps.identityFs && (await compareFilePaths(deps.identityFs, target.path, mark.filePath)) === 'same') return true;
        break;
      case 'handle':
        if (mark.handle) {
          if (await sameEntry(mark.handle, target.handle)) return true;
        } else if (await sameContent(target.handle, mark)) {
          return true;
        }
        break;
    }
  }
  return false;
}
