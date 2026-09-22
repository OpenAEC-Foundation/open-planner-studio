import { Task, TaskType, TaskStatus, TASK_TYPES } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Project } from '@/types/project';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';
import { normalizeImportedProgress, rebuildImportedHierarchy } from '@/services/importNormalize';
import { csvDateOrToday } from '@/services/importDates';
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
  predecessors: string;
  taskType: string;
  customTaskTypeId: string;
  status: string;
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

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
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
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
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

function parseStatus(s: string): TaskStatus {
  const upper = s.toUpperCase().trim();
  if (upper === 'STARTED' || upper === 'IN_PROGRESS') return 'STARTED';
  if (upper === 'COMPLETED' || upper === 'COMPLETE') return 'COMPLETED';
  return 'NOT_STARTED';
}

/** CSV-datum: ISO of `DD-MM-YYYY`/`DD/MM/YYYY`; gedeeld met de import-datumhelper (F5-a). */
function parseDate(s: string): string {
  return csvDateOrToday(s);
}

function parsePredecessorString(predStr: string): {
  wbs: string; type: SequenceType; lag: number;
  lagUnit?: 'ELAPSEDTIME'; lagPercent?: number;
}[] {
  if (!predStr.trim()) return [];
  const results: {
    wbs: string; type: SequenceType; lag: number;
    lagUnit?: 'ELAPSEDTIME'; lagPercent?: number;
  }[] = [];
  // Split by comma or semicolon (within predecessor field)
  const parts = predStr.split(/[,]/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Pattern: WBS_CODE + TYPE + optional LAG (MS Project-notatie)
    // e.g. "1.1FS+2d" (werkdagen), "1.3SS-1d", "1.2FF+3ed" (kalenderdagen/elapsed),
    //      "1.5SS+50%" (procent van voorgangerduur), "1.6FS-25e%" (elapsed-procent), "1.4"
    // Critreview #159: de code is VRIJE TEKST (`T107`, `A-01` uit een IFC-/P6-import), niet `[\d.]+` —
    // lazy `.+?` laat het type-achtervoegsel en de lag het einde bepalen.
    const match = trimmed.match(/^(.+?)\s*(FS|FF|SS|SF)?\s*([+-]\d+(?:\.\d+)?(?:ed|e%|d|%)?)?$/i);
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

      let lag = 0;
      let lagUnit: 'ELAPSEDTIME' | undefined;
      let lagPercent: number | undefined;
      if (lagStr) {
        const lagMatch = lagStr.match(/^([+-]\d+(?:\.\d+)?)(ed|e%|d|%)?$/i);
        if (lagMatch) {
          const num = parseFloat(lagMatch[1]);
          const suffix = (lagMatch[2] || 'd').toLowerCase();
          if (!isNaN(num)) {
            if (suffix === '%' || suffix === 'e%') lagPercent = num;
            else lag = Math.round(num);
            if (suffix === 'ed' || suffix === 'e%') lagUnit = 'ELAPSEDTIME';
          }
        }
      }

      results.push({ wbs, type: typeMap[typeStr] || 'FINISH_START', lag, lagUnit, lagPercent });
    }
  }

  return results;
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
    status: ['status'],
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
  const lines = clean.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

  const headers = parseCSVLine(lines[0], delimiter);
  const colMap = mapColumnIndex(headers);

  // Parse all rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter);
    const get = (key: string, fallback = '') =>
      colMap[key] !== undefined ? (fields[colMap[key]] || fallback) : fallback;

    const completionStr = get('completion', '0');
    let completion = parseFloat(completionStr) || 0;
    // If > 1, treat as percentage
    if (completion > 1) completion = completion / 100;

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
    const recordedFloat = recordedFloatRaw ? Number.parseFloat(recordedFloatRaw) : Number.NaN;

    const outlineLevelRaw = get('outlineLevel').trim();
    rows.push({
      recorded: buildRecordedTime({
        start: recordedStartRaw ? parseDate(recordedStartRaw) : undefined,
        finish: recordedFinishRaw ? parseDate(recordedFinishRaw) : undefined,
        totalFloat: Number.isFinite(recordedFloat) ? recordedFloat : undefined,
        isCritical: recordedCriticalRaw === 'yes' || recordedCriticalRaw === 'ja' || recordedCriticalRaw === 'true' || recordedCriticalRaw === '1' ? true
          : recordedCriticalRaw === 'no' || recordedCriticalRaw === 'nee' || recordedCriticalRaw === 'false' || recordedCriticalRaw === '0' ? false
            : undefined,
      }),
      wbs: get('wbs'),
      ...(outlineLevelRaw ? { outlineLevel: parseInt(outlineLevelRaw, 10) } : {}),
      name: get('name', 'Task'),
      // `|| 5` maakte van duur 0 (een mijlpaal) stil 5 dagen (critreview #159): alleen een ONLEESBARE
      // waarde valt terug op de default.
      duration: Number.isFinite(parseFloat(get('duration', '5'))) ? parseFloat(get('duration', '5')) : 5,
      start: parseDate(get('start')),
      finish: parseDate(get('finish')),
      predecessors: get('predecessors'),
      taskType: get('taskType', 'CONSTRUCTION'),
      customTaskTypeId: get('customTaskTypeId').trim(),
      status: get('status', 'NOT_STARTED'),
      completion,
      actualStart: actualStartRaw ? parseDate(actualStartRaw) : undefined,
      actualFinish: actualFinishRaw ? parseDate(actualFinishRaw) : undefined,
      critical: get('critical', 'No').toLowerCase() === 'yes',
      totalFloat: parseFloat(get('totalFloat', '0')) || 0,
      description: get('description'),
    });
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
  for (const row of rows) {
    const id = generateId('task');
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
      status: parseStatus(row.status),
      isMilestone: row.duration === 0,
      priority: 0,
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
          lagDays: pred.lag,
        };
        if (pred.lagUnit) seq.lagUnit = pred.lagUnit;
        if (pred.lagPercent !== undefined) seq.lagPercent = pred.lagPercent;
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
  const allStarts = tasks.map(t => t.time.scheduleStart).filter(Boolean).sort();
  const allFinishes = tasks.map(t => t.time.scheduleFinish).filter(Boolean).sort();

  const project: Project = {
    id: generateId('proj'),
    name: 'CSV Import',
    description: '',
    startDate: allStarts[0] || formatDate(new Date()),
    endDate: allFinishes[allFinishes.length - 1] || '',
    calendarId: 'cal-default',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    author: '',
    company: '',
  };

  return {
    project,
    calendar: createDefaultCalendar(),
    tasks,
    sequences,
    resources: [],
    assignments: [],
    customTaskTypes: [...customById.values()],
    ...(Object.keys(recordedTimes).length > 0 ? { recordedTimes, recordedTimesOrigin: 'csv' as const } : {}),
  };
}
