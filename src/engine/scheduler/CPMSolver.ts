import { Task, type TaskConstraint } from '@/types/task';
import type { SchedulingOptions } from '@/types/project';
import { Sequence, LagUnit } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { LAG_CALENDAR } from './lagCalendar';
import {
  parseDate, formatDate, addCalendarDays, parseInstant, formatInstant, type DateMode,
} from '@/utils/dateUtils';
import { durationMinutesOf, durationDaysOf } from './duration';
import { traceFrom } from './graphWalk';

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
  /** Relaties waarvan de opvolger progress/actuals heeft die de voorganger-logica tegenspreekt
   *  (out-of-sequence, fase 2.6). Waarschuwing, geen fout — het gedrag volgt uit de progressMode. */
  outOfSequenceSequenceIds: string[];
  /** Near-critical-taken (fase 2.9, §4.6): 0 < tf ≤ drempel. Leeg als de drempel ongezet is. */
  nearCriticalTaskIds: string[];
  /** Alle kritieke ketens (fase 2.9, §4.6). ALTIJD aanwezig, lengte ≥1; `criticalPaths[0] ==
   *  criticalPath`. Staat `floatPaths` uit, dan is dit precies `[criticalPath]` — zo hoeven
   *  consumenten nooit op `undefined` te checken (byte-compat: één keten in een array gewikkeld). */
  criticalPaths: string[][];
  /** Float-path-nummer per taak (fase 2.9, §4.6): 1 = meest kritiek. Leeg als `floatPaths` uit. */
  floatPathByTask: Record<string, number>;
  projectEnd: string;
  projectDuration: number; // work days
  error?: string; // Set if circular dependency detected
}

/** Voortgangs-opties (fase 2.6). Leeg ⇒ geen statusdatum-gedrag (byte-identiek aan vóór 2.6). */
export interface CPMOptions {
  dataDate?: string;                                     // ISO date; undefined ⇒ geen statusdatum-gedrag
  progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE'; // default RETAINED_LOGIC
  /** Project-scoped reken-opties (fase 2.9, §3.4). Afwezig ⇒ elke default ⇒ byte-identiek. In golf 0
   *  wordt dit blok alleen doorgegeven; de solver leest het nog nergens gedragswijzigend. */
  schedulingOptions?: SchedulingOptions;
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
  /** OPTIONEEL — interfererende speling = totalFloat − freeFloat (fase 2.9, §4.6). Alleen
   *  geschreven wanneer de analyse-laag draait; ongeschreven ⇒ byte-identiek default. */
  interferingFloat?: number;
  /** OPTIONEEL — near-critical (fase 2.9, §4.6). Alleen geschreven bij ingestelde drempel. */
  isNearCritical?: boolean;
  /** OPTIONEEL — float-path-nummer (fase 2.9, §4.6). Alleen geschreven bij floatPaths. */
  floatPath?: number;
}

export class CPMSolver {
  private tasks: Map<string, Task>;
  private sequences: Sequence[];
  // Per-taak-kalender (fase 2.8a, §5.1): de projectdefault-engine voor project-brede grenslogica,
  // plus een cache van engines per bibliotheek-kalender. `calendarFor(task)` levert de engine waarin
  // de duur/constraints/float van díé taak rekenen; zonder afwijkende `task.calendarId` valt alles
  // terug op `projectEngine` ⇒ byte-identiek aan het één-kalender-gedrag van vóór 2.8a.
  private projectCal: WorkCalendar;
  private registry: WorkCalendar[];
  private projectEngine: CalendarEngine;
  private engineCache = new Map<string, CalendarEngine>();

  // Adjacency lists
  private successors: Map<string, Sequence[]>; // taskId -> outgoing sequences
  private predecessors: Map<string, Sequence[]>; // taskId -> incoming sequences

  // Per relatie de in de forward-pass gegenereerde (ruwe) vroegst-toegestane start van de
  // opvolger, vóór de projectstart-vloer en de werkdag-snap. Eén bron van waarheid voor
  // vrije speling én driving-markering, ongeacht lag-eenheid.
  private seqConstraint: Map<string, Date> = new Map();
  // Relaties waarvan de lead in de forward-pass door de projectstart-vloer is afgekapt.
  private truncatedLeadIds: string[] = [];
  // Taken met een harde MSO/MFO-pin (fase 2.9, §4.2) waarvan de voorganger-druk (`rawMax`) later
  // valt dan de pin ⇒ de logica is gebroken (taak start vóór z'n voorganger klaar is). Verzameld in
  // de forward pass, samengevoegd met `violatedConstraintTaskIds` in `computeResults`.
  private hardPinViolatedIds: string[] = [];

  private options: CPMOptions;
  // Werkdag-gesnapte statusdatum (fase 2.6), of null ⇒ geen statusdatum-gedrag. Gezet in solve().
  private dataDate: Date | null = null;

  constructor(
    tasks: Task[],
    sequences: Sequence[],
    projectCalendar: WorkCalendar,
    registry: WorkCalendar[] = [],
    options: CPMOptions = {},
  ) {
    this.tasks = new Map(tasks.map(t => [t.id, t]));
    this.sequences = sequences;
    this.projectCal = projectCalendar;
    this.registry = registry;
    this.projectEngine = new CalendarEngine(projectCalendar);
    this.engineCache.set(projectCalendar.id, this.projectEngine);
    this.options = options;
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

  /** Engine voor een concrete kalender (gecachet op kalender-id). */
  private engineForCal(cal: WorkCalendar): CalendarEngine {
    let e = this.engineCache.get(cal.id);
    if (!e) { e = new CalendarEngine(cal); this.engineCache.set(cal.id, e); }
    return e;
  }

  /** De kalender-engine waarin de duur/constraints/float van `task` rekenen (§5.2). */
  private calendarFor(task: Task): CalendarEngine {
    return this.engineForCal(resolveCalendar(task.calendarId, this.registry, this.projectCal));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Fase 2.8b (golf 2) — MODUS-BEWUSTE rekenkern (§5). Elke helper reduceert in
  //  DAG-modus tot exact de bestaande dag-expressie (byte-identiek); alleen een
  //  UUR-kalender (`isHourMode`) activeert het minuut-native pad. Zo blijven de 290
  //  dag-cases + 23 examples ongemoeid — de constructie, niet een her-derivatie (§2.2).
  // ═══════════════════════════════════════════════════════════════════════════
  private static readonly MS_PER_MIN = 60_000;
  private static readonly MS_PER_DAY = 86_400_000;
  private static readonly HOUR_SCAN = 400;

  /** Parse een datum-string in de kalendermodus: dag ⇒ `parseDate` (middernacht, byte-identiek),
   *  uur ⇒ `parseInstant` (behoudt tijd-van-de-dag). */
  private parseIn(eng: CalendarEngine, iso: string): Date {
    return eng.isHourMode ? parseInstant(iso) : parseDate(iso);
  }
  /** Snap op-of-ná (voorwaarts): dag ⇒ `nextWorkDay`, uur ⇒ `nextWorkInstant`. */
  private snapOnOrAfter(eng: CalendarEngine, d: Date): Date {
    return eng.isHourMode ? eng.nextWorkInstant(d) : eng.nextWorkDay(d);
  }
  /** Snap op-of-vóór (achterwaarts): dag ⇒ `prevWorkDay`, uur ⇒ `prevWorkInstant`. */
  private snapOnOrBefore(eng: CalendarEngine, d: Date): Date {
    return eng.isHourMode ? eng.prevWorkInstant(d) : eng.prevWorkDay(d);
  }
  /** Snap strikt ná: dag ⇒ `nextWorkDayAfter`, uur ⇒ `nextWorkInstantAfter`. */
  private snapStrictAfter(eng: CalendarEngine, d: Date): Date {
    return eng.isHourMode ? eng.nextWorkInstantAfter(d) : eng.nextWorkDayAfter(d);
  }
  /** Snap strikt vóór: dag ⇒ `prevWorkDayBefore`, uur ⇒ `prevWorkInstantBefore`. */
  private snapStrictBefore(eng: CalendarEngine, d: Date): Date {
    return eng.isHourMode ? eng.prevWorkInstantBefore(d) : eng.prevWorkDayBefore(d);
  }
  private modeOf(eng: CalendarEngine): DateMode {
    return eng.isHourMode ? 'hour' : 'day';
  }
  /** UTC-middernacht van de dag die `d` bevat (voor de cross-modus-dagrand, §4.3/§5.2). */
  private startOfDay(d: Date): Date {
    return new Date(Math.floor(d.getTime() / CPMSolver.MS_PER_DAY) * CPMSolver.MS_PER_DAY);
  }

  /** Vroege finish = start ⊕ duur (§5.1). Mijlpaal ⇒ 0; uur ⇒ `addWorkMinutes(durationMinutesOf)`;
   *  dag ⇒ `addWorkDays(durationDaysOf)` — LETTERLIJK de huidige regel (`durationDaysOf` levert op een
   *  dag-kalender altijd de integer `scheduleDuration`, nooit een fractionele dag, Bevinding 2). */
  private addDuration(eng: CalendarEngine, start: Date, task: Task): Date {
    if (task.isMilestone) return new Date(start.getTime());
    return eng.isHourMode
      ? eng.addWorkMinutes(start, durationMinutesOf(task, eng))
      : eng.addWorkDays(start, durationDaysOf(task, eng));
  }
  /** Late start = late finish ⊖ duur (§5.1, spiegel van `addDuration`). */
  private subDuration(eng: CalendarEngine, end: Date, task: Task): Date {
    if (task.isMilestone) return new Date(end.getTime());
    return eng.isHourMode
      ? eng.subtractWorkMinutes(end, durationMinutesOf(task, eng))
      : eng.subtractWorkDays(end, durationDaysOf(task, eng));
  }

  /** WORKTIME-lag in MINUTEN in de voorganger-kalender (§5.2): procent ⇒ uit `durationMinutesOf(pred)`;
   *  `lagMinutes` ⇒ bron; anders `lagDays × pred-hoursPerDay × 60` (naakt getal = werkdagen). */
  private resolveLagMinutes(seq: Sequence, predTask: Task, predEng: CalendarEngine): number {
    if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
      const predMin = predTask.isMilestone ? 0 : durationMinutesOf(predTask, predEng);
      return Math.round((predMin * seq.lagPercent) / 100);
    }
    if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) return seq.lagMinutes;
    const days = Number.isFinite(seq.lagDays) ? seq.lagDays : 0;
    return days * predEng.hoursPerDay * 60;
  }
  /** ELAPSEDTIME-lag in KLOK-minuten (24/7, §5.2): `lagMinutes` ⇒ bron; anders (procent/)dagen × 24 × 60. */
  private resolveElapsedMinutes(seq: Sequence, predTask: Task): number {
    if (typeof seq.lagMinutes === 'number' && Number.isFinite(seq.lagMinutes)) return seq.lagMinutes;
    return resolveEffectiveLagDays(seq, predTask) * 24 * 60;
  }
  /** Verschuif `base` met de relatie-lag in de VOORGANGER-engine (`LAG_CALENDAR='predecessor'`, §5.2).
   *  Uur-pred ⇒ minuten via `addWorkingMinutesSigned`; dag-pred ⇒ dagen via `addWorkingDaysSigned`
   *  (dag-lag blijft exact als nu). `sign` = +1 voorwaarts, −1 achterwaarts (spiegel). */
  private shiftLagPred(
    predEng: CalendarEngine, base: Date, seq: Sequence, predTask: Task, sign: 1 | -1,
  ): Date {
    if (predEng.isHourMode) {
      return predEng.addWorkingMinutesSigned(base, sign * this.resolveLagMinutes(seq, predTask, predEng));
    }
    return predEng.addWorkingDaysSigned(base, sign * resolveEffectiveLagDays(seq, predTask));
  }

  /** Leid de opvolger-START af uit zijn geëiste FINISH (FF/SF, §5.2): uur ⇒ `subtractWorkMinutes`;
   *  dag ⇒ `addWorkingDaysSigned(−(dur−1))` — de bestaande inclusieve-dag-aftrek. */
  private startFromFinish(eng: CalendarEngine, finish: Date, task: Task): Date {
    if (eng.isHourMode) {
      if (task.isMilestone) return new Date(finish.getTime());
      return eng.subtractWorkMinutes(finish, durationMinutesOf(task, eng));
    }
    const dur = task.isMilestone ? 0 : task.time.scheduleDuration;
    return eng.addWorkingDaysSigned(finish, -(dur > 0 ? dur - 1 : 0));
  }
  /** Leid de voorganger-FINISH af uit zijn late START (SS/SF backward, §5.2, spiegel van
   *  `startFromFinish`): uur ⇒ `addWorkMinutes`; dag ⇒ `addWorkingDaysSigned(dur−1)`. */
  private finishFromStart(eng: CalendarEngine, start: Date, task: Task): Date {
    if (eng.isHourMode) {
      if (task.isMilestone) return new Date(start.getTime());
      return eng.addWorkMinutes(start, durationMinutesOf(task, eng));
    }
    const dur = task.isMilestone ? 0 : task.time.scheduleDuration;
    return eng.addWorkingDaysSigned(start, dur > 0 ? dur - 1 : 0);
  }
  /** Getekende float in eigen-kalender-WERKDAGEN (§5.5, Bevinding 1): uur ⇒ fractioneel
   *  `workMinutesBetween / (hoursPerDay × 60)`; dag ⇒ de bestaande integer `signedWorkDays`. */
  private signedFloat(a: Date, b: Date, eng: CalendarEngine): number {
    if (eng.isHourMode) return eng.workMinutesBetween(a, b) / (eng.hoursPerDay * 60);
    return this.signedWorkDays(a, b, eng);
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
        outOfSequenceSequenceIds: [],
        nearCriticalTaskIds: [],
        criticalPaths: [[]],
        floatPathByTask: {},
        projectEnd: '',
        projectDuration: 0,
        error: `Circular dependency detected: ${cycleNames}`,
      };
    }

    // Guard: een kalender zonder werkdagen zou anders (via de MAX_SCAN-fallback) stil
    // datums ver in de toekomst opleveren zonder enige waarschuwing. Degradeer met een fout.
    if (!this.projectEngine.hasWorkingDays()) {
      return {
        tasks: new Map(),
        criticalPath: [],
        drivingSequenceIds: [],
        sequenceFreeFloat: {},
        truncatedLeadSequenceIds: [],
        violatedConstraintTaskIds: [],
        missedDeadlineTaskIds: [],
        outOfSequenceSequenceIds: [],
        nearCriticalTaskIds: [],
        criticalPaths: [[]],
        floatPathByTask: {},
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
          outOfSequenceSequenceIds: [],
          nearCriticalTaskIds: [],
          criticalPaths: [[]],
          floatPathByTask: {},
          projectEnd: '',
          projectDuration: 0,
          error: `Ongeldige startdatum voor taak "${task.name}"`,
        };
      }
    }

    // Werkdag-gesnapte statusdatum (fase 2.6). Ongeldig/afwezig ⇒ null (alle voortgangstakken no-op).
    // Uur-projectkalender ⇒ instant-snap via `nextWorkInstant` (§5.3); dag ⇒ `nextWorkDay` (byte-identiek).
    const dd = this.options.dataDate ? this.parseIn(this.projectEngine, this.options.dataDate) : null;
    this.dataDate = dd && !isNaN(dd.getTime()) ? this.snapOnOrAfter(this.projectEngine, dd) : null;

    const order = this.topologicalSort();
    const earlyDates = this.forwardPass(order);
    const lateDates = this.backwardPass(order, earlyDates);
    this.applyAlap(order, earlyDates, lateDates);
    const outOfSequenceSequenceIds = this.detectOutOfSequence(earlyDates);
    return this.computeResults(order, earlyDates, lateDates, outOfSequenceSequenceIds);
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
      const eng = this.calendarFor(t);
      const s = this.snapOnOrAfter(eng, this.parseIn(eng, t.time.scheduleStart));
      if (!projectStart || s < projectStart) projectStart = s;
    }

    for (const taskId of order) {
      const task = this.tasks.get(taskId)!;
      const cal = this.calendarFor(task);
      const preds = this.predecessors.get(taskId) || [];

      let earlyStart: Date;

      if (preds.length === 0) {
        // No predecessors: use scheduled start
        earlyStart = this.snapOnOrAfter(cal, this.parseIn(cal, task.time.scheduleStart));
        // Geen voorganger-druk ⇒ rawMax null ⇒ een (root-)pin kan de logica niet breken (§4.2).
        earlyStart = this.applyForwardConstraints(task, earlyStart, null, cal);
        // Fase 2.8b (golf 3): her-snap ná de constraint — spiegelt de voorganger-tak (regel 466).
        // `applyForwardConstraint` levert een DAG-conceptuele grens (`nextWorkDay`/
        // `addWorkingDaysSigned`, §5.2), in uur-modus een middernacht-instant die NIET op een
        // werk-instant valt; zonder her-snap rapporteert een constrained root-taak zijn ES op 00:00
        // i.p.v. de bandstart (de `earlyFinish` rekent al vanaf de bandstart ⇒ interne inconsistentie).
        // Idempotent in dag-modus (`nextWorkDay` van een werkdag = diezelfde werkdag) en bij een
        // niet-bindende constraint (ES al gesnapt op regel 429) ⇒ byte-identiek voor de 290.
        earlyStart = this.snapOnOrAfter(cal, earlyStart);
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
          const constraintDate = this.getForwardConstraint(
            predResult, predTask, seq, task, this.calendarFor(predTask), cal,
          );
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
        // `rawMax` (voorganger-druk) voedt de harde-pin-logicaschending-detectie (§4.2).
        earlyStart = this.applyForwardConstraints(task, earlyStart, rawMax, cal);
        earlyStart = this.snapOnOrAfter(cal, earlyStart);
      }

      // Nivelleer-vertraging (fase 2.5, §5.6): schuif de zojuist bepaalde — al werkdag-gesnapte,
      // constraint-toegepaste — early start met de door de leveler gezette `levelingDelay` op.
      // Beide takken hierboven (geen-voorgangers én met-voorgangers) eindigen met een werkdag,
      // dus addWorkingDaysSigned krijgt gegarandeerd een werkdag (invariant). Zo lopen de
      // verschoven datums gewoon door de backward pass -> float wordt eerlijk herrekend (geen
      // phantom float, §10-P2). `levelingDelay` undefined of 0 => exacte no-op (alle bestaande
      // cases blijven ongewijzigd).
      if (task.levelingDelay) {
        earlyStart = cal.addWorkingDaysSigned(earlyStart, task.levelingDelay);
      }

      // Voortgang (fase 2.6): actual-pinning + data-date-vloer. dataDate === null ⇒ elke tak is
      // een no-op (backwards-compat). `earlyStart` is hier al de retained-logic voorganger-druk.
      const dataDate = this.dataDate;
      if (dataDate) {
        const t = task.time;
        if (t.actualFinish && t.completion >= 1) {
          // (1) VOLTOOID: volledig gepind op actuals — geen forward-drift voorbij actualFinish.
          const es = this.snapOnOrAfter(cal, this.parseIn(cal, t.actualStart ?? t.actualFinish));
          // Milestone: start én finish landen op dezelfde werk(dag)-grens (snap op-of-ná, niet -vóór).
          let ef = task.isMilestone
            ? this.snapOnOrAfter(cal, this.parseIn(cal, t.actualFinish))
            : this.snapOnOrBefore(cal, this.parseIn(cal, t.actualFinish));
          if (ef < es) ef = es;   // weekend-randgeval (rauwe imports)
          results.set(taskId, { es, ef });
          continue;
        }
        if ((t.actualStart || t.completion > 0) && t.completion < 1) {
          // (2) IN PROGRESS — actualStart (store-route) óf impliciete actualStart = de gewone
          //     forward-pass-earlyStart (2b, vangnet voor rauwe legacy/externe data).
          const actualES = t.actualStart
            ? this.snapOnOrAfter(cal, this.parseIn(cal, t.actualStart))
            : earlyStart;
          // Restwerk: uur ⇒ `remainingMinutes ?? durationMinutes × (1−completion)`; dag ⇒ werkdagen (§5.3).
          const remaining = cal.isHourMode
            ? Math.max(0, t.remainingMinutes ?? Math.round(durationMinutesOf(task, cal) * (1 - t.completion)))
            : Math.max(0, t.remainingTime ?? Math.round(t.scheduleDuration * (1 - t.completion)));
          let remStart = dataDate;                                  // ondergrens: statusdatum
          if (this.options.progressMode !== 'PROGRESS_OVERRIDE') {
            // RETAINED_LOGIC: remaining respecteert óók de voorganger-druk (earlyStart).
            if (earlyStart > remStart) remStart = earlyStart;
          }
          const ef = cal.isHourMode
            ? cal.addWorkMinutes(remStart, remaining)
            : cal.addWorkDays(remStart, remaining);
          results.set(taskId, { es: actualES, ef });
          continue;
        }
        if (t.completion === 0 && earlyStart < dataDate) {
          // (3) NIET GESTART: statusdatum als ondergrens (remaining werk nooit in het verleden).
          earlyStart = dataDate;
        }
      }

      const earlyFinish = this.addDuration(cal, earlyStart, task);

      results.set(taskId, { es: earlyStart, ef: earlyFinish });
    }

    return results;
  }

  /**
   * Out-of-sequence-detectie (fase 2.6, §4.4): relaties waarvan de opvolger progress/actuals heeft
   * die de voorganger-logica tegenspreekt. Waarschuwing, geen correctie — het gedrag volgt uit de
   * gekozen progressMode. Zonder statusdatum: geen detectie (no-op, backwards-compat).
   */
  private detectOutOfSequence(earlyDates: Map<string, { es: Date; ef: Date }>): string[] {
    if (!this.dataDate) return [];
    const out: string[] = [];
    for (const seq of this.sequences) {
      const pred = this.tasks.get(seq.predecessorId);
      const succ = this.tasks.get(seq.successorId);
      if (!pred || !succ) continue;
      // Sub-dag-actuals moeten in uur-modus als out-of-sequence tellen ⇒ `parseInstant` (§5.3);
      // elke taak in zijn eigen engine. Dag ⇒ `parseDate` (byte-identiek).
      const succEng = this.calendarFor(succ);
      const predEng = this.calendarFor(pred);
      const succAS = succ.time.actualStart ? this.parseIn(succEng, succ.time.actualStart) : null;
      const succAF = succ.time.actualFinish ? this.parseIn(succEng, succ.time.actualFinish) : null;
      const predAS = pred.time.actualStart ? this.parseIn(predEng, pred.time.actualStart) : null;
      const predAF = pred.time.actualFinish ? this.parseIn(predEng, pred.time.actualFinish) : null;
      const predEF = earlyDates.get(seq.predecessorId)?.ef ?? null;
      switch (seq.type) {
        case 'START_START': {
          // Opvolger gestart vóór de voorganger.
          if (succAS && predAS && succAS < predAS) out.push(seq.id);
          break;
        }
        case 'FINISH_FINISH':
        case 'START_FINISH': {
          // Finish-zijde: opvolger voltooid terwijl de voorganger nog niet voltooid is (of eerder).
          if (succAF) {
            const predFin = predAF ?? predEF;
            if (!predAF || (predFin && succAF < predFin)) out.push(seq.id);
          }
          break;
        }
        case 'FINISH_START':
        default: {
          // Opvolger gestart terwijl de voorganger nog niet voltooid is (of vóór diens finish).
          if (succAS) {
            const prefEF = predAF ?? predEF;
            if (!predAF || (prefEF && succAS < prefEF)) out.push(seq.id);
          }
          break;
        }
      }
    }
    return out;
  }

  /** Getekend werkdag-verschil in kalender `eng`: a≤b ⇒ +stappen, a>b ⇒ −stappen (negatief mogelijk). */
  private signedWorkDays(a: Date, b: Date, eng: CalendarEngine): number {
    return a <= b
      ? eng.workDaysBetween(a, b) - 1
      : -(eng.workDaysBetween(b, a) - 1);
  }

  /** Constraint-instant in de kalendermodus (§4.1), of null bij afwezig/onparseerbaar (soft:
   *  negeren). Dag ⇒ `parseDate` (middernacht, byte-identiek); uur ⇒ `parseInstant` (behoudt tijd-
   *  van-de-dag). Een date-only-string op een uur-taak = middernacht ⇒ dag-verankerd: de instant-
   *  vinders snappen hem naar de eerste/laatste werk-instant van die dag (S13). Een datetime-string
   *  draagt tijd-van-de-dag en wordt tot de minuut gehonoreerd. */
  private constraintInstant(c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const raw = c?.date;
    if (!raw) return null;
    const d = this.parseIn(eng, raw);
    return isNaN(d.getTime()) ? null : d;
  }

  /** De harde-pin-START (§4.2), of null als de PRIMAIRE constraint geen harde MSO/MFO-pin is.
   *  MSO pint de START op de datum; MFO pint de FINISH ⇒ start = finish ⊖ duur. Modus-neutraal
   *  (dag: bevroren dag-primitieven; uur: instant-vinders + minuut-aftrek via `durationMinutesOf`). */
  private hardPinStart(task: Task, eng: CalendarEngine): Date | null {
    const c = task.constraint;
    if (!c?.hard || (c.type !== 'MSO' && c.type !== 'MFO')) return null;
    const d = this.constraintInstant(c, eng);
    if (!d) return null;
    const snapped = this.snapOnOrAfter(eng, d);
    return c.type === 'MSO' ? snapped : this.startFromFinish(eng, snapped, task);
  }

  /** De harde-pin-FINISH (§4.2), spiegel van `hardPinStart` (⇒ EF=LF én ES=LS op de pin, tf=0).
   *  MFO: EF = snap(datum); MSO: EF = gepinde-start ⊕ duur. */
  private hardPinFinish(task: Task, eng: CalendarEngine): Date | null {
    const c = task.constraint;
    if (!c?.hard || (c.type !== 'MSO' && c.type !== 'MFO')) return null;
    const d = this.constraintInstant(c, eng);
    if (!d) return null;
    const snapped = this.snapOnOrAfter(eng, d);
    return c.type === 'MFO' ? snapped : this.addDuration(eng, snapped, task);
  }

  /** Forward-ondergrens (start) van ÉÉN soft constraint (§4.1/§4.3), of null zonder forward-effect.
   *  SNET/MSO ⇒ start-ondergrens; FNET/MFO ⇒ finish-ondergrens vertaald naar de start. Dag-modus
   *  reduceert byte-identiek tot `nextWorkDay`/`addWorkingDaysSigned`; uur-modus gebruikt de instant-
   *  vinders + de minuut-aftrek van `startFromFinish` (via `durationMinutesOf`). */
  private forwardBoundOf(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const d = this.constraintInstant(c, eng);
    if (!c || !d) return null;
    if (c.type === 'SNET' || c.type === 'MSO') return this.snapOnOrAfter(eng, d);
    if (c.type === 'FNET' || c.type === 'MFO') {
      return this.startFromFinish(eng, this.snapOnOrAfter(eng, d), task);
    }
    return null;
  }

  /** Backward-bovengrens (late finish) van ÉÉN soft constraint (§4.1/§4.3), of null zonder backward-
   *  effect. FNLT/MFO ⇒ finish-bovengrens direct; SNLT/MSO ⇒ start-bovengrens vertaald naar de finish.
   *  Dag-modus byte-identiek (`prevWorkDay`/`addWorkingDaysSigned`); uur-modus via de instant-vinders. */
  private backwardBoundOf(task: Task, c: TaskConstraint | undefined, eng: CalendarEngine): Date | null {
    const d = this.constraintInstant(c, eng);
    if (!c || !d) return null;
    const dW = this.snapOnOrBefore(eng, d);
    if (c.type === 'FNLT' || c.type === 'MFO') return dW;
    if (c.type === 'SNLT' || c.type === 'MSO') return this.finishFromStart(eng, dW, task);
    return null;
  }

  /**
   * Vroege-zijde constraints (fase 2.3, uitgebreid 2.9 §4.1-4.3). Een harde MSO/MFO-pin
   * OVERSCHRIJFT de voorganger-druk onvoorwaardelijk (barrière, §4.2) en registreert een
   * logica-schending zodra die druk (`rawMax`, of null bij een worteltaak) later valt dan de pin
   * — dán start de taak vóór z'n voorganger klaar is. Zonder pin stapelen de PRIMAIRE en
   * SECUNDAIRE forward-constraints (SNET/FNET/MSO/MFO) als max-ondergrenzen. `hard`/`constraint2`
   * afwezig ⇒ exact de bestaande soft-tak (byte-identiek: de 319 cases kennen ze nergens).
   */
  private applyForwardConstraints(task: Task, earlyStart: Date, rawMax: Date | null, eng: CalendarEngine): Date {
    const pin = this.hardPinStart(task, eng);
    if (pin) {
      if (rawMax && rawMax > pin) this.hardPinViolatedIds.push(task.id);
      return pin;
    }
    let es = earlyStart;
    for (const cc of [task.constraint, task.constraint2]) {
      const bound = this.forwardBoundOf(task, cc, eng);
      if (bound && bound > es) es = bound;
    }
    return es;
  }

  /**
   * Late-zijde grenzen (fase 2.3, uitgebreid 2.9 §4.1-4.3). Een harde MSO/MFO-pin zet de late
   * finish ONVOORWAARDELIJK op de gepinde waarde (override de successor-druk) ⇒ LS=ES/LF=EF ⇒
   * tf=0 op de pin, en een strengere late-constraint verder downstream propageert zijn negatieve
   * float NIET dóór de pin heen (P6-barrière, §4.2). Zonder pin stapelen de PRIMAIRE en SECUNDAIRE
   * backward-constraints (SNLT/FNLT/MSO/MFO) + de zachte deadline als min-bovengrenzen; vroege
   * datums bewegen nooit, overschrijding wordt negatieve float.
   */
  private applyBackwardBound(task: Task, lateFinish: Date, eng: CalendarEngine): Date {
    const pinFinish = this.hardPinFinish(task, eng);
    if (pinFinish) return pinFinish;
    let lf = lateFinish;
    for (const cc of [task.constraint, task.constraint2]) {
      const bound = this.backwardBoundOf(task, cc, eng);
      if (bound && bound < lf) lf = bound;
    }
    if (task.deadline) {
      const dl = parseDate(task.deadline);
      if (!isNaN(dl.getTime())) {
        const dlW = eng.prevWorkDay(dl);
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

      const cal = this.calendarFor(task);
      const succs = this.successors.get(taskId) || [];
      let ff = Infinity;
      if (succs.length === 0) {
        ff = this.signedWorkDays(early.ef, late.lf, cal);
      } else {
        for (const seq of succs) {
          const cRaw = this.seqConstraint.get(seq.id);
          const succEarly = earlyDates.get(seq.successorId);
          const succTask = this.tasks.get(seq.successorId);
          if (!cRaw || !succEarly || !succTask) continue;
          const succCal = this.calendarFor(succTask);
          const f = succCal.workDaysBetween(succCal.nextWorkDay(cRaw), succEarly.es) - 1;
          if (f < ff) ff = f;
        }
      }
      if (!Number.isFinite(ff) || ff <= 0) continue;

      early.es = cal.addWorkingDaysSigned(early.es, ff);
      early.ef = cal.addWorkingDaysSigned(early.ef, ff);
      for (const seq of succs) {
        const succTask = this.tasks.get(seq.successorId);
        if (!succTask) continue;
        this.seqConstraint.set(
          seq.id,
          this.getForwardConstraint(early, task, seq, succTask, cal, this.calendarFor(succTask)),
        );
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
    predEng: CalendarEngine,
    succEng: CalendarEngine,
  ): Date {
    // Fase 2.8b (§5.2): zodra minstens één zijde uur-modus is loopt het cross-/uur-pad; een puur
    // dag-dag-paar valt hier NIET binnen en draait onder het bevroren dag-pad hieronder (byte-identiek).
    if (predEng.isHourMode || succEng.isHourMode) {
      return this.forwardConstraintHour(predResult, predTask, seq, successor, predEng, succEng);
    }
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
    // De relatie-lag telt in de kalender van de VOORGANGER (P6-default, §5.2). De succBack-aftrek en
    // successor-mijlpaal-snaps tellen in de successor-kalender; de FS-finishgrens-snap in de voorganger.
    const pe = predEng;
    const se = succEng;
    const lagEng = LAG_CALENDAR === 'predecessor' ? predEng : succEng;
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
        const base = predStartsNextDay ? pe.nextWorkDayAfter(predResult.es) : predResult.es;
        return lagEng.addWorkingDaysSigned(base, lag);
      }
      case 'FINISH_FINISH': {
        // Opvolger EINDIGT `lag` dagen na de finish van de voorganger → leid de bijbehorende
        // start af (finish − (duur−1)). De geëiste finish moet een werkdag zijn vóór de
        // werkdag-aftrek, dus elapsed snapt hier wél (vooruit — ondergrens op de finish).
        const reqFinish = elapsed
          ? se.nextWorkDay(addCalendarDays(predResult.ef, lag))
          : lagEng.addWorkingDaysSigned(predResult.ef, lag);
        // Een startmijlpaal-opvolger (dagbegin-anker) kan pas op de werkdag ná een
        // dag-eindgrens liggen; na een dagbegin-voorganger (start-/auto-mijlpaal) niet.
        if (succIsStartMs && !predEndsBeginOfDay) return se.nextWorkDayAfter(reqFinish);
        return se.addWorkingDaysSigned(reqFinish, -succBack);
      }
      case 'START_FINISH': {
        // Opvolger EINDIGT `lag` dagen na de START van de voorganger (zeldzaam).
        const reqFinish = elapsed
          ? se.nextWorkDay(addCalendarDays(predResult.es, predStartsNextDay ? lag + 1 : lag))
          : lagEng.addWorkingDaysSigned(
              predStartsNextDay ? pe.nextWorkDayAfter(predResult.es) : predResult.es,
              lag,
            );
        return se.addWorkingDaysSigned(reqFinish, -succBack);
      }
      case 'FINISH_START':
      default: {
        // Eind-Start: opvolger start de werkdag ná de finish van de voorganger, plus `lag`.
        // Een dagbegin-mijlpaal bezet geen dag, dus die "+1"-overgang geldt dan niet
        // (anders schuift een tussengevoegde mijlpaal de hele keten een dag op). Een
        // eindmijlpaal-opvolger ankert juist op de finish-grens zelf (zelfde daglabel).
        // De finish-grens-snap (nextWorkDayAfter) telt in de VOORGANGER-kalender; de lag daarna
        // in de lag-kalender (voorganger, §5.2). Elapsed telt vanaf de finish-grens 24/7.
        if (elapsed) {
          const plus = succIsFinishMs || predEndsBeginOfDay ? lag : lag + 1;
          return addCalendarDays(predResult.ef, plus);
        }
        const base = succIsFinishMs || predEndsBeginOfDay
          ? predResult.ef
          : pe.nextWorkDayAfter(predResult.ef);
        return lagEng.addWorkingDaysSigned(base, lag);
      }
    }
  }

  /**
   * Cross-/uur-pad van `getForwardConstraint` (§4.3/§5.2). Engaged zodra minstens één zijde
   * uur-modus is. FS is minuut-exact geverifieerd (scenario's 1-7); SS/FF/SF spiegelen de
   * dag-formules met instant-primitieven (golf 3 maakt er cases van). Lag telt in de
   * VOORGANGER-engine (`LAG_CALENDAR='predecessor'`); de opvolger-snap gebeurt in de succ-engine.
   */
  private forwardConstraintHour(
    predResult: { es: Date; ef: Date },
    predTask: Task,
    seq: Sequence,
    successor: Task,
    pe: CalendarEngine,
    se: CalendarEngine,
  ): Date {
    const elapsed = seq.lagUnit === 'ELAPSEDTIME';
    const predIsMs = predTask.isMilestone || predTask.time.scheduleDuration <= 0;
    const predKind = predTask.isMilestone ? predTask.milestoneKind : undefined;
    const predEndsBeginOfDay = predIsMs && predKind !== 'FINISH';   // dag-conceptueel (mijlpaal)
    const predStartsNextDay = predIsMs && predKind === 'FINISH';
    const succIsFinishMs = successor.isMilestone && successor.milestoneKind === 'FINISH';
    const succIsStartMs = successor.isMilestone && successor.milestoneKind === 'START';
    const elapsedMin = () => this.resolveElapsedMinutes(seq, predTask) * CPMSolver.MS_PER_MIN;

    switch (seq.type) {
      case 'START_START': {
        const base = predStartsNextDay ? this.snapStrictAfter(pe, predResult.es) : predResult.es;
        if (elapsed) {
          return this.snapOnOrAfter(se, new Date(base.getTime() + elapsedMin()));
        }
        return this.snapOnOrAfter(se, this.shiftLagPred(pe, base, seq, predTask, 1));
      }
      case 'FINISH_FINISH': {
        const reqFinish = elapsed
          ? this.snapOnOrAfter(se, new Date(predResult.ef.getTime() + elapsedMin()))
          : this.shiftLagPred(pe, predResult.ef, seq, predTask, 1);
        if (succIsStartMs && !predEndsBeginOfDay) return this.snapStrictAfter(se, reqFinish);
        return this.startFromFinish(se, reqFinish, successor);
      }
      case 'START_FINISH': {
        const startMoment = predStartsNextDay ? this.snapStrictAfter(pe, predResult.es) : predResult.es;
        const reqFinish = elapsed
          ? this.snapOnOrAfter(se, new Date(startMoment.getTime() + elapsedMin()))
          : this.shiftLagPred(pe, startMoment, seq, predTask, 1);
        return this.startFromFinish(se, reqFinish, successor);
      }
      case 'FINISH_START':
      default: {
        // FS (§4.3): de opvolger consumeert de exclusieve "beschikbaar-vanaf"-instant van de
        // voorganger via `availableStart` — die ceilt een dag-opvolger correct naar de volgende
        // volledige werkdag (scenario 7 uur→dag) en snapt een uur-opvolger naar de eerstvolgende
        // werk-instant (scenario 1/6). Lag telt daarvóór in de voorganger-engine.
        if (elapsed) {
          // Klok-minuten 24/7 vanaf de exclusieve finish, dan vooruit-snap (scenario 6b).
          return se.availableStart(new Date(predResult.ef.getTime() + elapsedMin()));
        }
        const predDone = (succIsFinishMs || predEndsBeginOfDay)
          ? predResult.ef                       // mijlpaal-grens: geen dag-boundary-+1 (dag-conceptueel)
          : pe.predDoneAt(predResult.ef);
        return se.availableStart(this.shiftLagPred(pe, predDone, seq, predTask, 1));
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
      const predCal = this.calendarFor(task);
      let lateFinish = projectEnd;
      for (const seq of succs) {
        const succResult = results.get(seq.successorId);
        const succTask = this.tasks.get(seq.successorId);
        if (!succResult || !succTask) continue;
        const constraintDate = this.getBackwardConstraint(
          succResult, seq, task, succTask, predCal, this.calendarFor(succTask),
        );
        if (constraintDate < lateFinish) {
          lateFinish = constraintDate;
        }
      }

      // Late-zijde datum-constraints + deadline (fase 2.3) als extra bovengrens.
      lateFinish = this.applyBackwardBound(task, lateFinish, predCal);

      const lateStart = this.subDuration(predCal, lateFinish, task);

      results.set(taskId, { ls: lateStart, lf: lateFinish });
    }

    return results;
  }

  private getBackwardConstraint(
    succResult: { ls: Date; lf: Date },
    seq: Sequence,
    predTask: Task,
    succTask: Task,
    predEng: CalendarEngine,
    succEng: CalendarEngine,
  ): Date {
    // Fase 2.8b (§5.2): cross-/uur-pad zodra minstens één zijde uur-modus is; een puur dag-dag-paar
    // (geval (c)) valt hier NIET binnen en loopt onder het bevroren dag-pad hieronder (byte-identiek).
    if (predEng.isHourMode || succEng.isHourMode) {
      return this.backwardConstraintHour(succResult, seq, predTask, succTask, predEng, succEng);
    }
    // Spiegel van getForwardConstraint: geef de laatst toegestane FINISH van de voorganger.
    // Kalenderdag-lag snapt hier áchteruit (het is een bovengrens: "niet later dan…", dus de
    // laatste werkdag op of vóór de ruwe datum voldoet als laatste) — exact symmetrisch met
    // de vooruit-snap in de forward-pass, zodat een lead geen fantoomfloat oplevert.
    const { days: lag, unit } = this.resolveLag(seq, predTask);
    const elapsed = unit === 'ELAPSEDTIME';
    // Spiegel van getForwardConstraint (§5.2): de lag telt terug in de VOORGANGER-kalender; de
    // FS-gap-spiegel (prevWorkDayBefore) eveneens; de successor-zijde-datums in de successor-kalender.
    const pe = predEng;
    const se = succEng;
    const lagEng = LAG_CALENDAR === 'predecessor' ? predEng : succEng;
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
          ? lagEng.prevWorkDay(addCalendarDays(succResult.ls, -(predStartsNextDay ? lag + 1 : lag)))
          : predStartsNextDay
            ? pe.prevWorkDayBefore(lagEng.addWorkingDaysSigned(succResult.ls, -lag))
            : lagEng.addWorkingDaysSigned(succResult.ls, -lag);
        return pe.addWorkingDaysSigned(predLS, predBack); // pred.lateFinish
      }
      case 'FINISH_FINISH': {
        // Forward: succ.finish = pred.finish + lag ⇒ pred.finish ≤ succ.lateFinish − lag.
        // Een startmijlpaal-opvolger lag een werkdag ná de finish-grens (zie forward).
        const succLf = succIsStartMs && !predEndsBeginOfDay
          ? se.prevWorkDayBefore(succResult.lf)
          : succResult.lf;
        return elapsed
          ? lagEng.prevWorkDay(addCalendarDays(succLf, -lag))
          : lagEng.addWorkingDaysSigned(succLf, -lag);
      }
      case 'START_FINISH': {
        // Forward: succ.finish = pred.start(-moment) + lag ⇒ pred.start ≤ succ.lateFinish − lag.
        const predLS = elapsed
          ? lagEng.prevWorkDay(addCalendarDays(succResult.lf, -(predStartsNextDay ? lag + 1 : lag)))
          : predStartsNextDay
            ? pe.prevWorkDayBefore(lagEng.addWorkingDaysSigned(succResult.lf, -lag))
            : lagEng.addWorkingDaysSigned(succResult.lf, -lag);
        return pe.addWorkingDaysSigned(predLS, predBack);
      }
      case 'FINISH_START':
      default: {
        // Eind-Start: opvolger start `lag` dagen na de finish (de werkdag erná voor een echte
        // taak; bij een dagbegin-mijlpaal-voorganger of eindmijlpaal-opvolger géén extra dag).
        // Terug-inverteren; de FS-gap-spiegel (prevWorkDayBefore) telt in de VOORGANGER-kalender.
        if (elapsed) {
          const plus = succIsFinishMs || predEndsBeginOfDay ? lag : lag + 1;
          return lagEng.prevWorkDay(addCalendarDays(succResult.ls, -plus));
        }
        const target = lagEng.addWorkingDaysSigned(succResult.ls, -lag);
        return succIsFinishMs || predEndsBeginOfDay ? target : pe.prevWorkDayBefore(target);
      }
    }
  }

  /**
   * Cross-/uur-pad van `getBackwardConstraint` (§5.2). Exacte spiegel van `forwardConstraintHour`:
   * `prevWorkInstantBefore` spiegelt `nextWorkInstant`, `subtractWorkMinutes` spiegelt
   * `addWorkMinutes`, lag terug in de VOORGANGER-engine. FS implementeert de normatieve backward-
   * cross-formules (a)/(b)/(c) uit §5.2: (a) uur-pred/dag-succ, (b) dag-pred/uur-succ, (c) dag-dag
   * (bevroren, buiten deze methode). FS is geverifieerd (scenario 1-7 backward); SS/FF/SF spiegelen
   * de dag-formules (UNVERIFIED — golf 3).
   */
  private backwardConstraintHour(
    succResult: { ls: Date; lf: Date },
    seq: Sequence,
    predTask: Task,
    succTask: Task,
    pe: CalendarEngine,
    se: CalendarEngine,
  ): Date {
    const elapsed = seq.lagUnit === 'ELAPSEDTIME';
    const predIsMs = predTask.isMilestone || predTask.time.scheduleDuration <= 0;
    const predKind = predTask.isMilestone ? predTask.milestoneKind : undefined;
    const predEndsBeginOfDay = predIsMs && predKind !== 'FINISH';
    const predStartsNextDay = predIsMs && predKind === 'FINISH';
    const succIsFinishMs = succTask.isMilestone && succTask.milestoneKind === 'FINISH';
    const succIsStartMs = succTask.isMilestone && succTask.milestoneKind === 'START';
    const elapsedMin = () => this.resolveElapsedMinutes(seq, predTask) * CPMSolver.MS_PER_MIN;

    switch (seq.type) {
      case 'START_START': {
        const shifted = elapsed
          ? new Date(succResult.ls.getTime() - elapsedMin())
          : this.shiftLagPred(pe, succResult.ls, seq, predTask, -1);
        const predStart = predStartsNextDay ? this.snapStrictBefore(pe, shifted)
          : elapsed ? this.snapOnOrBefore(pe, shifted) : shifted;
        return this.finishFromStart(pe, predStart, predTask);
      }
      case 'FINISH_FINISH': {
        const succLf = (succIsStartMs && !predEndsBeginOfDay) ? this.snapStrictBefore(se, succResult.lf) : succResult.lf;
        if (elapsed) {
          return this.snapOnOrBefore(pe, new Date(succLf.getTime() - elapsedMin()));
        }
        return this.shiftLagPred(pe, succLf, seq, predTask, -1);       // pred.LF
      }
      case 'START_FINISH': {
        const shifted = elapsed
          ? new Date(succResult.lf.getTime() - elapsedMin())
          : this.shiftLagPred(pe, succResult.lf, seq, predTask, -1);
        const predStart = predStartsNextDay ? this.snapStrictBefore(pe, shifted)
          : elapsed ? this.snapOnOrBefore(pe, shifted) : shifted;
        return this.finishFromStart(pe, predStart, predTask);
      }
      case 'FINISH_START':
      default: {
        if (elapsed) {
          // Klok-minuten terug vanaf succ.LS, dan achteruit-snap in de voorganger.
          return this.snapOnOrBefore(pe, new Date(succResult.ls.getTime() - elapsedMin()));
        }
        const succDayStart = () => this.startOfDay(succResult.ls);
        if (pe.isHourMode && se.isHourMode) {
          // hour-hour: pred.LF = prevWorkInstant( succ.LS ⊖ lag ) (scenario 1-6 backward).
          const target = (predEndsBeginOfDay || succIsFinishMs)
            ? succResult.ls
            : this.shiftLagPred(pe, succResult.ls, seq, predTask, -1);
          return pe.prevWorkInstant(target);
        }
        if (pe.isHourMode && !se.isHourMode) {
          // (a) uur-voorganger, dag-opvolger: klaar vóór de middernacht van de succ-startdag.
          const target = this.shiftLagPred(pe, succDayStart(), seq, predTask, -1);
          return pe.prevWorkInstant(target);
        }
        // (b) dag-voorganger, uur-opvolger: de grootste werkdag d waarvoor de forward-afleiding
        // se.nextWorkInstant( (d+1)@00:00 ⊕ lag ) ≤ succ.LS blijft (scenario 7 backward).
        const lagDays = resolveEffectiveLagDays(seq, predTask);
        let d = succDayStart();
        for (let scan = 0; scan <= CPMSolver.HOUR_SCAN; scan++) {
          if (pe.isWorkDay(d)) {
            const predDone = new Date(d.getTime() + CPMSolver.MS_PER_DAY);       // (d+1)@00:00
            const shifted = pe.addWorkingDaysSigned(predDone, lagDays);          // lag in dag-pred
            if (se.nextWorkInstant(shifted).getTime() <= succResult.ls.getTime()) return d;
          }
          d = addCalendarDays(d, -1);
        }
        return this.snapOnOrBefore(pe, succDayStart());   // best effort (kapotte kalender)
      }
    }
  }

  private computeResults(
    order: string[],
    earlyDates: Map<string, { es: Date; ef: Date }>,
    lateDates: Map<string, { ls: Date; lf: Date }>,
    outOfSequenceSequenceIds: string[],
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
    const nearCriticalTaskIds: string[] = [];
    for (const seq of this.sequences) {
      const cRaw = this.seqConstraint.get(seq.id);
      const succEarly = earlyDates.get(seq.successorId);
      const succTask = this.tasks.get(seq.successorId);
      if (!cRaw || !succEarly || !succTask) continue;
      // Relatie-vrije-speling in de kalender van de OPVOLGER (diens vroegste start rekent daar, §5.2).
      // Uur-opvolger ⇒ fractionele-dag-float via `workMinutesBetween` (§5.5); dag ⇒ integer (byte-identiek).
      const succCal = this.calendarFor(succTask);
      const reqStart = this.snapOnOrAfter(succCal, cRaw);
      const relFloat = succCal.isHourMode
        ? succCal.workMinutesBetween(reqStart, succEarly.es) / (succCal.hoursPerDay * 60)
        : succCal.workDaysBetween(reqStart, succEarly.es) - 1;
      sequenceFreeFloat[seq.id] = relFloat;
      if (relFloat === 0) drivingSequenceIds.push(seq.id);
    }

    // Fase 2.9 golf 2 (§3.4/§4.6) — project-scoped reken-opties + longest-path-kritiek-set. Elke
    // tak staat strak achter zijn optie-conditie; afwezig ⇒ exact de bestaande expressie (byte-
    // identiek: de 333 cases kennen `schedulingOptions` nergens).
    const so = this.options.schedulingOptions;
    const tfMode = so?.totalFloatMode ?? 'smallest';
    const makeOpenEndedCritical = so?.makeOpenEndedCritical === true;
    const nearCriticalThreshold = so?.nearCriticalThreshold;
    const critDef = so?.criticalDefinition;
    const critThreshold = critDef?.threshold ?? 0;
    const useLongestPath = critDef?.mode === 'longestPath';
    // Longest-path-kritiek (§4.6, normatief): de Free-Float-peel van pad 1 — de driving-keten(s)
    // vanaf de taak/taken met de grootste EF; bij ties (meerdere eindtaken met dezelfde grootste EF)
    // is de UNIE van alle peels kritiek. tf speelt in deze modus geen rol. Alleen opgebouwd in
    // longestPath-modus (anders leeg ⇒ geen effect). Hammocks worden pas in golf 4 speciaal behandeld.
    const longestPathCritical = new Set<string>();
    if (useLongestPath) {
      let maxEf = -Infinity;
      for (const { ef } of earlyDates.values()) {
        if (ef.getTime() > maxEf) maxEf = ef.getTime();
      }
      const drivingSet = new Set(drivingSequenceIds);
      for (const [id, { ef }] of earlyDates) {
        if (ef.getTime() !== maxEf) continue;
        longestPathCritical.add(id);
        for (const p of traceFrom(id, this.sequences, drivingSet).drivingPredecessors) {
          longestPathCritical.add(p);
        }
      }
    }

    let projectEnd = new Date(0);

    for (const taskId of order) {
      const early = earlyDates.get(taskId)!;
      const late = lateDates.get(taskId)!;
      // Float rekent per taak in diens eigen kalender (P6-semantiek, §5.2).
      const taskObj = this.tasks.get(taskId)!;
      const cal = this.calendarFor(taskObj);

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
        // Uur-taak ⇒ fractionele-dag-float (§5.5); dag ⇒ integer (byte-identiek).
        freeFloat = this.signedFloat(early.ef, late.lf, cal);
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
      const tt = taskObj.time;
      // Voortgang (fase 2.6, §4.5): voor in-progress/voltooide taken is de start-zijde-float
      // betekenisloos (de ES is een actual in het verleden) ⇒ alleen finish-zijde (LF−EF).
      const hasProgress = !!this.dataDate && (!!tt.actualStart || tt.completion > 0);
      const completed = !!this.dataDate && tt.completion >= 1;
      const finishFloat = this.signedFloat(early.ef, late.lf, cal);
      const startFloat = this.signedFloat(early.es, late.ls, cal);
      // TF-berekeningswijze (§3.4): default 'smallest' = min(finish,start) ⇒ byte-identiek. Een taak
      // met voortgang houdt zijn finish-zijde-float (bestaande invariant, §4.5), ongeacht de modus.
      let tf = hasProgress
        ? finishFloat
        : tfMode === 'finish' ? finishFloat
        : tfMode === 'start' ? startFloat
        : Math.min(finishFloat, startFloat);
      // Open-ended kritiek (§3.4): alleen bij `makeOpenEndedCritical` krijgt een taak zonder opvolger
      // tf=ff=0 (P6: LF=EF ⇒ kritiek). Default (optie afwezig) ⇒ ongewijzigd.
      if (makeOpenEndedCritical && succs.length === 0 && !completed) {
        tf = 0;
        freeFloat = 0;
      }
      // Kritiek-definitie (§4.6): voltooid ⇒ nooit kritiek (P6, opvolgers wél); longestPath ⇒ op een
      // driving-keten naar de laatste finish (tf-onafhankelijk); anders tf ≤ drempel (default 0 = het
      // huidige tf≤0).
      const isCritical = completed
        ? false
        : useLongestPath
          ? longestPathCritical.has(taskId)
          : tf <= critThreshold;

      if (isCritical) criticalPath.push(taskId);
      // Interfererende speling (§4.6): ALTIJD berekend, getekend (fractioneel in uur-modus, erft
      // `signedFloat` via tf/ff). Byte-veilig: niet geserialiseerd (§6), niet in de digest.
      const interferingFloat = tf - freeFloat;
      // Near-critical (§4.6): 0 < tf ≤ drempel; alleen wanneer de drempel gezet is (anders undefined
      // ⇒ ongeschreven veld). tf=0 is NIET near; tf=drempel wél.
      const isNear = nearCriticalThreshold !== undefined && nearCriticalThreshold !== null
        ? tf > 0 && tf <= nearCriticalThreshold
        : undefined;
      if (isNear) nearCriticalTaskIds.push(taskId);
      if (early.ef > projectEnd) projectEnd = early.ef;

      // Geschonden constraints / gemiste deadlines (bron van de negatieve float). Beide constraints
      // worden geëvalueerd (§4.3). Een harde MSO/MFO-pin telt hier NIET mee — diens logica-schending
      // (rawMax > pin) is al in de forward pass geregistreerd (§4.2) en wordt onderaan toegevoegd.
      const task = taskObj;
      {
        for (const cc of [task.constraint, task.constraint2]) {
          if (!cc) continue;
          if (cc.hard && (cc.type === 'MSO' || cc.type === 'MFO')) continue;
          const cd = this.constraintInstant(cc, cal);
          if (!cd) continue;
          const dW = this.snapOnOrBefore(cal, cd);
          const ct = cc.type;
          if (((ct === 'SNLT' || ct === 'MSO') && early.es > dW)
            || ((ct === 'FNLT' || ct === 'MFO') && early.ef > dW)) {
            if (!violatedConstraintTaskIds.includes(taskId)) violatedConstraintTaskIds.push(taskId);
          }
        }
        if (task.deadline) {
          const dl = parseDate(task.deadline);
          if (!isNaN(dl.getTime()) && early.ef > cal.prevWorkDay(dl)) {
            missedDeadlineTaskIds.push(taskId);
          }
        }
      }

      // Serialisatie (§2.4/§5): de MODUS van de eigen kalender is de enige discriminator — dag-taak ⇒
      // `formatDate` (byte-identiek), uur-taak ⇒ `YYYY-MM-DDTHH:mm`.
      const mode = this.modeOf(cal);
      taskResults.set(taskId, {
        earlyStart: formatInstant(early.es, mode),
        earlyFinish: formatInstant(early.ef, mode),
        lateStart: formatInstant(late.ls, mode),
        lateFinish: formatInstant(late.lf, mode),
        totalFloat: tf,
        freeFloat,
        isCritical,
        interferingFloat,
        ...(isNear !== undefined ? { isNearCritical: isNear } : {}),
      });
    }

    // Harde-pin-logicaschendingen (§4.2): de voorganger-druk viel later dan de pin ⇒ de taak start
    // vóór z'n voorganger klaar is. Toegevoegd aan de geschonden-constraint-verzameling (deduped).
    for (const id of this.hardPinViolatedIds) {
      if (!violatedConstraintTaskIds.includes(id)) violatedConstraintTaskIds.push(id);
    }

    // Projectduur = werkdag-spanne van de vroegste start tot de laatste finish. Een project dat
    // op één moment valt (uitsluitend mijlpalen, geen echt werk) heeft duur 0 i.p.v. de 1 die de
    // inclusieve telling anders zou geven.
    let projStart: Date | null = null;
    for (const { es } of earlyDates.values()) {
      if (!projStart || es < projStart) projStart = es;
    }
    projStart = projStart || new Date();
    let projectDuration = this.projectEngine.workDaysBetween(projStart, projectEnd);
    if (formatDate(projStart) === formatDate(projectEnd)) {
      const anyRealWork = [...this.tasks.values()].some(
        (t) => !t.isMilestone && t.time.scheduleDuration > 0,
      );
      if (!anyRealWork) projectDuration = 0;
    }

    // ── Fase 2.9 golf 3 (§4.6) — multiple float paths (POST-PASS op het VASTE resultaat) ──────────
    // De vroege datums veranderen NIET door het peelen: dit is een goedkope graaf-peel resp.
    // TF-rangschikking, geen her-solve. Uit ⇒ `criticalPaths = [criticalPath]` en `floatPathByTask =
    // {}` — byte-identiek aan het golf-0-gedrag (de tak wordt dan niet betreden). `criticalPaths[0]`
    // blijft ALTIJD de bestaande `criticalPath` (byte-compat, expliciet gecheckt in de check-batterij).
    let criticalPaths: string[][] = [criticalPath];
    const floatPathByTask: Record<string, number> = {};
    const fpOpt = so?.floatPaths;
    if (fpOpt?.enabled) {
      // Hard begrensd op `maxPaths` (ook bij grote netten); <1 ⇒ geen paden.
      const maxPaths = Math.max(0, Math.floor(fpOpt.maxPaths));
      // Hammocks (§4.4 — het veld bestaat al, het gedrag komt in golf 4): nooit end-kandidaat, tellen
      // niet mee in een keten. Nu al respecteren zodat golf 4 hier niets meer hoeft te wijzigen.
      const isHammock = (id: string) => this.tasks.get(id)?.isHammock === true;
      const candidates = new Set<string>();
      for (const id of order) if (!isHammock(id)) candidates.add(id);

      if (fpOpt.method === 'TOTAL_FLOAT') {
        // TF-methode: rangschik op DISTINCT tf (1 = kleinste tf); `floatPath` = rang. Een rang boven
        // `maxPaths` krijgt géén nummer (harde begrenzing). Peelt geen ketens ⇒ criticalPaths blijft
        // de enkele bestaande keten.
        const tfOf = (id: string) => taskResults.get(id)!.totalFloat;
        const distinct = [...new Set([...candidates].map(tfOf))].sort((a, b) => a - b);
        const rankOf = new Map<number, number>();
        distinct.forEach((tf, i) => rankOf.set(tf, i + 1));
        for (const id of candidates) {
          const rank = rankOf.get(tfOf(id))!;
          if (rank <= maxPaths) floatPathByTask[id] = rank;
        }
      } else {
        // FREE_FLOAT (driving-logic-peeling, default): peel ketens naar afnemende EF.
        //   (1) end = niet-toegewezen kandidaat met de grootste EF (topo-volgorde = stabiele tie-break).
        //   (2) keten = traceFrom(end).drivingPredecessors ∪ {end} (hammocks uitgesloten).
        //   (3) ken het padnummer toe aan de nog NIET-toegewezen taken in de keten (een gedeelde
        //       voorganger houdt zo het nummer van de EERSTE peel waarin hij voorkomt).
        //   (4) verwijder de héle keten uit de kandidaten; herhaal tot `maxPaths` of leeg.
        const drivingSet = new Set(drivingSequenceIds);
        const efMs = (id: string) => earlyDates.get(id)!.ef.getTime();
        // Elke gepeelde keten + of hij (volledig) kritiek is — voor de `criticalPaths`-opbouw.
        const peeled: { ids: string[]; critical: boolean }[] = [];
        let p = 0;
        while (candidates.size > 0 && p < maxPaths) {
          let end: string | null = null;
          let bestEf = -Infinity;
          for (const id of order) {
            if (!candidates.has(id)) continue;
            const e = efMs(id);
            if (e > bestEf) { bestEf = e; end = id; }
          }
          if (end === null) break;
          p += 1;
          const chain = new Set<string>([end]);
          for (const q of traceFrom(end, this.sequences, drivingSet).drivingPredecessors) {
            if (!isHammock(q)) chain.add(q);
          }
          for (const id of chain) {
            if (floatPathByTask[id] === undefined && candidates.has(id)) floatPathByTask[id] = p;
          }
          for (const id of chain) candidates.delete(id);
          const ids = [...chain].sort((a, b) => order.indexOf(a) - order.indexOf(b));
          peeled.push({ ids, critical: ids.every((id) => taskResults.get(id)?.isCritical === true) });
        }
        // criticalPaths = alle gepeelde ketens die kritiek zijn. Pad 1 is (indien kritiek) al door
        // `criticalPath` gerepresenteerd op index 0 (byte-compat); extra kritieke ketens (bij ties)
        // komen erachteraan.
        for (let i = 1; i < peeled.length; i++) {
          if (peeled[i].critical) criticalPaths.push(peeled[i].ids);
        }
      }

      // Per-taak `floatPath` op het resultaat (alleen bij enabled ⇒ default byte-identiek ongeschreven).
      for (const [id, r] of taskResults) {
        if (floatPathByTask[id] !== undefined) r.floatPath = floatPathByTask[id];
      }
    }

    return {
      tasks: taskResults,
      criticalPath,
      drivingSequenceIds,
      sequenceFreeFloat,
      truncatedLeadSequenceIds: [...this.truncatedLeadIds],
      violatedConstraintTaskIds,
      missedDeadlineTaskIds,
      outOfSequenceSequenceIds,
      // Fase 2.9 golf 2/3 — analyse-laag: near-critical-set gevuld bij ingestelde drempel (§4.6);
      // `interferingFloat` altijd per taak geschreven. `criticalPaths`/`floatPathByTask` gevuld door de
      // golf-3-post-pass hierboven (uit ⇒ `[criticalPath]` resp. `{}`, byte-identiek).
      nearCriticalTaskIds,
      criticalPaths,
      floatPathByTask,
      // Projecteinde in de projectkalendermodus (§5.4): dag-project ⇒ `formatDate` (byte-identiek).
      projectEnd: formatInstant(projectEnd, this.modeOf(this.projectEngine)),
      projectDuration,
    };
  }
}
