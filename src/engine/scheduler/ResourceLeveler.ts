// Resource-nivelleerder (fase 2.5, resources-ontwerp §5). Serieel SGS-algoritme (Serial
// Schedule Generation Scheme) met één `constrainToFloat`-toggle die tegelijk leveling
// (einddatum mag schuiven) én smoothing (alleen binnen de totale float) dekt — precies zoals
// P6/MSP dit met één engine + boolean doen (§5.1).
//
// KERNPRINCIPES (uit §5.5, architect-gereviewd):
//  - `levelingDelay` is t.o.v. de PRECEDENCE-FEASIBLE start (PF) van een taak — d.w.z. de ES die
//    de forward pass berekent nadat óók de voorgangers hun levelingDelay hebben gekregen — NIET
//    t.o.v. de oorspronkelijke CPM-ES. Anders zouden voorgangersverschuivingen dubbel tellen.
//  - Het capaciteitsgrootboek begint LEEG; taken worden gevuld in eligibility-volgorde. Ook
//    vastgepinde taken (priority 1000) lopen door de lus: ze schuiven NIET voor capaciteit, maar
//    volgen wél hun (mogelijk verschoven) voorgangers — MSP "Do Not Level"-semantiek (§5.4, A4).
//  - De eligibility-lus kiest telkens de hoogst gesorteerde taak (§5.2) waarvan álle voorgangers
//    al een definitieve positie hebben; niet-verschuifbare taken (geen vraag / mijlpaal / summary)
//    gelden meteen als geplaatst.
//  - PF wordt afgeleid door de bestaande `CPMSolver` te herdraaien op een werkkopie waarin de
//    al-geplaatste taken hun `levelingDelay` hebben en de gekozen taak (nog) niet — dan is de ES
//    van de gekozen taak per constructie zijn PF, mét volledige relatie-/lag-/constraint-logica.
//  - Curve-bewust: dezelfde `distributeUnits` als het histogram voedt de capaciteitscheck (§5.7).
//    Nooit `MATERIAL` nivelleren (§5.3).
//
// VERSE INTERNE CPM-SOLVE (A2/A4, deze golf): `levelResources` leest de sorteersleutels
// (totalFloat/earlyStart), de PF-basis, de vastgepinde-boekingspositie én de smoothing-vensters
// NIET uit de meegegeven `cpmResult` (die kan na een taakwijziging zonder F5 verouderd zijn), maar
// uit een VERSE `CPMSolver.solve()` op werkkopieën ZONDER levelingDelays. `applyLeveling` reset de
// delays toch vóór herplaatsing, dus die no-delay-baseline is precies het schema waartegen genivelleerd
// wordt.
//
// PREVIEW UIT ÉÉN PROEF-SOLVE (A1, deze golf): `projectEndAfter` én de verzameling verschoven taken
// (`shifts`) komen uit één echte proef-`CPMSolver.solve()` op de werkkopieën met ALLE nieuwe delays
// gezet — exact de route die `applyLeveling`→`runCPM` straks echt neemt. Zo bevat de preview óók
// niet-geresourcete FS-opvolgers die pas via de forward pass meeschuiven (die zaten niet in de oude
// heuristiek die alleen geplaatste taken optelde).
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { CPMSolver, type CPMResult, type CPMOptions } from './CPMSolver';
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

/** Reden waarom een taak onopgelost bleef (A3, deze golf) — de nivelleer-dialoog kiest hierop de
 *  bijpassende uitleg. */
export type LevelingReason = 'CALENDAR_MISMATCH' | 'INSUFFICIENT_CAPACITY' | 'INTRINSIC_OVERRUN';

/** Eén verschuiving voor de preview-tabel (A1): elke taak wiens start wijzigt t.o.v. het huidige
 *  schema — óók niet-geresourcete opvolgers die enkel via de forward pass meeschuiven. */
export interface LevelingShift {
  oldStart: string;
  newStart: string;
  /** getekend aantal werkdagen (positief = later, negatief = eerder). */
  delta: number;
}

export interface LevelingResult {
  /** taskId → toegepaste levelingDelay (werkdagen), alleen taken die daadwerkelijk een eigen delay
   *  krijgen. Vastgepinde/niet-geresourcete opvolgers staan hier NIET in (die schuiven via de CPM-
   *  propagatie, niet via een eigen delay) — `applyLeveling` schrijft precies dit veld. */
  delays: Record<string, number>;
  /** taskId → resterende, onoplosbare conflictdagen. */
  unresolved: Record<string, string[]>;
  /** taskId → reden van het onopgeloste conflict (parallel aan `unresolved`). */
  unresolvedReasons: Record<string, LevelingReason>;
  /** taskId → start-verschuiving voor de preview-tabel (elke taak wiens start wijzigt, A1). */
  shifts: Record<string, LevelingShift>;
  projectEndBefore: string;
  projectEndAfter: string;
}

// Float-tolerantie: dag-granulaire eenheden zijn honderdsten (largestRemainderRound, §4.1); een
// kleine epsilon voorkomt dat 1.0000000001 > 1.0 een fantoomconflict oplevert.
const EPS = 1e-9;

export function levelResources(
  tasks: Task[],
  sequences: Sequence[],
  resources: Resource[],
  assignments: ResourceAssignment[],
  projectCalendar: WorkCalendar,
  resourceCalendars: WorkCalendar[],
  cpmResult: CPMResult,
  options: LevelingOptions,
  // Fase 2.10 (P1-verwante correctie): de interne CPM-herberekeningen hieronder (baseline/PF/proef)
  // draaiden tot nu toe ZONDER `dataDate`/`progressMode` — een gat dat al bestond sinds fase 2.5
  // (vóór de voortgang/statusdatum-functie van fase 2.6) en nooit werd bijgewerkt. Bij een project
  // MET voortgang+statusdatum (zoals de MIDDEL-showcase) rekende de nivelleerder zo op een andere
  // (pure-ASAP, actual-onbewuste) realiteit dan de getoonde planning: sorteersleutels, PF én de
  // proef-solve voor de preview weken af van de werkelijke (actual-gepinde) datums, waardoor de
  // plaatsingslus conflicten miste die `computeResourceLoad` (WEL op de echte datums) wél zag —
  // zichtbaar als "0 taken verschoven, 0 onopgelost" terwijl er gewoon overallocatie bleef staan.
  // Optioneel + default `{}` ⇒ byte-identiek voor elke aanroeper die niets doorgeeft.
  cpmOptions: CPMOptions = {},
): LevelingResult {
  const projEngine = new CalendarEngine(projectCalendar);

  // Geselecteerde renewables: default alle non-material, anders de opgegeven ids ∩ non-material.
  const renewable = resources.filter(r => r.type !== 'MATERIAL');
  const selectedResources = options.resourceIds
    ? renewable.filter(r => options.resourceIds!.includes(r.id))
    : renewable;
  const selectedIds = new Set(selectedResources.map(r => r.id));

  // Per geselecteerde resource: eigen kalender-engine (voedt capaciteit, §3.2) en resource-object.
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
  // Maximaal beschikbare eenheden op een wérkdag van de resource (vlakke maxUnits of de hoogste
  // availabilityStep) — basis voor de intrinsieke-overvraag-detectie (A3).
  const maxCapacityOf = (resId: string): number => {
    const r = resById.get(resId);
    if (!r) return 0;
    let m = r.maxUnits;
    for (const s of r.availabilitySteps ?? []) m = Math.max(m, s.maxUnits);
    return m;
  };

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const leafSet = new Set(tasks.map(t => t.id));
  const creationIndex = new Map(tasks.map((t, i) => [t.id, i]));

  // Werkkopie ZONDER levelingDelays. Voedt (a) de VERSE baseline-solve (sorteersleutels/PF/vensters,
  // A2/A4) en (b) — nadat de lus de delays erop gezet heeft — de proef-solve voor de preview (A1).
  const workTasks: Task[] = tasks.map(t => ({ ...t, levelingDelay: undefined, time: { ...t.time } }));
  const workById = new Map(workTasks.map(t => [t.id, t]));

  // A2/A4: VERSE baseline — de enige bron voor sorteersleutels (totalFloat/earlyStart), PF-basis en
  // smoothing-vensters (lateStart). Nooit de (mogelijk stale) meegegeven cpmResult. `cpmOptions`
  // (dataDate/progressMode) mee, anders wijkt deze baseline af van de echte (actual-gepinde)
  // planning zodra het project voortgang+statusdatum heeft (zie parameter-toelichting hierboven).
  const baseline = new CPMSolver(workTasks, sequences, projectCalendar, resourceCalendars, cpmOptions).solve();
  if (baseline.error) {
    const end = cpmResult.projectEnd;
    return { delays: {}, unresolved: {}, unresolvedReasons: {}, shifts: {}, projectEndBefore: end, projectEndAfter: end };
  }
  const baseEs = (id: string): string =>
    baseline.tasks.get(id)?.earlyStart ?? taskById.get(id)!.time.earlyStart;
  const baseLs = (id: string): string =>
    baseline.tasks.get(id)?.lateStart ?? taskById.get(id)!.time.lateStart;
  const baseFloat = (id: string): number =>
    baseline.tasks.get(id)?.totalFloat ?? taskById.get(id)!.time.totalFloat;

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
  const pinnedSet = new Set(pinnedIds);

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

  // Geplaatste posities (voor boekhouding/debug): iso-startdag.
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

  // Zoekhorizon: i.p.v. een vaste 5000-dagen-scan (A3b) een data-gedreven grens — zelfs een volledig
  // geserialiseerde plaatsing (elke taak achter elkaar) past binnen de som van alle taakduren + marge.
  const totalWork = tasks.reduce((sum, t) => sum + (t.isMilestone ? 0 : Math.max(0, t.time.scheduleDuration)), 0);
  const scanLimit = Math.max(totalWork + 10, 30);

  // Sorteervolgorde (§5.2): priority desc, totalFloat asc, earlyStart asc, aanmaakvolgorde asc — alle
  // sleutels uit de VERSE baseline (A2). De laatste sleutel is bewust de stabiele aanmaakvolgorde
  // i.p.v. de random-bevattende task-ID (utils/id.ts), zodat het determinisme van §5.2 klopt.
  const cmp = (a: string, b: string): number => {
    const ta = taskById.get(a)!, tb = taskById.get(b)!;
    if (tb.priority !== ta.priority) return tb.priority - ta.priority; // hoger eerst
    const fa = baseFloat(a), fb = baseFloat(b);
    if (fa !== fb) return fa - fb;
    const ea = baseEs(a), eb = baseEs(b);
    if (ea !== eb) return ea < eb ? -1 : 1;
    return creationIndex.get(a)! - creationIndex.get(b)!;
  };
  // Zowel movable als pinned lopen door de lus (pinned volgt voorgangers, maar schuift niet voor
  // capaciteit — A4). Niet-actieve taken (geen vraag / mijlpaal / summary) gelden meteen als geplaatst.
  const active = new Set<string>([...pinnedIds, ...movableIds]);
  const sortedActive = [...active].sort(cmp);

  const placed = new Set<string>();
  for (const t of tasks) if (!active.has(t.id)) placed.add(t.id);

  const delays: Record<string, number> = {};
  const unresolved: Record<string, string[]> = {};
  const unresolvedReasons: Record<string, LevelingReason> = {};

  const allPredsPlaced = (id: string) => predsOf.get(id)!.every(p => placed.has(p));

  let remaining = sortedActive.length;
  let safety = remaining + 1;
  while (remaining > 0 && safety-- > 0) {
    // Kies de hoogst gesorteerde nog-niet-geplaatste taak waarvan alle voorgangers geplaatst zijn.
    const pick = sortedActive.find(id => !placed.has(id) && allPredsPlaced(id));
    if (!pick) break; // zou niet mogen (CPM is acyclisch); voorkom oneindige lus

    // PF: draai de CPMSolver op de werkkopie (geplaatste taken hebben hun delay; `pick` niet).
    const pf = computePF(pick, workTasks, sequences, projectCalendar, resourceCalendars, cpmOptions);

    let startDate: Date;
    let slotUnresolved: string[] = [];
    let slotReason: LevelingReason | undefined;
    if (pinnedSet.has(pick)) {
      // Vastgepind (§5.4/A4): volgt zijn (mogelijk verschoven) voorgangers via PF, maar schuift NIET
      // voor capaciteit — geen scan. Boeking op PF valt zo samen met de finale CPM-positie (waar de
      // pin zijn voorgangers volgt), i.p.v. op de stale oorspronkelijke earlyStart.
      startDate = projEngine.nextWorkDay(pf);
    } else {
      // Smoothing-venster uit de VERSE baseline lateStart (A2), niet uit de stale cpmResult.
      const ls = options.constrainToFloat ? parseDate(baseLs(pick)) : null;
      const slot = findSlot(pick, pf, ls);
      startDate = slot.start;
      slotUnresolved = slot.unresolved;
      slotReason = slot.reason;
    }

    bookDemandAt(pick, startDate);
    placedStartIso.set(pick, formatDate(startDate));
    const delay = projEngine.workDaysBetween(pf, startDate) - 1; // beide werkdagen, inclusieve telling −1
    if (delay > 0) delays[pick] = delay;
    if (slotUnresolved.length > 0) {
      unresolved[pick] = slotUnresolved;
      if (slotReason) unresolvedReasons[pick] = slotReason;
    }
    workById.get(pick)!.levelingDelay = delay > 0 ? delay : undefined;

    placed.add(pick);
    remaining--;
  }

  // A1: preview uit één echte proef-solve op de werkkopieën (nu mét alle gezette delays) — exact wat
  // applyLeveling→runCPM straks doet (incl. `cpmOptions`, anders wijkt de preview zelf weer af).
  // Bevat óók niet-geresourcete opvolgers die enkel meeschuiven.
  const trial = new CPMSolver(workTasks, sequences, projectCalendar, resourceCalendars, cpmOptions).solve();
  const projectEndAfter = trial.error ? cpmResult.projectEnd : trial.projectEnd;

  const shifts: Record<string, LevelingShift> = {};
  for (const t of tasks) {
    const cur = t.time.earlyStart; // huidige, getoonde positie
    const tr = trial.tasks.get(t.id)?.earlyStart;
    if (!cur || !tr || cur === tr) continue;
    const from = parseDate(cur), to = parseDate(tr);
    const delta = to >= from
      ? projEngine.workDaysBetween(from, to) - 1
      : -(projEngine.workDaysBetween(to, from) - 1);
    shifts[t.id] = { oldStart: cur, newStart: tr, delta };
  }

  return {
    delays,
    unresolved,
    unresolvedReasons,
    shifts,
    projectEndBefore: cpmResult.projectEnd,
    projectEndAfter,
  };

  // --- lokale helpers (sluiten over booked/demandByTask/capacityOf/projEngine) ---

  /** Scan vanaf PF dag-voor-dag naar de eerste aaneengesloten run van werkdagen (lengte = duur)
   *  waarin elke benodigde resource elke dag genoeg restcapaciteit heeft. `ls` != null (smoothing)
   *  begrenst het venster; geen slot binnen het venster → blijf op PF (mét conflict) en meld de
   *  conflictdagen + reden (§5.5 stap 4c/4d/4e, A3). */
  function findSlot(
    taskId: string,
    pf: Date,
    ls: Date | null,
  ): { start: Date; unresolved: string[]; reason?: LevelingReason } {
    const task = taskById.get(taskId)!;
    const dur = task.time.scheduleDuration;
    const byRes = demandByTask.get(taskId)!;

    let cand = projEngine.nextWorkDay(pf);
    let calendarFeasibleSeen = false; // is er überhaupt een venster waar élke vraagdag óók een resource-werkdag is?
    let guard = 0;
    while (guard++ < scanLimit) {
      const occ = nextWorkDays(projEngine, cand, dur);
      if (!calendarFeasibleSeen && calendarOk(byRes, occ)) calendarFeasibleSeen = true;
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
    return {
      start: projEngine.nextWorkDay(pf),
      unresolved: [...new Set(conflicts)].sort(),
      reason: reasonFor(byRes, calendarFeasibleSeen),
    };
  }

  /** Reden waarom er geen slot bestaat (A3). Volgorde: intrinsiek (de piekvraag overtreft de
   *  maximale capaciteit van de resource ongeacht plaatsing) → kalender-mismatch (geen enkel venster
   *  waar alle vraagdagen ook resource-werkdagen zijn) → anders onvoldoende vrije capaciteit. */
  function reasonFor(byRes: Map<string, number[]>, calendarFeasibleSeen: boolean): LevelingReason {
    for (const [resId, arr] of byRes) {
      const peak = arr.length > 0 ? Math.max(...arr) : 0;
      if (peak > maxCapacityOf(resId) + EPS) return 'INTRINSIC_OVERRUN';
    }
    if (!calendarFeasibleSeen) return 'CALENDAR_MISMATCH';
    return 'INSUFFICIENT_CAPACITY';
  }

  /** Kalender-haalbaar venster? Elke vraagdag (>0) valt op een resource-werkdag (capaciteit > 0),
   *  ongeacht al geboekte belasting — puur de kalender-uitlijning (A3). */
  function calendarOk(byRes: Map<string, number[]>, occ: string[]): boolean {
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] <= 0) continue;
        if (i >= occ.length) return false;
        if (capacityOf(resId, occ[i]) <= 0) return false;
      }
    }
    return true;
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
  projectCalendar: WorkCalendar,
  registry: WorkCalendar[],
  cpmOptions: CPMOptions,
): Date {
  const solver = new CPMSolver(workTasks, sequences, projectCalendar, registry, cpmOptions);
  const res = solver.solve();
  const r = res.tasks.get(taskId);
  return r ? parseDate(r.earlyStart) : parseDate(workTasks.find(t => t.id === taskId)!.time.earlyStart);
}
