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
 * "Datums zoals opgeslagen" (issue #63) — de standaard-aan-detectie bij een VERSE import
 * (XER-etappeplan §3.5, taak T4). Aangeroepen door `applyLoadedProject` (`fileSlice.ts`) — dus elke
 * keer dat een gebruiker een bestand opent, ook een IFC met XER-archief. Crashherstel loopt sinds
 * het heropen-beleid (taak T5, 2026-09-05) NIET meer via deze functie, zie
 * `applyRecordedDatesOnRestore` hieronder voor waarom.
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
 * Alleen een VERSE XER-import (`parsed.recordedTimesOrigin === 'xer'`) zet de modus METEEN aan
 * (`datesAsRecorded = true`, `cpmResult` = de reconstructie i.p.v. de solve, `scheduleStale = false`
 * — nooit rechtstreeks `true` gezet, dus de invariant in `state/scheduleStale.ts` blijft heel).
 * Overige gevallen bieden de modus alleen AAN — `recordedDates` gevuld, `datesAsRecorded` blijft
 * `false` — precies het bestaande #63-gedrag: dat geldt voor IFC/CSV/MSPDI/MPP/P6XML zonder
 * bron-orakel, MAAR ook voor een HEROPENDE IFC met XER-bronarchief
 * (`recordedTimesOrigin === 'xer-archive'`, taak T5) — heropen-beleid (orkestratorbesluit,
 * XER-etappe laag 3, 2026-09-05): een intussen bewerkte en opgeslagen planning mag bij heropenen
 * niet stilzwijgend P6's oude datums tonen, dus alleen een verse import krijgt de automatische AAN.
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
  prepared.recordedDates = { ...recorded, shifted, origin: parsed.recordedTimesOrigin };
  if (parsed.recordedTimesOrigin === 'xer') {
    prepared.cpmResult = applyRecordedTimesToTasks(prepared.tasks, recorded.times, prepared.calendar);
    prepared.datesAsRecorded = true;
    // `prepareLoadedPayload` zette hem bij een geslaagde solve al zo; expliciet houden (plan §5
    // risico 1) — nooit een rechtstreekse `= true` ELDERS, alleen deze twee bewuste `= false`'s.
    prepared.scheduleStale = false;
  }
}

/**
 * Crashherstel-variant van `applyRecordedDatesOnLoad` (heropen-beleid, taak T5, 2026-09-05).
 *
 * Een normale heropening mag een IFC met XER-archief NOOIT automatisch in de modus zetten (zie de
 * docstring hierboven) — een sindsdien bewerkte en opgeslagen planning zou anders stilzwijgend P6's
 * oude datums tonen. Crashherstel is echter GEEN heropening maar het hervatten van een onderbroken
 * sessie: stond het document VLAK VÓÓR de crash in de modus, dan hoort het dat na herstel weer te
 * zijn; stond het uit, dan blijft het uit. Er wordt dus NIET opnieuw beslist op basis van
 * `recordedTimesOrigin` — dat zou bij een XER-archief altijd "alleen aanbieden" opleveren, ongeacht
 * de toestand vóór de crash.
 *
 * Er bestaat geen apart persistentiekanaal voor `datesAsRecorded` (geen `OPS_`-pset, zie plan §2.7)
 * — maar met een BRON-ORAKEL is de modus zelf al zichtbaar in de rauw gelezen taken:
 * `applyRecordedTimesToTasks` schrijft P6's waarden LETTERLIJK in `task.time.earlyStart`/
 * `earlyFinish` (zie die functie). Een crash-snapshot die IN de modus werd geschreven draagt in
 * `rawTasks` dus exact het orakel op elke as die `countShiftedTasks` vergelijkt — een tweede meting
 * van diezelfde functie, nu op de RAUWE (pre-solve) taken in plaats van de gesolvede, onderscheidt
 * de twee gevallen: 0 verschoven op de rauwe taken is dan geen toeval maar het bewijs dat de modus
 * aanstond toen dit werd opgeslagen.
 *
 * DIE METING WERKT UITSLUITEND MET EEN ORAKEL, en de guard daarop is geen voorzichtigheid maar een
 * correctheidsvoorwaarde (gemeten 2026-09-05, sectie 7C van `check-recorded-dates.ts`): zónder
 * `recordedTimes` haalt `captureRecordedDates` de vastlegging uit `rawTasks` ZELF (de
 * `recordedFields`-route). Vergelijk je die taken dan met die vastlegging, dan is de uitkomst per
 * definitie 0 verschoven — "de modus stond aan" zou voor ELK hersteld #63-document waar zijn, en
 * crashherstel zou de modus ongevraagd aanzetten op documenten die hem nooit aan hadden. Zonder
 * orakel is er dus niets terug te lezen en valt deze functie terug op het bestaande #63-gedrag:
 * alleen het AANBOD herstellen. De kosten daarvan zijn eerlijk en klein — een gebruiker die vóór de
 * crash in de modus stond op een niet-XER-document ziet na herstel het aanbod met exact dezelfde
 * datums en is één klik verwijderd van dezelfde weergave.
 *
 * Zelfde aanroepcontract als `applyRecordedDatesOnLoad`: `rawTasks` is de PRE-solve array, geen
 * undo-snapshot, muteert `prepared` in place.
 */
export function applyRecordedDatesOnRestore(
  rawTasks: Task[],
  prepared: DocumentPayload,
  parsed: Pick<ImportResult, 'recordedFields' | 'recordedTimes' | 'recordedTimesOrigin'>,
): void {
  const recorded = captureRecordedDates(rawTasks, parsed.recordedFields, parsed.recordedTimes);
  if (recorded.total === 0) return;
  const shifted = countShiftedTasks(prepared.tasks, recorded.times);
  if (shifted === 0) return;
  prepared.recordedDates = { ...recorded, shifted, origin: parsed.recordedTimesOrigin };
  // Alleen met een bron-orakel is `recorded.times` ONAFHANKELIJK van `rawTasks` en zegt de
  // vergelijking hieronder iets — zie de docstring.
  const hasOracle = parsed.recordedTimes !== undefined;
  const wasInModeBeforeCrash = hasOracle && countShiftedTasks(rawTasks, recorded.times) === 0;
  if (wasInModeBeforeCrash) {
    prepared.cpmResult = applyRecordedTimesToTasks(prepared.tasks, recorded.times, prepared.calendar);
    prepared.datesAsRecorded = true;
    // Zelfde bewuste `= false` als hierboven (plan §5 risico 1) — nooit een rechtstreekse `= true`
    // elders.
    prepared.scheduleStale = false;
  }
}
