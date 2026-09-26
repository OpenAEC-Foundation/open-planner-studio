/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Gedeelde hardingsklemmen als BLADMODULE: importeert bewust NIETS uit `mppReader.ts`/
 * `mppCalendars.ts`, anders ontstaat een importcyclus (`verify:cycles`).
 */

/**
 * Begrenst het scan-/decodeerwerk van `getUnicodeString` (taaknamen, WBS-tekst, kalender- en
 * uitzonderingsnamen): meerdere unique-ID's kunnen naar DEZELFDE grote, gededupliceerde var-data-string
 * wijzen, dus zonder bovengrens kost uitlezen O(werkelijke lengte) PER verwijzing. 64 KiB is ruim
 * boven elke realistische naam (het corpus blijft onder 1 KB), maar begrenst een geprepareerd bestand
 * hard.
 */
export const MAX_VAR_TEXT_BYTES = 65_536;

/**
 * Structurele klem op het aantal werktijd-BANDEN binnen ÉÉN 92-byte kalender-uitzonderingsblok
 * (`AbstractCalendarAndExceptionFactory.processCalendarExceptions`, `readExceptionBands` in
 * `mppCalendars.ts`). Start-slot `i` staat op `20+2i` en botst vanaf `i>=6` met duur-slot 0 (`+32`),
 * dus passen er structureel hoogstens 6 niet-overlappende periodes; daarboven leest een periode
 * een "fantoomband" uit duur-/naambytes. MS Project's UI staat hooguit 5 periodes per uitzondering
 * toe (net als bij `MAX_DAY_HOUR_PERIODS` voor het 60-byte-dagblok), dus 5 is zowel de structurele
 * als de productgrens. Ongeklemd zou `periodCount` (SHORT) tot 65535 iteraties per uitzondering
 * forceren.
 */
export const MAX_EXCEPTION_BAND_PERIODS = 5;

/**
 * Klem op de RAUWE `REMAINING_DURATION` (fixed-offset 52, INT32, tienden van een minuut), vóór hij
 * naar `time.remainingMinutes`/`time.remainingTime` wordt omgerekend en in datumrekenkunde
 * (`CalendarEngine`, `duration.ts`) belandt.
 *
 * INT32 is structureel al begrensd (≈ ±408 jaar) en de dieper liggende klemmen (`CalendarEngine`'s
 * `MAX_DAYS`/`MAX_MINUTES`, `duration.ts`'s `MAX_ELAPSED_MINUTES`) vangen het altijd, maar een uit het
 * bestand gelezen getal krijgt een EIGEN, gedocumenteerde bovengrens. 100 jaar
 * (`100 × 365,25 × 24 × 60 × 10 ≈ 525.960.000` tienden) ligt ruim boven elke realistische restduur.
 *
 * Let op: `durationRaw` (SCHEDULED_DURATION) in `mppReader.ts` heeft geen eigen klem en leunt alleen
 * op de dieper liggende klemmen.
 */
export const MAX_REMAINING_DURATION_TENTHS = 525_960_000;

/** Klemt een rauwe `REMAINING_DURATION`-waarde (mogelijk negatief bij een kapot bestand) naar
 *  `[0, MAX_REMAINING_DURATION_TENTHS]`. Een negatieve restduur is nooit zinvol (spiegelt de
 *  `Math.max(0, …)`-klem op `remaining` in `CPMSolver.ts`). */
export function clampRemainingDurationTenths(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, 0), MAX_REMAINING_DURATION_TENTHS);
}

/**
 * Klem op de RAUWE `MANUAL_DURATION` (Fixed2Data blok 1, offset 58, INT32, tienden van een minuut,
 * `TaskFieldId.ManualDuration`). Zelfde redenering en 100-jaargrens als
 * `MAX_REMAINING_DURATION_TENTHS`.
 */
export const MAX_MANUAL_DURATION_TENTHS = 525_960_000;

/** Klemt een rauwe `MANUAL_DURATION`-waarde naar `[0, MAX_MANUAL_DURATION_TENTHS]`. Een eigen
 *  constante per veld: de velden zijn semantisch onafhankelijk. */
export function clampManualDurationTenths(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, 0), MAX_MANUAL_DURATION_TENTHS);
}

/**
 * Klem op de RAUWE `LEVELING_DELAY` (FixedData blok 0, offset 58, veld-id 20, INT32, tienden van een
 * minuut), die `readTasks` als echte duur decodeert (`Task.levelingDelayMinutes`). Zelfde redenering
 * en 100-jaargrens als de buurvelden (in de praktijk uren tot maanden). Ook de ondergrens is 0: de
 * consumenten (`ResourceLeveler.ts`, `CPMSolver.ts`) behandelen een leveling delay als niet-negatief.
 */
export const MAX_LEVELING_DELAY_TENTHS = 525_960_000;

/** Klemt een rauwe `LEVELING_DELAY`-waarde naar `[0, MAX_LEVELING_DELAY_TENTHS]`. */
export function clampLevelingDelayTenths(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, 0), MAX_LEVELING_DELAY_TENTHS);
}

/**
 * Klem op het aantal RECORDS in één reguliere timephased-blok (Format A, 20-byte records:
 * `ActualRegularWork`/`ActualOvertimeWork`, zie `mppTimephased.ts`). De headercount is een
 * ongevalideerde bestandswaarde; `mppTimephased.ts` klemt hem eerst structureel (op de bloklengte)
 * en daarna op deze absolute grens. Die tweede klem is nodig omdat `Var2Data` een ONBEGRENSDE
 * byte-array is: een geprepareerd bestand kan tientallen MB's claimen, en elke record kost een
 * `Date`-allocatie.
 *
 * Corpus (216 bestanden): langste blok 136 bytes (hooguit 4 periodes). 20.000 records (≈ 390 KB) ligt
 * bewust ver daarboven, zodat een groter project niet wordt afgeknepen.
 */
export const MAX_TIMEPHASED_REGULAR_RECORDS = 20_000;

/** Klemt een rauwe regelmatige-timephased-recordcount (header-SHORT, al voor-geklemd tegen de
 *  structurele bloklengte door de aanroeper) naar `[0, MAX_TIMEPHASED_REGULAR_RECORDS]`. */
export function clampTimephasedRegularRecordCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(count, 0), MAX_TIMEPHASED_REGULAR_RECORDS);
}

/**
 * Zelfde redenering voor het IRREGULAR-blok (8-byte records). Corpus: 4 toewijzingen dragen
 * `ActualIrregularWork`, hoogstens 1 record elk. 5.000 records (≈ 40 KB) is ruim.
 */
export const MAX_TIMEPHASED_IRREGULAR_RECORDS = 5_000;

/**
 * Eigen klem voor het REMAINING_REGULAR_WORK-blok (`RAW_TIMEPHASED_REMAINING_REGULAR_WORK`, sleutel
 * 49): Format B, 28-byte records (`getPlannedWork`), dus een andere structurele afleiding dan
 * `MAX_TIMEPHASED_REGULAR_RECORDS`.
 *
 * Corpus: 3298 toewijzingen dragen deze categorie (3218 met `blockCount === 0`); langste blok met
 * echte periodes 352 bytes = 16 + 12×28 (header-`blockCount` 11). 20.000 records (≈ 560 KB) ligt
 * ruim daarboven.
 */
export const MAX_TIMEPHASED_PLANNED_RECORDS = 20_000;

/** Klemt een rauwe planned/remaining-timephased-blockcount naar
 *  `[0, MAX_TIMEPHASED_PLANNED_RECORDS]`. */
export function clampTimephasedPlannedRecordCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(count, 0), MAX_TIMEPHASED_PLANNED_RECORDS);
}

/** Klemt een rauwe irregular-timephased-recordcount naar `[0, MAX_TIMEPHASED_IRREGULAR_RECORDS]`. */
export function clampTimephasedIrregularRecordCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(count, 0), MAX_TIMEPHASED_IRREGULAR_RECORDS);
}
