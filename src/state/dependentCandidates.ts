// Kandidaten voor *Afhankelijke projecten zoeken…* (stap 1.11): gelezen bestanden en geopende
// documenten, in de vorm die `findDependentLinks` leest. Zonder store, zodat de planningstests het
// headless kunnen draaien; de zoekroute zelf staat in `dependentProjectsSearch.ts`.
import type { DependentCandidate, DependentLink } from '@/engine/dependentProjects';
import { findDependentLinks } from '@/engine/dependentProjects';
import { parseOpenedFile } from '@/services/formatRegistry';
import { activeImportResult, type ImportLabels } from '@/services/importTypes';
import type { DocumentPayload } from './documentContract';
import type { DependentProjectsResult } from './slices/types';
import { basename } from '@/utils/filePath';

/**
 * Een IFC-bestand als kandidaat, alleen-lezen: de lezer van het formaat, zonder het als document te
 * openen en zonder door te rekenen (alleen het project-id en de koppelingen tellen). Een bestand dat
 * de lezer weigert (geen planning, een gebouwmodel, kapot) ⇒ `null`.
 */
export async function candidateFromIfcText(
  name: string, text: string, labels?: ImportLabels,
): Promise<DependentCandidate | null> {
  try {
    const parsed = activeImportResult(await parseOpenedFile({ name, text }, labels));
    return {
      projectId: parsed.project.id,
      projectName: parsed.project.name,
      fileName: basename(name),
      opened: false,
      tasks: parsed.tasks,
    };
  } catch {
    return null;
  }
}

/** De geopende documenten als kandidaten, met hun koppelingen in het geheugen (ook niet-opgeslagen).
 *  Het actieve document zelf telt niet mee. */
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

/** Zoekt de koppelingen; geopende documenten eerst, zodat ze winnen van hun bestand. */
export function dependentLinksFrom(
  opened: readonly DependentCandidate[],
  files: readonly DependentCandidate[],
  ownProjectId: string,
): DependentLink[] {
  return findDependentLinks([...opened, ...files], ownProjectId);
}

/** De lijst met zoekresultaten met `next` voor zijn document (vervangt een eerder resultaat). Een
 *  document dat niet meer open is, valt weg. */
export function withDependentResult(
  list: readonly DependentProjectsResult[],
  next: DependentProjectsResult,
  openDocumentIds: ReadonlySet<string>,
): DependentProjectsResult[] {
  return [...list.filter(r => r.documentId !== next.documentId && openDocumentIds.has(r.documentId)), next];
}
