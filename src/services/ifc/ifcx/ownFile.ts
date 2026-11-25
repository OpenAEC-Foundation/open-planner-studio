import type { WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { buildWriteIFCInput, documentDataFromImport } from '@/services/documentData';
import { checkValue } from './fieldTable';
import { identityProblems, intendedGlobalIds, type GlobalIdOfObject, type PlanningModel } from './identity';
import { HEADER_VALUE } from './ownAttributes';
import { attributeValueProblem } from './schemaCheck';
import { unsupportedContent } from './unsupportedContent';
import { stepRoundtrip } from './stepRoundtrip';
import { IfcxWriteRefusedError, type IfcxErrorPlace } from './ifcxErrors';
import { PLANNING_NAMESPACE, type IfcxAttributeName } from './profile';
import { composeIfcxDocument, globalIdsOf, objectLabels, type IfcxDocument } from './projection';

export type CanonicalPlanning = ImportResult & Pick<WriteIFCInput, 'minuteModelPending'>;

export interface OwnFile {
  readonly planning: ImportResult;
  readonly document: IfcxDocument;
  readonly assertAttributeValues: () => void;
}

type Composed = Omit<OwnFile, 'planning'>;

function refused(code: 'unsupported' | 'inconsistent' | 'invalid', details: readonly string[], fields: readonly string[],
  place?: IfcxErrorPlace): IfcxWriteRefusedError {
  return new IfcxWriteRefusedError(code, details.join('; '), [...new Set(fields)], place);
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
        return refused('invalid', [`${object}: ${name}: ${problem.detail}`], [`${name}.${problem.place.field ?? ''}`], problem.place);
      }
    }
  }
  return undefined;
}

function reopened(given: WriteIFCInput): ImportResult {
  let step: ImportResult;
  try {
    step = stepRoundtrip(given);
  } catch (error) {
    throw refused('invalid', [`Opslaan als IFC weigert deze planning: ${messageOf(error)}`], ['planning']);
  }
  const ifcGlobalIds: Record<string, string> = { ...step.ifcGlobalIds };
  for (const [seed, globalId] of intendedGlobalIds(step)) if (!ifcGlobalIds[seed]) ifcGlobalIds[seed] = globalId;
  const recordedFields = Object.fromEntries(step.tasks.map(task => {
    const kept = step.recordedFields?.[task.id] ?? [];
    const named = given.recordedFields?.[task.id];
    return [task.id, named === undefined ? kept : kept.filter(key => named.includes(key))];
  }));
  return { ...step, ifcGlobalIds, recordedFields };
}

function checkedReading(given: WriteIFCInput): ImportResult {
  const identity = identityProblems(given, globalIdsOf(given));
  if (identity.length > 0) throw refused('inconsistent', identity.map(item => item.detail), identity.map(item => item.field));
  return reopened(given);
}

export function canonicalPlanning(reading: ImportResult): CanonicalPlanning {
  const { writeMode, minuteModelPending, ...loaded } = buildWriteIFCInput(documentDataFromImport(structuredClone(reading)), 'planOnly');
  const { milestonesAtDayEnd, ...hintsLeft } = reading;
  return { ...hintsLeft, ...loaded, ...(minuteModelPending ? { minuteModelPending } : {}), recordedFields: reading.recordedFields };
}

export function canonicalFor(given: WriteIFCInput): CanonicalPlanning {
  return canonicalPlanning(checkedReading(given));
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

export function ownFileFor(given: WriteIFCInput, writtenAt: Date, attributeValues: 'checked' | 'deferred' = 'checked'): OwnFile {
  const planning = checkedReading(given);
  const unsupported = unsupportedContent(planning);
  if (unsupported.length > 0) {
    const named = unsupported.map(item => (item.objects.length > 0 ? `${item.field} (${item.objects.join(', ')})` : item.field));
    throw new IfcxWriteRefusedError('unsupported', `IFCX draagt deze gegevens nog niet: ${named.join(', ')}`, unsupported.map(item => item.field));
  }
  const composed = composedFor(planning, writtenAt, globalIdsOf(planning));
  if (attributeValues === 'checked') composed.assertAttributeValues();
  return { planning, ...composed };
}
