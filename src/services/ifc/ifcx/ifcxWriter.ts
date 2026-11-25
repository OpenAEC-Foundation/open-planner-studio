import { readIFC } from '../ifcReader';
import { writeIFC, type WriteIFCInput } from '../ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import type { ResourceAssignment } from '@/types/resource';
import { payloadFromImport } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { intendedGlobalIds } from './identity';
import { selfCheckDifferences } from './selfCheck';
import { unsupportedContent } from './unsupportedContent';
import { IfcxWriteRefusedError } from './ifcxErrors';
import { readIfcx } from './ifcxReader';
import { assertIdentity, ownFileFor, type CanonicalPlanning } from './ownFile';
import { serializeIfcx } from './projection';

export type { IfcxDocument, IfcxEntry, IfcxHeader } from './projection';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function withStepAssignmentIds(assignments: readonly ResourceAssignment[]): ResourceAssignment[] {
  const counts = new Map<string, number>();
  return assignments.map(assignment => {
    const index = counts.get(assignment.taskId) ?? 0;
    counts.set(assignment.taskId, index + 1);
    return { ...assignment, id: `asgn-${assignment.taskId}#${index}` };
  });
}

function stepReading(given: WriteIFCInput): ImportResult {
  const { createdAt, modifiedAt } = given.project;
  let read: ImportResult;
  try {
    read = readIFC(writeIFC(given), {}, { projectTimestampFallback: { createdAt, modifiedAt } });
  } catch (error) {
    throw new IfcxWriteRefusedError('invalid', `Opslaan als IFC weigert deze planning: ${messageOf(error)}`, ['planning']);
  }
  const step = { ...read, assignments: withStepAssignmentIds(read.assignments) };
  const ifcGlobalIds: Record<string, string> = { ...step.ifcGlobalIds };
  for (const [seed, globalId] of intendedGlobalIds(step)) if (!ifcGlobalIds[seed]) ifcGlobalIds[seed] = globalId;
  const recordedFields = Object.fromEntries(step.tasks.map(task => {
    const kept = step.recordedFields?.[task.id] ?? [];
    const named = given.recordedFields?.[task.id];
    return [task.id, named === undefined ? kept : kept.filter(key => named.includes(key))];
  }));
  return { ...step, ifcGlobalIds, recordedFields };
}

export function filePlanning(given: WriteIFCInput): CanonicalPlanning {
  assertIdentity(given);
  const reading = stepReading(given);
  const { writeMode, minuteModelPending, ...loaded } = buildWriteIFCInput(payloadFromImport(structuredClone(reading), null), 'planOnly');
  const { milestonesAtDayEnd, ...hintsLeft } = reading;
  const planning: CanonicalPlanning = { ...hintsLeft, ...loaded, ...(minuteModelPending ? { minuteModelPending } : {}), recordedFields: reading.recordedFields };
  const unsupported = unsupportedContent(planning);
  if (unsupported.length > 0) {
    const named = unsupported.map(item => (item.objects.length > 0 ? `${item.field} (${item.objects.join(', ')})` : item.field));
    throw new IfcxWriteRefusedError('unsupported', `IFCX draagt deze gegevens nog niet: ${named.join(', ')}`, unsupported.map(item => item.field));
  }
  return planning;
}

export function writeIfcx(given: WriteIFCInput, writtenAt: Date = new Date()): string {
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
