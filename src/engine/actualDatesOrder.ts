import type { TaskTime } from '@/types/task';
import { parseInstant } from '@/utils/dateUtils';

export function orderActualsAfterDerivedFinish(
  time: Pick<TaskTime, 'actualStart' | 'actualFinish'>,
  statusDate: string | undefined,
  startWasDerived: boolean,
): void {
  if (!time.actualStart || !time.actualFinish) return;
  if (parseInstant(time.actualFinish).getTime() >= parseInstant(time.actualStart).getTime()) return;
  if (startWasDerived && statusDate) time.actualStart = time.actualFinish;
  else time.actualFinish = time.actualStart;
}
