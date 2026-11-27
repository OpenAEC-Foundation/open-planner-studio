import type { Project } from '@/types/project';
import type { XerImportMetadata } from '@/services/importTypes';
import { xerProjectCode } from '@/utils/xerDocumentName';

export function documentProjectCode(
  project: Pick<Project, 'p6ProjectCode'> | null | undefined,
  xerMeta?: XerImportMetadata | null,
): string | undefined {
  return project?.p6ProjectCode?.trim() || xerProjectCode(xerMeta);
}
