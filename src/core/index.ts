// De headless kern van Open Planner Studio: de publieke ingang van `@openaec/open-planner-core`.
//
// Grens (docs/headless-kern.md): deze module en `api.ts` zijn het hele publieke oppervlak. Alles
// daaronder (store, solver, IFC-lezer/-schrijver) is intern en mag veranderen zonder dat het contract
// verandert. De kern gebruikt GEEN React, geen DOM, geen Tauri en niet de app-singleton
// `appStoreContext`: elk document krijgt een eigen `createAppStoreContext()`, en de berekening loopt
// via dezelfde store-acties als de app (`openAsDocument` → `runCPM`), dus met werkregels en het
// rekenprofiel van het project. `verify:store-boundaries` bewaakt dat hier geen singleton binnenkomt.
import { createAppStoreContext, type AppState } from '@/state/appStoreFactory';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { readIfcBytes } from '@/services/ifc/foreign/ifcBytesRoute';
import { MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { writeIFC } from '@/services/ifc/ifcWriter';
import type { ImportResult } from '@/services/importTypes';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { prepareIfcOutput, type IfcOutput } from '@/state/prepareIfcOutput';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { FeatureFlagValues } from '@/utils/featureFlags';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { scanForeignTargetBytes } from '@/services/ifc/foreign/targetForeignScan';
import type {
  CoreErrorCode, ForeignContentSummary, PlannerDocument, ScheduleSummary, ScheduleTaskSummary, ScheduleWarning,
} from './api';

export type {
  CoreErrorCode, ForeignContentSummary, PlannerDocument, ScheduleSummary, ScheduleTaskSummary, ScheduleWarning,
} from './api';

/** Versie van de kern; gelijk aan de appversie (CalVer). De bouw vervangt de waarde. */
export const VERSION: string = typeof __OPS_CORE_VERSION__ === 'string' ? __OPS_CORE_VERSION__ : '0.0.0-dev';

declare const __OPS_CORE_VERSION__: string | undefined;

/** Het enige fouttype van de kern. `code` is vast (zie `CoreErrorCode`); `message` is Engels en
 *  bedoeld voor mensen, niet om op te parsen. */
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

/** Een STEP-bestand begint (na een eventuele BOM en witruimte) met deze kop. */
const STEP_HEADER = 'ISO-10303-21;';
const STEP_HEADER_BYTES = new TextEncoder().encode(STEP_HEADER);
const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
const ASCII_WHITESPACE: ReadonlySet<number> = new Set([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20]);

const BYTES_ROUTE_FLAGS: FeatureFlagValues = { ifcForeignContent: true };

/**
 * Open een project uit IFC-tekst (IFC 4.3 / IFC4, zoals de app het opslaat of andere pakketten het
 * schrijven). Het document wordt geopend precies zoals Bestand → Openen in de app het doet. Dat
 * openen rekent al door; wijkt de uitkomst af van de datums in het bestand, dan kan de app (net als
 * hier) de datums uit het bestand tonen ("datums zoals opgeslagen"). `toIfc()` direct na `openIfc()`
 * schrijft dus de geopende stand, niet per se de datums uit de invoer. `schedule()` rekent opnieuw
 * door zoals F5 en verlaat die stand. Wat het openen veranderde of weglaat, staat meteen in
 * `openWarnings` (bijv. de omzetting van een oud bestand, B5), dus ook vóór de eerste `toIfc()`.
 */
export async function openIfc(text: string): Promise<PlannerDocument> {
  if (typeof text !== 'string') {
    throw new PlannerCoreError('INVALID_INPUT', 'IFC input must be a string');
  }
  const body = text.replace(/^﻿/, '').trimStart();
  if (!body.startsWith(STEP_HEADER)) {
    throw new PlannerCoreError('INVALID_INPUT', `IFC input must start with "${STEP_HEADER}"`);
  }
  const opened = openParsed(await readOrFail(() => readIFCWithXerReconstruction(body)));
  // T3: deze tekst-API bewaart nog geen vreemde bytes. Rekenen mag, verliesgevende IFC-uitvoer niet.
  const inputScan = scanForeignTargetBytes(new TextEncoder().encode(body));
  const toIfc = (): string => {
    if (inputScan !== 'no-model' && inputScan !== 'not-ifc') {
      throw new PlannerCoreError('IFC_WRITE_FAILED',
        'This IFC contains foreign content or cannot be scanned reliably; writing it without byte preservation is not supported.',
        { reason: inputScan });
    }
    return plainIfc(opened.state());
  };
  return plannerDocument(opened, { toIfc, toIfcBytes: async () => new TextEncoder().encode(toIfc()) });
}

export async function openIfcBytes(bytes: Uint8Array): Promise<PlannerDocument> {
  if (!(bytes instanceof Uint8Array)) {
    throw new PlannerCoreError('INVALID_INPUT', 'IFC input must be a Uint8Array');
  }
  if (!startsWithStepHeader(bytes)) {
    throw new PlannerCoreError('INVALID_INPUT', `IFC input must start with "${STEP_HEADER}"`);
  }
  const ownBytes = new Uint8Array(bytes);
  const opened = openParsed(await readOrFail(() => readIfcBytes(ownBytes, {}, { createWorker: () => null })), BYTES_ROUTE_FLAGS);
  const toIfc = (): string => {
    if (hasForeignContent(opened.state().ifcSource)) {
      throw new PlannerCoreError('IFC_WRITE_FAILED',
        'This document keeps foreign content (a building model or data of another program); write it with toIfcBytes().',
        { reason: 'foreign' });
    }
    return plainIfc(opened.state());
  };
  const toIfcBytes = async (): Promise<Uint8Array> => {
    const s = opened.state();
    let output: IfcOutput;
    try {
      output = await prepareIfcOutput(s, buildWriteIFCInput(s, 'merge'));
    } catch (err) {
      if (err instanceof MergeNeedsPhase2Error) {
        throw new PlannerCoreError('IFC_WRITE_FAILED',
          `The foreign content cannot be preserved with these changes yet: ${err.message}`, { reason: 'merge-needs-phase2' });
      }
      throw new PlannerCoreError('IFC_WRITE_FAILED', `Could not write IFC: ${errorText(err)}`);
    }
    if (output.prepared) return output.prepared.bytes.slice();
    return output.bytes ?? new TextEncoder().encode(output.content);
  };
  return plannerDocument(opened, { toIfc, toIfcBytes });
}

function startsWithStepHeader(bytes: Uint8Array): boolean {
  let at = UTF8_BOM.every((b, i) => bytes[i] === b) ? UTF8_BOM.length : 0;
  while (at < bytes.length && ASCII_WHITESPACE.has(bytes[at])) at++;
  return STEP_HEADER_BYTES.every((b, i) => bytes[at + i] === b);
}

async function readOrFail(read: () => Promise<ImportResult>): Promise<ImportResult> {
  try {
    return await read();
  } catch (err) {
    throw new PlannerCoreError('IFC_READ_FAILED', `Could not read IFC: ${errorText(err)}`);
  }
}

interface OpenedCoreDocument {
  readonly state: () => AppState;
  readonly importWarnings: readonly ScheduleWarning[];
}

function openParsed(parsed: ImportResult, featureFlags?: FeatureFlagValues): OpenedCoreDocument {
  if (parsed.tasks.length === 0) {
    throw new PlannerCoreError('NO_TASKS', 'The IFC file contains no tasks');
  }

  // Een onbruikbaar XER-bronarchief laat de lezer weg; de app meldt dat verlies. Hier wordt het een
  // vaste waarschuwing in elke samenvatting, omdat `toIfc()` het archief niet meer kan meeschrijven.
  const importWarnings: ScheduleWarning[] = parsed.xerArchiveIssue
    ? [{ code: 'XER_ARCHIVE_DROPPED', ids: [], detail: parsed.xerArchiveIssue.code }]
    : [];

  // Een eigen context per document, zonder host-events: extensies van een app bestaan hier niet.
  const ctx = createAppStoreContext({ emitHostEvents: false });
  if (featureFlags) ctx.store.setState(s => { s.ui.featureFlags = { ...featureFlags }; });
  // De open-route van de app (Bestand → Openen) zonder opslagdoel: een naamloos document.
  let opened: ReturnType<AppState['openAsDocument']>;
  try {
    opened = ctx.store.getState().openAsDocument(parsed, { name: 'document.ifc', ref: null, saveTarget: false });
  } catch (err) {
    throw new PlannerCoreError('IFC_READ_FAILED', `Could not open IFC: ${errorText(err)}`);
  }
  // B5: een oud bestand wordt bij het openen omgerekend. De app meldt dat via het meldingenkanaal; de
  // kern heeft er geen, dus dezelfde telling en grootste verschuiving als vaste waarschuwing.
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

function foreignContentOf(source: IfcSource | null): ForeignContentSummary | null {
  if (!source || !hasForeignContent(source)) return null;
  return { format: 'ifc', schema: source.schemaName, objectCount: source.foreignObjectCount };
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
    foreignContent: foreignContentOf(s.ifcSource),
  };
}
