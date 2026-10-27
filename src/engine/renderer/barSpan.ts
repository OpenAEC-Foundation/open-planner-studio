// De grenzen van een taakbalk op de Gantt-as: één regel voor het scherm (`GanttRenderer`) en de afdruk
// (`printPreview`), zodat die twee een balk nooit verschillend tekenen. De afdruk rekende eerder elke balk in
// hele dagen (`parseDate` + één dag): twee aansluitende halve dagen werden twee overlappende hele dagen, en
// een dag van 00:00 tot 00:00 werd twee dagen breed (aanval na #600).
import type { Task } from '@/types/task';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { finishInstant, shownFinish, shownStart } from '@/utils/taskDates';

export interface TaskBarSpan {
  /** De taak heeft momenten (start of einde met een tijd). */
  hourMode: boolean;
  start: Date;
  /** Met momenten het EXCLUSIEVE eindmoment; met alleen datums het begin van de laatste dag. */
  end: Date;
  x1: number;
  x2: number;
}

/**
 * De balk van een taak op de as. Met momenten: van het startmoment tot het exclusieve eindmoment
 * (`finishInstant`: een einde zonder tijd in een fase met momenten loopt tot het einde van die dag). Alleen
 * datums (van vóór het minutenmodel): de dagcellen, dus de einddag telt mee (`+ zoom`). Ontbreekt één kant,
 * dan leent die van de andere; zonder enige datum `null`.
 */
export function taskBarSpan(task: Task, dateToX: (date: Date) => number, zoom: number): TaskBarSpan | null {
  const rawStart = shownStart(task) || '';
  const rawEnd = shownFinish(task) || '';
  const startStr = rawStart || rawEnd;
  const endStr = rawEnd || rawStart;
  if (!startStr) return null;
  const hourMode = startStr.includes('T') || endStr.includes('T');
  const start = hourMode ? parseInstant(startStr) : parseDate(startStr);
  const end = hourMode ? finishInstant(endStr) : parseDate(endStr);
  const x1 = dateToX(start);
  const x2 = hourMode ? dateToX(end) : dateToX(end) + zoom;
  return { hourMode, start, end, x1, x2 };
}

/**
 * Het anker van een mijlpaalruit. Een mijlpaal met een moment staat op dat moment. Alleen een datum: een
 * startmijlpaal op het dagbegin, een eindmijlpaal op het dageinde, anders midden in de dag.
 */
export function milestoneAnchorX(task: Task, dateToX: (date: Date) => number, zoom: number): number | null {
  const startStr = shownStart(task) || shownFinish(task);
  if (!startStr) return null;
  const hourMode = startStr.includes('T');
  const date = hourMode ? parseInstant(startStr) : parseDate(startStr);
  const anchor = hourMode ? 0 : task.milestoneKind === 'START' ? 0 : task.milestoneKind === 'FINISH' ? zoom : zoom / 2;
  return dateToX(date) + anchor;
}
