import { Task, TaskType, TASK_TYPES } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Project } from '@/types/project';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { normalizeImportedProgress, rebuildImportedHierarchy } from '@/services/importNormalize';
import { csvDate, csvDateOrToday, csvDateOrUndefined, emptyMissingScheduleDates, resolveMissingScheduleDates } from '@/services/importDates';
import { DEFAULT_PRIORITY } from '@/services/ifc/ifcConstants';
import { parseSheetPercent } from '@/services/progressImport/sheetValues';
import { LAG_UNIT_SUFFIXES, parseLagInput } from '@/utils/lagFormat';
import type { ImportResult } from '@/services/importTypes';
import type { CustomTaskType } from '@/types/taskType';
import { buildRecordedTime, type RecordedTime } from '@/engine/scheduler/recordedDates';

interface ParsedRow {
  wbs: string;
  /** Issue #159: 'Outline Level'-kolom (1 = hoofdniveau); undefined als de kolom ontbreekt. */
  outlineLevel?: number;
  name: string;
  duration: number;
  start: string;
  finish: string;
  /** Lege/onleesbare Start- of Finish-cel: `start`/`finish` dragen dan de vandaag-plaatshouder, die
   *  `resolveMissingScheduleDates` vervangt (projectstart / start + duur). */
  startMissing: boolean;
  finishMissing: boolean;
  predecessors: string;
  taskType: string;
  customTaskTypeId: string;
  completion: number;
  actualStart?: string;
  actualFinish?: string;
  critical: boolean;
  totalFloat: number;
  /** Zie de toelichting bij `rows.push` in `readCSV`. */
  recorded?: RecordedTime;
  description: string;
}

function detectDelimiter(content: string): string {
  // Check first line for delimiter
  const firstLine = content.split(/\r?\n/)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

/**
 * Splits de CSV-tekst in RECORDS in plaats van in fysieke regels: een regeleinde BINNEN een
 * aanhalingsteken-veld hoort bij de cel (RFC 4180 — `escapeCSV` in `csvWriter.ts` zet zo'n cel juist
 * tussen aanhalingstekens). Een kale `split(/\r?\n/)` knipte zo'n meerregelige omschrijving in
 * losse "taken" en schoof de rest van de rij over de kolommen. Een `"` opent alleen AAN HET BEGIN
 * van een veld een quote-veld, zodat een losse inch-quote midden in een ongequote cel (`Pijp 5"`) niet
 * de rest van het bestand tot één record maakt; binnen een quote-veld is `""` een letterlijke `"`.
 * Lege records vallen weg, zoals voorheen de lege regels.
 */
function splitCSVRecords(content: string, delimiter: string): string[] {
  const records: string[] = [];
  let inQuotes = false;
  let fieldStart = true;
  let start = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') i++;
        else inQuotes = false;
      }
    } else if (ch === '"' && fieldStart) {
      inQuotes = true;
      fieldStart = false;
    } else if (ch === '\n' || ch === '\r') {
      records.push(content.slice(start, i));
      if (ch === '\r' && content[i + 1] === '\n') i++;
      start = i + 1;
      fieldStart = true;
    } else {
      fieldStart = ch === delimiter;
    }
  }
  records.push(content.slice(start));
  return records.filter(r => r.trim());
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  // Zelfde regel als `splitCSVRecords`: alleen een `"` aan het begin van een veld opent een
  // quote-veld; een losse `"` elders (`Pijp 5"`) is gewone tekst en slokt het scheidingsteken niet op.
  let fieldStart = true;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const atFieldStart = fieldStart;
    fieldStart = false;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' && atFieldStart) {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
        fieldStart = true;
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseTaskType(s: string): TaskType {
  // CSV-specifieke normalisatie: hoofdletters + trim (`construction` → `CONSTRUCTION`).
  const upper = s.toUpperCase().trim();
  return TASK_TYPES.includes(upper as TaskType) ? (upper as TaskType) : 'CONSTRUCTION';
}

/** CSV-datum: ISO of `DD-MM-YYYY`/`DD/MM/YYYY`; gedeeld met de import-datumhelper (F5-a). */
function parseDate(s: string): string {
  return csvDateOrToday(s);
}

type ParsedLag = Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>;

// Pattern: WBS_CODE + TYPE + optional LAG (MS Project-notatie)
// e.g. "1.1FS+2d" (werkdagen), "1.3SS-1d", "1.2FF+3ed" (kalenderdagen/elapsed), "1.7FS+2u" (werkuren),
//      "1.8FS+3eu" (elapsed uren), "1.5SS+50%" (procent van voorgangerduur), "1.6FS-25e%", "1.4"
// Critreview #159: de code is VRIJE TEKST (`T107`, `A-01` uit een IFC-/P6-import), niet `[\d.]+` —
// lazy `.+?` laat het type-achtervoegsel en de lag het einde bepalen. De lag is de korte notatie van
// de app (`formatLagShort` schrijft hem, `parseLagInput` leest hem): de eenheden komen uit
// `LAG_UNIT_SUFFIXES`, zodat CSV nooit een eigen, smallere lag-notatie heeft (audit import/export,
// bevinding 4 — uur-lags verdwenen stil). Het teken is hier verplicht (anders is "1.12" niet van
// "1.1" + lag 2 te onderscheiden) en de decimaal is een punt: de komma scheidt in deze kolom de
// voorgangers.
const PREDECESSOR_TOKEN = new RegExp(
  `^(.+?)\\s*(FS|FF|SS|SF)?\\s*([+-]\\d+(?:\\.\\d+)?(?:${LAG_UNIT_SUFFIXES})?)?$`, 'i',
);

function parsePredecessorString(predStr: string): { wbs: string; type: SequenceType; lag: ParsedLag }[] {
  if (!predStr.trim()) return [];
  const results: { wbs: string; type: SequenceType; lag: ParsedLag }[] = [];
  // Split by comma (within predecessor field)
  const parts = predStr.split(/[,]/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(PREDECESSOR_TOKEN);
    if (match) {
      const wbs = match[1];
      const typeStr = (match[2] || 'FS').toUpperCase();
      const lagStr = match[3] || '';

      const typeMap: Record<string, SequenceType> = {
        'FS': 'FINISH_START',
        'FF': 'FINISH_FINISH',
        'SS': 'START_START',
        'SF': 'START_FINISH',
      };

      const lag = (lagStr && parseLagInput(lagStr)) || { lagDays: 0 };
      results.push({ wbs, type: typeMap[typeStr] || 'FINISH_START', lag });
    }
  }

  return results;
}

/**
 * Het getal vooraan een CSV-cel — zoals `parseFloat` ("5 days" ⇒ 5, "2.5" ⇒ 2.5), maar met een
 * DECIMALE KOMMA waar die eenduidig is (review audit import/export: "2,5" werd stil 2, "33,4" stil 33).
 * - Scheidingsteken ";": een komma in een cel is het decimaalteken. ";" als lijstscheider is precies
 *   wat spreadsheets met een komma-decimale landinstelling (nl/de/fr) schrijven, en hun
 *   duizendtalscheider is "." of een spatie — nooit ",".
 * - Scheidingsteken ",": een komma kan dan alleen in een GEQUOTE cel staan (Google Sheets met een
 *   komma-decimale landinstelling doet dat, `"2,5"`). "2,5", "0,125" en "33,45" zijn ook daar alleen
 *   als decimaal te lezen, maar "1,250" (1–3 cijfers zonder voorloopnul, komma, precies 3 cijfers) is
 *   net zo goed Engelse duizendtalnotatie (1250). Dat scheelt een factor 1000, dus niet gokken: NaN —
 *   de aanroeper valt terug op zijn gewone "onleesbaar"-pad en meldt de cel.
 * Meer groepen ("1,250,000", "1.250,5") vallen buiten de kommaregel en houden het oude
 * `parseFloat`-gedrag, net als elke cel zonder komma (onze eigen export schrijft een decimale punt).
 */
function readCsvNumber(raw: string, delimiter: string): number {
  const m = /^\s*([+-]?\d+),(\d+)(?![\d.,])/.exec(raw);
  if (!m) return parseFloat(raw);
  if (delimiter === ',' && /^[+-]?[1-9]\d{0,2}$/.test(m[1]) && m[2].length === 3) return NaN;
  return parseFloat(`${m[1]}.${m[2]}`);
}

/**
 * Completion-cel → fractie 0..1, of `undefined` als de cel niet leesbaar is (de aanroeper meldt hem
 * en neemt 0 = "geen voortgang", de golden rule van `normalizeImportedProgress`).
 *
 * Audit import/export, bevinding 5: een %-markering — in de KOP ("Completion (%)", "% complete") of
 * in de CEL zelf ("33%") — betekent altijd procent, met exact dezelfde parser als "Voortgang
 * importeren" (`parseSheetPercent`): "1" is 1 %, "0,5" is 0,5 %, "150" is buiten bereik. Zo leest
 * Openen onze eigen export (hele procenten) en een teruggestuurd voortgangsblad precies zoals de
 * voortgangsimport dat doet; voorheen werd "1" via de fractie-heuristiek hieronder stil 100 %.
 * Alleen een kop ZONDER % ("Completion", "Percent", "Voltooiing") draagt geen eenheid; daar blijft
 * de oude heuristiek "≤ 1 is een fractie, > 1 is procent" staan voor derde tools die 0..1 schrijven.
 */
function parseCompletionCell(raw: string, headerIsPercent: boolean, delimiter: string): number | undefined {
  if (!raw.trim()) return 0;
  if (headerIsPercent || raw.includes('%')) {
    const pct = parseSheetPercent(raw);
    return pct?.kind === 'value' ? pct.value : undefined;
  }
  const n = readCsvNumber(raw, delimiter);
  if (!Number.isFinite(n)) return undefined;
  return n > 1 ? n / 100 : n;
}

function mapColumnIndex(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const aliases: Record<string, string[]> = {
    wbs: ['wbs', 'wbs code', 'wbscode', 'outline'],
    outlineLevel: ['outline level', 'outlinelevel', 'overzichtsniveau'],
    name: ['name', 'task name', 'activity', 'taak', 'naam'],
    duration: ['duration', 'duration (days)', 'duur', 'days'],
    start: ['start', 'start date', 'begin', 'startdatum'],
    finish: ['finish', 'finish date', 'end', 'end date', 'eind', 'einddatum'],
    predecessors: ['predecessors', 'predecessor', 'voorgangers', 'depends on', 'links'],
    taskType: ['task type', 'type', 'tasktype', 'taaktype'],
    customTaskTypeId: ['ops custom task type id'],
    completion: ['completion', 'completion (%)', '% complete', 'percent', 'voltooiing'],
    actualStart: ['actual start', 'actualstart', 'werkelijke start'],
    actualFinish: ['actual finish', 'actualfinish', 'werkelijke einde', 'werkelijk einde'],
    critical: ['critical', 'kritiek'],
    totalFloat: ['total float', 'float', 'slack', 'speling'],
    description: ['description', 'beschrijving', 'notes', 'opmerkingen'],
  };

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    for (const [key, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(h)) {
        map[key] = i;
        break;
      }
    }
  }
  return map;
}

export function readCSV(content: string): ImportResult {
  // Strip BOM
  const clean = content.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(clean);
  const lines = splitCSVRecords(clean, delimiter);

  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

  const headers = parseCSVLine(lines[0], delimiter);
  const colMap = mapColumnIndex(headers);
  const completionIsPercent = colMap.completion !== undefined && headers[colMap.completion].includes('%');

  // Cellen met een getal dat we niet (eenduidig) konden lezen: die krijgen de terugval van hun kolom
  // en worden hieronder gemeld — nooit een stille gok.
  const unreadable: string[] = [];
  const numberOr = (raw: string, fallback: number): number => {
    const n = readCsvNumber(raw, delimiter);
    if (Number.isFinite(n)) return n;
    if (raw.trim()) unreadable.push(JSON.stringify(raw));
    return fallback;
  };

  // Parse all rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter);
    const get = (key: string, fallback = '') =>
      colMap[key] !== undefined ? (fields[colMap[key]] || fallback) : fallback;

    const completionRaw = get('completion');
    let completion = parseCompletionCell(completionRaw, completionIsPercent, delimiter);
    if (completion === undefined) {
      unreadable.push(JSON.stringify(completionRaw));
      completion = 0;
    }

    // Actuals (fase 2.6, §9.3) — leeg ⇒ undefined (invarianten via normalizeImportedProgress).
    const actualStartRaw = get('actualStart').trim();
    const actualFinishRaw = get('actualFinish').trim();

    // "Datums zoals opgeslagen" voor CSV (eigenaarsbesluit 2026-09-09, "vergelijk wat er is"):
    // alleen kolommen die het bestand ÉCHT heeft en die voor deze rij gevuld zijn tellen als
    // vastlegging — een ontbrekende kolom is "niet vastgelegd", nooit de `vandaag`-/`0`-terugval
    // die `task.time` hieronder wél krijgt. Late datums kent een CSV niet.
    const recordedStartRaw = colMap.start !== undefined ? get('start').trim() : '';
    const recordedFinishRaw = colMap.finish !== undefined ? get('finish').trim() : '';
    const recordedFloatRaw = colMap.totalFloat !== undefined ? get('totalFloat').trim() : '';
    const recordedCriticalRaw = colMap.critical !== undefined ? get('critical').trim().toLowerCase() : '';
    const recordedFloat = recordedFloatRaw ? readCsvNumber(recordedFloatRaw, delimiter) : Number.NaN;

    const outlineLevelRaw = get('outlineLevel').trim();
    rows.push({
      recorded: buildRecordedTime({
        start: recordedStartRaw ? csvDateOrUndefined(recordedStartRaw) : undefined,
        finish: recordedFinishRaw ? csvDateOrUndefined(recordedFinishRaw) : undefined,
        totalFloat: Number.isFinite(recordedFloat) ? recordedFloat : undefined,
        isCritical: recordedCriticalRaw === 'yes' || recordedCriticalRaw === 'ja' || recordedCriticalRaw === 'true' || recordedCriticalRaw === '1' ? true
          : recordedCriticalRaw === 'no' || recordedCriticalRaw === 'nee' || recordedCriticalRaw === 'false' || recordedCriticalRaw === '0' ? false
            : undefined,
      }),
      wbs: get('wbs'),
      ...(outlineLevelRaw ? { outlineLevel: parseInt(outlineLevelRaw, 10) } : {}),
      name: get('name', 'Task'),
      // `|| 5` maakte van duur 0 (een mijlpaal) stil 5 dagen (critreview #159): alleen een ONLEESBARE
      // waarde valt terug op de default. Een fractionele dag blijft bewust fractioneel (niet afronden).
      duration: numberOr(get('duration', '5'), 5),
      start: parseDate(get('start')),
      finish: parseDate(get('finish')),
      startMissing: csvDate(get('start')) === undefined,
      finishMissing: csvDate(get('finish')) === undefined,
      predecessors: get('predecessors'),
      taskType: get('taskType', 'CONSTRUCTION'),
      customTaskTypeId: get('customTaskTypeId').trim(),
      completion,
      actualStart: actualStartRaw ? parseDate(actualStartRaw) : undefined,
      actualFinish: actualFinishRaw ? parseDate(actualFinishRaw) : undefined,
      critical: get('critical', 'No').toLowerCase() === 'yes',
      totalFloat: numberOr(get('totalFloat', '0'), 0),
      description: get('description'),
    });
  }

  if (unreadable.length > 0) {
    console.warn(`CSV-import: ${unreadable.length} cel(len) met een onleesbaar, dubbelzinnig of onmogelijk getal (${unreadable.slice(0, 5).join(', ')}${unreadable.length > 5 ? ', …' : ''}) — standaardwaarde van de kolom gebruikt.`);
  }

  // Create tasks and map WBS -> task id
  const tasks: Task[] = [];
  const wbsToId = new Map<string, string>();
  const recordedTimes: Record<string, RecordedTime> = {};
  // Een niet-IFC-classificatie uit CSV is geen reden om gegevens naar CONSTRUCTION te degraderen.
  // Hij wordt uitsluitend in dit geïmporteerde project een USERDEFINED-type, nooit automatisch
  // onderdeel van de persoonlijke app-brede lijst.
  const customById = new Map<string, CustomTaskType>();
  const customIdByName = new Map<string, string>();
  const registerCustomType = (type: CustomTaskType): CustomTaskType | undefined => {
    const existingById = customById.get(type.id);
    if (existingById) return existingById.name.localeCompare(
      type.name, undefined, { sensitivity: 'accent' },
    ) === 0 ? existingById : undefined;
    const nameKey = type.name.toLocaleLowerCase();
    const existingId = customIdByName.get(nameKey);
    if (existingId && existingId !== type.id) return undefined;
    customById.set(type.id, type);
    customIdByName.set(nameKey, type.id);
    return type;
  };

  const duplicateWbs = new Set<string>();
  const missing = emptyMissingScheduleDates();
  for (const row of rows) {
    const id = generateId('task');
    if (row.startMissing) missing.start.add(id);
    if (row.finishMissing) missing.finish.add(id);
    if (wbsToId.has(row.wbs)) duplicateWbs.add(row.wbs);
    wbsToId.set(row.wbs, id);
    if (row.recorded) recordedTimes[id] = row.recorded;

    const rawType = row.taskType.trim();
    const parsedType = parseTaskType(rawType);
    const isBuiltin = TASK_TYPES.includes(rawType.toUpperCase() as TaskType);
    let customTaskTypeId: string | undefined;
    if (row.customTaskTypeId) {
      customTaskTypeId = row.customTaskTypeId;
      // Een ontbrekende catalogusnaam is beschadigd maar niet fataal: de stabiele id blijft aan
      // de taak hangen en de UI toont de neutrale USERDEFINED-terugval. Onze eigen CSV schrijft
      // normaal de leesbare naam in Task Type; USERDEFINED betekent dus expliciet "naam ontbreekt".
      if (rawType && rawType.toUpperCase() !== 'USERDEFINED') {
        registerCustomType({ id: customTaskTypeId, name: rawType });
      }
    } else if (rawType && !isBuiltin) {
      // OPS schrijft een stabiel id mee. Externe CSV zonder dat veld blijft op de naam gededupliceerd.
      const key = rawType.toLocaleLowerCase();
      const existingId = customIdByName.get(key);
      let custom = existingId ? customById.get(existingId) : undefined;
      if (!custom) {
        custom = { id: generateId('tasktype'), name: rawType };
        registerCustomType(custom);
      }
      customTaskTypeId = custom.id;
    }
    tasks.push({
      id,
      name: row.name,
      description: row.description,
      wbsCode: row.wbs,
      taskType: customTaskTypeId ? 'USERDEFINED' : parsedType,
      ...(customTaskTypeId ? { customTaskTypeId } : {}),
      status: 'NOT_STARTED', // afgeleid door normalizeImportedProgress uit completion/actuals
      isMilestone: row.duration === 0,
      // De gedeelde default (500, zoals addTask en de IFC-/MSPDI-/P6-/MPP-lezers) — CSV draagt geen
      // prioriteit. De oude 0 ("laagste, levelt als eerste weg") was een overblijfsel van vóór
      // fase 2.5 (audit import/export, bevinding 9).
      priority: DEFAULT_PRIORITY,
      parentId: null,
      childIds: [],
      time: {
        durationType: 'WORKTIME',
        // CSV draagt geen per-taak-eenheid: een naakte CSV-duur is deterministisch dagen.
        durationUnit: 'days',
        scheduleDuration: row.duration,
        scheduleStart: row.start,
        scheduleFinish: row.finish,
        earlyStart: row.start,
        earlyFinish: row.finish,
        lateStart: row.start,
        lateFinish: row.finish,
        freeFloat: 0,
        totalFloat: row.totalFloat,
        isCritical: row.critical,
        actualStart: row.actualStart,
        actualFinish: row.actualFinish,
        completion: row.completion,
      },
      resourceIds: [],
    });
  }

  // Ontbrekende Start/Finish (gedeelde regel, vóór de voortgang-invarianten): CSV draagt geen
  // projectstart, dus het anker is de vroegste aanwezige taakstart; het document krijgt de
  // standaardkalender, dus start + duur is op díe kalender eenduidig.
  const calendar = createDefaultCalendar();
  const projectStart = resolveMissingScheduleDates(tasks, missing, '', () => calendar);

  // Voortgang-invarianten op de rauw ingelezen actuals (§3.2/§15.6). CSV kent geen statusdatum.
  normalizeImportedProgress(tasks, undefined);

  // Parent-child-hiërarchie (issue #159): 'Outline Level'-kolom + rijvolgorde, met de gepunte WBS als
  // scheidsrechter én terugval — beslisregel bij `rebuildImportedHierarchy` (gedeeld met MSPDI).
  rebuildImportedHierarchy(tasks, rows.map(r => r.outlineLevel));
  // Critreview #159: een taak mét kinderen is nooit een mijlpaal — de duur-0-gok hierboven kende de
  // boom nog niet (spiegel van de writer-guard in `mspdiWriter.ts`).
  for (const task of tasks) if (task.childIds.length > 0) task.isMilestone = false;

  // Parse predecessors into sequences. `tasks[i]` ↔ `rows[i]` is per constructie 1-op-1 (één push
  // per rij hierboven), dus op index — niet `rows.find` op WBS-code, die bij dubbele of lege codes
  // stil de verkeerde rij pakte (critreview #159).
  const sequences: Sequence[] = [];
  let unresolvedPredecessors = 0;
  let ambiguousPredecessors = 0;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const row = rows[i];
    if (!row || !row.predecessors) continue;

    const preds = parsePredecessorString(row.predecessors);
    for (const pred of preds) {
      const predId = wbsToId.get(pred.wbs);
      if (predId && duplicateWbs.has(pred.wbs)) ambiguousPredecessors++;
      if (!predId) unresolvedPredecessors++;
      if (predId) {
        const seq: Sequence = {
          id: generateId('seq'),
          predecessorId: predId,
          successorId: task.id,
          type: pred.type,
          lagDays: pred.lag.lagDays,
        };
        // Alleen gezette velden (byte-stabiel met de oude lezer voor dag-/procent-lags).
        if (pred.lag.lagUnit) seq.lagUnit = pred.lag.lagUnit;
        if (pred.lag.lagPercent !== undefined) seq.lagPercent = pred.lag.lagPercent;
        if (pred.lag.lagMinutes !== undefined) seq.lagMinutes = pred.lag.lagMinutes;
        sequences.push(seq);
      }
    }
  }
  // Weggelaten-/onzeker-met-warn (zelfde patroon als de exporters): een voorganger die op geen enkele
  // WBS-code past is weg; een die op een DUBBELE code past is aan de laatste rij met die code gehangen.
  if (unresolvedPredecessors > 0) {
    console.warn(`CSV-import: ${unresolvedPredecessors} voorganger(s) verwijzen naar een WBS-code die in het bestand niet voorkomt — relatie(s) overgeslagen.`);
  }
  if (ambiguousPredecessors > 0) {
    console.warn(`CSV-import: ${ambiguousPredecessors} voorganger(s) verwijzen naar een WBS-code die meer dan één keer voorkomt — gekoppeld aan de laatste rij met die code.`);
  }

  // Build project
  const allFinishes = tasks.map(t => t.time.scheduleFinish).filter(Boolean).sort();

  const project: Project = {
    id: generateId('proj'),
    name: 'CSV Import',
    description: '',
    startDate: projectStart,
    endDate: allFinishes[allFinishes.length - 1] || '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
  };

  return {
    project,
    calendar,
    tasks,
    sequences,
    resources: [],
    assignments: [],
    customTaskTypes: [...customById.values()],
    // Rekenprofielen (spec v3.1 §6): CSV ⇒ OPS (defaultOptionsFor('ops') is leeg).
    suggestedProfileId: 'ops',
    ...(Object.keys(recordedTimes).length > 0 ? { recordedTimes, recordedTimesOrigin: 'csv' as const } : {}),
  };
}
