// Het bronbestand van een externe relatie inlezen, alleen-lezen, zonder het als document te openen.
// Gedeeld door `fileSlice.parseExternalSource` (de dialoog, "Bron vernieuwen" en "Alle externe
// relaties vernieuwen") en door de tests, die er een eigen `FormatIO` aan geven.
import type { ExternalSourceDoc } from '@/engine/externalLinks';
import { parseOpenedFile, readFormatInput, type FormatIO } from '@/services/formatRegistry';
import { activeImportResult, type ImportLabels, type ImportResult } from '@/services/importTypes';
import { ensureUniqueImportIds } from '@/services/importNormalize';
import { payloadFromImport } from './documentContract';
import { prepareLoadedPayload } from './documentActivation';

/** Een ingelezen bron, met de velden die de verversing en de dialoog lezen. */
export interface ExternalSourceRead extends ExternalSourceDoc {
  projectName: string;
  filePath: string;
}

/**
 * Maakt van een gelezen bestand de bron voor `refreshExternalAnchors`, via dezelfde laadgrens als
 * openen (knownbug 336): unieke id's, de omzetting naar het minutenmodel (`payloadFromImport`) en
 * een berekening zoals bij laden (`prepareLoadedPayload`). Zo draagt de brontaak de momenten die de
 * planner in dat project ziet. De kale lezer gaf een eigen IFC datums zonder tijd; de eigen taak
 * koos daar dan de verkeerde kant van de dag bij (een mijlpaal heeft één moment, D7).
 *
 * Zonder modus "datums zoals opgeslagen": de bron telt met zijn berekende datums. Een cyclus in de
 * bron laat de datums staan zoals gelezen (`solveProject` schrijft dan niets terug).
 */
export function externalSourceFromImport(parsed: ImportResult, filePath: string): ExternalSourceRead {
  const { result } = ensureUniqueImportIds(parsed);
  const prepared = prepareLoadedPayload(payloadFromImport(result, filePath), { recompute: true });
  return {
    projectId: prepared.project.id,
    projectName: prepared.project.name,
    filePath,
    tasks: prepared.tasks,
  };
}

/** Leest `filePath` via `io` met de lezer van zijn formaat en maakt er een bron van. Een meervoudige
 *  XER-import levert het actieve project, zoals bij openen. Fouten gaan naar de aanroeper. */
export async function readExternalSource(
  filePath: string,
  io: FormatIO,
  labels?: ImportLabels,
): Promise<ExternalSourceRead> {
  const input = await readFormatInput(filePath, io);
  return externalSourceFromImport(activeImportResult(await parseOpenedFile(input, labels)), filePath);
}
