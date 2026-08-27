import type { Task, TaskTimeComputed, TaskTimeInput } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { CPMResult, CPMTaskResult } from './CPMSolver';
import { CalendarEngine } from './CalendarEngine';
import { parseInstant } from '@/utils/dateUtils';
import { projectDurationOf } from './projectDuration';

/**
 * "Datums zoals opgeslagen" (issue #63) — de pure laag.
 *
 * Een via P6 → IFC geïmporteerde planning draagt datums maar vaak geen sluitende logica. Openen
 * herberekent onvoorwaardelijk (dat blijft zo — die solve ís de detectie), waarna de bron onzichtbaar
 * is. Deze module legt vast wat het bestand zei, telt de verschillen, en reconstrueert een `CPMResult`
 * uit die vastlegging in plaats van te solven.
 *
 * KERNREGEL: nooit iets beweren wat het bestand niet zegt. `parseDateFromIFC` maakt van een `$`-slot
 * de datum van vandaag, dus de aanwezigheidsregistratie uit de lezer (`ImportResult.recordedFields`)
 * is de enige betrouwbare bron voor "dit stond er echt". Dat geldt niet alleen voor de zeven
 * REKENSLOTS (early-, late-, float- en isCritical-slots) maar ook voor de twee INVOERSLOTS ScheduleStart/
 * ScheduleFinish: een taak zonder IfcTaskTime, of met `$` op ScheduleStart, mag NOOIT als "vandaag
 * opgeslagen" verschijnen (kwaliteitsreview MOET 1) — zie de laagkeuze in `captureRecordedDates`.
 */

/** Wat het bestand per taak vastlegde. Alles behalve start/finish is optioneel: ontbreekt het in het
 *  bestand, dan blijft het hier `undefined` in plaats van een verzonnen nul. */
export interface RecordedTime {
  start: string;
  finish: string;
  lateStart?: string;
  lateFinish?: string;
  totalFloat?: number;
  freeFloat?: number;
  isCritical?: boolean;
}

// Drift-anker (kwaliteitsreview MOET 3): elk CPM-veld in `TaskTimeComputed` moet ook hier een plek
// hebben, op precies twee bewuste uitzonderingen na — `earlyStart`/`earlyFinish` heten hier `start`/
// `finish` (de laagkeuze in `captureRecordedDates` kan ze immers ook uit `schedule*` vullen, dus de
// neutrale naam). Een NIEUW CPM-veld dat noch hier noch in die uitzonderingslijst landt geeft een
// compile-fout in plaats van stil te breken (de meest waarschijnlijke stille regressie: het veld
// bestaat wél in `TaskTimeComputed`/`RECORDED_SLOT_KEYS`, maar de reconstructie vult het nooit).
type _Expect<T extends true> = T;
type _IsNever<T> = [T] extends [never] ? true : false;
type _RecordedTimeOngedekt = Exclude<keyof TaskTimeComputed, keyof RecordedTime | 'earlyStart' | 'earlyFinish'>;
const _assertRecordedTimeCompleet: _Expect<_IsNever<_RecordedTimeOngedekt>> = true;
void _assertRecordedTimeCompleet;

/** Vastlegging voor een set taken: per taak-id wat het bestand zei, plus de noemer voor de melding.
 *  BEWUST GEEN `shifted`-veld hier (kwaliteitsreview MOET 5): dat is een NÁ-de-solve-vergelijking
 *  (`countShiftedTasks`) en zou hier alleen als een placeholder-nul kunnen staan — precies de
 *  "0 taken verschoven"-leugen die een consument die het veld zonder na te denken uitleest, gelooft.
 *  Wil een aanroeper capture + shifted-telling samen bewaren, dan bouwt hij zelf
 *  `{ ...captureRecordedDates(...), shifted: countShiftedTasks(...) }` — de twee bronwaarden bestaan
 *  dan pas ECHT allebei. */
export interface RecordedDates {
  /** Per taak-id wat het bestand vastlegde. */
  times: Record<string, RecordedTime>;
  /** Aantal taken met vastgelegde datums — de noemer in de melding. */
  total: number;
}

/** Wat de store bewaart: de vastlegging plus de ná de solve gemeten verschuiving. Bewust alleen een
 *  TYPE — `captureRecordedDates` levert `shifted` niet, want die waarde bestaat op dat moment nog
 *  niet (zie de docstring van `RecordedDates` hierboven). De aanroeper (`fileSlice.applyLoadedProject`,
 *  taak 4) bouwt zelf `{ ...captureRecordedDates(...), shifted: countShiftedTasks(...) }` —
 *  `documentContract.ts` draagt alleen het type in `DOCUMENT_FIELDS`, niet de samenstelling ervan. */
export interface RecordedDatesState extends RecordedDates {
  /** Aantal taken waarvan de herberekening de datums verschoof — de teller in de melding. */
  shifted: number;
}

/**
 * Leg vast wat het bestand zei. ROEP DIT AAN VÓÓR `runCPM`: de store deelt de taak-objecten met het
 * parse-resultaat, dus na de solve zijn de oorspronkelijke waarden overschreven.
 *
 * DE LAAGKEUZE (kwaliteitsreview MOET 1 + MOET 4) wordt ÉÉN KEER PER TAAK gemaakt, niet per veld:
 *  - Beide early-slots (`earlyStart` ÉN `earlyFinish`) aanwezig ⇒ de early-laag ("berekend, maar het
 *    bestand droeg het resultaat").
 *  - Anders, en alleen als beide schedule-slots (`scheduleStart` ÉN `scheduleFinish`) aanwezig zijn
 *    ⇒ de schedule-laag ("zoals opgeslagen" in de zin van issue #63 — een P6-export die alleen
 *    ScheduleStart/ScheduleFinish vult).
 *  - Geen van beide paren compleet ⇒ GEEN uitspraak over deze taak; hij wordt overgeslagen (landt
 *    niet in `times`, telt niet mee in `total`). Dit is het pad dat een IFCTASK zonder IfcTaskTime
 *    (of met `$` op ScheduleStart) raakt: zonder deze guard zou `t.scheduleStart` de "vandaag"-
 *    fallback van `createDefaultTaskTime`/`parseDateFromIFC` zijn — een verzonnen datum die er als
 *    een echte opgeslagen waarde uit zou zien.
 * Een HALF paar (bv. alleen `earlyStart` aanwezig) wordt NOOIT aangevuld met de andere laag: zo'n
 * samengesteld paar heeft het bestand nooit gezegd, en kan zelfs finish-vóór-start opleveren.
 *
 * `late*`/`totalFloat`/`freeFloat`/`isCritical` staan LOS van de laagkeuze: die vijf worden — zoals
 * altijd — individueel meegenomen zodra hun eigen slot aanwezig is, ongeacht welke laag voor
 * start/finish werd gekozen.
 *
 * `recordedFields` komt uit `ImportResult.recordedFields` (`src/services/ifc/ifcTaskSlots.ts`,
 * `RECORDED_SLOT_KEYS` + `RECORDED_INPUT_SLOT_KEYS`) — de engine mag niet uit de services-laag
 * importeren, dus dit neemt bewust het structurele unietype via `@/types/task` (MOET 2:
 * `keyof TaskTimeComputed | keyof TaskTimeInput` i.p.v. een ongecontroleerd `string`), zodat een
 * hernoemd CPM-veld hier een compile-fout geeft in plaats van een `has.has(...)` die stil nooit meer
 * waar wordt.
 */
export function captureRecordedDates(
  tasks: Task[],
  recordedFields: Record<string, readonly (keyof TaskTimeComputed | keyof TaskTimeInput)[]> | undefined,
): RecordedDates {
  const times: Record<string, RecordedTime> = {};
  if (!recordedFields) return { times, total: 0 };

  for (const task of tasks) {
    const present = recordedFields[task.id];
    if (!present) continue; // taak niet uit dit bestand (of niet-IFC-import) — niets te zeggen
    const has = new Set(present);
    const t = task.time;

    let start: string;
    let finish: string;
    if (has.has('earlyStart') && has.has('earlyFinish')) {
      start = t.earlyStart;
      finish = t.earlyFinish;
    } else if (has.has('scheduleStart') && has.has('scheduleFinish')) {
      start = t.scheduleStart;
      finish = t.scheduleFinish;
    } else {
      continue; // geen van beide lagen compleet ⇒ geen uitspraak (MOET 1) — niet in times, niet in total
    }

    times[task.id] = {
      start,
      finish,
      lateStart: has.has('lateStart') ? t.lateStart : undefined,
      lateFinish: has.has('lateFinish') ? t.lateFinish : undefined,
      totalFloat: has.has('totalFloat') ? t.totalFloat : undefined,
      freeFloat: has.has('freeFloat') ? t.freeFloat : undefined,
      isCritical: has.has('isCritical') ? t.isCritical : undefined,
    };
  }
  return { times, total: Object.keys(times).length };
}

/** Hoeveel taken kregen door de solve andere datums dan het bestand vastlegde? Roep dit aan NÁ
 *  `runCPM`, met dezelfde `times` die vóór de solve is vastgelegd (`captureRecordedDates(...).times`
 *  — symmetrisch met `cpmResultFromRecorded` hieronder, die dezelfde `Record<string, RecordedTime>`
 *  neemt, geen bredere wrapper: KLEIN-8, kwaliteitsreview). */
export function countShiftedTasks(tasks: Task[], times: Record<string, RecordedTime>): number {
  let n = 0;
  for (const task of tasks) {
    const rec = times[task.id];
    if (!rec) continue;
    if (task.time.earlyStart !== rec.start || task.time.earlyFinish !== rec.finish) n++;
  }
  return n;
}

/**
 * Bouw een `CPMResult` uit de vastlegging, zonder te solven.
 *
 * Neemt `times` — dezelfde vorm als `countShiftedTasks`, niet de bredere `RecordedDates`-wrapper
 * (KLEIN-8, kwaliteitsreview): die suggereerde ten onrechte dat `total` de reconstructie zou kunnen
 * beïnvloeden. Een aanroeper geeft dus `captureRecordedDates(...).times` door.
 *
 * Gevuld: per-taak-resultaten, projecteinde, projectduur, gemiste deadlines, en — alléén wanneer het
 * bestand `IsCritical` gaf — het kritieke pad.
 *
 * BEWUST LEEG, want het staat niet in IFC en kan dus nooit eerlijk gevuld worden: driving-relaties
 * (de solver-docstring zegt expliciet dat die niet gepersisteerd worden), relatie-speling, afgekapte
 * leads, geschonden constraints, out-of-sequence, near-critical, float-paths, hammock-waarschuwingen.
 *
 * `totalFloat`/`freeFloat` zijn in `CPMTaskResult` verplichte getallen; ontbreken ze in het bestand,
 * dan wordt het 0. Dat is het enige punt waar deze module een getal noemt dat het bestand niet gaf —
 * de blijvende modus-strook is daar het tegengif.
 *
 * `projectDuration` deelt `projectDurationOf` (`projectDuration.ts`) met de solver-post-pass
 * (`scheduleAnalysis.ts`) — inclusief de mijlpaal-alleen-uitzondering (een project dat op één dag
 * valt zonder échte werk-taken krijgt duur 0). Vóór deze extractie week de reconstructie hier
 * stilzwijgend af (eerder gedocumenteerd als "afwijking 1"); die afwijking bestaat nu niet meer.
 *
 * RANDGEVAL VAN DIE UITZONDERING (hercontrole kwaliteitsreview, bewust NIET afgedekt): "échte werk-
 * taak" wordt door `projectDurationOf` bepaald via `!t.isMilestone && t.time.scheduleDuration > 0`,
 * gelezen van het LEVENDE `Task`-object (`recorded`, dus de `tasks`-parameter van deze functie) — NIET
 * uit de vastlegging (`RecordedTime`). Deze module registreert bewust GEEN aanwezigheid voor
 * `scheduleDuration` (alleen `scheduleStart`/`scheduleFinish` zijn invoerslots met een presence-
 * registratie, zie `RECORDED_INPUT_SLOT_KEYS`). Een niet-mijlpaal-taak waarvan het bestand geen
 * `ScheduleDuration` gaf, leest via `parseDurationDays('$') → 0` dus scheduleDuration=0 — en telt
 * daarmee in `projectDurationOf` mee als "geen echt werk". Gevolg: een écht één-dags werkproject zónder
 * opgeslagen duur krijgt hier `projectDuration` 0 in plaats van 1, terwijl `scheduleAnalysis.ts`
 * hetzelfde risico in theorie deelt maar het na een solve nooit raakt (de solver vult
 * `scheduleDuration` altijd, want die IS de rekeninvoer). Lage impact (vereist: uur-precisie
 * projectgrootte van exact één dag, én een bewust weggelaten ScheduleDuration in een verder geldig
 * bestand) en hier bewust niet gedicht — dichten vraagt een derde presence-registratie
 * (`scheduleDuration`) die deze module tot nu toe niet nodig had.
 *
 * ÉÉN OVERGEBLEVEN, SCHERP AFGEBAKENDE AFWIJKING van `scheduleAnalysis.ts` (GRAAG-7,
 * kwaliteitsreview): `missedDeadlineTaskIds` vergelijkt hier met simpele stringvergelijking
 * (`rec.finish > task.deadline`); de solver rekent i.p.v. daarvan met instants en met
 * `cal.prevWorkDay(deadline)`, over de KALENDER VAN DIE TAAK (`calendarFor(task)`). Met ÉÉN kalender
 * (de enige die deze functie kent — haar `calendar`-parameter) lopen de twee BEWIJSBAAR NOOIT uiteen:
 * `prevWorkDay(dl) ≤ dl`, en er bestaat op diezelfde kalender geen werkdag strikt tussen
 * `prevWorkDay(dl)` en `dl`. Divergentie vereist dus een taak op een ANDERE kalender dan de
 * meegegeven kalender (`task.calendarId` wijst naar een resource-/bibliotheekkalender) — een geval
 * dat deze pure reconstructiefunctie sowieso niet kan zien, want ze krijgt maar één kalender mee.
 * Dichttrekken vraagt per-taak-kalenders die ze bewust niet heeft (ze reconstrueert — ze solvet niet).
 * Er is wél één echte extra divergentie die BINNEN één kalender kan optreden: uur-modus met
 * `rec.finish` exact op `'…T00:00'` van de deadline-dag — de stringvergelijking hier meldt "gemist",
 * de solver niet (middernacht hoort bij de vorige werkdag, `prevWorkDay`-semantiek).
 *
 * KLEIN-9 (kwaliteitsreview): `projectStart`/`projectEnd` worden hieronder met stringvergelijking
 * (`<`/`>`) bepaald. Bij GEMENGDE dag/uur-formaten binnen dezelfde taakset (bv. `'2026-03-09T17:00'`
 * naast `'2026-03-09'`) wint de datetime-string lexicografisch ook wanneer de dag-taak semantisch
 * later eindigt. `projectDuration` blijft correct (die rekent met `parseInstant`, niet met de ruwe
 * string); alleen de GERAPPORTEERDE `projectEnd`/`projectStart`-string kan in zo'n gemengd geval
 * afwijken. Zeldzaam (uur-modus is per-kalender, niet per-taak, dus dit vergt gemengde kalenders in
 * dezelfde reconstructie) en hier niet opgelost.
 */
export function cpmResultFromRecorded(
  times: Record<string, RecordedTime>,
  tasks: Task[],
  calendar: WorkCalendar,
): CPMResult {
  const out = new Map<string, CPMTaskResult>();
  const criticalPath: string[] = [];
  const missedDeadlineTaskIds: string[] = [];
  let projectEnd = '';
  let projectStart = '';

  // Geen sortering: niets stroomafwaarts (deze functie, noch een consument) leunt op de volgorde
  // van `out`/`criticalPath` — de invoervolgorde van `tasks` is dus prima. `projectStart`/`projectEnd`
  // worden hieronder toch met min/max bepaald, ongeacht iteratievolgorde.
  const recorded = tasks.filter((t) => times[t.id]);

  for (const task of recorded) {
    const rec = times[task.id];
    out.set(task.id, {
      earlyStart: rec.start,
      earlyFinish: rec.finish,
      // Geen late-datum in het bestand ⇒ gelijk aan de vroege: geen afgeleide bewering.
      lateStart: rec.lateStart ?? rec.start,
      lateFinish: rec.lateFinish ?? rec.finish,
      totalFloat: rec.totalFloat ?? 0,
      freeFloat: rec.freeFloat ?? 0,
      isCritical: rec.isCritical ?? false,
    });
    if (rec.isCritical) criticalPath.push(task.id);
    if (task.deadline && rec.finish > task.deadline) missedDeadlineTaskIds.push(task.id);
    if (!projectStart || rec.start < projectStart) projectStart = rec.start;
    if (rec.finish > projectEnd) projectEnd = rec.finish;
  }

  // Werkdagen tellen is geen solve — de kalender kan de span gewoon uitrekenen. `parseInstant`, NIET
  // `new Date(...)`: in uur-modus zijn earlyStart/earlyFinish van de vorm "YYYY-MM-DDTHH:mm" ZONDER
  // tijdzone. `new Date(...)` leest zo'n string per ES2015 als LOKALE tijd, terwijl de hele engine
  // hem als UTC leest (zie `parseInstant`-docstring in dateUtils.ts) — bij een positieve offset (bv.
  // Pacific/Auckland, UTC+12/13) verschuift de dag-index en telt `workDaysBetween` een werkdag te
  // weinig of te veel (bewezen: 4 i.p.v. 5 onder TZ=Pacific/Auckland vóór deze fix — kwaliteitsreview
  // MOET 1 op deze functie in een eerdere ronde). `parseInstant` deelt de UTC-aanname met de rest van
  // de engine (date-only blijft byte-identiek: die tak delegeert intern gewoon aan `parseDate`).
  let projectDuration = 0;
  if (projectStart && projectEnd) {
    // CalendarEngine neemt precies één kalender (zie zijn constructor) — de projectkalender.
    const engine = new CalendarEngine(calendar);
    projectDuration = projectDurationOf(engine, parseInstant(projectStart), parseInstant(projectEnd), recorded);
  }

  return {
    tasks: out,
    criticalPath,
    criticalPaths: [criticalPath],
    drivingSequenceIds: [],
    sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [],
    violatedConstraintTaskIds: [],
    missedDeadlineTaskIds,
    outOfSequenceSequenceIds: [],
    nearCriticalTaskIds: [],
    floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [],
    projectEnd,
    projectDuration,
  };
}
