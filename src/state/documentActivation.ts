import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import { cloneTasksForSolve, solveProject } from '@/engine/scheduler/solveProject';
import {
  applyRecordedTimesToTasks,
  captureRecordedDates,
  countShiftedTasks,
} from '@/engine/scheduler/recordedDates';
import { computeViewRows, type ViewContext, type ViewRow, type ViewRowOpts } from '@/engine/view/visibleRows';
import { getNoneLabelValue } from '@/utils/noneLabel';
import type { Company, CompanyPool } from '@/types/library';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import {
  applyCalendarUpdate,
  applyResourceUpdate,
  classifyCalendarOnOpen,
  classifyResourceOnOpen,
} from '@/services/library';
import { markScheduleStale } from './transaction';
import type { DocumentPayload } from './documentContract';
import { promoteProjectCalendarToLibrary, syncProjectCalendar } from './syncProjectCalendar';

export type LibraryBoundaryMode = 'silent-switch' | 'open-boundary';

export interface BehindRefreshMaterialization {
  payload: DocumentPayload;
  calendarsChanged: number;
  resourcesChanged: number;
  invalidateRedoScope: boolean;
}

export interface LibraryBoundarySignals {
  refreshed: number;
  deviated: number;
  removed: number;
  showLibraryLinkDialog: boolean;
  libraryRefreshNotice: number | null;
}

export interface DocumentActivationMaterialization {
  payload: DocumentPayload;
  viewRows: readonly ViewRow[];
  resourceLoadResult: ResourceLoadResult | null;
  signals: LibraryBoundarySignals;
  invalidateRedoScope: boolean;
}

function activationPayload(payload: Readonly<DocumentPayload>): DocumentPayload {
  return {
    ...payload,
    calendars: [...payload.calendars],
    resources: [...payload.resources],
  };
}

function localPool(
  payload: Readonly<DocumentPayload>,
  companies: readonly Company[],
  pools: Readonly<Record<string, CompanyPool>>,
): CompanyPool | null {
  const companyId = payload.project.companyId;
  if (!companyId || !companies.some(company => company.id === companyId)) return null;
  return pools[companyId] ?? null;
}

export function materializeBehindOnlyRefresh(input: {
  payload: Readonly<DocumentPayload>;
  companies: readonly Company[];
  pools: Readonly<Record<string, CompanyPool>>;
}): BehindRefreshMaterialization {
  const payload = activationPayload(input.payload);
  promoteProjectCalendarToLibrary(payload);
  syncProjectCalendar(payload);
  const pool = localPool(payload, input.companies, input.pools);
  if (!pool) {
    return { payload, calendarsChanged: 0, resourcesChanged: 0, invalidateRedoScope: false };
  }

  let calendarsChanged = 0;
  const calendars = payload.calendars.map(calendar => {
    if (calendar.libraryOrigin?.companyId !== pool.companyId) return calendar;
    if (classifyCalendarOnOpen(calendar, pool) !== 'behind') return calendar;
    calendarsChanged++;
    return applyCalendarUpdate(calendar, pool);
  });
  if (calendarsChanged > 0) {
    payload.calendars = calendars;
    syncProjectCalendar(payload);
    markScheduleStale(payload);
  }

  let resourcesChanged = 0;
  const resources = payload.resources.map(resource => {
    if (resource.libraryOrigin?.companyId !== pool.companyId) return resource;
    if (classifyResourceOnOpen(resource, pool) !== 'behind') return resource;
    resourcesChanged++;
    return applyResourceUpdate(resource, pool);
  });
  if (resourcesChanged > 0) payload.resources = resources;

  return {
    payload,
    calendarsChanged,
    resourcesChanged,
    invalidateRedoScope: calendarsChanged + resourcesChanged > 0,
  };
}

function countOpenBoundarySignals(
  payload: Readonly<DocumentPayload>,
  pool: CompanyPool | null,
): { deviated: number; removed: number } {
  if (!pool) return { deviated: 0, removed: 0 };
  let deviated = 0;
  let removed = 0;
  for (const resource of payload.resources) {
    if (resource.libraryOrigin?.companyId !== pool.companyId) continue;
    const status = classifyResourceOnOpen(resource, pool);
    if (status === 'deviated') deviated++;
    else if (status === 'removed') removed++;
  }
  for (const calendar of payload.calendars) {
    if (calendar.libraryOrigin?.companyId !== pool.companyId) continue;
    const status = classifyCalendarOnOpen(calendar, pool);
    if (status === 'deviated') deviated++;
    else if (status === 'removed') removed++;
  }
  return { deviated, removed };
}

function derivePayloadViewRows(payload: Readonly<DocumentPayload>): ViewRow[] {
  const opts: ViewRowOpts = {
    filter: payload.view.filter ?? null,
    group: payload.view.group ?? [],
    sort: payload.view.sort ?? [],
    collapsedTaskIds: new Set(payload.collapsedTaskIds),
    collapsedGroupKeys: new Set(payload.view.collapsedGroupKeys ?? []),
  };
  const ctx: ViewContext = {
    activityCodeTypes: payload.activityCodeTypes,
    customFieldDefs: payload.customFieldDefs,
    resources: payload.resources,
    assignments: payload.assignments,
    noneLabel: getNoneLabelValue(),
  };
  return computeViewRows(payload.tasks, opts, ctx);
}

export function materializeLibraryBoundary(input: {
  payload: Readonly<DocumentPayload>;
  companies: readonly Company[];
  pools: Readonly<Record<string, CompanyPool>>;
  mode: LibraryBoundaryMode;
}): DocumentActivationMaterialization {
  const pool = localPool(input.payload, input.companies, input.pools);
  const classified = input.mode === 'open-boundary'
    ? countOpenBoundarySignals(input.payload, pool)
    : { deviated: 0, removed: 0 };
  const refreshed = materializeBehindOnlyRefresh(input);
  const refreshedCount = refreshed.calendarsChanged + refreshed.resourcesChanged;
  // Spiegel runCPM: bij een onberekenbare planning is belasting niet betrouwbaar en dus null.
  const resourceLoadResult = computeReliableResourceLoad(
    refreshed.payload.cpmResult,
    refreshed.payload.resources,
    refreshed.payload.assignments,
    refreshed.payload.tasks,
    refreshed.payload.calendar,
    refreshed.payload.calendars,
  );
  refreshed.payload.resourceLoadResult = resourceLoadResult;
  return {
    payload: refreshed.payload,
    viewRows: derivePayloadViewRows(refreshed.payload),
    resourceLoadResult,
    signals: {
      refreshed: refreshedCount,
      deviated: classified.deviated,
      removed: classified.removed,
      showLibraryLinkDialog: input.mode === 'open-boundary' && classified.deviated > 0,
      libraryRefreshNotice: refreshedCount > 0 ? refreshedCount : null,
    },
    invalidateRedoScope: refreshed.invalidateRedoScope,
  };
}

/** Bereid expliciet te herberekenen laadpaden voor zonder de live store tussentijds te publiceren. */
export function prepareLoadedPayload(
  input: Readonly<DocumentPayload>,
  options: { recompute: boolean },
): DocumentPayload {
  const payload = activationPayload(input);
  promoteProjectCalendarToLibrary(payload);
  syncProjectCalendar(payload);
  if (!options.recompute || payload.cpmResult !== null) return payload;

  payload.tasks = cloneTasksForSolve(payload.tasks);
  payload.cpmResult = solveProject({
    tasks: payload.tasks,
    sequences: payload.sequences,
    calendar: payload.calendar,
    calendars: payload.calendars,
    dataDate: payload.project.statusDate,
    progressMode: payload.project.progressMode,
    schedulingOptions: payload.project.schedulingOptions,
    projectStartDate: payload.project.startDate,
  });
  payload.scheduleStale = false;
  return payload;
}

/**
 * "Datums zoals opgeslagen" (issue #63) — de standaard-aan-detectie bij het laden (XER-etappeplan
 * §3.5, taak T4). Gedeeld tussen `applyLoadedProject` (`fileSlice.ts`, een vers open-pad) en
 * `restoreDocuments` (`documentSlice.ts`, crash-herstel): een hersteld document krijgt zo dezelfde
 * reproduceerbare detectie als een vers geopend document — "die solve ís de detectie" (§2.3) geldt
 * voor beide paden identiek, zonder dat de vlag zelf ooit apart bewaard hoeft te worden.
 *
 * `rawTasks` MOET de taken van VÓÓR de solve zijn (bv. de `.tasks` van de payload die aan
 * `prepareLoadedPayload` werd gegeven — NIET `prepared.tasks`): `prepareLoadedPayload` kloont de
 * taken pas vlak vóór de solve (`cloneTasksForSolve`, ondiep met een verse `time`-kopie per taak),
 * dus de ORIGINELE taakobjecten blijven de rauwe, ongesolvede leeswaarden dragen terwijl
 * `prepared.tasks` de zojuist berekende uitkomst draagt — precies het contrast dat
 * `captureRecordedDates`/`countShiftedTasks` nodig hebben. `prepareLoadedPayload` zelf muteert zijn
 * `input`-argument niet (het bouwt intern een eigen kopie via `activationPayload`), dus de
 * aanroeper kan `payload.tasks` gerust bewaren en er ná `prepareLoadedPayload(payload, ...)` nog
 * steeds naar verwijzen.
 *
 * Alleen de bron-orakel-route (XER, `parsed.recordedTimesOrigin === 'xer'`) zet de modus METEEN aan
 * (`datesAsRecorded = true`, `cpmResult` = de reconstructie i.p.v. de solve, `scheduleStale = false`
 * — nooit rechtstreeks `true` gezet, dus de invariant in `state/scheduleStale.ts` blijft heel).
 * Overige formaten (IFC/CSV/MSPDI/MPP/P6XML) bieden de modus alleen AAN — `recordedDates` gevuld,
 * `datesAsRecorded` blijft `false` — precies het bestaande #63-gedrag, ongewijzigd.
 *
 * GEEN undo-snapshot: dit is een LAADPAD, geen mutator. De aanroeper draait vlak hiervoor/hierna
 * `removeSessionHistoryForDocumentFromState` — er is geen geschiedenis waarin een pre-load-toestand
 * kan opduiken. De contract-invariant "élke MUTATOR van `datesAsRecorded` pusht een snapshot"
 * (`showRecordedDates`/`runCPM`) blijft onverkort gelden; dit is er geen.
 *
 * Muteert `prepared` in place, net als de rest van dit bestand (`prepareLoadedPayload`,
 * `materializeBehindOnlyRefresh`).
 */
export function applyRecordedDatesOnLoad(
  rawTasks: Task[],
  prepared: DocumentPayload,
  parsed: Pick<ImportResult, 'recordedFields' | 'recordedTimes' | 'recordedTimesOrigin'>,
): void {
  const recorded = captureRecordedDates(rawTasks, parsed.recordedFields, parsed.recordedTimes);
  if (recorded.total === 0) return;
  const shifted = countShiftedTasks(prepared.tasks, recorded.times);
  if (shifted === 0) return;
  prepared.recordedDates = { ...recorded, shifted };
  if (parsed.recordedTimesOrigin === 'xer') {
    prepared.cpmResult = applyRecordedTimesToTasks(prepared.tasks, recorded.times, prepared.calendar);
    prepared.datesAsRecorded = true;
    // `prepareLoadedPayload` zette hem bij een geslaagde solve al zo; expliciet houden (plan §5
    // risico 1) — nooit een rechtstreekse `= true` ELDERS, alleen deze twee bewuste `= false`'s.
    prepared.scheduleStale = false;
  }
}
