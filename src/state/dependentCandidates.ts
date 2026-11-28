import type { DependentCandidate, DependentLink } from '@/engine/dependentProjects';
import { findDependentLinks, tightDependentAnchors, type TightAnchor } from '@/engine/dependentProjects';
import { externalSourceFromImport } from './externalSource';
import { parseOpenedFile } from '@/services/formatRegistry';
import { activeImportResult, type ImportLabels } from '@/services/importTypes';
import { ensureUniqueImportIds } from '@/services/importNormalize';
import { payloadFromImport, type DocumentPayload } from './documentContract';
import type { DependentProjectsResult } from './slices/types';
import { basename } from '@/utils/filePath';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput, type IFCSaveSource } from './ifcSaveInput';

export async function candidateFromIfcText(
  name: string, text: string, labels?: ImportLabels,
): Promise<DependentCandidate | null> {
  try {
    const { result } = ensureUniqueImportIds(activeImportResult(await parseOpenedFile({ name, text }, labels)));
    const payload = payloadFromImport(result, name);
    return {
      projectId: payload.project.id,
      projectName: payload.project.name,
      fileName: basename(name),
      opened: false,
      tasks: payload.tasks,
    };
  } catch {
    return null;
  }
}

export function candidatesFromOpenDocuments(
  docs: readonly { id: string; payload: DocumentPayload }[],
  activeDocumentId: string,
): DependentCandidate[] {
  return docs
    .filter(d => d.id !== activeDocumentId)
    .map(({ payload }) => ({
      projectId: payload.project.id,
      projectName: payload.project.name,
      ...(payload.filePath ? { fileName: basename(payload.filePath) } : {}),
      opened: true,
      tasks: payload.tasks,
    }));
}

export function dependentLinksFrom(
  opened: readonly DependentCandidate[],
  files: readonly DependentCandidate[],
  ownProjectId: string,
): DependentLink[] {
  return findDependentLinks([...opened, ...files], ownProjectId);
}

export function withDependentResult(
  list: readonly DependentProjectsResult[],
  next: DependentProjectsResult,
  openDocumentIds: ReadonlySet<string>,
): DependentProjectsResult[] {
  return [...list.filter(r => r.documentId !== next.documentId && openDocumentIds.has(r.documentId)), next];
}

export async function dependentAnchorsAsSaved(
  links: readonly DependentLink[], ifcText: string, labels?: ImportLabels,
): Promise<TightAnchor[]> {
  const name = 'opslaan.ifc';
  const source = externalSourceFromImport(activeImportResult(await parseOpenedFile({ name, text: ifcText }, labels)), name);
  return tightDependentAnchors(links, source.tasks, source);
}

export async function tightAnchorsIfSaved(
  results: readonly DependentProjectsResult[], documentId: string, document: IFCSaveSource,
): Promise<TightAnchor[]> {
  const result = results.find(r => r.documentId === documentId);
  if (!result || result.projectId !== document.project.id || result.links.length === 0) return [];
  try {
    return await dependentAnchorsAsSaved(result.links, writeIFC(buildWriteIFCInput(document, 'planOnly')));
  } catch (err) {
    console.warn('Afhankelijke projecten: bron als opgeslagen niet te lezen:', err);
    return tightDependentAnchors(result.links, document.tasks);
  }
}
