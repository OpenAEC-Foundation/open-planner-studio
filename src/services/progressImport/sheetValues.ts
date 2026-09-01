// Issue #27 etappe 2 (T4, A2/A5): bestandsformaat-AGNOSTISCHE waarde-/detectielaag. Geen CSV-kennis
// hier — dat hoort exclusief in `parseProgressCsv.ts` (A9: een latere XLSX-lezer levert hetzelfde
// `ProgressSheet` en gebruikt deze module ongewijzigd). `csvDateOrToday` (importDates.ts) wordt hier
// BEWUST niet gebruikt: die geeft bij onherkenbare invoer stil "vandaag" terug, en dat is precies
// wat E5 ("datums worden altijd juist gelezen; stil raden is verboden") verbiedt.

import type { Task } from '@/types/task';
import {
  CALIBRATION_RATIO,
  MIN_CALIBRATION_HITS,
  type DateOrder,
  type DateOrderDetection,
  type ProgressRow,
  type ProgressSheet,
  type RawDateCell,
} from './types';

type DateValue = { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
type PercentValue = { kind: 'value'; value: number } | { kind: 'unreadable'; raw: string };

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function buildIso(year: number, month: number, day: number, hour?: number, minute?: number, second?: number): string {
  const datePart = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  if (hour === undefined) return datePart;
  const timePart = second !== undefined
    ? `${pad2(hour)}:${pad2(minute ?? 0)}:${pad2(second)}`
    : `${pad2(hour)}:${pad2(minute ?? 0)}`;
  return `${datePart}T${timePart}`;
}

/** Bestaande kalenderdatum? (A5.1: `2026-02-30`/`2026-13-01` bestaan niet; jaar < 1000 is onzin.) */
function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1000) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  // Date.UTC(year, month, 0) met `month` als 1-gebaseerd getal geeft de laatste dag van DIE
  // maand (het volgende maandindexnummer, dag 0 = "één dag terug" = de laatste dag ervoor).
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function isValidTime(hour: number, minute: number, second?: number): boolean {
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second !== undefined && (second < 0 || second > 59)) return false;
  return true;
}

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// Excel herschrijft bij opslaan ALLE datumcellen naar zijn locale-formaat, meestal zonder
// voorloopnullen (`9-6-2026`) en met de locale-scheider (`-`/`/`/`.`) — vandaar `\d{1,2}` i.p.v.
// een vaste breedte (A5.1).
const NUMERIC_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Ruim herkennend, streng valideert, NOOIT radend (A5.1/E5). `order` beslist alleen de
 * niet-ISO-tak (`d-m-yyyy` vs. `m-d-yyyy`); ISO-invoer is altijd `YYYY-MM-DD`, ongeacht `order`.
 */
export function parseSheetDate(raw: string, order: DateOrder = 'dmy'): DateValue | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined; // Q1: leeg = geen wijziging, geen fout.

  const isoDateTime = ISO_DATETIME.exec(trimmed);
  if (isoDateTime) {
    const year = Number(isoDateTime[1]);
    const month = Number(isoDateTime[2]);
    const day = Number(isoDateTime[3]);
    const hour = Number(isoDateTime[4]);
    const minute = Number(isoDateTime[5]);
    const second = isoDateTime[6] !== undefined ? Number(isoDateTime[6]) : undefined;
    if (!isValidCalendarDate(year, month, day) || !isValidTime(hour, minute, second)) {
      return { kind: 'unreadable', raw };
    }
    return { kind: 'value', iso: buildIso(year, month, day, hour, minute, second) };
  }

  const isoDate = ISO_DATE.exec(trimmed);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    if (!isValidCalendarDate(year, month, day)) return { kind: 'unreadable', raw };
    return { kind: 'value', iso: buildIso(year, month, day) };
  }

  const numeric = NUMERIC_DATE.exec(trimmed);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    const year = Number(numeric[3]);
    const day = order === 'mdy' ? b : a;
    const month = order === 'mdy' ? a : b;
    const hour = numeric[4] !== undefined ? Number(numeric[4]) : undefined;
    const minute = numeric[5] !== undefined ? Number(numeric[5]) : undefined;
    const second = numeric[6] !== undefined ? Number(numeric[6]) : undefined;
    if (!isValidCalendarDate(year, month, day)) return { kind: 'unreadable', raw };
    if (hour !== undefined && !isValidTime(hour, minute as number, second)) return { kind: 'unreadable', raw };
    return { kind: 'value', iso: buildIso(year, month, day, hour, minute, second) };
  }

  return { kind: 'unreadable', raw };
}

const PERCENT = /^\s*-?\d+(?:[.,]\d+)?\s*%?\s*$/;

/**
 * E6/A5.6: de kolom is ALTIJD een percentage. `100` = 100 %, `1` = 1 %; de fractie-interpretatie
 * ("waarde in [0,1] is al een fractie") bestaat in deze lezer niet.
 */
export function parseSheetPercent(raw: string): PercentValue | undefined {
  if (raw.trim().length === 0) return undefined; // Q1: leeg = geen wijziging.
  if (!PERCENT.test(raw)) return { kind: 'unreadable', raw };
  const numeric = raw.replace(/%/g, '').replace(',', '.').trim();
  const value = Number(numeric);
  if (!Number.isFinite(value) || value < 0 || value > 100) return { kind: 'unreadable', raw };
  return { kind: 'value', value: value / 100 };
}

interface NumericTriple {
  a: number;
  b: number;
  year: number;
}

function extractNumericTriple(raw: string): NumericTriple | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // ISO (`YYYY-MM-DD...`) heeft het jaar VOORAAN met 4 cijfers — dat matcht dit drietal-patroon
  // (jaar ACHTERAAN, 1-2 cijfers ervoor) sowieso nooit, dus geen aparte ISO-uitsluiting nodig.
  const m = NUMERIC_DATE.exec(trimmed);
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]), year: Number(m[3]) };
}

/** Bouwt de `ambiguous`-uitkomst uit een cel waarvan BEIDE lezingen al gevalideerd zijn (zie
 *  `findGenuineAmbiguousSample`) — hier wordt niets meer gevalideerd, alleen samengesteld. */
function formatAmbiguous(cell: RawDateCell, triple: NumericTriple): DateOrderDetection {
  // dmy-lezing: dag=a, maand=b. mdy-lezing: maand=a, dag=b (A5.2/A5.3). ISO-strings, geen
  // geformatteerde tekst (fixronde-bevinding 5) — baan C formatteert locale-bewust.
  return {
    order: 'ambiguous',
    sample: cell.raw,
    sampleAlternatives: [buildIso(triple.year, triple.b, triple.a), buildIso(triple.year, triple.a, triple.b)],
  };
}

/**
 * Fixronde-bevinding 4b: een cel is alleen een EERLIJK voorbeeld van dubbelzinnigheid als BEIDE
 * lezingen bestaande, VERSCHILLENDE kalenderdatums opleveren — zonder `Date.UTC`-rollover (bv.
 * `25-6-2026` levert als mdy-lezing maand 25, wat vroeger stil doorrolde naar januari 2028: een
 * onmogelijke "keuze"). Cellen die maar onder één orde geldig zijn, horen niet als sample: die zijn
 * al door de bereikregel (regel 2) afgehandeld, of zijn gewoon geen echte tweesprong.
 * Bestaat er geen enkele zo'n cel, dan is het bestand niet dubbelzinnig — de aanroeper valt dan
 * terug op `noAmbiguity` in plaats van de gebruiker een kapotte vraag te stellen.
 */
function findGenuineAmbiguousSample(
  candidates: readonly { cell: RawDateCell; triple: NumericTriple }[],
): { cell: RawDateCell; triple: NumericTriple } | undefined {
  return candidates.find(({ triple }) =>
    triple.a !== triple.b
    && isValidCalendarDate(triple.year, triple.b, triple.a)  // dmy: dag=a, maand=b
    && isValidCalendarDate(triple.year, triple.a, triple.b), // mdy: maand=a, dag=b
  );
}

/**
 * Dag/maand-volgorde is een BESTANDSEIGENSCHAP (Excel is consequent binnen één bestand), geen
 * celeigenschap (A5.2). Beslisregels in vaste volgorde: (1) geen dubbelzinnigheid, (2) een
 * component > 12 beslist — tegenstrijdig bewijs stopt meteen bij `ambiguous`, nooit stil half
 * doorlezen, (3) ijkpuntkalibratie tegen geplande taakdatums (alleen id-matches), (4) anders
 * `ambiguous` — de gebruiker beslist.
 */
export function detectDateOrder(
  cells: readonly RawDateCell[],
  tasks: readonly Task[],
): DateOrderDetection {
  // Fixronde-bevinding 4a: een cel met a === b (bv. `12-12-2026`) levert onder ÉÉN van de twee
  // ordes gelezen dezelfde datum op als onder de andere — die draagt dus GEEN dubbelzinnigheid en
  // hoort al hier weggefilterd, niet pas bij de kalibratie (regel 3 deed dit al; nu consistent).
  const ambiguous: { cell: RawDateCell; triple: NumericTriple }[] = [];
  for (const cell of cells) {
    const triple = extractNumericTriple(cell.raw);
    if (triple && triple.a !== triple.b) ambiguous.push({ cell, triple });
  }

  // Regel 1: geen enkele niet-ISO datum om te interpreteren ⇒ de orde doet er niet toe.
  if (ambiguous.length === 0) {
    return { order: 'dmy', evidence: 'noAmbiguity' };
  }

  // Regel 2: bereikregel. Een cel met a>12 kan alleen dag-eerst zijn; met b>12 alleen maand-eerst.
  // Cellen waar BEIDE > 12 zijn stemmen niet mee (die zijn onder geen enkele orde geldig — worden
  // later `unreadable`).
  let votesDmy = false;
  let votesMdy = false;
  for (const { triple } of ambiguous) {
    const aOver = triple.a > 12;
    const bOver = triple.b > 12;
    if (aOver && bOver) continue;
    if (aOver) votesDmy = true;
    if (bOver) votesMdy = true;
  }
  if (votesDmy && votesMdy) {
    // Tegenstrijdig bewijs binnen hetzelfde bestand: geen enkele orde verklaart alles. Meteen
    // `ambiguous` — NIET doorgaan naar de ijkpuntregel (die zou één van de twee tegenstrijdige
    // signalen negeren en zo alsnog stil een kant kiezen). De cellen die zelf stemden (a>12 of
    // b>12) zijn per definitie maar onder ÉÉN orde geldig, dus GEEN eerlijk voorbeeld (bevinding
    // 4b) — zoek een cel die dat wél is; bestaat die niet, dan is er geen tonbaar bewijs en valt
    // dit terug op `noAmbiguity` in plaats van de gebruiker een onmogelijke keuze voor te leggen.
    const genuine = findGenuineAmbiguousSample(ambiguous);
    return genuine ? formatAmbiguous(genuine.cell, genuine.triple) : { order: 'dmy', evidence: 'noAmbiguity' };
  }
  if (votesDmy) return { order: 'dmy', evidence: 'outOfRange' };
  if (votesMdy) return { order: 'mdy', evidence: 'outOfRange' };

  // Regel 3: ijkpuntkalibratie. Alleen rijen met een HARDE id-treffer (WBS is te zwak bewijs voor
  // een bestandsbrede beslissing), alleen Start/Finish-cellen (die dienen uitsluitend als
  // ijkpunt, A5.4). `a === b` (`12-12-2026`, twee keer dezelfde lezing) zit al niet meer in
  // `ambiguous` (regel 1 filtert dat nu vooraf, fixronde-bevinding 4a).
  const taskById = new Map(tasks.map(t => [t.id, t] as const));
  let dmyHits = 0;
  let mdyHits = 0;
  for (const { cell, triple } of ambiguous) {
    if (cell.taskId === undefined) continue;
    if (cell.field !== 'start' && cell.field !== 'finish') continue;
    const task = taskById.get(cell.taskId);
    if (!task) continue;
    const plannedIso = cell.field === 'start'
      ? (task.time.earlyStart || task.time.scheduleStart)
      : (task.time.earlyFinish || task.time.scheduleFinish);
    const plannedDatePart = plannedIso.slice(0, 10);

    if (isValidCalendarDate(triple.year, triple.b, triple.a)) {
      const dmyIso = buildIso(triple.year, triple.b, triple.a);
      if (dmyIso === plannedDatePart) dmyHits++;
    }
    if (isValidCalendarDate(triple.year, triple.a, triple.b)) {
      const mdyIso = buildIso(triple.year, triple.a, triple.b);
      if (mdyIso === plannedDatePart) mdyHits++;
    }
  }

  const winner = dmyHits >= mdyHits
    ? { order: 'dmy' as const, hits: dmyHits, loserHits: mdyHits }
    : { order: 'mdy' as const, hits: mdyHits, loserHits: dmyHits };
  if (winner.hits >= MIN_CALIBRATION_HITS && winner.hits >= CALIBRATION_RATIO * winner.loserHits) {
    return { order: winner.order, evidence: 'calibration' };
  }

  // Regel 4: onbeslisbaar ⇒ de dialoog vraagt het (A5.3). Nooit een stille default. Net als bij
  // regel 2 moet de sample zelf een eerlijk voorbeeld zijn (bevinding 4b); is er geen enkele
  // geldige-onder-beide-lezingen cel, dan is er niets dubbelzinnigs om te tonen.
  const genuine = findGenuineAmbiguousSample(ambiguous);
  return genuine ? formatAmbiguous(genuine.cell, genuine.triple) : { order: 'dmy', evidence: 'noAmbiguity' };
}

/**
 * Finaliseert een rauw blad onder de vastgestelde datumvolgorde. `Start`/`Finish` (`detectionCells`)
 * worden hier bewust NIET gelezen — die zijn uitsluitend detectiemateriaal (A5.4): er bestaat geen
 * veld in `ProgressRow` dat ze zou kunnen dragen.
 */
export function finalizeProgressRows(sheet: ProgressSheet, order: DateOrder): readonly ProgressRow[] {
  return sheet.rawRows.map((row): ProgressRow => {
    const completion = row.rawCompletion !== undefined ? parseSheetPercent(row.rawCompletion) : undefined;
    const actualStart = row.rawActualStart !== undefined ? parseSheetDate(row.rawActualStart, order) : undefined;
    const actualFinish = row.rawActualFinish !== undefined ? parseSheetDate(row.rawActualFinish, order) : undefined;
    return {
      rowNumber: row.rowNumber,
      ...(row.taskId !== undefined ? { taskId: row.taskId } : {}),
      ...(row.wbsCode !== undefined ? { wbsCode: row.wbsCode } : {}),
      ...(row.name !== undefined ? { name: row.name } : {}),
      ...(completion !== undefined ? { completion } : {}),
      ...(actualStart !== undefined ? { actualStart } : {}),
      ...(actualFinish !== undefined ? { actualFinish } : {}),
    };
  });
}
