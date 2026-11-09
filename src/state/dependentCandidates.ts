// Kandidaten voor *Afhankelijke projecten zoeken…* (stap 1.11): gelezen bestanden en geopende
// documenten, in de vorm die `findDependentLinks` leest. Zonder store, zodat de planningstests het
// headless kunnen draaien; de zoekroute zelf staat in `dependentProjectsSearch.ts`.
import type { DependentCandidate, DependentLink } from '@/engine/dependentProjects';
import { findDependentLinks, tightDependentAnchors, type TightAnchor } from '@/engine/dependentProjects';
import { externalSourceFromImport } from './externalSource';
import { parseOpenedFile } from '@/services/formatRegistry';
import { activeImportResult, type ImportLabels } from '@/services/importTypes';
import { ensureUniqueImportIds } from '@/services/importNormalize';
import { payloadFromImport, type DocumentPayload } from './documentContract';
import type { DependentProjectsResult } from './slices/types';
import { basename } from '@/utils/filePath';

/**
 * Een IFC-bestand als kandidaat, alleen-lezen: de lezer van het formaat en dezelfde laadgrens als
 * openen (`payloadFromImport`: unieke id's en de omzetting naar het minutenmodel, die ook de ankers
 * van de koppelingen omzet), zonder het als document te openen en zonder door te rekenen. Zonder die
 * omzetting is een anker uit een dagenbestand een datum (`2027-03-05`) in plaats van het moment
 * waarop dat project rekent, en gaf de waarschuwing vóór opslaan een valse melding. Een bestand dat de
 * lezer weigert (geen planning, een gebouwmodel, kapot) ⇒ `null`.
 */
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

/**
 * De te krappe ankers zoals het afhankelijke project ze ziet na dit opslaan (review #857 ronde 1). Het
 * afhankelijke project leest het opgeslagen bestand met de bronleesroute (`readExternalSource`): lezen,
 * de laadgrens van openen en een berekening zoals bij openen (`externalSourceFromImport`). Is de planning
 * hier niet herberekend (bijv. een langere duur zonder F5), dan rekent die route de nieuwe datums toch
 * door. Daarom vergelijkt de waarschuwing met precies die route, op de tekst die opgeslagen gaat worden.
 * Alles gebeurt op een kopie: het geopende document wordt niet herberekend (handmatig rekencontract).
 */
export async function dependentAnchorsAsSaved(
  links: readonly DependentLink[], ifcText: string, labels?: ImportLabels,
): Promise<TightAnchor[]> {
  const name = 'opslaan.ifc';
  const source = externalSourceFromImport(activeImportResult(await parseOpenedFile({ name, text: ifcText }, labels)), name);
  return tightDependentAnchors(links, source.tasks, source);
}
