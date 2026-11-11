// Het bronbestand van een externe relatie inlezen, alleen-lezen, zonder het als document te openen.
// Gedeeld door `fileSlice.parseExternalSource` (de dialoog, "Bron vernieuwen" en "Alle externe
// relaties vernieuwen") en door de tests, die er een eigen `FormatIO` aan geven.
import type { ExternalSourceDoc, LateDatesInFile } from '@/engine/externalLinks';
import { captureRecordedDates } from '@/engine/scheduler/recordedDates';
import { descendantLeaves } from '@/engine/scheduler/summaryProgress';
import type { Task } from '@/types/task';
import { parseOpenedFile, readFormatInput, type FormatIO, type FormatReadOptions } from '@/services/formatRegistry';
import { activeImportResult, type ImportLabels, type ImportResult } from '@/services/importTypes';
import { ensureUniqueImportIds } from '@/services/importNormalize';
import type { SiteSourceFile } from '@/services/fileAccess/siteBackend';
import { payloadFromImport } from './documentContract';
import { applyRecordedDatesOnLoad, prepareLoadedPayload } from './documentActivation';

/** Een ingelezen bron, met de velden die de verversing en de dialoog lezen. */
export interface ExternalSourceRead extends ExternalSourceDoc {
  projectName: string;
  /** Het pad waarmee de app de bron las (desktop). Een bron uit de browser heeft geen pad (stap 1.8). */
  filePath?: string;
  /** De bestandsnaam voor de tekst ("Installateur.ifc"). Afwezig ⇒ de tekst noemt de projectnaam. */
  fileName?: string;
  /** De auteur uit de projectgegevens van de bron; de balk bij een nieuwe versie noemt hem (stap 1.5). */
  author?: string;
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
 */
export function externalSourceFromImport(parsed: ImportResult, filePath: string): ExternalSourceRead {
  const { result } = ensureUniqueImportIds(parsed);
  const payload = payloadFromImport(result, filePath);
  const prepared = prepareLoadedPayload(payload, { recompute: true });
  // `payload.tasks` is de taaklijst van vóór de berekening: `prepareLoadedPayload` muteert zijn
  // invoer niet, en `applyRecordedDatesOnLoad` vergelijkt de vastlegging met de nieuwe berekening.
  applyRecordedDatesOnLoad(payload.tasks, prepared, parsed);
  return {
    projectId: prepared.project.id,
    projectName: prepared.project.name,
    filePath,
    fileName: filePath.split(/[\\/]/).pop() || filePath,
    ...(prepared.project.author?.trim() ? { author: prepared.project.author.trim() } : {}),
    tasks: prepared.tasks,
    lateDatesInFile: lateDatesInFile(payload.tasks, parsed),
  };
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
  readOptions?: FormatReadOptions,
): Promise<ExternalSourceRead> {
  const input = await readFormatInput(filePath, io, readOptions);
  return externalSourceFromImport(activeImportResult(await parseOpenedFile(input, labels, readOptions)), filePath);
}

/** Het deel van een `File` dat de bronlezer gebruikt; de tests geven een eigen object. */
export interface ExternalSourceFile {
  name: string;
  lastModified: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Leest een bestand dat de planner in de browser koos (stap 1.8). De bron heeft geen pad: de koppeling
 * herkent haar op project-id. De versie is de wijzigingstijd van het bestand (`lastModified`, ISO), net als
 * op de desktop; de leestijd is nu. Fouten gaan naar de aanroeper.
 */
export async function readExternalSourceFile(
  file: ExternalSourceFile, labels?: ImportLabels, readOptions?: FormatReadOptions,
): Promise<ExternalSourceRead> {
  const io: FormatIO = {
    readTextFile: () => file.text(),
    readFile: async () => new Uint8Array(await file.arrayBuffer()),
  };
  const input = await readFormatInput(file.name, io, readOptions);
  const { filePath: _path, ...read } = externalSourceFromImport(activeImportResult(await parseOpenedFile(input, labels, readOptions)), file.name);
  void _path;
  const modified = new Date(file.lastModified);
  return {
    ...read,
    fileName: file.name,
    ...(isNaN(modified.getTime()) ? {} : { version: modified.toISOString() }),
    readAt: new Date().toISOString(),
  };
}

/**
 * Leest een bron van de site (stap 1.9), alleen-lezen, door dezelfde laadgrens als openen. De bron heeft geen
 * pad: de koppeling herkent haar op het vaste id op de site (`siteFileId`). De versie is de versie op de site;
 * de leestijd is nu. Fouten gaan naar de aanroeper.
 */
export async function readExternalSiteSource(
  file: SiteSourceFile, labels?: ImportLabels, readOptions?: FormatReadOptions,
): Promise<ExternalSourceRead> {
  const io: FormatIO = { readTextFile: () => file.text(), readFile: () => file.bytes() };
  const input = await readFormatInput(file.name, io, readOptions);
  const { filePath: _path, ...read } = externalSourceFromImport(activeImportResult(await parseOpenedFile(input, labels, readOptions)), file.name);
  void _path;
  return {
    ...read,
    siteFileId: file.id,
    fileName: file.name,
    ...(file.version ? { version: file.version } : {}),
    readAt: new Date().toISOString(),
  };
}
