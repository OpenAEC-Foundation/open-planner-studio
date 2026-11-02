// Het bronbestand van een externe relatie inlezen, alleen-lezen, zonder het als document te openen.
// Gedeeld door `fileSlice.parseExternalSource` (de dialoog, "Bron vernieuwen" en "Alle externe
// relaties vernieuwen") en door de tests, die er een eigen `FormatIO` aan geven.
import type { ExternalSourceDoc, LateDatesInFile } from '@/engine/externalLinks';
import { captureRecordedDates } from '@/engine/scheduler/recordedDates';
import { descendantLeaves } from '@/engine/scheduler/summaryProgress';
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import type { Task } from '@/types/task';
import { parseOpenedFile, readFormatInput, type FormatIO } from '@/services/formatRegistry';
import { activeImportResult, type ImportLabels, type ImportResult } from '@/services/importTypes';
import { ensureUniqueImportIds } from '@/services/importNormalize';
import { payloadFromImport } from './documentContract';
import { applyRecordedDatesOnLoad, prepareLoadedPayload } from './documentActivation';

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
 * Ook de modus "datums zoals opgeslagen" volgt het openen (`applyRecordedDatesOnLoad`, met dezelfde
 * argumenten als `fileSlice.applyLoadedProject`): opent de bron in de modus, dan telt hij met de
 * opgeslagen datums, anders met de berekening (review PR #792 ronde 1). Een cyclus in de bron laat
 * de datums staan zoals gelezen (`solveProject` schrijft dan niets terug).
 *
 * Die berekening geeft elke brontaak late datums, ook als het bestand ze niet had. Een externe
 * opvolger rekent alleen met een late datum die het bestand zelf droeg; daarom onthoudt de bron per
 * taak welke late as er in het bestand stond (`lateDatesInFile`, review PR #794 ronde 1).
 *
 * Draagt het bestand geen projectsleutel (`generatedProjectId`: MSPDI zonder GUID, `.mpp`, CSV), dan is
 * het project-id van de lezer bij elk inlezen anders. De bron krijgt dan het bestandspad als project-id
 * (knownbug 837): zo blijft het id bij elk inlezen gelijk, en schrijft "Bron vernieuwen" niet elke keer
 * een nieuw id in de koppeling (een onnodige undo-stap).
 */
export function externalSourceFromImport(parsed: ImportResult, filePath: string): ExternalSourceRead {
  const { result } = ensureUniqueImportIds(parsed);
  const payload = payloadFromImport(result, filePath);
  const prepared = prepareLoadedPayload(payload, { recompute: true });
  // `payload.tasks` is de taaklijst van vóór de berekening: `prepareLoadedPayload` muteert zijn
  // invoer niet, en `applyRecordedDatesOnLoad` vergelijkt de vastlegging met de nieuwe berekening.
  applyRecordedDatesOnLoad(payload.tasks, prepared, parsed);
  return {
    projectId: parsed.generatedProjectId ? sourceProjectIdFromPath(filePath) : prepared.project.id,
    projectName: prepared.project.name,
    filePath,
    tasks: prepared.tasks,
    lateDatesInFile: lateDatesInFile(payload.tasks, parsed),
  };
}

/** Het project-id van een bron zonder projectsleutel: het genormaliseerde bestandspad. */
function sourceProjectIdFromPath(filePath: string): string {
  return `file:${normalizeExternalSourcePath(filePath) ?? filePath}`;
}

/**
 * Per taak: droeg het bestand een late start en een late finish? Uit dezelfde vastlegging als
 * "datums zoals opgeslagen" (`captureRecordedDates`): bij IFC de gevulde slots (`recordedFields`),
 * bij XER, P6 XML, MSPDI, `.mpp` en CSV de rekenuitvoer van de bron (`recordedTimes`; een ontbrekende
 * as ontbreekt daar). Een taak MET eigen vastlegging telt per as alleen die vastlegging, ook een
 * verzameltaak: legt het bestand de fase vast zonder late finish, dan telt een late finish van haar
 * kind niet (review PR #794 ronde 2). Alleen een verzameltaak ZONDER eigen vastlegging (de bronlezers
 * van XER, P6 XML, MSPDI en `.mpp` bewaren alleen die van bladtaken, `leafRecordedTimes`) telt een as
 * als al haar bladen hem droegen.
 */
function lateDatesInFile(tasks: Task[], parsed: ImportResult): Record<string, LateDatesInFile> {
  const { times } = captureRecordedDates(tasks, parsed.recordedFields, parsed.recordedTimes);
  const own = (task: Task): LateDatesInFile => ({ start: !!times[task.id]?.lateStart, finish: !!times[task.id]?.lateFinish });
  const byId = new Map(tasks.map(task => [task.id, task] as const));
  const cache = new Map<string, Task[]>();
  const out: Record<string, LateDatesInFile> = {};
  for (const task of tasks) {
    if (task.childIds.length === 0 || times[task.id]) { out[task.id] = own(task); continue; }
    const leaves = descendantLeaves(task, byId, cache).map(own);
    out[task.id] = {
      start: leaves.length > 0 && leaves.every(leaf => leaf.start),
      finish: leaves.length > 0 && leaves.every(leaf => leaf.finish),
    };
  }
  return out;
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
