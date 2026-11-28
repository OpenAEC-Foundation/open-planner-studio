import { externalSourceKey, type ExternalSourceLocator } from '@/engine/externalLinks';
import type { ExternalAnchorChange } from '@/engine/externalRefreshPreview';
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { parseOpenedFile } from '@/services/formatRegistry';
import { activeImportResult, type ImportLabels } from '@/services/importTypes';
import { basename } from '@/utils/filePath';
import type { DocumentPayload } from './documentContract';
import { externalSourceFromImport, type ExternalSourceRead } from './externalSource';
import { buildWriteIFCInput } from './ifcSaveInput';

export interface OpenDocumentForSource {
  id: string;
  payload: Pick<DocumentPayload, 'filePath' | 'siteFileId' | 'project' | 'isDirty'>;
}

export function openSourceDocument<T extends OpenDocumentForSource>(
  locator: ExternalSourceLocator,
  docs: readonly T[],
  activeDocumentId: string,
): T | null {
  const matches = docs.filter(doc => doc.id !== activeDocumentId && documentIsSource(locator, doc.payload));
  return matches.length === 1 ? matches[0] : null;
}

function documentIsSource(locator: ExternalSourceLocator, payload: OpenDocumentForSource['payload']): boolean {
  const siteFileId = payload.siteFileId?.trim();
  if (locator.kind === 'site') return !!siteFileId && siteFileId === locator.siteFileId;
  if (siteFileId) return false;
  if (locator.kind === 'path') {
    const wanted = normalizeExternalSourcePath(locator.filePath);
    return wanted !== null && !!payload.filePath && normalizeExternalSourcePath(payload.filePath) === wanted;
  }
  return !!payload.filePath && payload.project.id === locator.projectId;
}

export function openSourceName(locator: ExternalSourceLocator, payload: Pick<DocumentPayload, 'filePath' | 'project'>): string {
  if (locator.kind === 'path') return basename(locator.filePath);
  return payload.filePath ? basename(payload.filePath) : payload.project.name;
}

export interface UnsavedOpenSource {
  key: string;
  fileName: string;
}

export function unsavedOpenSources(
  locators: readonly ExternalSourceLocator[],
  docs: readonly OpenDocumentForSource[],
  activeDocumentId: string,
): UnsavedOpenSource[] {
  const out: UnsavedOpenSource[] = [];
  const seen = new Set<string>();
  for (const locator of locators) {
    const key = externalSourceKey(locator);
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    const doc = openSourceDocument(locator, docs, activeDocumentId);
    if (!doc || !doc.payload.isDirty) continue;
    out.push({ key, fileName: openSourceName(locator, doc.payload) });
  }
  return out;
}

export async function externalSourceFromOpenDocument(
  payload: DocumentPayload,
  locator: ExternalSourceLocator,
  labels?: ImportLabels,
  now: () => Date = () => new Date(),
): Promise<ExternalSourceRead> {
  const fileName = openSourceName(locator, payload);
  const name = fileName.toLowerCase().endsWith('.ifc') ? fileName : `${fileName}.ifc`;
  const text = writeIFC(buildWriteIFCInput(payload, 'planOnly'));
  const { filePath: _path, version: _version, ...read } = externalSourceFromImport(
    activeImportResult(await parseOpenedFile({ name, text }, labels)), name,
  );
  void _path; void _version;
  return {
    ...read,
    ...(locator.kind === 'path' ? { filePath: locator.filePath } : {}),
    ...(locator.kind === 'site' ? { siteFileId: locator.siteFileId } : {}),
    fileName,
    readAt: now().toISOString(),
  };
}

export function proposalFingerprint(changes: readonly ExternalAnchorChange[]): string {
  const parts = changes.map(c => `${c.taskId}/${c.linkId}=${c.link.sourceMissing ? 'missing' : c.link.anchorDate}`);
  return `open:${parts.sort().join(';')}`;
}
