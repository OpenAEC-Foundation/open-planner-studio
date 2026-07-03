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
  /** Taken waarvan de late-zijde-constraint (SNLT/FNLT/MSO/MFO) door de logica wordt
   *  overschreden — de bron van hun negatieve float. */
  violatedConstraintTaskIds: string[];
  /** Taken waarvan de vroege finish voorbij de (zachte) deadline valt. */
  missedDeadlineTaskIds: string[];
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
        violatedConstraintTaskIds: [],
        missedDeadlineTaskIds: [],
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
        violatedConstraintTaskIds: [],
        missedDeadlineTaskIds: [],
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
          violatedConstraintTaskIds: [],
          missedDeadlineTaskIds: [],
          projectEnd: '',
          projectDuration: 0,
          error: `Ongeldige startdatum voor taak "${task.name}"`,
        };
      }
    }

    const order = this.topologicalSort();
    const earlyDates = this.forwardPass(order);
    const lateDates = this.backwardPass(order, earlyDates);
    this.applyAlap(order, earlyDates, lateDates);
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
        earlyStart = this.applyForwardConstraint(task, earlyStart);
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
        earlyStart = this.applyForwardConstraint(task, earlyStart);
        earlyStart = this.calendar.nextWorkDay(earlyStart);
      }

      // Nivelleer-vertraging (fase 2.5, §5.6): schuif de zojuist bepaalde — al werkdag-gesnapte,
      // constraint-toegepaste — early start met de door de leveler gezette `levelingDelay` op.
      // Beide takken hierboven (geen-voorgangers én met-voorgangers) eindigen met een werkdag,
      // dus addWorkingDaysSigned krijgt gegarandeerd een werkdag (invariant). Zo lopen de
      // verschoven datums gewoon door de backward pass -> float wordt eerlijk herrekend (geen
      // phantom float, §10-P2). `levelingDelay` undefined of 0 => exacte no-op (alle bestaande
      // cases blijven ongewijzigd).
      if (task.levelingDelay) {
        earlyStart = this.calendar.addWorkingDaysSigned(earlyStart, task.levelingDelay);
      }

      const duration = task.isMilestone ? 0 : task.time.scheduleDuration;
      const earlyFinish = this.calendar.addWorkDays(earlyStart, duration);

      results.set(taskId, { es: earlyStart, ef: earlyFinish });
    }

    return results;
  }

  /** Getekend werkdag-verschil: a≤b ⇒ +stappen, a>b ⇒ −stappen (negatieve float mogelijk). */
  private signedWorkDays(a: Date, b: Date): number {
    return a <= b
      ? this.calendar.workDaysBetween(a, b) - 1
      : -(this.calendar.workDaysBetween(b, a) - 1);
  }

  /** Werkdag-gesnapte constraint-datum, of null bij afwezig/onparseerbaar (soft: negeren). */
  private constraintDate(task: Task): Date | null {
    const raw = task.constraint?.date;
    if (!raw) return null;
    const d = parseDate(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Vroege-zijde constraints (fase 2.3): SNET/MSO als start-ondergrens, FNET/MFO als
   * finish-ondergrens (vertaald naar de start). Ondergrenzen — de max met de logica,
   * dus een constraint vóór de logica-datum doet niets (P6-soft).
   */
  private applyForwardConstraint(task: Task, earlyStart: Date): Date {
    const c = task.constraint;
    const d = this.constraintDate(task);
    if (!c || !d) return earlyStart;
    const dur = task.isMilestone ? 0 : task.time.scheduleDuration;
    const back = dur > 0 ? dur - 1 : 0;
    let bound: Date | null = null;
    if (c.type === 'SNET' || c.type === 'MSO') {
      bound = this.calendar.nextWorkDay(d);
    } else if (c.type === 'FNET' || c.type === 'MFO') {
      bound = this.calendar.addWorkingDaysSigned(this.calendar.nextWorkDay(d), -back);
    }
    return bound && bound > earlyStart ? bound : earlyStart;
  }

  /**
   * Late-zijde grenzen (fase 2.3): SNLT/MSO kappen de late start (⇒ late finish op
   * datum ⊕ (duur−1)), FNLT/MFO en de zachte deadline kappen de late finish direct.
   * Bovengrenzen in de backward pass — vroege datums bewegen nooit; overschrijding
   * door de logica wordt negatieve float.
   */
  private applyBackwardBound(task: Task, lateFinish: Date): Date {
    let lf = lateFinish;
    const c = task.constraint;
    const d = this.constraintDate(task);
    if (c && d) {
      const dur = task.isMilestone ? 0 : task.time.scheduleDuration;
      const back = dur > 0 ? dur - 1 : 0;
      const dW = this.calendar.prevWorkDay(d);
      if (c.type === 'FNLT' || c.type === 'MFO') {
        if (dW < lf) lf = dW;
      } else if (c.type === 'SNLT' || c.type === 'MSO') {
        const bound = this.calendar.addWorkingDaysSigned(dW, back);
        if (bound < lf) lf = bound;
      }
    }
    if (task.deadline) {
      const dl = parseDate(task.deadline);
      if (!isNaN(dl.getTime())) {
        const dlW = this.calendar.prevWorkDay(dl);
        if (dlW < lf) lf = dlW;
      }
    }
    return lf;
  }

  /**
   * ALAP (P6-semantiek, zero free float): schuif de vroege datums van ALAP-taken op met
   * hun eigen vrije speling — opvolgers bewegen per definitie niet. Draait ná de backward
   * pass; de constraint-cache van uitgaande relaties wordt geactualiseerd zodat de
   * relatie-floats en driving-markering daarna kloppen (de relatie wordt precies bindend).
   */
  private applyAlap(
    order: string[],
    earlyDates: Map<string, { es: Date; ef: Date }>,
    lateDates: Map<string, { ls: Date; lf: Date }>,
  ): void {
    for (const taskId of order) {
      const task = this.tasks.get(taskId);
      if (task?.constraint?.type !== 'ALAP') continue;
      const early = earlyDates.get(taskId);
      const late = lateDates.get(taskId);
      if (!early || !late) continue;

      const succs = this.successors.get(taskId) || [];
      let ff = Infinity;
      if (succs.length === 0) {
        ff = this.signedWorkDays(early.ef, late.lf);
      } else {
        for (const seq of succs) {
          const cRaw = this.seqConstraint.get(seq.id);
          const succEarly = earlyDates.get(seq.successorId);
          if (!cRaw || !succEarly) continue;
          const f = this.calendar.workDaysBetween(this.calendar.nextWorkDay(cRaw), succEarly.es) - 1;
          if (f < ff) ff = f;
        }
      }
      if (!Number.isFinite(ff) || ff <= 0) continue;

      early.es = this.calendar.addWorkingDaysSigned(early.es, ff);
      early.ef = this.calendar.addWorkingDaysSigned(early.ef, ff);
      for (const seq of succs) {
        const succTask = this.tasks.get(seq.successorId);
        if (!succTask) continue;
        this.seqConstraint.set(seq.id, this.getForwardConstraint(early, task, seq, succTask));
      }
    }
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
    // Grens-model mijlpaalsoorten (fase 2.4): een startmijlpaal (en het automatische
    // legacy-anker) ligt op een dagBEGIN — zijn "finish" bezet geen dag, dus opvolgers
    // op de startzijde beginnen dezelfde dag. Een eindmijlpaal ligt op een dagEINDE:
    // zijn finish-grens valt samen met die van een echte taak (opvolger start de werkdag
    // erna) en zijn "start"-moment is diezelfde dag-eindgrens.
    const predKind = predTask.isMilestone ? predTask.milestoneKind : undefined;
    const predEndsBeginOfDay = predIsMilestone && predKind !== 'FINISH';
    const predStartsNextDay = predIsMilestone && predKind === 'FINISH';
    const succIsFinishMs = successor.isMilestone && successor.milestoneKind === 'FINISH';
    const succIsStartMs = successor.isMilestone && successor.milestoneKind === 'START';

    switch (seq.type) {
      case 'START_START': {
        // Opvolger start `lag` dagen na de start van de voorganger. Een ruwe elapsed-datum op
        // een weekend hoeft hier niet gesnapt: forwardPass eindigt met nextWorkDay op de max.
        // Het "start"-moment van een eindmijlpaal is zijn dag-eindgrens ⇒ werkdag erna.
        if (elapsed) {
          return addCalendarDays(predResult.es, predStartsNextDay ? lag + 1 : lag);
        }
        const base = predStartsNextDay ? cal.nextWorkDayAfter(predResult.es) : predResult.es;
        return cal.addWorkingDaysSigned(base, lag);
      }
      case 'FINISH_FINISH': {
        // Opvolger EINDIGT `lag` dagen na de finish van de voorganger → leid de bijbehorende
        // start af (finish − (duur−1)). De geëiste finish moet een werkdag zijn vóór de
        // werkdag-aftrek, dus elapsed snapt hier wél (vooruit — ondergrens op de finish).
        const reqFinish = elapsed
          ? cal.nextWorkDay(addCalendarDays(predResult.ef, lag))
          : cal.addWorkingDaysSigned(predResult.ef, lag);
        // Een startmijlpaal-opvolger (dagbegin-anker) kan pas op de werkdag ná een
        // dag-eindgrens liggen; na een dagbegin-voorganger (start-/auto-mijlpaal) niet.
        if (succIsStartMs && !predEndsBeginOfDay) return cal.nextWorkDayAfter(reqFinish);
        return cal.addWorkingDaysSigned(reqFinish, -succBack);
      }
      case 'START_FINISH': {
        // Opvolger EINDIGT `lag` dagen na de START van de voorganger (zeldzaam).
        const reqFinish = elapsed
          ? cal.nextWorkDay(addCalendarDays(predResult.es, predStartsNextDay ? lag + 1 : lag))
          : cal.addWorkingDaysSigned(
              predStartsNextDay ? cal.nextWorkDayAfter(predResult.es) : predResult.es,
              lag,
            );
        return cal.addWorkingDaysSigned(reqFinish, -succBack);
      }
      case 'FINISH_START':
      default: {
        // Eind-Start: opvolger start de werkdag ná de finish van de voorganger, plus `lag`.
        // Een dagbegin-mijlpaal bezet geen dag, dus die "+1"-overgang geldt dan niet
        // (anders schuift een tussengevoegde mijlpaal de hele keten een dag op). Een
        // eindmijlpaal-opvolger ankert juist op de finish-grens zelf (zelfde daglabel).
        // Elapsed telt vanaf de finish-grens: finishdag bezet ⇒ +1 kalenderdag —
        // zo valt FS+0 in beide eenheden samen (eerstvolgende werkdag na de finish).
        if (elapsed) {
          const plus = succIsFinishMs || predEndsBeginOfDay ? lag : lag + 1;
          return addCalendarDays(predResult.ef, plus);
        }
        const base = succIsFinishMs || predEndsBeginOfDay
          ? predResult.ef
          : cal.nextWorkDayAfter(predResult.ef);
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
        const succTask = this.tasks.get(seq.successorId);
        if (!succResult || !succTask) continue;
        const constraintDate = this.getBackwardConstraint(succResult, seq, task, succTask);
        if (constraintDate < lateFinish) {
          lateFinish = constraintDate;
        }
      }

      // Late-zijde datum-constraints + deadline (fase 2.3) als extra bovengrens.
      lateFinish = this.applyBackwardBound(task, lateFinish);

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
    succTask: Task,
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
    // Zelfde grens-model-vlaggen als in getForwardConstraint (fase 2.4).
    const predKind = predTask.isMilestone ? predTask.milestoneKind : undefined;
    const predEndsBeginOfDay = predIsMilestone && predKind !== 'FINISH';
    const predStartsNextDay = predIsMilestone && predKind === 'FINISH';
    const succIsFinishMs = succTask.isMilestone && succTask.milestoneKind === 'FINISH';
    const succIsStartMs = succTask.isMilestone && succTask.milestoneKind === 'START';

    switch (seq.type) {
      case 'START_START': {
        // Forward: succ.start = pred.start(-moment) + lag ⇒ pred.start ≤ succ.lateStart − lag;
        // het startmoment van een eindmijlpaal-voorganger ligt een werkdag vóór die grens.
        const predLS = elapsed
          ? cal.prevWorkDay(addCalendarDays(succResult.ls, -(predStartsNextDay ? lag + 1 : lag)))
          : predStartsNextDay
            ? cal.prevWorkDayBefore(cal.addWorkingDaysSigned(succResult.ls, -lag))
            : cal.addWorkingDaysSigned(succResult.ls, -lag);
        return cal.addWorkingDaysSigned(predLS, predBack); // pred.lateFinish
      }
      case 'FINISH_FINISH': {
        // Forward: succ.finish = pred.finish + lag ⇒ pred.finish ≤ succ.lateFinish − lag.
        // Een startmijlpaal-opvolger lag een werkdag ná de finish-grens (zie forward).
        const succLf = succIsStartMs && !predEndsBeginOfDay
          ? cal.prevWorkDayBefore(succResult.lf)
          : succResult.lf;
        return elapsed
          ? cal.prevWorkDay(addCalendarDays(succLf, -lag))
          : cal.addWorkingDaysSigned(succLf, -lag);
      }
      case 'START_FINISH': {
        // Forward: succ.finish = pred.start(-moment) + lag ⇒ pred.start ≤ succ.lateFinish − lag.
        const predLS = elapsed
          ? cal.prevWorkDay(addCalendarDays(succResult.lf, -(predStartsNextDay ? lag + 1 : lag)))
          : predStartsNextDay
            ? cal.prevWorkDayBefore(cal.addWorkingDaysSigned(succResult.lf, -lag))
            : cal.addWorkingDaysSigned(succResult.lf, -lag);
        return cal.addWorkingDaysSigned(predLS, predBack);
      }
      case 'FINISH_START':
      default: {
        // Eind-Start: opvolger start `lag` dagen na de finish (de werkdag erná voor een echte
        // taak; bij een dagbegin-mijlpaal-voorganger of eindmijlpaal-opvolger géén extra dag).
        // Terug-inverteren; elapsed spiegelt de +1-kalenderdag van de forward-pass.
        if (elapsed) {
          const plus = succIsFinishMs || predEndsBeginOfDay ? lag : lag + 1;
          return cal.prevWorkDay(addCalendarDays(succResult.ls, -plus));
        }
        const target = cal.addWorkingDaysSigned(succResult.ls, -lag);
        return succIsFinishMs || predEndsBeginOfDay ? target : cal.prevWorkDayBefore(target);
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
    const violatedConstraintTaskIds: string[] = [];
    const missedDeadlineTaskIds: string[] = [];
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
      let freeFloat = Infinity;
      const succs = this.successors.get(taskId) || [];
      if (succs.length === 0) {
        // Eindtaak: vrije speling = totale-speling-equivalent (finish kan opschuiven tot
        // lateFinish) — getekend: een deadline/late-zijde-constraint kan hem negatief maken.
        freeFloat = this.signedWorkDays(early.ef, late.lf);
      } else {
        for (const seq of succs) {
          const ff = sequenceFreeFloat[seq.id];
          if (ff !== undefined && ff < freeFloat) freeFloat = ff;
        }
      }
      if (freeFloat === Infinity) freeFloat = 0;

      // Totale speling: getekend (fase 2.3 — negatieve float bij geschonden late-zijde-
      // constraints/deadlines), MSP-veilig als min van finish- en start-float (die kunnen
      // verschillen wanneer een SNLT alleen de late start kapt). Kritiek = tf ≤ 0.
      const tf = Math.min(
        this.signedWorkDays(early.ef, late.lf),
        this.signedWorkDays(early.es, late.ls),
      );
      const isCritical = tf <= 0;

      if (isCritical) criticalPath.push(taskId);
      if (early.ef > projectEnd) projectEnd = early.ef;

      // Geschonden constraints / gemiste deadlines (bron van de negatieve float).
      const task = this.tasks.get(taskId);
      if (task) {
        const cd = this.constraintDate(task);
        if (task.constraint && cd) {
          const dW = this.calendar.prevWorkDay(cd);
          const ct = task.constraint.type;
          if (((ct === 'SNLT' || ct === 'MSO') && early.es > dW)
            || ((ct === 'FNLT' || ct === 'MFO') && early.ef > dW)) {
            violatedConstraintTaskIds.push(taskId);
          }
        }
        if (task.deadline) {
          const dl = parseDate(task.deadline);
          if (!isNaN(dl.getTime()) && early.ef > this.calendar.prevWorkDay(dl)) {
            missedDeadlineTaskIds.push(taskId);
          }
        }
      }

      taskResults.set(taskId, {
        earlyStart: formatDate(early.es),
        earlyFinish: formatDate(early.ef),
        lateStart: formatDate(late.ls),
        lateFinish: formatDate(late.lf),
        totalFloat: tf,
        freeFloat,
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
      violatedConstraintTaskIds,
      missedDeadlineTaskIds,
      projectEnd: formatDate(projectEnd),
      projectDuration,
    };
  }
}
