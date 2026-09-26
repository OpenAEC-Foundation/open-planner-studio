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
//  - Curve-bewust: dezelfde `distributeUnits` als het histogram voedt de capaciteitscheck.
//    Nooit `MATERIAL` nivelleren.
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
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { CPMSolver, type CPMResult, type CPMOptions } from './CPMSolver';
import { assignmentDayUnits, contourLookup, maxUnitsOn, enumerateWorkDays } from './ResourceLoad';
import { enumerateTaskWorkDays, splitGapsFromWorkDayBlocks } from './splitWalk';
import { createTaskEngineCache } from './taskEngineCache';
import { isPinnedComplete, isPinnedInProgress } from './duration';
import { parseDate, formatDate, addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';

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

export interface LevelingResult {
  /** taskId → toegepaste levelingDelay (werkdagen), alleen taken die daadwerkelijk een eigen delay
   *  krijgen. Vastgepinde/niet-geresourcete opvolgers staan hier NIET in (die schuiven via de CPM-
   *  propagatie, niet via een eigen delay) — `applyLeveling` schrijft precies dit veld. */
  delays: Record<string, number>;
  /** taskId → resterende, onoplosbare conflictdagen. */
  unresolved: Record<string, string[]>;
  /** taskId → reden van het onopgeloste conflict (parallel aan `unresolved`). */
  unresolvedReasons: Record<string, LevelingReason>;
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

// Float-tolerantie: dag-granulaire eenheden zijn honderdsten (largestRemainderRound); een
// kleine epsilon voorkomt dat 1.0000000001 > 1.0 een fantoomconflict oplevert.
const EPS = 1e-9;

// Harde bovengrens voor de kandidaat-scan wanneer er een poolitem-grootboek MET
// horizon is meegegeven (`ledger.horizonIso`) — die kan de scan voorbij de gewone, taak-eigen
// `scanLimit` duwen. Zelfde orde als `CalendarEngine`s eigen `MAX_DAYS`-veiligheidsgrens.
const HARD_SCAN_CAP = 200_000;

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
    return { delays: {}, unresolved: {}, unresolvedReasons: {}, shifts: {}, projectEndBefore: end, projectEndAfter: end, gaps: {} };
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
    const ls = parseDate(baseLs(id));
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
    const lf = parseDate(baseLf(id));
    const ceilingDays = options.overrunCeilingDays;
    if (ceilingDays === undefined) return options.constrainToFloat ? lf : null;
    const t = taskById.get(id)!;
    const ceiling = t.time.durationType === 'ELAPSEDTIME'
      ? addCalendarDays(lf, ceilingDays)
      : engineForTask(t).addWorkingDaysSigned(lf, ceilingDays);
    return options.constrainToFloat && lf < ceiling ? lf : ceiling;
  };

  // Dagenset die `task`, gestart op `startDate`, daadwerkelijk boekt — GEDEELD door de
  // kandidaat-capaciteitscheck in `findSlot` én de uiteindelijke boeking in `bookDemandAt`, zodat
  // conflictdetectie en boeking (voor split-/afwijkende-kalendertaken) dezelfde dagen zien. Eén
  // functie, twee afnemers — hetzelfde patroon als `distributeUnits` voor het histogram/de leveler.
  //
  // ELAPSEDTIME: de spanne komt uit de VERSE baseline (`baseline.tasks.get`, dezelfde bron als
  // `baseEs`/`baseLs` hierboven), NIET de mogelijk-STALE `task.time.earlyStart/earlyFinish` — die
  // velden zijn exact de "stale na een taakwijziging zonder F5"-categorie waar deze module elders al
  // tegen guardt (zie de `cpmOptions`-toelichting hierboven). De KALENDERSPANNE (van earlyStart tot
  // earlyFinish) blijft bij een verschuiving gelijk aan de baseline-spanne — het AANTAL werkdagen
  // daarbinnen NIET per se (dat hangt af van welke kalenderdagen in de VERSCHOVEN spanne toevallig op
  // een werkdag vallen), vandaar dat hieronder de spanne zelf (niet een werkdagentelling) getransleerd
  // wordt over de kalenderdagen-offset tussen `startDate` en de baseline-`earlyStart`.
  //
  // Een lege/onparseerbare datum (bv. na een handgemaakte MCP/JSON-invoer) levert GEEN boeking op
  // (`[]`) — de taak wordt overgeslagen, zoals de baseline-solve zelf ook degradeert — i.p.v. een
  // `RangeError` verderop in `formatDate`/`toISOString` op een Invalid Date.
  // VOLTOOID: dezelfde vorm als de ELAPSEDTIME-tak, samengevoegd tot één conditie — earlyFinish is
  // voor zo'n taak niet stale maar GEZAGHEBBEND (CPMSolver.forwardPass's VOLTOOID-tak plant
  // onvoorwaardelijk op actualStart/actualFinish), zie het BESLUIT bij `ResourceLoad.ts`'s docblok
  // (die twee functies delen exact deze conditie). Voor een voltooide taak boekt de leveler ALTIJD op haar eigen (ongeschoven)
  // positie — zie `fixedLoadIds` hieronder — dus `shiftDays` is hier in de praktijk 0, maar de
  // vertaalde vorm wordt bewust hergebruikt i.p.v. een aparte kale variant: één formule, geen tweede
  // die stil kan afdrijven.
  const isCompletedTask = (task: Task): boolean => isPinnedComplete(task.time);
  // IN UITVOERING: dezelfde `isPinnedInProgress` als de TWEEDE voortgangs-conditie van
  // CPMSolver.forwardPass — díe tak plant, net als de VOLTOOID-tak, onvoorwaardelijk op
  // actualStart/restwerk en raadpleegt `levelingDelay` nooit. Een taak in uitvoering is dus EVENZEER
  // onverplaatsbaar: een delay zou een stille no-op zijn en het conflict stil laten herleven.
  const isInProgressTask = (task: Task): boolean => isPinnedInProgress(task.time);
  // BREED (voor `fixedLoadIds` hieronder): VOLTOOID ÓF IN UITVOERING — beide takken in
  // `CPMSolver.forwardPass` negeren `levelingDelay`, dus beide horen NOOIT een delay te krijgen en
  // WEL als vaste last te boeken.
  const isImmovableTask = (task: Task): boolean => isCompletedTask(task) || isInProgressTask(task);
  // `occurrenceFor` wordt in de kandidaat-scan van `findSlot` per kandidaatdag
  // opnieuw berekend, en daarna nóg eens door `bookDemandAt` voor de gekozen dag — telkens een
  // volledige `splitDayPattern` + kalenderwandeling. Het antwoord hangt uitsluitend af van
  // (taak, startdag) en beide zijn binnen één `levelResources`-aanroep onveranderlijk, dus
  // memoiseren is zuiver. UITZONDERING: de onderbreek-modus (`allowSplits`) kent een taak
  // NIEUWE `splitGaps` toe tijdens de run — die MOET daarna `occCache.delete(...)` voor die taak
  // doen; zie de aanroepplek daar.
  const occCache = new Map<string, string[]>();
  const computeOccurrence = (task: Task, startDate: Date): string[] => {
    const taskEngine = engineForTask(task);
    // SMAL op `isCompletedTask` — BEWUST NIET samengevoegd met `isInProgressTask`: voor een
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
  const occurrenceFor = (task: Task, startDate: Date): string[] => {
    if (isNaN(startDate.getTime())) return []; // niet cachen: geen sleutel te maken
    const key = `${task.id}|${formatDate(startDate)}`;
    const hit = occCache.get(key);
    if (hit) return hit;
    const result = computeOccurrence(task, startDate);
    occCache.set(key, result);
    return result;
  };

  // Dagvraag per taak per geselecteerde resource: som van distributeUnits over alle assignments
  // van die taak op die resource (multi-assignment naar dezelfde resource telt op).
  // Dezelfde `assignmentDayUnits` als het histogram — opgeslagen contour of exacte curve als data,
  // anders de `distributeUnits`-formule.
  const contourOf = contourLookup(assignments);
  const demandByTask = new Map<string, Map<string, number[]>>();
  for (const a of assignments) {
    if (!selectedIds.has(a.resourceId)) continue;
    const task = taskById.get(a.taskId);
    if (!task || task.isMilestone || isSummaryTask(task)) continue;
    const dur = task.time.scheduleDuration;
    if (dur <= 0) continue;
    const arr = assignmentDayUnits(task, a, engineForTask(task).hoursPerDay * 60, contourOf(task, a));
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
  // uitvoering — `isImmovableTask`) vs. BUITEN SCOPE vs.
  // geen vraag op selectie. Een out-of-scope taak is nóg strenger dan vastgepind: ze schuift niet,
  // ze volgt geen voorgangers, ze boekt op haar eigen (BEHOUDEN) baselinepositie — vandaar vóór alle
  // andere checks. Zo'n taak is geen "vastgepind" (priority 1000, volgt nog wél voorgangers via PF)
  // — ze is nog strenger: ze staat ONVOORWAARDELIJK op haar actuals/restwerk, ongeacht priority, en
  // gaat dus NOOIT door `findSlot` OF het pinned-pad. Zie `fixedLoadIds` hieronder voor de boeking.
  const hasDemand = (id: string) => demandByTask.has(id);
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

  // Boek de dagvraag van een taak af vanaf een gegeven startdag — via `occurrenceFor` hierboven
  // (dezelfde dagenset als `findSlot`s capaciteitscheck, zodat conflictdetectie en boeking niet uit
  // elkaar lopen).
  // `toPoolLedger` bepaalt of deze boeking OOK in het gedeelde poolitem-
  // grootboek komt. De per-resource boeking (`book(resId, ...)`) blijft ONVOORWAARDELIJK (bestaand
  // — ook een onopgeloste taak boekt op haar project-grootboek, zodat het conflict zichtbaar
  // blijft); alleen de POOL-boeking is voorwaardelijk: "niet-plaatsbaar = tekort, geen cascade".
  // `occOverride` — de onderbreek-modus zet de nieuwe leveling-gaten pas op de
  // WERKKOPIE (`workById`) NA het `findSlot`-resultaat; zonder deze override zou de boeking dus de
  // OUDE (ongescatterde) dagenset gebruiken. De scatter-aanroepplek geeft de al-gekozen dagen
  // rechtstreeks door en slaat `occurrenceFor` zo over.
  // `task` komt uit `workById`, niet `taskById` — voor een IN-SCOPE taak is dat de GESTRIPTE
  // baseline (zie `stripLevelingGaps` hierboven); voor een taak BUITEN de scope is `workById` een
  // spread van `taskById` (dezelfde `splitGaps`-array-referentie). Anders zou een leveling-gat uit
  // een VORIGE nivellering hier als brondata gelezen worden.
  const bookDemandAt = (taskId: string, startDate: Date, toPoolLedger: boolean, occOverride?: string[]): string[] => {
    const task = workById.get(taskId)!;
    const occ = occOverride ?? occurrenceFor(task, startDate);
    const byRes = demandByTask.get(taskId)!;
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
  //  - ELAPSEDTIME-kandidaten stappen per KALENDERdag (`nextCandidateAfterFor`), niet per werkdag —
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
    bookDemandAt(id, parseDate(startIso), true);
    placedStartIso.set(id, startIso);
  }

  const delays: Record<string, number> = {};
  const unresolved: Record<string, string[]> = {};
  const unresolvedReasons: Record<string, LevelingReason> = {};
  // TaskId → de volledige, te schrijven `splitGaps`-waarde (bestaande
  // importsplits + eventuele nieuwe leveling-gaten). Alleen gezet voor taken die daadwerkelijk via
  // `findSlot`s scatter-tak geplaatst zijn — zonder `allowSplits` blijft dit `{}`.
  const gapsOut: Record<string, TaskSplitGap[]> = {};

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
    let scatterDays: string[] | undefined;
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
      slotUnresolved = slot.unresolved;
      slotReason = slot.reason;
      // `findSlot` leverde een dag-voor-dag (onderbroken) plaatsing i.p.v. een aaneengesloten
      // venster. De gaten moeten op de WERKKOPIE staan VÓÓR de proef-solve aan het eind van deze
      // functie — anders belooft `projectEndAfter` een einddatum die de echte
      // `applyLeveling` → `runCPM` straks nooit haalt — en ná de PF-berekening van déze taak (die
      // ging al over de start, niet de spanne). Vandaar hier, meteen na de `findSlot`-aanroep.
      if (slot.scatterDays) {
        scatterDays = slot.scatterDays;
        const mpd = engineForTask(pickedTask).hoursPerDay * 60;
        // Stapel op de GESTRIPTE werkkopie (`workById`), niet op de originele
        // taak (`pickedTask`, uit `taskById`) — anders komen de leveling-gaten van de VORIGE
        // nivellering alsnog in dit resultaat terecht (accumulatie in plaats van herschrijven).
        const workCopy = workById.get(pick)!;
        const newGaps: TaskSplitGap[] = [
          ...(workCopy.splitGaps ?? []),
          ...splitGapsFromWorkDayBlocks(blocksFromDays(scatterDays, engineForTask(pickedTask)), mpd, 'leveling'),
        ];
        workById.get(pick)!.splitGaps = newGaps; // ⇒ de proef-solve ziet de opgerekte spanne
        gapsOut[pick] = newGaps;                 // ⇒ komt in LevelingResult.gaps
        // Memo: deze taak kreeg een NIEUWE dagenset tijdens de run — wis haar cache-
        // entries, anders valt een latere aanroep op de oude (voor-scatter) dagenset.
        for (const key of [...occCache.keys()]) if (key.startsWith(`${pick}|`)) occCache.delete(key);
      }
    }

    // "Niet-plaatsbaar = tekort per document, geen cascade" — alleen een taak die daadwerkelijk een passend venster kreeg (`slotUnresolved`
    // leeg) boekt in het GEDEELDE poolitem-grootboek. Vastgepinde taken (priority 1000) scannen niet
    // (`slotUnresolved` blijft hun default `[]`) en boeken dus WÉL — correct: ze bezetten de pool
    // ongeacht of dat past. Dat het restprofiel daardoor op 0 geklemd kan raken terwijl er
    // feitelijk overboeking is, is geen motorprobleem: dat is een tekort op poolniveau, voor de
    // verdeler.
    bookDemandAt(pick, startDate, slotUnresolved.length === 0, scatterDays);
    placedStartIso.set(pick, formatDate(startDate));
    // Gemeten in DEZELFDE eenheid als `CPMSolver.forwardPass`'s `shiftByLevelingDelay`
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
    // Een meting in werkdagen voor ELAPSEDTIME zou een andere afstand geven dan
    // `shiftByLevelingDelay` bij toepassing verschuift (`check-leveler-splits.ts`, ELAPSEDTIME-delay).
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
    shifts[t.id] = { oldStart: cur, newStart: tr, delta };
  }

  return {
    delays,
    unresolved,
    unresolvedReasons,
    shifts,
    projectEndBefore: cpmResult.projectEnd,
    projectEndAfter,
    gaps: gapsOut,
  };

  // --- lokale helpers (sluiten over booked/demandByTask/capacityOf) ---

  /** Scan vanaf PF dag-voor-dag naar de eerste kandidaat waarop elke benodigde resource genoeg
   *  restcapaciteit heeft voor de volle (split-/taakkalender-bewuste) dagvraag. `ls` != null
   *  (smoothing) begrenst het venster; geen slot binnen het venster → blijf op de gesnapte PF (mét
   *  conflict) en meld de conflictdagen + reden.
   *
   *  Twee assen moeten gelijk lopen met de rest van de nivelleerder:
   *   - de kandidaat-AS (`cand`/`next`) loopt via `nextCandidateFor`/`nextCandidateAfterFor` —
   *     dezelfde taakkalender/ELAPSEDTIME-kalenderdagen-as als de delay-meting in de hoofdlus
   *     (anders een spookvertraging bij nul druk voor een taak op een afwijkende kalender);
   *   - de dagenset per kandidaat (`occ`) komt uit `occurrenceFor`, GEDEELD met `bookDemandAt`,
   *     zodat `calendarOk`/`reasonFor`/de conflictdagenlijst geen dagen noemen waarop de taak niet
   *     werkt. */
  function findSlot(
    taskId: string,
    pf: Date,
    limit: Date | null,
  ): { start: Date; unresolved: string[]; reason?: LevelingReason; scatterDays?: string[] } {
    // `task` komt uit `workById`, niet `taskById` — `findSlot` wordt uitsluitend
    // aangeroepen voor movable/vastgepinde (dus per definitie IN-SCOPE) taken, dus dit is precies de
    // GESTRIPTE baseline. Zonder deze wissel zou `occurrenceFor` hieronder (via `computeOccurrence`)
    // een leveling-gat uit een VORIGE nivellering als brondata lezen — de kandidaat-scan zou dan een
    // gesplitste dagenset toetsen in plaats van de schone aaneengesloten baseline waar deze functie
    // vanuit gaat, en de idempotentie zou stuklopen. Zie `bookDemandAt`
    // hierboven voor dezelfde wissel en dezelfde motivering.
    const task = workById.get(taskId)!;
    const byRes = demandByTask.get(taskId)!;

    // Reset de reden-sturing bij elke aanroep — zie de declaratie hierboven bij `booked`/`bookedOn`.
    // Zonder grootboek (`ledger === undefined`) blijft dit `false`, dus de RESIDUAL_FULL-tak in
    // `reasonFor` wordt nooit geraakt.
    poolBlockedOnly = ledger !== undefined;

    let cand = nextCandidateFor(task, pf);

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
      const occ = occurrenceFor(task, cand);
      if (!calendarFeasibleSeen && calendarOk(byRes, occ)) calendarFeasibleSeen = true;
      // Een LEEG kandidaatvenster (`occ.length === 0`) telt NIET als passend.
      // `fits` is triviaal waar op een lege dagenset (de binnenlus over `occ` loopt gewoon nul keer),
      // en omdat ELAPSEDTIME-kandidaten per KALENDERdag stappen kan een korte elapsed-spanne
      // volledig in een weekend vallen — dan levert `occurrenceFor` `[]` (geen enkele projectkalender-
      // werkdag in die spanne). Zonder deze guard "past" de taak daar, wordt ze daar geplaatst, en
      // verdwijnt haar vraag stilzwijgend uit het boekhoudgrootboek (niets wordt geboekt, want
      // `bookDemandAt` boekt ook via `occurrenceFor` en loopt dus over dezelfde lege set). BEWUST NIET `calendarOk` als extra voorwaarde: die is STRENGER dan nodig — hij
      // eist dat ELKE vraagdag een resource-werkdag heeft, wat geval 4's bewuste min-klem (een
      // vraag-array die langer is dan `occ`, `i < arr.length && i < occ.length`) ten onrechte zou laten
      // afketsen. `occ.length > 0` is de minimale, correcte voorwaarde: er moet gewoon IETS te boeken zijn.
      if (occ.length > 0 && fits(byRes, occ)) return { start: cand, unresolved: [] };
      const next = nextCandidateAfterFor(task, cand);
      if (limit && next > limit) break; // venstergrens (float/plafond) — geen slot, geen horizon-uitputting
      // De venstergrens (hierboven) wint van de horizon — een plafond is een gebruikerskeuze, de
      // horizon een rekengrens. Zonder grootboek-horizon (`horizonDate === null`) stopt dit exact bij
      // `guard === scanLimit`.
      if (guard >= scanLimit && !(horizonDate && next <= horizonDate)) { horizonExhausted = true; break; }
      cand = next;
    }
    if (guard >= HARD_SCAN_CAP) horizonExhausted = true; // vangrail: ook dít is een uitputting, geen venstergrens

    // ── Onderbreek-modus ─────────────────────────────────────────────────────────────────────────
    // Er is geen AANEENGESLOTEN venster gevonden. Mag de taak onderbroken worden, dan plaatsen we
    // haar dag-voor-dag: loop vanaf de gesnapte PF over de kandidaat-werkdagen en neem telkens de
    // eerstvolgende dag waarop de vraag van de VOLGENDE curve-index past. De overgeslagen werkdagen
    // ertussen worden de pauzedagen. Greedy van links naar rechts — bewust GEEN zoektocht over
    // kandidaatstanden: het greedy-antwoord is per constructie de
    // vroegst mogelijke onderbroken plaatsing. Gebonden door `finishWindowLimit` (de FINISH-versie
    // van het plafond, niet de start-`limit` hierboven) — zie het docblok daar.
    if (splitEligible(task)) {
      const scatter = scatterSlot(taskId, pf, finishWindowLimit(taskId));
      // Een LEGE dagenset is geen plaatsing. `scatterSlot` geeft
      // `[]` terug zodra `need === 0` (`chosen.length === need` is dan meteen waar), en `[]` is
      // truthy — `parseDate(scatterDays[0])` zou er een Invalid Date van maken, die als `start` de
      // hele hoofdlus in reist (delay-meting, boeking, shifts). Niets plaatsen hoort door te vallen
      // naar het "geen slot"-vangnet hieronder.
      if (scatter.days && scatter.days.length > 0) {
        return { start: parseDate(scatter.days[0]), unresolved: [], scatterDays: scatter.days };
      }
      // De scatter is de LAATSTE poging. Liep díé op de zoekhorizon
      // leeg — en niet op de venstergrens — dan is de horizon de eerlijke reden, ook wanneer de
      // aaneengesloten scan hierboven nog netjes op het venster stopte. Zonder deze regel valt de
      // uitputting stil weg en verzint `reasonFor` een capaciteits-/plafonddiagnose.
      if (scatter.horizonExhausted) horizonExhausted = true;
    }

    // Geen slot: blijf op de gesnapte PF, verzamel de conflictdagen (waar de vraag de restcapaciteit
    // overschrijdt) — dezelfde dagenset (`occurrenceFor`) als de boeking straks zou gebruiken.
    const snappedPf = nextCandidateFor(task, pf);
    const occ = occurrenceFor(task, snappedPf);
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
        if (bookedOn(resId, occ[i]) + arr[i] > capacityOf(resId, occ[i]) + EPS) conflicts.push(occ[i]);
        else if (poolItem !== null && arr[i] > ledger!.residualOn(poolItem, occ[i]) + EPS) conflicts.push(occ[i]);
      }
    }
    return {
      start: snappedPf,
      unresolved: [...new Set(conflicts)].sort(),
      reason: reasonFor(byRes, calendarFeasibleSeen, ceilingSet, ceilingUnreachable, horizonExhausted),
    };
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
    for (const [resId, arr] of byRes) {
      const peak = arr.length > 0 ? Math.max(...arr) : 0;
      if (peak > maxCapacityOf(resId) + EPS) return 'INTRINSIC_OVERRUN';
    }
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
        if (bookedOn(resId, occ[i]) + arr[i] > capacityOf(resId, occ[i]) + EPS) { poolBlockedOnly = false; return false; }
        if (poolItem !== null && arr[i] > ledger!.residualOn(poolItem, occ[i]) + EPS) return false;
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

  /** Past curve-index `i` van deze taak op dag `iso`? Zelfde twee toetsen als `fits` (projectinzet
   *  én poolitem-grootboek), maar voor één index/één dag — de dag-voor-dag-tegenhanger van `fits`s
   *  aaneengesloten-venstercheck. */
  function dayFits(byRes: Map<string, number[]>, i: number, iso: string): boolean {
    for (const [resId, arr] of byRes) {
      if (i >= arr.length) continue; // geen vraag op deze curve-index voor deze resource
      const amt = arr[i];
      if (amt <= 0) continue;
      if (bookedOn(resId, iso) + amt > capacityOf(resId, iso) + EPS) return false;
      const poolItem = ledger ? ledger.poolItemOf(resId) : null;
      if (poolItem !== null && amt > ledger!.residualOn(poolItem, iso) + EPS) return false;
    }
    return true;
  }

  /** Dag-voor-dag-plaatsing. Geeft de gekozen werkdagen (ISO, oplopend) in
   *  `days`, of `days: null` wanneer er binnen het venster geen volledige set te vinden is.
   *  `finishLimit` begrenst de LAATSTE dag (niet de start): met onderbrekingen groeit de FINISH van
   *  de taak, en dát is wat het plafond moet binden (zie `finishWindowLimit`).
   *
   *  `horizonExhausted` spiegelt de gelijknamige vlag in `findSlot`: liep deze scan leeg op de ZOEKHORIZON (`scanLimit`, evt. verlengd door de
   *  grootboekhorizon) in plaats van op de venstergrens, dan is dat een REKENgrens en geen
   *  capaciteits- of plafondprobleem. Zonder deze terugmelding krijgt de gebruiker
   *  CEILING_TOO_TIGHT/INSUFFICIENT_CAPACITY te zien in plaats van NO_WINDOW_IN_HORIZON — een
   *  diagnose die hem naar het verkeerde knopje stuurt. */
  function scatterSlot(
    taskId: string, pf: Date, finishLimit: Date | null,
  ): { days: string[] | null; horizonExhausted: boolean } {
    // `task` komt uit `workById`, zelfde wissel als `findSlot`/`bookDemandAt`
    // hierboven, voor consistentie — `scatterSlot` leest hier geen `splitGaps`, maar de
    // gedeelde bron voorkomt dat een latere uitbreiding stilzwijgend weer op de ongestripte
    // `taskById` gaat leunen.
    const task = workById.get(taskId)!;
    const byRes = demandByTask.get(taskId)!;
    // LET OP — uur-modus: `task.time.scheduleDuration`
    // is voor een uur-modus-taak GEEN geheel getal in het algemeen — `distributeUnits`
    // (ResourceLoad.ts) rondt dat AL af naar boven tot curve-SLOTS (de `for (let i = 0; i <
    // durationDays; i++)`-lus loopt door tot de volgende hele dag), dus `demandByTask`s array-lengte
    // is altijd de juiste GEHELE werkdagen-telling, voor dag- én uur-modus. `need` moet daarom het
    // AANTAL CURVE-SLOTS zijn, NOOIT de rauwe `scheduleDuration` rechtstreeks — anders stopt de
    // scatter-lus (`chosen.length < need`) voortijdig bij een fractioneel plafond. Voor dag-modus is
    // `scheduleDuration` al een geheel getal. De `Math.ceil(...)`-fallback dekt alleen het theoretische geval zonder enige vraag op
    // een geselecteerde resource (`byRes` leeg) — `splitEligible` wordt normaliter pas bereikt nadat
    // `hasDemand` al vraag bevestigde, dus dit pad is defensief.
    const need = byRes.values().next().value?.length ?? Math.ceil(task.time.scheduleDuration);
    // Zonder `finishLimit` (geen plafond, geen constrainToFloat) zou deze lus alleen `HARD_SCAN_CAP`
    // als rem hebben — 200.000 kandidaatdagen mét een volledige `dayFits` per dag. Zelfde tweetrapsgrens als
    // `findSlot`: `scanLimit` is de gewone ondergrens (afgeleid van de eigen taakduren), en een
    // grootboekhorizon mag hem verlengen omdat externe vaste last het eerste vrije venster voorbij
    // die ondergrens kan duwen. `HARD_SCAN_CAP` blijft uitsluitend de vangrail.
    const horizonDate = ledger?.horizonIso ? parseDate(ledger.horizonIso) : null;
    const chosen: string[] = [];
    let cand = nextCandidateFor(task, pf);
    let guard = 0;
    let horizonExhausted = false;
    while (chosen.length < need && guard++ < HARD_SCAN_CAP) {
      // Venstergrens (het FINISH-plafond) — een gebruikerskeuze, GEEN horizon-uitputting. Zelfde
      // rangorde als in `findSlot`: de venstergrens wint van de horizon.
      if (finishLimit && cand > finishLimit) return { days: null, horizonExhausted: false };
      const iso = formatDate(cand);
      if (dayFits(byRes, chosen.length, iso)) chosen.push(iso);
      if (chosen.length >= need) break; // compleet — geen horizon-toets meer op een dag die we niet gebruiken
      const next = nextCandidateAfterFor(task, cand);
      // Exact dezelfde vorm als `findSlot` — `guard >= scanLimit` getoetst NÁ de kandidaat en tegen
      // de VOLGENDE kandidaat — zodat de twee lussen niet uit elkaar lopen en de uitputting gemeld wordt.
      if (guard >= scanLimit && !(horizonDate && next <= horizonDate)) { horizonExhausted = true; break; }
      cand = next;
    }
    if (guard >= HARD_SCAN_CAP) horizonExhausted = true; // vangrail: ook dít is een uitputting
    return { days: chosen.length === need ? chosen : null, horizonExhausted };
  }

  /** Werk/gat-blokken (hele werkdagen) uit een oplopende lijst GEKOZEN ISO-werkdagen — de
   *  tegenhanger van `scatterSlot`: hoeveel werkdagen van `engine` zijn er tussen elke opeenvolgende
   *  gekozen dag overgeslagen? Voedt `splitGapsFromWorkDayBlocks`. */
  function blocksFromDays(days: string[], engine: CalendarEngine): Array<{ work: number; gap: number }> {
    const blocks: Array<{ work: number; gap: number }> = [];
    let work = 0;
    let cursor: Date | null = null;
    for (const iso of days) {
      const d = parseDate(iso);
      if (cursor === null) {
        work = 1;
      } else {
        // Werkdagen STRIKT tussen `cursor` en `d`: `workDaysBetween` telt beide grenzen inclusief
        // (dezelfde conventie als de delay-meting hierboven), dus −2 geeft het aantal ertussen.
        const gapDays = engine.workDaysBetween(cursor, d) - 2;
        if (gapDays > 0) {
          blocks.push({ work, gap: gapDays });
          work = 1;
        } else {
          work += 1; // aaneengesloten met de vorige gekozen dag — geen gat
        }
      }
      cursor = d;
    }
    blocks.push({ work, gap: 0 });
    return blocks;
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
  return r ? parseDate(r.earlyStart) : parseDate(workTasks.find(t => t.id === taskId)!.time.earlyStart);
}
