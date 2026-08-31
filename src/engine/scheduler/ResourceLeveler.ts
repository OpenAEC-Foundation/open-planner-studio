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
//    al een definitieve positie hebben; niet-verschuifbare taken (geen vraag / mijlpaal / summary /
//    ONVERPLAATSBAAR — VOLTOOID (`completion >= 1 && actualFinish`) ÓF IN UITVOERING (`(actualStart
//    || completion > 0) && completion < 1`), eindpoortronde W0/W1 — `isImmovableTask`) gelden meteen
//    als geplaatst. Zo'n taak boekt haar vraag WEL als vaste last (op haar eigen actuals-/restwerk-
//    gedreven positie, vóór de eligibility-lus, zie `fixedLoadIds`), maar krijgt NOOIT een
//    `levelingDelay` — `CPMSolver.forwardPass`'s VOLTOOID- én IN-UITVOERING-tak plannen zo'n taak
//    allebei onvoorwaardelijk op haar actuals/restwerk en negeren `levelingDelay` volledig, dus een
//    delay zou een stille no-op zijn (W1: dit gold al voor VOLTOOID; IN UITVOERING was het gat dat
//    reviewer-probe M blootlegde — een halverwege-taak kreeg nog een genegeerde delay).
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
import { resolveCalendar } from './resolveCalendar';
import { CPMSolver, type CPMResult, type CPMOptions } from './CPMSolver';
import { distributeUnits, maxUnitsOn, enumerateWorkDays } from './ResourceLoad';
import { enumerateTaskWorkDays } from './splitWalk';
import { parseDate, formatDate, addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';

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
    engineByRes.set(r.id, new CalendarEngine(resolveCalendar(r.calendarId, resourceCalendars, projectCalendar)));
  }

  // Kalender-engine voor de TAAKkalender (B1c-W0.2/W0.3) — spiegelt `ResourceLoad.ts`s
  // `engineForTask`/`CPMSolver.calendarFor` EXACT: dezelfde bron (`task.calendarId`), dezelfde
  // fallback (geen/onbekende id ⇒ projectkalender). Gecachet per calendarId, gedeeld door zowel de
  // boeking (`bookDemandAt`) als de delay-meting hieronder — vóór deze fix rekenden die twee
  // (en de lastlezer) stilzwijgend op VERSCHILLENDE kalenders (zie het commitbericht van ec4004db).
  const taskEngineCache = new Map<string, CalendarEngine>();
  const engineForTask = (task: Task): CalendarEngine => {
    const key = task.calendarId ?? '';
    let eng = taskEngineCache.get(key);
    if (!eng) {
      eng = key === ''
        ? projEngine
        : new CalendarEngine(resolveCalendar(task.calendarId, resourceCalendars, projectCalendar));
      taskEngineCache.set(key, eng);
    }
    return eng;
  };

  // Kandidaat-as (C1/C2, kwaliteitsronde taak 4): WAAR een taak mag STARTEN volgt nu dezelfde as als
  // waarmee de delay verderop gemeten wordt — niet langer onvoorwaardelijk de projectkalender. Voor
  // een taak zonder eigen `calendarId` is `engineForTask` === `projEngine`, dus dit is byte-identiek
  // voor elke bestaande case zonder taak-`calendarId` (de 25 cases in `cases-resource-leveling.json`
  // zetten er geen één). ELAPSEDTIME kent geen werkdagbegrip — daar is ELKE kalenderdag een geldige
  // kandidaat, spiegelt `CPMSolver.shiftByLevelingDelay`s `addElapsedMinutes`-tak (evenmin een
  // werkdaggrens). Vóór deze fix bleef de kandidaat-SCAN op de projectkalender staan terwijl de
  // delay-METING (B1c-W0.3) al naar de taakkalender was verhuisd: de oude "−1"-aftrek absorbeerde
  // dat verschil toevallig stil zólang er capaciteitsdruk was (de gemeten afstand naar een écht
  // wijkmoment klopte toch), maar bij NUL capaciteitsdruk (findSlot vindt meteen een slot op de
  // eerste projectkalender-kandidaat) gaf het een spookvertraging: de kalenderafstand tussen die
  // projectkalender-snap en de taakkalender-PF, terwijl er helemaal geen conflict was en de delay 0
  // hoorde te zijn (reviewer-probes K/A/E/J).
  const nextCandidateFor = (task: Task, d: Date): Date =>
    task.time.durationType === 'ELAPSEDTIME' ? d : engineForTask(task).nextWorkDay(d);
  const nextCandidateAfterFor = (task: Task, d: Date): Date =>
    task.time.durationType === 'ELAPSEDTIME' ? addCalendarDays(d, 1) : engineForTask(task).nextWorkDayAfter(d);

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
  // B1c-plan-2 taak 1 (M10): ook de sub-dag-precisie (`levelingDelayMinutes`/`levelingDelayElapsed`)
  // strippen — `CPMSolver.shiftByLevelingDelay` leest die VÓÓR `levelingDelay`, dus een
  // `.mpp`-geïmporteerde vertraging op een taak MET voorganger zou hier stil in de baseline blijven
  // staan en zowel de sorteersleutels als de PF vervalsen (zie `check-leveling-delay-units.ts`,
  // deel 2, voor het concrete voorbeeld: het conflict verdween volledig uit beeld).
  const workTasks: Task[] = tasks.map(t => ({
    ...t,
    levelingDelay: undefined,
    levelingDelayMinutes: undefined,
    levelingDelayElapsed: undefined,
    time: { ...t.time },
  }));
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

  // Dagenset (I5/I6, kwaliteitsronde taak 4) die `task`, gestart op `startDate`, daadwerkelijk boekt
  // — GEDEELD door zowel de kandidaat-capaciteitscheck in `findSlot` als de uiteindelijke boeking in
  // `bookDemandAt`. Vóór deze deling konden conflictdetectie en boeking op een ANDERE dagenset
  // rekenen (voor split-/afwijkende-kalendertaken met name): de scan zag een aaneengesloten-
  // werkdagenvenster terwijl de boeking al split-/taakkalender-bewust was. Eén functie, twee
  // afnemers — hetzelfde patroon als `distributeUnits` voor het histogram/de leveler (§5.7).
  //
  // ELAPSEDTIME (I3): de spanne komt uit de VERSE baseline (`baseline.tasks.get`, dezelfde bron als
  // `baseEs`/`baseLs` hierboven), NIET de mogelijk-STALE `task.time.earlyStart/earlyFinish` — die
  // velden zijn exact de "stale na een taakwijziging zonder F5"-categorie waar deze module elders al
  // tegen guardt (zie de `cpmOptions`-toelichting hierboven). De KALENDERSPANNE (van earlyStart tot
  // earlyFinish) blijft bij een verschuiving gelijk aan de baseline-spanne — het AANTAL werkdagen
  // daarbinnen NIET per se (dat hangt af van welke kalenderdagen in de VERSCHOVEN spanne toevallig op
  // een werkdag vallen), vandaar dat hieronder de spanne zelf (niet een werkdagentelling) getransleerd
  // wordt over de kalenderdagen-offset tussen `startDate` en de baseline-`earlyStart`.
  //
  // I4: een lege/onparseerbare datum (bv. na een handgemaakte MCP/JSON-invoer, of een corrupte
  // `startDate` die ergens bovenstrooms toch een Invalid Date bleek) levert GEEN boeking op (`[]`) —
  // de taak wordt overgeslagen, zoals de baseline-solve zelf ook degradeert i.p.v. te crashen (§169-
  // 172 hierboven) — i.p.v. een `RangeError` verderop in `formatDate`/`toISOString` op een Invalid Date.
  // VOLTOOID (eindpoortronde W0): dezelfde vorm als de ELAPSEDTIME-tak, samengevoegd tot één
  // conditie — earlyFinish is voor zo'n taak niet stale maar GEZAGHEBBEND (CPMSolver.forwardPass's
  // VOLTOOID-tak, ~regel 1420-1456, plant onvoorwaardelijk op actualStart/actualFinish), zie het
  // BESLUIT bij `ResourceLoad.ts`'s docblok voor de volledige motivering (die twee functies delen nu
  // exact deze conditie). Voor een voltooide taak boekt de leveler ALTIJD op haar eigen (ongeschoven)
  // positie — zie `fixedLoadIds` hieronder — dus `shiftDays` is hier in de praktijk 0, maar de
  // vertaalde vorm wordt bewust hergebruikt i.p.v. een aparte kale variant: één formule, geen tweede
  // die stil kan afdrijven.
  const isCompletedTask = (task: Task): boolean => task.time.completion >= 1 && !!task.time.actualFinish;
  // IN UITVOERING (eindpoortronde W0, slot — W1): spiegelt CPMSolver.forwardPass's TWEEDE
  // voortgangs-conditie EXACT (~regel 1458: `(t.actualStart || t.completion > 0) && t.completion <
  // 1`) — díe tak plant, net als de VOLTOOID-tak, onvoorwaardelijk op actualStart/restwerk en eindigt
  // ook in een `continue` die `levelingDelay` nooit raadpleegt (regel ~1843-1844: `results.set(...);
  // continue;`). Een taak in uitvoering is dus EVENZEER onverplaatsbaar voor de leveler — reviewer-
  // probe M: zonder deze uitbreiding kreeg zo'n taak nog een stille no-op-delay (CPM negeert 'm
  // toch), bleef ze op haar werkelijke datum staan, en herleefde het conflict stil.
  const isInProgressTask = (task: Task): boolean =>
    (!!task.time.actualStart || task.time.completion > 0) && task.time.completion < 1;
  // BREED (voor `fixedLoadIds` hieronder): VOLTOOID ÓF IN UITVOERING — beide takken in
  // `CPMSolver.forwardPass` negeren `levelingDelay`, dus beide horen NOOIT een delay te krijgen en
  // WEL als vaste last te boeken.
  const isImmovableTask = (task: Task): boolean => isCompletedTask(task) || isInProgressTask(task);
  const occurrenceFor = (task: Task, startDate: Date): string[] => {
    if (isNaN(startDate.getTime())) return [];
    const taskEngine = engineForTask(task);
    // SMAL op `isCompletedTask` — BEWUST NIET samengevoegd met `isInProgressTask` (W1): voor een
    // VOLTOOIDE taak is `earlyFinish` gezaghebbend uit de actuals afgeleid (zie hieronder), maar voor
    // een taak IN UITVOERING komt `earlyFinish` uit de restduur-berekening (CPMSolver.forwardPass se
    // `remaining`-tak) — daar is de GEWONE `scheduleDuration`-werkdagenwandeling vanaf `earlyStart`
    // wél juist, want die weerspiegelt exact hetzelfde restwerk waaruit CPM ook `earlyFinish` afleidt.
    // Alleen de BOEKING (via `fixedLoadIds`) hoeft breed te zijn, deze dagenset-mapping niet.
    if (task.time.durationType === 'ELAPSEDTIME' || isCompletedTask(task)) {
      const base = baseline.tasks.get(task.id);
      const rawStart = base?.earlyStart ?? task.time.earlyStart;
      const rawFinish = base?.earlyFinish ?? task.time.earlyFinish;
      if (!rawStart || !rawFinish) return [];
      const origStart = parseDate(rawStart);
      const origFinish = parseDate(rawFinish);
      if (isNaN(origStart.getTime()) || isNaN(origFinish.getTime())) return [];
      const shiftDays = diffCalendarDays(origStart, startDate);
      const shiftedFinish = addCalendarDays(origFinish, shiftDays);
      return enumerateWorkDays(taskEngine, formatDate(startDate), formatDate(shiftedFinish));
    }
    return enumerateTaskWorkDays(task.splitGaps, taskEngine, formatDate(startDate), task.time.scheduleDuration);
  };

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

  // Indeling: movable (mag schuiven) vs. gefixeerd (vastgepind) vs. ONVERPLAATSBAAR (voltooid ÓF in
  // uitvoering — `isImmovableTask`, eindpoortronde W0/W1) vs. geen vraag op selectie. Zo'n taak is
  // geen "vastgepind" (priority 1000, volgt nog wél voorgangers via PF) — ze is nog strenger: ze
  // staat ONVOORWAARDELIJK op haar actuals/restwerk, ongeacht priority, en gaat dus NOOIT door
  // `findSlot` OF het pinned-pad. Zie `fixedLoadIds` hieronder voor de boeking.
  const hasDemand = (id: string) => demandByTask.has(id);
  const movableIds: string[] = [];
  const pinnedIds: string[] = [];
  const fixedLoadIds: string[] = [];
  for (const t of tasks) {
    if (!hasDemand(t.id)) continue;             // geen vraag op geselecteerde renewables → niet verschuiven
    if (isImmovableTask(t)) { fixedLoadIds.push(t.id); continue; } // voltooid/in uitvoering — vóór de pin-check
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

  // Boek de dagvraag van een taak af vanaf een gegeven startdag — via `occurrenceFor` hierboven
  // (I5/I6, kwaliteitsronde taak 4: dezelfde dagenset als `findSlot`s capaciteitscheck gebruikt,
  // zodat conflictdetectie en boeking niet meer uit elkaar kunnen lopen).
  const bookDemandAt = (taskId: string, startDate: Date): string[] => {
    const task = taskById.get(taskId)!;
    const occ = occurrenceFor(task, startDate);
    const byRes = demandByTask.get(taskId)!;
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length && i < occ.length; i++) book(resId, occ[i], arr[i]);
    }
    return occ;
  };

  // Zoekhorizon: i.p.v. een vaste 5000-dagen-scan (A3b) een data-gedreven grens — een volledig
  // geserialiseerde plaatsing (elke taak achter elkaar) past binnen de som van alle taakduren + marge.
  //
  // L4 (slotronde taak 4): dit is sinds C1/C2 een ONDERGRENS-argument, geen exacte garantie. Twee
  // redenen waarom de kandidaat-scan méér STAPPEN kan nodig hebben dan `totalWork` (in werkdagen)
  // suggereert:
  //  - ELAPSEDTIME-kandidaten stappen per KALENDERdag (`nextCandidateAfterFor`), niet per werkdag —
  //    de horizon in KALENDERDAGEN is dus krapper dan in werkdagen (ruwweg 5/7 van `scanLimit`
  //    werkdagen-equivalent aan kalenderdagen-stappen, bij een ma-vr-kalender): elke week kost twee
  //    "verspilde" stappen (za/zo) die geen werkdag opleveren.
  //  - een gesplitste taak (`splitGaps`) beslaat MEER kalenderdagen dan haar `scheduleDuration` (die
  //    telt alleen werkdagen, de pauzedagen zitten er niet in) — `totalWork` telt dus de werk-INHOUD,
  //    niet de volle kalenderspanne die een serialisatie van gesplitste taken werkelijk in beslag zou
  //    nemen.
  // De `+10`/`Math.max(…, 30)`-marge ving dit tot dusver in de praktijk op (geen enkele bestaande case
  // of nieuwe testcase raakt de grens), maar is bewust geen wiskundig bewijs — een pathologisch
  // scenario (veel korte ELAPSEDTIME-taken, elk met een spanne die net in een weekend valt) kan de
  // grens in theorie nog raken. Vergroot de marge dan, i.p.v. de grens helemaal te laten vallen (de
  // A3b-motivatie — een vaste 5000-dagen-scan was traag op grote projecten — blijft gelden).
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
  // capaciteit — A4). Niet-actieve taken (geen vraag / mijlpaal / summary / VOLTOOID) gelden meteen
  // als geplaatst — `fixedLoadIds` zit hier bewust ook niet in `active`.
  const active = new Set<string>([...pinnedIds, ...movableIds]);
  const sortedActive = [...active].sort(cmp);

  const placed = new Set<string>();
  for (const t of tasks) if (!active.has(t.id)) placed.add(t.id);

  // ONVERPLAATSBAAR — voltooid ÓF in uitvoering (eindpoortronde W0/W1): vóór de eligibility-lus als
  // VASTE LAST geboekt — op hun EIGEN (ongeschoven) baseline-earlyStart, nooit een levelingDelay.
  // `placed` bevat ze al (hierboven, via de `!active.has`-lus); dit boekt alleen hun vraag zodat
  // movable/vastgepinde taken die er straks langs moeten het conflict ECHT zien. Reden waarom dit
  // NIET via het pinned-pad in de hoofdlus kan: `CPMSolver.forwardPass`'s VOLTOOID-tak (~regel 1420-
  // 1456 in CPMSolver.ts) én haar IN-UITVOERING-tak (~regel 1458-1844, W1) planten deze taken allebei
  // onvoorwaardelijk op respectievelijk `actualStart`/`actualFinish` of `actualStart` + restwerk, en
  // NEGEREN `levelingDelay` volledig — een delay toekennen zou een stille no-op zijn (het conflict
  // herleeft na de volgende `runCPM`, `unresolved` zou dan ten onrechte leeg blijven terwijl er wél
  // een botsing is; reviewer-probe M pinde dit specifiek voor de IN-UITVOERING-tak). Vandaar: geen
  // delay-poging, geen findSlot-scan, alleen de boeking — het conflict blijft zichtbaar via de
  // MOVABLE/PINNED taken die er straks omheen moeten (of, bij een botsing tussen twee onverplaatsbare
  // taken onderling, blijft gewoon bestaan — dat is dan een ECHTE, gerapporteerde overallocatie, geen
  // leveler-taak om op te lossen).
  for (const id of fixedLoadIds) {
    const startIso = baseEs(id);
    bookDemandAt(id, parseDate(startIso));
    placedStartIso.set(id, startIso);
  }

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
    const pickedTask = taskById.get(pick)!;

    let startDate: Date;
    let slotUnresolved: string[] = [];
    let slotReason: LevelingReason | undefined;
    if (pinnedSet.has(pick)) {
      // Vastgepind (§5.4/A4): volgt zijn (mogelijk verschoven) voorgangers via PF, maar schuift NIET
      // voor capaciteit — geen scan. Boeking op PF valt zo samen met de finale CPM-positie (waar de
      // pin zijn voorgangers volgt), i.p.v. op de stale oorspronkelijke earlyStart. Snapt op de
      // TAAKkalender-as (C1, kwaliteitsronde taak 4), niet de projectkalender — dezelfde as als de
      // delay-meting hieronder en `findSlot`s kandidaat-scan.
      startDate = nextCandidateFor(pickedTask, pf);
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
    // B1c-W0.3: gemeten in DEZELFDE eenheid als `CPMSolver.forwardPass`'s `shiftByLevelingDelay`
    // (CPMSolver.ts) straks bij de TOEPASSING van deze `levelingDelay` gebruikt — twee aparte takken,
    // niet één kalender-keuze:
    //  - WORKTIME: hele WERKdagen op de taak-eigen kalender (`eng.addWorkingDaysSigned`) — dus hier
    //    `workDaysBetween` op de TAAKkalender, niet de projectkalender (−1 corrigeert voor de
    //    INCLUSIEVE werkdagentelling: beide grenzen tellen mee, `addWorkingDaysSigned` stapt exclusief
    //    vanaf de startdag).
    //  - ELAPSEDTIME: kale KALENDERdagen, 24/7 (`addElapsedMinutes(date, task.levelingDelay*24*60)`)
    //    — geen kalenderbewuste telling, dus simpelweg het aantal kalenderdagen tussen pf en
    //    startDate (`diffCalendarDays`), ZONDER de −1: die correctie hoort bij de inclusieve
    //    werkdagentelling hierboven en is hier niet van toepassing (`addElapsedMinutes` verschuift
    //    een kale datum-instant, geen "aantal gepasseerde werkdagen").
    // Reviewronde taak 4: vóór deze splitsing mat de ELAPSEDTIME-tak hier ook in werkdagen — dat gaf
    // een andere afstand dan `shiftByLevelingDelay` bij toepassing daadwerkelijk verschuift (zie
    // `check-leveler-splits.ts`s ELAPSEDTIME-delay-geval, dat de twee metingen expliciet uit elkaar
    // trekt en via `solveProject` bewijst dat de toepassing weer op de geboekte dag landt).
    const delay = pickedTask.time.durationType === 'ELAPSEDTIME'
      ? diffCalendarDays(pf, startDate)
      : engineForTask(pickedTask).workDaysBetween(pf, startDate) - 1;
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
    if (isNaN(from.getTime()) || isNaN(to.getTime())) continue; // I4-precedent: geen crash op onparseerbare datums
    // M9 (kwaliteitsronde taak 4): gemeten op DEZELFDE as als de delay hierboven — taakkalender-
    // werkdagen (WORKTIME) of kale kalenderdagen (ELAPSEDTIME) — niet langer onvoorwaardelijk de
    // projectkalender. Anders toont de preview "0 werkdagen" naast twee zichtbaar verschillende data.
    const eng = engineForTask(t);
    const delta = t.time.durationType === 'ELAPSEDTIME'
      ? diffCalendarDays(from, to)
      : to >= from
        ? eng.workDaysBetween(from, to) - 1
        : -(eng.workDaysBetween(to, from) - 1);
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

  /** Scan vanaf PF dag-voor-dag naar de eerste kandidaat waarop elke benodigde resource genoeg
   *  restcapaciteit heeft voor de volle (split-/taakkalender-bewuste) dagvraag. `ls` != null
   *  (smoothing) begrenst het venster; geen slot binnen het venster → blijf op de gesnapte PF (mét
   *  conflict) en meld de conflictdagen + reden (§5.5 stap 4c/4d/4e, A3).
   *
   *  KWALITEITSRONDE TAAK 4 (C1/C2/I5/I6). Vóór deze ronde bleef de kandidaat-AS (waar mag een taak
   *  beginnen) op de projectkalender staan terwijl de delay-METING al naar de taakkalender was
   *  verhuisd (B1c-W0.3) — de oude "−1"-aftrek absorbeerde dat verschil toevallig stil zólang er
   *  capaciteitsdruk was, maar bij NUL druk (meteen een fit op de eerste projectkalender-kandidaat)
   *  gaf het een spookvertraging voor elke taak op een afwijkende kalender. Twee reparaties:
   *   - de kandidaat-AS (`cand`/`next`) loopt nu via `nextCandidateFor`/`nextCandidateAfterFor` —
   *     dezelfde taakkalender/ELAPSEDTIME-kalenderdagen-as als de delay-meting in de hoofdlus;
   *   - de dagenset per kandidaat (`occ`) komt nu uit `occurrenceFor`, GEDEELD met `bookDemandAt` —
   *     vóór deze deling kon de conflictdetectie een ANDERE dagenset zien dan wat uiteindelijk
   *     geboekt werd (voor split-/afwijkende-kalendertaken met name), dus `calendarOk`/`reasonFor`/
   *     de conflictdagenlijst konden dagen noemen waarop de taak niet eens werkt. */
  function findSlot(
    taskId: string,
    pf: Date,
    ls: Date | null,
  ): { start: Date; unresolved: string[]; reason?: LevelingReason } {
    const task = taskById.get(taskId)!;
    const byRes = demandByTask.get(taskId)!;

    let cand = nextCandidateFor(task, pf);
    let calendarFeasibleSeen = false; // is er überhaupt een venster waar élke vraagdag óók een resource-werkdag is?
    let guard = 0;
    while (guard++ < scanLimit) {
      const occ = occurrenceFor(task, cand);
      if (!calendarFeasibleSeen && calendarOk(byRes, occ)) calendarFeasibleSeen = true;
      // L1 (slotronde taak 4): een LEEG kandidaatvenster (`occ.length === 0`) telt NIET als passend.
      // `fits` is triviaal waar op een lege dagenset (de binnenlus over `occ` loopt gewoon nul keer),
      // en sinds ELAPSEDTIME-kandidaten per KALENDERdag stappen (C1/C2) kan een korte elapsed-spanne
      // volledig in een weekend vallen — dan levert `occurrenceFor` `[]` (geen enkele projectkalender-
      // werkdag in die spanne). Zonder deze guard "past" de taak daar, wordt ze daar geplaatst, en
      // verdwijnt haar vraag stilzwijgend uit het boekhoudgrootboek (niets wordt geboekt, want
      // `bookDemandAt` boekt ook via `occurrenceFor` en loopt dus over dezelfde lege set) — reviewer-
      // probe L: D bezet vrijdag, E (elapsed, duur 1) krijgt delay 1 maar haar vraag ontbreekt volledig
      // in het grootboek. BEWUST NIET `calendarOk` als extra voorwaarde: die is STRENGER dan nodig — hij
      // eist dat ELKE vraagdag een resource-werkdag heeft, wat geval 4's bewuste min-klem (een
      // vraag-array die langer is dan `occ`, `i < arr.length && i < occ.length`) ten onrechte zou laten
      // afketsen. `occ.length > 0` is de minimale, correcte voorwaarde: er moet gewoon IETS te boeken zijn.
      if (occ.length > 0 && fits(byRes, occ)) return { start: cand, unresolved: [] };
      const next = nextCandidateAfterFor(task, cand);
      if (ls && next > ls) break; // volgende kandidaat valt buiten de float — geen slot
      cand = next;
    }

    // Geen slot: blijf op de gesnapte PF, verzamel de conflictdagen (waar de vraag de restcapaciteit
    // overschrijdt) — dezelfde dagenset (`occurrenceFor`) als de boeking straks zou gebruiken.
    const snappedPf = nextCandidateFor(task, pf);
    const occ = occurrenceFor(task, snappedPf);
    const conflicts: string[] = [];
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        if (bookedOn(resId, occ[i]) + arr[i] > capacityOf(resId, occ[i]) + EPS) conflicts.push(occ[i]);
      }
    }
    return {
      start: snappedPf,
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
