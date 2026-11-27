import type { FileRef } from '@/services/fileAccess';
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
  readPath: (path: string) => Promise<Uint8Array | null>,
): Promise<void> {
  const source = references.modelSource;
  if (!source || plan?.kind === 'site') return;
  const handle = knownHandles.find(candidate => candidate.name === source.fileName);
  const ref: FileRef | null = plan?.kind === 'path'
    ? { kind: 'path', path: plan.path.slice(0, plan.path.length - basename(plan.path).length) + source.fileName }
    : handle ? { kind: 'handle', handle } : null;
  if (!ref) return;
  bindIfcxModel(references, ref);
  try {
    const bytes = ref.kind === 'handle' ? new Uint8Array(await (await ref.handle.getFile()).arrayBuffer()) : await readPath(ref.path);
    if (!bytes) return;
    const { readIfcxModelSource } = await import('./ifcx/modelSource');
    const model = await readIfcxModelSource(bytes);
    if (model.sha256 === source.sha256) bindIfcxModel(references, ref, model.elements);
  } catch {
    return;
  }
}
