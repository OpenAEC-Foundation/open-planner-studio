import { computeReliableResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import { cloneTasksForSolve, solveProject } from '@/engine/scheduler/solveProject';
import {
  applyRecordedTimesToTasks,
  captureRecordedDates,
  countShiftedTasks,
  type RecordedTime,
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
import { isFreshImportOrigin } from './documentContract';
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
 * "Datums zoals opgeslagen" (issue #63) — het laadpadgedrag, gedeeld door het verse open-pad
 * (`applyLoadedProject`, `fileSlice.ts`) en crashherstel (`restoreDocuments`, `documentSlice.ts`).
 * Eén functie met één expliciete beslisparameter in plaats van twee bijna-identieke varianten
 * (critreview laag 3, bevinding 12).
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
 * WIE ZET DE MODUS AAN — precies twee gevallen, en geen enkele heuristiek:
 *
 *  1. `restoredMode` is meegegeven (crashherstel): dán telt uitsluitend die vlag. Hij komt uit de
 *     recovery-metadata (`RecoveryManifestDoc.datesAsRecorded`), dus uit een OPGESCHREVEN feit.
 *     Crashherstel is het hervatten van een onderbroken sessie, geen heropening: aan blijft aan,
 *     uit blijft uit, en er wordt niet opnieuw beslist. Eerder stond hier een terugleesheuristiek
 *     ("0 verschoven op de rauwe taken ⇒ de modus stond aan"); die was aantoonbaar vals-positief —
 *     een bewerking verlaat de modus en zet `scheduleStale`, maar de herberekening staat pas op
 *     `setTimeout(0)`, dus een auto-save in dat gat schreef P6's datums weg zónder modus
 *     (critreview laag 3, bevinding 2).
 *  2. Anders: alleen een VERSE XER-import (`recordedTimesOrigin === 'xer'`) mét restverschillen.
 *     Al het overige BIEDT de modus alleen aan — `recordedDates` gevuld, `datesAsRecorded` blijft
 *     `false`: IFC/CSV/MSPDI/MPP/P6XML zonder bron-orakel, én een HEROPENDE IFC met XER-archief
 *     (`'xer-archive'`), want een intussen bewerkte en opgeslagen planning mag bij heropenen niet
 *     stilzwijgend P6's oude datums tonen (heropen-beleid, taak T8).
 *
 * `scheduleStale` gaat in de modus expliciet op `false` — nooit rechtstreeks op `true`, dus de
 * invariant in `state/scheduleStale.ts` blijft heel.
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
  restoredMode?: boolean,
): void {
  const recorded = captureRecordedDates(rawTasks, parsed.recordedFields, parsed.recordedTimes);
  if (recorded.total === 0) return;
  const shifted = countShiftedTasks(prepared.tasks, recorded.times);
  // Eigenaarsbesluit 2026-09-09 ("het moet altijd gaan zoals het nu bij XER werkt" + heropen-
  // beleid optie B): een VERSE import van elk formaat gaat automatisch in de modus zodra er
  // restverschillen zijn; een HEROPENING van een eigen IFC ('ifc-own'/'xer-archive') alleen
  // zolang het document sinds de import niet is bewerkt (`importPristine`, uit het bestand zelf);
  // zonder herkomst uitsluitend het aanbod.
  const origin = parsed.recordedTimesOrigin;
  const autoEnter = shifted > 0 && (
    isFreshImportOrigin(origin)
    || ((origin === 'ifc-own' || origin === 'xer-archive') && prepared.importPristine === true)
  );
  const enterMode = restoredMode ?? autoEnter;
  // Niets verschoven én geen modus om te herstellen ⇒ er valt niets te melden: de herberekening
  // kwam exact uit op wat het bestand zei.
  if (shifted === 0 && !enterMode) return;
  prepared.recordedDates = { ...recorded, shifted, origin: parsed.recordedTimesOrigin };
  if (enterMode) enterRecordedDatesMode(prepared, recorded.times);
}

/**
 * Zet één payload ín de modus: P6's/het bestands vastlegging in `task.time`, het `cpmResult` als
 * reconstructie (niet als solve), en `scheduleStale` uit. Gedeeld door het laadpad hierboven en de
 * SLAPENDE herstelde documenten hieronder, zodat "in de modus" op beide plekken exact hetzelfde
 * betekent.
 */
function enterRecordedDatesMode(payload: DocumentPayload, times: Record<string, RecordedTime>): void {
  payload.cpmResult = applyRecordedTimesToTasks(payload.tasks, times, payload.calendar);
  payload.datesAsRecorded = true;
  // `prepareLoadedPayload` zette hem bij een geslaagde solve al zo; expliciet houden (plan §5
  // risico 1) — nooit een rechtstreekse `= true` ELDERS, alleen deze bewuste `= false`.
  payload.scheduleStale = false;
}

/**
 * Crashherstel van een SLAPEND document dat in "datums zoals opgeslagen" stond
 * (critreview laag 3, bevinding 3).
 *
 * Slapende herstelde documenten worden bewust NIET doorgerekend (`payloadFromInput` zet
 * `scheduleStale = true`, `switchDocument` roept nooit `runCPM`). Zonder deze functie kwam zo'n
 * document terug met P6's datums ín `task.time`, zónder modus, zónder markering en mét een
 * verouderd-waarschuwing: staat **Automatisch berekenen** aan, dan gumt
 * `recalculateStaleSleepingDocuments` die datums meteen weg; staat het uit, dan verschuift de
 * eerste F5 ze zonder uitleg.
 *
 * Wat hier wél kan zonder solve: de vastlegging vastleggen (`captureRecordedDates` leest alleen het
 * bestand), de modus zetten en het `cpmResult` reconstrueren. Wat hier NIET kan: de teller
 * `shifted` — die is per definitie een vergelijking mét een herberekening, en die is er niet. De
 * payload krijgt daarom een `recordedDates` ZONDER `shifted`: de strook valt in de modus terug op
 * zijn tellerloze tekst (`recordedDates.active` in `RecordedDatesNotice`), terwijl export-poort,
 * "niet vastgelegd"-kolommen en badge gewoon werken (die hangen aan `times`). Een verzonnen
 * `shifted: 0` zou de gebruiker vertellen dat herberekenen niets verandert — precies de leugen die
 * `RecordedDates` (zie `recordedDates.ts`) uit zijn eigen contract weerde.
 */
export function applyRestoredRecordedMode(
  payload: DocumentPayload,
  parsed: Pick<ImportResult, 'recordedFields' | 'recordedTimes' | 'recordedTimesOrigin'>,
): void {
  const recorded = captureRecordedDates(payload.tasks, parsed.recordedFields, parsed.recordedTimes);
  if (recorded.total === 0) return;
  // Her-check laag 3, bevinding 4: de vastlegging WEL zetten, alleen zonder `shifted` (optioneel
  // sinds die bevinding). Zonder `recordedDates` hingen de export-poort (`unrecordedExportGate`),
  // de "niet vastgelegd"-kolommen (`recordedGridBinding`) en de badge (`recordedTaskMark`) alle
  // drie in de lucht: het document stond in de modus, maar `lateStart ?? rec.start` en
  // `totalFloat ?? 0` reisden gewoon naar CSV en `planner_get_task`, afhankelijk van welk tabblad
  // bij de crash toevallig actief was. Nu betekent "in de modus" op beide herstelpaden hetzelfde.
  payload.recordedDates = { ...recorded, origin: parsed.recordedTimesOrigin };
  enterRecordedDatesMode(payload, recorded.times);
}
