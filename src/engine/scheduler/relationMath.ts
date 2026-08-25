import type { Task } from '@/types/task';
import type { Sequence, LagUnit } from '@/types/sequence';
import type { CalendarEngine } from './CalendarEngine';
import { addCalendarDays } from '@/utils/dateUtils';
import { isZeroDurationMilestone } from './duration';

/**
 * Relatie-wiskunde (FS/SS/FF/SF) — audit-pakket P15 (RelationResolver).
 *
 * Vervangt de vier voorheen parallel-gedupliceerde blokken in `CPMSolver.ts`
 * (forward/backward × dag-modus/uur-modus). De duplicatie is op drie manieren opgeruimd:
 *
 *  1. **Forward en backward naast elkaar in één module** — per richting één ingang
 *     (`forwardConstraint`/`backwardConstraint`) die per relatietype dispatcht. LET OP: de
 *     spiegel-invariant (backward = spiegel van forward) is hiermee nog stééds een conventie
 *     tussen twee parallelle switch-armen, geen afgedwongen code-eigenschap — wél staan de
 *     spiegelparen nu direct naast elkaar in één bestand en pint de suite (cases-hours-relations)
 *     beide richtingen vast.
 *  2. **Mijlpaal-grensvlaggen één keer** — `relationBoundaryFlags` berekent de vier grensvlaggen
 *     (§4.4 grens-model) op één plek; forward en backward krijgen ze aangereikt i.p.v. ze elk
 *     opnieuw af te leiden (voorheen 4× identiek).
 *  3. **Dag/uur als parametrisering** — de mode-bewuste engine-/lag-helpers (aangereikt via
 *     `RelationDeps`) reduceren in dag-modus byte-identiek tot de bestaande dag-expressies; alleen
 *     een uur-kalender activeert het minuut-native pad. Dag en uur blijven twee takken (het
 *     dag-elapsed-pad schrijft bewust een ONGESNAPTE grens in `seqConstraint` voor de vrije-speling-
 *     analyse, terwijl het uur-pad snapt — die conventies mogen niet vermengd worden), maar ze
 *     staan nu naast elkaar onder één ingang per richting.
 *
 * De semantiek is IDENTIEK aan de vorige inline-implementatie (byte-identiek geverifieerd);
 * de conventie-commentaren (P6/MSP, dagrand, elapsed-snap, mijlpaal-grenzen) zijn meeverhuisd.
 */

// Milliseconde-constanten (uur-pad); HOUR_SCAN = veiligheidsplafond voor de dag→uur-backward-scan.
export const MS_PER_MIN = 60_000;
export const MS_PER_DAY = 86_400_000;
export const HOUR_SCAN = 400;

/** De grensvlaggen die de mijlpaal-grens-semantiek (fase 2.4/§4.4) beschrijven voor één relatie.
 *  Voorheen 4× identiek herberekend in elk van de forward/backward × dag/uur-blokken. */
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
export function relationBoundaryFlags(predTask: Task, succTask: Task): RelationBoundaryFlags {
  // H3 (Opus-review T15-iteratie-2): `predTask.isMilestone ||` verwijderd — voor ELKE bestaande
  // ECHTE (0-duur) mijlpaal was `scheduleDuration <= 0` al waar, dus de kale vlag toevoegen was
  // altijd redundant vóór T15 (mijlpaal-met-duur bestond toen nog niet). Ná T15 maakte diezelfde
  // vlag een mijlpaal-MET-duur ten onrechte óók een dag-grens-predecessor (haar échte, meerdaagse
  // finish zou dan als "dagbegin" behandeld worden). Wiskundig equivalent voor het hele bestaande
  // corpus (`isZeroDurationMilestone(predTask)` impliceert altijd `scheduleDuration <= 0`, dus de
  // OR was al overbodig), alleen de milestone-met-duur-combinatie krijgt nu terecht GEEN dag-grens.
  // B2-BEVINDING (Opus-her-check T15-fixronde): `predIsMilestone` hierboven is ONGEPIND voor de
  // milestone-met-duur-combinatie (geen van de msp-29..34-cases gebruikt zo'n taak als VOORGANGER
  // in een FS/FF-relatie) — corpus- en case-neutraal, wiskundig-equivalent-redenering blijft staan.
  // `succIsFinishMs`/`succIsStartMs` hieronder staan nog LATENT op de kale `isMilestone`-vlag (niet
  // via `isZeroDurationMilestone`) — dat is BEWUST onaangeroerd gebleven en volledig gemaskeerd
  // (niet gefixt, niet getest): `milestoneKind` wordt in de lezers (mppReader.ts/mspdiReader.ts,
  // H2) al uitsluitend gezet bij `duration===0`, dus voor elke taak die via die lezers binnenkomt
  // is `succTask.milestoneKind` toch al `undefined` op een mijlpaal-met-duur — deze twee vlaggen
  // worden dan nooit `true`, ongeacht welke vorm van `isMilestone`-check hier staat. Voor een taak
  // die BUITEN die lezers om een `milestoneKind` krijgt (bv. rechtstreeks via de MCP-tools of een
  // toekomstige adapter) blijft dit een LATENT gat — geregistreerd, niet binnen deze fixronde
  // opgelost.
  //
  // T16-VEEGLIJST — een CONCRETE, vandaag al reikbare ontsnappingsroute (naast MCP/toekomstige
  // adapters): de IFC-round-trip. `ifcPsets.ts`'s Milestone-pset schrijft/leest `MilestoneKind`
  // onvoorwaardelijk zodra `task.isMilestone` waar is — géén `duration===0`-poort, in tegenstelling
  // tot de lezers hierboven. Een 0-duur mijlpaal met `milestoneKind='FINISH'` die naar IFC opgeslagen
  // wordt en waarvan de gebruiker vervolgens (in dezelfde of een latere sessie, vóór/ná herladen) de
  // duur wijzigt — `isMilestone` blijft `true`, T15's mijlpaal-met-duur-ondersteuning staat dat toe —
  // behoudt zijn `milestoneKind`: precies de mijlpaal-met-duur-plus-`milestoneKind`-combinatie die
  // hierboven als "nooit bereikt via de lezers" wordt aangenomen. Nog steeds niet gefixt (geen
  // corpus-/synthetische case raakt dit), maar niet langer alleen een hypothetisch MCP-pad.
  const predIsMilestone = predTask.time.scheduleDuration <= 0;
  const predKind = predTask.isMilestone ? predTask.milestoneKind : undefined;
  return {
    predEndsBeginOfDay: predIsMilestone && predKind !== 'FINISH',
    predStartsNextDay: predIsMilestone && predKind === 'FINISH',
    succIsFinishMs: succTask.isMilestone && succTask.milestoneKind === 'FINISH',
    succIsStartMs: succTask.isMilestone && succTask.milestoneKind === 'START',
  };
}

/**
 * Z11 (etappe "nul afwijkingen", dossier kruis-kalender-FS-asymmetrie). De discriminator voor de
 * FS+0-grens-snap hieronder: *voorganger-eerst, TENZIJ de twee kalenders op de LANDINGSDAG (de
 * kalenderdag van het rauwe voorganger-finish-instant `onDate` — de dag waar de niet-kortgesloten
 * `pe`-snap als EERSTE zou landen/doorzoeken) identieke EFFECTIEVE banden hebben — dan opvolger-eerst.*
 *
 * Fixronde (Opus-review, punt 1, MIDDEN/verplicht): de eerste versie vergeleek de STATISCHE
 * weekdagtabel (`workTime.byWeekday`) over alle zeven weekdagen. Reviewer-probe: twee kalenders met
 * een IDENTIEK weekpatroon, waarvan er één een `workingException` draagt die PRECIES op de
 * landingsdag een ANDER (breder) band geeft — de statische tabel ziet die uitzondering niet (die
 * leeft alleen in `bandsStartingOn`/`findContaining`, niet in `byWeekday`), dus de oude vergelijking
 * zei ten onrechte "identiek" terwijl de EFFECTIEVE landingsdag-band wél degene is die de opvolger
 * daadwerkelijk gebruikt bij het snappen — exact de msp-04-guard-foutvorm (het rauwe voorganger-
 * instant valt toevallig BINNEN de verbrede opvolger-band), alleen nu via een uitzondering i.p.v. een
 * structureel andere kalender. Fix: vergelijk niet de statische tabel maar de EFFECTIEVE banden van
 * `onDate` zelf, via `CalendarEngine.effectiveBandsOn` — hetzelfde `bandsStartingOn`-pad dat de
 * solver voor elke snap/telling gebruikt, dus inclusief werkende uitzonderingen én holidays. Dat
 * herleidt de check tot ÉÉN datum (de landingsdag) i.p.v. een lus over alle weekdagen — een verschil
 * op een ANDERE dag (bv. de extra zaterdag zelf) doet er voor DEZE beslissing niet toe: dat is precies
 * de "extra werkdag"-asymmetrie die opvolger-eerst moet herstellen, geen band om op te struikelen.
 * Zie `msp-45-z11-punt1-workingexception-landingsdag` (cases-msp-pariteit.json) voor de reviewer-
 * probe corpusloos gepind.
 *
 * Randgevallen (fixronde, punt 5, LAAG maar meegenomen): `effectiveBandsOn` geeft `[]` terug zodra
 * DIE kalender op `onDate` niet werkt — dag-modus (geen bandtijden, altijd `[]` voor beide kanten),
 * maar ook een holiday of een niet-werkende weekdag in uur-modus. **Beide leeg** ⇒ `true` (geen band
 * om op te struikelen — dit is wat dag-modus altijd triviaal waar maakt, en dus de eerder empirisch
 * geverifieerde dag-modus-uitkomst ONGEWIJZIGD laat). **Eén van de twee leeg, de ander niet** ⇒
 * `false` — een asymmetrische holiday/niet-werkdag op de landingsdag is GEEN reden om de opvolger
 * blind te vertrouwen; de bestaande voorganger-eerst-machinerie kent die situatie al correct af
 * (`msp-44-z11-punt5-holiday-landingsdag` pint dit: een holiday bij de opvolger op precies de
 * landingsdag houdt voorganger-eerst in stand, ook al zou de opvolger's eigen `nextWorkInstant`
 * daarna toevallig op de "extra werkdag" van diezelfde opvolger uitkomen).
 *
 * Volgorde-ongevoelig (fixronde, punt 4, LAAG maar meegenomen): een kalender met MEERDERE banden per
 * dag (gesplitste dienst, bv. een lunchpauze) hoeft ze niet in chronologische volgorde op te slaan —
 * `sortedBands` sorteert op `start` vóór de positionele vergelijking, zodat twee kalenders met
 * DEZELFDE verzameling banden in een ANDERE volgorde niet ten onrechte `false` geven
 * (`msp-43-z11-punt4-bandvolgorde-ongevoelig` pint dit, mutatiebewijs: de sort weghalen ⇒ ROOD).
 *
 * Reconstructie (Z11, vóór implementatie getoetst — beide kanten, nu op de landingsdag herhaald):
 *  - CORPUSGEVAL (OzBuild Workshop 14 End Para 29.mpp, dag-modus): op de landingsdag (vrijdag) hebben
 *    "Standard" en "6 Day Week" beide `effectiveBandsOn` = `[]` (dag-modus draagt geen bandtijden) ⇒
 *    `true` ⇒ opvolger-eerst. Met opvolger-eerst snapt de FS-grens direct in "6 Day Week", die
 *    zaterdag WEL kent — de MSP-datum (zaterdag) komt daarmee binnen bereik i.p.v. de voorganger-
 *    eerst-snap die 'm over het hele weekend naar maandag duwt.
 *  - GUARD-CASE (msp-04-m2-guard1-alleen-crosscalendar, uur-modus): op de landingsdag (dinsdag) is
 *    P se effectieve band `[08:00,17:00)` en Q se `[09:00,18:00)` — verschillend ⇒ `false` ⇒
 *    voorganger-eerst blijft behouden — exact het bestaande, doelbewust geteste gedrag.
 *
 * Spiegelgeval (Opus-review, punt 7, INFO): `backwardDay`/`backwardHour` zijn BEWUST niet aangeraakt.
 * Dat is geen omissie — hun FS-default-arm bouwt `succResult.ls` niet via eenzelfde pred-dan-succ-
 * dubbele-snap-keten (die komt al gesnapt binnen, uit de eigen backward-pass van de opvolger), dus
 * er is daar niets te "kortsluiten". Los daarvan is het resultaat van de nieuwe tak HIER ook zonder
 * die observatie al veilig: `se.nextWorkDayAfter(...)`/`se.availableStart(...)` leveren altijd al een
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
   *  zónder `lagDays` in een DAG-voorganger wordt opgelost (§5.2; zonder die factor viel zo'n lag
   *  stil weg — P6-XML/MSPDI schrijven precies die combinatie voor een uur-opvolger). */
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
 * uur-modus is loopt het cross-/uur-pad, anders het bevroren dag-pad (byte-identiek).
 */
export function forwardConstraint(
  deps: RelationDeps,
  predResult: { es: Date; ef: Date },
  predTask: Task,
  seq: Sequence,
  successor: Task,
  predEng: CalendarEngine,
  succEng: CalendarEngine,
): Date {
  const flags = relationBoundaryFlags(predTask, successor);
  if (predEng.isHourMode || succEng.isHourMode) {
    return forwardHour(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
  }
  return forwardDay(deps, predResult, predTask, seq, successor, predEng, succEng, flags);
}

/**
 * Z10 (etappe "nul afwijkingen", dossier START_FINISH-semantiek, `mpp14relations.mpp`/"Task 5").
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
 * (`msp-35-z10-sf-weekendgrens`, mutatiebewijs in de Z10-commitboodschap).
 *
 * Deze functie levert `reqFinish` als een APARTE ondergrens ("niet eerder dan…", net als de
 * ES-kandidaat van elke relatie een ondergrens is) — `CPMSolver.forwardPass` neemt 'm mee als extra
 * `max()`-term NAAST de gewone `ES + duur`-berekening, ZONDER de ES-berekening zelf aan te raken.
 *
 * WAAROM ALLEEN `START_FINISH` (`null` voor alle andere typen, nadrukkelijk óók niet voor
 * `FINISH_FINISH` — Z10-fixronde 2, reviewbevinding 6, het ECHTE veiligheidsargument i.p.v. het
 * eerdere "FF is niet getoetst"-argument). De vloer verschuift `earlyFinish` uitsluitend over een
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
 * vloer gaat (Z10-fixronde 2, reviewbevinding 3, `msp-36-z10-sf-hardpin-wint`).
 *
 * BEWUSTE SCOPE-GRENZEN (Z10-fixronde 2, reviewbevinding 5 — gedocumenteerd, niet binnen deze taak
 * gefixt):
 *  - **Taken met actuals.** `CPMSolver.forwardPass`s VOLTOOID-/IN-PROGRESS-takken (`t.actualFinish`/
 *    `t.actualStart`/`t.completion>0`) `continue`n VÓÓR de vloer ooit toegepast wordt — een taak die
 *    al (deels) is afgemeld pint op haar eigen feiten, nooit op een relatie-vereiste finish. De
 *    vloer is voor zo'n taak dus principieel onbereikbaar, net zoals relatie-constraints in het
 *    algemeen wijken voor geregistreerde actuals.
 *  - **Hammocks.** `hammockEarlyFinish` (CPMSolver.ts) doet voor een SF/FF-voorganger nog steeds de
 *    OUDE rondgang (`forwardConstraint` → start-equivalent → `finishFromStart`) — een hammock-EF
 *    loopt niet door `sfFinishFloor`. Een SF-relatie naar een hammock-taak toont dus NOG STEEDS het
 *    vóór-Z10-gedrag (mogelijk hetzelfde weekendgrens-symptoom). Geregistreerde, niet-gefixte
 *    beperking — geen corpusbestand of case raakt vandaag een SF-naar-hammock-relatie.
 *
 * Losstaand van `forwardConstraint` gehouden (i.p.v. diens retourtype te verrijken) om de vier
 * bestaande aanroepplekken van `forwardConstraint`/`backwardConstraint` — die zelf niets met een
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
): Date | null {
  if (seq.type !== 'START_FINISH') return null;
  const flags = relationBoundaryFlags(predTask, successor);
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
): Date {
  const flags = relationBoundaryFlags(predTask, succTask);
  if (predEng.isHourMode || succEng.isHourMode) {
    return backwardHour(deps, succResult, seq, predTask, predEng, succEng, flags);
  }
  return backwardDay(deps, succResult, seq, predTask, predEng, succEng, flags);
}

// ═══════════════════════════════════════════════════════════════════════════
//  DAG-modus (puur dag→dag; byte-identiek aan de vorige inline dag-blokken).
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
  // T8-review H1: FF/SF hieronder leidden de "werkdagen tussen start en finish van de opvolger"
  // vroeger inline af (`succDur>0?succDur-1:0`) en stapten daarmee UNCONDITIONEEL in WERKdagen
  // terug (`se.addWorkingDaysSigned`). Nu via `deps.startFromFinish` — dezelfde helper als T8's
  // forward-duurtoepassing (GEEN tweede variant), die zelf de WORKTIME/ELAPSEDTIME-keuze maakt:
  // voor een ELAPSEDTIME-opvolger (mijlpaal uitgesloten — die heeft geen eigen duur) 24/7
  // kloktijd, voor WORKTIME byte-identiek aan de oude inline formule.
  // H3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone` i.p.v. de kale vlag — een
  // mijlpaal-met-duur (T15) die zelf ELAPSEDTIME is, is voor de PLANNING geen mijlpaal en moet dus
  // wél de elapsed-tak volgen (msp-30-mutatiebewijs: zonder deze conversie bleef de kale vlag de
  // elapsed-bypass stil uitsluiten, met een dag-verschoven resultaat als gevolg).
  const succElapsed = !isZeroDurationMilestone(successor) && successor.time.durationType === 'ELAPSEDTIME';
  const { predEndsBeginOfDay, predStartsNextDay, succIsFinishMs, succIsStartMs } = flags;

  switch (seq.type) {
    case 'START_START': {
      // Opvolger start `lag` dagen na de start van de voorganger. Een ruwe elapsed-datum op een
      // weekend hoeft hier niet gesnapt vóór een WORKTIME-opvolger: `CPMSolver.forwardPass`
      // eindigt met `nextWorkDay` op de max (BIJGEWERKT, T8-review-BLOCKER: dat geldt sinds die
      // fix uitdrukkelijk NIET meer voor een ELAPSEDTIME-opvolger — `snapSuccessorEarlyStart`/
      // `ownAnchor` slaan die her-snap dan juist bewust over). Het "start"-moment van een
      // eindmijlpaal is zijn dag-eindgrens ⇒ werkdag erna.
      if (elapsed) {
        return addCalendarDays(predResult.es, predStartsNextDay ? lag + 1 : lag);
      }
      const base = predStartsNextDay ? pe.nextWorkDayAfter(predResult.es) : predResult.es;
      // T8-review-BLOCKER (vervolg op H1): `addWorkingDaysSigned` snapt zijn EIGEN invoer altijd
      // eerst naar een werkdag (`nextWorkDay`, ook bij lag=0) — voor een ELAPSEDTIME-opvolger is
      // dat dezelfde ongeoorloofde werk-instant-eis als bij FF/SF. `addCalendarDays` is hier de
      // kale klok-tegenhanger (geen tweede variant: dezelfde helper als de `elapsed`(LAG)-tak
      // hierboven gebruikt).
      if (succElapsed) return addCalendarDays(base, lag);
      return lagEng.addWorkingDaysSigned(base, lag);
    }
    case 'FINISH_FINISH': {
      // Opvolger EINDIGT `lag` dagen na de finish van de voorganger → leid de bijbehorende
      // start af (finish − (duur−1)). De geëiste finish moet een werkdag zijn vóór de
      // werkdag-aftrek, dus elapsed snapt hier wél (vooruit — ondergrens op de finish) —
      // BEHALVE voor een ELAPSEDTIME-opvolger (H1): die heeft geen werkdag-begrip, dus de
      // geëiste finish blijft een kale kloktijd (geen `se.nextWorkDay`-snap).
      const reqFinish = elapsed
        ? (succElapsed ? addCalendarDays(predResult.ef, lag) : se.nextWorkDay(addCalendarDays(predResult.ef, lag)))
        : lagEng.addWorkingDaysSigned(predResult.ef, lag);
      // Een startmijlpaal-opvolger (dagbegin-anker) kan pas op de werkdag ná een
      // dag-eindgrens liggen; na een dagbegin-voorganger (start-/auto-mijlpaal) niet.
      if (succIsStartMs && !predEndsBeginOfDay) return se.nextWorkDayAfter(reqFinish);
      // H1: succBack rekent in WERKdagen (`se.addWorkingDaysSigned`) — voor een ELAPSEDTIME-
      // opvolger moet de terugstap 24/7 klokdagen zijn. `deps.startFromFinish` is al
      // durationType-bewust (T8) en voor een WORKTIME-opvolger byte-identiek aan de oude
      // `se.addWorkingDaysSigned(reqFinish, -succBack)` (zelfde formule, ándere aanroeper).
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'START_FINISH': {
      // Opvolger EINDIGT `lag` dagen na de START van de voorganger (zeldzaam). `reqFinish` (de
      // geëiste finish zelf) wordt gedeeld met `sfReqFinishDay` (Z10, `forwardFinishFloor`) — één
      // bron, zie die functies moduleheader.
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
      // Z11 (kruis-kalender-FS-asymmetrie, corpusgeval OzBuild Workshop 14 End Para 29.mpp):
      // bij lag=0 met een IDENTIEKE EFFECTIEVE landingsdag-band (dag-modus: altijd, want dag-modus
      // draagt geen bandtijden om op te verschillen — zie `calendarsAgreeOnSharedWorkdayBands`)
      // snapt de grens rechtstreeks in de OPVOLGER-kalender i.p.v. eerst in de voorganger — anders
      // duwt `pe.nextWorkDayAfter` een extra werkdag van de opvolger (bv. zaterdag bij een
      // 6-dagen-opvolger van een 5-dagen-voorganger) al weg vóórdat `se` ooit gezien wordt.
      // Uitgesloten (fixronde, punt 2, MIDDEN/verplicht — het corpusbewijs dekt uitsluitend "twee
      // gewone taken", geen mijlpalen en geen elapsed-opvolgers):
      //  - `succIsFinishMs`/`predEndsBeginOfDay` — de bestaande mijlpaal-grens-takken (die
      //    `predResult.ef` al ONGESNAPT gebruiken) blijven volledig buiten schot.
      //  - `succIsStartMs` — een startmijlpaal-opvolger kreeg vóór Z11 GEEN eigen kortsluiting in
      //    deze tak (die zit alleen in FF/SF); zonder deze uitsluiting zou Z11 er per ongeluk wél
      //    ééntje aan geven, ongetoetst. Pin: `msp-41-z11-punt2-startmijlpaal-uitgesloten`
      //    (uur-tegenhanger — dezelfde uitsluiting geldt hier voor de dag-tak identiek).
      //  - `succElapsed` (de opvolger se EIGEN duurtype is ELAPSEDTIME) — zo'n opvolger heeft geen
      //    werk-instant-begrip en accepteert elke kalenderdag; `se.nextWorkDayAfter` zou 'm ten
      //    onrechte naar een WERKdag duwen. Vóór Z11 liep zo'n opvolger door dezelfde generieke
      //    `pe.nextWorkDayAfter`-tak als een gewone taak (een bestaand, hier NIET aangeraakt gat) —
      //    de uitsluiting houdt Z11 dus byte-identiek aan dat vóór-Z11-gedrag. Pin (uur-tegenhanger):
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
 *  `START_FINISH`-tak en `forwardFinishFloor` (Z10), zodat er precies ÉÉN plek is die `reqFinish`
 *  berekent. Zelfstandig aanroepbaar (leidt `lag`/`elapsed`/`succElapsed` zelf af uit `deps`/`seq`/
 *  `predTask`/`successor`) — `forwardDay` zelf blijft byte-identiek, ze roept 'm nu gewoon aan i.p.v.
 *  de formule inline te herhalen. */
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
  const succElapsed = !isZeroDurationMilestone(successor) && successor.time.durationType === 'ELAPSEDTIME';
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
  // T8-review H1/H2-spiegelpaar: SS/SF hieronder leidden "predLS → predLF" vroeger inline af
  // (`predDur>0?predDur-1:0`, WERKdagen via `pe.addWorkingDaysSigned`). Nu via `deps.finishFromStart`
  // — dezelfde helper als `startFromFinish` hierboven (H1) en al elders in deze solver (T8) — die
  // voor een ELAPSEDTIME-voorganger (mijlpaal uitgesloten) 24/7 kloktijd toepast, WORKTIME
  // byte-identiek aan de oude inline formule. Zie ook `predElapsed` bij de FINISH_START-tak
  // hieronder (H2: de `prevWorkDayBefore`-inversie zelf, niet een duur-toepassing).
  // H3 (Opus-review T15-iteratie-2) — zelfde reden als `succElapsed` hierboven, nu voor de
  // VOORGANGER-zijde van de relatie.
  //
  // B2-BEVINDING (Opus-her-check T15-fixronde): deze conversie is, in tegenstelling tot
  // `succElapsed` in de forward-tak (zie msp-33/34, `cases-msp-pariteit.json` — die pinnen de
  // forward-conversie WEL rechtstreeks), NIET met een eigen case gepind. `predElapsed` voedt hier
  // uitsluitend de BACKWARD-pass (`lateFinish`/`totalFloat` van de voorganger); een discriminerende
  // case zou een `lf`/`tf`-assertie op een mijlpaal-met-duur-ELAPSEDTIME-VOORGANGER vergen — niet
  // geconstrueerd binnen deze fixronde. Corpus- en case-neutraal: geen gepind bestand en geen
  // bestaande case raakt deze combinatie; meegeconverteerd voor consistentie met de forward-tak
  // (dezelfde `isZeroDurationMilestone`-definitie hoort logisch op beide zijden van een relatie te
  // gelden), gedekt via de CPMSolver-kant (`subDuration`/`finishFromStart` gebruiken de helper al
  // wél mutatiebewezen) totdat een eigen backward-case dit rechtstreeks aantoont.
  const predElapsed = !isZeroDurationMilestone(predTask) && predTask.time.durationType === 'ELAPSEDTIME';
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
      return deps.finishFromStart(pe, predLS, predTask); // pred.lateFinish — H1/H2-spiegel, zie hierboven
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
      return deps.finishFromStart(pe, predLS, predTask); // H1/H2-spiegel, zie START_START hierboven
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
      // H2: `prevWorkDayBefore` inverteert de forward-tak se `pe.nextWorkDayAfter` (die STRIKT
      // vooruitstapt, ook vanaf een al-werkdag-geldige instant) — voor een ELAPSEDTIME-voorganger
      // bestaat dat "werkdag ervoor"-begrip niet: zijn late finish mag op ELKE kalenderdag liggen,
      // inclusief een niet-werkdag (bv. zondag). `prevWorkDayBefore` zou die legitieme zondag-EF
      // onterecht een heel weekend terugknijpen (spook-negatieve-speling, T8-review H2). De juiste
      // (LOSSTE, dus float-neutrale) inverse van de forward "+1 dag, dan volgende werkdag"-stap is
      // hier kaal "−1 kalenderdag" — géén werkdag-zoektocht — zie het commitbericht voor de
      // herleiding en msp-18 (`cases-msp-pariteit.json`) voor het mutatiebewijs.
      if (predElapsed) return addCalendarDays(target, -1);
      return pe.prevWorkDayBefore(target);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  UUR-/CROSS-modus (engaged zodra minstens één zijde uur-modus is; §4.3/§5.2).
//  Spiegelt de dag-formules met instant-primitieven: `prevWorkInstantBefore` ↔
//  `nextWorkInstantAfter`, `subtractWorkMinutes` ↔ `addWorkMinutes`, lag terug in de
//  VOORGANGER-engine (`LAG_CALENDAR='predecessor'`).
// ═══════════════════════════════════════════════════════════════════════════

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
  // T8-review H1: zie forwardDay se `succElapsed` — dezelfde definitie, hier voor de FF/SF-uurtak.
  // De `succIsFinishMs`-kortsluitingen hieronder (T6/L1) golden tot nu toe alleen voor een
  // EINDmijlpaal-opvolger; een ELAPSEDTIME-opvolger heeft PRECIES dezelfde behoefte (geen
  // werk-instant-normalisatie op zijn geëiste finish, want 24/7), dus die kortsluitingen breiden
  // hier uit naar `succIsFinishMs || succElapsed`.
  // H3 (Opus-review T15-iteratie-2): `isZeroDurationMilestone` i.p.v. de kale vlag — een
  // mijlpaal-met-duur (T15) die zelf ELAPSEDTIME is, is voor de PLANNING geen mijlpaal en moet dus
  // wél de elapsed-tak volgen (msp-30-mutatiebewijs: zonder deze conversie bleef de kale vlag de
  // elapsed-bypass stil uitsluiten, met een dag-verschoven resultaat als gevolg).
  const succElapsed = !isZeroDurationMilestone(successor) && successor.time.durationType === 'ELAPSEDTIME';

  // MSP-pariteit (T6, §9/O6; her-herzien op Opus-review H1/L1/L2). Een EINDmijlpaal-opvolger
  // zonder échte lag landt op de RAUWE voorganger-instant (bv. di 17:00) i.p.v. de eerstvolgende
  // werk-instant erna — `nextWorkInstant`/`availableStart` normaliseren met de FORWARD-conventie
  // `[start,end)`, die een instant exact op een band-EIND per definitie uitsluit (precies de rand
  // waarop een finish legitiem landt: `finishFromStart` bouwt `ef` met `(start,end]`). Geldt voor
  // alle vier relatietypes (FS/FF/SF hebben elk hun eigen "rauwe kandidaat-instant"; SS eindigt
  // nooit op de opvolger-FINISH, dus buiten scope) — vandaar één gedeelde landings-helper i.p.v.
  // een aparte kortsluiting per arm.
  //
  // `landRawInstant` (H1, Opus-review): de rauwe instant is een uur-precisie `Date` uit de
  // VOORGANGER-kalender. Is de opvolger zelf ook uur-modus, dan is dat instant al geldig — gewoon
  // teruggeven. Is de opvolger DAG-modus, dan mag de tijd-component niet blijven hangen: `nextWorkDay`
  // behoudt "tijd-van-de-dag" op een niet-middernacht-`Date` (het is een dag-primitief, geen
  // instant-primitief), dus zonder eerst naar `startOfDay` te normaliseren rapporteert de taak een
  // correct ogende dag met een spook-tijdscomponent erin — onzichtbaar in dag-geformatteerde
  // datums, maar `workDaysBetween`/`workMinutesBetween` tellen 'm wél mee, met een speling die één
  // werkdag te laag uitvalt (vóór deze fix gemeten: tf=2 waar de dag-referentie tf=3 geeft).
  // T8-review H1 (cross-modus-uitbreiding): voor een ELAPSEDTIME-opvolger op een DAG-kalender mag
  // ook déze landing niet naar de eerstvolgende WERKdag schuiven (`se.nextWorkDay`) — een 24/7-
  // opvolger accepteert elke kalenderdag. `elapsedLanding` selecteert per aanroep-site welke variant
  // geldt (de kortsluitingen hieronder gebruiken 'm alleen wanneer `succElapsed` al vaststaat).
  const landRawInstant = (raw: Date, elapsedLanding = false): Date =>
    se.isHourMode ? raw : elapsedLanding ? deps.startOfDay(raw) : se.nextWorkDay(deps.startOfDay(raw));

  switch (seq.type) {
    case 'START_START': {
      const base = predStartsNextDay ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
      // T8-review-BLOCKER (vervolg op H1, uur-analoog van forwardDay's SS hierboven): de
      // `deps.snapOnOrAfter(se, …)`-omhulling forceert een werk-instant van de OPVOLGER-kalender —
      // voor een ELAPSEDTIME-opvolger juist niet gewenst (de `shiftLagPred`/`elapsedMin`-uitkomst
      // zelf blijft ongemoeid: die interpreteert de LAG in de geselecteerde lagkalender, een
      // orthogonale vraag). `succElapsed`: geef de ongesnapte waarde terug.
      if (elapsed) {
        const raw = new Date(base.getTime() + elapsedMin());
        return succElapsed ? raw : deps.snapOnOrAfter(se, raw);
      }
      // BEKENDE BEPERKING (gevonden tijdens de T8-hercheck-BLOCKER "nóg zulke hersnap-plekken"-
      // controle, NIET gefixt): `deps.shiftLagPred` normaliseert bij lag=0 zelf óók via
      // `nextWorkInstant(base)`, in de VOORGANGER-engine — vóór de `succElapsed`-check hieronder
      // ooit gezien wordt. Is `predTask` zelf ELAPSEDTIME mét een rauwe, niet-op-band liggende
      // `base` (mogelijk sinds de blocker-fix hierboven), dan snapt deze regel `base` alsnog naar
      // de eerstvolgende werk-instant van de VOORGANGER — dezelfde klasse fout als de blocker, maar
      // nu via de voorganger-zijde van `shiftLagPred` i.p.v. de opvolger-zijde. FF/SF hierboven/
      // hieronder ontsnappen hieraan via hun eigen `lagIsZero`-detectie-en-vervang-mechanisme
      // (`landRawInstant`); SS heeft dat mechanisme niet. Niet gefixt: `shiftLagPred` is een gedeeld
      // CalendarEngine-pad met 9 aanroepplekken in dit bestand — een blinde aanpassing daar raakt
      // FF/SF se al zorgvuldig afgestemde gedrag potentieel mee. Smal genoeg (vereist een ELAPSEDTIME
      // voorganger MET een volledig buiten-band liggende eigen positie, bv. een heel weekend zonder
      // enige band) om als apart, gedocumenteerd gat te laten staan i.p.v. in deze fixronde te lossen.
      const lagged = deps.shiftLagPred(lagEng, base, seq, predTask, 1);
      return succElapsed ? lagged : deps.snapOnOrAfter(se, lagged);
    }
    case 'FINISH_FINISH': {
      // MSP-pariteit (L1, Opus-review): `startFromFinish` geeft voor een mijlpaal-opvolger
      // `reqFinish` ONGEWIJZIGD terug (pure pass-through) — vóór deze fix werd `reqFinish` dus
      // altijd al vooraf gesnapt via `shiftLagPred`, óók bij lag=0, en landde een FF-eindmijlpaal
      // dus nooit op de rauwe voorganger-finish. Zelfde `lagIsZero`-kortsluiting als de FS-tak
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
          reqFinish = landRawInstant(predResult.ef, succElapsed);
        } else {
          reqFinish = lagged;
        }
      }
      if (succIsStartMs && !predEndsBeginOfDay) return deps.snapStrictAfter(se, reqFinish);
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'START_FINISH': {
      // MSP-pariteit (L1, Opus-review): zelfde redenering als FINISH_FINISH hierboven, maar het
      // rauwe anker is hier `startMoment` (de voorganger-START-zijde, incl. dagbegin-mijlpaal-
      // correctie) i.p.v. `predResult.ef` — SF ankert de opvolger-finish op de voorganger-START.
      // `reqFinish` (de geëiste finish zelf) wordt gedeeld met `sfReqFinishHour` (Z10,
      // `forwardFinishFloor`) — één bron, zie die functies moduleheader.
      const reqFinish = sfReqFinishHour(deps, predResult, predTask, seq, successor, pe, se, flags);
      return deps.startFromFinish(se, reqFinish, successor);
    }
    case 'FINISH_START':
    default: {
      // FS (§4.3): de opvolger consumeert de exclusieve "beschikbaar-vanaf"-instant van de
      // voorganger via `availableStart` — die ceilt een dag-opvolger correct naar de volgende
      // volledige werkdag (scenario 7 uur→dag) en snapt een uur-opvolger naar de eerstvolgende
      // werk-instant (scenario 1/6). Lag telt daarvóór in de voorganger-engine.
      if (elapsed) {
        // MSP-pariteit (L2, Opus-review): een ELAPSEDTIME-lag van exact 0 klok-minuten is dezelfde
        // "geen échte lag"-situatie als de WORKTIME-tak hieronder — vóór deze fix ging deze arm
        // altijd via `se.availableStart`, ook bij 0 minuten, en landde een elapsed-FS-eindmijlpaal
        // dus nooit op de rauwe instant. Geen `lagIsZero`-vergelijking nodig: 0 klok-minuten is per
        // definitie geen verschuiving. Anker is `predResult.ef` RECHTSTREEKS (NIET `predDone` —
        // die dag-boundary-+1-afleiding hieronder is een WORKTIME-concept en hoort hier niet: vóór
        // deze fix gebruikte deze arm ook al kaal `predResult.ef`, byte-identiek voor `pe.isHourMode
        // === false`; het per-ongeluk gebruiken van `predDone` hier schoof een dag-pred-scenario een
        // hele dag op — gevangen door `elapsed-day-to-hour` in cases-hours.json).
        const target = new Date(predResult.ef.getTime() + elapsedMin());
        if (succIsFinishMs && pe.isHourMode && elapsedMin() === 0) {
          return landRawInstant(target);
        }
        return se.availableStart(target);
      }
      const predDone = (succIsFinishMs || predEndsBeginOfDay)
        ? predResult.ef                       // mijlpaal-grens: geen dag-boundary-+1 (dag-conceptueel)
        : pe.predDoneAt(predResult.ef);
      const lagged = deps.shiftLagPred(lagEng, predDone, seq, predTask, 1);
      // `lagIsZero` (T6, hieronder al gebruikt vóór Z11): "de geshifte waarde == wat een kale
      // nul-lag-normalisatie in de VOORGANGER zou geven" ⇒ er is geen échte lag toegepast. Vereist
      // `pe.isHourMode`: `nextWorkInstant` is een uur-modus-primitief (non-null assertion op
      // `workTime`) — bij een DAG-voorganger (cross-modus) crasht de aanroep, vandaar de wacht.
      const lagIsZero = pe.isHourMode
        && lagged.getTime() === deps.snapOnOrAfter(lagEng, predDone).getTime();
      // Z11 (kruis-kalender-FS-asymmetrie, uur-analoog van de dag-fix in `forwardDay` hierboven in
      // dit bestand): bij lag=0 met IDENTIEKE effectieve landingsdag-band (de discriminator
      // hierboven, `calendarsAgreeOnSharedWorkdayBands` — datum-effectief sinds de fixronde, punt 1)
      // snapt de grens rechtstreeks in de OPVOLGER-kalender i.p.v. eerst in de voorganger — anders
      // duwt `pe.nextWorkInstant` (via `shiftLagPred`, hier al toegepast in `lagged`) een extra
      // werkdag van de opvolger (bv. een werkende zaterdag) al weg vóórdat `se` ooit gezien wordt
      // (het uur-modus-analoog van T16c-M1's OzBuild-corpusgeval, corpusloos gepind: msp-38/msp-39
      // in cases-msp-pariteit.json). Beperkt tot hour-hour (`se.isHourMode`, naast `lagIsZero`s eigen
      // `pe.isHourMode`-wacht): een cross-modus-combinatie is hier niet gereconstrueerd of getoetst.
      // Uitgesloten (fixronde, punt 2, MIDDEN/verplicht — spiegelt de dag-tak hierboven ÉÉN-op-ÉÉN,
      // zie die uitleg voor de volledige redenering):
      //  - `succIsFinishMs`/`predEndsBeginOfDay` — de bestaande mijlpaal-grens-tak (eigen, al geteste
      //    kortsluiting, hieronder) blijft volledig met rust.
      //  - `succIsStartMs` — vóór Z11 geen eigen kortsluiting in deze tak; pin:
      //    `msp-41-z11-punt2-startmijlpaal-uitgesloten`.
      //  - `succElapsed` — een 24/7-opvolger accepteert elke instant; `se.availableStart` zou 'm ten
      //    onrechte naar een werk-instant snappen. Vóór Z11 liep zo'n opvolger door dezelfde
      //    generieke tak als een gewone taak (bestaand, hier niet aangeraakt gat); de uitsluiting
      //    houdt Z11 byte-identiek aan dat vóór-Z11-gedrag. Pin: `msp-42-z11-punt2-elapsed-opvolger-
      //    uitgesloten`.
      // Dit raakt uitsluitend het "twee gewone taken"-pad. Zónder de discriminator (bandgrenzen die
      // OP DE LANDINGSDAG zelf verschillen, zoals de guard-case) blijft het bestaande
      // voorganger-eerst-gedrag staan: de `if` hieronder faalt dan gewoon en de functie valt door
      // naar `se.availableStart(lagged)`.
      if (!succIsFinishMs && !predEndsBeginOfDay && !succIsStartMs && !succElapsed
        && se.isHourMode && lagIsZero
        && calendarsAgreeOnSharedWorkdayBands(pe, se, predDone)) {
        return se.availableStart(predDone);
      }
      // MSP-pariteit (T6, §9/O6): een EINDmijlpaal-opvolger zonder lag landt op de RAUWE
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
      // GEEN `!predEndsBeginOfDay`-subconditie (L3, Opus-review — HERZIEN op een tweede review-
      // ronde: het eerdere commentaar hier claimde dat de exclusie "bewezen dood" was, met als
      // argument dat zo'n voorganger-anker altijd al in `[start,end)` ligt. Dat argument nam
      // stilzwijgend aan dat zo'n anker altijd via de EIGEN kalender van de voorganger tot stand
      // komt — vals: de dataDate-vloer ("NIET GESTART", CPMSolver's forwardPass) zet de ES van
      // een niet-gestarte nul-duur-voorganger (géén mijlpaal per se — `predEndsBeginOfDay` slaat
      // hier al aan bij `scheduleDuration<=0`) op `dataDate`, dat zelf gesnapt is in de PROJECT-
      // kalender, niet in de EIGEN kalender van die voorganger. Verschillen die twee kalenders van
      // bandstructuur, dan kan zo'n anker WÉL exact op een band-eind van zijn EIGEN kalender
      // landen — precies de dataDate-vloer-constructie die case msp-06 in cases-msp-pariteit.json
      // vastlegt (daar voor de SF-tak). Hetzelfde mechanisme geldt hier voor `predEndsBeginOfDay`
      // in de FS-tak: het verwijderen van de exclusie is dus een BEWUSTE verbreding van de MSP-
      // conventie naar dat geval, geen no-op — mutatiebewezen door de tweelingcase msp-06b (idem,
      // maar FS i.p.v. SF): `!predEndsBeginOfDay` teruggezet ⇒ msp-06b alleen ROOD.
      // `pe.isHourMode`-wacht is VERPLICHT (nu binnen `lagIsZero` hierboven): `nextWorkInstant` is
      // een uur-modus-primitief (`bandsStartingOn` leest `calendar.workTime!.byWeekday` zonder
      // guard) — bij een DAG-voorganger (cross-modus, bv. `rr-fs-crossmode-daypred-hourfinishms`)
      // zou de aanroep crashen op de non-null assertion. Die combinatie werkt al correct via de
      // bestaande dag-lag-tak van `shiftLagPred` + `availableStart` en blijft dus ongemoeid.
      if (succIsFinishMs && lagIsZero) return landRawInstant(predDone);
      return se.availableStart(lagged);
    }
  }
}

/** De door een SF-relatie geëiste opvolger-FINISH (uur-modus) — gedeeld tussen `forwardHour`'s
 *  `START_FINISH`-tak en `forwardFinishFloor` (Z10), zodat er precies ÉÉN plek is die `reqFinish`
 *  berekent (spiegelt `sfReqFinishDay`). Zelfstandig aanroepbaar — `forwardHour` zelf blijft
 *  byte-identiek, ze roept 'm nu gewoon aan i.p.v. de formule inline te herhalen. */
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
  const succElapsed = !isZeroDurationMilestone(successor) && successor.time.durationType === 'ELAPSEDTIME';
  const landRawInstant = (raw: Date, elapsedLanding = false): Date =>
    se.isHourMode ? raw : elapsedLanding ? deps.startOfDay(raw) : se.nextWorkDay(deps.startOfDay(raw));

  const startMoment = predStartsNextDay ? deps.snapStrictAfter(pe, predResult.es) : predResult.es;
  if (elapsed) {
    return succElapsed
      ? new Date(startMoment.getTime() + elapsedMin())
      : deps.snapOnOrAfter(se, new Date(startMoment.getTime() + elapsedMin()));
  }
  const lagged = deps.shiftLagPred(lagEng, startMoment, seq, predTask, 1);
  if ((succIsFinishMs || succElapsed) && pe.isHourMode
    && lagged.getTime() === deps.snapOnOrAfter(lagEng, startMoment).getTime()) {
    return landRawInstant(startMoment, succElapsed);
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
  // T8-review H2: zie backwardDay se `predElapsed` — dezelfde definitie, hier voor de uur-FS-tak
  // (`prevWorkInstant` hieronder is de uur-tegenhanger van `prevWorkDayBefore`, met dezelfde
  // over-knijp-fout voor een ELAPSEDTIME-voorganger).
  // H3 (Opus-review T15-iteratie-2) — zelfde reden als `succElapsed` hierboven, nu voor de
  // VOORGANGER-zijde van de relatie. B2-BEVINDING: zelfde ONGEPINDE status als backwardDay se
  // `predElapsed` hierboven — corpus- en case-neutraal, meegeconverteerd voor consistentie.
  const predElapsed = !isZeroDurationMilestone(predTask) && predTask.time.durationType === 'ELAPSEDTIME';

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
      const succDayStart = () => deps.startOfDay(succResult.ls);
      if (pe.isHourMode && se.isHourMode) {
        // hour-hour: pred.LF = prevWorkInstant( succ.LS ⊖ lag ) (scenario 1-6 backward).
        // De grensvlaggen onderdrukken UITSLUITEND de finish-/band-gap-normalisatie, NOOIT de lag —
        // exact zoals de dag-tak, die `addWorkingDaysSigned(succ.LS, −lag)` onvoorwaardelijk toepast
        // en de vlaggen alleen over `prevWorkDayBefore` laat beslissen. (Vóór 2026-07-20 viel de lag
        // in deze arm wég zodra een vlag stond, terwijl `forwardHour` hem wél toepaste ⇒ forward/
        // backward-asymmetrie en een echt float-/kritiek-pad-verschil met dag-modus.)
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
        // H2: `prevWorkInstant` is de uur-tegenhanger van `prevWorkDayBefore` (dag-modus) — zelfde
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
        // GEEN grensvlaggen — en dat is bewust, geen omissie (onderzocht 2026-07-20). De vlaggen
        // onderdrukken in `forwardHour` uitsluitend de dagrand van `pe.predDoneAt(ef)`, maar `pe` is
        // in deze arm per definitie UUR-modus en daar is `predDoneAt` de identiteit
        // (`CalendarEngine.predDoneAt`, mode 'hour' ⇒ `new Date(ef)`). Beide takken van die ternaire
        // leveren dus dezelfde instant; er is forward niets te onderdrukken en backward niets te
        // spiegelen. Vlaggen hier alsnog toevoegen zou werkend gedrag breken.
        const target = deps.shiftLagPred(lagEng, succDayStart(), seq, predTask, -1);
        // H2 (cross-modus): zelfde `prevWorkInstant`-over-knijp als de hour-hour-arm hierboven.
        if (predElapsed) return target;
        return pe.prevWorkInstant(target);
      }
      // (b) dag-voorganger, uur-opvolger: de grootste werkdag d waarvoor de forward-afleiding
      // se.nextWorkInstant( predDone(d) ⊕ lag ) ≤ succ.LS blijft (scenario 7 backward).
      // T8-review H2, BEKENDE BEPERKING (herbevestigd, T8-hercheck 2 — msp-26 pint 'm expliciet):
      // deze scanlus doorzoekt uitsluitend WERKdagen van de dag-voorganger (`pe.isWorkDay(d)`) —
      // voor een ELAPSEDTIME dag-voorganger is dat een te smalle zoekruimte (zijn late finish mag
      // ook op een niet-werkdag liggen). GEVOLG, concreet (msp-26, geverifieerd, niet gegist): de
      // scanlus vindt de eerstvolgende WERKdag terug vanaf `succ.LS`, in plaats van de eerstvolgende
      // KALENDERdag — dat is te STRENG (levert een te vroege late-finish), met drie zichtbare
      // symptomen op de elapsed voorganger: (1) `ls` VÓÓR zijn eigen vroege anker (`es`), (2)
      // `tf` NEGATIEF zonder dat er ook maar één constraint/deadline in het spel is, (3) de
      // invariant `ff ≤ tf` GEBROKEN (`ff` blijft 0 — de relatie-vrije-speling-berekening zit
      // bovendien al vast aan het M2/L3-eenhedengat — terwijl `tf` negatief wordt: 0 ≤ negatief is
      // onwaar). Niet gefixt: dit vergt een ander algoritme (een kalenderdag-scan i.p.v. een
      // werkdag-scan), geen kale parameterwissel zoals de overige H1/H2-fixes in dit bestand —
      // buiten de scope van deze fixronde (orkestrator registreert 'm voor T13/T15). Niet geraakt
      // door msp-16..25 hieronder (die dekken dag+dag en uur+uur, niet dit cross-modus-pad).
      // De grensvlaggen tellen hier WÉL — in tegenstelling tot arm (a) is `pe` dag-modus en levert
      // `predDoneAt(ef)` de dagrand `(ef+1 dag)@00:00`, die `forwardHour` bij een vlag onderdrukt
      // (`predDone = (succIsFinishMs || predEndsBeginOfDay) ? ef : pe.predDoneAt(ef)`). Vóór
      // 2026-07-20 deed deze scanlus dat onvoorwaardelijk NIET ⇒ de backward-pass accepteerde pas
      // een werkdag eerder, met late datums één werkdag te vroeg en totale speling −1 op een taak
      // zónder constraint of deadline (dag→dag én uur→uur geven daar 0 — een echte dag/uur-
      // pariteitsbreuk). Mét speling wordt de fout niet geabsorbeerd maar eet hij er precies één
      // werkdag van op (zie de case rr-fs-crossmode-daypred-hourms-slack: tf 1 stond op 0).
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
