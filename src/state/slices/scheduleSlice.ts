import type { Task } from '@/types/task';
import { CPMSolver, type CPMResult } from '@/engine/scheduler/CPMSolver';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { computeResourceLoad, type ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import {
  levelResources as computeLeveling,
  type LevelingOptions,
  type LevelingResult,
} from '@/engine/scheduler/ResourceLeveler';
import { createSnapshot } from '../snapshot';
import { emitExtensionEvent, HOST_EVENTS } from '@/extensions/eventBus';
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
        s.resources, s.assignments, s.tasks, s.calendar, s.resourceCalendars,
      );
    });
  },

  runCPM: () => {
    set((s) => {
      s.scheduleStale = false; // F5/Bereken gedraaid — schema is (voor deze taken/relaties) vers.
      const calEngine = new CalendarEngine(s.calendar);
      // Only run CPM on leaf tasks (non-summary)
      const leafTasks = s.tasks.filter(t => t.childIds.length === 0);
      const solver = new CPMSolver(leafTasks, s.sequences, calEngine);
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
          // BEWUST GEEN scheduleStart/scheduleFinish meer terugschrijven: scheduleStart is de
          // GEPLANDE anker (waarop de forward-pass voortbouwt) en moet stabiel blijven. Schreven
          // we de berekende earlyStart erin terug, dan bleef een taak na het verwijderen van een
          // relatie op z'n oude (gedrifte) datum hangen i.p.v. terug naar het anker te gaan.
          // De berekende planning leeft in earlyStart/earlyFinish; alle weergave/export gebruikt
          // `earlyStart || scheduleStart`.
        }
      }

      // Update summary tasks (roll up dates from children)
      const updateSummary = (taskId: string) => {
        const task = s.tasks.find(t => t.id === taskId);
        if (!task || task.childIds.length === 0) return;

        for (const childId of task.childIds) {
          updateSummary(childId);
        }

        const children = task.childIds
          .map(cid => s.tasks.find(t => t.id === cid))
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
        s.resources, s.assignments, s.tasks, s.calendar, s.resourceCalendars,
      );
    });

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
    return computeLeveling(
      leafTasks, s.sequences, s.resources, s.assignments, s.calendar, s.resourceCalendars, cpm, options,
    );
  },

  applyLeveling: (result) => {
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      // Idempotent: eerst álle levelingDelays wissen, dan de nieuwe zetten — zo levert een
      // her-nivellering (of een leveling na een eerdere) exact het resultaat van `result`,
      // niet een optelsom.
      for (const task of s.tasks) {
        const d = result.delays[task.id];
        task.levelingDelay = d !== undefined && d > 0 ? d : undefined;
      }
      s.isDirty = true;
    });
    get().runCPM();
  },

  clearLeveling: () => {
    let changed = false;
    set((s) => {
      if (!s.tasks.some((t) => t.levelingDelay !== undefined)) return; // niets te wissen, geen snapshot
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      for (const task of s.tasks) task.levelingDelay = undefined;
      s.isDirty = true;
      changed = true;
    });
    if (changed) get().runCPM();
  },
});
