import { Task } from '@/types/task';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';

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

function formatLag(lagDays: number): string {
  if (lagDays === 0) return '';
  return lagDays > 0 ? `+${lagDays}d` : `${lagDays}d`;
}

export function writeCSV(
  _project: Project,
  _calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  _resources: Resource[],
  _assignments: ResourceAssignment[],
): string {
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
    const lag = formatLag(seq.lagDays);
    const predStr = `${predTask.wbsCode}${abbrev}${lag}`;
    if (!predMap.has(seq.successorId)) {
      predMap.set(seq.successorId, []);
    }
    predMap.get(seq.successorId)!.push(predStr);
  }

  const headers = [
    'WBS', 'Name', 'Duration (days)', 'Start', 'Finish',
    'Predecessors', 'Task Type', 'Status', 'Completion (%)',
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
      task.taskType,
      task.status,
      completion.toString(),
      task.time.isCritical ? 'Yes' : 'No',
      task.time.totalFloat.toString(),
      escapeCSV(task.description),
    ];
    rows.push(row.join(DELIMITER));
  }

  return BOM + rows.join('\r\n') + '\r\n';
}
