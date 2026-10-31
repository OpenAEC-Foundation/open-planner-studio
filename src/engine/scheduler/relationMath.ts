import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { CalendarEngine } from './CalendarEngine';
import { elapsedMilliseconds, isElapsedTask, isZeroDurationMilestone } from './duration';

/**
 * Relatie-wiskunde (FS/SS/FF/SF) voor `CPMSolver.ts`, forward en backward, op de tijdas in minuten.
 *
 *  1. **Forward en backward naast elkaar** — per richting één ingang
 *     (`forwardConstraint`/`backwardConstraint`) die per relatietype dispatcht. LET OP: de
 *     spiegel-invariant (backward = spiegel van forward) is een conventie tussen twee parallelle
 *     switch-armen, geen afgedwongen code-eigenschap; de suite (cases-hours-relations) pint beide
 *     richtingen vast.
 *  2. **Mijlpaal-grensvlaggen één keer** — `relationBoundaryFlags` berekent de vier grensvlaggen op
 *     één plek; forward en backward krijgen ze aangereikt.
 *  3. **Eén pad (alleen uren, F6)** — elke engine in een solve rekent op werkblokken (de solver
 *     stopt vooraf bij een kalender zonder werktijd). Het vroegere dagpad (`forwardDay`,
 *     `sfReqFinishDay`, `backwardDay`) en de kruistakken met één dag-kant zijn weg. Een taak in de
 *     dagenmaat loopt via `isDayTaskOnBands` op hetzelfde pad.
 */

// Milliseconden per minuut (tijdas).
export const MS_PER_MIN = 60_000;

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
 * Randgevallen: `effectiveBandsOn` geeft `[]` terug zodra DIE kalender op `onDate` niet werkt
 * (een holiday of een niet-werkende weekdag). **Beide leeg** ⇒ `true` (geen band om op te
 * struikelen). **Eén van de twee leeg, de ander niet** ⇒
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
 *  - CORPUSGEVAL (OzBuild Workshop 14 End Para 29.mpp; gevonden toen dit bestand nog in dagmodus
 *    rekende, vóór F2, met op de landingsdag (vrijdag) voor "Standard" en "6 Day Week" beide geen
 *    bandtijden ⇒ `true` ⇒ opvolger-eerst). Met opvolger-eerst snapt de FS-grens direct in "6 Day Week", die
 *    zaterdag WEL kent — de MSP-datum (zaterdag) komt daarmee binnen bereik i.p.v. de voorganger-
 *    eerst-snap die 'm over het hele weekend naar maandag duwt.
 *  - GUARD-CASE (msp-04-m2-guard1-alleen-crosscalendar, uur-modus): op de landingsdag (dinsdag) is
 *    P se effectieve band `[08:00,17:00)` en Q se `[09:00,18:00)` — verschillend ⇒ `false` ⇒
 *    voorganger-eerst blijft behouden — exact het bestaande, doelbewust geteste gedrag.
 *
 * Spiegelgeval: `backwardHour` kent deze tak BEWUST niet: hun FS-default-arm bouwt `succResult.ls` niet via eenzelfde pred-dan-succ-
 * dubbele-snap-keten (die komt al gesnapt binnen, uit de eigen backward-pass van de opvolger), dus
 * er is daar niets te "kortsluiten". De tak hier is bovendien veilig: `se.nextWorkInstant(...)` levert altijd al een
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

/** De primitieven die de relatie-wiskunde nodig heeft. Blijven in `CPMSolver` gedefinieerd (ze delen
 *  daar de lag- en snapregels met de rest van de solver) en worden hier geïnjecteerd, zodat de
 *  relatie-wiskunde puur en op één plek staat zonder de helpers te dupliceren. */
export interface RelationDeps {
  /** Selecteert de projectgebonden kalender waarin WORKTIME-relatielag telt. */
  lagEngine(predEng: CalendarEngine, succEng: CalendarEngine): CalendarEngine;
  resolveEffectiveLagDays(seq: Sequence, predTask: Task, predEng: CalendarEngine): number;
  resolveElapsedMinutes(seq: Sequence, predTask: Task): number;
  shiftLagPred(predEng: CalendarEngine, base: Date, seq: Sequence, predTask: Task, sign: 1 | -1): Date;
  startFromFinish(eng: CalendarEngine, finish: Date, task: Task): Date;
  finishFromStart(eng: CalendarEngine, start: Date, task: Task): Date;
  snapOnOrAfter(eng: CalendarEngine, d: Date): Date;
  snapOnOrBefore(eng: CalendarEngine, d: Date): Date;
  snapStrictAfter(eng: CalendarEngine, d: Date): Date;
  snapStrictBefore(eng: CalendarEngine, d: Date): Date;
  /** Alleen uren §3.14: telt deze taak in de dagenmaat (de hulpfunctie `taskCountsInWorkdays` met de
   *  effectieve conventie `workdayDurationMeasure`)? */
  countsInWorkdays(task: Task): boolean;
}

/**
 * Forward-relatie-grens: geef de door de relatie geëiste vroegste START van de opvolger.
 * De projectstart-ondergrens en de max-over-voorgangers worden in de forward-pass toegepast
 * (relaties zijn ondergrenzen, geen gelijkheden).
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
  return forwardHour(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
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
  return sfReqFinishHour(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
}

/**
 * Backward-relatie-grens: geef de laatst toegestane FINISH van de voorganger (spiegel van
 * `forwardConstraint`).
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
  return backwardHour(deps, succResult, seq, predTask, predEng, succEng, flags);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Het pad op de tijdas in minuten, met instant-primitieven: `prevWorkInstantBefore` ↔
//  `nextWorkInstantAfter`, `subtractWorkMinutes` ↔ `addWorkMinutes`, lag terug in de
//  lag-engine uit `deps.lagEngine` (`schedulingOptions.lagCalendar`, default de voorganger).
// ═══════════════════════════════════════════════════════════════════════════

/** `d` ligt binnen werktijd van `eng` en is daar zowel een geldig eind (`(start,end]`) als een geldig
 *  begin (`[start,end)`): dus geen blokbegin, geen blokeinde en geen pauze. */
function isInsideBlock(eng: CalendarEngine, d: Date): boolean {
  const t = d.getTime();
  return eng.prevWorkInstant(d).getTime() === t && eng.nextWorkInstant(d).getTime() === t;
}

/**
 * Een taak die in de dagenmaat telt (alleen uren §3.14) op een kalender met werkblokken: geen
 * urenmaat, geen 0-duurmijlpaal, geen ELAPSEDTIME, en de conventie `workdayDurationMeasure` aan
 * (`deps.countsInWorkdays`). Een dagenmaat-taak in een profiel zonder dagenmaat (P6, MSP) telt als
 * urenmaat en valt hier dus buiten. De grensregels hieronder (knownbugs 142, T8) houden een eindmoment
 * op een blokbegin bij de dag ervoor; de dagenmaat-lopers lezen dat moment op dezelfde plek.
 */
function isDayTaskOnBands(deps: RelationDeps, task: Task): boolean {
  return !isZeroDurationMilestone(task) && !isElapsedTask(task) && deps.countsInWorkdays(task);
}

/**
 * Knownbugs 142: een eindmoment `moment` op een blokbegin van `lagEng` als het vorige blokeinde,
 * maar ALLEEN als dat voor de dagtaak die het leest (`readerEng`) werkelijk dezelfde grens is: daar
 * een geldig eindmoment (`(start,end]`) en geen werktijd tussen beide. Anders blijft `moment`
 * staan (het gedrag van vóór de fix). Voorbeeld waar het NIET mag: de opvolger heeft op dat
 * blokeinde een vrije dag; dan zou ze vóór haar voorganger eindigen.
 * `floor` (optioneel): een eis die niet vóór dit rauwe moment lag, niet tot vóór dit moment terugzetten
 * — de rauwe voorgangerfinish bij een FF-ondergrens, die voor een ELAPSEDTIME- of werkelijke finish
 * buiten werktijd kan liggen (A eindigt di 08:00 ⇒ B niet ma 16:00). Een lead ligt al vóór de finish
 * en valt hier niet onder.
 */
function previousBlockEndIfSame(
  deps: RelationDeps,
  lagEng: CalendarEngine,
  readerEng: CalendarEngine,
  moment: Date,
  floor?: Date,
): Date {
  const back = deps.snapOnOrBefore(lagEng, moment);
  if (back.getTime() === moment.getTime()) return moment;
  if (floor && moment.getTime() >= floor.getTime() && back.getTime() < floor.getTime()) return moment;
  if (readerEng.prevWorkInstant(back).getTime() !== back.getTime()) return moment;
  if (readerEng.workMinutesBetween(back, moment) !== 0) return moment;
  return back;
}

/**
 * Alleen uren §3.14: een dagenmaat-opvolger mag over FF niet vóór de geëiste finish `rawRequired` klaar
 * zijn. De dagenmaat leest een eindmoment op een blokbegin als het einde van de werkdag ervoor. Ligt dat
 * vorige blokeinde vóór `rawRequired` (de opvolger werkt daar niet, of de voorganger eindigt rauw buiten
 * zijn werktijd), dan moet de opvolger op de volgende werkdag nog werken. De geëiste finish wordt dan het
 * einde van die werkdag, zoals F2 een hele dag telde (`bg142-*` in `cases-hours-blokgrenzen.json`,
 * `lagadv-ff-lead-ed`). Een finish die de opvolger al als eindmoment kan halen, blijft staan.
 */
function workdayFinishNotBefore(se: CalendarEngine, reqFinish: Date, rawRequired: Date): Date {
  if (se.prevWorkInstant(reqFinish).getTime() >= rawRequired.getTime()) return reqFinish;
  return se.measuredWorkdayEnd(se.nextWorkInstant(reqFinish));
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
  const { predEndsBeginOfDay, predStartsNextDay, succIsStartMs } = flags;
  // Zonder soort volgt een nulduurmijlpaal de bindende eindrelatie (N1).
  const succIsFinishMs = flags.succIsFinishMs || (isZeroDurationMilestone(successor)
    && !successor.milestoneKind && (seq.type === 'FINISH_FINISH' || seq.type === 'START_FINISH'));
  const elapsedMin = () => elapsedMilliseconds(deps.resolveElapsedMinutes(seq, predTask));
  // `succElapsed` gebruikt `isZeroDurationMilestone` (via `isElapsedTask`), niet de kale vlag: een
  // mijlpaal-met-duur die ELAPSEDTIME is, telt mee (msp-30). Een ELAPSEDTIME-opvolger heeft dezelfde
  // behoefte als een EINDmijlpaal-opvolger (geen werk-instant-normalisatie op zijn geëiste finish,
  // want 24/7), dus de kortsluitingen hieronder gelden voor `succIsFinishMs || succElapsed`.
  const succElapsed = isElapsedTask(successor);

  // MSP-pariteit: een EINDmijlpaal-opvolger
  // zonder échte lag landt op de RAUWE voorganger-instant (bv. di 17:00) i.p.v. de eerstvolgende
  // werk-instant erna — `nextWorkInstant` normaliseert met de FORWARD-conventie
  // `[start,end)`, die een instant exact op een band-EIND per definitie uitsluit (precies de rand
  // waarop een finish legitiem landt: `finishFromStart` bouwt `ef` met `(start,end]`). Geldt voor
  // FS, FF en SF (elk met hun eigen "rauwe kandidaat-instant"; SS eindigt nooit op de
  // opvolger-FINISH, dus buiten scope): de opvolger landt dan op die rauwe instant zelf.

  switch (seq.type) {
    case 'START_START': {
      const base = predStartsNextDay ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
      // De `deps.snapOnOrAfter(se, …)`-omhulling forceert een werk-instant van de OPVOLGER-kalender —
      // voor een ELAPSEDTIME-opvolger juist niet gewenst (de `shiftLagPred`/`elapsedMin`-uitkomst
      // zelf blijft ongemoeid: die interpreteert de LAG in de geselecteerde lagkalender, een
      // orthogonale vraag). `succElapsed`: geef de ongesnapte waarde terug.
      if (elapsed) {
        const raw = new Date(base.getTime() + elapsedMin());
        return succElapsed ? raw : deps.snapOnOrAfter(se, raw);
      }
      // SS + 0 naar kalendertijd bewaart het rauwe startmoment, ook buiten werkblokken.
      if (succElapsed && deps.resolveEffectiveLagDays(seq, predTask, lagEng) === 0) return base;
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
      // De rauwe geëiste finish, vóór de normalisatie naar een werkmoment (dagenmaat-opvolger hieronder).
      let rawRequired: Date;
      if (elapsed) {
        const raw = new Date(predResult.ef.getTime() + elapsedMin());
        rawRequired = raw;
        reqFinish = succElapsed ? raw : deps.snapOnOrAfter(se, raw);
        if (isDayTaskOnBands(deps, successor)) {
          reqFinish = deps.snapOnOrBefore(se, raw).getTime() === raw.getTime() ? raw : reqFinish;
        }
      } else {
        const lagged = deps.shiftLagPred(lagEng, predResult.ef, seq, predTask, 1);
        const lagIsZero = lagged.getTime() === deps.snapOnOrAfter(lagEng, predResult.ef).getTime();
        // Met lag is `lagged` een moment op de lagkalender; als eindmoment telt het vorige blokeinde
        // daar (een lead landt op een blokbegin, en dat is het einde van de werkdag ervoor).
        rawRequired = lagIsZero ? predResult.ef : lagEng.prevWorkInstant(lagged);
        if ((succIsFinishMs || (succIsStartMs && isDayTaskOnBands(deps, predTask)) || succElapsed) && lagIsZero) {
          reqFinish = predResult.ef;
        } else if (!predEndsBeginOfDay && isDayTaskOnBands(deps, successor)) {
          // Knownbugs 142 van het ontwerp "alleen uren": `shiftLagPred` normaliseert vooruit, dus een
          // geëiste finish op een blokeinde (vr 16:00) wordt bij lag 0 het volgende blokbegin
          // (ma 07:00), en een lead kan op een blokbegin landen. `startFromFinish` leest die finish
          // voor een dagtaak als kalenderdag (`utcDayStart`): één werkdag te laat. Als eindmoment
          // hoort een blokbegin bij het vorige blokeinde, mits dat voor de opvolger dezelfde grens is
          // en niet vóór de rauwe voorgangerfinish ligt (`previousBlockEndIfSame`). Een urentaak
          // trekt zelf al achteruit af (`subtractWorkMinutes`), dus alleen de dagtaak.
          // `bg142-*` in `cases-hours-blokgrenzen.json`.
          reqFinish = previousBlockEndIfSame(deps, lagEng, se, lagged, predResult.ef);
        } else {
          reqFinish = lagged;
        }
      }
      if (isDayTaskOnBands(deps, successor)) reqFinish = workdayFinishNotBefore(se, reqFinish, rawRequired);
      if (succIsStartMs && !predEndsBeginOfDay) {
        // F3c: een dagenmaat-voorganger kan midden in een blok eindigen (0,375 d ⇒ ma 10:00). De
        // startmijlpaal staat dan op dat moment, niet op het volgende blokbegin (ma 13:00); een
        // finish op een blokeinde geeft zoals voorheen het volgende blokbegin. Het urenpad houdt
        // "strikt na" (F1b: de bredere correctie schendt de C7-poort, zie de spec bij F1b).
        if (!elapsed && isDayTaskOnBands(deps, predTask) && isInsideBlock(se, reqFinish)) return reqFinish;
        return deps.snapStrictAfter(se, reqFinish);
      }
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'START_FINISH': {
      // MSP-pariteit: zelfde redenering als FINISH_FINISH hierboven, maar het
      // rauwe anker is hier `startMoment` (de voorganger-START-zijde, incl. dagbegin-mijlpaal-
      // correctie) i.p.v. `predResult.ef` — SF ankert de opvolger-finish op de voorganger-START.
      // `reqFinish` (de geëiste finish zelf) wordt gedeeld met `sfReqFinishHour`
      // (`forwardFinishFloor`) — één bron.
      const reqFinish = sfReqFinishHour(deps, predResult, predTask, seq, successor, pe, se, flags);
      // T8: SF bindt aan een exclusieve startgrens. Een hele dagtaak telt de dag die
      // op dat blokbegin begint niet mee in haar terugtelling; de finishvloer blijft rauw.
      const durationFinish = isDayTaskOnBands(deps, successor) ? se.prevWorkInstant(reqFinish) : reqFinish;
      return deps.startFromFinish(se, durationFinish, successor);
    }
    case 'FINISH_START':
    default: {
      // FS: de opvolger start op het eerste werkmoment op of na de finish van de voorganger
      // (`nextWorkInstant`, scenario 1/6). Lag telt daarvóór in de voorganger-engine.
      if (elapsed) {
        // MSP-pariteit: een ELAPSEDTIME-lag van exact 0 klok-minuten is dezelfde "geen échte
        // lag"-situatie als de WORKTIME-tak hieronder, zodat een elapsed-FS-eindmijlpaal op de rauwe
        // instant landt. Geen `lagIsZero`-vergelijking nodig: 0 klok-minuten is geen verschuiving.
        // Anker is het voorgangereinde rechtstreeks (`elapsed-day-to-hour` in cases-hours.json).
        const target = new Date(predResult.ef.getTime() + elapsedMin());
        if (succIsFinishMs && elapsedMin() === 0) return target;
        if (succIsFinishMs) {
          const back = deps.snapOnOrBefore(se, target);
          // Kalendertijd bewaart de kloktijdgrens: nul werkminuten maakt ma 16:00 en di 08:00
          // niet gelijk. Een geldig eindmoment blijft staan, een later blokbegin gaat niet terug.
          if (back.getTime() === target.getTime()) return back;
        }
        return se.nextWorkInstant(target);
      }
      // P6/XER bewaart bij een expliciet bronpatroon de gedeelde finish/startgrens als de
      // opvolger-ES: geplande opvolgerstart == geplande voorgangerfinish, nul-lag FS, exact op een
      // kalenderbandeinde. De reader zet de vlag uitsluitend uit toegestane invoervelden; zonder
      // vlag geldt de algemene halfopen-bandsemantiek hieronder.
      if (seq.p6StartAtPredecessorFinishBoundary) return predResult.ef;
      const predDone = predResult.ef;
      const lagged = deps.shiftLagPred(lagEng, predDone, seq, predTask, 1);
      // `lagIsZero`: "de geshifte waarde == wat een kale
      // nul-lag-normalisatie in de VOORGANGER zou geven" ⇒ er is geen échte lag toegepast.
      const lagIsZero = lagged.getTime() === deps.snapOnOrAfter(lagEng, predDone).getTime();
      // Kruis-kalender-FS (corpusgeval OzBuild Workshop 14 End Para 29.mpp): bij lag=0 met IDENTIEKE
      // effectieve landingsdag-band (`calendarsAgreeOnSharedWorkdayBands`) snapt de grens rechtstreeks in de OPVOLGER-kalender i.p.v. eerst in de voorganger — anders
      // duwt `pe.nextWorkInstant` (via `shiftLagPred`, hier al toegepast in `lagged`) een extra
      // werkdag van de opvolger (bv. een werkende zaterdag) al weg vóórdat `se` ooit gezien wordt
      // (corpusloos gepind: msp-38/msp-39 in cases-msp-pariteit.json).
      // Uitgesloten (het corpusbewijs dekt alleen "twee gewone taken", geen mijlpalen en geen
      // elapsed-opvolgers):
      //  - `succIsFinishMs`/`predEndsBeginOfDay` — de bestaande mijlpaal-grens-tak (eigen, al geteste
      //    kortsluiting, hieronder) blijft volledig met rust.
      //  - `succIsStartMs` — geen eigen kortsluiting in deze tak; pin:
      //    `msp-41-z11-punt2-startmijlpaal-uitgesloten`.
      //  - `succElapsed` — een 24/7-opvolger accepteert elke instant; `se.nextWorkInstant` zou 'm ten
      //    onrechte naar een werk-instant snappen; zo'n opvolger loopt door de generieke tak (een
      //    bekend, apart gat). Pin: `msp-42-z11-punt2-elapsed-opvolger-uitgesloten`.
      // Dit raakt uitsluitend het "twee gewone taken"-pad. Zónder de discriminator (bandgrenzen die
      // OP DE LANDINGSDAG zelf verschillen, zoals de guard-case) blijft het bestaande
      // voorganger-eerst-gedrag staan: de `if` hieronder faalt dan gewoon en de functie valt door
      // naar `se.nextWorkInstant(lagged)`.
      if (!succIsFinishMs && !predEndsBeginOfDay && !succIsStartMs && !succElapsed
        && lagIsZero
        && calendarsAgreeOnSharedWorkdayBands(pe, se, predDone)) {
        return se.nextWorkInstant(predDone);
      }
      // MSP-pariteit: een EINDmijlpaal-opvolger zonder lag landt op de RAUWE
      // voorganger-finish-instant (bv. di 17:00) — niet op de eerstvolgende werk-instant erna.
      // `shiftLagPred` en de opvolger-snap normaliseren via `nextWorkInstant` (rand `[start,end)`),
      // dat is de FORWARD-conventie en sluit een instant exact op een band-EIND per definitie
      // uit — precies de rand waar een finish legitiem op landt (`finishFromStart` bouwt `ef`
      // zelf met de `(start,end]`-conventie). Bij lag=0 reduceert `shiftLagPred` dus altijd tot
      // een overbodige — en hier SCHADELIJKE — dubbele snap. `predDone` is in dat geval al een
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
      if (succIsFinishMs && lagIsZero) return predDone;
      if (succIsFinishMs) {
        const back = deps.snapOnOrBefore(se, lagged);
        // Beide kalenders moeten dit als dezelfde grens lezen, ook bij een lead en feestdagen.
        if (back.getTime() === lagged.getTime()
          || (se.nextWorkInstant(back).getTime() === lagged.getTime()
            && lagEng.workMinutesBetween(back, lagged) === 0)) return back;
      }
      return se.nextWorkInstant(lagged);
    }
  }
}

/** De door een SF-relatie geëiste opvolger-FINISH (uur-modus) — gedeeld tussen `forwardHour`'s
 *  `START_FINISH`-tak en `forwardFinishFloor`, zodat er precies ÉÉN plek is die `reqFinish`
 *  berekent. */
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
  const elapsedMin = () => elapsedMilliseconds(deps.resolveElapsedMinutes(seq, predTask));
  const succElapsed = isElapsedTask(successor);

  // T8: een dagtaak bindt aan het echte startmoment, ook bij een eindmijlpaal.
  const daySuccessor = isDayTaskOnBands(deps, successor);
  const startMoment = predStartsNextDay && !daySuccessor ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
  if (elapsed) {
    return succElapsed
      ? new Date(startMoment.getTime() + elapsedMin())
      : deps.snapOnOrAfter(se, new Date(startMoment.getTime() + elapsedMin()));
  }
  const lagged = deps.shiftLagPred(lagEng, startMoment, seq, predTask, 1);
  if ((succIsFinishMs || succElapsed || daySuccessor)
    && lagged.getTime() === deps.snapOnOrAfter(lagEng, startMoment).getTime()) {
    return startMoment;
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
  const elapsedMin = () => elapsedMilliseconds(deps.resolveElapsedMinutes(seq, predTask));
  // `predElapsed` gebruikt `isZeroDurationMilestone` (via `isElapsedTask`), net als `succElapsed` in
  // `forwardHour`. `prevWorkInstant` in de FS-tak hieronder zou een ELAPSEDTIME-voorganger, die geen
  // werk-instant-begrip heeft, te ver terugknijpen; zie daar.
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
      // Spiegel van de forward-FF: een startmijlpaal midden in een blok bindt een dagenmaat-voorganger
      // op dat moment zelf; anders de werkgrens ervóór (dagbegin-anker, C7 uit).
      const succLf = !(succIsStartMs && !predEndsBeginOfDay) ? succResult.lf
        : !elapsed && isDayTaskOnBands(deps, predTask) && isInsideBlock(se, succResult.lf) ? succResult.lf
          : deps.snapStrictBefore(se, succResult.lf);
      if (elapsed) {
        return deps.snapOnOrBefore(pe, new Date(succLf.getTime() - elapsedMin()));
      }
      const predLf = deps.shiftLagPred(lagEng, succLf, seq, predTask, -1);       // pred.LF
      // Spiegel van de forward-FF hierboven (knownbugs 142): een late finish op een blokbegin leest
      // een dagtaak-voorganger in `subDuration` als de dag erna. Alleen een dagtaak op werkblokken;
      // een urentaak houdt het bestaande gedrag (bij P6 regelt `p6BackwardLagFinishBoundary` dit).
      if (isDayTaskOnBands(deps, predTask)) {
        return previousBlockEndIfSame(deps, lagEng, pe, predLf);
      }
      return predLf;
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
      // pred.LF = prevWorkInstant( succ.LS ⊖ lag ) (scenario 1-6 backward).
      // De grensvlaggen onderdrukken UITSLUITEND de finish-/band-gap-normalisatie, NOOIT de lag
      // (anders forward/backward-asymmetrie en een float-/kritiek-pad-verschil).
      // Uitzondering: bij lag = 0 reduceert `shiftLagPred` tot de kale `nextWorkInstant`-
      // normalisatie (zie `addWorkingMinutesSigned`, m===0). Dat geval houdt bewust het
      // ONgenormaliseerde `succ.LS`-anker aan — het dagbegin-mijlpaal-gedrag dat hieronder
      // beschreven staat en dat de zusjes-cases rr-fs-pred-startms(-dagpariteit) vastleggen.
      const lagged = deps.shiftLagPred(lagEng, succResult.ls, seq, predTask, -1);
      const lagIsZero = lagged.getTime() === deps.snapOnOrAfter(lagEng, succResult.ls).getTime();
      const target = (predEndsBeginOfDay || succIsFinishMs) && lagIsZero
        ? succResult.ls
        : lagged;
      // Een dagbegin-mijlpaal-voorganger (start-/auto-mijlpaal, oftewel `predEndsBeginOfDay`) heeft
      // geen echte finish-instant — zijn "finish" is een dagbegin-anker. `prevWorkInstant` is de
      // FINISH-normalisatie (rand `(start,end]`) en zou dat anker naar het vorige band-eind
      // terugtrekken; het doeldatum-label blijft staan. Work-equivalent (nul werk ertussen ⇒ zelfde
      // float), maar representatief divergent ⇒ hier overslaan.
      // Bij `succIsFinishMs` is de voorganger wél een echte taak met een echte finish; daar
      // blijft de normalisatie staan (de vlag onderdrukt alleen de band-gap).
      if (predEndsBeginOfDay) return target;
      // `prevWorkInstant` zou een ELAPSEDTIME-voorganger (die geen werk-instant-begrip heeft, zijn
      // late finish mag op elk klokmoment liggen) te ver terugknijpen. `nextWorkInstant` is
      // INCLUSIEF `[start,end)` — een al-geldige instant blijft zichzelf — dus de kale ongesnapte
      // `target` IS al de juiste (losste) inverse, zonder verdere aftrek.
      if (predElapsed) return target;
      return pe.prevWorkInstant(target);
    }
  }
}
