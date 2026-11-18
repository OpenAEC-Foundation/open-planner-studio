/**
 * De grens van de opslagworker (#804 stap 4): wat heen en terug gaat, en hoe een fout oversteekt. Gedeeld door de worker
 * (`ifcSave.worker.ts`) en de bediening (`ifcSaveWorker.ts`), die zonder worker met precies deze functies zelf rekent.
 *
 * Heen gaat een `IfcSaveJob` als kopie (`postMessage` zonder overdracht): de writer-invoer, en bij een merge de bron met
 * haar bytes. De hoofdthread blijft eigenaar van de bronbytes (inhoudscontroles, herstel, de oude bron na een mislukte
 * opslag). Terug gaat alles wat `prepareIfcOutput` nu oplevert, met de grote buffers overgedragen in plaats van gekopieerd:
 * bij de gewone writer de bytes (in de worker gecodeerd), bij een merge de uitvoer (die ook de bytes van de nieuwe bron
 * is) en de indexarrays van die bron. Gaf de merge de bron ongewijzigd terug, dan gaat alleen dat bericht terug: de
 * aanroeper heeft die bron al.
 */
import { freeze } from 'immer';
import { IfcCalendarTimePrecisionError, IfcParseError } from '@/services/ifc/ifcErrors';
import { MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { StepScanError } from '@/services/ifc/foreign/stepScanner';
import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { XerSourceArchiveValidationError } from '@/services/xerSourceArchive';
import { computeIfcOutputHere, type IfcOutput, type IfcSaveJob } from '@/state/prepareIfcOutput';

export type IfcSaveRequest = { readonly id: number; readonly job: IfcSaveJob };

export type IfcSaveResult =
  | { readonly kind: 'writer'; readonly bytes: Uint8Array; readonly literalCalendarIds: readonly string[] }
  | { readonly kind: 'merge'; readonly prepared: PreparedIfcWrite }
  /** De merge gaf de bron zelf terug (ongewijzigde planning): de aanroeper heeft haar al. */
  | { readonly kind: 'merge-unchanged'; readonly literalCalendarIds: readonly string[] };

/** Eerst één keer `started` (het script draait, de imports zijn geladen), daarna per verzoek een uitkomst of een fout. */
export type IfcSaveResponse =
  | { readonly started: true }
  | { readonly id: number; readonly result: IfcSaveResult }
  | { readonly id: number; readonly error: IfcSaveWireError };

/** Inhoudelijke fouten die oversteken als dezelfde foutsoort met dezelfde gegevens. Specifiek vóór algemeen. */
const CONTENT_ERRORS = {
  MergeNeedsPhase2Error, IfcCalendarTimePrecisionError, StepScanError, IfcParseError, XerSourceArchiveValidationError,
  TypeError, RangeError, Error,
} as const;
type ContentErrorType = keyof typeof CONTENT_ERRORS;

/** Een inhoudelijke fout als gewone data: soort, naam, tekst, stack en de eigen velden (`cases`, `minutes`, `reason` …). */
export interface IfcSaveWireError {
  readonly type: ContentErrorType;
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Rekent één geval zoals `prepareIfcOutput` op deze thread, in de vorm die over de grens gaat. */
export async function runIfcSaveJob(job: IfcSaveJob): Promise<IfcSaveResult> {
  const output = await computeIfcOutputHere(job);
  if (!output.prepared) {
    return { kind: 'writer', bytes: new TextEncoder().encode(output.content), literalCalendarIds: output.literalCalendarIds };
  }
  if (job.kind === 'merge' && output.prepared.source === job.source) {
    return { kind: 'merge-unchanged', literalCalendarIds: output.prepared.literalCalendarIds };
  }
  return { kind: 'merge', prepared: output.prepared };
}

/** De buffers die terug overgedragen worden; elke buffer één keer (een dubbele geeft `DataCloneError`). */
export function resultTransfer(result: IfcSaveResult): ArrayBuffer[] {
  if (result.kind === 'merge-unchanged') return [];
  const views = result.kind === 'writer' ? [result.bytes] : [result.prepared.bytes, result.prepared.source.bytes,
    result.prepared.source.chunkStarts, result.prepared.source.chunkIds, result.prepared.source.classes];
  return [...new Set(views.map(view => view.buffer as ArrayBuffer))];
}

/** Het verzoek in de worker: nooit een gegooide fout, altijd een antwoord met zijn overdrachtslijst. */
export async function handleIfcSaveRequest(request: IfcSaveRequest): Promise<{ response: IfcSaveResponse; transfer: ArrayBuffer[] }> {
  try {
    const result = await runIfcSaveJob(request.job);
    return { response: { id: request.id, result }, transfer: resultTransfer(result) };
  } catch (error) {
    return { response: { id: request.id, error: wireError(error) }, transfer: [] };
  }
}

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Past dit antwoord bij het verzoek, met alle verplichte velden van zijn soort? Een antwoord dat niet past, mag nooit
 *  een uitkomst worden die een schrijfroute kan gebruiken (review van #1016): de bediening maakt er een transportfout van.
 *  Alleen de vorm; de inhoud rekende de worker met dezelfde functies als de hoofdthread. */
export function resultFits(job: IfcSaveJob, result: unknown): result is IfcSaveResult {
  if (!isRecord(result)) return false;
  if (result.kind === 'writer') return job.kind === 'writer' && result.bytes instanceof Uint8Array && isStringList(result.literalCalendarIds);
  if (job.kind !== 'merge') return false;
  if (result.kind === 'merge-unchanged') return isStringList(result.literalCalendarIds);
  if (result.kind !== 'merge' || !isRecord(result.prepared)) return false;
  const { bytes, sha256, source, literalCalendarIds } = result.prepared;
  return bytes instanceof Uint8Array && typeof sha256 === 'string' && isStringList(literalCalendarIds) && isRecord(source)
    && source.bytes === bytes && source.sha256 === sha256 && typeof source.schemaName === 'string'
    && source.chunkStarts instanceof Uint32Array && source.chunkIds instanceof Int32Array && source.classes instanceof Uint8Array
    && isRecord(source.stepIds) && Array.isArray(source.foreignMembers) && typeof source.foreign === 'boolean'
    && typeof source.foreignObjectCount === 'number' && typeof source.buildingModel === 'boolean'
    && (source.lineEnding === '\n' || source.lineEnding === '\r\n') && (source.opened === undefined || isRecord(source.opened));
}

/** Een fout van een bekende soort, met tekst, naam en velden. Anders: een transportfout. */
export function wireErrorFits(error: unknown): error is IfcSaveWireError {
  return isRecord(error) && typeof error.type === 'string' && Object.hasOwn(CONTENT_ERRORS, error.type)
    && typeof error.name === 'string' && typeof error.message === 'string' && isRecord(error.data)
    && (error.stack === undefined || typeof error.stack === 'string');
}

/** De uitkomst aan de kant van de aanroeper: dezelfde `IfcOutput` als `prepareIfcOutput` op deze thread. */
export function outputFromResult(job: IfcSaveJob, result: IfcSaveResult): IfcOutput {
  // Alleen na `resultFits`: een writerantwoord hoort dan bij een writerverzoek.
  if (result.kind === 'writer') return writerOutput(result.bytes, result.literalCalendarIds);
  if (job.kind !== 'merge') throw new Error('Opslagworker: een merge-antwoord op een writer-verzoek.');
  if (result.kind === 'merge-unchanged') {
    const { source } = job;
    return { prepared: { bytes: source.bytes, sha256: source.sha256, source, literalCalendarIds: result.literalCalendarIds },
      literalCalendarIds: result.literalCalendarIds };
  }
  // De schrijfinvoer achter de nieuwe bron is op de hoofdthread net zo diep bevroren als na `prepareIfcWrite`.
  if (result.prepared.source.opened) freeze(result.prepared.source.opened, true);
  return { prepared: result.prepared, literalCalendarIds: result.prepared.literalCalendarIds };
}

/** De gewone writer: de bytes zoals ze zijn; de tekst pas als een route erom vraagt, en dan één keer. */
function writerOutput(bytes: Uint8Array, literalCalendarIds: readonly string[]): IfcOutput {
  let content: string | undefined;
  return { bytes, literalCalendarIds, get content() { return content ??= new TextDecoder().decode(bytes); } };
}

export function wireError(error: unknown): IfcSaveWireError {
  if (!(error instanceof Error)) return { type: 'Error', name: 'Error', message: String(error), data: {} };
  const type = (Object.keys(CONTENT_ERRORS) as ContentErrorType[]).find(key => error instanceof CONTENT_ERRORS[key])!;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(error)) if (key !== 'name' && key !== 'message' && key !== 'stack') data[key] = value;
  return { type, name: error.name, message: error.message, ...(error.stack ? { stack: error.stack } : {}), data };
}

/** Dezelfde foutsoort (`instanceof` werkt) met dezelfde velden, zonder de constructor opnieuw te laten rekenen. */
export function errorFromWire(wire: IfcSaveWireError): Error {
  const error = Object.create(CONTENT_ERRORS[wire.type].prototype) as Error;
  Object.defineProperty(error, 'message', { value: wire.message, writable: true, configurable: true });
  Object.assign(error, wire.data);
  if (error.name !== wire.name) Object.defineProperty(error, 'name', { value: wire.name, writable: true, configurable: true, enumerable: true });
  if (wire.stack) Object.defineProperty(error, 'stack', { value: wire.stack, writable: true, configurable: true });
  return error;
}
