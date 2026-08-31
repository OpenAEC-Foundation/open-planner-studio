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
import type { Task, TaskSplitGap } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { CPMSolver, type CPMResult, type CPMOptions } from './CPMSolver';
import { distributeUnits, maxUnitsOn, enumerateWorkDays } from './ResourceLoad';
import { enumerateTaskWorkDays, splitGapsFromWorkDayBlocks } from './splitWalk';
import { parseDate, formatDate, addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';

/**
 * Het GEDEELDE poolitem-grootboek (spec §4, "twee grootboeken"). De motor toetst per `resourceId`
 * tegen de eigen projectinzet; dit grootboek voegt de tweede toets toe: de restcapaciteit van het
 * BIBLIOTHEEK-poolitem waaraan de resource via zijn `libraryOrigin`-stempel hangt.
 *
 * "Beide toetsen moeten slagen" is identiek aan de `min(projectinzet, poolrest)`-formulering elders
 * in de spec — twee schrijfwijzen van dezelfde regel, geen tegenspraak.
 *
 * De implementatie hiervan woont bij de aanroeper (de verdeler, `services/library/distribute.ts`) en
 * is bewust NIET van de motor: hij is gedeeld over meerdere documenten, en de motor draait per
 * document. Injecteerbaar dus, zelfde patroon als `OccupancyEphemeralSolve` in `occupancy.ts`.
 */
export interface LevelingPoolLedger {
  /** Het poolitem waaraan `resourceId` hangt, of `null` wanneer deze resource geen
   *  bibliotheekstempel heeft — dan geldt alleen de gewone per-resource-toets. */
  poolItemOf(resourceId: string): string | null;
  /** Restcapaciteit van dat poolitem op die dag. ALTIJD ≥ 0 (de implementatie klemt; spec §4). */
  residualOn(poolItemId: string, iso: string): number;
  /** Boek geplaatste vraag terug. UITSLUITEND aangeroepen voor een taak die daadwerkelijk een
   *  passend venster kreeg — een niet-plaatsbare taak boekt NIET (spec §4 stap 3: anders wordt het
   *  restprofiel negatief en cascadeert het tekort naar elk volgend document). */
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
   *  altijd uit gefilterd, ook als het expliciet meegegeven wordt (§5.3). */
  resourceIds?: string[];
  /** Alleen deze taken mogen (opnieuw) genivelleerd worden. Taken BUITEN de scope behouden hun
   *  bestaande `levelingDelay`/`splitGaps` en tellen mee als VASTE LAST op hun huidige, genivelleerde
   *  positie — ze worden nooit verschoven en verschijnen nooit in `delays`. Afwezig ⇒ alle taken
   *  (byte-identiek met het gedrag van vóór B1c-etappe-2).
   *
   *  Waarom dit bestaat (spec §5): de verdeler nivelleert per POOLITEM. De taken die niets met dat
   *  poolitem te maken hebben moeten precies blijven staan waar ze staan — anders lost B1c een
   *  bibliotheekconflict op door het hele document te herschikken. */
  scopeTaskIds?: string[];
  /** Maximale uitloop van de projecteinddatum, in werkdagen t.o.v. de HUIDIGE (mét bestaande
   *  nivellering berekende) planning — spec §4, "Plafond-referentiepunt". De motor vertaalt dit naar
   *  een per-taak-venster `lateStart + N` op de TAAKkalender (ELAPSEDTIME: kalenderdagen, zelfde as
   *  als `shiftByLevelingDelay`). `0` ⇒ identiek aan `constrainToFloat: true`: de einddatum staat
   *  vast maar de float mag benut worden. Afwezig ⇒ onbegrensd (bestaand leveling-gedrag).
   *  Staat `constrainToFloat` óók aan, dan wint het STRENGSTE venster. */
  overrunCeilingDays?: number;
  /** B1c-plan-2 taak 6: het gedeelde poolitem-grootboek — zie `LevelingPoolLedger` hierboven.
   *  Afwezig ⇒ alleen de bestaande per-resource-toets (byte-identiek met het gedrag van vóór
   *  B1c-etappe-2). */
  poolLedger?: LevelingPoolLedger;
  /** B1c-plan-2 taak 9: "Onderbrekingen toestaan" (spec §4 stap 0; MS Project: *Leveling can create
   *  splits in remaining work*). `false`/afwezig ⇒ bestaand gedrag: een taak wijkt alleen als GEHEEL
   *  (uitloop). `true` ⇒ de nivelleerder mag pauzedagen invoegen wanneer er geen aaneengesloten
   *  venster past — MAAR uitsluitend als FALLBACK, ná een mislukte aaneengesloten scan (zie
   *  `findSlot`); zonder een bindend venster (`overrunCeilingDays`/`constrainToFloat`) vindt die scan
   *  op den duur altijd een aaneengesloten gat, dus deze optie is in de praktijk gekoppeld aan een
   *  plafond.
   *
   *  V1-GRENS (bewust, zie het plan bij taak 9 — verbreed 2026-08-31): taken met
   *  `durationType === 'WORKTIME'` en `completion === 0` komen ervoor in aanmerking, ONGEACHT
   *  `durationUnit` — dag- én uur-modus. Een ingevoegde pauze is en blijft ALTIJD een hele werkdag,
   *  ook op een uur-modus-taak (de gaten-machinerie zelf blijft dag-granulair); alleen de SPANNE rekt,
   *  nooit de vraag. ELAPSEDTIME blijft uitgesloten (geen werkdagbegrip), en MSP's eigen formulering
   *  is "splits in REMAINING work" — een gestarte taak wijkt uitsluitend via uitloop. */
  allowSplits?: boolean;
}

/** Reden waarom een taak onopgelost bleef (A3, deze golf) — de nivelleer-dialoog kiest hierop de
 *  bijpassende uitleg. Uitgebreid in B1c-plan-2 (taken 4/5) met een eerlijkere taxonomie: een
 *  onbereikbaar/te krap plafond en een uitgeputte scanhorizon zijn geen "onvoldoende capaciteit". */
export type LevelingReason =
  | 'CALENDAR_MISMATCH' | 'INSUFFICIENT_CAPACITY' | 'INTRINSIC_OVERRUN'
  /** Het uitloop-plafond laat te weinig ruimte: binnen `lateStart + plafond` is geen venster vrij. */
  | 'CEILING_TOO_TIGHT'
  /** Uitloop geven helpt hier niet: een deadline/backward-constraint duwt het venster vóór de
   *  precedence-feasible start — de taak kan zelfs zónder capaciteitsdruk niet binnen het plafond. */
  | 'CEILING_UNREACHABLE'
  /** De kandidaat-scan liep leeg vóórdat er een passend venster gevonden was. Sinds C1/C2 is
   *  `scanLimit` een ONDERGRENS-argument (zie het blok bij `scanLimit`), dus dit is een reële
   *  uitkomst en geen "onvoldoende capaciteit" — de motor weet simpelweg niet of er verderop nog
   *  ruimte is. */
  | 'NO_WINDOW_IN_HORIZON'
  /** De eigen projectinzet had ruimte, maar de RESTcapaciteit van het bibliotheek-poolitem is op —
   *  andere documenten bezetten de pool (spec §4-taxonomie, B1c-plan-2 taak 6). */
  | 'RESIDUAL_FULL';

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
  /** B1c-plan-2 taak 9: taskId → de door de nivelleerder INGEVOEGDE werkonderbrekingen, inclusief de
   *  importsplits die de taak al droeg (de volledige, te schrijven `splitGaps`-waarde — niet alleen
   *  het verschil). Alleen aanwezig voor taken die daadwerkelijk een leveling-gat kregen;
   *  `applyLeveling` schrijft dit veld pas in etappe 3. Zonder `allowSplits` blijft dit altijd `{}`
   *  (byte-identiek). */
  gaps: Record<string, TaskSplitGap[]>;
}

// Float-tolerantie: dag-granulaire eenheden zijn honderdsten (largestRemainderRound, §4.1); een
// kleine epsilon voorkomt dat 1.0000000001 > 1.0 een fantoomconflict oplevert.
const EPS = 1e-9;

// B1c-plan-2 taak 6: harde bovengrens voor de kandidaat-scan wanneer er een poolitem-grootboek MET
// horizon is meegegeven (`ledger.horizonIso`) — die kan de scan voorbij de gewone, taak-eigen
// `scanLimit` (L4) duwen. Zelfde orde als `CalendarEngine`s eigen `MAX_DAYS`-veiligheidsgrens.
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
  /** Werkt de resource op die dag volgens ZIJN kalender? Puur de kalender-uitlijning, ONGEACHT hoeveel
   *  eenheden hij die dag te bieden heeft (B1c-plan-2 taak 5, spec §4: met een restprofiel is 0 de
   *  normale waarde van een volle dag, en ook zonder restprofiel is `maxUnits: 0` een capaciteits- en
   *  geen kalenderprobleem). `capacityOf` hierboven blijft de gecombineerde waarde — die is voor
   *  `fits` precies goed. */
  const isResWorkDay = (resId: string, iso: string): boolean => {
    const eng = engineByRes.get(resId);
    return !!eng && eng.isWorkDay(parseDate(iso));
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

  // Scope (B1c-plan-2 taak 3, spec §5 "scope-behoudend toepassen"). `null` = alles in scope; dat is
  // het bestaande gedrag. Een taak BUITEN de scope wordt behandeld als vaste last op haar HUIDIGE
  // (mogelijk al genivelleerde) positie — zie de selectieve strip hieronder en de indelingslus.
  const scope = options.scopeTaskIds ? new Set(options.scopeTaskIds) : null;
  const inScope = (id: string): boolean => scope === null || scope.has(id);

  // B1c-plan-2 taak 6: het gedeelde poolitem-grootboek (of `undefined` — dan is dit hele blok een
  // no-op en blijft de motor byte-identiek aan vóór deze taak). Gelezen door `fits`, `bookDemandAt`
  // en `findSlot` (inclusief zijn conflictverzamelaar), allemaal verderop in deze functie.
  const ledger = options.poolLedger;

  // Werkkopie ZONDER levelingDelays — voor taken IN scope. Voedt (a) de VERSE baseline-solve
  // (sorteersleutels/PF/vensters, A2/A4) en (b) — nadat de lus de delays erop gezet heeft — de
  // proef-solve voor de preview (A1).
  // B1c-plan-2 taak 1 (M10): ook de sub-dag-precisie (`levelingDelayMinutes`/`levelingDelayElapsed`)
  // strippen — `CPMSolver.shiftByLevelingDelay` leest die VÓÓR `levelingDelay`, dus een
  // `.mpp`-geïmporteerde vertraging op een taak MET voorganger zou hier stil in de baseline blijven
  // staan en zowel de sorteersleutels als de PF vervalsen (zie `check-leveling-delay-units.ts`,
  // deel 2, voor het concrete voorbeeld: het conflict verdween volledig uit beeld).
  // B1c-plan-2 taak 3: een taak BUITEN de scope behoudt haar bestaande delay/sub-dag-precisie — die
  // is nu vaste last, geen te herberekenen sorteersleutel. Dat is precies de spec-plicht die
  // `computePF` moet doorstaan: een opvolger van een out-of-scope taak moet haar VERSCHOVEN
  // (behouden-delay) positie volgen, niet haar ongenivelleerde positie.
  // B1c-plan3 taak 2 (idempotentie-voorwaarde): `splitGaps` hoort symmetrisch bij deze strip — een
  // gat met `source === 'leveling'` is UITVOER van een eerdere nivellering, precies zoals
  // `levelingDelay` dat is. Stond het hier in de baseline, dan las een tweede nivellering het als
  // brondata en legde er nieuwe gaten bovenop — accumulatie in plaats van het idempotente
  // herschrijven dat spec §4 ("Herkomst") eist. IMPORTSPLITS (gaten zónder `source`) zijn wél
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

  // A2/A4: VERSE baseline — de enige bron voor sorteersleutels (totalFloat/earlyStart), PF-basis en
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

  // B1c-plan-2 taak 4: het uitloop-plafond als per-taak-venster, op de VERSE baseline-lateStart
  // (dus mét de behouden out-of-scope-delays uit taak 3 — precies het referentiepunt dat de spec
  // eist: "t.o.v. de huidige opgeslagen projecteinddatum, mét bestaande nivellering"). `0` ⇒
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

  // B1c-plan-2 taak 9: bovengrens voor de LAATSTE werkdag in de onderbreek-modus — spiegelt
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
  // L3 (W0-keuring): `occurrenceFor` wordt in de kandidaat-scan van `findSlot` per kandidaatdag
  // opnieuw berekend, en daarna nóg eens door `bookDemandAt` voor de gekozen dag — telkens een
  // volledige `splitDayPattern` + kalenderwandeling. Het antwoord hangt uitsluitend af van
  // (taak, startdag) en beide zijn binnen één `levelResources`-aanroep onveranderlijk, dus
  // memoiseren is zuiver. UITZONDERING: de onderbreek-modus (taak 9 van dit plan) kent een taak
  // NIEUWE `splitGaps` toe tijdens de run — die MOET daarna `occCache.delete(...)` voor die taak
  // doen; zie de aanroepplek daar.
  const occCache = new Map<string, string[]>();
  const computeOccurrence = (task: Task, startDate: Date): string[] => {
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
  const occurrenceFor = (task: Task, startDate: Date): string[] => {
    if (isNaN(startDate.getTime())) return []; // niet cachen: geen sleutel te maken (I4-precedent)
    const key = `${task.id}|${formatDate(startDate)}`;
    const hit = occCache.get(key);
    if (hit) return hit;
    const result = computeOccurrence(task, startDate);
    occCache.set(key, result);
    return result;
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
  // uitvoering — `isImmovableTask`, eindpoortronde W0/W1) vs. BUITEN SCOPE (B1c-plan-2 taak 3) vs.
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

  // B1c-plan-2 taak 6: reden-sturing. Faalde ELKE afgewezen kandidaat van de huidige `findSlot`-
  // aanroep uitsluitend op het POOLitem-grootboek, dan is de eerlijke uitkomst "restcapaciteit vol
  // — anderen bezetten de pool" (RESIDUAL_FULL), niet het generieke "onvoldoende capaciteit" (dat
  // wijst de gebruiker naar zijn eigen projectinzet, waar niets mis mee is). Gedeeld tussen `fits`
  // en `findSlot` (beide sluiten over deze `levelResources`-scope) — `findSlot` reset 'm bij de
  // start van elke aanroep, `fits` zet 'm op `false` zodra de PROJECTtoets faalt.
  let poolBlockedOnly = false;

  // Geplaatste posities (voor boekhouding/debug): iso-startdag.
  const placedStartIso = new Map<string, string>();

  // Boek de dagvraag van een taak af vanaf een gegeven startdag — via `occurrenceFor` hierboven
  // (I5/I6, kwaliteitsronde taak 4: dezelfde dagenset als `findSlot`s capaciteitscheck gebruikt,
  // zodat conflictdetectie en boeking niet meer uit elkaar kunnen lopen).
  // B1c-plan-2 taak 6: `toPoolLedger` bepaalt of deze boeking OOK in het gedeelde poolitem-
  // grootboek komt. De per-resource boeking (`book(resId, ...)`) blijft ONVOORWAARDELIJK (bestaand
  // gedrag — ook een onopgeloste taak boekt op haar project-grootboek, zodat het conflict zichtbaar
  // blijft); alleen de POOL-boeking is voorwaardelijk — spec §4 stap 3, "niet-plaatsbaar = tekort,
  // geen cascade".
  // B1c-plan-2 taak 9: `occOverride` — de onderbreek-modus zet de nieuwe leveling-gaten pas op de
  // WERKKOPIE (`workById`) NA het `findSlot`-resultaat; zonder deze override zou de boeking dus de
  // OUDE (ongescatterde) dagenset gebruiken. De scatter-aanroepplek geeft de al-gekozen dagen
  // rechtstreeks door en slaat `occurrenceFor` zo over.
  // B1c-plan3 taak 2: `task` komt sinds nu uit `workById`, niet `taskById` — voor een IN-SCOPE taak
  // is dat de GESTRIPTE baseline (zie `stripLevelingGaps` hierboven); voor een taak BUITEN de scope
  // is `workById` een byte-identieke spread van `taskById` (dezelfde `splitGaps`-array-referentie),
  // dus dit verandert niets aan de vastelast-boeking. Zonder deze wissel zou een taak die een
  // leveling-gat uit een VORIGE nivellering droeg dat gat hier alsnog als brondata lezen.
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
  // grens in theorie nog raken. Sinds B1c-etappe-2 (taak 5) is een uitputting een eigen, gerapporteerde
  // uitkomst (`NO_WINDOW_IN_HORIZON`) in plaats van een verzonnen capaciteitsdiagnose; de marge
  // vergroten blijft de reparatie wanneer een uitputting ONTERECHT optreedt (de A3b-motivatie — een
  // vaste 5000-dagen-scan was traag op grote projecten — blijft gelden).
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

  // ONVERPLAATSBAAR — voltooid ÓF in uitvoering (eindpoortronde W0/W1) ÓF BUITEN SCOPE (B1c-plan-2
  // taak 3): vóór de eligibility-lus als VASTE LAST geboekt — op hun EIGEN (ongeschoven, resp.
  // BEHOUDEN) baseline-earlyStart, nooit een levelingDelay. `placed` bevat ze al (hierboven, via de
  // `!active.has`-lus); dit boekt alleen hun vraag zodat movable/vastgepinde taken die er straks
  // langs moeten het conflict ECHT zien. Reden waarom dit NIET via het pinned-pad in de hoofdlus kan
  // (voor de onverplaatsbare taken): `CPMSolver.forwardPass`'s VOLTOOID-tak (~regel 1420-1456 in
  // CPMSolver.ts) én haar IN-UITVOERING-tak (~regel 1458-1844, W1) planten deze taken allebei
  // onvoorwaardelijk op respectievelijk `actualStart`/`actualFinish` of `actualStart` + restwerk, en
  // NEGEREN `levelingDelay` volledig — een delay toekennen zou een stille no-op zijn (het conflict
  // herleeft na de volgende `runCPM`, `unresolved` zou dan ten onrechte leeg blijven terwijl er wél
  // een botsing is; reviewer-probe M pinde dit specifiek voor de IN-UITVOERING-tak). Vandaar: geen
  // delay-poging, geen findSlot-scan, alleen de boeking — het conflict blijft zichtbaar via de
  // MOVABLE/PINNED taken die er straks omheen moeten (of, bij een botsing tussen twee onverplaatsbare
  // taken onderling, blijft gewoon bestaan — dat is dan een ECHTE, gerapporteerde overallocatie, geen
  // leveler-taak om op te lossen).
  // Voor een OUT-OF-SCOPE taak klopt de boekingspositie vanzelf: `baseEs` komt uit de baseline-solve
  // op `workTasks`, en die draagt voor zo'n taak haar BEHOUDEN delay (de selectieve strip hierboven)
  // — dus `baseEs(id)` is hier al haar VERSCHOVEN, genivelleerde positie, niet haar kale PF.
  for (const id of fixedLoadIds) {
    const startIso = baseEs(id);
    // B1c-plan-2 taak 6: `toPoolLedger: true` — een onverplaatsbare of out-of-scope taak bezet de
    // pool ECHT (ze is per definitie al geplaatst, dus geen "niet-plaatsbaar = geen cascade"-geval).
    bookDemandAt(id, parseDate(startIso), true);
    placedStartIso.set(id, startIso);
  }

  const delays: Record<string, number> = {};
  const unresolved: Record<string, string[]> = {};
  const unresolvedReasons: Record<string, LevelingReason> = {};
  // B1c-plan-2 taak 9: taskId → de volledige, te schrijven `splitGaps`-waarde (bestaande
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
      // Vastgepind (§5.4/A4): volgt zijn (mogelijk verschoven) voorgangers via PF, maar schuift NIET
      // voor capaciteit — geen scan. Boeking op PF valt zo samen met de finale CPM-positie (waar de
      // pin zijn voorgangers volgt), i.p.v. op de stale oorspronkelijke earlyStart. Snapt op de
      // TAAKkalender-as (C1, kwaliteitsronde taak 4), niet de projectkalender — dezelfde as als de
      // delay-meting hieronder en `findSlot`s kandidaat-scan.
      startDate = nextCandidateFor(pickedTask, pf);
    } else {
      // Vensterbovengrens: het strengste van (a) de float (constrainToFloat) en (b) het
      // uitloop-plafond (`overrunCeilingDays`, B1c-plan-2 taak 4). Beide op de VERSE
      // baseline-lateStart (A2), dus mét de behouden out-of-scope-delays uit taak 3 — dat is precies
      // het referentiepunt dat de spec eist ("t.o.v. de huidige opgeslagen projecteinddatum, mét
      // bestaande nivellering").
      const limit = windowLimit(pick);
      const slot = findSlot(pick, pf, limit);
      startDate = slot.start;
      slotUnresolved = slot.unresolved;
      slotReason = slot.reason;
      // B1c-plan-2 taak 9: `findSlot` leverde een dag-voor-dag (onderbroken) plaatsing i.p.v. een
      // aaneengesloten venster. De gaten moeten op de WERKKOPIE staan VÓÓR de proef-solve aan het
      // eind van deze functie (A1) — anders belooft `projectEndAfter` een einddatum die de echte
      // `applyLeveling` → `runCPM` straks nooit haalt — en ná de PF-berekening van déze taak (die
      // ging al over de start, niet de spanne). Vandaar hier, meteen na de `findSlot`-aanroep.
      if (slot.scatterDays) {
        scatterDays = slot.scatterDays;
        const mpd = engineForTask(pickedTask).hoursPerDay * 60;
        // B1c-plan3 taak 2: stapel op de GESTRIPTE werkkopie (`workById`), niet op de originele
        // taak (`pickedTask`, uit `taskById`) — anders komen de leveling-gaten van de VORIGE
        // nivellering alsnog in dit resultaat terecht (accumulatie in plaats van herschrijven).
        const workCopy = workById.get(pick)!;
        const newGaps: TaskSplitGap[] = [
          ...(workCopy.splitGaps ?? []),
          ...splitGapsFromWorkDayBlocks(blocksFromDays(scatterDays, engineForTask(pickedTask)), mpd, 'leveling'),
        ];
        workById.get(pick)!.splitGaps = newGaps; // ⇒ de proef-solve (A1) ziet de opgerekte spanne
        gapsOut[pick] = newGaps;                 // ⇒ komt in LevelingResult.gaps
        // L3-memo (taak 2): deze taak kreeg een NIEUWE dagenset tijdens de run — wis haar cache-
        // entries, anders valt een latere aanroep op de oude (voor-scatter) dagenset.
        for (const key of [...occCache.keys()]) if (key.startsWith(`${pick}|`)) occCache.delete(key);
      }
    }

    // B1c-plan-2 taak 6: dit IS de spec-regel "niet-plaatsbaar = tekort per document, geen cascade"
    // (§4 stap 3) — alleen een taak die daadwerkelijk een passend venster kreeg (`slotUnresolved`
    // leeg) boekt in het GEDEELDE poolitem-grootboek. Vastgepinde taken (priority 1000) scannen niet
    // (`slotUnresolved` blijft hun default `[]`) en boeken dus WÉL — correct: ze bezetten de pool
    // ongeacht of dat past. Dat het restprofiel daardoor op 0 geklemd kan raken terwijl er
    // feitelijk overboeking is, is geen motorprobleem: de verdeler detecteert dat als een tekort op
    // poolniveau (taak 10, buiten dit plan).
    bookDemandAt(pick, startDate, slotUnresolved.length === 0, scatterDays);
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
    gaps: gapsOut,
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
    limit: Date | null,
  ): { start: Date; unresolved: string[]; reason?: LevelingReason; scatterDays?: string[] } {
    // B1c-plan3 taak 2: `task` komt uit `workById`, niet `taskById` — `findSlot` wordt uitsluitend
    // aangeroepen voor movable/vastgepinde (dus per definitie IN-SCOPE) taken, dus dit is precies de
    // GESTRIPTE baseline. Zonder deze wissel zou `occurrenceFor` hieronder (via `computeOccurrence`)
    // een leveling-gat uit een VORIGE nivellering als brondata lezen — de kandidaat-scan zou dan een
    // gesplitste dagenset toetsen in plaats van de schone aaneengesloten baseline waar deze functie
    // vanuit gaat, en de idempotentie-eis van spec §4 ("Herkomst") zou stuklopen. Zie `bookDemandAt`
    // hierboven voor dezelfde wissel en dezelfde motivering.
    const task = workById.get(taskId)!;
    const byRes = demandByTask.get(taskId)!;

    // B1c-plan-2 taak 6: reset de reden-sturing bij elke aanroep — zie de declaratie hierboven bij
    // `booked`/`bookedOn`. Zonder grootboek (`ledger === undefined`) blijft dit `false`, dus de
    // RESIDUAL_FULL-tak in `reasonFor` kan nooit geraakt worden — byte-identiek.
    poolBlockedOnly = ledger !== undefined;

    let cand = nextCandidateFor(task, pf);

    // CEILING_UNREACHABLE (B1c-plan-2 taak 4, spec §4): staat er een plafond, en ligt de EERSTE
    // kandidaat (= `cand` hierboven, dezelfde waarde als `nextCandidateFor(task, pf)`) er al
    // voorbij, dan is het venster leeg vóórdat capaciteit ook maar geraadpleegd is — de binder is
    // dan een deadline/backward-constraint (die drukt `lateStart` naar voren), niet de capaciteit.
    // Bewust ALLEEN bij een expliciet plafond: met kaal `constrainToFloat` is `pf > ls` bestaand,
    // getest gedrag (de eerste kandidaat wordt altijd geprobeerd) en dat blijft byte-identiek.
    const ceilingSet = options.overrunCeilingDays !== undefined;
    const ceilingUnreachable = ceilingSet && limit !== null && cand > limit;

    let calendarFeasibleSeen = false; // is er überhaupt een venster waar élke vraagdag óók een resource-werkdag is?
    // B1c-plan-2 taak 6: `scanLimit` (L4) is de taak-eigen ondergrens; een grootboek MET horizon
    // (`ledger.horizonIso`) kan die overschrijden — zodra het grootboek externe vaste last bevat, kan
    // het eerste vrije venster voorbij `totalWork + marge` liggen. De lus loopt daarom nu tot de harde
    // `HARD_SCAN_CAP`, en `scanLimit` wordt hieronder een INLINE afkap-voorwaarde i.p.v. de loop-bound
    // zelf — voor `ledger === undefined` (dus `horizonDate === null`) is dat exact hetzelfde aantal
    // iteraties als de oude `while (guard++ < scanLimit)`-vorm (zie het commitbericht voor het bewijs).
    const horizonDate = ledger?.horizonIso ? parseDate(ledger.horizonIso) : null;
    let guard = 0;
    // B1c-plan-2 taak 5 (naad-hygiëne), herzien in taak 6: onderscheid WAAROM de scan zonder slot
    // eindigt — via de venstergrens (`break` hieronder, een bewuste gebruikerskeuze) of doordat de
    // horizon (scanLimit, evt. verlengd door het grootboek) simpelweg opraakte (een rekengrens).
    // `false` is nu de default (was `true` t/m taak 5): alleen de horizon-tak hieronder — én de
    // `HARD_SCAN_CAP`-vangrail ná de lus — zetten hem op `true`.
    let horizonExhausted = false;
    while (guard++ < HARD_SCAN_CAP) {
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
      if (limit && next > limit) break; // venstergrens (float/plafond) — geen slot, geen horizon-uitputting
      // B1c-plan-2 taak 6: de venstergrens (hierboven) wint van de horizon — een plafond is een
      // gebruikerskeuze, de horizon een rekengrens. Zonder grootboek-horizon (`horizonDate === null`)
      // stopt dit exact bij `guard === scanLimit`, byte-identiek aan de oude loop-bound.
      if (guard >= scanLimit && !(horizonDate && next <= horizonDate)) { horizonExhausted = true; break; }
      cand = next;
    }
    if (guard >= HARD_SCAN_CAP) horizonExhausted = true; // vangrail: ook dít is een uitputting, geen venstergrens

    // ── Onderbreek-modus (B1c-plan-2 taak 9, spec §4 stap 0) ────────────────────────────────────
    // Er is geen AANEENGESLOTEN venster gevonden. Mag de taak onderbroken worden, dan plaatsen we
    // haar dag-voor-dag: loop vanaf de gesnapte PF over de kandidaat-werkdagen en neem telkens de
    // eerstvolgende dag waarop de vraag van de VOLGENDE curve-index past. De overgeslagen werkdagen
    // ertussen worden de pauzedagen. Greedy van links naar rechts — bewust GEEN zoektocht: de spec
    // (§3.4) verbiedt iteratie over kandidaatstanden, en het greedy-antwoord is per constructie de
    // vroegst mogelijke onderbroken plaatsing. Gebonden door `finishWindowLimit` (de FINISH-versie
    // van het plafond, niet de start-`limit` hierboven) — zie het docblok daar.
    if (splitEligible(task)) {
      const scatterDays = scatterSlot(taskId, pf, finishWindowLimit(taskId));
      // B1c-plan3 taak 1 (bevinding 12): een LEGE dagenset is geen plaatsing. `scatterSlot` geeft
      // `[]` terug zodra `need === 0` (`chosen.length === need` is dan meteen waar), en `[]` is
      // truthy — `parseDate(scatterDays[0])` maakte er dan een Invalid Date van, die als `start` de
      // hele hoofdlus in reisde (delay-meting, boeking, shifts). Niets plaatsen hoort door te vallen
      // naar het "geen slot"-vangnet hieronder.
      if (scatterDays && scatterDays.length > 0) {
        return { start: parseDate(scatterDays[0]), unresolved: [], scatterDays };
      }
    }

    // Geen slot: blijf op de gesnapte PF, verzamel de conflictdagen (waar de vraag de restcapaciteit
    // overschrijdt) — dezelfde dagenset (`occurrenceFor`) als de boeking straks zou gebruiken.
    const snappedPf = nextCandidateFor(task, pf);
    const occ = occurrenceFor(task, snappedPf);
    const conflicts: string[] = [];
    for (const [resId, arr] of byRes) {
      // B1c-plan-2 taak 6 (afwijking van het plan-voorschrift, zie commitbericht): het plan gaf hier
      // letterlijk alleen de bestaande projecttoets; zonder de pool-tak hieronder bleef een taak die
      // UITSLUITEND op het poolitem-grootboek vastloopt met een LEGE conflictdagenlijst zitten — de
      // hoofdlus zet `unresolved[pick]`/`unresolvedReasons[pick]` alleen bij `slotUnresolved.length >
      // 0`, dus RESIDUAL_FULL zou stilzwijgend verdwijnen. Spiegelt `fits`'s tweede toets: de POOL-tak
      // wordt alleen bekeken als de PROJECTtoets al slaagde (elke-if, geen dubbele push).
      const poolItem = ledger ? ledger.poolItemOf(resId) : null;
      for (let i = 0; i < arr.length && i < occ.length; i++) {
        // B1c-plan-2 taak 5 (naad-hygiëne): zelfde nul-guard als `fits` hieronder — een dag zonder
        // vraag (`arr[i] <= 0`) kan niet botsen, ook niet als een ANDERE (bv. vastgepinde) taak die
        // dag toevallig overboekt. Vóór deze guard rapporteerde de verzamelaar zo'n dag alsnog als
        // conflictdag van DEZE taak (fantoomconflict) — zie `check-leveler-seam.ts` geval 3.
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

  /** Reden waarom er geen slot bestaat (A3, uitgebreid B1c-plan-2 taken 4/5/6; volgorde RESIDUAL_FULL
   *  vóór CEILING_TOO_TIGHT sinds de B1c-plan-2-etappe-2-fixronde, bevinding 4). Volgorde: intrinsiek
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
   *  altijd een plafond (`overrunCeilingDays`), dus `ceilingSet` staat bijna elke aanroep aan — met de
   *  oude volgorde won CEILING_TOO_TIGHT dan ALTIJD en was RESIDUAL_FULL in de praktijk onbereikbaar,
   *  ook wanneer de taak uitsluitend vastliep op andere projecten die de pool bezetten (spec §4 eist
   *  restcapaciteit-vol en plafond-te-krap als twee aparte, eerlijke uitkomsten — de gebruiker moet
   *  naar de pool gewezen worden, niet naar zijn eigen (onschuldige) plafond). */
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
   *  kalender-uitlijning (A3, verscherpt B1c-plan-2 taak 5: vóór deze ronde toetste dit `capacityOf
   *  <= 0`, wat een resource met `maxUnits: 0` (of, met een restprofiel, een geklemd nulprofiel) ten
   *  onrechte als kalender-onhaalbaar bestempelde — dat is een capaciteitsprobleem, geen
   *  kalenderprobleem; zie `check-leveler-seam.ts` geval 1). */
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

  /** Past de dagvraag `byRes` op de opeenvolgende werkdagen `occ` binnen de restcapaciteit? B1c-
   *  plan-2 taak 6: TWEE toetsen moeten allebei slagen — (a) de bestaande per-resource-toets tegen
   *  de eigen projectinzet, én (b) — alleen als er een `poolLedger` is en de resource daaraan hangt —
   *  het gedeelde poolitem-grootboek. Dat is dezelfde regel als de `min(projectinzet, poolrest)`-
   *  formulering elders in de spec (zie `LevelingPoolLedger`s docblok), twee schrijfwijzen van één
   *  ding. `poolBlockedOnly` (findSlot-scope) wordt hier op `false` gezet zodra de PROJECTtoets
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

  /** Mag deze taak leveling-gaten krijgen (B1c-plan-2 taak 9)? Zie de v1-grens bij
   *  `LevelingOptions.allowSplits` (verbreed 2026-08-31: `durationUnit` speelt geen rol meer — dag-
   *  én uur-modus komen in aanmerking, mits WORKTIME en niet-gestart). */
  function splitEligible(task: Task): boolean {
    return options.allowSplits === true
      && task.time.durationType === 'WORKTIME'
      && task.time.completion === 0;
  }

  /** Past curve-index `i` van deze taak op dag `iso`? Zelfde twee toetsen als `fits` (projectinzet
   *  én poolitem-grootboek), maar voor één index/één dag — de dag-voor-dag-tegenhanger van `fits`s
   *  aaneengesloten-venstercheck (B1c-plan-2 taak 9). */
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

  /** Dag-voor-dag-plaatsing (B1c-plan-2 taak 9). Geeft de gekozen werkdagen (ISO, oplopend) of
   *  `null` wanneer er binnen het venster geen volledige set te vinden is. `finishLimit` begrenst de
   *  LAATSTE dag (niet de start): met onderbrekingen groeit de FINISH van de taak, en dát is wat het
   *  plafond moet binden (zie `finishWindowLimit`). */
  function scatterSlot(taskId: string, pf: Date, finishLimit: Date | null): string[] | null {
    // B1c-plan3 taak 2: `task` komt uit `workById`, zelfde wissel als `findSlot`/`bookDemandAt`
    // hierboven, voor consistentie — `scatterSlot` leest hier vandaag geen `splitGaps`, maar de
    // gedeelde bron voorkomt dat een latere uitbreiding stilzwijgend weer op de ongestripte
    // `taskById` gaat leunen.
    const task = workById.get(taskId)!;
    const byRes = demandByTask.get(taskId)!;
    // LET OP — uur-modus (eigenaarsbesluit 2026-08-31, v1-grens verbreed): `task.time.scheduleDuration`
    // is voor een uur-modus-taak GEEN geheel getal in het algemeen — `distributeUnits`
    // (ResourceLoad.ts) rondt dat AL af naar boven tot curve-SLOTS (de `for (let i = 0; i <
    // durationDays; i++)`-lus loopt door tot de volgende hele dag), dus `demandByTask`s array-lengte
    // is altijd de juiste GEHELE werkdagen-telling, voor dag- én uur-modus. `need` moet daarom het
    // AANTAL CURVE-SLOTS zijn, NOOIT de rauwe `scheduleDuration` rechtstreeks — anders stopt de
    // scatter-lus (`chosen.length < need`) voortijdig bij een fractioneel plafond. Voor dag-modus is
    // dit BYTE-IDENTIEK (`scheduleDuration` is daar al een geheel getal, dus `Math.ceil` verandert
    // niets). De `Math.ceil(...)`-fallback dekt alleen het theoretische geval zonder enige vraag op
    // een geselecteerde resource (`byRes` leeg) — `splitEligible` wordt normaliter pas bereikt nadat
    // `hasDemand` al vraag bevestigde, dus dit pad is defensief.
    const need = byRes.values().next().value?.length ?? Math.ceil(task.time.scheduleDuration);
    // B1c-plan3 taak 1 (bevinding 11): zonder `finishLimit` (geen plafond, geen constrainToFloat) had
    // deze lus alleen `HARD_SCAN_CAP` als rem — 200.000 kandidaatdagen mét een volledige `dayFits`
    // per dag, terwijl de aaneengesloten scan er allang mee gestopt is. Zelfde tweetrapsgrens als
    // `findSlot`: `scanLimit` is de gewone ondergrens (afgeleid van de eigen taakduren), en een
    // grootboekhorizon mag hem verlengen omdat externe vaste last het eerste vrije venster voorbij
    // die ondergrens kan duwen (L4). `HARD_SCAN_CAP` blijft uitsluitend de vangrail.
    const horizonDate = ledger?.horizonIso ? parseDate(ledger.horizonIso) : null;
    const chosen: string[] = [];
    let cand = nextCandidateFor(task, pf);
    let guard = 0;
    while (chosen.length < need && guard++ < HARD_SCAN_CAP) {
      if (finishLimit && cand > finishLimit) return null;
      if (guard > scanLimit && !(horizonDate && cand <= horizonDate)) return null;
      const iso = formatDate(cand);
      if (dayFits(byRes, chosen.length, iso)) chosen.push(iso);
      cand = nextCandidateAfterFor(task, cand);
    }
    return chosen.length === need ? chosen : null;
  }

  /** Werk/gat-blokken (hele werkdagen) uit een oplopende lijst GEKOZEN ISO-werkdagen — de
   *  tegenhanger van `scatterSlot`: hoeveel werkdagen van `engine` zijn er tussen elke opeenvolgende
   *  gekozen dag overgeslagen? Voedt `splitGapsFromWorkDayBlocks` (B1c-plan-2 taak 9). */
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
 *  B1c-plan-2 taak 3 (spec-plicht, gevalideerd in `check-leveler-scope.ts` geval 2): `workTasks`
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
