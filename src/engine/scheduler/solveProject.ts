// De reken-kern van een planningsdoorrekening: leaf-filter → CPM-solve → terugschrijven/rollup.
//
// Een eigen module, los van de store, zodat elke afnemer dezelfde keten draait in plaats van hem na
// te bouwen. `runCPM` (`src/state/slices/scheduleSlice.ts`) is een dunne schil rond `solveProject`:
// de store-kant (stale-vlag wissen, `cpmResult`/`resourceLoadResult` zetten, meldingen,
// extensie-event) blijft daar, de rekenkant staat hier. Het bezettingsoverzicht draait dezelfde
// functie op een KLOON van de taken van een stale document — pariteit by construction.
//
// PUUR t.o.v. alles behalve de meegegeven takenlijst: net als `applyCpmResult` muteert deze functie
// uitsluitend `input.tasks` (in-place, in de gebruikelijke Immer-verdraagzame vorm — de elementen
// blijven dezelfde objecten/proxies). Wil een aanroeper zijn invoer sparen, dan kloont hij vooraf;
// `cloneTasksForSolve` hieronder is die kloon in de vorm die de solver nodig heeft.
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { EffectiveSchedulingOptions, ProgressMode } from '@/types/project';
import { CPMSolver, type CPMResult } from './CPMSolver';
import { applyCpmResult } from './applyCpmResult';
import { expandSummaryRelations, foldSyntheticSequenceIds } from './expandSummaryRelations';
import { isLeafTask } from '@/utils/taskHierarchy';

/** Invoer van één doorrekening — plain data, geen store. */
export interface SolveProjectInput {
  /** De VOLLEDIGE takenlijst (bladen én verzameltaken). De leaf-filter en de verzameltaak-rollup
   *  gebeuren hierbinnen; een voorgefilterde lijst levert dus geen rollup. WORDT GEMUTEERD. */
  tasks: Task[];
  sequences: Sequence[];
  /** Projectkalender — de default voor taken zonder eigen `calendarId`. */
  calendar: WorkCalendar;
  /** De gedeelde kalenderbibliotheek (per-taak-kalenders). */
  calendars: WorkCalendar[];
  /** `project.statusDate` — ISO; afwezig ⇒ geen statusdatum-gedrag. */
  dataDate?: string;
  /** `project.progressMode` — default RETAINED_LOGIC. */
  progressMode?: ProgressMode;
  /** De opgeloste reken-opties: verplicht, via `solveInputFor`/`solveOptionsFor`. */
  schedulingOptions: EffectiveSchedulingOptions;
  /** `project.startDate` — ondergrens (`rootFloor`) voor de early-start-berekening van ELKE taak
   *  MET voorganger (niet alleen tegen relatie-leads — ook een gewone FS/FF-relatie met lag 0 van
   *  een vroege wortel-taak wordt hier gevloerd; alleen de gebruikerszichtbare
   *  `truncatedLeadIds`-markering is lead-specifiek). Harde constraints (MSO/MFO) winnen van deze
   *  vloer. Een taak zónder voorganger klemt deze optie NIET: die start op haar eigen, ingelezen
   *  `scheduleStart` (`ownAnchor`), ook vóór de projectstart — een ingelezen anker wordt nooit door
   *  de vloer overruled. */
  projectStartDate?: string;
  /** `project.endDate`; alleen bronsemantisch actief via useProjectEndDateForFloat. */
  projectEndDate?: string;
}

/**
 * Reken de planning door en schrijf het resultaat terug op `input.tasks`.
 *
 * De keten:
 *  1. semantische leaf-filter — de solver rekent niet op WBS-samenvattingen, ook niet als ze leeg zijn;
 *  2. `new CPMSolver(...).solve()` met dataDate/progressMode/schedulingOptions;
 *  3. bij `result.error` (cyclus e.d.): NIET terugschrijven — het resultaat wordt teruggegeven met
 *     de fout erin, de taken blijven op hun oude datums staan;
 *  4. anders `applyCpmResult` (per-blad-velden, verzameltaak-rollup, uur-modus-normalisatie).
 *
 * De aanroeper beslist wat er met het resultaat gebeurt (opslaan, melden, weggooien).
 */
export function solveProject(input: SolveProjectInput): CPMResult {
  // Per-taak-kalender: de solver krijgt de projectdefault + de bibliotheek en
  // bouwt zelf een engine-cache; taken zonder eigen calendarId rekenen in de projectkalender.
  const leafTasks = input.tasks.filter(isLeafTask);
  // Samenvattingsrelatie-propagatie (MS Project-semantiek): relaties die een WBS-samenvattingstaak
  // raken worden herschreven naar equivalente bladtaak-relaties vóórdat de solver ze ziet — de
  // solver kent alleen bladtaken. Dit hoort in de kern (niet in `runCPM`), zodat óók het
  // bezettingsoverzicht en elke andere afnemer dezelfde semantiek krijgen.
  const { sequences: expandedSequences, droppedSequenceIds: expansionDropped } =
    expandSummaryRelations(input.tasks, input.sequences);
  const solver = new CPMSolver(leafTasks, expandedSequences, input.calendar, input.calendars, {
    dataDate: input.dataDate,
    progressMode: input.progressMode,
    schedulingOptions: input.schedulingOptions,
    projectStartDate: input.projectStartDate,
    projectEndDate: input.projectEndDate,
  });
  const result = solver.solve();
  // De solver rekende op de GEËXPANDEERDE (synthetische) relatie-set, dus zijn
  // relatie-gekeyde velden dragen nog synthetische "::exp-N"-ids — geen enkele consument
  // (taakgrids, StatusBar, ReportPanel, TaskDependenciesSection, GanttCanvas, MCP-leestools)
  // kent die, want die lezen allemaal de store-`sequences` met de originele ids. Vouw ze terug
  // vóórdat het resultaat naar de aanroeper gaat.
  foldSyntheticSequenceIds(result);
  // Relaties die de expansie zelf niet kon representeren (lege/kapotte tak, of de
  // MAX_EXPANDED_RELATIONS-klem) horen in hetzelfde kanaal als de solver-eigen guard.
  // Dedupliceren: expansionDropped draagt al originele ids, maar zou in theorie kunnen
  // overlappen met wat de solver zelf al (gefold) droppte.
  if (expansionDropped.length > 0) {
    result.droppedSequenceIds = [...new Set([...(result.droppedSequenceIds ?? []), ...expansionDropped])];
  }

  // Cyclus gedetecteerd: resultaat (met fout) teruggeven en niets terugschrijven.
  if (result.error) return result;

  // Terugschrijven + verzameltaak-rollup: één gedeelde functie, ook gebruikt door de benchmark.
  applyCpmResult(input.tasks, result, { projectCalendar: input.calendar, calendars: input.calendars });

  return result;
}

/**
 * Kloon een takenlijst zodat `solveProject` erop kan rekenen zónder het origineel te raken.
 *
 * Ondiep per taak, met een verse `time`: alles wat solver en `applyCpmResult` schrijven zit in
 * `task.time.*` (de berekende datums/speling, en in de hammock-tak `durationMinutes`/
 * `scheduleDuration`). De overige velden worden alleen gelezen; hun arrays (`childIds`,
 * `resourceIds`, `constraints`, …) blijven dus bewust gedeelde referenties — kopiëren zou geen
 * enkele mutatie voorkomen en wél per doorrekening geheugen kosten.
 */
export function cloneTasksForSolve(tasks: Task[]): Task[] {
  return tasks.map(task => ({ ...task, time: { ...task.time } }));
}
