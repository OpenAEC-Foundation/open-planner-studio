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
import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';
import { buildBaselineOverlay, type BaselineOverlay } from '@/types/baseline';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { HistogramSeries, HistogramPickerItem } from '@/engine/renderer/HistogramRenderer';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { diffDays, parseDate } from '@/utils/dateUtils';
import { resolveTaskFinish } from '@/utils/ganttViewport';

/** Overlay-datums uit de actieve baseline, keyed op Task.id. */
export { buildBaselineOverlay };
export type { BaselineOverlay };

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
 * Content-span in dagen vanaf de effectieve oorsprong — bewust ZONDER zoom, zodat
 * dezelfde span ook voor het secundaire split-view-venster (eigen zoom, geen taaktabel) gebruikt
 * kan worden zonder de compressie-logica te dupliceren (issue #35 punt 1). `null` = leeg project.
 *
 * Finish-keten via {@link resolveTaskFinish} (`ganttViewport.ts`) — dezelfde functie als
 * `computeFitToProject`, inclusief de terugval op de start. Zonder die terugval kon een taak met
 * alleen een start wél meetellen voor de Ctrl+0-fit maar niet voor deze contentbreedte, waardoor de
 * fit naar een positie buiten `maxScrollX` kon zoomen.
 */
export function computeContentSpanDays(
  tasks: Task[],
  effectiveViewStart: string,
  compressNonWorkdays: boolean,
  axis: GanttAxis,
  navigationEndDates: string[] = [],
): number | null {
  if (tasks.length === 0 && navigationEndDates.length === 0) return null;
  let maxDays = 365;
  for (const task of tasks) {
    const end = resolveTaskFinish(task.time);
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
  for (const end of navigationEndDates) {
    const parsed = parseDate(end);
    if (Number.isNaN(parsed.getTime())) continue;
    const days = compressNonWorkdays
      ? axis.daySpan(parseDate(effectiveViewStart), parsed)
      : diffDays(effectiveViewStart, end);
    if (days > maxDays) maxDays = days;
  }
  return maxDays;
}

/** Contentbreedte (px) van een tijdlijnvenster met de gegeven zoom. */
export function computeContentWidth(
  contentSpanDays: number | null,
  zoom: number,
): number {
  return contentSpanDays === null
    ? 2000
    : Math.max(2000, (contentSpanDays * 1.2) * zoom);
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
 * Rendererinvoer die vóór een canvaspaint kan worden samengesteld. De host meet breedte en hoogte
 * pas in `useCanvasLayer` en vult precies die twee velden daar aan; alle inhoudelijke opties blijven
 * verplicht en worden nog steeds door dezelfde bouwer gevalideerd.
 */
export type GanttRenderOptionsSourceInput = Omit<
  GanttRenderOptionsInput,
  'canvasWidth' | 'canvasHeight'
>;

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
