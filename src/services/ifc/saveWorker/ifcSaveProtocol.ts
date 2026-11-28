import { freeze } from 'immer';
import { IfcCalendarTimePrecisionError, IfcParseError } from '@/services/ifc/ifcErrors';
import { MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { StepScanError } from '@/services/ifc/foreign/stepScanner';
import { IfcxWriteRefusedError } from '@/services/ifc/ifcx/ifcxErrors';
import type { IfcxClassification } from '@/services/ifc/ifcx';
import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { isDetached } from '@/services/ifc/foreign/detached';
import { isSourceSlots } from '@/services/ifc/foreign/sourceSlots';
import { precomputeSha256, XerSourceArchiveValidationError } from '@/services/xerSourceArchive';
import { computeIfcOutputHere, type IfcOutput, type IfcSaveJob } from '@/state/prepareIfcOutput';

export type IfcSaveRequest = { readonly id: number; readonly job: IfcSaveJob };
export type IfcxClassifyRequest = { readonly id: number; readonly classify: Uint8Array };
export type IfcSaveWorkerRequest = IfcSaveRequest | IfcxClassifyRequest;
export type IfcSaveRequestBody = { readonly job: IfcSaveJob } | { readonly classify: Uint8Array };

export type IfcSaveResult =
  | { readonly kind: 'writer'; readonly bytes: Uint8Array; readonly literalCalendarIds: readonly string[]; readonly sha256?: string }
  | { readonly kind: 'merge'; readonly prepared: PreparedIfcWrite }
  | { readonly kind: 'merge-unchanged'; readonly literalCalendarIds: readonly string[] };

export type IfcSaveResponse =
  | { readonly started: true }
  | { readonly id: number; readonly result: IfcSaveResult }
  | { readonly id: number; readonly classification: IfcxClassification }
  | { readonly id: number; readonly error: IfcSaveWireError };

const CONTENT_ERRORS = {
  MergeNeedsPhase2Error, IfcCalendarTimePrecisionError, StepScanError, IfcParseError, XerSourceArchiveValidationError,
  IfcxWriteRefusedError, TypeError, RangeError, Error,
} as const;
type ContentErrorType = keyof typeof CONTENT_ERRORS;

export interface IfcSaveWireError {
  readonly type: ContentErrorType;
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export async function runIfcSaveJob(job: IfcSaveJob): Promise<IfcSaveResult> {
  const output = await computeIfcOutputHere(job);
  if (!output.prepared) {
    const writer = { kind: 'writer', bytes: new TextEncoder().encode(output.content), literalCalendarIds: output.literalCalendarIds } as const;
    return job.kind === 'writer' && job.hashBytes ? { ...writer, sha256: await precomputeSha256(writer.bytes) } : writer;
  }
  if (job.kind === 'merge' && output.prepared.source === job.source) {
    return { kind: 'merge-unchanged', literalCalendarIds: output.prepared.literalCalendarIds };
  }
  return { kind: 'merge', prepared: output.prepared };
}

export function resultTransfer(result: IfcSaveResult): ArrayBuffer[] {
  if (result.kind === 'merge-unchanged') return [];
  const references = result.kind === 'merge' ? result.prepared.source.foreignReferences : undefined;
  const changes = result.kind === 'merge' ? result.prepared.foreignChanges ?? [] : [];
  const views = result.kind === 'writer' ? [result.bytes] : [result.prepared.bytes, result.prepared.source.bytes,
    result.prepared.source.chunkStarts, result.prepared.source.chunkIds, result.prepared.source.classes,
    ...(references ? [references.stepIds, references.groupStart, references.groupSize, references.targetStart, references.targets] : []),
    ...changes.flatMap(change => change.kind === 'gewijzigd' ? [change.oldBytes, change.newBytes] : change.kind === 'teruggezet' ? [change.newBytes] : [change.oldBytes]),
    ...(result.kind === 'merge' ? [...result.prepared.source.detached?.pieces.values() ?? []].map(piece => piece.bytes) : [])];
  return [...new Set(views.map(view => view.buffer as ArrayBuffer))];
}

export async function handleIfcSaveRequest(request: IfcSaveWorkerRequest): Promise<{ response: IfcSaveResponse; transfer: ArrayBuffer[] }> {
  try {
    if ('classify' in request) {
      const { classifyIfcx } = await import('@/services/ifc/ifcx/ifcxReader');
      return { response: { id: request.id, classification: classifyIfcx(request.classify) }, transfer: [] };
    }
    const result = await runIfcSaveJob(request.job);
    return { response: { id: request.id, result }, transfer: resultTransfer(result) };
  } catch (error) {
    return { response: { id: request.id, error: wireError(error) }, transfer: [] };
  }
}

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isElementLink = (value: unknown): boolean => isRecord(value) && (value.direction === 'input' || value.direction === 'output')
  && typeof value.target === 'string' && typeof value.found === 'boolean';
const isElementLinkMap = (value: unknown): boolean => value instanceof Map
  && [...value].every(([taskId, links]) => typeof taskId === 'string' && Array.isArray(links) && links.every(isElementLink));

export function resultFits(job: IfcSaveJob, result: unknown): result is IfcSaveResult {
  if (!isRecord(result)) return false;
  if (result.kind === 'writer') return job.kind === 'writer' && result.bytes instanceof Uint8Array && isStringList(result.literalCalendarIds)
    && (job.hashBytes ? typeof result.sha256 === 'string' : result.sha256 === undefined);
  if (job.kind !== 'merge') return false;
  if (result.kind === 'merge-unchanged') return isStringList(result.literalCalendarIds);
  if (result.kind !== 'merge' || !isRecord(result.prepared)) return false;
  const { bytes, sha256, source, literalCalendarIds } = result.prepared;
  return bytes instanceof Uint8Array && typeof sha256 === 'string' && isStringList(literalCalendarIds) && isRecord(source)
    && source.bytes === bytes && source.sha256 === sha256 && typeof source.schemaName === 'string'
    && source.chunkStarts instanceof Uint32Array && source.chunkIds instanceof Int32Array && source.classes instanceof Uint8Array
    && isRecord(source.stepIds) && Array.isArray(source.foreignMembers) && isElementLinkMap(source.elementLinks)
    && (source.foreign === true ? isSourceSlots(source.sourceSlots) : source.sourceSlots === undefined)
    && (source.detached === undefined || (source.foreign === true && isDetached(source.detached, isSourceSlots)))
    && typeof source.foreign === 'boolean'
    && typeof source.foreignObjectCount === 'number' && typeof source.buildingModel === 'boolean'
    && (source.lineEnding === '\n' || source.lineEnding === '\r\n') && (source.opened === undefined || isRecord(source.opened));
}

const IFCX_CLASSIFICATIONS: readonly unknown[] = ['own', 'foreign', 'not-ifcx', 'unreadable'] satisfies readonly IfcxClassification[];
export const classificationFits = (value: unknown): value is IfcxClassification => IFCX_CLASSIFICATIONS.includes(value);

export function wireErrorFits(error: unknown): error is IfcSaveWireError {
  return isRecord(error) && typeof error.type === 'string' && Object.prototype.hasOwnProperty.call(CONTENT_ERRORS, error.type)
    && typeof error.name === 'string' && typeof error.message === 'string' && isRecord(error.data)
    && (error.stack === undefined || typeof error.stack === 'string');
}

export function outputFromResult(job: IfcSaveJob, result: IfcSaveResult): IfcOutput {
  if (result.kind === 'writer') return writerOutput(result.bytes, result.literalCalendarIds, result.sha256);
  if (job.kind !== 'merge') throw new Error('Opslagworker: een merge-antwoord op een writer-verzoek.');
  if (result.kind === 'merge-unchanged') {
    const { source } = job;
    return { prepared: { bytes: source.bytes, sha256: source.sha256, source, literalCalendarIds: result.literalCalendarIds },
      literalCalendarIds: result.literalCalendarIds };
  }
  if (result.prepared.source.opened) freeze(result.prepared.source.opened, true);
  return { prepared: result.prepared, literalCalendarIds: result.prepared.literalCalendarIds };
}

export function writerOutput(bytes: Uint8Array, literalCalendarIds: readonly string[], sha256: string | undefined): Extract<IfcOutput, { readonly content: string }> {
  let content: string | undefined;
  return { bytes, literalCalendarIds, ...(sha256 === undefined ? {} : { sha256 }), get content() { return content ??= new TextDecoder().decode(bytes); } };
}

export function wireError(error: unknown): IfcSaveWireError {
  if (!(error instanceof Error)) return { type: 'Error', name: 'Error', message: String(error), data: {} };
  const type = (Object.keys(CONTENT_ERRORS) as ContentErrorType[]).find(key => error instanceof CONTENT_ERRORS[key])!;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(error)) if (key !== 'name' && key !== 'message' && key !== 'stack') data[key] = value;
  return { type, name: error.name, message: error.message, ...(error.stack ? { stack: error.stack } : {}), data };
}

export function errorFromWire(wire: IfcSaveWireError): Error {
  const error = Object.create(CONTENT_ERRORS[wire.type].prototype) as Error;
  Object.defineProperty(error, 'message', { value: wire.message, writable: true, configurable: true });
  Object.assign(error, wire.data);
  if (error.name !== wire.name) Object.defineProperty(error, 'name', { value: wire.name, writable: true, configurable: true, enumerable: true });
  if (wire.stack) Object.defineProperty(error, 'stack', { value: wire.stack, writable: true, configurable: true });
  return error;
}
