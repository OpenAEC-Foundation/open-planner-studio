import { projectIfcSchema, type Project } from '@/types/project';
import { DEFAULT_WORK_RULE } from '@/types/workRule';

export type ProjectInfoMetadata = Pick<
  Project, 'name' | 'description' | 'author' | 'company' | 'startDate' | 'endDate' | 'defaultTaskDurationUnit' | 'defaultWorkRule'
> & Partial<Pick<Project, 'ifcSchema' | 'anchorsFromOpenDocuments'>>;

const FIELDS = ['name', 'description', 'author', 'company', 'startDate', 'endDate'] as const;

export function projectInfoPatch(current: Project, draft: ProjectInfoMetadata): Partial<Project> {
  const patch: Partial<Project> = {};
  for (const key of FIELDS) {
    if ((current[key] ?? '') !== (draft[key] ?? '')) patch[key] = draft[key];
  }
  if ((current.defaultTaskDurationUnit ?? 'days') !== (draft.defaultTaskDurationUnit ?? 'days')) {
    patch.defaultTaskDurationUnit = draft.defaultTaskDurationUnit;
  }
  if (draft.defaultWorkRule !== undefined && (current.defaultWorkRule ?? DEFAULT_WORK_RULE) !== draft.defaultWorkRule) {
    patch.defaultWorkRule = draft.defaultWorkRule;
  }
  if (draft.ifcSchema !== undefined && projectIfcSchema(current) !== draft.ifcSchema) {
    patch.ifcSchema = draft.ifcSchema;
    if (current.ifcSchemaUnconfirmed !== undefined) patch.ifcSchemaUnconfirmed = undefined;
  }
  if (draft.anchorsFromOpenDocuments !== undefined
    && (current.anchorsFromOpenDocuments ?? false) !== draft.anchorsFromOpenDocuments) {
    patch.anchorsFromOpenDocuments = draft.anchorsFromOpenDocuments || undefined;
  }
  return patch;
}
