// Resource-nivelleerder. Serieel SGS-algoritme (Serial
// Schedule Generation Scheme) met één `constrainToFloat`-toggle die tegelijk leveling
// (einddatum mag schuiven) én smoothing (alleen binnen de totale float) dekt — precies zoals
// P6/MSP dit met één engine + boolean doen.
//
// KERNPRINCIPES:
//  - `levelingDelay` is t.o.v. de PRECEDENCE-FEASIBLE start (PF) van een taak — d.w.z. de ES die
//    de forward pass berekent nadat óók de voorgangers hun levelingDelay hebben gekregen — NIET
//    t.o.v. de oorspronkelijke CPM-ES. Anders zouden voorgangersverschuivingen dubbel tellen.
//  - Het capaciteitsgrootboek begint LEEG; taken worden gevuld in eligibility-volgorde. Ook
//    vastgepinde taken (priority 1000) lopen door de lus: ze schuiven NIET voor capaciteit, maar
//    volgen wél hun (mogelijk verschoven) voorgangers — MSP "Do Not Level"-semantiek.
//  - De eligibility-lus kiest telkens de hoogst gesorteerde taak waarvan álle voorgangers
//    al een definitieve positie hebben; niet-verschuifbare taken (geen vraag / mijlpaal / summary /
//    ONVERPLAATSBAAR — VOLTOOID (`completion >= 1 && actualFinish`) ÓF IN UITVOERING (`(actualStart
//    || completion > 0) && completion < 1`), `isImmovableTask`) gelden meteen
//    als geplaatst. Zo'n taak boekt haar vraag WEL als vaste last (op haar eigen actuals-/restwerk-
//    gedreven positie, vóór de eligibility-lus, zie `fixedLoadIds`), maar krijgt NOOIT een
//    `levelingDelay` — `CPMSolver.forwardPass`'s VOLTOOID- én IN-UITVOERING-tak plannen zo'n taak
//    allebei onvoorwaardelijk op haar actuals/restwerk en negeren `levelingDelay` volledig, dus een
//    delay zou een stille no-op zijn.
//  - PF wordt afgeleid door de bestaande `CPMSolver` te herdraaien op een werkkopie waarin de
//    al-geplaatste taken hun `levelingDelay` hebben en de gekozen taak (nog) niet — dan is de ES
//    van de gekozen taak per constructie zijn PF, mét volledige relatie-/lag-/constraint-logica.
//  - Plaatsingsbewust (spec §3.11): voor ELKE kandidaat bepaalt de gedeelde plaatsing
//    (`taskLoadPlacement` + `assignmentLoadOnPlacement`, dezelfde als het histogram) de dagen én de
//    vraag per dag; de boeking gebruikt exact die uitkomst. Een taak die midden op een dag begint,
//    vraagt dus een deel van die dag. Nooit `MATERIAL` nivelleren.
//  - De vertraging is minuutexact: `delayMinutes` = de werkminuten van de overgeslagen werktijd op
//    de taakkalender, zodat kandidaat, opgeslagen vertraging en toepassing in de solver hetzelfde
//    moment zijn. `delays` (hele werkdagen) blijft ernaast tot F6.
//
// VERSE INTERNE CPM-SOLVE: `levelResources` leest de sorteersleutels
// (totalFloat/earlyStart), de PF-basis, de vastgepinde-boekingspositie én de smoothing-vensters
// NIET uit de meegegeven `cpmResult` (die kan na een taakwijziging zonder F5 verouderd zijn), maar
// uit een VERSE `CPMSolver.solve()` op werkkopieën ZONDER levelingDelays. `applyLeveling` reset de
// delays toch vóór herplaatsing, dus die no-delay-baseline is precies het schema waartegen genivelleerd
// wordt.
//
// PREVIEW UIT ÉÉN PROEF-SOLVE: `projectEndAfter` én de verzameling verschoven taken
// (`shifts`) komen uit één echte proef-`CPMSolver.solve()` op de werkkopieën met ALLE nieuwe delays
// gezet — exact de route die `applyLeveling`→`runCPM` straks echt neemt. Zo bevat de preview óók
// niet-geresourcete FS-opvolgers die pas via de forward pass meeschuiven.
import type { Task, TaskSplitGap } from '@/types/task';
import { exceedsCapacity } from '@/engine/scheduler/capacityTolerance';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { LevelingQueue } from './levelingQueue';
import { resolveCalendar } from './resolveCalendar';
import { CPMSolver, type CPMResult, type CPMOptions } from './CPMSolver';
import {
  assignmentLoadOnPlacement, contourLookup, dayslotLoad, maxUnitsOn, taskLoadPlacement,
} from './ResourceLoad';
import { placementFollowsSpan, type PlacementResult } from './workPlacement';
import { createTaskEngineCache } from './taskEngineCache';
import { isPinnedComplete, isPinnedInProgress } from './duration';
import { workdayDateOfInstant } from '@/engine/calendar/workdayRules';
import { parseDate, parseInstant, formatDate, formatInstant, addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { maxOf } from '@/utils/collections';

/**
 * Het GEDEELDE poolitem-grootboek ("twee grootboeken"). De motor toetst per `resourceId`
 * tegen de eigen projectinzet; dit grootboek voegt de tweede toets toe: de restcapaciteit van het
 * BIBLIOTHEEK-poolitem waaraan de resource via zijn `libraryOrigin`-stempel hangt.
 *
 * "Beide toetsen moeten slagen" ≡ `min(projectinzet, poolrest)`.
 *
 * De implementatie hiervan woont bij de aanroeper (de verdeler, `services/library/distribute.ts`) en
 * is bewust NIET van de motor: hij is gedeeld over meerdere documenten, en de motor draait per
 * document. Injecteerbaar dus, zelfde patroon als `OccupancyEphemeralSolve` in `occupancy.ts`.
 */
export interface LevelingPoolLedger {
  /** Het poolitem waaraan `resourceId` hangt, of `null` wanneer deze resource geen
   *  bibliotheekstempel heeft — dan geldt alleen de gewone per-resource-toets. */
  poolItemOf(resourceId: string): string | null;
  /** Restcapaciteit van dat poolitem op die dag. ALTIJD ≥ 0 (de implementatie klemt). */
  residualOn(poolItemId: string, iso: string): number;
  /** Boek geplaatste vraag terug. UITSLUITEND aangeroepen voor een taak die daadwerkelijk een
   *  passend venster kreeg — een niet-plaatsbare taak boekt NIET (anders wordt het restprofiel
   *  negatief en cascadeert het tekort naar elk volgend document). */
  book(poolItemId: string, iso: string, units: number): void;
  /** Laatste dag waarvoor het restprofiel betekenisvol is; `null` ⇒ geen extra horizon-eis. Zie de
   *  scanhorizon hieronder: zodra er vaste last van buiten dit document in het grootboek zit, kan
   *  het eerste vrije venster voorbij `totalWork + marge` liggen. */
  horizonIso: string | null;
}

export interface LevelingOptions {
  /** true = smoothing: alleen binnen de totale float schuiven, einddatum heilig, onoplosbare
   *  conflicten blijven gemarkeerd staan. false = leveling: mag de einddatum verschuiven. */
  constrainToFloat: boolean;
  /** default: alle renewable resources (LABOR/EQUIPMENT/CREW/SUBCONTRACTOR). Materiaal wordt er
   *  altijd uit gefilterd, ook als het expliciet meegegeven wordt. */
  resourceIds?: string[];
  /** Alleen deze taken mogen (opnieuw) genivelleerd worden. Taken BUITEN de scope behouden hun
   *  bestaande `levelingDelay`/`splitGaps` en tellen mee als VASTE LAST op hun huidige, genivelleerde
   *  positie — ze worden nooit verschoven en verschijnen nooit in `delays`. Afwezig ⇒ alle taken.
   *
   *  Waarom: de verdeler nivelleert per POOLITEM. De taken die niets met dat poolitem te maken
   *  hebben moeten blijven staan waar ze staan — anders lost een bibliotheekconflict zich op door
   *  het hele document te herschikken. */
  scopeTaskIds?: string[];
  /** Maximale uitloop van de projecteinddatum, in werkdagen t.o.v. de HUIDIGE (mét bestaande
   *  nivellering berekende) planning. De motor vertaalt dit naar
   *  een per-taak-venster `lateStart + N` op de TAAKkalender (ELAPSEDTIME: kalenderdagen, zelfde as
   *  als `shiftByLevelingDelay`). `0` ⇒ identiek aan `constrainToFloat: true`: de einddatum staat
   *  vast maar de float mag benut worden. Afwezig ⇒ onbegrensd (bestaand leveling-gedrag).
   *  Staat `constrainToFloat` óók aan, dan wint het STRENGSTE venster. */
  overrunCeilingDays?: number;
  /** Het gedeelde poolitem-grootboek — zie `LevelingPoolLedger` hierboven. Afwezig ⇒ alleen de
   *  per-resource-toets. */
  poolLedger?: LevelingPoolLedger;
  /** "Onderbrekingen toestaan" (MS Project: *Leveling can create splits in remaining work*).
   *  `false`/afwezig ⇒ een taak wijkt alleen als GEHEEL
   *  (uitloop). `true` ⇒ de nivelleerder mag pauzedagen invoegen wanneer er geen aaneengesloten
   *  venster past — MAAR uitsluitend als FALLBACK, ná een mislukte aaneengesloten scan (zie
   *  `findSlot`); zonder een bindend venster (`overrunCeilingDays`/`constrainToFloat`) vindt die scan
   *  op den duur altijd een aaneengesloten gat, dus deze optie is in de praktijk gekoppeld aan een
   *  plafond.
   *
   *  GRENS (bewust): taken met
   *  `durationType === 'WORKTIME'` en `completion === 0` komen ervoor in aanmerking, ONGEACHT
   *  `durationUnit` — dag- én uur-modus. Een ingevoegde pauze is en blijft ALTIJD een hele werkdag,
   *  ook op een uur-modus-taak (de gaten-machinerie zelf blijft dag-granulair); alleen de SPANNE rekt,
   *  nooit de vraag. ELAPSEDTIME blijft uitgesloten (geen werkdagbegrip), en MSP's eigen formulering
   *  is "splits in REMAINING work" — een gestarte taak wijkt uitsluitend via uitloop. */
  allowSplits?: boolean;
}

/** Reden waarom een taak onopgelost bleef — de nivelleer-dialoog kiest hierop de bijpassende
 *  uitleg. Een onbereikbaar/te krap plafond en een uitgeputte scanhorizon zijn geen "onvoldoende
 *  capaciteit". */
export type LevelingReason =
  | 'CALENDAR_MISMATCH' | 'INSUFFICIENT_CAPACITY' | 'INTRINSIC_OVERRUN'
  /** Het uitloop-plafond laat te weinig ruimte: binnen `lateStart + plafond` is geen venster vrij. */
  | 'CEILING_TOO_TIGHT'
  /** Uitloop geven helpt hier niet: een deadline/backward-constraint duwt het venster vóór de
   *  precedence-feasible start — de taak kan zelfs zónder capaciteitsdruk niet binnen het plafond. */
  | 'CEILING_UNREACHABLE'
  /** De kandidaat-scan liep leeg vóórdat er een passend venster gevonden was. `scanLimit` is een
   *  ONDERGRENS-argument (zie het blok bij `scanLimit`), dus dit is een reële
   *  uitkomst en geen "onvoldoende capaciteit" — de motor weet simpelweg niet of er verderop nog
   *  ruimte is. */
  | 'NO_WINDOW_IN_HORIZON'
  /** De eigen projectinzet had ruimte, maar de RESTcapaciteit van het bibliotheek-poolitem is op —
   *  andere documenten bezetten de pool. */
  | 'RESIDUAL_FULL';

/** Eén verschuiving voor de preview-tabel: elke taak wiens start wijzigt t.o.v. het huidige
 *  schema — óók niet-geresourcete opvolgers die enkel via de forward pass meeschuiven. */
export interface LevelingShift {
  oldStart: string;
  newStart: string;
  /** getekend aantal werkdagen (positief = later, negatief = eerder). */
  delta: number;
}

export interface LevelingIntrinsicOverrun {
  resourceId: string;
  peak: number;
  capacity: number;
}

export interface LevelingResult {
  /** taskId → toegepaste levelingDelay (werkdagen), alleen taken die daadwerkelijk een eigen delay
   *  krijgen. Vastgepinde/niet-geresourcete opvolgers staan hier NIET in (die schuiven via de CPM-
   *  propagatie, niet via een eigen delay) — `applyLeveling` schrijft precies dit veld. */
  delays: Record<string, number>;
  /** taskId → dezelfde vertraging in minuten (spec §3.11): de werkminuten van de overgeslagen
   *  werktijd op de TAAKkalender, bij kalendertijd klokminuten. Precies de taken uit `delays`.
   *  `writeLevelingResult` schrijft dit als `Task.levelingDelayMinutes`; de solver past die minuten
   *  toe (`shiftByLevelingDelay`), zodat de toegepaste start het getoetste kandidaatmoment is.
   *  Optioneel in het type: een oudere aanroeper die alleen `delays`/`gaps` doorgeeft, blijft
   *  compileren (en valt terug op hele werkdagen). */
  delayMinutes?: Record<string, number>;
  /** taskId → resterende, onoplosbare conflictdagen. */
  unresolved: Record<string, string[]>;
  /** taskId → reden van het onopgeloste conflict (parallel aan `unresolved`). */
  unresolvedReasons: Record<string, LevelingReason>;
  /** Details uit dezelfde dagvraag/capaciteitscheck als INTRINSIC_OVERRUN; geen UI-herberekening. */
  intrinsicOverruns?: Record<string, LevelingIntrinsicOverrun>;
  /** taskId → start-verschuiving voor de preview-tabel (elke taak wiens start wijzigt). */
  shifts: Record<string, LevelingShift>;
  projectEndBefore: string;
  projectEndAfter: string;
  /** TaskId → de door de nivelleerder INGEVOEGDE werkonderbrekingen, inclusief de
   *  importsplits die de taak al droeg (de volledige, te schrijven `splitGaps`-waarde — niet alleen
   *  het verschil). Alleen aanwezig voor taken die daadwerkelijk een leveling-gat kregen. Zonder
   *  `allowSplits` blijft dit altijd `{}`. */
  gaps: Record<string, TaskSplitGap[]>;
}

// Harde bovengrens voor de kandidaat-scan wanneer er een poolitem-grootboek MET
// horizon is meegegeven (`ledger.horizonIso`) — die kan de scan voorbij de gewone, taak-eigen
// `scanLimit` duwen. Zelfde orde als `CalendarEngine`s eigen `MAX_DAYS`-veiligheidsgrens.
const HARD_SCAN_CAP = 200_000;

/**
 * Alleen voor tests (`check-leveler-differential.ts`): `incremental: false` schakelt terug naar de
 * oude route (volledige solve per plaatsing + lineaire keuze), zodat de toets beide uitkomsten naast
 * elkaar kan leggen. Productiecode zet dit nooit om.
 */
export const LEVELER_TEST_HOOKS = { incremental: true };

/** De volledige argumentenlijst van `levelResources`, als plain data — dezelfde invoer voor de
 *  synchrone route en de Web Worker van de nivelleer-dialoog (`services/leveling/`). */
export type LevelingInput = Parameters<typeof levelResources>;

export function levelResources(
  tasks: Task[],
  sequences: Sequence[],
  resources: Resource[],
  assignments: ResourceAssignment[],
  projectCalendar: WorkCalendar,
  resourceCalendars: WorkCalendar[],
  cpmResult: CPMResult,
  options: LevelingOptions,
  // De interne CPM-herberekeningen hieronder (baseline/PF/proef) krijgen dezelfde opties als de
  // getoonde planning, inclusief `dataDate`/`progressMode`. Zonder die twee rekent de nivelleerder op
  // een actual-onbewuste realiteit en mist de plaatsingslus conflicten die `computeResourceLoad` (op
  // de echte datums) wél ziet ("0 taken verschoven, 0 onopgelost" bij blijvende overallocatie).
  // Verplicht via `solveOptionsFor(project)`, want `CPMOptions.schedulingOptions` eist de opgeloste
  // conventies.
  cpmOptions: CPMOptions,
): LevelingResult {
  // Defensief dezelfde semantische bladgrens als scheduleSlice: directe aanroepers mogen een lege,
  // expliciete WBS-samenvatting nooit als nivelleer-/interne CPM-taak laten binnenglippen.
  tasks = tasks.filter(isLeafTask);

  // Geselecteerde renewables: default alle non-material, anders de opgegeven ids ∩ non-material.
  const renewable = resources.filter(r => r.type !== 'MATERIAL');
  const selectedResources = options.resourceIds
    ? renewable.filter(r => options.resourceIds!.includes(r.id))
    : renewable;
  const selectedIds = new Set(selectedResources.map(r => r.id));

  // Per geselecteerde resource: eigen kalender-engine (voedt capaciteit) en resource-object.
  const resById = new Map(resources.map(r => [r.id, r]));
  const engineByRes = new Map<string, CalendarEngine>();
  for (const r of selectedResources) {
    engineByRes.set(r.id, new CalendarEngine(calendarForEngine(
      resolveCalendar(r.calendarId, resourceCalendars, projectCalendar),
    )));
  }

  // Kalender-engine voor de TAAKkalender — dezelfde `createTaskEngineCache` als de
  // resourcebelasting, gedeeld door de boeking (`bookDemandAt`) én de delay-meting hieronder, zodat
  // die niet op verschillende kalenders rekenen.
  const { forTask: engineForTask } = createTaskEngineCache(resourceCalendars, projectCalendar);

  // Kandidaat-as: WAAR een taak mag STARTEN volgt dezelfde as als waarmee de delay verderop gemeten
  // wordt (de taakkalender; zonder eigen `calendarId` is dat de projectengine). Een kandidaat-scan op
  // de projectkalender naast een meting op de taakkalender geeft bij NUL capaciteitsdruk een
  // spookvertraging (de kalenderafstand tussen beide snaps). ELAPSEDTIME kent geen werkdagbegrip —
  // daar is ELKE kalenderdag een geldige kandidaat, spiegelt `CPMSolver.shiftByLevelingDelay`s
  // `addElapsedMinutes`-tak.
  //
  // MOMENTEN (spec §3.11): de eerste kandidaat is de PF zelf, genormaliseerd naar een werkmoment
  // (`nextWorkInstant`: een blokeinde ma 16:00 wordt di 08:00 — dat is geen capaciteitsvertraging).
  // Kandidaat k slaat k hele werkdagen over (`candidateAxis`). Nivelleren op uurniveau is niet nodig.
  // Een kalender zonder werkblokken (dagmodus) houdt de dagstappen.
  const nextCandidateFor = (task: Task, d: Date): Date => {
    if (task.time.durationType === 'ELAPSEDTIME') return d;
    const eng = engineForTask(task);
    return eng.isHourMode ? eng.nextWorkInstant(d) : eng.nextWorkDay(parseDate(formatDate(d)));
  };
  /**
   * De kandidaat-as vanaf PF: kandidaat k slaat k werkdagen over (spec §3.11: "de nivelleerder schrijft
   * een vertraging als de werkminuten van de overgeslagen werkdagen op de taakkalender").
   *  - Werktijd met werkblokken: de overgeslagen dagen zijn de werkdag van de eerste kandidaat en de
   *    werkdagen erna, elk met zijn eigen werkminuten (een korte vrijdag telt 360). `minutes(k)` is hun
   *    som; kandidaat k is de eerste kandidaat plus die werkminuten (`addWorkingMinutesSigned`), met N2:
   *    een blokeinde wordt het volgende blokbegin. Dat is precies wat de solver met de opgeslagen
   *    vertraging doet (`shiftByLevelingDelay` + `snapSuccessorEarlyStart`), dus kandidaat = opgeslagen
   *    vertraging = toepassing (acceptatie-eis 1 van F3b). Voorbeeld korte vrijdag: wo 14:00 → do 14:00
   *    (480) → ma 08:00 (960: do 14:00 + 480 = do 15:00, vr 6 u, ma 1 u).
   *  - Kalendertijd: per kalenderdag; `minutes(k)` = k × 1440.
   *  - Dagmodus: per werkdag (`nextWorkDayAfter`), zonder minuten.
   */
  const candidateAxis = (task: Task, pf: Date): { at: (k: number) => Date; minutes: (k: number) => number } => {
    const eng = engineForTask(task);
    const elapsed = task.time.durationType === 'ELAPSEDTIME';
    const first = nextCandidateFor(task, pf);
    const starts: Date[] = [first];
    const sums: number[] = [0];
    let skip = !elapsed && eng.isHourMode ? workdayDateOfInstant(eng, first, 'start') : null;
    const fill = (k: number): void => {
      while (starts.length <= k) {
        const prev = starts[starts.length - 1];
        if (elapsed) {
          starts.push(addCalendarDays(prev, 1));
          sums.push(sums[sums.length - 1] + 1440);
        } else if (skip === null) {
          starts.push(eng.nextWorkDayAfter(prev));
          sums.push(Number.NaN);
        } else {
          const sum = sums[sums.length - 1] + eng.effectiveBandsOn(skip).reduce((acc, b) => acc + b.end - b.start, 0);
          skip = eng.nextWorkDayAfter(skip);
          sums.push(sum);
          starts.push(eng.nextWorkInstant(eng.addWorkingMinutesSigned(first, sum)));
        }
      }
    };
    return {
      at: k => { fill(k); return starts[k]; },
      minutes: k => { fill(k); return sums[k]; },
    };
  };

  const capacityOf = (resId: string, iso: string): number => {
    const r = resById.get(resId);
    const eng = engineByRes.get(resId);
    if (!r || !eng) return 0;
    return eng.isWorkDay(parseDate(iso)) ? maxUnitsOn(r, iso) : 0;
  };
  /** Werkt de resource op die dag volgens ZIJN kalender? Puur de kalender-uitlijning, ONGEACHT hoeveel
   *  eenheden hij die dag te bieden heeft (met een restprofiel is 0 de normale waarde van een volle dag, en ook zonder restprofiel is `maxUnits: 0` een capaciteits- en
   *  geen kalenderprobleem). `capacityOf` hierboven blijft de gecombineerde waarde — die is voor
   *  `fits` precies goed. */
  const isResWorkDay = (resId: string, iso: string): boolean => {
    const eng = engineByRes.get(resId);
    return !!eng && eng.isWorkDay(parseDate(iso));
  };
  // Maximaal beschikbare eenheden op een wérkdag van de resource (vlakke maxUnits of de hoogste
  // availabilityStep) — basis voor de intrinsieke-overvraag-detectie.
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

  // Scope ("scope-behoudend toepassen"). `null` = alles in scope. Een taak BUITEN de scope wordt behandeld als vaste last op haar HUIDIGE
  // (mogelijk al genivelleerde) positie — zie de selectieve strip hieronder en de indelingslus.
  const scope = options.scopeTaskIds ? new Set(options.scopeTaskIds) : null;
  const inScope = (id: string): boolean => scope === null || scope.has(id);

  // Het gedeelde poolitem-grootboek (of `undefined` — dan is dit hele blok een no-op). Gelezen door `fits`, `bookDemandAt`
  // en `findSlot` (inclusief zijn conflictverzamelaar), allemaal verderop in deze functie.
  const ledger = options.poolLedger;

  // Werkkopie ZONDER levelingDelays — voor taken IN scope. Voedt (a) de VERSE baseline-solve
  // (sorteersleutels/PF/vensters) en (b) — nadat de lus de delays erop gezet heeft — de
  // proef-solve voor de preview.
  // Ook de sub-dag-precisie (`levelingDelayMinutes`/`levelingDelayElapsed`)
  // strippen — `CPMSolver.shiftByLevelingDelay` leest die VÓÓR `levelingDelay`, dus een
  // `.mpp`-geïmporteerde vertraging op een taak MET voorganger zou hier stil in de baseline blijven
  // staan en zowel de sorteersleutels als de PF vervalsen (zie `check-leveling-delay-units.ts`,
  // deel 2, voor het concrete voorbeeld: het conflict verdween volledig uit beeld).
  // Een taak BUITEN de scope behoudt haar bestaande delay/sub-dag-precisie — die is vaste last,
  // geen te herberekenen sorteersleutel. `computePF` moet daarom kloppen: een opvolger van een out-of-scope taak moet haar VERSCHOVEN
  // (behouden-delay) positie volgen, niet haar ongenivelleerde positie.
  // Idempotentie: `splitGaps` hoort symmetrisch bij deze strip — een
  // gat met `source === 'leveling'` is UITVOER van een eerdere nivellering, precies zoals
  // `levelingDelay` dat is. Stond het hier in de baseline, dan las een tweede nivellering het als
  // brondata en legde er nieuwe gaten bovenop — accumulatie in plaats van het idempotente
  // herschrijven. IMPORTSPLITS (gaten zónder `source`) zijn wél
  // brondata en blijven staan; `stripLevelingGaps` is dezelfde regel als `clearLevelingGaps` in
  // `taskDefaults.ts`, maar puur — de motor muteert de invoer nooit.
  const stripLevelingGaps = (gaps: TaskSplitGap[] | undefined): TaskSplitGap[] | undefined => {
    if (!gaps || gaps.length === 0) return gaps;
    const kept = gaps.filter(g => g.source !== 'leveling');
    return kept.length > 0 ? kept : undefined;
  };
  const workTasks: Task[] = tasks.map(t => inScope(t.id)
    ? {
        ...t,
        levelingDelay: undefined,
        levelingDelayMinutes: undefined,
        levelingDelayElapsed: undefined,
        splitGaps: stripLevelingGaps(t.splitGaps),
        time: { ...t.time },
      }
    : { ...t, time: { ...t.time } });
  const workById = new Map(workTasks.map(t => [t.id, t]));

  // VERSE baseline — de enige bron voor sorteersleutels (totalFloat/earlyStart), PF-basis en
  // smoothing-vensters (lateStart). Nooit de (mogelijk stale) meegegeven cpmResult. `cpmOptions`
  // (dataDate/progressMode) mee, anders wijkt deze baseline af van de echte (actual-gepinde)
  // planning zodra het project voortgang+statusdatum heeft (zie parameter-toelichting hierboven).
  const baseline = new CPMSolver(workTasks, sequences, projectCalendar, resourceCalendars, cpmOptions).solve();
  if (baseline.error) {
    const end = cpmResult.projectEnd;
    return {
      delays: {}, delayMinutes: {}, unresolved: {}, unresolvedReasons: {}, shifts: {},
      projectEndBefore: end, projectEndAfter: end, gaps: {},
    };
  }
  const baseEs = (id: string): string =>
    baseline.tasks.get(id)?.earlyStart ?? taskById.get(id)!.time.earlyStart;
  const baseLs = (id: string): string =>
    baseline.tasks.get(id)?.lateStart ?? taskById.get(id)!.time.lateStart;
  const baseLf = (id: string): string =>
    baseline.tasks.get(id)?.lateFinish ?? taskById.get(id)!.time.lateFinish;
  const baseFloat = (id: string): number =>
    baseline.tasks.get(id)?.totalFloat ?? taskById.get(id)!.time.totalFloat;

  // Het uitloop-plafond als per-taak-venster, op de VERSE baseline-lateStart (dus mét de behouden
  // out-of-scope-delays — referentiepunt: de huidige projecteinddatum, mét bestaande nivellering). `0` ⇒
  // identiek aan `constrainToFloat: true`. Staan beide aan, dan wint het STRENGSTE venster.
  const windowLimit = (id: string): Date | null => {
    const ls = parseInstant(baseLs(id));
    const ceilingDays = options.overrunCeilingDays;
    if (ceilingDays === undefined) return options.constrainToFloat ? ls : null;
    const t = taskById.get(id)!;
    const ceiling = t.time.durationType === 'ELAPSEDTIME'
      ? addCalendarDays(ls, ceilingDays)
      : engineForTask(t).addWorkingDaysSigned(ls, ceilingDays);
    // Beide aan ⇒ het strengste venster wint.
    return options.constrainToFloat && ls < ceiling ? ls : ceiling;
  };

  // Bovengrens voor de LAATSTE werkdag in de onderbreek-modus — spiegelt
  // `windowLimit` hierboven, maar op de baseline-LATEFINISH i.p.v. -LATESTART. Met onderbrekingen
  // schuift de START van een taak misschien nauwelijks (de eerste losse vrije dag kan vlak bij haar
  // PF liggen), maar het EINDE schuift wél mee met elk ingevoegd gat — en het plafond gaat over de
  // EINDdatum, dus dát is wat hier gebonden moet worden, niet de start.
  const finishWindowLimit = (id: string): Date | null => {
    const lf = parseInstant(baseLf(id));
    const ceilingDays = options.overrunCeilingDays;
    if (ceilingDays === undefined) return options.constrainToFloat ? lf : null;
    const t = taskById.get(id)!;
    const ceiling = t.time.durationType === 'ELAPSEDTIME'
      ? addCalendarDays(lf, ceilingDays)
      : engineForTask(t).addWorkingDaysSigned(lf, ceilingDays);
    return options.constrainToFloat && lf < ceiling ? lf : ceiling;
  };

  // ONVERPLAATSBAAR: VOLTOOID (`isPinnedComplete`) — `CPMSolver.forwardPass`'s VOLTOOID-tak plant
  // onvoorwaardelijk op actualStart/actualFinish — of IN UITVOERING (`isPinnedInProgress`, de TWEEDE
  // voortgangs-conditie van de forward pass, die op actualStart/restwerk plant en `levelingDelay`
  // nooit raadpleegt). Een delay zou op beide een stille no-op zijn en het conflict stil laten
  // herleven; ze boeken WEL als vaste last (zie `fixedLoadIds`).
  const isCompletedTask = (task: Task): boolean => isPinnedComplete(task.time);
  const isInProgressTask = (task: Task): boolean => isPinnedInProgress(task.time);
  const isImmovableTask = (task: Task): boolean => isCompletedTask(task) || isInProgressTask(task);

  // ── Vraag per kandidaat (spec §3.11, review ronde 2 punt 6) ────────────────────────────────────
  // Voor elke kandidaatstart bepaalt de GEDEELDE plaatsing (`taskLoadPlacement`, dezelfde als het
  // histogram) de werkdagen met hun deel, en `assignmentLoadOnPlacement` de vraag per dag per
  // toewijzing. `findSlot` toetst die uitkomst en `bookDemandAt` boekt exact dezelfde. Een vaste
  // vraag die alleen met de dagenlijst meeschuift is fout zodra de verdeling van de plaats afhangt
  // (vr 07:00 met een korte vrijdag: vr 0,75 + ma 0,25; ma 07:00: ma 1).
  //
  // De spanne (kalendertijd, voltooid, lopend, handmatig, hamer — `placementFollowsSpan`) komt uit de
  // VERSE baseline (`baseline.tasks.get`, dezelfde bron als `baseEs`/`baseLs`), niet uit de
  // mogelijk-STALE `task.time` (zie de `cpmOptions`-toelichting hierboven). Een kandidaat schuift
  // die spanne als geheel. Een niet-gestarte taak telt haar ACTUELE duur vanaf de kandidaat.
  //
  // `task` komt uit `workById` (de GESTRIPTE werkkopie): een leveling-gat uit een VORIGE
  // nivellering is uitvoer, geen brondata. Cache per taak en startmoment (milliseconde): zuiver
  // binnen één aanroep, BEHALVE dat de onderbreek-modus een taak nieuwe `splitGaps` geeft — die wist
  // daarna haar cache-entries (zie de aanroepplek).
  const placementOptions = cpmOptions.schedulingOptions;
  const selectedAssignmentsByTask = new Map<string, ResourceAssignment[]>();
  for (const a of assignments) {
    if (!selectedIds.has(a.resourceId)) continue;
    const list = selectedAssignmentsByTask.get(a.taskId);
    if (list) list.push(a); else selectedAssignmentsByTask.set(a.taskId, [a]);
  }
  // De contour wordt gekoppeld met ALLE toewijzingen van de taak, ook die op niet-geselecteerde
  // resources: de resourcefilter mag de betekenis van een (legacy-)contour niet veranderen (review
  // F3b r1 P2 en r2 P3).
  const contourOf = contourLookup(assignments);
  const spanView = (task: Task): Task => {
    if (!placementFollowsSpan(task)) return task;
    const base = baseline.tasks.get(task.id);
    if (!base) return task;
    return { ...task, time: { ...task.time, earlyStart: base.earlyStart, earlyFinish: base.earlyFinish } };
  };
  interface CandidateDemand {
    /** Werkdagen (ISO) van de plaatsing, oplopend; `byRes`-arrays zijn erop uitgelijnd. */
    days: string[];
    byRes: Map<string, number[]>;
    /** De plaatsing zelf (null in dagmodus): haar einde begrenst de onderbreek-modus. */
    placed: PlacementResult | null;
  }
  const computeDemand = (task: Task, startDate: Date): CandidateDemand => {
    const engine = engineForTask(task);
    const view = spanView(task);
    const byRes = new Map<string, number[]>();
    const list = selectedAssignmentsByTask.get(task.id) ?? [];
    const placed = taskLoadPlacement(view, engine, placementOptions, startDate);
    if (placed) {
      const days = placed.days.map(d => d.iso);
      for (const a of list) {
        const units = assignmentLoadOnPlacement(view, a, placed.days, engine, contourOf(view, a));
        const prev = byRes.get(a.resourceId);
        byRes.set(a.resourceId, prev ? units.map((u, i) => u + (prev[i] ?? 0)) : units);
      }
      return { days, byRes, placed };
    }
    // Dagmodus (kalender zonder werkblokken): het dagslotcontract, met de kandidaat als startdag.
    const shift = diffCalendarDays(parseDate(view.time.earlyStart), parseDate(formatDate(startDate)));
    const shifted: Task = { ...view, time: {
      ...view.time, earlyStart: formatDate(startDate),
      earlyFinish: formatDate(addCalendarDays(parseDate(view.time.earlyFinish), shift)),
    } };
    let days: string[] = [];
    for (const a of list) {
      const slot = dayslotLoad(shifted, a, engine, contourOf(view, a));
      if (slot.isos.length > days.length) days = slot.isos;
      const prev = byRes.get(a.resourceId);
      byRes.set(a.resourceId, prev ? slot.units.map((u, i) => u + (prev[i] ?? 0)) : slot.units);
    }
    return { days, byRes, placed: null };
  };
  const demandCache = new Map<string, CandidateDemand>();
  const demandAt = (task: Task, startDate: Date): CandidateDemand => {
    if (isNaN(startDate.getTime())) return { days: [], byRes: new Map(), placed: null }; // niet cachen
    const key = `${task.id}|${startDate.getTime()}`;
    const hit = demandCache.get(key);
    if (hit) return hit;
    const result = computeDemand(task, startDate);
    demandCache.set(key, result);
    return result;
  };
  const forgetDemand = (taskId: string): void => {
    for (const key of [...demandCache.keys()]) if (key.startsWith(`${taskId}|`)) demandCache.delete(key);
  };

  // Heeft de taak vraag op de geselecteerde renewables? Een toewijzing op een geselecteerde resource
  // aan een bladtaak met duur (geen mijlpaal, geen samenvatting). De vraag zelf hangt van de
  // kandidaat af en komt uit `demandAt`.
  const demandTasks = new Set<string>();
  for (const [taskId] of selectedAssignmentsByTask) {
    const task = taskById.get(taskId);
    if (!task || task.isMilestone || isSummaryTask(task)) continue;
    if (task.time.scheduleDuration <= 0) continue;
    demandTasks.add(taskId);
  }

  // Indeling: movable (mag schuiven) vs. gefixeerd (vastgepind) vs. ONVERPLAATSBAAR (voltooid ÓF in
  // uitvoering — `isImmovableTask`) vs. BUITEN SCOPE vs.
  // geen vraag op selectie. Een out-of-scope taak is nóg strenger dan vastgepind: ze schuift niet,
  // ze volgt geen voorgangers, ze boekt op haar eigen (BEHOUDEN) baselinepositie — vandaar vóór alle
  // andere checks. Zo'n taak is geen "vastgepind" (priority 1000, volgt nog wél voorgangers via PF)
  // — ze is nog strenger: ze staat ONVOORWAARDELIJK op haar actuals/restwerk, ongeacht priority, en
  // gaat dus NOOIT door `findSlot` OF het pinned-pad. Zie `fixedLoadIds` hieronder voor de boeking.
  const hasDemand = (id: string) => demandTasks.has(id);
  const movableIds: string[] = [];
  const pinnedIds: string[] = [];
  const fixedLoadIds: string[] = [];
  for (const t of tasks) {
    if (!hasDemand(t.id)) continue;             // geen vraag op geselecteerde renewables → niet verschuiven
    if (!inScope(t.id)) { fixedLoadIds.push(t.id); continue; } // buiten scope — vóór alle andere checks
    if (isImmovableTask(t)) { fixedLoadIds.push(t.id); continue; } // voltooid/in uitvoering — vóór de pin-check
    if (t.priority === 1000) pinnedIds.push(t.id); // vastgepind
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

  // Reden-sturing. Faalde ELKE afgewezen kandidaat van de huidige `findSlot`-
  // aanroep uitsluitend op het POOLitem-grootboek, dan is de eerlijke uitkomst "restcapaciteit vol
  // — anderen bezetten de pool" (RESIDUAL_FULL), niet het generieke "onvoldoende capaciteit" (dat
  // wijst de gebruiker naar zijn eigen projectinzet, waar niets mis mee is). Gedeeld tussen `fits`
  // en `findSlot` (beide sluiten over deze `levelResources`-scope) — `findSlot` reset 'm bij de
  // start van elke aanroep, `fits` zet 'm op `false` zodra de PROJECTtoets faalt.
  let poolBlockedOnly = false;

  // Geplaatste posities (voor boekhouding/debug): iso-startdag.
  const placedStartIso = new Map<string, string>();

  // Boek de vraag van een taak vanaf een gegeven startmoment — via `demandAt` hierboven, dezelfde
  // uitkomst als `findSlot`s capaciteitstoets (conflictdetectie en boeking lopen niet uit elkaar).
  // `toPoolLedger` bepaalt of deze boeking OOK in het gedeelde poolitem-grootboek komt. De
  // per-resource boeking (`book(resId, ...)`) blijft ONVOORWAARDELIJK (ook een onopgeloste taak boekt
  // op haar project-grootboek, zodat het conflict zichtbaar blijft); alleen de POOL-boeking is
  // voorwaardelijk: "niet-plaatsbaar = tekort, geen cascade".
  // De onderbreek-modus zet de nieuwe leveling-gaten eerst op de WERKKOPIE (`workById`) en wist de
  // cache van die taak; deze boeking ziet dan de nieuwe plaatsing.
  const bookDemandAt = (taskId: string, startDate: Date, toPoolLedger: boolean): string[] => {
    const task = workById.get(taskId)!;
    const { days: occ, byRes } = demandAt(task, startDate);
    for (const [resId, arr] of byRes) {
      const poolItem = ledger && toPoolLedger ? ledger.poolItemOf(resId) : null;
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        book(resId, occ[i], arr[i]);
        if (poolItem !== null) ledger!.book(poolItem, occ[i], arr[i]);
      }
    }
    return occ;
  };

  // Zoekhorizon: een data-gedreven grens i.p.v. een vaste (trage) 5000-dagen-scan — een volledig
  // geserialiseerde plaatsing (elke taak achter elkaar) past binnen de som van alle taakduren + marge.
  //
  // Dit is een ONDERGRENS-argument, geen exacte garantie. Twee
  // redenen waarom de kandidaat-scan méér STAPPEN kan nodig hebben dan `totalWork` (in werkdagen)
  // suggereert:
  //  - ELAPSEDTIME-kandidaten stappen per KALENDERdag (`candidateAxis`), niet per werkdag —
  //    de horizon in KALENDERDAGEN is dus krapper dan in werkdagen (ruwweg 5/7 van `scanLimit`
  //    werkdagen-equivalent aan kalenderdagen-stappen, bij een ma-vr-kalender): elke week kost twee
  //    "verspilde" stappen (za/zo) die geen werkdag opleveren.
  //  - een gesplitste taak (`splitGaps`) beslaat MEER kalenderdagen dan haar `scheduleDuration` (die
  //    telt alleen werkdagen, de pauzedagen zitten er niet in) — `totalWork` telt dus de werk-INHOUD,
  //    niet de volle kalenderspanne die een serialisatie van gesplitste taken werkelijk in beslag zou
  //    nemen.
  // De `+10`/`Math.max(…, 30)`-marge vangt dit in de praktijk op (geen case raakt de grens), maar is
  // geen wiskundig bewijs — een pathologisch scenario (veel korte ELAPSEDTIME-taken, elk met een
  // spanne die net in een weekend valt) kan de grens in theorie raken. Een uitputting is een eigen,
  // gerapporteerde uitkomst (`NO_WINDOW_IN_HORIZON`), geen verzonnen capaciteitsdiagnose; de marge
  // vergroten is de reparatie wanneer een uitputting ONTERECHT optreedt.
  const totalWork = tasks.reduce((sum, t) => sum + (t.isMilestone ? 0 : Math.max(0, t.time.scheduleDuration)), 0);
  const scanLimit = Math.max(totalWork + 10, 30);

  // Sorteervolgorde: priority desc, totalFloat asc, earlyStart asc, aanmaakvolgorde asc — alle
  // sleutels uit de VERSE baseline. De laatste sleutel is bewust de stabiele aanmaakvolgorde
  // i.p.v. de random-bevattende task-ID (utils/id.ts), zodat de volgorde deterministisch is.
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
  // capaciteit). Niet-actieve taken (geen vraag / mijlpaal / summary / VOLTOOID) gelden meteen
  // als geplaatst — `fixedLoadIds` zit hier bewust ook niet in `active`.
  const active = new Set<string>([...pinnedIds, ...movableIds]);
  const sortedActive = [...active].sort(cmp);

  const placed = new Set<string>();
  for (const t of tasks) if (!active.has(t.id)) placed.add(t.id);

  // ONVERPLAATSBAAR — voltooid ÓF in uitvoering ÓF BUITEN SCOPE: vóór de eligibility-lus als VASTE LAST geboekt — op hun EIGEN (ongeschoven, resp.
  // BEHOUDEN) baseline-earlyStart, nooit een levelingDelay. `placed` bevat ze al (hierboven, via de
  // `!active.has`-lus); dit boekt alleen hun vraag zodat movable/vastgepinde taken die er straks
  // langs moeten het conflict ECHT zien. Reden waarom dit NIET via het pinned-pad in de hoofdlus kan
  // (voor de onverplaatsbare taken): `CPMSolver.forwardPass`'s VOLTOOID-tak én haar
  // IN-UITVOERING-tak planten deze taken allebei
  // onvoorwaardelijk op respectievelijk `actualStart`/`actualFinish` of `actualStart` + restwerk, en
  // NEGEREN `levelingDelay` volledig — een delay toekennen zou een stille no-op zijn (het conflict
  // herleeft na de volgende `runCPM`, `unresolved` zou dan ten onrechte leeg blijven terwijl er wél
  // een botsing is). Vandaar: geen
  // delay-poging, geen findSlot-scan, alleen de boeking — het conflict blijft zichtbaar via de
  // MOVABLE/PINNED taken die er straks omheen moeten (of, bij een botsing tussen twee onverplaatsbare
  // taken onderling, blijft gewoon bestaan — dat is dan een ECHTE, gerapporteerde overallocatie, geen
  // leveler-taak om op te lossen).
  // Voor een OUT-OF-SCOPE taak klopt de boekingspositie vanzelf: `baseEs` komt uit de baseline-solve
  // op `workTasks`, en die draagt voor zo'n taak haar BEHOUDEN delay (de selectieve strip hierboven)
  // — dus `baseEs(id)` is hier al haar VERSCHOVEN, genivelleerde positie, niet haar kale PF.
  for (const id of fixedLoadIds) {
    const startIso = baseEs(id);
    // `toPoolLedger: true` — een onverplaatsbare of out-of-scope taak bezet de
    // pool ECHT (ze is per definitie al geplaatst, dus geen "niet-plaatsbaar = geen cascade"-geval).
    // Een lopende taak boekt zo haar ene gezaghebbende plaatsing (de berekende spanne), dezelfde als
    // het histogram — geen nieuwe wandeling van de totale duur (acceptatie-eis 4 van F3b).
    bookDemandAt(id, parseInstant(startIso), true);
    placedStartIso.set(id, startIso);
  }

  const delays: Record<string, number> = {};
  const delayMinutes: Record<string, number> = {};
  const unresolved: Record<string, string[]> = {};
  const unresolvedReasons: Record<string, LevelingReason> = {};
  const intrinsicOverruns: Record<string, LevelingIntrinsicOverrun> = {};
  // TaskId → de volledige, te schrijven `splitGaps`-waarde (bestaande
  // importsplits + eventuele nieuwe leveling-gaten). Alleen gezet voor taken die daadwerkelijk via
  // `findSlot`s scatter-tak geplaatst zijn — zonder `allowSplits` blijft dit `{}`.
  const gapsOut: Record<string, TaskSplitGap[]> = {};

  const allPredsPlaced = (id: string) => predsOf.get(id)!.every(p => placed.has(p));

  // ── Performance (audit 2026-09-26) ──────────────────────────────────────────────────────────────
  // (1) Keuze: vroeger `sortedActive.find(...)` per plaatsing — O(A²). Nu een heap met de
  //     sorteerrang van de GEREEDSTAANDE taken (alle voorgangers geplaatst): het minimum is exact de
  //     taak die `find` zou kiezen.
  // (2) PF: één solver houdt de voorwaartse datums bij. Een delay/nieuw gat markeert alleen de
  //     gewijzigde taak; een topologische wachtrij propageert de wijziging tot de gevraagde taak.
  //     ALAP/hammock en voltooid gemelde taken zonder werkelijk einde houden de volledige solve:
  //     hun uiteindelijke start kan ná de voorwaartse pass nog veranderen.
  //     Uitkomst identiek aan de oude route (`check-leveler-differential.ts`).
  const rankOf = new Map(sortedActive.map((id, i) => [id, i]));
  const succsOf = new Map<string, string[]>();
  const pending = new Map<string, number>();
  for (const [succ, preds] of predsOf) {
    for (const pred of preds) (succsOf.get(pred) ?? succsOf.set(pred, []).get(pred)!).push(succ);
  }
  const readyHeap = new LevelingQueue();
  for (const id of sortedActive) {
    const count = predsOf.get(id)!.filter(p => !placed.has(p)).length;
    pending.set(id, count);
    if (count === 0) readyHeap.push(rankOf.get(id)!);
  }
  const markPlaced = (id: string) => {
    for (const succ of succsOf.get(id) ?? []) {
      const left = pending.get(succ);
      if (left === undefined) continue;          // niet-actieve opvolger
      pending.set(succ, left - 1);
      if (left - 1 === 0 && !placed.has(succ)) readyHeap.push(rankOf.get(succ)!);
    }
  };

  const globalDeps = workTasks.some(t => t.isHammock
    || t.constraint?.type === 'ALAP' || t.constraint2?.type === 'ALAP'
    || (t.time.completion >= 1 && !t.time.actualFinish));
  let forward: ReturnType<CPMSolver['createLevelingForwardPass']> = null;
  let pfEarlyStart = new Map([...baseline.tasks].map(([id, r]) => [id, r.earlyStart]));
  let globallyStale = false;
  const markChanged = (id: string) => {
    if (forward) forward.markChanged(id);
    else globallyStale = true;
  };
  const pfFor = (id: string): Date => {
    if (!LEVELER_TEST_HOOKS.incremental) {
      return computePF(id, workTasks, sequences, projectCalendar, resourceCalendars, cpmOptions);
    }
    // Zonder gewijzigde plaatsing volstaat de baseline: geen extra pass voor plannen zonder
    // capaciteitsdruk (of zonder actieve taken). Bouw de sessie pas bij de eerste gewijzigde PF.
    if (!forward && !globalDeps && globallyStale) {
      forward = new CPMSolver(workTasks, sequences, projectCalendar, resourceCalendars, cpmOptions).createLevelingForwardPass();
      if (forward) globallyStale = false;
    }
    if (forward) {
      return parseInstant(forward.earlyStart(id) ?? workById.get(id)!.time.earlyStart);
    }
    if (globallyStale) {
      const solver = new CPMSolver(workTasks, sequences, projectCalendar, resourceCalendars, cpmOptions);
      pfEarlyStart = new Map([...solver.solve().tasks].map(([taskId, r]) => [taskId, r.earlyStart]));
      globallyStale = false;
    }
    const es = pfEarlyStart.get(id);
    return parseInstant(es ?? workById.get(id)!.time.earlyStart);
  };

  let remaining = sortedActive.length;
  let safety = remaining + 1;
  while (remaining > 0 && safety-- > 0) {
    // Kies de hoogst gesorteerde nog-niet-geplaatste taak waarvan alle voorgangers geplaatst zijn.
    let pick: string | undefined;
    if (LEVELER_TEST_HOOKS.incremental) {
      for (let rank = readyHeap.pop(); rank !== undefined; rank = readyHeap.pop()) {
        const id = sortedActive[rank];
        if (!placed.has(id)) { pick = id; break; }
      }
    } else {
      pick = sortedActive.find(id => !placed.has(id) && allPredsPlaced(id));
    }
    if (!pick) break; // zou niet mogen (CPM is acyclisch); voorkom oneindige lus

    // PF: de vroege start op de werkkopie (geplaatste taken hebben hun delay; `pick` niet).
    const pf = pfFor(pick);
    const pickedTask = taskById.get(pick)!;

    let startDate: Date;
    let skipped = 0;
    let slotUnresolved: string[] = [];
    let slotReason: LevelingReason | undefined;
    if (pinnedSet.has(pick)) {
      // Vastgepind: volgt zijn (mogelijk verschoven) voorgangers via PF, maar schuift NIET
      // voor capaciteit — geen scan. Boeking op PF valt zo samen met de finale CPM-positie (waar de
      // pin zijn voorgangers volgt), i.p.v. op de stale oorspronkelijke earlyStart. Snapt op de
      // TAAKkalender-as, niet de projectkalender — dezelfde as als de
      // delay-meting hieronder en `findSlot`s kandidaat-scan.
      startDate = nextCandidateFor(pickedTask, pf);
    } else {
      // Vensterbovengrens: het strengste van (a) de float (constrainToFloat) en (b) het
      // uitloop-plafond (`overrunCeilingDays`). Beide op de VERSE baseline-lateStart, dus mét de
      // behouden out-of-scope-delays (referentiepunt: de huidige projecteinddatum, mét bestaande
      // nivellering).
      const limit = windowLimit(pick);
      const slot = findSlot(pick, pf, limit);
      startDate = slot.start;
      skipped = slot.skipped;
      slotUnresolved = slot.unresolved;
      slotReason = slot.reason;
      // `findSlot` leverde een onderbroken plaatsing i.p.v. een aaneengesloten venster. De gaten
      // moeten op de WERKKOPIE staan VÓÓR de boeking hieronder en VÓÓR de proef-solve aan het eind
      // van deze functie — anders belooft `projectEndAfter` een einddatum die de echte
      // `applyLeveling` → `runCPM` straks nooit haalt — en ná de PF-berekening van déze taak (die
      // ging al over de start, niet de spanne). Vandaar hier, meteen na de `findSlot`-aanroep.
      if (slot.scatterGaps) {
        workById.get(pick)!.splitGaps = slot.scatterGaps; // ⇒ boeking en proef-solve zien de opgerekte spanne
        gapsOut[pick] = slot.scatterGaps;                 // ⇒ komt in LevelingResult.gaps
        markChanged(pick);                                // opgerekte spanne ⇒ opvolgers mogelijk later
        // Deze taak kreeg een NIEUWE plaatsing tijdens de run — wis haar cache-entries, anders valt
        // de boeking op de oude (voor-scatter) vraag.
        forgetDemand(pick);
      }
    }

    // "Niet-plaatsbaar = tekort per document, geen cascade" — alleen een taak die daadwerkelijk een passend venster kreeg (`slotUnresolved`
    // leeg) boekt in het GEDEELDE poolitem-grootboek. Vastgepinde taken (priority 1000) scannen niet
    // (`slotUnresolved` blijft hun default `[]`) en boeken dus WÉL — correct: ze bezetten de pool
    // ongeacht of dat past. Dat het restprofiel daardoor op 0 geklemd kan raken terwijl er
    // feitelijk overboeking is, is geen motorprobleem: dat is een tekort op poolniveau, voor de
    // verdeler.
    bookDemandAt(pick, startDate, slotUnresolved.length === 0);
    placedStartIso.set(pick, formatInstant(startDate, 'hour'));
    // De vertraging, zoals `CPMSolver.forwardPass`'s `shiftByLevelingDelay` haar straks TOEPAST
    // (spec §3.11): `delayMinutes` gaat vóór `levelingDelay`. Beide komen van de kandidaat-as
    // (`candidateAxis`): `skipped` overgeslagen werkdagen, en hun werkminuten op de TAAKkalender.
    //  - WORKTIME met werkblokken: `delays` = het aantal overgeslagen werkdagen, `delayMinutes` = hun
    //    werkminuten. De solver telt de minuten op (`addWorkingMinutesSigned`) en zet een blokeinde op
    //    het volgende blokbegin (N2): hij landt exact op de kandidaat. Normalisatie van PF naar het
    //    volgende blok telt niet: geen capaciteitsvertraging. `levelingDelay` verdwijnt in F6.
    //  - ELAPSEDTIME: kale KALENDERdagen, 24/7, en dezelfde afstand in klokminuten (`addElapsedMinutes`).
    //  - Dagmodus (kalender zonder werkblokken): hele werkdagen, geen minuten.
    const pickEngine = engineForTask(pickedTask);
    let delay = 0;
    let delayMin: number | undefined;
    if (pickedTask.time.durationType === 'ELAPSEDTIME') {
      delay = diffCalendarDays(pf, startDate);
      delayMin = delay > 0 ? Math.round((startDate.getTime() - pf.getTime()) / 60_000) : undefined;
    } else if (pickEngine.isHourMode) {
      if (skipped > 0) {
        delay = skipped;
        delayMin = Math.round(candidateAxis(pickedTask, pf).minutes(skipped));
      }
    } else {
      delay = pickEngine.workDaysBetween(parseDate(formatDate(pf)), parseDate(formatDate(startDate))) - 1;
    }
    if (delay > 0) {
      delays[pick] = delay;
      if (delayMin !== undefined && delayMin > 0) delayMinutes[pick] = delayMin;
    }
    if (slotUnresolved.length > 0) {
      unresolved[pick] = slotUnresolved;
      if (slotReason) unresolvedReasons[pick] = slotReason;
      if (slotReason === 'INTRINSIC_OVERRUN') {
        const detail = intrinsicOverrunFor(demandAt(workById.get(pick)!, startDate).byRes);
        if (detail) intrinsicOverruns[pick] = detail;
      }
    }
    const newDelay = delay > 0 ? delay : undefined;
    const newDelayMinutes = delay > 0 ? delayMinutes[pick] : undefined;
    const work = workById.get(pick)!;
    if (work.levelingDelay !== newDelay || work.levelingDelayMinutes !== newDelayMinutes) markChanged(pick);
    work.levelingDelay = newDelay;
    work.levelingDelayMinutes = newDelayMinutes;

    placed.add(pick);
    markPlaced(pick);
    remaining--;
  }

  // Preview uit één echte proef-solve op de werkkopieën (nu mét alle gezette delays) — exact wat
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
    if (isNaN(from.getTime()) || isNaN(to.getTime())) continue; // geen crash op onparseerbare datums
    // Gemeten op DEZELFDE as als de delay hierboven — taakkalender-werkdagen (WORKTIME) of kale
    // kalenderdagen (ELAPSEDTIME), niet de projectkalender. Anders toont de preview "0 werkdagen"
    // naast twee zichtbaar verschillende data.
    const eng = engineForTask(t);
    const delta = t.time.durationType === 'ELAPSEDTIME'
      ? diffCalendarDays(from, to)
      : eng.signedWorkDaysBetween(from, to);
    // Alleen D1-normalisatie binnen dezelfde dag is geen verschuiving in deze dagpreview.
    if (delta === 0) continue;
    shifts[t.id] = { oldStart: cur, newStart: tr, delta };
  }

  return {
    delays,
    delayMinutes,
    unresolved,
    unresolvedReasons,
    ...(Object.keys(intrinsicOverruns).length > 0 ? { intrinsicOverruns } : {}),
    shifts,
    projectEndBefore: cpmResult.projectEnd,
    projectEndAfter,
    gaps: gapsOut,
  };

  // --- lokale helpers (sluiten over booked/demandAt/capacityOf) ---

  /** Scan vanaf PF kandidaat voor kandidaat (de PF zelf, daarna het begin van elke volgende werkdag)
   *  naar de eerste waarop elke benodigde resource genoeg restcapaciteit heeft voor de vraag van
   *  DIE kandidaat. `ls` != null (smoothing) begrenst het venster; geen slot binnen het venster →
   *  blijf op de gesnapte PF (mét conflict) en meld de conflictdagen + reden.
   *
   *  Twee assen moeten gelijk lopen met de rest van de nivelleerder:
   *   - de kandidaat-AS (`cand`/`next`) loopt via `candidateAxis` (k overgeslagen werkdagen) —
   *     dezelfde taakkalender/ELAPSEDTIME-kalenderdagen-as als de delay-meting in de hoofdlus
   *     (anders een spookvertraging bij nul druk voor een taak op een afwijkende kalender);
   *   - de dagen én de vraag per kandidaat komen uit `demandAt`, GEDEELD met `bookDemandAt`, zodat
   *     `calendarOk`/`reasonFor`/de conflictdagenlijst geen dagen noemen waarop de taak niet werkt
   *     en de toets nooit een andere vraag ziet dan de boeking. */
  function findSlot(
    taskId: string,
    pf: Date,
    limit: Date | null,
  ): { start: Date; skipped: number; unresolved: string[]; reason?: LevelingReason; scatterGaps?: TaskSplitGap[] } {
    // `task` komt uit `workById`, niet `taskById` — `findSlot` wordt uitsluitend
    // aangeroepen voor movable/vastgepinde (dus per definitie IN-SCOPE) taken, dus dit is precies de
    // GESTRIPTE baseline. Zonder deze wissel zou `demandAt` hieronder een leveling-gat uit een
    // VORIGE nivellering als brondata lezen — de kandidaat-scan zou dan een gesplitste dagenset toetsen in plaats van de schone aaneengesloten baseline waar deze functie
    // vanuit gaat, en de idempotentie zou stuklopen. Zie `bookDemandAt`
    // hierboven voor dezelfde wissel en dezelfde motivering.
    const task = workById.get(taskId)!;

    // Reset de reden-sturing bij elke aanroep — zie de declaratie hierboven bij `booked`/`bookedOn`.
    // Zonder grootboek (`ledger === undefined`) blijft dit `false`, dus de RESIDUAL_FULL-tak in
    // `reasonFor` wordt nooit geraakt.
    poolBlockedOnly = ledger !== undefined;

    const axis = candidateAxis(task, pf);
    let k = 0;
    let cand = axis.at(0);

    // CEILING_UNREACHABLE: staat er een plafond, en ligt de EERSTE
    // kandidaat (= `cand` hierboven, dezelfde waarde als `nextCandidateFor(task, pf)`) er al
    // voorbij, dan is het venster leeg vóórdat capaciteit ook maar geraadpleegd is — de binder is
    // dan een deadline/backward-constraint (die drukt `lateStart` naar voren), niet de capaciteit.
    // Bewust ALLEEN bij een expliciet plafond: met kaal `constrainToFloat` wordt bij `pf > ls` de
    // eerste kandidaat altijd geprobeerd (getest gedrag).
    const ceilingSet = options.overrunCeilingDays !== undefined;
    const ceilingUnreachable = ceilingSet && limit !== null && cand > limit;

    let calendarFeasibleSeen = false; // is er überhaupt een venster waar élke vraagdag óók een resource-werkdag is?
    // `scanLimit` is de taak-eigen ondergrens; een grootboek MET horizon (`ledger.horizonIso`) kan die
    // overschrijden — zodra het grootboek externe vaste last bevat, kan het eerste vrije venster
    // voorbij `totalWork + marge` liggen. De lus loopt daarom tot de harde `HARD_SCAN_CAP`, en
    // `scanLimit` is hieronder een INLINE afkap-voorwaarde; zonder grootboek-horizon stopt de lus dus
    // na precies `scanLimit` kandidaten.
    const horizonDate = ledger?.horizonIso ? parseDate(ledger.horizonIso) : null;
    let guard = 0;
    // Onderscheid WAAROM de scan zonder slot eindigt — via de venstergrens (`break` hieronder, een
    // bewuste gebruikerskeuze) of doordat de horizon (scanLimit, evt. verlengd door het grootboek)
    // opraakte (een rekengrens). Alleen de horizon-tak hieronder — én de `HARD_SCAN_CAP`-vangrail ná
    // de lus — zetten hem op `true`.
    let horizonExhausted = false;
    while (guard++ < HARD_SCAN_CAP) {
      const { days: occ, byRes } = demandAt(task, cand);
      if (!calendarFeasibleSeen && calendarOk(byRes, occ)) calendarFeasibleSeen = true;
      // Een LEEG kandidaatvenster (`occ.length === 0`) telt NIET als passend.
      // `fits` is triviaal waar op een lege dagenset (de binnenlus over `occ` loopt gewoon nul keer),
      // en omdat ELAPSEDTIME-kandidaten per KALENDERdag stappen kan een korte elapsed-spanne
      // volledig in een weekend vallen — dan levert `demandAt` `[]` (geen enkele werkminuut in die
      // spanne). Zonder deze guard "past" de taak daar, wordt ze daar geplaatst, en verdwijnt haar
      // vraag stilzwijgend uit het boekhoudgrootboek (niets wordt geboekt, want `bookDemandAt` boekt
      // ook via `demandAt` en loopt dus over dezelfde lege set). BEWUST NIET `calendarOk` als extra voorwaarde: die is STRENGER dan nodig — hij
      // eist dat ELKE vraagdag een resource-werkdag heeft, wat geval 4's bewuste min-klem (een
      // vraag-array die langer is dan `occ`, `i < arr.length && i < occ.length`) ten onrechte zou laten
      // afketsen. `occ.length > 0` is de minimale, correcte voorwaarde: er moet gewoon IETS te boeken zijn.
      if (occ.length > 0 && fits(byRes, occ)) return { start: cand, skipped: k, unresolved: [] };
      const next = axis.at(k + 1);
      if (limit && next > limit) break; // venstergrens (float/plafond) — geen slot, geen horizon-uitputting
      // De venstergrens (hierboven) wint van de horizon — een plafond is een gebruikerskeuze, de
      // horizon een rekengrens. Zonder grootboek-horizon (`horizonDate === null`) stopt dit exact bij
      // `guard === scanLimit`.
      if (guard >= scanLimit && !(horizonDate && next <= horizonDate)) { horizonExhausted = true; break; }
      cand = next;
      k++;
    }
    if (guard >= HARD_SCAN_CAP) horizonExhausted = true; // vangrail: ook dít is een uitputting, geen venstergrens

    // ── Onderbreek-modus ─────────────────────────────────────────────────────────────────────────
    // Er is geen AANEENGESLOTEN venster gevonden. Mag de taak onderbroken worden, dan plaatsen we
    // haar met pauzes: vanaf de gesnapte PF, bij de eerste dag die niet past één hele werkdag pauze
    // (of, vóór het eerste werk, de volgende kandidaat), en daarna de HELE kandidaat opnieuw
    // berekend met de gedeelde plaatsing. Greedy van links naar rechts — bewust GEEN zoektocht over
    // kandidaatstanden: het greedy-antwoord is per constructie de vroegst mogelijke onderbroken
    // plaatsing. Gebonden door `finishWindowLimit` (de FINISH-versie van het plafond, niet de
    // start-`limit` hierboven) — zie het docblok daar.
    if (splitEligible(task) && engineForTask(task).isHourMode) {
      const scatter = scatterSlot(task, axis, finishWindowLimit(taskId));
      if (scatter.gaps && scatter.start) {
        return { start: scatter.start, skipped: scatter.skipped, unresolved: [], scatterGaps: scatter.gaps };
      }
      // De scatter is de LAATSTE poging. Liep díé op de zoekhorizon
      // leeg — en niet op de venstergrens — dan is de horizon de eerlijke reden, ook wanneer de
      // aaneengesloten scan hierboven nog netjes op het venster stopte. Zonder deze regel valt de
      // uitputting stil weg en verzint `reasonFor` een capaciteits-/plafonddiagnose.
      if (scatter.horizonExhausted) horizonExhausted = true;
    }

    // Geen slot: blijf op de gesnapte PF, verzamel de conflictdagen (waar de vraag de restcapaciteit
    // overschrijdt) — dezelfde dagen en vraag (`demandAt`) als de boeking straks gebruikt.
    const snappedPf = axis.at(0);
    const { days: occ, byRes } = demandAt(task, snappedPf);
    const conflicts: string[] = [];
    for (const [resId, arr] of byRes) {
      // Naast de projecttoets ook de pool-tak: anders blijft een taak die UITSLUITEND op het
      // poolitem-grootboek vastloopt met een LEGE conflictdagenlijst zitten — de
      // hoofdlus zet `unresolved[pick]`/`unresolvedReasons[pick]` alleen bij `slotUnresolved.length >
      // 0`, dus RESIDUAL_FULL zou stilzwijgend verdwijnen. Spiegelt `fits`'s tweede toets: de POOL-tak
      // wordt alleen bekeken als de PROJECTtoets al slaagde (elke-if, geen dubbele push).
      const poolItem = ledger ? ledger.poolItemOf(resId) : null;
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        // Zelfde nul-guard als `fits` hieronder — een dag zonder vraag (`arr[i] <= 0`) kan niet
        // botsen, ook niet als een ANDERE (bv. vastgepinde) taak die dag overboekt; anders een
        // fantoomconflict van DEZE taak (`check-leveler-seam.ts` geval 3).
        if (arr[i] <= 0) continue;
        if (exceedsCapacity(bookedOn(resId, occ[i]) + arr[i], capacityOf(resId, occ[i]))) conflicts.push(occ[i]);
        else if (poolItem !== null && exceedsCapacity(arr[i], ledger!.residualOn(poolItem, occ[i]))) conflicts.push(occ[i]);
      }
    }
    return {
      start: snappedPf,
      skipped: 0,
      unresolved: [...new Set(conflicts)].sort(),
      reason: reasonFor(byRes, calendarFeasibleSeen, ceilingSet, ceilingUnreachable, horizonExhausted),
    };
  }

  function intrinsicOverrunFor(byRes: Map<string, number[]>): LevelingIntrinsicOverrun | undefined {
    for (const [resourceId, arr] of byRes) {
      const peak = arr.length > 0 ? maxOf(arr) : 0;
      const capacity = maxCapacityOf(resourceId);
      if (exceedsCapacity(peak, capacity)) return { resourceId, peak, capacity };
    }
    return undefined;
  }

  /** Reden waarom er geen slot bestaat. Volgorde: intrinsiek
   *  (de piekvraag overtreft de maximale capaciteit van de resource ongeacht plaatsing) →
   *  CEILING_UNREACHABLE (een deadline/backward-constraint maakt elk plafond onbereikbaar — gaat
   *  vóór de kalender/capaciteit: het enige geval waarin de gebruiker iets anders moet doen dan
   *  plafond of capaciteit bijstellen) → kalender-mismatch (geen enkel venster waar alle vraagdagen
   *  ook resource-werkdagen zijn) → RESIDUAL_FULL (elke afgewezen kandidaat faalde uitsluitend op het
   *  poolitem-grootboek — de eigen projectinzet had steeds ruimte) → CEILING_TOO_TIGHT (venster
   *  bekend en te krap ⇒ concreter dan een kale horizon-uitputting) → NO_WINDOW_IN_HORIZON (de scan
   *  liep leeg zonder gekend venster) → anders onvoldoende vrije capaciteit.
   *
   *  RESIDUAL_FULL vóór CEILING_TOO_TIGHT (en niet andersom): `computeDistribution` zet vrijwel
   *  altijd een plafond (`overrunCeilingDays`), dus `ceilingSet` staat bijna elke aanroep aan — in de
   *  omgekeerde volgorde won CEILING_TOO_TIGHT dan ALTIJD en was RESIDUAL_FULL onbereikbaar, ook
   *  wanneer de taak uitsluitend vastliep op andere projecten die de pool bezetten. De gebruiker moet
   *  naar de pool gewezen worden, niet naar zijn eigen (onschuldige) plafond. */
  function reasonFor(
    byRes: Map<string, number[]>,
    calendarFeasibleSeen: boolean,
    ceilingSet: boolean,
    ceilingUnreachable: boolean,
    horizonExhausted: boolean,
  ): LevelingReason {
    if (intrinsicOverrunFor(byRes)) return 'INTRINSIC_OVERRUN';
    if (ceilingUnreachable) return 'CEILING_UNREACHABLE';
    if (!calendarFeasibleSeen) return 'CALENDAR_MISMATCH';
    if (poolBlockedOnly) return 'RESIDUAL_FULL';
    if (ceilingSet) return 'CEILING_TOO_TIGHT';
    if (horizonExhausted) return 'NO_WINDOW_IN_HORIZON';
    return 'INSUFFICIENT_CAPACITY';
  }

  /** Kalender-haalbaar venster? Elke vraagdag (>0) valt op een resource-WERKdag, ongeacht al
   *  geboekte belasting én ongeacht hoeveel eenheden hij die dag te bieden heeft — puur de
   *  kalender-uitlijning. Niet `capacityOf <= 0`: een resource met `maxUnits: 0` (of, met een
   *  restprofiel, een geklemd nulprofiel) is een capaciteits-, geen kalenderprobleem
   *  (`check-leveler-seam.ts` geval 1). */
  function calendarOk(byRes: Map<string, number[]>, occ: string[]): boolean {
    for (const [resId, arr] of byRes) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] <= 0) continue;
        if (i >= occ.length) return false;
        if (!isResWorkDay(resId, occ[i])) return false;
      }
    }
    return true;
  }

  /** Past de dagvraag `byRes` op de opeenvolgende werkdagen `occ` binnen de restcapaciteit? TWEE
   *  toetsen moeten allebei slagen — (a) de per-resource-toets tegen de eigen projectinzet, én (b) —
   *  alleen als er een `poolLedger` is en de resource daaraan hangt — het gedeelde
   *  poolitem-grootboek (zie `LevelingPoolLedger`s docblok). `poolBlockedOnly` (findSlot-scope) wordt hier op `false` gezet zodra de PROJECTtoets
   *  faalt — zo weet `reasonFor` achteraf of ELKE afwijzing binnen deze `findSlot`-aanroep
   *  uitsluitend aan de pool lag. */
  function fits(byRes: Map<string, number[]>, occ: string[]): boolean {
    for (const [resId, arr] of byRes) {
      const poolItem = ledger ? ledger.poolItemOf(resId) : null;
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        if (arr[i] <= 0) continue;
        if (exceedsCapacity(bookedOn(resId, occ[i]) + arr[i], capacityOf(resId, occ[i]))) { poolBlockedOnly = false; return false; }
        if (poolItem !== null && exceedsCapacity(arr[i], ledger!.residualOn(poolItem, occ[i]))) return false;
      }
    }
    return true;
  }

  /** Heeft de gebruiker deze taak ZELF al onderbroken? De
   *  scatter-as kent bestaande gaten niet: ze kiest losse werkdagen alsof de taak aaneengesloten is
   *  en stapelt haar eigen `'leveling'`-gaten blind bovenop de indeling die de gebruiker net
   *  gemaakt heeft. Zo'n taak wordt daarom alleen als GEHEEL uitgesteld, nooit opgeknipt.
   *
   *  Bewust alleen `'user'` en niet "elk niet-`'leveling'`-gat": een IMPORTsplit (geen `source`) is
   *  brondata van een ander programma, geen keuze van déze gebruiker — `check-leveler-splitmode.ts`
   *  geval 4 pint dat bestaande gedrag vast (bronsplit blijft staan, leveling-gat komt erbij). */
  // Function DECLARATION, geen `const`: `splitEligible` hieronder is zelf gehoist en wordt vanuit
  // `findSlot` aangeroepen vóórdat deze regel in de closure-opbouw bereikt is.
  function hasOwnGaps(task: Task): boolean {
    return (task.splitGaps ?? []).some(g => g.source === 'user');
  }

  /** Mag deze taak leveling-gaten krijgen? Zie de grens bij `LevelingOptions.allowSplits`
   *  (`durationUnit` speelt geen rol — dag- én uur-modus, mits WORKTIME en niet-gestart). */
  function splitEligible(task: Task): boolean {
    return options.allowSplits === true
      && task.time.durationType === 'WORKTIME'
      && task.time.completion === 0
      && !hasOwnGaps(task);
  }

  /** Past de vraag op plaatsingsdag `i` van deze kandidaat op dag `iso`? Zelfde twee toetsen als
   *  `fits` (projectinzet én poolitem-grootboek), maar voor één dag en zonder reden-sturing. */
  function dayFits(byRes: Map<string, number[]>, i: number, iso: string): boolean {
    for (const [resId, arr] of byRes) {
      if (i >= arr.length) continue; // geen vraag op deze dag voor deze resource
      const amt = arr[i];
      if (amt <= 0) continue;
      if (exceedsCapacity(bookedOn(resId, iso) + amt, capacityOf(resId, iso))) return false;
      const poolItem = ledger ? ledger.poolItemOf(resId) : null;
      if (poolItem !== null && exceedsCapacity(amt, ledger!.residualOn(poolItem, iso))) return false;
    }
    return true;
  }

  /** Onderbroken plaatsing op momenten. Geeft de te schrijven `splitGaps` (bestaande importsplits +
   *  nieuwe `'leveling'`-gaten op de cumulatieve as) en de start, of `gaps: null` wanneer er binnen
   *  het venster geen passende plaatsing te vinden is.
   *
   *  Elke stap berekent de HELE kandidaat opnieuw met de gedeelde plaatsing (`computeDemand`, niet
   *  gecachet: de gaten veranderen per stap). Past hij niet, dan krijgt de eerste dag die niet past
   *  één hele effectieve werkdag pauze (de werkminuten van die dag) op de cumulatieve as; latere
   *  gaten schuiven mee, en een pauze direct na een eerdere nivelleerpauze verlengt die. Ligt die dag vóór het eerste werk, dan is dat uitstel en geen split met een
   *  openingsgat: de start gaat naar de volgende kandidaat. Een korte dag krijgt zo nooit de vraag
   *  van een eerdere plaatsing mee.
   *
   *  `finishLimit` begrenst het EINDE (niet de start): met onderbrekingen groeit de FINISH van de
   *  taak, en dát is wat het plafond moet binden (zie `finishWindowLimit`). `horizonExhausted`
   *  spiegelt de gelijknamige vlag in `findSlot`: liep deze scan leeg op de ZOEKHORIZON (`scanLimit`,
   *  evt. verlengd door de grootboekhorizon) in plaats van op de venstergrens, dan is dat een
   *  REKENgrens en geen capaciteits- of plafondprobleem. */
  function scatterSlot(
    task: Task, candidates: ReturnType<typeof candidateAxis>, finishLimit: Date | null,
  ): { gaps: TaskSplitGap[] | null; start?: Date; skipped: number; horizonExhausted: boolean } {
    const engine = engineForTask(task);
    let skipped = 0;
    let start = candidates.at(0);
    let gaps: TaskSplitGap[] = [...(task.splitGaps ?? [])];
    const horizonDate = ledger?.horizonIso ? parseDate(ledger.horizonIso) : null;
    for (let scan = 0; scan < HARD_SCAN_CAP; scan++) {
      const candidate = computeDemand({ ...task, splitGaps: gaps.length > 0 ? gaps : undefined }, start);
      const placedCandidate = candidate.placed;
      if (!placedCandidate || candidate.days.length === 0) return { gaps: null, skipped, horizonExhausted: false };
      // Past hij, dan is dit de plaatsing — ook als alleen de start verschoof (het einde bleef binnen
      // het plafond, terwijl de aaneengesloten scan op de STARTgrens stopte).
      // `dayFits` per dag in plaats van `fits`: dezelfde twee toetsen, maar zonder de reden-sturing
      // van `fits` (`poolBlockedOnly`) te raken — die beschrijft de aaneengesloten scan.
      const index = candidate.days.findIndex((iso, i) => !dayFits(candidate.byRes, i, iso));
      // Venstergrens (het FINISH-plafond) — een gebruikerskeuze, GEEN horizon-uitputting. Past alles,
      // dan telt het einde van de plaatsing. Past een dag niet, dan telt die dag: alleen daar kan de
      // plaatsing nog veranderen, en elke pause schuift het einde verder op. Zo bereikt de scan de
      // zoekhorizon op dezelfde dag als de aaneengesloten scan (bevinding B8 hierboven).
      if (index < 0) {
        if (finishLimit && placedCandidate.finish > finishLimit) return { gaps: null, skipped, horizonExhausted: false };
        return { gaps, start, skipped, horizonExhausted: false };
      }
      const day = placedCandidate.days[index];
      if (finishLimit && parseDate(day.iso) > finishLimit) return { gaps: null, skipped, horizonExhausted: false };
      const axis = day.ranges[0].afterMinutes;
      if (axis === 0) {
        // Vóór het eerste werk: uitstel, geen split met een ongeldig openingsgat.
        start = candidates.at(++skipped);
      } else {
        const pause = engine.effectiveBandsOn(parseDate(day.iso)).reduce((sum, b) => sum + b.end - b.start, 0);
        // Een pauze direct na een eerdere nivelleerpauze verlengt die pauze: één gat per
        // aaneengesloten pauze, zoals de gebruiker het ziet. Een importsplit blijft een eigen gat.
        const before = gaps.find(g => g.source === 'leveling' && g.afterMinutes + g.gapMinutes === axis);
        gaps = gaps.map(g => g.afterMinutes >= axis ? { ...g, afterMinutes: g.afterMinutes + pause }
          : g === before ? { ...g, gapMinutes: g.gapMinutes + pause } : g);
        if (!before) gaps.push({ afterMinutes: axis, gapMinutes: pause, source: 'leveling' });
        gaps.sort((a, b) => a.afterMinutes - b.afterMinutes);
      }
      // Zelfde tweetrapsgrens als `findSlot`: `scanLimit` is de gewone ondergrens, een
      // grootboekhorizon mag hem verlengen. `HARD_SCAN_CAP` blijft uitsluitend de vangrail.
      if (scan + 1 >= scanLimit && !(horizonDate && parseDate(day.iso) <= horizonDate)) {
        return { gaps: null, skipped, horizonExhausted: true };
      }
    }
    return { gaps: null, skipped, horizonExhausted: true };
  }
}

/** Precedence-feasible start van `taskId`: herdraai de CPMSolver op de werkkopie (waarin de
 *  geplaatste voorgangers hun `levelingDelay` hebben en `taskId` niet) en lees de early start.
 *  Dat is per constructie de PF mét alle relatie-/lag-/constraint-logica.
 *
 *  Gevalideerd in `check-leveler-scope.ts` geval 2: `workTasks`
 *  draagt voor OUT-OF-SCOPE taken hun BEHOUDEN `levelingDelay` (de selectieve strip in
 *  `levelResources`), dus deze herdraaide solve past die delay via `shiftByLevelingDelay` toe en
 *  propageert 'm langs relaties naar opvolgers — een opvolger van een out-of-scope taak volgt haar
 *  VERSCHOVEN positie, niet haar ongenivelleerde. */
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
  return parseInstant(r?.earlyStart ?? workTasks.find(t => t.id === taskId)!.time.earlyStart);
}
