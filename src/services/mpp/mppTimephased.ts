/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Timephased-decoder: de dag-voor-dag (of uur-voor-uur) werksegmenten die MS Project per toewijzing
 * bijhoudt (contouring, restwerk, overwerk). Dit bestand is PUUR: geen CFB/storage/field-map-kennis
 * (dat is `mppEntities.ts`, `readAssignmentTimephasedRaw`), geen kalenderrekenen en geen
 * planningsgedrag — alleen bytes → periode-records. Poort-bron: `TimephasedDataFactory.java`; zie
 * "AFWIJKING VAN MPXJ" voor waar deze decoder bewust simpeler is.
 *
 * SCOPE: actual regular work, remaining regular work, actual overtime work en de irregular-
 * tegenhanger. NIET de 11 baseline-timephased-varianten en NIET de kostcategorieën — die dragen
 * niets bij aan datums. Zie `fieldMap14.ts`'s `AssignmentFieldId` voor de vier var-data-sleutels.
 *
 * TWEE VERSCHILLENDE BYTEFORMATEN (`ResourceAssignmentFactory.process`, rond r.202-213):
 * `RAW_TIMEPHASED_ACTUAL_REGULAR_WORK` (50) en `RAW_TIMEPHASED_ACTUAL_OVERTIME_WORK` (51) gaan door
 * `getCompleteWork` (samen met `TIMEPHASED_ACTUAL_IRREGULAR_WORK`, 87), maar
 * `RAW_TIMEPHASED_REMAINING_REGULAR_WORK` (49) door `getPlannedWork` — geen gedeelde byte-lay-out.
 * In het corpus passen 3073/3298 remaining-blokken op het 28-byte-model (typisch 16 + 2×28 = 72 bytes).
 *
 * ── Byteformaat A — REGULIER (`getCompleteWork`, categorieën 50/51 + irregular-tegenhanger 87) ──
 *
 * 16-byte header (eerste 2 bytes = recordcount N, RUW) gevolgd door N+1 records van 20 bytes. Het
 * EERSTE record is een TOTAAL-record voor de hele toewijzing en wordt overgeslagen (MPXJ's
 * `offset = 36`). Elk van de overige N records:
 *   offset  0: cumulatief werk aan periode-eind, DOUBLE, in 1000sten van een minuut
 *   offset  8: werk per uur deze periode, DOUBLE, in 10000sten van een uur (NIET gebruikt)
 *   offset 16: verstreken WERKMINUTEN aan periode-eind, INT, in 80sten van een minuut, CUMULATIEF
 *              vanaf een impliciet "periode 0"-ankerpunt
 * VÓÓR de lus leest MPXJ één keer `finishTime = getInt(regularData, 24)` (absolute offset 24, binnen
 * het totaal-record) als sanity-plafond: is de RUWE (nog niet door 80 gedeelde) elapsed-waarde `< 0`
 * of `> finishTime`, dan wordt hij 0.
 * Werkafronding (letterlijk uit `getCompleteWork`): de cumulatieve-werk-DOUBLE wordt eerst met een
 * `(long)`-cast getrunceerd (`Math.trunc`) vóór het verschil met de vorige periode; dat verschil
 * wordt gedeeld door 1000 en afgerond op de SECONDE (`roundMinutesToSeconds`). Zonder die stappen
 * wordt een gat (`workMinutes === 0`, exacte vergelijking) door een residu als 1e-13 gemist.
 *
 * ── Byteformaat B — PLANNED/REMAINING (`getPlannedWork`, categorie 49) ────────────────────────────
 *
 * 16-byte header (eerste 2 bytes = blockCount N, RUW). GEEN "N+1"-conventie: N=0 is een SPECIAAL
 * geval (één samenvattend record); N≥1 betekent een summary-blok van 28 bytes (overgeslagen) + N
 * periodeblokken van 28 bytes. Elk periodeblok:
 *   offset  0: cumulatief werk aan periode-eind, DOUBLE, in 1000sten van een minuut (GEEN
 *              `(long)`-truncatie — `getPlannedWork` mist die stap, en deze decoder poort dat letterlijk)
 *   offset  8: uren per dag, DOUBLE, in 20000sten van een uur — NIET gebruikt (MPXJ: "unreliable
 *              value, not used")
 *   offset 16: onbekend (DOUBLE) — NIET gebruikt (MPXJ: "unknown")
 *   offset 24: cumulatief verstreken WERKMINUTEN aan periode-eind, INT, in 80sten van een minuut
 *              (LET OP: offset 24, niet 16 zoals Format A; geen finishTime-guard)
 * `blockCount === 0`: één samenvattend record voor de HELE toewijzing, uit het summary-blok zelf
 * (`getDouble(data, 16) / 1000`, het totale werk). MPXJ ankert dit op `assignment.getStart()`/
 * `getResume()` én `getFinish()`; deze pure decoder ondersteunt het daarom ALLEEN als de aanroeper
 * `referenceFinish` meegeeft, anders een lege lijst.
 *
 * ── AFWIJKING VAN MPXJ (bewust) ──────────────────────────────────────────────────────────────────
 *
 * MPXJ weeft irregulier- en regulier-blok samen (kalenderbewust `splitItem`) en zet periodegrenzen om
 * in echte kalenderinstants (`ProjectCalendar.getDate`/`getNextWorkStart`): de "verstreken
 * WERKMINUTEN" zijn werktijd, geen 24/7-klok. Die kalenderwandeling bestaat hier niet, dus elke
 * decoder levert de WERKMINUUT-OFFSETS als PRIMAIR resultaat (`elapsedWorkMinutesStart`/`End`).
 * `approxStart`/`approxFinish` zijn een 24/7-KLOKMINUTEN-PROJECTIE vanaf `referenceStart` — een
 * BENADERING, NOOIT te gebruiken voor datum-/planningsbeslissingen. Irregulier/regulier worden niet
 * samengeweven: `decodeIrregularTimephasedWork` levert de irreguliere periodes rechtstreeks uit hun
 * eigen absolute MPP-timestamps als apart type. Dat blok heeft geen los amount-veld (MPXJ gebruikt
 * het alleen om een regulier record te corrigeren); deze decoder rekent het hele tijdvak als werk,
 * een OPS-eigen keuze.
 *
 * ── Splitsegmenten afleiden ──────────────────────────────────────────────────────────────────────
 *
 * Gat-eenheid gemeten op `mpxj/junit/data/mpp14splittask.mpp`: MSP's opgeslagen `FINISH` volgt exact
 * uit `addWorkMinutes(start, duur + gat)` wanneer het gat in WERKMINUTEN telt:
 *   - "Split Task 1": start 2006-09-21T08:00, duur 4800 min, gat {afterMinutes: 1920,
 *     gapMinutes: 1440} (3 werkdagen) ⇒ precies de opgeslagen finish 2006-10-09T17:00.
 *   - "Split Task 2": duur 7200 min, gaten {1440, 960} en {4800, 1440} ⇒ precies 2006-10-18T17:00.
 *   - Het gat als 24/7-kloktijd optellen gaf 4 resp. 2 dagen te vroeg — weerlegd.
 * Beide taken staan op 0%: of een voltooid segment blijft staan terwijl restwerk schuift, is hier
 * niet gemeten.
 *
 * ALGORITME (`deriveSplitGapsFromPeriods`, poort van `ResourceAssignment.getWorkSplits()`): filter
 * periodes met `workMinutes === 0` weg (die zijn het gat), sorteer de rest op
 * `elapsedWorkMinutesStart` en vergelijk opeenvolgende paren: een STRIKTE discontinuïteit
 * (`volgende.start > vorige.end`) is een gat van dat verschil op offset `vorige.end`. Zo worden N
 * opeenvolgende nul-werk-records vanzelf één gat, en voorkomt de strikte `>` een fantoomgat van 0
 * minuten op de naad tussen twee aansluitende werksegmenten (mutatiebewijzen in
 * `check-mpp-import.ts`).
 *
 * SCOPE: alleen `actualRegularWork` + `remainingRegularWork` voeden de gat-afleiding. Niet
 * `actualOvertimeWork` (parallel aan reguliere uren; geen corpusdata om de interactie te
 * verifiëren) en niet `actualIrregularWork` (absolute instants, geen werkminuut-offset).
 *
 * AGGREGATIE (`deriveTaskSplitGaps`): DOORSNEDE van de gat-intervallen over alle toewijzingen van
 * een taak. MPXJ's `Task.calculateWorkSplits` neemt de VERENIGING van de werkbereiken
 * (`reduceWorkSplits`); met De Morgan is dat dezelfde uitkomst. MPXJ werkt op kalenderinstants,
 * deze module op werkminuten — equivalent zolang alle toewijzingen op dezelfde taak-as staan (zie
 * hieronder). Een toewijzing ZONDER timephased-data wordt uitgesloten, niet als "altijd stil" geteld.
 *
 * SAMENVATTINGSTAKEN: `Task.calculateWorkSplits` begint met `if (getSummary()) return
 * Collections.emptyList();` ("In MS Project, summary tasks do not show splits"); `mppReader.ts`
 * filtert ze daarom vóór het zetten van `Task.splitGaps`.
 *
 * TAAK-AS, NIET TOEWIJZINGS-AS (`TimephasedDataFactory.java`):
 *   - `getCompleteWork` (actual) start op `resourceAssignment.getStart()`, de eigen start van de
 *     toewijzing — niet de taakstart.
 *   - `getPlannedWork` (remaining): `timephasedComplete.isEmpty() ? assignment.getStart() :
 *     assignment.getResume()`. Beide tracks hebben elk een EIGEN nulpunt; simpelweg concateneren zet
 *     ze niet op één as.
 *   `mppReader.ts` (de koppellaag) leest daarom `AssignmentField.START`/`RESUME` en verschuift de
 *   periodes (`shiftPeriods`, puur) met de werkminuten-afstand taakstart→anker via
 *   `CalendarEngine.workMinutesBetween` — alleen in uur-modus, want die primitief gooit op een
 *   dag-modus-kalender (dag-modus: shift 0). Ontbreekt RESUME (geen MPXJ-default), dan valt de
 *   koppellaag terug op het einde van de verschoven actual-track.
 *
 * ONGEDEELD SAMENVATTINGSRECORD TOONT GEEN GAT: Format B's `blockCount === 0` claimt het volledige
 * restvenster als werk. Met `referenceFinish` zou zo'n record een gat overbruggen dat in het
 * gedetailleerde pad zichtbaar was, met een KLOKminuten-lengte op de WERKminuten-as. De
 * splits-koppelcode geeft daarom GEEN `referenceFinish` mee; de venster-/werkberekening mag dat wel.
 *
 * Een taak ZONDER resource draagt tóch een `TBkndAssn`-record met timephased-data
 * (`resourceUid === -65535`, `ASSIGNMENT_NULL_RESOURCE_ID`); `readAssignments` sluit die uit van
 * `ResourceAssignment[]`, dus de uid→taak-brug in `mppReader.ts` loopt via `taskId`.
 */
import type { TaskSplitGap } from '@/types/task';
import { gapsBetweenWorkedSpans, intersectAssignmentGaps } from '@/services/contourIo';
import { getShort, getInt, getDouble, getTimestamp } from './mppPrimitives';
import {
  clampTimephasedRegularRecordCount, clampTimephasedIrregularRecordCount, clampTimephasedPlannedRecordCount,
} from './limits';

/** Eén werkperiode uit een WERKMINUUT-gebaseerd timephased-blok (Format A of B — zie moduleheader).
 *  `elapsedWorkMinutesStart`/`End` zijn het PRIMAIRE, betrouwbare resultaat (cumulatieve
 *  werkminuten sinds het venster begon — GEEN kalenderklok). `approxStart`/`approxFinish` zijn een
 *  24/7-KLOKMINUTEN-PROJECTIE vanaf `referenceStart`, uitdrukkelijk een BENADERING — NOOIT gebruiken
 *  voor datum-/planningsbeslissingen. */
export interface TimephasedWorkPeriod {
  /** Cumulatieve werkminuten sinds `referenceStart` tot het BEGIN van deze periode. */
  elapsedWorkMinutesStart: number;
  /** Cumulatieve werkminuten sinds `referenceStart` tot het EIND van deze periode. Altijd
   *  `> elapsedWorkMinutesStart` (zie de "geen ontaarde periodes"-filter in de decoders). */
  elapsedWorkMinutesEnd: number;
  /** Werk in deze periode, in MINUTEN — kan 0 zijn (een periode zonder werk, maar mét verstreken
   *  werkminuten: dat IS een splitsgat). Nooit gefilterd op nul. */
  workMinutes: number;
  /** BENADERING, zie het moduleheader — 24/7-klokminuten-projectie, geen kalenderwandeling. */
  approxStart: Date;
  /** BENADERING, zie het moduleheader. */
  approxFinish: Date;
}

/** Eén periode uit het IRREGULIERE blok — ECHTE absolute MPP-instants (geen projectie, de bytes
 *  dragen zelf al datum+tijd), dus GEEN aparte "approx"-onderscheiding nodig. Zie moduleheader
 *  voor waarom `workMinutes` hier de volledige tijdspanne is (OPS-eigen keuze, geen MPXJ-poort). */
export interface TimephasedIrregularPeriod {
  start: Date;
  finish: Date;
  workMinutes: number;
}

const REGULAR_HEADER_SIZE = 16;
const REGULAR_RECORD_SIZE = 20;
const PLANNED_HEADER_SIZE = 16;
const PLANNED_BLOCK_SIZE = 28;
const IRREGULAR_HEADER_SIZE = 16;
const IRREGULAR_RECORD_SIZE = 8;

/** `referenceStart + minutes` in 24/7 KLOKminuten — een BENADERING (`approxStart`/`approxFinish`),
 *  geen kalenderwandeling. Bewust een lokale helper i.p.v. een engine-import: deze module heeft
 *  geen engine-afhankelijkheid. */
function addClockMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

/** MPXJ's `roundMinutesToSeconds` (`TimephasedDataFactory.java`) — rondt af op de dichtstbijzijnde
 *  1/60 minuut (seconde), zodat een drijvendekomma-residu de `workMinutes === 0`-gatdetectie niet
 *  laat missen. */
function roundMinutesToSeconds(minutes: number): number {
  return Math.round(minutes * 60) / 60;
}

/**
 * Decodeert een REGULIER timephased-blok (Format A — `ActualRegularWork`/`ActualOvertimeWork`).
 * `referenceStart` is alleen het ankerpunt voor de `approxStart`/`approxFinish`-BENADERING.
 *
 * `data === null` (categorie niet aanwezig) of te kort voor het totaal-record ⇒ lege lijst, geen
 * exceptie.
 */
export function decodeRegularTimephasedWork(data: Uint8Array | null, referenceStart: Date, ctx = 'timephased regular'): TimephasedWorkPeriod[] {
  if (!data || data.length < REGULAR_HEADER_SIZE + REGULAR_RECORD_SIZE) return [];

  const headerCount = getShort(data, 0, ctx);
  // De header-recordcount is een ongevalideerde bestandswaarde: eerst structureel geklemd op wat de
  // bloklengte kan dragen, daarna op `MAX_TIMEPHASED_REGULAR_RECORDS` (limits.ts). Geen allocatie
  // wordt ooit met de RUWE `headerCount` gedimensioneerd.
  const structuralMax = Math.max(0, Math.floor((data.length - REGULAR_HEADER_SIZE - REGULAR_RECORD_SIZE) / REGULAR_RECORD_SIZE));
  const count = clampTimephasedRegularRecordCount(Math.min(Math.max(0, headerCount), structuralMax));

  // finishTime-sanity-plafond, één keer gelezen (MPXJ's `getInt(regularData, 24)`, binnen het
  // totaal-record). `data.length` is hier al ≥ 36.
  const finishTime = getInt(data, 24, ctx);

  const result: TimephasedWorkPeriod[] = [];
  let prevRawCumulativeWork = 0; // RUW (1000sten van een minuut), getrunceerd
  let prevCumulativeElapsedMinutes = 0;
  for (let i = 0; i < count; i++) {
    // +REGULAR_RECORD_SIZE: het EERSTE fysieke record (bytes 16..36) is het totaal-record en wordt
    // overgeslagen — periode-index 0 hieronder leest dus al het TWEEDE fysieke record.
    const offset = REGULAR_HEADER_SIZE + REGULAR_RECORD_SIZE + i * REGULAR_RECORD_SIZE;

    // `(long)`-truncatie VÓÓR het verschil (MPXJ: "(long) MPPUtility.getDouble(...)").
    const rawCumulativeWork = Math.trunc(getDouble(data, offset, ctx));

    // De RUWE (nog niet door 80 gedeelde) waarde eerst tegen `finishTime` toetsen.
    const rawElapsed = getInt(data, offset + 16, ctx);
    const cumulativeElapsedMinutes = (rawElapsed < 0 || rawElapsed > finishTime) ? 0 : rawElapsed / 80;

    const periodElapsedMinutes = cumulativeElapsedMinutes - prevCumulativeElapsedMinutes;
    // Geen ontaarde (nul-lengte) periodes — spiegelt MPXJ's `removeEmptyItems`. Een periode ZONDER
    // werk maar MET verstreken werkminuten blijft wél staan (dat is een splitsgat).
    if (periodElapsedMinutes > 0) {
      result.push({
        elapsedWorkMinutesStart: prevCumulativeElapsedMinutes,
        elapsedWorkMinutesEnd: cumulativeElapsedMinutes,
        workMinutes: roundMinutesToSeconds((rawCumulativeWork - prevRawCumulativeWork) / 1000),
        approxStart: addClockMinutes(referenceStart, prevCumulativeElapsedMinutes),
        approxFinish: addClockMinutes(referenceStart, cumulativeElapsedMinutes),
      });
    }
    prevRawCumulativeWork = rawCumulativeWork;
    prevCumulativeElapsedMinutes = cumulativeElapsedMinutes;
  }
  return result;
}

/**
 * Decodeert een PLANNED/REMAINING timephased-blok (Format B — `RemainingRegularWork`): 28-byte
 * records, elapsed op offset 24, geen finishTime-guard, geen `(long)`-truncatie — poort van MPXJ's
 * `getPlannedWork`, NIET `getCompleteWork`.
 *
 * `referenceFinish` (optioneel): alleen nodig voor het `blockCount === 0`-geval; zonder levert dat
 * geval een lege lijst.
 */
export function decodePlannedRegularTimephasedWork(
  data: Uint8Array | null,
  referenceStart: Date,
  referenceFinish?: Date,
  ctx = 'timephased planned',
): TimephasedWorkPeriod[] {
  if (!data || data.length < PLANNED_HEADER_SIZE + 8) return []; // te kort voor zelfs het cumulatieve-werkveld van het summary-blok

  const blockCount = getShort(data, 0, ctx);

  if (blockCount === 0) {
    if (!referenceFinish) return []; // geen tweede ankerpunt beschikbaar — zie moduleheader
    const totalWorkMinutes = getDouble(data, 16, ctx) / 1000;
    if (totalWorkMinutes === 0) return []; // MPXJ: "If the total work for the block is zero it's not valid"
    return [{
      elapsedWorkMinutesStart: 0,
      elapsedWorkMinutesEnd: Math.max(0, (referenceFinish.getTime() - referenceStart.getTime()) / 60_000),
      workMinutes: totalWorkMinutes,
      approxStart: referenceStart,
      approxFinish: referenceFinish,
    }];
  }

  // Zelfde tweetraps-klem als de reguliere decoder, met een eigen constante
  // (`MAX_TIMEPHASED_PLANNED_RECORDS`, limits.ts) vanwege de andere recordgrootte (28 i.p.v. 20).
  const structuralMax = Math.max(0, Math.floor((data.length - PLANNED_HEADER_SIZE - PLANNED_BLOCK_SIZE) / PLANNED_BLOCK_SIZE));
  const count = clampTimephasedPlannedRecordCount(Math.min(Math.max(0, blockCount), structuralMax));

  const result: TimephasedWorkPeriod[] = [];
  let prevCumulativeWorkMinutes = 0; // GEEN `(long)`-truncatie hier — `getPlannedWork` mist die stap (moduleheader)
  let prevCumulativeElapsedMinutes = 0;
  for (let i = 0; i < count; i++) {
    // +PLANNED_BLOCK_SIZE: het EERSTE fysieke blok (bytes 16..44) is het summary-blok en wordt
    // overgeslagen (spiegelt MPXJ's `offset = 16 + 28`).
    const offset = PLANNED_HEADER_SIZE + PLANNED_BLOCK_SIZE + i * PLANNED_BLOCK_SIZE;
    const cumulativeWorkMinutes = getDouble(data, offset, ctx) / 1000;
    // LET OP: offset 24, NIET 16 — andere recordlay-out dan Format A (zie moduleheader).
    const cumulativeElapsedMinutes = getInt(data, offset + 24, ctx) / 80;

    const periodElapsedMinutes = cumulativeElapsedMinutes - prevCumulativeElapsedMinutes;
    if (periodElapsedMinutes > 0) {
      result.push({
        elapsedWorkMinutesStart: prevCumulativeElapsedMinutes,
        elapsedWorkMinutesEnd: cumulativeElapsedMinutes,
        workMinutes: cumulativeWorkMinutes - prevCumulativeWorkMinutes,
        approxStart: addClockMinutes(referenceStart, prevCumulativeElapsedMinutes),
        approxFinish: addClockMinutes(referenceStart, cumulativeElapsedMinutes),
      });
    }
    prevCumulativeWorkMinutes = cumulativeWorkMinutes;
    prevCumulativeElapsedMinutes = cumulativeElapsedMinutes;
  }
  return result;
}

/**
 * Decodeert een IRREGULIER timephased-blok (zie moduleheader). Geen referentiepunt nodig — de
 * twee 4-byte velden per record zijn al absolute MPP-timestamps.
 */
export function decodeIrregularTimephasedWork(data: Uint8Array | null, ctx = 'timephased irregular'): TimephasedIrregularPeriod[] {
  if (!data || data.length < IRREGULAR_HEADER_SIZE) return [];

  const headerCount = getShort(data, 0, ctx);
  // Zelfde tweetraps-klem-discipline als hierboven, eigen constante (limits.ts) omdat dit blok een
  // andere recordgrootte/verwachte-dichtheid heeft.
  const structuralMax = Math.max(0, Math.floor((data.length - IRREGULAR_HEADER_SIZE) / IRREGULAR_RECORD_SIZE));
  const count = clampTimephasedIrregularRecordCount(Math.min(Math.max(0, headerCount), structuralMax));

  const result: TimephasedIrregularPeriod[] = [];
  for (let i = 0; i < count; i++) {
    const offset = IRREGULAR_HEADER_SIZE + i * IRREGULAR_RECORD_SIZE;
    const start = getTimestamp(data, offset, ctx);
    const finish = getTimestamp(data, offset + 4, ctx);
    // getTimestamp geeft null terug voor MPP se eigen "N/A"-heuristieken (mppPrimitives.ts) — een
    // NA-timestamp of een ontaarde/omgekeerde periode wordt overgeslagen, geen crash.
    if (!start || !finish || finish.getTime() <= start.getTime()) continue;
    result.push({ start, finish, workMinutes: (finish.getTime() - start.getTime()) / 60_000 });
  }
  return result;
}

/** Vier ruwe timephased-byte-blokken voor ÉÉN toewijzing, gevuld door `mppEntities.ts`'s
 *  `readAssignmentTimephasedRaw`. `null` per veld = die categorie is legitiem afwezig (normaal voor
 *  een toewijzing zonder contouring/restwerk). `remainingRegularWork` decodeert via
 *  `decodePlannedRegularTimephasedWork` (Format B); de overige drie via
 *  `decodeRegularTimephasedWork`/`decodeIrregularTimephasedWork`. */
export interface AssignmentTimephasedRaw {
  actualRegularWork: Uint8Array | null;
  remainingRegularWork: Uint8Array | null;
  actualOvertimeWork: Uint8Array | null;
  actualIrregularWork: Uint8Array | null;
}

/** `true` zodra minstens één van de vier categorieën data draagt — een goedkope eerste vraag vóór de
 *  byte-decodering. */
export function hasAnyTimephasedData(raw: AssignmentTimephasedRaw): boolean {
  return raw.actualRegularWork !== null || raw.remainingRegularWork !== null
    || raw.actualOvertimeWork !== null || raw.actualIrregularWork !== null;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Splitsegmenten afleiden (zie de moduleheader voor meting, algoritme en aggregatieregel).
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Verschuift een periodelijst met een constant aantal WERKminuten naar de taak-as (zie de
 * moduleheader). Verschuift alleen `elapsedWorkMinutesStart`/`End`; `workMinutes` en de
 * `approx*`-benaderingen blijven ongewijzigd. `shiftMinutes === 0` ⇒ dezelfde array-referentie.
 */
export function shiftPeriods(periods: readonly TimephasedWorkPeriod[], shiftMinutes: number): readonly TimephasedWorkPeriod[] {
  if (shiftMinutes === 0) return periods;
  return periods.map((p) => ({
    ...p,
    elapsedWorkMinutesStart: p.elapsedWorkMinutesStart + shiftMinutes,
    elapsedWorkMinutesEnd: p.elapsedWorkMinutesEnd + shiftMinutes,
  }));
}

/**
 * Leidt de `TaskSplitGap[]` van ÉÉN toewijzing af uit haar WERKminuten-periodes (typisch actual +
 * remaining van die toewijzing). Puur. Algoritme: zie de moduleheader. `periods` hoeft niet vooraf
 * gesorteerd te zijn.
 *
 * AS-CONTRACT: `afterMinutes`/`gapMinutes` staan op de CUMULATIEVE as van `elapsedWorkMinutes*` —
 * een gat telt zelf mee in de positie van een volgend gat, dus bij ≥2 gaten is `afterMinutes` geen
 * "zuivere werktijd sinds taakstart". Consumenten (`duration.ts`'s `splitTotalSpanMinutes`) moeten
 * deze as WANDELEN i.p.v. tegen een vast `[0, duur)`-venster te klemmen (anders wordt bv.
 * `mpp14timephased.mpp`'s "Task 5 - 24 Hour", `{afterMinutes:1440, gapMinutes:5760}`, afgekapt).
 */
export function deriveSplitGapsFromPeriods(periods: readonly TimephasedWorkPeriod[]): TaskSplitGap[] {
  // NUL-WERK-DETECTIE: alleen periodes MET werk blijven over (zie `gapsBetweenWorkedSpans`).
  return gapsBetweenWorkedSpans(periods
    .filter((p) => p.workMinutes !== 0)
    .map((p) => ({ start: p.elapsedWorkMinutesStart, end: p.elapsedWorkMinutesEnd })));
}

/**
 * Taakniveau-aggregatie over de toewijzingen van DEZELFDE taak: DOORSNEDE van de per-toewijzing
 * gat-intervallen (een split verschijnt alleen waar ALLE toewijzingen tegelijk stilliggen).
 *
 * `gapsByAssignment`: één `TaskSplitGap[]` per toewijzing die timephased-data droeg. Een LEGE lijst
 * betekent "wel data, nul gaten" en maakt de doorsnede terecht leeg.
 */
export const deriveTaskSplitGaps = intersectAssignmentGaps;
