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

    // Guard: een kalender zonder werkdagen zou anders (via de MAX_SCAN-fallback) stil
    // datums ver in de toekomst opleveren zonder enige waarschuwing. Degradeer met een fout.
    if (!this.calendar.hasWorkingDays()) {
      return {
        tasks: new Map(),
        criticalPath: [],
        projectEnd: '',
        projectDuration: 0,
        error: 'Kalender heeft geen werkdagen ingesteld',
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
    // Vroegste projectstart (= vroegste start onder de taken zónder voorganger). Dient als
    // ondergrens zodat een negatieve lag (lead) een taak niet vóór het projectbegin trekt.
    // Vooraf bepaald, zodat de topologische volgorde de uitkomst niet beïnvloedt.
    let projectStart: Date | null = null;
    for (const t of this.tasks.values()) {
      if ((this.predecessors.get(t.id) || []).length > 0) continue;
      const s = this.calendar.nextWorkDay(parseDate(t.time.scheduleStart));
      if (!projectStart || s < projectStart) projectStart = s;
    }

    for (const taskId of order) {
      const task = this.tasks.get(taskId)!;
      const preds = this.predecessors.get(taskId) || [];

      let earlyStart: Date;

      if (preds.length === 0) {
        // No predecessors: use scheduled start
        earlyStart = this.calendar.nextWorkDay(parseDate(task.time.scheduleStart));
      } else {
        // Early start = max van alle voorganger-constraints, met de projectstart als ondergrens.
        // Die ondergrens is correct vóór ÉLKE relatie: relatie-constraints (FS/SS/FF/SF) zijn
        // ondergrenzen ("niet eerder dan…"), nooit gelijkheden — een taak start dus op z'n
        // vroegst bij het projectbegin. Zo blijft een niet-bindende FF/SF gewoon op de anker
        // (de opvolger haalt de eis vanzelf) en wordt een lead niet vóór dag 1 getrokken.
        earlyStart = projectStart ? new Date(projectStart.getTime()) : new Date(0);
        for (const seq of preds) {
          const predResult = results.get(seq.predecessorId);
          const predTask = this.tasks.get(seq.predecessorId);
          if (!predResult || !predTask) continue;
          const constraintDate = this.getForwardConstraint(predResult, predTask, seq, task);
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
    predTask: Task,
    seq: Sequence,
    successor: Task,
  ): Date {
    // Lag in werkdagen; positief = uitloop, negatief = lead (overlap), 0 = direct aansluitend.
    // Elke tak geeft de door de relatie geëiste vroegste start van de opvolger terug; de
    // projectstart-ondergrens en de max-over-voorgangers worden in forwardPass toegepast
    // (relaties zijn ondergrenzen, geen gelijkheden — een niet-bindende FF/SF zakt zo terug
    // naar de anker i.p.v. de opvolger vóór het projectbegin te trekken).
    const lag = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
    const cal = this.calendar;
    const predIsMilestone = predTask.isMilestone || predTask.time.scheduleDuration <= 0;
    const succDur = successor.isMilestone ? 0 : successor.time.scheduleDuration;
    // Aantal werkdagen tussen start en finish van de opvolger (duur 0/1 => 0).
    const succBack = succDur > 0 ? succDur - 1 : 0;

    switch (seq.type) {
      case 'START_START': {
        // Opvolger start `lag` werkdagen na de start van de voorganger.
        return cal.addWorkingDaysSigned(predResult.es, lag);
      }
      case 'FINISH_FINISH': {
        // Opvolger EINDIGT `lag` werkdagen na de finish van de voorganger → leid de bijbehorende
        // start af (finish − (duur−1)).
        const reqFinish = cal.addWorkingDaysSigned(predResult.ef, lag);
        return cal.addWorkingDaysSigned(reqFinish, -succBack);
      }
      case 'START_FINISH': {
        // Opvolger EINDIGT `lag` werkdagen na de START van de voorganger (zeldzaam).
        const reqFinish = cal.addWorkingDaysSigned(predResult.es, lag);
        return cal.addWorkingDaysSigned(reqFinish, -succBack);
      }
      case 'FINISH_START':
      default: {
        // Eind-Start: opvolger start de werkdag ná de finish van de voorganger, plus `lag`.
        // Een nul-duur-mijlpaal bezet geen dag, dus die "+1 werkdag"-overgang geldt dan niet
        // (anders schuift een tussengevoegde mijlpaal de hele keten een dag op).
        const base = predIsMilestone ? predResult.ef : cal.nextWorkDayAfter(predResult.ef);
        return cal.addWorkingDaysSigned(base, lag);
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

      // Niets kan ná het projecteinde eindigen — dat is de bovengrens voor élke taak. Opvolger-
      // constraints kunnen de late finish alleen verder naar voren halen. (Voorheen kon een
      // Start-Start-opvolger een late finish ná het projecteinde opleveren, waardoor de
      // voorganger ten onrechte speling/niet-kritiek kreeg.)
      let lateFinish = projectEnd;
      for (const seq of succs) {
        const succResult = results.get(seq.successorId);
        if (!succResult) continue;
        const constraintDate = this.getBackwardConstraint(succResult, seq, task);
        if (constraintDate < lateFinish) {
          lateFinish = constraintDate;
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
    predTask: Task,
  ): Date {
    // Spiegel van getForwardConstraint: geef de laatst toegestane FINISH van de voorganger.
    const lag = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
    const cal = this.calendar;
    const predIsMilestone = predTask.isMilestone || predTask.time.scheduleDuration <= 0;
    const predDur = predTask.isMilestone ? 0 : predTask.time.scheduleDuration;
    const predBack = predDur > 0 ? predDur - 1 : 0;

    switch (seq.type) {
      case 'START_START': {
        // Forward: succ.start = pred.start + lag ⇒ pred.start ≤ succ.lateStart − lag.
        const predLS = cal.addWorkingDaysSigned(succResult.ls, -lag);
        return cal.addWorkingDaysSigned(predLS, predBack); // pred.lateFinish
      }
      case 'FINISH_FINISH': {
        // Forward: succ.finish = pred.finish + lag ⇒ pred.finish ≤ succ.lateFinish − lag.
        return cal.addWorkingDaysSigned(succResult.lf, -lag);
      }
      case 'START_FINISH': {
        // Forward: succ.finish = pred.start + lag ⇒ pred.start ≤ succ.lateFinish − lag.
        const predLS = cal.addWorkingDaysSigned(succResult.lf, -lag);
        return cal.addWorkingDaysSigned(predLS, predBack);
      }
      case 'FINISH_START':
      default: {
        // Eind-Start: opvolger start `lag` werkdagen na de finish (de werkdag erná voor een
        // echte taak; bij een mijlpaal-voorganger géén extra dag). Terug-inverteren.
        const target = cal.addWorkingDaysSigned(succResult.ls, -lag);
        return predIsMilestone ? target : cal.prevWorkDayBefore(target);
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


      // Vrije speling: hoeveel werkdagen deze taak kan uitlopen zonder de vroegste datum van
      // een opvolger te raken. `gap(a,b)` = aantal werkdag-stappen tussen twee werkdagen
      // (workDaysBetween is inclusief, dus −1). Per relatietype wordt de juiste datum-koppeling
      // gebruikt; bij FS bezet een echte taak z'n finishdag (vandaar de extra −1), een mijlpaal niet.
      const gap = (a: Date, b: Date) => this.calendar.workDaysBetween(a, b) - 1;
      let freeFloat = Infinity;
      const succs = this.successors.get(taskId) || [];
      if (succs.length === 0) {
        // Eindtaak: vrije speling = totale-speling-equivalent (finish kan opschuiven tot lateFinish).
        freeFloat = gap(early.ef, late.lf);
      } else {
        const thisTask = this.tasks.get(taskId);
        const thisIsMilestone = !thisTask || thisTask.isMilestone || thisTask.time.scheduleDuration <= 0;
        for (const seq of succs) {
          const succEarly = earlyDates.get(seq.successorId);
          if (!succEarly) continue;
          const lag = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
          let ff: number;
          switch (seq.type) {
            case 'START_START':
              ff = gap(early.es, succEarly.es) - lag;
              break;
            case 'FINISH_FINISH':
              ff = gap(early.ef, succEarly.ef) - lag;
              break;
            case 'START_FINISH':
              ff = gap(early.es, succEarly.ef) - lag;
              break;
            case 'FINISH_START':
            default:
              ff = gap(early.ef, succEarly.es) - lag - (thisIsMilestone ? 0 : 1);
              break;
          }
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

    // Projectduur = werkdag-spanne van de vroegste start tot de laatste finish. Een project dat
    // op één moment valt (uitsluitend mijlpalen, geen echt werk) heeft duur 0 i.p.v. de 1 die de
    // inclusieve telling anders zou geven.
    let projStart: Date | null = null;
    for (const { es } of earlyDates.values()) {
      if (!projStart || es < projStart) projStart = es;
    }
    projStart = projStart || new Date();
    let projectDuration = this.calendar.workDaysBetween(projStart, projectEnd);
    if (formatDate(projStart) === formatDate(projectEnd)) {
      const anyRealWork = [...this.tasks.values()].some(
        (t) => !t.isMilestone && t.time.scheduleDuration > 0,
      );
      if (!anyRealWork) projectDuration = 0;
    }

    return {
      tasks: taskResults,
      criticalPath,
      projectEnd: formatDate(projectEnd),
      projectDuration,
    };
  }
}
