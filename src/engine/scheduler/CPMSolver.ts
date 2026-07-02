import { Task } from '@/types/task';
import { Sequence, LagUnit } from '@/types/sequence';
import { CalendarEngine } from './CalendarEngine';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';

export interface CPMResult {
  tasks: Map<string, CPMTaskResult>;
  criticalPath: string[];
  /**
   * Ids van driving relaties (P6-definitie): de door de relatie gegenereerde grens ís de
   * aangenomen early-datum van de opvolger (relationship free float = 0). Gelijkspel is
   * toegestaan — een opvolger kan meerdere driving voorgangers hebben. Rekenresultaat,
   * wordt bewust niet gepersisteerd (ook niet in IFC).
   */
  drivingSequenceIds: string[];
  /** Vrije speling per relatie (werkdagen tussen de geëiste en de werkelijke vroegste datum
   *  van de opvolger). 0 = driving. Basis voor de relatietabel. */
  sequenceFreeFloat: Record<string, number>;
  /** Relaties met een lead (negatieve lag) die door de projectstart-vloer is afgekapt: de lead
   *  wilde de opvolger vóór het projectbegin trekken en is dus niet volledig benut. */
  truncatedLeadSequenceIds: string[];
  projectEnd: string;
  projectDuration: number; // work days
  error?: string; // Set if circular dependency detected
}

/**
 * Effectieve lag in dagen van een relatie: procent-lag wordt uit de ACTUELE voorgangerduur
 * opgelost (MSP-semantiek, afgerond op hele dagen), anders geldt lagDays. Gedeeld met de UI
 * (relatietabel-waarschuwingen) zodat er één definitie bestaat.
 */
export function resolveEffectiveLagDays(seq: Sequence, predTask: Task): number {
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    const predDur = predTask.isMilestone ? 0 : predTask.time.scheduleDuration;
    return Math.round((predDur * seq.lagPercent) / 100);
  }
  return Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
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

  // Per relatie de in de forward-pass gegenereerde (ruwe) vroegst-toegestane start van de
  // opvolger, vóór de projectstart-vloer en de werkdag-snap. Eén bron van waarheid voor
  // vrije speling én driving-markering, ongeacht lag-eenheid.
  private seqConstraint: Map<string, Date> = new Map();
  // Relaties waarvan de lead in de forward-pass door de projectstart-vloer is afgekapt.
  private truncatedLeadIds: string[] = [];

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
        drivingSequenceIds: [],
        sequenceFreeFloat: {},
        truncatedLeadSequenceIds: [],
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
        drivingSequenceIds: [],
        sequenceFreeFloat: {},
        truncatedLeadSequenceIds: [],
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
          drivingSequenceIds: [],
          sequenceFreeFloat: {},
          truncatedLeadSequenceIds: [],
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
        let rawMax: Date | null = null;
        for (const seq of preds) {
          const predResult = results.get(seq.predecessorId);
          const predTask = this.tasks.get(seq.predecessorId);
          if (!predResult || !predTask) continue;
          const constraintDate = this.getForwardConstraint(predResult, predTask, seq, task);
          this.seqConstraint.set(seq.id, constraintDate);
          if (!rawMax || constraintDate > rawMax) rawMax = constraintDate;
          if (constraintDate > earlyStart) {
            earlyStart = constraintDate;
          }
        }
        // Vloer-afkap: wilde óók de strengste relatie de taak nog vóór het projectbegin trekken,
        // markeer dan de bindende lead(s) als afgekapt — de gebruiker moet kunnen zien dat een
        // lead niet volledig benut wordt. Gedomineerde leads zijn gewoon non-driving, geen afkap.
        if (rawMax && projectStart && rawMax < projectStart) {
          for (const seq of preds) {
            const c = this.seqConstraint.get(seq.id);
            const predTask = this.tasks.get(seq.predecessorId);
            if (!c || !predTask) continue;
            if (formatDate(c) === formatDate(rawMax) && resolveEffectiveLagDays(seq, predTask) < 0) {
              this.truncatedLeadIds.push(seq.id);
            }
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

  /** Effectieve lag van een relatie: dagen (via resolveEffectiveLagDays) + eenheid. */
  private resolveLag(seq: Sequence, predTask: Task): { days: number; unit: LagUnit } {
    const unit: LagUnit = seq.lagUnit === 'ELAPSEDTIME' ? 'ELAPSEDTIME' : 'WORKTIME';
    return { days: resolveEffectiveLagDays(seq, predTask), unit };
  }

  private getForwardConstraint(
    predResult: { es: Date; ef: Date },
    predTask: Task,
    seq: Sequence,
    successor: Task,
  ): Date {
    // Lag in dagen; positief = uitloop, negatief = lead (overlap), 0 = direct aansluitend.
    // Werkdag-lag (WORKTIME, default) stapt over werkdagen; kalenderdag-lag (ELAPSEDTIME)
    // telt 24/7 en snapt daarna vooruit naar een werkdag (het is een ondergrens: "niet
    // eerder dan…", dus de eerstvolgende werkdag op of na de ruwe datum voldoet als eerste).
    // Elke tak geeft de door de relatie geëiste vroegste start van de opvolger terug; de
    // projectstart-ondergrens en de max-over-voorgangers worden in forwardPass toegepast
    // (relaties zijn ondergrenzen, geen gelijkheden — een niet-bindende FF/SF zakt zo terug
    // naar de anker i.p.v. de opvolger vóór het projectbegin te trekken).
    const { days: lag, unit } = this.resolveLag(seq, predTask);
    const elapsed = unit === 'ELAPSEDTIME';
    const cal = this.calendar;
    const predIsMilestone = predTask.isMilestone || predTask.time.scheduleDuration <= 0;
    const succDur = successor.isMilestone ? 0 : successor.time.scheduleDuration;
    // Aantal werkdagen tussen start en finish van de opvolger (duur 0/1 => 0).
    const succBack = succDur > 0 ? succDur - 1 : 0;

    switch (seq.type) {
      case 'START_START': {
        // Opvolger start `lag` dagen na de start van de voorganger. Een ruwe elapsed-datum op
        // een weekend hoeft hier niet gesnapt: forwardPass eindigt met nextWorkDay op de max.
        return elapsed
          ? addCalendarDays(predResult.es, lag)
          : cal.addWorkingDaysSigned(predResult.es, lag);
      }
      case 'FINISH_FINISH': {
        // Opvolger EINDIGT `lag` dagen na de finish van de voorganger → leid de bijbehorende
        // start af (finish − (duur−1)). De geëiste finish moet een werkdag zijn vóór de
        // werkdag-aftrek, dus elapsed snapt hier wél (vooruit — ondergrens op de finish).
        const reqFinish = elapsed
          ? cal.nextWorkDay(addCalendarDays(predResult.ef, lag))
          : cal.addWorkingDaysSigned(predResult.ef, lag);
        return cal.addWorkingDaysSigned(reqFinish, -succBack);
      }
      case 'START_FINISH': {
        // Opvolger EINDIGT `lag` dagen na de START van de voorganger (zeldzaam).
        const reqFinish = elapsed
          ? cal.nextWorkDay(addCalendarDays(predResult.es, lag))
          : cal.addWorkingDaysSigned(predResult.es, lag);
        return cal.addWorkingDaysSigned(reqFinish, -succBack);
      }
      case 'FINISH_START':
      default: {
        // Eind-Start: opvolger start de werkdag ná de finish van de voorganger, plus `lag`.
        // Een nul-duur-mijlpaal bezet geen dag, dus die "+1"-overgang geldt dan niet
        // (anders schuift een tussengevoegde mijlpaal de hele keten een dag op).
        // Elapsed telt vanaf de finish-grens: finishdag bezet ⇒ +1 kalenderdag, mijlpaal niet —
        // zo valt FS+0 in beide eenheden samen (eerstvolgende werkdag na de finish).
        if (elapsed) {
          return addCalendarDays(predResult.ef, predIsMilestone ? lag : lag + 1);
        }
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
    // Kalenderdag-lag snapt hier áchteruit (het is een bovengrens: "niet later dan…", dus de
    // laatste werkdag op of vóór de ruwe datum voldoet als laatste) — exact symmetrisch met
    // de vooruit-snap in de forward-pass, zodat een lead geen fantoomfloat oplevert.
    const { days: lag, unit } = this.resolveLag(seq, predTask);
    const elapsed = unit === 'ELAPSEDTIME';
    const cal = this.calendar;
    const predIsMilestone = predTask.isMilestone || predTask.time.scheduleDuration <= 0;
    const predDur = predTask.isMilestone ? 0 : predTask.time.scheduleDuration;
    const predBack = predDur > 0 ? predDur - 1 : 0;

    switch (seq.type) {
      case 'START_START': {
        // Forward: succ.start = pred.start + lag ⇒ pred.start ≤ succ.lateStart − lag.
        const predLS = elapsed
          ? cal.prevWorkDay(addCalendarDays(succResult.ls, -lag))
          : cal.addWorkingDaysSigned(succResult.ls, -lag);
        return cal.addWorkingDaysSigned(predLS, predBack); // pred.lateFinish
      }
      case 'FINISH_FINISH': {
        // Forward: succ.finish = pred.finish + lag ⇒ pred.finish ≤ succ.lateFinish − lag.
        return elapsed
          ? cal.prevWorkDay(addCalendarDays(succResult.lf, -lag))
          : cal.addWorkingDaysSigned(succResult.lf, -lag);
      }
      case 'START_FINISH': {
        // Forward: succ.finish = pred.start + lag ⇒ pred.start ≤ succ.lateFinish − lag.
        const predLS = elapsed
          ? cal.prevWorkDay(addCalendarDays(succResult.lf, -lag))
          : cal.addWorkingDaysSigned(succResult.lf, -lag);
        return cal.addWorkingDaysSigned(predLS, predBack);
      }
      case 'FINISH_START':
      default: {
        // Eind-Start: opvolger start `lag` dagen na de finish (de werkdag erná voor een echte
        // taak; bij een mijlpaal-voorganger géén extra dag). Terug-inverteren; elapsed spiegelt
        // de +1-kalenderdag van de forward-pass.
        if (elapsed) {
          return cal.prevWorkDay(addCalendarDays(succResult.ls, -(predIsMilestone ? lag : lag + 1)));
        }
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

    // Vrije speling per relatie: werkdag-stappen tussen de (gesnapte) geëiste start en de
    // werkelijke vroegste start van de opvolger. 0 = de relatie bindt = driving (P6:
    // relationship free float = 0; gelijkspel ⇒ meerdere driving relaties). Wordt de opvolger
    // door de projectstart-vloer bepaald (volledig geklemde lead), dan bindt geen relatie.
    const sequenceFreeFloat: Record<string, number> = {};
    const drivingSequenceIds: string[] = [];
    for (const seq of this.sequences) {
      const cRaw = this.seqConstraint.get(seq.id);
      const succEarly = earlyDates.get(seq.successorId);
      if (!cRaw || !succEarly) continue;
      const reqStart = this.calendar.nextWorkDay(cRaw);
      const relFloat = this.calendar.workDaysBetween(reqStart, succEarly.es) - 1;
      sequenceFreeFloat[seq.id] = relFloat;
      if (relFloat === 0) drivingSequenceIds.push(seq.id);
    }

    let projectEnd = new Date(0);

    for (const taskId of order) {
      const early = earlyDates.get(taskId)!;
      const late = lateDates.get(taskId)!;


      // Vrije speling van een taak: hoeveel werkdagen hij kan uitlopen zonder de vroegste datum
      // van een opvolger te raken = min van de relatie-vrije-spelingen hierboven. Voor werkdag-lag
      // is dat exact gelijk aan de klassieke per-type formules (gap − lag, met de
      // FS-finishdag-correctie); voor kalenderdag- en procent-lag volgt de juiste waarde
      // automatisch uit dezelfde bron als de planningsberekening zelf.
      const gap = (a: Date, b: Date) => this.calendar.workDaysBetween(a, b) - 1;
      let freeFloat = Infinity;
      const succs = this.successors.get(taskId) || [];
      if (succs.length === 0) {
        // Eindtaak: vrije speling = totale-speling-equivalent (finish kan opschuiven tot lateFinish).
        freeFloat = gap(early.ef, late.lf);
      } else {
        for (const seq of succs) {
          const ff = sequenceFreeFloat[seq.id];
          if (ff !== undefined && ff < freeFloat) freeFloat = ff;
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
      drivingSequenceIds,
      sequenceFreeFloat,
      truncatedLeadSequenceIds: [...this.truncatedLeadIds],
      projectEnd: formatDate(projectEnd),
      projectDuration,
    };
  }
}
