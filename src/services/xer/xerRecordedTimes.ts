import type { RecordedTime } from '@/engine/scheduler/recordedDates';
import type { XerRow } from './xerTables';
import { sourceInstant } from './xerInstant';

/**
 * BAK 4 (XER-etappeplan §4.1, bijgesteld 2026-09-04 — eigenaarsbesluit X-O7 laag 3): "uitsluitend
 * weergave/meetlat, nooit solverinvoer". Deze context abstraheert de bron-toegang die de aanroeper
 * (`readXerProject` in `xerReader.ts`) al opbouwde — géén tweede kalender-/getalimplementatie hier.
 */
export interface XerRecordedTimesCtx {
  /** Dezelfde tabel-genormaliseerde getalparser als de rest van de lezer voor de TASK-tabel. */
  numberOf: (row: XerRow, field: string) => number | null;
  /** De taak-EFFECTIEVE kalender (na `clndr_id`-terugval én uurmodus-promotie). */
  effectiveCalendarOf: (row: XerRow) => { id: string; hourMode: boolean; minutesPerDay: number };
  /** Dezelfde id-vorming als de taakmapper (in de praktijk: de rauwe `task_id`-cel). */
  taskIdOf: (row: XerRow) => string;
  /** De kritiekdefinitie die de lezer óók aan de solver geeft (`deriveXerScheduleOptions`:
   *  `critical_path_type` + `critical_drtn_hr_cnt`). Her-check laag 3, bevinding 7: `isCritical`
   *  werd afgeleid als `totalFloat <= 0`, terwijl dezelfde lezer een drempel > 0 of longest-path
   *  aan de solver gaf — in de modus kleurde dan een andere set balken kritiek dan erbuiten.
   *  Ontbreekt (oude aanroepers/tests) ⇒ de P6-default: totale speling, drempel 0. */
  criticalDefinition?: { mode: 'totalFloat' | 'longestPath'; thresholdHours?: number };
}

/** Uren (kan fractioneel zijn) → dagen, via `minutesPerDay` van de taak-effectieve kalender. Zelfde
 *  omrekening als `floatMinutesPerDay` in `tests/planning/check-xer-product-fidelity-x12.ts` /
 *  `xerTaskReplayProduct.ts`, in omgekeerde richting van `parseFloatMinutes`
 *  (`tests/planning/xerGroundTruth.ts`). Geen betrouwbare dagconversie zonder een positieve
 *  `minutesPerDay` (hardening: geen deling door 0/negatief uit een ongevalideerde kalenderwaarde)
 *  ⇒ as ontbreekt. */
/** `isCritical` als AFLEIDING van de vastgelegde totale speling, met dezelfde definitie als de
 *  solver krijgt: totale speling ≤ drempel (P6's `critical_drtn_hr_cnt`, default 0). Longest-path-
 *  kritiek is uit een float niet af te leiden (P6 markeert daar de langste keten, ongeacht speling)
 *  ⇒ `undefined`: "niet vastgelegd", nooit een gok. Vergelijking in UREN, zodat een drempel uit het
 *  bestand niet eerst door de taakkalender hoeft. */
function recordedIsCritical(
  totalFloatHours: number | null,
  definition: XerRecordedTimesCtx['criticalDefinition'],
): boolean | undefined {
  if (totalFloatHours === null) return undefined;
  if (definition?.mode === 'longestPath') return undefined;
  return totalFloatHours <= (definition?.thresholdHours ?? 0);
}

function hoursToDays(hours: number | null, minutesPerDay: number): number | undefined {
  if (hours === null || !(minutesPerDay > 0)) return undefined;
  const minutes = Math.round(hours * 60);
  return minutes / minutesPerDay;
}

/**
 * Lees UITSLUITEND de zes P6-rekenuitvoerkolommen die de bron zelf opsloeg — `early_start_date`,
 * `early_end_date`, `late_start_date`, `late_end_date`, `total_float_hr_cnt`, `free_float_hr_cnt`
 * — uit de TASK-rijen van één project. Nooit solverinvoer, nooit geschreven naar `Task.time` door
 * een lezer: het resultaat gaat uitsluitend naar `ImportResult.recordedTimes`
 * (`src/services/importTypes.ts`) plus `recordedTimesOrigin: 'xer'`, en wordt door
 * `captureRecordedDates` (`src/engine/scheduler/recordedDates.ts`) met voorrang gebruikt boven de
 * IFC-`recordedFields`-route — nooit gemengd met die route.
 *
 * ISOLATIE (mutatiebewijs (a), `check-xer-field-whitelist.ts`): dit is de ENIGE plek in
 * `src/services/xer/` waar deze zes kolomnamen als LEESPAD voorkomen. Eén bewuste nuance, die de
 * testscan ook kent: `xerTables.ts` noemt `total_float_hr_cnt`/`free_float_hr_cnt` in
 * `XER_DECIMAL_FIELDS` — dat is de getalnormalisatie van de tokenizer (bak-onafhankelijk), geen
 * lezer van de waarde. Elke andere treffer binnen de map is een sluiproute.
 *
 * LAAGKEUZE — bewust GEEN terugval (X-O7 laag 3, §4.1-bijstelling): alleen `early_start_date` ÉN
 * `early_end_date` bepalen of een taak een uitspraak krijgt. Ontbreekt of is één van beide
 * onparseerbaar, dan wordt de taak VOLLEDIG overgeslagen — geen samengesteld paar uit
 * verschillende assen, en geen terugval op `target_start_date`/`target_end_date`: die twee zijn
 * XER-WHITELIST-INVOER (bak 1), geen P6-uitvoer, en zouden hier een verkeerde bewering doen over
 * "wat P6 zelf berekende". `late_start_date`/`late_end_date`/`total_float_hr_cnt`/
 * `free_float_hr_cnt` staan LOS van die keuze: elk wordt individueel meegenomen zodra zijn eigen
 * cel aanwezig én parseerbaar is. Ontbreekt zo'n cel, dan blijft het veld `undefined` — "niet
 * vastgelegd" — nooit een verzonnen 0 en nooit gelijkgesteld aan de vroege kant.
 *
 * BEWUST GEEN ORDETOETS op `early_end_date < early_start_date` (her-check laag 3, bevinding 6 —
 * gemeten en verworpen, 2026-09-07): dat is P6's EIGEN conventie voor voltooide activiteiten, geen
 * scheve bron. Corpusmeting over 25 orakelbestanden: 2.049 van 11.953 taken met early-paar hebben
 * einde vóór start, 2.036 daarvan `TK_Complete` (rehab-2: 2.042 van 6.976) — P6 zet `early_start`
 * van een voltooide activiteit op de statusdatum en `early_end` op het werkelijke einde, precies wat
 * de X12-fixture "Completed fidelity" en de statusdatumroute van de solver (laag 1) nabouwen. Een
 * guard zou dus 29% van rehab-2's vastlegging weggooien en de modus laten liegen. Die voltooid-
 * conventie dekt 97,4% van de inversies; de rest (54 van 2.090 corpusbreed: 50 `TK_NotStart`,
 * 4 `TK_Active`, o.a. zes in rehab-2 zelf) zijn nul-duur-/mijlpaalrijen en scheve bronbestanden.
 * Ook die tonen we zoals ze zijn: "nooit verzinnen" betekent hier "nooit corrigeren". Wat het
 * bestand zegt, wordt getoond; de renderer ziet die inversie buiten de modus al even vaak.
 *
 * `isCritical` is een AFLEIDING, geen gelezen kolom: totale speling ≤ de kritiekdrempel uit
 * `ctx.criticalDefinition` (default 0) zodra die speling vastgelegd is; onder longest-path-kritiek
 * blijft hij `undefined` (zie `recordedIsCritical`). `driving_path_flag` blijft bak 2 (verboden
 * terrein voor de lezer) — promotie tot eigen kolom is een latere, aparte afweging (plan §3).
 * Zonder vastgelegde float blijft `isCritical` `undefined`.
 */
export function readXerRecordedTimes(
  activityRows: readonly XerRow[],
  ctx: XerRecordedTimesCtx,
): Record<string, RecordedTime> {
  const times: Record<string, RecordedTime> = {};

  for (const row of activityRows) {
    const { hourMode, minutesPerDay } = ctx.effectiveCalendarOf(row);

    const start = sourceInstant(row.cells.early_start_date ?? '', hourMode);
    const finish = sourceInstant(row.cells.early_end_date ?? '', hourMode);
    if (start === undefined || finish === undefined) continue; // geen uitspraak — MOET geen terugval

    const lateStart = sourceInstant(row.cells.late_start_date ?? '', hourMode);
    const lateFinish = sourceInstant(row.cells.late_end_date ?? '', hourMode);
    const totalFloatHours = ctx.numberOf(row, 'total_float_hr_cnt');
    const totalFloat = hoursToDays(totalFloatHours, minutesPerDay);
    const freeFloat = hoursToDays(ctx.numberOf(row, 'free_float_hr_cnt'), minutesPerDay);
    // Her-check R3: zonder vastgelegde (omrekenbare) speling géén kritiekoordeel — ook wanneer de
    // `minutesPerDay`-hardening de as liet vallen; anders zegt de tabel "niet vastgelegd" waar CSV/MCP
    // een harde `false` naar buiten dragen.
    const isCritical = totalFloat === undefined ? undefined : recordedIsCritical(totalFloatHours, ctx.criticalDefinition);

    times[ctx.taskIdOf(row)] = {
      start,
      finish,
      ...(lateStart !== undefined ? { lateStart } : {}),
      ...(lateFinish !== undefined ? { lateFinish } : {}),
      ...(totalFloat !== undefined ? { totalFloat } : {}),
      ...(freeFloat !== undefined ? { freeFloat } : {}),
      ...(isCritical !== undefined ? { isCritical } : {}),
    };
  }

  return times;
}
