// Stap 1.7 (keuze 5, Ethan 2026-11-03; §7.1 en §9 in `docs/relaties-tussen-projecten.md`): een bron die ook als
// document open staat in deze app. Standaard komt het anker uit het opgeslagen bestand; heeft het geopende
// document niet-opgeslagen wijzigingen, dan zegt de app dat. Met het vinkje *Ankers uit geopende documenten halen*
// in het afhankelijke project (`Project.anchorsFromOpenDocuments`, besluit Ethan 2026-11-10) rekent de app met het
// geopende document. Zonder store, zodat de planningstests het headless kunnen draaien.
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

/** Een geopend document zoals de herkenning het leest: zijn id en zijn payload. */
export interface OpenDocumentForSource {
  id: string;
  payload: Pick<DocumentPayload, 'filePath' | 'siteFileId' | 'project' | 'isDirty'>;
}

/**
 * Het geopende document dat dezelfde bron is als `locator`, behalve het actieve document zelf:
 *
 * - een bron met pad: hetzelfde genormaliseerde pad (`normalizeExternalSourcePath`);
 * - een bron op de site: hetzelfde `siteFileId`;
 * - een bron zonder pad (gekozen in de browser): hetzelfde project-id, bij een document dat uit een bestand
 *   komt en niet van de site. Een variant (*Dupliceren*) heeft geen bestand en telt dus niet.
 *
 * Passen er twee of meer documenten (bijv. twee kopieën met hetzelfde project-id), dan is niet te zeggen welk
 * document de bron is: dan `null`, en blijft alles zoals zonder geopend document.
 */
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

/** De naam van een bron voor de tekst: de bestandsnaam van het pad, anders die van het geopende document, anders
 *  de projectnaam. */
export function openSourceName(locator: ExternalSourceLocator, payload: Pick<DocumentPayload, 'filePath' | 'project'>): string {
  if (locator.kind === 'path') return basename(locator.filePath);
  return payload.filePath ? basename(payload.filePath) : payload.project.name;
}

/** Een bron die bij verversen ook als document open staat, met niet-opgeslagen wijzigingen. De melding noemt
 *  `fileName`. */
export interface UnsavedOpenSource {
  /** De sleutel van de bron (`externalSourceKey`). */
  key: string;
  fileName: string;
}

/**
 * Per gelezen bron: staat hij ook als document open, met niet-opgeslagen wijzigingen? Een schoon geopend
 * document geeft niets: het opgeslagen bestand is dan gelijk aan wat de planner ziet.
 */
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

/**
 * Het geopende document als bron, met de niet-opgeslagen wijzigingen, zoals het afhankelijke project het zou
 * lezen als het nu opgeslagen werd (het idee van `dependentAnchorsAsSaved`, stap 1.11): het IFC schrijven
 * (`buildWriteIFCInput`, net als opslaan), lezen en doorrekenen via de laadgrens van openen
 * (`externalSourceFromImport`). Alles op een kopie: het geopende document verandert niet en rekent niet.
 *
 * Herkomst (keuze 4): dit anker komt niet uit een opgeslagen versie. De bron heeft daarom geen `version`, wel
 * een leestijd; `refreshExternalAnchors` haalt dan de oude `sourceVersion` weg. Zodra de bron opgeslagen en
 * gesloten of schoon is, meldt de balk (stap 1.5) die versie.
 *
 * De bron draagt de plek van de koppeling (`locator`): het pad zoals in de koppeling, het site-id, of geen pad
 * (een bron uit de browser). Zo raakt de verversing precies de koppelingen naar die bron.
 */
export async function externalSourceFromOpenDocument(
  payload: DocumentPayload,
  locator: ExternalSourceLocator,
  labels?: ImportLabels,
  now: () => Date = () => new Date(),
): Promise<ExternalSourceRead> {
  const fileName = openSourceName(locator, payload);
  const name = fileName.toLowerCase().endsWith('.ifc') ? fileName : `${fileName}.ifc`;
  const text = writeIFC(buildWriteIFCInput(payload));
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

/**
 * De vingerafdruk van een voorstel van een balk (stap 1.5 en 1.7): per koppeling het voorgestelde anker en *brontaak
 * ontbreekt*, gesorteerd. Een geopend document heeft geen versie; zijn balk draagt deze vingerafdruk als versie.
 * *Later* onthoudt hem bij elke balk. Dezelfde voorgestelde ankers geven zo geen nieuwe balk uit het geopende
 * document, andere wel.
 */
export function proposalFingerprint(changes: readonly ExternalAnchorChange[]): string {
  const parts = changes.map(c => `${c.taskId}/${c.linkId}=${c.link.sourceMissing ? 'missing' : c.link.anchorDate}`);
  return `open:${parts.sort().join(';')}`;
}
