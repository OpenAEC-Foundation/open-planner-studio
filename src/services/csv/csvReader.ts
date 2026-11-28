import { Task, TaskType, TASK_TYPES } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Project } from '@/types/project';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { normalizeImportedProgress, rebuildImportedHierarchy } from '@/services/importNormalize';
import { csvDate, csvDateOrToday, csvDateOrUndefined, importDateTimeOrUndefined, emptyMissingScheduleDates, resolveMissingScheduleDates } from '@/services/importDates';
import { DEFAULT_PRIORITY } from '@/services/ifc/ifcConstants';
import { parseSheetPercent } from '@/services/progressImport/sheetValues';
import { LAG_UNIT_SUFFIXES, parseLagInput } from '@/utils/lagFormat';
import type { ImportResult } from '@/services/importTypes';
import type { CustomTaskTypeDraft } from '@/types/taskType';
import { withTaskTypeColors } from '@/services/taskTypes/customTaskTypeColors';
import { buildRecordedTime, type RecordedTime } from '@/engine/scheduler/recordedDates';

export class CsvDateImportError extends Error {
  constructor(readonly row: number, readonly column: string, readonly value: string) {
    super(`CSV record ${row}, column ${JSON.stringify(column)}: unrecognised date ${JSON.stringify(value)}. Use YYYY-MM-DD, DD-MM-YYYY or DD/MM/YYYY.`);
    this.name = 'CsvDateImportError';
  }
}

interface ParsedRow {
  wbs: string;
  outlineLevel?: number;
  name: string;
  duration: number;
  start: string;
  finish: string;
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
  recorded?: RecordedTime;
  description: string;
}

function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

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
      fieldStart = ch === delimiter || (fieldStart && (ch === ' ' || ch === '\t'));
    }
  }
  records.push(content.slice(start));
  return records.filter(r => r.trim());
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
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
        if (atFieldStart && (ch === ' ' || ch === '\t')) fieldStart = true;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseTaskType(s: string): TaskType {
  const upper = s.toUpperCase().trim();
  return TASK_TYPES.includes(upper as TaskType) ? (upper as TaskType) : 'CONSTRUCTION';
}

function parseDate(s: string, row: number, column: string, preserveTime = false): string {
  if (preserveTime && /^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const instant = importDateTimeOrUndefined(s, true);
    if (instant === undefined) throw new CsvDateImportError(row, column, s);
    return instant;
  }
  if (s.trim() && csvDate(s) === undefined) throw new CsvDateImportError(row, column, s);
  return csvDateOrToday(s);
}

type ParsedLag = Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>;

const PREDECESSOR_TOKEN = new RegExp(
  `^(.+?)\\s*(FS|FF|SS|SF)?\\s*([+-]\\d+(?:\\.\\d+)?(?:${LAG_UNIT_SUFFIXES})?)?$`, 'i',
);

function parsePredecessorString(predStr: string): { wbs: string; type: SequenceType; lag: ParsedLag }[] {
  if (!predStr.trim()) return [];
  const results: { wbs: string; type: SequenceType; lag: ParsedLag }[] = [];
  const decimalLag = new RegExp(
    `((?:FS|FF|SS|SF)[+-]\\d+),(\\d+(?:${LAG_UNIT_SUFFIXES}))(?=\\s*(?:,|$))`, 'gi',
  );
  const parts = predStr.replace(decimalLag, '$1.$2').split(/[,]/);

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

function readCsvNumber(raw: string, delimiter: string): number {
  const m = /^\s*([+-]?\d+),(\d+)(?![\d.,])/.exec(raw);
  if (!m) return parseFloat(raw);
  if (delimiter === ',' && /^[+-]?[1-9]\d{0,2}$/.test(m[1]) && m[2].length === 3) return NaN;
  return parseFloat(`${m[1]}.${m[2]}`);
}

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
    taskType: ['task type', 'type', 'tasktype', 'taaktype', 'werksoort', 'work category'],
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
  const clean = content.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(clean);
  const lines = splitCSVRecords(clean, delimiter);

  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

  const headers = parseCSVLine(lines[0], delimiter);
  const colMap = mapColumnIndex(headers);
  const completionIsPercent = colMap.completion !== undefined && headers[colMap.completion].includes('%');

  const unreadable: string[] = [];
  const numberOr = (raw: string, fallback: number): number => {
    const n = readCsvNumber(raw, delimiter);
    if (Number.isFinite(n)) return n;
    if (raw.trim()) unreadable.push(JSON.stringify(raw));
    return fallback;
  };

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

    const actualStartRaw = get('actualStart').trim();
    const actualFinishRaw = get('actualFinish').trim();

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
      duration: numberOr(get('duration', '5'), 5),
      start: parseDate(get('start'), i + 1, headers[colMap.start]),
      finish: parseDate(get('finish'), i + 1, headers[colMap.finish]),
      startMissing: csvDate(get('start')) === undefined,
      finishMissing: csvDate(get('finish')) === undefined,
      predecessors: get('predecessors'),
      taskType: get('taskType', 'CONSTRUCTION'),
      customTaskTypeId: get('customTaskTypeId').trim(),
      completion,
      actualStart: actualStartRaw ? parseDate(actualStartRaw, i + 1, headers[colMap.actualStart], true) : undefined,
      actualFinish: actualFinishRaw ? parseDate(actualFinishRaw, i + 1, headers[colMap.actualFinish], true) : undefined,
      critical: get('critical', 'No').toLowerCase() === 'yes',
      totalFloat: numberOr(get('totalFloat', '0'), 0),
      description: get('description'),
    });
  }

  if (unreadable.length > 0) {
    console.warn(`CSV-import: ${unreadable.length} cel(len) met een onleesbaar, dubbelzinnig of onmogelijk getal (${unreadable.slice(0, 5).join(', ')}${unreadable.length > 5 ? ', …' : ''}) — standaardwaarde van de kolom gebruikt.`);
  }

  const tasks: Task[] = [];
  const wbsToId = new Map<string, string>();
  const recordedTimes: Record<string, RecordedTime> = {};
  const customById = new Map<string, CustomTaskTypeDraft>();
  const customIdByName = new Map<string, string>();
  const registerCustomType = (type: CustomTaskTypeDraft): CustomTaskTypeDraft | undefined => {
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
      if (rawType && rawType.toUpperCase() !== 'USERDEFINED') {
        registerCustomType({ id: customTaskTypeId, name: rawType });
      }
    } else if (rawType && !isBuiltin) {
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
      status: 'NOT_STARTED',
      isMilestone: row.duration === 0,
      priority: DEFAULT_PRIORITY,
      parentId: null,
      childIds: [],
      time: {
        durationType: 'WORKTIME',
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

  const calendar = createDefaultCalendar();
  const projectStart = resolveMissingScheduleDates(tasks, missing, '', () => calendar);

  normalizeImportedProgress(tasks, undefined, undefined, calendar);

  rebuildImportedHierarchy(tasks, rows.map(r => r.outlineLevel));
  for (const task of tasks) if (task.childIds.length > 0) task.isMilestone = false;

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
        if (pred.lag.lagUnit) seq.lagUnit = pred.lag.lagUnit;
        if (pred.lag.lagPercent !== undefined) seq.lagPercent = pred.lag.lagPercent;
        if (pred.lag.lagMinutes !== undefined) seq.lagMinutes = pred.lag.lagMinutes;
        sequences.push(seq);
      }
    }
  }
  if (unresolvedPredecessors > 0) {
    console.warn(`CSV-import: ${unresolvedPredecessors} voorganger(s) verwijzen naar een WBS-code die in het bestand niet voorkomt — relatie(s) overgeslagen.`);
  }
  if (ambiguousPredecessors > 0) {
    console.warn(`CSV-import: ${ambiguousPredecessors} voorganger(s) verwijzen naar een WBS-code die meer dan één keer voorkomt — gekoppeld aan de laatste rij met die code.`);
  }

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
    customTaskTypes: withTaskTypeColors([...customById.values()]),
    suggestedProfileId: 'ops',
    ...(Object.keys(recordedTimes).length > 0 ? { recordedTimes, recordedTimesOrigin: 'csv' as const } : {}),
  };
}
