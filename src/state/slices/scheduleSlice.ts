import type { Task } from '@/types/task';
import { CPMSolver, type CPMResult } from '@/engine/scheduler/CPMSolver';
import { computeResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import {
  levelResources as computeLeveling,
  type LevelingOptions,
  type LevelingResult,
} from '@/engine/scheduler/ResourceLeveler';
import { beginUndoable, finishMutation } from '../transaction';
import { emitExtensionEvent, HOST_EVENTS } from '@/services/extensionEvents';
import { effectiveCalendarOf } from '@/utils/taskDuration';
import { isHourCalendar } from '@/services/subdayIo';
import { parseInstant, formatInstant } from '@/utils/dateUtils';
import type { AppSlice } from './types';

export interface ScheduleSlice {
  cpmResult: CPMResult | null;
  /** Belasting/capaciteit/overallocatie per resource, herberekend bij elke `runCPM` (fase 2.5,
   *  resources-ontwerp §4.2) — "manual, not reactive", net als `cpmResult` zelf. */
  resourceLoadResult: ResourceLoadResult | null;
  /** "Verouderd"-vlag (A6): gezet door datum-rakende mutaties (taak-/relatie-/projectkalender-
   *  wijzigingen), gewist door `runCPM`. Voedt een subtiele "herbereken (F5)"-hint. */
  scheduleStale: boolean;
  runCPM: () => void;
  /** Herbereken ALLEEN de resource-belasting op de bestaande CPM-datums (A6): pure resource-
   *  mutaties (toewijzen, capaciteit, kalender) verversen zo het histogram direct, ZONDER runCPM en
   *  ZONDER de datums aan te raken — past binnen "manual, not reactive". Datum-rakende mutaties
   *  blijven handmatig (F5) en zetten in plaats hiervan `scheduleStale`. */
  recomputeResourceLoad: () => void;
  /** Nivelleer-preview (fase 2.5, §5): berekent de resource-nivellering tegen de laatst gedraaide
   *  CPM-run en geeft het resultaat terug ZONDER de store te muteren (UI toont eerst een diff,
   *  commit gaat via `applyLeveling`). Vereist een geldige `cpmResult`. */
  levelResources: (options: LevelingOptions) => LevelingResult;
  /** Commit een nivelleerresultaat: één undo-snapshot, schrijf alle `levelingDelay`-waarden
   *  (idempotent — reset eerst álles, dan de nieuwe delays) en her-draai CPM (§5.6). */
  applyLeveling: (result: LevelingResult) => void;
  /** "Nivellering wissen": één undo-snapshot, zet alle `levelingDelay` terug op undefined,
   *  her-draai CPM. */
  clearLeveling: () => void;
}

export const createScheduleSlice: AppSlice<ScheduleSlice> = (set, get) => ({
  cpmResult: null,
  resourceLoadResult: null,
  scheduleStale: false,

  recomputeResourceLoad: () => {
    set((s) => {
      s.resourceLoadResult = computeResourceLoad(
        s.resources, s.assignments, s.tasks, s.calendar, s.calendars,
      );
    });
  },

  runCPM: () => {
    set((s) => {
      s.scheduleStale = false; // F5/Bereken gedraaid — schema is (voor deze taken/relaties) vers.
      // Per-taak-kalender (fase 2.8a, §5.1): de solver krijgt de projectdefault + de bibliotheek en
      // bouwt zelf een engine-cache; taken zonder eigen calendarId rekenen in de projectkalender.
      const leafTasks = s.tasks.filter(t => t.childIds.length === 0);
      const solver = new CPMSolver(leafTasks, s.sequences, s.calendar, s.calendars, {
        dataDate: s.project.statusDate,
        progressMode: s.project.progressMode,
        // Fase 2.9 golf 0: project-scoped reken-opties doorgeven. De solver leest ze nog nergens
        // gedragswijzigend (afwezig/leeg ⇒ byte-identiek); de latere golven activeren ze.
        schedulingOptions: s.project.schedulingOptions,
      });
      const result = solver.solve();

      // If circular dependency detected, store the result (with error) and bail
      if (result.error) {
        s.cpmResult = result;
        s.resourceLoadResult = null;
        return;
      }

      // Apply results back to tasks
      for (const task of s.tasks) {
        const r = result.tasks.get(task.id);
        if (r) {
          task.time.earlyStart = r.earlyStart;
          task.time.earlyFinish = r.earlyFinish;
          task.time.lateStart = r.lateStart;
          task.time.lateFinish = r.lateFinish;
          task.time.totalFloat = r.totalFloat;
          task.time.freeFloat = r.freeFloat;
          task.time.isCritical = r.isCritical;
          // Fase 2.9 golf 2 (§4.6): analyse-afleidingen. `interferingFloat` is ALTIJD aanwezig
          // (tf−ff); `isNearCritical`/`floatPath` alleen wanneer de bijbehorende optie draait —
          // afwezig ⇒ het veld wordt gewist (zodat een uitgezette optie geen stale markering laat).
          task.time.interferingFloat = r.interferingFloat;
          if (r.isNearCritical !== undefined) task.time.isNearCritical = r.isNearCritical;
          else task.time.isNearCritical = undefined;
          if (r.floatPath !== undefined) task.time.floatPath = r.floatPath;
          else task.time.floatPath = undefined;
          // BEWUST GEEN scheduleStart-ANKER-drift: scheduleStart is de GEPLANDE anker (waarop de
          // forward-pass voortbouwt, `CPMSolver` snapt hierop) en mag NIET de berekende earlyStart
          // worden — anders bleef een taak na het verwijderen van een relatie op z'n gedrifte datum
          // hangen. De berekende planning leeft in earlyStart/earlyFinish; weergave/export gebruikt
          // `earlyStart || scheduleStart`.
          //
          // UUR-MODUS (fase 2.8b, FIX golf, §2.4): scheduleStart/scheduleFinish moeten wél een
          // datetime-representatie dragen i.p.v. date-only/verouderd te blijven. scheduleFinish volgt
          // de berekende finish (geen anker ⇒ veilig; nooit meer stale na een duur-wijziging);
          // scheduleStart houdt zijn ANKER-instant maar wordt idempotent naar de datetime-vorm
          // genormaliseerd (parseInstant→formatInstant('hour') verandert de instant niet, dus geen
          // drift). Dag-taken blijven ONGEMOEID ⇒ byte-identiek (`formatDate`, verify:examples).
          const effCal = effectiveCalendarOf(task, s.calendar, s.calendars);
          if (isHourCalendar(effCal)) {
            task.time.scheduleFinish = r.earlyFinish;
            task.time.scheduleStart = formatInstant(parseInstant(task.time.scheduleStart), 'hour');
          }
        }
      }

      // Update summary tasks (roll up dates from children)
      // A4 (prestatie): één vooraf gebouwde id→taak-Map i.p.v. `s.tasks.find` per taak én per kind
      // (recursief) — dat was O(n²) op de rollup. `byId` bouwt op de draft `s.tasks`, dus
      // `byId.get(...)` levert exact dezelfde draft-proxy als `find` (identiek muteren via
      // `task.time.*`); alleen de opzoeking gaat van O(n) naar O(1). Rollup-logica, -volgorde en de
      // berekende waarden blijven ongewijzigd (byte-identiek).
      const byId = new Map<string, Task>(s.tasks.map(t => [t.id, t]));
      const updateSummary = (taskId: string) => {
        const task = byId.get(taskId);
        if (!task || task.childIds.length === 0) return;

        for (const childId of task.childIds) {
          updateSummary(childId);
        }

        const children = task.childIds
          .map(cid => byId.get(cid))
          .filter(Boolean) as Task[];

        if (children.length > 0) {
          const starts = children.map(c => c.time.earlyStart).sort();
          const finishes = children.map(c => c.time.earlyFinish).sort();
          task.time.earlyStart = starts[0];
          task.time.earlyFinish = finishes[finishes.length - 1];
          task.time.isCritical = children.some(c => c.time.isCritical);

          // Ook de LATE datums en speling oprollen — anders bleven die op de
          // createDefaultTaskTime-defaults staan (lf=es, tf=0) en schreef o.a. ifcWriter
          // misleidende fase-speling weg (een niet-kritieke fase met "tf=0").
          const lateStarts = children.map(c => c.time.lateStart).sort();
          const lateFinishes = children.map(c => c.time.lateFinish).sort();
          task.time.lateStart = lateStarts[0];
          task.time.lateFinish = lateFinishes[lateFinishes.length - 1];
          // Een verzameltaak kan maar zo veel opschuiven als zijn krapste kind: min over de kinderen.
          task.time.totalFloat = Math.min(...children.map(c => c.time.totalFloat));
          task.time.freeFloat = Math.min(...children.map(c => c.time.freeFloat));
          // Interfererende speling op de samenvatting = tf−ff (fase 2.9 golf 2, §4.6) — houdt de
          // invariant ook op verzameltaken en vult de kolom voor WBS-rijen.
          task.time.interferingFloat = task.time.totalFloat - task.time.freeFloat;
        }
      };

      // Find root tasks (no parent)
      for (const task of s.tasks) {
        if (!task.parentId) updateSummary(task.id);
      }

      s.cpmResult = result;

      // Belasting/overallocatie herberekenen ná de CPM-pass + samenvattingstaak-rollup hierboven
      // (de resource-belasting mapt op de zojuist bijgewerkte earlyStart/earlyFinish).
      s.resourceLoadResult = computeResourceLoad(
        s.resources, s.assignments, s.tasks, s.calendar, s.calendars,
      );
    });

    // Filter/sort kunnen op de zojuist bijgewerkte totalFloat/isCritical/earlyStart keyen (§4.3).
    get().recomputeViewRows();

    const cpm = get().cpmResult;
    emitExtensionEvent(HOST_EVENTS.scheduleCalculated, {
      hasError: !!cpm?.error,
      error: cpm?.error ?? null,
      criticalTasks: get().tasks.filter((t) => t.time.isCritical).length,
    });
  },

  levelResources: (options) => {
    const s = get();
    const cpm = s.cpmResult;
    if (!cpm || cpm.error) {
      // Geen (geldige) CPM-run: niets te nivelleren — lege, veilige uitkomst.
      const end = cpm?.projectEnd ?? '';
      return { delays: {}, unresolved: {}, unresolvedReasons: {}, shifts: {}, projectEndBefore: end, projectEndAfter: end };
    }
    // De leveler werkt op leaf-taken (net als de CPM-pass in runCPM).
    const leafTasks = s.tasks.filter((t) => t.childIds.length === 0);
    // Fase 2.10 (P1-verwante correctie): dezelfde CPMOptions als `runCPM` hierboven meegeven —
    // zonder `dataDate`/`progressMode` rekende de nivelleerder intern op een pure-ASAP-realiteit
    // die van de echte (actual-gepinde) planning kan afwijken zodra er voortgang+statusdatum is
    // (zie de parameter-toelichting in `ResourceLeveler.ts:levelResources`).
    return computeLeveling(
      leafTasks, s.sequences, s.resources, s.assignments, s.calendar, s.calendars, cpm, options,
      { dataDate: s.project.statusDate, progressMode: s.project.progressMode, schedulingOptions: s.project.schedulingOptions },
    );
  },

  applyLeveling: (result) => {
    set((s) => {
      beginUndoable(s);
      // Idempotent: eerst álle levelingDelays wissen, dan de nieuwe zetten — zo levert een
      // her-nivellering (of een leveling na een eerdere) exact het resultaat van `result`,
      // niet een optelsom.
      for (const task of s.tasks) {
        const d = result.delays[task.id];
        task.levelingDelay = d !== undefined && d > 0 ? d : undefined;
      }
      // Géén stale-vlag: de aansluitende runCPM zet scheduleStale zelf op false.
      finishMutation(s);
    });
    get().runCPM();
  },

  clearLeveling: () => {
    let changed = false;
    set((s) => {
      if (!s.tasks.some((t) => t.levelingDelay !== undefined)) return; // niets te wissen, geen snapshot
      beginUndoable(s);
      for (const task of s.tasks) task.levelingDelay = undefined;
      finishMutation(s); // stale wordt door de aansluitende runCPM gewist.
      changed = true;
    });
    if (changed) get().runCPM();
  },
});
