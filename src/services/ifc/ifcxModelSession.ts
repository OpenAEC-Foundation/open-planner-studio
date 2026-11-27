import type { FileRef } from '@/services/fileAccess';
import type { FileIdentityFs } from '@/services/fileAccess/fileIdentity';
import { sameEntry, sameLocalFile } from '@/services/fileAccess/foreignSourceTarget';
import type { IfcxModelReferences } from './ifcx/modelReferences';
import type { ModelSource } from './ifcx/modelSource';
import type { TaskElementLinks } from './foreign/elementLinks';
import { basename } from '@/utils/filePath';

export type ModelElements = ModelSource['elements'];

interface ModelSession {
  ref: FileRef | null;
  elements?: ModelElements;
  checkedLinks?: TaskElementLinks;
}

const sessions = new WeakMap<IfcxModelReferences, ModelSession>();

export function ifcxModelSession(references?: IfcxModelReferences | null): ModelSession | undefined {
  return references ? sessions.get(references) : undefined;
}

export function bindIfcxModel(references: IfcxModelReferences, ref: FileRef | null, elements?: ModelElements): void {
  const checkedLinks = elements && references.elementLinks && new Map([...references.elementLinks].map(([id, links]) =>
    [id, links.map(link => ({ ...link, found: elements.has(link.target) }))]));
  sessions.set(references, { ref, elements, checkedLinks });
}

export async function findIfcxModel(
  references: IfcxModelReferences, plan: FileRef | null, knownHandles: readonly FileSystemFileHandle[],
  readPath: (path: string) => Promise<Uint8Array | null>, identityFs: FileIdentityFs | undefined,
): Promise<void> {
  const source = references.modelSource;
  if (!source || plan?.kind === 'site') return;
  let candidates: Exclude<FileRef, { kind: 'site' }>[];
  if (plan?.kind === 'path') {
    const path = plan.path.slice(0, plan.path.length - basename(plan.path).length) + source.fileName;
    if (await sameLocalFile(plan.path, path, { identityFs })) return;
    candidates = [{ kind: 'path', path }];
  } else {
    candidates = [...new Set(knownHandles)].filter(handle => handle.name === source.fileName)
      .map(handle => ({ kind: 'handle', handle }));
  }
  let firstCandidate: FileRef | undefined;
  for (const ref of candidates) {
    if (plan?.kind === 'handle' && ref.kind === 'handle' &&
        (plan.handle === ref.handle || await sameEntry(plan.handle, ref.handle))) continue;
    firstCandidate ??= ref;
    try {
      const bytes = ref.kind === 'handle' ? new Uint8Array(await (await ref.handle.getFile()).arrayBuffer()) : await readPath(ref.path);
      if (!bytes) continue;
      const { readIfcxModelSource } = await import('./ifcx/modelSource');
      const model = await readIfcxModelSource(bytes);
      if (model.sha256 !== source.sha256) continue;
      bindIfcxModel(references, ref, model.elements);
      return;
    } catch {
      continue;
    }
  }
  if (firstCandidate) bindIfcxModel(references, firstCandidate);
}
