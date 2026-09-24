/**
 * View-/render-contract-types (fase 1 modulariteits-sanering, thema E). Deze types beschrijven de
 * presentatie-/weergavelaag (Gantt-view, tijdschaal, filter/groep/sorteer/layout-model, datum- en
 * duurweergave) en worden gedeeld door engine (`GanttRenderer`, `HistogramRenderer`, `timelineTiers`,
 * `filterEval`), services (`printPreview`) én de state-laag. Ze wonen daarom in `src/types/` (met
 * alleen type-imports) i.p.v. in de state-laag. `state/slices/types.ts` her-exporteert ze voor bestaande
 * consumenten; de bijbehorende waarde-constanten (`DATE_NOTATIONS`, …) blijven daar.
 */

import type { TaskGridColumnPreference } from '@/types/taskGrid';

// Fase 2.7 (§3): 'year' toegevoegd als directe keuze; 'quarter' aan de dropdown.
// Fase 2.8b (§6.2): 'hour' toegevoegd — alleen bereikbaar/zichtbaar als de hoofdschakelaar
// Urenplanning aan staat; `scaleFromZoom` levert 'hour' uitsluitend met die vlag.
export type TimeScale = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'hour';

// Datumnotatie (taak #53): bepaalt ALLEEN hoe datums aan de gebruiker getoond worden
// (tabel, panelen, rapporten, print, tooltips) én de segmentvolgorde van het datumveld.
// Interne opslag/serialisatie blijft ALTIJD ISO (YYYY-MM-DD) — deze waarde raakt bestanden,
// engine of import/export nooit. Ontbrekende localStorage-sleutel ⇒ 'dmy' (dd-mm-jjjj).
export type DateNotation = 'dmy' | 'mdy' | 'ymd';

// Fase 2.8b (§6.8): Duurweergave — hoe duur in tabellen/tooltips getoond wordt.
// 'auto' = eigen eenheid per taak ("3d"/"20u"); 'days'/'hours' = altijd forceren.
export type DurationDisplay = 'auto' | 'days' | 'hours';

// Fase 2.8b (§6.9): Taakbalken bij onderbrekingen — of uur-taakbalken in hun echte
// werkblokken (bar-necking) worden opgesplitst. 'never' = altijd doorlopend;
// 'selection' = segmenten zichtbaar zodra de taak geselecteerd is; 'always' = altijd.
export type BarSplitMode = 'never' | 'selection' | 'always';

// --- Fase 2.7 weergaven: één veld-referentie voor filter, groep én sort (§2.1) ---
export type BuiltinFieldKey =
  | 'name' | 'wbsCode' | 'duration' | 'start' | 'finish'
  | 'totalFloat' | 'isCritical' | 'completion' | 'taskType' | 'isMilestone'
  // Fase 2.9 (§3.5): additieve analyse-velden — raken geen bestaand veld.
  | 'freeFloat' | 'interferingFloat' | 'isNearCritical' | 'floatPath'
  // Synthetisch filter-only veld (issue-discussie #32): "actief tussen" toetst start ÉN finish
  // tegelijk tegen een periode (interval-overlap), dus geen sorteer-/groepeerbaar scalar-veld —
  // zie FILTER_ONLY_BUILTIN_KEYS in fieldCatalog.ts.
  | 'activeDuring';

export type FieldRef =
  | { src: 'builtin'; key: BuiltinFieldKey }
  | { src: 'activityCode'; typeId: string }   // waarde = valueId (uit task.activityCodes)
  | { src: 'customField'; defId: string }      // waarde = task.customFields[defId]
  | { src: 'resource' };                        // afgeleide waarde = namen van toegewezen resources

/** Kolomconfiguratie op de Tabel-weergave (FullTaskGrid, §2.2). Volgorde = arrayvolgorde. */
export interface ColumnConfig {
  field: FieldRef;
  visible: boolean;
  width: number; // px
}

export type FilterOperator =
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'contains' | 'startsWith' | 'between' | 'isEmpty' | 'in';

export type FilterNode =
  | { kind: 'group'; op: 'AND' | 'OR'; children: FilterNode[] }
  | {
      kind: 'rule';
      field: FieldRef;
      operator: FilterOperator;
      value?: string | number | boolean | string[];
      value2?: string | number; // alleen 'between'
    };

/** App-brede filterpreset. Bewust alleen het filter, zodat wisselen nooit kolommen, groepering,
 * sortering of tijdschaal van de actuele weergave raakt. */
export interface SavedFilter {
  id: string;
  name: string;
  filter: FilterNode;
}

export interface GroupLevel {
  field: FieldRef;
  dir: 'asc' | 'desc'; // volgorde waarin de banden zelf verschijnen
}

export interface SortLevel {
  field: FieldRef;
  dir: 'asc' | 'desc';
}

/** App-globale presentatie-preset (§2.5). Bewust GEEN scroll/zoom-positie of sessie-flags.
 *
 *  Een layout legt alleen vast wat hij DRAAGT (issue #144): een ontbrekende sleutel betekent "laat
 *  dat deel van het beeld met rust". Een opgeslagen filter is zo een layout met alleen `filter`, het
 *  meegeleverde resourcediagram een layout met alleen `group` + `sort`. Layouts van vóór #144 dragen
 *  alle vijf delen en gedragen zich dus ongewijzigd. Zie `src/engine/view/layoutPresets.ts`. */
export interface Layout {
  id: string;
  name: string;
  /** Kolomindeling die op het actieve taakgridoppervlak wordt toegepast. De bron-surface wordt
   *  niet vastgelegd: dezelfde layout is bewust bruikbaar in Gantt en volledige Tabel. */
  columns?: TaskGridColumnPreference[];
  group?: GroupLevel[];
  sort?: SortLevel[];
  /** Aanwezig + `null` = "wis het filter"; afwezig = filter ongemoeid. */
  filter?: FilterNode | null;
  timeScale?: TimeScale; // preset-naam; toepassen → setZoom(TIMESCALE_ZOOM[timeScale])
  /** Relatielijnen in de Gantt tonen. Het resourcediagram zet ze uit: een taak kan daar onder
   *  meerdere banden staan, waardoor de pijlen kriskras door het beeld lopen. */
  showRelations?: boolean;
  /** Sleutel uit de vaste icoonset van de layoutknoppen (`layoutIcons.tsx`); geen layoutDEEL. */
  icon?: string;
}

/** De delen die een layout kan dragen, in vaste UI-volgorde. */
export const LAYOUT_PARTS = ['columns', 'filter', 'group', 'sort', 'timeScale', 'showRelations'] as const;
export type LayoutPart = typeof LAYOUT_PARTS[number];

/** Het deel van het scherm waar een layout over gaat — precies de layoutdelen, volledig ingevuld. */
export interface LayoutViewParts {
  columns: TaskGridColumnPreference[];
  filter: FilterNode | null;
  group: GroupLevel[];
  sort: SortLevel[];
  timeScale: TimeScale;
  showRelations: boolean;
}

/**
 * Een layoutknop is een SCHAKELAAR (eigenaarsbesluit 2026-09-19): aanzetten past de layout toe,
 * nogmaals klikken zet hem uit en brengt zijn delen terug naar `restore` — het beeld van vóór de
 * eerste layoutklik. Knoppen die VERSCHILLENDE delen dragen kunnen tegelijk aanstaan (resourcediagram
 * + een filterknop); een knop die een deel van een andere draagt vervangt die andere.
 */
export interface LayoutSession {
  /** De aangezette layouts zoals ze werden toegepast; de store kent de layoutlijst zelf niet. */
  layouts: Layout[];
  restore: LayoutViewParts;
}

/** Split view binnen één document (§10) — undefined = uit. */
export interface SplitViewState {
  ratio: number;          // 0..1 breedteverdeling linker pane
  secondaryZoom: number;  // eigen zoom rechter pane
  secondaryScrollX: number;
}

export interface ViewState {
  scrollX: number;
  scrollY: number;
  zoom: number; // pixels per day
  timeScale: TimeScale;
  viewStartDate: string; // leftmost visible date
  /** Histogram-selectie (fase 2.5, §6.4): id van de resource die de histogramstrook toont;
   *  undefined = alle renewables samengeteld. Per-document (zit in ViewState → DocumentPayload). */
  histogramResourceId?: string;
  // --- Fase 2.7 (§2.6) — per-document view-state ---
  /** Geneste AND/OR-filter; null = geen filter (short-circuit). */
  filter: FilterNode | null;
  /** Groepeer-niveaus; [] = WBS-boom (huidig gedrag). */
  group: GroupLevel[];
  /** Sorteer-niveaus (multi-key, stabiel); [] = boom-/bandvolgorde. */
  sort: SortLevel[];
  /** Ingeklapte groepsbanden (pad-gecodeerde JSON-sleutels). */
  collapsedGroupKeys: string[];
  /** Split view binnen dit document; undefined = uit. */
  splitView?: SplitViewState;
  /** Relatielijnen in de Gantt tonen (issue #144); undefined = aan. */
  showRelations?: boolean;
  /** De layoutknop die nu aanstaat, met het beeld om naar terug te keren; undefined = geen. */
  layoutSession?: LayoutSession;
  /** Open-fit-signaal (issue #16): na het laden van een document zet fileSlice dit op `true`; de
   *  GanttCanvas voert dan de fit-to-project uit (het kent de viewport-breedte, de store niet) en
   *  wist het meteen weer. Transient — bewust GEEN undo/redo (view zit niet in de snapshot). */
  pendingFit?: boolean;
  /** "Spring naar taak"-signaal (issue #65): `focusOnTask` zet dit op de doel-taak-id; GanttCanvas
   *  voert de zoom-/scrollberekening uit (kent de canvas-afmetingen, de store niet) en wist het
   *  meteen weer. Transient — zelfde precedent als `pendingFit`. */
  pendingFocusTaskId?: string;
  /** Houd de huidige zoom vast tijdens een focusverzoek (nieuwe taak); alleen de scroll beweegt. */
  pendingFocusTaskPreserveZoom?: boolean;
}
