import { readIFC } from '../ifcReader';
import { ifcObjectSeed, writeIFC, type WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { baselineStart } from '@/types/baseline';
import { buildWriteIFCInput, documentDataFromImport } from '@/services/documentData';
import { intendedGlobalIds, type PlanningModel } from './identity';
import { stepAssignmentIds } from '../assignmentKeys';
import { selfCheckDifferences } from './selfCheck';
import { unsupportedContent } from './unsupportedContent';
import { IfcxWriteRefusedError } from './ifcxErrors';
import { readIfcx } from './ifcxReader';
import { assertIdentity, ownFileFor, type CanonicalPlanning } from './ownFile';
import { serializeIfcx } from './projection';
import { savedModelReferences, type IfcxModelReferences } from './modelReferences';

export type { IfcxDocument, IfcxEntry, IfcxHeader } from './projection';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function assignmentIds(model: PlanningModel): string[] {
  const globalIds = intendedGlobalIds(model);
  return stepAssignmentIds(model.assignments ?? [], id => globalIds.get(ifcObjectSeed('res', id))!);
}

function stepReading(given: WriteIFCInput & IfcxModelReferences): ImportResult {
  const { createdAt, modifiedAt } = given.project;
  let read: ImportResult;
  try {
    read = readIFC(writeIFC(given), {}, { projectTimestampFallback: { createdAt, modifiedAt } });
  } catch (error) {
    throw new IfcxWriteRefusedError('invalid', `Opslaan als IFC weigert deze planning: ${messageOf(error)}`, ['planning']);
  }
  const ids = assignmentIds(read);
  const step = { ...read, assignments: read.assignments.map((a, i) => ({ ...a, id: ids[i] })) };
  const ifcGlobalIds: Record<string, string> = { ...step.ifcGlobalIds };
  if (given.modelSource && given.ifcGlobalIds) {
    const inputIds = given.ifcGlobalIds;
    assignmentIds(given).forEach((canonical, index) => {
      const guid = inputIds[ifcObjectSeed('asgn', given.assignments![index].id)];
      if (guid) ifcGlobalIds[ifcObjectSeed('asgn', canonical)] = guid;
    });
    for (const baseline of step.baselines ?? []) {
      const seed = ifcObjectSeed('bl', baseline.id);
      if (inputIds[seed]) ifcGlobalIds[seed] = inputIds[seed];
    }
  }
  for (const [seed, globalId] of intendedGlobalIds(step)) if (!ifcGlobalIds[seed]) ifcGlobalIds[seed] = globalId;
  const recordedFields = Object.fromEntries(step.tasks.map(task => {
    const kept = step.recordedFields?.[task.id] ?? [];
    const named = given.recordedFields?.[task.id];
    return [task.id, named === undefined ? kept : kept.filter(key => named.includes(key))];
  }));
  return { ...step, ifcGlobalIds, recordedFields };
}

export function filePlanning(given: WriteIFCInput & IfcxModelReferences): CanonicalPlanning & IfcxModelReferences {
  assertIdentity(given);
  const reading = stepReading(given);
  delete reading.project.ifcSchemaUnconfirmed;
  const { writeMode, minuteModelPending, ...loaded } = buildWriteIFCInput(documentDataFromImport(structuredClone(reading)), 'planOnly');
  const { milestonesAtDayEnd, ...hintsLeft } = reading;
  const planning: CanonicalPlanning = { ...hintsLeft, ...loaded, ...(minuteModelPending ? { minuteModelPending } : {}), recordedFields: reading.recordedFields };
  const unsupported = unsupportedContent(planning);
  if (unsupported.length > 0) {
    const named = unsupported.map(item => (item.objects.length > 0 ? `${item.field} (${item.objects.join(', ')})` : item.field));
    throw new IfcxWriteRefusedError('unsupported', `IFCX draagt deze gegevens nog niet: ${named.join(', ')}`, unsupported.map(item => item.field));
  }
  const paths = Object.fromEntries(Object.values(planning.ifcGlobalIds ?? {}).flatMap(guid =>
    given.sourcePaths?.[guid] === undefined ? [] : [[guid, given.sourcePaths[guid]]]));
  const baselineStarts = Object.fromEntries((planning.baselines ?? []).flatMap(baseline => {
    const start = given.baselineStarts?.[baseline.id];
    return start && !baselineStart(baseline) ? [[baseline.id, start]] : [];
  }));
  return { ...planning, ...savedModelReferences(given, given.tasks), ...(Object.keys(paths).length ? { sourcePaths: paths } : {}),
    ...(Object.keys(baselineStarts).length ? { baselineStarts } : {}) };
}

export function writeIfcx(given: WriteIFCInput & IfcxModelReferences, writtenAt: Date = new Date()): string {
  const planning = filePlanning(given);
  const text = serializeIfcx(ownFileFor(planning, writtenAt).document);
  let reread;
  try {
    reread = readIfcx(new TextEncoder().encode(text));
  } catch (error) {
    throw new IfcxWriteRefusedError('self-check', `De eigen lezer opent de IFCX-uitvoer niet: ${messageOf(error)}`);
  }
  const differences = selfCheckDifferences(planning, reread);
  if (differences.length > 0) {
    throw new IfcxWriteRefusedError('self-check', `De IFCX-uitvoer geeft een andere planning: ${differences.join('; ')}`,
      differences.map(difference => difference.slice(0, difference.indexOf(': '))));
  }
  return text;
}
