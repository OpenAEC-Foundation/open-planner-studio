import { createAppStoreContext, type AppState } from '@/state/appStoreFactory';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { readIfcBytes } from '@/services/ifc/foreign/ifcBytesRoute';
import { MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { utf8BomLength } from '@/services/ifc/foreign/stepScanner';
import { writeIFC } from '@/services/ifc/ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { prepareIfcOutput, type IfcOutput } from '@/state/prepareIfcOutput';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { FeatureFlagValues } from '@/utils/featureFlags';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { textWriteCheck, type TextWriteRefusal } from '@/services/ifc/foreign/targetForeignScan';
import type {
  CoreErrorCode, ForeignContentSummary, IfcWriteRefusalReason, PlannerDocument, ScheduleSummary, ScheduleTaskSummary,
  ScheduleWarning,
} from './api';

export type {
  CoreErrorCode, ForeignContentSummary, IfcWriteRefusalReason, PlannerDocument, ScheduleSummary, ScheduleTaskSummary,
  ScheduleWarning,
} from './api';

export const VERSION: string = typeof __OPS_CORE_VERSION__ === 'string' ? __OPS_CORE_VERSION__ : '0.0.0-dev';

declare const __OPS_CORE_VERSION__: string | undefined;

export class PlannerCoreError extends Error {
  readonly code: CoreErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(code: CoreErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PlannerCoreError';
    this.code = code;
    this.details = details;
  }
}

const STEP_HEADER = 'ISO-10303-21;';
const STEP_HEADER_BYTES = new TextEncoder().encode(STEP_HEADER);
const ASCII_WHITESPACE: ReadonlySet<number> = new Set([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20]);

const BYTES_ROUTE_FLAGS: FeatureFlagValues = { ifcForeignContent: true };

export async function openIfc(text: string): Promise<PlannerDocument> {
  if (typeof text !== 'string') {
    throw new PlannerCoreError('INVALID_INPUT', 'IFC input must be a string');
  }
  const body = text.replace(/^﻿/, '').trimStart();
  if (!body.startsWith(STEP_HEADER)) {
    throw new PlannerCoreError('INVALID_INPUT', `IFC input must start with "${STEP_HEADER}"`);
  }
  let parsed: Awaited<ReturnType<typeof readIFCWithXerReconstruction>>;
  try {
    parsed = await readIFCWithXerReconstruction(body);
  } catch (err) {
    throw new PlannerCoreError('IFC_READ_FAILED', `Could not read IFC: ${errorText(err)}`);
  }
  const opened = openParsed(parsed);
  const check = textWriteCheck(body);
  const atOpen = opened.state();
  let refusal: TextWriteRefusal | null | undefined = typeof check === 'function' ? undefined : check;
  const toIfc = (): string => {
    if (refusal === undefined && typeof check === 'function') refusal = check(plainIfc(atOpen));
    if (refusal) {
      throw writeRefused(refusal,
        'This IFC contains foreign content or cannot be scanned reliably; writing it without byte preservation is not supported.');
    }
    return plainIfc(opened.state());
  };
  return plannerDocument(opened, { toIfc, toIfcBytes: async () => new TextEncoder().encode(toIfc()) });
}

export async function openIfcBytes(bytes: Uint8Array): Promise<PlannerDocument> {
  if (!(bytes instanceof Uint8Array)) {
    throw new PlannerCoreError('INVALID_INPUT', 'IFC input must be a Uint8Array');
  }
  const ownBytes = new Uint8Array(bytes);
  return await documentKeepingForeignContent(ownBytes)
    ?? openIfc(new TextDecoder('utf-8', { ignoreBOM: true }).decode(ownBytes));
}

async function documentKeepingForeignContent(bytes: Uint8Array): Promise<PlannerDocument | null> {
  if (!startsWithStepHeader(bytes)) return null;
  let opened: OpenedCoreDocument;
  try {
    const parsed = await readIfcBytes(bytes, {}, { createWorker: () => null });
    if (!hasForeignContent(parsed.ifcSource)) return null;
    opened = openParsed(parsed, BYTES_ROUTE_FLAGS);
  } catch {
    return null;
  }
  const toIfc = (): string => {
    throw writeRefused('foreign',
      'This document keeps foreign content (a building model or data of another program); write it with toIfcBytes().');
  };
  const toIfcBytes = async (): Promise<Uint8Array> => {
    const s = opened.state();
    let output: IfcOutput;
    try {
      output = await prepareIfcOutput(s, buildWriteIFCInput(s, 'merge'));
    } catch (err) {
      if (err instanceof MergeNeedsPhase2Error) {
        throw writeRefused('merge-needs-phase2', `The foreign content cannot be preserved with these changes yet: ${err.message}`);
      }
      throw new PlannerCoreError('IFC_WRITE_FAILED', `Could not write IFC: ${errorText(err)}`);
    }
    if (!output.prepared) throw new PlannerCoreError('IFC_WRITE_FAILED', 'Could not write IFC: the foreign content was not merged');
    const keptSource = output.prepared.bytes === s.ifcSource?.bytes;
    return keptSource ? output.prepared.bytes.slice() : output.prepared.bytes;
  };
  return plannerDocument(opened, { toIfc, toIfcBytes });
}

function writeRefused(reason: IfcWriteRefusalReason, message: string): PlannerCoreError {
  return new PlannerCoreError('IFC_WRITE_FAILED', message, { reason });
}

function startsWithStepHeader(bytes: Uint8Array): boolean {
  let at = utf8BomLength(bytes);
  while (at < bytes.length && ASCII_WHITESPACE.has(bytes[at])) at++;
  return STEP_HEADER_BYTES.every((b, i) => bytes[at + i] === b);
}

interface OpenedCoreDocument {
  readonly state: () => AppState;
  readonly importWarnings: readonly ScheduleWarning[];
}

function openParsed(parsed: ImportResult, featureFlags?: FeatureFlagValues): OpenedCoreDocument {
  if (parsed.tasks.length === 0) {
    throw new PlannerCoreError('NO_TASKS', 'The IFC file contains no tasks');
  }

  const importWarnings: ScheduleWarning[] = parsed.xerArchiveIssue
    ? [{ code: 'XER_ARCHIVE_DROPPED', ids: [], detail: parsed.xerArchiveIssue.code }]
    : [];

  const ctx = createAppStoreContext({ emitHostEvents: false });
  if (featureFlags) ctx.store.setState(s => { s.ui.featureFlags = { ...featureFlags }; });
  let opened: ReturnType<AppState['openAsDocument']>;
  try {
    opened = ctx.store.getState().openAsDocument(parsed, { name: 'document.ifc', ref: null, saveTarget: false });
  } catch (err) {
    throw new PlannerCoreError('IFC_READ_FAILED', `Could not open IFC: ${errorText(err)}`);
  }
  for (const conversion of opened.minuteModelConversions) {
    importWarnings.push({ code: 'MINUTE_MODEL_CONVERTED', ids: [...conversion.shifted],
      maxShiftWorkdays: conversion.maxWorkdays });
  }
  return { state: () => ctx.store.getState(), importWarnings };
}

function plainIfc(s: AppState): string {
  try {
    return writeIFC(buildWriteIFCInput(s, 'planOnly'));
  } catch (err) {
    throw new PlannerCoreError('IFC_WRITE_FAILED', `Could not write IFC: ${errorText(err)}`);
  }
}

function plannerDocument(
  opened: OpenedCoreDocument, output: Pick<PlannerDocument, 'toIfc' | 'toIfcBytes'>,
): PlannerDocument {
  const { state, importWarnings } = opened;
  return {
    get openWarnings(): ScheduleWarning[] {
      return importWarnings.map(w => ({ ...w, ids: [...w.ids] }));
    },
    schedule(): ScheduleSummary {
      try {
        state().runCPM();
      } catch (err) {
        throw new PlannerCoreError('SCHEDULE_FAILED', `The schedule cannot be calculated: ${errorText(err)}`, {
          reason: errorText(err),
        });
      }
      const s = state();
      const result = s.cpmResult;
      if (!result || result.error) {
        throw new PlannerCoreError('SCHEDULE_FAILED', `The schedule cannot be calculated: ${result?.error ?? 'no result'}`, {
          reason: result?.error ?? null,
          ...(result?.errorInfo ? { errorCode: result.errorInfo.code } : {}),
          ...(result?.cycleTaskIds ? { taskIds: [...result.cycleTaskIds] } : {}),
        });
      }
      try {
        return summarize(s, result, importWarnings);
      } catch (err) {
        throw new PlannerCoreError('SCHEDULE_FAILED', `The schedule summary failed: ${errorText(err)}`, { reason: errorText(err) });
      }
    },
    toIfc: output.toIfc,
    toIfcBytes: output.toIfcBytes,
  };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function foreignContentOf(source: IfcSource | null): { foreignContent: ForeignContentSummary } | Record<string, never> {
  if (!source || !hasForeignContent(source)) return {};
  return { foreignContent: { format: 'ifc', schema: source.schemaName, objectCount: source.foreignObjectCount } };
}

function summarize(s: AppState, result: CPMResult, importWarnings: readonly ScheduleWarning[]): ScheduleSummary {
  const tasks: ScheduleTaskSummary[] = s.tasks.map(t => ({
    id: t.id,
    name: t.name,
    wbs: t.wbsCode,
    parentId: t.parentId ?? null,
    summary: isSummaryTask(t),
    milestone: t.isMilestone,
    start: t.time.earlyStart,
    finish: t.time.earlyFinish,
    lateStart: t.time.lateStart,
    lateFinish: t.time.lateFinish,
    totalFloat: t.time.totalFloat,
    critical: t.time.isCritical,
  }));
  const warnings: ScheduleWarning[] = importWarnings.map(w => ({ ...w, ids: [...w.ids] }));
  const warn = (code: ScheduleWarning['code'], ids: readonly string[] | undefined) => {
    if (ids && ids.length > 0) warnings.push({ code, ids: [...ids] });
  };
  warn('CONSTRAINT_VIOLATED', result.violatedConstraintTaskIds);
  warn('DEADLINE_MISSED', result.missedDeadlineTaskIds);
  warn('OUT_OF_SEQUENCE', result.outOfSequenceSequenceIds);
  warn('CALENDAR_CAPPED', result.cappedTaskIds);
  warn('RELATION_IGNORED', result.droppedSequenceIds);
  warn('HAMMOCK_WITHOUT_FINISH_DRIVER', result.hammockNoFinishDriverTaskIds);
  return {
    formatVersion: 1,
    project: {
      id: s.project.id,
      name: s.project.name,
      schedulingProfile: s.project.schedulingProfile?.id ?? 'ops',
      start: s.project.startDate,
      finish: result.projectEnd,
      durationWorkdays: result.projectDuration,
    },
    counts: {
      tasks: tasks.length,
      summaryTasks: tasks.filter(t => t.summary).length,
      milestones: tasks.filter(t => t.milestone).length,
      relations: s.sequences.length,
      resources: s.resources.length,
      assignments: s.assignments.length,
      criticalTasks: tasks.filter(t => t.critical).length,
    },
    tasks,
    criticalPath: [...result.criticalPath],
    warnings,
    ...foreignContentOf(s.ifcSource),
  };
}
