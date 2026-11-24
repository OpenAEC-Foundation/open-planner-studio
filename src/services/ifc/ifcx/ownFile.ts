import type { WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { payloadFromImport } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { checkValue } from './fieldTable';
import { identityProblems, intendedGlobalIds, type GlobalIdOfObject, type PlanningModel } from './identity';
import { HEADER_VALUE } from './ownAttributes';
import { attributeValueProblem } from './schemaCheck';
import { unsupportedContent } from './unsupportedContent';
import { stepRoundtrip } from './stepRoundtrip';
import { recordedFieldsOf } from './recordedFields';
import { IfcxWriteRefusedError } from './ifcxErrors';
import { PLANNING_NAMESPACE, type IfcxAttributeName } from './profile';
import { composeIfcxDocument, globalIdsOf, objectLabels, type IfcxDocument } from './projection';

export interface OwnFile {
  readonly planning: ImportResult;
  readonly document: IfcxDocument;
  readonly assertAttributeValues: () => void;
}

type Composed = Omit<OwnFile, 'planning'>;

function refused(code: 'unsupported' | 'inconsistent' | 'invalid', details: readonly string[], fields: readonly string[]): IfcxWriteRefusedError {
  return new IfcxWriteRefusedError(code, details.join('; '), [...new Set(fields)]);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const isSharedAttribute = (name: string) => name.startsWith(PLANNING_NAMESPACE);

function invalidAttributesIn(document: IfcxDocument, objectAt: () => Map<string, string>): IfcxWriteRefusedError | undefined {
  for (const entry of document.data) {
    const attributes = Object.entries(entry.attributes) as [IfcxAttributeName, Record<string, unknown>][];
    for (const [name, value] of [...attributes.filter(([name]) => !isSharedAttribute(name)), ...attributes.filter(([name]) => isSharedAttribute(name))]) {
      const problem = attributeValueProblem(entry.path, name, value);
      if (problem) {
        const object = objectAt().get(entry.path) ?? entry.path;
        return refused('invalid', [`${object}: ${name}: ${problem.detail}`], [`${name}.${problem.place.field ?? ''}`]);
      }
    }
  }
  return undefined;
}

function asReopened(planning: ImportResult): ImportResult {
  const ifcGlobalIds: Record<string, string> = { ...planning.ifcGlobalIds };
  for (const [seed, globalId] of intendedGlobalIds(planning)) if (!ifcGlobalIds[seed]) ifcGlobalIds[seed] = globalId;
  const recordedFields = Object.fromEntries(planning.tasks.map(task => [task.id, recordedFieldsOf(task)]));
  return { ...planning, ifcGlobalIds, recordedFields };
}

function composedFor(planning: PlanningModel, writtenAt: Date, globalIdOf: GlobalIdOfObject): Composed {
  if (Number.isNaN(writtenAt.getTime())) throw refused('invalid', ['Het moment van schrijven is geen geldige datum'], ['header.timestamp']);
  let document: IfcxDocument;
  try {
    document = composeIfcxDocument(planning, writtenAt, globalIdOf);
  } catch (error) {
    if (error instanceof IfcxWriteRefusedError) throw error;
    throw refused('invalid', [`De planning heeft een vorm die de writer niet kan schrijven: ${messageOf(error)}`], ['planning']);
  }
  const header = checkValue(HEADER_VALUE, document.header);
  if (header) throw refused('invalid', [`Ongeldige kop: ${header.kind === 'invalid' ? header.detail : 'onbekend veld'}`], [`header.${header.field}`]);
  let labels: Map<string, string> | undefined;
  const assertAttributeValues = () => {
    const invalid = invalidAttributesIn(document, () => (labels ??= objectLabels(planning, globalIdOf)));
    if (invalid) throw invalid;
  };
  return { document, assertAttributeValues };
}

export function documentFor(planning: PlanningModel, writtenAt: Date, globalIdOf: GlobalIdOfObject = globalIdsOf(planning)): IfcxDocument {
  const composed = composedFor(planning, writtenAt, globalIdOf);
  composed.assertAttributeValues();
  return composed.document;
}

export function ownFileFor(given: WriteIFCInput, writtenAt: Date, attributeValues: 'checked' | 'deferred' = 'checked'): OwnFile {
  const identity = identityProblems(given, globalIdsOf(given));
  if (identity.length > 0) throw refused('inconsistent', identity.map(item => item.detail), identity.map(item => item.field));
  let planning: ImportResult;
  try {
    planning = asReopened(stepRoundtrip(given));
  } catch (error) {
    throw refused('invalid', [`Opslaan als IFC weigert deze planning: ${messageOf(error)}`], ['planning']);
  }
  const unsupported = unsupportedContent(planning);
  if (unsupported.length > 0) {
    const named = unsupported.map(item => (item.objects.length > 0 ? `${item.field} (${item.objects.join(', ')})` : item.field));
    throw new IfcxWriteRefusedError('unsupported', `IFCX draagt deze gegevens nog niet: ${named.join(', ')}`, unsupported.map(item => item.field));
  }
  const composed = composedFor(planning, writtenAt, globalIdsOf(planning));
  if (attributeValues === 'checked') composed.assertAttributeValues();
  return { planning, ...composed };
}

export function savedAfterOpening(read: ImportResult): WriteIFCInput {
  return buildWriteIFCInput(payloadFromImport(structuredClone(read), null), 'planOnly');
}
