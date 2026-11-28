import type { SchedulingOptions } from '@/types/project';
import type { WorkTimeBands } from '@/types/calendar';
import type { ExternalLink } from '@/types/task';

export interface CalSpec {
  workDays?: number[];
  name?: string;
  description?: string;
  extraHolidays?: { name: string; fromDay: number; calendarDays: number }[];
  workTime?: WorkTimeBands;
}

export interface CodeTypeSpec {
  name: string;
  values: { code: string; description?: string; color?: string }[];
}

export interface FieldSpec {
  name: string;
  type: 'text' | 'number' | 'integer' | 'cost' | 'date' | 'boolean';
}

export interface ResourceSpec {
  name: string;
  type?: 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'SUBCONTRACTOR' | 'CREW';
  maxUnits?: number;
  description?: string;
  costPerHour?: number;
  unitOfMeasure?: string;
  calendar?: CalSpec;
  steps?: { fromDay: number; maxUnits: number }[];
  parent?: string;
}

export interface AssignSpec {
  res: string;
  units: number;
  curve?: 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED' | 'BELL' | 'EARLY_PEAK' | 'LATE_PEAK';
}

export interface ConstraintSpec2 { type: string; offsetDay?: number }
export interface ConstraintSpec extends ConstraintSpec2 {
  hard?: boolean;
}

export interface TaskSpec {
  key: string;
  name: string;
  dur?: number;
  durMinutes?: number;
  parent?: string;
  taskType?: string;
  milestone?: boolean;
  milestoneKind?: 'START' | 'FINISH';
  mandatory?: boolean;
  priority?: number;
  constraint?: ConstraintSpec;
  constraint2?: ConstraintSpec2;
  hammock?: boolean;
  deadlineDay?: number;
  codes?: Record<string, string>;
  fields?: Record<string, string | number | boolean>;
  assign?: AssignSpec[];
  description?: string;
  notes?: { text: string; done: boolean }[];
  completion?: number;
  actualStartDay?: number;
  actualFinishDay?: number;
  actualsFromPlan?: boolean;
  calendarKey?: string;
  externalLink?: Omit<ExternalLink, 'id'>;
}

export interface LinkSpec {
  pred: string;
  succ: string;
  type?: 'FINISH_START' | 'START_START' | 'FINISH_FINISH' | 'START_FINISH';
  lag?: number;
  lagUnit?: 'WORKTIME' | 'ELAPSEDTIME';
  lagPercent?: number;
}

export interface ScopeMutationSpec {
  addTasks?: TaskSpec[];
  addLinks?: LinkSpec[];
  extendDurations?: { key: string; dur: number }[];
  addHolidays?: { name: string; fromDay: number; calendarDays: number }[];
}

export interface BaselineSpec {
  name: string;
  mutationBefore?: ScopeMutationSpec;
}

export interface ProjectSpec {
  slug: string;
  name: string;
  author?: string;
  company?: string;
  description?: string;
  publicDescription?: string;
  category?: 'showcase' | 'basic' | 'external-source';
  tags?: string[];
  anchorShiftDays?: number;
  calendar?: CalSpec;
  calendars?: Record<string, CalSpec>;
  codeTypes?: CodeTypeSpec[];
  fields?: FieldSpec[];
  resources?: ResourceSpec[];
  tasks: TaskSpec[];
  links?: LinkSpec[];
  schedulingOptions?: SchedulingOptions;
  baselines?: BaselineSpec[];
  activeBaselineName?: string;
  comparedBaselineNames?: string[];
  statusDay?: number;
  statusFromPlanFinish?: string;
}
