import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';

export type XerWriteLossCode =
  | 'taskDescriptions' | 'activityCodes' | 'customFields' | 'externalLinks' | 'baselines'
  | 'deadlines' | 'customTaskTypes' | 'taskCategories' | 'manualTasks' | 'elapsedDurations'
  | 'levelingDelays' | 'splits' | 'percentLags' | 'elapsedLags' | 'summaryRelations'
  | 'summaryAssignments' | 'summaryConstraints' | 'resourceTypes' | 'libraryLinks' | 'holidayNames' | 'noteStatus'
  | 'truncatedNames' | 'changedIds' | 'nonLatinText' | 'projectDetails' | 'schedulingRules'
  | 'summaryNotes' | 'priorities' | 'calendarKinds' | 'durationMilestones' | 'mandatoryMilestones'
  | 'costResources';

export interface XerWriteLoss {
  readonly code: XerWriteLossCode;
  readonly count: number;
}

export interface XerWriteInput {
  project: Project;
  calendar: WorkCalendar;
  calendars: readonly WorkCalendar[];
  tasks: readonly Task[];
  sequences: readonly Sequence[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
  baselineCount?: number;
  projectCode?: string | null;
  resourceCodes?: ReadonlyMap<string, string>;
  exportDate?: string;
}

export interface XerWriteResult {
  text: string;
  bytes: Uint8Array;
  encoding: 'windows-1252' | 'utf-8';
  loss: readonly XerWriteLoss[];
}

export const LOSS_ORDER: readonly XerWriteLossCode[] = [
  'schedulingRules', 'calendarKinds', 'baselines', 'summaryRelations', 'summaryAssignments', 'summaryConstraints', 'percentLags', 'elapsedLags',
  'elapsedDurations', 'manualTasks', 'durationMilestones', 'mandatoryMilestones', 'levelingDelays', 'splits', 'deadlines', 'externalLinks',
  'activityCodes', 'customFields', 'customTaskTypes', 'taskCategories', 'priorities', 'taskDescriptions',
  'summaryNotes', 'noteStatus',
  'resourceTypes', 'costResources', 'libraryLinks', 'holidayNames', 'projectDetails', 'truncatedNames', 'changedIds', 'nonLatinText',
];
