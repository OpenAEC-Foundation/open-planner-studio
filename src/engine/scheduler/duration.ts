import type { Task, TaskSplitGap, TaskTime } from '@/types/task';

/** VOLTOOID zoals `CPMSolver.forwardPass` hem vastpint (tak 1): werkelijk einde én completion 1.
 *  Nivelleerder en resourcebelasting moeten exact dezelfde grens trekken. */
export function isPinnedComplete(time: TaskTime): time is TaskTime & { actualFinish: string } {
  return !!time.actualFinish && time.completion >= 1;
}

/** IN UITVOERING zoals `CPMSolver.forwardPass` hem vastpint (tak 2): gestart (werkelijke start of
 *  voortgang) en nog niet voltooid. */
export function isPinnedInProgress(time: TaskTime): boolean {
  return (!!time.actualStart || time.completion > 0) && time.completion < 1;
}

/** Expliciete eenheid met deterministische leesmigratie voor oudere runtime-data. */
export function taskDurationUnit(task: Task): 'days' | 'hours' {
  const legacy = task.time as Task['time'] & { durationUnit?: 'days' | 'hours' };
  return legacy.durationUnit ?? (legacy.durationMinutes != null ? 'hours' : 'days');
}

/**
 * Gedeelde duur-resolutie-helpers.
 *
 * Ze leven hier en niet in `src/types`, omdat hun tweede argument de effectieve KALENDER-ENGINE is
 * (`isHourMode`/`hoursPerDay`); dat zou een types→engine-afhankelijkheid openen. Het argument is het
 * minimale structurele contract `DurationCalendar` ({ isHourMode, hoursPerDay }): `CalendarEngine`
 * vervult het, en in tests volstaat een plain object.
 *
 * Deze module is een blad: ze importeert niets uit `CPMSolver`/`relationMath`, zodat beide haar
 * definities zonder importcyclus kunnen delen.
 */

/**
 * MS Projects `isMilestone`-vlag is een WEERGAVEmarkering die onafhankelijk van de
 * opgeslagen duur gezet kan worden ("Markeer taak als mijlpaal" in Taakinformatie) — MSP's eigen
 * rekenkern plant zo'n taak gewoon volgens haar eigen duur, ze klapt NIET stil om naar 0. Bewijs:
 * `mpp14task.mpp`/`mpp14task-from2013.mpp` (MSO-taak, `isMilestone=true`, duur 5 dagen — MSP-finish
 * = start + 5 werkdagen) en `taskFlags-mpp14Project2010/2013.mpp` ("Milestone: Yes", duur 8 dagen,
 * zelfde patroon) — vier publieke MPXJ-testfixtures. Alleen een taak met duur 0 is voor de PLANNING
 * een echte mijlpaal.
 *
 * `CPMSolver.ts` én `relationMath.ts` (`succElapsed`/`predElapsed`/`predIsMilestone`/
 * `succIsFinishMs`/`succIsStartMs`) gebruiken deze ene definitie: een kale `isMilestone`-check
 * verschuift een ELAPSEDTIME-taak met `milestone:true` + reële duur een dag (msp-30/msp-31).
 */
export function isZeroDurationMilestone(task: Task): boolean {
  return task.isMilestone && task.time.scheduleDuration === 0;
}

/** Rekent deze taak op de 24/7-klok (ELAPSEDTIME)? Een nulduur-mijlpaal nooit: die heeft geen eigen
 *  duur (een mijlpaal-MET-duur die ELAPSEDTIME is, wél). */
export function isElapsedTask(task: Task): boolean {
  return !isZeroDurationMilestone(task) && task.time.durationType === 'ELAPSEDTIME';
}

/** Minimaal contract dat een uur-bewuste kalender-engine vervult. */
export interface DurationCalendar {
  /** True ⇒ uur-kalender (`WorkCalendar.workTime` aanwezig); false ⇒ dag-kalender. */
  readonly isHourMode: boolean;
  /** Netto werkuren per dag; de dag↔minuut-factor is `hoursPerDay × 60`. */
  readonly hoursPerDay: number;
}

/** `DurationCalendar` plus de twee spanmetingen die een AFGELEIDE duur nodig heeft. Structureel,
 *  net als `DurationCalendar` zelf: `CalendarEngine` vervult dit contract zonder dat deze
 *  bladmodule ernaar hoeft te importeren (dat zou een cyclus richting de solver openen). */
export interface SpanCalendar extends DurationCalendar {
  workMinutesBetween(a: Date, b: Date): number;
  workDaysBetween(start: Date, end: Date): number;
}

/**
 * Schrijf een VOLLEDIG AFGELEIDE duur op `task`: de span `es`→`ef`, uitgedrukt in precies één
 * bron (minuten als de kalender concrete banden heeft, anders werkdagen), met de duur-eenheid
 * meegeschreven.
 *
 * Gedeeld door de hammock-tak van `CPMSolver.forwardPass` en de verzameltaak-rollup in
 * `applyCpmResult`: beide hebben een duur die volledig uit de span volgt.
 *
 * DE DISPATCH IS `cal.isHourMode`, NOOIT de eenheid die de taak toevallig draagt. Dat is geen
 * detail maar de correctheidsvoorwaarde: `workMinutesBetween` telt half-open en mag dus alleen op
 * échte instants; `workDaysBetween` telt inclusief en hoort bij date-only datums. De kalender
 * bepaalt welke van de twee de datums zijn, de taak niet.
 *
 * ELAPSEDTIME rekent 24/7 in KLOK-tijd: de dag-tak deelt door de VASTE klokdag, nooit door
 * `hoursPerDay` (dubbele-deling-valkuil).
 */
export function writeDerivedSpan(task: Task, es: Date, ef: Date, cal: SpanCalendar): void {
  task.time.durationUnit = cal.isHourMode ? 'hours' : 'days';
  if (task.time.durationType === 'ELAPSEDTIME') {
    if (cal.isHourMode) {
      const mins = Math.round((ef.getTime() - es.getTime()) / MS_PER_MIN);
      task.time.durationMinutes = mins;
      task.time.scheduleDuration = mins / (24 * 60);
    } else {
      task.time.durationMinutes = undefined;
      task.time.scheduleDuration = (ef.getTime() - es.getTime()) / (24 * 60 * MS_PER_MIN);
    }
  } else if (cal.isHourMode) {
    const mins = cal.workMinutesBetween(es, ef);
    task.time.durationMinutes = mins;
    task.time.scheduleDuration = mins / (cal.hoursPerDay * 60);
  } else {
    task.time.durationMinutes = undefined;
    task.time.scheduleDuration = cal.workDaysBetween(es, ef);
  }
}

/**
 * Duur van een taak in MINUTEN, in de effectieve kalender.
 *
 * - Urentaak: `durationMinutes` is altijd de bron van waarheid, los van de kalenderidentiteit.
 * - Dagtaak: `scheduleDuration × hoursPerDay × 60`; dit is alleen een kalenderafhankelijk
 *   equivalent voor analyse/weergave en verandert de opgeslagen dagaantallen nooit.
 */
export function durationMinutesOf(task: Task, effCal: DurationCalendar): number {
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return task.time.scheduleDuration * effCal.hoursPerDay * 60;
}

/**
 * Duur van een taak in eigen-kalender-WERKDAGEN (mogelijk fractioneel voor een urentaak).
 *
 * Dit equivalent mag nooit worden gebruikt om een urentaak op een bandloze kalender alsnog als
 * dagen te plannen; `CPMSolver.solve` blokkeert dat expliciet. De native bron blijft minuten.
 */
export function durationDaysOf(task: Task, effCal: DurationCalendar): number {
  if (taskDurationUnit(task) === 'hours') {
    return (task.time.durationMinutes ?? 0) / (effCal.hoursPerDay * 60);
  }
  return task.time.scheduleDuration;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ELAPSEDTIME rekent 24/7 in KLOK-tijd, niet in werktijd — dezelfde semantiek als
// `resolveElapsedMinutes` + de `lagUnit === 'ELAPSEDTIME'`-takken in `relationMath.ts` voor
// relatie-lags, hier op taakDUUR. `MS_PER_MIN` is dezelfde constante als `relationMath.ts` exporteert
// (lokaal gedupliceerd: deze module is een blad, zie de moduleheader).
// ─────────────────────────────────────────────────────────────────────────────────────────────
const MS_PER_MIN = 60_000;
// Zonder klem geeft een absurde ELAPSEDTIME-duur (via MCP `duration`, een corrupt
// bestand, of gewoon een tikfout — een taak-duur is invoer, niet gevalideerd tot hier) een
// `new Date(...)` buiten JS's representeerbare bereik (±8.64e15 ms rond epoch). `new Date()` zelf
// gooit dan niet (levert stil een Invalid Date), maar élke `formatDate`/`formatInstant` erop
// (`.toISOString()`, overal in deze solver) gooit een ONGEVANGEN RangeError — een crash diep in de
// forward/backward-pass zonder duidelijke herkomst. `MAX_ELAPSED_MINUTES` spiegelt
// `CalendarEngine.MAX_DAYS` (200.000 dagen ≈ 547 jaar, ruim boven elk plausibel bouwproject) × 24×60
// — dezelfde beproefde bovengrens, geen derde losse magic number — en de klem-PLAATS spiegelt
// `CalendarEngine.addWorkMinutes` (`Math.min(minutes, MAX_MINUTES)`, vlak vóór de Date-rekenkunde).
const MAX_ELAPSED_MINUTES = 200_000 * 24 * 60;

/** Klem `minutes` op `±MAX_ELAPSED_MINUTES`; NaN/Infinity (kapotte invoer) ⇒ 0 (no-op, nooit een
 *  gecrashte Date i.p.v. een stille verkeerde). */
function clampElapsedMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  if (minutes > MAX_ELAPSED_MINUTES) return MAX_ELAPSED_MINUTES;
  if (minutes < -MAX_ELAPSED_MINUTES) return -MAX_ELAPSED_MINUTES;
  return minutes;
}

/**
 * Duur van een ELAPSEDTIME-taak in KLOK-minuten (24/7).
 *
 * - Urentaak: `durationMinutes` is al klok-tijd-neutraal (`mppReader.ts`: dat veld is `raw.durationRaw / 10` ONGEACHT WORKTIME/ELAPSEDTIME — "een minuut is een minuut") —
 *   direct bruikbaar, geen omrekening nodig.
 * - Dagtaak:
 *   `scheduleDuration` is voor ELAPSEDTIME het aantal KALENDERdagen (`mppReader.ts` zet dit al zo:
 *   `raw.durationRaw / (24 × 60 × 10)`) × 24 × 60 — de VASTE klokdag, NOOIT `hoursPerDay`
 *   (dubbele-deling-valkuil).
 */
export function elapsedMinutesOf(task: Task, effCal: DurationCalendar): number {
  void effCal;
  if (taskDurationUnit(task) === 'hours') return task.time.durationMinutes ?? 0;
  return task.time.scheduleDuration * 24 * 60;
}

/** Tel `minutes` KLOK-minuten op bij `start` (24/7, geen kalenderband-toetsing) — de
 *  ELAPSEDTIME-tegenhanger van `CalendarEngine.addWorkMinutes`/`addWorkDaysChecked`. Geklemd:
 *  zie `MAX_ELAPSED_MINUTES` hierboven. */
export function addElapsedMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + clampElapsedMinutes(minutes) * MS_PER_MIN);
}

/** Trek `minutes` KLOK-minuten af van `end` (24/7, spiegel van `addElapsedMinutes`) — de
 *  ELAPSEDTIME-tegenhanger van `CalendarEngine.subtractWorkMinutes`/`subtractWorkDays`. Geklemd:
 *  zie `MAX_ELAPSED_MINUTES` hierboven. */
export function subtractElapsedMinutes(end: Date, minutes: number): Date {
  return new Date(end.getTime() - clampElapsedMinutes(minutes) * MS_PER_MIN);
}

/**
 * Getekend KLOK-span van `a` naar `b`, in eigen-kalender-DAGEN (fractioneel mogelijk) — de
 * ELAPSEDTIME-tegenhanger van `CalendarEngine.signedWorkDaysBetween`/`workMinutesBetween÷(hoursPerDay×60)`
 * voor float-rekenwerk.
 *
 * Een ELAPSEDTIME-taak mag haar ES/EF op een NIET-werkdag hebben (dat is het punt van 24/7). Daar
 * gaat `signedWorkDaysBetween`s `workDaysBetween(a,a) − 1` stuk: op een niet-werkdag telt
 * `workDaysBetween` 0 werkdagen, dus een taak zonder speling kreeg tf=−1. Deze functie rekent
 * daarom met de RUWE klok-ms-afstand, zonder inclusieve −1-correctie, zodat a===b altijd exact 0
 * geeft. `effCal` doet voor de rekenkunde niet ter zake (een klokdag is altijd 24×60×`MS_PER_MIN`);
 * het argument deelt alleen de aanroepvorm met `durationMinutesOf`/`durationDaysOf`.
 *
 * EENHEID: een ELAPSEDTIME-taak rapporteert `tf`/`ff` dus in KALENDERdagen, ONGEMARKEERD naast
 * WORKTIME-taken in dezelfde velden (die in WERKdagen rekenen). Welke eenheid MS Project hier toont
 * is niet uit de MPXJ-bron af te leiden (daar ontbreekt de MSP-slackimplementatie); MPXJ's
 * `Duration`-model kent wel native `ELAPSED_DAYS`/`ELAPSED_HOURS` naast `DAYS`/`HOURS`, dus een
 * per-taak-eenheid is een bestaand concept — net als bij `scheduleDuration` bepaalt de taak haar
 * eigen eenheid. Gepind in `cases-msp-pariteit.json` (`msp-21-t8-review-m1-eenheden-float`); binnen
 * één taak wijkt `tf` (kalenderdagen) zelfs af van `ff` (werkdagen, zie de relatie-vrije-speling in
 * `scheduleAnalysis.ts`).
 */
export function signedElapsedSpan(a: Date, b: Date, effCal: DurationCalendar): number {
  void effCal;
  return (b.getTime() - a.getTime()) / (24 * 60 * MS_PER_MIN);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// SPLITGAPS in de duur-optelling: "de finish is de start plus de duur, waarbij elk gat als extra
// niet-werktijd telt op zijn eigen offset" — een UITBREIDING van de duur-optelling, GEEN tweede
// algoritme.
//
// DE AS: `TaskSplitGap.afterMinutes`/`gapMinutes` staan NIET op de "kale werkduur"-as
// (`durationMinutesOf`, zonder gaten) maar op MPXJ/MSP's `elapsedWorkMinutes`-as
// (`mppTimephased.ts`'s `TimephasedWorkPeriod`), die CUMULATIEF door de tijdgefaseerde periodes
// loopt en ook een periode met `workMinutes === 0` meetelt: elk gat schuift de as voor het VOLGENDE
// gat mee op. Een venster tegen `durationMinutesOf` klemmen snijdt gaten af (bewijs:
// `mpp14timephased.mpp`s "Task 5 - 24 Hour" — alleen de ongeklemde som 4500 + 5760 minuten vanaf
// 2008-11-20T09:00 reproduceert MSP's finish).
//
// DAAROM een WANDELING over de gaten-as, de tegenhanger van hoe `CalendarEngine.addWorkMinutes`/
// `addWorkDaysChecked` een echte kalender wandelen: `splitTotalSpanMinutes` telt voor een
// hoeveelheid ZUIVER werk elk gat mee dat vóór het doel ligt. "Offset ≥ duur ⇒ genegeerd" volgt daar
// vanzelf uit. De lezer (`mppTimephased.ts`) rekent de as niet om; de consument hier leest
// `afterMinutes` als AS-POSITIE.
//
// VOLLEDIGE DUUR: `splitTotalSpanMinutes(gaps, durationMinutesOf(...))` geeft de TOTALE as-lengte
// (duur + alle geraakte gaten), rechtstreeks door te geven aan `addWorkMinutes`/`addWorkDaysChecked`/
// `subtractWork*`/`addWorkingDaysSigned`.
//
// RESTWERK (in uitvoering): een VERSCHIL van twee wandelingen — `splitTotalSpanMinutes(gaps,
// totaleWerkMinuten) − splitTotalSpanMinutes(gaps, reedsAfgewerkteWerkMinuten)`. De wandeling is
// prefix-consistent, dus gaten VOLLEDIG vóór het afgewerkte doel heffen elkaar op en gaten (deels)
// daarna tellen voluit mee. Een zuiver-werk-hoeveelheid direct tegen `afterMinutes` vergelijken telt
// bij ≥2 gaten een gepasseerd gat soms dubbel.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Totale as-lengte (in werkMINUTEN, `TaskSplitGap`s eigen eenheid) die nodig is om `workMinutes`
 * aan ZUIVERE werk te verzetten, gegeven `gaps` — een wandeling over de synthetische gaten-as
 * (spiegelt `CalendarEngine.addWorkMinutes`s band-voor-band-wandeling, maar op gaten i.p.v. echte
 * kalenderbanden). `gaps` hoeft niet vooraf gesorteerd te zijn (defensief gesorteerd op
 * `afterMinutes`, zelfde "nooit blindelings vertrouwen op aanroeper-volgorde"-conventie als
 * `deriveSplitGapsFromPeriods` in `mppTimephased.ts`).
 *
 * ALGORITME: loop de (gesorteerde) gaten langs; per gat is `segment = gat.afterMinutes − axisPos`
 * het ZUIVERE werksegment vóór dat gat (geen ander gat kan er middenin zitten, want gesorteerd en
 * `axisPos` schuift alleen over reeds-verwerkte gaten heen). Haalt `workDone + segment` het doel
 * (`workMinutes`), dan ligt de aankomst BINNEN dat segment — `axisPos + (workMinutes − workDone)`,
 * het gat wordt NIET overgestoken (dekt zowel "doel vóór het gat" als "doel exact op de gat-start"
 * — "een gat dat exact op de grens begint telt niet mee vóór die grens", spiegelbeeld van "telt wél
 * mee ná die grens" in de verschil-vorm hierboven). Anders: `workDone += segment`, `axisPos` springt
 * over het HELE gat heen (`gat.afterMinutes + gat.gapMinutes`) en de wandeling gaat door. Geen gaten
 * meer (of geen enkel gat gehaald) ⇒ het restant is zuiver werk: `axisPos + (workMinutes − workDone)`.
 *
 * Defensief (`splitGaps` is afgeleide data — een corrupt/hostiel document, bv. via MCP of een
 * handgemaakte IFC/JSON-import, kan in theorie een niet-eindig, negatief-lengte, of terugspringend
 * gat dragen): NaN/Infinity/`gapMinutes<=0` wordt overgeslagen; `gapStart` wordt geklemd op
 * `axisPos` (nooit terug de tijd in) zodat een overlappend/uit-volgorde gat de wandeling niet kan
 * laten teruglopen. `workMinutes<=0` ⇒ 0 (spiegelt `addWorkMinutes`s `minutes<=0`-kortsluiting).
 */
export function splitTotalSpanMinutes(gaps: readonly TaskSplitGap[] | undefined, workMinutes: number): number {
  if (!gaps || gaps.length === 0 || !(workMinutes > 0)) return Math.max(0, workMinutes || 0);
  const sorted = [...gaps].sort((a, b) => a.afterMinutes - b.afterMinutes);
  let axisPos = 0;
  let workDone = 0;
  for (const g of sorted) {
    if (!Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes) || g.gapMinutes <= 0) continue;
    const gapStart = Math.max(g.afterMinutes, axisPos);
    const gapEnd = g.afterMinutes + g.gapMinutes;
    if (gapEnd <= gapStart) continue; // volledig al ingehaald/ontaard — geen bijdrage
    const segment = gapStart - axisPos;
    if (workDone + segment >= workMinutes) {
      return axisPos + (workMinutes - workDone);
    }
    workDone += segment;
    axisPos = gapEnd;
  }
  return axisPos + (workMinutes - workDone);
}

/**
 * `splitTotalSpanMinutes` omgerekend naar eigen-kalender-WERKDAGEN (dag-modus-aanroepers).
 *
 * VALKUIL: `minuten / (hoursPerDay×60)` voor een GATLOZE taak is een vermenigvuldig-dan-delen-rondje
 * dat bij een niet-representeerbare `hoursPerDay` (bv. 8,4) geen exacte 3 geeft maar
 * 3.0000000000000004; `addWorkDaysChecked`s lus ziet die epsilon als "nog niet klaar" en telt een
 * werkdag te veel. Daarom de EXACTE basis (`durationDaysOf` leest `scheduleDuration` rauw) plus
 * ALLEEN de gat-TOESLAG fractioneel; zonder gaten is die toeslag exact 0. Daarom ook `(task, eng)`
 * als signatuur: de aanroeper rekent de minuten niet vooraf uit.
 */
export function splitTotalSpanDays(task: Task, eng: DurationCalendar): number {
  const base = durationDaysOf(task, eng);
  if (!task.splitGaps || task.splitGaps.length === 0) return base;
  const workMinutes = durationMinutesOf(task, eng);
  const extraMinutes = splitTotalSpanMinutes(task.splitGaps, workMinutes) - workMinutes;
  return base + extraMinutes / (eng.hoursPerDay * 60);
}
