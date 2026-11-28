import { hasForeignContent, type IfcSource } from '@/services/ifc/foreign/ifcSource';
import { splitIfcSchemaPatch } from './ifcSchemaChoice';
import type { Project } from '@/types/project';
import type { Sequence } from '@/types/sequence';
import { clampProjectStartAnchors } from '@/engine/scheduler/projectStartAnchorClamp';
import { settleDefaultWorkRuleSwitch, type DefaultWorkRuleSwitchState } from './defaultWorkRuleSwitch';

export type ClearableProjectKey = 'statusDate' | 'progressMode' | 'defaultWorkRule';

export interface ProjectPatchOutcome {
  clampedAnchors: number;
  measureChangedTaskIds: string[];
}

export function applyProjectPatch(
  s: DefaultWorkRuleSwitchState & { sequences: Sequence[]; taskTypesVisible: boolean; ifcSource?: IfcSource | null },
  updates: Partial<Project>,
  clear: readonly ClearableProjectKey[] = [],
): ProjectPatchOutcome {
  const prevStartDate = s.project.startDate;
  const previousDefault = s.project.defaultWorkRule;
  const metadata = hasForeignContent(s.ifcSource) ? splitIfcSchemaPatch(updates, s.project).rest : updates;
  Object.assign(s.project, metadata);
  for (const key of clear) delete s.project[key];
  s.project.modifiedAt = new Date().toISOString();
  if (updates.defaultWorkRule !== undefined) s.taskTypesVisible = true;
  const measureChangedTaskIds = settleDefaultWorkRuleSwitch(s, previousDefault);
  const clampedAnchors = typeof updates.startDate !== 'string' ? 0 : clampProjectStartAnchors({
    tasks: s.tasks, sequences: s.sequences, calendar: s.calendar, calendars: s.calendars,
    prevStartDate, nextStartDate: updates.startDate,
  });
  return { clampedAnchors, measureChangedTaskIds };
}
