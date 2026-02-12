export type TaskType =
  | 'CONSTRUCTION'
  | 'INSTALLATION'
  | 'DEMOLITION'
  | 'LOGISTIC'
  | 'ATTENDANCE'
  | 'MOVE'
  | 'RENOVATION'
  | 'MAINTENANCE'
  | 'USERDEFINED';

export type TaskStatus = 'NOT_STARTED' | 'STARTED' | 'COMPLETED';

export type DurationType = 'WORKTIME' | 'ELAPSEDTIME';

export interface TaskTime {
  durationType: DurationType;
  scheduleDuration: number; // in work days
  scheduleStart: string;    // ISO 8601
  scheduleFinish: string;   // ISO 8601

  // CPM-computed
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  freeFloat: number;   // work days
  totalFloat: number;  // work days
  isCritical: boolean;

  // Tracking
  actualStart?: string;
  actualFinish?: string;
  actualDuration?: number;
  remainingTime?: number;
  completion: number; // 0.0 - 1.0
}

export interface Task {
  id: string;
  name: string;
  description: string;
  wbsCode: string;
  taskType: TaskType;
  status: TaskStatus;
  isMilestone: boolean;
  priority: number;
  parentId: string | null; // WBS parent
  childIds: string[];      // WBS children
  time: TaskTime;
  resourceIds: string[];
  color?: string;
}

export function createDefaultTaskTime(
  start: string,
  durationDays: number,
): TaskTime {
  return {
    durationType: 'WORKTIME',
    scheduleDuration: durationDays,
    scheduleStart: start,
    scheduleFinish: start,
    earlyStart: start,
    earlyFinish: start,
    lateStart: start,
    lateFinish: start,
    freeFloat: 0,
    totalFloat: 0,
    isCritical: false,
    completion: 0,
  };
}
