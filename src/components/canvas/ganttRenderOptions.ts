// Pure afleidingen achter de Gantt-weergave (K-item 33).
//
// Waarom dit bestand bestaat: alles hieronder woonde als `useMemo`-body in `GanttCanvas.tsx`. Dat
// zijn gewone berekeningen — geen DOM, geen React, geen store — maar zolang ze in een component
// zitten waarvan de enige uitvoer een beschilderd `<canvas>` is, zijn ze alleen te controleren door
// de app te starten en te kijken. De bestaande renderer-tests helpen daar niet: die bouwen hun
// `GanttRenderOptions` MET DE HAND op en draaien `GanttRenderer` rechtstreeks, dus ze staan
// stroomafwaarts van precies het rekenwerk dat hier stond. Een fout in `effectiveViewStart` of
// `contentSpanDays` bleef daardoor onzichtbaar tot een gebruiker een scheve tijdas zag.
//
// De regel voor dit bestand: **puur en bladvormig**. Geen React-imports, geen `useAppStore`, geen
// `document`/`window`. Alles komt via argumenten binnen. Zo draait `tests/planning/check-gantt-
// render-options.ts` het headless tegen dezelfde functies die de app gebruikt.
//
// Wat hier BEWUST niet in zit: de `useMemo`-aanroepen zelf. Die blijven in het component staan, mét
// hun dep-arrays. Dat is geen halfheid maar de vangrail — twee teken-callbacks zetten state tijdens
// het tekenen (achter een >1px-drempel, zie `drawPrimary`/`drawSecondary`), dus een verschoven
// memo-grens kan een renderlus opleveren. Die faalmodus ziet geen enkele headless test. Door alleen
// de INHOUD te verplaatsen is de hook-graaf per constructie ongewijzigd.
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';
import type { Baseline } from '@/types/baseline';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { HistogramSeries, HistogramPickerItem } from '@/engine/renderer/HistogramRenderer';
import type { TraceMode } from '@/state/slices/types';
import { traceFrom } from '@/engine/scheduler/graphWalk';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { diffDays, parseDate } from '@/utils/dateUtils';

/** Overlay-datums uit de actieve baseline, keyed op Task.id. */
export type BaselineOverlay = NonNullable<GanttRenderOptions['baselineOverlay']>;
/** Path-tracing-bundel zoals de renderer hem verwacht. */
export type GanttTrace = NonNullable<GanttRenderOptions['trace']>;

/**
 * Overlay-map uit de actieve baseline. `undefined` (geen actieve baseline, of een id dat niet meer
 * bestaat) betekent voor de renderer: teken geen baseline-schaduwen.
 */
export function buildBaselineOverlay(
  baselines: Baseline[],
  activeBaselineId: string | null | undefined,
): BaselineOverlay | undefined {
  if (!activeBaselineId) return undefined;
  const active = baselines.find(b => b.id === activeBaselineId);
  if (!active) return undefined;
  const map: BaselineOverlay = new Map();
  for (const bt of active.tasks) {
    map.set(bt.taskId, { start: bt.start, finish: bt.finish, isMilestone: bt.isMilestone });
  }
  return map;
}

/**
 * Path tracing rond de (eerst) geselecteerde taak: transitieve voorgangers/opvolgers, met de
 * driving-ketens apart zodat de renderer die sterker kan tinten (MSP Task Path-conventie).
 */
export function buildTrace(
  traceMode: TraceMode,
  selectedTaskIds: string[],
  sequences: Sequence[],
  cpmResult: CPMResult | null | undefined,
): GanttTrace | undefined {
  if (traceMode === 'off' || selectedTaskIds.length === 0) return undefined;
  const focusId = selectedTaskIds[0];
  const drivingIds = cpmResult && !cpmResult.error
    ? new Set(cpmResult.drivingSequenceIds)
    : undefined;
  const tr = traceFrom(focusId, sequences, drivingIds);
  return {
    focusId,
    predecessors: traceMode !== 'successors' ? [...tr.predecessors] : [],
    drivingPredecessors: traceMode !== 'successors' ? [...tr.drivingPredecessors] : [],
    successors: traceMode !== 'predecessors' ? [...tr.successors] : [],
    drivenSuccessors: traceMode !== 'predecessors' ? [...tr.drivenSuccessors] : [],
  };
}

export interface SharedAxisInput {
  calendar: WorkCalendar;
  compressNonWorkdays: boolean;
  /** ISO-datum van de EFFECTIEVE oorsprong (`computeEffectiveViewStart`), niet `view.viewStartDate`. */
  viewStartDate: string;
  chartOriginX: number;
  zoom: number;
  scrollX: number;
}

/**
 * Issue #21 punt 5 (fase 2, ontwerp §10.1 — BINDEND): ÉÉN gedeelde `GanttAxis`-instantie voor de
 * primaire Gantt-pane ÉN de Histogram (zelfde `chartOriginX`/`effectiveView`, dus zelfde
 * kolomindeling) — anders schuiven de resource-staafjes onder de verkeerde kolommen zodra de as
 * gecomprimeerd is.
 *
 * LET OP: deze functie moet per render VERS aangeroepen worden (in het component via de dep-array
 * van de `useMemo`), zonder cross-render cache (§2.5). Bouw hier dus geen memoïsatie in: een as die
 * een kalenderwijziging overleeft, tekent stil op de oude werkdagen.
 */
export function buildSharedAxis(input: SharedAxisInput): GanttAxis {
  const engine = new CalendarEngine(input.calendar);
  return resolveGanttAxis({
    calendar: engine,
    compressNonWorkdays: input.compressNonWorkdays,
    origin: parseDate(input.viewStartDate),
    chartOriginX: input.chartOriginX,
    zoom: input.zoom,
    scrollX: input.scrollX,
  });
}

/**
 * Content-span in dagen vanaf de effectieve oorsprong — bewust ZONDER zoom/taskTableWidth, zodat
 * dezelfde span ook voor het secundaire split-view-venster (eigen zoom, geen taaktabel) gebruikt
 * kan worden zonder de compressie-logica te dupliceren (issue #35 punt 1). `null` = leeg project.
 */
export function computeContentSpanDays(
  tasks: Task[],
  effectiveViewStart: string,
  compressNonWorkdays: boolean,
  axis: GanttAxis,
): number | null {
  if (tasks.length === 0) return null;
  let maxDays = 365;
  for (const task of tasks) {
    const end = task.time.earlyFinish || task.time.scheduleFinish || task.time.lateFinish;
    if (end) {
      // Issue #21 punt 5 (fase 2, §10.2 eenheden-consistentie): bij compressie telt de
      // contentbreedte in WERKDAG-eenheden (`axis.daySpan`) i.p.v. kalenderdagen — anders is de
      // scrollbar te breed (kalenderdagen) of te smal t.o.v. wat er daadwerkelijk getekend wordt.
      const days = compressNonWorkdays
        ? axis.daySpan(parseDate(effectiveViewStart), parseDate(end))
        : diffDays(effectiveViewStart, end);
      if (days > maxDays) maxDays = days;
    }
  }
  return maxDays;
}

/** Contentbreedte (px) van een tijdvenster met de gegeven zoom en tabelbreedte. */
export function computeContentWidth(
  contentSpanDays: number | null,
  zoom: number,
  tableWidth: number,
): number {
  return contentSpanDays === null
    ? 2000
    : Math.max(2000, (contentSpanDays * 1.2) * zoom + tableWidth);
}

/**
 * Resourcekiezer-lijst onder het histogram: de "alle resources"-somrij plus één rij per resource,
 * elk met de vlag of er overbelaste dagen zijn. Materiaal telt niet mee in de somrij (§6.4).
 */
export function buildHistogramPicker(
  resources: Resource[],
  resourceLoadResult: ResourceLoadResult | null | undefined,
  allResourcesLabel: string,
): HistogramPickerItem[] {
  const over = resourceLoadResult?.overallocatedDays ?? {};
  const anyRenewableOver = resources.some(
    r => r.type !== 'MATERIAL' && (over[r.id]?.length ?? 0) > 0,
  );
  const items: HistogramPickerItem[] = [
    { id: undefined, label: allResourcesLabel, overallocated: anyRenewableOver },
  ];
  for (const r of resources) {
    items.push({ id: r.id, label: r.name || r.id, overallocated: (over[r.id]?.length ?? 0) > 0 });
  }
  return items;
}

/**
 * Belasting/capaciteit-reeks voor het histogram: één resource, of de som over alle renewables
 * wanneer er geen resource gekozen is (materiaal telt niet mee, §6.4).
 */
export function buildHistogramSeries(
  resourceLoadResult: ResourceLoadResult | null | undefined,
  histogramResourceId: string | undefined,
  resources: Resource[],
): HistogramSeries {
  if (!resourceLoadResult) return { load: {}, capacity: {}, overSet: new Set<string>() };
  const { load, capacity, overallocatedDays } = resourceLoadResult;
  if (histogramResourceId) {
    return {
      load: load[histogramResourceId] ?? {},
      capacity: capacity[histogramResourceId] ?? {},
      overSet: new Set(overallocatedDays[histogramResourceId] ?? []),
    };
  }
  const aggLoad: Record<string, number> = {};
  const aggCap: Record<string, number> = {};
  for (const r of resources) {
    if (r.type === 'MATERIAL') continue;
    const l = load[r.id];
    const cp = capacity[r.id];
    if (l) for (const iso in l) aggLoad[iso] = (aggLoad[iso] ?? 0) + l[iso];
    if (cp) for (const iso in cp) aggCap[iso] = (aggCap[iso] ?? 0) + cp[iso];
  }
  const overSet = new Set<string>();
  for (const iso in aggLoad) if (aggLoad[iso] > (aggCap[iso] ?? 0) + 1e-9) overSet.add(iso);
  return { load: aggLoad, capacity: aggCap, overSet };
}

/** De drie velden die deze bouwer zélf afleidt (uit `cpmResult`) in plaats van door te geven. */
type DerivedFromCpm = 'drivingSequenceIds' | 'violatedConstraintTaskIds' | 'missedDeadlineTaskIds';

/**
 * Maakt elk veld VERPLICHT te noemen, maar houdt `undefined` een toegestane waarde.
 *
 * Waarom niet gewoon `Required<T>` of `[K in keyof T]-?`: die modifier haalt `undefined` óók uit
 * het WAARDEtype weg, dus dan kun je een veld dat de renderer bewust mag missen niet meer op
 * `undefined` zetten. Door over `keyof Required<T>` te mappen (die heeft geen optionele sleutels)
 * maar de waarde als `T[K]` op het ORIGINEEL op te zoeken, blijft elke sleutel verplicht te noemen
 * terwijl een optioneel renderer-veld nog steeds `undefined` mag zijn — mits je dat opschrijft.
 */
type ExplicitlyRequired<T> = { [K in keyof Required<T>]: T[K] };

/**
 * Invoer voor `buildGanttRenderOptions` — AFGELEID uit `GanttRenderOptions`, niet er los naast
 * geschreven.
 *
 * Dat afleiden is de hele truc. De twee panes (primair en de split-view-pane) waren vóór K-item 33
 * twee met de hand bijgehouden objectliteralen; een veld dat aan één kant vergeten werd viel nergens
 * om. Een handgeschreven invoertype zou dat maar half oplossen: het breekt dan wél op een nieuw veld
 * in dit bestand, maar niet op een nieuw veld in `GanttRenderOptions` — en dat is nu juist de
 * realistische route (iemand bouwt een renderer-feature en de bouwer geeft de optie nooit door).
 * Door hem af te leiden breekt élke toevoeging aan de renderer-opties BEIDE aanroepplekken op
 * compileertijd, ook een optionele. Dat is dezelfde eigenschap als `DOCUMENT_FIELDS` bij het
 * documentcontract: de compilefout valt op de BRON, niet op een kopie ervan.
 *
 * Wie een veld bewust wil weglaten schrijft `undefined` op — zichtbaar in de diff, met een reden
 * erbij, in plaats van een stille omissie.
 */
export type GanttRenderOptionsInput =
  ExplicitlyRequired<Omit<GanttRenderOptions, DerivedFromCpm>>
  & {
    /** Rauw resultaat; de driving/violated/missed-lijsten worden hier één keer uitgepakt. */
    cpmResult: CPMResult | null | undefined;
  };

/**
 * Zet de invoer om in het `GanttRenderOptions`-object dat `GanttRenderer` verwacht. Puur — geen
 * store, geen DOM — en daarom headless assertbaar (`tests/planning/check-gantt-render-options.ts`).
 */
export function buildGanttRenderOptions(input: GanttRenderOptionsInput): GanttRenderOptions {
  // Doorgeven gebeurt met een SPREAD, niet met een overgetypte veldenlijst — en dat is geen
  // luiheid maar het hele punt. Met een handmatige lijst geldt: `GanttRenderOptions` heeft
  // optionele velden, dus een veld dat je hier vergeet is GEEN compilefout. Het invoertype dwingt
  // dan wel af dat je het op de aanroepplek opschrijft, maar de waarde verdampt vervolgens stil in
  // deze functie. Dat is erger dan de situatie vóór deze extractie, waar de twee objectliteralen
  // rechtstreeks naar de renderer gingen: "vergeten door te geven" was daar luidruchtig, hier zou
  // het onhoorbaar worden. Met de spread is doorgeven totaal per constructie.
  //
  // `cpmResult` is het enige veld dat NIET doorgaat: het wordt hier uitgepakt in de drie lijsten
  // eronder. Een resultaat MET fout telt als "nog niets berekend" — dan gaan die lijsten op
  // undefined, zodat de renderer neutraal tekent in plaats van markeringen uit een mislukte
  // berekening te tonen.
  const { cpmResult, ...rest } = input;
  const cpm = cpmResult && !cpmResult.error ? cpmResult : undefined;
  return {
    ...rest,
    drivingSequenceIds: cpm?.drivingSequenceIds,
    violatedConstraintTaskIds: cpm?.violatedConstraintTaskIds,
    missedDeadlineTaskIds: cpm?.missedDeadlineTaskIds,
  };
}
