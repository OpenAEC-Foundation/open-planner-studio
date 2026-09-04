import { Task } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import type { CustomTaskType } from '@/types/taskType';

const DELIMITER = ';';
const BOM = '\uFEFF';

function escapeCSV(value: string): string {
  if (value.includes(DELIMITER) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sequenceTypeToAbbrev(type: SequenceType): string {
  switch (type) {
    case 'FINISH_START': return 'FS';
    case 'FINISH_FINISH': return 'FF';
    case 'START_START': return 'SS';
    case 'START_FINISH': return 'SF';
  }
}

// MS Project-notatie, symmetrisch met parsePredecessorString in csvReader:
// d = werkdagen, ed = kalenderdagen (elapsed), % = procent van voorgangerduur, e% = elapsed-procent.
function formatLag(seq: Sequence): string {
  const e = seq.lagUnit === 'ELAPSEDTIME' ? 'e' : '';
  if (typeof seq.lagPercent === 'number' && Number.isFinite(seq.lagPercent)) {
    return `${seq.lagPercent >= 0 ? '+' : ''}${seq.lagPercent}${e}%`;
  }
  if (seq.lagDays === 0) return '';
  return `${seq.lagDays > 0 ? '+' : ''}${seq.lagDays}${e}d`;
}

export function writeCSV(
  _project: Project,
  _calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  _resources: Resource[],
  _assignments: ResourceAssignment[],
  customTaskTypes: readonly CustomTaskType[] = [],
): string {
  // H5 (eindreview T16c): de "Duration (days)"-kolom kent geen elapsed-notatie (anders dan de
  // relatie-lag hierboven, die "ed"/"e%" al schrijft) — een taak met ELAPSEDTIME-duur (T8, 24/7-
  // klokrekenen, bv. uit een `.mpp`-import) schrijft daarom stil als gewone werktijd-duur.
  // Weggelaten-met-warn, zelfde patroon als de andere exporters (`mspdiWriter.ts`/`p6xmlWriter.ts`).
  const elapsedTaskCount = tasks.filter(t => t.time.durationType === 'ELAPSEDTIME').length;
  if (elapsedTaskCount > 0) {
    console.warn(`CSV-export: ${elapsedTaskCount} taak/taken met ELAPSEDTIME-duur (24/7-klokrekenen) geëxporteerd als gewone werktijd-duur — CSV kent geen elapsed-duurnotatie (§6).`);
  }

  // Build predecessor map: successorId -> list of predecessor descriptions
  const predMap = new Map<string, string[]>();
  const taskByIdMap = new Map<string, Task>();
  for (const t of tasks) {
    taskByIdMap.set(t.id, t);
  }

  for (const seq of sequences) {
    const predTask = taskByIdMap.get(seq.predecessorId);
    if (!predTask) continue;
    const abbrev = sequenceTypeToAbbrev(seq.type);
    const lag = formatLag(seq);
    const predStr = `${predTask.wbsCode}${abbrev}${lag}`;
    if (!predMap.has(seq.successorId)) {
      predMap.set(seq.successorId, []);
    }
    predMap.get(seq.successorId)!.push(predStr);
  }

  const headers = [
    'WBS', 'Name', 'Duration (days)', 'Start', 'Finish',
    'Predecessors', 'Task Type', 'OPS Custom Task Type ID', 'Status', 'Completion (%)',
    // Actuals (fase 2.6, §9.3): achter Completion. Kolomkoppen altijd aanwezig (CSV-conventie);
    // een taak zonder actuals levert lege cellen. Geen baselines/statusdatum in CSV (bewust).
    'Actual Start', 'Actual Finish',
    'Critical', 'Total Float', 'Description',
  ];

  const rows: string[] = [];
  rows.push(headers.map(h => escapeCSV(h)).join(DELIMITER));

  for (const task of tasks) {
    const predecessors = predMap.get(task.id)?.join(', ') || '';
    const completion = Math.round(task.time.completion * 100);

    const row = [
      escapeCSV(task.wbsCode),
      escapeCSV(task.name),
      task.time.scheduleDuration.toString(),
      task.time.earlyStart || task.time.scheduleStart,
      task.time.earlyFinish || task.time.scheduleFinish,
      escapeCSV(predecessors),
      task.customTaskTypeId ? (customTaskTypes.find(type => type.id === task.customTaskTypeId)?.name ?? 'USERDEFINED') : task.taskType,
      task.customTaskTypeId ?? '',
      task.status,
      completion.toString(),
      task.time.actualStart || '',
      task.time.actualFinish || '',
      task.time.isCritical ? 'Yes' : 'No',
      task.time.totalFloat.toString(),
      escapeCSV(task.description),
    ];
    rows.push(row.join(DELIMITER));
  }

  return BOM + rows.join('\r\n') + '\r\n';
}
