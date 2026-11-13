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
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type {
  CoreErrorCode, PlannerDocument, ScheduleSummary, ScheduleTaskSummary, ScheduleWarning,
} from './api';

export type {
  CoreErrorCode, PlannerDocument, ScheduleSummary, ScheduleTaskSummary, ScheduleWarning,
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
  let parsed: Awaited<ReturnType<typeof readIFCWithXerReconstruction>>;
  try {
    parsed = await readIFCWithXerReconstruction(body);
  } catch (err) {
    throw new PlannerCoreError('IFC_READ_FAILED', `Could not read IFC: ${errorText(err)}`);
  }
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
  const state = (): AppState => ctx.store.getState();

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
    toIfc(): string {
      try {
        return writeIFC(buildWriteIFCInput(state()));
      } catch (err) {
        throw new PlannerCoreError('IFC_WRITE_FAILED', `Could not write IFC: ${errorText(err)}`);
      }
    },
  };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
  };
}
