import type { Task } from '@/types/task';
import type { Sequence, LagUnit } from '@/types/sequence';
import type { CalendarEngine } from './CalendarEngine';
import { addCalendarDays, MS_PER_DAY } from '@/utils/dateUtils';
import { isElapsedTask, isZeroDurationMilestone } from './duration';

/**
 * Relatie-wiskunde (FS/SS/FF/SF) voor `CPMSolver.ts`, forward/backward × dag-/uur-modus.
 *
 *  1. **Forward en backward naast elkaar** — per richting één ingang
 *     (`forwardConstraint`/`backwardConstraint`) die per relatietype dispatcht. LET OP: de
 *     spiegel-invariant (backward = spiegel van forward) is een conventie tussen twee parallelle
 *     switch-armen, geen afgedwongen code-eigenschap; de suite (cases-hours-relations) pint beide
 *     richtingen vast.
 *  2. **Mijlpaal-grensvlaggen één keer** — `relationBoundaryFlags` berekent de vier grensvlaggen op
 *     één plek; forward en backward krijgen ze aangereikt.
 *  3. **Dag/uur als parametrisering** — de mode-bewuste engine-/lag-helpers (via `RelationDeps`)
 *     reduceren in dag-modus tot de dag-expressies; alleen een uur-kalender activeert het
 *     minuut-native pad. Dag en uur blijven twee takken: het dag-elapsed-pad schrijft bewust een
 *     ONGESNAPTE grens in `seqConstraint` voor de vrije-speling-analyse, het uur-pad snapt — die
 *     conventies mogen niet vermengd worden.
 */

// Milliseconde-constanten (uur-pad); HOUR_SCAN = veiligheidsplafond voor de dag→uur-backward-scan.
export const MS_PER_MIN = 60_000;
export const HOUR_SCAN = 400;

/** De grensvlaggen die de mijlpaal-grens-semantiek beschrijven voor één relatie. */
export interface RelationBoundaryFlags {
  /** Voorganger is een mijlpaal die op een dagBEGIN ligt (start-/auto-mijlpaal): zijn "finish"
   *  bezet geen dag, dus opvolgers op de startzijde beginnen dezelfde dag. */
  predEndsBeginOfDay: boolean;
  /** Voorganger is een eindmijlpaal (dagEINDE): zijn "start"-moment is die dag-eindgrens ⇒ een
   *  startzijde-opvolger schuift een werkdag op. */
  predStartsNextDay: boolean;
  /** Opvolger is een eindmijlpaal. */
  succIsFinishMs: boolean;
  /** Opvolger is een startmijlpaal (dagbegin-anker). */
  succIsStartMs: boolean;
}

/** Bereken de mijlpaal-grensvlaggen voor het (voorganger, opvolger)-paar (één bron van waarheid). */
export function relationBoundaryFlags(
  predTask: Task,
  succTask: Task,
  p6ZeroDurationSuccessorAtFinish = false,
): RelationBoundaryFlags {
  // `predIsMilestone` leest de DUUR, niet de kale `isMilestone`-vlag: een mijlpaal-MET-duur is geen
  // dag-grens-voorganger (haar meerdaagse finish is geen "dagbegin"). Niet gepind door een case met
  // zo'n taak als voorganger.
  //
  // BEKEND LATENT GAT (niet gefixt): `succIsFinishMs`/`succIsStartMs` staan wél op de kale
  // `isMilestone`-vlag. De lezers (mppReader.ts/mspdiReader.ts) zetten `milestoneKind` alleen bij
  // `duration===0`, dus langs die weg speelt het niet; maar MCP en de IFC-round-trip (`ifcPsets.ts`
  // schrijft/leest `MilestoneKind` zonder duurpoort — een 0-duur mijlpaal die daarna een duur krijgt
  // houdt haar `milestoneKind`) kunnen de combinatie mijlpaal-met-duur + `milestoneKind` wél maken.
  const predIsMilestone = predTask.time.scheduleDuration <= 0;
  const predKind = predTask.isMilestone ? predTask.milestoneKind : undefined;
  const p6FinishBoundary = p6ZeroDurationSuccessorAtFinish && isZeroDurationMilestone(succTask);
  return {
    predEndsBeginOfDay: predIsMilestone && predKind !== 'FINISH',
    predStartsNextDay: predIsMilestone && predKind === 'FINISH',
    succIsFinishMs: p6FinishBoundary
      || (succTask.isMilestone && succTask.milestoneKind === 'FINISH'),
    succIsStartMs: !p6FinishBoundary
      && succTask.isMilestone && succTask.milestoneKind === 'START',
  };
}

/**
 * Kruis-kalender-FS. De discriminator voor de FS+0-grens-snap hieronder: *voorganger-eerst, TENZIJ de twee kalenders op de LANDINGSDAG (de
 * kalenderdag van het rauwe voorganger-finish-instant `onDate` — de dag waar de niet-kortgesloten
 * `pe`-snap als EERSTE zou landen/doorzoeken) identieke EFFECTIEVE banden hebben — dan opvolger-eerst.*
 *
 * De vergelijking gebruikt de EFFECTIEVE banden van `onDate` (`CalendarEngine.effectiveBandsOn`,
 * hetzelfde `bandsStartingOn`-pad als elke snap, dus inclusief werkende uitzonderingen én holidays),
 * niet de statische weekdagtabel: die ziet een `workingException` op de landingsdag niet en noemt
 * twee kalenders dan ten onrechte "identiek" (de msp-04-foutvorm; gepind in
 * `msp-45-z11-punt1-workingexception-landingsdag`). Eén datum volstaat: een verschil op een ANDERE
 * dag (bv. de extra zaterdag zelf) is precies de asymmetrie die opvolger-eerst moet herstellen.
 *
 * Randgevallen: `effectiveBandsOn` geeft `[]` terug zodra
 * DIE kalender op `onDate` niet werkt — dag-modus (geen bandtijden, altijd `[]` voor beide kanten),
 * maar ook een holiday of een niet-werkende weekdag in uur-modus. **Beide leeg** ⇒ `true` (geen band
 * om op te struikelen — in dag-modus dus altijd waar). **Eén van de twee leeg, de ander niet** ⇒
 * `false` — een asymmetrische holiday/niet-werkdag op de landingsdag is GEEN reden om de opvolger
 * blind te vertrouwen; de bestaande voorganger-eerst-machinerie kent die situatie al correct af
 * (`msp-44-z11-punt5-holiday-landingsdag` pint dit: een holiday bij de opvolger op precies de
 * landingsdag houdt voorganger-eerst in stand, ook al zou de opvolger's eigen `nextWorkInstant`
 * daarna toevallig op de "extra werkdag" van diezelfde opvolger uitkomen).
 *
 * Volgorde-ongevoelig: een kalender met MEERDERE banden per
 * dag (gesplitste dienst, bv. een lunchpauze) hoeft ze niet in chronologische volgorde op te slaan —
 * `sortedBands` sorteert op `start` vóór de positionele vergelijking, zodat twee kalenders met
 * DEZELFDE verzameling banden in een ANDERE volgorde niet ten onrechte `false` geven
 * (`msp-43-z11-punt4-bandvolgorde-ongevoelig` pint dit, mutatiebewijs: de sort weghalen ⇒ ROOD).
 *
 * Reconstructie:
 *  - CORPUSGEVAL (OzBuild Workshop 14 End Para 29.mpp, dag-modus): op de landingsdag (vrijdag) hebben
 *    "Standard" en "6 Day Week" beide `effectiveBandsOn` = `[]` (dag-modus draagt geen bandtijden) ⇒
 *    `true` ⇒ opvolger-eerst. Met opvolger-eerst snapt de FS-grens direct in "6 Day Week", die
 *    zaterdag WEL kent — de MSP-datum (zaterdag) komt daarmee binnen bereik i.p.v. de voorganger-
 *    eerst-snap die 'm over het hele weekend naar maandag duwt.
 *  - GUARD-CASE (msp-04-m2-guard1-alleen-crosscalendar, uur-modus): op de landingsdag (dinsdag) is
 *    P se effectieve band `[08:00,17:00)` en Q se `[09:00,18:00)` — verschillend ⇒ `false` ⇒
 *    voorganger-eerst blijft behouden — exact het bestaande, doelbewust geteste gedrag.
 *
 * Spiegelgeval: `backwardDay`/`backwardHour` kennen deze tak BEWUST niet: hun FS-default-arm bouwt `succResult.ls` niet via eenzelfde pred-dan-succ-
 * dubbele-snap-keten (die komt al gesnapt binnen, uit de eigen backward-pass van de opvolger), dus
 * er is daar niets te "kortsluiten". De tak hier is bovendien veilig: `se.nextWorkDayAfter(...)`/`se.availableStart(...)` leveren altijd al een
 * geldig werk-instant IN `se` se EIGEN kalender op — de generieke stroomafwaartse hersnap in
 * `CPMSolver.snapSuccessorEarlyStart` (`snapOnOrAfter(se, …)`, draait na ELKE forward-relatie,
 * ongeacht welke tak hierboven vuurde) is op zo'n al-geldige instant een IDEMPOTENTE no-op — de
 * onschadelijkheid zit dus in die stroomafwaartse hersnap, niet in een eigenschap van de tak zelf.
 */
export function calendarsAgreeOnSharedWorkdayBands(
  a: CalendarEngine, b: CalendarEngine, onDate: Date,
): boolean {
  const sortedBands = (
    bands: ReadonlyArray<Readonly<{ start: number; end: number }>>,
  ): ReadonlyArray<Readonly<{ start: number; end: number }>> => [...bands].sort((x, y) => x.start - y.start);
  const aBands = sortedBands(a.effectiveBandsOn(onDate));
  const bBands = sortedBands(b.effectiveBandsOn(onDate));
  if (aBands.length === 0 && bBands.length === 0) return true;   // beide geen band op deze dag — n.v.t.
  if (aBands.length === 0 || bBands.length === 0) return false;  // asymmetrisch (bv. holiday één kant)
  if (aBands.length !== bBands.length) return false;
  for (let i = 0; i < aBands.length; i++) {
    if (aBands[i].start !== bBands[i].start || aBands[i].end !== bBands[i].end) return false;
  }
  return true;
}

/** De mode-bewuste primitieven die de relatie-wiskunde nodig heeft. Blijven in `CPMSolver`
 *  gedefinieerd (ze delen daar de dag↔uur-reductie met de rest van de solver) en worden hier
 *  geïnjecteerd, zodat de relatie-wiskunde puur en op één plek staat zonder de helpers te dupliceren. */
export interface RelationDeps {
  /** Selecteert de projectgebonden kalender waarin WORKTIME-relatielag telt. */
  lagEngine(predEng: CalendarEngine, succEng: CalendarEngine): CalendarEngine;
  /** `predEng` is nodig voor de dag↔minuut-factor (`hoursPerDay`) waarmee een `lagMinutes`-lag
   *  zónder `lagDays` in een DAG-voorganger wordt opgelost (zonder die factor valt zo'n lag stil
   *  weg — P6-XML/MSPDI schrijven precies die combinatie voor een uur-opvolger). */
  resolveLag(seq: Sequence, predTask: Task, predEng: CalendarEngine): { days: number; unit: LagUnit };
  resolveEffectiveLagDays(seq: Sequence, predTask: Task, predEng: CalendarEngine): number;
  resolveElapsedMinutes(seq: Sequence, predTask: Task): number;
  shiftLagPred(predEng: CalendarEngine, base: Date, seq: Sequence, predTask: Task, sign: 1 | -1): Date;
  startFromFinish(eng: CalendarEngine, finish: Date, task: Task): Date;
  finishFromStart(eng: CalendarEngine, start: Date, task: Task): Date;
  snapOnOrAfter(eng: CalendarEngine, d: Date): Date;
  snapOnOrBefore(eng: CalendarEngine, d: Date): Date;
  snapStrictAfter(eng: CalendarEngine, d: Date): Date;
  snapStrictBefore(eng: CalendarEngine, d: Date): Date;
  startOfDay(d: Date): Date;
}

/**
 * Forward-relatie-grens: geef de door de relatie geëiste vroegste START van de opvolger.
 * De projectstart-ondergrens en de max-over-voorgangers worden in de forward-pass toegepast
 * (relaties zijn ondergrenzen, geen gelijkheden). Dispatcht op modus: zodra minstens één zijde
 * uur-modus is loopt het cross-/uur-pad, anders het dag-pad.
 */
export function forwardConstraint(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  p6ZeroDurationSuccessorAtFinish = false,
  finishFinishAtStartMilestoneLateFinish = false,
): Date {
  const boundaryFlags = relationBoundaryFlags(predTask, successor, p6ZeroDurationSuccessorAtFinish);
  // Conventie C7 (`p6FinishFinishStartMilestoneLateFinish`, docblok in `types/project.ts`): spiegel
  // van `backwardConstraint` — de FF-grens naar een startmijlpaal is de voorgangerfinish zelf, zonder
  // de sprong naar de werkgrens ná een dagbegin-anker.
  const flags = finishFinishAtStartMilestoneLateFinish && seq.type === 'FINISH_FINISH'
    ? { ...boundaryFlags, succIsStartMs: false }
    : boundaryFlags;
  if (predEng.isHourMode || succEng.isHourMode) {
    return forwardHour(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
  }
  return forwardDay(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
}

/**
 * START_FINISH-finishvloer (`mpp14relations.mpp`/"Task 5").
 *
 * `forwardConstraint`'s SF-tak berekent intern een `reqFinish` (de door de relatie geëiste
 * opvolger-finish: voorganger-START + lag) en zet die DIRECT om naar een opvolger-ES-kandidaat via
 * `deps.startFromFinish` (terugtellen over de duur) — `reqFinish` zelf verlaat de functie nooit.
 * `CPMSolver.forwardPass` herberekent de opvolger-EF vervolgens UNIFORM voor ALLE relatietypes als
 * `ES + duur` VOORWAARTS (`addDurationChecked`). Voor FS/SS is dat correct (die ankeren zelf al op
 * de START-zijde, dus voorwaarts-vanaf-ES is precies de relatie-semantiek). Voor SF ankert de
 * relatie op de FINISH-zijde — en zodra de terugtelling exact een hele niet-werkperiode overspant
 * (bv. een weekend: de duur consumeert precies de laatste werkdag vóór het weekend en landt op
 * diens BEGIN), is "terug over de duur, dan weer vooruit over de duur" GEEN inverteerbare
 * bewerking: vooruit vanaf die ES-kandidaat eindigt op het BEGIN van de niet-werkperiode (bv.
 * vrijdag 17:00), niet op `reqFinish` zelf (bv. maandag 08:00) — één werk-sessiegrens zoek.
 *
 * Gemeten tegen MPXJ-junit `mpp14relations.mpp`, taak "Task 5" (SF-opvolger van "Task 4", lag 0):
 * MS Project se eigen opgeslagen Finish is `reqFinish` zelf (maandag 08:00) — niet de voorwaarts-
 * herberekende waarde (vrijdag 17:00). Corpusloos gepind in `cases-msp-pariteit.json`
 * (`msp-35-z10-sf-weekendgrens`).
 *
 * Deze functie levert `reqFinish` als een APARTE ondergrens ("niet eerder dan…", net als de
 * ES-kandidaat van elke relatie een ondergrens is) — `CPMSolver.forwardPass` neemt 'm mee als extra
 * `max()`-term NAAST de gewone `ES + duur`-berekening, ZONDER de ES-berekening zelf aan te raken.
 *
 * WAAROM ALLEEN `START_FINISH` (`null` voor alle andere typen, nadrukkelijk óók niet voor
 * `FINISH_FINISH`). De vloer verschuift `earlyFinish` uitsluitend over een
 * NUL-WERK-gat (het hele punt van de vloer is dat `ES + duur` daar precies op vastloopt) — binnen
 * dat gat verandert geen enkele werkminuut, dus elke WERKMINUUT-gebaseerde grootheid (float, tf/ff,
 * kritiek-pad) is INVARIANT onder de vloer, zelf als de vloer vuurt. Het verschil tussen SF en FF
 * zit in WAAR `reqFinish` landt t.o.v. een bandgrens: SF ankert op `predResult.es`, en bij lag 0 is
 * dat een bandSTART (het `(start,end)`-forward-anker) — `startFromFinish` (terug) gevolgd door
 * `addDuration` (weer vooruit) is dan NIET inverteerbaar (zie het scenario hierboven: terug landt op
 * de vorige werkdag-START, vooruit vanaf díe START landt op diens EIND, niet terug op `reqFinish`).
 * FF ankert op `predResult.ef`, een bandEIND (het `(start,end]`-finish-anker) — daar ROND-TRIPT
 * `startFromFinish`/`addDuration` WEL exact (het finish-anker is zelf al het punt waar de
 * duur-optelling normaliter uitkomt), dus een FF-vloer zou daar sowieso nooit vuren: geen
 * gedragswijziging, geen risico, maar ook geen enkele reden om 'm er toch bij te bouwen. De
 * UITZONDERING die dit bewust doorbreekt is EXPLICIET geklemd, niet stilzwijgend: `CPMSolver.
 * forwardPass` slaat de vloer over zodra de taak een HARDE finish-pin heeft (MFO/MSO hard,
 * `hardPinFinish`) — dát pad belooft een EIGEN, hardere invariant (EF=LF=pin, tf=0) die vóór de
 * vloer gaat (`msp-36-z10-sf-hardpin-wint`).
 *
 * BEWUSTE SCOPE-GRENZEN (niet gefixt):
 *  - **Taken met actuals.** `CPMSolver.forwardPass`s VOLTOOID-/IN-PROGRESS-takken (`t.actualFinish`/
 *    `t.actualStart`/`t.completion>0`) `continue`n VÓÓR de vloer ooit toegepast wordt — een taak die
 *    al (deels) is afgemeld pint op haar eigen feiten, nooit op een relatie-vereiste finish. De
 *    vloer is voor zo'n taak dus principieel onbereikbaar, net zoals relatie-constraints in het
 *    algemeen wijken voor geregistreerde actuals.
 *  - **Hammocks.** `hammockEarlyFinish` (CPMSolver.ts) doet voor een SF/FF-voorganger de rondgang
 *    `forwardConstraint` → start-equivalent → `finishFromStart` — een hammock-EF loopt niet door
 *    `sfFinishFloor`, dus een SF-relatie naar een hammock kan hetzelfde weekendgrens-symptoom tonen.
 *    Geen corpusbestand of case raakt een SF-naar-hammock-relatie.
 *
 * Losstaand van `forwardConstraint` gehouden (i.p.v. diens retourtype te verrijken) om de vier
 * aanroepplekken van `forwardConstraint`/`backwardConstraint` — die zelf niets met een
 * finish-vloer te maken hebben (hammock-ES, hammock-EF, ALAP-her-anker) — ongemoeid te laten.
 */
export function forwardFinishFloor(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  p6ZeroDurationSuccessorAtFinish = false,
): Date | null {
  if (seq.type !== 'START_FINISH') return null;
  const flags = relationBoundaryFlags(predTask, successor, p6ZeroDurationSuccessorAtFinish);
  if (predEng.isHourMode || succEng.isHourMode) {
    return sfReqFinishHour(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
  }
  return sfReqFinishDay(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
}

/**
 * Backward-relatie-grens: geef de laatst toegestane FINISH van de voorganger (spiegel van
 * `forwardConstraint`). Dispatcht identiek op modus.
 */
export function backwardConstraint(
  deps: RelationDeps,
  succResult: { ls: Date; lf: Date },
  seq: Sequence,
  predTask: Task,
  succTask: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  p6ZeroDurationSuccessorAtFinish = false,
  finishFinishAtStartMilestoneLateFinish = false,
): Date {
  const boundaryFlags = relationBoundaryFlags(predTask, succTask, p6ZeroDurationSuccessorAtFinish);
  // Conventie C7 (`p6FinishFinishStartMilestoneLateFinish`, docblok in `types/project.ts`): de
  // aanroeper beslist; hier alleen het effect — een FF-relatie naar een startmijlpaal bindt aan
  // diens LATE FINISH zelf, zonder de dagbegin-sprong naar de vorige werkgrens.
  const flags = finishFinishAtStartMilestoneLateFinish && seq.type === 'FINISH_FINISH'
    ? { ...boundaryFlags, succIsStartMs: false }
    : boundaryFlags;
  if (predEng.isHourMode || succEng.isHourMode) {
    return backwardHour(deps, succResult, seq, predTask, predEng, succEng, flags);
  }
  return backwardDay(deps, succResult, seq, predTask, predEng, succEng, flags);
}

// ═══════════════════════════════════════════════════════════════════════════
//  DAG-modus (puur dag→dag).
// ═══════════════════════════════════════════════════════════════════════════

function forwardDay(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  // Lag in dagen; positief = uitloop, negatief = lead (overlap), 0 = direct aansluitend.
  // Werkdag-lag (WORKTIME, default) stapt over werkdagen; kalenderdag-lag (ELAPSEDTIME)
  // telt 24/7 en snapt daarna vooruit naar een werkdag (ondergrens: "niet eerder dan…").
  // De relatie-lag telt in de geselecteerde bronkalender (P6-default: voorganger). De succBack-
  // aftrek en successor-mijlpaal-snaps tellen in de successor-kalender; de FS-finishgrens-snap in
  // de voorganger.
  const pe = predEng;
  const se = succEng;
  const lagEng = deps.lagEngine(predEng, succEng);
  const { days: lag, unit } = deps.resolveLag(seq, predTask, lagEng);
  const elapsed = unit === 'ELAPSEDTIME';
  // FF/SF hieronder leiden de opvolgerstart af via `deps.startFromFinish` — dezelfde helper als de
  // forward-duurtoepassing, die zelf de WORKTIME/ELAPSEDTIME-keuze maakt (ELAPSEDTIME-opvolger:
  // 24/7 kloktijd). Nooit inline in WERKdagen terugstappen.
  // `succElapsed` gebruikt `isZeroDurationMilestone`, niet de kale vlag: een mijlpaal-met-duur die
  // ELAPSEDTIME is, volgt wél de elapsed-tak (msp-30).
  const succElapsed = isElapsedTask(successor);
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;

  switch (seq.type) {
    case 'START_START': {
      // Opvolger start `lag` dagen na de start van de voorganger. Een ruwe elapsed-datum op een
      // weekend hoeft hier niet gesnapt vóór een WORKTIME-opvolger: `CPMSolver.forwardPass`
      // eindigt met `nextWorkDay` op de max (NIET voor een ELAPSEDTIME-opvolger —
      // `snapSuccessorEarlyStart`/`ownAnchor` slaan die her-snap bewust over). Het "start"-moment van een
      // eindmijlpaal is zijn dag-eindgrens ⇒ werkdag erna.
      if (elapsed) {
        return addCalendarDays(predResult.es, predStartsNextDay ? lag + 1 : lag);
      }
      const base = predStartsNextDay ? pe.nextWorkDayAfter(predResult.es) : predResult.es;
      // `addWorkingDaysSigned` snapt zijn EIGEN invoer altijd eerst naar een werkdag (`nextWorkDay`,
      // ook bij lag=0) — voor een ELAPSEDTIME-opvolger een ongeoorloofde werk-instant-eis.
      // `addCalendarDays` is de kale klok-tegenhanger (dezelfde helper als de `elapsed`(LAG)-tak).
      if (succElapsed) return addCalendarDays(base, lag);
      return lagEng.addWorkingDaysSigned(base, lag);
    }
    case 'FINISH_FINISH': {
      // Opvolger EINDIGT `lag` dagen na de finish van de voorganger → leid de bijbehorende
      // start af (finish − (duur−1)). De geëiste finish moet een werkdag zijn vóór de
      // werkdag-aftrek, dus elapsed snapt hier wél (vooruit — ondergrens op de finish) —
      // BEHALVE voor een ELAPSEDTIME-opvolger: die heeft geen werkdag-begrip, dus de
      // geëiste finish blijft een kale kloktijd (geen `se.nextWorkDay`-snap).
      const reqFinish = elapsed
        ? (succElapsed ? addCalendarDays(predResult.ef, lag) : se.nextWorkDay(addCalendarDays(predResult.ef, lag)))
        : lagEng.addWorkingDaysSigned(predResult.ef, lag);
      // Een startmijlpaal-opvolger (dagbegin-anker) kan pas op de werkdag ná een
      // dag-eindgrens liggen; na een dagbegin-voorganger (start-/auto-mijlpaal) niet.
      if (succIsStartMs && !predEndsBeginOfDay) return se.nextWorkDayAfter(reqFinish);
      // Voor een ELAPSEDTIME-opvolger moet de terugstap 24/7 klokdagen zijn, niet werkdagen;
      // `deps.startFromFinish` is durationType-bewust (WORKTIME ≡ `se.addWorkingDaysSigned(reqFinish,
      // -succBack)`).
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'START_FINISH': {
      // Opvolger EINDIGT `lag` dagen na de START van de voorganger (zeldzaam). `reqFinish` (de
      // geëiste finish zelf) wordt gedeeld met `sfReqFinishDay` (`forwardFinishFloor`) — één bron.
      const reqFinish = sfReqFinishDay(deps, predResult, predTask, seq, successor, pe, se, flags);
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'FINISH_START':
    default: {
      // Eind-Start: opvolger start de werkdag ná de finish van de voorganger, plus `lag`.
      // Een dagbegin-mijlpaal bezet geen dag, dus die "+1"-overgang geldt dan niet
      // (anders schuift een tussengevoegde mijlpaal de hele keten een dag op). Een
      // eindmijlpaal-opvolger ankert juist op de finish-grens zelf (zelfde daglabel).
      // De finish-grens-snap (nextWorkDayAfter) telt in de VOORGANGER-kalender; de lag daarna
      // in de geselecteerde lagkalender. Elapsed telt vanaf de finish-grens 24/7.
      if (elapsed) {
        const plus = succIsFinishMs || predEndsBeginOfDay ? lag : lag + 1;
        return addCalendarDays(predResult.ef, plus);
      }
      // Kruis-kalender-FS (corpusgeval OzBuild Workshop 14 End Para 29.mpp): bij lag=0 met een IDENTIEKE EFFECTIEVE landingsdag-band (dag-modus: altijd, want dag-modus
      // draagt geen bandtijden om op te verschillen — zie `calendarsAgreeOnSharedWorkdayBands`)
      // snapt de grens rechtstreeks in de OPVOLGER-kalender i.p.v. eerst in de voorganger — anders
      // duwt `pe.nextWorkDayAfter` een extra werkdag van de opvolger (bv. zaterdag bij een
      // 6-dagen-opvolger van een 5-dagen-voorganger) al weg vóórdat `se` ooit gezien wordt.
      // Uitgesloten (het corpusbewijs dekt alleen "twee gewone taken", geen mijlpalen en geen
      // elapsed-opvolgers):
      //  - `succIsFinishMs`/`predEndsBeginOfDay` — de bestaande mijlpaal-grens-takken (die
      //    `predResult.ef` al ONGESNAPT gebruiken) blijven volledig buiten schot.
      //  - `succIsStartMs` — een startmijlpaal-opvolger heeft in deze tak geen eigen kortsluiting
      //    (die zit alleen in FF/SF). Pin: `msp-41-z11-punt2-startmijlpaal-uitgesloten`
      //    (uur-tegenhanger; dezelfde uitsluiting geldt hier).
      //  - `succElapsed` (de opvolger se EIGEN duurtype is ELAPSEDTIME) — zo'n opvolger heeft geen
      //    werk-instant-begrip en accepteert elke kalenderdag; `se.nextWorkDayAfter` zou 'm ten
      //    onrechte naar een WERKdag duwen; zo'n opvolger loopt door de generieke
      //    `pe.nextWorkDayAfter`-tak (een bekend, apart gat). Pin (uur-tegenhanger):
      //    `msp-42-z11-punt2-elapsed-opvolger-uitgesloten`.
      // Géén `lagEng`-naspel ná de shortcut: dat zou via `pe.addWorkingDaysSigned(saturday, 0)` =
      // `pe.nextWorkDay(saturday)` de net vermeden voorganger-snap alsnog achteraf toepassen (pe kent
      // zaterdag niet ⇒ terug naar maandag).
      if (!succIsFinishMs && !predEndsBeginOfDay && !succIsStartMs && !succElapsed && lag === 0
        && calendarsAgreeOnSharedWorkdayBands(pe, se, predResult.ef)) {
        return se.nextWorkDayAfter(predResult.ef);
      }
      const base = succIsFinishMs || predEndsBeginOfDay
        ? predResult.ef
        : pe.nextWorkDayAfter(predResult.ef);
      return lagEng.addWorkingDaysSigned(base, lag);
    }
  }
}

/** De door een SF-relatie geëiste opvolger-FINISH (dag-modus) — gedeeld tussen `forwardDay`'s
 *  `START_FINISH`-tak en `forwardFinishFloor`, zodat er precies ÉÉN plek is die `reqFinish`
 *  berekent. Zelfstandig aanroepbaar (leidt `lag`/`elapsed`/`succElapsed` zelf af uit `deps`/`seq`/
 *  `predTask`/`successor`). */
function sfReqFinishDay(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  pe: CalendarEngine,
  se: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  const lagEng = deps.lagEngine(pe, se);
  const { days: lag, unit } = deps.resolveLag(seq, predTask, lagEng);
  const elapsed = unit === 'ELAPSEDTIME';
  const succElapsed = isElapsedTask(successor);
  const { predStartsNextDay } = flags;
  return elapsed
    ? (succElapsed
        ? addCalendarDays(predResult.es, predStartsNextDay ? lag + 1 : lag)
        : se.nextWorkDay(addCalendarDays(predResult.es, predStartsNextDay ? lag + 1 : lag)))
    : lagEng.addWorkingDaysSigned(
        predStartsNextDay ? pe.nextWorkDayAfter(predResult.es) : predResult.es,
        lag,
      );
}

function backwardDay(
  deps: RelationDeps,
  succResult: { ls: Date; lf: Date },
  seq: Sequence,
  predTask: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  // Spiegel van forwardDay: geef de laatst toegestane FINISH van de voorganger.
  // Kalenderdag-lag snapt hier áchteruit (bovengrens: "niet later dan…") — exact symmetrisch
  // met de vooruit-snap in de forward-pass, zodat een lead geen fantoomfloat oplevert.
  // Spiegel van forwardDay: de lag telt terug in de geselecteerde lagkalender; de
  // FS-gap-spiegel (prevWorkDayBefore) eveneens; de successor-zijde-datums in de successor-kalender.
  const pe = predEng;
  const se = succEng;
  const lagEng = deps.lagEngine(predEng, succEng);
  const { days: lag, unit } = deps.resolveLag(seq, predTask, lagEng);
  const elapsed = unit === 'ELAPSEDTIME';
  // Spiegel van de forward-tak: SS/SF hieronder leiden "predLS → predLF" af via
  // `deps.finishFromStart` (ELAPSEDTIME-voorganger: 24/7 kloktijd), niet inline in WERKdagen. Zie
  // ook `predElapsed` bij de FINISH_START-tak (de `prevWorkDayBefore`-inversie zelf).
  // `predElapsed` gebruikt `isZeroDurationMilestone`, zoals `succElapsed` in de forward-tak. Anders
  // dan daar (msp-33/34) pint geen eigen case deze backward-kant voor een mijlpaal-met-duur-
  // ELAPSEDTIME-voorganger; ze hoort voor consistentie op beide zijden van de relatie te gelden.
  const predElapsed = isElapsedTask(predTask);
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;

  switch (seq.type) {
    case 'START_START': {
      // Forward: succ.start = pred.start(-moment) + lag ⇒ pred.start ≤ succ.lateStart − lag;
      // het startmoment van een eindmijlpaal-voorganger ligt een werkdag vóór die grens.
      const predLS = elapsed
        ? pe.prevWorkDay(addCalendarDays(succResult.ls, -(predStartsNextDay ? lag + 1 : lag)))
        : predStartsNextDay
          ? pe.prevWorkDayBefore(lagEng.addWorkingDaysSigned(succResult.ls, -lag))
          : lagEng.addWorkingDaysSigned(succResult.ls, -lag);
      return deps.finishFromStart(pe, predLS, predTask); // pred.lateFinish — spiegel, zie hierboven
    }
    case 'FINISH_FINISH': {
      // Forward: succ.finish = pred.finish + lag ⇒ pred.finish ≤ succ.lateFinish − lag.
      // Een startmijlpaal-opvolger lag een werkdag ná de finish-grens (zie forward).
      const succLf = succIsStartMs && !predEndsBeginOfDay
        ? se.prevWorkDayBefore(succResult.lf)
        : succResult.lf;
      return elapsed
        ? pe.prevWorkDay(addCalendarDays(succLf, -lag))
        : lagEng.addWorkingDaysSigned(succLf, -lag);
    }
    case 'START_FINISH': {
      // Forward: succ.finish = pred.start(-moment) + lag ⇒ pred.start ≤ succ.lateFinish − lag.
      const predLS = elapsed
        ? pe.prevWorkDay(addCalendarDays(succResult.lf, -(predStartsNextDay ? lag + 1 : lag)))
        : predStartsNextDay
          ? pe.prevWorkDayBefore(lagEng.addWorkingDaysSigned(succResult.lf, -lag))
          : lagEng.addWorkingDaysSigned(succResult.lf, -lag);
      return deps.finishFromStart(pe, predLS, predTask); // spiegel, zie START_START hierboven
    }
    case 'FINISH_START':
    default: {
      // Eind-Start: opvolger start `lag` dagen na de finish (de werkdag erná voor een echte
      // taak; bij een dagbegin-mijlpaal-voorganger of eindmijlpaal-opvolger géén extra dag).
      // Terug-inverteren; de FS-gap-spiegel (prevWorkDayBefore) telt in de VOORGANGER-kalender.
      if (elapsed) {
        const plus = succIsFinishMs || predEndsBeginOfDay ? lag : lag + 1;
        return pe.prevWorkDay(addCalendarDays(succResult.ls, -plus));
      }
      const target = lagEng.addWorkingDaysSigned(succResult.ls, -lag);
      if (succIsFinishMs || predEndsBeginOfDay) return target;
      // `prevWorkDayBefore` inverteert de forward-tak se `pe.nextWorkDayAfter` (die STRIKT
      // vooruitstapt) — voor een ELAPSEDTIME-voorganger bestaat dat "werkdag ervoor"-begrip niet:
      // zijn late finish mag op ELKE kalenderdag liggen (bv. zondag), en `prevWorkDayBefore` zou die
      // een heel weekend terugknijpen (spook-negatieve speling). De losste, float-neutrale inverse
      // van "+1 dag, dan volgende werkdag" is hier kaal "−1 kalenderdag" (msp-18).
      if (predElapsed) return addCalendarDays(target, -1);
      return pe.prevWorkDayBefore(target);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  UUR-/CROSS-modus (engaged zodra minstens één zijde uur-modus is).
//  Spiegelt de dag-formules met instant-primitieven: `prevWorkInstantBefore` ↔
//  `nextWorkInstantAfter`, `subtractWorkMinutes` ↔ `addWorkMinutes`, lag terug in de
//  lag-engine uit `deps.lagEngine` (`schedulingOptions.lagCalendar`, default de voorganger).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Landing van een rauwe voorganger-instant op de opvolger, gedeeld door `forwardHour` en
 * `sfReqFinishHour`: de rauwe instant is een uur-precisie `Date` uit de
 * VOORGANGER-kalender. Is de opvolger zelf ook uur-modus, dan is dat instant al geldig — gewoon
 * teruggeven. Is de opvolger DAG-modus, dan mag de tijd-component niet blijven hangen: `nextWorkDay`
 * behoudt "tijd-van-de-dag" op een niet-middernacht-`Date` (het is een dag-primitief, geen
 * instant-primitief), dus zonder eerst naar `startOfDay` te normaliseren rapporteert de taak een
 * correct ogende dag met een spook-tijdscomponent erin — onzichtbaar in dag-geformatteerde
 * datums, maar `workDaysBetween`/`workMinutesBetween` tellen 'm wél mee, met een speling die één
 * werkdag te laag uitvalt (tf=2 waar de dag-referentie tf=3 geeft).
 * Voor een ELAPSEDTIME-opvolger op een DAG-kalender mag
 * ook déze landing niet naar de eerstvolgende WERKdag schuiven (`se.nextWorkDay`) — een 24/7-
 * opvolger accepteert elke kalenderdag. `elapsedLanding` selecteert per aanroep-site welke variant
 * geldt (de kortsluitingen gebruiken 'm alleen wanneer `succElapsed` al vaststaat).
 */
function landRawInstant(deps: RelationDeps, se: CalendarEngine, raw: Date, elapsedLanding = false): Date {
  return se.isHourMode ? raw : elapsedLanding ? deps.startOfDay(raw) : se.nextWorkDay(deps.startOfDay(raw));
}

function forwardHour(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  pe: CalendarEngine,
  se: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  const lagEng = deps.lagEngine(pe, se);
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;
  const elapsedMin = () => deps.resolveElapsedMinutes(seq, predTask) * MS_PER_MIN;
  // Zie forwardDay se `succElapsed` — dezelfde definitie, hier voor de uurtak. Een
  // ELAPSEDTIME-opvolger heeft dezelfde behoefte als een EINDmijlpaal-opvolger (geen
  // werk-instant-normalisatie op zijn geëiste finish, want 24/7), dus de kortsluitingen hieronder
  // gelden voor `succIsFinishMs || succElapsed`.
  const succElapsed = isElapsedTask(successor);

  // MSP-pariteit: een EINDmijlpaal-opvolger
  // zonder échte lag landt op de RAUWE voorganger-instant (bv. di 17:00) i.p.v. de eerstvolgende
  // werk-instant erna — `nextWorkInstant`/`availableStart` normaliseren met de FORWARD-conventie
  // `[start,end)`, die een instant exact op een band-EIND per definitie uitsluit (precies de rand
  // waarop een finish legitiem landt: `finishFromStart` bouwt `ef` met `(start,end]`). Geldt voor
  // alle vier relatietypes (FS/FF/SF hebben elk hun eigen "rauwe kandidaat-instant"; SS eindigt
  // nooit op de opvolger-FINISH, dus buiten scope) — vandaar één gedeelde landings-helper
  // (`landRawInstant`) i.p.v. een aparte kortsluiting per arm.

  switch (seq.type) {
    case 'START_START': {
      const base = predStartsNextDay ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
      // Uur-analoog van forwardDay's SS hierboven: de
      // `deps.snapOnOrAfter(se, …)`-omhulling forceert een werk-instant van de OPVOLGER-kalender —
      // voor een ELAPSEDTIME-opvolger juist niet gewenst (de `shiftLagPred`/`elapsedMin`-uitkomst
      // zelf blijft ongemoeid: die interpreteert de LAG in de geselecteerde lagkalender, een
      // orthogonale vraag). `succElapsed`: geef de ongesnapte waarde terug.
      if (elapsed) {
        const raw = new Date(base.getTime() + elapsedMin());
        return succElapsed ? raw : deps.snapOnOrAfter(se, raw);
      }
      // BEKENDE BEPERKING (niet gefixt): `deps.shiftLagPred` normaliseert bij lag=0 zelf óók via
      // `nextWorkInstant(base)`, in de VOORGANGER-engine — vóór de `succElapsed`-check hieronder.
      // Is `predTask` zelf ELAPSEDTIME met een rauwe `base` buiten elke band, dan snapt deze regel
      // `base` alsnog naar een werk-instant van de voorganger. FF/SF ontsnappen hieraan via hun
      // `lagIsZero`-mechanisme (`landRawInstant`); SS heeft dat niet. `shiftLagPred` is een gedeeld
      // pad met 9 aanroepplekken, dus een blinde aanpassing raakt FF/SF mee; het gat is smal
      // (ELAPSEDTIME-voorganger volledig buiten de banden) en gepind in msp-pariteit.
      const lagged = deps.shiftLagPred(lagEng, base, seq, predTask, 1);
      return succElapsed ? lagged : deps.snapOnOrAfter(se, lagged);
    }
    case 'FINISH_FINISH': {
      // MSP-pariteit: `startFromFinish` geeft voor een mijlpaal-opvolger `reqFinish` ONGEWIJZIGD
      // terug; zonder kortsluiting zou `shiftLagPred` `reqFinish` ook bij lag=0 vooraf snappen en
      // landt een FF-eindmijlpaal nooit op de rauwe voorganger-finish. Zelfde `lagIsZero`-kortsluiting als de FS-tak
      // hieronder, hier tegen `predResult.ef` (de FF-relatie ankert al op de finish, geen aparte
      // dagrand-normalisatie nodig zoals FS se `predDone`).
      let reqFinish: Date;
      if (elapsed) {
        reqFinish = succElapsed
          ? new Date(predResult.ef.getTime() + elapsedMin())
          : deps.snapOnOrAfter(se, new Date(predResult.ef.getTime() + elapsedMin()));
      } else {
        const lagged = deps.shiftLagPred(lagEng, predResult.ef, seq, predTask, 1);
        if ((succIsFinishMs || succElapsed) && pe.isHourMode
          && lagged.getTime() === deps.snapOnOrAfter(lagEng, predResult.ef).getTime()) {
          reqFinish = landRawInstant(deps, se, predResult.ef, succElapsed);
        } else {
          reqFinish = lagged;
        }
      }
      if (succIsStartMs && !predEndsBeginOfDay) return deps.snapStrictAfter(se, reqFinish);
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'START_FINISH': {
      // MSP-pariteit: zelfde redenering als FINISH_FINISH hierboven, maar het
      // rauwe anker is hier `startMoment` (de voorganger-START-zijde, incl. dagbegin-mijlpaal-
      // correctie) i.p.v. `predResult.ef` — SF ankert de opvolger-finish op de voorganger-START.
      // `reqFinish` (de geëiste finish zelf) wordt gedeeld met `sfReqFinishHour`
      // (`forwardFinishFloor`) — één bron.
      const reqFinish = sfReqFinishHour(deps, predResult, predTask, seq, successor, pe, se, flags);
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'FINISH_START':
    default: {
      // FS: de opvolger consumeert de exclusieve "beschikbaar-vanaf"-instant van de
      // voorganger via `availableStart` — die ceilt een dag-opvolger correct naar de volgende
      // volledige werkdag (scenario 7 uur→dag) en snapt een uur-opvolger naar de eerstvolgende
      // werk-instant (scenario 1/6). Lag telt daarvóór in de voorganger-engine.
      if (elapsed) {
        // MSP-pariteit: een ELAPSEDTIME-lag van exact 0 klok-minuten is dezelfde "geen échte
        // lag"-situatie als de WORKTIME-tak hieronder, zodat een elapsed-FS-eindmijlpaal op de rauwe
        // instant landt. Geen `lagIsZero`-vergelijking nodig: 0 klok-minuten is geen verschuiving.
        // Anker is `predResult.ef` RECHTSTREEKS, NIET `predDone`: die dag-boundary-+1 is een
        // WORKTIME-concept en schuift een dag-pred-scenario een dag op (`elapsed-day-to-hour` in
        // cases-hours.json).
        const target = new Date(predResult.ef.getTime() + elapsedMin());
        if (succIsFinishMs && pe.isHourMode && elapsedMin() === 0) {
          return landRawInstant(deps, se, target);
        }
        return se.availableStart(target);
      }
      // P6/XER bewaart bij een expliciet bronpatroon de gedeelde finish/startgrens als de
      // opvolger-ES: geplande opvolgerstart == geplande voorgangerfinish, nul-lag FS, exact op een
      // kalenderbandeinde. De reader zet de vlag uitsluitend uit toegestane invoervelden; zonder
      // vlag geldt de algemene halfopen-bandsemantiek hieronder.
      if (seq.p6StartAtPredecessorFinishBoundary) return predResult.ef;
      const predDone = (succIsFinishMs || predEndsBeginOfDay)
        ? predResult.ef                       // mijlpaal-grens: geen dag-boundary-+1 (dag-conceptueel)
        : pe.predDoneAt(predResult.ef);
      const lagged = deps.shiftLagPred(lagEng, predDone, seq, predTask, 1);
      // `lagIsZero`: "de geshifte waarde == wat een kale
      // nul-lag-normalisatie in de VOORGANGER zou geven" ⇒ er is geen échte lag toegepast. Vereist
      // `pe.isHourMode`: `nextWorkInstant` is een uur-modus-primitief (non-null assertion op
      // `workTime`) — bij een DAG-voorganger (cross-modus) crasht de aanroep, vandaar de wacht.
      const lagIsZero = pe.isHourMode
        && lagged.getTime() === deps.snapOnOrAfter(lagEng, predDone).getTime();
      // Kruis-kalender-FS (uur-analoog van de dag-tak in `forwardDay`): bij lag=0 met IDENTIEKE
      // effectieve landingsdag-band (`calendarsAgreeOnSharedWorkdayBands`) snapt de grens rechtstreeks in de OPVOLGER-kalender i.p.v. eerst in de voorganger — anders
      // duwt `pe.nextWorkInstant` (via `shiftLagPred`, hier al toegepast in `lagged`) een extra
      // werkdag van de opvolger (bv. een werkende zaterdag) al weg vóórdat `se` ooit gezien wordt
      // (corpusloos gepind: msp-38/msp-39 in cases-msp-pariteit.json). Beperkt tot hour-hour (`se.isHourMode`, naast `lagIsZero`s eigen
      // `pe.isHourMode`-wacht): een cross-modus-combinatie is hier niet gereconstrueerd of getoetst.
      // Uitgesloten (spiegelt de dag-tak hierboven één-op-één, zie de redenering daar):
      //  - `succIsFinishMs`/`predEndsBeginOfDay` — de bestaande mijlpaal-grens-tak (eigen, al geteste
      //    kortsluiting, hieronder) blijft volledig met rust.
      //  - `succIsStartMs` — geen eigen kortsluiting in deze tak; pin:
      //    `msp-41-z11-punt2-startmijlpaal-uitgesloten`.
      //  - `succElapsed` — een 24/7-opvolger accepteert elke instant; `se.availableStart` zou 'm ten
      //    onrechte naar een werk-instant snappen; zo'n opvolger loopt door de generieke tak (een
      //    bekend, apart gat). Pin: `msp-42-z11-punt2-elapsed-opvolger-uitgesloten`.
      // Dit raakt uitsluitend het "twee gewone taken"-pad. Zónder de discriminator (bandgrenzen die
      // OP DE LANDINGSDAG zelf verschillen, zoals de guard-case) blijft het bestaande
      // voorganger-eerst-gedrag staan: de `if` hieronder faalt dan gewoon en de functie valt door
      // naar `se.availableStart(lagged)`.
      if (!succIsFinishMs && !predEndsBeginOfDay && !succIsStartMs && !succElapsed
        && se.isHourMode && lagIsZero
        && calendarsAgreeOnSharedWorkdayBands(pe, se, predDone)) {
        return se.availableStart(predDone);
      }
      // MSP-pariteit: een EINDmijlpaal-opvolger zonder lag landt op de RAUWE
      // voorganger-finish-instant (bv. di 17:00) — niet op de eerstvolgende werk-instant erna.
      // `shiftLagPred`/`availableStart` normaliseren via `nextWorkInstant` (rand `[start,end)`),
      // dat is de FORWARD-conventie en sluit een instant exact op een band-EIND per definitie
      // uit — precies de rand waar een finish legitiem op landt (`finishFromStart` bouwt `ef`
      // zelf met de `(start,end]`-conventie). Bij lag=0 reduceert `shiftLagPred` dus altijd tot
      // een overbodige — en hier SCHADELIJKE — dubbele snap, ook al onderdrukt `predEndsBeginOfDay
      // || succIsFinishMs` hierboven al de dag-boundary-+1. `predDone` is in dat geval al een
      // geldige instant (hij komt rechtstreeks van `predResult.ef`, dus geen `nextWorkInstant`-
      // aanroep nodig zoals bij backward's spiegel (`prevWorkInstant`, die een niet-gegarandeerde
      // `succResult.ls` alsnog moet normaliseren — hier ligt de garantie al bij de bron).
      // `lagIsZero` is dezelfde detectietruc als de bestaande backward-arm (hour-hour FS default,
      // hierboven in dit bestand): "de geshifte waarde == wat een kale nul-lag-normalisatie zou
      // geven" ⇒ er is geen echte lag toegepast.
      // GEEN `!predEndsBeginOfDay`-subconditie. Een voorganger-anker ligt NIET altijd in
      // `[start,end)` van de eigen kalender: de dataDate-vloer ("NIET GESTART", CPMSolver's forwardPass) zet de ES van
      // een niet-gestarte nul-duur-voorganger (géén mijlpaal per se — `predEndsBeginOfDay` slaat
      // hier al aan bij `scheduleDuration<=0`) op `dataDate`, dat zelf gesnapt is in de PROJECT-
      // kalender, niet in de EIGEN kalender van die voorganger. Verschillen die twee kalenders van
      // bandstructuur, dan kan zo'n anker WÉL exact op een band-eind van zijn EIGEN kalender
      // landen — precies de dataDate-vloer-constructie die case msp-06 in cases-msp-pariteit.json
      // vastlegt (daar voor de SF-tak). Hetzelfde mechanisme geldt hier voor `predEndsBeginOfDay`
      // in de FS-tak: de MSP-conventie geldt dus BEWUST ook voor dat geval, geen no-op — gepind door
      // de tweelingcase msp-06b (idem, maar FS i.p.v. SF).
      // `pe.isHourMode`-wacht is VERPLICHT (nu binnen `lagIsZero` hierboven): `nextWorkInstant` is
      // een uur-modus-primitief (`bandsStartingOn` leest `calendar.workTime!.byWeekday` zonder
      // guard) — bij een DAG-voorganger (cross-modus, bv. `rr-fs-crossmode-daypred-hourfinishms`)
      // zou de aanroep crashen op de non-null assertion. Die combinatie loopt correct via de
      // dag-lag-tak van `shiftLagPred` + `availableStart`.
      if (succIsFinishMs && lagIsZero) return landRawInstant(deps, se, predDone);
      return se.availableStart(lagged);
    }
  }
}

/** De door een SF-relatie geëiste opvolger-FINISH (uur-modus) — gedeeld tussen `forwardHour`'s
 *  `START_FINISH`-tak en `forwardFinishFloor`, zodat er precies ÉÉN plek is die `reqFinish`
 *  berekent (spiegelt `sfReqFinishDay`). */
function sfReqFinishHour(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  pe: CalendarEngine,
  se: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  const lagEng = deps.lagEngine(pe, se);
  const { predStartsNextDay, succIsFinishMs } = flags;
  const elapsedMin = () => deps.resolveElapsedMinutes(seq, predTask) * MS_PER_MIN;
  const succElapsed = isElapsedTask(successor);

  const startMoment = predStartsNextDay ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
  if (elapsed) {
    return succElapsed
      ? new Date(startMoment.getTime() + elapsedMin())
      : deps.snapOnOrAfter(se, new Date(startMoment.getTime() + elapsedMin()));
  }
  const lagged = deps.shiftLagPred(lagEng, startMoment, seq, predTask, 1);
  if ((succIsFinishMs || succElapsed) && pe.isHourMode
    && lagged.getTime() === deps.snapOnOrAfter(lagEng, startMoment).getTime()) {
    return landRawInstant(deps, se, startMoment, succElapsed);
  }
  return lagged;
}

function backwardHour(
  deps: RelationDeps,
  succResult: { ls: Date; lf: Date },
  seq: Sequence,
  predTask: Task,
  pe: CalendarEngine,
  se: CalendarEngine,
  flags: RelationBoundaryFlags,
): Date {
  const elapsed = seq.lagUnit === 'ELAPSEDTIME';
  const lagEng = deps.lagEngine(pe, se);
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;
  const elapsedMin = () => deps.resolveElapsedMinutes(seq, predTask) * MS_PER_MIN;
  // Zie backwardDay se `predElapsed` — dezelfde definitie en status, hier voor de uur-FS-tak
  // (`prevWorkInstant` hieronder is de uur-tegenhanger van `prevWorkDayBefore`, met dezelfde
  // over-knijp-fout voor een ELAPSEDTIME-voorganger).
  const predElapsed = isElapsedTask(predTask);

  switch (seq.type) {
    case 'START_START': {
      const shifted = elapsed
        ? new Date(succResult.ls.getTime() - elapsedMin())
        : deps.shiftLagPred(lagEng, succResult.ls, seq, predTask, -1);
      const predStart = predStartsNextDay ? deps.snapStrictBefore(pe, shifted)
        : elapsed ? deps.snapOnOrBefore(pe, shifted) : shifted;
      return deps.finishFromStart(pe, predStart, predTask);
    }
    case 'FINISH_FINISH': {
      const succLf = (succIsStartMs && !predEndsBeginOfDay) ? deps.snapStrictBefore(se, succResult.lf) : succResult.lf;
      if (elapsed) {
        return deps.snapOnOrBefore(pe, new Date(succLf.getTime() - elapsedMin()));
      }
      return deps.shiftLagPred(lagEng, succLf, seq, predTask, -1);       // pred.LF
    }
    case 'START_FINISH': {
      const shifted = elapsed
        ? new Date(succResult.lf.getTime() - elapsedMin())
        : deps.shiftLagPred(lagEng, succResult.lf, seq, predTask, -1);
      const predStart = predStartsNextDay ? deps.snapStrictBefore(pe, shifted)
        : elapsed ? deps.snapOnOrBefore(pe, shifted) : shifted;
      return deps.finishFromStart(pe, predStart, predTask);
    }
    case 'FINISH_START':
    default: {
      if (elapsed) {
        // Klok-minuten terug vanaf succ.LS, dan achteruit-snap in de voorganger.
        return deps.snapOnOrBefore(pe, new Date(succResult.ls.getTime() - elapsedMin()));
      }
      // B1 (`p6StartAtPredecessorFinishBoundary`) heeft backward GEEN eigen tak: de gewone
      // FS-backward hieronder legt de late finish van de voorganger al op de finishgrens op of vóór
      // de LS van de opvolger (`prevWorkInstant` op de voorgangerkalender). Een rauwe
      // `return succ.LS` is fout (fixture-mutant).
      const succDayStart = () => deps.startOfDay(succResult.ls);
      if (pe.isHourMode && se.isHourMode) {
        // hour-hour: pred.LF = prevWorkInstant( succ.LS ⊖ lag ) (scenario 1-6 backward).
        // De grensvlaggen onderdrukken UITSLUITEND de finish-/band-gap-normalisatie, NOOIT de lag —
        // exact zoals de dag-tak, die `addWorkingDaysSigned(succ.LS, −lag)` onvoorwaardelijk toepast
        // en de vlaggen alleen over `prevWorkDayBefore` laat beslissen (anders forward/backward-
        // asymmetrie en een float-/kritiek-pad-verschil met dag-modus).
        // Uitzondering: bij lag = 0 reduceert `shiftLagPred` tot de kale `nextWorkInstant`-
        // normalisatie (zie `addWorkingMinutesSigned`, m===0). Dat geval houdt bewust het
        // ONgenormaliseerde `succ.LS`-anker aan — het dagbegin-mijlpaal-gedrag dat hieronder
        // beschreven staat en dat de zusjes-cases rr-fs-pred-startms(-dagpariteit) vastleggen.
        const lagged = deps.shiftLagPred(lagEng, succResult.ls, seq, predTask, -1);
        const lagIsZero = lagged.getTime() === deps.snapOnOrAfter(lagEng, succResult.ls).getTime();
        const target = (predEndsBeginOfDay || succIsFinishMs) && lagIsZero
          ? succResult.ls
          : lagged;
        // Dag/uur-pariteit: een dagbegin-mijlpaal-voorganger (start-/auto-mijlpaal, oftewel
        // `predEndsBeginOfDay`) heeft geen echte finish-instant — zijn "finish" is een dagbegin-
        // anker. `prevWorkInstant` is de FINISH-normalisatie (rand `(start,end]`) en zou dat anker
        // naar het vorige band-eind terugtrekken, terwijl de dag-tak hier juist GEEN
        // `prevWorkDayBefore` doet en het doeldatum-label behoudt. Work-equivalent (nul werk
        // ertussen ⇒ zelfde float), maar representatief divergent ⇒ hier overslaan.
        // Bij `succIsFinishMs` is de voorganger wél een echte taak met een echte finish; daar
        // blijft de normalisatie staan (de vlag onderdrukt alleen de band-gap, net als in dag-modus).
        if (predEndsBeginOfDay) return target;
        // `prevWorkInstant` is de uur-tegenhanger van `prevWorkDayBefore` (dag-modus) — zelfde
        // over-knijp-fout voor een ELAPSEDTIME-voorganger (die geen werk-instant-begrip heeft, zijn
        // late finish mag op elk klokmoment liggen). In tegenstelling tot de dag-tak (die een
        // strikte "volgende WERKdag"-stap moet inverteren, vandaar −1 kalenderdag) is `nextWorkInstant`
        // hier INCLUSIEF `[start,end)` — een al-geldige instant blijft zichzelf — dus de kale
        // ongesnapte `target` IS al de juiste (losste) inverse, zonder verdere aftrek.
        if (predElapsed) return target;
        return pe.prevWorkInstant(target);
      }
      if (pe.isHourMode && !se.isHourMode) {
        // (a) uur-voorganger, dag-opvolger: klaar vóór de middernacht van de succ-startdag.
        // GEEN grensvlaggen — bewust, geen omissie. De vlaggen
        // onderdrukken in `forwardHour` uitsluitend de dagrand van `pe.predDoneAt(ef)`, maar `pe` is
        // in deze arm per definitie UUR-modus en daar is `predDoneAt` de identiteit
        // (`CalendarEngine.predDoneAt`, mode 'hour' ⇒ `new Date(ef)`). Beide takken van die ternaire
        // leveren dus dezelfde instant; er is forward niets te onderdrukken en backward niets te
        // spiegelen. Vlaggen hier alsnog toevoegen zou werkend gedrag breken.
        const target = deps.shiftLagPred(lagEng, succDayStart(), seq, predTask, -1);
        // Cross-modus: zelfde `prevWorkInstant`-over-knijp als de hour-hour-arm hierboven.
        if (predElapsed) return target;
        return pe.prevWorkInstant(target);
      }
      // (b) dag-voorganger, uur-opvolger: de grootste werkdag d waarvoor de forward-afleiding
      // se.nextWorkInstant( predDone(d) ⊕ lag ) ≤ succ.LS blijft (scenario 7 backward).
      // BEKENDE BEPERKING (niet gefixt, gepind in msp-26): deze scanlus doorzoekt alleen WERKdagen
      // van de dag-voorganger (`pe.isWorkDay(d)`) — te smal voor een ELAPSEDTIME dag-voorganger,
      // wiens late finish ook op een niet-werkdag mag liggen. Gevolg: een te vroege late finish, met
      // `ls` vóór het eigen `es`, negatieve `tf` zonder constraint en `ff ≤ tf` gebroken. Een fix
      // vergt een kalenderdag-scan i.p.v. een werkdag-scan.
      // De grensvlaggen tellen hier WÉL — in tegenstelling tot arm (a) is `pe` dag-modus en levert
      // `predDoneAt(ef)` de dagrand `(ef+1 dag)@00:00`, die `forwardHour` bij een vlag onderdrukt
      // (`predDone = (succIsFinishMs || predEndsBeginOfDay) ? ef : pe.predDoneAt(ef)`). Zonder die
      // spiegel komen de late datums één werkdag te vroeg (tf −1 zonder constraint; zie
      // rr-fs-crossmode-daypred-hourms-slack).
      const noDayBoundary = succIsFinishMs || predEndsBeginOfDay;
      let d = succDayStart();
      for (let scan = 0; scan <= HOUR_SCAN; scan++) {
        if (pe.isWorkDay(d)) {
          const predDone = noDayBoundary
            ? new Date(d.getTime())                                  // mijlpaal-grens: dagbegin-anker
            : new Date(d.getTime() + MS_PER_DAY);                    // (d+1)@00:00
          // Spiegel exact de forward-pass: de geselecteerde XER-lagkalender verschuift het anker,
          // ook wanneer voorganger en opvolger verschillende kalenderprecisies gebruiken.
          const shifted = deps.shiftLagPred(lagEng, predDone, seq, predTask, 1);
          if (se.nextWorkInstant(shifted).getTime() <= succResult.ls.getTime()) return d;
        }
        d = addCalendarDays(d, -1);
      }
      return deps.snapOnOrBefore(pe, succDayStart());   // best effort (kapotte kalender)
    }
  }
}
