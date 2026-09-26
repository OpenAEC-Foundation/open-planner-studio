// Bestandsformaat-AGNOSTISCHE waarde-/detectielaag. Geen CSV-kennis hier — die hoort exclusief in
// `parseProgressCsv.ts`; de XLSX-lezer levert hetzelfde `ProgressSheet`. `csvDateOrToday`
// (importDates.ts) wordt hier BEWUST niet gebruikt: die geeft bij onherkenbare invoer stil "vandaag"
// terug, en datums moeten altijd juist gelezen worden — stil raden is verboden.

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
import { shownStart, shownFinish } from '@/utils/taskDates';

type DateValue = { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
type PercentValue = { kind: 'value'; value: number } | { kind: 'unreadable'; raw: string }
  | { kind: 'outOfRange'; raw: string };

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

/** Bestaande kalenderdatum? (`2026-02-30`/`2026-13-01` bestaan niet; jaar < 1000 is onzin.) */
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
// een vaste breedte. Ook een TWEECIJFERIG jaar (`03-01-27`) hoort hierbij, net als Excel's eigen
// "korte datum"-notatie; het jaardeel accepteert dus zowel `\d{4}` als `\d{2}` (`toFullYear` maakt
// er `20YY` van).
const NUMERIC_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/** `YY` ⇒ `20YY`; `YYYY` blijft ongemoeid. */
function toFullYear(raw: string): number {
  return raw.length === 2 ? 2000 + Number(raw) : Number(raw);
}

/**
 * Ruim herkennend, streng valideert, NOOIT radend. `order` beslist alleen de niet-ISO-tak
 * (`d-m-yyyy` vs. `m-d-yyyy`); ISO-invoer is altijd `YYYY-MM-DD`, ongeacht `order`.
 */
export function parseSheetDate(raw: string, order: DateOrder = 'dmy'): DateValue | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined; // leeg = geen wijziging, geen fout.

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
    const year = toFullYear(numeric[3]);
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
 * De kolom is ALTIJD een percentage. `100` = 100 %, `1` = 1 %; de fractie-interpretatie ("waarde in
 * [0,1] is al een fractie") bestaat in deze lezer niet.
 *
 * Een numeriek LEESBARE waarde buiten [0, 100] (bv. "838", "-5") krijgt zijn EIGEN uitkomst
 * (`outOfRange`), apart van `unreadable` (tekst/geen match). "838" is typisch een decimaalteken dat
 * een spreadsheet met een andere landinstelling als duizendtalscheider las ("8,38" ⇒ 838) — de
 * dialoog kan dat alleen benoemen als hij weet dat het getal wél geparsed kon worden.
 */
export function parseSheetPercent(raw: string): PercentValue | undefined {
  if (raw.trim().length === 0) return undefined; // leeg = geen wijziging.
  if (!PERCENT.test(raw)) return { kind: 'unreadable', raw };
  const numeric = raw.replace(/%/g, '').replace(',', '.').trim();
  const value = Number(numeric);
  if (!Number.isFinite(value)) return { kind: 'unreadable', raw };
  if (value < 0 || value > 100) return { kind: 'outOfRange', raw };
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
  return { a: Number(m[1]), b: Number(m[2]), year: toFullYear(m[3]) };
}

/** Bouwt de `ambiguous`-uitkomst uit een cel waarvan BEIDE lezingen al gevalideerd zijn (zie
 *  `findGenuineAmbiguousSample`) — hier wordt niets meer gevalideerd, alleen samengesteld. */
function formatAmbiguous(cell: RawDateCell, triple: NumericTriple): DateOrderDetection {
  // dmy-lezing: dag=a, maand=b. mdy-lezing: maand=a, dag=b. ISO-strings, geen geformatteerde tekst —
  // de dialoog formatteert locale-bewust.
  return {
    order: 'ambiguous',
    sample: cell.raw,
    sampleAlternatives: [buildIso(triple.year, triple.b, triple.a), buildIso(triple.year, triple.a, triple.b)],
  };
}

/**
 * Een cel is alleen een EERLIJK voorbeeld van dubbelzinnigheid als BEIDE lezingen bestaande,
 * VERSCHILLENDE kalenderdatums opleveren — zonder `Date.UTC`-rollover (`25-6-2026` als mdy is maand
 * 25, wat zou doorrollen naar januari 2028: een onmogelijke "keuze"). Cellen die maar onder één orde
 * geldig zijn, zijn al door de bereikregel (regel 2) afgehandeld. Bestaat er geen enkele zo'n cel,
 * dan valt de aanroeper terug op `noAmbiguity` in plaats van een kapotte vraag te stellen.
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
 * celeigenschap. Beslisregels in vaste volgorde: (1) geen dubbelzinnigheid, (2) een component > 12
 * beslist — tegenstrijdig bewijs stopt meteen bij `ambiguous`, nooit stil half doorlezen,
 * (3) ijkpuntkalibratie tegen geplande taakdatums (alleen id-matches), (4) anders `ambiguous` — de
 * gebruiker beslist.
 */
export function detectDateOrder(
  cells: readonly RawDateCell[],
  tasks: readonly Task[],
): DateOrderDetection {
  // Een cel met a === b (bv. `12-12-2026`) levert onder beide ordes dezelfde datum op — die draagt
  // GEEN dubbelzinnigheid en wordt al hier weggefilterd.
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
    // Tegenstrijdig bewijs binnen hetzelfde bestand: geen enkele orde verklaart alles. Meteen een
    // uitkomst — NIET doorgaan naar de ijkpuntregel (die zou één van de twee signalen negeren en zo
    // alsnog stil een kant kiezen). De cellen die zelf stemden (a>12 of b>12) zijn maar onder ÉÉN orde
    // geldig, dus GEEN eerlijk voorbeeld — zoek een cel die dat wél is en toon die als
    // `ambiguous`-vraag. Bestaat die niet, dan benoemt `contradictoryNoSample` eerlijk dat het bestand
    // tegenstrijdig is (anders kreeg de gebruiker een muur van `unreadableDate`-weigeringen zonder
    // diagnose); de orde blijft `dmy` (een kant moet gekozen worden om verder te kunnen).
    const genuine = findGenuineAmbiguousSample(ambiguous);
    return genuine ? formatAmbiguous(genuine.cell, genuine.triple) : { order: 'dmy', evidence: 'contradictoryNoSample' };
  }
  if (votesDmy) return { order: 'dmy', evidence: 'outOfRange' };
  if (votesMdy) return { order: 'mdy', evidence: 'outOfRange' };

  // Regel 3: ijkpuntkalibratie. Alleen rijen met een HARDE id-treffer (WBS is te zwak bewijs voor
  // een bestandsbrede beslissing), alleen Start/Finish-cellen (die dienen uitsluitend als ijkpunt).
  // `a === b` zit al niet meer in `ambiguous` (hierboven weggefilterd).
  const taskById = new Map(tasks.map(t => [t.id, t] as const));
  let dmyHits = 0;
  let mdyHits = 0;
  for (const { cell, triple } of ambiguous) {
    if (cell.taskId === undefined) continue;
    if (cell.field !== 'start' && cell.field !== 'finish') continue;
    const task = taskById.get(cell.taskId);
    if (!task) continue;
    const plannedIso = cell.field === 'start'
      ? shownStart(task)
      : shownFinish(task);
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

  // Regel 4: onbeslisbaar ⇒ de dialoog vraagt het. Nooit een stille default. Net als bij regel 2
  // moet de sample zelf een eerlijk voorbeeld zijn; is er geen enkele geldige-onder-beide-lezingen
  // cel, dan is er niets dubbelzinnigs om te tonen.
  const genuine = findGenuineAmbiguousSample(ambiguous);
  return genuine ? formatAmbiguous(genuine.cell, genuine.triple) : { order: 'dmy', evidence: 'noAmbiguity' };
}

/**
 * Markeercel: het geëxporteerde voortgangsblad zet in de drie invulcellen van een VERZAMELtaak een
 * gelokaliseerde tekst die met een em-dash (U+2014) begint — `writeProgressSheetCSV(tasks,
 * headerNotes, summaryNote)`. Een cel die daarmee begint telt als AFWEZIG (leeg), niet als
 * onleesbaar: het is geen invoer maar een instructie, en een ongewijzigd teruggestuurd blad mag daar
 * geen enkele weigering aan overhouden. De em-dash is gekozen omdat geen geldige datum- of
 * percentage-invoer ermee begint (een minteken is `-`, U+002D) en de markering zo
 * bestandsformaat-agnostisch blijft (XLSX levert dezelfde strings).
 */
function isMarkerCell(raw: string): boolean {
  return raw.trimStart().startsWith('\u2014');
}

/**
 * Finaliseert een rauw blad onder de vastgestelde datumvolgorde. `Start`/`Finish` (`detectionCells`)
 * worden hier bewust NIET gelezen — die zijn uitsluitend detectiemateriaal: er bestaat geen veld in
 * `ProgressRow` dat ze zou kunnen dragen.
 */
export function finalizeProgressRows(sheet: ProgressSheet, order: DateOrder): readonly ProgressRow[] {
  return sheet.rawRows.map((row): ProgressRow => {
    const completion = row.rawCompletion !== undefined && !isMarkerCell(row.rawCompletion)
      ? parseSheetPercent(row.rawCompletion) : undefined;
    const actualStart = row.rawActualStart !== undefined && !isMarkerCell(row.rawActualStart)
      ? parseSheetDate(row.rawActualStart, order) : undefined;
    const actualFinish = row.rawActualFinish !== undefined && !isMarkerCell(row.rawActualFinish)
      ? parseSheetDate(row.rawActualFinish, order) : undefined;
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
