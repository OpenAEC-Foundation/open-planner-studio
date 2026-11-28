import { Task } from '@/types/task';
import type { UnrecordedExportField } from '@/state/recordedDatesSelectors';
import { Sequence, SequenceType } from '@/types/sequence';
import { Resource, ResourceAssignment } from '@/types/resource';
import { Project } from '@/types/project';
import { WorkCalendar } from '@/types/calendar';
import type { CustomTaskType } from '@/types/taskType';
import { flattenOrder, taskDepths } from '@/utils/wbs';
import { shownStart, shownFinish } from '@/utils/taskDates';
import { formatLagShort } from '@/utils/lagFormat';

const BOM = '\uFEFF';

export function escapeCSV(value: string): string {
  if (value.includes(';') || value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
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

export function formatCompletionPercent(completion: number): string {
  return String(Math.round(completion * 100));
}

export function writeCSV(
  _project: Project,
  _calendar: WorkCalendar,
  tasks: Task[],
  sequences: Sequence[],
  _resources: Resource[],
  _assignments: ResourceAssignment[],
  customTaskTypes: readonly CustomTaskType[] = [],
  unrecordedExportFieldsOf?: (task: Task) => readonly UnrecordedExportField[],
  lagHourSuffix: 'u' | 'h' = 'u',
  locale?: string,
): string {
  const decimal = new Intl.NumberFormat(locale, { numberingSystem: 'latn' })
    .formatToParts(1.1).find(part => part.type === 'decimal')!.value;
  const delimiter = decimal === ',' ? ';' : ',';
  const numberCell = (value: number) => escapeCSV(String(value).replace('.', decimal));

  const elapsedTaskCount = tasks.filter(t => t.time.durationType === 'ELAPSEDTIME').length;
  if (elapsedTaskCount > 0) {
    console.warn(`CSV-export: ${elapsedTaskCount} taak/taken met ELAPSEDTIME-duur (24/7-klokrekenen) geëxporteerd als gewone werktijd-duur — CSV kent geen elapsed-duurnotatie (§6).`);
  }

  const predMap = new Map<string, string[]>();
  const taskByIdMap = new Map<string, Task>();
  for (const t of tasks) {
    taskByIdMap.set(t.id, t);
  }

  const codeCount = new Map<string, number>();
  for (const t of tasks) codeCount.set(t.wbsCode, (codeCount.get(t.wbsCode) ?? 0) + 1);
  const duplicateCodes = [...codeCount].filter(([, n]) => n > 1).length;
  if (duplicateCodes > 0) {
    console.warn(`CSV-export: ${duplicateCodes} WBS-code(s) komen meer dan één keer voor — de Predecessors-kolom verwijst op WBS-code en is voor die taken bij terugimport niet eenduidig.`);
  }

  for (const seq of sequences) {
    const predTask = taskByIdMap.get(seq.predecessorId);
    if (!predTask) continue;
    const abbrev = sequenceTypeToAbbrev(seq.type);
    const lag = formatLagShort(seq, lagHourSuffix);
    const predStr = `${predTask.wbsCode}${abbrev}${lag}`;
    if (!predMap.has(seq.successorId)) {
      predMap.set(seq.successorId, []);
    }
    predMap.get(seq.successorId)!.push(predStr);
  }

  const headers = [
    'OPS Task ID',
    'WBS', 'Outline Level', 'Name', 'Duration (days)', 'Start', 'Finish',
    'Predecessors', 'Task Type', 'OPS Custom Task Type ID', 'Status', 'Completion (%)',
    'Actual Start', 'Actual Finish',
    'Critical', 'Total Float', 'Description',
  ];

  const rows: string[] = [];
  rows.push(headers.map(h => escapeCSV(h)).join(delimiter));

  const depthById = taskDepths(tasks);
  for (const task of flattenOrder(tasks)) {
    const predecessors = predMap.get(task.id)?.join(', ') || '';
    const completion = formatCompletionPercent(task.time.completion);
    const unrecorded = unrecordedExportFieldsOf?.(task);

    const row = [
      escapeCSV(task.id),
      escapeCSV(task.wbsCode),
      String(depthById.get(task.id) ?? 1),
      escapeCSV(task.name),
      numberCell(task.time.scheduleDuration),
      shownStart(task),
      shownFinish(task),
      escapeCSV(predecessors),
      task.customTaskTypeId ? escapeCSV(customTaskTypes.find(type => type.id === task.customTaskTypeId)?.name ?? 'USERDEFINED') : task.taskType,
      escapeCSV(task.customTaskTypeId ?? ''),
      task.status,
      completion,
      task.time.actualStart || '',
      task.time.actualFinish || '',
      unrecorded?.includes('isCritical') ? '' : (task.time.isCritical ? 'Yes' : 'No'),
      unrecorded?.includes('totalFloat') ? '' : numberCell(task.time.totalFloat),
      escapeCSV(task.description),
    ];
    rows.push(row.join(delimiter));
  }

  return BOM + rows.join('\r\n') + '\r\n';
}
