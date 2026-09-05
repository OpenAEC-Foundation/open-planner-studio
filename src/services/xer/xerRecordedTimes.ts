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
}

/** Uren (kan fractioneel zijn) → dagen, via `minutesPerDay` van de taak-effectieve kalender. Zelfde
 *  omrekening als `floatMinutesPerDay` in `tests/planning/check-xer-product-fidelity-x12.ts` /
 *  `xerTaskReplayProduct.ts`, in omgekeerde richting van `parseFloatMinutes`
 *  (`tests/planning/xerGroundTruth.ts`). Geen betrouwbare dagconversie zonder een positieve
 *  `minutesPerDay` (hardening: geen deling door 0/negatief uit een ongevalideerde kalenderwaarde)
 *  ⇒ as ontbreekt. */
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
 * `src/services/xer/` waar deze zes kolomnamen als letterlijke string voorkomen. Een grep op de
 * zes namen binnen die map mag na dit bestand nergens anders meer treffen.
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
 * `isCritical` is een AFLEIDING, geen gelezen kolom: `totalFloat <= 0` zodra die vastgelegd is.
 * `driving_path_flag` blijft bak 2 (verboden terrein voor de lezer) — promotie tot eigen kolom is
 * een latere, aparte afweging (plan §3). Zonder vastgelegde float blijft `isCritical` `undefined`.
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
    const totalFloat = hoursToDays(ctx.numberOf(row, 'total_float_hr_cnt'), minutesPerDay);
    const freeFloat = hoursToDays(ctx.numberOf(row, 'free_float_hr_cnt'), minutesPerDay);
    const isCritical = totalFloat === undefined ? undefined : totalFloat <= 0;

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
