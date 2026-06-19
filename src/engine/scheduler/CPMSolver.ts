import { Task } from '@/types/task';
import { Sequence } from '@/types/sequence';
import { CalendarEngine } from './CalendarEngine';
import { parseDate, formatDate } from '@/utils/dateUtils';

export interface CPMResult {
  tasks: Map<string, CPMTaskResult>;
  criticalPath: string[];
  projectEnd: string;
  projectDuration: number; // work days
  error?: string; // Set if circular dependency detected
}

export interface CPMTaskResult {
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

export class CPMSolver {
  private tasks: Map<string, Task>;
  private sequences: Sequence[];
  private calendar: CalendarEngine;

  // Adjacency lists
  private successors: Map<string, Sequence[]>; // taskId -> outgoing sequences
  private predecessors: Map<string, Sequence[]>; // taskId -> incoming sequences

  constructor(tasks: Task[], sequences: Sequence[], calendar: CalendarEngine) {
    this.tasks = new Map(tasks.map(t => [t.id, t]));
    this.sequences = sequences;
    this.calendar = calendar;
    this.successors = new Map();
    this.predecessors = new Map();

    for (const task of tasks) {
      this.successors.set(task.id, []);
      this.predecessors.set(task.id, []);
    }
    for (const seq of sequences) {
      this.successors.get(seq.predecessorId)?.push(seq);
      this.predecessors.get(seq.successorId)?.push(seq);
    }
  }

  solve(): CPMResult {
    // Check for circular dependencies before running CPM
    const cycle = this.detectCycle();
    if (cycle) {
      const cycleNames = cycle.map(id => this.tasks.get(id)?.name || id).join(' -> ');
      return {
        tasks: new Map(),
        criticalPath: [],
        projectEnd: '',
        projectDuration: 0,
        error: `Circular dependency detected: ${cycleNames}`,
      };
    }

    // Guard: een taak met een onparseerbare startdatum zou anders Invalid Dates
    // opleveren die het formatteren laten crashen (en vóór de lus-grenzen: hangen).
    // Degradeer netjes met een foutmelding i.p.v. te crashen.
    for (const task of this.tasks.values()) {
      if (isNaN(parseDate(task.time.scheduleStart).getTime())) {
        return {
          tasks: new Map(),
          criticalPath: [],
          projectEnd: '',
          projectDuration: 0,
          error: `Ongeldige startdatum voor taak "${task.name}"`,
        };
      }
    }

    const order = this.topologicalSort();
    const earlyDates = this.forwardPass(order);
    const lateDates = this.backwardPass(order, earlyDates);
    return this.computeResults(order, earlyDates, lateDates);
  }

  /** Detect cycles using DFS. Returns array of task IDs in the cycle, or null. */
  private detectCycle(): string[] | null {
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const id of this.tasks.keys()) {
      color.set(id, 0); // WHITE
    }

    for (const id of this.tasks.keys()) {
      if (color.get(id) === 0) {
        const cycle = this.dfsVisit(id, color, parent);
        if (cycle) return cycle;
      }
    }
    return null;
  }

  private dfsVisit(
    u: string,
    color: Map<string, number>,
    parent: Map<string, string | null>,
  ): string[] | null {
    color.set(u, 1); // GRAY

    for (const seq of this.successors.get(u) || []) {
      const v = seq.successorId;
      if (!this.tasks.has(v)) continue;

      if (color.get(v) === 1) { // GRAY = back edge
        // Back edge found - reconstruct cycle
        const cycle: string[] = [v, u];
        let current = u;
        while (current !== v) {
          const p = parent.get(current);
          if (p === null || p === undefined) break;
          cycle.push(p);
          current = p;
          if (current === v) break;
        }
        cycle.reverse();
        return cycle;
      }

      if (color.get(v) === 0) { // WHITE
        parent.set(v, u);
        const cycle = this.dfsVisit(v, color, parent);
        if (cycle) return cycle;
      }
    }

    color.set(u, 2); // BLACK
    return null;
  }

  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    for (const id of this.tasks.keys()) {
      inDegree.set(id, 0);
    }
    for (const seq of this.sequences) {
      inDegree.set(seq.successorId, (inDegree.get(seq.successorId) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      result.push(id);
      for (const seq of this.successors.get(id) || []) {
        const newDeg = (inDegree.get(seq.successorId) || 1) - 1;
        inDegree.set(seq.successorId, newDeg);
        if (newDeg === 0) queue.push(seq.successorId);
      }
    }

    // Tasks not in the dependency graph (isolated) are still included
    for (const id of this.tasks.keys()) {
      if (!result.includes(id)) result.push(id);
    }

    return result;
  }

  private forwardPass(order: string[]): Map<string, { es: Date; ef: Date }> {
    const results = new Map<string, { es: Date; ef: Date }>();

    for (const taskId of order) {
      const task = this.tasks.get(taskId)!;
      const preds = this.predecessors.get(taskId) || [];

      let earlyStart: Date;

      if (preds.length === 0) {
        // No predecessors: use scheduled start
        earlyStart = this.calendar.nextWorkDay(parseDate(task.time.scheduleStart));
      } else {
        // Early start = max of all predecessor constraints
        earlyStart = new Date(0);
        for (const seq of preds) {
          const predResult = results.get(seq.predecessorId);
          if (!predResult) continue;
          const constraintDate = this.getForwardConstraint(predResult, seq, task);
          if (constraintDate > earlyStart) {
            earlyStart = constraintDate;
          }
        }
        earlyStart = this.calendar.nextWorkDay(earlyStart);
      }

      const duration = task.isMilestone ? 0 : task.time.scheduleDuration;
      const earlyFinish = this.calendar.addWorkDays(earlyStart, duration);

      results.set(taskId, { es: earlyStart, ef: earlyFinish });
    }

    return results;
  }

  private getForwardConstraint(
    predResult: { es: Date; ef: Date },
    seq: Sequence,
    _successor: Task,
  ): Date {
    const lag = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;

    switch (seq.type) {
      case 'START_START': {
        // Successor starts when predecessor starts + lag
        const base = predResult.es;
        return lag > 0 ? this.calendar.addWorkDays(base, lag) : base;
      }
      case 'START_FINISH': {
        // Successor finishes when predecessor starts + lag (very rare, approximate)
        return predResult.es;
      }
      case 'FINISH_START':
      case 'FINISH_FINISH':
      default: {
        // Eind-Start (en Eind-Eind, die we hier benaderen). Onbekende/ongeldige
        // types vallen hier terug i.p.v. `undefined` te retourneren — anders blijft
        // een late-finish op de sentinel-datum staan en loopt CPM vast.
        const base = this.calendar.nextWorkDayAfter(predResult.ef);
        return lag > 0 ? this.calendar.addWorkDays(base, lag) : base;
      }
    }
  }

  private backwardPass(
    order: string[],
    earlyDates: Map<string, { es: Date; ef: Date }>,
  ): Map<string, { ls: Date; lf: Date }> {
    const results = new Map<string, { ls: Date; lf: Date }>();

    // Find project end date (latest early finish)
    let projectEnd = new Date(0);
    for (const { ef } of earlyDates.values()) {
      if (ef > projectEnd) projectEnd = ef;
    }

    // Backward pass in reverse topological order
    const reversed = [...order].reverse();

    for (const taskId of reversed) {
      const task = this.tasks.get(taskId)!;
      const succs = this.successors.get(taskId) || [];

      let lateFinish: Date;

      if (succs.length === 0) {
        lateFinish = projectEnd;
      } else {
        lateFinish = new Date(8640000000000000); // far future
        for (const seq of succs) {
          const succResult = results.get(seq.successorId);
          if (!succResult) continue;
          const constraintDate = this.getBackwardConstraint(succResult, seq);
          if (constraintDate < lateFinish) {
            lateFinish = constraintDate;
          }
        }
      }

      const duration = task.isMilestone ? 0 : task.time.scheduleDuration;
      const lateStart = this.calendar.subtractWorkDays(lateFinish, duration);

      results.set(taskId, { ls: lateStart, lf: lateFinish });
    }

    return results;
  }

  private getBackwardConstraint(
    succResult: { ls: Date; lf: Date },
    seq: Sequence,
  ): Date {
    const lag = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;

    switch (seq.type) {
      case 'START_START': {
        // Predecessor must start before successor starts - lag
        let target = succResult.ls;
        if (lag > 0) target = this.calendar.subtractWorkDays(target, lag);
        return target;
      }
      case 'FINISH_FINISH': {
        let target = succResult.lf;
        if (lag > 0) target = this.calendar.subtractWorkDays(target, lag);
        return target;
      }
      case 'START_FINISH': {
        return succResult.lf;
      }
      case 'FINISH_START':
      default: {
        // Eind-Start: predecessor moet klaar zijn vóór successor start - lag.
        // Onbekende/ongeldige types vallen hier terug (i.p.v. `undefined`), zodat
        // de late-finish niet op de sentinel blijft en CPM niet vastloopt.
        let target = succResult.ls;
        if (lag > 0) target = this.calendar.subtractWorkDays(target, lag);
        return this.calendar.subtractWorkDays(target, 1);
      }
    }
  }

  private computeResults(
    order: string[],
    earlyDates: Map<string, { es: Date; ef: Date }>,
    lateDates: Map<string, { ls: Date; lf: Date }>,
  ): CPMResult {
    const taskResults = new Map<string, CPMTaskResult>();
    const criticalPath: string[] = [];

    let projectEnd = new Date(0);

    for (const taskId of order) {
      const early = earlyDates.get(taskId)!;
      const late = lateDates.get(taskId)!;


      // Free float: min(ES of all successors) - EF - lag
      let freeFloat = Infinity;
      const succs = this.successors.get(taskId) || [];
      if (succs.length === 0) {
        freeFloat = this.calendar.workDaysBetween(early.ef, late.lf);
      } else {
        for (const seq of succs) {
          const succEarly = earlyDates.get(seq.successorId);
          if (!succEarly) continue;
          const lag = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
          const ff = this.calendar.workDaysBetween(early.ef, succEarly.es) - 1 - lag;
          if (ff < freeFloat) freeFloat = ff;
        }
      }
      if (freeFloat === Infinity) freeFloat = 0;
      if (freeFloat < 0) freeFloat = 0;

      const tf = Math.max(0, this.calendar.workDaysBetween(early.es, late.ls) - 1);
      const isCritical = tf === 0;

      if (isCritical) criticalPath.push(taskId);
      if (early.ef > projectEnd) projectEnd = early.ef;

      taskResults.set(taskId, {
        earlyStart: formatDate(early.es),
        earlyFinish: formatDate(early.ef),
        lateStart: formatDate(late.ls),
        lateFinish: formatDate(late.lf),
        totalFloat: tf,
        freeFloat: Math.max(0, freeFloat),
        isCritical,
      });
    }

    const projectDuration = this.calendar.workDaysBetween(
      earlyDates.get(order[0])?.es || new Date(),
      projectEnd,
    );

    return {
      tasks: taskResults,
      criticalPath,
      projectEnd: formatDate(projectEnd),
      projectDuration,
    };
  }
}
