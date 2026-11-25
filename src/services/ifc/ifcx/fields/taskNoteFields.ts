import type { ExternalLink, ExternalSourceRef, Task, TaskNote } from '@/types/task';
import { arrayOf, BOOLEAN, objectOf, REAL, TEXT, type IfcxField, type IfcxMember } from '../fieldTable';
import { enumOfTable, optional, required } from './passthroughFields';
import { taskField } from './taskScheduleFields';
import type { TaskReadTarget, TaskWriteSource } from './taskFields';

type TaskField = IfcxField<TaskWriteSource, TaskReadTarget>;

const DIRECTIONS = { predecessor: true, successor: true } satisfies Record<ExternalLink['direction'], true>;
const RELATION_TYPES = { FS: true, SS: true, FF: true, SF: true } satisfies Record<ExternalLink['relType'], true>;

const NOTES = arrayOf(objectOf({
  id: required(TEXT), text: required(TEXT), done: required(BOOLEAN),
} satisfies Record<keyof TaskNote, IfcxMember>));

const SOURCE_REF = objectOf({
  projectId: required(TEXT), projectName: optional(TEXT), taskId: required(TEXT), taskName: optional(TEXT),
  filePath: optional(TEXT), siteFileId: optional(TEXT),
} satisfies Record<keyof ExternalSourceRef, IfcxMember>);

const EXTERNAL_LINKS = arrayOf(objectOf({
  id: required(TEXT), direction: required(enumOfTable(DIRECTIONS)), relType: required(enumOfTable(RELATION_TYPES)),
  lagDays: optional(REAL), lagMinutes: optional(REAL), anchorDate: required(TEXT), sourceRef: required(SOURCE_REF),
  sourceMissing: required(BOOLEAN), sourceVersion: optional(TEXT), anchorReadAt: optional(TEXT),
} satisfies Record<keyof ExternalLink, IfcxMember>));

export const TASK_NOTE_FIELDS: readonly TaskField[] = [
  taskField('notes', NOTES),
  taskField('color', TEXT),
  taskField('externalLinks', EXTERNAL_LINKS),
];

export const TASK_NOTE_KEYS_CARRIED = TASK_NOTE_FIELDS.map(field => field.key as keyof Task);
