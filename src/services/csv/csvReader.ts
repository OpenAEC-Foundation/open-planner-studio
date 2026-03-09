import { Task, TaskType, TaskStatus } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar, createDefaultCalendar } from '@/types/calendar';
import { generateId } from '@/utils/id';
import { formatDate } from '@/utils/dateUtils';

interface ParsedRow {
  wbs: string;
  name: string;
  duration: number;
  start: string;
  finish: string;
  predecessors: string;
  taskType: string;
  status: string;
  completion: number;
  critical: boolean;
  totalFloat: number;
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
  const upper = s.toUpperCase().trim();
  const valid: TaskType[] = ['CONSTRUCTION', 'INSTALLATION', 'DEMOLITION', 'LOGISTIC', 'ATTENDANCE', 'MOVE', 'RENOVATION', 'MAINTENANCE', 'USERDEFINED'];
  return valid.includes(upper as TaskType) ? (upper as TaskType) : 'CONSTRUCTION';
}

function parseStatus(s: string): TaskStatus {
  const upper = s.toUpperCase().trim();
  if (upper === 'STARTED' || upper === 'IN_PROGRESS') return 'STARTED';
  if (upper === 'COMPLETED' || upper === 'COMPLETE') return 'COMPLETED';
  return 'NOT_STARTED';
}

function parseDate(s: string): string {
  if (!s) return formatDate(new Date());
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // Try DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  return formatDate(new Date());
}

function parsePredecessorString(predStr: string): { wbs: string; type: SequenceType; lag: number }[] {
  if (!predStr.trim()) return [];
  const results: { wbs: string; type: SequenceType; lag: number }[] = [];
  // Split by comma or semicolon (within predecessor field)
  const parts = predStr.split(/[,]/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Pattern: WBS_CODE + TYPE + optional LAG
    // e.g. "1.1FS+2d", "1.2FF", "1.3SS-1d", "1.4"
    const match = trimmed.match(/^([\d.]+)\s*(FS|FF|SS|SF)?\s*([+-]\d+d?)?$/i);
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
      if (lagStr) {
        lag = parseInt(lagStr.replace('d', ''));
        if (isNaN(lag)) lag = 0;
      }

      results.push({ wbs, type: typeMap[typeStr] || 'FINISH_START', lag });
    }
  }

  return results;
}

function mapColumnIndex(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const aliases: Record<string, string[]> = {
    wbs: ['wbs', 'wbs code', 'wbscode', 'outline'],
    name: ['name', 'task name', 'activity', 'taak', 'naam'],
    duration: ['duration', 'duration (days)', 'duur', 'days'],
    start: ['start', 'start date', 'begin', 'startdatum'],
    finish: ['finish', 'finish date', 'end', 'end date', 'eind', 'einddatum'],
    predecessors: ['predecessors', 'predecessor', 'voorgangers', 'depends on', 'links'],
    taskType: ['task type', 'type', 'tasktype', 'taaktype'],
    status: ['status'],
    completion: ['completion', 'completion (%)', '% complete', 'percent', 'voltooiing'],
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

export function readCSV(content: string): {
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
} {
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

    rows.push({
      wbs: get('wbs'),
      name: get('name', 'Task'),
      duration: parseFloat(get('duration', '5')) || 5,
      start: parseDate(get('start')),
      finish: parseDate(get('finish')),
      predecessors: get('predecessors'),
      taskType: get('taskType', 'CONSTRUCTION'),
      status: get('status', 'NOT_STARTED'),
      completion,
      critical: get('critical', 'No').toLowerCase() === 'yes',
      totalFloat: parseFloat(get('totalFloat', '0')) || 0,
      description: get('description'),
    });
  }

  // Create tasks and map WBS -> task id
  const tasks: Task[] = [];
  const wbsToId = new Map<string, string>();

  for (const row of rows) {
    const id = generateId('task');
    wbsToId.set(row.wbs, id);

    tasks.push({
      id,
      name: row.name,
      description: row.description,
      wbsCode: row.wbs,
      taskType: parseTaskType(row.taskType),
      status: parseStatus(row.status),
      isMilestone: row.duration === 0,
      priority: 0,
      parentId: null,
      childIds: [],
      time: {
        durationType: 'WORKTIME',
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
        completion: row.completion,
      },
      resourceIds: [],
    });
  }

  // Rebuild parent-child hierarchy from WBS codes
  for (const task of tasks) {
    if (!task.wbsCode || !task.wbsCode.includes('.')) continue;
    const parts = task.wbsCode.split('.');
    parts.pop();
    const parentWbs = parts.join('.');
    const parentId = wbsToId.get(parentWbs);
    if (parentId) {
      task.parentId = parentId;
      const parent = tasks.find(t => t.id === parentId);
      if (parent && !parent.childIds.includes(task.id)) {
        parent.childIds.push(task.id);
      }
    }
  }

  // Parse predecessors into sequences
  const sequences: Sequence[] = [];
  for (const task of tasks) {
    const row = rows.find(r => r.wbs === task.wbsCode);
    if (!row || !row.predecessors) continue;

    const preds = parsePredecessorString(row.predecessors);
    for (const pred of preds) {
      const predId = wbsToId.get(pred.wbs);
      if (predId) {
        sequences.push({
          id: generateId('seq'),
          predecessorId: predId,
          successorId: task.id,
          type: pred.type,
          lagDays: pred.lag,
        });
      }
    }
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
  };
}
