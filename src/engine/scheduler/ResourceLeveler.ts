// Resource-nivelleerder (fase 2.5, resources-ontwerp §5). Serieel SGS-algoritme (Serial
// Schedule Generation Scheme) met één `constrainToFloat`-toggle die tegelijk leveling
// (einddatum mag schuiven) én smoothing (alleen binnen de totale float) dekt — precies zoals
// P6/MSP dit met één engine + boolean doen (§5.1).
//
// KERNPRINCIPES (uit §5.5, architect-gereviewd):
//  - `levelingDelay` is t.o.v. de PRECEDENCE-FEASIBLE start (PF) van een taak — d.w.z. de ES die
//    de forward pass berekent nadat óók de voorgangers hun levelingDelay hebben gekregen — NIET
//    t.o.v. de oorspronkelijke CPM-ES. Anders zouden voorgangersverschuivingen dubbel tellen.
//  - Het capaciteitsgrootboek begint LEEG; alleen vastgepinde taken (priority 1000) worden vooraf
//    op hun CPM-positie geboekt. Taken zonder vraag op de geselecteerde renewables boeken niets.
//  - De eligibility-lus kiest telkens de hoogst gesorteerde taak (§5.2) waarvan álle voorgangers
//    al een definitieve positie hebben (vastgepinde/niet-verschuifbare taken gelden als geplaatst).
//  - PF wordt afgeleid door de bestaande `CPMSolver` te herdraaien op een werkkopie waarin de
//    al-geplaatste taken hun `levelingDelay` hebben en de gekozen taak (nog) niet — dan is de ES
//    van de gekozen taak per constructie zijn PF, mét volledige relatie-/lag-/constraint-logica
//    (geen tweede, afwijkende implementatie van de forward-pass-regels).
//  - Curve-bewust: dezelfde `distributeUnits` als het histogram voedt de capaciteitscheck (§5.7).
//    Nooit `MATERIAL` nivelleren (§5.3).
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { CPMSolver, type CPMResult } from './CPMSolver';
import { distributeUnits, maxUnitsOn } from './ResourceLoad';
import { parseDate, formatDate } from '@/utils/dateUtils';

export interface LevelingOptions {
  /** true = smoothing: alleen binnen de totale float schuiven, einddatum heilig, onoplosbare
   *  conflicten blijven gemarkeerd staan. false = leveling: mag de einddatum verschuiven. */
  constrainToFloat: boolean;
  /** default: alle renewable resources (LABOR/EQUIPMENT/CREW/SUBCONTRACTOR). Materiaal wordt er
   *  altijd uit gefilterd, ook als het expliciet meegegeven wordt (§5.3). */
  resourceIds?: string[];
}

export interface LevelingResult {
  /** taskId → toegepaste levelingDelay (werkdagen), alleen taken die daadwerkelijk verschoven zijn. */
  delays: Record<string, number>;
  /** taskId → resterende, onoplosbare conflictdagen (alleen relevant bij constrainToFloat=true). */
  unresolved: Record<string, string[]>;
  projectEndBefore: string;
  projectEndAfter: string;
}

// Float-tolerantie: dag-granulaire eenheden zijn honderdsten (largestRemainderRound, §4.1); een
// kleine epsilon voorkomt dat 1.0000000001 > 1.0 een fantoomconflict oplevert.
const EPS = 1e-9;
const MAX_SCAN = 5000; // werkdagen-zoekhorizon bij onbeperkt (leveling) vooruit schuiven

export function levelResources(
  tasks: Task[],
  sequences: Sequence[],
  resources: Resource[],
  assignments: ResourceAssignment[],
  projectCalendar: WorkCalendar,
  resourceCalendars: WorkCalendar[],
  cpmResult: CPMResult,
  options: LevelingOptions,
): LevelingResult {
  const projEngine = new CalendarEngine(projectCalendar);

  // Geselecteerde renewables: default alle non-material, anders de opgegeven ids ∩ non-material.
  const renewable = resources.filter(r => r.type !== 'MATERIAL');
  const selectedResources = options.resourceIds
    ? renewable.filter(r => options.resourceIds!.includes(r.id))
    : renewable;
  const selectedIds = new Set(selectedResources.map(r => r.id));

  // Per geselecteerde resource: eigen kalender-engine (informatief; voedt alleen capaciteit, §3.2)
  // en resource-object voor `maxUnitsOn`.
  const resById = new Map(resources.map(r => [r.id, r]));
  const engineByRes = new Map<string, CalendarEngine>();
  for (const r of selectedResources) {
    const cal = r.calendarId
      ? resourceCalendars.find(c => c.id === r.calendarId) ?? projectCalendar
      : projectCalendar;
    engineByRes.set(r.id, new CalendarEngine(cal));
  }
  const capacityOf = (resId: string, iso: string): number => {
    const r = resById.get(resId);
    const eng = engineByRes.get(resId);
    if (!r || !eng) return 0;
    return eng.isWorkDay(parseDate(iso)) ? maxUnitsOn(r, iso) : 0;
  };

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const leafSet = new Set(tasks.map(t => t.id));
  const creationIndex = new Map(tasks.map((t, i) => [t.id, i]));

  // Dagvraag per taak per geselecteerde resource: som van distributeUnits over alle assignments
  // van die taak op die resource (multi-assignment naar dezelfde resource telt op — §4.2).
  const demandByTask = new Map<string, Map<string, number[]>>();
  for (const a of assignments) {
    if (!selectedIds.has(a.resourceId)) continue;
    const task = taskById.get(a.taskId);
    if (!task || task.isMilestone || task.childIds.length > 0) continue;
    const dur = task.time.scheduleDuration;
    if (dur <= 0) continue;
    const arr = distributeUnits(a.unitsPerDay, dur, a.curve ?? 'UNIFORM');
    let byRes = demandByTask.get(a.taskId);
    if (!byRes) { byRes = new Map(); demandByTask.set(a.taskId, byRes); }
    const existing = byRes.get(a.resourceId);
    if (existing) {
      for (let i = 0; i < arr.length; i++) existing[i] = (existing[i] ?? 0) + arr[i];
    } else {
      byRes.set(a.resourceId, [...arr]);
    }
  }

  // Indeling: movable (mag schuiven) vs. gefixeerd (vastgepind of geen vraag op selectie).
  const hasDemand = (id: string) => demandByTask.has(id);
  const movableIds: string[] = [];
  const pinnedIds: string[] = [];
  for (const t of tasks) {
    if (!hasDemand(t.id)) continue;             // geen vraag op geselecteerde renewables → niet verschuiven
    if (t.priority === 1000) pinnedIds.push(t.id); // vastgepind (§5.4)
    else movableIds.push(t.id);
  }

  // Voorganger-map (alleen relaties tussen leaf-taken in dit universum).
  const predsOf = new Map<string, string[]>();
  for (const t of tasks) predsOf.set(t.id, []);
  for (const seq of sequences) {
    if (leafSet.has(seq.predecessorId) && leafSet.has(seq.successorId)) {
      predsOf.get(seq.successorId)!.push(seq.predecessorId);
    }
  }

  // Grootboek: booked[resId][iso] = geboekte eenheden.
  const booked: Record<string, Record<string, number>> = {};
  const book = (resId: string, iso: string, amount: number) => {
    if (!booked[resId]) booked[resId] = {};
    booked[resId][iso] = (booked[resId][iso] ?? 0) + amount;
  };
  const bookedOn = (resId: string, iso: string) => booked[resId]?.[iso] ?? 0;

  // Werkkopie voor PF-berekening: klonen zodat we `levelingDelay` kunnen zetten zonder de
  // echte taken te muteren. `time` shallow-clonen (parseDate leest alleen strings).
  const workTasks: Task[] = tasks.map(t => ({ ...t, levelingDelay: undefined, time: { ...t.time } }));
  const workById = new Map(workTasks.map(t => [t.id, t]));

  // Geplaatste posities (voor projectEndAfter en boekhouding): iso-startdag.
  const placedStartIso = new Map<string, string>();

  // Boek de dagvraag van een taak af vanaf een gegeven startdag (projectkalender-werkdagen).
  const bookDemandAt = (taskId: string, startDate: Date): string[] => {
    const task = taskById.get(taskId)!;
    const dur = task.time.scheduleDuration;
    const occ = nextWorkDays(projEngine, startDate, dur);
    const byRes = demandByTask.get(taskId)!;
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length && i < occ.length; i++) book(resId, occ[i], arr[i]);
    }
    return occ;
  };

  // 1/3. Vastgepinde taken vooraf boeken op hun CPM-positie (blijven daar, §5.4).
  for (const id of pinnedIds) {
    const task = taskById.get(id)!;
    bookDemandAt(id, parseDate(task.time.earlyStart));
    placedStartIso.set(id, task.time.earlyStart);
  }

  // Sorteervolgorde (§5.2): priority desc, totalFloat asc, earlyStart asc, aanmaakvolgorde asc.
  // De laatste sleutel is BEWUST de stabiele aanmaakvolgorde i.p.v. de letterlijke task-ID: de
  // id's van dit project bevatten een Math.random-component (utils/id.ts), waardoor
  // string-sortering op id niet reproduceerbaar zou zijn — dat zou juist het determinisme
  // ondermijnen dat §5.2 wil garanderen. Aanmaakvolgorde is de gepubliceerde, voorspelbare sleutel.
  const cmp = (a: string, b: string): number => {
    const ta = taskById.get(a)!, tb = taskById.get(b)!;
    if (tb.priority !== ta.priority) return tb.priority - ta.priority; // hoger eerst
    if (ta.time.totalFloat !== tb.time.totalFloat) return ta.time.totalFloat - tb.time.totalFloat;
    if (ta.time.earlyStart !== tb.time.earlyStart) return ta.time.earlyStart < tb.time.earlyStart ? -1 : 1;
    return creationIndex.get(a)! - creationIndex.get(b)!;
  };
  const sortedMovable = [...movableIds].sort(cmp);

  // Geplaatst-verzameling voor eligibility: alle niet-movable taken (gefixeerd/vastgepind/mijlpaal)
  // gelden meteen als geplaatst; movable taken komen erbij zodra ze verwerkt zijn.
  const placed = new Set<string>();
  for (const t of tasks) if (!movableIds.includes(t.id)) placed.add(t.id);

  const delays: Record<string, number> = {};
  const unresolved: Record<string, string[]> = {};

  const allPredsPlaced = (id: string) => predsOf.get(id)!.every(p => placed.has(p));

  let remaining = sortedMovable.length;
  let safety = remaining + 1;
  while (remaining > 0 && safety-- > 0) {
    // Kies de hoogst gesorteerde nog-niet-geplaatste taak waarvan alle voorgangers geplaatst zijn.
    const pick = sortedMovable.find(id => !placed.has(id) && allPredsPlaced(id));
    if (!pick) break; // zou niet mogen (CPM is acyclisch); voorkom oneindige lus

    // PF: draai de CPMSolver op de werkkopie (geplaatste taken hebben hun delay; `pick` niet).
    const pf = computePF(pick, workTasks, sequences, projEngine);

    // Zoekvenster: bij constrainToFloat begrensd tot de oorspronkelijke late start.
    const ls = options.constrainToFloat ? parseDate(taskById.get(pick)!.time.lateStart) : null;

    const slot = findSlot(pick, pf, ls);
    // Boek de gevonden (of PF-)positie en zet de delay.
    const startDate = slot.start;
    bookDemandAt(pick, startDate);
    placedStartIso.set(pick, formatDate(startDate));
    const delay = projEngine.workDaysBetween(pf, startDate) - 1; // beide werkdagen, inclusieve telling −1
    if (delay > 0) delays[pick] = delay;
    if (slot.unresolved.length > 0) unresolved[pick] = slot.unresolved;
    workById.get(pick)!.levelingDelay = delay > 0 ? delay : undefined;

    placed.add(pick);
    remaining--;
  }

  // projectEndAfter: laatste finish over alle leaf-taken op hun (geplaatste of CPM-)positie.
  let endAfter = cpmResult.projectEnd;
  for (const t of tasks) {
    const startIso = placedStartIso.get(t.id);
    let finishIso: string;
    if (startIso) {
      const dur = t.time.scheduleDuration;
      finishIso = formatDate(projEngine.addWorkDays(parseDate(startIso), dur));
    } else {
      finishIso = t.time.earlyFinish;
    }
    if (finishIso > endAfter) endAfter = finishIso;
  }

  return {
    delays,
    unresolved,
    projectEndBefore: cpmResult.projectEnd,
    projectEndAfter: endAfter,
  };

  // --- lokale helpers (sluiten over booked/demandByTask/capacityOf/projEngine) ---

  /** Scan vanaf PF dag-voor-dag naar de eerste aaneengesloten run van werkdagen (lengte = duur)
   *  waarin elke benodigde resource elke dag genoeg restcapaciteit heeft. `ls` != null (smoothing)
   *  begrenst het venster; geen slot binnen het venster → blijf op PF (mét conflict) en meld
   *  de conflictdagen (§5.5 stap 4c/4d/4e). */
  function findSlot(
    taskId: string,
    pf: Date,
    ls: Date | null,
  ): { start: Date; unresolved: string[] } {
    const task = taskById.get(taskId)!;
    const dur = task.time.scheduleDuration;
    const byRes = demandByTask.get(taskId)!;

    let cand = projEngine.nextWorkDay(pf);
    let guard = 0;
    while (guard++ < MAX_SCAN) {
      const occ = nextWorkDays(projEngine, cand, dur);
      if (fits(byRes, occ)) return { start: cand, unresolved: [] };
      const next = projEngine.nextWorkDayAfter(cand);
      if (ls && next > ls) break; // volgende kandidaat valt buiten de float — geen slot
      cand = next;
    }

    // Geen slot: blijf op PF, verzamel de conflictdagen (waar de vraag de restcapaciteit overschrijdt).
    const occ = nextWorkDays(projEngine, pf, dur);
    const conflicts: string[] = [];
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        if (bookedOn(resId, occ[i]) + arr[i] > capacityOf(resId, occ[i]) + EPS) conflicts.push(occ[i]);
      }
    }
    return { start: projEngine.nextWorkDay(pf), unresolved: [...new Set(conflicts)].sort() };
  }

  /** Past de dagvraag `byRes` op de opeenvolgende werkdagen `occ` binnen de restcapaciteit? */
  function fits(byRes: Map<string, number[]>, occ: string[]): boolean {
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        if (arr[i] <= 0) continue;
        if (bookedOn(resId, occ[i]) + arr[i] > capacityOf(resId, occ[i]) + EPS) return false;
      }
    }
    return true;
  }
}

/** De eerste `count` werkdagen (volgens `engine`) op of ná `start`, inclusief `start` als het een
 *  werkdag is. Voor een taak van `count` werkdagen die op `start` begint. */
function nextWorkDays(engine: CalendarEngine, start: Date, count: number): string[] {
  const isos: string[] = [];
  let current = engine.nextWorkDay(new Date(start.getTime()));
  let guard = 0;
  while (isos.length < count && guard++ < 200_000) {
    isos.push(formatDate(current));
    if (isos.length >= count) break;
    current = engine.nextWorkDayAfter(current);
  }
  return isos;
}

/** Precedence-feasible start van `taskId`: herdraai de CPMSolver op de werkkopie (waarin de
 *  geplaatste voorgangers hun `levelingDelay` hebben en `taskId` niet) en lees de early start.
 *  Dat is per constructie de PF mét alle relatie-/lag-/constraint-logica. */
function computePF(
  taskId: string,
  workTasks: Task[],
  sequences: Sequence[],
  projEngine: CalendarEngine,
): Date {
  const solver = new CPMSolver(workTasks, sequences, projEngine);
  const res = solver.solve();
  const r = res.tasks.get(taskId);
  return r ? parseDate(r.earlyStart) : parseDate(workTasks.find(t => t.id === taskId)!.time.earlyStart);
}
