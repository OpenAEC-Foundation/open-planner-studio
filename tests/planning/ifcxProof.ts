import { isDeepStrictEqual } from 'node:util';
import { readIFC } from '@/services/ifc/ifcReader';
import { ifcGuid128, ifcObjectSeed, writeIFC, type IfcObjectKind, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';
import { readIfcx, writeIfcx, type IfcxImportResult } from '@/services/ifc/ifcx';
import { selfCheckDifferences } from '@/services/ifc/ifcx/selfCheck';
import { ownFileFor } from '@/services/ifc/ifcx/ownFile';
import { serializeIfcx } from '@/services/ifc/ifcx/projection';
import type { ImportResult } from '@/services/importTypes';
import { syncProjectCalendar } from '@/state/syncProjectCalendar';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import { payloadFromImport } from '@/state/documentContract';

export const CLOCK = new Date('2026-11-24T08:00:00.000Z');

export const encode = (text: string) => new TextEncoder().encode(text);

export function stepRoundtrip(input: WriteIFCInput): ImportResult {
  const { createdAt, modifiedAt } = input.project;
  return readIFC(writeIFC(input), {}, { projectTimestampFallback: { createdAt, modifiedAt } });
}

export function stepGlobalId(kind: IfcObjectKind, id: string, projectId: string): string {
  const seed = ifcObjectSeed(kind, id);
  return ifcGuid128(kind === 'cal' && id === DEFAULT_CALENDAR_ID ? `${seed}@${projectId}` : seed);
}

export function stepReopened(input: WriteIFCInput): ImportResult {
  const step = stepRoundtrip(input);
  const ifcGlobalIds: Record<string, string> = { ...step.ifcGlobalIds };
  const objects: [IfcObjectKind, string][] = [
    ['proj', step.project.id], ['wp', step.project.id], ['ws', step.project.id],
    ...[step.calendar, ...(step.resourceCalendars ?? [])].map(calendar => ['cal', calendar.id] as [IfcObjectKind, string]),
    ...step.tasks.map(task => ['task', task.id] as [IfcObjectKind, string]),
    ...step.sequences.map(sequence => ['seq', sequence.id] as [IfcObjectKind, string]),
  ];
  for (const [kind, id] of objects) {
    const seed = ifcObjectSeed(kind, id);
    if (!ifcGlobalIds[seed]) ifcGlobalIds[seed] = stepGlobalId(kind, id, step.project.id);
  }
  const recordedFields = Object.fromEntries(step.tasks.map(task => {
    const kept = step.recordedFields?.[task.id] ?? [];
    const named = input.recordedFields?.[task.id];
    return [task.id, named === undefined ? kept : kept.filter(key => named.includes(key))];
  }));
  return { ...step, ifcGlobalIds, recordedFields };
}

export function openedAsStep(input: WriteIFCInput): IfcxImportResult {
  const reading = stepReopened(input);
  const { writeMode, minuteModelPending, ...loaded } = buildWriteIFCInput(payloadFromImport(structuredClone(reading), null), 'planOnly');
  const { milestonesAtDayEnd, ...facts } = reading;
  return { ...facts, ...loaded, ...(minuteModelPending ? { minuteModelPending } : {}), recordedFields: reading.recordedFields };
}

export function comparableModel(value: unknown): unknown {
  if (Object.is(value, -0)) return 0;
  if (value instanceof Set || value instanceof Map) return [...value].map(comparableModel);
  if (Array.isArray(value)) return value.map(comparableModel);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, comparableModel(item)]));
  }
  return value;
}

export function modelDifferences(expected: ImportResult, actual: ImportResult, limit = 5): string[] {
  const left = comparableModel(expected), right = comparableModel(actual);
  if (isDeepStrictEqual(left, right)) return [];
  const named = selfCheckDifferences(left as ImportResult, right as ImportResult, limit);
  return named.length > 0 ? named : ['een verschil zonder pad'];
}

export const projectionOf = (model: ImportResult, writtenAt: Date) => serializeIfcx(ownFileFor(model, writtenAt).document);

export const timestampOf = (text: string) => new Date(String(documentOf(text).header.timestamp));

export function documentOf(text: string): { header: Record<string, unknown>; imports: unknown[]; schemas: Record<string, unknown>; data: { path: string; attributes: Record<string, Record<string, unknown>> }[] } {
  return JSON.parse(text);
}

export type Attempt<T> = { ok: true; value: T } | { ok: false; error: unknown };

export function attempt<T>(action: () => T): Attempt<T> {
  try { return { ok: true, value: action() }; } catch (error) { return { ok: false, error }; }
}

export function publicRouteProblems(name: string, input: WriteIFCInput, text: string): string[] {
  const back = attempt(() => readIfcx(encode(text)));
  if (!back.ok) return [`${name}: opent niet: ${String(back.error).slice(0, 200)}`];
  const problems: string[] = [];
  const first = openedAsStep(input);
  const once = modelDifferences(first, back.value, 3);
  if (once.length > 0) problems.push(`${name}: deel 1: niet de eerste STEP-lezing na de laadgrens: ${once.join('; ')}`);
  if (projectionOf(back.value, timestampOf(text)) !== text) problems.push(`${name}: deel 2: het bestand is niet de projectie van de gelezen planning`);
  const again = attempt(() => writeIfcx(back.value, CLOCK));
  if (!again.ok) return [...problems, `${name}: de tweede opslag weigert: ${String(again.error).slice(0, 200)}`];
  const twice = attempt(() => readIfcx(encode(again.value)));
  if (!twice.ok) return [...problems, `${name}: de tweede opslag opent niet: ${String(twice.error).slice(0, 200)}`];
  const second = modelDifferences(openedAsStep(first), twice.value, 3);
  if (second.length > 0) problems.push(`${name}: tweede opslag: niet de tweede STEP-lezing na de laadgrens: ${second.join('; ')}`);
  if (projectionOf(twice.value, CLOCK) !== again.value) problems.push(`${name}: deel 2 bij de tweede opslag: het bestand is niet de projectie van de gelezen planning`);
  return problems;
}

export function saveInputViaApp(result: ImportResult): WriteIFCInput {
  const source = {
    ...result, calendars: [...(result.resourceCalendars ?? [])], minuteModelPending: false,
    ifcGlobalIds: result.ifcGlobalIds ?? null, ifcLiteralCalendarIds: null, ifcSource: null,
    activityCodeTypes: result.activityCodeTypes ?? [], customFieldDefs: result.customFieldDefs ?? [],
    customTaskTypes: result.customTaskTypes ?? [], baselines: result.baselines ?? [], activeBaselineId: result.activeBaselineId ?? null,
    comparedBaselineIds: result.comparedBaselineIds ?? [null, null],
  } as unknown as IFCSaveSource;
  syncProjectCalendar(source);
  return buildWriteIFCInput(source, 'planOnly');
}

export function withoutResourceData(full: ImportResult): ImportResult {
  const { baselineOrphanGuids, ...rest } = full;
  return {
    ...rest, resources: [], assignments: [], baselines: [], activeBaselineId: null, comparedBaselineIds: [null, null],
    tasks: full.tasks.map(({ timephasedContours, ...task }) => ({ ...task, resourceIds: [] })),
  };
}
