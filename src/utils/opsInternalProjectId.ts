export const OPS_INTERNAL_PROJECT_ID_PREFIX = 'OPS:';

export function isOpsInternalProjectId(id: string): boolean {
  return id.startsWith(OPS_INTERNAL_PROJECT_ID_PREFIX);
}
